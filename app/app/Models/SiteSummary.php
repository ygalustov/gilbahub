<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class SiteSummary extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'account_id',
        'site_id',
        'sample_type',
        'lab_date',
        'methodology_snapshot',
        'summary',
        'source_sample_id',
        'created_by_user_id',
        'modified_by_user_id',
    ];

    protected function casts(): array
    {
        return [
            'lab_date' => 'date',
            'summary' => 'array',
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

    public function sourceSample(): BelongsTo
    {
        return $this->belongsTo(Sample::class, 'source_sample_id');
    }
}
