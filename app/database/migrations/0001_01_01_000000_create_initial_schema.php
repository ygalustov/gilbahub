<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('email')->unique();
            $table->timestamp('email_verified_at')->nullable();
            $table->string('password');
            $table->rememberToken();
            $table->uuid('last_active_site_id')->nullable()->index();
            $table->timestamps();
        });

        Schema::create('accounts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('owner_user_id')->constrained('users')->cascadeOnDelete();
            $table->string('display_name')->default('');
            $table->string('methodology', 32)->default('mlsn');
            $table->string('soil_texture', 32)->default('loam');
            $table->string('country', 2)->default('AU');
            $table->string('region', 64)->default('');
            $table->json('settings_json')->nullable();
            $table->unsignedBigInteger('created_by_user_id')->default(0);
            $table->unsignedBigInteger('modified_by_user_id')->default(0);
            $table->timestamps();
            $table->softDeletes();

            $table->unique('owner_user_id');
        });

        Schema::create('password_reset_tokens', function (Blueprint $table) {
            $table->string('email')->primary();
            $table->string('token');
            $table->timestamp('created_at')->nullable();
        });

        Schema::create('sessions', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->foreignId('user_id')->nullable()->index();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->longText('payload');
            $table->integer('last_activity')->index();
        });

        Schema::create('cache', function (Blueprint $table) {
            $table->string('key')->primary();
            $table->mediumText('value');
            $table->bigInteger('expiration')->index();
        });

        Schema::create('cache_locks', function (Blueprint $table) {
            $table->string('key')->primary();
            $table->string('owner');
            $table->bigInteger('expiration')->index();
        });

        Schema::create('precinct_groups', function (Blueprint $table) {
            $table->id();
            $table->foreignId('account_id')->constrained('accounts')->cascadeOnDelete();
            $table->string('name', 128);
            $table->string('slug', 128);
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->unsignedBigInteger('created_by_user_id')->default(0);
            $table->unsignedBigInteger('modified_by_user_id')->default(0);
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['account_id', 'slug']);
        });

        Schema::create('sites', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('account_id')->constrained('accounts')->cascadeOnDelete();
            $table->foreignId('precinct_group_id')->nullable()->constrained('precinct_groups')->nullOnDelete();
            $table->uuid('parent_site_id')->nullable();
            $table->string('name');
            $table->string('slug')->nullable();
            $table->string('site_type', 32)->default('precinct');
            $table->string('location_name')->nullable();
            $table->decimal('latitude', 10, 7)->nullable();
            $table->decimal('longitude', 10, 7)->nullable();
            $table->string('timezone')->nullable();
            $table->string('methodology_override', 32)->nullable();
            $table->string('soil_texture_override', 32)->nullable();
            $table->json('attributes_json')->nullable();
            $table->unsignedBigInteger('created_by_user_id')->default(0);
            $table->unsignedBigInteger('modified_by_user_id')->default(0);
            $table->timestamps();
            $table->softDeletes();

            $table->index(['account_id', 'site_type']);
            $table->index(['account_id', 'slug']);
            $table->foreign('parent_site_id')->references('id')->on('sites')->nullOnDelete();
        });

        Schema::table('users', function (Blueprint $table) {
            $table->foreign('last_active_site_id')->references('id')->on('sites')->nullOnDelete();
        });

        Schema::create('site_user', function (Blueprint $table) {
            $table->id();
            $table->uuid('site_id');
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('role')->default('manager');
            $table->timestamps();

            $table->foreign('site_id')->references('id')->on('sites')->cascadeOnDelete();
            $table->unique(['site_id', 'user_id']);
            $table->index(['user_id', 'role']);
        });

        Schema::create('site_configs', function (Blueprint $table) {
            $table->id();
            $table->uuid('site_id');
            $table->string('namespace')->default('gaip');
            $table->json('config')->nullable();
            $table->timestamp('synced_at')->nullable();
            $table->timestamps();

            $table->foreign('site_id')->references('id')->on('sites')->cascadeOnDelete();
            $table->unique(['site_id', 'namespace']);
        });

        Schema::create('samples', function (Blueprint $table) {
            $table->id();
            $table->foreignId('account_id')->constrained('accounts')->cascadeOnDelete();
            $table->uuid('site_id');
            $table->string('sample_type', 16);
            $table->string('lab_name', 128)->default('');
            $table->string('lab_ref', 64)->default('');
            $table->date('sample_date')->nullable();
            $table->date('lab_date')->nullable();
            $table->unsignedSmallInteger('depth_mm')->nullable();
            $table->string('methodology_snapshot', 32)->default('');
            $table->string('soil_texture_snapshot', 32)->default('');
            $table->json('payload');
            $table->text('notes')->nullable();
            $table->unsignedBigInteger('created_by_user_id')->default(0);
            $table->unsignedBigInteger('modified_by_user_id')->default(0);
            $table->timestamps();
            $table->softDeletes();

            $table->foreign('site_id')->references('id')->on('sites')->cascadeOnDelete();
            $table->index(['site_id', 'sample_type', 'lab_date']);
            $table->index(['account_id', 'sample_type']);
        });

        Schema::create('site_summaries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('account_id')->constrained('accounts')->cascadeOnDelete();
            $table->uuid('site_id');
            $table->string('sample_type', 16);
            $table->date('lab_date');
            $table->string('methodology_snapshot', 32)->default('');
            $table->json('summary');
            $table->foreignId('source_sample_id')->nullable()->constrained('samples')->nullOnDelete();
            $table->unsignedBigInteger('created_by_user_id')->default(0);
            $table->unsignedBigInteger('modified_by_user_id')->default(0);
            $table->timestamps();
            $table->softDeletes();

            $table->foreign('site_id')->references('id')->on('sites')->cascadeOnDelete();
            $table->unique(['site_id', 'sample_type', 'lab_date']);
            $table->index(['account_id', 'site_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('site_summaries');
        Schema::dropIfExists('samples');
        Schema::dropIfExists('site_configs');
        Schema::dropIfExists('site_user');

        Schema::table('users', function (Blueprint $table) {
            $table->dropForeign(['last_active_site_id']);
        });

        Schema::dropIfExists('sites');
        Schema::dropIfExists('precinct_groups');
        Schema::dropIfExists('cache_locks');
        Schema::dropIfExists('cache');
        Schema::dropIfExists('sessions');
        Schema::dropIfExists('password_reset_tokens');
        Schema::dropIfExists('accounts');
        Schema::dropIfExists('users');
    }
};
