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
    titulo_html = ""
    if (pasta / "index.html").is_file():
        try:
            titulo_html = titulo_do_html((pasta / "index.html").read_text(encoding="utf-8", errors="ignore")[:20000])
        except Exception:
            titulo_html = ""
    if isinstance(f, dict) and f.get("formato") == FORMATO:
        # Se biblioteca.json foi copiado de outra pasta (id != pasta.name), corrige id e titulo automaticamente
        if f.get("id") and f.get("id") != pasta.name and titulo_html:
            f["id"] = pasta.name
            f["titulo"] = titulo_html
        return f
    if (pasta / "index.html").is_file():
        return {"formato": FORMATO, "titulo": titulo_html or pasta.name, "arquivo": "index.html"}
    return None


def resolver_disciplina_pasta(pasta_nome: str, f: dict, org_padrao: dict) -> str:
    disc = str((f or {}).get("disciplina") or "").strip()
    pastas = (org_padrao or {}).get("pastas") or {}
    mapa_ap = (org_padrao or {}).get("apostilas") or {}
    pid = mapa_ap.get(pasta_nome)
    cadeia = []
    visitados = set()
    while pid and pid in pastas and pid not in visitados:
        visitados.add(pid)
        p_info = pastas[pid] or {}
        nome_p = str(p_info.get("nome") or "").strip()
        if nome_p:
            cadeia.append(nome_p)
        pid = p_info.get("pai")
    if cadeia:
        # Pasta raiz (ex.: "Anatomia Patológica II" mesmo se estiver dentro de "P4")
        return cadeia[-1]
    if disc:
        return disc
    return "Geral"


def extrair_banco_questoes(D: dict, pasta_nome: str, titulo_apostila: str, disciplina: str):
    itens_banco = []
    if not isinstance(D, dict):
        return itens_banco

    mapa_conceitos = {
        str(c.get("id")): str(c.get("nome") or c.get("id"))
        for c in (D.get("conceitos") or [])
        if isinstance(c, dict) and c.get("id")
    }

    # 1. Questões de prova / simulado (D.questoes)
    for idx, q in enumerate(D.get("questoes") or []):
        if not isinstance(q, dict):
            continue
        qid = str(q.get("id") or f"q{idx + 1}")
        obj = q.get("objetiva") if isinstance(q.get("objetiva"), dict) else None
        alts = list(obj.get("alts") or []) if obj else []
        eh_objetiva = len(alts) >= 2 and obj.get("correta") is not None

        # Tenta identificar conceito principal a partir de alvos
        conceito_id = ""
        conceito_nome = ""
        alvos = q.get("alvos")
        if isinstance(alvos, dict):
            for vals in alvos.values():
                if isinstance(vals, list) and vals:
                    conceito_id = str(vals[0])
                    conceito_nome = mapa_conceitos.get(conceito_id, conceito_id)
                    break

        itens_banco.append({
            "uid": f"{pasta_nome}::q::{qid}",
            "id": qid,
            "tipo": "prova",
            "formato": "objetiva" if eh_objetiva else "discursiva",
            "pasta": pasta_nome,
            "apostila": titulo_apostila,
            "disciplina": disciplina,
            "ref": str(q.get("ref") or "").strip(),
            "capitulo": str(q.get("capitulo") or "").strip(),
            "conceito_id": conceito_id,
            "conceito_nome": conceito_nome,
            "nivel": 0,
            "enunciado": str(q.get("enunciado") or "").strip(),
            "itens": [str(x) for x in (q.get("itens") or []) if x],
            "alternativas": [str(a) for a in alts] if eh_objetiva else [],
            "correta": int(obj.get("correta")) if eh_objetiva else None,
            "explicacao": str(q.get("resposta_esperada") or "").strip(),
            "comentario": str(q.get("comentario") or "").strip(),
            "errados": {},
            "hash": qid,
        })

    # 2. Testes de fixação (D.testes)
    for idx, t in enumerate(D.get("testes") or []):
        if not isinstance(t, dict):
            continue
        tid = str(t.get("id") or f"t{idx + 1}")
        alts = [str(a) for a in (t.get("alternativas") or [])]
        if len(alts) < 2 or t.get("correta") is None:
            continue
        cid = str(t.get("conceito") or "").strip()
        cnome = mapa_conceitos.get(cid, cid)
        errados_raw = t.get("errados") if isinstance(t.get("errados"), dict) else {}
        errados = {str(k): str(v) for k, v in errados_raw.items() if v}

        itens_banco.append({
            "uid": f"{pasta_nome}::t::{tid}",
            "id": tid,
            "tipo": "teste",
            "formato": "objetiva",
            "pasta": pasta_nome,
            "apostila": titulo_apostila,
            "disciplina": disciplina,
            "ref": str(t.get("tema") or "").strip(),
            "capitulo": str(t.get("bloco") or "").strip(),
            "conceito_id": cid,
            "conceito_nome": cnome,
            "nivel": int(t.get("nivel") or 1),
            "enunciado": str(t.get("enunciado") or "").strip(),
            "itens": [],
            "alternativas": alts,
            "correta": int(t.get("correta")),
            "explicacao": str(t.get("porque") or "").strip(),
            "comentario": "",
            "errados": errados,
            "hash": str(t.get("bloco") or "").strip(),
        })

    return itens_banco


