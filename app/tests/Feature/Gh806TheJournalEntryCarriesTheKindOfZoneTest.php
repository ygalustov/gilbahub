<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Site;
use App\Models\User;
use App\Support\ZoneTypes;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * GH-806 (queue item "Zones", stage SZh1) — A SPRAY ENTRY SAYS WHICH KIND OF ZONE IT IS ABOUT, BY THE
 * IDENTIFIER OF THAT KIND.
 *
 * THE OWNER'S DECISION of 01.10.2026: "so that when we add a spray, the zone TYPE is chosen — that
 * identifier." The journal has only ever held a WORD of its own (`greens`, `surrounds`, …), which is
 * neither a zone of a site nor a key of the dictionary.
 *
 * THE ORDER OF THE STAGE IS NOT CHECKED BY A PAIR OF EYES — IT IS MADE HARMLESS, and that is the
 * reviewer's requirement of 02.10.2026, in his words: "one cannot CHECK the order; one can make the
 * order stop being a risk, and that is what cases prove." Three of them, below:
 *   1. the command refuses to run without the column, so "the command before the migration" ends in a
 *      refusal and not in a half-done transfer;
 *   2. the column takes NULL and the writing code lives with a word that has no type, so "the code
 *      before the command" is safe by construction — an entry with no type is an ordinary entry;
 *   3. the command is idempotent by its own mark, so "it was run twice" costs nothing.
 *
 * WHAT STAYS EXACTLY AS IT WAS: the word. Nothing reads the new column yet — the reader that decides
 * which applications count towards a calculation still reads `zone`, and moving it is stage SZh2, which
 * waits on the owner's answer about which types count for which kind of site.
 */
class Gh806TheJournalEntryCarriesTheKindOfZoneTest extends TestCase
{
    use RefreshDatabase;

    public function test_a_spray_saved_through_the_api_carries_the_kind_of_zone_and_still_carries_the_word(): void
    {
        [$user, $site] = $this->aSite();

        $answer = $this->postSpray($user, $site, ['greens', 'tees']);
        $rows = DB::table('spray_logs')->orderBy('id')->get(['zone', 'zone_type']);

        fwrite(STDOUT, '[gh806] what the save stored: '
            .json_encode($rows->map(fn ($r) => $r->zone.' -> '.json_encode($r->zone_type))->all()).PHP_EOL);

        $answer->assertStatus(201);
        // The kind, by its identifier, from the one table -- and the word, untouched beside it.
        $this->assertSame(['greens' => 'green', 'tees' => 'tee'],
            $rows->mapWithKeys(fn ($r) => [$r->zone => $r->zone_type])->all());
    }

    /**
     * CASE 2 OF THE THREE — AS BEHAVIOUR AND NOT AS A NUMBER. A word the dictionary declares no type for
     * is stored with NULL, the save succeeds, and the entry comes back like any other. That is what makes
     * "the code is live before the transfer has run" harmless: rows with no type are ordinary rows.
     */
    public function test_a_word_with_no_type_is_stored_as_having_none_and_nothing_breaks(): void
    {
        [$user, $site] = $this->aSite();

        $answer = $this->postSpray($user, $site, ['surrounds']);
        $row = DB::table('spray_logs')->orderBy('id')->first();
        $listed = $this->actingAs($user)->getJson('/api/spray-log?site_id='.$site->id);

        fwrite(STDOUT, '[gh806] a word with no type: '.json_encode(['zone' => $row->zone,
            'zone_type' => $row->zone_type, 'the list answers' => $listed->status()]).PHP_EOL);

        $answer->assertStatus(201);
        // NULL is the answer, not a failure and not a guessed type.
        $this->assertSame('surrounds', $row->zone);
        $this->assertNull($row->zone_type);
        $this->assertNull(ZoneTypes::zoneTypeOfJournalWord('surrounds'));
        // And the entry is readable exactly as the others are: nothing downstream needs the type yet.
        $listed->assertStatus(200);
        $this->assertSame('surrounds', $listed->json('entries.0.zone'));
    }

    public function test_a_word_the_table_does_not_declare_is_refused_and_nothing_is_stored(): void
    {
        [$user, $site] = $this->aSite();

        $answer = $this->postSpray($user, $site, ['the back nine']);

        fwrite(STDOUT, '[gh806] an undeclared word: '.$answer->status().' '
            .json_encode($answer->json('error'))
            .', rows in the journal: '.DB::table('spray_logs')->count().PHP_EOL);

        $answer->assertStatus(422);
        $this->assertStringContainsString('the back nine', (string) $answer->json('error'));
        $this->assertSame(0, DB::table('spray_logs')->count());
    }

