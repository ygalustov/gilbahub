<?php

namespace App\Http\Controllers;

use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class BenchmarkController extends Controller
{
    public function show(Request $request, string $siteIdentifier): JsonResponse
    {
        $data = $request->validate([
            'module' => ['nullable', 'string', 'max:32'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:500'],
            'days' => ['nullable', 'integer', 'min:1', 'max:3650'],
        ]);

        $limit = (int) ($data['limit'] ?? 200);
        $days = (int) ($data['days'] ?? 90);
        $module = trim((string) ($data['module'] ?? ''));
        $windowStart = now()->subDays($days);

        $outcomesQuery = DB::table('predictions')
            ->join('prediction_outcomes', 'prediction_outcomes.prediction_id', '=', 'predictions.id')
            ->where('predictions.user_id', $request->user()->id)
            ->where('predictions.site_identifier', $siteIdentifier)
            ->where('predictions.predicted_at', '>=', $windowStart)
            ->orderByDesc('predictions.predicted_at')
            ->limit($limit);

        $pendingQuery = DB::table('predictions')
            ->leftJoin('prediction_outcomes', 'prediction_outcomes.prediction_id', '=', 'predictions.id')
            ->where('predictions.user_id', $request->user()->id)
            ->where('predictions.site_identifier', $siteIdentifier)
            ->where('predictions.status', 'pending')
            ->whereNull('prediction_outcomes.id')
            ->where('predictions.predicted_at', '>=', $windowStart)
            ->orderByDesc('predictions.predicted_at')
            ->limit($limit);

        if ($module !== '' && strtolower($module) !== 'all') {
            $outcomesQuery->where('predictions.module', $module);
            $pendingQuery->where('predictions.module', $module);
        }

        $outcomes = $outcomesQuery->get([
            'predictions.sub_key',
            'predictions.predicted_at',
            'predictions.predicted_value',
            'prediction_outcomes.qualitative',
        ])->map(fn (object $row): array => [
            'sub_key' => (string) $row->sub_key,
            'predicted_at' => $row->predicted_at ? Carbon::parse($row->predicted_at)->toISOString() : null,
            'predicted_value' => $this->normalisePredictedValue($row->predicted_value),
            'qualitative' => (string) $row->qualitative,
        ])->values();

        $pending = $pendingQuery->get([
            'predictions.sub_key',
            'predictions.predicted_at',
            'predictions.predicted_value',
            'predictions.status',
        ])->map(fn (object $row): array => [
            'sub_key' => (string) $row->sub_key,
            'predicted_at' => $row->predicted_at ? Carbon::parse($row->predicted_at)->toISOString() : null,
            'predicted_value' => $this->normalisePredictedValue($row->predicted_value),
            'status' => (string) $row->status,
        ])->values();

        return response()->json([
            'success' => true,
            'outcomes' => $outcomes->all(),
            'pending' => $pending->all(),
            'accuracy' => $this->buildAccuracy($outcomes),
            'counts' => [
                'outcomes' => $outcomes->count(),
                'pending' => $pending->count(),
            ],
        ]);
    }

    /**
     * @param Collection<int, array{sub_key:string,predicted_at:?string,predicted_value:mixed,qualitative:string}> $outcomes
     * @return array<string, array{total:int,as_expected:int,better:int,worse:int,accuracy_pct:int}>
     */
    private function buildAccuracy(Collection $outcomes): array
    {
        $accuracy = [];

        foreach ($outcomes->groupBy('sub_key') as $subKey => $rows) {
            $total = $rows->count();
            $asExpected = $rows->where('qualitative', 'as_expected')->count();
            $better = $rows->where('qualitative', 'better_than_expected')->count();
            $worse = $rows->where('qualitative', 'worse_than_expected')->count();

            $accuracy[(string) $subKey] = [
                'total' => $total,
                'as_expected' => $asExpected,
                'better' => $better,
                'worse' => $worse,
                'accuracy_pct' => $total > 0 ? (int) round((($asExpected + $better) / $total) * 100) : 0,
            ];
        }

        return $accuracy;
    }

    private function normalisePredictedValue(mixed $raw): ?string
    {
        if ($raw === null || $raw === '') {
            return null;
        }

        $decoded = json_decode((string) $raw, true);
        if (json_last_error() === JSON_ERROR_NONE) {
            if (is_numeric($decoded)) {
                return number_format((float) $decoded, 3, '.', '');
            }

            if (is_array($decoded) && isset($decoded['value']) && is_numeric($decoded['value'])) {
                return number_format((float) $decoded['value'], 3, '.', '');
            }
        }

        if (is_numeric($raw)) {
            return number_format((float) $raw, 3, '.', '');
        }

        return null;
    }
}
