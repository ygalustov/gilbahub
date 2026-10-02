<?php

namespace App\Services;

use App\Models\Sample;
use App\Models\Site;
use App\Models\Zone;
use App\Support\CalculationInputs;
use App\Support\NameOrder;
use App\Support\ZoneTypes;
use Illuminate\Support\Facades\DB;

/**
 * GH-800 (queue item "Zones", stage C1) — THE ONE WRITER OF A ZONE.
 *
 * WHY A SERVICE AND NOT A LINE IN EACH CONTROLLER. A zone's name arrives by five roads today — the
 * Data page, the CSV import, the Hill Labs import, the per-record POST and the bulk push — and before
 * this they each merged it into a list on the site by their own copy of the same three lines. The rule
 * the stage puts in place is that the zone itself has one writer, so that "which zone is this" has one
 * answer and the day a rule about names changes it changes once. The guard
 * `Gh800NobodyButTheServiceWritesAZoneTest` holds that: an insert into `zones` anywhere else is red.
 *
 * WHAT IT DOES NOT DO IN THIS STAGE, and these are omissions on purpose rather than gaps:
 *   - *(stage C2, GH-801: the Settings tab arrived, and with it the one door it saves through —
 *     `applyFromSettings` below. The separate `rename` and `setType` the plan first named are still not
 *     here, and now for a second reason beside "no caller": the obligation the owner chose is judged on
 *     the RESULT of a save, which a method that changes one zone cannot see.)*
 *   - it does not check rights. Every caller is a controller that has already answered
 *     `canEditSite` for this site before it gets here, and a second gate inside the service would be a
 *     second declaration of the same rule — the thing this class exists to remove. The entry points
 *     keep the rights, and their own cases keep them honest.
 *   - nothing reads `zone_id` yet. That is stage C3; the rule is that nothing starts reading a field
 *     before something writes it, and this stage is the writing.
 *
 * THE OLD WRITES CONTINUE. `payload._label`, `payload._zone`, `payload.zone` and the site's own list of
 * zone names are written exactly as before, by the code that already wrote them. No reader loses
 * anything, because no reader has been moved yet.
 */
class ZoneService
{
    /**
     * The zone of this site by this name, making it if the site has none — the owner's decision of
     * 22.09.2026: "if there is none, create it, without a type".
     *
     * ONE ZONE PER DISTINCT NAME, WITHOUT CASE, which is the same rule the transfer applied in stage
     * C0: `Green 1` and `green 1` are one place. The comparison lives here rather than in an index
     * because this MySQL cannot express a case-insensitive uniqueness without a generated column — the
     * migration says so too, and this is the writer it points at.
     *
     * The name is stored as the person wrote it. A zone that already exists keeps the spelling it was
     * created with: renaming is a separate act, and arriving at an existing zone under another case is
     * not a request to rename it.
     *
     * @param  string  $name  the zone's name as a person entered it
     * @return Zone|null  null only when the name is empty, which is "no zone", not a zone called ""
     */
    public function resolveOrCreate(Site $site, ?string $name, ?int $userId = null): ?Zone
    {
        $trimmed = trim((string) $name);
        if ($trimmed === '') {
            return null;
        }

        /**
         * Two requests saving the same new name at once would both find nothing and both insert. The
         * unique index on `(site_id, name)` is what actually decides, and the loser reads the winner's
         * row rather than failing the save: a person pressing Save twice gets one zone, not an error.
         */
        $existing = $this->byName($site, $trimmed);
        if ($existing) {
            return $existing;
        }

        try {
            return Zone::query()->create([
                'site_id' => $site->id,
                'name' => $trimmed,
                // Empty, always, by the owner's decision. A type guessed from the name is the
                // substitution this whole queue item removes.
                'zone_type' => null,
                'created_by_user_id' => $userId ?? 0,
                'modified_by_user_id' => $userId ?? 0,
            ]);
        } catch (\Illuminate\Database\UniqueConstraintViolationException $e) {
            return $this->byName($site, $trimmed);
        }
    }

