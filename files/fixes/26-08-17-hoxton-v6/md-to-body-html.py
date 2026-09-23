#!/usr/bin/env python3
# Markdown -> semantic HTML fragment for the artifact.
# Tags only: h1-h4, p, ul/ol/li, table/thead/tbody/tr/th/td, strong, em, del,
# code, pre, blockquote, hr. No style, no class, no script, no head.
#
# Fixed 22.09.2026: bold did not assemble when it contained `code`.
# The code span became <code>...</code> BEFORE bold was parsed, and the angle
# brackets broke the pairing in the replacement. Code is now lifted into
# placeholders FIRST and put back LAST, so the bold pass never sees it.
import re, sys, html

SENT = '\x00'

UNBALANCED = []
CURLINE = [0]

def inline(text, code_store):
    # The unit of the balance check is exactly what arrived here: a paragraph,
    # a table cell, a list item, a heading. It used to count paragraphs only,
    # so an odd bold inside a cell or an item reached the output as asterisks.
    if re.sub(r'`[^`]+`', '', text).count('**') % 2:
        UNBALANCED.append((CURLINE[0], text.strip()[:90]))
    def take_code(m):
        code_store.append(m.group(1))
        return SENT + str(len(code_store) - 1) + SENT
    text = re.sub(r'`([^`]+)`', take_code, text)
    text = html.escape(text, quote=False)
    text = re.sub(r'~~(.+?)~~', r'<del>\1</del>', text)
    text = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', text, flags=re.S)
    text = re.sub(r'(?<![\*\w])\*([^\*\n]+?)\*(?![\*\w])', r'<em>\1</em>', text)
    def put_code(m):
        return '<code>' + html.escape(code_store[int(m.group(1))], quote=False) + '</code>'
    return re.sub(SENT + r'(\d+)' + SENT, put_code, text)

def convert(lines):
    out, i = [], 0
    codes = []
    def emit_para(buf, start_line):
        if not buf:
            return
        joined = '\n'.join(buf)
        CURLINE[0] = start_line
        out.append('<p>' + inline(joined, codes) + '</p>')
    while i < len(lines):
        raw = lines[i].rstrip('\n')
        CURLINE[0] = i + 1
        line = raw.strip()
        if not line:
            i += 1; continue
        if line.startswith('```'):
            i += 1; body = []
            while i < len(lines) and not lines[i].startswith('```'):
                body.append(lines[i].rstrip('\n')); i += 1
            i += 1
            out.append('<pre>' + html.escape('\n'.join(body), quote=False) + '</pre>')
            continue
        if re.fullmatch(r'-{3,}|\*{3,}|_{3,}', line):
            out.append('<hr>'); i += 1; continue
        m = re.match(r'(#{1,4})\s+(.*)', line)
        if m:
            lvl = len(m.group(1))
            out.append('<h%d>%s</h%d>' % (lvl, inline(m.group(2), codes), lvl))
            i += 1; continue
        if line.startswith('|') and i + 1 < len(lines) and re.match(r'^\|[\s:|-]+\|?\s*$', lines[i+1].strip()):
            header = [c.strip() for c in line.strip('|').split('|')]
            i += 2; rows = []
            while i < len(lines) and lines[i].strip().startswith('|'):
                rows.append([c.strip() for c in lines[i].strip().strip('|').split('|')]); i += 1
            out.append('<table><thead><tr>' + ''.join('<th>' + inline(c, codes) + '</th>' for c in header) + '</tr></thead><tbody>')
            for r in rows:
                out.append('<tr>' + ''.join('<td>' + inline(c, codes) + '</td>' for c in r) + '</tr>')
            out.append('</tbody></table>')
            continue
        # A table row with no separator line above it. That is the tail of a
        # table whose header stayed further up, behind a paragraph: the table
        # branch does not take it, and the paragraph collector excludes lines
        # starting with '|' -- so the line counter did not move at all. Here
        # such rows become a header-less table, and `i` always grows, so the
        # infinite loop cannot happen.
        if line.startswith('|'):
            rows = []
            while i < len(lines) and lines[i].strip().startswith('|'):
                cells = [c.strip() for c in lines[i].strip().strip('|').split('|')]
                if not re.match(r'^\|[\s:|-]+\|?\s*$', lines[i].strip()):
                    rows.append(cells)
                i += 1
            out.append('<table><tbody>')
            for r in rows:
                out.append('<tr>' + ''.join('<td>' + inline(c, codes) + '</td>' for c in r) + '</tr>')
            out.append('</tbody></table>')
            continue
        if line.startswith('>'):
            body = []
            while i < len(lines) and lines[i].strip().startswith('>'):
                body.append(re.sub(r'^\s*>\s?', '', lines[i].rstrip('\n'))); i += 1
            out.append('<blockquote><p>' + inline('\n'.join(body), codes) + '</p></blockquote>')
            continue
        m = re.match(r'(\s*)([-*+]|\d+\.)\s+(.*)', raw)
        if m:
            # Fixed 22.09.2026: a wrapped continuation line of a list item
            # became its own <li>, and bold opened on the item's first line was
            # left unpaired -- seven false hits of the balance check.
            ordered = bool(re.match(r'\d+\.', m.group(2)))
            tag = 'ol' if ordered else 'ul'
            base = len(m.group(1))
            items, starts = [], []
            while i < len(lines):
                cur = lines[i].rstrip('\n')
                mm = re.match(r'(\s*)([-*+]|\d+\.)\s+(.*)', cur)
                if mm and len(mm.group(1)) >= base:
                    items.append([mm.group(3)]); starts.append(i + 1); i += 1; continue
                if not cur.strip():
                    nxt = lines[i + 1].rstrip('\n') if i + 1 < len(lines) else ''
                    if re.match(r'(\s*)([-*+]|\d+\.)\s+', nxt):
                        i += 1; continue
                    break
                if items:
                    items[-1].append(cur.strip()); i += 1; continue
                break
            out.append('<' + tag + '>')
            for buf_i, item in enumerate(items):
                CURLINE[0] = starts[buf_i]
                out.append('<li>' + inline(' '.join(item), codes) + '</li>')
            out.append('</' + tag + '>')
            continue

        buf, start = [], i + 1
        while i < len(lines) and lines[i].strip() and not lines[i].strip().startswith(('#', '|', '>', '```')) \
              and not re.match(r'(\s*)([-*+]|\d+\.)\s+', lines[i].rstrip('\n')) \
              and not re.fullmatch(r'-{3,}', lines[i].strip()):
            buf.append(lines[i].rstrip('\n')); i += 1
        emit_para(buf, start)
    return '\n'.join(out), UNBALANCED

src, dst = sys.argv[1], sys.argv[2]
with open(src, encoding='utf-8') as f:
    lines = f.readlines()
body, unbalanced = convert(lines)
with open(dst, 'w', encoding='utf-8') as f:
    f.write(body + '\n')
print('input lines: %d, HTML lines: %d' % (len(lines), body.count('\n') + 1))
print('unpaired ** (bold crossing a paragraph boundary): %d' % len(unbalanced))
for ln, head in unbalanced:
    print('  line %d: %s' % (ln, head))
