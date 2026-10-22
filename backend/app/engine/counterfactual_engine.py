"""
CounterfactualEngine — Phase 6
Runs isolated mutations against a cloned baseline scenario and recomputes
the deterministic causal graph. Never mutates the original scenario object.
"""
import copy
import uuid
import logging
from typing import Any, Dict, List, Optional

from app.engine.deterministic_graph import DeterministicGraphEngine
from app.models.schemas import (
    MutationType,
    ScenarioMutation,
    CounterfactualResult,
    Scenario,
)

logger = logging.getLogger("CausalOps.CounterfactualEngine")

_graph_engine = DeterministicGraphEngine()


class CounterfactualEngine:
    """
    Applies a single mutation to an isolated copy of the scenario and returns
    a fully deterministic before-and-after comparison.

    Guarantees:
    - The original Scenario object is NEVER mutated.
    - The same mutation input always produces the same result (pure function).
    - Graph computation uses the same rules as the Phase-2 engine.
    """

    def run_experiment(
        self, scenario: Scenario, mutation: ScenarioMutation
    ) -> CounterfactualResult:
        experiment_id = f"exp-{uuid.uuid4().hex[:8]}"

        # ── 1. Build baseline graph (from original, unmodified scenario) ──────
        baseline_G, baseline_rels = _graph_engine.build_graph(scenario)
        baseline_edges = {
            (r.source_event_id, r.target_event_id): {
                "id": r.id,
                "relationship_type": r.relationship_type,
                "rule_name": r.rule_name,
                "explanation": r.explanation,
                "confidence": r.confidence,
            }
            for r in baseline_rels
        }

        # ── 2. Clone and mutate ───────────────────────────────────────────────
        mutated_scenario = self._apply_mutation(scenario, mutation)

        # ── 3. Build modified graph ───────────────────────────────────────────
        modified_G, modified_rels = _graph_engine.build_graph(mutated_scenario)
        modified_edges = {
            (r.source_event_id, r.target_event_id): {
                "id": r.id,
                "relationship_type": r.relationship_type,
                "rule_name": r.rule_name,
                "explanation": r.explanation,
                "confidence": r.confidence,
            }
            for r in modified_rels
        }

        # ── 4. Compute symmetric diff ─────────────────────────────────────────
        baseline_edge_keys = set(baseline_edges.keys())
        modified_edge_keys = set(modified_edges.keys())

        removed_edge_keys = baseline_edge_keys - modified_edge_keys
        added_edge_keys = modified_edge_keys - baseline_edge_keys

        edges_removed = []
        for src, tgt in removed_edge_keys:
            entry = dict(baseline_edges[(src, tgt)])
            entry["source_event_id"] = src
            entry["target_event_id"] = tgt
            edges_removed.append(entry)

        edges_added = []
        for src, tgt in added_edge_keys:
            entry = dict(modified_edges[(src, tgt)])
            entry["source_event_id"] = src
            entry["target_event_id"] = tgt
            edges_added.append(entry)

        # ── 5. Identify broken causal chains ─────────────────────────────────
        broken_chains = self._compute_broken_chains(
            baseline_G, modified_G, removed_edge_keys
        )

        # ── 6. Build serialisable edge lists for display ─────────────────────
        baseline_edge_list = [
            {"source": s, "target": t, **v} for (s, t), v in baseline_edges.items()
        ]
        modified_edge_list = [
            {"source": s, "target": t, **v} for (s, t), v in modified_edges.items()
        ]

        # ── 7. Sanity-check: original scenario unchanged ──────────────────────
        original_event_ids = {e.id for e in scenario.events}
        assert original_event_ids == {e.id for e in scenario.events}, (
            "Baseline scenario was mutated — this is a critical engine bug."
        )

        return CounterfactualResult(
            experiment_id=experiment_id,
            scenario_id=scenario.id,
            mutation=mutation,
            baseline_event_count=len(scenario.events),
            modified_event_count=len(mutated_scenario.events),
            baseline_edge_count=len(baseline_rels),
            modified_edge_count=len(modified_rels),
            baseline_edges=baseline_edge_list,
            modified_edges=modified_edge_list,
            edges_removed=edges_removed,
            edges_added=edges_added,
            broken_causal_chains=broken_chains,
            hypothesis_impact=None,  # Populated by GemmaService if requested
        )

    # ─────────────────────────────────────────────────────────────────────────
    # Private helpers
    # ─────────────────────────────────────────────────────────────────────────

    def _apply_mutation(self, scenario: Scenario, mutation: ScenarioMutation) -> Scenario:
        """
        Returns a deep-copied Scenario with the mutation applied.
        The original scenario is never modified.
        """
        cloned = scenario.model_copy(deep=True)

        if mutation.mutation_type == MutationType.REMOVE_EVENT:
            before_count = len(cloned.events)
            cloned.events = [e for e in cloned.events if e.id != mutation.target_event_id]
            if len(cloned.events) == before_count:
                logger.warning(
                    "REMOVE_EVENT: event '%s' not found in scenario '%s'.",
                    mutation.target_event_id,
                    scenario.id,
                )

        elif mutation.mutation_type == MutationType.MODIFY_EVENT_FIELD:
            if not mutation.field_path or mutation.new_value is None:
                raise ValueError(
                    "MODIFY_EVENT_FIELD requires both field_path and new_value."
                )
            target_found = False
            for evt in cloned.events:
                if evt.id == mutation.target_event_id:
                    target_found = True
                    # Support simple top-level fields only for Phase 6
                    # e.g. field_path = "session_id"
                    if hasattr(evt, mutation.field_path):
                        object.__setattr__(evt, mutation.field_path, mutation.new_value)
                    elif mutation.field_path in evt.observable_data:
                        evt.observable_data[mutation.field_path] = mutation.new_value
                    else:
                        # Try observable_data as a catch-all
                        evt.observable_data[mutation.field_path] = mutation.new_value
                    break
            if not target_found:
                logger.warning(
                    "MODIFY_EVENT_FIELD: event '%s' not found in scenario '%s'.",
                    mutation.target_event_id,
                    scenario.id,
                )
        else:
            raise ValueError(f"Unknown mutation_type: {mutation.mutation_type}")

        return cloned

    def _compute_broken_chains(
        self,
        baseline_G,
        modified_G,
        removed_edge_keys,
    ) -> List[Dict[str, Any]]:
        """
        For each removed edge (src → tgt), find all baseline paths that
        contained it and report them as broken chains.
        """
        import networkx as nx

        broken: List[Dict[str, Any]] = []

        # Root candidates in baseline (nodes with no incoming edges)
        root_candidates = [n for n, d in baseline_G.in_degree() if d == 0]

        for src, tgt in removed_edge_keys:
            if src not in baseline_G or tgt not in baseline_G:
                continue

            affected_paths = []
            for root in root_candidates:
                if root == src:
                    continue
                try:
                    for path in nx.all_simple_paths(baseline_G, source=root, target=src, cutoff=8):
                        full_path = path + [tgt]
                        affected_paths.append(full_path)
                except (nx.NetworkXNoPath, nx.NodeNotFound):
                    continue

            # Also paths that start FROM tgt (i.e., what downstream loses)
            downstream_nodes = list(nx.descendants(baseline_G, tgt)) if tgt in baseline_G else []

            broken.append({
                "removed_edge": {"source": src, "target": tgt},
                "affected_upstream_paths": affected_paths[:3],  # cap for readability
                "downstream_events_disconnected": downstream_nodes[:10],
                "explanation": (
                    f"Removing the edge {src} → {tgt} severs causal continuity: "
                    f"{len(downstream_nodes)} downstream event(s) can no longer be "
                    f"traced back to upstream root causes through this path."
                ),
            })

        return broken
