@extends('layouts.app', ['title' => $title])

@section('body')
    <main class="content">
        <section class="panel">
            <h1>{{ $title }}</h1>
            <p class="muted">This protected page is ready for implementation.</p>
        </section>
    </main>
@endsection
