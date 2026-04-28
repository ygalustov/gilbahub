<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class MediaUploadController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'file' => ['required', 'file', 'image', 'max:10240'],
            'title' => ['nullable', 'string', 'max:255'],
        ]);

        $file = $data['file'];
        $path = $file->store('field-log-uploads', 'local');
        $title = $data['title'] ?? pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME);

        $id = DB::table('media_uploads')->insertGetId([
            'user_id' => $request->user()->id,
            'disk' => 'local',
            'path' => $path,
            'title' => $title,
            'original_name' => $file->getClientOriginalName(),
            'mime_type' => $file->getMimeType() ?? 'application/octet-stream',
            'size' => $file->getSize() ?? 0,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json([
            'id' => $id,
            'title' => ['rendered' => $title],
            'source_url' => route('api.media.show', ['mediaUpload' => $id]),
        ], 201);
    }

    public function show(Request $request, int $mediaUpload): mixed
    {
        $media = DB::table('media_uploads')->where('id', $mediaUpload)->first();

        abort_unless($media && (int) $media->user_id === (int) $request->user()->id, 404);

        return Storage::disk($media->disk)->response(
            $media->path,
            $media->original_name,
            ['Content-Type' => $media->mime_type]
        );
    }
}
