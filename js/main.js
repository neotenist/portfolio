document.addEventListener('DOMContentLoaded', function () {
  /* Homepage-only: hero entrance, wordmark shrink, short-version reveal, head travel,
     folder carousel. Gate/lang/menu/generic-reveal/contact live in site.js and run on
     every page; this bails out entirely on cv.html/work.html, which don't have a hero. */
  if (!document.querySelector('.hero')) return;

  gsap.registerPlugin(ScrollTrigger);

  var state = window.Site.state;

  document.addEventListener('site:gateclosed', function () {
    startHeroSequence();
  });

  document.addEventListener('site:langchange', function () {
    if (heroStarted) {
      var greetTypedEl = document.getElementById('greet-typed');
      if (greetTypedEl) greetTypedEl.textContent = getGreetText(state.lang, state.name);
    }
    buildRevealText();
  });

  /* ---------- HERO SEQUENCE ---------- */
  var greetTyped = document.getElementById('greet-typed');
  var greetCursor = document.getElementById('greet-cursor');
  var wordmarkSlot = document.getElementById('hero-wordmark-slot');
  var wordmark = document.getElementById('hero-wordmark');
  var heroPills = document.getElementById('hero-pills');
  var headSlot = document.querySelector('.hero-head-slot');
  var heroPhoto = document.querySelector('.hero-photo');
  var navRight = document.getElementById('nav-right');
  var heroStarted = false;

  function getGreetText(lang, name) {
    return lang === 'de' ? ('Hi ' + name + '! Ich bin') : ('Hi ' + name + '! I\'m');
  }

  function typeGreeting(fullText, el, duration) {
    var proxy = { n: 0 };
    return gsap.to(proxy, {
      n: fullText.length,
      duration: duration,
      ease: 'none',
      onUpdate: function () {
        el.textContent = fullText.slice(0, Math.round(proxy.n));
      }
    });
  }

  /* Hero head size follows the viewport's height, capped at 90vw so it never overflows
     on a narrow/tall (mobile) screen. */
  function sizeHeroHead() {
    var vh = window.innerHeight;
    var vw = window.innerWidth;
    var ratio = heroPhoto.naturalWidth && heroPhoto.naturalHeight
      ? (heroPhoto.naturalWidth / heroPhoto.naturalHeight) : 0.70;
    var slotRect = headSlot.getBoundingClientRect();
    var height = slotRect.height;
    var width = height * ratio;
    var maxWidth = Math.min(slotRect.width, vw * 0.9);
    if (width > maxWidth) {
      width = maxWidth;
      height = width / ratio;
    }
    heroPhoto.style.width = width + 'px';
    heroPhoto.style.height = height + 'px';
    heroPhoto.style.left = ((slotRect.width - width) / 2) + 'px';
    heroPhoto.style.top = ((slotRect.height - height) / 2) + 'px';
  }

  /* Stop-motion face frames: 1-4 play once on entry, 5-7 play while the head travels on scroll */
  var INTRO_FRAMES = ['assets/img/1.png', 'assets/img/2.png', 'assets/img/3.png', 'assets/img/4-stop.png'];
  var TRAVEL_FRAMES = ['assets/img/5.png', 'assets/img/6.png', 'assets/img/7-stop.png'];
  var REST_FRAME = 'assets/img/4-stop.png';

  /* Swapping an <img src> mid-scroll (setHeadFrame below) forces a fresh network
     fetch + decode the first time each frame is requested -- on a slower mobile
     CPU that decode blocks the frame right as the scrub is trying to update,
     which is what reads as the photo "shaking"/stuttering while traveling.
     Warming the browser's image cache for every frame up front means every later
     src swap is just handing back an already-decoded bitmap. */
  INTRO_FRAMES.concat(TRAVEL_FRAMES).forEach(function (src) {
    var img = new Image();
    img.src = src;
  });

  /* delays[i] = how long frames[i] stays on screen before advancing to frames[i+1] */
  function playStopMotion(el, frames, delays, startIndex) {
    var i = startIndex || 0;
    function step() {
      if (i >= frames.length) return;
      var wait = delays[i - 1] !== undefined ? delays[i - 1] : 0;
      setTimeout(function () {
        el.setAttribute('src', frames[i]);
        i++;
        step();
      }, wait);
    }
    step();
  }

  function startHeroSequence() {
    heroStarted = true;
    sizeHeroHead();

    var tl = gsap.timeline();
    var fullText = getGreetText(state.lang, state.name);
    var typeDuration = Math.max(0.5, fullText.length * 0.045);

    tl.set(greetCursor, { autoAlpha: 1 })
      .call(function () { greetCursor.classList.add('is-blinking'); })
      .add(typeGreeting(fullText, greetTyped, typeDuration), 0)
      .addLabel('letters', '+=0.2')
      .call(function () {
        greetCursor.classList.remove('is-blinking');
      }, null, 'letters')
      .to(greetCursor, { autoAlpha: 0, duration: 0.3 }, 'letters')
      .call(function () { wordmark.classList.add('is-open'); }, null, 'letters')
      .call(function () { wordmarkSlot.classList.add('is-in'); }, null, 'letters+=0.45')
      .call(function () { navRight.classList.add('is-visible'); }, null, 'letters+=0.7')
      /* Wait until the wordmark bounce, pills and role text have all finished settling
         (pills finish around letters+1.35s) before the head starts its own entrance --
         otherwise it competes with those for attention and reads as jerky. The head
         itself fades in with a slight turn (see .hero-photo/.is-visible in style.css)
         instead of just snapping into view; only once that 0.5s settles does the
         stop-motion start: 500ms on the start frame, then 130ms on each frame in between. */
      .call(function () {
        heroPhoto.classList.add('is-visible');
      }, null, 'letters+=1.4')
      .call(function () {
        playStopMotion(heroPhoto, INTRO_FRAMES, [500, 90, 90], 1);
      }, null, 'letters+=1.9');
  }

  window.addEventListener('resize', sizeHeroHead);
  window.addEventListener('load', sizeHeroHead);

  /* ---------- SCROLL: HERO WORDMARK SHRINKS INTO THE HEADER LOGO ----------
     Tied directly and continuously to scroll position (scrub) instead of a fixed-duration
     tween fired once at a trigger point -- a discrete tween always reads as a "jump" because
     its motion is disconnected from how fast/slow the visitor is actually scrolling.

     Genuinely the SAME element throughout, not a crossfade between a hero copy and a
     separate header copy: #hero-wordmark scrubs its transform continuously while p<1,
     then at p>=1 switches to position:fixed pinned exactly over the (empty, space-
     reserving only) #logo-slot in the header -- same DOM node, same paint, so there is
     nothing to blink or swap between. Pills and role text are now plain siblings (not
     descendants) of the wordmark, so they never inherit its transform at all -- they
     just fade out on their own as p increases, instead of shrinking/moving with it. */
  var logoSlot = document.getElementById('logo-slot');
  var heroRole = document.getElementById('hero-role');
  var SHRINK_SCALE = 0.2;
  var MIN_LOGO_WIDTH = 170; // px -- a pure 0.2x scale reads fine on desktop but on a
  // narrow phone the hero wordmark itself is already fairly narrow, so 20% of it
  // shrinks to an illegibly small logo; this floors how far it's allowed to shrink.
  var SHRINK_SCROLL_DISTANCE = 220;
  var PILL_FADE_END = 0.35; // pills/role are fully gone well before the dock completes
  var shrunk = false;
  var wordBase = null;
  var shrinkFinal = null;
  var effectiveScale = SHRINK_SCALE;

  /* The entrance bounce (.is-open) is a CSS *animation* with fill-mode:both, which
     outranks inline styles for the same property for as long as it's "holding" its
     last frame -- left alone, that would fight every gsap.set(wordmark, {...}) below
     the moment scrolling starts. Dropping the animation once it's finished frees
     transform up for GSAP to own cleanly from then on. */
  wordmark.addEventListener('animationend', function () {
    /* The keyframe's own fill-mode:both hold (opacity:1, transform:scaleY(1)) is what's
       keeping the wordmark visible right up to this instant -- removing the animation
       drops that hold and reverts to the pre-.is-open base style (opacity:0), so it has
       to be restated explicitly before GSAP takes over. */
    wordmark.style.animation = 'none';
    gsap.set(wordmark, { opacity: 1 });
  }, { once: true });

  function captureWordBase() {
    gsap.set(wordmark, { x: 0, y: 0, scale: 1, position: 'relative', top: 'auto', left: 'auto', width: '100%', height: 'auto', zIndex: 'auto' });
    var r = wordmark.getBoundingClientRect();
    wordBase = {
      top: r.top + window.scrollY,
      left: r.left + window.scrollX,
      width: r.width,
      height: r.height
    };
    /* Locks the slot's own box to this height so it can't collapse once the wordmark
       (its only in-flow child) switches to position:fixed and stops contributing to it --
       without this, everything below the hero would jump upward the instant it docks. */
    wordmarkSlot.style.height = wordBase.height + 'px';
    effectiveScale = Math.max(SHRINK_SCALE, MIN_LOGO_WIDTH / wordBase.width);
    logoSlot.style.width = (wordBase.width * effectiveScale) + 'px';
    logoSlot.style.height = (wordBase.height * effectiveScale) + 'px';
  }

  function computeShrinkFinal(self) {
    if (!wordBase) captureWordBase();
    var logoRect = logoSlot.getBoundingClientRect();
    var wordViewportTopAtEnd = wordBase.top - self.end;
    shrinkFinal = {
      x: logoRect.left - wordBase.left,
      y: logoRect.top - wordViewportTopAtEnd
    };
  }

  var wordmarkHomeParent = wordmark.parentNode;
  var heroShellEl = document.querySelector('.hero-shell');

  function dockWordmark() {
    /* .hero has overflow:hidden (it clips other decorative hero content), and that
       clips a position:fixed descendant too once you've scrolled far enough that
       .hero's own box no longer overlaps the viewport -- the docked wordmark would
       just vanish from the header past that point. Moving it out to .hero-shell
       (a plain, unclipped ancestor -- same trick already used for the traveling
       head photo) while it's docked sidesteps that entirely. */
    if (wordmark.parentNode !== heroShellEl) heroShellEl.appendChild(wordmark);
    var logoRect = logoSlot.getBoundingClientRect();
    gsap.set(wordmark, {
      position: 'fixed',
      top: logoRect.top,
      left: logoRect.left,
      width: wordBase.width,
      height: wordBase.height,
      margin: 0,
      x: 0,
      y: 0,
      scale: effectiveScale,
      transformOrigin: 'top left',
      zIndex: 60
    });
  }

  ScrollTrigger.create({
    trigger: '.hero-greeting',
    start: 'top top',
    end: '+=' + SHRINK_SCROLL_DISTANCE,
    scrub: true,
    onRefresh: computeShrinkFinal,
    onUpdate: function (self) {
      if (!shrinkFinal) computeShrinkFinal(self);
      var p = self.progress;

      heroRole.style.transition = 'none';
      var fadeOpacity = 1 - Math.min(1, p / PILL_FADE_END);
      gsap.set(heroPills, { opacity: fadeOpacity });
      gsap.set(heroRole, { opacity: fadeOpacity });

      if (p >= 1) {
        shrunk = true;
        dockWordmark();
      } else {
        if (shrunk) {
          shrunk = false;
          if (wordmark.parentNode !== wordmarkHomeParent) wordmarkHomeParent.appendChild(wordmark);
          gsap.set(wordmark, { position: 'relative', top: 'auto', left: 'auto', width: '100%', height: 'auto', margin: 0, zIndex: 'auto' });
        }
        gsap.set(wordmark, {
          x: shrinkFinal.x * p,
          y: shrinkFinal.y * p,
          scale: 1 - (1 - effectiveScale) * p,
          transformOrigin: 'top left'
        });
      }
    }
  });

  window.addEventListener('load', function () {
    captureWordBase();
    ScrollTrigger.refresh();
  });

  /* ---------- SHORT VERSION: scroll-reveal text (one continuous pass, opacity 0.16 -> 1) ----------
     Rebuildable so a language switch can re-wrap each paragraph's words for the new
     language and re-create the scroll-tied reveal tween against the fresh spans --
     just resetting textContent (like the generic i18n loop does) would destroy the
     per-word <span> markup this effect depends on. */
  var revealParas = document.querySelectorAll('.reveal-text');
  var revealScrollTrigger = null;

  function buildRevealText() {
    var allRevealWords = [];
    revealParas.forEach(function (p) {
      var raw = p.getAttribute('data-' + state.lang) || p.getAttribute('data-en');
      var words = raw.split(/\s+/).filter(Boolean);
      p.innerHTML = words.map(function (w) { return '<span class="word">' + w + '</span>'; }).join(' ');
      allRevealWords = allRevealWords.concat(Array.prototype.slice.call(p.querySelectorAll('.word')));
    });

    if (revealScrollTrigger) revealScrollTrigger.kill();
    if (revealParas.length) {
      var tween = gsap.to(allRevealWords, {
        opacity: 1,
        stagger: 0.05,
        ease: 'none',
        scrollTrigger: {
          trigger: revealParas[0],
          endTrigger: revealParas[revealParas.length - 1],
          start: 'top 85%',
          end: 'bottom 60%',
          scrub: 0.3
        }
      });
      revealScrollTrigger = tween.scrollTrigger;
    }
  }
  buildRevealText();

  /* ---------- HEAD TRAVELS: hero -> docks beside "The short version", wrapped by the copy ---------- */
  var headTarget = document.getElementById('short-head-target');
  var heroSection = document.querySelector('.hero');
  var heroHeadWrapParent = heroPhoto.parentNode;
  var headTraveling = false;
  var headStart = null;

  function setHeadFrame(progress) {
    var idx = Math.min(TRAVEL_FRAMES.length - 1, Math.floor(progress * TRAVEL_FRAMES.length));
    var src = TRAVEL_FRAMES[idx];
    if (heroPhoto.getAttribute('src') !== src) heroPhoto.setAttribute('src', src);
  }

  function rectRelativeToShell(el) {
    var r = el.getBoundingClientRect();
    var shellRect = document.querySelector('.hero-shell').getBoundingClientRect();
    return { top: r.top - shellRect.top, left: r.left - shellRect.left, width: r.width, height: r.height };
  }

  /* headEnd used to be measured fresh (two getBoundingClientRect calls) on every
     single scroll update -- cheap on a fast desktop GPU, but that layout read
     competing with the scrub itself for frame time is exactly the kind of thing
     that shows up as visible jank/"shaking" on a slower mobile CPU. It doesn't
     change shape mid-scrub, so it only needs recomputing when the page layout
     itself actually changes (refresh/resize), not every frame. */
  var headEnd = null;
  function computeHeadEnd() {
    headEnd = rectRelativeToShell(headTarget);
  }

  ScrollTrigger.create({
    trigger: heroSection,
    start: 'bottom 80%',
    endTrigger: '.short-version-heading',
    end: 'top 30%',
    scrub: true,
    onRefresh: computeHeadEnd,
    onEnter: function () {
      headStart = rectRelativeToShell(heroPhoto);
      document.querySelector('.hero-shell').appendChild(heroPhoto);
      gsap.set(heroPhoto, {
        position: 'absolute', top: headStart.top, left: headStart.left,
        width: headStart.width, height: headStart.height, margin: 0, zIndex: 40, x: 0, y: 0, autoAlpha: 1
      });
      headTraveling = true;
    },
    onLeaveBack: function () {
      headTraveling = false;
      heroHeadWrapParent.appendChild(heroPhoto);
      gsap.set(heroPhoto, { position: 'absolute', margin: 0, zIndex: 30, x: 0, y: 0, autoAlpha: 1 });
      sizeHeroHead();
      heroPhoto.setAttribute('src', REST_FRAME);
    },
    onUpdate: function (self) {
      if (!headTraveling || !headStart) return;
      if (!headEnd) computeHeadEnd();
      var p = self.progress;
      gsap.set(heroPhoto, {
        top: headStart.top + (headEnd.top - headStart.top) * p,
        left: headStart.left + (headEnd.left - headStart.left) * p,
        width: headStart.width + (headEnd.width - headStart.width) * p,
        height: headStart.height + (headEnd.height - headStart.height) * p
      });
      setHeadFrame(p);
    },
    onLeave: function () {
      headTraveling = false;
      heroPhoto.setAttribute('src', TRAVEL_FRAMES[TRAVEL_FRAMES.length - 1]);
    },
    onEnterBack: function () {
      headTraveling = true;
    }
  });

  window.addEventListener('load', function () {
    sizeHeroHead();
    ScrollTrigger.refresh();
  });
  window.addEventListener('resize', function () {
    if (!headTraveling) sizeHeroHead();
    if (!shrunk) captureWordBase();
    ScrollTrigger.refresh();
  });

  /* ---------- WHAT I TAKE ON: folder fan carousel ----------
     Ported from the reference's own compiled logic: folders sit in a fixed
     array order; the currently "active" one always sits at --folder-x:0,
     the rest fan out from it via (index - activeIndex). Before the deck has
     entered view, they're stacked instead relative to the LAST folder, so
     they fade in already spread out ending on the last (rightmost) one --
     then jump to being centered on the FIRST folder in a big staggered
     arc once "is-in" kicks in. The paper (title + body) is normally tucked
     mostly out of sight and only slides fully into view via .paper-out --
     automatically ~2.35s after the entrance settles, or on tap/after a
     drag that changes the active folder. */
  var folderStage = document.getElementById('folder-stage');
  var folderFan = document.getElementById('folder-fan');
  var folderPositions = Array.prototype.slice.call(folderStage.querySelectorAll('.folder-position'));
  var folderTotal = folderPositions.length;
  var folderTimers = [];
  var activeIndex = 0;
  var isIn = false;

  function clearFolderTimers() {
    folderTimers.forEach(function (t) { clearTimeout(t); });
    folderTimers = [];
  }

  folderPositions.forEach(function (el, t) {
    el.style.setProperty('--rise-delay', (t * 75) + 'ms');
    el.style.setProperty('--arc-delay', ((folderTotal - 1 - t) * 100) + 'ms');
    el.style.setProperty('--arc-duration', (1600 + (folderTotal - 1 - t) * 100) + 'ms');
  });

  function layoutFolders() {
    folderPositions.forEach(function (el, t) {
      var n = isIn ? (t - activeIndex) : (t - (folderTotal - 1));
      el.style.setProperty('--folder-x', n);
      el.style.setProperty('--folder-abs', Math.abs(n));
      el.style.setProperty('--folder-order', folderTotal - Math.abs(n));
      el.setAttribute('data-active', n === 0 ? 'true' : 'false');
      el.setAttribute('aria-hidden', n !== 0 ? 'true' : 'false');
      el.querySelector('.folder').classList.toggle('is-active', n === 0);
    });
  }
  layoutFolders();

  function setPaperOut(on) {
    folderPositions.forEach(function (el) {
      var n = parseInt(el.style.getPropertyValue('--folder-x'), 10);
      el.classList.toggle('paper-out', !!on && n === 0);
    });
  }

  function goToFolder(index, duration) {
    duration = typeof duration === 'number' ? duration : 330;
    index = Math.max(0, Math.min(folderTotal - 1, index));
    setPaperOut(false);
    activeIndex = index;
    layoutFolders();
    var t = setTimeout(function () { setPaperOut(true); }, duration);
    folderTimers.push(t);
  }

  var takeOnHeading = document.getElementById('take-on-heading');

  /* The heading and the folder deck fade in on two independent triggers now --
     the heading still fades in once the folder-stage reaches ~80vh (that timing was
     confirmed correct), but the folders themselves shouldn't start their own entrance
     until later, once the HEADING (not the folder-stage) has scrolled up to ~35vh --
     otherwise the folders start animating right on the heading's heels instead of
     after a clear beat. */
  var headingObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      headingObserver.disconnect();
      takeOnHeading.classList.add('is-visible');
    });
  }, { threshold: 0, rootMargin: '-80% 0px -18% 0px' });
  headingObserver.observe(folderStage);

  var folderObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      folderObserver.disconnect();

      var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      folderStage.classList.add('is-visible');

      if (reduced) {
        isIn = true;
        layoutFolders();
        folderStage.classList.add('is-in');
        setPaperOut(true);
        return;
      }

      /* Fire the "is-in" re-arrange almost immediately after "is-visible" so the two
         phases blend into one continuous motion instead of reading as two separate
         beats. Each card's own --arc-delay/--arc-duration (set above) then staggers
         when it actually arrives, so the deck settles as a loose wave rather than
         snapping into place all at once -- the slowest card (first in the stack)
         finishes at 75ms + 400ms delay + 2000ms duration = 2475ms (~15% faster
         than before). */
      var t1 = setTimeout(function () {
        folderStage.classList.add('is-settling');
        isIn = true;
        folderStage.classList.add('is-in');
        layoutFolders();
      }, 75);
      var t2 = setTimeout(function () { folderStage.classList.remove('is-settling'); }, 2600);
      var t3 = setTimeout(function () { setPaperOut(true); }, 2700);
      folderTimers.push(t1, t2, t3);
    });
  }, { threshold: 0, rootMargin: '-25% 0px -73% 0px' });
  folderObserver.observe(takeOnHeading);

  var drag = { down: false, swiping: false, startX: 0, delta: 0, atEdge: false };
  var dragX = 0;

  function setDragX(px) {
    dragX = px;
    folderFan.style.setProperty('--drag-x', px + 'px');
  }

  function folderPointerDown(e) {
    drag.down = true;
    drag.swiping = false;
    drag.startX = e.touches ? e.touches[0].clientX : e.clientX;
    drag.delta = 0;
    drag.atEdge = false;
  }
  function folderPointerMove(e) {
    if (!drag.down) return;
    var x = e.touches ? e.touches[0].clientX : e.clientX;
    var t = x - drag.startX;
    drag.delta = t;
    if (!drag.swiping) {
      if (Math.abs(t) < 12) return;
      drag.swiping = true;
      folderStage.classList.add('is-dragging');
      setPaperOut(false);
    }
    /* Resistance only at the very last folder (dragging further forward) -- signals
       "end of the line". Dragging past the first folder backward behaves normally. */
    var atEdge = (activeIndex === folderTotal - 1 && t < 0);
    drag.atEdge = atEdge;
    setDragX(Math.max(-140, Math.min(140, atEdge ? t * 0.45 : t)));
  }
  function folderPointerUp() {
    if (!drag.down) return;
    var wasSwiping = drag.swiping, delta = drag.delta, atEdge = drag.atEdge;
    drag.down = false;
    drag.swiping = false;
    folderStage.classList.remove('is-dragging');

    if (!wasSwiping) {
      setDragX(0);
      if (isIn) setPaperOut(true);
      return;
    }
    if (atEdge) {
      setDragX(0);
      folderStage.classList.add('is-bouncing');
      var t = setTimeout(function () { folderStage.classList.remove('is-bouncing'); }, 650);
      folderTimers.push(t);
      return;
    }
    if (Math.abs(delta) > 55) {
      /* .folder-fan's own drag-offset normally eases back to 0 over 1.45s on its own
         bouncy curve (see CSS) -- fine for a released-but-cancelled drag, but on an
         actual swipe that curve was running at a different pace than each
         folder-position's own ~1.4s move to its new slot. Killing the fan's
         transition outright (an earlier attempt at this fix) removed the clash but
         then snapped the whole fan back by the full drag distance in a single
         frame, before the slot transition had moved at all -- an instant pop
         followed by the smooth part, which read as a jerk right at release
         (worse the further the drag had travelled, so more noticeable on a
         committed swipe than a light one). Matching the fan's own reset to the
         exact duration/easing the folder-positions move with with makes both
         animate on the same clock, landing together with no discontinuity. */
      clearFolderTimers();
      folderFan.style.transition = 'transform 1.4s cubic-bezier(0.4, 0, 0.2, 1)';
      setDragX(0);
      goToFolder(activeIndex + (delta < 0 ? 1 : -1));
      var restoreFanTransition = setTimeout(function () {
        folderFan.style.transition = '';
      }, 1450);
      folderTimers.push(restoreFanTransition);
    } else {
      setDragX(0);
    }
  }

  folderStage.addEventListener('mousedown', folderPointerDown);
  window.addEventListener('mousemove', folderPointerMove);
  window.addEventListener('mouseup', folderPointerUp);
  folderStage.addEventListener('touchstart', folderPointerDown, { passive: true });
  window.addEventListener('touchmove', folderPointerMove, { passive: true });
  window.addEventListener('touchend', folderPointerUp);

  /* ---------- OFF THE CLOCK: story-highlight viewer ----------
     Dots (left on desktop/tablet, a swipeable row on mobile) are highlights, exactly
     like Instagram: each one holds a few items that autoplay and loop among
     themselves once that highlight is open, but never auto-advance to a DIFFERENT
     highlight -- that only happens when you click a different dot. All items in a
     highlight share one caption. A highlight's ring is green until you've opened it
     once (tracked in sessionStorage, the same gate the name-prompt uses), then it
     goes gray for the rest of the session. */
  var ocStage = document.getElementById('ocStage');
  if (ocStage) {
    var ocDotsEls = Array.prototype.slice.call(ocStage.querySelectorAll('.oc-dot'));
    var ocProgressEl = document.getElementById('ocProgress');
    var ocMediaPh = document.getElementById('ocMediaPh');
    var ocMediaImg = document.getElementById('ocMediaImg');
    var ocMediaVideo = document.getElementById('ocMediaVideo');
    var ocCapTitle = document.getElementById('ocCapTitle');
    var ocCapText = document.getElementById('ocCapText');

    /* Fill in each item's `src` (and set type: 'video' where it applies) once real
       photos/clips exist -- until then an item just renders as its highlight's
       labelled color placeholder. `duration` is how long a photo item holds before
       advancing to the next item in the same highlight; update it to match a
       video's real length once one is in place. Caption is per-highlight, not
       per-item, on purpose -- every item in "Music & DJing" carries the same text. */
    var ocCategories = [
      { ph: 'oc-ph-0',
        title: { en: 'Music & DJing', de: 'Musik & DJing' },
        text: { en: 'Teaching myself how to DJ on the weekends. Work in progress, but the neighbours are surprisingly supportive.', de: 'Lehre mich am Wochenende das DJing. Work in progress, aber die Nachbarn sind überraschend geduldig.' },
        items: [ { type: 'photo', src: null, duration: 5000 }, { type: 'photo', src: null, duration: 5000 } ] },
      { ph: 'oc-ph-1',
        title: { en: 'My dog Poppy', de: 'Mein Hund Poppy' },
        text: { en: "Keeps me on my toes. She's only 1.5 years old and already running the show.", de: 'Hält mich auf Trab. Sie ist erst 1,5 Jahre alt und führt schon das Regiment.' },
        items: [ { type: 'photo', src: null, duration: 5000 }, { type: 'photo', src: null, duration: 5000 }, { type: 'photo', src: null, duration: 5000 } ] },
      { ph: 'oc-ph-2',
        title: { en: 'Cycling', de: 'Radeln' },
        text: { en: "I'm serious about it. Gravel bike and eMTB, both ready to get dirty.", de: 'Ich nehme das ernst. Gravelbike und eMTB, beide bereit, schmutzig zu werden.' },
        items: [ { type: 'photo', src: null, duration: 5000 }, { type: 'photo', src: null, duration: 5000 } ] },
      { ph: 'oc-ph-3',
        title: { en: 'Cooking & fermenting', de: 'Kochen & Fermentieren' },
        text: { en: "Eating is also a hobby, but you're not supposed to say that out loud. I ferment anything that stands still long enough.", de: 'Essen ist auch ein Hobby, aber das sagt man nicht so laut. Fermentiere nebenbei alles, was lange genug stillsteht.' },
        items: [ { type: 'photo', src: null, duration: 5000 }, { type: 'photo', src: null, duration: 5000 } ] },
      { ph: 'oc-ph-4',
        title: { en: 'Hiking', de: 'Wandern' },
        text: { en: 'More like a long walk, really. But being outside is the whole point.', de: 'Eher ein langer Spaziergang, ehrlich gesagt. Aber draußen sein zählt.' },
        items: [ { type: 'photo', src: null, duration: 5000 }, { type: 'photo', src: null, duration: 5000 } ] },
      { ph: 'oc-ph-5',
        title: { en: 'Coffee nerd', de: 'Kaffee-Nerd' },
        text: { en: 'Yes, the obnoxious type. Italian-style espresso machine, keeps me up and running.', de: 'Ja, der lästige Typ. Italienische Espressomaschine, hält mich wach und am Laufen.' },
        items: [ { type: 'photo', src: null, duration: 5000 }, { type: 'photo', src: null, duration: 5000 } ] }
    ];

    var OC_SEEN_KEY = 'site_oc_seen';
    var ocSeen = {};
    try { ocSeen = JSON.parse(sessionStorage.getItem(OC_SEEN_KEY) || '{}'); } catch (e) { ocSeen = {}; }

    var ocCatIndex = 0;
    var ocItemIndex = 0;
    var ocTimer = null;
    var ocStarted = false;

    function ocLang() {
      return (window.Site && window.Site.state && window.Site.state.lang) || 'en';
    }

    function ocRenderCaption() {
      var cat = ocCategories[ocCatIndex];
      var lang = ocLang();
      ocCapTitle.textContent = cat.title[lang] || cat.title.en;
      ocCapText.textContent = cat.text[lang] || cat.text.en;
    }

    function ocMarkSeen(catIndex) {
      if (ocSeen[catIndex]) return;
      ocSeen[catIndex] = true;
      try { sessionStorage.setItem(OC_SEEN_KEY, JSON.stringify(ocSeen)); } catch (e) {}
      ocDotsEls[catIndex].classList.add('is-seen');
    }

    function ocShowItem(i) {
      clearTimeout(ocTimer);
      var cat = ocCategories[ocCatIndex];
      ocItemIndex = (i + cat.items.length) % cat.items.length;
      var item = cat.items[ocItemIndex];

      ocMediaImg.hidden = true;
      ocMediaVideo.hidden = true;
      ocMediaVideo.pause();
      ocMediaPh.hidden = true;

      if (item.src && item.type === 'video') {
        ocMediaVideo.hidden = false;
        ocMediaVideo.src = item.src;
        ocMediaVideo.currentTime = 0;
        ocMediaVideo.play();
      } else if (item.src) {
        ocMediaImg.hidden = false;
        ocMediaImg.src = item.src;
      } else {
        ocMediaPh.hidden = false;
        ocMediaPh.className = 'oc-media-ph ' + cat.ph;
      }

      var bars = ocProgressEl.children;
      for (var b = 0; b < bars.length; b++) {
        bars[b].classList.remove('is-filling');
        bars[b].classList.toggle('is-done', b < ocItemIndex);
        bars[b].classList.toggle('is-active', b === ocItemIndex);
      }
      var activeBar = bars[ocItemIndex];
      var duration = item.duration || 5000;
      activeBar.style.setProperty('--fill-duration', (duration / 1000) + 's');
      requestAnimationFrame(function () { activeBar.classList.add('is-filling'); });
      /* Loops within this SAME highlight forever (modulo cat.items.length in the
         line above) -- it never touches ocCatIndex, so it can only ever move to a
         different highlight when a dot is clicked. */
      ocTimer = setTimeout(function () { ocShowItem(ocItemIndex + 1); }, duration);
    }

    function ocOpenCategory(i) {
      clearTimeout(ocTimer);
      ocCatIndex = (i + ocCategories.length) % ocCategories.length;
      ocDotsEls.forEach(function (d, di) { d.classList.toggle('is-active', di === ocCatIndex); });
      ocRenderCaption();
      ocProgressEl.innerHTML = ocCategories[ocCatIndex].items.map(function () { return '<i></i>'; }).join('');
      ocMarkSeen(ocCatIndex);
      ocShowItem(0);
    }

    ocDotsEls.forEach(function (dot, i) {
      if (ocSeen[i]) dot.classList.add('is-seen');
      dot.addEventListener('click', function () { ocOpenCategory(i); });
    });

    /* A real video's own natural end is the truer cue to advance than the guessed
       duration above -- harmless if both fire, since ocShowItem() clears the
       pending timer as soon as it's called either way. */
    ocMediaVideo.addEventListener('ended', function () { ocShowItem(ocItemIndex + 1); });

    document.addEventListener('site:langchange', ocRenderCaption);

    var ocObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting || ocStarted) return;
        ocStarted = true;
        ocObserver.disconnect();
        ocOpenCategory(0);
      });
    }, { threshold: 0.3 });
    ocObserver.observe(ocStage);
  }
});
