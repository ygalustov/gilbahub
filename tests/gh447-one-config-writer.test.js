/**
 * GH-447 — one writer for the site config column.
 *
 * GH-442 lost whole patches to a read-modify-write race: two requests each
 * read the row before the other had written, and the second replaced the
 * first. The fix was a transaction with a row lock, and two places needed it
 * -- the second found only because someone went looking.
 *
 * So the rule is not "every mutation takes the lock", which a third place
 * written correctly by hand would satisfy while still being a second copy of
 * the reasoning. The rule is that there is ONE mutation: App\Support\
 * SiteConfigWriter. This test asserts that, and every exemption below carries
 * the reason it is exempt in words, because an exemption with no reason is
 * indistinguishable from a place someone forgot.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const APP_DIR = path.join(__dirname, '../app/app');

// The writer itself, and the test suites that set up rows to act on. A test
// fixture is not a caller: it builds the state a case runs against, has no
// concurrency to lose to, and asserting through the product's own writer would
// make some cases impossible to set up.
const EXEMPT = {
    'Support/SiteConfigWriter.php':
        'this IS the writer -- the one place allowed to touch the column',
};

function phpFiles(dir) {
    const out = [];
    fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) return out.push(...phpFiles(full));
        if (entry.name.endsWith('.php')) out.push(full);
    });
    return out;
}

function codeLines(src) {
    let inBlock = false;
    return src.split('\n').map((line, i) => ({ line, n: i + 1 })).filter(({ line }) => {
        const t = line.trim();
        if (inBlock) {
            if (t.includes('*/')) inBlock = false;
            return false;
        }
        if (t.startsWith('/*')) {
            if (!t.includes('*/')) inBlock = true;
            return false;
        }
        return !t.startsWith('//') && !t.startsWith('*');
    });
}

/**
 * A statement that stores something in a site_configs row. Reads
 * (`->first()`, `->get()`, `->exists()`) are not writes and are not limited.
 *
 * GH-449: the first version of this looked for the query builder and for
 * `->update(['config' => ...])`, and missed the two forms Eloquent makes most
 * natural on a row already in hand -- `$row->forceFill(['config' => …])->save()`
 * and `$row->config = …; $row->save();`. Both are idiomatic, `forceFill` is
 * used elsewhere in this same code, and a third writer in either shape would
 * have walked past the guard in silence. Each is matched on its own below, and
 * each was shown catching a planted example.
 */
