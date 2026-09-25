<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Site;
use App\Models\SiteConfig;
use App\Models\User;
use App\Support\FieldOwners;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * GH-710 (item 3ac) — AN UNDER-CONFIGURED SITE CARRIES NO KEY THE PERSON DID NOT ENTER.
 *
 * The verifiable form is the analyst's, and it took three attempts to get right: "the config does not
 * exist at all" was factually wrong, "a site created and not finished in the wizard" was still about
 * the config's existence rather than its contents. What is wrong is a KEY nobody entered.
 *
 * MEASURED ON THE STAND, read-only: `GH-671 wizard press 021831` has all three location columns NULL
 * and a config of exactly `{"location": {"lat": null, "lon": null, "name": null}}`. Three keys written
 * by the server before the person had entered anything — which is the owner's rule turned inside out:
 * the database is the source, and nothing writes state into it on a person's behalf.
 *
 * WHO WROTE THEM: `FieldOwners::deriveCopies`, which wrote the leaf whatever the column held. A copy
 * of nothing is not a copy.
 */
class Gh710NoKeyTheePersonDidNotEnterTest extends TestCase
{
    use RefreshDatabase;

    /**
     * GH-710 — EVERY RUN OF THIS CLASS NAMES THE FILE IT ACTUALLY EXERCISED.
     *
     * The tail this closes: a red from this class was reported as depending on the order of the
     * run. It does not — seven orders, the declared one and six random seeds, are green, 518 tests
     * each. What it depended on was the MOMENT: `FieldOwners.php` sat mutated in the tree inside an
     * acceptance window (the pre-mutation copy is stamped 23:33 on 24.09.2026), and a run that fell
     * inside that window reddens on exactly the case the mutation was chosen to redden, with
     * exactly this subject, and never again afterwards.
     *
     * A red against a mutated file is correct at the moment it is taken. What was wrong is that its
     * output could not be told from a red against the tree, so the only reading left was "it comes
     * and goes". The fingerprint is printed on green runs as well, because a witness that appears
     * only on failure cannot be compared with anything.
     *
     * The path is taken from the class rather than written here, so moving the file moves this.
     */
    protected function setUp(): void
    {
        parent::setUp();

        $file = (new \ReflectionClass(FieldOwners::class))->getFileName();
        fwrite(STDOUT, PHP_EOL.'[gh710] the subject this run exercised: '.$file
            .' | sha1 '.sha1_file($file)
            .' | '.filesize($file).' bytes'
            .' | last written '.date('Y-m-d H:i:s', filemtime($file)).PHP_EOL);
    }

    public function test_a_site_whose_coordinates_are_empty_gets_no_location_key_at_all(): void
    {
        // The measured defect, reproduced through the route the wizard uses: it sends the place in a
        // `PATCH sites/{id}` of its own, and an unfinished wizard sends it empty.
        [$user, $site] = $this->site();

        $this->patchSite($user, $site, ['latitude' => null, 'longitude' => null, 'location_name' => null])
            ->assertOk();

        $config = $this->config($site);
        fwrite(STDOUT, PHP_EOL.'[gh710] after a write with empty coordinates, the config is: '
            .json_encode($config).PHP_EOL);

        // THE FORM: not one key the person did not enter.
        $this->assertSame([], $config, 'the server wrote keys of its own into a config nobody filled');
        $this->assertArrayNotHasKey('location', $config);
    }

    public function test_real_coordinates_still_arrive_as_copies__the_positive_control(): void
    {
        /**
         * Without this the case above would be satisfied by a copy mechanism that had stopped
         * working. The copies exist for the legacy hub form, which reads them.
         */
        [$user, $site] = $this->site();

        $this->patchSite($user, $site, [
            'latitude' => -37.81, 'longitude' => 144.96, 'location_name' => 'Melbourne',
        ])->assertOk();

        $config = $this->config($site);
        fwrite(STDOUT, '[gh710] after a write with real coordinates: '.json_encode($config).PHP_EOL);

        $this->assertSame(-37.81, (float) $config['location']['lat']);
        $this->assertSame(144.96, (float) $config['location']['lon']);
        $this->assertSame('Melbourne', $config['location']['name']);
    }

