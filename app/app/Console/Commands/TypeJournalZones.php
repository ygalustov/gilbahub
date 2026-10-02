<?php

namespace App\Console\Commands;

use App\Support\ZoneTypes;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * GH-806 (queue item "Zones", stage SZh1) — THE ENTRIES THE JOURNAL ALREADY HOLDS GET THE KIND OF ZONE
 * THEY ARE ABOUT, AND NOT ONE OF THEM IS GUESSED AT.
 *
 * The owner's decision of 01.10.2026 is that a spray entry carries the type of a zone by its identifier.
 * The server writes it from now on (`SprayLogController`); this takes the rows that are already there.
 *
 * WHAT IT PRINTS BEFORE IT IS ALLOWED TO DO ANYTHING, because the numbers are what a person reads before
 * deciding to apply it: every word the journal holds with the type it would receive, how many rows that
 * is, how many would be left without a type, how many carry a word nobody declared, and the ids of every
 * row whose type is not `green` — on the stand there is exactly one such row and losing it would lose
 * the only live example of a non-`greens` entry in the database.
 *
 * WHAT STOPS IT, each with why, and in none of these cases is a single row written:
 *   - the column is not there — the migration of this stage has not run;
 *   - a word nobody declared — a type for it would be a guess, and this command does not guess;
 *   - a row would be left without a type while its word HAS one — that is a contradiction in the table
 *     rather than a state to write;
 *   - a row already carries a type that disagrees with the table — somebody or something has written
 *     it, and overwriting it would hide that.
 *
 * A ROW WHOSE WORD HAS NO TYPE IS NOT AN ERROR. `surrounds` and `sportsground` are declared as having
 * none, so such a row is counted, named and left as it is; the stand holds none today.
 *
 * REPEATABLE: a second pass writes nothing and says so (`already typed`), because it only touches a row
 * whose `zone_type` is NULL.
 */
class TypeJournalZones extends Command
{
    protected $signature = 'gilba:type-journal-zones {--apply : write the types, instead of only printing what would be written}';

    protected $description = 'GH-806: give every spray journal entry the type of zone its word means';

    /**
     * The journal as it stands: every word with its type and how many rows carry the pair.
     *
     * COUNTED IN PHP, AND THAT IS THE REPAIR of 02.10.2026 rather than a style: this read
     * `COUNT(*) as rows`, and `rows` is a reserved word in MySQL 8, so the query did not parse at all —
     * on the stand, after the command had already written. The suite runs on SQLite (`phpunit.xml`),
     * where the word is ordinary, so nothing here could have gone red. With no aggregate there is no
     * alias left to collide with a dialect.
     *
     * @return array<int,string> `word/type: rows`, in the order of the word
     */
    private static function tally(): array
    {
        $tally = [];
        foreach (DB::table('spray_logs')->orderBy('zone')->get(['zone', 'zone_type']) as $row) {
            $key = $row->zone.'/'.($row->zone_type ?? 'null');
            $tally[$key] = ($tally[$key] ?? 0) + 1;
        }
        ksort($tally);

        return array_map(fn ($k, $n) => $k.': '.$n, array_keys($tally), $tally);
    }

