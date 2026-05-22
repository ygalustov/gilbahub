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
            'client_uid' => ['nullable', 'string', 'max:191'],
            'lab_name' => ['nullable', 'string', 'max:128'],
            'lab_ref' => ['nullable', 'string', 'max:64'],
            'sample_date' => ['nullable', 'date'],
            'lab_date' => ['nullable', 'date'],
            'depth_mm' => ['nullable', 'integer', 'min:0', 'max:5000'],
            'payload' => ['present', 'array'],
            'notes' => ['nullable', 'string'],
        ]);

        $site = Site::query()->findOrFail($data['site_id']);
        $this->abortUnlessMember($request, $site);

        $account = $site->account;
        abort_unless($account, 422, 'Site account is missing.');

        $sample = DB::transaction(function () use ($request, $site, $account, $data) {
            return $this->saveSampleRecord(
                $site,
                $account->id,
                $request->user()->id,
                $data['sample_type'],
                $data['client_uid'] ?? null,
                $data['payload'],
                [
                    'lab_name' => $data['lab_name'] ?? '',
                    'lab_ref' => $data['lab_ref'] ?? '',
                    'sample_date' => $data['sample_date'] ?? null,
                    'lab_date' => $data['lab_date'] ?? null,
                    'depth_mm' => $data['depth_mm'] ?? null,
                    'notes' => $data['notes'] ?? null,
                ]
            )->fresh(['site']);
        });

        return response()->json([
            'data' => $this->samplePayload($sample),
        ], 201);
    }

    public function sync(Request $request): JsonResponse
    {
        $data = $request->validate([
            'allSites' => ['required', 'array'],
        ]);

        $user = $request->user();
        $siteIds = $user->sites()->pluck('sites.id')->all();
        $synced = 0;
        $deleted = 0;

        DB::transaction(function () use ($data, $siteIds, $user, &$synced, &$deleted) {
            foreach ($data['allSites'] as $siteId => $siteData) {
                if (! is_string($siteId) || ! in_array($siteId, $siteIds, true) || ! is_array($siteData)) {
                    continue;
                }

                $site = Site::query()->with('account')->find($siteId);
                if (! $site || ! $site->account) {
                    continue;
                }

                foreach (self::VALID_TYPES as $sampleType) {
                    if (! array_key_exists($sampleType, $siteData) || ! is_array($siteData[$sampleType])) {
                        continue;
                    }

                    $clientUids = [];

                    foreach ($siteData[$sampleType] as $sampleKey => $sampleData) {
                        if (! is_array($sampleData)) {
                            continue;
                        }

                        $payload = $sampleData['rawData'] ?? [];
                        if (! is_array($payload) || empty($payload)) {
                            continue;
                        }

                        $clientUid = (string) ($sampleData['id'] ?? $sampleKey ?? '');
                        if ($clientUid === '') {
                            continue;
                        }

                        $clientUids[] = $clientUid;

                        $this->saveSampleRecord(
                            $site,
                            $site->account_id,
                            $user->id,
                            $sampleType,
                            $clientUid,
                            $payload,
                            [
                                'sample_date' => $sampleData['date'] ?? null,
                                'lab_date' => $sampleData['date'] ?? null,
                                'notes' => $sampleData['notes'] ?? null,
                                'lab_name' => $sampleData['labName'] ?? '',
                                'lab_ref' => $sampleData['labRef'] ?? '',
                                'depth_mm' => isset($payload['depth_mm']) && is_numeric($payload['depth_mm']) ? (int) $payload['depth_mm'] : null,
                            ]
                        );

                        $synced++;
                    }

                    $deleted += $this->reconcileMissingSnapshotSamples($site->id, $sampleType, $clientUids, $user->id);
                }
            }
        });

        return response()->json([
            'data' => [
                'synced' => $synced,
                'deleted' => $deleted,
            ],
        ]);
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

    private function saveSampleRecord(Site $site, int $accountId, int $userId, string $sampleType, ?string $clientUid, array $payload, array $meta): Sample
    {
        if ($clientUid !== null && $clientUid !== '') {
            $attributes = [
                'site_id' => $site->id,
                'sample_type' => $sampleType,
                'client_uid' => $clientUid,
            ];
            $sample = Sample::query()->withTrashed()->firstOrNew($attributes);
            if ($sample->trashed()) {
                $sample->restore();
            }
            if (! $sample->exists) {
                $sample->created_by_user_id = $userId;
            }
        } else {
            $sample = new Sample();
            $sample->created_by_user_id = $userId;
        }

        $sample->fill([
            'account_id' => $accountId,
            'site_id' => $site->id,
            'sample_type' => $sampleType,
            'client_uid' => $clientUid,
            'lab_name' => $meta['lab_name'] ?? '',
            'lab_ref' => $meta['lab_ref'] ?? '',
            'sample_date' => $meta['sample_date'] ?? null,
            'lab_date' => $meta['lab_date'] ?? null,
            'depth_mm' => $meta['depth_mm'] ?? null,
            'methodology_snapshot' => $site->methodology_override ?: $site->account->methodology,
            'soil_texture_snapshot' => $site->soil_texture_override ?: $site->account->soil_texture,
            'payload' => $payload,
            'notes' => $meta['notes'] ?? null,
            'modified_by_user_id' => $userId,
        ]);
        $sample->save();

        $labDate = $sample->lab_date?->toDateString() ?? $sample->sample_date?->toDateString() ?? now()->toDateString();

        $summary = SiteSummary::query()->withTrashed()->firstOrNew([
            'site_id' => $site->id,
            'sample_type' => $sample->sample_type,
            'lab_date' => $labDate,
        ]);

        if ($summary->trashed()) {
            $summary->restore();
        }

        $summary->fill([
            'account_id' => $accountId,
            'methodology_snapshot' => $sample->methodology_snapshot,
            'summary' => $this->buildSummaryPayload($sample, $site),
            'source_sample_id' => $sample->id,
            'modified_by_user_id' => $userId,
        ]);

        if (! $summary->exists) {
            $summary->created_by_user_id = $userId;
        }

        $summary->save();

        $this->trimSiteSummaryRing($site->id, $sample->sample_type);

        return $sample;
    }

    private function reconcileMissingSnapshotSamples(string $siteId, string $sampleType, array $clientUids, int $userId): int
    {
        $clientUids = array_values(array_unique(array_filter($clientUids, fn ($value) => is_string($value) && $value !== '')));

        $query = Sample::query()
            ->where('site_id', $siteId)
            ->where('sample_type', $sampleType)
            ->whereNotNull('client_uid');

        if ($clientUids !== []) {
            $query->whereNotIn('client_uid', $clientUids);
        }

        $sampleIds = $query->pluck('id');
        if ($sampleIds->isEmpty()) {
            return 0;
        }

        Sample::query()->whereKey($sampleIds)->update([
            'modified_by_user_id' => $userId,
            'updated_at' => now(),
        ]);

        SiteSummary::query()->whereIn('source_sample_id', $sampleIds)->delete();
        Sample::query()->whereKey($sampleIds)->delete();

        return $sampleIds->count();
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
            'client_uid' => $sample->client_uid,
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
            'client_uid' => $sample->client_uid,
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
