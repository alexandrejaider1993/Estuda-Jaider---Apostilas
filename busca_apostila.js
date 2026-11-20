/* Busca nas Apostilas interativas (Ctrl+F), 18/11/2026. Roda DENTRO do quadro da apostila (injetado por
 * web/interativos.js, como o trilho e o estojo). O Electron não tem a barra de busca do navegador, e a busca nativa
 * só veria a seção aberta (o site mostra uma por vez). Aqui:
 *   - caixa no canto de cima: Ctrl+F ou F3 abre; Enter = próxima, Shift+Enter = anterior, Esc fecha;
 *   - destaca todas as ocorrências da seção aberta com a CSS Custom Highlight API (não mexe no DOM do site:
 *     não briga com o redesenho do #app nem com as marcas do estojo); contador "3 de 12";
 *   - sem acento e sem maiúscula ("estrogenio" acha "estrogênio");
 *   - "Em outras seções": procura no bloco de dados D da apostila (blocos e questões) e leva até a seção.
 * window.ejBusca.abrir() também é chamado pelo app quando o Ctrl+F acontece fora do quadro. */
(function () {
  "use strict";
  if (window.ejBusca) return;
  const DOC = document, W = window;
  const suportaDestaque = !!(W.CSS && CSS.highlights && W.Highlight);
  let caixa, campo, contador, lista, matches = [], atual = -1, termo = "", agendado = 0, aberta = false;

  const CSS_TXT = `
  .ej-busca { position: fixed; top: calc(var(--ej-topo, 64px) + 52px); right: 18px; z-index: 37; width: 340px; max-width: calc(100vw - 36px);
    border-radius: 12px; background: #fff; box-shadow: 0 0 0 1px rgba(0,0,0,.1), 0 12px 32px rgba(0,0,0,.16); font: 14px/1.35 system-ui, sans-serif; color: #1F2430; }
  .ej-busca[hidden] { display: none; }
  .ej-busca-linha { display: flex; align-items: center; gap: 6px; padding: 8px; }
  .ej-busca input { flex: 1; min-width: 0; height: 32px; padding: 0 10px; border: 1px solid rgba(0,0,0,.14); border-radius: 8px; font: inherit; color: inherit; outline: none; }
  .ej-busca input:focus { border-color: #2C4A7A; box-shadow: 0 0 0 3px rgba(44,74,122,.15); }
  .ej-busca-cont { min-width: 54px; text-align: center; color: #6B7280; font-size: 12px; font-variant-numeric: tabular-nums; }
  .ej-busca button { width: 30px; height: 30px; flex: none; border: 0; border-radius: 7px; background: transparent; color: #2C4A7A; cursor: pointer; font: 600 15px/1 system-ui, sans-serif; }
  .ej-busca button:hover:not(:disabled) { background: #F1F3F6; }
  .ej-busca button:disabled { opacity: .35; cursor: default; }
  .ej-busca button:focus-visible, .ej-busca-res a:focus-visible { outline: 2px solid #2C4A7A; outline-offset: 1px; }
  .ej-busca-res { max-height: 46vh; overflow-y: auto; border-top: 1px solid rgba(0,0,0,.08); padding: 6px; }
  .ej-busca-res:empty { display: none; }
  .ej-busca-res p { margin: 4px 8px 6px; font-size: 12px; font-weight: 600; color: #6B7280; }
  .ej-busca-res a { display: flex; justify-content: space-between; gap: 10px; padding: 7px 8px; border-radius: 8px; color: inherit; text-decoration: none; }
  .ej-busca-res a:hover { background: #F1F3F6; }
  .ej-busca-res a span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .ej-busca-res a b { flex: none; font-weight: 600; color: #2C4A7A; font-variant-numeric: tabular-nums; }
  .ej-busca-res::-webkit-scrollbar { width: 6px; } .ej-busca-res::-webkit-scrollbar-thumb { background: rgba(31,36,48,.16); border-radius: 3px; }
  .ej-busca-res::-webkit-scrollbar-button { display: none; height: 0; }
  ::highlight(ej-busca) { background: #FFE58A; color: inherit; }
  ::highlight(ej-busca-atual) { background: #F59E0B; color: #1F2430; }
  @media print { .ej-busca { display: none !important; } }`;

  // texto sem acento e minúsculo, letra a letra (o índice de cada letra continua o mesmo do texto original)
  const semAcento = s => { let o = ""; for (const c of s) { const n = c.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(); o += n.length === 1 ? n : c.toLowerCase(); } return o; };

  function areaDeBusca() { return DOC.querySelector("article.conteudo") || DOC.getElementById("app") || DOC.body; }

  function procurarNaPagina() {
    matches = []; atual = -1;
    if (suportaDestaque) { CSS.highlights.delete("ej-busca"); CSS.highlights.delete("ej-busca-atual"); }
    const alvo = semAcento(termo.trim());
    if (alvo.length < 2) { desenharContador(); return; }
    const raiz = areaDeBusca();
    const walker = DOC.createTreeWalker(raiz, NodeFilter.SHOW_TEXT, {
      acceptNode: n => n.parentElement && n.parentElement.closest("script,style,.ej-busca,#ejTrilho,.ej-voo,.ej-fonte,.ej-acoes,.ej-ui") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
    });
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const t = semAcento(n.data);
      let i = t.indexOf(alvo);
      while (i >= 0) {
        const r = DOC.createRange(); r.setStart(n, i); r.setEnd(n, i + alvo.length);
        matches.push(r);
        i = t.indexOf(alvo, i + alvo.length);
      }
    }
    if (suportaDestaque && matches.length) CSS.highlights.set("ej-busca", new Highlight(...matches));
    if (matches.length) irPara(0, false); else desenharContador();
  }

  function irPara(k, rolar = true) {
    if (!matches.length) return;
    atual = (k + matches.length) % matches.length;
    if (suportaDestaque) CSS.highlights.set("ej-busca-atual", new Highlight(matches[atual]));
    const r = matches[atual].getBoundingClientRect();
    const topo = parseFloat(getComputedStyle(DOC.documentElement).getPropertyValue("--ej-topo")) || 64;
    if (rolar || r.top < topo + 10 || r.bottom > innerHeight - 20) W.scrollBy({ top: r.top - innerHeight / 3, behavior: "smooth" });
    desenharContador();
  }

  function desenharContador() {
    contador.textContent = termo.trim().length < 2 ? "" : matches.length ? `${atual + 1} de ${matches.length}` : "0 aqui";
    caixa.querySelectorAll("[data-n]").forEach(b => { b.disabled = matches.length < 2; });
  }

  // outras seções: blocos (texto de seq) e questões do bloco de dados D da apostila
  let indice = null;
  function textoDe(x) { return Array.isArray(x) ? x.map(textoDe).join(" ") : typeof x === "string" && !/\.(jpe?g|png|svg|webp)$/i.test(x) ? x : ""; }
  function montarIndice() {
    if (indice) return indice;
    indice = [];
    let dados = null;
    try { dados = W.eval("typeof D !== 'undefined' ? D : null"); } catch (e) {}
    if (!dados) return indice;
    (dados.blocos || []).forEach(b => indice.push({ id: b.id, titulo: b.titulo || b.id, texto: semAcento(`${b.titulo || ""} ${textoDe(b.seq)}`.replace(/\*\*/g, "")) }));
    (dados.questoes || []).forEach(q => indice.push({ id: q.id, titulo: (q.ref || q.id).replace("Compilado, q", "Q"),
      texto: semAcento(`${q.enunciado || ""} ${textoDe(q.itens)} ${q.resposta_esperada || ""} ${q.comentario || ""}`.replace(/\*\*/g, "")) }));
    return indice;
  }
  function procurarNoResto() {
    lista.innerHTML = "";
    const alvo = semAcento(termo.trim());
    if (alvo.length < 2) return;
    const aqui = decodeURIComponent(location.hash.slice(1));
    const achados = montarIndice().map(s => { let n = 0, i = s.texto.indexOf(alvo); while (i >= 0) { n++; i = s.texto.indexOf(alvo, i + alvo.length); } return { s, n }; })
      .filter(x => x.n && x.s.id !== aqui);
    if (!achados.length) return;
    const p = DOC.createElement("p"); p.textContent = `Em outras seções (${achados.length})`; lista.append(p);
    achados.slice(0, 60).forEach(({ s, n }) => {
      const a = DOC.createElement("a");
      a.href = "#" + s.id;
      a.innerHTML = "<span></span><b></b>";
      a.querySelector("span").textContent = s.titulo; a.querySelector("b").textContent = n;
      a.addEventListener("click", ev => { ev.preventDefault(); location.hash = "#" + s.id; setTimeout(() => { procurarNaPagina(); procurarNoResto(); }, 350); });
      lista.append(a);
    });
  }

  function buscar() { termo = campo.value; procurarNaPagina(); procurarNoResto(); }

  function abrir(inicial) {
    if (!caixa) montar();
    caixa.hidden = false; aberta = true;
    const sel = String(W.getSelection ? W.getSelection() : "").trim();
    if (typeof inicial === "string" && inicial.trim()) campo.value = inicial.trim();   // vindo da busca do app (todas as apostilas)
    else if (sel &&sel.length <= 60 && !sel.includes("\n")) campo.value = sel;
    campo.focus(); campo.select();
    if (campo.value.trim().length >= 2) buscar();
  }
  function fechar() {
    if (!caixa) return;
    caixa.hidden = true; aberta = false;
    if (suportaDestaque) { CSS.highlights.delete("ej-busca"); CSS.highlights.delete("ej-busca-atual"); }
  }

  function montar() {
    const st = DOC.createElement("style"); st.textContent = CSS_TXT; DOC.head.append(st);
    caixa = DOC.createElement("div");
    caixa.className = "ej-busca"; caixa.hidden = true; caixa.setAttribute("role", "search");
    caixa.innerHTML = `<div class="ej-busca-linha">
        <input type="search" placeholder="Procurar na apostila" aria-label="Procurar na apostila" autocomplete="off" spellcheck="false">
        <span class="ej-busca-cont" aria-live="polite"></span>
        <button type="button" data-n="-1" aria-label="Ocorrência anterior" title="Anterior (Shift+Enter)">↑</button>
        <button type="button" data-n="1" aria-label="Próxima ocorrência" title="Próxima (Enter)">↓</button>
        <button type="button" data-fechar aria-label="Fechar a busca" title="Fechar (Esc)">✕</button>
      </div><div class="ej-busca-res"></div>`;
    DOC.body.append(caixa);
    campo = caixa.querySelector("input"); contador = caixa.querySelector(".ej-busca-cont"); lista = caixa.querySelector(".ej-busca-res");
    let t = 0;
    campo.addEventListener("input", () => { clearTimeout(t); t = setTimeout(buscar, 160); });
    campo.addEventListener("keydown", e => {
      if (e.key === "Enter") { e.preventDefault(); if (termo !== campo.value) buscar(); else irPara(atual + (e.shiftKey ? -1 : 1)); }
      else if (e.key === "Escape") { e.preventDefault(); fechar(); }
    });
    caixa.querySelectorAll("[data-n]").forEach(b => b.addEventListener("click", () => irPara(atual + Number(b.dataset.n))));
    caixa.querySelector("[data-fechar]").addEventListener("click", fechar);
    // o site redesenha a seção ao navegar: refaz os destaques se a busca estiver aberta
    const app = DOC.getElementById("app") || DOC.body;
    new MutationObserver(muts => {
      if (!aberta || muts.every(m => caixa.contains(m.target))) return;
      cancelAnimationFrame(agendado); agendado = requestAnimationFrame(() => { procurarNaPagina(); });
    }).observe(app, { childList: true, subtree: true });
  }

  DOC.addEventListener("keydown", e => {
    if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === "f" || e.key === "F")) { e.preventDefault(); abrir(); }
    else if (e.key === "F3") { e.preventDefault(); if (!aberta) abrir(); else irPara(atual + (e.shiftKey ? -1 : 1)); }
    else if (e.key === "Escape" && aberta) { e.preventDefault(); e.stopPropagation(); fechar(); }   // não sai da tela cheia junto
  }, true);

  W.ejBusca = { abrir, fechar, aberta: () => aberta };
})();
