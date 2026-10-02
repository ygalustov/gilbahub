<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Sample;
use App\Models\Site;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * GH-799 (queue item "Zones", stage C0) — THE TRANSFER, ON A FIXTURE SHAPED LIKE THE STAND.
 *
 * The two cases the plan asks for, and a third that holds the dictionary to one file:
 *   1. zones = |the site's list ∪ the labels of its soil and tissue samples|, per site, without case;
 *   2. no soil or tissue sample is left unlinked, and every transferred zone's type is empty;
 *   3. every key written into `zones.zone_type` is one the file declares, and the file has one reader
 *      (`Gh799TheZoneTypesHaveOneFileTest`). There is no second column to hold a key: the water-source
 *      one this stage first added is gone with the owner's decision of 01.10.2026.
 *
 * WHY A FIXTURE AND NOT THE STAND. The owner's decision of 01.10.2026 is that WE may run the
 * migration, and the coordinator's condition is that it runs in her window with the numbers printed
 * before and after. So these cases build their own site and their own samples -- with the shapes the
 * stand actually holds, including the awkward ones: a name that appears in both sources in different
 * case, a name only a sample carries, a zone in the list that no sample belongs to, and three water
 * samples, which are not zones.
 *
 * WATER KEEPS ONLY ITS NAME -- the owner's decision of 01.10.2026, after she was shown all three
 * readers of `payload._zone`. So nothing of a water sample is moved anywhere, and the cases say so by
 * asserting that its `_zone` is still exactly what it was.
 *
 * WHAT THESE CASES DO NOT DO: they say nothing about what the stand will print. The command prints its
 * own numbers there, before applying, which is the whole reason it is a command.
 */
class Gh799TheZonesATheSiteAlreadyHasTest extends TestCase
{
    use RefreshDatabase;

    public function test_a_zone_is_made_for_every_distinct_name_the_site_already_has(): void
    {
        [$user, $site] = $this->aSiteWithZones();

        $this->artisan('zones:transfer', ['--apply' => true])->assertExitCode(0);

        $names = DB::table('zones')->where('site_id', $site->id)->orderBy('name')->pluck('name')->all();
        fwrite(STDOUT, '[gh799] the list the site carries: '
            .json_encode($site->fresh()->attributes_json['zones'] ?? [])
            .PHP_EOL.'[gh799] the labels its soil and tissue samples carry: '
            .json_encode($this->labelsOfItsSamples($site))
            .PHP_EOL.'[gh799] the zones the transfer made: '.json_encode($names).PHP_EOL);

        /**
         * The union, without case, and nothing else: `Green 1` is in both sources (the list's spelling
         * wins), `GREEN 2` is the list's and `green 2` a sample's -- one zone; `Putter Green` is only a
         * sample's; `Rye Nursery` is only the list's and has no sample at all. The water sample's own
         * name (`Bore 1`) is NOT a zone.
         */
        $this->assertSame(['GREEN 2', 'Green 1', 'Putter Green', 'Rye Nursery'], $names);
        $this->assertNotContains('Bore 1', $names);
    }

    public function test_no_soil_or_tissue_sample_is_left_unlinked_and_every_type_is_empty(): void
    {
        [$user, $site] = $this->aSiteWithZones();

        $this->artisan('zones:transfer', ['--apply' => true])->assertExitCode(0);

        $rows = DB::table('samples')
            ->where('site_id', $site->id)
            ->orderBy('id')
            ->get(['id', 'sample_type', 'zone_id', 'payload']);

        $report = $rows->map(fn ($r) => [
            'type' => $r->sample_type,
            'label' => (json_decode($r->payload, true)['_label'] ?? null),
            'zone' => $r->zone_id === null ? null : DB::table('zones')->where('id', $r->zone_id)->value('name'),
            'itsOwnZoneWord' => (json_decode($r->payload, true)['_zone'] ?? null),
        ])->all();
        $types = DB::table('zones')->where('site_id', $site->id)->pluck('zone_type')->all();

        fwrite(STDOUT, '[gh799] what each sample came to: '.json_encode($report)
            .PHP_EOL.'[gh799] the types of the zones made: '.json_encode($types).PHP_EOL);

        // Not one soil or tissue sample is left without a zone.
        $unlinked = $rows->filter(fn ($r) => in_array($r->sample_type, ['soil', 'tissue'], true) && $r->zone_id === null);
        $this->assertSame(0, $unlinked->count(), 'a soil or tissue sample was left without a zone');

        // Every type is empty -- the owner's decision, and the thing a guess would have filled in.
        $this->assertSame([null, null, null, null], $types);

        // A water sample is not a zone: it has none.
        $water = $rows->filter(fn ($r) => $r->sample_type === 'water')->values();
        $this->assertSame([null, null, null], $water->pluck('zone_id')->all());
    }

