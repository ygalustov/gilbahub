<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Site;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * GH-583 (stage 3) — the cultivar and the construction type are answers, or
 * they are absent.
 *
 * Owner's decision, 22.09.2026: "we need the grass and the cultivar to be
 * required fields", "and also… the field type, sand or not sand". The cultivar
 * comes from the site's own profile; `generic` goes.
 *
 * WHAT `generic` WAS. The onboarding wizard wrote it on every site it created,
 * and it reads as a choice. It is the absence of one wearing a value's clothes:
 * every multiplier keyed on cultivar — wear, disease, irrigation, nutrient
 * demand — quietly uses 1.00 for it, so a site with a real cultivar and a site
 * with none produced the same numbers and looked equally settled. Six of the
 * twelve sites on the stand carry it.
 *
 * WHAT IS NOT HERE, and it is deliberate rather than forgotten: neither field is
 * required AT CREATION. The wizard does not collect them, so a server demanding
 * them would stop a site being created at all. The wizard half is not built.
 *
 * AND "REQUIRED" IS NOT "UNCLEARABLE". Both fields were briefly added to the
 * list of things a write may not blank, and `GH439SiteConfigPatchTest` went red
 * on a contract it has always asserted. The owner asked for required fields and
 * not for unclearable ones; the larger reading would settle a question nobody
 * put to her. `clear` keeps its contract, and a case below holds it that way —
 * so reversing this tomorrow is a deliberate act, not a quiet one.
 *
 * ---------------------------------------------------------------------------
 * GH-684 — PART OF THIS IS REVERSED, BY THE OWNER, AND THE CASES STAY.
 *
 * Her decision: the owner reversed it, 24.09.2026 17:32 (GH-684): `generic` comes BACK, and where a site
 * had it and a calculation was built on it, it COUNTS AS FILLED. The one condition she
 * attached is the WIZARD: there they must state WHICH CULTIVAR IT WAS, so the choice is made
 * KNOWINGLY from the list -- or `generic` is left standing. Her words are quoted verbatim in
 * PLAN-remaining-defects-RU.md under GH-684; a code comment carries the decision, not the quote.
 *
 * So `generic` is a CHOICE a person may make, it counts as FILLED, and the
 * server stores it. Two cases below are turned around rather than deleted: a
 * test tied to a meaning must change when the meaning changes, and it must say
 * WHOSE decision changed it — otherwise next month the reversal looks like a
 * guard that rotted. The refusal case becomes an acceptance case; the form case
 * now requires that "Generic / Unknown" IS offered, because a choice that is not
 * in the list cannot be made deliberately.
 *
 * AND THE ABSENCE OF A DEFAULT IS NOW THE SUBJECT OF THE DECISION, not a
 * technical detail. The wizard must not write a cultivar nobody chose: her words
 * are that the person picks a real one OR picks Generic themselves. The case
 * that holds the wizard silent is therefore stronger than when it was written.
 *
 * HOW IT BITES NOW: refuse `generic` again and the acceptance case goes red;
 * take "Generic / Unknown" out of the list and the form case does; let the
 * wizard write a cultivar by default and the wizard case does; make `clear`
 * refuse a cultivar and the case above it does.
 */
class Gh583CultivarAndConstructionAreRequiredTest extends TestCase
{
    use RefreshDatabase;

