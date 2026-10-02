<?php

use App\Http\Controllers\AnalysisCacheController;
use App\Http\Controllers\GeocodingController;
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
use App\Http\Controllers\SampleAnalysisController;
use App\Http\Controllers\SampleController;
use App\Http\Controllers\SensorProxyController;
use App\Http\Controllers\AccountController;
use App\Http\Controllers\SettingsController;
use App\Http\Controllers\SiteController;
use App\Http\Controllers\SprayLogController;
use App\Http\Controllers\StadiumAnalysisController;
use App\Http\Controllers\StadiumVenueProfileController;
use App\Http\Controllers\UsersController;
use App\Http\Controllers\ZoneController;
use Illuminate\Support\Facades\Route;

Route::redirect('/', '/dashboard');
Route::redirect('/favicon.ico', '/images/favicon.svg', 301);

Route::middleware('guest')->group(function () {
    Route::get('/login', [AuthController::class, 'showLogin'])->name('login');
    Route::post('/login', [AuthController::class, 'login'])->name('login.store');
    Route::get('/register', [AuthController::class, 'showRegister'])->name('register')->middleware('self-registration');
    Route::post('/register', [AuthController::class, 'register'])->name('register.store')->middleware('self-registration');
});

// Magic link send + verify accessible to both guests and logged-in users
Route::post('/login/magic', [MagicLinkController::class, 'send'])->name('magic.send');
Route::get('/magic/{token}', [MagicLinkController::class, 'verify'])->name('magic.verify');

Route::post('/logout', [AuthController::class, 'logout'])
    ->middleware('auth')
    ->name('logout');

// Auth-only routes excluded from EnsureUserIsActive (pending users can access these)
Route::middleware('auth')->group(function () {
    Route::get('/pending', [AuthController::class, 'pending'])->name('pending');
    Route::get('/no-access', fn () => view('auth.no-access'))->name('no-access');
});

// All other authenticated routes require active status
/**
 * GH-708 (item 3bk, part 3) — THE LOCK IS WIRED HERE, and it is the owner's decision of 24.09.2026
 * that puts it on this group: a site may not be looked at or calculated until the person has
 * answered what the calculation needs, and refreshing the page brings the wizard back.
 *
 * WHAT IS NOT LOCKED, and each has its reason in the middleware: the dashboard (the wizard opens
 * there, and locking it would redirect to itself), logging out, the no-access and pending doors, and
 * the account page where a person switches site — locking that would trap them on one incomplete
 * site. Everything asking for JSON or living under `api/*` passes too: the wizard saves through the
 * API, and a lock in front of it would leave a person in a wizard that cannot save.
 *
 * `/hub` IS UNDER THE LOCK (GH-708), by the owner's decision of 24.09.2026 at 19:50: what she had
 * excluded from this work was the old hub's INTERFACE, not its route. So the run frame of an
 * incomplete site is redirected like any other page, and her rule that there is no calculation until
 * the wizard has been completed holds for the frame as well. Her words are quoted verbatim in
 * PLAN-remaining-defects-RU.md; a comment carries the decision, not the quote, because only our
 * plans are written in Russian.
 *
 * `?setup=0` DOES NOT BYPASS IT: the middleware reads no parameter at all, only the state.
 */
Route::middleware(['auth', 'active', \App\Http\Middleware\EnsureSiteIsSetUp::class])->group(function () {
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
        // GH-442 (GH-439 stage 3): POST /api/sites/sync is withdrawn. It
        // existed to take the browser's own site registry as input; nothing in
        // the product has called it since stage 2, and what it used to write --
        // site names built from a label that fell back to the site ID -- is why
        // a live site could end up named after its own UUID.

        Route::post('/sites', [SiteController::class, 'store'])->name('sites.store');
        Route::get('/sites/{site}', [SiteController::class, 'show'])->name('sites.show');
        Route::patch('/sites/{site}', [SiteController::class, 'update'])->name('sites.update');
        Route::delete('/sites/{site}', [SiteController::class, 'destroy'])->name('sites.destroy');
        Route::patch('/active-site', [SiteController::class, 'setActive'])->name('sites.active.update');
        // GH-439: the only way a gaip config changes -- send the change, not
        // the state. The whole-object PUT below still answers for as long as
        // the hub pages send one; it is guarded, and goes away with them.
        // GH-801 (queue item "Zones", stage C2): what the Zones tab did -- created,
        // renamed, typed, deleted -- rather than the list of names the browser
        // held. The tab used to PATCH the site itself with that whole list, which
        // is the one rule this product does not bend: send the change, not the
        // state. All of a save is applied or none of it is.
        Route::patch('/sites/{site}/zones', [ZoneController::class, 'update'])->name('sites.zones.update');
        Route::patch('/sites/{site}/config/gaip', [SiteController::class, 'patchConfig'])->name('sites.config.patch');
        Route::put('/sites/{site}/config/{namespace?}', [SiteController::class, 'updateConfig'])->name('sites.config.update');

        Route::get('/samples', [SampleController::class, 'index'])->name('samples.index');
        Route::post('/samples', [SampleController::class, 'store'])->name('samples.store');
        Route::post('/samples/sync', [SampleController::class, 'sync'])->name('samples.sync');
        Route::get('/samples/{sample}', [SampleController::class, 'show'])->name('samples.show');
        Route::patch('/samples/{sample}', [SampleController::class, 'update'])->name('samples.update');
        // GH-526 (PLAN-samples-sync-FINAL stage 1): the per-record delete the
        // hub never had. It replaces DELETE /api/data/entry/{id}, which was the
        // Data page's own second route into the same table.
        Route::delete('/samples/{sample}', [SampleController::class, 'destroy'])->name('samples.destroy');
        Route::get('/samples/{sample}/analyse', [SampleAnalysisController::class, 'run'])->name('samples.analyse');
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
        Route::get('/outcomes/history/{siteIdentifier}', [PredictionController::class, 'history'])->name('outcomes.history');
        Route::post('/interpretations/soil', [InterpretationController::class, 'soil'])->name('interpretations.soil');
        Route::post('/interpretations/water', [InterpretationController::class, 'water'])->name('interpretations.water');
        Route::post('/interpretations/synthesis', [InterpretationController::class, 'synthesis'])->name('interpretations.synthesis');
        Route::post('/lab-reports/parse', [LabReportParseController::class, 'store'])->name('lab-reports.parse');

        Route::post('/analysis-cache', [AnalysisCacheController::class, 'store'])->name('analysis-cache.store');
        // GH-548 (stage 3): a run reporting that it did not finish.
        Route::post('/analysis-cache/runs', [AnalysisCacheController::class, 'storeRun'])->name('analysis-cache.runs.store');
        Route::get('/geocode', [GeocodingController::class, 'search'])->name('geocode.search');
        Route::get('/geocode/{placeId}', [GeocodingController::class, 'details'])->name('geocode.details');
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