    /**
     * GH-799 (the reviewer's return, point 1) — THE WHOLE WATER ROW, BEFORE AND AFTER.
     *
     * The case this replaces said "nothing of it is moved" and checked two fields — the zone and the
     * `_zone` word. His mutation wrote a THIRD field of the water row (`notes`) and the set stayed
     * green: the claim was wider than the check, which is the shape we have been removing all day. And
     * the claim is not only ours: the command prints "nothing of them is moved" to the person running
     * it.
     *
     * So the row is compared whole — every column, as the database holds it. `updated_at` is in that
     * comparison on purpose: a write to any field of the row moves it, so a repair that touched a
     * water sample without meaning to is red here even if it wrote something harmless.
     */
    public function test_a_water_sample_comes_out_of_the_run_byte_for_byte_as_it_went_in(): void
    {
        [$user, $site] = $this->aSiteWithZones();

        $waterRows = fn () => DB::table('samples')
            ->where('site_id', $site->id)->where('sample_type', 'water')
            ->orderBy('id')->get()->map(fn ($r) => (array) $r)->all();

        $before = $waterRows();
        $this->artisan('zones:transfer', ['--apply' => true])->assertExitCode(0);
        $after = $waterRows();

        fwrite(STDOUT, '[gh799] the water rows before the run: '.json_encode($before)
            .PHP_EOL.'[gh799] and after it: '.json_encode($after).PHP_EOL);

        /**
         * The universe is real: without this, "the rows are unchanged" is satisfied by having none. The
         * LIST and not its length — which water samples were there, by the names the fixture gave them
         * — because a count of three would also be satisfied by three of something else.
         */
        $this->assertSame(['Bore 1', 'Tank', 'Dam'], array_map(
            fn ($row) => json_decode($row['payload'], true)['_label'] ?? null,
            $before
        ));
        // One assertion over the whole row, so a field nobody thought of is covered by it.
        $this->assertSame($before, $after, 'the run touched a water sample');
    }

    /**
     * GH-799 (the reviewer's return, point 2) — THE REPORT IS HELD BY ITS COMPOSITION, not by the
     * presence of lines in it.
     *
     * This was six `expectsOutputToContain`, which asks whether each line is there and says nothing
     * about what else is. His mutation added a seventh line carrying a third number and nothing went
     * red. The report IS the evidence the owner is shown before the transfer runs on the stand — two
     * numbers now, 73 and 59 — so a line that reappeared about a water source would reach her and no
     * case at all.
     *
     * So the whole list of the command's own lines is compared, in order. The table of per-site counts
     * that `$this->table` draws is not part of it: that is a rendering of the same figures, and the
     * lines below are the report.
     */
    public function test_without_apply_the_numbers_are_printed_and_nothing_is_written(): void
    {
        [$user, $site] = $this->aSiteWithZones();

        $code = \Illuminate\Support\Facades\Artisan::call('zones:transfer');
        $printed = \Illuminate\Support\Facades\Artisan::output();
        $lines = array_values(array_filter(
            array_map('trim', explode("\n", $printed)),
            fn ($l) => str_starts_with($l, '[zones:transfer]')
        ));

        fwrite(STDOUT, '[gh799] the report, line by line:'.PHP_EOL
            .implode(PHP_EOL, array_map(fn ($l) => '[gh799]   '.$l, $lines)).PHP_EOL);

        $this->assertSame(0, $code);
        // The composition, in order: these lines and no others. A line about a water source — or any
        // other third number — is red here by being present at all.
        $this->assertSame([
            '[zones:transfer] DRY RUN — nothing was written. Add --apply to write exactly this.',
            '[zones:transfer] zones: 4 on 1 sites, all with an empty type',
            '[zones:transfer] zones to create: 4, already there: 0',
            '[zones:transfer] of those, with at least one sample: 3',
            '[zones:transfer] soil/tissue samples linked to a zone: 4',
            '[zones:transfer] soil/tissue samples NOT linked: 0',
            '[zones:transfer] water samples skipped (they are not zones, and nothing of them is moved): 3',
        ], $lines);

        fwrite(STDOUT, '[gh799] after a dry run: zones '.DB::table('zones')->count()
            .', samples pointing at one '.DB::table('samples')->whereNotNull('zone_id')->count().PHP_EOL);

        $this->assertSame(0, DB::table('zones')->count());
        $this->assertSame(0, DB::table('samples')->whereNotNull('zone_id')->count());
    }

