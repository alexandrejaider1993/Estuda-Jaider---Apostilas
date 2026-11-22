/*
  Apostilas interativas (ferramenta #interativos).

  Lista as apostilas da pasta Interativos/ (GET /api/interativos) em cartões e abre o site
  escolhido num <iframe> dentro da ferramenta. O site fala com esta página por postMessage
  (ponte do pacote estuda-jaider-site):
    site -> página  {ej:1, req, acao, dados}       acao: ola | lerProgresso | salvarProgresso | perguntarIA
    página -> site  {ej:1, req, ok, valor}
  O progresso vai para Interativos/<pasta>/progresso-<PC>.json; a IA usa o ChatGPT conectado ou as chaves.
*/
(function () {
  "use strict";
  const ID = "interativos";
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const toast = (m, t = "sucesso", d = 3000) => (window.mostrarToast ? window.mostrarToast(m, t, d) : console.log(m));
  let lista = [], aberta = null, montado = false;
  const ICP_NOVA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 10v6"/><path d="M9 13h6"/><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>';
  const ICP_SALVAR_PC = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>';
  const ehAdmin = () => !!(window.EJStorageDrive && window.EJStorageDrive.ehAdmin && window.EJStorageDrive.ehAdmin());

  const CSS = `
  #interativos .ia-barra { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin: 0 0 14px; }
  #interativos .ia-barra p { margin: 0; color: var(--cor-suave); font-size: 13.5px; }
  #interativos .ia-grade { display: grid; grid-template-columns: repeat(auto-fill, minmax(176px, 210px)); gap: 16px; }
  #interativos .ia-card { display: flex; flex-direction: column; text-align: left; padding: 0; overflow: hidden; cursor: pointer;
    aspect-ratio: 6 / 10; background: var(--cor-superficie); border: 1px solid var(--cor-borda, var(--cor-fio)); border-radius: 14px; box-shadow: var(--sombra-card);
    color: var(--cor-texto, var(--cor-tinta)); font: inherit; transition: box-shadow var(--duracao) var(--curva), transform var(--duracao) var(--curva); }
  #interativos .ia-card:hover { box-shadow: var(--sombra-card-hover); transform: translateY(-2px); }
  #interativos .ia-card:focus-visible { outline: 2px solid var(--cor-acento); outline-offset: 2px; }
  #interativos .ia-capa { flex: 1 1 0; min-height: 0; background: var(--cor-superficie-2); display: flex; align-items: stretch; justify-content: center; color: var(--cor-suave); overflow: hidden; }
  #interativos .ia-capa .pv-arte { width: 100%; height: 100%; aspect-ratio: auto; }
  #interativos .ia-capa .pv-arte svg { width: 100%; height: 100%; display: block; }
  #interativos .ia-capa img { width: 100%; height: 100%; object-fit: cover; display: block; }
  #interativos .ia-corpo { flex: none; padding: 10px 12px 11px; display: flex; flex-direction: column; gap: 3px; background: var(--cor-superficie); border-top: 1px solid var(--cor-fio); }
  #interativos .ia-meta { font-size: 10.5px; font-weight: 600; color: var(--cor-suave); text-transform: uppercase; letter-spacing: .04em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  #interativos .ia-titulo { font-size: 14px; font-weight: 600; margin: 0; line-height: 1.25; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  #interativos .ia-sub { font-size: 12px; color: var(--cor-suave); margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  #interativos .ia-rodape { margin-top: 2px; padding-top: 4px; display: flex; justify-content: space-between; align-items: center; gap: 6px; font-size: 11.5px; color: var(--cor-suave); }
  #interativos .ia-acao { color: var(--cor-acento); font-weight: 600; }
  #interativos .ia-vazio { padding: 32px; text-align: center; color: var(--cor-suave); border: 1px dashed var(--cor-borda-forte); border-radius: var(--raio-card); }
  #interativos .ia-vazio b { color: var(--cor-texto); font-weight: 600; }
  /* pastas (18/11/2026) */
  #interativos .ia-onde { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
  #interativos .ia-trilha { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; font-size: 18px; line-height: 26px; }
  #interativos .ia-trilha-item { border: 0; background: none; padding: 2px 6px; margin: 0 -6px; border-radius: 6px; color: var(--cor-suave); font: inherit; cursor: pointer; }
  #interativos .ia-trilha-item:hover { color: var(--cor-tinta); background: var(--cor-superficie-2); }
  #interativos .ia-trilha-atual { font-weight: 600; color: var(--cor-tinta); padding: 2px 6px; margin: 0 -6px; border-radius: 6px; }
  #interativos .ia-trilha-sep { color: var(--cor-suave); }
  #interativos .ia-nova { display: inline-flex; align-items: center; gap: 6px; }
  #interativos .ia-nova svg { width: 16px; height: 16px; }
  #interativos .ia-pastas { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; }
  #interativos .ia-item { position: relative; display: flex; }
  #interativos .ia-item > .ia-card { flex: 1; }
  #interativos .ia-item.ia-arrastando { opacity: .45; }
  #interativos .ia-pasta { flex: 1; display: flex; align-items: center; gap: 12px; min-width: 0; padding: 14px 44px 14px 14px; text-align: left; cursor: pointer;
    border: 1px solid var(--cor-borda, var(--cor-fio)); border-radius: 14px; background: var(--cor-superficie); color: var(--cor-tinta); font: inherit; }
  #interativos .ia-pasta:hover { background: var(--cor-superficie-2); }
  #interativos .ia-pasta-ic { display: block; width: 100%; flex: none; color: var(--cor-suave); }
  #interativos .ia-pasta-ic > svg { width: 40px; height: 40px; }
  #interativos .ia-pasta-ic .pv-arte svg { width: 100%; height: 100%; }
  /* pasta grande, como uma pasta de verdade (pasta_visual.js): desenho em cima, nome embaixo */
  #interativos .ia-pastas { grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); }
  #interativos .ia-item--pasta .ia-pasta { flex-direction: column; align-items: stretch; gap: 10px; padding: 14px 14px 12px; }
  #interativos .ia-item--pasta .ia-mais { top: auto; bottom: 10px; transform: none; }
  #interativos .ia-item--pasta .ia-pasta-txt { padding-right: 30px; }
  #interativos .ia-pasta-ic svg { width: 18px; height: 18px; }
  #interativos .ia-pasta-txt { display: flex; flex-direction: column; min-width: 0; }
  #interativos .ia-pasta-txt b { font-weight: 600; font-size: 15px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  #interativos .ia-pasta-txt small { font-size: 12px; color: var(--cor-suave); }
  #interativos .ia-mais { position: absolute; top: 50%; right: 8px; transform: translateY(-50%); display: grid; place-items: center; width: 30px; height: 30px; border: 0; border-radius: 8px;
    background: transparent; color: var(--cor-suave); cursor: pointer; }
  #interativos .ia-mais svg { width: 18px; height: 18px; }
  #interativos .ia-mais:hover { background: var(--cor-fio); color: var(--cor-tinta); }
  #interativos .ia-mais--card { top: 8px; transform: none; background: var(--cor-superficie); box-shadow: 0 0 0 1px var(--cor-fio); }
  #interativos .ia-pasta:focus-visible, #interativos .ia-mais:focus-visible, #interativos .ia-trilha-item:focus-visible { outline: 2px solid var(--cor-tinta); outline-offset: 2px; }
  #interativos .ia-alvo { outline: 2px dashed var(--cor-veia) !important; outline-offset: 2px; border-radius: 14px; }
  #interativos .ia-alvo .ia-pasta { background: var(--cor-veia-fundo); }
  .ia-menu { position: fixed; z-index: 10050; min-width: 200px; max-height: 60vh; overflow-y: auto; padding: 6px; border: 1px solid var(--cor-fio); border-radius: 12px; background: var(--cor-superficie); box-shadow: 0 8px 28px rgba(0,0,0,.18); font-family: var(--fonte-ui); }
  .ia-menu button { display: block; width: 100%; padding: 8px 12px; border: 0; border-radius: 8px; background: transparent; color: var(--cor-tinta); font: 400 14px var(--fonte-ui); text-align: left; cursor: pointer; }
  .ia-menu button:hover:not(:disabled), .ia-menu button:focus-visible { background: var(--cor-superficie-2); outline: 0; }
  .ia-menu button:disabled { color: var(--cor-suave); cursor: default; }
  .ia-menu button.perigo { color: var(--cor-arteria); }
  .ia-dlg-fundo { position: fixed; inset: 0; z-index: 10060; display: grid; place-items: center; padding: 16px; background: rgba(0,0,0,.32); }
  .ia-dlg { width: min(420px, 100%); padding: 20px; border-radius: 16px; background: var(--cor-superficie); color: var(--cor-tinta); box-shadow: 0 16px 48px rgba(0,0,0,.24); font-family: var(--fonte-ui); }
  .ia-dlg h2 { margin: 0 0 6px; font: 600 17px/24px var(--fonte-ui); }
  .ia-dlg p { margin: 0 0 12px; font-size: 14px; line-height: 20px; color: var(--cor-suave); }
  .ia-dlg-campo { width: 100%; box-sizing: border-box; margin: 6px 0 14px; }
  .ia-dlg-acoes { display: flex; justify-content: flex-end; gap: 8px; }
  #interativos .ia-dom { color: var(--cor-tinta); font-weight: 600; }
  .ia-dlg--largo { width: min(620px, 100%); max-height: 86vh; display: flex; flex-direction: column; }
  .ia-dom-lista { list-style: none; margin: 0 0 14px; padding: 0; overflow-y: auto; min-height: 0; }
  .ia-dom-lista li { display: grid; grid-template-columns: minmax(0, 1fr) 120px 44px; grid-template-rows: auto auto; column-gap: 12px; align-items: center; padding: 8px 0; border-top: 1px solid var(--cor-fio); font-size: 14px; }
  .ia-dom-lista li small { grid-column: 1; color: var(--cor-suave); font-size: 12px; }
  .ia-dom-nome { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .ia-dom-lista b { text-align: right; font-weight: 600; font-variant-numeric: tabular-nums; }
  .ia-dom-barra { height: 6px; border-radius: 3px; background: var(--cor-fio); overflow: hidden; --c: var(--cor-arteria); }
  .ia-dom-barra[data-nivel="media"] { --c: var(--cor-nervo); }
  .ia-dom-barra[data-nivel="alta"] { --c: var(--cor-linfa); }
  .ia-dom-barra i { display: block; height: 100%; background: var(--c); }
  .ia-dlg .ia-dlg-perigo { background: var(--cor-arteria); color: #fff; border-color: var(--cor-arteria); }
  #interativos .ia-leitor { display: none; flex-direction: column; gap: 8px; }
  #interativos.ia-lendo .ia-leitor { display: flex; }
  #interativos.ia-lendo .ia-lista { display: none; }
  #interativos .ia-leitor-topo { display: flex; align-items: center; gap: 10px; }
  #interativos .ia-leitor-topo b { font-weight: 600; font-size: 15px; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  #interativos .ia-ponte { font-size: 12px; color: var(--cor-suave); }
  #interativos .ia-quadro { width: 100%; border: 1px solid var(--cor-borda); border-radius: var(--raio-caixa); background: #fff; display: block; }
  #interativos.ia-lendo { max-width: none; padding-top: 8px; padding-bottom: 8px; }
  #interativos.ia-max { position: fixed; inset: 0; z-index: 10000; margin: 0; max-width: none; width: auto; padding: 8px 12px; background: var(--cor-fundo); overflow: hidden; }
  #interativos .ia-max-btn { display: inline-flex; align-items: center; gap: 6px; }
  /* tela cheia só com a apostila: sem a barra de cima nem o estojo (o estojo volta pela barrinha) */
  #interativos.ia-max { padding: 0 !important; z-index: 2147483001 !important; overflow: hidden !important; }
  #interativos.ia-max .ia-palco, #interativos.ia-max .ia-leitor { overflow: hidden; }
  html.ej-apostila-max .app-shell-header, html.ej-apostila-max .nav, html.ej-apostila-max .painel-dir,
  html.ej-apostila-max #divisoriaPainel, html.ej-apostila-max #divisoriaLateral, html.ej-apostila-max .wb-tab-bar { visibility: hidden !important; }
  html.ej-apostila-max, html.ej-apostila-max body { overflow: hidden !important; }
  #interativos.ia-max .ia-leitor { gap: 0; }
  #interativos.ia-max .ia-leitor-topo { display: none; }
  #interativos.ia-max .ia-quadro { border: 0; border-radius: 0; }
  #interativos.ia-max:not(.ia-max-estojo) .ia-estojo { display: none !important; }
  #interativos.ia-max:not(.ia-max-estojo) .ia-palco.com-estojo .ia-quadro { width: 100%; }
  #interativos .ia-max-barra { display: none; }
  #interativos.ia-max .ia-max-barra.reserva { display: flex; position: absolute; top: 10px; right: 50%; transform: translate(50%, -8px); z-index: 5; gap: 4px; padding: 4px;
    border-radius: 12px; background: var(--cor-superficie); box-shadow: 0 0 0 1px var(--cor-fio), 0 8px 24px rgba(0,0,0,.16); opacity: 0; pointer-events: none;
    transition: opacity .2s, transform .2s; }
  #interativos.ia-max .ia-max-barra.ver, #interativos.ia-max .ia-max-barra:focus-within { opacity: 1; pointer-events: auto; transform: translate(50%, 0); }
  #interativos .ia-max-barra button { height: 32px; padding: 0 12px; border: 0; border-radius: 8px; background: transparent; color: var(--cor-tinta); font: 600 13px var(--fonte-ui); cursor: pointer; }
  #interativos .ia-max-barra button:hover { background: var(--cor-superficie-2); }
  #interativos .ia-max-barra button[aria-pressed="true"] { background: var(--cor-tinta); color: var(--cor-superficie); }
  #interativos .ia-max-barra button:focus-visible { outline: 2px solid var(--cor-tinta); outline-offset: 2px; }
  @media (prefers-reduced-motion: reduce) { #interativos .ia-max-barra { transition: none; } }
  #interativos .ia-max-btn svg { width: 16px; height: 16px; }
  /* Estojo: barra flutuante sobre a apostila (o motor fica em web/estojo_apostila.js, dentro do quadro) */
  #interativos .ia-palco { position: relative; }
  #interativos .ia-palco.com-estojo .ia-quadro { width: calc(100% - 60px); }   /* faixa própria: a barra não cobre o texto */
  :is(#interativos, .ej-estojo-host) .ia-estojo { position: absolute; right: 0; top: 50%; transform: translateY(-50%); z-index: 3; display: flex; align-items: flex-start; gap: 8px; }
  #interativos .ia-estojo[hidden] { display: none; }
  :is(#interativos, .ej-estojo-host) .ia-estojo-barra { display: flex; flex-direction: column; gap: 2px; padding: 6px; border-radius: 14px; background: var(--cor-superficie);
    box-shadow: 0 0 0 1px var(--cor-fio), 0 8px 28px rgba(0,0,0,.14); }
  :is(#interativos, .ej-estojo-host) .ia-estojo-barra hr { width: 22px; margin: 4px auto; border: 0; border-top: 1px solid var(--cor-fio); }
  :is(#interativos, .ej-estojo-host) .ia-ferr { position: relative; width: 36px; height: 36px; display: grid; place-items: center; border: 0; border-radius: 9px; background: transparent;
    color: var(--cor-tinta); cursor: pointer; }
  :is(#interativos, .ej-estojo-host) .ia-ferr svg { width: 19px; height: 19px; }
  :is(#interativos, .ej-estojo-host) .ia-ferr:hover { background: var(--cor-superficie-2); }
  :is(#interativos, .ej-estojo-host) .ia-ferr[aria-pressed="true"] { background: var(--cor-tinta); color: var(--cor-superficie); }
  :is(#interativos, .ej-estojo-host) .ia-ferr:disabled { opacity: .35; cursor: default; background: transparent; }
  :is(#interativos, .ej-estojo-host) .ia-ferr:focus-visible { outline: 2px solid var(--cor-veia); outline-offset: 1px; }
  :is(#interativos, .ej-estojo-host) .ia-ferr i { position: absolute; right: 5px; bottom: 5px; width: 8px; height: 8px; border-radius: 50%; background: var(--c, transparent); box-shadow: 0 0 0 1.5px var(--cor-superficie); }
  :is(#interativos, .ej-estojo-host) .ia-ferr[aria-pressed="true"] i { box-shadow: 0 0 0 1.5px var(--cor-tinta); }
  :is(#interativos, .ej-estojo-host) .ia-ferr.confirmar { background: var(--cor-arteria); color: #fff; }
  :is(#interativos, .ej-estojo-host) .ia-op-cor { display: block; font-weight: 400; color: var(--cor-suave); font-size: 11px; margin-top: 2px; }
  :is(#interativos, .ej-estojo-host) .ia-estojo-opcoes { width: auto; min-width: 188px; max-width: 220px; padding: 10px; border-radius: 14px; background: var(--cor-superficie); box-shadow: 0 0 0 1px var(--cor-fio), 0 8px 28px rgba(0,0,0,.14);
    display: grid; gap: 10px; }
  :is(#interativos, .ej-estojo-host) .ia-estojo-opcoes[hidden] { display: none; }
  :is(#interativos, .ej-estojo-host) .ia-op-titulo { font-size: 12px; font-weight: 600; color: var(--cor-tinta); }
  :is(#interativos, .ej-estojo-host) .ia-op-forca { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 8px; font-size: 12px; color: var(--cor-suave); }
  :is(#interativos, .ej-estojo-host) .ia-op-forca input[type="range"] { width: 100%; min-width: 0; accent-color: var(--cor-tinta); }
  :is(#interativos, .ej-estojo-host) .ia-forca-num { display: inline-flex; align-items: center; gap: 2px; }
  :is(#interativos, .ej-estojo-host) .ia-forca-num input { width: 44px; height: 26px; padding: 0 4px; border: 1px solid var(--cor-fio); border-radius: 6px; background: var(--cor-superficie);
    color: var(--cor-tinta); font: 12px var(--fonte-ui); text-align: right; font-variant-numeric: tabular-nums; -moz-appearance: textfield; }
  :is(#interativos, .ej-estojo-host) .ia-forca-num input::-webkit-outer-spin-button, :is(#interativos, .ej-estojo-host) .ia-forca-num input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
  :is(#interativos, .ej-estojo-host) .ia-forca-num input:focus { outline: 2px solid var(--cor-tinta); outline-offset: 1px; }
  :is(#interativos, .ej-estojo-host) .ia-op-dica { font-size: 12px; color: var(--cor-suave); line-height: 1.35; }
  :is(#interativos, .ej-estojo-host) .ia-cores { display: flex; flex-wrap: wrap; gap: 8px; }
  :is(#interativos, .ej-estojo-host) .ia-cor { width: 26px; height: 26px; border-radius: 50%; border: 0; cursor: pointer; background: var(--c); box-shadow: inset 0 0 0 1px rgba(0,0,0,.15); }
  :is(#interativos, .ej-estojo-host) .ia-cor[aria-pressed="true"] { box-shadow: inset 0 0 0 1px rgba(0,0,0,.15), 0 0 0 2px var(--cor-superficie), 0 0 0 4px var(--cor-tinta); }
  :is(#interativos, .ej-estojo-host) .ia-tamanhos { display: flex; gap: 6px; }
  :is(#interativos, .ej-estojo-host) .ia-tam { flex: 1; height: 30px; border: 0; border-radius: 8px; background: var(--cor-superficie-2); cursor: pointer; display: grid; place-items: center; }
  :is(#interativos, .ej-estojo-host) .ia-tam span { display: block; width: 22px; border-radius: 9px; background: var(--cor-tinta); }
  :is(#interativos, .ej-estojo-host) .ia-tam[aria-pressed="true"] { box-shadow: inset 0 0 0 2px var(--cor-tinta); }
  :is(#interativos, .ej-estojo-host) .ia-adesivos { display: grid; grid-template-columns: repeat(5, 1fr); gap: 4px; }
  :is(#interativos, .ej-estojo-host) .ia-ades { height: 32px; border: 0; border-radius: 8px; background: transparent; cursor: pointer; font-size: 20px; line-height: 1; }
  :is(#interativos, .ej-estojo-host) .ia-ades:hover { background: var(--cor-superficie-2); }
  :is(#interativos, .ej-estojo-host) .ia-setas { grid-template-columns: repeat(4, 1fr); }
  :is(#interativos, .ej-estojo-host) .ia-setas .ia-ades { display: grid; place-items: center; padding: 0 4px; }
  :is(#interativos, .ej-estojo-host) .ia-setas svg { width: 30px; height: auto; display: block; }
  :is(#interativos, .ej-estojo-host) .ia-op-sub { font-size: 11px; font-weight: 600; color: var(--cor-suave); margin-bottom: -4px; }
  :is(#interativos, .ej-estojo-host) .ia-ades[aria-pressed="true"] { background: var(--cor-superficie-2); box-shadow: inset 0 0 0 2px var(--cor-tinta); }
  :is(#interativos, .ej-estojo-host) .ia-rotulos { display: flex; flex-wrap: wrap; gap: 5px; }
  :is(#interativos, .ej-estojo-host) .ia-rot { border: 0; border-radius: 6px; padding: 5px 7px; cursor: pointer; color: #fff; background: var(--c); font: 700 10px/1 var(--fonte-ui); letter-spacing: .05em; }
  :is(#interativos, .ej-estojo-host) .ia-rot[aria-pressed="true"] { box-shadow: 0 0 0 2px var(--cor-superficie), 0 0 0 4px var(--cor-tinta); }
  :is(#interativos, .ej-estojo-host) .ia-estojo-estado { font-size: 12px; color: var(--cor-suave); white-space: nowrap; }
  :is(#interativos, .ej-estojo-host) .ia-estojo-estado.erro { color: var(--cor-arteria); }
  @media (pointer: coarse) {
    :is(#interativos, .ej-estojo-host) .ia-ferr { width: 44px; height: 44px; }
    :is(#interativos, .ej-estojo-host) .ia-ferr svg { width: 22px; height: 22px; }
    :is(#interativos, .ej-estojo-host) .ia-cor { width: 34px; height: 34px; }
    #interativos .ia-palco.com-estojo .ia-quadro { width: calc(100% - 70px); }
  }
  html[data-dispositivo="celular"] #interativos .ia-grade { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  html[data-dispositivo="celular"] #interativos .ia-pastas { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  html[data-dispositivo="celular"] #interativos .ia-card:hover { transform: none; }
  html[data-dispositivo="celular"] #interativos .ia-mais { width: 38px; height: 38px; }
  html[data-dispositivo="celular"] #interativos .ia-leitor-topo { flex-wrap: wrap; gap: 6px; }
  html[data-dispositivo="celular"] #interativos .ia-leitor-topo button { min-height: 38px; }
  html[data-dispositivo="celular"] #interativos .ia-palco.com-estojo .ia-quadro { width: 100%; }
  html[data-dispositivo="celular"] :is(#interativos, .ej-estojo-host) .ia-estojo {
    top: auto; bottom: 8px; right: auto; left: 50%; transform: translateX(-50%);
    flex-direction: column-reverse; align-items: center; max-width: calc(100% - 16px);
  }
  html[data-dispositivo="celular"] :is(#interativos, .ej-estojo-host) .ia-estojo-barra {
    flex-direction: row; overflow-x: auto; max-width: 100%; -webkit-overflow-scrolling: touch;
  }
  html[data-dispositivo="celular"] :is(#interativos, .ej-estojo-host) .ia-estojo-barra hr {
    width: 1px; height: 22px; margin: auto 4px; flex: none; border-top: 0; border-left: 1px solid var(--cor-fio);
  }
  html[data-dispositivo="celular"] .ia-dlg { max-height: 88dvh; overflow-y: auto; }
  `;

  function montar() {
    const main = $(ID);
    if (!main || montado) return;
    montado = true;
    const st = document.createElement("style");
    st.textContent = CSS;
    document.head.append(st);
    main.innerHTML = `
      <div class="ia-lista">
        <header class="hero">
          <h1 class="titulo-1 titulo-duplo">Apostilas interativas<br><span class="tese">Os slides e as transcrições das aulas, com testes, estudo guiado e revisão.</span></h1>
        </header>
        <section class="secao">
          <div class="ia-barra">
            <div class="ia-onde"><nav class="ia-trilha" id="iaTrilha" aria-label="Pastas"></nav><p id="iaResumo">Carregando...</p></div>
            <div id="iaBarraAdmin" style="display:flex; gap:8px; flex-wrap:wrap;" hidden>
              <button type="button" class="botao botao--secundario ia-nova" id="iaNovaPasta">${ICP_NOVA}Nova pasta</button>
              <button type="button" class="botao botao--secundario ia-nova" id="iaSalvarPC" title="Grava pastas, capas e apostilas direto na pasta do seu PC">${ICP_SALVAR_PC}<span id="iaSalvarPCTxt">Salvar na pasta do PC</span></button>
              <button type="button" class="botao" id="iaAdicionar">Adicionar apostila</button>
            </div>
            <input type="file" id="iaArquivos" multiple accept=".html,.htm,.json,.jpg,.jpeg,.png,.webp,.zip" hidden>
          </div>
          <div class="ia-grade" id="iaGrade"></div>
        </section>
      </div>
      <div class="ia-leitor" id="iaLeitor">
        <div class="ia-leitor-topo">
          <button type="button" class="botao botao--secundario" id="iaVoltar" aria-label="Voltar para as apostilas">‹ Apostilas</button>
          <b id="iaTituloAberta"></b>
          <span class="ia-ponte" id="iaPonte"></span>
          <span class="ia-estojo-estado" id="iaEstojoEstado" aria-live="polite"></span>
          <button type="button" class="botao botao--secundario" id="iaIndiceBtn" aria-pressed="true" title="Índice aberto ou recolhido em números (o texto ganha o centro da tela)">Índice</button>
          <button type="button" class="botao botao--secundario" id="iaEstojoBtn" aria-pressed="true" title="Mostrar ou esconder o estojo (marca-texto, caneta, notas, adesivos)">Estojo</button>
          <button type="button" class="botao botao--secundario" id="iaProxima" hidden></button>
          <button type="button" class="botao botao--secundario ia-max-btn" id="iaMax" title="Tela cheia (Esc para sair)"></button>
        </div>
        <div class="ia-palco">
          <div class="ia-max-barra" id="iaMaxBarra" role="toolbar" aria-label="Tela cheia">
            <button type="button" id="iaMaxIndice">Índice</button>
            <button type="button" id="iaMaxEstojo">Estojo</button>
            <button type="button" id="iaMaxSair">Sair da tela cheia</button>
          </div>
          <iframe class="ia-quadro" id="iaQuadro" title="Apostila interativa" allow="fullscreen"></iframe>
          <div class="ia-estojo" id="iaEstojo" hidden>
            <div class="ia-estojo-opcoes" id="iaEstojoOpcoes" hidden></div>
            <div class="ia-estojo-barra" id="iaEstojoBarra" role="toolbar" aria-label="Estojo" aria-orientation="vertical"></div>
          </div>
        </div>
      </div>`;
    $("iaNovaPasta").onclick = novaPasta;
    $("iaSalvarPC").onclick = async () => {
      if (!window.EJStorageDrive?.salvarNaPastaDoPC) return;
      const btn = $("iaSalvarPC"), txt = $("iaSalvarPCTxt");
      btn.disabled = true;
      try {
        const res = await window.EJStorageDrive.salvarNaPastaDoPC(true);
        if (res && res.ok) {
          txt.textContent = `Salvo em "${res.pasta}"`;
          toast(`Arquivos atualizados na pasta "${res.pasta}" do PC! Agora é só rodar o atualizar.bat.`);
          carregar();
        }
      } catch (e) {
        if (e && e.name !== "AbortError") toast(e.message || "Não foi possível salvar na pasta do PC.", "erro", 4500);
      } finally {
        btn.disabled = false;
      }
    };
    $("iaAdicionar").onclick = () => $("iaArquivos").click();
    $("iaArquivos").onchange = e => importar(e.target.files);
    window.addEventListener("ej-admin-mudou", () => desenhar());
    window.addEventListener("ej-pasta-pc-salva", e => {
      const txt = $("iaSalvarPCTxt");
      if (txt && e.detail?.pasta) txt.textContent = `Pasta PC: ${e.detail.pasta}`;
    });
    $("iaVoltar").onclick = fechar;
    $("iaProxima").onclick = () => { const p = proximaApostila(); if (p) abrir(p); };
    $("iaMax").onclick = alternarMax;
    $("iaIndiceBtn").onclick = $("iaMaxIndice").onclick = () => alternarIndice();
    $("iaMaxSair").onclick = sairMax;
    $("iaMaxEstojo").onclick = () => { $(ID).classList.toggle("ia-max-estojo"); desenharBarraMax(); };
    // Ctrl+F com a apostila aberta e o foco no app (fora do quadro): abre a busca da apostila
    document.addEventListener("keydown", e => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || (e.key !== "f" && e.key !== "F") || !aberta) return;
      const q = $("iaQuadro");
      if (!q || q.offsetParent === null) return;
      try { if (q.contentWindow.ejBusca) { e.preventDefault(); q.contentWindow.focus(); q.contentWindow.ejBusca.abrir(); } } catch (er) {}
    }, true);
    // tela cheia: a barrinha aparece ao mexer o mouse (no app ou dentro da apostila) e some depois de 2,5 s
    document.addEventListener("mousemove", mostrarBarraMax, { passive: true });
    $("iaEstojoBtn").onclick = () => {
      estojoAberto = !estojoAberto;
      try { localStorage.setItem("ej_estojo_aberto", estojoAberto ? "1" : "0"); } catch (e) {}
      if (!estojoAberto) estojo()?.usar("mao");   // escondido = apostila volta a responder ao mouse
      desenharEstojo();
    };
    desenharBotaoMax();
    document.addEventListener("fullscreenchange", () => { if (!document.fullscreenElement && maximizado()) sairMax(); });
    document.addEventListener("keydown", e => { if (e.key === "Escape" && maximizado()) sairMax(); });
    main.addEventListener("dragover", e => { if (ehAdmin() && !main.classList.contains("ia-lendo")) e.preventDefault(); });
    main.addEventListener("drop", e => { if (!ehAdmin() || main.classList.contains("ia-lendo")) return; e.preventDefault(); importar(e.dataTransfer.files); });
    window.addEventListener("resize", ajustarAltura);
    new ResizeObserver(ajustarAltura).observe(main);
  }

  function dataBr(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
    return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
  }

  function rodape(a) {
    const c = a.contagem || {}, p = a.progresso || {};
    const tot = [c.capitulos && `${c.capitulos} capítulos`, c.testes && `${c.testes} testes`, c.questoes && `${c.questoes} questões`].filter(Boolean).join(" · ");
    const n = (k, um, varios) => k ? `${k} ${k === 1 ? um : varios}` : "";
    const feito = a.progresso_em ? [n(p.aulas, "aula feita", "aulas feitas"), n(p.testes, "teste", "testes")].filter(Boolean).join(", ") : "";
    const dom = a.dominio && a.dominio.total ? `<span class="ia-dom" title="Domínio médio dos ${a.dominio.total} conceitos já testados (mesmo cálculo da Calculadora); ${a.dominio.dominados} dominados">${Math.round(a.dominio.media * 100)}% de domínio</span>` : "";
    return `<span>${esc(feito || tot)}${dom ? " · " + dom : ""}</span><span class="ia-acao">${a.progresso_em ? "Continuar" : "Começar"}</span>`;
  }

  // Recomeçar do zero: o servidor apaga o progresso (de todos os PCs) e o domínio medido; a página apaga a chave do
  // localStorage que algumas apostilas usam no lugar da ponte (mesmo endereço do quadro). Anotações do estojo ficam.
  async function recomecar(a) {
    if (!a) return;
    const ok = await caixa({ titulo: `Recomeçar "${a.titulo}" do zero?`,
      texto: "Some todo o progresso desta apostila: aulas feitas, testes respondidos, revisões e o domínio medido, em todos os computadores. As marcações e notas do estojo ficam.",
      sim: "Recomeçar do zero", perigo: true });
    if (!ok) return;
    try {
      const r = await api(`/api/interativos/${encodeURIComponent(a.pasta)}/recomecar`);
      if (r.chave_local) { try { localStorage.removeItem(r.chave_local); } catch (e) {} }
      toast(`"${a.titulo}" recomeça do zero.`);
      carregar();
    } catch (e) { toast(e.message, "erro", 4500); }
  }

  // Domínio por conceito (GET /api/interativos/<pasta>/dominio, que também grava em calc_conceitos): do mais fraco ao mais forte
  async function verDominio(a) {
    let d;
    try { const r = await fetch(`/api/interativos/${encodeURIComponent(a.pasta)}/dominio`, { cache: "no-store" }); if (!r.ok) throw new Error(r.status === 404 ? "Reinicie o Estuda Jaider para ver o domínio." : "HTTP " + r.status); d = await r.json(); }
    catch (e) { toast(e.message, "erro", 4500); return; }
    const fundo = document.createElement("div");
    fundo.className = "ia-dlg-fundo";
    const linhas = (d.conceitos || []).map(c => {
      const pct = Math.round(c.p * 100), nv = c.p >= 0.95 ? "alta" : c.p >= 0.6 ? "media" : "baixa";
      return `<li><span class="ia-dom-nome">${esc(c.nome)}</span><span class="ia-dom-barra" data-nivel="${nv}"><i style="width:${pct}%"></i></span><b>${pct}%</b><small>${c.acertos} ${c.acertos === 1 ? "acerto" : "acertos"}${c.erros ? `, ${c.erros} ${c.erros === 1 ? "erro" : "erros"}` : ""}</small></li>`;
    }).join("");
    fundo.innerHTML = `<div class="ia-dlg ia-dlg--largo" role="dialog" aria-modal="true" aria-labelledby="iaDomT">
      <h2 id="iaDomT">Domínio por conceito</h2>
      <p>${esc(a.titulo)} · ${d.total ? `${d.total} conceitos testados, média ${Math.round(d.media * 100)}%, ${d.dominados} dominados (95% ou mais)` : "nenhum teste respondido ainda"}. Conta o acerto de primeira; um acerto só ainda não prova domínio.</p>
      ${linhas ? `<ul class="ia-dom-lista">${linhas}</ul>` : ""}
      <div class="ia-dlg-acoes"><button type="button" class="botao botao--primario" data-r="1">Fechar</button></div></div>`;
    const fim = () => { fundo.remove(); document.removeEventListener("keydown", tecla, true); };
    const tecla = e => { if (e.key === "Escape") { e.stopPropagation(); fim(); } };
    fundo.querySelector('[data-r="1"]').onclick = fim;
    fundo.addEventListener("mousedown", e => { if (e.target === fundo) fim(); });
    document.addEventListener("keydown", tecla, true);
    document.body.append(fundo);
    fundo.querySelector('[data-r="1"]').focus();
  }

  // ------------------------------------------------------------ pastas para organizar (18/11/2026)
  // A organização vem de GET /api/interativos (organizacao = {pastas: {id: {nome, pai}}, apostilas: {pasta: id}});
  // as apostilas não mudam de lugar no disco. Pasta atual lembrada em ej_ia_pasta (null = raiz).
  const ICP = {
    pasta: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>',
    nova: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 10v6"/><path d="M9 13h6"/><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>',
    mais: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>',
  };
  let org = { pastas: {}, apostilas: {} };
  let pastaAtual = (() => { try { return localStorage.getItem("ej_ia_pasta") || null; } catch (e) { return null; } })();
  function irPara(id) {
    pastaAtual = id && org.pastas[id] ? id : null;
    try { pastaAtual ? localStorage.setItem("ej_ia_pasta", pastaAtual) : localStorage.removeItem("ej_ia_pasta"); } catch (e) {}
    desenhar();
  }
  const filhasDe = id => Object.entries(org.pastas).filter(([, p]) => (p.pai || null) === (id || null))
    .sort((a, b) => a[1].nome.localeCompare(b[1].nome, "pt-BR", { numeric: true, sensitivity: "base" }));
  const apostilasDe = id => lista.filter(a => (org.apostilas[a.pasta] || null) === (id || null))
    .sort((a, b) => String(a.titulo || a.pasta).localeCompare(String(b.titulo || b.pasta), "pt-BR", { numeric: true, sensitivity: "base" }));
  const caminhoAte = id => { const c = []; const vistos = new Set(); while (id && org.pastas[id] && !vistos.has(id)) { vistos.add(id); c.unshift(id); id = org.pastas[id].pai; } return c; };
  function totalDentro(id) {        // apostilas na pasta e nas de dentro
    let n = apostilasDe(id).length;
    filhasDe(id).forEach(([f]) => { n += totalDentro(f); });
    return n;
  }
  async function api(url, corpo) {
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo || {}) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.detail || (r.status === 404 ? "Reinicie o Estuda Jaider para usar as pastas." : "HTTP " + r.status));
    return d;
  }

  // caixinhas no visual do app (o perguntarNaTela do index.html não fica acessível daqui)
  function caixa({ titulo, texto = "", campo = null, sim = "OK", perigo = false }) {
    return new Promise(resolve => {
      const fundo = document.createElement("div");
      fundo.className = "ia-dlg-fundo";
      fundo.innerHTML = `<div class="ia-dlg" role="dialog" aria-modal="true" aria-labelledby="iaDlgT">
        <h2 id="iaDlgT">${esc(titulo)}</h2>${texto ? `<p>${esc(texto)}</p>` : ""}
        ${campo !== null ? `<input class="campo ia-dlg-campo" value="${esc(campo)}" maxlength="120" aria-label="${esc(titulo)}">` : ""}
        <div class="ia-dlg-acoes"><button type="button" class="botao botao--secundario" data-r="0">Cancelar</button>
        <button type="button" class="botao ${perigo ? "ia-dlg-perigo" : "botao--primario"}" data-r="1">${esc(sim)}</button></div></div>`;
      const fim = v => { fundo.remove(); document.removeEventListener("keydown", tecla, true); resolve(v); };
      const inp = fundo.querySelector(".ia-dlg-campo");
      const ok = () => fim(inp ? (inp.value.trim() || null) : true);
      const tecla = e => { if (e.key === "Escape") { e.stopPropagation(); fim(null); } else if (e.key === "Enter" && inp) { e.preventDefault(); ok(); } };
      fundo.querySelector('[data-r="0"]').onclick = () => fim(null);
      fundo.querySelector('[data-r="1"]').onclick = ok;
      fundo.addEventListener("mousedown", e => { if (e.target === fundo) fim(null); });
      document.addEventListener("keydown", tecla, true);
      document.body.append(fundo);
      (inp || fundo.querySelector('[data-r="1"]')).focus();
      if (inp) inp.select();
    });
  }
  function menu(ancora, itens) {
    document.querySelectorAll(".ia-menu").forEach(x => x.remove());
    const m = document.createElement("div");
    m.className = "ia-menu"; m.setAttribute("role", "menu");
    const fechar = () => { m.remove(); document.removeEventListener("mousedown", fora, true); document.removeEventListener("keydown", esc2, true); };
    const fora = e => { if (!m.contains(e.target)) fechar(); };
    const esc2 = e => { if (e.key === "Escape") { e.stopPropagation(); fechar(); ancora.focus(); } };
    itens.forEach(it => {
      const b = document.createElement("button");
      b.type = "button"; b.setAttribute("role", "menuitem");
      b.textContent = it.t; b.disabled = !!it.desativado;
      if (it.recuo) b.style.paddingLeft = (12 + it.recuo * 16) + "px";
      if (it.perigo) b.className = "perigo";
      b.onclick = () => { fechar(); it.f && it.f(); };
      m.append(b);
    });
    document.body.append(m);
    const r = ancora.getBoundingClientRect();
    m.style.top = Math.min(r.bottom + 4, window.innerHeight - m.offsetHeight - 8) + "px";
    m.style.left = Math.max(8, Math.min(r.right - m.offsetWidth, window.innerWidth - m.offsetWidth - 8)) + "px";
    document.addEventListener("mousedown", fora, true);
    document.addEventListener("keydown", esc2, true);
    m.querySelector("button:not(:disabled)")?.focus();
  }
  // "Mover para…": Raiz + árvore com recuo; uma pasta não vai para dentro dela mesma
  function destinos(oQue) {
    const proibidas = new Set();
    if (oQue.pasta) { const marca = id => { proibidas.add(id); filhasDe(id).forEach(([f]) => marca(f)); }; marca(oQue.pasta); }
    const atual = oQue.pasta ? (org.pastas[oQue.pasta].pai || null) : (org.apostilas[oQue.apostila] || null);
    const itens = [{ t: "Apostilas (início)" + (atual === null ? " · aqui" : ""), desativado: atual === null, f: () => moverPara(null, oQue) }];
    const desce = (id, nivel) => filhasDe(id).forEach(([f, p]) => {
      if (proibidas.has(f)) return;
      itens.push({ t: p.nome + (atual === f ? " · aqui" : ""), recuo: nivel, desativado: atual === f, f: () => moverPara(f, oQue) });
      desce(f, nivel + 1);
    });
    desce(null, 1);
    return itens;
  }
  async function moverPara(destino, oQue) {
    try {
      org = await api("/api/interativos-org/mover", { destino, apostilas: oQue.apostila ? [oQue.apostila] : [], pastas: oQue.pasta ? [oQue.pasta] : [] });
      toast("Movido para " + (destino ? org.pastas[destino].nome : "Apostilas") + ".");
      desenhar();
    } catch (e) { toast(e.message, "erro", 4500); }
  }
  async function novaPasta() {
    const nome = await caixa({ titulo: "Nova pasta", texto: pastaAtual ? `Dentro de "${org.pastas[pastaAtual].nome}".` : "", campo: "", sim: "Criar" });
    if (!nome) return;
    try { await api("/api/interativos-org/pastas", { nome, pai: pastaAtual }); await carregar(); }
    catch (e) { toast(e.message, "erro", 4500); }
  }
  async function renomear(id) {
    const nome = await caixa({ titulo: "Renomear pasta", campo: org.pastas[id].nome, sim: "Renomear" });
    if (!nome || nome === org.pastas[id].nome) return;
    try { org = await api(`/api/interativos-org/pastas/${encodeURIComponent(id)}/renomear`, { nome }); desenhar(); }
    catch (e) { toast(e.message, "erro", 4500); }
  }
  async function renomearApostila(pasta) {
    const a = lista.find(x => x.pasta === pasta);
    if (!a) return;
    const atualTit = a.titulo || a.pasta;
    const atualDisc = a.disciplina || "";
    const res = await new Promise(resolve => {
      const fundo = document.createElement("div");
      fundo.className = "ia-dlg-fundo";
      fundo.innerHTML = `<div class="ia-dlg" role="dialog" aria-modal="true" aria-labelledby="iaDlgT">
        <h2 id="iaDlgT">Renomear apostila</h2>
        <label style="display:block;font-size:12.5px;font-weight:600;color:var(--cor-suave);margin:6px 0 4px" for="iaEdTit">Nome da apostila</label>
        <input id="iaEdTit" class="campo ia-dlg-campo" style="margin-top:0" value="${esc(atualTit)}" maxlength="120">
        <label style="display:block;font-size:12.5px;font-weight:600;color:var(--cor-suave);margin:2px 0 4px" for="iaEdDisc">Etiqueta / disciplina (opcional)</label>
        <div style="display:flex;gap:6px;align-items:center;margin:0 0 14px">
          <input id="iaEdDisc" class="campo" style="flex:1;min-width:0" value="${esc(atualDisc)}" maxlength="60" placeholder="Ex.: Farmacoterapia (deixe vazio para remover)">
          <button type="button" class="botao botao--secundario" data-limpar-disc title="Remover etiqueta">Limpar</button>
        </div>
        <div class="ia-dlg-acoes"><button type="button" class="botao botao--secundario" data-r="0">Cancelar</button>
        <button type="button" class="botao botao--primario" data-r="1">Salvar</button></div></div>`;
      const fim = v => { fundo.remove(); document.removeEventListener("keydown", tecla, true); resolve(v); };
      const inpTit = fundo.querySelector("#iaEdTit");
      const inpDisc = fundo.querySelector("#iaEdDisc");
      const ok = () => {
        const t = inpTit.value.trim();
        if (!t) { inpTit.focus(); return; }
        fim({ titulo: t, disciplina: inpDisc.value.trim() });
      };
      const tecla = e => { if (e.key === "Escape") { e.stopPropagation(); fim(null); } else if (e.key === "Enter" && (e.target === inpTit || e.target === inpDisc)) { e.preventDefault(); ok(); } };
      fundo.querySelector("[data-limpar-disc]").onclick = () => { inpDisc.value = ""; inpDisc.focus(); };
      fundo.querySelector('[data-r="0"]').onclick = () => fim(null);
      fundo.querySelector('[data-r="1"]').onclick = ok;
      fundo.addEventListener("mousedown", e => { if (e.target === fundo) fim(null); });
      document.addEventListener("keydown", tecla, true);
      document.body.append(fundo);
      inpTit.focus();
      inpTit.select();
    });
    if (!res || (res.titulo === atualTit && res.disciplina === atualDisc)) return;
    try {
      await api(`/api/interativos/${encodeURIComponent(pasta)}/renomear`, res);
      a.titulo = res.titulo;
      a.disciplina = res.disciplina;
      if (aberta && aberta.pasta === pasta) {
        aberta.titulo = res.titulo;
        aberta.disciplina = res.disciplina;
        if ($("iaTituloAberta")) $("iaTituloAberta").textContent = res.titulo;
      }
      toast(`Apostila atualizada!`);
      desenhar();
    } catch (e) { toast(e.message, "erro", 4500); }
  }
  async function excluir(id) {
    const p = org.pastas[id], cima = p.pai ? org.pastas[p.pai].nome : "Apostilas";
    const n = totalDentro(id);
    if (!(await caixa({ titulo: `Excluir a pasta "${p.nome}"?`, texto: n ? `As ${n} ${n === 1 ? "apostila" : "apostilas"} e as pastas de dentro não são apagadas: sobem para "${cima}".` : "A pasta está vazia.", sim: "Excluir pasta", perigo: true }))) return;
    try { org = await api(`/api/interativos-org/pastas/${encodeURIComponent(id)}/excluir`); if (pastaAtual === id) pastaAtual = p.pai || null; irPara(pastaAtual); }
    catch (e) { toast(e.message, "erro", 4500); }
  }
  // Excluir apostila: apaga TUDO (site, progresso, anotações do estojo e domínio por conceito), em todos os PCs
  async function excluirApostila(pasta) {
    const a = lista.find(x => x.pasta === pasta) || { pasta };
    const nome = a.titulo || a.pasta;
    if (!(await caixa({ titulo: `Excluir "${nome}"?`, texto: "Apaga o site, o progresso, as anotações do estojo e o domínio por conceito desta apostila, em todos os computadores. Não tem como desfazer.", sim: "Excluir para sempre", perigo: true }))) return;
    try {
      const r = await fetch(`/api/interativos/${encodeURIComponent(pasta)}/excluir`, { method: "POST" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((d.detail && d.detail !== "Not Found" && d.detail !== "Method Not Allowed") ? d.detail : (r.status === 404 || r.status === 405 ? "Reinicie o Estuda Jaider para poder excluir." : "HTTP " + r.status));
      toast(`"${nome}" foi excluída.`);
      await carregar();
    } catch (e) { toast(e.message, "erro", 5000); }
  }
  // arrastar um cartão (apostila ou pasta) para uma pasta ou um item da trilha
  const TIPO_DND = "application/x-ej-apostila";
  function soltavel(el, destino) {
    el.addEventListener("dragover", e => { if (e.dataTransfer.types.includes(TIPO_DND)) { e.preventDefault(); e.stopPropagation(); el.classList.add("ia-alvo"); } });
    el.addEventListener("dragleave", () => el.classList.remove("ia-alvo"));
    el.addEventListener("drop", e => {
      if (!e.dataTransfer.types.includes(TIPO_DND)) return;
      e.preventDefault(); e.stopPropagation(); el.classList.remove("ia-alvo");
      const oQue = JSON.parse(e.dataTransfer.getData(TIPO_DND) || "{}");
      if (oQue.pasta === destino) return;
      if (oQue.pasta && destino && caminhoAte(destino).includes(oQue.pasta)) { toast("Não dá para mover uma pasta para dentro dela mesma.", "erro"); return; }
      moverPara(destino, oQue);
    });
  }

  function desenhar() {
    const g = $("iaGrade");
    if (!g) return;
    const modoAdmin = ehAdmin();
    const barraAdmin = $("iaBarraAdmin");
    if (barraAdmin) {
      barraAdmin.hidden = !modoAdmin;
      const txtPC = $("iaSalvarPCTxt");
      if (txtPC && window.EJStorageDrive?.nomePastaPCConectada) {
        const np = window.EJStorageDrive.nomePastaPCConectada();
        if (np) txtPC.textContent = `Pasta PC: ${np}`;
      }
    }
    if (pastaAtual && !org.pastas[pastaAtual]) pastaAtual = null;
    // trilha
    const trilha = $("iaTrilha");
    const passos = [null, ...caminhoAte(pastaAtual)];
    trilha.innerHTML = passos.map((id, k) => {
      const nome = id ? org.pastas[id].nome : "Apostilas";
      return (k ? '<span class="ia-trilha-sep" aria-hidden="true">›</span>' : "") +
        (k === passos.length - 1 ? `<span class="ia-trilha-atual" aria-current="page" data-dest="${id || ""}">${esc(nome)}</span>`
          : `<button type="button" class="ia-trilha-item" data-dest="${id || ""}">${esc(nome)}</button>`);
    }).join("");
    trilha.querySelectorAll("[data-dest]").forEach(b => {
      const dest = b.dataset.dest || null;
      if (b.tagName === "BUTTON") b.onclick = () => irPara(dest);
      if (modoAdmin) soltavel(b, dest);
    });
    const pastas = filhasDe(pastaAtual), aqui = apostilasDe(pastaAtual);
    $("iaResumo").textContent = lista.length
      ? (pastaAtual ? `${aqui.length} ${aqui.length === 1 ? "apostila" : "apostilas"} nesta pasta, ${lista.length} no total.` : `${lista.length} ${lista.length === 1 ? "apostila" : "apostilas"}. O progresso fica salvo no seu navegador e sincroniza com o seu Google Drive.`)
      : "Nenhuma apostila ainda.";
    if (!lista.length && !pastas.length) {
      g.innerHTML = modoAdmin
        ? `<div class="ia-vazio" style="grid-column:1/-1">Clique em <b>Adicionar apostila</b> e escolha os arquivos do pacote
          (<b>index.html</b>, <b>biblioteca.json</b> e <b>capa.jpg</b>), um <b>.zip</b> com eles ou só o <b>.html</b> do site.
          Também dá para arrastar os arquivos para cá.</div>`
        : `<div class="ia-vazio" style="grid-column:1/-1">Nenhuma apostila publicada ainda.</div>`;
      return;
    }
    const cartPasta = pastas.map(([id, p]) => {
      const sub = filhasDe(id).length, n = totalDentro(id);
      const det = [n ? `${n} ${n === 1 ? "apostila" : "apostilas"}` : "vazia", sub ? `${sub} ${sub === 1 ? "pasta" : "pastas"}` : ""].filter(Boolean).join(" · ");
      return `<div class="ia-item ia-item--pasta"${modoAdmin ? ' draggable="true"' : ''} data-pasta="${esc(id)}">
        <button type="button" class="ia-pasta" data-abrir="${esc(id)}"><span class="ia-pasta-ic" data-pv="${esc("apost:" + id)}">${ICP.pasta}</span><span class="ia-pasta-txt"${modoAdmin ? '' : ' style="padding-right:0"'}><b>${esc(p.nome)}</b><small>${det}</small></span></button>
        ${modoAdmin ? `<button type="button" class="ia-mais" aria-label="Opções da pasta ${esc(p.nome)}" aria-haspopup="menu">${ICP.mais}</button>` : ""}</div>`;
    }).join("");
    const cartApost = aqui.map(a => {
      const i = lista.indexOf(a);
      const meta = [a.disciplina, a.prova, dataBr(a.data_aula)].filter(Boolean).join(" · ");
      const chavePv = "doc:" + a.pasta;
      return `<div class="ia-item"${modoAdmin ? ' draggable="true"' : ''} data-apostila="${esc(a.pasta)}">
        <button type="button" class="ia-card" data-i="${i}">
        <div class="ia-capa" data-pv="${esc(chavePv)}" data-pv-capa-padrao="${esc(a.capa || "")}"></div>
        <div class="ia-corpo">
          ${meta ? `<span class="ia-meta">${esc(meta)}</span>` : ""}
          <h3 class="ia-titulo">${esc(a.titulo)}</h3>
          ${a.subtitulo ? `<p class="ia-sub">${esc(a.subtitulo)}</p>` : ""}
          <div class="ia-rodape">${rodape(a)}</div>
        </div></button>
        <button type="button" class="ia-mais ia-mais--card" aria-label="Opções de ${esc(a.titulo)}" aria-haspopup="menu">${ICP.mais}</button></div>`;
    }).join("");
    g.innerHTML = (cartPasta ? `<div class="ia-pastas" style="grid-column:1/-1">${cartPasta}</div>` : "") + cartApost +
      (!aqui.length && pastaAtual ? `<div class="ia-vazio" style="grid-column:1/-1">${modoAdmin ? 'Pasta vazia. Arraste apostilas para cá, use <b>Mover para…</b> no menu de uma apostila ou adicione uma nova estando aqui.' : 'Esta pasta ainda não tem apostilas.'}</div>` : "");
    g.querySelectorAll(".ia-card").forEach(b => (b.onclick = () => abrir(lista[+b.dataset.i])));
    g.querySelectorAll("[data-abrir]").forEach(b => (b.onclick = () => irPara(b.dataset.abrir)));
    g.querySelectorAll(".ia-item").forEach(it => {
      const oQue = it.dataset.pasta ? { pasta: it.dataset.pasta } : { apostila: it.dataset.apostila };
      if (modoAdmin) {
        it.addEventListener("dragstart", e => { e.dataTransfer.setData(TIPO_DND, JSON.stringify(oQue)); e.dataTransfer.effectAllowed = "move"; it.classList.add("ia-arrastando"); });
        it.addEventListener("dragend", () => it.classList.remove("ia-arrastando"));
        if (oQue.pasta) soltavel(it, oQue.pasta);
      }
      const btnMais = it.querySelector(".ia-mais");
      if (!btnMais) return;
      btnMais.onclick = e => {
        e.stopPropagation();
        const b = e.currentTarget;
        if (oQue.pasta && modoAdmin) menu(b, [
          { t: "Abrir", f: () => irPara(oQue.pasta) },
          { t: "Renomear", f: () => renomear(oQue.pasta) },
          { t: "Personalizar (cor e capa)", f: () => window.PastaVisual && PastaVisual.editar("apost:" + oQue.pasta, (org.pastas[oQue.pasta] || {}).nome) },
          { t: "Mover para…", f: () => menu(b, destinos(oQue)) },
          { t: "Excluir pasta", perigo: true, f: () => excluir(oQue.pasta) },
        ]);
        else if (oQue.apostila) {
          const apAlvo = lista.find(x => x.pasta === oQue.apostila);
          const opcoesApostila = [
            { t: "Domínio por conceito", f: () => verDominio(apAlvo) },
            { t: "Recomeçar do zero", perigo: true, f: () => recomecar(apAlvo) },
          ];
          if (modoAdmin) {
            opcoesApostila.splice(1, 0,
              { t: "Renomear / etiqueta", f: () => renomearApostila(oQue.apostila) },
              {
                t: "Personalizar (cor e capa)",
                f: () => window.PastaVisual && PastaVisual.editar("doc:" + oQue.apostila, (apAlvo || {}).titulo || oQue.apostila, (apAlvo || {}).capa || ""),
              }
            );
            opcoesApostila.push(
              { t: "Mover para…", f: () => menu(b, destinos(oQue)) },
              { t: "Excluir apostila", perigo: true, f: () => excluirApostila(oQue.apostila) }
            );
          }
          menu(b, opcoesApostila);
        }
      };
    });
    if (window.PastaVisual) window.PastaVisual.preencher(g);
  }

  async function carregar() {
    try {
      const r = await fetch("/api/interativos", { cache: "no-store" });
      if (!r.ok) throw new Error("HTTP " + r.status);
      const d = await r.json();
      lista = d.apostilas || [];
      org = d.organizacao || { pastas: {}, apostilas: {} };
    } catch (e) {
      lista = [];
      if ($("iaResumo")) $("iaResumo").textContent = "Não consegui ler a pasta de apostilas: " + e.message;
      return;
    }
    desenhar();
  }

  async function importar(arquivos) {
    if (!arquivos || !arquivos.length) return;
    const fd = new FormData();
    [...arquivos].forEach(f => fd.append("arquivos", f, f.name));
    $("iaResumo").textContent = "Adicionando...";
    try {
      const r = await fetch("/api/interativos/importar", { method: "POST", body: fd });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.detail || "HTTP " + r.status);
      toast(d.novo ? `Apostila adicionada: ${d.titulo}` : `Apostila atualizada: ${d.titulo}`);
      // adicionada estando dentro de uma pasta: já vai para ela (atualizar uma existente não a tira do lugar)
      if (d.novo && pastaAtual && d.pasta) { try { await api("/api/interativos-org/mover", { destino: pastaAtual, apostilas: [d.pasta] }); } catch (e) {} }
    } catch (e) {
      toast("Não deu para adicionar: " + e.message, "erro", 5000);
    }
    $("iaArquivos").value = "";
    carregar();
  }

  function ajustarAltura() {
    const q = $("iaQuadro");
    if (!q || !aberta) return;
    const topo = q.getBoundingClientRect().top;
    const altJanela = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    q.style.height = Math.max(320, Math.floor(altJanela - topo - (maximizado() ? 8 : 12))) + "px";
  }

  // Tela cheia: a apostila ocupa a tela inteira (Fullscreen do navegador/Electron); se o pedido
  // for recusado, ocupa a janela inteira do app. Esc ou o botão voltam ao normal.
  const ICONE_MAX = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/></svg>';
  const ICONE_MIN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 14h6v6"/><path d="M20 10h-6V4"/><path d="M14 10l7-7"/><path d="M3 21l7-7"/></svg>';
  const maximizado = () => $(ID)?.classList.contains("ia-max");
  function desenharBotaoMax() {
    const b = $("iaMax"), m = maximizado();
    if (!b) return;
    b.innerHTML = (m ? ICONE_MIN : ICONE_MAX) + `<span>${m ? "Sair da tela cheia" : "Tela cheia"}</span>`;
    b.setAttribute("aria-pressed", m ? "true" : "false");
  }
  async function entrarMax() {
    const main = $(ID);
    // fundo igual ao da janela (o tema do app nem sempre usa --cor-fundo)
    const fundo = [document.querySelector(".wb-pane-content"), document.body, document.documentElement]
      .map(el => el && getComputedStyle(el).backgroundColor).find(c => c && c !== "transparent" && c !== "rgba(0, 0, 0, 0)");
    main.style.setProperty("background", fundo || "#F5F5F7", "important");   // o tema deixa as <main> transparentes com !important
    soltarDosConteineres(true);
    document.documentElement.classList.add("ej-apostila-max");
    main.classList.add("ia-max");
    main.classList.remove("ia-max-estojo");          // só a apostila; o estojo volta pela barrinha
    desenharBotaoMax(); desenharBarraMax(); mostrarBarraMax();
    try { if (main.requestFullscreen && !document.fullscreenElement) await main.requestFullscreen({ navigationUI: "hide" }); } catch (e) {}
    setTimeout(ajustarAltura, 60);
    try { $("iaQuadro").contentWindow.focus(); } catch (e) {}
  }
  function sairMax() {
    $(ID).classList.remove("ia-max", "ia-max-estojo");
    $(ID).style.removeProperty("background");
    avisarTrilho();
    document.documentElement.classList.remove("ej-apostila-max");
    soltarDosConteineres(false);
    desenharBotaoMax();
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    setTimeout(ajustarAltura, 60);
  }
  function alternarMax() { maximizado() ? sairMax() : entrarMax(); }
  // "position: fixed" fica preso a um ancestral com contain, container-type, transform ou filter (o cartão da área de
  // trabalho e as colunas usam alguns). Na tela cheia de reserva (quando o Fullscreen do sistema não vem), esses
  // ancestrais perdem isso por um momento; ao sair, voltam como estavam.
  let soltos = [];
  function soltarDosConteineres(soltar) {
    if (!soltar) {
      soltos.forEach(([el, css]) => { el.style.cssText = css; });
      soltos = [];
      return;
    }
    soltos = [];
    for (let el = $(ID).parentElement; el && el !== document.documentElement; el = el.parentElement) {
      const cs = getComputedStyle(el);
      if (cs.contain !== "none" || (cs.containerType && cs.containerType !== "normal") || cs.transform !== "none" || cs.filter !== "none" || cs.overflow !== "visible") {
        soltos.push([el, el.style.cssText]);
        ["contain", "container-type", "transform", "filter"].forEach(k => el.style.setProperty(k, k === "container-type" ? "normal" : "none", "important"));
        el.style.setProperty("overflow", "visible", "important");
        el.style.setProperty("z-index", "2147483000", "important");
      }
    }
  }
  let timerBarra = 0;
  function mostrarBarraMax() {
    const b = $("iaMaxBarra");
    if (!b || !maximizado()) return;
    b.classList.add("ver");
    clearTimeout(timerBarra);
    timerBarra = setTimeout(() => { if (!b.matches(":hover, :focus-within")) b.classList.remove("ver"); }, 2500);
  }
  function desenharBarraMax() {
    const m = $(ID);
    avisarTrilho();
    if (!$("iaMaxEstojo")) return;
    $("iaMaxEstojo").setAttribute("aria-pressed", m.classList.contains("ia-max-estojo") ? "true" : "false");
    $("iaMaxIndice").setAttribute("aria-pressed", indiceAberto ? "true" : "false");
    setTimeout(ajustarAltura, 30);
  }

  // ------------------------------------------------------------ índice em trilho de números (injetado no quadro)
  // web/trilho_apostila.js roda dentro da apostila (como o estojo): índice aberto (largura arrastável) ou recolhido
  // num trilho de números com pontinhos das seções, lista por cima ao passar o mouse, texto no centro e A−/A+.
  // As escolhas ficam no localStorage (ej_ia_indice, ej_ia_indice_larg, ej_ia_fonte), lidas pelo próprio script.
  let indiceAberto = (() => { try { return localStorage.getItem("ej_ia_indice") !== "0"; } catch (e) { return true; } })();
  // tela cheia: Índice, Estojo e Sair ficam no cabeçalho da apostila (trilho_apostila.js); a barrinha só aparece
  // se o trilho não carregou (classe "reserva")
  window.ejApostilaAcoes = {
    estojo: () => { $(ID).classList.toggle("ia-max-estojo"); desenharBarraMax(); },
    sair: () => sairMax(),
  };
  function avisarTrilho() {
    const w = $("iaQuadro") && $("iaQuadro").contentWindow;
    const tem = !!(w && w.ejTrilho && w.ejTrilho.estadoApp);
    if (tem) w.ejTrilho.estadoApp({ max: maximizado(), estojo: $(ID).classList.contains("ia-max-estojo") });
    const b = $("iaMaxBarra");
    if (b) b.classList.toggle("reserva", !tem);
  }
  function marcarBotoesIndice() {
    ["iaIndiceBtn", "iaMaxIndice"].forEach(id => { if ($(id)) $(id).setAttribute("aria-pressed", indiceAberto ? "true" : "false"); });
  }
  function aplicarIndice() {
    const q = $("iaQuadro");
    let doc;
    try { doc = q.contentDocument; } catch (e) { return; }
    if (!doc || !doc.head || doc.URL === "about:blank" || q.contentWindow.ejTrilho) { marcarBotoesIndice(); return; }
    // Ctrl+F dentro da apostila (o Electron não tem a barra de busca do navegador): web/busca_apostila.js
    if (!q.contentWindow.ejBusca) { const b = doc.createElement("script"); b.src = "/busca_apostila.js?v=2"; doc.head.append(b); }
    // Animações por passos com pergunta que libera o próximo (padrão v6.3): web/anim_apostila.js
    if (!q.contentWindow.ejAnim) { const an = doc.createElement("script"); an.src = "/anim_apostila.js?v=1"; doc.head.append(an); }
    // Regras universais (ex.: marcar a alternativa e só corrigir no botão "Responder"): regras_apostila.js
    if (!q.contentWindow.__ejRegras) { const rg = doc.createElement("script"); rg.src = "/regras_apostila.js?v=4"; doc.head.append(rg); }
    injetarNav(q, doc);
    const s = doc.createElement("script");
    s.src = "/trilho_apostila.js?v=8";
    s.onload = () => {
      try { q.contentWindow.ejTrilho.iniciar({ aoMudar: e => { indiceAberto = e.aberto; marcarBotoesIndice(); } }); } catch (e) { console.warn("trilho:", e); }
      indiceAberto = q.contentWindow.ejTrilho ? q.contentWindow.ejTrilho.aberto() : indiceAberto;
      marcarBotoesIndice();
      avisarTrilho();
      if (dominioAtual) { try { q.contentWindow.ejTrilho.definirDominio && q.contentWindow.ejNav && q.contentWindow.ejNav.definirDominio(dominioAtual); } catch (e) {} }
    };
    doc.head.append(s);
  }
  function alternarIndice(forcar) {
    const w = $("iaQuadro") && $("iaQuadro").contentWindow;
    indiceAberto = typeof forcar === "boolean" ? forcar : !indiceAberto;
    try { localStorage.setItem("ej_ia_indice", indiceAberto ? "1" : "0"); } catch (e) {}
    try { if (w && w.ejTrilho) w.ejTrilho.definir(indiceAberto, false); } catch (e) {}
    marcarBotoesIndice();
  }

  // ------------------------------------------------------------ navegação (web/nav_apostila.js, roda no quadro)
  // posição de leitura (rota /posicao), voltar/avançar, ligações, domínio no trilho, "Nesta seção", anterior/próxima,
  // minhas marcas, galeria, atalhos; a próxima apostila da pasta vem daqui.
  let pedidoAbrir = null, dominioAtual = null, timerPosicao = 0, posicaoPendente = null, timerDominio = 0;
  const nav = () => { try { return $("iaQuadro").contentWindow.ejNav || null; } catch (e) { return null; } };
  function proximaApostila() {
    if (!aberta) return null;
    const pastaDe = p => (org.apostilas && org.apostilas[p]) || null;
    const mesmas = lista.filter(x => pastaDe(x.pasta) === pastaDe(aberta.pasta))
      .sort((x, y) => String(x.titulo).localeCompare(String(y.titulo), "pt-BR", { numeric: true, sensitivity: "base" }));
    const k = mesmas.findIndex(x => x.pasta === aberta.pasta);
    return k >= 0 && k < mesmas.length - 1 ? mesmas[k + 1] : null;
  }
  function desenharProxima() {
    const b = $("iaProxima"), p = proximaApostila();
    if (!b) return;
    b.hidden = !p;
    if (p) { b.textContent = "Próxima apostila ›"; b.title = "Próxima apostila desta pasta: " + p.titulo; }
  }
  function gravarPosicao(pos) {
    if (!aberta) return;
    posicaoPendente = { pasta: aberta.pasta, pos };
    aberta.posicao = { ...pos, atualizado_em: Date.now() / 1000 };
    clearTimeout(timerPosicao);
    timerPosicao = setTimeout(enviarPosicao, 800);
  }
  function enviarPosicao() {
    const p = posicaoPendente; posicaoPendente = null;
    if (!p) return;
    fetch(`/api/interativos/${encodeURIComponent(p.pasta)}/posicao`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p.pos), keepalive: true }).catch(() => {});
  }
  async function carregarDominio() {
    if (!aberta) return;
    const pasta = aberta.pasta;
    try {
      const r = await fetch(`/api/interativos/${encodeURIComponent(pasta)}/dominio`, { cache: "no-store" });
      if (!r.ok || !aberta || aberta.pasta !== pasta) return;
      dominioAtual = ((await r.json()).conceitos || []).map(c => ({ conceito: c.conceito, p: c.p }));
      nav()?.definirDominio(dominioAtual);
    } catch (e) {}
  }
  function injetarNav(q, doc) {
    if (q.contentWindow.ejNav) return;
    const a = aberta, pedido = pedidoAbrir; pedidoAbrir = null;
    const s = doc.createElement("script");
    s.src = "/nav_apostila.js?v=6";
    s.onload = async () => {
      if (!a || aberta !== a) return;
      let posicao = a.posicao || null;
      try { const r = await fetch(`/api/interativos/${encodeURIComponent(a.pasta)}/posicao`, { cache: "no-store" }); if (r.ok) posicao = (await r.json()).posicao || posicao; } catch (e) {}
      const p = proximaApostila();
      try {
        q.contentWindow.ejNav.iniciar({ posicao, hash: pedido && pedido.hash, proxima: p ? { pasta: p.pasta, titulo: p.titulo } : null,
          dominio: dominioAtual, aoPosicao: gravarPosicao, abrirApostila: pasta => { const x = lista.find(y => y.pasta === pasta); if (x) abrir(x); } });
      } catch (e) { console.warn("navegação:", e); }
      if (pedido && pedido.termo) setTimeout(() => { try { q.contentWindow.focus(); q.contentWindow.ejBusca && q.contentWindow.ejBusca.abrir(pedido.termo); } catch (e) {} }, 500);
    };
    doc.head.append(s);
  }

  function abrir(a, pedido) {
    if (aberta && aberta !== a) { try { nav()?.guardarPosicao(); } catch (e) {} enviarPosicao(); }
    pedidoAbrir = pedido || null;
    dominioAtual = null;
    aberta = a;
    desenharProxima();
    carregarDominio();
    $(ID).classList.add("ia-lendo");
    $("iaTituloAberta").textContent = a.titulo;
    $("iaPonte").textContent = "";
    const q = $("iaQuadro");
    q.onload = () => {   // mesmo endereço do app: o Esc dentro do site também sai da tela cheia da janela
      if (window.EJStorageDrive) window.EJStorageDrive.conectarQuadroApostila(q, a);
      try { q.contentWindow.addEventListener("keydown", e => { if (e.key === "Escape" && maximizado()) sairMax(); }); } catch (e) {}
      try { q.contentWindow.addEventListener("mousemove", mostrarBarraMax, { passive: true }); } catch (e) {}
      aplicarIndice();
      injetarEstojo(q, a);
    };
    q.src = window.EJStorageDrive ? window.EJStorageDrive.urlParaQuadro(a) : (a.url + "?v=" + (a.modificado || ""));
    requestAnimationFrame(ajustarAltura);
    try { sessionStorage.setItem("ej_interativo_aberto", a.pasta); } catch (e) {}
  }

  function fechar() {
    try { estojo()?.salvarAgora(); } catch (e) {}
    try { nav()?.guardarPosicao(); } catch (e) {}
    enviarPosicao();
    barraIA.definir(null);
    if (maximizado()) sairMax();
    aberta = null;
    $(ID).classList.remove("ia-lendo");
    $("iaQuadro").src = "about:blank";
    try { sessionStorage.removeItem("ej_interativo_aberto"); } catch (e) {}
    carregar();
  }

  // ------------------------------------------------------------ Estojo (barra do app; o motor roda no quadro)
  const IC = {
    mao: '<path d="M4.037 4.688a.495.495 0 0 1 .651-.651l16 6.5a.5.5 0 0 1-.063.947l-6.124 1.58a2 2 0 0 0-1.438 1.435l-1.579 6.126a.5.5 0 0 1-.947.063z"/>',
    marca: '<path d="m9 11-6 6v3h9l3-3"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/>',
    sublinhado: '<path d="M6 4v6a6 6 0 0 0 12 0V4"/><line x1="4" x2="20" y1="20" y2="20"/>',
    tachado: '<path d="M16 4H9a3 3 0 0 0-2.83 4"/><path d="M14 12a4 4 0 0 1 0 8H6"/><line x1="4" x2="20" y1="12" y2="12"/>',
    caneta: '<path d="M12 20h9"/><path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z"/>',
    marcador: '<path d="m9.06 11.9 8.07-8.06a2.85 2.85 0 1 1 4.03 4.03l-8.06 8.08"/><path d="M7.07 14.94c-1.66 0-3 1.35-3 3.02 0 1.33-2.5 1.52-2 2.02 1.08 1.1 2.49 2.02 4 2.02 2.2 0 4-1.8 4-4.04a3.01 3.01 0 0 0-3-3.02z"/>',
    borracha: '<path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/><path d="M22 21H7"/><path d="m5 11 9 9"/>',
    nota: '<path d="M15.5 3H5a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h14a2 2 0 0 0 2-2V8.5L15.5 3Z"/><path d="M15 3v6h6"/>',
    adesivo: '<path d="M15.5 3H5a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h14a2 2 0 0 0 2-2V8.5L15.5 3Z"/><path d="M14 3v4a2 2 0 0 0 2 2h4"/><path d="M8 13h.01"/><path d="M16 13h.01"/><path d="M10 16s.8 1 2 1c1.3 0 2-1 2-1"/>',
    desfazer: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11"/>',
    refazer: '<path d="m15 14 5-5-5-5"/><path d="M20 9H9.5A5.5 5.5 0 0 0 4 14.5A5.5 5.5 0 0 0 9.5 20H13"/>',
    ver: '<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/>',
    esconder: '<path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"/><path d="M14.084 14.158a3 3 0 0 1-4.242-4.242"/><path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"/><path d="m2 2 20 20"/>',
    limpar: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>'
  };
  const svgIc = n => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[n]}</svg>`;
  const FERRAMENTAS = [
    ["mao", "Seta: usar a apostila normalmente; arrastar notas e adesivos (V)"],
    ["marca", "Marca-texto: selecione o texto (M)"],
    ["sublinhado", "Sublinhar: selecione o texto (U)"],
    ["tachado", "Tachar: selecione o texto (T)"],
    ["caneta", "Caneta: desenhe e escreva à mão (P)"],
    ["marcador", "Marcador: traço largo e transparente (H)"],
    ["borracha", "Borracha: clique ou passe por cima para apagar (E)"],
    ["nota", "Nota: clique onde quer colar a nota (N)"],
    ["adesivo", "Adesivos: escolha um e clique na apostila (S)"]
  ];
  const ADESIVOS = ["⭐", "❗", "❓", "✅", "❌", "💡", "🔥", "❤️", "📌", "🧠", "⚠️", "🎯", "👀", "💀", "🩺", "✏️", "📖", "⏰", "🔁", "➕"];
  // opcoesAbertas: o painel de cores/opções só aparece quando a pessoa clica DE NOVO na ferramenta ativa (pedido do usuário:
  // aberto o tempo todo ele tapava a apostila). Fecha ao escolher, ao clicar na apostila ou com Esc.
  let estojoAberto = true;
  const MT = () => window.EJ_MARCA_TEXTO || null;
  try { estojoAberto = localStorage.getItem("ej_estojo_aberto") !== "0"; } catch (e) {}
  const estojo = () => { try { return $("iaQuadro").contentWindow.ejEstojo || null; } catch (e) { return null; } };

  // O quadro é do mesmo endereço do app: injeta o motor do estojo no documento da apostila.
  function injetarEstojo(q, a) {
    let doc;
    try { doc = q.contentDocument; } catch (e) { return; }
    if (!doc || !doc.head || doc.URL === "about:blank" || q.contentWindow.ejEstojo) return;
    const s = doc.createElement("script");
    s.src = "/estojo_apostila.js?v=16";
    s.onload = () => {
      try {
        q.contentWindow.ejEstojo.iniciar({ pasta: a.pasta, marcaTexto: MT(), aoMudar: e => barraIA.definir(e) });
        let fz = 100;
        try { const v = parseInt(localStorage.getItem("ej_estojo_intensidade"), 10); if (Number.isFinite(v)) fz = Math.min(100, Math.max(0, v)); } catch (er) {}
        q.contentWindow.ejEstojo.usar(null, { intensidade: fz });
      }
      catch (e) { console.warn("estojo:", e); }
      const fecharOpcoes = () => barraIA.fecharOpcoes();
      try {
        q.contentWindow.addEventListener("pointerdown", fecharOpcoes, true);
        q.contentWindow.addEventListener("keydown", ev => { if (ev.key === "Escape") fecharOpcoes(); }, true);
      } catch (e) {}
    };
    doc.head.append(s);
  }

  // Barra do estojo reutilizável (19/11/2026: também no Teste da Calculadora, window.ejCriarBarraEstojo).
  // c = { els() -> {caixa, barra, ops, est, btn}, motor() -> ejEstojo, foco(), aberto() -> bool }
  function criarBarraEstojo(c) {
    let estadoEstojo = null, limparTimer = 0, opcoesAbertas = false;
    const foco = () => { try { c.foco && c.foco(); } catch (err) {} };
  function desenharEstojo() {
    const { caixa, barra, ops, est, btn } = c.els();
    if (!caixa) return;
    const estojoAberto = c.aberto();
    if (btn) btn.setAttribute("aria-pressed", estojoAberto ? "true" : "false");
    const e = estadoEstojo, mot = c.motor();
    caixa.hidden = !e || !estojoAberto;
    caixa.parentElement.classList.toggle("com-estojo", !caixa.hidden);
    est.textContent = !e ? "" : e.salvo === "erro" ? "Anotações não salvas, tentando de novo" : e.salvo === "salvando" ? "Salvando anotações..." : "";
    est.classList.toggle("erro", !!e && e.salvo === "erro");
    if (!e || !mot) return;
    const C = { sublinhado: mot.CORES_CANETA, tachado: mot.CORES_CANETA, caneta: mot.CORES_CANETA, nota: mot.CORES_NOTA };
    const corDaFerr = f => (f === "marca" || f === "marcador") ? mot.hexMarca(e.op.corMarca)
      : f === "nota" ? C.nota[e.op.corNota] : f === "caneta" ? C[f][e.op.corCaneta] : f === "sublinhado" ? C[f][e.op.corSub || e.op.corCaneta] : f === "tachado" ? C[f][e.op.corTach || e.op.corCaneta] : "";
    const COM_OPCOES = ["marca", "sublinhado", "tachado", "caneta", "marcador", "nota", "adesivo"];
    barra.innerHTML = FERRAMENTAS.map(([f, t]) => {
      const c = corDaFerr(f), dica = COM_OPCOES.includes(f) ? `${t}. Clique de novo para as cores e opções` : t;
      return `<button type="button" class="ia-ferr" data-f="${f}" title="${dica}" aria-label="${t}" aria-pressed="${e.ferramenta === f}"${COM_OPCOES.includes(f) ? ` aria-expanded="${e.ferramenta === f && opcoesAbertas}"` : ""}>${svgIc(f)}${c ? `<i style="--c:${c}"></i>` : ""}</button>`;
    }).join("") + `<hr>
      <button type="button" class="ia-ferr" data-x="desfazer" title="Desfazer (Ctrl+Z)" aria-label="Desfazer" ${e.podeDesfazer ? "" : "disabled"}>${svgIc("desfazer")}</button>
      <button type="button" class="ia-ferr" data-x="refazer" title="Refazer (Ctrl+Y)" aria-label="Refazer" ${e.podeRefazer ? "" : "disabled"}>${svgIc("refazer")}</button>
      <button type="button" class="ia-ferr" data-x="ver" title="${e.mostrar ? "Esconder" : "Mostrar"} as anotações" aria-label="${e.mostrar ? "Esconder" : "Mostrar"} as anotações" aria-pressed="${!e.mostrar}">${svgIc(e.mostrar ? "ver" : "esconder")}</button>
      <button type="button" class="ia-ferr" data-x="limpar" title="Apagar tudo desta página (clique duas vezes)" aria-label="Apagar tudo desta página" ${e.naPagina ? "" : "disabled"}>${svgIc("limpar")}</button>`;
    barra.querySelectorAll("[data-f]").forEach(b => b.onclick = () => {
      if (e.ferramenta === b.dataset.f) { opcoesAbertas = !opcoesAbertas; desenharEstojo(); return; }   // 2º clique: abre/fecha as opções
      opcoesAbertas = false;
      mot.usar(b.dataset.f);
      foco();
    });
    barra.querySelector('[data-x="desfazer"]').onclick = () => mot.desfazer();
    barra.querySelector('[data-x="refazer"]').onclick = () => mot.refazer();
    barra.querySelector('[data-x="ver"]').onclick = () => mot.visivel(!e.mostrar);
    const bl = barra.querySelector('[data-x="limpar"]');
    bl.onclick = () => {   // sem caixa de confirmação do navegador: o 1º clique arma, o 2º apaga (3 s)
      if (!bl.classList.contains("confirmar")) {
        bl.classList.add("confirmar");
        bl.title = "Clique de novo para apagar tudo desta página";
        clearTimeout(limparTimer);
        limparTimer = setTimeout(desenharEstojo, 3000);
        return;
      }
      clearTimeout(limparTimer);
      mot.limparPagina();
    };
    // opções da ferramenta escolhida
    const f = e.ferramenta;
    const cores = (tabela, chave, atual) => `<div class="ia-cores">${Object.entries(tabela).map(([n, c]) =>
      `<button type="button" class="ia-cor" style="--c:${c}" data-k="${chave}" data-v="${n}" title="${n}" aria-label="${n}" aria-pressed="${atual === n}"></button>`).join("")}</div>`;
    let h = "";
    const nomeMarca = (() => { const i = MT() && MT().info(e.op.corMarca); return i ? `${i.gama} ${i.codigo} · ${i.nome}` : ""; })();
    const forcaHtml = `<label class="ia-op-forca">Intensidade <input type="range" min="0" max="100" step="1" value="${e.op.intensidade ?? 100}" aria-label="Intensidade do marca-texto"><span class="ia-forca-num"><input type="number" min="0" max="100" step="1" value="${e.op.intensidade ?? 100}" aria-label="Intensidade em porcentagem">%</span></label>`;
    if (f === "marca") h = `<div class="ia-op-titulo">Marca-texto <span class="ia-op-cor">${nomeMarca}</span></div><div data-paleta></div>${forcaHtml}<div class="ia-op-dica">Selecione o texto. Clique numa marca para trocar a cor, sublinhar, escrever uma nota ou apagar.</div>`;
    else if (f === "sublinhado") h = `<div class="ia-op-titulo">Sublinhar</div>${cores(mot.CORES_CANETA, "corSub", e.op.corSub || e.op.corCaneta)}<div class="ia-op-dica">Selecione o texto.</div>`;
    else if (f === "tachado") h = `<div class="ia-op-titulo">Tachar</div>${cores(mot.CORES_CANETA, "corTach", e.op.corTach || e.op.corCaneta)}<div class="ia-op-dica">Selecione o texto.</div>`;
    else if (f === "caneta") h = `<div class="ia-op-titulo">Caneta</div>${cores(mot.CORES_CANETA, "corCaneta", e.op.corCaneta)}
      <div class="ia-tamanhos">${[2, 3, 5].map(n => `<button type="button" class="ia-tam" data-k="largura" data-v="${n}" aria-label="Espessura ${n}" aria-pressed="${e.op.largura === n}"><span style="height:${n}px"></span></button>`).join("")}</div>`;
    else if (f === "marcador") h = `<div class="ia-op-titulo">Marcador <span class="ia-op-cor">${nomeMarca}</span></div><div data-paleta></div>${forcaHtml}<div class="ia-op-dica">Bom para destacar figuras e esquemas.</div>`;
    else if (f === "nota") h = `<div class="ia-op-titulo">Nota</div>${cores(mot.CORES_NOTA, "corNota", e.op.corNota)}<div class="ia-op-dica">Clique onde a nota deve ficar. Com a seta, arraste pelo topo para mudar de lugar.</div>`;
    else if (f === "adesivo") h = `<div class="ia-op-titulo">Adesivos</div>
      <div class="ia-adesivos">${ADESIVOS.map(a => `<button type="button" class="ia-ades" data-k="adesivo" data-v="${a}" aria-pressed="${e.op.adesivo === a}">${a}</button>`).join("")}</div>
      ${mot.SETAS && mot.adesivoHtml ? `<div class="ia-op-sub">Setas</div><div class="ia-adesivos ia-setas">${mot.SETAS.map(a => `<button type="button" class="ia-ades" data-k="adesivo" data-v="${a}" aria-label="Seta ${a.split(":").slice(1).join(" ")}" aria-pressed="${e.op.adesivo === a}">${mot.adesivoHtml(a)}</button>`).join("")}</div>` : ""}
      <div class="ia-rotulos">${Object.entries(mot.ROTULOS).map(([t, c]) => `<button type="button" class="ia-rot" style="--c:${c}" data-k="adesivo" data-v="${t}" aria-pressed="${e.op.adesivo === t}">${t}</button>`).join("")}</div>
      <div class="ia-op-dica">Clique onde quer colar. Com a seta, arraste para mover. Dois cliques num adesivo: girar, mudar o tamanho ou apagar.</div>`;
    else if (f === "borracha") h = `<div class="ia-op-titulo">Borracha</div><div class="ia-op-dica">Clique ou passe por cima de traços, marcas, notas e adesivos. Ctrl+Z desfaz.</div>`;
    ops.hidden = !h || !opcoesAbertas;
    ops.innerHTML = opcoesAbertas ? h : "";
    const ph = ops.querySelector("[data-paleta]");
    if (ph && MT()) {
      MT().estilo();
      ph.replaceWith(MT().paleta({ atual: e.op.corMarca, aoEscolher: codigo => { opcoesAbertas = false; mot.usar(null, { corMarca: codigo }); foco(); } }));
    }
    // intensidade das próximas marcas (0 a 100%), lembrada em ej_estojo_intensidade
    const fx = ops.querySelector('.ia-op-forca input[type="range"]');
    if (fx) {
      const num = ops.querySelector('.ia-op-forca input[type="number"]');
      const limpo = v => Math.min(100, Math.max(0, Math.round(Number(v) || 0)));
      const gravar = v => { try { localStorage.setItem("ej_estojo_intensidade", String(v)); } catch (er) {} mot.usar(null, { intensidade: v }); };
      fx.oninput = () => { num.value = fx.value; };
      fx.onchange = () => gravar(+fx.value);
      // digitar o número: Enter ou sair do campo grava (0 a 100)
      num.oninput = () => { if (num.value !== "") fx.value = limpo(num.value); };
      num.onchange = () => { const v = limpo(num.value); num.value = v; fx.value = v; gravar(v); };
      num.onkeydown = ev => { if (ev.key === "Enter") { ev.preventDefault(); num.blur(); } };
      num.onfocus = () => num.select();
    }
    ops.querySelectorAll("[data-k]").forEach(b => b.onclick = () => {
      const k = b.dataset.k;
      opcoesAbertas = false;
      mot.usar(null, { [k]: k === "largura" ? +b.dataset.v : b.dataset.v });
      foco();
    });
  }
    return {
      definir(e) { estadoEstojo = e; desenharEstojo(); },
      estado: () => estadoEstojo,
      desenhar: desenharEstojo,
      fecharOpcoes() { if (opcoesAbertas) { opcoesAbertas = false; desenharEstojo(); } }
    };
  }
  window.ejCriarBarraEstojo = criarBarraEstojo;
  const barraIA = criarBarraEstojo({
    els: () => ({ caixa: $("iaEstojo"), barra: $("iaEstojoBarra"), ops: $("iaEstojoOpcoes"), est: $("iaEstojoEstado"), btn: $("iaEstojoBtn") }),
    motor: () => estojo(),
    foco: () => $("iaQuadro").contentWindow.focus(),
    aberto: () => estojoAberto
  });
  const desenharEstojo = () => barraIA.desenhar();

  async function postJson(url, corpo) {
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.detail || "HTTP " + r.status);
    return d;
  }

  // Ponte: só atende mensagens do site aberto no quadro
  window.addEventListener("message", async e => {
    const q = $("iaQuadro"), m = e.data;
    if (!q || !aberta || e.source !== q.contentWindow || !m || m.ej !== 1 || m.ok !== undefined) return;
    const pasta = encodeURIComponent(aberta.pasta);
    const responder = (ok, valor) => q.contentWindow.postMessage({ ej: 1, req: m.req, ok, valor }, "*");
    try {
      if (m.acao === "ola") { $("iaPonte").textContent = "Progresso salvo no Estuda Jaider"; return responder(true, true); }
      if (m.acao === "lerProgresso") {
        const r = await fetch(`/api/interativos/${pasta}/progresso`, { cache: "no-store" });
        return responder(true, r.ok ? (await r.json()).texto : null);
      }
      if (m.acao === "salvarProgresso") {
        await postJson(`/api/interativos/${pasta}/progresso`, { texto: String(m.dados?.texto ?? "") });
        clearTimeout(timerDominio); timerDominio = setTimeout(carregarDominio, 2000);
        return responder(true, null);
      }
      responder(false, "ação desconhecida");
    } catch (err) {
      responder(false, err.message);
    }
  });
  window.addEventListener("ej-progresso-apostila-salvo", () => {
    clearTimeout(timerDominio);
    timerDominio = setTimeout(carregarDominio, 1200);
  });

  function aoAbrirPagina() {
    montar();
    if (aberta) { ajustarAltura(); return; }
    carregar().then(() => {
      let ult = null;
      try { ult = sessionStorage.getItem("ej_interativo_aberto"); } catch (err) {}
      const a = ult && lista.find(x => x.pasta === ult);
      // quem pediu uma seção (Calculadora "Revisar nas apostilas", busca do app) pode ter aberto antes: não apaga o pedido
      if (a && !aberta) abrir(a);
    });
  }
  document.addEventListener("pagina-aberta", e => { if (e.detail?.id === ID) aoAbrirPagina(); });
  // O app pode abrir direto em #interativos (recarregar, janela do Electron) e avisar "pagina-aberta" antes de este
  // script chegar: aí a lista ficava para sempre em "Carregando...". Se a página já está na tela, carrega agora.
  function inicio() {
    montar();
    const el = $(ID);
    if (el && !el.hidden && el.isConnected) aoAbrirPagina();
  }
  if (document.readyState !== "loading") inicio(); else document.addEventListener("DOMContentLoaded", inicio);
  // abrir(pasta, {hash, termo}): a busca do app abre a apostila já na seção achada, com o termo na busca da apostila
  window.interativos = { carregar, abrir: (pasta, pedido) => { const a = lista.find(x => x.pasta === pasta); if (a) abrir(a, pedido); }, fechar };
  window.addEventListener("pagehide", () => { try { nav()?.guardarPosicao(); } catch (e) {} enviarPosicao(); });
})();
