<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('predictions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('site_identifier', 191)->index();
            $table->string('cascade_id', 80)->nullable()->index();
            $table->string('module', 32)->index();
            $table->string('sub_key', 120)->default('');
            $table->string('predicted_label')->nullable();
            $table->string('prediction_type', 32)->default('numeric');
            $table->json('predicted_value')->nullable();
            $table->string('predicted_category', 80)->nullable();
            $table->decimal('confidence', 8, 4)->nullable();
            $table->timestamp('predicted_at')->nullable()->index();
            $table->timestamp('outcome_window_start')->nullable();
            $table->timestamp('outcome_window_end')->nullable();
            $table->json('input_snapshot')->nullable();
            $table->string('status', 20)->default('pending')->index();
            $table->timestamp('resolved_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'site_identifier', 'status']);
        });

        Schema::create('prediction_outcomes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('prediction_id')->constrained('predictions')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('qualitative', 40);
            $table->string('action_taken', 40)->nullable();
            $table->text('action_notes')->nullable();
            $table->timestamp('observed_at')->nullable();
            $table->json('payload')->nullable();
            $table->timestamps();

            $table->unique('prediction_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('prediction_outcomes');
        Schema::dropIfExists('predictions');
    }
};
