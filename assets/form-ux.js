/**
 * form-ux.js — v1.0.0
 * Collapsible section toggles for redesigned soil/water cards.
 */
(function() {
    'use strict';

    function initCollapsibles() {
        document.addEventListener('click', function(e) {
            var hdr = e.target.closest('.gaip-collapsible-header');
            if (!hdr) return;
            var targetId = hdr.getAttribute('data-target');
            var body = targetId ? document.getElementById(targetId) : hdr.nextElementSibling;
            if (!body) return;
            var isOpen = body.style.display !== 'none';
            body.style.display = isOpen ? 'none' : 'block';
            hdr.classList.toggle('open', !isOpen);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initCollapsibles);
    } else {
        initCollapsibles();
    }
})();
