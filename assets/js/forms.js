/* ============================================================
   forms.js — валидация, маска телефона, состояния отправки

   ВАЖНО: статичный сайт сам никуда не отправляет данные.
   Всё, что нужно поменять при подключении бэкенда — функция
   submitLead() внизу файла. Пока она возвращает успех локально.
   ============================================================ */

window.SK = window.SK || {};

window.SK.forms = (function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ------------------------------------------------------------
     ЗДЕСЬ ПОДКЛЮЧАЕТСЯ ОТПРАВКА
     Замените тело функции на реальный запрос, например:

       return fetch('https://formspree.io/f/ВАШ_ID', {
         method: 'POST',
         headers: { 'Accept': 'application/json' },
         body: new FormData(form)
       }).then(function (r) {
         if (!r.ok) throw new Error('HTTP ' + r.status);
       });

     Функция должна возвращать Promise: resolve — успех, reject — ошибка.
     ------------------------------------------------------------ */
  var ENDPOINT = null; // ← укажите URL, чтобы включить реальную отправку

  function submitLead(form) {
    var data = new FormData(form);

    if (!ENDPOINT) {
      // Заглушка: показываем в консоли то, что ушло бы на сервер
      var payload = {};
      data.forEach(function (v, k) { payload[k] = v; });
      console.info('[Sherikkon] Заявка НЕ отправлена — ENDPOINT не задан в assets/js/forms.js', payload);
      return new Promise(function (resolve) { setTimeout(resolve, 900); });
    }

    return fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Accept': 'application/json' },
      body: data
    }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
    });
  }

  /* ---------- Правила проверки ---------- */
  var RULES = {
    name: function (v) { return v.trim().length >= 2; },
    // Узбекистан: +998 и 9 цифр. Допускаем и другие международные номера от 9 цифр.
    phone: function (v) {
      var digits = v.replace(/\D/g, '');
      if (/^998/.test(digits)) return digits.length === 12;
      return digits.length >= 9 && digits.length <= 15;
    },
    email: function (v) {
      if (!v.trim()) return true; // необязательное поле
      return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
    }
  };

  function fieldOf(input) { return input.closest('.field'); }

  function validateInput(input) {
    var rule = RULES[input.name];
    var value = input.value;
    var ok = true;

    if (input.required && !value.trim()) ok = false;
    else if (rule) ok = rule(value);

    var field = fieldOf(input);
    if (field) field.classList.toggle('has-error', !ok);
    input.setAttribute('aria-invalid', ok ? 'false' : 'true');

    return ok;
  }

  /* ---------- Маска телефона ---------- */
  function formatUzPhone(raw) {
    var d = raw.replace(/\D/g, '');

    // Нормализуем к 998XXXXXXXXX
    if (d.charAt(0) === '8' && d.length <= 10) d = '998' + d.slice(1);
    if (d.charAt(0) === '9' && d.charAt(1) !== '9') d = '998' + d;
    if (d.indexOf('998') !== 0) {
      // Иностранный номер — не навязываем формат Узбекистана
      return d ? '+' + d.slice(0, 15) : '';
    }

    d = d.slice(0, 12);
    var out = '+998';
    if (d.length > 3)  out += ' (' + d.slice(3, 5);
    if (d.length >= 5) out += ')';
    if (d.length > 5)  out += ' ' + d.slice(5, 8);
    if (d.length > 8)  out += ' ' + d.slice(8, 10);
    if (d.length > 10) out += ' ' + d.slice(10, 12);
    return out;
  }

  function initPhoneMask(input) {
    input.addEventListener('input', function () {
      // Курсор в конце — типичный сценарий ввода телефона
      var atEnd = input.selectionStart === input.value.length;
      var formatted = formatUzPhone(input.value);
      if (formatted !== input.value) {
        input.value = formatted;
        if (atEnd) input.setSelectionRange(formatted.length, formatted.length);
      }
      // Ошибку снимаем сразу, как только ввод стал валидным
      var field = fieldOf(input);
      if (field && field.classList.contains('has-error') && RULES.phone(input.value)) {
        validateInput(input);
      }
    });
  }

  /* ---------- Состояния кнопки ---------- */
  function setBusy(button, busy) {
    var label = button.querySelector('[data-btn-label]');
    var arrow = button.querySelector('.btn__arrow');

    if (busy) {
      button.disabled = true;
      button.dataset.prevLabel = label ? label.textContent : '';
      if (label) label.textContent = 'Отправляем…';
      if (arrow) arrow.innerHTML = '<span class="spinner" aria-hidden="true"></span>';
    } else {
      button.disabled = false;
      if (label && button.dataset.prevLabel) label.textContent = button.dataset.prevLabel;
      if (arrow) arrow.innerHTML = '<svg width="20" height="20" aria-hidden="true"><use href="#i-arrow-right"/></svg>';
    }
  }

  function showStatus(form, kind) {
    var all = form.querySelectorAll('[data-status]');
    Array.prototype.forEach.call(all, function (el) {
      el.classList.toggle('is-visible', el.dataset.status === kind);
    });
  }

  /* ---------- Инициализация формы ---------- */
  function initForm(form) {
    var inputs = form.querySelectorAll('.field__control');
    var submit = form.querySelector('button[type="submit"]');
    var phone = form.querySelector('input[type="tel"]');

    if (phone) initPhoneMask(phone);

    // Проверяем на blur, а не на каждое нажатие — не мешаем печатать
    Array.prototype.forEach.call(inputs, function (input) {
      input.addEventListener('blur', function () {
        if (input.value.trim() || input.required) validateInput(input);
      });
      // Уже показанную ошибку снимаем по ходу исправления
      input.addEventListener('input', function () {
        var field = fieldOf(input);
        if (field && field.classList.contains('has-error')) validateInput(input);
      });
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      showStatus(form, null);

      // Ловушка для ботов заполнена — тихо не отправляем
      var hp = form.querySelector('.hp input');
      if (hp && hp.value) return;

      var firstInvalid = null;
      Array.prototype.forEach.call(inputs, function (input) {
        if (!validateInput(input) && !firstInvalid) firstInvalid = input;
      });

      if (firstInvalid) {
        firstInvalid.focus();
        if (window.gsap && !reduced) {
          gsap.fromTo(fieldOf(firstInvalid),
            { x: -6 },
            { x: 0, duration: 0.4, ease: 'elastic.out(1, 0.35)' });
        }
        return;
      }

      setBusy(submit, true);

      submitLead(form).then(function () {
        setBusy(submit, false);
        form.reset();
        showStatus(form, 'success');

        if (window.gsap && !reduced) {
          gsap.fromTo(form.querySelector('[data-status="success"]'),
            { y: 12, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.45, ease: 'power3.out' });
        }
      }).catch(function (err) {
        console.error('[Sherikkon] Ошибка отправки заявки:', err);
        setBusy(submit, false);
        showStatus(form, 'error');
      });
    });
  }

  return {
    init: function () {
      var forms = document.querySelectorAll('form[id$="Form"], form[data-lead-form]');
      Array.prototype.forEach.call(forms, initForm);
    }
  };
})();
