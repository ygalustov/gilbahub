<?php

namespace App\Http\Controllers;

use App\Support\GilbaRuntimeBootstrap;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class StadiumAnalysisController extends Controller
{
    public function shadeRender(Request $request): JsonResponse
    {
        GilbaRuntimeBootstrap::loadStadiumClasses();

        $venueId = trim((string) $request->input('venue_id', ''));
        $date = trim((string) $request->input('date', date('Y-m-d')));
        $time = trim((string) $request->input('time', '12:00'));
        $mode = trim((string) $request->input('mode', 'series'));

        $this->forwardHubClimateData($request);

        if ($venueId === '') {
            return $this->legacyError('No venue specified');
        }

        $stadium = \Gssh_Stadium_Database::get_stadium($venueId);
        if (! $stadium) {
            return $this->legacyError('Venue not found: '.$venueId);
        }

        try {
            $visualiser = new \Gssh_Shade_Visualiser();

            $html = match ($mode) {
                'snapshot' => $visualiser->generate_snapshot($venueId, $date.'T'.$time.':00', [
                    'width' => 800,
                    'height' => 500,
                ]),
                'animation' => $visualiser->generate_daily_animation($venueId, $date, [
                    'width' => 800,
                    'height' => 500,
                ]),
                'seasonal' => $visualiser->generate_seasonal_comparison($venueId, $time),
                'heatmap' => $visualiser->generate_shade_heatmap($venueId, $date, [
                    'width' => 800,
                    'height' => 500,
                ]),
                default => $visualiser->generate_time_series($venueId, $date),
            };

            return $this->legacySuccess([
                'html' => $html,
                'venue_id' => $venueId,
                'mode' => $mode,
                'date' => $date,
            ]);
        } catch (\Throwable $e) {
            return $this->legacyError($e->getMessage(), [
                'file' => basename($e->getFile()),
                'line' => $e->getLine(),
            ]);
        }
    }

    public function rigCalculate(Request $request): JsonResponse
    {
        GilbaRuntimeBootstrap::loadStadiumClasses();

        $venueId = trim((string) $request->input('venue_id', ''));
        $rigModel = trim((string) $request->input('rig_model', 'SGL_MU460'));
        $month = (int) $request->input('month', date('n'));
        $roofState = trim((string) $request->input('roof_state', 'open'));
        $targetCoverage = $request->input('target_coverage_pct');

        $this->forwardHubClimateData($request);

        if ($venueId === '') {
            return $this->legacyError('No venue specified');
        }

        $stadium = \Gssh_Stadium_Database::get_stadium($venueId);
        if (! $stadium) {
            return $this->legacyError('Venue not found');
        }

        $allowedRoofStates = ['open', 'closed', 'unknown'];
        if (! in_array($roofState, $allowedRoofStates, true)) {
            $roofState = 'open';
        }

        $rawAmbientDli = $request->filled('ambient_dli') ? (float) $request->input('ambient_dli') : null;
        $roofTransmission = \Gssh_Shade_Engine::get_roof_transmission($venueId, $roofState);
        $attenuatedAmbientDli = $rawAmbientDli !== null ? round($rawAmbientDli * $roofTransmission, 1) : null;

        try {
            $calculator = new \Gssh_Rig_Placement_Calculator();
            $visualiser = new \Gssh_Rig_Placement_Visualiser();

            $result = $calculator->calculate_rig_requirements($venueId, [
                'rig_type' => $rigModel,
                'month' => $month,
                'hub_target_dli' => $request->filled('target_dli') ? (float) $request->input('target_dli') : null,
                'hub_ambient_dli' => $attenuatedAmbientDli,
                'variety' => trim((string) $request->input('variety', 'tiftuf')),
                'target_coverage_pct' => ($targetCoverage !== null && $targetCoverage !== '')
                    ? max(0, min(100, (float) $targetCoverage))
                    : null,
                'hub_temperature' => $request->filled('hub_temperature') ? (float) $request->input('hub_temperature') : null,
                'venue_environment' => $this->sanitizeVenueEnvironment($request->input('venue_environment', [])),
            ]);

            $html = $visualiser->generate_complete_analysis_view($result);

            return $this->legacySuccess([
                'html' => $html,
                'venue_id' => $venueId,
                'rig_model' => $rigModel,
                'eue' => $result['eue'] ?? null,
                'venue_readiness' => $result['venue_readiness'] ?? null,
                'summary' => $result['summary'] ?? null,
                'dli_context' => [
                    'analysis_month' => $result['analysis_month'] ?? $month,
                    'analysis_month_name' => $result['analysis_month_name'] ?? date('F', mktime(0, 0, 0, $month, 1)),
                    'target_dli' => $request->filled('target_dli') ? (float) $request->input('target_dli') : ($result['target_dli'] ?? null),
                    'ambient_dli' => $attenuatedAmbientDli
                        ?? ($result['shade_analysis']['ambient_dli'] ?? ($result['deficit_zones']['ambient_dli'] ?? null)),
                    'total_deficit_area' => $result['deficit_zones']['total_deficit_area'] ?? null,
                    'variety' => trim((string) $request->input('variety', (string) ($result['variety'] ?? ''))),
                    'strategy' => $result['placements']['strategy'] ?? ($result['summary']['strategy'] ?? null),
                ],
            ]);
        } catch (\Throwable $e) {
            return $this->legacyError($e->getMessage());
        }
    }

    public function seasonalPlan(Request $request): JsonResponse
    {
        GilbaRuntimeBootstrap::loadStadiumClasses();

        $venueId = trim((string) $request->input('venue_id', ''));
        $rigModel = trim((string) $request->input('rig_model', 'SGL_MU460'));
        $currency = trim((string) $request->input('currency', 'AUD'));
        $kwhRate = (float) $request->input('kwh_rate', 0.30);

        $this->forwardHubClimateData($request);

        if ($venueId === '') {
            return $this->legacyError('No venue specified');
        }

        $stadium = \Gssh_Stadium_Database::get_stadium($venueId);
        if (! $stadium) {
            return $this->legacyError('Venue not found');
        }

        try {
            $calculator = new \Gssh_Rig_Placement_Calculator();
            $visualiser = new \Gssh_Rig_Placement_Visualiser();

            $result = $calculator->calculate_seasonal_requirements($venueId, [
                'rig_type' => $rigModel,
                'currency' => $currency,
                'elec_rate' => $kwhRate,
            ]);

            $html = $visualiser->generate_seasonal_analysis_view($result);

            $monthlyExport = [];
            foreach (($result['monthly_analysis'] ?? []) as $monthNum => $monthData) {
                $costData = $result['cost_analysis']['monthly_costs'][$monthNum] ?? null;
                $monthlyExport[] = [
                    'month' => (int) $monthNum,
                    'month_name' => $monthData['month_name'] ?? '',
                    'rigs_required' => $monthData['rigs_required'] ?? 0,
                    'hours_per_day' => $monthData['rig_hours_per_day'] ?? 0,
                    'ambient_dli' => $monthData['ambient_dli'] ?? null,
                    'target_dli' => $monthData['target_dli'] ?? null,
                    'kwh' => $costData['kwh'] ?? null,
                    'cost' => $costData['cost'] ?? null,
                    'cost_formatted' => $costData['cost_formatted'] ?? null,
                ];
            }

            $cost = $result['cost_analysis'] ?? [];

            return $this->legacySuccess([
                'html' => $html,
                'venue_id' => $venueId,
                'rig_model' => $rigModel,
                'currency' => $currency,
                'kwh_rate' => $kwhRate,
                'months' => $monthlyExport,
                'annual' => [
                    'total_kwh' => $cost['total_kwh'] ?? null,
                    'total_cost' => $cost['total_cost'] ?? null,
                    'total_formatted' => $cost['total_formatted'] ?? null,
                    'power_kw' => $cost['power_kw'] ?? null,
                ],
                'summary' => $result['seasonal_summary'] ?? null,
            ]);
        } catch (\Throwable $e) {
            return $this->legacyError($e->getMessage());
        }
    }

    private function forwardHubClimateData(Request $request): void
    {
        if ($request->filled('hub_dli') && is_numeric($request->input('hub_dli'))) {
            $GLOBALS['gssh_hub_dli'] = (float) $request->input('hub_dli');
        }
        if ($request->filled('hub_ghi') && is_numeric($request->input('hub_ghi'))) {
            $GLOBALS['gssh_hub_ghi'] = (float) $request->input('hub_ghi');
        }
        if ($request->filled('hub_temperature') && is_numeric($request->input('hub_temperature'))) {
            $GLOBALS['gssh_hub_temperature'] = (float) $request->input('hub_temperature');
        }
    }

    private function sanitizeVenueEnvironment(mixed $raw): array
    {
        if (! is_array($raw)) {
            return [];
        }

        $keyMap = [
            'enclosureType' => 'enclosure_type',
            'drainageRating' => 'drainage_rating',
            'hocMM' => 'hoc_mm',
            'managementGoal' => 'management_goal',
            'hasFans' => 'has_fans',
            'estimatedAirflowMs' => 'estimated_airflow_ms',
            'co2Management' => 'co2_management',
            'co2ppm' => 'co2_ppm',
            'hasSubSoilHeating' => 'has_sub_soil_heating',
            'irrigationAdjustedForLED' => 'irrigation_adjusted_for_led',
            'humidityPct' => 'humidity_pct',
            'soilMoisturePct' => 'soil_moisture_pct',
        ];

        $allowed = array_values($keyMap);
        $sanitized = [];

        foreach ($raw as $key => $value) {
            $key = $this->sanitizeText($key);
            $normalized = $keyMap[$key] ?? $key;

            if (! in_array($normalized, $allowed, true) && ! array_key_exists($normalized, $keyMap)) {
                continue;
            }

            $sanitized[$normalized] = $this->sanitizeText($value);
        }

        return $sanitized;
    }

    private function sanitizeText(mixed $value): string
    {
        if (is_array($value) || is_object($value)) {
            return '';
        }

        $value = strip_tags((string) $value);
        $value = preg_replace('/[\r\n\t ]+/', ' ', $value) ?? $value;

        return trim($value);
    }

    private function legacySuccess(array $data): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => $data,
        ]);
    }

    private function legacyError(string $message, array $extra = []): JsonResponse
    {
        return response()->json([
            'success' => false,
            'data' => array_merge(['message' => $message], $extra),
        ]);
    }
}
