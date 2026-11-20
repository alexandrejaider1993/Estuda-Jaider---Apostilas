/* Sliders (input type=range) no estilo ElevenLabs: o trilho mostra a parte já preenchida (etapa 4 do novo design).
 * O CSS (skin-eleven.css) pinta o trilho com a variável --p; aqui ela é calculada para qualquer slider da página,
 * inclusive os criados depois (zoom do leitor) e os que mudam de valor pelo código. Sem efeito fora da skin. */
(function () {
  "use strict";
  function pintar(el) {
    if (!el || el.type !== "range") return;
    const min = +el.min || 0, max = el.max === "" ? 100 : +el.max, v = +el.value;
    const p = max > min ? ((v - min) / (max - min)) * 100 : 0;
    el.style.setProperty("--p", Math.max(0, Math.min(100, p)).toFixed(2) + "%");
  }
  function todos() { document.querySelectorAll('input[type="range"]').forEach(pintar); }
  document.addEventListener("input", e => pintar(e.target), true);
  document.addEventListener("change", e => pintar(e.target), true);
  document.addEventListener("pointerover", e => { if (e.target && e.target.type === "range") pintar(e.target); }, true);
  window.addEventListener("load", todos);
  setInterval(todos, 1000);   // valores trocados pelo código (sem evento) e sliders que aparecem depois
  todos();
})();
