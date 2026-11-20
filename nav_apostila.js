/* Navegação das Apostilas interativas (18/11/2026, pedido do usuário: "faça tudo isso").
 * Roda DENTRO do quadro da apostila (injetado por web/interativos.js, como o trilho, a busca e o estojo).
 * O site troca de tela pelo #hash (b1 = aula curta, q31 = questão, t-c1 = capítulo no modelo tradicional,
 * g-q31 = estudo guiado, mapa/tradicional/guiado/reversa/revisar/revisao) e redesenha #app inteiro a cada clique.
 * Os dados vêm do bloco `const D` do site (blocos, questões, testes, microtestes, figuras).
 *
 *   1. posição de leitura: seção + quanto já rolou, gravada no app (rota /posicao, um arquivo por PC) e retomada ao abrir;
 *   2. voltar / avançar (botões e Alt+← / Alt+→), voltando também à rolagem de antes;
 *   3. ligações: "Estudar antes" nas questões, "Isto cai em" no fim das aulas, "Rever este trecho" quando erra um teste;
 *   4. domínio por capítulo no trilho de números + "Ir ao meu ponto mais fraco";
 *   5. "Nesta seção" (subtítulos, o atual destacado) e barra de leitura da seção;
 *   6. anterior / próxima no fim de cada seção (← / →), com o tempo de leitura; na última, a próxima apostila da pasta;
 *   7. "Minhas marcas": tudo o que foi marcado com o estojo, por seção, com filtros;
 *   8. galeria das figuras, com "Ver no texto";
 *  11. "?" mostra os atalhos.
 * (9, a busca em todas as apostilas, fica na busca do app; 10, a próxima apostila, vem do app em cfg.proxima.) */
