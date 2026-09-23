<?php

namespace Tests\Feature;

use App\Console\Commands\NormaliseSampleMeasurements;
use App\Models\Account;
use App\Models\Sample;
use App\Models\Site;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * GH-574 — A MEASUREMENT IS STORED AS A NUMBER, AND IT IS FIXED AT THE WRITE.
 *
 * `payload` was validated as an array and stored exactly as the browser sent it,
 * and a form input sends its value as a string. `samples` id 141 on Test5 - NZ
 * holds `K: "40"`, `Ca: "803"`, `CEC: "5.9"`, `pH: "6"`. The MLSN engine
 * multiplies them and throws `e.toFixed is not a function`; the cascade catches
 * it and the site's soil analysis comes back empty. 38 of the 148 rows in the
 * table are in that state.
 *
 * WHY NOT PARSE ON READ: parsing on read is a substitution turned inside out —
 * every reader guessing what the writer meant, forever. The value is wrong in
 * the column, so the column is where it is fixed.
 *
 * HOW THIS FILE BITES: take the normalisation off any one of the three write
 * paths and that path's test goes red with a string where a number belongs.
 */
class Gh574AMeasurementIsStoredAsANumberTest extends TestCase
{
    use RefreshDatabase;

    /** The site's own soil sample, as `samples.payload` held it on the stand. */
    private const AS_THE_FORM_SENDS_IT = [
        'B' => '0.2', 'K' => '40', 'P' => '40', 'S' => '75', 'Ca' => '803',
        'Cu' => '1.3', 'EC' => '0.16', 'Fe' => '168', 'Mg' => '129', 'Mn' => '28.3',
        'OM' => '3.7', 'Zn' => '5.7', 'pH' => '6', 'CEC' => '5.9',
        'zone' => 'Other', '_label' => 'Soccer',
    ];

    public function test_store_writes_measurements_as_numbers(): void
    {
        [$user, $site] = $this->siteFor();

        $this->actingAs($user)
            ->postJson('/api/samples', [
                'site_id'     => $site->id,
                'sample_type' => 'soil',
                'payload'     => self::AS_THE_FORM_SENDS_IT,
            ])
            ->assertSuccessful();

        $payload = Sample::query()->firstOrFail()->payload;

        $this->assertSame(40, $payload['K']);
        $this->assertSame(803, $payload['Ca']);
        $this->assertSame(5.9, $payload['CEC']);
        $this->assertSame(6, $payload['pH']);
        $this->assertSame(0.16, $payload['EC']);
        // and every numeric key, not a handful
        foreach (['B', 'P', 'S', 'Cu', 'Fe', 'Mg', 'Mn', 'OM', 'Zn'] as $key) {
            $this->assertIsNumeric($payload[$key]);
            $this->assertIsNotString($payload[$key], $key.' is still text');
        }
    }

    public function test_words_are_left_alone(): void
    {
        [$user, $site] = $this->siteFor();

        $this->actingAs($user)
            ->postJson('/api/samples', [
                'site_id'     => $site->id,
                'sample_type' => 'soil',
                'payload'     => array_merge(self::AS_THE_FORM_SENDS_IT, [
                    // A label that IS a number, which is the case the key list
                    // exists for: "18" is a green, not a measurement.
                    '_label'  => '18',
                    'zone'    => 'Greens',
                    'Texture' => 'sand',
                    '_source' => '2026',
                    'notes'   => '7',
                ]),
            ])
            ->assertSuccessful();

        $payload = Sample::query()->firstOrFail()->payload;

        $this->assertSame('18', $payload['_label']);
        $this->assertSame('Greens', $payload['zone']);
        $this->assertSame('sand', $payload['Texture']);
        $this->assertSame('2026', $payload['_source']);
        $this->assertSame('7', $payload['notes']);
        // the control: a measurement in the same payload still became a number
        $this->assertSame(40, $payload['K']);
    }

