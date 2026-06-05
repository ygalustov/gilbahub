<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckSelfRegistrationEnabled
{
    public function handle(Request $request, Closure $next): Response
    {
        if (! config('auth.self_registration_enabled', false)) {
            abort(404);
        }

        return $next($request);
    }
}