(function () {
  "use strict";
  if (window.ejNav) return;
  const Doc = document, W = window;
  let cfg = {}, dados = null, barra, progresso, painel, vela, aviso;
  const hist = { pilha: [], i: -1, navegando: false };
  let dominioConceitos = [];
  let timerPos = 0, ultimoHash = "", restaurando = false, agendado = 0;

  const esc = t => String(t ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const limpo = t => String(t ?? "").replace(/\*\*/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const semAcento = t => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const pagina = () => decodeURIComponent(location.hash.slice(1)) || "mapa";
  const artigo = () => Doc.querySelector("article.conteudo");
  const digitando = e => { const t = e.target; return !!(t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))); };
  const ir = h => { if (pagina() !== h) location.hash = "#" + h; else W.scrollTo(0, 0); };

  // ------------------------------------------------------------------ dados do site
  function D() {
    if (dados) return dados;
    try { dados = W.eval("typeof D !== 'undefined' ? D : null"); } catch (e) { dados = null; }
    return dados;
  }
  const blocos = () => (D() && D().blocos) || [];
  const questoes = () => (D() && D().questoes) || [];
  const capitulos = () => (D() && D().capitulos) || [];
  const blocoDe = id => blocos().find(b => b.id === id);
  const questaoDe = id => questoes().find(q => q.id === id);
  function numeroDoBloco(b) {
    const ci = capitulos().findIndex(c => c.id === b.capitulo);
    const doCap = blocos().filter(x => x.capitulo === b.capitulo);
    return ci < 0 ? "" : `${ci + 1}.${doCap.indexOf(b) + 1}`;
  }
  const MODOS = { mapa: "Início", tradicional: "Modelo tradicional", guiado: "Estudo guiado", reversa: "Engenharia reversa", revisar: "Revisar", revisao: "Revisão" };
  function tituloDe(h) {
    const b = blocoDe(h);
    if (b) return `${numeroDoBloco(b)} ${limpo(b.titulo)}`.trim();
    const q = questaoDe(h) || (h.startsWith("g-") ? questaoDe(h.slice(2)) : null);
    if (q) return limpo(q.ref) || "Questão";
    if (h.startsWith("t-")) { const ci = capitulos().findIndex(c => c.id === h.slice(2)); if (ci >= 0) return `Capítulo ${ci + 1}: ${limpo(capitulos()[ci].titulo)}`; }
    return MODOS[h] || h;
  }
  function minutosDeLeitura(b) {
    let palavras = 0;
    const contar = x => { if (typeof x === "string" && !/\.(jpe?g|png|webp|gif)$/i.test(x)) palavras += limpo(x).split(" ").length; else if (Array.isArray(x)) x.forEach(contar); };
    (b.seq || []).forEach(it => Array.isArray(it) && it.slice(1).forEach(contar));
    return Math.max(1, Math.round(palavras / 180));
  }

  // ------------------------------------------------------------------ CSS
  const CSS = `
  /* alternativas erradas uma por linha (separarAlternativas), igual às apostilas novas */
  .fb .outras[data-ej-alt] { display: block; margin-top: 12px; }
  .fb .outras[data-ej-alt] .ot { display: block; font-weight: 700; color: var(--tinta, inherit); margin-bottom: 6px; }
  .fb .outras[data-ej-alt] .li { display: flex; gap: 8px; align-items: baseline; margin-top: 5px; }
  .fb .outras[data-ej-alt] .x { color: var(--arteria, #C0392B); font-weight: 700; flex: none; }
  /* segunda linha do cabeçalho do site (que gruda no topo): nunca cobre o texto */
  header { position: sticky; }
  .ej-nav { display: flex; align-items: center; gap: 4px; max-width: min(1440px, calc(100vw - 40px)); margin: 10px auto 0; padding: 6px 0 8px;
    border-top: 1px solid rgba(0,0,0,.07); font: 600 13px/1 system-ui, -apple-system, "Segoe UI", sans-serif; }
  .ej-nav .ej-onde { flex: 1; min-width: 0; padding: 0 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #4A5260; font-weight: 600; }
  .ej-nav .ej-fonte { position: static !important; margin-left: 4px; flex: none; }
  @media (min-width: 641px) { html.ej-trilho .ej-nav { padding-left: 0; } }
  .ej-nav button { height: 32px; min-width: 32px; padding: 0 8px; display: inline-flex; align-items: center; justify-content: center; gap: 6px;
    border: 1px solid rgba(0,0,0,.12); border-radius: 8px; background: rgba(255,255,255,.95); color: #2C4A7A; cursor: pointer; font: inherit; }
  .ej-nav button:hover:not(:disabled) { background: #F1F3F6; }
  .ej-nav button:disabled { opacity: .35; cursor: default; }
  .ej-nav button[aria-pressed="true"] { background: #2C4A7A; border-color: #2C4A7A; color: #fff; }
  .ej-nav button:focus-visible, .ej-pn button:focus-visible, .ej-pn a:focus-visible, .ej-seguir a:focus-visible { outline: 2px solid #2C4A7A; outline-offset: 2px; }
  .ej-nav svg { width: 16px; height: 16px; }
  .ej-nav .ej-sep { width: 1px; margin: 4px 2px; background: rgba(0,0,0,.12); }
  @media (max-width: 760px) { .ej-nav .ej-rotulo { display: none; } }
  .ej-lido { position: absolute; z-index: 1; left: 0; bottom: -1px; height: 3px; width: 0; background: #2C4A7A; pointer-events: none; transition: width .15s linear; }
  /* painel lateral (Nesta seção, Minhas marcas) */
  .ej-pn { position: fixed; z-index: 37; top: calc(var(--ej-topo, 64px) + 50px); right: 18px; width: min(340px, calc(100vw - 36px)); max-height: calc(100vh - var(--ej-topo, 64px) - 70px);
    overflow-y: auto; padding: 12px; border-radius: 12px; background: #fff; color: #1F2430; box-shadow: 0 0 0 1px rgba(0,0,0,.08), 0 12px 32px rgba(0,0,0,.16);
    font: 14px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif; }
  .ej-pn[hidden] { display: none; }
  .ej-pn h2 { display: flex; align-items: center; justify-content: space-between; margin: 0 0 8px; font-size: 14px; font-weight: 600; }
  .ej-pn h2 button { width: 26px; height: 26px; border: 0; border-radius: 6px; background: transparent; color: #4A5260; cursor: pointer; font-size: 16px; }
  .ej-pn h2 button:hover { background: #F1F3F6; }
  .ej-pn a.ej-sub { display: block; padding: 6px 10px; border-radius: 8px; color: inherit; text-decoration: none; border-left: 3px solid transparent; }
  .ej-pn a.ej-sub:hover { background: #F1F3F6; }
  .ej-pn a.ej-sub.at { border-left-color: #2C4A7A; background: #EAF0F8; color: #2C4A7A; font-weight: 600; }
  .ej-pn .ej-vazio { padding: 8px 4px; color: #6B7280; }
  .ej-pn .ej-filtros { display: flex; flex-wrap: wrap; gap: 4px; margin: 0 0 10px; }
  .ej-pn .ej-filtros button { height: 26px; padding: 0 8px; border: 1px solid rgba(0,0,0,.12); border-radius: 6px; background: #fff; color: #4A5260; font: 600 12px/1 system-ui, sans-serif; cursor: pointer; }
  .ej-pn .ej-filtros button[aria-pressed="true"] { background: #2C4A7A; border-color: #2C4A7A; color: #fff; }
  .ej-pn .ej-grupo { margin: 10px 0 4px; font-size: 12px; font-weight: 600; color: #6B7280; }
  .ej-pn .ej-marca { display: flex; gap: 8px; width: 100%; padding: 7px 8px; border: 0; border-radius: 8px; background: transparent; text-align: left; color: inherit; font: inherit; cursor: pointer; }
  .ej-pn .ej-marca:hover { background: #F1F3F6; }
  .ej-pn .ej-marca i { flex: none; width: 10px; height: 10px; margin-top: 5px; border-radius: 3px; background: var(--c, #CDD3DC); }
  .ej-pn .ej-marca small { display: block; color: #6B7280; font-size: 12px; }
  .ej-pn .ej-rot { flex: none; padding: 2px 5px; border-radius: 4px; background: var(--c); color: #fff; font: 700 10px/14px system-ui, sans-serif; letter-spacing: .04em; }
  /* "Nesta seção" fixo à direita em telas largas */
  @media (min-width: 1400px) {
    .ej-pn.ej-fixo { box-shadow: none; background: transparent; border-left: 1px solid rgba(0,0,0,.08); border-radius: 0; width: 230px; padding: 4px 0 4px 12px; z-index: 30; top: calc(var(--ej-topo, 64px) + 60px); }
  }
  /* blocos dentro do texto */
  .ej-liga { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 10px; box-sizing: border-box; max-width: 100%; margin: 14px 0; padding: 10px 14px; border-radius: 10px; background: #F3F6FA; border: 1px solid #DCE4EF; font: 14px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; color: #1F2430; overflow-wrap: anywhere; }
  .ej-liga b { white-space: nowrap; }
  .ej-liga a { color: #2C4A7A; font-weight: 600; text-decoration: none; max-width: 100%; overflow-wrap: anywhere; }
  .ej-liga a:hover { text-decoration: underline; }
  .ej-rever { display: inline-block; margin: 8px 0 0; padding: 6px 10px; border: 1px solid #E5342D; border-radius: 8px; background: #fff; color: #B42318; font: 600 13px/1 system-ui, sans-serif; cursor: pointer; }
  .ej-rever:hover { background: #FEF3F2; }
  .ej-achado { animation: ej-achado 1.8s ease-out; border-radius: 4px; }
  @keyframes ej-achado { 0%, 40% { background: #FFF1B8; box-shadow: 0 0 0 6px #FFF1B8; } 100% { background: transparent; box-shadow: none; } }
  .ej-seguir { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 28px 0 8px; font: 14px/1.35 system-ui, -apple-system, "Segoe UI", sans-serif; }
  .ej-seguir a { display: block; padding: 12px 14px; border: 1px solid rgba(0,0,0,.12); border-radius: 10px; color: #1F2430; text-decoration: none; background: #fff; }
  .ej-seguir a:hover { border-color: #2C4A7A; background: #F7F9FC; }
  .ej-seguir a small { display: block; color: #6B7280; font-size: 12px; margin-bottom: 3px; }
  .ej-seguir a b { font-weight: 600; }
  .ej-seguir .ej-prox { grid-column: 2; text-align: right; }
  .ej-seguir .ej-prox.ej-apost { background: #2C4A7A; color: #fff; border-color: #2C4A7A; }
  .ej-seguir .ej-prox.ej-apost small { color: #D6E0EE; }
  @media (max-width: 640px) { .ej-seguir { grid-template-columns: 1fr; } .ej-seguir .ej-prox { grid-column: 1; } }
  /* camada cheia: galeria e atalhos */
  .ej-vela { position: fixed; inset: 0; z-index: 60; display: flex; align-items: flex-start; justify-content: center; padding: 40px 16px; overflow-y: auto;
    background: rgba(20,24,32,.55); font: 14px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif; }
  .ej-vela[hidden] { display: none; }
  .ej-cx { width: min(1100px, 100%); padding: 18px; border-radius: 14px; background: #fff; color: #1F2430; box-shadow: 0 20px 50px rgba(0,0,0,.3); }
  .ej-cx h2 { display: flex; justify-content: space-between; align-items: center; margin: 0 0 14px; font-size: 16px; font-weight: 600; }
  .ej-cx h2 button { height: 30px; padding: 0 10px; border: 1px solid rgba(0,0,0,.12); border-radius: 8px; background: #fff; cursor: pointer; font: 600 13px/1 system-ui, sans-serif; }
  .ej-gal { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px; }
  .ej-gal button { display: flex; flex-direction: column; gap: 6px; padding: 6px; border: 1px solid rgba(0,0,0,.1); border-radius: 10px; background: #fff; cursor: pointer; text-align: left; font: 12px/1.3 system-ui, sans-serif; color: #4A5260; }
  .ej-gal button:hover { border-color: #2C4A7A; }
  .ej-gal img { width: 100%; height: 130px; object-fit: contain; background: #F4F5F7; border-radius: 6px; }
  .ej-gal small { color: #2C4A7A; font-weight: 600; }
  .ej-grande { text-align: center; }
  .ej-grande img { max-width: 100%; max-height: calc(100vh - 230px); object-fit: contain; border-radius: 8px; background: #F4F5F7; }
  .ej-grande p { margin: 10px auto; max-width: 760px; text-align: left; }
  .ej-grande .ej-acoes-g { display: flex; gap: 8px; justify-content: center; }
  .ej-grande .ej-acoes-g button { height: 34px; padding: 0 14px; border: 1px solid rgba(0,0,0,.12); border-radius: 8px; background: #fff; cursor: pointer; font: 600 13px/1 system-ui, sans-serif; }
  .ej-grande .ej-acoes-g button.pri { background: #2C4A7A; border-color: #2C4A7A; color: #fff; }
  .ej-atalhos { width: min(560px, 100%); }
  .ej-atalhos table { width: 100%; border-collapse: collapse; }
  .ej-atalhos td { padding: 6px 4px; border-top: 1px solid rgba(0,0,0,.06); }
  .ej-atalhos td:first-child { width: 40%; white-space: nowrap; }
  .ej-atalhos kbd { display: inline-block; min-width: 18px; padding: 2px 6px; border: 1px solid rgba(0,0,0,.18); border-bottom-width: 2px; border-radius: 5px; background: #F7F8FA; font: 600 12px/1.3 system-ui, sans-serif; text-align: center; }
  .ej-atalhos .ej-grupo-t td { padding-top: 14px; border: 0; font-weight: 600; color: #6B7280; font-size: 12px; }
  .ej-aviso { position: fixed; z-index: 40; left: 50%; bottom: 22px; transform: translateX(-50%); display: flex; align-items: center; gap: 12px; max-width: calc(100vw - 32px);
    padding: 10px 14px; border-radius: 10px; background: #1F2430; color: #fff; font: 14px/1.35 system-ui, -apple-system, "Segoe UI", sans-serif; box-shadow: 0 10px 30px rgba(0,0,0,.25); }
  .ej-aviso[hidden] { display: none; }
  .ej-aviso button { flex: none; height: 28px; padding: 0 10px; border: 1px solid rgba(255,255,255,.3); border-radius: 6px; background: transparent; color: #fff; cursor: pointer; font: 600 12px/1 system-ui, sans-serif; }
  @media (prefers-reduced-motion: reduce) { .ej-achado { animation: none; background: #FFF1B8; } .ej-lido { transition: none; } }`;

  const IC = {
    voltar: '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
    avancar: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
    secao: '<path d="M3 12h.01"/><path d="M3 18h.01"/><path d="M3 6h.01"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M8 6h13"/>',
    marcas: '<path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>',
    figuras: '<rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>',
    fraco: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    ajuda: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>'
  };
  const svg = n => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[n]}</svg>`;

  // ------------------------------------------------------------------ barra
  function montarBarra() {
    barra = Doc.createElement("div");
    barra.className = "ej-nav"; barra.setAttribute("role", "toolbar"); barra.setAttribute("aria-label", "Navegação da apostila");
    barra.innerHTML = `
      <button type="button" data-a="voltar" title="Voltar (Alt+←)" aria-label="Voltar">${svg("voltar")}</button>
      <button type="button" data-a="avancar" title="Avançar (Alt+→)" aria-label="Avançar">${svg("avancar")}</button>
      <span class="ej-onde" aria-live="polite"></span>
      <button type="button" data-a="secao" title="Nesta seção" aria-label="Nesta seção" aria-pressed="false">${svg("secao")}<span class="ej-rotulo">Nesta seção</span></button>
      <button type="button" data-a="marcas" title="Minhas marcas (L)" aria-label="Minhas marcas" aria-pressed="false">${svg("marcas")}<span class="ej-rotulo">Marcas</span></button>
      <button type="button" data-a="figuras" title="Figuras da apostila (F)" aria-label="Figuras da apostila">${svg("figuras")}</button>
      <button type="button" data-a="fraco" title="Ir ao meu ponto mais fraco" aria-label="Ir ao meu ponto mais fraco">${svg("fraco")}</button>
      <button type="button" data-a="ajuda" title="Atalhos (?)" aria-label="Atalhos do teclado">${svg("ajuda")}</button>`;
    barra.addEventListener("click", e => {
      const b = e.target.closest("button[data-a]");
      if (!b || b.disabled) return;
      ({ voltar, avancar, secao: () => alternarPainel("secao"), marcas: () => alternarPainel("marcas"), figuras: abrirGaleria, fraco: irAoMaisFraco, ajuda: abrirAtalhos })[b.dataset.a]();
    });
    progresso = Doc.createElement("div"); progresso.className = "ej-lido"; progresso.setAttribute("aria-hidden", "true");
    painel = Doc.createElement("div"); painel.className = "ej-pn"; painel.hidden = true; painel.dataset.qual = "";
    vela = Doc.createElement("div"); vela.className = "ej-vela"; vela.hidden = true;
    vela.addEventListener("click", e => { if (e.target === vela) fecharVela(); });
    aviso = Doc.createElement("div"); aviso.className = "ej-aviso"; aviso.hidden = true; aviso.setAttribute("role", "status");
    const cab = Doc.querySelector("header");
    if (cab) cab.append(barra, progresso); else Doc.body.prepend(barra, progresso);
    Doc.body.append(painel, vela, aviso);
  }
  function posicionarBarra() {
    const f = Doc.querySelector("body > .ej-fonte");             // A−/A+ do trilho entra no fim da barra
    if (f) barra.append(f);
    const cab = Doc.querySelector("header");
    if (cab) Doc.documentElement.style.setProperty("--ej-topo", Math.round(cab.getBoundingClientRect().bottom) + "px");
    const onde = barra.querySelector(".ej-onde");
    if (onde) onde.textContent = tituloDe(pagina());
    barra.querySelector('[data-a="voltar"]').disabled = hist.i <= 0;
    barra.querySelector('[data-a="avancar"]').disabled = hist.i >= hist.pilha.length - 1;
    const fraco = barra.querySelector('[data-a="fraco"]');
    fraco.disabled = !conceitoMaisFraco();
    fraco.title = fraco.disabled ? "Ponto mais fraco: responda alguns testes para o app medir" : "Ir ao meu ponto mais fraco";
  }

  // ------------------------------------------------------------------ 2. voltar / avançar
  function registrarNavegacao() {
    const h = pagina();
    if (hist.navegando) { hist.navegando = false; return; }
    if (hist.pilha[hist.i] && hist.pilha[hist.i].h === h) return;
    hist.pilha = hist.pilha.slice(0, hist.i + 1);
    hist.pilha.push({ h, y: 0 });
    hist.i = hist.pilha.length - 1;
    if (hist.pilha.length > 80) { hist.pilha.shift(); hist.i--; }
  }
  function irNoHistorico(d) {
    const k = hist.i + d;
    if (k < 0 || k >= hist.pilha.length) return;
    const alvo = hist.pilha[k], y = alvo.y;            // guarda já: o site rola para o topo ao trocar de tela
    restaurando = true;
    hist.i = k; hist.navegando = true;
    if (pagina() === alvo.h) { hist.navegando = false; restaurando = false; W.scrollTo(0, y * maxRolagem()); return; }
    location.hash = "#" + alvo.h;
    rolarDepois(() => y * maxRolagem());
  }
  const voltar = () => irNoHistorico(-1), avancar = () => irNoHistorico(1);
  const maxRolagem = () => Math.max(1, Doc.documentElement.scrollHeight - innerHeight);
  // o site rola para o topo ao trocar de tela e as figuras carregam depois: aplica de novo algumas vezes
  function rolarDepois(alvoY) {
    restaurando = true;
    let n = 0, mexeu = false;
    const parar = () => { mexeu = true; };
    addEventListener("wheel", parar, { once: true, passive: true });
    addEventListener("touchstart", parar, { once: true, passive: true });
    const passo = () => {
      if (mexeu) { restaurando = false; return; }
      W.scrollTo(0, alvoY());
      if (++n < 6) setTimeout(passo, n < 3 ? 120 : 350); else restaurando = false;
    };
    setTimeout(passo, 60);
  }

  // ------------------------------------------------------------------ 1. posição de leitura
  function aoRolar() {
    const y = W.scrollY / maxRolagem();
    if (hist.pilha[hist.i] && !restaurando) hist.pilha[hist.i].y = y;
    if (progresso) progresso.style.width = Math.min(100, Math.round(y * 100)) + "%";
    marcarSubAtual();
    if (restaurando) return;
    clearTimeout(timerPos);
    timerPos = setTimeout(guardarPosicao, 1500);
  }
  function guardarPosicao() {
    const h = pagina();
    const y = W.scrollY / maxRolagem();
    try { cfg.aoPosicao && cfg.aoPosicao({ hash: h, titulo: tituloDe(h), pct: Math.round(y * 100), y: Math.round(y * 1000) / 1000 }); } catch (e) {}
  }
  function retomar(p) {
    if (!p || !p.hash || p.hash === "mapa") return;
    const h = pagina();
    if (h !== "mapa") return;                      // abriu já numa tela escolhida (ex.: pela busca): não mexe
    location.hash = "#" + p.hash;
    rolarDepois(() => (p.y || 0) * maxRolagem());
    mostrarAviso(`Você parou em: ${p.titulo || tituloDe(p.hash)}${p.pct ? `, ${p.pct}% da seção` : ""}.`, "Ir para o início", () => ir("mapa"));
  }
  let timerAviso = 0;
  function mostrarAviso(texto, botao, acao) {
    aviso.innerHTML = `<span></span>${botao ? '<button type="button"></button>' : ""}`;
    aviso.querySelector("span").textContent = texto;
    if (botao) { const b = aviso.querySelector("button"); b.textContent = botao; b.onclick = () => { aviso.hidden = true; acao(); }; }
    aviso.hidden = false;
    clearTimeout(timerAviso);
    timerAviso = setTimeout(() => { aviso.hidden = true; }, 7000);
  }

  // ------------------------------------------------------------------ 3. ligações
  const microtestes = () => (D() && D().microtestes) || [];
  const testes = () => (D() && D().testes) || [];
  const nomeConceito = id => { const c = ((D() && D().conceitos) || []).find(x => x.id === id); return c ? limpo(c.nome) : ""; };
  const linkBloco = b => `<a href="#${esc(b.id)}">${esc(numeroDoBloco(b))} ${esc(limpo(b.titulo))}</a>`;
  function blocosDaQuestao(q) {
    const ms = microtestes().filter(m => m.questao === q.id);
    let ids = [...new Set(ms.map(m => m.bloco).filter(Boolean))];
    if (!ids.length) {
      const conc = new Set(ms.map(m => m.conceito).filter(Boolean));
      ids = blocos().filter(b => (b.ensina || []).some(c => conc.has(c))).map(b => b.id);
    }
    return ids.map(blocoDe).filter(Boolean).sort((x, y) => blocos().indexOf(x) - blocos().indexOf(y));
  }
  function enfeitarArtigo() {
    const art = artigo();
    if (!art || art.querySelector(":scope > .ej-feito")) return;
    const marca = Doc.createElement("span"); marca.className = "ej-feito ej-ui"; marca.hidden = true; art.append(marca);
    const h = pagina();
    const b = blocoDe(h);
    const q = questaoDe(h) || (h.startsWith("g-") ? questaoDe(h.slice(2)) : null);
    if (q) {
      const bs = blocosDaQuestao(q);
      if (bs.length) {
        const d = Doc.createElement("div"); d.className = "ej-liga ej-ui";
        d.innerHTML = `<b>Estudar antes:</b>${bs.map(linkBloco).join("")}`;
        const mig = art.querySelector(".migalha");
        mig ? mig.after(d) : art.prepend(d);
      }
    }
    if (b) {
      const qs = [...new Set(microtestes().filter(m => m.bloco === b.id).map(m => m.questao))].map(questaoDe).filter(Boolean);
      if (qs.length) {
        const d = Doc.createElement("div"); d.className = "ej-liga ej-ui";
        d.innerHTML = `<b>Isto cai em:</b>${qs.map(x => `<a href="#${esc(x.id)}">${esc(limpo(x.ref) || x.id)}</a>`).join("")}`;
        art.append(d);
      }
    }
    art.append(seguirHtml(h));
    enfeitarErros();
  }
  // Padrão do sistema (19/11/2026, pedido do usuário): ao explicar por que cada alternativa está errada, uma alternativa
  // por linha. Apostilas antigas juntam tudo num parágrafo ("<b>A:</b> texto <b>B:</b> texto" dentro de .outras); aqui
  // isso vira a mesma lista das apostilas novas (título + "✗" + alternativa em negrito + explicação, uma por linha).
  function separarAlternativas() {
    Doc.querySelectorAll(".fb .outras:not([data-ej-alt])").forEach(o => {
      o.dataset.ejAlt = "1";
      if (o.querySelector(".li")) return;                         // já vem em linhas (apostila nova)
      const grupos = []; let atual = null;
      [...o.childNodes].forEach(n => {
        if (n.nodeType === 1 && n.tagName === "B") { atual = []; grupos.push(atual); }
        if (atual) atual.push(n); else if (n.textContent.trim()) { atual = [n]; grupos.push(atual); }
      });
      if (grupos.length < 2) return;
      o.textContent = "";
      const t = Doc.createElement("span"); t.className = "ot"; t.textContent = "Por que as outras opções estão erradas:"; o.append(t);
      grupos.forEach(g => {
        const li = Doc.createElement("span"); li.className = "li";
        const x = Doc.createElement("span"); x.className = "x"; x.setAttribute("aria-hidden", "true"); x.textContent = "✗";
        const corpo = Doc.createElement("span"); g.forEach(n => corpo.append(n));
        const ult = corpo.lastChild; if (ult && ult.nodeType === 3) ult.textContent = ult.textContent.replace(/\s+$/, "");
        li.append(x, corpo); o.append(li);
      });
    });
  }
  // "Rever este trecho" debaixo de cada teste errado
  function enfeitarErros() {
    separarAlternativas();
    const art = artigo();
    if (!art) return;
    art.querySelectorAll(".teste").forEach(t => {
      if (t.querySelector(".ej-rever") || !t.querySelector(".op.err, .err")) return;
      const id = t.id || "";
      let conceito = "", bloco = "", porque = "";
      if (id.startsWith("tq-")) { const x = testes().find(y => y.id === id.slice(3)); if (x) { conceito = x.conceito; bloco = x.bloco; porque = limpo(x.porque); } }
      else if (id.startsWith("mq-")) { const x = microtestes().find(y => y.id === id.slice(3)); if (x) { conceito = x.conceito; bloco = x.bloco; porque = limpo(x.explicacao); } }
      if (!conceito && !bloco) return;
      const bt = Doc.createElement("button");
      bt.type = "button"; bt.className = "ej-rever ej-ui";
      const alvo = bloco && bloco !== pagina() ? blocoDe(bloco) : null;
      bt.textContent = alvo ? `Rever este trecho: ${numeroDoBloco(alvo)} ${limpo(alvo.titulo)}` : "Rever este trecho";
      bt.onclick = () => {
        const termos = [nomeConceito(conceito), porque].join(" ");
        if (alvo) { location.hash = "#" + alvo.id; setTimeout(() => acharTrecho(termos), 450); }
        else acharTrecho(termos);
      };
      (t.querySelector(".t-corpo") || t).append(bt);
    });
  }
  // o parágrafo do texto que mais fala do conceito (palavras de 5+ letras do nome e da explicação)
  function acharTrecho(termos) {
    const art = artigo();
    if (!art) return;
    const palavras = [...new Set(semAcento(termos).split(/[^a-z0-9]+/).filter(p => p.length >= 5))];
    let melhor = null, nota = 0;
    art.querySelectorAll("p, li, td, .cx").forEach(el => {
      if (el.closest(".teste, .ej-liga, .ej-seguir, .migalha")) return;
      const t = semAcento(el.textContent);
      const n = palavras.reduce((s, p) => s + (t.includes(p) ? 1 : 0), 0);
      if (n > nota) { nota = n; melhor = el; }
    });
    const alvo = melhor || art.querySelector("h1, h2, h3");
    if (!alvo) return;
    alvo.scrollIntoView({ block: "center", behavior: "smooth" });
    alvo.classList.remove("ej-achado"); void alvo.offsetWidth; alvo.classList.add("ej-achado");
  }

  // ------------------------------------------------------------------ 6. anterior / próxima
  function vizinhos(h) {
    const b = blocoDe(h);
    if (b) { const k = blocos().indexOf(b); return { ant: blocos()[k - 1], prox: blocos()[k + 1], tipo: "bloco" }; }
    const gq = h.startsWith("g-"), q = questaoDe(gq ? h.slice(2) : h);
    if (q) { const k = questoes().indexOf(q); return { ant: questoes()[k - 1], prox: questoes()[k + 1], tipo: gq ? "guiado" : "questao" }; }
    if (h.startsWith("t-")) { const k = capitulos().findIndex(c => c.id === h.slice(2)); return { ant: capitulos()[k - 1], prox: capitulos()[k + 1], tipo: "cap" }; }
    return null;
  }
  const hashDe = (x, tipo) => tipo === "guiado" ? "g-" + x.id : tipo === "cap" ? "t-" + x.id : x.id;
  function seguirHtml(h) {
    const v = vizinhos(h), d = Doc.createElement("nav");
    d.className = "ej-seguir ej-ui"; d.setAttribute("aria-label", "Seção anterior e próxima");
    if (!v) return d;
    const rot = x => v.tipo === "bloco" ? `${numeroDoBloco(x)} ${limpo(x.titulo)}` : v.tipo === "cap" ? limpo(x.titulo) : limpo(x.ref) || x.id;
    const tempo = x => v.tipo === "bloco" ? ` · cerca de ${minutosDeLeitura(x)} min` : "";
    let html = "";
    if (v.ant) html += `<a href="#${esc(hashDe(v.ant, v.tipo))}"><small>← Anterior</small><b>${esc(rot(v.ant))}</b></a>`;
    if (v.prox) html += `<a class="ej-prox" href="#${esc(hashDe(v.prox, v.tipo))}"><small>Próxima${esc(tempo(v.prox))} →</small><b>${esc(rot(v.prox))}</b></a>`;
    else if (cfg.proxima && v.tipo === "bloco") html += `<a class="ej-prox ej-apost" href="#" data-apostila="1"><small>Próxima apostila da pasta →</small><b>${esc(cfg.proxima.titulo)}</b></a>`;
    d.innerHTML = html;
    const ap = d.querySelector("[data-apostila]");
    if (ap) ap.onclick = e => { e.preventDefault(); try { cfg.abrirApostila && cfg.abrirApostila(cfg.proxima.pasta); } catch (er) {} };
    return d;
  }
  function seguirPorTeclado(d) {
    const v = vizinhos(pagina());
    if (!v) return;
    const x = d < 0 ? v.ant : v.prox;
    if (x) ir(hashDe(x, v.tipo));
    else if (d > 0 && cfg.proxima && v.tipo === "bloco") cfg.abrirApostila && cfg.abrirApostila(cfg.proxima.pasta);
  }

  // ------------------------------------------------------------------ 5. Nesta seção
  function subtitulos() {
    const art = artigo();
    if (!art) return [];
    return [...art.querySelectorAll("h1.sub-t, h2, h3.passo, h3")].filter(el => !el.closest(".teste, .ej-liga, .ej-seguir, details:not([open]), .card"))
      .filter(el => limpo(el.textContent));
  }
  function desenharSecao() {
    const subs = subtitulos();
    painel.innerHTML = `<h2><span>Nesta seção</span><button type="button" aria-label="Fechar">×</button></h2>`;
    painel.querySelector("h2 button").onclick = () => fecharPainel();
    if (!subs.length) { painel.insertAdjacentHTML("beforeend", `<div class="ej-vazio">Esta tela não tem subtítulos.</div>`); return; }
    subs.forEach((el, k) => {
      const a = Doc.createElement("a");
      a.href = "#"; a.className = "ej-sub"; a.dataset.k = k;
      a.textContent = limpo([...el.childNodes].map(n => n.textContent).join(" ")).slice(0, 90);
      if (el.tagName === "H3") a.style.paddingLeft = "20px";
      a.onclick = e => { e.preventDefault(); const alvo = subtitulos()[k]; if (alvo) alvo.scrollIntoView({ block: "start", behavior: "smooth" }); };
      painel.append(a);
    });
    marcarSubAtual();
  }
  function marcarSubAtual() {
    if (painel.hidden || painel.dataset.qual !== "secao") return;
    const subs = subtitulos(), lim = (parseInt(getComputedStyle(Doc.documentElement).getPropertyValue("--ej-topo"), 10) || 64) + 90;
    let at = 0;
    subs.forEach((el, k) => { if (el.getBoundingClientRect().top <= lim) at = k; });
    painel.querySelectorAll("a.ej-sub").forEach(a => a.classList.toggle("at", +a.dataset.k === at));
  }

  // ------------------------------------------------------------------ 7. Minhas marcas
  let filtroMarcas = "todas";
  const FILTROS = [["todas", "Todas"], ["CAI NA PROVA", "Cai na prova"], ["DÚVIDA", "Dúvida"], ["REVISAR", "Revisar"], ["notas", "Notas"], ["texto", "Marca-texto"]];
  function itensDoEstojo() { try { return (W.ejEstojo && W.ejEstojo.itens) ? W.ejEstojo.itens() : []; } catch (e) { return []; } }
  function passaFiltro(it) {
    if (filtroMarcas === "todas") return true;
    if (filtroMarcas === "notas") return it.tipo === "nota" || (it.nota && String(it.nota).trim());
    if (filtroMarcas === "texto") return ["marca", "sublinhado", "tachado"].includes(it.tipo);
    return it.tipo === "adesivo" && it.conteudo === filtroMarcas;
  }
  function ordemPagina(h) {
    const b = blocoDe(h); if (b) return blocos().indexOf(b);
    const q = questaoDe(h.replace(/^g-/, "")); if (q) return 1000 + questoes().indexOf(q);
    return 5000;
  }
  function desenharMarcas() {
    const rot = (W.ejEstojo && W.ejEstojo.ROTULOS) || {};
    const todos = itensDoEstojo();
    const itens = todos.filter(passaFiltro);
    painel.innerHTML = `<h2><span>Minhas marcas (${todos.length})</span><button type="button" aria-label="Fechar">×</button></h2><div class="ej-filtros"></div>`;
    painel.querySelector("h2 button").onclick = () => fecharPainel();
    const fil = painel.querySelector(".ej-filtros");
    FILTROS.forEach(([k, n]) => {
      const b = Doc.createElement("button"); b.type = "button"; b.textContent = n; b.setAttribute("aria-pressed", String(filtroMarcas === k));
      b.onclick = () => { filtroMarcas = k; desenharMarcas(); };
      fil.append(b);
    });
    if (!itens.length) {
      painel.insertAdjacentHTML("beforeend", `<div class="ej-vazio">${todos.length ? "Nada com este filtro." : "Você ainda não marcou nada. Abra o Estojo para marcar texto, colar notas e adesivos como CAI NA PROVA."}</div>`);
      return;
    }
    const grupos = new Map();
    itens.sort((a, b) => ordemPagina(a.pagina) - ordemPagina(b.pagina)).forEach(it => { if (!grupos.has(it.pagina)) grupos.set(it.pagina, []); grupos.get(it.pagina).push(it); });
    for (const [pg, lista] of grupos) {
      const g = Doc.createElement("div"); g.className = "ej-grupo"; g.textContent = tituloDe(pg); painel.append(g);
      lista.forEach(it => {
        const b = Doc.createElement("button"); b.type = "button"; b.className = "ej-marca";
        let txt = "", sub = "", cor = "";
        const ancTxt = it.ancora && it.ancora.txt ? limpo(it.ancora.txt) : "";
        if (["marca", "sublinhado", "tachado"].includes(it.tipo)) { txt = limpo(it.exato); sub = it.nota ? "Nota: " + limpo(it.nota) : ({ marca: "Marca-texto", sublinhado: "Sublinhado", tachado: "Tachado" })[it.tipo]; cor = W.ejEstojo.hexMarca ? W.ejEstojo.hexMarca(it.cor) : ""; }
        else if (it.tipo === "nota") { txt = limpo(it.texto) || "(nota vazia)"; sub = ancTxt ? "Perto de: " + ancTxt : "Nota"; cor = "#F4D35E"; }
        else if (it.tipo === "adesivo") { txt = ancTxt || "Adesivo"; sub = "Adesivo"; }
        else { txt = ancTxt ? "Perto de: " + ancTxt : "Desenho à mão"; sub = "Caneta"; cor = it.cor || ""; }
        const rotulo = it.tipo === "adesivo" ? (rot[it.conteudo] ? `<span class="ej-rot" style="--c:${rot[it.conteudo]}">${esc(it.conteudo)}</span>` : `<span style="font-size:16px">${esc(it.conteudo)}</span>`) : `<i style="--c:${esc(cor)}"></i>`;
        b.innerHTML = `${rotulo}<span><span class="ej-t"></span><small></small></span>`;
        b.querySelector(".ej-t").textContent = txt.slice(0, 140);
        b.querySelector("small").textContent = sub.slice(0, 120);
        b.onclick = () => {
          if (pagina() !== it.pagina) location.hash = "#" + it.pagina;
          setTimeout(() => { try { W.ejEstojo.focar(it.id); } catch (e) {} }, pagina() === it.pagina ? 0 : 350);
        };
        painel.append(b);
      });
    }
  }

  function alternarPainel(qual) {
    if (!painel.hidden && painel.dataset.qual === qual) return fecharPainel();
    painel.dataset.qual = qual; painel.hidden = false;
    painel.classList.toggle("ej-fixo", qual === "secao");
    qual === "secao" ? desenharSecao() : desenharMarcas();
    barra.querySelectorAll('[data-a="secao"], [data-a="marcas"]').forEach(b => b.setAttribute("aria-pressed", String(b.dataset.a === qual)));
    try { localStorage.setItem("ej_ia_nav_painel", qual); } catch (e) {}
  }
  function fecharPainel() {
    painel.hidden = true; painel.dataset.qual = "";
    barra.querySelectorAll('[data-a="secao"], [data-a="marcas"]').forEach(b => b.setAttribute("aria-pressed", "false"));
    try { localStorage.setItem("ej_ia_nav_painel", ""); } catch (e) {}
  }

  // ------------------------------------------------------------------ 8. galeria
  function figuras() {
    const figs = (D() && D().figs) || {}, saida = [], vistos = new Set();
    const pegar = (nome, legenda, pg) => { if (figs[nome] && !vistos.has(nome + pg)) { vistos.add(nome + pg); saida.push({ nome, legenda: limpo(legenda), pagina: pg }); } };
    blocos().forEach(b => (b.seq || []).forEach(it => {
      if (!Array.isArray(it)) return;
      if (it[0] === "fig" && figs[it[1]]) pegar(it[1], [it[2], it[3]].filter(x => typeof x === "string").join(" "), b.id);
      else it.forEach(x => { if (Array.isArray(x) && typeof x[0] === "string" && figs[x[0]]) pegar(x[0], x.slice(1, 3).filter(y => typeof y === "string").join(" "), b.id); });
    }));
    const er = (D() && D().er) || {};
    Object.keys(er).forEach(qid => ((er[qid] && er[qid].fund) || []).forEach(f => { if (f && f.fig) pegar(f.fig, f.t, qid); }));
    return saida;
  }
  function abrirGaleria() {
    const fs = figuras(), figs = (D() && D().figs) || {};
    vela.innerHTML = `<div class="ej-cx" role="dialog" aria-modal="true" aria-label="Figuras da apostila"><h2><span>Figuras da apostila (${fs.length})</span><button type="button">Fechar</button></h2><div class="ej-gal"></div></div>`;
    vela.querySelector("h2 button").onclick = fecharVela;
    const gal = vela.querySelector(".ej-gal");
    if (!fs.length) gal.outerHTML = `<p>Esta apostila não tem figuras.</p>`;
    fs.forEach(f => {
      const b = Doc.createElement("button"); b.type = "button";
      b.innerHTML = `<img alt="" loading="lazy"><small></small><span></span>`;
      b.querySelector("img").src = figs[f.nome];
      b.querySelector("small").textContent = tituloDe(f.pagina);
      b.querySelector("span").textContent = f.legenda.slice(0, 90);
      b.onclick = () => figuraGrande(f);
      gal && gal.append(b);
    });
    vela.hidden = false;
    vela.querySelector("h2 button").focus();
  }
  function figuraGrande(f) {
    const figs = (D() && D().figs) || {};
    vela.innerHTML = `<div class="ej-cx ej-grande" role="dialog" aria-modal="true" aria-label="Figura"><h2><span></span><button type="button">Fechar</button></h2><img alt=""><p></p>
      <div class="ej-acoes-g"><button type="button" data-a="lista">Todas as figuras</button><button type="button" class="pri" data-a="ver">Ver no texto</button></div></div>`;
    vela.querySelector("h2 span").textContent = tituloDe(f.pagina);
    vela.querySelector("img").src = figs[f.nome];
    vela.querySelector("img").alt = f.legenda;
    vela.querySelector("p").textContent = f.legenda;
    vela.querySelector("h2 button").onclick = fecharVela;
    vela.querySelector('[data-a="lista"]').onclick = abrirGaleria;
    vela.querySelector('[data-a="ver"]').onclick = () => {
      fecharVela();
      const achar = (n = 10) => {
        const img = [...Doc.querySelectorAll("article.conteudo img")].find(i => i.getAttribute("src") === figs[f.nome]);
        if (!img) { if (n > 0) setTimeout(() => achar(n - 1), 150); return; }
        const alvo = img.closest("figure") || img;
        alvo.scrollIntoView({ block: "center", behavior: "smooth" });
        alvo.classList.remove("ej-achado"); void alvo.offsetWidth; alvo.classList.add("ej-achado");
      };
      if (pagina() !== f.pagina) location.hash = "#" + f.pagina;
      setTimeout(() => achar(), 120);
    };
    vela.hidden = false;
  }
  function fecharVela() { vela.hidden = true; vela.innerHTML = ""; }

  // ------------------------------------------------------------------ 11. atalhos
  function abrirAtalhos() {
    const L = [
      ["Navegar"], ["Alt + ←  /  Alt + →", "Voltar e avançar"], ["←  /  →", "Seção anterior e próxima"], ["Ctrl + F  ou  F3", "Procurar nesta apostila (Enter: próximo)"],
      ["F", "Figuras da apostila"], ["L", "Minhas marcas"], ["?", "Esta lista"], ["Esc", "Fechar janelas e sair da tela cheia"],
      ["Estojo (com o Estojo aberto)"], ["V", "Seta (usar a apostila)"], ["M", "Marca-texto"], ["U", "Sublinhar"], ["T", "Tachar"], ["P", "Caneta"], ["H", "Marcador"],
      ["E", "Borracha"], ["N", "Nota"], ["S", "Adesivos"], ["Ctrl + Z  /  Ctrl + Y", "Desfazer e refazer"],
    ];
    const kbd = t => t.split(/\s{2}/).map(p => p.split(" + ").map(k => k.trim() === "/" || k.trim() === "ou" ? ` ${k.trim()} ` : `<kbd>${esc(k.trim())}</kbd>`).join(" + ")).join(" ");
    vela.innerHTML = `<div class="ej-cx ej-atalhos" role="dialog" aria-modal="true" aria-label="Atalhos do teclado"><h2><span>Atalhos do teclado</span><button type="button">Fechar</button></h2><table>${
      L.map(l => l.length === 1 ? `<tr class="ej-grupo-t"><td colspan="2">${esc(l[0])}</td></tr>` : `<tr><td>${kbd(l[0])}</td><td>${esc(l[1])}</td></tr>`).join("")}</table></div>`;
    vela.querySelector("h2 button").onclick = fecharVela;
    vela.hidden = false;
    vela.querySelector("h2 button").focus();
  }

  // ------------------------------------------------------------------ 4. domínio
  const nivelDe = p => p >= 0.8 ? "forte" : p >= 0.5 ? "medio" : "fraco";
  function dominioPorCapitulo() {
    const mapa = new Map(dominioConceitos.map(c => [c.conceito, c.p]));
    return capitulos().map(c => {
      const conc = new Set();
      blocos().filter(b => b.capitulo === c.id).forEach(b => {
        (b.ensina || []).forEach(x => conc.add(x));
        testes().filter(t => t.bloco === b.id).forEach(t => t.conceito && conc.add(t.conceito));
      });
      const vals = [...conc].filter(x => mapa.has(x)).map(x => mapa.get(x));
      if (!vals.length) return null;
      const m = vals.reduce((s, v) => s + v, 0) / vals.length;
      return { nivel: nivelDe(m), pct: Math.round(m * 100) };
    });
  }
  function conceitoMaisFraco() {
    const ord = [...dominioConceitos].sort((a, b) => a.p - b.p);
    for (const c of ord) {
      if (c.p >= 0.8) return null;
      const b = blocos().find(x => (x.ensina || []).includes(c.conceito)) || blocoDe((testes().find(t => t.conceito === c.conceito) || {}).bloco);
      if (b) return { conceito: c, bloco: b };
    }
    return null;
  }
  function irAoMaisFraco() {
    const f = conceitoMaisFraco();
    if (!f) return;
    ir(f.bloco.id);
    mostrarAviso(`Seu ponto mais fraco: ${nomeConceito(f.conceito.conceito) || f.conceito.conceito} (${Math.round(f.conceito.p * 100)}%).`);
    setTimeout(() => acharTrecho(nomeConceito(f.conceito.conceito)), 450);
  }
  function definirDominio(lista) {
    dominioConceitos = Array.isArray(lista) ? lista.filter(c => c && c.conceito && typeof c.p === "number") : [];
    try { W.ejTrilho && W.ejTrilho.definirDominio && W.ejTrilho.definirDominio(dominioPorCapitulo()); } catch (e) {}
    if (barra) posicionarBarra();
  }

  // ------------------------------------------------------------------ ciclo
  function redesenhar() {
    agendado = 0;
    posicionarBarra();
    enfeitarArtigo();
    enfeitarErros();
    if (!painel.hidden) painel.dataset.qual === "secao" ? (pagina() !== ultimoHash ? desenharSecao() : marcarSubAtual()) : null;
    if (pagina() !== ultimoHash) { ultimoHash = pagina(); aoRolar(); }
  }
  function agendar() { if (!agendado) agendado = requestAnimationFrame(redesenhar); }

  function aoTeclar(e) {
    if (e.defaultPrevented) return;
    if (e.key === "Escape") { if (!vela.hidden) { fecharVela(); e.preventDefault(); e.stopPropagation(); return; } if (!painel.hidden && !painel.classList.contains("ej-fixo")) { fecharPainel(); return; } }
    if (digitando(e) || e.ctrlKey || e.metaKey) return;
    if (e.altKey && (e.key === "ArrowLeft" || e.key === "ArrowRight")) { e.preventDefault(); e.key === "ArrowLeft" ? voltar() : avancar(); return; }
    if (e.altKey || !vela.hidden) return;
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") { if (W.getSelection && String(W.getSelection())) return; e.preventDefault(); seguirPorTeclado(e.key === "ArrowLeft" ? -1 : 1); return; }
    if (e.key === "?") { e.preventDefault(); abrirAtalhos(); return; }
    if (e.key === "f" || e.key === "F") { e.preventDefault(); abrirGaleria(); return; }
    if (e.key === "l" || e.key === "L") { e.preventDefault(); alternarPainel("marcas"); }
  }

  function iniciar(c) {
    cfg = c || {};
    if (!D()) return false;                                      // site sem o bloco D: nada a fazer
    const st = Doc.createElement("style"); st.id = "ejNavCss"; st.textContent = CSS; Doc.head.append(st);
    montarBarra();
    registrarNavegacao();
    addEventListener("hashchange", () => { registrarNavegacao(); agendar(); });
    addEventListener("scroll", aoRolar, { passive: true });
    addEventListener("resize", agendar);
    addEventListener("keydown", aoTeclar, true);
    addEventListener("pagehide", guardarPosicao);
    const app = Doc.getElementById("app") || Doc.body;
    new MutationObserver(agendar).observe(app, { childList: true, subtree: true });
    if (cfg.dominio) definirDominio(cfg.dominio);
    if (cfg.hash) { location.hash = "#" + cfg.hash; }
    else retomar(cfg.posicao);
    let ult = ""; try { ult = localStorage.getItem("ej_ia_nav_painel") || ""; } catch (e) {}
    if (ult === "secao" && innerWidth >= 1400) alternarPainel("secao");
    redesenhar();
    return true;
  }

  W.ejNav = { iniciar, definirDominio, definirProxima: p => { cfg.proxima = p || null; const a = artigo(); const s = a && a.querySelector(".ej-seguir"); if (s) s.replaceWith(seguirHtml(pagina())); },
              guardarPosicao, irPara: h => ir(h) };
})();
