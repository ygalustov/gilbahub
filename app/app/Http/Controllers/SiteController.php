<?php

namespace App\Http\Controllers;

use App\Models\Account;
use App\Models\Site;
use App\Models\SiteConfig;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class SiteController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $sites = $user->is_admin
            ? Site::query()->with('configs')->orderBy('name')->get()
            // GH-359: site_user has no 'status' column (never existed in any
            // migration, confirmed against both the real MySQL schema and
            // SQLite test DB) -- this wherePivot was added alongside GH-66's
            // removal of the suspended-user feature but references a column
            // that was never actually created, so this call 500'd for every
            // non-admin user. Only ever masked because manual testing used
            // an admin account, which takes the other branch above.
            : $user->sites()->with('configs')->orderBy('name')->get();

        return response()->json([
            'active_site_id' => $user->last_active_site_id,
            'data' => $sites->map(fn (Site $site) => $this->sitePayload($site))->values(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'location_name' => ['nullable', 'string', 'max:255'],
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
            'timezone' => ['nullable', 'string', 'max:80'],
            'site_type' => ['nullable', 'string', 'max:32'],
            'precinct_group_id' => ['nullable', 'integer', 'exists:precinct_groups,id'],
            'parent_site_id' => ['nullable', 'string', 'exists:sites,id'],
        ]);

        $account = $this->currentAccount($request);

        $site = Site::query()->create([
            ...$data,
            'account_id' => $account->id,
            'site_type' => $data['site_type'] ?? 'precinct',
            'slug' => $this->uniqueSlug($account->id, $data['name']),
            'provisional_name' => true,
            'created_by_user_id' => $request->user()->id,
            'modified_by_user_id' => $request->user()->id,
        ]);

        // Admin sees all sites without site_user record
        if (! $request->user()->is_admin) {
            $site->users()->attach($request->user()->id, ['role' => 'manager']);
        }

        SiteConfig::query()->create([
            'site_id' => $site->id,
            'namespace' => 'gaip',
            'config' => (object)[],
            'synced_at' => now(),
        ]);

        $request->user()->forceFill(['last_active_site_id' => $site->id])->save();

        return response()->json([
            'data' => $this->sitePayload($site->load('configs')),
        ], 201);
    }

    public function syncRegistry(Request $request): JsonResponse
    {
        $data = $request->validate([
            'sites' => ['required', 'array'],
        ]);

        $account = $this->currentAccount($request);
        $user = $request->user();
        $saved = 0;

        foreach ($data['sites'] as $siteId => $siteData) {
            if (! is_string($siteId) || trim($siteId) === '' || ! is_array($siteData)) {
                continue;
            }

            // sites.id is CHAR(36) — skip IDs that would overflow the column
            if (strlen($siteId) > 36) {
                continue;
            }

            $name = trim((string) ($siteData['label'] ?? $siteData['name'] ?? ''));
            // Reject auto-generated TPC profile keys as site names — they indicate
            // a client-side bug where a turf profile key was used as a site label.
            if (str_starts_with($name, '__site__')) {
                $name = '';
            }
            $site = Site::query()->find($siteId);

            if ($site) {
                abort_unless($user->canEditSite($site), 403);
                $site->update([
                    'name' => $name !== '' ? $name : $site->name,
                    'modified_by_user_id' => $user->id,
                ]);
            } else {
                $site = new Site();
                $site->forceFill([
                    'id' => $siteId,
                    'account_id' => $account->id,
                    'name' => $name !== '' ? $name : $siteId,
                    'slug' => $this->uniqueSlug($account->id, $name !== '' ? $name : $siteId),
                    'site_type' => 'precinct',
                    'timezone' => 'Australia/Sydney',
                    'created_by_user_id' => $user->id,
                    'modified_by_user_id' => $user->id,
                ])->save();

                if (! $user->is_admin) {
                    $site->users()->attach($user->id, ['role' => 'manager']);
                }
            }

            SiteConfig::query()->firstOrCreate(
                [
                    'site_id' => $site->id,
                    'namespace' => 'gaip',
                ],
                [
                    'config' => (object)[],
                    'synced_at' => now(),
                ]
            );

            $saved++;
        }

        return response()->json([
            'data' => [
                'saved' => $saved,
            ],
        ]);
    }

    public function show(Request $request, string $site): JsonResponse
    {
        $site = $this->resolveAccessibleSite($request, $site);
        abort_unless($request->user()->canViewSite($site), 403);

        return response()->json([
            'data' => $this->sitePayload($site->load('configs')),
        ]);
    }

    public function update(Request $request, string $site): JsonResponse
    {
        $site = $this->resolveAccessibleSite($request, $site);
        abort_unless($request->user()->canEditSite($site), 403);

        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'location_name' => ['nullable', 'string', 'max:255'],
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
            'timezone' => ['nullable', 'string', 'max:80'],
            'site_type' => ['nullable', 'string', 'max:32'],
            'methodology_override' => ['nullable', 'string', 'max:32'],
            'soil_texture_override' => ['nullable', 'string', 'max:32'],
            'attributes_json' => ['nullable', 'array'],
            'precinct_group_id' => ['nullable', 'integer', 'exists:precinct_groups,id'],
            'parent_site_id' => ['nullable', 'string', Rule::exists('sites', 'id')->whereNot('id', $site->id)],
        ]);

        if (isset($data['name'])) {
            $data['slug'] = $this->uniqueSlug($site->account_id, $data['name'], $site->id);
        }

        if (isset($data['attributes_json'])) {
            $data['attributes_json'] = array_merge(
                $site->attributes_json ?? [],
                $data['attributes_json']
            );
        }

        // GH-371 (D01): capture the pre-update coordinates so we can tell a
        // real change from a no-op resave (Settings always sends latitude/
        // longitude on every save, populated from the form's own current
        // values -- see settings-init.js -- so most PATCH requests here
        // carry these keys without the site actually moving).
        $previousLatitude = $site->latitude;
        $previousLongitude = $site->longitude;

        $data['modified_by_user_id'] = $request->user()->id;
        $site->update($data);

        // GH-371 (D01): a real coordinate change invalidates any cached
        // nutrition programme for this site. The client already guards
        // against this itself (nutrition-calendar.js / site-config-
        // persistence.js -- stamps the coordinates a programme was computed
        // against and drops/refuses to restore it on a mismatch), but that
        // only protects a client that goes through those code paths. This
        // is belt-and-braces, not a replacement: clear the cached programme
        // fields directly on the SiteConfig row here too, so a client that
        // reads the persisted config straight from the server (a future
        // mobile client, a report generated moments later before the
        // browser's own in-memory check has a chance to run, or simply a
        // stale localStorage blob synced up after this request) never
        // receives a stale blob computed against the old location in the
        // first place.
        // $request->has(...) checks the raw request payload, not $data --
        // validate() without `sometimes` hands back a `latitude` key (as
        // null) even when the client never sent one, since `nullable` alone
        // still validates and reports an absent field. Using $data's own
        // key presence here would treat every such request as "explicitly
        // cleared to null", which is not what happened.
        $coordinatesChanged = ($this->coordinateChanged($previousLatitude, $data['latitude'] ?? null, $request->has('latitude')))
            || ($this->coordinateChanged($previousLongitude, $data['longitude'] ?? null, $request->has('longitude')));
        if ($coordinatesChanged) {
            $gaipConfig = $site->configs()->where('namespace', 'gaip')->first();
            if ($gaipConfig && is_array($gaipConfig->config)) {
                $config = $gaipConfig->config;
                $hadCachedProgramme = isset($config['nutritionProgram'])
                    || isset($config['nutritionCalendarProgram'])
                    || isset($config['nutritionProgramCoords']);
                if ($hadCachedProgramme) {
                    unset($config['nutritionProgram'], $config['nutritionCalendarProgram'], $config['nutritionProgramCoords']);
                    $gaipConfig->update(['config' => $config]);
                }
            }
        }

        return response()->json([
            'data' => $this->sitePayload($site->load('configs')),
        ]);
    }

    /**
     * GH-371 (D01): true only for a genuine coordinate change, not merely
     * the field being present in the request -- Settings always resends
     * latitude/longitude on every save (see settings-init.js), so "the key
     * was in the request" is not a useful signal on its own. $wasPresent
     * distinguishes "the client explicitly cleared this to null" (a real
     * change worth invalidating on) from "the client didn't send this field
     * at all" (validate() with a nullable-but-not-required rule still hands
     * back null for an absent key -- must not read that as "cleared").
     */
    private function coordinateChanged(?float $old, $new, bool $wasPresent): bool
    {
        if (! $wasPresent) {
            return false;
        }
        if ($new === null) {
            return $old !== null;
        }
        if ($old === null) {
            return true;
        }
        return abs($old - (float) $new) > 0.01;
    }

    public function setActive(Request $request): JsonResponse
    {
        $data = $request->validate([
            'site_id' => ['required', 'string', 'exists:sites,id'],
        ]);

        $site = Site::query()->findOrFail($data['site_id']);
        $user = $request->user();
        abort_unless($user->canViewSite($site), 403);

        $user->forceFill([
            'last_active_site_id' => $site->id,
        ])->save();

        return response()->json([
            'active_site_id' => $site->id,
            'data' => $this->sitePayload($site->load('configs')),
        ]);
    }

    public function destroy(Request $request, string $site): JsonResponse
    {
        $site = $this->resolveAccessibleSite($request, $site);
        abort_unless($request->user()->canManageSite($site), 403);

        $user = $request->user();

        $remainingCount = $user->is_admin
            ? Site::query()->where('id', '!=', $site->id)->count()
            : $user->sites()->where('sites.id', '!=', $site->id)->count();

        if ($remainingCount === 0) {
            return response()->json(['message' => 'Cannot delete the only site.'], 422);
        }

        if ($user->last_active_site_id === $site->id) {
            $next = $user->is_admin
                ? Site::query()->where('id', '!=', $site->id)->orderBy('name')->first()
                : $user->sites()->where('sites.id', '!=', $site->id)->orderBy('sites.name')->first();
            $user->forceFill(['last_active_site_id' => $next?->id])->save();
        }

        $site->users()->detach();
        $site->configs()->delete();
        $site->delete();

        return response()->json(['deleted' => true]);
    }

    public function updateConfig(Request $request, string $site, string $namespace = 'gaip'): JsonResponse
    {
        $site = $this->resolveAccessibleSite($request, $site);
        abort_unless($request->user()->canEditSite($site), 403);

        $data = $request->validate([
            'config' => ['present', 'array'],
            'namespace' => ['nullable', 'string', 'max:40', Rule::in(['gaip', 'gssh'])],
        ]);

        $namespace = $data['namespace'] ?? $namespace;
        $incomingConfig = $data['config'];
        $siteSync = [];

        // GH-371 follow-up (independent review): this endpoint is a SECOND,
        // independent way Site.latitude/longitude can change (see the
        // site-column sync folded into resolveGaipConfigWrite() below) and,
        // unlike update(), replaces the whole `gaip` config column wholesale
        // -- so a stale client-held config snapshot can carry the OLD
        // nutritionProgram/nutritionCalendarProgram/nutritionProgramCoords
        // straight back into the DB, including immediately after update()'s
        // own PATCH-driven clear for the very same coordinate change
        // (settings-init.js fires both requests together on every Settings
        // save: Promise.all([PATCH /sites/{id}, PUT .../config/gaip])).
        // resolveGaipConfigWrite() is what actually protects these three
        // keys; see its own docblock for why a plain before/after diff
        // scoped to this one request can't catch that ordering on its own.
        if ($namespace === 'gaip') {
            $existingGaipConfig = $site->configs()->where('namespace', 'gaip')->first();
            [$incomingConfig, $siteSync] = $this->resolveGaipConfigWrite($site, $incomingConfig, $existingGaipConfig);
        }

        $config = SiteConfig::query()->updateOrCreate(
            [
                'site_id' => $site->id,
                'namespace' => $namespace,
            ],
            [
                'config' => $incomingConfig,
                'synced_at' => now(),
            ]
        );

        // Keep the site model columns in sync with the gaip config so that
        // Settings and other pages that read from the site model stay correct.
        if (! empty($siteSync)) {
            $site->update($siteSync);
        }

        return response()->json([
            'data' => [
                'site_id' => $site->id,
                'namespace' => $config->namespace,
                'config' => $config->config ?? [],
                'synced_at' => $config->synced_at?->toISOString(),
            ],
        ]);
    }

    /**
     * GH-371 follow-up (independent review): decide what the three cached-
     * programme keys (nutritionProgram / nutritionCalendarProgram /
     * nutritionProgramCoords) should actually persist to on a `gaip` config
     * write, and what -- if anything -- needs to sync back onto the site
     * row's own latitude/longitude columns.
     *
     * Why "just reuse coordinateChanged() and clear the three keys when it
     * fires" (update()'s own pattern -- still reused below for the site-sync
     * half) is not enough on its own: on the real Settings save action, this
     * request's own before/after coordinate diff can be blind to a change
     * that already happened moments earlier in the SAME save action.
     * settings-init.js fires `Promise.all([PATCH /sites/{id}, PUT
     * .../config/gaip])` concurrently; if the PATCH lands first, it both
     * updates the site row AND clears these three keys server-side
     * (SiteController::update()). By the time this PUT then runs,
     * $site->latitude already equals the PUT's own submitted
     * config.location.lat (both are the new coordinates -- settings-init.js
     * reads them from the same form fields for both requests), so a
     * same-request before/after diff sees no change at all here, even
     * though this PUT's own config still carries the OLD cached programme
     * (a clone of the page's pre-save config -- see settings-init.js).
     *
     * So these three keys get different treatment from the rest of the
     * config (which is still replaced wholesale, unchanged): they are only
     * ever taken from the incoming payload when it carries its own
     * nutritionProgramCoords stamp (written by nutrition-calendar.js's
     * persistSiteConfigPatch() -- the same stamp GH-371's client-side
     * restore checks already trust) AND that stamp matches the coordinates
     * this write is actually establishing -- i.e. a genuinely fresh,
     * just-generated programme, such as Plan's own direct-PUT fallback
     * right after Generate. Otherwise the incoming values for these three
     * keys are discarded, and whatever is already in the DB is carried
     * forward instead (a config PUT that never legitimately touches
     * nutrition data -- e.g. Settings, stripped of these keys client-side
     * too, see settings-init.js -- must not silently blow away a
     * still-valid cached programme just because its own payload happens
     * not to mention it) -- UNLESS this same request is itself changing the
     * site's coordinates (via config.location.lat/lon, detected with the
     * identical coordinateChanged() update() uses), in which case even the
     * existing DB value is now stale too and is dropped, not carried
     * forward.
     *
     * Trusting the incoming payload requires an actual programme -- a real,
     * non-null value under nutritionProgram or nutritionCalendarProgram, not
     * merely the key being present (an explicit null counts as absent, same
     * as the key being missing entirely) and not merely a bare
     * nutritionProgramCoords stamp with nothing else -- and is intentionally
     * NOT additionally conditioned on "coordinates unchanged this request":
     * a payload that moves the site AND supplies a programme freshly
     * computed for the new location in the same request is exactly as
     * trustworthy as one where coordinates didn't move (the stamp already
     * encodes that check, against $targetLat/$targetLon, not against the
     * old value) -- an earlier version of this method required both and
     * silently dropped a site's very first programme write whenever its
     * coordinates were being set for the first time (site row starts with
     * `latitude`/`longitude` NULL).
     *
     * @return array{0: array, 1: array} [config to persist, site columns to sync]
     */
    private function resolveGaipConfigWrite(Site $site, array $incomingConfig, ?SiteConfig $existingGaipConfig): array
    {
        $cacheKeys = ['nutritionProgram', 'nutritionCalendarProgram', 'nutritionProgramCoords'];

        $previousLatitude = $site->latitude;
        $previousLongitude = $site->longitude;

        $gaipLocation = $incomingConfig['location'] ?? [];
        $siteSync = [];
        if (isset($gaipLocation['name'])) {
            $siteSync['location_name'] = $gaipLocation['name'];
        }
        $newLat = (isset($gaipLocation['lat']) && is_numeric($gaipLocation['lat'])) ? (float) $gaipLocation['lat'] : null;
        $newLon = (isset($gaipLocation['lon']) && is_numeric($gaipLocation['lon'])) ? (float) $gaipLocation['lon'] : null;
        if ($newLat !== null) {
            $siteSync['latitude'] = $newLat;
        }
        if ($newLon !== null) {
            $siteSync['longitude'] = $newLon;
        }

        // Same real-change-vs-no-op-resave test update()'s own
        // $coordinatesChanged uses, reused rather than reimplemented.
        // $wasPresent here is simply "did this payload supply a real
        // numeric value" -- unlike update()'s $request->has(), there is no
        // Laravel validate()-injected-null quirk to guard against on this
        // nested array input, and no real caller of this endpoint ever
        // submits an explicit location.lat: null.
        $coordinatesChanging = $this->coordinateChanged($previousLatitude, $newLat, $newLat !== null)
            || $this->coordinateChanged($previousLongitude, $newLon, $newLon !== null);

        // The coordinates this write is actually establishing: the
        // payload's own new value when it supplies one, else whatever the
        // site already has.
        $targetLat = $newLat ?? $previousLatitude;
        $targetLon = $newLon ?? $previousLongitude;

        // GH-371 follow-up (independent review, second pass): TRUST requires
        // an actual programme, not just a bare stamp -- a payload carrying
        // ONLY nutritionProgramCoords (no nutritionProgram/
        // nutritionCalendarProgram) is not "a fresh write of a programme"
        // at all, and trusting it verbatim would wholesale-replace away
        // whatever real programme the DB already has under those same
        // untouched keys. No real current caller sends this shape (both
        // settings-init.js handlers strip all three together;
        // persistSiteConfigPatch() always adds the stamp onto the same
        // accumulated object as the programme it stamps) but it's a sharp
        // edge worth closing rather than leaving latent.
        // GH-375: array_key_exists() alone only checked that the KEY was
        // present, not that it carried a real value -- a payload carrying an
        // explicit "nutritionProgram": null alongside a matching stamp would
        // have satisfied this branch and been written verbatim into a
        // wholesale replace, nulling out whatever real programme the DB
        // already had under the OTHER untouched key. No current caller emits
        // an explicit null (verified: both settings-init.js handlers strip
        // all three keys together; persistSiteConfigPatch() always stamps
        // onto the same accumulated object as the programme it stamps), so
        // this was latent, not live -- but it's the same class of bug as the
        // bare-stamp case just above, and this docblock already documents
        // "requires an actual programme", which array_key_exists() alone
        // does not test.
        $hasProgramData = (array_key_exists('nutritionProgram', $incomingConfig) && $incomingConfig['nutritionProgram'] !== null)
            || (array_key_exists('nutritionCalendarProgram', $incomingConfig) && $incomingConfig['nutritionCalendarProgram'] !== null);

        $stamp = $incomingConfig['nutritionProgramCoords'] ?? null;
        $stampLat = (is_array($stamp) && isset($stamp['lat']) && is_numeric($stamp['lat'])) ? (float) $stamp['lat'] : null;
        $stampLon = (is_array($stamp) && isset($stamp['lon']) && is_numeric($stamp['lon'])) ? (float) $stamp['lon'] : null;
        $stampFresh = $stampLat !== null && $stampLon !== null
            && ! $this->coordinateChanged($stampLat, $targetLat, true)
            && ! $this->coordinateChanged($stampLon, $targetLon, true);

        if ($hasProgramData && $stampFresh) {
            // A genuinely fresh, correctly-stamped programme -- trust it as
            // submitted, all three keys exactly as sent.
            //
            // GH-371 follow-up (independent review, second pass): this is
            // deliberately NOT also gated on "coordinates unchanged this
            // request" (an earlier version of this method was, and it was
            // a real bug). $stampFresh already means the stamp matches
            // $targetLat/$targetLon -- the coordinates THIS WRITE is
            // establishing -- so a payload that moves the site AND
            // supplies a programme freshly computed for the new location
            // in the same request is exactly as trustworthy as one where
            // coordinates never moved. Gating on !$coordinatesChanging too
            // silently dropped a legitimate write whenever it did: most
            // concretely, a brand-new site's very first coordinate
            // assignment (site row starts with `latitude`/`longitude`
            // NULL, e.g. `SiteController::syncRegistry()`'s `forceFill()`
            // never sets them) always reports "changed" from
            // `coordinateChanged(null, $newLat, true)`, which would
            // otherwise reject the first real programme this site ever
            // gets -- reproduced live via the actual
            // syncRegistry()-then-pushConfigsToServer() sequence
            // `site-config-persistence.js` uses.
            return [$incomingConfig, $siteSync];
        }

        foreach ($cacheKeys as $key) {
            unset($incomingConfig[$key]);
        }

        if (! $coordinatesChanging && $existingGaipConfig && is_array($existingGaipConfig->config)) {
            foreach ($cacheKeys as $key) {
                if (array_key_exists($key, $existingGaipConfig->config)) {
                    $incomingConfig[$key] = $existingGaipConfig->config[$key];
                }
            }
        }
        // else: coordinates are genuinely changing this request -- leave
        // cleared rather than resurrecting a DB value that's now stale too.

        return [$incomingConfig, $siteSync];
    }

    private function currentAccount(Request $request): Account
    {
        return Account::query()->firstOrCreate(
            ['owner_user_id' => $request->user()->id],
            [
                'display_name' => $request->user()->name,
                'created_by_user_id' => $request->user()->id,
                'modified_by_user_id' => $request->user()->id,
            ]
        );
    }

    private function resolveAccessibleSite(Request $request, string $siteIdentifier): Site
    {
        $user = $request->user();

        $query = Site::query()->where(function ($q) use ($siteIdentifier) {
            $q->where('id', $siteIdentifier)->orWhere('slug', $siteIdentifier);
        });

        if (! $user->is_admin) {
            $query->whereHas('users', function ($q) use ($user) {
                $q->where('users.id', $user->id);
            });
        }

        $site = $query->first();
        abort_unless($site, 404);

        return $site;
    }

    private function uniqueSlug(int $accountId, string $name, ?string $ignoreSiteId = null): string
    {
        $base = Str::slug($name) ?: 'site';
        $slug = $base;
        $index = 2;

        while (Site::query()
            ->where('account_id', $accountId)
            ->when($ignoreSiteId, fn ($query) => $query->where('id', '!=', $ignoreSiteId))
            ->where('slug', $slug)
            ->exists()) {
            $slug = $base.'-'.$index;
            $index++;
        }

        return $slug;
    }

    private function sitePayload(Site $site): array
    {
        return [
            'id' => $site->id,
            'account_id' => $site->account_id,
            'precinct_group_id' => $site->precinct_group_id,
            'parent_site_id' => $site->parent_site_id,
            'name' => $site->name,
            'slug' => $site->slug,
            'site_type' => $site->site_type,
            'location_name' => $site->location_name,
            'latitude' => $site->latitude,
            'longitude' => $site->longitude,
            'timezone' => $site->timezone,
            'configs' => $site->configs->mapWithKeys(fn (SiteConfig $config) => [
                $config->namespace => [
                    'config' => $config->config ?? [],
                    'synced_at' => $config->synced_at?->toISOString(),
                ],
            ]),
        ];
    }
}
