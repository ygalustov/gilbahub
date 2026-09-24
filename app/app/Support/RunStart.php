<?php

namespace App\Support;

use App\Models\Sample;
use App\Models\Site;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

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

        $set = self::observe($site);
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
     * Two kinds of input, one record: the samples that exist per type, and whether
     * each key of the inputs list is filled in the config. The inputs list is the one
     * declaration of what a calculation needs (GH-642), so this cannot drift from it.
     *
     * @return array<string,mixed>
     */
    public static function observe(Site $site): array
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

        $config = self::configOf($site);
        $settings = [];
        foreach (CalculationInputs::keys() as $key) {
            if (str_starts_with($key, 'samples.')) {
                continue;   // answered by `samples` above
            }
            $settings[$key] = self::filled($config, $key);
        }

        return [
            'observedAt' => now()->toIso8601String(),
            'site' => $site->id,
            'samples' => $samples,
            'settings' => $settings,
        ];
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
     * Three answers, not two, and the third is the one the analyst insisted on: with
     * no record of the start the server does not guess. `null` means "unknown", and
     * its caller turns that into a named outcome of OUR side rather than into a
     * statement about the client's data.
     */
    public static function had(?array $set, string $input): ?bool
    {
        if (! is_array($set)) {
            return null;
        }
        if (str_starts_with($input, 'samples.')) {
            $type = substr($input, strlen('samples.'));
            $ids = $set['samples'][$type] ?? null;

            return is_array($ids) ? $ids !== [] : null;
        }
        $settings = $set['settings'] ?? null;
        if (! is_array($settings) || ! array_key_exists($input, $settings)) {
            return null;
        }

        return (bool) $settings[$input];
    }
}
