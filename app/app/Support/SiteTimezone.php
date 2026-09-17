<?php

namespace App\Support;

use DateTimeZone;

/**
 * GH-446 (GH-439 stage 4a): the site time-zone derivation, in one place.
 *
 * It was a protected method on Controller (GH-439 stage 0, contract 2.5), which
 * the repair command cannot reach. Rather than a second copy -- the plan is
 * explicit that the repair must compare against the same function the server
 * writes with, not against its own idea of the rule -- the implementation moved
 * here and Controller delegates to it.
 */
class SiteTimezone
{
    /**
     * The zone whose reference point is nearest the given coordinates.
     *
     * Every zone PHP knows carries the latitude and longitude of its principal
     * city (DateTimeZone::getLocation()); the site's zone is the closest of
     * them by great-circle distance. Approximate near a zone boundary -- the
     * manual override in Settings > Site is what covers those.
     *
     * Null when either coordinate is missing: a site with no location has no
     * time zone, and nothing is substituted for one.
     */
    public static function fromCoordinates(?float $lat, ?float $lon): ?string
    {
        if ($lat === null || $lon === null) {
            return null;
        }

        $best = null;
        $bestDistance = null;

        foreach (self::referencePoints() as $identifier => [$zoneLat, $zoneLon]) {
            $distance = self::greatCircleDistanceKm($lat, $lon, $zoneLat, $zoneLon);
            if ($bestDistance === null || $distance < $bestDistance) {
                $bestDistance = $distance;
                $best = $identifier;
            }
        }

        return $best;
    }

    /**
     * GH-446: do two zones actually keep different time, or only different
     * names?
     *
     * The repair rewrites `Australia/Sydney` only where the derived zone keeps
     * genuinely different time. Melbourne, Canberra and Hobart run the same
     * AEST/AEDT as Sydney, so a Melbourne site labelled Sydney is correct about
     * the clock and renaming it would be a change with no meaning behind it.
     * Auckland (+12/+13 against Sydney's +10/+11) is a different matter.
     *
     * Both January and July are checked because two zones can agree in one half
     * of the year and differ in the other, which is exactly what daylight
     * saving does.
     */
    public static function keepsSameTime(string $a, string $b): bool
    {
        if ($a === $b) {
            return true;
        }

        try {
            $zoneA = new DateTimeZone($a);
            $zoneB = new DateTimeZone($b);
        } catch (\Exception) {
            return false;
        }

        // GH-448: this year and the next. A zone's rules can change between
        // years -- a country drops daylight saving, a territory moves zone --
        // and a comparison that only ever looks at the current one would call
        // two zones the same on the strength of a year that is about to end.
        $year = (int) date('Y');
        $moments = [
            $year.'-01-01 12:00:00', $year.'-07-01 12:00:00',
            ($year + 1).'-01-01 12:00:00', ($year + 1).'-07-01 12:00:00',
        ];
        foreach ($moments as $moment) {
            $utc = new \DateTimeImmutable($moment, new DateTimeZone('UTC'));
            if ($zoneA->getOffset($utc) !== $zoneB->getOffset($utc)) {
                return false;
            }
        }

        return true;
    }

    /**
     * identifier => [latitude, longitude] for every zone that carries a
     * reference point. Built once per process.
     */
    private static function referencePoints(): array
    {
        static $points = null;

        if ($points !== null) {
            return $points;
        }

        $points = [];
        foreach (DateTimeZone::listIdentifiers() as $identifier) {
            $location = (new DateTimeZone($identifier))->getLocation();
            if (! is_array($location) || ! isset($location['latitude'], $location['longitude'])) {
                continue;
            }
            $points[$identifier] = [(float) $location['latitude'], (float) $location['longitude']];
        }

        return $points;
    }

    /** Great-circle distance in kilometres (haversine). */
    private static function greatCircleDistanceKm(float $lat1, float $lon1, float $lat2, float $lon2): float
    {
        $earthRadiusKm = 6371.0;
        $dLat = deg2rad($lat2 - $lat1);
        $dLon = deg2rad($lon2 - $lon1);
        $a = sin($dLat / 2) ** 2
            + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLon / 2) ** 2;

        return $earthRadiusKm * 2 * asin(min(1.0, sqrt($a)));
    }
}