    /**
     * GH-789 (queue item 7) — TURNED, AND THIS CASE ASKED TO BE.
     *
     * Its own words: "Coordinator's decision of 22.09.2026, PENDING THE OWNER'S CONFIRMATION ... This case
     * is here so that reversing it tomorrow is a deliberate act with a test to change, not a quiet one."
     * The owner confirmed on 29.09.2026: a required field is not saved empty and is marked red. So the
     * larger of the two requirements is hers after all, and `clear` on a required input answers 422 naming
     * the field -- the same answer an empty box on the Turf tab gets, because it is the same rule.
     *
     * `clear` keeps its contract everywhere else, which the second half below measures on a field nothing
     * requires. Without that half this case would read as "clear stopped working".
     */
    public function test_clear_on_a_required_cultivar_is_refused_and_says_which_field(): void
    {
        // "REQUIRED" AND "CANNOT BE EMPTIED" ARE TWO DIFFERENT REQUIREMENTS, and
        // the owner asked for the first. For twenty minutes this route refused
        // `clear` on `turf.variety` because the field had been added to the
        // unclearable list, and `GH439SiteConfigPatchTest` went red on a
        // contract it has always asserted. Reading her instruction as the larger
        // of the two would have settled, on her behalf, a question nobody put to
        // her.
        //
        // Coordinator's decision of 22.09.2026, PENDING THE OWNER'S
        // CONFIRMATION: the requirement lives on the form and on the refusal of
        // `generic`; `clear` keeps its contract. This case is here so that
        // reversing it tomorrow is a deliberate act with a test to change, not a
        // quiet one.
        [$user, $site] = $this->siteWithConfig(['turf' => [
            'species' => 'perennialRyegrass', 'methodology' => 'mlsn', 'turfType' => 'sports',
            'variety' => 'Barenbrug Bar Extreme', 'construction' => 'sand_profile',
            'companionSpecies' => 'Ryegrass',
        ], 'location' => ['lat' => -43.5, 'lon' => 172.5]]);

        $refusal = $this->actingAs($user)
            ->patchJson("/api/sites/{$site->id}/config/gaip", ['clear' => ['turf.variety']])
            ->assertStatus(422);
        fwrite(STDOUT, PHP_EOL.'[gh789] clear on a required cultivar -> '.$refusal->json('message').PHP_EOL);

        $refusal->assertJsonPath('missing', [['input' => 'turf.variety', 'label' => 'the cultivar or variety']]);
        // Nothing was written: the cultivar is still there.
        $this->assertSame('Barenbrug Bar Extreme', $this->config($site)['turf']['variety']);

        // AND THE OTHER DIRECTION: `clear` still empties a field nothing requires, so the refusal above is
        // about the obligation and not about `clear` having stopped working.
        $this->actingAs($user)
            ->patchJson("/api/sites/{$site->id}/config/gaip", ['clear' => ['turf.companionSpecies']])
            ->assertOk();
        $this->assertSame('perennialRyegrass', $this->config($site)['turf']['species']);
    }

    public function test_generic_is_a_choice_and_is_stored(): void
    {
        /**
         * TURNED AROUND BY THE OWNER (GH-684), and kept in place so the reversal is visible.
         * It used to assert a 422 with "absence of a choice". Her decision makes `generic` a
         * choice a person may make deliberately and a value that counts as FILLED, so the
         * server stores it like any other cultivar.
         */
        [$user, $site] = $this->siteWithConfig(['turf' => [
            'species' => 'perennialRyegrass', 'methodology' => 'mlsn', 'turfType' => 'sports',
            'variety' => 'Barenbrug Bar Extreme',
        ], 'location' => ['lat' => -43.5, 'lon' => 172.5]]);

        $this->actingAs($user)
            ->patchJson("/api/sites/{$site->id}/config/gaip", [
                'patch' => ['turf' => ['variety' => 'generic']],
            ])
            ->assertOk();

        $this->assertSame('generic', $this->config($site)['turf']['variety'],
            'the owner decided `generic` is a choice and is stored; refusing it again is a reversal');
    }

    public function test_a_cultivar_whose_name_contains_generic_is_a_real_cultivar(): void
    {
        // A cultivar whose real name contains the letters is not the stand-in.
        [$user, $site] = $this->siteWithConfig(['turf' => [
            'species' => 'perennialRyegrass', 'methodology' => 'mlsn', 'turfType' => 'sports',
        ], 'location' => ['lat' => -43.5, 'lon' => 172.5]]);

        $this->actingAs($user)
            ->patchJson("/api/sites/{$site->id}/config/gaip", [
                'patch' => ['turf' => ['variety' => 'Generic Hybrid 4']],
            ])
            ->assertSuccessful();

        $this->assertSame('Generic Hybrid 4', $this->config($site)['turf']['variety']);
    }

    public function test_a_real_cultivar_still_goes_through(): void
    {
        // The control: this must not become a rule that refuses everything.
        [$user, $site] = $this->siteWithConfig(['turf' => [
            'species' => 'perennialRyegrass', 'methodology' => 'mlsn', 'turfType' => 'sports',
        ], 'location' => ['lat' => -43.5, 'lon' => 172.5]]);

        $this->actingAs($user)
            ->patchJson("/api/sites/{$site->id}/config/gaip", [
                'patch' => ['turf' => ['variety' => 'Colosseum', 'construction' => 'sand_profile']],
            ])
            ->assertSuccessful();

        $config = $this->config($site);
        $this->assertSame('Colosseum', $config['turf']['variety']);
        $this->assertSame('sand_profile', $config['turf']['construction']);
    }

