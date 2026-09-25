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
 * GH-744 — EVERY WORD A SCREEN PRINTS FOR A METHODOLOGY COMES FROM THE INPUTS LIST, AND THE SCREEN
 * DOES NOT CHANGE.
 *
 * Four kinds of text were written out in four places: the name (`MLSN`), the topbar's abbreviation
 * (`AA`), the Settings chooser's full name or lab (`Minimum Levels for Sustainable Nutrition`,
 * `Hill Labs NZ`), and the wizard's explaining sentence. They now live in the `values` of
 * `turf.methodology`, beside the key, and are read by `CalculationInputs`.
 *
 * THE SCREEN IS HELD AGAINST WHAT IT PRINTED BEFORE, written here as it was read off the page — an
 * outside reference, not the list compared with itself. One thing does change, on purpose: a value
 * the list does not know was printed `MLSN` by the topbar's `default`; it is not printed at all now.
 * No site on the stand carries such a value.
 */
class Gh744MethodologyWordsHaveOneOwnerTest extends TestCase
{
    use RefreshDatabase;

    private const SYDNEY = ['lat' => -33.87, 'lon' => 151.21];

    private const CHRISTCHURCH = ['lat' => -43.53, 'lon' => 172.63];

    public function test_the_settings_chooser_prints_what_it_printed(): void
    {
        $html = $this->settingsFor('mlsn', self::SYDNEY);
        $options = $this->chooser($html);
        fwrite(STDOUT, PHP_EOL.'[gh744] chooser, Sydney: '.json_encode($options, JSON_UNESCAPED_UNICODE).PHP_EOL);

        $this->assertSame([
            '— select —',
            'MLSN — Minimum Levels for Sustainable Nutrition',
            'SLAN — Sufficiency Level of Available Nutrients',
            'Ammonium Acetate (Hill Labs NZ)',
        ], $options);
    }

    public function test_a_new_zealand_site_is_offered_one_and_its_conflict_is_named_as_before(): void
    {
        $html = $this->settingsFor('slan', self::CHRISTCHURCH);
        $options = $this->chooser($html);
        preg_match('#Saved as <strong>([^<]*)</strong>.*?computes on\s+(\S+)\s+until#s', $html, $m);
        fwrite(STDOUT, '[gh744] chooser, Christchurch: '.json_encode($options, JSON_UNESCAPED_UNICODE)
            .' | conflict names: '.json_encode(array_slice($m, 1)).PHP_EOL);

        $this->assertSame(['— select —', 'Ammonium Acetate (Hill Labs NZ)'], $options);
        $this->assertSame(['SLAN', 'SLAN'], array_slice($m, 1));
    }

    public function test_the_topbar_pill_prints_what_it_printed_and_nothing_for_an_unknown_value(): void
    {
        $got = [];
        foreach (['mlsn', 'slan', 'ammonium_acetate', 'something_nobody_declared'] as $value) {
            $got[$value] = $this->pill($this->settingsFor($value, self::SYDNEY));
        }
        fwrite(STDOUT, '[gh744] topbar pill: '.json_encode($got).PHP_EOL);

        $this->assertSame([
            'mlsn' => 'MLSN',
            'slan' => 'SLAN',
            'ammonium_acetate' => 'AA',
            'something_nobody_declared' => null,
        ], $got);
    }

    public function test_the_wizard_is_handed_each_methodologys_name_and_sentence_by_the_server(): void
    {
        [$user] = $this->siteWith('mlsn', self::SYDNEY);
        $setup = $this->actingAs($user)->get('/dashboard')->assertOk()->viewData('setup');
        $byId = collect($setup['methodologyValues'] ?? [])->keyBy('id')->all();
        fwrite(STDOUT, '[gh744] wizard setup: '.json_encode($byId, JSON_UNESCAPED_UNICODE).PHP_EOL);

        $this->assertSame([
            'mlsn' => ['id' => 'mlsn', 'label' => 'MLSN', 'description' => 'Threshold-based. Validated for sand-based putting greens.'],
            'slan' => ['id' => 'slan', 'label' => 'SLAN', 'description' => 'Sufficiency ranges. Standard for sports fields, fairways, lawns.'],
            'ammonium_acetate' => ['id' => 'ammonium_acetate', 'label' => 'Ammonium Acetate', 'description' => 'Hill Labs NZ — Olsen P + NH₄OAc extraction.'],
        ], $byId);
    }

