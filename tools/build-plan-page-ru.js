#!/usr/bin/env node
/**
 * Builds the HTML page published as the Hoxton defect-plan artifact.
 *
 *   node gilbahub/tools/build-plan-page-ru.js
 *
 * Input:  gilbahub/files/fixes/26-08-17-hoxton-v6/PLAN-remaining-defects-RU.md
 * Output: gilbahub/files/fixes/26-08-17-hoxton-v6/PLAN-remaining-defects-RU.html
 *
 * Page content only - no html/head/body wrapper; the artifact host supplies those.
 * Publish with the Artifact tool against the existing artifact URL so the page keeps
 * its identity.
 *
 * The markup and styling reproduce the published page: a masthead, a sticky table of
 * contents, one block per defect with its id / severity / tier chips, one block per
 * open question, closed questions kept but muted, and client quotes in their original
 * English inside a labelled blockquote.
 *
 * This file lives in the repository on purpose. The previous copy lived in a session
 * scratchpad and was lost when that directory was cleaned, which left the artifact a
 * week stale with no way to rebuild it.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DOC_DIR = path.join(ROOT, 'files', 'fixes', '26-08-17-hoxton-v6');
const SRC = path.join(DOC_DIR, 'PLAN-remaining-defects-RU.md');
const OUT = path.join(DOC_DIR, 'PLAN-remaining-defects-RU.html');

const CODE_MARK = String.fromCharCode(1); // sentinel while code spans are held aside

// ------------------------------------------------------------------ helpers

const TRANSLIT = {
    а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z',
    и: 'i', й: 'i', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
    с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch',
    ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya'
};

function slugify(text) {
    const bare = text.replace(/`/g, '').replace(/\*\*/g, '').toLowerCase();
    let s = '';
    for (const ch of bare) s += (TRANSLIT[ch] !== undefined ? TRANSLIT[ch] : ch);
    return s.replace(/[^a-z0-9]+/g, '-').replace(/^-+/, '').slice(0, 60);
}

