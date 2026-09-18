/**
 * GH-536 (PLAN-samples-sync-FINAL, stage 3) — "the samples could not be loaded"
 * said out loud, with a Retry.
 *
 * WHY THIS EXISTS. Until this stage a failed read of GET /api/samples was
 * indistinguishable from an account with no samples: both arrived at the same
 * callback with `false`, and both were answered by filling the store from
 * `localStorage`. The screen looked normal, the client kept working, and every
 * edit stopped inside sample-persistence.js because samples restored from the
 * browser copy have no `serverId`. The copy is gone; what replaces it is this
 * banner and the read-only lock in sample-manager.js.
 *
 * WHAT IT LISTENS TO. `gaip:samples-persistence-ready`, the single exit of
 * restore(), which now carries `source: 'server' | 'empty' | 'error'`.
 *   - 'server'  banner cleared
 *   - 'empty'   banner cleared. A successful read of an account with no
 *               samples is not a failure, and the page's own empty states
 *               already say "no samples yet" truthfully.
 *   - 'error'   banner shown, store locked (by sample-persistence.js)
 *
 * ONE EXCEPTION, and it is deliberate: `reason === 'sites-list'`. When the site
 * list itself cannot be read, settings-unavailable-banner.js (GH-441) already
 * renders a banner for that exact failure. Two red boxes saying the same thing
 * in different words is worse than one, so this file stands down. The lock
 * still goes on, so the page is not silently broken -- there is a visible
 * reason for it, written by the other banner.
 *
 * NO SLOT, NO BANNER. /field-log and the /hub calculation iframe are
 * layouts.app and have no db-shell content header. The host lookup falls back
 * the way settings-unavailable-banner.js does, and if nothing is found the
 * failure goes to the console. For a hidden iframe that is the right amount of
 * noise.
 */

