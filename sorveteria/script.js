/* GR Visual Comunicações — Briefing da sorveteria (nova marca e reinauguração) */
(function () {
  'use strict';

  var STORE_KEY = 'grvisual-briefing-sorveteria-v1';
  var WHATSAPP_GR = '5527988435960';                 // WhatsApp que recebe as respostas
  var EMAIL_GR = 'grvisualcomunicacoes@gmail.com';   // e-mail que recebe as respostas (via FormSubmit)

  var $ = function (id) { return document.getElementById(id); };
  var form = $('briefing');
  var steps = Array.prototype.slice.call(document.querySelectorAll('.step'));
  var total = steps.length;
  var current = 1;
  var intro = $('intro'), quiz = $('quiz'), success = $('success');
  var backBtn = $('back-btn'), nextBtn = $('next-btn'), sendBtn = $('send-btn');
  var alertBox = $('form-alert');

  /* ---------- Armazenamento local ---------- */
  function load() { try { var r = localStorage.getItem(STORE_KEY); return r ? JSON.parse(r) : null; } catch (e) { return null; } }
  function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(collectState())); } catch (e) {} }
  function clearSaved() { try { localStorage.removeItem(STORE_KEY); } catch (e) {} }

  /* ---------- Grupos de seleção múltipla ---------- */
  function groupBoxes(name) {
    return Array.prototype.slice.call(document.querySelectorAll('input[type=checkbox][data-group="' + name + '"]'));
  }
  function syncGroup(name) {
    var h = $(name);
    if (h) h.value = groupBoxes(name).filter(function (c) { return c.checked; }).map(function (c) { return c.value; }).join('; ');
  }
  function addChip(name, value, checked) {
    value = (value || '').trim();
    if (!value) return false;
    var exists = groupBoxes(name).some(function (c) {
      if (c.value.toLowerCase() === value.toLowerCase()) { c.checked = true; return true; }
      return false;
    });
    if (!exists) {
      var wrap = document.querySelector('[data-chips="' + name + '"]');
      var label = document.createElement('label'); label.className = 'chip custom';
      var input = document.createElement('input');
      input.type = 'checkbox'; input.value = value; input.dataset.group = name; input.dataset.custom = '1';
      input.checked = checked !== false;
      var span = document.createElement('span'); span.textContent = value;
      label.appendChild(input); label.appendChild(span); wrap.appendChild(label);
    }
    syncGroup(name);
    return true;
  }
  document.querySelectorAll('[data-add-btn]').forEach(function (btn) {
    var name = btn.getAttribute('data-add-btn');
    var input = document.querySelector('[data-add-for="' + name + '"]');
    function doAdd() {
      if (addChip(name, input.value, true)) { input.value = ''; btn.closest('.field').classList.remove('invalid'); save(); }
      input.focus();
    }
    btn.addEventListener('click', doAdd);
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); doAdd(); } });
  });

  /* ---------- Estado ---------- */
  function collectState() {
    var fields = {};
    form.querySelectorAll('input[name], select[name], textarea[name]').forEach(function (el) {
      if (el.type === 'hidden') return;
      if (el.type === 'radio') { if (el.checked) fields[el.name] = el.value; }
      else fields[el.name] = el.value;
    });
    var groups = {};
    document.querySelectorAll('[data-group-box]').forEach(function (box) {
      var name = box.getAttribute('data-group-box');
      groups[name] = groupBoxes(name).filter(function (c) { return c.checked || c.dataset.custom; })
        .map(function (c) { return { v: c.value, c: c.checked, x: !!c.dataset.custom }; });
    });
    return { step: current, fields: fields, groups: groups };
  }
  function restore(s) {
    Object.keys(s.fields || {}).forEach(function (name) {
      form.querySelectorAll('[name="' + name + '"]').forEach(function (el) {
        if (el.type === 'radio') el.checked = (el.value === s.fields[name]); else el.value = s.fields[name];
      });
    });
    Object.keys(s.groups || {}).forEach(function (name) {
      (s.groups[name] || []).forEach(function (g) {
        if (g.x) addChip(name, g.v, g.c);
        else groupBoxes(name).forEach(function (c) { if (c.value === g.v) c.checked = g.c; });
      });
      syncGroup(name);
    });
  }

  /* ---------- Validação ---------- */
  function validateStep(n, focusFirst) {
    var step = steps[n - 1], firstBad = null;
    function mark(field, ok, el) { field.classList.toggle('invalid', !ok); if (!ok && !firstBad) firstBad = el || field; }
    step.querySelectorAll('input[required], select[required], textarea[required]').forEach(function (el) {
      var v = el.value.trim(), ok = v.length > 0;
      if (ok && el.type === 'email') ok = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
      if (ok && el.type === 'tel') ok = v.replace(/\D/g, '').length >= 10;
      mark(el.closest('.field'), ok, el);
    });
    step.querySelectorAll('input[type=email]:not([required]), input[type=tel]:not([required])').forEach(function (el) {
      var v = el.value.trim(); if (!v) return;
      var ok = el.type === 'email' ? /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) : v.replace(/\D/g, '').length >= 10;
      mark(el.closest('.field'), ok, el);
    });
    step.querySelectorAll('[data-required="radio"]').forEach(function (fs) {
      mark(fs, !!form.querySelector('input[name="' + fs.getAttribute('data-radio') + '"]:checked'), fs.querySelector('input'));
    });
    step.querySelectorAll('[data-required="group"]').forEach(function (fs) {
      mark(fs, groupBoxes(fs.getAttribute('data-group-box')).some(function (c) { return c.checked; }), fs.querySelector('input[type=checkbox]'));
    });
    if (firstBad && focusFirst) {
      firstBad.focus({ preventScroll: true });
      (firstBad.closest('.field') || firstBad).scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    return !firstBad;
  }
  form.addEventListener('input', function (e) {
    var f = e.target.closest('.field');
    if (f && f.classList.contains('invalid') && (e.target.type === 'checkbox' || e.target.type === 'radio' || e.target.value.trim())) f.classList.remove('invalid');
  });

  /* ---------- Navegação ---------- */
  function showStep(n, focus) {
    current = Math.max(1, Math.min(total, n));
    steps.forEach(function (s, i) { s.classList.toggle('active', i === current - 1); });
    backBtn.hidden = current === 1;
    nextBtn.hidden = current === total;
    sendBtn.hidden = current !== total;
    var pct = Math.round(((current - 1) / total) * 100);
    $('prog-label').innerHTML = '<b>Etapa ' + current + '</b> de ' + total;
    $('prog-pct').textContent = pct + '% concluído';
    $('prog-bar').setAttribute('aria-valuenow', pct);
    $('prog-bar').firstElementChild.style.width = Math.max(pct, 3) + '%';
    hideAlert();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (focus) { var h = steps[current - 1].querySelector('h2'); setTimeout(function () { h.focus({ preventScroll: true }); }, 50); }
    save();
  }
  $('start-btn').addEventListener('click', function () { intro.hidden = true; quiz.hidden = false; showStep(current, true); });
  nextBtn.addEventListener('click', function () {
    if (!validateStep(current, true)) { showAlert('Confira os campos destacados antes de continuar.'); return; }
    showStep(current + 1, true);
  });
  backBtn.addEventListener('click', function () { showStep(current - 1, true); });
  form.addEventListener('change', function (e) { if (e.target.dataset && e.target.dataset.group) syncGroup(e.target.dataset.group); save(); });
  var t; form.addEventListener('input', function () { clearTimeout(t); t = setTimeout(save, 400); });

  function showAlert(msg) { alertBox.textContent = msg; alertBox.hidden = false; }
  function hideAlert() { alertBox.hidden = true; alertBox.textContent = ''; }

  /* ---------- Respostas em texto ---------- */
  function questionOf(field) {
    var lab = field.querySelector('legend, label');
    var n = lab && lab.childNodes[0];
    return n ? n.textContent.trim() : '';
  }
  function valueOf(field) {
    var hidden = field.querySelector('input[type=hidden]');
    if (hidden) return hidden.value;
    var radio = field.querySelector('input[type=radio]:checked');
    if (radio) return radio.value;
    var ctrl = field.querySelector('input:not([type=radio]):not([data-add-for]), select, textarea');
    return ctrl ? ctrl.value.trim() : '';
  }
  function answers() {
    var list = [];
    steps.forEach(function (step) {
      var sec = { title: step.querySelector('h2').textContent, items: [] };
      step.querySelectorAll('.field').forEach(function (f) {
        var v = valueOf(f); if (v) sec.items.push({ q: questionOf(f), a: v });
      });
      list.push(sec);
    });
    return list;
  }
  function answersAsText() {
    var lines = ['*BRIEFING SORVETERIA — NOVA MARCA E REINAUGURAÇÃO*', 'GR Visual Comunicações', ''];
    answers().forEach(function (s) {
      if (!s.items.length) return;
      lines.push('*' + s.title.toUpperCase() + '*');
      s.items.forEach(function (it) { lines.push('• ' + it.q + '\n  ' + it.a); });
      lines.push('');
    });
    return lines.join('\n');
  }

  /* ---------- Envio por e-mail (FormSubmit) ---------- */
  function sendEmail() {
    var status = $('mail-status');
    var payload = {
      _subject: 'Briefing sorveteria — ' + ($('nome_responsavel').value.trim() || 'cliente'),
      _template: 'box',
      _captcha: 'false',
      Cliente: $('nome_responsavel').value.trim(),
      WhatsApp: $('whatsapp_cliente').value.trim(),
      Respostas: answersAsText().replace(/\*/g, '')
    };
    var em = $('email_cliente').value.trim();
    if (em) payload._replyto = em;
    status.className = 'status';
    status.textContent = 'Enviando para o e-mail da GR Visual…';
    return fetch('https://formsubmit.co/ajax/' + EMAIL_GR, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return r.ok && String(d.success) !== 'false'; }); })
      .then(function (ok) {
        status.className = 'status ' + (ok ? 'ok' : 'warn');
        status.textContent = ok ? '✓ Respostas enviadas para o e-mail da GR Visual.' : 'Não conseguimos enviar por e-mail agora. Envie pelo WhatsApp abaixo.';
      })
      .catch(function () {
        status.className = 'status warn';
        status.textContent = 'Sem conexão para enviar por e-mail. Envie pelo WhatsApp abaixo.';
      });
  }

  function waUrl() { return 'https://wa.me/' + WHATSAPP_GR + '?text=' + encodeURIComponent(answersAsText()); }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    hideAlert();
    for (var i = 1; i <= total; i++) {
      if (!validateStep(i, false)) {
        showStep(i, false); validateStep(i, true);
        showAlert(i === total ? 'Confira os campos destacados antes de enviar.' : 'Faltou responder algo na etapa ' + i + '. Confira os campos destacados.');
        return;
      }
    }
    document.querySelectorAll('[data-group-box]').forEach(function (b) { syncGroup(b.getAttribute('data-group-box')); });
    $('wa-link').href = waUrl();
    quiz.hidden = true; success.hidden = false;
    window.scrollTo({ top: 0 });
    success.focus({ preventScroll: true });
    sendEmail();
  });

  $('wa-link').addEventListener('click', function () { this.href = waUrl(); });

  $('copy-btn').addEventListener('click', function () {
    var txt = answersAsText(), msg = $('copy-msg');
    function done() { msg.textContent = 'Respostas copiadas! Cole no WhatsApp ou no e-mail da GR Visual.'; }
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = txt; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); done(); } catch (err) { msg.textContent = 'Não foi possível copiar automaticamente.'; }
      ta.remove();
    }
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(txt).then(done, fallback); else fallback();
  });
  $('done-btn').addEventListener('click', function () {
    clearSaved(); this.textContent = 'Pronto! Pode fechar esta página.'; this.disabled = true;
  });

  /* ---------- Início ---------- */
  var saved = load();
  if (saved) {
    restore(saved);
    current = saved.step || 1;
    if (Object.keys(saved.fields || {}).some(function (k) { return saved.fields[k]; })) {
      $('resume-note').hidden = false;
      $('start-btn').textContent = 'Continuar questionário →';
    }
  }
  steps[0].classList.add('active');
})();
