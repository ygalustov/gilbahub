<?php

namespace App\Http\Controllers;

use App\Models\Site;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SprayLogController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $data = $request->validate([
            'site_id' => ['required', 'string', 'exists:sites,id'],
            'date_from' => ['nullable', 'date'],
            'date_to' => ['nullable', 'date'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:500'],
        ]);

        $site = Site::query()->findOrFail($data['site_id']);

        abort_unless(
            $site->users()->where('users.id', $request->user()->id)->exists(),
            404
        );

        $query = DB::table('spray_logs')
            ->where('site_id', $site->id)
            ->orderByDesc('event_date')
            ->orderByDesc('id');

        if (! empty($data['date_from'])) {
            $query->whereDate('event_date', '>=', $data['date_from']);
        }

        if (! empty($data['date_to'])) {
            $query->whereDate('event_date', '<=', $data['date_to']);
        }

        $rows = $query
            ->limit((int) ($data['limit'] ?? 200))
            ->get();

        $entries = $rows->map(function (object $row): array {
            return [
                'log_id' => (int) $row->id,
                'site_id' => (string) $row->site_id,
                'zone' => $row->zone,
                'application_date' => $row->event_date,
                'product_name' => $row->product_name,
                'product_category' => $row->product_type,
                'active_ingredient' => null,
                'frac_group' => null,
                'rate' => $row->rate_value !== null ? (float) $row->rate_value : null,
                'rate_unit' => $row->rate_unit,
                'target' => $row->target,
                'notes' => $row->notes,
                'source' => $row->source,
            ];
        })->values()->all();

        return response()->json([
            'success' => true,
            'entries' => $entries,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'site_id' => ['required', 'string', 'exists:sites,id'],
            'zone' => ['required', 'string', 'max:80'],
            'application_date' => ['required', 'date'],
            'product_name' => ['required', 'string', 'max:255'],
            'product_category' => ['nullable', 'string', 'max:80'],
            'rate' => ['nullable', 'numeric'],
            'rate_unit' => ['nullable', 'string', 'max:40'],
            'target' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string'],
            'source' => ['nullable', 'string', 'max:40'],
        ]);

        $site = Site::query()->findOrFail($data['site_id']);

        abort_unless(
            $site->users()->where('users.id', $request->user()->id)->exists(),
            404
        );

        $id = DB::table('spray_logs')->insertGetId([
            'account_id' => $site->account_id,
            'site_id' => $site->id,
            'user_id' => $request->user()->id,
            'event_date' => $data['application_date'],
            'zone' => $data['zone'],
            'product_name' => $data['product_name'],
            'product_type' => $data['product_category'] ?? 'other',
            'rate_value' => $data['rate'],
            'rate_unit' => $data['rate_unit'],
            'target' => $data['target'],
            'notes' => $data['notes'],
            'source' => $data['source'] ?? 'manual',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json([
            'data' => [
                'id' => $id,
                'site_id' => $site->id,
                'user_id' => $request->user()->id,
                'zone' => $data['zone'],
                'application_date' => $data['application_date'],
                'product_name' => $data['product_name'],
                'product_category' => $data['product_category'] ?? 'other',
                'rate' => $data['rate'],
                'rate_unit' => $data['rate_unit'],
                'target' => $data['target'],
                'notes' => $data['notes'],
                'source' => $data['source'] ?? 'manual',
            ],
        ], 201);
    }
}
