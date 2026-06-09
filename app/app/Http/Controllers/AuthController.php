<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use App\Mail\NewRegistrationMail;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\View\View;

class AuthController extends Controller
{
    public function showLogin(): View
    {
        return view('auth.login');
    }

    public function login(Request $request): RedirectResponse|\Illuminate\Http\JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['nullable', 'string'],
        ]);

        $email = strtolower(trim($data['email']));
        $password = $data['password'] ?? null;

        if (empty($password)) {
            $user = User::query()->where('email', $email)->first();

            if (! $user || ! $user->password_hash) {
                return back()->withErrors(['password' => 'No password set — use Magic Link instead.'])->withInput(['email' => $email]);
            }

            return back()->withErrors(['password' => 'Please enter your password.'])->withInput(['email' => $email]);
        }

        $ipKey = 'login:ip:' . sha1($request->ip());
        if (RateLimiter::tooManyAttempts($ipKey, 5)) {
            return back()->withErrors(['email' => 'Too many login attempts. Please try again later.'])->withInput(['email' => $email]);
        }

        $user = User::query()->where('email', $email)->first();

        if (! $user || ! $user->password_hash || ! Hash::check($password, $user->password_hash)) {
            RateLimiter::hit($ipKey, 60);
            return back()->withErrors(['password' => 'Incorrect password.'])->withInput(['email' => $email]);
        }

        RateLimiter::clear($ipKey);

        Auth::login($user, remember: true);
        $request->session()->regenerate();

        $this->processPendingInvitations($user);

        $intended = $request->session()->get('url.intended', '');
        if (str_contains($intended, 'setup=1')) {
            $request->session()->forget('url.intended');
        }

        return redirect()->intended(route('dashboard'));
    }

    public function logout(Request $request): RedirectResponse
    {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect()->route('login');
    }

    public function pending(Request $request): View
    {
        return view('auth.pending');
    }

    public function showRegister(): View
    {
        return view('auth.register');
    }

    public function register(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email', 'max:255'],
        ]);

        $email = strtolower(trim($data['email']));

        $existingUser = User::query()->where('email', $email)->first();

        if (! $existingUser) {
            User::query()->create([
                'name' => explode('@', $email)[0],
                'email' => $email,
                'status' => 'pending',
            ]);

            $this->notifyAdminsOfNewRegistration($email);
        }

        return back()->with('registration_submitted', true);
    }

    private function processPendingInvitations(User $user): void
    {
        $invitations = \App\Models\Invitation::query()->where('email', $user->email)->get();

        foreach ($invitations as $invitation) {
            if (! $user->sites()->where('sites.id', $invitation->site_id)->exists()) {
                $user->sites()->attach($invitation->site_id, ['role' => $invitation->role]);
            }
            $invitation->delete();
        }
    }

    private function notifyAdminsOfNewRegistration(string $email): void
    {
        $admins = User::query()->where('is_admin', true)->where('status', 'active')->get();

        foreach ($admins as $admin) {
            Mail::to($admin->email)->send(new NewRegistrationMail($email));
        }
    }
}