function configWrites(file) {
    const src = fs.readFileSync(file, 'utf8');
    const lines = codeLines(src);
    const hits = [];
    const add = (n, line, why) => hits.push({ n, why, line: line.trim().slice(0, 100) });

    lines.forEach(({ line, n }, idx) => {
        const window = lines.slice(idx, idx + 6).map((l) => l.line).join('\n');

        const mentionsConfigModel = /SiteConfig::(query\(\)|updateOrCreate|create)|configs\(\)->(create|updateOrCreate)/.test(line);
        const storesSomething = /->(create|updateOrCreate|insert|upsert|firstOrCreate)\(/.test(window)
            || /->update\(\s*\[\s*'config'/.test(window);
        if (mentionsConfigModel && storesSomething) add(n, line, 'query-builder write');

        // A row in hand: ->update(['config' => ...])
        if (/->update\(\s*\[\s*'config'\s*=>/.test(line)) add(n, line, "update(['config' => …])");

        // A row in hand: ->forceFill(['config' => ...]) — the save may be on
        // this line or a later one, so the fill itself is what is matched.
        if (/->forceFill\(\s*\[[^\]]*'config'\s*=>/.test(line)) add(n, line, "forceFill(['config' => …])");

        // A row in hand: $row->config = ...; followed by a save.
        if (/\$\w+->config\s*=\s*[^=]/.test(line) && /->save\(\)/.test(window)) {
            add(n, line, 'assignment to ->config followed by save()');
        }
    });

    return hits;
}

describe('GH-447 — nothing but SiteConfigWriter writes the config column', () => {
    test('every writer in app/ is either the helper or an exemption with a stated reason', () => {
        const offenders = [];

        phpFiles(APP_DIR).forEach((file) => {
            const relative = path.relative(APP_DIR, file);
            const hits = configWrites(file);
            if (!hits.length) return;
            if (EXEMPT[relative]) {
                // An exemption must say why, in this file, next to the name.
                expect(EXEMPT[relative].length).toBeGreaterThan(20);
                return;
            }
            hits.forEach((hit) => offenders.push(relative + ':' + hit.n + '  ' + hit.line));
        });

        expect(offenders).toEqual([]);
    });

    test('the helper is what holds the lock, and holds it around the read', () => {
        const src = fs.readFileSync(path.join(APP_DIR, 'Support/SiteConfigWriter.php'), 'utf8');
        const mutate = src.slice(src.indexOf('public static function mutate'), src.indexOf('public static function createEmpty'));

        expect(mutate).toMatch(/DB::transaction/);
        expect(mutate).toMatch(/->lockForUpdate\(\)/);
        // The read must be inside the transaction, before the mutator runs:
        // a lock taken after the read protects nothing.
        expect(mutate.indexOf('DB::transaction')).toBeLessThan(mutate.indexOf('lockForUpdate'));
        expect(mutate.indexOf('lockForUpdate')).toBeLessThan(mutate.indexOf('$mutator('));
        expect(mutate.indexOf('$mutator(')).toBeLessThan(mutate.indexOf('updateOrCreate'));
    });

    test('the callers that used to write for themselves now go through it', () => {
        // GH-546 (stage 1): `AnalysisCacheController` left this list and
        // `Support/AnalysisResults.php` took its place. The controller no longer
        // writes anything — it resolves the site, checks nothing itself and
        // hands the actor and the body to the owner of the analysis result,
        // which is what calls the writer. The guard is unchanged in strength:
        // the number of files reaching the config column is the same, and the
        // one that reaches it is the one that owns what is being written.
        //
        // Listed rather than exempted. An exemption says "this file may write
        // and we accept it"; what is true here is "this file does not write at
        // all, and another one does".
        // GH-550 (stage 4): `Support/AnalysisResults.php` leaves this list
        // in its turn, and for a stronger reason than the controller did — the
        // analysis result is not in the config column any more. It has its own
        // table, so there is nothing here for it to lock.
        const callers = {
            'Http/Controllers/SiteController.php': ['patchConfig', 'update', 'store', 'updateConfig'],
            'Console/Commands/RepairSiteConfigs.php': ['repair'],
        };

        Object.keys(callers).forEach((file) => {
            const src = fs.readFileSync(path.join(APP_DIR, file), 'utf8');
            expect({ file, usesWriter: /SiteConfigWriter::(mutate|createEmpty)\(/.test(src) })
                .toEqual({ file, usesWriter: true });
        });

        // And the file that left the list really did stop writing, rather than
        // being dropped from it. Without this, shortening the list would be a
        // way past the guard.
        [
            'Http/Controllers/AnalysisCacheController.php',
            'Support/AnalysisResults.php',
        ].forEach((gone) => {
            const goneSrc = fs.readFileSync(path.join(APP_DIR, gone), 'utf8');
            expect({ file: gone, usesWriter: /SiteConfigWriter::(mutate|createEmpty)\(/.test(goneSrc) })
                .toEqual({ file: gone, usesWriter: false });
        });
    });

    /**
     * GH-550 — the writer's own shape, now that its one special caller is gone.
     *
     * `mutate()` grew two parameters for the analysis result alone: `$syncedAt`,
     * because that row kept its produced-at date in `synced_at`, and then
     * `$keepSyncedAt`, to hold the same column still when a failed run wrote a
     * reason beside numbers it had not produced. The column meant one thing for
     * settings and another for that namespace, which is how two readers end up
     * disagreeing about a timestamp. With the result in its own table the column
     * means one thing again, and the parameters have no callers.
     */
    test('the config stamp says one thing — when the server stored the row', () => {
        const src = fs.readFileSync(path.join(APP_DIR, 'Support/SiteConfigWriter.php'), 'utf8');
        const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
        expect(code).toMatch(/function mutate\(string \$siteId, string \$namespace, Closure \$mutator\)/);
        expect(code).not.toMatch(/\$syncedAt/);
        expect(code).not.toMatch(/\$keepSyncedAt/);
        expect(code).toMatch(/'synced_at' => now\(\)/);
    });
});
