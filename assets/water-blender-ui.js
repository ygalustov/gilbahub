/**
 * ============================================================================
 * GILBA WATER BLENDER UI v1.0.0
 * ============================================================================
 * 
 * UI integration for multi-source water blending in the Gilba Hub.
 * Provides tabbed source entry, blend ratio sliders, and result integration.
 * 
 * DEPENDENCIES:
 * - water-blender.js (core computation)
 * - water-progressive-disclosure.js (result rendering)
 * 
 * ============================================================================
 */

(function(global) {
    'use strict';

    function createMiniQuery(globalObj) {
        var listenerRegistry = [];

        function camelCase(value) {
            return String(value || '').replace(/-([a-z])/g, function(_, char) {
                return char.toUpperCase();
            });
        }

        function normaliseElements(input, context) {
            if (!input) return [];
            if (input instanceof MiniQuery) return input.elements.slice();
            if (typeof input === 'string') {
                var trimmed = input.trim();
                if (trimmed.charAt(0) === '<') {
                    var template = document.createElement('template');
                    template.innerHTML = trimmed;
                    return Array.prototype.filter.call(template.content.childNodes, function(node) {
                        return node.nodeType === 1;
                    });
                }
                var root = context && context.nodeType ? context : document;
                return Array.from(root.querySelectorAll(trimmed));
            }
            if (input === globalObj || input === document || input === window) return [input];
            if (input.nodeType) return [input];
            if (Array.isArray(input)) return input.filter(Boolean);
            if (typeof input.length === 'number') return Array.from(input).filter(Boolean);
            return [];
        }

        function setStyle(el, name, value) {
            if (name.indexOf('-') !== -1) {
                el.style.setProperty(name, value);
            } else {
                el.style[name] = value;
            }
        }

        function getDataValue(el, key) {
            if (!el || !el.dataset) return undefined;
            var camelKey = camelCase(key);
            if (Object.prototype.hasOwnProperty.call(el.dataset, camelKey)) {
                return el.dataset[camelKey];
            }
            return el.getAttribute('data-' + key);
        }

        function MiniQuery(elements) {
            this.elements = elements || [];
            this.length = this.elements.length;
        }

        MiniQuery.prototype.each = function(callback) {
            this.elements.forEach(function(el, index) {
                callback.call(el, index, el);
            });
            return this;
        };

        MiniQuery.prototype.on = function(eventSpec, selector, handler) {
            if (typeof selector === 'function') {
                handler = selector;
                selector = null;
            }

            var parts = String(eventSpec || '').split('.');
            var eventType = parts[0];
            var namespace = parts[1] || '';

            this.elements.forEach(function(el) {
                var wrapped = function(event) {
                    if (!selector) {
                        handler.call(el, event);
                        return;
                    }
                    var target = event.target && event.target.closest ? event.target.closest(selector) : null;
                    if (!target) return;
                    if (el !== document && el !== window && el !== target && !el.contains(target)) return;
                    handler.call(target, event);
                };

                listenerRegistry.push({
                    element: el,
                    eventType: eventType,
                    namespace: namespace,
                    handler: handler,
                    selector: selector,
                    wrapped: wrapped
                });
                el.addEventListener(eventType, wrapped);
            });
            return this;
        };

        MiniQuery.prototype.off = function(eventSpec) {
            var parts = String(eventSpec || '').split('.');
            var eventType = parts[0] || '';
            var namespace = parts[1] || '';

            listenerRegistry = listenerRegistry.filter(function(entry) {
                var sameElement = this.elements.indexOf(entry.element) !== -1;
                var sameType = !eventType || entry.eventType === eventType;
                var sameNamespace = !namespace || entry.namespace === namespace;
                if (sameElement && sameType && sameNamespace) {
                    entry.element.removeEventListener(entry.eventType, entry.wrapped);
                    return false;
                }
                return true;
            }, this);

            return this;
        };

        MiniQuery.prototype.ready = function(callback) {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', callback, { once: true });
            } else {
                callback();
            }
            return this;
        };

        MiniQuery.prototype.is = function(selector) {
            var el = this.elements[0];
            if (!el) return false;
            if (selector === ':checked') return !!el.checked;
            return el.matches(selector);
        };

        MiniQuery.prototype.toggle = function(force) {
            return this.each(function() {
                var shouldShow = typeof force === 'boolean' ? force : this.style.display === 'none';
                this.style.display = shouldShow ? '' : 'none';
            });
        };

        MiniQuery.prototype.show = function() {
            return this.each(function() {
                this.style.display = '';
            });
        };

        MiniQuery.prototype.hide = function() {
            return this.each(function() {
                this.style.display = 'none';
            });
        };

        MiniQuery.prototype.css = function(name, value) {
            if (typeof name === 'string' && typeof value === 'undefined') {
                var el = this.elements[0];
                if (!el) return undefined;
                return globalObj.getComputedStyle(el).getPropertyValue(name) || el.style[name];
            }

            return this.each(function() {
                if (typeof name === 'string') {
                    setStyle(this, name, value);
                    return;
                }
                Object.keys(name || {}).forEach(function(key) {
                    setStyle(this, key, name[key]);
                }, this);
            });
        };

        MiniQuery.prototype.removeClass = function(className) {
            return this.each(function() {
                this.classList.remove(className);
            });
        };

        MiniQuery.prototype.addClass = function(className) {
            return this.each(function() {
                this.classList.add(className);
            });
        };

        MiniQuery.prototype.hasClass = function(className) {
            var el = this.elements[0];
            return !!(el && el.classList.contains(className));
        };

        MiniQuery.prototype.text = function(value) {
            if (typeof value === 'undefined') {
                return this.elements[0] ? this.elements[0].textContent : '';
            }
            return this.each(function() {
                this.textContent = value;
            });
        };

        MiniQuery.prototype.val = function(value) {
            if (typeof value === 'undefined') {
                return this.elements[0] ? this.elements[0].value : undefined;
            }
            return this.each(function() {
                this.value = value;
            });
        };

        MiniQuery.prototype.html = function(value) {
            if (typeof value === 'undefined') {
                return this.elements[0] ? this.elements[0].innerHTML : '';
            }
            return this.each(function() {
                this.innerHTML = value;
            });
        };

        MiniQuery.prototype.data = function(key) {
            return getDataValue(this.elements[0], key);
        };

        MiniQuery.prototype.attr = function(name, value) {
            if (typeof value === 'undefined') {
                return this.elements[0] ? this.elements[0].getAttribute(name) : undefined;
            }
            return this.each(function() {
                this.setAttribute(name, value);
            });
        };

        MiniQuery.prototype.closest = function(selector) {
            var matches = this.elements.map(function(el) {
                return el.closest ? el.closest(selector) : null;
            }).filter(Boolean);
            return new MiniQuery(matches);
        };

        MiniQuery.prototype.find = function(selector) {
            var matches = [];
            this.each(function() {
                matches = matches.concat(Array.from(this.querySelectorAll(selector)));
            });
            return new MiniQuery(matches);
        };

        MiniQuery.prototype.insertAfter = function(target) {
            var targets = normaliseElements(target);
            if (!targets.length) return this;
            var currentTarget = targets[targets.length - 1];
            this.elements.forEach(function(el) {
                currentTarget.parentNode.insertBefore(el, currentTarget.nextSibling);
                currentTarget = el;
            });
            return this;
        };

        MiniQuery.prototype.trigger = function(eventType, extraArgs) {
            return this.each(function() {
                var event;
                if (extraArgs) {
                    event = new CustomEvent(eventType, { bubbles: true, detail: extraArgs });
                } else {
                    event = new Event(eventType, { bubbles: true });
                }
                this.dispatchEvent(event);
            });
        };

        function $(input) {
            return new MiniQuery(normaliseElements(input));
        }

        $.fn = MiniQuery.prototype;
        return $;
    }

    var $ = global.jQuery || createMiniQuery(global);

    // ========================================================================
    // CONFIGURATION
    // ========================================================================

    var UI_CONFIG = {
        maxSources: 3,
        defaultSourceCount: 1,
        ionFields: ['Ca', 'Mg', 'Na', 'K', 'Cl', 'SO4', 'HCO3', 'CO3', 'B', 'Fe', 'NO3', 'PO4'],
        ionLabels: {
            Ca: 'Calcium',
            Mg: 'Magnesium',
            Na: 'Sodium',
            K: 'Potassium',
            Cl: 'Chloride',
            SO4: 'Sulphate',
            HCO3: 'Bicarbonate',
            CO3: 'Carbonate',
            B: 'Boron',
            Fe: 'Iron',
            NO3: 'Nitrate',
            PO4: 'Phosphate'
        },
        sourceLabels: ['Primary Source', 'Secondary Source', 'Tertiary Source'],
        sourceColors: ['#2563eb', '#059669', '#d97706']
    };

    // ========================================================================
    // STATE
    // ========================================================================

    var blenderState = {
        sourceCount: 2,
        sources: [{}, {}, {}],
        fractions: [50, 50, 0],
        blendResult: null,
        enabled: false,
        sampleDate: null
    };

    // ========================================================================
    // UI GENERATION
    // ========================================================================

    /**
     * Generate the blender toggle and multi-source panel HTML
     */
    function generateBlenderUI() {
        var html = '';
        
        // Blender enable toggle
        html += '<div class="gaip-blender-toggle-section" style="margin: 16px 0; padding: 12px; background: var(--gaip-info-bg); border: 1px solid #bae6fd; border-radius: 8px;">';
        html += '<label style="display: flex; align-items: center; gap: 10px; cursor: pointer; font-weight: 600; color: #0369a1;">';
        html += '<input type="checkbox" class="gaip-enable-blender" style="width: 18px; height: 18px;">';
        html += '<span>Enable Multi-Source Blending</span>';
        html += '</label>';
        html += '<p style="margin: 8px 0 0 28px; font-size: 12px; color: var(--gaip-text);">Blend 2-3 water sources (bore, recycled, mains) and analyse combined chemistry.</p>';
        html += '</div>';
        
        // Blender panel (hidden by default)
        html += '<div class="gaip-blender-panel" style="display: none;">';
        
        // Sample date field
        html += '<div style="margin-bottom: 16px; display: flex; align-items: center; gap: 12px;">';
        html += '<label style="font-weight: 500;">Sample Date:</label>';
        html += '<input type="date" class="gaip-blend-date" style="padding: 6px 12px; border: 1px solid var(--gaip-border); border-radius: 6px;">';
        html += '</div>';
        
        // Source count selector
        html += '<div class="gaip-source-count-row" style="margin-bottom: 16px; display: flex; align-items: center; gap: 12px;">';
        html += '<label style="font-weight: 500;">Number of sources:</label>';
        html += '<select class="gaip-source-count" style="padding: 6px 12px; border: 1px solid var(--gaip-border); border-radius: 6px;">';
        html += '<option value="2" selected>2 sources</option>';
        html += '<option value="3">3 sources</option>';
        html += '</select>';
        html += '</div>';
        
        // Blend ratio sliders
        html += '<div class="gaip-blend-ratios" style="margin-bottom: 20px; padding: 16px; background: var(--gaip-surface-muted); border-radius: 8px;">';
        html += '<h5 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600;">Blend Ratios</h5>';
        html += '<div class="gaip-ratio-sliders">';
        
        for (var i = 0; i < UI_CONFIG.maxSources; i++) {
            var display = i < 2 ? 'flex' : 'none';
            var defaultVal = i === 0 ? 50 : (i === 1 ? 50 : 0);
            
            html += '<div class="gaip-ratio-row" data-source="' + i + '" style="display: ' + display + '; align-items: center; gap: 12px; margin-bottom: 10px;">';
            html += '<span style="min-width: 100px; font-size: 13px; color: ' + UI_CONFIG.sourceColors[i] + '; font-weight: 500;">' + UI_CONFIG.sourceLabels[i] + '</span>';
            html += '<input type="range" class="gaip-ratio-slider" data-source="' + i + '" min="0" max="100" value="' + defaultVal + '" style="flex: 1;">';
            html += '<span class="gaip-ratio-value" style="min-width: 45px; text-align: right; font-weight: 600;">' + defaultVal + '%</span>';
            html += '</div>';
        }
        
        html += '</div>';
        html += '<p class="gaip-ratio-total" style="margin: 8px 0 0 0; font-size: 12px; color: var(--gaip-text);">Total: <strong>100%</strong> <span class="gaip-ratio-warning" style="color: #dc2626; display: none;">(will be normalized)</span></p>';
        html += '</div>';
        
        // Source tabs
        html += '<div class="gaip-source-tabs" style="display: flex; gap: 4px; margin-bottom: 0;">';
        for (var j = 0; j < UI_CONFIG.maxSources; j++) {
            var active = j === 0 ? ' gaip-tab-active' : '';
            var tabDisplay = j < 2 ? 'inline-block' : 'none';
            html += '<button type="button" class="gaip-source-tab' + active + '" data-source="' + j + '" style="display: ' + tabDisplay + '; padding: 8px 16px; border: 1px solid var(--gaip-border); border-bottom: none; border-radius: 8px 8px 0 0; background: ' + (j === 0 ? 'var(--gaip-surface)' : 'var(--gaip-surface-hover)') + '; font-weight: 500; cursor: pointer; color: ' + UI_CONFIG.sourceColors[j] + ';">';
            html += UI_CONFIG.sourceLabels[j];
            html += '</button>';
        }
        html += '</div>';
        
        // Source panels
        html += '<div class="gaip-source-panels" style="border: 1px solid var(--gaip-border); border-radius: 0 8px 8px 8px; padding: 16px;">';
        
        for (var k = 0; k < UI_CONFIG.maxSources; k++) {
            var panelDisplay = k === 0 ? 'block' : 'none';
            html += '<div class="gaip-source-panel" data-source="' + k + '" style="display: ' + panelDisplay + ';">';
            html += generateSourceInputs(k);
            html += '</div>';
        }
        
        html += '</div>';
        
        // Calculate button
        html += '<div style="margin-top: 16px; text-align: center;">';
        html += '<button type="button" class="gaip-calculate-blend" style="padding: 10px 24px; background: #2563eb; color: var(--gaip-surface); border: none; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 14px;">';
        html += '⚗️ Calculate Blended Water Quality';
        html += '</button>';
        html += '</div>';
        
        html += '</div>'; // end blender panel
        
        return html;
    }

    /**
     * Generate input fields for a single source
     */
    function generateSourceInputs(sourceIndex) {
        var prefix = 'gaip-source-' + sourceIndex + '-';
        
        var html = '';
        
        // Source label input
        html += '<div style="margin-bottom: 12px;">';
        html += '<label style="font-size: 12px; color: var(--gaip-text);">Source Name (optional)</label>';
        html += '<input type="text" class="' + prefix + 'label" placeholder="e.g. Bore 1, Recycled, Mains" style="width: 100%; padding: 8px; border: 1px solid var(--gaip-border); border-radius: 6px; margin-top: 4px;">';
        html += '</div>';
        
        // EC and pH row - use text inputs for cleaner look
        html += '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">';
        html += '<div>';
        html += '<label style="font-size: 12px; color: var(--gaip-text);">EC (dS/m)</label>';
        html += '<input type="text" inputmode="decimal" pattern="[0-9]*\\.?[0-9]*" class="' + prefix + 'ec" placeholder="e.g. 1.2" style="width: 100%; padding: 8px; border: 1px solid var(--gaip-border); border-radius: 6px; margin-top: 4px;">';
        html += '</div>';
        html += '<div>';
        html += '<label style="font-size: 12px; color: var(--gaip-text);">pH</label>';
        html += '<input type="text" inputmode="decimal" pattern="[0-9]*\\.?[0-9]*" class="' + prefix + 'ph" placeholder="e.g. 7.5" style="width: 100%; padding: 8px; border: 1px solid var(--gaip-border); border-radius: 6px; margin-top: 4px;">';
        html += '</div>';
        html += '</div>';
        
        // Ion grid - 4 columns, compact layout (5 chars max)
        html += '<div style="margin-top: 12px;">';
        html += '<label style="font-size: 12px; color: var(--gaip-text); font-weight: 500; display: block; margin-bottom: 6px;">Ion Concentrations (mg/L)</label>';
        html += '<div class="gaip-blender-ion-grid" style="display: grid; grid-template-columns: repeat(4, 45px); gap: 4px 6px; justify-content: start;">';
        
        for (var i = 0; i < UI_CONFIG.ionFields.length; i++) {
            var ion = UI_CONFIG.ionFields[i];
            html += '<div style="text-align: center;">';
            html += '<label style="font-size: 10px; color: var(--gaip-text); font-weight: 600; display: block; margin-bottom: 2px;">' + ion + '</label>';
            html += '<input type="text" inputmode="decimal" maxlength="5" size="5" class="' + prefix + ion.toLowerCase() + '" data-ion="' + ion + '" style="width: 45px; padding: 3px 1px; border: 1px solid var(--gaip-border); border-radius: 3px; font-size: 11px; text-align: center;">';
            html += '</div>';
        }
        
        html += '</div>';
        html += '</div>';
        
        // Copy from main water inputs button — on all source tabs (b35fix139)
        html += '<div style="margin-top: 12px;">';
        html += '<button type="button" class="gaip-copy-from-main" data-source-idx="' + sourceIndex + '" style="padding: 6px 12px; background: var(--gaip-surface-hover); border: 1px solid var(--gaip-border); border-radius: 6px; font-size: 12px; cursor: pointer;">';
        html += '📋 Copy current water form values into this source';
        html += '</button>';
        html += '</div>';
        
        return html;
    }

    // ========================================================================
    // EVENT HANDLERS
    // ========================================================================

    function initEventHandlers() {
        // Use document for delegation - more reliable for dynamically injected content
        
        // Enable/disable blender
        $(document).on('change', '.gaip-enable-blender', function() {
            blenderState.enabled = $(this).is(':checked');
            $('.gaip-blender-panel').toggle(blenderState.enabled);
            
            if (!blenderState.enabled) {
                // Clear blend result, revert to single-source analysis
                blenderState.blendResult = null;
                triggerWaterAnalysis();
            }
        });
        
        // Sample date change
        $(document).on('change', '.gaip-blend-date', function() {
            blenderState.sampleDate = $(this).val();
        });
        
        // Source count change
        $(document).on('change', '.gaip-source-count', function(e) {
            e.stopPropagation();
            var count = parseInt($(this).val(), 10);
            blenderState.sourceCount = count;
            
            // Show/hide tabs and ratio rows
            for (var i = 0; i < UI_CONFIG.maxSources; i++) {
                var $tab = $('.gaip-source-tab[data-source="' + i + '"]');
                var $ratioRow = $('.gaip-ratio-row[data-source="' + i + '"]');
                
                if (i < count) {
                    $tab.show();
                    $ratioRow.css('display', 'flex');
                } else {
                    $tab.hide();
                    $ratioRow.hide();
                }
            }
            
            // Reset fractions to equal
            var equalFraction = Math.round(100 / count);
            for (var j = 0; j < UI_CONFIG.maxSources; j++) {
                var frac = j < count ? equalFraction : 0;
                if (j === count - 1) {
                    // Last source gets remainder to ensure 100%
                    frac = 100 - (equalFraction * (count - 1));
                }
                blenderState.fractions[j] = frac;
                $('.gaip-ratio-slider[data-source="' + j + '"]').val(frac);
                $('.gaip-ratio-row[data-source="' + j + '"] .gaip-ratio-value').text(frac + '%');
            }
            
            updateRatioTotal();
        });
        
        // Tab switching - using namespaced event and direct binding
        $(document).off('click.blendertab').on('click.blendertab', '.gaip-source-tab', function(e) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            
            var $btn = $(this);
            var sourceIdx = parseInt($btn.attr('data-source'), 10);
            
            
            // Remove active from all tabs
            $('.gaip-source-tab').each(function() {
                $(this).removeClass('gaip-tab-active');
                $(this).css('background', 'var(--gaip-surface-hover)');
            });
            
            // Add active to clicked tab
            $btn.addClass('gaip-tab-active');
            $btn.css('background', 'var(--gaip-surface)');
            
            // Hide all panels
            $('.gaip-source-panel').each(function() {
                $(this).hide();
            });
            
            // Show selected panel
            var $targetPanel = $('.gaip-source-panel[data-source="' + sourceIdx + '"]');
            $targetPanel.show();
            
            return false;
        });
        
        // Also add direct onclick to tabs after injection (backup method)
        setTimeout(function() {
            $('.gaip-source-tab').each(function() {
                var btn = this;
                btn.onclick = function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    var idx = parseInt($(btn).attr('data-source'), 10);
                    
                    $('.gaip-source-tab').removeClass('gaip-tab-active').css('background', 'var(--gaip-surface-hover)');
                    $(btn).addClass('gaip-tab-active').css('background', 'var(--gaip-surface)');
                    $('.gaip-source-panel').hide();
                    $('.gaip-source-panel[data-source="' + idx + '"]').show();
                    return false;
                };
            });
        }, 600);
        
        // Ratio slider change
        $(document).on('input', '.gaip-ratio-slider', function() {
            var sourceIdx = $(this).data('source');
            var value = parseInt($(this).val());
            
            blenderState.fractions[sourceIdx] = value;
            $(this).closest('.gaip-ratio-row').find('.gaip-ratio-value').text(value + '%');
            
            updateRatioTotal();
        });
        
        // Copy from main water inputs — copy to the source this button belongs to
        $(document).on('click', '.gaip-copy-from-main', function(e) {
            e.preventDefault();
            e.stopPropagation();
            var idx = parseInt($(this).data('source-idx')) || 0;
            copyFromMainWaterInputs(idx);
        });
        
        // Calculate blend
        $(document).on('click', '.gaip-calculate-blend', function(e) {
            e.preventDefault();
            e.stopPropagation();
            calculateAndDisplayBlend();
        });
        
        // Expand/collapse buttons - UNIVERSAL handler for ALL expand buttons on page
        // This handles: Water blender results, Water analysis "Why?" buttons, Priority actions, MLSN sections, etc.
        $(document).off('click.expandHandler').on('click.expandHandler', '.gaip-expand-btn', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            var $btn = $(this);
            var targetId = $btn.attr('data-target');
            
            
            if (!targetId) {
                console.warn('No data-target on expand button');
                return false;
            }
            
            var $target = $('#' + targetId);
            
            if ($target.length === 0) {
                // Try finding collapsible relative to button (fallback for dynamic IDs)
                var $container = $btn.closest('.gaip-mlsn-ratios-section, .gaip-mlsn-context-section, .gaip-diagnostic-card, .gaip-water-diagnostic-card');
                if ($container.length) {
                    $target = $container.find('.gaip-collapsible-content, .gaip-why-section, .gaip-sensitivity-section').first();
                }
                
                if ($target.length === 0) {
                    console.warn('Target element not found:', targetId);
                    return false;
                }
            }
            
            var $icon = $btn.find('.gaip-icon');
            
            // Check if currently expanded: has gaip-expanded class OR does NOT have gaip-collapsed class
            var hasExpandedClass = $target.hasClass('gaip-expanded');
            var hasCollapsedClass = $target.hasClass('gaip-collapsed');
            var isExpanded = hasExpandedClass || (!hasCollapsedClass && $target.css('max-height') !== '0px');
            
            
            if (isExpanded) {
                // Collapse: add collapsed, remove expanded
                $target.addClass('gaip-collapsed').removeClass('gaip-expanded');
                $target.css({
                    'max-height': '0',
                    'opacity': '0',
                    'overflow': 'hidden'
                });
                if ($icon.length) $icon.text('▼');
            } else {
                // Expand: remove collapsed, add expanded, set max-height for animation
                $target.removeClass('gaip-collapsed').addClass('gaip-expanded');
                $target.css({
                    'max-height': $target[0].scrollHeight + 'px',
                    'opacity': '1',
                    'overflow': 'visible'
                });
                if ($icon.length) $icon.text('▲');
            }
            
            return false;
        });
    }

    function updateRatioTotal() {
        var total = 0;
        for (var i = 0; i < blenderState.sourceCount; i++) {
            total += blenderState.fractions[i];
        }
        
        $('.gaip-ratio-total strong').text(total + '%');
        $('.gaip-ratio-warning').toggle(total !== 100);
    }

    /**
     * Copy values from main Hub water inputs to a source panel
     */
    function copyFromMainWaterInputs(sourceIdx) {
        var prefix = '.gaip-source-' + sourceIdx + '-';
        
        // EC
        var ec = parseFloat($('.gaip-ecw').val()) || 0;
        $(prefix + 'ec').val(ec || '');
        
        // pH
        var ph = parseFloat($('.gaip-water-ph').val()) || 0;
        $(prefix + 'ph').val(ph || '');
        
        // Ions
        $('.gaip-water-grid input[data-ion]').each(function() {
            var ion = $(this).data('ion');
            var value = parseFloat($(this).val()) || 0;
            $(prefix + ion.toLowerCase()).val(value || '');
        });
    }

    /**
     * Collect source data from UI inputs
     */
    function collectSourceData() {
        var sources = [];
        
        
        for (var i = 0; i < blenderState.sourceCount; i++) {
            var prefix = '.gaip-source-' + i + '-';
            
            // Debug: check if elements exist
            var $labelInput = $(prefix + 'label');
            var $ecInput = $(prefix + 'ec');
            var $phInput = $(prefix + 'ph');

            var source = {
                label: $labelInput.val() || UI_CONFIG.sourceLabels[i],
                fraction: blenderState.fractions[i],
                EC_dSm: parseFloat($ecInput.val()) || 0,
                pH: parseFloat($phInput.val()) || 7
            };
            
            // Collect ions
            for (var j = 0; j < UI_CONFIG.ionFields.length; j++) {
                var ion = UI_CONFIG.ionFields[j];
                var $ionInput = $(prefix + ion.toLowerCase());
                source[ion] = parseFloat($ionInput.val()) || 0;
            }
            
            sources.push(source);
        }
        
        // Add sample date
        if (blenderState.sampleDate) {
            sources.sampleDate = blenderState.sampleDate;
        }
        
        return sources;
    }

    // ========================================================================
    // BLEND CALCULATION & DISPLAY
    // ========================================================================

    function calculateAndDisplayBlend() {
        if (typeof GAIP_WaterBlender === 'undefined') {
            console.error('Water Blender engine not loaded');
            return;
        }
        
        var sources = collectSourceData();
        
        // Validate: need at least some data
        var hasData = sources.some(function(s) {
            return s.EC_dSm > 0 || s.Ca > 0 || s.Na > 0;
        });
        
        if (!hasData) {
            alert('Please enter water quality data for at least one source.');
            return;
        }
        
        // Calculate blend
        var fractions = blenderState.fractions.slice(0, blenderState.sourceCount);
        var result = GAIP_WaterBlender.computeBlend(sources, fractions);
        
        if (result.error) {
            alert('Blend calculation error: ' + result.error);
            return;
        }
        
        blenderState.blendResult = result;
        blenderState.sources = sources;
        
        // Render results
        displayBlendResults(result, sources);
        
        // Update Hub state with blended water
        updateHubStateWithBlend(result);
        
        // Trigger downstream analysis
        triggerWaterAnalysis();
    }

    function displayBlendResults(result, sources) {
        var $waterBody = $('.gaip-water-body');
        
        if ($waterBody.length === 0) {
            console.warn('Water result container not found');
            return;
        }
        
        var html = '';
        
        // Build source summary
        var sourceNames = sources.map(function(s, i) {
            return s.label + ' (' + s.fraction + '%)';
        }).join(' + ');
        
        // Date if available
        var dateStr = blenderState.sampleDate ? ', ' + blenderState.sampleDate : '';
        
        // Blended water header
        html += '<div style="margin-bottom: 12px; padding: 10px 14px; background: var(--gaip-info-bg); border-radius: 6px;">';
        html += '<div style="display: flex; align-items: center; gap: 8px;">';
        html += '<span style="font-size: 18px;">⚗️</span>';
        html += '<span style="font-weight: 600; color: #1e40af;">Analysing Blended Water (' + sources.length + ' sources)</span>';
        html += '</div>';
        html += '<div style="margin-top: 6px; font-size: 12px; color: #1e40af;">' + sourceNames + dateStr + '</div>';
        html += '</div>';
        
        // Render blend-specific results
        html += GAIP_WaterBlender.renderBlenderResults(result, sources);
        
        // CCPI — add to result display (b35fix139)
        if (result.ccpi !== undefined && result.ccpiClassification) {
            var ccpiClass = result.ccpiClassification;
            html += '<div class="gaip-guidance ' + ccpiClass.class + '" style="margin-top:8px;padding:10px 14px;border-radius:8px;font-size:13px;">' +
                '<strong>CCPI ' + (parseFloat(result.ccpi) || 0).toFixed(2) + ', ' + ccpiClass.label + ':</strong> ' + ccpiClass.desc +
                '</div>';
        }

        // Brute-force optimiser (b35fix139) — replaces text-only suggestions
        if (sources.length >= 2 && typeof GAIP_WaterBlender.findOptimalBlend === 'function') {
            var optResult = GAIP_WaterBlender.findOptimalBlend(sources);
            html += GAIP_WaterBlender.renderOptimiserResult(optResult, sources);
        } else {
            // Fallback to legacy text suggestions
            html += GAIP_WaterBlender.renderOptimisationSuggestions(sources, result);
        }
        
        // Now render standard water analysis using blended values
        var hubWaterState = GAIP_WaterBlender.toHubWaterState(result);
        
        if (typeof renderWaterProgressiveDisclosure === 'function' && hubWaterState) {
            var state = window.__GAIP_STATE__ || {};
            state.water = hubWaterState;
            
            html += '<div style="margin-top: 20px; padding-top: 16px; border-top: 2px solid var(--gaip-border);">';
            html += '<h5 style="margin: 0 0 12px 0; font-size: 14px; color: var(--gaip-text);">Standard Water Analysis (using blended values)</h5>';
            html += renderWaterProgressiveDisclosure(null, state);
            html += '</div>';
        }
        
        $waterBody.html(html);
        
        // Re-init expand buttons
        initExpandButtons();
    }

    /**
     * Update the Hub's global state with blended water chemistry
     */
    function updateHubStateWithBlend(result) {
        if (!result || result.error) return;
        
        var hubWater = GAIP_WaterBlender.toHubWaterState(result);
        
        // Update global state if it exists
        if (typeof window.__GAIP_STATE__ !== 'undefined') {
            window.__GAIP_STATE__.water = hubWater;
        }
        
        // Also update the stored state for other modules
        if (typeof window.__GAIP_WATER_STATE__ !== 'undefined') {
            window.__GAIP_WATER_STATE__ = hubWater;
        }
        
        // Dispatch event for other modules
        $(document).trigger('gaip:water-updated', [hubWater]);
    }

    /**
     * Trigger water analysis (either blended or standard)
     */
    function triggerWaterAnalysis() {
        // Trigger the Hub's standard analysis update
        if (typeof window.updateAnalysis === 'function') {
            window.updateAnalysis();
        } else {
            // Fallback: trigger change on a water input to cause refresh
            $('.gaip-ecw').trigger('change');
        }
    }

    /**
     * Initialize expand/collapse buttons for progressive disclosure
     */
    function initExpandButtons() {
        $(document).off('click.blenderExpand').on('click.blenderExpand', '.gaip-water-blender-results .gaip-expand-btn', function() {
            var targetId = $(this).data('target');
            var $target = $('#' + targetId);
            
            if ($target.hasClass('gaip-collapsed')) {
                $target.removeClass('gaip-collapsed').addClass('gaip-expanded');
                $(this).find('.gaip-icon').text('▲');
            } else {
                $target.removeClass('gaip-expanded').addClass('gaip-collapsed');
                $(this).find('.gaip-icon').text('▼');
            }
        });
    }

    // ========================================================================
    // INITIALIZATION
    // ========================================================================

    function injectBlenderUI() {
        // Find the water grid (most reliable target)
        var $waterGrid = $('.gaip-water-grid');
        
        if ($waterGrid.length === 0) {
            console.warn('Water grid not found, cannot inject blender UI');
            return;
        }
        
        // Check if already injected
        if ($('.gaip-blender-toggle-section').length > 0) {
            return;
        }
        
        // Insert after the water grid
        $(generateBlenderUI()).insertAfter($waterGrid);
    }

    /**
     * Main initialization
     */
    function init() {
        // Wait for DOM and Hub to be ready
        $(document).ready(function() {
            
            // Small delay to ensure Hub is fully rendered
            setTimeout(function() {
                
                injectBlenderUI();
                initEventHandlers();
                
            }, 500);
        });
    }

    // Auto-initialize
    init();

    // Export for manual initialization if needed
    window.GAIP_WaterBlenderUI = {
        init: init,
        injectBlenderUI: injectBlenderUI,
        calculateAndDisplayBlend: calculateAndDisplayBlend,
        collectSourceData: collectSourceData,
        getState: function() { return blenderState; }
    };

})(window);
