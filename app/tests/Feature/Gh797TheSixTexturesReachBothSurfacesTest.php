<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Site;
use App\Models\SiteConfig;
use App\Models\User;
use App\Support\CalculationInputs;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * GH-797 (queue item 3ashch) — THE SOIL TEXTURES A PERSON IS OFFERED, ON BOTH SURFACES THAT OFFER THEM.
 *
 * WHY TWO AND NOT ONE. The six used to be written out by hand in `settings.blade.php`, and the setup
 * wizard did not ask for the texture at all. Now both ask, and they reach the list by DIFFERENT paths:
 * Settings calls `CalculationInputs::soilTextureChoices()` from its own template, while the wizard is
 * handed them by the server in `DashboardController`'s `$setup` and draws what it was given. A case on
 * one of the two leaves the other free to drift, and two surfaces drifting apart is exactly what
 * `turf.construction` did until GH-769 — the wizard offered eleven and Settings five.
 *
 * WHAT IS ASSERTED, and it is the consequence rather than the device: what a person is OFFERED on each
 * surface. The expectation is the list's own declaration, read here, never a six written out in this
 * file — a six typed here would be the third copy of the thing this item removed.
 *
 * THE HOLE THESE CLOSE, named by the reviewer: nothing stood behind `$setup['soilTextureValues']`. The
 * server produced the key, the wizard read it, and the JavaScript case supplied the key itself — so
 * removing it from the controller left the wizard's field with nothing but "— Select soil texture —"
 * for every new site, and no case anywhere went red.
 */
class Gh797TheSixTexturesReachBothSurfacesTest extends TestCase
{
    use RefreshDatabase;

    /** The declaration, as the list holds it: value => label, in declaration order. */
    private function declared(): array
    {
        $values = CalculationInputs::entry('sites.soil_texture_override')['values'] ?? [];
        $out = [];
        foreach ($values as $id => $v) {
            $out[(string) $id] = is_array($v) ? ($v['label'] ?? $id) : $id;
        }

        return $out;
    }

    public function test_the_wizard_is_handed_every_declared_texture_by_the_server(): void
    {
        [$user] = $this->aCompleteSite();

        $page = $this->actingAs($user)->get('/dashboard');
        $page->assertOk();
        $setup = $this->setupFromThePage($page->getContent());

        $offered = [];
        foreach ($setup['soilTextureValues'] ?? [] as $v) {
            $offered[(string) ($v['id'] ?? '')] = $v['label'] ?? null;
        }

        fwrite(STDOUT, '[gh797] the list declares: '.json_encode($this->declared())
            .PHP_EOL.'[gh797] the server hands the wizard: '.json_encode($offered)
            .PHP_EOL.'[gh797] the keys of `setup` the page carries: '
            .json_encode(array_keys($setup)).PHP_EOL);

        // Every declared texture is offered, under its own declared words, and nothing else is.
        $this->assertSame($this->declared(), $offered);
    }

    public function test_the_settings_form_offers_every_declared_texture_under_its_own_words(): void
    {
        [$user] = $this->aCompleteSite();

        $page = $this->actingAs($user)->get('/settings');
        $page->assertOk();
        $drawn = $this->optionsOfTheTextureField($page->getContent());

        fwrite(STDOUT, '[gh797] the list declares: '.json_encode($this->declared())
            .PHP_EOL.'[gh797] the Settings field draws: '.json_encode($drawn).PHP_EOL);

        // The empty option is the form's own "nothing chosen" and is not a texture, so it is dropped
        // before the comparison -- and asserted separately, because a form with no empty option would
        // mean a person could not see that nothing is chosen.
        $this->assertArrayHasKey('', $drawn);
        $this->assertSame('— select —', $drawn['']);
        unset($drawn['']);
        $this->assertSame($this->declared(), $drawn);
    }

