<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\AnalysisResult;
use App\Models\Sample;
use App\Models\Site;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * GH-663 (queue item 3ak, the analyst's section 29.5) — THE RUN FRAME IS RENDERED
 * FOR THE SITE IT WAS ASKED FOR, AND A ROW COMPUTED FOR ANOTHER SITE IS REFUSED.
 *
 * WHAT WAS WRONG, measured on the stand and not argued about (GH-660, GH-661):
 * `/hub` took its site from `users.last_active_site_id`, so a frame opened as
 * `/hub?rerun=r&site=<A>` while the pointer stood on B rendered B's coordinates,
 * B's species, B's turf type and B's samples — and the write it then held carried
 * `site_id: A`. One site's name over another site's numbers, with annual totals
 * that still agree because the annual figure is normalised to its target. That is
 * the GH-459 class with a second address.
 *
 * THE CASES ARE THE ANALYST'S, one per layer of her 29.3:
 *   render   — the page is built for the parameter, the pointer is not moved, and
 *              a site the viewer may not see is refused rather than replaced by
 *              the pointer;
 *   server   — a body declaring another site, or carrying another site's sample,
 *              is refused `422 site-mismatch`;
 *   frame-less — a page with no `rerun`/`site` still follows the pointer, because
 *              that is every other page in the product.
 */
class Gh663TheFrameIsRenderedForTheSiteAskedForTest extends TestCase
{
    use RefreshDatabase;

    public function test_the_frame_is_rendered_for_the_site_in_the_parameter_not_the_pointer(): void
    {
        [$user, $asked, $pointer] = $this->twoSites();

        $response = $this->actingAs($user)->get('/hub?rerun=r-1&site='.$asked->id);
        $response->assertOk();

        $html = $response->getContent();
        // The page names the site it was asked for...
        $this->assertStringContainsString($asked->id, $html);
        // ...and not the one the pointer stands on. Asserted as absence of the id
        // rather than as presence of a label, because the id is what every
        // consumer downstream reads.
        $this->assertStringNotContainsString($pointer->id, $html);
    }

    public function test_the_pointer_is_not_moved_by_rendering_a_frame(): void
    {
        // A frame that moved the pointer would switch the site under the user's
        // other tab — the same defect running backwards.
        [$user, $asked, $pointer] = $this->twoSites();

        $this->actingAs($user)->get('/hub?rerun=r-1&site='.$asked->id)->assertOk();

        $this->assertSame($pointer->id, $user->fresh()->last_active_site_id);
    }

    public function test_a_site_the_viewer_may_not_see_is_refused_and_not_replaced_by_the_pointer(): void
    {
        // Falling back to the pointer IS the defect. A refusal is the outcome.
        [$user, , $pointer] = $this->twoSites();
        $strangers = $this->strangerSite();

        $this->actingAs($user)->get('/hub?rerun=r-1&site='.$strangers->id)
            ->assertStatus(403);
    }

    public function test_an_unknown_site_is_refused_rather_than_silently_becoming_the_pointer(): void
    {
        [$user] = $this->twoSites();

        $this->actingAs($user)->get('/hub?rerun=r-1&site=019f0000-0000-7000-8000-000000000000')
            ->assertStatus(404);
    }

    public function test_a_page_that_is_not_a_run_frame_still_follows_the_pointer(): void
    {
        // Every other page in the product, and the report pages the analyst put
        // out of scope (29.6), must keep working exactly as before.
        [$user, $asked, $pointer] = $this->twoSites();

        $html = $this->actingAs($user)->get('/hub')->assertOk()->getContent();
        $this->assertStringContainsString($pointer->id, $html);
        $this->assertStringNotContainsString($asked->id, $html);

        // And `?site=` without `rerun=` is not a frame either: giving any page a
        // second way to choose its site is the shape this removes.
        $html2 = $this->actingAs($user)->get('/hub?site='.$asked->id)->assertOk()->getContent();
        $this->assertStringContainsString($pointer->id, $html2);
    }

    public function test_the_server_refuses_a_row_that_declares_another_site(): void
    {
        [$user, $asked, $pointer] = $this->twoSites();

        $response = $this->actingAs($user)->postJson('/api/analysis-cache', [
            'site_id' => $asked->id,
            'run_id' => 'r-1',
            'analyzed_at' => now()->toIso8601String(),
            'metrics' => $this->metrics(),
            'computed' => [],
            'inputs' => ['site' => $pointer->id, 'samples' => []],
        ]);

        $response->assertStatus(422);
        $response->assertJsonPath('error', 'site-mismatch');
        $response->assertJsonPath('detail.computedFor', $pointer->id);
        $response->assertJsonPath('detail.filedUnder', $asked->id);
        $this->assertSame(0, AnalysisResult::query()->count());
    }

    public function test_the_server_refuses_a_row_carrying_another_sites_sample(): void
    {
        // The second half of the server's check, and the one that holds even when
        // the declaration is absent or has been made to agree: a sample is a fact
        // in the database.
        [$user, $asked, $pointer] = $this->twoSites();
        $foreign = Sample::query()->create([
            'account_id' => $asked->account_id,
            'site_id' => $pointer->id,
            'sample_type' => 'soil',
            'lab_name' => 'lab',
            'lab_ref' => '',
            'soil_texture_snapshot' => '',
            'payload' => ['pH' => 6.1],
            'created_by_user_id' => $user->id,
            'modified_by_user_id' => $user->id,
        ]);

        $response = $this->actingAs($user)->postJson('/api/analysis-cache', [
            'site_id' => $asked->id,
            'run_id' => 'r-2',
            'analyzed_at' => now()->toIso8601String(),
            'metrics' => $this->metrics(),
            'computed' => [],
            'inputs' => ['samples' => ['soil' => (string) $foreign->id]],
        ]);

        $response->assertStatus(422);
        $response->assertJsonPath('error', 'site-mismatch');
        $this->assertSame(0, AnalysisResult::query()->count());
    }

    public function test_a_row_whose_inputs_say_nothing_about_the_site_is_still_accepted(): void
    {
        // POSITIVE CONTROL AND A DELIBERATE BOUNDARY. Silence is not a foreign
        // name: a body from a bundle that predates the declaration must still be
        // filed, or a deployment becomes a data outage. This is also the case that
        // would catch the check being made on presence rather than on value.
        [$user, $asked] = $this->twoSites();

        $this->actingAs($user)->postJson('/api/analysis-cache', [
            'site_id' => $asked->id,
            'run_id' => 'r-3',
            'analyzed_at' => now()->toIso8601String(),
            'metrics' => $this->metrics(),
            'computed' => [],
            'inputs' => ['samples' => ['soil' => null]],
        ])->assertStatus(200);

        $this->assertSame(1, AnalysisResult::query()->count());
    }

    public function test_a_row_that_agrees_is_accepted_or_every_refusal_above_proves_nothing(): void
    {
        [$user, $asked] = $this->twoSites();

        $this->actingAs($user)->postJson('/api/analysis-cache', [
            'site_id' => $asked->id,
            'run_id' => 'r-4',
            'analyzed_at' => now()->toIso8601String(),
            'metrics' => $this->metrics(),
            'computed' => [],
            'inputs' => ['site' => $asked->id, 'samples' => []],
        ])->assertStatus(200);

        $this->assertSame(1, AnalysisResult::query()->count());
    }

    public function test_a_prediction_with_no_site_is_named_rather_than_swallowed(): void
    {
        // GH-662, the analyst's 29.8: `continue` dropped it silently and from
        // outside that is the same as no write. There is no "the server decides"
        // outcome for this address, so an empty site is a frame that lost it.
        [$user, $asked] = $this->twoSites();

        $response = $this->actingAs($user)->postJson('/api/predictions', [
            'predictions' => [
                ['site_id' => $asked->id, 'module' => 'disease', 'sub_key' => 'largePatch',
                    'predicted_label' => 'Large Patch risk: 34%'],
                ['module' => 'disease', 'sub_key' => 'dollarSpot',
                    'predicted_label' => 'Dollar Spot risk: 15%'],
            ],
        ]);

        $response->assertStatus(201);
        // The lawful one is written...
        $response->assertJsonPath('written', 1);
        // ...and the one that lost its site is counted and named.
        $response->assertJsonPath('skipped', 1);
        $response->assertJsonPath('skipped_detail.0.reason', 'site-missing');
        $response->assertJsonPath('skipped_detail.0.module', 'disease');
    }

    /**
     * Every metric the declared form requires, `null` where a run would have had
     * nothing — taken FROM the schema rather than typed out, so a key added to it
     * arrives here by itself (GH-553). A hand-written list would make these cases
     * red for a reason that has nothing to do with the site.
     */
    private function metrics(): array
    {
        $out = [];
        foreach (\App\Support\AnalysisResultSchema::requiredMetrics() as $key) {
            $out[$key] = null;
        }
        $out['timestamp'] = now()->toIso8601String();
        $out['growthPotential'] = 34;

        return $out;
    }

    /** @return array{0:User,1:Site,2:Site} */
    private function twoSites(): array
    {
        $user = User::factory()->create(['is_admin' => false]);
        $account = Account::query()->create([
            'owner_user_id' => $user->id, 'display_name' => 'A',
            'created_by_user_id' => $user->id, 'modified_by_user_id' => $user->id,
        ]);
        $make = function (string $name) use ($user, $account) {
            $site = Site::query()->create([
                'account_id' => $account->id, 'name' => $name,
                'slug' => strtolower($name).'-'.substr((string) $user->id, -4),
                'site_type' => 'sports',
                'created_by_user_id' => $user->id, 'modified_by_user_id' => $user->id,
            ]);
            $site->users()->attach($user->id, ['role' => 'manager']);

            return $site;
        };
        $asked = $make('Asked');
        $pointer = $make('Pointer');
        $user->forceFill(['last_active_site_id' => $pointer->id])->save();

        return [$user->fresh(), $asked, $pointer];
    }

    private function strangerSite(): Site
    {
        $other = User::factory()->create(['is_admin' => false]);
        $account = Account::query()->create([
            'owner_user_id' => $other->id, 'display_name' => 'B',
            'created_by_user_id' => $other->id, 'modified_by_user_id' => $other->id,
        ]);
        $site = Site::query()->create([
            'account_id' => $account->id, 'name' => 'Stranger', 'slug' => 'stranger-'.$other->id,
            'site_type' => 'sports',
            'created_by_user_id' => $other->id, 'modified_by_user_id' => $other->id,
        ]);
        $site->users()->attach($other->id, ['role' => 'manager']);

        return $site;
    }
}
