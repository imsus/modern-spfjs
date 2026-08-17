<?php

use App\Http\Controllers\SpfPageController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| modern-spf demo routes
|--------------------------------------------------------------------------
|
| Every page route answers both full-page and SPF requests. The controller
| detects the SPF URL identifier (?spf=navigate|prefetch|load — see
| docs/protocol.md) and responds with a single JSON object, or with an
| NDJSON stream for /stream.
|
*/

Route::get('/modern-spf.js', [SpfPageController::class, 'script']);

Route::get('/{page?}', [SpfPageController::class, 'page'])
    ->whereIn('page', ['home', 'about', 'stream', 'plain'])
    ->defaults('page', 'home');
