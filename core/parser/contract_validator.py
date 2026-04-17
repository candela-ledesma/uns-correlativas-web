from dataclasses import dataclass
from typing import Any

VALID_REQUISITO_STATES = {"cursada", "aprobada"}
VALID_CATEGORIAS = {"normal", "optativa"}


@dataclass(frozen=True)
class ContractIssue:
    severity: str
    path: str
    message: str


@dataclass(frozen=True)
class ContractValidationResult:
    errors: list[ContractIssue]
    warnings: list[ContractIssue]

    @property
    def is_valid(self) -> bool:
        return len(self.errors) == 0


def _is_record(value: Any) -> bool:
    return isinstance(value, dict)


def _add_issue(issues: list[ContractIssue], severity: str, path: str, message: str) -> None:
    issues.append(ContractIssue(severity=severity, path=path, message=message))


def _is_non_empty_string(value: Any) -> bool:
    return isinstance(value, str) and value.strip() != ""


def validate_plan_contract(data: Any) -> ContractValidationResult:
    errors: list[ContractIssue] = []
    warnings: list[ContractIssue] = []

    if not _is_record(data):
        _add_issue(errors, "error", "root", "El JSON raiz debe ser un objeto")
        return ContractValidationResult(errors=errors, warnings=warnings)

    plan = data.get("plan")
    materias = data.get("materias")
    agrupadores = data.get("agrupadores")

    if not _is_record(plan):
        _add_issue(errors, "error", "plan", "Debe existir como objeto")
    else:
        for key in ("carrera", "universidad", "codigo_plan"):
            if not _is_non_empty_string(plan.get(key)):
                _add_issue(errors, "error", f"plan.{key}", "Debe ser string no vacio")

    if not isinstance(materias, list):
        _add_issue(errors, "error", "materias", "Debe existir como array")
        materias = []

    if not isinstance(agrupadores, list):
        _add_issue(errors, "error", "agrupadores", "Debe existir como array")
        agrupadores = []

    materia_ids: set[str] = set()
    agrupador_ids: set[str] = set()
    agrupador_options: dict[str, set[str]] = {}

    for index, agrupador in enumerate(agrupadores):
        path = f"agrupadores[{index}]"
        if not _is_record(agrupador):
            _add_issue(errors, "error", path, "Debe ser un objeto")
            continue

        agrupador_id = agrupador.get("id")
        if not _is_non_empty_string(agrupador_id):
            _add_issue(errors, "error", f"{path}.id", "Debe ser string no vacio")
            continue

        if agrupador_id in agrupador_ids:
            _add_issue(errors, "error", f"{path}.id", f"ID duplicado: {agrupador_id}")
            continue

        agrupador_ids.add(agrupador_id)

        if not _is_non_empty_string(agrupador.get("nombre")):
            _add_issue(errors, "error", f"{path}.nombre", "Debe ser string no vacio")

        if not _is_non_empty_string(agrupador.get("tipo")):
            _add_issue(errors, "error", f"{path}.tipo", "Debe ser string no vacio")

        opciones = agrupador.get("opciones")
        if not isinstance(opciones, list):
            _add_issue(errors, "error", f"{path}.opciones", "Debe ser un array")
            continue

        opciones_set: set[str] = set()
        for option_index, opcion in enumerate(opciones):
            option_path = f"{path}.opciones[{option_index}]"
            if not _is_non_empty_string(opcion):
                _add_issue(errors, "error", option_path, "Debe ser string no vacio")
                continue

            if opcion in opciones_set:
                _add_issue(warnings, "warning", option_path, f"Opcion repetida: {opcion}")
            opciones_set.add(opcion)

        agrupador_options[agrupador_id] = opciones_set

    for index, materia in enumerate(materias):
        path = f"materias[{index}]"

        if not _is_record(materia):
            _add_issue(errors, "error", path, "Debe ser un objeto")
            continue

        materia_id = materia.get("id")
        if not _is_non_empty_string(materia_id):
            _add_issue(errors, "error", f"{path}.id", "Debe ser string no vacio")
            continue

        if materia_id in materia_ids:
            _add_issue(errors, "error", f"{path}.id", f"ID duplicado: {materia_id}")
            continue

        materia_ids.add(materia_id)

        required_string_fields = [
            "nombre",
            "año",
            "cuatrimestre",
            "tipo",
        ]

        for field in required_string_fields:
            if not _is_non_empty_string(materia.get(field)):
                _add_issue(errors, "error", f"{path}.{field}", "Debe ser string no vacio")

        horas = materia.get("horas")
        if not isinstance(horas, str):
            _add_issue(errors, "error", f"{path}.horas", "Debe ser string")

        categoria = materia.get("categoria")
        if categoria not in VALID_CATEGORIAS:
            _add_issue(
                errors,
                "error",
                f"{path}.categoria",
                "Debe ser 'normal' u 'optativa'",
            )

        grupo_opcion = materia.get("grupo_opcion")
        if grupo_opcion is not None and not _is_non_empty_string(grupo_opcion):
            _add_issue(errors, "error", f"{path}.grupo_opcion", "Debe ser string o null")

        subtipo = materia.get("subtipo")
        if subtipo is not None and not isinstance(subtipo, str):
            _add_issue(errors, "error", f"{path}.subtipo", "Debe ser string o null")

        correlativas = materia.get("correlativas")
        if not _is_record(correlativas):
            _add_issue(errors, "error", f"{path}.correlativas", "Debe ser un objeto")
            continue

        for correlativa_id, requisito in correlativas.items():
            cor_path = f"{path}.correlativas.{correlativa_id}"

            if not _is_non_empty_string(correlativa_id):
                _add_issue(errors, "error", cor_path, "La clave debe ser string no vacio")
                continue

            if not _is_record(requisito):
                _add_issue(errors, "error", cor_path, "Debe ser un objeto")
                continue

            for req_key in ("para_cursar", "para_rendir"):
                req_value = requisito.get(req_key)
                req_path = f"{cor_path}.{req_key}"
                if req_value is None:
                    continue
                if req_value not in VALID_REQUISITO_STATES:
                    _add_issue(
                        errors,
                        "error",
                        req_path,
                        "Debe ser 'cursada', 'aprobada' o null",
                    )

    for index, materia in enumerate(materias):
        if not _is_record(materia):
            continue
        materia_id = materia.get("id")
        if not isinstance(materia_id, str):
            continue

        grupo_opcion = materia.get("grupo_opcion")
        if isinstance(grupo_opcion, str):
            if grupo_opcion not in agrupador_ids:
                _add_issue(
                    errors,
                    "error",
                    f"materias[{index}].grupo_opcion",
                    f"Agrupador inexistente: {grupo_opcion}",
                )
            else:
                opciones = agrupador_options.get(grupo_opcion, set())
                if materia_id not in opciones:
                    _add_issue(
                        warnings,
                        "warning",
                        f"materias[{index}].grupo_opcion",
                        "La materia no esta incluida en opciones del agrupador",
                    )

        correlativas = materia.get("correlativas")
        if not _is_record(correlativas):
            continue

        for correlativa_id in correlativas.keys():
            if correlativa_id not in materia_ids and correlativa_id not in agrupador_ids:
                _add_issue(
                    warnings,
                    "warning",
                    f"materias[{index}].correlativas.{correlativa_id}",
                    "Referencia a correlativa inexistente",
                )

    for agrupador_index, agrupador in enumerate(agrupadores):
        if not _is_record(agrupador):
            continue
        agrupador_id = agrupador.get("id")
        if not isinstance(agrupador_id, str):
            continue

        for option_id in agrupador_options.get(agrupador_id, set()):
            if option_id not in materia_ids:
                _add_issue(
                    warnings,
                    "warning",
                    f"agrupadores[{agrupador_index}].opciones",
                    f"Opcion sin materia asociada: {option_id}",
                )

    return ContractValidationResult(errors=errors, warnings=warnings)


def format_contract_issues(issues: list[ContractIssue]) -> str:
    if not issues:
        return "Sin issues"

    lines = [f"{issue.severity.upper()} {issue.path}: {issue.message}" for issue in issues]
    return "\n".join(lines)
