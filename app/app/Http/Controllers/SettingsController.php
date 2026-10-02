<?php

namespace App\Http\Controllers;

use App\Services\ZoneService;
use App\Support\AnalysisResults;
use App\Support\CalculationInputs;
use App\Support\ZoneTypes;
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

        /**
         * GH-789 (queue item 7): WHICH FIELDS THIS SITE MUST FILL IN, from the list.
         *
         * The template marked five fields with the HTML `required` attribute, on forms that all carry
         * `novalidate` -- so it was a mark and nothing else, and it named the wrong five: the cultivar and
         * the construction were marked, the turf type and the methodology were not, and neither was the
         * golf surface, which is required of golf alone. The mark is derived here, per input, for THIS
         * site's turf type, so it follows the owner's decisions without this file being touched.
         */
        $setupTurfType = $activeGaipConfig['turf']['turfType'] ?? '';
        $requiredInputs = CalculationInputs::requiredFor(is_string($setupTurfType) ? $setupTurfType : '');

        /**
         * GH-801 (queue item "Zones", stage C2) — THE ZONES OF THIS SITE, AS ROWS, AND THE DICTIONARY.
         *
         * The tab read the site's list of NAMES out of `attributes_json` in the template itself, which is
         * all a zone was. It is a row with an identity and a type now, and both come from here: the rows
         * from their one owner (`ZoneService`) and the twelve types from the one reader of the one file
         * (`ZoneTypes`), parsed, the way the AA ranges and the inputs list already reach a page. Nothing
         * in `assets` reads that file — `Gh799TheZoneTypesHaveOneFileTest` is red if anything does.
         *
         * THE OBLIGATION TRAVELS AS A DECLARATION, not as a mark drawn by the template: whether a type is
         * required IN THIS PLACE, and the words a refusal uses for it, are declared in the INPUTS LIST
         * (GH-804: `calculation-inputs.schema.json`, `zones.zoneType`) and read through
         * `CalculationInputs`. That is what lets the Data page create a zone with no type while this tab
         * refuses to save one — the owner's decision of 01.10.2026, in the declaration rather than in two
         * screens. It is the one input of that list whose scope is a ZONE, so `requiredFor` above does
         * not carry it and the `Required` marks of the other tabs are unchanged.
         */
        $siteZones = $activeSite ? app(ZoneService::class)->forThePage($activeSite) : [];
        $zoneTypes = ZoneTypes::forThePage()['zoneTypes'];
        $zoneTypeField = CalculationInputs::zoneTypeFieldForThePage('settings.zones');

        return view('settings', [
            'title'            => 'Settings',
            'requiredInputs'   => $requiredInputs,
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
            'siteZones'        => $siteZones,
            'zoneTypes'        => $zoneTypes,
            'zoneTypeField'    => $zoneTypeField,
        ]);
    }
}
