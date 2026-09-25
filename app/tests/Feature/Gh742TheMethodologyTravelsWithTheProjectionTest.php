<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Site;
use App\Models\SiteConfig;
use App\Models\User;
use App\Support\AnalysisResults;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * GH-742 (queue item 3ad) — THE SITE'S METHODOLOGY REACHES THE PANEL'S PROJECTION FROM ITS ONE OWNER.
 *
 * The panel names the soil part of the analysis `MLSN` for every site, because the word comes from
 * `STEP_NAMES['mlsn']` — keyed on the name of the STEP, not on what the site is set to. The owner's
 * decision, in her words: "we must print the methodology that is in our settings and that the
 * calculation ran under". Measured on the stand before any change: eight of the thirteen configured
 * sites are set to something else — four `slan`, four `ammonium_acetate` — so eight sites are being
 * told about a methodology that is not theirs.
 *
 * WHAT THIS ASSERTS is the journey of the KEY, and only that. It comes from
 * `config.turf.methodology` and from nowhere else: not from the coordinates, not from a sample's
 * stamp, not from a field on a page. That is the project's settled rule and this case pins it rather
 * than re-deriving it.
 *
 * WHAT IT DOES NOT ASSERT, and the boundary is deliberate: turning the key into the word a person
 * reads. Three places already spell those words out and a fourth copy is what this project keeps
 * removing, so where that vocabulary is owned is an open question for the analyst. Until it is
 * answered the panel's word is unchanged — which means this delivery moves nothing a person sees,
 * and that is said here so the case is not read as the repair.
 *
 * AND AN ABSENT METHODOLOGY IS AN OUTCOME: a site that has not finished its wizard has none, it
 * travels as `null`, and nothing is put in its place. Measured beside it: the place that prints the
 * word drops an empty one without dropping the sentence (`AnalysisNotice`, `! empty($w['module'])`),
 * so the reader still learns that the soil part was not computed.
 */
class Gh742TheMethodologyTravelsWithTheProjectionTest extends TestCase
{
    use RefreshDatabase;

    public function test_the_methodology_the_settings_hold_reaches_the_projection(): void
    {
        [$user, $site] = $this->siteWith('slan');

        $projection = AnalysisResults::forSites([$site->id])[$site->id];
        fwrite(STDOUT, PHP_EOL.'[gh742] projection for a `slan` site: key present: '
            .json_encode(is_array($projection) && array_key_exists('methodology', $projection))
            .' | value: '.json_encode(is_array($projection) ? $projection['methodology'] : null).PHP_EOL);

        $this->assertIsArray($projection, 'no projection at all — every claim below would be vacuous');
        $this->assertSame('slan', $projection['methodology']);
    }

    public function test_each_of_the_three_arrives_as_itself_and_none_is_normalised_to_mlsn(): void
    {
        // One case per value rather than one loop over a list written here: the defect being removed
        // is exactly that every site was told `mlsn`, so a single assertion on one value could pass
        // while another was still being flattened.
        $seen = [];
        foreach (['mlsn', 'slan', 'ammonium_acetate'] as $value) {
            [, $site] = $this->siteWith($value);
            $seen[$value] = AnalysisResults::forSites([$site->id])[$site->id]['methodology'] ?? null;
        }
        fwrite(STDOUT, '[gh742] what arrives for each setting: '.json_encode($seen).PHP_EOL);

        $this->assertSame(['mlsn' => 'mlsn', 'slan' => 'slan', 'ammonium_acetate' => 'ammonium_acetate'], $seen);
    }

    public function test_a_site_that_has_not_finished_the_wizard_carries_null_and_nothing_is_substituted(): void
    {
        [, $site] = $this->siteWith(null);

        $projection = AnalysisResults::forSites([$site->id])[$site->id];
        // `??` catches a null as well as an absence, so the first version of this line printed
        // "ABSENT KEY" over a key that was present and null -- the very distinction the item turns on.
        fwrite(STDOUT, '[gh742] a site with no methodology: key present: '
            .json_encode(array_key_exists('methodology', $projection))
            .' | value: '.json_encode($projection['methodology']).PHP_EOL);

        $this->assertIsArray($projection);
        $this->assertArrayHasKey('methodology', $projection, 'the key must exist, or a reader cannot tell absence from a shape it does not know');
        $this->assertNull($projection['methodology']);
    }

