/* ==========================================================================
   Gerador ABNT 2026 — Módulo Web Completo (Estuda Jaider)
   100% local no navegador (Word .docx e Pré-visualização ABNT)
   Conforme ABNT NBR 14724, NBR 6023:2025, NBR 6024, NBR 6027 e NBR 6028
   ========================================================================== */
(function () {
  "use strict";

  const STORAGE_KEY = "ej_abnt_rascunho_v2";
  const DOCX_SRC = "assets/docx.umd.js";
  const MAMMOTH_SRC = "assets/mammoth.browser.min.js";
  const PDFJS_SRC = "assets/pdf.min.js";
  const PDFJS_WORKER_SRC = "assets/pdf.worker.min.js";
  const MAX_FILE_BYTES = 15 * 1024 * 1024; // 15 MB

  const DEFAULTS = {
    instituicao: "",
    curso: "",
    autores: "",
    titulo: "",
    subtitulo: "",
    orientador: "",
    nota: "",
    cidade: "",
    ano: "",
    fonte: "Times New Roman",
    incluirSumario: true
  };

  const EXEMPLO_MD = `# RESUMO

Este trabalho analisa os fundamentos jurídicos e éticos que regem o exercício da medicina no Brasil, com foco na articulação entre o Código de Ética Médica e as esferas civil, penal e administrativa de responsabilidade profissional.

**Palavras-chave:** Ética Médica. Responsabilidade Civil. Gestão de Riscos. Direito Médico.

# 1 INTRODUÇÃO

A prática médica contemporânea exige não apenas domínio técnico-científico, mas também sólida compreensão dos deveres éticos e legais que norteiam a relação médico-paciente. A judicialização da saúde ampliou a necessidade de documentação clínica rigorosa e de comunicação transparente.

## 1.1 Esferas de responsabilidade

O profissional médico responde de forma independente nas esferas ética (Conselhos Regionais de Medicina), civil (indenização por dano material, moral ou estético) e penal (tipificação de condutas culposas ou dolosas).

| Esfera | Órgão / Instância | Natureza da Sanção |
|---|---|---|
| Ética | CRM / CFM | Advertência, censura, suspensão ou cassação |
| Civil | Justiça Cível | Indenização material, moral ou estética |
| Penal | Justiça Criminal | Detenção, reclusão ou medidas restritivas |

> A responsabilidade civil do profissional liberal depende da verificação de culpa, conforme estabelecido no Código de Defesa do Consumidor, exigindo demonstração de negligência, imprudência ou imperícia na condução do ato médico. (BRASIL, 1990).

### 1.1.1 Documentação e prontuário

1. Registro claro, legível e cronológico de todas as condutas adotadas;
2. Termo de Consentimento Livre e Esclarecido (TCLE) individualizado;
3. Comunicação empática com o paciente e seus familiares.

# 2 CONSIDERAÇÕES FINAIS

Conclui-se que a prevenção de conflitos ético-jurídicos baseia-se na boa prática clínica, no respeito à autonomia do paciente e na gestão estruturada de riscos assistenciais.

# REFERÊNCIAS

CONSELHO FEDERAL DE MEDICINA. **Código de Ética Médica**: Resolução CFM nº 2.217, de 27 de setembro de 2018. Brasília, DF: CFM, 2019.

BRASIL. Lei nº 8.078, de 11 de setembro de 1990. Dispõe sobre a proteção do consumidor e dá outras providências. **Diário Oficial da União**, Brasília, DF, 12 set. 1990.

KFOURI NETO, Miguel. **Responsabilidade civil do médico**. 11. ed. São Paulo: Thomson Reuters Brasil, 2021.
`;

  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));

  const toast = (msg, tipo = "sucesso", duracao = 3200) => {
    if (window.mostrarToast) window.mostrarToast(msg, tipo, duracao);
    else console.log(`[ABNT] ${msg}`);
  };

  let docxPromise = null;
  function carregarScript(src, checkFn, erroMsg) {
    return new Promise((resolve, reject) => {
      const existing = checkFn();
      if (existing) return resolve(existing);
      const s = document.createElement("script");
      s.src = src;
      s.async = true;
      s.onload = () => {
        const lib = checkFn();
        if (lib) resolve(lib);
        else reject(new Error(erroMsg));
      };
      s.onerror = () => reject(new Error(erroMsg));
      document.head.appendChild(s);
    });
  }

  function carregarDocxLib() {
    if (window.docx) return Promise.resolve(window.docx);
    if (!docxPromise) {
      docxPromise = carregarScript(DOCX_SRC, () => window.docx, "Não foi possível carregar a biblioteca geradora de Word (assets/docx.umd.js).")
        .catch(e => { docxPromise = null; throw e; });
    }
    return docxPromise;
  }

  let mammothPromise = null;
  function carregarMammothLib() {
    if (window.mammoth) return Promise.resolve(window.mammoth);
    if (!mammothPromise) {
      mammothPromise = carregarScript(MAMMOTH_SRC, () => window.mammoth, "Não foi possível carregar o leitor de Word (.docx).")
        .catch(e => { mammothPromise = null; throw e; });
    }
    return mammothPromise;
  }

  let pdfjsPromise = null;
  function carregarPdfJsLib() {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    if (!pdfjsPromise) {
      pdfjsPromise = carregarScript(PDFJS_SRC, () => window.pdfjsLib, "Não foi possível carregar o leitor de PDF.")
        .then(lib => {
          if (lib.GlobalWorkerOptions) lib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_SRC;
          return lib;
        })
        .catch(e => { pdfjsPromise = null; throw e; });
    }
    return pdfjsPromise;
  }

  /* ================= IMPORTAÇÃO DE .DOCX E .PDF PARA MARKDOWN ================= */
  function inlineHtmlParaMd(node) {
    if (node.nodeType === 3) return node.nodeValue || "";
    if (node.nodeType !== 1) return "";
    const tag = node.tagName.toLowerCase();
    const inner = Array.from(node.childNodes).map(inlineHtmlParaMd).join("");
    if (tag === "br") return "\n";
    if (!inner.trim()) return inner;
    if (tag === "strong" || tag === "b") return `**${inner.trim()}**`;
    if (tag === "em" || tag === "i") return `*${inner.trim()}*`;
    return inner;
  }

  function htmlParaMarkdown(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const blocos = [];

    function processarElemento(el) {
      if (el.nodeType !== 1) return;
      const tag = el.tagName.toLowerCase();

      if (/^h[1-6]$/.test(tag)) {
        const nivel = Math.min(Number(tag[1]), 3);
        const txt = inlineHtmlParaMd(el).replace(/\s+/g, " ").trim();
        if (txt) blocos.push(`${"#".repeat(nivel)} ${txt}`);
        return;
      }

      if (tag === "p") {
        const txt = inlineHtmlParaMd(el).replace(/\s+/g, " ").trim();
        if (txt) blocos.push(txt);
        return;
      }

      if (tag === "blockquote") {
        const txt = inlineHtmlParaMd(el).replace(/\s+/g, " ").trim();
        if (txt) blocos.push(`> ${txt}`);
        return;
      }

      if (tag === "ul" || tag === "ol") {
        const itens = Array.from(el.children).filter(c => c.tagName.toLowerCase() === "li");
        const linhas = [];
        itens.forEach((li, i) => {
          const txt = inlineHtmlParaMd(li).replace(/\s+/g, " ").trim();
          if (txt) linhas.push(tag === "ol" ? `${i + 1}. ${txt}` : `- ${txt}`);
        });
        if (linhas.length) blocos.push(linhas.join("\n"));
        return;
      }

      if (tag === "table") {
        const trs = Array.from(el.querySelectorAll("tr"));
        if (!trs.length) return;
        const matriz = trs.map(tr =>
          Array.from(tr.children).map(td => inlineHtmlParaMd(td).replace(/\s+/g, " ").replace(/\|/g, "/").trim())
        ).filter(r => r.some(Boolean));
        if (!matriz.length) return;
        const cols = Math.max(...matriz.map(r => r.length));
        const padRow = r => "| " + Array.from({ length: cols }, (_, i) => r[i] || "").join(" | ") + " |";
        const sep = "| " + Array.from({ length: cols }, () => "---").join(" | ") + " |";
        const linhas = [padRow(matriz[0]), sep, ...matriz.slice(1).map(padRow)];
        blocos.push(linhas.join("\n"));
        return;
      }

      Array.from(el.children).forEach(processarElemento);
    }

    Array.from(doc.body.children).forEach(processarElemento);
    return blocos.join("\n\n");
  }

  function normalizarTitulosExtraidos(texto) {
    const titulosFixos = new Set(["RESUMO", "ABSTRACT", "SUMÁRIO", "SUMARIO", "REFERÊNCIAS", "REFERENCIAS", "INTRODUÇÃO", "INTRODUCAO", "CONCLUSÃO", "CONCLUSAO", "CONSIDERAÇÕES FINAIS", "CONSIDERACOES FINAIS"]);
    return texto.split("\n").map(linha => {
      const l = linha.trim();
      if (!l || l.startsWith("#") || l.startsWith(">") || l.startsWith("|")) return linha;
      const up = l.toUpperCase();
      if (titulosFixos.has(up)) return `# ${up}`;
      if (/^\d+\.\d+\.\d+\.?\s+\S/.test(l) && l.length <= 120) return `### ${l}`;
      if (/^\d+\.\d+\.?\s+\S/.test(l) && l.length <= 120) return `## ${l}`;
      if (/^\d+\.?\s+[A-ZÀ-Ü]{3,}/.test(l) && l.length <= 120) return `# ${l}`;
      return linha;
    }).join("\n");
  }

  async function extrairTextoDocx(file) {
    const mammoth = await carregarMammothLib();
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.convertToHtml({ arrayBuffer });
    const md = htmlParaMarkdown(result.value || "");
    if (!md.trim()) {
      throw new Error("Não foi possível extrair texto deste arquivo .docx.");
    }
    return normalizarTitulosExtraidos(md);
  }

  async function extrairTextoPdf(file, aoProgresso) {
    const pdfjsLib = await carregarPdfJsLib();
    const data = new Uint8Array(await file.arrayBuffer());
    const pdf = await pdfjsLib.getDocument({ data }).promise;
    const paginasMd = [];

    for (let p = 1; p <= pdf.numPages; p++) {
      if (aoProgresso) aoProgresso(p, pdf.numPages);
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();

      // Agrupa trechos por linha usando coordenada Y
      const linhasMap = [];
      for (const item of content.items || []) {
        const str = String(item.str || "");
        if (!str.trim()) continue;
        const y = item.transform ? Math.round(item.transform[5]) : 0;
        const x = item.transform ? item.transform[4] : 0;
        let alvo = linhasMap.find(l => Math.abs(l.y - y) <= 3);
        if (!alvo) {
          alvo = { y, partes: [] };
          linhasMap.push(alvo);
        }
        alvo.partes.push({ x, str });
      }

      linhasMap.sort((a, b) => b.y - a.y);
      const linhasTexto = linhasMap.map(l => {
        l.partes.sort((a, b) => a.x - b.x);
        return l.partes.map(pt => pt.str).join(" ").replace(/\s+/g, " ").trim();
      }).filter(Boolean);

      // Reagrupa linhas contínuas em parágrafos (ignora número isolado de página no topo/rodapé)
      const paragrafos = [];
      let atual = "";
      for (let i = 0; i < linhasTexto.length; i++) {
        const ln = linhasTexto[i];
        if ((i === 0 || i === linhasTexto.length - 1) && /^\d{1,4}$/.test(ln)) continue;

        const pareceTitulo = /^(RESUMO|ABSTRACT|SUMÁRIO|SUMARIO|REFERÊNCIAS|REFERENCIAS|\d+(?:\.\d+)*\.?\s+[A-ZÀ-Ü])/.test(ln) && ln.length <= 120;
        if (pareceTitulo) {
          if (atual) { paragrafos.push(atual); atual = ""; }
          paragrafos.push(ln);
          continue;
        }

        if (!atual) {
          atual = ln;
        } else if (/[.!?:"»)]$/.test(atual) && /^[A-ZÀ-Ü0-9\-•*]/.test(ln)) {
          paragrafos.push(atual);
          atual = ln;
        } else if (atual.endsWith("-")) {
          atual = atual.slice(0, -1) + ln;
        } else {
          atual += " " + ln;
        }
      }
      if (atual) paragrafos.push(atual);
      if (paragrafos.length) paginasMd.push(paragrafos.join("\n\n"));
    }

    const textoFinal = paginasMd.join("\n\n").trim();
    if (!textoFinal) {
      throw new Error("Nenhum texto selecionável foi encontrado neste PDF (ele pode ser uma imagem escaneada).");
    }
    return normalizarTitulosExtraidos(textoFinal);
  }

  /* ================= PARSER INLINE (**negrito**, *itálico*, _itálico_) ================= */
  function parseInlineSegments(texto) {
    const segs = [];
    // Evita capturar asteriscos soltos com espaços ao redor (ex.: "2 * 3 = 6")
    const regex = /(\*\*\*(?=\S)(?:[^*]|\*(?!\*\*))*?\S\*\*\*|\*\*(?=\S)(?:[^*]|\*(?!\*))*?\S\*\*|\*(?=\S)[^*]*?\S\*|_(?=\S)[^_]*?\S_)/g;
    let last = 0;
    let m;
    while ((m = regex.exec(texto)) !== null) {
      if (m.index > last) {
        segs.push({ text: texto.slice(last, m.index), bold: false, italics: false });
      }
      const token = m[0];
      if (token.startsWith("***") && token.endsWith("***")) {
        segs.push({ text: token.slice(3, -3), bold: true, italics: true });
      } else if (token.startsWith("**") && token.endsWith("**")) {
        segs.push({ text: token.slice(2, -2), bold: true, italics: false });
      } else {
        segs.push({ text: token.slice(1, -1), bold: false, italics: true });
      }
      last = regex.lastIndex;
    }
    if (last < texto.length) {
      segs.push({ text: texto.slice(last), bold: false, italics: false });
    }
    return segs.length ? segs : [{ text: texto, bold: false, italics: false }];
  }

  function inlineParaHtml(texto) {
    return parseInlineSegments(texto).map(seg => {
      let h = esc(seg.text);
      if (seg.italics) h = `<em>${h}</em>`;
      if (seg.bold) h = `<strong>${h}</strong>`;
      return h;
    }).join("");
  }

  function toTitleCase(str) {
    const minusculas = new Set(["de", "da", "do", "das", "dos", "e", "em", "na", "no", "nas", "nos", "a", "o", "as", "os", "para", "por", "com"]);
    return str.toLowerCase().split(/\s+/).map((w, i) => {
      if (!w) return w;
      if (i > 0 && minusculas.has(w)) return w;
      return w.charAt(0).toUpperCase() + w.slice(1);
    }).join(" ");
  }

  function extrairAutores(str) {
    if (!str) return [];
    const partes = str.includes("\n") || str.includes(";")
      ? str.split(/[\n;]+/)
      : [str];
    return partes.map(s => s.trim()).filter(Boolean);
  }

  function parseLinhaTabela(linha) {
    return linha.replace(/^\|/, "").replace(/\|$/, "").split("|").map(c => c.trim());
  }

  function ehSeparadorTabela(linha) {
    return /^\|?(\s*:?-+:?\s*\|)+\s*:?-+:?\s*\|?$/.test(linha);
  }

  /* ================= PARSER ESTRUTURAL ABNT ================= */
  function parseMarkdownABNT(mdText) {
    const linhas = String(mdText || "").replace(/\r\n/g, "\n").split("\n");
    const preTextuais = [];
    const textuais = [];
    const referencias = [];
    const sumarioItens = [];

    const gatilhosInicio = ["RESUMO", "ABSTRACT", "SUMÁRIO", "SUMARIO"];
    const gatilhosTextuais = ["1. INTRODUÇÃO", "1 INTRODUÇÃO", "INTRODUÇÃO"];

    let estado = "IGNORAR_INICIO";
    let paginacaoAtivada = false;
    let temGatilhoExplicito = false;
    let secaoPreAtual = "";

    const ehGatilhoTextual = (rawLimpa, up) => {
      if (gatilhosTextuais.includes(up)) return true;
      // Só dispara seção numerada se for título Markdown (# ...) ou linha inteira em caixa alta
      const ehHeading = rawLimpa.startsWith("#");
      const ehMaiuscula = rawLimpa === rawLimpa.toUpperCase() && /[A-ZÀ-Ü]/.test(rawLimpa);
      return (ehHeading || ehMaiuscula) && /^\d+\.?\s+[A-ZÀ-Ü]/.test(up);
    };

    for (const raw of linhas) {
      const limpa = raw.trim().replace(/<[^>]+>/g, "").replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1");
      if (!limpa) continue;
      const up = limpa.toUpperCase().replace(/\*\*/g, "").replace(/#/g, "").trim();
      if (gatilhosInicio.includes(up) || ehGatilhoTextual(limpa, up) || up === "REFERÊNCIAS" || up === "REFERENCIAS") {
        temGatilhoExplicito = true;
        break;
      }
    }

    if (!temGatilhoExplicito) {
      estado = "CORPO";
      paginacaoAtivada = true;
    }

    let titulosCount = 0;
    let citacoesCount = 0;
    let listasCount = 0;
    let tabelasCount = 0;
    let paragrafosCount = 0;

    for (let idx = 0; idx < linhas.length; idx++) {
      let linha = linhas[idx].trim();
      linha = linha.replace(/<[^>]+>/g, "");
      linha = linha.replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1");
      if (!linha) continue;

      const upperLine = linha.toUpperCase().replace(/\*\*/g, "").replace(/#/g, "").trim();

      if (!paginacaoAtivada && ehGatilhoTextual(linha, upperLine)) {
        paginacaoAtivada = true;
        estado = "CORPO";
        secaoPreAtual = "";
      } else if (gatilhosInicio.includes(upperLine) && (linha.startsWith("#") || linha === linha.toUpperCase())) {
        if (preTextuais.length > 0) {
          preTextuais.push({ tipo: "page_break" });
        }
        estado = "CORPO_PRE_TEXTUAL";
        secaoPreAtual = upperLine;
        titulosCount++;
        preTextuais.push({
          tipo: "titulo_pre",
          texto: upperLine
        });
        continue;
      } else if ((upperLine === "REFERÊNCIAS" || upperLine === "REFERENCIAS") && (linha.startsWith("#") || linha === linha.toUpperCase())) {
        estado = "REFERENCIAS";
        secaoPreAtual = "";
        continue;
      }

      if (estado === "IGNORAR_INICIO") continue;

      const destino = estado === "CORPO_PRE_TEXTUAL" ? preTextuais : textuais;

      if (linha === "---" || linha === "***") {
        destino.push({ tipo: "page_break" });
        continue;
      }

      if (estado === "REFERENCIAS") {
        if (!linha.startsWith("#")) {
          referencias.push(linha);
        }
        continue;
      }

      // Tabela Markdown (cabeçalho + separador |---| + linhas)
      if (linha.includes("|") && idx + 1 < linhas.length && ehSeparadorTabela(linhas[idx + 1].trim())) {
        const cabecalho = parseLinhaTabela(linha);
        idx += 1; // pula linha separadora
        const corpo = [];
        while (idx + 1 < linhas.length) {
          const prox = linhas[idx + 1].trim();
          if (!prox || !prox.includes("|")) break;
          corpo.push(parseLinhaTabela(prox));
          idx += 1;
        }
        tabelasCount++;
        destino.push({ tipo: "tabela", cabecalho, corpo });
        continue;
      }

      // Citação longa (agrupa linhas consecutivas começando com >)
      if (linha.startsWith(">")) {
        const partes = [linha.replace(/^>\s*/, "").trim()];
        while (idx + 1 < linhas.length && linhas[idx + 1].trim().startsWith(">")) {
          idx += 1;
          const proxLimpa = linhas[idx].trim().replace(/<[^>]+>/g, "").replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1").replace(/^>\s*/, "").trim();
          if (proxLimpa) partes.push(proxLimpa);
        }
        citacoesCount++;
        destino.push({ tipo: "citacao", texto: partes.join(" ") });
        continue;
      }

      // Títulos (#, ##, ###)
      if (linha.startsWith("#")) {
        const matchHash = linha.match(/^(#+)\s*(.*)$/);
        const nivel = matchHash ? matchHash[1].length : 1;
        const textoTitulo = (matchHash ? matchHash[2] : linha.replace(/^#+\s*/, "")).trim();
        const primeiroDoTextual = estado === "CORPO" && textuais.length === 0;
        const ehPreTextual = estado === "CORPO_PRE_TEXTUAL";
        titulosCount++;
        destino.push({
          tipo: "titulo",
          nivel,
          texto: textoTitulo,
          quebraAntes: nivel === 1 && !primeiroDoTextual && !ehPreTextual && !gatilhosTextuais.includes(upperLine)
        });
        if (!ehPreTextual) {
          sumarioItens.push({ nivel, texto: textoTitulo });
        }
        continue;
      }

      // Lista com marcadores (- ou *)
      if (linha.startsWith("- ") || linha.startsWith("* ")) {
        listasCount++;
        destino.push({ tipo: "lista", ordenada: false, texto: linha.slice(2).trim() });
        continue;
      }

      // Lista numerada (1. item)
      const matchOrd = linha.match(/^(\d+)\.\s+(.+)$/);
      if (matchOrd) {
        listasCount++;
        destino.push({ tipo: "lista", ordenada: true, num: matchOrd[1], texto: matchOrd[2].trim() });
        continue;
      }

      paragrafosCount++;
      destino.push({
        tipo: "paragrafo",
        texto: linha,
        semRecuo: estado === "CORPO_PRE_TEXTUAL" && (secaoPreAtual === "RESUMO" || secaoPreAtual === "ABSTRACT")
      });
    }

    // Ordenação alfabética ABNT NBR 6023:2025
    referencias.sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));

    return {
      preTextuais,
      textuais,
      referencias,
      sumarioItens,
      stats: {
        linhas: linhas.filter(l => l.trim()).length,
        palavras: String(mdText || "").trim() ? String(mdText).trim().split(/\s+/).length : 0,
        titulos: titulosCount,
        citacoes: citacoesCount,
        listas: listasCount,
        tabelas: tabelasCount,
        paragrafos: paragrafosCount,
        referencias: referencias.length,
        temGatilhoExplicito
      }
    };
  }

  /* ================= GERADOR DE WORD (.DOCX) ================= */
  async function construirDocxBlob(meta, parsed) {
    const D = await carregarDocxLib();
    const {
      Document, Packer, Paragraph, TextRun, AlignmentType,
      Header, PageNumber, SectionType, PageBreak, convertMillimetersToTwip,
      Table, TableRow, TableCell, WidthType, BorderStyle, VerticalAlign,
      HeightRule, HeadingLevel
    } = D;

    const fonte = meta.fonte || "Times New Roman";
    const PT = pt => pt * 20;      // twips (spacing)
    const HP = pt => pt * 2;       // half-points (font size)
    const CM = cm => convertMillimetersToTwip(cm * 10);

    // Margens oficiais ABNT NBR 14724 (3cm sup/esq, 2cm inf/dir, cabeçalho a 2cm do topo)
    const margensABNT = {
      top: CM(3.0),
      left: CM(3.0),
      bottom: CM(2.0),
      right: CM(2.0),
      header: CM(2.0),
      footer: CM(1.5)
    };

    const pageA4 = {
      width: CM(21.0),
      height: CM(29.7)
    };

    const semBordas = {
      top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      insideVertical: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }
    };

    function runsInline(texto, opts = {}) {
      const { bold = false, italics = false, size = 12 } = opts;
      return parseInlineSegments(texto).map(seg => new TextRun({
        text: seg.text,
        bold: bold || seg.bold,
        italics: italics || seg.italics,
        font: fonte,
        size: HP(size),
        color: "000000"
      }));
    }

    function pCentralizado(texto, { bold = false, spaceAfterPt = 0, spaceBeforePt = 0, size = 12, line = 360 } = {}) {
      return new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: PT(spaceBeforePt), after: PT(spaceAfterPt), line },
        children: [new TextRun({
          text: texto,
          bold,
          font: fonte,
          size: HP(size),
          color: "000000"
        })]
      });
    }

    // Tabela de página inteira sem bordas para garantir Capa e Folha de Rosto em exatamente 1 folha A4
    function montarPaginaEstruturada(topoChildren, meioChildren, rodapeChildren) {
      const cellBase = (children, verticalAlign) => new TableCell({
        width: { size: 100, type: WidthType.PERCENTAGE },
        verticalAlign,
        borders: semBordas,
        children: children.length ? children : [new Paragraph({ text: "" })]
      });

      return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: semBordas,
        rows: [
          new TableRow({
            height: { value: CM(7.8), rule: HeightRule.ATLEAST },
            children: [cellBase(topoChildren, VerticalAlign.TOP)]
          }),
          new TableRow({
            height: { value: CM(13.2), rule: HeightRule.ATLEAST },
            children: [cellBase(meioChildren, VerticalAlign.CENTER)]
          }),
          new TableRow({
            height: { value: CM(3.4), rule: HeightRule.ATLEAST },
            children: [cellBase(rodapeChildren, VerticalAlign.BOTTOM)]
          })
        ]
      });
    }

    function construirTabelaABNT(bloco) {
      const cols = Math.max(bloco.cabecalho.length, ...bloco.corpo.map(r => r.length), 1);
      const bordaThin = { style: BorderStyle.SINGLE, size: 6, color: "000000" };
      const bordaNone = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };

      const makeRow = (cells, isHeader, isLast) => new TableRow({
        tableHeader: isHeader,
        children: Array.from({ length: cols }, (_, ci) => new TableCell({
          borders: {
            top: isHeader ? { style: BorderStyle.SINGLE, size: 10, color: "000000" } : bordaNone,
            bottom: isHeader ? bordaThin : (isLast ? { style: BorderStyle.SINGLE, size: 10, color: "000000" } : { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" }),
            left: bordaNone,
            right: bordaNone
          },
          margins: { top: 80, bottom: 80, left: 100, right: 100 },
          children: [
            new Paragraph({
              alignment: AlignmentType.LEFT,
              spacing: { line: 240, before: 0, after: 0 },
              children: runsInline(cells[ci] || "", { bold: isHeader, size: 10 })
            })
          ]
        }))
      });

      const rows = [
        makeRow(bloco.cabecalho, true, bloco.corpo.length === 0),
        ...bloco.corpo.map((r, ri) => makeRow(r, false, ri === bloco.corpo.length - 1))
      ];

      return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows
      });
    }

    function blocoParaParagraphs(bloco) {
      if (bloco.tipo === "page_break") {
        return [new Paragraph({ children: [new PageBreak()] })];
      }
      if (bloco.tipo === "tabela") {
        return [
          new Paragraph({ spacing: { before: PT(6), after: 0 }, text: "" }),
          construirTabelaABNT(bloco),
          new Paragraph({ spacing: { before: 0, after: PT(6) }, text: "" })
        ];
      }
      if (bloco.tipo === "titulo_pre") {
        return [pCentralizado(bloco.texto, { bold: true, spaceAfterPt: 18, line: 360 })];
      }
      if (bloco.tipo === "citacao") {
        return [new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          indent: { left: CM(4.0), firstLine: 0 },
          spacing: { before: PT(12), after: PT(12), line: 240 },
          children: runsInline(bloco.texto, { size: 10 })
        })];
      }
      if (bloco.tipo === "titulo") {
        const res = [];
        if (bloco.quebraAntes) {
          res.push(new Paragraph({ children: [new PageBreak()] }));
        }
        let txt = bloco.texto;
        let bold = false;
        let heading = HeadingLevel.HEADING_3;
        if (bloco.nivel === 1) {
          txt = txt.toUpperCase();
          bold = true;
          heading = HeadingLevel.HEADING_1;
        } else if (bloco.nivel === 2) {
          txt = txt.toUpperCase();
          bold = false;
          heading = HeadingLevel.HEADING_2;
        } else {
          txt = toTitleCase(txt);
          bold = true;
          heading = HeadingLevel.HEADING_3;
        }
        res.push(new Paragraph({
          heading,
          alignment: AlignmentType.LEFT,
          indent: { firstLine: 0 },
          spacing: {
            before: PT(bloco.nivel === 1 ? 12 : 12),
            after: PT(12),
            line: 360
          },
          children: runsInline(txt, { bold, size: 12 })
        }));
        return res;
      }
      if (bloco.tipo === "lista") {
        if (bloco.ordenada) {
          return [new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            indent: { left: CM(1.25), hanging: CM(0.5) },
            spacing: { line: 360, before: 0, after: 0 },
            children: [
              new TextRun({ text: `${bloco.num}. `, font: fonte, size: HP(12), color: "000000" }),
              ...runsInline(bloco.texto, { size: 12 })
            ]
          })];
        }
        return [new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          bullet: { level: 0 },
          spacing: { line: 360, before: 0, after: 0 },
          children: runsInline(bloco.texto, { size: 12 })
        })];
      }
      // Parágrafo normal (NBR 14724: recuo 1,25cm, espaçamento 1,5, 0pt antes/depois)
      // Em RESUMO/ABSTRACT (NBR 6028): sem recuo de primeira linha, espaçamento simples
      if (bloco.semRecuo) {
        return [new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          indent: { firstLine: 0 },
          spacing: { line: 240, before: 0, after: PT(10) },
          children: runsInline(bloco.texto, { size: 12 })
        })];
      }
      return [new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        indent: { firstLine: CM(1.25) },
        spacing: { line: 360, before: 0, after: 0 },
        children: runsInline(bloco.texto, { size: 12 })
      })];
    }

    const autoresLista = extrairAutores(meta.autores);

    // --- SEÇÃO 0: CAPA (NÃO entra na contagem de páginas - NBR 14724) ---
    const capaTopo = [];
    if (meta.instituicao) capaTopo.push(pCentralizado(meta.instituicao.toUpperCase(), { bold: true, line: 240 }));
    if (meta.curso) capaTopo.push(pCentralizado(meta.curso.toUpperCase(), { bold: true, spaceAfterPt: 24, line: 240 }));
    autoresLista.forEach((a, i) => {
      capaTopo.push(pCentralizado(a.toUpperCase(), { spaceBeforePt: i === 0 ? 18 : 0, line: 240 }));
    });

    const capaMeio = [];
    if (meta.titulo) capaMeio.push(pCentralizado(meta.titulo.toUpperCase(), { bold: true, spaceAfterPt: meta.subtitulo ? 6 : 0, line: 360 }));
    if (meta.subtitulo) capaMeio.push(pCentralizado(meta.subtitulo, { line: 360 }));

    const capaRodape = [];
    if (meta.cidade) capaRodape.push(pCentralizado(meta.cidade, { line: 240 }));
    if (meta.ano) capaRodape.push(pCentralizado(meta.ano, { line: 240 }));

    const capaChildren = [montarPaginaEstruturada(capaTopo, capaMeio, capaRodape)];

    // --- SEÇÃO 1: FOLHA DE ROSTO (Página 1, sem número visível) + PRÉ-TEXTUAIS + SUMÁRIO ---
    const rostoTopo = autoresLista.map(a => pCentralizado(a.toUpperCase(), { line: 240 }));
    const rostoMeio = [];
    if (meta.titulo) rostoMeio.push(pCentralizado(meta.titulo.toUpperCase(), { bold: true, spaceAfterPt: meta.subtitulo ? 6 : 24, line: 360 }));
    if (meta.subtitulo) rostoMeio.push(pCentralizado(meta.subtitulo, { spaceAfterPt: 24, line: 360 }));
    if (meta.nota) {
      rostoMeio.push(new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        indent: { left: CM(8.0) },
        spacing: { line: 240, before: PT(18), after: PT(12) },
        children: [new TextRun({ text: meta.nota, font: fonte, size: HP(10), color: "000000" })]
      }));
    }
    if (meta.orientador) {
      rostoMeio.push(new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        indent: { left: CM(8.0) },
        spacing: { line: 240, after: PT(12) },
        children: [new TextRun({ text: `Orientador: ${meta.orientador}`, font: fonte, size: HP(10), color: "000000" })]
      }));
    }
    const rostoRodape = [];
    if (meta.cidade) rostoRodape.push(pCentralizado(meta.cidade, { line: 240 }));
    if (meta.ano) rostoRodape.push(pCentralizado(meta.ano, { line: 240 }));

    const preChildren = [montarPaginaEstruturada(rostoTopo, rostoMeio, rostoRodape)];

    // Pré-textuais (Resumo, Abstract...)
    if (parsed.preTextuais.length > 0) {
      preChildren.push(new Paragraph({ children: [new PageBreak()] }));
      for (const b of parsed.preTextuais) {
        preChildren.push(...blocoParaParagraphs(b));
      }
    }

    // Sumário automático (NBR 6027)
    const temSumarioManual = parsed.preTextuais.some(b => b.tipo === "titulo_pre" && (b.texto === "SUMÁRIO" || b.texto === "SUMARIO"));
    if (meta.incluirSumario && !temSumarioManual && parsed.sumarioItens.length > 0) {
      preChildren.push(new Paragraph({ children: [new PageBreak()] }));
      preChildren.push(pCentralizado("SUMÁRIO", { bold: true, spaceAfterPt: 18, line: 360 }));
      for (const item of parsed.sumarioItens) {
        const txt = item.nivel === 1 ? item.texto.toUpperCase()
          : item.nivel === 2 ? item.texto.toUpperCase()
          : toTitleCase(item.texto);
        preChildren.push(new Paragraph({
          alignment: AlignmentType.LEFT,
          indent: { left: CM((item.nivel - 1) * 0.6) },
          spacing: { line: 360, before: 0, after: 0 },
          children: [new TextRun({
            text: txt,
            bold: item.nivel === 1 || item.nivel >= 3,
            font: fonte,
            size: HP(12),
            color: "000000"
          })]
        }));
      }
      if (parsed.referencias.length > 0) {
        preChildren.push(new Paragraph({
          alignment: AlignmentType.LEFT,
          spacing: { line: 360, before: 0, after: 0 },
          children: [new TextRun({ text: "REFERÊNCIAS", bold: true, font: fonte, size: HP(12), color: "000000" })]
        }));
      }
    }

    // --- SEÇÃO 2: ELEMENTOS TEXTUAIS + REFERÊNCIAS (paginação ABNT visível a 2cm do topo, 10pt) ---
    const textualChildren = [];
    for (const b of parsed.textuais) {
      textualChildren.push(...blocoParaParagraphs(b));
    }

    if (parsed.referencias.length > 0) {
      if (textualChildren.length > 0) {
        textualChildren.push(new Paragraph({ children: [new PageBreak()] }));
      }
      textualChildren.push(pCentralizado("REFERÊNCIAS", { bold: true, spaceAfterPt: 18, line: 360 }));
      for (const ref of parsed.referencias) {
        textualChildren.push(new Paragraph({
          alignment: AlignmentType.LEFT,
          indent: { firstLine: 0 },
          spacing: { line: 240, after: PT(12) },
          children: runsInline(ref, { size: 12 })
        }));
      }
    }

    const sections = [
      // Seção 0: Capa (sem contagem)
      {
        properties: {
          page: { size: pageA4, margin: margensABNT }
        },
        headers: {
          default: new Header({ children: [new Paragraph({ text: "" })] })
        },
        children: capaChildren
      },
      // Seção 1: Folha de Rosto (página 1) + Pré-textuais + Sumário (sem exibir número)
      {
        properties: {
          type: SectionType.NEXT_PAGE,
          page: {
            size: pageA4,
            margin: margensABNT,
            pageNumbers: { start: 1 }
          }
        },
        headers: {
          default: new Header({ children: [new Paragraph({ text: "" })] })
        },
        children: preChildren
      }
    ];

    if (textualChildren.length > 0) {
      sections.push({
        properties: {
          type: SectionType.NEXT_PAGE,
          page: { size: pageA4, margin: margensABNT }
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    font: fonte,
                    size: HP(10),
                    color: "000000"
                  })
                ]
              })
            ]
          })
        },
        children: textualChildren
      });
    }

    const doc = new Document({
      styles: {
        default: {
          document: {
            run: {
              font: fonte,
              size: HP(12),
              color: "000000"
            }
          }
        }
      },
      sections
    });

    return await Packer.toBlob(doc);
  }

  /* ================= RENDER HTML PARA PRÉ-VISUALIZAÇÃO E PDF ================= */
  function blocosParaHtml(blocos) {
    let html = "";
    let tipoLista = null; // "ul" | "ol" | null
    const fecharLista = () => {
      if (tipoLista) { html += `</${tipoLista}>`; tipoLista = null; }
    };

    for (const b of blocos) {
      if (b.tipo === "lista") {
        const tag = b.ordenada ? "ol" : "ul";
        if (tipoLista !== tag) {
          fecharLista();
          html += `<${tag}>`;
          tipoLista = tag;
        }
        html += `<li>${inlineParaHtml(b.texto)}</li>`;
        continue;
      }
      fecharLista();

      if (b.tipo === "page_break") {
        html += `<div class="abnt-pb"></div>`;
      } else if (b.tipo === "titulo_pre") {
        html += `<p class="abnt-folha__pre-tit">${esc(b.texto)}</p>`;
      } else if (b.tipo === "tabela") {
        html += `<table><thead><tr>${b.cabecalho.map(c => `<th>${inlineParaHtml(c)}</th>`).join("")}</tr></thead><tbody>${b.corpo.map(r => `<tr>${r.map(c => `<td>${inlineParaHtml(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
      } else if (b.tipo === "citacao") {
        html += `<blockquote>${inlineParaHtml(b.texto)}</blockquote>`;
      } else if (b.tipo === "titulo") {
        const cls = b.quebraAntes ? ' class="abnt-pb-before"' : "";
        if (b.nivel === 1) html += `<h1${cls}>${inlineParaHtml(b.texto.toUpperCase())}</h1>`;
        else if (b.nivel === 2) html += `<h2${cls}>${inlineParaHtml(b.texto.toUpperCase())}</h2>`;
        else html += `<h3${cls}>${inlineParaHtml(toTitleCase(b.texto))}</h3>`;
      } else {
        const cls = b.semRecuo ? ' class="abnt-folha__sem-recuo"' : "";
        html += `<p${cls}>${inlineParaHtml(b.texto)}</p>`;
      }
    }
    fecharLista();
    return html;
  }

  function gerarSumarioHtml(parsed) {
    const linhas = parsed.sumarioItens.map(item => {
      const txt = item.nivel === 1 ? item.texto.toUpperCase()
        : item.nivel === 2 ? item.texto.toUpperCase()
        : toTitleCase(item.texto);
      const peso = (item.nivel === 1 || item.nivel >= 3) ? "font-weight:700;" : "";
      const pad = (item.nivel - 1) * 18;
      return `<p class="abnt-folha__sumario-item" style="padding-left:${pad}px;${peso}"><span>${esc(txt)}</span></p>`;
    });
    if (parsed.referencias.length > 0) {
      linhas.push(`<p class="abnt-folha__sumario-item" style="font-weight:700;"><span>REFERÊNCIAS</span></p>`);
    }
    return `<p class="abnt-folha__pre-tit">SUMÁRIO</p>${linhas.join("")}`;
  }

  /* ================= INTERFACE DO GERADOR ABNT ================= */
  let montado = false;
  let nomeArquivoAtual = "";

  function lerRascunho() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function salvarRascunho(dados) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(dados));
    } catch (e) {}
  }

  function inserirNoEditor(textarea, prefixo, sufixo = "", placeholder = "") {
    const start = textarea.selectionStart ?? textarea.value.length;
    const end = textarea.selectionEnd ?? textarea.value.length;
    const sel = textarea.value.slice(start, end) || placeholder;
    const novo = textarea.value.slice(0, start) + prefixo + sel + sufixo + textarea.value.slice(end);
    textarea.value = novo;
    const posIni = start + prefixo.length;
    const posFim = posIni + sel.length;
    textarea.focus();
    textarea.setSelectionRange(posIni, posFim);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function montarInterface(container) {
    if (montado) return;
    montado = true;

    const rasc = lerRascunho() || {};
    const val = (k) => rasc[k] !== undefined ? rasc[k] : (DEFAULTS[k] ?? "");

    container.innerHTML = `
      <div class="abnt-wrap">
        <div class="abnt-hero">
          <div>
            <span class="abnt-badge">ABNT NBR 14724 · NBR 6023:2025 · NBR 6028</span>
            <h1 class="abnt-hero__tit">Gerador e Formatador ABNT</h1>
            <p class="abnt-hero__sub">Transforme seu texto em Markdown em um trabalho acadêmico completo com capa, folha de rosto, sumário automático, margens oficiais (3×3×2×2 cm), paginação a partir da introdução (sem contar a capa) e referências ordenadas.</p>
          </div>
          <div class="abnt-hero__acoes">
            <button type="button" class="abnt-btn-mini" id="abntBtnExemplo">Carregar exemplo ABNT</button>
            <button type="button" class="abnt-btn-mini" id="abntBtnBaixarMd">Baixar .md</button>
            <button type="button" class="abnt-btn-mini" id="abntBtnReset">Limpar campos</button>
          </div>
        </div>

        <div class="abnt-grid">
          <!-- COLUNA ESQUERDA: METADADOS -->
          <div class="abnt-col">
            <!-- 1. METADADOS DO TRABALHO -->
            <section class="abnt-card">
              <div class="abnt-card__head">
                <h2 class="abnt-card__tit"><span class="abnt-card__num">1</span> Metadados do Trabalho (Capa e Folha de Rosto)</h2>
              </div>
              <div class="abnt-form-grid">
                <div class="abnt-field abnt-field--full">
                  <label class="abnt-label" for="abntInstituicao">Instituição</label>
                  <input class="abnt-input" id="abntInstituicao" placeholder="Ex.: Nome da Faculdade ou Universidade" value="${esc(val("instituicao"))}">
                </div>
                <div class="abnt-field abnt-field--full">
                  <label class="abnt-label" for="abntCurso">Curso / Disciplina</label>
                  <input class="abnt-input" id="abntCurso" placeholder="Ex.: Curso de Medicina | Disciplina" value="${esc(val("curso"))}">
                </div>
                <div class="abnt-field abnt-field--full">
                  <label class="abnt-label" for="abntAutores">
                    <span>Autor(es)</span>
                    <small style="font-weight:400;opacity:.85">Use ; para separar vários autores em linhas</small>
                  </label>
                  <input class="abnt-input" id="abntAutores" placeholder="Ex.: Nome do Autor 1; Nome do Autor 2" value="${esc(val("autores"))}">
                </div>
                <div class="abnt-field abnt-field--full">
                  <label class="abnt-label" for="abntTitulo">Título</label>
                  <input class="abnt-input" id="abntTitulo" placeholder="Ex.: TÍTULO DO TRABALHO" value="${esc(val("titulo"))}">
                </div>
                <div class="abnt-field abnt-field--full">
                  <label class="abnt-label" for="abntSubtitulo">Subtítulo (opcional)</label>
                  <input class="abnt-input" id="abntSubtitulo" placeholder="Subtítulo do trabalho (se houver)" value="${esc(val("subtitulo"))}">
                </div>
                <div class="abnt-field abnt-field--full">
                  <label class="abnt-label" for="abntOrientador">Orientador</label>
                  <input class="abnt-input" id="abntOrientador" placeholder="Ex.: Prof. Dr. Nome do Orientador" value="${esc(val("orientador"))}">
                </div>
                <div class="abnt-field abnt-field--full">
                  <label class="abnt-label" for="abntNota">Nota de Apresentação (Folha de Rosto)</label>
                  <textarea class="abnt-textarea" id="abntNota" rows="3" placeholder="Ex.: Trabalho Acadêmico apresentado à disciplina..., como requisito parcial para...">${esc(val("nota"))}</textarea>
                </div>
                <div class="abnt-field">
                  <label class="abnt-label" for="abntCidade">Cidade - UF</label>
                  <input class="abnt-input" id="abntCidade" placeholder="Ex.: São Paulo - SP" value="${esc(val("cidade"))}">
                </div>
                <div class="abnt-field">
                  <label class="abnt-label" for="abntAno">Ano</label>
                  <input class="abnt-input" id="abntAno" placeholder="Ex.: 2026" value="${esc(val("ano"))}">
                </div>
              </div>
            </section>
          </div>

          <!-- COLUNA DIREITA: MARKDOWN + CONFIGURAÇÕES E GERAÇÃO -->
          <div class="abnt-col">
            <!-- 2. ARQUIVO / CONTEÚDO DO TRABALHO -->
            <section class="abnt-card">
              <div class="abnt-card__head">
                <h2 class="abnt-card__tit"><span class="abnt-card__num">2</span> Conteúdo do Trabalho (.docx, .pdf, .md ou .txt)</h2>
                <button type="button" class="abnt-btn-mini" id="abntBtnLimparMd">Limpar texto</button>
              </div>

              <div class="abnt-dropzone" id="abntDropzone" tabindex="0" role="button" aria-label="Selecionar arquivo Word, PDF, Markdown ou texto">
                <input type="file" id="abntFileInput" accept=".docx,.pdf,.md,.txt,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf,text/markdown,text/plain" hidden>
                <p class="abnt-dropzone__tit">Clique para selecionar ou arraste seu arquivo .docx, .pdf, .md ou .txt</p>
                <p class="abnt-dropzone__sub">Ou cole e edite seu trabalho diretamente no editor abaixo</p>
                <span class="abnt-dropzone__file" id="abntFileBadge" hidden></span>
              </div>

              <div class="abnt-toolbar" id="abntToolbar" role="toolbar" aria-label="Formatação rápida Markdown">
                <button type="button" class="abnt-tb-btn" data-md="h1" title="Seção primária (# 1 TÍTULO)">H1</button>
                <button type="button" class="abnt-tb-btn" data-md="h2" title="Seção secundária (## 1.1 Subtítulo)">H2</button>
                <button type="button" class="abnt-tb-btn" data-md="h3" title="Seção terciária (### 1.1.1 Detalhe)">H3</button>
                <span class="abnt-tb-sep"></span>
                <button type="button" class="abnt-tb-btn" data-md="bold" title="Negrito (**texto**)"><b>N</b></button>
                <button type="button" class="abnt-tb-btn" data-md="italic" title="Itálico (*texto*)"><i>I</i></button>
                <span class="abnt-tb-sep"></span>
                <button type="button" class="abnt-tb-btn" data-md="quote" title="Citação direta longa (> 3 linhas, recuo 4cm)">Citação</button>
                <button type="button" class="abnt-tb-btn" data-md="ul" title="Lista com marcadores (- item)">Lista</button>
                <button type="button" class="abnt-tb-btn" data-md="ol" title="Lista numerada (1. item)">1. Lista</button>
                <button type="button" class="abnt-tb-btn" data-md="table" title="Inserir tabela ABNT">Tabela</button>
                <button type="button" class="abnt-tb-btn" data-md="pb" title="Quebra de página (---)">Quebra</button>
                <button type="button" class="abnt-tb-btn" data-md="refs" title="Seção de Referências (# REFERÊNCIAS)">Referências</button>
              </div>

              <textarea class="abnt-textarea abnt-textarea--md" id="abntMdTexto" placeholder="# RESUMO&#10;...&#10;&#10;# 1 INTRODUÇÃO&#10;Escreva ou cole seu trabalho em Markdown aqui...&#10;&#10;# REFERÊNCIAS&#10;SOBRENOME, Nome. **Título**. Cidade: Editora, 2026.">${esc(rasc.md || "")}</textarea>

              <div class="abnt-stats" id="abntStats"></div>

              <details class="abnt-guia">
                <summary>Guia rápido de marcação Markdown para ABNT</summary>
                <ul>
                  <li><code># 1 INTRODUÇÃO</code> — Seção primária (MAIÚSCULA em negrito, inicia paginação ABNT sem contar a capa)</li>
                  <li><code>## 1.1 Subtítulo</code> — Seção secundária (MAIÚSCULA sem negrito)</li>
                  <li><code>### 1.1.1 Detalhe</code> — Seção terciária (Título em negrito)</li>
                  <li><code>&gt; Citação longa...</code> — Recuo 4 cm, fonte 10pt, espaçamento simples</li>
                  <li><code>**negrito**</code> e <code>*itálico*</code> — Formatação inline preservada no Word</li>
                  <li><code>- Item</code> ou <code>1. Item</code> — Listas com marcadores ou numeradas</li>
                  <li><code>| Coluna 1 | Coluna 2 |</code> — Tabelas no padrão ABNT (bordas horizontais limpas)</li>
                  <li><code>---</code> — Quebra de página manual</li>
                  <li><code># REFERÊNCIAS</code> — Ordenação alfabética automática (NBR 6023:2025)</li>
                </ul>
              </details>
            </section>

            <!-- 3. CONFIGURAÇÕES E GERAÇÃO -->
            <section class="abnt-card">
              <div class="abnt-card__head">
                <h2 class="abnt-card__tit"><span class="abnt-card__num">3</span> Configurações e Exportação</h2>
              </div>

              <div class="abnt-form-grid">
                <div class="abnt-field">
                  <label class="abnt-label" for="abntFonte">Fonte Padrão</label>
                  <select class="abnt-select" id="abntFonte">
                    <option value="Times New Roman">Times New Roman</option>
                    <option value="Arial">Arial</option>
                  </select>
                </div>
                <div class="abnt-field" style="justify-content:center;gap:8px;padding-top:16px">
                  <label class="abnt-check">
                    <input type="checkbox" id="abntChkSumario" ${val("incluirSumario") ? "checked" : ""}>
                    <span>Incluir Sumário automático</span>
                  </label>
                </div>
              </div>

              <div class="abnt-progresso-wrap">
                <div class="abnt-progresso-bar">
                  <div class="abnt-progresso-fill" id="abntProgressoFill"></div>
                </div>
                <p class="abnt-status" id="abntStatus">Aguardando...</p>
              </div>

              <div class="abnt-acoes-linha">
                <button type="button" class="botao botao--secundario" id="abntBtnValidar">Validar estrutura</button>
                <button type="button" class="botao botao--secundario" id="abntBtnPreview">Pré-visualizar ABNT</button>
                <button type="button" class="botao botao--primario abnt-btn-gerar" id="abntBtnGerar">Gerar Word ABNT (.docx)</button>
              </div>

              <div class="abnt-validacao" id="abntValidacaoBox" hidden></div>
            </section>
          </div>
        </div>
      </div>
    `;

    const $ = id => document.getElementById(id);
    $("abntFonte").value = val("fonte");

    function coletarMetadados() {
      return {
        instituicao: $("abntInstituicao").value.trim(),
        curso: $("abntCurso").value.trim(),
        autores: $("abntAutores").value.trim(),
        titulo: $("abntTitulo").value.trim(),
        subtitulo: $("abntSubtitulo").value.trim(),
        orientador: $("abntOrientador").value.trim(),
        nota: $("abntNota").value.trim(),
        cidade: $("abntCidade").value.trim(),
        ano: $("abntAno").value.trim(),
        fonte: $("abntFonte").value,
        incluirSumario: $("abntChkSumario").checked
      };
    }

    function persistir() {
      const m = coletarMetadados();
      salvarRascunho({ ...m, md: $("abntMdTexto").value });
    }

    function atualizarStatus(msg, pct) {
      $("abntStatus").textContent = msg;
      $("abntProgressoFill").style.width = `${Math.max(0, Math.min(100, pct))}%`;
    }

    function atualizarMetricas() {
      const md = $("abntMdTexto").value;
      const p = parseMarkdownABNT(md);
      $("abntStats").innerHTML = `
        <span class="abnt-stat">Linhas: <b>${p.stats.linhas}</b></span>
        <span class="abnt-stat">Palavras: <b>${p.stats.palavras}</b></span>
        <span class="abnt-stat">Seções: <b>${p.stats.titulos}</b></span>
        <span class="abnt-stat">Citações: <b>${p.stats.citacoes}</b></span>
        ${p.stats.tabelas ? `<span class="abnt-stat">Tabelas: <b>${p.stats.tabelas}</b></span>` : ""}
        <span class="abnt-stat">Referências: <b>${p.stats.referencias}</b></span>
      `;
    }

    // Debounce no auto-save e métricas para textos longos
    let timerInput = 0;
    const agendarAtualizacao = (recalcularMetricas) => {
      clearTimeout(timerInput);
      timerInput = setTimeout(() => {
        persistir();
        if (recalcularMetricas) atualizarMetricas();
      }, 180);
    };

    [
      "abntInstituicao", "abntCurso", "abntAutores", "abntTitulo",
      "abntSubtitulo", "abntOrientador", "abntNota", "abntCidade",
      "abntAno", "abntFonte", "abntMdTexto"
    ].forEach(id => {
      $(id).addEventListener("input", () => agendarAtualizacao(id === "abntMdTexto"));
    });
    $("abntChkSumario").addEventListener("change", () => persistir());

    // Toolbar rápida Markdown
    $("abntToolbar").addEventListener("click", e => {
      const btn = e.target.closest("[data-md]");
      if (!btn) return;
      const ed = $("abntMdTexto");
      const acao = btn.dataset.md;
      if (acao === "h1") inserirNoEditor(ed, "\n# 1 ", "", "TÍTULO DA SEÇÃO");
      else if (acao === "h2") inserirNoEditor(ed, "\n## 1.1 ", "", "Subtítulo da seção");
      else if (acao === "h3") inserirNoEditor(ed, "\n### 1.1.1 ", "", "Seção terciária");
      else if (acao === "bold") inserirNoEditor(ed, "**", "**", "texto em negrito");
      else if (acao === "italic") inserirNoEditor(ed, "*", "*", "texto em itálico");
      else if (acao === "quote") inserirNoEditor(ed, "\n> ", " (AUTOR, 2026).", "Texto da citação direta longa com mais de três linhas.");
      else if (acao === "ul") inserirNoEditor(ed, "\n- ", "", "Item da lista");
      else if (acao === "ol") inserirNoEditor(ed, "\n1. ", "", "Primeiro item numerado");
      else if (acao === "table") inserirNoEditor(ed, "\n| Coluna 1 | Coluna 2 |\n|---|---|\n| ", " | Valor 2 |\n", "Valor 1");
      else if (acao === "pb") inserirNoEditor(ed, "\n---\n", "", "");
      else if (acao === "refs") inserirNoEditor(ed, "\n# REFERÊNCIAS\n\n", "", "SOBRENOME, Nome. **Título da obra**. Cidade: Editora, 2026.");
    });

    // Upload / Drag & Drop de .docx, .pdf, .md e .txt com validação
    const dropzone = $("abntDropzone");
    const fileInput = $("abntFileInput");
    const fileBadge = $("abntFileBadge");

    async function lerArquivo(file) {
      if (!file) return;
      const nomeLower = String(file.name || "").toLowerCase();
      const ehDocx = nomeLower.endsWith(".docx");
      const ehPdf = nomeLower.endsWith(".pdf") || file.type === "application/pdf";
      const ehTexto = nomeLower.endsWith(".md") || nomeLower.endsWith(".txt") || String(file.type || "").startsWith("text/");

      if (!ehDocx && !ehPdf && !ehTexto) {
        toast("Formato não suportado. Envie um arquivo .docx, .pdf, .md ou .txt.", "erro", 4200);
        return;
      }
      if (file.size > MAX_FILE_BYTES) {
        toast("Arquivo muito grande (limite de 15 MB).", "erro", 4000);
        return;
      }

      try {
        let conteudo = "";
        if (ehDocx) {
          atualizarStatus(`Lendo arquivo Word (${file.name})...`, 35);
          conteudo = await extrairTextoDocx(file);
        } else if (ehPdf) {
          atualizarStatus(`Lendo PDF (${file.name})...`, 15);
          conteudo = await extrairTextoPdf(file, (pag, total) => {
            const pct = Math.round(15 + (pag / Math.max(total, 1)) * 75);
            atualizarStatus(`Extraindo texto do PDF (página ${pag} de ${total})...`, pct);
          });
        } else {
          conteudo = await file.text();
        }

        $("abntMdTexto").value = conteudo;
        nomeArquivoAtual = file.name;
        fileBadge.textContent = `Arquivo carregado: ${file.name}`;
        fileBadge.hidden = false;
        persistir();
        atualizarMetricas();
        atualizarStatus("Arquivo lido e carregado no editor! Confira a estrutura e gere na ABNT.", 100);
        toast(`Arquivo "${file.name}" importado com sucesso!`);
      } catch (e) {
        atualizarStatus(`Erro ao ler arquivo: ${e.message || e}`, 0);
        toast(e.message || "Não foi possível ler o arquivo selecionado.", "erro", 5000);
      }
    }

    dropzone.onclick = () => fileInput.click();
    dropzone.onkeydown = e => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileInput.click(); }
    };
    fileInput.onchange = () => {
      if (fileInput.files && fileInput.files[0]) lerArquivo(fileInput.files[0]);
      fileInput.value = "";
    };
    dropzone.addEventListener("dragover", e => {
      e.preventDefault();
      dropzone.classList.add("is-dragover");
    });
    dropzone.addEventListener("dragleave", () => dropzone.classList.remove("is-dragover"));
    dropzone.addEventListener("drop", e => {
      e.preventDefault();
      dropzone.classList.remove("is-dragover");
      const f = e.dataTransfer?.files?.[0];
      if (f) lerArquivo(f);
    });

    // Botões auxiliares
    $("abntBtnExemplo").onclick = () => {
      $("abntMdTexto").value = EXEMPLO_MD;
      nomeArquivoAtual = "exemplo_abnt.md";
      fileBadge.textContent = "Exemplo ABNT carregado";
      fileBadge.hidden = false;
      persistir();
      atualizarMetricas();
      atualizarStatus("Exemplo ABNT pronto para validar, visualizar ou gerar.", 0);
      toast("Exemplo ABNT carregado!");
    };

    $("abntBtnBaixarMd").onclick = () => {
      const md = $("abntMdTexto").value;
      if (!md.trim()) {
        toast("Não há texto no editor para baixar.", "erro");
        return;
      }
      const meta = coletarMetadados();
      const slug = (meta.titulo || "trabalho_abnt")
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 48) || "trabalho_abnt";
      const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${slug}.md`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 3000);
      toast("Rascunho .md salvo!");
    };

    $("abntBtnLimparMd").onclick = () => {
      $("abntMdTexto").value = "";
      nomeArquivoAtual = "";
      fileBadge.hidden = true;
      $("abntValidacaoBox").hidden = true;
      persistir();
      atualizarMetricas();
      atualizarStatus("Aguardando...", 0);
    };

    $("abntBtnReset").onclick = () => {
      $("abntInstituicao").value = "";
      $("abntCurso").value = "";
      $("abntAutores").value = "";
      $("abntTitulo").value = "";
      $("abntSubtitulo").value = "";
      $("abntOrientador").value = "";
      $("abntNota").value = "";
      $("abntCidade").value = "";
      $("abntAno").value = "";
      $("abntFonte").value = DEFAULTS.fonte;
      persistir();
      toast("Campos de metadados limpos.");
    };

    // 1. VALIDAR ESTRUTURA
    $("abntBtnValidar").onclick = () => {
      const md = $("abntMdTexto").value.trim();
      const meta = coletarMetadados();
      const box = $("abntValidacaoBox");
      if (!md) {
        box.className = "abnt-validacao abnt-validacao--erro";
        box.innerHTML = "<b>Conteúdo vazio:</b> selecione um arquivo <code>.md</code>/<code>.txt</code> ou cole seu trabalho no editor antes de validar.";
        box.hidden = false;
        return;
      }

      const parsed = parseMarkdownABNT(md);
      const avisos = [];
      if (!meta.titulo) avisos.push("O campo <b>Título</b> está vazio.");
      if (!meta.autores) avisos.push("O campo <b>Autor(es)</b> está vazio.");
      if (!parsed.stats.temGatilhoExplicito) {
        avisos.push("Nenhum cabeçalho padrão (<code># RESUMO</code> ou <code># 1 INTRODUÇÃO</code>) foi encontrado — o texto será formatado diretamente como corpo textual com paginação.");
      }
      if (parsed.stats.referencias === 0) {
        avisos.push("Nenhuma seção <code># REFERÊNCIAS</code> foi detectada (opcional, mas recomendada em trabalhos acadêmicos).");
      }

      box.className = avisos.length ? "abnt-validacao abnt-validacao--aviso" : "abnt-validacao";
      box.innerHTML = `
        <b>Validação concluída!</b> ${nomeArquivoAtual ? `(${esc(nomeArquivoAtual)})` : ""}
        <ul>
          <li><b>${parsed.stats.linhas}</b> linhas úteis e <b>${parsed.stats.palavras}</b> palavras carregadas.</li>
          <li><b>${parsed.preTextuais.length}</b> blocos pré-textuais, <b>${parsed.textuais.length}</b> blocos textuais, <b>${parsed.stats.tabelas}</b> tabela(s) e <b>${parsed.referencias.length}</b> referências (ordenação A–Z ativa).</li>
          ${avisos.map(a => `<li>${a}</li>`).join("")}
        </ul>
      `;
      box.hidden = false;
      atualizarStatus("Validação concluída. Pronto para gerar!", 0);
    };

    // 2. PRÉ-VISUALIZAR ABNT
    $("abntBtnPreview").onclick = () => {
      const md = $("abntMdTexto").value.trim();
      if (!md) {
        toast("Cole um texto ou carregue um arquivo Markdown para pré-visualizar.", "erro");
        return;
      }
      const meta = coletarMetadados();
      const parsed = parseMarkdownABNT(md);
      abrirModalPreview(meta, parsed);
    };

    // 3. GERAR DOCUMENTO ABNT (.docx)
    $("abntBtnGerar").onclick = async () => {
      const mdOriginal = $("abntMdTexto").value.trim();
      if (!mdOriginal) {
        toast("Selecione um arquivo Markdown ou cole seu texto primeiro!", "erro");
        return;
      }

      const btnGerar = $("abntBtnGerar");
      const btnValidar = $("abntBtnValidar");
      btnGerar.disabled = true;
      btnValidar.disabled = true;

      try {
        const meta = coletarMetadados();

        atualizarStatus("Fase 1: Estruturando Capa, Folha de Rosto e Seções ABNT...", 25);
        const parsed = parseMarkdownABNT(mdOriginal);

        atualizarStatus("Fase 2: Construindo documento Word (.docx) padrão ABNT...", 60);
        const blob = await construirDocxBlob(meta, parsed);

        atualizarStatus("Fase 3: Preparando download do arquivo Word...", 90);
        const slug = (meta.titulo || "Trabalho_ABNT_Final")
          .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 48) || "Trabalho_ABNT_Final";
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${slug}_ABNT.docx`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 3000);

        atualizarStatus("Concluído! Documento Word ABNT gerado com sucesso.", 100);
        toast("Documento Word ABNT gerado com sucesso!");
      } catch (e) {
        atualizarStatus(`Erro: ${e.message || e}`, 0);
        toast(e.message || "Ocorreu um erro ao gerar o documento.", "erro", 5000);
      } finally {
        btnGerar.disabled = false;
        btnValidar.disabled = false;
      }
    };

    atualizarMetricas();
  }

  function paginarBlocosEmFolhas(blocos, clsFonte) {
    if (!blocos.length) return [];
    const ALTURA_UTIL = 926; // 1123px - 113px (top) - 76px (bottom) - 8px folga

    // Cria medidor oculto com a mesma largura e tipografia exata da folha A4
    const medidor = document.createElement("div");
    medidor.className = `abnt-folha ${clsFonte}`;
    medidor.style.position = "fixed";
    medidor.style.left = "-99999px";
    medidor.style.top = "0";
    medidor.style.height = "auto";
    medidor.style.overflow = "visible";
    medidor.style.visibility = "hidden";
    medidor.style.pointerEvents = "none";
    document.body.appendChild(medidor);

    const paginas = [];
    let atual = [];

    const flush = () => {
      if (atual.length) {
        paginas.push(atual);
        atual = [];
      }
      medidor.innerHTML = "";
    };

    const renderElemento = (b) => {
      if (b.tipo === "lista") {
        const tag = b.ordenada ? "ol" : "ul";
        const el = document.createElement(tag);
        if (b.ordenada && b.num) el.start = Number(b.num) || 1;
        el.innerHTML = `<li>${inlineParaHtml(b.texto)}</li>`;
        return el;
      }
      const wrap = document.createElement("div");
      if (b.tipo === "titulo_pre") {
        wrap.innerHTML = `<p class="abnt-folha__pre-tit">${esc(b.texto)}</p>`;
      } else if (b.tipo === "sumario_item") {
        const peso = (b.nivel === 1 || b.nivel >= 3) ? "font-weight:700;" : "";
        const pad = (b.nivel - 1) * 18;
        wrap.innerHTML = `<p class="abnt-folha__sumario-item" style="padding-left:${pad}px;${peso}"><span>${esc(b.texto)}</span></p>`;
      } else if (b.tipo === "ref_tit") {
        wrap.innerHTML = `<p class="abnt-folha__ref-tit">REFERÊNCIAS</p>`;
      } else if (b.tipo === "ref_item") {
        wrap.innerHTML = `<p class="abnt-folha__ref-item">${inlineParaHtml(b.texto)}</p>`;
      } else if (b.tipo === "tabela") {
        wrap.innerHTML = `<table><thead><tr>${b.cabecalho.map(c => `<th>${inlineParaHtml(c)}</th>`).join("")}</tr></thead><tbody>${b.corpo.map(r => `<tr>${r.map(c => `<td>${inlineParaHtml(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
      } else if (b.tipo === "citacao") {
        wrap.innerHTML = `<blockquote>${inlineParaHtml(b.texto)}</blockquote>`;
      } else if (b.tipo === "titulo") {
        if (b.nivel === 1) wrap.innerHTML = `<h1>${inlineParaHtml(b.texto.toUpperCase())}</h1>`;
        else if (b.nivel === 2) wrap.innerHTML = `<h2>${inlineParaHtml(b.texto.toUpperCase())}</h2>`;
        else wrap.innerHTML = `<h3>${inlineParaHtml(toTitleCase(b.texto))}</h3>`;
      } else {
        const cls = b.semRecuo ? ' class="abnt-folha__sem-recuo"' : "";
        wrap.innerHTML = `<p${cls}>${inlineParaHtml(b.texto)}</p>`;
      }
      return wrap.firstElementChild;
    };

    try {
      for (const b of blocos) {
        if (b.tipo === "page_break") {
          flush();
          continue;
        }
        if (b.tipo === "titulo" && b.quebraAntes && atual.length > 0) {
          flush();
        }

        const el = renderElemento(b);
        if (!el) continue;
        medidor.appendChild(el);

        // Altura útil atual (descontando padding 113 + 76 = 189px)
        const alturaConteudo = medidor.scrollHeight - 189;
        if (alturaConteudo > ALTURA_UTIL && atual.length > 0) {
          medidor.removeChild(el);
          flush();
          medidor.appendChild(el);
          atual.push(b);
        } else {
          atual.push(b);
        }
      }
      flush();
    } finally {
      medidor.remove();
    }

    return paginas;
  }

  function renderPaginaHtml(blocos) {
    let html = "";
    let tipoLista = null;
    const fecharLista = () => {
      if (tipoLista) { html += `</${tipoLista}>`; tipoLista = null; }
    };
    for (const b of blocos) {
      if (b.tipo === "lista") {
        const tag = b.ordenada ? "ol" : "ul";
        if (tipoLista !== tag) {
          fecharLista();
          const startAttr = (b.ordenada && b.num && Number(b.num) > 1) ? ` start="${Number(b.num)}"` : "";
          html += `<${tag}${startAttr}>`;
          tipoLista = tag;
        }
        html += `<li>${inlineParaHtml(b.texto)}</li>`;
        continue;
      }
      fecharLista();
      if (b.tipo === "titulo_pre") html += `<p class="abnt-folha__pre-tit">${esc(b.texto)}</p>`;
      else if (b.tipo === "sumario_item") {
        const peso = (b.nivel === 1 || b.nivel >= 3) ? "font-weight:700;" : "";
        const pad = (b.nivel - 1) * 18;
        html += `<p class="abnt-folha__sumario-item" style="padding-left:${pad}px;${peso}"><span>${esc(b.texto)}</span></p>`;
      } else if (b.tipo === "ref_tit") html += `<p class="abnt-folha__ref-tit">REFERÊNCIAS</p>`;
      else if (b.tipo === "ref_item") html += `<p class="abnt-folha__ref-item">${inlineParaHtml(b.texto)}</p>`;
      else if (b.tipo === "tabela") html += `<table><thead><tr>${b.cabecalho.map(c => `<th>${inlineParaHtml(c)}</th>`).join("")}</tr></thead><tbody>${b.corpo.map(r => `<tr>${r.map(c => `<td>${inlineParaHtml(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
      else if (b.tipo === "citacao") html += `<blockquote>${inlineParaHtml(b.texto)}</blockquote>`;
      else if (b.tipo === "titulo") {
        if (b.nivel === 1) html += `<h1>${inlineParaHtml(b.texto.toUpperCase())}</h1>`;
        else if (b.nivel === 2) html += `<h2>${inlineParaHtml(b.texto.toUpperCase())}</h2>`;
        else html += `<h3>${inlineParaHtml(toTitleCase(b.texto))}</h3>`;
      } else {
        const cls = b.semRecuo ? ' class="abnt-folha__sem-recuo"' : "";
        html += `<p${cls}>${inlineParaHtml(b.texto)}</p>`;
      }
    }
    fecharLista();
    return html;
  }

  function abrirModalPreview(meta, parsed) {
    const clsFonte = meta.fonte === "Arial" ? "abnt-folha--arial" : "abnt-folha--times";
    const fundo = document.createElement("div");
    fundo.className = "abnt-preview-fundo";

    const autoresHtml = extrairAutores(meta.autores).map(a => `<div>${esc(a.toUpperCase())}</div>`).join("");
    const temSumarioManual = parsed.preTextuais.some(b => b.tipo === "titulo_pre" && (b.texto === "SUMÁRIO" || b.texto === "SUMARIO"));
    const temSumarioAuto = meta.incluirSumario && !temSumarioManual && parsed.sumarioItens.length > 0;

    // Monta blocos do sumário automático
    const blocosSumario = [];
    if (temSumarioAuto) {
      blocosSumario.push({ tipo: "titulo_pre", texto: "SUMÁRIO" });
      for (const item of parsed.sumarioItens) {
        const txt = item.nivel === 1 ? item.texto.toUpperCase()
          : item.nivel === 2 ? item.texto.toUpperCase()
          : toTitleCase(item.texto);
        blocosSumario.push({ tipo: "sumario_item", nivel: item.nivel, texto: txt });
      }
      if (parsed.referencias.length > 0) {
        blocosSumario.push({ tipo: "sumario_item", nivel: 1, texto: "REFERÊNCIAS" });
      }
    }

    // Monta blocos das referências
    const blocosRef = [];
    if (parsed.referencias.length > 0) {
      blocosRef.push({ tipo: "ref_tit" });
      for (const r of parsed.referencias) {
        blocosRef.push({ tipo: "ref_item", texto: r });
      }
    }

    // Pagina cada seção em folhas A4 reais (794x1123px)
    const paginasPre = paginarBlocosEmFolhas(parsed.preTextuais, clsFonte);
    const paginasSumario = paginarBlocosEmFolhas(blocosSumario, clsFonte);
    const paginasTextuais = paginarBlocosEmFolhas(parsed.textuais, clsFonte);
    const paginasRef = paginarBlocosEmFolhas(blocosRef, clsFonte);

    // Contagem ABNT NBR 14724: Capa não conta; Folha de Rosto = pág. 1
    let pagAtual = 1; // Folha de Rosto
    const folhasHtml = [];

    // Capa
    folhasHtml.push(`
      <div class="abnt-folha-wrap">
        <span class="abnt-folha-tag">Capa · fora da contagem</span>
        <article class="abnt-folha abnt-folha--capa ${clsFonte}">
          <div class="abnt-folha__bloco-centro">
            <div><strong>${esc(meta.instituicao.toUpperCase())}</strong></div>
            <div><strong>${esc(meta.curso.toUpperCase())}</strong></div>
            <div style="margin-top:70px">${autoresHtml}</div>
          </div>
          <div class="abnt-folha__bloco-centro">
            <div><strong>${esc(meta.titulo.toUpperCase())}</strong></div>
            ${meta.subtitulo ? `<div>${esc(meta.subtitulo)}</div>` : ""}
          </div>
          <div class="abnt-folha__bloco-centro">
            <div>${esc(meta.cidade)}</div>
            <div>${esc(meta.ano)}</div>
          </div>
        </article>
      </div>
    `);

    // Folha de Rosto
    folhasHtml.push(`
      <div class="abnt-folha-wrap">
        <span class="abnt-folha-tag">Folha de Rosto · pág. 1 (oculta)</span>
        <article class="abnt-folha abnt-folha--rosto ${clsFonte}">
          <div class="abnt-folha__bloco-centro">${autoresHtml}</div>
          <div class="abnt-folha__bloco-centro">
            <div><strong>${esc(meta.titulo.toUpperCase())}</strong></div>
            ${meta.subtitulo ? `<div>${esc(meta.subtitulo)}</div>` : ""}
          </div>
          <div class="abnt-folha__nota">
            ${meta.nota ? `<div style="margin-bottom:14px">${esc(meta.nota)}</div>` : ""}
            ${meta.orientador ? `<div>Orientador: ${esc(meta.orientador)}</div>` : ""}
          </div>
          <div class="abnt-folha__bloco-centro">
            <div>${esc(meta.cidade)}</div>
            <div>${esc(meta.ano)}</div>
          </div>
        </article>
      </div>
    `);

    // Pré-textuais
    for (const pg of paginasPre) {
      pagAtual++;
      folhasHtml.push(`
        <div class="abnt-folha-wrap">
          <span class="abnt-folha-tag">Pré-textual · pág. ${pagAtual} (oculta)</span>
          <article class="abnt-folha ${clsFonte}">${renderPaginaHtml(pg)}</article>
        </div>
      `);
    }

    // Sumário
    for (const pg of paginasSumario) {
      pagAtual++;
      folhasHtml.push(`
        <div class="abnt-folha-wrap">
          <span class="abnt-folha-tag">Sumário · pág. ${pagAtual} (oculta)</span>
          <article class="abnt-folha ${clsFonte}">${renderPaginaHtml(pg)}</article>
        </div>
      `);
    }

    // Textuais (com numeração visível no canto superior direito)
    for (const pg of paginasTextuais) {
      pagAtual++;
      folhasHtml.push(`
        <div class="abnt-folha-wrap">
          <span class="abnt-folha-tag">Página ${pagAtual}</span>
          <article class="abnt-folha ${clsFonte}">
            <span class="abnt-folha__num">${pagAtual}</span>
            ${renderPaginaHtml(pg)}
          </article>
        </div>
      `);
    }

    // Referências
    for (const pg of paginasRef) {
      pagAtual++;
      folhasHtml.push(`
        <div class="abnt-folha-wrap">
          <span class="abnt-folha-tag">Referências · pág. ${pagAtual}</span>
          <article class="abnt-folha ${clsFonte}">
            <span class="abnt-folha__num">${pagAtual}</span>
            ${renderPaginaHtml(pg)}
          </article>
        </div>
      `);
    }

    const totalFolhas = folhasHtml.length;

    fundo.innerHTML = `
      <div class="abnt-preview-caixa" role="dialog" aria-modal="true" aria-label="Pré-visualização ABNT">
        <div class="abnt-preview-topo">
          <div class="abnt-preview-topo__info">
            <h3>Pré-visualização ABNT (${totalFolhas} ${totalFolhas === 1 ? "folha" : "folhas"} A4)</h3>
            <small>${esc(meta.fonte)} · Margens 3×3×2×2 cm · Capa fora da contagem</small>
          </div>
          <div class="abnt-preview-controles">
            <div class="abnt-zoom-ctrl" aria-label="Controle de zoom">
              <button type="button" data-zoom="menos" title="Diminuir zoom">−</button>
              <span class="abnt-zoom-val" data-zoom-val>100%</span>
              <button type="button" data-zoom="mais" title="Aumentar zoom">+</button>
              <button type="button" data-zoom="fit" title="Ajustar à tela">Ajustar</button>
            </div>
            <button type="button" class="botao botao--primario" data-acao="baixar" style="padding:7px 14px;font-size:13px">Baixar Word (.docx)</button>
            <button type="button" class="botao botao--secundario" data-acao="fechar" style="padding:7px 14px;font-size:13px">Fechar</button>
          </div>
        </div>
        <div class="abnt-preview-corpo" data-preview-corpo>
          <div class="abnt-preview-paginas" data-preview-paginas>
            ${folhasHtml.join("")}
          </div>
        </div>
      </div>
    `;

    const corpoEl = fundo.querySelector("[data-preview-corpo]");
    const paginasEl = fundo.querySelector("[data-preview-paginas]");
    const zoomValEl = fundo.querySelector("[data-zoom-val]");

    let zoomAtual = 1;
    function calcularZoomAjuste() {
      const disp = (corpoEl?.clientWidth || window.innerWidth) - 40;
      return Math.max(0.42, Math.min(1, disp / 794));
    }
    function aplicarZoom(z) {
      zoomAtual = Math.max(0.4, Math.min(1.3, Math.round(z * 100) / 100));
      paginasEl.style.zoom = String(zoomAtual);
      if (zoomValEl) zoomValEl.textContent = `${Math.round(zoomAtual * 100)}%`;
    }

    const onEsc = e => { if (e.key === "Escape") fechar(); };
    function fechar() {
      document.removeEventListener("keydown", onEsc);
      fundo.remove();
    }

    fundo.addEventListener("mousedown", e => { if (e.target === fundo) fechar(); });
    fundo.querySelector('[data-acao="fechar"]').onclick = fechar;
    fundo.querySelector('[data-zoom="menos"]').onclick = () => aplicarZoom(zoomAtual - 0.1);
    fundo.querySelector('[data-zoom="mais"]').onclick = () => aplicarZoom(zoomAtual + 0.1);
    fundo.querySelector('[data-zoom="fit"]').onclick = () => aplicarZoom(calcularZoomAjuste());
    fundo.querySelector('[data-acao="baixar"]').onclick = () => {
      fechar();
      const btn = document.getElementById("abntBtnGerar");
      if (btn) btn.click();
    };
    document.addEventListener("keydown", onEsc);

    document.body.appendChild(fundo);
    aplicarZoom(calcularZoomAjuste());
  }

  window.EJGeradorABNT = {
    abrir() {
      const sec = document.getElementById("geradorAbnt");
      if (!sec) return;
      montarInterface(sec);
    }
  };
})();
