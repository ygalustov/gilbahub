<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('species_definitions', function (Blueprint $table) {
            $table->id();
            $table->string('turf_type', 32);           // 'golf' | 'sports' | 'lawns'
            $table->string('sub_category', 32)->nullable(); // 'greens'|'fairways'|'tees'|'surrounds' | null
            $table->string('photosynthesis', 4);        // 'c3' | 'c4'
            $table->string('value', 128);               // stored in gaip config
            $table->string('label', 128);               // shown in UI dropdown
            $table->json('regions')->nullable();         // null = global; ['new_zealand'] = NZ only, etc.
            $table->unsignedSmallInteger('sort_order')->default(0);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('species_definitions');
    }
};