    /**
     * GH-799 (the analyst's condition, and the reviewer's M18) — BOTH RUNS, NOT ONLY THE SECOND.
     *
     * The stand may see this command twice: in the coordinator's window, if the first run meets a
     * permission or breaks off half way. So a repeat has to be safe — and "safe" has to be said as a
     * number, because `nothing changed` and `it never got to the work` look alike otherwise.
     *
     * WHY THE FIRST RUN IS ASSERTED TOO. A command that printed nought and returned before writing
     * anything would satisfy "the repeat made none" perfectly. Nought is only an answer when something
     * came before it, so the case holds the pair: the first made four and said four, the second made
     * none and said none, and the rows are the same rows.
     */
    public function test_run_it_twice__the_first_makes_them_and_says_so_the_second_makes_none_and_says_so(): void
    {
        [$user, $site] = $this->aSiteWithZones();

        $firstCode = \Illuminate\Support\Facades\Artisan::call('zones:transfer', ['--apply' => true]);
        $firstPrinted = \Illuminate\Support\Facades\Artisan::output();
        $afterTheFirst = [
            'zones' => DB::table('zones')->orderBy('name')->pluck('name')->all(),
            'links' => DB::table('samples')->whereNotNull('zone_id')->orderBy('id')->pluck('zone_id')->all(),
        ];

        $secondCode = \Illuminate\Support\Facades\Artisan::call('zones:transfer', ['--apply' => true]);
        $secondPrinted = \Illuminate\Support\Facades\Artisan::output();
        $afterTheSecond = [
            'zones' => DB::table('zones')->orderBy('name')->pluck('name')->all(),
            'links' => DB::table('samples')->whereNotNull('zone_id')->orderBy('id')->pluck('zone_id')->all(),
        ];

        $said = fn (string $out) => preg_match('/zones created: (\d+), already there: (\d+)/', $out, $m)
            ? ['created' => (int) $m[1], 'alreadyThere' => (int) $m[2]] : null;

        fwrite(STDOUT, '[gh799] the first run said: '.json_encode($said($firstPrinted))
            .' and the database then held '.count($afterTheFirst['zones']).' zones'
            .PHP_EOL.'[gh799] the second run said: '.json_encode($said($secondPrinted))
            .' and the database then held '.count($afterTheSecond['zones']).' zones'.PHP_EOL);

        $this->assertSame(0, $firstCode);
        $this->assertSame(0, $secondCode);
        // The first run made them, and said how many -- without this the nought below means nothing.
        $this->assertSame(['created' => 4, 'alreadyThere' => 0], $said($firstPrinted));
        $this->assertSame(4, count($afterTheFirst['zones']));
        // The second made none, said so, and left the same rows -- not new ones that happen to count
        // the same, which is why the ids of the links are compared and not their number.
        $this->assertSame(['created' => 0, 'alreadyThere' => 4], $said($secondPrinted));
        $this->assertSame($afterTheFirst, $afterTheSecond, 'a second run made a second copy of something');
    }

