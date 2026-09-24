<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Site;
use App\Models\SiteConfig;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Database\Events\TransactionCommitted;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
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
     * GH-686 — WHAT USED TO BE MEASUREMENT 2 NOW GUARDS THE REPAIR IT WAS WAITING FOR.
     *
     * It used to assert the LOSS: the column holding B's coordinate while the config copy held
     * A's, produced by running B's whole request inside A's read. The repair landed -- the row and
     * its copies are one transaction now -- so the case turns around rather than being deleted, and
     * it says whose change turned it: the analyst's section 2a, accepted by the owner.
     *
     * AND B'S NESTED REQUEST IS GONE, which is the reviewer's own finding rather than a tidy-up.
     * Two requests on one connection do not interleave the way two clients do: the values
     * `-36.85 / -41.29` that the old case printed as a divergence were an artefact of the nested
     * request sharing A's connection and A's transaction, not of the product. A measurement whose
     * subject is manufactured by the measuring proves nothing about the product, so what is left
     * is the part that IS about the product: the ORDER.
     *
     * WHAT IS ASSERTED: the read that feeds the derived copies happens INSIDE a transaction, and it
     * brings back the latitude A had already written. Recognised by that value, which is what makes
     * it that read and not the earlier one -- the refresh at the top of the lock still carries the
     * previous coordinate.
     *
     * HOW "ONE TRANSACTION" IS MEASURED, and the transaction LEVEL will not do it. Two adjacent
     * transactions both sit above the baseline, so a level alone cannot tell "the read is in the
     * transaction that wrote the row" from "the read is in the next one". What tells them apart is
     * whether a COMMIT happened in between, so commits are counted and the count is compared at the
     * two moments. The level is asserted too, against the baseline rather than against zero:
     * `RefreshDatabase` runs every test inside a transaction, so nothing here is ever at level 0.
     *
     * THE BOUNDARY, and it is not a small one: THE LOCK ITSELF IS NOT MEASURED HERE. PHPUnit runs
     * on SQLite, which does not write `FOR UPDATE` at all, so nothing in this case can tell a
     * lock that holds from a lock that is not taken. Two connections against MySQL would be
     * required and there is no permitted database for it; the coordinator carries that remainder
     * as a question of her own. What is claimed is the order and the one transaction.
     */
    public function test_the_read_that_feeds_the_copies_happens_inside_the_transaction_that_wrote_the_row(): void
    {
        // The fixture carries a methodology: since GH-684 the server refuses a config write whose
        // result leaves a site without one, and this case is about another subject entirely.
        [$user, $site] = $this->siteWithTurf(['species' => 'Perennial Ryegrass', 'methodology' => 'mlsn']);
        $this->patchSite($user, $site, ['latitude' => -43.5, 'longitude' => 172.6])->assertOk();

        // Commits, counted, because the level cannot tell one transaction from the next one.
        $commits = 0;
        Event::listen(TransactionCommitted::class, function () use (&$commits) {
            $commits++;
        });
        $baseline = DB::transactionLevel();
        $log = [];
        DB::listen(function ($query) use (&$log, &$commits) {
            $log[] = ['sql' => $query->sql, 'level' => DB::transactionLevel(), 'commits' => $commits];
        });

        $fired = false;
        $levelAtRead = null;
        $commitsAtRead = null;
        $latitudeAtRead = null;
        Site::retrieved(function (Site $model) use (&$fired, &$levelAtRead, &$commitsAtRead, &$latitudeAtRead, &$commits, $site) {
            // The read wanted is the one that feeds the copies: it is the first retrieval that
            // brings back A's OWN latitude, because the refresh at the top of the lock still
            // carries the previous one. Nothing is written from in here.
            if ($fired || $model->id !== $site->id || (float) $model->latitude !== -41.29) {
                return;
            }
            $fired = true;
            $levelAtRead = DB::transactionLevel();
            $commitsAtRead = $commits;
            $latitudeAtRead = (float) $model->latitude;
        });

        $this->patchSite($user, $site, ['latitude' => -41.29, 'longitude' => 174.78])->assertOk();

        $rowWrite = null;
        foreach ($log as $entry) {
            if (str_starts_with($entry['sql'], 'update "sites"')) {
                $rowWrite = $entry;
                break;
            }
        }

        $row = Site::query()->find($site->id);
        $copy = $this->config($site)['location'] ?? [];
        fwrite(STDOUT, PHP_EOL.'[gh633-2] the read that feeds the copies fired: '.json_encode($fired)
            .'  at level '.json_encode($levelAtRead).' after '.json_encode($commitsAtRead).' commits'
            .'  with latitude '.json_encode($latitudeAtRead).PHP_EOL);
        fwrite(STDOUT, '[gh633-2] the row was written at level '
            .json_encode($rowWrite['level'] ?? null).' after '
            .json_encode($rowWrite['commits'] ?? null).' commits; baseline level '.json_encode($baseline).PHP_EOL);
        fwrite(STDOUT, '[gh633-2] sites.latitude='.json_encode((float) $row->latitude)
            .'  config.location.lat='.json_encode($copy['lat'] ?? null).PHP_EOL);

        // THE SUBJECT EXISTS, asserted before anything is concluded from it. Without the read
        // there is no order to speak of, and without the copy the read fed nothing.
        $this->assertTrue($fired, 'the read that feeds the copies never happened — this case did not reach its subject');
        $this->assertNotNull($rowWrite, 'the row was never written, so there is no transaction to be inside of');
        $this->assertNotNull($copy['lat'] ?? null, 'no copy was derived at all');

        // THE CLAIM: that read is inside the transaction that wrote the row, and it sees the row
        // as written. Both halves matter — a read inside the transaction that came BEFORE the
        // write would leave the copy stale just as surely.
        $this->assertGreaterThan($baseline, $rowWrite['level'], 'the row was written outside a transaction');
        $this->assertGreaterThan($baseline, $levelAtRead,
            'the values for the copies were read outside any transaction the request opened');
        // THE ONE TRANSACTION: nothing was committed between writing the row and reading it back.
        $this->assertSame($rowWrite['commits'], $commitsAtRead,
            'a commit happened between the row being written and the read that feeds its copies, so they are two transactions, not one');
        $this->assertSame(-41.29, $latitudeAtRead,
            'the read brought back a latitude other than the one just written');

        // And the copy carries it, so the read was indeed the one feeding the copies.
        $this->assertSame(-41.29, (float) $copy['lat'], 'the copy does not hold what the row holds');
        $this->assertSame(-41.29, (float) $row->latitude);
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
