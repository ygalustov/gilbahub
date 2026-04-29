<?php

namespace App\Http\Controllers;

use App\Models\Sample;
use App\Models\Site;
use App\Models\SiteSummary;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class SampleController extends Controller
{
    private const VALID_TYPES = ['soil', 'water', 'tissue', 'loi'];
    private const SUMMARY_RING_LIMIT = 12;

    public function index(Request $request): JsonResponse
    {
        $data = $request->validate([
            'site_id' => ['nullable', 'string', 'exists:sites,id'],
            'sample_type' => ['nullable', Rule::in(self::VALID_TYPES)],
            'limit' => ['nullable', 'integer', 'min:1', 'max:200'],
        ]);

        $query = Sample::query()->with(['site'])
            ->whereIn('site_id', $request->user()->sites()->pluck('sites.id'))
            ->orderByDesc('lab_date')
            ->orderByDesc('id');

        if (! empty($data['site_id'])) {
            $query->where('site_id', $data['site_id']);
        }

        if (! empty($data['sample_type'])) {
            $query->where('sample_type', $data['sample_type']);
        }

        $samples = $query->limit($data['limit'] ?? 50)->get();

        return response()->json([
            'data' => $samples->map(fn (Sample $sample) => $this->samplePayload($sample))->values(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'site_id' => ['required', 'string', 'exists:sites,id'],
            'sample_type' => ['required', Rule::in(self::VALID_TYPES)],
            'lab_name' => ['nullable', 'string', 'max:128'],
            'lab_ref' => ['nullable', 'string', 'max:64'],
            'sample_date' => ['nullable', 'date'],
            'lab_date' => ['nullable', 'date'],
            'depth_mm' => ['nullable', 'integer', 'min:0', 'max:5000'],
            'payload' => ['required', 'array'],
            'notes' => ['nullable', 'string'],
        ]);

        $site = Site::query()->findOrFail($data['site_id']);
        $this->abortUnlessMember($request, $site);

        $account = $site->account;
        abort_unless($account, 422, 'Site account is missing.');

        $sample = DB::transaction(function () use ($request, $site, $account, $data) {
            $sample = Sample::query()->create([
                'account_id' => $account->id,
                'site_id' => $site->id,
                'sample_type' => $data['sample_type'],
                'lab_name' => $data['lab_name'] ?? '',
                'lab_ref' => $data['lab_ref'] ?? '',
                'sample_date' => $data['sample_date'] ?? null,
                'lab_date' => $data['lab_date'] ?? null,
                'depth_mm' => $data['depth_mm'] ?? null,
                'methodology_snapshot' => $site->methodology_override ?: $account->methodology,
                'soil_texture_snapshot' => $site->soil_texture_override ?: $account->soil_texture,
                'payload' => $data['payload'],
                'notes' => $data['notes'] ?? null,
                'created_by_user_id' => $request->user()->id,
                'modified_by_user_id' => $request->user()->id,
            ]);

            $labDate = $sample->lab_date?->toDateString() ?? $sample->sample_date?->toDateString() ?? now()->toDateString();

            SiteSummary::query()->updateOrCreate(
                [
                    'site_id' => $site->id,
                    'sample_type' => $sample->sample_type,
                    'lab_date' => $labDate,
                ],
                [
                    'account_id' => $account->id,
                    'methodology_snapshot' => $sample->methodology_snapshot,
                    'summary' => $this->buildSummaryPayload($sample, $site),
                    'source_sample_id' => $sample->id,
                    'created_by_user_id' => $request->user()->id,
                    'modified_by_user_id' => $request->user()->id,
                ]
            );

            $this->trimSiteSummaryRing($site->id, $sample->sample_type);

            return $sample->fresh(['site']);
        });

        return response()->json([
            'data' => $this->samplePayload($sample),
        ], 201);
    }

    public function show(Request $request, Sample $sample): JsonResponse
    {
        $sample->load('site');
        $this->abortUnlessMember($request, $sample->site);

        return response()->json([
            'data' => $this->samplePayload($sample),
        ]);
    }

    public function listSummaries(Request $request): JsonResponse
    {
        $data = $request->validate([
            'site_id' => ['required', 'string', 'exists:sites,id'],
            'sample_type' => ['nullable', Rule::in(self::VALID_TYPES)],
        ]);

        $site = Site::query()->findOrFail($data['site_id']);
        $this->abortUnlessMember($request, $site);

        $query = SiteSummary::query()
            ->where('site_id', $site->id)
            ->orderByDesc('lab_date')
            ->orderByDesc('id');

        if (! empty($data['sample_type'])) {
            $query->where('sample_type', $data['sample_type']);
        }

        $summaries = $query->get();

        return response()->json([
            'data' => $summaries->map(fn (SiteSummary $summary) => [
                'id' => $summary->id,
                'site_id' => $summary->site_id,
                'sample_type' => $summary->sample_type,
                'lab_date' => $summary->lab_date?->toDateString(),
                'methodology_snapshot' => $summary->methodology_snapshot,
                'source_sample_id' => $summary->source_sample_id,
                'summary' => $summary->summary ?? [],
            ])->values(),
        ]);
    }

    private function abortUnlessMember(Request $request, Site $site): void
    {
        abort_unless(
            $site->users()->where('users.id', $request->user()->id)->exists(),
            404
        );
    }

    private function samplePayload(Sample $sample): array
    {
        return [
            'id' => $sample->id,
            'account_id' => $sample->account_id,
            'site_id' => $sample->site_id,
            'sample_type' => $sample->sample_type,
            'lab_name' => $sample->lab_name,
            'lab_ref' => $sample->lab_ref,
            'sample_date' => $sample->sample_date?->toDateString(),
            'lab_date' => $sample->lab_date?->toDateString(),
            'depth_mm' => $sample->depth_mm,
            'methodology_snapshot' => $sample->methodology_snapshot,
            'soil_texture_snapshot' => $sample->soil_texture_snapshot,
            'notes' => $sample->notes,
            'payload' => $sample->payload ?? [],
        ];
    }

    private function buildSummaryPayload(Sample $sample, Site $site): array
    {
        $payload = $sample->payload ?? [];

        return [
            'sample_id' => $sample->id,
            'site_name' => $site->name,
            'sample_type' => $sample->sample_type,
            'lab_name' => $sample->lab_name,
            'lab_ref' => $sample->lab_ref,
            'sample_date' => $sample->sample_date?->toDateString(),
            'lab_date' => $sample->lab_date?->toDateString(),
            'depth_mm' => $sample->depth_mm,
            'label' => $payload['label'] ?? null,
            'zone' => $payload['zone'] ?? null,
            'payload' => $payload,
        ];
    }

    private function trimSiteSummaryRing(string $siteId, string $sampleType): void
    {
        $keepIds = SiteSummary::query()
            ->where('site_id', $siteId)
            ->where('sample_type', $sampleType)
            ->orderByDesc('lab_date')
            ->orderByDesc('id')
            ->limit(self::SUMMARY_RING_LIMIT)
            ->pluck('id');

        if ($keepIds->isEmpty()) {
            return;
        }

        SiteSummary::query()
            ->where('site_id', $siteId)
            ->where('sample_type', $sampleType)
            ->whereNotIn('id', $keepIds)
            ->delete();
    }
}