    /**
     * GH-799 (the reviewer's M19) — A RUN BROKEN OFF HALF WAY IS FINISHED BY THE NEXT ONE.
     *
     * The precondition is the case: the fixture BUILDS the half-finished state — one of the site's
     * zones already made and one of its samples already pointing at it, the rest not — because a green
     * on a clean database would say that the broken-off run was never reproduced, not that it was
     * handled.
     *
     * What the repeat must do: make only what is missing, say how many that was, leave the row that
     * was already there alone (same id), and finish the links.
     */
    public function test_a_run_broken_off_half_way_is_finished_by_the_next_one(): void
    {
        [$user, $site] = $this->aSiteWithZones();

        // Half of the work, as a broken-off run would have left it: one zone of the four, and one of
        // the four soil/tissue samples pointing at it.
        $zoneId = (string) \Illuminate\Support\Str::uuid();
        DB::table('zones')->insert([
            'id' => $zoneId, 'site_id' => $site->id, 'name' => 'Green 1', 'zone_type' => null,
            'created_at' => now(), 'updated_at' => now(),
        ]);
        $oneSample = DB::table('samples')->where('site_id', $site->id)
            ->where('sample_type', 'soil')->orderBy('id')->first();
        DB::table('samples')->where('id', $oneSample->id)->update(['zone_id' => $zoneId]);

        $halfWay = [
            'zones' => DB::table('zones')->where('site_id', $site->id)->count(),
            'links' => DB::table('samples')->where('site_id', $site->id)->whereNotNull('zone_id')->count(),
        ];

        $code = \Illuminate\Support\Facades\Artisan::call('zones:transfer', ['--apply' => true]);
        $printed = \Illuminate\Support\Facades\Artisan::output();
        preg_match('/zones created: (\d+), already there: (\d+)/', $printed, $m);

        $after = [
            'zones' => DB::table('zones')->where('site_id', $site->id)->count(),
            'links' => DB::table('samples')->where('site_id', $site->id)
                ->whereIn('sample_type', ['soil', 'tissue'])->whereNotNull('zone_id')->count(),
        ];
        $theOldRowSurvived = DB::table('zones')->where('id', $zoneId)->exists();
        $greensNamed = DB::table('zones')->where('site_id', $site->id)->where('name', 'Green 1')->count();

        fwrite(STDOUT, '[gh799] half way: '.json_encode($halfWay)
            .PHP_EOL.'[gh799] the finishing run said: created '.($m[1] ?? 'nothing')
            .', already there '.($m[2] ?? 'nothing')
            .PHP_EOL.'[gh799] after it: '.json_encode($after)
            .', the half-way row still there: '.json_encode($theOldRowSurvived)
            .', rows named `Green 1`: '.$greensNamed.PHP_EOL);

        $this->assertSame(0, $code);
        // The precondition is real: the state before the run was genuinely half done.
        $this->assertSame(['zones' => 1, 'links' => 1], $halfWay);
        // It made the three that were missing and said so, and counted the one that was there.
        $this->assertSame(['3', '1'], [$m[1] ?? null, $m[2] ?? null]);
        // It finished: four zones, four links, and no second `Green 1`.
        $this->assertSame(['zones' => 4, 'links' => 4], $after);
        $this->assertTrue($theOldRowSurvived, 'the row the broken-off run had made was replaced');
        $this->assertSame(1, $greensNamed);
    }

    /**
     * GH-799 (the reviewer's condition, declared before the delivery) — THREE QUANTITIES IN ONE CASE,
     * because a case that holds one of them holds half the question.
     *
     * The three, and the three different faults they separate:
     *   - WHAT THE COMMAND PRINTED, parsed out of its own output. A broken printer is caught here and
     *     nowhere else;
     *   - WHAT IS IN THE DATABASE afterwards, counted from the table. A command that prints 4 and
     *     writes 3 passes the first and fails this;
     *   - THE EXPECTATION, computed BEFORE the run and from ANOTHER SOURCE than the command's. If the
     *     expectation were re-derived from `attributes_json` the way the command derives it, a run that
     *     wrote nothing would still agree with it, and all three numbers would agree about nothing.
     *
     * The independent source is this case's own declaration of its fixture: the names it put in the
     * list and the labels it put on the samples, written out here as data, with the union taken by two
     * lines that do not touch the database at all.
     */
    public function test_what_it_printed_what_is_in_the_database_and_what_was_expected_beforehand(): void
    {
        // (1) THE EXPECTATION, from the case's own fixture declaration, before anything runs.
        $theListTheFixturePuts = ['Green 1', 'GREEN 2', 'Rye Nursery'];
        $theLabelsTheFixturePuts = ['Green 1', 'green 2', 'Putter Green', 'Green 1'];
        $union = [];
        foreach (array_merge($theListTheFixturePuts, $theLabelsTheFixturePuts) as $name) {
            $union[mb_strtolower(trim($name))] = true;
        }
        $expectedZones = count($union);
        $expectedLinks = count($theLabelsTheFixturePuts);   // every label of the fixture is in the union

        [$user, $site] = $this->aSiteWithZones();

        // (2) WHAT IT PRINTED — read out of the command's own output, not out of its return value.
        // `Artisan::call` rather than the test helper, because the helper's pending command asserts
        // against expectations and keeps no transcript; this case needs the transcript itself.
        $code = \Illuminate\Support\Facades\Artisan::call('zones:transfer', ['--apply' => true]);
        $this->assertSame(0, $code);
        $printed = \Illuminate\Support\Facades\Artisan::output();
        preg_match('/zones: (\d+) on (\d+) sites/', $printed, $z);
        preg_match('/soil\/tissue samples linked to a zone: (\d+)/', $printed, $l);
        preg_match('/soil\/tissue samples NOT linked: (\d+)/', $printed, $u);
        $saidZones = isset($z[1]) ? (int) $z[1] : null;
        $saidLinked = isset($l[1]) ? (int) $l[1] : null;
        $saidUnlinked = isset($u[1]) ? (int) $u[1] : null;

        // (3) WHAT IS IN THE DATABASE — counted, after the run.
        $inTheDatabase = DB::table('zones')->where('site_id', $site->id)->count();
        $linkedInTheDatabase = DB::table('samples')->where('site_id', $site->id)
            ->whereIn('sample_type', ['soil', 'tissue'])->whereNotNull('zone_id')->count();

        fwrite(STDOUT, '[gh799] expected beforehand, from the fixture: zones '.$expectedZones
            .', links '.$expectedLinks
            .PHP_EOL.'[gh799] the command printed: zones '.json_encode($saidZones)
            .', linked '.json_encode($saidLinked).', not linked '.json_encode($saidUnlinked)
            .PHP_EOL.'[gh799] the database holds: zones '.$inTheDatabase
            .', linked samples '.$linkedInTheDatabase.PHP_EOL);

        // All three at once, so that no two of them can agree while the third disagrees.
        $this->assertSame(
            ['expected' => $expectedZones, 'printed' => $expectedZones, 'inTheDatabase' => $expectedZones],
            ['expected' => $expectedZones, 'printed' => $saidZones, 'inTheDatabase' => $inTheDatabase],
            'the three numbers of zones do not agree'
        );
        $this->assertSame(
            ['expected' => $expectedLinks, 'printed' => $expectedLinks, 'inTheDatabase' => $expectedLinks],
            ['expected' => $expectedLinks, 'printed' => $saidLinked, 'inTheDatabase' => $linkedInTheDatabase],
            'the three numbers of links do not agree'
        );
        // And the one number that must be nought is nought in both places that can say so.
        $this->assertSame(0, $saidUnlinked);
        $this->assertSame(0, DB::table('samples')->where('site_id', $site->id)
            ->whereIn('sample_type', ['soil', 'tissue'])->whereNull('zone_id')->count());
    }

