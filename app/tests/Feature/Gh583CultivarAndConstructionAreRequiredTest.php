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
 * HOW IT BITES: accept `generic` again and the refusal case goes red; drop
 * `required` from the form, or offer "Generic / Unknown" again, and the form
 * case does; make `clear` refuse a cultivar and the case above it does.
 */
class Gh583CultivarAndConstructionAreRequiredTest extends TestCase
{
    use RefreshDatabase;

    public function test_clear_still_empties_a_cultivar_and_that_is_on_purpose(): void
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
        ], 'location' => ['lat' => -43.5, 'lon' => 172.5]]);

        $this->actingAs($user)
            ->patchJson("/api/sites/{$site->id}/config/gaip", ['clear' => ['turf.variety']])
            ->assertOk();

        $this->assertArrayNotHasKey('variety', $this->config($site)['turf']);
        // and the three the owner DID make unclearable are untouched by this
        $this->assertSame('perennialRyegrass', $this->config($site)['turf']['species']);
    }

    public function test_generic_is_refused_as_a_cultivar(): void
    {
        // Wherever it arrives from. It is the absence of a choice, and the
        // whole point of the decision is that it stops being storable.
        [$user, $site] = $this->siteWithConfig(['turf' => [
            'species' => 'perennialRyegrass', 'methodology' => 'mlsn', 'turfType' => 'sports',
            'variety' => 'Barenbrug Bar Extreme',
        ], 'location' => ['lat' => -43.5, 'lon' => 172.5]]);

        $response = $this->actingAs($user)
            ->patchJson("/api/sites/{$site->id}/config/gaip", [
                'patch' => ['turf' => ['variety' => 'generic']],
            ])
            ->assertStatus(422);

        $this->assertStringContainsString('absence of a choice', $response->json('message'));
        $this->assertSame(['turf.variety'], $response->json('invalid_keys'));
        $this->assertSame('Barenbrug Bar Extreme', $this->config($site)['turf']['variety']);
    }

    public function test_the_refusal_is_about_the_value_and_not_the_word(): void
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

    public function test_the_wizard_no_longer_writes_a_cultivar_it_did_not_ask_for(): void
    {
        // A guard on the tree: the wizard wrote `variety: 'generic'` on every
        // site it created. The server refuses that value now, so a wizard still
        // sending it would fail to create a site at all — this catches the
        // reintroduction at the source rather than at the door.
        $wizard = file_get_contents(base_path('../assets/onboarding-wizard.js'));
        $at = strpos($wizard, 'var gaipCfg = {');
        $this->assertNotFalse($at);
        $block = substr($wizard, $at, 900);

        $this->assertStringContainsString("species:     self.d.species", $block);
        $this->assertStringNotContainsString("variety:     'generic'", $block);
    }

    public function test_the_settings_form_asks_for_all_three(): void
    {
        $settings = file_get_contents(base_path('resources/views/settings.blade.php'));

        foreach (['stg-turf-species', 'stg-turf-variety', 'stg-turf-construction'] as $id) {
            $at = strpos($settings, 'id="'.$id.'"');
            $this->assertNotFalse($at, $id.' is gone from the form');
            $this->assertStringContainsString('required', substr($settings, $at, 120), $id.' is not required');
        }

        // and the stand-in is not offered as an option any more
        $at = strpos($settings, 'id="stg-turf-variety"');
        $this->assertStringNotContainsString('value="generic"', substr($settings, $at, 400));
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
