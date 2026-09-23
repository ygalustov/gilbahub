<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\AnalysisResult;
use App\Models\Site;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * GH-552 — half two: does the server refuse an incomplete result?
 *
 * THE PLAN SAYS IT DOES. Section 3 point 6: a body missing a declared key is
 * answered 422 `incomplete`, and the runner turns that into a failure report
 * with `reason: 'incomplete-result'` and the list of keys. That is the second of
 * the two things that were supposed to make "twelve keys" inexpressible.
 *
 * THE LIVE INSTANCE SAYS OTHERWISE. Federal Golf's row was written by a real
 * Re-run on 22.09.2026 with SIX of the thirteen required keys and
 * `outcome = 'complete'`.
 *
 * WHAT THIS FILE WAS AND WHAT IT IS NOW. It was written during the measurement,
 * asserting the behaviour AS IT WAS — 200, stored as `complete`, six keys — so
 * that the defect had a record rather than a description, and its docblock said
 * that this is where the expectation changes when completeness is enforced. It
 * is that day (GH-553), and the expectation has changed: the same body is
 * refused 422, the refusal NAMES the seven missing keys, and nothing is stored.
 *
 * The subject is unchanged and that is the point of keeping the file: it still
 * sends the exact body the live Re-run sent, so the row that exists on the stand
 * could not be produced again.
 */
class Gh552ServerAcceptsAnIncompleteResultTest extends TestCase
{
    use RefreshDatabase;
    use \Tests\Feature\Concerns\BuildsAnalysisResults;

    /** The six keys the runner actually sent, measured in the sandbox. */
    private const INCOMPLETE_METRICS = [
        'timestamp'         => '2026-09-22T04:08:27Z',
        'growthPotential'   => 61,
        'soilTemp'          => 14.2,
        'weatherSource'     => 'live',
        'irrigationNeed'    => 18,
        'irrigationDeficit' => 4,
    ];

    /** The seven the schema declares required and the body does not carry. */
    private const MISSING_SORTED = [
        'diseaseRisk', 'forecastDisease', 'forecastPeak', 'peakDay',
        'stressIndex', 'topDisease', 'trendDirection',
    ];

    private const MISSING = [
        'diseaseRisk', 'topDisease', 'forecastPeak', 'peakDay',
        'forecastDisease', 'stressIndex', 'trendDirection',
    ];

    public function test_the_declared_form_really_asks_for_thirteen(): void
    {
        // The control. Without it, "the server accepted an incomplete body"
        // would be a claim about a schema nobody has read.
        $schema = json_decode(file_get_contents(base_path('../assets/analysis-result.schema.json')), true);
        $required = $schema['metrics']['required'];
        $this->assertCount(13, $required);
        foreach (self::MISSING as $key) {
            $this->assertContains($key, $required, $key.' is not declared required — the premise is wrong');
        }
        foreach (array_keys(self::INCOMPLETE_METRICS) as $key) {
            $this->assertContains($key, $required);
        }
    }

    public function test_the_body_that_produced_federal_golfs_row_is_now_refused(): void
    {
        [$user, $site] = $this->siteFor('manager');

        $response = $this->actingAs($user)->postJson('/api/analysis-cache', [
            'site_id'     => $site->id,
            'run_id'      => 'run-1790050104727-k7vbb7',
            'analyzed_at' => '2026-09-22T04:08:27Z',
            'metrics'     => self::INCOMPLETE_METRICS,
            'computed'    => ['climate' => ['ok' => true], 'disease' => null, 'stress' => null],
        ]);

        $response->assertStatus(422);
        $response->assertJsonPath('message', 'incomplete-result');
        // The list is the point: "incomplete" without saying what is missing is
        // a message nobody can act on, and the runner puts this list on screen.
        $missing = $response->json('missing');
        sort($missing);
        $this->assertSame(self::MISSING_SORTED, $missing);

        // Nothing is stored. The previous result stays where it was — the
        // owner's decision — rather than being half-replaced.
        $this->assertSame(0, AnalysisResult::query()->where('site_id', $site->id)->count());
    }