function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function inline(src) {
    const codes = [];
    let s = src.replace(/`([^`]+)`/g, function (_, c) {
        codes.push(c);
        return CODE_MARK + (codes.length - 1) + CODE_MARK;
    });
    s = escapeHtml(s);
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,;:]|$)/g, '$1<em>$2</em>');
    s = s.replace(new RegExp(CODE_MARK + '(\\d+)' + CODE_MARK, 'g'), function (_, i) {
        return '<code>' + escapeHtml(codes[Number(i)]) + '</code>';
    });
    return s;
}

// A defect heading carries its identity in the text: "D07 / D07a — title, S2, Tier A".
function parseDefectHeading(text) {
    const m = /^([DD][0-9]+[a-z]?(?:\s*\/\s*[DD][0-9]+[a-z]?)*)\s*(?:—|-|–)\s*([\s\S]*)$/.exec(text.trim());
    if (!m) return null;
    const ids = m[1].split('/').map(function (x) { return x.trim(); });
    let rest = m[2];
    let severity = null;
    let tier = null;
    rest = rest.replace(/,\s*(S[1-4])\b/, function (_, s) { severity = s; return ''; });
    rest = rest.replace(/,\s*(Tier\s+[AB])\b/, function (_, t) { tier = t.replace(/\s+/, ' '); return ''; });
    return { ids: ids, title: rest.replace(/[,\s]+$/, ''), severity: severity, tier: tier };
}

const QUESTION_RE = /^\*\*Вопрос (\d+)\.\s+([\s\S]*?)\*\*(.*)$/;

// Styled as closed only on an explicit "ЗАКРЫТ"/"СНЯТ" in the heading. A question
// parked by a decision ("отложено", "вынесено за этот релиз") is still open work and
// must not read as settled. Which section it is filed under is counted separately.
const CLOSED_RE = /ЗАКРЫТ|ЗАКРЫТО|СНЯТ/;

// ------------------------------------------------------------------ build

function build() {
    const lines = fs.readFileSync(SRC, 'utf8').split('\n');

    const out = [];
    const toc = [];
    let section = null;        // 'defect' | null — the open block element
    let inClosedSection = false;
    let listType = null;
    let paragraph = [];
    let quote = [];

    function closeList() {
        if (listType) { out.push('</' + listType + '>'); listType = null; }
    }
    function flushParagraph() {
        if (!paragraph.length) return;
        out.push('<p>' + inline(paragraph.join(' ')) + '</p>');
        paragraph = [];
    }
    function flushQuote() {
        if (!quote.length) return;
        out.push('<blockquote><p class="quote-label">Из аудита клиента — оригинал на английском</p>');
        let buf = [];
        quote.forEach(function (l) {
            if (!l.trim()) { if (buf.length) { out.push('<p>' + inline(buf.join(' ')) + '</p>'); buf = []; } }
            else buf.push(l.trim());
        });
        if (buf.length) out.push('<p>' + inline(buf.join(' ')) + '</p>');
        out.push('</blockquote>');
        quote = [];
    }
    function closeSection() {
        if (section) { out.push('</section>'); section = null; }
    }
    function flushAll() { flushParagraph(); flushQuote(); closeList(); }

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].replace(/\s+$/, '');

        // blockquote — the client's own words
        if (/^>\s?/.test(line)) { flushParagraph(); closeList(); quote.push(line.replace(/^>\s?/, '')); continue; }
        if (quote.length && !line.trim()) { flushQuote(); continue; }

        if (!line.trim()) { flushParagraph(); closeList(); continue; }

        if (/^```/.test(line)) {
            flushAll();
            const body = [];
            i++;
            while (i < lines.length && !/^```/.test(lines[i])) { body.push(lines[i]); i++; }
            out.push('<pre><code>' + escapeHtml(body.join('\n')) + '</code></pre>');
            continue;
        }

        const h = /^(#{1,4})\s+(.*)$/.exec(line);
        if (h) {
            flushAll(); closeSection();
            const level = h[1].length;
            const text = h[2];
            if (/Закрытые вопросы/i.test(text)) inClosedSection = true;
            else if (level <= 2) inClosedSection = false;

            if (level >= 3) {
                const d = parseDefectHeading(text);
                const id = slugify(text);
                const closed = CLOSED_RE.test(text);
                if (d) {
                    toc.push({
                        id: id, kind: 'h3', closed: closed,
                        idLabel: d.ids.join('/'), text: d.title
                    });
                    out.push('<section class="defect" id="' + id + '"><header class="defect-head"><div class="chips">'
                        + d.ids.map(function (x) { return '<span class="chip chip-id">' + escapeHtml(x) + '</span>'; }).join('')
                        + (d.severity ? '<span class="chip chip-sev sev-' + d.severity + '">' + d.severity + '</span>' : '')
                        + (d.tier ? '<span class="chip chip-tier">' + d.tier + '</span>' : '')
                        + '</div><h3>' + inline(d.title) + '</h3></header>');
                } else {
                    toc.push({ id: id, kind: 'h3', closed: closed, idLabel: '', text: text });
                    out.push('<section class="defect" id="' + id + '"><header class="defect-head">'
                        + '<h3>' + inline(text) + '</h3></header>');
                }
                section = 'defect';
                continue;
            }

            const id = slugify(text);
            toc.push({ id: id, kind: 'h2', text: text });
            out.push('<h2 id="' + id + '">' + inline(text) + '</h2>');
            continue;
        }

        if (/^---+$/.test(line)) { flushAll(); out.push('<hr />'); continue; }

        const q = QUESTION_RE.exec(line.trim());
        if (q) {
            flushAll(); closeSection();
            const num = q[1];
            let title = q[2].replace(/\.\s*$/, '');
            const tail = q[3] || '';
            const closed = CLOSED_RE.test(title) || CLOSED_RE.test(tail);
            const id = 'q' + num;
            toc.push({
                id: id, kind: 'h3', closed: closed, filedClosed: inClosedSection,
                idLabel: num, text: title.split(/[.—]/)[0].trim()
            });
            out.push('<section class="defect question' + (closed ? ' question-closed' : '') + '" id="' + id + '">'
                + '<header class="defect-head"><div class="chips">'
                + '<span class="chip chip-id">Вопрос ' + num + '</span>'
                + (closed ? '<span class="chip chip-closed">закрыт</span>' : '')
                + '</div><h3>' + inline(title) + '</h3></header>');
            section = 'defect';
            if (tail.trim()) out.push('<p>' + inline(tail.trim()) + '</p>');
            continue;
        }

        if (/^\s*\|/.test(line)) {
            flushAll();
            const rows = [];
            while (i < lines.length && /^\s*\|/.test(lines[i])) { rows.push(lines[i].trim()); i++; }
            i--;
            const cells = rows.map(function (r) {
                return r.replace(/^\|/, '').replace(/\|$/, '').split('|').map(function (c) { return c.trim(); });
            });
            const body = cells.filter(function (r) {
                return !r.every(function (c) { return /^:?-+:?$/.test(c); });
            });
            out.push('<div class="scroller"><table>');
            if (body.length) {
                out.push('<thead><tr>' + body[0].map(function (c) {
                    return '<th>' + inline(c) + '</th>';
                }).join('') + '</tr></thead><tbody>');
                body.slice(1).forEach(function (r) {
                    out.push('<tr>' + r.map(function (c) { return '<td>' + inline(c) + '</td>'; }).join('') + '</tr>');
                });
                out.push('</tbody>');
            }
            out.push('</table></div>');
            continue;
        }

        const ol = /^\s*(\d+)\.\s+(.*)$/.exec(line);
        const ul = /^\s*[-*]\s+(.*)$/.exec(line);
        if (ol || ul) {
            flushParagraph(); flushQuote();
            const want = ol ? 'ol' : 'ul';
            if (listType !== want) { closeList(); out.push('<' + want + '>'); listType = want; }
            out.push('<li>' + inline(ol ? ol[2] : ul[1]) + '</li>');
            continue;
        }

        closeList();
        paragraph.push(line.trim());
    }

    flushAll(); closeSection();

    const tocHtml = toc.map(function (t) {
        if (t.kind === 'h2') {
            return '<a class="toc-h2" href="#' + t.id + '">' + escapeHtml(t.text) + '</a>';
        }
        return '<a class="toc-h3' + (t.closed ? ' toc-closed' : '') + '" href="#' + t.id + '">'
            + (t.idLabel ? '<span class="toc-id">' + escapeHtml(t.idLabel) + '</span>' : '')
            + '<span class="toc-text">' + escapeHtml(t.text) + '</span></a>';
    }).join('');

    const questions = toc.filter(function (t) { return /^q\d+$/.test(t.id); });
    const openQuestions = questions.filter(function (t) { return !t.filedClosed; }).length;

    return TEMPLATE
        .replace('{{TOC}}', tocHtml)
        .replace('{{BODY}}', out.join('\n'))
        .replace('{{OPEN}}', String(openQuestions))
        .replace('{{CHECKED}}', CHECKED_ON);
}

// Set by hand when the plan's own "код сверен" statement changes; not derived.
const CHECKED_ON = '7 сен 2026';

const TEMPLATE = `<title>План устранения дефектов Hoxton</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600&family=Source+Sans+3:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
:root {
  --paper:#F6F7F3; --surface:#FFFFFF; --ink:#191D19; --body:#33392F; --muted:#6A7166;
  --rule:#DCE0D5; --rule-soft:#E8EBE3; --accent:#3D6B4E; --accent-soft:#EAF0EA;
  --s1:#9E3520; --s2:#A2712A; --s3:#4F6070; --s4:#7B8177;
  --quote-bg:#F1F3ED; --code-bg:#ECEFE7;
  --serif:"Newsreader",Georgia,"Times New Roman",serif;
  --sans:"Source Sans 3","Helvetica Neue",Arial,sans-serif;
  --mono:"IBM Plex Mono",ui-monospace,"SFMono-Regular",Menlo,monospace;
}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){
  --paper:#14170F; --surface:#1A1E17; --ink:#E9ECE2; --body:#C8CDBF; --muted:#8D9484;
  --rule:#2C3227; --rule-soft:#232920; --accent:#8FBE9C; --accent-soft:#1F2A21;
  --s1:#E0836C; --s2:#D6A85C; --s3:#93AAC0; --s4:#98A08F;
  --quote-bg:#1C2019; --code-bg:#232920;
}}
:root[data-theme="dark"]{
  --paper:#14170F; --surface:#1A1E17; --ink:#E9ECE2; --body:#C8CDBF; --muted:#8D9484;
  --rule:#2C3227; --rule-soft:#232920; --accent:#8FBE9C; --accent-soft:#1F2A21;
  --s1:#E0836C; --s2:#D6A85C; --s3:#93AAC0; --s4:#98A08F;
  --quote-bg:#1C2019; --code-bg:#232920;
}
*{box-sizing:border-box}
body{background:var(--paper);color:var(--body);font-family:var(--sans);font-size:16.5px;line-height:1.62;
  -webkit-font-smoothing:antialiased}
