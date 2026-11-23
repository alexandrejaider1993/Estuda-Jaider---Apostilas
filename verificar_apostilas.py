#!/usr/bin/env python3
"""
Bot de verificacao automatica das apostilas interativas (interativos/*/index.html).

Regras verificadas:
  1. Nunca pode haver questao de multipla escolha com 3 alternativas (ou < 4).
     - testes e microtestes (multipla): exatamente 4 alternativas.
     - questoes[].objetiva (provas): 4 ou 5 alternativas.
     - Sem alternativas vazias ou duplicadas, e indice `correta` valido.
  2. Questoes objetivas em `D.questoes` devem estar formatadas em `q.objetiva`
     (nunca com A), B), C), D) soltas em texto dentro de `itens` ou `enunciado`),
     e o arquivo precisa conter o suporte de template (`objHTML`, `.ops.obj`, `data-obj`, `data-objr`).
  3. Embaralhamento justo (nunca todas as respostas na mesma letra):
     - `ordem()` nao pode usar o LCG viciado (`1103515245`).
     - `htmlMicro()` deve embaralhar alternativas com `ordem()`.
     - Teste estatistico real via Node.js executando a funcao `ordem()` do proprio arquivo
       (verifica que nenhuma letra concentra > 40% ou < 10% das respostas).
  4. Integridade basica:
     - JSON de `const D=` valido.
     - Sintaxe JS valida em todos os blocos <script> (via `node --check`, se disponivel).
"""

import glob
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.abspath(__file__))
HAS_NODE = shutil.which("node") is not None


def extract_D(text, path):
    m = re.search(r"const D=(\{.*?\});\r?\n", text)
    if not m:
        return None, f"Bloco `const D={{...}};` nao encontrado em {path}"
    try:
        return json.loads(m.group(1)), None
    except json.JSONDecodeError as e:
        return None, f"JSON invalido em `const D=`: {e}"


def check_js_syntax(text, path):
    errors = []
    if not HAS_NODE:
        return errors
    scripts = re.findall(r"<script[^>]*>(.*?)</script>", text, re.S)
    for idx, sc in enumerate(scripts):
        if not sc.strip():
            continue
        fd, fn = tempfile.mkstemp(suffix=".js")
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as f:
                f.write(sc)
            r = subprocess.run(["node", "--check", fn], capture_output=True, text=True)
            if r.returncode != 0:
                errors.append(f"Erro de sintaxe JS no <script>[{idx}]: {r.stderr.strip()}")
        finally:
            if os.path.exists(fn):
                os.remove(fn)
    return errors


def check_shuffle_distribution(text, path):
    errors = []
    m = re.search(r"((?:const __SAL=[^;]+;)?function ordem\([^\n]+)", text)
    if not m:
        return ["Funcao `ordem()` nao encontrada no arquivo."]
    ordem_line = m.group(1)
    if "1103515245" in ordem_line:
        errors.append("Funcao `ordem()` ainda usa LCG viciado (1103515245) que concentra respostas na letra D.")
        return errors

    if not HAS_NODE:
        return errors

    probe = (
        ordem_line
        + "\n"
        + "for (const sal of ['r0', '0']) {\n"
        + "  const dist = [0, 0, 0, 0];\n"
        + "  for (let k = 1; k <= 200; k++) dist[ordem('t' + k, 4, sal).indexOf(0)]++;\n"
        + "  console.log(sal + ':' + dist.join(','));\n"
        + "}\n"
    )
    r = subprocess.run(["node", "-e", probe], capture_output=True, text=True)
    if r.returncode != 0:
        errors.append(f"Falha ao executar `ordem()` no Node: {r.stderr.strip()}")
        return errors

    for line in r.stdout.strip().splitlines():
        sal, counts_s = line.split(":")
        counts = [int(x) for x in counts_s.split(",")]
        total = sum(counts)
        for idx, c in enumerate(counts):
            pct = c / total
            if pct > 0.40 or pct < 0.10:
                letter = "ABCD"[idx]
                errors.append(
                    f"Embaralhamento viciado em `ordem()` (sal='{sal}'): "
                    f"letra {letter} recebeu {c}/{total} ({pct:.0%}) -> distribuicao {counts}"
                )
    return errors


