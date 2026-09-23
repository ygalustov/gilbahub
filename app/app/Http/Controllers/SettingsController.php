<?php

namespace App\Http\Controllers;

use App\Support\AnalysisResults;
use Illuminate\Http\Request;
use Illuminate\View\View;

class SettingsController extends Controller
{
    public function show(Request $request): View
    {
        $user       = $request->user();
        $activeSite = $user?->activeSite;

        $activeGaipConfig = [];
        if ($activeSite) {
            $activeSite->load('configs');
            $gaipRecord = $activeSite->configs()->where('namespace', 'gaip')->first();
            $activeGaipConfig = is_array($gaipRecord?->config) ? $gaipRecord->config : [];
        }

        $turfSpecies     = $activeGaipConfig['turf']['species'] ?? null;
        $locationName    = $activeGaipConfig['location']['name'] ?? $activeSite?->location_name ?: null;
        $latitude        = $activeSite?->latitude  ?? $activeGaipConfig['location']['lat']  ?? null;
        $longitude       = $activeSite?->longitude ?? $activeGaipConfig['location']['lon'] ?? null;

        $isNewZealand    = self::isNewZealand(
            $latitude  !== null ? (float) $latitude  : null,
            $longitude !== null ? (float) $longitude : null
        );
        $savedMethodology = $activeGaipConfig['turf']['methodology'] ?? null;
        // GH-520: the saved value, normalised, or null. The region no longer
        // overrides it here — it narrows the list the form offers instead.
        $turfMethodology  = self::effectiveMethodology($savedMethodology);
        $turfMethodology  = $turfMethodology === null ? null : strtoupper($turfMethodology);

        // GH-546 (stage 1): one projection, from the owner of the
        // result. This was eight hand-built copies of the same three keys
        // across seven controllers; a ninth field would have been eight
        // edits and would have reached some screens and not others.
        $analysisCache = AnalysisResults::forSite($activeSite);

        $activeSiteRole = $activeSite ? $user?->roleOnSite($activeSite) : null;

        // GH-440 (GH-439 stage 1, contract 2.5): what the site's time zone
        // would be if taken from its coordinates. The Timezone select offers
        // it as "Auto", so the field reads as the override it now is.
        $timezoneDerived = self::timezoneFromCoordinates(
            $latitude  !== null ? (float) $latitude  : null,
            $longitude !== null ? (float) $longitude : null
        );

        return view('settings', [
            'title'            => 'Settings',
            'activeSite'       => $activeSite,
            'activeGaipConfig' => $activeGaipConfig,
            'turfSpecies'      => $turfSpecies,
            'turfMethodology'  => $turfMethodology,
            'locationName'     => $locationName,
            'latitude'         => $latitude,
            'longitude'        => $longitude,
            'isNewZealand'     => $isNewZealand,
            'analysisCache'    => $analysisCache,
            'activeSiteRole'   => $activeSiteRole,
            'timezoneDerived'  => $timezoneDerived,
        ]);
    }
}