    public function test_a_value_that_is_not_a_number_is_not_made_into_one(): void
    {
        [$user, $site] = $this->siteFor();

        $this->actingAs($user)
            ->postJson('/api/samples', [
                'site_id'     => $site->id,
                'sample_type' => 'soil',
                'payload'     => ['K' => '', 'P' => '  ', 'Ca' => 'not measured', 'Mg' => '12 ppm', 'S' => ' 75 '],
            ])
            ->assertSuccessful();

        $payload = Sample::query()->firstOrFail()->payload;

        // Nothing invented and nothing dropped: what is not a number stays
        // exactly as it arrived.
        $this->assertSame('not measured', $payload['Ca']);
        $this->assertSame('12 ppm', $payload['Mg']);
        // and a number with spaces around it is still a number
        $this->assertSame(75, $payload['S']);

        // An empty value arrives as null, and that is the framework's
        // `TrimStrings` + `ConvertEmptyStringsToNull` on the way in, not
        // anything this fix does — measured here rather than assumed, because
        // "the empty one became null" is exactly the shape a substitution would
        // have. Null is the right answer for a field with no measurement
        // (`no_default_values`); what matters is that nothing filled it.
        $this->assertNull($payload['K']);
        $this->assertNull($payload['P']);
    }

    public function test_update_writes_measurements_as_numbers(): void
    {
        [$user, $site] = $this->siteFor();
        $sample = $this->sampleFor($site, $user, ['K' => 40]);

        $this->actingAs($user)
            ->patchJson('/api/samples/'.$sample->id, [
                'payload' => ['K' => '117.3', 'pH' => '6.5', '_label' => 'Green 1'],
            ])
            ->assertSuccessful();

        $payload = $sample->fresh()->payload;

        $this->assertSame(117.3, $payload['K']);
        $this->assertSame(6.5, $payload['pH']);
        $this->assertSame('Green 1', $payload['_label']);
    }

    public function test_a_nested_block_is_normalised_too(): void
    {
        // Some payloads carry a `ppm` object rather than flat keys.
        [$user, $site] = $this->siteFor();

        $this->actingAs($user)
            ->postJson('/api/samples', [
                'site_id'     => $site->id,
                'sample_type' => 'soil',
                'payload'     => ['ppm' => ['K' => '40', 'Na' => '11.5'], 'pH' => '6'],
            ])
            ->assertSuccessful();

        $payload = Sample::query()->firstOrFail()->payload;

        $this->assertSame(40, $payload['ppm']['K']);
        $this->assertSame(11.5, $payload['ppm']['Na']);
    }

    public function test_the_command_and_the_controller_share_one_rule(): void
    {
        // Two copies of a key list drift, and this one decides whether a value
        // is a word or a measurement. The command's list is public so the
        // controller's can be checked against it.
        $reflection = new \ReflectionClass(\App\Http\Controllers\SampleController::class);
        $controllerKeys = $reflection->getConstant('DESCRIPTIVE_KEYS');

        $this->assertNotFalse($controllerKeys, 'the controller no longer declares the list');
        $this->assertSame(NormaliseSampleMeasurements::DESCRIPTIVE_KEYS, $controllerKeys,
            'the write path and the backfill disagree about what counts as a word');
    }

    public function test_the_backfill_dry_run_changes_nothing_and_names_what_it_would(): void
    {
        [$user, $site] = $this->siteFor();
        $sample = $this->sampleFor($site, $user, self::AS_THE_FORM_SENDS_IT);

        $this->artisan('samples:normalise-measurements --dry-run')
            ->expectsOutputToContain('DRY RUN')
            ->expectsOutputToContain('Nothing was written.')
            ->assertSuccessful();

        // Untouched, and that is the point of the flag.
        $this->assertSame('40', $sample->fresh()->payload['K']);
    }

    public function test_the_backfill_converts_and_leaves_words_alone(): void
    {
        [$user, $site] = $this->siteFor();
        $sample = $this->sampleFor($site, $user, array_merge(self::AS_THE_FORM_SENDS_IT, ['_label' => '18']));

        $this->artisan('samples:normalise-measurements')->assertSuccessful();

        $payload = $sample->fresh()->payload;
        $this->assertSame(40, $payload['K']);
        $this->assertSame(5.9, $payload['CEC']);
        $this->assertSame('18', $payload['_label']);
        $this->assertSame('Other', $payload['zone']);
    }

    public function test_the_backfill_does_not_touch_a_deleted_sample(): void
    {
        // Owner's decision, 22.09.2026: "no, we are not restoring samples." 23
        // of the 38 rows holding text are soft-deleted and every one of them is
        // left alone — the living row beside it is the control, so this is not
        // passing because the command did nothing at all.
        [$user, $site] = $this->siteFor();
        $deleted = $this->sampleFor($site, $user, self::AS_THE_FORM_SENDS_IT);
        $living  = $this->sampleFor($site, $user, self::AS_THE_FORM_SENDS_IT);
        $deleted->delete();

        $this->artisan('samples:normalise-measurements')->assertSuccessful();

        $this->assertSame('40', Sample::withTrashed()->findOrFail($deleted->id)->payload['K'],
            'a deleted sample was rewritten');
        $this->assertSame(40, $living->fresh()->payload['K'],
            'the living sample was not converted — this test would pass for the wrong reason');
    }