def check_file(path):
    rel = os.path.relpath(path, ROOT)
    errors = []
    with open(path, "r", encoding="utf-8") as f:
        text = f.read()

    D, err = extract_D(text, rel)
    if err:
        return [err], {}

    # 1. Testes (checagem)
    blocos_ids = {b["id"] for b in D.get("blocos", [])}
    for t in D.get("testes", []):
        tid = t.get("id", "?")
        alts = t.get("alternativas")
        cor = t.get("correta")
        if not isinstance(alts, list) or len(alts) != 4:
            errors.append(f"[teste {tid}] Deve ter 4 alternativas (encontrado: {len(alts) if isinstance(alts, list) else alts}).")
        else:
            if any(not str(a).strip() for a in alts):
                errors.append(f"[teste {tid}] Contem alternativa vazia.")
            if len({str(a).strip().lower() for a in alts}) != len(alts):
                errors.append(f"[teste {tid}] Contem alternativas duplicadas.")
            if not isinstance(cor, int) or not (0 <= cor < len(alts)):
                errors.append(f"[teste {tid}] Indice `correta` invalido: {cor}.")
        if t.get("bloco") and t["bloco"] not in blocos_ids:
            errors.append(f"[teste {tid}] Bloco `{t['bloco']}` nao existe em D.blocos.")

    # 2. Microtestes
    questoes_ids = {q["id"] for q in D.get("questoes", [])}
    for m in D.get("microtestes", []):
        mid = m.get("id", "?")
        if m.get("tipo") == "multipla":
            alts = m.get("alternativas")
            cor = m.get("correta")
            if not isinstance(alts, list) or len(alts) != 4:
                errors.append(f"[microteste {mid}] Multipla escolha deve ter 4 alternativas (encontrado: {len(alts) if isinstance(alts, list) else alts}).")
            else:
                if any(not str(a).strip() for a in alts):
                    errors.append(f"[microteste {mid}] Contem alternativa vazia.")
                if len({str(a).strip().lower() for a in alts}) != len(alts):
                    errors.append(f"[microteste {mid}] Contem alternativas duplicadas.")
                if not isinstance(cor, int) or not (0 <= cor < len(alts)):
                    errors.append(f"[microteste {mid}] Indice `correta` invalido: {cor}.")
        if m.get("questao") and m["questao"] not in questoes_ids:
            errors.append(f"[microteste {mid}] Questao `{m['questao']}` nao existe em D.questoes.")

    # 2b. Engenharia Reversa (D.er)
    for qid, er in (D.get("er") or {}).items():
        for fi, fund in enumerate(er.get("fund") or []):
            for ti, tp in enumerate(fund.get("testes") or []):
                if isinstance(tp, list) and tp and tp[0] == "mc":
                    alts = tp[2] if len(tp) > 2 else []
                    if not isinstance(alts, list) or len(alts) < 4:
                        errors.append(
                            f"[er {qid} fund[{fi}] teste[{ti}]] Multipla escolha deve ter no minimo 4 alternativas "
                            f"(encontrado: {len(alts) if isinstance(alts, list) else alts})."
                        )
                    else:
                        if any(not str(a).strip() for a in alts):
                            errors.append(f"[er {qid} fund[{fi}] teste[{ti}]] Contem alternativa vazia.")
                        if len({str(a).strip().lower() for a in alts}) != len(alts):
                            errors.append(f"[er {qid} fund[{fi}] teste[{ti}]] Contem alternativas duplicadas.")
                        if len(tp) >= 5 and isinstance(tp[4], list) and len(tp[4]) != len(alts) - 1:
                            errors.append(f"[er {qid} fund[{fi}] teste[{ti}]] Numero de comentarios de erradas ({len(tp[4])}) difere de {len(alts) - 1}.")
        for ci, c in enumerate(er.get("checagem") or []):
            if not isinstance(c, str) or not c.strip():
                errors.append(
                    f"[er {qid} checagem[{ci}]] Deve ser uma pergunta em texto simples (encontrado: {type(c).__name__})."
                )

    # 3. Questoes originais (objetivas vs dissertativas)
    has_any_objetiva = False
    for q in D.get("questoes", []):
        qid = q.get("id", "?")
        itens = q.get("itens") or []
        enun = q.get("enunciado") or ""
        # Detecta alternativas A), B), C) soltas em texto
        soltas_itens = [it for it in itens if re.match(r"^\s*[A-E]\)\s+", str(it))]
        soltas_enun = re.findall(r"(?:^|\n)\s*[A-E]\)\s+", enun)
        if soltas_itens or soltas_enun:
            errors.append(
                f"[questao {qid}] Alternativas A-E encontradas como texto solto em `itens`/`enunciado` "
                f"em vez de formatadas em `q.objetiva`."
            )
        if "objetiva" in q and q["objetiva"] is not None:
            has_any_objetiva = True
            obj = q["objetiva"]
            alts = obj.get("alts")
            cor = obj.get("correta")
            if not isinstance(alts, list) or len(alts) not in (4, 5):
                errors.append(f"[questao {qid}] `objetiva.alts` deve ter 4 ou 5 alternativas (encontrado: {len(alts) if isinstance(alts, list) else alts}).")
            else:
                if any(not str(a).strip() for a in alts):
                    errors.append(f"[questao {qid}] `objetiva.alts` contem alternativa vazia.")
                if not isinstance(cor, int) or not (0 <= cor < len(alts)):
                    errors.append(f"[questao {qid}] `objetiva.correta` invalido: {cor}.")

    # 4. Template checks (objetiva + shuffle em htmlMicro)
    js_start = text.find("<script>")
    js_part = text[js_start:] if js_start != -1 else text
    if has_any_objetiva:
        for req in ("function objHTML(", "data-obj=", "data-objr=", ".ops.obj"):
            if req not in text:
                errors.append(f"Template sem suporte completo a questoes objetivas (faltando `{req}`).")

    if "m.alternativas.map((a,i)=>[String(i),a])" in js_part:
        errors.append("`htmlMicro()` nao embaralha alternativas (todas as respostas certas cairiam na letra A).")

    # 5. Shuffle statistical test & JS syntax check
    errors.extend(check_shuffle_distribution(text, rel))
    errors.extend(check_js_syntax(text, rel))

    stats = {
        "testes": len(D.get("testes", [])),
        "microtestes_multipla": sum(1 for m in D.get("microtestes", []) if m.get("tipo") == "multipla"),
        "questoes_objetivas": sum(1 for q in D.get("questoes", []) if q.get("objetiva")),
        "questoes_dissertativas": sum(1 for q in D.get("questoes", []) if not q.get("objetiva")),
    }
    return errors, stats


def main():
    pattern = os.path.join(ROOT, "interativos", "*", "index.html")
    files = sorted(glob.glob(pattern))
    if not files:
        print("Nenhuma apostila encontrada em interativos/*/index.html")
        return 1

    print(f"Verificando {len(files)} apostila(s)... (Node.js: {'ativo' if HAS_NODE else 'indisponivel'})\n")
    total_errors = 0

    for path in files:
        rel = os.path.relpath(path, ROOT)
        errors, stats = check_file(path)
        if errors:
            total_errors += len(errors)
            print(f"[FALHA] {rel} ({len(errors)} erro(s))")
            for e in errors:
                print(f"  - {e}")
        else:
            print(
                f"[OK]    {rel} | "
                f"testes={stats['testes']}, "
                f"micro(MC)={stats['microtestes_multipla']}, "
                f"objetivas={stats['questoes_objetivas']}, "
                f"dissertativas={stats['questoes_dissertativas']}"
            )

    print()
    if total_errors:
        print(f"RESULTADO: {total_errors} erro(s) encontrado(s). Corrija antes de publicar.")
        return 1
    print("RESULTADO: Tudo aprovado! Nenhum erro encontrado.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
