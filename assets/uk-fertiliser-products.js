'use strict';

const UkFertiliserProducts = {
    "version": "1.0.0",
    "region": "UK",
    "surfaceSGN": {
        "greens": {
            "min": 0,
            "max": 150
        },
        "bowling": {
            "min": 0,
            "max": 150
        },
        "tees": {
            "min": 0,
            "max": 250
        },
        "fairways": {
            "min": 100,
            "max": 999
        },
        "sports": {
            "min": 100,
            "max": 999
        },
        "all": {
            "min": 0,
            "max": 999
        }
    },
    "granular": [
        {
            "id": "gm-pro-lite-spring-summer",
            "name": "Greenmaster Pro-Lite Spring & Summer",
            "brand": "Greenmaster Pro-Lite",
            "supplier": "icl",
            "form": "granular",
            "release": "quick",
            "sgn": 75,
            "particleSize_mm": null,
            "surfaces": [
                "greens",
                "tees",
                "bowling"
            ],
            "season": [
                "spring",
                "summer"
            ],
            "analysis": {
                "N": 14,
                "P": 2.18,
                "K": 8.3,
                "Mg": 0,
                "Ca": 0,
                "Fe": 2,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "14-5-10",
            "rates": {
                "greensMin": 150,
                "greensMax": 350,
                "teesMin": 250,
                "teesMax": 500
            },
            "rateUnit": "kg/ha",
            "interval_weeks": 6,
            "notes": "Rapid response micro-granule. Works in low temperatures. High N spring/summer workhorse for UK fine turf.",
            "verified": false,
            "nForm": "ammonium",
            "nFormConfidence": "auto",
            "nFormReason": "ICL Greenmaster Pro-Lite: ammonium-based micro-granule (confirmed from ICL product chemistry)"
        },
        {
            "id": "gm-pro-lite-autumn",
            "name": "Greenmaster Pro-Lite Autumn",
            "brand": "Greenmaster Pro-Lite",
            "supplier": "icl",
            "form": "granular",
            "release": "quick",
            "sgn": 75,
            "particleSize_mm": null,
            "surfaces": [
                "greens",
                "tees",
                "bowling"
            ],
            "season": [
                "autumn",
                "spring"
            ],
            "analysis": {
                "N": 6,
                "P": 2.18,
                "K": 8.3,
                "Mg": 0,
                "Ca": 0,
                "Fe": 6,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "6-5-10",
            "rates": {
                "greensMin": 150,
                "greensMax": 350,
                "teesMin": 250,
                "teesMax": 500
            },
            "rateUnit": "kg/ha",
            "interval_weeks": 6,
            "notes": "Low N, high Fe. Autumn hardening or first app of season. Reduces risk of sappy growth.",
            "verified": false,
            "nForm": "ammonium",
            "nFormConfidence": "auto",
            "nFormReason": "ICL Greenmaster Pro-Lite: ammonium-based micro-granule (confirmed from ICL product chemistry)"
        },
        {
            "id": "gm-pro-lite-autumn-mg",
            "name": "Greenmaster Pro-Lite Autumn Mg",
            "brand": "Greenmaster Pro-Lite",
            "supplier": "icl",
            "form": "granular",
            "release": "quick",
            "sgn": 75,
            "particleSize_mm": null,
            "surfaces": [
                "greens",
                "tees",
                "bowling"
            ],
            "season": [
                "autumn",
                "spring"
            ],
            "analysis": {
                "N": 6,
                "P": 2.18,
                "K": 8.3,
                "Mg": 2,
                "Ca": 0,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "6-5-10+Mg",
            "rates": {
                "greensMin": 150,
                "greensMax": 350,
                "teesMin": 250,
                "teesMax": 500
            },
            "rateUnit": "kg/ha",
            "interval_weeks": 6,
            "notes": "Low iron variant with added Mg. Avoids Fe staining risk. Useful where Mg deficit flagged on soil test.",
            "verified": false,
            "nForm": "ammonium",
            "nFormConfidence": "auto",
            "nFormReason": "ICL Greenmaster Pro-Lite: ammonium-based micro-granule (confirmed from ICL product chemistry)"
        },
        {
            "id": "gm-pro-lite-cold-start",
            "name": "Greenmaster Pro-Lite Cold Start",
            "brand": "Greenmaster Pro-Lite",
            "supplier": "icl",
            "form": "granular",
            "release": "quick",
            "sgn": 75,
            "particleSize_mm": null,
            "surfaces": [
                "greens",
                "tees",
                "bowling"
            ],
            "season": [
                "spring"
            ],
            "analysis": {
                "N": 6,
                "P": 3.49,
                "K": 8.3,
                "Mg": 0,
                "Ca": 0,
                "Fe": 6,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "6-8-10",
            "rates": {
                "greensMin": 150,
                "greensMax": 350,
                "teesMin": 250,
                "teesMax": 500
            },
            "rateUnit": "kg/ha",
            "interval_weeks": 6,
            "notes": "Designed for early spring use in UK cool conditions. Higher P promotes root activity. Contains Fe.",
            "verified": false,
            "nForm": "ammonium",
            "nFormConfidence": "auto",
            "nFormReason": "ICL Greenmaster Pro-Lite: ammonium-based micro-granule (confirmed from ICL product chemistry)"
        },
        {
            "id": "gm-pro-lite-nk",
            "name": "Greenmaster Pro-Lite NK",
            "brand": "Greenmaster Pro-Lite",
            "supplier": "icl",
            "form": "granular",
            "release": "quick",
            "sgn": 75,
            "particleSize_mm": null,
            "surfaces": [
                "greens",
                "tees",
                "bowling"
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
                "Mg": 0,
                "Ca": 0,
                "Fe": 2,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "12-0-12",
            "rates": {
                "greensMin": 150,
                "greensMax": 350,
                "teesMin": 250,
                "teesMax": 500
            },
            "rateUnit": "kg/ha",
            "interval_weeks": 6,
            "notes": "P-free NK formula. Use where soil P is adequate, MLSN recommended to guide P omission.",
            "verified": false,
            "nForm": "ammonium",
            "nFormConfidence": "auto",
            "nFormReason": "ICL Greenmaster Pro-Lite: ammonium-based micro-granule (confirmed from ICL product chemistry)"
        },
        {
            "id": "gm-pro-lite-pro-iron",
            "name": "Greenmaster Pro-Lite Pro Iron",
            "brand": "Greenmaster Pro-Lite",
            "supplier": "icl",
            "form": "granular",
            "release": "quick",
            "sgn": 75,
            "particleSize_mm": null,
            "surfaces": [
                "greens",
                "tees",
                "bowling"
            ],
            "season": [
                "autumn",
                "winter",
                "spring"
            ],
            "analysis": {
                "N": 4,
                "P": 0,
                "K": 4.15,
                "Mg": 2,
                "Ca": 0,
                "Fe": 8,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "4-0-5+Mg+Fe",
            "rates": {
                "greensMin": 150,
                "greensMax": 250,
                "teesMin": 200,
                "teesMax": 350
            },
            "rateUnit": "kg/ha",
            "interval_weeks": 6,
            "notes": "Colour response without growth. High Fe + Mg. Year-round use. Cooler conditions.",
            "verified": false,
            "nForm": "ammonium",
            "nFormConfidence": "auto",
            "nFormReason": "ICL Greenmaster Pro-Lite: ammonium-based micro-granule (confirmed from ICL product chemistry)"
        },
        {
            "id": "gm-pro-lite-invigorator",
            "name": "Greenmaster Pro-Lite Invigorator",
            "brand": "Greenmaster Pro-Lite",
            "supplier": "icl",
            "form": "granular",
            "release": "quick",
            "sgn": 75,
            "particleSize_mm": null,
            "surfaces": [
                "greens",
                "tees",
                "bowling"
            ],
            "season": [
                "spring",
                "autumn"
            ],
            "analysis": {
                "N": 4,
                "P": 0,
                "K": 6.64,
                "Mg": 0,
                "Ca": 0,
                "Fe": 6,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "4-0-8",
            "rates": {
                "greensMin": 150,
                "greensMax": 350,
                "teesMin": 250,
                "teesMax": 500
            },
            "rateUnit": "kg/ha",
            "interval_weeks": 6,
            "notes": "Low N high K hardener. First app of season or autumn conditioning.",
            "verified": false,
            "nForm": "ammonium",
            "nFormConfidence": "auto",
            "nFormReason": "ICL Greenmaster Pro-Lite: ammonium-based micro-granule (confirmed from ICL product chemistry)"
        },
        {
            "id": "gm-pro-lite-invigorator-plus",
            "name": "Greenmaster Pro-Lite Invigorator Plus",
            "brand": "Greenmaster Pro-Lite",
            "supplier": "icl",
            "form": "granular",
            "release": "quick",
            "sgn": 75,
            "particleSize_mm": null,
            "surfaces": [
                "greens",
                "tees",
                "bowling"
            ],
            "season": [
                "autumn",
                "winter"
            ],
            "analysis": {
                "N": 4,
                "P": 1.31,
                "K": 11.62,
                "Mg": 0,
                "Ca": 0,
                "Fe": 8,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "4-3-14",
            "rates": {
                "greensMin": 150,
                "greensMax": 350,
                "teesMin": 250,
                "teesMax": 500
            },
            "rateUnit": "kg/ha",
            "interval_weeks": 6,
            "notes": "Autumn/winter hardener. Higher K and Fe than standard Invigorator. Good pre-stress conditioning.",
            "verified": false,
            "nForm": "ammonium",
            "nFormConfidence": "auto",
            "nFormReason": "ICL Greenmaster Pro-Lite: ammonium-based micro-granule (confirmed from ICL product chemistry)"
        },
        {
            "id": "gm-turf-tonic",
            "name": "Greenmaster Turf Tonic",
            "brand": "Greenmaster",
            "supplier": "icl",
            "form": "granular",
            "release": "quick",
            "sgn": 75,
            "particleSize_mm": null,
            "surfaces": [
                "greens",
                "tees",
                "bowling"
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
                "Mg": 0,
                "Ca": 0,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "8-0-0",
            "rates": {
                "greensMin": 150,
                "greensMax": 250,
                "teesMin": 200,
                "teesMax": 350
            },
            "rateUnit": "kg/ha",
            "interval_weeks": 4,
            "notes": "Nitrogen-only tonic. Use to supplement between full-nutrition applications or during high growth demand.",
            "verified": false,
            "nForm": "ammonium",
            "nFormConfidence": "auto",
            "nFormReason": "ICL Greenmaster Pro-Lite: ammonium-based micro-granule (confirmed from ICL product chemistry)"
        },
        {
            "id": "gm-pro-lite-double-k-calmag",
            "name": "Greenmaster Pro-Lite Double K CalMag",
            "brand": "Greenmaster Pro-Lite",
            "supplier": "icl",
            "form": "granular",
            "release": "quick",
            "sgn": 75,
            "particleSize_mm": null,
            "surfaces": [
                "greens",
                "tees",
                "bowling"
            ],
            "season": [
                "summer",
                "autumn"
            ],
            "analysis": {
                "N": 6,
                "P": 0,
                "K": 13.28,
                "Mg": 2,
                "Ca": 2,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "6-0-16+Ca+Mg",
            "rates": {
                "greensMin": 150,
                "greensMax": 350,
                "teesMin": 250,
                "teesMax": 500
            },
            "rateUnit": "kg/ha",
            "interval_weeks": 6,
            "notes": "High K + Ca + Mg. Wear and disease resistance. Summer stress period and autumn hardening.",
            "verified": false,
            "nForm": "ammonium",
            "nFormConfidence": "auto",
            "nFormReason": "ICL Greenmaster Pro-Lite: ammonium-based micro-granule (confirmed from ICL product chemistry)"
        },
        {
            "id": "sportsmaster-spring-summer",
            "name": "Sportsmaster Spring & Summer",
            "brand": "Sportsmaster",
            "supplier": "icl",
            "form": "granular",
            "release": "quick",
            "sgn": 150,
            "particleSize_mm": null,
            "surfaces": [
                "fairways",
                "sports",
                "tees"
            ],
            "season": [
                "spring",
                "summer"
            ],
            "analysis": {
                "N": 14,
                "P": 2.18,
                "K": 8.3,
                "Mg": 0,
                "Ca": 0,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "14-5-10",
            "rates": {
                "teesMin": 250,
                "teesMax": 500,
                "fairwaysMin": 350,
                "fairwaysMax": 750,
                "sportsMin": 350,
                "sportsMax": 750
            },
            "rateUnit": "kg/ha",
            "interval_weeks": 6,
            "notes": "Conventional quick-release. Rapid granule breakdown. Urea + ammonium N, no chloride-K. Spring/summer outfield use.",
            "verified": false,
            "nForm": "mixed",
            "nFormConfidence": "auto",
            "nFormReason": "Sportsmaster: urea + ammonium N sources (confirmed from ICL description, no chloride-K)"
        },
        {
            "id": "sportsmaster-autumn",
            "name": "Sportsmaster Autumn",
            "brand": "Sportsmaster",
            "supplier": "icl",
            "form": "granular",
            "release": "quick",
            "sgn": 150,
            "particleSize_mm": null,
            "surfaces": [
                "fairways",
                "sports",
                "tees"
            ],
            "season": [
                "autumn",
                "spring"
            ],
            "analysis": {
                "N": 6,
                "P": 2.18,
                "K": 12.45,
                "Mg": 0,
                "Ca": 0,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "6-5-15",
            "rates": {
                "teesMin": 250,
                "teesMax": 500,
                "fairwaysMin": 350,
                "fairwaysMax": 750,
                "sportsMin": 350,
                "sportsMax": 750
            },
            "rateUnit": "kg/ha",
            "interval_weeks": 6,
            "notes": "Autumn hardening or pre-stress conditioning. Low N high K.",
            "verified": false,
            "nForm": "mixed",
            "nFormConfidence": "auto",
            "nFormReason": "Sportsmaster: urea + ammonium N sources (confirmed from ICL description, no chloride-K)"
        },
        {
            "id": "sportsmaster-nk",
            "name": "Sportsmaster NK",
            "brand": "Sportsmaster",
            "supplier": "icl",
            "form": "granular",
            "release": "quick",
            "sgn": 150,
            "particleSize_mm": null,
            "surfaces": [
                "fairways",
                "sports",
                "tees"
            ],
            "season": [
                "spring",
                "summer"
            ],
            "analysis": {
                "N": 14,
                "P": 0,
                "K": 8.3,
                "Mg": 2,
                "Ca": 0,
                "Fe": 4,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "14-0-10+Mg+Fe",
            "rates": {
                "teesMin": 250,
                "teesMax": 500,
                "fairwaysMin": 350,
                "fairwaysMax": 750,
                "sportsMin": 350,
                "sportsMax": 750
            },
            "rateUnit": "kg/ha",
            "interval_weeks": 6,
            "notes": "P-free NK with Mg and Fe. Spring and summer. Use where P is adequate on soil test.",
            "verified": false,
            "nForm": "mixed",
            "nFormConfidence": "auto",
            "nFormReason": "Sportsmaster: urea + ammonium N sources (confirmed from ICL description, no chloride-K)"
        },
        {
            "id": "sportsmaster-pre-seeder",
            "name": "Sportsmaster Pre-Seeder",
            "brand": "Sportsmaster",
            "supplier": "icl",
            "form": "granular",
            "release": "quick",
            "sgn": 150,
            "particleSize_mm": null,
            "surfaces": [
                "fairways",
                "sports"
            ],
            "season": [
                "spring",
                "autumn"
            ],
            "analysis": {
                "N": 9,
                "P": 8.72,
                "K": 8.3,
                "Mg": 0,
                "Ca": 0,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "9-20-10",
            "rates": {
                "fairwaysMin": 350,
                "fairwaysMax": 750,
                "sportsMin": 350,
                "sportsMax": 750
            },
            "rateUnit": "kg/ha",
            "interval_weeks": null,
            "notes": "Pre-seeding / overseeding establishment. High P to stimulate root development.",
            "verified": false,
            "nForm": "mixed",
            "nFormConfidence": "auto",
            "nFormReason": "Sportsmaster: urea + ammonium N sources (confirmed from ICL description, no chloride-K)"
        },
        {
            "id": "polyon-12-0-25-3-4m",
            "name": "Polyon 12-0-25 (3-4 months)",
            "brand": "Polyon",
            "supplier": "icl",
            "form": "granular",
            "release": "controlled",
            "releaseDuration_months": {
                "min": 3,
                "max": 4
            },
            "sgn": 250,
            "particleSize_mm": null,
            "surfaces": [
                "fairways",
                "sports",
                "tees"
            ],
            "season": [
                "autumn",
                "winter"
            ],
            "analysis": {
                "N": 12,
                "P": 0,
                "K": 20.75,
                "Mg": 0,
                "Ca": 0,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "12-0-25",
            "rates": {
                "teesMin": 250,
                "teesMax": 500,
                "fairwaysMin": 350,
                "fairwaysMax": 750,
                "sportsMin": 350,
                "sportsMax": 750
            },
            "rateUnit": "kg/ha",
            "interval_weeks": null,
            "notes": "High K CRF. Autumn/winter hardening. 3-4 month longevity reduces applications.",
            "verified": true,
            "nForm": "urea_pcu",
            "nFormConfidence": "auto",
            "nFormReason": "CRF polymer-coated urea, all UK CRF products in database use PCU technology"
        },
        {
            "id": "polyon-15-0-10-4-5m",
            "name": "Polyon 15-0-10 (4-5 months)",
            "brand": "Polyon",
            "supplier": "icl",
            "form": "granular",
            "release": "controlled",
            "releaseDuration_months": {
                "min": 4,
                "max": 5
            },
            "sgn": 250,
            "particleSize_mm": null,
            "surfaces": [
                "fairways",
                "sports",
                "tees"
            ],
            "season": [
                "spring",
                "summer"
            ],
            "analysis": {
                "N": 15,
                "P": 0,
                "K": 8.3,
                "Mg": 2,
                "Ca": 0,
                "Fe": 2,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "15-0-10",
            "rates": {
                "teesMin": 250,
                "teesMax": 500,
                "fairwaysMin": 350,
                "fairwaysMax": 750,
                "sportsMin": 350,
                "sportsMax": 750
            },
            "rateUnit": "kg/ha",
            "interval_weeks": null,
            "notes": "Balanced N:K CRF. Mg and Fe added for colour. 4-5 month longevity.",
            "verified": true,
            "nForm": "urea_pcu",
            "nFormConfidence": "auto",
            "nFormReason": "CRF polymer-coated urea, all UK CRF products in database use PCU technology"
        },
        {
            "id": "polyon-15-0-30-fine-6-7m",
            "name": "Polyon 15-0-30 Fine (6-7 months)",
            "brand": "Polyon",
            "supplier": "icl",
            "form": "granular",
            "release": "controlled",
            "releaseDuration_months": {
                "min": 6,
                "max": 7
            },
            "sgn": 150,
            "particleSize_mm": null,
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
                "N": 15,
                "P": 0,
                "K": 24.9,
                "Mg": 0,
                "Ca": 0,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "15-0-30",
            "rates": {
                "greensMin": 250,
                "greensMax": 500,
                "teesMin": 250,
                "teesMax": 500,
                "fairwaysMin": 350,
                "fairwaysMax": 750
            },
            "rateUnit": "kg/ha",
            "interval_weeks": null,
            "notes": "Fine-grade high-K CRF. 6-7 month release. Autumn single application strategy for greens and tees.",
            "verified": true,
            "nForm": "urea_pcu",
            "nFormConfidence": "auto",
            "nFormReason": "CRF polymer-coated urea, all UK CRF products in database use PCU technology"
        },
        {
            "id": "polyon-15-5-15-4-5m",
            "name": "Polyon 15-5-15 (4-5 months)",
            "brand": "Polyon",
            "supplier": "icl",
            "form": "granular",
            "release": "controlled",
            "releaseDuration_months": {
                "min": 4,
                "max": 5
            },
            "sgn": 250,
            "particleSize_mm": null,
            "surfaces": [
                "fairways",
                "sports",
                "tees"
            ],
            "season": [
                "spring",
                "summer"
            ],
            "analysis": {
                "N": 15,
                "P": 2.18,
                "K": 12.45,
                "Mg": 0,
                "Ca": 0,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "15-5-15",
            "rates": {
                "teesMin": 250,
                "teesMax": 500,
                "fairwaysMin": 350,
                "fairwaysMax": 750,
                "sportsMin": 350,
                "sportsMax": 750
            },
            "rateUnit": "kg/ha",
            "interval_weeks": null,
            "notes": "Balanced NPK CRF. Full nutrition in one application. 4-5 month longevity.",
            "verified": true,
            "nForm": "urea_pcu",
            "nFormConfidence": "auto",
            "nFormReason": "CRF polymer-coated urea, all UK CRF products in database use PCU technology"
        },
        {
            "id": "polyon-18-0-8-4-5m",
            "name": "Polyon 18-0-8 (4-5 months)",
            "brand": "Polyon",
            "supplier": "icl",
            "form": "granular",
            "release": "controlled",
            "releaseDuration_months": {
                "min": 4,
                "max": 5
            },
            "sgn": 250,
            "particleSize_mm": null,
            "surfaces": [
                "fairways",
                "sports"
            ],
            "season": [
                "spring",
                "summer"
            ],
            "analysis": {
                "N": 18,
                "P": 0,
                "K": 6.64,
                "Mg": 0,
                "Ca": 0,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "18-0-8",
            "rates": {
                "fairwaysMin": 350,
                "fairwaysMax": 750,
                "sportsMin": 350,
                "sportsMax": 750
            },
            "rateUnit": "kg/ha",
            "interval_weeks": null,
            "notes": "High N summer CRF. Outfield and sports field growth season.",
            "verified": true,
            "nForm": "urea_pcu",
            "nFormConfidence": "auto",
            "nFormReason": "CRF polymer-coated urea, all UK CRF products in database use PCU technology"
        },
        {
            "id": "polyon-20-5-8-3-4m",
            "name": "Polyon 20-5-8 (3-4 months)",
            "brand": "Polyon",
            "supplier": "icl",
            "form": "granular",
            "release": "controlled",
            "releaseDuration_months": {
                "min": 3,
                "max": 4
            },
            "sgn": 250,
            "particleSize_mm": null,
            "surfaces": [
                "fairways",
                "sports"
            ],
            "season": [
                "spring",
                "summer"
            ],
            "analysis": {
                "N": 20,
                "P": 2.18,
                "K": 6.64,
                "Mg": 0,
                "Ca": 0,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "20-5-8",
            "rates": {
                "fairwaysMin": 350,
                "fairwaysMax": 750,
                "sportsMin": 350,
                "sportsMax": 750
            },
            "rateUnit": "kg/ha",
            "interval_weeks": null,
            "notes": "High N spring/summer CRF. Standard granule, outfields and sports pitches.",
            "verified": true,
            "nForm": "urea_pcu",
            "nFormConfidence": "auto",
            "nFormReason": "CRF polymer-coated urea, all UK CRF products in database use PCU technology"
        },
        {
            "id": "polyon-20-5-8-fine-3-4m",
            "name": "Polyon 20-5-8 Fine (3-4 months)",
            "brand": "Polyon",
            "supplier": "icl",
            "form": "granular",
            "release": "controlled",
            "releaseDuration_months": {
                "min": 3,
                "max": 4
            },
            "sgn": 150,
            "particleSize_mm": null,
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
                "N": 20,
                "P": 2.18,
                "K": 6.64,
                "Mg": 0,
                "Ca": 0,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "20-5-8 Fine",
            "rates": {
                "greensMin": 250,
                "greensMax": 500,
                "teesMin": 250,
                "teesMax": 500,
                "fairwaysMin": 350,
                "fairwaysMax": 750
            },
            "rateUnit": "kg/ha",
            "interval_weeks": null,
            "notes": "Fine-grade 20-5-8. Suitable for greens and tees as well as fairways.",
            "verified": true,
            "nForm": "urea_pcu",
            "nFormConfidence": "auto",
            "nFormReason": "CRF polymer-coated urea, all UK CRF products in database use PCU technology"
        },
        {
            "id": "polyon-24-5-8-6-7m",
            "name": "Polyon 24-5-8 (6-7 months)",
            "brand": "Polyon",
            "supplier": "icl",
            "form": "granular",
            "release": "controlled",
            "releaseDuration_months": {
                "min": 6,
                "max": 7
            },
            "sgn": 250,
            "particleSize_mm": null,
            "surfaces": [
                "fairways",
                "sports"
            ],
            "season": [
                "spring"
            ],
            "analysis": {
                "N": 24,
                "P": 2.18,
                "K": 6.64,
                "Mg": 0,
                "Ca": 0,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "24-5-8",
            "rates": {
                "fairwaysMin": 350,
                "fairwaysMax": 750,
                "sportsMin": 350,
                "sportsMax": 750
            },
            "rateUnit": "kg/ha",
            "interval_weeks": null,
            "notes": "Long-season spring CRF. Single application covers spring through autumn.",
            "verified": true,
            "nForm": "urea_pcu",
            "nFormConfidence": "auto",
            "nFormReason": "CRF polymer-coated urea, all UK CRF products in database use PCU technology"
        },
        {
            "id": "polyon-24-5-8-fine-6-7m",
            "name": "Polyon 24-5-8 Fine (6-7 months)",
            "brand": "Polyon",
            "supplier": "icl",
            "form": "granular",
            "release": "controlled",
            "releaseDuration_months": {
                "min": 6,
                "max": 7
            },
            "sgn": 150,
            "particleSize_mm": null,
            "surfaces": [
                "greens",
                "tees",
                "fairways"
            ],
            "season": [
                "spring"
            ],
            "analysis": {
                "N": 24,
                "P": 2.18,
                "K": 6.64,
                "Mg": 0,
                "Ca": 0,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "24-5-8 Fine",
            "rates": {
                "greensMin": 250,
                "greensMax": 500,
                "teesMin": 250,
                "teesMax": 500,
                "fairwaysMin": 350,
                "fairwaysMax": 750
            },
            "rateUnit": "kg/ha",
            "interval_weeks": null,
            "notes": "Fine-grade long-season CRF. Greens, tees and fairways from a single spring application.",
            "verified": true,
            "nForm": "urea_pcu",
            "nFormConfidence": "auto",
            "nFormReason": "CRF polymer-coated urea, all UK CRF products in database use PCU technology"
        },
        {
            "id": "floranid-twin-club",
            "name": "Floranid Twin Club",
            "brand": "Floranid Twin",
            "supplier": "agrovista",
            "form": "granular",
            "release": "slow",
            "releaseNotes": "ISODUR+CROTODUR double N technology (~4 months)",
            "sgn": 200,
            "particleSize_mm": null,
            "surfaces": [
                "greens",
                "tees",
                "bowling",
                "fairways"
            ],
            "season": [
                "spring",
                "summer",
                "autumn"
            ],
            "analysis": {
                "N": 10,
                "P": 2.18,
                "K": 16.6,
                "Mg": 0,
                "Ca": 0,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "10-5-20",
            "rates": {
                "greensMin": 250,
                "greensMax": 500,
                "teesMin": 250,
                "teesMax": 500,
                "fairwaysMin": 350,
                "fairwaysMax": 750
            },
            "rateUnit": "kg/ha",
            "interval_weeks": null,
            "notes": "High K slow-release. Fine turf club/sports formula. Up to 4 months N release.",
            "verified": true,
            "nForm": "urea_mu",
            "nFormConfidence": "auto",
            "nFormReason": "Floranid Twin ISODUR+CROTODUR confirmed methylene urea technology"
        },
        {
            "id": "floranid-twin-nk",
            "name": "Floranid Twin NK",
            "brand": "Floranid Twin",
            "supplier": "agrovista",
            "form": "granular",
            "release": "slow",
            "releaseNotes": "ISODUR+CROTODUR (~4 months)",
            "sgn": 200,
            "particleSize_mm": null,
            "surfaces": [
                "greens",
                "tees",
                "bowling",
                "fairways"
            ],
            "season": [
                "spring",
                "summer",
                "autumn"
            ],
            "analysis": {
                "N": 14,
                "P": 0,
                "K": 15.77,
                "Mg": 0,
                "Ca": 0,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "14-0-19",
            "rates": {
                "greensMin": 250,
                "greensMax": 500,
                "teesMin": 250,
                "teesMax": 500,
                "fairwaysMin": 350,
                "fairwaysMax": 750
            },
            "rateUnit": "kg/ha",
            "interval_weeks": null,
            "notes": "P-free slow-release NK. Use where soil P is adequate. High K for stress tolerance.",
            "verified": true,
            "nForm": "urea_mu",
            "nFormConfidence": "auto",
            "nFormReason": "Floranid Twin ISODUR+CROTODUR confirmed methylene urea technology"
        },
        {
            "id": "floranid-twin-permanent",
            "name": "Floranid Twin Permanent",
            "brand": "Floranid Twin",
            "supplier": "agrovista",
            "form": "granular",
            "release": "slow",
            "releaseNotes": "ISODUR+CROTODUR (~4 months)",
            "sgn": 200,
            "particleSize_mm": null,
            "surfaces": [
                "fairways",
                "sports",
                "tees"
            ],
            "season": [
                "spring",
                "summer"
            ],
            "analysis": {
                "N": 16,
                "P": 3.05,
                "K": 12.45,
                "Mg": 0,
                "Ca": 0,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "16-7-15",
            "rates": {
                "teesMin": 250,
                "teesMax": 500,
                "fairwaysMin": 350,
                "fairwaysMax": 750,
                "sportsMin": 350,
                "sportsMax": 750
            },
            "rateUnit": "kg/ha",
            "interval_weeks": null,
            "notes": "General purpose slow-release. Balanced for outfields and sports turf.",
            "verified": true,
            "nForm": "urea_mu",
            "nFormConfidence": "auto",
            "nFormReason": "Floranid Twin ISODUR+CROTODUR confirmed methylene urea technology"
        },
        {
            "id": "floranid-twin-turf-bs",
            "name": "Floranid Twin Turf BS (with Bacillus)",
            "brand": "Floranid Twin",
            "supplier": "agrovista",
            "form": "granular",
            "release": "slow",
            "releaseNotes": "ISODUR+CROTODUR + Bacillus subtilis biostimulant",
            "sgn": 200,
            "particleSize_mm": null,
            "surfaces": [
                "greens",
                "tees",
                "bowling",
                "fairways"
            ],
            "season": [
                "spring",
                "summer",
                "autumn"
            ],
            "analysis": {
                "N": 20,
                "P": 2.18,
                "K": 6.64,
                "Mg": 2,
                "Ca": 0,
                "Fe": 0,
                "Mn": 0,
                "S": 22.5
            },
            "npk_label": "20-5-8",
            "rates": {
                "greensMin": 250,
                "greensMax": 500,
                "teesMin": 250,
                "teesMax": 500,
                "fairwaysMin": 350,
                "fairwaysMax": 750
            },
            "rateUnit": "kg/ha",
            "interval_weeks": null,
            "notes": "Contains Bacillus subtilis for added biological activity. Spring/summer. Slow-release N.",
            "verified": false,
            "nForm": "urea_mu",
            "nFormConfidence": "auto",
            "nFormReason": "Floranid Twin ISODUR+CROTODUR confirmed methylene urea technology"
        },
        {
            "id": "floranid-twin-eagle-master",
            "name": "Floranid Twin Eagle Master",
            "brand": "Floranid Twin",
            "supplier": "agrovista",
            "form": "granular",
            "release": "slow",
            "releaseNotes": "ISODUR+CROTODUR fine granule for greens/tees",
            "sgn": 100,
            "particleSize_mm": null,
            "surfaces": [
                "greens",
                "tees",
                "bowling"
            ],
            "season": [
                "spring",
                "summer",
                "autumn"
            ],
            "analysis": {
                "N": 16,
                "P": 2.18,
                "K": 8.3,
                "Mg": 0,
                "Ca": 0,
                "Fe": 4,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "16-5-10",
            "rates": {
                "greensMin": 200,
                "greensMax": 40,
                "teesMin": 20,
                "teesMax": 40
            },
            "rateUnit": "kg/ha",
            "interval_weeks": null,
            "notes": "Fine granule for greens and tees. Slow-release N via double ISODUR/CROTODUR technology. Promotes root growth.",
            "verified": false,
            "nForm": "urea_mu",
            "nFormConfidence": "auto",
            "nFormReason": "Floranid Twin ISODUR+CROTODUR confirmed methylene urea technology"
        },
        {
            "id": "novatec-classic",
            "name": "NovaTec Classic",
            "brand": "NovaTec",
            "supplier": "agrovista",
            "form": "granular",
            "release": "stabilised",
            "releaseNotes": "DMPP nitrification inhibitor (4-10 weeks active)",
            "sgn": 250,
            "particleSize_mm": null,
            "surfaces": [
                "fairways",
                "sports",
                "tees"
            ],
            "season": [
                "spring",
                "summer"
            ],
            "analysis": {
                "N": 12,
                "P": 3.49,
                "K": 13.28,
                "Mg": 3,
                "Ca": 0,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "12-8-16+3MgO+TE",
            "rates": {
                "teesMin": 250,
                "teesMax": 500,
                "fairwaysMin": 350,
                "fairwaysMax": 750,
                "sportsMin": 350,
                "sportsMax": 750
            },
            "rateUnit": "kg/ha",
            "interval_weeks": null,
            "notes": "DMPP stabilised NPK. Reduces N leaching risk. +Mg and trace elements. Good for spring and summer.",
            "verified": true,
            "nForm": "ammonium_ni",
            "nFormConfidence": "auto",
            "nFormReason": "NovaTec: ammonium sulphate + DMPP nitrification inhibitor (not urea-based)"
        },
        {
            "id": "novatec-n-max",
            "name": "NovaTec N-Max",
            "brand": "NovaTec",
            "supplier": "agrovista",
            "form": "granular",
            "release": "stabilised",
            "releaseNotes": "DMPP nitrification inhibitor",
            "sgn": 250,
            "particleSize_mm": null,
            "surfaces": [
                "fairways",
                "sports"
            ],
            "season": [
                "spring",
                "summer"
            ],
            "analysis": {
                "N": 24,
                "P": 2.18,
                "K": 4.15,
                "Mg": 2,
                "Ca": 0,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "24-5-5+2MgO+TE",
            "rates": {
                "fairwaysMin": 350,
                "fairwaysMax": 750,
                "sportsMin": 350,
                "sportsMax": 750
            },
            "rateUnit": "kg/ha",
            "interval_weeks": null,
            "notes": "High N DMPP stabilised. Spring growth stimulation. Outfields and sports pitches.",
            "verified": true,
            "nForm": "ammonium_ni",
            "nFormConfidence": "auto",
            "nFormReason": "NovaTec: ammonium sulphate + DMPP nitrification inhibitor (not urea-based)"
        },
        {
            "id": "novatec-premium",
            "name": "NovaTec Premium",
            "brand": "NovaTec",
            "supplier": "agrovista",
            "form": "granular",
            "release": "stabilised",
            "releaseNotes": "DMPP nitrification inhibitor",
            "sgn": 250,
            "particleSize_mm": null,
            "surfaces": [
                "fairways",
                "sports",
                "tees"
            ],
            "season": [
                "spring",
                "summer",
                "autumn"
            ],
            "analysis": {
                "N": 15,
                "P": 1.31,
                "K": 16.6,
                "Mg": 2,
                "Ca": 0,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "15-3-20+2MgO+TE",
            "rates": {
                "teesMin": 250,
                "teesMax": 500,
                "fairwaysMin": 350,
                "fairwaysMax": 750,
                "sportsMin": 350,
                "sportsMax": 750
            },
            "rateUnit": "kg/ha",
            "interval_weeks": null,
            "notes": "High K DMPP stabilised. Good autumn/spring use for hardening with DMPP N efficiency benefit.",
            "verified": true,
            "nForm": "ammonium_ni",
            "nFormConfidence": "auto",
            "nFormReason": "NovaTec: ammonium sulphate + DMPP nitrification inhibitor (not urea-based)"
        },
        {
            "id": "absolute-advanced-green",
            "name": "Absolute Advanced Green",
            "brand": "Absolute Advanced",
            "supplier": "agrovista",
            "form": "granular",
            "release": "quick",
            "sgn": 75,
            "particleSize_mm": null,
            "surfaces": [
                "greens",
                "tees",
                "bowling"
            ],
            "season": [
                "spring",
                "summer"
            ],
            "analysis": {
                "N": 12,
                "P": 0,
                "K": 6.64,
                "Mg": 0,
                "Ca": 0,
                "Fe": 6,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "12-0-8+Fe",
            "rates": {
                "greensMin": 150,
                "greensMax": 350,
                "teesMin": 250,
                "teesMax": 500
            },
            "rateUnit": "kg/ha",
            "interval_weeks": 6,
            "notes": "Micro-granular fine turf formula. Green-up colour response. Needs SDS verification.",
            "verified": false,
            "nForm": "ammonium",
            "nFormConfidence": "review",
            "nFormReason": "Absolute range: conventional quick-release, likely ammonium; confirm from SDS"
        },
        {
            "id": "absolute-advanced-thrive",
            "name": "Absolute Advanced Thrive",
            "brand": "Absolute Advanced",
            "supplier": "agrovista",
            "form": "granular",
            "release": "quick",
            "sgn": 75,
            "particleSize_mm": null,
            "surfaces": [
                "greens",
                "tees",
                "bowling"
            ],
            "season": [
                "spring",
                "summer"
            ],
            "analysis": {
                "N": 14,
                "P": 2.18,
                "K": 8.3,
                "Mg": 0,
                "Ca": 0,
                "Fe": 2,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "14-5-10",
            "rates": {
                "greensMin": 150,
                "greensMax": 350,
                "teesMin": 250,
                "teesMax": 500
            },
            "rateUnit": "kg/ha",
            "interval_weeks": 6,
            "notes": "Micro-granular fine turf growth formula. All values need SDS verification.",
            "verified": false,
            "nForm": "ammonium",
            "nFormConfidence": "review",
            "nFormReason": "Absolute range: conventional quick-release, likely ammonium; confirm from SDS"
        },
        {
            "id": "absolute-advanced-entrench",
            "name": "Absolute Advanced Entrench",
            "brand": "Absolute Advanced",
            "supplier": "agrovista",
            "form": "granular",
            "release": "quick",
            "sgn": 75,
            "particleSize_mm": null,
            "surfaces": [
                "greens",
                "tees",
                "bowling"
            ],
            "season": [
                "autumn",
                "winter"
            ],
            "analysis": {
                "N": 4,
                "P": 0,
                "K": 12.45,
                "Mg": 0,
                "Ca": 0,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "4-0-15",
            "rates": {
                "greensMin": 150,
                "greensMax": 350,
                "teesMin": 250,
                "teesMax": 500
            },
            "rateUnit": "kg/ha",
            "interval_weeks": 6,
            "notes": "Autumn hardening / disease resistance formula. All values need SDS verification.",
            "verified": false,
            "nForm": "ammonium",
            "nFormConfidence": "review",
            "nFormReason": "Absolute range: conventional quick-release, likely ammonium; confirm from SDS"
        },
        {
            "id": "absolute-premier-20-10-10",
            "name": "Absolute Premier 20-10-10",
            "brand": "Absolute Premier",
            "supplier": "agrovista",
            "form": "granular",
            "release": "quick",
            "sgn": 150,
            "particleSize_mm": null,
            "surfaces": [
                "fairways",
                "sports",
                "tees"
            ],
            "season": [
                "spring",
                "summer"
            ],
            "analysis": {
                "N": 20,
                "P": 4.36,
                "K": 8.3,
                "Mg": 0,
                "Ca": 0,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "20-10-10",
            "rates": {
                "teesMin": 250,
                "teesMax": 500,
                "fairwaysMin": 350,
                "fairwaysMax": 750,
                "sportsMin": 350,
                "sportsMax": 750
            },
            "rateUnit": "kg/ha",
            "interval_weeks": 6,
            "notes": "High N establishment and growth. Spring renovation or high-demand turf.",
            "verified": true,
            "nForm": "ammonium",
            "nFormConfidence": "review",
            "nFormReason": "Absolute range: conventional quick-release, likely ammonium; confirm from SDS"
        },
        {
            "id": "absolute-premier-12-6-6",
            "name": "Absolute Premier 12-6-6",
            "brand": "Absolute Premier",
            "supplier": "agrovista",
            "form": "granular",
            "release": "quick",
            "sgn": 150,
            "particleSize_mm": null,
            "surfaces": [
                "fairways",
                "sports",
                "tees"
            ],
            "season": [
                "spring",
                "summer",
                "autumn"
            ],
            "analysis": {
                "N": 12,
                "P": 2.62,
                "K": 4.98,
                "Mg": 0,
                "Ca": 0,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "12-6-6",
            "rates": {
                "teesMin": 250,
                "teesMax": 500,
                "fairwaysMin": 350,
                "fairwaysMax": 750,
                "sportsMin": 350,
                "sportsMax": 750
            },
            "rateUnit": "kg/ha",
            "interval_weeks": 6,
            "notes": "Balanced mini-granular. General purpose outfield nutrition.",
            "verified": true,
            "nForm": "ammonium",
            "nFormConfidence": "review",
            "nFormReason": "Absolute range: conventional quick-release, likely ammonium; confirm from SDS"
        },
        {
            "id": "absolute-premier-3-3-12",
            "name": "Absolute Premier 3-3-12",
            "brand": "Absolute Premier",
            "supplier": "agrovista",
            "form": "granular",
            "release": "quick",
            "sgn": 150,
            "particleSize_mm": null,
            "surfaces": [
                "fairways",
                "sports"
            ],
            "season": [
                "autumn",
                "winter"
            ],
            "analysis": {
                "N": 3,
                "P": 1.31,
                "K": 9.96,
                "Mg": 0,
                "Ca": 0,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "3-3-12",
            "rates": {
                "fairwaysMin": 350,
                "fairwaysMax": 750,
                "sportsMin": 350,
                "sportsMax": 750
            },
            "rateUnit": "kg/ha",
            "interval_weeks": 6,
            "notes": "Low N high K autumn hardening formula.",
            "verified": true,
            "nForm": "ammonium",
            "nFormConfidence": "review",
            "nFormReason": "Absolute range: conventional quick-release, likely ammonium; confirm from SDS"
        },
        {
            "id": "absolute-premier-6-9-6",
            "name": "Absolute Premier 6-9-6",
            "brand": "Absolute Premier",
            "supplier": "agrovista",
            "form": "granular",
            "release": "quick",
            "sgn": 150,
            "particleSize_mm": null,
            "surfaces": [
                "fairways",
                "sports"
            ],
            "season": [
                "spring",
                "autumn"
            ],
            "analysis": {
                "N": 6,
                "P": 3.92,
                "K": 4.98,
                "Mg": 0,
                "Ca": 0,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "6-9-6",
            "rates": {
                "fairwaysMin": 350,
                "fairwaysMax": 750,
                "sportsMin": 350,
                "sportsMax": 750
            },
            "rateUnit": "kg/ha",
            "interval_weeks": 6,
            "notes": "High P formula for renovation or establishment. Spring or autumn use.",
            "verified": true,
            "nForm": "ammonium",
            "nFormConfidence": "review",
            "nFormReason": "Absolute range: conventional quick-release, likely ammonium; confirm from SDS"
        },
        {
            "id": "absolute-premier-9-7-7",
            "name": "Absolute Premier 9-7-7",
            "brand": "Absolute Premier",
            "supplier": "agrovista",
            "form": "granular",
            "release": "quick",
            "sgn": 150,
            "particleSize_mm": null,
            "surfaces": [
                "fairways",
                "sports",
                "tees"
            ],
            "season": [
                "spring",
                "summer",
                "autumn"
            ],
            "analysis": {
                "N": 9,
                "P": 3.05,
                "K": 5.81,
                "Mg": 0,
                "Ca": 0,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "9-7-7",
            "rates": {
                "teesMin": 250,
                "teesMax": 500,
                "fairwaysMin": 350,
                "fairwaysMax": 750,
                "sportsMin": 350,
                "sportsMax": 750
            },
            "rateUnit": "kg/ha",
            "interval_weeks": 6,
            "notes": "Balanced all-round outfield formula.",
            "verified": true,
            "nForm": "ammonium",
            "nFormConfidence": "review",
            "nFormReason": "Absolute range: conventional quick-release, likely ammonium; confirm from SDS"
        },
        {
            "id": "ferro-top",
            "name": "Ferro Top",
            "brand": "Ferro Top",
            "supplier": "agrovista",
            "form": "granular",
            "release": "quick",
            "sgn": 200,
            "particleSize_mm": null,
            "surfaces": [
                "greens",
                "tees",
                "fairways",
                "bowling"
            ],
            "season": [
                "autumn",
                "winter",
                "spring"
            ],
            "analysis": {
                "N": 6,
                "P": 0,
                "K": 9.96,
                "Mg": 6,
                "Ca": 0,
                "Fe": 8,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "6-0-12+6MgO+8Fe",
            "rates": {
                "greensMin": 15,
                "greensMax": 35,
                "teesMin": 20,
                "teesMax": 50,
                "fairwaysMin": 300,
                "fairwaysMax": 60
            },
            "rateUnit": "kg/ha",
            "interval_weeks": 6,
            "notes": "Fe speciality with high Mg and K. Colour without growth. Manganese included, confirm SDS.",
            "verified": false,
            "nForm": "mixed",
            "nFormConfidence": "review",
            "nFormReason": "Quick-release granular: N source not confirmed from public data; request SDS"
        },
        {
            "id": "kali-gazon",
            "name": "Kali Gazon",
            "brand": "Kali Gazon",
            "supplier": "agrovista",
            "form": "granular",
            "release": "quick",
            "sgn": 200,
            "particleSize_mm": null,
            "surfaces": [
                "all"
            ],
            "season": [
                "autumn",
                "winter"
            ],
            "analysis": {
                "N": 0,
                "P": 0,
                "K": 22.41,
                "Mg": 0,
                "Ca": 0,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "0-0-27+Mg+S",
            "rates": {
                "greensMin": 15,
                "greensMax": 30,
                "fairwaysMin": 300,
                "fairwaysMax": 60,
                "sportsMin": 30,
                "sportsMax": 60
            },
            "rateUnit": "kg/ha",
            "interval_weeks": null,
            "notes": "High K stress conditioning. No N. Drought, disease and cold tolerance support. Confirm Mg and S levels from SDS.",
            "verified": false,
            "nForm": "no_N",
            "nFormConfidence": "auto",
            "nFormReason": "No nitrogen in analysis"
        },
        {
            "id": "potassium-nitrate-granules",
            "name": "Potassium Nitrate Granules",
            "brand": "Potassium Nitrate",
            "supplier": "agrovista",
            "form": "granular",
            "release": "quick",
            "sgn": 200,
            "particleSize_mm": null,
            "surfaces": [
                "all"
            ],
            "season": [
                "autumn",
                "winter",
                "spring"
            ],
            "analysis": {
                "N": 13.85,
                "P": 0,
                "K": 38.67,
                "Mg": 0,
                "Ca": 0,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "14-0-46 (as K2O)",
            "rates": {
                "greensMin": 100,
                "greensMax": 200,
                "teesMin": 100,
                "teesMax": 250,
                "fairwaysMin": 150,
                "fairwaysMax": 400
            },
            "rateUnit": "kg/ha",
            "interval_weeks": 4,
            "notes": "No sulphur. Ideal autumn/winter/early spring. Chloride-free K source. Product description confirms no sulphur.",
            "verified": true,
            "nForm": "nitrate",
            "nFormConfidence": "auto",
            "nFormReason": "Potassium nitrate (KNO3): 100% nitrate-N, negligible volatilisation risk. Preferred N form for seashore paspalum (Duncan & Carrow 2000); use ~40-50% lower N rates than bermudagrass."
        },
        {
            "id": "regen-fine-4-0-4-fe",
            "name": "ReGen Fine 4-0-4 +9%Fe",
            "brand": "ReGen Fine",
            "supplier": "regen",
            "form": "granular",
            "release": "quick",
            "sgn": 75,
            "particleSize_mm": null,
            "surfaces": [
                "greens",
                "tees",
                "bowling"
            ],
            "season": [
                "autumn",
                "winter",
                "spring"
            ],
            "analysis": {
                "N": 4,
                "P": 0,
                "K": 3.32,
                "Mg": 0,
                "Ca": 0,
                "Fe": 9,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "4-0-4+9%Fe",
            "rates": {
                "greensMin": 150,
                "greensMax": 350,
                "teesMin": 200,
                "teesMax": 400
            },
            "rateUnit": "kg/ha",
            "interval_weeks": 6,
            "notes": "Very high Fe micro-granule. Colour response without growth. Autumn/winter fine turf. Confirm K as K2O or elemental from SDS.",
            "verified": false,
            "nForm": "ammonium",
            "nFormConfidence": "review",
            "nFormReason": "ReGen Fine micro-granule: likely ammonium; confirm from SDS"
        },
        {
            "id": "regen-fine-8-0-4-mg-seaweed",
            "name": "ReGen Fine 8.0.4 +2%MgO + Seaweed",
            "brand": "ReGen Fine",
            "supplier": "regen",
            "form": "granular",
            "release": "quick",
            "sgn": 75,
            "particleSize_mm": null,
            "surfaces": [
                "greens",
                "tees",
                "bowling"
            ],
            "season": [
                "spring",
                "summer",
                "autumn"
            ],
            "analysis": {
                "N": 8,
                "P": 0,
                "K": 3.32,
                "Mg": 1.21,
                "Ca": 0,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "8-0-4+2%MgO+Seaweed",
            "rates": {
                "greensMin": 150,
                "greensMax": 350,
                "teesMin": 200,
                "teesMax": 400
            },
            "rateUnit": "kg/ha",
            "interval_weeks": 6,
            "notes": "Seaweed biostimulant component. Moderate N + Mg. Spring/summer fine turf. Seaweed source/species not specified on website, request SDS.",
            "verified": false,
            "nForm": "ammonium",
            "nFormConfidence": "review",
            "nFormReason": "ReGen Fine micro-granule: likely ammonium; confirm from SDS"
        },
        {
            "id": "regen-fine-12-0-9-fe-mg",
            "name": "ReGen Fine 12.0.9 +2%Fe +2%MgO",
            "brand": "ReGen Fine",
            "supplier": "regen",
            "form": "granular",
            "release": "quick",
            "sgn": 75,
            "particleSize_mm": null,
            "surfaces": [
                "greens",
                "tees",
                "bowling"
            ],
            "season": [
                "spring",
                "summer"
            ],
            "analysis": {
                "N": 12,
                "P": 0,
                "K": 7.47,
                "Mg": 1.21,
                "Ca": 0,
                "Fe": 2,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "12-0-9+2%Fe+2%MgO",
            "rates": {
                "greensMin": 150,
                "greensMax": 350,
                "teesMin": 200,
                "teesMax": 400
            },
            "rateUnit": "kg/ha",
            "interval_weeks": 6,
            "notes": "Higher N fine turf summer formula with Fe and Mg. P-free.",
            "verified": false,
            "nForm": "ammonium",
            "nFormConfidence": "review",
            "nFormReason": "ReGen Fine micro-granule: likely ammonium; confirm from SDS"
        },
        {
            "id": "regen-diverse-5-2-10-mg",
            "name": "ReGen Diverse 5.2.10 +2%MgO",
            "brand": "ReGen Soil Amendments",
            "supplier": "regen",
            "form": "granular",
            "release": "organic",
            "sgn": 150,
            "particleSize_mm": null,
            "surfaces": [
                "greens",
                "tees",
                "fairways",
                "bowling"
            ],
            "season": [
                "spring",
                "autumn"
            ],
            "analysis": {
                "N": 5,
                "P": 0.87,
                "K": 8.3,
                "Mg": 1.21,
                "Ca": 0,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "5-2-10+2%MgO",
            "rates": {
                "greensMin": 200,
                "greensMax": 500,
                "teesMin": 250,
                "teesMax": 500,
                "fairwaysMin": 350,
                "fairwaysMax": 750
            },
            "rateUnit": "kg/ha",
            "interval_weeks": null,
            "notes": "Soil amendment product, likely organo-mineral. High K + Mg. Confirm release type and organic N source from SDS.",
            "verified": false,
            "nForm": "organic",
            "nFormConfidence": "auto",
            "nFormReason": "Organic N source (composted/biological origin)"
        },
        {
            "id": "regen-fine-cal",
            "name": "ReGen Fine Cal - 30%Ca 6.6%MgO",
            "brand": "ReGen Soil Amendments",
            "supplier": "regen",
            "form": "granular",
            "release": "quick",
            "sgn": 150,
            "particleSize_mm": null,
            "surfaces": [
                "all"
            ],
            "season": [
                "autumn",
                "spring"
            ],
            "analysis": {
                "N": 0,
                "P": 0,
                "K": 0,
                "Mg": 3.98,
                "Ca": 30,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "0-0-0+30%Ca+6.6%MgO",
            "rates": {
                "greensMin": 50,
                "greensMax": 150,
                "fairwaysMin": 100,
                "fairwaysMax": 300
            },
            "rateUnit": "kg/ha",
            "interval_weeks": null,
            "notes": "Ca + Mg amendment. Likely lime-based, confirm CaCO3 vs CaSO4 source. High Ca for cell wall integrity and pH correction.",
            "verified": false,
            "nForm": "no_N",
            "nFormConfidence": "auto",
            "nFormReason": "No nitrogen in analysis"
        },
        {
            "id": "regen-humic-g80",
            "name": "ReGen Humic G80",
            "brand": "ReGen Soil Amendments",
            "supplier": "regen",
            "form": "granular",
            "release": "organic",
            "sgn": 200,
            "particleSize_mm": null,
            "surfaces": [
                "all"
            ],
            "season": [
                "spring",
                "autumn"
            ],
            "analysis": {
                "N": 0,
                "P": 0,
                "K": 0,
                "Mg": 0,
                "Ca": 0,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "Humic acid amendment, no NPK",
            "rates": {
                "greensMin": 20,
                "greensMax": 50,
                "fairwaysMin": 50,
                "fairwaysMax": 150
            },
            "rateUnit": "kg/ha",
            "interval_weeks": null,
            "notes": "Granular humic acid (80% humic+fulvic). Soil conditioning, CEC improvement, nutrient chelation. Not a fertiliser, no N/P/K. SDS needed for humate source and % breakdown.",
            "verified": false,
            "nForm": "no_N",
            "nFormConfidence": "auto",
            "nFormReason": "No nitrogen in analysis"
        },
        {
            "id": "sigma-4-4-4-bio-fine",
            "name": "Sigma 4-4-4 BIO Fine Grade",
            "brand": "Sigma BIO",
            "supplier": "regen",
            "form": "granular",
            "release": "organic",
            "sgn": 75,
            "particleSize_mm": null,
            "surfaces": [
                "greens",
                "tees",
                "bowling"
            ],
            "season": [
                "spring",
                "summer",
                "autumn"
            ],
            "analysis": {
                "N": 4,
                "P": 1.74,
                "K": 3.32,
                "Mg": 0,
                "Ca": 0,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "4-4-4 BIO",
            "rates": {
                "greensMin": 250,
                "greensMax": 50,
                "teesMin": 25,
                "teesMax": 50
            },
            "rateUnit": "kg/ha",
            "interval_weeks": 8,
            "notes": "Organic fine-grade granule for greens and fine turf. Slow mineralisation of N expected. Organic N source not specified, confirm from SDS.",
            "verified": false,
            "nForm": "organic",
            "nFormConfidence": "auto",
            "nFormReason": "Organic N source (composted/biological origin)"
        },
        {
            "id": "sigma-5-3-2-bio-fine",
            "name": "Sigma 5-3-2 BIO Fine Grade",
            "brand": "Sigma BIO",
            "supplier": "regen",
            "form": "granular",
            "release": "organic",
            "sgn": 75,
            "particleSize_mm": null,
            "surfaces": [
                "greens",
                "tees",
                "bowling"
            ],
            "season": [
                "spring",
                "summer",
                "autumn"
            ],
            "analysis": {
                "N": 5,
                "P": 1.31,
                "K": 1.66,
                "Mg": 0,
                "Ca": 0,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "5-3-2 BIO",
            "rates": {
                "greensMin": 250,
                "greensMax": 50,
                "teesMin": 25,
                "teesMax": 50
            },
            "rateUnit": "kg/ha",
            "interval_weeks": 8,
            "notes": "Higher N organic fine-grade. Lower K than Sigma 4-4-4. Organic N source not specified, confirm from SDS.",
            "verified": false,
            "nForm": "organic",
            "nFormConfidence": "auto",
            "nFormReason": "Organic N source (composted/biological origin)"
        },
        {
            "id": "greentech-pre-ignite-j",
            "name": "Pre IgniteJ 10.15.10",
            "brand": "Greentech Sportsturf",
            "supplier": "regen",
            "form": "granular",
            "release": "quick",
            "sgn": 150,
            "particleSize_mm": null,
            "surfaces": [
                "fairways",
                "sports",
                "tees"
            ],
            "season": [
                "spring",
                "autumn"
            ],
            "analysis": {
                "N": 10,
                "P": 6.54,
                "K": 8.3,
                "Mg": 0,
                "Ca": 0,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "10-15-10",
            "rates": {
                "teesMin": 250,
                "teesMax": 500,
                "fairwaysMin": 350,
                "fairwaysMax": 750,
                "sportsMin": 350,
                "sportsMax": 750
            },
            "rateUnit": "kg/ha",
            "interval_weeks": 6,
            "notes": "High P pre-seeding / renovation formula (\"J\" likely = joint compound for seeding). Spring or autumn renovation.",
            "verified": true,
            "nForm": "mixed",
            "nFormConfidence": "review",
            "nFormReason": "Greentech: NPK compound, N source not confirmed; likely ammonium + nitrate; request SDS"
        },
        {
            "id": "greentech-ignite-prot",
            "name": "Ignite ProT 12.3.8 +3MgO +2Fe +6Ca",
            "brand": "Greentech Sportsturf",
            "supplier": "regen",
            "form": "granular",
            "release": "quick",
            "sgn": 150,
            "particleSize_mm": null,
            "surfaces": [
                "fairways",
                "sports",
                "tees"
            ],
            "season": [
                "spring",
                "summer"
            ],
            "analysis": {
                "N": 12,
                "P": 1.31,
                "K": 6.64,
                "Mg": 1.81,
                "Ca": 6,
                "Fe": 2,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "12-3-8+3MgO+2Fe+6Ca",
            "rates": {
                "teesMin": 250,
                "teesMax": 500,
                "fairwaysMin": 350,
                "fairwaysMax": 750,
                "sportsMin": 350,
                "sportsMax": 750
            },
            "rateUnit": "kg/ha",
            "interval_weeks": 6,
            "notes": "Comprehensive secondary nutrient profile, Ca, Mg, Fe. Summer outfield growth and disease resistance formula.",
            "verified": true,
            "nForm": "mixed",
            "nFormConfidence": "review",
            "nFormReason": "Greentech: NPK compound, N source not confirmed; likely ammonium + nitrate; request SDS"
        },
        {
            "id": "greentech-ignite-h",
            "name": "IgniteH 6.5.10 +6Fe",
            "brand": "Greentech Sportsturf",
            "supplier": "regen",
            "form": "granular",
            "release": "quick",
            "sgn": 150,
            "particleSize_mm": null,
            "surfaces": [
                "fairways",
                "sports",
                "tees",
                "greens"
            ],
            "season": [
                "autumn",
                "spring"
            ],
            "analysis": {
                "N": 6,
                "P": 2.18,
                "K": 8.3,
                "Mg": 0,
                "Ca": 0,
                "Fe": 6,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "6-5-10+6Fe",
            "rates": {
                "greensMin": 150,
                "greensMax": 350,
                "teesMin": 250,
                "teesMax": 500,
                "fairwaysMin": 350,
                "fairwaysMax": 750,
                "sportsMin": 350,
                "sportsMax": 750
            },
            "rateUnit": "kg/ha",
            "interval_weeks": 6,
            "notes": "High Fe autumn/spring hardening. Low N, high K and Fe. Comparable to Greenmaster Pro-Lite Autumn profile.",
            "verified": true,
            "nForm": "mixed",
            "nFormConfidence": "review",
            "nFormReason": "Greentech: NPK compound, N source not confirmed; likely ammonium + nitrate; request SDS"
        },
        {
            "id": "greentech-ignite-k",
            "name": "IgniteK 11.3.5 +3.5Mg +3Fe +6Ca",
            "brand": "Greentech Sportsturf",
            "supplier": "regen",
            "form": "granular",
            "release": "quick",
            "sgn": 150,
            "particleSize_mm": null,
            "surfaces": [
                "fairways",
                "sports",
                "tees"
            ],
            "season": [
                "spring",
                "summer",
                "autumn"
            ],
            "analysis": {
                "N": 11,
                "P": 1.31,
                "K": 4.15,
                "Mg": 2.11,
                "Ca": 6,
                "Fe": 3,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "11-3-5+3.5Mg+3Fe+6Ca",
            "rates": {
                "teesMin": 250,
                "teesMax": 500,
                "fairwaysMin": 350,
                "fairwaysMax": 750,
                "sportsMin": 350,
                "sportsMax": 750
            },
            "rateUnit": "kg/ha",
            "interval_weeks": 6,
            "notes": "Full secondary nutrient formula. High Ca and Mg. Multi-season use.",
            "verified": true,
            "nForm": "mixed",
            "nFormConfidence": "review",
            "nFormReason": "Greentech: NPK compound, N source not confirmed; likely ammonium + nitrate; request SDS"
        },
        {
            "id": "regen-cr-10-3-8-mg",
            "name": "ReGen Controlled Release 10.3.8 +2MgO",
            "brand": "ReGen Controlled Release",
            "supplier": "regen",
            "form": "granular",
            "release": "controlled",
            "releaseDuration_months": {
                "min": 3,
                "max": 5
            },
            "sgn": 250,
            "particleSize_mm": null,
            "surfaces": [
                "fairways",
                "sports",
                "tees"
            ],
            "season": [
                "spring",
                "autumn"
            ],
            "analysis": {
                "N": 10,
                "P": 1.31,
                "K": 6.64,
                "Mg": 1.21,
                "Ca": 0,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "10-3-8+2MgO",
            "rates": {
                "teesMin": 250,
                "teesMax": 500,
                "fairwaysMin": 350,
                "fairwaysMax": 750,
                "sportsMin": 350,
                "sportsMax": 750
            },
            "rateUnit": "kg/ha",
            "interval_weeks": null,
            "notes": "CRF + Mg. Coating technology and release duration not stated on website, request SDS. Lower N entry point for spring/autumn.",
            "verified": true,
            "nForm": "urea_pcu",
            "nFormConfidence": "auto",
            "nFormReason": "CRF polymer-coated urea, all UK CRF products in database use PCU technology"
        },
        {
            "id": "regen-cr-15-3-8-mg",
            "name": "ReGen Controlled Release 15.3.8 +2MgO",
            "brand": "ReGen Controlled Release",
            "supplier": "regen",
            "form": "granular",
            "release": "controlled",
            "releaseDuration_months": {
                "min": 3,
                "max": 5
            },
            "sgn": 250,
            "particleSize_mm": null,
            "surfaces": [
                "fairways",
                "sports",
                "tees"
            ],
            "season": [
                "spring",
                "summer"
            ],
            "analysis": {
                "N": 15,
                "P": 1.31,
                "K": 6.64,
                "Mg": 1.21,
                "Ca": 0,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "15-3-8+2MgO",
            "rates": {
                "teesMin": 250,
                "teesMax": 500,
                "fairwaysMin": 350,
                "fairwaysMax": 750,
                "sportsMin": 350,
                "sportsMax": 750
            },
            "rateUnit": "kg/ha",
            "interval_weeks": null,
            "notes": "Mid-range N CRF + Mg. Spring/summer outfield.",
            "verified": true,
            "nForm": "urea_pcu",
            "nFormConfidence": "auto",
            "nFormReason": "CRF polymer-coated urea, all UK CRF products in database use PCU technology"
        },
        {
            "id": "regen-cr-20-3-8-mg",
            "name": "ReGen Controlled Release 20.3.8 +2MgO",
            "brand": "ReGen Controlled Release",
            "supplier": "regen",
            "form": "granular",
            "release": "controlled",
            "releaseDuration_months": {
                "min": 3,
                "max": 5
            },
            "sgn": 250,
            "particleSize_mm": null,
            "surfaces": [
                "fairways",
                "sports"
            ],
            "season": [
                "spring",
                "summer"
            ],
            "analysis": {
                "N": 20,
                "P": 1.31,
                "K": 6.64,
                "Mg": 1.21,
                "Ca": 0,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "20-3-8+2MgO",
            "rates": {
                "fairwaysMin": 350,
                "fairwaysMax": 750,
                "sportsMin": 350,
                "sportsMax": 750
            },
            "rateUnit": "kg/ha",
            "interval_weeks": null,
            "notes": "High N CRF + Mg. Spring growth season. Outfields and sports pitches.",
            "verified": true,
            "nForm": "urea_pcu",
            "nFormConfidence": "auto",
            "nFormReason": "CRF polymer-coated urea, all UK CRF products in database use PCU technology"
        },
        {
            "id": "regen-cr-24-4-10-mg",
            "name": "ReGen Controlled Release 24.4.10 +2MgO",
            "brand": "ReGen Controlled Release",
            "supplier": "regen",
            "form": "granular",
            "release": "controlled",
            "releaseDuration_months": {
                "min": 4,
                "max": 6
            },
            "sgn": 250,
            "particleSize_mm": null,
            "surfaces": [
                "fairways",
                "sports"
            ],
            "season": [
                "spring"
            ],
            "analysis": {
                "N": 24,
                "P": 1.74,
                "K": 8.3,
                "Mg": 1.21,
                "Ca": 0,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "24-4-10+2MgO",
            "rates": {
                "fairwaysMin": 350,
                "fairwaysMax": 750,
                "sportsMin": 350,
                "sportsMax": 750
            },
            "rateUnit": "kg/ha",
            "interval_weeks": null,
            "notes": "Highest N ReGen CRF. Long-season spring application. Better K:N ratio than competitors at this N level.",
            "verified": true,
            "nForm": "urea_pcu",
            "nFormConfidence": "auto",
            "nFormReason": "CRF polymer-coated urea, all UK CRF products in database use PCU technology"
        },
        {
            "id": "oas-multigreen-28-3-15-mg",
            "name": "Multigreen 28-3-15+2MgO",
            "brand": "Multigreen",
            "supplier": "oas",
            "form": "granular",
            "release": "controlled",
            "releaseNotes": "Polymer resin coating. Temp-triggered above 6°C. Fast-start conventional portion for cool-temp response.",
            "releaseDuration_months": {
                "min": 5,
                "max": 6
            },
            "releaseTemp_minC": 6,
            "sgn": 300,
            "particleSize_mm": "2.5-3.5",
            "surfaces": [
                "tees",
                "fairways",
                "sports"
            ],
            "season": [
                "spring"
            ],
            "analysis": {
                "N": 28,
                "P": 1.31,
                "K": 12.45,
                "Mg": 1.21,
                "Ca": 0,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "28-3-15+2MgO",
            "nBreakdown": {
                "coatedN_pct": 59,
                "ureicN_pct": 8.8,
                "nitrateN_pct": 6.2
            },
            "rates": {
                "teesMin": 250,
                "teesMax": 350,
                "fairwaysMin": 250,
                "fairwaysMax": 350,
                "sportsMin": 250,
                "sportsMax": 350
            },
            "rateUnit": "kg/ha",
            "interval_weeks": null,
            "notes": "Single spring application covers whole season. 59% coated N governs longevity; fast-start fraction activates in cool spring conditions.",
            "verified": true,
            "productCode": "OAI004542",
            "nForm": "urea_pcu",
            "nFormConfidence": "auto",
            "nFormReason": "nBreakdown: coated N + ureic fraction confirmed"
        },
        {
            "id": "oas-multigreen-28-0-0-mg",
            "name": "Multigreen 28-0-0+3MgO",
            "brand": "Multigreen",
            "supplier": "oas",
            "form": "granular",
            "release": "controlled",
            "releaseNotes": "Polymer resin. Temp-triggered above 6°C.",
            "releaseDuration_months": {
                "min": 5,
                "max": 6
            },
            "releaseTemp_minC": 6,
            "sgn": 300,
            "particleSize_mm": "2.5-3.5",
            "surfaces": [
                "tees",
                "fairways",
                "sports"
            ],
            "season": [
                "spring"
            ],
            "analysis": {
                "N": 28,
                "P": 0,
                "K": 0,
                "Mg": 1.81,
                "Ca": 0,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "28-0-0+3MgO",
            "nBreakdown": {
                "coatedN_pct": 73,
                "ureicN_pct": 20.5,
                "ammN_pct": 7.5
            },
            "rates": {
                "teesMin": 250,
                "teesMax": 350,
                "fairwaysMin": 250,
                "fairwaysMax": 350,
                "sportsMin": 250,
                "sportsMax": 350
            },
            "rateUnit": "kg/ha",
            "interval_weeks": null,
            "notes": "N-only Multigreen. Highest coated N fraction (73%). Use where K and P supplied separately.",
            "verified": true,
            "productCode": "OAI004543",
            "nForm": "urea_pcu",
            "nFormConfidence": "auto",
            "nFormReason": "nBreakdown: coated N + ureic fraction confirmed"
        },
        {
            "id": "oas-hcote-22-3-8-fe-mg",
            "name": "H-Cote 22-3-8+0.7Fe+0.8MgO",
            "brand": "H-Cote",
            "supplier": "oas",
            "form": "granular",
            "release": "controlled",
            "releaseNotes": "Dual-coat technology. 91% coated N. Temp-triggered. Mini-granule.",
            "releaseDuration_months": {
                "min": 3,
                "max": 4
            },
            "sgn": 175,
            "particleSize_mm": "1-2.5",
            "surfaces": [
                "tees",
                "fairways",
                "sports"
            ],
            "season": [
                "spring",
                "summer"
            ],
            "analysis": {
                "N": 22,
                "P": 1.31,
                "K": 6.64,
                "Mg": 0.48,
                "Ca": 0,
                "Fe": 0.7,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "22-3-8+0.7Fe+0.8MgO",
            "nBreakdown": {
                "coatedN_pct": 91,
                "ammN_pct": 2,
                "ureicN_pct": 20.5
            },
            "rates": {
                "teesMin": 250,
                "teesMax": 350,
                "fairwaysMin": 250,
                "fairwaysMax": 350,
                "sportsMin": 250,
                "sportsMax": 350
            },
            "rateUnit": "kg/ha",
            "interval_weeks": null,
            "notes": "Highest coated N% in H-Cote range (91%). Minimal growth flush. Spring/summer tees and fairways.",
            "verified": true,
            "productCode": "OAI004549",
            "nForm": "urea_pcu",
            "nFormConfidence": "auto",
            "nFormReason": "nBreakdown: coated N + ureic fraction confirmed"
        },
        {
            "id": "oas-hcote-15-5-12-fe-mg",
            "name": "H-Cote 15-5-12+1Fe+1MgO",
            "brand": "H-Cote",
            "supplier": "oas",
            "form": "granular",
            "release": "controlled",
            "releaseDuration_months": {
                "min": 3,
                "max": 4
            },
            "sgn": 175,
            "particleSize_mm": "1-2.5",
            "surfaces": [
                "tees",
                "fairways",
                "sports"
            ],
            "season": [
                "spring",
                "summer"
            ],
            "analysis": {
                "N": 15,
                "P": 2.18,
                "K": 9.96,
                "Mg": 0.6,
                "Ca": 0,
                "Fe": 1,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "15-5-12+1Fe+1MgO",
            "nBreakdown": {
                "coatedN_pct": 81,
                "ammN_pct": 2.7,
                "ureicN_pct": 12.3
            },
            "rates": {
                "teesMin": 250,
                "teesMax": 350,
                "fairwaysMin": 250,
                "fairwaysMax": 350,
                "sportsMin": 250,
                "sportsMax": 350
            },
            "rateUnit": "kg/ha",
            "interval_weeks": null,
            "notes": "Balanced NPK H-Cote. Good all-round spring/summer option for tees and fairways.",
            "verified": true,
            "productCode": "OAI004546",
            "nForm": "urea_pcu",
            "nFormConfidence": "auto",
            "nFormReason": "nBreakdown: coated N + ureic fraction confirmed"
        },
        {
            "id": "oas-hcote-10-5-14-fe-mg",
            "name": "H-Cote 10-5-14+1.2Fe+1.2MgO",
            "brand": "H-Cote",
            "supplier": "oas",
            "form": "granular",
            "release": "controlled",
            "releaseDuration_months": {
                "min": 3,
                "max": 4
            },
            "sgn": 150,
            "particleSize_mm": "SGN 150 per brochure",
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
                "N": 10,
                "P": 2.18,
                "K": 11.62,
                "Mg": 0.72,
                "Ca": 0,
                "Fe": 1.2,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "10-5-14+1.2Fe+1.2MgO",
            "nBreakdown": {
                "coatedN_pct": 70,
                "ammN_pct": 3,
                "ureicN_pct": 7
            },
            "rates": {
                "greensMin": 200,
                "greensMax": 350,
                "teesMin": 250,
                "teesMax": 350,
                "fairwaysMin": 250,
                "fairwaysMax": 350
            },
            "rateUnit": "kg/ha",
            "interval_weeks": null,
            "notes": "Finer SGN, suitable for greens. High K hardening formula. Good for autumn or as single-app tee/fairway program.",
            "verified": true,
            "productCode": "OAI004547",
            "nForm": "urea_pcu",
            "nFormConfidence": "auto",
            "nFormReason": "nBreakdown: coated N + ureic fraction confirmed"
        },
        {
            "id": "oas-hcote-22-3-10-ca-mg",
            "name": "H-Cote 22-3-10+3.5CaO+4MgO",
            "brand": "H-Cote",
            "supplier": "oas",
            "form": "granular",
            "release": "controlled",
            "releaseDuration_months": {
                "min": 2,
                "max": 3
            },
            "sgn": 175,
            "particleSize_mm": "1-2.5",
            "surfaces": [
                "tees",
                "fairways",
                "sports"
            ],
            "season": [
                "spring",
                "summer"
            ],
            "analysis": {
                "N": 22,
                "P": 1.31,
                "K": 8.3,
                "Mg": 2.41,
                "Ca": 2.5,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "22-3-10+3.5CaO+4MgO",
            "nBreakdown": {
                "coatedN_pct": 66,
                "ammN_pct": 5.3,
                "ureicN_pct": 2.3
            },
            "rates": {
                "teesMin": 250,
                "teesMax": 350,
                "fairwaysMin": 250,
                "fairwaysMax": 350,
                "sportsMin": 250,
                "sportsMax": 350
            },
            "rateUnit": "kg/ha",
            "interval_weeks": null,
            "notes": "High Ca and Mg. Shorter longevity (2-3 months). Disease resistance and cell wall integrity support.",
            "verified": true,
            "productCode": "OAI000163",
            "nForm": "urea_pcu",
            "nFormConfidence": "auto",
            "nFormReason": "nBreakdown: coated N + ureic fraction confirmed"
        },
        {
            "id": "oas-hcote-16-4-13-ca-mg",
            "name": "H-Cote 16-4-13+4.5CaO+1.8MgO",
            "brand": "H-Cote",
            "supplier": "oas",
            "form": "granular",
            "release": "controlled",
            "releaseDuration_months": {
                "min": 3,
                "max": 4
            },
            "sgn": 175,
            "particleSize_mm": "1-2.5",
            "surfaces": [
                "tees",
                "fairways",
                "sports"
            ],
            "season": [
                "spring",
                "summer",
                "autumn"
            ],
            "analysis": {
                "N": 16,
                "P": 1.74,
                "K": 10.79,
                "Mg": 1.09,
                "Ca": 3.22,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "16-4-13+4.5CaO+1.8MgO",
            "nBreakdown": {
                "coatedN_pct": 40,
                "ammN_pct": 6.7,
                "ureicN_pct": 2.9
            },
            "rates": {
                "teesMin": 200,
                "teesMax": 350,
                "fairwaysMin": 200,
                "fairwaysMax": 350,
                "sportsMin": 200,
                "sportsMax": 350
            },
            "rateUnit": "kg/ha",
            "interval_weeks": null,
            "notes": "Highest Ca in H-Cote range. Good for wear tolerance and disease resistance. Flexible low-rate application.",
            "verified": true,
            "productCode": "OAI000166",
            "nForm": "urea_pcu",
            "nFormConfidence": "auto",
            "nFormReason": "nBreakdown: coated N + ureic fraction confirmed"
        },
        {
            "id": "oas-polypro-15-0-25",
            "name": "PolyPro 15-0-25",
            "brand": "PolyPro",
            "supplier": "oas",
            "form": "granular",
            "release": "controlled",
            "releaseDuration_months": {
                "min": 5,
                "max": 6
            },
            "sgn": 150,
            "particleSize_mm": "1-2",
            "surfaces": [
                "greens",
                "tees",
                "fairways",
                "sports"
            ],
            "season": [
                "autumn",
                "spring"
            ],
            "analysis": {
                "N": 15,
                "P": 0,
                "K": 20.75,
                "Mg": 0,
                "Ca": 0,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "15-0-25",
            "nBreakdown": {
                "coatedN_pct": 56,
                "ammN_pct": 4.6,
                "ureicN_pct": 2
            },
            "rates": {
                "greensMin": 200,
                "greensMax": 350,
                "teesMin": 200,
                "teesMax": 350,
                "fairwaysMin": 200,
                "fairwaysMax": 350,
                "sportsMin": 200,
                "sportsMax": 350
            },
            "rateUnit": "kg/ha",
            "interval_weeks": null,
            "notes": "Very high K micro-granule CRF. 5-6 month longevity. Autumn hardening single application. Fine enough for greens.",
            "verified": true,
            "productCode": "OAI000168",
            "nForm": "urea_pcu",
            "nFormConfidence": "auto",
            "nFormReason": "nBreakdown: coated N + ureic fraction confirmed"
        },
        {
            "id": "oas-polypro-22-5-6",
            "name": "PolyPro 22-5-6",
            "brand": "PolyPro",
            "supplier": "oas",
            "form": "granular",
            "release": "controlled",
            "releaseDuration_months": {
                "min": 5,
                "max": 6
            },
            "sgn": 150,
            "particleSize_mm": "1-2",
            "surfaces": [
                "greens",
                "tees",
                "fairways",
                "sports"
            ],
            "season": [
                "spring"
            ],
            "analysis": {
                "N": 22,
                "P": 2.18,
                "K": 4.98,
                "Mg": 0,
                "Ca": 0,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "22-5-6",
            "nBreakdown": {
                "coatedN_pct": 68,
                "ammN_pct": 4.6,
                "ureicN_pct": 2.4
            },
            "rates": {
                "greensMin": 250,
                "greensMax": 350,
                "teesMin": 250,
                "teesMax": 350,
                "fairwaysMin": 250,
                "fairwaysMax": 350,
                "sportsMin": 250,
                "sportsMax": 350
            },
            "rateUnit": "kg/ha",
            "interval_weeks": null,
            "notes": "High N micro-granule CRF. Spring single application covers full season. Fine enough for greens.",
            "verified": true,
            "productCode": "OAI000158",
            "nForm": "urea_pcu",
            "nFormConfidence": "auto",
            "nFormReason": "nBreakdown: coated N + ureic fraction confirmed"
        },
        {
            "id": "oas-convert-21-5-6-mg-ca",
            "name": "ConVert 21-5-6+2MgO+4CaO",
            "brand": "ConVert",
            "supplier": "oas",
            "form": "granular",
            "release": "mixed",
            "releaseNotes": "25% coated N + conventional. All contain Ca and Mg.",
            "releaseDuration_months": {
                "min": 2,
                "max": 3
            },
            "sgn": 175,
            "particleSize_mm": "1-2.5",
            "surfaces": [
                "tees",
                "fairways",
                "sports"
            ],
            "season": [
                "spring",
                "summer"
            ],
            "analysis": {
                "N": 21,
                "P": 2.18,
                "K": 4.98,
                "Mg": 1.21,
                "Ca": 2.86,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "21-5-6+2MgO+4CaO",
            "nBreakdown": {
                "coatedN_pct": 25,
                "ammN_pct": 9.3,
                "ureicN_pct": 6.5
            },
            "rates": {
                "teesMin": 250,
                "teesMax": 350,
                "fairwaysMin": 250,
                "fairwaysMax": 350,
                "sportsMin": 250,
                "sportsMax": 350
            },
            "rateUnit": "kg/ha",
            "interval_weeks": null,
            "notes": "Cost-effective mixed CRF. Ca + Mg in all ConVert grades. Initial response + 2-3 month tail.",
            "verified": true,
            "productCode": "OAI000153",
            "nForm": "urea_pcu",
            "nFormConfidence": "auto",
            "nFormReason": "nBreakdown: coated N + ureic fraction confirmed"
        },
        {
            "id": "oas-convert-20-0-7-mg-ca",
            "name": "ConVert 20-0-7+3MgO+4CaO",
            "brand": "ConVert",
            "supplier": "oas",
            "form": "granular",
            "release": "mixed",
            "releaseDuration_months": {
                "min": 2,
                "max": 3
            },
            "sgn": 175,
            "particleSize_mm": "1-2.5",
            "surfaces": [
                "tees",
                "fairways",
                "sports"
            ],
            "season": [
                "spring",
                "summer"
            ],
            "analysis": {
                "N": 20,
                "P": 0,
                "K": 5.81,
                "Mg": 1.81,
                "Ca": 2.86,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "20-0-7+3MgO+4CaO",
            "nBreakdown": {
                "coatedN_pct": 25,
                "ammN_pct": 10,
                "ureicN_pct": 5
            },
            "rates": {
                "teesMin": 200,
                "teesMax": 350,
                "fairwaysMin": 200,
                "fairwaysMax": 350,
                "sportsMin": 200,
                "sportsMax": 350
            },
            "rateUnit": "kg/ha",
            "interval_weeks": null,
            "notes": "P-free ConVert. High N with Ca and Mg. Spring growth where P adequate.",
            "verified": true,
            "productCode": "OAI000154",
            "nForm": "urea_pcu",
            "nFormConfidence": "auto",
            "nFormReason": "nBreakdown: coated N + ureic fraction confirmed"
        },
        {
            "id": "oas-convert-15-5-15-mg-ca",
            "name": "ConVert 15-5-15+2MgO+4CaO",
            "brand": "ConVert",
            "supplier": "oas",
            "form": "granular",
            "release": "mixed",
            "releaseDuration_months": {
                "min": 2,
                "max": 3
            },
            "sgn": 175,
            "particleSize_mm": "1-2.5",
            "surfaces": [
                "tees",
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
                "P": 2.18,
                "K": 12.45,
                "Mg": 1.21,
                "Ca": 2.86,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "15-5-15+2MgO+4CaO",
            "nBreakdown": {
                "coatedN_pct": 25,
                "ammN_pct": 10,
                "ureicN_pct": 5
            },
            "rates": {
                "teesMin": 200,
                "teesMax": 350,
                "fairwaysMin": 200,
                "fairwaysMax": 350,
                "sportsMin": 200,
                "sportsMax": 350
            },
            "rateUnit": "kg/ha",
            "interval_weeks": null,
            "notes": "Balanced N:K ConVert with Ca + Mg. Versatile multi-season use.",
            "verified": true,
            "productCode": "OAI000155",
            "nForm": "urea_pcu",
            "nFormConfidence": "auto",
            "nFormReason": "nBreakdown: coated N + ureic fraction confirmed"
        },
        {
            "id": "oas-convert-12-5-20-mg-ca",
            "name": "ConVert 12-5-20+2MgO+4CaO",
            "brand": "ConVert",
            "supplier": "oas",
            "form": "granular",
            "release": "mixed",
            "releaseDuration_months": {
                "min": 2,
                "max": 3
            },
            "sgn": 175,
            "particleSize_mm": "1-2.5",
            "surfaces": [
                "tees",
                "fairways",
                "sports"
            ],
            "season": [
                "autumn",
                "spring"
            ],
            "analysis": {
                "N": 12,
                "P": 2.18,
                "K": 16.6,
                "Mg": 1.21,
                "Ca": 2.86,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "12-5-20+2MgO+4CaO",
            "nBreakdown": {
                "coatedN_pct": 25,
                "ammN_pct": 6.8,
                "ureicN_pct": 2.2
            },
            "rates": {
                "teesMin": 200,
                "teesMax": 350,
                "fairwaysMin": 200,
                "fairwaysMax": 350,
                "sportsMin": 200,
                "sportsMax": 350
            },
            "rateUnit": "kg/ha",
            "interval_weeks": null,
            "notes": "High K ConVert. Autumn hardening or spring conditioning. Ca + Mg included.",
            "verified": true,
            "productCode": "OAI000156",
            "nForm": "urea_pcu",
            "nFormConfidence": "auto",
            "nFormReason": "nBreakdown: coated N + ureic fraction confirmed"
        },
        {
            "id": "oas-premier-hg-22-3-15-te",
            "name": "Premier HG 22-3-15+TE",
            "brand": "Premier HG",
            "supplier": "oas",
            "form": "granular",
            "release": "slow",
            "releaseNotes": "Methylene urea (short/medium/long chain) + ammoniacal + ureic blend.",
            "releaseDuration_months": {
                "min": 5,
                "max": 6
            },
            "sgn": 175,
            "particleSize_mm": "1-2.5",
            "surfaces": [
                "greens",
                "tees",
                "fairways",
                "sports"
            ],
            "season": [
                "spring"
            ],
            "analysis": {
                "N": 22,
                "P": 1.31,
                "K": 12.45,
                "Mg": 0,
                "Ca": 0,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "22-3-15+TE",
            "nBreakdown": {
                "methyleneUreaN_pct": 16.3,
                "ammN_pct": 4,
                "ureicN_pct": 1.7
            },
            "rates": {
                "greensMin": 250,
                "greensMax": 350,
                "teesMin": 250,
                "teesMax": 350,
                "fairwaysMin": 250,
                "fairwaysMax": 350,
                "sportsMin": 250,
                "sportsMax": 350
            },
            "rateUnit": "kg/ha",
            "interval_weeks": null,
            "notes": "Long-season slow-release. Methylene urea chains extend N availability. Trace element package included.",
            "verified": true,
            "productCode": "OAI000339",
            "nForm": "urea_mu",
            "nFormConfidence": "auto",
            "nFormReason": "nBreakdown: methylene urea blend"
        },
        {
            "id": "oas-premier-hg-12-3-24-mg-te",
            "name": "Premier HG 12-3-24+2.5MgO+TE",
            "brand": "Premier HG",
            "supplier": "oas",
            "form": "granular",
            "release": "slow",
            "releaseDuration_months": {
                "min": 4,
                "max": 5
            },
            "sgn": 175,
            "particleSize_mm": "1-2.5",
            "surfaces": [
                "greens",
                "tees",
                "fairways",
                "sports"
            ],
            "season": [
                "autumn",
                "spring"
            ],
            "analysis": {
                "N": 12,
                "P": 1.31,
                "K": 19.92,
                "Mg": 1.51,
                "Ca": 0,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "12-3-24+2.5MgO+TE",
            "nBreakdown": {
                "methyleneUreaN_pct": 4,
                "ammN_pct": 6.2,
                "ureicN_pct": 1.8
            },
            "rates": {
                "greensMin": 250,
                "greensMax": 350,
                "teesMin": 250,
                "teesMax": 350,
                "fairwaysMin": 250,
                "fairwaysMax": 350,
                "sportsMin": 250,
                "sportsMax": 350
            },
            "rateUnit": "kg/ha",
            "interval_weeks": null,
            "notes": "Very high K slow-release + Mg. Autumn hardening or spring K loading. Suitable for greens.",
            "verified": true,
            "productCode": "OAI000341",
            "nForm": "urea_mu",
            "nFormConfidence": "auto",
            "nFormReason": "nBreakdown: methylene urea blend"
        },
        {
            "id": "oas-premier-hg-3-3-32-te",
            "name": "Premier HG 3-3-32+TE",
            "brand": "Premier HG",
            "supplier": "oas",
            "form": "granular",
            "release": "quick",
            "releaseDuration_months": {
                "min": 2,
                "max": 3
            },
            "sgn": 175,
            "particleSize_mm": "1-2.5",
            "surfaces": [
                "greens",
                "tees",
                "fairways",
                "sports"
            ],
            "season": [
                "autumn",
                "winter"
            ],
            "analysis": {
                "N": 3,
                "P": 1.31,
                "K": 26.57,
                "Mg": 0,
                "Ca": 0,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "3-3-32+TE",
            "nBreakdown": {
                "ammN_pct": 6.2,
                "nitrateN_pct": 1.3
            },
            "rates": {
                "greensMin": 250,
                "greensMax": 350,
                "teesMin": 250,
                "teesMax": 350,
                "fairwaysMin": 250,
                "fairwaysMax": 350,
                "sportsMin": 250,
                "sportsMax": 350
            },
            "rateUnit": "kg/ha",
            "interval_weeks": null,
            "notes": "Exceptional K hardening formula. Minimal N. Autumn/winter stress resistance. Highest K in Premier HG range.",
            "verified": true,
            "productCode": "OAI000342",
            "nForm": "mixed",
            "nFormConfidence": "auto",
            "nFormReason": "nBreakdown: ammonium + nitrate (CAN-type)"
        },
        {
            "id": "oas-xtend-46-0-0",
            "name": "Xtend 46-0-0 Granular",
            "brand": "Xtend",
            "supplier": "oas",
            "form": "granular",
            "release": "stabilised",
            "releaseNotes": "NBPT (anti-volatilisation) + DCD (nitrification inhibitor). 3 months longevity.",
            "releaseDuration_months": {
                "min": 2,
                "max": 3
            },
            "sgn": 250,
            "particleSize_mm": "2-3",
            "surfaces": [
                "tees",
                "fairways",
                "sports"
            ],
            "season": [
                "spring",
                "summer"
            ],
            "analysis": {
                "N": 46,
                "P": 0,
                "K": 0,
                "Mg": 0,
                "Ca": 0,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "46-0-0",
            "nBreakdown": {
                "ureicN_pct": 46
            },
            "rates": {
                "teesMin": 100,
                "teesMax": 200,
                "fairwaysMin": 100,
                "fairwaysMax": 200,
                "sportsMin": 100,
                "sportsMax": 200
            },
            "rateUnit": "kg/ha",
            "interval_weeks": null,
            "notes": "Pure urea with NBPT + DCD inhibitors. Highest N analysis in the OAS range. Low application rate. Cost-effective N program for fairways.",
            "verified": true,
            "productCode": "OAI006313",
            "nForm": "stabilised_urea",
            "nFormConfidence": "auto",
            "nFormReason": "Xtend 46-0-0: urea + NBPT urease inhibitor + DCD nitrification inhibitor (confirmed OAS brochure)"
        },
        {
            "id": "oas-xtend-24-4-4",
            "name": "Xtend 24-4-4",
            "brand": "Xtend",
            "supplier": "oas",
            "form": "granular",
            "release": "stabilised",
            "releaseNotes": "NBPT + DCD inhibitor technology.",
            "releaseDuration_months": {
                "min": 2,
                "max": 3
            },
            "sgn": 250,
            "particleSize_mm": "2-3",
            "surfaces": [
                "tees",
                "fairways",
                "sports"
            ],
            "season": [
                "spring",
                "summer"
            ],
            "analysis": {
                "N": 24,
                "P": 1.74,
                "K": 3.32,
                "Mg": 0,
                "Ca": 0,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "24-4-4",
            "nBreakdown": {
                "ureicN_pct": 20,
                "ammN_pct": 4
            },
            "rates": {
                "teesMin": 250,
                "teesMax": 350,
                "fairwaysMin": 250,
                "fairwaysMax": 350,
                "sportsMin": 250,
                "sportsMax": 350
            },
            "rateUnit": "kg/ha",
            "interval_weeks": null,
            "notes": "Spring growth stimulation with inhibitor N. Renovation/establishment support with added P and K.",
            "verified": true,
            "productCode": "OAI006315",
            "nForm": "stabilised_urea",
            "nFormConfidence": "auto",
            "nFormReason": "Xtend granular: urea + NBPT + DCD inhibitors (confirmed OAS brochure)"
        },
        {
            "id": "oas-xtend-15-2-20-mg",
            "name": "Xtend 15-2-20+MgO",
            "brand": "Xtend",
            "supplier": "oas",
            "form": "granular",
            "release": "stabilised",
            "releaseNotes": "NBPT + DCD inhibitor technology.",
            "releaseDuration_months": {
                "min": 2,
                "max": 3
            },
            "sgn": 250,
            "particleSize_mm": "2-3",
            "surfaces": [
                "tees",
                "fairways",
                "sports"
            ],
            "season": [
                "spring",
                "autumn"
            ],
            "analysis": {
                "N": 15,
                "P": 0.87,
                "K": 16.6,
                "Mg": 0,
                "Ca": 0,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "15-2-20+MgO",
            "nBreakdown": {
                "ureicN_pct": 12,
                "ammN_pct": 3
            },
            "rates": {
                "teesMin": 250,
                "teesMax": 350,
                "fairwaysMin": 250,
                "fairwaysMax": 350,
                "sportsMin": 250,
                "sportsMax": 350
            },
            "rateUnit": "kg/ha",
            "interval_weeks": null,
            "notes": "High K stabilised N. MgO% not stated in brochure, request SDS for exact Mg level.",
            "verified": false,
            "productCode": "OAI006314",
            "nForm": "stabilised_urea",
            "nFormConfidence": "auto",
            "nFormReason": "Xtend granular: urea + NBPT + DCD inhibitors (confirmed OAS brochure)"
        },
        {
            "id": "oas-microlite-links-4-0-4-fe-seaweed",
            "name": "Microlite Links 4-0-4+4Fe+Seaweed+Naturvigor",
            "brand": "Microlite",
            "supplier": "oas",
            "form": "granular",
            "release": "quick",
            "sgn": 125,
            "particleSize_mm": "1-1.5",
            "surfaces": [
                "greens",
                "tees",
                "bowling",
                "fairways"
            ],
            "season": [
                "spring",
                "summer",
                "autumn"
            ],
            "analysis": {
                "N": 4,
                "P": 0,
                "K": 3.32,
                "Mg": 0,
                "Ca": 0,
                "Fe": 4,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "4-0-4+4Fe+Seaweed+Naturvigor",
            "nBreakdown": {
                "ammN_pct": 4
            },
            "rates": {
                "greensMin": 200,
                "greensMax": 350,
                "teesMin": 200,
                "teesMax": 350,
                "fairwaysMin": 200,
                "fairwaysMax": 350
            },
            "rateUnit": "kg/ha",
            "interval_weeks": 6,
            "notes": "Organic biostimulant base (Naturvigor composted cow manure) + seaweed + Fe. Colour without growth. Soil biology stimulation.",
            "verified": true,
            "productCode": "OAI008905",
            "nForm": "ammonium",
            "nFormConfidence": "auto",
            "nFormReason": "nBreakdown: ammonium only"
        },
        {
            "id": "oas-microlite-performance-12-0-12-ca-mg-fe",
            "name": "Microlite Performance 12-0-12+8CaO+3MgO+2Fe",
            "brand": "Microlite",
            "supplier": "oas",
            "form": "granular",
            "release": "quick",
            "sgn": 125,
            "particleSize_mm": "1-1.5",
            "surfaces": [
                "greens",
                "tees",
                "bowling",
                "fairways"
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
                "Mg": 1.81,
                "Ca": 5.72,
                "Fe": 2,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "12-0-12+8CaO+3MgO+2Fe",
            "nBreakdown": {
                "ammN_pct": 6,
                "ureicN_pct": 6
            },
            "rates": {
                "greensMin": 200,
                "greensMax": 350,
                "teesMin": 200,
                "teesMax": 350,
                "fairwaysMin": 200,
                "fairwaysMax": 350
            },
            "rateUnit": "kg/ha",
            "interval_weeks": 6,
            "notes": "High Ca + Mg + Fe micro-granule. Comprehensive secondary nutrient package for fine turf.",
            "verified": true,
            "productCode": "OAI008906",
            "nForm": "mixed",
            "nFormConfidence": "auto",
            "nFormReason": "nBreakdown: ammonium + urea blend"
        },
        {
            "id": "oas-microlite-advance-8-0-16-mg-fe",
            "name": "Microlite Advance 8-0-16+3.3MgO+4Fe",
            "brand": "Microlite",
            "supplier": "oas",
            "form": "granular",
            "release": "mixed",
            "releaseNotes": "Ammoniacal + ureic + methylene urea blend.",
            "sgn": 125,
            "particleSize_mm": "1-1.5",
            "surfaces": [
                "greens",
                "tees",
                "bowling",
                "fairways"
            ],
            "season": [
                "autumn",
                "spring"
            ],
            "analysis": {
                "N": 8,
                "P": 0,
                "K": 13.28,
                "Mg": 1.99,
                "Ca": 0,
                "Fe": 4,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "8-0-16+3.3MgO+4Fe",
            "nBreakdown": {
                "ammN_pct": 2,
                "ureicN_pct": 3,
                "methyleneUreaN_pct": 3
            },
            "rates": {
                "greensMin": 200,
                "greensMax": 350,
                "teesMin": 200,
                "teesMax": 350,
                "fairwaysMin": 200,
                "fairwaysMax": 350
            },
            "rateUnit": "kg/ha",
            "interval_weeks": 6,
            "notes": "High K + Fe autumn hardening micro-granule. Methylene urea extends N longevity slightly.",
            "verified": true,
            "productCode": "OAI008907",
            "nForm": "urea_mu",
            "nFormConfidence": "auto",
            "nFormReason": "nBreakdown: methylene urea blend"
        },
        {
            "id": "oas-microlite-premier-15-0-10-ca-mg",
            "name": "Microlite Premier 15-0-10+9CaO+3MgO",
            "brand": "Microlite",
            "supplier": "oas",
            "form": "granular",
            "release": "mixed",
            "sgn": 125,
            "particleSize_mm": "1-1.5",
            "surfaces": [
                "greens",
                "tees",
                "bowling",
                "fairways"
            ],
            "season": [
                "spring",
                "summer"
            ],
            "analysis": {
                "N": 15,
                "P": 0,
                "K": 8.3,
                "Mg": 1.81,
                "Ca": 6.43,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "15-0-10+9CaO+3MgO",
            "nBreakdown": {
                "ammN_pct": 6,
                "ureicN_pct": 4,
                "methyleneUreaN_pct": 3
            },
            "rates": {
                "greensMin": 200,
                "greensMax": 350,
                "teesMin": 200,
                "teesMax": 350,
                "fairwaysMin": 200,
                "fairwaysMax": 350
            },
            "rateUnit": "kg/ha",
            "interval_weeks": 6,
            "notes": "Highest Ca in Microlite range. Cell wall integrity, wear tolerance, disease resistance.",
            "verified": true,
            "productCode": "OAI008908",
            "nForm": "urea_mu",
            "nFormConfidence": "auto",
            "nFormReason": "nBreakdown: methylene urea blend"
        },
        {
            "id": "oas-microlite-complete-10-2-5-mg-ca-fe",
            "name": "Microlite Complete 10-2-5+3MgO+3CaO+2Fe",
            "brand": "Microlite",
            "supplier": "oas",
            "form": "granular",
            "release": "quick",
            "sgn": 125,
            "particleSize_mm": "1-1.5",
            "surfaces": [
                "greens",
                "tees",
                "bowling",
                "fairways"
            ],
            "season": [
                "spring",
                "summer",
                "autumn"
            ],
            "analysis": {
                "N": 10,
                "P": 0.87,
                "K": 4.15,
                "Mg": 1.81,
                "Ca": 2.14,
                "Fe": 2,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "10-2-5+3MgO+3CaO+2Fe",
            "nBreakdown": {
                "nitrateN_pct": 2,
                "ammN_pct": 5,
                "ureicN_pct": 3
            },
            "rates": {
                "greensMin": 250,
                "greensMax": 350,
                "teesMin": 250,
                "teesMax": 350,
                "fairwaysMin": 250,
                "fairwaysMax": 350
            },
            "rateUnit": "kg/ha",
            "interval_weeks": 6,
            "notes": "True complete micro-granule, N, P, K, Mg, Ca and Fe in every granule. All-round summer nutrition.",
            "verified": true,
            "productCode": "OAI008909",
            "nForm": "mixed",
            "nFormConfidence": "auto",
            "nFormReason": "nBreakdown present, mixed sources"
        },
        {
            "id": "oas-microlite-allround-6-0-20-fe",
            "name": "Microlite All Round 6-0-20+2Fe",
            "brand": "Microlite",
            "supplier": "oas",
            "form": "granular",
            "release": "mixed",
            "sgn": 125,
            "particleSize_mm": "1-1.5",
            "surfaces": [
                "greens",
                "tees",
                "bowling",
                "fairways"
            ],
            "season": [
                "autumn",
                "winter",
                "spring"
            ],
            "analysis": {
                "N": 6,
                "P": 0,
                "K": 16.6,
                "Mg": 0,
                "Ca": 0,
                "Fe": 2,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "6-0-20+2Fe",
            "nBreakdown": {
                "ammN_pct": 2.6,
                "ureicN_pct": 0.4,
                "methyleneUreaN_pct": 3
            },
            "rates": {
                "greensMin": 200,
                "greensMax": 350,
                "teesMin": 200,
                "teesMax": 350,
                "fairwaysMin": 200,
                "fairwaysMax": 350
            },
            "rateUnit": "kg/ha",
            "interval_weeks": 6,
            "notes": "High K autumn/winter hardening micro-granule. Fe for colour. Methylene urea extends N slightly.",
            "verified": true,
            "productCode": "OAI008910",
            "nForm": "urea_mu",
            "nFormConfidence": "auto",
            "nFormReason": "nBreakdown: methylene urea blend"
        },
        {
            "id": "oas-greentec-mosskiller-4-0-4-fe",
            "name": "Greentec Mosskiller Pro 4-0-4+9Fe",
            "brand": "Greentec",
            "supplier": "oas",
            "form": "granular",
            "release": "quick",
            "sgn": 150,
            "particleSize_mm": "1-2",
            "surfaces": [
                "greens",
                "tees",
                "bowling",
                "fairways"
            ],
            "season": [
                "spring",
                "autumn"
            ],
            "analysis": {
                "N": 4,
                "P": 0,
                "K": 3.32,
                "Mg": 0,
                "Ca": 0,
                "Fe": 9,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "4-0-4+9Fe",
            "nBreakdown": {
                "ammN_pct": 3,
                "ureicN_pct": 1
            },
            "rates": {
                "greensMin": 300,
                "greensMax": 400,
                "teesMin": 300,
                "teesMax": 400,
                "fairwaysMin": 300,
                "fairwaysMax": 400
            },
            "rateUnit": "kg/ha",
            "interval_weeks": 6,
            "notes": "Registered mosskiller product. Very high Fe (9%). Spring starter or low-temp hardener. Low N avoids sappy growth in cool conditions.",
            "verified": true,
            "productCode": "OAI004532",
            "nForm": "mixed",
            "nFormConfidence": "auto",
            "nFormReason": "nBreakdown: ammonium + urea blend"
        },
        {
            "id": "oas-greentec-13-3-13-mg",
            "name": "Greentec 13-3-13+MgO",
            "brand": "Greentec",
            "supplier": "oas",
            "form": "granular",
            "release": "mixed",
            "sgn": 150,
            "particleSize_mm": "1-2",
            "surfaces": [
                "greens",
                "tees",
                "bowling",
                "fairways"
            ],
            "season": [
                "spring",
                "summer"
            ],
            "analysis": {
                "N": 13,
                "P": 1.31,
                "K": 10.79,
                "Mg": 0,
                "Ca": 0,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "13-3-13+MgO",
            "nBreakdown": {
                "ammN_pct": 5.5,
                "ureicN_pct": 3.7,
                "methyleneUreaN_pct": 3.6,
                "organicN_pct": 0.2
            },
            "rates": {
                "greensMin": 250,
                "greensMax": 350,
                "teesMin": 250,
                "teesMax": 350,
                "fairwaysMin": 250,
                "fairwaysMax": 350
            },
            "rateUnit": "kg/ha",
            "interval_weeks": 6,
            "notes": "Balanced NK with Mg. Methylene urea component extends longevity. MgO% not given, request SDS.",
            "verified": false,
            "productCode": "OAI004533",
            "nForm": "urea_mu",
            "nFormConfidence": "auto",
            "nFormReason": "nBreakdown: methylene urea blend"
        },
        {
            "id": "oas-greentec-6-5-18-mg-fe",
            "name": "Greentec 6-5-18+MgO+4Fe",
            "brand": "Greentec",
            "supplier": "oas",
            "form": "granular",
            "release": "quick",
            "sgn": 150,
            "particleSize_mm": "1-2",
            "surfaces": [
                "greens",
                "tees",
                "bowling",
                "fairways"
            ],
            "season": [
                "autumn",
                "spring"
            ],
            "analysis": {
                "N": 6,
                "P": 2.18,
                "K": 14.94,
                "Mg": 0,
                "Ca": 0,
                "Fe": 4,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "6-5-18+MgO+4Fe",
            "nBreakdown": {
                "ammN_pct": 3.5,
                "nitrateN_pct": 2.5
            },
            "rates": {
                "greensMin": 250,
                "greensMax": 350,
                "teesMin": 250,
                "teesMax": 350,
                "fairwaysMin": 250,
                "fairwaysMax": 350
            },
            "rateUnit": "kg/ha",
            "interval_weeks": 6,
            "notes": "High K + Fe autumn hardening. Ammonium + nitrate N sources, good cool-temp uptake. MgO% not stated, request SDS.",
            "verified": false,
            "productCode": "OAI004535",
            "nForm": "mixed",
            "nFormConfidence": "auto",
            "nFormReason": "nBreakdown: ammonium + nitrate (CAN-type)"
        },
        {
            "id": "oas-greentec-turf-hardener-3-0-3-mg-fe",
            "name": "Greentec Turf Hardener 3-0-3+1.6MgO+4Fe",
            "brand": "Greentec",
            "supplier": "oas",
            "form": "granular",
            "release": "quick",
            "sgn": 150,
            "particleSize_mm": "1-2",
            "surfaces": [
                "greens",
                "tees",
                "bowling",
                "fairways"
            ],
            "season": [
                "autumn",
                "winter"
            ],
            "analysis": {
                "N": 3,
                "P": 0,
                "K": 2.49,
                "Mg": 0.96,
                "Ca": 0,
                "Fe": 4,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "3-0-3+1.6MgO+4Fe",
            "nBreakdown": {
                "ammN_pct": 1.4,
                "ureicN_pct": 1.4,
                "organicN_pct": 0.2
            },
            "rates": {
                "greensMin": 250,
                "greensMax": 350,
                "teesMin": 250,
                "teesMax": 350,
                "fairwaysMin": 250,
                "fairwaysMax": 350
            },
            "rateUnit": "kg/ha",
            "interval_weeks": 6,
            "notes": "Minimal N hardening product. High Fe for colour, Mg for photosynthesis. Autumn/winter fine turf conditioning.",
            "verified": true,
            "productCode": "OAI000010",
            "nForm": "mixed",
            "nFormConfidence": "auto",
            "nFormReason": "nBreakdown: organic + mineral blend"
        },
        {
            "id": "oas-greentec-autumn-green-3-0-12-fe-ca-mg",
            "name": "Greentec Autumn Green 3-0-12+8Fe+6CaO+2MgO",
            "brand": "Greentec",
            "supplier": "oas",
            "form": "granular",
            "release": "quick",
            "sgn": 150,
            "particleSize_mm": "1-2",
            "surfaces": [
                "greens",
                "tees",
                "bowling",
                "fairways"
            ],
            "season": [
                "autumn",
                "winter"
            ],
            "analysis": {
                "N": 3,
                "P": 0,
                "K": 9.96,
                "Mg": 1.21,
                "Ca": 4.29,
                "Fe": 8,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "3-0-12+8Fe+6CaO+2MgO",
            "nBreakdown": {
                "ammN_pct": 3
            },
            "rates": {
                "greensMin": 250,
                "greensMax": 350,
                "teesMin": 250,
                "teesMax": 350,
                "fairwaysMin": 250,
                "fairwaysMax": 350
            },
            "rateUnit": "kg/ha",
            "interval_weeks": 6,
            "notes": "Comprehensive autumn micro-granule. Very high Fe (8%), Ca, Mg and K. Minimal N. Maximum hardening and colour response.",
            "verified": true,
            "productCode": "OAI000061",
            "nForm": "ammonium",
            "nFormConfidence": "auto",
            "nFormReason": "nBreakdown: ammonium only"
        },
        {
            "id": "oas-mycogro-10-3-14-mg-fe",
            "name": "MycoGro 10-3-14+3.3MgO+2Fe",
            "brand": "MycoGro",
            "supplier": "oas",
            "form": "granular",
            "release": "quick",
            "releaseNotes": "Contains mycorrhizae + beneficial bacteria. Biostimulant base.",
            "sgn": 100,
            "particleSize_mm": "0.5-1.5",
            "surfaces": [
                "greens",
                "tees",
                "bowling",
                "fairways"
            ],
            "season": [
                "spring",
                "summer",
                "autumn"
            ],
            "analysis": {
                "N": 10,
                "P": 1.31,
                "K": 11.62,
                "Mg": 1.99,
                "Ca": 0,
                "Fe": 2,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "10-3-14+3.3MgO+2Fe",
            "nBreakdown": {
                "ammN_pct": 9.1,
                "ureicN_pct": 0.9
            },
            "rates": {
                "greensMin": 250,
                "greensMax": 350,
                "teesMin": 250,
                "teesMax": 350,
                "fairwaysMin": 250,
                "fairwaysMax": 350
            },
            "rateUnit": "kg/ha",
            "interval_weeks": 6,
            "notes": "Mycorrhizae promote finer grass establishment. Expands root system. Increases water and nutrient uptake.",
            "verified": true,
            "productCode": "OAI001748",
            "nForm": "mixed",
            "nFormConfidence": "auto",
            "nFormReason": "nBreakdown: ammonium + urea blend"
        },
        {
            "id": "oas-mycogro-5-0-28-mg-fe",
            "name": "MycoGro 5-0-28+2.5MgO+2.5Fe",
            "brand": "MycoGro",
            "supplier": "oas",
            "form": "granular",
            "release": "quick",
            "releaseNotes": "Contains mycorrhizae + beneficial bacteria.",
            "sgn": 100,
            "particleSize_mm": "0.5-1.5",
            "surfaces": [
                "greens",
                "tees",
                "bowling",
                "fairways"
            ],
            "season": [
                "autumn"
            ],
            "analysis": {
                "N": 5,
                "P": 0,
                "K": 23.25,
                "Mg": 1.51,
                "Ca": 0,
                "Fe": 2.5,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "5-0-28+2.5MgO+2.5Fe",
            "nBreakdown": {
                "ammN_pct": 3.2,
                "ureicN_pct": 1.8
            },
            "rates": {
                "greensMin": 250,
                "greensMax": 350,
                "teesMin": 250,
                "teesMax": 350,
                "fairwaysMin": 250,
                "fairwaysMax": 350
            },
            "rateUnit": "kg/ha",
            "interval_weeks": 6,
            "notes": "Very high K mycorrhizal product. Autumn hardening with soil biology support. Highest K in MycoGro range.",
            "verified": true,
            "productCode": "OAI001736",
            "nForm": "mixed",
            "nFormConfidence": "auto",
            "nFormReason": "nBreakdown: ammonium + urea blend"
        },
        {
            "id": "oas-mycogro-12-0-9",
            "name": "MycoGro 12-0-9",
            "brand": "MycoGro",
            "supplier": "oas",
            "form": "granular",
            "release": "quick",
            "releaseNotes": "Contains mycorrhizae + beneficial bacteria.",
            "sgn": 100,
            "particleSize_mm": "0.5-1.5",
            "surfaces": [
                "greens",
                "tees",
                "bowling",
                "fairways"
            ],
            "season": [
                "spring",
                "summer"
            ],
            "analysis": {
                "N": 12,
                "P": 0,
                "K": 7.47,
                "Mg": 0,
                "Ca": 0,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "12-0-9",
            "nBreakdown": {
                "ammN_pct": 10.6,
                "ureicN_pct": 1.4
            },
            "rates": {
                "greensMin": 250,
                "greensMax": 350,
                "teesMin": 250,
                "teesMax": 350,
                "fairwaysMin": 250,
                "fairwaysMax": 350
            },
            "rateUnit": "kg/ha",
            "interval_weeks": 6,
            "notes": "Simple NK mycorrhizal product. Spring/summer growth with soil biology benefit.",
            "verified": true,
            "productCode": "OAI001737",
            "nForm": "mixed",
            "nFormConfidence": "auto",
            "nFormReason": "nBreakdown: ammonium + urea blend"
        },
        {
            "id": "oas-ccomplex-5-2-10-ca-mg",
            "name": "C-Complex 5-2-10+2CaO+MgO",
            "brand": "C-Complex",
            "supplier": "oas",
            "form": "granular",
            "release": "organic",
            "releaseNotes": "Naturvigor aerobically composted cow manure + cold-processed seaweed. Soft granule technology.",
            "sgn": 150,
            "particleSize_mm": "1-2",
            "surfaces": [
                "greens",
                "tees",
                "bowling",
                "fairways"
            ],
            "season": [
                "spring",
                "summer",
                "autumn"
            ],
            "analysis": {
                "N": 5,
                "P": 0.87,
                "K": 8.3,
                "Mg": 0,
                "Ca": 1.43,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "5-2-10+2CaO+MgO",
            "nBreakdown": {
                "ammN_pct": 1.1,
                "ureicN_pct": 2.1,
                "nitrateN_pct": 1.4,
                "organicN_pct": 0.4
            },
            "rates": {
                "greensMin": 250,
                "greensMax": 400,
                "teesMin": 250,
                "teesMax": 400,
                "fairwaysMin": 250,
                "fairwaysMax": 400
            },
            "rateUnit": "kg/ha",
            "interval_weeks": 6,
            "notes": "Composted organic base stimulates soil microbial activity without N immobilisation (unlike non-composted organics). MgO% not stated, request SDS.",
            "verified": false,
            "productCode": "OAI005492",
            "nForm": "mixed",
            "nFormConfidence": "auto",
            "nFormReason": "nBreakdown: organic + mineral blend"
        },
        {
            "id": "oas-ccomplex-7-0-7-ca",
            "name": "C-Complex 7-0-7+5CaO",
            "brand": "C-Complex",
            "supplier": "oas",
            "form": "granular",
            "release": "organic",
            "releaseNotes": "Naturvigor base + cold-processed seaweed.",
            "sgn": 150,
            "particleSize_mm": "1-2",
            "surfaces": [
                "greens",
                "tees",
                "bowling",
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
                "K": 5.81,
                "Mg": 0,
                "Ca": 3.57,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "7-0-7+5CaO",
            "nBreakdown": {
                "ammN_pct": 3.3,
                "ureicN_pct": 0.9,
                "organicN_pct": 0.4
            },
            "rates": {
                "greensMin": 250,
                "greensMax": 400,
                "teesMin": 250,
                "teesMax": 400,
                "fairwaysMin": 250,
                "fairwaysMax": 400
            },
            "rateUnit": "kg/ha",
            "interval_weeks": 6,
            "notes": "High Ca organic-based. NK balance with cell wall support.",
            "verified": true,
            "productCode": "OAI005491",
            "nForm": "mixed",
            "nFormConfidence": "auto",
            "nFormReason": "nBreakdown: organic + mineral blend"
        },
        {
            "id": "oas-ccomplex-sport-14-2-5-mg-ca",
            "name": "C-Complex Sport 14-2-5+MgO+2CaO",
            "brand": "C-Complex",
            "supplier": "oas",
            "form": "granular",
            "release": "organic",
            "releaseNotes": "Naturvigor base. Higher N sport formula.",
            "sgn": 250,
            "particleSize_mm": "2-3",
            "surfaces": [
                "tees",
                "fairways",
                "sports"
            ],
            "season": [
                "spring",
                "summer"
            ],
            "analysis": {
                "N": 14,
                "P": 0.87,
                "K": 4.15,
                "Mg": 0,
                "Ca": 1.43,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "14-2-5+MgO+2CaO",
            "nBreakdown": {
                "ammN_pct": 3.4,
                "ureicN_pct": 10.2,
                "organicN_pct": 0.4
            },
            "rates": {
                "teesMin": 250,
                "teesMax": 400,
                "fairwaysMin": 250,
                "fairwaysMax": 400,
                "sportsMin": 250,
                "sportsMax": 400
            },
            "rateUnit": "kg/ha",
            "interval_weeks": 8,
            "notes": "Longer longevity (8-10 weeks) due to larger granule and urea-dominant N. MgO% not stated, request SDS.",
            "verified": false,
            "productCode": "OAI005493",
            "nForm": "mixed",
            "nFormConfidence": "auto",
            "nFormReason": "nBreakdown: organic + mineral blend"
        },
        {
            "id": "oas-apex-4-0-8-mg-fe",
            "name": "Apex 4-0-8+3.3MgO+4Fe",
            "brand": "Apex",
            "supplier": "oas",
            "form": "granular",
            "release": "organic",
            "releaseNotes": "Organic N sources + humic acid + polyhalite. Immediate mineral N + slow organic release.",
            "sgn": 175,
            "particleSize_mm": "1-2.5",
            "surfaces": [
                "greens",
                "tees",
                "bowling",
                "fairways"
            ],
            "season": [
                "spring",
                "summer",
                "autumn"
            ],
            "analysis": {
                "N": 4,
                "P": 0,
                "K": 6.64,
                "Mg": 1.99,
                "Ca": 0,
                "Fe": 4,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "4-0-8+3.3MgO+4Fe",
            "nBreakdown": {
                "ammN_pct": 2.7,
                "ureicN_pct": 0.9,
                "organicN_pct": 0.4
            },
            "rates": {
                "greensMin": 250,
                "greensMax": 350,
                "teesMin": 250,
                "teesMax": 350,
                "fairwaysMin": 250,
                "fairwaysMax": 350
            },
            "rateUnit": "kg/ha",
            "interval_weeks": 6,
            "notes": "Organo-mineral with humic acid and polyhalite. High Fe and Mg. Hardening + colour formula. Soil biology food source.",
            "verified": true,
            "productCode": "OAI000037",
            "nForm": "mixed",
            "nFormConfidence": "auto",
            "nFormReason": "nBreakdown: organic + mineral blend"
        },
        {
            "id": "oas-apex-4-6-4-ca-mg-humic",
            "name": "Apex 4-6-4+7CaO+0.7MgO+11%Humic",
            "brand": "Apex",
            "supplier": "oas",
            "form": "granular",
            "release": "organic",
            "releaseNotes": "Organic N dominant. High humic acid (11%). 6-8 week longevity.",
            "sgn": 150,
            "particleSize_mm": "1-2",
            "surfaces": [
                "greens",
                "tees",
                "bowling",
                "fairways"
            ],
            "season": [
                "spring",
                "autumn"
            ],
            "analysis": {
                "N": 4,
                "P": 2.62,
                "K": 3.32,
                "Mg": 0.42,
                "Ca": 5,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "4-6-4+7CaO+0.7MgO+11%Humic",
            "nBreakdown": {
                "ureicN_pct": 1,
                "organicN_pct": 3
            },
            "rates": {
                "greensMin": 250,
                "greensMax": 400,
                "teesMin": 250,
                "teesMax": 400,
                "fairwaysMin": 250,
                "fairwaysMax": 400
            },
            "rateUnit": "kg/ha",
            "interval_weeks": 7,
            "notes": "High Ca and P. High humic acid (11%), CEC enhancement, chelation, soil biology. Establishment and root development. 6-8 week longevity.",
            "verified": true,
            "productCode": "OAI000044",
            "nForm": "mixed",
            "nFormConfidence": "auto",
            "nFormReason": "nBreakdown: organic + mineral blend"
        },
        {
            "id": "oas-apex-5-2-4-fe-ca-mg-humic",
            "name": "Apex 5-2-4+2Fe+7CaO+0.7MgO+9%Humic",
            "brand": "Apex",
            "supplier": "oas",
            "form": "granular",
            "release": "organic",
            "releaseNotes": "Mixed N sources including methylene urea. 6-8 week longevity.",
            "sgn": 150,
            "particleSize_mm": "1-2",
            "surfaces": [
                "greens",
                "tees",
                "bowling",
                "fairways"
            ],
            "season": [
                "spring",
                "summer",
                "autumn"
            ],
            "analysis": {
                "N": 5,
                "P": 0.87,
                "K": 3.32,
                "Mg": 0.42,
                "Ca": 5,
                "Fe": 2,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "5-2-4+2Fe+7CaO+0.7MgO+9%Humic",
            "nBreakdown": {
                "ammN_pct": 1.3,
                "ureicN_pct": 0.2,
                "organicN_pct": 2.7,
                "methyleneUreaN_pct": 0.8
            },
            "rates": {
                "greensMin": 250,
                "greensMax": 350,
                "teesMin": 250,
                "teesMax": 350,
                "fairwaysMin": 250,
                "fairwaysMax": 350
            },
            "rateUnit": "kg/ha",
            "interval_weeks": 7,
            "notes": "Fe + Ca + humic. Comprehensive secondary nutrient package. Methylene urea extends N release.",
            "verified": true,
            "productCode": "OAI000045",
            "nForm": "urea_mu",
            "nFormConfidence": "auto",
            "nFormReason": "nBreakdown: methylene urea blend"
        },
        {
            "id": "oas-apex-10-1-4-ca-mg-humic",
            "name": "Apex 10-1-4+4CaO+MgO+6%Humic",
            "brand": "Apex",
            "supplier": "oas",
            "form": "granular",
            "release": "organic",
            "releaseNotes": "6-8 week longevity.",
            "sgn": 150,
            "particleSize_mm": "1-2",
            "surfaces": [
                "greens",
                "tees",
                "bowling",
                "fairways"
            ],
            "season": [
                "spring",
                "summer"
            ],
            "analysis": {
                "N": 10,
                "P": 0.44,
                "K": 3.32,
                "Mg": 0,
                "Ca": 2.86,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "10-1-4+4CaO+MgO+6%Humic",
            "nBreakdown": {
                "ammN_pct": 6.5,
                "ureicN_pct": 1,
                "organicN_pct": 2.5
            },
            "rates": {
                "greensMin": 250,
                "greensMax": 400,
                "teesMin": 250,
                "teesMax": 400,
                "fairwaysMin": 250,
                "fairwaysMax": 400
            },
            "rateUnit": "kg/ha",
            "interval_weeks": 7,
            "notes": "Higher N Apex. Ca + humic + MgO. Spring/summer growth with soil biology benefit. MgO% not stated, request SDS.",
            "verified": false,
            "productCode": "OAI000046",
            "nForm": "mixed",
            "nFormConfidence": "auto",
            "nFormReason": "nBreakdown: organic + mineral blend"
        },
        {
            "id": "oas-apex-oc1-8-0-0-fe",
            "name": "Apex OC1 8-0-0+2Fe",
            "brand": "Apex",
            "supplier": "oas",
            "form": "granular",
            "release": "organic",
            "releaseNotes": "8-10 week longevity from organic N base.",
            "sgn": 175,
            "particleSize_mm": "1-2.5",
            "surfaces": [
                "greens",
                "tees",
                "bowling",
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
                "Mg": 0,
                "Ca": 0,
                "Fe": 2,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "8-0-0+2Fe",
            "nBreakdown": {
                "organicN_pct": 8
            },
            "rates": {
                "greensMin": 250,
                "greensMax": 400,
                "teesMin": 250,
                "teesMax": 400,
                "fairwaysMin": 250,
                "fairwaysMax": 400
            },
            "rateUnit": "kg/ha",
            "interval_weeks": 9,
            "notes": "Pure organic N with Fe. Very slow mineralisation. Longest longevity in Apex range (8-10 weeks). Low salt index.",
            "verified": true,
            "productCode": "OAI000175",
            "nForm": "organic",
            "nFormConfidence": "auto",
            "nFormReason": "nBreakdown: organic N dominant"
        },
        {
            "id": "oas-apex-oc2-5-2-10",
            "name": "Apex OC2 5-2-10",
            "brand": "Apex",
            "supplier": "oas",
            "form": "granular",
            "release": "organic",
            "releaseNotes": "8-10 week longevity.",
            "sgn": 175,
            "particleSize_mm": "1-2.5",
            "surfaces": [
                "greens",
                "tees",
                "bowling",
                "fairways"
            ],
            "season": [
                "spring",
                "autumn"
            ],
            "analysis": {
                "N": 5,
                "P": 0.87,
                "K": 8.3,
                "Mg": 0,
                "Ca": 0,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "5-2-10",
            "nBreakdown": {
                "ammN_pct": 2,
                "ureicN_pct": 1,
                "organicN_pct": 5
            },
            "rates": {
                "greensMin": 250,
                "greensMax": 400,
                "teesMin": 250,
                "teesMax": 400,
                "fairwaysMin": 250,
                "fairwaysMax": 400
            },
            "rateUnit": "kg/ha",
            "interval_weeks": 9,
            "notes": "Organic NPK. Higher K version, autumn or spring conditioning. 8-10 week slow release from organic N.",
            "verified": true,
            "productCode": "OAI000176",
            "nForm": "mixed",
            "nFormConfidence": "auto",
            "nFormReason": "nBreakdown: organic + mineral blend"
        },
        {
            "id": "oas-delta-15-2-12-fe",
            "name": "Delta 15-2-12+0.5Fe",
            "brand": "Delta",
            "supplier": "oas",
            "form": "granular",
            "release": "mixed",
            "releaseNotes": "Organic base + mineral N + methylene urea. 8-10 week longevity.",
            "sgn": 200,
            "particleSize_mm": "1-3",
            "surfaces": [
                "tees",
                "fairways",
                "sports"
            ],
            "season": [
                "spring",
                "summer"
            ],
            "analysis": {
                "N": 15,
                "P": 0.87,
                "K": 9.96,
                "Mg": 0,
                "Ca": 0,
                "Fe": 0.5,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "15-2-12+0.5Fe",
            "nBreakdown": {
                "ammN_pct": 8.7,
                "ureicN_pct": 2.1,
                "organicN_pct": 0.3,
                "methyleneUreaN_pct": 3.9
            },
            "rates": {
                "teesMin": 250,
                "teesMax": 350,
                "fairwaysMin": 250,
                "fairwaysMax": 350,
                "sportsMin": 250,
                "sportsMax": 350
            },
            "rateUnit": "kg/ha",
            "interval_weeks": 9,
            "notes": "Premium Delta formula. Longest longevity in range (8-10 weeks) from methylene urea + organic base.",
            "verified": true,
            "productCode": "OAI000181",
            "nForm": "urea_mu",
            "nFormConfidence": "auto",
            "nFormReason": "nBreakdown: methylene urea blend"
        },
        {
            "id": "oas-delta-12-4-8-fe",
            "name": "Delta 12-4-8+0.5Fe",
            "brand": "Delta",
            "supplier": "oas",
            "form": "granular",
            "release": "organic",
            "releaseNotes": "Organic base + mineral N. 6 week longevity.",
            "sgn": 200,
            "particleSize_mm": "1-3",
            "surfaces": [
                "tees",
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
                "P": 1.74,
                "K": 6.64,
                "Mg": 0,
                "Ca": 0,
                "Fe": 0.5,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "12-4-8+0.5Fe",
            "nBreakdown": {
                "ammN_pct": 10.2,
                "ureicN_pct": 1.5,
                "organicN_pct": 0.3
            },
            "rates": {
                "teesMin": 250,
                "teesMax": 350,
                "fairwaysMin": 250,
                "fairwaysMax": 350,
                "sportsMin": 250,
                "sportsMax": 350
            },
            "rateUnit": "kg/ha",
            "interval_weeks": 6,
            "notes": "Balanced NPK organo-mineral. All-round outfield formula.",
            "verified": true,
            "productCode": "OAI000177",
            "nForm": "mixed",
            "nFormConfidence": "auto",
            "nFormReason": "nBreakdown: organic + mineral blend"
        },
        {
            "id": "oas-delta-8-6-6-fe",
            "name": "Delta 8-6-6+0.5Fe",
            "brand": "Delta",
            "supplier": "oas",
            "form": "granular",
            "release": "organic",
            "sgn": 200,
            "particleSize_mm": "1-3",
            "surfaces": [
                "tees",
                "fairways",
                "sports"
            ],
            "season": [
                "spring",
                "autumn"
            ],
            "analysis": {
                "N": 8,
                "P": 2.62,
                "K": 4.98,
                "Mg": 0,
                "Ca": 0,
                "Fe": 0.5,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "8-6-6+0.5Fe",
            "nBreakdown": {
                "ammN_pct": 5.6,
                "organicN_pct": 0.4
            },
            "rates": {
                "teesMin": 250,
                "teesMax": 350,
                "fairwaysMin": 250,
                "fairwaysMax": 350,
                "sportsMin": 250,
                "sportsMax": 350
            },
            "rateUnit": "kg/ha",
            "interval_weeks": 6,
            "notes": "Lower N organo-mineral. Higher P for root development. Spring renovation or autumn preparation.",
            "verified": true,
            "productCode": "OAI000179",
            "nForm": "mixed",
            "nFormConfidence": "auto",
            "nFormReason": "nBreakdown: organic + mineral blend"
        },
        {
            "id": "oas-delta-sport-9-5-5",
            "name": "Delta Sport 9-5-5",
            "brand": "Delta Sport",
            "supplier": "oas",
            "form": "granular",
            "release": "quick",
            "releaseNotes": "Conventional ammoniacal N. Homogeneous granule.",
            "sgn": 200,
            "particleSize_mm": "1-3",
            "surfaces": [
                "tees",
                "fairways",
                "sports"
            ],
            "season": [
                "spring",
                "summer",
                "autumn"
            ],
            "analysis": {
                "N": 9,
                "P": 2.18,
                "K": 4.15,
                "Mg": 0,
                "Ca": 0,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "9-5-5",
            "nBreakdown": {
                "ammN_pct": 9
            },
            "rates": {
                "teesMin": 250,
                "teesMax": 350,
                "fairwaysMin": 250,
                "fairwaysMax": 350,
                "sportsMin": 250,
                "sportsMax": 350
            },
            "rateUnit": "kg/ha",
            "interval_weeks": 6,
            "notes": "Cost-effective conventional outfield formula. Homogeneous, each granule identical. Quick response.",
            "verified": true,
            "productCode": "OAI000021",
            "nForm": "ammonium",
            "nFormConfidence": "auto",
            "nFormReason": "nBreakdown: ammonium only"
        },
        {
            "id": "oas-delta-sport-4-10-10",
            "name": "Delta Sport 4-10-10",
            "brand": "Delta Sport",
            "supplier": "oas",
            "form": "granular",
            "release": "quick",
            "sgn": 300,
            "particleSize_mm": "2-4",
            "surfaces": [
                "fairways",
                "sports"
            ],
            "season": [
                "spring",
                "autumn"
            ],
            "analysis": {
                "N": 4,
                "P": 4.36,
                "K": 8.3,
                "Mg": 0,
                "Ca": 0,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "4-10-10",
            "nBreakdown": {
                "ammN_pct": 4
            },
            "rates": {
                "fairwaysMin": 250,
                "fairwaysMax": 350,
                "sportsMin": 250,
                "sportsMax": 350
            },
            "rateUnit": "kg/ha",
            "interval_weeks": 6,
            "notes": "High P+K establishment formula. Largest granule in Delta range. Pre-seeding renovation or autumn conditioning.",
            "verified": true,
            "productCode": "OAI000022",
            "nForm": "ammonium",
            "nFormConfidence": "auto",
            "nFormReason": "nBreakdown: ammonium only"
        },
        {
            "id": "oas-delta-sport-12-0-9-fe-seaweed",
            "name": "Delta Sport 12-0-9+0.5Fe+Seaweed",
            "brand": "Delta Sport",
            "supplier": "oas",
            "form": "granular",
            "release": "quick",
            "sgn": 200,
            "particleSize_mm": "1-3",
            "surfaces": [
                "tees",
                "fairways",
                "sports"
            ],
            "season": [
                "spring",
                "summer"
            ],
            "analysis": {
                "N": 12,
                "P": 0,
                "K": 7.47,
                "Mg": 0,
                "Ca": 0,
                "Fe": 0.5,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "12-0-9+0.5Fe+Seaweed",
            "nBreakdown": {
                "ammN_pct": 12
            },
            "rates": {
                "teesMin": 250,
                "teesMax": 350,
                "fairwaysMin": 250,
                "fairwaysMax": 350,
                "sportsMin": 250,
                "sportsMax": 350
            },
            "rateUnit": "kg/ha",
            "interval_weeks": 6,
            "notes": "NK with seaweed biostimulant addition. P-free. Spring/summer outfield.",
            "verified": true,
            "productCode": "OAI000026",
            "nForm": "ammonium",
            "nFormConfidence": "auto",
            "nFormReason": "nBreakdown: ammonium only"
        },
        {
            "id": "oas-delta-sport-8-12-8",
            "name": "Delta Sport 8-12-8",
            "brand": "Delta Sport",
            "supplier": "oas",
            "form": "granular",
            "release": "quick",
            "sgn": 200,
            "particleSize_mm": "1-3",
            "surfaces": [
                "fairways",
                "sports"
            ],
            "season": [
                "spring",
                "autumn"
            ],
            "analysis": {
                "N": 8,
                "P": 5.24,
                "K": 6.64,
                "Mg": 0,
                "Ca": 0,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "8-12-8",
            "nBreakdown": {
                "ammN_pct": 8
            },
            "rates": {
                "fairwaysMin": 250,
                "fairwaysMax": 350,
                "sportsMin": 250,
                "sportsMax": 350
            },
            "rateUnit": "kg/ha",
            "interval_weeks": 6,
            "notes": "Very high P for renovation, establishment or soil P correction. Spring or autumn.",
            "verified": true,
            "productCode": "OAI000028",
            "nForm": "ammonium",
            "nFormConfidence": "auto",
            "nFormReason": "nBreakdown: ammonium only"
        },
        {
            "id": "oas-greentec-8-0-6-mg-fe",
            "name": "Greentec 8-0-6+3.3MgO+4Fe",
            "brand": "Greentec",
            "supplier": "oas",
            "form": "granular",
            "release": "quick",
            "sgn": 150,
            "particleSize_mm": "1-2",
            "surfaces": [
                "greens",
                "tees",
                "bowling",
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
                "Mg": 1.99,
                "Ca": 0,
                "Fe": 4,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "8-0-6+3.3MgO+4Fe",
            "nBreakdown": {
                "ammN_pct": 3.7,
                "ureicN_pct": 3.3,
                "organicN_pct": 0.4
            },
            "rates": {
                "greensMin": 250,
                "greensMax": 350,
                "teesMin": 250,
                "teesMax": 350,
                "fairwaysMin": 250,
                "fairwaysMax": 350
            },
            "rateUnit": "kg/ha",
            "interval_weeks": 6,
            "notes": "High Mg and Fe micro-granule. Colour and photosynthesis support. Multi-season use.",
            "verified": true,
            "productCode": "OAI000174",
            "nForm": "mixed",
            "nFormConfidence": "auto",
            "nFormReason": "nBreakdown: organic + mineral blend"
        },
        {
            "id": "oas-greentec-14-2-7-mg",
            "name": "Greentec 14-2-7+1.6MgO",
            "brand": "Greentec",
            "supplier": "oas",
            "form": "granular",
            "release": "quick",
            "sgn": 150,
            "particleSize_mm": "1-2",
            "surfaces": [
                "greens",
                "tees",
                "bowling",
                "fairways"
            ],
            "season": [
                "spring",
                "summer"
            ],
            "analysis": {
                "N": 14,
                "P": 0.87,
                "K": 5.81,
                "Mg": 0.96,
                "Ca": 0,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "14-2-7+1.6MgO",
            "nBreakdown": {
                "ammN_pct": 6.8,
                "ureicN_pct": 6.9,
                "organicN_pct": 0.3
            },
            "rates": {
                "greensMin": 250,
                "greensMax": 350,
                "teesMin": 250,
                "teesMax": 350,
                "fairwaysMin": 250,
                "fairwaysMax": 350
            },
            "rateUnit": "kg/ha",
            "interval_weeks": 6,
            "notes": "Spring/summer growth formula with Mg. Urea + ammoniacal N for flexible uptake in varying temperatures.",
            "verified": true,
            "productCode": "OAI000029",
            "nForm": "mixed",
            "nFormConfidence": "auto",
            "nFormReason": "nBreakdown: organic + mineral blend"
        },
        {
            "id": "oas-greentec-12-0-9-mg-fe",
            "name": "Greentec 12-0-9+1.6MgO+1Fe",
            "brand": "Greentec",
            "supplier": "oas",
            "form": "granular",
            "release": "quick",
            "sgn": 150,
            "particleSize_mm": "1-2",
            "surfaces": [
                "greens",
                "tees",
                "bowling",
                "fairways"
            ],
            "season": [
                "spring",
                "summer",
                "autumn"
            ],
            "analysis": {
                "N": 12,
                "P": 0,
                "K": 7.47,
                "Mg": 0.96,
                "Ca": 0,
                "Fe": 1,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "12-0-9+1.6MgO+1Fe",
            "nBreakdown": {
                "ammN_pct": 10.5,
                "ureicN_pct": 1.1,
                "organicN_pct": 0.4
            },
            "rates": {
                "greensMin": 250,
                "greensMax": 350,
                "teesMin": 250,
                "teesMax": 350,
                "fairwaysMin": 250,
                "fairwaysMax": 350
            },
            "rateUnit": "kg/ha",
            "interval_weeks": 6,
            "notes": "P-free NK with Mg and Fe. Ammoniacal-dominant N, reliable cool-temp uptake.",
            "verified": true,
            "productCode": "OAI000062",
            "nForm": "mixed",
            "nFormConfidence": "auto",
            "nFormReason": "nBreakdown: organic + mineral blend"
        },
        {
            "id": "oas-greentec-9-0-0-fe",
            "name": "Greentec 9-0-0+11Fe",
            "brand": "Greentec",
            "supplier": "oas",
            "form": "granular",
            "release": "quick",
            "sgn": 150,
            "particleSize_mm": "1-2",
            "surfaces": [
                "greens",
                "tees",
                "bowling",
                "fairways"
            ],
            "season": [
                "autumn",
                "winter",
                "spring"
            ],
            "analysis": {
                "N": 9,
                "P": 0,
                "K": 0,
                "Mg": 0,
                "Ca": 0,
                "Fe": 11,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "9-0-0+11Fe",
            "nBreakdown": {
                "ammN_pct": 7.6,
                "ureicN_pct": 1.4
            },
            "rates": {
                "greensMin": 250,
                "greensMax": 350,
                "teesMin": 250,
                "teesMax": 350,
                "fairwaysMin": 250,
                "fairwaysMax": 350
            },
            "rateUnit": "kg/ha",
            "interval_weeks": 6,
            "notes": "Highest Fe in Greentec range (11%). Maximum colour response. Minimal nutrients otherwise. Autumn/winter fine turf.",
            "verified": true,
            "productCode": "OAI000032",
            "nForm": "mixed",
            "nFormConfidence": "auto",
            "nFormReason": "nBreakdown: ammonium + urea blend"
        },
        {
            "id": "oas-greentec-8-0-0-fe",
            "name": "Greentec 8-0-0+2Fe",
            "brand": "Greentec",
            "supplier": "oas",
            "form": "granular",
            "release": "quick",
            "sgn": 150,
            "particleSize_mm": "1-2",
            "surfaces": [
                "greens",
                "tees",
                "bowling",
                "fairways"
            ],
            "season": [
                "spring",
                "summer",
                "autumn"
            ],
            "season_notes": "N-only growth response with Fe colour support.",
            "analysis": {
                "N": 8,
                "P": 0,
                "K": 0,
                "Mg": 0,
                "Ca": 0,
                "Fe": 2,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "8-0-0+2Fe",
            "nBreakdown": {
                "ammN_pct": 6.7,
                "ureicN_pct": 0.9,
                "organicN_pct": 0.4
            },
            "rates": {
                "greensMin": 250,
                "greensMax": 350,
                "teesMin": 250,
                "teesMax": 350,
                "fairwaysMin": 250,
                "fairwaysMax": 350
            },
            "rateUnit": "kg/ha",
            "interval_weeks": 6,
            "notes": "N + Fe only. Supplemental N top-up with colour response. Use alongside K/P programme.",
            "verified": true,
            "productCode": "OAI000036",
            "nForm": "mixed",
            "nFormConfidence": "auto",
            "nFormReason": "nBreakdown: organic + mineral blend"
        },
        {
            "id": "oas-greentec-6-0-12-fe-mg-ca",
            "name": "Greentec 6-0-12+2Fe+3.3MgO+8CaO",
            "brand": "Greentec",
            "supplier": "oas",
            "form": "granular",
            "release": "quick",
            "sgn": 150,
            "particleSize_mm": "1-2",
            "surfaces": [
                "greens",
                "tees",
                "bowling",
                "fairways"
            ],
            "season": [
                "autumn",
                "spring"
            ],
            "analysis": {
                "N": 6,
                "P": 0,
                "K": 9.96,
                "Mg": 1.99,
                "Ca": 5.72,
                "Fe": 2,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "6-0-12+2Fe+3.3MgO+8CaO",
            "nBreakdown": {
                "ammN_pct": 4.9,
                "ureicN_pct": 0.9,
                "organicN_pct": 0.2
            },
            "rates": {
                "greensMin": 250,
                "greensMax": 350,
                "teesMin": 250,
                "teesMax": 350,
                "fairwaysMin": 250,
                "fairwaysMax": 350
            },
            "rateUnit": "kg/ha",
            "interval_weeks": 6,
            "notes": "Comprehensive secondary nutrient package, Ca, Mg, Fe plus K. Autumn hardening with colour response.",
            "verified": true,
            "productCode": "OAI000051",
            "nForm": "mixed",
            "nFormConfidence": "auto",
            "nFormReason": "nBreakdown: organic + mineral blend"
        },
        {
            "id": "oas-greentec-5-5-10-fe-mg-ca",
            "name": "Greentec 5-5-10+4Fe+2.4MgO+8CaO",
            "brand": "Greentec",
            "supplier": "oas",
            "form": "granular",
            "release": "quick",
            "sgn": 150,
            "particleSize_mm": "1-2",
            "surfaces": [
                "greens",
                "tees",
                "bowling",
                "fairways"
            ],
            "season": [
                "spring",
                "autumn"
            ],
            "analysis": {
                "N": 5,
                "P": 2.18,
                "K": 8.3,
                "Mg": 1.45,
                "Ca": 5.72,
                "Fe": 4,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "5-5-10+4Fe+2.4MgO+8CaO",
            "nBreakdown": {
                "ammN_pct": 3.2,
                "ureicN_pct": 1.6,
                "organicN_pct": 0.2
            },
            "rates": {
                "greensMin": 250,
                "greensMax": 350,
                "teesMin": 250,
                "teesMax": 350,
                "fairwaysMin": 250,
                "fairwaysMax": 350
            },
            "rateUnit": "kg/ha",
            "interval_weeks": 6,
            "notes": "Full spectrum micro-granule, NPK + Ca + Mg + Fe. Renovation or multi-nutrient top-up.",
            "verified": true,
            "productCode": "OAI000052",
            "nForm": "mixed",
            "nFormConfidence": "auto",
            "nFormReason": "nBreakdown: organic + mineral blend"
        },
        {
            "id": "oas-mycogro-5-2-10-mg-fe",
            "name": "MycoGro 5-2-10+2MgO+0.6Fe",
            "brand": "MycoGro",
            "supplier": "oas",
            "form": "granular",
            "release": "organic",
            "releaseNotes": "Mycorrhizae + beneficial bacteria + organic N base.",
            "sgn": 100,
            "particleSize_mm": "0.5-1.5",
            "surfaces": [
                "greens",
                "tees",
                "bowling",
                "fairways"
            ],
            "season": [
                "spring",
                "autumn"
            ],
            "analysis": {
                "N": 5,
                "P": 0.87,
                "K": 8.3,
                "Mg": 1.21,
                "Ca": 0,
                "Fe": 0.6,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "5-2-10+2MgO+0.6Fe",
            "nBreakdown": {
                "ammN_pct": 2.2,
                "ureicN_pct": 0.6,
                "organicN_pct": 1.8
            },
            "rates": {
                "greensMin": 250,
                "greensMax": 400,
                "teesMin": 250,
                "teesMax": 400,
                "fairwaysMin": 250,
                "fairwaysMax": 400
            },
            "rateUnit": "kg/ha",
            "interval_weeks": 6,
            "notes": "Organic N mycorrhizal formula. High K with Mg and Fe. Soil food web development.",
            "verified": true,
            "productCode": "OAI007274",
            "nForm": "mixed",
            "nFormConfidence": "auto",
            "nFormReason": "nBreakdown: organic + mineral blend"
        },
        {
            "id": "oas-mycogro-10-0-20-mg-fe",
            "name": "MycoGro 10-0-20+4MgO+1.6Fe",
            "brand": "MycoGro",
            "supplier": "oas",
            "form": "granular",
            "release": "quick",
            "releaseNotes": "Mycorrhizae + beneficial bacteria.",
            "sgn": 100,
            "particleSize_mm": "0.5-1.5",
            "surfaces": [
                "greens",
                "tees",
                "bowling",
                "fairways"
            ],
            "season": [
                "autumn",
                "spring"
            ],
            "analysis": {
                "N": 10,
                "P": 0,
                "K": 16.6,
                "Mg": 2.41,
                "Ca": 0,
                "Fe": 1.6,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "10-0-20+4MgO+1.6Fe",
            "nBreakdown": {
                "ammN_pct": 3.8,
                "ureicN_pct": 6.1
            },
            "rates": {
                "greensMin": 250,
                "greensMax": 350,
                "teesMin": 250,
                "teesMax": 350,
                "fairwaysMin": 250,
                "fairwaysMax": 350
            },
            "rateUnit": "kg/ha",
            "interval_weeks": 6,
            "notes": "Very high K mycorrhizal micro-granule. High Mg and Fe. Autumn hardening with soil biology.",
            "verified": true,
            "productCode": "OAI001744",
            "nForm": "mixed",
            "nFormConfidence": "auto",
            "nFormReason": "nBreakdown: ammonium + urea blend"
        },
        {
            "id": "oas-mycogro-5-3-8",
            "name": "MycoGro 5-3-8",
            "brand": "MycoGro",
            "supplier": "oas",
            "form": "granular",
            "release": "organic",
            "releaseNotes": "Mycorrhizae + beneficial bacteria. Organic N dominant.",
            "sgn": 100,
            "particleSize_mm": "0.5-1.5",
            "surfaces": [
                "greens",
                "tees",
                "bowling",
                "fairways"
            ],
            "season": [
                "spring",
                "summer",
                "autumn"
            ],
            "analysis": {
                "N": 5,
                "P": 1.31,
                "K": 6.64,
                "Mg": 0,
                "Ca": 0,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "5-3-8",
            "nBreakdown": {
                "ammN_pct": 0.4,
                "organicN_pct": 3.6
            },
            "rates": {
                "greensMin": 250,
                "greensMax": 350,
                "teesMin": 250,
                "teesMax": 350,
                "fairwaysMin": 250,
                "fairwaysMax": 350
            },
            "rateUnit": "kg/ha",
            "interval_weeks": 6,
            "notes": "Organic N dominant mycorrhizal formula. Soil food web focus. Low salt index.",
            "verified": true,
            "productCode": "OAI007250",
            "nForm": "mixed",
            "nFormConfidence": "auto",
            "nFormReason": "nBreakdown: organic + mineral blend"
        },
        {
            "id": "oas-mycogro-10-2-10-mg-fe",
            "name": "MycoGro 10-2-10+3MgO+0.6Fe",
            "brand": "MycoGro",
            "supplier": "oas",
            "form": "granular",
            "release": "mixed",
            "releaseNotes": "Mycorrhizae + beneficial bacteria. Mixed N sources.",
            "sgn": 100,
            "particleSize_mm": "0.5-1.5",
            "surfaces": [
                "greens",
                "tees",
                "bowling",
                "fairways"
            ],
            "season": [
                "spring",
                "summer"
            ],
            "analysis": {
                "N": 10,
                "P": 0.87,
                "K": 8.3,
                "Mg": 1.81,
                "Ca": 0,
                "Fe": 0.6,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "10-2-10+3MgO+0.6Fe",
            "nBreakdown": {
                "ureicN_pct": 2.8,
                "ammN_pct": 5,
                "organicN_pct": 1.5
            },
            "rates": {
                "greensMin": 250,
                "greensMax": 350,
                "teesMin": 250,
                "teesMax": 350,
                "fairwaysMin": 250,
                "fairwaysMax": 350
            },
            "rateUnit": "kg/ha",
            "interval_weeks": 6,
            "notes": "Balanced NK mycorrhizal with Mg + Fe. Spring/summer all-round fine turf.",
            "verified": true,
            "productCode": "OAI007275",
            "nForm": "mixed",
            "nFormConfidence": "auto",
            "nFormReason": "nBreakdown: organic + mineral blend"
        },
        {
            "id": "oas-mycogro-11-2-14-mg-fe",
            "name": "MycoGro 11-2-14+5MgO+1.6Fe",
            "brand": "MycoGro",
            "supplier": "oas",
            "form": "granular",
            "release": "mixed",
            "releaseNotes": "Mycorrhizae + bacteria. 6-8 week longevity from methylene urea.",
            "sgn": 100,
            "particleSize_mm": "0.5-1.5",
            "surfaces": [
                "greens",
                "tees",
                "bowling",
                "fairways"
            ],
            "season": [
                "spring",
                "summer",
                "autumn"
            ],
            "analysis": {
                "N": 11,
                "P": 0.87,
                "K": 11.62,
                "Mg": 3.02,
                "Ca": 0,
                "Fe": 1.6,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "11-2-14+5MgO+1.6Fe",
            "nBreakdown": {
                "ammN_pct": 6.5,
                "ureicN_pct": 2.5,
                "methyleneUreaN_pct": 2
            },
            "rates": {
                "greensMin": 250,
                "greensMax": 350,
                "teesMin": 250,
                "teesMax": 350,
                "fairwaysMin": 250,
                "fairwaysMax": 350
            },
            "rateUnit": "kg/ha",
            "interval_weeks": 7,
            "notes": "Highest Mg in MycoGro range. Extended longevity (6-8 weeks) via methylene urea. Comprehensive micro-granule with mycorrhizae.",
            "verified": true,
            "productCode": "OAI001750",
            "nForm": "urea_mu",
            "nFormConfidence": "auto",
            "nFormReason": "nBreakdown: methylene urea blend"
        },
        {
            "id": "oas-caviar-10-0-4",
            "name": "Caviar 10-0-4",
            "brand": "Caviar",
            "supplier": "oas",
            "form": "granular",
            "release": "organic",
            "releaseNotes": "Organic + ammoniacal N. Biostimulant base. 6 week longevity.",
            "sgn": 100,
            "particleSize_mm": "0.5-1.5",
            "surfaces": [
                "greens",
                "tees",
                "bowling",
                "fairways"
            ],
            "season": [
                "spring",
                "summer",
                "autumn"
            ],
            "analysis": {
                "N": 10,
                "P": 0,
                "K": 3.32,
                "Mg": 0,
                "Ca": 0,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "10-0-4",
            "nBreakdown": {
                "organicN_pct": 5,
                "ammN_pct": 5
            },
            "rates": {
                "greensMin": 250,
                "greensMax": 350,
                "teesMin": 250,
                "teesMax": 350,
                "fairwaysMin": 250,
                "fairwaysMax": 350
            },
            "rateUnit": "kg/ha",
            "interval_weeks": 6,
            "notes": "Premium bio-fertiliser micro-granule. 50% organic N, slow mineralisation supports soil biology. Low salt index. Fine enough for greens.",
            "verified": true,
            "productCode": "OAI007276",
            "nForm": "mixed",
            "nFormConfidence": "auto",
            "nFormReason": "nBreakdown: organic + mineral blend"
        }
    ],
    "liquid": [
        {
            "id": "greenmaster-liquid-advance",
            "name": "Greenmaster Liquid Advance",
            "brand": "Greenmaster Liquid",
            "supplier": "icl",
            "form": "liquid",
            "release": "quick",
            "surfaces": [
                "greens",
                "tees",
                "bowling",
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
                "Mg": 0,
                "Ca": 0,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "Confirm from SDS",
            "rates": {
                "greensMin": 200,
                "greensMax": 50,
                "fairwaysMin": 50,
                "fairwaysMax": 100
            },
            "rateUnit": "L/ha",
            "interval_weeks": 4,
            "notes": "New 2026 ICL launch for stress periods. Full SDS required before GAIP integration.",
            "verified": false,
            "nForm": "no_N",
            "nFormConfidence": "auto",
            "nFormReason": "No nitrogen in analysis"
        },
        {
                    "id": "gm-liquid-spring-summer",
                    "name": "Greenmaster Liquid Spring & Summer",
                    "brand": "Greenmaster Liquid",
                    "supplier": "icl",
                    "form": "liquid",
                    "category": "liquid_fertiliser",
                    "analysis": {
                                "N": 12,
                                "P": 1.75,
                                "K": 4.98
                    },
                    "npk_label": "12-4-6+TE",
                    "release": "quick",
                    "releaseNotes": "ICL TMax liquid technology. w/v 14-5-7 confirmed Pitchcare/ICL.",
                    "surfaces": [
                                "greens",
                                "tees",
                                "fairways",
                                "sports",
                                "bowling"
                    ],
                    "season": [
                                "spring",
                                "summer"
                    ],
                    "rates": {
                                "stdMin": 20,
                                "stdMax": 40
                    },
                    "rateUnit": "L/ha",
                    "waterVolume_Lha": {
                                "min": 300,
                                "max": 600
                    },
                    "interval_weeks": 3,
                    "notes": "High-N spring/summer liquid. Tank-mixable with other GM Liquids (except Ca-Booster). w/v analysis 14-5-7 per Pitchcare/ICL confirmed.",
                    "verified": false,
                    "nForm": "mixed",
                    "nFormConfidence": "review",
                    "nFormReason": "ICL Greenmaster Liquid: likely urea + ammonium blend (TMax); SDS needed for N-form split"
        },
        {
                    "id": "gm-liquid-nk",
                    "name": "Greenmaster Liquid NK",
                    "brand": "Greenmaster Liquid",
                    "supplier": "icl",
                    "form": "liquid",
                    "category": "liquid_fertiliser",
                    "analysis": {
                                "N": 10,
                                "P": 0,
                                "K": 8.3
                    },
                    "npk_label": "10-0-10+TE",
                    "release": "quick",
                    "releaseNotes": "ICL TMax liquid technology. w/v 12-0-12 confirmed Pitchcare/ICL.",
                    "surfaces": [
                                "greens",
                                "tees",
                                "fairways",
                                "sports",
                                "bowling"
                    ],
                    "season": [
                                "spring",
                                "summer",
                                "autumn"
                    ],
                    "rates": {
                                "stdMin": 20,
                                "stdMax": 40
                    },
                    "rateUnit": "L/ha",
                    "waterVolume_Lha": {
                                "min": 300,
                                "max": 600
                    },
                    "interval_weeks": 3,
                    "notes": "Balanced NK liquid. Good autumn hardening partner. w/v analysis 12-0-12 per Pitchcare/ICL confirmed.",
                    "verified": false,
                    "nForm": "mixed",
                    "nFormConfidence": "review",
                    "nFormReason": "ICL Greenmaster Liquid: likely urea + ammonium blend (TMax); SDS needed for N-form split"
        },
        {
                    "id": "gm-liquid-high-n",
                    "name": "Greenmaster Liquid High N",
                    "brand": "Greenmaster Liquid",
                    "supplier": "icl",
                    "form": "liquid",
                    "category": "liquid_fertiliser",
                    "analysis": {
                                "N": 25,
                                "P": 0,
                                "K": 0,
                                "Mg": 1.2
                    },
                    "npk_label": "25-0-0+2MgO+TE",
                    "release": "quick",
                    "releaseNotes": "ICL TMax liquid. Amenity Land/TotalAmenity list 25-0-0; Pitchcare lists 33-0-0 variant. Two formulations may exist.",
                    "surfaces": [
                                "fairways",
                                "sports",
                                "tees"
                    ],
                    "season": [
                                "spring",
                                "summer"
                    ],
                    "rates": {
                                "stdMin": 20,
                                "stdMax": 40
                    },
                    "rateUnit": "L/ha",
                    "waterVolume_Lha": {
                                "min": 300,
                                "max": 600
                    },
                    "interval_weeks": 4,
                    "notes": "High-N liquid for rapid green-up. Two formulations may exist (25-0-0 and 33-0-0), SDS needed to confirm.",
                    "verified": false,
                    "nForm": "mixed",
                    "nFormConfidence": "review",
                    "nFormReason": "ICL Greenmaster Liquid High N: mixed N source per ICL; SDS needed"
        },
        {
                    "id": "gm-liquid-high-k",
                    "name": "Greenmaster Liquid High K",
                    "brand": "Greenmaster Liquid",
                    "supplier": "icl",
                    "form": "liquid",
                    "category": "liquid_fertiliser",
                    "analysis": {
                                "N": 3,
                                "P": 1.31,
                                "K": 8.3
                    },
                    "npk_label": "3-3-10+TE",
                    "release": "quick",
                    "releaseNotes": "ICL TMax liquid. w/v 4-4-12 confirmed Pitchcare.",
                    "surfaces": [
                                "greens",
                                "tees",
                                "fairways",
                                "sports",
                                "bowling"
                    ],
                    "season": [
                                "autumn",
                                "winter"
                    ],
                    "rates": {
                                "stdMin": 20,
                                "stdMax": 40
                    },
                    "rateUnit": "L/ha",
                    "waterVolume_Lha": {
                                "min": 300,
                                "max": 600
                    },
                    "interval_weeks": 3,
                    "notes": "High-K autumn/winter hardening liquid. Low N suits winter applications. w/v analysis 4-4-12 per Pitchcare confirmed.",
                    "verified": false,
                    "nForm": "mixed",
                    "nFormConfidence": "review",
                    "nFormReason": "ICL Greenmaster Liquid: likely urea + ammonium blend (TMax); SDS needed for N-form split"
        },
        {
                    "id": "gm-liquid-ca-booster",
                    "name": "Greenmaster Liquid Ca-Booster",
                    "brand": "Greenmaster Liquid",
                    "supplier": "icl",
                    "form": "liquid",
                    "category": "liquid_fertiliser",
                    "analysis": {
                                "N": 8,
                                "P": 0,
                                "K": 0,
                                "Ca": 10
                    },
                    "npk_label": "8-0-0+10%Ca+TE",
                    "release": "quick",
                    "releaseNotes": "ICL calcium booster. NOT tank-mixable with other GM Liquids.",
                    "surfaces": [
                                "greens",
                                "tees",
                                "bowling"
                    ],
                    "season": [
                                "spring",
                                "summer",
                                "autumn"
                    ],
                    "rates": {
                                "stdMin": 20,
                                "stdMax": 40
                    },
                    "rateUnit": "L/ha",
                    "waterVolume_Lha": {
                                "min": 300,
                                "max": 600
                    },
                    "interval_weeks": 4,
                    "notes": "Calcium booster with N carrier. NOT tank-mixable with other Greenmaster Liquids (confirmed Aitkens). Apply separately.",
                    "verified": false,
                    "nForm": "mixed",
                    "nFormConfidence": "review",
                    "nFormReason": "ICL Ca-Booster: N source not confirmed; SDS needed"
        },
        {
                    "id": "gm-liquid-effect-iron",
                    "name": "Greenmaster Liquid Effect Iron Fe",
                    "brand": "Greenmaster Liquid",
                    "supplier": "icl",
                    "form": "liquid",
                    "category": "liquid_fertiliser",
                    "analysis": {
                                "N": 0,
                                "P": 0,
                                "K": 0,
                                "Fe": 6.9
                    },
                    "npk_label": "0-0-0+6.9Fe",
                    "release": "quick",
                    "releaseNotes": "Iron-only liquid. ICL site lists 7.2% Fe; Agrovista 6.9% Fe, confirm from SDS.",
                    "surfaces": [
                                "greens",
                                "tees",
                                "fairways",
                                "sports",
                                "bowling"
                    ],
                    "season": [
                                "spring",
                                "summer",
                                "autumn",
                                "winter"
                    ],
                    "rates": {
                                "stdMin": 20,
                                "stdMax": 40
                    },
                    "rateUnit": "L/ha",
                    "waterVolume_Lha": {
                                "min": 300,
                                "max": 600
                    },
                    "interval_weeks": 3,
                    "notes": "Iron-only colour enhancer. No nitrogen. ICL site: 7.2% Fe; Agrovista: 6.9% Fe, SDS needed to confirm.",
                    "verified": false,
                    "nForm": "no_N",
                    "nFormConfidence": "auto",
                    "nFormReason": "No nitrogen in analysis, iron-only liquid"
        },
        {
                    "id": "gm-liquid-step",
                    "name": "Greenmaster Liquid STEP",
                    "brand": "Greenmaster Liquid",
                    "supplier": "icl",
                    "form": "liquid",
                    "category": "liquid_fertiliser",
                    "analysis": {
                                "N": 0,
                                "P": 0,
                                "K": 0
                    },
                    "npk_label": "0-0-0+TE",
                    "release": "quick",
                    "releaseNotes": "Chelated trace element package only. No NPK. Agrovista/Pitchcare confirmed.",
                    "surfaces": [
                                "greens",
                                "tees",
                                "bowling"
                    ],
                    "season": [
                                "spring",
                                "summer",
                                "autumn"
                    ],
                    "rates": {
                                "stdMin": 20,
                                "stdMax": 40
                    },
                    "rateUnit": "L/ha",
                    "waterVolume_Lha": {
                                "min": 300,
                                "max": 600
                    },
                    "interval_weeks": 4,
                    "notes": "Trace element package only, no NPK. Chelated TE. Agrovista/Pitchcare confirmed.",
                    "verified": false,
                    "nForm": "no_N",
                    "nFormConfidence": "auto",
                    "nFormReason": "No nitrogen, trace element package only"
        },
        {
            "id": "vitalnova-baseline",
            "name": "Vitalnova Baseline",
            "brand": "Vitalnova",
            "supplier": "icl",
            "form": "liquid",
            "release": "biostimulant",
            "surfaces": [
                "greens",
                "tees",
                "bowling",
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
                "Mg": 0,
                "Ca": 0,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "Biostimulant, see SDS",
            "rates": {
                "greensMin": 200,
                "greensMax": 50
            },
            "rateUnit": "L/ha",
            "interval_weeks": 4,
            "notes": "ICL biostimulant range. Stress recovery and root support. SDS needed for full nutrient panel.",
            "verified": false,
            "nForm": "no_N",
            "nFormConfidence": "auto",
            "nFormReason": "No nitrogen in analysis"
        },
        {
            "id": "regen-quattro",
            "name": "ReGen Quattro",
            "brand": "ReGen Moisture Management",
            "supplier": "regen",
            "form": "liquid",
            "release": "wetting_agent",
            "surfaces": [
                "greens",
                "tees",
                "bowling",
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
                "Mg": 0,
                "Ca": 0,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "Wetting agent, no NPK",
            "rates": {
                "greensMin": 200,
                "greensMax": 30,
                "fairwaysMin": 15,
                "fairwaysMax": 30
            },
            "rateUnit": "L/ha",
            "interval_weeks": 4,
            "notes": "Patented 100% biodegradable liquid wetting agent. 3 modes of action: penetrate, retain moisture, nutrient uptake enhancement. Rate determines mode, low rate = penetration, higher rate = retention. Proven to retain 1-1.5% more VWC vs leading competitor in bentgrass trial (brochure data, not peer-reviewed).",
            "verified": false,
            "nForm": "no_N",
            "nFormConfidence": "auto",
            "nFormReason": "No nitrogen in analysis"
        },
        {
            "id": "regen-double-shot",
            "name": "ReGen Double Shot",
            "brand": "ReGen Moisture Management",
            "supplier": "regen",
            "form": "liquid",
            "release": "wetting_agent",
            "surfaces": [
                "greens",
                "tees",
                "bowling"
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
                "Mg": 0,
                "Ca": 0,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "Wetting agent, no NPK",
            "rates": {
                "greensMin": 15,
                "greensMax": 25
            },
            "rateUnit": "L/ha",
            "interval_weeks": 4,
            "notes": "Wetting agent, no further detail on website. SDS required. Likely a spot-treatment or curative dry patch product given the name.",
            "verified": false,
            "nForm": "no_N",
            "nFormConfidence": "auto",
            "nFormReason": "No nitrogen in analysis"
        },
        {
            "id": "regen-h2o-release",
            "name": "ReGen H2O Release",
            "brand": "ReGen Moisture Management",
            "supplier": "regen",
            "form": "liquid",
            "release": "wetting_agent",
            "surfaces": [
                "greens",
                "tees",
                "bowling",
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
                "Mg": 0,
                "Ca": 0,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "Wetting agent, no NPK",
            "rates": {
                "greensMin": 15,
                "greensMax": 25,
                "fairwaysMin": 20,
                "fairwaysMax": 40
            },
            "rateUnit": "L/ha",
            "interval_weeks": 4,
            "notes": "Penetrant / soil hydration product. SDS required.",
            "verified": false,
            "nForm": "no_N",
            "nFormConfidence": "auto",
            "nFormReason": "No nitrogen in analysis"
        },
        {
            "id": "regen-green-plus",
            "name": "ReGen Green+",
            "brand": "ReGen Biostimulants",
            "supplier": "regen",
            "form": "liquid",
            "release": "biostimulant",
            "surfaces": [
                "greens",
                "tees",
                "bowling",
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
                "Mg": 0,
                "Ca": 0,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "Biostimulant, liquid seaweed extract",
            "rates": {
                "greensMin": 5,
                "greensMax": 10,
                "fairwaysMin": 5,
                "fairwaysMax": 10
            },
            "rateUnit": "L/ha",
            "interval_weeks": 4,
            "notes": "Laminaria digitata cold-extraction. High Mannitol (osmoregulant, drought/salt/cold stress), high Laminarin (carbon energy, soil microbe stimulation, plant defence elicitor). 100% Ecocert certified. Application: 5 L/ha standard, 10 L/ha high stress. Water rate 300-600 L/ha.",
            "verified": true,
            "nForm": "no_N",
            "nFormConfidence": "auto",
            "nFormReason": "No nitrogen in analysis"
        },
        {
            "id": "regen-replenish",
            "name": "ReGen Replenish",
            "brand": "ReGen Biostimulants",
            "supplier": "regen",
            "form": "liquid",
            "release": "biostimulant",
            "surfaces": [
                "greens",
                "tees",
                "bowling",
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
                "Mg": 0,
                "Ca": 0,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "Biostimulant, confirm from SDS",
            "rates": {
                "greensMin": 10,
                "greensMax": 20
            },
            "rateUnit": "L/ha",
            "interval_weeks": 4,
            "notes": "Biostimulant recovery product. Active ingredients and NPK not stated on website. SDS required.",
            "verified": false,
            "nForm": "no_N",
            "nFormConfidence": "auto",
            "nFormReason": "No nitrogen in analysis"
        },
        {
            "id": "regen-restore",
            "name": "ReGen Restore",
            "brand": "ReGen Biostimulants",
            "supplier": "regen",
            "form": "liquid",
            "release": "biostimulant",
            "surfaces": [
                "greens",
                "tees",
                "bowling",
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
                "Mg": 0,
                "Ca": 0,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "Biostimulant, confirm from SDS",
            "rates": {
                "greensMin": 10,
                "greensMax": 20
            },
            "rateUnit": "L/ha",
            "interval_weeks": 4,
            "notes": "Post-stress recovery biostimulant. SDS required.",
            "verified": false,
            "nForm": "no_N",
            "nFormConfidence": "auto",
            "nFormReason": "No nitrogen in analysis"
        },
        {
            "id": "regen-par-plus",
            "name": "ReGen PAR+",
            "brand": "ReGen Biostimulants",
            "supplier": "regen",
            "form": "liquid",
            "release": "biostimulant",
            "surfaces": [
                "greens",
                "tees",
                "bowling"
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
                "Mg": 0,
                "Ca": 0,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "Biostimulant, likely photosynthesis support; confirm from SDS",
            "rates": {
                "greensMin": 10,
                "greensMax": 20
            },
            "rateUnit": "L/ha",
            "interval_weeks": 4,
            "notes": "PAR = Photosynthetically Active Radiation, likely a chlorophyll/photosynthesis support product. GSSH stadium shade hub relevance: potential overlap with LED DLI supplementation advisory. SDS required.",
            "verified": false,
            "nForm": "no_N",
            "nFormConfidence": "auto",
            "nFormReason": "No nitrogen in analysis"
        },
        {
            "id": "regen-amino",
            "name": "ReGen Amino",
            "brand": "ReGen Biostimulants",
            "supplier": "regen",
            "form": "liquid",
            "release": "biostimulant",
            "surfaces": [
                "greens",
                "tees",
                "bowling",
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
                "Mg": 0,
                "Ca": 0,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "Amino acid biostimulant, NPK variable; confirm from SDS",
            "rates": {
                "greensMin": 10,
                "greensMax": 20
            },
            "rateUnit": "L/ha",
            "interval_weeks": 4,
            "notes": "Amino acid-based biostimulant. Protein hydrolysate likely source. N present as organic but not listed as fertiliser N. SDS required.",
            "verified": false,
            "nForm": "no_N",
            "nFormConfidence": "auto",
            "nFormReason": "No nitrogen in analysis"
        },
        {
            "id": "regen-humic-liquid",
            "name": "ReGen Humic (liquid)",
            "brand": "ReGen Biostimulants",
            "supplier": "regen",
            "form": "liquid",
            "release": "biostimulant",
            "surfaces": [
                "all"
            ],
            "season": [
                "spring",
                "autumn"
            ],
            "analysis": {
                "N": 0,
                "P": 0,
                "K": 0,
                "Mg": 0,
                "Ca": 0,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "Humic/fulvic acid, no NPK",
            "rates": {
                "greensMin": 10,
                "greensMax": 20,
                "fairwaysMin": 20,
                "fairwaysMax": 50
            },
            "rateUnit": "L/ha",
            "interval_weeks": 6,
            "notes": "Liquid humic/fulvic acid. CEC enhancement, nutrient chelation, microbial stimulation. Not a fertiliser. SDS required for humate concentration and source.",
            "verified": false,
            "nForm": "no_N",
            "nFormConfidence": "auto",
            "nFormReason": "No nitrogen in analysis"
        },
        {
            "id": "sigma-bio-liquid",
            "name": "Sigma Bio (liquid)",
            "brand": "Sigma Bio",
            "supplier": "regen",
            "form": "liquid",
            "release": "biostimulant",
            "surfaces": [
                "greens",
                "tees",
                "bowling",
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
                "Mg": 0,
                "Ca": 0,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "Organic biostimulant, confirm from SDS",
            "rates": {
                "greensMin": 10,
                "greensMax": 20
            },
            "rateUnit": "L/ha",
            "interval_weeks": 4,
            "notes": "Liquid counterpart to Sigma Bio granular range. Active ingredients not specified on website. SDS required.",
            "verified": false,
            "nForm": "no_N",
            "nFormConfidence": "auto",
            "nFormReason": "No nitrogen in analysis"
        },
        {
            "id": "regen-boost-n",
            "name": "ReGen Boost N 24.0.0",
            "brand": "ReGen Liquid Fertilisers",
            "supplier": "regen",
            "form": "liquid",
            "release": "quick",
            "surfaces": [
                "greens",
                "tees",
                "bowling",
                "fairways"
            ],
            "season": [
                "spring",
                "summer"
            ],
            "analysis": {
                "N": 24,
                "P": 0,
                "K": 0,
                "Mg": 0,
                "Ca": 0,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "24-0-0",
            "rates": {
                "greensMin": 20,
                "greensMax": 50,
                "fairwaysMin": 30,
                "fairwaysMax": 80
            },
            "rateUnit": "L/ha",
            "interval_weeks": 4,
            "notes": "High N liquid. N source (urea/ammonium) not specified. Use for rapid green-up or supplemental N. P and K must come from other sources.",
            "verified": true,
            "nForm": "mixed",
            "nFormConfidence": "review",
            "nFormReason": "Quick-release granular: N source not confirmed from public data; request SDS"
        },
        {
            "id": "regen-strong-k",
            "name": "ReGen Strong K 4.2.18",
            "brand": "ReGen Liquid Fertilisers",
            "supplier": "regen",
            "form": "liquid",
            "release": "quick",
            "surfaces": [
                "greens",
                "tees",
                "bowling",
                "fairways"
            ],
            "season": [
                "autumn",
                "spring",
                "summer"
            ],
            "analysis": {
                "N": 4,
                "P": 0.87,
                "K": 14.94,
                "Mg": 0,
                "Ca": 0,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "4-2-18",
            "rates": {
                "greensMin": 20,
                "greensMax": 50,
                "fairwaysMin": 30,
                "fairwaysMax": 80
            },
            "rateUnit": "L/ha",
            "interval_weeks": 4,
            "notes": "Very high K liquid. Autumn hardening, stress tolerance, disease resistance support. Good complement to high-N programs where K needs boosting.",
            "verified": true,
            "nForm": "mixed",
            "nFormConfidence": "review",
            "nFormReason": "Quick-release granular: N source not confirmed from public data; request SDS"
        },
        {
            "id": "regen-respond",
            "name": "ReGen Respond",
            "brand": "ReGen Liquid Fertilisers",
            "supplier": "regen",
            "form": "liquid",
            "release": "quick",
            "surfaces": [
                "greens",
                "tees",
                "bowling",
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
                "Mg": 0,
                "Ca": 0,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "Confirm from SDS",
            "rates": {
                "greensMin": 20,
                "greensMax": 50
            },
            "rateUnit": "L/ha",
            "interval_weeks": 4,
            "notes": "NPK not stated on website. Name implies stress response, possibly biostimulant + NPK combination. SDS required before GAIP integration.",
            "verified": false,
            "nForm": "no_N",
            "nFormConfidence": "auto",
            "nFormReason": "No nitrogen in analysis"
        },
        {
            "id": "regen-calcium",
            "name": "ReGen Calcium",
            "brand": "ReGen Liquid Fertilisers",
            "supplier": "regen",
            "form": "liquid",
            "release": "quick",
            "surfaces": [
                "greens",
                "tees",
                "bowling",
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
                "Mg": 0,
                "Ca": 0,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "Liquid Ca, confirm % from SDS",
            "rates": {
                "greensMin": 10,
                "greensMax": 30
            },
            "rateUnit": "L/ha",
            "interval_weeks": 4,
            "notes": "Foliar/soil calcium product. Ca source not specified. Useful for cell wall integrity, disease resistance. SDS required for Ca% and formulation.",
            "verified": false,
            "nForm": "no_N",
            "nFormConfidence": "auto",
            "nFormReason": "No nitrogen in analysis"
        },
        {
            "id": "regen-iron",
            "name": "ReGen Iron",
            "brand": "ReGen Colour Lift",
            "supplier": "regen",
            "form": "liquid",
            "release": "quick",
            "surfaces": [
                "greens",
                "tees",
                "bowling",
                "fairways"
            ],
            "season": [
                "autumn",
                "winter",
                "spring"
            ],
            "analysis": {
                "N": 0,
                "P": 0,
                "K": 0,
                "Mg": 0,
                "Ca": 0,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "Liquid Fe, confirm % from SDS",
            "rates": {
                "greensMin": 10,
                "greensMax": 20,
                "fairwaysMin": 15,
                "fairwaysMax": 30
            },
            "rateUnit": "L/ha",
            "interval_weeks": 3,
            "notes": "Liquid iron for colour response. Fe source (sulphate vs chelated) not specified, important for staining risk on hardscapes. SDS required.",
            "verified": false,
            "nForm": "no_N",
            "nFormConfidence": "auto",
            "nFormReason": "No nitrogen in analysis"
        },
        {
            "id": "regen-kite",
            "name": "ReGen Kite",
            "brand": "ReGen Colour Lift",
            "supplier": "regen",
            "form": "liquid",
            "release": "quick",
            "surfaces": [
                "greens",
                "tees",
                "bowling",
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
                "Mg": 0,
                "Ca": 0,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "Colour lift liquid, confirm from SDS",
            "rates": {
                "greensMin": 10,
                "greensMax": 20
            },
            "rateUnit": "L/ha",
            "interval_weeks": 4,
            "notes": "Colour lift product. Active ingredients not specified on website. SDS required.",
            "verified": false,
            "nForm": "no_N",
            "nFormConfidence": "auto",
            "nFormReason": "No nitrogen in analysis"
        },
        {
            "id": "regen-colour",
            "name": "ReGen Colour",
            "brand": "ReGen Colour Lift",
            "supplier": "regen",
            "form": "liquid",
            "release": "quick",
            "surfaces": [
                "greens",
                "tees",
                "bowling",
                "fairways"
            ],
            "season": [
                "autumn",
                "winter",
                "spring"
            ],
            "analysis": {
                "N": 0,
                "P": 0,
                "K": 0,
                "Mg": 0,
                "Ca": 0,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "Colour lift liquid, confirm from SDS",
            "rates": {
                "greensMin": 10,
                "greensMax": 20,
                "fairwaysMin": 15,
                "fairwaysMax": 30
            },
            "rateUnit": "L/ha",
            "interval_weeks": 4,
            "notes": "Generic colour response liquid. Likely Fe-based but may include Mn. SDS required.",
            "verified": false,
            "nForm": "no_N",
            "nFormConfidence": "auto",
            "nFormReason": "No nitrogen in analysis"
        },
        {
            "id": "regen-jade",
            "name": "ReGen Jade",
            "brand": "ReGen Colour Lift",
            "supplier": "regen",
            "form": "liquid",
            "release": "quick",
            "surfaces": [
                "greens",
                "tees",
                "bowling"
            ],
            "season": [
                "autumn",
                "winter",
                "spring"
            ],
            "analysis": {
                "N": 0,
                "P": 0,
                "K": 0,
                "Mg": 0,
                "Ca": 0,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "Colour lift liquid, confirm from SDS",
            "rates": {
                "greensMin": 10,
                "greensMax": 20
            },
            "rateUnit": "L/ha",
            "interval_weeks": 4,
            "notes": "Fine turf colour product. \"Jade\" implies dark green response, likely Fe + Mn combination. SDS required.",
            "verified": false,
            "nForm": "no_N",
            "nFormConfidence": "auto",
            "nFormReason": "No nitrogen in analysis"
        },
        {
            "id": "oas-protec-28-0-0",
            "name": "Protec 28-0-0",
            "brand": "Protec",
            "supplier": "oas",
            "form": "liquid",
            "release": "mixed",
            "releaseNotes": "Methylene urea + conventional urea. Low salt index. Reduced scorch risk.",
            "surfaces": [
                "greens",
                "tees",
                "bowling",
                "fairways"
            ],
            "season": [
                "spring",
                "summer",
                "autumn"
            ],
            "analysis": {
                "N": 28,
                "P": 0,
                "K": 0,
                "Mg": 0,
                "Ca": 0,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "28-0-0",
            "nBreakdown": {
                "ureicN_pct": 11.5,
                "methyleneUreaN_pct": 16.5
            },
            "rates": {
                "greensMin": 10,
                "greensMax": 60,
                "fairwaysMin": 10,
                "fairwaysMax": 60
            },
            "rateUnit": "L/ha",
            "interval_weeks": 4,
            "notes": "High N slow-release liquid. Methylene urea reduces flush growth risk. Very low salt index, suitable in hot conditions. Water volume 300-450 L/ha.",
            "verified": true,
            "productCode": "OAI005441",
            "nForm": "urea_mu",
            "nFormConfidence": "auto",
            "nFormReason": "nBreakdown: methylene urea blend"
        },
        {
            "id": "oas-protec-15-0-12",
            "name": "Protec 15-0-12",
            "brand": "Protec",
            "supplier": "oas",
            "form": "liquid",
            "release": "mixed",
            "surfaces": [
                "greens",
                "tees",
                "bowling",
                "fairways"
            ],
            "season": [
                "spring",
                "summer",
                "autumn"
            ],
            "analysis": {
                "N": 15,
                "P": 0,
                "K": 9.96,
                "Mg": 0,
                "Ca": 0,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "15-0-12",
            "nBreakdown": {
                "ureicN_pct": 8.3,
                "methyleneUreaN_pct": 6.7
            },
            "rates": {
                "greensMin": 10,
                "greensMax": 60,
                "fairwaysMin": 10,
                "fairwaysMax": 60
            },
            "rateUnit": "L/ha",
            "interval_weeks": 4,
            "notes": "NK liquid with methylene urea slow-release N. Balanced for spring to autumn use.",
            "verified": true,
            "productCode": "OAI005446",
            "nForm": "urea_mu",
            "nFormConfidence": "auto",
            "nFormReason": "nBreakdown: methylene urea blend"
        },
        {
            "id": "oas-protec-16-4-8",
            "name": "Protec 16-4-8",
            "brand": "Protec",
            "supplier": "oas",
            "form": "liquid",
            "release": "mixed",
            "surfaces": [
                "greens",
                "tees",
                "bowling",
                "fairways"
            ],
            "season": [
                "spring",
                "summer"
            ],
            "analysis": {
                "N": 16,
                "P": 1.74,
                "K": 6.64,
                "Mg": 0,
                "Ca": 0,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "16-4-8",
            "nBreakdown": {
                "ureicN_pct": 11.5,
                "ammN_pct": 0.2,
                "methyleneUreaN_pct": 4.3
            },
            "rates": {
                "greensMin": 10,
                "greensMax": 60,
                "fairwaysMin": 10,
                "fairwaysMax": 60
            },
            "rateUnit": "L/ha",
            "interval_weeks": 4,
            "notes": "Full NPK liquid with methylene urea N component. Spring/summer all-round.",
            "verified": true,
            "productCode": "OAI005457",
            "nForm": "urea_mu",
            "nFormConfidence": "auto",
            "nFormReason": "nBreakdown: methylene urea blend"
        },
        {
            "id": "oas-protec-10-0-10",
            "name": "Protec 10-0-10",
            "brand": "Protec",
            "supplier": "oas",
            "form": "liquid",
            "release": "quick",
            "surfaces": [
                "greens",
                "tees",
                "bowling",
                "fairways"
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
                "Mg": 0,
                "Ca": 0,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "10-0-10",
            "nBreakdown": {
                "ureicN_pct": 8.9,
                "nitrateN_pct": 1.1
            },
            "rates": {
                "greensMin": 10,
                "greensMax": 100,
                "fairwaysMin": 10,
                "fairwaysMax": 100
            },
            "rateUnit": "L/ha",
            "interval_weeks": 4,
            "notes": "Flexible rate NK liquid. 3-4 week longevity. Urea + nitrate N for rapid cool-temp response.",
            "verified": true,
            "productCode": "OAI005454",
            "nForm": "mixed",
            "nFormConfidence": "auto",
            "nFormReason": "nBreakdown present, mixed sources"
        },
        {
            "id": "oas-protec-6-0-12",
            "name": "Protec 6-0-12",
            "brand": "Protec",
            "supplier": "oas",
            "form": "liquid",
            "release": "quick",
            "surfaces": [
                "greens",
                "tees",
                "bowling",
                "fairways"
            ],
            "season": [
                "autumn",
                "spring"
            ],
            "analysis": {
                "N": 6,
                "P": 0,
                "K": 9.96,
                "Mg": 0,
                "Ca": 0,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "6-0-12",
            "nBreakdown": {
                "ureicN_pct": 3,
                "ammN_pct": 1.5,
                "nitrateN_pct": 1.5
            },
            "rates": {
                "greensMin": 10,
                "greensMax": 100,
                "fairwaysMin": 10,
                "fairwaysMax": 100
            },
            "rateUnit": "L/ha",
            "interval_weeks": 4,
            "notes": "Low N high K liquid hardening formula. Three N sources, good cool-temp response.",
            "verified": true,
            "productCode": "OAI005461",
            "nForm": "mixed",
            "nFormConfidence": "auto",
            "nFormReason": "nBreakdown present, mixed sources"
        },
        {
            "id": "oas-protec-0-0-25",
            "name": "Protec 0-0-25",
            "brand": "Protec",
            "supplier": "oas",
            "form": "liquid",
            "release": "quick",
            "surfaces": [
                "greens",
                "tees",
                "bowling",
                "fairways"
            ],
            "season": [
                "autumn",
                "winter",
                "spring"
            ],
            "analysis": {
                "N": 0,
                "P": 0,
                "K": 20.75,
                "Mg": 0,
                "Ca": 0,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "0-0-25",
            "rates": {
                "greensMin": 10,
                "greensMax": 100,
                "fairwaysMin": 10,
                "fairwaysMax": 100
            },
            "rateUnit": "L/ha",
            "interval_weeks": 4,
            "notes": "K-only liquid. Autumn/winter hardening without any N stimulus. Stress tolerance and disease resistance support.",
            "verified": true,
            "productCode": "OAI005448",
            "nForm": "no_N",
            "nFormConfidence": "auto",
            "nFormReason": "Protec 0-0-25: potassium only, no nitrogen"
        },
        {
            "id": "oas-microflow-26-0-0-te",
            "name": "Microflow 26-0-0+TE",
            "brand": "Microflow",
            "supplier": "oas",
            "form": "liquid",
            "release": "mixed",
            "releaseNotes": "Urea + nitrate + methylene urea. Surfactant for leaf/root uptake. Plant sugars + humates + TE.",
            "surfaces": [
                "greens",
                "tees",
                "bowling",
                "fairways"
            ],
            "season": [
                "spring",
                "summer"
            ],
            "analysis": {
                "N": 26,
                "P": 0,
                "K": 0,
                "Mg": 0,
                "Ca": 0,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "26-0-0+TE",
            "nBreakdown": {
                "ureicN_pct": 18.1,
                "nitrateN_pct": 9,
                "methyleneUreaN_pct": 0.9
            },
            "rates": {
                "greensMin": 20,
                "greensMax": 120,
                "fairwaysMin": 20,
                "fairwaysMax": 120
            },
            "rateUnit": "L/ha",
            "interval_weeks": 4,
            "notes": "Premium slow-release liquid. Specialist surfactant improves leaf and root uptake. Plant sugars + humates + trace elements. Water volume 400-800 L/ha.",
            "verified": true,
            "productCode": "OAI000279",
            "nForm": "urea_mu",
            "nFormConfidence": "auto",
            "nFormReason": "nBreakdown: methylene urea blend"
        },
        {
            "id": "oas-microflow-17-2-5-te",
            "name": "Microflow 17-2-5+TE",
            "brand": "Microflow",
            "supplier": "oas",
            "form": "liquid",
            "release": "mixed",
            "surfaces": [
                "greens",
                "tees",
                "bowling",
                "fairways"
            ],
            "season": [
                "spring",
                "summer"
            ],
            "analysis": {
                "N": 17,
                "P": 0.87,
                "K": 4.15,
                "Mg": 0,
                "Ca": 0,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "17-2-5+TE",
            "nBreakdown": {
                "ammN_pct": 0.6,
                "ureicN_pct": 15.5,
                "methyleneUreaN_pct": 0.9
            },
            "rates": {
                "greensMin": 20,
                "greensMax": 120,
                "fairwaysMin": 20,
                "fairwaysMax": 120
            },
            "rateUnit": "L/ha",
            "interval_weeks": 4,
            "notes": "Spring/summer NPK Microflow. Trace elements included.",
            "verified": true,
            "productCode": "OAI000282",
            "nForm": "urea_mu",
            "nFormConfidence": "auto",
            "nFormReason": "nBreakdown: methylene urea blend"
        },
        {
            "id": "oas-microflow-4-3-16-fe-te",
            "name": "Microflow 4-3-16+Fe+TE",
            "brand": "Microflow",
            "supplier": "oas",
            "form": "liquid",
            "release": "quick",
            "surfaces": [
                "greens",
                "tees",
                "bowling",
                "fairways"
            ],
            "season": [
                "autumn",
                "spring"
            ],
            "analysis": {
                "N": 4,
                "P": 1.31,
                "K": 13.28,
                "Mg": 0,
                "Ca": 0,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "4-3-16+Fe+TE",
            "nBreakdown": {
                "ammN_pct": 0.8,
                "ureicN_pct": 3.3,
                "nitrateN_pct": 0.7
            },
            "rates": {
                "greensMin": 20,
                "greensMax": 120,
                "fairwaysMin": 20,
                "fairwaysMax": 120
            },
            "rateUnit": "L/ha",
            "interval_weeks": 4,
            "notes": "High K liquid hardening formula. Low N. Fe and trace elements included. Fe% not stated in brochure, request SDS.",
            "verified": false,
            "productCode": "OAI000115",
            "nForm": "mixed",
            "nFormConfidence": "auto",
            "nFormReason": "nBreakdown present, mixed sources"
        },
        {
            "id": "oas-ecofeed-25-0-0-te",
            "name": "Ecofeed 25-0-0+TE",
            "brand": "Ecofeed",
            "supplier": "oas",
            "form": "liquid",
            "release": "quick",
            "surfaces": [
                "greens",
                "tees",
                "bowling",
                "fairways"
            ],
            "season": [
                "spring",
                "summer"
            ],
            "analysis": {
                "N": 25,
                "P": 0,
                "K": 0,
                "Mg": 0,
                "Ca": 0,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "25-0-0+TE",
            "nBreakdown": {
                "ammN_pct": 6.3,
                "ureicN_pct": 12.5,
                "nitrateN_pct": 6.2
            },
            "rates": {
                "greensMin": 20,
                "greensMax": 100,
                "fairwaysMin": 20,
                "fairwaysMax": 100
            },
            "rateUnit": "L/ha",
            "interval_weeks": 4,
            "notes": "Cost-effective high N liquid. Available 200L and 800L drums. Humic acid + TE included. Three N sources for flexible uptake timing.",
            "verified": true,
            "productCode": "OAI000312",
            "nForm": "mixed",
            "nFormConfidence": "auto",
            "nFormReason": "nBreakdown present, mixed sources"
        },
        {
            "id": "oas-ecofeed-10-0-10-te",
            "name": "Ecofeed 10-0-10+TE",
            "brand": "Ecofeed",
            "supplier": "oas",
            "form": "liquid",
            "release": "quick",
            "surfaces": [
                "greens",
                "tees",
                "bowling",
                "fairways"
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
                "Mg": 0,
                "Ca": 0,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "10-0-10+TE",
            "nBreakdown": {
                "ureicN_pct": 10
            },
            "rates": {
                "greensMin": 20,
                "greensMax": 100,
                "fairwaysMin": 20,
                "fairwaysMax": 100
            },
            "rateUnit": "L/ha",
            "interval_weeks": 4,
            "notes": "Cost-effective balanced NK liquid. Urea N, warm conditions preferred. Drum size for large areas.",
            "verified": true,
            "productCode": "OAI000311",
            "nForm": "urea",
            "nFormConfidence": "auto",
            "nFormReason": "nBreakdown: urea only"
        },
        {
            "id": "oas-nutrilink-base-12-0-0-fe-ca-seaweed",
            "name": "Nutri-Link Base 12-0-0+1Fe+6CaO+Seaweed",
            "brand": "Nutri-Link",
            "supplier": "oas",
            "form": "liquid",
            "release": "quick",
            "surfaces": [
                "greens",
                "tees",
                "bowling",
                "fairways"
            ],
            "season": [
                "spring",
                "summer",
                "autumn"
            ],
            "analysis": {
                "N": 12,
                "P": 0,
                "K": 0,
                "Mg": 0,
                "Ca": 4.29,
                "Fe": 1,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "12-0-0+1Fe+6CaO+Seaweed",
            "nBreakdown": {
                "ammN_pct": 1,
                "ureicN_pct": 8,
                "nitrateN_pct": 3
            },
            "rates": {
                "greensMin": 20,
                "greensMax": 40,
                "fairwaysMin": 20,
                "fairwaysMax": 40
            },
            "rateUnit": "L/ha",
            "interval_weeks": 4,
            "notes": "Liquid N + Ca + Fe with seaweed biostimulant. Good spring starter or summer stress support. Seaweed enhances plant health and stress tolerance.",
            "verified": true,
            "productCode": "OAI000220",
            "nForm": "mixed",
            "nFormConfidence": "auto",
            "nFormReason": "nBreakdown present, mixed sources"
        },
        {
            "id": "oas-nutrilink-revive-3-0-0-fe-seaweed-amino",
            "name": "Nutri-Link Revive 3-0-0+2Fe+22%Seaweed+Amino-Acids",
            "brand": "Nutri-Link",
            "supplier": "oas",
            "form": "liquid",
            "release": "biostimulant",
            "surfaces": [
                "greens",
                "tees",
                "bowling",
                "fairways"
            ],
            "season": [
                "spring",
                "summer",
                "autumn"
            ],
            "analysis": {
                "N": 3,
                "P": 0,
                "K": 0,
                "Mg": 0,
                "Ca": 0,
                "Fe": 2,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "3-0-0+2Fe+22%Seaweed+Amino-Acids",
            "rates": {
                "greensMin": 20,
                "greensMax": 40,
                "fairwaysMin": 20,
                "fairwaysMax": 40
            },
            "rateUnit": "L/ha",
            "interval_weeks": 4,
            "notes": "High seaweed content (22%) + amino acids. Recovery and stress support product. Minimal N. Fe for colour.",
            "verified": true,
            "productCode": "OAI000229",
            "nForm": "mixed",
            "nFormConfidence": "auto",
            "nFormReason": "Nutri-Link: ammoniacal + ureic + nitrate blend (from OAS brochure)"
        },
        {
            "id": "oas-rapid-response-12-0-0-mg-ca",
            "name": "Rapid Response 12-0-0+7MgO+1CaO",
            "brand": "Rapid Response",
            "supplier": "oas",
            "form": "liquid",
            "release": "quick",
            "surfaces": [
                "greens",
                "tees",
                "bowling",
                "fairways"
            ],
            "season": [
                "spring",
                "summer",
                "autumn"
            ],
            "analysis": {
                "N": 12,
                "P": 0,
                "K": 0,
                "Mg": 4.22,
                "Ca": 0.71,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "12-0-0+7MgO+1CaO",
            "nBreakdown": {
                "ammN_pct": 3.3,
                "nitrateN_pct": 8.7
            },
            "rates": {
                "greensMin": 20,
                "greensMax": 30,
                "fairwaysMin": 20,
                "fairwaysMax": 30
            },
            "rateUnit": "L/ha",
            "interval_weeks": 4,
            "notes": "Ammoniacal + nitrate N for rapid cool-temp response. Very high Mg for chlorophyll and photosynthesis. Low pH formulation, does not encourage disease. Green colour enhancement.",
            "verified": true,
            "productCode": "OAI000287",
            "nForm": "mixed",
            "nFormConfidence": "auto",
            "nFormReason": "nBreakdown: ammonium + nitrate (CAN-type)"
        },
        {
            "id": "oas-optisol-14-5-28-mg",
            "name": "Optisol 14-5-28+MgO",
            "brand": "Optisol",
            "supplier": "oas",
            "form": "soluble",
            "release": "quick",
            "surfaces": [
                "greens",
                "tees",
                "bowling",
                "fairways"
            ],
            "season": [
                "autumn",
                "spring"
            ],
            "analysis": {
                "N": 14,
                "P": 2.18,
                "K": 23.25,
                "Mg": 0,
                "Ca": 0,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "14-5-28+MgO",
            "nBreakdown": {
                "ureicN_pct": 4,
                "ammN_pct": 4.8,
                "nitrateN_pct": 5.2
            },
            "rates": {
                "greensMin": 20,
                "greensMax": 60,
                "fairwaysMin": 20,
                "fairwaysMax": 60
            },
            "rateUnit": "kg/ha",
            "interval_weeks": 3,
            "notes": "Very high K water soluble. Autumn hardening. Three N sources for broad temperature coverage. Water volume 300-600 L/ha. MgO% not stated, request SDS.",
            "verified": false,
            "productCode": "OAI006387",
            "nForm": "mixed",
            "nFormConfidence": "auto",
            "nFormReason": "nBreakdown present, mixed sources"
        },
        {
            "id": "oas-optisol-28-7-14-mg",
            "name": "Optisol 28-7-14+MgO",
            "brand": "Optisol",
            "supplier": "oas",
            "form": "soluble",
            "release": "quick",
            "surfaces": [
                "greens",
                "tees",
                "bowling",
                "fairways"
            ],
            "season": [
                "spring",
                "summer"
            ],
            "analysis": {
                "N": 28,
                "P": 3.05,
                "K": 11.62,
                "Mg": 0,
                "Ca": 0,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "28-7-14+MgO",
            "nBreakdown": {
                "ureicN_pct": 22.4,
                "ammN_pct": 1.6,
                "nitrateN_pct": 4.2
            },
            "rates": {
                "greensMin": 20,
                "greensMax": 60,
                "fairwaysMin": 20,
                "fairwaysMax": 60
            },
            "rateUnit": "kg/ha",
            "interval_weeks": 3,
            "notes": "High N water soluble. Spring/summer growth. Urea-dominant for warm-condition uptake.",
            "verified": false,
            "productCode": "OAI006392",
            "nForm": "mixed",
            "nFormConfidence": "auto",
            "nFormReason": "nBreakdown present, mixed sources"
        },
        {
            "id": "oas-optisol-13-40-13-mg",
            "name": "Optisol 13-40-13+MgO",
            "brand": "Optisol",
            "supplier": "oas",
            "form": "soluble",
            "release": "quick",
            "surfaces": [
                "greens",
                "tees",
                "bowling",
                "fairways"
            ],
            "season": [
                "spring",
                "autumn"
            ],
            "analysis": {
                "N": 13,
                "P": 17.46,
                "K": 10.79,
                "Mg": 0,
                "Ca": 0,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "13-40-13+MgO",
            "nBreakdown": {
                "ureicN_pct": 1.4,
                "ammN_pct": 7.4,
                "nitrateN_pct": 3.7
            },
            "rates": {
                "greensMin": 20,
                "greensMax": 60,
                "fairwaysMin": 20,
                "fairwaysMax": 60
            },
            "rateUnit": "kg/ha",
            "interval_weeks": 3,
            "notes": "Very high P soluble. Root development and establishment. Pre-seeding or post-renovation.",
            "verified": true,
            "productCode": "OAI006388",
            "nForm": "mixed",
            "nFormConfidence": "auto",
            "nFormReason": "nBreakdown present, mixed sources"
        },
        {
            "id": "oas-optisol-15-0-35-mg",
            "name": "Optisol 15-0-35+MgO",
            "brand": "Optisol",
            "supplier": "oas",
            "form": "soluble",
            "release": "quick",
            "surfaces": [
                "greens",
                "tees",
                "bowling",
                "fairways"
            ],
            "season": [
                "autumn",
                "winter"
            ],
            "analysis": {
                "N": 15,
                "P": 0,
                "K": 29.06,
                "Mg": 0,
                "Ca": 0,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "15-0-35+MgO",
            "nBreakdown": {
                "ureicN_pct": 3.7,
                "ammN_pct": 7.4,
                "nitrateN_pct": 4.3
            },
            "rates": {
                "greensMin": 20,
                "greensMax": 60,
                "fairwaysMin": 20,
                "fairwaysMax": 60
            },
            "rateUnit": "kg/ha",
            "interval_weeks": 3,
            "notes": "Highest K in Optisol range. Autumn/winter hardening soluble. Rapid K loading for stress tolerance.",
            "verified": true,
            "productCode": "OAI006389",
            "nForm": "mixed",
            "nFormConfidence": "auto",
            "nFormReason": "nBreakdown present, mixed sources"
        },
        {
            "id": "oas-optisol-13-0-45",
            "name": "Optisol 13-0-45",
            "brand": "Optisol",
            "supplier": "oas",
            "form": "soluble",
            "release": "quick",
            "surfaces": [
                "greens",
                "tees",
                "bowling",
                "fairways"
            ],
            "season": [
                "autumn",
                "winter"
            ],
            "analysis": {
                "N": 13,
                "P": 0,
                "K": 37.36,
                "Mg": 0,
                "Ca": 0,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "13-0-45",
            "nBreakdown": {
                "nitrateN_pct": 13
            },
            "rates": {
                "greensMin": 20,
                "greensMax": 60,
                "fairwaysMin": 20,
                "fairwaysMax": 60
            },
            "rateUnit": "kg/ha",
            "interval_weeks": 3,
            "notes": "Extremely high K soluble. Nitrate N only, fast cool-temp uptake. Maximum autumn/winter K hardening.",
            "verified": true,
            "productCode": "OAI006390",
            "nForm": "nitrate",
            "nFormConfidence": "auto",
            "nFormReason": "Optisol 13-0-45: 100% nitrate-N (confirmed OAS brochure N breakdown)"
        },
        {
            "id": "oas-xtend-soluble-46-0-0",
            "name": "Xtend Soluble 46-0-0",
            "brand": "Xtend",
            "supplier": "oas",
            "form": "soluble",
            "release": "stabilised",
            "releaseNotes": "NBPT volatilisation inhibitor. 8-12 week longevity.",
            "surfaces": [
                "greens",
                "tees",
                "bowling",
                "fairways"
            ],
            "season": [
                "spring",
                "summer"
            ],
            "analysis": {
                "N": 46,
                "P": 0,
                "K": 0,
                "Mg": 0,
                "Ca": 0,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "46-0-0",
            "nBreakdown": {
                "ureicN_pct": 46
            },
            "rates": {
                "greensMin": 30,
                "greensMax": 30,
                "fairwaysMin": 30,
                "fairwaysMax": 30
            },
            "rateUnit": "kg/ha",
            "interval_weeks": 10,
            "notes": "Soluble urea + NBPT inhibitor. Longest longevity in liquid range (8-12 weeks). Single rate 30 kg/ha. Very cost-effective N source.",
            "verified": true,
            "productCode": "OAI006311",
            "nForm": "urea",
            "nFormConfidence": "auto",
            "nFormReason": "nBreakdown: urea only"
        },
        {
            "id": "sol-kno3-uk",
            "name": "Potassium Nitrate (KNO3) Technical Soluble",
            "brand": "Potassium Nitrate",
            "supplier": "various",
            "form": "soluble",
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
                "N": 13.85,
                "P": 0,
                "K": 38.67,
                "Mg": 0,
                "Ca": 0,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "14-0-46 (as K2O)",
            "nBreakdown": {
                "nitrateN_pct": 13.85
            },
            "rates": {
                "greensMin": 20,
                "greensMax": 30,
                "teesMin": 20,
                "teesMax": 50,
                "fairwaysMin": 30,
                "fairwaysMax": 80
            },
            "rateUnit": "kg/ha",
            "interval_weeks": 3,
            "notes": "Technical-grade soluble KNO3. Chloride-free K source with nitrate-N. Solubility ~316 g/L at 20C, ~210 g/L at 5C, tank check after cold storage. Foliar at <600 L/ha water; soil-applied at >600 L/ha. Counts toward total N applied.",
            "verified": true,
            "nForm": "nitrate",
            "nFormConfidence": "auto",
            "nFormReason": "Potassium nitrate (KNO3): 100% nitrate-N. Negligible volatilisation risk. Preferred N form for seashore paspalum (Duncan & Carrow 2000)."
        },
        {
            "id": "sol-k2so4-uk",
            "name": "Potassium Sulphate (K2SO4) Technical Soluble",
            "brand": "Potassium Sulphate",
            "supplier": "various",
            "form": "soluble",
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
                "spring",
                "summer"
            ],
            "analysis": {
                "N": 0,
                "P": 0,
                "K": 41.5,
                "Mg": 0,
                "Ca": 0,
                "Fe": 0,
                "Mn": 0,
                "S": 18
            },
            "npk_label": "0-0-50 (as K2O) +18S",
            "rates": {
                "greensMin": 15,
                "greensMax": 25,
                "teesMin": 15,
                "teesMax": 40,
                "fairwaysMin": 25,
                "fairwaysMax": 60
            },
            "rateUnit": "kg/ha",
            "interval_weeks": 3,
            "notes": "Technical-grade soluble K2SO4. Pure K + S, no N. Chloride-free. Lower solubility than KNO3 (~110 g/L at 20C, ~85 g/L at 5C), tank check after cold storage. Useful for tissue-K correction without adding N, and on chloride-sensitive turf (couch greens, paspalum, fine fescues). 41.5% K elemental = 50% K2O x 0.8302; 18% S textbook value (Havlin et al., Soil Fertility and Fertilizers, 8th ed., Ch.10).",
            "verified": true,
            "nForm": "none",
            "nFormConfidence": "auto",
            "nFormReason": "No nitrogen in analysis"
        },
        {
            "id": "oas-biobooster-fish-hydrolysate-8-7-7",
            "name": "BioBooster Fish Hydrolysate 8-7-7",
            "brand": "BioBooster",
            "supplier": "oas",
            "form": "liquid",
            "release": "organic",
            "releaseNotes": "Odour-free fish hydrolysate. Organic N base.",
            "surfaces": [
                "greens",
                "tees",
                "bowling",
                "fairways"
            ],
            "season": [
                "spring",
                "summer",
                "autumn"
            ],
            "analysis": {
                "N": 8,
                "P": 3.05,
                "K": 5.81,
                "Mg": 0,
                "Ca": 0,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "8-7-7",
            "nBreakdown": {
                "organicN_pct": 8
            },
            "rates": {
                "greensMin": 10,
                "greensMax": 50,
                "fairwaysMin": 10,
                "fairwaysMax": 50
            },
            "rateUnit": "L/ha",
            "interval_weeks": 4,
            "notes": "Odour-free fish hydrolysate. Full NPK from organic sources. Stimulates plant and soil microbes. Low salt index, suitable in stress conditions.",
            "verified": true,
            "productCode": "OAI007208",
            "nForm": "organic",
            "nFormConfidence": "auto",
            "nFormReason": "nBreakdown: organic N dominant"
        },
        {
            "id": "oas-cms-shoot-8-0-0",
            "name": "CMS Shoot 8-0-0",
            "brand": "CMS Shoot",
            "supplier": "oas",
            "form": "liquid",
            "release": "organic",
            "releaseNotes": "Molasses fermentation product. Amino acids + carbohydrates.",
            "surfaces": [
                "greens",
                "tees",
                "bowling",
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
                "Mg": 0,
                "Ca": 0,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "8-0-0",
            "nBreakdown": {
                "ammN_pct": 4.2,
                "organicN_pct": 3.8
            },
            "rates": {
                "greensMin": 30,
                "greensMax": 50,
                "fairwaysMin": 30,
                "fairwaysMax": 50
            },
            "rateUnit": "L/ha",
            "interval_weeks": 4,
            "notes": "Molasses fermentation. Rapidly available carbohydrates and amino acids. Stimulates soil biology and early season root + shoot growth. Available in 20L, 200L, 750L and 1000L.",
            "verified": true,
            "productCode": "OAI007277",
            "nForm": "mixed",
            "nFormConfidence": "auto",
            "nFormReason": "nBreakdown: organic + mineral blend"
        },
        {
            "id": "oas-microflow-14-0-7-te",
            "name": "Microflow 14-0-7+TE",
            "brand": "Microflow",
            "supplier": "oas",
            "form": "liquid",
            "release": "mixed",
            "releaseNotes": "Urea + methylene urea. Specialist surfactant. Plant sugars + humates + TE.",
            "surfaces": [
                "greens",
                "tees",
                "bowling",
                "fairways"
            ],
            "season": [
                "spring",
                "summer"
            ],
            "analysis": {
                "N": 14,
                "P": 0,
                "K": 5.81,
                "Mg": 0,
                "Ca": 0,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "14-0-7+TE",
            "nBreakdown": {
                "ureicN_pct": 13.3,
                "methyleneUreaN_pct": 0.7
            },
            "rates": {
                "greensMin": 20,
                "greensMax": 120,
                "fairwaysMin": 20,
                "fairwaysMax": 120
            },
            "rateUnit": "L/ha",
            "interval_weeks": 5,
            "notes": "NK Microflow. Methylene urea component extends longevity (4-6 weeks). Trace elements + humates.",
            "verified": true,
            "productCode": "OAI000119",
            "nForm": "urea_mu",
            "nFormConfidence": "auto",
            "nFormReason": "nBreakdown: methylene urea blend"
        },
        {
            "id": "oas-nutrilink-leaf-10-2-7-te",
            "name": "Nutri-Link Leaf 10-2-7+TE",
            "brand": "Nutri-Link",
            "supplier": "oas",
            "form": "liquid",
            "release": "quick",
            "surfaces": [
                "greens",
                "tees",
                "bowling",
                "fairways"
            ],
            "season": [
                "spring",
                "summer",
                "autumn"
            ],
            "analysis": {
                "N": 10,
                "P": 0.87,
                "K": 5.81,
                "Mg": 0,
                "Ca": 0,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "10-2-7+TE",
            "nBreakdown": {
                "ureicN_pct": 10
            },
            "rates": {
                "greensMin": 20,
                "greensMax": 40,
                "fairwaysMin": 20,
                "fairwaysMax": 40
            },
            "rateUnit": "L/ha",
            "interval_weeks": 4,
            "notes": "Foliar NPK + trace elements. Urea N for leaf uptake. 3-4 week longevity. Synergistic with granular base programs.",
            "verified": true,
            "productCode": "OAI000223",
            "nForm": "urea",
            "nFormConfidence": "auto",
            "nFormReason": "nBreakdown: urea only"
        },
        {
            "id": "oas-nutrilink-green-5-0-0-fe-carbs",
            "name": "Nutri-Link Green 5-0-0+5Fe+Carbohydrates",
            "brand": "Nutri-Link",
            "supplier": "oas",
            "form": "liquid",
            "release": "quick",
            "surfaces": [
                "greens",
                "tees",
                "bowling",
                "fairways"
            ],
            "season": [
                "autumn",
                "winter",
                "spring"
            ],
            "analysis": {
                "N": 5,
                "P": 0,
                "K": 0,
                "Mg": 0,
                "Ca": 0,
                "Fe": 5,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "5-0-0+5Fe+Carbohydrates",
            "nBreakdown": {
                "nitrateN_pct": 5
            },
            "rates": {
                "greensMin": 20,
                "greensMax": 40,
                "fairwaysMin": 20,
                "fairwaysMax": 40
            },
            "rateUnit": "L/ha",
            "interval_weeks": 4,
            "notes": "Nitrate N + Fe + carbohydrates. Colour response + soil biology energy. Low-rate colour lift. Autumn/winter fine turf.",
            "verified": true,
            "productCode": "OAI000232",
            "nForm": "nitrate",
            "nFormConfidence": "auto",
            "nFormReason": "nBreakdown: nitrate only"
        },
        {
            "id": "oas-ecofeed-12-4-6-te",
            "name": "Ecofeed 12-4-6+TE",
            "brand": "Ecofeed",
            "supplier": "oas",
            "form": "liquid",
            "release": "quick",
            "surfaces": [
                "greens",
                "tees",
                "bowling",
                "fairways"
            ],
            "season": [
                "spring",
                "summer",
                "autumn"
            ],
            "analysis": {
                "N": 12,
                "P": 1.74,
                "K": 4.98,
                "Mg": 0,
                "Ca": 0,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "12-4-6+TE",
            "nBreakdown": {
                "ammN_pct": 1.3,
                "ureicN_pct": 10.7
            },
            "rates": {
                "greensMin": 20,
                "greensMax": 100,
                "fairwaysMin": 20,
                "fairwaysMax": 100
            },
            "rateUnit": "L/ha",
            "interval_weeks": 4,
            "notes": "Cost-effective NPK liquid. Large drum format. Trace elements included. All-round spring to autumn.",
            "verified": true,
            "productCode": "OAI000314",
            "nForm": "mixed",
            "nFormConfidence": "auto",
            "nFormReason": "nBreakdown: ammonium + urea blend"
        },
        {
            "id": "oas-ecofeed-8-0-0",
            "name": "Ecofeed 8-0-0",
            "brand": "Ecofeed",
            "supplier": "oas",
            "form": "liquid",
            "release": "quick",
            "surfaces": [
                "greens",
                "tees",
                "bowling",
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
                "Mg": 0,
                "Ca": 0,
                "Fe": 0,
                "Mn": 0,
                "S": 0
            },
            "npk_label": "8-0-0",
            "nBreakdown": {
                "ammN_pct": 8
            },
            "rates": {
                "greensMin": 20,
                "greensMax": 100,
                "fairwaysMin": 20,
                "fairwaysMax": 100
            },
            "rateUnit": "L/ha",
            "interval_weeks": 4,
            "notes": "N-only ammoniacal liquid. Cost-effective supplemental N. Large drum (200L/800L) for outfield use.",
            "verified": true,
            "productCode": "OAI001172",
            "nForm": "ammonium",
            "nFormConfidence": "auto",
            "nFormReason": "nBreakdown: ammonium only"
        }
    ],
    "suppliers": {
        "icl": {
            "name": "ICL Turf & Landscape UK",
            "distributor": "ICL direct / Agrovista Amenity",
            "url": "https://icl-growingsolutions.com/en-gb/turf-landscape/"
        },
        "agrovista": {
            "name": "Agrovista Amenity",
            "distributor": "Agrovista Amenity",
            "url": "https://amenity.agrovista.co.uk"
        },
        "compo-expert": {
            "name": "Compo Expert",
            "distributor": "Agrovista Amenity / direct",
            "url": "https://compo-expert.com"
        },
        "headland": {
            "name": "Headland Amenity",
            "distributor": "Headland Amenity",
            "url": "https://www.headlandamenity.com"
        },
        "origin": {
            "name": "Origin Amenity Solutions / Rigby Taylor",
            "distributor": "Origin / Rigby Taylor",
            "url": "https://www.rigbytaylor.com"
        },
        "regen": {
            "name": "ReGen Amenity",
            "distributor": "ReGen Amenity (direct)",
            "url": "https://www.regenamenity.co.uk",
            "notes": "Newport, Wales. Small specialist supplier. Golf and sports turf focus. Contact: rhys@regenamenity.co.uk / 07355 093710"
        },
        "oas": {
            "name": "Origin Amenity Solutions (Headland Amenity)",
            "distributor": "Origin Amenity Solutions / Headland Amenity",
            "url": "https://originamenity.com",
            "notes": "Formed 2021 combining Headland Amenity, Rigby Taylor, Symbio, Turfkeeper. sales@originamenity.com"
        }
    },
    "wettingAgents": [
        {
            "id": "h2pro-trismart",
            "name": "H2Pro TriSmart",
            "brand": "H2Pro",
            "supplier": "icl",
            "form": "liquid",
            "modeOfAction": [
                "penetrant",
                "spreader",
                "retention"
            ],
            "surfactantType": "block_copolymer_triple",
            "surfaces": [
                "greens",
                "tees",
                "fairways",
                "bowling"
            ],
            "season": [
                "all"
            ],
            "rates": {
                "stdMin": 10,
                "stdMax": 10,
                "curativeMin": 20,
                "curativeMax": 20
            },
            "rateUnit": "L/ha",
            "waterVolume_Lha": {
                "min": 600,
                "max": 1000
            },
            "interval_weeks": 4,
            "longevity_weeks": 4,
            "notes": "Premium fine turf wetting agent. Three surfactant technologies, penetration, spread and retention in one product. Most effective against LDS (Localised Dry Patch). 2023 STRI trial: bi-monthly at 20 L/ha = monthly at 10 L/ha. Can be tank-mixed with Greenmaster Liquids (not Ca-Booster). All year use. Confirmed rates from Pitchcare/Amenity Choice product labels.",
            "tankMixCompatible": [
                "greenmaster-liquid-advance",
                "h2pro-flowsmart",
                "h2pro-aquasmart"
            ],
            "verified": true,
            "nForm": "no_N",
            "nFormConfidence": "auto",
            "nFormReason": "Wetting agent, no nitrogen"
        },
        {
            "id": "h2pro-trismart-granular",
            "name": "H2Pro TriSmart Granular",
            "brand": "H2Pro",
            "supplier": "icl",
            "form": "granular",
            "modeOfAction": [
                "penetrant",
                "spreader",
                "retention"
            ],
            "surfactantType": "block_copolymer_triple",
            "particleSize_mm": null,
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
            "rates": {
                "stdMin": 200,
                "stdMax": 300
            },
            "rateUnit": "kg/ha",
            "interval_weeks": 4,
            "longevity_weeks": 4,
            "notes": "TriSmart performance in mini-granule format. Patent pending. Targeted dry patch treatment, applies TriSmart chemistry via granule for areas where sprayer access is difficult or where spot treatment is preferred. Rates need SDS confirmation.",
            "verified": false,
            "nForm": "no_N",
            "nFormConfidence": "auto",
            "nFormReason": "Wetting agent, no nitrogen"
        },
        {
            "id": "h2pro-flowsmart",
            "name": "H2Pro FlowSmart",
            "brand": "H2Pro",
            "supplier": "icl",
            "form": "liquid",
            "modeOfAction": [
                "penetrant"
            ],
            "surfactantType": "block_copolymer_penetrant",
            "surfaces": [
                "greens",
                "tees",
                "fairways",
                "sports"
            ],
            "season": [
                "all"
            ],
            "rates": {
                "stdMin": 10,
                "stdMax": 10
            },
            "rateUnit": "L/ha",
            "waterVolume_Lha": {
                "min": 250,
                "max": 1000
            },
            "interval_weeks": 4,
            "longevity_weeks": 4,
            "notes": "Penetrant-focused wetting agent. Polymer + super-penetrant blend. Reduces surface tension for rapid water infiltration. Drier, firmer surfaces year-round. Best for waterlogging, compacted soil profiles and winter drainage management. Rate 10 L/ha confirmed from Pitchcare label.",
            "tankMixCompatible": [
                "h2pro-trismart",
                "h2pro-aquasmart"
            ],
            "verified": true,
            "nForm": "no_N",
            "nFormConfidence": "auto",
            "nFormReason": "Wetting agent, no nitrogen"
        },
        {
            "id": "h2pro-aquasmart",
            "name": "H2Pro AquaSmart",
            "brand": "H2Pro",
            "supplier": "icl",
            "form": "liquid",
            "modeOfAction": [
                "penetrant",
                "retention"
            ],
            "surfactantType": "block_copolymer_retention",
            "surfaces": [
                "fairways",
                "sports",
                "tees"
            ],
            "season": [
                "spring",
                "summer",
                "autumn"
            ],
            "rates": {
                "stdMin": 5,
                "stdMax": 10
            },
            "rateUnit": "L/ha",
            "waterVolume_Lha": {
                "min": 250,
                "max": 600
            },
            "interval_weeks": 5,
            "longevity_weeks": 5,
            "notes": "Outfield/cost-effective wetting agent. Low-rate formulation, 5 L/ha standard, 10 L/ha high-stress. Apply 3-4 times through summer. Prevents drying and allows quick rewetting. Best fit: fairways, tees, sports pitches where budget is a constraint vs TriSmart.",
            "tankMixCompatible": [
                "h2pro-trismart",
                "h2pro-flowsmart"
            ],
            "verified": true,
            "nForm": "no_N",
            "nFormConfidence": "auto",
            "nFormReason": "Wetting agent, no nitrogen"
        },
        {
            "id": "h2pro-balance",
            "name": "H2Pro Balance",
            "brand": "H2Pro",
            "supplier": "icl",
            "form": "liquid",
            "modeOfAction": [
                "penetrant",
                "retention"
            ],
            "surfactantType": "block_copolymer",
            "surfaces": [
                "greens",
                "tees",
                "fairways"
            ],
            "season": [
                "all"
            ],
            "rates": {
                "stdMin": 10,
                "stdMax": 20
            },
            "rateUnit": "L/ha",
            "waterVolume_Lha": {
                "min": 400,
                "max": 800
            },
            "interval_weeks": 4,
            "longevity_weeks": 4,
            "notes": "LEGACY PRODUCT, replaced by TriSmart in current range. Penetrant + retention wetting agent. Still referenced in some existing programmes. If encountered, TriSmart is the current equivalent.",
            "legacy": true,
            "verified": false,
            "nForm": "no_N",
            "nFormConfidence": "auto",
            "nFormReason": "Wetting agent, no nitrogen"
        },
        {
            "id": "h2pro-dispatch",
            "name": "H2Pro Dispatch",
            "brand": "H2Pro",
            "supplier": "icl",
            "form": "liquid",
            "modeOfAction": [
                "penetrant"
            ],
            "surfactantType": "block_copolymer_penetrant",
            "surfaces": [
                "greens",
                "tees",
                "fairways"
            ],
            "season": [
                "all"
            ],
            "rates": {
                "stdMin": 10,
                "stdMax": 20
            },
            "rateUnit": "L/ha",
            "waterVolume_Lha": {
                "min": 400,
                "max": 800
            },
            "interval_weeks": 4,
            "longevity_weeks": 4,
            "notes": "LEGACY PRODUCT, replaced by FlowSmart in current range. Penetrant-focused. FlowSmart is the current equivalent.",
            "legacy": true,
            "verified": false,
            "nForm": "no_N",
            "nFormConfidence": "auto",
            "nFormReason": "Wetting agent, no nitrogen"
        },
        {
            "id": "h2pro-conserve",
            "name": "H2Pro Conserve",
            "brand": "H2Pro",
            "supplier": "icl",
            "form": "liquid",
            "modeOfAction": [
                "retention"
            ],
            "surfactantType": "block_copolymer_retention",
            "surfaces": [
                "greens",
                "tees"
            ],
            "season": [
                "spring",
                "summer",
                "autumn"
            ],
            "rates": {
                "stdMin": 5,
                "stdMax": 10
            },
            "rateUnit": "L/ha",
            "waterVolume_Lha": {
                "min": 400,
                "max": 800
            },
            "interval_weeks": 4,
            "longevity_weeks": 4,
            "notes": "LEGACY PRODUCT, retention-focused. Referenced in some labels as tank-mix partner with Greenmaster Liquids. AquaSmart is closest current equivalent for outfield; TriSmart for greens.",
            "legacy": true,
            "verified": false,
            "nForm": "no_N",
            "nFormConfidence": "auto",
            "nFormReason": "Wetting agent, no nitrogen"
        },
        {
            "id": "h2pro-conserve-tablet",
            "name": "H2Pro Conserve Tablet",
            "brand": "H2Pro",
            "supplier": "icl",
            "form": "tablet",
            "modeOfAction": [
                "penetrant",
                "retention"
            ],
            "surfactantType": "multi_matrix_3d",
            "surfaces": [
                "greens"
            ],
            "season": [
                "spring",
                "summer",
                "autumn"
            ],
            "rates": {
                "stdMin": null,
                "stdMax": null
            },
            "rateUnit": "tablet",
            "interval_weeks": 4,
            "longevity_weeks": 4,
            "notes": "Hose-end applied tablet. Multi-matrix and 3D technology. 1 tablet treats approximately 7 average golf greens. Curative dry patch treatment. Immediate action against hydrophobic conditions.",
            "verified": true,
            "nForm": "no_N",
            "nFormConfidence": "auto",
            "nFormReason": "Wetting agent, no nitrogen"
        },
        {
            "id": "h2pro-transaction",
            "name": "H2Pro TransAction",
            "brand": "H2Pro",
            "supplier": "icl",
            "form": "liquid",
            "modeOfAction": [
                "penetrant",
                "spreader",
                "retention"
            ],
            "surfactantType": "block_copolymer",
            "surfaces": [
                "greens",
                "tees",
                "fairways"
            ],
            "season": [
                "all"
            ],
            "rates": {
                "stdMin": 10,
                "stdMax": 20
            },
            "rateUnit": "L/ha",
            "waterVolume_Lha": {
                "min": 400,
                "max": 800
            },
            "interval_weeks": 4,
            "longevity_weeks": 4,
            "notes": "LEGACY PRODUCT, multi-mode wetting agent. Predecessor to TriSmart. TriSmart is the current equivalent with improved surfactant chemistry.",
            "legacy": true,
            "verified": false,
            "nForm": "no_N",
            "nFormConfidence": "auto",
            "nFormReason": "Wetting agent, no nitrogen"
        },
        {
            "id": "headland-tricure-ad",
            "name": "TriCure AD",
            "brand": "TriCure AD",
            "supplier": "oas",
            "form": "liquid",
            "modeOfAction": [
                "penetrant",
                "rewetting"
            ],
            "surfactantType": "penetrant_curative",
            "surfaces": [
                "greens",
                "tees",
                "fairways",
                "bowling"
            ],
            "season": [
                "spring",
                "summer",
                "autumn"
            ],
            "rates": {
                "stdMin": 5,
                "stdMax": 5,
                "fullMin": 10,
                "fullMax": 10
            },
            "rateUnit": "L/ha",
            "waterVolume_Lha": {
                "min": 400,
                "max": 800
            },
            "interval_weeks": 4,
            "longevity_weeks": 4,
            "notes": "Headland's flagship wetting agent. Well established in UK golf, widely referenced in case studies. Low rate 5 L/ha = ~2 weeks activity; full rate 10 L/ha = up to 4 weeks. Tank-mix partner: Elevate Fe in spring/summer programme. Confirmed rate from TriCure AD Pellets label: \"Full rate 10 L/ha 4 weeks, low rate 5 L/ha 2 weeks.\"",
            "verified": true,
            "nForm": "no_N",
            "nFormConfidence": "auto",
            "nFormReason": "Wetting agent, no nitrogen"
        },
        {
            "id": "headland-tricure-ad-pellets",
            "name": "TriCure AD Pellets",
            "brand": "TriCure AD",
            "supplier": "oas",
            "form": "tablet",
            "modeOfAction": [
                "penetrant",
                "rewetting"
            ],
            "surfactantType": "penetrant_curative",
            "surfaces": [
                "greens"
            ],
            "season": [
                "spring",
                "summer",
                "autumn"
            ],
            "rates": {
                "stdMin": null,
                "stdMax": null
            },
            "rateUnit": "pellet",
            "interval_weeks": 4,
            "longevity_weeks": 4,
            "notes": "Hose-end pellet version of TriCure AD. Dissolution rate varies with water temperature, calibration required before use. Apply when ambient temps reach 10-15°C (early spring) or at first heat stress signs. Fits 1\" hose or 3/4\" with adapter.",
            "verified": true,
            "nForm": "no_N",
            "nFormConfidence": "auto",
            "nFormReason": "Wetting agent, no nitrogen"
        },
        {
            "id": "headland-tricure-granular",
            "name": "TriCure AD Granular",
            "brand": "TriCure AD",
            "supplier": "oas",
            "form": "granular",
            "modeOfAction": [
                "penetrant",
                "rewetting"
            ],
            "surfactantType": "penetrant_curative",
            "particleSize_mm": null,
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
            "rates": {
                "stdMin": null,
                "stdMax": null
            },
            "rateUnit": "kg/ha",
            "interval_weeks": 4,
            "longevity_weeks": 4,
            "notes": "DG-lite carrier granular formulation. Same chemistry as TriCure AD liquid. Rapid breakdown on turf surface. Rates not confirmed from public sources, request SDS from Headland.",
            "verified": false,
            "nForm": "no_N",
            "nFormConfidence": "auto",
            "nFormReason": "Wetting agent, no nitrogen"
        },
        {
            "id": "headland-terafirm-liquid",
            "name": "Terafirm (liquid)",
            "brand": "Terafirm",
            "supplier": "oas",
            "form": "liquid",
            "modeOfAction": [
                "penetrant",
                "drainage"
            ],
            "surfactantType": "penetrant_drainage",
            "surfaces": [
                "greens",
                "tees",
                "fairways",
                "sports"
            ],
            "season": [
                "all"
            ],
            "rates": {
                "stdMin": 5,
                "stdMax": 10
            },
            "rateUnit": "L/ha",
            "waterVolume_Lha": {
                "min": 400,
                "max": 600
            },
            "interval_weeks": 4,
            "longevity_weeks": 4,
            "notes": "Soil penetrant formulated to improve downward water movement, reduces lateral movement, maximises drainage. Non-phytotoxic. Creates firmer surface by accelerating soil contraction during dry-down. DIFFERENT purpose to TriCure, Terafirm is for drainage/firmness, TriCure for dry patch rewetting. Case study: Canons Brook GC, applied to fairways at 2.5 L/ha alongside XTEND 21-0-0 and Elevate Fe.",
            "verified": false,
            "nForm": "no_N",
            "nFormConfidence": "auto",
            "nFormReason": "Wetting agent, no nitrogen"
        },
        {
            "id": "headland-terafirm-granular",
            "name": "Terafirm Granular",
            "brand": "Terafirm",
            "supplier": "oas",
            "form": "granular",
            "modeOfAction": [
                "penetrant",
                "drainage"
            ],
            "surfactantType": "penetrant_drainage",
            "particleSize_mm": null,
            "surfaces": [
                "greens",
                "tees",
                "fairways",
                "sports"
            ],
            "season": [
                "all"
            ],
            "rates": {
                "stdMin": null,
                "stdMax": null
            },
            "rateUnit": "kg/ha",
            "interval_weeks": 4,
            "longevity_weeks": 4,
            "notes": "DG-lite carrier. Same drainage-focussed chemistry as Terafirm liquid in granular form. Rates not confirmed, request SDS.",
            "verified": false,
            "nForm": "no_N",
            "nFormConfidence": "auto",
            "nFormReason": "Wetting agent, no nitrogen"
        }
    ],
    "plantHealth": [
        {
            "id": "headland-seamac-proturf-fe",
            "name": "Seamac ProTurf Fe",
            "brand": "Seamac",
            "supplier": "oas",
            "form": "liquid",
            "category": "iron_complex",
            "analysis": {
                "Fe": 6,
                "Mg": 0,
                "S": 0
            },
            "chelationForm": "citrate",
            "surfaces": [
                "greens",
                "tees",
                "fairways",
                "bowling"
            ],
            "season": [
                "autumn",
                "winter",
                "spring"
            ],
            "rates": {
                "stdMin": 20,
                "stdMax": 30,
                "tankmixMin": 30,
                "tankmixMax": 30
            },
            "rateUnit": "L/ha",
            "waterVolume_Lha": {
                "min": 300,
                "max": 500
            },
            "interval_weeks": 4,
            "tankmix": {
                "20-20-30": {
                    "rate": 30,
                    "partners": [
                        "headland-liquid-turf-hardener",
                        "headland-turfite-elite"
                    ]
                }
            },
            "notes": "Core component of Headland 20-20-30 Fusarium suppression programme at 30 L/ha. Citrate-chelated Fe, creates acidic leaf environment hostile to Microdochium nivale. Mg and S present but % not stated on public pages, request SDS. Apply morning/evening; water in at high rate (30 L/ha) or dry weather. Also includes seaweed per case study reference.",
            "verified": true,
            "nForm": "no_N",
            "nFormConfidence": "auto",
            "nFormReason": "Plant health product, no fertiliser N"
        },
        {
            "id": "headland-liquid-turf-hardener",
            "name": "Liquid Turf Hardener",
            "brand": "Headland",
            "supplier": "oas",
            "form": "liquid",
            "category": "plant_hardener",
            "analysis": {
                "N": 0,
                "Ca": 0,
                "Mg": 0
            },
            "surfaces": [
                "greens",
                "tees",
                "fairways",
                "bowling"
            ],
            "season": [
                "autumn",
                "winter",
                "spring"
            ],
            "rates": {
                "stdMin": 20,
                "stdMax": 20,
                "tankmixMin": 20,
                "tankmixMax": 20
            },
            "rateUnit": "L/ha",
            "waterVolume_Lha": {
                "min": 300,
                "max": 500
            },
            "interval_weeks": 4,
            "tankmix": {
                "20-20-30": {
                    "rate": 20,
                    "partners": [
                        "headland-seamac-proturf-fe",
                        "headland-turfite-elite"
                    ]
                }
            },
            "notes": "Ca + Mg in nitrate form, increases cell wall thickness. Rapid uptake in low temperatures. Acid buffered for tank-mix compatibility. Core component of 20-20-30 at 20 L/ha. Ca and Mg % not on public pages, request SDS.",
            "verified": true,
            "nForm": "no_N",
            "nFormConfidence": "auto",
            "nFormReason": "Plant health product, no fertiliser N"
        },
        {
            "id": "headland-turfite-elite",
            "name": "Turfite Elite",
            "brand": "Turfite",
            "supplier": "oas",
            "form": "liquid",
            "category": "sar_elicitor",
            "activeIngredients": [
                "potassium_phosphite",
                "salicylic_acid"
            ],
            "analysis": {
                "P": 0,
                "K": 0
            },
            "surfaces": [
                "greens",
                "tees",
                "fairways",
                "bowling"
            ],
            "season": [
                "autumn",
                "winter",
                "spring",
                "summer"
            ],
            "rates": {
                "stdMin": 20,
                "stdMax": 20,
                "tankmixMin": 20,
                "tankmixMax": 20
            },
            "rateUnit": "L/ha",
            "waterVolume_Lha": {
                "min": 300,
                "max": 500
            },
            "interval_weeks": 4,
            "tankmix": {
                "20-20-30": {
                    "rate": 20,
                    "partners": [
                        "headland-seamac-proturf-fe",
                        "headland-liquid-turf-hardener"
                    ]
                },
                "spring-summer": {
                    "partners": [
                        "headland-seamac-ultra-plus",
                        "headland-temag-hpe"
                    ]
                }
            },
            "sarMechanism": true,
            "notes": "Potassium phosphite + salicylic acid. SA triggers SAR (Systemic Acquired Resistance), activates plant defence pathways against Microdochium and other pathogens. Phosphite provides direct anti-fungal activity at leaf surface. STRI-trialled since 2007 (11+ years continuous). 20-20-30 rate at 20 L/ha confirmed from multiple sources. Compatible with Seamac Ultra Plus and TeMag HPE for post-stress recovery.",
            "verified": true,
            "nForm": "no_N",
            "nFormConfidence": "auto",
            "nFormReason": "Plant health product, no fertiliser N"
        },
        {
            "id": "headland-elevate-fe",
            "name": "Elevate Fe",
            "brand": "Headland",
            "supplier": "oas",
            "form": "liquid",
            "category": "iron_complex",
            "analysis": {
                "Fe": 0
            },
            "chelationForm": "complexed_non_staining",
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
            "rates": {
                "stdMin": 20,
                "stdMax": 20
            },
            "rateUnit": "L/ha",
            "waterVolume_Lha": {
                "min": 300,
                "max": 500
            },
            "interval_weeks": 4,
            "tankmix": {
                "spring-summer": {
                    "partners": [
                        "oas-xtend-46-0-0",
                        "headland-tricure-ad"
                    ]
                }
            },
            "notes": "Non-staining complexed Fe, key differentiator vs ferrous sulphate (no wheel marks, no concrete staining). Mixes with Primo Maxx II and liquid fertilisers. Spring/summer tank-mix partner: XTEND 46-0-0 + TriCure AD (referenced Stratford Oaks case study). Fe% not on public pages, request SDS.",
            "verified": false,
            "nForm": "no_N",
            "nFormConfidence": "auto",
            "nFormReason": "Plant health product, no fertiliser N"
        },
        {
            "id": "headland-seamac-ultra-plus",
            "name": "Seamac Ultra Plus",
            "brand": "Seamac",
            "supplier": "oas",
            "form": "liquid",
            "category": "iron_seaweed",
            "analysis": {
                "Fe": 0
            },
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
            "rates": {
                "stdMin": 20,
                "stdMax": 30
            },
            "rateUnit": "L/ha",
            "waterVolume_Lha": {
                "min": 300,
                "max": 500
            },
            "interval_weeks": 4,
            "notes": "Chelated Fe + seaweed combination. Post-stress recovery partner with Turfite Elite and TeMag HPE. Fe% and seaweed concentration not confirmed from public sources, request SDS.",
            "verified": false,
            "nForm": "no_N",
            "nFormConfidence": "auto",
            "nFormReason": "Plant health product, no fertiliser N"
        },
        {
            "id": "headland-dewcure",
            "name": "DewCure",
            "brand": "Headland",
            "supplier": "oas",
            "form": "liquid",
            "category": "dew_dispersant",
            "surfaces": [
                "greens",
                "bowling"
            ],
            "season": [
                "autumn",
                "winter",
                "spring"
            ],
            "rates": {
                "stdMin": 10,
                "stdMax": 20
            },
            "rateUnit": "L/ha",
            "waterVolume_Lha": {
                "min": 300,
                "max": 500
            },
            "interval_weeks": 2,
            "notes": "Dew dispersant, forms water-resistant rainfast coating on leaf surface. Reduces leaf wetness duration, lowering Microdochium infection risk. Referenced in case studies as supplementary to 20-20-30 programme. Rates approximate, confirm from SDS.",
            "verified": false,
            "nForm": "no_N",
            "nFormConfidence": "auto",
            "nFormReason": "Plant health product, no fertiliser N"
        },
        {
            "id": "headland-xtend-liquid-21-0-0",
            "name": "XTEND Liquid 21-0-0",
            "brand": "Xtend",
            "supplier": "oas",
            "form": "liquid",
            "category": "liquid_fertiliser",
            "analysis": {
                "N": 21,
                "P": 0,
                "K": 0
            },
            "release": "stabilised",
            "releaseNotes": "NBPT + DCD inhibitors in liquid form.",
            "surfaces": [
                "greens",
                "tees",
                "fairways",
                "sports"
            ],
            "season": [
                "spring",
                "summer"
            ],
            "rates": {
                "stdMin": 30,
                "stdMax": 30
            },
            "rateUnit": "L/ha",
            "waterVolume_Lha": {
                "min": 300,
                "max": 500
            },
            "interval_weeks": 4,
            "notes": "Liquid stabilised N. Same NBPT + DCD inhibitor technology as XTEND granular range. 30 L/ha rate confirmed from Canons Brook GC case study. Tank-mix partner: Elevate Fe and TriCure AD for spring/summer fairway programme.",
            "verified": true,
            "nForm": "stabilised_urea",
            "nFormConfidence": "auto",
            "nFormReason": "Xtend Liquid: urea + NBPT urease inhibitor + DCD nitrification inhibitor (confirmed OAS brochure)"
        }
    ]
};

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UkFertiliserProducts;
}

// Browser global for GAIP Hub
if (typeof window !== 'undefined') {
    window.GAIP_UK_FERTILISER = { products: UkFertiliserProducts };
}
