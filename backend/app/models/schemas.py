from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from enum import Enum

class EntityType(str, Enum):
    USER = "user"
    WORKSTATION = "workstation"
    SERVER = "server"
    DATABASE = "database"
    IDENTITY_PROVIDER = "identity_provider"
    PROCESS = "process"
    SESSION_TOKEN = "session_token"

class SecurityZone(str, Enum):
    WORKSTATION_VLAN = "workstation_vlan"
    DMZ = "dmz"
    PROD_INTERNAL = "prod_internal"
    IDENTITY = "identity"

class EventSeverity(str, Enum):
    INFO = "info"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class RelationshipType(str, Enum):
    PROCESS_PARENT_CHILD = "process_parent_child"
    SESSION_CONTINUITY = "session_continuity"
    NETWORK_SOCKET_LINK = "network_socket_link"
    CREDENTIAL_USE = "credential_use"
    FILE_IO_LINK = "file_io_link"
    TEMPORAL_CORRELATED = "temporal_correlated"

class ProvenanceType(str, Enum):
    RECORDED_FACT = "recorded_fact"
    DETERMINISTIC_RULE = "deterministic_rule"
    INFERRED_HYPOTHESIS = "inferred_hypothesis"

class HypothesisStatus(str, Enum):
    SUPPORTED = "supported"
    DISPUTED = "disputed"
    UNRESOLVED = "unresolved"
    REJECTED = "rejected"

class Entity(BaseModel):
    id: str
    name: str
    type: EntityType
    ip_address: Optional[str] = None
    zone: SecurityZone
    position_3d: List[float] = Field(default_factory=lambda: [0.0, 0.0, 0.0])
    attributes: Dict[str, Any] = Field(default_factory=dict)

class ProcessLineage(BaseModel):
    pid: int
    ppid: int
    binary_path: str
    command_line: Optional[str] = None

class Event(BaseModel):
    id: str
    timestamp: str
    event_type: str
    source_entity_id: str
    target_entity_id: Optional[str] = None
    actor_id: Optional[str] = None
    session_id: Optional[str] = None
    process_lineage: Optional[ProcessLineage] = None
    severity: EventSeverity
    summary: str
    observable_data: Dict[str, Any] = Field(default_factory=dict)
    is_synthetic_counterfactual: bool = False

class Relationship(BaseModel):
    id: str
    source_event_id: str
    target_event_id: str
    relationship_type: RelationshipType
    provenance: ProvenanceType
    rule_name: str
    explanation: str
    confidence: float = 1.0

class Hypothesis(BaseModel):
    id: str
    title: str
    description: str
    supporting_event_ids: List[str] = Field(default_factory=list)
    contradictory_event_ids: List[str] = Field(default_factory=list)
    unsupported_event_ids: List[str] = Field(default_factory=list) # Audit flagged citations
    assumptions: List[str] = Field(default_factory=list)
    unresolved_questions: List[str] = Field(default_factory=list)
    investigation_status: HypothesisStatus = HypothesisStatus.UNRESOLVED
    support_assessment: str
    recommended_steps: List[str] = Field(default_factory=list)
    alternative_explanations: List[str] = Field(default_factory=list)

class CompetingHypothesesResponse(BaseModel):
    scenario_id: str
    source: str # "gemma-4-26b-a4b-it" or "deterministic_fallback"
    model_name: Optional[str] = None
    hypotheses: List[Hypothesis]
    audit_flags: List[str] = Field(default_factory=list)

class HypothesisChallengeRequest(BaseModel):
    hypothesis_id: str
    challenge: str

class HypothesisChallengeResponse(BaseModel):
    hypothesis_id: str
    reassessment: str
    updated_status: HypothesisStatus
    evidence_cited: List[str] = Field(default_factory=list)
    unsupported_citations: List[str] = Field(default_factory=list)
    source: str

class ScenarioGroundTruth(BaseModel):
    threat_actor: str
    initial_access_vector: str
    root_cause_event_ids: List[str]
    primary_causal_path: List[str]
    critical_milestone_event_ids: List[str]
    valid_explanations: List[str]
    invalid_explanations: List[str]

