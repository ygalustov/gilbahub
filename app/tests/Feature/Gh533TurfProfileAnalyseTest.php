<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Site;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * GH-533 (PLAN-samples-sync-FINAL, stage 2, item 8) — an OBJECT inside a
 * sample payload does not break the server's analysis.
 *
 * Stage 2 makes `payload._turfProfile` a real, routinely present value: the
 * per-sample turf override (b35fix367) used to live only in the browser, and
 * from this stage every PATCH carries it to the server. Everything the payload
 * held until now was a scalar lab reading.
 *
 * The plan called for this to be measured rather than reasoned about. Reading
 * the code, `SampleAnalysisController` takes the payload by named key in every
 * one of its twenty-odd reads — `$payload['CEC']`, `$payload['pH_Water']`,
 * `$payload[$nut]` over a fixed nutrient list — so an extra key with an array
 * value is never reached. That is an argument, and the plan's point is that an
 * argument is not a run: `floatval()` on an array is a TypeError-adjacent
 * warning in PHP 8, and it takes one future `foreach ($payload as ...)` for
 * this route to start returning a 500 on every sample the hub has touched.
 *
 * So the route is called, twice, on payloads that differ only by the object,
 * and the two answers are compared. The comparison is the assertion: it fails
 * both if the object makes the request throw AND if it silently changes a
 * nutrient figure.
 *
 * There was no test for this route at all before this one.
 */
class Gh533TurfProfileAnalyseTest extends TestCase
{
    use RefreshDatabase;

    private const LAB = [
        'pH_Water' => 6.2,
        'CEC'      => 12.4,
        'P'        => 38,
        'K'        => 41,
        'Ca'       => 1180,
        'Mg'       => 160,
        'S'        => 14,
    ];

    private const TURF_PROFILE = [
        'turfType'         => 'golf',
        'subCategory'      => 'greens',
        'species'          => 'bentgrass',
        'variety'          => 'A1/A4',
        'companionSpecies' => 'poa_annua',
    ];

    public function test_analyse_answers_the_same_with_and_without_an_object_in_the_payload(): void
    {
        $user = User::factory()->create();
        $site = $this->createSiteForUser($user);

        // Different lab dates on purpose: two samples sharing one lab_date
        // collide on site_summaries' unique index under SQLite, a test-harness
        // artifact SiteApiTest documents at length and not a product bug. The
        // date is not part of what is being compared.
        $plainId  = $this->createSample($user, $site, 'plain', self::LAB, '2026-05-01');
        $objectId = $this->createSample($user, $site, 'with_profile', self::LAB + [
            '_turfProfile' => self::TURF_PROFILE,
            '_label'       => 'Green 1',
            '_zone'        => 'green',
        ], '2026-05-02');

        $plain = $this->actingAs($user)->getJson('/api/samples/'.$plainId.'/analyse')->assertOk();
        // The request with the object in it answers at all — this is the
        // measurement the plan asked for, and a 500 here is the whole point.
        $object = $this->actingAs($user)->getJson('/api/samples/'.$objectId.'/analyse')->assertOk();

        $strip = function (array $nutrients): array {
            $out = [];
            foreach ($nutrients as $n) {
                $out[$n['nutrient'] ?? $n['key'] ?? ''] = [
                    'value'  => $n['value']  ?? null,
                    'status' => $n['status'] ?? null,
                ];
            }
            ksort($out);

            return $out;
        };

        $plainNutrients  = $strip($plain->json('data.nutrients') ?? []);
        $objectNutrients = $strip($object->json('data.nutrients') ?? []);

        // A comparison of two empty lists would pass while proving nothing, so
        // the list has to have something in it first.
        $this->assertNotEmpty($plainNutrients, 'the control sample produced no nutrients to compare');
        $this->assertSame($plainNutrients, $objectNutrients);

        // The validation pass walks the payload looking for out-of-range
        // readings; the object must not become a warning about itself.
        $this->assertSame(
            $plain->json('data.validation.warnings'),
            $object->json('data.validation.warnings')
        );
        $this->assertSame($plain->json('data.validation.errors'), $object->json('data.validation.errors'));

        // And the object survives the round trip unchanged, which is what
        // stage 2 sends it for.
        $listed = collect(
            $this->actingAs($user)
                ->getJson('/api/samples?site_id='.$site->id.'&sample_type=soil')
                ->assertOk()
                ->json('data')
        )->firstWhere('id', $objectId);
        $this->assertNotNull($listed, 'the sample carrying the object was not listed');
        $this->assertSame(self::TURF_PROFILE, $listed['payload']['_turfProfile']);
    }

