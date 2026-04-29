<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Site extends Model
{
    use HasFactory, HasUuids, SoftDeletes;

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'account_id',
        'precinct_group_id',
        'parent_site_id',
        'name',
        'slug',
        'site_type',
        'location_name',
        'latitude',
        'longitude',
        'timezone',
        'methodology_override',
        'soil_texture_override',
        'attributes_json',
        'created_by_user_id',
        'modified_by_user_id',
    ];

    protected function casts(): array
    {
        return [
            'latitude' => 'decimal:7',
            'longitude' => 'decimal:7',
            'attributes_json' => 'array',
        ];
    }

    public function account(): BelongsTo
    {
        return $this->belongsTo(Account::class);
    }

    public function precinctGroup(): BelongsTo
    {
        return $this->belongsTo(PrecinctGroup::class);
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_site_id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(self::class, 'parent_site_id');
    }

    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class)
            ->withPivot('role')
            ->withTimestamps();
    }

    public function configs(): HasMany
    {
        return $this->hasMany(SiteConfig::class);
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
