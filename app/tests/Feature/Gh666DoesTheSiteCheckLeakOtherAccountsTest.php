<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Sample;
use App\Models\Site;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * GH-666 (queue item 3ar, the analyst's form 38.4) — A MEASUREMENT, NOT A REPAIR:
 * DOES THE SITE CHECK ANSWER BEFORE THE RIGHT TO WRITE, AND DOES ITS ANSWER CARRY
 * ANOTHER ACCOUNT'S SITE IDENTIFIER?
 *
 * WHOSE CODE THIS IS. Mine, from GH-663: the server refuses a result row whose
 * samples belong to another site and says which site they belong to. The reviewer
 * asked whether that "which" is a leak, and the analyst wrote the form. It is
 * asked of the test database with its own factories, so the stand is not touched
 * and the state under measurement is built rather than found.
 *
 * THE WHOLE BODY IS PRINTED BEFORE ANY ASSERTION, because three of the five cases
 * differ only in which identifier comes back, and a verdict without the body is
 * indistinguishable from never reaching the check.
 *
 * BOTH OUTCOMES ARE NAMED BEFORE THE RUN, as her form requires:
 *   - cases 1-3 come back `422` carrying a UUID of a site the user cannot see —
 *     the reading is confirmed, the check answers before the right to write, and
 *     it is carried upward with the list;
 *   - they come back `403`, or `422` without that identifier — the reading is
 *     wrong, and what cuts the answer short has to be found.
 */
class Gh666DoesTheSiteCheckLeakOtherAccountsTest extends TestCase
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

    /** @return array{u:User,sa:Site,sb:Site,sc:Site,keyA:string,keyB:string,keyT:string} */
    private function world(): array
    {
        $mk = function (string $name): array {
            $owner = User::factory()->create(['is_admin' => false]);
            $account = Account::query()->create([
                'owner_user_id' => $owner->id, 'display_name' => $name,
                'created_by_user_id' => $owner->id, 'modified_by_user_id' => $owner->id,
            ]);
            $site = Site::query()->create([
                'account_id' => $account->id, 'name' => 'S'.$name,
                'slug' => strtolower('s'.$name).'-'.$owner->id, 'site_type' => 'sports',
                'created_by_user_id' => $owner->id, 'modified_by_user_id' => $owner->id,
            ]);
            $site->users()->attach($owner->id, ['role' => 'manager']);

            return [$owner, $account, $site];
        };
        [$oa, $aa, $sa] = $mk('A');
        [$ob, $ab, $sb] = $mk('B');
        [$oc, $ac, $sc] = $mk('C');

        $sample = function (Site $site, int $account, string $key, bool $deleted = false) use ($oa) {
            $s = Sample::query()->create([
                'account_id' => $account, 'site_id' => $site->id, 'sample_type' => 'soil',
                'lab_name' => 'lab', 'lab_ref' => '', 'soil_texture_snapshot' => '',
                'payload' => ['pH' => 6.1], 'client_uid' => $key,
                'created_by_user_id' => $oa->id, 'modified_by_user_id' => $oa->id,
            ]);
            if ($deleted) {
                $s->delete();
            }

            return $s;
        };
        $sample($sa, $aa->id, 'KEY_A');
        $sample($sb, $ab->id, 'KEY_B');
        $sample($sb, $ab->id, 'KEY_T', true);

        // U — not an admin, `manager` on SA only. This is the user every case acts as.
        $u = User::factory()->create(['is_admin' => false]);
        $sa->users()->attach($u->id, ['role' => 'manager']);

        return ['u' => $u->fresh(), 'sa' => $sa, 'sb' => $sb, 'sc' => $sc,
            'keyA' => 'KEY_A', 'keyB' => 'KEY_B', 'keyT' => 'KEY_T'];
    }

    private function fileRow(User $u, Site $site, ?string $sampleKey): \Illuminate\Testing\TestResponse
    {
        return $this->actingAs($u)->postJson('/api/analysis-cache', [
            'site_id' => $site->id,
            'run_id' => 'r-'.uniqid(),
            'analyzed_at' => now()->toIso8601String(),
            'metrics' => $this->metrics(),
            'computed' => [],
            'inputs' => $sampleKey === null ? ['samples' => []] : ['samples' => ['soil' => $sampleKey]],
        ]);
    }

    public function test_the_five_cases_of_the_form_with_their_bodies_printed(): void
    {
        $w = $this->world();
        $say = function (string $label, \Illuminate\Testing\TestResponse $r) use ($w) {
            fwrite(STDOUT, PHP_EOL.'[gh666] '.$label.PHP_EOL
                .'[gh666]    status '.$r->status().' body '.$r->getContent().PHP_EOL);
        };
        fwrite(STDOUT, PHP_EOL.'[gh666] SA='.$w['sa']->id.' (U is manager here)'
            .PHP_EOL.'[gh666] SB='.$w['sb']->id.' (another account; U cannot see it)'
            .PHP_EOL.'[gh666] SC='.$w['sc']->id.' (another account; U cannot see it)'.PHP_EOL);

        // 1 — the main one: the right to write exists, the sample does not.
        $one = $this->fileRow($w['u'], $w['sa'], $w['keyB']);
        $say('1. U writes on SA, body carries SB\'s sample KEY_B', $one);

        // 2 — a DELETED sample of B.
        $two = $this->fileRow($w['u'], $w['sa'], $w['keyT']);
        $say('2. U writes on SA, body carries SB\'s DELETED sample KEY_T', $two);

        // 3 — no right to write on SC at all.
        $three = $this->fileRow($w['u'], $w['sc'], $w['keyB']);
        $say('3. U writes on SC (no right) with SB\'s sample KEY_B', $three);

        // 4 — the control: everything is his own.
        $four = $this->fileRow($w['u'], $w['sa'], $w['keyA']);
        $say('4. CONTROL: U writes on SA with his own KEY_A', $four);

        // 5 — his own sample, somebody else's site.
        $five = $this->fileRow($w['u'], $w['sc'], $w['keyA']);
        $say('5. U writes on SC (no right) with his OWN KEY_A', $five);

        // POSITIVE CONTROL FIRST: the lawful write is accepted, or every refusal
        // below could be the endpoint refusing everything.
        $four->assertStatus(200);
        $this->assertStringNotContainsString($w['sb']->id, $four->getContent());

        // THE MEASUREMENT. Stated as what came back rather than as what should:
        // this file is a measurement and the repair is a separate decision.
        $seen = [];
        foreach ([['1', $one, $w['sa']], ['2', $two, $w['sa']], ['3', $three, $w['sc']],
            ['5', $five, $w['sc']]] as [$n, $r, $target]) {
            $body = $r->getContent();
            $seen[$n] = [
                'status' => $r->status(),
                'mentionsSB' => str_contains($body, $w['sb']->id),
                'mentionsSA' => str_contains($body, $w['sa']->id),
                'hasBelongsTo' => str_contains($body, 'belongsTo'),
            ];
        }
        fwrite(STDOUT, '[gh666] what came back: '.json_encode($seen).PHP_EOL);

        // Cases 1-3 must at least REFUSE — whichever way the identifier question
        // comes out, a row carrying another site's sample is not filed.
        $one->assertStatus(422);
        $two->assertStatus(422);
        $this->assertContains($three->status(), [403, 422]);
        $this->assertSame(1, \App\Models\AnalysisResult::query()->count(),
            'only the lawful write should have been filed');
    }
}
