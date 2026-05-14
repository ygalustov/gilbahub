<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\View\View;

class SettingsController extends Controller
{
    public function show(Request $request): View
    {
        $user       = $request->user();
        $activeSite = $user?->activeSite;
        $allSites   = $user?->sites()->orderBy('name')->get() ?? collect();

        $activeGaipConfig = [];
        if ($activeSite) {
            $activeSite->load('configs');
            $gaipRecord = $activeSite->configs()->where('namespace', 'gaip')->first();
            $activeGaipConfig = is_array($gaipRecord?->config) ? $gaipRecord->config : [];
        }

        return view('settings', [
            'title'           => 'Settings',
            'activeSite'      => $activeSite,
            'allSites'        => $allSites,
            'activeGaipConfig' => $activeGaipConfig,
        ]);
    }
}
