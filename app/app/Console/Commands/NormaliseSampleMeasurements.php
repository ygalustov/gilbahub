<?php

namespace App\Console\Commands;

use App\Models\Sample;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * GH-574 — the rows written before a measurement had to be a number.
 *
 * `SampleController` now stores `"40"` as `40` on every write path. That fixes
 * what arrives; it does nothing for what is already there, and what is already
 * there is why the owner's soil analysis comes back empty: `samples` id 141 on
 * Test5 - NZ holds `K: "40"`, `Ca: "803"`, `CEC: "5.9"`, `pH: "6"`, the MLSN
 * engine multiplies them and throws.
 *
 * THIS IS CLIENT DATA. It is a separate command rather than a migration for
 * exactly that reason: a migration runs when someone deploys, and this should
 * run when someone decides. `--dry-run` prints what would change and writes
 * nothing.
 *
 * WHAT IT DOES AND DOES NOT DO. A string that is a number becomes that number.
 * Everything else is left alone: a descriptive key (`_label`, `_zone`,
 * `_source`, `zone`, `zoneType`, `Texture`) is never touched whatever it holds,
 * an empty string stays empty, a word stays a word. No key is added, none is
 * removed, and no value is invented — the same rule the controller applies, in
 * the same words, so the two cannot drift.
 */
class NormaliseSampleMeasurements extends Command
{
    protected $signature = 'samples:normalise-measurements {--dry-run : Print the report and change nothing}';

    protected $description = 'Store numeric measurements in sample payloads as numbers rather than strings (GH-574)';

    /**
     * DELETED SAMPLES ARE NOT TOUCHED. Owner, 22.09.2026: "no, we are not
     * restoring samples."
     *
     * 23 of the 38 rows holding text are soft-deleted. The case for taking one
     * of them rested on a restored sample coming back as text; there will be no
     * restoring, so the case went with it. Living rows only, and the query says
     * so rather than a flag somebody has to remember.
     */
    /** The same list `SampleController::DESCRIPTIVE_KEYS` holds, and the test asserts they agree. */
    public const DESCRIPTIVE_KEYS = [
        'zone', 'zonetype', 'texture', 'soil_texture', 'sample_type', 'type',
        'notes', 'date', 'lab', 'lab_name', 'lab_ref', 'label', 'name', 'source',
    ];