    /**
     * The zones of a site, oldest first, as a page will receive them from stage C2 onwards.
     *
     * `zoneType` travels as the KEY it is stored as, with the words beside it from the one dictionary,
     * so a page never has to know a label — and a zone with no type carries null rather than a word
     * standing in for one.
     *
     * @return array<int,array<string,mixed>>
     */
    public function forThePage(Site $site): array
    {
        /**
         * GH-817 (queue item "Zones"): in name order (`NameOrder`, the owner's request), and each zone with
         * the number of its live samples and, when it has any, the sentence a person reads on the Zones tab
         * when they try to remove it -- built by the same builder as the save's refusal, so the page holds
         * no words about samples of its own. The count is the one the save's refusal counts (`inUse`).
         */
        $zones = $this->ofSite($site)->sort(fn (Zone $a, Zone $b) => NameOrder::compare($a->name, $b->name))->values();
        $samples = Sample::query()->whereIn('zone_id', $zones->pluck('id')->all())
            ->selectRaw('zone_id, count(*) as n')->groupBy('zone_id')->pluck('n', 'zone_id')->all();

        return $zones->map(function (Zone $zone) use ($samples) {
            $count = (int) ($samples[$zone->id] ?? 0);

            return [
                'id' => $zone->id,
                'name' => $zone->name,
                'zoneType' => $zone->zone_type,
                'zoneTypeLabel' => ZoneTypes::zoneTypeLabel($zone->zone_type),
                'samples' => $count,
                'removeRefusal' => $count > 0 ? self::removeRefusal($zone->name, $count) : null,
            ];
        })->all();
    }

    /**
     * GH-817 — THE WORDS ABOUT A ZONE THAT STILL HAS SAMPLES, IN ONE PLACE.
     *
     * Two surfaces say it: the cross of the Zones tab (one zone) and the refusal of a save (one or more
     * zones). The clause carries the number and its plural; the tail says what to do. The tab's sentence is
     * the clause and the tail; the refusal joins the clauses and puts the tail once.
     */
    public static function samplesClause(string $zone, int $samples): string
    {
        return $zone.' has '.$samples.' '.($samples === 1 ? 'sample' : 'samples');
    }

    public static function samplesTail(): string
    {
        return 'Move or delete them first.';
    }

    public static function removeRefusal(string $zone, int $samples): string
    {
        return self::samplesClause($zone, $samples).'. '.self::samplesTail();
    }

    /** @return \Illuminate\Database\Eloquent\Collection<int,Zone> */
    public function ofSite(Site $site)
    {
        return Zone::query()->where('site_id', $site->id)->orderBy('created_at')->orderBy('name')->get();
    }