    public function test_the_report_shows_the_descriptive_keys_rather_than_promising_them(): void
    {
        // The analyst's point: the header says descriptive keys are not
        // touched, and a header is a promise. The report walks the payloads the
        // run would write and compares each descriptive key with what it was,
        // naming the rows where a key is ABSENT as well — "zone is fine
        // everywhere" and "zone is not there" look identical otherwise.
        [$user, $site] = $this->siteFor();
        $this->sampleFor($site, $user, self::AS_THE_FORM_SENDS_IT);

        $this->artisan('samples:normalise-measurements --dry-run')
            ->expectsOutputToContain('descriptive keys, compared before and after')
            ->expectsOutputToContain('_label     1 unchanged')
            ->expectsOutputToContain('zone       1 unchanged')
            ->expectsOutputToContain('_zone      0 unchanged, absent on 1 row(s)')
            ->assertSuccessful();
    }

    public function test_only_the_type_changes_across_the_whole_range_of_values(): void
    {
        // The condition the backfill runs under, proved over the domain rather
        // than observed on one run: for every shape a lab value takes, the
        // number that comes out is the number that went in.
        $cases = [
            '40', '5.9', '803', '0.2', '1.3', '28.3', '117.3', '0.16', '6',
            '-1.5', '0.000045', '1e3', '1E-4', '  75  ', '0', '0.0', '195.5',
            '99999999999999999999', '0.1234567890123456789',
        ];

        foreach ($cases as $raw) {
            $changed = [];
            $out = NormaliseSampleMeasurements::normalise(['K' => $raw], $changed);

            $this->assertIsNotString($out['K'], $raw.' was not converted');
            $this->assertSame((float) trim($raw), (float) $out['K'], 'value changed for '.$raw);
            // and it survives the trip through the column
            $this->assertSame((float) trim($raw), (float) json_decode(json_encode($out['K'])),
                'value did not survive JSON for '.$raw);
        }
    }

    public function test_a_value_that_would_not_survive_storage_stops_the_run(): void
    {
        // The guard has to be able to fire, or it is a comfort rather than a
        // safeguard. "1e400" is a numeric string, becomes INF, and json_encode
        // refuses it — so the whole run stops instead of writing a row.
        $changed = [];

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('VALUE WOULD NOT SURVIVE STORAGE');

        NormaliseSampleMeasurements::normalise(['K' => '1e400'], $changed);
    }

    public function test_the_guard_stops_the_command_before_it_writes_anything(): void
    {
        // And it stops the COMMAND, not only the helper: a row that cannot be
        // converted must not leave the others half-written.
        [$user, $site] = $this->siteFor();
        $good = $this->sampleFor($site, $user, ['K' => '40']);
        $bad  = $this->sampleFor($site, $user, ['K' => '1e400']);

        try {
            $this->artisan('samples:normalise-measurements')->run();
            $this->fail('the command wrote despite a value that cannot be stored');
        } catch (\RuntimeException $e) {
            $this->assertStringContainsString('VALUE WOULD NOT SURVIVE STORAGE', $e->getMessage());
        }

        $this->assertSame('40', $good->fresh()->payload['K'], 'a row was written before the run stopped');
        $this->assertSame('1e400', $bad->fresh()->payload['K']);
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
            'account_id' => $account->id, 'name' => 'Test5 - NZ', 'slug' => 'test5-nz',
            'site_type' => 'precinct', 'timezone' => 'Pacific/Auckland',
            'created_by_user_id' => $user->id, 'modified_by_user_id' => $user->id,
        ]);
        $site->users()->attach($user->id, ['role' => 'manager']);

        return [$user, $site];
    }

    private function sampleFor(Site $site, User $user, array $payload): Sample
    {
        // Written past the controller on purpose: this is a row in the state the
        // stand's rows are in, from before the write path was fixed.
        return Sample::query()->create([
            'site_id' => $site->id, 'account_id' => $site->account_id,
            'sample_type' => 'soil', 'client_uid' => 'uid-'.uniqid(),
            'payload' => $payload, 'created_by_user_id' => $user->id,
            'modified_by_user_id' => $user->id,
        ]);
    }
}
