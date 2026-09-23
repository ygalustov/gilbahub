<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Site;
use App\Models\User;
use App\Support\AnalysisNotice;
use App\Support\AnalysisResults;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\BuildsAnalysisResults;
use Tests\TestCase;

/**
 * GH-554 (reviewer's required finding on GH-553) — THE SENTENCE ON THE SCREEN,
 * asserted as a sentence.
 *
 * WHAT WAS WRONG. The server collects the keys a body is missing and answers
 * with them; the runner puts them in `detail.keys`; the row carries them. The
 * screen printed "the server refused the result as incomplete (HTTP 422)". The
 * list travelled the whole way and stopped at the last step — and nothing
 * asserted the rendered text for this reason, in either suite, so the gap was
 * invisible to every green run. My own delivery note claimed the screen showed
 * "(missing: …)"; it did not, and that claim was made without rendering it.
 *
 * WHY IT IS NOT COSMETIC, in the reviewer's own terms: a browser still running
 * the bundle from before GH-553 sends a short body, is refused, and reports the
 * refusal WITHOUT the names — so "HTTP 422" for both made the old client and the
 * new one read identically on the screen, which is precisely the pair somebody
 * would be trying to tell apart.
 *
 * WHAT THIS FILE ASSERTS, and it is deliberately the whole string rather than a
 * `stringContains`: the notice is one sentence a person reads, and a test that
 * checks fragments of it can pass while the sentence itself is unreadable.
 */
class Gh554TheReasonNamesTheMissingKeysTest extends TestCase
{
    use RefreshDatabase;
    use BuildsAnalysisResults;

    private const MISSING = ['diseaseRisk', 'topDisease', 'stressIndex'];

    public function test_the_panel_names_the_missing_values_word_for_word(): void
    {
        $projection = [
            'analyzedAt' => '2026-09-20T20:00:00Z',
            'metrics'    => ['growthPotential' => 0.6],
            'computed'   => null,
            'lastRun'    => [
                'runId'    => 'run-x',
                'outcome'  => 'failed',
                'reason'   => 'incomplete-result',
                'detail'   => ['status' => 422, 'keys' => self::MISSING],
                'failedAt' => '2026-09-22T14:08:00Z',
            ],
            'status' => 'failed',
        ];

        $this->assertSame(
            'Showing the analysis from Sep 20 20:00. '
            .'The re-run on Sep 22 14:08 did not complete: the server refused the result as incomplete '
            .'(HTTP 422, missing: diseaseRisk, topDisease, stressIndex). Try Re-run again.',
            AnalysisNotice::panel($projection, 'UTC')['text']
        );
    }

    public function test_a_refusal_with_no_list_reads_differently_from_one_with_a_list(): void
    {
        // The two states a person would be trying to tell apart. Asserted as a
        // pair, because "they differ" is the property, not either string alone.
        $withList = $this->panelFor(['status' => 422, 'keys' => self::MISSING]);
        $without  = $this->panelFor(['status' => 422]);

        $this->assertNotSame($withList, $without);
        $this->assertStringContainsString('missing: diseaseRisk, topDisease, stressIndex', $withList);
        $this->assertStringContainsString('the server did not name the missing values', $without);
        // and the one without a list does not pretend to have one
        $this->assertStringNotContainsString('missing:', $without);
    }

    public function test_an_empty_or_junk_list_is_not_printed_as_if_it_were_names(): void
    {
        // What is NOT junk, and the distinction cost me a red: `'keys' => 'x'`
        // is a string PHP casts to a one-element array, and one key named `x` is
        // a legitimate list. The junk is a list with nothing nameable in it.
        foreach ([[], [null], [''], [123, true], [['nested']]] as $junk) {
            $text = $this->panelFor(['status' => 422, 'keys' => $junk]);
            $this->assertStringNotContainsString('missing: ', $text, json_encode($junk).' printed as names');
            $this->assertStringContainsString('did not name the missing values', $text);
        }

        // and a single name still prints as a name
        $this->assertStringContainsString('missing: weatherSource',
            $this->panelFor(['status' => 422, 'keys' => ['weatherSource']]));
    }

