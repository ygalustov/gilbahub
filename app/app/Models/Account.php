<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Account extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'owner_user_id',
        'display_name',
        'methodology',
        'soil_texture',
        'country',
        'region',
        'settings_json',
        'created_by_user_id',
        'modified_by_user_id',
    ];

    protected function casts(): array
    {
        return [
            'settings_json' => 'array',
        ];
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_user_id');
    }

    public function precinctGroups(): HasMany
    {
        return $this->hasMany(PrecinctGroup::class);
    }

    public function sites(): HasMany
    {
        return $this->hasMany(Site::class);
    }

    public function samples(): HasMany
    {
        return $this->hasMany(Sample::class);
    }

    public function summaries(): HasMany
    {
        return $this->hasMany(SiteSummary::class);
    }
}