.wrap{max-width:1180px;margin:0 auto;padding:0 28px 96px}

/* masthead */
.masthead{padding:56px 0 28px;border-bottom:1px solid var(--rule)}
.eyebrow{font-family:var(--mono);font-size:11.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--accent);margin:0 0 14px}
.masthead h1{font-family:var(--serif);font-weight:500;font-size:clamp(31px,4.4vw,50px);line-height:1.12;
  letter-spacing:-.015em;color:var(--ink);margin:0;text-wrap:balance;max-width:22ch}
.standfirst{margin:16px 0 0;max-width:62ch;font-size:17.5px;color:var(--body)}
.meta{display:flex;flex-wrap:wrap;gap:26px;margin-top:26px;padding-top:20px;border-top:1px solid var(--rule-soft)}
.meta div{display:flex;flex-direction:column;gap:3px}
.meta dt{font-family:var(--mono);font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}
.meta dd{margin:0;font-size:15px;color:var(--ink);font-variant-numeric:tabular-nums}

/* layout */
.cols{display:grid;grid-template-columns:1fr;gap:0}
@media (min-width:1040px){.cols{grid-template-columns:246px minmax(0,1fr);gap:56px;align-items:start}}
nav.toc{display:none}
@media (min-width:1040px){
  nav.toc{display:block;position:sticky;top:24px;max-height:calc(100vh - 48px);overflow-y:auto;
    padding:30px 0 40px;border-right:1px solid var(--rule-soft)}
}
nav.toc a{display:block;text-decoration:none;color:var(--muted);padding:3px 14px 3px 0}
nav.toc a:hover{color:var(--accent)}
.toc-h2{font-family:var(--sans);font-weight:600;font-size:13px;color:var(--ink)!important;margin-top:16px;
  letter-spacing:.005em}
