<?php

namespace App\Http\Controllers;

use App\Models\Account;
use App\Models\Site;
use App\Models\SiteConfig;
use App\Support\CalculationInputs;
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
     * GH-789 (queue item 7): the object fields INSIDE a section that merge by
     * key as the section itself does, one level deeper.
     *
     * `array_merge` below merges a section's own keys and stops there, so a
     * patch carrying `traffic.schedule` replaced the stored schedule whole.
     * That is the GH-439 class the note further down says this route was built
     * to avoid -- "a key the payload omitted was a key deleted" -- surviving
     * one level lower. Measured on the stand: a schedule holds up to 19
     * fields, and five of them are the declared storage of three inputs of the
     * list (`soil.moisture`, `soil.compaction` three ways, the root depth), so
     * the setup wizard sending its two numbers would have taken the other
     * seventeen with it.
     *
     * A field named here keeps what the request does not mention; a field the
     * request does mention is overwritten, and emptying one is still `clear`'s
     * job, exactly as for a section.
     */
    private const GAIP_MERGED_SUBOBJECTS = [
        'traffic' => ['schedule'],
    ];

    /**
     * GH-789 (queue item 7): GAIP_IDENTITY_FIELDS stood here -- five fields named by hand that no write
     * could blank. It was the third of four hand-written answers to "which inputs are required", and the
     * list is the only one now. What replaced it is a judgement on the RESULT, which is strictly wider:
     * the old list held five fields, the list holds nine required inputs (eight for a lawn), and it knows
     * that a golf surface is required of golf alone -- a condition five names in a row cannot express.
     *
     * The rule below examines an input when the request TOUCHES it (in `patch` or in `clear`) or when the
     * request names the PLACE that collects it. So `clear: ['turf.species']` is still refused, by the same
     * sentence as an empty cultivar on the Turf tab, and the Settings tab that did not collect a field is
     * not refused because of it -- the owner's "as usual in settings", each tab answering for its own.
     */

    /**
     * GH-583, reversed in part by GH-684: values that are a stand-in rather than an answer.
     *
     * `generic` USED TO BE REFUSED HERE. The reasoning was that the wizard wrote it on every
     * site it created, so it read as a choice while being the absence of one, and every
     * multiplier keyed on cultivar quietly uses 1.00 for it.
     *
     * THE OWNER REVERSED IT, 24.09.2026 17:32 (GH-684): `generic` comes BACK, and where a site
     * had it and a calculation was built on it, it COUNTS AS FILLED. The one condition she
     * attached is the WIZARD -- there they must state WHICH CULTIVAR IT WAS, so the choice is
     * made knowingly from the list, or `generic` is left standing. Her words are quoted
     * verbatim in PLAN-remaining-defects-RU.md under GH-684; a comment carries the decision,
     * not the quote, because only our plans and documents are written in Russian. So it is a
     * choice a person may make, it counts as filled, and the server stores it.
     *
     * WHAT MOVED INSTEAD OF THIS REFUSAL: the wizard must not write a cultivar NOBODY CHOSE.
     * The door is no longer where the value is judged; it is where the person is asked.
     *
     * THE TABLE IS EMPTY BY DECISION, and the two lines that read it stay. An empty mechanism
     * is normally a candidate for removal in this repository — it is kept here because its
     * next case is one decision away and the reversal is the owner's rather than a design
     * that failed. If it is still empty when the next stand-in question is settled, it should
     * go rather than wait.
     */
    private const GAIP_REFUSED_VALUES = [];

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
            // GH-520: no rule for `methodology_override` — the field is no
            // longer accepted here, because the methodology has one owner and
            // it is written through the config route.
            'soil_texture_override' => ['nullable', 'string', 'max:32'],
            'attributes_json' => ['nullable', 'array'],
            'precinct_group_id' => ['nullable', 'integer', 'exists:precinct_groups,id'],
            'parent_site_id' => ['nullable', 'string', Rule::exists('sites', 'id')->whereNot('id', $site->id)],
        ]);

        /**
         * GH-797 — A REQUIRED INPUT KEPT IN A COLUMN IS NOT EMPTIED HERE, AND THE ANSWER NAMES THE FIELD.
         *
         * The config route has refused such a write since GH-789; this route stores the other half of the
         * list (`storedIn: siteColumn`) and did not judge it at all, so the obligation the owner decided on
         * 01.10.2026 could be undone by the request that writes the column. Nothing is written when this
         * refuses — the check stands before the transaction below.
         *
         * THERE IS NO EXCEPTION FOR THE IMPORT, and that is the owner's decision of 01.10.2026 rather than
         * an oversight. The import used to clear this column, so an obligation judged here would have
         * refused it with its samples already replaced; her answer was to stop the clearing instead, in her
         * words: "then if the import fails now, okay, then during an import just do not delete that field
         * for now." So the import no longer says anything about this column (`settings-init.js`,
         * `applySiteConfig`) and never reaches this refusal, and no write is allowed to leave a required
         * column empty. What an import should do with the texture in the end is her open question.
         */
        $missingColumns = $this->missingRequiredSiteColumns($site, $data);
        if ($missingColumns !== []) {
            return response()->json([
                'message' => 'Not saved: fill in '
                    .$this->readAsList(array_column($missingColumns, 'label')).'.',
                'missing' => $missingColumns,
                // The older field, kept: callers written against it read the same refusal.
                'invalid_keys' => array_column($missingColumns, 'input'),
            ], 422);
        }

        // GH-634 (queue item 17, plan section 2a): the same condition on this
        // route, for the columns that OWN a config field. `FieldOwners::OWNERS`
        // says which those are; a second list is not kept.
        $expected = $request->validate(['expected' => ['sometimes', 'array']])['expected'] ?? [];
        $expected = is_array($expected) ? $expected : [];

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

        // GH-634 (plan section 2a) — ONE DOOR FOR THE ROW AND ITS COPIES.
        //
        // The row was written here with no transaction and no lock, and its
        // derived copies were written afterwards under the config lock, from
        // values read outside it. Two writers therefore left the column holding
        // one coordinate and the config copy another, measured in
        // `Gh633ConfigPatchRaceMeasureTest`. Now: one transaction, the site row
        // locked FIRST — the single lock order shared with `patchConfig` — and
        // the copies derived inside it.
        $conflicts = [];
        DB::transaction(function () use ($site, $data, $expected, &$conflicts) {
            Site::query()->whereKey($site->id)->lockForUpdate()->first();
            $site->refresh();

            $conflicts = $this->conflictingColumnExpectations($site, $expected);
            if ($conflicts !== []) {
                return; // nothing written
            }

            $site->update($data);

            // GH-474: one place, after the columns are written, whichever route
            // wrote them. Only the columns this write actually set. The three
            // regional integrations read the copy to choose a country's product
            // catalogue, and this route wrote the columns without touching it —
            // so a site that moved between countries kept its old catalogue
            // until somebody happened to write a config.
            $this->deriveOwnedCopies($site, array_values(array_intersect(
                array_keys($data),
                array_filter(array_values(FieldOwners::OWNERS))
            )));
        });

        if ($conflicts !== []) {
            return response()->json([
                'message' => 'These fields changed after the page was opened: '
                    .implode(', ', array_keys($conflicts)).'.',
                'conflicts' => $conflicts,
            ], 409);
        }

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
            // GH-634 (queue item 17, stage 2): the condition on each field the
            // writer is changing — the value the person SAW, keyed by dotted
            // path. It is compared and thrown away; it is never stored, so the
            // browser still sends a change and not a state.
            'expected' => ['sometimes', 'array'],
            /**
             * GH-789 (queue item 7): WHICH PLACE IS SAVING. A Settings tab names its own place -- a key
             * the list already declares in `places` -- and the server then judges that tab by the inputs
             * that place collects. Absent, only the inputs the request touches are judged, which is what
             * every other caller (the setup wizard, the run frame) does.
             */
            'place' => ['sometimes', 'string'],
        ]);

        $patch = is_array($data['patch'] ?? null) ? $data['patch'] : [];
        $clear = array_values(array_filter($data['clear'] ?? [], 'is_string'));
        $expected = is_array($data['expected'] ?? null) ? $data['expected'] : [];

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

        $write = function () use ($site, $request, $patch, $clear, $expected, &$outcome) {
            SiteConfigWriter::mutate($site->id, 'gaip', function (array $existing) use ($site, $request, $patch, $clear, $expected, &$outcome) {
                $rejection = $this->rejectInvalidGaipPatch($patch, $clear, $existing);
                if ($rejection !== null) {
                    $outcome = ['status' => 422, 'body' => $rejection];

                    return null; // nothing written
                }

                // GH-634: the comparison happens HERE, inside the closure, under
                // the same row lock that will do the writing. Moved out from
                // under it, it would be a check with a gap between itself and
                // the write — which is the race it exists to close.
                $conflicts = $this->conflictingExpectations($site, $expected, $existing);
                if ($conflicts !== []) {
                    $outcome = ['status' => 409, 'body' => [
                        'message' => 'These fields changed after the page was opened: '
                            .implode(', ', array_keys($conflicts)).'.',
                        'conflicts' => $conflicts,
                    ]];

                    return null; // nothing written
                }

                [$merged, $outcome] = $this->buildGaipPatchResult($site, $request, $patch, $clear, $existing);

                return $merged;
            });
        };

        // GH-634 (plan section 2a): ONE LOCK ORDER ON EVERY PATH — the site row
        // first, the config row second. This route takes the config row and
        // writes owned columns from inside it; `update()` writes the row and
        // then takes the config. If both took real locks in those two orders,
        // that is a deadlock. So when this patch touches a field whose owner is
        // a column, the site row is locked here, before the config.
        if ($this->touchesOwnedColumn($patch, $clear)) {
            DB::transaction(function () use ($site, $write) {
                Site::query()->whereKey($site->id)->lockForUpdate()->first();
                $write();
            });
        } else {
            $write();
        }

        return response()->json($outcome['body'], $outcome['status']);
    }

    /**
     * GH-634 (queue item 17, stage 2) — the condition on each changed field:
     * what the person saw, against what is stored NOW.
     *
     * A writer says `expected: {"turf.construction": "sand_profile"}` — the
     * value its form was showing when it loaded. If the stored value is no
     * longer that, somebody else changed it after the page opened, and the
     * write is refused instead of quietly undoing their change. That undoing is
     * the defect this closes, measured in `Gh633ConfigPatchRaceMeasureTest`:
     * tab A saved its Turf section and tab B's `construction` went back to its
     * old value, both requests answering 200.
     *
     * A FIELD WHOSE OWNER IS A COLUMN IS COMPARED AGAINST THE COLUMN, not
     * against the config's copy of it. The copy is derived; comparing it would
     * be asking the copy whether the owner has moved.
     *
     * `expected` is compared and dropped. Nothing stores it, so what the browser
     * sends is still a change rather than a state — the value on the page
     * travels as a CONDITION, and the server is the only thing that decides.
     *
     * @param  array<string, mixed>  $expected  dotted path => value seen
     * @return array<string, array{expected: mixed, current: mixed}>
     */
    private function conflictingExpectations(Site $site, array $expected, array $existing): array
    {
        $conflicts = [];
        foreach ($expected as $path => $seen) {
            $path = (string) $path;
            $column = FieldOwners::columnFor($path);
            if ($column !== null) {
                $site->refresh();
                $current = $site->{$column};
            } else {
                $current = data_get($existing, $path);
            }

            if (! $this->sameConfigValue($seen, $current)) {
                $conflicts[$path] = ['expected' => $seen, 'current' => $current];
            }
        }

        return $conflicts;
    }

    /**
     * Equality for a condition, and it is deliberately lenient about SHAPE
     * rather than about value: a number that travelled through JSON comes back
     * as `25` or `"25"` or `25.0` depending on who sent it and which column it
     * came out of, and a condition that failed on that would refuse every save
     * on a site nobody had touched. Null and absent are the same thing here —
     * "the field had no value" — because that is what the config route already
     * means by them everywhere else.
     */
    private function sameConfigValue(mixed $a, mixed $b): bool
    {
        if ($a === null || $a === '') {
            return $b === null || $b === '';
        }
        if (is_bool($a) || is_bool($b)) {
            return (bool) $a === (bool) $b;
        }
        if (is_numeric($a) && is_numeric($b)) {
            return abs(((float) $a) - ((float) $b)) < 1e-9;
        }
        if (is_array($a) || is_array($b)) {
            return json_encode($a) === json_encode($b);
        }

        return (string) $a === (string) $b;
    }

    /**
     * GH-634 (plan section 2a) — the same condition, for the columns.
     *
     * The paths are the config's (`location.lat`), because that is the language
     * both the browser and `FieldOwners` speak; the value compared is the
     * COLUMN's, because the column is the owner. A path with no column is
     * ignored here — it belongs to the config route's own comparison — so a
     * client may send one `expected` map and each half takes what is its own.
     *
     * @param  array<string, mixed>  $expected
     * @return array<string, array{expected: mixed, current: mixed}>
     */
    private function conflictingColumnExpectations(Site $site, array $expected): array
    {
        $conflicts = [];
        foreach ($expected as $path => $seen) {
            $column = FieldOwners::columnFor((string) $path);
            if ($column === null) {
                continue;
            }
            $current = $site->{$column};
            if (! $this->sameConfigValue($seen, $current)) {
                $conflicts[(string) $path] = ['expected' => $seen, 'current' => $current];
            }
        }

        return $conflicts;
    }

    /**
     * GH-634: does this patch touch a field the `sites` row owns?
     *
     * Asked of `FieldOwners::OWNERS`, the one table both sides read — a second
     * list of "which fields are columns" is the thing that table exists to
     * prevent.
     */
    private function touchesOwnedColumn(array $patch, array $clear): bool
    {
        foreach (array_keys(FieldOwners::OWNERS) as $path) {
            if (FieldOwners::columnFor($path) === null) {
                continue;
            }
            if (data_get($patch, $path) !== null) {
                return true;
            }
            if (in_array($path, $clear, true)) {
                return true;
            }
        }

        return false;
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
                // GH-789: and the declared object fields of the section merge too.
                foreach (self::GAIP_MERGED_SUBOBJECTS[$key] ?? [] as $field) {
                    if (! is_array($section[$field] ?? null) || ! is_array($value[$field] ?? null)) {
                        continue;
                    }
                    $merged[$key][$field] = array_merge($section[$field], $value[$field]);
                }
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
        /**
         * GH-789 (queue item 7) — A REQUIRED INPUT IS NOT LEFT EMPTY, AND THE ANSWER NAMES THE FIELD.
         *
         * Judged on the RESULT and not on the patch: the four hand-written answers to "which inputs are
         * required" are gone (the template's `required` attribute, the browser's identity list, this
         * controller's identity list, the form's own checks), and what is left is the list, read here.
         * Nothing is written when this refuses -- not one field of the form.
         *
         * WHICH INPUTS ARE EXAMINED: the ones this write TOUCHES, plus the ones the named place collects.
         * The first is what replaces "these fields cannot be emptied" and keeps it for every caller; the
         * second is the owner's decision of 29.09.2026 for a Settings tab, and it is per place because a
         * tab answers for its own fields -- saving Site settings is not refused over an empty cultivar on
         * the Turf tab.
         */
        $missing = $this->missingRequiredInputs($merged, $patch, $clear, (string) $request->input('place', ''));
        if ($missing !== []) {
            return [
                null,
                ['status' => 422, 'body' => [
                    'message' => 'Not saved: fill in '
                        .$this->readAsList(array_column($missing, 'label')).'.',
                    'missing' => $missing,
                    // The older field, kept: callers written against it read the same refusal.
                    'invalid_keys' => array_column($missing, 'input'),
                ]],
            ];
        }

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
     * GH-789 (queue item 7): the required inputs this write would leave empty, as `[{input, label}]`.
     *
     * The words are the list's own, so the sentence a person reads on a Settings tab, in the setup wizard
     * and in the panel that names an incomplete run is one sentence from one place.
     *
     * @param  array<string,mixed>  $merged   what the config would hold
     * @param  array<string,mixed>  $patch    what this request sends
     * @param  array<int,string>    $clear    what this request empties
     * @return array<int,array{input: string, label: string}>
     */
    private function missingRequiredInputs(array $merged, array $patch, array $clear, string $place): array
    {
        $turfType = $merged['turf']['turfType'] ?? '';
        $turfType = is_string($turfType) ? $turfType : '';

        $examined = CalculationInputs::requiredAtPlace($place, $turfType);
        foreach (CalculationInputs::requiredOnEveryWrite() as $key) {
            if (! in_array($key, $examined, true)) {
                $examined[] = $key;
            }
        }
        foreach (CalculationInputs::requiredFor($turfType) as $key) {
            if (in_array($key, $examined, true) || ! $this->writeTouches($key, $patch, $clear)) {
                continue;
            }
            $examined[] = $key;
        }

        /**
         * GH-797 (queue item 3ashch) — A ROUTE JUDGES THE OBLIGATIONS IT STORES.
         *
         * This route writes the config and reads the result out of it, so it answers for the inputs the
         * list keeps in the config. The soil texture is the first required input kept elsewhere — a column
         * of `sites` — and judged here it would be read out of a config that never holds it, so every save
         * of a Turf tab would be refused over a texture the site already carries. The route that writes
         * that column judges it instead (`update`).
         */
        $examined = array_values(array_filter(
            $examined,
            fn (string $key) => in_array('config', CalculationInputs::storedIn($key) ?? [], true)
        ));

        $missing = [];
        foreach ($examined as $key) {
            if (CalculationInputs::isFilled($key, CalculationInputs::valueIn($merged, $key))) {
                continue;
            }
            $missing[] = ['input' => $key, 'label' => (string) (CalculationInputs::label($key) ?? $key)];
        }

        return $missing;
    }

    /**
     * GH-797 (queue item 3ashch) — THE REQUIRED INPUTS THIS WRITE OF THE SITE ROW WOULD LEAVE EMPTY.
     *
     * The other half of the rule above: the route that stores a column answers for the obligations kept in
     * columns. Same shape and same words as the config route's refusal, from the same list, so a person
     * reading "Not saved: fill in the soil texture." cannot tell which route said it — and nothing is
     * written when it does.
     *
     * ONLY WHAT THE REQUEST TOUCHES. A PATCH that says nothing about a column is not refused over it:
     * Settings sends the coordinates on one tab and the texture on another, and the setup wizard sends a
     * location before anybody has reached the step that asks for a texture. Measured on this Laravel,
     * 01.10.2026: `validate()` returns a key only when the request carried it, so a request that omits the
     * column is distinguishable from one that sends it empty.
     *
     * @param  array<string,mixed>  $data  the validated request, which is what the row would hold
     * @return array<int,array{input: string, label: string}>
     */
    private function missingRequiredSiteColumns($site, array $data): array
    {
        $record = $site->configs()->where('namespace', 'gaip')->first();
        $config = is_array($record?->config) ? $record->config : [];
        $turfType = $config['turf']['turfType'] ?? '';

        $missing = [];
        foreach (CalculationInputs::requiredFor(is_string($turfType) ? $turfType : '') as $key) {
            $column = CalculationInputs::siteColumnOf($key);
            if ($column === null || ! array_key_exists($column, $data)) {
                continue;
            }
            if (CalculationInputs::isFilled($key, $data[$column])) {
                continue;
            }
            $missing[] = ['input' => $key, 'label' => (string) (CalculationInputs::label($key) ?? $key)];
        }

        return $missing;
    }

    /** Does this request say anything at all about that input -- setting it, or emptying it? */
    private function writeTouches(string $key, array $patch, array $clear): bool
    {
        if (in_array($key, $clear, true)) {
            return true;
        }
        $segments = explode('.', $key, 2);
        if (count($segments) === 1) {
            return array_key_exists($key, $patch);
        }
        [$section, $field] = $segments;
        if (in_array($section, $clear, true)) {
            return true;
        }

        return is_array($patch[$section] ?? null) && array_key_exists($field, $patch[$section]);
    }

    /** "a, b and c" -- one sentence rather than a list a person has to read as code. */
    private function readAsList(array $words): string
    {
        $words = array_values(array_unique(array_filter($words, 'is_string')));
        if (count($words) <= 1) {
            return (string) ($words[0] ?? '');
        }
        $last = array_pop($words);

        return implode(', ', $words).' and '.$last;
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
        SiteConfigWriter::mutate($site->id, 'gaip', function (array $stored) use ($site, $changedColumns) {
            // GH-634 (plan section 2a) — THE VALUES ARE READ INSIDE THE LOCK
            // THAT WRITES THE COPY.
            //
            // They used to be read before `mutate` was called, by
            // `$site->refresh()` outside any lock, and the gap between that read
            // and this write is a race with a measured outcome: with a second
            // writer landing in between, `sites.latitude` held -36.85 while
            // `config.location.lat` held -41.29 (`Gh633ConfigPatchRaceMeasureTest`).
            // Whoever reads the config then sees a coordinate its owner does not
            // hold. Read here, the copy can only be derived from the row as it
            // stands under the lock.
            $values = $this->ownedColumnValues($site);
            // GH-474: a copy follows its owner when the OWNER CHANGES. A write
            // that did not touch a column does not rewrite that column's copy,
            // and the difference matters: a row where the column is empty and
            // the config still holds a name is a pre-existing divergence, and
            // erasing it as a side effect of an unrelated coordinate patch
            // would destroy the only copy of that name. Such rows are the
            // repair command's, which fixes them from the owner deliberately
            // and prints what it changed.
            if ($changedColumns !== null) {
                $values = array_intersect_key($values, array_flip($changedColumns));
            }

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

        // GH-583/GH-684: the table of refused values, empty by the owner's decision.
        foreach (self::GAIP_REFUSED_VALUES as $path => $refused) {
            [$section, $field] = explode('.', $path, 2);
            $value = $patch[$section][$field] ?? null;
            if (is_string($value) && in_array(strtolower(trim($value)), $refused, true)) {
                return [
                    'message' => $path.' may not be "'.$value.'": that is the absence of a choice, not a choice. '
                        .'Send the site\'s own value, or leave the field out.',
                    'invalid_keys' => [$path],
                ];
            }
        }


        /**
         * GH-789 (queue item 7): GH-684's separate methodology invariant stood here — "a config whose
         * result has no methodology is refused", the owner's decision of 24.09.2026. It is the same rule
         * as the one below, with a wider reach: judged on every write rather than at the place that
         * collects it. So the reach is DECLARED in the list (`requiredOnEveryWrite` on `turf.methodology`)
         * and the refusal comes from one place, in one sentence, with the field marked — instead of two
         * sentences for one empty field, only one of which a form could point at.
         */

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

            // GH-789: a `clear` of a required input is not refused here for being on a list -- it is
            // refused below, by what the RESULT would hold, which is where every other answer about a
            // required input now comes from.
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
     * GH-789 (queue item 7): `isBlankConfigValue` stood here and was the THIRD rule of "filled" in the
     * tree, beside `RunStart::filled` and the lock's own. Two of the three are gone now and this is the
     * third: the one rule is `CalculationInputs::isFilled`, which reads the list's declaration of what
     * makes an object input filled and says that nought IS a value. This one agreed about a string and a
     * null and knew nothing about an object, so a match-and-training schedule of nothing but `null`s
     * counted as entered -- and the Settings form sends every key it has on every save, so that was
     * every save.
     */

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
            // GH-520: `methodology_override` is no longer echoed. Measured
            // before removing it: zero readers of the key in assets/.
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
