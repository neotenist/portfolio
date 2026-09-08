document.addEventListener('DOMContentLoaded', function () {
  var DEFAULT_NAME = 'Stranger';
  var storedName = null;
  try { storedName = sessionStorage.getItem('site_name'); } catch (e) {}
  var state = { lang: 'en', name: storedName || DEFAULT_NAME };
  var root = document.documentElement;

  /* .reveal-text paragraphs (short-version body copy) carry data-en/data-de too, but
     main.js owns rebuilding those -- overwriting textContent here would wipe out their
     per-word <span> reveal markup. */
  var i18nEls = document.querySelectorAll('[data-en]:not(.reveal-text)');
  var i18nPlaceholders = document.querySelectorAll('[data-en-placeholder]');
  var langBtns = document.querySelectorAll('[data-lang-btn]');

  function applyLang(lang) {
    state.lang = lang;
    root.setAttribute('lang', lang);
    root.setAttribute('data-lang', lang);

    i18nEls.forEach(function (el) {
      var text = el.getAttribute('data-' + lang);
      if (text !== null) el.textContent = text;
    });
    i18nPlaceholders.forEach(function (el) {
      var text = el.getAttribute('data-' + lang + '-placeholder');
      if (text !== null) el.setAttribute('placeholder', text);
    });
    langBtns.forEach(function (btn) {
      var active = btn.getAttribute('data-lang-btn') === lang;
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });

    document.dispatchEvent(new CustomEvent('site:langchange', { detail: { lang: lang } }));
  }

  langBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      applyLang(btn.getAttribute('data-lang-btn'));
    });
  });

  applyLang('en');

  /* ---------- NAME COLORING ----------
     Wherever the visitor's typed-in name is displayed (hero greeting, contact
     heading), each letter cycles through this order, repeating once the name
     runs longer than the color list. */
  var NAME_COLORS = ['#53add0', '#ed2f3e', '#df9a00', '#13ba4e', '#da3c76', '#000000'];
  function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function colorizeName(name) {
    return name.split('').map(function (ch, i) {
      return '<span style="color:' + NAME_COLORS[i % NAME_COLORS.length] + '">' + escapeHtml(ch) + '</span>';
    }).join('');
  }
  /* Builds the HTML for a typewriter reveal of `n` characters of `fullText`,
     coloring the name portion letter-by-letter as it's revealed instead of
     typing it plain and recoloring once done. */
  function typedColoredHTML(fullText, name, n) {
    var idx = fullText.indexOf(name);
    if (idx === -1) return escapeHtml(fullText.slice(0, n));
    var nameEnd = idx + name.length;
    var html = escapeHtml(fullText.slice(0, Math.min(n, idx)));
    if (n > idx) {
      var shown = name.slice(0, Math.min(n, nameEnd) - idx);
      html += colorizeName(shown);
    }
    if (n > nameEnd) html += escapeHtml(fullText.slice(nameEnd, n));
    return html;
  }

  /* Shared with main.js (homepage-only hero/animation logic) so both scripts read
     and react to the same name/language state instead of keeping two copies. */
  window.Site = { state: state, applyLang: applyLang, DEFAULT_NAME: DEFAULT_NAME, colorizeName: colorizeName, typedColoredHTML: typedColoredHTML };

  /* ---------- HEADER SCRIM (scroll-triggered) ----------
     The header's background scrim only needs to exist once something has
     actually scrolled in underneath it -- see .site-header::before in
     style.css, which stays fully transparent until this class is set. */
  var siteHeader = document.querySelector('.site-header');
  if (siteHeader) {
    var updateHeaderScrolled = function () {
      siteHeader.classList.toggle('is-scrolled', window.scrollY > 0);
    };
    updateHeaderScrolled();
    window.addEventListener('scroll', updateHeaderScrolled, { passive: true });
  }

  /* ---------- HEADER LOGO SIZE (non-home pages) ----------
     The homepage sizes its header logo dynamically once the wordmark shrinks into
     it (see main.js): width = the header's own container width * 0.2, height from
     the wordmark SVG's 1268:171 aspect ratio. Pages without a hero never run that,
     so they'd otherwise fall back to a fixed default that doesn't match -- this
     reproduces the exact same formula so the logo is identically sized everywhere. */
  if (!document.querySelector('.hero')) {
    var headerLogoImg = document.querySelector('#logo-slot img');
    var headerLogoSlot = document.getElementById('logo-slot');
    if (headerLogoImg && headerLogoSlot) {
      var sizeStaticHeaderLogo = function () {
        /* .header-inner, not .container-page itself: the container's own box
           (with box-sizing:border-box) includes its horizontal padding in
           getBoundingClientRect(), which overstates the available content width
           by exactly that padding -- .header-inner is the full-width child inside
           it, the same relationship main.js measures via #hero-wordmark-slot. */
        var inner = document.querySelector('.site-header .header-inner');
        if (!inner) return;
        /* Matches the MIN_LOGO_WIDTH floor in main.js's homepage dock -- a flat
           20% of the header width shrinks to an illegibly small logo on a narrow
           phone, so this keeps the same minimum here for consistency across pages. */
        var width = Math.max(inner.getBoundingClientRect().width * 0.2, 170);
        headerLogoImg.style.width = width + 'px';
        headerLogoImg.style.height = (width * (171 / 1268)) + 'px';
      };
      sizeStaticHeaderLogo();
      window.addEventListener('resize', sizeStaticHeaderLogo);
    }
  }

  /* ---------- GATE ----------
     Homepage-only (the markup simply isn't present on cv.html/work.html), and only
     once per browser session -- a returning visit within the same session skips
     straight past it using whatever name was given the first time. */
  var gate = document.getElementById('gate');
  if (gate) {
    var gateAlreadyDone = false;
    try { gateAlreadyDone = sessionStorage.getItem('site_gate_done') === '1'; } catch (e) {}

    if (gateAlreadyDone) {
      gate.style.display = 'none';
      /* Deferred to a fresh tick: dispatching synchronously here can fire before
         main.js's own DOMContentLoaded handler has run far enough to register its
         site:gateclosed listener (script order runs this handler first), which would
         silently drop the event and leave the hero entrance never started. */
      setTimeout(function () {
        document.dispatchEvent(new CustomEvent('site:gateclosed', { detail: { name: state.name } }));
      }, 0);
    } else {
      var gateForm = document.getElementById('gate-form');
      var gateInput = document.getElementById('gate-input');
      var gateSkip = document.getElementById('gate-skip');

      function closeGate(name) {
        state.name = name || DEFAULT_NAME;
        try {
          sessionStorage.setItem('site_gate_done', '1');
          sessionStorage.setItem('site_name', state.name);
        } catch (e) {}
        gsap.to(gate, {
          autoAlpha: 0,
          duration: 0.6,
          ease: 'power2.inOut',
          onComplete: function () {
            gate.style.display = 'none';
            document.dispatchEvent(new CustomEvent('site:gateclosed', { detail: { name: state.name } }));
          }
        });
      }

      gateForm.addEventListener('submit', function (e) {
        e.preventDefault();
        closeGate(gateInput.value.trim());
      });
      gateSkip.addEventListener('click', function () {
        closeGate(DEFAULT_NAME);
      });
    }
  } else {
    /* No gate on this page (cv.html/work.html) -- the homepage entrance sequence
       obviously doesn't apply here, but other listeners key off site:gateclosed,
       so fire it for consistency (deferred for the same reason as above). */
    setTimeout(function () {
      document.dispatchEvent(new CustomEvent('site:gateclosed', { detail: { name: state.name } }));
    }, 0);
  }

  /* ---------- MENU OVERLAY ---------- */
  var menuOverlay = document.getElementById('menu-overlay');
  var menuOpenBtn = document.getElementById('menu-open');
  var menuCloseBtn = document.getElementById('menu-close');
  if (menuOverlay && menuOpenBtn) {
    menuOpenBtn.addEventListener('click', function () {
      menuOverlay.classList.add('is-open');
      menuOpenBtn.classList.add('is-open');
    });
    if (menuCloseBtn) {
      menuCloseBtn.addEventListener('click', function () {
        menuOverlay.classList.remove('is-open');
        menuOpenBtn.classList.remove('is-open');
      });
    }
  }

  /* ---------- GENERIC SCROLL REVEAL (fade + rise), used across every section ---------- */
  var revealEls = document.querySelectorAll('.reveal');
  if (revealEls.length) {
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        revealObserver.unobserve(entry.target);
      });
    }, { threshold: 0.15 });
    revealEls.forEach(function (el) { revealObserver.observe(el); });
  }

  /* ---------- CONTACT CARD: typewriter heading, shared by every page ---------- */
  var contactTyped = document.getElementById('contact-typed');
  if (contactTyped) {
    var contactSection = document.getElementById('contact');
    var contactSub = document.getElementById('contact-sub');

    function typeContact() {
      var full = state.lang === 'de'
        ? ('Hey ' + state.name + ', lass uns reden!')
        : ('Hey ' + state.name + ', let\'s talk!');
      var proxy = { n: 0 };
      gsap.to(proxy, {
        n: full.length,
        duration: Math.max(0.6, full.length * 0.04),
        ease: 'none',
        onUpdate: function () {
          contactTyped.innerHTML = typedColoredHTML(full, state.name, Math.round(proxy.n));
        },
        onComplete: function () {
          contactTyped.dataset.done = '1';
          var idx = full.indexOf(state.name);
          var before = full.slice(0, idx);
          var after = full.slice(idx + state.name.length);
          contactTyped.innerHTML = before +
            '<span class="underline-word">' + colorizeName(state.name) +
            '<svg viewBox="0 0 200 12" preserveAspectRatio="none" aria-hidden="true">' +
            '<path d="M2 9c38-4 92-7 196-3" stroke="currentColor" stroke-width="4.5" stroke-linecap="round" fill="none"></path>' +
            '</svg></span>' + after;
          if (contactSub) contactSub.classList.add('is-in');
        }
      });
    }

    if (contactSection) {
      var contactObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          contactObserver.disconnect();
          typeContact();
        });
      }, { threshold: 0.3 });
      contactObserver.observe(contactSection);
    }

    document.addEventListener('site:langchange', function () {
      if (contactTyped.dataset.done === '1') {
        contactTyped.dataset.done = '';
        typeContact();
      }
    });
  }

  /* ---------- CV TIMELINE: accordion ----------
     Each role toggles independently (not exclusive-open) -- comparing two roles
     side by side is a reasonable thing to want on a CV, so opening one doesn't
     force-close another. The most recent role starts open since that's the one
     a visitor is most likely to want to read first. */
  var cvItems = document.querySelectorAll('.cv-item');
  if (cvItems.length) {
    cvItems[0].classList.add('is-open');
    cvItems.forEach(function (item) {
      var head = item.querySelector('.cv-item-head');
      head.setAttribute('aria-expanded', item.classList.contains('is-open') ? 'true' : 'false');
      head.addEventListener('click', function () {
        var isOpen = item.classList.toggle('is-open');
        head.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      });
    });
  }
});
