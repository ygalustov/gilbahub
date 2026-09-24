<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Site;
use App\Models\SiteConfig;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * GH-633 — STAGE 1 OF THE ANALYST'S PLAN FOR QUEUE ITEM 17
 * (`PLAN-config-patch-race-RU.md`, section 3): THE TWO LOSSES, REPRODUCED
 * BEFORE ANYTHING IS BUILT TO PREVENT THEM.
 *
 * Her rule for this stage, kept: this work is not accepted without stage 1
 * shown red first — a green conflict test proves nothing unless today's loss has
 * been shown first. And: if the first measurement finds no loss, section 1 of
 * the plan is wrong and the work stops.
 *
 * THE FORM THESE TWO CASES TAKE, AND IT IS A DEPARTURE FROM THE PLAN, SAID OUT
 * LOUD. She wrote that the measurement should be a test that is RED on today's
 * tree and green after stage 3. A permanently red case in the tree would break
 * the rule this team runs the morning suite by — expected reds are zero, any
 * red is a finding — so these state what happens TODAY, and each carries the
 * line saying it MUST go red the day the repair lands. That is the same shape
 * `gh615` uses for a decision that is still open. The measurement is identical;
 * only the colour convention differs.
 */
class Gh633ConfigPatchRaceMeasureTest extends TestCase
{
    use RefreshDatabase;

    /**
     * MEASUREMENT 1 — the config section. Two tabs, no concurrency needed: the
     * loss comes from tab A sending the SECTION AS ITS FORM SHOWED IT, so a
     * field B changed in between travels back at its old value.
     */
    public function test_a_tab_that_saves_its_whole_section_undoes_a_field_changed_after_it_loaded(): void
    {
        [$user, $site] = $this->siteWithTurf([
            'species' => 'Perennial Ryegrass',
            'methodology' => 'slan',
            'turfType' => 'sports',
            'construction' => 'sand_profile',
            'hoc' => 25,
        ]);

        // A opens Settings and its form holds what the server gave it.
        $seenByA = $this->config($site)['turf'];
        fwrite(STDOUT, PHP_EOL.'[gh633-1] A loaded with construction='.json_encode($seenByA['construction']).PHP_EOL);

        // B changes one field of that section and saves.
        $this->patchConfig($user, $site, ['patch' => ['turf' => ['construction' => 'native_soil']]])->assertOk();
        fwrite(STDOUT, '[gh633-1] B saved construction='
            .json_encode($this->config($site)['turf']['construction']).PHP_EOL);

        // A now saves its own tab. This is what `patchGaipConfig` sends today:
        // the section as the form holds it, not the fields A changed.
        $sentByA = $seenByA;
        $sentByA['hoc'] = 12; // the only thing A actually touched
        $this->patchConfig($user, $site, ['patch' => ['turf' => $sentByA]])->assertOk();

        $after = $this->config($site)['turf'];
        fwrite(STDOUT, '[gh633-1] after A saved: construction='.json_encode($after['construction'])
            .' hoc='.json_encode($after['hoc']).PHP_EOL);

        // TODAY: B's change is gone, and nothing said so. A's own edit landed,
        // which is why this is invisible from A's side.
        // THIS CASE MUST GO RED when stage 3 lands — at that point A sends only
        // the field it changed, with `expected`, and `construction` stays
        // `native_soil` (or the save is refused with 409).
        $this->assertSame('sand_profile', $after['construction'], "B's change survived — section 1 of the plan would be wrong");
        $this->assertSame(12, $after['hoc']);
    }

