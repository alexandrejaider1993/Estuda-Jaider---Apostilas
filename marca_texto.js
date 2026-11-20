/* Gerado por gerar_tema.py a partir de marca_texto.py. Não edite a mão: edite o .py e rode de novo.
   Paleta única de marca-texto (Stabilo Boss, gama completa 2025). Uso:
     EJ_MARCA_TEXTO.hex("70/24") -> "#FAE905"      EJ_MARCA_TEXTO.info("70/24") -> {codigo, nome, hex, escura, gama}
     EJ_MARCA_TEXTO.paleta({ atual, aoEscolher, doc })  -> elemento com as três gamas (botões redondos)
   Para a cor sair exata: tinta cheia (opacidade 1) e mix-blend-mode: multiply (texto preto continua preto). */
(function (W) {
  "use strict";
  const DADOS = {
 "gamas": [
  {
   "nome": "Pastel",
   "cores": [
    {
     "codigo": "70/111",
     "nome": "Azul nublado",
     "hex": "#C4DAF2",
     "escura": false
    },
    {
     "codigo": "70/112",
     "nome": "Azul ventoso",
     "hex": "#BBE5F4",
     "escura": false
    },
    {
     "codigo": "70/113",
     "nome": "Toque de turquesa",
     "hex": "#83CAC6",
     "escura": false
    },
    {
     "codigo": "70/116",
     "nome": "Pitada de menta",
     "hex": "#A9D5B4",
     "escura": false
    },
    {
     "codigo": "70/125",
     "nome": "Laranja pálido",
     "hex": "#FEE392",
     "escura": false
    },
    {
     "codigo": "70/126",
     "nome": "Pêssego sedoso",
     "hex": "#F59E83",
     "escura": false
    },
    {
     "codigo": "70/129",
     "nome": "Rubor rosa",
     "hex": "#F8ADBA",
     "escura": false
    },
    {
     "codigo": "70/133",
     "nome": "Faísca de lima",
     "hex": "#C8DB83",
     "escura": false
    },
    {
     "codigo": "70/140",
     "nome": "Coral meloso",
     "hex": "#EB552D",
     "escura": false
    },
    {
     "codigo": "70/144",
     "nome": "Amarelo cremoso",
     "hex": "#F6EFA0",
     "escura": false
    },
    {
     "codigo": "70/150",
     "nome": "Rosa cerejeira",
     "hex": "#EB552B",
     "escura": false
    },
    {
     "codigo": "70/155",
     "nome": "Brisa violeta",
     "hex": "#C6A1CC",
     "escura": false
    },
    {
     "codigo": "70/158",
     "nome": "Fúcsia gelado",
     "hex": "#F9C0DA",
     "escura": false
    },
    {
     "codigo": "70/194",
     "nome": "Cinza empoeirado",
     "hex": "#D0D7DC",
     "escura": false
    }
   ]
  },
  {
   "nome": "Neon",
   "cores": [
    {
     "codigo": "70/24",
     "nome": "Amarelo",
     "hex": "#FAE905",
     "escura": false
    },
    {
     "codigo": "70/31",
     "nome": "Azul",
     "hex": "#3EC0F1",
     "escura": false
    },
    {
     "codigo": "70/33",
     "nome": "Verde",
     "hex": "#86BC40",
     "escura": false
    },
    {
     "codigo": "70/40",
     "nome": "Vermelho",
     "hex": "#F18795",
     "escura": false
    },
    {
     "codigo": "70/51",
     "nome": "Turquesa",
     "hex": "#7BC6AF",
     "escura": false
    },
    {
     "codigo": "70/54",
     "nome": "Laranja",
     "hex": "#FCBA32",
     "escura": false
    },
    {
     "codigo": "70/55",
     "nome": "Lavanda",
     "hex": "#9C75B4",
     "escura": false
    },
    {
     "codigo": "70/56",
     "nome": "Rosa",
     "hex": "#ED6FA5",
     "escura": false
    },
    {
     "codigo": "70/58",
     "nome": "Lilás",
     "hex": "#DE71AB",
     "escura": false
    }
   ]
  },
  {
   "nome": "Nature",
   "cores": [
    {
     "codigo": "70/137",
     "nome": "Verde barro",
     "hex": "#B9B496",
     "escura": false
    },
    {
     "codigo": "70/163",
     "nome": "Verde terra",
     "hex": "#A0B9B3",
     "escura": false
    },
    {
     "codigo": "70/165",
     "nome": "Ocre escuro",
     "hex": "#B88A82",
     "escura": false
    },
    {
     "codigo": "70/175",
     "nome": "Siena",
     "hex": "#E89377",
     "escura": false
    },
    {
     "codigo": "70/186",
     "nome": "Bege",
     "hex": "#E9C4AC",
     "escura": false
    },
    {
     "codigo": "70/193",
     "nome": "Cinza quente",
     "hex": "#9E8A83",
     "escura": false
    },
    {
     "codigo": "70/46",
     "nome": "Preto",
     "hex": "#01010B",
     "escura": true
    }
   ]
  }
 ],
 "padrao": "70/24",
 "favoritas": [
  "70/24",
  "70/33",
  "70/56",
  "70/31",
  "70/54"
 ]
};
  const LISTA = [];
  DADOS.gamas.forEach(g => g.cores.forEach(c => LISTA.push({ ...c, gama: g.nome })));
  const POR_CODIGO = Object.fromEntries(LISTA.map(c => [c.codigo, c]));
  const POR_HEX = Object.fromEntries(LISTA.map(c => [c.hex.toUpperCase(), c]));
  const info = v => POR_CODIGO[v] || POR_HEX[String(v || "").toUpperCase()] || null;
  const hex = v => (info(v) || POR_CODIGO[DADOS.padrao]).hex;
  const rotulo = c => `${c.gama} ${c.codigo} · ${c.nome}`;
  function paleta({ atual = "", aoEscolher = () => {}, doc = document, compacta = false } = {}) {
    const caixa = doc.createElement("div");
    caixa.className = "ej-paleta" + (compacta ? " ej-paleta--compacta" : "");
    const sel = info(atual);
    DADOS.gamas.forEach(g => {
      const t = doc.createElement("div"); t.className = "ej-paleta__gama"; t.textContent = g.nome;
      const grade = doc.createElement("div"); grade.className = "ej-paleta__grade";
      g.cores.forEach(c => {
        const b = doc.createElement("button");
        b.type = "button"; b.className = "ej-paleta__cor"; b.style.setProperty("--c", c.hex);
        b.title = rotulo({ ...c, gama: g.nome }); b.setAttribute("aria-label", b.title);
        b.setAttribute("aria-pressed", String(!!sel && sel.codigo === c.codigo));
        b.onclick = e => { e.preventDefault(); aoEscolher(c.codigo, c.hex, c); };
        b.onmousedown = e => e.preventDefault();          // não tira a seleção de texto do editor
        grade.append(b);
      });
      caixa.append(t, grade);
    });
    return caixa;
  }
  const CSS = `
  .ej-paleta { display: grid; gap: 6px; min-width: 0; }
  .ej-paleta__gama { font: 600 10px/1.2 system-ui, -apple-system, "Segoe UI", sans-serif; letter-spacing: .06em; text-transform: uppercase; opacity: .65; margin-top: 2px; }
  .ej-paleta__grade { display: grid; grid-template-columns: repeat(7, 22px); gap: 5px; }
  .ej-paleta--compacta .ej-paleta__grade { grid-template-columns: repeat(7, 20px); gap: 4px; }
  .ej-paleta__cor { width: 22px; height: 22px; padding: 0; border-radius: 50%; border: 0; cursor: pointer; background: var(--c);
    box-shadow: inset 0 0 0 1px rgba(0,0,0,.14); }
  .ej-paleta--compacta .ej-paleta__cor { width: 20px; height: 20px; }
  .ej-paleta__cor:hover { transform: scale(1.12); }
  .ej-paleta__cor[aria-pressed="true"] { box-shadow: inset 0 0 0 1px rgba(0,0,0,.14), 0 0 0 2px #fff, 0 0 0 4px #1d1d1f; }
  .ej-paleta__cor:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }`;
  function estilo(doc = document) {
    if (doc.getElementById("ejPaletaCss")) return;
    const s = doc.createElement("style"); s.id = "ejPaletaCss"; s.textContent = CSS; doc.head.append(s);
  }
  W.EJ_MARCA_TEXTO = { ...DADOS, lista: LISTA, info, hex, rotulo, paleta, estilo };
})(window);