    // ── the fixture ───────────────────────────────────────────────────────────────────────────────

    /**
     * One site, shaped like the stand: a list of zone names, soil and tissue samples whose labels
     * overlap the list in different case, one label only a sample has, one list entry with no sample,
     * and three water samples — one with a declared source, one with none, one with a word that is not
     * a source at all.
     *
     * @return array{0:\App\Models\User,1:Site}
     */
    private function aSiteWithZones(): array
    {
        $user = \App\Models\User::factory()->create();
        $account = Account::query()->firstOrCreate(
            ['owner_user_id' => $user->id],
            ['display_name' => $user->name, 'created_by_user_id' => $user->id, 'modified_by_user_id' => $user->id]
        );
        $site = Site::query()->create([
            'account_id' => $account->id,
            'name' => 'GH-799 zones',
            'slug' => 'gh799-zones-'.bin2hex(random_bytes(4)),
            'site_type' => 'golf',
            'created_by_user_id' => $user->id,
            'modified_by_user_id' => $user->id,
            // The list Settings keeps, as plain strings — the shape every stand site holds.
            'attributes_json' => ['zones' => ['Green 1', 'GREEN 2', 'Rye Nursery']],
        ]);
        $site->users()->attach($user->id, ['role' => 'manager']);

        $sample = function (string $type, array $payload) use ($site, $user) {
            return Sample::query()->create([
                'account_id' => $site->account_id,
                'site_id' => $site->id,
                'sample_type' => $type,
                'lab_name' => 'lab',
                'lab_ref' => '',
                'soil_texture_snapshot' => '',
                'payload' => $payload,
                'created_by_user_id' => $user->id,
                'modified_by_user_id' => $user->id,
            ]);
        };

        // Soil and tissue: the names a zone is made from.
        $sample('soil', ['_label' => 'Green 1', 'K' => 120]);
        $sample('soil', ['_label' => 'green 2', 'K' => 90]);          // the list's `GREEN 2`, other case
        $sample('soil', ['_label' => 'Putter Green', 'K' => 80]);     // only a sample has this one
        $sample('tissue', ['_label' => 'Green 1', 'N' => 3.1]);       // same zone as the first soil

        // Water: not zones. One source the file declares, one empty, one word it does not declare.
        $sample('water', ['_label' => 'Bore 1', '_zone' => 'bore', 'EC' => 0.4]);
        $sample('water', ['_label' => 'Tank', '_zone' => '', 'EC' => 0.3]);
        $sample('water', ['_label' => 'Dam', '_zone' => 'dam', 'EC' => 0.5]);

        return [$user->fresh(), $site->fresh()];
    }

    /** @return array<int,string> */
    private function labelsOfItsSamples(Site $site): array
    {
        return DB::table('samples')->where('site_id', $site->id)
            ->whereIn('sample_type', ['soil', 'tissue'])
            ->get(['payload'])
            ->map(fn ($r) => json_decode($r->payload, true)['_label'] ?? null)
            ->filter()->values()->all();
    }
}