    /**
     * TURNED AROUND, AND BY TWO DECISIONS RATHER THAN ONE. It asserted that the wizard sends NO
     * cultivar: true while the wizard did not ask for one, because a value nobody chose is not an
     * answer. The owner then decided (24.09.2026 17:32) that a person names the cultivar knowingly
     * or chooses Generic themselves, and the wizard was built to ask for both the cultivar and the
     * construction. So the claim becomes its mirror: it sends what it asked for, and only that.
     *
     * The original subject SURVIVES in the second half: `'generic'` must not appear as a literal.
     * What was wrong was never the value, it was writing a value on a person's behalf — and that is
     * the one thing that must not come back.
     */
    public function test_the_wizard_sends_the_cultivar_it_asked_for_and_never_one_it_wrote_itself(): void
    {
        $wizard = file_get_contents(base_path('../assets/onboarding-wizard.js'));
        // THE WINDOW IS THE REQUEST, not a count of characters. A fixed 1600 ended inside the
        // comment explaining the change and stopped short of the lines it was meant to read, which
        // is a window measuring its own prose. It runs from the section to the end of `_save`.
        $at = strpos($wizard, 'var turfSection = {');
        $this->assertNotFalse($at);
        $end = strpos($wizard, '_api: function', $at);
        $this->assertNotFalse($end, '`_save` no longer ends where this window expects');
        $block = substr($wizard, $at, $end - $at);
        // The window holds its subject before anything is said about it.
        $this->assertStringContainsString('methodology: self.d.methodology', $block);
        $this->assertStringContainsString('species:     self.d.species', $block);

        // It sends the two it now asks for, from the draft — the person's answers.
        $this->assertStringContainsString('turfSection.variety = self.d.variety', $block);
        $this->assertStringContainsString('turfSection.construction = self.d.construction', $block);
        // And only when there is one: a field nobody filled is not a change (GH-630's rule, kept).
        $this->assertStringContainsString('if (self.d.variety)', $block);

        // The thing that must never return: a cultivar written by the wizard rather than chosen.
        $this->assertStringNotContainsString("variety:     'generic'", $block);
        $this->assertStringNotContainsString("self.d.variety || 'generic'", $block);
    }

    public function test_the_settings_form_asks_for_all_three(): void
    {
        $settings = file_get_contents(base_path('resources/views/settings.blade.php'));

        /**
         * GH-789 (queue item 7): the OBLIGATION is no longer an attribute in this file, so it is no longer
         * read out of this file.
         *
         * `required` stood on these three on forms that all carry `novalidate` -- a mark and nothing else,
         * and it named the wrong set: the turf type and the methodology were required by the list and
         * unmarked, the golf surface is required of golf alone and no attribute can say that. The mark is
         * drawn from the list now, per site, so what this case asserted is asserted where the answer lives
         * -- `Gh789TheFormAsksByTheListTest` renders the page for each turf type and reads back the marks
         * and the `data-input` bindings.
         *
         * What stays here is what this file can still answer for: the three fields exist, and each one
         * states which input of the list it answers.
         */
        foreach ([
            'stg-turf-species' => 'turf.species',
            'stg-turf-variety' => 'turf.variety',
            'stg-turf-construction' => 'turf.construction',
        ] as $id => $input) {
            $at = strpos($settings, 'id="'.$id.'"');
            $this->assertNotFalse($at, $id.' is gone from the form');
            $this->assertStringContainsString("inputAttr('".$input."')", substr($settings, $at, 140),
                $id.' does not say which input it answers');
        }

        /**
         * WHAT THIS CASE IS AND IS NOT ABOUT, after two turns of it.
         *
         * It asserted that the template offered `value="generic"`, which the owner's reversal seemed
         * to require. That was measured and it was the wrong file: the cultivar options are not in
         * the template at all -- `repopulateVariety()` empties the element and rebuilds it -- so an
         * option written here is replaced before anyone sees it.
         *
         * So this case keeps the claim the template CAN carry: all three fields are there and all
         * three are required. WHAT THE CULTIVAR LIST CONTAINS is asserted where it is decided:
         * `test_settings_has_no_cultivar_list_of_its_own` below for Settings having no rule of its
         * own, and `tests/gh630-…` ("the cultivar list: Generic is offered, and Generic is not the
         * default") for the answer itself, by asking the producer.
         *
         * Not duplicated here on purpose: a claim asserted in two places is a claim that can be
         * half-repaired.
         */
        $this->assertStringContainsString('name="variety"', $settings, 'the cultivar field is gone');
        $this->assertStringContainsString('name="construction"', $settings, 'the construction field is gone');
    }

