<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;

class MakeAdmin extends Command
{
    protected $signature = 'user:make-admin {email}';

    protected $description = 'Grant admin privileges to a user (creates the user if not exists)';

    public function handle(): int
    {
        $email = $this->argument('email');

        $user = User::query()->firstOrCreate(
            ['email' => $email],
            [
                'name' => explode('@', $email)[0],
                'status' => 'active',
            ]
        );

        if ($user->is_admin) {
            $this->info("User {$email} is already an admin.");
            return self::SUCCESS;
        }

        $user->forceFill(['is_admin' => true])->save();

        $this->info("User {$email} is now an admin.");

        return self::SUCCESS;
    }
}
