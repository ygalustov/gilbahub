@extends('layouts.db-shell', ['title' => 'Reports', 'currentPage' => 'reports'])

@section('content')
        <div style="padding:40px;text-align:center;color:#5b6a65;margin-top:60px">
            <svg width="48" height="48" fill="none" viewBox="0 0 24 24" stroke="#c8d5cf" stroke-width="1.5" style="margin:0 auto 16px;display:block">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
                <rect x="9" y="3" width="6" height="4" rx="1"/>
                <path stroke-linecap="round" d="M9 12h6M9 16h4"/>
            </svg>
            <div style="font-size:16px;font-weight:600;color:#3d5247;margin-bottom:8px">Reports coming soon</div>
            <div style="font-size:13px;max-width:360px;margin:0 auto;line-height:1.6">
                Word/PDF exports, forensic decision records, scenario comparisons, and forecast accuracy reports.
            </div>
        </div>
@endsection
