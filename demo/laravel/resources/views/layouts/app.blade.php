<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>@yield('title', 'modern-spf demo')</title>
    <script src="/modern-spf.js"></script>
    <style>
        body { font-family: system-ui, sans-serif; max-width: 40rem; margin: 2rem auto; padding: 0 1rem; }
        nav a { margin-right: 1rem; }
        main { margin-top: 1rem; }
    </style>
</head>
<body>
    <nav>
        <a class="spf-link" href="/">Home</a>
        <a class="spf-link" href="/about">About</a>
        <a class="spf-link" href="/stream">Stream</a>
        <a class="spf-link spf-no-transition" href="/about">About (no transition)</a>
        <a class="spf-nolink" href="/plain">Plain (full load)</a>
    </nav>
    <main id="content">
        @yield('content')
    </main>
    <script>
        // Viewport prefetch and speculation rules are on by default; the demo
        // keeps them on so prefetching is observable in the network tab.
        spf.init({ speculation: 'prefetch' });
    </script>
</body>
</html>
