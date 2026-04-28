/**
 * gilba-storage-ns.js  v1.0.0
 *
 * Namespace shim for localStorage keys.
 * Reads window.GILBA_PLUGIN_NS (set via wp_add_inline_script before this file)
 * and returns a localStorage-compatible object whose getItem/setItem/removeItem
 * transparently prefix every key with "gilba_{ns}_".
 *
 * Plugins that do NOT set GILBA_PLUGIN_NS get the bare key (legacy behaviour).
 *
 * Usage (in each module):
 *   var _ls = window.GilbaStorageNS.get();
 *   _ls.getItem('gilba_samples');   // reads "gilba_gaip_gilba_samples" or "gilba_samples"
 */
(function (global) {
    'use strict';

    function makeNamespacedStorage(ns) {
        var prefix = ns ? 'gilba_' + ns + '_' : '';

        return {
            getItem: function (key) {
                try { return localStorage.getItem(prefix + key); } catch (e) { return null; }
            },
            setItem: function (key, value) {
                try { localStorage.setItem(prefix + key, value); } catch (e) {}
            },
            removeItem: function (key) {
                try { localStorage.removeItem(prefix + key); } catch (e) {}
            },
            key: function (index) {
                try { return localStorage.key(index); } catch (e) { return null; }
            },
            clear: function () {
                try { localStorage.clear(); } catch (e) {}
            },
            get length() {
                try { return localStorage.length; } catch (e) { return 0; }
            }
        };
    }

    var _instance = null;

    global.GilbaStorageNS = {
        /**
         * Returns the singleton namespaced storage instance.
         * Lazily created on first call so that GILBA_PLUGIN_NS is already set.
         */
        get: function () {
            if (!_instance) {
                var ns = global.GILBA_PLUGIN_NS || '';
                _instance = makeNamespacedStorage(ns);
            }
            return _instance;
        },

        /** Reset singleton — used in tests only. */
        _reset: function () { _instance = null; }
    };

}(window));
