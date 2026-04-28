<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('stadium_venue_profiles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('venue_id', 120);
            $table->json('profile')->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'venue_id']);
            $table->index(['venue_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stadium_venue_profiles');
    }
};
