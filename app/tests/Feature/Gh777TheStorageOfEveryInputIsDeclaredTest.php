<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Site;
use App\Models\SiteConfig;
use App\Models\User;
use App\Support\AnalysisNotice;
use App\Support\CalculationInputs;
use App\Support\RunStart;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * GH-777 (queue item 4, the analyst's 76.4 B point 4) — WHERE AN INPUT'S VALUE LIVES IS DECLARED, AND
 * EVERY DECLARED STORAGE HAS A READER ON THE SERVER.
 *
 * WHAT WENT WRONG. The server records what a site had when a run started, so that a gap the run names
 * can be told apart into "the client never entered it" and "it was there and did not reach the run".
 * It read the site's CONFIG for every input of the list — and three inputs keep their value elsewhere:
 * `sites.soil_texture_override` is a column of `sites`, and the two `pgr.*` inputs may be entered in
 * the spray log. Measured on the stand before the repair: 5 of 21 sites carry that column, and 2 carry
 * their PGR application only in the log. Every one of them came out "not filled", so the client would
 * have been told to enter a value it had entered. Blame pointed at the client is the worst direction
 * for an error to point.
 *
 * WHY A GUARD AND NOT ONLY THE THREE CASES. The three are in `Gh675…`, and they hold today's inputs.
 * This holds the RULE: an input with no declared storage, or a storage the server cannot read, is red
 * the day it is written rather than a wrong sentence to a client a month later. The universe is the
 * list itself — every input in it, not a set of names copied here.
 */
class Gh777TheStorageOfEveryInputIsDeclaredTest extends TestCase
{
    use RefreshDatabase;

    public function test_every_input_of_the_list_declares_where_its_value_lives(): void
    {
        $census = [];
        $undeclared = [];
        foreach (CalculationInputs::keys() as $key) {
            $stored = CalculationInputs::storedIn($key);
            if ($stored === null) {
                $undeclared[] = $key;

                continue;
            }
            $census[$stored === [] ? '(nothing stores it)' : implode('+', $stored)][] = $key;
        }
        ksort($census);
        fwrite(STDOUT, PHP_EOL.'[gh777] inputs by where their value lives:'.PHP_EOL);
        foreach ($census as $storage => $keys) {
            fwrite(STDOUT, '[gh777]   '.$storage.': '.count($keys).' — '.implode(', ', $keys).PHP_EOL);
        }

        // POSITIVE CONTROL: the list was read at all. An empty universe would make every claim here
        // true about nothing.
        $this->assertGreaterThan(30, count(CalculationInputs::keys()));
        $this->assertSame([], $undeclared, 'these inputs do not say where their value lives');
    }

    public function test_every_storage_the_list_names_has_a_reader_and_every_reader_is_used(): void
    {
        $named = [];
        foreach (CalculationInputs::keys() as $key) {
            /**
             * GH-804 (queue item "Zones", part 1): THE STORAGES OF A SITE'S INPUTS, which is what this
             * server reads. The list gained one input whose scope is a ZONE (`zones.zoneType`, kept in a
             * row of `zones`, one per zone): the run record does not carry it, the setup lock does not
             * ask for it, and no engine reads it — the Zones tab judges it where the zones are in hand.
             * So `zoneRow` is not a storage this server is claiming to read for a run, and asking for a
             * reader of it here would be asking for work nobody wants done.
             */
            if (CalculationInputs::scopeOf($key) !== 'site') {
                continue;
            }
            foreach (CalculationInputs::storedIn($key) ?? [] as $storage) {
                $named[$storage][] = $key;
            }
        }
        $reads = RunStart::STORAGES_IT_READS;
        fwrite(STDOUT, '[gh777] storages the list names: '.implode(', ', array_keys($named))
            .' | storages the server reads: '.implode(', ', $reads).PHP_EOL);

        $withoutAReader = array_values(array_diff(array_keys($named), $reads));
        $this->assertSame([], $withoutAReader, 'the list names a storage the server cannot read');

        // And the other way: a reader nobody uses is a claim about work that is not being done.
        $unused = array_values(array_diff($reads, array_keys($named)));
        $this->assertSame([], $unused, 'the server claims to read a storage no input declares');
    }

    public function test_an_input_nobody_fills_is_an_input_nothing_stores(): void
    {
        // The two facts are different — where a person types it, and where the value lives — and they
        // agree at the edges: an input with nowhere to be typed has nowhere to be found, and one with
        // a place must be stored somewhere. GH-757 settled the five that have neither.
        //
        // BOTH DIRECTIONS ON PURPOSE, and what it will cost is known rather than guessed. Two inputs
        // are waiting on the analyst's answer — `schedule.uniformity` and `schedule.precipRate`, which
        // nobody fills while `irrigation-scheduler.js` reads them at `irrigation.*`. Measured by the
        // reviewer with a mutation of the data: giving those two an empty `filledIn` reddens this case
        // and names both. That is the right day to decide whether the list keeps promising a writer,
        // and a rule that stayed silent then would be worth nothing.
        $disagree = [];
        foreach (CalculationInputs::keys() as $key) {
            $entry = CalculationInputs::entry($key) ?? [];
            $noPlace = ($entry['filledIn'] ?? null) === [];
            $noStorage = (CalculationInputs::storedIn($key) ?? null) === [];
            if ($noPlace !== $noStorage) {
                $disagree[] = $key.': filledIn '.json_encode($entry['filledIn'] ?? null)
                    .', storedIn '.json_encode(CalculationInputs::storedIn($key));
            }
        }
        fwrite(STDOUT, '[gh777] inputs with nowhere to be entered: '
            .implode(', ', array_values(array_filter(CalculationInputs::keys(),
                fn ($k) => (CalculationInputs::storedIn($k) ?? null) === []))).PHP_EOL);

        $this->assertSame([], $disagree);
    }

    /**
     * GH-777 (queue item 4, slice 2) — EVERY NAME THE GRAPH GATES ON IS A NAME THIS LIST KNOWS.
     *
     * Two vocabularies, one declaration: the graph names an input as the run's state holds it, this list
     * is keyed by what a person fills in, and `readAs` is where the second declares the first. The
     * server reads that link now, so this holds the universe rather than the one name that started it:
     * every `requires` and every `uses` of every node resolves to an entry, or the run would report an
     * input the list does not declare — our side, with a re-run offered that cannot help.
     */
    public function test_every_name_the_graph_uses_resolves_to_an_input_of_the_list(): void
    {
        $graph = json_decode(file_get_contents(base_path('../assets/dependency-graph.json')), true);
        $names = [];
        foreach ($graph['nodes'] as $id => $node) {
            foreach (array_merge($node['requires'] ?? [], $node['uses'] ?? []) as $name) {
                $names[$name] = true;
            }
        }
        $names = array_keys($names);
        sort($names);

        $asKeys = [];
        $asAliases = [];
        $unknown = [];
        foreach ($names as $name) {
            $entry = CalculationInputs::inputFor($name);
            if ($entry === null) {
                $unknown[] = $name;
            } elseif ($entry === $name) {
                $asKeys[] = $name;
            } else {
                $asAliases[] = $name.' -> '.$entry;
            }
        }
        fwrite(STDOUT, PHP_EOL.'[gh777] names the graph gates on and reads ('.count($names).'):'.PHP_EOL
            .'[gh777]   keys of the list ('.count($asKeys).'): '.implode(', ', $asKeys).PHP_EOL
            .'[gh777]   declared as a reading of an input ('.count($asAliases).'): '
            .implode(', ', $asAliases).PHP_EOL);

        // POSITIVE CONTROL: the universe is the graph's own, and it is not empty.
        $this->assertGreaterThan(50, count($names));
        $this->assertSame([], $unknown, 'the graph gates on names this list does not declare');

        // The one name a GATE stands on today, named on its own: it is what the walk of slice 2 sends
        // for a site with no water test, and what the server must not call undeclared.
        $this->assertSame('samples.water', CalculationInputs::inputFor('water.ecw'));
    }

    /**
     * GH-777 (queue item 4, slice 2) — AND NO NAME BELONGS TO TWO INPUTS.
     *
     * The translation is only single-valued while that is true. An alias declared twice, or one that is
     * also a key, would make "which input did the run mean" a coin toss, and the cause a client reads
     * follows from the answer.
     */
    public function test_no_state_name_is_declared_by_two_inputs(): void
    {
        $owners = [];
        foreach (CalculationInputs::keys() as $key) {
            foreach ((CalculationInputs::entry($key)['readAs'] ?? []) as $alias) {
                $owners[$alias][] = $key;
            }
        }
        $ambiguous = [];
        foreach ($owners as $alias => $keys) {
            if (count($keys) > 1) {
                $ambiguous[] = $alias.' -> '.implode(' + ', $keys);
            }
            if (CalculationInputs::entry($alias) !== null) {
                $ambiguous[] = $alias.' is a reading of '.implode(' + ', $keys).' and a key of its own';
            }
        }
        fwrite(STDOUT, '[gh777] readings declared across the list: '.count($owners)
            .' | belonging to more than one input: '.json_encode($ambiguous).PHP_EOL);

        $this->assertGreaterThan(50, count($owners));
        $this->assertSame([], $ambiguous);
    }

    /**
     * GH-777 — THE OWNER'S ANSWER ABOUT THESE TWO NUMBERS IS IN THE TREE, NOT ONLY IN A CONVERSATION.
     *
     * Her decision of 29.09.2026: the sprinkler precipitation rate and the irrigation uniformity are NOT
     * asked for, and a person is not told that nothing fills them in. Recorded here because a decision
     * that lives only in a conversation is the form in which eight records were lost on 25.09 — and
     * because `required: null` plus `decision` says "nobody has decided", which stopped being true the
     * moment she answered.
     *
     * The two halves that can be checked are checked: no surface asks for them, and no sentence a
     * client can read mentions them.
     */
    public function test_the_owners_answer_about_the_two_unasked_numbers_is_recorded(): void
    {
        foreach (['schedule.uniformity' => 'uniformity', 'schedule.precipRate' => 'precipRate'] as $key => $field) {
            $entry = CalculationInputs::entry($key);
            fwrite(STDOUT, '[gh777] '.$key.': required='.json_encode($entry['required'])
                .' decided='.json_encode(mb_substr((string) ($entry['decided'] ?? ''), 0, 40)).PHP_EOL);

            $this->assertFalse($entry['required'], $key.' is still an open question');
            $this->assertArrayNotHasKey('decision', $entry, $key.' still carries an unanswered question');
            $this->assertStringContainsString('29.09.2026', (string) ($entry['decided'] ?? ''), $key);
            $this->assertStringContainsStringIgnoringCase('not asked for',
                (string) ($entry['decided'] ?? ''), $key);

            // Nothing asks for it: the wizard's steps do not collect it, and the Settings surfaces do
            // not carry the field. Both measured, not asserted from memory.
            $asked = CalculationInputs::wizardStepsFor('sports')['byStep'];
            $this->assertNotContains($key, $asked === [] ? [] : array_merge(...array_values($asked)), $key);
            foreach (['resources/views/settings.blade.php' => base_path('resources/views/settings.blade.php'),
                'assets/settings-init.js' => base_path('../assets/settings-init.js')] as $label => $file) {
                $this->assertSame(0, substr_count(file_get_contents($file), $field),
                    $key.' now has a field in '.$label.', so the list must say so again');
            }

            // And no sentence a client can read names it: her second half, held where the sentences are.
            foreach (\App\Support\AnalysisNotice::clientTexts()['reasons'] as $code => $text) {
                $this->assertStringNotContainsStringIgnoringCase($field, (string) $text, $code);
            }
        }
    }

    /**
     * GH-777 (the reviewer's return) — AND WHERE INSIDE THE CONFIG, FOR THE INPUTS WHOSE KEY IS NOT THE
     * PATH.
     *
     * `storedIn: config` says the kind of storage; it does not say that the input's own key is the path
     * to walk, and for six inputs it is not. The rule held here is that a declared path is a REAL path
     * and not a restatement of the key: a `storedAs` equal to the key is noise that would make the next
     * reader think the question had been asked.
     */
    public function test_a_declared_config_path_is_a_real_path_and_not_the_key_again(): void
    {
        $paths = [];
        $noise = [];
        foreach (CalculationInputs::keys() as $key) {
            $declared = CalculationInputs::storedAs($key);
            foreach ($declared as $path) {
                $paths[$key][] = $path;
                /**
                 * GH-786 (queue item 3gg) — THE KEY ITSELF IS NOISE ONLY WHEN IT IS THE WHOLE DECLARATION.
                 *
                 * This read `$path === $key`, and it was right for every input here: one path, spelled the
                 * same as the key, says nothing the absent `storedAs` did not already say. `turf.nProgram`
                 * is the first input whose value lives in TWO places — the owner's decision of 30.09.2026
                 * puts the annual nitrogen target in the saved programme first and in Settings second — and
                 * the second of those two IS the key. Dropping it would make the server read only the
                 * programme, so a site whose figure sits only in Settings (2 of the 13 on the stand, and the
                 * only place a person can type it) would be reported to its own owner as not entered: the
                 * exact direction of error this file exists to stop.
                 *
                 * So the rule keeps its subject and narrows to it: a declaration that is nothing but the key
                 * again is still noise.
                 */
                if ((count($declared) === 1 && $path === $key) || trim($path) === '' || ! str_contains($path, '.')) {
                    $noise[] = $key.' -> '.json_encode($path);
                }
            }
        }
        fwrite(STDOUT, '[gh777] inputs written at a path other than their key:'.PHP_EOL);
        foreach ($paths as $key => $where) {
            fwrite(STDOUT, '[gh777]   '.$key.' -> '.implode(', ', $where).PHP_EOL);
        }

        // POSITIVE CONTROL: there ARE such inputs, named rather than counted — a count of six would be
        // satisfied by six others, and these six are the reviewer's own finding.
        //
        // `schedule.uniformity` and `schedule.precipRate` were here too and are not any more: the
        // analyst's answer of 29.09.2026 is that nothing stores them, so they have no storage path to
        // declare, and the path their one reader looks at is declared as `readAs` instead. A path under
        // `storedAs` means "the value sits here"; theirs means "the reader looks here", and the two
        // must not be spelled the same way.
        // GH-786 added `turf.nProgram`, the first input of the list with two storages: the saved nutrition
        // programme's own figure and the Settings field, in the order the one function that answers the
        // question walks them.
        $this->assertSame([
            'turf.rootDepth', 'turf.nProgram', 'schedule.efficiency',
            'turf.cleggHammer', 'turf.ledPPFD', 'turf.ledHours', 'soil.moisture',
        ], array_keys($paths));
        $this->assertSame([
            'nutritionCalendarProgram.meta.annualNBase', 'turf.nProgram',
        ], CalculationInputs::storedAs('turf.nProgram'));
        foreach (['schedule.uniformity', 'schedule.precipRate'] as $noStorage) {
            $this->assertSame([], CalculationInputs::storedIn($noStorage), $noStorage);
            $this->assertSame([], CalculationInputs::storedAs($noStorage), $noStorage);
            $this->assertContains('irrigation.'.explode('.', $noStorage)[1],
                CalculationInputs::entry($noStorage)['readAs'] ?? [],
                $noStorage.' no longer says where its reader looks');
        }
        $this->assertSame([], $noise, 'a declared path is the key again, which answers nothing');
        // Only a `config` input can have one: the other storages are not paths in the config.
        foreach (array_keys($paths) as $key) {
            $this->assertContains('config', CalculationInputs::storedIn($key) ?? [], $key);
        }
    }

    /**
     * GH-777 (the reviewer's return) — THE SIX, MEASURED THROUGH THE RECORDER.
     *
     * The values are put where the Settings forms put them — the irrigation block, the Traffic & Wear
     * form, the LED pair — and the recorder must find every one. Before the repair it found none of
     * them, because it walked the input's key: on the stand that was 3 sites with an irrigation
     * efficiency and 2 with a soil moisture, each told it had entered nothing.
     */
    public function test_the_recorder_finds_a_value_at_the_path_its_writer_uses(): void
    {
        [, $site] = $this->siteWithAValueInEveryStorage([
            'irrigation' => ['efficiency' => 75],
            'traffic' => ['schedule' => [
                'moisture' => 'optimal', 'rootDepth' => 150, 'cleggMean' => 85,
            ]],
            'turf' => ['hoc' => '12', 'led' => ['ppfd' => 200, 'hours' => 14]],
        ]);
        $set = RunStart::observe($site->fresh());

        $six = [];
        foreach (['schedule.efficiency', 'soil.moisture', 'turf.rootDepth', 'turf.cleggHammer',
            'turf.ledPPFD', 'turf.ledHours'] as $key) {
            $six[$key.' at '.implode('|', CalculationInputs::storedAs($key))] = $set['settings'][$key] ?? '(absent)';
        }
        fwrite(STDOUT, '[gh777] the six, as the recorder sees them: '.json_encode($six, JSON_PRETTY_PRINT).PHP_EOL);

        $this->assertSame(array_fill(0, 6, true), array_values($six));
        // and the Clegg input is one input over three keys: one reading entered is the input entered
        [, $onlyTheSoftest] = $this->siteWithAValueInEveryStorage([
            'traffic' => ['schedule' => ['cleggSoft' => 40]],
        ]);
        $this->assertTrue(RunStart::observe($onlyTheSoftest->fresh())['settings']['turf.cleggHammer']);
    }

    public function test_the_recorded_set_answers_for_all_three_storages_and_guesses_at_none(): void
    {
        [$user, $site] = $this->siteWithAValueInEveryStorage();
        $set = RunStart::observe($site->fresh());

        $answers = [
            'config: turf.hoc' => $set['settings']['turf.hoc'] ?? '(absent)',
            'siteColumn: sites.soil_texture_override' => $set['settings']['sites.soil_texture_override'] ?? '(absent)',
            'sprayLog: pgr.applicationDate' => $set['settings']['pgr.applicationDate'] ?? '(absent)',
        ];
        fwrite(STDOUT, '[gh777] one site with a value in each storage: '.json_encode($answers).PHP_EOL);
        $this->assertSame([true, true, true], array_values($answers));

        // Nothing in the set is left as a guess, and every input of the list that is not a sample type
        // has an answer — so a key quietly dropped from the record is red here too.
        $unknown = array_keys(array_filter($set['settings'], fn ($v) => $v === RunStart::UNKNOWN));
        fwrite(STDOUT, '[gh777] inputs the server could not look up: '.json_encode($unknown).PHP_EOL);
        $this->assertSame([], $unknown);

        // GH-804: every input OF A SITE that is not a sample type. An input of a zone is not in this
        // record and the reason is written where the record is built.
        $expected = array_values(array_filter(CalculationInputs::keys(),
            fn ($k) => ! str_starts_with($k, 'samples.') && CalculationInputs::scopeOf($k) === 'site'));
        $this->assertSame($expected, array_keys($set['settings']));
    }

    public function test_the_set_says_which_sample_the_run_was_told_to_use(): void
    {
        // The analyst's promise No 5: the server chooses the sample and names it in the frame's address
        // (GH-724). Without recording it, the set says a sample existed while the run was pointed at
        // another one — the same two-readings class the record exists to close.
        [$user, $site] = $this->siteWithAValueInEveryStorage();
        $this->actingAs($user)->get('/hub?rerun=run-named&site='.$site->id.'&soil=sample_7&tissue=none')->assertOk();

        $set = RunStart::recorded('run-named');
        fwrite(STDOUT, '[gh777] the frame named: '.json_encode($set['named'] ?? null).PHP_EOL);
        $this->assertSame('sample_7', $set['named']['soil']);
        $this->assertSame('none', $set['named']['tissue']);
        $this->assertNull($set['named']['water'], 'a sample the frame did not name is not invented');
    }

    /**
     * GH-777 — A CAUSE WHOSE SENTENCE IS STILL HERS NEVER REACHES THE BROWSER.
     *
     * This is the promise `Gh646…` narrows its universe by, so it is held here rather than assumed
     * there. The opener reads `texts.reasons[code]`; a code arriving with no sentence would make it
     * fall back to its frame around the raw identifier — a technical code on a client's screen through
     * the back door, which is the rule with no edge. The three causes the judge writes about an input
     * are section causes and carry no words yet, so they must be absent from that map altogether.
     */
    public function test_a_cause_still_awaiting_her_words_never_reaches_the_browsers_map(): void
    {
        $table = (new \ReflectionClass(AnalysisNotice::class))->getConstant('REASONS');
        $hers = array_values(array_filter(array_keys($table), fn ($c) => AnalysisNotice::awaitsHerWords($c)));
        $reasons = AnalysisNotice::clientTexts()['reasons'];
        fwrite(STDOUT, '[gh777] causes awaiting her words: '.json_encode($hers)
            .' | of them in the browser\'s map: '
            .json_encode(array_values(array_intersect($hers, array_keys($reasons)))).PHP_EOL);

        // POSITIVE CONTROL: there ARE such causes, and the map is not empty — otherwise both halves of
        // the claim are true about nothing.
        $this->assertNotSame([], $hers);
        $this->assertGreaterThan(15, count($reasons));
        $this->assertSame([], array_values(array_intersect($hers, array_keys($reasons))));
        // and every sentence that does travel is a sentence
        foreach ($reasons as $code => $text) {
            $this->assertIsString($text, $code.' reaches the browser as something other than a sentence');
        }
    }

    /**
     * GH-777 (queue item 4, slice 2) — THE NAME THE PASS REGISTERS UNDER AND THE NAME THE SERVER LOOKS
     * FOR ARE ONE NAME, AND THE GRAPH DECLARES IT.
     *
     * The server worked the name out of the node's id by dropping suffixes until its own vocabulary
     * recognised one. That rule was right for eleven of the twelve nodes of the pass and wrong for one,
     * silently: `disease-forecast` gives `disease`, so the cause of an empty FORECAST was looked for
     * under the disease step while the pass writes it under `forecast`. Measured on the stand: of 94
     * rows, 5 have an empty forecast and in all 5 the disease is empty too — 0 rows where the
     * difference shows, which is why nobody saw it.
     *
     * Now the node declares `module`, the walk registers under it, and this holds the two sides equal
     * for every node of the pass.
     */
    public function test_the_step_the_server_looks_for_is_the_module_the_node_declares(): void
    {
        $graph = json_decode(file_get_contents(base_path('../assets/dependency-graph.json')), true);
        $pairs = [];
        $disagree = [];
        foreach ($graph['nodes'] as $id => $node) {
            $runners = is_array($node['runner'] ?? null) ? $node['runner'] : [$node['runner'] ?? null];
            if (! in_array('orchestrator', $runners, true)) {
                continue;
            }
            $rowKeys = array_values(array_filter($node['outputs'] ?? [],
                fn ($o) => is_string($o) && str_starts_with($o, 'computed.')));
            if ($rowKeys === []) {
                continue;   // no key of the row, so no section asks for its step (the ambient DLI engine)
            }
            $key = explode('.', substr($rowKeys[0], strlen('computed.')))[0];
            $section = AnalysisNotice::section($key, ['computed' => [], 'numbersRun' => [
                'outcome' => 'complete', 'skipped' => [], 'notApplicable' => [], 'notes' => [],
            ]]);
            $pairs[$id] = ['declared' => $node['module'] ?? null, 'server' => $section['step']];
            if (($node['module'] ?? null) !== $section['step']) {
                $disagree[] = $id.': the node says '.json_encode($node['module'] ?? null)
                    .', the server looks for '.json_encode($section['step']);
            }
        }
        fwrite(STDOUT, PHP_EOL.'[gh777] node -> declared module -> the step the server looks for:'.PHP_EOL);
        foreach ($pairs as $id => $p) {
            fwrite(STDOUT, '[gh777]   '.str_pad($id, 26).json_encode($p['declared'])
                .' | '.json_encode($p['server']).PHP_EOL);
        }

        // POSITIVE CONTROL: all twelve nodes of the pass were compared, named rather than counted.
        $this->assertSame([
            'confidence', 'climate-engine', 'soil-temp-physics', 'dew-prediction-engine', 'shade-engine',
            'salinity-penalty-engine', 'stress-aggregator', 'disease-engine', 'wear-recovery-engine',
            'stress-trajectory-engine', 'disease-forecast', 'pre-emergent-engine',
        ], array_keys($pairs));
        $this->assertSame([], $disagree);
        // and the one that used to disagree, named on its own so the repair cannot be undone quietly
        $this->assertSame('forecast', $pairs['disease-forecast']['server']);
    }

    /** @return array{0:User,1:Site} */
    private function siteWithAValueInEveryStorage(array $config = ['turf' => ['hoc' => '12']]): array
    {
        $user = User::factory()->create(['is_admin' => false]);
        $account = Account::query()->create([
            'owner_user_id' => $user->id, 'display_name' => 'A',
            'created_by_user_id' => $user->id, 'modified_by_user_id' => $user->id,
        ]);
        $site = Site::query()->create([
            'account_id' => $account->id, 'name' => 'Site', 'slug' => 'site-'.$user->id,
            'site_type' => 'sports', 'soil_texture_override' => 'sand',
            'created_by_user_id' => $user->id, 'modified_by_user_id' => $user->id,
        ]);
        $site->users()->attach($user->id, ['role' => 'manager']);
        SiteConfig::query()->create([
            'site_id' => $site->id, 'namespace' => 'gaip',
            'config' => $this->configThePageLockAccepts($config),
        ]);
        DB::table('spray_logs')->insert([
            'account_id' => $site->account_id, 'site_id' => $site->id, 'user_id' => $user->id,
            'event_date' => now()->subDays(5)->toDateString(), 'zone' => 'Main',
            'product_name' => 'Primo Maxx', 'product_type' => 'pgr', 'active_ingredient' => 'trinexapac',
            'operator' => 'op', 'created_at' => now(), 'updated_at' => now(),
        ]);

        return [$user->fresh(), $site];
    }
}