def main():
    PASTA_INTERATIVOS.mkdir(parents=True, exist_ok=True)
    catalogo_atual = ler_json(RAIZ / "catalogo.json") or {}
    org_padrao = catalogo_atual.get("organizacao_padrao") or {
        "pastas": {},
        "apostilas": {},
    }
    aparencia_padrao = catalogo_atual.get("aparencia_padrao") or {}
    titulos_padrao = catalogo_atual.get("titulos_padrao") or {}
    disciplinas_padrao = catalogo_atual.get("disciplinas_padrao") or {}

    apostilas = []
    indice_busca = {}
    banco_questoes = []

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

        titulo_custom = titulos_padrao.get(pasta.name)
        titulo = (
            titulo_custom.strip()
            if isinstance(titulo_custom, str) and titulo_custom.strip()
            else (f.get("titulo") or pasta.name)
        )
        if pasta.name in disciplinas_padrao and isinstance(disciplinas_padrao[pasta.name], str):
            disciplina = disciplinas_padrao[pasta.name].strip()
        else:
            disciplina = f.get("disciplina", "")
        apostilas.append({
            "pasta": pasta.name,
            "titulo": titulo,
            "subtitulo": f.get("subtitulo", ""),
            "disciplina": disciplina,
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

        disc_resolvida = resolver_disciplina_pasta(pasta.name, f, org_padrao)
        banco_questoes.extend(extrair_banco_questoes(D, pasta.name, titulo, disc_resolvida))

    apostilas.sort(key=lambda a: a["data_aula"] or "", reverse=True)

    pastas_existentes = {a["pasta"] for a in apostilas}
    titulos_limpos = {
        k: v.strip()
        for k, v in titulos_padrao.items()
        if k in pastas_existentes and isinstance(v, str) and v.strip()
    }
    disciplinas_limpas = {
        k: v.strip()
        for k, v in disciplinas_padrao.items()
        if k in pastas_existentes and isinstance(v, str)
    }

    saida_catalogo = {
        "apostilas": apostilas,
        "organizacao_padrao": org_padrao,
        "aparencia_padrao": aparencia_padrao,
        "titulos_padrao": titulos_limpos,
        "disciplinas_padrao": disciplinas_limpas,
    }

    (RAIZ / "catalogo.json").write_text(
        json.dumps(saida_catalogo, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    (RAIZ / "indice_busca.json").write_text(
        json.dumps(indice_busca, ensure_ascii=False),
        encoding="utf-8",
    )
    (RAIZ / "banco_questoes.json").write_text(
        json.dumps(
            {
                "versao": 1,
                "total": len(banco_questoes),
                "questoes": banco_questoes,
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    print(f"Catálogo atualizado com {len(apostilas)} apostila(s) e {len(banco_questoes)} questão(ões) no banco!")


if __name__ == "__main__":
    main()