    public function test_editing_the_word_of_an_entry_moves_its_kind_with_it(): void
    {
        [$user, $site] = $this->aSite();
        $this->postSpray($user, $site, ['greens'])->assertStatus(201);
        $id = DB::table('spray_logs')->value('id');

        $answer = $this->actingAs($user)->withSession(['_token' => 't'])
            ->putJson('/api/spray-log/'.$id, ['_token' => 't', 'zone' => 'fairways']);
        $row = DB::table('spray_logs')->where('id', $id)->first();

        fwrite(STDOUT, '[gh806] after the edit: '.json_encode([$row->zone, $row->zone_type]).PHP_EOL);

        $answer->assertStatus(200);
        // The entry cannot keep the kind of the zone it used to be about.
        $this->assertSame('fairways', $row->zone);
        $this->assertSame('fairway', $row->zone_type);
    }

    /**
     * THE TRANSFER — the numbers it prints, and that what it printed is what the database holds.
     *
     * The shape of the stand is built here: four entries carrying `greens` and one carrying `other`,
     * which is the only non-`greens` entry the stand has. The run prints every non-`green` row BY ID,
     * the reviewer's requirement, so that row can be looked at before and after.
     */
    public function test_the_transfer_types_every_entry_prints_its_numbers_and_leaves_the_words_alone(): void
    {
        [$user, $site] = $this->aSite();
        $ids = $this->fiveEntriesLikeTheStand($site);
        $before = $this->journalNow();

        $dry = $this->saying('gilba:type-journal-zones');
        $applied = $this->saying('gilba:type-journal-zones --apply');
        $again = $this->saying('gilba:type-journal-zones --apply');
        $after = $this->journalNow();

        fwrite(STDOUT, '[gh806] the dry run said:'.PHP_EOL.$dry
            .'[gh806] the run said:'.PHP_EOL.$applied
            .'[gh806] and the second run said:'.PHP_EOL.$again
            .'[gh806] the journal before: '.json_encode($before)
            .PHP_EOL.'[gh806] and after: '.json_encode($after).PHP_EOL);

        // What the dry run promised, in its own words.
        $this->assertStringContainsString('greens -> green : 4', $dry);
        $this->assertStringContainsString('other -> other : 1', $dry);
        $this->assertStringContainsString('would set zone_type on: 5', $dry);
        $this->assertStringContainsString('would change zone: 0', $dry);
        $this->assertStringContainsString('rows whose word has no type: 0', $dry);
        $this->assertStringContainsString('rows carrying a word nobody declared: 0', $dry);
        // The dry run writes nothing: the journal is as it was.
        $this->assertStringContainsString('dry run: nothing written', $dry);

        // THE ROW THAT IS NOT `green`, BY ID, before and after -- the reviewer's requirement.
        // The wording says what the line is about: the rows THIS RUN would type, not the rows the
        // journal holds. After a run that typed everything it is `0 []`, which under the old wording
        // read as "there are no non-green rows" -- and the stand has one, which it keeps.
        $this->assertStringContainsString('rows this run would type as something other than `green`: 1', $dry);
        $this->assertStringContainsString('rows this run would type as something other than `green`: 0', $again);
        // The id is printed inside a JSON list, so the quotes around the word are escaped there.
        $this->assertStringContainsString(json_encode($ids['other'].' "other" -> other'), $dry);
        $this->assertSame(['zone' => 'other', 'zone_type' => 'other'],
            (array) DB::table('spray_logs')->where('id', $ids['other'])
                ->first(['zone', 'zone_type']));

        // The run itself: five rows typed, and the count read BACK OUT of the database afterwards.
        $this->assertStringContainsString('written: 5', $applied);
        $this->assertStringContainsString('rows with a type, counted in the database afterwards: 5', $applied);
        // Repeatable: the second pass writes nothing and says why.
        $this->assertStringContainsString('already typed: 5', $again);
        $this->assertStringContainsString('would set zone_type on: 0', $again);
        $this->assertStringContainsString('written: 0', $again);

        // And the words are exactly the words: the perechen, not its length.
        $this->assertSame(array_keys($before), array_keys($after));
        $this->assertSame(['greens' => 4, 'other' => 1], $before);
        $this->assertSame(['greens' => 4, 'other' => 1], $after);
    }