class Scenario(BaseModel):
    id: str
    title: str
    description: str
    severity: EventSeverity
    entities: List[Entity]
    events: List[Event]
    ground_truth: Optional[ScenarioGroundTruth] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)

class MutationType(str, Enum):
    REMOVE_EVENT = "REMOVE_EVENT"
    MODIFY_EVENT_FIELD = "MODIFY_EVENT_FIELD"

class ScenarioMutation(BaseModel):
    mutation_type: MutationType
    target_event_id: str
    field_path: Optional[str] = None
    new_value: Optional[Any] = None

class CounterfactualHypothesisImpact(BaseModel):
    reassessment: str
    affected_hypotheses: List[Dict[str, Any]] = Field(default_factory=list)
    interpretation_type: str = "ai_generated_interpretation" # Explicitly distinguishing computed facts from AI interpretation
    source: str # "gemma-4-26b-a4b-it" or "deterministic_fallback"
    unsupported_citations: List[str] = Field(default_factory=list)

class CounterfactualExperimentRequest(BaseModel):
    mutation: ScenarioMutation
    include_ai_reassessment: bool = True

class CounterfactualResult(BaseModel):
    experiment_id: str
    scenario_id: str
    mutation: ScenarioMutation

    baseline_event_count: int
    modified_event_count: int
    baseline_edge_count: int
    modified_edge_count: int
    baseline_edges: List[Dict[str, Any]] = Field(default_factory=list)
    modified_edges: List[Dict[str, Any]] = Field(default_factory=list)
    edges_removed: List[Dict[str, Any]] = Field(default_factory=list)
    edges_added: List[Dict[str, Any]] = Field(default_factory=list)
    broken_causal_chains: List[Dict[str, Any]] = Field(default_factory=list)
    hypothesis_impact: Optional[CounterfactualHypothesisImpact] = None

class MetricType(str, Enum):
    DETERMINISTIC = "deterministic"
    RULE_BASED = "rule_based"
    AI_ASSESSED = "ai_assessed"
    GROUND_TRUTH_BENCHMARK = "ground_truth_benchmark"

class FindingSeverity(str, Enum):
    PASS = "pass"
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"

class AuditFinding(BaseModel):
    id: str
    category: str
    severity: FindingSeverity
    message: str
    actionable_guidance: str
    metric_type: MetricType
    cited_references: List[str] = Field(default_factory=list)

class ScorecardMetrics(BaseModel):
    citation_validity_ratio: float = Field(..., description="Fraction of cited event IDs that genuinely exist in scenario")
    evidence_support_ratio: float = Field(..., description="Fraction of cited supporting events with verified graph or observable relevance")
    unsupported_claim_count: int = Field(..., description="Count of hypotheses asserted without sufficient grounding evidence")
    critical_milestone_coverage: float = Field(..., description="Fraction of critical scenario events addressed across all hypotheses")
    contradiction_awareness_score: float = Field(..., description="Score measuring acknowledgment and testing of contradictory telemetry")
    uncertainty_calibration_score: float = Field(..., description="Score penalizing uncalibrated certainty when assumptions are unresolved")
    counterfactual_consistency_score: float = Field(..., description="Consistency between intervention recomputations and hypothesis shifts")
    ground_truth_alignment_score: float = Field(..., description="Isolated benchmark: alignment with objective ground truth (root cause, valid explanations)")
    reproducibility_score: float = Field(..., description="Purity check: identical inputs yield identical metrics (1.0 = deterministic)")
    overall_audit_score: float = Field(..., description="Transparent composite score (0-100) based on weighted deterministic & benchmark checks")

class InvestigationScorecard(BaseModel):
    scenario_id: str
    audit_status: str # "PASSED_WITH_DISTINCTION", "PASSED_AUDIT", "REQUIRES_REVIEW", "CRITICAL_FAILURES"
    metrics: ScorecardMetrics
    metric_provenance: Dict[str, str] = Field(default_factory=dict)
    findings: List[AuditFinding] = Field(default_factory=list)
    hypotheses_evaluated_count: int
    counterfactuals_evaluated_count: int
    critical_failures_count: int
    warnings_count: int
    summary: str

class ScorecardEvaluationRequest(BaseModel):
    hypotheses: Optional[List[Hypothesis]] = None
    counterfactuals: Optional[List[CounterfactualResult]] = None



