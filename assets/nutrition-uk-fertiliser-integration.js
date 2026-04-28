/**
 * Nutrition Calendar ↔ UK Fertiliser Product Recommender Integration
 * 
 * Wires the UK fertiliser product database to the Nutrition Calendar.
 * Automatically generates product recommendations when the calendar generates.
 * 
 * REGION RESTRICTION: Only activates for UK/Ireland locations.
 * UK suppliers: ICL, Agrovista (Compo/NovaTec/Floranid), ReGen, OAS/Headland
 * 
 * SCORER: N-match dominant (0-100 pts), K capped (max 15 pts), P delivery bonus,
 * penalise zero-P when P needed. Season read from calendar month.season, not hardcoded.
 * This is a deliberate departure from the AU scorer (K-heavy 35%, N 25%) — the same
 * turf nutrition principles apply, but the weights here are corrected. The AU scorer
 * weight revision is backlogged separately to avoid production regressions.
 *
 * Dependencies:
 *   - nutrition-calendar.js (GilbaNutritionCalendar)
 *   - uk-fertiliser-products.js (GAIP_UK_FERTILISER)
 *   - regional-profiles.js (for UK detection)
 *   - Hub state (GAIP_STATE.soil.surfaceType)
 * 
 * @package Gilba_Hub
 * @version 1.0.0
 * @since b35fix293
 */

