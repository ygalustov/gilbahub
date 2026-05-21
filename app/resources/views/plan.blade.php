@extends('layouts.db-shell', ['title' => 'Plan', 'currentPage' => 'plan'])

@section('content')
        <div style="padding:40px;text-align:center;color:#5b6a65;margin-top:60px">
            <svg width="48" height="48" fill="none" viewBox="0 0 24 24" stroke="#c8d5cf" stroke-width="1.5" style="margin:0 auto 16px;display:block">
                <rect x="3" y="4" width="18" height="18" rx="2"/>
                <path stroke-linecap="round" stroke-linejoin="round" d="M16 2v4M8 2v4M3 10h18"/>
                <path stroke-linecap="round" d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/>
            </svg>
            <div style="font-size:16px;font-weight:600;color:#3d5247;margin-bottom:8px">Planning coming soon</div>
            <div style="font-size:13px;max-width:360px;margin:0 auto;line-height:1.6">
                Nutrition program, pre-emergent timing, PGR schedule, and seasonal recovery calendar — all in one place.
            </div>
        </div>
@endsection
