import pytest
from fastapi.testclient import TestClient
from main import app
from app.scenarios.repository import ScenarioRepository
from app.engine.counterfactual_engine import CounterfactualEngine
from app.engine.deterministic_graph import DeterministicGraphEngine
from app.models.schemas import (
    ScenarioMutation,
    MutationType,
    CounterfactualResult,
    CounterfactualHypothesisImpact,
)
from app.ai.gemma_service import GemmaService

@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def scenario_repo():
    return ScenarioRepository()

@pytest.fixture
def baseline_scenario(scenario_repo):
    return scenario_repo.get_scenario("scenario-apt-solar-infiltrate")

@pytest.fixture
def engine():
    return CounterfactualEngine()


def test_baseline_immutability(baseline_scenario, engine):
    """
    Guarantees the baseline scenario object and its events list are never mutated
    during counterfactual experiment execution.
    """
    initial_event_count = len(baseline_scenario.events)
    initial_event_ids = [e.id for e in baseline_scenario.events]

    mutation = ScenarioMutation(
        mutation_type=MutationType.REMOVE_EVENT,
        target_event_id="EVT-1005"
    )

    result = engine.run_experiment(baseline_scenario, mutation)

    # Assert mutated result reflects removal
    assert result.modified_event_count == initial_event_count - 1
    assert result.baseline_event_count == initial_event_count

    # Assert original baseline object is strictly intact
    assert len(baseline_scenario.events) == initial_event_count
    assert [e.id for e in baseline_scenario.events] == initial_event_ids

    # Assert baseline graph recomputed matches original graph metrics
    graph_engine = DeterministicGraphEngine()
    g_baseline, rels = graph_engine.build_graph(baseline_scenario)
    assert g_baseline.number_of_nodes() == initial_event_count
    assert len(rels) == result.baseline_edge_count


def test_remove_event_breaks_downstream_chain(baseline_scenario, engine):
    """
    Removing critical milestone EVT-1005 (cmd.exe payload download)
    must deterministically break edges to EVT-1006 (LSASS dump) and downstream chains.
    """
    mutation = ScenarioMutation(
        mutation_type=MutationType.REMOVE_EVENT,
        target_event_id="EVT-1005"
    )

    result = engine.run_experiment(baseline_scenario, mutation)

    assert len(result.edges_removed) > 0
    removed_target_or_sources = [
        (e["source_event_id"], e["target_event_id"]) for e in result.edges_removed
    ]

    # EVT-1005 -> EVT-1006 process lineage edge must be removed
    assert ("EVT-1005", "EVT-1006") in removed_target_or_sources

    # Broken causal chains must be identified
    assert len(result.broken_causal_chains) > 0
    chain_removed_edges = [
        (c["removed_edge"]["source"], c["removed_edge"]["target"])
        for c in result.broken_causal_chains
    ]
    assert ("EVT-1005", "EVT-1006") in chain_removed_edges


def test_modify_event_field_session_continuity(baseline_scenario, engine):
    """
    Altering an observable field (e.g., extracted token) should deterministically break
    subsequent session continuity edges.
    """
    mutation = ScenarioMutation(
        mutation_type=MutationType.MODIFY_EVENT_FIELD,
        target_event_id="EVT-1007",
        field_path="extracted_token",
        new_value="tok-completely-different-random-id"
    )

    result = engine.run_experiment(baseline_scenario, mutation)

    # The event count stays the same
    assert result.baseline_event_count == result.modified_event_count
    # But token continuity edge to EVT-1008 should be severed
    assert len(result.edges_removed) > 0
    removed_pairs = [
        (e["source_event_id"], e["target_event_id"]) for e in result.edges_removed
    ]
    assert ("EVT-1007", "EVT-1008") in removed_pairs