    /**
     * GH-533 — the defect the test above walked into, pinned on its own so it
     * cannot go quiet.
     *
     * The test above happens to use a site with no methodology, which is why
     * it found this at all. That is incidental coverage: give that fixture a
     * config one day and the 500 comes back unnoticed. This asserts the case
     * directly, and asserts BOTH halves — that the route answers, and that it
     * does not answer by classifying against MLSN, which is the shortcut the
     * owner's rule of 18.09.2026 forbids.
     */
    public function test_analyse_answers_for_a_site_with_no_methodology_set(): void
    {
        $user = User::factory()->create();
        $site = $this->createSiteForUser($user);

        $id = $this->createSample($user, $site, 'no_method', self::LAB, '2026-06-01');

        $response = $this->actingAs($user)->getJson('/api/samples/'.$id.'/analyse')->assertOk();

        // Not set stays not set: the answer says so rather than naming one.
        $this->assertNull($response->json('data.methodology'));

        $nutrients = collect($response->json('data.nutrients'));
        $this->assertNotEmpty($nutrients);

        $potassium = $nutrients->firstWhere('nutrient', 'K');
        $this->assertNotNull($potassium);

        // The reading is reported ...
        $this->assertSame('41', $potassium['actual']);
        // ... and the classification is not. 'Deficient' is what the MLSN
        // branch returns for K=41 against the 37 threshold times 1.2, and it
        // is exactly the answer that must not appear here.
        $this->assertSame('No methodology set', $potassium['status']);
        $this->assertSame('no-data', $potassium['statusClass']);
        $this->assertArrayNotHasKey('rangeMin', $potassium);

        // Every nutrient with a reading says the same thing; none slipped
        // through into a threshold comparison.
        foreach ($nutrients as $n) {
            if (($n['actual'] ?? null) === null) {
                continue;
            }
            $this->assertSame('No methodology set', $n['status'], 'nutrient '.$n['nutrient']);
        }
    }

    private function createSample(User $user, Site $site, string $uid, array $payload, string $date): string
    {
        return $this->actingAs($user)
            ->withSession(['_token' => 'test-token'])
            ->postJson('/api/samples', [
                '_token'      => 'test-token',
                'site_id'     => $site->id,
                'sample_type' => 'soil',
                'client_uid'  => $uid,
                'sample_date' => $date,
                'lab_date'    => $date,
                'payload'     => $payload,
            ])
            ->assertCreated()
            ->json('data.id');
    }

    private function createSiteForUser(User $user): Site
    {
        $account = Account::query()->firstOrCreate(
            ['owner_user_id' => $user->id],
            [
                'display_name'       => $user->name,
                'created_by_user_id' => $user->id,
                'modified_by_user_id' => $user->id,
            ]
        );

        $site = Site::query()->create([
            'account_id'         => $account->id,
            'name'               => 'Turf Profile Site',
            'slug'               => 'turf-profile-site',
            'site_type'          => 'precinct',
            'created_by_user_id' => $user->id,
            'modified_by_user_id' => $user->id,
        ]);

        $site->users()->attach($user->id, ['role' => 'manager']);

        return $site;
    }
}
