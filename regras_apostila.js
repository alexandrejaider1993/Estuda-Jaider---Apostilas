/* Estuda Jaider — REGRAS UNIVERSAIS das Apostilas interativas.
 * Injetado pelo app (web/interativos.js) em TODA apostila aberta no quadro, sem editar os sites.
 * Regra nova = acrescentar aqui (nunca colar no index.html de uma apostila só).
 *
 * Regra 1 — Responder: clicar numa alternativa só MARCA; a correção vem no botão "Responder".
 *   Vale para testes ("Teste você"), microtestes, erros (er-*) e revisão (rv), e radios com data-obj.
 *   Se o site já trouxer a versão antiga embutida (<script id="ej-responder">), a guarda __ejResp evita duplicar.
 * Regra 2 — "Teoria antes de responder" (Engenharia reversa) vem minimizado por padrão.
 * Regra 3 — "Gabarito comentado, não oficial": cada alternativa / item (A), B), I), II) ou quebra de linha) em sua própria linha.
 * Regra 4 — Riscar alternativas: botão "X" à direita de cada alternativa (Revisão, testes, microtestes e objetivas) para o aluno riscar/eliminar opções enquanto pensa.
 * Regra 5 — Revisão: setas para avançar/voltar entre as questões da revisão e botão "Teoria" que leva exatamente ao passo teórico daquela questão.
 */
