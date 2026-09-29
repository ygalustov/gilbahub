<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Sample;
use App\Models\Site;
use App\Models\SiteConfig;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * GH-773 - A SAMPLE IS STORED UNDER THE NAMES THE MAP DECLARES, WHICHEVER LAB WROTE THE FILE.
 *
 * The owner's direction of 28.09.2026: the reading called CEC is stored as `CEC`, and it does not
 * matter which laboratory the file came from -- there is recognition, and the recognised name is what
 * is written. Recognition was already on the server and decided only whether to accept a sample; the
 * column names the page had sent were stored as they arrived. Measured before the change: 39 of the
 * 64 samples on the stand hold at least one reading under a non-canonical spelling.
 *
 * THREE PLACES WRITE A SAMPLE, and each is exercised here by its own case, because a rule applied in
 * two of three is the shape this class of defect keeps coming back in: the upload's sync, the sample
 * editor, and `store`.
 *
 * WHAT IS LEFT ALONE, with its own case each, because renaming it would answer a question nobody has
 * answered: a column recognised only after a method suffix was peeled (`pH_CaCl2`) and the phosphorus
 * of a water sample. Two columns answering for one reading were a third such case until the owner
 * decided it on 29.09.2026; that case now holds her answer instead (GH-775).
 *
 * THE EXPECTED KEYS ARE WRITTEN OUT here rather than read from the map. The map is what the code
 * under test consults; taking the answer from it too would let both drift together and still agree.
 */
class Gh773SamplesAreStoredUnderCanonicalNamesTest extends TestCase
{
    use RefreshDatabase;

    /** A soil row as a lab file hands it over: not one of these four is the name it is stored under. */
    private const FROM_A_LAB = [
        'pH_Water' => 5.9,
        'OM_Percent' => 4.2,
        'CEC_meq100g' => 12.5,
        'EC1_5' => 0.31,
        '_label' => 'Green 1',
    ];

    private const UNDER_CANONICAL_NAMES = ['CEC', 'EC', 'OM', '_label', 'pH'];

    public function test_store_writes_the_readings_under_their_canonical_names(): void
    {
        [$user, $site] = $this->site();

        $this->actingAs($user)->postJson('/api/samples', [
            'site_id' => $site->id,
            'sample_type' => 'soil',
            'payload' => self::FROM_A_LAB,
        ])->assertSuccessful();

        $payload = Sample::query()->where('site_id', $site->id)->firstOrFail()->payload;
        $this->printIt('store', $payload);

        $this->assertSame(self::UNDER_CANONICAL_NAMES, $this->keys($payload));
        $this->assertSame(5.9, (float) $payload['pH']);
        $this->assertSame(12.5, (float) $payload['CEC']);
    }

    public function test_the_uploads_sync_writes_the_readings_under_their_canonical_names(): void
    {
        [$user, $site] = $this->site();

        $this->actingAs($user)->postJson('/api/samples/sync', [
            'allSites' => [
                $site->id => ['soil' => ['s1' => ['rawData' => self::FROM_A_LAB]]],
            ],
        ])->assertSuccessful();

        $payload = Sample::query()->where('site_id', $site->id)->firstOrFail()->payload;
        $this->printIt('the upload sync', $payload);

        $this->assertSame(self::UNDER_CANONICAL_NAMES, $this->keys($payload));
        $this->assertSame(0.31, (float) $payload['EC']);
    }

    public function test_the_sample_editor_writes_the_readings_under_their_canonical_names(): void
    {
        [$user, $site] = $this->site();
        $sample = $this->existing($site, $user, ['pH' => 6.0]);

        $this->actingAs($user)->patchJson('/api/samples/'.$sample->id, [
            'payload' => self::FROM_A_LAB,
        ])->assertSuccessful();

        $payload = $sample->fresh()->payload;
        $this->printIt('the sample editor', $payload);

        $this->assertSame(self::UNDER_CANONICAL_NAMES, $this->keys($payload));
        $this->assertSame(4.2, (float) $payload['OM']);
    }

    public function test_a_column_recognised_only_by_peeling_a_method_suffix_keeps_its_own_name(): void
    {
        [$user, $site] = $this->site();

        $this->actingAs($user)->postJson('/api/samples', [
            'site_id' => $site->id,
            'sample_type' => 'soil',
            'payload' => ['pH_Water' => 6.1, 'pH_CaCl2' => 5.4],
        ])->assertSuccessful();

        $payload = Sample::query()->where('site_id', $site->id)->firstOrFail()->payload;
        $this->printIt('a pH measured two ways', $payload);

        // The water pH becomes `pH`; the CaCl2 one is a different measurement and stays as it came.
        $this->assertSame(['pH', 'pH_CaCl2'], $this->keys($payload));
        $this->assertSame(6.1, (float) $payload['pH']);
        $this->assertSame(5.4, (float) $payload['pH_CaCl2']);
    }

