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
            $table->foreignId('site_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('zone', 80);
            $table->date('application_date');
            $table->string('product_name');
            $table->string('product_category', 80)->default('other');
            $table->decimal('rate', 10, 3)->nullable();
            $table->string('rate_unit', 40)->nullable();
            $table->string('target')->nullable();
            $table->text('notes')->nullable();
            $table->string('source', 40)->default('manual');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('spray_logs');
    }
};
