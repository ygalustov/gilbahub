<?php

namespace App\Http\Controllers;

use App\Support\AnalysisResults;
use Illuminate\Http\Request;
use Illuminate\View\View;

class AnalysisController extends Controller
{
    public function index(Request $request): View
    {
        $user       = $request->user();
        $activeSite = $user?->activeSite;
        $allSites   = $user?->sites()->orderBy('name')->get() ?? collect();

        $savedLocation = [
            'name' => $activeSite?->location_name ?? '',
            'lat'  => $activeSite?->latitude ?? '',
            'lon'  => $activeSite?->longitude ?? '',
        ];

        $gaipConfig       = [];
        $turfSpecies      = null;
        $turfVariety      = null;
        $turfSiteType     = null;
        $companionSpecies = null;
        $overseedSpecies  = null;
        $turfMethodology  = null;
        $percentC3Cover   = null;
        $locationName     = null;

        if ($activeSite) {
            $gaipRecord       = $activeSite->configs()->where('namespace', 'gaip')->first();
            $gaipConfig       = is_array($gaipRecord?->config) ? $gaipRecord->config : [];
            $turfSpecies      = $gaipConfig['turf']['species'] ?? null;
            $turfVariety      = $gaipConfig['turf']['variety'] ?? null;
            $turfSiteType     = $gaipConfig['turf']['turfType'] ?? null;
            $companionSpecies = $gaipConfig['turf']['companionSpecies'] ?? null;
            $overseedSpecies = $gaipConfig['turf']['overseedSpecies']
                ?? $gaipConfig['turf']['coolOverseed']
                ?? null;
            $siteLat = $activeSite->latitude  !== null ? (float) $activeSite->latitude  : (isset($gaipConfig['location']['lat']) ? (float) $gaipConfig['location']['lat'] : null);
            $siteLon = $activeSite->longitude !== null ? (float) $activeSite->longitude : (isset($gaipConfig['location']['lon']) ? (float) $gaipConfig['location']['lon'] : null);
            // GH-520: null means the site has no methodology set; upper-casing
            // null is deprecated in PHP 8, and '' would read as "set to nothing".
            $turfMethodology = self::effectiveMethodology($gaipConfig['turf']['methodology'] ?? null);
            $turfMethodology = $turfMethodology === null ? null : strtoupper($turfMethodology);
            $percentC3Cover  = isset($gaipConfig['turf']['c3Cover'])
                ? (float) $gaipConfig['turf']['c3Cover']
                : null;
            $locationName    = $gaipConfig['location']['name'] ?? $activeSite->location_name ?: null;
        }

        // GH-546 (stage 1): one projection, from the owner of the result.
        // Three identical copies stood in this file alone.
        $analysisCache = AnalysisResults::forSite($activeSite);

        // GH-520: the NZ override that used to be written into the cached
        // soilNutrition here is gone. It overwrote whatever had been saved,
        // SLAN included, and the cache is no longer a methodology source at
        // all — the site's configuration is.

        return view('analysis', [
            'activeSite'       => $activeSite,
            'allSites'         => $allSites,
            'savedLocation'    => $savedLocation,
            'turfSpecies'      => $turfSpecies,
            'turfVariety'      => $turfVariety,
            'turfSiteType'     => $turfSiteType,
            'companionSpecies' => $companionSpecies,
            'overseedSpecies'  => $overseedSpecies,
            'turfMethodology'  => $turfMethodology,
            'percentC3Cover'   => $percentC3Cover,
            'locationName'     => $locationName,
            'analysisCache'    => $analysisCache,
        ]);
    }