    /**
     * TURNED OVER BY THE OWNER'S ANSWER, GH-775. This case held the state of things while nobody had
     * said which of two disagreeing columns to believe: both were kept under their own names. She
     * decided on 29.09.2026 -- take the column the product has always preferred, store nothing else,
     * and say nothing about it: "we will not write that something was not saved".
     *
     * Which one is preferred is not new either. The old hub's `normalizeValues` fills a reading from
     * the first column that answers and skips the rest, "prefer specific column names like K_ppm over
     * K", so `pH_Water` -- declared before `pH` -- is the figure a run has always computed from. The
     * stand's one disagreeing row is `Burns` soil 51, 5.5 beside 6.6, and the calculation used 5.5
     * before this change and uses 5.5 after it.
     */
    public function test_of_two_columns_for_one_reading_the_declared_order_decides_and_the_other_is_dropped(): void
    {
        [$user, $site] = $this->site();

        $this->actingAs($user)->postJson('/api/samples', [
            'site_id' => $site->id,
            'sample_type' => 'soil',
            'payload' => ['pH_Water' => 5.5, 'pH' => 6.6],
        ])->assertSuccessful();

        $payload = Sample::query()->where('site_id', $site->id)->firstOrFail()->payload;
        $this->printIt('two pH columns that disagree', $payload);

        // One reading, one column: the specific spelling wins and the value is the run's own 5.5.
        $this->assertSame(['pH'], $this->keys($payload));
        $this->assertSame(5.5, (float) $payload['pH']);
    }

    public function test_the_phosphorus_of_a_water_sample_keeps_its_own_name(): void
    {
        [$user, $site] = $this->site();

        $this->actingAs($user)->postJson('/api/samples', [
            'site_id' => $site->id,
            'sample_type' => 'water',
            'payload' => ['P' => 0.12, 'EC_dSm' => 0.5],
        ])->assertSuccessful();

        $payload = Sample::query()->where('site_id', $site->id)->firstOrFail()->payload;
        $this->printIt('water phosphorus', $payload);

        // Phosphorus is not phosphate, and the factor between them is nowhere in this code.
        $this->assertSame(['EC', 'P'], $this->keys($payload));
        $this->assertSame(0.12, (float) $payload['P']);
    }

    public function test_a_numeric_column_the_map_does_not_know_is_not_stored(): void
    {
        [$user, $site] = $this->site();

        $this->actingAs($user)->postJson('/api/samples', [
            'site_id' => $site->id,
            'sample_type' => 'soil',
            'payload' => ['pH_Water' => 6.2, 'Widget_ppm' => 3, '_label' => 'Green 2'],
        ])->assertSuccessful();

        $payload = Sample::query()->where('site_id', $site->id)->firstOrFail()->payload;
        $this->printIt('a column nothing declares', $payload);

        // The owner's decision of 24.09: only what is recognised is saved. Measured before the
        // change: no sample on the stand carries a numeric key its own kind does not declare.
        $this->assertSame(['_label', 'pH'], $this->keys($payload));
    }

    /** @param  array<string,mixed>|null  $payload */
    private function printIt(string $where, ?array $payload): void
    {
        fwrite(STDOUT, PHP_EOL.'[gh773] '.$where.' stored: '.json_encode($payload).PHP_EOL);
    }

    /**
     * @param  array<string,mixed>|null  $payload
     * @return array<int,string>
     */
    private function keys(?array $payload): array
    {
        $keys = array_keys($payload ?? []);
        sort($keys);

        return $keys;
    }

    /** @param  array<string,mixed>  $payload */
    private function existing(Site $site, User $user, array $payload): Sample
    {
        return Sample::query()->create([
            'account_id' => $site->account_id, 'site_id' => $site->id, 'user_id' => $user->id,
            'sample_type' => 'soil', 'payload' => $payload, 'sample_date' => now()->toDateString(),
            'created_by_user_id' => $user->id, 'modified_by_user_id' => $user->id,
        ]);
    }

    /** @return array{0:User,1:Site} */
    private function site(): array
    {
        $user = User::factory()->create();
        $account = Account::query()->create([
            'owner_user_id' => $user->id, 'display_name' => $user->name,
            'created_by_user_id' => $user->id, 'modified_by_user_id' => $user->id,
        ]);
        $site = Site::query()->create([
            'account_id' => $account->id, 'name' => 'Canonical Site', 'slug' => 'canonical-'.$user->id,
            'site_type' => 'precinct', 'timezone' => 'UTC',
            'created_by_user_id' => $user->id, 'modified_by_user_id' => $user->id,
        ]);
        $site->users()->attach($user->id, ['role' => 'manager']);
        $user->forceFill(['last_active_site_id' => $site->id])->save();
        SiteConfig::query()->create([
            'site_id' => $site->id, 'namespace' => 'gaip', 'synced_at' => now(),
            'config' => ['turf' => ['methodology' => 'mlsn']],
        ]);
        $this->giveTheSiteWhatTheLockNeeds($site);

        return [$user, $site];
    }
}
