<?php

namespace App\Http\Controllers;

use App\Models\Site;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class SprayLogController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $data = $request->validate([
            'site_id' => ['required', 'string', 'exists:sites,id'],
            'zone' => ['nullable', 'string', 'max:80'],
            'category' => ['nullable', 'string', 'max:80'],
            'frac_group' => ['nullable', 'string', 'max:20'],
            'days' => ['nullable', 'integer', 'min:1', 'max:3650'],
            'date_from' => ['nullable', 'date'],
            'date_to' => ['nullable', 'date'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:500'],
            'offset' => ['nullable', 'integer', 'min:0'],
        ]);

        $site = $this->resolveOwnedSite($request, (string) $data['site_id']);
        $rows = $this->buildFilteredQuery($site->id, $data)
            ->offset((int) ($data['offset'] ?? 0))
            ->limit((int) ($data['limit'] ?? 200))
            ->get();

        return response()->json([
            'success' => true,
            'entries' => $rows->map(fn (object $row): array => $this->mapEntry($row))->values()->all(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'site_id' => ['required', 'string', 'exists:sites,id'],
            'zone' => ['nullable', 'string', 'max:80'],
            'zones' => ['nullable', 'array'],
            'zones.*' => ['string', 'max:80'],
            'application_date' => ['required', 'date'],
            'product_name' => ['required', 'string', 'max:255'],
            'product_category' => ['nullable', 'string', 'max:80'],
            'active_ingredient' => ['nullable', 'string', 'max:255'],
            'rate' => ['nullable', 'numeric'],
            'rate_unit' => ['nullable', 'string', 'max:40'],
            'target' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string'],
            'source' => ['nullable', 'string', 'max:40'],
        ]);

        $site = $this->resolveOwnedSite($request, (string) $data['site_id']);
        $zones = $this->normaliseZones($data['zone'] ?? null, $data['zones'] ?? null);

        if ($zones === []) {
            return response()->json([
                'success' => false,
                'error' => 'At least one zone is required',
            ], 422);
        }

        $timestamp = now();
        $ids = [];

        foreach ($zones as $zone) {
            $ids[] = DB::table('spray_logs')->insertGetId([
                'account_id' => $site->account_id,
                'site_id' => $site->id,
                'user_id' => $request->user()->id,
                'event_date' => $data['application_date'],
                'zone' => $zone,
                'product_name' => $data['product_name'],
                'product_type' => $data['product_category'] ?? 'other',
                'active_ingredient' => trim((string) ($data['active_ingredient'] ?? '')),
                'rate_value' => $data['rate'],
                'rate_unit' => $data['rate_unit'],
                'target' => $data['target'],
                'notes' => $data['notes'],
                'source' => $data['source'] ?? 'manual',
                'created_at' => $timestamp,
                'updated_at' => $timestamp,
            ]);
        }

        $rows = DB::table('spray_logs')
            ->whereIn('id', $ids)
            ->orderBy('id')
            ->get();

        $entries = $rows->map(fn (object $row): array => $this->mapEntry($row))->values()->all();

        return response()->json([
            'success' => true,
            'count' => count($entries),
            'data' => $entries[0] ?? null,
            'entries' => $entries,
        ], 201);
    }

    public function update(Request $request, int $logId): JsonResponse
    {
        $log = $this->resolveOwnedLog($request, $logId);

        $data = $request->validate([
            'zone' => ['sometimes', 'string', 'max:80'],
            'application_date' => ['sometimes', 'date'],
            'product_name' => ['sometimes', 'string', 'max:255'],
            'product_category' => ['nullable', 'string', 'max:80'],
            'active_ingredient' => ['nullable', 'string', 'max:255'],
            'rate' => ['nullable', 'numeric'],
            'rate_unit' => ['nullable', 'string', 'max:40'],
            'target' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string'],
            'source' => ['nullable', 'string', 'max:40'],
        ]);

        $updates = [];

        if (array_key_exists('zone', $data)) {
            $updates['zone'] = $data['zone'];
        }
        if (array_key_exists('application_date', $data)) {
            $updates['event_date'] = $data['application_date'];
        }
        if (array_key_exists('product_name', $data)) {
            $updates['product_name'] = $data['product_name'];
        }
        if (array_key_exists('product_category', $data)) {
            $updates['product_type'] = $data['product_category'] ?: 'other';
        }
        if (array_key_exists('active_ingredient', $data)) {
            $updates['active_ingredient'] = trim((string) ($data['active_ingredient'] ?? ''));
        }
        if (array_key_exists('rate', $data)) {
            $updates['rate_value'] = $data['rate'];
        }
        if (array_key_exists('rate_unit', $data)) {
            $updates['rate_unit'] = $data['rate_unit'];
        }
        if (array_key_exists('target', $data)) {
            $updates['target'] = $data['target'];
        }
        if (array_key_exists('notes', $data)) {
            $updates['notes'] = $data['notes'];
        }
        if (array_key_exists('source', $data)) {
            $updates['source'] = $data['source'] ?? 'manual';
        }

        if ($updates === []) {
            return response()->json([
                'success' => false,
                'error' => 'No changes supplied',
            ], 422);
        }

        $updates['updated_at'] = now();

        DB::table('spray_logs')
            ->where('id', $logId)
            ->update($updates);

        $row = DB::table('spray_logs')->where('id', $logId)->firstOrFail();

        return response()->json([
            'success' => true,
            'data' => $this->mapEntry($row),
        ]);
    }

    public function destroy(Request $request, int $logId): JsonResponse
    {
        $this->resolveOwnedLog($request, $logId);

        DB::table('spray_logs')
            ->where('id', $logId)
            ->delete();

        return response()->json([
            'success' => true,
        ]);
    }

    public function context(Request $request): JsonResponse
    {
        $data = $request->validate([
            'site_id' => ['required', 'string', 'exists:sites,id'],
            'zone' => ['nullable', 'string', 'max:80'],
            'days' => ['nullable', 'integer', 'min:1', 'max:3650'],
        ]);

        $site = $this->resolveOwnedSite($request, (string) $data['site_id']);
        $days = (int) ($data['days'] ?? 90);
        $rows = $this->buildFilteredQuery($site->id, [
            'zone' => $data['zone'] ?? null,
            'days' => $days,
        ])->limit(200)->get();

        $entries = $rows->map(fn (object $row): array => $this->mapEntry($row))->values();
        $fungicides = $entries->filter(fn (array $entry): bool => $entry['product_category'] === 'fungicide')->values();

        $lastPgrEntry = $entries->first(fn (array $entry): bool => $entry['product_category'] === 'pgr');
        $lastPgr = $lastPgrEntry !== null
            ? array_merge($lastPgrEntry, ['product_key' => $this->pgrProductKey((string) ($lastPgrEntry['product_name'] ?? ''))])
            : null;
        $lastFungicide = $fungicides->first();
        $dmiApplications = $fungicides->filter(fn (array $entry): bool => (string) ($entry['frac_group'] ?? '') === '3')->values()->all();
        $fracHistory = $fungicides
            ->filter(fn (array $entry): bool => ! empty($entry['frac_group']))
            ->map(fn (array $entry): array => [
                'log_id' => $entry['log_id'],
                'application_date' => $entry['application_date'],
                'product_name' => $entry['product_name'],
                'active_ingredient' => $entry['active_ingredient'],
                'frac_group' => $entry['frac_group'],
                'zone' => $entry['zone'],
            ])
            ->values()
            ->all();

        return response()->json([
            'success' => true,
            'site_id' => $site->id,
            'zone' => $data['zone'] ?? null,
            'days' => $days,
            'totalApplications' => $entries->count(),
            'lastPGR' => $lastPgr,
            'lastFungicide' => $lastFungicide,
            'dmiApplications' => $dmiApplications,
            'fracHistory' => $fracHistory,
            'recentApplications' => $entries->take(20)->values()->all(),
        ]);
    }

    public function summary(Request $request): JsonResponse
    {
        $data = $request->validate([
            'site_id' => ['required', 'string', 'exists:sites,id'],
            'zone' => ['nullable', 'string', 'max:80'],
            'months' => ['nullable', 'integer', 'min:1', 'max:120'],
        ]);

        $site = $this->resolveOwnedSite($request, (string) $data['site_id']);
        $months = (int) ($data['months'] ?? 12);
        $rows = $this->buildFilteredQuery($site->id, [
            'zone' => $data['zone'] ?? null,
            'date_from' => now()->subMonths($months)->toDateString(),
        ])->limit(500)->get();

        $entries = $rows->map(fn (object $row): array => $this->mapEntry($row))->values();
        $fracCounts = [];

        foreach ($entries as $entry) {
            $frac = (string) ($entry['frac_group'] ?? '');
            if ($frac === '') {
                continue;
            }
            $fracCounts[$frac] = ($fracCounts[$frac] ?? 0) + 1;
        }

        return response()->json([
            'success' => true,
            'site_id' => $site->id,
            'zone' => $data['zone'] ?? null,
            'months' => $months,
            'entries' => $entries->all(),
            'fracCounts' => $fracCounts,
            'totalEntries' => $entries->count(),
        ]);
    }

    private function resolveOwnedSite(Request $request, string $siteId): Site
    {
        $site = Site::query()->findOrFail($siteId);

        abort_unless(
            $site->users()->where('users.id', $request->user()->id)->exists(),
            404
        );

        return $site;
    }

    private function resolveOwnedLog(Request $request, int $logId): object
    {
        $log = DB::table('spray_logs')
            ->join('site_user', 'site_user.site_id', '=', 'spray_logs.site_id')
            ->where('spray_logs.id', $logId)
            ->where('site_user.user_id', $request->user()->id)
            ->select('spray_logs.*')
            ->first();

        abort_unless($log, 404);

        return $log;
    }

    private function buildFilteredQuery(string $siteId, array $filters)
    {
        $query = DB::table('spray_logs')
            ->where('site_id', $siteId)
            ->orderByDesc('event_date')
            ->orderByDesc('id');

        $zone = trim((string) ($filters['zone'] ?? ''));
        if ($zone !== '' && $zone !== 'all') {
            $query->where('zone', $zone);
        }

        $category = trim((string) ($filters['category'] ?? ''));
        if ($category !== '' && $category !== 'all') {
            $query->where('product_type', $category);
        }

        if (! empty($filters['days'])) {
            $query->whereDate('event_date', '>=', now()->subDays((int) $filters['days'])->toDateString());
        }

        if (! empty($filters['date_from'])) {
            $query->whereDate('event_date', '>=', $filters['date_from']);
        }

        if (! empty($filters['date_to'])) {
            $query->whereDate('event_date', '<=', $filters['date_to']);
        }

        $fracGroup = trim((string) ($filters['frac_group'] ?? ''));
        if ($fracGroup !== '') {
            $query->where(function ($sub) use ($fracGroup) {
                foreach ($this->fracGroupActiveIngredients($fracGroup) as $index => $activeIngredient) {
                    if ($index === 0) {
                        $sub->where('active_ingredient', 'like', '%'.$activeIngredient.'%');
                    } else {
                        $sub->orWhere('active_ingredient', 'like', '%'.$activeIngredient.'%');
                    }
                }
            });
        }

        return $query;
    }

    private function mapEntry(object $row): array
    {
        $activeIngredient = trim((string) ($row->active_ingredient ?? ''));
        $fracGroup = $this->detectFracGroup($activeIngredient, (string) ($row->product_name ?? ''), (string) ($row->product_type ?? ''));

        return [
            'log_id' => (int) $row->id,
            'site_id' => (string) $row->site_id,
            'zone' => (string) $row->zone,
            'application_date' => (string) $row->event_date,
            'product_name' => (string) $row->product_name,
            'product_category' => (string) $row->product_type,
            'active_ingredient' => $activeIngredient !== '' ? $activeIngredient : null,
            'frac_group' => $fracGroup,
            'rate' => $row->rate_value !== null ? (float) $row->rate_value : null,
            'rate_unit' => $row->rate_unit,
            'target' => $row->target,
            'notes' => $row->notes,
            'source' => $row->source,
        ];
    }

    /**
     * @return array<int, string>
     */
    private function normaliseZones(?string $zone, ?array $zones): array
    {
        $items = [];

        if (is_string($zone) && trim($zone) !== '') {
            $items[] = trim($zone);
        }

        if (is_array($zones)) {
            foreach ($zones as $entry) {
                $entry = trim((string) $entry);
                if ($entry !== '') {
                    $items[] = $entry;
                }
            }
        }

        return array_values(array_unique($items));
    }

    private function pgrProductKey(string $productName): ?string
    {
        $map = [
            'primo 250ec' => 'TE250', 'primo 250 ec' => 'TE250',
            'primo maxx' => 'TE120', 'primo maxx 120' => 'TE120', 'primo maxx 1ec' => 'TE175',
            'te250' => 'TE250', 'te175' => 'TE175', 'te120' => 'TE120',
            'trinexapac-ethyl' => 'TE250', 'trinexapac ethyl' => 'TE250',
            'indigo amigo' => 'TE175', 'indigo amigo 250' => 'TE250',
            'indigo amigo 175' => 'TE175', 'indigo amigo 120' => 'TE120',
            'amigo' => 'TE175', 'amigo 175' => 'TE175', 'amigo 250' => 'TE250', 'amigo 120' => 'TE120',
            'marvel 175' => 'TE175', 'marvel' => 'TE175',
            'indigo marvel 175' => 'TE175', 'indigo marvel' => 'TE175',
            'paclobutrazol' => 'PBZ200', 'paclobutrazol 200sc' => 'PBZ200',
            'paclobutrazol 200g/l' => 'PBZ200', 'paclobutrazol 250g/l' => 'PBZ250',
            'trimmit' => 'PBZ200', 'trimmit 2sc' => 'PBZ200',
            'indigo regulate' => 'PBZ200',
            'anuew' => 'ANUEW', 'prohexadione-calcium' => 'ANUEW', 'prohexadione calcium' => 'ANUEW',
            'ethephon' => 'ETH', 'ethephon 480g/l' => 'ETH',
            'indigo incognito' => 'ETH', 'proxy' => 'ETH',
        ];
        return $map[strtolower(trim($productName))] ?? null;
    }

    private function detectFracGroup(string $activeIngredient, string $productName, string $productType): ?string
    {
        if ($productType === 'pgr') {
            return null;
        }

        $haystack = strtolower(trim($activeIngredient !== '' ? $activeIngredient : $productName));

        if ($haystack === '') {
            return null;
        }

        $map = [
            '1' => ['thiophanate', 'thiabendazole', 'carbendazim'],
            '2' => ['iprodione', 'procymidone'],
            '3' => ['propiconazole', 'tebuconazole', 'myclobutanil', 'triticonazole', 'difenoconazole', 'metconazole', 'prothioconazole', 'mefentrifluconazole', 'triadimenol', 'prochloraz', 'cyproconazole'],
            '4' => ['metalaxyl', 'mefenoxam', 'propamocarb'],
            '7' => ['penthiopyrad', 'fluopyram', 'boscalid', 'fluxapyroxad', 'benzovindiflupyr', 'pydiflumetofen', 'flutolanil'],
            '11' => ['azoxystrobin', 'trifloxystrobin', 'pyraclostrobin', 'mandestrobin'],
            '12' => ['fludioxonil'],
            '14' => ['etridiazole'],
            '21' => ['cyazofamid'],
            '29' => ['fluazinam'],
            '33' => ['fosetyl'],
            '49' => ['oxathiapiprolin'],
        ];

        foreach ($map as $frac => $needles) {
            foreach ($needles as $needle) {
                if (str_contains($haystack, $needle)) {
                    return $frac;
                }
            }
        }

        return null;
    }

    /**
     * @return array<int, string>
     */
    private function fracGroupActiveIngredients(string $fracGroup): array
    {
        return match ($fracGroup) {
            '1' => ['thiophanate', 'thiabendazole', 'carbendazim'],
            '2' => ['iprodione', 'procymidone'],
            '3' => ['propiconazole', 'tebuconazole', 'myclobutanil', 'triticonazole', 'difenoconazole', 'metconazole', 'prothioconazole', 'mefentrifluconazole', 'triadimenol', 'prochloraz', 'cyproconazole'],
            '4' => ['metalaxyl', 'mefenoxam', 'propamocarb'],
            '7' => ['penthiopyrad', 'fluopyram', 'boscalid', 'fluxapyroxad', 'benzovindiflupyr', 'pydiflumetofen', 'flutolanil'],
            '11' => ['azoxystrobin', 'trifloxystrobin', 'pyraclostrobin', 'mandestrobin'],
            '12' => ['fludioxonil'],
            '14' => ['etridiazole'],
            '21' => ['cyazofamid'],
            '29' => ['fluazinam'],
            '33' => ['fosetyl'],
            '49' => ['oxathiapiprolin'],
            default => [],
        };
    }
}
