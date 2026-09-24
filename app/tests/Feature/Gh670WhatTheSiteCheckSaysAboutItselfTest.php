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
 * GH-670 (queue item 3ao) — THREE DIFFERENT SILENCES BECOME THREE DIFFERENT
 * STATEMENTS, AND THEY ARE KEPT IN THE ROW.
 *
 * The site check added by GH-663 answered "nothing to say" in three unrelated
 * situations: a body that declared no site at all, a sample key that resolved to no
 * row anywhere, and a NUMERIC key, which `is_string` dropped before the check ever
 * saw it. From outside, all three looked like a check that had run and agreed.
 *
 * MARKING AND NAMING ARE TWO DIFFERENT ACTIONS IN TWO DIFFERENT PLACES, and the
 * cases keep them apart deliberately: one mutation must redden one of them and not
 * the other. If a single mutation reddens both, the repair has merged them into one
 * message and a person would read one sentence about two different situations —
 * which the reviewer named as a new defect rather than an acceptance.
 *
 * THE MARK IS LOOKED FOR IN THE SAVED ROW, never in the response: "the response
 * lives a second, the row is read in a month".
 *
 * EVERY CASE BUILDS ITS OWN BODY. The state that makes any of this visible exists
 * on the stand today by coincidence, and the next press changes it.
 */
class Gh670WhatTheSiteCheckSaysAboutItselfTest extends TestCase
{
    use RefreshDatabase;

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

    /** @return array{0:User,1:Site} */
    private function site(): array
    {
        $user = User::factory()->create(['is_admin' => false]);
        $account = Account::query()->create([
            'owner_user_id' => $user->id, 'display_name' => 'A',
            'created_by_user_id' => $user->id, 'modified_by_user_id' => $user->id,
        ]);
        $site = Site::query()->create([
            'account_id' => $account->id, 'name' => 'Site', 'slug' => 'site-'.$user->id,
            'site_type' => 'sports',
            'created_by_user_id' => $user->id, 'modified_by_user_id' => $user->id,
        ]);
        $site->users()->attach($user->id, ['role' => 'manager']);

        return [$user->fresh(), $site];
    }

    private function ownSample(Site $site, User $user, ?string $key = null): Sample
    {
        return Sample::query()->create([
            'account_id' => $site->account_id, 'site_id' => $site->id, 'sample_type' => 'soil',
            'lab_name' => 'lab', 'lab_ref' => '', 'soil_texture_snapshot' => '',
            'payload' => ['pH' => 6.1], 'client_uid' => $key,
            'created_by_user_id' => $user->id, 'modified_by_user_id' => $user->id,
        ]);
    }

    /** @param array<string,mixed> $inputs */
    private function fileRow(User $u, Site $site, array $inputs): \Illuminate\Testing\TestResponse
    {
        return $this->actingAs($u)->postJson('/api/analysis-cache', [
            'site_id' => $site->id,
            'run_id' => 'r-'.uniqid(),
            'analyzed_at' => now()->toIso8601String(),
            'metrics' => $this->metrics(),
            'computed' => [],
            'inputs' => $inputs,
        ]);
    }

    /** The mark, out of the SAVED ROW. */
    private function markInTheRow(): ?array
    {
        $row = AnalysisResult::query()->latest('id')->first();
        $this->assertNotNull($row, 'no row was filed at all');
        $detail = is_array($row->detail) ? $row->detail : [];
        fwrite(STDOUT, '[gh670]    the saved row says: '
            .json_encode($detail['siteCheck'] ?? null).PHP_EOL);

        return $detail['siteCheck'] ?? null;
    }

    public function test_M1_a_body_that_declares_no_site_is_MARKED_in_the_row(): void
    {
        [$u, $site] = $this->site();
        fwrite(STDOUT, PHP_EOL.'[gh670] M1: a body with no `inputs.site` at all'.PHP_EOL);
        $this->fileRow($u, $site, ['samples' => []])->assertStatus(200);

        $mark = $this->markInTheRow();
        $this->assertNotNull($mark, 'the row was accepted and said nothing about the declaration');
        $this->assertSame('absent', $mark['declaration']);
    }

    public function test_M1_GREEN_NEIGHBOUR_a_declaration_that_agrees_is_not_marked_absent(): void
    {
        // The other side of the same field: if the repair marks everything, this
        // reddens. The two cases differ in one thing — whether `inputs.site` is there.
        [$u, $site] = $this->site();
        fwrite(STDOUT, '[gh670] M1 neighbour: `inputs.site` matches the address'.PHP_EOL);
        $this->fileRow($u, $site, ['site' => $site->id, 'samples' => []])->assertStatus(200);

        $mark = $this->markInTheRow();
        $this->assertNotNull($mark);
        $this->assertSame('matched', $mark['declaration']);
    }

