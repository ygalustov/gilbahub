/**
 * UK Turf Fungicide Database
 * ==========================
 *
 * Sources:
 *   - UK HSE Pesticide Register (secure.pesticides.gov.uk/pestreg) — MAPP numbers
 *   - BCPC UK Pesticide Guide (UKPG) 2024/2025 approval updates
 *   - Syngenta UK Turf (syngentaturf.co.uk) — product labels & MAPP
 *   - BASF UK Agricentre (agricentre.basf.co.uk) — Maxtima, Insignia
 *   - Envu Environmental Science UK (uk.envu.com) — Dedicate
 *   - Agrovista Amenity (amenity.agrovista.co.uk) — product listings
 *   - BIGGA disease management guidance (bigga.org.uk)
 *   - Pan Amenity / Pan Agriculture product listings
 *
 * Version: 1.0.0
 * Last Updated: March 2026
 *
 * Structure mirrors FUNGICIDES_AU in au-fungicides.js for compatibility
 * with the FungicideFilter service (fungicide-filter.js).
 *
 * Registration authority: UK HSE CRD (Health & Safety Executive,
 *   Chemicals Regulation Division). Products identified by MAPP number
 *   (Ministerially Approved Plant Protection Product).
 *
 * Post-Brexit status: GB (Great Britain) and NI (Northern Ireland) now
 *   operate separate approval regimes. Where NI-only or GB-only
 *   restrictions apply they are noted in product notes. Products listed
 *   here are current for GB unless noted otherwise.
 *
 * CRITICAL REGULATORY CONTEXT — UK vs AU:
 *   Iprodione    — REVOKED for managed amenity turf (UK). Not listed.
 *   Chlorothalonil — REVOKED EU-wide 2019; withdrawn UK turf. Not listed.
 *   Propiconazole — Withdrawn UK turf 2019/2020 (EU SCoPAFF decision
 *                   followed by UK). Products such as Banner Maxx,
 *                   Instrata (original), Headway are no longer available.
 *   Instrata Elite replaces Instrata — fludioxonil + difenoconazole only
 *                   (chlorothalonil and propiconazole removed).
 *   Result: UK turf practitioners have only FOUR modes of action available
 *   (QoI, DMI, SDHI, phenylpyrrole) making resistance management critical.
 *
 * Mode of Action codes (FRAC):
 *   3  = DMI / Sterol synthesis inhibitors (triazoles)
 *   7  = SDHI / Succinate dehydrogenase inhibitors
 *  11  = QoI / Strobilurins
 *  12  = Phenylpyrroles
 *  M   = Multi-site (no single-site resistance risk)
 *
 * Resistance Risk: NR = No risk, L = Low, M = Medium, H = High
 *
 * Efficacy ratings (1–4 scale, 4 = most effective):
 *   Based on UK label claims, Syngenta/BASF/Envu UK trial data,
 *   STRI guidance, and BIGGA technical publications.
 *   0 = approved but insufficient published UK efficacy data.
 *   UK disease focus: fusarium (microdochium patch) dominates.
 *   Dollar spot, anthracnose, red thread, leaf spot are secondary targets.
 *   Brown patch and fairy ring are present but lower priority vs AU.
 *
 * Disease key alignment with au-fungicides.js / disease-engine.js:
 *   fusarium       = Microdochium patch (Microdochium nivale) — PRIMARY UK
 *   dollarSpot     = Dollar spot (Clarireedia spp.) — increasing UK incidence
 *   anthracnose    = Anthracnose (Colletotrichum cereale)
 *   redThread      = Red thread (Laetisaria fuciformis) — very common UK
 *   leafSpot       = Leaf spot / Helminthosporium (Drechslera spp.)
 *   brownPatch     = Brown patch (Rhizoctonia solani) — less common UK
 *   fairyRing      = Fairy ring (Type 2, Marasmius oreades etc.)
 *   takeAll        = Take-all patch (Gaeumannomyces graminis var. avenae)
 *   rust           = Rust (Puccinia spp.)
 *   pinkPatch      = Pink patch (Limonomyces roseipellis)
 *   pythium        = Pythium blight / Pythium root rot
 *
 * @version 1.0.0
 * @region UK
 * @registrationBody HSE CRD
 */

