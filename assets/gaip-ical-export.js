/**
 * =============================================================================
 * GAIP iCal Export  v1.0.0
 * =============================================================================
 *
 * Generates a downloadable .ics file containing:
 *   - Spray log entries (last 90 days, all-day events)
 *   - PGR reapplication reminder (projected date, from GAIP_PGR_RESULT)
 *   - Pre-emergent timing alerts (AMBER/RED species only, from GAIP_PRE_EMERGENT_RESULT)
 *
 * Button is injected after #gaip-export-word using the same retry pattern as
 * word-export-combined.js.
 *
 * Dependencies (all already loaded by gaip_hub shortcode):
 *   - GAIP_HUB_CONFIG    (restUrl, csrfToken/restNonce, userId)
 *   - GAIP_SampleManager (getActiveSiteId, getCurrentSiteLabel)
 *   - GAIP_PGR_RESULT    (global, set by hub-orchestrator after PGR run)
 *   - GAIP_PRE_EMERGENT_RESULT (global, set by hub-orchestrator)
 *
 * =============================================================================
 */
(function (global) {
    'use strict';

    var VERSION = '1.0.0';

    // =========================================================================
    // HELPERS
    // =========================================================================

    function log() {
        var args = ['[iCalExport]'].concat(Array.prototype.slice.call(arguments));
        console.log.apply(console, args);
    }

    function warn() {
        var args = ['[iCalExport]'].concat(Array.prototype.slice.call(arguments));
        console.warn.apply(console, args);
    }

    function getRestUrl() {
        return ((global.GAIP_HUB_CONFIG && global.GAIP_HUB_CONFIG.restUrl) || '/api/').replace(/\/+$/, '');
    }

    function getCsrfToken() {
        if (global.GAIP_HUB_CONFIG && (global.GAIP_HUB_CONFIG.csrfToken || global.GAIP_HUB_CONFIG.restNonce || global.GAIP_HUB_CONFIG.nonce)) {
            return global.GAIP_HUB_CONFIG.csrfToken || global.GAIP_HUB_CONFIG.restNonce || global.GAIP_HUB_CONFIG.nonce;
        }
        var meta = document.querySelector('meta[name="csrf-token"]');
        return meta && meta.content ? meta.content : '';
    }

    function getActiveSiteId() {
        var SM = global.GAIP_SampleManager;
        if (SM && typeof SM.getActiveSiteId === 'function') return SM.getActiveSiteId();
        return 'default';
    }

    function getSiteLabel() {
        var SM = global.GAIP_SampleManager;
        if (SM && typeof SM.getCurrentSiteLabel === 'function') {
            var label = SM.getCurrentSiteLabel();
            if (label) return label;
        }
        // Fallback: read from site selector DOM
        var el = document.querySelector('.gaip-site-option.active[data-site-id]');
        return el ? (el.dataset.label || el.textContent.trim()) : 'My Site';
    }

    /**
     * Format a JS Date or ISO string as iCal DATE value: YYYYMMDD
     */
    function icalDate(dateInput) {
        var d = (dateInput instanceof Date) ? dateInput : new Date(dateInput);
        if (isNaN(d.getTime())) return null;
        var y = d.getFullYear();
        var m = String(d.getMonth() + 1).padStart(2, '0');
        var day = String(d.getDate()).padStart(2, '0');
        return y + m + day;
    }

    /**
     * Format a JS Date as iCal DATETIME (UTC): YYYYMMDDTHHmmssZ
     */
    function icalDateTime(dateInput) {
        var d = (dateInput instanceof Date) ? dateInput : new Date(dateInput);
        if (isNaN(d.getTime())) return null;
        return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    }

    /**
     * Escape text for iCal DESCRIPTION / SUMMARY per RFC 5545:
     * backslash, semicolon, comma must be escaped; newlines → \n
     */
    function icalEscape(str) {
        if (!str) return '';
        return String(str)
            .replace(/\\/g, '\\\\')
            .replace(/;/g, '\\;')
            .replace(/,/g, '\\,')
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '');
    }

    /**
     * Fold long lines per RFC 5545 §3.1 (max 75 octets, continuation with CRLF + SPACE)
     */
    function icalFold(line) {
        if (line.length <= 75) return line;
        var out = '';
        var pos = 0;
        while (pos < line.length) {
            if (pos === 0) {
                out += line.slice(0, 75);
                pos = 75;
            } else {
                out += '\r\n ' + line.slice(pos, pos + 74);
                pos += 74;
            }
        }
        return out;
    }

    /**
     * Build a single VEVENT block.
     * @param {Object} opts
     *   uid       {string}  unique identifier
     *   dtstart   {string}  YYYYMMDD (all-day) or YYYYMMDDTHHmmssZ
     *   dtend     {string}  YYYYMMDD or YYYYMMDDTHHmmssZ (exclusive for all-day)
     *   summary   {string}
     *   description {string}
     *   categories {string}
     *   color     {string}  X-APPLE-CALENDAR-COLOR (optional)
     */
    function buildVEvent(opts) {
        var isAllDay = opts.dtstart && opts.dtstart.length === 8;
        var lines = [
            'BEGIN:VEVENT',
            'UID:' + icalEscape(opts.uid),
            isAllDay
                ? 'DTSTART;VALUE=DATE:' + opts.dtstart
                : 'DTSTART:' + opts.dtstart,
            isAllDay
                ? 'DTEND;VALUE=DATE:' + opts.dtend
                : 'DTEND:' + opts.dtend,
            'DTSTAMP:' + icalDateTime(new Date()),
            'SUMMARY:' + icalEscape(opts.summary),
        ];

        if (opts.description) {
            lines.push('DESCRIPTION:' + icalEscape(opts.description));
        }
        if (opts.categories) {
            lines.push('CATEGORIES:' + icalEscape(opts.categories));
        }
        if (opts.color) {
            lines.push('X-APPLE-CALENDAR-COLOR:' + opts.color);
        }

        lines.push('END:VEVENT');

        return lines.map(icalFold).join('\r\n');
    }

    /**
     * Increment a YYYYMMDD string by 1 day (for DTEND of all-day events).
     */
    function nextDay(yyyymmdd) {
        var d = new Date(
            parseInt(yyyymmdd.slice(0, 4)),
            parseInt(yyyymmdd.slice(4, 6)) - 1,
            parseInt(yyyymmdd.slice(6, 8)) + 1
        );
        return icalDate(d);
    }

    // =========================================================================
    // DATA COLLECTION
    // =========================================================================

    /**
     * Fetch spray log entries for the active site, last 90 days.
     * Returns array of DB row objects.
     */
    async function fetchSprayLog(siteId) {
        var now = new Date();
        var from = new Date(now);
        from.setDate(from.getDate() - 90);

        var dateFrom = from.toISOString().slice(0, 10);
        var dateTo   = now.toISOString().slice(0, 10);

        var qs = new URLSearchParams({
            site_id:   siteId,
            date_from: dateFrom,
            date_to:   dateTo,
            limit:     500
        });

        var url = getRestUrl() + '/spray-log?' + qs.toString();

        try {
            var resp = await fetch(url, {
                method: 'GET',
                credentials: 'same-origin',
                headers: {
                    'Accept': 'application/json',
                    'X-CSRF-TOKEN': getCsrfToken()
                }
            });
            var data = await resp.json();
            if (data.success && Array.isArray(data.entries)) {
                log('Fetched', data.entries.length, 'spray log entries');
                return data.entries;
            }
            warn('Spray log fetch failed:', data.error || resp.status);
            return [];
        } catch (err) {
            warn('Spray log fetch error:', err);
            return [];
        }
    }

    /**
     * Build VEVENT blocks from spray log entries.
     * One event per entry (all-day on application_date).
     */
    function buildSprayEvents(entries, siteLabel) {
        var events = [];

        entries.forEach(function (entry) {
            var ds = icalDate(entry.application_date);
            if (!ds) return;

            var zone     = entry.zone     ? entry.zone.charAt(0).toUpperCase() + entry.zone.slice(1)   : '';
            var category = entry.product_category
                ? entry.product_category.charAt(0).toUpperCase() + entry.product_category.slice(1).replace(/_/g, ' ')
                : 'Spray';

            var summary = entry.product_name;
            if (zone) summary += ' — ' + zone;

            var descParts = [];
            if (entry.active_ingredient)  descParts.push('Active: ' + entry.active_ingredient);
            if (entry.frac_group)         descParts.push('FRAC: '   + entry.frac_group);
            if (entry.rate && entry.rate_unit) {
                descParts.push('Rate: ' + entry.rate + ' ' + entry.rate_unit);
            }
            if (entry.target)             descParts.push('Target: ' + entry.target);
            if (entry.notes)              descParts.push('Notes: '  + entry.notes);
            descParts.push('Site: ' + siteLabel);

            events.push(buildVEvent({
                uid:         'gilba-spray-' + (entry.log_id || ds + '-' + Math.random().toString(36).slice(2)) + '@gilbasolutions.com',
                dtstart:     ds,
                dtend:       nextDay(ds),
                summary:     summary,
                description: descParts.join('\n'),
                categories:  'Spray Log,' + category,
                color:       '#2563eb'
            }));
        });

        return events;
    }

    /**
     * Build a single VEVENT for PGR reapplication reminder.
     * Uses GAIP_PGR_RESULT.projection.reapplyDate (dateFormatted string or ISO).
     * Returns null if no valid projected date available.
     */
    function buildPGREvent(siteLabel) {
        var pgr = global.GAIP_PGR_RESULT;
        if (!pgr) return null;

        // Try projection.reapplyDate first, then projection.dateFormatted
        var proj = pgr.projection || {};
        var reapplyDateRaw = proj.reapplyDate || proj.dateFormatted || null;
        if (!reapplyDateRaw) return null;

        var ds = icalDate(reapplyDateRaw);
        if (!ds) return null;

        var productName = (pgr.product && pgr.product.name) ? pgr.product.name
                        : (pgr.product && pgr.product.type) ? pgr.product.type
                        : 'PGR';

        var appDate = (pgr.application && pgr.application.date)
                    ? pgr.application.date
                    : (pgr.applicationDate || null);

        var daysUntil = proj.daysUntil != null ? proj.daysUntil : null;

        var summary = 'PGR Reapplication — ' + productName;

        var descParts = ['PGR reapplication window — ' + siteLabel];
        if (productName)   descParts.push('Product: ' + productName);
        if (appDate)       descParts.push('Last applied: ' + appDate);
        if (daysUntil != null) {
            descParts.push(daysUntil > 0
                ? 'Days until due: ' + daysUntil
                : 'Overdue by ' + Math.abs(daysUntil) + ' days');
        }

        return buildVEvent({
            uid:         'gilba-pgr-reapply-' + ds + '@gilbasolutions.com',
            dtstart:     ds,
            dtend:       nextDay(ds),
            summary:     summary,
            description: descParts.join('\n'),
            categories:  'PGR,Reapplication Reminder',
            color:       '#7c3aed'
        });
    }

    /**
     * Build VEVENT blocks for pre-emergent timing alerts.
     * Only AMBER and RED_EARLY species are included.
     * Event date = today + daysToThreshold (best estimate of application window).
     */
    function buildPreEmergentEvents(siteLabel) {
        var preEm = global.GAIP_PRE_EMERGENT_RESULT;
        if (!preEm || !Array.isArray(preEm.results)) return [];

        var events = [];
        var today  = new Date();

        preEm.results.forEach(function (sp) {
            var status = sp.alertStatus || '';
            if (status !== 'AMBER' && status !== 'RED_EARLY') return;

            // Event date: for AMBER use daysToThreshold offset from today (window still open)
            //             for RED_EARLY use today (apply immediately)
            var eventDate;
            if (status === 'RED_EARLY') {
                eventDate = icalDate(today);
            } else {
                var days = (sp.daysToThreshold != null && sp.daysToThreshold > 0)
                    ? sp.daysToThreshold
                    : 0;
                var target = new Date(today);
                target.setDate(target.getDate() + days);
                eventDate = icalDate(target);
            }
            if (!eventDate) return;

            var name   = sp.commonName || sp.scientificName || sp.speciesKey || 'Weed';
            var urgent = status === 'RED_EARLY';
            var summary = (urgent ? '⚠ ' : '') + 'Pre-emergent: ' + name;

            var descParts = [];
            descParts.push('Pre-emergent application ' + (urgent ? 'window closing — apply immediately' : 'window open') + ' — ' + siteLabel);
            descParts.push('Species: ' + name);
            if (sp.scientificName && sp.scientificName !== name) {
                descParts.push('(' + sp.scientificName + ')');
            }
            if (sp.applyAt != null) {
                descParts.push('Apply at: ' + sp.applyAt + '°C soil temp');
            }
            if (sp.currentSoilTemp != null) {
                descParts.push('Current soil temp: ' + sp.currentSoilTemp + '°C');
            }
            if (sp.recommendedAction) {
                descParts.push(sp.recommendedAction);
            }

            events.push(buildVEvent({
                uid:         'gilba-preem-' + (sp.speciesKey || name.replace(/\s+/g, '-').toLowerCase()) + '-' + eventDate + '@gilbasolutions.com',
                dtstart:     eventDate,
                dtend:       nextDay(eventDate),
                summary:     summary,
                description: descParts.join('\n'),
                categories:  'Pre-emergent,' + (urgent ? 'Urgent' : 'Upcoming'),
                color:       urgent ? '#dc2626' : '#d97706'
            }));
        });

        return events;
    }

    // =========================================================================
    // CALENDAR ASSEMBLY
    // =========================================================================

    /**
     * Assemble the full iCal string from VEVENT blocks.
     */
    function buildCalendar(vevents, calendarName) {
        var lines = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//Gilba Solutions//GAIP Hub ' + VERSION + '//EN',
            'CALSCALE:GREGORIAN',
            'METHOD:PUBLISH',
            'X-WR-CALNAME:' + icalEscape(calendarName),
            'X-WR-CALDESC:' + icalEscape('Agronomic schedule exported from GAIP Hub'),
            'X-WR-TIMEZONE:Australia/Sydney',
        ].concat(vevents).concat(['END:VCALENDAR']);

        return lines.join('\r\n');
    }

    /**
     * Trigger browser download of .ics content.
     */
    function downloadICS(content, filename) {
        var blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
        var url  = URL.createObjectURL(blob);
        var a    = document.createElement('a');
        a.href     = url;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        setTimeout(function () {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 200);
    }

    // =========================================================================
    // MAIN EXPORT
    // =========================================================================

    async function runExport() {
        var btn = document.getElementById('gaip-export-ical');
        if (btn) {
            btn.disabled = true;
            btn.textContent = '⏳ Exporting...';
        }

        try {
            var siteId    = getActiveSiteId();
            var siteLabel = getSiteLabel();

            log('Exporting calendar for site:', siteId, siteLabel);

            // Fetch spray log (async REST call)
            var entries = await fetchSprayLog(siteId);

            // Build event blocks
            var sprayEvents   = buildSprayEvents(entries, siteLabel);
            var pgrEvent      = buildPGREvent(siteLabel);
            var preEmEvents   = buildPreEmergentEvents(siteLabel);

            var allEvents = sprayEvents
                .concat(pgrEvent ? [pgrEvent] : [])
                .concat(preEmEvents);

            if (allEvents.length === 0) {
                alert('No calendar events to export. Run an analysis first, then try again.');
                return;
            }

            var calName  = 'GAIP — ' + siteLabel;
            var content  = buildCalendar(allEvents, calName);
            var datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
            var slug     = siteLabel.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-').toLowerCase();
            var filename = 'gaip-' + slug + '-' + datePart + '.ics';

            downloadICS(content, filename);

            log('Export complete:', allEvents.length, 'events —',
                sprayEvents.length, 'spray,',
                pgrEvent ? 1 : 0, 'PGR,',
                preEmEvents.length, 'pre-emergent');

        } catch (err) {
            console.error('[iCalExport] Export failed:', err);
            alert('Calendar export failed. Check the browser console for details.');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.textContent = '📅 Export Calendar (.ics)';
            }
        }
    }

    // =========================================================================
    // BUTTON INJECTION
    // =========================================================================

    function createButton() {
        var btn      = document.createElement('button');
        btn.id       = 'gaip-export-ical';
        btn.type     = 'button';
        btn.textContent = '📅 Export Calendar (.ics)';

        // Match the style of the Export to Word button
        btn.style.cssText = [
            'display:inline-flex',
            'align-items:center',
            'gap:6px',
            'padding:8px 14px',
            'background:var(--gaip-good-bg)',
            'color:#166534',
            'border:1px solid #86efac',
            'border-radius:5px',
            'font-size:0.88em',
            'font-weight:500',
            'cursor:pointer',
            'margin-left:8px',
            'transition:background 0.15s',
        ].join(';');

        btn.addEventListener('mouseover',  function () { btn.style.background = 'var(--gaip-good-bg)'; });
        btn.addEventListener('mouseout',   function () { btn.style.background = 'var(--gaip-good-bg)'; });
        btn.addEventListener('click', runExport);

        return btn;
    }

    function injectButton() {
        // Already injected?
        if (document.getElementById('gaip-export-ical')) return;

        var wordBtn = document.getElementById('gaip-export-word');
        if (!wordBtn) return;

        var btn = createButton();
        // Insert after the word export button (and after the combined export if present)
        var afterTarget = document.getElementById('gaip-export-combined') || wordBtn;
        afterTarget.parentNode.insertBefore(btn, afterTarget.nextSibling);

        log('Button injected');
    }

    // =========================================================================
    // INIT
    // =========================================================================

    function init() {
        // Mirror word-export-combined.js retry timing — word button may be moved by tab nav
        var delays = [500, 1000, 2000, 3000, 5000];
        delays.forEach(function (ms) {
            setTimeout(injectButton, ms);
        });

        // Also re-inject on tab change in case export controls are re-rendered
        document.addEventListener('gaip:tab-change', function () {
            setTimeout(injectButton, 200);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Public interface
    global.GAIP_ICalExport = {
        version:   VERSION,
        export:    runExport,
        buildCalendar: buildCalendar
    };

}(window));
