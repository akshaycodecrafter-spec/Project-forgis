/* ============================================================
   FORGIS — Strength Club · single-file build
   Dependency-free runtime: replaces GSAP/ScrollTrigger/Lenis
   with a tiny rAF tween core + IntersectionObserver.
   Same motion language: power2.out curves, 160ms micro-states,
   transform/opacity only, full prefers-reduced-motion respect.
   [Smooth Scroll] [Theme] [Menu] [Anchors] [Preloader]
   [Hero Intro] [Terminal Typing] [Reveals] [Counters]
   [Closer] [Scrollspy]
   ============================================================ */
(() => {
  'use strict';

  /* ----------------------------------------------------------
     Helpers
     ---------------------------------------------------------- */
  const qs = (s, c) => (c || document).querySelector(s);
  const qsa = (s, c) => Array.prototype.slice.call((c || document).querySelectorAll(s));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  const easeOutQuad = (t) => 1 - (1 - t) * (1 - t); /* GSAP power2.out */
  const RM = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const IO_OK = 'IntersectionObserver' in window;

  /* Minimal rAF tween — returns a promise, transform/opacity friendly */
  function tween(o) {
    o = o || {};
    const dur = o.dur != null ? o.dur : 500;
    const delay = o.delay || 0;
    const ease = o.ease || easeOutQuad;
    const upd = o.onUpdate || function () {};
    return new Promise((resolve) => {
      const t0 = performance.now() + delay;
      function step(now) {
        const raw = (now - t0) / dur;
        if (raw < 0) { requestAnimationFrame(step); return; }
        const p = ease(clamp01(raw));
        upd(p);
        if (raw < 1) requestAnimationFrame(step);
        else resolve();
      }
      requestAnimationFrame(step);
    });
  }

  const hideAt = (el, y) => { el.style.opacity = '0'; el.style.transform = 'translateY(' + y + 'px)'; };
  const drawTo = (el, p, y) => { el.style.opacity = String(p); el.style.transform = 'translateY(' + ((1 - p) * y) + 'px)'; };

  /* ----------------------------------------------------------
     [Smooth Scroll] — eased anchor scrolling with user-cancel.
     Native scroll position (no wrapper) keeps layout honest.
     ---------------------------------------------------------- */
  let scrollRaf = null;
  const cancelSmooth = () => { if (scrollRaf) { cancelAnimationFrame(scrollRaf); scrollRaf = null; } };
  ['wheel', 'touchstart'].forEach((ev) =>
    window.addEventListener(ev, cancelSmooth, { passive: true })
  );

  function smoothToY(target) {
    cancelSmooth();
    if (RM()) { window.scrollTo(0, target); return; }
    const start = window.pageYOffset;
    const dist = target - start;
    const dur = Math.max(350, Math.min(850, Math.abs(dist) * 0.45));
    const t0 = performance.now();
    const step = (now) => {
      const p = easeOutQuad(clamp01((now - t0) / dur));
      window.scrollTo(0, start + dist * p);
      if (p < 1) scrollRaf = requestAnimationFrame(step);
      else scrollRaf = null;
    };
    scrollRaf = requestAnimationFrame(step);
  }

  const lockScroll = (on) => document.documentElement.classList.toggle('is-locked', on);

  /* ----------------------------------------------------------
     [Theme]
     ---------------------------------------------------------- */
  function initTheme() {
    const btn = qs('#themeBtn');
    const root = document.documentElement;
    if (!btn) return;
    const isDark = () => root.getAttribute('data-theme') === 'dark';
    const paint = () => {
      btn.textContent = isDark() ? '[ LIGHT ]' : '[ DARK ]';
      btn.setAttribute('aria-pressed', String(isDark()));
      btn.setAttribute('aria-label', isDark() ? 'Switch to light theme' : 'Switch to dark theme');
    };
    paint();
    btn.addEventListener('click', () => {
      const next = isDark() ? 'light' : 'dark'; /* capture BEFORE mutating */
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('forge-theme', next); } catch (e) {}
      paint();
    });
  }

  /* ----------------------------------------------------------
     [Menu]
     ---------------------------------------------------------- */
  let menuOpen = false;
  let setMenu = () => {};

  function initMenu() {
    const btn = qs('#menuBtn');
    const menu = qs('#mobileMenu');
    if (!btn || !menu) return;
    setMenu = (open) => {
      menuOpen = open;
      menu.classList.toggle('open', open);
      btn.setAttribute('aria-expanded', String(open));
      btn.textContent = open ? '[ CLOSE ]' : '[ MENU ]';
      lockScroll(open);
    };
    btn.addEventListener('click', () => setMenu(!menuOpen));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && menuOpen) setMenu(false);
    });
    window.addEventListener('resize', () => {
      if (window.innerWidth > 900 && menuOpen) setMenu(false);
    });
  }

  /* ----------------------------------------------------------
     [Anchors]
     ---------------------------------------------------------- */
  function navOffset() {
    const nav = qs('#site-nav');
    return (nav ? nav.offsetHeight : 64) + 1;
  }

  function initAnchors() {
    document.addEventListener('click', (e) => {
      const a = e.target.closest ? e.target.closest('a[href^="#"]') : null;
      if (!a) return;
      const id = a.getAttribute('href');
      if (!id || id.length < 2) return;
      const el = qs(id);
      if (!el) return;
      e.preventDefault();
      if (menuOpen) setMenu(false);
      const y = el.getBoundingClientRect().top + window.pageYOffset - navOffset();
      smoothToY(Math.max(0, y));
      try { history.replaceState(null, '', id); } catch (err) {}
    });
  }

  /* ----------------------------------------------------------
     Typing engine
     ---------------------------------------------------------- */
  async function typeText(el, text, cps) {
    for (let i = 1; i <= text.length; i++) {
      el.textContent = text.slice(0, i);
      await sleep(cps);
    }
  }

  /* ----------------------------------------------------------
     [PRELOADER] — typed boot line, sharp cut. ~1s total.
     Skipped for reduced motion and returning sessions.
     ---------------------------------------------------------- */
  function forceClearPreloader() {
    const p = qs('#preloader');
    if (p) { p.remove(); lockScroll(false); }
  }

  async function runPreloader() {
    const pre = qs('#preloader');
    if (!pre) return;
    let seen = false;
    try { seen = sessionStorage.getItem('forge-seen') === '1'; } catch (e) {}
    try { sessionStorage.setItem('forge-seen', '1'); } catch (e) {}
    if (RM() || seen) { pre.remove(); return; }

    lockScroll(true);
    await typeText(qs('#preText'), 'FORGIS — STRENGTH CLUB', 22);
    await sleep(200);
    await tween({
      dur: 250,
      ease: (t) => t, /* power1.inOut approximated over such a short cut */
      onUpdate: (p) => { pre.style.opacity = String(1 - p); },
    });
    pre.remove();
    lockScroll(false);
  }

  /* ----------------------------------------------------------
     [HERO INTRO]
     ---------------------------------------------------------- */
  const heroEls = {};

  function collectHeroEls() {
    heroEls.title = qs('.hero-title');
    heroEls.status = qs('.hero-status');
    heroEls.sub = qs('.hero-sub');
    heroEls.ctas = qs('.cta-row');
    heroEls.meta = qs('.hero-meta');
    heroEls.panel = qs('#terminal');
  }

  function splitWords(h) {
    if (!h) return [];
    const words = h.textContent.trim().split(/\s+/);
    h.textContent = '';
    words.forEach((w, i) => {
      const outer = document.createElement('span');
      outer.className = 'w';
      const inner = document.createElement('span');
      inner.className = 'wi';
      inner.textContent = w;
      outer.appendChild(inner);
      h.appendChild(outer);
      if (i < words.length - 1) h.appendChild(document.createTextNode(' '));
    });
    return qsa('.wi', h);
  }

  function prepareIntro() {
    collectHeroEls();
    if (RM()) return null;

    const inners = splitWords(heroEls.title);
    inners.forEach((w) => { w.style.transform = 'translateY(120%)'; });
    [heroEls.status, heroEls.sub, heroEls.ctas, heroEls.meta].forEach((el) => hideAt(el, 16));
    if (heroEls.panel) hideAt(heroEls.panel, 16);

    const cmd = qs('#termCmd');
    const bits = qsa('.term-out, .term-final', heroEls.panel || document);
    if (cmd) cmd.textContent = '';
    bits.forEach((b) => { b.style.opacity = '0'; });

    return inners;
  }

  function playIntro(inners) {
    if (!inners.length) return;
    if (heroEls.title) heroEls.title.style.willChange = 'transform';
    if (heroEls.panel) heroEls.panel.style.willChange = 'transform, opacity';

    const wordTweens = () => Promise.all(
      inners.map((w, i) =>
        tween({
          dur: 550,
          delay: i * 60,
          onUpdate: (p) => { w.style.transform = 'translateY(' + ((1 - p) * 120) + '%)'; },
        })
      )
    );

    Promise.all([
      heroEls.panel ? tween({ dur: 500, onUpdate: (p) => drawTo(heroEls.panel, p, 16) }) : null,
      (async () => { await sleep(80); await tween({ dur: 450, onUpdate: (p) => drawTo(heroEls.status, p, 16) }); })(),
      (async () => { await sleep(180); await wordTweens(); })(),
      (async () => { await sleep(420); await tween({ dur: 450, onUpdate: (p) => drawTo(heroEls.sub, p, 16) }); })(),
      (async () => { await sleep(520); await tween({ dur: 450, onUpdate: (p) => drawTo(heroEls.ctas, p, 16) }); })(),
      (async () => { await sleep(600); await tween({ dur: 450, onUpdate: (p) => drawTo(heroEls.meta, p, 16) }); })(),
      (async () => { await sleep(800); runTerminal(); })(),
    ]).then(() => {
      if (heroEls.title) heroEls.title.style.willChange = 'auto';
    });
  }

  /* ----------------------------------------------------------
     [TERMINAL TYPING]
     ---------------------------------------------------------- */
  async function runTerminal() {
    const cmd = qs('#termCmd');
    const caret = qs('#termCaret');
    const scope = qs('#terminal') || document;
    const finalLine = qs('.term-final', scope);
    const outs = qsa('.term-out', scope);
    if (RM() || !cmd) return;

    await sleep(150);
    await typeText(cmd, 'forgis book --trial', 30);

    for (let i = 0; i < outs.length; i++) {
      await sleep(160);
      tween({ dur: 120, ease: (t) => t, onUpdate: (p) => { outs[i].style.opacity = String(p); } });
    }
    await sleep(280);
    if (caret) caret.style.display = 'none';
    if (finalLine) tween({ dur: 150, ease: (t) => t, onUpdate: (p) => { finalLine.style.opacity = String(p); } });
  }

  /* ----------------------------------------------------------
     [REVEALS]
     ---------------------------------------------------------- */
  function observeOnce(el, cb) {
    const io = new IntersectionObserver(
      (es) => {
        for (let i = 0; i < es.length; i++) {
          if (es[i].isIntersecting) { io.disconnect(); cb(); break; }
        }
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0 }
    );
    io.observe(el);
  }

  const prepReveal = (el) => {
    hideAt(el, 18);
    el.style.willChange = 'transform, opacity';
  };

  /* reveal end-state cleanup — inline styles removed so CSS
     :hover transforms (card lift etc.) are not overridden */
  const finishReveal = (el) => {
    el.style.opacity = '';
    el.style.transform = '';
    el.style.willChange = '';
  };

  function initReveals() {
    if (RM() || !IO_OK) return;

    qsa('[data-reveal]').forEach((el) => {
      prepReveal(el);
      observeOnce(el, () => {
        tween({ dur: 500, onUpdate: (p) => drawTo(el, p, 18) }).then(() => finishReveal(el));
      });
    });

    qsa('[data-reveal-group]').forEach((group) => {
      const kids = qsa(':scope > *', group);
      if (!kids.length) return;
      kids.forEach(prepReveal);
      observeOnce(group, () => {
        kids.forEach((k, i) => {
          tween({ dur: 500, delay: i * 70, onUpdate: (p) => drawTo(k, p, 18) }).then(() => finishReveal(k));
        });
      });
    });
  }

  /* ----------------------------------------------------------
     [COUNTERS]
     ---------------------------------------------------------- */
  function initStats() {
    const vals = qsa('.stat-val');
    if (!vals.length || RM() || !IO_OK) return;
    vals.forEach((el) => { el.textContent = '0' + (el.getAttribute('data-suffix') || ''); });
    observeOnce(qs('#stats'), () => {
      vals.forEach((el, i) => {
        const target = parseFloat(el.getAttribute('data-count')) || 0;
        const suffix = el.getAttribute('data-suffix') || '';
        const t0 = performance.now();
        const step = (now) => {
          const p = easeOutQuad(clamp01((now - t0 - i * 60) / 1200));
          el.textContent = Math.round(target * p).toLocaleString('en-US') + suffix;
          if (p < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
    });
  }

  /* ----------------------------------------------------------
     [CLOSER]
     ---------------------------------------------------------- */
  function initCloser() {
    const el = qs('#closerCmd');
    if (!el || RM() || !IO_OK) return;
    const text = el.textContent;
    el.textContent = '';
    observeOnce(qs('#closer'), () => { typeText(el, text, 34); });
  }

  /* ----------------------------------------------------------
     [SCROLLSPY]
     ---------------------------------------------------------- */
  function initSpy() {
    if (!IO_OK) return;
    const links = qsa('.nav-link[href^="#"]');
    const ids = {};
    links.forEach((l) => { ids[l.getAttribute('href').slice(1)] = l; });
    ids.top = null; /* hero clears the active state */

    Object.keys(ids).forEach((id) => {
      const sec = qs('section[id="' + id + '"]');
      if (!sec) return;
      new IntersectionObserver(
        (es) => {
          es.forEach((e) => {
            if (!e.isIntersecting) return;
            links.forEach((l) => l.classList.remove('active'));
            if (ids[id]) ids[id].classList.add('active');
          });
        },
        { rootMargin: '-50% 0px -50% 0px', threshold: 0 }
      ).observe(sec);
    });
  }

  /* ----------------------------------------------------------
     Boot — with a force-static safety net
     ---------------------------------------------------------- */
  function forceStatic() {
    qsa('.hero-title .wi, [data-reveal], [data-reveal-group] > *, .hero-status, .hero-sub, .cta-row, .hero-meta, #terminal, .term-out, .term-final')
      .forEach((el) => { el.style.opacity = ''; el.style.transform = ''; });
    const cmd = qs('#termCmd');
    if (cmd && !cmd.textContent) cmd.textContent = 'forgis book --trial';
    forceClearPreloader();
  }

  function boot() {
    initTheme();
    initMenu();
    initAnchors();

    const inners = prepareIntro();
    initReveals();
    initStats();
    initCloser();
    initSpy();

    setTimeout(forceClearPreloader, 4000);

    (async () => {
      await runPreloader();
      if (inners && inners.length) playIntro(inners);
    })();

    console.log(
      '%cFORGIS%c strength club — ready.',
      'background:#ff6a1a;color:#16100b;font-weight:700;padding:2px 6px;border-radius:2px',
      'color:inherit;padding-left:6px'
    );
  }

  try { boot(); } catch (err) { forceStatic(); }
})();