    /**
     * GH-684 (item 3bk, part 2) — SETTINGS READS THE ONE PRODUCER, AND HAS NO LIST OF ITS OWN.
     *
     * WHAT THE PLAN EXPECTED TO FIND HERE AND WHAT IS ACTUALLY THERE. The plan for this part
     * described the Settings cultivar field as showing "— select —" for the six sites carrying
     * `generic`, as though the value were being hidden by the template's `!== 'generic'` condition.
     * Measured in the code it is the other way round: the field's options are not in the template.
     * `repopulateVariety()` empties the element and rebuilds it, and the saved value was passed in,
     * so those six always showed Generic selected. The real defect was at the other end —
     * `_initVariety` fell back to `'generic'`, so a site with NO cultivar arrived with Generic
     * selected and Save stored a cultivar nobody chose.
     *
     * WHAT IS ASSERTED HERE is only that Settings has stopped deciding this for itself. WHAT THE
     * LIST CONTAINS is asserted where it is decided, by asking the producer and reading its answer:
     * `tests/gh630-…`, "the cultivar list: Generic is offered, and Generic is not the default". That
     * split is deliberate — a source check here was green over dead code once already.
     */
    public function test_settings_has_no_cultivar_list_of_its_own(): void
    {
        $js = file_get_contents(base_path('../assets/settings-init.js'));
        $body = $this->cultivarListProducer();

        // It asks the shared producer...
        $this->assertStringContainsString('window.GAIP_CultivarOptions(species, selectedValue)', $body,
            'Settings builds the cultivar list itself again, so there are two rules to keep in step');
        // ...and keeps none of the decisions it used to make here.
        $this->assertStringNotContainsString("label: 'Generic / Unknown'", $body,
            'the Generic entry is back in this file, which is the duplication this removed');
        $this->assertStringNotContainsString("turf.variety) || 'generic'", $js,
            'the cultivar falls back to `generic` again, so a site with none is shown one');

        // And the producer exists in the shared file the layout loads, or nothing rebuilds the list.
        $shared = file_get_contents(base_path('../assets/dashboard-ui.js'));
        $this->assertStringContainsString('global.GAIP_CultivarOptions = function', $shared);
    }

    /**
     * The body of `repopulateVariety`, BOUNDED BY THE FUNCTION rather than by a count of characters.
     *
     * Twice now a fixed window stopped short of what it was reading because a comment explaining the
     * change grew inside it — a window measuring its own prose. The subject is asserted to be there
     * before anything is concluded from it.
     */
    private function cultivarListProducer(): string
    {
        $js = file_get_contents(base_path('../assets/settings-init.js'));
        $at = strpos($js, 'function repopulateVariety');
        $this->assertNotFalse($at, 'the producer of the cultivar list is gone from settings-init.js');
        $end = strpos($js, "\n    }\n", $at);
        $this->assertNotFalse($end, '`repopulateVariety` no longer ends where this reader expects');

        return substr($js, $at, $end - $at);
    }

    /** @return array{0:User,1:Site} */
    private function siteWithConfig(array $config): array
    {
        $user = User::factory()->create();
        $account = Account::query()->firstOrCreate(
            ['owner_user_id' => $user->id],
            ['display_name' => $user->name, 'created_by_user_id' => $user->id, 'modified_by_user_id' => $user->id]
        );
        $site = Site::query()->create([
            'account_id' => $account->id, 'name' => 'Site', 'slug' => 'site-'.uniqid(),
            'site_type' => 'precinct', 'timezone' => 'UTC',
            'created_by_user_id' => $user->id, 'modified_by_user_id' => $user->id,
        ]);
        $site->users()->attach($user->id, ['role' => 'manager']);
        \App\Support\SiteConfigWriter::mutate($site->id, 'gaip', fn () => $config);

        return [$user, $site];
    }

    private function config(Site $site): array
    {
        return \App\Models\SiteConfig::query()
            ->where('site_id', $site->id)->where('namespace', 'gaip')->firstOrFail()->config;
    }
}
