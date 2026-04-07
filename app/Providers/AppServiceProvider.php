<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Facades\URL;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        if (str_contains(config('app.url'), 'https://') || $this->app->environment('local')) {
            \Illuminate\Support\Facades\URL::forceScheme('https');
        }
    }
}