    public function test_every_reason_the_runner_can_send_renders_a_readable_sentence(): void
    {
        // The gap this file closes was a reason nobody had ever rendered. The
        // remedy is not one more case for one more code: every code the runner
        // can emit is rendered here, and each must produce a sentence that names
        // the code's meaning rather than the code.
        $codes = [
            'site-settings-unavailable' => 'the site settings did not load',
            'weather-unavailable'       => 'no weather data was available',
            'calculation-error'         => 'the calculation stopped with an error',
            'normals-timeout'           => 'the climate normals did not arrive',
            'incomplete-result'         => 'the server refused the result as incomplete',
            'rejected'                  => 'the server refused the result',
            'site-mismatch'             => 'the result did not belong to the site',
            'run-not-completed'         => 'the run did not finish',
            'no-report'                 => 'the run never reported back',
            'schema-unavailable'        => 'the page was not given the declared form',
            // GH-557 added these with the third outcome.
            'climate-late'              => 'the climate data arrived after the steps',
            'disease-not-computed'      => 'the disease analysis it depends on',
            'engine-error'              => 'the engine stopped with an error',
            'pass-start-unknown'        => 'could not tell whether it finished before or after',
            'values-not-computed'       => 'some values were not computed',
        ];

        foreach ($codes as $code => $expectedFragment) {
            $text = AnalysisNotice::reasonText($code, null);
            $this->assertStringContainsString($expectedFragment, $text, $code.' does not read as a sentence');
            // and none of them leaks a placeholder
            $this->assertStringNotContainsString('{', $text, $code.' left a placeholder in the text');
        }
    }

    /**
     * The whole way through, from the row the server writes to the string the
     * page prints — because every link of this was already asserted separately
     * and the sentence still came out without the names.
     */
    public function test_the_names_survive_the_round_trip_from_the_row_to_the_screen(): void
    {
        [$user, $site] = $this->siteFor('manager');
        AnalysisResults::record($user, $site, [
            'metrics'    => $this->completeMetrics(['growthPotential' => 0.6]),
            'computed'   => null,
            'analyzedAt' => '2026-09-20T20:00:00Z',
            'runId'      => 'run-ok',
        ]);

        // Exactly what the runner sends after a 422: the status and the list.
        $this->actingAs($user)->postJson('/api/analysis-cache/runs', [
            'site_id' => $site->id,
            'run_id'  => 'run-short',
            'outcome' => 'failed',
            'reason'  => 'incomplete-result',
            'detail'  => ['status' => 422, 'keys' => self::MISSING],
        ])->assertOk();

        $user->forceFill(['last_active_site_id' => $site->id])->save();
        $html = $this->actingAs($user->fresh())->get('/dashboard')->assertOk()->getContent();

        $this->assertStringContainsString('missing: diseaseRisk, topDisease, stressIndex', $html,
            'the names reach the row and not the page');
        // and the numbers are still there with their own date, which is the
        // owner's decision this whole notice exists to serve
        $this->assertStringContainsString('Sep 20 20:00', $html);
    }

    private function panelFor(array $detail): string
    {
        return AnalysisNotice::panel([
            'analyzedAt' => '2026-09-20T20:00:00Z',
            'metrics'    => ['growthPotential' => 0.6],
            'computed'   => null,
            'lastRun'    => [
                'runId' => 'r', 'outcome' => 'failed', 'reason' => 'incomplete-result',
                'detail' => $detail, 'failedAt' => '2026-09-22T14:08:00Z',
            ],
            'status' => 'failed',
        ], 'UTC')['text'];
    }

    private function siteFor(string $role): array
    {
        $user = User::factory()->create();
        $account = Account::query()->firstOrCreate(
            ['owner_user_id' => $user->id],
            ['display_name' => $user->name, 'created_by_user_id' => $user->id, 'modified_by_user_id' => $user->id]
        );
        $site = Site::query()->create([
            'account_id' => $account->id, 'name' => 'Owner Site', 'slug' => 'owner-site',
            'site_type' => 'precinct', 'timezone' => 'UTC',
            'created_by_user_id' => $user->id, 'modified_by_user_id' => $user->id,
        ]);
        $site->users()->attach($user->id, ['role' => $role]);

        return [$user, $site];
    }
}
