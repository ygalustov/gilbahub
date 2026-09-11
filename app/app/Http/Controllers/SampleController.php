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

        $user = $request->user();
        $siteIds = $user->is_admin
            ? Site::pluck('id')
            : $user->sites()->pluck('sites.id');

        // GH-375: was orderByDesc('lab_date')->orderByDesc('id') -- sorting on the
        // raw, non-coalesced column. MySQL sorts NULLs last on DESC, so a sample
        // with only a sample_date (no lab_date) landed behind every sample that
        // has any lab_date, regardless of true chronological order -- diverging
        // from PageController::topbarData()'s own tissue-sample choice, which
        // orders by orderByRaw('COALESCE(lab_date, sample_date) DESC') (same
        // file, ~line 84). On a genuine tie (equal effective date) that mismatch
        // let this endpoint's array order disagree with topbarData()'s id-DESC
        // tiebreak, which site-selector-ui.js's GH-372 fallback (assets/
        // site-selector-ui.js reloadActiveSample()) then trusted for its own
        // tiebreak, since it compares this endpoint's pre-coalesced `.date`
        // field with strict `>` and falls back to array order otherwise. Sorting
        // here by the same coalesced expression topbarData() uses makes the
        // array order this endpoint returns, topbarData()'s own choice, and the
        // client-side comparison all follow one rule.
        $query = Sample::query()->with(['site'])
            ->whereIn('site_id', $siteIds)
            ->orderByRaw('COALESCE(lab_date, sample_date) DESC')
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
        abort_unless($request->user()->canEditSite($site), 403);

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

        $label = $data['payload']['_label'] ?? null;
        if ($label && in_array($data['sample_type'], ['soil', 'tissue', 'loi'], true)) {
            $this->mergeZoneNameIntoSite($site, $label);
        }

        return response()->json([
            'data' => $this->samplePayload($sample),
        ], 201);
    }

    public function sync(Request $request): JsonResponse
    {
        $data = $request->validate([
            'allSites'    => ['required', 'array'],
            'clearSiteData' => ['nullable', 'boolean'],
            'sourceFile'  => ['nullable', 'string', 'max:255'],
        ]);

        $clearSiteData = (bool) ($data['clearSiteData'] ?? false);
        $sourceFile    = isset($data['sourceFile']) ? (string) $data['sourceFile'] : null;

        $user = $request->user();
        $siteIds = $user->is_admin
            ? Site::pluck('id')->all()
            : $user->sites()->pluck('sites.id')->all();
        $synced = 0;
        $deleted = 0;
        $siteLabels = [];

        DB::transaction(function () use ($data, $siteIds, $user, $clearSiteData, $sourceFile, &$synced, &$deleted, &$siteLabels) {
            foreach ($data['allSites'] as $siteId => $siteData) {
                if (! is_string($siteId) || ! in_array($siteId, $siteIds, true) || ! is_array($siteData)) {
                    continue;
                }

                $site = Site::query()->with('account')->find($siteId);
                if (! $site || ! $site->account) {
                    continue;
                }

                if ($clearSiteData) {
                    DB::table('spray_logs')->where('site_id', $siteId)->delete();
                    DB::table('field_log_entries')->where('site_id', $siteId)->delete();
                    $sampleIdsToDelete = Sample::query()
                        ->where('site_id', $siteId)
                        ->pluck('id');
                    if ($sampleIdsToDelete->isNotEmpty()) {
                        SiteSummary::query()->whereIn('source_sample_id', $sampleIdsToDelete)->delete();
                        Sample::query()->whereKey($sampleIdsToDelete)->delete();
                        $deleted += $sampleIdsToDelete->count();
                    }
                }

                // GH-430: this loop upserts what the push contains and deletes
                // nothing. It used to end with reconcileMissingSnapshotSamples(),
                // which soft-deleted every sample of this (site, sample_type)
                // that the push did not name -- treating the request as "here is
                // my complete picture, make the database match". The push is
                // never the complete picture: samples restored from the server
                // carry `values` and the loop below reads only `rawData`, so a
                // tab that has just added one sample sends a keep-list of one,
                // and one ordinary Capture, edit or lab import destroyed the
                // rest of the site. Reproduced on the dev stack as
                // `synced: 1, deleted: 6`; 87 of 147 rows already bore the mark.
                // Consequence, accepted until per-record writes land: deleting a
                // sample in the hub reached the database only through this
                // mechanism, so hub-side deletion is now inert and a deleted
                // sample returns on reload.
                foreach (self::VALID_TYPES as $sampleType) {
                    if (! array_key_exists($sampleType, $siteData) || ! is_array($siteData[$sampleType])) {
                        continue;
                    }

                    foreach ($siteData[$sampleType] as $sampleKey => $sampleData) {
                        if (! is_array($sampleData)) {
                            continue;
                        }

                        $payload = $sampleData['rawData'] ?? [];
                        if (! is_array($payload) || empty($payload)) {
                            continue;
                        }

                        // Preserve zone metadata alongside nutrient values so the
                        // API round-trip can restore human-readable labels and zone
                        // types (previously lost because only rawData was stored).
                        $sampleLabel = isset($sampleData['label']) ? (string) $sampleData['label'] : null;
                        $sampleZone  = isset($sampleData['zoneType']) ? (string) $sampleData['zoneType'] : null;
                        if ($sampleLabel !== null && $sampleLabel !== '') {
                            $payload['_label'] = $sampleLabel;
                            if (in_array($sampleType, ['soil', 'tissue', 'loi'], true)) {
                                $siteLabels[$siteId][] = $sampleLabel;
                            }
                        }
                        if ($sourceFile !== null && $sourceFile !== '') {
                            $payload['_source'] = $sourceFile;
                        }
                        if ($sampleZone !== null && $sampleZone !== '') {
                            $payload['_zone'] = $sampleZone;
                            $zoneDisplayMap = [
                                'green'   => 'Greens',
                                'fairway' => 'Fairways',
                                'tee'     => 'Tees',
                                'rough'   => 'Roughs',
                                'other'   => 'Other',
                                'turf'    => 'Other',
                                'water'   => 'Other',
                                'surface' => 'Other',
                            ];
                            $payload['zone'] = $zoneDisplayMap[strtolower($sampleZone)] ?? ucfirst($sampleZone);
                        }

                        $clientUid = (string) ($sampleData['id'] ?? $sampleKey ?? '');
                        if ($clientUid === '') {
                            continue;
                        }

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
                }
            }
        });

        foreach ($siteLabels as $siteId => $labels) {
            $site = Site::query()->find($siteId);
            if (! $site) {
                continue;
            }
            foreach (array_unique($labels) as $label) {
                $this->mergeZoneNameIntoSite($site, $label);
            }
        }

        return response()->json([
            'data' => [
                'synced' => $synced,
                'deleted' => $deleted,
            ],
        ]);
    }

    public function update(Request $request, Sample $sample): JsonResponse
    {
        $sample->load('site');
        abort_unless($request->user()->canEditSite($sample->site), 403);

        $data = $request->validate([
            'client_uid'  => ['nullable', 'string', 'max:191'],
            'lab_name'    => ['nullable', 'string', 'max:128'],
            'lab_ref'     => ['nullable', 'string', 'max:64'],
            'sample_date' => ['nullable', 'date'],
            'lab_date'    => ['nullable', 'date'],
            'depth_mm'    => ['nullable', 'integer', 'min:0', 'max:5000'],
            'payload'     => ['sometimes', 'array'],
            'notes'       => ['nullable', 'string'],
        ]);

        DB::transaction(function () use ($sample, $data, $request) {
            if (array_key_exists('client_uid', $data))  $sample->client_uid  = $data['client_uid'];
            if (array_key_exists('lab_name', $data))    $sample->lab_name    = $data['lab_name'] ?? '';
            if (array_key_exists('lab_ref', $data))     $sample->lab_ref     = $data['lab_ref'] ?? '';
            if (array_key_exists('sample_date', $data)) $sample->sample_date = $data['sample_date'];
            if (array_key_exists('lab_date', $data))    $sample->lab_date    = $data['lab_date'];
            if (array_key_exists('depth_mm', $data))    $sample->depth_mm    = $data['depth_mm'];
            if (array_key_exists('notes', $data))       $sample->notes       = $data['notes'];
            if (array_key_exists('payload', $data))     $sample->payload     = $data['payload'];
            $sample->modified_by_user_id = $request->user()->id;
            $sample->save();

            $site    = $sample->site;
            $labDate = $sample->lab_date?->toDateString()
                ?? $sample->sample_date?->toDateString()
                ?? now()->toDateString();

            $summary = SiteSummary::query()->withTrashed()->firstOrNew([
                'site_id'     => $site->id,
                'sample_type' => $sample->sample_type,
                'lab_date'    => $labDate,
            ]);
            if ($summary->trashed()) {
                $summary->restore();
            }
            $summary->fill([
                'account_id'             => $sample->account_id,
                'methodology_snapshot'   => $sample->methodology_snapshot,
                'summary'                => $this->buildSummaryPayload($sample, $site),
                'source_sample_id'       => $sample->id,
                'modified_by_user_id'    => $request->user()->id,
            ]);
            if (! $summary->exists) {
                $summary->created_by_user_id = $request->user()->id;
            }
            $summary->save();
        });

        return response()->json([
            'data' => $this->samplePayload($sample->fresh(['site'])),
        ]);
    }

    public function show(Request $request, Sample $sample): JsonResponse
    {
        $sample->load('site');
        abort_unless($request->user()->canViewSite($sample->site), 403);

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
        abort_unless($request->user()->canViewSite($site), 403);

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

    private function mergeZoneNameIntoSite(Site $site, string $label): void
    {
        $attrs         = $site->attributes_json ?? [];
        $existingZones = $attrs['zones'] ?? [];
        $existingLower = array_map('strtolower', $existingZones);
        if (! in_array(strtolower($label), $existingLower, true)) {
            $existingZones[]     = $label;
            $attrs['zones']      = $existingZones;
            $site->attributes_json = $attrs;
            $site->save();
        }
    }
}