    /**
     * GH-801 (stage C2) — THE ONE DOOR THE ZONES TAB SAVES THROUGH, AND IT IS JUDGED ON THE RESULT.
     *
     * WHAT THE OWNER DECIDED, 01.10.2026, and this method is that decision: a zone's type is required,
     * and the Zones tab "saves nothing while the site still has one zone with no type" — her variant (b),
     * chosen after she was shown its price (73 zones on 13 sites to fill in by hand, and the tab closed on
     * every one of them until she does). The Data page and the import are untouched by it, in her words:
     * "we do not change the add interface". That is why `resolveOrCreate` above asks nothing.
     *
     * JUDGED ON THE RESULT, NOT ON THE REQUEST, and without that this stage would have shipped a dead
     * end: a door that refused each change while any zone was untyped would have refused the very save
     * that fills the types in. So the set of zones the site is LEFT with is built first, in memory, and
     * judged whole — the same shape as the config route's refusal (`SiteController`, GH-789, "judged on
     * the RESULT and not on the patch"). One save that gives every zone a type is accepted however many
     * were untyped before it, and spare zones may be deleted in the same save.
     *
     * NOTHING IS WRITTEN WHEN IT REFUSES. The result is computed and judged inside the transaction, so
     * what it judges is what it would have written.
     *
     * THE CHANGES, NOT THE STATE. The tab used to PATCH the site with the whole list of names it held in
     * the browser (`attributes_json: {zones: [...]}`); it now sends what the person did — created,
     * renamed, typed, deleted — which is the project's rule about where a value may come from. The site's
     * own list of names is still written, here, from the result: the Data page's zone names still come
     * from it (`data.blade.php`, `ZONE_NAMES`) and stage C5 is what retires it.
     *
     * @param  array{created?: array<int,array<string,mixed>>, renamed?: array<int,array<string,mixed>>, typed?: array<int,array<string,mixed>>, deleted?: array<int,string>}  $changes
     * @return array{ok: bool, missing: array<int,array<string,string>>, unknown: array<int,string>, conflict: array<int,string>, nameless: int, inUse: array<int,array<string,mixed>>, zones: array<int,array<string,mixed>>}
     */
    public function applyFromSettings(Site $site, array $changes, ?int $userId = null): array
    {
        /**
         * The declaration says WHICH rule it asks for, and this method implements one of them. If the
         * list ever asks for another, the save stops here instead of quietly applying this one — the key
         * would otherwise be decoration, true of the code by coincidence rather than by reading.
         */
        if (! CalculationInputs::zoneTypeIsJudgedOnTheResult()) {
            throw new \RuntimeException('zone-types.json asks for a judgement this service does not make');
        }

        return DB::transaction(function () use ($site, $changes, $userId) {
            /** @var array<string,Zone> */
            $existing = Zone::query()->where('site_id', $site->id)
                ->orderBy('created_at')->orderBy('name')->lockForUpdate()->get()->keyBy('id')->all();

            $unknown = [];
            // The result, keyed by the zone's id, or by `new:N` for one this save is creating. The key is
            // also what a refusal names, so the tab can mark the row the person has to look at.
            $result = [];
            foreach ($existing as $id => $zone) {
                $result[$id] = ['name' => $zone->name, 'zoneType' => $zone->zone_type];
            }

            /**
             * GH-804 (queue item "Zones", part 1) — A ZONE WITH SAMPLES IS NOT DELETED.
             *
             * THE OWNER'S DECISION of 01.10.2026, in her words: "a) Forbid it: the button refuses and
             * says how many samples are linked to the zone. The samples are moved or deleted first."
             *
             * WHY IT MATTERS, measured: the column is `nullOnDelete`, so deleting a zone silently
             * unlinked its samples — and from stage C3 the link is what a trend series, a report section
             * and the tissue-to-soil pair are built from. On the stand 38 of the 73 zones carry samples,
             * 59 samples in all; before this, one press could have unlinked any of them with nothing on
             * screen to say so.
             *
             * THE COUNT IS PER ZONE, not per save: the refusal says "2" about the zone being deleted and
             * not "5" about the site, because the number a person needs is the number they have to move.
             * Deleted samples are not counted — the model excludes them — so a zone whose only samples
             * are in the bin is free to go.
             */
            $inUse = [];
            foreach ((array) ($changes['deleted'] ?? []) as $id) {
                if (! array_key_exists($id, $result)) {
                    $unknown[] = (string) $id;

                    continue;
                }
                $samples = Sample::query()->where('zone_id', $id)->count();
                if ($samples > 0) {
                    $inUse[] = ['zone' => $result[$id]['name'], 'samples' => $samples];

                    continue;
                }
                unset($result[$id]);
            }
            if ($inUse !== []) {
                // The whole save is refused, as every other refusal here is: all of it or none.
                return $this->refusal($site, ['inUse' => $inUse]);
            }
            foreach ((array) ($changes['renamed'] ?? []) as $change) {
                $id = (string) ($change['id'] ?? '');
                if (! array_key_exists($id, $result)) {
                    $unknown[] = $id;

                    continue;
                }
                $result[$id]['name'] = trim((string) ($change['name'] ?? ''));
            }
            foreach ((array) ($changes['typed'] ?? []) as $change) {
                $id = (string) ($change['id'] ?? '');
                if (! array_key_exists($id, $result)) {
                    $unknown[] = $id;

                    continue;
                }
                $result[$id]['zoneType'] = self::asTypeOrNull($change['zoneType'] ?? null);
            }
            foreach (array_values((array) ($changes['created'] ?? [])) as $i => $change) {
                $result['new:'.$i] = [
                    'name' => trim((string) ($change['name'] ?? '')),
                    'zoneType' => self::asTypeOrNull($change['zoneType'] ?? null),
                ];
            }

            if ($unknown !== []) {
                // A zone the site does not have: the tab is looking at a list somebody else has changed.
                // Nothing is written on a request that cannot be applied as it was meant.
                return $this->refusal($site, ['unknown' => array_values(array_unique($unknown))]);
            }

            /**
             * TWO NAMES THAT DIFFER ONLY IN CASE ARE ONE ZONE — the rule `resolveOrCreate` applies and
             * the transfer applied before it, asked here of the result rather than of the request, so a
             * rename cannot walk into a name another zone already holds.
             *
             * A NAME MADE OF SPACES IS NO NAME. The route requires one, and `trim` is what turns "  "
             * into nothing; a zone with an empty name is not a place (GH-798), so the save is refused
             * rather than a nameless row written.
             */
            $conflict = [];
            $nameless = 0;
            $seen = [];
            foreach ($result as $zone) {
                if ($zone['name'] === '') {
                    $nameless++;

                    continue;
                }
                $key = mb_strtolower($zone['name']);
                if (isset($seen[$key])) {
                    $conflict[] = $zone['name'];
                }
                $seen[$key] = true;
            }
            if ($nameless > 0) {
                return $this->refusal($site, ['nameless' => $nameless]);
            }
            if ($conflict !== []) {
                return $this->refusal($site, ['conflict' => array_values(array_unique($conflict))]);
            }

            /**
             * THE OBLIGATION, asked of the declaration rather than spelled here: whether a type is
             * required in this place at all, and the words a person reads, both come from the inputs
             * list (`calculation-inputs.schema.json`, `zones.zoneType`) through `CalculationInputs`
             * (GH-804). A place the list does not name as requiring it is not refused — which is what
             * keeps the Data page out of this.
             */
            $missing = [];
            if (CalculationInputs::zoneTypeIsRequiredIn('settings.zones')) {
                foreach ($result as $key => $zone) {
                    if ($zone['zoneType'] === null) {
                        $missing[] = [
                            'input' => 'zone.'.$key,
                            'label' => CalculationInputs::zoneTypeLabel(),
                            'zone' => $zone['name'],
                        ];
                    }
                }
            }
            if ($missing !== []) {
                return $this->refusal($site, ['missing' => $missing]);
            }

            foreach ((array) ($changes['deleted'] ?? []) as $id) {
                Zone::query()->whereKey($id)->where('site_id', $site->id)->delete();
            }
            foreach ($result as $key => $zone) {
                if (str_starts_with((string) $key, 'new:')) {
                    Zone::query()->create([
                        'site_id' => $site->id,
                        'name' => $zone['name'],
                        'zone_type' => $zone['zoneType'],
                        'created_by_user_id' => $userId ?? 0,
                        'modified_by_user_id' => $userId ?? 0,
                    ]);

                    continue;
                }
                $was = $existing[$key];
                if ($was->name === $zone['name'] && $was->zone_type === $zone['zoneType']) {
                    continue;
                }
                Zone::query()->whereKey($key)->update([
                    'name' => $zone['name'],
                    'zone_type' => $zone['zoneType'],
                    'modified_by_user_id' => $userId ?? 0,
                    'updated_at' => now(),
                ]);
            }

            $this->writeTheSiteListOfNames($site, array_column($result, 'name'));

            return [
                'ok' => true,
                'missing' => [],
                'unknown' => [],
                'conflict' => [],
                'nameless' => 0,
                'inUse' => [],
                'zones' => $this->forThePage($site->refresh()),
            ];
        });
    }

