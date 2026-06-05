<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class ProfileController extends Controller
{
    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
        ]);

        $request->user()->forceFill(['name' => $data['name']])->save();

        return response()->json(['updated' => true]);
    }

    public function setPassword(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user->password_hash) {
            // Change existing password — require current password
            $data = $request->validate([
                'current_password' => ['required', 'string'],
                'new_password' => ['required', 'string', 'min:8', 'confirmed'],
            ]);

            if (! Hash::check($data['current_password'], $user->password_hash)) {
                return response()->json(['message' => 'Current password is incorrect.'], 422);
            }

            $user->forceFill([
                'password_hash' => Hash::make($data['new_password']),
                'password_prompt_shown' => true,
            ])->save();
        } else {
            // Set new password (no current password required)
            $data = $request->validate([
                'new_password' => ['required', 'string', 'min:8', 'confirmed'],
            ]);

            $user->forceFill([
                'password_hash' => Hash::make($data['new_password']),
                'password_prompt_shown' => true,
            ])->save();
        }

        return response()->json(['updated' => true, 'message' => 'Password set. You can now sign in with your password.']);
    }

    public function dismissPasswordPrompt(Request $request): JsonResponse
    {
        $request->user()->forceFill(['password_prompt_shown' => true])->save();

        return response()->json(['dismissed' => true]);
    }
}
