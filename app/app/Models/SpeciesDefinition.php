<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SpeciesDefinition extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'turf_type',
        'sub_category',
        'photosynthesis',
        'value',
        'label',
        'regions',
        'sort_order',
    ];

    protected $casts = [
        'regions' => 'array',
    ];
}
