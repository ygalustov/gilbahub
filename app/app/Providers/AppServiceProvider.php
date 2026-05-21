<?php

namespace App\Providers;

use Illuminate\Support\Facades\View;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void {}

    public function boot(): void
    {
        View::share('legacyAssetUrl', function (string $asset): string {
            $path = base_path('../assets/'.$asset);
            $version = is_file($path) ? '?v='.filemtime($path) : '';
            return url('/legacy-assets/'.$asset).$version;
        });
    }
}
