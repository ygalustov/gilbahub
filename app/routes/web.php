<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\SiteController;
use Illuminate\Support\Facades\Route;

Route::redirect('/', '/hub');

Route::middleware('guest')->group(function () {
    Route::get('/login', [AuthController::class, 'showLogin'])->name('login');
    Route::post('/login', [AuthController::class, 'login'])->name('login.store');
});

Route::post('/logout', [AuthController::class, 'logout'])
    ->middleware('auth')
    ->name('logout');

Route::middleware('auth')->group(function () {
    Route::view('/hub', 'hub')->name('hub');
    Route::view('/field-log', 'placeholder', ['title' => 'Field Log'])->name('field-log');
    Route::view('/morning-briefing', 'placeholder', ['title' => 'Morning Briefing'])->name('morning-briefing');
    Route::view('/stadium', 'placeholder', ['title' => 'Stadium'])->name('stadium');
    Route::view('/settings', 'placeholder', ['title' => 'Settings'])->name('settings');

    Route::prefix('api')->name('api.')->group(function () {
        Route::get('/sites', [SiteController::class, 'index'])->name('sites.index');
        Route::post('/sites', [SiteController::class, 'store'])->name('sites.store');
        Route::get('/sites/{site}', [SiteController::class, 'show'])->name('sites.show');
        Route::patch('/sites/{site}', [SiteController::class, 'update'])->name('sites.update');
        Route::patch('/active-site', [SiteController::class, 'setActive'])->name('sites.active.update');
        Route::put('/sites/{site}/config/{namespace?}', [SiteController::class, 'updateConfig'])->name('sites.config.update');
    });
});