.toc-h2:first-child{margin-top:0}
.toc-h3{display:grid!important;grid-template-columns:44px 1fr;gap:8px;font-size:12.5px;line-height:1.35;padding:4px 14px 4px 0}
.toc-id{font-family:var(--mono);font-size:11px;color:var(--accent)}
.toc-text{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

main{padding-top:30px;min-width:0}
main > p, main > ul, main > ol{max-width:70ch}

h2{font-family:var(--serif);font-weight:500;font-size:26px;line-height:1.25;color:var(--ink);
  margin:56px 0 18px;padding-bottom:10px;border-bottom:1px solid var(--rule);letter-spacing:-.01em;text-wrap:balance}
h2:first-child{margin-top:8px}
h3{font-family:var(--serif);font-weight:500;font-size:21px;line-height:1.3;color:var(--ink);margin:0;
  letter-spacing:-.005em;text-wrap:balance}
p{margin:0 0 15px}
a{color:var(--accent)}
hr{border:0;border-top:1px solid var(--rule-soft);margin:40px 0}
strong{color:var(--ink);font-weight:600}
code{font-family:var(--mono);font-size:.855em;background:var(--code-bg);color:var(--ink);
  padding:1.5px 5px;border-radius:3px;word-break:break-word}

/* defect blocks — the recurring object of this document */
.defect{margin:34px 0;padding:24px 26px;background:var(--surface);border:1px solid var(--rule-soft);
  border-radius:2px}
.defect > p, .defect > ul, .defect > ol{max-width:68ch}
.defect-head{margin-bottom:16px}
.chips{display:flex;flex-wrap:wrap;gap:7px;margin-bottom:10px}
.chip{font-family:var(--mono);font-size:11px;letter-spacing:.05em;padding:3px 8px;border-radius:2px;
  border:1px solid var(--rule);color:var(--muted);white-space:nowrap}
.chip-id{background:var(--accent-soft);border-color:transparent;color:var(--accent);font-weight:500}
.chip-sev{font-weight:500}
/* A closed question keeps its number in the panel — conversation still refers
   to it by number — but reads as settled rather than pending. */
.chip-closed{background:transparent;border-color:var(--rule);color:var(--muted);font-weight:500}
.question .chip-id{white-space:nowrap}
.question-closed h3{color:var(--muted)}
.toc-closed .toc-id{opacity:.55}
.toc-closed .toc-text{color:var(--muted);opacity:.75}
.sev-S1{color:var(--s1);border-color:currentColor}
.sev-S2{color:var(--s2);border-color:currentColor}
.sev-S3{color:var(--s3);border-color:currentColor}
.sev-S4{color:var(--s4);border-color:currentColor}

/* the client's own words, kept verbatim in English */
blockquote{margin:18px 0;padding:16px 20px 4px;background:var(--quote-bg);border-left:2px solid var(--accent)}
blockquote p{font-family:var(--serif);font-size:16.5px;line-height:1.58;color:var(--ink);max-width:64ch;font-style:italic}
.quote-label{font-family:var(--mono)!important;font-size:10.5px!important;letter-spacing:.05em;
  text-transform:none!important;color:var(--accent)!important;margin:0 0 8px!important;font-style:normal!important}

ul,ol{margin:0 0 16px;padding-left:22px}
li{margin-bottom:7px}
ul.sub{margin:7px 0 4px;padding-left:20px}
ol li::marker{font-family:var(--mono);font-size:.9em;color:var(--accent)}

.scroller{overflow-x:auto;margin:18px 0 22px;border:1px solid var(--rule-soft)}
table{border-collapse:collapse;width:100%;font-size:14.5px;background:var(--surface)}
th{font-family:var(--mono);font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);
  text-align:left;padding:11px 14px;border-bottom:1px solid var(--rule);white-space:nowrap;vertical-align:bottom}
