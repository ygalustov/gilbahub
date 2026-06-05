<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;

class UnsuspendUser extends Command
{
    protected $signature = 'user:unsuspend {email}';

    protected $description = 'Unsuspend a suspended user account';

    public function handle(): int
    {
        $email = $this->argument('email');

        $user = User::query()->where('email', $email)->first();

        if (! $user) {
            $this->error("User {$email} not found.");
            return self::FAILURE;
        }

        if ($user->status !== 'suspended') {
            $this->info("User {$email} is not suspended (status: {$user->status}).");
            return self::SUCCESS;
        }

        $user->forceFill(['status' => 'active'])->save();

        $this->info("User {$email} has been unsuspended.");

        return self::SUCCESS;
    }
}
