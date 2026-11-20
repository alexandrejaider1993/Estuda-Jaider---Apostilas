/*
  Estojo da apostila interativa: marca-texto, sublinhado, caneta, marcador, borracha, notas e adesivos
  DESENHADOS SOBRE o site da apostila (que abre num <iframe> no mesmo endereço do app).

  Este arquivo roda DENTRO do iframe: web/interativos.js o injeta no documento da apostila e chama
  window.ejEstojo.iniciar({ pasta, aoMudar }). A barra de ferramentas fica na página do app e chama
  ejEstojo.usar(ferramenta, opcoes), desfazer(), refazer(), visivel(bool), limparPagina().

  Como as marcações sobrevivem ao site: o site redesenha #app inteiro (innerHTML) a cada clique e a cada
  troca de capítulo (#hash). Por isso nada é guardado como DOM:
    - marca-texto/sublinhado = trecho de texto (exato + 32 letras antes e depois, como TextQuoteSelector do W3C),
      procurado de novo no texto do artigo a cada redesenho e embrulhado em <mark class="ej-m">;
    - traços, notas e adesivos = âncora no bloco (parágrafo, item, figura...) mais próximo: caminho de filhos a
      partir de article.conteudo + tag + começo do texto; x em fração da largura do bloco, y em px do topo dele.
  Tudo fica numa camada própria (#ejCamada, filha do <body>, fora do #app). Página = location.hash (ou "mapa").

  Itens (gravados em Interativos/<pasta>/anotacoes-<PC>.json pela rota /api/interativos/<pasta>/anotacoes):
    {id, pagina, tipo:"marca"|"sublinhado"|"tachado", cor, exato, antes, depois, pos, nota?}
    {id, pagina, tipo:"traco", cor, largura, opacidade, ancora, pts:[[fx, dy], ...]}
    {id, pagina, tipo:"nota", ancora, x, y, texto, aberta, cor}
    {id, pagina, tipo:"adesivo", ancora, x, y, conteudo}
  Apagar = {id, apagado:true}. Todos levam atualizado_em (ms) para juntar os PCs.
*/
(function () {
  "use strict";
  if (window.ejEstojo) return;

  const D = document, W = window;
  const BLOCOS_DISPLAY = /^(block|list-item|table|table-row|table-cell|flex|grid|flow-root)$/;
  const PULAR_TEXTO = "script,style,textarea,input,select,noscript,.ej-ui";
  // Marca-texto: paleta única Stabilo (web/marca_texto.js, gerada de marca_texto.py), passada pela página em iniciar().
  // A cor fica guardada pelo código ("70/24"). Nomes antigos (antes da paleta) viram o tom Stabilo mais parecido.
  let MT = null;
  const MARCA_ANTIGAS = { amarelo: "70/24", verde: "70/116", rosa: "70/158", azul: "70/112", laranja: "70/125" };
  const infoMarca = v => { v = MARCA_ANTIGAS[v] || v; return (MT && (MT.info(v) || MT.info(MT.padrao))) || { hex: "#FAE905", escura: false, codigo: "70/24", nome: "Amarelo", gama: "Neon" }; };
  const hexMarca = v => infoMarca(v).hex;
  const CORES_CANETA = { preto: "#1D1D1F", vermelho: "#E5342D", azul: "#2563EB", verde: "#15803D", roxo: "#7C3AED" };
  const CORES_NOTA = { amarelo: "#FFF3A8", verde: "#D3F5D7", rosa: "#FFD9E8", azul: "#D6ECFF" };
  // Setas (19/11/2026): conteudo "seta:<forma>:<cor>", desenhadas em SVG; o giro do adesivo aponta para qualquer lado
  const CORES_SETA = { vermelho: "#E5342D", azul: "#2563EB", preto: "#1D1D1F", verde: "#15803D" };
  const FORMAS_SETA = {
    reta: ["0 0 48 24", '<path d="M4 12h34"/><path d="M29 4l10 8-10 8"/>'],
    dupla: ["0 0 48 24", '<path d="M8 12h32"/><path d="M17 4L7 12l10 8"/><path d="M31 4l10 8-10 8"/>'],
    curva: ["0 0 48 32", '<path d="M5 27C9 11 23 6 38 9"/><path d="M30 2l9 7-8 7"/>'],
    grossa: ["0 0 48 28", '<path d="M3 14h30" stroke-width="8"/><path d="M27 3l16 11-16 11z" fill="currentColor"/>']
  };
  const SETAS = {};
  for (const f of Object.keys(FORMAS_SETA)) for (const c of Object.keys(CORES_SETA)) SETAS[`seta:${f}:${c}`] = { f, c };
  function adesivoHtml(v) {
    const s = SETAS[v];
    if (!s) return String(v).replace(/[<>&]/g, ch => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[ch]);
    const [vb, corpo] = FORMAS_SETA[s.f];
    return `<svg viewBox="${vb}" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" style="color:${CORES_SETA[s.c]}" aria-hidden="true">${corpo}</svg>`;
  }
  // inclinação (graus) e tamanho (%) de um adesivo; os rótulos antigos nasciam inclinados -3°
  const giroDe = it => (it && it.giro != null && Number.isFinite(+it.giro)) ? +it.giro : (it && ROTULOS[it.conteudo] ? -3 : 0);
  const escalaDe = it => (it && Number.isFinite(+it.escala) && +it.escala > 0) ? +it.escala : 100;
  const ROTULOS = {
    "CAI NA PROVA": "#E5342D", "REVISAR": "#E8590C", "DÚVIDA": "#2563EB", "DECORAR": "#7C3AED", "IMPORTANTE": "#15803D"
  };

  let pasta = "", aoMudar = () => {};
  // cfg (19/11/2026, Estojo também no Teste da Calculadora, na própria página do app):
  //   raiz()      elemento anotável (padrão: article.conteudo do site da apostila)
  //   hospedeiro  elemento com position:relative onde fica a camada (padrão: <body>, coordenadas do documento)
  //   pagina()    chave da "página" (padrão: o #hash)
  //   url         rota GET/POST das anotações (padrão: /api/interativos/<pasta>/anotacoes)
  //   observar()  elemento cujo redesenho pede redesenhar as marcas (padrão: #app)
  //   ativo()     false = ignora teclado e cliques (ex.: aba fechada); atalhos:false = sem as letras (V, M, P...)
  let cfgG = {};
  let itens = {};                      // id -> item (inclui apagados)
  let pendentes = new Map();           // id -> item a gravar
  let timerSalvar = 0, salvando = false, estadoSalvo = "salvo";
  let ferramenta = "mao";
  let op = { corMarca: "70/24", corCaneta: "preto", corSub: "preto", corTach: "vermelho", largura: 3, corNota: "amarelo", adesivo: "⭐", intensidade: 100 };
  // A cor (e a espessura, o adesivo...) escolhida vira o padrão: fica no localStorage do endereço do app, que é o mesmo
  // nas apostilas (quadro) e no Teste da Calculadora, e volta ao abrir de novo (19/11/2026, pedido do usuário).
  const CHAVE_OP = "ej_estojo_op";
  const PADRAO = { corMarca: "70/24", corSub: "preto", corTach: "vermelho", intensidade: 100 };   // "Restaurar padrão"
  function definirPadrao(o) { op = { ...op, ...o }; salvarOpcoes(); avisar(); }   // como usar(null, o), mas sem fechar o menu aberto
  function lembrarIntensidade(v) { try { localStorage.setItem("ej_estojo_intensidade", String(v)); } catch (e) {} }   // a barra do app lê esta chave ao abrir
  function lerOpcoesSalvas() { try { const o = JSON.parse(localStorage.getItem(CHAVE_OP) || "{}"); if (o && typeof o === "object") op = { ...op, ...o }; } catch (e) {} }
  function salvarOpcoes() { try { localStorage.setItem(CHAVE_OP, JSON.stringify(op)); } catch (e) {} }
  const deLinha = it => it.tipo === "sublinhado" || it.tipo === "tachado";
  // Intensidade do marca-texto e do marcador (0 a 100%, 18/11/2026): guardada em cada item; sem o campo = 100%.
  const forca = it => { const v = Number(it && it.intensidade); return Number.isFinite(v) ? Math.min(100, Math.max(0, v)) : 100; };
  let mostrar = true;
  let pilhaDesfazer = [], pilhaRefazer = [];
  let camada, svg, observador, quadroAgendado = 0, aplicando = false;
  let tracoAtual = null, arrasto = null, apagando = false;
  let apagandoId = null, ultimaCanetaEm = 0;
  const PALMA_MS = 400;
  const ehCaneta = e => e && e.pointerType === "pen";
  const palmaRecente = e => e && e.pointerType === "touch" && (agora() - ultimaCanetaEm < PALMA_MS);
  function marcarCaneta(ativa) {
    ultimaCanetaEm = agora();
    if (ativa) D.documentElement.classList.add("ej-pen-ativa");
  }

  // ------------------------------------------------------------ utilidades
  const agora = () => Date.now();
  const novoId = () => "a" + agora().toString(36) + Math.random().toString(36).slice(2, 8);
  const pagina = () => cfgG.pagina ? String(cfgG.pagina() || "") : (decodeURIComponent(location.hash.slice(1)) || "mapa");
  const artigo = () => cfgG.raiz ? cfgG.raiz() : D.querySelector("article.conteudo");
  const ativo = () => !cfgG.ativo || !!cfgG.ativo();
  const urlAnot = () => cfgG.url || `/api/interativos/${encodeURIComponent(pasta)}/anotacoes`;
  // cliente (viewport) -> coordenadas da camada: no documento (padrão) ou dentro do hospedeiro
  const org = () => {
    const h = cfgG.hospedeiro;
    if (!h) return { x: scrollX, y: scrollY };
    const r = h.getBoundingClientRect();
    return { x: h.scrollLeft - r.left - h.clientLeft, y: h.scrollTop - r.top - h.clientTop };
  };
  const pX = e => e.clientX + org().x, pY = e => e.clientY + org().y;
  const norm = s => String(s || "").replace(/\s+/g, " ").trim();
  const rectDoc = el => { const r = el.getBoundingClientRect(), o = org(); return { left: r.left + o.x, top: r.top + o.y, width: r.width, height: r.height, right: r.right + o.x, bottom: r.bottom + o.y }; };
  const daPagina = () => Object.values(itens).filter(i => !i.apagado && i.pagina === pagina());
  const corDe = (tabela, nome, padrao) => tabela[nome] || nome || padrao;

  // ------------------------------------------------------------ gravar (mudanças em lote, com nova tentativa)
  function mudar(item, registrar = true) {
    const antes = itens[item.id] ? JSON.parse(JSON.stringify(itens[item.id])) : null;
    item.atualizado_em = agora();
    itens[item.id] = item;
    pendentes.set(item.id, item);
    if (registrar) { pilhaDesfazer.push({ antes, depois: JSON.parse(JSON.stringify(item)) }); if (pilhaDesfazer.length > 200) pilhaDesfazer.shift(); pilhaRefazer = []; }
    agendarSalvar();
    agendarDesenho();
    avisar();
  }
  function apagar(id, registrar = true) {
    const it = itens[id];
    if (!it || it.apagado) return;
    mudar({ id, apagado: true, pagina: it.pagina }, false);
    if (registrar) { pilhaDesfazer.push({ antes: it, depois: null }); pilhaRefazer = []; }
  }
  function agendarSalvar() {
    estadoSalvo = "salvando"; avisar();
    clearTimeout(timerSalvar);
    timerSalvar = setTimeout(salvarAgora, 700);
  }
  async function salvarAgora() {
    clearTimeout(timerSalvar);
    if (salvando || !pendentes.size || (!pasta && !cfgG.url)) { if (!pendentes.size) { estadoSalvo = "salvo"; avisar(); } return; }
    salvando = true;
    const lote = [...pendentes.values()];
    pendentes = new Map();
    try {
      const r = await fetch(urlAnot(), {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itens: lote }), keepalive: true
      });
      if (!r.ok) throw new Error("HTTP " + r.status);
      estadoSalvo = pendentes.size ? "salvando" : "salvo";
    } catch (e) {
      for (const it of lote) if (!pendentes.has(it.id)) pendentes.set(it.id, it);
      estadoSalvo = "erro";
      setTimeout(salvarAgora, 5000);
    }
    salvando = false;
    avisar();
    if (pendentes.size && estadoSalvo !== "erro") salvarAgora();
  }
  function avisar() {
    try { aoMudar({ ferramenta, op: { ...op }, mostrar, salvo: estadoSalvo, naPagina: daPagina().length, podeDesfazer: pilhaDesfazer.length > 0, podeRefazer: pilhaRefazer.length > 0 }); } catch (e) {}
  }

  // ------------------------------------------------------------ texto do artigo (para marca-texto)
  function nosDeTexto(raiz) {
    const lista = [];
    let total = 0;
    const w = D.createTreeWalker(raiz, NodeFilter.SHOW_TEXT, {
      acceptNode: n => (n.parentElement && n.parentElement.closest(PULAR_TEXTO)) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
    });
    let n;
    while ((n = w.nextNode())) { lista.push({ no: n, ini: total, fim: total + n.data.length }); total += n.data.length; }
    return { lista, texto: lista.map(x => x.no.data).join("") };
  }
  // posição global de um ponto (container, offset) do Range dentro de nosDeTexto
  function posGlobal(idx, container, offset, ehFim) {
    if (container.nodeType === 3) {
      const e = idx.lista.find(x => x.no === container);
      if (e) return e.ini + offset;
    }
    // ponto entre elementos: primeiro nó de texto depois do ponto (início) ou o último antes (fim)
    const ref = container.nodeType === 3 ? container : (container.childNodes[offset] || null);
    if (!ehFim) {
      for (const e of idx.lista) {
        if (!ref) break;
        if (ref === e.no || (ref.compareDocumentPosition(e.no) & (Node.DOCUMENT_POSITION_FOLLOWING | Node.DOCUMENT_POSITION_CONTAINED_BY))) return e.ini;
      }
      return idx.texto.length;
    }
    let ult = 0;
    for (const e of idx.lista) {
      const depois = ref ? (ref === e.no || (ref.compareDocumentPosition(e.no) & Node.DOCUMENT_POSITION_FOLLOWING)) : false;
      if (ref && depois && !(ref.compareDocumentPosition(e.no) & Node.DOCUMENT_POSITION_CONTAINED_BY)) break;
      ult = e.fim;
    }
    return ult;
  }
  function acharTrecho(idx, it) {
    const T = idx.texto, ex = it.exato;
    if (!ex) return null;
    let melhor = null, nota = -1, de = 0, k;
    while ((k = T.indexOf(ex, de)) !== -1) {
      let s = 0;
      const a = it.antes || "", d = it.depois || "";
      for (let i = 1; i <= a.length && T[k - i] === a[a.length - i]; i++) s++;
      for (let i = 0; i < d.length && T[k + ex.length + i] === d[i]; i++) s++;
      s -= Math.min(30, Math.abs(k - (it.pos || 0)) / 2000);
      if (s > nota) { nota = s; melhor = k; }
      de = k + 1;
    }
    return melhor === null ? null : [melhor, melhor + ex.length];
  }
  function embrulhar(idx, ini, fim, it) {
    const pecas = [];
    for (const e of idx.lista) {
      if (e.fim <= ini || e.ini >= fim) continue;
      const pai = e.no.parentNode;
      if (!pai || /^(TABLE|TBODY|THEAD|TR|UL|OL|SELECT)$/.test(pai.nodeName)) continue;
      let no = e.no;
      const a = Math.max(0, ini - e.ini), b = Math.min(no.data.length, fim - e.ini);
      if (!no.data.slice(a, b).trim()) continue;
      if (b < no.data.length) no.splitText(b);
      if (a > 0) no = no.splitText(a);
      const m = D.createElement("mark");
      const sub = it.tipo === "sublinhado";
      m.className = "ej-m " + (sub ? "ej-sub" : it.tipo === "tachado" ? "ej-tach" : "ej-marca" + (infoMarca(it.cor).escura && forca(it) >= 60 ? " ej-escura" : ""));
      m.dataset.id = it.id;
      m.style.setProperty("--ej-cor", deLinha(it) ? corDe(CORES_CANETA, it.cor, "#1D1D1F") : hexMarca(it.cor));   // tachado também é cor de caneta (antes caía no amarelo)
      if (!deLinha(it)) m.style.setProperty("--ej-forca", forca(it) + "%");
      pai.replaceChild(m, no);
      m.append(no);
      pecas.push(m);
    }
    return pecas;
  }
  function desembrulharTudo() {
    const pais = new Set();
    (artigo() || D).querySelectorAll("mark.ej-m").forEach(m => { const p = m.parentNode; if (!p) return; while (m.firstChild) p.insertBefore(m.firstChild, m); p.removeChild(m); pais.add(p); });
    pais.forEach(p => p.normalize && p.normalize());
  }

  // ------------------------------------------------------------ âncora em blocos (traços, notas, adesivos)
  // .ej-ui = elementos postos pelo app (ligações e "anterior/próxima" de nav_apostila.js): não contam no caminho da âncora
  function filhosVisiveis(el) { return [...el.children].filter(c => !c.matches("mark.ej-m, .ej-ui")); }
  function caminhoDe(art, el) {
    const partes = [];
    while (el && el !== art) { const p = el.parentElement; if (!p) return null; partes.unshift(filhosVisiveis(p).indexOf(el)); el = p; }
    return partes.join("/");
  }
  function seguir(art, caminho) {
    let el = art;
    for (const i of (caminho ? caminho.split("/") : [])) { el = filhosVisiveis(el)[+i]; if (!el) return null; }
    return el;
  }
  function ehBloco(el) {
    const cs = getComputedStyle(el);
    if (!BLOCOS_DISPLAY.test(cs.display)) return false;
    const r = el.getBoundingClientRect();
    return r.height >= 10 && r.height <= 700;
  }
  function ancorar(xDoc, yDoc) {
    const art = artigo();
    if (!art) return null;
    const antes = camada.style.pointerEvents;
    camada.style.pointerEvents = "none";
    camada.classList.add("ej-sem-alvo");
    const o = org();
    let el = D.elementFromPoint(xDoc - o.x, yDoc - o.y);
    camada.classList.remove("ej-sem-alvo");
    camada.style.pointerEvents = antes;
    if (!el || !art.contains(el)) el = art;
    while (el !== art && !ehBloco(el)) el = el.parentElement;
    const r = rectDoc(el);
    return {
      ancora: { caminho: caminhoDe(art, el) ?? "", tag: el.tagName, txt: norm(el.textContent).slice(0, 40) },
      x: r.width ? (xDoc - r.left) / r.width : 0, y: yDoc - r.top, r
    };
  }
  function resolver(an) {
    const art = artigo();
    if (!art || !an) return null;
    if (!an.caminho) return art;
    const el = seguir(art, an.caminho);
    if (el && el.tagName === an.tag && norm(el.textContent).slice(0, 40) === an.txt) return el;
    if (an.txt) {
      for (const c of art.querySelectorAll(an.tag)) if (norm(c.textContent).slice(0, 40) === an.txt) return c;
    }
    return el && el.tagName === an.tag ? el : null;
  }
  function pontoDoc(it, el, fx, dy) { const r = rectDoc(el); return [r.left + fx * r.width, r.top + dy]; }

  // ------------------------------------------------------------ desenhar tudo da página atual
  function agendarDesenho() {
    if (quadroAgendado) return;
    quadroAgendado = requestAnimationFrame(() => { quadroAgendado = 0; desenharTudo(); });
  }
  function desenharTudo() {
    if (!camada) return;
    aplicando = true;
    if (observador) observador.disconnect();
    desembrulharTudo();
    const doc = D.documentElement, h = cfgG.hospedeiro;
    // zera antes de medir: a própria camada entra no scrollHeight e, sem isso, nunca encolhe
    // (uma tela longa deixava todas as seguintes com rolagem até o branco)
    camada.style.width = "0px"; camada.style.height = "0px";
    camada.style.width = (h ? h.scrollWidth : Math.max(doc.scrollWidth, D.body.scrollWidth)) + "px";
    camada.style.height = (h ? h.scrollHeight : Math.max(doc.scrollHeight, D.body.scrollHeight)) + "px";
    camada.classList.toggle("ej-oculta", !mostrar);
    const art = artigo(), lista = mostrar ? daPagina() : [];
    if (art) art.classList.add("ej-raiz");
    // 1) marca-texto e sublinhado
    const marcas = art ? lista.filter(i => i.tipo === "marca" || i.tipo === "sublinhado" || i.tipo === "tachado") : [];
    const posNota = [];
    if (marcas.length) {
      for (const it of marcas) {
        const idx = nosDeTexto(art);      // refeito a cada marca: o embrulho anterior divide nós de texto
        const t = acharTrecho(idx, it);
        if (!t) continue;
        const pecas = embrulhar(idx, t[0], t[1], it);
        if (it.nota && pecas.length) posNota.push([it, pecas[pecas.length - 1]]);
      }
    }
    // 2) traços (SVG)
    let html = "";
    for (const it of lista.filter(i => i.tipo === "traco")) {
      const el = resolver(it.ancora);
      if (!el) continue;
      const pts = it.pts.map(([fx, dy]) => pontoDoc(it, el, fx, dy));
      const marcador = it.marcador || it.opacidade < 1;
      const cor = marcador ? hexMarca(it.cor) : corDe(CORES_CANETA, it.cor, "#1D1D1F");
      html += `<path data-id="${it.id}" d="${caminhoSvg(pts)}" stroke="${cor}" stroke-width="${it.largura}"${marcador ? ` class="ej-marcador" stroke-opacity="${forca(it) / 100}"` : ""}/>`;
    }
    svg.innerHTML = html;
    // 3) notas e adesivos (reaproveita o elemento: não perde o foco de quem está escrevendo)
    const vivos = new Set();
    for (const it of lista.filter(i => i.tipo === "nota" || i.tipo === "adesivo")) {
      const el = resolver(it.ancora);
      if (!el) continue;
      const [x, y] = pontoDoc(it, el, it.x, it.y);
      const no = elementoDe(it);
      no.style.left = x + "px"; no.style.top = y + "px";
      vivos.add(it.id);
    }
    for (const [it, ultima] of posNota) {
      const rs = ultima.getClientRects(), r = rs[rs.length - 1];
      if (!r) continue;
      const no = elementoDe({ id: it.id + "-n", tipo: "selo", alvo: it.id });
      const o = org();
      no.style.left = (r.right + o.x + 1) + "px"; no.style.top = (r.top + o.y - 8) + "px";
      vivos.add(it.id + "-n");
    }
    camada.querySelectorAll("[data-item]").forEach(n => {
      const it = itens[n.dataset.item];
      if (!vivos.has(n.dataset.item) && (!n.contains(D.activeElement) || !it || it.apagado)) n.remove();
    });
    const alvoObs = cfgG.observar ? cfgG.observar() : D.getElementById("app");
    if (observador && alvoObs) observador.observe(alvoObs, { childList: true, subtree: true, characterData: true });
    observador && observador.takeRecords();
    aplicando = false;
  }
  function caminhoSvg(p) {
    if (!p.length) return "";
    if (p.length === 1) return `M${p[0][0].toFixed(1)} ${p[0][1].toFixed(1)}l0.01 0`;
    let d = `M${p[0][0].toFixed(1)} ${p[0][1].toFixed(1)}`;
    for (let i = 1; i < p.length - 1; i++) {
      const mx = (p[i][0] + p[i + 1][0]) / 2, my = (p[i][1] + p[i + 1][1]) / 2;
      d += `Q${p[i][0].toFixed(1)} ${p[i][1].toFixed(1)} ${mx.toFixed(1)} ${my.toFixed(1)}`;
    }
    const u = p[p.length - 1];
    return d + `L${u[0].toFixed(1)} ${u[1].toFixed(1)}`;
  }

  // ------------------------------------------------------------ notas, adesivos e selo de nota da marca
  function elementoDe(it) {
    let no = camada.querySelector(`[data-item="${it.id}"]`);
    if (it.tipo === "nota") {
      if (!no) {
        no = D.createElement("div");
        no.className = "ej-nota ej-ui";
        no.dataset.item = it.id;
        no.innerHTML = `<button type="button" class="ej-nota-icone" title="Abrir nota" aria-label="Abrir nota">${ICONE_NOTA}</button>
          <div class="ej-nota-cartao"><div class="ej-nota-topo"><span>Nota</span>
          <button type="button" data-a="min" title="Recolher">–</button><button type="button" data-a="del" title="Apagar nota">×</button></div>
          <textarea placeholder="Escreva sua nota..." spellcheck="true"></textarea></div>`;
        const ta = no.querySelector("textarea");
        ta.addEventListener("input", () => { const i = itens[it.id]; if (i) { i.texto = ta.value; mudar(i, false); } });
        no.querySelector(".ej-nota-icone").onclick = () => { const i = itens[it.id]; if (i && ferramenta !== "borracha") { i.aberta = true; mudar(i, false); setTimeout(() => no.querySelector("textarea").focus(), 30); } };
        no.querySelector('[data-a="min"]').onclick = () => { const i = itens[it.id]; if (i && !i.apagado) { i.aberta = false; no.classList.remove("aberta"); mudar(i, false); } };
        no.querySelector('[data-a="del"]').onclick = () => apagar(it.id);
        ligarArrasto(no, it.id, ".ej-nota-topo, .ej-nota-icone");
        camada.append(no);
      }
      const i = itens[it.id];
      no.classList.toggle("aberta", !!i.aberta);
      no.style.setProperty("--ej-nota", corDe(CORES_NOTA, i.cor, "#FFF3A8"));
      const ta = no.querySelector("textarea");
      if (D.activeElement !== ta && ta.value !== (i.texto || "")) ta.value = i.texto || "";
      no.title = i.aberta ? "" : (i.texto || "Nota vazia");
    } else if (it.tipo === "adesivo") {
      if (!no) {
        no = D.createElement("div");
        no.className = "ej-adesivo ej-ui";
        no.dataset.item = it.id;
        no.title = "Dois cliques: girar, mudar o tamanho ou apagar";
        ligarArrasto(no, it.id, null);
        no.addEventListener("dblclick", e => {
          if (!ativo() || ferramenta === "borracha") return;
          e.preventDefault(); e.stopPropagation();
          const r = no.getBoundingClientRect(), o = org();
          abrirMenuAdesivo(it.id, r.left + o.x, r.bottom + o.y);
        });
        camada.append(no);
      }
      const rot = ROTULOS[it.conteudo];
      no.classList.toggle("ej-rotulo", !!rot);
      no.classList.toggle("ej-seta", !!SETAS[it.conteudo]);
      if (rot) no.style.setProperty("--ej-rot", rot);
      no.style.setProperty("--ej-giro", giroDe(it) + "deg");
      no.style.setProperty("--ej-escala", escalaDe(it) / 100);
      if (no.dataset.c !== it.conteudo) { no.dataset.c = it.conteudo; no.innerHTML = adesivoHtml(it.conteudo); }
    } else if (it.tipo === "selo") {
      if (!no) {
        no = D.createElement("button");
        no.type = "button";
        no.className = "ej-selo ej-ui";
        no.dataset.item = it.id;
        no.title = "Ver nota";
        no.innerHTML = ICONE_NOTA;
        no.onclick = e => { e.stopPropagation(); const r = no.getBoundingClientRect(); abrirMenuMarca(it.alvo, r.left + org().x, r.bottom + org().y, true); };
        camada.append(no);
      }
    }
    return no;
  }
  const ICONE_NOTA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15.5 3H5a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h14a2 2 0 0 0 2-2V8.5L15.5 3Z"/><path d="M15 3v6h6"/></svg>';

  // mover nota/adesivo arrastando (na ferramenta seta); solta = nova âncora no bloco embaixo
  function ligarArrasto(no, id, alca) {
    no.addEventListener("pointerdown", e => {
      if (ferramenta === "borracha") { e.preventDefault(); e.stopPropagation(); apagar(id); return; }
      if (alca && !e.target.closest(alca)) return;
      if (e.target.closest("button[data-a]")) return;
      if (e.button !== 0) return;
      const r = no.getBoundingClientRect();
      arrasto = { id, no, dx: e.clientX - r.left, dy: e.clientY - r.top, x0: e.clientX, y0: e.clientY, moveu: false };
      no.setPointerCapture(e.pointerId);
      e.stopPropagation();
    });
    no.addEventListener("pointermove", e => {
      if (!arrasto || arrasto.no !== no) return;
      if (Math.abs(e.clientX - arrasto.x0) + Math.abs(e.clientY - arrasto.y0) > 3) arrasto.moveu = true;
      if (!arrasto.moveu) return;
      const o = org();
      no.style.left = (e.clientX - arrasto.dx + o.x) + "px";
      no.style.top = (e.clientY - arrasto.dy + o.y) + "px";
    });
    no.addEventListener("pointerup", e => {
      if (!arrasto || arrasto.no !== no) return;
      const a = arrasto; arrasto = null;
      if (!a.moveu) return;
      const o = org(), i = itens[id], an = i && ancorar(e.clientX - a.dx + o.x, e.clientY - a.dy + o.y);
      if (!i || !an) return;
      mudar({ ...i, ancora: an.ancora, x: an.x, y: an.y });
    });
  }

  // ------------------------------------------------------------ menu de uma marca (cor, trocar tipo, nota, apagar)
  let menu = null;
  function fecharMenu() { if (menu) { menu.remove(); menu = null; } }
  function abrirMenuMarca(id, x, y, focarNota) {
    fecharMenu();
    const it = itens[id];
    if (!it) return;
    menu = D.createElement("div");
    menu.className = "ej-menu ej-ui";
    const atual = deLinha(it) ? it.cor : infoMarca(it.cor).codigo;
    const gamas = deLinha(it) ? [{ nome: it.tipo === "tachado" ? "Cor do tachado" : "Cor do sublinhado", cores: Object.entries(CORES_CANETA).map(([n, h]) => ({ codigo: n, nome: n, hex: h })) }]
      : MT ? MT.gamas : [{ nome: "Neon", cores: [{ codigo: "70/24", nome: "Amarelo", hex: "#FAE905" }] }];
    menu.innerHTML = gamas.map(g => `<div class="ej-menu-gama">${g.nome}</div><div class="ej-menu-cores">${g.cores.map(c =>
        `<button type="button" data-cor="${c.codigo}" title="${g.nome} ${c.codigo} · ${c.nome}" aria-label="${g.nome} ${c.codigo} ${c.nome}" style="--c:${c.hex}" class="${atual === c.codigo ? "atual" : ""}"></button>`).join("")}</div>`).join("") + `
      ${it.tipo === "marca" ? `<label class="ej-menu-forca">Intensidade <input type="range" min="0" max="100" step="1" value="${forca(it)}" aria-label="Intensidade desta marca"><span class="ej-forca-num"><input type="number" min="0" max="100" step="1" value="${forca(it)}" aria-label="Intensidade desta marca, em porcentagem">%</span></label>` : ""}
      <div class="ej-menu-acoes">
        <button type="button" data-a="padrao" title="Volta esta marca e a ferramenta para a cor${it.tipo === "marca" ? " e a intensidade" : ""} automática">Restaurar padrão</button>
        <button type="button" data-a="del">Apagar</button>
      </div>
      <textarea placeholder="Nota sobre este trecho..." rows="3">${(it.nota || "").replace(/</g, "&lt;")}</textarea>`;
    { const h = cfgG.hospedeiro; menu.style.left = Math.max(0, Math.min(x, (h ? h.scrollLeft + h.clientWidth : scrollX + innerWidth) - 250)) + "px"; }
    menu.style.top = (y + 6) + "px";
    menu.addEventListener("pointerdown", e => e.stopPropagation());
    menu.querySelectorAll("[data-cor]").forEach(b => b.onclick = () => {
      const i = itens[id];
      mudar({ ...i, cor: b.dataset.cor });
      usar(null, { [i.tipo === "sublinhado" ? "corSub" : i.tipo === "tachado" ? "corTach" : "corMarca"]: b.dataset.cor });   // vira o padrão da ferramenta
      fecharMenu();
    });
    // Restaurar padrão: esta marca e a ferramenta dela voltam ao automático (marca-texto amarelo 100%, sublinhado preto, tachado vermelho)
    menu.querySelector('[data-a="padrao"]').onclick = () => {
      const i = itens[id];
      if (i.tipo === "marca") { mudar({ ...i, cor: PADRAO.corMarca, intensidade: PADRAO.intensidade }); usar(null, { corMarca: PADRAO.corMarca, intensidade: PADRAO.intensidade }); lembrarIntensidade(PADRAO.intensidade); }
      else { const k = i.tipo === "tachado" ? "corTach" : "corSub"; mudar({ ...i, cor: PADRAO[k] }); usar(null, { [k]: PADRAO[k] }); }
      fecharMenu();
    };
    menu.querySelector('[data-a="del"]').onclick = () => { apagar(id); fecharMenu(); };
    const faixa = menu.querySelector('.ej-menu-forca input[type="range"]');
    if (faixa) {
      const num = menu.querySelector('.ej-menu-forca input[type="number"]');
      const limpo = v => Math.min(100, Math.max(0, Math.round(Number(v) || 0)));
      const previa = v => D.querySelectorAll(`mark.ej-m[data-id="${id}"]`).forEach(m => {
        m.style.setProperty("--ej-forca", v + "%");
        m.classList.toggle("ej-escura", infoMarca(itens[id].cor).escura && v >= 60);
      });
      // a intensidade escolhida aqui também vira o padrão das próximas marcas (19/11/2026, pedido do usuário)
      const gravar = v => { const i = itens[id]; if (i && forca(i) !== v) mudar({ ...i, intensidade: v }); definirPadrao({ intensidade: v }); lembrarIntensidade(v); };
      faixa.addEventListener("input", () => { num.value = faixa.value; previa(+faixa.value); });
      faixa.addEventListener("change", () => gravar(+faixa.value));
      // digitar o número: prévia enquanto digita, grava com Enter ou ao sair do campo
      num.addEventListener("input", () => { if (num.value === "") return; const v = limpo(num.value); faixa.value = v; previa(v); });
      num.addEventListener("change", () => { const v = limpo(num.value); num.value = v; faixa.value = v; previa(v); gravar(v); });
      num.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); num.blur(); } });
      num.addEventListener("focus", () => num.select());
    }
    const ta = menu.querySelector("textarea");
    let mudou = false;
    ta.addEventListener("input", () => { mudou = true; const i = itens[id]; if (i) { i.nota = ta.value; mudar(i, false); } });
    ta.addEventListener("blur", () => { if (mudou) mudou = false; });
    camada.append(menu);
    if (focarNota) setTimeout(() => ta.focus(), 30);
  }

  // ------------------------------------------------------------ menu de um adesivo (duplo clique): inclinação, tamanho, apagar
  function abrirMenuAdesivo(id, x, y) {
    fecharMenu();
    const it = itens[id];
    if (!it) return;
    const LIM = { giro: [-180, 180], escala: [40, 300] };
    const campo = (k, rotulo, v, passo, un) => `<label class="ej-menu-forca">${rotulo} <input type="range" data-k="${k}" min="${LIM[k][0]}" max="${LIM[k][1]}" step="${passo}" value="${v}" aria-label="${rotulo}"><span class="ej-forca-num"><input type="number" data-n="${k}" min="${LIM[k][0]}" max="${LIM[k][1]}" step="1" value="${v}" aria-label="${rotulo}, em ${un === "°" ? "graus" : "porcentagem"}">${un}</span></label>`;
    menu = D.createElement("div");
    menu.className = "ej-menu ej-ui ej-menu-ades";
    menu.innerHTML = `<div class="ej-menu-gama">Adesivo</div>
      ${campo("giro", "Inclinação", giroDe(it), 1, "°")}
      <div class="ej-menu-acoes"><button type="button" data-g="-15" title="Girar 15° para a esquerda">↺ 15°</button><button type="button" data-g="0" title="Sem inclinação">Reto</button><button type="button" data-g="15" title="Girar 15° para a direita">↻ 15°</button></div>
      ${campo("escala", "Tamanho", escalaDe(it), 5, "%")}
      <div class="ej-menu-acoes"><button type="button" data-a="del">Apagar adesivo</button></div>`;
    { const h = cfgG.hospedeiro; menu.style.left = Math.max(0, Math.min(x, (h ? h.scrollLeft + h.clientWidth : scrollX + innerWidth) - 250)) + "px"; }
    menu.style.top = (y + 6) + "px";
    menu.addEventListener("pointerdown", e => e.stopPropagation());
    menu.addEventListener("dblclick", e => e.stopPropagation());
    const no = () => camada.querySelector(`.ej-adesivo[data-item="${id}"]`);
    const limpo = (k, v) => Math.min(LIM[k][1], Math.max(LIM[k][0], Math.round(Number(v) || 0)));
    const previa = (k, v) => { const n = no(); if (n) n.style.setProperty(k === "giro" ? "--ej-giro" : "--ej-escala", k === "giro" ? v + "deg" : v / 100); };
    const atual = k => k === "giro" ? giroDe(itens[id]) : escalaDe(itens[id]);
    const gravar = (k, v) => { const i = itens[id]; if (i && !i.apagado && atual(k) !== v) mudar({ ...i, [k]: v }); };
    const mostrar = (k, v) => { menu.querySelector(`[data-k="${k}"]`).value = v; menu.querySelector(`[data-n="${k}"]`).value = v; };
    for (const k of ["giro", "escala"]) {
      const faixa = menu.querySelector(`[data-k="${k}"]`), num = menu.querySelector(`[data-n="${k}"]`);
      faixa.addEventListener("input", () => { num.value = faixa.value; previa(k, +faixa.value); });
      faixa.addEventListener("change", () => gravar(k, +faixa.value));
      num.addEventListener("input", () => { if (num.value === "" || num.value === "-") return; const v = limpo(k, num.value); faixa.value = v; previa(k, v); });
      num.addEventListener("change", () => { const v = limpo(k, num.value); mostrar(k, v); previa(k, v); gravar(k, v); });
      num.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); num.blur(); } });
      num.addEventListener("focus", () => num.select());
    }
    menu.querySelectorAll("[data-g]").forEach(b => b.onclick = () => {
      const d = +b.dataset.g;
      let v = d === 0 ? 0 : atual("giro") + d;
      if (v > 180) v -= 360;
      if (v < -180) v += 360;
      mostrar("giro", v); previa("giro", v); gravar("giro", v);
    });
    menu.querySelector('[data-a="del"]').onclick = () => { apagar(id); fecharMenu(); };
    camada.append(menu);
  }

  // ------------------------------------------------------------ marcar o texto selecionado
  function marcarSelecao() {
    const sel = getSelection(), art = artigo();
    if (!sel || sel.isCollapsed || !sel.rangeCount || !art) return false;
    const r = sel.getRangeAt(0);
    if (!art.contains(r.commonAncestorContainer)) return false;
    const idx = nosDeTexto(art);
    const ini = posGlobal(idx, r.startContainer, r.startOffset, false), fim = posGlobal(idx, r.endContainer, r.endOffset, true);
    let exato = idx.texto.slice(ini, fim);
    if (!exato.trim() || fim <= ini) return false;
    // não guarda espaços nas pontas
    const a = exato.length - exato.trimStart().length, b = exato.length - exato.trimEnd().length;
    const i0 = ini + a, i1 = fim - b;
    exato = idx.texto.slice(i0, i1);
    sel.removeAllRanges();
    mudar({
      id: novoId(), pagina: pagina(), tipo: (ferramenta === "sublinhado" || ferramenta === "tachado") ? ferramenta : "marca",
      cor: ferramenta === "sublinhado" ? op.corSub : ferramenta === "tachado" ? op.corTach : op.corMarca,
      ...((ferramenta === "sublinhado" || ferramenta === "tachado") ? {} : { intensidade: forca(op) }),
      exato, antes: idx.texto.slice(Math.max(0, i0 - 32), i0), depois: idx.texto.slice(i1, i1 + 32), pos: i0
    });
    return true;
  }

  // ------------------------------------------------------------ caneta, marcador, borracha, nota, adesivo
  function dentroDoArtigo(xDoc, yDoc) {
    const art = artigo();
    if (!art) return false;
    const r = rectDoc(art);
    return xDoc >= r.left - 40 && xDoc <= r.right + 40 && yDoc >= r.top - 20 && yDoc <= r.bottom + 40;
  }
  function aoApertar(e) {
    if (e.button !== 0 || e.target.closest(".ej-nota, .ej-menu, .ej-adesivo, .ej-selo")) return;
    if (ehCaneta(e)) marcarCaneta(true);
    else if (palmaRecente(e)) return;
    // se uma palma/dedo tocou logo antes da caneta encostar, descarta o toque e assume a caneta
    if (tracoAtual) {
      if (ehCaneta(e) && tracoAtual.pointerType === "touch" && (agora() - tracoAtual.iniciadoEm < 180) && tracoAtual.pts.length < 6) {
        tracoAtual.el.remove();
        tracoAtual = null;
      } else {
        return;
      }
    }
    if (apagando && !ehCaneta(e)) return;
    const x = pX(e), y = pY(e);
    fecharMenu();
    if (ferramenta === "caneta" || ferramenta === "marcador") {
      if (!dentroDoArtigo(x, y)) return;
      e.preventDefault();
      try { camada.setPointerCapture(e.pointerId); } catch (err) {}
      const marcador = ferramenta === "marcador";
      tracoAtual = {
        pointerId: e.pointerId, pointerType: e.pointerType, iniciadoEm: agora(),
        pts: [[x, y]], cor: marcador ? op.corMarca : op.corCaneta,
        largura: marcador ? 16 : op.largura, opacidade: 1, marcador, ...(marcador ? { intensidade: forca(op) } : {})
      };
      tracoAtual.el = D.createElementNS("http://www.w3.org/2000/svg", "path");
      tracoAtual.el.setAttribute("stroke", marcador ? hexMarca(tracoAtual.cor) : corDe(CORES_CANETA, tracoAtual.cor, "#1D1D1F"));
      if (marcador) tracoAtual.el.setAttribute("stroke-opacity", forca(tracoAtual) / 100);     // prévia já na intensidade escolhida
      tracoAtual.el.setAttribute("stroke-width", tracoAtual.largura);
      if (marcador) tracoAtual.el.setAttribute("class", "ej-marcador");
      svg.append(tracoAtual.el);
      return;
    }
    if (ferramenta === "borracha") {
      e.preventDefault();
      try { camada.setPointerCapture(e.pointerId); } catch (err) {}
      apagando = true; apagandoId = e.pointerId; apagarEm(x, y); return;
    }
    if (ferramenta === "nota" || ferramenta === "adesivo") {
      if (!dentroDoArtigo(x, y)) return;
      e.preventDefault();
      const an = ancorar(x, y);
      if (!an) return;
      if (ferramenta === "nota") {
        const id = novoId();
        mudar({ id, pagina: pagina(), tipo: "nota", ancora: an.ancora, x: an.x, y: an.y, texto: "", aberta: true, cor: op.corNota });
        setTimeout(() => camada.querySelector(`[data-item="${id}"] textarea`)?.focus(), 60);
      } else {
        const rot = !!ROTULOS[op.adesivo];
        const larg = SETAS[op.adesivo] ? 24 : 14;    // o clique fica no meio do adesivo
        mudar({ id: novoId(), pagina: pagina(), tipo: "adesivo", ancora: an.ancora, x: an.x - (rot ? 0 : larg / an.r.width), y: an.y - 14, conteudo: op.adesivo });
      }
    }
  }
  function aoMover(e) {
    if (ehCaneta(e)) marcarCaneta(true);
    if (tracoAtual && e.pointerId === tracoAtual.pointerId) {
      const co = e.getCoalescedEvents && e.getCoalescedEvents();
      const evs = (co && co.length) ? co : [e];
      const o = org();
      for (const ev of evs) {
        const x = ev.clientX + o.x, y = ev.clientY + o.y;
        const u = tracoAtual.pts[tracoAtual.pts.length - 1];
        if (!u || Math.hypot(x - u[0], y - u[1]) >= 0.25) tracoAtual.pts.push([x, y]);
      }
      tracoAtual.el.setAttribute("d", caminhoSvg(tracoAtual.pts));
    } else if (apagando && e.pointerId === apagandoId) {
      apagarEm(pX(e), pY(e));
    }
  }
  function aoSoltar(e) {
    if (ehCaneta(e)) marcarCaneta(false);
    if (apagando && (!e || e.pointerId === apagandoId)) { apagando = false; apagandoId = null; }
    if (!tracoAtual) return;
    if (e && e.pointerId != null && e.pointerId !== tracoAtual.pointerId) return;
    const t = tracoAtual; tracoAtual = null;
    // simplifica comparando com o último ponto mantido (evita colapsar curvas em telas 120-240 Hz)
    const minDist = t.marcador ? 1.2 : 0.75;
    const pts = [];
    for (let i = 0; i < t.pts.length; i++) {
      const p = t.pts[i];
      if (i === 0 || i === t.pts.length - 1) { pts.push(p); continue; }
      const u = pts[pts.length - 1];
      if (Math.hypot(p[0] - u[0], p[1] - u[1]) >= minDist) pts.push(p);
    }
    if (pts.length === 2 && Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]) < 0.2) pts.pop();
    t.el.remove();
    if (!pts.length) return;
    const an = ancorar(pts[0][0], pts[0][1]);
    if (!an) return;
    const r = an.r;
    mudar({
      id: novoId(), pagina: pagina(), tipo: "traco", cor: t.cor, largura: t.largura, opacidade: t.opacidade, marcador: !!t.marcador,
      ...(t.marcador ? { intensidade: forca(t) } : {}), ancora: an.ancora,
      pts: pts.map(([x, y]) => [+((x - r.left) / (r.width || 1)).toFixed(4), +(y - r.top).toFixed(1)])
    });
  }
  function apagarEm(x, y) {
    // traços: distância do ponto ao segmento
    for (const p of svg.querySelectorAll("path[data-id]")) {
      const it = itens[p.dataset.id]; if (!it) continue;
      const el = resolver(it.ancora); if (!el) continue;
      const pts = it.pts.map(([fx, dy]) => pontoDoc(it, el, fx, dy)), lim = it.largura / 2 + 6;
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[i + 1] || a;
        if (distSeg(x, y, a, b) <= lim) { apagar(it.id); break; }
      }
    }
    // marcas e notas/adesivos debaixo do ponto
    camada.classList.add("ej-sem-alvo");
    const prev = camada.style.pointerEvents; camada.style.pointerEvents = "none";
    const el = D.elementFromPoint(x - org().x, y - org().y);
    camada.style.pointerEvents = prev; camada.classList.remove("ej-sem-alvo");
    const m = el && el.closest("mark.ej-m");
    if (m) apagar(m.dataset.id);
  }
  function distSeg(x, y, a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1], l = dx * dx + dy * dy;
    const t = l ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / l)) : 0;
    return Math.hypot(x - (a[0] + t * dx), y - (a[1] + t * dy));
  }

  // ------------------------------------------------------------ tablet / celular (toque e caneta)
  // 1) Arrastar o dedo ou a caneta sobre o texto marca na hora (como um marca-texto de verdade).
  //    Arrasto vertical continua rolando a página (touch-action: pan-y); o arrasto lateral marca.
  // 2) Seleção pelo toque longo do sistema (alças azuis): quando o aluno solta e a seleção fica parada, marca sozinho.
  const ferramentaDeTexto = () => ferramenta === "marca" || ferramenta === "sublinhado" || ferramenta === "tachado";
  function caretEm(x, y) {
    if (D.caretRangeFromPoint) return D.caretRangeFromPoint(x, y);
    if (D.caretPositionFromPoint) {
      const p = D.caretPositionFromPoint(x, y);
      if (!p) return null;
      const r = D.createRange(); r.setStart(p.offsetNode, p.offset); r.collapse(true); return r;
    }
    return null;
  }
  function ligarToqueMarcaTexto() {
    let toque = null, timerSel = 0, dedosNaTela = 0;
    D.addEventListener("pointermove", e => {
      if (ehCaneta(e)) marcarCaneta(true);
    }, { capture: true, passive: true });
    D.addEventListener("pointerdown", e => {
      if (e.pointerType === "mouse") return;
      if (ehCaneta(e)) marcarCaneta(true);
      else {
        if (palmaRecente(e) || (toque && toque.tipo === "pen")) return;
        D.documentElement.classList.remove("ej-pen-ativa");
      }
      dedosNaTela++;
      if (!ativo() || !ferramentaDeTexto()) return;
      const art = artigo();
      if (!art || !art.contains(e.target) || e.target.closest(".ej-ui, mark.ej-m, a, button, input, textarea, select")) return;
      if (toque && (!ehCaneta(e) || toque.marcando)) return;
      const c = caretEm(e.clientX, e.clientY);
      if (!c && !ehCaneta(e)) return;
      if (ehCaneta(e)) e.preventDefault();
      toque = { id: e.pointerId, tipo: e.pointerType, x0: e.clientX, y0: e.clientY, ini: c, marcando: false };
    }, true);
    D.addEventListener("pointermove", e => {
      if (!toque || e.pointerId !== toque.id) return;
      const dx = Math.abs(e.clientX - toque.x0), dy = Math.abs(e.clientY - toque.y0);
      const lim = toque.tipo === "pen" ? 4 : 8;
      if (!toque.marcando) {
        if (dx < lim && dy < lim) return;
        if (e.pointerType === "touch" && dy > dx) { toque = null; return; }   // dedo na vertical = rolar
        toque.marcando = true;
      }
      e.preventDefault();
      const fim = caretEm(e.clientX, e.clientY);
      if (!fim) return;
      if (!toque.ini) { toque.ini = fim; return; }
      const r = D.createRange();
      const antes = toque.ini.compareBoundaryPoints(Range.START_TO_START, fim) <= 0;
      if (antes) { r.setStart(toque.ini.startContainer, toque.ini.startOffset); r.setEnd(fim.startContainer, fim.startOffset); }
      else { r.setStart(fim.startContainer, fim.startOffset); r.setEnd(toque.ini.startContainer, toque.ini.startOffset); }
      const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
    }, { capture: true, passive: false });
    const soltar = e => {
      if (e.pointerType !== "mouse") dedosNaTela = Math.max(0, dedosNaTela - 1);
      if (ehCaneta(e)) marcarCaneta(false);
      if (toque && e.pointerId === toque.id) {
        const marcou = toque.marcando; toque = null;
        if (marcou) { setTimeout(marcarSelecao, 0); return; }
      }
      agendarMarcarSelecaoToque();
    };
    D.addEventListener("pointerup", soltar, true);
    D.addEventListener("pointercancel", e => {
      if (ehCaneta(e)) marcarCaneta(false);
      if (toque && e.pointerId === toque.id) toque = null;
      if (e.pointerType !== "mouse") dedosNaTela = Math.max(0, dedosNaTela - 1);
    }, true);
    D.addEventListener("touchend", () => agendarMarcarSelecaoToque(), true);
    // seleção do sistema (toque longo + alças): espera ficar parada e sem dedo na tela
    function agendarMarcarSelecaoToque() {
      if (!ativo() || !ferramentaDeTexto()) return;
      clearTimeout(timerSel);
      timerSel = setTimeout(() => {
        if (dedosNaTela > 0 || toque) return;
        const s = getSelection();
        if (s && !s.isCollapsed) marcarSelecao();
      }, 650);
    }
    D.addEventListener("selectionchange", () => {
      if (!("ontouchstart" in W) && !navigator.maxTouchPoints) return;
      if (toque && toque.marcando) return;
      agendarMarcarSelecaoToque();
    });
    // impede o menu "Copiar / Pesquisar" do sistema de atrapalhar enquanto o marca-texto está ativo
    D.addEventListener("contextmenu", e => { if (ativo() && ferramentaDeTexto() && e.pointerType !== "mouse" && artigo()?.contains(e.target)) e.preventDefault(); }, true);
  }

  // ------------------------------------------------------------ API para a barra do app
  function usar(f, opcoes) {
    if (opcoes) { op = { ...op, ...opcoes }; salvarOpcoes(); }
    if (f) ferramenta = f;
    fecharMenu();
    camada.classList.toggle("ej-captura", ["caneta", "marcador", "borracha", "nota", "adesivo"].includes(ferramenta));
    D.documentElement.dataset.ejFerramenta = ferramenta;
    avisar();
  }
  function desfazer() {
    const o = pilhaDesfazer.pop(); if (!o) return;
    pilhaRefazer.push(o);
    if (o.antes) mudar(JSON.parse(JSON.stringify(o.antes)), false); else apagar(o.depois.id, false);
  }
  function refazer() {
    const o = pilhaRefazer.pop(); if (!o) return;
    pilhaDesfazer.push(o);
    if (o.depois) mudar(JSON.parse(JSON.stringify(o.depois)), false); else apagar(o.antes.id, false);
  }
  function limparPagina() {
    const lista = daPagina();
    lista.forEach(i => apagar(i.id, false));
    if (lista.length) { pilhaDesfazer.push(...lista.map(i => ({ antes: i, depois: null }))); pilhaRefazer = []; }
  }
  function visivel(v) { mostrar = !!v; fecharMenu(); agendarDesenho(); avisar(); }

  const ATALHOS = { v: "mao", m: "marca", u: "sublinhado", t: "tachado", p: "caneta", h: "marcador", e: "borracha", n: "nota", s: "adesivo" };

  // ------------------------------------------------------------ início
  async function iniciar(cfg) {
    cfgG = cfg || {};
    pasta = cfg.pasta || "";
    aoMudar = cfg.aoMudar || (() => {});
    MT = cfg.marcaTexto || null;
    lerOpcoesSalvas();
    const st = D.createElement("style");
    st.textContent = CSS;
    D.head.append(st);
    camada = D.createElement("div");
    camada.id = "ejCamada";
    camada.className = "ej-camada ej-ui";
    svg = D.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "ej-tracos");
    camada.append(svg);
    (cfgG.hospedeiro || D.body).append(camada);
    camada.addEventListener("pointerdown", aoApertar);
    camada.addEventListener("pointermove", aoMover);
    camada.addEventListener("pointerup", aoSoltar);
    camada.addEventListener("pointercancel", aoSoltar);
    const bloquearToqueCaptura = e => {
      if (!camada.classList.contains("ej-captura")) return;
      if (e.target.closest(".ej-nota, .ej-menu, .ej-adesivo, .ej-selo")) return;
      e.preventDefault();
    };
    camada.addEventListener("touchstart", bloquearToqueCaptura, { passive: false });
    camada.addEventListener("touchmove", bloquearToqueCaptura, { passive: false });
    // marca-texto: ao soltar o mouse com texto selecionado
    D.addEventListener("pointerup", e => { if (e.pointerType === "mouse" && ativo() && ferramentaDeTexto()) setTimeout(marcarSelecao, 0); });
    ligarToqueMarcaTexto();
    // clicar numa marca abre o menu (seta, marca-texto ou sublinhado sem seleção)
    D.addEventListener("click", e => {
      if (!ativo()) return;
      const m = e.target.closest && e.target.closest("mark.ej-m");
      if (m && ["mao", "marca", "sublinhado", "tachado"].includes(ferramenta) && getSelection().isCollapsed) {
        e.preventDefault(); e.stopPropagation();
        abrirMenuMarca(m.dataset.id, pX(e), pY(e), false);
      } else if (menu && !e.target.closest(".ej-menu")) fecharMenu();
    }, true);
    D.addEventListener("keydown", e => {
      if (!ativo()) return;
      const t = e.target;
      if (t && (t.closest("input, textarea, select, [contenteditable]"))) { if (e.key === "Escape") t.blur(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); e.shiftKey ? refazer() : desfazer(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") { e.preventDefault(); refazer(); return; }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "Escape") { fecharMenu(); if (ferramenta !== "mao") usar("mao"); return; }
      if (cfgG.atalhos === false) return;
      const f = ATALHOS[e.key.toLowerCase()];
      if (f) usar(f);
    });
    observador = new MutationObserver(() => { if (!aplicando) agendarDesenho(); });
    new ResizeObserver(agendarDesenho).observe(cfgG.hospedeiro || D.body);
    addEventListener("hashchange", () => { fecharMenu(); agendarDesenho(); avisar(); });
    D.addEventListener("load", e => { if (e.target && e.target.tagName === "IMG") agendarDesenho(); }, true);
    D.fonts && D.fonts.ready.then(agendarDesenho);
    addEventListener("pagehide", salvarAgora);
    try {
      const r = await fetch(urlAnot(), { cache: "no-store" });
      if (r.ok) itens = (await r.json()).itens || {};
    } catch (e) { estadoSalvo = "erro"; }
    usar("mao");
    desenharTudo();
    avisar();
  }

  const CSS = `
  .ej-camada { position: absolute; left: 0; top: 0; z-index: 4; pointer-events: none; }   /* abaixo do cabeçalho do site (z 5, sticky): ao rolar, marcas e adesivos passam por baixo dele */
  .ej-camada.ej-captura { pointer-events: auto; touch-action: none; -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
  html[data-ej-ferramenta="marca"] :is(article.conteudo, .ej-raiz), html[data-ej-ferramenta="sublinhado"] :is(article.conteudo, .ej-raiz), html[data-ej-ferramenta="tachado"] :is(article.conteudo, .ej-raiz) {
    touch-action: pan-y pinch-zoom; -webkit-touch-callout: none; -webkit-user-select: text; user-select: text; }
  html.ej-pen-ativa[data-ej-ferramenta="marca"] :is(article.conteudo, .ej-raiz), html.ej-pen-ativa[data-ej-ferramenta="sublinhado"] :is(article.conteudo, .ej-raiz), html.ej-pen-ativa[data-ej-ferramenta="tachado"] :is(article.conteudo, .ej-raiz) {
    touch-action: none; }
  .ej-camada.ej-oculta > :not(.ej-menu) { display: none; }
  .ej-camada.ej-sem-alvo, .ej-camada.ej-sem-alvo * { pointer-events: none !important; }
  .ej-tracos { position: absolute; left: 0; top: 0; width: 100%; height: 100%; overflow: visible; pointer-events: none; }
  .ej-tracos path { fill: none; stroke-linecap: round; stroke-linejoin: round; }
  html[data-ej-ferramenta="caneta"] .ej-camada, html[data-ej-ferramenta="marcador"] .ej-camada { cursor: crosshair; }
  html[data-ej-ferramenta="borracha"] .ej-camada { cursor: cell; }
  html[data-ej-ferramenta="nota"] .ej-camada, html[data-ej-ferramenta="adesivo"] .ej-camada { cursor: copy; }
  html[data-ej-ferramenta="marca"] :is(article.conteudo, .ej-raiz), html[data-ej-ferramenta="sublinhado"] :is(article.conteudo, .ej-raiz), html[data-ej-ferramenta="tachado"] :is(article.conteudo, .ej-raiz) { cursor: text; }
  mark.ej-m { color: inherit; padding: 0; border-radius: 2px; cursor: pointer; }
  .ej-piscar { animation: ej-piscar .45s ease-in-out 3; }
  @keyframes ej-piscar { 50% { outline: 3px solid #2C4A7A; outline-offset: 3px; } }
  @media (prefers-reduced-motion: reduce) { .ej-piscar { animation: none; outline: 3px solid #2C4A7A; outline-offset: 3px; } }
  /* cor exata da paleta Stabilo: tinta cheia que multiplica com o papel (o texto preto continua preto) */
  mark.ej-marca { background: color-mix(in srgb, var(--ej-cor) var(--ej-forca, 100%), transparent); mix-blend-mode: multiply; box-decoration-break: clone; -webkit-box-decoration-break: clone; }
  mark.ej-marca.ej-escura { mix-blend-mode: normal; color: #fff; }
  .ej-tracos path.ej-marcador { mix-blend-mode: multiply; }
  mark.ej-tach { background: transparent; text-decoration: line-through; text-decoration-color: var(--ej-cor); text-decoration-thickness: 2px; }
  mark.ej-sub { background: transparent; text-decoration: underline; text-decoration-color: var(--ej-cor); text-decoration-thickness: 2px; text-underline-offset: 3px; }
  html[data-ej-ferramenta="borracha"] mark.ej-m:hover { outline: 2px dashed #E5342D; }
  .ej-nota, .ej-adesivo, .ej-selo, .ej-menu { pointer-events: auto; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; }
  .ej-nota { position: absolute; }
  .ej-nota-icone { width: 26px; height: 26px; padding: 4px; border: 0; border-radius: 6px; cursor: grab; touch-action: none; color: #5b4a00;
    background: var(--ej-nota); box-shadow: 0 0 0 .5px rgba(0,0,0,.2), 0 2px 6px rgba(0,0,0,.18); }
  .ej-nota-icone svg { width: 100%; height: 100%; display: block; }
  .ej-nota-cartao { display: none; width: 230px; background: var(--ej-nota); border-radius: 8px; box-shadow: 0 0 0 .5px rgba(0,0,0,.18), 0 8px 24px rgba(0,0,0,.18); overflow: hidden; }
  .ej-nota.aberta .ej-nota-icone { display: none; }
  .ej-nota.aberta .ej-nota-cartao { display: block; }
  .ej-nota-topo { display: flex; align-items: center; gap: 2px; padding: 4px 4px 0 10px; cursor: grab; touch-action: none; user-select: none; -webkit-user-select: none; font-size: 11px; font-weight: 600; color: rgba(0,0,0,.55); letter-spacing: .04em; text-transform: uppercase; }
  .ej-nota-topo span { flex: 1; }
  .ej-nota-topo button { width: 24px; height: 22px; border: 0; background: transparent; border-radius: 5px; cursor: pointer; color: rgba(0,0,0,.6); font-size: 16px; line-height: 1; }
  .ej-nota-topo button:hover { background: rgba(0,0,0,.08); }
  .ej-nota textarea { display: block; width: 100%; box-sizing: border-box; min-height: 90px; resize: vertical; border: 0; outline: 0; background: transparent;
    padding: 6px 10px 10px; font: 14px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif; color: #1d1d1f; }
  .ej-adesivo { position: absolute; font-size: 26px; line-height: 1; cursor: grab; touch-action: none; user-select: none; filter: drop-shadow(0 1px 1.5px rgba(0,0,0,.25));
    transform: rotate(var(--ej-giro, 0deg)) scale(var(--ej-escala, 1)); transform-origin: center; }
  .ej-adesivo.ej-seta svg { display: block; width: 48px; height: auto; }
  .ej-adesivo.ej-rotulo { font: 700 11px/1 system-ui, -apple-system, "Segoe UI", sans-serif; letter-spacing: .06em; color: #fff; background: var(--ej-rot);
    padding: 6px 9px; border-radius: 6px; filter: none; box-shadow: 0 1px 3px rgba(0,0,0,.25); }
  html[data-ej-ferramenta="borracha"] :is(.ej-adesivo, .ej-nota-icone, .ej-nota-cartao):hover { outline: 2px dashed #E5342D; cursor: cell; }
  .ej-selo { position: absolute; width: 18px; height: 18px; padding: 2px; border: 0; border-radius: 4px; background: #FFF3A8; color: #5b4a00; cursor: pointer;
    box-shadow: 0 0 0 .5px rgba(0,0,0,.25), 0 1px 3px rgba(0,0,0,.2); }
  .ej-selo svg { width: 100%; height: 100%; display: block; }
  .ej-menu-gama { font: 600 10px/1 system-ui, -apple-system, "Segoe UI", sans-serif; letter-spacing: .06em; text-transform: uppercase; color: #6b6b73; margin: 2px 0 -2px; }
  .ej-menu-cores { flex-wrap: wrap; }
  .ej-menu { position: absolute; z-index: 10; width: 236px; padding: 8px; background: #fff; color: #1d1d1f; border-radius: 10px;
    box-shadow: 0 0 0 .5px rgba(0,0,0,.18), 0 10px 30px rgba(0,0,0,.2); display: grid; gap: 8px; }
  .ej-menu-cores { display: flex; gap: 6px; }
  .ej-menu-forca { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 8px; font-size: 12px; color: #4a4a4f; }
  .ej-menu-forca input[type="range"] { width: 100%; accent-color: #1d1d1f; }
  .ej-forca-num { display: inline-flex; align-items: center; gap: 2px; color: #4a4a4f; }
  .ej-forca-num input { width: 44px; height: 26px; padding: 0 4px; border: 1px solid rgba(0,0,0,.18); border-radius: 6px; font: 12px system-ui, sans-serif;
    text-align: right; font-variant-numeric: tabular-nums; color: #1d1d1f; background: #fff; -moz-appearance: textfield; }
  .ej-forca-num input::-webkit-outer-spin-button, .ej-forca-num input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
  .ej-forca-num input:focus { outline: 2px solid #1d1d1f; outline-offset: 1px; }
  .ej-menu-cores button { width: 22px; height: 22px; border-radius: 50%; border: 0; background: var(--c); cursor: pointer; box-shadow: inset 0 0 0 1px rgba(0,0,0,.15); }
  .ej-menu-cores button.atual { box-shadow: inset 0 0 0 1px rgba(0,0,0,.15), 0 0 0 2px #fff, 0 0 0 4px #1d1d1f; }
  .ej-menu-acoes { display: flex; flex-wrap: wrap; gap: 6px; }
  .ej-menu-acoes button { flex: 1 0 auto; min-height: 28px; padding: 5px 10px; border: 0; border-radius: 6px; background: #f2f2f4; font: 13px/1.2 system-ui, -apple-system, "Segoe UI", sans-serif; cursor: pointer; color: #1d1d1f; white-space: nowrap; }
  .ej-menu-acoes button:hover { background: #e6e6e9; }
  .ej-menu-acoes [data-a="del"] { color: #c4271f; }
  .ej-menu textarea { width: 100%; box-sizing: border-box; border: 0; border-radius: 6px; background: #fff8cc; padding: 6px 8px; resize: vertical;
    font: 13px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif; color: #1d1d1f; outline: 0; }
  @media print { .ej-nota, .ej-menu, .ej-selo { display: none !important; } }
  `;

  // Para o painel "Minhas marcas" (web/nav_apostila.js): a lista dos itens vivos e pular até um deles
  function listaItens() { return Object.values(itens).filter(i => !i.apagado).map(i => ({ ...i })); }
  function focar(id, tentativas = 12) {
    const el = D.querySelector(`mark.ej-m[data-id="${id}"], #ejCamada [data-item="${id}"], #ejCamada path[data-id="${id}"]`);
    if (!el) { if (tentativas > 0) setTimeout(() => focar(id, tentativas - 1), 150); return; }
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    el.classList.add("ej-piscar");
    setTimeout(() => el.classList.remove("ej-piscar"), 1800);
  }
  window.ejEstojo = { adesivoHtml, SETAS: Object.keys(SETAS), iniciar, usar, desfazer, refazer, visivel, limparPagina, salvarAgora, itens: listaItens, focar, CORES_CANETA, CORES_NOTA, ROTULOS, hexMarca };
})();