td{padding:11px 14px;border-bottom:1px solid var(--rule-soft);vertical-align:top;
  font-variant-numeric:tabular-nums}
tr:last-child td{border-bottom:0}

a:focus-visible,nav.toc a:focus-visible{outline:2px solid var(--accent);outline-offset:2px;border-radius:2px}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
</style>

<div class="wrap">
  <header class="masthead">
    <p class="eyebrow">План внедрения · GAIP Hub</p>
    <h1>Оставшиеся дефекты Hoxton v6</h1>
    <p class="standfirst">Каждый дефект из аудита клиента, который ещё не закрыт, в его собственной
      последовательности приоритетов, а не по номеру дефекта — каждое утверждение сверено с текущим кодом,
      и прямо отмечено там, где предпосылка аудита больше не подтверждается. Цитаты клиента приведены
      на языке оригинала.</p>
    <dl class="meta">
      <div><dt>Исходный аудит</dt><dd>Hoxton v6 · 16 авг 2026</dd></div>
      <div><dt>Дефектов охвачено</dt><dd>49</dd></div>
      <div><dt>Код сверен на</dt><dd>{{CHECKED}}</dd></div>
      <div><dt>Открытых вопросов</dt><dd>{{OPEN}}</dd></div>
    </dl>
  </header>
  <div class="cols">
    <nav class="toc" aria-label="Содержание">{{TOC}}</nav>
    <main>{{BODY}}</main>
  </div>
</div>
`;

fs.writeFileSync(OUT, build(), 'utf8');
process.stdout.write('written ' + OUT + '\n');