    /**
     * CASE 1 OF THE THREE — THE COMMAND WITHOUT THE COLUMN. "The command before the migration" ends in a
     * refusal that names its reason, and not one row is touched. This is what makes the order of the
     * stage harmless rather than merely watched.
     */
    public function test_the_command_refuses_to_run_before_the_migration_and_touches_nothing(): void
    {
        [$user, $site] = $this->aSite();
        $this->fiveEntriesLikeTheStand($site);
        $before = DB::table('spray_logs')->orderBy('id')->get(['id', 'zone'])->toJson();

        /**
         * The schema as it is before this stage's migration — index first, as the migration's own `down`
         * does it: SQLite refuses to drop a column an index still names.
         */
        Schema::table('spray_logs', function ($table) {
            $table->dropIndex(['zone_type']);
            $table->dropColumn('zone_type');
        });
        $said = $this->saying('gilba:type-journal-zones --apply');
        $after = DB::table('spray_logs')->orderBy('id')->get(['id', 'zone'])->toJson();

        fwrite(STDOUT, '[gh806] without the column the command said:'.PHP_EOL.$said
            .'[gh806] the journal before: '.$before.PHP_EOL.'[gh806] and after:  '.$after.PHP_EOL);

        $this->assertFalse(Schema::hasColumn('spray_logs', 'zone_type'));
        // The reason, in its own words, so a person reading the output knows what to do.
        $this->assertStringContainsString('spray_logs has no `zone_type` column', $said);
        $this->assertStringContainsString('run the migration of stage SZh1 first', $said);
        // And nothing was touched.
        $this->assertSame($before, $after);
    }

    public function test_a_row_whose_type_disagrees_with_the_table_stops_the_command(): void
    {
        [$user, $site] = $this->aSite();
        $ids = $this->fiveEntriesLikeTheStand($site);
        // Somebody, or something, has written a type that is not what the word means.
        DB::table('spray_logs')->where('id', $ids['other'])->update(['zone_type' => 'green']);
        $before = $this->typesNow();

        $said = $this->saying('gilba:type-journal-zones --apply');

        fwrite(STDOUT, '[gh806] a disagreeing row: '.PHP_EOL.$said
            .'[gh806] the types before and after: '.json_encode([$before, $this->typesNow()]).PHP_EOL);

        $this->assertStringContainsString('nothing written: a row already carries a type that disagrees', $said);
        // Not one row written -- including the four that WOULD have been fine.
        $this->assertSame($before, $this->typesNow());
    }

    /**
     * THE FINAL PRINT IS RUN, AND NO QUERY OF THIS COMMAND NAMES A WORD MYSQL RESERVES.
     *
     * WHY THIS CASE EXISTS, and it is a defect of mine rather than a precaution. The summary printed
     * after the write read `COUNT(*) as rows`, and `rows` is a reserved word in MySQL 8: on the stand the
     * query did not parse and the command ended in an exception — after it had written, so the data was
     * right and the run was unusable. The suite stayed green because it runs on SQLite, where `rows` is
     * an ordinary name. The coordinator met it in her window on 02.10.2026.
     *
     * TWO HALVES, because either alone would have missed it:
     *   - the print is EXERCISED: the command runs to its end and the summary line is read back, so a
     *     summary that throws on any engine fails here;
     *   - and no raw query of the command names anything MySQL reserves. The suite cannot run the
     *     dialect, so this half is read off the source — the only way a dialect fault is catchable
     *     offline, and it is why the aggregate was removed rather than quoted: there is no alias left.
     */
    public function test_the_summary_is_printed_and_no_query_names_a_word_mysql_reserves(): void
    {
        [$user, $site] = $this->aSite();
        $this->fiveEntriesLikeTheStand($site);

        /**
         * BOTH MODES, and the dry one BEFORE anything is written — the reviewer's requirement of
         * 02.10.2026, and the reason the fault survived: the summary used to be printed only after the
         * write, so a dry run never executed it and `--apply` met it with the rows already changed.
         */
        $dry = $this->saying('gilba:type-journal-zones');
        $typesAfterTheDryRun = $this->typesNow();
        $said = $this->saying('gilba:type-journal-zones --apply');
        /**
         * CODE ONLY, through the tokenizer: the comment above the repair quotes the broken line
         * (`COUNT(*) as rows`), and a scan over the raw file would find the fault in the sentence that
         * explains it. Measured when this case was first written -- it reported `rows` against the
         * repaired command.
         */
        $source = '';
        foreach (token_get_all(file_get_contents(
            dirname(__DIR__, 2).'/app/Console/Commands/TypeJournalZones.php')) as $token) {
            if (is_array($token) && in_array($token[0], [T_COMMENT, T_DOC_COMMENT], true)) {
                continue;
            }
            $source .= is_array($token) ? $token[1] : $token;
        }
        /**
         * The words of MySQL 8 this command could plausibly reach for as a name, each one a real
         * reserved word. Not the whole list: the point is the shape of the fault, and a name from this
         * handful is what a summary of counts invites.
         */
        $reserved = ['rows', 'rank', 'groups', 'system', 'lead', 'lag', 'window', 'over',
            'recursive', 'cume_dist', 'first_value', 'last_value', 'percent_rank'];
        $named = [];
        foreach ($reserved as $word) {
            if (preg_match('/\bas\s+'.$word.'\b/i', $source)
                || preg_match('/\bselectRaw\([\'"][^\'"]*\b'.$word.'\b/i', $source)) {
                $named[] = $word;
            }
        }

        fwrite(STDOUT, '[gh806] the dry run printed: '
            .json_encode($this->lineOf($dry, 'the journal as it stands, by word and type'))
            .PHP_EOL.'[gh806] the summary line the run printed: '
            .json_encode($this->lineOf($said, 'the journal now, by word and type'))
            .PHP_EOL.'[gh806] reserved words this command names in a query: '.json_encode($named).PHP_EOL);

        // THE DRY RUN printed it too, and over the journal as it stood: nothing typed yet.
        $this->assertStringContainsString('the journal as it stands, by word and type:', $dry);
        $this->assertStringContainsString(json_encode('greens/null: 4'), $dry);
        $this->assertStringContainsString(json_encode('other/null: 1'), $dry);
        // And it wrote nothing while doing so.
        $this->assertSame([1 => null, 2 => null, 3 => null, 4 => null, 5 => null], $typesAfterTheDryRun);
        // The print happened, and says what the journal holds -- not an empty line and not an exception.
        $this->assertStringContainsString('the journal as it stands, by word and type:', $said);
        $this->assertStringContainsString('the journal now, by word and type:', $said);
        // `json_encode` escapes the slash, so the expectation is built the same way the line is.
        $this->assertStringContainsString(json_encode('greens/green: 4'), $said);
        $this->assertStringContainsString(json_encode('other/other: 1'), $said);
        // And the whole command is free of the shape that broke it.
        $this->assertSame([], $named, 'a query of this command names a word MySQL reserves');
    }

