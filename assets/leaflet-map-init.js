/**
 * Leaflet Map Initialiser — GSSH Location Picker
 *
 * Initialises the Leaflet map used in the stadium shade hub location picker.
 * Requires leaflet-js to be loaded first (CDN via wp_enqueue_script).
 *
 * @version 1.0.0
 */
(function () {
    'use strict';

    var GSSH_MapInit = {

        map: null,
        marker: null,
        defaultLat: -25.0,
        defaultLng: 133.0,
        defaultZoom: 4,
        _pendingVenue: null,  // { lat, lng } set by UnifiedVenueSelector before map exists

        init: function () {
            var container = document.getElementById('gssh-location-map');
            if (!container) return;
            if (this.map) {
                // Already initialised — just invalidate size in case panel was hidden
                this.map.invalidateSize();
                return;
            }
            if (typeof L === 'undefined') {
                console.warn('[GSSH MapInit] Leaflet not loaded');
                return;
            }

            // If a venue was selected before this panel was open, use those coords.
            // Otherwise fall back to the PHP-rendered data attributes.
            var pendingLat = this._pendingVenue && this._pendingVenue.lat;
            var pendingLng = this._pendingVenue && this._pendingVenue.lng;

            var savedLat = pendingLat || parseFloat(container.dataset.lat) || this.defaultLat;
            var savedLng = pendingLng || parseFloat(container.dataset.lng) || this.defaultLng;
            var zoom     = (savedLat !== this.defaultLat) ? 16 : this.defaultZoom;

            // b35fix199: disable scroll-wheel zoom so the page scrolls normally
            // past the map. User can still zoom with +/- buttons or pinch-to-zoom.
            this.map = L.map('gssh-location-map', {
                scrollWheelZoom: false
            }).setView([savedLat, savedLng], zoom);

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
                maxZoom: 19,
            }).addTo(this.map);

            if (savedLat !== this.defaultLat) {
                this.marker = L.marker([savedLat, savedLng], { draggable: true }).addTo(this.map);
                this._bindMarkerEvents();
                // If we used pending venue coords, sync the hidden lat/lng inputs too
                if (pendingLat) {
                    this._updateInputs(savedLat, savedLng);
                    this._pendingVenue = null;
                }
            }

            this.map.on('click', this._onMapClick.bind(this));
        },

        _onMapClick: function (e) {
            var lat = e.latlng.lat;
            var lng = e.latlng.lng;
            if (this.marker) {
                this.marker.setLatLng([lat, lng]);
            } else {
                this.marker = L.marker([lat, lng], { draggable: true }).addTo(this.map);
                this._bindMarkerEvents();
            }
            this._updateInputs(lat, lng);
        },

        _bindMarkerEvents: function () {
            this.marker.on('dragend', function (e) {
                var pos = e.target.getLatLng();
                GSSH_MapInit._updateInputs(pos.lat, pos.lng);
            });
        },

        _updateInputs: function (lat, lng) {
            var latInput = document.getElementById('gssh-location-lat');
            var lngInput = document.getElementById('gssh-location-lng');
            if (latInput) latInput.value = lat.toFixed(6);
            if (lngInput) lngInput.value = lng.toFixed(6);
            document.dispatchEvent(new CustomEvent('gssh:location-selected', {
                detail: { lat: lat, lng: lng }
            }));
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            GSSH_MapInit.init();
        });
    } else {
        GSSH_MapInit.init();
    }

}());
