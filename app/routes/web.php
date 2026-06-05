<?php

use App\Http\Controllers\AnalysisCacheController;
use App\Http\Controllers\AnalysisController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\BenchmarkController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\AlertController;
use App\Http\Controllers\DataController;
use App\Http\Controllers\FieldLogEntryController;
use App\Http\Controllers\InterpretationController;
use App\Http\Controllers\InvitationController;
use App\Http\Controllers\LabReportParseController;
use App\Http\Controllers\MagicLinkController;
use App\Http\Controllers\MediaUploadController;
use App\Http\Controllers\PageController;
use App\Http\Controllers\PredictionController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\ReportsController;
use App\Http\Controllers\SampleController;
use App\Http\Controllers\SensorProxyController;
use App\Http\Controllers\AccountController;
use App\Http\Controllers\SettingsController;
use App\Http\Controllers\SiteController;
use App\Http\Controllers\SprayLogController;
use App\Http\Controllers\StadiumAnalysisController;
use App\Http\Controllers\StadiumVenueProfileController;
use App\Http\Controllers\UsersController;
use Illuminate\Support\Facades\Route;

Route::redirect('/', '/dashboard');

Route::middleware('guest')->group(function () {
    Route::get('/login', [AuthController::class, 'showLogin'])->name('login');
    Route::post('/login', [AuthController::class, 'login'])->name('login.store');
    Route::post('/login/magic', [MagicLinkController::class, 'send'])->name('magic.send');
    Route::get('/magic/{token}', [MagicLinkController::class, 'verify'])->name('magic.verify');
    Route::get('/register', [AuthController::class, 'showRegister'])->name('register')->middleware('self-registration');
    Route::post('/register', [AuthController::class, 'register'])->name('register.store')->middleware('self-registration');
});

Route::post('/logout', [AuthController::class, 'logout'])
    ->middleware('auth')
    ->name('logout');

// Auth-only routes excluded from EnsureUserIsActive (pending users can access these)
Route::middleware('auth')->group(function () {
    Route::get('/pending', [AuthController::class, 'pending'])->name('pending');
});

