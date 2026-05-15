"""
Compara dos JSONs de plan de estudios UNS:
  - referencia: generado por el parser regex (web/data/)
  - candidato:  generado por el LLM

Uso:
  python -m scripts.comparar_json <referencia.json> <candidato.json>

Salida: reporte por consola + resumen final con score.
"""
import json
import sys
from pathlib import Path


# ── helpers ────────────────────────────────────────────────────────────────────

def _cargar(path: str) -> dict:
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def _materias_por_id(materias: list) -> dict:
    return {m["id"]: m for m in materias if isinstance(m, dict) and m.get("id")}


def _normalizar_str(v) -> str | None:
    if not isinstance(v, str):
        return None
    return v.strip().upper()


def _cors_ids(m: dict) -> set:
    """IDs de correlativas de una materia (acepta dict UNS o lista PlanData)."""
    cors = m.get("correlativas") or {}
    if isinstance(cors, dict):
        return set(cors.keys())
    if isinstance(cors, list):
        return {c for c in cors if isinstance(c, str)}
    return set()


# ── secciones del reporte ──────────────────────────────────────────────────────

def comparar_plan(ref: dict, cand: dict) -> list[str]:
    issues = []
    rp, cp = ref.get("plan", {}), cand.get("plan", {})
    for campo in ("carrera", "universidad", "codigo_plan"):
        rv = _normalizar_str(rp.get(campo))
        cv = _normalizar_str(cp.get(campo))
        if rv and not cv:
            issues.append(f"  plan.{campo}: FALTA en candidato (ref={rp.get(campo)!r})")
        elif rv and cv and rv != cv:
            issues.append(f"  plan.{campo}: DIFIERE  ref={rp.get(campo)!r}  cand={cp.get(campo)!r}")
    return issues


def comparar_cobertura(ref_ids: set, cand_ids: set) -> tuple[list[str], dict]:
    issues = []
    solo_ref = ref_ids - cand_ids
    solo_cand = cand_ids - ref_ids
    if solo_ref:
        issues.append(f"  Materias en referencia pero AUSENTES en candidato ({len(solo_ref)}): {sorted(solo_ref)[:10]}{'...' if len(solo_ref) > 10 else ''}")
    if solo_cand:
        issues.append(f"  Materias en candidato pero NO en referencia ({len(solo_cand)}): {sorted(solo_cand)[:10]}{'...' if len(solo_cand) > 10 else ''}")
    stats = {
        "ref_total": len(ref_ids),
        "cand_total": len(cand_ids),
        "comunes": len(ref_ids & cand_ids),
        "solo_ref": len(solo_ref),
        "solo_cand": len(solo_cand),
    }
    return issues, stats


def comparar_campos(ref_map: dict, cand_map: dict, comunes: set) -> dict:
    nombre_ok = nombre_diff = 0
    anio_ok = anio_diff = anio_falta = 0
    cors_perfectas = cors_parciales = cors_distintas = 0
    cors_detalle: list[str] = []
    req_ok = req_diff = req_solo_ref = req_solo_cand = 0
    req_detalle: list[str] = []

    for mid in sorted(comunes):
        rm = ref_map[mid]
        cm = cand_map[mid]

        # nombre
        rn = _normalizar_str(rm.get("nombre"))
        cn = _normalizar_str(cm.get("nombre"))
        if rn and cn:
            if rn == cn:
                nombre_ok += 1
            else:
                nombre_diff += 1

        # año (ref usa "año", cand puede usar "año" o "anio")
        ra = _normalizar_str(rm.get("año") or rm.get("anio"))
        ca = _normalizar_str(cm.get("año") or cm.get("anio"))
        if not ca:
            anio_falta += 1
        elif ra == ca:
            anio_ok += 1
        else:
            anio_diff += 1

        # correlativas
        rc = _cors_ids(rm)
        cc = _cors_ids(cm)
        if rc == cc:
            cors_perfectas += 1
        elif rc and cc and rc & cc:
            cors_parciales += 1
            faltantes = rc - cc
            extras = cc - rc
            msg = f"    [{mid}] parcial — faltantes={sorted(faltantes)} extras={sorted(extras)}"
            cors_detalle.append(msg)
        else:
            cors_distintas += 1
            if rc or cc:
                msg = f"    [{mid}] distintas — ref={sorted(rc)} cand={sorted(cc)}"
                cors_detalle.append(msg)

        # requisito_especial (puede ser lista o None)
        def _req_tipos(r):
            if r is None:
                return []
            if isinstance(r, list):
                return sorted(x.get("tipo", "") for x in r)
            return [r.get("tipo", "")]

        rr = rm.get("requisito_especial")
        cr = cm.get("requisito_especial")
        rr_tipos = _req_tipos(rr)
        cr_tipos = _req_tipos(cr)
        if not rr_tipos and not cr_tipos:
            req_ok += 1
        elif rr_tipos and not cr_tipos:
            req_solo_ref += 1
            req_detalle.append(f"    [{mid}] solo en ref — tipos={rr_tipos}")
        elif not rr_tipos and cr_tipos:
            req_solo_cand += 1
            req_detalle.append(f"    [{mid}] solo en cand — tipos={cr_tipos}")
        elif rr_tipos == cr_tipos:
            req_ok += 1
        else:
            req_diff += 1
            req_detalle.append(f"    [{mid}] tipos difieren — ref={rr_tipos} cand={cr_tipos}")

    return {
        "nombre_ok": nombre_ok,
        "nombre_diff": nombre_diff,
        "anio_ok": anio_ok,
        "anio_diff": anio_diff,
        "anio_falta": anio_falta,
        "cors_perfectas": cors_perfectas,
        "cors_parciales": cors_parciales,
        "cors_distintas": cors_distintas,
        "cors_detalle": cors_detalle,
        "req_ok": req_ok,
        "req_diff": req_diff,
        "req_solo_ref": req_solo_ref,
        "req_solo_cand": req_solo_cand,
        "req_detalle": req_detalle,
    }


