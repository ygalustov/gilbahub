/**
 * =============================================================================
 * GILBA ALERT CLIENT v1.0.0
 * =============================================================================
 *
 * Reads orchestrator outputs after each gaip:orchestrator-complete event,
 * extracts threshold-relevant data, and POSTs to /api/alerts/check.
 *
 * The Laravel controller handles threshold evaluation and suppression.
 * This module only packages and ships the results — no threshold logic here.
 *
 * CONTACT CONFIG:
 * Contacts are stored per-site in the GAIP_SampleManager site config under
 * the key 'alertContacts':
 *   [
 *     { type: 'sms',   value: '+61412345678', alerts: ['disease','pre_emergent','stress'] },
 *     { type: 'email', value: 'super@club.com', alerts: ['disease'] }
 *   ]
 *
 * QUIET HOURS:
 * Stored per-site as 'alertQuietHours': true|false.
 * When true, PHP suppresses SMS between 22:00–07:00 UTC.
 *
 * @version 1.0.0
 * @since   b35fix107
 * @author  Gilba Solutions
 * =============================================================================
 */

(function(global) {
    'use strict';

    const VERSION    = '1.0.0';
    const LOG_PREFIX = '[GilbaAlerts]';

    // =========================================================================
    // CONFIGURATION
    // =========================================================================

    function getRestUrl() {
        return ((global.GAIP_HUB_CONFIG && global.GAIP_HUB_CONFIG.restUrl) || '/api/').replace(/\/+$/, '');
    }

    function getCsrfToken() {
        if (global.GAIP_HUB_CONFIG && (global.GAIP_HUB_CONFIG.csrfToken || global.GAIP_HUB_CONFIG.restNonce || global.GAIP_HUB_CONFIG.nonce)) {
            return global.GAIP_HUB_CONFIG.csrfToken || global.GAIP_HUB_CONFIG.restNonce || global.GAIP_HUB_CONFIG.nonce;
        }

        const meta = document.querySelector('meta[name="csrf-token"]');
        return meta && meta.content ? meta.content : '';
    }

    function apiFetch(path, options) {
        const headers = Object.assign({
            'Accept': 'application/json',
            'X-CSRF-TOKEN': getCsrfToken(),
        }, options && options.headers ? options.headers : {});

        return fetch(getRestUrl() + path, Object.assign({
            credentials: 'same-origin',
            headers: headers,
        }, options || {}));
    }

    function getActiveSiteId() {
        // b35fix272: GAIP_SiteContext is the single source of truth
        if (global.GAIP_SiteContext) return global.GAIP_SiteContext.getSiteId();
        if (global.GAIP_SampleManager && typeof global.GAIP_SampleManager.getActiveSiteId === 'function') {
            return global.GAIP_SampleManager.getActiveSiteId();
        }
        return null;
    }

    function getActiveSiteConfig() {
        const siteId = getActiveSiteId();
        if (!siteId) return null;
        if (global.GAIP_SampleManager && typeof global.GAIP_SampleManager.getSiteConfig === 'function') {
            return global.GAIP_SampleManager.getSiteConfig(siteId);
        }
        return null;
    }

    // =========================================================================
    // RESULT EXTRACTION
    // =========================================================================

    /**
     * Pull threshold-relevant fields from orchestrator computed results.
     * Keeps payload small — only what PHP needs for evaluation.
     */
    function extractResults() {
        const disease   = global.GAIP_DISEASE_RESULT;
        const sk        = global.GAIP_SK_RESULT || (disease && disease.smithKerns);
        const preEm     = global.GAIP_PRE_EMERGENT_RESULT;
        const stress    = global.GAIP_STRESS_TRAJECTORY_RESULT;

        return {
            disease: disease ? {
                overallScore: disease.overallScore || 0,
                topThreats:   (disease.topThreats || []).slice(0, 3).map(function(t) {
                    return { disease: t.disease, displayName: t.displayName, riskScore: t.riskScore };
                }),
            } : null,

            smithKerns: sk ? {
                riskIndex:   sk.riskIndex   || sk.riskPercent || 0,
                riskLevel:   sk.riskLevel   || '',
            } : null,

            preEmergent: preEm ? {
                aggregateStatus: preEm.aggregateStatus || '',
                results: (preEm.results || []).filter(function(r) {
                    return r.status === 'RED_EARLY' || r.status === 'RED_MISSED';
                }).map(function(r) {
                    return { key: r.key, commonName: r.commonName, name: r.name, status: r.status };
                }),
            } : null,

            stress: stress ? {
                summary: {
                    currentScore: (stress.summary && stress.summary.currentScore) || stress.currentScore || 0,
                    stressLevel:  (stress.summary && stress.summary.stressLevel)  || '',
                },
            } : null,
        };
    }

    // =========================================================================
    // ALERT CHECK
    // =========================================================================

    /**
     * Post results to PHP endpoint for threshold evaluation and delivery.
     * Fire-and-forget — failures are logged, not surfaced to user.
     */
    function checkAlerts() {
        const siteId     = getActiveSiteId();
        const siteConfig = getActiveSiteConfig();

        if (!siteId) {
            console.log(LOG_PREFIX, 'No active site — skipping alert check');
            return;
        }

        // Contacts must be configured for alerts to fire
        const contacts = (siteConfig && siteConfig.alertContacts) || [];
        if (!contacts.length) {
            return; // silent — no contacts configured is normal
        }

        const siteName   = (siteConfig && (siteConfig.name || siteConfig.siteName)) || siteId;
        const quietHours = !!(siteConfig && siteConfig.alertQuietHours);
        const results    = extractResults();

        // Skip if no engine has produced results yet
        if (!results.disease && !results.preEmergent && !results.stress) {
            return;
        }

        const payload = {
            site_id:     siteId,
            site_name:   siteName,
            contacts:    contacts,
            quiet_hours: quietHours,
            results:     results,
        };

        apiFetch('/alerts/check', {
            method:  'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        })
        .then(function(res) { return res.json(); })
        .then(function(data) {
            if (data.fired && data.fired.length) {
                console.log(LOG_PREFIX, 'Alerts fired:', data.fired);
            }
        })
        .catch(function(err) {
            console.warn(LOG_PREFIX, 'Alert check failed (non-critical):', err.message || err);
        });
    }

    // =========================================================================
    // SETTINGS API
    // =========================================================================

    /**
     * Save ClickSend credentials and sender config.
     * Called from site-settings-panel.js alert settings section.
     */
    function saveSettings(settings) {
        return Promise.resolve({
            success: false,
            message: 'Global alert transport settings are not implemented in this Laravel build.',
            settings: settings || {},
        });
    }

    function getSettings() {
        return Promise.resolve({
            success: false,
            settings: {},
        });
    }

    /**
     * Send a test SMS or email to verify credentials.
     * @param {string} type  'sms' | 'email'
     * @param {string} value  Phone number or email address
     */
    function sendTest(type, value) {
        return apiFetch('/alerts/test', {
            method:  'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ type: type, value: value }),
        }).then(function(res) {
            if (!res.ok) return res.json().then(function(e) { throw new Error(e.message || 'Test failed'); });
            return res.json();
        });
    }

    // =========================================================================
    // SITE CONTACT CONFIG HELPERS
    // =========================================================================

    /**
     * Save alert contacts and quiet-hours preference to site config.
     * b35fix228: Replaced GAIP_SampleManager.updateSiteConfig (never existed)
     * with GilbaStorageNS site-scoped localStorage — same pattern as DSM.
     */
    function _alertStorageKey() { return 'alert_config'; }

    function _getStorageAdapter() {
        return global.GilbaStorageAdapter || global.StorageAdapter || null;
    }

    function saveSiteAlertConfig(siteId, contacts, quietHours) {
        var sa = _getStorageAdapter();
        if (!sa || typeof sa.setItem !== 'function') {
            console.warn(LOG_PREFIX, 'StorageAdapter not available — alert config not saved');
            return false;
        }
        try {
            sa.setItem(_alertStorageKey(), JSON.stringify({
                alertContacts:   contacts || [],
                alertQuietHours: !!quietHours,
            }), siteId);
            return true;
        } catch (e) {
            console.warn(LOG_PREFIX, 'Failed to save alert config:', e);
            return false;
        }
    }

    function getSiteAlertConfig(siteId) {
        var sa = _getStorageAdapter();
        if (!sa || typeof sa.getItem !== 'function') {
            return { contacts: [], quietHours: true };
        }
        try {
            var raw = sa.getItem(_alertStorageKey(), siteId);
            var config = raw ? JSON.parse(raw) : {};
            return {
                contacts:   config.alertContacts   || [],
                quietHours: config.alertQuietHours !== false,
            };
        } catch (e) {
            return { contacts: [], quietHours: true };
        }
    }

    // =========================================================================
    // EVENT WIRING
    // =========================================================================

    document.addEventListener('gaip:orchestrator-complete', function() {
        // Small delay to ensure all global result objects are written
        setTimeout(checkAlerts, 200);
    });

    // =========================================================================
    // EXPORT
    // =========================================================================

    global.GAIP_Alerts = {
        version:           VERSION,
        checkAlerts:       checkAlerts,
        saveSettings:      saveSettings,
        getSettings:       getSettings,
        sendTest:          sendTest,
        saveSiteAlertConfig: saveSiteAlertConfig,
        getSiteAlertConfig:  getSiteAlertConfig,
    };

    console.log(LOG_PREFIX, 'v' + VERSION + ' initialised');

}(typeof window !== 'undefined' ? window : this));