(function () {
  if (window.__ejRegras) return; window.__ejRegras = 1;

  var limparPendRv = function () {};
  var riscadas = {};
  var IC_X = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';
  var IC_ESQ = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>';
  var IC_DIR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>';
  var IC_LIVRO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>';

  var stRiscar = document.createElement('style');
  stRiscar.textContent =
    '.ops:not(.vf) .op>span{flex:1;min-width:0}' +
    '.op.ej-riscada>input,.op.ej-riscada>span{opacity:.45}' +
    '.op.ej-riscada>span{text-decoration:line-through;text-decoration-thickness:1.5px;color:var(--suave,#5B5F66)}' +
    '.ej-riscar{flex:none;margin-left:auto;align-self:center;width:28px;height:28px;padding:0;display:inline-flex;align-items:center;justify-content:center;border:1px solid transparent;border-radius:7px;background:transparent;color:var(--suave,#5B5F66);opacity:.48;cursor:pointer;transition:opacity .15s,background-color .15s,color .15s,border-color .15s}' +
    '.op:hover .ej-riscar,.ej-riscar:focus-visible,.ej-riscar[aria-pressed="true"]{opacity:1}' +
    '.ej-riscar:hover{background:rgba(168,50,45,.09);color:var(--arteria,#A8322D)}' +
    '.ej-riscar[aria-pressed="true"]{background:var(--f-clinica,#FBEFEE);color:var(--arteria,#A8322D);border-color:rgba(168,50,45,.28)}' +
    '.ej-riscar svg{width:14px;height:14px;pointer-events:none}' +
    '@media(hover:none){.ej-riscar{opacity:.72}}' +
    '.ej-rev-bar{display:flex;align-items:center;justify-content:space-between;gap:10px;padding-bottom:10px;margin-bottom:2px;border-bottom:1px solid var(--fio,#D9DCE1)}' +
    '.ej-rev-nav{display:inline-flex;align-items:center;gap:6px}' +
    '.ej-rev-seta{width:32px;height:32px;padding:0;display:inline-flex;align-items:center;justify-content:center;border:1px solid var(--fio,#D9DCE1);border-radius:8px;background:var(--bg,#fff);color:var(--tinta,#1D1D1F);cursor:pointer;transition:background-color .15s,border-color .15s,color .15s}' +
    '.ej-rev-seta:hover:not([disabled]){background:var(--f-conceito,#EEF3F9);border-color:var(--veia,#2B4F7E);color:var(--veia,#2B4F7E)}' +
    '.ej-rev-seta[disabled]{opacity:.38;cursor:not-allowed}' +
    '.ej-rev-seta svg{width:16px;height:16px;pointer-events:none}' +
    '.ej-rev-pos{font:600 13px/1 var(--org,Inter,sans-serif);color:var(--suave,#5B5F66);font-variant-numeric:tabular-nums;padding:0 4px}' +
    '.ej-rev-teo{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 12px;border:1px solid var(--veia,#2B4F7E);border-radius:8px;background:transparent;color:var(--veia,#2B4F7E);font:600 13px/1 var(--org,Inter,sans-serif);cursor:pointer;transition:background-color .15s,color .15s}' +
    '.ej-rev-teo:hover{background:var(--veia,#2B4F7E);color:#fff}' +
    '.ej-rev-teo svg{width:14px;height:14px;pointer-events:none}' +
    'h3.passo{scroll-margin-top:96px}' +
    '@keyframes ejTeoPulso{0%{background:rgba(43,79,126,.18);box-shadow:0 0 0 6px rgba(43,79,126,.14)}100%{background:transparent;box-shadow:0 0 0 0 transparent}}' +
    '.ej-teo-foco{border-radius:6px;animation:ejTeoPulso 2.2s ease-out}';
  document.head.appendChild(stRiscar);

  var origDevidos = typeof window.devidos === 'function' ? window.devidos : null;
  var revIdx = 0;
  if (origDevidos) {
    window.devidos = function () {
      var list = origDevidos();
      if (!list.length) { revIdx = 0; return list; }
      if (revIdx < 0) revIdx = 0;
      if (revIdx >= list.length) revIdx = list.length - 1;
      if (revIdx === 0) return list;
      return list.slice(revIdx).concat(list.slice(0, revIdx));
    };
  }

  function navegarRevisao(delta) {
    if (!origDevidos) return;
    var list = origDevidos();
    if (list.length <= 1) return;
    var novo = Math.max(0, Math.min(list.length - 1, revIdx + delta));
    if (novo === revIdx) return;
    revIdx = novo;
    limparPendRv();
    try { if (typeof revFb !== 'undefined') revFb = null; } catch (_) {}
    try { if (typeof revErr !== 'undefined') revErr = false; } catch (_) {}
    if (typeof window.desenhar === 'function') window.desenhar();
  }

  function destinoTeoriaRevisao() {
    try {
      if (typeof revItem !== 'undefined' && revItem && revItem.bloco) {
        return { bloco: revItem.bloco, passo: revItem.passo || null };
      }
      var list = typeof window.devidos === 'function' ? window.devidos() : [];
      var c = list[0];
      if (c && typeof D !== 'undefined' && D && Array.isArray(D.blocos)) {
        var b = D.blocos.find(function (x) { return Array.isArray(x.ensina) && x.ensina.indexOf(c) !== -1; });
        if (b) return { bloco: b.id, passo: null };
      }
    } catch (_) {}
    return null;
  }

  function irParaTeoria(dest) {
    if (!dest || !dest.bloco) return;
    try {
      if (typeof S !== 'undefined' && S && S.blocos && S.blocos[dest.bloco] && S.blocos[dest.bloco].pular && !S.blocos[dest.bloco].ver) {
        S.blocos[dest.bloco].ver = true;
      }
    } catch (_) {}
    var alvoId = dest.passo ? ('ps-' + dest.bloco + '-' + dest.passo) : null;
    location.hash = '#' + dest.bloco;
    if (alvoId) {
      var tentativas = 0;
      var rolar = function () {
        var el = document.getElementById(alvoId);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          el.classList.remove('ej-teo-foco');
          void el.offsetWidth;
          el.classList.add('ej-teo-foco');
          setTimeout(function () { el.classList.remove('ej-teo-foco'); }, 2300);
          return;
        }
        if (++tentativas < 12) setTimeout(rolar, 60);
      };
      setTimeout(rolar, 50);
    }
  }

  function atualizarBarraRevisao() {
    if (location.hash !== '#revisao' || !origDevidos) return;
    var list = origDevidos();
    if (!list.length) return;
    if (revIdx < 0) revIdx = 0;
    if (revIdx >= list.length) revIdx = list.length - 1;
    var art = document.querySelector('article.conteudo');
    if (!art) return;
    var cards = art.querySelectorAll('div.card');
    var card = null;
    for (var i = 0; i < cards.length; i++) {
      if (cards[i].querySelector('p.enun')) { card = cards[i]; break; }
    }
    if (!card) return;
    var dest = destinoTeoriaRevisao();
    var bar = card.querySelector('.ej-rev-bar');
    var assinatura = revIdx + '/' + list.length + '/' + (dest ? (dest.bloco + ':' + (dest.passo || '')) : '');
    if (bar && bar.dataset.sig === assinatura) return;
    if (!bar) {
      bar = document.createElement('div');
      bar.className = 'ej-rev-bar ej-ui';
      card.insertBefore(bar, card.firstChild);
    }
    bar.dataset.sig = assinatura;
    bar.innerHTML =
      '<div class="ej-rev-nav">' +
        '<button type="button" class="ej-rev-seta" data-rv-dir="-1" aria-label="Questão anterior" title="Questão anterior"' + (revIdx <= 0 ? ' disabled' : '') + '>' + IC_ESQ + '</button>' +
        '<span class="ej-rev-pos">' + (revIdx + 1) + ' de ' + list.length + '</span>' +
        '<button type="button" class="ej-rev-seta" data-rv-dir="1" aria-label="Próxima questão" title="Próxima questão"' + (revIdx >= list.length - 1 ? ' disabled' : '') + '>' + IC_DIR + '</button>' +
      '</div>' +
      (dest ? '<button type="button" class="ej-rev-teo" title="Ir exatamente para a teoria desta questão">' + IC_LIVRO + '<span>Teoria</span></button>' : '');
    var btnAnt = bar.querySelector('[data-rv-dir="-1"]');
    var btnProx = bar.querySelector('[data-rv-dir="1"]');
    var btnTeo = bar.querySelector('.ej-rev-teo');
    if (btnAnt) btnAnt.onclick = function () { navegarRevisao(-1); };
    if (btnProx) btnProx.onclick = function () { navegarRevisao(1); };
    if (btnTeo) btnTeo.onclick = function () { irParaTeoria(dest); };
  }

  function chaveOp(lbl, inp) {
    var box = lbl.closest('.card, .teste, .t-corpo') || lbl.parentElement;
    var en = box && box.querySelector('.enun');
    var sp = lbl.querySelector('span');
    return (inp.name || '') + '|' + (inp.value || '') + '|' +
      (en ? en.textContent.trim().slice(0, 120) : '') + '|' +
      (sp ? sp.textContent.trim().slice(0, 80) : '');
  }

  function atualizarRiscar() {
    document.querySelectorAll('.ops:not(.vf) .op').forEach(function (lbl) {
      var inp = lbl.querySelector('input[type="radio"]');
      if (!inp) return;
      if (inp.dataset && (inp.dataset.gal || inp.dataset.al)) return;
      var k = chaveOp(lbl, inp);
      var btn = lbl.querySelector('.ej-riscar');
      if (inp.disabled) {
        if (riscadas[k]) delete riscadas[k];
        if (btn) btn.remove();
        if (lbl.classList.contains('ej-riscada')) lbl.classList.remove('ej-riscada');
        return;
      }
      if (!btn) {
        btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'ej-riscar ej-ui';
        btn.setAttribute('aria-label', 'Riscar alternativa');
        btn.title = 'Riscar alternativa';
        btn.setAttribute('aria-pressed', 'false');
        btn.innerHTML = IC_X;
        btn.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
        btn.addEventListener('mousedown', function (e) { e.stopPropagation(); });
        btn.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          var key = chaveOp(lbl, inp);
          var ativo = !riscadas[key];
          if (ativo) riscadas[key] = true; else delete riscadas[key];
          lbl.classList.toggle('ej-riscada', ativo);
          btn.setAttribute('aria-pressed', ativo ? 'true' : 'false');
          btn.title = ativo ? 'Desriscar alternativa' : 'Riscar alternativa';
          btn.setAttribute('aria-label', btn.title);
        });
        lbl.appendChild(btn);
      }
      var ativo = !!riscadas[k];
      if (lbl.classList.contains('ej-riscada') !== ativo) lbl.classList.toggle('ej-riscada', ativo);
      var pressed = ativo ? 'true' : 'false';
      if (btn.getAttribute('aria-pressed') !== pressed) {
        btn.setAttribute('aria-pressed', pressed);
        btn.title = ativo ? 'Desriscar alternativa' : 'Riscar alternativa';
        btn.setAttribute('aria-label', btn.title);
      }
    });
  }

  function minimizarTeoriaAntes() {
    document.querySelectorAll('details').forEach(function (d) {
      if (d.dataset.ejTeoria) return;
      var s = d.querySelector('summary');
      if (s && /Teoria antes de responder/i.test(s.textContent)) {
        d.dataset.ejTeoria = '1';
        d.removeAttribute('open');
      }
    });
  }

  function organizarGabarito() {
    document.querySelectorAll('.cx.t-caiu').forEach(function (cx) {
      var r = cx.querySelector('p.r');
      if (!r || !/gabarito/i.test(r.textContent)) return;
      cx.querySelectorAll('p:not(.r):not([data-ej-gab])').forEach(function (p) {
        p.dataset.ejGab = '1';
        var html = p.innerHTML;
        var marcado = html
          .replace(/\r?\n+/g, '<br>')
          .replace(/([.;:?!)]|<\/(?:b|strong)>)\s+((?:<(?:b|strong)>)?(?:[A-E]|I{1,3}|IV|V)\)\s)/g, '$1<br>$2');
        if (marcado === html) return;
        var partes = marcado.split('<br>').map(function (s) { return s.trim(); }).filter(Boolean);
        if (partes.length < 2) return;
        var frag = document.createDocumentFragment();
        partes.forEach(function (parte) {
          var np = document.createElement('p');
          np.dataset.ejGab = '1';
          np.style.textAlign = 'left';
          np.innerHTML = parte;
          frag.appendChild(np);
        });
        p.replaceWith(frag);
      });
    });
  }

  function aplicarRegras() {
    minimizarTeoriaAntes();
    organizarGabarito();
    atualizarRiscar();
    atualizarBarraRevisao();
  }
  aplicarRegras();
  new MutationObserver(aplicarRegras).observe(document.documentElement, { childList: true, subtree: true });

  if (!window.__ejResp) {
    window.__ejResp = 1;
    var passar = false, pend = {};
    limparPendRv = function () { delete pend['rv']; };
    function temD() { try { return typeof D !== 'undefined' && D; } catch (_) { return null; } }
    function avaliado(t) {
      if (!t || t.type !== 'radio' || t.disabled) return false;
      if (t.dataset && (t.dataset.gal || t.dataset.al)) return false; // autoavaliação: sem correção
      if (t.dataset && t.dataset.obj) return true;
      var n = t.name || '', d = temD();
      if (n.indexOf('er-') === 0 || n === 'rv') return true;
      if (!d) return false;
      return (d.testes || []).some(function (x) { return x.id === n; }) || (d.microtestes || []).some(function (x) { return x.id === n; });
    }
    function grupo(t) { return t.closest('.ops') || t.parentElement; }
    function responder(g) {
      var sel = g.querySelector('input[type=radio]:checked'); if (!sel || sel.disabled) return;
      delete pend[sel.name]; passar = true;
      try { sel.dispatchEvent(new Event('change', { bubbles: true })); } finally { passar = false; }
    }
    function botao(t) {
      var g = grupo(t), b = g.nextElementSibling;
      if (!(b && b.classList.contains('ej-resp'))) {
        b = document.createElement('div'); b.className = 'acoes ej-resp ej-ui';
        b.innerHTML = '<button type="button" class="bt">Responder</button>';
        g.after(b);
      }
      b.querySelector('button').onclick = function () { responder(g); };
    }
    document.addEventListener('change', function (e) {
      var t = e.target; if (passar || !avaliado(t)) return;
      e.stopImmediatePropagation(); e.stopPropagation();
      pend[t.name] = t.value;
      botao(t);
    }, true);
    function restaurar() {
      for (var n in pend) {
        var esc = window.CSS && CSS.escape ? CSS.escape(n) : n;
        var r = document.querySelector('input[type=radio][name="' + esc + '"][value="' + pend[n] + '"]');
        if (!r) continue;
        if (r.disabled) { delete pend[n]; continue; }
        if (!r.checked) r.checked = true;
        botao(r);
      }
    }
    new MutationObserver(restaurar).observe(document.documentElement, { childList: true, subtree: true });
    var st = document.createElement('style');
    st.textContent = '.ej-resp{margin-top:10px}.ej-resp .bt{min-width:120px}';
    document.head.appendChild(st);
  }
})();
