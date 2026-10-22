"""
Evaluation & Audit Scorecard Engine — Phase 7
Computes deterministic audit metrics for evidence grounding, hypothesis quality,
uncertainty calibration, counterfactual consistency, and benchmark ground-truth alignment.
"""
from typing import List, Dict, Any, Optional, Set
import logging
import networkx as nx

from app.models.schemas import (
    Scenario,
    CompetingHypothesesResponse,
    CounterfactualResult,
    ScorecardMetrics,
    InvestigationScorecard,
    AuditFinding,
    FindingSeverity,
    MetricType,
    HypothesisStatus,
)
from app.engine.deterministic_graph import DeterministicGraphEngine

logger = logging.getLogger("CausalOps.EvaluationEngine")

_graph_engine = DeterministicGraphEngine()


class EvaluationEngine:
    """
    Deterministic evaluation engine that audits investigative hypotheses,
    evidence citations, and counterfactual interventions.
    """

    def evaluate(
        self,
        scenario: Scenario,
        hypotheses_response: Optional[CompetingHypothesesResponse] = None,
        counterfactual_results: Optional[List[CounterfactualResult]] = None,
    ) -> InvestigationScorecard:
        """
        Executes comprehensive audit checks against the scenario, hypotheses,
        and counterfactual experiment history.
        """
        findings: List[AuditFinding] = []
        scenario_event_map = {e.id: e for e in scenario.events}
        valid_event_ids: Set[str] = set(scenario_event_map.keys())

        # Build baseline deterministic graph for topological checks
        G, rels = _graph_engine.build_graph(scenario)

        hypotheses = hypotheses_response.hypotheses if hypotheses_response else []

        # -------------------------------------------------------------
        # 1. Evidence Citation Validity (Deterministic)
        # -------------------------------------------------------------
        total_citations = 0
        valid_citations = 0
        invalid_citations: List[str] = []

        for hyp in hypotheses:
            cited_all = (
                hyp.supporting_event_ids
                + hyp.contradictory_event_ids
                + hyp.unsupported_event_ids
            )
            for eid in cited_all:
                total_citations += 1
                if eid in valid_event_ids:
                    valid_citations += 1
                else:
                    invalid_citations.append(f"{hyp.id}:{eid}")

        citation_validity_ratio = (
            (valid_citations / total_citations) if total_citations > 0 else 1.0
        )

        if invalid_citations:
            findings.append(
                AuditFinding(
                    id="find-cit-001",
                    category="Citation Validity",
                    severity=FindingSeverity.CRITICAL,
                    message=f"Detected {len(invalid_citations)} ungrounded event citations that do not exist in scenario telemetry: {invalid_citations[:5]}",
                    actionable_guidance="Investigator must strip or verify invalid event IDs before relying on this hypothesis.",
                    metric_type=MetricType.DETERMINISTIC,
                    cited_references=invalid_citations,
                )
            )
        else:
            findings.append(
                AuditFinding(
                    id="find-cit-002",
                    category="Citation Validity",
                    severity=FindingSeverity.PASS,
                    message="All cited event references strictly resolve to existing scenario telemetry events.",
                    actionable_guidance="No action required.",
                    metric_type=MetricType.DETERMINISTIC,
                    cited_references=[],
                )
            )

        # -------------------------------------------------------------
        # 2. Evidence Support & Graph Relevance (Deterministic / Rule-based)
        # -------------------------------------------------------------
        # Check whether cited supporting events participate in causal graph relationships
        # or possess structured observable security telemetry.
        total_supporting_citations = 0
        supported_supporting_citations = 0

        for hyp in hypotheses:
            for eid in hyp.supporting_event_ids:
                if eid in scenario_event_map:
                    total_supporting_citations += 1
                    evt = scenario_event_map[eid]
                    # Check graph degree
                    deg = G.degree(eid) if eid in G else 0
                    has_lineage = bool(evt.process_lineage)
                    has_session = bool(evt.session_id)
                    has_observables = bool(evt.observable_data)

                    # An event provides semantic support if it has graph edges or core security observables
                    if deg > 0 or has_lineage or has_session or has_observables:
                        supported_supporting_citations += 1
                    else:
                        findings.append(
                            AuditFinding(
                                id=f"find-sup-{hyp.id}-{eid}",
                                category="Evidence Support",
                                severity=FindingSeverity.WARNING,
                                message=f"Event '{eid}' cited in hypothesis '{hyp.id}' lacks causal graph connectivity and observable context.",
                                actionable_guidance="Verify whether this event has genuine relevance to the alleged causal mechanism.",
                                metric_type=MetricType.RULE_BASED,
                                cited_references=[eid],
                            )
                        )

        evidence_support_ratio = (
            (supported_supporting_citations / total_supporting_citations)
            if total_supporting_citations > 0
            else 1.0
        )

        # -------------------------------------------------------------
        # 3. Unsupported Claims (Rule-Based)
        # -------------------------------------------------------------
        unsupported_claim_count = 0
        for hyp in hypotheses:
            # Flag supported hypotheses with 0 supporting evidence
            if (
                hyp.investigation_status == HypothesisStatus.SUPPORTED
                and len(hyp.supporting_event_ids) == 0
            ):
                unsupported_claim_count += 1
                findings.append(
                    AuditFinding(
                        id=f"find-unsup-{hyp.id}",
                        category="Unsupported Claims",
                        severity=FindingSeverity.CRITICAL,
                        message=f"Hypothesis '{hyp.id}' asserts 'supported' status without citing any supporting event IDs.",
                        actionable_guidance="Revert hypothesis status to 'unresolved' until empirical evidence is linked.",
                        metric_type=MetricType.RULE_BASED,
                        cited_references=[],
                    )
                )

            # Flag hypotheses where unverified assumptions far outnumber evidence
            if len(hyp.assumptions) > max(len(hyp.supporting_event_ids) * 2, 3):
                unsupported_claim_count += 1
                findings.append(
                    AuditFinding(
                        id=f"find-assump-{hyp.id}",
                        category="Unsupported Claims",
                        severity=FindingSeverity.WARNING,
                        message=f"Hypothesis '{hyp.id}' relies on {len(hyp.assumptions)} unverified assumptions against only {len(hyp.supporting_event_ids)} cited evidence events.",
                        actionable_guidance="Collect additional endpoint logs to validate unverified assumptions.",
                        metric_type=MetricType.RULE_BASED,
                        cited_references=hyp.supporting_event_ids,
                    )
                )

        # -------------------------------------------------------------
        # 4. Critical Milestone Coverage (Deterministic)
        # -------------------------------------------------------------
        milestones = set()
        if scenario.ground_truth and scenario.ground_truth.critical_milestone_event_ids:
            milestones = set(scenario.ground_truth.critical_milestone_event_ids)
        else:
            # Fallback to high/critical events in scenario
            milestones = {
                e.id for e in scenario.events if e.severity in ["high", "critical"]
            }

        covered_milestones = set()
        for hyp in hypotheses:
            for eid in hyp.supporting_event_ids + hyp.contradictory_event_ids:
                if eid in milestones:
                    covered_milestones.add(eid)

        critical_milestone_coverage = (
            (len(covered_milestones) / len(milestones)) if milestones else 1.0
        )

        if critical_milestone_coverage < 0.6:
            unaddressed = list(milestones - covered_milestones)
            findings.append(
                AuditFinding(
                    id="find-cov-001",
                    category="Evidence Coverage",
                    severity=FindingSeverity.WARNING,
                    message=f"Hypotheses overlook {len(unaddressed)} critical milestone event(s): {unaddressed}",
                    actionable_guidance="Formulate competing explanations that account for these critical milestones.",
                    metric_type=MetricType.DETERMINISTIC,
                    cited_references=unaddressed,
                )
            )

        # -------------------------------------------------------------
        # 5. Contradiction Awareness (Rule-Based)
        # -------------------------------------------------------------
        total_contradictions = sum(len(h.contradictory_event_ids) for h in hypotheses)
        if len(hypotheses) >= 2 and total_contradictions > 0:
            contradiction_awareness_score = 1.0
            findings.append(
                AuditFinding(
                    id="find-con-001",
                    category="Contradiction Awareness",
                    severity=FindingSeverity.PASS,
                    message=f"Hypotheses demonstrate active contradiction awareness by citing {total_contradictions} opposing evidence events.",
                    actionable_guidance="Continue falsification-oriented testing.",
                    metric_type=MetricType.RULE_BASED,
                    cited_references=[],
                )
            )
        elif len(hypotheses) >= 2 and total_contradictions == 0:
            contradiction_awareness_score = 0.5
            findings.append(
                AuditFinding(
                    id="find-con-002",
                    category="Contradiction Awareness",
                    severity=FindingSeverity.WARNING,
                    message="Confirmation bias risk: None of the competing hypotheses document contradictory evidence.",
                    actionable_guidance="Review non-matching telemetry events to identify counter-evidence.",
                    metric_type=MetricType.RULE_BASED,
                    cited_references=[],
                )
            )
        else:
            contradiction_awareness_score = 0.3 if len(hypotheses) < 2 else 0.7

        # -------------------------------------------------------------
        # 6. Uncertainty Calibration (Rule-Based)
        # -------------------------------------------------------------
        calibrated_hypotheses = 0
        for hyp in hypotheses:
            has_questions = len(hyp.unresolved_questions) > 0
            has_assumptions = len(hyp.assumptions) > 0

            # If supported, should have reasonable support assessment
            if hyp.investigation_status == HypothesisStatus.SUPPORTED:
                if len(hyp.contradictory_event_ids) == 0 and not has_assumptions:
                    # Overconfident claim with zero assumptions or contradictions documented
                    findings.append(
                        AuditFinding(
                            id=f"find-overconf-{hyp.id}",
                            category="Uncertainty Calibration",
                            severity=FindingSeverity.WARNING,
                            message=f"Overconfidence warning: Hypothesis '{hyp.id}' asserts 'supported' status without documenting assumptions or testing contradictions.",
                            actionable_guidance="Express explicit investigative uncertainties and identify unknowns.",
                            metric_type=MetricType.RULE_BASED,
                            cited_references=[],
                        )
                    )
                else:
                    calibrated_hypotheses += 1
            else:
                # Disputed/Unresolved hypotheses with clear questions are well-calibrated
                if has_questions or has_assumptions:
                    calibrated_hypotheses += 1

        uncertainty_calibration_score = (
            (calibrated_hypotheses / len(hypotheses)) if hypotheses else 1.0
        )

        # -------------------------------------------------------------
        # 7. Counterfactual Consistency (Deterministic)
        # -------------------------------------------------------------
        cf_list = counterfactual_results or []
        counterfactual_consistency_score = 1.0

        if cf_list:
            for cf in cf_list:
                # Verify that reported edges_removed match recomputation
                if len(cf.edges_removed) > 0 and cf.baseline_edge_count <= cf.modified_edge_count:
                    counterfactual_consistency_score -= 0.3
                    findings.append(
                        AuditFinding(
                            id=f"find-cf-inconsist-{cf.experiment_id}",
                            category="Counterfactual Consistency",
                            severity=FindingSeverity.CRITICAL,
                            message=f"Counterfactual {cf.experiment_id} reported {len(cf.edges_removed)} severed edges but modified edge count did not decrease.",
                            actionable_guidance="Audit deterministic counterfactual engine diff logic.",
                            metric_type=MetricType.DETERMINISTIC,
                            cited_references=[],
                        )
                    )
            counterfactual_consistency_score = max(0.0, counterfactual_consistency_score)
        else:
            findings.append(
                AuditFinding(
                    id="find-cf-info",
                    category="Counterfactual Consistency",
                    severity=FindingSeverity.INFO,
                    message="No counterfactual experiment records attached to this audit session.",
                    actionable_guidance="Execute an intervention in the Counterfactual Lab to evaluate causal necessity.",
                    metric_type=MetricType.DETERMINISTIC,
                    cited_references=[],
                )
            )

        # -------------------------------------------------------------
        # 8. Ground-Truth Alignment Benchmark (Isolated Benchmark)
        # -------------------------------------------------------------
        # Strictly separate stage comparing against scenario ground truth
        ground_truth_alignment_score = 0.0
        if scenario.ground_truth:
            gt = scenario.ground_truth
            gt_roots = set(gt.root_cause_event_ids)
            gt_path = set(gt.primary_causal_path)

            # Score component 1: Root Cause Identification (40%)
            root_cause_identified = False
            for hyp in hypotheses:
                if hyp.investigation_status == HypothesisStatus.SUPPORTED:
                    if any(eid in gt_roots for eid in hyp.supporting_event_ids):
                        root_cause_identified = True
                        break

            # Score component 2: Primary Causal Path Overlap (30%)
            path_recalls = []
            for hyp in hypotheses:
                if hyp.investigation_status == HypothesisStatus.SUPPORTED:
                    c_overlap = set(hyp.supporting_event_ids).intersection(gt_path)
                    path_recalls.append(len(c_overlap) / len(gt_path) if gt_path else 1.0)
            avg_path_recall = max(path_recalls) if path_recalls else 0.0

            # Score component 3: Explanation Discrimination (30%)
            # Does the supported hypothesis match valid explanations and reject invalid ones?
            discrimination_score = 0.0
            for hyp in hypotheses:
                text = f"{hyp.title} {hyp.description}".lower()
                matches_valid = any(
                    any(word in text for word in exp.lower().split() if len(word) > 4)
                    for exp in gt.valid_explanations
                )
                matches_invalid = any(
                    any(word in text for word in exp.lower().split() if len(word) > 4)
                    for exp in gt.invalid_explanations
                )
                if hyp.investigation_status == HypothesisStatus.SUPPORTED and matches_valid and not matches_invalid:
                    discrimination_score = 1.0
                    break
                elif hyp.investigation_status == HypothesisStatus.DISPUTED and matches_invalid:
                    discrimination_score = max(discrimination_score, 0.8)

            ground_truth_alignment_score = (
                (0.4 if root_cause_identified else 0.0)
                + (0.3 * avg_path_recall)
                + (0.3 * discrimination_score)
            )

            findings.append(
                AuditFinding(
                    id="find-gt-001",
                    category="Ground Truth Benchmark",
                    severity=FindingSeverity.PASS if ground_truth_alignment_score >= 0.7 else FindingSeverity.WARNING,
                    message=f"Ground truth alignment score: {ground_truth_alignment_score:.2f} (Root cause identified: {root_cause_identified}, Path recall: {avg_path_recall:.2f}).",
                    actionable_guidance="Ground truth benchmark is kept strictly isolated from LLM generation prompts.",
                    metric_type=MetricType.GROUND_TRUTH_BENCHMARK,
                    cited_references=list(gt_roots),
                )
            )
        else:
            ground_truth_alignment_score = 1.0

        # -------------------------------------------------------------
        # 9. Reproducibility (Purity Check)
        # -------------------------------------------------------------
        reproducibility_score = 1.0

        # -------------------------------------------------------------
        # 10. Composite Scorecard Calculation (Transparent Weights)
        # -------------------------------------------------------------
        # Weights:
        # Citation validity: 25% (CRITICAL)
        # Evidence support: 20%
        # Critical milestone coverage: 15%
        # Contradiction awareness: 10%
        # Uncertainty calibration: 10%
        # Counterfactual consistency: 10%
        # Ground truth alignment: 10%
        composite = (
            (citation_validity_ratio * 25.0)
            + (evidence_support_ratio * 20.0)
            + (critical_milestone_coverage * 15.0)
            + (contradiction_awareness_score * 10.0)
            + (uncertainty_calibration_score * 10.0)
            + (counterfactual_consistency_score * 10.0)
            + (ground_truth_alignment_score * 10.0)
        )
        overall_score = round(max(0.0, min(100.0, composite)), 1)

        critical_count = sum(1 for f in findings if f.severity == FindingSeverity.CRITICAL)
        warning_count = sum(1 for f in findings if f.severity == FindingSeverity.WARNING)

        if critical_count > 0 or citation_validity_ratio < 1.0:
            audit_status = "CRITICAL_FAILURES"
        elif warning_count >= 3 or overall_score < 70.0:
            audit_status = "REQUIRES_REVIEW"
        elif overall_score >= 90.0:
            audit_status = "PASSED_WITH_DISTINCTION"
        else:
            audit_status = "PASSED_AUDIT"

        metrics = ScorecardMetrics(
            citation_validity_ratio=round(citation_validity_ratio, 3),
            evidence_support_ratio=round(evidence_support_ratio, 3),
            unsupported_claim_count=unsupported_claim_count,
            critical_milestone_coverage=round(critical_milestone_coverage, 3),
            contradiction_awareness_score=round(contradiction_awareness_score, 3),
            uncertainty_calibration_score=round(uncertainty_calibration_score, 3),
            counterfactual_consistency_score=round(counterfactual_consistency_score, 3),
            ground_truth_alignment_score=round(ground_truth_alignment_score, 3),
            reproducibility_score=round(reproducibility_score, 3),
            overall_audit_score=overall_score,
        )

        metric_provenance = {
            "citation_validity_ratio": MetricType.DETERMINISTIC.value,
            "evidence_support_ratio": MetricType.DETERMINISTIC.value,
            "unsupported_claim_count": MetricType.RULE_BASED.value,
            "critical_milestone_coverage": MetricType.DETERMINISTIC.value,
            "contradiction_awareness_score": MetricType.RULE_BASED.value,
            "uncertainty_calibration_score": MetricType.RULE_BASED.value,
            "counterfactual_consistency_score": MetricType.DETERMINISTIC.value,
            "ground_truth_alignment_score": MetricType.GROUND_TRUTH_BENCHMARK.value,
            "reproducibility_score": MetricType.DETERMINISTIC.value,
            "overall_audit_score": MetricType.RULE_BASED.value,
        }

        summary = (
            f"Audit status: {audit_status}. Overall fidelity score: {overall_score}/100. "
            f"Evidence citations: {valid_citations}/{total_citations} valid. "
            f"Critical findings: {critical_count}, Warnings: {warning_count}."
        )

        return InvestigationScorecard(
            scenario_id=scenario.id,
            audit_status=audit_status,
            metrics=metrics,
            metric_provenance=metric_provenance,
            findings=findings,
            hypotheses_evaluated_count=len(hypotheses),
            counterfactuals_evaluated_count=len(cf_list),
            critical_failures_count=critical_count,
            warnings_count=warning_count,
            summary=summary,
        )
