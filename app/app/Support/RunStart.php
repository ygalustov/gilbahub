<?php

namespace App\Support;

use App\Models\Sample;
use App\Models\Site;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * GH-675 (queue item 4, slice 1, the analyst's section 22.7) — WHAT EXISTED WHEN
 * THE RUN STARTED, RECORDED BY THE SERVER AT THE MOMENT IT STARTED.
 *
 * WHY THIS EXISTS AND WHY IT IS NOT A LOOK IN THE DATABASE LATER. The run tells the
 * server which inputs it did not have. To say whether that means "the client never
 * entered it" or "it was there and did not reach the run" — the owner's two cases,
 * and they get different sentences — something has to know what existed WHEN THE RUN
 * BEGAN. Asking the database at write time is a second reading taken later: a sample
 * created between the start and the write is absent to the run and present to the
 * server, and the server would write "it did not arrive". The statement would be
 * true and its premise false. That is the GH-459 class — a judgement built from two
 * readings taken at different moments — and it flips with no defect in the code at
 * all. So the two readings are made SIMULTANEOUS by recording one of them.
 *
 * WHEN: the first thing the server does for a run is render its frame,
 * `/hub?rerun=<runId>&site=<id>` (GH-663). The clock is the server's; `started_at`
 * from the body is the browser's and is not used.
 *
 * WHERE: the application cache, under the run's own id. On this stand the cache
 * store is the database (`CACHE_STORE=database`), so no column and no migration is
 * added; at write time the set is copied into the row's `detail` so it can be read
 * back in a month. `Cache::add` — the FIRST write wins, so re-rendering the same
 * frame cannot overwrite the start with a later state.
 *
 * WHAT IS NOT DONE HERE, and it is a rule rather than an omission: the set is never
 * handed to the frame. It would then be browser state written back to the server,
 * which this project forbids.
 *
 * AN ABSENT RECORD IS AN OUTCOME. A frame opened without `rerun`, or a record past
 * its day, gives no set — and the server then says "the start was not recorded"
 * rather than guessing. That is our side, not the client's.
 */
class RunStart
{
    /** One day, with room for the longest run budget. */
    private const TTL_SECONDS = 86400;

    /** The sample types the run is given, in the order the inputs list declares. */
    private const SAMPLE_TYPES = ['soil', 'water', 'tissue'];

    /**
     * GH-777 (queue item 4, the analyst's 76.4 B) — THE SERVER DOES NOT KNOW, AND SAYS SO.
     *
     * The third answer for one input, beside "it was there" and "it was not". It is written into the
     * set so the judgement can tell "the client did not enter it" from "we could not look where it
     * lives" — and the second must never reach a client as the first. Blame on the client is the
     * worst direction for an error to point.
     */
    public const UNKNOWN = 'unknown';

    /** An input the set does not carry at all — not declared in the list the run and the server share. */
    public const UNDECLARED = 'undeclared';

    /**
     * GH-777 — THE STORAGES THIS CLASS CAN READ, declared so a new one is red on the day it appears.
     *
     * The list of inputs says where each value lives; this says what the server knows how to look in.
     * A storage named there and missing here would otherwise turn into `unknown` for that input months
     * later, in a judgement nobody was watching — the guard compares the two sets both ways instead.
     *
     * `sampleSet` is read by the `samples` half of `observe()` rather than by `heldAnywhere`, and it is
     * named here because it is a storage of the list all the same.
     */
    public const STORAGES_IT_READS = ['config', 'siteColumn', 'sprayLog', 'sampleSet'];

    public static function keyFor(string $runId): string
    {
        return 'run-start:'.$runId;
    }

    /**
     * Record what existed for this site at this moment, once per run.
     *
     * Returns the set as recorded, or null when this request is not a run frame.
     * It never throws into a page render: a cache that cannot be written must not
     * take the run down with it, and a missing record already has a named outcome.
     *
     * @return array<string,mixed>|null
     */
    public static function recordOnce(?Request $request, ?Site $site): ?array
    {
        $request = $request ?: request();
        if (! $request || ! $site) {
            return null;
        }
        $runId = trim((string) $request->query('rerun', ''));
        if ($runId === '' || trim((string) $request->query('site', '')) === '') {
            return null;
        }

        $set = self::observe($site, $request);
        try {
            Cache::add(self::keyFor($runId), $set, self::TTL_SECONDS);
        } catch (\Throwable $e) {
            return $set;
        }

        return $set;
    }

    /**
     * What the server can see for this site right now.
     *
     * Two kinds of input, one record: the samples that exist per type, and whether each key of the
     * inputs list held a value. The inputs list is the one declaration of what a calculation needs
     * (GH-642), so this cannot drift from it.
     *
     * GH-777 (queue item 4, the analyst's 76.4 B) — WHERE A VALUE LIVES IS DECLARED, NOT ASSUMED.
     * This read the site's config for every key, and three inputs of the list keep their value
     * elsewhere: `sites.soil_texture_override` is a column of `sites` (5 of 21 stand sites carry one)
     * and the two `pgr.*` inputs may live in the spray log (2 stand sites carry theirs only there).
     * Each came out "not filled", and the client would be told it had not entered a value it had
     * entered. So each input declares `storedIn`, and each storage has a reader here — and a storage
     * this class cannot read answers `unknown` rather than `false`.
     *
     * AND WHICH SAMPLE THE RUN WAS TOLD TO USE is recorded beside the list of what exists: the frame's
     * address carries `&soil=`, `&water=`, `&tissue=` (GH-724), and the server chose them. Without it
     * the set says a sample existed while the run was pointed at a different one, which is the same
     * two-readings-at-two-moments class this whole record exists to close.
     *
     * @return array<string,mixed>
     */
    public static function observe(Site $site, ?Request $request = null): array
    {
        $samples = [];
        foreach (self::SAMPLE_TYPES as $type) {
            $ids = Sample::query()
                ->where('site_id', $site->id)
                ->where('sample_type', $type)
                ->orderByDesc('sample_date')
                ->pluck('id')
                ->all();
            $samples[$type] = array_map('strval', $ids);
        }

        $named = [];
        foreach (self::SAMPLE_TYPES as $type) {
            $told = $request ? trim((string) $request->query($type, '')) : '';
            $named[$type] = $told === '' ? null : $told;
        }

        $config = self::configOf($site);
        $settings = [];
        foreach (CalculationInputs::keys() as $key) {
            if (str_starts_with($key, 'samples.')) {
                continue;   // answered by `samples` above
            }
            $settings[$key] = self::heldAnywhere($site, $config, $key);
        }

        return [
            'observedAt' => now()->toIso8601String(),
            'site' => $site->id,
            'samples' => $samples,
            'named' => $named,
            'settings' => $settings,
        ];
    }

    /**
     * Did this site hold a value for this input, in any storage the list declares for it?
     *
     * `true` / `false` / `self::UNKNOWN`. Unknown is returned whenever the answer would otherwise be
     * a guess: the input declares no storage at all (it is not in the list, or the declaration is
     * missing), or one of its storages has no reader below. A storage that declares nothing —
     * `storedIn: []` — is not unknown: nothing stores that input, so nothing was entered, and the
     * guard holds that against the list's own `filledIn`.
     *
     * THE UNKNOWN RETURN IS UNREACHABLE WHILE THE GUARD HOLDS, and it is said here rather than left
     * to be discovered: this is only called for keys of the list, and
     * `Gh777TheStorageOfEveryInputIsDeclaredTest` holds that every one of them declares a storage and
     * that every storage named has a reader — both ways. So breaking this branch reddens nothing,
     * which was measured rather than assumed. Its case is the guard: the day a storage is declared
     * without a reader, the guard is red, and this branch is what keeps that day from ending with a
     * client told it entered nothing.
     *
     * @param  array<string,mixed>  $config
     * @return bool|string
     */
    private static function heldAnywhere(Site $site, array $config, string $key)
    {
        $stored = CalculationInputs::storedIn($key);
        if ($stored === null) {
            return self::UNKNOWN;
        }
        $held = false;
        foreach ($stored as $storage) {
            $answer = match ($storage) {
                'config' => self::filledSomewhereInTheConfig($config, $key),
                'siteColumn' => self::filledInSiteColumn($site, $key),
                'sprayLog' => self::filledInSprayLog($site, $key),
                default => self::UNKNOWN,
            };
            if ($answer === self::UNKNOWN) {
                return self::UNKNOWN;
            }
            $held = $held || $answer;
        }

        return $held;
    }

    /**
     * A column of `sites`, named by the input's own key: `sites.soil_texture_override`.
     *
     * A column this model does not carry is unknown rather than empty — the alternative is telling a
     * client it entered nothing because we looked in the wrong table.
     *
     * @return bool|string
     */
    private static function filledInSiteColumn(Site $site, string $key)
    {
        $column = substr($key, strlen('sites.'));
        if (! str_starts_with($key, 'sites.') || $column === '') {
            return self::UNKNOWN;
        }
        $attributes = $site->getAttributes();
        if (! array_key_exists($column, $attributes)) {
            return self::UNKNOWN;
        }
        $value = $attributes[$column];

        return $value !== null && trim((string) $value) !== '';
    }

    /**
     * The spray log, for the two inputs a person may enter there instead of in Settings.
     *
     * The column each input lives in is named here rather than derived from the key: `productType`
     * is `product_name` in the log and `applicationDate` is `event_date`, and a rule that guessed
     * that would be a second declaration of the mapping.
     *
     * @return bool|string
     */
    private static function filledInSprayLog(Site $site, string $key)
    {
        $column = match ($key) {
            'pgr.productType' => 'product_name',
            'pgr.applicationDate' => 'event_date',
            default => null,
        };
        if ($column === null) {
            return self::UNKNOWN;
        }

        return DB::table('spray_logs')
            ->where('site_id', $site->id)
            ->where('product_type', 'pgr')
            ->whereNotNull($column)
            ->where($column, '<>', '')
            ->exists();
    }

    /**
     * GH-777 (the reviewer's return) — AT THE PATH THE WRITER WRITES, not at the input's own key.
     *
     * `filled()` walked the key as a path in the config, and for six inputs of the list the writer puts
     * the value somewhere else — the list now declares those paths (`storedAs`). Measured on the stand
     * before this: `irrigation.efficiency` on 3 sites and `traffic.schedule.moisture` on 2, and every
     * one of them would be reported to its own owner as "not entered". That is the error pointing at
     * the client, which is the whole thing this record was built to stop.
     *
     * An input with several paths — the three Clegg readings are one input — is filled when ANY of
     * them carries a value: the input is the reading, and a person who entered one entered it.
     *
     * @param  array<string,mixed>  $config
     */
    private static function filledSomewhereInTheConfig(array $config, string $key): bool
    {
        $paths = CalculationInputs::storedAs($key);
        if ($paths === []) {
            return self::filled($config, $key);
        }
        foreach ($paths as $path) {
            if (self::filled($config, $path)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Was this input filled at that moment?
     *
     * An empty string and an empty array count as absent, because that is what they
     * mean to a person looking at the form: nothing entered. A zero does NOT — a
     * measured zero is a value, and collapsing it into absence is the class this
     * repository has spent the day removing.
     */
    private static function filled(array $config, string $key): bool
    {
        $value = $config;
        foreach (explode('.', $key) as $segment) {
            if (! is_array($value) || ! array_key_exists($segment, $value)) {
                return false;
            }
            $value = $value[$segment];
        }
        if ($value === null) {
            return false;
        }
        if (is_string($value)) {
            return trim($value) !== '';
        }
        if (is_array($value)) {
            return $value !== [];
        }

        return true;
    }

    /** @return array<string,mixed> */
    private static function configOf(Site $site): array
    {
        $record = $site->configs()->where('namespace', 'gaip')->first();

        return is_array($record?->config) ? $record->config : [];
    }

    /**
     * The set recorded for this run, or null when there is none.
     *
     * @return array<string,mixed>|null
     */
    public static function recorded(string $runId): ?array
    {
        try {
            $set = Cache::get(self::keyFor($runId));
        } catch (\Throwable $e) {
            return null;
        }

        return is_array($set) ? $set : null;
    }

    /**
     * Was this input there when the run started?
     *
     * FIVE ANSWERS, and each one is a different fact about whose side a gap is on:
     *   - `true` / `false` — it was there, or it was not. The client's own data;
     *   - `null` — there is no record of the start. The server does not guess;
     *   - `self::UNDECLARED` — the run named an input the list does not declare. GH-777: this used to
     *     answer `null`, so a run that named `made.up.key` was reported as "the start was not
     *     recorded" — a sentence about a fact that WAS recorded, the shape of a timer named as an
     *     event. A sample type outside the three did the same;
     *   - `self::UNKNOWN` — the input's storage is one this class cannot read. Also our side.
     *
     * @return bool|string|null
     */
    public static function had(?array $set, string $input)
    {
        if (! is_array($set)) {
            return null;
        }
        /**
         * GH-777 (queue item 4, slice 2, the analyst's answer of 29.09.2026) — THE NAME IS TRANSLATED
         * FIRST, because the run and this list speak two vocabularies about one input.
         *
         * The walk of the pass names what its gate checked -- `water.ecw`, the state's own spelling --
         * and this list is keyed by what a person fills in, `samples.water`, with the state's spellings
         * declared beside it. Without the translation the first output of that walk was reported as an
         * input the list does not declare: our side, with a re-run offered that could not help, for the
         * nine sites of thirteen that have no water test at all.
         *
         * `undeclared` stays the honest answer for a name the list really does not know.
         */
        $declared = CalculationInputs::inputFor($input);
        if ($declared === null) {
            return self::UNDECLARED;
        }
        $input = $declared;
        if (str_starts_with($input, 'samples.')) {
            $type = substr($input, strlen('samples.'));
            $ids = $set['samples'][$type] ?? null;

            return is_array($ids) ? $ids !== [] : self::UNDECLARED;
        }
        $settings = $set['settings'] ?? null;
        if (! is_array($settings) || ! array_key_exists($input, $settings)) {
            // The list knows the name and the record does not carry it: an older record, from before
            // the input was declared. Not the client's data either way.
            return self::UNKNOWN;
        }
        $held = $settings[$input];

        return $held === self::UNKNOWN ? self::UNKNOWN : (bool) $held;
    }
}