    public function test_it_is_NOT_taken_from_the_samples_stamp(): void
    {
        /**
         * The stamp is written FROM the config and is never read back to interpret anything. A stamp
         * that disagrees with the setting is the stamp falling back to a default, not a second
         * opinion about the site — so a site set to `slan` whose sample is stamped `mlsn` must still
         * project `slan`.
         */
        [, $site] = $this->siteWith('slan');
        // Through the model, so the identifier is whatever the table gives out: the first version
        // handed `samples.id` a UUID and SQLite refused it as a datatype mismatch -- the column is
        // an auto-increment, and the value was mine rather than the schema's.
        \App\Models\Sample::query()->create([
            'account_id' => $site->account_id,
            'site_id' => $site->id,
            'sample_type' => 'soil',
            'client_uid' => 'gh742-stamped',
            'sample_date' => '2026-08-01',
            'methodology_snapshot' => 'mlsn',
            'payload' => ['pH' => 6.1],
            'created_by_user_id' => $site->created_by_user_id,
            'modified_by_user_id' => $site->created_by_user_id,
        ]);

        $projection = AnalysisResults::forSites([$site->id])[$site->id];
        fwrite(STDOUT, '[gh742] site set to slan, sample stamped mlsn -> projection says: '
            .json_encode($projection['methodology'] ?? null).PHP_EOL);
        $this->assertSame('slan', $projection['methodology']);
    }

    public function test_the_soil_step_is_named_by_the_methodology_on_BOTH_readers_of_the_step_names(): void
    {
        /**
         * The reviewer's condition for this item, and it is the reason this case exists rather than a
         * pair of narrower ones: the word for a step is read in TWO places — the `module` of a
         * section and the list of what was not computed — and a repair proved on one says nothing
         * about the other. Both go through one function now, so they cannot drift.
         */
        /**
         * The second reader is reached only through the sentence a PARTIAL run prints, so the
         * projection has to be the shape a partial run leaves. Measured while writing this: with a
         * bare projection the panel answers "no analysis has been run", which exercises neither
         * reader — the case was proving nothing about the one it names.
         */
        $projection = ['computed' => [], 'methodology' => 'slan',
            'metrics' => ['growthPotential' => 61],
            'analyzedAt' => '2026-09-25T00:00:00Z',
            'numbersFrom' => 'partial',
            'lastRun' => ['outcome' => 'partial', 'at' => '2026-09-25T00:00:00Z',
                'skipped' => [['step' => 'mlsn', 'reason' => 'no-soil-sample']]],
            'numbersRun' => ['outcome' => 'partial',
                'skipped' => [['step' => 'mlsn', 'reason' => 'no-soil-sample']]]];

        $section = \App\Support\AnalysisNotice::section('soilNutrition', $projection);
        $panel = \App\Support\AnalysisNotice::panel($projection, 'UTC');
        fwrite(STDOUT, PHP_EOL.'[gh742] reader 1, the section module: '.json_encode($section['module'] ?? null).PHP_EOL
            .'[gh742] reader 2, what the panel lists: '.json_encode($panel['text'] ?? $panel).PHP_EOL);

        $this->assertIsArray($section, 'no section at all — the claim below would be vacuous');
        $this->assertSame('SLAN', $section['module']);
        // The second reader, by the word it produced rather than by its own name.
        $this->assertStringContainsString('SLAN', json_encode($panel));
        $this->assertStringNotContainsString('MLSN', json_encode($panel));
    }

