/* ============================================================
   main.js — точка входа: прелоадер и запуск модулей
   Подключается последним, после nav.js / forms.js / motion.js
   ============================================================ */

(function () {
  'use strict';

  var SEEN_FLAG = 'sk:seen';
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasGsap = typeof window.gsap !== 'undefined';

  function hidePreloaderNow(el) {
    if (el) el.hidden = true;
  }

  /* Ждём шрифты перед разбивкой заголовка на слова —
     иначе SplitText посчитает ширины по запасной гарнитуре. */
  function whenFontsReady() {
    if (document.fonts && document.fonts.ready) {
      // Страховка: не ждём дольше 2 секунд, даже если шрифт не пришёл
      return Promise.race([
        document.fonts.ready,
        new Promise(function (r) { setTimeout(r, 2000); })
      ]);
    }
    return Promise.resolve();
  }

  function runPreloader(el) {
    return new Promise(function (resolve) {
      if (!el) { resolve(); return; }

      var seen = false;
      try { seen = sessionStorage.getItem(SEEN_FLAG) === '1'; } catch (e) { /* приватный режим */ }

      // Второй заход за сессию, reduced-motion или нет GSAP — сразу прячем
      if (seen || reduced || !hasGsap) {
        hidePreloaderNow(el);
        resolve();
        return;
      }

      try { sessionStorage.setItem(SEEN_FLAG, '1'); } catch (e) { /* игнорируем */ }

      var mark = el.querySelector('.preloader__mark');
      var bar = el.querySelector('.preloader__bar');

      var tl = gsap.timeline({
        onComplete: function () {
          hidePreloaderNow(el);
          resolve();
        }
      });

      tl.to(mark, { opacity: 1, scale: 1, duration: 0.5, ease: 'power3.out' }, 0)
        .fromTo(mark, { scale: 0.94 }, { scale: 1, duration: 0.7, ease: 'power3.out' }, 0);

      // Заполнение полосы рисует ::after, поэтому двигаем через CSS-переменную
      if (bar) {
        tl.to(bar, { '--bar': 1, duration: 0.75, ease: 'power2.inOut' }, 0.15);
      }

      // Штора уезжает вверх, открывая страницу
      tl.to(el, {
        yPercent: -100,
        duration: 0.75,
        ease: 'power4.inOut'
      }, 0.85);
    });
  }

  function boot() {
    // Навигация и формы не зависят от шрифтов — стартуем сразу
    if (window.SK && window.SK.nav) window.SK.nav.init();
    if (window.SK && window.SK.forms) window.SK.forms.init();

    var preloader = document.getElementById('preloader');

    whenFontsReady()
      .then(function () { return runPreloader(preloader); })
      .then(function () {
        if (window.SK && window.SK.motion) window.SK.motion.init();
      })
      .catch(function (err) {
        // Что бы ни сломалось в анимациях — контент должен остаться видимым
        console.error('[Sherikkon] Ошибка инициализации анимаций:', err);
        hidePreloaderNow(preloader);
        if (window.SK && window.SK.motion) window.SK.motion.settleStatic();
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
