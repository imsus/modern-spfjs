/* Client demo glue for the modern-spf hono demo.
 * Classic script included on every page: logs all spf* events, wires the
 * programmatic API buttons (data-* attributes), the cache-unified toggle,
 * the managed script/style controls and the POST form. Initializes SPF last
 * so `spfready` lands in the log.
 *
 * SPF navigation replaces #content with fresh elements, so all wiring is
 * document-level delegation (the library itself delegates clicks the same
 * way) — listeners survive content swaps. */
(function () {
  'use strict';

  // The click-time events (spfready/spfclick/spfhistory/spfreload) are
  // dispatched synchronously and skip the registry — log them via the
  // document CustomEvent. The pipeline events go through spf.event.on.
  var SYNC_EVENTS = ['spfready', 'spfclick', 'spfhistory', 'spfreload'];
  var ASYNC_EVENTS = [
    'spfrequest',
    'spfprocess',
    'spfdone',
    'spferror',
    'spfpartprocess',
    'spfpartdone',
  ];

  var counter = 0;

  function appendLog(text) {
    var logEl = document.getElementById('eventlog');
    if (!logEl) return;
    counter += 1;
    var line = document.createElement('div');
    line.className = 'eventline';
    line.textContent = '#' + counter + ' ' + text;
    logEl.appendChild(line);
    while (logEl.childElementCount > 60) {
      logEl.removeChild(logEl.firstChild);
    }
  }

  ASYNC_EVENTS.forEach(function (name) {
    spf.event.on(name, function (detail) {
      appendLog(name + ' ' + JSON.stringify(detail));
    });
  });

  SYNC_EVENTS.forEach(function (name) {
    document.addEventListener(name, function (evt) {
      appendLog(name + ' ' + JSON.stringify(evt.detail));
    });
  });

  function refreshUi() {
    var cacheEl = document.getElementById('cachesize');
    if (cacheEl) cacheEl.textContent = String(spf.cache.size());

    var specEl = document.getElementById('speculation-status');
    if (specEl && specEl.textContent.indexOf('checking') === 0) {
      var supported =
        'supports' in HTMLScriptElement && HTMLScriptElement.supports('speculationrules');
      specEl.textContent = supported
        ? 'supported — a speculationrules script is injected for same-origin spf-links'
        : 'not supported in this browser';
    }
  }
  spf.event.on('spfdone', refreshUi);
  spf.event.on('spfpartdone', refreshUi);

  // — delegated clicks (survive SPF content swaps) —

  function wireClick(selector, run) {
    document.addEventListener('click', function (evt) {
      var target = evt.target;
      if (!target || !('closest' in target)) return;
      var trigger = target.closest(selector);
      if (trigger) {
        run(trigger);
      }
    });
  }

  wireClick('[data-spf-navigate]', function (el) {
    spf.navigate(el.getAttribute('data-spf-navigate'));
  });

  wireClick('[data-spf-navigate-notransition]', function (el) {
    spf.navigate(el.getAttribute('data-spf-navigate-notransition'), { noTransition: true });
  });

  wireClick('[data-spf-load]', function (el) {
    spf.load(el.getAttribute('data-spf-load'));
  });

  wireClick('[data-spf-process]', function (el) {
    fetch(el.getAttribute('data-spf-process') + '?spf=navigate')
      .then(function (res) {
        return res.json();
      })
      .then(function (response) {
        return spf.process(response);
      });
  });

  wireClick('[data-spf-prefetch]', function (el) {
    spf.prefetch(el.getAttribute('data-spf-prefetch')).then(function (response) {
      appendLog(
        'prefetched ' + el.getAttribute('data-spf-prefetch') + ' -> ' + JSON.stringify(response),
      );
    });
  });

  wireClick('#toggle-unified', function (el) {
    var next = !spf.config.get('cache-unified');
    spf.config.set('cache-unified', next);
    el.textContent = 'cache-unified: ' + String(next);
    appendLog('config cache-unified = ' + String(next));
  });

  wireClick('#load-widget', function () {
    // Bare specifier: resolves through the page import map (ADR 0003).
    spf.script.load('demo-widget', 'demo-widget').then(function (mod) {
      var out = document.getElementById('widgetout');
      if (out) out.textContent = mod.greet();
      appendLog('widget loaded (isLoaded: ' + String(spf.script.isLoaded('demo-widget')) + ')');
    });
  });

  wireClick('#unload-widget', function () {
    spf.script.unload('demo-widget');
    var out = document.getElementById('widgetout');
    if (out) out.textContent = 'widget unloaded (registry entry dropped; next load re-imports)';
    appendLog('widget unloaded (isLoaded: ' + String(spf.script.isLoaded('demo-widget')) + ')');
  });

  wireClick('#load-style', function () {
    spf.style.load('/demo-theme.css', 'demo-theme').then(function () {
      appendLog('style loaded (isLoaded: ' + String(spf.style.isLoaded('demo-theme')) + ')');
    });
  });

  wireClick('#unload-style', function () {
    spf.style.unload('demo-theme');
    appendLog('style unloaded (isLoaded: ' + String(spf.style.isLoaded('demo-theme')) + ')');
  });

  // — delegated form submit (SPF POST) —

  document.addEventListener('submit', function (evt) {
    var form = evt.target;
    if (!form || form.id !== 'spf-form') return;
    evt.preventDefault();
    spf.navigate(form.getAttribute('action'), {
      method: 'POST',
      postData: new FormData(form),
    });
  });

  spf.init({ speculation: 'prefetch', 'reload-identifier': 'spf=full' });
  refreshUi();
})();
