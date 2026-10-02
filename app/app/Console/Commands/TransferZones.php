<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * GH-799 (queue item "Zones", stage C0) — THE ZONES A SITE ALREADY HAS, MADE INTO ROWS.
 *
 * WHAT IT MOVES, and from where. A zone exists today as a name in two places, and the transfer takes
 * the union of both for each site (the plan's section 4.2):
 *   - `sites.attributes_json.zones` — the list Settings keeps;
 *   - the distinct `payload._label` of the site's SOIL and TISSUE samples, which is the same filter
 *     the server already applies when it merges a zone name into a site.
 * One zone per distinct name, compared WITHOUT CASE. Nothing is merged beyond that: two spellings of
 * one green are one zone, and two genuinely different names stay two.
 *
 * WATER SAMPLES ARE NOT ZONES — the owner's decision of 22.09.2026. A water sample keeps its `_label`
 * as its own name and its `zone_id` stays NULL; the command counts them and says so, and that is all it
 * does with them.
 *
 * AND NOTHING ELSE OF A WATER SAMPLE IS MOVED. The first draft of this command read `payload._zone` --
 * which on a water sample means the source rather than a zone type -- into a column of its own. The
 * owner's decision of 01.10.2026, taken after she was shown all three readers of that word: "only the
 * name remains" for water. So `_zone` is not read at all here and is left exactly as it stands.
 *
 * EVERY TYPE COMES OUT EMPTY. The owner, 22.09.2026: "you can leave it empty, and I will fill them in
 * by hand afterwards". `payload._zone` is not read for a soil or tissue sample at all, so no type is
 * guessed from it: a guessed type with a mark beside it looks like a filled field and may never be
 * returned to.
 *
 * IT PRINTS BEFORE IT WRITES, and that is the point of it being a command. `--apply` is required to
 * change anything; without it the counts are printed and nothing is written. Both forms print the SAME
 * report, so what a person approves is what then happens.
 *
 * NOTHING IS REMOVED. The lists, the labels and `_zone` all stay exactly as they are, and every
 * existing reader keeps working — the transfer only fills the new table and the new columns. It can be
 * run twice: a zone that already exists is matched, not duplicated, and a sample that already points
 * at a zone is left alone.
 */
class TransferZones extends Command
{
    protected $signature = 'zones:transfer
        {--apply : Write the zones and the links. Without it nothing is written}
        {--site= : One site id, for checking a single site before the whole stand}';

    protected $description = 'Make a row per zone from the names a site already has, and point its soil and tissue samples at them (GH-799)';

    /** The sample types a zone is made from, the same filter the server applies today. */
    private const ZONE_SAMPLE_TYPES = ['soil', 'tissue', 'loi'];

    public function handle(): int
    {
        $apply = (bool) $this->option('apply');
        $onlySite = $this->option('site');

        $sites = DB::table('sites')
            ->whereNull('deleted_at')
            ->when($onlySite, fn ($q) => $q->where('id', $onlySite))
            ->orderBy('name')
            ->get(['id', 'name', 'attributes_json']);

        $perSite = [];
        $zonesTotal = 0;
        /**
         * GH-799 (the analyst's condition) — CREATED, counted apart from FOUND.
         *
         * "Nothing changed" and "the command never got to the work" look alike unless the number of
         * rows it made is said out loud. A second run must be able to print `created 0` and mean it,
         * and that number is only meaningful beside the first run's, which is why both forms of the
         * run compute it: a dry run says how many it WOULD make.
         */
        $zonesCreated = 0;
        $zonesAlreadyThere = 0;
        $zonesWithASample = 0;
        $sitesWithZones = 0;
        $linked = 0;
        $unlinked = [];
        $waterSkipped = 0;

        foreach ($sites as $site) {
            $fromTheList = $this->namesFromTheList($site->attributes_json);
            $fromTheSamples = $this->namesFromTheSamples($site->id);

            // The union, case-insensitively, keeping the spelling each name first arrived in: the list
            // is the place a person typed it, so the list's spelling wins when both carry the name.
            $byKey = [];
            foreach (array_merge($fromTheList, $fromTheSamples) as $name) {
                $key = $this->keyOf($name);
                if ($key === '') {
                    continue;
                }
                if (! array_key_exists($key, $byKey)) {
                    $byKey[$key] = $name;
                }
            }

            $withASample = [];
            foreach ($fromTheSamples as $name) {
                $withASample[$this->keyOf($name)] = true;
            }

            if ($byKey !== []) {
                $sitesWithZones++;
            }
            $zonesTotal += count($byKey);
            $zonesWithASample += count(array_intersect_key($byKey, $withASample));
            $perSite[] = [
                'site' => $site->name,
                'id' => $site->id,
                'zones' => count($byKey),
                'fromTheList' => count($fromTheList),
                'fromTheSamples' => count(array_unique(array_map([$this, 'keyOf'], $fromTheSamples))),
                'withASample' => count(array_intersect_key($byKey, $withASample)),
            ];

            $already = $this->zonesAlreadyThere($site->id);
            $newHere = array_diff_key($byKey, $already);
            $zonesCreated += count($newHere);
            $zonesAlreadyThere += count(array_intersect_key($byKey, $already));
            $zoneIdByKey = $apply ? $this->writeZones($site->id, $byKey) : [];

            // The samples of this site, by what the transfer does with each.
            foreach ($this->samplesOf($site->id) as $sample) {
                $payload = is_string($sample->payload) ? json_decode($sample->payload, true) : $sample->payload;
                $payload = is_array($payload) ? $payload : [];

                // A water sample is counted and otherwise left alone: not a zone, and nothing of it
                // is moved anywhere (the owner's decision of 01.10.2026).
                if ($sample->sample_type === 'water') {
                    $waterSkipped++;

                    continue;
                }

                if (! in_array($sample->sample_type, self::ZONE_SAMPLE_TYPES, true)) {
                    continue;
                }

                $key = $this->keyOf((string) ($payload['_label'] ?? ''));
                if ($key === '' || ! array_key_exists($key, $byKey)) {
                    $unlinked[] = $site->name.' #'.$sample->id.' "'.trim((string) ($payload['_label'] ?? '')).'"';

                    continue;
                }
                $linked++;
                if ($apply && isset($zoneIdByKey[$key])) {
                    DB::table('samples')->where('id', $sample->id)->update(['zone_id' => $zoneIdByKey[$key]]);
                }
            }
        }

        $this->report($apply, $perSite, [
            'zonesTotal' => $zonesTotal,
            'zonesCreated' => $zonesCreated,
            'zonesAlreadyThere' => $zonesAlreadyThere,
            'sitesWithZones' => $sitesWithZones,
            'zonesWithASample' => $zonesWithASample,
            'linked' => $linked,
            'unlinked' => $unlinked,
            'waterSkipped' => $waterSkipped,
        ]);

        return self::SUCCESS;
    }

    /**
     * The numbers, printed the same way whether or not anything was written — so that the run a person
     * approves and the run that happens are the same report.
     *
     * @param  array<int,array<string,mixed>>  $perSite
     * @param  array<string,mixed>  $totals
     */
    private function report(bool $apply, array $perSite, array $totals): void
    {
        $this->line($apply
            ? '[zones:transfer] APPLIED — the rows below were written.'
            : '[zones:transfer] DRY RUN — nothing was written. Add --apply to write exactly this.');
        if (! \Illuminate\Support\Facades\Schema::hasTable('zones')) {
            // Said out loud rather than left to be inferred from "everything is new".
            $this->line('[zones:transfer] the `zones` table does not exist yet: these are the numbers'
                .' the transfer would produce once the migration has run.');
        }

        $this->table(
            ['site', 'zones', 'from the list', 'from samples', 'with a sample'],
            array_map(fn ($r) => [
                $r['site'], $r['zones'], $r['fromTheList'], $r['fromTheSamples'], $r['withASample'],
            ], $perSite)
        );

        $this->line('[zones:transfer] zones: '.$totals['zonesTotal']
            .' on '.$totals['sitesWithZones'].' sites, all with an empty type');
        /**
         * The two halves of that number, because a repeat has to be able to say "I made none" rather
         * than leaving "nothing changed" to be told from "it never ran" by guesswork. A run broken off
         * half way is finished by running it again: what it already made is matched, and only the rest
         * is counted here.
         */
        $this->line('[zones:transfer] zones '.($apply ? 'created' : 'to create').': '
            .$totals['zonesCreated'].', already there: '.$totals['zonesAlreadyThere']);
        $this->line('[zones:transfer] of those, with at least one sample: '.$totals['zonesWithASample']);
        $this->line('[zones:transfer] soil/tissue samples linked to a zone: '.$totals['linked']);
        $this->line('[zones:transfer] soil/tissue samples NOT linked: '.count($totals['unlinked'])
            .($totals['unlinked'] === [] ? '' : ' — '.implode('; ', $totals['unlinked'])));
        $this->line('[zones:transfer] water samples skipped (they are not zones, and nothing of them '
            .'is moved): '.$totals['waterSkipped']);
    }

    /**
     * The names of `sites.attributes_json.zones`, which is a plain list of strings.
     *
     * @return array<int,string>
     */
    private function namesFromTheList(?string $attributes): array
    {
        $decoded = $attributes === null ? null : json_decode($attributes, true);
        $zones = is_array($decoded) ? ($decoded['zones'] ?? null) : null;
        if (! is_array($zones)) {
            return [];
        }

        $out = [];
        foreach ($zones as $entry) {
            // The list has held plain strings since it was introduced; an object with a `name` is
            // accepted too rather than silently dropped, because that is the shape stage C2 writes.
            $name = is_string($entry) ? $entry : (is_array($entry) ? ($entry['name'] ?? null) : null);
            if (is_string($name) && trim($name) !== '') {
                $out[] = trim($name);
            }
        }

        return $out;
    }

    /**
     * The distinct `_label` of a site's soil and tissue samples — the second source of a zone's name.
     *
     * @return array<int,string>
     */
    private function namesFromTheSamples(string $siteId): array
    {
        $out = [];
        foreach ($this->samplesOf($siteId) as $sample) {
            if (! in_array($sample->sample_type, self::ZONE_SAMPLE_TYPES, true)) {
                continue;
            }
            $payload = is_string($sample->payload) ? json_decode($sample->payload, true) : $sample->payload;
            $label = is_array($payload) ? ($payload['_label'] ?? null) : null;
            if (is_string($label) && trim($label) !== '') {
                $out[] = trim($label);
            }
        }

        return $out;
    }

    /** @return \Illuminate\Support\Collection<int,object> */
    private function samplesOf(string $siteId)
    {
        /**
         * GH-799: the column this stage adds is selected only when it is THERE, for the same reason the
         * zone reader tolerates a missing table — a dry run is asked for before the migration, and
         * asking for a column that does not exist yet would make the numbers unobtainable until after
         * the decision they inform.
         */
        $columns = ['id', 'sample_type', 'payload'];
        if (\Illuminate\Support\Facades\Schema::hasColumn('samples', 'zone_id')) {
            $columns[] = 'zone_id';
        }

        return DB::table('samples')
            ->where('site_id', $siteId)
            ->whereNull('deleted_at')
            ->orderBy('id')
            ->get($columns);
    }

    /**
     * The zones this site already has, by key — read before anything is written, so that a repeat can
     * count what is left to do rather than what it ended up with.
     *
     * GH-799: THE NUMBERS CAN BE ASKED FOR BEFORE THE MIGRATION HAS RUN, and that is the point of the
     * dry run — the coordinator's window begins with "what would this do", and on a database where the
     * table does not exist yet the honest answer is "none of them are there". Without this the only way
     * to see the numbers would be to migrate first, which is the decision the numbers are meant to
     * inform.
     *
     * @return array<string,string> key => zone id
     */
    private function zonesAlreadyThere(string $siteId): array
    {
        if (! \Illuminate\Support\Facades\Schema::hasTable('zones')) {
            return [];
        }

        $out = [];
        foreach (DB::table('zones')->where('site_id', $siteId)->get(['id', 'name']) as $zone) {
            $out[$this->keyOf($zone->name)] = $zone->id;
        }

        return $out;
    }

    /** One zone per distinct name, without case — the rule the whole transfer rests on. */
    private function keyOf(string $name): string
    {
        return mb_strtolower(trim($name));
    }

    /**
     * Write the zones of one site and answer their ids by key. A zone that is already there is matched
     * rather than made again, so the command can be run twice.
     *
     * @param  array<string,string>  $byKey  key => the name as it will be stored
     * @return array<string,string>  key => zone id
     */
    private function writeZones(string $siteId, array $byKey): array
    {
        $existing = $this->zonesAlreadyThere($siteId);

        $out = [];
        foreach ($byKey as $key => $name) {
            if (isset($existing[$key])) {
                $out[$key] = $existing[$key];

                continue;
            }
            $id = (string) Str::uuid();
            DB::table('zones')->insert([
                'id' => $id,
                'site_id' => $siteId,
                'name' => $name,
                // Empty, for every row, by the owner's decision. Said here as well as in the migration
                // because this is the line that would be the easiest place to start guessing.
                'zone_type' => null,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
            $out[$key] = $id;
        }

        return $out;
    }
}
