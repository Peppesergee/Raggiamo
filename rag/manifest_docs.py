"""Trasforma target/manifest.json (prodotto da dbt) in una lista di
"documenti" testuali, uno per modello: nome, descrizione, colonne e
dipendenze (lineage). Questo modulo non fa nulla con embedding o Chroma —
si limita a leggere metadati che dbt ha già calcolato, cosi' non dobbiamo
riparsare a mano gli schema.yml sparsi nel progetto.

Riusato sia da build_index.py (Fase 4) sia, in futuro, dal tool RAG
dell'agente (Fase 5).
"""

import json
from dataclasses import dataclass
from pathlib import Path


@dataclass
class ModelDoc:
    id: str  # unique_id di dbt, es. "model.raggiamo.fct_invoice_lines"
    name: str
    text: str  # il testo da passare all'embedding
    metadata: dict  # campi semplici (str/int/bool) per il filtro in Chroma


def _dependency_label(dep_unique_id: str, manifest: dict) -> str:
    """Risolve un unique_id di dbt (es. 'source.raggiamo.chinook.album') in
    un'etichetta leggibile ('source chinook.album' oppure 'modello album').
    """
    if dep_unique_id in manifest["nodes"]:
        node = manifest["nodes"][dep_unique_id]
        return f"modello {node['name']}"
    if dep_unique_id in manifest["sources"]:
        source = manifest["sources"][dep_unique_id]
        return f"source {source['source_name']}.{source['name']}"
    return dep_unique_id


def _build_text(node: dict, manifest: dict) -> str:
    lines = [
        f"Modello: {node['name']}",
        f"Percorso: {node['path']}",
        f"Materializzazione: {node['config'].get('materialized', 'view')}",
    ]

    description = node.get("description") or "(nessuna descrizione)"
    lines.append(f"Descrizione: {description}")

    columns = node.get("columns") or {}
    if columns:
        lines.append("Colonne:")
        for col_name, col in columns.items():
            col_desc = col.get("description") or "(nessuna descrizione)"
            lines.append(f"- {col_name}: {col_desc}")

    deps = node.get("depends_on", {}).get("nodes", [])
    if deps:
        lines.append("Dipende da:")
        for dep_id in deps:
            lines.append(f"- {_dependency_label(dep_id, manifest)}")

    return "\n".join(lines)


def load_model_docs(manifest_path: Path, project_name: str) -> list[ModelDoc]:
    manifest = json.loads(manifest_path.read_text())

    docs = []
    for unique_id, node in manifest["nodes"].items():
        if node["resource_type"] != "model":
            continue
        if node["package_name"] != project_name:
            continue  # esclude modelli di eventuali package dbt esterni

        docs.append(
            ModelDoc(
                id=unique_id,
                name=node["name"],
                text=_build_text(node, manifest),
                metadata={
                    "name": node["name"],
                    "path": node["path"],
                    "materialized": node["config"].get("materialized", "view"),
                },
            )
        )
    return docs
