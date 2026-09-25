<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * GH-743 — THE PANEL'S `Details` BLOCK IS FOR AN ADMINISTRATOR; A CLIENT GETS THE SENTENCE AND NOT THE LINES.
 *
 * The owner's decision: the run's own records under the panel are for diagnosis, and only a user of
 * the admin type sees them. In this product that type is `users.is_admin` — what `Gate::before`
 * lets through, what `User::roleOnSite()` answers as `admin`, and what the account page labels
 * "Admin". A site `manager` is not an administrator.
 *
 * Rendered, not read: the partial is compiled with a projection that carries two warnings, once for
 * each kind of reader. The sentence above the block is the neighbour that must stay the same for
 * everybody; the lines must not reach a client's HTML at all, folded or not.
 */
class Gh743DetailsAreForAdministratorsTest extends TestCase
{
    use RefreshDatabase;

    private function projectionWithWarnings(): array
    {
        return [
            'metrics' => ['growthPotential' => 0.5],
            'computed' => ['soilNutrition' => []],
            'analyzedAt' => '2026-09-20T22:10:00.000Z',
            'status' => 'partial',
            'numbersFrom' => 'complete',
            'lastRun' => [
                'runId' => 'r', 'outcome' => 'partial', 'completedAt' => '2026-09-24T06:00:00.000Z',
                'reason' => 'values-not-computed',
                'nulls' => ['soilTemp'], 'skipped' => [], 'assumptions' => [],
                'warnings' => [
                    ['level' => 'problem', 'module' => 'disease', 'message' => 'GAIP_DISEASE_RESULT written, diseases: 8'],
                    ['level' => 'problem', 'module' => 'wear', 'message' => 'recovery windows require defined intent'],
                ],
            ],
            'numbersRun' => ['outcome' => 'complete', 'skipped' => [], 'notApplicable' => [],
                'notes' => [], 'assumptions' => []],
        ];
    }

    /** @return array{details:bool,lines:bool,sentence:string} */
    private function renderFor(?User $user): array
    {
        if ($user) {
            $this->actingAs($user);
        }
        $html = view('partials.analysis-notice', ['analysisCache' => $this->projectionWithWarnings()])->render();
        preg_match('#<span id="db-analysis-notice-text">(.*?)</span>#s', $html, $m);

        return [
            'details' => str_contains($html, 'id="db-analysis-notice-details"'),
            'lines' => str_contains($html, 'GAIP_DISEASE_RESULT') || str_contains($html, 'recovery windows require'),
            'sentence' => trim($m[1] ?? ''),
        ];
    }

    public function test_an_administrator_sees_the_block_with_the_runs_lines(): void
    {
        $admin = User::factory()->create();
        $admin->forceFill(['is_admin' => true])->save();

        $got = $this->renderFor($admin);
        fwrite(STDOUT, PHP_EOL.'[gh743] admin: '.json_encode($got).PHP_EOL);

        $this->assertNotSame('', $got['sentence']);
        $this->assertTrue($got['details']);
        $this->assertTrue($got['lines']);
    }

    public function test_a_site_manager_gets_the_same_sentence_and_no_lines_in_the_html(): void
    {
        $admin = User::factory()->create();
        $admin->forceFill(['is_admin' => true])->save();
        $adminSentence = $this->renderFor($admin)['sentence'];

        $manager = User::factory()->create();
        $manager->forceFill(['is_admin' => false])->save();
        $got = $this->renderFor($manager);
        fwrite(STDOUT, '[gh743] manager: '.json_encode($got).PHP_EOL);

        $this->assertSame($adminSentence, $got['sentence']);
        $this->assertFalse($got['details']);
        $this->assertFalse($got['lines']);
    }

    public function test_nobody_signed_in_gets_no_lines(): void
    {
        $got = $this->renderFor(null);
        fwrite(STDOUT, '[gh743] no user: '.json_encode($got).PHP_EOL);

        $this->assertNotSame('', $got['sentence']);
        $this->assertFalse($got['details']);
        $this->assertFalse($got['lines']);
    }
}
