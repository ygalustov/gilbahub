<?php

namespace App\Console\Commands;

use App\Support\AnalysisResults;
use App\Support\AnalysisResultSchema;
use Illuminate\Console\Command;

/**
 * GH-558 (reviewer's finding on GH-557) — apply the outcome rule to the rows
 * that were written before it existed.
 *
 * WHY THERE IS ANYTHING TO DO. GH-557 made the server derive a run's outcome
 * from its numbers, AT WRITE TIME, and the projection reads the stored column
 * rather than working it out again — deliberately, so that one rule decides an
 * outcome and one place applies it. The consequence is that rows written earlier
 * keep the word they were given, and the row that shows the defect best is one
 * of them: Federal Golf's live re-run carries six of thirteen keys and says
 * `complete`, so the panel returns null and the pill reads as an ordinary fresh
 * analysis. The state the third outcome exists to end, surviving on the one site
 * where it occurs.
 *
 * WHY A COMMAND AND NOT A MIGRATION. This is a decision about data, not a
 * consequence of a schema change: whether to restate what past runs were is the
 * owner's call, and a migration would make it on her behalf the next time
 * anybody deploys. `--dry-run` prints exactly what the write would do.
 *
 * WHY IT DOES NOT TOUCH THE TABLE ITSELF. `App\Support\AnalysisResults` is the
 * only code that may read or write an analysis result, and a static guard says
 * so — which is how the first version of this command was caught reaching past
 * it. It asks the owner which rows disagree with the rule and hands back ids;
 * the reading, the judging and the writing all stay where they belong.
 */
class RecomputeAnalysisOutcomes extends Command
{
    protected $signature = 'analysis:recompute-outcomes {--dry-run : Print the report and change nothing}';

    protected $description = 'Restate the outcome of stored analysis results under today\'s rule (GH-557, GH-573)';

    public function handle(): int
    {
        $dryRun = (bool) $this->option('dry-run');

        $this->line('');
        $this->info($dryRun
            ? 'analysis:recompute-outcomes — DRY RUN, nothing will be written'
            : 'analysis:recompute-outcomes — writing');
        $this->line('');

        $required = AnalysisResultSchema::requiredMetrics();
        $this->line('The rule: a run is partial when a required metric was not computed ('
            .count($required).' are required), or when it declared a module that produced nothing');
        $this->line('AND that module\'s result is really absent from `computed` (GH-573).');
        $this->line('It restates BOTH ways: rows made partial by the withdrawn journal rule come back.');

        $census = AnalysisResults::outcomeCensus();
        $this->line('Rows by stored outcome: '.(
            $census ? collect($census)->map(fn ($n, $o) => $o.' '.$n)->implode(', ') : 'none'
        ));
        $this->line('');

        $toRestate = AnalysisResults::outcomesToRestate();

        $this->table(
            ['id', 'site', 'run_id', 'completed_at', 'was', 'becomes', 'have', 'not computed', 'produced nothing'],
            array_map(fn (array $r) => [
                $r['id'],
                $r['site'],
                $r['runId'],
                $r['completedAt'],
                $r['was'],
                $r['becomes'],
                (count($required) - count($r['uncomputed'])).' / '.count($required),
                implode(', ', array_slice($r['uncomputed'], 0, 5))
                    .(count($r['uncomputed']) > 5 ? ' (+'.(count($r['uncomputed']) - 5).')' : ''),
                implode(', ', $r['notProduced']),
            ], $toRestate)
        );

        $this->line('');
        $toPartial  = count(array_filter($toRestate, fn ($r) => $r['becomes'] === 'partial'));
        $toComplete = count(array_filter($toRestate, fn ($r) => $r['becomes'] === 'complete'));

        $this->line('complete → partial : '.$toPartial);
        $this->line('partial → complete : '.$toComplete);
        $this->line('unchanged complete : '.max(0, ($census['complete'] ?? 0) - $toPartial));
        $this->line('unchanged partial  : '.max(0, ($census['partial'] ?? 0) - $toComplete));
        $this->line('left as failed     : '.($census['failed'] ?? 0));
        $this->line('');

        if ($dryRun) {
            $this->info('Nothing was written.');

            return self::SUCCESS;
        }

        if (! $toRestate) {
            $this->info('Nothing to restate.');

            return self::SUCCESS;
        }

        $changed = AnalysisResults::restateOutcomes(array_column($toRestate, 'id'));
        $this->info('Restated '.$changed.' row(s).');

        return self::SUCCESS;
    }
}
