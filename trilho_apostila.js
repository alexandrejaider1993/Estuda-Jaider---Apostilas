/* Trilho de capítulos das Apostilas interativas (18/11/2026, "opção 5" escolhida pelo usuário).
 * Roda DENTRO do quadro da apostila (injetado por web/interativos.js, como o estojo). O índice do site é
 * <details class="side"> > <details class="cp [at]"> (summary .aba = número) > div.sc com links (i.dot ok|mei|pend,
 * a.at = atual; p.ti "Questões" separa as questões). O site redesenha tudo a cada navegação, então o trilho é
 * refeito a partir desse índice sempre que o #app muda; os cliques do trilho clicam no link original.
 *   - recolhido: só os números dos capítulos; o atual destacado, com pontinhos das seções e "Q n" das questões;
 *   - passar o mouse num número abre a lista daquele capítulo por cima do texto (sem empurrar);
 *   - "»" ou arrastar a alça reabre o índice na largura deixada; aberto, a borda arrasta e "«" recolhe;
 *   - texto no centro com linha confortável; A− / A+ de 90% a 150%.
 * Escolhas no localStorage (mesmo endereço do app): ej_ia_indice ("1" aberto, "0" trilho), ej_ia_indice_larg, ej_ia_fonte.
 * Trilho a partir de 641 px; o índice aberto em coluna a partir de 941 px (abaixo disso é a faixa/gaveta do próprio site). */
