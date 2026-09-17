/**
 * GH-441 (GH-439 stage 2) — one banner for "this site's settings could not be
 * read".
 *
 * Two failures raise it:
 *   - gaip:site-config-failed, from site-config-persistence.js, when
 *     GET /api/sites fails on a page that runs the legacy engine. That page
 *     also does not start the analysis: computing on the legacy form's own
 *     defaults produces figures that look exactly like measured ones.
 *   - gaip:samples-persistence-error with reason 'sites-list', from
 *     sample-persistence.js, when the site list itself cannot be read. The
 *     registry is no longer rebuilt from this browser's samples, so without
 *     this the page would simply show nothing and not say why.
 *
 * It lives in its own file because the two layouts load different things:
 * db-shell pages have dashboard-ui.js, and layouts.app pages (/hub and the
 * client-facing /morning-briefing) do not. A page that cannot show its data is
 * exactly the page that has to say so.
 */

(function (global) {
    'use strict';

    var BANNER_ID = 'db-settings-unavailable';

    function host() {
        return document.querySelector('.db-shell')
            || document.querySelector('.gaip-hub')
            || document.body;
    }

    function show(detail) {
        var parent = host();
        if (!parent) return;

        var banner = document.getElementById(BANNER_ID);
        if (!banner) {
            banner = document.createElement('div');
            banner.id = BANNER_ID;
            banner.setAttribute('role', 'alert');
            banner.style.cssText = 'margin:12px 16px;padding:12px 14px;border:1px solid #dc2626;'
                + 'border-radius:8px;background:#fef2f2;color:#7f1d1d;font-size:13px;line-height:1.5;'
                + 'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;';
            parent.insertBefore(banner, parent.firstChild);
        }

        var reason = (detail && detail.reason) || '';
        banner.textContent = "This site's settings could not be loaded, so nothing on this page has been "
            + 'calculated from them. Reload the page; if this keeps happening, the server is not answering'
            + (reason ? ' (' + reason + ')' : '') + '.';
    }

    document.addEventListener('gaip:site-config-failed', function (e) {
        show(e && e.detail);
    });

    document.addEventListener('gaip:samples-persistence-error', function (e) {
        var detail = (e && e.detail) || {};
        if (detail.reason !== 'sites-list') return;
        show(detail);
    });

    // Exposed for the pages that want to raise it themselves.
    global.GilbaSettingsUnavailable = { show: show };
})(window);
