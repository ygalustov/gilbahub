<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Site;
use App\Models\SiteConfig;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * GH-629 (part A of the analyst's measurement, section 11 of
 * `PLAN-calculation-inputs-RU.md`) — WHAT THE SERVER DOES WITH THE BODY THE
 * ONBOARDING WIZARD SENDS FOR A SITE THAT IS NOT GOLF.
 *
 * THIS IS A MEASUREMENT, NOT A REPAIR. No product code changes with it.
 *
 * The claim was read and not executed: the wizard sends `turf.subCategory: ''`
 * for sports and lawns (measured in part B, `tests/gh629-...test.js`); Laravel's
 * `ConvertEmptyStringsToNull` turns that into `null` before the controller sees
 * it; and `SiteController::rejectInvalidGaipPatch` refuses a null inside a
 * section with 422. If all three hold, no non-golf site created by the wizard
 * can be saved, and the person reads "check your connection" about it.
 *
 * IT GOES THROUGH THE HTTP LAYER ON PURPOSE. Calling the controller directly
 * would skip the middleware that does the conversion, and the measurement would
 * be about something else.
 *
 * THE THREE CASES ARE THE ANALYST'S, IN HER ORDER:
 *   A1  positive control — golf/greens, expected 200. Anything else means the
 *       measurement never reached its subject (rights, route, data), and A2/A3
 *       may not be interpreted at all.
 *   A2  the subject — sports with `subCategory: ''`.
 *   A3  the discriminator — the same body WITHOUT the key, expected 200. It is
 *       what shows that a refusal in A2 is caused by that key and not by
 *       something else in the body.
 */
class Gh629WizardSubCategoryPatchTest extends TestCase
{
    use RefreshDatabase;

    public function test_a1_positive_control_golf_greens_is_accepted(): void
    {
        [$user, $site] = $this->freshSite();

        $response = $this->patchConfig($user, $site, $this->wizardBody('golf', 'greens'));
        $this->report('A1 golf/greens', $response);

        $response->assertOk();
    }

    public function test_a2_the_subject_sports_with_an_empty_sub_category(): void
    {
        [$user, $site] = $this->freshSite();

        $response = $this->patchConfig($user, $site, $this->wizardBody('sports', ''));
        $this->report('A2 sports/empty-string', $response);

        // Stated as the measurement: this is what the server answers today.
        $response->assertStatus(422);
    }

    public function test_a3_the_discriminator_the_same_body_without_the_key(): void
    {
        [$user, $site] = $this->freshSite();

        $body = $this->wizardBody('sports', '');
        unset($body['patch']['turf']['subCategory']);
        $response = $this->patchConfig($user, $site, $body);
        $this->report('A3 sports/no key', $response);

        $response->assertOk();
    }


    public function test_measure_which_empty_fields_of_a_settings_turf_save_are_refused(): void
    {
        // MEASUREMENT (GH-631): the Settings Turf tab sends its whole section
        // as the form shows it, and several of its fields are `<select>`s with
        // an empty option or inputs defaulting to ''. The null rule refuses
        // EVERY null field of a section and names them all, so this prints the
        // list rather than guessing at it.
        [$user, $site] = $this->freshSite();

        $body = ['patch' => ['turf' => [
            'species' => 'Perennial Ryegrass',
            'variety' => '',
            'turfType' => 'sports',
            'subCategory' => '',
            'construction' => '',
            'drainage' => '',
            'hoc' => '',
            'methodology' => 'slan',
            'nProgram' => '',
            'overseedSpecies' => '',
            'coolOverseed' => '',
            'companionSpecies' => '',
        ]]];

        $response = $this->patchConfig($user, $site, $body);
        $this->report('Settings turf save with empty optional fields', $response);

        $response->assertStatus(422);
    }


    public function test_measure_what_clear_does_for_the_same_fields(): void
    {
        // MEASUREMENT (GH-631): the contract's own way of emptying a field. If
        // a form that today cannot save at all is to both save and empty, this
        // is the mechanism it must use — so what it answers for an ordinary
        // field and for an identity field is measured, not assumed.
        [$user, $site] = $this->freshSite();
        SiteConfig::query()->where('site_id', $site->id)->update(['config' => [
            'turf' => ['species' => 'Perennial Ryegrass', 'methodology' => 'slan', 'turfType' => 'sports',
                'subCategory' => 'soccer', 'variety' => 'Colosseum'],
        ]]);

        $ordinary = $this->patchConfig($user, $site, [
            'patch' => ['turf' => ['species' => 'Perennial Ryegrass']],
            'clear' => ['turf.subCategory', 'turf.variety'],
        ]);
        $this->report('clear on two ordinary fields', $ordinary);

        $identity = $this->patchConfig($user, $site, [
            'patch' => ['turf' => ['turfType' => 'sports']],
            'clear' => ['turf.species'],
        ]);
        $this->report('clear on an identity field', $identity);

        $ordinary->assertOk();
    }

    /** The body `_save()` builds, field for field. */
    private function wizardBody(string $turfType, string $subCategory): array
    {
        return [
            'patch' => [
                'location' => ['name' => 'Christchurch', 'lat' => -43.53, 'lon' => 172.62],
                'turf' => [
                    'turfType' => $turfType,
                    'subCategory' => $subCategory,
                    'species' => $turfType === 'golf' ? 'Bentgrass' : 'Perennial Ryegrass',
                    'methodology' => $turfType === 'golf' ? 'mlsn' : 'slan',
                ],
                'wizard' => ['complete' => true, 'completedAt' => '2026-09-24T00:00:00.000Z', 'version' => '1.0'],
            ],
        ];
    }

    /** The status and the body, printed — a verdict without them is not evidence. */
    private function report(string $label, $response): void
    {
        fwrite(STDOUT, PHP_EOL.'[gh629-A] '.$label.' -> HTTP '.$response->getStatusCode()
            .' body: '.$response->getContent().PHP_EOL);
    }

    private function patchConfig(User $user, Site $site, array $body)
    {
        return $this->actingAs($user)
            ->withSession(['_token' => 'test-token'])
            ->patchJson('/api/sites/'.$site->id.'/config/gaip', array_merge(['_token' => 'test-token'], $body));
    }

    private function freshSite(): array
    {
        $user = User::factory()->create();
        $account = Account::query()->firstOrCreate(
            ['owner_user_id' => $user->id],
            [
                'display_name' => $user->name,
                'created_by_user_id' => $user->id,
                'modified_by_user_id' => $user->id,
            ]
        );

        $site = Site::query()->create([
            'account_id' => $account->id,
            'name' => 'Wizard site',
            'slug' => 'wizard-site-'.substr((string) $user->id, -4),
            'site_type' => 'sports',
            'created_by_user_id' => $user->id,
            'modified_by_user_id' => $user->id,
        ]);
        $site->users()->attach($user->id, ['role' => 'manager']);

        SiteConfig::query()->create([
            'site_id' => $site->id,
            'namespace' => 'gaip',
            'config' => [],
            'synced_at' => now(),
        ]);

        return [$user, $site];
    }
}
