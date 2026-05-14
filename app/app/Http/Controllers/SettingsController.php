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

        if ($activeSite) {
            $activeSite->load('configs');
        }

        return view('settings', [
            'title'      => 'Settings',
            'activeSite' => $activeSite,
            'allSites'   => $allSites,
        ]);
    }
}
