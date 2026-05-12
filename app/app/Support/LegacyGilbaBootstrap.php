<?php

namespace App\Support;

class LegacyGilbaBootstrap
{
    private static bool $interpretationLoaded = false;

    private static bool $stadiumLoaded = false;

    public static function loadInterpretationClasses(): void
    {
        if (self::$interpretationLoaded) {
            return;
        }

        $base = base_path('legacy/gilba/includes');

        require_once $base.'/class-gilba-interpretation.php';
        require_once $base.'/class-gilba-soil-interpretation.php';
        require_once $base.'/class-gilba-water-interpretation.php';
        require_once $base.'/class-gilba-synthesis-interpretation.php';

        self::$interpretationLoaded = true;
    }

    public static function loadStadiumClasses(): void
    {
        if (self::$stadiumLoaded) {
            return;
        }

        $base = base_path('legacy/gilba/includes/stadium');

        require_once $base.'/interface-shade-engine.php';
        require_once $base.'/class-geometry-utils.php';
        require_once $base.'/class-shade-engine.php';
        require_once $base.'/class-radial-obstruction-profile.php';
        require_once $base.'/class-shade-visualiser.php';
        require_once $base.'/class-rig-placement-calculator.php';
        require_once $base.'/class-rig-placement-visualiser.php';
        require_once $base.'/class-schedule-optimiser.php';
        require_once $base.'/class-dli-gap-calculator.php';
        require_once $base.'/class-eue-calculator.php';
        require_once $base.'/class-supplemental-light-module.php';
        require_once $base.'/class-stadium-database.php';
        require_once $base.'/class-ambient-dli-estimator.php';
        require_once $base.'/class-hub-climate-adapter.php';
        require_once $base.'/class-hub-variety-adapter.php';
        require_once $base.'/class-data-store.php';
        require_once $base.'/class-currency-formatter.php';
        require_once $base.'/class-effectiveness-tracker.php';
        require_once $base.'/class-roof-par-filter.php';
        require_once $base.'/class-radial-profile-generator.php';

        $profileFiles = [
            base_path('../data/stadiums/stadium_obstruction_profiles_sample.json'),
            base_path('../data/stadiums/uk_stadium_obstruction_profiles.json'),
            base_path('../data/stadiums/japan_j1_stadium_obstruction_profiles.json'),
            base_path('../data/stadiums/australia_stadium_obstruction_profiles.json'),
        ];

        \Gssh_Radial_Obstruction_Profile::init(array_values(array_filter($profileFiles, 'is_file')));
        \Gssh_Radial_Profile_Generator::register_generated_profiles();

        self::$stadiumLoaded = true;
    }
}
