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

            $members = $query->get()->map(function ($m) use ($actor) {
                $m->can_remove = $actor->id !== $m->id;
                return $m;
            });
            $pending = User::query()->where('status', 'pending')->orderBy('created_at')->get();
            $allSites = Site::query()->orderBy('name')->get(['id', 'name']);

            // Pending invitations (all sites)
            $invitations = Invitation::query()
                ->join('sites', 'sites.id', '=', 'invitations.site_id')
                ->select('invitations.*', 'sites.name as site_name')
                ->orderBy('invitations.created_at', 'desc')
                ->get();

            return response()->json([
                'members'     => $members,
                'pending'     => $pending,
                'invitations' => $invitations,
                'all_sites'   => $allSites,
            ]);
        }

        // Manager: users across all their managed sites
        $managedSites = $actor->sites()
            ->wherePivotIn('role', ['manager'])
            ->orderBy('name')
            ->get(['sites.id', 'sites.name']);

        abort_if($managedSites->isEmpty(), 403);

        $siteId = $request->query('site_id');
        $siteIds = $managedSites->pluck('id')->all();

        $query = DB::table('site_user')
            ->join('users', 'users.id', '=', 'site_user.user_id')
            ->join('sites', 'sites.id', '=', 'site_user.site_id')
            ->whereIn('site_user.site_id', $siteIds)
            ->select('users.id', 'users.name', 'users.email', 'users.status', 'site_user.role', 'sites.id as site_id', 'sites.name as site_name')
            ->orderBy('users.name');

        if ($siteId && in_array($siteId, $siteIds)) {
            $query->where('site_user.site_id', $siteId);
        }

        $roleHierarchy = ['viewer' => 1, 'editor' => 2, 'manager' => 3, 'owner' => 4];
        $actorSiteRoles = $managedSites->keyBy('id')->map(fn($s) => $s->pivot->role);

        $members = $query->get()->map(function ($m) use ($actor, $roleHierarchy, $actorSiteRoles) {
            $actorLevel  = $roleHierarchy[$actorSiteRoles[$m->site_id] ?? ''] ?? 0;
            $targetLevel = $roleHierarchy[$m->role] ?? 0;
            $m->can_remove = $actor->id !== $m->id && $actorLevel > $targetLevel;
            return $m;
        });

        $invQuery = Invitation::query()
            ->join('sites', 'sites.id', '=', 'invitations.site_id')
            ->select('invitations.*', 'sites.name as site_name')
            ->whereIn('invitations.site_id', $siteIds)
            ->orderBy('invitations.created_at', 'desc');

        if ($siteId && in_array($siteId, $siteIds)) {
            $invQuery->where('invitations.site_id', $siteId);
        }

        return response()->json([
            'members'     => $members,
            'invitations' => $invQuery->get(),
            'all_sites'   => $managedSites,
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

        $roleHierarchy = ['viewer' => 1, 'editor' => 2, 'manager' => 3, 'owner' => 4];
        $actorLevel  = $actor->is_admin ? 99 : ($roleHierarchy[$actor->roleOnSite($siteModel)] ?? 0);
        $targetLevel = $roleHierarchy[$target->roleOnSite($siteModel)] ?? 0;
        abort_unless($actorLevel > $targetLevel, 403, 'Cannot remove a user with equal or higher role.');

        $target->sites()->detach($siteModel->id);

        // If removed site was the user's active site, switch to another or clear it
        if ($target->last_active_site_id === $siteModel->id) {
            $next = $target->sites()->first();
            $target->forceFill(['last_active_site_id' => $next?->id])->save();
        }

        return response()->json(['removed' => true]);
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