    /**
     * MEASUREMENT 2 (plan section 2a) — the site row, which has no lock of its
     * own, and the derived copy that is read OUTSIDE the lock that writes it.
     *
     * HOW THE INTERLEAVING IS PRODUCED, because this one cannot be shown by two
     * sequential requests: `ownedColumnValues()` calls `$site->refresh()` and
     * only then takes the config lock. The test listens for that very read —
     * Eloquent's `retrieved` event — and runs B's whole request inside it, ONCE.
     * Nothing in the product is stubbed or modified; what is controlled is the
     * ORDER, which is what a race is.
     */
    public function test_the_config_copy_of_a_coordinate_disagrees_with_the_column_that_owns_it(): void
    {
        [$user, $site] = $this->siteWithTurf(['species' => 'Perennial Ryegrass']);
        $this->patchSite($user, $site, ['latitude' => -43.5, 'longitude' => 172.6])->assertOk();

        // The moment wanted is the refresh INSIDE A's request, after A has
        // written the row and before the config lock is taken — recognised by
        // the value the read brings back: A's own latitude. The read at the
        // start of the request still carries the previous one, so this cannot
        // fire early, and the flag keeps it from firing inside B.
        $fired = false;
        Site::retrieved(function (Site $model) use (&$fired, $user, $site) {
            if ($fired || $model->id !== $site->id || (float) $model->latitude !== -41.29) {
                return;
            }
            $fired = true;
            // B writes the row and derives its copies while A is between its
            // own read and its own write of the copies.
            $this->patchSite($user, $site, ['latitude' => -36.85, 'longitude' => 174.76]);
        });

        // A writes its coordinates; its copy is derived from what it read.
        $this->patchSite($user, $site, ['latitude' => -41.29, 'longitude' => 174.78]);

        $row = Site::query()->find($site->id);
        $copy = $this->config($site)['location'] ?? [];
        fwrite(STDOUT, '[gh633-2] interleaving fired: '.json_encode($fired).PHP_EOL);
        fwrite(STDOUT, '[gh633-2] sites.latitude='.json_encode((float) $row->latitude)
            .'  config.location.lat='.json_encode($copy['lat'] ?? null).PHP_EOL);

        // The positive control: without the interleaving this measures nothing.
        $this->assertTrue($fired, 'the refresh never happened — the measurement did not reach its subject');

        $this->assertNotNull($copy['lat'] ?? null, 'no copy was derived at all');

        // TODAY: the column holds B's coordinate and the config copy holds A's.
        // Whoever reads the config sees a latitude that is not the one its
        // owner holds.
        // THIS CASE MUST GO RED when plan section 2a lands — one transaction for the
        // row and its copies, values read INSIDE it.
        $this->assertSame(-36.85, (float) $row->latitude, 'the row does not hold what B wrote');
        $this->assertSame(-41.29, (float) $copy['lat'], 'the copy does not hold what A derived');
    }

    private function patchSite(User $user, Site $site, array $body)
    {
        return $this->actingAs($user)
            ->withSession(['_token' => 'test-token'])
            ->patchJson('/api/sites/'.$site->id, array_merge(['_token' => 'test-token'], $body));
    }

    private function patchConfig(User $user, Site $site, array $body)
    {
        return $this->actingAs($user)
            ->withSession(['_token' => 'test-token'])
            ->patchJson('/api/sites/'.$site->id.'/config/gaip', array_merge(['_token' => 'test-token'], $body));
    }

    private function config(Site $site): array
    {
        return SiteConfig::query()
            ->where('site_id', $site->id)
            ->where('namespace', 'gaip')
            ->first()
            ->config;
    }

    /** @return array{0:User,1:Site} */
    private function siteWithTurf(array $turf): array
    {
        $user = User::factory()->create();
        $account = Account::query()->firstOrCreate(
            ['owner_user_id' => $user->id],
            ['display_name' => $user->name, 'created_by_user_id' => $user->id, 'modified_by_user_id' => $user->id]
        );

        $site = Site::query()->create([
            'account_id' => $account->id,
            'name' => 'Race site',
            'slug' => 'race-site-'.substr((string) $user->id, -4),
            'site_type' => 'sports',
            'created_by_user_id' => $user->id,
            'modified_by_user_id' => $user->id,
        ]);
        $site->users()->attach($user->id, ['role' => 'manager']);

        SiteConfig::query()->create([
            'site_id' => $site->id,
            'namespace' => 'gaip',
            'config' => ['turf' => $turf],
            'synced_at' => now(),
        ]);

        return [$user, $site];
    }
}
