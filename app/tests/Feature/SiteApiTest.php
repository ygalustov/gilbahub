<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Sample;
use App\Models\Site;
use App\Models\SiteConfig;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class SiteApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_authenticated_user_can_list_their_sites(): void
    {
        $user = User::factory()->create();
        $site = $this->createSiteForUser($user, [
            'name' => 'Default Site',
            'slug' => 'default-site',
            'timezone' => 'Australia/Sydney',
        ]);
        SiteConfig::query()->create([
            'site_id' => $site->id,
            'namespace' => 'gaip',
            'config' => ['status' => 'ready_for_wp_liftout'],
            'synced_at' => now(),
        ]);

        $user->forceFill(['last_active_site_id' => $site->id])->save();

        $this->actingAs($user)
            ->getJson('/api/sites')
            ->assertOk()
            ->assertJsonPath('active_site_id', $site->id)
            ->assertJsonPath('data.0.name', 'Default Site')
            ->assertJsonPath('data.0.configs.gaip.config.status', 'ready_for_wp_liftout');
    }

    public function test_authenticated_user_can_create_site(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->withSession(['_token' => 'test-token'])
            ->postJson('/api/sites', [
                '_token' => 'test-token',
                'name' => 'Training Ground',
                'location_name' => 'Sydney, NSW',
                'timezone' => 'Australia/Sydney',
                'latitude' => -33.8688,
                'longitude' => 151.2093,
            ])
            ->assertCreated()
            ->assertJsonPath('data.name', 'Training Ground')
            ->assertJsonPath('data.configs.gaip.config', []);

        $site = Site::query()->where('name', 'Training Ground')->firstOrFail();

        $this->assertSame($site->id, $user->refresh()->last_active_site_id);
        $this->assertDatabaseHas('sites', [
            'id' => $site->id,
            'name' => 'Training Ground',
            'slug' => 'training-ground',
        ]);
        $this->assertDatabaseHas('accounts', [
            'owner_user_id' => $user->id,
        ]);
        $this->assertDatabaseHas('site_user', [
            'site_id' => $site->id,
            'user_id' => $user->id,
            'role' => 'owner',
        ]);
    }

    public function test_authenticated_user_can_update_site(): void
    {
        $user = User::factory()->create();
        $site = $this->createSiteForUser($user, [
            'name' => 'Default Site',
            'slug' => 'default-site',
        ]);

        $this->actingAs($user)
            ->withSession(['_token' => 'test-token'])
            ->patchJson('/api/sites/'.$site->id, [
                '_token' => 'test-token',
                'name' => 'Updated Site',
                'location_name' => 'Melbourne, VIC',
                'timezone' => 'Australia/Melbourne',
            ])
            ->assertOk()
            ->assertJsonPath('data.name', 'Updated Site')
            ->assertJsonPath('data.location_name', 'Melbourne, VIC');

        $this->assertDatabaseHas('sites', [
            'id' => $site->id,
            'name' => 'Updated Site',
            'slug' => 'updated-site',
        ]);
    }

    public function test_authenticated_user_can_sync_legacy_site_registry_ids(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->withSession(['_token' => 'test-token'])
            ->postJson('/api/sites/sync', [
                '_token' => 'test-token',
                'sites' => [
                    'federal_golf_club_greens' => [
                        'label' => 'Federal Golf Club',
                    ],
                ],
            ])
            ->assertOk()
            ->assertJsonPath('data.saved', 1);

        $this->assertDatabaseHas('sites', [
            'id' => 'federal_golf_club_greens',
            'name' => 'Federal Golf Club',
        ]);
        $this->assertDatabaseHas('site_user', [
            'site_id' => 'federal_golf_club_greens',
            'user_id' => $user->id,
            'role' => 'owner',
        ]);
        $this->assertDatabaseHas('site_configs', [
            'site_id' => 'federal_golf_club_greens',
            'namespace' => 'gaip',
        ]);
    }

    public function test_authenticated_user_can_set_active_site(): void
    {
        $user = User::factory()->create();
        $siteA = $this->createSiteForUser($user, ['name' => 'Site A', 'slug' => 'site-a']);
        $siteB = $this->createSiteForUser($user, ['name' => 'Site B', 'slug' => 'site-b']);

        $this->actingAs($user)
            ->withSession(['_token' => 'test-token'])
            ->patchJson('/api/active-site', [
                '_token' => 'test-token',
                'site_id' => $siteB->id,
            ])
            ->assertOk()
            ->assertJsonPath('active_site_id', $siteB->id)
            ->assertJsonPath('data.name', 'Site B');

        $this->assertSame($siteB->id, $user->refresh()->last_active_site_id);
    }

    public function test_authenticated_user_can_update_site_config(): void
    {
        $user = User::factory()->create();
        $site = $this->createSiteForUser($user, [
            'name' => 'Default Site',
            'slug' => 'default-site',
        ]);

        $this->actingAs($user)
            ->withSession(['_token' => 'test-token'])
            ->putJson('/api/sites/'.$site->id.'/config/gaip', [
                '_token' => 'test-token',
                'config' => [
                    'turf' => ['species' => 'couch'],
                ],
            ])
            ->assertOk()
            ->assertJsonPath('data.config.turf.species', 'couch');

        $this->assertDatabaseHas('site_configs', [
            'site_id' => $site->id,
            'namespace' => 'gaip',
        ]);
    }

    public function test_authenticated_user_can_store_and_list_samples(): void
    {
        $user = User::factory()->create();
        $site = $this->createSiteForUser($user, [
            'name' => 'North Precinct',
            'slug' => 'north-precinct',
            'methodology_override' => 'ammonium-acetate',
            'soil_texture_override' => 'sand',
        ]);

        $storeResponse = $this->actingAs($user)
            ->withSession(['_token' => 'test-token'])
            ->postJson('/api/samples', [
                '_token' => 'test-token',
                'site_id' => $site->id,
                'sample_type' => 'soil',
                'client_uid' => 'green_1',
                'lab_name' => 'Hill Labs',
                'lab_ref' => 'HL-123',
                'sample_date' => '2026-04-20',
                'lab_date' => '2026-04-24',
                'depth_mm' => 75,
                'notes' => 'Imported from latest report.',
                'payload' => [
                    'label' => 'Green 1',
                    'zone' => 'green',
                    'pH_water' => 6.1,
                    'K' => 45,
                ],
            ])
            ->assertCreated()
            ->assertJsonPath('data.site_id', $site->id)
            ->assertJsonPath('data.sample_type', 'soil')
            ->assertJsonPath('data.client_uid', 'green_1')
            ->assertJsonPath('data.methodology_snapshot', 'ammonium-acetate')
            ->assertJsonPath('data.soil_texture_snapshot', 'sand')
            ->assertJsonPath('data.payload.label', 'Green 1');

        $sampleId = $storeResponse->json('data.id');

        $this->assertDatabaseHas('samples', [
            'id' => $sampleId,
            'site_id' => $site->id,
            'sample_type' => 'soil',
            'client_uid' => 'green_1',
            'methodology_snapshot' => 'ammonium-acetate',
            'soil_texture_snapshot' => 'sand',
        ]);

        $this->assertDatabaseHas('site_summaries', [
            'site_id' => $site->id,
            'sample_type' => 'soil',
            'source_sample_id' => $sampleId,
        ]);

        $this->assertStringStartsWith(
            '2026-04-24',
            (string) DB::table('site_summaries')->where('source_sample_id', $sampleId)->value('lab_date')
        );

        $this->actingAs($user)
            ->getJson('/api/samples?site_id='.$site->id.'&sample_type=soil')
            ->assertOk()
            ->assertJsonPath('data.0.id', $sampleId)
            ->assertJsonPath('data.0.payload.K', 45);

        $this->actingAs($user)
            ->getJson('/api/samples/'.$sampleId)
            ->assertOk()
            ->assertJsonPath('data.id', $sampleId)
            ->assertJsonPath('data.payload.zone', 'green');
    }

    public function test_authenticated_user_can_sync_samples_snapshot(): void
    {
        $user = User::factory()->create();
        $site = $this->createSiteForUser($user, [
            'name' => 'Sync Site',
            'slug' => 'sync-site',
            'methodology_override' => 'mlsn',
        ]);

        $this->actingAs($user)
            ->withSession(['_token' => 'test-token'])
            ->postJson('/api/samples/sync', [
                '_token' => 'test-token',
                'allSites' => [
                    $site->id => [
                        'soil' => [
                            'green_1' => [
                                'id' => 'green_1',
                                'label' => 'Green 1',
                                'date' => '2026-04-25',
                                'notes' => 'Synced from browser persistence.',
                                'zoneType' => 'green',
                                'rawData' => [
                                    'label' => 'Green 1',
                                    'zone' => 'green',
                                    'pH' => 6.0,
                                    'K' => 41,
                                ],
                            ],
                        ],
                        'water' => [],
                        'tissue' => [],
                        'loi' => [],
                    ],
                ],
            ])
            ->assertOk()
            ->assertJsonPath('data.synced', 1);

        $this->assertDatabaseHas('samples', [
            'site_id' => $site->id,
            'sample_type' => 'soil',
            'client_uid' => 'green_1',
            'notes' => 'Synced from browser persistence.',
        ]);

        $this->actingAs($user)
            ->getJson('/api/samples?site_id='.$site->id.'&sample_type=soil')
            ->assertOk()
            ->assertJsonPath('data.0.client_uid', 'green_1')
            ->assertJsonPath('data.0.payload.K', 41);
    }


    public function test_authenticated_user_sync_reconciles_deleted_samples(): void
    {
        $user = User::factory()->create();
        $site = $this->createSiteForUser($user, [
            'name' => 'Reconcile Site',
            'slug' => 'reconcile-site',
        ]);

        $this->actingAs($user)
            ->withSession(['_token' => 'test-token'])
            ->postJson('/api/samples/sync', [
                '_token' => 'test-token',
                'allSites' => [
                    $site->id => [
                        'soil' => [
                            'green_1' => [
                                'id' => 'green_1',
                                'date' => '2026-04-25',
                                'rawData' => [
                                    'label' => 'Green 1',
                                    'zone' => 'green',
                                    'K' => 41,
                                ],
                            ],
                            'green_2' => [
                                'id' => 'green_2',
                                'date' => '2026-04-26',
                                'rawData' => [
                                    'label' => 'Green 2',
                                    'zone' => 'green',
                                    'K' => 39,
                                ],
                            ],
                        ],
                        'water' => [],
                        'tissue' => [],
                        'loi' => [],
                    ],
                ],
            ])
            ->assertOk()
            ->assertJsonPath('data.synced', 2)
            ->assertJsonPath('data.deleted', 0);

        $green2Id = Sample::query()->where('site_id', $site->id)->where('client_uid', 'green_2')->value('id');
        $this->assertNotNull($green2Id);

        $this->actingAs($user)
            ->withSession(['_token' => 'test-token'])
            ->postJson('/api/samples/sync', [
                '_token' => 'test-token',
                'allSites' => [
                    $site->id => [
                        'soil' => [
                            'green_1' => [
                                'id' => 'green_1',
                                'date' => '2026-04-27',
                                'rawData' => [
                                    'label' => 'Green 1',
                                    'zone' => 'green',
                                    'K' => 44,
                                ],
                            ],
                        ],
                        'water' => [],
                        'tissue' => [],
                        'loi' => [],
                    ],
                ],
            ])
            ->assertOk()
            ->assertJsonPath('data.synced', 1)
            ->assertJsonPath('data.deleted', 1);

        $this->assertSame(1, Sample::query()->where('site_id', $site->id)->where('sample_type', 'soil')->count());
        $this->assertSoftDeleted('samples', [
            'id' => $green2Id,
            'client_uid' => 'green_2',
        ]);
        $this->assertSoftDeleted('site_summaries', [
            'source_sample_id' => $green2Id,
        ]);

        $this->actingAs($user)
            ->getJson('/api/samples?site_id='.$site->id.'&sample_type=soil')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.client_uid', 'green_1')
            ->assertJsonPath('data.0.payload.K', 44);
    }

    public function test_authenticated_user_sync_can_restore_soft_deleted_sample(): void
    {
        $user = User::factory()->create();
        $site = $this->createSiteForUser($user, [
            'name' => 'Restore Site',
            'slug' => 'restore-site',
        ]);

        $this->actingAs($user)
            ->withSession(['_token' => 'test-token'])
            ->postJson('/api/samples/sync', [
                '_token' => 'test-token',
                'allSites' => [
                    $site->id => [
                        'soil' => [
                            'green_1' => [
                                'id' => 'green_1',
                                'date' => '2026-04-25',
                                'rawData' => [
                                    'label' => 'Green 1',
                                    'zone' => 'green',
                                    'K' => 41,
                                ],
                            ],
                        ],
                        'water' => [],
                        'tissue' => [],
                        'loi' => [],
                    ],
                ],
            ])
            ->assertOk();

        $sampleId = Sample::query()->where('site_id', $site->id)->where('client_uid', 'green_1')->value('id');
        $this->assertNotNull($sampleId);

        $this->actingAs($user)
            ->withSession(['_token' => 'test-token'])
            ->postJson('/api/samples/sync', [
                '_token' => 'test-token',
                'allSites' => [
                    $site->id => [
                        'soil' => [],
                        'water' => [],
                        'tissue' => [],
                        'loi' => [],
                    ],
                ],
            ])
            ->assertOk()
            ->assertJsonPath('data.deleted', 1);

        $this->assertSoftDeleted('samples', ['id' => $sampleId]);

        $this->actingAs($user)
            ->withSession(['_token' => 'test-token'])
            ->postJson('/api/samples/sync', [
                '_token' => 'test-token',
                'allSites' => [
                    $site->id => [
                        'soil' => [
                            'green_1' => [
                                'id' => 'green_1',
                                'date' => '2026-04-28',
                                'rawData' => [
                                    'label' => 'Green 1',
                                    'zone' => 'green',
                                    'K' => 47,
                                ],
                            ],
                        ],
                        'water' => [],
                        'tissue' => [],
                        'loi' => [],
                    ],
                ],
            ])
            ->assertOk()
            ->assertJsonPath('data.synced', 1)
            ->assertJsonPath('data.deleted', 0);

        $this->assertSame(1, Sample::query()->where('site_id', $site->id)->where('client_uid', 'green_1')->count());
        $this->assertDatabaseHas('samples', [
            'id' => $sampleId,
            'client_uid' => 'green_1',
        ]);

        $this->actingAs($user)
            ->getJson('/api/samples?site_id='.$site->id.'&sample_type=soil')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $sampleId)
            ->assertJsonPath('data.0.payload.K', 47);
    }

    public function test_authenticated_user_can_list_site_summaries(): void
    {
        $user = User::factory()->create();
        $site = $this->createSiteForUser($user, [
            'name' => 'Summary Site',
            'slug' => 'summary-site',
        ]);

        $sample = Sample::query()->create([
            'account_id' => $site->account_id,
            'site_id' => $site->id,
            'sample_type' => 'water',
            'lab_name' => 'SWEP',
            'lab_ref' => 'W-1',
            'sample_date' => '2026-04-01',
            'lab_date' => '2026-04-02',
            'methodology_snapshot' => 'mlsn',
            'soil_texture_snapshot' => 'loam',
            'payload' => ['label' => 'Dam 1', 'EC' => 0.82],
            'created_by_user_id' => $user->id,
            'modified_by_user_id' => $user->id,
        ]);

        DB::table('site_summaries')->insert([
            'account_id' => $site->account_id,
            'site_id' => $site->id,
            'sample_type' => 'water',
            'lab_date' => '2026-04-02',
            'methodology_snapshot' => 'mlsn',
            'summary' => json_encode([
                'sample_id' => $sample->id,
                'label' => 'Dam 1',
                'payload' => ['EC' => 0.82],
            ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            'source_sample_id' => $sample->id,
            'created_by_user_id' => $user->id,
            'modified_by_user_id' => $user->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->actingAs($user)
            ->getJson('/api/site-summaries?site_id='.$site->id.'&sample_type=water')
            ->assertOk()
            ->assertJsonPath('data.0.site_id', $site->id)
            ->assertJsonPath('data.0.sample_type', 'water')
            ->assertJsonPath('data.0.summary.label', 'Dam 1')
            ->assertJsonPath('data.0.summary.payload.EC', 0.82);
    }

    public function test_authenticated_user_can_create_spray_log_entry(): void
    {
        $user = User::factory()->create();
        $site = $this->createSiteForUser($user, [
            'name' => 'Default Site',
            'slug' => 'default-site',
        ]);

        $this->actingAs($user)
            ->withSession(['_token' => 'test-token'])
            ->postJson('/api/spray-log', [
                '_token' => 'test-token',
                'site_id' => $site->id,
                'zone' => 'greens',
                'application_date' => '2026-04-28',
                'product_name' => 'Banner Maxx',
                'product_category' => 'fungicide',
                'rate' => 2.5,
                'rate_unit' => 'L/ha',
                'target' => 'Dollar Spot',
                'notes' => 'Evening application.',
                'source' => 'manual',
            ])
            ->assertCreated()
            ->assertJsonPath('data.site_id', $site->id)
            ->assertJsonPath('data.product_name', 'Banner Maxx')
            ->assertJsonPath('data.target', 'Dollar Spot');

        $this->assertSame(1, DB::table('spray_logs')->count());
        $this->assertDatabaseHas('spray_logs', [
            'site_id' => $site->id,
            'user_id' => $user->id,
            'product_name' => 'Banner Maxx',
            'product_type' => 'fungicide',
            'zone' => 'greens',
        ]);
    }

    public function test_authenticated_user_can_list_spray_log_entries(): void
    {
        $user = User::factory()->create();
        $site = $this->createSiteForUser($user, [
            'name' => 'Default Site',
            'slug' => 'default-site',
        ]);

        DB::table('spray_logs')->insert([
            [
                'account_id' => $site->account_id,
                'site_id' => $site->id,
                'user_id' => $user->id,
                'event_date' => '2026-04-28',
                'zone' => 'greens',
                'product_name' => 'Banner Maxx',
                'product_type' => 'fungicide',
                'rate_value' => 2.5,
                'rate_unit' => 'L/ha',
                'target' => 'Dollar Spot',
                'notes' => 'Evening application.',
                'source' => 'manual',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'account_id' => $site->account_id,
                'site_id' => $site->id,
                'user_id' => $user->id,
                'event_date' => '2026-04-12',
                'zone' => 'tees',
                'product_name' => 'Primo Maxx',
                'product_type' => 'pgr',
                'rate_value' => 0.8,
                'rate_unit' => 'L/ha',
                'target' => null,
                'notes' => null,
                'source' => 'manual',
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        $this->actingAs($user)
            ->getJson('/api/spray-log?site_id='.$site->id.'&date_from=2026-04-20&date_to=2026-04-30&limit=50')
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonCount(1, 'entries')
            ->assertJsonPath('entries.0.product_name', 'Banner Maxx')
            ->assertJsonPath('entries.0.product_category', 'fungicide')
            ->assertJsonPath('entries.0.application_date', '2026-04-28');
    }

    public function test_authenticated_user_can_fetch_spray_log_context_and_summary(): void
    {
        $user = User::factory()->create();
        $site = $this->createSiteForUser($user, [
            'name' => 'Default Site',
            'slug' => 'default-site',
        ]);

        DB::table('spray_logs')->insert([
            [
                'account_id' => $site->account_id,
                'site_id' => $site->id,
                'user_id' => $user->id,
                'event_date' => now()->subDays(7)->toDateString(),
                'zone' => 'greens',
                'product_name' => 'Primo Maxx',
                'product_type' => 'pgr',
                'active_ingredient' => 'trinexapac-ethyl',
                'rate_value' => 0.8,
                'rate_unit' => 'L/ha',
                'target' => null,
                'notes' => null,
                'source' => 'manual',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'account_id' => $site->account_id,
                'site_id' => $site->id,
                'user_id' => $user->id,
                'event_date' => now()->subDays(3)->toDateString(),
                'zone' => 'greens',
                'product_name' => 'Banner Maxx',
                'product_type' => 'fungicide',
                'active_ingredient' => 'propiconazole',
                'rate_value' => 1.2,
                'rate_unit' => 'L/ha',
                'target' => 'Dollar Spot',
                'notes' => 'Main green.',
                'source' => 'manual',
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        $this->actingAs($user)
            ->getJson('/api/spray-log/context?site_id='.$site->id.'&zone=greens&days=90')
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('lastPGR.product_name', 'Primo Maxx')
            ->assertJsonPath('lastFungicide.product_name', 'Banner Maxx')
            ->assertJsonPath('dmiApplications.0.frac_group', '3')
            ->assertJsonPath('recentApplications.0.product_name', 'Banner Maxx');

        $this->actingAs($user)
            ->getJson('/api/spray-log/summary?site_id='.$site->id.'&zone=greens&months=12')
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('fracCounts.3', 1)
            ->assertJsonPath('totalEntries', 2);
    }

    public function test_authenticated_user_can_delete_spray_log_entry(): void
    {
        $user = User::factory()->create();
        $site = $this->createSiteForUser($user, [
            'name' => 'Default Site',
            'slug' => 'default-site',
        ]);

        $logId = DB::table('spray_logs')->insertGetId([
            'account_id' => $site->account_id,
            'site_id' => $site->id,
            'user_id' => $user->id,
            'event_date' => '2026-04-28',
            'zone' => 'greens',
            'product_name' => 'Banner Maxx',
            'product_type' => 'fungicide',
            'active_ingredient' => 'propiconazole',
            'rate_value' => 2.5,
            'rate_unit' => 'L/ha',
            'target' => 'Dollar Spot',
            'notes' => 'Evening application.',
            'source' => 'manual',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->actingAs($user)
            ->withSession(['_token' => 'test-token'])
            ->deleteJson('/api/spray-log/'.$logId, [
                '_token' => 'test-token',
            ])
            ->assertOk()
            ->assertJsonPath('success', true);

        $this->assertDatabaseMissing('spray_logs', [
            'id' => $logId,
        ]);
    }

    public function test_authenticated_user_can_upload_media(): void
    {
        Storage::fake('local');
        $user = User::factory()->create();

        $this->actingAs($user)
            ->withSession(['_token' => 'test-token'])
            ->post('/api/media', [
                '_token' => 'test-token',
                'title' => 'Disease Note',
                'file' => UploadedFile::fake()->image('disease-note.jpg'),
            ])
            ->assertCreated()
            ->assertJsonPath('title.rendered', 'Disease Note');

        $this->assertSame(1, DB::table('media_uploads')->count());

        $path = DB::table('media_uploads')->value('path');

        Storage::disk('local')->assertExists($path);
    }

    public function test_authenticated_user_gets_explicit_lab_parser_message_for_spreadsheets(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->withSession(['_token' => 'test-token'])
            ->post('/api/lab-reports/parse', [
                '_token' => 'test-token',
                'lab_report' => UploadedFile::fake()->create('results.csv', 8, 'text/csv'),
            ])
            ->assertStatus(422)
            ->assertJsonPath('success', false)
            ->assertJsonPath('data.code', 'local_spreadsheet_import');
    }

    public function test_authenticated_user_gets_explicit_lab_parser_message_for_documents(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->withSession(['_token' => 'test-token'])
            ->post('/api/lab-reports/parse', [
                '_token' => 'test-token',
                'lab_report' => UploadedFile::fake()->create('results.pdf', 24, 'application/pdf'),
            ])
            ->assertStatus(501)
            ->assertJsonPath('success', false)
            ->assertJsonPath('data.code', 'lab_report_parser_unavailable');
    }

    public function test_authenticated_user_can_store_and_list_pending_predictions(): void
    {
        $user = User::factory()->create();
        $site = $this->createSiteForUser($user, [
            'name' => 'Prediction Site',
            'slug' => 'prediction-site',
        ]);

        $this->actingAs($user)
            ->withSession(['_token' => 'test-token'])
            ->postJson('/api/predictions', [
                '_token' => 'test-token',
                'predictions' => [[
                    'site_id' => $site->id,
                    'cascade_id' => 'cascade-123',
                    'module' => 'disease',
                    'sub_key' => 'dollar_spot_risk',
                    'predicted_label' => 'Dollar Spot Risk',
                    'prediction_type' => 'probability',
                    'predicted_value' => 0.72,
                    'predicted_category' => 'high',
                    'confidence' => 0.84,
                    'predicted_at' => '2026-04-30T09:00:00Z',
                    'outcome_window_start' => '2026-05-03T00:00:00Z',
                    'outcome_window_end' => '2026-05-07T00:00:00Z',
                    'input_snapshot' => [
                        'location' => ['lat' => -35.3, 'lon' => 149.1],
                    ],
                ]],
            ])
            ->assertCreated()
            ->assertJsonPath('success', true)
            ->assertJsonPath('written', 1);

        $predictionId = DB::table('predictions')->value('id');

        $this->assertDatabaseHas('predictions', [
            'id' => $predictionId,
            'user_id' => $user->id,
            'site_identifier' => $site->id,
            'module' => 'disease',
            'sub_key' => 'dollar_spot_risk',
            'status' => 'pending',
        ]);

        $this->actingAs($user)
            ->getJson('/api/predictions/pending/'.$site->id)
            ->assertOk()
            ->assertJsonPath('count', 1)
            ->assertJsonPath('pending.0.id', $predictionId)
            ->assertJsonPath('pending.0.module', 'disease')
            ->assertJsonPath('pending.0.sub_key', 'dollar_spot_risk')
            ->assertJsonPath('pending.0.predicted_label', 'Dollar Spot Risk');
    }

    public function test_authenticated_user_can_capture_prediction_outcome(): void
    {
        $user = User::factory()->create();

        $predictionId = DB::table('predictions')->insertGetId([
            'user_id' => $user->id,
            'site_identifier' => 'site-abc',
            'cascade_id' => 'cascade-456',
            'module' => 'soil',
            'sub_key' => 'k_rate',
            'predicted_label' => 'Potassium Rate',
            'prediction_type' => 'numeric',
            'predicted_value' => json_encode(35),
            'predicted_category' => null,
            'confidence' => 0.91,
            'predicted_at' => now(),
            'outcome_window_start' => now()->addDays(28),
            'outcome_window_end' => now()->addDays(42),
            'input_snapshot' => json_encode(['soil' => ['K' => 45]], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            'status' => 'pending',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->actingAs($user)
            ->withSession(['_token' => 'test-token'])
            ->postJson('/api/outcomes', [
                '_token' => 'test-token',
                'prediction_id' => $predictionId,
                'qualitative' => 'as_expected',
                'action_taken' => 'followed',
                'action_notes' => 'Applied as planned.',
            ])
            ->assertCreated()
            ->assertJsonPath('success', true);

        $this->assertDatabaseHas('prediction_outcomes', [
            'prediction_id' => $predictionId,
            'user_id' => $user->id,
            'qualitative' => 'as_expected',
            'action_taken' => 'followed',
        ]);

        $this->assertDatabaseHas('predictions', [
            'id' => $predictionId,
            'status' => 'resolved',
        ]);

        $this->actingAs($user)
            ->postJson('/api/outcomes', [
                '_token' => 'test-token',
                'prediction_id' => $predictionId,
                'qualitative' => 'worse_than_expected',
            ])
            ->assertStatus(409);
    }

    public function test_authenticated_user_can_proxy_hydrosight_requests_via_laravel_api(): void
    {
        Http::fake([
            'https://api.hydrosight.au/*' => function ($request) {
                $this->assertSame('hydro-key', $request->header('x-api-key')[0] ?? null);
                $this->assertSame('https://api.hydrosight.au/v1/sensors?locationId=abc123', (string) $request->url());

                return Http::response([
                    'items' => [
                        ['sensorId' => 'sensor-1', 'name' => 'Green 1'],
                    ],
                ]);
            },
        ]);

        $user = User::factory()->create();

        $this->actingAs($user)
            ->withSession(['_token' => 'test-token'])
            ->postJson('/api/sensors/hydrosight/proxy', [
                '_token' => 'test-token',
                'endpoint' => '/sensors?locationId=abc123',
                'api_key' => 'hydro-key',
            ])
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.items.0.sensorId', 'sensor-1');
    }

    public function test_authenticated_user_can_proxy_specconnect_requests_via_laravel_api(): void
    {
        Http::fake([
            'https://api.specconnect.net:6703/*' => function ($request) {
                $this->assertSame(
                    'https://api.specconnect.net:6703/api/Customer/GetFSCollections?customerApiKey=spec-key',
                    (string) $request->url()
                );

                return Http::response([
                    ['CollectionId' => 'greens', 'Name' => 'Greens'],
                ]);
            },
        ]);

        $user = User::factory()->create();

        $this->actingAs($user)
            ->withSession(['_token' => 'test-token'])
            ->postJson('/api/sensors/specconnect/proxy', [
                '_token' => 'test-token',
                'endpoint' => '/api/Customer/GetFSCollections?customerApiKey={key}',
                'api_key' => 'spec-key',
            ])
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.0.CollectionId', 'greens');
    }

    public function test_authenticated_user_can_check_alerts_via_laravel_api(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)
            ->withSession(['_token' => 'test-token'])
            ->postJson('/api/alerts/check', [
                '_token' => 'test-token',
                'site_id' => 'site-123',
                'site_name' => 'North Green',
                'quiet_hours' => false,
                'contacts' => [
                    ['type' => 'email', 'value' => 'super@example.com', 'alerts' => ['disease', 'stress']],
                ],
                'results' => [
                    'disease' => [
                        'overallScore' => 82,
                        'topThreats' => [
                            ['displayName' => 'Dollar Spot', 'riskScore' => 84],
                        ],
                    ],
                    'stress' => [
                        'summary' => [
                            'currentScore' => 76,
                            'stressLevel' => 'high',
                        ],
                    ],
                ],
            ])
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('fired.0.type', 'disease')
            ->assertJsonPath('fired.0.channel', 'email');

        $this->assertCount(2, $response->json('fired'));
    }

    public function test_authenticated_user_can_request_alert_test_via_laravel_api(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->withSession(['_token' => 'test-token'])
            ->postJson('/api/alerts/test', [
                '_token' => 'test-token',
                'type' => 'email',
                'value' => 'super@example.com',
            ])
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('mode', 'logged');

        $this->actingAs($user)
            ->withSession(['_token' => 'test-token'])
            ->postJson('/api/alerts/test', [
                '_token' => 'test-token',
                'type' => 'sms',
                'value' => 'bad-number',
            ])
            ->assertStatus(422);
    }

    public function test_authenticated_user_can_fetch_benchmark_payload_via_laravel_api(): void
    {
        $user = User::factory()->create();

        $predictionA = DB::table('predictions')->insertGetId([
            'user_id' => $user->id,
            'site_identifier' => 'site-bench',
            'cascade_id' => 'cascade-1',
            'module' => 'disease',
            'sub_key' => 'dollar_spot_risk',
            'predicted_label' => 'Dollar Spot Risk',
            'prediction_type' => 'probability',
            'predicted_value' => json_encode(0.74),
            'predicted_category' => 'high',
            'confidence' => 0.84,
            'predicted_at' => now()->subDays(4),
            'outcome_window_start' => now()->subDays(2),
            'outcome_window_end' => now()->addDay(),
            'input_snapshot' => json_encode(['x' => 1], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            'status' => 'resolved',
            'resolved_at' => now()->subDay(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('prediction_outcomes')->insert([
            'prediction_id' => $predictionA,
            'user_id' => $user->id,
            'qualitative' => 'as_expected',
            'action_taken' => 'followed',
            'action_notes' => 'As planned.',
            'observed_at' => now()->subDay(),
            'payload' => json_encode(['qualitative' => 'as_expected'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('predictions')->insert([
            'user_id' => $user->id,
            'site_identifier' => 'site-bench',
            'cascade_id' => 'cascade-2',
            'module' => 'disease',
            'sub_key' => 'dollar_spot_risk',
            'predicted_label' => 'Dollar Spot Risk',
            'prediction_type' => 'probability',
            'predicted_value' => json_encode(0.81),
            'predicted_category' => 'high',
            'confidence' => 0.79,
            'predicted_at' => now()->subDays(1),
            'outcome_window_start' => now(),
            'outcome_window_end' => now()->addDays(3),
            'input_snapshot' => json_encode(['x' => 2], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            'status' => 'pending',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->actingAs($user)
            ->getJson('/api/benchmark/site-bench?module=disease&limit=50&days=90')
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('counts.outcomes', 1)
            ->assertJsonPath('counts.pending', 1)
            ->assertJsonPath('outcomes.0.sub_key', 'dollar_spot_risk')
            ->assertJsonPath('outcomes.0.qualitative', 'as_expected')
            ->assertJsonPath('pending.0.status', 'pending')
            ->assertJsonPath('accuracy.dollar_spot_risk.total', 1)
            ->assertJsonPath('accuracy.dollar_spot_risk.accuracy_pct', 100);
    }


    public function test_authenticated_user_can_store_field_log_entry(): void
    {
        $user = User::factory()->create();
        $site = $this->createSiteForUser($user, [
            'name' => 'Field Site',
            'slug' => 'field-site',
        ]);

        $this->actingAs($user)
            ->withSession(['_token' => 'test-token'])
            ->postJson('/api/field-log/entries', [
                '_token' => 'test-token',
                'client_uid' => 'obs-1',
                'site_id' => $site->id,
                'type' => 'disease',
                'zone' => 'green-1',
                'observed_at' => '2026-04-29T08:15:00+10:00',
                'data' => [
                    'date' => '2026-04-29',
                    'disease_type' => 'Dollar Spot',
                    'severity' => 'medium',
                    'notes' => 'Morning walk-through.',
                ],
                'photo' => [
                    'attachmentId' => null,
                    'base64' => 'data:image/jpeg;base64,abc123',
                ],
            ])
            ->assertCreated()
            ->assertJsonPath('data.client_uid', 'obs-1')
            ->assertJsonPath('data.type', 'disease')
            ->assertJsonPath('data.zone', 'green-1')
            ->assertJsonPath('data.payload.data.disease_type', 'Dollar Spot');

        $this->assertDatabaseHas('field_log_entries', [
            'site_id' => $site->id,
            'user_id' => $user->id,
            'client_uid' => 'obs-1',
            'entry_type' => 'disease',
            'zone' => 'green-1',
        ]);
    }

    public function test_authenticated_user_can_upsert_field_log_entry_by_client_uid(): void
    {
        $user = User::factory()->create();
        $site = $this->createSiteForUser($user, [
            'name' => 'Field Site',
            'slug' => 'field-site',
        ]);

        $this->actingAs($user)
            ->withSession(['_token' => 'test-token'])
            ->postJson('/api/field-log/entries', [
                '_token' => 'test-token',
                'client_uid' => 'obs-queue-1',
                'site_id' => $site->id,
                'type' => 'note',
                'zone' => 'tee',
                'data' => ['date' => '2026-04-29', 'notes' => 'First save'],
            ])
            ->assertCreated();

        $this->actingAs($user)
            ->withSession(['_token' => 'test-token'])
            ->postJson('/api/field-log/entries', [
                '_token' => 'test-token',
                'client_uid' => 'obs-queue-1',
                'site_id' => $site->id,
                'type' => 'note',
                'zone' => 'approach',
                'data' => ['date' => '2026-04-29', 'notes' => 'Updated save'],
            ])
            ->assertOk()
            ->assertJsonPath('data.zone', 'approach')
            ->assertJsonPath('data.payload.data.notes', 'Updated save');

        $this->assertSame(1, DB::table('field_log_entries')->where('user_id', $user->id)->where('client_uid', 'obs-queue-1')->count());
        $this->assertDatabaseHas('field_log_entries', [
            'site_id' => $site->id,
            'user_id' => $user->id,
            'client_uid' => 'obs-queue-1',
            'zone' => 'approach',
        ]);
    }


    public function test_authenticated_user_can_list_field_log_entries(): void
    {
        $user = User::factory()->create();
        $site = $this->createSiteForUser($user, [
            'name' => 'Field Site',
            'slug' => 'field-site',
        ]);

        DB::table('field_log_entries')->insert([
            [
                'account_id' => $site->account_id,
                'site_id' => $site->id,
                'user_id' => $user->id,
                'client_uid' => 'obs-a',
                'entry_type' => 'note',
                'zone' => 'green',
                'observed_at' => '2026-04-29 09:00:00',
                'payload' => json_encode(['data' => ['notes' => 'Later note'], 'photo' => null], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                'synced_at' => now(),
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'account_id' => $site->account_id,
                'site_id' => $site->id,
                'user_id' => $user->id,
                'client_uid' => 'obs-b',
                'entry_type' => 'disease',
                'zone' => 'tee',
                'observed_at' => '2026-04-29 08:00:00',
                'payload' => json_encode(['data' => ['disease_type' => 'Dollar Spot'], 'photo' => null], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                'synced_at' => now(),
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        $this->actingAs($user)
            ->getJson('/api/field-log/entries?site_id='.$site->id.'&limit=20')
            ->assertOk()
            ->assertJsonPath('data.0.client_uid', 'obs-a')
            ->assertJsonPath('data.0.data.notes', 'Later note')
            ->assertJsonPath('data.1.client_uid', 'obs-b')
            ->assertJsonPath('data.1.data.disease_type', 'Dollar Spot');
    }

    public function test_authenticated_user_can_use_legacy_ajax_geocode_search(): void
    {
        Http::fake([
            'https://geocoding-api.open-meteo.com/*' => Http::response([
                'results' => [[
                    'name' => 'Sydney',
                    'admin1' => 'New South Wales',
                    'country' => 'Australia',
                    'latitude' => -33.8688,
                    'longitude' => 151.2093,
                ]],
            ]),
        ]);

        $user = User::factory()->create();

        $this->actingAs($user)
            ->withSession(['_token' => 'test-token'])
            ->post('/api/ajax', [
                'action' => 'gilba_geocode_search',
                'address' => 'Sydney',
                'nonce' => 'test-token',
            ])
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.0.display_name', 'Sydney, New South Wales, Australia')
            ->assertJsonPath('data.0.lat', -33.8688)
            ->assertJsonPath('data.0.lon', 151.2093);
    }

    public function test_authenticated_user_can_save_location_via_legacy_ajax(): void
    {
        $user = User::factory()->create();
        $siteA = $this->createSiteForUser($user, [
            'name' => 'Default Site',
            'slug' => 'default-site',
        ]);
        $siteB = $this->createSiteForUser($user, [
            'name' => 'Test Site',
            'slug' => 'test-site',
        ]);
        $user->forceFill(['last_active_site_id' => $siteA->id])->save();

        $this->actingAs($user)
            ->withSession(['_token' => 'test-token'])
            ->post('/api/ajax', [
                'action' => 'gilba_save_location',
                'site_id' => $siteB->id,
                'lat' => -33.8688,
                'lon' => 151.2093,
                'name' => 'Sydney Olympic Park',
                'nonce' => 'test-token',
            ])
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.saved', true)
            ->assertJsonPath('data.site_id', $siteB->id)
            ->assertJsonPath('data.name', 'Sydney Olympic Park');

        $this->assertDatabaseHas('sites', [
            'id' => $siteB->id,
            'location_name' => 'Sydney Olympic Park',
        ]);

        $this->assertDatabaseHas('site_configs', [
            'site_id' => $siteB->id,
            'namespace' => 'gaip',
        ]);

        $config = SiteConfig::query()->where('site_id', $siteB->id)->where('namespace', 'gaip')->firstOrFail();

        $this->assertSame('Sydney Olympic Park', $config->config['location']['name'] ?? null);
        $this->assertSame($siteB->id, $user->refresh()->last_active_site_id);
    }

    public function test_authenticated_user_can_save_and_load_stadium_venue_profiles_via_legacy_ajax(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->withSession(['_token' => 'test-token'])
            ->post('/api/ajax', [
                'action' => 'gssh_save_venue_profile',
                'nonce' => 'test-token',
                'venue_id' => 'allianz_stadium',
                'turfType' => 'sports',
                'subCategory' => 'football',
                'species' => 'Couch',
                'variety' => 'TifTuf',
                'construction' => 'sand_carpet',
                'overseedSpecies' => 'Perennial Ryegrass',
                'overseedVariety' => 'RPR',
                'percentC3Cover' => 35,
                'venueEnv' => json_encode([
                    'enclosureType' => 'open',
                    'drainageRating' => 0.8,
                ]),
            ])
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.venue_id', 'allianz_stadium')
            ->assertJsonPath('data.profile.species', 'Couch');

        $this->assertDatabaseHas('stadium_venue_profiles', [
            'user_id' => $user->id,
            'venue_id' => 'allianz_stadium',
        ]);

        $this->actingAs($user)
            ->withSession(['_token' => 'test-token'])
            ->post('/api/ajax', [
                'action' => 'gssh_get_venue_profiles',
                'nonce' => 'test-token',
            ])
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.allianz_stadium.species', 'Couch')
            ->assertJsonPath('data.allianz_stadium.variety', 'TifTuf')
            ->assertJsonPath('data.allianz_stadium.venueEnv.enclosureType', 'open');
    }

    public function test_authenticated_user_can_save_and_load_stadium_venue_profiles_via_api(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->withSession(['_token' => 'test-token'])
            ->putJson('/api/stadium/venue-profiles/allianz_stadium', [
                '_token' => 'test-token',
                'turfType' => 'sports',
                'subCategory' => 'football',
                'species' => 'Couch',
                'variety' => 'TifTuf',
                'construction' => 'sand_carpet',
                'overseedSpecies' => 'Perennial Ryegrass',
                'overseedVariety' => 'RPR',
                'percentC3Cover' => 35,
                'venueEnv' => [
                    'enclosureType' => 'open',
                    'drainageRating' => 0.8,
                ],
            ])
            ->assertOk()
            ->assertJsonPath('data.venue_id', 'allianz_stadium')
            ->assertJsonPath('data.profile.species', 'Couch');

        $this->actingAs($user)
            ->getJson('/api/stadium/venue-profiles')
            ->assertOk()
            ->assertJsonPath('data.allianz_stadium.species', 'Couch')
            ->assertJsonPath('data.allianz_stadium.variety', 'TifTuf')
            ->assertJsonPath('data.allianz_stadium.venueEnv.enclosureType', 'open');
    }

    public function test_legacy_site_list_endpoints_use_wordpress_style_response_shape(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->withSession(['_token' => 'test-token'])
            ->postJson('/api/legacy/gilba-sites-save', [
                '_token' => 'test-token',
                'sites' => [
                    'training-ground' => ['label' => 'Training Ground'],
                ],
            ])
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.saved', 1);

        $site = Site::query()->where('slug', 'training-ground')->firstOrFail();

        $this->assertSame($site->id, $user->refresh()->last_active_site_id);
        $this->assertDatabaseHas('site_user', [
            'site_id' => $site->id,
            'user_id' => $user->id,
            'role' => 'owner',
        ]);

        $response = $this->actingAs($user)
            ->withSession(['_token' => 'test-token'])
            ->postJson('/api/legacy/gilba-sites-load', ['_token' => 'test-token'])
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.count', 1);

        $this->assertSame('Training Ground', $response->json('data.sites')[$site->id]['label'] ?? null);
    }

    public function test_legacy_site_config_endpoints_store_gaip_config_by_site(): void
    {
        $user = User::factory()->create();
        $site = $this->createSiteForUser($user, [
            'name' => 'Default Site',
            'slug' => 'default-site',
        ]);

        $this->actingAs($user)
            ->withSession(['_token' => 'test-token'])
            ->postJson('/api/legacy/gilba-site-configs-save', [
                '_token' => 'test-token',
                'configs' => [
                    (string) $site->id => [
                        'turf' => ['species' => 'couch'],
                        'location' => [
                            'name' => 'Sydney, NSW',
                            'lat' => -33.8688,
                            'lon' => 151.2093,
                            'timezone' => 'Australia/Sydney',
                        ],
                        'pgr' => ['enabled' => true],
                    ],
                ],
            ])
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.saved', 1);

        $this->assertDatabaseHas('sites', [
            'id' => $site->id,
            'location_name' => 'Sydney, NSW',
            'timezone' => 'Australia/Sydney',
        ]);

        $response = $this->actingAs($user)
            ->withSession(['_token' => 'test-token'])
            ->postJson('/api/legacy/gilba-site-configs-load', ['_token' => 'test-token'])
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.count', 1);

        $configs = $response->json('data.configs');
        $this->assertSame('couch', $configs[$site->id]['turf']['species'] ?? null);
        $this->assertSame('Sydney, NSW', $configs[$site->id]['location']['name'] ?? null);
    }

    private function createAccountForUser(User $user): Account
    {
        return Account::query()->firstOrCreate(
            ['owner_user_id' => $user->id],
            [
                'display_name' => $user->name,
                'created_by_user_id' => $user->id,
                'modified_by_user_id' => $user->id,
            ]
        );
    }

    private function createSiteForUser(User $user, array $overrides = []): Site
    {
        $account = $this->createAccountForUser($user);

        $site = Site::query()->create(array_merge([
            'account_id' => $account->id,
            'name' => 'Site '.substr((string) $user->id, -4),
            'slug' => 'site-'.substr((string) $user->id, -4),
            'site_type' => 'precinct',
            'created_by_user_id' => $user->id,
            'modified_by_user_id' => $user->id,
        ], $overrides));

        $site->users()->attach($user->id, ['role' => 'owner']);

        return $site;
    }
}