    /**
     * The site's own list of zone names, kept beside the rows until stage C5 retires it.
     *
     * This is an OLD write continued, not a new source of truth: the Data page's zone names and the
     * sample list still read it, and the rule of this work is that nothing stops writing an old field
     * before its readers have moved. The rows decide what goes in it, so the two cannot drift.
     */
    private function writeTheSiteListOfNames(Site $site, array $names): void
    {
        $attrs = $site->attributes_json ?? [];
        $attrs['zones'] = array_values(array_unique(array_filter($names, fn ($n) => is_string($n) && $n !== '')));
        $site->attributes_json = $attrs;
        $site->save();
    }

    /** A refused save answers the whole truth about the site as it still stands. */
    private function refusal(Site $site, array $because): array
    {
        return array_merge([
            'ok' => false,
            'missing' => [],
            'unknown' => [],
            'conflict' => [],
            'nameless' => 0,
            'inUse' => [],
            'zones' => $this->forThePage($site),
        ], $because);
    }

    /**
     * A type as the dictionary knows it, or null for "nobody has said yet".
     *
     * An empty string arrives from a select nobody touched and means the same as null; a key the file
     * does not declare is refused by the route before this method sees it, and is treated as absent here
     * rather than written, so no undeclared key can reach the column by another road.
     */
    private static function asTypeOrNull(mixed $value): ?string
    {
        $key = is_string($value) ? trim($value) : '';

        return $key !== '' && ZoneTypes::isZoneType($key) ? $key : null;
    }

    /** One zone per distinct name, without case — the rule, in the one place that applies it. */
    private function byName(Site $site, string $name): ?Zone
    {
        return Zone::query()
            ->where('site_id', $site->id)
            ->whereRaw('LOWER(name) = ?', [mb_strtolower($name)])
            ->first();
    }
}
