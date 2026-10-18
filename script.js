/* GR Visual Comunicações — Questionário de briefing (Personal Organizer) */
(function () {
  'use strict';

  var STORE_KEY = 'grvisual-briefing-po-v1';
  var WHATSAPP_GR = '5527988598494'; // WhatsApp que recebe as respostas (DDI + DDD + número, só dígitos)
  var form = document.getElementById('briefing');
  var steps = Array.prototype.slice.call(document.querySelectorAll('.step'));
  var total = steps.length;
  var current = 1;
  var sending = false;

  var $ = function (id) { return document.getElementById(id); };
  var intro = $('intro'), quiz = $('quiz'), success = $('success');
  var backBtn = $('back-btn'), nextBtn = $('next-btn'), sendBtn = $('send-btn');
  var alertBox = $('form-alert');
  var svcList = $('svc-list'), svcTpl = $('svc-tpl'), svcField = $('tabela_servicos');

  /* ---------- Armazenamento local (protegido contra navegadores que bloqueiam) ---------- */
  function load() {
    try { var raw = localStorage.getItem(STORE_KEY); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(collectState())); } catch (e) { /* sem armazenamento: segue funcionando */ }
  }
  function clearSaved() { try { localStorage.removeItem(STORE_KEY); } catch (e) {} }

  /* ---------- Grupos de caixas de seleção ---------- */
  function groupBoxes(name) {
    return Array.prototype.slice.call(document.querySelectorAll('input[type=checkbox][data-group="' + name + '"]'));
  }
  function syncGroup(name) {
    var vals = groupBoxes(name).filter(function (c) { return c.checked; }).map(function (c) { return c.value; });
    var hidden = $(name);
    if (hidden) hidden.value = vals.join('; ');
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
      var label = document.createElement('label');
      label.className = 'chip custom';
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
      if (addChip(name, input.value, true)) { input.value = ''; clearFieldError(btn.closest('.field')); save(); }
      input.focus();
    }
    btn.addEventListener('click', doAdd);
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); doAdd(); } });
  });

  /* ---------- Tabela dinâmica de serviços ---------- */
  var svcCounter = 0;
  function addService(data) {
    var node = svcTpl.content.firstElementChild.cloneNode(true);
    svcCounter++;
    node.querySelectorAll('.field').forEach(function (f, i) {
      var ctrl = f.querySelector('input, select, textarea');
      var lab = f.querySelector('label');
      var id = 'svc' + svcCounter + '-' + i;
      ctrl.id = id; lab.setAttribute('for', id);
      if (data && data[ctrl.dataset.k] != null) ctrl.value = data[ctrl.dataset.k];
    });
    node.querySelector('[data-remove]').addEventListener('click', function () {
      if (svcList.children.length === 1) {
        node.querySelectorAll('[data-k]').forEach(function (c) { c.value = ''; });
      } else {
        node.remove();
      }
      renumber(); serializeServices(); save();
    });
    svcList.appendChild(node);
    renumber();
    return node;
  }
  function renumber() {
    Array.prototype.forEach.call(svcList.children, function (el, i) {
      el.querySelector('.svc-n').textContent = i + 1;
      el.querySelector('[data-remove]').setAttribute('aria-label', 'Remover serviço ' + (i + 1));
    });
  }
  function servicesData() {
    return Array.prototype.map.call(svcList.children, function (el) {
      var o = {};
      el.querySelectorAll('[data-k]').forEach(function (c) { o[c.dataset.k] = c.value.trim(); });
      return o;
    });
  }
  function serializeServices() {
    var rows = servicesData().filter(function (o) { return Object.keys(o).some(function (k) { return o[k]; }); });
    svcField.value = rows.map(function (o, i) {
      var lines = ['=== SERVIÇO ' + (i + 1) + ' ==='];
      Object.keys(o).forEach(function (k) { if (o[k]) lines.push(k + ': ' + o[k]); });
      return lines.join('\n');
    }).join('\n\n');
  }
  $('add-svc').addEventListener('click', function () {
    var node = addService();
    node.querySelector('input').focus();
    node.scrollIntoView({ behavior: 'smooth', block: 'start' });
    save();
  });

  /* ---------- Estado (salvar/restaurar) ---------- */
  function collectState() {
    var fields = {};
    form.querySelectorAll('input[name], select[name], textarea[name]').forEach(function (el) {
      if (el.type === 'hidden' || el.name === 'campo_extra' || el.name === 'tabela_servicos') return;
      if (el.type === 'radio') { if (el.checked) fields[el.name] = el.value; }
      else if (el.type === 'checkbox') { fields[el.name] = el.checked; }
      else fields[el.name] = el.value;
    });
    var groups = {};
    document.querySelectorAll('[data-group-box]').forEach(function (box) {
      var name = box.getAttribute('data-group-box');
      groups[name] = groupBoxes(name).filter(function (c) { return c.checked || c.dataset.custom; })
        .map(function (c) { return { v: c.value, c: c.checked, x: !!c.dataset.custom }; });
    });
    return { step: current, fields: fields, groups: groups, services: servicesData() };
  }
  function restore(state) {
    Object.keys(state.fields || {}).forEach(function (name) {
      var val = state.fields[name];
      var els = form.querySelectorAll('[name="' + name + '"]');
      els.forEach(function (el) {
        if (el.type === 'radio') el.checked = (el.value === val);
        else if (el.type === 'checkbox') el.checked = !!val;
        else el.value = val;
      });
    });
    Object.keys(state.groups || {}).forEach(function (name) {
      (state.groups[name] || []).forEach(function (g) {
        if (g.x) addChip(name, g.v, g.c);
        else groupBoxes(name).forEach(function (c) { if (c.value === g.v) c.checked = g.c; });
      });
      syncGroup(name);
    });
    svcList.innerHTML = '';
    var list = (state.services && state.services.length) ? state.services : [null];
    list.forEach(function (d) { addService(d); });
    serializeServices();
  }

  /* ---------- Validação ---------- */
  function setFieldError(field, on) { if (field) field.classList.toggle('invalid', on); }
  function clearFieldError(field) { setFieldError(field, false); }

  function validateStep(n, focusFirst) {
    var step = steps[n - 1];
    var firstBad = null;
    function bad(field, focusEl) { setFieldError(field, true); if (!firstBad) firstBad = focusEl || field; }

    step.querySelectorAll('input[required]:not([type=radio]):not([type=checkbox]), select[required], textarea[required]').forEach(function (el) {
      var field = el.closest('.field');
      var v = el.value.trim();
      var ok = v.length > 0;
      if (ok && el.type === 'email') ok = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
      if (ok && el.type === 'tel') ok = v.replace(/\D/g, '').length >= 10;
      if (ok) clearFieldError(field); else bad(field, el);
    });
    step.querySelectorAll('[data-required="radio"]').forEach(function (fs) {
      var name = fs.getAttribute('data-radio');
      var ok = !!form.querySelector('input[name="' + name + '"]:checked');
      if (ok) clearFieldError(fs); else bad(fs, fs.querySelector('input'));
    });
    step.querySelectorAll('[data-required="group"]').forEach(function (fs) {
      var name = fs.getAttribute('data-group-box');
      var ok = groupBoxes(name).some(function (c) { return c.checked; });
      if (ok) clearFieldError(fs); else bad(fs, fs.querySelector('input'));
    });
    step.querySelectorAll('input[type=checkbox][required]').forEach(function (el) {
      var field = el.closest('.field');
      if (el.checked) clearFieldError(field); else bad(field, el);
    });

    if (step.contains(svcList)) {
      var svcErr = $('svc-err');
      var anyValid = false;
      Array.prototype.forEach.call(svcList.children, function (el) {
        var filled = Array.prototype.some.call(el.querySelectorAll('[data-k]'), function (c) { return c.value.trim(); });
        el.querySelectorAll('[data-req]').forEach(function (c) {
          var miss = filled && !c.value.trim();
          setFieldError(c.closest('.field'), miss);
          if (miss && !firstBad) firstBad = c;
        });
        var complete = Array.prototype.every.call(el.querySelectorAll('[data-req]'), function (c) { return c.value.trim(); });
        if (complete) anyValid = true;
      });
      if (!anyValid) {
        svcErr.style.display = 'block';
        if (!firstBad) firstBad = svcList.querySelector('[data-req]');
      } else {
        svcErr.style.display = '';
      }
    }

    if (firstBad && focusFirst) {
      firstBad.focus({ preventScroll: true });
      (firstBad.closest('.field') || firstBad).scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    return !firstBad;
  }

  // Remove o destaque de erro assim que a pessoa corrige
  form.addEventListener('input', function (e) {
    var f = e.target.closest('.field');
    if (f && f.classList.contains('invalid')) {
      var el = e.target;
      if ((el.type === 'checkbox' || el.type === 'radio') ? true : el.value.trim()) clearFieldError(f);
    }
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
    if (focus) {
      var h = steps[current - 1].querySelector('h2');
      setTimeout(function () { h.focus({ preventScroll: true }); }, 50);
    }
    save();
  }

  $('start-btn').addEventListener('click', function () {
    intro.hidden = true; quiz.hidden = false;
    showStep(current, true);
  });
  nextBtn.addEventListener('click', function () {
    if (!validateStep(current, true)) { showAlert('Confira os campos destacados antes de continuar.'); return; }
    showStep(current + 1, true);
  });
  backBtn.addEventListener('click', function () { showStep(current - 1, true); });

  form.addEventListener('change', function (e) {
    if (e.target.dataset && e.target.dataset.group) syncGroup(e.target.dataset.group);
    serializeServices(); save();
  });
  var saveTimer;
  form.addEventListener('input', function () {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () { serializeServices(); save(); }, 400);
  });

  /* ---------- Alertas ---------- */
  function showAlert(msg, withCopy) {
    alertBox.innerHTML = '';
    var p = document.createElement('p'); p.style.margin = '0'; p.textContent = msg;
    alertBox.appendChild(p);
    if (withCopy) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'btn btn-ghost btn-small'; b.style.marginTop = '12px';
      b.textContent = 'Copiar minhas respostas';
      b.addEventListener('click', copyAnswers);
      alertBox.appendChild(b);
    }
    alertBox.hidden = false;
  }
  function hideAlert() { alertBox.hidden = true; alertBox.innerHTML = ''; }

  function answersAsText() {
    var lines = ['BRIEFING PERSONAL ORGANIZER — GR Visual Comunicações', ''];
    steps.forEach(function (step) {
      lines.push('## ' + step.querySelector('h2').textContent);
      step.querySelectorAll('.field').forEach(function (f) {
        if (f.closest('.svc')) return;
        var lab = f.querySelector('legend, label');
        if (!lab) return;
        var q = lab.childNodes[0] ? lab.childNodes[0].textContent.trim() : lab.textContent.trim();
        var val = '';
        var hidden = f.querySelector('input[type=hidden]');
        var radio = f.querySelector('input[type=radio]:checked');
        var ctrl = f.querySelector('input:not([type=hidden]):not([type=radio]):not([data-group]):not([data-add-for]), select, textarea');
        if (hidden) val = hidden.value;
        else if (radio) val = radio.value;
        else if (f.querySelector('input[type=radio]')) val = '';
        else if (ctrl && ctrl.type === 'checkbox') val = ctrl.checked ? 'Sim' : 'Não';
        else if (ctrl) val = ctrl.value.trim();
        if (val) lines.push('• ' + q + '\n  ' + val);
      });
      if (step.contains(svcList)) { serializeServices(); if (svcField.value) lines.push(svcField.value); }
      lines.push('');
    });
    return lines.join('\n');
  }
  function copyAnswers() {
    var txt = answersAsText();
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = txt; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); alert('Respostas copiadas! Cole no WhatsApp da GR Visual.'); }
      catch (e) { alert('Não foi possível copiar automaticamente.'); }
      ta.remove();
    }
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(txt).then(function () { alert('Respostas copiadas! Cole no WhatsApp da GR Visual.'); }, fallback);
    } else fallback();
  }

  /* ---------- Envio real para a Netlify Forms ---------- */
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (sending) return;
    hideAlert();

    for (var i = 1; i <= total; i++) {
      if (!validateStep(i, false)) {
        showStep(i, false);
        validateStep(i, true);
        showAlert(i === current && i === total
          ? 'Confira os campos destacados antes de enviar.'
          : 'Faltou responder algo na etapa ' + i + '. Confira os campos destacados.');
        return;
      }
    }

    document.querySelectorAll('[data-group-box]').forEach(function (b) { syncGroup(b.getAttribute('data-group-box')); });
    serializeServices();

    // Envio pelo WhatsApp da GR Visual: funciona em qualquer hospedagem, sem servidor.
    var txt = answersAsText();
    var url = 'https://wa.me/' + WHATSAPP_GR + '?text=' + encodeURIComponent(txt);
    var win = window.open(url, '_blank');
    if (!win) { location.href = url; }
    quiz.hidden = true; success.hidden = false;
    window.scrollTo({ top: 0 });
    success.focus({ preventScroll: true });
  });

  $('resend-btn').addEventListener('click', function () {
    window.open('https://wa.me/' + WHATSAPP_GR + '?text=' + encodeURIComponent(answersAsText()), '_blank');
  });
  $('copy-btn').addEventListener('click', copyAnswers);
  $('done-btn').addEventListener('click', function () {
    clearSaved();
    this.textContent = 'Pronto! Pode fechar esta página.'; this.disabled = true;
  });

  /* ---------- Início ---------- */
  var saved = load();
  if (saved) {
    restore(saved);
    current = saved.step || 1;
    var hasData = Object.keys(saved.fields || {}).some(function (k) { return saved.fields[k]; });
    if (hasData) {
      $('resume-note').hidden = false;
      $('start-btn').textContent = 'Continuar questionário →';
    }
  } else {
    addService();
  }
  steps[0].classList.add('active');
})();
