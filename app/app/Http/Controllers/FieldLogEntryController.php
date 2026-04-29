<?php

namespace App\Http\Controllers;

use App\Models\Site;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class FieldLogEntryController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $data = $request->validate([
            'site_id' => ['required', 'string', 'exists:sites,id'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $site = Site::query()->findOrFail($data['site_id']);

        abort_unless(
            $site->users()->where('users.id', $request->user()->id)->exists(),
            404
        );

        $rows = DB::table('field_log_entries')
            ->where('site_id', $site->id)
            ->where('user_id', $request->user()->id)
            ->orderByDesc('observed_at')
            ->orderByDesc('id')
            ->limit((int) ($data['limit'] ?? 20))
            ->get();

        return response()->json([
            'data' => $rows->map(function ($row) {
                $payload = json_decode($row->payload ?? '{}', true) ?: [];

                return [
                    'id' => (int) $row->id,
                    'client_uid' => $row->client_uid,
                    'site_id' => $row->site_id,
                    'user_id' => (int) $row->user_id,
                    'type' => $row->entry_type,
                    'zone' => $row->zone,
                    'observed_at' => $row->observed_at,
                    'created_at' => $row->created_at,
                    'data' => $payload['data'] ?? [],
                    'photo' => $payload['photo'] ?? null,
                    'media_upload_id' => $row->media_upload_id ? (int) $row->media_upload_id : null,
                    'synced' => true,
                ];
            })->values(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'client_uid' => ['required', 'string', 'max:64'],
            'site_id' => ['required', 'string', 'exists:sites,id'],
            'type' => ['required', 'string', 'in:spray,disease,tdr,mowing,note'],
            'zone' => ['nullable', 'string', 'max:80'],
            'observed_at' => ['nullable', 'date'],
            'data' => ['required', 'array'],
            'photo' => ['nullable', 'array'],
            'photo.attachmentId' => ['nullable', 'integer'],
            'photo.base64' => ['nullable', 'string'],
        ]);

        $site = Site::query()->findOrFail($data['site_id']);

        abort_unless(
            $site->users()->where('users.id', $request->user()->id)->exists(),
            404
        );

        $photo = $data['photo'] ?? null;
        $mediaUploadId = data_get($photo, 'attachmentId');

        if ($mediaUploadId) {
            abort_unless(
                DB::table('media_uploads')
                    ->where('id', $mediaUploadId)
                    ->where('user_id', $request->user()->id)
                    ->exists(),
                404
            );
        }

        $payload = [
            'data' => $data['data'],
            'photo' => $photo,
        ];

        $existing = DB::table('field_log_entries')
            ->where('user_id', $request->user()->id)
            ->where('client_uid', $data['client_uid'])
            ->first();

        $record = [
            'account_id' => $site->account_id,
            'site_id' => $site->id,
            'user_id' => $request->user()->id,
            'client_uid' => $data['client_uid'],
            'entry_type' => $data['type'],
            'zone' => $data['zone'] ?? null,
            'observed_at' => $data['observed_at'] ?? now(),
            'payload' => json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            'media_upload_id' => $mediaUploadId,
            'synced_at' => now(),
            'updated_at' => now(),
        ];

        if ($existing) {
            DB::table('field_log_entries')->where('id', $existing->id)->update($record);
            $id = (int) $existing->id;
        } else {
            $id = DB::table('field_log_entries')->insertGetId($record + ['created_at' => now()]);
        }

        return response()->json([
            'data' => [
                'id' => $id,
                'client_uid' => $data['client_uid'],
                'site_id' => $site->id,
                'user_id' => $request->user()->id,
                'type' => $data['type'],
                'zone' => $data['zone'] ?? null,
                'observed_at' => $data['observed_at'] ?? null,
                'media_upload_id' => $mediaUploadId,
                'photo' => $photo,
                'payload' => $payload,
            ],
        ], $existing ? 200 : 201);
    }
}
