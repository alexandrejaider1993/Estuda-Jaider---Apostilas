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
  const icGoogle = `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M21.35 11.1h-9.17v2.73h6.51c-.33 1.81-1.5 3.34-3.2 4.37v3.62h5.18c3.03-2.79 4.78-6.9 4.78-11.72 0-.8-.08-1.57-.23-2.3z" opacity=".85"/><path fill="currentColor" d="M12.18 22c4.32 0 7.95-1.43 10.6-3.88l-5.18-3.62c-1.43.96-3.27 1.53-5.42 1.53-4.17 0-7.7-2.81-8.96-6.59H-2.1v3.74C.54 18.43 5.93 22 12.18 22z" opacity=".7"/><path fill="currentColor" d="M3.22 9.44A9.55 9.55 0 0 1 2.71 6.4c0-1.06.18-2.09.51-3.04V-.38H-2.1A15.93 15.93 0 0 0-3.82 6.4c0 2.58.62 5.02 1.72 7.18l5.32-4.14z" opacity=".55"/><path fill="currentColor" d="M12.18 2.77c2.35 0 4.46.81 6.12 2.4l4.59-4.59C20.12-1.99 16.5-3.6 12.18-3.6 5.93-3.6.54-.03-2.1 5.22l5.32 4.14c1.26-3.78 4.79-6.59 8.96-6.59z"/></svg>`;

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
    if (btnEntrar) {
      btnEntrar.innerHTML = `<span>Entrar</span>${icSeta}`;
      raiz.querySelector('[data-slot="acoes"]').append(btnEntrar);
    }
    if (btnGoogle) {
      btnGoogle.innerHTML = `${icGoogle}<span>Entrar com Google</span>`;
      raiz.querySelector('[data-slot="acoes"]').append(btnGoogle);
    }
    if (dica) raiz.querySelector('[data-slot="dica"]').append(dica);

    raiz.querySelector(".bv11__l1").textContent = saudacaoHorario() + ",";
    raiz.querySelector(".bv11__l2").innerHTML = 'vamos <span class="bv11__ouro">estudar?</span>';
  }

  montar();
})();
