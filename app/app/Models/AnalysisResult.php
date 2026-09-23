<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * GH-550 (stage 4) — one run of the analysis, as a record.
 *
 * Nothing but `App\Support\AnalysisResults` may query this model; the guard
 * `gh546-analysis-results-single-owner.test.js` asserts it, and the class name
 * is on its list of ways to name the storage for exactly that reason.
 *
 * A row is a RUN, not a site: `outcome = 'complete'` carries the numbers,
 * `outcome = 'failed'` carries the reason and no numbers. The latest complete
 * row is what a screen prints; the latest row of either kind is what it says
 * about the last attempt.
 */
class AnalysisResult extends Model
{
    protected $fillable = [
        'site_id', 'run_id', 'outcome', 'reason',
        'started_at', 'completed_at',
        'inputs', 'metrics', 'computed', 'detail',
    ];

    protected function casts(): array
    {
        return [
            'started_at'   => 'datetime',
            'completed_at' => 'datetime',
            'inputs'       => 'array',
            'metrics'      => 'array',
            'computed'     => 'array',
            'detail'       => 'array',
        ];
    }

    public function site(): BelongsTo
    {
        return $this->belongsTo(Site::class);
    }
}
