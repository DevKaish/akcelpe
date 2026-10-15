/* AKCELPE Insights — progressive enhancement. No dependencies.
   Works on /insights/ (search, filters, pagination) and article pages
   (table-of-contents highlighting, share + copy link, related articles). */
(function () {
  'use strict';

  var DATA = window.AKCEL_ARTICLES || null;
  /* Site base, worked out from this script's own URL, so assets resolve from file://, a subfolder, or the root. */
  var BASE = (function () {
    var sc = document.querySelector('script[src*="insights.js"]');
    var src = sc ? sc.getAttribute('src') : '/assets/js/insights.js';
    return src.replace(/assets\/js\/insights\.js.*$/, '');
  })();
  var IS_FILE = location.protocol === 'file:';
  function asset(u) { return BASE + String(u).replace(/^\//, ''); }
  function pageUrl(u) { var p = BASE + String(u).replace(/^\//, ''); return (IS_FILE && /\/$/.test(p)) ? p + 'index.html' : p; }
  if (IS_FILE) {  /* local preview: make links to these two sections open their index.html */
    Array.prototype.forEach.call(document.querySelectorAll('a[href^="/insights/"], a[href^="/blog/"]'), function (a) {
      a.setAttribute('href', pageUrl(a.getAttribute('href')));
    });
  }
  var PAGE_SIZE = 9;
  var DATE_FMT = (function () {
    try { return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }); }
    catch (e) { return null; }
  })();

  /* ---------- helpers ---------- */
  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'text') n.textContent = attrs[k];
      else if (k === 'class') n.className = attrs[k];
      else if (attrs[k] !== null && attrs[k] !== undefined) n.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }
  function fmtDate(iso) {
    var d = new Date(iso + 'T00:00:00Z');
    return DATE_FMT ? DATE_FMT.format(d) : iso;
  }
  function catLabel(slug) {
    if (!DATA) return slug;
    for (var i = 0; i < DATA.categories.length; i++) if (DATA.categories[i].slug === slug) return DATA.categories[i].label;
    return slug;
  }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }

  /* ---------- header menu (mobile) ---------- */
  (function () {
    var btn = document.querySelector('.nav-toggle');
    var nav = document.getElementById('site-nav');
    if (!btn || !nav) return;
    function set(open) { nav.classList.toggle('is-open', open); btn.setAttribute('aria-expanded', String(open)); btn.textContent = open ? 'Close' : 'Menu'; }
    btn.addEventListener('click', function () { set(!nav.classList.contains('is-open')); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && nav.classList.contains('is-open')) { set(false); btn.focus(); } });
  })();

  /* ---------- article card ---------- */
  function renderCard(a) {
    var img = el('img', { src: asset(a.image), alt: a.imageAlt || '', width: 1600, height: 900, loading: 'lazy', decoding: 'async' });
    var title = el('h3', { class: 'card__title' }, [el('a', { href: pageUrl(a.url), text: a.title })]);
    var meta = el('p', { class: 'meta' }, [
      el('span', { text: fmtDate(a.datePublished) }),
      el('span', { text: a.readingMinutes + ' min read' })
    ]);
    return el('li', null, [el('article', { class: 'card' }, [
      el('div', { class: 'card__media' }, [img]),
      el('div', { class: 'card__body' }, [
        el('span', { class: 'tag', text: catLabel(a.categories[0]) }),
        title,
        el('p', { class: 'card__summary', text: a.summary }),
        meta
      ])
    ])]);
  }

  /* ---------- listing page ---------- */
  var grid = document.getElementById('grid');
  if (grid) (function () {
    var form = document.getElementById('search-form');
    var input = document.getElementById('q');
    var chips = Array.prototype.slice.call(document.querySelectorAll('[data-cat]'));
    var statusEl = document.getElementById('results-status');
    var pager = document.getElementById('pager');
    var stateEl = document.getElementById('state');
    var featured = document.getElementById('featured-section');
    var library = document.getElementById('library');

    function showState(kind, title, text, withReset) {
      stateEl.innerHTML = '';
      stateEl.className = 'state' + (kind === 'error' ? ' state--error' : '');
      stateEl.appendChild(el('h3', { text: title }));
      stateEl.appendChild(el('p', { text: text }));
      if (withReset) {
        var b = el('button', { type: 'button', class: 'btn btn--ghost btn--sm', text: 'Clear search and filters' });
        b.addEventListener('click', function () { state.q = ''; state.cat = ''; state.page = 1; input.value = ''; render(true); });
        stateEl.appendChild(b);
      }
      stateEl.hidden = false;
    }

    if (!DATA || !DATA.articles) {
      grid.hidden = true;
      showState('error', 'We could not load the articles',
        'Please refresh the page. You can also browse official sources in the Research Centre.', false);
      return;
    }

    var params = new URLSearchParams(location.search);
    var state = {
      q: (params.get('q') || '').trim(),
      cat: params.get('cat') || '',
      page: Math.max(1, parseInt(params.get('page') || '1', 10) || 1)
    };
    if (!DATA.categories.some(function (c) { return c.slug === state.cat; })) state.cat = '';
    input.value = state.q;

    function matches(a) {
      if (state.cat && a.categories.indexOf(state.cat) === -1) return false;
      if (!state.q) return true;
      var hay = (a.title + ' ' + a.subtitle + ' ' + a.summary + ' ' + a.categories.map(catLabel).join(' ')).toLowerCase();
      return state.q.toLowerCase().split(/\s+/).every(function (t) { return hay.indexOf(t) !== -1; });
    }

    function syncUrl() {
      var p = new URLSearchParams();
      if (state.q) p.set('q', state.q);
      if (state.cat) p.set('cat', state.cat);
      if (state.page > 1) p.set('page', String(state.page));
      var qs = p.toString();
      try { history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + location.hash); } catch (e) { /* file:// etc. */ }
    }

    function buildPager(pages) {
      pager.innerHTML = '';
      if (pages <= 1) { pager.hidden = true; return; }
      pager.hidden = false;
      function btn(label, page, opts) {
        var b = el('button', { type: 'button', text: label });
        if (opts && opts.aria) b.setAttribute('aria-label', opts.aria);
        if (opts && opts.disabled) b.disabled = true;
        if (opts && opts.current) b.setAttribute('aria-current', 'page');
        b.addEventListener('click', function () { state.page = page; render(true); });
        return b;
      }
      pager.appendChild(btn('Previous', state.page - 1, { disabled: state.page === 1, aria: 'Previous page' }));
      for (var i = 1; i <= pages; i++) pager.appendChild(btn(String(i), i, { current: i === state.page, aria: 'Page ' + i }));
      pager.appendChild(btn('Next', state.page + 1, { disabled: state.page === pages, aria: 'Next page' }));
    }

    function render(scroll) {
      var filtering = !!(state.q || state.cat);
      var pool = DATA.articles.filter(function (a) { return filtering ? matches(a) : !a.featured; });
      pool.sort(function (a, b) { return a.datePublished < b.datePublished ? 1 : -1; });
      var pages = Math.max(1, Math.ceil(pool.length / PAGE_SIZE));
      if (state.page > pages) state.page = pages;
      var slice = pool.slice((state.page - 1) * PAGE_SIZE, state.page * PAGE_SIZE);

      chips.forEach(function (c) { c.setAttribute('aria-pressed', String((c.getAttribute('data-cat') || '') === state.cat)); });
      if (featured) featured.hidden = filtering;

      grid.innerHTML = '';
      stateEl.hidden = true;
      if (!pool.length) {
        grid.hidden = true;
        if (filtering) {
          showState('empty', 'No articles match your search',
            'Try a different word, or clear the filters to see everything that has been published.', true);
          statusEl.textContent = 'No articles found.';
        } else {
          showState('empty', 'More articles will appear here',
            'The featured guide above is the first article. New articles will be listed here as they are published.', false);
          statusEl.textContent = '';
        }
      } else {
        grid.hidden = false;
        slice.forEach(function (a) { grid.appendChild(renderCard(a)); });
        statusEl.textContent = plural(pool.length, 'article', 'articles') +
          (state.cat ? ' in ' + catLabel(state.cat) : '') + (state.q ? ' matching “' + state.q + '”' : '') +
          (pages > 1 ? ' · page ' + state.page + ' of ' + pages : '');
      }
      buildPager(pages);
      syncUrl();
      if (scroll && library) library.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    var t;
    input.addEventListener('input', function () {
      clearTimeout(t);
      t = setTimeout(function () { state.q = input.value.trim(); state.page = 1; render(false); }, 160);
    });
    form.addEventListener('submit', function (e) { e.preventDefault(); clearTimeout(t); state.q = input.value.trim(); state.page = 1; render(false); });
    chips.forEach(function (c) {
      c.addEventListener('click', function () { state.cat = c.getAttribute('data-cat') || ''; state.page = 1; render(false); });
    });
    render(false);
  })();

  /* ---------- article page ---------- */
  var prose = document.querySelector('.prose');
  if (prose) (function () {
    /* TOC: collapse on small screens, highlight current section */
    var toc = document.querySelector('details.toc');
    var mq = window.matchMedia ? window.matchMedia('(max-width: 1060px)') : null;
    if (toc && mq) {
      var apply = function () { toc.open = !mq.matches; };
      apply();
      if (mq.addEventListener) mq.addEventListener('change', apply);
      toc.querySelector('summary').addEventListener('click', function (e) { if (!mq.matches) e.preventDefault(); });
    }
    var links = Array.prototype.slice.call(document.querySelectorAll('.toc a[href^="#"]'));
    var heads = links.map(function (a) { return document.getElementById(a.getAttribute('href').slice(1)); }).filter(Boolean);
    if ('IntersectionObserver' in window && heads.length) {
      var current = null;
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { if (en.isIntersecting) current = en.target.id; });
        links.forEach(function (a) {
          if (a.getAttribute('href') === '#' + current) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
        });
      }, { rootMargin: '-96px 0px -70% 0px', threshold: 0 });
      heads.forEach(function (h) { io.observe(h); });
    }

    /* Share + copy link */
    var canonEl = document.querySelector('link[rel="canonical"]');
    var shareUrl = canonEl ? canonEl.href : location.href.split('#')[0];
    function legacyCopy(text) {
      var ta = el('textarea', { 'aria-hidden': 'true', readonly: '' });
      ta.value = text; ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
      document.body.appendChild(ta); ta.select();
      var ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(ta); return ok;
    }
    Array.prototype.forEach.call(document.querySelectorAll('[data-share]'), function (box) {
      var status = box.querySelector('.share-status');
      function say(msg) { if (status) { status.textContent = msg; setTimeout(function () { status.textContent = ''; }, 4000); } }
      var copyBtn = box.querySelector('[data-copy-link]');
      if (copyBtn) copyBtn.addEventListener('click', function () {
        var done = function (ok) { say(ok ? 'Link copied to clipboard.' : 'Could not copy automatically. Copy the address from your browser’s address bar.'); };
        if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(shareUrl).then(function () { done(true); }, function () { done(legacyCopy(shareUrl)); });
        else done(legacyCopy(shareUrl));
      });
      var native = box.querySelector('[data-native-share]');
      if (native && navigator.share) {
        native.hidden = false;
        native.addEventListener('click', function () {
          navigator.share({ title: document.title, url: shareUrl }).catch(function () { /* cancelled */ });
        });
      }
    });

    /* Related articles (from the shared data file) */
    var relBox = document.getElementById('related-articles');
    if (relBox && DATA) {
      var me = relBox.getAttribute('data-current');
      var cur = DATA.articles.filter(function (a) { return a.slug === me; })[0];
      var others = DATA.articles.filter(function (a) { return a.slug !== me; }).map(function (a) {
        var shared = cur ? a.categories.filter(function (c) { return cur.categories.indexOf(c) !== -1; }).length : 0;
        return { a: a, score: shared };
      }).sort(function (x, y) { return y.score - x.score || (x.a.datePublished < y.a.datePublished ? 1 : -1); }).slice(0, 3);
      if (others.length) {
        var list = relBox.querySelector('.grid');
        others.forEach(function (o) { list.appendChild(renderCard(o.a)); });
        relBox.hidden = false;
      }
    }
  })();
})();
