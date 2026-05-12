/**
 * gilba-storage-migrate.js  v1.0.0
 *
 * One-time migration: copies all bare localStorage keys written by pre-b35fix91
 * builds into the namespaced equivalents expected by gilba-storage-ns.js.
 *
 * Runs once per plugin instance per browser. Sets a versioned migration flag
 * under the namespaced key so it never fires again.
 *
 * Dependency: gilba-storage-ns.js (must already have set GILBA_PLUGIN_NS)
 *
 * Safe to run repeatedly — each key is only copied if:
 *   (a) the bare key has data, AND
 *   (b) the namespaced key is empty (never overwrites existing namespaced data)
 */
(function (global) {
    'use strict';

    var MIGRATE_FLAG = 'gilba_storage_migrated_v1';

    // Keys that are static (same string on every install)
    var STATIC_KEYS = [
        'gilba_samples',
        'gilba_hub_site_configs',
        'gilba_turf_profiles',
        'gilba_turf_profiles_last',
        'gilba_hub_deleted_profiles',
        'gilba_soil_temp_log',
        'gilba_soil_temp_log_migrated_v1',
        'gilba_sensor_mappings',
        'gilba_wizard_complete',
        'gilba_export_include_scenario',
        'gaip_turf_profiles',
        'gaip_selected_logo_id',
        'gaip-active-tab'
    ];

    // Weather cache keys are dynamic: gaip_weather_cache_{locationKey}
    // We'll sweep localStorage for those at runtime.
    var DYNAMIC_PREFIXES = [
        'gaip_weather_cache_'
    ];

    // gilba_hub_samples is userId-scoped: gilba_hub_samples or gilba_hub_samples_{userId}
    var SAMPLES_BASE = 'gilba_hub_samples';

    function run() {
        if (typeof localStorage === 'undefined') return;

        var _ls = (global.GilbaStorageNS && global.GilbaStorageNS.get)
            ? global.GilbaStorageNS.get()
            : null;

        if (!_ls) {
            console.warn('[GilbaMigrate] GilbaStorageNS not available, skipping migration.');
            return;
        }

        // Already migrated for this NS?
        try {
            if (_ls.getItem(MIGRATE_FLAG)) return;
        } catch (e) { return; }

        var ns    = global.GILBA_PLUGIN_NS || '';
        var prefix = ns ? 'gilba_' + ns + '_' : '';

        if (!prefix) {
            // No namespace set — nothing to migrate, bare keys are still correct.
            return;
        }

        var migrated = 0;
        var skipped  = 0;

        function migrateKey(bareKey) {
            try {
                var bareVal = localStorage.getItem(bareKey);
                if (bareVal === null) { skipped++; return; }

                var nsKey = prefix + bareKey;
                // Never overwrite existing namespaced data
                if (localStorage.getItem(nsKey) !== null) { skipped++; return; }

                localStorage.setItem(nsKey, bareVal);
                migrated++;
            } catch (e) {
                console.warn('[GilbaMigrate] Could not migrate key "' + bareKey + '":', e.message);
            }
        }

        // 1. Static keys
        for (var i = 0; i < STATIC_KEYS.length; i++) {
            migrateKey(STATIC_KEYS[i]);
        }

        // 2. userId-scoped sample keys: gilba_hub_samples and gilba_hub_samples_{n}
        migrateKey(SAMPLES_BASE);
        try {
            for (var j = 0; j < localStorage.length; j++) {
                var k = localStorage.key(j);
                if (k && k !== SAMPLES_BASE && k.indexOf(SAMPLES_BASE + '_') === 0) {
                    migrateKey(k);
                }
            }
        } catch (e) {}

        // 3. Dynamic-prefix keys (weather cache, etc.)
        try {
            var allKeys = [];
            for (var m = 0; m < localStorage.length; m++) {
                allKeys.push(localStorage.key(m));
            }
            for (var n = 0; n < allKeys.length; n++) {
                var key = allKeys[n];
                if (!key) continue;
                for (var p = 0; p < DYNAMIC_PREFIXES.length; p++) {
                    if (key.indexOf(DYNAMIC_PREFIXES[p]) === 0) {
                        migrateKey(key);
                        break;
                    }
                }
            }
        } catch (e) {}

        // 4. Mark done
        try {
            _ls.setItem(MIGRATE_FLAG, '1');
        } catch (e) {}

        if (migrated > 0) {
            console.log('[GilbaMigrate] NS="' + ns + '": migrated ' + migrated + ' key(s), skipped ' + skipped + '.');
        }
    }

    // Run immediately — gilba-storage-ns is already loaded as a dependency.
    try { run(); } catch (e) {
        console.warn('[GilbaMigrate] Unexpected error:', e.message);
    }

    // b35fix274: v2 migration — covers keys newly brought under GilbaStorageNS
    // in b35fix272/274 that may already exist under bare keys in user browsers.
    // Separate flag so it runs even if v1 already ran.
    (function runV2() {
        if (typeof localStorage === 'undefined') return;
        var _ls2 = (global.GilbaStorageNS && global.GilbaStorageNS.get) ? global.GilbaStorageNS.get() : null;
        if (!_ls2) return;
        var FLAG_V2 = 'gilba_storage_migrated_v2';
        try { if (_ls2.getItem(FLAG_V2)) return; } catch(e) { return; }
        var ns = global.GILBA_PLUGIN_NS || '';
        var prefix = ns ? 'gilba_' + ns + '_' : '';
        if (!prefix) return;
        var V2_KEYS = [
            'gilba_hub_site_configs',
            'gilba_samples',
            'gilba_turf_profiles',
            'gilba_turf_profiles_last',
            'gilba_sensor_mappings',
            'gilba_disease_cache_purged_v1',
            'gaip_active_site'
        ];
        var migrated = 0;
        V2_KEYS.forEach(function(k) {
            try {
                var bare = localStorage.getItem(k);
                if (bare === null) return;
                var nsKey = prefix + k;
                if (localStorage.getItem(nsKey) !== null) return; // don't overwrite
                localStorage.setItem(nsKey, bare);
                migrated++;
            } catch(e) {}
        });
        // Also sweep gilba_last_pgr_* and gilba_disease_cache_* dynamic keys
        try {
            var allKeys = [];
            for (var i = 0; i < localStorage.length; i++) allKeys.push(localStorage.key(i));
            allKeys.forEach(function(k) {
                if (!k) return;
                var dynamic = ['gilba_last_pgr_', 'gilba_disease_cache_', 'gaip_hydrosight_cache_', 'gaip_sensor_data'];
                dynamic.forEach(function(pfx) {
                    if (k.indexOf(pfx) === 0 && k.indexOf(prefix) !== 0) {
                        try {
                            var bare = localStorage.getItem(k);
                            if (bare === null) return;
                            var nsKey = prefix + k;
                            if (localStorage.getItem(nsKey) !== null) return;
                            localStorage.setItem(nsKey, bare);
                            migrated++;
                        } catch(e) {}
                    }
                });
            });
        } catch(e) {}
        try { _ls2.setItem(FLAG_V2, '1'); } catch(e) {}
        if (migrated > 0) console.log('[GilbaMigrate] v2: migrated ' + migrated + ' key(s) to NS="' + ns + '"');
    })();

}(window));
