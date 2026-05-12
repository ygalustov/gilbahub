<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LegacyBackendMigrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_authenticated_user_can_request_soil_interpretation_via_laravel_route(): void
    {
        config()->set('services.gilba.claude_api_key', '');

        $user = User::factory()->create();

        $this->actingAs($user)
            ->withSession(['_token' => 'test-token'])
            ->postJson('/api/interpretations/soil', [
                '_token' => 'test-token',
                'soil_output' => [
                    'methodology' => 'mlsn',
                    'ppm' => ['K' => 45, 'P' => 18],
                    'context' => ['turfType' => 'couch'],
                ],
            ])
            ->assertOk()
            ->assertJsonPath('success', false)
            ->assertJsonPath('data.message', 'Interpretation service not configured');
    }

    public function test_authenticated_user_can_render_stadium_shade_via_laravel_route(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->withSession(['_token' => 'test-token'])
            ->postJson('/api/stadium/shade-render', [
                '_token' => 'test-token',
                'venue_id' => 'mcg',
                'date' => '2026-06-21',
                'time' => '12:00',
                'mode' => 'series',
            ])
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJson(fn ($json) => $json->whereType('data.html', 'string')->etc());
    }

    public function test_authenticated_user_can_calculate_stadium_rig_requirements_via_laravel_route(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->withSession(['_token' => 'test-token'])
            ->postJson('/api/stadium/rig-calculate', [
                '_token' => 'test-token',
                'venue_id' => 'mcg',
                'rig_model' => 'sgl_led440',
                'month' => 6,
                'variety' => 'tiftuf',
                'target_dli' => 22,
                'ambient_dli' => 10,
                'target_coverage_pct' => 20,
                'venue_environment' => [
                    'enclosureType' => 'open',
                    'drainageRating' => '7',
                ],
            ])
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJson(fn ($json) => $json
                ->whereType('data.html', 'string')
                ->whereType('data.rig_model', 'string')
                ->etc());
    }

    public function test_authenticated_user_can_generate_stadium_seasonal_plan_via_laravel_route(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->withSession(['_token' => 'test-token'])
            ->postJson('/api/stadium/seasonal-plan', [
                '_token' => 'test-token',
                'venue_id' => 'mcg',
                'rig_model' => 'sgl_led440',
                'currency' => 'AUD',
                'kwh_rate' => 0.30,
            ])
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJson(fn ($json) => $json
                ->whereType('data.html', 'string')
                ->whereType('data.months', 'array')
                ->etc());
    }
}
