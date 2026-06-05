<?php

namespace App\Http\Controllers;

use App\Models\Account;
use App\Models\Invitation;
use App\Models\MagicLink;
use App\Models\Site;
use App\Models\SiteConfig;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use App\Mail\AccountApprovedMail;
use App\Mail\MagicLinkMail;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;

class MagicLinkController extends Controller
{
    public function send(Request $request): \Illuminate\Http\JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
        ]);

        $email = strtolower(trim($data['email']));

        // Rate limit: relaxed in local env, strict in production
        $isLocal = app()->environment('local');
        $emailMax = $isLocal ? 20 : 3;
        $ipMax    = $isLocal ? 100 : 30;

        $emailKey = 'magic-link:email:' . sha1($email);
        $ipKey    = 'magic-link:ip:' . sha1($request->ip());

        if (RateLimiter::tooManyAttempts($emailKey, $emailMax) || RateLimiter::tooManyAttempts($ipKey, $ipMax)) {
            return response()->json(['message' => "If this email is recognized, you'll receive a link shortly."]);
        }

        RateLimiter::hit($emailKey, 3600);
        RateLimiter::hit($ipKey, 3600);

        $user = User::query()->where('email', $email)->first();
        $hasInvitation = Invitation::query()->where('email', $email)->exists();

        if ($user || $hasInvitation) {
            // Invalidate all existing magic links for this email
            MagicLink::query()->where('email', $email)->delete();

            $isPasswordReset = $request->boolean('password_reset');

            $token = Str::random(64);
            MagicLink::query()->create([
                'token' => $token,
                'email' => $email,
                'expires_at' => now()->addMinutes(15),
                'created_at' => now(),
            ]);

            $url = route('magic.verify', ['token' => $token]) . ($isPasswordReset ? '?password_reset=1' : '');

            Mail::to($email)->send(new MagicLinkMail($url, $isPasswordReset));
        }

        return response()->json(['message' => "If this email is recognized, you'll receive a link shortly."]);
    }

    public function verify(Request $request, string $token): RedirectResponse
    {
        $link = MagicLink::query()
            ->where('token', $token)
            ->first();

        if (! $link || $link->isExpired()) {
            return redirect()->route('login')->withErrors(['email' => 'This link has expired or is invalid. Please request a new one.']);
        }

        $email = $link->email;
        $isPasswordReset = $request->boolean('password_reset');

        // Delete token immediately (one-time use)
        $link->delete();

        $user = User::query()->where('email', $email)->first();

        if ($user) {
            $invitedSiteId = $link->site_id;

            $this->processPendingInvitations($user);

            Auth::login($user, remember: false);
            $request->session()->regenerate();

            if ($isPasswordReset) {
                return redirect()->route('settings')->with('open_password_modal', true);
            }

            if (! $user->last_active_site_id && $user->sites()->count() === 0) {
                $this->provisionFirstSite($user);
            } elseif ($invitedSiteId) {
                $user->forceFill(['last_active_site_id' => $invitedSiteId])->save();
            }

            return redirect()->intended(route('dashboard'));
        }

        // No account yet — create from invitation data and log in
        $invitedSiteId = $link->site_id;
        $invitation = Invitation::query()->where('email', $email)->first();
        $name = $invitation?->name ?? explode('@', $email)[0];

        $user = User::query()->create([
            'name' => $name,
            'email' => $email,
            'status' => 'active',
        ]);

        $this->processPendingInvitations($user);

        if ($user->sites()->count() === 0) {
            $this->provisionFirstSite($user);
        } elseif ($invitedSiteId) {
            $user->forceFill(['last_active_site_id' => $invitedSiteId])->save();
        }

        Auth::login($user, remember: false);
        $request->session()->regenerate();

        return redirect()->route('dashboard');
    }

    public function sendToEmail(string $email): void
    {
        MagicLink::query()->where('email', $email)->delete();

        $token = Str::random(64);
        MagicLink::query()->create([
            'token' => $token,
            'email' => $email,
            'expires_at' => now()->addMinutes(15),
            'created_at' => now(),
        ]);

        $url = route('magic.verify', ['token' => $token]);

        Mail::to($email)->send(new AccountApprovedMail($url));
    }

    private function provisionFirstSite(User $user): void
    {
        $account = Account::query()->firstOrCreate(
            ['owner_user_id' => $user->id],
            ['display_name' => $user->name, 'created_by_user_id' => $user->id, 'modified_by_user_id' => $user->id]
        );

        $siteName = "{$user->name}'s site";
        $site = Site::query()->create([
            'id' => (string) \Illuminate\Support\Str::uuid(),
            'account_id' => $account->id,
            'name' => $siteName,
            'slug' => \Illuminate\Support\Str::slug($siteName) ?: 'site',
            'provisional_name' => true,
            'site_type' => 'precinct',
            'created_by_user_id' => $user->id,
            'modified_by_user_id' => $user->id,
        ]);

        SiteConfig::query()->create([
            'site_id' => $site->id,
            'namespace' => 'gaip',
            'config' => (object) [],
            'synced_at' => now(),
        ]);

        if (! $user->is_admin) {
            $user->sites()->attach($site->id, ['role' => 'manager']);
        }

        $user->forceFill(['last_active_site_id' => $site->id])->save();
    }

    private function processPendingInvitations(User $user): void
    {
        $invitations = Invitation::query()->where('email', $user->email)->get();

        foreach ($invitations as $invitation) {
            if (! $user->sites()->where('sites.id', $invitation->site_id)->exists()) {
                $user->sites()->attach($invitation->site_id, ['role' => $invitation->role]);
            }
            $invitation->delete();
        }
    }
}
