import pytest
from fastapi.testclient import TestClient
from main import app
from app.scenarios.repository import ScenarioRepository
from app.audit.evaluation_engine import EvaluationEngine
from app.ai.gemma_service import GemmaService
from app.models.schemas import (
    CompetingHypothesesResponse,
    Hypothesis,
    HypothesisStatus,
    CounterfactualResult,
    ScenarioMutation,
    MutationType,
    FindingSeverity,
    MetricType,
)

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
    return EvaluationEngine()


def test_ground_truth_isolation(baseline_scenario):
    """
    Guarantees ground truth is strictly isolated from LLM generation context
    and only accessed during separate evaluation benchmark stage.
    """
    gemma_service = GemmaService()
    prompt = gemma_service._build_hypothesis_prompt(baseline_scenario)

    # Prompt must NOT contain ground-truth secrets
    assert "UNC-4192" not in prompt
    assert "Phishing email with malicious attachment on DEV-STATION-42" not in prompt
    assert "valid_explanations" not in prompt
    assert "invalid_explanations" not in prompt


def test_invalid_evidence_citations_flagged_as_critical(baseline_scenario, engine):
    """
    Citing non-existent event IDs must reduce citation_validity_ratio and produce CRITICAL findings.
    """
    hallucinated_hypothesis = Hypothesis(
        id="hyp-hallucinated",
        title="Fabricated Attack Vector",
        description="Exploited non-existent vulnerability.",
        supporting_event_ids=["EVT-1005", "EVT-9999"], # EVT-9999 does not exist
        contradictory_event_ids=["EVT-8888"],          # EVT-8888 does not exist
        unsupported_event_ids=[],
        assumptions=[],
        unresolved_questions=[],
        investigation_status=HypothesisStatus.SUPPORTED,
        support_assessment="No real basis.",
        recommended_steps=[],
        alternative_explanations=[]
    )

    hyp_resp = CompetingHypothesesResponse(
        scenario_id=baseline_scenario.id,
        source="test",
        hypotheses=[hallucinated_hypothesis],
        audit_flags=[]
    )

    scorecard = engine.evaluate(baseline_scenario, hyp_resp)

    assert scorecard.metrics.citation_validity_ratio < 1.0
    assert scorecard.audit_status == "CRITICAL_FAILURES"
    critical_findings = [f for f in scorecard.findings if f.severity == FindingSeverity.CRITICAL]
    assert len(critical_findings) >= 1
    assert any("EVT-9999" in str(f.cited_references) or "EVT-9999" in f.message for f in critical_findings)


def test_unsupported_claims_detection(baseline_scenario, engine):
    """
    Hypotheses claiming 'supported' status with zero supporting evidence must be flagged.
    """
    unsupported_hypothesis = Hypothesis(
        id="hyp-unsupported",
        title="Unsubstantiated Hypothesis",
        description="Claimed without evidence.",
        supporting_event_ids=[], # 0 supporting events!
        contradictory_event_ids=[],
        unsupported_event_ids=[],
        assumptions=["Attacker bypassed all security controls invisibly"],
        unresolved_questions=[],
        investigation_status=HypothesisStatus.SUPPORTED,
        support_assessment="Intuition without logs.",
        recommended_steps=[],
        alternative_explanations=[]
    )

    hyp_resp = CompetingHypothesesResponse(
        scenario_id=baseline_scenario.id,
        source="test",
        hypotheses=[unsupported_hypothesis],
        audit_flags=[]
    )

    scorecard = engine.evaluate(baseline_scenario, hyp_resp)

    assert scorecard.metrics.unsupported_claim_count >= 1
    assert any(f.category == "Unsupported Claims" for f in scorecard.findings)


def test_uncertainty_and_contradiction_calibration(baseline_scenario, engine):
    """
    Overconfident hypotheses that assert 'supported' while ignoring contradictions
    and failing to articulate assumptions must be penalized.
    """
    overconfident_hypothesis = Hypothesis(
        id="hyp-overconfident",
        title="Overconfident Claim",
        description="Claimed with total certainty.",
        supporting_event_ids=["EVT-1005"],
        contradictory_event_ids=[],
        unsupported_event_ids=[],
        assumptions=[], # No assumptions stated
        unresolved_questions=[], # No questions stated
        investigation_status=HypothesisStatus.SUPPORTED,
        support_assessment="100% absolute proof.",
        recommended_steps=[],
        alternative_explanations=[]
    )

    hyp_resp = CompetingHypothesesResponse(
        scenario_id=baseline_scenario.id,
        source="test",
        hypotheses=[overconfident_hypothesis],
        audit_flags=[]
    )

    scorecard = engine.evaluate(baseline_scenario, hyp_resp)

    assert any("Overconfidence warning" in f.message for f in scorecard.findings)
    assert scorecard.metrics.contradiction_awareness_score < 1.0


