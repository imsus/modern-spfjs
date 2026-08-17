<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\File;
use Illuminate\View\View;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Serves the modern-spf demo: full Blade pages for plain requests and the SPF
 * wire protocol (docs/protocol.md) for requests carrying the URL identifier
 * (?spf=navigate|prefetch|load).
 */
class SpfPageController extends Controller
{
    private const PAGES = ['home', 'about', 'stream', 'plain'];

    /** Serves the library's IIFE build from the repo root dist/ directory. */
    public function script(): Response
    {
        $iife = base_path('../dist/index.iife.js');

        if (! File::exists($iife)) {
            return response('modern-spf not built — run `pnpm build` in the repo root first.', 500);
        }

        return response(File::get($iife), 200, ['Content-Type' => 'text/javascript; charset=utf-8']);
    }

    public function page(Request $request, string $page = 'home'): View|Response|StreamedResponse
    {
        // The route constrains $page via whereIn + defaults('page', 'home'),
        // so no re-validation is needed here.
        if ($this->isSpfRequest($request)) {
            return $page === 'stream'
                ? $this->streamResponse()
                : $this->jsonResponse($page);
        }

        return view($page, ['page' => $page]);
    }

    /** The SPF URL identifier: ?spf=navigate | prefetch | load. */
    private function isSpfRequest(Request $request): bool
    {
        return in_array($request->query('spf'), ['navigate', 'prefetch', 'load'], true);
    }

    /** Single JSON response: application/x-spf+json. */
    private function jsonResponse(string $page): Response
    {
        return response(json_encode($this->pageData($page)), 200, [
            'Content-Type' => 'application/x-spf+json',
        ]);
    }

    private function pageData(string $page): array
    {
        return match ($page) {
            'about' => [
                'title' => 'About — SPF',
                'body' => ['content' => '<p id="text">About via SPF</p>'],
            ],
            'plain' => [
                'title' => 'Plain — SPF',
                'body' => ['content' => '<p id="text">Plain via SPF</p>'],
            ],
            default => [
                'title' => 'Home — SPF',
                'body' => ['content' => '<p id="text">Home via SPF</p>'],
            ],
        };
    }

    /**
     * NDJSON stream: application/x-spf+ndjson, one part per line, terminated
     * by a done part. Parts are written incrementally (120ms apart) so the
     * stream is observable as it arrives.
     */
    private function streamResponse(): StreamedResponse
    {
        $parts = [
            ['part' => 'title', 'value' => 'Stream — SPF'],
            ['part' => 'url', 'value' => '/stream'],
            ['part' => 'head', 'html' => '<style>.streamed { color: green; }</style>'],
            ['part' => 'attr', 'id' => 'content', 'attrs' => ['data-streamed' => 'yes']],
            ['part' => 'body', 'id' => 'content', 'html' => '<p id="text" class="streamed">Streamed content</p>'],
            ['part' => 'foot', 'html' => ''],
            ['part' => 'done'],
        ];

        return response()->stream(function () use ($parts): void {
            // Stream incrementally only under the built-in server (cli-server
            // SAPI); PHPUnit runs under cli and captures the echo via
            // streamedContent() — never flush or sleep there.
            $streaming = PHP_SAPI === 'cli-server';

            if ($streaming) {
                while (ob_get_level() > 0) {
                    ob_end_flush();
                }
            }

            foreach ($parts as $part) {
                echo json_encode($part, JSON_UNESCAPED_SLASHES)."\n";

                if ($streaming) {
                    flush();
                    usleep(120_000);
                }
            }
        }, 200, ['Content-Type' => 'application/x-spf+ndjson']);
    }
}