    public function test_a_site_with_no_methodology_is_told_a_neutral_word_and_never_a_methodology(): void
    {
        /**
         * THE REVIEWER'S RETURN, and what it turned over in this file. This case asserted `MLSN` as
         * correct: the step's own word happens to BE the name of a methodology, so a site that has
         * no methodology was told one, and the rule is that nothing is ever filled with `mlsn`. The
         * word now names the part of the analysis without naming a methodology, and the absence
         * stays an absence - the projection's `methodology` is still null, asserted above.
         */
        $projection = ['computed' => [], 'methodology' => null,
            'numbersRun' => ['skipped' => [['step' => 'mlsn', 'reason' => 'no-soil-sample']]]];

        $section = \App\Support\AnalysisNotice::section('soilNutrition', $projection);
        fwrite(STDOUT, '[gh742] with no methodology, the section module: '
            .json_encode($section['module'] ?? null).PHP_EOL);

        $this->assertSame('soil nutrition', $section['module']);
        // THE PROPERTY, which survives the owner's answer: whatever the word becomes, it is not the
        // name or the key of any methodology the list declares.
        $this->assertNamesNoMethodology((string) $section['module'], 'the section of a site with no methodology');
        fwrite(STDOUT, '[gh742] words no absence may be told: '
            .json_encode($this->everyDeclaredMethodologyWord()).PHP_EOL);

        // ON BOTH READERS, the reviewer's standing condition for this item: the same word is read
        // by the sentence a partial run prints, and a repair proved on one says nothing of the other.
        $partial = ['computed' => [], 'methodology' => null,
            'metrics' => ['growthPotential' => 61],
            'analyzedAt' => '2026-09-25T00:00:00Z',
            'numbersFrom' => 'partial',
            'lastRun' => ['outcome' => 'partial', 'at' => '2026-09-25T00:00:00Z',
                'skipped' => [['step' => 'mlsn', 'reason' => 'no-soil-sample']]],
            'numbersRun' => ['outcome' => 'partial',
                'skipped' => [['step' => 'mlsn', 'reason' => 'no-soil-sample']]]];
        $panel = \App\Support\AnalysisNotice::panel($partial, 'UTC');
        fwrite(STDOUT, '[gh742] with no methodology, what the panel lists: '
            .json_encode($panel['text'] ?? $panel).PHP_EOL);
        $this->assertStringContainsString('soil nutrition', json_encode($panel));
        // ON THE SECOND READER TOO, as the property rather than as the letter.
        $sentence = (string) ($panel['text'] ?? '');
        $this->assertNotSame('', $sentence, 'no sentence at all — the claim below would be vacuous');
        $this->assertNamesNoMethodology($sentence, 'the sentence a partial run prints');
    }

    public function test_the_neutral_word_comes_from_the_list_and_not_from_the_panel(): void
    {
        /**
         * The fill for the case above: the word is a DRAFT held in the one file the server reads,
         * beside the names it stands in for. Take it out of the list and this is red, rather than
         * the panel quietly falling back to the map's own word - which is the defect returned.
         */
        $inputs = \App\Support\CalculationInputs::all();
        $word = $inputs['inputs']['turf.methodology']['labelWhenUndeclared'] ?? null;
        fwrite(STDOUT, '[gh742] the list holds, for a site no declared methodology names: '
            .json_encode($word).PHP_EOL);

        $this->assertIsString($word);
        $this->assertNotSame('', trim((string) $word));
        $this->assertSame($word, \App\Support\CalculationInputs::methodologySoilStepLabel(null));
        // And the declared keys still answer with themselves.
        $this->assertSame('SLAN', \App\Support\CalculationInputs::methodologySoilStepLabel('slan'));
    }

    public function test_a_key_the_list_does_not_declare_is_not_printed_as_itself(): void
    {
        $projection = ['computed' => [], 'methodology' => 'something_nobody_declared',
            'numbersRun' => ['skipped' => [['step' => 'mlsn', 'reason' => 'no-soil-sample']]]];

        $section = \App\Support\AnalysisNotice::section('soilNutrition', $projection);
        fwrite(STDOUT, '[gh742] an undeclared key: '.json_encode($section['module'] ?? null).PHP_EOL);

        // A word this project has not declared is not a word to show a client, and the identifier
        // must not leak in its place — the rule `Gh646` holds for reasons holds here for names.
        // THE REVIEWER'S RETURN: nor may the name of another methodology stand in for it. An
        // undeclared value is not a choice of `mlsn`, and it is not read as one now.
        $this->assertSame('soil nutrition', $section['module']);
        $this->assertStringNotContainsString('something_nobody_declared', json_encode($section));
        $this->assertNamesNoMethodology((string) $section['module'], 'the section of a site with an undeclared key');
    }

