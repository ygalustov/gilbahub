<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Site;
use App\Models\SiteConfig;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * GH-807 (queue item 3vya) — A PGR'S TRADE NAME LEADS TO THE RECORD OF THAT PRODUCT.
 *
 * WHAT THE OWNER SAW: an application of "Primo Maxx 120" on `Hoxton Soccer - Kate's test` printed, on
 * the dashboard and on `/plan`, as "Indigo Amigo (TE 120g/L)". The journal stores what a person typed;
 * the server turns that into a catalogue CODE when it answers with the last PGR application, and the two
 * keys for Primo Maxx pointed at `TE120` — the record of Indigo Amigo at the same strength.
 *
 * THIS CASE IS ABOUT THE SERVER'S COPY OF THAT MAP AND NOTHING ELSE, and that is deliberate: there are
 * two copies (the other is `PGR_PRODUCT_MAP` in `spray-log-cascade.js`), and the reviewer's requirement
 * of 02.10.2026 is that each is mutated on its own. So this file reads the ANSWER OF THE ROUTE and
 * cannot see the browser's copy at all; the browser's is held by
 * `tests/gh807-the-pgr-name-comes-from-its-own-record.test.js`. Break the server map and this reddens
 * while that one stays green; break the browser map and the opposite happens. That is how "both are
 * fixed" is told from "one is fixed and the test looks at the other".
 *
 * WHAT THIS CASE DOES NOT TOUCH, named because the delivery must say it: the Word export takes the whole
 * PGR section, the product's name included, from the page's own `GAIP_PGR_RESULT` and not from the
 * stored row — the class of GH-459, carried as queue item 3gt. Nothing here reads that global, so the
 * reviewer's M11 (put another name in it) must leave every case of this hand-in green.
 */
class Gh807ThePgrNameComesFromItsOwnRecordTest extends TestCase
{
    use RefreshDatabase;

    public function test_the_route_answers_primo_maxx_with_the_record_of_primo_maxx(): void
    {
        [$user, $site] = $this->aSite();
        $this->aPgrApplication($site, 'Primo Maxx 120');

        $context = $this->actingAs($user)->getJson('/api/spray-log/context?site_id='.$site->id);

        fwrite(STDOUT, '[gh807] the journal holds the name a person typed: '
            .json_encode(DB::table('spray_logs')->value('product_name'))
            .PHP_EOL.'[gh807] and the route answers the code: '
            .json_encode($context->json('lastPGR.product_key')).PHP_EOL);

        $context->assertStatus(200);
        // The record of the product itself, not of another product of the same strength.
        $this->assertSame('PRIMO_MAXX', $context->json('lastPGR.product_key'));
        // And the stored name is untouched: the journal keeps what the person wrote.
        $this->assertSame('Primo Maxx 120', $context->json('lastPGR.product_name'));
    }

    public function test_the_short_name_leads_to_the_same_record(): void
    {
        [$user, $site] = $this->aSite();
        $this->aPgrApplication($site, 'Primo Maxx');

        $context = $this->actingAs($user)->getJson('/api/spray-log/context?site_id='.$site->id);

        fwrite(STDOUT, '[gh807] "Primo Maxx" answers: '
            .json_encode($context->json('lastPGR.product_key')).PHP_EOL);

        // Both keys of the pair, because the reviewer checks each key and not the pair as a whole.
        $this->assertSame('PRIMO_MAXX', $context->json('lastPGR.product_key'));
    }

    /**
     * THE POSITIVE CONTROLS — the names around the repaired pair, each with why it stays as it is.
     *
     * `Primo 250EC` has a record of its own and always led to it. `Primo Maxx 1EC` is a different
     * formulation with no record of its own, so it keeps the Indigo Amigo record at 175 g/L — a fact
     * about the catalogue, not a mapping this hand-in may change. `Amigo 175` is the same product as
     * that record and reads correctly already.
     */
    public function test_the_names_around_the_pair_answer_exactly_as_they_did(): void
    {
        $answers = [];
        foreach (['Primo 250EC' => 'TE250', 'Primo Maxx 1EC' => 'TE175', 'Amigo 175' => 'TE175',
            'Trinexapac-ethyl' => 'TE250', 'Indigo Amigo 120' => 'TE120'] as $name => $expected) {
            [$user, $site] = $this->aSite();
            $this->aPgrApplication($site, $name);
            $answers[$name] = $this->actingAs($user)
                ->getJson('/api/spray-log/context?site_id='.$site->id)
                ->json('lastPGR.product_key');
        }

        fwrite(STDOUT, '[gh807] the names around the pair: '.json_encode($answers).PHP_EOL);

        $this->assertSame([
            'Primo 250EC' => 'TE250',
            'Primo Maxx 1EC' => 'TE175',
            'Amigo 175' => 'TE175',
            'Trinexapac-ethyl' => 'TE250',
            // And the record the pair used to point at still answers for the product it is about.
            'Indigo Amigo 120' => 'TE120',
        ], $answers);
    }

    public function test_a_name_the_map_does_not_carry_is_answered_with_no_code_at_all(): void
    {
        [$user, $site] = $this->aSite();
        $this->aPgrApplication($site, 'Something nobody declared');

        $context = $this->actingAs($user)->getJson('/api/spray-log/context?site_id='.$site->id);

        fwrite(STDOUT, '[gh807] an undeclared product: '
            .json_encode($context->json('lastPGR.product_key')).PHP_EOL);

        // Null, not a guess: the page then has nothing to show as a record, which is the honest answer.
        $this->assertNull($context->json('lastPGR.product_key'));
    }

    private function aPgrApplication(Site $site, string $productName): void
    {
        DB::table('spray_logs')->insert([
            'account_id' => $site->account_id,
            'site_id' => $site->id,
            'user_id' => $site->created_by_user_id,
            'event_date' => now()->subDays(10)->toDateString(),
            'zone' => 'greens',
            // GH-816: the type the journal's writers give the word `greens` (GH-806); a golf course counts it.
            'zone_type' => 'green',
            'product_name' => $productName,
            'product_type' => 'pgr',
            'active_ingredient' => 'trinexapac-ethyl',
            'operator' => '',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function aSite(): array
    {
        $user = User::factory()->create();
        $account = Account::query()->firstOrCreate(
            ['owner_user_id' => $user->id],
            ['display_name' => $user->name, 'created_by_user_id' => $user->id, 'modified_by_user_id' => $user->id]
        );
        $site = Site::query()->create([
            'account_id' => $account->id,
            'name' => 'GH-807 pgr '.bin2hex(random_bytes(2)),
            'slug' => 'gh807-'.bin2hex(random_bytes(4)),
            'site_type' => 'golf',
            'created_by_user_id' => $user->id,
            'modified_by_user_id' => $user->id,
        ]);
        $site->users()->attach($user->id, ['role' => 'manager']);
        // GH-816: the spray-log context answers by the site's turf type, so the site declares one.
        SiteConfig::query()->create(['site_id' => $site->id, 'namespace' => 'gaip', 'synced_at' => now(),
            'config' => ['turf' => ['turfType' => 'golf']]]);

        return [$user->fresh(), $site];
    }
}
