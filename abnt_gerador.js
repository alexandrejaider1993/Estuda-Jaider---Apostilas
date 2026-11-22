/* ==========================================================================
   Gerador ABNT 2026 — Módulo Web Completo (Estuda Jaider)
   100% local no navegador (Word .docx, PDF A4 e Pré-visualização ABNT)
   ========================================================================== */
(function () {
  "use strict";

  const STORAGE_KEY = "ej_abnt_rascunho_v1";
  const DOCX_SRC = "assets/docx.umd.js";

  const DEFAULTS = {
    instituicao: "Faculdade Santa Marcelina - FASM",
    curso: "Curso de Medicina | Disciplina de Gestão em Saúde",
    autores: "Alexandre Jaider, Gabriela Nascimento, Sara Andrade, Sophia Andreoni",
    titulo: "QUESTÕES JURÍDICAS E CONFLITOS COM O CÓDIGO DE ÉTICA MÉDICA",
    subtitulo: "Fundamentos, esferas de responsabilidade e gestão de riscos",
    orientador: "Prof. Dr. Gustavo Oliveira",
    nota: "Trabalho Acadêmico apresentado à disciplina de Gestão em Saúde do Curso de Medicina da FASM, como requisito parcial para obtenção de nota regimental.",
    cidade: "São Paulo - SP",
    ano: "2026",
    fonte: "Times New Roman"
  };

  const EXEMPLO_MD = `# RESUMO

Este trabalho analisa os fundamentos jurídicos e éticos que regem o exercício da medicina no Brasil, com foco na articulação entre o Código de Ética Médica e as esferas civil, penal e administrativa de responsabilidade profissional.

**Palavras-chave:** Ética Médica. Responsabilidade Civil. Gestão de Riscos. Direito Médico.

# 1. INTRODUÇÃO

A prática médica contemporânea exige não apenas domínio técnico-científico, mas também sólida compreensão dos deveres éticos e legais que norteiam a relação médico-paciente. A judicialização da saúde ampliou a necessidade de documentação clínica rigorosa e de comunicação transparente.

## 1.1 Esferas de responsabilidade

O profissional médico responde de forma independente nas esferas ética (Conselhos Regionais de Medicina), civil (indenização por dano material, moral ou estético) e penal (tipificação de condutas culposas ou dolosas).

> A responsabilidade civil do profissional liberal depende da verificação de culpa, conforme estabelecido no Código de Defesa do Consumidor, exigindo demonstração de negligência, imprudência ou imperícia na condução do ato médico. (BRASIL, 1990).

### 1.1.1 Documentação e prontuário

- Registro claro, legível e cronológico de todas as condutas adotadas;
- Termo de Consentimento Livre e Esclarecido (TCLE) individualizado;
- Comunicação empática com o paciente e seus familiares.

# 2. CONSIDERAÇÕES FINAIS

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
  function carregarDocxLib() {
    if (window.docx) return Promise.resolve(window.docx);
    if (docxPromise) return docxPromise;
    docxPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = DOCX_SRC;
      s.async = true;
      s.onload = () => {
        if (window.docx) resolve(window.docx);
        else reject(new Error("Biblioteca DOCX carregada, mas objeto global não encontrado."));
      };
      s.onerror = () => {
        docxPromise = null;
        reject(new Error("Não foi possível carregar a biblioteca geradora de Word (assets/docx.umd.js)."));
      };
      document.head.appendChild(s);
    });
    return docxPromise;
  }

  /* ================= PARSER INLINE (**negrito**, *itálico*) ================= */
  function parseInlineSegments(texto) {
    const segs = [];
    const regex = /(\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|\*[^*]+\*)/g;
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

  /* ================= PARSER ESTRUTURAL ABNT ================= */
  function parseMarkdownABNT(mdText) {
    const linhas = String(mdText || "").replace(/\r\n/g, "\n").split("\n");
    const preTextuais = [];
    const textuais = [];
    const referencias = [];

    const gatilhosInicio = ["RESUMO", "ABSTRACT", "SUMÁRIO", "SUMARIO"];
    const gatilhosTextuais = ["1. INTRODUÇÃO", "1 INTRODUÇÃO", "INTRODUÇÃO"];

    let estado = "IGNORAR_INICIO";
    let paginacaoAtivada = false;
    let temGatilhoExplicito = false;

    // Pré-verifica se existe algum gatilho no documento
    for (const raw of linhas) {
      const limpa = raw.trim().replace(/<[^>]+>/g, "").replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1");
      if (!limpa) continue;
      const up = limpa.toUpperCase().replace(/\*\*/g, "").replace(/#/g, "").trim();
      if (gatilhosInicio.includes(up) || gatilhosTextuais.includes(up) || /^\d+\.\s+/.test(up) || up === "REFERÊNCIAS" || up === "REFERENCIAS") {
        temGatilhoExplicito = true;
        break;
      }
    }

    // Se o aluno colou um texto sem RESUMO nem 1. INTRODUÇÃO, não descartamos o conteúdo!
    if (!temGatilhoExplicito) {
      estado = "CORPO";
      paginacaoAtivada = true;
    }

    let titulosCount = 0;
    let citacoesCount = 0;
    let listasCount = 0;
    let paragrafosCount = 0;

    for (const raw of linhas) {
      let linha = raw.trim();
      linha = linha.replace(/<[^>]+>/g, "");
      linha = linha.replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1");
      if (!linha) continue;

      const upperLine = linha.toUpperCase().replace(/\*\*/g, "").replace(/#/g, "").trim();

      if (gatilhosTextuais.includes(upperLine) || (/^\d+\.\s+/.test(upperLine) && !paginacaoAtivada)) {
        paginacaoAtivada = true;
        estado = "CORPO";
      } else if (gatilhosInicio.includes(upperLine)) {
        if (preTextuais.length > 0) {
          preTextuais.push({ tipo: "page_break" });
        }
        estado = "CORPO_PRE_TEXTUAL";
      } else if (upperLine === "REFERÊNCIAS" || upperLine === "REFERENCIAS") {
        estado = "REFERENCIAS";
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

      if (linha.startsWith(">")) {
        citacoesCount++;
        destino.push({ tipo: "citacao", texto: linha.replace(/^>\s*/, "").trim() });
        continue;
      }

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
        continue;
      }

      if (linha.startsWith("- ") || linha.startsWith("* ")) {
        listasCount++;
        destino.push({ tipo: "lista", texto: linha.slice(2).trim() });
        continue;
      }

      paragrafosCount++;
      destino.push({ tipo: "paragrafo", texto: linha });
    }

    // Ordenação alfabética ABNT NBR 6023:2025
    referencias.sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));

    return {
      preTextuais,
      textuais,
      referencias,
      stats: {
        linhas: linhas.filter(l => l.trim()).length,
        palavras: String(mdText || "").trim() ? String(mdText).trim().split(/\s+/).length : 0,
        titulos: titulosCount,
        citacoes: citacoesCount,
        listas: listasCount,
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
      Header, PageNumber, SectionType, PageBreak, convertMillimetersToTwip
    } = D;

    const fonte = meta.fonte || "Times New Roman";
    const PT = pt => pt * 20;      // twips (spacing)
    const HP = pt => pt * 2;       // half-points (font size)
    const CM = cm => convertMillimetersToTwip(cm * 10);

    const margensABNT = {
      top: CM(3.0),
      left: CM(3.0),
      bottom: CM(2.0),
      right: CM(2.0),
      header: CM(1.5),
      footer: CM(1.5)
    };

    const pageA4 = {
      width: CM(21.0),
      height: CM(29.7)
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

    function pCentralizado(texto, { bold = false, spaceAfterPt = 0, size = 12 } = {}) {
      return new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: PT(spaceAfterPt), line: 360 },
        children: [new TextRun({
          text: texto,
          bold,
          font: fonte,
          size: HP(size),
          color: "000000"
        })]
      });
    }

    function blocoParaParagraphs(bloco) {
      if (bloco.tipo === "page_break") {
        return [new Paragraph({ children: [new PageBreak()] })];
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
        if (bloco.nivel === 1) {
          txt = txt.toUpperCase();
          bold = true;
        } else if (bloco.nivel === 2) {
          txt = txt.toUpperCase();
          bold = false;
        } else {
          txt = toTitleCase(txt);
          bold = true;
        }
        res.push(new Paragraph({
          alignment: AlignmentType.LEFT,
          indent: { firstLine: 0 },
          spacing: {
            before: PT(bloco.nivel === 1 ? 18 : 12),
            after: PT(12),
            line: 360
          },
          children: runsInline(txt, { bold, size: 12 })
        }));
        return res;
      }
      if (bloco.tipo === "lista") {
        return [new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          bullet: { level: 0 },
          spacing: { line: 360, after: PT(4) },
          children: runsInline(bloco.texto, { size: 12 })
        })];
      }
      return [new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        indent: { firstLine: CM(1.25) },
        spacing: { line: 360, after: PT(6) },
        children: runsInline(bloco.texto, { size: 12 })
      })];
    }

    // --- SEÇÃO 1: CAPA + FOLHA DE ROSTO + PRÉ-TEXTUAIS (sem número de página visível) ---
    const preChildren = [];

    // Capa
    if (meta.instituicao) preChildren.push(pCentralizado(meta.instituicao.toUpperCase(), { bold: true }));
    if (meta.curso) preChildren.push(pCentralizado(meta.curso.toUpperCase(), { bold: true, spaceAfterPt: 90 }));
    if (meta.autores) preChildren.push(pCentralizado(meta.autores.toUpperCase(), { spaceAfterPt: 130 }));
    if (meta.titulo) preChildren.push(pCentralizado(meta.titulo.toUpperCase(), { bold: true, spaceAfterPt: meta.subtitulo ? 6 : 130 }));
    if (meta.subtitulo) preChildren.push(pCentralizado(meta.subtitulo, { spaceAfterPt: 130 }));
    preChildren.push(new Paragraph({ text: "" }));
    if (meta.cidade) preChildren.push(pCentralizado(meta.cidade));
    if (meta.ano) preChildren.push(pCentralizado(meta.ano));
    preChildren.push(new Paragraph({ children: [new PageBreak()] }));

    // Folha de Rosto
    if (meta.autores) preChildren.push(pCentralizado(meta.autores.toUpperCase(), { spaceAfterPt: 90 }));
    if (meta.titulo) preChildren.push(pCentralizado(meta.titulo.toUpperCase(), { bold: true, spaceAfterPt: meta.subtitulo ? 6 : 60 }));
    if (meta.subtitulo) preChildren.push(pCentralizado(meta.subtitulo, { spaceAfterPt: 60 }));

    if (meta.nota) {
      preChildren.push(new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        indent: { left: CM(8.0) },
        spacing: { line: 240, after: PT(24) },
        children: [new TextRun({ text: meta.nota, font: fonte, size: HP(10), color: "000000" })]
      }));
    }
    if (meta.orientador) {
      preChildren.push(new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        indent: { left: CM(8.0) },
        spacing: { line: 240, after: PT(90) },
        children: [new TextRun({ text: `Orientador: ${meta.orientador}`, font: fonte, size: HP(10), color: "000000" })]
      }));
    }
    preChildren.push(new Paragraph({ text: "" }));
    if (meta.cidade) preChildren.push(pCentralizado(meta.cidade));
    if (meta.ano) preChildren.push(pCentralizado(meta.ano));

    // Pré-textuais (Resumo, Abstract, Sumário)
    if (parsed.preTextuais.length > 0) {
      preChildren.push(new Paragraph({ children: [new PageBreak()] }));
      for (const b of parsed.preTextuais) {
        preChildren.push(...blocoParaParagraphs(b));
      }
    }

    // --- SEÇÃO 2: ELEMENTOS TEXTUAIS + REFERÊNCIAS (com paginação ABNT no cabeçalho direito 10pt) ---
    const textualChildren = [];
    for (const b of parsed.textuais) {
      textualChildren.push(...blocoParaParagraphs(b));
    }

    if (parsed.referencias.length > 0) {
      if (textualChildren.length > 0) {
        textualChildren.push(new Paragraph({ children: [new PageBreak()] }));
      }
      textualChildren.push(pCentralizado("REFERÊNCIAS", { bold: true, spaceAfterPt: 12 }));
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
      {
        properties: {
          page: { size: pageA4, margin: margensABNT }
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
    let emLista = false;
    const fecharLista = () => {
      if (emLista) { html += "</ul>"; emLista = false; }
    };
    for (const b of blocos) {
      if (b.tipo === "lista") {
        if (!emLista) { html += "<ul>"; emLista = true; }
        html += `<li>${inlineParaHtml(b.texto)}</li>`;
        continue;
      }
      fecharLista();
      if (b.tipo === "page_break") {
        html += `<div class="abnt-pb"></div>`;
      } else if (b.tipo === "citacao") {
        html += `<blockquote>${inlineParaHtml(b.texto)}</blockquote>`;
      } else if (b.tipo === "titulo") {
        const cls = b.quebraAntes ? ' class="abnt-pb-before"' : "";
        if (b.nivel === 1) html += `<h1${cls}>${inlineParaHtml(b.texto.toUpperCase())}</h1>`;
        else if (b.nivel === 2) html += `<h2${cls}>${inlineParaHtml(b.texto.toUpperCase())}</h2>`;
        else html += `<h3${cls}>${inlineParaHtml(toTitleCase(b.texto))}</h3>`;
      } else {
        html += `<p>${inlineParaHtml(b.texto)}</p>`;
      }
    }
    fecharLista();
    return html;
  }

  function exportarPdfViaImpressao(meta, parsed) {
    const fonteCss = meta.fonte === "Arial" ? "Arial, Helvetica, sans-serif" : '"Times New Roman", Times, Georgia, serif';
    const refHtml = parsed.referencias.length
      ? `<div class="abnt-pb"></div>
         <p class="ref-tit">REFERÊNCIAS</p>
         ${parsed.referencias.map(r => `<p class="ref-item">${inlineParaHtml(r)}</p>`).join("")}`
      : "";

    const preHtml = parsed.preTextuais.length
      ? `<div class="abnt-pb"></div><section class="abnt-corpo">${blocosParaHtml(parsed.preTextuais)}</section>`
      : "";

    const corpoHtml = parsed.textuais.length
      ? `<div class="abnt-pb"></div><section class="abnt-corpo">${blocosParaHtml(parsed.textuais)}</section>`
      : "";

    const docHtml = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>${esc(meta.titulo || "Trabalho ABNT")}</title>
<style>
  @page {
    size: A4;
    margin: 3cm 2cm 2cm 3cm;
  }
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    background: #fff;
    color: #000;
    font-family: ${fonteCss};
    font-size: 12pt;
    line-height: 1.5;
  }
  .pagina-capa, .pagina-rosto {
    min-height: 24.5cm;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    text-align: center;
    page-break-after: always;
    break-after: page;
  }
  .centro { text-align: center; }
  .bold { font-weight: 700; }
  .upper { text-transform: uppercase; }
  .nota-rosto {
    margin-left: 8cm;
    text-align: justify;
    font-size: 10pt;
    line-height: 1.15;
  }
  .nota-rosto p { margin: 0 0 14pt; text-indent: 0; }
  .abnt-pb { page-break-before: always; break-before: page; }
  .abnt-pb-before { page-break-before: always; break-before: page; }
  .abnt-corpo h1 { font-size: 12pt; font-weight: 700; text-transform: uppercase; margin: 18pt 0 12pt; text-align: left; }
  .abnt-corpo h2 { font-size: 12pt; font-weight: 400; text-transform: uppercase; margin: 12pt 0 12pt; text-align: left; }
  .abnt-corpo h3 { font-size: 12pt; font-weight: 700; margin: 12pt 0 12pt; text-align: left; }
  .abnt-corpo p { margin: 0 0 6pt; text-align: justify; text-indent: 1.25cm; }
  .abnt-corpo blockquote { margin: 12pt 0 12pt 4cm; font-size: 10pt; line-height: 1.05; text-align: justify; }
  .abnt-corpo ul { margin: 6pt 0 10pt; padding-left: 1.5cm; text-align: justify; }
  .ref-tit { text-align: center; font-weight: 700; text-transform: uppercase; margin: 0 0 12pt; text-indent: 0; }
  .ref-item { text-align: left; text-indent: 0; line-height: 1.05; margin: 0 0 12pt; }
</style>
</head>
<body>
  <section class="pagina-capa">
    <div class="centro">
      <div class="bold upper">${esc(meta.instituicao)}</div>
      <div class="bold upper">${esc(meta.curso)}</div>
      <div class="upper" style="margin-top: 3cm">${esc(meta.autores)}</div>
    </div>
    <div class="centro">
      <div class="bold upper">${esc(meta.titulo)}</div>
      ${meta.subtitulo ? `<div>${esc(meta.subtitulo)}</div>` : ""}
    </div>
    <div class="centro">
      <div>${esc(meta.cidade)}</div>
      <div>${esc(meta.ano)}</div>
    </div>
  </section>

  <section class="pagina-rosto">
    <div class="centro upper">${esc(meta.autores)}</div>
    <div class="centro">
      <div class="bold upper">${esc(meta.titulo)}</div>
      ${meta.subtitulo ? `<div>${esc(meta.subtitulo)}</div>` : ""}
    </div>
    <div class="nota-rosto">
      ${meta.nota ? `<p>${esc(meta.nota)}</p>` : ""}
      ${meta.orientador ? `<p>Orientador: ${esc(meta.orientador)}</p>` : ""}
    </div>
    <div class="centro">
      <div>${esc(meta.cidade)}</div>
      <div>${esc(meta.ano)}</div>
    </div>
  </section>

  ${preHtml}
  ${corpoHtml}
  ${refHtml}
</body>
</html>`;

    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(docHtml);
    doc.close();

    setTimeout(() => {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch (e) {
        toast("Não foi possível abrir a janela de impressão/PDF.", "erro");
      }
      setTimeout(() => iframe.remove(), 4000);
    }, 350);
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

  function montarInterface(container) {
    if (montado) return;
    montado = true;

    const rasc = lerRascunho() || {};
    const val = (k) => rasc[k] !== undefined ? rasc[k] : (DEFAULTS[k] || "");

    container.innerHTML = `
      <div class="abnt-wrap">
        <div class="abnt-hero">
          <div>
            <span class="abnt-badge">ABNT NBR 14724 · NBR 6023:2025</span>
            <h1 class="abnt-hero__tit">Gerador e Formatador ABNT</h1>
            <p class="abnt-hero__sub">Transforme seu texto em Markdown em um trabalho acadêmico completo com capa, folha de rosto, margens oficiais (3×3×2×2 cm), paginação a partir da introdução e referências ordenadas.</p>
          </div>
          <div class="abnt-hero__acoes">
            <button type="button" class="abnt-btn-mini" id="abntBtnExemplo">Carregar exemplo ABNT</button>
            <button type="button" class="abnt-btn-mini" id="abntBtnReset">Restaurar padrão</button>
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
                  <input class="abnt-input" id="abntInstituicao" value="${esc(val("instituicao"))}">
                </div>
                <div class="abnt-field abnt-field--full">
                  <label class="abnt-label" for="abntCurso">Curso / Disciplina</label>
                  <input class="abnt-input" id="abntCurso" value="${esc(val("curso"))}">
                </div>
                <div class="abnt-field abnt-field--full">
                  <label class="abnt-label" for="abntAutores">Autor(es)</label>
                  <input class="abnt-input" id="abntAutores" value="${esc(val("autores"))}">
                </div>
                <div class="abnt-field abnt-field--full">
                  <label class="abnt-label" for="abntTitulo">Título</label>
                  <input class="abnt-input" id="abntTitulo" value="${esc(val("titulo"))}">
                </div>
                <div class="abnt-field abnt-field--full">
                  <label class="abnt-label" for="abntSubtitulo">Subtítulo (opcional)</label>
                  <input class="abnt-input" id="abntSubtitulo" value="${esc(val("subtitulo"))}">
                </div>
                <div class="abnt-field abnt-field--full">
                  <label class="abnt-label" for="abntOrientador">Orientador</label>
                  <input class="abnt-input" id="abntOrientador" value="${esc(val("orientador"))}">
                </div>
                <div class="abnt-field abnt-field--full">
                  <label class="abnt-label" for="abntNota">Nota de Apresentação (Folha de Rosto)</label>
                  <textarea class="abnt-textarea" id="abntNota" rows="3">${esc(val("nota"))}</textarea>
                </div>
                <div class="abnt-field">
                  <label class="abnt-label" for="abntCidade">Cidade - UF</label>
                  <input class="abnt-input" id="abntCidade" value="${esc(val("cidade"))}">
                </div>
                <div class="abnt-field">
                  <label class="abnt-label" for="abntAno">Ano</label>
                  <input class="abnt-input" id="abntAno" value="${esc(val("ano"))}">
                </div>
              </div>
            </section>
          </div>

          <!-- COLUNA DIREITA: MARKDOWN + CONFIGURAÇÕES E GERAÇÃO -->
          <div class="abnt-col">
            <!-- 2. ARQUIVO / CONTEÚDO MARKDOWN -->
            <section class="abnt-card">
              <div class="abnt-card__head">
                <h2 class="abnt-card__tit"><span class="abnt-card__num">2</span> Conteúdo do Trabalho (.md ou texto)</h2>
                <button type="button" class="abnt-btn-mini" id="abntBtnLimparMd">Limpar texto</button>
              </div>

              <div class="abnt-dropzone" id="abntDropzone" tabindex="0" role="button" aria-label="Selecionar arquivo Markdown ou texto">
                <input type="file" id="abntFileInput" accept=".md,.txt,text/markdown,text/plain" hidden>
                <p class="abnt-dropzone__tit">Clique para selecionar ou arraste seu arquivo .md / .txt</p>
                <p class="abnt-dropzone__sub">Ou cole e edite seu trabalho diretamente no editor abaixo</p>
                <span class="abnt-dropzone__file" id="abntFileBadge" hidden></span>
              </div>

              <textarea class="abnt-textarea abnt-textarea--md" id="abntMdTexto" placeholder="# RESUMO&#10;...&#10;&#10;# 1. INTRODUÇÃO&#10;Escreva ou cole seu trabalho em Markdown aqui...&#10;&#10;# REFERÊNCIAS&#10;SOBRENOME, Nome. **Título**. Cidade: Editora, 2026.">${esc(rasc.md || "")}</textarea>

              <div class="abnt-stats" id="abntStats"></div>

              <details class="abnt-guia">
                <summary>Guia rápido de marcação Markdown para ABNT</summary>
                <ul>
                  <li><code># 1. INTRODUÇÃO</code> — Seção primária (MAIÚSCULA em negrito, inicia paginação ABNT)</li>
                  <li><code>## 1.1 Subtítulo</code> — Seção secundária (MAIÚSCULA sem negrito)</li>
                  <li><code>### 1.1.1 Detalhe</code> — Seção terciária (Título em negrito)</li>
                  <li><code>&gt; Citação longa...</code> — Recuo 4 cm, fonte 10pt, espaçamento simples</li>
                  <li><code>**negrito**</code> e <code>*itálico*</code> — Formatação inline preservada no Word e PDF</li>
                  <li><code>- Item de lista</code> — Lista com marcadores</li>
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
                <div class="abnt-field" style="justify-content:center;gap:8px;padding-top:14px">
                  <label class="abnt-check">
                    <input type="checkbox" id="abntChkWord" checked>
                    <span>Gerar Word (.docx)</span>
                  </label>
                  <label class="abnt-check">
                    <input type="checkbox" id="abntChkPdf">
                    <span>Gerar PDF (.pdf / Impressão A4)</span>
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
                <button type="button" class="botao botao--primario abnt-btn-gerar" id="abntBtnGerar">Gerar Documento ABNT</button>
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
        fonte: $("abntFonte").value
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
        <span class="abnt-stat">Referências: <b>${p.stats.referencias}</b></span>
      `;
    }

    // Auto-save rascunho local
    [
      "abntInstituicao", "abntCurso", "abntAutores", "abntTitulo",
      "abntSubtitulo", "abntOrientador", "abntNota", "abntCidade",
      "abntAno", "abntFonte", "abntMdTexto"
    ].forEach(id => {
      $(id).addEventListener("input", () => {
        persistir();
        if (id === "abntMdTexto") atualizarMetricas();
      });
    });

    // Upload / Drag & Drop de .md / .txt
    const dropzone = $("abntDropzone");
    const fileInput = $("abntFileInput");
    const fileBadge = $("abntFileBadge");

    function lerArquivo(file) {
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        $("abntMdTexto").value = String(reader.result || "");
        nomeArquivoAtual = file.name;
        fileBadge.textContent = `Arquivo carregado: ${file.name}`;
        fileBadge.hidden = false;
        persistir();
        atualizarMetricas();
        atualizarStatus("Arquivo lido e carregado na memória com sucesso!", 0);
        toast(`Arquivo "${file.name}" carregado!`);
      };
      reader.onerror = () => {
        toast("Não foi possível ler o arquivo selecionado.", "erro");
      };
      reader.readAsText(file, "UTF-8");
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
      $("abntInstituicao").value = DEFAULTS.instituicao;
      $("abntCurso").value = DEFAULTS.curso;
      $("abntAutores").value = DEFAULTS.autores;
      $("abntTitulo").value = DEFAULTS.titulo;
      $("abntSubtitulo").value = DEFAULTS.subtitulo;
      $("abntOrientador").value = DEFAULTS.orientador;
      $("abntNota").value = DEFAULTS.nota;
      $("abntCidade").value = DEFAULTS.cidade;
      $("abntAno").value = DEFAULTS.ano;
      $("abntFonte").value = DEFAULTS.fonte;
      persistir();
      toast("Metadados restaurados para o padrão.");
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
        avisos.push("Nenhum cabeçalho padrão (<code># RESUMO</code> ou <code># 1. INTRODUÇÃO</code>) foi encontrado — o texto será formatado diretamente como corpo textual com paginação.");
      }
      if (parsed.stats.referencias === 0) {
        avisos.push("Nenhuma seção <code># REFERÊNCIAS</code> foi detectada (opcional, mas recomendada em trabalhos acadêmicos).");
      }

      box.className = avisos.length ? "abnt-validacao abnt-validacao--aviso" : "abnt-validacao";
      box.innerHTML = `
        <b>Validação concluída!</b> ${nomeArquivoAtual ? `(${esc(nomeArquivoAtual)})` : ""}
        <ul>
          <li><b>${parsed.stats.linhas}</b> linhas úteis e <b>${parsed.stats.palavras}</b> palavras carregadas.</li>
          <li><b>${parsed.preTextuais.length}</b> blocos pré-textuais, <b>${parsed.textuais.length}</b> blocos textuais e <b>${parsed.referencias.length}</b> referências (ordenação A–Z ativa).</li>
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

    // 3. GERAR DOCUMENTO ABNT
    $("abntBtnGerar").onclick = async () => {
      const mdOriginal = $("abntMdTexto").value.trim();
      if (!mdOriginal) {
        toast("Selecione um arquivo Markdown ou cole seu texto primeiro!", "erro");
        return;
      }
      const gerarWord = $("abntChkWord").checked;
      const gerarPdf = $("abntChkPdf").checked;
      if (!gerarWord && !gerarPdf) {
        toast("Marque ao menos um formato de saída (Word ou PDF)!", "erro");
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

        if (gerarWord) {
          atualizarStatus("Fase 2: Construindo documento Word (.docx) padrão ABNT...", 55);
          const blob = await construirDocxBlob(meta, parsed);

          atualizarStatus("Fase 3: Preparando download do arquivo Word...", 85);
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
        }

        if (gerarPdf) {
          atualizarStatus("Abrindo impressão A4 para salvar em PDF...", 94);
          exportarPdfViaImpressao(meta, parsed);
        }

        atualizarStatus("Concluído! Documento ABNT gerado com sucesso.", 100);
        toast("Documento ABNT gerado com sucesso!");
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

  function abrirModalPreview(meta, parsed) {
    const clsFonte = meta.fonte === "Arial" ? "abnt-folha--arial" : "abnt-folha--times";
    const fundo = document.createElement("div");
    fundo.className = "abnt-preview-fundo";

    const pagPre = parsed.preTextuais.length
      ? `<article class="abnt-folha ${clsFonte}">${blocosParaHtml(parsed.preTextuais)}</article>`
      : "";

    const pagNumInicio = 3 + (parsed.preTextuais.length ? 1 : 0);
    const pagTextual = parsed.textuais.length
      ? `<article class="abnt-folha ${clsFonte}">
           <span class="abnt-folha__num">${pagNumInicio}</span>
           ${blocosParaHtml(parsed.textuais)}
         </article>`
      : "";

    const pagRef = parsed.referencias.length
      ? `<article class="abnt-folha ${clsFonte}">
           <span class="abnt-folha__num">${pagNumInicio + (parsed.textuais.length ? 1 : 0)}</span>
           <p class="abnt-folha__ref-tit">REFERÊNCIAS</p>
           ${parsed.referencias.map(r => `<p class="abnt-folha__ref-item">${inlineParaHtml(r)}</p>`).join("")}
         </article>`
      : "";

    fundo.innerHTML = `
      <div class="abnt-preview-caixa" role="dialog" aria-modal="true" aria-label="Pré-visualização ABNT">
        <div class="abnt-preview-topo">
          <h3>Pré-visualização ABNT (${esc(meta.fonte)} · Margens 3×3×2×2 cm)</h3>
          <div style="display:flex;gap:8px">
            <button type="button" class="botao botao--primario" data-acao="pdf" style="padding:7px 14px;font-size:13px">Salvar como PDF</button>
            <button type="button" class="botao botao--secundario" data-acao="fechar" style="padding:7px 14px;font-size:13px">Fechar</button>
          </div>
        </div>
        <div class="abnt-preview-corpo">
          <!-- CAPA -->
          <article class="abnt-folha abnt-folha--capa ${clsFonte}">
            <div class="abnt-folha__bloco-centro">
              <div><strong>${esc(meta.instituicao.toUpperCase())}</strong></div>
              <div><strong>${esc(meta.curso.toUpperCase())}</strong></div>
              <div style="margin-top:80px">${esc(meta.autores.toUpperCase())}</div>
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

          <!-- FOLHA DE ROSTO -->
          <article class="abnt-folha abnt-folha--rosto ${clsFonte}">
            <div class="abnt-folha__bloco-centro">${esc(meta.autores.toUpperCase())}</div>
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

          ${pagPre}
          ${pagTextual}
          ${pagRef}
        </div>
      </div>
    `;

    const fechar = () => fundo.remove();
    fundo.addEventListener("mousedown", e => { if (e.target === fundo) fechar(); });
    fundo.querySelector('[data-acao="fechar"]').onclick = fechar;
    fundo.querySelector('[data-acao="pdf"]').onclick = () => exportarPdfViaImpressao(meta, parsed);
    const onEsc = e => { if (e.key === "Escape") { fechar(); document.removeEventListener("keydown", onEsc); } };
    document.addEventListener("keydown", onEsc);

    document.body.appendChild(fundo);
  }

  window.EJGeradorABNT = {
    abrir() {
      const sec = document.getElementById("geradorAbnt");
      if (!sec) return;
      montarInterface(sec);
    }
  };
})();
