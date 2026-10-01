<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Site;
use App\Models\SiteConfig;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * GH-668 (queue item 3ch, promise P-2) — WHOSE CONSTRUCTION THE FRAME RESOLVES.
 *
 * WHY THIS EXISTS AND WHY IT WAS MISSING. GH-664 added a new value to the frame's
 * server render — the resolved construction — and the analyst named the gap in her
 * table 26.3: if that value were taken from the POINTER's config instead of the
 * frame's site, none of M1-M4 would notice, because they all work on one site, and
 * the GH-663 cases would not either, because they are about the config and the
 * samples. The reviewer then applied exactly that mutation and the whole of
 * PHPUnit stayed green — 438 passed — so the class GH-663 closed came back in the
 * same frame wearing a new value.
 *
 * HIS TWO CONDITIONS, AND THE CASES ARE BUILT TO THEM:
 *   - the green neighbour is the SAME ARRANGEMENT on ONE site, not the M1 case:
 *     M1 differs in two things at once and cannot tell "the wrong site was used"
 *     from "something about two sites broke";
 *   - the two sites must differ in their RESOLVED PATHWAY, not merely in the
 *     construction string. A pair with different constructions resolving to the
 *     same pathway would be green whatever the code did.
 *
 * `soil` resolves to `clay` and `sand_profile` to `sand`, which is the pair that
 * satisfies the second condition — asserted below before it is relied on.
 */
class Gh668WhoseConstructionTheFrameResolvesTest extends TestCase
{
    use RefreshDatabase;

    /** @return array{0:User,1:Site,2:Site} */
    private function twoSitesDifferingByPathway(): array
    {
        $user = User::factory()->create(['is_admin' => false]);
        $account = Account::query()->create([
            'owner_user_id' => $user->id, 'display_name' => 'A',
            'created_by_user_id' => $user->id, 'modified_by_user_id' => $user->id,
        ]);
        $make = function (string $name, string $construction) use ($user, $account) {
            // GH-797 (queue item 3ashch): the texture the lock now wants, on the row.
            $site = Site::query()->create($this->columnsThePageLockAccepts() + [
                'account_id' => $account->id, 'name' => $name,
                'slug' => strtolower($name).'-'.substr((string) $user->id, -4),
                'site_type' => 'sports',
                'created_by_user_id' => $user->id, 'modified_by_user_id' => $user->id,
            ]);
            $site->users()->attach($user->id, ['role' => 'manager']);
            SiteConfig::query()->create([
                'site_id' => $site->id, 'namespace' => 'gaip',
                // GH-708: the wizard lock redirects a page whose site has not answered what the
            // calculation needs. The values this fixture cares about are kept; the rest are
            // filled from the inputs list so the page can be drawn at all.
            'config' => $this->configThePageLockAccepts(['turf' => ['construction' => $construction]]),
            ]);

            return $site;
        };
        // The frame's site: sand. The pointer's site: clay. Different PATHWAYS.
        $sand = $make('Sandy', 'sand_profile');
        $clay = $make('Claysite', 'soil');
        $user->forceFill(['last_active_site_id' => $clay->id])->save();

        return [$user->fresh(), $sand, $clay];
    }

    /** What the page handed the run, read out of the rendered script. */
    private function constructionInTheFrame(string $html): ?array
    {
        $at = strpos($html, 'construction:');
        if ($at === false) {
            return null;
        }
        $slice = substr($html, $at + strlen('construction:'), 600);
        $open = strpos($slice, '{');
        if ($open === false) {
            return null;
        }
        $depth = 0;
        for ($i = $open; $i < strlen($slice); $i++) {
            if ($slice[$i] === '{') {
                $depth++;
            } elseif ($slice[$i] === '}') {
                $depth--;
                if ($depth === 0) {
                    return json_decode(substr($slice, $open, $i - $open + 1), true);
                }
            }
        }

        return null;
    }

    public function test_the_premise_the_two_constructions_resolve_to_DIFFERENT_pathways(): void
    {
        // His second condition, asserted rather than assumed: a pair resolving to
        // the same pathway would make the case below green whatever the code did.
        $sand = \App\Support\CalculationInputs::resolveConstruction(
            ['turf' => ['construction' => 'sand_profile']]);
        $clay = \App\Support\CalculationInputs::resolveConstruction(
            ['turf' => ['construction' => 'soil']]);
        fwrite(STDOUT, PHP_EOL.'[gh668] sand_profile resolves to '
            .json_encode($sand['resolves']['structurePathway'] ?? null)
            .', soil resolves to '.json_encode($clay['resolves']['structurePathway'] ?? null).PHP_EOL);

        $this->assertSame('sand', $sand['resolves']['structurePathway']);
        $this->assertSame('clay', $clay['resolves']['structurePathway']);
    }

    public function test_P2_the_frame_resolves_the_construction_of_the_site_it_was_ASKED_FOR(): void
    {
        [$user, $sand, $clay] = $this->twoSitesDifferingByPathway();

        $html = $this->actingAs($user)
            ->get('/hub?rerun=r-1&site='.$sand->id)->assertOk()->getContent();
        $carried = $this->constructionInTheFrame($html);
        fwrite(STDOUT, '[gh668] pointer on '.$clay->name.' (soil/clay), frame asked for '
            .$sand->name.' (sand_profile/sand) -> the frame carries '
            .json_encode($carried).PHP_EOL);

        // POSITIVE CONTROL: the value is on the page at all, or a null below would
        // be a render that never delivered it rather than the wrong site's answer.
        $this->assertNotNull($carried, 'the frame carried no resolved construction');

        $this->assertSame('sand_profile', $carried['value']);
        $this->assertSame('sand', $carried['resolves']['structurePathway']);
    }

    public function test_THE_GREEN_NEIGHBOUR_same_arrangement_on_ONE_site(): void
    {
        // His first condition. The pointer and the parameter name the SAME site, so
        // this differs from the case above in exactly one thing — which site the
        // pointer stands on — and a red there can be attributed to that and nothing
        // else. The M1 case differs in two things and cannot serve.
        [$user, $sand] = $this->twoSitesDifferingByPathway();
        $user->forceFill(['last_active_site_id' => $sand->id])->save();

        $html = $this->actingAs($user->fresh())
            ->get('/hub?rerun=r-2&site='.$sand->id)->assertOk()->getContent();
        $carried = $this->constructionInTheFrame($html);
        fwrite(STDOUT, '[gh668] pointer AND frame both on '.$sand->name
            .' -> the frame carries '.json_encode($carried).PHP_EOL);

        $this->assertNotNull($carried);
        $this->assertSame('sand', $carried['resolves']['structurePathway']);
    }
}
