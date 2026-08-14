/* ============================================================
   main.js — точка входа: прелоадер и запуск модулей
   Подключается последним, после nav.js / forms.js / motion.js
   ============================================================ */

(function () {
  'use strict';

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

  function boot() {
    // Навигация и формы не зависят от шрифтов — стартуем сразу
    if (window.SK && window.SK.nav) window.SK.nav.init();
    if (window.SK && window.SK.forms) window.SK.forms.init();

    whenFontsReady()
      .then(function () {
        if (window.SK && window.SK.motion) window.SK.motion.init();
      })
      .catch(function (err) {
        // Что бы ни сломалось в анимациях — контент должен остаться видимым
        console.error('[Sherikkon] Ошибка инициализации анимаций:', err);
        if (window.SK && window.SK.motion) window.SK.motion.settleStatic();
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