(function () {
  "use strict";
  if (window.ejTrilho) return;
  const D = document, W = window;
  const LS = { get: (k, p) => { try { const v = localStorage.getItem(k); return v === null ? p : v; } catch (e) { return p; } },
               set: (k, v) => { try { localStorage.setItem(k, String(v)); } catch (e) {} } };
  let aberto = LS.get("ej_ia_indice", "1") !== "0";
  let largura = Math.min(420, Math.max(200, parseInt(LS.get("ej_ia_indice_larg", "260"), 10) || 260));
  let fonte = Math.min(150, Math.max(90, parseInt(LS.get("ej_ia_fonte", "100"), 10) || 100));
  let aoMudar = () => {};
  let trilho, voo, fonteCx, agendado = 0, timerVoo = 0;
  let dominio = [];      // por capítulo (na ordem do índice): {nivel: "forte"|"medio"|"fraco", pct}, vindo de nav_apostila.js

  const CSS = `
  .site, .topo { max-width: min(1440px, calc(100vw - 40px)) !important; box-sizing: border-box; }
  /* clip, não hidden: hidden faz do body uma área de rolagem própria e o cabeçalho (position: sticky) para de grudar no topo */
  html, body { overflow-x: clip; }
  html::-webkit-scrollbar { width: 10px; height: 10px; }
  html::-webkit-scrollbar-track { background: transparent; }
  html::-webkit-scrollbar-thumb { background: rgba(31,36,48,.18); border-radius: 5px; border: 2px solid transparent; background-clip: padding-box; }
  html::-webkit-scrollbar-thumb:hover { background-color: rgba(31,36,48,.32); }
  html::-webkit-scrollbar-button { display: none; height: 0; width: 0; }
  /* tela cheia do app: Índice, Estojo e Sair viram botões no cabeçalho, ao lado da marca */
  .ej-acoes { display: none; align-items: center; gap: 6px; margin-left: auto; }
  html.ej-app-max .ej-acoes { display: flex; }
  .ej-acoes button { height: 34px; padding: 0 14px; border: 1px solid rgba(0,0,0,.12); border-radius: 9px; background: #fff; color: #1F2430;
    font: 600 14px/1 system-ui, sans-serif; cursor: pointer; white-space: nowrap; }
  .ej-acoes button:hover { background: #F1F3F6; }
  .ej-acoes button[aria-pressed="true"] { background: #1F2430; border-color: #1F2430; color: #fff; }
  .ej-acoes button:focus-visible { outline: 2px solid #2C4A7A; outline-offset: 2px; }
  html.ej-app-max .topo { flex-wrap: nowrap; }
  html.ej-app-max .topo .marca { margin-left: 8px; }
  @media (min-width: 941px) {
    html.ej-aberto .site { grid-template-columns: var(--ej-larg, 260px) minmax(0, 1fr) !important; }
    html.ej-aberto .site > :not(.side) { margin-inline: 0 auto; }
  }
  @media (max-width: 940px) { .ej-recolher, .ej-borda { display: none !important; } html.ej-aberto .ej-fonte { top: calc(var(--ej-topo, 64px) + 62px); } }
  @media (min-width: 641px) {
    html.ej-trilho .site { grid-template-columns: minmax(0, 1fr) !important; gap: 0 !important; padding-left: 76px !important; }
    html.ej-trilho .side { display: none !important; }
    /* texto no centro, linha confortável */
    .site > :not(.side) { width: 100%; max-width: 880px; margin-inline: auto; zoom: var(--ej-fonte, 1); }
    #ejTrilho { position: fixed; left: 0; top: var(--ej-topo, 64px); bottom: 0; width: 64px; z-index: 35; display: flex; flex-direction: column; align-items: center;
      gap: 8px; padding: 14px 0 12px; border-right: 1px solid rgba(0,0,0,.08); background: rgba(255,255,255,.92); backdrop-filter: blur(6px); overflow-x: hidden; overflow-y: auto; }
    html:not(.ej-trilho) #ejTrilho { display: none; }
    .ej-num { width: 34px; height: 34px; flex: none; display: grid; place-items: center; border: 0; border-radius: 8px; background: #F1F3F6; color: #4A5260;
      font: 600 13px/1 system-ui, sans-serif; cursor: pointer; }
    .ej-num:hover { background: #E6EBF2; color: #1F3B5C; }
    /* domínio do capítulo: faixa embaixo do número (verde forte, âmbar médio, vermelho fraco) */
    .ej-num[data-dom] { box-shadow: inset 0 -3px 0 var(--ej-dom); }
    .ej-num[data-dom="forte"] { --ej-dom: #2F8F5B; } .ej-num[data-dom="medio"] { --ej-dom: #E8A33D; } .ej-num[data-dom="fraco"] { --ej-dom: #E5342D; }
    .ej-num[data-dom][aria-current="true"] { box-shadow: inset 0 -3px 0 var(--ej-dom), 0 0 0 3px rgba(44,74,122,.18); }
    .ej-num[aria-current="true"] { background: #2C4A7A; color: #fff; box-shadow: 0 0 0 3px rgba(44,74,122,.18); }
    .ej-num:focus-visible, .ej-ponto:focus-visible, #ejTrilho .ej-abrir:focus-visible, .ej-voo a:focus-visible, .ej-fonte button:focus-visible { outline: 2px solid #2C4A7A; outline-offset: 2px; }
    .ej-pontos { display: flex; flex-direction: column; align-items: center; gap: 7px; margin: -2px 0 2px; }
    .ej-ponto { width: 8px; height: 8px; padding: 0; border: 0; border-radius: 50%; background: #CDD3DC; cursor: pointer; }
    .ej-ponto.ok { background: #2C4A7A; } .ej-ponto.mei { background: #9DB3D3; } .ej-ponto.pend { background: #E8A33D; }
    .ej-ponto.at { background: #2C4A7A; box-shadow: 0 0 0 3px rgba(44,74,122,.25); width: 10px; height: 10px; }
    .ej-q { padding: 1px 5px; border: 0; border-radius: 5px; background: #FFF1D6; color: #9A5B00; font: 700 10px/16px system-ui, sans-serif; cursor: pointer; letter-spacing: .04em; }
    #ejTrilho .ej-abrir { margin-top: auto; width: 30px; height: 30px; flex: none; border: 1px solid rgba(0,0,0,.12); border-radius: 8px; background: #fff; color: #2C4A7A;
      font: 600 14px/1 system-ui, sans-serif; cursor: pointer; }
    #ejTrilho .ej-alca { position: absolute; right: 0; top: 50%; width: 8px; height: 44px; transform: translateY(-50%); border-radius: 4px; cursor: col-resize;
      background: repeating-linear-gradient(to bottom, rgba(0,0,0,.25) 0 2px, transparent 2px 5px) center / 2px 100% no-repeat; }
    .ej-voo { position: fixed; z-index: 36; width: 280px; max-height: min(70vh, 560px); overflow-y: auto; padding: 12px 8px 12px 12px; border-radius: 12px; background: #fff;
      box-shadow: 0 0 0 1px rgba(0,0,0,.08), 0 12px 32px rgba(0,0,0,.16); font: 14px/1.35 system-ui, sans-serif; color: #1F2430; }
    .ej-voo[hidden] { display: none; }
    .ej-voo-cab { display: flex; gap: 10px; align-items: flex-start; padding: 2px 4px 8px; font-weight: 600; }
    .ej-voo-cab b { flex: none; width: 24px; height: 24px; display: grid; place-items: center; border-radius: 6px; background: #2C4A7A; color: #fff; font-size: 12px; }
    .ej-voo a { display: flex; justify-content: space-between; gap: 8px; padding: 7px 10px; border-radius: 8px; color: inherit; text-decoration: none; }
    .ej-voo a:hover { background: #F1F3F6; }
    .ej-voo a.at { background: #EAF0F8; color: #2C4A7A; font-weight: 600; }
    .ej-voo a i { flex: none; width: 7px; height: 7px; margin-top: 6px; border-radius: 50%; background: #CDD3DC; }
    .ej-voo a i.ok { background: #2C4A7A; } .ej-voo a i.mei { background: #9DB3D3; } .ej-voo a i.pend { background: #E8A33D; }
    .ej-voo .ej-voo-ti { padding: 10px 10px 2px; font-size: 12px; font-weight: 600; color: #6B7280; }
    /* índice aberto: borda arrastável e botão para recolher */
    .ej-borda { position: absolute; top: 0; right: -14px; width: 10px; height: 100%; cursor: col-resize; z-index: 3; }
    .ej-borda::after { content: ""; position: absolute; left: 4px; top: 40%; width: 2px; height: 40px; border-radius: 1px; background: rgba(0,0,0,.18); }
    .ej-recolher { float: right; width: 26px; height: 24px; margin: 0 0 4px 6px; border: 1px solid rgba(0,0,0,.12); border-radius: 6px; background: #fff; color: #2C4A7A; cursor: pointer;
      font: 600 13px/1 system-ui, sans-serif; position: relative; z-index: 2; }
    .side { position: sticky; }
    /* A− / A+ */
    .ej-fonte { position: fixed; top: calc(var(--ej-topo, 64px) + 10px); right: 18px; z-index: 34; display: flex; align-items: center; border: 1px solid rgba(0,0,0,.12);
      border-radius: 9px; background: rgba(255,255,255,.95); overflow: hidden; font: 600 13px/1 system-ui, sans-serif; color: #2C4A7A; }
    .ej-fonte button { height: 30px; min-width: 34px; padding: 0 8px; border: 0; background: transparent; color: inherit; font: inherit; cursor: pointer; }
    .ej-fonte button:hover:not(:disabled) { background: #F1F3F6; }
    .ej-fonte button:disabled { opacity: .35; cursor: default; }
    .ej-fonte span { min-width: 48px; text-align: center; color: #4A5260; font-weight: 400; font-variant-numeric: tabular-nums; border-inline: 1px solid rgba(0,0,0,.08); line-height: 30px; }
  }
  @media (max-width: 640px) { #ejTrilho, .ej-voo, .ej-fonte { display: none !important; } }
  /* rolagem fina e discreta (a do Windows, cinza e com setas, destoava): só ::-webkit-scrollbar, porque
     scrollbar-width/scrollbar-color, quando definidos, desligam estas regras no Chromium */
  .ej-voo::-webkit-scrollbar, #ejTrilho::-webkit-scrollbar, .side::-webkit-scrollbar { width: 6px; height: 6px; }
  .ej-voo::-webkit-scrollbar-track, #ejTrilho::-webkit-scrollbar-track, .side::-webkit-scrollbar-track { background: transparent; }
  .ej-voo::-webkit-scrollbar-thumb, #ejTrilho::-webkit-scrollbar-thumb, .side::-webkit-scrollbar-thumb { background: rgba(31,36,48,.16); border-radius: 3px; }
  .ej-voo:hover::-webkit-scrollbar-thumb, .side:hover::-webkit-scrollbar-thumb { background: rgba(31,36,48,.30); }
  .ej-voo::-webkit-scrollbar-button, #ejTrilho::-webkit-scrollbar-button, .side::-webkit-scrollbar-button { display: none; height: 0; }
  .ej-voo, #ejTrilho, .side { scrollbar-width: auto; }
  @media (prefers-reduced-motion: reduce) { #ejTrilho { backdrop-filter: none; } }`;

  const side = () => D.querySelector(".side");
  const capitulos = () => [...D.querySelectorAll(".side details.cp")];
  function itensDe(cp) {
    const sc = cp.querySelector(".sc");
    if (!sc) return { secoes: [], questoes: [] };
    const secoes = [], questoes = [];
    let emQuestoes = false;
    [...sc.children].forEach(el => {
      if (el.matches("p.ti")) { emQuestoes = true; return; }
      if (el.matches("a")) (emQuestoes ? questoes : secoes).push(el);
    });
    return { secoes, questoes };
  }
  const estadoDe = a => { const i = a.querySelector("i.dot"); return a.classList.contains("at") ? "at" : i ? ["ok", "mei", "pend"].find(c => i.classList.contains(c)) || "" : ""; };
  const ir = a => { if (a) a.click(); };

  function aplicarClasses() {
    const h = D.documentElement;
    h.classList.toggle("ej-aberto", aberto);
    h.classList.toggle("ej-trilho", !aberto);
    h.style.setProperty("--ej-larg", largura + "px");
    h.style.setProperty("--ej-fonte", String(fonte / 100));
    const topo = D.querySelector(".topo, header");
    h.style.setProperty("--ej-topo", (topo ? Math.round(topo.getBoundingClientRect().bottom) : 64) + "px");
    const sd = side();
    if (sd && aberto && !sd.open && innerWidth > 940) sd.open = true;          // aberto = índice visível por inteiro
  }

  function desenharTrilho() {
    if (!trilho) return;
    const cps = capitulos();
    trilho.innerHTML = "";
    cps.forEach((cp, k) => {
      const num = (cp.querySelector(".aba") || {}).textContent || "?";
      const titulo = ((cp.querySelector("summary") || {}).textContent || "").replace(num, "").trim();
      const atual = cp.classList.contains("at");
      const b = D.createElement("button");
      b.type = "button"; b.className = "ej-num"; b.textContent = num.trim();
      b.setAttribute("aria-label", `Capítulo ${num.trim()}: ${titulo}`);
      if (atual) b.setAttribute("aria-current", "true");
      const dm = dominio[k];
      if (dm) { b.dataset.dom = dm.nivel; b.title = `Capítulo ${num.trim()}: domínio ${dm.pct}%`; }
      b.addEventListener("click", () => { const { secoes, questoes } = itensDe(cp); ir(secoes[0] || questoes[0]); });
      b.addEventListener("mouseenter", () => abrirVoo(cp, b));
      b.addEventListener("focus", () => abrirVoo(cp, b));
      b.addEventListener("mouseleave", fecharVooDepois);
      trilho.append(b);
      if (atual) {
        const { secoes, questoes } = itensDe(cp);
        if (secoes.length || questoes.length) {
          const pts = D.createElement("div");
          pts.className = "ej-pontos";
          secoes.forEach(a => {
            const p = D.createElement("button");
            p.type = "button"; p.className = "ej-ponto " + estadoDe(a);
            p.title = a.textContent.trim(); p.setAttribute("aria-label", a.textContent.trim());
            p.addEventListener("click", () => ir(a));
            pts.append(p);
          });
          if (questoes.length) {
            const q = D.createElement("button");
            q.type = "button"; q.className = "ej-q"; q.textContent = "Q " + questoes.length;
            q.title = `${questoes.length} ${questoes.length === 1 ? "questão" : "questões"} deste capítulo`;
            q.addEventListener("click", () => ir(questoes[0]));
            q.addEventListener("mouseenter", () => abrirVoo(cp, q));
            q.addEventListener("mouseleave", fecharVooDepois);
            pts.append(q);
          }
          trilho.append(pts);
        }
      }
    });
    const abrir = D.createElement("button");
    abrir.type = "button"; abrir.className = "ej-abrir"; abrir.textContent = "»";
    abrir.title = "Abrir o índice"; abrir.setAttribute("aria-label", "Abrir o índice da apostila");
    abrir.addEventListener("click", () => definir(true));
    const alca = D.createElement("div");
    alca.className = "ej-alca"; alca.title = "Arraste para abrir o índice";
    alca.addEventListener("pointerdown", e => arrastar(e, true));
    trilho.append(abrir, alca);
  }

  function abrirVoo(cp, ancora) {
    clearTimeout(timerVoo);
    const num = ((cp.querySelector(".aba") || {}).textContent || "").trim();
    const titulo = ((cp.querySelector("summary") || {}).textContent || "").replace(num, "").trim();
    const { secoes, questoes } = itensDe(cp);
    voo.innerHTML = "";
    const cab = D.createElement("div");
    cab.className = "ej-voo-cab";
    cab.innerHTML = `<b></b><span></span>`;
    cab.querySelector("b").textContent = num; cab.querySelector("span").textContent = titulo;
    voo.append(cab);
    const linha = (a) => {
      const x = D.createElement("a");
      x.href = "#"; x.className = a.classList.contains("at") ? "at" : "";
      x.innerHTML = "<span></span><i></i>";
      x.querySelector("span").textContent = a.textContent.trim();
      const e = estadoDe(a); if (e && e !== "at") x.querySelector("i").className = e;
      x.addEventListener("click", ev => { ev.preventDefault(); voo.hidden = true; ir(a); });
      voo.append(x);
    };
    secoes.forEach(linha);
    if (questoes.length) {
      const t = D.createElement("div"); t.className = "ej-voo-ti"; t.textContent = `Questões (${questoes.length})`; voo.append(t);
      questoes.forEach(linha);
    }
    const r = ancora.getBoundingClientRect();
    voo.hidden = false;
    voo.style.left = (r.right + 10) + "px";
    voo.style.top = Math.max(8, Math.min(r.top - 8, innerHeight - voo.offsetHeight - 8)) + "px";
  }
  function fecharVooDepois() { clearTimeout(timerVoo); timerVoo = setTimeout(() => { if (!voo.matches(":hover, :focus-within")) voo.hidden = true; }, 220); }

  // arrastar: do trilho (abre na largura arrastada) ou da borda do índice aberto (muda a largura)
  function arrastar(e, doTrilho) {
    e.preventDefault();
    const x0 = e.clientX, l0 = doTrilho ? 64 : largura;
    let mexeu = false;
    const mover = ev => {
      const l = Math.min(420, Math.max(doTrilho ? 64 : 200, l0 + ev.clientX - x0));
      if (Math.abs(ev.clientX - x0) > 4) mexeu = true;
      if (doTrilho && l >= 160 && !aberto) { definir(true, false); }
      if (aberto) { largura = Math.max(200, l); D.documentElement.style.setProperty("--ej-larg", largura + "px"); }
    };
    const soltar = () => {
      removeEventListener("pointermove", mover); removeEventListener("pointerup", soltar);
      if (aberto && mexeu) LS.set("ej_ia_indice_larg", largura);
      if (doTrilho && !mexeu) definir(true);
    };
    addEventListener("pointermove", mover); addEventListener("pointerup", soltar);
  }

  function enfeitarIndiceAberto() {
    const sd = side();
    if (!sd || !aberto || sd.querySelector(".ej-recolher")) return;
    const sum = sd.querySelector(":scope > summary");
    const rec = D.createElement("button");
    rec.type = "button"; rec.className = "ej-recolher"; rec.textContent = "«";
    rec.title = "Recolher o índice em números"; rec.setAttribute("aria-label", "Recolher o índice");
    rec.addEventListener("click", ev => { ev.preventDefault(); ev.stopPropagation(); definir(false); });
    if (sum) sum.prepend(rec);
    const borda = D.createElement("div");
    borda.className = "ej-borda"; borda.title = "Arraste para mudar a largura do índice";
    borda.addEventListener("pointerdown", e => arrastar(e, false));
    sd.append(borda);
  }

  function desenharFonte() {
    if (!fonteCx) return;
    fonteCx.querySelector("span").textContent = fonte + "%";
    fonteCx.querySelector('[data-f="-"]').disabled = fonte <= 90;
    fonteCx.querySelector('[data-f="+"]').disabled = fonte >= 150;
  }
  function mudarFonte(d) {
    fonte = Math.min(150, Math.max(90, fonte + d));
    LS.set("ej_ia_fonte", fonte);
    D.documentElement.style.setProperty("--ej-fonte", String(fonte / 100));
    desenharFonte();
  }

  function definir(abrir, avisarApp = true) {
    aberto = !!abrir;
    LS.set("ej_ia_indice", aberto ? "1" : "0");
    redesenhar();
    if (avisarApp) try { aoMudar({ aberto }); } catch (e) {}
    D.querySelectorAll('.ej-acoes [data-a="indice"]').forEach(b => b.setAttribute("aria-pressed", aberto ? "true" : "false"));
  }

  function redesenhar() {
    agendado = 0;
    aplicarClasses();
    if (!aberto) desenharTrilho(); else enfeitarIndiceAberto();
  }
  function agendar() { if (!agendado) agendado = requestAnimationFrame(redesenhar); }

  function iniciar(cfg) {
    cfg = cfg || {};
    if (typeof cfg.aoMudar === "function") aoMudar = cfg.aoMudar;
    const st = D.createElement("style"); st.id = "ejTrilhoCss"; st.textContent = CSS; D.head.append(st);
    trilho = D.createElement("nav"); trilho.id = "ejTrilho"; trilho.setAttribute("aria-label", "Capítulos");
    voo = D.createElement("div"); voo.className = "ej-voo"; voo.hidden = true; voo.setAttribute("role", "menu");
    voo.addEventListener("mouseleave", fecharVooDepois);
    voo.addEventListener("mouseenter", () => clearTimeout(timerVoo));
    fonteCx = D.createElement("div"); fonteCx.className = "ej-fonte"; fonteCx.setAttribute("role", "group"); fonteCx.setAttribute("aria-label", "Tamanho da letra");
    fonteCx.innerHTML = `<button type="button" data-f="-" aria-label="Diminuir a letra">A−</button><span aria-live="polite"></span><button type="button" data-f="+" aria-label="Aumentar a letra">A+</button>`;
    fonteCx.querySelector('[data-f="-"]').addEventListener("click", () => mudarFonte(-10));
    fonteCx.querySelector('[data-f="+"]').addEventListener("click", () => mudarFonte(10));
    D.body.append(trilho, voo, fonteCx);
    const topo = D.querySelector(".topo");
    if (topo && !topo.querySelector(".ej-acoes")) {
      const ac = D.createElement("div");
      ac.className = "ej-acoes"; ac.setAttribute("role", "group"); ac.setAttribute("aria-label", "Tela cheia");
      ac.innerHTML = `<button type="button" data-a="indice">Índice</button><button type="button" data-a="estojo">Estojo</button><button type="button" data-a="sair">Sair da tela cheia</button>`;
      ac.addEventListener("click", e => {
        const b = e.target.closest("button[data-a]");
        const app = W.parent && W.parent.ejApostilaAcoes;
        if (!b) return;
        if (b.dataset.a === "indice") definir(!aberto);
        else if (app && typeof app[b.dataset.a] === "function") app[b.dataset.a]();
      });
      const marca = topo.querySelector(".marca");
      marca ? topo.insertBefore(ac, marca) : topo.append(ac);
    }
    desenharFonte();
    const app = D.getElementById("app") || D.body;
    new MutationObserver(muts => { if (muts.some(m => ![...m.addedNodes, ...m.removedNodes].every(n => n === trilho || n === voo || n === fonteCx))) agendar(); })
      .observe(app, { childList: true, subtree: true });
    addEventListener("resize", agendar);
    addEventListener("keydown", e => { if (e.key === "Escape") voo.hidden = true; });
    redesenhar();
  }

  // o app avisa o estado da tela cheia e do estojo (para os botões do cabeçalho)
  function estadoApp(e) {
    D.documentElement.classList.toggle("ej-app-max", !!e.max);
    D.querySelectorAll(".ej-acoes [data-a]").forEach(b => {
      if (b.dataset.a === "indice") b.setAttribute("aria-pressed", aberto ? "true" : "false");
      if (b.dataset.a === "estojo") b.setAttribute("aria-pressed", e.estojo ? "true" : "false");
    });
  }
  function definirDominio(lista) { dominio = Array.isArray(lista) ? lista : []; agendar(); }
  W.ejTrilho = { iniciar, definirDominio, aberto: () => aberto, alternar: () => definir(!aberto), definir, estadoApp };
})();