    public function test_no_surface_keeps_a_copy_of_the_words(): void
    {
        $copies = [];
        $sources = [
            'resources/views/settings.blade.php' => file_get_contents(base_path('resources/views/settings.blade.php')),
            'resources/views/partials/topbar.blade.php' => file_get_contents(base_path('resources/views/partials/topbar.blade.php')),
            'assets/onboarding-wizard.js' => file_get_contents(base_path('../assets/onboarding-wizard.js')),
        ];
        $words = ['Minimum Levels for Sustainable Nutrition', 'Sufficiency Level of Available Nutrients', 'Hill Labs NZ',
            "'Ammonium Acetate'", "=> 'AA'", "label: 'MLSN'", "label: 'SLAN'", 'Threshold-based.', 'Sufficiency ranges.', 'strtoupper($methConflict)',
            // The reviewer's return: a word made out of the key is a copy too, not only a literal.
            'methodology.toUpperCase('];
        foreach ($sources as $file => $src) {
            $code = preg_replace(['#\{\{--.*?--\}\}#s', '#/\*.*?\*/#s', '#^\s*//.*$#m'], '', $src);
            foreach ($words as $w) {
                if (str_contains($code, $w)) {
                    $copies[] = $file.' | '.$w;
                }
            }
        }
        fwrite(STDOUT, '[gh744] copies left: '.json_encode($copies, JSON_UNESCAPED_UNICODE).PHP_EOL);
        $this->assertSame([], $copies);
        // And the list declares every field for every value, so nothing needs a fallback.
        foreach (CalculationInputs::entry('turf.methodology')['values'] ?? [] as $id => $v) {
            $this->assertNotEmpty($v['label'] ?? null, $id.' label');
            $this->assertNotEmpty($v['short'] ?? null, $id.' short');
            $this->assertNotEmpty($v['description'] ?? null, $id.' description');
            $this->assertTrue(! empty($v['fullName']) || ! empty($v['lab']), $id.' fullName or lab');
        }
    }

    private function settingsFor(string $methodology, array $location): string
    {
        [$user] = $this->siteWith($methodology, $location);

        return $this->actingAs($user)->get('/settings')->assertOk()->getContent();
    }

    /** @return array{0:User,1:Site} */
    private function siteWith(string $methodology, array $location): array
    {
        $user = User::factory()->create();
        $account = Account::query()->create([
            'owner_user_id' => $user->id, 'display_name' => $user->name,
            'created_by_user_id' => $user->id, 'modified_by_user_id' => $user->id,
        ]);
        $site = Site::query()->create([
            'account_id' => $account->id, 'name' => 'Words Site', 'slug' => 'words-site-'.$user->id,
            'site_type' => 'precinct', 'timezone' => 'UTC',
            'created_by_user_id' => $user->id, 'modified_by_user_id' => $user->id,
        ]);
        $site->users()->attach($user->id, ['role' => 'manager']);
        $user->forceFill(['last_active_site_id' => $site->id])->save();
        SiteConfig::query()->create([
            'site_id' => $site->id, 'namespace' => 'gaip', 'synced_at' => now(),
            'config' => ['turf' => ['methodology' => $methodology], 'location' => $location],
        ]);
        $this->giveTheSiteWhatTheLockNeeds($site);

        return [$user, $site];
    }

    /** @return array<int,string> */
    private function chooser(string $html): array
    {
        preg_match('#<select id="stg-turf-methodology"[^>]*>(.*?)</select>#s', $html, $m);
        $this->assertNotEmpty($m, 'the methodology chooser is not on the page');
        preg_match_all('#<option[^>]*>(.*?)</option>#s', $m[1], $o);

        return array_map(fn ($t) => html_entity_decode(trim($t), ENT_QUOTES), $o[1]);
    }

    private function pill(string $html): ?string
    {
        preg_match('#id="db-context-pills">\s*(?:<span class="db-pill">([^<]*)</span>)?\s*<span class="db-pill" id="db-pill-species"#s', $html, $m);
        $this->assertNotEmpty($m, 'the context pills are not on the page');

        return isset($m[1]) && $m[1] !== '' ? trim($m[1]) : null;
    }
}
