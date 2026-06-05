<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // --- users: new RBAC + auth columns ---
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('is_admin')->notNull()->default(false)->after('email');
            $table->string('status', 16)->notNull()->default('active')->after('is_admin');
            // password_hash: nullable — null means Magic Link only
            // rename existing 'password' column (Laravel default) to password_hash
            $table->renameColumn('password', 'password_hash');
            $table->boolean('password_prompt_shown')->notNull()->default(false)->after('status');
        });

        // Make password_hash nullable (was NOT NULL in Laravel default)
        Schema::table('users', function (Blueprint $table) {
            $table->string('password_hash')->nullable()->change();
        });

        // --- sites: provisional_name flag ---
        Schema::table('sites', function (Blueprint $table) {
            $table->boolean('provisional_name')->notNull()->default(false)->after('name');
        });

        // --- Normalize site_user.role: 'owner' -> 'manager' ---
        DB::table('site_user')->where('role', 'owner')->update(['role' => 'manager']);

        // --- invitations table ---
        Schema::create('invitations', function (Blueprint $table) {
            $table->id();
            $table->string('email');
            $table->string('role', 16); // manager | editor | viewer
            $table->uuid('site_id');
            $table->foreignId('invited_by')->constrained('users')->cascadeOnDelete();
            $table->timestamp('created_at')->useCurrent();

            $table->foreign('site_id')->references('id')->on('sites')->cascadeOnDelete();
            $table->unique(['email', 'site_id']);
            $table->index('email');
        });

        // --- magic_links table ---
        Schema::create('magic_links', function (Blueprint $table) {
            $table->id();
            $table->string('token', 64)->unique();
            $table->string('email');
            $table->timestamp('expires_at');
            $table->timestamp('created_at')->useCurrent();

            $table->index('email');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('magic_links');
        Schema::dropIfExists('invitations');

        Schema::table('sites', function (Blueprint $table) {
            $table->dropColumn('provisional_name');
        });

        Schema::table('users', function (Blueprint $table) {
            $table->string('password_hash')->nullable(false)->change();
            $table->renameColumn('password_hash', 'password');
            $table->dropColumn(['is_admin', 'status', 'password_prompt_shown']);
        });
    }
};
