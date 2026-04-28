/**
 * =============================================================================
 * GILBA SPRAY LOG — Recommendation Integration v1.0.0
 * =============================================================================
 * 
 * Post-render hook that injects "Log Application" buttons into:
 *   1. Disease cards — after the interventions section (moderate/high risk)
 *   2. PGR card — after the reapplication projection
 * 
 * Listens for analysis-complete and dashboard-updated events, then scans
 * the rendered DOM for recommendation cards and appends buttons.
 * 
 * DEPENDENCIES:
 *   - GAIP_SprayLogUI.createLogButton() — button factory
 *   - GAIP_SprayLog — REST client
 *   - Disease UI renders .gaip-disease-card elements
 *   - PGR UI renders .pgr-card elements
 * 
 * @author  Gilba Solutions
 * @version 1.0.0
 * =============================================================================
 */
(function(global) {
    'use strict';

    const VERSION = '1.0.0';
    const LOG_PREFIX = '[SprayLogIntegration]';
    function log(...args) { ; }

    // Track which cards already have buttons to avoid duplicates
    const _wiredCards = new WeakSet();

    // =========================================================================
    // DISEASE CARD INTEGRATION
    // =========================================================================

    /**
     * Scan disease cards and inject "Log Application" buttons.
     * Only adds buttons for moderate/high/critical risk diseases that have
     * intervention recommendations (i.e. fungicide suggestions).
     */
    function wireDiseaseCards() {
        // b35fix232: disease card log button removed — product identity unknown at log time.
        // Log fungicide applications via spray log tab (full entry form with product selection).
        return;

        if (!global.GAIP_SprayLogUI) return; // unreachable — kept for reference

        const cards = document.querySelectorAll('.gaip-disease-card');
        if (!cards.length) return;

        let wired = 0;
        cards.forEach(card => {
            if (_wiredCards.has(card)) return;

            // Check risk level — only moderate+ gets a log button
            const scoreEl = card.querySelector('.gaip-score-label');
            const riskLevel = scoreEl ? scoreEl.textContent.trim().toLowerCase() : '';
            if (riskLevel === 'low' || riskLevel === 'minimal' || riskLevel === 'none') return;

            // Must have detail section (expanded or collapsed)
            const detail = card.querySelector('.gaip-disease-detail');
            if (!detail) return;

            // Extract disease name and data
            const diseaseName = card.getAttribute('data-disease') || '';
            const displayNameEl = card.querySelector('.gaip-disease-name');
            const displayName = displayNameEl ? displayNameEl.textContent.trim().replace(/[▼▶]\s*/, '') : diseaseName;

            // Try to extract product info from intervention text or fungicide filter
            const interventions = card.querySelector('.gaip-interventions');
            const interventionText = interventions ? interventions.textContent : '';
            const productInfo = extractProductFromInterventions(interventionText, diseaseName);

            // Create the log button
            const btn = global.GAIP_SprayLogUI.createLogButton({
                module: 'disease',
                productName: productInfo.productName || 'Fungicide application',
                productKey: productInfo.productKey || null,
                activeIngredient: productInfo.activeIngredient || null,
                fracGroup: productInfo.fracGroup || null,
                rate: productInfo.rate || null,
                rateUnit: 'L/ha',
                target: formatDiseaseName(diseaseName),
                zone: getCurrentZone()
            });

            // Insert at the bottom of the detail section (before the source line if it exists)
            const sourceEl = detail.querySelector('.gaip-source');
            if (sourceEl) {
                sourceEl.parentNode.insertBefore(btn, sourceEl);
            } else {
                detail.appendChild(btn);
            }
            
            _wiredCards.add(card);
            wired++;
        });

        if (wired > 0) log(`Wired ${wired} disease card(s) with Log buttons`);
    }

    /**
     * Attempt to extract the primary product recommendation from intervention text.
     * Falls back to generic "Fungicide application" if parsing fails.
     */
    function extractProductFromInterventions(text, diseaseName) {
        const result = {
            productName: null,
            productKey: null,
            activeIngredient: null,
            fracGroup: null,
            rate: null
        };

        // Try to match common active ingredients mentioned in interventions
        const activeIngredients = [
            { name: 'azoxystrobin', frac: '11', products: ['Heritage Maxx', 'Heritage'] },
            { name: 'propiconazole', frac: '3', products: ['Banner Maxx', 'Tilt'] },
            { name: 'chlorothalonil', frac: 'M5', products: ['Daconil', 'Bravo'] },
            { name: 'iprodione', frac: '2', products: ['Rovral', 'Chipco'] },
            { name: 'fludioxonil', frac: '12', products: ['Medallion', 'Maxim'] },
            { name: 'trifloxystrobin', frac: '11', products: ['Flint', 'Compass'] },
            { name: 'penthiopyrad', frac: '7', products: ['Velista'] },
            { name: 'fluopyram', frac: '7', products: ['Indemnify'] },
            { name: 'boscalid', frac: '7', products: ['Emerald'] },
            { name: 'myclobutanil', frac: '3', products: ['Eagle', 'Validus'] },
            { name: 'tebuconazole', frac: '3', products: ['Folicur'] },
            { name: 'triticonazole', frac: '3', products: ['Trinity'] },
            { name: 'mancozeb', frac: 'M3', products: ['Mancozeb', 'Dithane'] },
            { name: 'metalaxyl', frac: '4', products: ['Subdue'] },
            { name: 'fosetyl-al', frac: '33', products: ['Aliette'] },
            { name: 'phosphonate', frac: '33', products: ['Phosphonate'] }
        ];

        const textLower = text.toLowerCase();
        for (const ai of activeIngredients) {
            if (textLower.includes(ai.name)) {
                result.activeIngredient = ai.name;
                result.fracGroup = ai.frac;
                result.productName = ai.products[0];
                result.productKey = ai.name;
                break;
            }
            // Also check trade names
            for (const trade of ai.products) {
                if (textLower.includes(trade.toLowerCase())) {
                    result.activeIngredient = ai.name;
                    result.fracGroup = ai.frac;
                    result.productName = trade;
                    result.productKey = ai.name;
                    break;
                }
            }
            if (result.productName) break;
        }

        // Also try the fungicide filter if available
        if (!result.productName && global.GAIP_FungicideFilter) {
            try {
                const state = global.GAIP_STATE || global.currentState;
                if (state) {
                    const approved = global.GAIP_FungicideFilter.getApprovedFungicides(diseaseName, {
                        region: state.region || state.site?.region,
                        useContext: state.useContext || state.site?.useContext
                    });
                    if (approved && approved.actives && approved.actives.length > 0) {
                        const primary = approved.actives.find(a => a.type === 'primary') || approved.actives[0];
                        result.activeIngredient = primary.activeIngredient;
                        result.fracGroup = String(primary.fracGroup || '');
                        result.productName = primary.tradeName || primary.activeIngredient;
                        result.productKey = primary.activeIngredient;
                    }
                }
            } catch (e) {
                // Fungicide filter not ready, fall back to text extraction
            }
        }

        return result;
    }

    // =========================================================================
    // PGR CARD INTEGRATION
    // =========================================================================

    /**
     * Wire "Log Application" button into the PGR card.
     * Appears when PGR status is 'due' or 'approaching'.
     */
    function wirePGRCard() {
        if (!global.GAIP_SprayLogUI) return;

        const pgrCard = document.querySelector('.pgr-card');
        if (!pgrCard || _wiredCards.has(pgrCard)) return;

        // Only show button when reapplication is relevant
        const statusBadge = pgrCard.querySelector('.pgr-status-badge');
        const status = statusBadge ? statusBadge.textContent.trim().toLowerCase() : '';
        
        // Extract product info from the PGR source line
        const sourceLine = pgrCard.querySelector('.pgr-source');
        const sourceText = sourceLine ? sourceLine.textContent : '';
        
        // Parse product from PGR state
        const pgrState = global.GAIP_STATE?.pgr || {};
        const productBadge = pgrCard.querySelector('.pgr-product-badge');
        const activeIngredient = productBadge ? productBadge.textContent.trim() : 'trinexapac-ethyl';
        
        // Extract rate from source text
        const rateMatch = sourceText.match(/([\d.]+)\s*L\/ha/);
        const rate = rateMatch ? parseFloat(rateMatch[1]) : null; // rateFromState fallback applied below

        // Map product codes to names
        const productNames = {
            'TE250': 'Primo 250EC (TE 250g/L)', 'PRIMO250': 'Primo 250EC (TE 250g/L)',
            'TE175': 'Amigo 175 (TE 175g/L)',   'PRIMO_MAXX': 'Primo Maxx (TE 120g/L)',
            'TE120': 'Amigo 120 (TE 120g/L)',
            'PBZ200': 'Paclobutrazol 200g/L',   'PBZ250': 'Paclobutrazol 250g/L',
            'ANUEW': 'Anuew (Prohexadione-Ca)',
            'ETH': 'Ethephon 480g/L',           'INCOGNITO': 'Indigo Incognito (Ethephon)'
        };
        
        const productCode = pgrState.productType || pgrState.product || '';
        // b35fix230: improved fallback — show product code if known, not just AI
        const productName = productNames[productCode] || (productCode ? productCode : 'PGR (' + activeIngredient + ')');
        // b35fix230: also read rate directly from pgrState if regex fails
        const rateFromState = pgrState.rateLperHa || pgrState.rate || null;

        const btn = global.GAIP_SprayLogUI.createLogButton({
            module: 'pgr',
            productName: productName,
            productKey: productCode,
            activeIngredient: activeIngredient,
            fracGroup: null,
            rate: rate || rateFromState,
            rateUnit: 'L/ha',
            target: 'growth_regulation',
            zone: getCurrentZone(),
            applicationDate: pgrState.applicationDate || null
        });

        // Insert before the source line or at the end of the card
        if (sourceLine) {
            sourceLine.parentNode.insertBefore(btn, sourceLine);
        } else {
            pgrCard.appendChild(btn);
        }

        _wiredCards.add(pgrCard);
        log('Wired PGR card with Log button');
    }

    // =========================================================================
    // HELPERS
    // =========================================================================

    /**
     * Get the current zone from site context.
     * Falls back to 'greens' if not determinable.
     */
    function getCurrentZone() {
        // Try turf profile surface type
        const state = global.GAIP_STATE || global.currentState;
        if (state) {
            const surface = state.surface?.type || state.turfProfile?.surface;
            if (surface) {
                const surfaceMap = {
                    'greens': 'greens', 'putting_green': 'greens',
                    'tees': 'tees', 'tee': 'tees',
                    'fairways': 'fairways', 'fairway': 'fairways',
                    'surrounds': 'surrounds', 'approach': 'surrounds',
                    'sports': 'other', 'amenity': 'other'
                };
                return surfaceMap[surface] || 'greens';
            }
        }

        // Try header bar for surface indicator
        const headerBadge = document.querySelector('.gaip-hub-badge');
        if (headerBadge) {
            const text = headerBadge.textContent.toLowerCase();
            if (text.includes('green')) return 'greens';
            if (text.includes('tee')) return 'tees';
            if (text.includes('fairway')) return 'fairways';
        }

        return 'greens';
    }

    /**
     * Format disease key to display name.
     */
    function formatDiseaseName(key) {
        if (!key) return '';
        return key
            .replace(/([A-Z])/g, ' $1')
            .replace(/^./, s => s.toUpperCase())
            .trim();
    }

    // =========================================================================
    // EVENT LISTENERS
    // =========================================================================

    function wireAll() {
        // Small delay to let DOM settle after render
        setTimeout(() => {
            wireDiseaseCards();
            wirePGRCard();
        }, 200);
    }

    function init() {
        log(`v${VERSION} initialising...`);

        // Wire after analysis completes
        document.addEventListener('gaip:analysis-complete', wireAll);
        document.addEventListener('gaip:analysis-complete', wireAll);

        // Wire after cascade completes (in case disease cards render later)
        document.addEventListener('gaip:cascade-complete', wireAll);

        // Wire after tab changes (cards may re-render)
        document.addEventListener('gaip:tab-change', function(e) {
            if (e.detail && (e.detail.tab === 'analysis' || e.detail.tab === 'programmes' || e.detail.tab === 'today')) {
                setTimeout(wireAll, 300);
            }
        });

        // Also try on DOM mutations for dynamically rendered cards
        const observer = new MutationObserver(function(mutations) {
            let hasNewCards = false;
            for (const m of mutations) {
                for (const node of m.addedNodes) {
                    if (node.nodeType === 1) {
                        if (node.classList?.contains('gaip-disease-card') || 
                            node.classList?.contains('pgr-card') ||
                            node.querySelector?.('.gaip-disease-card') ||
                            node.querySelector?.('.pgr-card')) {
                            hasNewCards = true;
                            break;
                        }
                    }
                }
                if (hasNewCards) break;
            }
            if (hasNewCards) {
                setTimeout(wireAll, 300);
            }
        });

        // Observe the hub container for new cards
        const target = document.querySelector('.gaip-result-cards') || 
                       document.querySelector('#gaip-hub') ||
                       document.body;
        observer.observe(target, { childList: true, subtree: true });

        // Initial wire attempt (in case cards already exist)
        wireAll();

        log(`v${VERSION} initialised`);
    }

    // =========================================================================
    // EXPORT
    // =========================================================================

    global.GAIP_SprayLogIntegration = {
        version: VERSION,
        init,
        wireDiseaseCards,
        wirePGRCard,
        wireAll
    };

    // Auto-init
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => setTimeout(init, 500));
    } else {
        setTimeout(init, 500);
    }

    log(`v${VERSION} loaded`);

})(typeof window !== 'undefined' ? window : this);