    /**
     * GH-742 (the reviewer's second return) — THE PROPERTY, NOT THE LETTER.
     *
     * Her finding, and it is about what the cases GUARD rather than about the screen: replacing the
     * word for an undeclared methodology with `"SLAN"` reddened two cases, but only because they
     * compare the text with `soil nutrition`. The word is a DRAFT: the owner will answer on it and the
     * letter in these cases will be edited to match — and from that moment `SLAN` or
     * `Ammonium Acetate` standing in for an absence would pass in silence. A guard that stops
     * guarding exactly when we carry out the owner's decision has a shelf life.
     *
     * So the property is asserted beside the letter: the word a site with no declared methodology is
     * told is not the name, nor the key, of ANY methodology the list declares. That survives the
     * owner's answer, because it is read from the list rather than written here.
     *
     * @return array<int,string>
     */
    private function everyDeclaredMethodologyWord(): array
    {
        $values = \App\Support\CalculationInputs::all()['inputs']['turf.methodology']['values'] ?? [];
        $words = [];
        foreach ($values as $key => $entry) {
            $words[] = (string) $key;
            foreach ((array) $entry as $field => $value) {
                if (is_string($value) && trim($value) !== '') {
                    $words[] = $value;
                }
            }
        }

        return array_values(array_unique($words));
    }

    /** The word must not BE any of them, and must not carry one inside it either. */
    private function assertNamesNoMethodology(string $word, string $where): void
    {
        foreach ($this->everyDeclaredMethodologyWord() as $name) {
            $this->assertNotSame(mb_strtolower($name), mb_strtolower($word),
                $where.': the word is the declared methodology "'.$name.'"');
            if (mb_strlen($name) > 3) {
                $this->assertStringNotContainsStringIgnoringCase($name, $word,
                    $where.': the word carries the declared methodology "'.$name.'"');
            }
        }
    }

    /** @return array{0:User,1:Site} */
    private function siteWith(?string $methodology): array
    {
        $user = User::factory()->create(['is_admin' => false]);
        $account = Account::query()->create([
            'owner_user_id' => $user->id, 'display_name' => $user->name,
            'created_by_user_id' => $user->id, 'modified_by_user_id' => $user->id,
        ]);
        $site = Site::query()->create([
            'account_id' => $account->id, 'name' => 'Methodology '.($methodology ?? 'none'),
            'slug' => 'meth-'.uniqid(),
            'site_type' => 'golf', 'timezone' => 'UTC',
            'created_by_user_id' => $user->id, 'modified_by_user_id' => $user->id,
        ]);
        $site->users()->attach($user->id, ['role' => 'manager']);
        /**
         * A row for the projection to be about. Measured while writing this: with no analysis row at
         * all `project()` answers `null`, and that is right — the panel's sentence about an empty
         * section exists only where there is a row to say it of, so there is nothing for a
         * methodology to name. The fixture was what was wrong, not the code.
         */
        \DB::table('analysis_results')->insert([
            'site_id' => $site->id,
            'run_id' => 'gh742-'.uniqid(),
            'outcome' => 'complete',
            'started_at' => now(),
            'completed_at' => now(),
            'inputs' => json_encode([]),
            'metrics' => json_encode([]),
            'computed' => json_encode([]),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        $turf = $methodology === null ? [] : ['methodology' => $methodology];
        SiteConfig::query()->create([
            'site_id' => $site->id, 'namespace' => 'gaip',
            'config' => ['turf' => $turf],
            'created_by_user_id' => $user->id, 'modified_by_user_id' => $user->id,
        ]);

        return [$user->fresh(), $site->fresh()];
    }
}
