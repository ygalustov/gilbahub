<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class Sample extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'account_id',
        'site_id',
        'sample_type',
        'lab_name',
        'lab_ref',
        'sample_date',
        'lab_date',
        'depth_mm',
        'methodology_snapshot',
        'soil_texture_snapshot',
        'payload',
        'notes',
        'created_by_user_id',
        'modified_by_user_id',
    ];

    protected function casts(): array
    {
        return [
            'sample_date' => 'date',
            'lab_date' => 'date',
            'payload' => 'array',
        ];
    }

    public function account(): BelongsTo
    {
        return $this->belongsTo(Account::class);
    }

    public function site(): BelongsTo
    {
        return $this->belongsTo(Site::class);
    }

    public function sourceSummary(): BelongsTo
    {
        return $this->belongsTo(SiteSummary::class, 'id', 'source_sample_id');
    }
}
