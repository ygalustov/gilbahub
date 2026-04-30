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
