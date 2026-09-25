<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Sample;
use App\Models\Site;
use App\Models\User;
use App\Support\SampleUploadOutcome;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * GH-722 (delivery 3) — THE SETTINGS IMPORT REFUSES A FILE WITH NOTHING RECOGNISED IN
 * IT, BEFORE IT CLEARS ANYTHING, AND SAYS WHAT A FILE CAME TO AS A CLASS WITH NUMBERS.
 *
 * The owner's decisions, 24.09.2026: a file whose readings are not recognised is a problem of the
 * upload and is not loaded; what is recognised is loaded; the import says so in the same words as
 * the Data page upload. The clearing import hard-deletes the site's journals and soft-deletes its
 * samples before it writes, so a refusal that came after the clear would leave the site with neither
 * — the refusal cases therefore assert that NOTHING the site held was touched.
 *
 * Asserted is the CLASS and the NUMBERS, never the sentence: the words of `saved` and `partial` are
 * drafts awaiting the owner. The one text check is that the refusal carries her words, which come
 * from `SampleUploadOutcome` and nowhere else.
 */
class Gh722SettingsImportTest extends TestCase
{
    use RefreshDatabase;

    public function test_a_file_whose_samples_all_carry_a_reading_is_saved_whole(): void
    {
        [$user, $site] = $this->siteWithHistory('imp-saved');

        $res = $this->import($user, $site, [
            'soil' => [
                's1' => $this->sample('Green 1', ['pH_Water' => 6.4, 'K' => 120]),
                's2' => $this->sample('Green 2', ['K_Mehlich3' => '98']),
            ],
            'water' => ['w1' => $this->sample('Bore', ['EC_dSm' => 0.8])],
        ]);

        $res->assertOk()
            ->assertJsonPath('data.outcome.outcome', SampleUploadOutcome::SAVED)
            ->assertJsonPath('data.outcome.rowsRead', 3)
            ->assertJsonPath('data.outcome.rowsSaved', 3)
            ->assertJsonPath('data.outcome.notSaved', []);
        $this->assertSame(3, Sample::query()->where('site_id', $site->id)->count());
    }

    public function test_a_sample_with_no_reading_recognised_is_not_written_and_the_file_is_partial(): void
    {
        [$user, $site] = $this->siteWithHistory('imp-partial');

        $res = $this->import($user, $site, [
            'soil' => [
                's1' => $this->sample('Green 1', ['pH' => 6.1]),
                's2' => $this->sample('Green 2', ['Colour' => 'brown', 'Notes' => 'wet']),
            ],
            'tissue' => ['t1' => $this->sample('Green 1 clip', ['N_Percent' => 4.1])],
        ]);

        $res->assertOk()
            ->assertJsonPath('data.outcome.outcome', SampleUploadOutcome::PARTIAL)
            ->assertJsonPath('data.outcome.rowsRead', 3)
            ->assertJsonPath('data.outcome.rowsSaved', 2)
            ->assertJsonPath('data.outcome.notSaved', [['type' => 'soil', 'label' => 'Green 2', 'reason' => 'no-reading-recognised']]);
        $this->assertDatabaseMissing('samples', ['site_id' => $site->id, 'client_uid' => 's2']);
        $this->assertDatabaseHas('samples', ['site_id' => $site->id, 'client_uid' => 's1', 'deleted_at' => null]);
    }

    public function test_a_file_with_nothing_recognised_is_refused_and_the_site_is_untouched(): void
    {
        [$user, $site, $before] = $this->siteWithHistory('imp-rejected');

        $res = $this->import($user, $site, [
            'soil' => [
                's1' => $this->sample('Green 1', ['Colour' => 'brown']),
                's2' => $this->sample('Green 2', ['_label' => 'Green 2', 'zone' => 'Greens']),
            ],
            'water' => ['w1' => ['id' => 'w1', 'label' => 'Bore']],
        ]);

        $res->assertStatus(422)
            ->assertJsonPath('outcome', SampleUploadOutcome::REJECTED)
            ->assertJsonPath('rowsRead', 3)
            ->assertJsonPath('rowsSaved', 0);
        $this->assertStringStartsWith(SampleUploadOutcome::REJECTED_TEXT, (string) $res->json('message'));
        $this->assertSiteUntouched($site, $before);
    }

    public function test_a_file_with_no_samples_at_all_is_refused_and_the_site_is_untouched(): void
    {
        [$user, $site, $before] = $this->siteWithHistory('imp-empty');

        $this->import($user, $site, ['soil' => [], 'water' => []])
            ->assertStatus(422)
            ->assertJsonPath('outcome', SampleUploadOutcome::REJECTED)
            ->assertJsonPath('rowsRead', 0);
        $this->assertSiteUntouched($site, $before);
    }

