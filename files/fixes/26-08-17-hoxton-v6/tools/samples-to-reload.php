<?php
/**
 * GH-722 (queue item 3m) — WHICH STORED SAMPLES CARRY A READING UNDER A NAME THAT IS NOT CANONICAL.
 *
 * READ ONLY. SELECTs inside a read-only transaction that is rolled back; nothing is written, no
 * temporary table is made. Same shape as `gilba:audit-data`.
 *
 * ONE READER OF THE NAMES. The names are recognised by `App\Support\LabReadingNames::recognise`,
 * the same code the upload and the run use, so this script keeps no list of names of its own.
 *
 * HOW TO RUN — from the Laravel app root on the server that holds the database (the folder with
 * `artisan`), after copying this file there:
 *
 *     php artisan tinker --execute="require 'samples-to-reload.php';"
 *
 * The database is the one the app's own .env points at. Nothing else needs to be set.
 *
 * WHAT IT PRINTS
 *   - one line per sample that stores at least one reading under a non-canonical name: site, sample
 *     id, date, lab, source file, and every such name with the canonical name it stands for;
 *   - samples that store a column the names do not recognise at all, on their own lines;
 *   - what it looked at: sites and samples inspected, by kind. An empty result with these numbers
 *     means "looked and found nothing"; without them it would mean nothing.
 *
 * MARKS
 *   [suffix]    recognised only after an extraction-method suffix was taken off (for example
 *               `pH_CaCl2` read as `pH`). Not the same reading under another name; do not reload
 *               such a sample before that is decided.
 *   [both]      the canonical name is ALSO stored in the same sample, possibly with another value.
 */

use App\Support\LabReadingNames;
use Illuminate\Support\Facades\DB;

(function () {
    $out = static function (string $line): void { echo $line, PHP_EOL; };
    $meta = static fn (string $k): bool => $k === '' || $k[0] === '_' || $k === 'zone';

    if (DB::connection()->getDriverName() === 'mysql') {
        DB::statement('SET TRANSACTION READ ONLY');
    }
    $liveSites = 0;
    DB::beginTransaction();
    try {
        $rows = DB::table('samples')
            ->join('sites', 'sites.id', '=', 'samples.site_id')
            ->whereNull('samples.deleted_at')
            ->whereNull('sites.deleted_at')
            ->orderBy('sites.name')->orderBy('samples.id')
            ->get(['samples.id', 'samples.sample_type', 'samples.sample_date', 'samples.lab_date',
                   'samples.lab_name', 'samples.payload', 'sites.id as site_id', 'sites.name as site_name']);
        $liveSites = DB::table('sites')->whereNull('deleted_at')->count();
    } finally {
        DB::rollBack();
    }

    $sites = [];
    $byKind = [];
    $wrong = [];
    $unknown = [];
    foreach ($rows as $r) {
        $sites[$r->site_id] = true;
        $kind = (string) $r->sample_type;
        $byKind[$kind] = ($byKind[$kind] ?? 0) + 1;
        $payload = json_decode((string) $r->payload, true);
        if (! is_array($payload)) {
            $unknown[] = [$r, ['(payload is not a JSON object)']];
            continue;
        }
        $spellings = LabReadingNames::readings($kind);
        if ($spellings === null) {
            continue;
        }
        $canonical = array_keys($spellings);
        $exactLower = [];
        foreach ($spellings as $key => $list) {
            foreach ((array) $list as $s) {
                $exactLower[mb_strtolower((string) $s)] = $key;
            }
        }
        $bad = [];
        $unrec = [];
        foreach ($payload as $col => $value) {
            $col = (string) $col;
            if ($meta($col) || in_array($col, $canonical, true)) {
                continue;
            }
            $found = LabReadingNames::recognise($kind, [$col => $value]) ?? [];
            if ($found === []) {
                $unrec[] = $col;
                continue;
            }
            $to = (string) array_key_first($found);
            $marks = [];
            if (! isset($exactLower[mb_strtolower($col)])) {
                $marks[] = 'suffix';
            }
            if (array_key_exists($to, $payload)) {
                $marks[] = 'both';
            }
            $bad[] = $col.' -> '.$to.($marks ? ' ['.implode(',', $marks).']' : '');
        }
        if ($bad) {
            $wrong[] = [$r, $bad];
        }
        if ($unrec) {
            $unknown[] = [$r, $unrec];
        }
    }

    $line = static function ($r, array $names) use ($out): void {
        $payload = json_decode((string) $r->payload, true);
        $source = is_array($payload) && ! empty($payload['_source']) ? (string) $payload['_source'] : 'not recorded';
        $date = $r->lab_date ?: ($r->sample_date ?: 'no date');
        $label = is_array($payload) && ! empty($payload['_label']) ? (string) $payload['_label'] : '-';
        $out(sprintf('%s | %s #%s "%s" | date %s | lab %s | file: %s | %s',
            $r->site_name, $r->sample_type, $r->id, $label, $date, $r->lab_name ?: 'not recorded', $source,
            implode('; ', $names)));
    };

    $out('SAMPLES STORING A READING UNDER A NON-CANONICAL NAME (reload these from their file):');
    foreach ($wrong as [$r, $names]) {
        $line($r, $names);
    }
    if (! $wrong) {
        $out('(none)');
    }
    $out('');
    $out('SAMPLES STORING A COLUMN THE NAMES DO NOT RECOGNISE (not a reading the run uses):');
    foreach ($unknown as [$r, $names]) {
        $line($r, $names);
    }
    if (! $unknown) {
        $out('(none)');
    }
    $out('');
    ksort($byKind);
    $kinds = [];
    foreach ($byKind as $k => $n) {
        $kinds[] = $k.' '.$n;
    }
    $out(sprintf('INSPECTED: %d live sites, %d of them with samples; %d samples (%s); %d samples with a non-canonical name, %d with an unrecognised column.',
        $liveSites, count($sites), count($rows), implode(', ', $kinds), count($wrong), count($unknown)));
    $out('Read only: every query ran inside a read-only transaction that was rolled back.');
})();
