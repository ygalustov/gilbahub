<?php

namespace App\Http\Controllers;

use App\Models\Site;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SprayLogController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'site_id' => ['required', 'integer', 'exists:sites,id'],
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