def test_counterfactual_consistency_audit(baseline_scenario, engine):
    """
    Audits counterfactual experiment consistency between reported diffs and graph recomputations.
    """
    # Create a valid counterfactual result
    cf_res = CounterfactualResult(
        experiment_id="exp-audit-01",
        scenario_id=baseline_scenario.id,
        mutation=ScenarioMutation(
            mutation_type=MutationType.REMOVE_EVENT,
            target_event_id="EVT-1005"
        ),
        baseline_event_count=10,
        modified_event_count=9,
        baseline_edge_count=9,
        modified_edge_count=8,
        edges_removed=[{"source_event_id": "EVT-1005", "target_event_id": "EVT-1006"}],
        edges_added=[],
        broken_causal_chains=[],
        hypothesis_impact=None
    )

    scorecard = engine.evaluate(
        baseline_scenario,
        hypotheses_response=None,
        counterfactual_results=[cf_res]
    )

    assert scorecard.metrics.counterfactual_consistency_score == 1.0
    assert scorecard.counterfactuals_evaluated_count == 1


def test_evaluation_repeatability_and_determinism(baseline_scenario, engine):
    """
    Running evaluation twice on identical inputs must yield identical metrics.
    """
    service = GemmaService()
    service._client = None # Hermetic deterministic fallback
    hypotheses_resp = service.generate_hypotheses(baseline_scenario)

    score1 = engine.evaluate(baseline_scenario, hypotheses_resp)
    score2 = engine.evaluate(baseline_scenario, hypotheses_resp)

    assert score1.metrics.overall_audit_score == score2.metrics.overall_audit_score
    assert score1.metrics.citation_validity_ratio == score2.metrics.citation_validity_ratio
    assert score1.metrics.ground_truth_alignment_score == score2.metrics.ground_truth_alignment_score
    assert score1.audit_status == score2.audit_status
    assert len(score1.findings) == len(score2.findings)


def test_api_scorecard_endpoints(client):
    """
    Tests GET /api/scenarios/{id}/scorecard and POST /api/scenarios/{id}/scorecard/evaluate
    """
    from unittest.mock import patch, MagicMock
    from app.models.schemas import CompetingHypothesesResponse, Hypothesis
    mock_service = MagicMock()
    mock_service.generate_hypotheses.return_value = CompetingHypothesesResponse(
        scenario_id="scenario-apt-solar-infiltrate",
        source="deterministic_fallback",
        hypotheses=[
            Hypothesis(
                id="hyp-001",
                title="Token Theft",
                description="Session hijacking.",
                supporting_event_ids=["EVT-1005", "EVT-1006"],
                contradictory_event_ids=["EVT-1004"],
                unsupported_event_ids=[],
                assumptions=["Token was valid"],
                unresolved_questions=[],
                investigation_status=HypothesisStatus.SUPPORTED,
                support_assessment="Supported.",
                recommended_steps=[],
                alternative_explanations=[]
            )
        ],
        audit_flags=[]
    )
    with patch("app.api.scenarios._get_gemma", return_value=mock_service):

        # Test GET
        res_get = client.get("/api/scenarios/scenario-apt-solar-infiltrate/scorecard")
        assert res_get.status_code == 200
        data_get = res_get.json()

        assert data_get["scenario_id"] == "scenario-apt-solar-infiltrate"
        assert "metrics" in data_get
        assert data_get["metrics"]["citation_validity_ratio"] == 1.0
        assert "findings" in data_get
        assert "metric_provenance" in data_get

        # Test POST
        payload = {
            "hypotheses": None,
            "counterfactuals": []
        }
        res_post = client.post("/api/scenarios/scenario-apt-solar-infiltrate/scorecard/evaluate", json=payload)
        assert res_post.status_code == 200
        data_post = res_post.json()
        assert data_post["scenario_id"] == "scenario-apt-solar-infiltrate"

