<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\AnalysisResult;
use App\Models\Site;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * GH-788 (queue item 3gd, found while repairing the source-reading guards) — THE JOURNAL'S MARKS REACH THE ROW.
 *
 * WHAT WAS WRONG. The controller validates the body and stores `$validated['detail']`, and Laravel hands back
 * only the keys the rules name — an undeclared key is dropped in silence. `detail.journal` was not declared, so
 * the marks the runner assembles (which pass each account belongs to, whether a pass was still running when the
 * row was written, the sample ids of the cascade pass) never reached a row.
 *
 * MEASURED ON THE STAND: 0 of 130 stored rows carried `detail.journal`, including rows written the same day,
 * while `detail.skipped` and `detail.warnings` beside it were in 125 of them. The reconciliation of GH-781 —
 * every writer of the journal either met in a stored row or declared — therefore could not fill at all, and its
 * suite reported itself NOT FILLED rather than passing, which is how the loss was visible.
 *
 * THE CLASS WAS ALREADY NAMED IN THAT FILE. The rule above `detail.notApplicable` says it in as many words:
 * "Declared here or it never reaches `$validated`". GH-781 added a key and did not add its rule.
 *
 * WHAT THIS HOLDS: the marks survive a POST, and the keys beside them are untouched — a repair that quietly
 * dropped `skipped` or `warnings` while fixing `journal` would be the same fault with a different key.
 */
class Gh788TheJournalMarksReachTheRowTest extends TestCase
{
    use RefreshDatabase;
    use \Tests\Feature\Concerns\BuildsAnalysisResults;

    /** The marks the runner assembles, in the shape `hub-persistence.js` sends them. */
    private const MARKS = [
        'cascadePass' => 'cascade-1790000000000-abc',
        'orchestratorPass' => 'orchestrator-1790000000001-def',
        'passNotFinishedAtWrite' => null,
        'cascadeSampleIds' => 'soil:41|water:none|tissue:none|pgr:log_7',
    ];

    public function test_the_marks_are_stored_and_the_accounts_beside_them_are_untouched(): void
    {
        [$user, $site] = $this->siteFor('manager');

        $response = $this->actingAs($user)->postJson('/api/analysis-cache', [
            'site_id' => $site->id,
            'run_id' => 'run-gh788-1',
            'analyzed_at' => '2026-09-30T08:00:00Z',
            'metrics' => $this->completeMetrics(),
            'computed' => ['climate' => ['ok' => true]],
            'detail' => [
                'journal' => self::MARKS,
                'skipped' => [['step' => 'wear', 'module' => 'wear', 'reason' => 'no-schedule']],
                'warnings' => [['module' => 'pgr', 'message' => 'window exhausted', 'at' => 1790000000002]],
                'nulls' => [],
                'notApplicable' => [],
                'assumptions' => [],
            ],
        ]);
        $response->assertSuccessful();

        $row = AnalysisResult::query()->where('site_id', $site->id)->latest('id')->first();
        fwrite(STDOUT, '[gh788] detail keys stored: '.json_encode(array_keys($row->detail ?? [])).PHP_EOL
            .'[gh788] journal stored: '.json_encode($row->detail['journal'] ?? null).PHP_EOL);

        // THE MARKS THEMSELVES, field by field: a key present but emptied would satisfy a test of presence.
        $this->assertSame(self::MARKS, $row->detail['journal'] ?? null);
        // AND THE ACCOUNTS BESIDE THEM, which were never lost and must not start being lost now.
        $this->assertSame('no-schedule', $row->detail['skipped'][0]['reason'] ?? null);
        $this->assertSame('pgr', $row->detail['warnings'][0]['module'] ?? null);
    }

    /**
     * THE OTHER DIRECTION, and it is what makes the case above mean something: a key the rules do NOT name is
     * still dropped. Without this, "the journal is stored" could be true because the controller had stopped
     * validating at all, which is a different and worse state than the one being repaired.
     */
    public function test_a_key_the_rules_do_not_name_is_still_dropped(): void
    {
        [$user, $site] = $this->siteFor('manager');

        $this->actingAs($user)->postJson('/api/analysis-cache', [
            'site_id' => $site->id,
            'run_id' => 'run-gh788-2',
            'analyzed_at' => '2026-09-30T08:05:00Z',
            'metrics' => $this->completeMetrics(),
            'computed' => ['climate' => ['ok' => true]],
            'detail' => [
                'journal' => self::MARKS,
                'somethingNobodyDeclared' => ['a' => 1],
            ],
        ])->assertSuccessful();

        $row = AnalysisResult::query()->where('site_id', $site->id)->latest('id')->first();
        fwrite(STDOUT, '[gh788] an undeclared key, stored? '
            .json_encode(array_key_exists('somethingNobodyDeclared', $row->detail ?? [])).PHP_EOL);

        $this->assertArrayNotHasKey('somethingNobodyDeclared', $row->detail ?? []);
        $this->assertSame(self::MARKS, $row->detail['journal'] ?? null);
    }

    /** @return array{0: User, 1: Site} */
    private function siteFor(string $role): array
    {
        $user = User::factory()->create();
        $account = Account::query()->firstOrCreate(
            ['owner_user_id' => $user->id],
            ['display_name' => $user->name, 'created_by_user_id' => $user->id, 'modified_by_user_id' => $user->id]
        );
        $site = Site::query()->create([
            'account_id' => $account->id, 'name' => 'Journal Site', 'slug' => 'journal-site-'.$user->id,
            'site_type' => 'precinct', 'timezone' => 'UTC',
            'created_by_user_id' => $user->id, 'modified_by_user_id' => $user->id,
        ]);
        $site->users()->attach($user->id, ['role' => $role]);

        return [$user, $site];
    }
}
