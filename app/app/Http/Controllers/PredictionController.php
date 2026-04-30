<?php

namespace App\Http\Controllers;

use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PredictionController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'predictions' => ['required', 'array'],
        ]);

        $written = 0;
        $timestamp = now();

        foreach ($data['predictions'] as $prediction) {
            if (! is_array($prediction)) {
                continue;
            }

            $siteIdentifier = trim((string) ($prediction['site_id'] ?? ''));
            $module = trim((string) ($prediction['module'] ?? ''));

            if ($siteIdentifier === '' || $module === '') {
                continue;
            }

            DB::table('predictions')->insert([
                'user_id' => $request->user()->id,
                'site_identifier' => $siteIdentifier,
                'cascade_id' => $this->nullableString($prediction['cascade_id'] ?? null, 80),
                'module' => substr($module, 0, 32),
                'sub_key' => $this->nullableString($prediction['sub_key'] ?? null, 120) ?? '',
                'predicted_label' => $this->nullableString($prediction['predicted_label'] ?? null),
                'prediction_type' => $this->nullableString($prediction['prediction_type'] ?? null, 32) ?? 'numeric',
                'predicted_value' => $this->encodeJson($prediction['predicted_value'] ?? null),
                'predicted_category' => $this->nullableString($prediction['predicted_category'] ?? null, 80),
                'confidence' => $this->nullableNumeric($prediction['confidence'] ?? null),
                'predicted_at' => $this->nullableTimestamp($prediction['predicted_at'] ?? null) ?? $timestamp,
                'outcome_window_start' => $this->nullableTimestamp($prediction['outcome_window_start'] ?? null),
                'outcome_window_end' => $this->nullableTimestamp($prediction['outcome_window_end'] ?? null),
                'input_snapshot' => $this->encodeJson($prediction['input_snapshot'] ?? null),
                'status' => 'pending',
                'created_at' => $timestamp,
                'updated_at' => $timestamp,
            ]);

            $written++;
        }

        return response()->json([
            'success' => true,
            'written' => $written,
        ], 201);
    }

    public function pending(Request $request, string $siteIdentifier): JsonResponse
    {
        $pending = DB::table('predictions')
            ->leftJoin('prediction_outcomes', 'prediction_outcomes.prediction_id', '=', 'predictions.id')
            ->where('predictions.user_id', $request->user()->id)
            ->where('predictions.site_identifier', $siteIdentifier)
            ->where('predictions.status', 'pending')
            ->whereNull('prediction_outcomes.id')
            ->orderByDesc('predictions.predicted_at')
            ->limit(250)
            ->get([
                'predictions.id',
                'predictions.module',
                'predictions.sub_key',
                'predictions.predicted_label',
                'predictions.prediction_type',
                'predictions.predicted_value',
                'predictions.predicted_category',
                'predictions.confidence',
                'predictions.predicted_at',
                'predictions.outcome_window_start',
                'predictions.outcome_window_end',
            ])
            ->map(function (object $row): array {
                return [
                    'id' => (int) $row->id,
                    'module' => (string) $row->module,
                    'sub_key' => (string) $row->sub_key,
                    'predicted_label' => $row->predicted_label,
                    'prediction_type' => (string) $row->prediction_type,
                    'predicted_value' => $this->decodeJson($row->predicted_value),
                    'predicted_category' => $row->predicted_category,
                    'confidence' => $row->confidence !== null ? (float) $row->confidence : null,
                    'predicted_at' => $row->predicted_at ? Carbon::parse($row->predicted_at)->toISOString() : null,
                    'outcome_window_start' => $row->outcome_window_start ? Carbon::parse($row->outcome_window_start)->toISOString() : null,
                    'outcome_window_end' => $row->outcome_window_end ? Carbon::parse($row->outcome_window_end)->toISOString() : null,
                ];
            })
            ->values()
            ->all();

        return response()->json([
            'count' => count($pending),
            'pending' => $pending,
        ]);
    }

    public function storeOutcome(Request $request): JsonResponse
    {
        $data = $request->validate([
            'prediction_id' => ['required', 'integer'],
            'qualitative' => ['required', 'string', 'max:40'],
            'action_taken' => ['nullable', 'string', 'max:40'],
            'action_notes' => ['nullable', 'string'],
            'observed_at' => ['nullable', 'date'],
        ]);

        $prediction = DB::table('predictions')
            ->where('id', $data['prediction_id'])
            ->where('user_id', $request->user()->id)
            ->first();

        abort_unless($prediction, 404);

        $existing = DB::table('prediction_outcomes')
            ->where('prediction_id', $data['prediction_id'])
            ->exists();

        if ($existing) {
            return response()->json([
                'error' => 'Outcome already captured',
            ], 409);
        }

        $timestamp = now();

        DB::table('prediction_outcomes')->insert([
            'prediction_id' => $data['prediction_id'],
            'user_id' => $request->user()->id,
            'qualitative' => $data['qualitative'],
            'action_taken' => $this->nullableString($data['action_taken'] ?? null, 40),
            'action_notes' => $this->nullableString($data['action_notes'] ?? null),
            'observed_at' => $this->nullableTimestamp($data['observed_at'] ?? null) ?? $timestamp,
            'payload' => $this->encodeJson([
                'qualitative' => $data['qualitative'],
                'action_taken' => $data['action_taken'] ?? null,
                'action_notes' => $data['action_notes'] ?? null,
            ]),
            'created_at' => $timestamp,
            'updated_at' => $timestamp,
        ]);

        DB::table('predictions')
            ->where('id', $data['prediction_id'])
            ->update([
                'status' => 'resolved',
                'resolved_at' => $timestamp,
                'updated_at' => $timestamp,
            ]);

        return response()->json([
            'success' => true,
        ], 201);
    }

    private function nullableString(mixed $value, int $maxLength = 65535): ?string
    {
        if ($value === null) {
            return null;
        }

        $text = trim((string) $value);

        if ($text === '') {
            return null;
        }

        return mb_substr($text, 0, $maxLength);
    }

    private function nullableNumeric(mixed $value): ?float
    {
        return is_numeric($value) ? (float) $value : null;
    }

    private function nullableTimestamp(mixed $value): ?Carbon
    {
        if ($value === null || $value === '') {
            return null;
        }

        try {
            return Carbon::parse((string) $value);
        } catch (\Throwable) {
            return null;
        }
    }

    private function encodeJson(mixed $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        return json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }

    private function decodeJson(mixed $value): mixed
    {
        if ($value === null || $value === '') {
            return null;
        }

        $decoded = json_decode((string) $value, true);

        return json_last_error() === JSON_ERROR_NONE ? $decoded : $value;
    }
}
