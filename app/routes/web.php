<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\LegacyAjaxController;
use App\Http\Controllers\LegacySitePersistenceController;
use App\Http\Controllers\MediaUploadController;
use App\Http\Controllers\SiteController;
use App\Http\Controllers\SprayLogController;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;
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
    Route::get('/legacy-assets/{path}', function (string $path) {
        $base = realpath(base_path('../assets'));
        $file = $base ? realpath($base.DIRECTORY_SEPARATOR.$path) : false;

        abort_unless($base && $file && str_starts_with($file, $base.DIRECTORY_SEPARATOR) && is_file($file), 404);

        return response()->file($file);
    })->where('path', '.*')->name('legacy-assets.show');

    Route::view('/hub', 'hub')->name('hub');
    Route::view('/field-log', 'field-log')->name('field-log');
    Route::view('/morning-briefing', 'morning-briefing')->name('morning-briefing');
    Route::view('/stadium', 'placeholder', ['title' => 'Stadium'])->name('stadium');
    Route::view('/settings', 'placeholder', ['title' => 'Settings'])->name('settings');

    Route::prefix('api')->name('api.')->group(function () {
        Route::post('/ajax', [LegacyAjaxController::class, 'handle'])
            ->withoutMiddleware(VerifyCsrfToken::class)
            ->name('legacy.ajax');

        Route::get('/sites', [SiteController::class, 'index'])->name('sites.index');
        Route::post('/sites', [SiteController::class, 'store'])->name('sites.store');
        Route::get('/sites/{site}', [SiteController::class, 'show'])->name('sites.show');
        Route::patch('/sites/{site}', [SiteController::class, 'update'])->name('sites.update');
        Route::patch('/active-site', [SiteController::class, 'setActive'])->name('sites.active.update');
        Route::put('/sites/{site}/config/{namespace?}', [SiteController::class, 'updateConfig'])->name('sites.config.update');
        Route::post('/spray-log', [SprayLogController::class, 'store'])->name('spray-log.store');
        Route::post('/media', [MediaUploadController::class, 'store'])->name('media.store');
        Route::get('/media/{mediaUpload}', [MediaUploadController::class, 'show'])->name('media.show');

        Route::post('/legacy/gilba-sites-load', [LegacySitePersistenceController::class, 'loadSites'])->name('legacy.sites.load');
        Route::post('/legacy/gilba-sites-save', [LegacySitePersistenceController::class, 'saveSites'])->name('legacy.sites.save');
        Route::post('/legacy/gilba-site-configs-load', [LegacySitePersistenceController::class, 'loadSiteConfigs'])->name('legacy.site-configs.load');
        Route::post('/legacy/gilba-site-configs-save', [LegacySitePersistenceController::class, 'saveSiteConfigs'])->name('legacy.site-configs.save');
    });
});
