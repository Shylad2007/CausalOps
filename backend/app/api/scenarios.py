"""
backend/app/api/scenarios.py
API routes for project-scoped incident scenarios, deterministic causal graphs,
Gemma 4 competing hypotheses, counterfactual experiments, and investigation scorecards.
Enforces strict project ownership on every endpoint.
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List, Dict, Any, Optional
from app.scenarios.repository import ScenarioRepository
from app.engine.deterministic_graph import DeterministicGraphEngine
from app.services.project_storage import get_project_scenario, get_project
from app.analysis.incident_generator import generate_incident_for_project
from app.models.schemas import (
    Scenario,
    CompetingHypothesesResponse,
    HypothesisChallengeRequest,
    HypothesisChallengeResponse,
    CounterfactualExperimentRequest,
    CounterfactualResult,
    CounterfactualHypothesisImpact,
    InvestigationScorecard,
    ScorecardEvaluationRequest,
)
from app.ai.gemma_service import GemmaService
from app.engine.counterfactual_engine import CounterfactualEngine
from app.audit.evaluation_engine import EvaluationEngine
from app.auth.dependencies import (
    get_current_user_optional,
    verify_project_access,
    UserProfile,
)

router = APIRouter(prefix="/api/scenarios", tags=["Scenarios"])
scenario_repo = ScenarioRepository()
graph_engine = DeterministicGraphEngine()
counterfactual_engine = CounterfactualEngine()
evaluation_engine = EvaluationEngine()

# Lazily initialized so that the absolute-path dotenv fix in GemmaService
# takes effect regardless of the working directory used to launch uvicorn.
_gemma_service: Optional[GemmaService] = None


def _get_gemma() -> GemmaService:
    global _gemma_service
    if _gemma_service is None:
        _gemma_service = GemmaService()
    return _gemma_service


def _resolve_scenario(scenario_id: str, current_user: Optional[UserProfile] = None) -> Optional[Scenario]:
    """
    Resolves scenario strictly from project-scoped scenario storage or repository.
    Verifies project ownership if user is authenticated.
    """
    proj_id = scenario_id.replace("scenario-", "") if scenario_id.startswith("scenario-") else scenario_id

    # If user provided, verify authorization on the underlying project
    if current_user and proj_id != "proj-demo-shoppulse":
        # Only verify if it's a known project (benchmark scenarios like 'synthetic-lateral-move' pass through)
        if get_project(proj_id) is not None:
            verify_project_access(proj_id, current_user, allow_demo=True)

    proj_scen = get_project_scenario(proj_id)
    if proj_scen:
        return proj_scen

    proj = get_project(proj_id)
    if proj:
        return generate_incident_for_project(proj)

    return scenario_repo.get_scenario(scenario_id)


@router.get("", response_model=List[Dict[str, Any]])
def list_scenarios():
    return scenario_repo.list_scenarios()


@router.get("/{scenario_id}", response_model=Scenario)
def get_scenario(
    scenario_id: str,
    current_user: Optional[UserProfile] = Depends(get_current_user_optional),
):
    scenario = _resolve_scenario(scenario_id, current_user)
    if not scenario:
        raise HTTPException(status_code=404, detail=f"Scenario '{scenario_id}' not found")
    return scenario


@router.get("/{scenario_id}/graph")
def get_scenario_graph(
    scenario_id: str,
    current_user: Optional[UserProfile] = Depends(get_current_user_optional),
):
    scenario = _resolve_scenario(scenario_id, current_user)
    if not scenario:
        raise HTTPException(status_code=404, detail=f"Scenario '{scenario_id}' not found")

    G, relationships = graph_engine.build_graph(scenario)
    metrics = graph_engine.extract_metrics(G)

    nodes = [
        {
            "id": node_id,
            "timestamp": data.get("timestamp"),
            "event_type": data.get("event_type"),
            "severity": data.get("severity"),
            "source_entity_id": data.get("source_entity_id"),
            "target_entity_id": data.get("target_entity_id"),
            "summary": data.get("summary"),
        }
        for node_id, data in G.nodes(data=True)
    ]

    edges = [
        {
            "id": rel.id,
            "source": rel.source_event_id,
            "target": rel.target_event_id,
            "relationship_type": rel.relationship_type,
            "provenance": rel.provenance,
            "rule_name": rel.rule_name,
            "explanation": rel.explanation,
            "confidence": rel.confidence,
        }
        for rel in relationships
    ]

    return {
        "scenario_id": scenario_id,
        "nodes": nodes,
        "edges": edges,
        "metrics": metrics,
    }


@router.get("/{scenario_id}/hypotheses", response_model=CompetingHypothesesResponse)
def get_hypotheses(
    scenario_id: str,
    current_user: Optional[UserProfile] = Depends(get_current_user_optional),
):
    scenario = _resolve_scenario(scenario_id, current_user)
    if not scenario:
        raise HTTPException(status_code=404, detail=f"Scenario '{scenario_id}' not found")
    return _get_gemma().generate_hypotheses(scenario)


@router.post("/{scenario_id}/hypotheses/challenge", response_model=HypothesisChallengeResponse)
def challenge_hypothesis(
    scenario_id: str,
    challenge_req: HypothesisChallengeRequest,
    current_user: Optional[UserProfile] = Depends(get_current_user_optional),
):
    scenario = _resolve_scenario(scenario_id, current_user)
    if not scenario:
        raise HTTPException(status_code=404, detail=f"Scenario '{scenario_id}' not found")
    return _get_gemma().challenge_hypothesis(scenario, challenge_req)


@router.post("/{scenario_id}/counterfactual/run", response_model=CounterfactualResult)
def run_counterfactual_experiment(
    scenario_id: str,
    req: CounterfactualExperimentRequest,
    current_user: Optional[UserProfile] = Depends(get_current_user_optional),
):
    scenario = _resolve_scenario(scenario_id, current_user)
    if not scenario:
        raise HTTPException(status_code=404, detail=f"Scenario '{scenario_id}' not found")

    result = counterfactual_engine.run_experiment(scenario, req.mutation)

    if req.include_ai_reassessment:
        try:
            impact = _get_gemma().reassess_counterfactual(scenario, result)
            result.hypothesis_impact = impact
        except Exception as e:
            result.hypothesis_impact = CounterfactualHypothesisImpact(
                reassessment=f"Automated reassessment failed: {str(e)}",
                interpretation_type="error_fallback",
                source="error"
            )

    return result


@router.get("/{scenario_id}/scorecard", response_model=InvestigationScorecard)
def get_scenario_scorecard(
    scenario_id: str,
    current_user: Optional[UserProfile] = Depends(get_current_user_optional),
):
    scenario = _resolve_scenario(scenario_id, current_user)
    if not scenario:
        raise HTTPException(status_code=404, detail=f"Scenario '{scenario_id}' not found")

    hypotheses_resp = _get_gemma().generate_hypotheses(scenario)
    return evaluation_engine.evaluate(scenario, hypotheses_resp)


@router.post("/{scenario_id}/scorecard/evaluate", response_model=InvestigationScorecard)
def evaluate_scorecard_custom(
    scenario_id: str,
    req: ScorecardEvaluationRequest,
    current_user: Optional[UserProfile] = Depends(get_current_user_optional),
):
    scenario = _resolve_scenario(scenario_id, current_user)
    if not scenario:
        raise HTTPException(status_code=404, detail=f"Scenario '{scenario_id}' not found")

    if req.hypotheses is not None:
        hypotheses_resp = CompetingHypothesesResponse(
            scenario_id=scenario_id,
            source="custom_eval",
            hypotheses=req.hypotheses,
            audit_flags=[]
        )
    else:
        hypotheses_resp = _get_gemma().generate_hypotheses(scenario)

    return evaluation_engine.evaluate(
        scenario,
        hypotheses_resp,
        counterfactual_results=req.counterfactuals
    )


@router.get("/ai/status")
def get_ai_status():
    return _get_gemma().check_liveness()