(function (global) {
    'use strict';

    var BANNER_ID = 'db-samples-unavailable';

    var TEXT_FAILED = 'Samples could not be loaded from the server. Nothing has been changed.';

    function partialText(count, total) {
        return 'Loaded ' + count + ' of ' + total + ' samples.';
    }

    function host() {
        return document.querySelector('.db-main')
            || document.querySelector('.db-shell')
            || document.querySelector('.gaip-hub')
            || document.body;
    }

    function hide() {
        var banner = document.getElementById(BANNER_ID);
        if (banner && banner.parentNode) banner.parentNode.removeChild(banner);
        setGenerateEnabled(true, '');
    }

    function retry() {
        var P = global.GAIP_SamplePersistence;
        if (!P || typeof P.restore !== 'function') return;
        var btn = document.getElementById(BANNER_ID + '-retry');
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Retrying...';
        }
        // restore() is the whole read. On success it reaches finishReady with
        // source 'server' or 'empty', which clears this banner through the same
        // listener that raised it.
        P.restore();
    }

    /**
     * The generate buttons, and why these two by name.
     *
     * The plan asks for the same refusal GH-377 established: a report that
     * cannot be built from real data is refused, not printed empty. Both of
     * these build their document out of the samples -- the Word report directly,
     * the iCal feed out of the nutrition programme the samples drive.
     *
     * "Generate LED Report" on the same page is NOT in this list. It runs
     * GSSH_LEDExport, and whether that path reads the samples at all was not
     * measured in this delivery, so it is left alone rather than disabled on a
     * guess.
     */
    var GENERATE_BUTTON_IDS = ['rp-export-word-btn', 'gaip-export-ical'];

    function setGenerateEnabled(enabled, message) {
        GENERATE_BUTTON_IDS.forEach(function (id) {
            var btn = document.getElementById(id);
            if (!btn) return;
            btn.disabled = !enabled;
            btn.style.opacity = enabled ? '' : '0.5';
            btn.style.cursor = enabled ? '' : 'not-allowed';

            var noteId = id + '-samples-note';
            var note = document.getElementById(noteId);
            if (enabled) {
                if (note && note.parentNode) note.parentNode.removeChild(note);
                return;
            }
            if (!note) {
                note = document.createElement('div');
                note.id = noteId;
                note.style.cssText = 'margin-top:6px;font-size:12px;color:#7f1d1d;';
                if (btn.parentNode) btn.parentNode.insertBefore(note, btn.nextSibling);
            }
            note.textContent = message;
        });
    }

    function show(detail) {
        var parent = host();
        if (!parent) {
            console.warn('[SamplesUnavailable] ' + TEXT_FAILED + ' (no slot on this page to say so)');
            return;
        }

        var message = detail && detail.partial && detail.total
            ? partialText(detail.count || 0, detail.total)
            : TEXT_FAILED;

        var banner = document.getElementById(BANNER_ID);
        if (!banner) {
            banner = document.createElement('div');
            banner.id = BANNER_ID;
            banner.setAttribute('role', 'alert');
            banner.style.cssText = 'display:flex;align-items:flex-start;gap:10px;margin:12px 16px;'
                + 'padding:12px 14px;border:1px solid #dc2626;border-radius:8px;background:#fef2f2;'
                + 'color:#7f1d1d;font-size:13px;line-height:1.5;'
                + 'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;';

            var icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            icon.setAttribute('width', '18');
            icon.setAttribute('height', '18');
            icon.setAttribute('viewBox', '0 0 24 24');
            icon.setAttribute('fill', 'none');
            icon.setAttribute('stroke', 'currentColor');
            icon.setAttribute('stroke-width', '2');
            icon.setAttribute('stroke-linecap', 'round');
            icon.setAttribute('aria-hidden', 'true');
            icon.style.cssText = 'flex:0 0 auto;margin-top:1px;';
            icon.innerHTML = '<circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="13"/>'
                + '<line x1="12" y1="16.5" x2="12" y2="16.5"/>';
            banner.appendChild(icon);

            var text = document.createElement('span');
            text.id = BANNER_ID + '-text';
            text.style.cssText = 'flex:1 1 auto;';
            banner.appendChild(text);

            var btn = document.createElement('button');
            btn.id = BANNER_ID + '-retry';
            btn.type = 'button';
            btn.textContent = 'Retry';
            btn.style.cssText = 'flex:0 0 auto;padding:4px 12px;border:1px solid #dc2626;border-radius:6px;'
                + 'background:#fff;color:#7f1d1d;font-size:12px;font-weight:600;cursor:pointer;'
                + 'font-family:inherit;';
            btn.addEventListener('click', retry);
            banner.appendChild(btn);

            parent.insertBefore(banner, parent.firstChild);
        }

        var textEl = document.getElementById(BANNER_ID + '-text');
        if (textEl) textEl.textContent = message;

        var retryBtn = document.getElementById(BANNER_ID + '-retry');
        if (retryBtn) {
            retryBtn.disabled = false;
            retryBtn.textContent = 'Retry';
        }

        setGenerateEnabled(false, message);
    }

    document.addEventListener('gaip:samples-persistence-ready', function (e) {
        var detail = (e && e.detail) || {};
        if (detail.source !== 'error') {
            hide();
            return;
        }
        if (detail.reason === 'sites-list') {
            // GH-441's banner has this one. See the header.
            return;
        }
        show(detail);
    });

    /**
     * The write-failure marker's other half. A POST/PATCH/DELETE that fails
     * leaves the sample `_dirty` and dispatches gaip:samples-persistence-error;
     * until this stage nothing read either. The per-sample marker and its Retry
     * live in sample-switcher-ui.js, next to the row they belong to; what this
     * file adds is the two texts the plan names for the two statuses that are
     * not about one sample at all.
     */
    function writeFailureText(status) {
        if (status === 403) return "You don't have permission to edit this site";
        if (status === 419) return 'Session expired — reload the page';
        return null;
    }

    global.GilbaSamplesUnavailable = {
        show: show,
        hide: hide,
        retry: retry,
        writeFailureText: writeFailureText,
        setGenerateEnabled: setGenerateEnabled,
        GENERATE_BUTTON_IDS: GENERATE_BUTTON_IDS,
        TEXT_FAILED: TEXT_FAILED,
        partialText: partialText
    };
})(window);