    /**
     * And the two surfaces agree WITH THE LIST, which is not the same as agreeing with each other: each
     * case above compares its own surface with the declaration. This one says so out loud by printing
     * the three sets side by side, so a reader of the output can see which one moved.
     */
    public function test_what_each_surface_offers_is_printed_beside_the_declaration(): void
    {
        [$user] = $this->aCompleteSite();

        $dashboard = $this->actingAs($user)->get('/dashboard');
        $dashboard->assertOk();
        $fromTheServer = array_map(
            fn ($v) => $v['label'] ?? null,
            array_column($this->setupFromThePage($dashboard->getContent())['soilTextureValues'] ?? [], null, 'id')
        );

        $settings = $this->actingAs($user)->get('/settings');
        $settings->assertOk();
        $fromTheForm = $this->optionsOfTheTextureField($settings->getContent());
        unset($fromTheForm['']);

        fwrite(STDOUT, '[gh797] declared : '.json_encode($this->declared())
            .PHP_EOL.'[gh797] wizard   : '.json_encode($fromTheServer)
            .PHP_EOL.'[gh797] settings : '.json_encode($fromTheForm).PHP_EOL);

        $this->assertSame($this->declared(), $fromTheServer);
        $this->assertSame($this->declared(), $fromTheForm);
    }

    // ── reading the surfaces ─────────────────────────────────────────────────────────────────────

    /** The `setup` object the dashboard renders for its own wizard. */
    private function setupFromThePage(string $html): array
    {
        $this->assertMatchesRegularExpression('/setup:\s*\{/', $html,
            'the dashboard does not render a `setup` object at all');
        // The object is rendered by `@json`, so it is one JSON value on one line.
        $matched = preg_match('/setup:\s*(\{.*?\}),\n/s', $html, $m);
        $this->assertSame(1, $matched, 'the `setup` object could not be read off the page');
        $decoded = json_decode($m[1], true);
        $this->assertIsArray($decoded, 'the `setup` object on the page is not JSON');

        return $decoded;
    }

    /** value => label for every option of the Settings soil-texture field, in the order drawn. */
    private function optionsOfTheTextureField(string $html): array
    {
        $matched = preg_match('/<select id="stg-turf-soil-texture".*?<\/select>/s', $html, $block);
        $this->assertSame(1, $matched, 'the Settings form draws no soil-texture field at all');
        preg_match_all('/<option value="([^"]*)"[^>]*>(.*?)<\/option>/s', $block[0], $options,
            PREG_SET_ORDER);
        $this->assertNotEmpty($options, 'the soil-texture field draws no options');

        $out = [];
        foreach ($options as $o) {
            $out[html_entity_decode($o[1], ENT_QUOTES | ENT_HTML5, 'UTF-8')]
                = trim(html_entity_decode($o[2], ENT_QUOTES | ENT_HTML5, 'UTF-8'));
        }

        return $out;
    }

    /** @return array{0:User,1:Site} a site the page lock lets through, so the pages are drawn at all. */
    private function aCompleteSite(): array
    {
        $user = User::factory()->create();
        $account = Account::query()->firstOrCreate(
            ['owner_user_id' => $user->id],
            ['display_name' => $user->name, 'created_by_user_id' => $user->id, 'modified_by_user_id' => $user->id]
        );
        $site = Site::query()->create($this->columnsThePageLockAccepts() + [
            'account_id' => $account->id,
            'name' => 'GH-797 surfaces',
            'slug' => 'gh797-surfaces-'.bin2hex(random_bytes(4)),
            'site_type' => 'sports',
            'timezone' => 'UTC',
            'latitude' => -35.28,
            'longitude' => 149.13,
            'created_by_user_id' => $user->id,
            'modified_by_user_id' => $user->id,
        ]);
        $site->users()->attach($user->id, ['role' => 'manager']);
        SiteConfig::query()->create([
            'site_id' => $site->id, 'namespace' => 'gaip', 'synced_at' => now(),
            'config' => $this->configThePageLockAccepts(),
        ]);
        $user->forceFill(['last_active_site_id' => $site->id])->save();

        return [$user->fresh(), $site];
    }
}