def test_experiment_isolation(baseline_scenario, engine):
    """
    Executing multiple distinct experiments sequentially must not contaminate each other.
    """
    mut_a = ScenarioMutation(
        mutation_type=MutationType.REMOVE_EVENT,
        target_event_id="EVT-1005"
    )
    mut_b = ScenarioMutation(
        mutation_type=MutationType.REMOVE_EVENT,
        target_event_id="EVT-1008"
    )

    res_a = engine.run_experiment(baseline_scenario, mut_a)
    res_b = engine.run_experiment(baseline_scenario, mut_b)

    # Experiment IDs must be distinct
    assert res_a.experiment_id != res_b.experiment_id

    # Removed edges in res_a should not overlap with res_b's specific target
    res_a_targets = [e["target_event_id"] for e in res_a.edges_removed]
    res_b_targets = [e["target_event_id"] for e in res_b.edges_removed]

    assert "EVT-1006" in res_a_targets
    assert "EVT-1006" not in res_b_targets


def test_experiment_repeatability(baseline_scenario, engine):
    """
    The exact same mutation on the baseline scenario must produce identical deterministic diffs.
    """
    mutation = ScenarioMutation(
        mutation_type=MutationType.REMOVE_EVENT,
        target_event_id="EVT-1006"
    )

    res1 = engine.run_experiment(baseline_scenario, mutation)
    res2 = engine.run_experiment(baseline_scenario, mutation)

    assert res1.modified_event_count == res2.modified_event_count
    assert res1.baseline_edge_count == res2.baseline_edge_count
    assert res1.modified_edge_count == res2.modified_edge_count
    assert len(res1.edges_removed) == len(res2.edges_removed)
    assert len(res1.edges_added) == len(res2.edges_added)
    assert len(res1.broken_causal_chains) == len(res2.broken_causal_chains)


def test_counterfactual_hypothesis_reassessment_fallback(baseline_scenario, engine):
    """
    GemmaService fallback reassessment clearly tags interpretation_type
    as an AI/heuristic interpretation, distinguishing it from computed graph facts.
    """
    service = GemmaService()
    # Force unconfigured to test deterministic fallback
    service._client = None

    mutation = ScenarioMutation(
        mutation_type=MutationType.REMOVE_EVENT,
        target_event_id="EVT-1005"
    )
    result = engine.run_experiment(baseline_scenario, mutation)
    impact = service.reassess_counterfactual(baseline_scenario, result)

    assert isinstance(impact, CounterfactualHypothesisImpact)
    assert impact.source == "deterministic_fallback"
    assert "interpretation" in impact.interpretation_type
    assert len(impact.affected_hypotheses) > 0
    assert any(h["hypothesis_id"] == "hyp-001" for h in impact.affected_hypotheses)


def test_api_counterfactual_run(client):
    """
    Tests the API endpoint POST /api/scenarios/{id}/counterfactual/run
    """
    from unittest.mock import patch, MagicMock
    mock_service = MagicMock()
    mock_service.reassess_counterfactual.return_value = CounterfactualHypothesisImpact(
        reassessment="Test impact reassessment",
        affected_hypotheses=[{"hypothesis_id": "hyp-001", "status": "refuted"}],
        interpretation_type="ai_generated_interpretation",
        source="test_mock",
        unsupported_citations=[]
    )
    with patch("app.api.scenarios._get_gemma", return_value=mock_service):
        payload = {
            "mutation": {
                "mutation_type": "REMOVE_EVENT",
                "target_event_id": "EVT-1005"
            },
            "include_ai_reassessment": True
        }

        res = client.post("/api/scenarios/scenario-apt-solar-infiltrate/counterfactual/run", json=payload)
        assert res.status_code == 200
        data = res.json()

        assert data["scenario_id"] == "scenario-apt-solar-infiltrate"
        assert data["baseline_event_count"] == 10
        assert data["modified_event_count"] == 9
        assert len(data["edges_removed"]) >= 1
        assert data["hypothesis_impact"] is not None
        assert "interpretation" in data["hypothesis_impact"]["interpretation_type"]

