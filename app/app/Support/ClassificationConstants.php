<?php

namespace App\Support;

/**
 * GH-546 (stage 1) — the MLSN thresholds the server
 * classifies against, and the one place they live on this side.
 *
 * WHY THIS FILE EXISTS AND WHAT IT CORRECTS. `SampleAnalysisController` carried
 * its own `MLSN_DEFAULTS`. The macronutrients matched the product's canonical
 * table; the micronutrients did not:
 *
 *     canonical (assets/gaip-classification-constants.js)   Fe 2    Mn 1   Zn 1    Cu 0.3  B 0.3
 *     the controller's own copy                             Fe 49   Mn 5   Zn 2.2  Cu 0.9  B 0.5
 *
 * It did not show, because the controller preferred thresholds taken out of the
 * analysis cache — the browser's own last run — and those carried the canonical
 * numbers. So the wrong table only applied to a site with no cached run: the
 * same sample classified differently depending on whether a Re-run had ever
 * happened. That is the two-paths class of GH-262, and it was hidden by exactly
 * the dependency GH-546 removes.
 *
 * The numbers here are the canonical ones. `mlsnEngine` reads them from
 * `gaip-classification-constants.js` (`hub-tissue-v3.js`), and
 * `tests/gh546-mlsn-thresholds-parity.test.js` compares the two files so the
 * copies cannot drift again — which is the only reason a second copy is
 * tolerable at all.
 *
 * Where the 49 / 5 / 2.2 / 0.9 / 0.5 came from is not established: the file's
 * history was not read.
 */
class ClassificationConstants
{
    /**
     * MLSN — Minimum Levels for Sustainable Nutrition, ppm.
     *
     * Order is the canonical display order (GH-271), the same loop `mlsnEngine`
     * walks: it is what decides the order of the nutrient cards when the sample
     * has no cached run to take an order from.
     */
    public const MLSN_THRESHOLDS = [
        'P'  => 21,
        'K'  => 37,
        'Ca' => 331,
        'Mg' => 47,
        'S'  => 7,
        'Fe' => 2,
        'Mn' => 1,
        'Zn' => 1,
        'Cu' => 0.3,
        'B'  => 0.3,
    ];
}