(function() {
    'use strict';

    // ========================================================================
    // SUPPLIER DISPLAY NAMES
    // ========================================================================
    const SUPPLIER_DISPLAY = {
        'icl':       'ICL',
        'agrovista': 'Agrovista',
        'regen':     'ReGen',
        'oas':       'OAS / Headland',
        'all':       'All Suppliers (best match)'
    };

    // ========================================================================
    // UK FERTILISER RECOMMENDER (SCORER)
    // ========================================================================
    const UkFertiliserRecommender = {

        version: '1.0.0',

        /**
         * Get supplier options for the dropdown
         */
        getSupplierOptions: function() {
            var opts = [{ value: 'all', label: SUPPLIER_DISPLAY['all'] }];
            var db = window.GAIP_UK_FERTILISER && window.GAIP_UK_FERTILISER.products;
            if (!db) return opts;

            var seen = {};
            var arrays = [db.granular || [], db.liquid || [], db.soluble || []];
            arrays.forEach(function(arr) {
                arr.forEach(function(p) {
                    var s = p.supplier;
                    if (s && !seen[s]) {
                        seen[s] = true;
                        opts.push({ value: s, label: SUPPLIER_DISPLAY[s] || s });
                    }
                });
            });
            return opts;
        },

        /**
         * Filter products by surface type using surfaceSGN and product.surfaces
         */
        filterBySurface: function(products, surfaceType) {
            if (!surfaceType) return products;
            var mapped = surfaceType;
            if (surfaceType === 'golf_greens' || surfaceType === 'bowling_greens' || surfaceType === 'cricket_wickets') {
                mapped = 'greens';
            } else if (surfaceType === 'tees') {
                mapped = 'tees';
            } else if (surfaceType === 'fairways') {
                mapped = 'fairways';
            } else {
                mapped = 'sports';
            }

            return products.filter(function(p) {
                if (p.surfaces && p.surfaces.length > 0) {
                    return p.surfaces.indexOf(mapped) !== -1 || p.surfaces.indexOf('all') !== -1;
                }
                return true;
            });
        },

        /**
         * Score a granular product for a given month's requirements
         * 
         * Weights (b35fix293 — corrected from AU scorer):
         *   N-match:      0-100 pts (primary — this drives product selection)
         *   K delivery:   max 15 pts (secondary — important but not dominant)
         *   P delivery:   -20 to +15 pts (bonus when needed, penalty for zero-P when P needed)
         *   Release type: 0-20 pts
         *   Autumn K:     0-15 pts
         *   Greens penalty: 0 to -15 pts
         *   Mulders:      0 to -40 pts
         */
        scoreGranularProduct: function(product, monthReqs, context) {
            var nRequired = monthReqs.N || 0;
            var kRequired = monthReqs.K || 0;
            var pRequired = monthReqs.P || 0;
            if (nRequired <= 0) return null;

            var nPct = (product.analysis && product.analysis.N || 0) / 100;
            var kPct = (product.analysis && product.analysis.K || 0) / 100;
            var pPct = (product.analysis && product.analysis.P || 0) / 100;
            if (nPct <= 0) return null;

            // Determine label rates
            var rates = product.rates || {};
            var isGreens = context.isGreens;
            var minRate = isGreens ? (rates.greensMin || rates.stdMin || 100) : (rates.teesMin || rates.stdMin || 150);
            var maxRate = isGreens ? (rates.greensMax || rates.stdMax || 500) : (rates.teesMax || rates.stdMax || 750);

            // Rate needed to deliver target N
            var rateNeeded = nRequired / nPct;

            // Release duration for slow/controlled release
            var monthsCovered = 1;
            var release = product.release || 'quick';
            if (release === 'controlled' || release === 'slow') {
                monthsCovered = (release === 'controlled') ? 3 : 2;
            } else if (release === 'stabilised') {
                monthsCovered = 1.5;
            }

            // Effective monthly delivery
            var actualRate = Math.max(rateNeeded, minRate);
            if (actualRate > maxRate) actualRate = maxRate;
            var effectiveMonthlyN = (actualRate * nPct) / monthsCovered;
            var effectiveMonthlyK = (actualRate * kPct) / monthsCovered;

            // ================================================================
            // SCORE 1: N Delivery Accuracy (0-100 pts) — PRIMARY
            // ================================================================
            var nDeliveryRatio = effectiveMonthlyN / nRequired;
            var nScore = 0;
            if (nDeliveryRatio >= 0.85 && nDeliveryRatio <= 1.15) {
                nScore = 100;
            } else if (nDeliveryRatio >= 0.7 && nDeliveryRatio <= 1.3) {
                nScore = 75;
            } else if (nDeliveryRatio >= 0.5 && nDeliveryRatio <= 1.5) {
                nScore = 40;
            } else if (nDeliveryRatio > 1.5 && nDeliveryRatio <= 2.0) {
                nScore = -20;
            } else if (nDeliveryRatio > 2.0 && nDeliveryRatio <= 2.5) {
                nScore = -60;
            } else if (nDeliveryRatio > 2.5) {
                nScore = -120;
            } else if (nDeliveryRatio < 0.5) {
                nScore = -10;
            }

            // ================================================================
            // SCORE 2: K Delivery (max 15 pts)
            // ================================================================
            var kScore = 0;
            if (kRequired > 0 && kPct > 0) {
                var kDeliveryRatio = effectiveMonthlyK / kRequired;
                if (kDeliveryRatio >= 0.7 && kDeliveryRatio <= 1.5) {
                    kScore = 15;
                } else if (kDeliveryRatio >= 0.5 && kDeliveryRatio <= 2.0) {
                    kScore = 10;
                } else if (kDeliveryRatio > 2.0) {
                    kScore = -5;
                } else {
                    kScore = 5;
                }
            } else if (kRequired <= 0 && kPct > 0) {
                // No K needed but product has K
                if (effectiveMonthlyK > 10) kScore = -10;
                else if (effectiveMonthlyK > 5) kScore = -5;
                else kScore = 0;
            } else if (kRequired > 0 && kPct === 0) {
                kScore = -5;
            } else {
                kScore = 5;
            }

            // ================================================================
            // SCORE 3: P Delivery (-20 to +15 pts)
            // Bonus P delivery when soil P is deficient; penalise zero-P when P needed
            // ================================================================
            var pScore = 0;
            var soilPSufficient = context.soilPSufficient;
            if (pRequired > 0) {
                // P is needed
                if (pPct > 0) {
                    var pDelivered = actualRate * pPct / monthsCovered;
                    var pRatio = pDelivered / pRequired;
                    if (pRatio >= 0.5 && pRatio <= 2.0) {
                        pScore = 15; // Bonus: delivering P when needed
                    } else if (pRatio > 2.0) {
                        pScore = 5; // Some P overshoot but still contributing
                    } else {
                        pScore = 8; // Light P contribution
                    }
                } else {
                    // Zero P when P is needed — penalise
                    pScore = -20;
                }
            } else if (soilPSufficient && pPct > 0) {
                // P not needed but product carries P — penalise
                var pAtRate = actualRate * pPct;
                if (isGreens) {
                    if (pAtRate > 2) pScore = -15;
                    else if (pAtRate > 1) pScore = -10;
                    else pScore = -5;
                } else {
                    if (pAtRate > 3) pScore = -10;
                    else pScore = -3;
                }
            }

            // ================================================================
            // SCORE 4: Release type (0-20 pts)
            // ================================================================
            var releaseScore = 10;
            if (release === 'controlled' || release === 'slow') {
                releaseScore = isGreens ? 20 : 18;
            } else if (release === 'stabilised') {
                releaseScore = 15;
            }

            // ================================================================
            // SCORE 5: Autumn K bonus (0-15 pts)
            // Season from calendar month data, not hardcoded
            // ================================================================
            var autumnKBonus = 0;
            var season = context.season || '';
            if (season === 'autumn' || season === 'late_autumn') {
                if (kPct > 0) {
                    var kContent = product.analysis && product.analysis.K || 0;
                    if (kContent >= 15) autumnKBonus = 15;
                    else if (kContent >= 10) autumnKBonus = 12;
                    else if (kContent >= 5) autumnKBonus = 8;
                    else autumnKBonus = 4;
                } else {
                    autumnKBonus = -8;
                }
            }

            // ================================================================
            // SCORE 6: Greens-specific penalty (0 to -15 pts)
            // ================================================================
            var greensPenalty = 0;
            if (isGreens) {
                if (nDeliveryRatio > 2.0) greensPenalty -= 10;
                else if (nDeliveryRatio > 1.5) greensPenalty -= 5;
                if (kRequired > 0) {
                    var kRatio = (actualRate * kPct) / kRequired;
                    if (season !== 'autumn' && season !== 'late_autumn') {
                        if (kRatio > 3.0) greensPenalty -= 10;
                        else if (kRatio > 2.0) greensPenalty -= 5;
                    }
                }
            }

            // ================================================================
            // SCORE 7: Mulders antagonism modifier (0 to -40 pts)
            // Same logic as AU — suppressor/suppressed ratio checks
            // ================================================================
            var muldersModifier = 0;
            var mFlags = context.muldersFlags || {};
            var kAnalysis = product.analysis && product.analysis.K || 0;
            var pAnalysis = product.analysis && product.analysis.P || 0;
            var severityMult = function(flags, sym) {
                if (!flags[sym] || !flags[sym].length) return 0;
                return flags[sym].some(function(f) { return f.severity === 'high'; }) ? 2 : 1;
            };
            if (mFlags['Mg'] && mFlags['Mg'].some(function(f) { return f.suppressor === 'K'; })) {
                if (kAnalysis > 20) muldersModifier -= 40 * severityMult(mFlags, 'Mg');
                else if (kAnalysis > 12) muldersModifier -= 25 * severityMult(mFlags, 'Mg');
                else if (kAnalysis > 6) muldersModifier -= 10 * severityMult(mFlags, 'Mg');
            }
            if (mFlags['Fe'] && mFlags['Fe'].some(function(f) { return f.suppressor === 'P'; })) {
                if (pAnalysis > 5) muldersModifier -= 35 * severityMult(mFlags, 'Fe');
                else if (pAnalysis > 2) muldersModifier -= 20 * severityMult(mFlags, 'Fe');
            }
            if (mFlags['Ca'] && mFlags['Ca'].some(function(f) { return f.suppressor === 'K'; })) {
                if (kAnalysis > 15) muldersModifier -= 15 * severityMult(mFlags, 'Ca');
            }
            if (mFlags['Zn'] && mFlags['Zn'].some(function(f) { return f.suppressor === 'P'; })) {
                if (pAnalysis > 3) muldersModifier -= 20 * severityMult(mFlags, 'Zn');
            }

            // ================================================================
            // TOTAL SCORE
            // N is the raw 0-100 score (not weighted down). K, P, release, 
            // autumn, greens, Mulders are additive modifiers.
            // ================================================================
            var totalScore = nScore + kScore + pScore + releaseScore + autumnKBonus + greensPenalty + muldersModifier;

            return {
                product: product,
                totalScore: totalScore,
                nScore: nScore,
                kScore: kScore,
                pScore: pScore,
                releaseScore: releaseScore,
                autumnKBonus: autumnKBonus,
                greensPenalty: greensPenalty,
                muldersModifier: muldersModifier,
                rateNeeded: rateNeeded,
                actualRate: actualRate,
                minRate: minRate,
                maxRate: maxRate,
                nPct: nPct,
                monthsCovered: monthsCovered,
                effectiveMonthlyN: effectiveMonthlyN,
                effectiveMonthlyK: effectiveMonthlyK,
                nDeliveryRatio: nDeliveryRatio
            };
        },

        /**
         * Select best granular product for a month
         */
        selectBestGranular: function(monthReqs, context) {
            var db = window.GAIP_UK_FERTILISER && window.GAIP_UK_FERTILISER.products;
            if (!db || !db.granular) return null;

            var candidates = this.filterBySurface(db.granular, context.surfaceType);
            if (context.supplierFilter && context.supplierFilter !== 'all') {
                candidates = candidates.filter(function(p) { return p.supplier === context.supplierFilter; });
            }

            // Filter by season if product has season array
            var season = context.season || '';
            if (season) {
                var seasonCandidates = candidates.filter(function(p) {
                    if (!p.season || p.season.length === 0) return true;
                    return p.season.indexOf(season) !== -1;
                });
                if (seasonCandidates.length > 0) candidates = seasonCandidates;
            }

            var bestResult = null;
            var self = this;
            candidates.forEach(function(product) {
                // Skip wetting agents, biostimulants, plant_health, no-N products
                if (product.nForm === 'no_N') return;
                if (product.release === 'wetting_agent') return;
                if (product.category === 'wetting_agent' || product.category === 'biostimulant' || product.category === 'plant_health') return;

                var result = self.scoreGranularProduct(product, monthReqs, context);
                if (!result) return;
                if (!bestResult || result.totalScore > bestResult.totalScore) {
                    bestResult = result;
                }
            });

            return bestResult;
        },

        /**
         * Select best liquid product for remaining N or supplementary feeding
         */
        selectBestLiquid: function(remainingN, monthReqs, context) {
            var db = window.GAIP_UK_FERTILISER && window.GAIP_UK_FERTILISER.products;
            if (!db) return null;

            var liquidProducts = (db.liquid || []).concat(db.soluble || []);
            var candidates = this.filterBySurface(liquidProducts, context.surfaceType);
            if (context.supplierFilter && context.supplierFilter !== 'all') {
                candidates = candidates.filter(function(p) { return p.supplier === context.supplierFilter; });
            }

            var bestScore = -Infinity;
            var bestMatch = null;

            candidates.forEach(function(product) {
                if (product.nForm === 'no_N') return;
                if (product.category === 'wetting_agent' || product.category === 'biostimulant' || product.category === 'plant_health') return;
                var nPct = (product.analysis && product.analysis.N || 0) / 100;
                if (nPct <= 0) return;

                var rates = product.rates || {};
                var minRate = rates.stdMin || 20;
                var maxRate = rates.stdMax || 60;
                var rateNeeded = remainingN / nPct;
                var actualRate = Math.max(rateNeeded, minRate);
                if (actualRate > maxRate) actualRate = maxRate;

                var deliveredN = actualRate * nPct;
                var ratio = remainingN > 0 ? deliveredN / remainingN : 0;

                // Simple N-match score for liquids
                var score = 0;
                if (ratio >= 0.8 && ratio <= 1.2) score = 100;
                else if (ratio >= 0.6 && ratio <= 1.5) score = 60;
                else if (ratio > 1.5) score = -20;
                else score = 20;

                if (score > bestScore) {
                    bestScore = score;
                    bestMatch = {
                        product: product,
                        actualRate: Math.round(actualRate * 10) / 10,
                        deliveredN: deliveredN,
                        nPct: nPct,
                        rateUnit: product.rateUnit || (product.form === 'soluble' ? 'kg/ha' : 'L/ha')
                    };
                }
            });

            return bestMatch;
        },

        /**
         * Generate annual programme from monthly calendar data
         * Mirrors the AU generateAnnualProgram interface
         */
        generateAnnualProgram: function(monthlyData, options) {
            options = options || {};
            var surfaceType = options.surfaceType || 'sports';
            var methodology = options.methodology || 'mlsn';
            var supplierFilter = options.supplierFilter || 'all';
            var muldersFlags = options.muldersFlags || {};
            var isGreens = ['greens', 'golf_greens', 'bowling_greens', 'tees', 'cricket_wickets'].indexOf(surfaceType) !== -1;

            var monthlyResults = [];
            var totals = { N: 0, P: 0, K: 0 };
            var targets = { N: 0, P: 0, K: 0 };
            var self = this;

            // Check soil P status from first month's data
            // Calendar provides N/P/K as direct properties on each month object
            var soilPSufficient = false;
            if (monthlyData.length > 0) {
                var firstP = monthlyData[0].P || (monthlyData[0].requirements && monthlyData[0].requirements.P) || 0;
                soilPSufficient = firstP <= 0;
            }

            monthlyData.forEach(function(month) {
                // b35fix293 fix: calendar months have N/P/K as direct properties,
                // NOT nested under .requirements. Support both for safety.
                var reqs = month.requirements || {
                    N: month.N || 0,
                    P: month.P || 0,
                    K: month.K || 0
                };
                targets.N += reqs.N || 0;
                targets.P += reqs.P || 0;
                targets.K += reqs.K || 0;

                var context = {
                    surfaceType: surfaceType,
                    isGreens: isGreens,
                    season: month.season || '',
                    soilPSufficient: soilPSufficient,
                    supplierFilter: supplierFilter,
                    muldersFlags: muldersFlags
                };

                var granularProducts = [];
                var liquidProducts = [];
                var notes = [];

                // Select best granular if N > 0
                if (reqs.N > 0.5) {
                    var granResult = self.selectBestGranular(reqs, context);
                    if (granResult) {
                        var p = granResult.product;
                        var rate = granResult.actualRate;
                        if (rate < granResult.minRate) rate = granResult.minRate;
                        if (rate > granResult.maxRate) rate = granResult.maxRate;
                        rate = Math.round(rate);

                        var nPct = granResult.nPct;
                        var kPct = (p.analysis && p.analysis.K || 0) / 100;
                        var pPct = (p.analysis && p.analysis.P || 0) / 100;
                        var mc = granResult.monthsCovered;

                        var deliveredN = (rate * nPct) / mc;
                        var deliveredP = (rate * pPct) / mc;
                        var deliveredK = (rate * kPct) / mc;

                        // g/m2 for greens surfaces
                        var rateGM2 = Math.round(rate / 100 * 10) / 10;

                        granularProducts.push({
                            id: p.id,
                            name: p.name,
                            brand: p.brand,
                            supplier: p.supplier,
                            npk: p.npk_label || ((p.analysis.N || 0) + '-' + Math.round((p.analysis.P || 0) / 0.4366) + '-' + Math.round((p.analysis.K || 0) / 0.83)),
                            release: p.release,
                            nForm: p.nForm,
                            rateKgHa: rate,
                            rateGM2: rateGM2,
                            delivers: { N: Math.round(deliveredN * 10) / 10, P: Math.round(deliveredP * 10) / 10, K: Math.round(deliveredK * 10) / 10 },
                            notes: p.notes || '',
                            analysis: p.analysis,
                            product: p
                        });

                        totals.N += deliveredN;
                        totals.P += deliveredP;
                        totals.K += deliveredK;

                        // Check for liquid top-up if granular under-delivers N
                        var nShortfall = reqs.N - deliveredN;
                        if (nShortfall > 1.0) {
                            var liquidResult = self.selectBestLiquid(nShortfall, reqs, context);
                            if (liquidResult) {
                                var lp = liquidResult.product;
                                var lRate = liquidResult.actualRate;
                                var lnPct = liquidResult.nPct;
                                var lkPct = (lp.analysis && lp.analysis.K || 0) / 100;
                                var lpPct = (lp.analysis && lp.analysis.P || 0) / 100;
                                var lDeliveredN = lRate * lnPct;
                                var lDeliveredP = lRate * lpPct;
                                var lDeliveredK = lRate * lkPct;

                                liquidProducts.push({
                                    id: lp.id,
                                    name: lp.name,
                                    brand: lp.brand,
                                    supplier: lp.supplier,
                                    form: lp.form || 'liquid',
                                    rateLHa: Math.round(lRate * 10) / 10,
                                    rateUnit: liquidResult.rateUnit,
                                    rate: Math.round(lRate * 10) / 10 + ' ' + liquidResult.rateUnit,
                                    delivers: { N: Math.round(lDeliveredN * 10) / 10, P: Math.round(lDeliveredP * 10) / 10, K: Math.round(lDeliveredK * 10) / 10 },
                                    notes: lp.notes || '',
                                    analysis: lp.analysis,
                                    product: lp
                                });

                                totals.N += lDeliveredN;
                                totals.P += lDeliveredP;
                                totals.K += lDeliveredK;
                            } else {
                                notes.push('No suitable liquid product found to top up N shortfall of ' + nShortfall.toFixed(1) + ' kg/ha');
                            }
                        }
                    } else {
                        notes.push('No suitable granular product found for this month');
                        // Try liquid-only
                        var liquidOnly = self.selectBestLiquid(reqs.N, reqs, context);
                        if (liquidOnly) {
                            var lop = liquidOnly.product;
                            var loRate = liquidOnly.actualRate;
                            var lonPct = liquidOnly.nPct;
                            var lokPct = (lop.analysis && lop.analysis.K || 0) / 100;
                            var lopPct = (lop.analysis && lop.analysis.P || 0) / 100;

                            liquidProducts.push({
                                id: lop.id,
                                name: lop.name,
                                brand: lop.brand,
                                supplier: lop.supplier,
                                form: lop.form || 'liquid',
                                rateLHa: Math.round(loRate * 10) / 10,
                                rateUnit: liquidOnly.rateUnit,
                                rate: Math.round(loRate * 10) / 10 + ' ' + liquidOnly.rateUnit,
                                delivers: { N: Math.round(loRate * lonPct * 10) / 10, P: Math.round(loRate * lopPct * 10) / 10, K: Math.round(loRate * lokPct * 10) / 10 },
                                notes: lop.notes || '',
                                analysis: lop.analysis,
                                product: lop
                            });

                            totals.N += loRate * lonPct;
                            totals.P += loRate * lopPct;
                            totals.K += loRate * lokPct;
                        }
                    }
                }

                monthlyResults.push({
                    month: month.month,
                    month_name: month.month_name || month.monthName || '',
                    season: month.season || '',
                    gp: month.gp || 0,
                    requirements: reqs,
                    granular: granularProducts,
                    liquid: liquidProducts,
                    notes: notes
                });
            });

            return {
                meta: {
                    region: 'uk',
                    surfaceType: surfaceType,
                    methodology: methodology,
                    supplierFilter: supplierFilter,
                    useGM2: isGreens
                },
                monthly: monthlyResults,
                targets: targets,
                delivered: totals,
                balance: {
                    N: totals.N - targets.N,
                    P: totals.P - targets.P,
                    K: totals.K - targets.K
                }
            };
        }
    };

    // ========================================================================
    // INTEGRATION MODULE
    // ========================================================================

    var NutritionUkFertiliserIntegration = {

        version: '1.0.0',
        lastProgram: null,
        lastCalendarData: null,
        selectedSupplier: 'all',

        /**
         * Initialize integration
         */
        init: function() {
            if (!window.GAIP_UK_FERTILISER) {
                console.warn('[NutritionUkFertiliserIntegration] Waiting for GAIP_UK_FERTILISER...');
                setTimeout(function() { NutritionUkFertiliserIntegration.init(); }, 100);
                return;
            }

            var self = this;
            document.addEventListener('gaip:nutrition-calendar-generated', function(e) {
                if (!self.isUK()) {
                    self.hideRecommendations();
                    return;
                }
                self.lastCalendarData = e.detail.program;
                self.generateAndRender(e.detail.program);
            });

            console.log('[NutritionUkFertiliserIntegration] Initialised. Products:', 
                (window.GAIP_UK_FERTILISER.products.granular || []).length, 'granular,',
                (window.GAIP_UK_FERTILISER.products.liquid || []).length, 'liquid');
        },

        hideRecommendations: function() {
            var container = document.querySelector('[data-uk-fertiliser-recommendations]');
            if (container) container.style.display = 'none';
        },

        /**
         * UK region detection
         * UK/Ireland: lat 49-61, lon -11 to 2
         */
        isUK: function() {
            if (window.GAIP_RegionalProfiles && window.GAIP_RegionalProfiles.detectRegionFromHub) {
                var region = window.GAIP_RegionalProfiles.detectRegionFromHub();
                return region === 'uk_ireland';
            }
            if (window.GAIP_STATE && window.GAIP_STATE.location && window.GAIP_STATE.location.region) {
                return window.GAIP_STATE.location.region === 'uk_ireland';
            }
            var lat = (window.GAIP_STATE && window.GAIP_STATE.location && window.GAIP_STATE.location.lat) ||
                      (window.GAIP_HUB_CONFIG && window.GAIP_HUB_CONFIG.savedLocation && window.GAIP_HUB_CONFIG.savedLocation.lat);
            var lon = (window.GAIP_STATE && window.GAIP_STATE.location && window.GAIP_STATE.location.lon) ||
                      (window.GAIP_HUB_CONFIG && window.GAIP_HUB_CONFIG.savedLocation && window.GAIP_HUB_CONFIG.savedLocation.lon);
            if (lat && lon) {
                return (lat >= 49 && lat <= 61 && lon >= -11 && lon <= 2);
            }
            // GAIP_SiteConfig fallback
            try {
                var SC = window.GAIP_SiteConfig || window.GAIP_SiteContext;
                var siteId = window.GAIP_SiteContext ? window.GAIP_SiteContext.getSiteId() : null;
                if (SC && siteId && typeof SC.getConfig === 'function') {
                    var cfg = SC.getConfig(siteId);
                    var cfgLat = cfg && cfg.location && cfg.location.lat;
                    var cfgLon = cfg && cfg.location && cfg.location.lon;
                    if (cfgLat && cfgLon) {
                        return (cfgLat >= 49 && cfgLat <= 61 && cfgLon >= -11 && cfgLon <= 2);
                    }
                }
            } catch(e) {}
            return false;
        },

        getSurfaceType: function() {
            var turfState = (window.GaipTurfProfile && window.GaipTurfProfile.state) || (window.GAIP_STATE && window.GAIP_STATE.turf) || {};
            if (turfState.cotula === true || turfState.turfType === 'bowls' ||
                (window.GAIP_STATE && window.GAIP_STATE.turf && window.GAIP_STATE.turf.cotula === true)) {
                return 'bowling_greens';
            }
            if (window.GAIP_STATE && window.GAIP_STATE.soil && window.GAIP_STATE.soil.surfaceType) {
                var st = window.GAIP_STATE.soil.surfaceType;
                if (st === 'cotula_bowling_green') return 'bowling_greens';
                return st;
            }
            if (window.GaipTurfProfile && window.GaipTurfProfile.state && window.GaipTurfProfile.state.subCategory) {
                return window.GaipTurfProfile.state.subCategory;
            }
            var surfaceSelect = document.querySelector('.gaip-surface-type');
            if (surfaceSelect && surfaceSelect.value) return surfaceSelect.value;
            return 'sports';
        },

        getMethodology: function(calendarData) {
            if (window.GAIP_STATE && window.GAIP_STATE.soil && window.GAIP_STATE.soil.methodology) {
                var m = window.GAIP_STATE.soil.methodology;
                if (m === 'cotula_s78' || m === 'cotula') return 'ammonium_acetate';
                return m;
            }
            if (calendarData && calendarData.soil) {
                var m2 = calendarData.soil.methodology || calendarData.soil.extractant;
                if (m2) return m2;
            }
            return 'mlsn';
        },

        generateAndRender: function(calendarData) {
            var context = {
                surfaceType: this.getSurfaceType(),
                methodology: this.getMethodology(calendarData)
            };

            // Mulders analysis (same pattern as AU integration)
            var muldersFlags = {};
            if (window.GilbaMulders) {
                try {
                    var mNutrients = [];
                    var soilSrc = null;
                    var SM = window.GAIP_SampleManager;
                    if (SM && typeof SM.getActiveSample === 'function') {
                        soilSrc = SM.getActiveSample('soil');
                    }
                    if (soilSrc) {
                        var normData = soilSrc.normalized || soilSrc.rawData || {};
                        Object.keys(normData).forEach(function(sym) {
                            var val = parseFloat(normData[sym]);
                            if (!isNaN(val) && val > 0) mNutrients.push({ nutrient: sym, actual: val });
                        });
                    }
                    if (mNutrients.length === 0 && calendarData && calendarData.soil && calendarData.soil.ppm) {
                        Object.keys(calendarData.soil.ppm).forEach(function(sym) {
                            var val = parseFloat(calendarData.soil.ppm[sym]);
                            if (!isNaN(val) && val > 0) mNutrients.push({ nutrient: sym, actual: val });
                        });
                    }
                    if (mNutrients.length > 0) {
                        var mContext = {
                            methodology: context.methodology || 'mlsn',
                            soilPH: (calendarData.soil && (calendarData.soil.pH_water || calendarData.soil.pH_cacl2 || calendarData.soil.pH)) || null,
                            extractant: (calendarData.soil && (calendarData.soil.extractant || calendarData.soil.methodology)) || null
                        };
                        var mResult = window.GilbaMulders.analyse(mNutrients, mContext);
                        muldersFlags = mResult.flags || {};
                        console.log('[NutritionUkFertiliserIntegration] Mulder flags:', Object.keys(muldersFlags));
                    }
                } catch(e) {
                    console.warn('[NutritionUkFertiliserIntegration] Mulder analysis failed:', e);
                }
            }

            try {
                context.muldersFlags = muldersFlags;
                var program = UkFertiliserRecommender.generateAnnualProgram(
                    calendarData.program ? calendarData.program.monthly : (calendarData.monthly || []),
                    {
                        surfaceType: context.surfaceType,
                        methodology: context.methodology,
                        supplierFilter: this.selectedSupplier || 'all',
                        muldersFlags: muldersFlags
                    }
                );

                if (program.error) {
                    console.error('[NutritionUkFertiliserIntegration]', program.error);
                    return;
                }

                this.lastProgram = program;

                // Store globally for Word export
                program._generatedForSite = (window.GAIP_SampleManager && window.GAIP_SampleManager.getActiveSiteId)
                    ? window.GAIP_SampleManager.getActiveSiteId() : 'unknown';
                window.GAIP_UK_NUTRITION_PROGRAM = program;

                this.renderProductRecommendations(program);

                document.dispatchEvent(new CustomEvent('gaip:uk-fertiliser-program-generated', {
                    detail: { program: program, context: context }
                }));

            } catch (error) {
                console.error('[NutritionUkFertiliserIntegration] Error generating program:', error);
            }
        },

        renderProductRecommendations: function(program) {
            var container = document.querySelector('[data-uk-fertiliser-recommendations]');
            if (!container) {
                var calendarResults = document.querySelector('[data-nutrition-results]');
                if (calendarResults) {
                    container = document.createElement('div');
                    container.setAttribute('data-uk-fertiliser-recommendations', '');
                    container.className = 'gilba-uk-fertiliser-recommendations';
                    calendarResults.appendChild(container);
                }
            }
            if (!container) {
                console.warn('[NutritionUkFertiliserIntegration] No container found');
                return;
            }
            container.style.display = '';
            container.innerHTML = this.buildRecommendationsHTML(program);
            this.bindSupplierDropdown();
        },

        bindSupplierDropdown: function() {
            var select = document.getElementById('uk-fert-supplier-select');
            if (!select) return;
            var self = this;
            select.addEventListener('change', function(e) {
                self.selectedSupplier = e.target.value;
                if (self.lastCalendarData) {
                    self.generateAndRender(self.lastCalendarData);
                } else {
                    var calendar = window.GilbaNutritionCalendar;
                    if (calendar && calendar.program) {
                        self.generateAndRender(calendar.program);
                    }
                }
            });
        },

        formatSurfaceType: function(st) {
            var map = {
                'greens': 'Greens', 'golf_greens': 'Golf Greens', 'bowling_greens': 'Bowling Greens',
                'tees': 'Tees', 'fairways': 'Fairways', 'sports': 'Sports Pitches',
                'cricket_wickets': 'Cricket Wickets'
            };
            return map[st] || st;
        },

        buildRecommendationsHTML: function(program) {
            var meta = program.meta;
            var monthly = program.monthly;
            var nutrientTotals, nutrientRequired;

            if (program.delivered && program.targets) {
                nutrientTotals = { N: program.delivered.N, P: program.delivered.P, K: program.delivered.K };
                nutrientRequired = { N: program.targets.N, P: program.targets.P, K: program.targets.K };
            } else {
                nutrientTotals = { N: 0, P: 0, K: 0 };
                nutrientRequired = { N: 0, P: 0, K: 0 };
                monthly.forEach(function(m) {
                    nutrientRequired.N += (m.requirements && m.requirements.N) || 0;
                    nutrientRequired.P += (m.requirements && m.requirements.P) || 0;
                    nutrientRequired.K += (m.requirements && m.requirements.K) || 0;
                    (m.granular || []).forEach(function(p) {
                        if (p.delivers) { nutrientTotals.N += p.delivers.N || 0; nutrientTotals.P += p.delivers.P || 0; nutrientTotals.K += p.delivers.K || 0; }
                    });
                    (m.liquid || []).forEach(function(p) {
                        if (p.delivers) { nutrientTotals.N += p.delivers.N || 0; nutrientTotals.P += p.delivers.P || 0; nutrientTotals.K += p.delivers.K || 0; }
                    });
                });
            }

            ['N', 'P', 'K'].forEach(function(k) {
                nutrientTotals[k] = Math.round(nutrientTotals[k] * 10) / 10;
                nutrientRequired[k] = Math.round(nutrientRequired[k] * 10) / 10;
            });

            // Nutrient summary rows
            var nutrientSummaryRows = ['N', 'P', 'K'].map(function(nutrient) {
                var required = nutrientRequired[nutrient];
                var delivered = nutrientTotals[nutrient];
                var diff = delivered - required;
                var pct = required > 0 ? Math.round((delivered / required) * 100) : 0;
                var statusColor = pct >= 90 ? 'var(--gaip-success)' : pct >= 70 ? 'var(--gaip-warning)' : 'var(--gaip-error)';
                var statusIcon = pct >= 90 ? '✓' : pct >= 70 ? '⚠' : '✗';
                return '<tr>' +
                    '<td style="padding:8px;border:1px solid var(--gaip-border);"><strong>' + nutrient + '</strong></td>' +
                    '<td style="padding:8px;border:1px solid var(--gaip-border);text-align:right;">' + required + '</td>' +
                    '<td style="padding:8px;border:1px solid var(--gaip-border);text-align:right;">' + delivered + '</td>' +
                    '<td style="padding:8px;border:1px solid var(--gaip-border);text-align:right;color:' + (diff >= 0 ? 'var(--gaip-success)' : 'var(--gaip-error)') + ';font-weight:600;">' + (diff >= 0 ? '+' : '') + diff.toFixed(1) + '</td>' +
                    '<td style="padding:8px;border:1px solid var(--gaip-border);text-align:center;color:' + statusColor + ';font-weight:600;">' + statusIcon + ' ' + pct + '%</td>' +
                '</tr>';
            }).join('');

            // Monthly rows
            var useGM2 = meta.useGM2 || ['greens', 'golf_greens', 'bowling_greens', 'tees', 'cricket_wickets'].indexOf(meta.surfaceType) !== -1;

            var monthlyRows = monthly.map(function(m) {
                var granularList = m.granular.map(function(p) {
                    var rateStr = useGM2 ? (p.rateGM2 + 'g/m\u00B2') : (p.rateKgHa + 'kg/ha');
                    var releaseTag = (p.release === 'slow' || p.release === 'controlled' || p.release === 'stabilised')
                        ? ' <span style="font-size:10px;padding:1px 4px;background:var(--gaip-info-bg,#eff6ff);color:#1e40af;border-radius:3px;">' + (p.release || '').toUpperCase() + '</span>'
                        : '';
                    var nFormTag = p.nForm
                        ? ' <span style="font-size:10px;padding:1px 4px;background:var(--gaip-surface-muted,#f3f4f6);color:var(--gaip-text-secondary);border-radius:3px;">' + p.nForm + '</span>'
                        : '';
                    return '<span class="uk-fert-product" title="' + (p.notes || '') + '">' + p.name + ' (' + p.npk + ') @ ' + rateStr + releaseTag + nFormTag + '</span>';
                }).join(' + ') || '<span class="uk-fert-none">\u2014</span>';

                var liquidList = (m.liquid || []).map(function(p) {
                    var rateStr = p.rate || (p.rateLHa ? (p.rateLHa + ' ' + (p.rateUnit || 'L/ha')) : '\u2014');
                    return '<span class="uk-fert-product liquid" title="' + (p.notes || '') + '">' + p.name + ' @ ' + rateStr + '</span>';
                }).join(' + ') || '';

                var notesArr = (m.notes || []).slice();
                var notesHtml = notesArr.length > 0 ? '<div class="uk-fert-notes">' + notesArr.join('. ') + '</div>' : '';

                return '<tr>' +
                    '<td style="padding:8px;border:1px solid var(--gaip-border);font-weight:500;">' + m.month_name + '</td>' +
                    '<td style="padding:8px;border:1px solid var(--gaip-border);">' + m.season + '</td>' +
                    '<td style="padding:8px;border:1px solid var(--gaip-border);"><span class="uk-fert-req">N:' + Math.round(m.requirements.N) + ' P:' + Math.round(m.requirements.P) + ' K:' + Math.round(m.requirements.K) + '</span></td>' +
                    '<td style="padding:8px;border:1px solid var(--gaip-border);">' + granularList + '</td>' +
                    '<td style="padding:8px;border:1px solid var(--gaip-border);">' + (liquidList || '\u2014') + '</td>' +
                '</tr>' +
                (notesHtml ? '<tr class="uk-fert-note-row"><td colspan="5" style="padding:4px 8px;background:var(--gaip-warning-bg,#fffde7);border:1px solid var(--gaip-border);font-size:12px;font-style:italic;">' + notesHtml + '</td></tr>' : '');
            }).join('');

            // Product summary
            var productUsage = {};
            monthly.forEach(function(m) {
                (m.granular || []).forEach(function(p) {
                    if (!productUsage[p.id]) { productUsage[p.id] = { product: p, applications: 0, totalKgHa: 0, totalDelivered: { N: 0, P: 0, K: 0 } }; }
                    productUsage[p.id].applications++;
                    productUsage[p.id].totalKgHa += p.rateKgHa || 0;
                    productUsage[p.id].totalDelivered.N += (p.delivers && p.delivers.N) || 0;
                    productUsage[p.id].totalDelivered.P += (p.delivers && p.delivers.P) || 0;
                    productUsage[p.id].totalDelivered.K += (p.delivers && p.delivers.K) || 0;
                });
                (m.liquid || []).forEach(function(p) {
                    if (!productUsage[p.id]) { productUsage[p.id] = { product: p, applications: 0, totalLHa: 0, totalDelivered: { N: 0, P: 0, K: 0 } }; }
                    productUsage[p.id].applications++;
                    if (p.form === 'soluble') { productUsage[p.id].totalKgHa = (productUsage[p.id].totalKgHa || 0) + (p.rateLHa || 0); }
                    else { productUsage[p.id].totalLHa = (productUsage[p.id].totalLHa || 0) + (p.rateLHa || 0); }
                    productUsage[p.id].totalDelivered.N += (p.delivers && p.delivers.N) || 0;
                    productUsage[p.id].totalDelivered.P += (p.delivers && p.delivers.P) || 0;
                    productUsage[p.id].totalDelivered.K += (p.delivers && p.delivers.K) || 0;
                });
            });

            var productEntries = Object.values(productUsage);
            var summaryRows = productEntries.map(function(p) {
                var prod = p.product || {};
                var analysis = prod.analysis || {};
                var npk = prod.npk || ((analysis.N || 0) + '-' + (analysis.P || 0) + '-' + (analysis.K || 0));
                var supplierLabel = SUPPLIER_DISPLAY[prod.supplier] || prod.supplier || '';
                var nD = Math.round((p.totalDelivered && p.totalDelivered.N) || 0);
                var pD = Math.round(((p.totalDelivered && p.totalDelivered.P) || 0) * 10) / 10;
                var kD = Math.round((p.totalDelivered && p.totalDelivered.K) || 0);
                var isSoluble = prod.form === 'soluble';
                var rateStr;
                if (p.totalLHa && !isSoluble) rateStr = Math.round(p.totalLHa) + ' L/ha';
                else if (useGM2 && !isSoluble) rateStr = (Math.round((p.totalKgHa || 0) / 10 * 10) / 10) + ' g/m\u00B2';
                else rateStr = Math.round(p.totalKgHa || 0) + ' kg/ha';

                return '<tr>' +
                    '<td style="padding:8px;border:1px solid var(--gaip-border);"><strong>' + (prod.name || p.brandName || '') + '</strong>' +
                        '<div style="font-size:11px;color:var(--gaip-text-secondary);">' + npk + ' | ' + supplierLabel + '</div></td>' +
                    '<td style="padding:8px;border:1px solid var(--gaip-border);text-align:center;">' + p.applications + '</td>' +
                    '<td style="padding:8px;border:1px solid var(--gaip-border);text-align:right;">' + rateStr + '</td>' +
                    '<td style="padding:8px;border:1px solid var(--gaip-border);text-align:right;font-family:monospace;font-size:12px;">' + nD + '</td>' +
                    '<td style="padding:8px;border:1px solid var(--gaip-border);text-align:right;font-family:monospace;font-size:12px;">' + pD + '</td>' +
                    '<td style="padding:8px;border:1px solid var(--gaip-border);text-align:right;font-family:monospace;font-size:12px;">' + kD + '</td>' +
                '</tr>';
            }).join('');

            // Totals
            var balanceN = nutrientTotals.N - nutrientRequired.N;
            var balanceP = nutrientTotals.P - nutrientRequired.P;
            var balanceK = nutrientTotals.K - nutrientRequired.K;
            var totalApps = productEntries.reduce(function(s, p) { return s + (p.applications || 0); }, 0);

            // Supplier dropdown
            var supplierOptions = UkFertiliserRecommender.getSupplierOptions();
            var self = this;
            var supplierOptionsHtml = supplierOptions.map(function(opt) {
                return '<option value="' + opt.value + '"' + (opt.value === self.selectedSupplier ? ' selected' : '') + '>' + opt.label + '</option>';
            }).join('');

            // Mulders panel (same pattern as AU)
            var muldersHtml = (function() {
                var flags = program.muldersFlags || {};
                var allFlags = [];
                Object.keys(flags).forEach(function(sym) {
                    var arr = Array.isArray(flags[sym]) ? flags[sym] : [flags[sym]];
                    arr.forEach(function(f) { if (f) allFlags.push(f); });
                });
                if (allFlags.length === 0) return '';
                var rows = allFlags.map(function(f) {
                    var sev = f.severity === 'high' ? 'var(--gaip-error)' : f.severity === 'moderate' ? 'var(--gaip-warning)' : 'var(--gaip-text-secondary)';
                    var pair = f.suppressor + ' \u2192 ' + f.suppressed;
                    var ratioVal = f.value ? f.value.toFixed(1) : '\u2014';
                    return '<div style="display:flex;align-items:flex-start;gap:10px;padding:8px 0;border-bottom:1px solid var(--gaip-border);">' +
                        '<span style="font-size:16px;line-height:1.2;">\u26A1</span>' +
                        '<div style="flex:1;">' +
                            '<span style="font-weight:600;color:' + sev + ';">' + pair + '</span>' +
                            '<span style="margin-left:8px;font-size:11px;color:var(--gaip-text-secondary);">ratio: ' + ratioVal + ' (threshold: ' + f.threshold + ')</span>' +
                            '<div style="font-size:12px;color:var(--gaip-text);margin-top:2px;">' + (f.message || '') + '</div>' +
                            (f.citation ? '<div style="font-size:10px;color:var(--gaip-text-secondary);margin-top:2px;">\uD83D\uDCD6 ' + f.citation + '</div>' : '') +
                        '</div></div>';
                }).join('');
                var count = allFlags.length;
                return '<div style="margin:0 0 1.25rem 0;padding:0.75rem 1rem;background:var(--gaip-warning-bg,#fefce8);border:1px solid var(--gaip-warning-border,#fde047);border-left:4px solid var(--gaip-warning,#ca8a04);border-radius:6px;">' +
                    '<div style="font-weight:600;color:var(--gaip-warning);margin-bottom:8px;font-size:0.9rem;">\u2697\uFE0F Mulder\'s Nutrient Interactions \u2014 ' + count + ' interaction' + (count > 1 ? 's' : '') + '</div>' +
                    '<div style="font-size:11px;color:var(--gaip-text-secondary);margin-bottom:8px;">Product selection adjusted to avoid aggravating detected antagonisms. Ref: Marschner (2012), Havlin et al. (2014).</div>' +
                    rows + '</div>';
            })();

            return '<div class="gilba-uk-fert-panel">' +
                '<h3 style="margin:0 0 1rem 0;color:var(--gaip-text);font-size:1.25rem;display:flex;align-items:center;gap:8px;">' +
                    '<span style="font-size:24px;">\uD83C\uDDEC\uD83C\uDDE7</span> UK Fertiliser Recommendations</h3>' +

                '<div class="uk-fert-supplier-filter" style="margin-bottom:1rem;padding:0.75rem;background:var(--gaip-surface-muted,#f9fafb);border:1px solid var(--gaip-border);border-radius:6px;">' +
                    '<label style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap;">' +
                        '<strong style="white-space:nowrap;">Supplier:</strong>' +
                        '<select id="uk-fert-supplier-select" style="flex:1;min-width:200px;max-width:400px;padding:0.5rem;border:1px solid var(--gaip-border);border-radius:4px;font-size:0.9rem;background:var(--gaip-surface);">' +
                            supplierOptionsHtml +
                        '</select>' +
                        '<span style="font-size:0.8rem;color:var(--gaip-text-secondary);">' +
                            (this.selectedSupplier === 'all' ? 'Recommending best products across all suppliers' : 'Showing only ' + (SUPPLIER_DISPLAY[this.selectedSupplier] || this.selectedSupplier) + ' products') +
                        '</span>' +
                    '</label></div>' +

                '<div class="uk-fert-meta" style="display:flex;gap:1.5rem;padding:0.75rem;background:var(--gaip-surface-muted,#f9fafb);border-radius:4px;font-size:0.9rem;margin-bottom:1rem;">' +
                    '<span><strong>Surface:</strong> ' + this.formatSurfaceType(meta.surfaceType) + '</span>' +
                    '<span><strong>Methodology:</strong> ' + (meta.methodology || '').toUpperCase() + '</span>' +
                    (this.selectedSupplier !== 'all' ? '<span style="color:var(--gaip-warning);"><strong>Supplier:</strong> ' + (SUPPLIER_DISPLAY[this.selectedSupplier] || this.selectedSupplier) + '</span>' : '') +
                '</div>' +

                muldersHtml +

                '<h4 style="margin:1.5rem 0 0.75rem 0;font-size:1rem;border-bottom:1px solid var(--gaip-border);padding-bottom:0.5rem;">Nutrient Balance (kg/ha)</h4>' +
                '<div class="gilba-table-scroll" style="overflow-x:auto;">' +
                    '<table class="gilba-calendar-table" style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:1.5rem;">' +
                        '<thead><tr style="background:var(--gaip-surface-hover);">' +
                            '<th style="padding:8px;text-align:left;border:1px solid var(--gaip-border);">Nutrient</th>' +
                            '<th style="padding:8px;text-align:right;border:1px solid var(--gaip-border);">Required</th>' +
                            '<th style="padding:8px;text-align:right;border:1px solid var(--gaip-border);">Delivered</th>' +
                            '<th style="padding:8px;text-align:right;border:1px solid var(--gaip-border);">Balance</th>' +
                            '<th style="padding:8px;text-align:center;border:1px solid var(--gaip-border);">Status</th>' +
                        '</tr></thead><tbody>' + nutrientSummaryRows + '</tbody></table></div>' +

                '<h4 style="margin:1.5rem 0 0.75rem 0;font-size:1rem;border-bottom:1px solid var(--gaip-border);padding-bottom:0.5rem;">Monthly Programme</h4>' +
                '<div class="gilba-table-scroll" style="overflow-x:auto;">' +
                    '<table class="gilba-calendar-table uk-fert-program-table" style="width:100%;border-collapse:collapse;font-size:13px;">' +
                        '<thead><tr style="background:var(--gaip-surface-hover);">' +
                            '<th style="padding:8px;text-align:left;border:1px solid var(--gaip-border);">Month</th>' +
                            '<th style="padding:8px;text-align:left;border:1px solid var(--gaip-border);">Season</th>' +
                            '<th style="padding:8px;text-align:left;border:1px solid var(--gaip-border);">Requirements</th>' +
                            '<th style="padding:8px;text-align:left;border:1px solid var(--gaip-border);">Granular Products</th>' +
                            '<th style="padding:8px;text-align:left;border:1px solid var(--gaip-border);">Liquid/Foliar</th>' +
                        '</tr></thead><tbody>' + monthlyRows + '</tbody></table></div>' +

                '<h4 style="margin:1.5rem 0 0.75rem 0;font-size:1rem;border-bottom:1px solid var(--gaip-border);padding-bottom:0.5rem;">Product Summary</h4>' +
                '<div class="gilba-table-scroll" style="overflow-x:auto;">' +
                    '<table class="gilba-calendar-table" style="width:100%;border-collapse:collapse;font-size:13px;">' +
                        '<thead><tr style="background:var(--gaip-surface-hover);">' +
                            '<th style="padding:8px;text-align:left;border:1px solid var(--gaip-border);">Product</th>' +
                            '<th style="padding:8px;text-align:center;border:1px solid var(--gaip-border);">Apps</th>' +
                            '<th style="padding:8px;text-align:right;border:1px solid var(--gaip-border);">Total Rate</th>' +
                            '<th style="padding:8px;text-align:right;border:1px solid var(--gaip-border);">N (kg)</th>' +
                            '<th style="padding:8px;text-align:right;border:1px solid var(--gaip-border);">P (kg)</th>' +
                            '<th style="padding:8px;text-align:right;border:1px solid var(--gaip-border);">K (kg)</th>' +
                        '</tr></thead><tbody>' + summaryRows +
                        '<tr style="background:var(--gaip-good-bg,#ecfdf5);font-weight:600;">' +
                            '<td style="padding:8px;border:1px solid var(--gaip-border);">TOTAL DELIVERED</td>' +
                            '<td style="padding:8px;border:1px solid var(--gaip-border);text-align:center;">' + totalApps + '</td>' +
                            '<td style="padding:8px;border:1px solid var(--gaip-border);text-align:right;">\u2014</td>' +
                            '<td style="padding:8px;border:1px solid var(--gaip-border);text-align:right;font-family:monospace;">' + Math.round(nutrientTotals.N) + '</td>' +
                            '<td style="padding:8px;border:1px solid var(--gaip-border);text-align:right;font-family:monospace;">' + (Math.round(nutrientTotals.P * 10) / 10) + '</td>' +
                            '<td style="padding:8px;border:1px solid var(--gaip-border);text-align:right;font-family:monospace;">' + Math.round(nutrientTotals.K) + '</td>' +
                        '</tr>' +
                        '<tr style="background:var(--gaip-surface-muted);">' +
                            '<td style="padding:8px;border:1px solid var(--gaip-border);" colspan="3"><em>Required (kg/ha)</em></td>' +
                            '<td style="padding:8px;border:1px solid var(--gaip-border);text-align:right;font-family:monospace;"><em>' + Math.round(nutrientRequired.N) + '</em></td>' +
                            '<td style="padding:8px;border:1px solid var(--gaip-border);text-align:right;font-family:monospace;"><em>' + (Math.round(nutrientRequired.P * 10) / 10) + '</em></td>' +
                            '<td style="padding:8px;border:1px solid var(--gaip-border);text-align:right;font-family:monospace;"><em>' + Math.round(nutrientRequired.K) + '</em></td>' +
                        '</tr>' +
                        '<tr style="background:' + (balanceN >= 0 ? 'var(--gaip-good-bg,#ecfdf5)' : 'var(--gaip-critical-bg,#fef2f2)') + ';">' +
                            '<td style="padding:8px;border:1px solid var(--gaip-border);" colspan="3"><strong>Balance</strong></td>' +
                            '<td style="padding:8px;border:1px solid var(--gaip-border);text-align:right;font-family:monospace;color:' + (balanceN >= 0 ? 'var(--gaip-success)' : 'var(--gaip-error)') + ';"><strong>' + (balanceN >= 0 ? '+' : '') + Math.round(balanceN) + '</strong></td>' +
                            '<td style="padding:8px;border:1px solid var(--gaip-border);text-align:right;font-family:monospace;color:' + (balanceP >= 0 ? 'var(--gaip-success)' : 'var(--gaip-error)') + ';"><strong>' + (balanceP >= 0 ? '+' : '') + (Math.round(balanceP * 10) / 10) + '</strong></td>' +
                            '<td style="padding:8px;border:1px solid var(--gaip-border);text-align:right;font-family:monospace;color:' + (balanceK >= 0 ? 'var(--gaip-success)' : 'var(--gaip-error)') + ';"><strong>' + (balanceK >= 0 ? '+' : '') + Math.round(balanceK) + '</strong></td>' +
                        '</tr>' +
                    '</tbody></table></div>' +
            '</div>';
        }
    };

    // ========================================================================
    // BOOTSTRAP
    // ========================================================================
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() { NutritionUkFertiliserIntegration.init(); });
    } else {
        NutritionUkFertiliserIntegration.init();
    }

    window.NutritionUkFertiliserIntegration = NutritionUkFertiliserIntegration;
    window.UkFertiliserRecommender = UkFertiliserRecommender;

})();