def calcular_score(stats_cob: dict, stats_campos: dict) -> float:
    """Score 0–100 ponderado."""
    total_ref = stats_cob["ref_total"]
    comunes = stats_cob["comunes"]
    if total_ref == 0:
        return 0.0

    cobertura = comunes / total_ref                                        # 30%
    nombres = stats_campos["nombre_ok"] / max(comunes, 1)                  # 25%
    anios = stats_campos["anio_ok"] / max(comunes, 1)                      # 20%
    cors_total = comunes
    cors_ok = stats_campos["cors_perfectas"] / max(cors_total, 1)          # 25%

    score = (cobertura * 30 + nombres * 25 + anios * 20 + cors_ok * 25)
    return round(score, 1)


# ── entry point ────────────────────────────────────────────────────────────────

def main():
    if len(sys.argv) < 3:
        print("Uso: python -m scripts.comparar_json <referencia.json> <candidato.json>")
        sys.exit(1)

    ref_path, cand_path = sys.argv[1], sys.argv[2]
    ref = _cargar(ref_path)
    cand = _cargar(cand_path)

    print(f"\n{'='*60}")
    print(f"  COMPARACION DE PLANES")
    print(f"  REF : {Path(ref_path).name}")
    print(f"  CAND: {Path(cand_path).name}")
    print(f"{'='*60}")

    # ── 1. Plan ────────────────────────────────────────────────────────────────
    print("\n[1] DATOS DEL PLAN")
    plan_issues = comparar_plan(ref, cand)
    if plan_issues:
        for i in plan_issues:
            print(i)
    else:
        print("  OK — todos los campos coinciden")

    # ── 2. Cobertura de materias ───────────────────────────────────────────────
    ref_materias = ref.get("materias") or []
    cand_materias = cand.get("materias") or []
    ref_map = _materias_por_id(ref_materias)
    cand_map = _materias_por_id(cand_materias)
    comunes = set(ref_map.keys()) & set(cand_map.keys())

    print("\n[2] COBERTURA DE MATERIAS")
    cob_issues, stats_cob = comparar_cobertura(set(ref_map.keys()), set(cand_map.keys()))
    print(f"  Referencia : {stats_cob['ref_total']} materias")
    print(f"  Candidato  : {stats_cob['cand_total']} materias")
    print(f"  En común   : {stats_cob['comunes']}")
    if cob_issues:
        for i in cob_issues:
            print(i)

    # ── 3. Campos por materia (solo las comunes) ───────────────────────────────
    print(f"\n[3] CAMPOS EN MATERIAS COMUNES ({len(comunes)})")
    stats_c = comparar_campos(ref_map, cand_map, comunes)

    print(f"  Nombre  : {stats_c['nombre_ok']} iguales | {stats_c['nombre_diff']} distintos")
    print(f"  Año     : {stats_c['anio_ok']} iguales | {stats_c['anio_diff']} distintos | {stats_c['anio_falta']} faltantes")
    print(f"  Correl. : {stats_c['cors_perfectas']} perfectas | {stats_c['cors_parciales']} parciales | {stats_c['cors_distintas']} distintas")

    if stats_c["cors_detalle"]:
        print(f"\n  Detalle correlativas con diferencias (primeras 20):")
        for line in stats_c["cors_detalle"][:20]:
            print(line)
        if len(stats_c["cors_detalle"]) > 20:
            print(f"    ... y {len(stats_c['cors_detalle']) - 20} más")

    req_issues = stats_c["req_solo_ref"] + stats_c["req_solo_cand"] + stats_c["req_diff"]
    print(f"  Req.esp.: {stats_c['req_ok']} iguales | {req_issues} con diferencias", end="")
    if stats_c["req_solo_ref"]:
        print(f" ({stats_c['req_solo_ref']} solo en ref)", end="")
    if stats_c["req_solo_cand"]:
        print(f" ({stats_c['req_solo_cand']} solo en cand)", end="")
    print()
    if stats_c["req_detalle"]:
        print(f"\n  Detalle requisitos especiales:")
        for line in stats_c["req_detalle"][:20]:
            print(line)

    # ── 4. Agrupadores ─────────────────────────────────────────────────────────
    ref_agrup = len(ref.get("agrupadores") or [])
    cand_agrup = len(cand.get("agrupadores") or [])
    print(f"\n[4] AGRUPADORES")
    print(f"  Referencia: {ref_agrup} | Candidato: {cand_agrup}", end="")
    if ref_agrup != cand_agrup:
        print(f"  ← DIFIEREN (el LLM no detecta grupos, esperado)")
    else:
        print()

    # ── 5. Metadata LLM ────────────────────────────────────────────────────────
    llm_fields = {k: v for k, v in cand.items() if k.startswith("_llm")}
    if llm_fields:
        print(f"\n[5] METADATA LLM")
        for k, v in llm_fields.items():
            print(f"  {k}: {v}")

    # ── Score final ────────────────────────────────────────────────────────────
    score = calcular_score(stats_cob, stats_c)
    print(f"\n{'='*60}")
    print(f"  SCORE FINAL: {score}/100")
    if score >= 90:
        print("  Excelente — listo para usar")
    elif score >= 75:
        print("  Bueno — revisar diferencias menores")
    elif score >= 50:
        print("  Regular — revisar correlativas y materias faltantes")
    else:
        print("  Bajo — revisar extracción completa")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    main()
