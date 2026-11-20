#!/usr/bin/env python3
"""Gera `catalogo.json` e `indice_busca.json` para o site estático de Apostilas Interativas (Vercel).

Como usar quando você adicionar uma nova apostila na pasta `interativos/<nome-da-pasta>/`:
    python atualizar_catalogo.py

O script lê todas as pastas dentro de `interativos/`, extrai os metadados (`biblioteca.json`),
a chave de localStorage (`const CH = '...'`), os conceitos e testes de `const D = {...}` (para o cálculo
instantâneo de Domínio por Conceito via BKT no navegador) e monta o índice de busca em todas as seções.
"""
import json
import os
import re
import unicodedata
from pathlib import Path

RAIZ = Path(__file__).resolve().parent
PASTA_INTERATIVOS = RAIZ / "interativos"
FORMATO = "estuda-jaider-site"
EXT_CAPA = (".jpg", ".jpeg", ".png", ".webp")
_INICIO_D = re.compile(r"const\s+D\s*=\s*\{")
_CHAVE_CH = re.compile(r"""\bconst\s+CH\s*=\s*['"]([^'"]{1,80})['"]""")


def ler_json(caminho: Path):
    try:
        return json.loads(caminho.read_text(encoding="utf-8"))
    except Exception:
        return None


def titulo_do_html(conteudo: str) -> str:
    m = re.search(r"<title[^>]*>(.*?)</title>", conteudo or "", re.S | re.I)
    return re.sub(r"\s+", " ", m.group(1)).strip() if m else ""


def extrair_D(html: str):
    m = _INICIO_D.search(html or "")
    if not m:
        return None
    try:
        d, _ = json.JSONDecoder().raw_decode(html[m.end() - 1:])
        return d if isinstance(d, dict) else None
    except ValueError:
        return None


def limpo(t) -> str:
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", str(t or "").replace("**", ""))).strip()


def extrair_secoes(D, html, titulo_padrao):
    secoes = []
    if D:
        for b in D.get("blocos") or []:
            partes = [limpo(b.get("titulo"))]
            for it in b.get("seq") or []:
                if isinstance(it, list):
                    partes.extend(
                        limpo(x)
                        for x in it[1:]
                        if isinstance(x, str) and not str(x).lower().endswith((".jpg", ".png", ".jpeg", ".webp"))
                    )
                    for x in it[1:]:
                        if isinstance(x, list):
                            partes.extend(limpo(y) for y in x if isinstance(y, str))
            secoes.append({
                "hash": str(b.get("id", "")),
                "secao": limpo(b.get("titulo")),
                "texto": " ".join(p for p in partes if p),
            })
        for q in D.get("questoes") or []:
            txt = " ".join(
                limpo(x)
                for x in [q.get("enunciado"), *(q.get("itens") or []), q.get("resposta_esperada"), q.get("comentario")]
                if x
            )
            secoes.append({
                "hash": str(q.get("id", "")),
                "secao": limpo(q.get("ref")) or "Questão",
                "texto": txt,
            })
    else:
        secoes.append({
            "hash": "",
            "secao": titulo_padrao,
            "texto": limpo(re.sub(r"(?is)<(script|style)\b.*?</\1>", " ", html)),
        })
    return secoes


def ficha_apostila(pasta: Path):
    f = ler_json(pasta / "biblioteca.json")
    if isinstance(f, dict) and f.get("formato") == FORMATO:
        return f
    if (pasta / "index.html").is_file():
        try:
            titulo = titulo_do_html((pasta / "index.html").read_text(encoding="utf-8", errors="ignore")[:20000])
        except Exception:
            titulo = ""
        return {"formato": FORMATO, "titulo": titulo or pasta.name, "arquivo": "index.html"}
    return None


def main():
    PASTA_INTERATIVOS.mkdir(parents=True, exist_ok=True)
    catalogo_atual = ler_json(RAIZ / "catalogo.json") or {}
    org_padrao = catalogo_atual.get("organizacao_padrao") or {
        "pastas": {},
        "apostilas": {},
    }
    aparencia_padrao = catalogo_atual.get("aparencia_padrao") or {}

    apostilas = []
    indice_busca = {}

    for pasta in sorted(PASTA_INTERATIVOS.iterdir(), key=lambda p: p.name.lower()):
        if not pasta.is_dir() or pasta.name.startswith((".", "_")):
            continue
        f = ficha_apostila(pasta)
        if not f:
            continue
        arquivo = f.get("arquivo") or "index.html"
        arq_html = pasta / arquivo
        if not arq_html.is_file():
            continue

        capa = (
            f.get("capa")
            if f.get("capa") and (pasta / f["capa"]).is_file()
            else next(
                (p.name for p in pasta.iterdir() if p.stem.lower() == "capa" and p.suffix.lower() in EXT_CAPA),
                None,
            )
        )

        html = arq_html.read_text(encoding="utf-8", errors="ignore")
        m_ch = _CHAVE_CH.search(html)
        chave_local = m_ch.group(1) if m_ch else ""

        D = extrair_D(html) or {}
        conceitos = [
            {"id": c.get("id"), "nome": c.get("nome") or c.get("id")}
            for c in (D.get("conceitos") or [])
            if isinstance(c, dict) and c.get("id")
        ]
        testes = [
            {
                "id": t.get("id"),
                "conceito": t.get("conceito"),
                "nivel": t.get("nivel", 1),
                "correta": t.get("correta"),
                "n_alt": len(t.get("alternativas") or []) or 4,
            }
            for t in (D.get("testes") or [])
            if isinstance(t, dict) and t.get("id") and t.get("conceito")
        ]

        titulo = f.get("titulo") or pasta.name
        apostilas.append({
            "pasta": pasta.name,
            "titulo": titulo,
            "subtitulo": f.get("subtitulo", ""),
            "disciplina": f.get("disciplina", ""),
            "periodo": f.get("periodo", ""),
            "prova": f.get("prova", ""),
            "data_aula": f.get("data_aula", ""),
            "capitulos": f.get("capitulos", []),
            "contagem": f.get("contagem", {}),
            "url": f"/interativos/{pasta.name}/{arquivo}",
            "capa": f"/interativos/{pasta.name}/{capa}" if capa else "",
            "modificado": int(arq_html.stat().st_mtime),
            "chave_local": chave_local,
            "conceitos": conceitos,
            "testes": testes,
        })

        indice_busca[pasta.name] = {
            "titulo": titulo,
            "secoes": extrair_secoes(D, html, titulo),
        }

    apostilas.sort(key=lambda a: a["data_aula"] or "", reverse=True)

    saida_catalogo = {
        "apostilas": apostilas,
        "organizacao_padrao": org_padrao,
        "aparencia_padrao": aparencia_padrao,
    }

    (RAIZ / "catalogo.json").write_text(
        json.dumps(saida_catalogo, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    (RAIZ / "indice_busca.json").write_text(
        json.dumps(indice_busca, ensure_ascii=False),
        encoding="utf-8",
    )
    print(f"Catálogo atualizado com {len(apostilas)} apostila(s)!")


if __name__ == "__main__":
    main()
