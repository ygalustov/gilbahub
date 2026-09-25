<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Sample;
use App\Models\Site;
use App\Models\User;
use App\Support\AnalysisResultSchema;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * GH-724 (queue item 19) — THE SERVER'S HALF: WHICH TISSUE SAMPLE IT NAMES, AND WHAT `none` MEANS.
 *
 * The client's report is that a tissue sample never reaches the calculation, and the runner's half
 * of the repair is measured in `tests/gh724-the-run-computes-on-the-named-sample.test.js`. This is
 * the other end: the opener asks the server which sample to use, so the answer has to be the
 * server's own rule rather than a second one written for tissue, and the row the run files has to
 * be able to say "this site has none" without that reading as a sample nobody could find.
 *
 * THE TIE IS THE POINT OF THE FIRST CASE. On the stand `Burns` holds two tissue samples dated the
 * same day, 120 and 121, and the rule only decides between them on `id DESC`. A test over samples
 * with different dates would pass whatever the tie-break did.
 */
class Gh724TheRunIsToldWhichTissueSampleTest extends TestCase
{
    use RefreshDatabase;

    public function test_the_server_names_the_newest_tissue_sample_and_breaks_a_tie_on_the_id(): void
    {
        [$user, $site] = $this->siteWithUser();

        $older = $this->tissue($site, '2026-07-01');
        $tieLow = $this->tissue($site, '2026-08-06');
        $tieHigh = $this->tissue($site, '2026-08-06');

        $answer = $this->actingAs($user->fresh())
            ->getJson('/api/samples?sample_type=tissue&site_id='.$site->id.'&limit=1')
            ->assertOk()
            ->json();

        $rows = $answer['data'] ?? $answer['samples'] ?? [];
        fwrite(STDOUT, PHP_EOL.'[gh724] three tissue samples, ids '
            .implode(', ', [$older->id, $tieLow->id, $tieHigh->id])
            .' (the last two share a date); the server names: '
            .json_encode(array_map(static fn ($r) => $r['id'] ?? null, $rows)).PHP_EOL);

        $this->assertCount(1, $rows, 'the opener asks for one and must get one');
        $this->assertSame($tieHigh->id, $rows[0]['id'],
            'the tie between two samples of the same date is broken on the id, as it is for soil');
    }

    public function test_a_site_with_no_tissue_sample_is_answered_with_nothing_rather_than_someone_elses(): void
    {
        [$user, $site] = $this->siteWithUser();
        [, $other] = $this->siteWithUser();
        $this->tissue($other, '2026-08-08');

        $answer = $this->actingAs($user->fresh())
            ->getJson('/api/samples?sample_type=tissue&site_id='.$site->id.'&limit=1')
            ->assertOk()
            ->json();

        $rows = $answer['data'] ?? $answer['samples'] ?? [];
        fwrite(STDOUT, '[gh724] a site with no tissue sample is answered with '
            .count($rows).' rows, while another site holds one'.PHP_EOL);
        $this->assertSame([], $rows);
    }

    public function test_none_is_recorded_as_an_answer_and_is_not_reported_as_a_sample_nobody_could_find(): void
    {
        /**
         * The row says what the run was told about each kind. `none` is a statement that the site
         * has no sample of that kind; left among the identifiers it would be looked up as a key,
         * resolve to no row, and sit in the unresolved list for ever.
         */
        [$user, $site] = $this->siteWithUser();
        $soil = $this->sample($site, 'soil', '2026-08-01');

        $body = [
            'site_id' => $site->id,
            'run_id' => 'gh724-run',
            'analyzed_at' => '2026-09-25T00:00:00Z',
            'inputs' => ['samples' => ['soil' => (string) $soil->id, 'tissue' => 'none']],
            // The complete shape, taken from the declared schema rather than written out here, so
            // a key added to it does not turn this case into a test of a stale list. `null` is a
            // complete value by the producer's own rule (GH-553).
            'metrics' => array_fill_keys(AnalysisResultSchema::requiredMetrics(), null),
            'computed' => [],
        ];

        $response = $this->actingAs($user->fresh())
            ->withSession(['_token' => 'gh724'])
            ->postJson('/api/analysis-cache', array_merge(['_token' => 'gh724'], $body));

        fwrite(STDOUT, '[gh724] a row naming a real soil sample and `none` for tissue answers '
            .$response->status().PHP_EOL);
        $response->assertOk();

        $row = \DB::table('analysis_results')->where('run_id', 'gh724-run')->first();
        $this->assertNotNull($row, 'the row was refused or never written');
        $inputs = json_decode($row->inputs ?? '{}', true);
        fwrite(STDOUT, '[gh724] the row records: '.json_encode($inputs['samples'] ?? null).PHP_EOL);
        $this->assertSame('none', $inputs['samples']['tissue'] ?? null,
            '`none` must survive into the row as the answer it is, not be dropped');

        /**
         * AND THE SERVER'S OWN FINDING ABOUT IT, which is what the repair actually changed: the
         * request is accepted either way, so a case that stops at the status code would not notice
         * the skip being removed. `none` must not be listed as a sample that could not be found,
         * and the real soil id must be listed as one that was looked at -- both halves, or an
         * empty unresolved list would also be satisfied by a check that looked at nothing.
         */
        $detail = json_decode($row->detail ?? '{}', true);
        $check = $detail['siteCheck'] ?? null;
        fwrite(STDOUT, '[gh724] the server\'s own account of the samples: '.json_encode($check).PHP_EOL);
        $this->assertIsArray($check, 'the row carries no site check to read');
        $unresolved = json_encode($check['samples']['unresolved'] ?? []);
        $checked = json_encode($check['samples']['checked'] ?? []);
        $this->assertStringNotContainsString('none', $unresolved,
            '`none` is a stated absence and must not be reported as a sample nobody could find');
        $this->assertStringContainsString((string) $soil->id, $checked,
            'the check looked at nothing, so the assertion above means nothing');
    }

    private function tissue(Site $site, string $date): Sample
    {
        return $this->sample($site, 'tissue', $date);
    }

    private function sample(Site $site, string $type, string $date): Sample
    {
        return Sample::query()->create([
            'account_id' => $site->account_id,
            'site_id' => $site->id,
            'sample_type' => $type,
            'client_uid' => $type.'-'.$date.'-'.uniqid(),
            'sample_date' => $date,
            'payload' => ['zone' => 'Greens'],
            'created_by_user_id' => $site->created_by_user_id,
            'modified_by_user_id' => $site->created_by_user_id,
        ]);
    }

    /** @return array{0:User,1:Site} */
    private function siteWithUser(): array
    {
        $user = User::factory()->create(['is_admin' => false]);
        $account = Account::query()->create([
            'owner_user_id' => $user->id, 'display_name' => $user->name,
            'created_by_user_id' => $user->id, 'modified_by_user_id' => $user->id,
        ]);
        $site = Site::query()->create([
            'account_id' => $account->id, 'name' => 'Tissue site',
            'slug' => 'tissue-'.substr((string) $user->id, -6).'-'.uniqid(),
            'site_type' => 'golf', 'timezone' => 'UTC',
            'created_by_user_id' => $user->id, 'modified_by_user_id' => $user->id,
        ]);
        $site->users()->attach($user->id, ['role' => 'manager']);
        $user->forceFill(['last_active_site_id' => $site->id])->save();
        $this->giveTheSiteWhatTheLockNeeds($site);

        return [$user->fresh(), $site];
    }
}