    public function test_M2_a_key_that_resolves_to_nothing_is_NAMED_in_the_row(): void
    {
        [$u, $site] = $this->site();
        fwrite(STDOUT, '[gh670] M2: a sample key that names no row anywhere'.PHP_EOL);
        $this->fileRow($u, $site, ['site' => $site->id,
            'samples' => ['soil' => 'KEY_THAT_NAMES_NOTHING']])->assertStatus(200);

        $mark = $this->markInTheRow();
        $this->assertNotNull($mark);
        $named = array_column($mark['samples']['unresolved'], 'sample');
        $this->assertSame(['KEY_THAT_NAMES_NOTHING'], $named,
            'the key resolved to nothing and left the check in silence');
        // And it is NOT in the checked list, because it was not checked against anything.
        $this->assertSame([], $mark['samples']['checked']);
    }

    public function test_M2_GREEN_NEIGHBOUR_a_key_that_resolves_to_this_sites_sample_is_not_named_unresolved(): void
    {
        [$u, $site] = $this->site();
        $mine = $this->ownSample($site, $u, 'MY_KEY');
        fwrite(STDOUT, '[gh670] M2 neighbour: a key that resolves to this site\'s own sample'.PHP_EOL);
        $this->fileRow($u, $site, ['site' => $site->id, 'samples' => ['soil' => 'MY_KEY']])
            ->assertStatus(200);

        $mark = $this->markInTheRow();
        $this->assertSame([], $mark['samples']['unresolved']);
        $this->assertSame(['MY_KEY'], array_column($mark['samples']['checked'], 'sample'));
        $this->assertNotNull($mine->id);
    }

    public function test_M3b_a_NUMERIC_key_reaches_the_check_and_is_named(): void
    {
        // O-3b, and it is `is_string`, not the coercion. The value below is a JSON
        // NUMBER — printed, so nobody has to take my word that it is not the string
        // `"118"`, which `is_string` would have let through and which would make the
        // mutation miss the guarded path entirely.
        [$u, $site] = $this->site();
        $mine = $this->ownSample($site, $u, null);   // no client_uid: its id is the key
        $numeric = (int) $mine->id;
        fwrite(STDOUT, '[gh670] M3b: the key is '.json_encode($numeric)
            .' and its PHP type is '.gettype($numeric)
            .' | is_string() says '.json_encode(is_string($numeric)).PHP_EOL);

        $this->fileRow($u, $site, ['site' => $site->id, 'samples' => ['soil' => $numeric]])
            ->assertStatus(200);

        $mark = $this->markInTheRow();
        // THE NEIGHBOUR'S POINT, and it is the reviewer's: "accepted" is green in
        // both states, because the filter drops the key silently and the request goes
        // through. So the claim is that the key is NAMED among the checked ones.
        $this->assertSame([(string) $numeric], array_column($mark['samples']['checked'], 'sample'),
            'a numeric key never reached the check');
        $this->assertSame([], $mark['samples']['unresolved']);
    }

    public function test_M3b_the_same_key_as_a_STRING_still_works_so_the_repair_added_a_case_rather_than_moving_one(): void
    {
        [$u, $site] = $this->site();
        $mine = $this->ownSample($site, $u, null);
        fwrite(STDOUT, '[gh670] M3b control: the same id as the string '
            .json_encode((string) $mine->id).PHP_EOL);

        $this->fileRow($u, $site, ['site' => $site->id, 'samples' => ['soil' => (string) $mine->id]])
            ->assertStatus(200);

        $mark = $this->markInTheRow();
        $this->assertSame([(string) $mine->id], array_column($mark['samples']['checked'], 'sample'));
    }

    public function test_a_foreign_sample_is_still_refused_and_the_refusal_is_not_the_mark(): void
    {
        // The two are different things: a refusal is an answer to the caller, the
        // mark is what the row keeps. A repair that turned the refusal into a mark —
        // or the mark into a refusal — would pass one of the cases above and fail here.
        [$u, $site] = $this->site();
        $otherUser = User::factory()->create(['is_admin' => false]);
        $otherAccount = Account::query()->create([
            'owner_user_id' => $otherUser->id, 'display_name' => 'B',
            'created_by_user_id' => $otherUser->id, 'modified_by_user_id' => $otherUser->id,
        ]);
        $otherSite = Site::query()->create([
            'account_id' => $otherAccount->id, 'name' => 'Other', 'slug' => 'other-'.$otherUser->id,
            'site_type' => 'sports',
            'created_by_user_id' => $otherUser->id, 'modified_by_user_id' => $otherUser->id,
        ]);
        $foreign = Sample::query()->create([
            'account_id' => $otherAccount->id, 'site_id' => $otherSite->id, 'sample_type' => 'soil',
            'lab_name' => 'lab', 'lab_ref' => '', 'soil_texture_snapshot' => '',
            'payload' => ['pH' => 6.4], 'client_uid' => 'FOREIGN_KEY',
            'created_by_user_id' => $otherUser->id, 'modified_by_user_id' => $otherUser->id,
        ]);

        $r = $this->fileRow($u, $site, ['site' => $site->id, 'samples' => ['soil' => 'FOREIGN_KEY']]);
        fwrite(STDOUT, '[gh670] a foreign sample: status '.$r->status().PHP_EOL);
        $r->assertStatus(422);
        $this->assertSame(0, AnalysisResult::query()->count(), 'a refused row was filed anyway');
        $this->assertNotNull($foreign->id);
    }
}
