<?php

namespace App\Http\Controllers;

use App\Models\Sample;
use App\Models\SiteConfig;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SampleAnalysisController extends Controller
{
    private const MLSN_DEFAULTS = [
        'K'  => 37,   'P'  => 6,   'Ca' => 331, 'Mg' => 47,
        'S'  => 6,    'Fe' => 49,  'Mn' => 5,   'Zn' => 2.2,
        'Cu' => 0.9,  'B'  => 0.5,
    ];

    private const UNUSUAL_RANGES = [
        'K'  => [5,   800],  'P'  => [1,   200],  'Ca' => [50,  4000],
        'Mg' => [10,  800],  'S'  => [1,   300],  'Fe' => [5,   600],
        'Mn' => [1,   500],  'Zn' => [0.5, 50],   'Cu' => [0.1, 30],
        'B'  => [0.1, 10],
    ];

    public function run(Request $request, Sample $sample): JsonResponse
    {
        abort_unless($request->user()->canViewSite($sample->site), 403);

        $payload = $sample->payload ?? [];

        $config   = SiteConfig::where('site_id', $sample->site_id)->where('namespace', 'gaip')->first();
        $cachedSn = data_get($config?->config ?? [], 'computed.soilNutrition', []);

        $thresholds = $this->buildThresholdMap($cachedSn);
        $nutrients  = $this->computeNutrients($payload, $thresholds, $cachedSn);

        $statuses = array_column($nutrients, 'statusClass');
        $verdict  = in_array('deficient', $statuses)
            ? 'HIGH_RISK'
            : (in_array('borderline', $statuses) ? 'MONITOR' : (count($nutrients) ? 'ACCEPTABLE' : 'NO_DATA'));

        $validation = $this->validatePayload($payload);

        $sn = array_merge($cachedSn, [
            'nutrients'   => $nutrients,
            'verdict'     => $verdict,
            'ratios'      => null,
            'sampleDate'  => $sample->lab_date?->toDateString() ?? $sample->sample_date?->toDateString(),
            'sampleLabel' => $sample->client_uid,
            'pH'          => $payload['pH_Water'] ?? $payload['pH'] ?? $payload['ph'] ?? ($cachedSn['pH'] ?? null),
            'ECe'         => $payload['ECe'] ?? $payload['EC_paste'] ?? $this->computeEce($payload) ?? ($cachedSn['ECe'] ?? null),
            'soilNa'      => (($v = (float)($payload['Na'] ?? $payload['Na_ppm'] ?? 0)) > 0 ? $v : null) ?? ($cachedSn['soilNa'] ?? null),
            'CEC'         => $payload['CEC'] ?? $payload['cec'] ?? ($cachedSn['CEC'] ?? null),
            'validation'  => ($validation['errors'] || $validation['warnings']) ? $validation : null,
        ]);

        $site = $sample->site;
        $lat  = $site->latitude  !== null ? (float) $site->latitude  : null;
        $lon  = $site->longitude !== null ? (float) $site->longitude : null;
        // Fall back to coordinates stored in gaip config if not on the site model
        if ($lat === null) $lat = isset($config?->config['location']['lat']) ? (float) $config->config['location']['lat'] : null;
        if ($lon === null) $lon = isset($config?->config['location']['lon']) ? (float) $config->config['location']['lon'] : null;
        $sn['methodology'] = self::effectiveMethodology($sn['methodology'] ?? null, $lat, $lon);

        return response()->json(['data' => $sn]);
    }

    private function buildThresholdMap(array $cachedSn): array
    {
        $thresholds = self::MLSN_DEFAULTS;

        foreach (data_get($cachedSn, 'nutrients', []) as $n) {
            $nut  = $n['nutrient'] ?? null;
            $mlsn = isset($n['mlsn']) ? floatval($n['mlsn']) : null;
            if ($nut && $mlsn > 0) {
                $thresholds[$nut] = $mlsn;
            }
        }

        return $thresholds;
    }

    private function computeNutrients(array $payload, array $thresholds, array $cachedSn): array
    {
        $cachedNutrients = data_get($cachedSn, 'nutrients', []);

        if (empty($cachedNutrients)) {
            $cachedNutrients = array_map(
                fn ($nut) => ['nutrient' => $nut, 'mlsn' => self::MLSN_DEFAULTS[$nut]],
                array_keys(array_intersect_key($payload, self::MLSN_DEFAULTS))
            );
        }

        return array_values(array_map(function (array $n) use ($payload, $thresholds) {
            $nut    = $n['nutrient'];
            $mlsn   = $thresholds[$nut] ?? floatval($n['mlsn'] ?? 0);
            $raw    = $payload[$nut] ?? null;
            $actual = $raw !== null ? floatval($raw) : null;

            if ($actual === null) {
                return array_merge($n, ['actual' => null, 'status' => 'No data', 'statusClass' => 'no-data']);
            }

            if ($mlsn > 0) {
                if ($actual < $mlsn)           { $status = 'Deficient';  $sc = 'deficient'; }
                elseif ($actual < $mlsn * 1.2) { $status = 'Borderline'; $sc = 'borderline'; }
                else                           { $status = 'Adequate';   $sc = 'adequate'; }
            } else {
                $status = 'Adequate'; $sc = 'adequate';
            }

            return array_merge($n, [
                'actual'      => (string) $actual,
                'status'      => $status,
                'statusClass' => $sc,
                'mlsn'        => (string) $mlsn,
            ]);
        }, $cachedNutrients));
    }

    private function computeEce(array $payload): ?float
    {
        // All EC 1:5 key variants seen across import paths and SampleManager normalisation
        $ec15 = (float)(
            $payload['EC']      ?? $payload['ec']     ??
            $payload['EC1_5']   ?? $payload['EC_1_5'] ??
            $payload['EC1:5']   ?? $payload['EC_1:5'] ??
            $payload['EC_dSm']  ?? 0
        );
        if ($ec15 <= 0) return null;
        $multipliers = [
            'sand' => 5, 'loamy_sand' => 5.5, 'sandy_loam' => 6,
            'loam' => 7, 'clay_loam' => 8, 'clay' => 10,
        ];
        $tex = strtolower((string)($payload['Texture'] ?? $payload['texture'] ?? 'loam'));
        return round($ec15 * ($multipliers[$tex] ?? 7), 3);
    }

    private function validatePayload(array $payload): array
    {
        $warnings = [];

        foreach (self::UNUSUAL_RANGES as $nut => [$min, $max]) {
            $val = isset($payload[$nut]) ? floatval($payload[$nut]) : null;
            if ($val !== null && ($val < $min || $val > $max)) {
                $warnings[] = "{$nut} value {$val} ppm is outside the typical range ({$min}–{$max} ppm) — verify data entry.";
            }
        }

        return ['errors' => [], 'warnings' => $warnings];
    }
}
