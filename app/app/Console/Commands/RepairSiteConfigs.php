<?php

namespace App\Console\Commands;

use App\Models\Site;
use App\Support\FieldOwners;
use App\Support\SiteConfigWriter;
use App\Support\SiteTimezone;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * GH-446 (GH-439 stage 4a) — repair the rows the old write paths damaged.
 *
 * Two fields are written, both because the damage has a signature that cannot
 * be mistaken for a decision:
 *
 *   1. `config.wizard`, removed by the background snapshots (scenario H1). A
 *      site with a species and coordinates has been through the wizard by
 *      definition; the record saying so was deleted by a page, not by anyone.
 *   2. `sites.timezone`, where it is NULL or Australia/Sydney on a site whose
 *      coordinates keep different time. Nothing in the product ever wrote any
 *      other value: NULL came from site creation, Australia/Sydney from four
 *      automatic writers (both wizards, syncRegistry, and the Settings select
 *      showing its first option over a NULL). Any other zone could only have
 *      been chosen by a person, and is left alone.
 *
 * Three things are reported and never touched: names that equal their own id
 * (nothing to restore them from), sites without coordinates (nothing to derive
 * from), and empty sites with no samples (deleting is irreversible and is the
 * owner's call).
 *
 * The report prints on every run, with or without writing. `--dry-run` prints
 * exactly the same thing and changes nothing.
 */
class RepairSiteConfigs extends Command
{
    protected $signature = 'sites:repair-config {--dry-run : Print the report without writing anything}';

    protected $description = 'Repair the wizard record and the time zone on sites damaged by the pre-GH-439 write paths';

    private const REPAIR_TAG = 'GH-439e';

    /** The only zone an automatic writer ever put in this column. */
    private const DEFAULTED_ZONE = 'Australia/Sydney';

    public function handle(): int
    {
        $dryRun = (bool) $this->option('dry-run');

        $this->line('');
        $this->info($dryRun
            ? 'sites:repair-config — DRY RUN, nothing will be written'
            : 'sites:repair-config — writing');
        $this->line('');

        $report = DB::transaction(function () use ($dryRun) {
            return $this->repair($dryRun);
        });

        $this->printReport($report, $dryRun);

        return self::SUCCESS;
    }

    /**
     * @return array<string, array>
     */
    private function repair(bool $dryRun): array
    {
        $written = [];
        $leftAlone = [];
        $reportOnly = [
            'name_is_id' => [],
            'no_coordinates' => [],
            'empty_and_unused' => [],
        ];
        $stillWithoutWizard = [];

        $sites = Site::query()
            ->with('configs')
            ->whereNull('deleted_at')
            ->orderBy('name')
            ->lockForUpdate()
            ->get();

        foreach ($sites as $site) {
            $configRow = $site->configs->firstWhere('namespace', 'gaip');
            $config = is_array($configRow?->config) ? $configRow->config : [];
            $species = trim((string) ($config['turf']['species'] ?? ''));
            $latitude = $site->latitude !== null ? (float) $site->latitude : null;
            $longitude = $site->longitude !== null ? (float) $site->longitude : null;
            $hasCoordinates = $latitude !== null && $longitude !== null;

            // ---- report-only lists -------------------------------------
            if ($site->name === $site->id) {
                $reportOnly['name_is_id'][] = ['id' => $site->id, 'name' => $site->name];
            }
            if (! $hasCoordinates) {
                $reportOnly['no_coordinates'][] = [
                    'id' => $site->id,
                    'name' => $site->name,
                    'timezone' => $site->timezone,
                ];
            }
            if ($config === [] && $site->name === $site->id
                && ! DB::table('samples')->where('site_id', $site->id)->exists()) {
                $reportOnly['empty_and_unused'][] = ['id' => $site->id, 'name' => $site->name];
            }

            // GH-474: the copies of the column-owned fields are rewritten
            // from their owners.
            //
            // This one IS repaired, where the report-only line below is not,
            // and the difference is which way the fact flows: `config.location`
            // is a derived copy of columns that own those fields, so writing
            // the owner's value into it restores a derivation, not a guess. The
            // report-only case is the opposite direction — a column filled and
            // the config empty tells us nothing about what the config should
            // say, because the column is the owner and it is already right.
            $ownedValues = [];
            foreach (FieldOwners::OWNERS as $ownedField => $ownedColumn) {
                if ($ownedColumn !== null) {
                    $ownedValues[$ownedColumn] = $site->{$ownedColumn};
                }
            }
            $derived = FieldOwners::deriveCopies($config, $ownedValues);
            if ($config !== [] && $derived !== $config) {
                $changes = [];
                foreach (FieldOwners::derivedCopies() as $ownedField) {
                    $parts = explode('.', $ownedField);
                    $before = $config;
                    $after = $derived;
                    foreach ($parts as $part) {
                        $before = is_array($before) && array_key_exists($part, $before) ? $before[$part] : null;
                        $after = is_array($after) && array_key_exists($part, $after) ? $after[$part] : null;
                    }
                    if ($before !== $after) {
                        $changes[] = $ownedField.': '.json_encode($before).' → '.json_encode($after);
                    }
                }
                if ($changes !== []) {
                    $written[] = [
                        'id' => $site->id, 'name' => $site->name, 'field' => 'config.location (derived copy)',
                        'from' => implode('; ', $changes), 'to' => 'the owning columns',
                        'reason' => 'the copy is derived from the columns that own those fields; it had drifted',
                    ];
                    if (! $dryRun) {
                        SiteConfigWriter::mutate($site->id, 'gaip',
                            fn (array $stored) => FieldOwners::deriveCopies($stored, $ownedValues));
                    }
                }
            }

            // GH-474 supersedes the GH-472 report-only line that stood here.
            //
            // It listed sites where `sites.location_name` was filled and
            // `config.location.name` was empty, and refused to repair them on
            // the grounds that the column was a copy that had stopped being
            // updated and was no evidence of what the config should say. That
            // reasoning was right about a MIRROR and wrong about an OWNER:
            // ownership is declared per field now, the column owns the name,
            // and the config's entry is a copy derived from it. So this case
            // is repaired above, with the rest of the derived copies, and
            // printing it as an unresolved difference would be printing a
            // difference that has an answer.

            // ---- rule 1: the wizard record -----------------------------
            $wizard = $config['wizard'] ?? null;
            if (is_array($wizard)) {
                $leftAlone[] = [
                    'id' => $site->id, 'name' => $site->name, 'field' => 'config.wizard',
                    'value' => 'present', 'reason' => 'the site already has a wizard record',
                ];
            } elseif ($species === '' || ! $hasCoordinates) {
                $missing = [];
                if ($species === '') $missing[] = 'no species';
                if (! $hasCoordinates) $missing[] = 'no coordinates';
                $stillWithoutWizard[] = [
                    'id' => $site->id, 'name' => $site->name, 'reason' => implode(', ', $missing),
                ];
            } else {
                $written[] = [
                    'id' => $site->id, 'name' => $site->name, 'field' => 'config.wizard',
                    'from' => 'missing', 'to' => 'complete',
                    'reason' => 'species and coordinates are set — the record was removed by a page, not by a person',
                ];

                if (! $dryRun) {
                    // GH-447: through the one writer, which takes the row
                    // lock; GH-448: and the record says what it is.
                    SiteConfigWriter::mutate($site->id, 'gaip', function (array $stored) {
                        $stored['wizard'] = [
                            'complete' => true,
                            // The date the wizard was actually completed is not
                            // recoverable -- the record was deleted, and nothing
                            // logged it. Saying "completed today" would put the
                            // repair's own date on twelve sites at once and read,
                            // six months from now, as a fact about the site. What
                            // is known is that it was complete and that we
                            // restored the record.
                            'completedAt' => null,
                            'version' => '1.0',
                            'repaired' => self::REPAIR_TAG,
                            'repairedAt' => now()->toISOString(),
                            'repairedFrom' => 'missing',
                        ];

                        return $stored;
                    });

                    $this->recordRepairTrace($site, 'wizard', [
                        'from' => 'missing',
                        'to' => 'complete',
                        'at' => now()->toISOString(),
                    ]);
                }
            }

            // ---- rule 2: the time zone ---------------------------------
            if (! $hasCoordinates) {
                continue; // already reported; nothing to derive from
            }

            $current = $site->timezone !== null ? trim($site->timezone) : null;
            $derived = SiteTimezone::fromCoordinates($latitude, $longitude);

            if ($current !== null && $current !== '' && $current !== self::DEFAULTED_ZONE) {
                // Only a person could have written this.
                if ($derived !== null && ! SiteTimezone::keepsSameTime($current, $derived)) {
                    $leftAlone[] = [
                        'id' => $site->id, 'name' => $site->name, 'field' => 'sites.timezone',
                        'value' => $current,
                        'reason' => 'chosen by hand; differs from the derived '.$derived.' and is left as chosen',
                    ];
                } else {
                    $leftAlone[] = [
                        'id' => $site->id, 'name' => $site->name, 'field' => 'sites.timezone',
                        'value' => $current, 'reason' => 'matches the coordinates',
                    ];
                }
                continue;
            }

            if ($derived === null) {
                continue;
            }

            if ($current === self::DEFAULTED_ZONE && SiteTimezone::keepsSameTime($current, $derived)) {
                $leftAlone[] = [
                    'id' => $site->id, 'name' => $site->name, 'field' => 'sites.timezone',
                    'value' => $current,
                    'reason' => 'keeps the same time as the derived '.$derived.' — the clock is right',
                ];
                continue;
            }

            $written[] = [
                'id' => $site->id, 'name' => $site->name, 'field' => 'sites.timezone',
                'from' => $current ?? 'NULL', 'to' => $derived,
                'reason' => $current === null
                    ? 'never set; derived from the coordinates'
                    : 'the default zone, and it keeps different time from the coordinates',
            ];

            if (! $dryRun) {
                $site->forceFill(['timezone' => $derived])->save();
                $this->recordRepairTrace($site, 'timezone', [
                    'from' => $current,
                    'to' => $derived,
                    'at' => now()->toISOString(),
                ]);
            }
        }

        return [
            'written' => $written,
            'left_alone' => $leftAlone,
            'report_only' => $reportOnly,
            'still_without_wizard' => $stillWithoutWizard,
            'sites' => $sites->count(),
        ];
    }

    /**
     * GH-448: one trace, the same shape for both repairs.
     *
     * The time-zone repair already left `from`, `to` and `at` on the site row.
     * The wizard repair left a tag inside the config and nothing on the row at
     * all, so on a database where only some sites had their zone rewritten,
     * `sites` was silent about the rest -- and on production this trace is the
     * only way to tell later what the repair touched and what a person did.
     */
    private function recordRepairTrace(Site $site, string $field, array $entry): void
    {
        $attributes = is_array($site->attributes_json) ? $site->attributes_json : [];
        $attributes['gh439_repair'] = array_merge($attributes['gh439_repair'] ?? [], [
            $field => $entry,
        ]);
        $site->forceFill(['attributes_json' => $attributes])->save();
    }

    private function printReport(array $report, bool $dryRun): void
    {
        $verb = $dryRun ? 'would change' : 'changed';

        $this->line('Sites examined: '.$report['sites']);
        $this->line('');

        if ($report['written'] === []) {
            $this->line('Nothing to repair — every site already has what this command would write.');
        } else {
            $this->line(strtoupper($verb).' ('.count($report['written']).'):');
            $this->table(
                ['site_id', 'name', 'field', 'was', 'became', 'why'],
                array_map(fn ($row) => [
                    $row['id'], $row['name'], $row['field'], $row['from'], $row['to'], $row['reason'],
                ], $report['written'])
            );
        }

        $this->line('');
        $this->line('LEFT AS IS ('.count($report['left_alone']).'):');
        if ($report['left_alone'] !== []) {
            $this->table(
                ['site_id', 'name', 'field', 'value', 'why'],
                array_map(fn ($row) => [
                    $row['id'], $row['name'], $row['field'], $row['value'], $row['reason'],
                ], $report['left_alone'])
            );
        }

        foreach ([
            'name_is_id' => 'REPORT ONLY — name equals the site id (nothing to restore it from; fix in Settings or Account)',
            'no_coordinates' => 'REPORT ONLY — no coordinates (no zone can be derived; the setup wizard will ask for a location)',
            'empty_and_unused' => 'REPORT ONLY — empty config and no samples (deleting is irreversible: DELETE /api/sites/{id})',
        ] as $key => $heading) {
            $rows = $report['report_only'][$key];
            $this->line('');
            $this->line($heading.': '.count($rows));
            foreach ($rows as $row) {
                $this->line('  '.$row['id'].'  '.$row['name']
                    .(isset($row['column']) ? '  column: '.$row['column'] : ''));
            }
        }

        $this->line('');
        $withoutWizard = $report['still_without_wizard'];
        $this->line('Without a wizard record after this run: '.count($withoutWizard));
        foreach ($withoutWizard as $row) {
            $this->line('  '.$row['id'].'  '.$row['name'].'  ('.$row['reason'].')');
        }
        $this->line('');
    }
}
