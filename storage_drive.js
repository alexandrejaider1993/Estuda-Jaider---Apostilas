/*
  Motor Local + Cálculo de Domínio (BKT) + Sincronização com Google Drive (Apostilas Interativas).

  Substitui o backend Python para que o site rode 100% estático no Vercel, mantendo:
  - Todas as rotas /api/interativos* e /api/pastas-aparencia* interceptadas em window.fetch
  - Cálculo exato de Domínio por Conceito (BKT idêntico a dominio_apostilas.py + calculadora_conhecimento.py)
  - Busca global em todas as apostilas (/api/interativos-buscar?q=...)
  - Importação local de novas apostilas (.html, .zip, biblioteca.json, capa) guardadas no IndexedDB
  - Capas personalizadas de pastas (GIFs animados e imagens) guardadas e sincronizadas
  - Login com Google (Google Identity Services OAuth2) + Sincronização automática com o Google Drive
    do aluno (appDataFolder), mesclando item a item pelo timestamp `atualizado_em`.
*/
(function () {
  "use strict";

  const CHAVE_DADOS = "ej_apostilas_dados_v1";
  const CHAVE_CONTA = "ej_google_conta_v1";
  const CHAVE_CLIENT_ID = "ej_google_client_id";
  const CHAVE_WEBHOOK_VAGAS = "ej_webhook_vagas_url";
  const CLIENT_ID_PADRAO = "363099555044-2v1qfhn1an7j46op8foien17mo139qfl.apps.googleusercontent.com";
  // Cole aqui a URL do seu Google Apps Script (Web App) para controlar as 50 vagas e registrar a planilha de alunos:
  const URL_CONTROLE_VAGAS_PADRAO = "https://script.google.com/macros/s/AKfycbzO919V--CjwNYSWd6caoGtdtu6qGmca5RYjkeGwwzKY4nnCQdUTyIhgnHnqQP4-EOj/exec";
  const LIMITE_VAGAS_PADRAO = 50;
  const ARQUIVO_DRIVE = "estuda_jaider_apostilas_v1.json";
  const ESCOPOS_DRIVE = "https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email";

  // Constantes do BKT (idênticas a calculadora_conhecimento.py)
  const BKT_INICIAL = 0.20;
  const BKT_APRENDE = 0.15;
  const BKT_ERRO_DISTRACAO = 0.10;
  const BKT_DOMINADO = 0.95;
  const BKT_PISO_CHUTE = 0.05;

  const fetchNativo = window.fetch.bind(window);
  const SENHA_ADMIN = "@TAD1723e@";
  const CHAVE_ADMIN = "ej_modo_admin_ativo";

  function ehAdmin() {
    try { return sessionStorage.getItem(CHAVE_ADMIN) === "1"; } catch (e) { return false; }
  }

  function entrarModoAdmin(senha) {
    const s = String(senha || "").trim();
    if (s !== SENHA_ADMIN && s.toLowerCase() !== SENHA_ADMIN.toLowerCase()) return false;
    try { sessionStorage.setItem(CHAVE_ADMIN, "1"); } catch (e) {}
    document.documentElement.dataset.admin = "1";
    window.dispatchEvent(new CustomEvent("ej-admin-mudou", { detail: { admin: true } }));
    if (typeof sincronizarComDriveAgora === "function" && tokenAcesso) {
      setTimeout(() => { sincronizarComDriveAgora().catch(() => {}); }, 80);
    }
    return true;
  }

  function sairModoAdmin() {
    try { sessionStorage.removeItem(CHAVE_ADMIN); } catch (e) {}
    delete document.documentElement.dataset.admin;
    window.dispatchEvent(new CustomEvent("ej-admin-mudou", { detail: { admin: false } }));
  }

  if (ehAdmin()) {
    document.documentElement.dataset.admin = "1";
  }

  let catalogo = { apostilas: [], organizacao_padrao: { pastas: {}, apostilas: {} }, aparencia_padrao: {}, titulos_padrao: {}, disciplinas_padrao: {} };
  let indiceBusca = {};
  let prontoPromise = null;
  let dirProjetoHandle = null; // FileSystemDirectoryHandle da pasta Apostilas-Vercel no PC do Admin

  // Estado persistido do aluno (localStorage + IndexedDB + Google Drive)
  let estado = {
    versao: 1,
    atualizado_em: 0,
    org_em: 0,
    organizacao: null,      // { pastas: {...}, apostilas: {...} }
    aparencia: {},          // { "apost:id": { cor, capa, atualizado_em } }
    capas_custom: {},       // { "hash.gif": "data:image/gif;base64,..." }
    titulos: {},            // { pasta: "Novo título" }
    disciplinas: {},        // { pasta: "Farmacoterapia" ou "" para remover }
    progresso: {},          // { pasta: { atualizado_em, texto } }
    posicao: {},            // { pasta: { atualizado_em, hash, titulo, pct, y } }
    anotacoes: {},          // { pasta: { atualizado_em, itens: { id: {...} } } }
    excluidas: {},          // { pasta: timestamp }
    banco_questoes: {},     // { uid: { status, escolha, tentativas, acertos, erros, favorita, riscadas, atualizado_em } }
  };

  // Apostilas importadas pelo usuário no navegador (guardadas no IndexedDB porque o HTML pode ter vários MB)
  let apostilasImportadas = {}; // { pasta: { ficha, html, capaDataUrl, modificado, chave_local, conceitos, testes, secoes } }
  // Cache local em IndexedDB de prévias de capas (evita estourar limite de 5MB do localStorage e evita 404 antes do deploy)
  let capasCacheLocal = {}; // { "hash.webp": "data:image/webp;base64,..." }

  // ------------------------------------------------------------------ IndexedDB para apostilas importadas e backup grande
  function abrirIDB() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) return resolve(null);
      const req = indexedDB.open("EstudaJaiderApostilasDB", 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("apostilas_usuario")) db.createObjectStore("apostilas_usuario", { keyPath: "pasta" });
        if (!db.objectStoreNames.contains("estado_kv")) db.createObjectStore("estado_kv");
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    });
  }

  async function idbLerApostilas() {
    const db = await abrirIDB();
    if (!db) return {};
    return new Promise(resolve => {
      try {
        const tx = db.transaction("apostilas_usuario", "readonly");
        const req = tx.objectStore("apostilas_usuario").getAll();
        req.onsuccess = () => {
          const mapa = {};
          for (const it of (req.result || [])) if (it && it.pasta) mapa[it.pasta] = it;
          resolve(mapa);
        };
        req.onerror = () => resolve({});
      } catch (e) { resolve({}); }
    });
  }

  async function idbSalvarApostila(obj) {
    const db = await abrirIDB();
    if (!db) return;
    return new Promise(resolve => {
      try {
        const tx = db.transaction("apostilas_usuario", "readwrite");
        tx.objectStore("apostilas_usuario").put(obj);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch (e) { resolve(false); }
    });
  }

  async function idbApagarApostila(pasta) {
    const db = await abrirIDB();
    if (!db) return;
    return new Promise(resolve => {
      try {
        const tx = db.transaction("apostilas_usuario", "readwrite");
        tx.objectStore("apostilas_usuario").delete(pasta);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch (e) { resolve(false); }
    });
  }

  async function idbGuardarHandlePasta(handle) {
    const db = await abrirIDB();
    if (!db) return;
    return new Promise(resolve => {
      try {
        const tx = db.transaction("estado_kv", "readwrite");
        tx.objectStore("estado_kv").put(handle, "dir_projeto_handle");
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch (e) { resolve(false); }
    });
  }

  async function idbLerHandlePasta() {
    const db = await abrirIDB();
    if (!db) return null;
    return new Promise(resolve => {
      try {
        const tx = db.transaction("estado_kv", "readonly");
        const req = tx.objectStore("estado_kv").get("dir_projeto_handle");
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      } catch (e) { resolve(null); }
    });
  }

  async function idbLerCapasCache() {
    const db = await abrirIDB();
    if (!db) return {};
    return new Promise(resolve => {
      try {
        const tx = db.transaction("estado_kv", "readonly");
        const req = tx.objectStore("estado_kv").get("capas_cache");
        req.onsuccess = () => resolve((req.result && typeof req.result === "object") ? req.result : {});
        req.onerror = () => resolve({});
      } catch (e) { resolve({}); }
    });
  }

  async function idbSalvarCapasCache(mapa) {
    const db = await abrirIDB();
    if (!db) return;
    return new Promise(resolve => {
      try {
        const tx = db.transaction("estado_kv", "readwrite");
        tx.objectStore("estado_kv").put(mapa || {}, "capas_cache");
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch (e) { resolve(false); }
    });
  }

  function obterDataUrlCapaLocal(nome) {
    if (!nome || typeof nome !== "string") return "";
    if (capasCacheLocal && capasCacheLocal[nome]) return capasCacheLocal[nome];
    if (estado.capas_custom && estado.capas_custom[nome]) return estado.capas_custom[nome];
    return "";
  }

  function limparCapasNaoUsadas() {
    const usadas = new Set();
    for (const ap of Object.values(estado.aparencia || {})) {
      if (ap && typeof ap.capa === "string" && ap.capa && !ap.capa.startsWith("data:")) {
        usadas.add(ap.capa);
      }
    }
    for (const ap of Object.values((catalogo && catalogo.aparencia_padrao) || {})) {
      if (ap && typeof ap.capa === "string" && ap.capa && !ap.capa.startsWith("data:")) {
        usadas.add(ap.capa);
      }
    }
    if (estado.capas_custom && typeof estado.capas_custom === "object") {
      for (const k of Object.keys(estado.capas_custom)) {
        if (!usadas.has(k)) delete estado.capas_custom[k];
      }
    }
    for (const k of Object.keys(capasCacheLocal)) {
      if (!usadas.has(k)) delete capasCacheLocal[k];
    }
  }

  function registrarCapaLocal(hash, dataUrl) {
    if (!hash || !dataUrl) return;
    capasCacheLocal[hash] = dataUrl;
    limparCapasNaoUsadas();
    capasCacheLocal[hash] = dataUrl;
    idbSalvarCapasCache(capasCacheLocal);
  }

  async function tentarRestaurarPastaProjeto() {
    try {
      const h = await idbLerHandlePasta();
      if (h) dirProjetoHandle = h;
    } catch (e) {}
  }

  function dataUrlParaUint8Array(dataUrl) {
    const partes = String(dataUrl || "").split(",");
    if (partes.length < 2) return null;
    const bin = atob(partes[1]);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return arr;
  }

  async function escreverArquivoNoHandle(dirHandle, nomeArquivo, conteudo) {
    const fh = await dirHandle.getFileHandle(nomeArquivo, { create: true });
    const w = await fh.createWritable();
    await w.write(conteudo);
    await w.close();
  }

  // Vincula ou usa a pasta do PC (Apostilas-Vercel) e salva catalogo.json, indice_busca.json, capas_pastas/ e interativos/
  async function salvarNaPastaDoPC(pedirPermissao = true) {
    if (!window.showDirectoryPicker) {
      throw new Error("Seu navegador não suporta gravação direta na pasta. Use Chrome ou Edge no PC.");
    }
    if (!dirProjetoHandle) {
      if (!pedirPermissao) return { ok: false, motivo: "sem_pasta" };
      dirProjetoHandle = await window.showDirectoryPicker({
        id: "apostilas_vercel_raiz",
        mode: "readwrite",
        startIn: "desktop",
      });
      await idbGuardarHandlePasta(dirProjetoHandle);
    } else {
      const perm = await dirProjetoHandle.queryPermission({ mode: "readwrite" });
      if (perm !== "granted") {
        if (!pedirPermissao) return { ok: false, motivo: "sem_permissao" };
        const req = await dirProjetoHandle.requestPermission({ mode: "readwrite" });
        if (req !== "granted") throw new Error("Permissão negada para gravar na pasta do PC.");
      }
    }

    // 1. Grava capas customizadas (data:image/...) como arquivos reais em capas_pastas/<hash>
    const dirCapas = await dirProjetoHandle.getDirectoryHandle("capas_pastas", { create: true });
    const aparenciaLimpa = JSON.parse(JSON.stringify(estado.aparencia || {}));

    for (const [chave, ap] of Object.entries(aparenciaLimpa)) {
      if (!ap || typeof ap.capa !== "string" || !ap.capa) continue;
      if (ap.capa.startsWith("data:")) {
        const dataUrlOriginal = ap.capa;
        const mime = (dataUrlOriginal.match(/^data:(image\/[a-z0-9.+-]+);base64,/i) || [])[1] || "image/webp";
        const ext = mime === "image/gif" ? ".gif" : (mime === "image/png" ? ".png" : (mime === "image/jpeg" ? ".jpg" : ".webp"));
        let hashNome = Object.keys(capasCacheLocal).find(k => capasCacheLocal[k] === dataUrlOriginal)
          || Object.keys(estado.capas_custom || {}).find(k => estado.capas_custom[k] === dataUrlOriginal);
        if (!hashNome) {
          hashNome = Array.from(crypto.getRandomValues(new Uint8Array(10))).map(x => x.toString(16).padStart(2, "0")).join("") + ext;
        }
        const bytes = dataUrlParaUint8Array(dataUrlOriginal);
        if (bytes) {
          await escreverArquivoNoHandle(dirCapas, hashNome, bytes);
          registrarCapaLocal(hashNome, dataUrlOriginal);
          ap.capa = hashNome;
          if (estado.aparencia[chave]) estado.aparencia[chave].capa = hashNome;
        }
      } else {
        const dataUrlCache = obterDataUrlCapaLocal(ap.capa);
        if (dataUrlCache && dataUrlCache.startsWith("data:")) {
          const bytes = dataUrlParaUint8Array(dataUrlCache);
          if (bytes) await escreverArquivoNoHandle(dirCapas, ap.capa, bytes);
        }
      }
    }

    // 2. Grava apostilas importadas no navegador dentro de interativos/<pasta>/
    const dirInterativos = await dirProjetoHandle.getDirectoryHandle("interativos", { create: true });
    for (const [pasta, imp] of Object.entries(apostilasImportadas)) {
      if (estado.excluidas && estado.excluidas[pasta]) continue;
      const subDir = await dirInterativos.getDirectoryHandle(pasta, { create: true });
      if (imp.html) {
        await escreverArquivoNoHandle(subDir, "index.html", imp.html);
      }
      let nomeCapaArq = "";
      if (imp.capaDataUrl && imp.capaDataUrl.startsWith("data:")) {
        const mime = (imp.capaDataUrl.match(/^data:(image\/[a-z0-9.+-]+);base64,/i) || [])[1] || "image/jpeg";
        const ext = mime === "image/png" ? ".png" : (mime === "image/webp" ? ".webp" : ".jpg");
        nomeCapaArq = "capa" + ext;
        const bytes = dataUrlParaUint8Array(imp.capaDataUrl);
        if (bytes) await escreverArquivoNoHandle(subDir, nomeCapaArq, bytes);
      }
      const ficha = Object.assign({ formato: "estuda-jaider-site", arquivo: "index.html" }, imp.ficha || {});
      if (nomeCapaArq) ficha.capa = nomeCapaArq;
      await escreverArquivoNoHandle(subDir, "biblioteca.json", JSON.stringify(ficha, null, 2));
    }

    // 3. Monta o novo catalogo.json e indice_busca.json completos
    const metas = listarMetadadosApostilas().map(a => {
      const imp = apostilasImportadas[a.pasta];
      let capaUrl = a.capa || "";
      if (imp && imp.capaDataUrl && imp.capaDataUrl.startsWith("data:")) {
        const mime = (imp.capaDataUrl.match(/^data:(image\/[a-z0-9.+-]+);base64,/i) || [])[1] || "image/jpeg";
        const ext = mime === "image/png" ? ".png" : (mime === "image/webp" ? ".webp" : ".jpg");
        capaUrl = `/interativos/${a.pasta}/capa${ext}`;
      }
      return {
        pasta: a.pasta,
        titulo: a.titulo,
        subtitulo: a.subtitulo || "",
        disciplina: a.disciplina || "",
        periodo: a.periodo || "",
        prova: a.prova || "",
        data_aula: a.data_aula || "",
        capitulos: a.capitulos || [],
        contagem: a.contagem || {},
        url: `/interativos/${a.pasta}/index.html`,
        capa: capaUrl,
        modificado: a.modificado || Math.floor(Date.now() / 1000),
        chave_local: a.chave_local || "",
        conceitos: a.conceitos || [],
        testes: a.testes || [],
      };
    });

    // Descobre automaticamente novas pastas adicionadas manualmente em interativos/<pasta>/ no PC
    try {
      const pastasConhecidas = new Set(metas.map(m => m.pasta));
      for await (const [nomeEntrada, entryHandle] of dirInterativos.entries()) {
        if (entryHandle.kind !== "directory" || nomeEntrada.startsWith(".") || nomeEntrada.startsWith("_")) continue;
        if (pastasConhecidas.has(nomeEntrada)) continue;
        if (estado.excluidas && estado.excluidas[nomeEntrada]) continue;
        let htmlTexto = "";
        try {
          const fhHtml = await entryHandle.getFileHandle("index.html");
          htmlTexto = await (await fhHtml.getFile()).text();
        } catch (e) { continue; }
        let ficha = null;
        try {
          const fhBib = await entryHandle.getFileHandle("biblioteca.json");
          ficha = JSON.parse(await (await fhBib.getFile()).text());
        } catch (e) {}
        const mTit = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(htmlTexto.slice(0, 20000));
        const titHtml = mTit ? mTit[1].replace(/\s+/g, " ").trim() : nomeEntrada;
        // Se biblioteca.json foi copiado de outra apostila com id diferente da pasta, usa o título do HTML
        const tituloFinal = (ficha && ficha.titulo && (!ficha.id || ficha.id === nomeEntrada)) ? ficha.titulo : (titHtml || (ficha && ficha.titulo) || nomeEntrada);
        const extra = extrairDadosDeHtmlImportado(htmlTexto, tituloFinal);
        metas.push({
          pasta: nomeEntrada,
          titulo: tituloFinal,
          subtitulo: (ficha && ficha.subtitulo) || "",
          disciplina: (ficha && ficha.disciplina) || "",
          periodo: (ficha && ficha.periodo) || "",
          prova: (ficha && ficha.prova) || "",
          data_aula: (ficha && ficha.data_aula) || "",
          capitulos: (ficha && ficha.capitulos) || [],
          contagem: (ficha && ficha.contagem) || {},
          url: `/interativos/${nomeEntrada}/index.html`,
          capa: (ficha && ficha.capa) ? `/interativos/${nomeEntrada}/${ficha.capa}` : "",
          modificado: Math.floor(Date.now() / 1000),
          chave_local: extra.chave_local || "",
          conceitos: extra.conceitos || [],
          testes: extra.testes || [],
        });
        indiceBusca[nomeEntrada] = {
          titulo: tituloFinal,
          secoes: extra.secoes || [],
        };
      }
    } catch (e) {
      console.warn("Varredura de interativos/ no PC:", e);
    }

    metas.sort((a, b) => String(a.titulo || a.pasta).localeCompare(String(b.titulo || b.pasta), "pt-BR", { numeric: true, sensitivity: "base" }));

    const orgLimpa = lerOrganizacaoLimpa();
    const titulosLimpos = {};
    const disciplinasLimpos = {};
    const pastasAtivas = new Set(metas.map(m => m.pasta));
    for (const [k, v] of Object.entries(estado.titulos || {})) {
      if (pastasAtivas.has(k) && typeof v === "string" && v.trim()) {
        titulosLimpos[k] = v.trim();
      }
    }
    for (const [k, v] of Object.entries(estado.disciplinas || {})) {
      if (pastasAtivas.has(k) && typeof v === "string") {
        disciplinasLimpos[k] = v.trim();
      }
    }
    const novoCatalogo = {
      apostilas: metas,
      organizacao_padrao: orgLimpa,
      aparencia_padrao: aparenciaLimpa,
      titulos_padrao: titulosLimpos,
      disciplinas_padrao: disciplinasLimpos,
    };

    const novoIndice = Object.assign({}, indiceBusca);
    for (const [pasta, imp] of Object.entries(apostilasImportadas)) {
      if (estado.excluidas && estado.excluidas[pasta]) {
        delete novoIndice[pasta];
        continue;
      }
      novoIndice[pasta] = {
        titulo: (imp.ficha && imp.ficha.titulo) || pasta,
        secoes: imp.secoes || [],
      };
    }
    for (const m of metas) {
      if (novoIndice[m.pasta]) {
        novoIndice[m.pasta].titulo = m.titulo;
      }
    }
    for (const exc of Object.keys(estado.excluidas || {})) {
      delete novoIndice[exc];
    }

    await escreverArquivoNoHandle(dirProjetoHandle, "catalogo.json", JSON.stringify(novoCatalogo, null, 2));
    await escreverArquivoNoHandle(dirProjetoHandle, "indice_busca.json", JSON.stringify(novoIndice));

    catalogo = novoCatalogo;
    indiceBusca = novoIndice;
    salvarEstadoLocal(false);
    window.dispatchEvent(new CustomEvent("ej-pasta-pc-salva", { detail: { pasta: dirProjetoHandle.name } }));
    return { ok: true, pasta: dirProjetoHandle.name };
  }

  async function autoSalvarPastaPCSeConectada() {
    if (!ehAdmin() || !dirProjetoHandle) return;
    try {
      const r = await salvarNaPastaDoPC(false);
      if (r && r.ok && window.mostrarToast) {
        window.mostrarToast(`Atualizado na pasta "${r.pasta}" do PC!`);
      }
    } catch (e) {
      console.warn("Auto-save pasta do PC:", e);
    }
  }

  // ------------------------------------------------------------------ Carregamento e persistência local
  function carregarEstadoLocal() {
    try {
      const bruto = localStorage.getItem(CHAVE_DADOS);
      if (bruto) {
        const d = JSON.parse(bruto);
        if (d && typeof d === "object") {
          estado = Object.assign(estado, d);
        }
      }
    } catch (e) {
      console.warn("Erro ao ler estado local:", e);
    }
  }

  function salvarEstadoLocal(agendarNuvem = true) {
    estado.atualizado_em = Date.now() / 1000;
    limparCapasNaoUsadas();
    try {
      localStorage.setItem(CHAVE_DADOS, JSON.stringify(estado));
    } catch (e) {
      // Se o localStorage estiver cheio (limite ~5MB), salva sem capas_custom pois elas já ficam no IndexedDB
      try {
        const copiaLeve = Object.assign({}, estado, { capas_custom: {} });
        localStorage.setItem(CHAVE_DADOS, JSON.stringify(copiaLeve));
      } catch (e2) {
        console.warn("Aviso: localStorage cheio ou indisponível", e2);
      }
    }
    if (agendarNuvem) agendarSincronizacaoDrive();
  }

  // Garante que o progresso salvo pela apostila direto em localStorage[CH] e o nosso estado.progresso[pasta] estejam em sincronia
  function sincronizarChavesLocaisComEstado() {
    const todas = listarMetadadosApostilas();
    let mudou = false;
    for (const a of todas) {
      const ch = a.chave_local;
      if (!ch) continue;
      let localStr = null;
      try { localStr = localStorage.getItem(ch); } catch (e) {}
      const progSalvo = estado.progresso[a.pasta];
      let estadoSalvoObj = null;
      if (progSalvo && progSalvo.texto) {
        try {
          const p = JSON.parse(progSalvo.texto);
          estadoSalvoObj = (p && typeof p.estado === "string") ? JSON.parse(p.estado) : p;
        } catch (e) {}
      }
      let localObj = null;
      if (localStr) {
        try { localObj = JSON.parse(localStr); } catch (e) {}
      }
      const tsLocal = (localObj && Number(localObj.ts)) ? Number(localObj.ts) / 1000 : 0;
      const tsSalvo = progSalvo ? (Number(progSalvo.atualizado_em) || 0) : 0;

      if (localObj && (!estadoSalvoObj || tsLocal > tsSalvo + 1)) {
        estado.progresso[a.pasta] = {
          atualizado_em: tsLocal || (Date.now() / 1000),
          texto: JSON.stringify(localObj),
        };
        mudou = true;
      } else if (estadoSalvoObj && (!localObj || tsSalvo > tsLocal + 1)) {
        try { localStorage.setItem(ch, JSON.stringify(estadoSalvoObj)); } catch (e) {}
      }
    }
    if (mudou) salvarEstadoLocal(false);
  }

  async function inicializar() {
    if (prontoPromise) return prontoPromise;
    prontoPromise = (async () => {
      carregarEstadoLocal();
      const [catResp, indResp, imp, capasIdb] = await Promise.all([
        fetchNativo("/catalogo.json", { cache: "no-store" }).then(r => r.ok ? r.json() : null).catch(() => null),
        fetchNativo("/indice_busca.json", { cache: "no-store" }).then(r => r.ok ? r.json() : null).catch(() => null),
        idbLerApostilas(),
        idbLerCapasCache(),
      ]);
      if (catResp) catalogo = catResp;
      if (indResp) indiceBusca = indResp;
      apostilasImportadas = imp || {};
      capasCacheLocal = Object.assign({}, estado.capas_custom || {}, capasIdb || {});

      // Se o Admin já fez edições locais neste navegador (org_em > 0), preserva; caso contrário usa o catalogo.json oficial
      const temEdicaoAdminSalva = (Number(estado.org_em) || 0) > 0 && estado.organizacao && estado.organizacao.pastas && Object.keys(estado.organizacao.pastas).length > 0;
      if (!temEdicaoAdminSalva) {
        estado.organizacao = JSON.parse(JSON.stringify(catalogo.organizacao_padrao || { pastas: {}, apostilas: {} }));
      } else {
        // Mescla pastas e vínculos de apostilas novos que vieram do catalogo.json
        const orgCat = catalogo.organizacao_padrao || { pastas: {}, apostilas: {} };
        for (const [pid, p] of Object.entries(orgCat.pastas || {})) {
          if (!(pid in estado.organizacao.pastas)) {
            estado.organizacao.pastas[pid] = JSON.parse(JSON.stringify(p));
          }
        }
        if (!estado.organizacao.apostilas) estado.organizacao.apostilas = {};
        for (const [ap, pid] of Object.entries(orgCat.apostilas || {})) {
          if (!(ap in estado.organizacao.apostilas) && (pid in estado.organizacao.pastas)) {
            estado.organizacao.apostilas[ap] = pid;
          }
        }
      }
      if (!estado.aparencia) estado.aparencia = {};
      if (!temEdicaoAdminSalva && !ehAdmin()) {
        estado.aparencia = JSON.parse(JSON.stringify(catalogo.aparencia_padrao || {}));
      } else {
        for (const [k, v] of Object.entries(catalogo.aparencia_padrao || {})) {
          if (!(k in estado.aparencia)) {
            estado.aparencia[k] = JSON.parse(JSON.stringify(v));
          }
        }
      }
      if (!estado.titulos || typeof estado.titulos !== "object") estado.titulos = {};
      const temTitulosAdminSalvos = (Number(estado.org_em) || 0) > 0 && Object.keys(estado.titulos).length > 0;
      if (!temTitulosAdminSalvos && !ehAdmin()) {
        estado.titulos = JSON.parse(JSON.stringify(catalogo.titulos_padrao || {}));
      } else {
        for (const [k, v] of Object.entries(catalogo.titulos_padrao || {})) {
          if (!(k in estado.titulos)) {
            estado.titulos[k] = v;
          }
        }
      }
      if (!estado.disciplinas || typeof estado.disciplinas !== "object") estado.disciplinas = {};
      const temDisciplinasAdminSalvas = (Number(estado.org_em) || 0) > 0 && Object.keys(estado.disciplinas).length > 0;
      if (!temDisciplinasAdminSalvas && !ehAdmin()) {
        estado.disciplinas = JSON.parse(JSON.stringify(catalogo.disciplinas_padrao || {}));
      } else {
        for (const [k, v] of Object.entries(catalogo.disciplinas_padrao || {})) {
          if (!(k in estado.disciplinas)) {
            estado.disciplinas[k] = v;
          }
        }
      }
      sincronizarChavesLocaisComEstado();
      salvarEstadoLocal(false);
      await tentarRestaurarPastaProjeto();
    })();
    return prontoPromise;
  }

  // ------------------------------------------------------------------ Cálculo de Domínio (BKT)
  function bktPasso(pAntes, acertou, chute, deslize) {
    const p = Math.min(Math.max(Number(pAntes) || BKT_INICIAL, 0.0001), 0.9999);
    const g = Math.min(Math.max(Number(chute) || 0.25, BKT_PISO_CHUTE), 0.5);
    const s = Math.min(Math.max(Number(deslize) || BKT_ERRO_DISTRACAO, 0.01), 0.4);
    let cond;
    if (acertou) {
      cond = (p * (1 - s)) / (p * (1 - s) + (1 - p) * g);
    } else {
      cond = (p * s) / (p * s + (1 - p) * (1 - g));
    }
    return cond + (1 - cond) * BKT_APRENDE;
  }

  function extrairEstadoProgresso(texto) {
    if (!texto) return {};
    try {
      let d = typeof texto === "string" ? JSON.parse(texto) : texto;
      if (d && typeof d.estado === "string") d = JSON.parse(d.estado);
      return (d && typeof d === "object") ? d : {};
    } catch (e) {
      return {};
    }
  }

  function resumoProgresso(texto) {
    const d = extrairEstadoProgresso(texto);
    const conta = k => (d[k] && typeof d[k] === "object") ? Object.keys(d[k]).length : 0;
    return { aulas: conta("blocos"), testes: conta("t"), questoes: conta("q") };
  }

  function calcularDominioApostila(metaApostila, textoProgresso) {
    if (!metaApostila) return { conceitos: [], media: null, dominados: 0, total: 0 };
    const testes = metaApostila.testes || [];
    const nomes = {};
    for (const c of (metaApostila.conceitos || [])) {
      if (c && c.id) nomes[c.id] = c.nome || c.id;
    }
    const est = extrairEstadoProgresso(textoProgresso);
    const resp = est.t || {};
    const saida = {};

    for (const t of testes) {
      const s = resp[t.id];
      if (!s || typeof s !== "object" || !s.env) continue;
      const nAlt = Number(t.n_alt) || (t.alternativas ? t.alternativas.length : 4) || 4;
      const acertou = (s.r === t.correta) && (parseInt(s.tent || 1, 10) === 1);
      const cid = t.conceito;
      if (!saida[cid]) {
        saida[cid] = { nome: nomes[cid] || cid, p: BKT_INICIAL, acertos: 0, erros: 0, nivel_max: 0 };
      }
      const c = saida[cid];
      const chute = Math.min(Math.max(1.0 / nAlt, BKT_PISO_CHUTE), 0.5);
      const desl = BKT_ERRO_DISTRACAO;
      c.p = bktPasso(c.p, acertou, chute, desl);
      if (acertou) {
        c.acertos += 1;
        c.nivel_max = Math.max(c.nivel_max, parseInt(t.nivel || 0, 10));
      } else {
        c.erros += 1;
      }
    }

    const lista = Object.entries(saida)
      .map(([k, v]) => ({
        conceito: k,
        nome: v.nome,
        p: Math.round(v.p * 1000) / 1000,
        acertos: v.acertos,
        erros: v.erros,
        nivel_max: v.nivel_max,
      }))
      .sort((a, b) => a.p - b.p);

    const dominados = lista.filter(c => c.p >= BKT_DOMINADO).length;
    const media = lista.length
      ? Math.round((lista.reduce((acc, c) => acc + c.p, 0) / lista.length) * 1000) / 1000
      : null;

    return { conceitos: lista, media, dominados, total: lista.length };
  }

  // ------------------------------------------------------------------ Listagem, Pastas e Busca
  function listarMetadadosApostilas() {
    const mapa = new Map();
    const tituloCustom = (pasta, padrao) => {
      const t = estado.titulos && estado.titulos[pasta];
      return (typeof t === "string" && t.trim()) ? t.trim() : padrao;
    };
    const disciplinaCustom = (pasta, padrao) => {
      if (estado.disciplinas && Object.prototype.hasOwnProperty.call(estado.disciplinas, pasta)) {
        return String(estado.disciplinas[pasta] || "").trim();
      }
      return padrao || "";
    };
    for (const a of (catalogo.apostilas || [])) {
      if (estado.excluidas && estado.excluidas[a.pasta]) continue;
      mapa.set(a.pasta, Object.assign({}, a, {
        titulo: tituloCustom(a.pasta, a.titulo),
        disciplina: disciplinaCustom(a.pasta, a.disciplina),
      }));
    }
    for (const [pasta, imp] of Object.entries(apostilasImportadas)) {
      if (estado.excluidas && estado.excluidas[pasta]) continue;
      const f = imp.ficha || {};
      mapa.set(pasta, {
        pasta,
        titulo: tituloCustom(pasta, f.titulo || pasta),
        subtitulo: f.subtitulo || "",
        disciplina: disciplinaCustom(pasta, f.disciplina || ""),
        periodo: f.periodo || "",
        prova: f.prova || "",
        data_aula: f.data_aula || "",
        capitulos: f.capitulos || [],
        contagem: f.contagem || {},
        url: `/interativos/${pasta}/index.html`,
        capa: imp.capaDataUrl || "",
        modificado: imp.modificado || Math.floor(Date.now() / 1000),
        chave_local: imp.chave_local || "",
        conceitos: imp.conceitos || [],
        testes: imp.testes || [],
      });
    }
    return [...mapa.values()];
  }

  function listarApostilasCompleto() {
    sincronizarChavesLocaisComEstado();
    const metas = listarMetadadosApostilas();
    const saida = metas.map(a => {
      const prog = estado.progresso[a.pasta];
      const textoProg = prog && prog.texto ? prog.texto : null;
      const dom = textoProg ? calcularDominioApostila(a, textoProg) : null;
      return {
        pasta: a.pasta,
        titulo: a.titulo,
        subtitulo: a.subtitulo || "",
        disciplina: a.disciplina || "",
        periodo: a.periodo || "",
        prova: a.prova || "",
        data_aula: a.data_aula || "",
        capitulos: a.capitulos || [],
        contagem: a.contagem || {},
        url: a.url,
        capa: a.capa || "",
        progresso_em: prog ? prog.atualizado_em : null,
        progresso: textoProg ? resumoProgresso(textoProg) : {},
        dominio: (dom && dom.total) ? { media: dom.media, dominados: dom.dominados, total: dom.total } : null,
        posicao: estado.posicao[a.pasta] || null,
        modificado: a.modificado || 1,
        chave_local: a.chave_local || "",
      };
    });
    saida.sort((a, b) => String(a.titulo || a.pasta).localeCompare(String(b.titulo || b.pasta), "pt-BR", { numeric: true, sensitivity: "base" }));
    return saida;
  }

  function lerOrganizacaoLimpa() {
    const org = estado.organizacao || { pastas: {}, apostilas: {} };
    const pastas = org.pastas && typeof org.pastas === "object" ? org.pastas : {};
    const apost = org.apostilas && typeof org.apostilas === "object" ? org.apostilas : {};
    for (const p of Object.values(pastas)) {
      if (p.pai && !(p.pai in pastas)) p.pai = null;
    }
    const apostLimpo = {};
    for (const [k, v] of Object.entries(apost)) {
      if (v in pastas) apostLimpo[k] = v;
    }
    estado.organizacao = { pastas, apostilas: apostLimpo };
    return estado.organizacao;
  }

  function semAcento(t) {
    return String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  function buscarEmTodas(termo, limitePorApostila = 6) {
    const t = semAcento((termo || "").trim());
    if (t.length < 2) return [];
    const metas = listarMetadadosApostilas();
    const saida = [];

    for (const a of metas) {
      const ind = apostilasImportadas[a.pasta]
        ? { titulo: a.titulo, secoes: apostilasImportadas[a.pasta].secoes || [] }
        : indiceBusca[a.pasta];
      if (!ind || !Array.isArray(ind.secoes)) continue;
      let total = 0;
      const trechos = [];
      for (const sec of ind.secoes) {
        let texto = String(sec.texto || "");
        const base = semAcento(texto);
        if (base.length !== texto.length) texto = base;
        let pos = 0, n = 0, primeiroIdx = -1;
        while ((pos = base.indexOf(t, pos)) !== -1) {
          if (primeiroIdx === -1) primeiroIdx = pos;
          n++;
          pos += t.length;
        }
        if (!n) continue;
        total += n;
        if (trechos.length < limitePorApostila) {
          const ini = Math.max(0, primeiroIdx - 70);
          const fim = Math.min(texto.length, primeiroIdx + t.length + 90);
          trechos.push({
            hash: sec.hash || "",
            secao: sec.secao || a.titulo,
            vezes: n,
            trecho: (ini ? "…" : "") + texto.slice(ini, fim) + (fim < texto.length ? "…" : ""),
            inicio: primeiroIdx - ini + (ini ? 1 : 0),
            tamanho: t.length,
          });
        }
      }
      if (total > 0) {
        saida.push({ pasta: a.pasta, titulo: a.titulo, total, trechos });
      }
    }
    saida.sort((a, b) => b.total - a.total);
    return saida;
  }

  // ------------------------------------------------------------------ Importação de Apostila no Navegador
  function slug(texto) {
    return semAcento(texto).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "apostila";
  }

  function extrairDadosDeHtmlImportado(html, tituloPadrao) {
    const mCh = /\bconst\s+CH\s*=\s*['"]([^'"]{1,80})['"]/.exec(html);
    const chave_local = mCh ? mCh[1] : "";
    let D = null;
    const mD = /const\s+D\s*=\s*\{/.exec(html);
    if (mD) {
      const inicio = mD.index + mD[0].length - 1;
      // Encontra o fim do objeto JSON de const D
      const fimScript = html.indexOf("\nconst $=", inicio);
      const candidato = fimScript > inicio ? html.slice(inicio, fimScript).trim().replace(/;$/, "") : null;
      if (candidato) {
        try { D = JSON.parse(candidato); } catch (e) {}
      }
    }
    const limpo = s => String(s || "").replace(/<[^>]+>/g, " ").replace(/\*\*/g, "").replace(/\s+/g, " ").trim();
    const conceitos = D ? (D.conceitos || []).filter(c => c && c.id).map(c => ({ id: c.id, nome: c.nome || c.id })) : [];
    const testes = D ? (D.testes || []).filter(t => t && t.id && t.conceito).map(t => ({
      id: t.id,
      conceito: t.conceito,
      nivel: t.nivel || 1,
      correta: t.correta,
      n_alt: (t.alternativas || []).length || 4,
    })) : [];
    const secoes = [];
    if (D) {
      for (const b of (D.blocos || [])) {
        const partes = [limpo(b.titulo)];
        for (const it of (b.seq || [])) {
          if (Array.isArray(it)) {
            for (const x of it.slice(1)) {
              if (typeof x === "string" && !/\.(jpg|png|jpeg|webp)$/i.test(x)) partes.push(limpo(x));
              else if (Array.isArray(x)) for (const y of x) if (typeof y === "string") partes.push(limpo(y));
            }
          }
        }
        secoes.push({ hash: String(b.id || ""), secao: limpo(b.titulo), texto: partes.filter(Boolean).join(" ") });
      }
      for (const q of (D.questoes || [])) {
        const txt = [q.enunciado, ...(q.itens || []), q.resposta_esperada, q.comentario].filter(Boolean).map(limpo).join(" ");
        secoes.push({ hash: String(q.id || ""), secao: limpo(q.ref) || "Questão", texto: txt });
      }
    } else {
      secoes.push({ hash: "", secao: tituloPadrao, texto: limpo(html.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, " ")) });
    }
    return { chave_local, conceitos, testes, secoes };
  }

  async function importarArquivosLocal(formData) {
    const arquivos = formData.getAll("arquivos");
    const soltos = {};
    for (const arq of arquivos) {
      if (!arq || !arq.name) continue;
      const nome = arq.name.split(/[\\/]/).pop();
      soltos[nome] = arq;
    }
    const htmls = Object.keys(soltos).filter(n => /\.(html|htm)$/i.test(n));
    if (!htmls.length) {
      throw new Error("Escolha o arquivo .html da apostila (ex.: index.html).");
    }
    let ficha = null;
    if (soltos["biblioteca.json"]) {
      try {
        ficha = JSON.parse(await soltos["biblioteca.json"].text());
      } catch (e) {
        throw new Error("biblioteca.json não pôde ser lido.");
      }
    }
    const arqHtmlNome = (ficha && ficha.arquivo && soltos[ficha.arquivo])
      ? ficha.arquivo
      : (soltos["index.html"] ? "index.html" : htmls[0]);
    const htmlTexto = await soltos[arqHtmlNome].text();
    if (!/<html/i.test(htmlTexto.slice(0, 5000)) && !/<!doctype/i.test(htmlTexto.slice(0, 500))) {
      throw new Error(`${arqHtmlNome} não parece uma página HTML.`);
    }
    if (!ficha) {
      const mTit = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(htmlTexto.slice(0, 20000));
      const titulo = mTit ? mTit[1].replace(/\s+/g, " ").trim() : arqHtmlNome.replace(/\.(html|htm)$/i, "");
      ficha = { formato: "estuda-jaider-site", versao_formato: 1, id: slug(titulo), titulo };
    }
    const nomePasta = slug(ficha.id || ficha.titulo || arqHtmlNome.replace(/\.(html|htm)$/i, ""));
    const arqCapaNome = Object.keys(soltos).find(n => /\.(jpg|jpeg|png|webp)$/i.test(n));
    let capaDataUrl = "";
    if (arqCapaNome) {
      capaDataUrl = await new Promise(res => {
        const fr = new FileReader();
        fr.onload = () => res(fr.result || "");
        fr.onerror = () => res("");
        fr.readAsDataURL(soltos[arqCapaNome]);
      });
    }
    const novo = !listarMetadadosApostilas().some(a => a.pasta === nomePasta);
    const extra = extrairDadosDeHtmlImportado(htmlTexto, ficha.titulo || nomePasta);
    const registro = {
      pasta: nomePasta,
      ficha,
      html: htmlTexto,
      capaDataUrl,
      modificado: Math.floor(Date.now() / 1000),
      ...extra,
    };
    apostilasImportadas[nomePasta] = registro;
    if (estado.excluidas) delete estado.excluidas[nomePasta];
    await idbSalvarApostila(registro);
    salvarEstadoLocal();
    return { pasta: nomePasta, titulo: ficha.titulo || nomePasta, novo };
  }

  // ------------------------------------------------------------------ Interceptador de Rotas (/api/...)
  function respostaJson(dados, status = 200) {
    return new Response(JSON.stringify(dados), {
      status,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }

  async function tratarRequisicaoApi(urlObj, init) {
    await inicializar();
    const path = urlObj.pathname;
    const metodo = ((init && init.method) || "GET").toUpperCase();
    const lerBodyJson = async () => {
      if (!init || !init.body) return {};
      if (typeof init.body === "string") return JSON.parse(init.body);
      return {};
    };

    // 1. GET /api/interativos
    if (path === "/api/interativos" && metodo === "GET") {
      return respostaJson({
        pasta: "interativos",
        apostilas: listarApostilasCompleto(),
        organizacao: lerOrganizacaoLimpa(),
      });
    }

    // 2. GET /api/interativos-buscar?q=...
    if (path === "/api/interativos-buscar" && metodo === "GET") {
      const q = urlObj.searchParams.get("q") || "";
      return respostaJson({ resultados: buscarEmTodas(q) });
    }

    // 3. POST /api/interativos/importar
    if (path === "/api/interativos/importar" && metodo === "POST") {
      if (!ehAdmin()) return respostaJson({ detail: "Apenas o administrador pode adicionar apostilas." }, 403);
      try {
        const res = await importarArquivosLocal(init.body);
        autoSalvarPastaPCSeConectada();
        return respostaJson(res);
      } catch (e) {
        return respostaJson({ detail: e.message || "Erro ao importar apostila." }, 400);
      }
    }

    // 4. Pastas de organização (/api/interativos-org/...)
    if (path === "/api/interativos-org/pastas" && metodo === "POST") {
      if (!ehAdmin()) return respostaJson({ detail: "Apenas o administrador pode criar pastas." }, 403);
      const b = await lerBodyJson();
      const nome = String(b.nome || "").replace(/\s+/g, " ").trim().slice(0, 80);
      if (!nome) return respostaJson({ detail: "Dê um nome para a pasta." }, 400);
      const org = lerOrganizacaoLimpa();
      const pai = b.pai || null;
      if (pai && !(pai in org.pastas)) return respostaJson({ detail: "Pasta de destino não encontrada." }, 404);
      if (Object.values(org.pastas).some(p => p.nome.toLowerCase() === nome.toLowerCase() && (p.pai || null) === pai)) {
        return respostaJson({ detail: "Já existe uma pasta com esse nome aqui." }, 409);
      }
      const pid = Array.from(crypto.getRandomValues(new Uint8Array(5))).map(x => x.toString(16).padStart(2, "0")).join("");
      org.pastas[pid] = { nome, pai, criada: Math.floor(Date.now() / 1000) };
      estado.org_em = Date.now() / 1000;
      salvarEstadoLocal();
      autoSalvarPastaPCSeConectada();
      return respostaJson({ id: pid, ...org.pastas[pid] });
    }

    const mRen = /^\/api\/interativos-org\/pastas\/([^/]+)\/renomear$/.exec(path);
    if (mRen && metodo === "POST") {
      if (!ehAdmin()) return respostaJson({ detail: "Apenas o administrador pode renomear pastas." }, 403);
      const pid = decodeURIComponent(mRen[1]);
      const b = await lerBodyJson();
      const nome = String(b.nome || "").replace(/\s+/g, " ").trim().slice(0, 80);
      if (!nome) return respostaJson({ detail: "Dê um nome para a pasta." }, 400);
      const org = lerOrganizacaoLimpa();
      if (!(pid in org.pastas)) return respostaJson({ detail: "Pasta não encontrada." }, 404);
      org.pastas[pid].nome = nome;
      estado.org_em = Date.now() / 1000;
      salvarEstadoLocal();
      autoSalvarPastaPCSeConectada();
      return respostaJson(org);
    }

    const mExcPasta = /^\/api\/interativos-org\/pastas\/([^/]+)\/excluir$/.exec(path);
    if (mExcPasta && metodo === "POST") {
      if (!ehAdmin()) return respostaJson({ detail: "Apenas o administrador pode excluir pastas." }, 403);
      const pid = decodeURIComponent(mExcPasta[1]);
      const org = lerOrganizacaoLimpa();
      const p = org.pastas[pid];
      if (!p) return respostaJson({ detail: "Pasta não encontrada." }, 404);
      delete org.pastas[pid];
      const pai = p.pai || null;
      for (const q of Object.values(org.pastas)) {
        if (q.pai === pid) q.pai = pai;
      }
      for (const [k, v] of Object.entries(org.apostilas)) {
        if (v === pid) {
          if (pai) org.apostilas[k] = pai;
          else delete org.apostilas[k];
        }
      }
      delete estado.aparencia["apost:" + pid];
      estado.org_em = Date.now() / 1000;
      salvarEstadoLocal();
      autoSalvarPastaPCSeConectada();
      return respostaJson(org);
    }

    if (path === "/api/interativos-org/mover" && metodo === "POST") {
      if (!ehAdmin()) return respostaJson({ detail: "Apenas o administrador pode mover itens." }, 403);
      const b = await lerBodyJson();
      const org = lerOrganizacaoLimpa();
      const destino = b.destino || null;
      if (destino && !(destino in org.pastas)) return respostaJson({ detail: "Pasta de destino não encontrada." }, 404);
      for (const a of (b.apostilas || [])) {
        if (destino) org.apostilas[a] = destino;
        else delete org.apostilas[a];
      }
      const dentroDe = (idPasta, ancestral) => {
        const vistos = new Set();
        let cur = idPasta;
        while (cur && !vistos.has(cur)) {
          if (cur === ancestral) return true;
          vistos.add(cur);
          cur = (org.pastas[cur] || {}).pai;
        }
        return false;
      };
      for (const pid of (b.pastas || [])) {
        if (!(pid in org.pastas)) return respostaJson({ detail: "Pasta não encontrada." }, 404);
        if (destino && dentroDe(destino, pid)) {
          return respostaJson({ detail: "Não dá para mover uma pasta para dentro dela mesma." }, 400);
        }
        org.pastas[pid].pai = destino;
      }
      estado.org_em = Date.now() / 1000;
      salvarEstadoLocal();
      autoSalvarPastaPCSeConectada();
      return respostaJson(org);
    }

    // 5. Rotas de uma apostila específica: /api/interativos/<pasta>/<acao>
    const mAp = /^\/api\/interativos\/([^/]+)\/(progresso|posicao|anotacoes|dominio|recomecar|excluir|renomear)$/.exec(path);
    if (mAp) {
      const pasta = decodeURIComponent(mAp[1]);
      const acao = mAp[2];
      const meta = listarMetadadosApostilas().find(x => x.pasta === pasta);

      if (acao === "progresso") {
        if (metodo === "GET") {
          sincronizarChavesLocaisComEstado();
          const p = estado.progresso[pasta];
          return respostaJson({ texto: p ? p.texto : null });
        }
        if (metodo === "POST") {
          const b = await lerBodyJson();
          const texto = String(b.texto || "");
          estado.progresso[pasta] = { atualizado_em: Date.now() / 1000, texto };
          if (meta && meta.chave_local) {
            try {
              const obj = extrairEstadoProgresso(texto);
              if (obj && Object.keys(obj).length) localStorage.setItem(meta.chave_local, JSON.stringify(obj));
            } catch (e) {}
          }
          salvarEstadoLocal();
          return respostaJson({ ok: true });
        }
      }

      if (acao === "posicao") {
        if (metodo === "GET") {
          return respostaJson({ posicao: estado.posicao[pasta] || null });
        }
        if (metodo === "POST") {
          const b = await lerBodyJson();
          const pos = {
            atualizado_em: Date.now() / 1000,
            hash: String(b.hash || "").slice(0, 200),
            titulo: String(b.titulo || "").slice(0, 200),
            pct: Math.max(0, Math.min(100, Math.round(Number(b.pct) || 0))),
            y: Math.max(0, Math.min(1, Number(b.y) || 0)),
          };
          estado.posicao[pasta] = pos;
          salvarEstadoLocal();
          return respostaJson({ ok: true, posicao: pos });
        }
      }

      if (acao === "anotacoes") {
        if (metodo === "GET") {
          const reg = estado.anotacoes[pasta];
          return respostaJson({ itens: (reg && reg.itens) ? reg.itens : {} });
        }
        if (metodo === "POST") {
          const b = await lerBodyJson();
          const lista = Array.isArray(b.itens) ? b.itens : [];
          if (!estado.anotacoes[pasta]) estado.anotacoes[pasta] = { atualizado_em: 0, itens: {} };
          const juntas = estado.anotacoes[pasta].itens;
          for (const it of lista) {
            if (!it || typeof it.id !== "string") continue;
            const atual = juntas[it.id];
            if (!atual || (Number(it.atualizado_em) || 0) >= (Number(atual.atualizado_em) || 0)) {
              juntas[it.id] = it;
            }
          }
          estado.anotacoes[pasta].atualizado_em = Date.now() / 1000;
          salvarEstadoLocal();
          return respostaJson({ ok: true, total: Object.keys(juntas).length });
        }
      }

      if (acao === "dominio" && metodo === "GET") {
        sincronizarChavesLocaisComEstado();
        const prog = estado.progresso[pasta];
        if (!prog || !prog.texto || !meta) {
          return respostaJson({ conceitos: [], media: null, dominados: 0, total: 0 });
        }
        return respostaJson(calcularDominioApostila(meta, prog.texto));
      }

      if (acao === "recomecar" && metodo === "POST") {
        delete estado.progresso[pasta];
        delete estado.posicao[pasta];
        const chave = meta ? (meta.chave_local || "") : "";
        if (chave) {
          try { localStorage.removeItem(chave); } catch (e) {}
        }
        salvarEstadoLocal();
        return respostaJson({ ok: true, arquivos_apagados: 1, chave_local: chave });
      }

      if (acao === "renomear" && metodo === "POST") {
        if (!ehAdmin()) return respostaJson({ detail: "Apenas o administrador pode renomear apostilas." }, 403);
        if (!meta) return respostaJson({ detail: "Apostila não encontrada." }, 404);
        const b = await lerBodyJson();
        const titulo = String(b.titulo ?? b.nome ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
        if (!titulo) return respostaJson({ detail: "Dê um nome para a apostila." }, 400);
        const temDisc = Object.prototype.hasOwnProperty.call(b, "disciplina");
        const disciplina = temDisc ? String(b.disciplina ?? "").replace(/\s+/g, " ").trim().slice(0, 60) : (meta.disciplina || "");
        if (!estado.titulos || typeof estado.titulos !== "object") estado.titulos = {};
        estado.titulos[pasta] = titulo;
        if (temDisc) {
          if (!estado.disciplinas || typeof estado.disciplinas !== "object") estado.disciplinas = {};
          estado.disciplinas[pasta] = disciplina;
        }
        if (apostilasImportadas[pasta]) {
          if (!apostilasImportadas[pasta].ficha) apostilasImportadas[pasta].ficha = {};
          apostilasImportadas[pasta].ficha.titulo = titulo;
          if (temDisc) apostilasImportadas[pasta].ficha.disciplina = disciplina;
          await idbSalvarApostila(apostilasImportadas[pasta]);
        }
        const itemCat = (catalogo.apostilas || []).find(x => x.pasta === pasta);
        if (itemCat) {
          itemCat.titulo = titulo;
          if (temDisc) itemCat.disciplina = disciplina;
        }
        if (indiceBusca && indiceBusca[pasta]) indiceBusca[pasta].titulo = titulo;
        estado.org_em = Date.now() / 1000;
        salvarEstadoLocal();
        autoSalvarPastaPCSeConectada();
        return respostaJson({ ok: true, pasta, titulo, disciplina });
      }

      if (acao === "excluir" && metodo === "POST") {
        if (!ehAdmin()) return respostaJson({ detail: "Apenas o administrador pode excluir apostilas." }, 403);
        delete estado.progresso[pasta];
        delete estado.posicao[pasta];
        delete estado.anotacoes[pasta];
        if (estado.titulos) delete estado.titulos[pasta];
        if (estado.disciplinas) delete estado.disciplinas[pasta];
        if (estado.organizacao && estado.organizacao.apostilas) {
          delete estado.organizacao.apostilas[pasta];
        }
        if (apostilasImportadas[pasta]) {
          delete apostilasImportadas[pasta];
          await idbApagarApostila(pasta);
        } else {
          if (!estado.excluidas) estado.excluidas = {};
          estado.excluidas[pasta] = Date.now() / 1000;
        }
        if (meta && meta.chave_local) {
          try { localStorage.removeItem(meta.chave_local); } catch (e) {}
        }
        estado.org_em = Date.now() / 1000;
        salvarEstadoLocal();
        autoSalvarPastaPCSeConectada();
        return respostaJson({ ok: true, pasta, registros_apagados: 1 });
      }
    }

    // 6. Aparência das pastas (/api/pastas-aparencia*)
    if (path === "/api/pastas-aparencia" && metodo === "GET") {
      return respostaJson({ pastas: estado.aparencia || {} });
    }

    if (path === "/api/pastas-aparencia" && metodo === "POST") {
      if (!ehAdmin()) return respostaJson({ detail: "Apenas o administrador pode personalizar pastas." }, 403);
      const b = await lerBodyJson();
      const chave = String(b.chave || "").trim();
      if (!chave) return respostaJson({ detail: "Pasta inválida." }, 400);
      if (b.restaurar) {
        delete estado.aparencia[chave];
      } else {
        const a = estado.aparencia[chave] || {};
        a.cor = b.cor || "";
        if (b.remover_capa) {
          delete a.capa;
          a.sem_capa = true;
        }
        a.atualizado_em = new Date().toISOString().slice(0, 19);
        estado.aparencia[chave] = a;
      }
      estado.org_em = Date.now() / 1000;
      salvarEstadoLocal();
      autoSalvarPastaPCSeConectada();
      return respostaJson({ chave, aparencia: estado.aparencia[chave] || {} });
    }

    if (path === "/api/pastas-aparencia/capa" && metodo === "POST") {
      if (!ehAdmin()) return respostaJson({ detail: "Apenas o administrador pode personalizar pastas." }, 403);
      const fd = init.body;
      const chave = String(fd.get("chave") || "").trim();
      const cor = String(fd.get("cor") || "").trim();
      const arquivo = fd.get("arquivo");
      if (!chave || !arquivo) return respostaJson({ detail: "Dados inválidos." }, 400);
      const dataUrl = await new Promise((res, rej) => {
        const fr = new FileReader();
        fr.onload = () => res(fr.result);
        fr.onerror = () => rej(new Error("Erro ao ler imagem."));
        fr.readAsDataURL(arquivo);
      });
      const ext = (arquivo.type === "image/gif") ? ".gif" : (arquivo.type === "image/png" ? ".png" : ".webp");
      const hash = Array.from(crypto.getRandomValues(new Uint8Array(10))).map(x => x.toString(16).padStart(2, "0")).join("") + ext;
      registrarCapaLocal(hash, dataUrl);
      const a = estado.aparencia[chave] || {};
      a.capa = hash;
      delete a.sem_capa;
      if (cor) a.cor = cor;
      a.atualizado_em = new Date().toISOString().slice(0, 19);
      estado.aparencia[chave] = a;
      estado.org_em = Date.now() / 1000;
      salvarEstadoLocal();
      autoSalvarPastaPCSeConectada();
      return respostaJson({ chave, aparencia: a });
    }

    const mCapa = /^\/api\/pastas-aparencia\/capa\/(.+)$/.exec(path);
    if (mCapa && metodo === "GET") {
      const nome = decodeURIComponent(mCapa[1]);
      if ( nome.startsWith("data:") ) {
        return fetchNativo(nome);
      }
      const localData = obterDataUrlCapaLocal(nome);
      if (localData) {
        return fetchNativo(localData);
      }
      return fetchNativo(`/capas_pastas/${encodeURIComponent(nome)}`);
    }

    return respostaJson({ detail: "Rota não encontrada: " + path }, 404);
  }

  // Substitui window.fetch para interceptar /api/... e URLs de capas de pastas
  window.fetch = function (input, init) {
    try {
      const urlStr = typeof input === "string" ? input : (input && input.url ? input.url : String(input));
      const urlObj = new URL(urlStr, window.location.origin);
      if (urlObj.origin === window.location.origin && urlObj.pathname.startsWith("/api/")) {
        return tratarRequisicaoApi(urlObj, init);
      }
    } catch (e) {}
    return fetchNativo(input, init);
  };

  // Também ajusta PastaVisual quando a capa é data:URL ou arquivo em /capas_pastas/
  // Como o SVG do PastaVisual faz <image href="/api/pastas-aparencia/capa/..."> e <image> num SVG não passa por window.fetch,
  // reescrevemos qualquer <image href="/api/pastas-aparencia/capa/..."> para apontar direto para /capas_pastas/<nome> ou para o dataURL!
  function corrigirImagensPastaVisual(raiz) {
    (raiz || document).querySelectorAll('image[href^="/api/pastas-aparencia/capa/"]').forEach(img => {
      const href = img.getAttribute("href") || "";
      const nome = decodeURIComponent(href.replace("/api/pastas-aparencia/capa/", ""));
      if (nome.startsWith("data:")) {
        img.setAttribute("href", nome);
      } else {
        const localData = obterDataUrlCapaLocal(nome);
        if (localData) {
          img.setAttribute("href", localData);
        } else {
          img.setAttribute("href", `/capas_pastas/${nome}`);
        }
      }
    });
  }

  new MutationObserver(() => corrigirImagensPastaVisual()).observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["href"],
  });

  // ------------------------------------------------------------------ Ponte com o iframe da Apostila
  // 1. Faz o iframe usar o mesmo window.fetch interceptado (para o Estojo salvar anotações)
  // 2. Esconde qualquer botão/menção de IA (#ia, #iast) dentro da apostila
  // 3. Intercepta localStorage.setItem(CH, ...) dentro do iframe para atualizar o progresso e o domínio BKT na hora!
  function conectarQuadroApostila(iframe, apostilaMeta) {
    if (!iframe || !iframe.contentWindow) return;
    const w = iframe.contentWindow;
    const doc = iframe.contentDocument;

    // Se for uma apostila importada localmente pelo usuário (não existe arquivo estático no servidor), injeta o HTML dela
    if (apostilaMeta && apostilasImportadas[apostilaMeta.pasta] && (!doc || doc.title === "" || doc.body?.innerHTML.includes("404"))) {
      // Tratado antes de definir iframe.src via Blob URL
    }

    try {
      w.fetch = window.fetch.bind(window);
    } catch (e) {}

    // Esconde qualquer elemento de IA dentro da apostila
    if (doc && doc.head && !doc.getElementById("ej-sem-ia-css")) {
      const st = doc.createElement("style");
      st.id = "ej-sem-ia-css";
      st.textContent = `#ia, #iast, [data-ia] { display: none !important; }`;
      doc.head.appendChild(st);
    }

    // Intercepta salvamentos no localStorage da apostila (const CH = 'utero2-1a-v6', etc.)
    if (apostilaMeta && !w.__ejStorageHooked) {
      w.__ejStorageHooked = true;
      const pasta = apostilaMeta.pasta;
      const metaCat = listarMetadadosApostilas().find(x => x.pasta === pasta);
      const chaveAlvo = (metaCat && metaCat.chave_local) || apostilaMeta.chave_local || "";

      try {
        const setItemOrig = w.Storage.prototype.setItem;
        w.Storage.prototype.setItem = function (k, v) {
          setItemOrig.call(this, k, v);
          if ((chaveAlvo && k === chaveAlvo) || (!chaveAlvo && typeof v === "string" && v.includes('"blocos"') && v.includes('"rev"'))) {
            estado.progresso[pasta] = {
              atualizado_em: Date.now() / 1000,
              texto: String(v),
            };
            salvarEstadoLocal();
            window.dispatchEvent(new CustomEvent("ej-progresso-apostila-salvo", { detail: { pasta } }));
          }
        };
      } catch (e) {}
    }
  }

  // Retorna URL para abrir no iframe (suporta tanto apostilas do catálogo quanto importadas no IndexedDB via Blob URL)
  const blobUrls = {};
  function urlParaQuadro(apostila) {
    if (!apostila) return "about:blank";
    const imp = apostilasImportadas[apostila.pasta];
    if (imp && imp.html) {
      if (blobUrls[apostila.pasta]) URL.revokeObjectURL(blobUrls[apostila.pasta]);
      const blob = new Blob([imp.html], { type: "text/html;charset=utf-8" });
      blobUrls[apostila.pasta] = URL.createObjectURL(blob);
      return blobUrls[apostila.pasta];
    }
    return apostila.url + "?v=" + (apostila.modificado || "");
  }

  // ------------------------------------------------------------------ Google Login & Google Drive Sync
  let contaGoogle = (() => {
    try { return JSON.parse(localStorage.getItem(CHAVE_CONTA) || "null"); } catch (e) { return null; }
  })();
  let tokenAcesso = (contaGoogle && contaGoogle.access_token && contaGoogle.expira_em > Date.now() + 60000)
    ? contaGoogle.access_token
    : null;
  let tokenClient = null;
  let idArquivoDrive = (contaGoogle && contaGoogle.drive_file_id) || null;
  let timerSyncDrive = 0;
  let sincronizando = false;
  let syncPendente = false;
  let statusSync = tokenAcesso ? "conectado" : "local"; // "local" | "conectado" | "sincronizando" | "salvo" | "erro"
  let msgErroSync = "";

  function obterClientId() {
    try {
      return (localStorage.getItem(CHAVE_CLIENT_ID) || "").trim() || window.EJ_GOOGLE_CLIENT_ID || CLIENT_ID_PADRAO;
    } catch (e) {
      return CLIENT_ID_PADRAO;
    }
  }

  function definirClientId(novoId) {
    const limpo = String(novoId || "").trim();
    try {
      if (limpo) localStorage.setItem(CHAVE_CLIENT_ID, limpo);
      else localStorage.removeItem(CHAVE_CLIENT_ID);
    } catch (e) {}
    tokenClient = null;
  }

  function obterUrlControleVagas() {
    try {
      return (localStorage.getItem(CHAVE_WEBHOOK_VAGAS) || "").trim() || window.EJ_WEBHOOK_VAGAS_URL || URL_CONTROLE_VAGAS_PADRAO;
    } catch (e) {
      return URL_CONTROLE_VAGAS_PADRAO;
    }
  }

  function definirUrlControleVagas(novaUrl) {
    const limpo = String(novaUrl || "").trim();
    try {
      if (limpo) localStorage.setItem(CHAVE_WEBHOOK_VAGAS, limpo);
      else localStorage.removeItem(CHAVE_WEBHOOK_VAGAS);
    } catch (e) {}
  }

  // Verifica e registra o aluno na Planilha Google (Google Apps Script) com limite de 50 vagas
  async function verificarVagaNaPlanilha(perfil) {
    const urlWebhook = obterUrlControleVagas();
    if (!urlWebhook) return { autorizado: true };
    try {
      const r = await fetchNativo(urlWebhook, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          email: (perfil.email || "").trim().toLowerCase(),
          nome: perfil.nome || "Estudante",
          foto: perfil.foto || "",
          limite: LIMITE_VAGAS_PADRAO,
          origem: location.origin,
        }),
      });
      if (!r.ok) return { autorizado: true };
      const d = await r.json();
      if (d && d.autorizado === false) {
        return {
          autorizado: false,
          mensagem: d.mensagem || `Limite de ${LIMITE_VAGAS_PADRAO} vagas atingido. Peça liberação ao administrador.`,
        };
      }
      return { autorizado: true, vaga: d.vaga, total: d.total };
    } catch (e) {
      console.warn("Aviso ao consultar planilha de vagas:", e);
      return { autorizado: true };
    }
  }

  function notificarStatusUI() {
    window.dispatchEvent(new CustomEvent("ej-sync-status", {
      detail: {
        status: statusSync,
        erro: msgErroSync,
        conta: contaGoogle ? {
          nome: contaGoogle.nome,
          email: contaGoogle.email,
          foto: contaGoogle.foto,
        } : null,
        conectado: !!tokenAcesso,
      }
    }));
  }

  function carregarScriptGIS() {
    return new Promise((resolve, reject) => {
      if (window.google && window.google.accounts && window.google.accounts.oauth2) {
        return resolve();
      }
      let s = document.getElementById("ej-gis-script");
      if (!s) {
        s = document.createElement("script");
        s.id = "ej-gis-script";
        s.src = "https://accounts.google.com/gsi/client";
        s.async = true;
        s.defer = true;
        document.head.appendChild(s);
      }
      s.addEventListener("load", () => resolve());
      s.addEventListener("error", () => reject(new Error("Não foi possível carregar o login do Google (verifique sua conexão).")));
    });
  }

  async function entrarComGoogle(opcoes = {}) {
    await carregarScriptGIS();
    const clientId = obterClientId();
    return new Promise((resolve, reject) => {
      try {
        tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: ESCOPOS_DRIVE,
          prompt: opcoes.silencioso ? "" : "select_account",
          callback: async (resp) => {
            if (resp.error) {
              if (!opcoes.silencioso) {
                statusSync = "erro";
                msgErroSync = resp.error_description || resp.error;
                notificarStatusUI();
              }
              return reject(new Error(resp.error_description || resp.error));
            }
            if (typeof opcoes.aoAutenticar === "function") {
              try { opcoes.aoAutenticar(); } catch (e) {}
            }
            tokenAcesso = resp.access_token;
            const expiraEm = Date.now() + (Number(resp.expires_in || 3599) * 1000);
            let perfil = contaGoogle || {};
            try {
              const r = await fetchNativo("https://www.googleapis.com/oauth2/v3/userinfo", {
                headers: { Authorization: `Bearer ${tokenAcesso}` },
              });
              if (r.ok) {
                const u = await r.json();
                perfil = {
                  nome: u.name || u.given_name || u.email || "Estudante",
                  email: u.email || "",
                  foto: u.picture || "",
                };
              }
            } catch (e) {}

            // Verifica se o e-mail tem vaga na planilha (limite de 50 usuários ativos)
            const checkVaga = await verificarVagaNaPlanilha(perfil);
            if (!checkVaga.autorizado) {
              try { window.google.accounts.oauth2.revoke(tokenAcesso, () => {}); } catch (e) {}
              tokenAcesso = null;
              contaGoogle = null;
              try { localStorage.removeItem(CHAVE_CONTA); } catch (e) {}
              statusSync = "erro";
              msgErroSync = checkVaga.mensagem;
              notificarStatusUI();
              return reject(new Error(checkVaga.mensagem));
            }

            contaGoogle = {
              ...perfil,
              access_token: tokenAcesso,
              expira_em: expiraEm,
              drive_file_id: idArquivoDrive,
            };
            try { localStorage.setItem(CHAVE_CONTA, JSON.stringify(contaGoogle)); } catch (e) {}
            statusSync = "conectado";
            msgErroSync = "";
            notificarStatusUI();
            await sincronizarComDriveAgora();
            resolve(contaGoogle);
          },
          error_callback: (err) => {
            if (!opcoes.silencioso) {
              statusSync = "erro";
              msgErroSync = (err && err.message) || "Janela de login fechada ou bloqueada.";
              notificarStatusUI();
            }
            reject(new Error((err && err.message) || "Login cancelado."));
          },
        });
        tokenClient.requestAccessToken({ prompt: opcoes.silencioso ? "" : "select_account" });
      } catch (e) {
        reject(e);
      }
    });
  }

  function sairDoGoogle() {
    if (tokenAcesso && window.google?.accounts?.oauth2) {
      try { window.google.accounts.oauth2.revoke(tokenAcesso, () => {}); } catch (e) {}
    }
    tokenAcesso = null;
    contaGoogle = null;
    idArquivoDrive = null;
    try { localStorage.removeItem(CHAVE_CONTA); } catch (e) {}
    statusSync = "local";
    msgErroSync = "";
    notificarStatusUI();
  }

  // Mescla inteligente entre os dados locais e os dados do Google Drive do aluno
  function mesclarEstados(local, remoto) {
    if (!remoto || typeof remoto !== "object") return false;
    let mudouLocal = false;

    // 1. Organização e aparência de pastas: apenas no Modo Admin mescla alterações locais; para o aluno vale sempre o catalogo.json oficial
    if (ehAdmin()) {
      if ((Number(remoto.org_em) || 0) > (Number(local.org_em) || 0) && remoto.organizacao) {
        local.organizacao = JSON.parse(JSON.stringify(remoto.organizacao));
        local.org_em = Number(remoto.org_em);
        if (remoto.titulos && typeof remoto.titulos === "object") {
          local.titulos = Object.assign({}, local.titulos || {}, remoto.titulos);
        }
        if (remoto.disciplinas && typeof remoto.disciplinas === "object") {
          local.disciplinas = Object.assign({}, local.disciplinas || {}, remoto.disciplinas);
        }
        mudouLocal = true;
      }
      if (remoto.capas_custom && typeof remoto.capas_custom === "object") {
        if (!local.capas_custom) local.capas_custom = {};
        for (const [k, v] of Object.entries(remoto.capas_custom)) {
          if (!local.capas_custom[k]) {
            local.capas_custom[k] = v;
            mudouLocal = true;
          }
        }
      }
      const tsNum = (v) => {
        if (v == null || v === "") return 0;
        const n = Number(v);
        if (!Number.isNaN(n) && n > 0) return n > 1e12 ? n / 1000 : n;
        const parsed = Date.parse(String(v));
        return Number.isNaN(parsed) ? 0 : parsed / 1000;
      };
      if (remoto.aparencia && typeof remoto.aparencia === "object") {
        if (!local.aparencia) local.aparencia = {};
        for (const [chave, apRem] of Object.entries(remoto.aparencia)) {
          const apLoc = local.aparencia[chave];
          if (!apLoc || tsNum(apRem.atualizado_em) > tsNum(apLoc.atualizado_em)) {
            local.aparencia[chave] = JSON.parse(JSON.stringify(apRem));
            mudouLocal = true;
          }
        }
      }
    }

    // 3. Progresso por apostila (vale o atualizado_em maior)
    if (remoto.progresso && typeof remoto.progresso === "object") {
      for (const [pasta, progRem] of Object.entries(remoto.progresso)) {
        const progLoc = local.progresso[pasta];
        if (!progLoc || (Number(progRem.atualizado_em) || 0) > (Number(progLoc.atualizado_em) || 0)) {
          local.progresso[pasta] = JSON.parse(JSON.stringify(progRem));
          mudouLocal = true;
        }
      }
    }

    // 4. Posição de leitura por apostila (vale o atualizado_em maior)
    if (remoto.posicao && typeof remoto.posicao === "object") {
      for (const [pasta, posRem] of Object.entries(remoto.posicao)) {
        const posLoc = local.posicao[pasta];
        if (!posLoc || (Number(posRem.atualizado_em) || 0) > (Number(posLoc.atualizado_em) || 0)) {
          local.posicao[pasta] = JSON.parse(JSON.stringify(posRem));
          mudouLocal = true;
        }
      }
    }

    // 5. Anotações do Estojo (mescladas item a item pelo `atualizado_em` de cada marca/nota/traço/adesivo!)
    if (remoto.anotacoes && typeof remoto.anotacoes === "object") {
      for (const [pasta, anotRem] of Object.entries(remoto.anotacoes)) {
        if (!anotRem || typeof anotRem.itens !== "object") continue;
        if (!local.anotacoes[pasta]) local.anotacoes[pasta] = { atualizado_em: 0, itens: {} };
        const itensLoc = local.anotacoes[pasta].itens;
        for (const [iid, itRem] of Object.entries(anotRem.itens)) {
          const itLoc = itensLoc[iid];
          if (!itLoc || (Number(itRem.atualizado_em) || 0) > (Number(itLoc.atualizado_em) || 0)) {
            itensLoc[iid] = JSON.parse(JSON.stringify(itRem));
            mudouLocal = true;
          }
        }
        local.anotacoes[pasta].atualizado_em = Math.max(
          Number(local.anotacoes[pasta].atualizado_em) || 0,
          Number(anotRem.atualizado_em) || 0
        );
      }
    }

    // 6. Banco de Questões (mesclado item a item pelo `atualizado_em` de cada questão)
    if (remoto.banco_questoes && typeof remoto.banco_questoes === "object") {
      if (!local.banco_questoes || typeof local.banco_questoes !== "object") local.banco_questoes = {};
      for (const [uid, qRem] of Object.entries(remoto.banco_questoes)) {
        if (!qRem || typeof qRem !== "object") continue;
        const qLoc = local.banco_questoes[uid];
        if (!qLoc || (Number(qRem.atualizado_em) || 0) > (Number(qLoc.atualizado_em) || 0)) {
          local.banco_questoes[uid] = JSON.parse(JSON.stringify(qRem));
          mudouLocal = true;
        }
      }
    }

    if (mudouLocal) {
      sincronizarChavesLocaisComEstado();
      salvarEstadoLocal(false);
      window.dispatchEvent(new CustomEvent("ej-banco-questoes-sync"));
    }
    return mudouLocal;
  }

  async function buscarArquivoNoDrive() {
    if (idArquivoDrive) return idArquivoDrive;
    const q = encodeURIComponent(`name = '${ARQUIVO_DRIVE}' and 'appDataFolder' in parents and trashed = false`);
    const r = await fetchNativo(`https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${q}&fields=files(id,name,modifiedTime)`, {
      headers: { Authorization: `Bearer ${tokenAcesso}` },
    });
    if (r.status === 401) {
      tokenAcesso = null;
      throw new Error("Sessão do Google expirada. Entre novamente.");
    }
    if (!r.ok) throw new Error("Erro ao consultar Google Drive (" + r.status + ").");
    const d = await r.json();
    const arq = (d.files && d.files[0]) || null;
    if (arq) {
      idArquivoDrive = arq.id;
      if (contaGoogle) {
        contaGoogle.drive_file_id = idArquivoDrive;
        try { localStorage.setItem(CHAVE_CONTA, JSON.stringify(contaGoogle)); } catch (e) {}
      }
    }
    return idArquivoDrive;
  }

  async function baixarEstadoDoDrive(fileId) {
    const r = await fetchNativo(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`, {
      headers: { Authorization: `Bearer ${tokenAcesso}` },
    });
    if (!r.ok) return null;
    try { return await r.json(); } catch (e) { return null; }
  }

  async function enviarEstadoParaDrive() {
    const conteudo = JSON.stringify(estado);
    const metadados = idArquivoDrive
      ? { name: ARQUIVO_DRIVE }
      : { name: ARQUIVO_DRIVE, parents: ["appDataFolder"] };

    const boundary = "-------EstudaJaiderDriveBoundary" + Date.now();
    const corpo =
      `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify(metadados)}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${conteudo}\r\n` +
      `--${boundary}--`;

    const url = idArquivoDrive
      ? `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(idArquivoDrive)}?uploadType=multipart&fields=id`
      : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id`;

    const r = await fetchNativo(url, {
      method: idArquivoDrive ? "PATCH" : "POST",
      headers: {
        Authorization: `Bearer ${tokenAcesso}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body: corpo,
    });

    if (r.status === 401) {
      tokenAcesso = null;
      throw new Error("Sessão do Google expirada.");
    }
    if (!r.ok) {
      throw new Error("Erro ao salvar no Google Drive (" + r.status + ").");
    }
    const d = await r.json();
    if (d && d.id) {
      idArquivoDrive = d.id;
      if (contaGoogle) {
        contaGoogle.drive_file_id = idArquivoDrive;
        try { localStorage.setItem(CHAVE_CONTA, JSON.stringify(contaGoogle)); } catch (e) {}
      }
    }
  }

  async function sincronizarComDriveAgora() {
    if (!tokenAcesso) return false;
    if (sincronizando) {
      syncPendente = true;
      return false;
    }
    sincronizando = true;
    statusSync = "sincronizando";
    notificarStatusUI();

    try {
      await inicializar();
      sincronizarChavesLocaisComEstado();
      const fid = await buscarArquivoNoDrive();
      let mudouLocal = false;
      if (fid) {
        const remoto = await baixarEstadoDoDrive(fid);
        if (remoto) {
          mudouLocal = mesclarEstados(estado, remoto);
        }
      }
      await enviarEstadoParaDrive();
      statusSync = "salvo";
      msgErroSync = "";
      notificarStatusUI();
      if (mudouLocal) {
        if (window.PastaVisual) window.PastaVisual.carregar(true);
        if (window.interativos) window.interativos.carregar();
      }
      return true;
    } catch (e) {
      console.warn("Sincronização Google Drive:", e);
      statusSync = "erro";
      msgErroSync = e.message || "Falha ao sincronizar com o Google Drive.";
      notificarStatusUI();
      return false;
    } finally {
      sincronizando = false;
      if (syncPendente) {
        syncPendente = false;
        agendarSincronizacaoDrive(1500);
      }
    }
  }

  function agendarSincronizacaoDrive(ms = 2500) {
    if (!tokenAcesso) return;
    clearTimeout(timerSyncDrive);
    timerSyncDrive = setTimeout(() => {
      sincronizarComDriveAgora();
    }, ms);
  }

  // Exportar / Importar arquivo de backup JSON manual (para compartilhar ou guardar cópia local)
  function exportarBackupJson() {
    sincronizarChavesLocaisComEstado();
    const blob = new Blob([JSON.stringify(estado, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `estuda-jaider-progresso-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function importarBackupJson(arquivo) {
    const texto = await arquivo.text();
    const dados = JSON.parse(texto);
    if (!dados || typeof dados !== "object") throw new Error("Arquivo de backup inválido.");
    mesclarEstados(estado, dados);
    salvarEstadoLocal(true);
    if (window.PastaVisual) window.PastaVisual.carregar(true);
    if (window.interativos) window.interativos.carregar();
  }

  // ------------------------------------------------------------------ Integração com Banco de Questões
  function obterEstadoBancoQuestoes() {
    sincronizarChavesLocaisComEstado();
    if (!estado.banco_questoes || typeof estado.banco_questoes !== "object") {
      estado.banco_questoes = {};
    }
    const combinado = {};
    // 1. Puxa testes já respondidos dentro das apostilas (estado.progresso)
    const metas = listarMetadadosApostilas();
    for (const a of metas) {
      const prog = estado.progresso[a.pasta];
      if (!prog || !prog.texto) continue;
      const est = extrairEstadoProgresso(prog.texto);
      const respT = (est && est.t && typeof est.t === "object") ? est.t : {};
      const mapaTestes = {};
      for (const t of (a.testes || [])) {
        if (t && t.id) mapaTestes[t.id] = t;
      }
      for (const [tid, s] of Object.entries(respT)) {
        if (!s || typeof s !== "object" || !s.env) continue;
        const uid = `${a.pasta}::t::${tid}`;
        const tMeta = mapaTestes[tid];
        const acertou = tMeta ? (s.r === tMeta.correta) : false;
        combinado[uid] = {
          status: acertou ? "acertou" : "errou",
          escolha: typeof s.r === "number" ? s.r : null,
          tentativas: parseInt(s.tent || 1, 10) || 1,
          acertos: acertou ? 1 : 0,
          erros: acertou ? 0 : 1,
          favorita: false,
          riscadas: [],
          atualizado_em: Number(prog.atualizado_em) || 0,
          origem: "apostila",
        };
      }
    }
    // 2. Sobrepõe com o histórico próprio do Banco de Questões (que guarda favoritas, riscadas, provas e tentativas)
    for (const [uid, item] of Object.entries(estado.banco_questoes)) {
      if (!item || typeof item !== "object") continue;
      const base = combinado[uid];
      if (!base) {
        combinado[uid] = Object.assign({}, item);
      } else {
        const usarBanco = (Number(item.atualizado_em) || 0) >= (Number(base.atualizado_em) || 0);
        combinado[uid] = Object.assign({}, usarBanco ? base : item, usarBanco ? item : base, {
          favorita: !!(item.favorita),
          riscadas: Array.isArray(item.riscadas) ? item.riscadas.slice() : [],
        });
      }
    }
    return combinado;
  }

  function salvarItemBancoQuestao(uid, dados, metaTeste) {
    if (!uid) return;
    if (!estado.banco_questoes || typeof estado.banco_questoes !== "object") {
      estado.banco_questoes = {};
    }
    const agora = Date.now() / 1000;
    const atual = estado.banco_questoes[uid] || {};
    estado.banco_questoes[uid] = Object.assign({}, atual, dados, { atualizado_em: agora });

    // Se for um teste de apostila e houve resposta enviada, atualiza também o progresso da apostila (alimentando o BKT!)
    if (metaTeste && metaTeste.pasta && metaTeste.id && typeof dados.escolha === "number" && (dados.status === "acertou" || dados.status === "errou")) {
      try {
        const pasta = metaTeste.pasta;
        const tid = metaTeste.id;
        const progAtual = estado.progresso[pasta];
        let obj = {};
        if (progAtual && progAtual.texto) {
          try {
            const p = JSON.parse(progAtual.texto);
            obj = (p && typeof p.estado === "string") ? JSON.parse(p.estado) : (p || {});
          } catch (e) { obj = {}; }
        }
        if (!obj || typeof obj !== "object") obj = {};
        if (!obj.t || typeof obj.t !== "object") obj.t = {};
        const prev = obj.t[tid] || {};
        const tent = (parseInt(prev.tent || 0, 10) || 0) + 1;
        obj.t[tid] = Object.assign({}, prev, {
          r: dados.escolha,
          env: 1,
          tent,
        });
        obj.ts = Date.now();
        const textoNovo = JSON.stringify(obj);
        estado.progresso[pasta] = { atualizado_em: agora, texto: textoNovo };

        // Sincroniza também na chave localStorage da apostila (const CH)
        const apMeta = listarMetadadosApostilas().find(x => x.pasta === pasta);
        if (apMeta && apMeta.chave_local) {
          try { localStorage.setItem(apMeta.chave_local, textoNovo); } catch (e) {}
        }
      } catch (e) {
        console.warn("Não foi possível espelhar resposta no progresso da apostila:", e);
      }
    }

    salvarEstadoLocal(true);
    return estado.banco_questoes[uid];
  }

  function obterOrganizacaoAtual() {
    return (estado.organizacao && estado.organizacao.pastas)
      ? estado.organizacao
      : (catalogo.organizacao_padrao || { pastas: {}, apostilas: {} });
  }

  const HOME_CARDS_IDS = ["apostilas", "questoes", "abnt"];

  function resolverUrlCapaHome(valor) {
    if (!valor || typeof valor !== "string") return "";
    if (valor.startsWith("data:") || valor.startsWith("http://") || valor.startsWith("https://") || valor.startsWith("/") || valor.startsWith("assets/")) {
      return valor;
    }
    const localData = obterDataUrlCapaLocal(valor);
    if (localData) {
      return localData;
    }
    return `capas_pastas/${encodeURIComponent(valor)}`;
  }

  function obterCapasHome() {
    const out = {};
    for (const id of HOME_CARDS_IDS) {
      const chave = "home:" + id;
      const ap = (estado.aparencia && estado.aparencia[chave]) || (catalogo.aparencia_padrao && catalogo.aparencia_padrao[chave]) || null;
      out[id] = (ap && ap.capa) ? resolverUrlCapaHome(ap.capa) : "";
    }
    return out;
  }

  function salvarCapaHome(cardId, dataUrl) {
    if (!ehAdmin()) throw new Error("Ative o Modo Administrador para alterar a imagem.");
    if (!HOME_CARDS_IDS.includes(cardId)) throw new Error("Card inválido.");
    if (!dataUrl || typeof dataUrl !== "string") throw new Error("Imagem inválida.");
    if (!estado.aparencia || typeof estado.aparencia !== "object") estado.aparencia = {};
    const mime = (dataUrl.match(/^data:(image\/[a-z0-9.+-]+);base64,/i) || [])[1] || "image/webp";
    const ext = mime === "image/gif" ? ".gif" : (mime === "image/png" ? ".png" : (mime === "image/jpeg" ? ".jpg" : ".webp"));
    const hash = Array.from(crypto.getRandomValues(new Uint8Array(10))).map(x => x.toString(16).padStart(2, "0")).join("") + ext;
    registrarCapaLocal(hash, dataUrl);
    estado.aparencia["home:" + cardId] = {
      capa: hash,
      atualizado_em: Date.now() / 1000,
    };
    estado.org_em = Date.now() / 1000;
    salvarEstadoLocal(true);
    window.dispatchEvent(new CustomEvent("ej-home-capas-mudou", { detail: obterCapasHome() }));
    autoSalvarPastaPCSeConectada();
    return obterCapasHome();
  }

  function restaurarCapaHome(cardId) {
    if (!ehAdmin()) throw new Error("Ative o Modo Administrador para restaurar a imagem.");
    if (!HOME_CARDS_IDS.includes(cardId)) throw new Error("Card inválido.");
    const chave = "home:" + cardId;
    if (estado.aparencia && chave in estado.aparencia) {
      delete estado.aparencia[chave];
    }
    if (catalogo.aparencia_padrao && chave in catalogo.aparencia_padrao) {
      delete catalogo.aparencia_padrao[chave];
    }
    estado.org_em = Date.now() / 1000;
    salvarEstadoLocal(true);
    window.dispatchEvent(new CustomEvent("ej-home-capas-mudou", { detail: obterCapasHome() }));
    autoSalvarPastaPCSeConectada();
    return obterCapasHome();
  }

  // Inicializa logo ao carregar o script
  inicializar().then(() => {
    notificarStatusUI();
    window.dispatchEvent(new CustomEvent("ej-home-capas-mudou", { detail: obterCapasHome() }));
    if (tokenAcesso) {
      sincronizarComDriveAgora();
    }
  });

  window.EJStorageDrive = {
    inicializar,
    conectarQuadroApostila,
    urlParaQuadro,
    entrarComGoogle,
    sairDoGoogle,
    sincronizarComDriveAgora,
    obterClientId,
    definirClientId,
    obterUrlControleVagas,
    definirUrlControleVagas,
    exportarBackupJson,
    importarBackupJson,
    ehAdmin,
    entrarModoAdmin,
    sairModoAdmin,
    salvarNaPastaDoPC,
    obterEstadoBancoQuestoes,
    salvarItemBancoQuestao,
    obterOrganizacaoAtual,
    obterCapasHome,
    salvarCapaHome,
    restaurarCapaHome,
    temPastaPCConectada: () => !!dirProjetoHandle,
    nomePastaPCConectada: () => (dirProjetoHandle ? dirProjetoHandle.name : ""),
    obterStatus: () => ({
      status: statusSync,
      erro: msgErroSync,
      conta: contaGoogle,
      conectado: !!tokenAcesso,
    }),
  };
})();
