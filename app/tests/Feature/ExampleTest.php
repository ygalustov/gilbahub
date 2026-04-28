<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ExampleTest extends TestCase
{
    use RefreshDatabase;

    public function test_root_redirects_to_hub(): void
    {
        $this->get('/')->assertRedirect('/hub');
    }

    public function test_authenticated_user_can_open_field_log_page(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->get('/field-log')
            ->assertOk()
            ->assertSee('id="gaip-field-log"', false)
            ->assertSee('/legacy-assets/gaip-field-log.css', false)
            ->assertSee('/legacy-assets/gaip-field-log.js', false);
    }

    public function test_authenticated_user_can_load_legacy_field_log_asset(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->get('/legacy-assets/gaip-field-log.css')
            ->assertOk();
    }
}
