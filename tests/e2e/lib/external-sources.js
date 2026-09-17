/**
 * GH-497 — a live run's dependence on hosts we do not own, made visible.
 *
 * WHY THIS EXISTS. The live suites reach outside for their climate data. When
 * one of those hosts does not answer, the numbers the product computes go
 * empty, and the suite reddens on a value assertion — `printed: null, saved:
 * 100`. A failure caused by somebody else's outage and a failure caused by our
 * own arithmetic look exactly alike, and the next person spends the morning
 * looking for a defect in the export where there is none.
 *
 * HOW THE TWO ARE TOLD APART, and it is not by reading a message. A run that
 * uses this attaches the recorder to its browser context and then carries ONE
 * MORE TEST, with its own name:
 *
 *     'every external source this run depends on answered'
 *
 * jest prints the full name of a failing test (`● describe › test`), so the
 * discriminator is WHICH assertion failed, not what it said:
 *
 *   - that test red, value tests red  → a host did not answer; the numbers are
 *     a consequence and prove nothing about the product;
 *   - that test green, value tests red → the hosts answered and the product
 *     computed the wrong thing;
 *   - both green → nothing to report.
 *
 * The value assertions additionally carry the verdict as a FIELD of what they
 * compare, so a reader of that failure sees the network's state in the diff
 * itself rather than having to go looking for it.
 *
 * INDUCING THE FIRST CASE. `GILBA_E2E_BLOCK_HOSTS=a.example,b.example` makes
 * the recorder abort every request to those hosts, which is how the red proof
 * for an outage is produced without unplugging anything and without editing a
 * test. Unset — the normal run — it aborts nothing and only counts.
 */
'use strict';

/** Hosts this repo's live suites reach for climate data, for the tally. */
const KNOWN = {
    'api.open-meteo.com': 'Open-Meteo forecast/normals',
    'archive-api.open-meteo.com': 'Open-Meteo archive',
    'power.larc.nasa.gov': 'NASA POWER',
    'cdnjs.cloudflare.com': 'CDN (libraries)'
};

const BLOCKED = (process.env.GILBA_E2E_BLOCK_HOSTS || '')
    .split(',').map((s) => s.trim()).filter((s) => s);

/**
 * The host a request went to, or '' for the schemes that never leave the
 * browser — `data:`, `blob:`, `about:`. Those are not somebody else's server
 * and counting them as external would inflate the tally; measured, they were
 * eight of the first run's twenty.
 */
function hostOf(url) {
    if (/^(data|blob|about|chrome-extension):/i.test(url)) return '';
    try { return new URL(url).host || ''; } catch (e) { return ''; }
}

/**
 * Attach to a Playwright BrowserContext. Every request whose host is not the
 * application's own is counted; failures are kept with their reason.
 *
 * @param {object} context  playwright BrowserContext
 * @param {string} appUrl   the application's base URL — its host is "ours"
 */
async function watchExternal(context, appUrl) {
    const appHost = hostOf(appUrl);
    const byHost = {};
    const failures = [];
    const bump = (host, field) => {
        if (!byHost[host]) byHost[host] = { ok: 0, failed: 0, statuses: {} };
        byHost[host][field] += 1;
        return byHost[host];
    };

    if (BLOCKED.length) {
        await context.route('**/*', (route) => {
            const host = hostOf(route.request().url());
            if (BLOCKED.indexOf(host) >= 0) {
                return route.abort('failed');
            }
            return route.continue();
        });
    }

    context.on('response', (response) => {
        const host = hostOf(response.url());
        if (!host || host === appHost) return;
        const rec = bump(host, 'ok');
        rec.statuses[response.status()] = (rec.statuses[response.status()] || 0) + 1;
        if (response.status() >= 400) {
            rec.ok -= 1; rec.failed += 1;
            failures.push({ host: host, url: response.url().slice(0, 160), reason: 'HTTP ' + response.status() });
        }
    });
    context.on('requestfailed', (request) => {
        const host = hostOf(request.url());
        if (!host || host === appHost) return;
        bump(host, 'failed');
        failures.push({
            host: host, url: request.url().slice(0, 160),
            reason: (request.failure() && request.failure().errorText) || 'failed'
        });
    });

    return {
        appHost: appHost,
        blocked: BLOCKED.slice(),
        /** Hosts that failed at least once, deduplicated. */
        failedHosts: () => Array.from(new Set(failures.map((f) => f.host))).sort(),
        failures: () => failures.slice(),
        byHost: () => JSON.parse(JSON.stringify(byHost)),
        total: () => Object.keys(byHost).reduce((n, h) => n + byHost[h].ok + byHost[h].failed, 0),
        /**
         * The one value a test puts beside the number it is checking, so the
         * diff of a value failure says what the network was doing.
         */
        verdict: () => (failures.length
            ? 'external sources failed: ' + Array.from(new Set(failures.map((f) => f.host))).sort().join(', ')
            : 'all external sources answered'),
        /** One line per host, for the run log. */
        print: (label) => {
            const lines = ['[e2e] external requests' + (label ? ' (' + label + ')' : '') + ':'];
            Object.keys(byHost).sort().forEach((h) => {
                const r = byHost[h];
                lines.push('[e2e]   ' + h + ' — ok ' + r.ok + ', failed ' + r.failed
                    + ', statuses ' + JSON.stringify(r.statuses)
                    + (KNOWN[h] ? '  (' + KNOWN[h] + ')' : ''));
            });
            lines.push('[e2e]   total ' + Object.keys(byHost).reduce((n, h) => n + byHost[h].ok + byHost[h].failed, 0)
                + ' request(s) to ' + Object.keys(byHost).length + ' host(s)'
                + (BLOCKED.length ? '; blocked by GILBA_E2E_BLOCK_HOSTS: ' + BLOCKED.join(', ') : ''));
            process.stdout.write(lines.join('\n') + '\n');
        }
    };
}

module.exports = { watchExternal: watchExternal, KNOWN_HOSTS: KNOWN };
