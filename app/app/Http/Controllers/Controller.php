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
}