    /** The one printed line that starts with this text, for a message that says what it read. */
    private function lineOf(string $output, string $needle): ?string
    {
        foreach (explode("\n", $output) as $line) {
            if (str_contains($line, $needle)) {
                return trim($line);
            }
        }

        return null;
    }

    /** @return array<string,int> word => rows */
    private function journalNow(): array
    {
        return DB::table('spray_logs')->selectRaw('zone, COUNT(*) as rows')
            ->groupBy('zone')->orderBy('zone')->pluck('rows', 'zone')->all();
    }

    /** @return array<int,?string> id => type */
    private function typesNow(): array
    {
        return DB::table('spray_logs')->orderBy('id')->pluck('zone_type', 'id')->all();
    }

    private function saying(string $command): string
    {
        Artisan::call($command);

        return Artisan::output();
    }

    /**
     * The shape of the stand, measured 02.10.2026: four entries carrying `greens` and one carrying
     * `other`, the only non-`greens` entry there is.
     *
     * @return array<string,int> the id of the `other` row, by name
     */
    private function fiveEntriesLikeTheStand(Site $site): array
    {
        $ids = [];
        foreach (['greens', 'greens', 'greens', 'greens', 'other'] as $i => $word) {
            $ids[] = DB::table('spray_logs')->insertGetId([
                'account_id' => $site->account_id,
                'site_id' => $site->id,
                'user_id' => $site->created_by_user_id,
                'event_date' => '2026-0'.($i + 1).'-16',
                'zone' => $word,
                'product_name' => 'Primo Maxx',
                'product_type' => 'pgr',
                'active_ingredient' => '',
                'operator' => '',
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        return ['other' => end($ids)];
    }

    private function postSpray(User $user, Site $site, array $zones)
    {
        return $this->actingAs($user)->withSession(['_token' => 't'])->postJson('/api/spray-log', [
            '_token' => 't',
            'site_id' => $site->id,
            'application_date' => '2026-08-25',
            'product_name' => 'Primo Maxx',
            'product_category' => 'pgr',
            // The fields the client always sends; the controller reads them unguarded, which is its own
            // business and not this stage's.
            'active_ingredient' => 'trinexapac-ethyl',
            'rate' => 0.4,
            'rate_unit' => 'L/ha',
            'target' => 'growth',
            'notes' => null,
            'zones' => $zones,
        ]);
    }

    private function aSite(): array
    {
        $user = User::factory()->create();
        $account = Account::query()->firstOrCreate(
            ['owner_user_id' => $user->id],
            ['display_name' => $user->name, 'created_by_user_id' => $user->id, 'modified_by_user_id' => $user->id]
        );
        $site = Site::query()->create([
            'account_id' => $account->id,
            'name' => 'GH-806 journal',
            'slug' => 'gh806-'.bin2hex(random_bytes(4)),
            'site_type' => 'golf',
            'created_by_user_id' => $user->id,
            'modified_by_user_id' => $user->id,
        ]);
        $site->users()->attach($user->id, ['role' => 'manager']);

        return [$user->fresh(), $site];
    }
}
