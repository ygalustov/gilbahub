<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

#[Fillable(['name', 'email', 'password_hash', 'last_active_site_id'])]
#[Hidden(['password_hash', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable;

    public function account(): HasOne
    {
        return $this->hasOne(Account::class, 'owner_user_id');
    }

    public function activeSite(): BelongsTo
    {
        return $this->belongsTo(Site::class, 'last_active_site_id');
    }

    public function sites(): BelongsToMany
    {
        return $this->belongsToMany(Site::class)
            ->withPivot('role')
            ->withTimestamps();
    }

    public function invitations(): HasMany
    {
        return $this->hasMany(Invitation::class, 'invited_by');
    }

    // --- RBAC helpers ---

    public function roleOnSite(Site $site): ?string
    {
        if ($this->is_admin) {
            return 'admin';
        }

        return $this->sites()
            ->where('sites.id', $site->id)
            ->first()?->pivot->role;
    }

    public function canManageSite(Site $site): bool
    {
        return in_array($this->roleOnSite($site), ['admin', 'manager']);
    }

    public function canEditSite(Site $site): bool
    {
        return in_array($this->roleOnSite($site), ['admin', 'manager', 'editor']);
    }

    public function canViewSite(Site $site): bool
    {
        return $this->roleOnSite($site) !== null;
    }

    // --- Auth: use password_hash column ---

    public function getAuthPassword(): string
    {
        return $this->password_hash ?? '';
    }

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password_hash' => 'hashed',
            'is_admin' => 'boolean',
            'password_prompt_shown' => 'boolean',
        ];
    }
}