    public function test_a_value_a_person_clears_removes_the_copy_rather_than_leaving_it_standing(): void
    {
        /**
         * The other half, and it is a different fault: writing no null is right, and leaving an old
         * copy behind when the column is emptied would be the stale-copy class — a config saying a
         * site is in Melbourne after the person has removed Melbourne from it.
         */
        [$user, $site] = $this->site();
        $this->patchSite($user, $site, [
            'latitude' => -37.81, 'longitude' => 144.96, 'location_name' => 'Melbourne',
        ])->assertOk();
        $this->assertSame('Melbourne', $this->config($site)['location']['name']);

        $this->patchSite($user, $site, ['location_name' => null])->assertOk();
        $config = $this->config($site);
        fwrite(STDOUT, '[gh710] after the name was cleared: '.json_encode($config).PHP_EOL);

        $this->assertArrayNotHasKey('name', $config['location'] ?? []);
        // And what the person did NOT clear is untouched.
        $this->assertSame(-37.81, (float) $config['location']['lat']);
    }

    public function test_the_derivation_itself_writes_no_null__every_copied_field_by_name(): void
    {
        /**
         * One case per copied field, from `FieldOwners::COPIED` rather than from a list written here,
         * so a field added to the table brings its own case. This asks the derivation directly: the
         * route cases above go through it, and this one pins the rule without them.
         */
        // The list comes from the table's own accessor, not from the constant (it is private) and not
        // from a list written here: a field added to the table brings its own case.
        $copied = FieldOwners::derivedCopies();
        fwrite(STDOUT, '[gh710] the copied fields ('.count($copied).'): '.json_encode($copied).PHP_EOL);
        $this->assertGreaterThan(1, count($copied), 'the table is empty and every case here is vacuous');

        foreach ($copied as $field) {
            $column = FieldOwners::OWNERS[$field] ?? null;
            $this->assertNotNull($column, $field.' is copied and has no owning column');

            $withNull = FieldOwners::deriveCopies([], [$column => null]);
            /**
             * A REAL VALUE OF WHICHEVER KIND THE COLUMN TAKES, and the kind is not guessed here.
             * The first version of this case fed the string `'something'` to every column, and the
             * copy of a coordinate came back empty because the cast rejects a non-number — so the
             * case failed on a value of mine rather than on the rule. Both kinds are offered and one
             * of them must arrive; which one is printed.
             */
            $asNumber = FieldOwners::deriveCopies([], [$column => -37.81]);
            $asText = FieldOwners::deriveCopies([], [$column => 'Melbourne']);
            fwrite(STDOUT, '[gh710]   '.str_pad($field, 16).' null -> '.json_encode($withNull)
                .'  | as a number -> '.json_encode($asNumber)
                .'  | as text -> '.json_encode($asText).PHP_EOL);

            $this->assertSame([], $withNull, $field.': a null column wrote a key anyway');
            $this->assertTrue($asNumber !== [] || $asText !== [],
                $field.': no value of either kind was copied, so this case cannot tell a null from a value');
        }
    }

    private function patchSite(User $user, Site $site, array $body)
    {
        return $this->actingAs($user->fresh())
            ->withSession(['_token' => 'gh710'])
            ->patchJson('/api/sites/'.$site->id, array_merge(['_token' => 'gh710'], $body));
    }

    private function config(Site $site): array
    {
        $row = SiteConfig::query()->where('site_id', $site->id)->where('namespace', 'gaip')->first();

        return is_array($row?->config) ? $row->config : [];
    }

    /** @return array{0:User,1:Site} */
    private function site(): array
    {
        $user = User::factory()->create(['is_admin' => false]);
        $account = Account::query()->firstOrCreate(
            ['owner_user_id' => $user->id],
            ['display_name' => $user->name, 'created_by_user_id' => $user->id, 'modified_by_user_id' => $user->id]
        );
        $site = Site::query()->create([
            'account_id' => $account->id, 'name' => 'Unfinished',
            'slug' => 'unfinished-'.substr((string) $user->id, -6),
            'site_type' => 'sports', 'timezone' => 'UTC', 'provisional_name' => 1,
            'created_by_user_id' => $user->id, 'modified_by_user_id' => $user->id,
        ]);
        $site->users()->attach($user->id, ['role' => 'manager']);
        $user->forceFill(['last_active_site_id' => $site->id])->save();

        return [$user->fresh(), $site];
    }
}
