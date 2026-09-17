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
     * Return the effective soil methodology for a site.
     * NZ sites always use ammonium_acetate regardless of saved settings.
     */
    protected static function effectiveMethodology(?string $saved, ?float $lat, ?float $lon): string
    {
        if (self::isNewZealand($lat, $lon)) {
            return 'ammonium_acetate';
        }
        return ($saved !== null && $saved !== '') ? $saved : 'mlsn';
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