    /**
     * GH-549 — NOTHING ROUTES HERE TODAY, AND THAT IS WHY THIS PARAGRAPH EXISTS.
     *
     * `/analysis/growth-light` and `/analysis/disease` are `redirect()`s to
     * `/analysis#growth-light` and `/analysis#disease` (`routes/web.php`): the
     * pages became tabs of the SPA and these two methods, with their own
     * templates, are unreachable. The plan for the analysis result counts six screens
     * that print analysis numbers; four can be opened.
     *
     * Both templates were nevertheless wired to `partials.analysis-notice` and
     * `partials.analysis-pill` in GH-548, so a route restored here comes back
     * with the panel and the pill rather than as two screens that say nothing
     * about the numbers they print. `Gh548AnalysisNoticeTest` asserts both
     * halves — the redirect and the wiring — so this note cannot go stale
     * quietly in either direction.
     */
    public function growthLight(Request $request): View
    {
        $user       = $request->user();
        $activeSite = $user?->activeSite;
        $allSites   = $user?->sites()->orderBy('name')->get() ?? collect();

        $savedLocation = [
            'name' => $activeSite?->location_name ?? '',
            'lat'  => $activeSite?->latitude ?? '',
            'lon'  => $activeSite?->longitude ?? '',
        ];

        $gaipConfig       = [];
        $turfSpecies      = null;
        $overseedSpecies  = null;
        $turfMethodology  = null;
        $percentC3Cover   = null;
        $locationName     = null;

        if ($activeSite) {
            $gaipRecord      = $activeSite->configs()->where('namespace', 'gaip')->first();
            $gaipConfig      = is_array($gaipRecord?->config) ? $gaipRecord->config : [];
            $turfSpecies     = $gaipConfig['turf']['species'] ?? null;
            $overseedSpecies = $gaipConfig['turf']['overseedSpecies']
                ?? $gaipConfig['turf']['coolOverseed']
                ?? null;
            $siteLat = $activeSite->latitude  !== null ? (float) $activeSite->latitude  : (isset($gaipConfig['location']['lat']) ? (float) $gaipConfig['location']['lat'] : null);
            $siteLon = $activeSite->longitude !== null ? (float) $activeSite->longitude : (isset($gaipConfig['location']['lon']) ? (float) $gaipConfig['location']['lon'] : null);
            // GH-520: null means the site has no methodology set; upper-casing
            // null is deprecated in PHP 8, and '' would read as "set to nothing".
            $turfMethodology = self::effectiveMethodology($gaipConfig['turf']['methodology'] ?? null);
            $turfMethodology = $turfMethodology === null ? null : strtoupper($turfMethodology);
            $percentC3Cover  = isset($gaipConfig['turf']['c3Cover'])
                ? (float) $gaipConfig['turf']['c3Cover']
                : null;
            $locationName    = $gaipConfig['location']['name'] ?? $activeSite->location_name ?: null;
        }

        // GH-546 (stage 1): one projection, from the owner of the result.
        // Three identical copies stood in this file alone.
        $analysisCache = AnalysisResults::forSite($activeSite);

        return view('analysis.growth-light', [
            'activeSite'      => $activeSite,
            'allSites'        => $allSites,
            'savedLocation'   => $savedLocation,
            'turfSpecies'     => $turfSpecies,
            'overseedSpecies' => $overseedSpecies,
            'turfMethodology' => $turfMethodology,
            'percentC3Cover'  => $percentC3Cover,
            'locationName'    => $locationName,
            'analysisCache'   => $analysisCache,
        ]);
    }

    public function disease(Request $request): View
    {
        $user       = $request->user();
        $activeSite = $user?->activeSite;
        $allSites   = $user?->sites()->orderBy('name')->get() ?? collect();

        $gaipConfig      = [];
        $turfSpecies     = null;
        $turfMethodology = null;
        $locationName    = null;

        if ($activeSite) {
            $gaipRecord      = $activeSite->configs()->where('namespace', 'gaip')->first();
            $gaipConfig      = is_array($gaipRecord?->config) ? $gaipRecord->config : [];
            $turfSpecies     = $gaipConfig['turf']['species'] ?? null;
            $siteLat = $activeSite->latitude  !== null ? (float) $activeSite->latitude  : (isset($gaipConfig['location']['lat']) ? (float) $gaipConfig['location']['lat'] : null);
            $siteLon = $activeSite->longitude !== null ? (float) $activeSite->longitude : (isset($gaipConfig['location']['lon']) ? (float) $gaipConfig['location']['lon'] : null);
            // GH-520: null means the site has no methodology set; upper-casing
            // null is deprecated in PHP 8, and '' would read as "set to nothing".
            $turfMethodology = self::effectiveMethodology($gaipConfig['turf']['methodology'] ?? null);
            $turfMethodology = $turfMethodology === null ? null : strtoupper($turfMethodology);
            $locationName    = $gaipConfig['location']['name'] ?? $activeSite->location_name ?: null;
        }

        // GH-546 (stage 1): one projection, from the owner of the result.
        // Three identical copies stood in this file alone.
        $analysisCache = AnalysisResults::forSite($activeSite);

        return view('analysis.disease', [
            'activeSite'      => $activeSite,
            'allSites'        => $allSites,
            'turfSpecies'     => $turfSpecies,
            'turfMethodology' => $turfMethodology,
            'locationName'    => $locationName,
            'analysisCache'   => $analysisCache,
        ]);
    }
}