(function () {
    'use strict';

    // ========================================================================
    // FUNGICIDE DATABASE
    // ========================================================================

    var FUNGICIDES_UK = {

        // ---- FRAC GROUP 3: DMI Fungicides (Triazoles) ----

        tebuconazoleTrifloxystrobin: {
            // Mixture product; tebuconazole is the DMI component.
            // Registered on amenity grassland and managed amenity turf.
            // Key products: Dualitas (MAPP 18000, Bayer/Envu),
            //               Dedicate (MAPP 20307, Envu),
            //               ProKlass GB duplicate (MAPP ~20900-range, 2024 approval)
            // Propiconazole-era products (Headway, Banner Maxx) WITHDRAWN — do not use.
            frac: [3, 11],
            useCategory: 'professional',
            allowedUses: ['golf', 'sportsfield', 'amenity', 'bowling'],
            products: [
                {
                    trade: 'Dualitas',
                    mapp: '18000',
                    ai: '200 g/L tebuconazole + 100 g/L trifloxystrobin',
                    rate: '1 L/ha',
                    interval: '14-28',
                    distributor: 'Envu / Bayer',
                    notes: 'Contact + systemic. DMI + QoI dual mode. Max 2 apps/yr on managed turf.'
                },
                {
                    trade: 'Dedicate',
                    mapp: '20307',
                    ai: '200 g/L tebuconazole + 100 g/L trifloxystrobin',
                    rate: '1 L/ha',
                    interval: '14-28',
                    distributor: 'Envu',
                    notes: 'Parallel product to Dualitas. Same composition and label use pattern.'
                }
            ],
            targets: ['fusarium', 'dollarSpot', 'anthracnose', 'leafSpot', 'redThread', 'rust'],
            systemic: true,
            mode: 'DMI (sterol demethylation) + QoI (complex III respiration)',
            resistanceRisk: 'H',
            efficacyUK: {
                fusarium: 3,
                dollarSpot: 3,
                anthracnose: 2.5,
                leafSpot: 3,
                redThread: 2.5,
                rust: 2.5
            }
        },

        difenoconazoleFludioxonil: {
            // Instrata Elite — replacement for the original Instrata
            // (which contained chlorothalonil + propiconazole + fludioxonil,
            // now withdrawn). Instrata Elite is FRAC 3 + FRAC 12 only.
            // MAPP 17976, Syngenta UK Ltd.
            // Max 2 applications per year on managed amenity turf.
            // Approved: golf courses (greens, tees, fairways), enclosed
            // sports turf, bowling greens, managed amenity turf.
            frac: [3, 12],
            useCategory: 'professional',
            allowedUses: ['golf', 'sportsfield', 'amenity', 'bowling'],
            products: [
                {
                    trade: 'Instrata Elite',
                    mapp: '17976',
                    ai: '80.3 g/L difenoconazole + 80.3 g/L fludioxonil',
                    rate: '3 L/ha',
                    interval: '21-28',
                    distributor: 'Syngenta UK',
                    notes: 'Rainfast within 30 min. DMI + phenylpyrrole. Max 2 apps/yr.'
                }
            ],
            targets: ['fusarium', 'dollarSpot', 'anthracnose', 'brownPatch', 'leafSpot'],
            systemic: true,
            mode: 'DMI (sterol demethylation) + phenylpyrrole (osmoregulation)',
            resistanceRisk: 'M',
            efficacyUK: {
                fusarium: 4,
                dollarSpot: 3.5,
                anthracnose: 3,
                brownPatch: 3,
                leafSpot: 3.5
            }
        },

        benzovindiflupyrDifenoconazole: {
            // Ascernity — MAPP 19544, Syngenta UK Ltd.
            // Approved only on greens and tees of golf courses and
            // enclosed sports turf surfaces (NOT wider amenity).
            // Max 2 applications per year.
            // FRAC 7 (SDHI, Solatenol) + FRAC 3 (DMI).
            // Extended to 2/9/2026 per BCPC UKPG April 2024 update.
            frac: [7, 3],
            useCategory: 'professional',
            allowedUses: ['golf'],
            products: [
                {
                    trade: 'Ascernity',
                    mapp: '19544',
                    ai: '23.6 g/L benzovindiflupyr + 78.9 g/L difenoconazole',
                    rate: '2.5 L/ha',
                    interval: '21-28',
                    distributor: 'Syngenta UK',
                    notes: 'Golf greens and tees + enclosed sports turf only. SDHI + DMI dual mode. Max 2 apps/yr.'
                }
            ],
            targets: ['fusarium', 'dollarSpot', 'anthracnose'],
            systemic: true,
            mode: 'SDHI (succinate dehydrogenase inhibition) + DMI (sterol demethylation)',
            resistanceRisk: 'M',
            efficacyUK: {
                fusarium: 3.5,
                dollarSpot: 4,
                anthracnose: 3.5
            }
        },

        mefentrifluconazole: {
            // Maxtima — BASF. Mefentrifluconazole is a next-generation DMI
            // (isopropanol-azole) with superior binding to CYP51 target.
            // Approved for managed amenity turf (BCPC UKPG Aug 2023 entry).
            // Controls dollar spot and moderate control of microdochium patch.
            // No MAPP confirmed publicly; listed as PAR Aug 2023, now marketed.
            frac: 3,
            useCategory: 'professional',
            allowedUses: ['golf', 'sportsfield', 'amenity'],
            products: [
                {
                    trade: 'Maxtima',
                    mapp: 'see HSE register',
                    ai: 'mefentrifluconazole (concentration not publicly listed)',
                    rate: 'per label',
                    interval: '21-28',
                    distributor: 'BASF UK',
                    notes: 'Next-gen DMI. Excellent rotational partner vs older triazoles. 28-day residual claimed. Good resistance profile.'
                }
            ],
            targets: ['dollarSpot', 'fusarium', 'brownPatch', 'anthracnose', 'leafSpot'],
            systemic: true,
            mode: 'DMI (sterol demethylation), isopropanol-azole class',
            resistanceRisk: 'M',
            efficacyUK: {
                dollarSpot: 4,
                fusarium: 3,
                brownPatch: 3,
                anthracnose: 2.5,
                leafSpot: 3
            }
        },

        // ---- FRAC GROUP 11: QoI Fungicides (Strobilurins) ----

        azoxystrobin: {
            // Heritage — MAPP 17776 (500 g/kg WDG), Syngenta UK.
            // Also: Vanguard (pyraclostrobin-based parallel, Pan Amenity,
            // MAPP 20474 NI / MAPP 20846 GB, per BCPC April 2024) — listed
            // separately under pyraclostrobin below.
            // Heritage is systemic (acropetal), absorbed via roots/crown/leaves.
            // Notable: effective against take-all patch via root uptake.
            // Max applications per season: rotate FRAC groups per BIGGA guidance.
            frac: 11,
            useCategory: 'professional',
            allowedUses: ['golf', 'sportsfield', 'amenity', 'bowling'],
            products: [
                {
                    trade: 'Heritage',
                    mapp: '17776',
                    ai: '500 g/kg azoxystrobin WDG',
                    rate: '1 kg/ha',
                    interval: '14-28',
                    distributor: 'Syngenta UK',
                    notes: 'Systemic acropetal. Root uptake active against take-all patch. Broad spectrum preventive.'
                }
            ],
            targets: ['fusarium', 'takeAll', 'anthracnose', 'brownPatch', 'leafSpot', 'rust', 'fairyRing'],
            systemic: true,
            mode: 'QoI, complex III mitochondrial electron transport inhibition',
            resistanceRisk: 'H',
            efficacyUK: {
                fusarium: 3,
                takeAll: 3.5,
                anthracnose: 3,
                brownPatch: 3,
                leafSpot: 3,
                rust: 2.5,
                fairyRing: 2.5
            }
        },

        pyraclostrobin: {
            // Insignia — MAPP 19403, BASF UK. 200 g/L pyraclostrobin WDG.
            // Local penetrant (translaminar, NOT acropetal systemic).
            // Active against spore germination, penetration, mycelium growth,
            // and sporulation — broader life-stage coverage than azoxystrobin.
            // Rainfast within 1 hour. Approved managed amenity turf.
            // Vanguard (Pan Amenity MAPP 20474/20846) is a parallel product
            // also on managed amenity turf (BCPC April 2024).
            // Also: BAS 500 06 (MAPP 12338) re-registered as MAPP 21087
            // to 15/3/2028 (BCPC Dec 2024); Comet/Eland/Flyer etc re-registered
            // to 15/3/2029 (BCPC Nov 2025) — these are primarily arable labels
            // but confirm active continuation.
            frac: 11,
            useCategory: 'professional',
            allowedUses: ['golf', 'sportsfield', 'amenity', 'bowling'],
            products: [
                {
                    trade: 'Insignia',
                    mapp: '19403',
                    ai: '200 g/L pyraclostrobin',
                    rate: 'per label',
                    interval: '14-21',
                    distributor: 'BASF UK',
                    notes: 'Local penetrant. Active at cool temperatures (5–25°C). Intrinsic plant health benefit claimed. Rainfast 1hr.'
                },
                {
                    trade: 'Vanguard',
                    mapp: '20846',
                    ai: 'pyraclostrobin',
                    rate: 'per label',
                    interval: '14-21',
                    distributor: 'Pan Amenity',
                    notes: 'GB approval (MAPP 20846). NI approval MAPP 20474. Managed amenity turf only.'
                }
            ],
            targets: ['redThread', 'fusarium', 'dollarSpot', 'leafSpot', 'brownPatch', 'anthracnose'],
            systemic: false,
            mode: 'QoI, complex III mitochondrial electron transport inhibition (translaminar)',
            resistanceRisk: 'H',
            efficacyUK: {
                redThread: 3.5,
                fusarium: 3,
                dollarSpot: 3,
                leafSpot: 3,
                brownPatch: 2.5,
                anthracnose: 2.5
            }
        },

        // ---- FRAC GROUP 12: Phenylpyrroles ----

        fludioxonil: {
            // Medallion TL — MAPP 15287, Syngenta UK. 125 g/L fludioxonil SC.
            // Contact+ mode of action. Targets pathogens on leaf, in thatch,
            // and on soil surface. Not translocated systemically.
            // Osmoregulation disruption — pathogen cells rupture on contact.
            // Best suited to autumn–spring (cool conditions, slow turf growth).
            // Rainfast within hours but shorter residual than systemics (~7–14 days).
            // Approved: all managed turf, golf courses (greens, fairways, tees),
            // bowling greens, sports pitches.
            // PCS number 04188 for Ireland.
            frac: 12,
            useCategory: 'professional',
            allowedUses: ['golf', 'sportsfield', 'amenity', 'bowling'],
            products: [
                {
                    trade: 'Medallion TL',
                    mapp: '15287',
                    ai: '125 g/L fludioxonil SC',
                    rate: '3 L/ha',
                    interval: '14-21',
                    distributor: 'Syngenta UK',
                    notes: 'Contact+ protectant. Best in autumn–spring. 7–10 day residual. No systemic curative activity. Broad label for all managed turf.'
                }
            ],
            targets: ['fusarium', 'leafSpot', 'anthracnose'],
            systemic: false,
            mode: 'Phenylpyrrole, osmoregulation disruption (MAP-kinase pathway)',
            resistanceRisk: 'L',
            efficacyUK: {
                fusarium: 3.5,
                leafSpot: 3,
                anthracnose: 2.5
            }
        },

        // ---- MULTI-ACTIVE COMBINATION PRODUCTS (Filed under primary FRAC) ----
        // Note: these are mixture-first products marketed as single SKUs;
        // the single-AI entries above (fludioxonil, difenoconazole) are also
        // present as components in Instrata Elite. Listed here to capture
        // products that don't map cleanly to a single AI key.

        // No further standalone multi-active products currently approved on
        // managed turf in GB that aren't already captured above.
        // Historical note: cyprodinil + fludioxonil (Ludo, MAPP 20815 GB /
        // MAPP 20276 NI) was re-approved per BCPC March 2024 for GB —
        // this is primarily for disease in arable contexts, not turf.
        // Not listed here.

        // ---- MANCOZEB / MULTI-SITE CONTACT ----
        // NOTE: Chlorothalonil (the only multi-site registered for UK turf
        // prior to 2019) is now REVOKED. Mancozeb and other multi-sites
        // do NOT have UK managed amenity turf approval.
        // This is the single biggest difference vs AU and NZ databases.
        // flagged here for FungicideFilter engine awareness:

        // NO_MULTISITE_CONTACT placeholder — for filter logic
        // Do NOT add an entry here; this comment is for maintenance awareness only.
    };

    // ========================================================================
    // WITHDRAWN / REVOKED PRODUCTS
    // For reference and UI warnings — not in the active database
    // ========================================================================

    var WITHDRAWN_UK = {
        iprodione: {
            status: 'revoked',
            reason: 'EU/GB regulatory review, no longer available for managed amenity turf',
            lastApproval: '2019',
            wasIn: ['dollarSpot', 'fusarium', 'brownPatch', 'leafSpot']
        },
        chlorothalonil: {
            status: 'revoked',
            reason: 'EU non-renewal 2019, UK followed. Was in Instrata original.',
            lastApproval: '2019',
            wasIn: ['fusarium', 'dollarSpot', 'anthracnose']
        },
        propiconazole: {
            status: 'revoked',
            reason: 'EU SCoPAFF non-renewal 2019; UK last use March 2020. Was in Banner Maxx, Instrata, Headway (all withdrawn).',
            lastApproval: '2020',
            wasIn: ['dollarSpot', 'fusarium', 'brownPatch', 'fairyRing', 'takeAll']
        }
    };

    // ========================================================================
    // HELPER FUNCTIONS
    // Mirrors au-fungicides.js API surface for FungicideFilter compatibility
    // ========================================================================

    /**
     * Get all products registered in the UK for a given disease.
     * Returns array sorted by efficacy desc, then resistance risk asc.
     */
    function getProductsForDisease(disease) {
        var results = [];
        var riskOrder = { 'NR': 0, 'L': 1, 'L-M': 2, 'M': 3, 'M-H': 4, 'H': 5 };

        for (var key in FUNGICIDES_UK) {
            var entry = FUNGICIDES_UK[key];
            if (entry.targets && entry.targets.indexOf(disease) !== -1) {
                entry.products.forEach(function (p) {
                    results.push({
                        active:            key,
                        trade:             p.trade,
                        mapp:              p.mapp || '',
                        ai:                p.ai || key,
                        frac:              entry.frac,
                        rate:              p.rate,
                        interval:          p.interval,
                        mode:              entry.mode,
                        systemic:          entry.systemic,
                        resistanceRisk:    entry.resistanceRisk || 'M',
                        distributor:       p.distributor || '',
                        notes:             p.notes || '',
                        allowedUses:       entry.allowedUses || [],
                        preventiveOnly:    entry.preventiveOnly || false,
                        curativePreferred: entry.curativePreferred || false,
                        efficacy:          entry.efficacyUK ? (entry.efficacyUK[disease] || 0) : 0
                    });
                });
            }
        }

        results.sort(function (a, b) {
            var ea = a.efficacy || 0, eb = b.efficacy || 0;
            if (eb !== ea) return eb - ea;
            return (riskOrder[a.resistanceRisk] || 3) - (riskOrder[b.resistanceRisk] || 3);
        });

        return results;
    }

    /**
     * Get active ingredients for a disease (used by fungicide-filter.js queryUKDatabase).
     * Returns format compatible with the FungicideFilter service.
     */
    function getActivesForDisease(disease) {
        var products = getProductsForDisease(disease);

        if (!products.length) {
            return {
                actives:          [],
                source:           'uk',
                registrationBody: 'HSE CRD',
                warnings: [
                    'No UK HSE-registered fungicides found for ' + disease + '.',
                    'Check secure.pesticides.gov.uk/pestreg for current approvals.',
                    'Note: chlorothalonil, propiconazole, and iprodione are revoked for managed turf in GB.'
                ]
            };
        }

        return {
            actives: products.map(function (p) {
                return {
                    active:         p.active,
                    type:           'primary',
                    fracGroup:      Array.isArray(p.frac)
                                        ? p.frac.map(String).join('+')
                                        : String(p.frac),
                    trade:          p.trade,
                    mapp:           p.mapp,
                    ai:             p.ai,
                    rate:           p.rate,
                    interval:       p.interval,
                    mode:           p.mode,
                    systemic:       p.systemic,
                    resistanceRisk: p.resistanceRisk,
                    distributor:    p.distributor,
                    efficacy:       p.efficacy,
                    notes:          p.notes,
                    allowedUses:    p.allowedUses
                };
            }),
            source:           'uk',
            registrationBody: 'HSE CRD'
        };
    }

    /**
     * Build a resistance-aware rotation for a given disease (max 4 steps).
     * Prioritises different FRAC groups. Mirrors au-fungicides.js pattern.
     */
    function getRotationForDisease(disease) {
        var products = getProductsForDisease(disease);
        var fracGroups = {};
        var rotation = [];

        products.forEach(function (p) {
            var fracKey = Array.isArray(p.frac)
                ? p.frac.map(String).join('+')
                : String(p.frac);
            if (!fracGroups[fracKey]) {
                fracGroups[fracKey] = p;
            }
        });

        var keys = Object.keys(fracGroups);

        // Multi-site first (FRAC M) if available — UK currently has NONE for turf
        keys.forEach(function (k) {
            if (k.indexOf('M') === 0 && rotation.length < 4) {
                rotation.push({
                    step:   rotation.length + 1,
                    trade:  fracGroups[k].trade,
                    frac:   k,
                    rate:   fracGroups[k].rate,
                    reason: 'FRAC M (multi-site) rotation, NOTE: no multi-site registered for UK turf'
                });
            }
        });

        // Then single-site by FRAC group
        keys.forEach(function (k) {
            if (k.indexOf('M') !== 0 && rotation.length < 4) {
                rotation.push({
                    step:   rotation.length + 1,
                    trade:  fracGroups[k].trade,
                    frac:   k,
                    rate:   fracGroups[k].rate,
                    reason: 'FRAC ' + k + ' rotation'
                });
            }
        });

        return rotation;
    }

    /**
     * Get all diseases with at least one UK-registered product.
     */
    function getSupportedDiseases() {
        var diseases = {};
        for (var key in FUNGICIDES_UK) {
            var entry = FUNGICIDES_UK[key];
            if (entry.targets) {
                entry.targets.forEach(function (d) { diseases[d] = true; });
            }
        }
        return Object.keys(diseases).sort();
    }

    /**
     * Validate a product trade name against the database.
     * For full HSE validation, query secure.pesticides.gov.uk/pestreg directly.
     */
    function validateProduct(tradeName) {
        for (var key in FUNGICIDES_UK) {
            var entry = FUNGICIDES_UK[key];
            for (var i = 0; i < entry.products.length; i++) {
                if (entry.products[i].trade.toLowerCase() === tradeName.toLowerCase()) {
                    return {
                        found:  true,
                        active: key,
                        frac:   entry.frac,
                        mapp:   entry.products[i].mapp,
                        entry:  entry.products[i]
                    };
                }
            }
        }
        return {
            found:      false,
            tradeName:  tradeName,
            suggestion: 'Check HSE Pesticide Register at secure.pesticides.gov.uk/pestreg'
        };
    }

    /**
     * Return warning if a product/active is known revoked in UK.
     * Used by spray log to flag legacy data entries.
     */
    function getWithdrawalWarning(activeOrTrade) {
        var lower = activeOrTrade.toLowerCase();
        var warnings = [];
        if (WITHDRAWN_UK[lower]) {
            var w = WITHDRAWN_UK[lower];
            warnings.push({
                active:  lower,
                status:  w.status,
                reason:  w.reason,
                message: activeOrTrade + ' is ' + w.status + ' for UK managed amenity turf. ' + w.reason
            });
        }
        // Check by trade name fragments
        var tradeMap = {
            'instrata': 'chlorothalonil+propiconazole',
            'banner': 'propiconazole',
            'headway': 'propiconazole',
            'voltar': 'iprodione',
            'chipco': 'iprodione'
        };
        for (var frag in tradeMap) {
            if (lower.indexOf(frag) !== -1) {
                warnings.push({
                    active:  tradeMap[frag],
                    status:  'revoked',
                    message: activeOrTrade + ' contained ' + tradeMap[frag] +
                             ', which is revoked for UK managed amenity turf. ' +
                             'Instrata Elite (difenoconazole + fludioxonil) is the approved replacement for Instrata.'
                });
            }
        }
        return warnings;
    }

    // ========================================================================
    // PUBLIC API
    // ========================================================================

    var UK_FUNGICIDES_API = {
        db:                    FUNGICIDES_UK,
        withdrawn:             WITHDRAWN_UK,
        getProductsForDisease: getProductsForDisease,
        getActivesForDisease:  getActivesForDisease,
        getRotationForDisease: getRotationForDisease,
        getSupportedDiseases:  getSupportedDiseases,
        validateProduct:       validateProduct,
        getWithdrawalWarning:  getWithdrawalWarning,
        version:               '1.0.0',
        region:                'UK',
        registrationBody:      'HSE CRD',
        source:                'HSE Pesticide Register (MAPP), BCPC UKPG 2024/2025, Syngenta UK, BASF UK, Envu UK, Agrovista Amenity, BIGGA',
        regulatoryNote:        'Chlorothalonil, propiconazole, and iprodione are revoked for managed amenity turf in GB. Only 4 modes of action currently available (FRAC 3, 7, 11, 12).'
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = UK_FUNGICIDES_API;
    }
    if (typeof window !== 'undefined') {
        window.GAIP_UK_FUNGICIDES = UK_FUNGICIDES_API;
    }

})();
