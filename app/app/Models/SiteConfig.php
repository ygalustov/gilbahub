<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SiteConfig extends Model
{
    use HasFactory;

    protected $fillable = [
        'site_id',
        'namespace',
        'config',
        'synced_at',
    ];

    protected function casts(): array
    {
        return [
            'config' => 'array',
            'synced_at' => 'datetime',
        ];
    }

    public function site(): BelongsTo
    {
        return $this->belongsTo(Site::class);
    }
}
