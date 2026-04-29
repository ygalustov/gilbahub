<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('spray_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('account_id')->constrained('accounts')->cascadeOnDelete();
            $table->uuid('site_id');
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->json('applied_to_site_ids')->nullable();
            $table->json('applied_to_samples')->nullable();
            $table->date('event_date');
            $table->time('event_time')->nullable();
            $table->string('zone', 80);
            $table->string('product_name');
            $table->string('product_type', 80)->default('other');
            $table->string('active_ingredient')->default('');
            $table->decimal('rate_value', 10, 3)->nullable();
            $table->string('rate_unit', 40)->nullable();
            $table->decimal('area_treated_ha', 10, 4)->nullable();
            $table->decimal('water_rate_l_per_ha', 8, 2)->nullable();
            $table->string('operator', 128)->default('');
            $table->string('target')->nullable();
            $table->json('conditions')->nullable();
            $table->text('notes')->nullable();
            $table->string('source', 40)->default('manual');
            $table->timestamps();

            $table->foreign('site_id')->references('id')->on('sites')->cascadeOnDelete();
            $table->index(['site_id', 'event_date']);
            $table->index(['account_id', 'event_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('spray_logs');
    }
};