    public function handle(): int
    {
        if (! Schema::hasColumn('spray_logs', 'zone_type')) {
            $this->error('spray_logs has no `zone_type` column: run the migration of stage SZh1 first.');

            return self::FAILURE;
        }

        $apply = (bool) $this->option('apply');
        $rows = DB::table('spray_logs')->orderBy('id')->get(['id', 'site_id', 'zone', 'zone_type']);

        $this->line('[gh806] the table this command reads: '.json_encode(ZoneTypes::journalWords()));
        $this->line('[gh806] rows in the journal: '.$rows->count());

        $byWord = [];
        $undeclared = [];
        $noType = [];
        $disagree = [];
        $alreadyTyped = 0;
        $toSet = [];
        $notGreen = [];

        foreach ($rows as $row) {
            $word = (string) $row->zone;
            $type = null;
            try {
                $type = ZoneTypes::zoneTypeOfJournalWord($word);
            } catch (\RuntimeException $e) {
                $undeclared[] = $row->id.' "'.$word.'"';

                continue;
            }

            $key = $word.' -> '.($type ?? '(no type)');
            $byWord[$key] = ($byWord[$key] ?? 0) + 1;

            if ($type === null) {
                $noType[] = $row->id.' "'.$word.'"';

                continue;
            }
            if ($row->zone_type !== null) {
                if ($row->zone_type === $type) {
                    $alreadyTyped++;
                } else {
                    $disagree[] = $row->id.' has "'.$row->zone_type.'", the table says "'.$type.'"';
                }

                continue;
            }
            $toSet[$row->id] = $type;
            if ($type !== 'green') {
                $notGreen[] = $row->id.' "'.$word.'" -> '.$type;
            }
        }

        /**
         * GH-806, the reviewer's requirement of 02.10.2026 — THE SUMMARY IS PRINTED IN BOTH MODES, AND
         * IN THE DRY RUN BEFORE ANYTHING IS WRITTEN.
         *
         * It used to be printed only after the write, which is exactly why a summary that could not
         * parse on MySQL 8 was not met until `--apply` had already run. A dry run that does not read
         * the table the same way the real run does is not a rehearsal of it.
         */
        $this->line('[gh806] the journal as it stands, by word and type: '
            .json_encode(self::tally()));

        ksort($byWord);
        foreach ($byWord as $line => $count) {
            $this->line('[gh806]   '.$line.' : '.$count);
        }
        $this->line('[gh806] already typed: '.$alreadyTyped);
        $this->line('[gh806] would set zone_type on: '.count($toSet));
        $this->line('[gh806] would change zone: 0 (this command never writes that column)');
        $this->line('[gh806] rows whose word has no type: '.count($noType).' '.json_encode($noType));
        $this->line('[gh806] rows carrying a word nobody declared: '.count($undeclared).' '.json_encode($undeclared));
        /**
         * THE ROWS THAT ARE NOT `green`, BY ID — the reviewer's requirement of 02.10.2026. One row of
         * the stand carries `other`, on a site of the owner's, and it is the only live example of a
         * non-`greens` entry there is: printed by id so that it can be looked at before and after.
         */
        /**
         * AN INVENTORY OF WHAT THIS RUN WOULD DO, not of what the journal holds — the reviewer's
         * correction of 02.10.2026. After a run that has already typed everything it prints `0 []`,
         * and under the old wording ("rows whose type is not green") that read as "there are no
         * non-green rows", which is false: the stand holds one and it keeps it.
         */
        $this->line('[gh806] rows this run would type as something other than `green`: '
            .count($notGreen).' '.json_encode($notGreen));

        if ($undeclared !== []) {
            $this->error('[gh806] nothing written: a word this product does not declare cannot be given a type by guessing.');

            return self::FAILURE;
        }
        if ($disagree !== []) {
            $this->error('[gh806] nothing written: a row already carries a type that disagrees with the table: '
                .implode('; ', $disagree));

            return self::FAILURE;
        }

        if (! $apply) {
            $this->line('[gh806] dry run: nothing written. Run again with --apply to write.');

            return self::SUCCESS;
        }

        $written = 0;
        DB::transaction(function () use ($toSet, &$written) {
            foreach ($toSet as $id => $type) {
                $written += DB::table('spray_logs')->where('id', $id)->whereNull('zone_type')
                    ->update(['zone_type' => $type]);
            }
        });

        /**
         * GH-806, after the coordinator's window of 02.10.2026 — COUNTED HERE, NOT IN SQL, and the
         * reason is a defect this line had: it read `COUNT(*) as rows`, and `rows` is a reserved word in
         * MySQL 8, so the query did not parse at all. The command had already written by then, so the
         * data was right and the run ended in an exception — a command that cannot finish cannot be
         * handed to anybody. It was green in the suite because the suite runs on SQLite, where `rows` is
         * not reserved.
         *
         * SO THE AGGREGATE IS GONE rather than quoted: the rows are read as they are and counted in PHP.
         * There is no alias left to collide with a dialect, which removes the class instead of renaming
         * one instance of it. `Gh806…::test_no_raw_query_of_this_command_names_a_word_mysql_reserves`
         * holds the rest of the command to the same rule.
         */
        $this->line('[gh806] written: '.$written);
        $this->line('[gh806] the journal now, by word and type: '.json_encode(self::tally()));

        /**
         * WHAT IT SAYS ABOUT ITSELF rather than only what it did: the count it printed and the count the
         * database holds, read back after the write. A number this command keeps in a variable is not a
         * fact about the table.
         */
        $typedNow = DB::table('spray_logs')->whereNotNull('zone_type')->count();
        $this->line('[gh806] rows with a type, counted in the database afterwards: '.$typedNow);

        return self::SUCCESS;
    }
}
