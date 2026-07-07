'use strict';
/**
 * Aitkens Sportsturf — UK Fertiliser Products
 *
 * Products sourced from aitkens.co.uk. Schema: UK convention (P as P2O5/K as K2O labels,
 * elemental stored in analysis). Rates in g/m2.
 * Auto-merges into GAIP_UK_FERTILISER when uk-fertiliser-products.js is loaded.
 *
 * 36 granular, 34 liquid
 * Suppliers: Aitkens own brand (Vision, Lawn Sand), Terralift distributor,
 *            Vitax distributor, Aquatrols distributor
 *
 * @package Gilba_Hub
 * @version 1.0.0
 */

(function() {
    'use strict';

    var AitkensProducts = {
    "granular": [
        {
            "id": "vision-ultimax-s-10-0-10",
            "name": "Vision Ultimax-S 10-0-10+3%MgO+9%CaO",
            "brand": "Vision Ultimax-S",
            "supplier": "aitkens",
            "form": "granular",
            "release": "slow",
            "surfaces": [
                "greens",
                "tees",
                "bowling",
                "fairways",
                "sports"
            ],
            "season": [
                "spring",
                "summer",
                "autumn"
            ],
            "analysis": {
                "N": 10,
                "P": 0,
                "K": 8.3,
                "Ca": 6.4,
                "Mg": 1.8,
                "Fe": 0
            },
            "npk_label": "10-0-10+3%MgO+9%CaO",
            "rates": {
                "greensMin": 25,
                "greensMax": 35,
                "fairwaysMin": 25,
                "fairwaysMax": 35,
                "sportsMin": 25,
                "sportsMax": 35
            },
            "rateUnit": "g/m²",
            "rates_kg_ha": {
                "greensMin": 250,
                "greensMax": 350,
                "fairwaysMin": 250,
                "fairwaysMax": 350,
                "sportsMin": 250,
                "sportsMax": 350
            },
            "interval_weeks": 6,
            "particleSize_mm": 2.0,
            "notes": "Composted food residue + Ascophyllum nodosum seaweed wrap. Spring/summer no-P formulation. High K + 3% MgO for photosynthesis. Mar-Oct. GRANULE SIZE: page copy describes 'granule' without specific size band. SDS Section 9 (Physical & Chemical Properties) confirms 'Homogenous granule, brown' with specific gravity 760 g/L (bulk density 760 kg/m3) and pH 6.5-7.2. The 760 g/L bulk density is in the typical range for medium-grade composted food-residue + seaweed granules (industry typical 700-850 g/L for 1-3 mm composted granules). particleSize_mm = 2.0 recorded as midpoint of 1-3 mm range supported by bulk density evidence. SDS source: ultimax-s_8-2-8_sds.pdf (Aitkens Sportsturf Ltd, issue date 22 Feb 2018).",
            "verified": true,
            "nForm": "organic",
            "nFormConfidence": "auto",
            "nFormReason": "Page copy describes 'controlled composting of food residues + Ascophyllum nodosum seaweed' = organic N carrier. SDS confirms <10% iron sulphate as the only synthetic ingredient; balance is composted organic + seaweed. nForm: organic with low volatilisation risk."
        },
        {
            "id": "vision-ultimax-s-8-2-8",
            "name": "Vision Ultimax-S 8-2-8+3%MgO+2%Fe+9%CaO",
            "brand": "Vision Ultimax-S",
            "supplier": "aitkens",
            "form": "granular",
            "release": "slow",
            "surfaces": [
                "greens",
                "tees",
                "bowling",
                "fairways",
                "sports"
            ],
            "season": [
                "winter",
                "spring",
                "summer",
                "autumn"
            ],
            "analysis": {
                "N": 8,
                "P": 0.87,
                "K": 6.6,
                "Ca": 6.4,
                "Mg": 1.8,
                "Fe": 2
            },
            "npk_label": "8-2-8+3%MgO+2%Fe+9%CaO",
            "rates": {
                "greensMin": 25,
                "greensMax": 35,
                "fairwaysMin": 25,
                "fairwaysMax": 35,
                "sportsMin": 25,
                "sportsMax": 35
            },
            "rateUnit": "g/m²",
            "rates_kg_ha": {
                "greensMin": 200,
                "greensMax": 280,
                "fairwaysMin": 200,
                "fairwaysMax": 280,
                "sportsMin": 200,
                "sportsMax": 280
            },
            "interval_weeks": 6,
            "particleSize_mm": 2.0,
            "notes": "Composted food residue + seaweed wrap. Growing season feed with Fe hardening. Humic acid for stress tolerance. Feb-Nov. GRANULE SIZE: page copy describes 'granule' without specific size band. SDS Section 9 (Physical & Chemical Properties) confirms 'Homogenous granule, brown' with specific gravity 760 g/L (bulk density 760 kg/m3) and pH 6.5-7.2. The 760 g/L bulk density is in the typical range for medium-grade composted food-residue + seaweed granules (industry typical 700-850 g/L for 1-3 mm composted granules). particleSize_mm = 2.0 recorded as midpoint of 1-3 mm range supported by bulk density evidence. SDS source: ultimax-s_8-2-8_sds.pdf (Aitkens Sportsturf Ltd, issue date 22 Feb 2018).",
            "verified": true,
            "nForm": "organic",
            "nFormConfidence": "auto",
            "nFormReason": "Page copy describes 'controlled composting of food residues + Ascophyllum nodosum seaweed' = organic N carrier. SDS confirms <10% iron sulphate as the only synthetic ingredient; balance is composted organic + seaweed. nForm: organic with low volatilisation risk."
        },
        {
            "id": "vision-ultimax-s-5-4-12",
            "name": "Vision Ultimax-S 5-4-12+1%MgO+8%CaO",
            "brand": "Vision Ultimax-S",
            "supplier": "aitkens",
            "form": "granular",
            "release": "slow",
            "surfaces": [
                "greens",
                "tees",
                "bowling",
                "fairways",
                "sports"
            ],
            "season": [
                "winter",
                "spring",
                "summer",
                "autumn"
            ],
            "analysis": {
                "N": 5,
                "P": 1.75,
                "K": 9.96,
                "Ca": 5.7,
                "Mg": 0.6,
                "Fe": 0
            },
            "npk_label": "5-4-12+1%MgO+8%CaO",
            "rates": {
                "greensMin": 25,
                "greensMax": 35,
                "fairwaysMin": 25,
                "fairwaysMax": 35,
                "sportsMin": 25,
                "sportsMax": 35
            },
            "rateUnit": "g/m²",
            "rates_kg_ha": {
                "greensMin": 125,
                "greensMax": 175,
                "fairwaysMin": 125,
                "fairwaysMax": 175,
                "sportsMin": 125,
                "sportsMax": 175
            },
            "interval_weeks": 6,
            "particleSize_mm": 2.0,
            "notes": "Composted food residue + seaweed wrap. Autumn/early-season feed. High K hardens soft growth, P for rooting. Jan-Dec. GRANULE SIZE: page copy describes 'granule' without specific size band. SDS Section 9 (Physical & Chemical Properties) confirms 'Homogenous granule, brown' with specific gravity 760 g/L (bulk density 760 kg/m3) and pH 6.5-7.2. The 760 g/L bulk density is in the typical range for medium-grade composted food-residue + seaweed granules (industry typical 700-850 g/L for 1-3 mm composted granules). particleSize_mm = 2.0 recorded as midpoint of 1-3 mm range supported by bulk density evidence. SDS source: ultimax-s_8-2-8_sds.pdf (Aitkens Sportsturf Ltd, issue date 22 Feb 2018).",
            "verified": true,
            "nForm": "organic",
            "nFormConfidence": "auto",
            "nFormReason": "Page copy describes 'controlled composting of food residues + Ascophyllum nodosum seaweed' = organic N carrier. SDS confirms <10% iron sulphate as the only synthetic ingredient; balance is composted organic + seaweed. nForm: organic with low volatilisation risk."
        },
        {
            "id": "vision-nutri-smart-4-0-10",
            "name": "Vision Nutri-Smart 4-0-10+11%Fe+4.7%CaO+RSi+Amino+Lig+TE",
            "brand": "Vision Nutri-Smart",
            "supplier": "aitkens",
            "form": "granular",
            "release": "conventional",
            "surfaces": [
                "greens",
                "tees",
                "bowling",
                "fairways",
                "sports"
            ],
            "season": [
                "autumn",
                "winter",
                "spring"
            ],
            "analysis": {
                "N": 4,
                "P": 0,
                "K": 8.3,
                "Ca": 3.36,
                "Mg": 0,
                "Fe": 11
            },
            "npk_label": "4-0-10+11Fe+4.7CaO",
            "rates": {
                "greensMin": 30,
                "greensMax": 35,
                "fairwaysMin": 30,
                "fairwaysMax": 35,
                "sportsMin": 30,
                "sportsMax": 35
            },
            "rateUnit": "g/m²",
            "rates_kg_ha": {
                "greensMin": 300,
                "greensMax": 350,
                "fairwaysMin": 300,
                "fairwaysMax": 350,
                "sportsMin": 300,
                "sportsMax": 350
            },
            "interval_weeks": 8,
            "particleSize_mm": 1.5,
            "notes": "1-2mm micro granule. Lignite + RSi humic + amino acid + TE. Moss-deterrent + disease support. Sep-Apr.",
            "verified": true,
            "nForm": "mixed",
            "nFormConfidence": "auto",
            "nFormReason": "Product page declares N breakdown 75% ammoniacal / 25% ureic."
        },
        {
            "id": "vision-nutri-smart-4-4-20",
            "name": "Vision Nutri-Smart 4-4-20+3%Fe+3%MgO+7.1%CaO+Kali+RSi+Amino+Lig+TE",
            "brand": "Vision Nutri-Smart",
            "supplier": "aitkens",
            "form": "granular",
            "release": "slow",
            "surfaces": [
                "greens",
                "tees",
                "bowling",
                "fairways",
                "sports"
            ],
            "season": [
                "spring",
                "summer",
                "autumn"
            ],
            "analysis": {
                "N": 4,
                "P": 1.75,
                "K": 16.6,
                "Ca": 5.07,
                "Mg": 1.81,
                "Fe": 3
            },
            "npk_label": "4-4-20+3Fe+3MgO+7.1CaO",
            "rates": {
                "greensMin": 30,
                "greensMax": 35,
                "fairwaysMin": 30,
                "fairwaysMax": 35,
                "sportsMin": 30,
                "sportsMax": 35
            },
            "rateUnit": "g/m²",
            "rates_kg_ha": {
                "greensMin": 300,
                "greensMax": 350,
                "fairwaysMin": 300,
                "fairwaysMax": 350,
                "sportsMin": 300,
                "sportsMax": 350
            },
            "interval_weeks": 8,
            "particleSize_mm": 1.5,
            "notes": "1-2mm micro granule. Standard + Kali slow-release K combination for consistent release. Base feed + Fe hardening.",
            "verified": true,
            "nForm": "mixed",
            "nFormConfidence": "auto",
            "nFormReason": "Product page declares N breakdown 50% ammoniacal / 50% ureic."
        },
        {
            "id": "vision-nutri-smart-6-6-10",
            "name": "Vision Nutri-Smart 6-6-10+3%MgO+12.8%CaO+RSi+Amino+Lig+TE",
            "brand": "Vision Nutri-Smart",
            "supplier": "aitkens",
            "form": "granular",
            "release": "conventional",
            "surfaces": [
                "greens",
                "tees",
                "bowling",
                "fairways",
                "sports"
            ],
            "season": [
                "spring",
                "summer",
                "autumn",
                "winter"
            ],
            "analysis": {
                "N": 6,
                "P": 2.62,
                "K": 8.3,
                "Ca": 9.15,
                "Mg": 1.81,
                "Fe": 0
            },
            "npk_label": "6-6-10+3MgO+12.8CaO",
            "rates": {
                "greensMin": 30,
                "greensMax": 35,
                "fairwaysMin": 30,
                "fairwaysMax": 35,
                "sportsMin": 30,
                "sportsMax": 35
            },
            "rateUnit": "g/m²",
            "rates_kg_ha": {
                "greensMin": 300,
                "greensMax": 350,
                "fairwaysMin": 300,
                "fairwaysMax": 350,
                "sportsMin": 300,
                "sportsMax": 350
            },
            "interval_weeks": 8,
            "particleSize_mm": 1.5,
            "notes": "1-2mm micro granule. 100% Ammoniacal N — no urea, rapid response in low soil temps. No ferrous sulphate (safe pre-seeder for fescue/bent oversowing). Page: Jan-Dec. Nutrient applied at 30 g/m2: N 18, P 18, K 30 kg/ha; at 35 g/m2: N 21, P 21, K 35 kg/ha. Source: aitkens.co.uk Vision Nutri-Smart 6-6-10 product page.",
            "verified": true,
            "nForm": "ammonium",
            "nFormConfidence": "auto",
            "nFormReason": "Product page declares N breakdown 100% Ammoniacal. Zero volatilisation risk (ammonium sulphate-based chemistry)."
        },
        {
            "id": "vision-nutri-smart-8-0-12",
            "name": "Vision Nutri-Smart 8-0-12+2%Fe+4%MgO+7.7%CaO+RSi+Amino+Lig+TE",
            "brand": "Vision Nutri-Smart",
            "supplier": "aitkens",
            "form": "granular",
            "release": "conventional",
            "surfaces": [
                "greens",
                "tees",
                "bowling",
                "fairways",
                "sports"
            ],
            "season": [
                "spring",
                "summer",
                "autumn"
            ],
            "analysis": {
                "N": 8,
                "P": 0,
                "K": 9.96,
                "Ca": 5.5,
                "Mg": 2.41,
                "Fe": 2
            },
            "npk_label": "8-0-12+2Fe+4MgO+7.7CaO",
            "rates": {
                "greensMin": 30,
                "greensMax": 35,
                "fairwaysMin": 30,
                "fairwaysMax": 35,
                "sportsMin": 30,
                "sportsMax": 35
            },
            "rateUnit": "g/m²",
            "rates_kg_ha": {
                "greensMin": 300,
                "greensMax": 350,
                "fairwaysMin": 300,
                "fairwaysMax": 350,
                "sportsMin": 300,
                "sportsMax": 350
            },
            "interval_weeks": 8,
            "particleSize_mm": 1.5,
            "notes": "1-2mm micro granule. Two N sources (ammoniacal + ureic) deter flushed growth. Iron-supplemented growing-season NK. Page: Feb-Nov. Nutrient applied at 30 g/m2: N 24, P 0, K 36 kg/ha; at 35 g/m2: N 28, P 0, K 42 kg/ha. Source: aitkens.co.uk Vision Nutri-Smart 8-0-12 product page.",
            "verified": true,
            "nForm": "mixed",
            "nFormConfidence": "auto",
            "nFormReason": "Product page declares N breakdown 81% Ammoniacal / 19% Ureic. Low volatilisation risk (small urea share)."
        },
        {
            "id": "vision-nutri-smart-12-2-10",
            "name": "Vision Nutri-Smart 12-2-10+3%MgO+3%CaO+RSi+Amino+Lig+TE",
            "brand": "Vision Nutri-Smart",
            "supplier": "aitkens",
            "form": "granular",
            "release": "conventional",
            "surfaces": [
                "greens",
                "tees",
                "bowling",
                "fairways",
                "sports"
            ],
            "season": [
                "spring",
                "summer"
            ],
            "analysis": {
                "N": 12,
                "P": 0.87,
                "K": 8.3,
                "Ca": 2.14,
                "Mg": 1.81,
                "Fe": 0
            },
            "npk_label": "12-2-10+3MgO+3CaO",
            "rates": {
                "greensMin": 30,
                "greensMax": 35,
                "fairwaysMin": 30,
                "fairwaysMax": 35,
                "sportsMin": 30,
                "sportsMax": 35
            },
            "rateUnit": "g/m²",
            "rates_kg_ha": {
                "greensMin": 300,
                "greensMax": 350,
                "fairwaysMin": 300,
                "fairwaysMax": 350,
                "sportsMin": 300,
                "sportsMax": 350
            },
            "interval_weeks": 8,
            "particleSize_mm": 1.5,
            "notes": "1-2mm micro granule. High-N main-season feed without excessive growth. Mg for colour. Page: Mar-Sep. Nutrient applied at 30 g/m2: N 36, P 6, K 30 kg/ha; at 35 g/m2: N 42, P 7, K 35 kg/ha. Source: aitkens.co.uk Vision Nutri-Smart 12-2-10 product page.",
            "verified": true,
            "nForm": "mixed",
            "nFormConfidence": "auto",
            "nFormReason": "Product page declares N breakdown 80% Ammoniacal / 20% Ureic. Low volatilisation risk."
        },
        {
            "id": "vision-nutri-smart-wfm",
            "name": "Vision Nutri-Smart Weed, Feed & Mosskiller (MAPP 21252)",
            "brand": "Vision Nutri-Smart",
            "supplier": "aitkens",
            "form": "granular",
            "release": "conventional",
            "surfaces": [
                "fairways",
                "sportsfields",
                "lawns"
            ],
            "season": [
                "spring",
                "summer",
                "autumn"
            ],
            "analysis": {
                "N": 10,
                "P": 0.87,
                "K": 1.66,
                "Ca": 0,
                "Mg": 0,
                "Fe": 8
            },
            "npk_label": "10-2-2 + 8% Fe + 2,4-D + dicamba + mecoprop-P (MAPP 21252)",
            "rates": {
                "fairwaysMin": 32,
                "fairwaysMax": 32,
                "sportsMin": 32,
                "sportsMax": 32
            },
            "rateUnit": "g/m²",
            "rates_kg_ha": {
                "fairwaysMin": 320,
                "fairwaysMax": 320,
                "sportsMin": 320,
                "sportsMax": 320
            },
            "interval_weeks": 8,
            "particleSize_mm": 1.75,
            "notes": "1-2.5mm micro granule. Combined fertiliser + moss control (8% Fe) + 3-way broadleaf herbicide mix (2,4-D + dicamba + mecoprop-P, HRAC group O / 4). 20 kg pack covers 625 m2 at 32 g/m2 (= 32 kg N/ha, 6.4 kg P/ha, 6.4 kg K/ha kg/ha-equivalent at 320 kg product/ha). Feb-Oct. MAPP 21252 — GB Professional-use authorisation. Source: aitkens.co.uk Vision Nutri-Smart Weed Feed Mosskiller product page.",
            "verified": true,
            "nForm": "mixed",
            "nFormConfidence": "auto",
            "nFormReason": "Page declares N breakdown 85% Ammoniacal / 15% Ureic. Low volatilisation risk (urea share small)."
        },
        {
            "id": "aitkens-lawn-sand",
            "name": "Aitkens Lawn Sand (5-0-0+2.9%Fe)",
            "brand": "Aitkens Lawn Sand",
            "supplier": "aitkens",
            "form": "powder",
            "release": "quick",
            "surfaces": [
                "fairways",
                "sportsfields",
                "lawns"
            ],
            "season": [
                "spring"
            ],
            "analysis": {
                "N": 5,
                "P": 0,
                "K": 0,
                "Ca": 0,
                "Mg": 0,
                "Fe": 2.9
            },
            "npk_label": "5-0-0 + 2.9% Fe (MAPP 05253)",
            "rates": {
                "fairwaysMin": 35,
                "fairwaysMax": 140,
                "sportsMin": 35,
                "sportsMax": 140
            },
            "rateUnit": "g/m²",
            "rates_kg_ha": {
                "fairwaysMin": 350,
                "fairwaysMax": 1400,
                "sportsMin": 350,
                "sportsMax": 1400
            },
            "interval_weeks": 26,
            "particleSize_mm": null,
            "notes": "Powder. 20 kg pack covers 142-571 m2 at 35-140 g/m2. Page declares 34 kg N/ha at max rate (= 5% N at 140 g/m2 ÷ 2 typo on page, actual is 70 kg N/ha; figure on page may be at mid-rate). Moss control via ferrous sulphate. SDS (sds_AITLAWN.pdf) confirms ammonium ion adsorbed by soil. MAPP 05253 registered for Professional use in UK. Source: aitkens.co.uk Aitkens Lawn Sand product page + SDS. FORM=POWDER — particleSize_mm not applicable; engine should route by form attribute, not by size.",
            "verified": true,
            "nForm": "ammonium",
            "nFormConfidence": "sds",
            "nFormReason": "Ammonium sulphate carrier (SDS confirms ammonium ion). 100% ammoniacal. Zero volatilisation risk; acidifying via nitrification."
        },
        {
            "id": "aitkens-lawn-sand-plus",
            "name": "Aitkens Lawn Sand Plus (3-0-0+7%Fe)",
            "brand": "Aitkens Lawn Sand",
            "supplier": "aitkens",
            "form": "powder",
            "release": "quick",
            "surfaces": [
                "fairways",
                "sportsfields",
                "lawns"
            ],
            "season": [
                "spring"
            ],
            "analysis": {
                "N": 3,
                "P": 0,
                "K": 0,
                "Ca": 0,
                "Mg": 0,
                "Fe": 7
            },
            "npk_label": "3-0-0 + 7% Fe (MAPP product)",
            "rates": {
                "fairwaysMin": 35,
                "fairwaysMax": 70,
                "sportsMin": 35,
                "sportsMax": 70
            },
            "rateUnit": "g/m²",
            "rates_kg_ha": {
                "fairwaysMin": 350,
                "fairwaysMax": 700,
                "sportsMin": 350,
                "sportsMax": 700
            },
            "interval_weeks": 26,
            "particleSize_mm": null,
            "notes": "Powder. 25 kg pack covers 357-714 m2 at 35-70 g/m2. Page declares 21 kg N/ha at max rate. Higher Fe (7%) than standard Aitkens Lawn Sand (2.9%) — lower N share, more aggressive moss control. Page header has template leftover citing the 5-0-0 product; the body and image confirm 3-0-0+7%Fe. Pesticide registration notice present. Source: aitkens.co.uk Aitkens Lawn Sand Plus product page. FORM=POWDER — particleSize_mm not applicable; engine should route by form attribute, not by size.",
            "verified": true,
            "nForm": "ammonium",
            "nFormConfidence": "auto",
            "nFormReason": "Ammonium sulphate carrier (same chemistry family as Aitkens Lawn Sand confirmed by SDS). 100% ammoniacal. Acidifying."
        },
        {
            "id": "vision-reward-crf-22-5-10",
            "name": "Vision Reward CRF 22-5-10+Mg+Ca (4-5 Month)",
            "brand": "Vision Reward CRF",
            "supplier": "aitkens",
            "form": "granular",
            "release": "controlled",
            "surfaces": [
                "fairways",
                "sports"
            ],
            "season": [
                "spring",
                "summer",
                "autumn",
                "winter"
            ],
            "analysis": {
                "N": 22,
                "P": 2.18,
                "K": 8.3,
                "Ca": 0.71,
                "Mg": 1.81,
                "Fe": 0
            },
            "npk_label": "22-5-10+MgO+CaO",
            "rates": {
                "fairwaysMin": 25,
                "fairwaysMax": 35,
                "sportsMin": 25,
                "sportsMax": 35
            },
            "rateUnit": "g/m²",
            "rates_kg_ha": {
                "fairwaysMin": 250,
                "fairwaysMax": 350,
                "sportsMin": 250,
                "sportsMax": 350
            },
            "interval_weeks": 18,
            "particleSize_mm": 1.5,
            "notes": "1-2mm CRF. 4-5 month release. 65% polymer-coated N (PolyEdge platform — SDS confirms polyedge_22-5-10_msds.pdf). High-K turf hardener for autumn/winter, year-round use. Page: Jan-Dec. Nutrient applied at 30 g/m2: N 66, P 15, K 30 kg/ha. Source: aitkens.co.uk Vision Reward CRF 22-5-10 product page.",
            "verified": true,
            "nForm": "urea_pcu",
            "nFormConfidence": "auto",
            "nFormReason": "PolyEdge polymer-coated urea (SDS confirms). 65% coated N (slow release), 35% conventional. Very low volatilisation — coating controls release; conventional fraction is likely ammoniacal."
        },
        {
            "id": "vision-reward-crf-13-5-20",
            "name": "Vision Reward CRF 13-5-20+Mg+Ca (4-5 Month)",
            "brand": "Vision Reward CRF",
            "supplier": "aitkens",
            "form": "granular",
            "release": "controlled",
            "surfaces": [
                "fairways",
                "sports"
            ],
            "season": [
                "spring",
                "summer",
                "autumn",
                "winter"
            ],
            "analysis": {
                "N": 13,
                "P": 2.18,
                "K": 16.6,
                "Ca": 0,
                "Mg": 1.81,
                "Fe": 0
            },
            "npk_label": "13-5-20+3MgO",
            "rates": {
                "fairwaysMin": 25,
                "fairwaysMax": 35,
                "sportsMin": 25,
                "sportsMax": 35
            },
            "rateUnit": "g/m²",
            "rates_kg_ha": {
                "fairwaysMin": 250,
                "fairwaysMax": 350,
                "sportsMin": 250,
                "sportsMax": 350
            },
            "interval_weeks": 18,
            "particleSize_mm": 1.5,
            "notes": "1-2mm CRF. 4-5 month release. 65% polymer-coated N (PolyEdge — SDS polyedge_13-5-20_msds.pdf). High-K stress / autumn-winter hardener. Page: Jan-Dec. Nutrient applied at 30 g/m2: N 39, P 15, K 60 kg/ha. Source: aitkens.co.uk Vision Reward CRF 13-5-20 product page.",
            "verified": true,
            "nForm": "urea_pcu",
            "nFormConfidence": "auto",
            "nFormReason": "PolyEdge polymer-coated urea. 65% coated N. Very low volatilisation."
        },
        {
            "id": "vision-reward-crf-21-3-14",
            "name": "Vision Reward CRF 21-3-14+3%MgO (3-4 Month)",
            "brand": "Vision Reward CRF",
            "supplier": "aitkens",
            "form": "granular",
            "release": "controlled",
            "surfaces": [
                "fairways",
                "sports"
            ],
            "season": [
                "spring",
                "summer"
            ],
            "analysis": {
                "N": 21,
                "P": 1.31,
                "K": 11.62,
                "Ca": 0,
                "Mg": 1.81,
                "Fe": 0
            },
            "npk_label": "21-3-14+3MgO",
            "rates": {
                "fairwaysMin": 25,
                "fairwaysMax": 35,
                "sportsMin": 25,
                "sportsMax": 35
            },
            "rateUnit": "g/m²",
            "rates_kg_ha": {
                "fairwaysMin": 250,
                "fairwaysMax": 350,
                "sportsMin": 250,
                "sportsMax": 350
            },
            "interval_weeks": 14,
            "particleSize_mm": 1.5,
            "notes": "1-2mm CRF. 3-4 month release. 45% polymer-coated N (PolyEdge — SDS polyedge_21-3-14_msds.pdf). Main-season balanced growth. Page: Mar-Sep. Nutrient applied at 30 g/m2: N 63, P 9, K 42 kg/ha. Source: aitkens.co.uk Vision Reward CRF 21-3-14 product page.",
            "verified": true,
            "nForm": "urea_pcu",
            "nFormConfidence": "auto",
            "nFormReason": "PolyEdge polymer-coated urea. 45% coated N. Low volatilisation; remaining 55% conventional (likely ammoniacal-dominant) is well-buffered."
        },
        {
            "id": "vision-reward-crf-17-7-12",
            "name": "Vision Reward CRF 17-7-12+1%Fe+3%MgO (3-4 Month)",
            "brand": "Vision Reward CRF",
            "supplier": "aitkens",
            "form": "granular",
            "release": "controlled",
            "surfaces": [
                "fairways",
                "sports"
            ],
            "season": [
                "spring",
                "summer",
                "autumn"
            ],
            "analysis": {
                "N": 17,
                "P": 3.05,
                "K": 9.96,
                "Ca": 0,
                "Mg": 1.81,
                "Fe": 1
            },
            "npk_label": "17-7-12+1Fe+3MgO",
            "rates": {
                "fairwaysMin": 25,
                "fairwaysMax": 35,
                "sportsMin": 25,
                "sportsMax": 35
            },
            "rateUnit": "g/m²",
            "rates_kg_ha": {
                "fairwaysMin": 250,
                "fairwaysMax": 350,
                "sportsMin": 250,
                "sportsMax": 350
            },
            "interval_weeks": 14,
            "particleSize_mm": 1.5,
            "notes": "1-2mm CRF. 3-4 month release. 45% polymer-coated N (PolyEdge — SDS polyedge_17-7-12_msds.pdf). Spring-autumn balanced NPK with Fe + Mg. Page: Mar-Oct. Nutrient applied at 30 g/m2: N 51, P 21, K 48 kg/ha. Source: aitkens.co.uk Vision Reward CRF 17-7-12 product page.",
            "verified": true,
            "nForm": "urea_pcu",
            "nFormConfidence": "auto",
            "nFormReason": "PolyEdge polymer-coated urea. 45% coated N. Low volatilisation."
        },
        {
            "id": "vision-reward-crf-15-15-5",
            "name": "Vision Reward CRF 15-15-5+3%MgO (3-4 Month)",
            "brand": "Vision Reward CRF",
            "supplier": "aitkens",
            "form": "granular",
            "release": "controlled",
            "surfaces": [
                "fairways",
                "sports"
            ],
            "season": [
                "spring",
                "summer",
                "autumn"
            ],
            "analysis": {
                "N": 15,
                "P": 6.54,
                "K": 4.15,
                "Ca": 0,
                "Mg": 1.81,
                "Fe": 0
            },
            "npk_label": "15-15-5+3MgO",
            "rates": {
                "fairwaysMin": 25,
                "fairwaysMax": 35,
                "sportsMin": 25,
                "sportsMax": 35
            },
            "rateUnit": "g/m²",
            "rates_kg_ha": {
                "fairwaysMin": 250,
                "fairwaysMax": 350,
                "sportsMin": 250,
                "sportsMax": 350
            },
            "interval_weeks": 14,
            "particleSize_mm": 1.5,
            "notes": "1-2mm CRF. 3-4 month release. 45% polymer-coated N (PolyEdge — SDS polyedge_15-15-5_msds.pdf). Pre-seeder / renovation / establishment grade. Page: Mar-Oct. Nutrient applied at 30 g/m2: N 45, P 45, K 15 kg/ha. Source: aitkens.co.uk Vision Reward CRF 15-15-5 product page.",
            "verified": true,
            "nForm": "urea_pcu",
            "nFormConfidence": "auto",
            "nFormReason": "PolyEdge polymer-coated urea. 45% coated N. Low volatilisation."
        },
        {
            "id": "vision-reward-crf-11-4-22",
            "name": "Vision Reward CRF 11-4-22+1%Fe+3%MgO (3-4 Month)",
            "brand": "Vision Reward CRF",
            "supplier": "aitkens",
            "form": "granular",
            "release": "controlled",
            "surfaces": [
                "fairways",
                "sports"
            ],
            "season": [
                "spring",
                "summer",
                "autumn",
                "winter"
            ],
            "analysis": {
                "N": 11,
                "P": 1.75,
                "K": 18.26,
                "Ca": 0,
                "Mg": 1.81,
                "Fe": 1
            },
            "npk_label": "11-4-22+1Fe+3MgO",
            "rates": {
                "fairwaysMin": 25,
                "fairwaysMax": 35,
                "sportsMin": 25,
                "sportsMax": 35
            },
            "rateUnit": "g/m²",
            "rates_kg_ha": {
                "fairwaysMin": 250,
                "fairwaysMax": 350,
                "sportsMin": 250,
                "sportsMax": 350
            },
            "interval_weeks": 14,
            "particleSize_mm": 1.5,
            "notes": "1-2mm CRF. 3-4 month release. 45% polymer-coated N (PolyEdge — SDS polyedge_11-4-22_msds.pdf). High-K autumn-winter-spring hardener / pre-stress conditioner. Page: Jan-Dec. Nutrient applied at 30 g/m2: N 33, P 12, K 66 kg/ha. Source: aitkens.co.uk Vision Reward CRF 11-4-22 product page.",
            "verified": true,
            "nForm": "urea_pcu",
            "nFormConfidence": "auto",
            "nFormReason": "PolyEdge polymer-coated urea. 45% coated N. Low volatilisation."
        },
        {
            "id": "vision-nutri-smart-16-4-10-mu",
            "name": "Vision Nutri-Smart 16-4-10+2%Fe+3.1%CaO+Slow Release MU",
            "brand": "Vision Nutri-Smart",
            "supplier": "aitkens",
            "form": "granular",
            "release": "slow",
            "surfaces": [
                "fairways",
                "sports"
            ],
            "season": [
                "spring",
                "summer"
            ],
            "analysis": {
                "N": 16,
                "P": 1.75,
                "K": 8.3,
                "Ca": 2.21,
                "Mg": 0,
                "Fe": 2
            },
            "npk_label": "16-4-10+2Fe+3.1CaO+MU",
            "rates": {
                "fairwaysMin": 35,
                "fairwaysMax": 35,
                "sportsMin": 35,
                "sportsMax": 35
            },
            "rateUnit": "g/m²",
            "rates_kg_ha": {
                "fairwaysMin": 350,
                "fairwaysMax": 350,
                "sportsMin": 350,
                "sportsMax": 350
            },
            "interval_weeks": 12,
            "particleSize_mm": 3.2,
            "notes": "2.5-3.9mm outfield granule. Slow release MU + ammoniacal blend. Up to 3 month release. Page: Mar-Sep. Nutrient applied at 35 g/m2: N 56, P 14, K 35 kg/ha. Source: aitkens.co.uk Vision Nutri-Smart 16-4-10 outfield product page.",
            "verified": true,
            "nForm": "mixed",
            "nFormConfidence": "auto",
            "nFormReason": "Product page declares N breakdown 68% Ammoniacal / 19% Ureic / 13% Methylene Urea. Low volatilisation risk; MU component extends release."
        },
        {
            "id": "vision-nutri-smart-8-4-10-mu",
            "name": "Vision Nutri-Smart 8-4-10+2%Fe+8%CaO+Slow Release MU",
            "brand": "Vision Nutri-Smart",
            "supplier": "aitkens",
            "form": "granular",
            "release": "slow",
            "surfaces": [
                "fairways",
                "sports"
            ],
            "season": [
                "spring",
                "summer",
                "autumn",
                "winter"
            ],
            "analysis": {
                "N": 8,
                "P": 1.75,
                "K": 8.3,
                "Ca": 5.71,
                "Mg": 0,
                "Fe": 2
            },
            "npk_label": "8-4-10+2Fe+8CaO+MU",
            "rates": {
                "fairwaysMin": 35,
                "fairwaysMax": 35,
                "sportsMin": 35,
                "sportsMax": 35
            },
            "rateUnit": "g/m²",
            "rates_kg_ha": {
                "fairwaysMin": 350,
                "fairwaysMax": 350,
                "sportsMin": 350,
                "sportsMax": 350
            },
            "interval_weeks": 12,
            "particleSize_mm": 3.2,
            "notes": "2.5-3.9mm outfield granule. Slow release MU + ammoniacal blend. Up to 3 month release. Page: Jan-Dec. Nutrient applied at 35 g/m2: N 28, P 14, K 35 kg/ha. Source: aitkens.co.uk Vision Nutri-Smart 8-4-10 outfield product page.",
            "verified": true,
            "nForm": "mixed",
            "nFormConfidence": "auto",
            "nFormReason": "Product page declares N breakdown 68% Ammoniacal / 19% Ureic / 13% Methylene Urea. Low volatilisation risk."
        },
        {
            "id": "terralift-tx10-mycorrhiza",
            "name": "Terralift TX10 + Mycorrhiza (5-2-8)",
            "brand": "Terralift",
            "supplier": "Aitkens (Terralift distributor)",
            "form": "granular",
            "release": "organic",
            "surfaces": [
                "greens",
                "tees",
                "fairways",
                "sportsfields"
            ],
            "season": [
                "spring",
                "summer",
                "autumn"
            ],
            "analysis": {
                "N": 5,
                "P": 0.87,
                "K": 6.64,
                "Ca": 0,
                "Mg": 0,
                "Fe": 0
            },
            "npk_label": "5-2-8 + wetting agent + humic/amino/seaweed/trace elements + mycorrhiza",
            "rates": {
                "greensMin": 15,
                "greensMax": 40,
                "fairwaysMin": 15,
                "fairwaysMax": 40,
                "sportsMin": 15,
                "sportsMax": 40
            },
            "rateUnit": "g/m²",
            "rates_kg_ha": {
                "greensMin": 150,
                "greensMax": 400,
                "fairwaysMin": 150,
                "fairwaysMax": 400,
                "sportsMin": 150,
                "sportsMax": 400
            },
            "interval_weeks": 6,
            "particleSize_mm": 1.5,
            "notes": "Mini-granule (1-2mm). Organic complex + polymer-web wetting agent + 12% humic acids + 18% amino + seaweed + Mg/Mn/B trace elements + mycorrhiza. Page claims complements main-fertiliser release patterns; reduces main-fert load by 15-25%. 20 kg pack covers 500-1333 m² at 15-40 g/m². Page declares 7.5 kg N/ha + 3 kg P2O5/ha + 12 kg K2O/ha at the max rate. SDS sds_TERTX10.PDF. Source: aitkens.co.uk Terralift TX10 + Mycorrhiza product page (May 2026).",
            "verified": true,
            "nForm": "organic",
            "nFormConfidence": "auto",
            "nFormReason": "Organic complex described on page. Page lists no synthetic N source. Slow organic N release with low volatilisation risk.",
            "discontinued": false
        },
        {
            "id": "terralift-tx11-1-5",
            "name": "Terralift TX11-1-5",
            "brand": "Terralift",
            "supplier": "Aitkens (Terralift distributor)",
            "form": "granular",
            "release": "organic",
            "surfaces": [
                "greens",
                "tees"
            ],
            "season": [
                "spring",
                "summer"
            ],
            "analysis": {
                "N": 11,
                "P": 0.44,
                "K": 4.15,
                "Ca": 0,
                "Mg": 0,
                "Fe": 0
            },
            "npk_label": "11-1-5 + humic acids",
            "rates": {
                "greensMin": 30,
                "greensMax": 30,
                "fairwaysMin": 30,
                "fairwaysMax": 30,
                "sportsMin": 30,
                "sportsMax": 30
            },
            "rateUnit": "g/m²",
            "rates_kg_ha": {
                "greensMin": 300,
                "greensMax": 300,
                "fairwaysMin": 300,
                "fairwaysMax": 300,
                "sportsMin": 300,
                "sportsMax": 300
            },
            "interval_weeks": 6,
            "particleSize_mm": 1.5,
            "notes": "Mini-granule (1-2mm). High-N early-season colour driver with humic acids. Page claims well-suited to acidic soil conditions and sand-based greens, drives growth in cold conditions. 20 kg pack covers 666 m² at 30 g/m² fixed (= 33 kg N/ha + 3 kg P2O5/ha + 15 kg K2O/ha). Source: aitkens.co.uk Terralift TX11-1-5 product page (May 2026).",
            "verified": true,
            "nForm": "review",
            "nFormConfidence": "review",
            "nFormReason": "11% N is too high for pure organic carriers; page describes 'organic with humic acids' but doesn't declare any synthetic N component. Likely a blend (organic + ammoniacal or urea kicker). SDS needed to confirm the inorganic N component.",
            "discontinued": false
        },
        {
            "id": "terralift-tx9-1-10",
            "name": "Terralift TX9-1-10",
            "brand": "Terralift",
            "supplier": "Aitkens (Terralift distributor)",
            "form": "granular",
            "release": "organic",
            "surfaces": [
                "greens",
                "tees",
                "fairways"
            ],
            "season": [
                "spring",
                "summer",
                "autumn"
            ],
            "analysis": {
                "N": 9,
                "P": 0.44,
                "K": 8.3,
                "Ca": 0,
                "Mg": 0,
                "Fe": 0
            },
            "npk_label": "9-1-10 + seaweed + humic acids + Ca + trace elements",
            "rates": {
                "greensMin": 30,
                "greensMax": 60,
                "fairwaysMin": 30,
                "fairwaysMax": 60,
                "sportsMin": 30,
                "sportsMax": 60
            },
            "rateUnit": "g/m²",
            "rates_kg_ha": {
                "greensMin": 300,
                "greensMax": 600,
                "fairwaysMin": 300,
                "fairwaysMax": 600,
                "sportsMin": 300,
                "sportsMax": 600
            },
            "interval_weeks": 6,
            "particleSize_mm": 1.5,
            "notes": "Mini-granule (1-2mm). Sward density builder. Seaweed + humic acids + K for stress / close-mowing tolerance. Organic trace elements + free-calcium. 20 kg pack covers 333-666 m² at 30-60 g/m². Page declares 27 kg N/ha at min rate (= 9% × 30 g/m²) and 30 kg K2O/ha at max rate. SDS shared with TX10 (sds_TERTX10.PDF). Source: aitkens.co.uk Terralift TX9-1-10 product page (May 2026).",
            "verified": true,
            "nForm": "review",
            "nFormConfidence": "review",
            "nFormReason": "9% N likely a blend of organic + ammoniacal or urea. Page doesn't declare N split. SDS check needed.",
            "discontinued": false
        },
        {
            "id": "terralift-tx5-1-16",
            "name": "Terralift TX5-1-16",
            "brand": "Terralift",
            "supplier": "Aitkens (Terralift distributor)",
            "form": "granular",
            "release": "slow",
            "surfaces": [
                "greens",
                "tees"
            ],
            "season": [
                "summer",
                "autumn",
                "winter"
            ],
            "analysis": {
                "N": 5,
                "P": 0.44,
                "K": 13.28,
                "Ca": 0,
                "Mg": 0,
                "Fe": 0
            },
            "npk_label": "5-1-16 (organic-based with seaweed + gypsum)",
            "rates": {
                "greensMin": 20,
                "greensMax": 40,
                "fairwaysMin": 20,
                "fairwaysMax": 40,
                "sportsMin": 20,
                "sportsMax": 40
            },
            "rateUnit": "g/m²",
            "rates_kg_ha": {
                "greensMin": 200,
                "greensMax": 400,
                "fairwaysMin": 200,
                "fairwaysMax": 400,
                "sportsMin": 200,
                "sportsMax": 400
            },
            "interval_weeks": 8,
            "particleSize_mm": 1.5,
            "notes": "Organic-based mini-granule. Composted materials + seaweed + gypsum. High-K (16% K2O = 13.3% elemental) for hardening; low N (5%) for slow even growth. Targeted at soil-based greens and tees. 20 kg pack covers 500-1000 m² (= 200-400 kg/ha). Page declares 10 kg N/ha at min rate, 32 kg K/ha at max rate. SDS sds_TERAUT.PDF. Page meta has TX5-1-20 typo. Source: aitkens.co.uk Terralift TX5-1-16 product page (May 2026).",
            "verified": true,
            "nForm": "review",
            "nFormConfidence": "review",
            "nFormReason": "Composted/organic N source — likely organic-N dominant with some ammoniacal release. Page does not declare N split. SDS confirmation needed.",
            "discontinued": false
        },
        {
            "id": "terralift-t-plex-3-0-6",
            "name": "Terralift T-Plex (3-0-6)",
            "brand": "Terralift",
            "supplier": "Aitkens (Terralift distributor)",
            "form": "granular",
            "release": "slow",
            "surfaces": [
                "greens",
                "tees",
                "fairways"
            ],
            "season": [
                "autumn",
                "winter"
            ],
            "analysis": {
                "N": 3,
                "P": 0,
                "K": 4.98,
                "Ca": 0,
                "Mg": 0,
                "Fe": 0
            },
            "npk_label": "3-0-6 + organic complex + MU SR + seaweed + Ca + fulvic + humic + amino acids",
            "rates": {
                "greensMin": 30,
                "greensMax": 40,
                "fairwaysMin": 30,
                "fairwaysMax": 40,
                "sportsMin": 30,
                "sportsMax": 40
            },
            "rateUnit": "g/m²",
            "rates_kg_ha": {
                "greensMin": 300,
                "greensMax": 400,
                "fairwaysMin": 300,
                "fairwaysMax": 400,
                "sportsMin": 300,
                "sportsMax": 400
            },
            "interval_weeks": 14,
            "particleSize_mm": 1.5,
            "notes": "Mini-granule (1-2mm). T-Plex range combines organic complex with methylene urea (MU) for 14-week extended release. Marketed as 'first true safe winter fertiliser for winter colour'. 20 kg pack covers 500-667 m² at 30-40 g/m². Page declares 9 kg N/ha at min rate and 18 kg K2O/ha at min rate. Source: aitkens.co.uk Terralift T-Plex (3-0-6) product page (May 2026).",
            "verified": true,
            "nForm": "mixed",
            "nFormConfidence": "auto",
            "nFormReason": "Page declares 'organic complex with methylene urea technology'. N split between organic component and MU not declared. Low volatilisation risk (MU is stabilised urea, organic N is bound).",
            "discontinued": false
        },
        {
            "id": "terralift-t-plex-7-0-11",
            "name": "Terralift T-Plex (7-0-11)",
            "brand": "Terralift",
            "supplier": "Aitkens (Terralift distributor)",
            "form": "granular",
            "release": "slow",
            "surfaces": [
                "greens",
                "tees",
                "fairways"
            ],
            "season": [
                "spring",
                "summer",
                "autumn"
            ],
            "analysis": {
                "N": 7,
                "P": 0,
                "K": 9.13,
                "Ca": 0,
                "Mg": 0,
                "Fe": 0
            },
            "npk_label": "7-0-11 + organic complex + MU SR",
            "rates": {
                "greensMin": 30,
                "greensMax": 40,
                "fairwaysMin": 30,
                "fairwaysMax": 40,
                "sportsMin": 30,
                "sportsMax": 40
            },
            "rateUnit": "g/m²",
            "rates_kg_ha": {
                "greensMin": 300,
                "greensMax": 400,
                "fairwaysMin": 300,
                "fairwaysMax": 400,
                "sportsMin": 300,
                "sportsMax": 400
            },
            "interval_weeks": 14,
            "particleSize_mm": 1.5,
            "notes": "Mini-granule (1-2mm). T-Plex range with MU 14-week SR. Spring-autumn loam-condition use. Higher K resilience into winter. 20 kg pack covers 500-667 m² at 30-40 g/m². Page declares 21 kg N/ha at min rate (= 7% × 30 g/m²) and 33 kg K2O/ha at min rate (= 11% × 30 g/m²). Source: aitkens.co.uk Terralift T-Plex (7-0-11) product page (May 2026).",
            "verified": true,
            "nForm": "mixed",
            "nFormConfidence": "auto",
            "nFormReason": "Same chemistry family as T-Plex (3-0-6): organic complex + MU. Low volatilisation.",
            "discontinued": false
        },
        {
            "id": "terralift-t-plex-11-0-10",
            "name": "Terralift T-Plex (11-0-10)",
            "brand": "Terralift",
            "supplier": "Aitkens (Terralift distributor)",
            "form": "granular",
            "release": "slow",
            "surfaces": [
                "greens",
                "tees",
                "fairways"
            ],
            "season": [
                "spring",
                "summer"
            ],
            "analysis": {
                "N": 11,
                "P": 0,
                "K": 8.3,
                "Ca": 0,
                "Mg": 0,
                "Fe": 0
            },
            "npk_label": "11-0-10 + organic complex + MU SR",
            "rates": {
                "greensMin": 30,
                "greensMax": 40,
                "fairwaysMin": 30,
                "fairwaysMax": 40,
                "sportsMin": 30,
                "sportsMax": 40
            },
            "rateUnit": "g/m²",
            "rates_kg_ha": {
                "greensMin": 300,
                "greensMax": 400,
                "fairwaysMin": 300,
                "fairwaysMax": 400,
                "sportsMin": 300,
                "sportsMax": 400
            },
            "interval_weeks": 14,
            "particleSize_mm": 1.5,
            "notes": "Mini-granule (1-2mm). T-Plex range with MU 14-week SR. High N for colour. Sand-construction positioning. 20 kg pack covers 500-667 m² at 30-40 g/m². Page declares 33 kg N/ha at min rate and 30 kg K2O/ha at min rate. Source: aitkens.co.uk Terralift T-Plex (11-0-10) product page (May 2026).",
            "verified": true,
            "nForm": "mixed",
            "nFormConfidence": "auto",
            "nFormReason": "Same chemistry family as T-Plex range: organic complex + MU. Higher N share likely shifts the MU/organic ratio toward MU. Low volatilisation.",
            "discontinued": false
        },
        {
            "id": "terralift-tx-humus",
            "name": "Terralift TX Humus",
            "brand": "Terralift",
            "supplier": "Aitkens (Terralift distributor)",
            "form": "granular",
            "release": "amendment",
            "surfaces": [
                "greens",
                "tees",
                "fairways"
            ],
            "season": [
                "spring",
                "summer",
                "autumn"
            ],
            "analysis": {
                "N": 0,
                "P": 0,
                "K": 0,
                "Ca": 0,
                "Mg": 0,
                "Fe": 0
            },
            "npk_label": "FROC + microbially digested humic acid (carbon amendment, no NPK)",
            "rates": {
                "greensMin": 20,
                "greensMax": 50,
                "fairwaysMin": 20,
                "fairwaysMax": 50,
                "sportsMin": 20,
                "sportsMax": 50
            },
            "rateUnit": "g/m²",
            "rates_kg_ha": {
                "greensMin": 200,
                "greensMax": 500,
                "fairwaysMin": 200,
                "fairwaysMax": 500,
                "sportsMin": 200,
                "sportsMax": 500
            },
            "interval_weeks": 8,
            "particleSize_mm": 1.5,
            "notes": "Mini-granule (1-2mm). Food Residue Organic Complex (FROC) + microbially digested humic acid. Carbon/humic support for grass + mycorrhiza-enhanced root web. 6-12 week release. Page rate guidance: Mineral programme 20 g/m² every 6-8 wks; Compost-tea / liquid-mineral 30-40 g/m² every 8-12 wks; New rootzone 40-50 g/m². 20 kg pack covers 1000 m² at 20 g/m². Source: aitkens.co.uk Terralift TX Humus product page (May 2026).",
            "verified": true,
            "nForm": "no_N",
            "nFormConfidence": "auto",
            "nFormReason": "Page declares no NPK; pure carbon/humic amendment. Zero declared N. No volatilisation pathway.",
            "discontinued": false
        },
        {
            "id": "terralift-soilfix",
            "name": "Terralift Soilfix Amendment",
            "brand": "Terralift",
            "supplier": "Aitkens (Terralift distributor)",
            "form": "granular",
            "release": "amendment",
            "surfaces": [
                "greens",
                "tees",
                "fairways",
                "sportsfields"
            ],
            "season": [
                "spring",
                "summer",
                "autumn",
                "winter"
            ],
            "analysis": {
                "N": 0,
                "P": 0,
                "K": 0,
                "Ca": null,
                "Mg": null,
                "Fe": 0
            },
            "npk_label": "Ca/Mg base saturation amendment (5 sub-variants)",
            "rates": {
                "fairwaysMin": 20,
                "fairwaysMax": 20,
                "sportsMin": 20,
                "sportsMax": 20
            },
            "rateUnit": "g/m²",
            "rates_kg_ha": {
                "fairwaysMin": 200,
                "fairwaysMax": 200,
                "sportsMin": 200,
                "sportsMax": 200
            },
            "interval_weeks": 26,
            "particleSize_mm": 1.5,
            "notes": "Granular base saturation amendment. 5 sub-variants on a single page: Ca/Mg (pH 5.2-7.5), Mg+ (any pH), MnB (10 ppm Mn + 0.3 ppm B boost), High pH Ca (>7.2 soils), Low pH Ca (slow-release Ca in acidic soils + pH buffer). 20 kg pack covers 1000 m² (= 200 kg/ha). Page notes: Ca only translocates UP the plant, so granule root-uptake is more effective than foliar Ca. SDS sds_TERSOILFIX2.PDF. Source: aitkens.co.uk Terralift Soilfix Amendment product page (May 2026).",
            "verified": true,
            "nForm": "no_N",
            "nFormConfidence": "auto",
            "nFormReason": "Base saturation amendment. Zero N. No volatilisation pathway.",
            "discontinued": false
        },
        {
            "id": "terralift-sports-grass-6-2-8",
            "name": "Terralift Sports Grass 6-2-8",
            "brand": "Terralift",
            "supplier": "Aitkens (Terralift distributor)",
            "form": "granular",
            "release": "organic",
            "surfaces": [
                "fairways",
                "sportsfields"
            ],
            "season": [
                "spring",
                "summer",
                "autumn"
            ],
            "analysis": {
                "N": 6,
                "P": 0.87,
                "K": 6.64,
                "Ca": 0,
                "Mg": 0,
                "Fe": 0
            },
            "npk_label": "6-2-8 (organic outfield blend)",
            "rates": {
                "fairwaysMin": 30,
                "fairwaysMax": 60,
                "sportsMin": 30,
                "sportsMax": 60
            },
            "rateUnit": "g/m²",
            "rates_kg_ha": {
                "fairwaysMin": 300,
                "fairwaysMax": 600,
                "sportsMin": 300,
                "sportsMax": 600
            },
            "interval_weeks": 8,
            "particleSize_mm": 2.5,
            "notes": "Granule (outfield-grade, 2-3mm). Balanced organic NPK for density and growth phase on coarse grass. Moisture retention + root stimulus for damaged areas. Half rates for lightly worked areas. 20 kg pack covers 333-666 m² at 30-60 g/m². Page declares 18 kg N/ha + 6 kg P2O5/ha + 24 kg K2O/ha at max rate. SDS sds_TERYEARROUND.PDF (legacy 'Year Round' branding). Source: aitkens.co.uk Terralift Sports Grass 6-2-8 product page (May 2026).",
            "verified": true,
            "nForm": "organic",
            "nFormConfidence": "auto",
            "nFormReason": "Page describes 'balanced organic nutrients'. Organic N carrier with low volatilisation risk.",
            "discontinued": false
        },
        {
            "id": "terralift-sports-grass-10-2-4",
            "name": "Terralift Sports Grass 10-2-4",
            "brand": "Terralift",
            "supplier": "Aitkens (Terralift distributor)",
            "form": "granular",
            "release": "organic",
            "surfaces": [
                "fairways",
                "sportsfields"
            ],
            "season": [
                "spring",
                "summer",
                "autumn"
            ],
            "analysis": {
                "N": 10,
                "P": 0.87,
                "K": 3.32,
                "Ca": 0,
                "Mg": 0,
                "Fe": 0
            },
            "npk_label": "10-2-4 (organic outfield blend)",
            "rates": {
                "fairwaysMin": 30,
                "fairwaysMax": 60,
                "sportsMin": 30,
                "sportsMax": 60
            },
            "rateUnit": "g/m²",
            "rates_kg_ha": {
                "fairwaysMin": 300,
                "fairwaysMax": 600,
                "sportsMin": 300,
                "sportsMax": 600
            },
            "interval_weeks": 8,
            "particleSize_mm": 2.5,
            "notes": "Granule (outfield-grade, 2-3mm). Higher-N variant for kick + colour. Page claims 'balanced organic nutrients' with strong density and microbial support. URL contains a typo ('terraflift' with extra f) — confirmed live SKU. 20 kg pack covers 333-666 m² at 30-60 g/m². Page declares 30 kg N/ha + 6 kg P2O5/ha + 12 kg K2O/ha at max rate. Source: aitkens.co.uk Terralift Sports Grass 10-2-4 product page (May 2026).",
            "verified": true,
            "nForm": "review",
            "nFormConfidence": "review",
            "nFormReason": "Page describes 'balanced organic nutrients' but 10% N is too high for pure organic carriers. Likely organic + ammoniacal/urea blend. SDS needed.",
            "discontinued": false
        },
        {
            "id": "vitax-ssd-original-fe",
            "name": "Vitax SS/D Original With Iron (8-0-0+2%Fe)",
            "brand": "Vitax",
            "supplier": "aitkens",
            "form": "powder",
            "release": "organic",
            "surfaces": [
                "greens",
                "tees",
                "fairways"
            ],
            "season": [
                "spring",
                "summer",
                "autumn"
            ],
            "analysis": {
                "N": 8,
                "P": 0,
                "K": 0,
                "Ca": 0,
                "Mg": 0,
                "Fe": 2
            },
            "npk_label": "8-0-0 + 2% Fe",
            "rates": {
                "greensMin": 70,
                "greensMax": 70,
                "fairwaysMin": 70,
                "fairwaysMax": 70,
                "sportsMin": 70,
                "sportsMax": 70
            },
            "rateUnit": "g/m²",
            "rates_kg_ha": {
                "greensMin": 700,
                "greensMax": 700,
                "fairwaysMin": 700,
                "fairwaysMax": 700,
                "sportsMin": 700,
                "sportsMax": 700
            },
            "interval_weeks": 8,
            "particleSize_mm": null,
            "notes": "Organic-based powder fertiliser with added iron. 25 kg pack covers 357 m2 at 70 g/m2 fixed (= 700 kg/ha). Page declares 56 kg N/ha. Tried-and-tested traditional Vitax SS/D formulation used by many UK golf clubs. SDS sds_VITSSDFE.pdf. Source: aitkens.co.uk Vitax SS/D Original With Iron product page (May 2026). FORM=POWDER — particleSize_mm not applicable; engine should route by form attribute, not by size.",
            "verified": true,
            "nForm": "organic",
            "nFormConfidence": "auto",
            "nFormReason": "Vitax SS/D family is organic-based fertiliser. Without SDS detail the N split between organic carriers (feather meal / castor meal / hoof & horn) and any ammoniacal supplement is uncertain — flag for SDS check. Slow-release organic N has minimal volatilisation risk."
        },
        {
            "id": "vitax-ssd-original",
            "name": "Vitax SS/D Original Without Iron (8-0-0)",
            "brand": "Vitax",
            "supplier": "aitkens",
            "form": "powder",
            "release": "organic",
            "surfaces": [
                "greens",
                "tees",
                "fairways"
            ],
            "season": [
                "summer"
            ],
            "analysis": {
                "N": 8,
                "P": 0,
                "K": 0,
                "Ca": 0,
                "Mg": 0,
                "Fe": 0
            },
            "npk_label": "8-0-0",
            "rates": {
                "greensMin": 70,
                "greensMax": 70,
                "fairwaysMin": 70,
                "fairwaysMax": 70,
                "sportsMin": 70,
                "sportsMax": 70
            },
            "rateUnit": "g/m²",
            "rates_kg_ha": {
                "greensMin": 700,
                "greensMax": 700,
                "fairwaysMin": 700,
                "fairwaysMax": 700,
                "sportsMin": 700,
                "sportsMax": 700
            },
            "interval_weeks": 8,
            "particleSize_mm": null,
            "notes": "Organic-based powder fertiliser, no iron. Excellent during the summer months when there is little need for iron. 25 kg pack covers 357 m2 at 70 g/m2 fixed (= 700 kg/ha). Page declares 56 kg N/ha. SDS sds_VITSSD.pdf. Source: aitkens.co.uk Vitax SS/D Original Without Iron product page (May 2026). FORM=POWDER — particleSize_mm not applicable; engine should route by form attribute, not by size.",
            "verified": true,
            "nForm": "organic",
            "nFormConfidence": "auto",
            "nFormReason": "Vitax SS/D family is organic-based fertiliser. Without SDS detail the N split between organic carriers (feather meal / castor meal / hoof & horn) and any ammoniacal supplement is uncertain — flag for SDS check. Slow-release organic N has minimal volatilisation risk."
        },
        {
            "id": "vitax-ssdk-original",
            "name": "Vitax SS/D+K Original (8-0-6)",
            "brand": "Vitax",
            "supplier": "aitkens",
            "form": "powder",
            "release": "organic",
            "surfaces": [
                "greens",
                "tees",
                "fairways"
            ],
            "season": [
                "spring",
                "summer",
                "autumn"
            ],
            "analysis": {
                "N": 8,
                "P": 0,
                "K": 4.98,
                "Ca": 0,
                "Mg": 0,
                "Fe": 0
            },
            "npk_label": "8-0-6",
            "rates": {
                "greensMin": 70,
                "greensMax": 70,
                "fairwaysMin": 70,
                "fairwaysMax": 70,
                "sportsMin": 70,
                "sportsMax": 70
            },
            "rateUnit": "g/m²",
            "rates_kg_ha": {
                "greensMin": 700,
                "greensMax": 700,
                "fairwaysMin": 700,
                "fairwaysMax": 700,
                "sportsMin": 700,
                "sportsMax": 700
            },
            "interval_weeks": 8,
            "particleSize_mm": null,
            "notes": "Organic-based powder fertiliser, same SS/D base + added potash. Designed to address potash deficiency commonly found in soil analyses. 25 kg pack covers 357 m2 at 70 g/m2 fixed (= 700 kg/ha). Page declares 56 kg N/ha and 42 kg K2O/ha. SDS sds_VITSSDK.pdf. Source: aitkens.co.uk Vitax SS/D+K Original product page (May 2026). FORM=POWDER — particleSize_mm not applicable; engine should route by form attribute, not by size.",
            "verified": true,
            "nForm": "organic",
            "nFormConfidence": "auto",
            "nFormReason": "Vitax SS/D family is organic-based fertiliser. Without SDS detail the N split between organic carriers (feather meal / castor meal / hoof & horn) and any ammoniacal supplement is uncertain — flag for SDS check. Slow-release organic N has minimal volatilisation risk."
        },
        {
            "id": "vitax-lawn-sand",
            "name": "Vitax Lawn Sand (4.7-0-0+1.8%Fe)",
            "brand": "Vitax",
            "supplier": "aitkens",
            "form": "powder",
            "release": "quick",
            "surfaces": [
                "fairways",
                "sportsfields",
                "lawns"
            ],
            "season": [
                "spring"
            ],
            "analysis": {
                "N": 4.7,
                "P": 0,
                "K": 0,
                "Ca": 0,
                "Mg": 0,
                "Fe": 1.8
            },
            "npk_label": "4.7-0-0 + 1.8% Fe",
            "rates": {
                "fairwaysMin": 35,
                "fairwaysMax": 140,
                "sportsMin": 35,
                "sportsMax": 140
            },
            "rateUnit": "g/m²",
            "rates_kg_ha": {
                "fairwaysMin": 350,
                "fairwaysMax": 1400,
                "sportsMin": 350,
                "sportsMax": 1400
            },
            "interval_weeks": 26,
            "particleSize_mm": null,
            "notes": "Powder. 25 kg pack covers 179-714 m2 at 35-140 g/m2. Page declares 16.5 kg N/ha at min rate (35 g/m2 = 4.7% N), so max-rate N is ~66 kg N/ha. Vitax-branded product resold by Aitkens. SDS sds_VITLAWNSAND.pdf. Source: aitkens.co.uk Vitax Lawn Sand product page. FORM=POWDER — particleSize_mm not applicable; engine should route by form attribute, not by size.",
            "verified": true,
            "nForm": "ammonium",
            "nFormConfidence": "auto",
            "nFormReason": "Lawn-sand chemistry: ammonium sulphate carrier + ferrous sulphate. 100% ammoniacal. Acidifying."
        },
        {
            "id": "vitax-turf-tonic",
            "name": "Vitax Turf Tonic (2.1-0-2.5+3%Fe) (MAPP 04354)",
            "brand": "Vitax",
            "supplier": "aitkens",
            "form": "powder",
            "release": "quick",
            "surfaces": [
                "greens",
                "tees",
                "fairways",
                "sportsfields"
            ],
            "season": [
                "spring",
                "autumn",
                "winter"
            ],
            "analysis": {
                "N": 2.1,
                "P": 0,
                "K": 2.08,
                "Ca": 0,
                "Mg": 0,
                "Fe": 3
            },
            "npk_label": "2.1-0-2.5 + 3% Fe (MAPP 04354)",
            "rates": {
                "greensMin": 37.5,
                "greensMax": 75,
                "fairwaysMin": 37.5,
                "fairwaysMax": 75,
                "sportsMin": 37.5,
                "sportsMax": 75
            },
            "rateUnit": "g/m²",
            "rates_kg_ha": {
                "greensMin": 375,
                "greensMax": 750,
                "fairwaysMin": 375,
                "fairwaysMax": 750,
                "sportsMin": 375,
                "sportsMax": 750
            },
            "interval_weeks": 12,
            "particleSize_mm": null,
            "notes": "Low-N all-year tonic + moss control + Fusarium suppression. Powder. 25 kg pack covers 333-666 m2 at 37.5-75 g/m2. Page declares 7.8 kg N/ha at min rate (= 2.1% × 37.5 g/m2) and 9.4 kg K2O/ha at min rate. Fusarium-suppressing effect attributed to Fe loading (acidifying microsite + leaf hardening). MAPP 04354 registered for Professional use in UK. SDS sds_VITTURFTONIC.pdf. Source: aitkens.co.uk Vitax Turf Tonic product page (May 2026). FORM=POWDER — particleSize_mm not applicable; engine should route by form attribute, not by size.",
            "verified": true,
            "nForm": "ammonium",
            "nFormConfidence": "auto",
            "nFormReason": "Vitax tonic-class products are typically ammonium sulphate + ferrous sulphate carriers (same family as Vitax Lawn Sand, SDS-confirmed). 100% ammoniacal expected. Acidifying via nitrification."
        },
        {
            "id": "vitax-ssd-microbial-n",
            "name": "Vitax SSD Microbial N (8-0-0+0.5%MgO+2.5%Fe)",
            "brand": "Vitax",
            "supplier": "Aitkens (Vitax distributor)",
            "form": "powder",
            "release": "slow",
            "analysis": {
                "N": 8,
                "P": 0,
                "K": 0,
                "Ca": 0,
                "Mg": 0.3,
                "Fe": 2.5
            },
            "npk_label": "8-0-0 + 0.5% MgO + 2.5% Fe",
            "rates": {},
            "rates_kg_ha": {},
            "rateUnit": "g/m² (rate not declared on page)",
            "interval_weeks": null,
            "particleSize_mm": null,
            "season": [
                "spring",
                "summer",
                "autumn"
            ],
            "surfaces": [
                "greens",
                "tees",
                "fairways"
            ],
            "notes": "High-N powder fertiliser. Page describes N content as 'both organic and inorganic material' plus trace elements and humates. Modern variant of the Vitax SS/D family. Application rate not declared on the product page when last fetched (404 on second fetch attempt; URL pattern unstable). Verify SDS / rate directly. Source: aitkens.co.uk Vitax SSD Microbial N product page (May 2026, page indexed but rate data not captured). FORM=POWDER — particleSize_mm not applicable; engine should route by form attribute, not by size. WAVE 9 CONFIRMATION: Aitkens product page (vitax-ssd-microbial-n-(8-0-0plus05mgplus25fe).aspx) returns 404 client error on direct fetch. Product remains in Google index with summary: 'A high quality nitrogen fertiliser in a powder form containing trace elements and humates. The nitrogen content contains both organic and inorganic material.' 'SSD' in product name refers to application via Supaturf SSD 60 Drop Spreader (Vitax Amenity sister brand), not a Vitax product-family designator. Status: discontinued-suspect or page in transition. Vitax Amenity's own website (vitaxamenity.co.uk) does not currently list this product. Engine should treat as POSSIBLY DISCONTINUED until Aitkens or Vitax confirm status. Chemistry data (8-0-0+0.5%MgO+2.5%Fe, powder form, organic + inorganic N split) is consistent with prior catalogue listing and matches Vitax SS/D Original product-numbering pattern. Recommend Jerry calls Aitkens (0141 440 0033 / 01977 681155) to confirm current stock status before recommending to clients.",
            "verified": true,
            "nForm": "mixed",
            "nFormConfidence": "review",
            "nFormReason": "Page declares 'nitrogen content contains both organic and inorganic material'. Mixed N source — needs SDS to determine the proportions and identify the inorganic component (ammoniacal vs urea)."
        }
    ],
    "liquid": [
        {
            "id": "vision-ultimax-sl-pure",
            "name": "Vision Ultimax-SL Pure",
            "brand": "Vision Ultimax-SL",
            "supplier": "aitkens",
            "form": "liquid",
            "release": "biostimulant",
            "surfaces": [
                "greens",
                "tees",
                "bowling",
                "fairways",
                "sports"
            ],
            "season": [
                "spring",
                "summer",
                "autumn",
                "winter"
            ],
            "analysis": {
                "N": 0,
                "P": 0,
                "K": 0.06666666666666667,
                "Ca": 0,
                "Mg": 0,
                "Fe": 0
            },
            "npk_label": "40% Ascophyllum nodosum",
            "rates": {
                "greensMin": 0.6,
                "greensMax": 0.6,
                "fairwaysMin": 0.6,
                "fairwaysMax": 0.6,
                "sportsMin": 0.6,
                "sportsMax": 0.6
            },
            "rateUnit": "L/ha",
            "rates_kg_ha": {
                "greensMin": 6,
                "greensMax": 6,
                "fairwaysMin": 6,
                "fairwaysMax": 6,
                "sportsMin": 6,
                "sportsMax": 6
            },
            "interval_weeks": 4,
            "particleSize_mm": null,
            "notes": "40% pure Ascophyllum nodosum extract (Atlantic-harvested, mild alkaline hydrolysis). Biostimulant — not a fertiliser. Oligosaccharides + humic acid + amino acids. Page: 6 L/ha applies N-0 P-0 K-0.4 kg/ha. Period Jan-Dec. Source: aitkens.co.uk Vision Ultimax-SL Pure product page (SDS ultimax_sl_pure__40__seaweed_.pdf). LIQUID DECLARATION BASIS: not declared on Aitkens product page. UK turf liquids commonly use either % w/v (US convention, Aquatrols/some ICL) or % w/w (EU convention). SDS or product label needed to confirm which.",
            "verified": true,
            "nForm": "no_N",
            "nFormConfidence": "auto",
            "nFormReason": "Seaweed biostimulant. Zero N declared. No volatilisation pathway."
        },
        {
            "id": "vision-ultimax-sl-active",
            "name": "Vision Ultimax-SL Active",
            "brand": "Vision Ultimax-SL",
            "supplier": "aitkens",
            "form": "liquid",
            "release": "quick",
            "surfaces": [
                "greens",
                "tees",
                "bowling",
                "fairways",
                "sports"
            ],
            "season": [
                "spring",
                "summer",
                "autumn"
            ],
            "analysis": {
                "N": 12,
                "P": 0,
                "K": 8.3,
                "Ca": 0,
                "Mg": 0,
                "Fe": 1
            },
            "npk_label": "12-0-10+1Fe (seaweed)",
            "rates": {
                "greensMin": 4.5,
                "greensMax": 4.5,
                "fairwaysMin": 4.5,
                "fairwaysMax": 4.5,
                "sportsMin": 4.5,
                "sportsMax": 4.5
            },
            "rateUnit": "L/ha",
            "rates_kg_ha": {
                "greensMin": 45,
                "greensMax": 45,
                "fairwaysMin": 45,
                "fairwaysMax": 45,
                "sportsMin": 45,
                "sportsMax": 45
            },
            "interval_weeks": 4,
            "particleSize_mm": null,
            "notes": "Seaweed-based NK + Fe liquid for active growth. 45 L/ha applies N 5.4 P 0 K 4.5 kg/ha. Tillering and colour without flushes. Mar-Oct. Source: aitkens.co.uk Vision Ultimax-SL Active product page (SDS ultimax_sl_active__12-0-10_1_fe_.pdf). LIQUID DECLARATION BASIS: not declared on Aitkens product page. UK turf liquids commonly use either % w/v (US convention, Aquatrols/some ICL) or % w/w (EU convention). SDS or product label needed to confirm which.",
            "verified": true,
            "nForm": "review",
            "nFormConfidence": "review",
            "nFormReason": "Page does not declare N split. Seaweed-based liquids typically blend urea + ammoniacal; SDS confirmation needed."
        },
        {
            "id": "vision-ultimax-sl-tournament",
            "name": "Vision Ultimax-SL Tournament",
            "brand": "Vision Ultimax-SL",
            "supplier": "aitkens",
            "form": "liquid",
            "release": "quick",
            "surfaces": [
                "greens",
                "tees",
                "bowling"
            ],
            "season": [
                "spring",
                "summer",
                "autumn",
                "winter"
            ],
            "analysis": {
                "N": 0,
                "P": 0,
                "K": 0.022222222222222223,
                "Ca": 0,
                "Mg": 0,
                "Fe": 7
            },
            "npk_label": "0-0-0+7Fe (seaweed)",
            "rates": {
                "greensMin": 4.5,
                "greensMax": 4.5,
                "fairwaysMin": 4.5,
                "fairwaysMax": 4.5,
                "sportsMin": 4.5,
                "sportsMax": 4.5
            },
            "rateUnit": "L/ha",
            "rates_kg_ha": {
                "greensMin": 45,
                "greensMax": 45,
                "fairwaysMin": 45,
                "fairwaysMax": 45,
                "sportsMin": 45,
                "sportsMax": 45
            },
            "interval_weeks": 4,
            "particleSize_mm": null,
            "notes": "Seaweed + 7% Fe tournament prep. Green-up 24 h without soft growth. Active at low soil temps. 45 L/ha applies N 0 P 0 K 0.1 kg/ha. Jan-Dec. Source: aitkens.co.uk Vision Ultimax-SL Tournament product page (SDS ultimax_sl_tournament__7__fe_.pdf). LIQUID DECLARATION BASIS: not declared on Aitkens product page. UK turf liquids commonly use either % w/v (US convention, Aquatrols/some ICL) or % w/w (EU convention). SDS or product label needed to confirm which.",
            "verified": true,
            "nForm": "no_N",
            "nFormConfidence": "auto",
            "nFormReason": "Iron + seaweed biostimulant. Zero N. No volatilisation pathway."
        },
        {
            "id": "vision-ultimax-sl-fortify",
            "name": "Vision Ultimax-SL Fortify",
            "brand": "Vision Ultimax-SL",
            "supplier": "aitkens",
            "form": "liquid",
            "release": "quick",
            "surfaces": [
                "greens",
                "tees",
                "bowling",
                "fairways",
                "sports"
            ],
            "season": [
                "spring",
                "summer",
                "autumn",
                "winter"
            ],
            "analysis": {
                "N": 0,
                "P": 1.31,
                "K": 6.64,
                "Ca": 0,
                "Mg": 0,
                "Fe": 0
            },
            "npk_label": "0-3-8 (potassium phosphite + seaweed)",
            "rates": {
                "greensMin": 4.5,
                "greensMax": 4.5,
                "fairwaysMin": 4.5,
                "fairwaysMax": 4.5,
                "sportsMin": 4.5,
                "sportsMax": 4.5
            },
            "rateUnit": "L/ha",
            "rates_kg_ha": {
                "greensMin": 45,
                "greensMax": 45,
                "fairwaysMin": 45,
                "fairwaysMax": 45,
                "sportsMin": 45,
                "sportsMax": 45
            },
            "interval_weeks": 4,
            "particleSize_mm": null,
            "notes": "Potassium phosphite + seaweed. Phosphite is NOT phosphate — induces SAR (systemic acquired resistance) for disease defence (Microdochium, Pythium). 14-18% Bioactives. 45 L/ha applies N 0 P 1.3 K 3.6 kg/ha. Jan-Dec. Source: aitkens.co.uk Vision Ultimax-SL Fortify product page (SDS ultimax_sl_fortify__0-3-8_.pdf). LIQUID DECLARATION BASIS: not declared on Aitkens product page. UK turf liquids commonly use either % w/v (US convention, Aquatrols/some ICL) or % w/w (EU convention). SDS or product label needed to confirm which.",
            "verified": true,
            "nForm": "no_N",
            "nFormConfidence": "auto",
            "nFormReason": "Potassium phosphite + seaweed. Zero N. Note: P is phosphite (PO3^3-) not phosphate (PO4^3-) — agronomic distinction matters for disease defence routing."
        },
        {
            "id": "vision-integral-turf",
            "name": "Vision Integral Turf",
            "brand": "Vision Integral",
            "supplier": "aitkens",
            "form": "liquid",
            "release": "quick",
            "surfaces": [
                "greens",
                "tees",
                "bowling",
                "fairways",
                "sports"
            ],
            "season": [
                "spring",
                "summer",
                "autumn",
                "winter"
            ],
            "analysis": {
                "N": 5,
                "P": null,
                "K": null,
                "Ca": 0,
                "Mg": 0,
                "Fe": 0
            },
            "npk_label": "5% N + Fe + TE + carbohydrate + surfactant",
            "rates": {
                "greensMin": 4,
                "greensMax": 4,
                "fairwaysMin": 4,
                "fairwaysMax": 4,
                "sportsMin": 4,
                "sportsMax": 4
            },
            "rateUnit": "L/ha",
            "rates_kg_ha": {
                "greensMin": 40,
                "greensMax": 40,
                "fairwaysMin": 40,
                "fairwaysMax": 40,
                "sportsMin": 40,
                "sportsMax": 40
            },
            "interval_weeks": 4,
            "particleSize_mm": null,
            "notes": "5% N + complexed Fe + Mg + Ca + TE + surfactants + simple carbohydrates (glucose/sucrose/fructose) + amino acids. Turf conditioner / recovery agent. 40 L/ha in 500 L/ha water. Year-round (no frost/snow). Source: aitkens.co.uk Vision Integral Turf product page. LIQUID DECLARATION BASIS: not declared on Aitkens product page. UK turf liquids commonly use either % w/v (US convention, Aquatrols/some ICL) or % w/w (EU convention). SDS or product label needed to confirm which.",
            "verified": true,
            "nForm": "review",
            "nFormConfidence": "review",
            "nFormReason": "Page does not declare N split. P/K not declared. SDS confirmation needed."
        },
        {
            "id": "vision-integral-plus",
            "name": "Vision Integral-Plus",
            "brand": "Vision Integral",
            "supplier": "aitkens",
            "form": "liquid",
            "release": "quick",
            "surfaces": [
                "greens",
                "tees",
                "bowling",
                "fairways",
                "sports"
            ],
            "season": [
                "spring",
                "summer",
                "autumn"
            ],
            "analysis": {
                "N": 12,
                "P": null,
                "K": null,
                "Ca": 0,
                "Mg": 0,
                "Fe": 0
            },
            "npk_label": "12% N + Fe + TE + carbohydrate + surfactant",
            "rates": {
                "greensMin": 4,
                "greensMax": 4,
                "fairwaysMin": 4,
                "fairwaysMax": 4,
                "sportsMin": 4,
                "sportsMax": 4
            },
            "rateUnit": "L/ha",
            "rates_kg_ha": {
                "greensMin": 40,
                "greensMax": 40,
                "fairwaysMin": 40,
                "fairwaysMax": 40,
                "sportsMin": 40,
                "sportsMax": 40
            },
            "interval_weeks": 4,
            "particleSize_mm": null,
            "notes": "12% N growing-season variant. Same surfactant + carbohydrate + Fe + Mg + TE base as Integral Turf. 40 L/ha in 500 L/ha water. Source: aitkens.co.uk Vision Integral-Plus product page. LIQUID DECLARATION BASIS: not declared on Aitkens product page. UK turf liquids commonly use either % w/v (US convention, Aquatrols/some ICL) or % w/w (EU convention). SDS or product label needed to confirm which.",
            "verified": true,
            "nForm": "review",
            "nFormConfidence": "review",
            "nFormReason": "Page does not declare N split. P/K not declared. SDS confirmation needed."
        },
        {
            "id": "vision-integral-max",
            "name": "Vision Integral-Max",
            "brand": "Vision Integral",
            "supplier": "aitkens",
            "form": "liquid",
            "release": "quick",
            "surfaces": [
                "greens",
                "tees",
                "bowling",
                "fairways",
                "sports"
            ],
            "season": [
                "spring",
                "summer",
                "autumn",
                "winter"
            ],
            "analysis": {
                "N": 9,
                "P": null,
                "K": null,
                "Ca": 0,
                "Mg": 0,
                "Fe": 0
            },
            "npk_label": "9% N + Fe + TE + carbohydrate + surfactant",
            "rates": {
                "greensMin": 4,
                "greensMax": 4,
                "fairwaysMin": 4,
                "fairwaysMax": 4,
                "sportsMin": 4,
                "sportsMax": 4
            },
            "rateUnit": "L/ha",
            "rates_kg_ha": {
                "greensMin": 40,
                "greensMax": 40,
                "fairwaysMin": 40,
                "fairwaysMax": 40,
                "sportsMin": 40,
                "sportsMax": 40
            },
            "interval_weeks": 4,
            "particleSize_mm": null,
            "notes": "9% N year-round / stadium-tournament colour grade. Same conditioner base. 40 L/ha in 500 L/ha water. Source: aitkens.co.uk Vision Integral-Max product page. LIQUID DECLARATION BASIS: not declared on Aitkens product page. UK turf liquids commonly use either % w/v (US convention, Aquatrols/some ICL) or % w/w (EU convention). SDS or product label needed to confirm which.",
            "verified": true,
            "nForm": "review",
            "nFormConfidence": "review",
            "nFormReason": "Page does not declare N split. P/K not declared. SDS confirmation needed."
        },
        {
            "id": "vision-ns-liquid-25-0-0",
            "name": "Vision Nutri-Smart Liquid (25-0-0)",
            "brand": "Vision Nutri-Smart Liquid",
            "supplier": "aitkens",
            "form": "liquid",
            "release": "quick",
            "surfaces": [
                "greens",
                "tees",
                "bowling",
                "fairways",
                "sports"
            ],
            "season": [
                "spring",
                "summer"
            ],
            "analysis": {
                "N": 25,
                "P": 0,
                "K": 0,
                "Ca": 0,
                "Mg": 0,
                "Fe": 0
            },
            "npk_label": "25-0-0",
            "rates": {
                "greensMin": 2,
                "greensMax": 6,
                "fairwaysMin": 2,
                "fairwaysMax": 6,
                "sportsMin": 2,
                "sportsMax": 6
            },
            "rateUnit": "L/ha",
            "rates_kg_ha": {
                "greensMin": 20,
                "greensMax": 60,
                "fairwaysMin": 20,
                "fairwaysMax": 60,
                "sportsMin": 20,
                "sportsMax": 60
            },
            "interval_weeks": 3,
            "particleSize_mm": null,
            "notes": "Straight-N liquid. Tank-mixable across Nutri-Smart Liquid range. Foliar 20-60 L/ha in 300-500 L water; drench 40-100 L/ha in 600-900 L water. 14-45 day intervals. Source: aitkens.co.uk Vision Nutri-Smart Liquid 25-0-0 product page. LIQUID DECLARATION BASIS: not declared on Aitkens product page. UK turf liquids commonly use either % w/v (US convention, Aquatrols/some ICL labels) or % w/w (EU convention). At typical 1.25 kg/L density, a % w/v figure is approximately 1.25x the % w/w figure for the same product (e.g. 35% N w/v = 28% N w/w). SDS or product label needed to confirm which basis Aitkens has used for the figures shown.",
            "verified": true,
            "nForm": "review",
            "nFormConfidence": "review",
            "nFormReason": "Page does not declare N split. High-strength liquid N (25%) typically urea-dominant; confirm from SDS."
        },
        {
            "id": "vision-ns-liquid-16-3-6",
            "name": "Vision Nutri-Smart Liquid 16-3-6",
            "brand": "Vision Nutri-Smart Liquid",
            "supplier": "aitkens",
            "form": "liquid",
            "release": "quick",
            "surfaces": [
                "greens",
                "tees",
                "bowling",
                "fairways",
                "sports"
            ],
            "season": [
                "spring",
                "summer"
            ],
            "analysis": {
                "N": 16,
                "P": 1.31,
                "K": 4.98,
                "Ca": 0,
                "Mg": 0,
                "Fe": 0
            },
            "npk_label": "16-3-6",
            "rates": {
                "greensMin": 2,
                "greensMax": 6,
                "fairwaysMin": 2,
                "fairwaysMax": 6,
                "sportsMin": 2,
                "sportsMax": 6
            },
            "rateUnit": "L/ha",
            "rates_kg_ha": {
                "greensMin": 20,
                "greensMax": 60,
                "fairwaysMin": 20,
                "fairwaysMax": 60,
                "sportsMin": 20,
                "sportsMax": 60
            },
            "interval_weeks": 4,
            "particleSize_mm": null,
            "notes": "Balanced growing-season NPK. P is phosphate (root growth). Foliar 20-60 L/ha; drench 40-100 L/ha. 14-45 day intervals. Source: aitkens.co.uk Vision Nutri-Smart Liquid 16-3-6 product page. LIQUID DECLARATION BASIS: not declared on Aitkens product page. UK turf liquids commonly use either % w/v (US convention, Aquatrols/some ICL labels) or % w/w (EU convention). At typical 1.25 kg/L density, a % w/v figure is approximately 1.25x the % w/w figure for the same product (e.g. 35% N w/v = 28% N w/w). SDS or product label needed to confirm which basis Aitkens has used for the figures shown.",
            "verified": true,
            "nForm": "review",
            "nFormConfidence": "review",
            "nFormReason": "Page does not declare N split. Confirm from SDS."
        },
        {
            "id": "vision-ns-liquid-12-0-12",
            "name": "Vision Nutri-Smart Liquid 12-0-12",
            "brand": "Vision Nutri-Smart Liquid",
            "supplier": "aitkens",
            "form": "liquid",
            "release": "quick",
            "surfaces": [
                "greens",
                "tees",
                "bowling",
                "fairways",
                "sports"
            ],
            "season": [
                "spring",
                "summer",
                "autumn"
            ],
            "analysis": {
                "N": 12,
                "P": 0,
                "K": 9.96,
                "Ca": 0,
                "Mg": 0,
                "Fe": 0
            },
            "npk_label": "12-0-12",
            "rates": {
                "greensMin": 2,
                "greensMax": 6,
                "fairwaysMin": 2,
                "fairwaysMax": 6,
                "sportsMin": 2,
                "sportsMax": 6
            },
            "rateUnit": "L/ha",
            "rates_kg_ha": {
                "greensMin": 20,
                "greensMax": 60,
                "fairwaysMin": 20,
                "fairwaysMax": 60,
                "sportsMin": 20,
                "sportsMax": 60
            },
            "interval_weeks": 4,
            "particleSize_mm": null,
            "notes": "Balanced NK liquid for stress relief. Foliar 20-60 L/ha; drench 40-100 L/ha. 14-45 day intervals. Source: aitkens.co.uk Vision Nutri-Smart Liquid 12-0-12 product page. LIQUID DECLARATION BASIS: not declared on Aitkens product page. UK turf liquids commonly use either % w/v (US convention, Aquatrols/some ICL labels) or % w/w (EU convention). At typical 1.25 kg/L density, a % w/v figure is approximately 1.25x the % w/w figure for the same product (e.g. 35% N w/v = 28% N w/w). SDS or product label needed to confirm which basis Aitkens has used for the figures shown.",
            "verified": true,
            "nForm": "review",
            "nFormConfidence": "review",
            "nFormReason": "Page does not declare N split. Confirm from SDS."
        },
        {
            "id": "vision-ns-liquid-4-4-10",
            "name": "Vision Nutri-Smart Liquid 4-4-10",
            "brand": "Vision Nutri-Smart Liquid",
            "supplier": "aitkens",
            "form": "liquid",
            "release": "quick",
            "surfaces": [
                "greens",
                "tees",
                "bowling",
                "fairways",
                "sports"
            ],
            "season": [
                "autumn",
                "winter",
                "spring"
            ],
            "analysis": {
                "N": 4,
                "P": 1.75,
                "K": 8.3,
                "Ca": 0,
                "Mg": 0,
                "Fe": 0
            },
            "npk_label": "4-4-10",
            "rates": {
                "greensMin": 2,
                "greensMax": 6,
                "fairwaysMin": 2,
                "fairwaysMax": 6,
                "sportsMin": 2,
                "sportsMax": 6
            },
            "rateUnit": "L/ha",
            "rates_kg_ha": {
                "greensMin": 20,
                "greensMax": 60,
                "fairwaysMin": 20,
                "fairwaysMax": 60,
                "sportsMin": 20,
                "sportsMax": 60
            },
            "interval_weeks": 4,
            "particleSize_mm": null,
            "notes": "Low-N hardening / pre-seed support liquid. Mn + Cu emphasised for seasonal stress. Foliar 20-60 L/ha; drench 40-100 L/ha. 14-45 day intervals. Source: aitkens.co.uk Vision Nutri-Smart Liquid 4-4-10 product page. LIQUID DECLARATION BASIS: not declared on Aitkens product page. UK turf liquids commonly use either % w/v (US convention, Aquatrols/some ICL labels) or % w/w (EU convention). At typical 1.25 kg/L density, a % w/v figure is approximately 1.25x the % w/w figure for the same product (e.g. 35% N w/v = 28% N w/w). SDS or product label needed to confirm which basis Aitkens has used for the figures shown.",
            "verified": true,
            "nForm": "review",
            "nFormConfidence": "review",
            "nFormReason": "Page does not declare N split. Confirm from SDS."
        },
        {
            "id": "vision-ns-liquid-manganese",
            "name": "Vision Nutri-Smart Liquid Manganese",
            "brand": "Vision Nutri-Smart Liquid",
            "supplier": "aitkens",
            "form": "liquid",
            "release": "quick",
            "surfaces": [
                "greens",
                "tees",
                "bowling",
                "fairways",
                "sports"
            ],
            "season": [
                "spring",
                "summer",
                "autumn"
            ],
            "analysis": {
                "N": 2,
                "P": 0,
                "K": 0,
                "Ca": 0,
                "Mg": 0,
                "Fe": 0
            },
            "npk_label": "2-0-0 + 6.5%Mn",
            "rates": {
                "greensMin": 0.5,
                "greensMax": 1,
                "fairwaysMin": 0.5,
                "fairwaysMax": 1,
                "sportsMin": 0.5,
                "sportsMax": 1
            },
            "rateUnit": "L/ha",
            "rates_kg_ha": {
                "greensMin": 5,
                "greensMax": 10,
                "fairwaysMin": 5,
                "fairwaysMax": 10,
                "sportsMin": 5,
                "sportsMax": 10
            },
            "interval_weeks": 4,
            "particleSize_mm": null,
            "notes": "Concentrated Mn-sulphate-based liquid (6.5% Mn) + amino acids + RSi biostimulant + carbohydrates. Take-All Patch management (preventive, curative, recovery). Acidifying effect on stem base. 5-10 L/ha in 500 L water. 5L pack covers 5000-10000 m2. Schema note: Mn% not stored in base elemental analysis fields. Source: aitkens.co.uk Vision Nutri-Smart Liquid Manganese product page. LIQUID DECLARATION BASIS: not declared on Aitkens product page. UK turf liquids commonly use either % w/v (US convention, Aquatrols/some ICL labels) or % w/w (EU convention). At typical 1.25 kg/L density, a % w/v figure is approximately 1.25x the % w/w figure for the same product (e.g. 35% N w/v = 28% N w/w). SDS or product label needed to confirm which basis Aitkens has used for the figures shown.",
            "verified": true,
            "nForm": "ammonium",
            "nFormConfidence": "auto",
            "nFormReason": "Mn-sulphate is the active. The 2% N is most likely ammoniacal (ammonium sulphate carrier given the acidifying claim). Acidifying mechanism rules out nitrate-dominant chemistry."
        },
        {
            "id": "vision-ns-liquid-arrow",
            "name": "Vision Nutri-Smart Liquid Arrow",
            "brand": "Vision Nutri-Smart Liquid",
            "supplier": "aitkens",
            "form": "liquid",
            "release": "quick",
            "surfaces": [
                "greens",
                "tees",
                "bowling",
                "fairways",
                "sports"
            ],
            "season": [
                "spring",
                "summer",
                "autumn"
            ],
            "analysis": {
                "N": 0,
                "P": 0,
                "K": null,
                "Ca": 0,
                "Mg": 0,
                "Fe": 0
            },
            "npk_label": "K silicate",
            "rates": {
                "greensMin": 1,
                "greensMax": 1,
                "fairwaysMin": 1,
                "fairwaysMax": 1,
                "sportsMin": 1,
                "sportsMax": 1
            },
            "rateUnit": "L/ha",
            "rates_kg_ha": {
                "greensMin": 10,
                "greensMax": 10,
                "fairwaysMin": 10,
                "fairwaysMax": 10,
                "sportsMin": 10,
                "sportsMax": 10
            },
            "interval_weeks": 2,
            "particleSize_mm": null,
            "notes": "Potassium silicate. Tournament prep — vertical growth, faster green speeds, Poa seedhead easier mowing. 10 L/ha in 500 L water. Apply 2-4 days pre-tournament. 5L pack covers 5000 m2. Silica deposits in cell walls — wear/disease resistance. Source: aitkens.co.uk Vision Nutri-Smart Liquid Arrow product page. LIQUID DECLARATION BASIS: not declared on Aitkens product page. UK turf liquids commonly use either % w/v (US convention, Aquatrols/some ICL labels) or % w/w (EU convention). At typical 1.25 kg/L density, a % w/v figure is approximately 1.25x the % w/w figure for the same product (e.g. 35% N w/v = 28% N w/w). SDS or product label needed to confirm which basis Aitkens has used for the figures shown.",
            "verified": true,
            "nForm": "no_N",
            "nFormConfidence": "auto",
            "nFormReason": "K silicate. Zero N declared. No volatilisation pathway."
        },
        {
            "id": "aitkens-liquid-ammonium-sulphate",
            "name": "Aitkens Liquid Ammonium Sulphate",
            "brand": "Aitkens",
            "supplier": "aitkens",
            "form": "liquid",
            "release": "quick",
            "surfaces": [
                "greens",
                "tees",
                "bowling",
                "fairways",
                "sports"
            ],
            "season": [
                "spring",
                "summer",
                "autumn"
            ],
            "analysis": {
                "N": 10,
                "P": 0,
                "K": 0,
                "Ca": 0,
                "Mg": 0,
                "Fe": 0
            },
            "npk_label": "10-0-0 (ammonium sulphate)",
            "rates": {
                "greensMin": 3,
                "greensMax": 4,
                "fairwaysMin": 4,
                "fairwaysMax": 6,
                "sportsMin": 4,
                "sportsMax": 6
            },
            "rateUnit": "L/ha",
            "rates_kg_ha": {
                "greensMin": 30,
                "greensMax": 40,
                "fairwaysMin": 40,
                "fairwaysMax": 60,
                "sportsMin": 40,
                "sportsMax": 60
            },
            "interval_weeks": 2,
            "particleSize_mm": null,
            "notes": "10% N liquid ammonium sulphate. Acidifying. Disturbance Theory tool — push surface pH below 5.5 to favour fescues/bents over Poa annua. 40-60 L/ha standard courses, 30-40 L/ha links courses (30 L/ha = 3 kg N/ha). 700 L/ha water. 20L pack covers 3333-6666 m2. Source: aitkens.co.uk Aitkens Liquid Ammonium Sulphate product page (SDS aitkens_ammonium_sulphate_liquid_msds.pdf). LIQUID DECLARATION BASIS: not declared on Aitkens product page. UK turf liquids commonly use either % w/v (US convention, Aquatrols/some ICL) or % w/w (EU convention). SDS or product label needed to confirm which.",
            "verified": true,
            "nForm": "ammonium",
            "nFormConfidence": "sds",
            "nFormReason": "Ammonium sulphate by name and SDS. 100% ammoniacal N. Zero volatilisation risk. Acidifying mechanism via NH4+ nitrification → H+ release."
        },
        {
            "id": "terralift-tcl-advance-18-2-2",
            "name": "Terralift TCL Advance (18-2-2)",
            "brand": "Terralift",
            "supplier": "Aitkens (Terralift distributor)",
            "form": "liquid",
            "release": "slow",
            "surfaces": [
                "greens",
                "tees",
                "fairways",
                "sportsfields"
            ],
            "season": [
                "spring",
                "summer",
                "autumn"
            ],
            "analysis": {
                "N": 18,
                "P": 0.87,
                "K": 1.66,
                "Ca": 0,
                "Mg": 0,
                "Fe": 0
            },
            "npk_label": "18-2-2 + microbial growth regulators + organic acids",
            "rates": {
                "greensMin": 4,
                "greensMax": 6,
                "fairwaysMin": 4,
                "fairwaysMax": 6,
                "sportsMin": 4,
                "sportsMax": 6
            },
            "rateUnit": "L/ha",
            "rates_kg_ha": {
                "greensMin": 40,
                "greensMax": 60,
                "fairwaysMin": 40,
                "fairwaysMax": 60,
                "sportsMin": 40,
                "sportsMax": 60
            },
            "interval_weeks": 5,
            "particleSize_mm": null,
            "notes": "Liquid N-P-K with microbial growth regulators (microbial PGRs — natural cytokinin/auxin from microbial activity, NOT synthetic trinexapac/prohex class). Organic acids for colour hold. 4-6 week response. 40-60 L/ha in 400+ L water. 20 L pack covers 3333-5000 m². Formerly branded 'Terralift Microflora 18-2-2' (page meta retains old name). SDS sds_TERMICRO1822.PDF. Source: aitkens.co.uk Terralift TCL Advance product page (May 2026). LIQUID DECLARATION BASIS: not declared on Aitkens product page. UK turf liquids commonly use either % w/v (US convention, Aquatrols/some ICL) or % w/w (EU convention). SDS or product label needed to confirm which.",
            "verified": true,
            "nForm": "review",
            "nFormConfidence": "review",
            "nFormReason": "Page doesn't declare N split. 18% N is high; typical liquid formulations in this class use urea + organic acids. Microbial PGR claim does not change N classification. SDS check needed.",
            "discontinued": false
        },
        {
            "id": "terralift-tcl-strength-0-0-15",
            "name": "Terralift TCL Strength (0-0-15)",
            "brand": "Terralift",
            "supplier": "Aitkens (Terralift distributor)",
            "form": "liquid",
            "release": "quick",
            "surfaces": [
                "greens",
                "tees",
                "fairways"
            ],
            "season": [
                "spring",
                "summer",
                "autumn"
            ],
            "analysis": {
                "N": 0,
                "P": 0,
                "K": 12.45,
                "Ca": 0,
                "Mg": 0,
                "Fe": 0
            },
            "npk_label": "0-0-15 (chlorine-free K + chelating amino acids + microbial PGRs)",
            "rates": {
                "greensMin": 2,
                "greensMax": 4,
                "fairwaysMin": 2,
                "fairwaysMax": 4,
                "sportsMin": 2,
                "sportsMax": 4
            },
            "rateUnit": "L/ha",
            "rates_kg_ha": {
                "greensMin": 20,
                "greensMax": 40,
                "fairwaysMin": 20,
                "fairwaysMax": 40,
                "sportsMin": 20,
                "sportsMax": 40
            },
            "interval_weeks": 3,
            "particleSize_mm": null,
            "notes": "Chlorine-free liquid K (= K2SO4 or K-acetate source, NOT muriate of potash KCl) + chelating amino acids + microbial PGRs. Rapid absorption for cell-wall density. Shutdown growth / harden tool. Up to 3 week response. 20-40 L/ha in 400+ L water. 20 L pack covers 5000-10,000 m². Formerly 'Terralift Microflora 0-0-15'. SDS sds_TERMICRO0015.PDF. Source: aitkens.co.uk Terralift TCL Strength product page (May 2026). LIQUID DECLARATION BASIS: not declared on Aitkens product page. UK turf liquids commonly use either % w/v (US convention, Aquatrols/some ICL) or % w/w (EU convention). SDS or product label needed to confirm which.",
            "verified": true,
            "nForm": "no_N",
            "nFormConfidence": "auto",
            "nFormReason": "Zero N. No volatilisation pathway.",
            "discontinued": false
        },
        {
            "id": "vitax-seaturf-12-0-6",
            "name": "Vitax Seaturf Special (12-0-6)",
            "brand": "Vitax",
            "supplier": "aitkens",
            "form": "liquid",
            "release": "quick",
            "surfaces": [
                "greens",
                "tees",
                "fairways",
                "sportsfields"
            ],
            "season": [
                "spring",
                "summer",
                "autumn"
            ],
            "analysis": {
                "N": 12,
                "P": 0,
                "K": 4.98,
                "Ca": 0,
                "Mg": 0,
                "Fe": 0
            },
            "npk_label": "12-0-6 + seaweed",
            "rates": {
                "greensMin": 6.6,
                "greensMax": 6.6,
                "fairwaysMin": 6.6,
                "fairwaysMax": 6.6,
                "sportsMin": 6.6,
                "sportsMax": 6.6
            },
            "rateUnit": "L/ha",
            "rates_kg_ha": {
                "greensMin": 66,
                "greensMax": 66,
                "fairwaysMin": 66,
                "fairwaysMax": 66,
                "sportsMin": 66,
                "sportsMax": 66
            },
            "interval_weeks": 4,
            "particleSize_mm": null,
            "notes": "Seaweed-based liquid with 12% N + 6% K2O. 66 L/ha in 300-900 L water. 10 L pack covers 1515 m2 (= 66 L/ha matches). Marketed as seaweed stimulant for growing season. SDS sds_VITSEATURFSPECIAL.pdf. Source: aitkens.co.uk Vitax Seaturf Special product page (May 2026). LIQUID DECLARATION BASIS: not declared on Aitkens product page. UK turf liquids commonly use either % w/v (US convention, Aquatrols/some ICL labels) or % w/w (EU convention). At typical 1.25 kg/L density, a % w/v figure is approximately 1.25x the % w/w figure for the same product (e.g. 35% N w/v = 28% N w/w). SDS or product label needed to confirm which basis Aitkens has used for the figures shown.",
            "verified": true,
            "nForm": "review",
            "nFormConfidence": "review",
            "nFormReason": "Page declares no N split. Typical formulation in this class is urea (most cost-effective high-N liquid carrier) + seaweed base, but ammonium-N or N from seaweed itself is possible. Requires SDS confirmation."
        },
        {
            "id": "vitax-long-last-liquid-18-2-8",
            "name": "Vitax Long Last Liquid (18-2-8)",
            "brand": "Vitax",
            "supplier": "aitkens",
            "form": "liquid",
            "release": "slow",
            "surfaces": [
                "greens",
                "tees",
                "fairways",
                "sportsfields"
            ],
            "season": [
                "spring",
                "summer",
                "autumn"
            ],
            "analysis": {
                "N": 18,
                "P": 0.87,
                "K": 6.64,
                "Ca": 0,
                "Mg": 0,
                "Fe": 0
            },
            "npk_label": "18-2-8 (slow release N)",
            "rates": {
                "greensMin": 10,
                "greensMax": 10,
                "fairwaysMin": 10,
                "fairwaysMax": 10,
                "sportsMin": 10,
                "sportsMax": 10
            },
            "rateUnit": "L/ha",
            "rates_kg_ha": {
                "greensMin": 100,
                "greensMax": 100,
                "fairwaysMin": 100,
                "fairwaysMax": 100,
                "sportsMin": 100,
                "sportsMax": 100
            },
            "interval_weeks": 6,
            "particleSize_mm": null,
            "notes": "Slow-release N liquid with balanced 18-2-8 NPK. 100 L/ha in 400-1000 L water. 10 L pack covers 1000 m2 (= 100 L/ha matches). Positioned for sportsturf on sand-based or light soils where conventional N is leach-prone. SDS sds_VITLL1828.pdf. Source: aitkens.co.uk Vitax Long Last Liquid product page (May 2026). LIQUID DECLARATION BASIS: not declared on Aitkens product page. UK turf liquids commonly use either % w/v (US convention, Aquatrols/some ICL labels) or % w/w (EU convention). At typical 1.25 kg/L density, a % w/v figure is approximately 1.25x the % w/w figure for the same product (e.g. 35% N w/v = 28% N w/w). SDS or product label needed to confirm which basis Aitkens has used for the figures shown.",
            "verified": true,
            "nForm": "stabilised_urea",
            "nFormConfidence": "auto",
            "nFormReason": "Page declares 'slow release nitrogen' for a liquid product. Typical liquid SR-N chemistry is methylene urea (MU) or triazone-stabilised urea (UMAXX-type). Pending SDS confirmation. Low volatilisation risk vs straight urea."
        },
        {
            "id": "aquatrols-attain",
            "name": "Aquatrols Attain",
            "brand": "Aquatrols",
            "supplier": "Aitkens (Aquatrols distributor)",
            "form": "liquid",
            "release": "biostimulant",
            "surfaces": [
                "greens",
                "tees",
                "fairways",
                "sportsfields"
            ],
            "season": [
                "spring",
                "summer",
                "autumn"
            ],
            "analysis": {
                "N": 0,
                "P": 0,
                "K": 0,
                "Ca": 0,
                "Mg": 0,
                "Fe": 0
            },
            "npk_label": "Biostimulant (compost + kelp + seaweed + Fe, low N)",
            "rates": {
                "greensMin": 1,
                "greensMax": 1,
                "fairwaysMin": 1,
                "fairwaysMax": 1,
                "sportsMin": 1,
                "sportsMax": 1
            },
            "rateUnit": "L/ha",
            "rates_kg_ha": {
                "greensMin": 10,
                "greensMax": 10,
                "fairwaysMin": 10,
                "fairwaysMax": 10,
                "sportsMin": 10,
                "sportsMax": 10
            },
            "interval_weeks": 4,
            "particleSize_mm": null,
            "notes": "AquaVita bio-extraction technology. Contains compost bio-extracts + kelp solution + seaweed + iron + low N. Page rate: 10 L/ha in 300-600 L water/ha. 25 L pack covers 10,000 m². No NPK declared on page; SDS check needed for concentrations. Page meta title 'Farmura Porthcawl' is a legacy asset from Farmura UK distribution era pre-Aquatrols rebrand. Source: aitkens.co.uk Aquatrols Attain product page (May 2026). LIQUID DECLARATION BASIS: % w/v (mass per volume). The page dose table ties nutrient delivery to volume of product applied, which is the % w/v convention. Equivalent % w/w concentration is approximately 80% of the w/v figure at typical 1.25 kg/L liquid density.",
            "verified": true,
            "nForm": "review",
            "nFormConfidence": "review",
            "nFormReason": "Page describes 'low nitrogen' qualitatively but doesn't declare %N. SDS check needed to confirm N source (likely seaweed-derived organic + ammonium kicker)."
        },
        {
            "id": "aquatrols-flo-gro-complete",
            "name": "Aquatrols Flo-Gro Complete",
            "brand": "Aquatrols",
            "supplier": "Aitkens (Aquatrols distributor, Farmura-rebranded)",
            "form": "liquid",
            "release": "quick",
            "surfaces": [
                "greens",
                "tees",
                "fairways",
                "sportsfields"
            ],
            "season": [
                "spring",
                "summer",
                "autumn"
            ],
            "analysis": {
                "N": 17,
                "P": 1.75,
                "K": 9.96,
                "Ca": 0,
                "Mg": 0,
                "Fe": 0
            },
            "npk_label": "17-4-12 % w/v (back-calculated from page dose table)",
            "rates": {
                "greensMin": 1.2,
                "greensMax": 3,
                "fairwaysMin": 1.2,
                "fairwaysMax": 3,
                "sportsMin": 1.2,
                "sportsMax": 3
            },
            "rateUnit": "L/ha",
            "rates_kg_ha": {
                "greensMin": 12,
                "greensMax": 30,
                "fairwaysMin": 12,
                "fairwaysMax": 30,
                "sportsMin": 12,
                "sportsMax": 30
            },
            "interval_weeks": 4,
            "particleSize_mm": null,
            "notes": "Farmura Flo-Gro Complete rebranded as Aquatrols. NPK concentration back-calculated from page dose table (1 L/500m2 gives 4-1-3 kg/ha = 17-4-12 % w/v approx). The 17-4-12 figure is % w/v; the % w/w equivalent at typical 1.25 kg/L density is approximately 14-3-10. Page application range 12-30 L/ha in 300-600 L water/ha. 10 L pack covers 3333-12,500 m². Page dose table values don't reconcile linearly across all rates; lowest rate used for concentration estimate. SDS sds_FARFLOCOMPLETE.pdf retains Farmura filename prefix. Source: aitkens.co.uk Aquatrols Flo-Gro Complete product page (May 2026). LIQUID DECLARATION BASIS: % w/v (mass per volume). The page dose table ties nutrient delivery to volume of product applied, which is the % w/v convention. Equivalent % w/w concentration is approximately 80% of the w/v figure at typical 1.25 kg/L liquid density. Aquatrols Premium N 35-0-0 % w/v = Farmura Premium N 28-0-0 % w/w (same product, different convention).",
            "verified": true,
            "nForm": "review",
            "nFormConfidence": "review",
            "nFormReason": "Liquid NPK formulation; N source not declared on page. Likely urea + ammonium nitrate base. SDS check needed."
        },
        {
            "id": "aquatrols-flo-gro-ss",
            "name": "Aquatrols Flo-Gro Spring & Summer",
            "brand": "Aquatrols",
            "supplier": "Aitkens (Aquatrols distributor, Farmura-rebranded)",
            "form": "liquid",
            "release": "quick",
            "surfaces": [
                "greens",
                "tees",
                "fairways",
                "sportsfields"
            ],
            "season": [
                "spring",
                "summer"
            ],
            "analysis": {
                "N": 23,
                "P": 0,
                "K": 6.64,
                "Ca": 0,
                "Mg": 0,
                "Fe": 0
            },
            "npk_label": "~23-0-8 + S % w/v (back-calculated; concentration approximate)",
            "rates": {
                "greensMin": 1.1,
                "greensMax": 5,
                "fairwaysMin": 1.1,
                "fairwaysMax": 5,
                "sportsMin": 1.1,
                "sportsMax": 5
            },
            "rateUnit": "L/ha",
            "rates_kg_ha": {
                "greensMin": 11,
                "greensMax": 50,
                "fairwaysMin": 11,
                "fairwaysMax": 50,
                "sportsMin": 11,
                "sportsMax": 50
            },
            "interval_weeks": 4,
            "particleSize_mm": null,
            "notes": "Farmura Flo-Gro Spring & Summer rebranded as Aquatrols. Traditional N-K + sulphur starter. +5C soil temperature threshold for application. Suitable as mid-season booster. NPK back-calculated from page dose table (1.5 L/500m2 = 30 L/ha gives 7-0-2 kg/ha = ~23-0-8 % w/v approx); higher dose readings don't reconcile linearly. % w/w equivalent at 1.25 kg/L density is approximately 18-0-6. Page application range 11-50 L/ha in 300-600 L water/ha. 10 L pack covers 2000-9090 m2. SDS sds_FARFLOSPRING.pdf. Source: aitkens.co.uk Aquatrols Flo-Gro Spring & Summer product page (May 2026). LIQUID DECLARATION BASIS: % w/v (mass per volume). The page dose table ties nutrient delivery to volume of product applied, which is the % w/v convention. Equivalent % w/w concentration is approximately 80% of the w/v figure at typical 1.25 kg/L liquid density. Aquatrols Premium N 35-0-0 % w/v = Farmura Premium N 28-0-0 % w/w (same product, different convention).",
            "verified": true,
            "nForm": "review",
            "nFormConfidence": "review",
            "nFormReason": "Liquid N + S starter; N source not declared on page. Likely ammonium sulphate base given the S inclusion. SDS check needed."
        },
        {
            "id": "aquatrols-flo-gro-nk",
            "name": "Aquatrols Flo-Gro NK Special",
            "brand": "Aquatrols",
            "supplier": "Aitkens (Aquatrols distributor, Farmura-rebranded)",
            "form": "liquid",
            "release": "quick",
            "surfaces": [
                "greens",
                "tees",
                "fairways",
                "sportsfields"
            ],
            "season": [
                "spring",
                "summer",
                "autumn"
            ],
            "analysis": {
                "N": 23,
                "P": 0,
                "K": 15.77,
                "Ca": 0,
                "Mg": 0,
                "Fe": 0
            },
            "npk_label": "~23-0-19 % w/v (back-calculated)",
            "rates": {
                "greensMin": 1,
                "greensMax": 4,
                "fairwaysMin": 1,
                "fairwaysMax": 4,
                "sportsMin": 1,
                "sportsMax": 4
            },
            "rateUnit": "L/ha",
            "rates_kg_ha": {
                "greensMin": 10,
                "greensMax": 40,
                "fairwaysMin": 10,
                "fairwaysMax": 40,
                "sportsMin": 10,
                "sportsMax": 40
            },
            "interval_weeks": 4,
            "particleSize_mm": null,
            "notes": "Farmura Flo-Gro NK Special rebranded as Aquatrols. P-free formulation for sandy soils. NPK back-calculated from page dose table (1.3 L/500m2 = 26 L/ha gives 6-0-5 kg/ha = ~23-0-19 % w/v approx). % w/w equivalent at 1.25 kg/L density is approximately 18-0-15. Page application range 10-40 L/ha in 300-600 L water/ha. 10 L pack covers 2500-10,000 m2. SDS sds_FARFLONK.pdf. Source: aitkens.co.uk Aquatrols Flo-Gro NK Special product page (May 2026). LIQUID DECLARATION BASIS: % w/v (mass per volume). The page dose table ties nutrient delivery to volume of product applied, which is the % w/v convention. Equivalent % w/w concentration is approximately 80% of the w/v figure at typical 1.25 kg/L liquid density. Aquatrols Premium N 35-0-0 % w/v = Farmura Premium N 28-0-0 % w/w (same product, different convention).",
            "verified": true,
            "nForm": "review",
            "nFormConfidence": "review",
            "nFormReason": "Liquid N-K product, no declared N source. Sandy-soil positioning consistent with quick-uptake urea or ammonium. SDS check needed."
        },
        {
            "id": "aquatrols-flo-gro-super-n",
            "name": "Aquatrols Flo-Gro Super Nitrogen",
            "brand": "Aquatrols",
            "supplier": "Aitkens (Aquatrols distributor, Farmura-rebranded)",
            "form": "liquid",
            "release": "quick",
            "surfaces": [
                "greens",
                "tees",
                "fairways",
                "sportsfields"
            ],
            "season": [
                "summer"
            ],
            "analysis": {
                "N": 37,
                "P": 0,
                "K": 0,
                "Ca": 0,
                "Mg": 0,
                "Fe": 0
            },
            "npk_label": "~37-0-0 % w/v (back-calculated; equivalent to ~30-0-0 % w/w)",
            "rates": {
                "greensMin": 0.8,
                "greensMax": 5,
                "fairwaysMin": 0.8,
                "fairwaysMax": 5,
                "sportsMin": 0.8,
                "sportsMax": 5
            },
            "rateUnit": "L/ha",
            "rates_kg_ha": {
                "greensMin": 8,
                "greensMax": 50,
                "fairwaysMin": 8,
                "fairwaysMax": 50,
                "sportsMin": 8,
                "sportsMax": 50
            },
            "interval_weeks": 4,
            "particleSize_mm": null,
            "notes": "Farmura Flo-Gro Super Nitrogen rebranded as Aquatrols. High-N summer wear-recovery product. Concentration back-calculated from page dose table (1.5 L/500m2 = 30 L/ha gives 11-0-0 kg/ha = ~37% N w/v approx). % w/w equivalent at 1.25 kg/L density is approximately 30% N w/w. Page application range 8-50 L/ha in 300-600 L water/ha. 10 L pack covers 2000-7143 m2. SDS sds_FARFLOSUPERN.pdf. Source: aitkens.co.uk Aquatrols Flo-Gro Super Nitrogen product page (May 2026). LIQUID DECLARATION BASIS: % w/v (mass per volume). The page dose table ties nutrient delivery to volume of product applied, which is the % w/v convention. Equivalent % w/w concentration is approximately 80% of the w/v figure at typical 1.25 kg/L liquid density. Aquatrols Premium N 35-0-0 % w/v = Farmura Premium N 28-0-0 % w/w (same product, different convention).",
            "verified": true,
            "nForm": "review",
            "nFormConfidence": "review",
            "nFormReason": "37% N is very high for liquid; likely a UAN or urea-based formulation. SDS check needed to determine urea/ammonium/nitrate split for volatilisation routing."
        },
        {
            "id": "aquatrols-flo-gro-potash",
            "name": "Aquatrols Flo-Gro Potash Plus",
            "brand": "Aquatrols",
            "supplier": "Aitkens (Aquatrols distributor, Farmura-rebranded)",
            "form": "liquid",
            "release": "quick",
            "surfaces": [
                "greens",
                "tees",
                "fairways",
                "sportsfields"
            ],
            "season": [
                "autumn"
            ],
            "analysis": {
                "N": 0,
                "P": 0,
                "K": 8.3,
                "Ca": 0,
                "Mg": 0,
                "Fe": 0
            },
            "npk_label": "~0-0-10 K2O % w/v (back-calculated)",
            "rates": {
                "greensMin": 0.5,
                "greensMax": 4,
                "fairwaysMin": 0.5,
                "fairwaysMax": 4,
                "sportsMin": 0.5,
                "sportsMax": 4
            },
            "rateUnit": "L/ha",
            "rates_kg_ha": {
                "greensMin": 5,
                "greensMax": 40,
                "fairwaysMin": 5,
                "fairwaysMax": 40,
                "sportsMin": 5,
                "sportsMax": 40
            },
            "interval_weeks": 4,
            "particleSize_mm": null,
            "notes": "Farmura Flo-Gro Potash Plus rebranded as Aquatrols. Autumn K hardener. Concentration back-calculated from page dose table (1.5 L/500m2 = 30 L/ha gives 0-0-3 kg/ha K2O = ~10% K2O w/v approx). % w/w equivalent at 1.25 kg/L density is approximately 8% K2O w/w. Page has a typo: lists two entries at 2.5 L/500m2 with different deliveries (0-0-6 and 0-0-7); second entry likely intended as 3 L/500m2. Page application range 5-40 L/ha in 300-600 L water/ha. 10 L pack covers 2500-9090 m2. SDS sds_FARFLOPOTASH.pdf. Source: aitkens.co.uk Aquatrols Flo-Gro Potash Plus product page (May 2026). LIQUID DECLARATION BASIS: % w/v (mass per volume). The page dose table ties nutrient delivery to volume of product applied, which is the % w/v convention. Equivalent % w/w concentration is approximately 80% of the w/v figure at typical 1.25 kg/L liquid density. Aquatrols Premium N 35-0-0 % w/v = Farmura Premium N 28-0-0 % w/w (same product, different convention).",
            "verified": true,
            "nForm": "no_N",
            "nFormConfidence": "auto",
            "nFormReason": "K-only product, zero declared N."
        },
        {
            "id": "aquatrols-premium-n-35-0-0",
            "name": "Aquatrols Premium N (35-0-0)",
            "brand": "Aquatrols",
            "supplier": "Aitkens (Aquatrols distributor, Farmura-rebranded)",
            "form": "liquid",
            "release": "slow",
            "surfaces": [
                "greens",
                "tees",
                "fairways",
                "sportsfields"
            ],
            "season": [
                "spring",
                "summer",
                "autumn"
            ],
            "analysis": {
                "N": 35,
                "P": 0,
                "K": 0,
                "Ca": 0,
                "Mg": 0,
                "Fe": 0
            },
            "npk_label": "35-0-0 % w/v (= 28-0-0 % w/w; liquid urea-formaldehyde / methylene-urea slow-release)",
            "rates": {
                "greensMin": 1,
                "greensMax": 5,
                "fairwaysMin": 1,
                "fairwaysMax": 5,
                "sportsMin": 1,
                "sportsMax": 5
            },
            "rateUnit": "L/ha",
            "rates_kg_ha": {
                "greensMin": 10,
                "greensMax": 50,
                "fairwaysMin": 10,
                "fairwaysMax": 50,
                "sportsMin": 10,
                "sportsMax": 50
            },
            "interval_weeks": 6,
            "particleSize_mm": null,
            "notes": "Liquid urea-formaldehyde (UF / methylene-urea) slow-release N. Mix of immediate-available N + slow-release urea forms for sustained feeding. 35% N w/v on Aquatrols label is the SAME formulation as Farmura Premium N 28-0-0 w/w (density ~1.25 kg/L reconciles 28% w/w x 1.25 = 35% w/v). The Aitkens page meta title 'Farmura Premium N (28-0-0)' is the legacy w/w label; Aquatrols labels the same product on w/v convention. NOT a reformulation. Page rate: 10-50 L/ha in 250-500 L water/ha. 10 L pack covers 2000-10,000 m². SDS sds_FARPREMIUMN.pdf. Source: aitkens.co.uk Aquatrols Premium N (35-0-0) product page (May 2026). LIQUID DECLARATION BASIS: % w/v (mass per volume). The page dose table ties nutrient delivery to volume of product applied, which is the % w/v convention. Equivalent % w/w concentration is approximately 80% of the w/v figure at typical 1.25 kg/L liquid density. Aquatrols Premium N 35-0-0 % w/v = Farmura Premium N 28-0-0 % w/w (same product, different convention).",
            "verified": true,
            "nForm": "stabilised_urea",
            "nFormConfidence": "auto",
            "nFormReason": "Page declares urea-formaldehyde chemistry with quick + slow release forms. Methylene-urea / UF binds urea into stabilised polymers, reducing volatilisation versus straight urea. Engine should route as stabilised urea, not as standard urea."
        },
        {
            "id": "aquatrols-premium-k",
            "name": "Aquatrols Premium K",
            "brand": "Aquatrols",
            "supplier": "Aitkens (Aquatrols distributor)",
            "form": "liquid",
            "release": "quick",
            "surfaces": [
                "greens",
                "tees",
                "fairways"
            ],
            "season": [
                "autumn"
            ],
            "analysis": {
                "N": 0,
                "P": 0,
                "K": 0,
                "Ca": 0,
                "Mg": 0,
                "Fe": 0
            },
            "npk_label": "Liquid potassium acetate (chlorine-free; concentration not declared on page)",
            "rates": {
                "greensMin": 1,
                "greensMax": 5,
                "fairwaysMin": 1,
                "fairwaysMax": 5,
                "sportsMin": 1,
                "sportsMax": 5
            },
            "rateUnit": "L/ha",
            "rates_kg_ha": {
                "greensMin": 10,
                "greensMax": 50,
                "fairwaysMin": 10,
                "fairwaysMax": 50,
                "sportsMin": 10,
                "sportsMax": 50
            },
            "interval_weeks": 4,
            "particleSize_mm": null,
            "notes": "Potassium acetate liquid (chlorine-free, organic-acid based). Page claims 5x foliar uptake vs traditional KNO3/K2SO4/K2CO3 due to small molecule size + plant affinity for organic acids. Same chemistry class as Terralift TCL Strength (0-0-15). Autumn hardener + overseed germination booster. Page rate: 10-50 L/ha in 600 L water/ha. 10 L pack covers 2000-10,000 m². K2O CONCENTRATION NOT DECLARED on Aitkens page; product label or SDS needed for exact %. Source: aitkens.co.uk Aquatrols Premium K product page (May 2026). LIQUID DECLARATION BASIS: % w/v (mass per volume). The page dose table ties nutrient delivery to volume of product applied, which is the % w/v convention. Equivalent % w/w concentration is approximately 80% of the w/v figure at typical 1.25 kg/L liquid density.",
            "verified": true,
            "nForm": "no_N",
            "nFormConfidence": "auto",
            "nFormReason": "K-only product, zero declared N."
        },
        {
            "id": "aquatrols-combi",
            "name": "Aquatrols Combi",
            "brand": "Aquatrols",
            "supplier": "Aitkens (Aquatrols distributor, Farmura-rebranded)",
            "form": "liquid",
            "release": "quick",
            "surfaces": [
                "greens",
                "tees",
                "fairways",
                "sportsfields"
            ],
            "season": [
                "spring",
                "summer",
                "autumn"
            ],
            "analysis": {
                "N": 0,
                "P": 0,
                "K": 0,
                "Ca": 0,
                "Mg": 0,
                "Fe": 0
            },
            "npk_label": "Trace element foliar (chelated TEs; no NPK)",
            "rates": {
                "greensMin": 0.1,
                "greensMax": 0.2,
                "fairwaysMin": 0.1,
                "fairwaysMax": 0.2,
                "sportsMin": 0.1,
                "sportsMax": 0.2
            },
            "rateUnit": "L/ha",
            "rates_kg_ha": {
                "greensMin": 1,
                "greensMax": 2,
                "fairwaysMin": 1,
                "fairwaysMax": 2,
                "sportsMin": 1,
                "sportsMax": 2
            },
            "interval_weeks": 4,
            "particleSize_mm": null,
            "notes": "Trace-element-only foliar feed. Full range of fully chelated trace elements for deficiency correction. No NPK declared. Page rate: 1-2 L/ha in 100+ L water/ha. 1 L pack covers 500-10,000 m². Specific TE composition not declared on page; SDS check needed. SDS sds_FARCOMBI.pdf. Source: aitkens.co.uk Aquatrols Combi product page (May 2026). LIQUID DECLARATION BASIS: % w/v (mass per volume). The page dose table ties nutrient delivery to volume of product applied, which is the % w/v convention. Equivalent % w/w concentration is approximately 80% of the w/v figure at typical 1.25 kg/L liquid density.",
            "verified": true,
            "nForm": "no_N",
            "nFormConfidence": "auto",
            "nFormReason": "TE-only foliar, zero declared N."
        },
        {
            "id": "terralift-soilmax",
            "name": "Terralift Soilmax",
            "brand": "Terralift",
            "supplier": "Aitkens (Terralift distributor)",
            "form": "liquid",
            "release": "amendment",
            "analysis": {
                "N": 0,
                "P": 0,
                "K": 0,
                "Ca": 0,
                "Mg": 0,
                "Fe": 0
            },
            "npk_label": "low-pH humic acid blend (Ca activator)",
            "rates": {
                "greensMin": 3,
                "greensMax": 3,
                "fairwaysMin": 3,
                "fairwaysMax": 3,
                "sportsMin": 3,
                "sportsMax": 3
            },
            "rates_kg_ha": {
                "greensMin": 30,
                "greensMax": 30,
                "fairwaysMin": 30,
                "fairwaysMax": 30,
                "sportsMin": 30,
                "sportsMax": 30
            },
            "rateUnit": "L/ha",
            "interval_weeks": 8,
            "season": [
                "spring",
                "summer",
                "autumn"
            ],
            "surfaces": [
                "greens",
                "tees",
                "fairways",
                "sportsfields"
            ],
            "notes": "Low-pH humic acid blend. Activates calcium-bound plant elements; mobilises Ca, K and micronutrients; releases insoluble Ca in high-pH rootzones. 30 L/ha in 300+ L water. 20 L pack covers 6666 m². SDS sds_TERSOILMAX.PDF. Source: aitkens.co.uk Terralift Soilmax product page (May 2026).",
            "verified": true,
            "nForm": "no_N",
            "nFormConfidence": "auto",
            "nFormReason": "Humic acid amendment. Zero N. No volatilisation pathway."
        },
        {
            "id": "terralift-soilmax-plus",
            "name": "Terralift Soilmax Plus",
            "brand": "Terralift",
            "supplier": "Aitkens (Terralift distributor)",
            "form": "liquid",
            "release": "amendment",
            "analysis": {
                "N": 0,
                "P": 0,
                "K": 0,
                "Ca": 0,
                "Mg": 0,
                "Fe": 0
            },
            "npk_label": "high-pH acidifier (fermented plant acids)",
            "rates": {
                "greensMin": 3,
                "greensMax": 3,
                "fairwaysMin": 3,
                "fairwaysMax": 3,
                "sportsMin": 3,
                "sportsMax": 3
            },
            "rates_kg_ha": {
                "greensMin": 30,
                "greensMax": 30,
                "fairwaysMin": 30,
                "fairwaysMax": 30,
                "sportsMin": 30,
                "sportsMax": 30
            },
            "rateUnit": "L/ha",
            "interval_weeks": 8,
            "season": [
                "spring",
                "summer",
                "autumn"
            ],
            "surfaces": [
                "greens",
                "tees",
                "fairways",
                "sportsfields"
            ],
            "notes": "Soil and irrigation water acidifier. Fermented plant acids. Sulphur-free buffer for high-pH soils; boosts microbial activity and uptake of K, B, Mn, Zn. 30 L/ha in 300+ L water. 20 L pack covers 6666 m². SDS sds_TERSOILMAXPLUS.PDF. Source: aitkens.co.uk Terralift Soilmax Plus product page (May 2026).",
            "verified": true,
            "nForm": "no_N",
            "nFormConfidence": "auto",
            "nFormReason": "Fermented plant acid amendment. Zero N. No volatilisation pathway."
        },
        {
            "id": "terralift-rootmass",
            "name": "Terralift Rootmass",
            "brand": "Terralift",
            "supplier": "Aitkens (Terralift distributor)",
            "form": "liquid",
            "release": "biostimulant",
            "analysis": {
                "N": 0,
                "P": 0,
                "K": 0,
                "Ca": 0,
                "Mg": 0,
                "Fe": 0
            },
            "npk_label": "pre-digested kelp + rhizosphere microbes",
            "rates": {
                "greensMin": 1,
                "greensMax": 1,
                "fairwaysMin": 1,
                "fairwaysMax": 1,
                "sportsMin": 1,
                "sportsMax": 1
            },
            "rates_kg_ha": {
                "greensMin": 10,
                "greensMax": 10,
                "fairwaysMin": 10,
                "fairwaysMax": 10,
                "sportsMin": 10,
                "sportsMax": 10
            },
            "rateUnit": "L/ha",
            "interval_weeks": 4,
            "season": [
                "summer",
                "autumn"
            ],
            "surfaces": [
                "greens",
                "tees",
                "fairways",
                "sportsfields"
            ],
            "notes": "Pre-digested kelp fractions + rhizospheric microbe population. Balances nutrient uptake for slower hardier growth; increases root volume and depth. Summer/autumn/full-season programmes. 10 L/ha in 300+ L water. 10 L pack covers 1 ha. SDS sds_TERROOTMASS.PDF. Source: aitkens.co.uk Terralift Rootmass product page (May 2026).",
            "verified": true,
            "nForm": "no_N",
            "nFormConfidence": "auto",
            "nFormReason": "Kelp + microbe biostimulant. Zero declared N. No volatilisation pathway."
        },
        {
            "id": "terralift-plantmax",
            "name": "Terralift Plantmax",
            "brand": "Terralift",
            "supplier": "Aitkens (Terralift distributor)",
            "form": "liquid",
            "release": "biostimulant",
            "analysis": {
                "N": 0,
                "P": 0,
                "K": 0,
                "Ca": 0,
                "Mg": 0,
                "Fe": 0
            },
            "npk_label": "21% amino acids + 20% fulvic acid + casein protein + digested seaweed",
            "rates": {
                "greensMin": 1,
                "greensMax": 3,
                "fairwaysMin": 1,
                "fairwaysMax": 3,
                "sportsMin": 1,
                "sportsMax": 3
            },
            "rates_kg_ha": {
                "greensMin": 10,
                "greensMax": 30,
                "fairwaysMin": 10,
                "fairwaysMax": 30,
                "sportsMin": 10,
                "sportsMax": 30
            },
            "rateUnit": "L/ha",
            "interval_weeks": 4,
            "season": [
                "spring",
                "summer",
                "autumn"
            ],
            "surfaces": [
                "greens",
                "tees",
                "fairways",
                "sportsfields"
            ],
            "notes": "21% amino acids + enzymes in 20% fulvic acid solution + casein protein + digested seaweed + humic acid. Marketed as biostimulant + PGR effects (page claim of 'plant growth regulators' not chemically specified — likely seaweed-derived cytokinins/auxins, NOT trinexapac/prohex synthetic PGRs). Heightens vigour, colour, sward density; supports lower cutting heights. 10-30 L/ha in 300+ L water. 20 L pack covers 6666-20,000 m². SDS sds_TERPLANTMAX.PDF. Source: aitkens.co.uk Terralift Plantmax product page (May 2026).",
            "verified": true,
            "nForm": "no_N",
            "nFormConfidence": "auto",
            "nFormReason": "Amino acid/fulvic/seaweed biostimulant. Zero declared N. Amino-N is organic and not subject to volatilisation."
        },
        {
            "id": "terralift-rocastem",
            "name": "Terralift Rocastem",
            "brand": "Terralift",
            "supplier": "Aitkens (Terralift distributor)",
            "form": "liquid",
            "release": "biostimulant",
            "analysis": {
                "N": 0,
                "P": 0,
                "K": 0,
                "Ca": 0,
                "Mg": 0,
                "Fe": 0
            },
            "npk_label": "liquid aerator + microbial stimulant",
            "rates": {
                "greensMin": 1,
                "greensMax": 1,
                "fairwaysMin": 1,
                "fairwaysMax": 1,
                "sportsMin": 1,
                "sportsMax": 1
            },
            "rates_kg_ha": {
                "greensMin": 10,
                "greensMax": 10,
                "fairwaysMin": 10,
                "fairwaysMax": 10,
                "sportsMin": 10,
                "sportsMax": 10
            },
            "rateUnit": "L/ha",
            "interval_weeks": 6,
            "season": [
                "spring",
                "summer",
                "autumn",
                "winter"
            ],
            "surfaces": [
                "greens",
                "tees",
                "fairways",
                "sportsfields"
            ],
            "notes": "Liquid aerator and microbial stimulant. Page claims: de-compaction via percolation; indigenous microflora consumption of organic matter; drier warmer greens into winter. 'Liquid aeration' is industry rhetoric — mechanism is enhanced percolation and microbial activity, not physical aeration. 10 L/ha in 250+ L water. 10 L pack covers 1 ha. SDS rocastem_ab_sds_2019.pdf. Source: aitkens.co.uk Terralift Rocastem product page (May 2026).",
            "verified": true,
            "nForm": "no_N",
            "nFormConfidence": "auto",
            "nFormReason": "Microbial stimulant. Zero declared N. No volatilisation pathway."
        },
        {
            "id": "terralift-t-thatch",
            "name": "Terralift T-Thatch",
            "brand": "Terralift",
            "supplier": "Aitkens (Terralift distributor)",
            "form": "liquid",
            "release": "biostimulant",
            "analysis": {
                "N": 0,
                "P": 0,
                "K": null,
                "Ca": 0,
                "Mg": 0,
                "Fe": 0
            },
            "npk_label": "thatch microbes + K + microbe food",
            "rates": {
                "greensMin": 3.6,
                "greensMax": 4.8,
                "fairwaysMin": 3.6,
                "fairwaysMax": 4.8,
                "sportsMin": 3.6,
                "sportsMax": 4.8
            },
            "rates_kg_ha": {
                "greensMin": 36,
                "greensMax": 48,
                "fairwaysMin": 36,
                "fairwaysMax": 48,
                "sportsMin": 36,
                "sportsMax": 48
            },
            "rateUnit": "L/ha",
            "interval_weeks": 6,
            "season": [
                "spring",
                "summer",
                "autumn"
            ],
            "surfaces": [
                "greens",
                "tees"
            ],
            "notes": "Thatch-degrading microbe consortium + microbe food supply + K to harden grass and limit top growth during thatch breakdown. Page describes 'complete' treatment for severe or minor thatch. 36-48 L/ha in 400+ L water. 12 L pack covers 2500-3333 m². K% not declared on page — confirm from SDS. SDS sds_TERTTHATCH.PDF. Source: aitkens.co.uk Terralift T-Thatch product page (May 2026).",
            "verified": true,
            "nForm": "no_N",
            "nFormConfidence": "auto",
            "nFormReason": "Microbial + K product. Zero declared N. No volatilisation pathway."
        },
        {
            "id": "terralift-quadrop",
            "name": "Terralift Quadrop",
            "brand": "Terralift",
            "supplier": "Aitkens (Terralift distributor)",
            "form": "liquid",
            "release": "amendment",
            "analysis": {
                "N": 0,
                "P": 0,
                "K": 0,
                "Ca": 0,
                "Mg": 0,
                "Fe": 0
            },
            "npk_label": "irrigation water acidifier (bicarbonate reduction)",
            "rates": {},
            "rates_kg_ha": {},
            "rateUnit": "via Quadrop Injection System",
            "interval_weeks": null,
            "season": [
                "spring",
                "summer",
                "autumn",
                "winter"
            ],
            "surfaces": [
                "greens",
                "tees",
                "fairways"
            ],
            "notes": "Liquid additive for irrigation water quality. Bicarbonate reduction; improved percolation; reduced irrigation/fertiliser use; irrigation-system corrosion protection; earthworm inhibitor; foliar nutrient supplements. Dosed via the Quadrop Injection System (no per-application rate on product page — rate set by injection system). Targets chalk-aquifer / high-bicarbonate UK irrigation water. SDS quadropmsds.pdf + brochure new_terralift_quadrop.pdf. Source: aitkens.co.uk Terralift Quadrop product page (May 2026).",
            "verified": true,
            "nForm": "no_N",
            "nFormConfidence": "auto",
            "nFormReason": "Water acidifier. Zero declared N. No volatilisation pathway."
        }
    ]
};

    /**
     * Normalise supplier field — some entries use long distributor strings
     */
    function normaliseSupplier(p) {
        if (!p.supplier) return p;
        if (p.supplier.indexOf('Terralift') !== -1) { p.supplier = 'aitkens_terralift'; return p; }
        if (p.supplier.indexOf('Vitax') !== -1)     { p.supplier = 'aitkens_vitax';     return p; }
        if (p.supplier.indexOf('Aquatrols') !== -1) { p.supplier = 'aitkens_aquatrols'; return p; }
        // Also assign by brand field when supplier is generic 'aitkens'
        if (p.supplier === 'aitkens' && p.brand) {
            if (p.brand === 'Vitax')     { p.supplier = 'aitkens_vitax';     return p; }
            if (p.brand === 'Terralift') { p.supplier = 'aitkens_terralift'; return p; }
            if (p.brand === 'Aquatrols') { p.supplier = 'aitkens_aquatrols'; return p; }
        }
        return p;
    }

    var granularNorm = (AitkensProducts.granular || []).map(normaliseSupplier);
    var liquidNorm   = (AitkensProducts.liquid   || []).map(normaliseSupplier);

    function mergeIntoUK() {
        var uk = window.GAIP_UK_FERTILISER;
        if (!uk || !uk.products) return;
        uk.products.granular = (uk.products.granular || []).concat(granularNorm);
        uk.products.liquid   = (uk.products.liquid   || []).concat(liquidNorm);
        // Register supplier display names
        if (!uk.supplierDisplay) uk.supplierDisplay = {};
        uk.supplierDisplay['aitkens']           = 'Aitkens';
        uk.supplierDisplay['aitkens_terralift'] = 'Aitkens / Terralift';
        uk.supplierDisplay['aitkens_vitax']     = 'Aitkens / Vitax';
        uk.supplierDisplay['aitkens_aquatrols'] = 'Aitkens / Aquatrols';
    }

    if (typeof window !== 'undefined') {
        window.GAIP_AITKENS_FERTILISER = { granular: granularNorm, liquid: liquidNorm, version: '1.0.0' };

        // Merge immediately if UK products already loaded, else on DOMContentLoaded
        if (window.GAIP_UK_FERTILISER) {
            mergeIntoUK();
        } else {
            document.addEventListener('DOMContentLoaded', function() {
                if (window.GAIP_UK_FERTILISER) mergeIntoUK();
            });
        }
    }
})();
