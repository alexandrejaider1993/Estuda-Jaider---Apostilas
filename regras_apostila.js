/* Estuda Jaider — REGRAS UNIVERSAIS das Apostilas interativas.
 * Injetado pelo app (web/interativos.js) em TODA apostila aberta no quadro, sem editar os sites.
 * Regra nova = acrescentar aqui (nunca colar no index.html de uma apostila só).
 *
 * Regra 1 — Responder: clicar numa alternativa só MARCA; a correção vem no botão "Responder".
 *   Vale para testes ("Teste você"), microtestes, erros (er-*) e revisão (rv), e radios com data-obj.
 *   Se o site já trouxer a versão antiga embutida (<script id="ej-responder">), a guarda __ejResp evita duplicar.
 * Regra 2 — "Teoria antes de responder" (Engenharia reversa) vem minimizado por padrão.
 * Regra 3 — "Gabarito comentado, não oficial": cada alternativa / item (A), B), I), II) ou quebra de linha) em sua própria linha.
 */
(function () {
  if (window.__ejRegras) return; window.__ejRegras = 1;

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
  }
  aplicarRegras();
  new MutationObserver(aplicarRegras).observe(document.documentElement, { childList: true, subtree: true });

  if (!window.__ejResp) {
    window.__ejResp = 1;
    var passar = false, pend = {};
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
