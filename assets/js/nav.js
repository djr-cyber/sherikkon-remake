/* ============================================================
   nav.js — шапка, мобильное меню, переходы между страницами
   Обычный скрипт (не module): сайт должен открываться и по file://
   ============================================================ */

window.SK = window.SK || {};

window.SK.nav = (function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasGsap = typeof window.gsap !== 'undefined';

  var header, burger, menu;
  var lastFocused = null;

  /* ---------- Состояние шапки при скролле ---------- */
  function initHeaderState() {
    header = document.getElementById('header');
    if (!header) return;

    var ticking = false;

    function update() {
      header.classList.toggle('is-scrolled', window.scrollY > 24);
      ticking = false;
    }

    // rAF-троттлинг: читаем scrollY максимум раз за кадр
    window.addEventListener('scroll', function () {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(update);
      }
    }, { passive: true });

    update();
  }

  /* ---------- Блокировка скролла без сдвига контента ---------- */
  function lockScroll(locked) {
    if (locked) {
      var gap = window.innerWidth - document.documentElement.clientWidth;
      if (gap > 0) document.body.style.paddingRight = gap + 'px';
      document.body.classList.add('is-locked');
    } else {
      document.body.classList.remove('is-locked');
      document.body.style.paddingRight = '';
    }
  }

  /* ---------- Мобильное меню ---------- */
  function getFocusable(root) {
    // offsetParent здесь не годится: .menu — position: fixed, и у его потомков
    // он ведёт себя неочевидно. Опираемся на реальные размеры бокса.
    return Array.prototype.filter.call(
      root.querySelectorAll('a[href], button:not([disabled]), input, textarea, select, [tabindex]:not([tabindex="-1"])'),
      function (el) {
        var r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      }
    );
  }

  function openMenu() {
    if (!menu || !burger) return;

    // Если меню открыли не с клавиатуры, activeElement — это <body>.
    // Возвращать туда фокус при закрытии бессмысленно, поэтому запоминаем бургер.
    var active = document.activeElement;
    lastFocused = (active && active !== document.body && active !== document.documentElement)
      ? active
      : burger;

    menu.removeAttribute('inert');
    menu.classList.add('is-open');
    burger.setAttribute('aria-expanded', 'true');
    burger.setAttribute('aria-label', 'Закрыть меню');
    lockScroll(true);

    if (hasGsap && !reduced) {
      gsap.fromTo(menu.querySelectorAll('.menu__link, .menu__footer > *'),
        { y: 28, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.5, stagger: 0.045, ease: 'power3.out', overwrite: true }
      );
    }

    // Ждём кадр: visibility переключается вместе с классом, а фокус
    // на ещё скрытый элемент браузер не отдаёт
    window.requestAnimationFrame(function () {
      var focusables = getFocusable(menu);
      if (focusables.length) focusables[0].focus();
    });

    document.addEventListener('keydown', onMenuKeydown);
  }

  function closeMenu() {
    if (!menu || !burger) return;

    menu.classList.remove('is-open');
    burger.setAttribute('aria-expanded', 'false');
    burger.setAttribute('aria-label', 'Открыть меню');
    lockScroll(false);

    // inert возвращаем после завершения перехода, иначе он обрежет анимацию
    window.setTimeout(function () {
      if (!menu.classList.contains('is-open')) menu.setAttribute('inert', '');
    }, reduced ? 0 : 320);

    document.removeEventListener('keydown', onMenuKeydown);

    if (lastFocused && document.contains(lastFocused)) lastFocused.focus();
    else burger.focus();
  }

  function onMenuKeydown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeMenu();
      return;
    }
    if (e.key !== 'Tab') return;

    // Фокус не должен выходить за пределы открытого меню
    var focusables = getFocusable(menu);
    if (!focusables.length) return;

    var first = focusables[0];
    var last = focusables[focusables.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  function initMenu() {
    burger = document.getElementById('burger');
    menu = document.getElementById('menu');
    if (!burger || !menu) return;

    // В разметке меню помечено hidden — это состояние «нет JS».
    // Здесь переключаемся на inert: ссылки не в таб-порядке, но анимируемы.
    menu.removeAttribute('hidden');
    menu.setAttribute('inert', '');

    burger.addEventListener('click', function () {
      if (burger.getAttribute('aria-expanded') === 'true') closeMenu();
      else openMenu();
    });

    // Клик по пункту меню закрывает его (переход обработает transitions)
    menu.addEventListener('click', function (e) {
      if (e.target.closest('a')) closeMenu();
    });

    // Возврат на десктоп при открытом меню не должен оставлять блокировку
    var desktop = window.matchMedia('(min-width: 1024px)');
    var onChange = function (e) { if (e.matches) closeMenu(); };
    if (desktop.addEventListener) desktop.addEventListener('change', onChange);
    else desktop.addListener(onChange);
  }

  /* ---------- Плавающий блок быстрой связи ----------
     Свёрнут в одну кнопку, раскрывается по клику — как на оригинале
     (виджет "chaty"). Разметка помечена hidden — это состояние «нет
     JS»; здесь переключаемся на inert, как и в мобильном меню, чтобы
     список оставался в потоке и иконки могли анимированно выезжать
     (CSS transform/opacity), а не просто появляться. */
  function initQuickContact() {
    var wrap = document.getElementById('quickContact');
    var toggle = document.getElementById('quickContactToggle');
    var list = document.getElementById('quickContactList');
    if (!wrap || !toggle || !list) return;

    list.removeAttribute('hidden');
    list.setAttribute('inert', '');

    toggle.addEventListener('click', function () {
      var open = !wrap.classList.contains('is-open');
      wrap.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.setAttribute('aria-label', open ? 'Закрыть контакты' : 'Открыть контакты');
      if (open) list.removeAttribute('inert');
      else list.setAttribute('inert', '');
    });
  }

  /* ---------- Подсветка текущего пункта меню ---------- */
  function initCurrentLink() {
    var here = window.location.pathname.split('/').pop() || 'index.html';
    var links = document.querySelectorAll('.nav__link, .menu__link');

    Array.prototype.forEach.call(links, function (link) {
      var target = (link.getAttribute('href') || '').split('#')[0];
      if (target && target === here) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
  }

  return {
    init: function () {
      initHeaderState();
      initMenu();
      initQuickContact();
      initCurrentLink();
    },
    closeMenu: closeMenu
  };
})();
