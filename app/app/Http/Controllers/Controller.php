<?php

namespace App\Http\Controllers;

abstract class Controller
{
    /**
     * New Zealand coordinate bounds (lon 166–179, lat -47–-34).
     * Used to force Ammonium Acetate methodology for NZ sites.
     */
    protected static function isNewZealand(?float $lat, ?float $lon): bool
    {
        if ($lat === null || $lon === null) {
            return false;
        }
        return $lon >= 166 && $lon <= 179 && $lat >= -47 && $lat <= -34;
    }

    /**
     * GH-520: the site's methodology, read from its one owner.
     *
     * The owner is `config.turf.methodology` — what the Settings form and the
     * wizard step write. This function no longer decides anything: it
     * normalises what was saved and answers NULL where nothing was.
     *
     * Two rules went from here, and both were substitutions rather than
     * readings:
     *
     *   - `isNewZealand -> ammonium_acetate`, which overrode ANY saved value
     *     including SLAN, on eight call sites across seven controllers. The
     *     region now narrows what a site may CHOOSE (Settings offers AA alone
     *     on NZ), it does not overwrite what the site chose.
     *   - `?: 'mlsn'`, which turned "nothing is set" into a methodology. The
     *     owner's decision, 18.09.2026: where it is not set the calculation
     *     does not run, and the page says so. Not set is not MLSN.
     *
     * Callers must handle null: `strtoupper(null)` is deprecated in PHP 8.
     */
    protected static function effectiveMethodology(?string $saved): ?string
    {
        if ($saved === null) {
            return null;
        }
        $normalised = strtolower(trim($saved));

        return $normalised === '' ? null : $normalised;
    }

    /**
     * GH-439: the site's own time zone, derived from its coordinates.
     *
     * GH-446: the implementation moved to App\Support\SiteTimezone so the
     * repair command compares against the same function the server writes
     * with. This stays as the controllers' way in.
     */
    protected static function timezoneFromCoordinates(?float $lat, ?float $lon): ?string
    {
        return \App\Support\SiteTimezone::fromCoordinates($lat, $lon);
    }
}
