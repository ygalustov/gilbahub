<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\AlertController;
use App\Http\Controllers\BenchmarkController;
use App\Http\Controllers\FieldLogEntryController;
use App\Http\Controllers\LegacyAjaxController;
use App\Http\Controllers\LegacySitePersistenceController;
use App\Http\Controllers\LabReportParseController;
use App\Http\Controllers\MediaUploadController;
use App\Http\Controllers\PredictionController;
use App\Http\Controllers\SampleController;
use App\Http\Controllers\SensorProxyController;
use App\Http\Controllers\SiteController;
use App\Http\Controllers\SprayLogController;
use App\Http\Controllers\StadiumVenueProfileController;
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
    Route::view('/stadium', 'stadium')->name('stadium');
    Route::view('/settings', 'placeholder', ['title' => 'Settings'])->name('settings');

    Route::prefix('api')->name('api.')->group(function () {
        Route::post('/ajax', [LegacyAjaxController::class, 'handle'])
            ->withoutMiddleware(VerifyCsrfToken::class)
            ->name('legacy.ajax');

        Route::get('/sites', [SiteController::class, 'index'])->name('sites.index');
        Route::post('/sites/sync', [SiteController::class, 'syncRegistry'])->name('sites.sync');
        Route::post('/sites', [SiteController::class, 'store'])->name('sites.store');
        Route::get('/sites/{site}', [SiteController::class, 'show'])->name('sites.show');
        Route::patch('/sites/{site}', [SiteController::class, 'update'])->name('sites.update');
        Route::patch('/active-site', [SiteController::class, 'setActive'])->name('sites.active.update');
        Route::put('/sites/{site}/config/{namespace?}', [SiteController::class, 'updateConfig'])->name('sites.config.update');

        Route::get('/samples', [SampleController::class, 'index'])->name('samples.index');
        Route::post('/samples', [SampleController::class, 'store'])->name('samples.store');
        Route::post('/samples/sync', [SampleController::class, 'sync'])->name('samples.sync');
        Route::get('/samples/{sample}', [SampleController::class, 'show'])->name('samples.show');
        Route::get('/site-summaries', [SampleController::class, 'listSummaries'])->name('site-summaries.index');
        Route::get('/benchmark/{siteIdentifier}', [BenchmarkController::class, 'show'])->name('benchmark.show');

        Route::get('/field-log/entries', [FieldLogEntryController::class, 'index'])->name('field-log-entries.index');
        Route::post('/field-log/entries', [FieldLogEntryController::class, 'store'])->name('field-log-entries.store');
        Route::get('/spray-log', [SprayLogController::class, 'index'])->name('spray-log.index');
        Route::get('/spray-log/context', [SprayLogController::class, 'context'])->name('spray-log.context');
        Route::get('/spray-log/summary', [SprayLogController::class, 'summary'])->name('spray-log.summary');
        Route::post('/spray-log', [SprayLogController::class, 'store'])->name('spray-log.store');
        Route::put('/spray-log/{logId}', [SprayLogController::class, 'update'])->name('spray-log.update');
        Route::delete('/spray-log/{logId}', [SprayLogController::class, 'destroy'])->name('spray-log.destroy');
        Route::post('/media', [MediaUploadController::class, 'store'])->name('media.store');
        Route::get('/media/{mediaUpload}', [MediaUploadController::class, 'show'])->name('media.show');
        Route::post('/alerts/check', [AlertController::class, 'check'])->name('alerts.check');
        Route::post('/alerts/test', [AlertController::class, 'test'])->name('alerts.test');
        Route::post('/predictions', [PredictionController::class, 'store'])->name('predictions.store');
        Route::get('/predictions/pending/{siteIdentifier}', [PredictionController::class, 'pending'])->name('predictions.pending');
        Route::post('/outcomes', [PredictionController::class, 'storeOutcome'])->name('outcomes.store');
        Route::post('/lab-reports/parse', [LabReportParseController::class, 'store'])->name('lab-reports.parse');
        Route::post('/sensors/hydrosight/proxy', [SensorProxyController::class, 'hydrosight'])->name('sensors.hydrosight.proxy');
        Route::post('/sensors/specconnect/proxy', [SensorProxyController::class, 'specconnect'])->name('sensors.specconnect.proxy');
        Route::get('/stadium/venue-profiles', [StadiumVenueProfileController::class, 'index'])->name('stadium.venue-profiles.index');
        Route::put('/stadium/venue-profiles/{venueId}', [StadiumVenueProfileController::class, 'upsert'])->name('stadium.venue-profiles.upsert');

        Route::post('/legacy/gilba-sites-load', [LegacySitePersistenceController::class, 'loadSites'])->name('legacy.sites.load');
        Route::post('/legacy/gilba-sites-save', [LegacySitePersistenceController::class, 'saveSites'])->name('legacy.sites.save');
        Route::post('/legacy/gilba-site-configs-load', [LegacySitePersistenceController::class, 'loadSiteConfigs'])->name('legacy.site-configs.load');
        Route::post('/legacy/gilba-site-configs-save', [LegacySitePersistenceController::class, 'saveSiteConfigs'])->name('legacy.site-configs.save');
    });
});