    public function test_a_measured_zero_is_a_reading(): void
    {
        [$user, $site] = $this->siteWithHistory('imp-zero');

        $this->import($user, $site, ['soil' => ['s1' => $this->sample('Green 1', ['Na' => 0])]])
            ->assertOk()
            ->assertJsonPath('data.outcome.outcome', SampleUploadOutcome::SAVED);
    }

    public function test_the_ordinary_push_is_not_checked(): void
    {
        // Manual entry and the ordinary push are left unchecked by the owner's decision; only the
        // clearing import is. The other side of the rule, so the refusal cannot be passed by a
        // route that refuses every unreadable sample everywhere.
        [$user, $site] = $this->siteWithHistory('imp-push');

        $this->actingAs($user)->withSession(['_token' => 't'])
            ->postJson('/api/samples/sync', [
                '_token' => 't',
                'allSites' => [$site->id => ['soil' => ['p1' => $this->sample('Green 9', ['Colour' => 'brown'])]]],
            ])
            ->assertOk()
            ->assertJsonPath('data.synced', 1)
            ->assertJsonPath('data.outcome', null);
    }

    /** @return array{0:User,1:Site,2:array<string,int>} */
    private function siteWithHistory(string $slug): array
    {
        $user = User::factory()->create();
        $account = Account::query()->firstOrCreate(
            ['owner_user_id' => $user->id],
            ['display_name' => $user->name, 'created_by_user_id' => $user->id, 'modified_by_user_id' => $user->id]
        );
        $site = Site::query()->create([
            'account_id' => $account->id,
            'name' => $slug,
            'slug' => $slug.'-'.substr((string) $user->id, -4),
            'site_type' => 'precinct',
            'created_by_user_id' => $user->id,
            'modified_by_user_id' => $user->id,
        ]);
        $site->users()->attach($user->id, ['role' => 'manager']);

        Sample::query()->create([
            'account_id' => $site->account_id, 'site_id' => $site->id, 'sample_type' => 'soil',
            'client_uid' => 'old-1', 'lab_date' => '2026-01-01', 'payload' => ['K' => 100],
            'created_by_user_id' => $user->id, 'modified_by_user_id' => $user->id,
        ]);
        DB::table('spray_logs')->insert([
            'account_id' => $site->account_id, 'site_id' => $site->id, 'user_id' => $user->id,
            'event_date' => '2026-07-01', 'product_name' => 'Thing', 'zone' => 'Greens',
            'created_at' => now(), 'updated_at' => now(),
        ]);
        DB::table('field_log_entries')->insert([
            'account_id' => $site->account_id, 'site_id' => $site->id, 'user_id' => $user->id,
            'client_uid' => 'fl-1', 'entry_type' => 'note', 'observed_at' => now(),
            'payload' => json_encode(['text' => 'before']), 'created_at' => now(), 'updated_at' => now(),
        ]);

        return [$user, $site, $this->holdings($site)];
    }

    /** @return array<string,int> */
    private function holdings(Site $site): array
    {
        return [
            'live samples' => Sample::query()->where('site_id', $site->id)->count(),
            'deleted samples' => Sample::query()->onlyTrashed()->where('site_id', $site->id)->count(),
            'spray logs' => DB::table('spray_logs')->where('site_id', $site->id)->count(),
            'field log entries' => DB::table('field_log_entries')->where('site_id', $site->id)->count(),
        ];
    }

    /** @param array<string,int> $before */
    private function assertSiteUntouched(Site $site, array $before): void
    {
        // Positive control: there was something to lose.
        $this->assertSame(['live samples' => 1, 'deleted samples' => 0, 'spray logs' => 1, 'field log entries' => 1], $before);
        $this->assertSame($before, $this->holdings($site));
    }

    private int $day = 0;

    /**
     * Each sample on its own date: under sqlite a second summary of the same date fails the
     * unique key (the stored date carries a time the lookup does not), which is the test base,
     * not this subject.
     *
     * @param array<string,mixed> $rawData
     */
    private function sample(string $label, array $rawData): array
    {
        $this->day++;

        return ['label' => $label, 'date' => sprintf('2026-08-%02d', $this->day), 'rawData' => $rawData];
    }

    /** @param array<string,mixed> $types */
    private function import(User $user, Site $site, array $types)
    {
        foreach ($types as $type => $samples) {
            foreach ($samples as $key => $sample) {
                if (is_array($sample) && ! isset($sample['id'])) {
                    $types[$type][$key]['id'] = $key;
                }
            }
        }

        return $this->actingAs($user)->withSession(['_token' => 't'])
            ->postJson('/api/samples/sync', [
                '_token' => 't',
                'clearSiteData' => true,
                'allSites' => [$site->id => $types],
            ]);
    }
}