    public function handle(): int
    {
        $dryRun = (bool) $this->option('dry-run');

        $this->line('');
        $this->info($dryRun
            ? 'samples:normalise-measurements — DRY RUN, nothing will be written'
            : 'samples:normalise-measurements — writing');
        $this->line('');
        $this->line('A string that is a number becomes that number. Descriptive keys (_label, _zone,');
        $this->line('_source, zone, zoneType, Texture, ...) are never touched, whatever they hold.');
        $this->line('Deleted samples are not touched at all. Living rows only.');
        $this->line('Only the TYPE changes: every conversion is written as JSON, read back and compared,');
        $this->line('and one that does not survive the round trip stops the run before anything is written.');
        $this->line('');

        $rows        = [];
        $touched     = 0;
        $fields      = 0;
        $descriptive = [];

        // Trashed rows too: a soft-deleted sample can be restored, and one
        // restored after this ran would come back holding text. 148 rows in the
        // table, 60 of them living.
        Sample::query()->with('site')->orderBy('id')
            ->each(function (Sample $sample) use (&$rows, &$touched, &$fields, &$descriptive) {
            $payload = is_array($sample->payload) ? $sample->payload : [];
            $changed = [];
            $next    = self::normalise($payload, $changed);

            if (! $changed) {
                return;
            }

            // GH-574 — SHOWN, NOT PROMISED. The header says descriptive keys are
            // never touched; this walks the produced payload and compares each
            // of them with what it was, so the report is a measurement. The
            // interesting ones are the easy ones to get wrong: an EMPTY `_zone`
            // on Russley's water samples, and `zone: "Other"` on Test5 - NZ.
            $seenHere = [];
            foreach ($payload as $k => $v) {
                if (is_array($v) || ! is_string($v)) {
                    continue;
                }
                if (! str_starts_with((string) $k, '_')
                    && ! in_array(strtolower((string) $k), self::DESCRIPTIVE_KEYS, true)) {
                    continue;
                }
                $seenHere[] = $k;
                $after = $next[$k] ?? null;
                $descriptive[$k] ??= ['same' => 0, 'changed' => [], 'empty' => 0, 'absent' => []];
                if ($v === '') {
                    $descriptive[$k]['empty']++;
                }
                if ($after === $v) {
                    $descriptive[$k]['same']++;
                    $descriptive[$k]['examples'][] = $sample->id.' '.$k.' = '
                        .($v === '' ? '(empty string)' : '"'.$v.'"');
                } else {
                    $descriptive[$k]['changed'][] = $sample->id.' '.$k.': "'.$v.'" → '.var_export($after, true);
                }
            }
            // A key that is NOT on a row is recorded as absent rather than left
            // out of the report. "zone is fine everywhere" and "zone is not
            // there" look identical in a list of what was checked, and the
            // second is the one somebody needs to know about.
            foreach (['_label', '_zone', '_source', 'zone', 'zoneType'] as $k) {
                if (! in_array($k, $seenHere, true)) {
                    $descriptive[$k] ??= ['same' => 0, 'changed' => [], 'empty' => 0, 'absent' => []];
                    $descriptive[$k]['absent'][] = $sample->id;
                }
            }

            $touched++;
            $fields += count($changed);
            $rows[]  = [
                'id'      => $sample->id,
                'site'    => $sample->site?->name ?? $sample->site_id,
                'type'    => $sample->sample_type,
                'label'   => $payload['_label'] ?? '',
                'fields'  => count($changed),
                'example' => implode(', ', array_slice($changed, 0, 6))
                             .(count($changed) > 6 ? ' (+'.(count($changed) - 6).')' : ''),
                'payload' => $next,
            ];
        });

        $this->table(
            ['id', 'site', 'type', 'label', 'fields', 'what changes'],
            array_map(fn (array $r) => [$r['id'], $r['site'], $r['type'], $r['label'], $r['fields'], $r['example']], $rows)
        );

        $this->line('');
        $this->line('rows to change   : '.$touched.' living, of '.Sample::query()->count().' living');
        $this->line('fields to change : '.$fields);
        $this->line('deleted, untouched: '.Sample::onlyTrashed()->count().' (not looked at)');
        $this->line('');

        // The descriptive keys, measured on the payloads this run would write.
        $this->line('descriptive keys, compared before and after on every row above:');
        if (! $descriptive) {
            $this->line('  none present — nothing to show, and that is not the same as nothing checked');
        }
        $broken = [];
        ksort($descriptive);
        foreach ($descriptive as $key => $seen) {
            $absent = count($seen['absent'] ?? []);
            $this->line('  '.str_pad($key, 10).' '.$seen['same'].' unchanged'
                .($seen['empty'] ? ', '.$seen['empty'].' of them an empty string' : '')
                .($absent ? ', absent on '.$absent.' row(s): '.implode(', ', $seen['absent']) : '')
                .($seen['changed'] ? '  ** '.count($seen['changed']).' CHANGED **' : ''));
            if (! empty($seen['examples'])) {
                $this->line('             e.g. '.implode('; ', array_slice($seen['examples'], 0, 3)));
            }
            $broken = array_merge($broken, $seen['changed']);
        }
        if ($broken) {
            $this->line('');
            $this->error('DESCRIPTIVE KEYS WOULD CHANGE — this is a fault, not a result:');
            foreach ($broken as $line) {
                $this->error('  '.$line);
            }

            return self::FAILURE;
        }
        $this->line('');

        if ($dryRun) {
            $this->info('Nothing was written.');

            return self::SUCCESS;
        }

        if (! $rows) {
            $this->info('Nothing to normalise.');

            return self::SUCCESS;
        }

        DB::transaction(function () use ($rows) {
            foreach ($rows as $r) {
                // `payload` only. Nothing else about the sample is touched, and
                // the row keeps its identity, its dates and its owner.
                Sample::query()->whereKey($r['id'])->update(['payload' => json_encode($r['payload'])]);
            }
        });

        $this->info('Normalised '.$touched.' row(s), '.$fields.' field(s).');

        return self::SUCCESS;
    }

    /**
     * @param  array<string,mixed> $payload
     * @param  array<int,string>   $changed  filled with "key: before → after"
     * @return array<string,mixed>
     */
    public static function normalise(array $payload, array &$changed, string $prefix = ''): array
    {
        foreach ($payload as $key => $value) {
            if (is_array($value)) {
                $payload[$key] = self::normalise($value, $changed, $prefix.$key.'.');
                continue;
            }
            if (! is_string($value)) {
                continue;
            }
            if (str_starts_with((string) $key, '_')
                || in_array(strtolower((string) $key), self::DESCRIPTIVE_KEYS, true)) {
                continue;
            }
            $trimmed = trim($value);
            if ($trimmed === '' || ! is_numeric($trimmed)) {
                continue;
            }
            $next = $trimmed + 0;

            // THE CONDITION THIS COMMAND MAY RUN UNDER: only the TYPE changes.
            // 5.9 stays 5.9.
            //
            // It is checked against the JSON ROUND TRIP rather than against the
            // PHP value, and the difference matters. `$trimmed + 0` preserves
            // the value for every `is_numeric` string — comparing it with the
            // original would be a check that cannot fail, which is a comfort
            // rather than a safeguard. What the row actually stores is the JSON
            // encoding, and that CAN refuse: `"1e400"` is numeric, becomes INF,
            // and `json_encode` will not write it. So the encoding is done here,
            // read back, and compared; anything that does not survive stops the
            // whole run before a single row is written.
            $trip = json_encode($next);
            if ($trip === false || (float) json_decode($trip) !== (float) $trimmed) {
                throw new \RuntimeException(
                    'VALUE WOULD NOT SURVIVE STORAGE, refusing to write: '.$prefix.$key
                    .' "'.$value.'" would become '.var_export($next, true)
                );
            }

            $payload[$key] = $next;
            $changed[]     = $prefix.$key.': "'.$value.'" → '.$next;
        }

        return $payload;
    }
}
