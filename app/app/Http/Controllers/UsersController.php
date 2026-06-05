<?php

namespace App\Http\Controllers;

use App\Models\Account;
use App\Models\Invitation;
use App\Models\Site;
use App\Models\SiteConfig;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Str;
use Illuminate\Validation\Rule;

class UsersController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $actor = $request->user();

        if ($actor->is_admin) {
            // Admin: all users across all sites
            $siteId = $request->query('site_id');

            $query = DB::table('site_user')
                ->join('users', 'users.id', '=', 'site_user.user_id')
                ->join('sites', 'sites.id', '=', 'site_user.site_id')
                ->select('users.id', 'users.name', 'users.email', 'users.status', 'site_user.role', 'sites.id as site_id', 'sites.name as site_name')
                ->orderBy('users.name');

            if ($siteId) {
                $query->where('sites.id', $siteId);
            }

            $members = $query->get();
            $pending = User::query()->where('status', 'pending')->orderBy('created_at')->get();
            $suspended = User::query()->where('status', 'suspended')->orderBy('name')->get();
            $allSites = Site::query()->orderBy('name')->get(['id', 'name']);

            // Pending invitations (all sites)
            $invitations = Invitation::query()
                ->join('sites', 'sites.id', '=', 'invitations.site_id')
                ->select('invitations.*', 'sites.name as site_name')
                ->orderBy('invitations.created_at', 'desc')
                ->get();

            return response()->json([
                'members' => $members,
                'pending' => $pending,
                'suspended' => $suspended,
                'invitations' => $invitations,
                'all_sites' => $allSites,
            ]);
        }

        // Manager: users on active site only
        $site = $actor->activeSite;
        abort_unless($site, 404);
        abort_unless($actor->canManageSite($site), 403);

        $members = DB::table('site_user')
            ->join('users', 'users.id', '=', 'site_user.user_id')
            ->where('site_user.site_id', $site->id)
            ->select('users.id', 'users.name', 'users.email', 'users.status', 'site_user.role')
            ->orderBy('users.name')
            ->get();

        $invitations = Invitation::query()
            ->where('site_id', $site->id)
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json([
            'members' => $members,
            'invitations' => $invitations,
        ]);
    }

    public function updateRole(Request $request, int $user): JsonResponse
    {
        $data = $request->validate([
            'role' => ['required', Rule::in(['manager', 'editor', 'viewer'])],
            'site_id' => ['required', 'string', 'exists:sites,id'],
        ]);

        $actor = $request->user();
        $site = Site::query()->findOrFail($data['site_id']);

        abort_unless($actor->canManageSite($site), 403);
        $this->assertCanGrantRole($actor, $site, $data['role']);

        $target = User::query()->findOrFail($user);
        abort_if($target->is_admin, 403);

        $target->sites()->updateExistingPivot($site->id, ['role' => $data['role']]);

        return response()->json(['updated' => true]);
    }

    public function removeSite(Request $request, int $user, string $site): JsonResponse
    {
        $actor = $request->user();
        $siteModel = Site::query()->findOrFail($site);

        abort_unless($actor->canManageSite($siteModel), 403);
        abort_if($actor->id === $user, 403, 'Cannot remove yourself.');

        $target = User::query()->findOrFail($user);
        $target->sites()->detach($siteModel->id);

        return response()->json(['removed' => true]);
    }

    public function suspend(Request $request, int $user): JsonResponse
    {
        abort_unless($request->user()->is_admin, 403);

        $target = User::query()->findOrFail($user);
        abort_if($target->is_admin, 403, 'Cannot suspend another admin.');

        $target->forceFill(['status' => 'suspended'])->save();

        // Invalidate existing sessions immediately
        DB::table('sessions')->where('user_id', $target->id)->delete();

        return response()->json(['suspended' => true]);
    }

    public function unsuspend(Request $request, int $user): JsonResponse
    {
        abort_unless($request->user()->is_admin, 403);

        $target = User::query()->findOrFail($user);
        $target->forceFill(['status' => 'active'])->save();

        return response()->json(['unsuspended' => true]);
    }

    public function approve(Request $request, int $user): JsonResponse
    {
        abort_unless($request->user()->is_admin, 403);

        $target = User::query()->findOrFail($user);
        abort_unless($target->status === 'pending', 422);

        // Create account for the new user
        $account = Account::query()->firstOrCreate(
            ['owner_user_id' => $target->id],
            [
                'display_name' => $target->name,
                'created_by_user_id' => $request->user()->id,
                'modified_by_user_id' => $request->user()->id,
            ]
        );

        // Create site with provisional name
        $siteName = "{$target->name}'s site";
        $site = Site::query()->create([
            'id' => (string) Str::uuid(),
            'account_id' => $account->id,
            'name' => $siteName,
            'slug' => Str::slug($siteName) ?: 'site',
            'provisional_name' => true,
            'site_type' => 'precinct',
            'created_by_user_id' => $request->user()->id,
            'modified_by_user_id' => $request->user()->id,
        ]);

        SiteConfig::query()->create([
            'site_id' => $site->id,
            'namespace' => 'gaip',
            'config' => (object)[],
            'synced_at' => now(),
        ]);

        // Attach user as manager
        $target->sites()->attach($site->id, ['role' => 'manager']);
        $target->forceFill([
            'status' => 'active',
            'last_active_site_id' => $site->id,
        ])->save();

        // Send magic link for first sign-in
        app(\App\Http\Controllers\MagicLinkController::class)->sendToEmail($target->email);

        return response()->json(['approved' => true]);
    }

    public function destroy(Request $request, int $user): JsonResponse
    {
        abort_unless($request->user()->is_admin, 403);

        $target = User::query()->findOrFail($user);
        abort_if($target->is_admin, 403, 'Cannot delete an admin account.');

        // Invalidate sessions
        DB::table('sessions')->where('user_id', $target->id)->delete();

        $target->delete();

        return response()->json(['deleted' => true]);
    }

    private function assertCanGrantRole(User $actor, Site $site, string $targetRole): void
    {
        abort_if($targetRole === 'admin', 403);

        $hierarchy = ['viewer' => 1, 'editor' => 2, 'manager' => 3];
        $actorLevel = $actor->is_admin ? 3 : ($hierarchy[$actor->roleOnSite($site)] ?? 0);
        $targetLevel = $hierarchy[$targetRole] ?? 0;

        abort_unless($actorLevel >= $targetLevel, 403);
    }
}
