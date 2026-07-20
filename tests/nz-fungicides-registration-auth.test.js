/**
 * NZ Fungicide Registration & Authorisation Tests
 *
 * Covers the corrections from the GAIP NZ Registration/Authorisation Model
 * spec (J. Spencer, 13 Jul 2026 / comment #87):
 *
 *   - Phantom product removal (Proplant)
 *   - A0: authorisation is never a gate (HSNO products must still appear)
 *   - R0: registration lives on the product, exact-match only
 *   - R0: per-product divergent labels (Atlantis Flo vs Azoxy 250 SC; Ippon vs Defence)
 *   - R1: multi-site classification (every component must be M-prefixed)
 *   - Data: propiconazole efficacy updates, Headway Maxx extended targets,
 *           mancozeb pythium:0, curvularia on Ippon 500SC only
 *   - Registration invariant: every product returned for a disease holds that
 *     disease in its own per-product targets list
 */

'use strict';

global.window   = global.window   || {};
global.document = global.document || { addEventListener: () => {}, documentElement: {}, querySelector: () => null };
global.console  = { group: () => {}, groupEnd: () => {}, groupCollapsed: () => {}, log: () => {}, warn: () => {}, info: () => {}, error: () => {} };

require('../assets/nz-fungicides.js');
const api = global.window.GAIP_NZ_FUNGICIDES;
const db  = api.db;

function tradesFor(disease) {
    return api.getProductsForDisease(disease).map(p => p.trade);
}

function productFor(disease, trade) {
    return api.getProductsForDisease(disease).find(p => p.trade === trade) || null;
}

function allTrades() {
    const trades = [];
    Object.values(db).forEach(entry => entry.products.forEach(p => trades.push(p.trade)));
    return trades;
}

// ─────────────────────────────────────────────────────────────────────────────
// Phantom product (Defect 3)
// ─────────────────────────────────────────────────────────────────────────────

