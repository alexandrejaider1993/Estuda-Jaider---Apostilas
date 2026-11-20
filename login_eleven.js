/* Tela de boas-vindas (login) no estilo ElevenLabs (composição em papel e dourado).
 *   - manchete serifada: "Bom dia/Boa tarde/Boa noite," + "vamos estudar?" em itálico dourado (Source Serif 4 Italic)
 *   - subtítulo com "medicina" sublinhada em dourado (sem qualquer menção a IA)
 *   - botões: "Entrar com Google" (salva o progresso no Google Drive do aluno) e "Entrar" (estudar agora)
 *   - ilustração central recortada (base_recorte.webp + flores.webp + pétalas + ORGANIZAR? / ACEITAR)
 *   - linha animada "Constância" com 7 arcos em SMIL SVG.
 */
(function () {
  "use strict";

  function svgConstancia() {
    const CICLO = 7, PASSO = 0.8, N = 7, arcos = [];
    const t = v => (v / CICLO).toFixed(4);
    for (let i = 0; i < N; i++) {
      const x = 14 + i * 30, ini = t(i * PASSO), fim = t((i + 1) * PASSO);
      const tempos = i === 0 ? `0;${fim};1` : `0;${ini};${fim};1`, valores = i === 0 ? "1;0;0" : "1;1;0;0";
      arcos.push(`<path class="bv11__arco" pathLength="1" d="M${x} 30 a15 15 0 0 1 30 0">` +
        `<animate attributeName="stroke-dashoffset" dur="${CICLO}s" repeatCount="indefinite" keyTimes="${tempos}" values="${valores}"/>` +
        `<animate attributeName="opacity" dur="${CICLO}s" repeatCount="indefinite" keyTimes="0;0.86;0.95;1" values="1;1;0;0"/></path>`);
    }
    const trilha = "M14 30" + " a15 15 0 0 1 30 0".repeat(N);
    return `<svg viewBox="0 0 240 34" aria-hidden="true"><path d="M8 30 H232"/><path id="bv11Trilha" d="${trilha}"/>${arcos.join("")}` +
      `<circle cx="8" cy="30" r="2.6"/><circle cx="232" cy="30" r="2.6"/>` +
      `<circle class="bv11__bola" r="3" opacity="0"><animateMotion dur="${CICLO}s" repeatCount="indefinite" calcMode="linear" keyPoints="0;1;1" keyTimes="0;${t(N * PASSO)};1"><mpath href="#bv11Trilha"/></animateMotion>` +
      `<animate attributeName="opacity" dur="${CICLO}s" repeatCount="indefinite" keyTimes="0;0.02;${t(N * PASSO - 0.1)};${t(N * PASSO + 0.15)};1" values="0;1;1;0;0"/></circle></svg>`;
  }

  const tela = document.getElementById("telaBoasVindas");
  if (!tela || tela.dataset.bv11) return;
  tela.dataset.bv11 = "1";
  const $ = id => document.getElementById(id);

  const icSeta = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>`;
  const icGoogle = `<svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>`;

  const raiz = document.createElement("div");
  raiz.className = "bv11 bv11--arte";
  raiz.innerHTML = `
    <header class="bv11__topo">
      <span class="bv11__marca">estuda Jaider</span>
      <span class="bv11__topo-dir" data-slot="tema"></span>
    </header>

    <div class="bv11__palco">
      <div class="bv11__hero">
        <h1 class="bv11__titulo"><span class="bv11__l1"></span><em class="bv11__l2"></em></h1>
        <p class="bv11__sub">Estude, grife e revise suas apostilas de <span class="bv11__grifo">medicina<svg viewBox="0 0 100 12" preserveAspectRatio="none" aria-hidden="true"><path d="M2 8.5 C 22 4, 48 3.2, 70 5.6 S 92 9.4, 98 4"/></svg></span>,<br>tudo num lugar só.</p>
        <div class="bv11__acoes" data-slot="acoes"></div>
        <div class="bv11__dica" data-slot="dica"></div>
      </div>

      <div class="bv11__cena" aria-hidden="true">
        <div class="bv11__arte" aria-hidden="true">
          <img class="bv11__arte-base" src="assets/login_ilustracao/base_recorte.webp?v=2" alt="" draggable="false">
          <img class="bv11__arte-flores" src="assets/login_ilustracao/flores.webp" alt="" draggable="false">
          <i class="bv11__petala bv11__petala--1"></i><i class="bv11__petala bv11__petala--2"></i><i class="bv11__petala bv11__petala--3"></i>
          <div class="bv11__arte-dialogo"><b>ORGANIZAR?</b><span>ACEITAR</span></div>
          <span class="bv11__arte-close"></span>
          <svg class="bv11__arte-cursor" viewBox="0 0 24 24"><path d="M5 3l14 8-6 1.6L9.6 19z" fill="#1d1d1f" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/></svg>
        </div>
        <div class="bv11__constancia">
          ${svgConstancia()}
          <span>Constância</span>
        </div>
      </div>
    </div>`;

  (function pararConstanciaSeReduzir() {
    const svg = raiz.querySelector(".bv11__constancia svg"), mq = matchMedia("(prefers-reduced-motion: reduce)");
    const aplicar = () => {
      if (!svg || !svg.pauseAnimations) return;
      if (mq.matches) { svg.setCurrentTime(0); svg.pauseAnimations(); } else svg.unpauseAnimations();
    };
    aplicar();
    if (mq.addEventListener) mq.addEventListener("change", aplicar);
  })();

  function saudacaoHorario() {
    const h = new Date().getHours();
    if (h >= 5 && h < 12) return "Bom dia";
    if (h >= 12 && h < 18) return "Boa tarde";
    return "Boa noite";
  }

  function montar() {
    tela.append(raiz);
    const btnTema = $("btnTemaLogin");
    const btnEntrar = $("btnEntrarSistema");
    const btnGoogle = $("btnEntrarGoogle");
    const dica = tela.querySelector(".tela-boasvindas__atalho-dica");

    if (btnTema) raiz.querySelector('[data-slot="tema"]').append(btnTema);
    if (btnEntrar) btnEntrar.remove();
    if (btnGoogle) {
      btnGoogle.innerHTML = `${icGoogle}<span>Entrar com Google</span>`;
      raiz.querySelector('[data-slot="acoes"]').append(btnGoogle);
    }
    if (dica) dica.remove();

    raiz.querySelector(".bv11__l1").textContent = saudacaoHorario() + ",";
    raiz.querySelector(".bv11__l2").innerHTML = 'vamos <span class="bv11__ouro">estudar?</span>';
  }

  montar();
})();
