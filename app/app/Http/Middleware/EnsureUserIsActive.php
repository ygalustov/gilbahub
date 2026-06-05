<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureUserIsActive
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user && $user->status === 'pending') {
            return redirect('/pending');
        }

        if ($user && $user->status === 'suspended') {
            abort(403, 'Your account has been suspended.');
        }

        return $next($request);
    }
}