describe('Phantom product removal', () => {
    test('Proplant is not in the database', () => {
        expect(allTrades()).not.toContain('Proplant');
    });

    test('Proplant does not appear for any disease', () => {
        const allDiseases = new Set();
        Object.values(db).forEach(e => e.targets.forEach(t => allDiseases.add(t)));
        for (const disease of allDiseases) {
            expect(tradesFor(disease)).not.toContain('Proplant');
        }
    });

    test('Condor (real propiconazole product) still present for dollar spot', () => {
        expect(tradesFor('dollarSpot')).toContain('Condor');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// A0 — authorisation is never a gate
// ─────────────────────────────────────────────────────────────────────────────

describe('A0 — HSNO-authorised products must be recommended', () => {
    test('Velista (HSNO) appears for fairy ring', () => {
        expect(tradesFor('fairyRing')).toContain('Velista');
    });

    test('Velista authorisation is HSNO', () => {
        const p = productFor('fairyRing', 'Velista');
        expect(p).not.toBeNull();
        expect(p.authorisation).toBe('HSNO');
    });

    test('Instrata Elite (HSNO HSR101610) appears for dollar spot', () => {
        expect(tradesFor('dollarSpot')).toContain('Instrata Elite');
    });

    test('Instrata Elite carries correct HSNO code', () => {
        const p = productFor('dollarSpot', 'Instrata Elite');
        expect(p).not.toBeNull();
        expect(p.authorisation).toBe('HSNO');
        expect(p.hsno).toBe('HSR101610');
        expect(p.acvm).toBeNull();
    });

    test('Procura (HSNO HSR000481) appears for pythium', () => {
        expect(tradesFor('pythium')).toContain('Procura');
    });

    test('Procura carries correct HSNO code', () => {
        const p = productFor('pythium', 'Procura');
        expect(p).not.toBeNull();
        expect(p.authorisation).toBe('HSNO');
        expect(p.hsno).toBe('HSR000481');
    });

    test('unresolved products (Fostonic, Supamanz) still appear in results', () => {
        expect(tradesFor('pythium')).toContain('Fostonic');
        expect(tradesFor('dollarSpot')).toContain('Supamanz');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// R0 — exact match: no substring matching
// ─────────────────────────────────────────────────────────────────────────────

describe('R0 — exact match gate', () => {
    test('leafSpot does not match grayLeafSpot', () => {
        // Atlantis Flo has grayLeafSpot but NOT leafSpot
        const leafSpotTrades = tradesFor('leafSpot');
        expect(leafSpotTrades).not.toContain('Atlantis Flo');
    });

    test('grayLeafSpot does not match leafSpot (Azoxy 250 SC has leafSpot, not only grayLeafSpot)', () => {
        // this verifies the two keys are independent
        const gsls = tradesFor('grayLeafSpot');
        const ls   = tradesFor('leafSpot');
        // Atlantis Flo: only grayLeafSpot
        expect(gsls).toContain('Atlantis Flo');
        expect(ls).not.toContain('Atlantis Flo');
    });

    test('dollarSpot does not match springDeadSpot', () => {
        const sds = tradesFor('springDeadSpot');
        // Unistar (boscalid) is registered only for dollarSpot — must not appear for SDS
        expect(sds).not.toContain('Unistar');
    });

    test('helminthosporium does not match takeAll', () => {
        // Velista is registered for helminthosporium but not takeAll
        expect(tradesFor('takeAll')).not.toContain('Velista');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// R0 — per-product divergent labels
// ─────────────────────────────────────────────────────────────────────────────

describe('R0 — Atlantis Flo vs Azoxy 250 SC (azoxystrobin label divergence)', () => {
    test('Atlantis Flo does NOT appear for dollar spot (label excludes it)', () => {
        expect(tradesFor('dollarSpot')).not.toContain('Atlantis Flo');
    });

    test('Atlantis Flo DOES appear for anthracnose', () => {
        expect(tradesFor('anthracnose')).toContain('Atlantis Flo');
    });

    test('Atlantis Flo appears for grayLeafSpot (R0 gate added this registration)', () => {
        expect(tradesFor('grayLeafSpot')).toContain('Atlantis Flo');
    });

    test('Azoxy 250 SC appears for leafSpot', () => {
        expect(tradesFor('leafSpot')).toContain('Azoxy 250 SC');
    });

    test('Azoxy 250 SC appears for grayLeafSpot', () => {
        expect(tradesFor('grayLeafSpot')).toContain('Azoxy 250 SC');
    });
});

describe('R0 — Ippon 500SC vs Defence (iprodione label divergence)', () => {
    test('Ippon 500SC appears for curvularia', () => {
        expect(tradesFor('curvularia')).toContain('Ippon 500SC');
    });

    test('Defence does NOT appear for curvularia (not on its label)', () => {
        expect(tradesFor('curvularia')).not.toContain('Defence');
    });

    test('both Ippon 500SC and Defence appear for dollar spot', () => {
        const ds = tradesFor('dollarSpot');
        expect(ds).toContain('Ippon 500SC');
        expect(ds).toContain('Defence');
    });

    test('Ippon 500SC ACVM code P005644', () => {
        const p = productFor('dollarSpot', 'Ippon 500SC');
        expect(p).not.toBeNull();
        expect(p.acvm).toBe('P005644');
        expect(p.authorisation).toBe('ACVM');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// R1 — multi-site classification
// ─────────────────────────────────────────────────────────────────────────────

describe('R1 — multi-site classification in rotation', () => {
    test('Taratek 5F (M05+1) is NOT classified as multi-site in rotation', () => {
        const rot = api.getRotationForDisease('dollarSpot');
        const taratek = rot.find(r => r.trade === 'Taratek 5F');
        // If present, must not carry the multi-site reason
        if (taratek) {
            expect(taratek.reason).not.toBe('Multi-site (low resistance risk)');
        }
    });

    test('Taratek 5F does not appear as multi-site for any disease in its targets', () => {
        for (const disease of db.chlorothalonilThiophanate.targets) {
            const rot = api.getRotationForDisease(disease);
            const taratek = rot.find(r => r.trade === 'Taratek 5F');
            if (taratek) {
                expect(taratek.reason).not.toBe('Multi-site (low resistance risk)');
            }
        }
    });

    test('Balear 720SC (M05, true multi-site) IS classified as multi-site in rotation', () => {
        const rot = api.getRotationForDisease('dollarSpot');
        const balear = rot.find(r => r.trade === 'Balear 720SC');
        expect(balear).not.toBeUndefined();
        expect(balear.reason).toBe('Multi-site (low resistance risk)');
    });

    test('Clarity (BM02 biological) is NOT classified as multi-site in rotation', () => {
        const rot = api.getRotationForDisease('dollarSpot');
        const clarity = rot.find(r => r.trade === 'Clarity');
        if (clarity) {
            expect(clarity.reason).not.toBe('Multi-site (low resistance risk)');
        }
    });

    test('Fostonic (P07 phosphonate) is NOT classified as multi-site in rotation', () => {
        const rot = api.getRotationForDisease('pythium');
        const fostonic = rot.find(r => r.trade === 'Fostonic');
        if (fostonic) {
            expect(fostonic.reason).not.toBe('Multi-site (low resistance risk)');
        }
    });

    test('Supamanz (M03, true multi-site) IS multi-site in rotation', () => {
        const rot = api.getRotationForDisease('dollarSpot');
        const supamanz = rot.find(r => r.trade === 'Supamanz');
        expect(supamanz).not.toBeUndefined();
        expect(supamanz.reason).toBe('Multi-site (low resistance risk)');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Data corrections
// ─────────────────────────────────────────────────────────────────────────────

describe('Propiconazole efficacy corrections (J. Spencer, 13 Jul 2026)', () => {
    test('Condor rust efficacy is 4 (was 2.5)', () => {
        const p = productFor('rust', 'Condor');
        expect(p).not.toBeNull();
        expect(p.efficacy).toBe(4);
    });

    test('Condor takeAll efficacy is 2.5 (was 2)', () => {
        const p = productFor('takeAll', 'Condor');
        expect(p).not.toBeNull();
        expect(p.efficacy).toBe(2.5);
    });
});

describe('Headway Maxx extended targets', () => {
    test('Headway Maxx appears for rust', () => {
        expect(tradesFor('rust')).toContain('Headway Maxx');
    });

    test('Headway Maxx appears for springDeadSpot', () => {
        expect(tradesFor('springDeadSpot')).toContain('Headway Maxx');
    });

    test('Headway Maxx appears for redThread', () => {
        expect(tradesFor('redThread')).toContain('Headway Maxx');
    });

    test('Headway Maxx appears for yellowPatch (label truth, no engine model)', () => {
        expect(tradesFor('yellowPatch')).toContain('Headway Maxx');
    });
});

describe('Mancozeb pythium:0 (load-bearing zero for R4)', () => {
    test('mancozeb efficacyNZ carries explicit 0 for pythium', () => {
        expect(db.mancozeb.efficacyNZ.pythium).toBe(0);
    });
});

describe('Chlorothalonil label targets', () => {
    test('Balear 720SC appears for leafSpot', () => {
        expect(tradesFor('leafSpot')).toContain('Balear 720SC');
    });

    test('Daconil Weather Stik appears for leafSpot', () => {
        expect(tradesFor('leafSpot')).toContain('Daconil Weather Stik');
    });

    test('Balear 720SC appears for grayLeafSpot', () => {
        expect(tradesFor('grayLeafSpot')).toContain('Balear 720SC');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Registration invariant (spec section 5.1)
// Every product returned for any disease must hold that disease in its own
// per-product targets list.
// ─────────────────────────────────────────────────────────────────────────────

describe('Registration invariant — R0 gate holds across every disease', () => {
    // Collect every disease key that appears in any per-product targets
    const allDiseases = new Set();
    Object.values(db).forEach(entry =>
        entry.products.forEach(p => {
            const tl = p.targets || entry.targets || [];
            tl.forEach(t => allDiseases.add(t));
        })
    );

    for (const disease of allDiseases) {
        test(`every product returned for '${disease}' is registered for it`, () => {
            const results = api.getProductsForDisease(disease);
            const norm = disease.toLowerCase().replace(/[_\s-]+/g, '').replace('microdochium', 'fusarium');
            results.forEach(result => {
                // Find the product's own targets list
                const entry = db[result.active];
                const prod  = entry.products.find(p => p.trade === result.trade);
                const tl    = (prod && prod.targets) ? prod.targets : entry.targets;
                const registered = tl.some(t =>
                    t.toLowerCase().replace(/[_\s-]+/g, '') === norm
                );
                expect(registered).toBe(true);
            });
        });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// Guard against over-correction (spec section 5.10)
// ─────────────────────────────────────────────────────────────────────────────

describe('Over-correction guard — no disease left with zero products', () => {
    const modelledDiseases = ['dollarSpot','brownPatch','fusarium','anthracnose','pythium','redThread'];

    modelledDiseases.forEach(disease => {
        test(`'${disease}' has at least one registered product`, () => {
            expect(api.getProductsForDisease(disease).length).toBeGreaterThan(0);
        });
    });
});
