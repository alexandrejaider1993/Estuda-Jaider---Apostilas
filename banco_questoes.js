/* ==========================================================================
   Banco de Questões — Estuda Jaider
   Puxa automaticamente todas as questões e testes das apostilas (banco_questoes.json),
   com filtros completos, modo Foco/Lista, riscar alternativas, favoritas, caderno de erros
   e sincronização automática no Google Drive integrada ao progresso das apostilas.
   ========================================================================== */
(function () {
  "use strict";

  const SEC_ID = "bancoQuestoes";
  const POR_PAGINA = 15;
  const LETRAS = ["A", "B", "C", "D", "E", "F"];

  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));

  const norm = s => String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  const fmtTexto = s => esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

  const toast = (msg, tipo = "sucesso", duracao = 2800) => {
    if (window.mostrarToast) window.mostrarToast(msg, tipo, duracao);
  };

  // Ícones SVG
  const IC_FOCO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9h10"/><path d="M7 13h6"/></svg>';
  const IC_LISTA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>';
  const IC_SHUFFLE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg>';
  const IC_LIMPAR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/></svg>';
  const IC_ESTRELA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';
  const IC_ESTRELA_CHEIA = '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';
  const IC_LIVRO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20"/></svg>';
  const IC_TESOURA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg>';
  const IC_ESQ = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>';
  const IC_DIR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>';
  const IC_SETA_DIR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>';
  const IC_VOLTAR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>';
  const IC_FASM = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>';
  const IC_RESIDENCIA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3"/><path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4"/><circle cx="20" cy="10" r="2"/></svg>';

  const BANCOS_INFO = {
    fasm: {
      id: "fasm",
      titulo: "FASM",
      tituloPagina: "Banco de Questões · FASM",
      desc: "Questões de provas antigas, simulados e testes de fixação das apostilas da graduação.",
      cta: "Acessar FASM",
      icone: IC_FASM,
    },
    residencia: {
      id: "residencia",
      titulo: "Residência Médica",
      tituloPagina: "Banco de Questões · Residência Médica",
      desc: "Questões comentadas de provas de Residência Médica organizadas por grande área e banca.",
      cta: "Acessar Residência Médica",
      icone: IC_RESIDENCIA,
    },
  };

  // Estado em memória do módulo
  let montado = false;
  let carregando = false;
  let bancoAtual = null;         // null (tela dos 2 cards) | "fasm" | "residencia"
  let questoesCarregadas = [];   // todas as questões do JSON
  let todasQuestoes = [];        // questões filtradas pelo bancoAtual
  let filtradas = [];
  let historico = {};            // { uid: { status, escolha, tentativas, acertos, erros, favorita, riscadas } }
  let selecaoTemp = {};          // { uid: indiceAlternativa } (antes de clicar Responder)
  let rascunhoDisc = {};         // { uid: texto }
  let gabaritoDiscAberto = {};   // { uid: true }
  let modoRefazer = {};          // { uid: true }

  const filtros = {
    busca: "",
    disciplina: "",
    apostila: "",
    tipo: "todas",       // todas | prova | teste | discursiva
    status: "todas",     // todas | nao_resolvidas | erradas | acertadas | favoritas
    modo: "foco",        // foco | lista
    indiceFoco: 0,
    paginaLista: 1,
  };

  function resolverDisciplinaLive(q) {
    try {
      if (window.EJStorageDrive && window.EJStorageDrive.obterOrganizacaoAtual) {
        const org = window.EJStorageDrive.obterOrganizacaoAtual();
        const pastas = (org && org.pastas) || {};
        const mapaAp = (org && org.apostilas) || {};
        let pid = mapaAp[q.pasta];
        const cadeia = [];
        const vistos = new Set();
        while (pid && pastas[pid] && !vistos.has(pid)) {
          vistos.add(pid);
          const nome = String(pastas[pid].nome || "").trim();
          if (nome) cadeia.push(nome);
          pid = pastas[pid].pai;
        }
        if (cadeia.length) return cadeia[cadeia.length - 1];
      }
    } catch (e) {}
    return q.disciplina || "Geral";
  }

  function atualizarHistorico() {
    if (window.EJStorageDrive && window.EJStorageDrive.obterEstadoBancoQuestoes) {
      historico = window.EJStorageDrive.obterEstadoBancoQuestoes() || {};
    } else {
      historico = {};
    }
  }

  function normalizarBanco(q) {
    const raw = norm(q && (q.banco || q.categoria || q.origem || ""));
    if (raw.includes("residencia")) return "residencia";
    return "fasm";
  }

  async function carregarBanco() {
    if (questoesCarregadas.length || carregando) return;
    carregando = true;
    try {
      if (window.EJStorageDrive && window.EJStorageDrive.inicializar) {
        await window.EJStorageDrive.inicializar();
      }
      const r = await fetch("/banco_questoes.json", { cache: "no-store" });
      if (!r.ok) throw new Error("Não foi possível carregar banco_questoes.json");
      const d = await r.json();
      const lista = Array.isArray(d.questoes) ? d.questoes : [];
      questoesCarregadas = lista.map(q => {
        const disc = resolverDisciplinaLive(q);
        const banco = normalizarBanco(q);
        const textoBusca = norm([
          q.enunciado,
          (q.itens || []).join(" "),
          (q.alternativas || []).join(" "),
          q.ref,
          q.conceito_nome,
          q.apostila,
          disc,
        ].join(" "));
        return Object.assign({}, q, { disciplina: disc, _banco: banco, _busca: textoBusca });
      });
    } catch (e) {
      console.error("[Banco de Questões]", e);
      toast("Erro ao carregar o Banco de Questões.", "erro", 4000);
    } finally {
      carregando = false;
    }
  }

  function aplicarFiltros(manterIndice = false) {
    const qBusca = norm(filtros.busca.trim());
    const termos = qBusca ? qBusca.split(/\s+/).filter(Boolean) : [];

    filtradas = todasQuestoes.filter(q => {
      if (filtros.disciplina && q.disciplina !== filtros.disciplina) return false;
      if (filtros.apostila && q.pasta !== filtros.apostila) return false;

      if (filtros.tipo === "prova" && q.tipo !== "prova") return false;
      if (filtros.tipo === "teste" && q.tipo !== "teste") return false;
      if (filtros.tipo === "discursiva" && q.formato !== "discursiva") return false;

      const h = historico[q.uid];
      const st = h ? h.status : "";
      if (filtros.status === "nao_resolvidas" && (st === "acertou" || st === "errou")) return false;
      if (filtros.status === "erradas" && st !== "errou") return false;
      if (filtros.status === "acertadas" && st !== "acertou") return false;
      if (filtros.status === "favoritas" && !(h && h.favorita)) return false;

      if (termos.length) {
        for (const t of termos) {
          if (!q._busca.includes(t)) return false;
        }
      }
      return true;
    });

    if (!manterIndice) {
      filtros.indiceFoco = 0;
      filtros.paginaLista = 1;
    } else {
      if (filtros.indiceFoco >= filtradas.length) {
        filtros.indiceFoco = Math.max(0, filtradas.length - 1);
      }
      const maxPag = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA));
      if (filtros.paginaLista > maxPag) filtros.paginaLista = maxPag;
    }
  }

  function calcularEstatisticas() {
    let resolvidas = 0, acertos = 0, erros = 0, favoritas = 0;
    for (const q of todasQuestoes) {
      const h = historico[q.uid];
      if (!h) continue;
      if (h.favorita) favoritas++;
      if (h.status === "acertou") { resolvidas++; acertos++; }
      else if (h.status === "errou") { resolvidas++; erros++; }
    }
    const taxa = resolvidas ? Math.round((acertos / resolvidas) * 100) : 0;
    return { total: todasQuestoes.length, resolvidas, acertos, erros, favoritas, taxa };
  }

  function embaralharFiltradas() {
    for (let i = filtradas.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = filtradas[i];
      filtradas[i] = filtradas[j];
      filtradas[j] = tmp;
    }
    filtros.indiceFoco = 0;
    filtros.paginaLista = 1;
    renderConteudo();
    toast("Ordem das questões embaralhada!");
  }

  function montarEstruturaBase() {
    const sec = document.getElementById(SEC_ID);
    if (!sec || montado) return;
    montado = true;

    const cardsHtml = ["fasm", "residencia"].map(id => {
      const info = BANCOS_INFO[id];
      return `
        <button type="button" class="bq-hub-card bq-hub-card--${id}" data-selecionar-banco="${id}">
          <div class="bq-hub-card__topo">
            <span class="bq-hub-card__icon" aria-hidden="true">${info.icone}</span>
            <span class="bq-hub-card__pill" id="bqHubPill-${id}">Carregando...</span>
          </div>
          <h2 class="bq-hub-card__tit">${esc(info.titulo)}</h2>
          <p class="bq-hub-card__desc">${esc(info.desc)}</p>
          <span class="bq-hub-card__cta">
            <span>${esc(info.cta)}</span>
            ${IC_SETA_DIR}
          </span>
        </button>
      `;
    }).join("");

    sec.innerHTML = `
      <div id="bqSelecao" class="bq-hub">
        <div class="bq-hub__head">
          <span class="bq-hub__eyebrow">Banco de Questões</span>
          <h1 class="bq-hub__tit">Escolha o Banco de Questões</h1>
          <p class="bq-hub__sub">Selecione uma das opções abaixo para começar a resolver questões.</p>
        </div>
        <div class="bq-hub__grid">
          ${cardsHtml}
        </div>
      </div>

      <div id="bqBancoView" hidden>
        <div class="bq-voltar-row">
          <button type="button" class="bq-btn-voltar" id="bqBtnVoltarSelecao">
            ${IC_VOLTAR}
            <span>Trocar banco</span>
          </button>
        </div>

        <div class="bq-head">
          <div>
            <h1 class="bq-head__tit" id="bqTituloPagina">Banco de Questões</h1>
            <p class="bq-head__sub" id="bqSubtitulo">Carregando questões...</p>
          </div>
          <div class="bq-modos" id="bqModos" role="group" aria-label="Modo de visualização">
            <button type="button" class="bq-modo-btn" data-modo="foco" aria-pressed="true">${IC_FOCO}<span>Uma por vez</span></button>
            <button type="button" class="bq-modo-btn" data-modo="lista" aria-pressed="false">${IC_LISTA}<span>Lista</span></button>
          </div>
        </div>

        <div class="bq-stats" id="bqStats"></div>

        <div class="bq-filtros" id="bqFiltros">
          <div class="bq-filtros-linha">
            <div class="bq-campo">
              <label for="bqBusca">Buscar por palavra-chave</label>
              <input type="search" id="bqBusca" class="bq-input" placeholder="Enunciado, tema, fármaco, conceito..." autocomplete="off">
            </div>
            <div class="bq-campo">
              <label for="bqDisc">Matéria / Pasta</label>
              <select id="bqDisc" class="bq-select"><option value="">Todas as matérias</option></select>
            </div>
            <div class="bq-campo">
              <label for="bqApostila">Apostila</label>
              <select id="bqApostila" class="bq-select"><option value="">Todas as apostilas</option></select>
            </div>
            <div class="bq-campo">
              <label for="bqTipo">Tipo</label>
              <select id="bqTipo" class="bq-select">
                <option value="todas">Todos os tipos</option>
                <option value="prova">Provas &amp; Simulados</option>
                <option value="teste">Testes de Fixação</option>
                <option value="discursiva">Discursivas</option>
              </select>
            </div>
          </div>
          <div class="bq-filtros-chips-row">
            <div class="bq-chips" id="bqStatusChips" role="group" aria-label="Filtrar por status">
              <button type="button" class="bq-chip" data-status="todas" aria-pressed="true">Todas</button>
              <button type="button" class="bq-chip" data-status="nao_resolvidas" aria-pressed="false">Não resolvidas</button>
              <button type="button" class="bq-chip bq-chip--erro" data-status="erradas" aria-pressed="false">Caderno de Erros</button>
              <button type="button" class="bq-chip" data-status="acertadas" aria-pressed="false">Acertadas</button>
              <button type="button" class="bq-chip bq-chip--fav" data-status="favoritas" aria-pressed="false">Favoritas</button>
            </div>
            <div class="bq-filtros-acoes">
              <button type="button" class="bq-btn-sec" id="bqBtnEmbaralhar" title="Embaralhar ordem das questões filtradas">${IC_SHUFFLE}<span>Embaralhar</span></button>
              <button type="button" class="bq-btn-sec" id="bqBtnLimpar" title="Limpar todos os filtros">${IC_LIMPAR}<span>Limpar</span></button>
            </div>
          </div>
        </div>

        <div id="bqConteudo"></div>
      </div>
    `;

    // Eventos dos Cards de Seleção (FASM / Residência Médica)
    sec.querySelectorAll("[data-selecionar-banco]").forEach(card => {
      card.addEventListener("click", () => {
        selecionarBanco(card.dataset.selecionarBanco);
      });
    });

    const btnVoltar = document.getElementById("bqBtnVoltarSelecao");
    if (btnVoltar) {
      btnVoltar.addEventListener("click", () => {
        mostrarSelecao();
        rolarTopo();
      });
    }

    // Eventos dos controles de modo
    sec.querySelectorAll(".bq-modo-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        filtros.modo = btn.dataset.modo === "lista" ? "lista" : "foco";
        sec.querySelectorAll(".bq-modo-btn").forEach(b => b.setAttribute("aria-pressed", b.dataset.modo === filtros.modo ? "true" : "false"));
        renderConteudo();
      });
    });

    // Busca com debounce suave
    let tBusca = 0;
    const inpBusca = document.getElementById("bqBusca");
    inpBusca.addEventListener("input", () => {
      clearTimeout(tBusca);
      tBusca = setTimeout(() => {
        filtros.busca = inpBusca.value;
        aplicarFiltros(false);
        renderConteudo();
      }, 150);
    });

    document.getElementById("bqDisc").addEventListener("change", e => {
      filtros.disciplina = e.target.value;
      filtros.apostila = "";
      popularSelects();
      aplicarFiltros(false);
      renderConteudo();
    });

    document.getElementById("bqApostila").addEventListener("change", e => {
      filtros.apostila = e.target.value;
      aplicarFiltros(false);
      renderConteudo();
    });

    document.getElementById("bqTipo").addEventListener("change", e => {
      filtros.tipo = e.target.value;
      aplicarFiltros(false);
      renderConteudo();
    });

    document.getElementById("bqStatusChips").addEventListener("click", e => {
      const btn = e.target.closest(".bq-chip");
      if (!btn) return;
      definirFiltroStatus(btn.dataset.status);
    });

    document.getElementById("bqBtnEmbaralhar").addEventListener("click", embaralharFiltradas);
    document.getElementById("bqBtnLimpar").addEventListener("click", limparFiltros);

    // Atalhos de teclado no modo Foco
    document.addEventListener("keydown", aoTeclar);
  }

  function renderHubContadores() {
    const qtdFasm = questoesCarregadas.filter(q => q._banco === "fasm").length;
    const qtdRes = questoesCarregadas.filter(q => q._banco === "residencia").length;
    const pillFasm = document.getElementById("bqHubPill-fasm");
    const pillRes = document.getElementById("bqHubPill-residencia");
    if (pillFasm) {
      pillFasm.textContent = qtdFasm === 1 ? "1 questão" : `${qtdFasm} questões`;
    }
    if (pillRes) {
      pillRes.textContent = qtdRes > 0
        ? (qtdRes === 1 ? "1 questão" : `${qtdRes} questões`)
        : "Em breve";
    }
  }

  function mostrarSelecao() {
    bancoAtual = null;
    const elSel = document.getElementById("bqSelecao");
    const elView = document.getElementById("bqBancoView");
    if (elSel) elSel.hidden = false;
    if (elView) elView.hidden = true;
    renderHubContadores();
  }

  async function selecionarBanco(id) {
    const chave = id === "residencia" ? "residencia" : "fasm";
    const info = BANCOS_INFO[chave];
    bancoAtual = chave;

    const elSel = document.getElementById("bqSelecao");
    const elView = document.getElementById("bqBancoView");
    const elTit = document.getElementById("bqTituloPagina");
    if (elSel) elSel.hidden = true;
    if (elView) elView.hidden = false;
    if (elTit) elTit.textContent = info.tituloPagina;

    await carregarBanco();
    atualizarHistorico();

    todasQuestoes = questoesCarregadas.filter(q => q._banco === chave);

    // Resetar filtros ao trocar de banco
    filtros.busca = "";
    filtros.disciplina = "";
    filtros.apostila = "";
    filtros.tipo = "todas";
    filtros.status = "todas";
    filtros.indiceFoco = 0;
    filtros.paginaLista = 1;
    const elB = document.getElementById("bqBusca");
    const elD = document.getElementById("bqDisc");
    const elA = document.getElementById("bqApostila");
    const elT = document.getElementById("bqTipo");
    if (elB) elB.value = "";
    if (elD) elD.value = "";
    if (elA) elA.value = "";
    if (elT) elT.value = "todas";
    document.querySelectorAll("#bqStatusChips .bq-chip").forEach(b => {
      b.setAttribute("aria-pressed", b.dataset.status === "todas" ? "true" : "false");
    });

    const temQuestoes = todasQuestoes.length > 0;
    const elStats = document.getElementById("bqStats");
    const elFiltros = document.getElementById("bqFiltros");
    const elModos = document.getElementById("bqModos");
    if (elStats) elStats.hidden = !temQuestoes;
    if (elFiltros) elFiltros.hidden = !temQuestoes;
    if (elModos) elModos.hidden = !temQuestoes;

    if (!temQuestoes) {
      const sub = document.getElementById("bqSubtitulo");
      if (sub) sub.textContent = "Nenhuma questão cadastrada neste banco ainda.";
      const cx = document.getElementById("bqConteudo");
      if (cx) {
        cx.innerHTML = `
          <div class="bq-vazio bq-vazio--em-breve">
            <div class="bq-vazio__icon" aria-hidden="true">${info.icone}</div>
            <h3>Banco de ${esc(info.titulo)} em breve</h3>
            <p>As questões de ${esc(info.titulo)} ainda estão sendo preparadas e aparecerão aqui automaticamente assim que forem adicionadas.</p>
            <button type="button" class="bq-btn-prim" id="bqBtnVazioVoltar">Voltar para seleção</button>
          </div>
        `;
        const btnV = document.getElementById("bqBtnVazioVoltar");
        if (btnV) btnV.addEventListener("click", () => { mostrarSelecao(); rolarTopo(); });
      }
      rolarTopo();
      return;
    }

    popularSelects();
    aplicarFiltros(false);
    renderStats();
    renderConteudo();
    rolarTopo();
  }

  function definirFiltroStatus(st) {
    filtros.status = st || "todas";
    document.querySelectorAll("#bqStatusChips .bq-chip").forEach(b => {
      b.setAttribute("aria-pressed", b.dataset.status === filtros.status ? "true" : "false");
    });
    aplicarFiltros(false);
    renderConteudo();
  }

  function limparFiltros() {
    filtros.busca = "";
    filtros.disciplina = "";
    filtros.apostila = "";
    filtros.tipo = "todas";
    filtros.status = "todas";
    const elB = document.getElementById("bqBusca");
    const elD = document.getElementById("bqDisc");
    const elA = document.getElementById("bqApostila");
    const elT = document.getElementById("bqTipo");
    if (elB) elB.value = "";
    if (elD) elD.value = "";
    if (elA) elA.value = "";
    if (elT) elT.value = "todas";
    document.querySelectorAll("#bqStatusChips .bq-chip").forEach(b => {
      b.setAttribute("aria-pressed", b.dataset.status === "todas" ? "true" : "false");
    });
    popularSelects();
    aplicarFiltros(false);
    renderConteudo();
  }

  function popularSelects() {
    const selDisc = document.getElementById("bqDisc");
    const selAp = document.getElementById("bqApostila");
    if (!selDisc || !selAp) return;

    const discs = Array.from(new Set(todasQuestoes.map(q => q.disciplina))).sort((a, b) => a.localeCompare(b, "pt-BR"));
    selDisc.innerHTML = `<option value="">Todas as matérias (${discs.length})</option>` +
      discs.map(d => `<option value="${esc(d)}"${filtros.disciplina === d ? " selected" : ""}>${esc(d)}</option>`).join("");

    const mapaAp = new Map();
    for (const q of todasQuestoes) {
      if (filtros.disciplina && q.disciplina !== filtros.disciplina) continue;
      if (!mapaAp.has(q.pasta)) mapaAp.set(q.pasta, { titulo: q.apostila, n: 0 });
      mapaAp.get(q.pasta).n++;
    }
    const aps = Array.from(mapaAp.entries()).sort((a, b) => a[1].titulo.localeCompare(b[1].titulo, "pt-BR"));
    selAp.innerHTML = `<option value="">Todas as apostilas (${aps.length})</option>` +
      aps.map(([pasta, info]) => `<option value="${esc(pasta)}"${filtros.apostila === pasta ? " selected" : ""}>${esc(info.titulo)} (${info.n})</option>`).join("");
  }

  function renderStats() {
    const el = document.getElementById("bqStats");
    const sub = document.getElementById("bqSubtitulo");
    if (!el) return;
    const st = calcularEstatisticas();
    const provas = todasQuestoes.filter(q => q.tipo === "prova").length;
    const testes = todasQuestoes.filter(q => q.tipo === "teste").length;
    if (sub) {
      sub.textContent = `${st.total} questões no total (${provas} de provas/simulados e ${testes} testes de fixação) · Sincronizado no Google Drive`;
    }
    el.innerHTML = `
      <button type="button" class="bq-stat" data-kpi="todas" title="Ver todas as questões">
        <span class="bq-stat__lbl">No banco</span>
        <span class="bq-stat__val">${st.total}</span>
        <span class="bq-stat__sub">${st.total - st.resolvidas} pendentes</span>
      </button>
      <button type="button" class="bq-stat" data-kpi="nao_resolvidas" title="Filtrar não resolvidas">
        <span class="bq-stat__lbl">Resolvidas</span>
        <span class="bq-stat__val">${st.resolvidas}</span>
        <span class="bq-stat__sub">${st.total ? Math.round((st.resolvidas / st.total) * 100) : 0}% do banco</span>
      </button>
      <button type="button" class="bq-stat bq-stat--acerto" data-kpi="acertadas" title="Filtrar acertadas">
        <span class="bq-stat__lbl">Acertos</span>
        <span class="bq-stat__val">${st.acertos}</span>
        <span class="bq-stat__sub">${st.resolvidas ? st.taxa + "% de acerto" : "—"}</span>
      </button>
      <button type="button" class="bq-stat bq-stat--erro" data-kpi="erradas" title="Abrir Caderno de Erros">
        <span class="bq-stat__lbl">Para revisar</span>
        <span class="bq-stat__val">${st.erros}</span>
        <span class="bq-stat__sub">Caderno de Erros</span>
      </button>
      <button type="button" class="bq-stat bq-stat--fav" data-kpi="favoritas" title="Filtrar favoritas">
        <span class="bq-stat__lbl">Favoritas</span>
        <span class="bq-stat__val">${st.favoritas}</span>
        <span class="bq-stat__sub">Salvas por você</span>
      </button>
    `;
    el.querySelectorAll(".bq-stat").forEach(btn => {
      btn.addEventListener("click", () => definirFiltroStatus(btn.dataset.kpi));
    });
  }

  function renderCardQuestao(q, numExibicao) {
    const h = historico[q.uid] || {};
    const respondida = !modoRefazer[q.uid] && (h.status === "acertou" || h.status === "errou");
    const riscadas = Array.isArray(h.riscadas) ? h.riscadas : [];
    const selAtual = selecaoTemp[q.uid];

    const badgeTipo = q.formato === "discursiva"
      ? `<span class="bq-badge bq-badge--disc">Discursiva</span>`
      : q.tipo === "prova"
        ? `<span class="bq-badge bq-badge--prova">Prova / Simulado</span>`
        : `<span class="bq-badge bq-badge--teste">Teste${q.nivel ? " · Nível " + q.nivel : ""}</span>`;

    const badgeStatus = respondida
      ? (h.status === "acertou"
          ? `<span class="bq-badge bq-badge--acertou">Acertou</span>`
          : `<span class="bq-badge bq-badge--errou">Revisar</span>`)
      : "";

    let corpoHtml = "";
    if (q.formato === "objetiva") {
      corpoHtml += `<div class="bq-alts">`;
      q.alternativas.forEach((alt, idx) => {
        const letra = LETRAS[idx] || String(idx + 1);
        const ehRiscada = riscadas.includes(idx);
        let cls = "bq-alt";
        if (respondida) {
          if (idx === q.correta) cls += " bq-alt--correta";
          else if (idx === h.escolha && h.escolha !== q.correta) cls += " bq-alt--errada";
        } else {
          if (selAtual === idx) cls += " bq-alt--selecionada";
          if (ehRiscada) cls += " bq-alt--riscada";
        }
        corpoHtml += `
          <div class="bq-alt-row">
            <button type="button" class="${cls}" data-acao="selecionar" data-idx="${idx}" ${respondida ? "disabled" : ""}>
              <span class="bq-alt__letra">${letra}</span>
              <span class="bq-alt__txt">${fmtTexto(alt)}</span>
            </button>
            ${!respondida ? `
              <button type="button" class="bq-riscar-btn" data-acao="riscar" data-idx="${idx}" aria-pressed="${ehRiscada ? "true" : "false"}" title="${ehRiscada ? "Desriscar alternativa" : "Eliminar/riscar alternativa"}">
                ${IC_TESOURA}
              </button>
            ` : ""}
          </div>
        `;
      });
      corpoHtml += `</div>`;

      corpoHtml += `
        <div class="bq-card__rodape">
          <div class="bq-card__rodape-esq">
            ${!respondida ? `
              <button type="button" class="bq-btn-prim" data-acao="responder" ${typeof selAtual !== "number" ? "disabled" : ""}>Responder</button>
            ` : `
              <button type="button" class="bq-btn-sec" data-acao="refazer">Refazer questão</button>
            `}
          </div>
          <div class="bq-card__rodape-dir">
            ${filtros.modo === "foco" && respondida && filtros.indiceFoco < filtradas.length - 1 ? `
              <button type="button" class="bq-btn-prim" data-acao="proxima">Próxima questão ${IC_DIR}</button>
            ` : ""}
          </div>
        </div>
      `;

      if (respondida) {
        const acertou = h.status === "acertou";
        const letraCorreta = LETRAS[q.correta] || String(q.correta + 1);
        const erradosEntries = Object.entries(q.errados || {});
        corpoHtml += `
          <div class="bq-feedback ${acertou ? "bq-feedback--acertou" : "bq-feedback--errou"}">
            <div class="bq-feedback__tit">${acertou ? "Resposta correta!" : `Gabarito: alternativa ${letraCorreta}`}</div>
            ${q.explicacao ? `<p class="bq-feedback__txt">${fmtTexto(q.explicacao)}</p>` : ""}
            ${q.comentario ? `<p class="bq-feedback__dica"><strong>Dica:</strong> ${fmtTexto(q.comentario)}</p>` : ""}
            ${erradosEntries.length ? `
              <ul class="bq-errados-lista">
                ${erradosEntries.map(([k, txt]) => {
                  const l = LETRAS[Number(k)] || k;
                  return `<li><b>${l})</b> ${fmtTexto(txt)}</li>`;
                }).join("")}
              </ul>
            ` : ""}
          </div>
        `;
      }
    } else {
      // Discursiva
      const aberta = respondida || !!gabaritoDiscAberto[q.uid];
      corpoHtml += `
        <textarea class="bq-disc-area" data-acao="rascunho" placeholder="Rascunhe sua resposta aqui antes de conferir o gabarito (opcional)...">${esc(rascunhoDisc[q.uid] || "")}</textarea>
        <div class="bq-card__rodape">
          <div class="bq-card__rodape-esq">
            ${!aberta ? `
              <button type="button" class="bq-btn-prim" data-acao="ver-disc">Ver resposta esperada</button>
            ` : !respondida ? `
              <button type="button" class="bq-btn-prim bq-btn-acerto" data-acao="auto-acerto">Acertei / Dominei</button>
              <button type="button" class="bq-btn-prim bq-btn-erro" data-acao="auto-erro">Errei / Revisar</button>
            ` : `
              <button type="button" class="bq-btn-sec" data-acao="refazer">Refazer questão</button>
            `}
          </div>
          <div class="bq-card__rodape-dir">
            ${filtros.modo === "foco" && respondida && filtros.indiceFoco < filtradas.length - 1 ? `
              <button type="button" class="bq-btn-prim" data-acao="proxima">Próxima questão ${IC_DIR}</button>
            ` : ""}
          </div>
        </div>
      `;
      if (aberta) {
        corpoHtml += `
          <div class="bq-feedback ${respondida ? (h.status === "acertou" ? "bq-feedback--acertou" : "bq-feedback--errou") : ""}">
            <div class="bq-feedback__tit">Resposta esperada</div>
            <p class="bq-feedback__txt">${fmtTexto(q.explicacao || "Sem gabarito cadastrado.")}</p>
            ${q.comentario ? `<p class="bq-feedback__dica"><strong>Dica:</strong> ${fmtTexto(q.comentario)}</p>` : ""}
          </div>
        `;
      }
    }

    return `
      <article class="bq-card" data-uid="${esc(q.uid)}">
        <div class="bq-card__topo">
          <div class="bq-badges">
            <span class="bq-badge">#${numExibicao}</span>
            ${badgeTipo}
            <span class="bq-badge">${esc(q.disciplina)}</span>
            <span class="bq-badge">${esc(q.apostila)}</span>
            ${q.conceito_nome ? `<span class="bq-badge">${esc(q.conceito_nome)}</span>` : ""}
            ${badgeStatus}
          </div>
          <div class="bq-card__acoes-topo">
            <button type="button" class="bq-icon-btn bq-icon-btn--fav" data-acao="favoritar" aria-pressed="${h.favorita ? "true" : "false"}" title="${h.favorita ? "Remover das favoritas" : "Salvar nas favoritas"}">
              ${h.favorita ? IC_ESTRELA_CHEIA : IC_ESTRELA}
            </button>
            <button type="button" class="bq-icon-btn" data-acao="abrir-apostila" title="Abrir seção correspondente na apostila">
              ${IC_LIVRO}<span>Apostila</span>
            </button>
          </div>
        </div>
        ${q.ref ? `<div class="bq-ref">${esc(q.ref)}</div>` : ""}
        <div class="bq-enunciado">${fmtTexto(q.enunciado)}</div>
        ${q.itens && q.itens.length ? `<ol class="bq-itens">${q.itens.map(it => `<li>${fmtTexto(it)}</li>`).join("")}</ol>` : ""}
        ${corpoHtml}
      </article>
    `;
  }

  function renderConteudo() {
    const cx = document.getElementById("bqConteudo");
    if (!cx) return;

    if (!filtradas.length) {
      cx.innerHTML = `
        <div class="bq-vazio">
          <h3>Nenhuma questão encontrada</h3>
          <p>Tente ajustar os filtros ou limpar a busca para ver mais questões.</p>
          <button type="button" class="bq-btn-prim" id="bqBtnVazioLimpar">Limpar filtros</button>
        </div>
      `;
      const b = document.getElementById("bqBtnVazioLimpar");
      if (b) b.addEventListener("click", limparFiltros);
      return;
    }

    if (filtros.modo === "foco") {
      const idx = Math.min(Math.max(0, filtros.indiceFoco), filtradas.length - 1);
      filtros.indiceFoco = idx;
      const q = filtradas[idx];
      const pct = Math.round(((idx + 1) / filtradas.length) * 100);

      cx.innerHTML = `
        <div class="bq-foco-barra">
          <div class="bq-foco-progresso">
            <span class="bq-foco-contagem">Questão ${idx + 1} de ${filtradas.length}</span>
            <div class="bq-barra-trilho" aria-hidden="true"><div class="bq-barra-preench" style="width:${pct}%"></div></div>
          </div>
          <div class="bq-foco-nav">
            <button type="button" class="bq-btn-sec" id="bqPrev" ${idx <= 0 ? "disabled" : ""}>${IC_ESQ}<span>Anterior</span></button>
            <button type="button" class="bq-btn-sec" id="bqNext" ${idx >= filtradas.length - 1 ? "disabled" : ""}><span>Próxima</span>${IC_DIR}</button>
          </div>
        </div>
        <div class="bq-lista">${renderCardQuestao(q, idx + 1)}</div>
        <div class="bq-atalhos-dica">Atalhos: <kbd>A</kbd>–<kbd>E</kbd> selecionar · <kbd>Enter</kbd> responder / próxima · <kbd>←</kbd> <kbd>→</kbd> navegar</div>
      `;

      const prev = document.getElementById("bqPrev");
      const next = document.getElementById("bqNext");
      if (prev) prev.addEventListener("click", () => irParaFoco(idx - 1));
      if (next) next.addEventListener("click", () => irParaFoco(idx + 1));
    } else {
      const totalPags = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA));
      filtros.paginaLista = Math.min(Math.max(1, filtros.paginaLista), totalPags);
      const ini = (filtros.paginaLista - 1) * POR_PAGINA;
      const fatia = filtradas.slice(ini, ini + POR_PAGINA);

      cx.innerHTML = `
        <div class="bq-foco-barra">
          <span class="bq-foco-contagem">Mostrando ${ini + 1}–${ini + fatia.length} de ${filtradas.length} questões</span>
          <span class="bq-foco-contagem" style="color:var(--cor-suave)">Página ${filtros.paginaLista} de ${totalPags}</span>
        </div>
        <div class="bq-lista">
          ${fatia.map((q, i) => renderCardQuestao(q, ini + i + 1)).join("")}
        </div>
        ${totalPags > 1 ? `
          <div class="bq-paginacao">
            <button type="button" class="bq-btn-sec" id="bqPagAnt" ${filtros.paginaLista <= 1 ? "disabled" : ""}>${IC_ESQ}<span>Anterior</span></button>
            <span class="bq-foco-contagem">${filtros.paginaLista} / ${totalPags}</span>
            <button type="button" class="bq-btn-sec" id="bqPagProx" ${filtros.paginaLista >= totalPags ? "disabled" : ""}><span>Próxima</span>${IC_DIR}</button>
          </div>
        ` : ""}
      `;

      const pAnt = document.getElementById("bqPagAnt");
      const pProx = document.getElementById("bqPagProx");
      if (pAnt) pAnt.addEventListener("click", () => { filtros.paginaLista--; renderConteudo(); rolarTopo(); });
      if (pProx) pProx.addEventListener("click", () => { filtros.paginaLista++; renderConteudo(); rolarTopo(); });
    }

    vincularEventosCards(cx);
  }

  function rolarTopo() {
    const shell = document.querySelector(".app-workspace-shell");
    if (shell) shell.scrollTo({ top: 0, behavior: "smooth" });
  }

  function irParaFoco(novoIdx) {
    if (novoIdx < 0 || novoIdx >= filtradas.length) return;
    filtros.indiceFoco = novoIdx;
    renderConteudo();
    rolarTopo();
  }

  function vincularEventosCards(container) {
    container.querySelectorAll(".bq-card").forEach(card => {
      const uid = card.dataset.uid;
      const q = todasQuestoes.find(x => x.uid === uid);
      if (!q) return;

      card.addEventListener("click", e => {
        const btn = e.target.closest("[data-acao]");
        if (!btn) return;
        const acao = btn.dataset.acao;

        if (acao === "selecionar") {
          const idx = parseInt(btn.dataset.idx, 10);
          selecaoTemp[uid] = idx;
          renderConteudo();
        } else if (acao === "riscar") {
          const idx = parseInt(btn.dataset.idx, 10);
          const atual = historico[uid] || {};
          const risc = new Set(Array.isArray(atual.riscadas) ? atual.riscadas : []);
          if (risc.has(idx)) risc.delete(idx);
          else risc.add(idx);
          salvarAlteracao(uid, { riscadas: Array.from(risc) });
          renderConteudo();
        } else if (acao === "responder") {
          const escolha = selecaoTemp[uid];
          if (typeof escolha !== "number") return;
          registrarRespostaObjetiva(q, escolha);
        } else if (acao === "refazer") {
          modoRefazer[uid] = true;
          delete selecaoTemp[uid];
          delete gabaritoDiscAberto[uid];
          renderConteudo();
        } else if (acao === "ver-disc") {
          gabaritoDiscAberto[uid] = true;
          renderConteudo();
        } else if (acao === "auto-acerto" || acao === "auto-erro") {
          const acertou = acao === "auto-acerto";
          const atual = historico[uid] || {};
          delete modoRefazer[uid];
          salvarAlteracao(uid, {
            status: acertou ? "acertou" : "errou",
            tentativas: (atual.tentativas || 0) + 1,
            acertos: (atual.acertos || 0) + (acertou ? 1 : 0),
            erros: (atual.erros || 0) + (acertou ? 0 : 1),
          });
          renderStats();
          renderConteudo();
        } else if (acao === "favoritar") {
          const atual = historico[uid] || {};
          const novoFav = !atual.favorita;
          salvarAlteracao(uid, { favorita: novoFav });
          renderStats();
          renderConteudo();
          toast(novoFav ? "Adicionada às favoritas!" : "Removida das favoritas.");
        } else if (acao === "abrir-apostila") {
          if (window.alternarAbaPrincipal) window.alternarAbaPrincipal("apostilas");
          if (window.interativos && window.interativos.abrir) {
            window.interativos.abrir(q.pasta, { hash: q.hash || "" });
          }
        } else if (acao === "proxima") {
          irParaFoco(filtros.indiceFoco + 1);
        }
      });

      const ta = card.querySelector('textarea[data-acao="rascunho"]');
      if (ta) {
        ta.addEventListener("input", () => { rascunhoDisc[uid] = ta.value; });
      }
    });
  }

  function registrarRespostaObjetiva(q, escolha) {
    const acertou = escolha === q.correta;
    const atual = historico[q.uid] || {};
    delete modoRefazer[q.uid];
    delete selecaoTemp[q.uid];

    const dados = {
      status: acertou ? "acertou" : "errou",
      escolha,
      tentativas: (atual.tentativas || 0) + 1,
      acertos: (atual.acertos || 0) + (acertou ? 1 : 0),
      erros: (atual.erros || 0) + (acertou ? 0 : 1),
    };
    const metaTeste = q.tipo === "teste" ? { pasta: q.pasta, id: q.id } : null;
    salvarAlteracao(q.uid, dados, metaTeste);
    renderStats();
    renderConteudo();
  }

  function salvarAlteracao(uid, dados, metaTeste) {
    if (window.EJStorageDrive && window.EJStorageDrive.salvarItemBancoQuestao) {
      const salvo = window.EJStorageDrive.salvarItemBancoQuestao(uid, dados, metaTeste);
      historico[uid] = Object.assign({}, historico[uid] || {}, salvo || dados);
    } else {
      historico[uid] = Object.assign({}, historico[uid] || {}, dados);
    }
  }

  function aoTeclar(e) {
    const sec = document.getElementById(SEC_ID);
    if (!sec || sec.hidden || !bancoAtual || filtros.modo !== "foco" || !filtradas.length) return;
    const tag = (document.activeElement && document.activeElement.tagName || "").toUpperCase();
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    const q = filtradas[filtros.indiceFoco];
    if (!q) return;
    const h = historico[q.uid] || {};
    const respondida = !modoRefazer[q.uid] && (h.status === "acertou" || h.status === "errou");

    if (e.key === "ArrowRight") {
      e.preventDefault();
      irParaFoco(filtros.indiceFoco + 1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      irParaFoco(filtros.indiceFoco - 1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (!respondida && q.formato === "objetiva" && typeof selecaoTemp[q.uid] === "number") {
        registrarRespostaObjetiva(q, selecaoTemp[q.uid]);
      } else if (respondida && filtros.indiceFoco < filtradas.length - 1) {
        irParaFoco(filtros.indiceFoco + 1);
      }
    } else if (!respondida && q.formato === "objetiva") {
      const k = e.key.toUpperCase();
      let idx = LETRAS.indexOf(k);
      if (idx === -1 && /^[1-6]$/.test(k)) idx = parseInt(k, 10) - 1;
      if (idx >= 0 && idx < q.alternativas.length) {
        e.preventDefault();
        selecaoTemp[q.uid] = idx;
        renderConteudo();
      }
    }
  }

  async function abrir() {
    montarEstruturaBase();
    mostrarSelecao();
    await carregarBanco();
    atualizarHistorico();
    renderHubContadores();
  }

  // Atualiza automaticamente quando o Google Drive terminar de sincronizar
  window.addEventListener("ej-banco-questoes-sync", () => {
    const sec = document.getElementById(SEC_ID);
    if (!montado || !questoesCarregadas.length) return;
    atualizarHistorico();
    if (sec && !sec.hidden && bancoAtual && todasQuestoes.length) {
      renderStats();
      renderConteudo();
    }
  });

  window.EJBancoQuestoes = { abrir, selecionarBanco, mostrarSelecao };
})();
