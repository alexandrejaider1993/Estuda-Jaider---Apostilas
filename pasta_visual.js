/* Aparência das pastas (18/11/2026, pedido do usuário): cor e imagem de capa em todas as pastas do app.
 * Desenha a pasta como nos exemplos do usuário: aba atrás num tom mais escuro e a frente com a cor ou a imagem.
 * Uso: qualquer elemento com data-pv="<chave>" (bib:<caminho>, anot:<caminho>, apost:<id>) recebe o desenho com
 * PastaVisual.preencher(raiz); PastaVisual.editar(chave, nome) abre o editor. Servidor: aparencia_pastas.py.
 * A imagem é reduzida aqui (lado maior até 1000 px, WEBP) antes de enviar; a cor da aba vem da média da imagem
 * quando o aluno não escolheu uma cor. */
(function () {
  "use strict";
  const API = "/api/pastas-aparencia";
  const PADRAO = "#A3ADBA";
  const CORES = ["#A3ADBA", "#6E7781", "#3D3F46", "#6FA8C7", "#3E7CB1", "#7BC8C4", "#8CC084", "#B5B85A",
    "#F2C14E", "#F4A261", "#E76F51", "#EC8FB0", "#C774D9", "#9D8CD6", "#C9A27E", "#E8DCC8"];
  let mapa = {}, carregado = null, seq = 0;

  const css = document.createElement("style");
  css.textContent = `
  .pv-arte { display: block; width: 100%; aspect-ratio: 120 / 92; }
  .pv-arte svg { display: block; width: 100%; height: 100%; overflow: visible; }
  .pv-dlg { width: min(520px, calc(100vw - 32px)); padding: 0; border: 1px solid var(--cor-fio); border-radius: 12px; background: var(--cor-fundo); color: var(--cor-tinta);
    box-shadow: 0 24px 60px rgba(0,0,0,.28); font: 400 14px var(--fonte-ui); }
  .pv-dlg::backdrop { background: rgba(0,0,0,.35); }
  .pv-dlg__corpo { display: grid; grid-template-columns: 180px 1fr; gap: 20px; padding: 20px; }
  .pv-dlg h2 { grid-column: 1 / -1; margin: 0; font: 600 17px var(--fonte-ui); }
  .pv-dlg h2 small { display: block; margin-top: 2px; font: 400 13px var(--fonte-ui); color: var(--cor-suave); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .pv-dlg__previa { align-self: start; position: relative; border-radius: 10px; }
  .pv-dlg__previa.pv-solta { outline: 2px dashed var(--cor-tinta); outline-offset: 6px; }
  .pv-dlg__rot { margin: 0 0 8px; font: 600 13px var(--fonte-ui); }
  .pv-cores { display: grid; grid-template-columns: repeat(8, 26px); gap: 8px; margin-bottom: 8px; }
  .pv-cor { width: 26px; height: 26px; padding: 0; border-radius: 6px; border: 1px solid color-mix(in srgb, var(--cor-tinta) 25%, transparent); background: var(--c); cursor: pointer; }
  .pv-cor[aria-pressed="true"] { outline: 2px solid var(--cor-tinta); outline-offset: 2px; }
  .pv-cor:focus-visible { outline: 2px solid var(--cor-tinta); outline-offset: 2px; }
  .pv-livre { display: inline-flex; align-items: center; gap: 8px; margin: 2px 0 16px; font-size: 13px; color: var(--cor-suave); cursor: pointer; }
  .pv-livre input { width: 32px; height: 26px; padding: 0; border: 1px solid var(--cor-fio); border-radius: 6px; background: none; cursor: pointer; }
  .pv-capa-acoes { display: flex; flex-wrap: wrap; gap: 8px; }
  .pv-bt { height: 34px; padding: 0 12px; border: 1px solid var(--cor-fio); border-radius: 8px; background: var(--cor-superficie); color: var(--cor-tinta); font: 600 13px var(--fonte-ui); cursor: pointer; }
  .pv-bt:hover { background: var(--cor-superficie-2); }
  .pv-bt:focus-visible { outline: 2px solid var(--cor-tinta); outline-offset: 2px; }
  .pv-bt--pri { background: var(--cor-tinta); color: var(--cor-fundo); border-color: var(--cor-tinta); }
  .pv-bt--pri:hover { background: var(--cor-tinta); opacity: .9; }
  .pv-bt--sutil { border-color: transparent; background: transparent; color: var(--cor-suave); }
  .pv-dica { margin: 8px 0 0; font-size: 12px; color: var(--cor-suave); }
  .pv-erro { margin: 8px 0 0; font-size: 13px; color: var(--cor-arteria); }
  .pv-dlg__pe { display: flex; align-items: center; gap: 8px; padding: 14px 20px; border-top: 1px solid var(--cor-fio); }
  .pv-dlg__pe span { flex: 1; }
  @media (max-width: 560px) { .pv-dlg__corpo { grid-template-columns: 1fr; } .pv-dlg__previa { width: 160px; } }`;
  document.head.append(css);

  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const urlCapa = nome => `${API}/capa/${encodeURIComponent(nome)}`;
  const ehGifUrl = u => /\.gif(?:$|\?)/i.test(u || "") || /^data:image\/gif/i.test(u || "");

  // Quadro estático e duração dos GIFs (para rodar apenas 1 GIF por vez, em sequência)
  const cacheQuadros = new Map();
  const cacheDuracao = new Map();
  let timerGifSeq = 0, indiceGifAtivo = 0;

  function lerDuracaoGif(buf) {
    try {
      const b = new Uint8Array(buf);
      if (b.length < 13 || b[0] !== 0x47 || b[1] !== 0x49 || b[2] !== 0x46) return 3000;
      let p = 13;
      if (b[10] & 0x80) p += 3 * (1 << ((b[10] & 7) + 1));
      let ms = 0;
      while (p < b.length) {
        const bloco = b[p++];
        if (bloco === 0x3B) break;
        if (bloco === 0x21) {
          const rot = b[p++];
          if (rot === 0xF9 && b[p] === 4) {
            const atraso = b[p + 2] | (b[p + 3] << 8);
            ms += (atraso > 1 ? atraso : 10) * 10;
          }
          while (p < b.length) { const n = b[p++]; if (!n) break; p += n; }
        } else if (bloco === 0x2C) {
          p += 8;
          const fl = b[p++];
          if (fl & 0x80) p += 3 * (1 << ((fl & 7) + 1));
          p++;
          while (p < b.length) { const n = b[p++]; if (!n) break; p += n; }
        } else break;
      }
      return Math.min(Math.max(ms, 1800), 10000);
    } catch (e) { return 3000; }
  }

  function obterInfoGif(url) {
    if (cacheQuadros.has(url)) return Promise.resolve({ estatico: cacheQuadros.get(url), duracao: cacheDuracao.get(url) || 3000 });
    return new Promise(resolve => {
      const pDur = fetch(url).then(r => r.arrayBuffer()).then(lerDuracaoGif).catch(() => 3000);
      const im = new Image();
      im.crossOrigin = "anonymous";
      im.onload = async () => {
        let estatico = url;
        try {
          const cv = document.createElement("canvas");
          cv.width = im.naturalWidth || 240;
          cv.height = im.naturalHeight || 158;
          cv.getContext("2d").drawImage(im, 0, 0);
          estatico = cv.toDataURL("image/webp", 0.88);
        } catch (e) {}
        const duracao = await pDur;
        cacheQuadros.set(url, estatico);
        cacheDuracao.set(url, duracao);
        resolve({ estatico, duracao });
      };
      im.onerror = () => resolve({ estatico: url, duracao: 3000 });
      im.src = url;
    });
  }

  function definirHrefImg(elImg, href) {
    if (!elImg || elImg.getAttribute("href") === href) return;
    elImg.setAttribute("href", href);
  }

  async function sincronizarSequenciaGifs() {
    clearTimeout(timerGifSeq);
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const todos = [...document.querySelectorAll("[data-pv] image[data-gif-src]")];
      for (const im of todos) {
        const { estatico } = await obterInfoGif(im.dataset.gifSrc);
        definirHrefImg(im, estatico);
      }
      return;
    }
    const itens = [...document.querySelectorAll("[data-pv] image[data-gif-src]")]
      .filter(im => !im.closest("dialog") && im.closest("[data-pv]")?.offsetParent !== null);
    if (!itens.length) return;
    await Promise.all(itens.map(im => obterInfoGif(im.dataset.gifSrc)));
    if (indiceGifAtivo >= itens.length) indiceGifAtivo = 0;
    let duracaoAtiva = 3000;
    itens.forEach((im, idx) => {
      const src = im.dataset.gifSrc;
      if (idx === indiceGifAtivo) {
        definirHrefImg(im, src);
        duracaoAtiva = cacheDuracao.get(src) || 3000;
      } else {
        definirHrefImg(im, cacheQuadros.get(src) || src);
      }
    });
    if (itens.length > 1) {
      timerGifSeq = setTimeout(() => {
        indiceGifAtivo = (indiceGifAtivo + 1) % itens.length;
        sincronizarSequenciaGifs();
      }, duracaoAtiva);
    }
  }

  // desenho: aba atrás (tom escuro da cor) + frente arredondada com a cor ou a imagem
  function svg(ap) {
    const id = "pvc" + (++seq);
    const cor = ap && ap.cor ? ap.cor : PADRAO;
    const img = ap && (ap.previa || (ap.capa ? urlCapa(ap.capa) : ""));
    const gifAttr = ehGifUrl(img) ? ` data-gif-src="${esc(img)}"` : "";
    return `<svg viewBox="0 0 120 92" aria-hidden="true" focusable="false">
      <defs><clipPath id="${id}"><rect x="0" y="13" width="120" height="79" rx="8"/></clipPath></defs>
      <path d="M7 1h27c3 0 4.6 1 6.6 3.2L46 10h67a7 7 0 0 1 7 7v20H0V8a7 7 0 0 1 7-7Z" style="fill: color-mix(in srgb, ${cor} 70%, #000)"/>
      <rect x="0" y="13" width="120" height="79" rx="8" style="fill: ${cor}"/>
      ${img ? `<image href="${esc(img)}"${gifAttr} x="0" y="13" width="120" height="79" preserveAspectRatio="xMidYMid slice" clip-path="url(#${id})"/>` : ""}
      <rect x="0.6" y="13.6" width="118.8" height="77.8" rx="7.6" fill="none" stroke="rgba(255,255,255,.4)" stroke-width="1.2"/>
    </svg>`;
  }
  function arte(chave, ap) {
    const d = document.createElement("span"); d.className = "pv-arte"; d.innerHTML = svg(ap !== undefined ? ap : mapa[chave]);
    return d;
  }
  function preencher(raiz) {
    (raiz || document).querySelectorAll("[data-pv]").forEach(el => {
      const ap = mapa[el.dataset.pv];
      const assin = JSON.stringify(ap || null);
      if (el.dataset.pvAssin === assin && el.firstChild) return;
      el.dataset.pvAssin = assin;
      el.replaceChildren(arte(el.dataset.pv, ap));
    });
    sincronizarSequenciaGifs();
  }
  async function carregar(forcar) {
    if (carregado && !forcar) return carregado;
    carregado = fetch(API, { cache: "no-store" }).then(r => r.ok ? r.json() : { pastas: {} }).then(d => { mapa = d.pastas || {}; preencher(); return mapa; })
      .catch(() => mapa);
    return carregado;
  }
  // as telas redesenham as pastas o tempo todo: completa o desenho de quem chegou sem ele
  new MutationObserver(muts => {
    if (muts.some(m => [...m.addedNodes].some(n => n.nodeType === 1 && (n.matches?.("[data-pv]") || n.querySelector?.("[data-pv]"))))) preencher();
  }).observe(document.documentElement, { childList: true, subtree: true });

  // reduz a imagem (lado maior até 1000 px) e calcula a cor média (para a aba quando não há cor escolhida)
  function prepararImagem(arquivo) {
    // GIF (18/11/2026, pedido do usuário): vai como está para continuar animado (o canvas congelaria o 1º quadro);
    // a prévia é o próprio arquivo e a cor média sai do 1º quadro.
    if (arquivo.type === "image/gif") {
      if (arquivo.size > 15 * 1024 * 1024) return Promise.reject(new Error("GIF grande demais (máximo 15 MB)."));
      return new Promise((ok, erro) => {
        const leitor = new FileReader();
        leitor.onload = () => {
          const im = new Image();
          im.onload = () => {
            const p = document.createElement("canvas"); p.width = p.height = 8; const pc = p.getContext("2d"); pc.drawImage(im, 0, 0, 8, 8);
            const px = pc.getImageData(0, 0, 8, 8).data; let r = 0, g = 0, b = 0;
            for (let i = 0; i < px.length; i += 4) { r += px[i]; g += px[i + 1]; b += px[i + 2]; }
            const n = px.length / 4, hex = v => Math.round(v / n).toString(16).padStart(2, "0");
            ok({ blob: arquivo, nome: "capa.gif", previa: leitor.result, media: "#" + hex(r) + hex(g) + hex(b) });
          };
          im.onerror = () => erro(new Error("Não consegui abrir este GIF."));
          im.src = leitor.result;
        };
        leitor.onerror = () => erro(new Error("Não consegui ler o arquivo."));
        leitor.readAsDataURL(arquivo);
      });
    }
    return new Promise((ok, erro) => {
      const url = URL.createObjectURL(arquivo), im = new Image();
      im.onload = () => {
        const k = Math.min(1, 1000 / Math.max(im.naturalWidth, im.naturalHeight));
        const cv = document.createElement("canvas"); cv.width = Math.round(im.naturalWidth * k); cv.height = Math.round(im.naturalHeight * k);
        const c = cv.getContext("2d"); c.drawImage(im, 0, 0, cv.width, cv.height);
        const p = document.createElement("canvas"); p.width = p.height = 8; const pc = p.getContext("2d"); pc.drawImage(cv, 0, 0, 8, 8);
        const px = pc.getImageData(0, 0, 8, 8).data; let r = 0, g = 0, b = 0;
        for (let i = 0; i < px.length; i += 4) { r += px[i]; g += px[i + 1]; b += px[i + 2]; }
        const n = px.length / 4, hex = v => Math.round(v / n).toString(16).padStart(2, "0");
        cv.toBlob(blob => { URL.revokeObjectURL(url); blob ? ok({ blob, previa: cv.toDataURL("image/webp", 0.7), media: "#" + hex(r) + hex(g) + hex(b) }) : erro(new Error("Não consegui ler a imagem.")); }, "image/webp", 0.86);
      };
      im.onerror = () => { URL.revokeObjectURL(url); erro(new Error("Este arquivo não é uma imagem que o app consiga abrir.")); };
      im.src = url;
    });
  }

  function editar(chave, nome) {
    const atual = mapa[chave] || {};
    const e = { cor: atual.cor || "", capa: atual.capa || "", nova: null, removerCapa: false, corEscolhida: !!atual.cor };
    const dlg = document.createElement("dialog"); dlg.className = "pv-dlg"; dlg.setAttribute("aria-labelledby", "pvTit");
    dlg.innerHTML = `<div class="pv-dlg__corpo">
        <h2 id="pvTit">Personalizar pasta<small>${esc(nome || "")}</small></h2>
        <div class="pv-dlg__previa" title="Solte uma imagem aqui"></div>
        <div>
          <p class="pv-dlg__rot">Cor</p>
          <div class="pv-cores" role="group" aria-label="Cor da pasta">${CORES.map(c => `<button type="button" class="pv-cor" style="--c:${c}" data-cor="${c}" aria-label="Cor ${c}"></button>`).join("")}</div>
          <label class="pv-livre"><input type="color" value="${e.cor || PADRAO}" aria-label="Outra cor"> Outra cor</label>
          <p class="pv-dlg__rot">Capa</p>
          <div class="pv-capa-acoes">
            <button type="button" class="pv-bt" data-acao="imagem">Escolher imagem…</button>
            <button type="button" class="pv-bt pv-bt--sutil" data-acao="sem-imagem">Remover imagem</button>
          </div>
          <p class="pv-dica">Imagem ou GIF animado. Também dá para arrastar até a pasta ou colar (Ctrl+V).</p>
          <p class="pv-erro" hidden></p>
          <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden>
        </div>
      </div>
      <div class="pv-dlg__pe"><button type="button" class="pv-bt pv-bt--sutil" data-acao="padrao">Restaurar padrão</button><span></span>
        <button type="button" class="pv-bt" data-acao="cancelar">Cancelar</button><button type="button" class="pv-bt pv-bt--pri" data-acao="salvar">Salvar</button></div>`;
    document.body.append(dlg);
    const $ = s => dlg.querySelector(s), previa = $(".pv-dlg__previa"), erro = $(".pv-erro"), file = $("input[type=file]"), livre = $("input[type=color]");
    const mostrarErro = m => { erro.hidden = !m; erro.textContent = m || ""; };
    function desenhar() {
      const ap = { cor: e.cor, capa: e.removerCapa ? "" : e.capa, previa: e.nova ? e.nova.previa : "" };
      previa.replaceChildren(arte(chave, ap));
      dlg.querySelectorAll(".pv-cor").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.cor.toLowerCase() === (e.cor || "").toLowerCase())));
      $('[data-acao="sem-imagem"]').hidden = !(e.nova || (e.capa && !e.removerCapa));
    }
    async function usarArquivo(f) {
      if (!f) return;
      mostrarErro("");
      if (!/^image\//.test(f.type)) { mostrarErro("Escolha uma imagem (JPG, PNG, WEBP ou GIF)."); return; }
      try {
        e.nova = await prepararImagem(f); e.removerCapa = false;
        if (!e.corEscolhida) e.cor = e.nova.media;
        desenhar();
      } catch (er) { mostrarErro(er.message); }
    }
    dlg.querySelectorAll(".pv-cor").forEach(b => b.onclick = () => { e.cor = b.dataset.cor; e.corEscolhida = true; livre.value = e.cor; desenhar(); });
    livre.oninput = () => { e.cor = livre.value; e.corEscolhida = true; desenhar(); };
    $('[data-acao="imagem"]').onclick = () => file.click();
    file.onchange = () => usarArquivo(file.files[0]);
    $('[data-acao="sem-imagem"]').onclick = () => { e.nova = null; e.removerCapa = true; desenhar(); };
    $('[data-acao="padrao"]').onclick = () => { e.cor = ""; e.corEscolhida = false; e.nova = null; e.removerCapa = true; e.restaurar = true; desenhar(); };
    $('[data-acao="cancelar"]').onclick = () => dlg.close();
    previa.addEventListener("dragover", ev => { if (ev.dataTransfer.types.includes("Files")) { ev.preventDefault(); previa.classList.add("pv-solta"); } });
    previa.addEventListener("dragleave", () => previa.classList.remove("pv-solta"));
    previa.addEventListener("drop", ev => { ev.preventDefault(); previa.classList.remove("pv-solta"); usarArquivo(ev.dataTransfer.files[0]); });
    dlg.addEventListener("paste", ev => { const it = [...(ev.clipboardData?.items || [])].find(i => i.type.startsWith("image/")); if (it) { ev.preventDefault(); usarArquivo(it.getAsFile()); } });
    dlg.addEventListener("keydown", ev => ev.stopPropagation());          // atalhos das telas não disparam com o editor aberto
    dlg.addEventListener("close", () => dlg.remove());
    $('[data-acao="salvar"]').onclick = async () => {
      const bt = $('[data-acao="salvar"]'); bt.disabled = true; mostrarErro("");
      try {
        let r;
        if (e.restaurar && !e.cor && !e.nova) {
          r = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chave, restaurar: true }) });
        } else if (e.nova) {
          const fd = new FormData(); fd.append("chave", chave); fd.append("cor", e.cor || ""); fd.append("arquivo", e.nova.blob, e.nova.nome || "capa.webp");
          r = await fetch(API + "/capa", { method: "POST", body: fd });
        } else {
          r = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chave, cor: e.cor || "", remover_capa: e.removerCapa }) });
        }
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(r.status === 404 ? "Reinicie o Estuda Jaider para personalizar as pastas." : (d.detail || "Não consegui salvar."));
        if (d.aparencia && Object.keys(d.aparencia).length) mapa[chave] = d.aparencia; else delete mapa[chave];
        preencher();
        dlg.close();
      } catch (er) { mostrarErro(er.message); bt.disabled = false; }
    };
    desenhar();
    dlg.showModal();
    $(".pv-cor[aria-pressed=true]")?.focus();
  }

  window.PastaVisual = { carregar, preencher, editar, arte, chaves: () => mapa };
  carregar();
})();
