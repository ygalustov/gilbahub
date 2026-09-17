<?php

namespace App\Http\Controllers;

use App\Models\Account;
use App\Models\Site;
use App\Models\SiteConfig;
use App\Support\FieldOwners;
use App\Support\SiteConfigWriter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class SiteController extends Controller
{
    /**
     * GH-439: the whole of a `gaip` site config, key by key. A PATCH may
     * name these and nothing else -- an unknown key is a client inventing
     * state, which is how a turf-profile key once arrived as a site label.
     * `savedAt` is deliberately absent: the server stamps it.
     */
    private const GAIP_CONFIG_KEYS = [
        'turf', 'location', 'pgr', 'traffic', 'irrigation', 'weatherOverride', 'wizard',
        'alertContacts', 'alertQuietHours', 'multiSiteTurf', 'appliedMonthlyN', 'maxNPerMonth',
        'nzDistributor', 'nutritionCalendarProgram', 'nutritionProgram', 'nutritionProgramCoords',
    ];

    /**
     * GH-439: the sections merged field by field on a PATCH. Everything
     * else -- scalars, arrays, and the three programme objects -- is
     * replaced whole.
     */
    private const GAIP_OBJECT_SECTIONS = [
        'turf', 'location', 'pgr', 'traffic', 'irrigation', 'weatherOverride', 'wizard',
    ];

    /**
     * GH-439: the fields a site cannot function without, and which no write
     * may blank. They can be replaced with another value; emptying one is
     * always a client sending a page's defaults rather than a person
     * clearing a field, so `clear` refuses them and the PUT guard puts the
     * stored value back.
     */
    private const GAIP_IDENTITY_FIELDS = [
        ['turf', 'species'],
        ['turf', 'methodology'],
        ['turf', 'turfType'],
        ['location', 'lat'],
        ['location', 'lon'],
    ];

    /** GH-439: sections `clear` may not remove whole. */
    private const GAIP_UNCLEARABLE_SECTIONS = ['turf', 'location', 'wizard'];

    /** GH-371: the cached programme, which only ever persists under its own rules. */
    private const GAIP_PROGRAMME_KEYS = ['nutritionProgram', 'nutritionCalendarProgram', 'nutritionProgramCoords'];

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $sites = $user->is_admin
            // GH-482: `account` is eager-loaded because sitePayload() now
            // reads the account's soil texture, and a lazy relation would be
            // one query per site in this listing.
            ? Site::query()->with(['configs', 'account'])->orderBy('name')->get()
            // GH-359: site_user has no 'status' column (never existed in any
            // migration, confirmed against both the real MySQL schema and
            // SQLite test DB) -- this wherePivot was added alongside GH-66's
            // removal of the suspended-user feature but references a column
            // that was never actually created, so this call 500'd for every
            // non-admin user. Only ever masked because manual testing used
            // an admin account, which takes the other branch above.
            : $user->sites()->with(['configs', 'account'])->orderBy('name')->get();

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

        // GH-439 (2.5): the time zone is derived from the coordinates, never
        // taken from the request. Nothing creating a site offers the user a
        // time-zone field -- Account > Add site sends none, and both setup
        // wizards send a hardcoded 'Australia/Sydney' that seeded that value
        // onto sites all over the world (they stop sending it in the client
        // stage of this work; until then what they send is ignored here, so
        // the defect stops at the first stage rather than the second). The
        // manual override lives on PATCH /api/sites/{id}, where a user can
        // actually see and choose it.
        $data['timezone'] = self::timezoneFromCoordinates(
            isset($data['latitude']) ? (float) $data['latitude'] : null,
            isset($data['longitude']) ? (float) $data['longitude'] : null
        );

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

        SiteConfigWriter::createEmpty($site->id);
        // GH-474: the copy in the config is derived from the columns that own
        // those fields, at creation as at every other write. A site used to be
        // born with the column filled and the config empty — the state Russley
        // was found in — because nothing derived the copy here.
        $this->deriveOwnedCopies($site);

        $request->user()->forceFill(['last_active_site_id' => $site->id])->save();

        return response()->json([
            'data' => $this->sitePayload($site->load('configs')),
        ], 201);
    }

    // GH-442 (GH-439 stage 3): syncRegistry() and its route are gone. The
    // endpoint took a registry the browser assembled and wrote site rows from
    // it; stage 0 stopped it writing names or creating sites, stage 2 removed
    // the last caller, and this removes the door.

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

        // GH-371 (D01): computed before the write, not after -- GH-439 needs
        // the same answer to decide whether the time zone is re-derived, and
        // the site row must not have moved under it by then.
        $coordinatesChanged = ($this->coordinateChanged($previousLatitude, $data['latitude'] ?? null, $request->has('latitude')))
            || ($this->coordinateChanged($previousLongitude, $data['longitude'] ?? null, $request->has('longitude')));

        $data = $this->resolveTimezoneOnUpdate($request, $site, $data, $coordinatesChanged);

        $data['modified_by_user_id'] = $request->user()->id;
        $site->update($data);
        // GH-474: one place, after the columns are written, whichever route
        // wrote them. Only the columns this write actually set. The three regional integrations read the copy to choose
        // a country's product catalogue, and this route wrote the columns
        // without touching it — so a site that moved between countries kept
        // its old catalogue until somebody happened to write a config.
        $this->deriveOwnedCopies($site, array_values(array_intersect(
            array_keys($data),
            array_filter(array_values(FieldOwners::OWNERS))
        )));

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
        // GH-442 (review): the second read-modify-write on this row, and it
        // gets the same lock as the first.
        //
        // This one is not theoretical either: Settings saves its Site form
        // with Promise.all([PATCH /sites/{id}, PATCH .../config/gaip]), so
        // these two requests reach the same config row at the same moment by
        // design. Without the lock, whichever read first can write a merge
        // built on content the other has already replaced -- the same way the
        // three Generate patches lost one of their number.
        if ($coordinatesChanged) {
            // GH-447: through the same writer as every other config change,
            // which is what holds the lock. Settings fires this request and a
            // config patch together (Promise.all), so the two reach this row
            // at the same moment by design.
            SiteConfigWriter::mutate($site->id, 'gaip', function (array $config) {
                $hadCachedProgramme = isset($config['nutritionProgram'])
                    || isset($config['nutritionCalendarProgram'])
                    || isset($config['nutritionProgramCoords']);
                if (! $hadCachedProgramme) {
                    return null;
                }
                unset($config['nutritionProgram'], $config['nutritionCalendarProgram'], $config['nutritionProgramCoords']);

                return $config;
            });
        }

        return response()->json([
            'data' => $this->sitePayload($site->load('configs')),
        ]);
    }

    /**
     * GH-439 (2.5): decide what `sites.timezone` should hold after this
     * request.
     *
     * A non-empty `timezone` in the request is a manual override and is
     * stored exactly as sent -- that is what the Settings > Site select is
     * for, and it is the escape hatch for the sites where the derivation is
     * approximate (zone borders).
     *
     * An empty string is Settings' "Auto" option: derive from the
     * coordinates. So is a request that moves the site without naming a
     * zone, and so is a site whose zone is still empty.
     *
     * A request that says nothing about the time zone and does not move the
     * site leaves the column alone -- the key is dropped from $data rather
     * than written. This matters twice over: several PATCHes carry no time
     * zone at all (the Turf form's soil_texture_override, the zones editor,
     * the settings import), and re-deriving on those would silently undo a
     * manual override the user had chosen; and validate() hands back a
     * `timezone` key as null for a request that never sent one, so leaving
     * it in $data would blank the column instead.
     */
    private function resolveTimezoneOnUpdate(Request $request, Site $site, array $data, bool $coordinatesChanged): array
    {
        $submitted = $request->has('timezone') ? trim((string) $request->input('timezone', '')) : null;

        if ($submitted !== null && $submitted !== '') {
            $data['timezone'] = $submitted;

            return $data;
        }

        $currentTimezone = trim((string) ($site->timezone ?? ''));
        $shouldDerive = $submitted === '' || $coordinatesChanged || $currentTimezone === '';

        if (! $shouldDerive) {
            unset($data['timezone']);

            return $data;
        }

        $latitude = $request->has('latitude') ? ($data['latitude'] ?? null) : $site->latitude;
        $longitude = $request->has('longitude') ? ($data['longitude'] ?? null) : $site->longitude;

        $data['timezone'] = self::timezoneFromCoordinates(
            $latitude !== null ? (float) $latitude : null,
            $longitude !== null ? (float) $longitude : null
        );

        return $data;
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

        // GH-442 (GH-439 stage 3): a whole-object write to `gaip` is refused.
        //
        // This route took a config assembled in the browser and made it the
        // truth about a site. Everything that used to send one now sends the
        // change instead (PATCH .../config/gaip), and the guard that stood
        // here through stages 0-2 -- carrying omitted keys forward, restoring
        // blanked identity fields -- was a way of surviving those writes, not
        // a reason to keep accepting them. The stadium namespace has its own
        // plan and is untouched (decision 7).
        if ($namespace === 'gaip') {
            return response()->json([
                'message' => 'Whole-object writes are not accepted; use PATCH /api/sites/{site}/config/gaip.',
            ], 410);
        }
        $incomingConfig = $data['config'];

        // GH-442: only `gssh` reaches this point. The guard and the
        // programme rules that used to run here for `gaip` went with the
        // route (see the 410 above), and nothing else on this path is
        // namespace-specific.

        // GH-447: the stadium namespace writes through the same door.
        $config = SiteConfigWriter::mutate($site->id, $namespace, fn () => $incomingConfig);

        // GH-442: the site-column sync that stood here belonged to the `gaip`
        // path -- a gssh config carries no site location -- so $siteSync was
        // always empty by the time this ran.

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
     * GH-439: PATCH /api/sites/{site}/config/gaip -- how a site's
     * configuration changes.
     *
     * The body is the change, not the state: `patch` carries the sections or
     * fields the user (or the programme calculation) just altered, `clear`
     * names what they emptied. Everything the request does not mention is
     * left exactly as the database has it, so a page cannot undo an edit it
     * never knew about -- which is what the whole-object PUT did every time
     * two tabs, or a background snapshot and a real save, disagreed.
     *
     * Object sections merge field by field; scalars, arrays and the three
     * programme objects replace whole. `null` inside `patch` is refused
     * rather than interpreted (a client sending its own empty state looks
     * exactly like a person clearing a field) -- emptying something is
     * `clear`, and the fields a site cannot work without cannot be emptied
     * at all. The cached programme persists under GH-371's rules, unchanged.
     *
     * The response carries the merged config, and callers are expected to
     * update their own copy from it rather than from what they sent.
     */
    public function patchConfig(Request $request, string $site): JsonResponse
    {
        $site = $this->resolveAccessibleSite($request, $site);
        abort_unless($request->user()->canEditSite($site), 403);

        $data = $request->validate([
            'patch' => ['required_without:clear', 'array'],
            'clear' => ['sometimes', 'array'],
            'clear.*' => ['string'],
        ]);

        $patch = is_array($data['patch'] ?? null) ? $data['patch'] : [];
        $clear = array_values(array_filter($data['clear'] ?? [], 'is_string'));

        // GH-442 (review): read, merge and write under a row lock.
        //
        // This route reads the config, merges the patch in PHP and writes the
        // whole column back. Two patches that overlap each read the row before
        // the other has written it, and the second write -- built on content
        // that is already stale -- replaces the first. Both answer 200.
        //
        // That is not hypothetical: pressing Generate sends three patches
        // inside the same second, and in a failing run the first one vanished
        // whole, calendar and maxNPerMonth together, with nothing on screen to
        // say so. The defect arrived with stage 1: until then a config went up
        // as one PUT and there was no merge between requests to lose.
        //
        // The lock is here, in the one route that writes a gaip config, so
        // every caller is covered by the same guard rather than by a rule each
        // caller has to remember.
        // GH-447: the lock lives in SiteConfigWriter now, which is the only
        // thing in the product that writes this column.
        $outcome = ['status' => 500, 'body' => ['message' => 'Config write did not run.']];

        SiteConfigWriter::mutate($site->id, 'gaip', function (array $existing) use ($site, $request, $patch, $clear, &$outcome) {
            $rejection = $this->rejectInvalidGaipPatch($patch, $clear, $existing);
            if ($rejection !== null) {
                $outcome = ['status' => 422, 'body' => $rejection];

                return null; // nothing written
            }

            [$merged, $outcome] = $this->buildGaipPatchResult($site, $request, $patch, $clear, $existing);

            return $merged;
        });

        return response()->json($outcome['body'], $outcome['status']);
    }

    /**
     * GH-442/GH-447: the merge itself, called with the config row already
     * locked by SiteConfigWriter. Returns what to store and what to answer;
     * storing is the writer's job.
     *
     * @return array{0: array, 1: array{status: int, body: array}}
     */
    private function buildGaipPatchResult(Site $site, Request $request, array $patch, array $clear, array $existing): array
    {
        $context = $this->resolveGaipWriteContext($site, $patch, $clear);

        if (! $context['programmeTrusted']) {
            // An unstamped or stale programme is not written; what the
            // database already holds is left alone rather than replaced.
            foreach (self::GAIP_PROGRAMME_KEYS as $key) {
                unset($patch[$key]);
            }
        }

        $merged = $existing;
        foreach ($patch as $key => $value) {
            if (in_array($key, self::GAIP_OBJECT_SECTIONS, true)) {
                $section = is_array($merged[$key] ?? null) ? $merged[$key] : [];
                $merged[$key] = array_merge($section, $value);
                continue;
            }
            $merged[$key] = $value;
        }

        foreach ($clear as $path) {
            if (str_contains($path, '.')) {
                [$section, $field] = explode('.', $path, 2);
                if (is_array($merged[$section] ?? null)) {
                    unset($merged[$section][$field]);
                }
                continue;
            }
            unset($merged[$path]);
        }

        // GH-371 (D01): a write that genuinely moves the site drops the
        // cached programme -- it was computed for the old location.
        //
        // GH-440 (GH-439 review): a trusted programme in this same request
        // saves only the keys it actually carries. A PATCH may move the site
        // and bring a freshly stamped `nutritionCalendarProgram` without
        // `nutritionProgram` -- contract 2.1(6) allows the pair to arrive as
        // two events of one chain -- and the stored `nutritionProgram` from
        // the old location is as stale as any other. On the whole-object PUT
        // this could not happen: a key the payload omitted was a key deleted.
        if ($context['coordinatesChanging']) {
            foreach (self::GAIP_PROGRAMME_KEYS as $key) {
                if ($context['programmeTrusted'] && array_key_exists($key, $patch)) {
                    continue;
                }
                unset($merged[$key]);
            }
        }

        // The client does not send savedAt: a timestamp it chose is a
        // timestamp it can get wrong, and two tabs disagreeing about it is
        // how the old merge-by-savedAt logic picked the wrong copy.
        $merged['savedAt'] = now()->toISOString();

        if (! empty($context['siteSync'])) {
            $site->update($context['siteSync']);
        }

        // GH-474: the copy in `config.location` is DERIVED from the columns
        // that own those fields, here, after they are written — the one place,
        // whichever route did the writing.
        //
        // What it replaces: a client-written copy and a one-way mirror. Three
        // regional integrations read `getConfig(id).location.lat/lon` to decide
        // which country's recommender and product catalogue a client gets, and
        // `PATCH /api/sites/{id}` wrote the columns without touching the copy —
        // so a site that moved between countries kept its old catalogue until
        // somebody happened to write a config.
        $merged = FieldOwners::deriveCopies(
            $merged,
            array_intersect_key($this->ownedColumnValues($site), $context['siteSync'])
        );

        // The only trace of who changed what. Without it the next report of
        // a configuration reverting has nothing to read.
        Log::info('site-config.patch', [
            'site_id' => $site->id,
            'user_id' => $request->user()->id,
            'keys' => array_keys($patch),
            'clear' => $clear,
            'referer' => $request->headers->get('referer'),
        ]);

        return [
            $merged,
            [
                'status' => 200,
                'body' => [
                    'data' => [
                        'site_id' => $site->id,
                        'namespace' => 'gaip',
                        'config' => $merged,
                        'synced_at' => now()->toISOString(),
                    ],
                ],
            ],
        ];
    }

    /**
     * Rewrite every derived copy in the config from the columns that own it.
     *
     * The one place it happens. A copy that each writer is expected to keep
     * current is a copy that will be stale somewhere, which is exactly what
     * this refinement is about.
     */
    private function deriveOwnedCopies(Site $site, ?array $changedColumns = null): void
    {
        $values = $this->ownedColumnValues($site);
        if ($changedColumns !== null) {
            // GH-474: a copy follows its owner when the OWNER CHANGES. A write
            // that did not touch a column does not rewrite that column's copy,
            // and the difference matters: a row where the column is empty and
            // the config still holds a name is a pre-existing divergence, and
            // erasing it as a side effect of an unrelated coordinate patch
            // would destroy the only copy of that name. Such rows are the
            // repair command's, which fixes them from the owner deliberately
            // and prints what it changed.
            $values = array_intersect_key($values, array_flip($changedColumns));
        }
        SiteConfigWriter::mutate($site->id, 'gaip', function (array $stored) use ($values) {
            $next = FieldOwners::deriveCopies($stored, $values);

            return $next === $stored ? null : $next;
        });
    }

    /**
     * The current value of every column that owns a config field, keyed by
     * column name — what the copies are derived FROM.
     */
    private function ownedColumnValues(Site $site): array
    {
        $site->refresh();
        $values = [];
        foreach (FieldOwners::OWNERS as $field => $column) {
            if ($column === null) {
                continue;
            }
            $values[$column] = $site->{$column};
        }

        return $values;
    }

    /**
     * GH-439: everything a `gaip` PATCH can be refused for, as a 422 body
     * naming the keys -- or null when the request is acceptable.
     */
    private function rejectInvalidGaipPatch(array $patch, array $clear, array $existing): ?array
    {
        $unknown = array_values(array_diff(array_map('strval', array_keys($patch)), self::GAIP_CONFIG_KEYS));
        if ($unknown !== []) {
            return [
                'message' => 'Unknown site config key: '.implode(', ', $unknown).'.',
                'invalid_keys' => $unknown,
            ];
        }

        $nulls = [];
        foreach ($patch as $key => $value) {
            if ($value === null) {
                $nulls[] = (string) $key;
                continue;
            }
            if (! in_array($key, self::GAIP_OBJECT_SECTIONS, true)) {
                continue;
            }
            if (! is_array($value)) {
                return [
                    'message' => 'Section '.$key.' must be an object.',
                    'invalid_keys' => [(string) $key],
                ];
            }
            foreach ($value as $field => $fieldValue) {
                if ($fieldValue === null) {
                    $nulls[] = $key.'.'.$field;
                }
            }
        }
        if ($nulls !== []) {
            return [
                'message' => 'null is not a value; empty these with "clear" instead: '.implode(', ', $nulls).'.',
                'invalid_keys' => $nulls,
            ];
        }

        $blanked = [];
        foreach (self::GAIP_IDENTITY_FIELDS as [$section, $field]) {
            if (! is_array($patch[$section] ?? null) || ! array_key_exists($field, $patch[$section])) {
                continue;
            }
            if (! $this->isBlankConfigValue($patch[$section][$field])) {
                continue;
            }
            if ($this->isBlankConfigValue($existing[$section][$field] ?? null)) {
                continue;
            }
            $blanked[] = $section.'.'.$field;
        }
        if ($blanked !== []) {
            return [
                'message' => 'These fields cannot be emptied: '.implode(', ', $blanked).'.',
                'invalid_keys' => $blanked,
            ];
        }

        $invalidClear = [];
        foreach ($clear as $path) {
            $segments = explode('.', $path);
            $section = $segments[0];

            if (count($segments) > 2 || $section === '' || ! in_array($section, self::GAIP_CONFIG_KEYS, true)) {
                $invalidClear[] = $path;
                continue;
            }

            if (count($segments) === 1) {
                if (in_array($section, self::GAIP_UNCLEARABLE_SECTIONS, true)) {
                    $invalidClear[] = $path;
                }
                continue;
            }

            if (! in_array($section, self::GAIP_OBJECT_SECTIONS, true)) {
                $invalidClear[] = $path;
                continue;
            }

            foreach (self::GAIP_IDENTITY_FIELDS as [$identitySection, $identityField]) {
                if ($section === $identitySection && $segments[1] === $identityField) {
                    $invalidClear[] = $path;
                }
            }
        }
        if ($invalidClear !== []) {
            return [
                'message' => 'These cannot be cleared: '.implode(', ', $invalidClear).'.',
                'invalid_keys' => array_values(array_unique($invalidClear)),
            ];
        }

        return null;
    }

    /**
     * GH-439: a value that carries nothing -- absent, null, or a string of
     * whitespace. Zero is a value (a site can sit on the equator or the prime
     * meridian), and so is false.
     *
     * GH-442: this sat between two functions the withdrawn PUT route took with
     * it and was removed alongside them by mistake. rejectInvalidGaipPatch()
     * uses it, and eight PATCH tests said so on the next run.
     */
    private function isBlankConfigValue($value): bool
    {
        return $value === null || (is_string($value) && trim($value) === '');
    }

    /*
     * GH-442: guardWholeObjectGaipWrite() is gone too. It made a whole-object
     * write survivable -- carrying forward the keys a payload omitted, putting
     * back identity fields it had blanked -- which is how the product lived
     * with those writes through stages 0-2. The route refuses them now, so
     * there is nothing left to survive; the 410 case in GH439PutGuardTest is
     * what proves it.
     */

    /*
     * GH-442: resolveGaipConfigWrite() is gone with the PUT it served. The
     * rules it applied are not: GH-371's coordinate invalidation and GH-375's
     * "an actual programme, not a bare stamp" live in
     * resolveGaipWriteContext() below, which the PATCH route uses, and are
     * covered by GH439SiteConfigPatchTest.
     */

    /**
     * GH-439: what a `gaip` write -- whole-object PUT or PATCH -- has to
     * decide before it can persist anything: which site columns the payload
     * syncs onto, whether it is genuinely moving the site, and whether the
     * cached programme it carries (if any) can be trusted.
     *
     * The rules are GH-371's and GH-375's, unchanged; see
     * resolveGaipConfigWrite()'s docblock above for why each one exists.
     * They live here so the PATCH route enforces the same ones rather than
     * a second copy of them that can drift.
     *
     * On a PATCH, $incoming is the patch itself -- an absent `location`
     * simply means the write is not touching the coordinates, which is the
     * same answer the PUT path reaches for a payload that omits them.
     *
     * @return array{siteSync: array, coordinatesChanging: bool, programmeTrusted: bool}
     */
    private function resolveGaipWriteContext(Site $site, array $incoming, array $clear = []): array
    {
        $previousLatitude = $site->latitude;
        $previousLongitude = $site->longitude;

        $gaipLocation = is_array($incoming['location'] ?? null) ? $incoming['location'] : [];

        // GH-474: the fields of this section go to whoever OWNS them, by the
        // one table both sides read. Three of the four the Settings form sends
        // have a column — `name`, `lat`, `lon` — and `elevation` has none, so
        // the config owns that one and keeps it. Nothing is refused: both
        // senders keep working unchanged, and each field reaches its owner on
        // the first day rather than after a migration of the clients.
        $siteSync = FieldOwners::route(['location' => $gaipLocation])['columns'];
        // GH-474: emptying a field reaches its owner too. `clear` is how a
        // PATCH empties a field, and a field whose owner is a column is
        // emptied in the column.
        foreach ($clear as $path) {
            $column = FieldOwners::columnFor((string) $path);
            if ($column !== null) {
                $siteSync[$column] = null;
            }
        }

        // GH-472: the column is a mirror of `config.location.name`, so an
        // emptying reaches it too.
        //
        // `isset()` above answers false for a null and for an absent key
        // alike, which is right for "this write does not mention the name" and
        // wrong for "this write removes it". A PATCH empties a field through
        // `clear`, and `clear` never went past the config: the stored name
        // disappeared and the column kept the old one, so the two places
        // disagreed and nothing said so. That is the state Russley was found
        // in — `$.location.name` null with the column filled — and whichever
        // write produced it, this is the path by which such a difference can
        // exist at all.
        //
        // Cleared here rather than refused: the owner settled (question
        // 10.8(10)) that a site with no name for its place prints an empty
        // Location line, so an empty name is a legal state and the two places
        // simply have to agree on it.

        $newLat = (isset($gaipLocation['lat']) && is_numeric($gaipLocation['lat'])) ? (float) $gaipLocation['lat'] : null;
        $newLon = (isset($gaipLocation['lon']) && is_numeric($gaipLocation['lon'])) ? (float) $gaipLocation['lon'] : null;
        // A coordinate that is not a number is not a coordinate; the routing
        // above carried whatever arrived, and this is where it becomes one.
        if ($newLat !== null) {
            $siteSync['latitude'] = $newLat;
        } else {
            unset($siteSync['latitude']);
        }
        if ($newLon !== null) {
            $siteSync['longitude'] = $newLon;
        } else {
            unset($siteSync['longitude']);
        }

        $coordinatesChanging = $this->coordinateChanged($previousLatitude, $newLat, $newLat !== null)
            || $this->coordinateChanged($previousLongitude, $newLon, $newLon !== null);

        $targetLat = $newLat ?? $previousLatitude;
        $targetLon = $newLon ?? $previousLongitude;

        $hasProgramData = (array_key_exists('nutritionProgram', $incoming) && $incoming['nutritionProgram'] !== null)
            || (array_key_exists('nutritionCalendarProgram', $incoming) && $incoming['nutritionCalendarProgram'] !== null);

        // GH-371: the stamp comes from the request or not at all.
        //
        // GH-440 (review): this briefly fell back to the stamp already in the
        // database when a patch carried `nutritionProgram` alone, so that the
        // second event of a generated programme (the calendar and its product
        // programme arrive as two writes -- contract 2.1(6)) would be
        // accepted. It let a stale tab through: its calendar was refused for
        // being computed elsewhere, and the product programme built from that
        // same calendar then landed under the stored stamp, leaving a
        // programme for one location beside a calendar for another -- which
        // no read path can see, because every staleness check reads the
        // calendar. The second event states its own origin now (the
        // integrations pass the calendar's own meta.lat/lon, see
        // nutrition-calendar.js coordsFromCalendar()), so the server never
        // has to supply a stamp for anyone. (The $existing parameter that fed
        // that fallback is gone with it -- GH-441.)
        $stamp = $incoming['nutritionProgramCoords'] ?? null;
        $stampLat = (is_array($stamp) && isset($stamp['lat']) && is_numeric($stamp['lat'])) ? (float) $stamp['lat'] : null;
        $stampLon = (is_array($stamp) && isset($stamp['lon']) && is_numeric($stamp['lon'])) ? (float) $stamp['lon'] : null;
        $stampFresh = $stampLat !== null && $stampLon !== null
            && ! $this->coordinateChanged($stampLat, $targetLat, true)
            && ! $this->coordinateChanged($stampLon, $targetLon, true);

        return [
            'siteSync' => $siteSync,
            'coordinatesChanging' => $coordinatesChanging,
            'programmeTrusted' => $hasProgramData && $stampFresh,
        ];
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
            // GH-482: the two hand-set columns this row owns. Both have
            // existed since the initial schema and both are accepted by the
            // PATCH above; neither was ever returned, so a client that needed
            // the site's soil texture had nowhere to read it by id and took
            // the page's own copy instead — the texture of whatever site the
            // page was last rendered for. `account_soil_texture` is the second
            // link of the same setting, the one the server itself falls back
            // to (`$site->soil_texture_override ?: $site->account->soil_texture`,
            // SampleController.php:480, ReportsController.php:84), so the
            // client can apply the same two-link rule rather than a different
            // one.
            'methodology_override' => $site->methodology_override,
            'soil_texture_override' => $site->soil_texture_override,
            'account_soil_texture' => $site->account?->soil_texture,
            // GH-439 (2.5): what the time zone would be if derived from this
            // site's coordinates -- what Settings > Site shows behind its
            // "Auto" option, and how a page tells a manual override from a
            // derived value. Null when the site has no coordinates.
            'timezone_derived' => self::timezoneFromCoordinates(
                $site->latitude !== null ? (float) $site->latitude : null,
                $site->longitude !== null ? (float) $site->longitude : null
            ),
            'configs' => $site->configs->mapWithKeys(fn (SiteConfig $config) => [
                $config->namespace => [
                    'config' => $config->config ?? [],
                    'synced_at' => $config->synced_at?->toISOString(),
                ],
            ]),
        ];
    }
}
