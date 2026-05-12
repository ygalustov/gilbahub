<?php

namespace App\Support;

class GilbaRuntimeBootstrap
{
    private static bool $interpretationLoaded = false;

    private static bool $stadiumLoaded = false;

    public static function loadInterpretationClasses(): void
    {
        if (self::$interpretationLoaded) {
            return;
        }

        class_exists(\Gilba_Interpretation::class);
        class_exists(\Gilba_Soil_Interpretation::class);
        class_exists(\Gilba_Water_Interpretation::class);
        class_exists(\Gilba_Synthesis_Interpretation::class);

        self::$interpretationLoaded = true;
    }

    public static function loadStadiumClasses(): void
    {
        if (self::$stadiumLoaded) {
            return;
        }

        class_exists(\Gssh_Shade_Engine_Interface::class);
        class_exists(\Gssh_Geometry_Utils::class);
        class_exists(\Gssh_Shade_Engine::class);
        class_exists(\Gssh_Radial_Obstruction_Profile::class);
        class_exists(\Gssh_Shade_Visualiser::class);
        class_exists(\Gssh_Rig_Placement_Calculator::class);
        class_exists(\Gssh_Rig_Placement_Visualiser::class);
        class_exists(\Gssh_Schedule_Optimiser::class);
        class_exists(\Gssh_DLI_Gap_Calculator::class);
        class_exists(\Gssh_EUE_Calculator::class);
        class_exists(\Gssh_Supplemental_Light_Module::class);
        class_exists(\Gssh_Stadium_Database::class);
        class_exists(\Gssh_Ambient_DLI_Estimator::class);
        class_exists(\Gssh_Radial_Profile_Generator::class);

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
