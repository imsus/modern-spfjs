<?php

namespace Tests\Feature;

use Tests\TestCase;

class SpfProtocolTest extends TestCase
{
    public function test_full_pages_render_the_spf_markup(): void
    {
        $response = $this->get('/about');

        $response->assertOk();
        $response->assertSee('spf-link');
        $response->assertSee('About page content');
    }

    public function test_spf_request_returns_a_single_json_response(): void
    {
        $response = $this->get('/about?spf=navigate');

        $response->assertOk();
        $response->assertHeader('Content-Type', 'application/x-spf+json');
        $response->assertJson(['title' => 'About — SPF']);
    }

    public function test_prefetch_and_load_identifiers_are_accepted(): void
    {
        foreach (['prefetch', 'load'] as $type) {
            $response = $this->get("/about?spf={$type}");

            $response->assertOk();
            $response->assertJsonPath('title', 'About — SPF');
        }
    }

    public function test_stream_returns_ndjson_parts_terminated_by_done(): void
    {
        $response = $this->get('/stream?spf=navigate');

        $response->assertOk();
        $response->assertHeader('Content-Type', 'application/x-spf+ndjson');

        $body = $response->streamedContent();
        foreach (['title', 'url', 'head', 'attr', 'body', 'foot', 'done'] as $part) {
            $this->assertStringContainsString('"part":"'.$part.'"', $body);
        }
        $this->assertStringEndsWith('{"part":"done"}'."\n", $body);
    }

    public function test_built_library_is_served_when_dist_exists(): void
    {
        $iife = base_path('../dist/index.iife.js');

        if (! file_exists($iife)) {
            $this->markTestSkipped('repo-root dist/ not built — run pnpm build first.');
        }

        $response = $this->get('/modern-spf.js');

        $response->assertOk();
        $response->assertHeader('Content-Type', 'text/javascript; charset=utf-8');
    }
}