    public function test_a_body_whose_engines_answered_nothing_is_ACCEPTED_and_is_PARTIAL(): void
    {
        // This case has changed its answer once and the change is the point.
        //
        // GH-553: a run that could not compute disease sends the key as `null`,
        // and the body is well formed — so it is accepted, where an `empty()`
        // check would have refused the very shape the fix asks for. That much
        // still holds and is still asserted.
        //
        // GH-557: being well formed is not being complete. Thirteen keys of
        // which seven are `null` is a run that finished without computing seven
        // values, and storing it as `complete` is how it came to replace the
        // numbers of a run that had computed all of them.
        [$user, $site] = $this->siteFor('manager');

        $response = $this->actingAs($user)->postJson('/api/analysis-cache', [
            'site_id'     => $site->id,
            'run_id'      => 'run-nulls',
            'analyzed_at' => '2026-09-22T04:08:27Z',
            'metrics'     => $this->partialMetrics($this->federalGolfNulls(), self::INCOMPLETE_METRICS),
            'computed'    => ['climate' => ['ok' => true]],
        ]);

        $response->assertOk();
        $response->assertJsonPath('outcome', 'partial');

        $row = AnalysisResult::query()->where('site_id', $site->id)->firstOrFail();
        $this->assertSame('partial', $row->outcome);
        $this->assertCount(13, $row->metrics);
        foreach (self::MISSING as $key) {
            $this->assertArrayHasKey($key, $row->metrics, $key.' was dropped');
            $this->assertNull($row->metrics[$key], $key.' should be null, not a value');
        }
        $this->assertSame($this->federalGolfNulls(), $row->detail['nulls']);
    }

    public function test_a_body_with_every_value_computed_is_COMPLETE(): void
    {
        // The control for the case above: if everything were partial, "partial"
        // would say nothing.
        [$user, $site] = $this->siteFor('manager');

        $this->actingAs($user)->postJson('/api/analysis-cache', [
            'site_id'     => $site->id,
            'run_id'      => 'run-full',
            'analyzed_at' => '2026-09-22T04:08:27Z',
            'metrics'     => $this->completeMetrics(),
        ])->assertOk()->assertJsonPath('outcome', 'complete');

        $this->assertSame('complete',
            AnalysisResult::query()->where('site_id', $site->id)->firstOrFail()->outcome);
    }

    public function test_the_refusal_comes_after_the_permission_check_not_before(): void
    {
        // Order is part of a check. With completeness in front of the service, a
        // VIEWER posting a short body got 422 and the shape of the site's result
        // — and never got the 403 that was the real answer.
        [$owner, $site] = $this->siteFor('manager');
        $viewer = User::factory()->create();
        $site->users()->attach($viewer->id, ['role' => 'viewer']);

        $this->actingAs($viewer)->postJson('/api/analysis-cache', [
            'site_id'     => $site->id,
            'run_id'      => 'run-viewer',
            'analyzed_at' => '2026-09-22T04:08:27Z',
            'metrics'     => self::INCOMPLETE_METRICS,
        ])->assertStatus(403);
    }

    public function test_the_server_reads_the_declared_form_and_reads_it_once(): void
    {
        // The measurement that stood here found ZERO PHP files reading the
        // schema, which is why the route could not tell six keys from thirteen.
        // Now exactly one reads it, and the assertion is that there is one — a
        // second reader is a second interpretation of the same file.
        $hits = [];
        $it = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator(base_path('app')));
        foreach ($it as $f) {
            if (! $f->isFile() || $f->getExtension() !== 'php') {
                continue;
            }
            $code = preg_replace(['#/\*[\s\S]*?\*/#', '#^\s*//.*$#m'], '', file_get_contents($f->getPathname()));
            if (str_contains($code, 'analysis-result.schema')) {
                $hits[] = str_replace(base_path('app').'/', '', $f->getPathname());
            }
        }
        $this->assertSame(['Support/AnalysisResultSchema.php'], $hits);

        // and the page is handed the same list, from the same reader
        $blade = file_get_contents(resource_path('views/layouts/app.blade.php'));
        $this->assertStringContainsString('GAIP_ANALYSIS_SCHEMA', $blade);
        $this->assertStringContainsString('AnalysisResultSchema::forClient()', $blade);
    }

    public function test_one_key_short_is_as_refused_as_seven(): void
    {
        // Where the floor used to be: one key was accepted, and only an empty
        // array was refused — and that only because `required` reads an empty
        // array as absent, not because anything counted keys. The floor is now
        // the declared form, so ONE missing key is the interesting case.
        [$user, $site] = $this->siteFor('manager');

        $one = $this->completeMetrics();
        unset($one['weatherSource']);

        $this->actingAs($user)->postJson('/api/analysis-cache', [
            'site_id'     => $site->id,
            'run_id'      => 'run-one-short',
            'analyzed_at' => '2026-09-22T04:08:27Z',
            'metrics'     => $one,
        ])->assertStatus(422)->assertJsonPath('missing', ['weatherSource']);

        $this->assertSame(0, AnalysisResult::query()->where('site_id', $site->id)->count());
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
