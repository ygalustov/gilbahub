<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Site;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * GH-654 — WHAT `context` RETURNS AS `lastPGR`, AND WHAT ITS WINDOW DOES TO AN
 * OLDER APPLICATION.
 *
 * The owner settled it: PGR comes from the spray log, not from the settings. The
 * analyst's plan (section 20) asks for this measurement first, as its positive
 * control, because everything after it rests on what the log can deliver.
 *
 * WHAT THIS SET CAN AND CANNOT MEASURE, said rather than assumed: PHPUnit runs on
 * an in-memory SQLite, so the STAND's own log is invisible here. Its contents were
 * measured directly against MySQL and are recorded in the report; what is measured
 * HERE is the device — which entry `context` picks, and whether its `days` window
 * hides an older one. Both halves are needed: the numbers say what exists, the
 * device says what reaches the run.
 */
class Gh654WhatTheSprayLogHoldsForPgrTest extends TestCase
{
    use RefreshDatabase;

    public function test_context_returns_the_latest_pgr_entry_and_the_window_decides_whether_an_older_one_is_seen(): void
    {
        [$user, $site] = $this->siteFor();
        // Two applications, in the two states the stand actually has: one inside
        // the 90-day window and one beyond it (the stand's are 65 and 99 days old).
        $this->logEntry($site, $user, 65, 'Primo Maxx');
        $this->logEntry($site, $user, 99, 'TE250');

        $within = $this->context($user, $site, ['days' => 90]);
        $whole = $this->context($user, $site, ['days' => 3650]);

        fwrite(STDOUT, PHP_EOL.'[gh654] with the default 90-day window, lastPGR: '
            .json_encode($within->json('lastPGR.application_date')).' | total entries seen: '
            .json_encode($within->json('totalApplications')).PHP_EOL);
        fwrite(STDOUT, '[gh654] with no practical window, lastPGR: '
            .json_encode($whole->json('lastPGR.application_date')).' | total entries seen: '
            .json_encode($whole->json('totalApplications')).PHP_EOL);

        // The latest by date wins — every new application restarts the count.
        $within->assertOk();
        $this->assertSame(now()->subDays(65)->toDateString(), $within->json('lastPGR.application_date'));
        $this->assertSame(2, $whole->json('totalApplications'));
    }

    public function test_an_application_older_than_the_window_is_named_whatever_the_window_asked_for(): void
    {
        /**
         * TURNED OVER BY THE REPAIR, GH-771. This case recorded the defect as the state of things:
         * with only an old entry in the log, the default window answered `lastPGR: null`, which the
         * run read as "no application recorded" rather than "an application whose effect is spent" --
         * and its own message said what it was waiting for, "the window no longer hides the older
         * application".
         *
         * It does not hide it now. The last PGR is asked for on its own, without the window and
         * without the 200-row limit, and the 90 days are applied once, in the engine, where
         * `GAIP_PGR_HISTORY_WINDOW_DAYS` lives. What `days` asks for still governs every other field
         * of the context, which is why both answers are read below and the totals are left alone.
         */
        [$user, $site] = $this->siteFor();
        $this->logEntry($site, $user, 99, 'TE250');

        $within = $this->context($user, $site, ['days' => 90]);
        $whole = $this->context($user, $site, ['days' => 3650]);

        fwrite(STDOUT, '[gh654] only a 99-day-old application exists. Within the window: '
            .json_encode($within->json('lastPGR')).' | without it: '
            .json_encode($whole->json('lastPGR.application_date')).PHP_EOL);

        // The application is named in both, because the window is no longer asked about it.
        $this->assertSame(now()->subDays(99)->toDateString(), $within->json('lastPGR.application_date'));
        $this->assertSame(now()->subDays(99)->toDateString(), $whole->json('lastPGR.application_date'));
        // And the entry is still outside the window for everything that does ask: the count of
        // applications within 90 days does not include it.
        $this->assertSame(0, $within->json('totalApplications'));
    }

    private function context(User $user, Site $site, array $params)
    {
        return $this->actingAs($user)->getJson('/api/spray-log/context?'
            .http_build_query(array_merge(['site_id' => $site->id], $params)));
    }

    private function logEntry(Site $site, User $user, int $daysAgo, string $product): void
    {
        DB::table('spray_logs')->insert([
            'account_id' => $site->account_id,
            'site_id' => $site->id,
            'user_id' => $user->id,
            'event_date' => now()->subDays($daysAgo)->toDateString(),
            'zone' => 'whole site',
            'product_name' => $product,
            'product_type' => 'pgr',
            'active_ingredient' => 'trinexapac-ethyl',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    /** @return array{0:User,1:Site} */
    private function siteFor(): array
    {
        $user = User::factory()->create();
        $account = Account::query()->firstOrCreate(
            ['owner_user_id' => $user->id],
            ['display_name' => $user->name, 'created_by_user_id' => $user->id, 'modified_by_user_id' => $user->id]
        );
        $site = Site::query()->create([
            'account_id' => $account->id,
            'name' => 'PGR site',
            'slug' => 'pgr-site-'.substr((string) $user->id, -4),
            'site_type' => 'sports',
            'created_by_user_id' => $user->id,
            'modified_by_user_id' => $user->id,
        ]);
        $site->users()->attach($user->id, ['role' => 'manager']);

        return [$user, $site];
    }
}