// All other authenticated routes require active status
Route::middleware(['auth', 'active'])->group(function () {
    Route::get('/legacy-assets/{path}', function (string $path) {
        $base = realpath(base_path('../assets'));
        $file = $base ? realpath($base.DIRECTORY_SEPARATOR.$path) : false;

        abort_unless($base && $file && str_starts_with($file, $base.DIRECTORY_SEPARATOR) && is_file($file), 404);

        return response()->file($file);
    })->where('path', '.*')->name('legacy-assets.show');

    Route::view('/hub', 'hub')->name('hub');
    Route::get('/dashboard', [DashboardController::class, 'show'])->name('dashboard');
    Route::get('/analysis', [AnalysisController::class, 'index'])->name('analysis');
    // Legacy routes redirect to the SPA with the appropriate hash
    Route::get('/analysis/disease', fn() => redirect('/analysis#disease'))->name('analysis.disease');
    Route::get('/analysis/growth-light', fn() => redirect('/analysis#growth-light'))->name('analysis.growth-light');
    Route::get('/analysis/soil-nutrition', fn() => redirect('/analysis#soil-nutrition'))->name('analysis.soil-nutrition');
    Route::get('/data', [DataController::class, 'show'])->name('data');
    Route::get('/data/{section}', [DataController::class, 'show'])->name('data.section');
    Route::view('/field-log', 'field-log')->name('field-log');
    Route::view('/morning-briefing', 'morning-briefing')->name('morning-briefing');
    Route::view('/stadium', 'stadium')->name('stadium');
    Route::get('/plan', [PageController::class, 'plan'])->name('plan');
    Route::redirect('/reports', '/reports/export')->name('reports');
    Route::get('/reports/export', [ReportsController::class, 'export'])->name('reports.export');
    Route::get('/reports/forensic', [ReportsController::class, 'forensic'])->name('reports.forensic');
    Route::get('/reports/scenarios', [ReportsController::class, 'scenarios'])->name('reports.scenarios');
    Route::get('/reports/accuracy', [ReportsController::class, 'accuracy'])->name('reports.accuracy');
    Route::get('/settings', [SettingsController::class, 'show'])->name('settings');
    Route::get('/account', [AccountController::class, 'show'])->name('account');

    Route::prefix('api')->name('api.')->group(function () {
        Route::get('/sites', [SiteController::class, 'index'])->name('sites.index');
        Route::post('/sites/sync', [SiteController::class, 'syncRegistry'])->name('sites.sync');
        Route::post('/sites', [SiteController::class, 'store'])->name('sites.store');
        Route::get('/sites/{site}', [SiteController::class, 'show'])->name('sites.show');
        Route::patch('/sites/{site}', [SiteController::class, 'update'])->name('sites.update');
        Route::delete('/sites/{site}', [SiteController::class, 'destroy'])->name('sites.destroy');
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
        Route::delete('/data/entry/{id}', [DataController::class, 'destroy'])->name('data.destroy');
        Route::post('/media', [MediaUploadController::class, 'store'])->name('media.store');
        Route::get('/media/{mediaUpload}', [MediaUploadController::class, 'show'])->name('media.show');
        Route::post('/alerts/check', [AlertController::class, 'check'])->name('alerts.check');
        Route::post('/alerts/test', [AlertController::class, 'test'])->name('alerts.test');
        Route::post('/predictions', [PredictionController::class, 'store'])->name('predictions.store');
        Route::get('/predictions/pending/{siteIdentifier}', [PredictionController::class, 'pending'])->name('predictions.pending');
        Route::post('/outcomes', [PredictionController::class, 'storeOutcome'])->name('outcomes.store');
        Route::get('/outcomes/history/{siteIdentifier}', [PredictionController::class, 'history'])->name('outcomes.history');
        Route::post('/interpretations/soil', [InterpretationController::class, 'soil'])->name('interpretations.soil');
        Route::post('/interpretations/water', [InterpretationController::class, 'water'])->name('interpretations.water');
        Route::post('/interpretations/synthesis', [InterpretationController::class, 'synthesis'])->name('interpretations.synthesis');
        Route::post('/lab-reports/parse', [LabReportParseController::class, 'store'])->name('lab-reports.parse');

        Route::post('/analysis-cache', [AnalysisCacheController::class, 'store'])->name('analysis-cache.store');
        Route::post('/sensors/hydrosight/proxy', [SensorProxyController::class, 'hydrosight'])->name('sensors.hydrosight.proxy');
        Route::post('/sensors/specconnect/proxy', [SensorProxyController::class, 'specconnect'])->name('sensors.specconnect.proxy');
        Route::post('/stadium/shade-render', [StadiumAnalysisController::class, 'shadeRender'])->name('stadium.shade-render');
        Route::post('/stadium/rig-calculate', [StadiumAnalysisController::class, 'rigCalculate'])->name('stadium.rig-calculate');
        Route::post('/stadium/seasonal-plan', [StadiumAnalysisController::class, 'seasonalPlan'])->name('stadium.seasonal-plan');
        Route::get('/stadium/venue-profiles', [StadiumVenueProfileController::class, 'index'])->name('stadium.venue-profiles.index');
        Route::put('/stadium/venue-profiles/{venueId}', [StadiumVenueProfileController::class, 'upsert'])->name('stadium.venue-profiles.upsert');

        // Users management
        Route::get('/users', [UsersController::class, 'index'])->name('users.index');
        Route::patch('/users/{user}/role', [UsersController::class, 'updateRole'])->name('users.role.update');
        Route::delete('/users/{user}/site/{site}', [UsersController::class, 'removeSite'])->name('users.site.remove');
        Route::patch('/users/{user}/suspend', [UsersController::class, 'suspend'])->name('users.suspend');
        Route::patch('/users/{user}/unsuspend', [UsersController::class, 'unsuspend'])->name('users.unsuspend');
        Route::patch('/users/{user}/approve', [UsersController::class, 'approve'])->name('users.approve');
        Route::delete('/users/{user}', [UsersController::class, 'destroy'])->name('users.destroy');

        // Invitations
        Route::post('/invitations', [InvitationController::class, 'store'])->name('invitations.store');
        Route::delete('/invitations/{invitation}', [InvitationController::class, 'destroy'])->name('invitations.destroy');

        // Profile
        Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
        Route::post('/profile/password', [ProfileController::class, 'setPassword'])->name('profile.password.set');
        Route::patch('/profile/password-prompt', [ProfileController::class, 'dismissPasswordPrompt'])->name('profile.password-prompt.dismiss');
    });
});
