/* ============================================================
   motion.js — все GSAP-анимации

   Правила, которые здесь соблюдаются:
   · анимируем только transform и opacity (никаких width/top/left);
   · всё живёт внутри gsap.matchMedia — reduced-motion и мобильные
     получают свои, облегчённые ветки;
   · анимации прерываемы и не блокируют ввод;
   · ни одна анимация не вызывает reflow (нет layout shift).
   ============================================================ */

window.SK = window.SK || {};

window.SK.motion = (function () {
  'use strict';

  var mm;

  function register() {
    if (typeof gsap === 'undefined') return false;
    if (typeof ScrollTrigger !== 'undefined') gsap.registerPlugin(ScrollTrigger);
    if (typeof SplitText !== 'undefined') gsap.registerPlugin(SplitText);
    return true;
  }

  /* ============================================================
     Вспомогательное
     ============================================================ */

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  /* Элементы [data-reveal] вне героя — герой анимируется своим таймлайном */
  function revealTargets() {
    return $$('[data-reveal]').filter(function (el) { return !el.closest('.hero'); });
  }

  /* ============================================================
     Финальное состояние без анимаций (reduced-motion / нет GSAP)
     ============================================================ */
  function settleStatic() {
    $$('[data-reveal], [data-reveal-words]').forEach(function (el) {
      el.style.opacity = '1';
      el.style.transform = 'none';
    });
    $$('[data-count]').forEach(function (el) {
      el.textContent = el.dataset.count + (el.dataset.suffix || '');
    });
    $$('[data-step]').forEach(function (el) { el.classList.add('is-lit'); });

    var progress = $('#scrollProgress');
    if (progress) progress.style.display = 'none';
  }

  /* ============================================================
     Прогресс скролла
     ============================================================ */
  function initScrollProgress() {
    var bar = $('#scrollProgress');
    if (!bar) return;

    gsap.to(bar, {
      scaleX: 1,
      ease: 'none',
      scrollTrigger: {
        trigger: document.documentElement,
        start: 'top top',
        end: 'bottom bottom',
        scrub: 0.3
      }
    });
  }

  /* ============================================================
     Кастомный курсор (только точный указатель)
     ============================================================ */
  function initCursor() {
    var dot = $('#cursorDot');
    var ring = $('#cursorRing');
    if (!dot || !ring) return;

    var dotX = gsap.quickTo(dot, 'x', { duration: 0.12, ease: 'power3' });
    var dotY = gsap.quickTo(dot, 'y', { duration: 0.12, ease: 'power3' });
    var ringX = gsap.quickTo(ring, 'x', { duration: 0.5, ease: 'power3' });
    var ringY = gsap.quickTo(ring, 'y', { duration: 0.5, ease: 'power3' });

    window.addEventListener('mousemove', function (e) {
      dotX(e.clientX); dotY(e.clientY);
      ringX(e.clientX); ringY(e.clientY);
    }, { passive: true });

    // Кольцо расширяется над интерактивным
    var interactive = 'a, button, input, textarea, select, [role="button"], .card';
    document.addEventListener('mouseover', function (e) {
      if (e.target.closest(interactive)) ring.classList.add('is-active');
    });
    document.addEventListener('mouseout', function (e) {
      if (e.target.closest(interactive)) ring.classList.remove('is-active');
    });

    // За пределами окна курсор прячем
    document.addEventListener('mouseleave', function () {
      gsap.to([dot, ring], { opacity: 0, duration: 0.2 });
    });
    document.addEventListener('mouseenter', function () {
      gsap.to([dot, ring], { opacity: 1, duration: 0.2 });
    });

    return function cleanup() {
      gsap.set([dot, ring], { clearProps: 'all' });
      ring.classList.remove('is-active');
    };
  }

  /* ============================================================
     Магнитные кнопки
     ============================================================ */
  function initMagnetic() {
    var handlers = [];

    $$('[data-magnetic]').forEach(function (el) {
      var xTo = gsap.quickTo(el, 'x', { duration: 0.4, ease: 'power3' });
      var yTo = gsap.quickTo(el, 'y', { duration: 0.4, ease: 'power3' });

      function onMove(e) {
        var r = el.getBoundingClientRect();
        var relX = e.clientX - (r.left + r.width / 2);
        var relY = e.clientY - (r.top + r.height / 2);
        // Тянемся не более чем на треть размера — кнопка не «убегает»
        xTo(relX * 0.28);
        yTo(relY * 0.36);
      }
      function onLeave() {
        gsap.to(el, { x: 0, y: 0, duration: 0.7, ease: 'elastic.out(1, 0.3)' });
      }

      el.addEventListener('mousemove', onMove);
      el.addEventListener('mouseleave', onLeave);
      handlers.push({ el: el, onMove: onMove, onLeave: onLeave });
    });

    return function cleanup() {
      handlers.forEach(function (h) {
        h.el.removeEventListener('mousemove', h.onMove);
        h.el.removeEventListener('mouseleave', h.onLeave);
        gsap.set(h.el, { clearProps: 'transform' });
      });
    };
  }

  /* ============================================================
     Аврора в герое: медленный дрейф + параллакс на мышь
     ============================================================ */
  function initAurora() {
    var blobs = $$('.hero__blob');
    if (!blobs.length) return;

    blobs.forEach(function (blob, i) {
      gsap.to(blob, {
        xPercent: i % 2 === 0 ? 8 : -10,
        yPercent: i % 2 === 0 ? -6 : 9,
        duration: 16 + i * 4,
        ease: 'sine.inOut',
        repeat: -1,
        yoyo: true
      });
    });

    var hero = $('.hero');
    if (!hero) return;

    var setters = blobs.map(function (blob) {
      return {
        x: gsap.quickTo(blob, 'xPercent', { duration: 1.2, ease: 'power2' }),
        y: gsap.quickTo(blob, 'yPercent', { duration: 1.2, ease: 'power2' })
      };
    });

    function onMove(e) {
      var cx = (e.clientX / window.innerWidth - 0.5) * 2;   // -1..1
      var cy = (e.clientY / window.innerHeight - 0.5) * 2;
      setters.forEach(function (s, i) {
        var depth = (i + 1) * 2.5;
        s.x(cx * depth);
        s.y(cy * depth);
      });
    }

    hero.addEventListener('mousemove', onMove, { passive: true });
    return function cleanup() { hero.removeEventListener('mousemove', onMove); };
  }

  /* ============================================================
     Таймлайн героя
     ============================================================ */
  function heroTimeline() {
    var tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    var title = $('[data-reveal-words]');

    if (title && typeof SplitText !== 'undefined') {
      var split;
      try {
        // mask: 'words' в GSAP 3.13 сам оборачивает слова в клип-контейнеры
        split = new SplitText(title, { type: 'words', mask: 'words' });
      } catch (err) {
        split = new SplitText(title, { type: 'words' });
      }

      gsap.set(title, { opacity: 1 });
      tl.from(split.words, {
        yPercent: 115,
        opacity: 0,
        duration: 0.9,
        stagger: 0.05
      }, 0);
    } else if (title) {
      tl.to(title, { opacity: 1, y: 0, duration: 0.8 }, 0);
    }

    var heroBits = $$('.hero [data-reveal]');
    if (heroBits.length) {
      tl.to(heroBits, {
        opacity: 1,
        y: 0,
        duration: 0.7,
        stagger: 0.08
      }, 0.25);
    }

    var scrollHint = $('.hero__scroll');
    if (scrollHint) {
      tl.fromTo(scrollHint, { opacity: 0, y: -8 }, { opacity: 1, y: 0, duration: 0.6 }, 0.9);
      gsap.to(scrollHint, {
        y: 8,
        duration: 1.4,
        ease: 'sine.inOut',
        repeat: -1,
        yoyo: true,
        delay: 1.4
      });
    }

    return tl;
  }

  /* ============================================================
     Появление блоков при скролле (батчами, со stagger)
     ============================================================ */
  function initReveals() {
    var targets = revealTargets();
    if (!targets.length) return;

    function show(list, stagger) {
      if (!list.length) return;
      gsap.to(list, {
        opacity: 1,
        y: 0,
        duration: 0.75,
        ease: 'power3.out',
        stagger: stagger,
        overwrite: true
      });
    }

    // Всё, что уже выше линии появления, показываем сразу.
    // Иначе при заходе по якорю (#zayavka), обновлении страницы с сохранённой
    // позицией или мгновенном переходе блоки навсегда остаются с opacity: 0 —
    // ScrollTrigger.batch ловит только пересечение сверху вниз.
    function revealAlreadyInView() {
      var line = window.innerHeight * 0.85;
      var pending = targets.filter(function (el) {
        return parseFloat(gsap.getProperty(el, 'opacity')) < 1 &&
               el.getBoundingClientRect().top < line;
      });
      show(pending, 0.04);
    }

    ScrollTrigger.batch(targets, {
      start: 'top 85%',
      once: true,
      onEnter: function (batch) { show(batch, 0.06); }
    });

    revealAlreadyInView();

    // Пины меняют высоту документа и сдвигают точки входа —
    // после каждого пересчёта подчищаем всё, что осталось скрытым в кадре
    ScrollTrigger.addEventListener('refresh', revealAlreadyInView);
  }

  /* ============================================================
     Счётчики
     ============================================================ */
  function initCounters() {
    $$('[data-count]').forEach(function (el) {
      var target = parseFloat(el.dataset.count);
      var suffix = el.dataset.suffix || '';
      var obj = { v: 0 };

      ScrollTrigger.create({
        trigger: el,
        start: 'top 88%',
        once: true,
        onEnter: function () {
          gsap.to(obj, {
            v: target,
            duration: 1.6,
            ease: 'power2.out',
            onUpdate: function () {
              el.textContent = Math.round(obj.v) + suffix;
            },
            onComplete: function () {
              el.textContent = target + suffix;
            }
          });
        }
      });
    });
  }

  /* ============================================================
     Шаги решения: линия рисуется, точки загораются
     ============================================================ */
  function initSteps() {
    var steps = $$('[data-step]');
    if (!steps.length) return;

    var path = $('#stepsPath');
    if (path && path.getTotalLength) {
      var len = path.getTotalLength();
      gsap.set(path, { strokeDasharray: len, strokeDashoffset: len });

      gsap.to(path, {
        strokeDashoffset: 0,
        ease: 'none',
        scrollTrigger: {
          trigger: '#steps',
          start: 'top 75%',
          end: 'bottom 65%',
          scrub: 0.6
        }
      });
    }

    steps.forEach(function (step, i) {
      ScrollTrigger.create({
        trigger: step,
        start: 'top 80%',
        once: true,
        onEnter: function () {
          gsap.delayedCall(i * 0.12, function () { step.classList.add('is-lit'); });
        }
      });
    });
  }

  /* ============================================================
     Pin-секция «Проблема» — боли сменяют друг друга (только десктоп)
     ============================================================ */
  function initPinSection() {
    var section = $('[data-pin-section]');
    var list = $('[data-pin-items]');
    if (!section || !list) return;

    var pains = $$('[data-pain]', list);
    if (pains.length < 2) return;

    list.classList.add('is-stacked');
    gsap.set(pains, { opacity: 0, yPercent: 8 });
    gsap.set(pains[0], { opacity: 1, yPercent: 0 });

    var tl = gsap.timeline({
      scrollTrigger: {
        trigger: section,
        start: 'top top',
        end: '+=' + (pains.length * 70) + '%',
        pin: true,
        scrub: 0.8,
        anticipatePin: 1,
        invalidateOnRefresh: true
      }
    });

    for (var i = 1; i < pains.length; i++) {
      tl.to(pains[i - 1], { opacity: 0, yPercent: -8, duration: 0.5, ease: 'power2.in' })
        .to(pains[i],     { opacity: 1, yPercent: 0,  duration: 0.5, ease: 'power2.out' }, '<0.15')
        .to({}, { duration: 0.35 }); // пауза, чтобы успеть прочитать
    }

    return function cleanup() {
      list.classList.remove('is-stacked');
      gsap.set(pains, { clearProps: 'all' });
    };
  }

  /* ============================================================
     Горизонтальная лента проектов (только десктоп)
     ============================================================ */
  function initRail() {
    var rail = $('[data-rail]');
    var track = $('[data-rail-track]');
    if (!rail || !track) return;

    // Замеряем ДО перевода в driven-режим, пока работает нативный скролл
    var distance = track.scrollWidth - track.offsetWidth;
    if (distance <= 0) return;

    track.classList.add('is-driven');

    var hint = $('[data-rail-hint]');
    if (hint) hint.textContent = 'Прокручивайте страницу — лента едет вместе с вами';

    var tween = gsap.to(track, {
      x: -distance,
      ease: 'none',
      scrollTrigger: {
        trigger: rail,
        start: 'center center',
        end: '+=' + distance,
        pin: true,
        scrub: 0.7,
        anticipatePin: 1,
        invalidateOnRefresh: true
      }
    });

    // Клавиатура: браузер пытается доскроллить контейнер к элементу в фокусе —
    // сбрасываем, чтобы нативный скролл не рассинхронился с трансформом
    function onFocusIn() {
      if (track.scrollLeft !== 0) track.scrollLeft = 0;
    }
    track.addEventListener('focusin', onFocusIn);

    return function cleanup() {
      track.removeEventListener('focusin', onFocusIn);
      track.classList.remove('is-driven');
      if (tween.scrollTrigger) tween.scrollTrigger.kill();
      tween.kill();
      gsap.set(track, { clearProps: 'transform' });
      if (hint) hint.textContent = 'Листайте ленту вбок, чтобы увидеть все проекты';
    };
  }

  /* ============================================================
     Возврат к якорю после пересчёта триггеров

     ScrollTrigger.refresh() сохраняет и восстанавливает позицию скролла,
     и при заходе по внешней ссылке вида kontakti.html#zayavka это затирает
     переход браузера к якорю. Возвращаем его сами.
     ============================================================ */
  function restoreHashPosition() {
    if (!window.location.hash || window.location.hash.length < 2) return;

    var el;
    try { el = document.querySelector(window.location.hash); }
    catch (e) { return; }          // хеш может не быть валидным селектором
    if (!el) return;

    // instant, а не smooth: пользователь пришёл по прямой ссылке,
    // ему нужен результат, а не проезд через всю страницу
    try { el.scrollIntoView({ behavior: 'instant', block: 'start' }); }
    catch (e) { el.scrollIntoView(); }
  }

  /* ============================================================
     Точка входа
     ============================================================ */
  function init() {
    if (!register()) { settleStatic(); return; }

    mm = gsap.matchMedia();

    /* --- Ветка 1: пользователь просил меньше движения --- */
    mm.add('(prefers-reduced-motion: reduce)', function () {
      settleStatic();
    });

    /* --- Ветка 2: всё, кроме reduced-motion --- */
    mm.add('(prefers-reduced-motion: no-preference)', function () {
      heroTimeline();
      initReveals();
      initCounters();
      initSteps();
      initScrollProgress();
      initAurora();
    });

    /* --- Ветка 3: десктоп — кинематографика с pin --- */
    mm.add('(min-width: 1024px) and (prefers-reduced-motion: no-preference)', function () {
      var cleanPin = initPinSection();
      var cleanRail = initRail();
      var cleanMagnetic = initMagnetic();

      return function () {
        if (cleanPin) cleanPin();
        if (cleanRail) cleanRail();
        if (cleanMagnetic) cleanMagnetic();
      };
    });

    /* --- Ветка 4: курсор только для мыши --- */
    mm.add('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)', function () {
      return initCursor();
    });

    // Пины добавляют документу несколько тысяч пикселей, поэтому точки входа,
    // посчитанные до их создания, оказываются неверными: блоки ниже пинов
    // могут навсегда остаться скрытыми (например, при заходе сразу по якорю
    // #zayavka). Пересчитываем всё, когда триггеры уже созданы.
    window.requestAnimationFrame(function () {
      ScrollTrigger.refresh();
      restoreHashPosition();
    });

    // Картинки грузятся лениво и тоже меняют высоту документа
    window.addEventListener('load', function () {
      ScrollTrigger.refresh();
      restoreHashPosition();
    });
  }

  return { init: init, settleStatic: settleStatic };
})();
