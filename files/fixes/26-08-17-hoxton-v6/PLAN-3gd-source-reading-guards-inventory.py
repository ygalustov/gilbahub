#!/usr/bin/env python3
"""How the inventory for item 3gd was taken, so the number can be re-measured rather than trusted.

THE MARK: `expect(` on the SAME LINE as a search over the text that was read. A claim assembled over two
lines (`const m = src.match(...)` then `expect(m)`) is NOT caught by this mark, so the numbers printed
below are a LOWER BOUND. Measuring the real number is the first thing item 3ge does.

Run from `gilbahub/`: python3 files/fixes/26-08-17-hoxton-v6/PLAN-3gd-source-reading-guards-inventory.py tests
"""
import io, os, re, sys

TESTS = sys.argv[1] if len(sys.argv) > 1 else 'tests'
VERDICT = re.compile(
    r'expect\(\s*[^)\n]*\b(src|source|code|text|body|content|file)\b[^)\n]*\.\s*(match|indexOf|includes|search)\s*\('
    r'|expect\(\s*/[^/\n]+/[gimsu]*\s*\.\s*test\s*\(\s*(src|source|code|text)'
    r'|expect\(\s*(src|source|code|text)\s*\)\s*\.\s*(toMatch|toContain)')
STRIPS = re.compile(r'stripped|stripComment|replace\(\s*/\\/\\\*')

rows = []
for name in sorted(os.listdir(TESTS)):
    if not name.endswith('.test.js'):
        continue
    src = io.open(os.path.join(TESTS, name), encoding='utf-8').read()
    if 'readFileSync' not in src:
        continue
    hits = [i + 1 for i, line in enumerate(src.split('\n')) if VERDICT.search(line)]
    if not hits:
        continue
    rows.append((name, bool(STRIPS.search(src)), hits))

strips = [r for r in rows if r[1]]
bare = [r for r in rows if not r[1]]
print('verdict depends on a substring of the source: %d suites' % len(rows))
print('  strip comments first: %d' % len(strips))
print('  do NOT strip:         %d   (lower bound)' % len(bare))
for name, _, hits in bare:
    print('    %s  lines: %s' % (name, ','.join(str(h) for h in hits[:6]) + ('…' if len(hits) > 6 else '')))
