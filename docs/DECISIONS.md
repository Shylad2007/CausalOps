# CausalOps — Architectural & Technical Decisions Record (ADR)

## ADR-001: Separation of Deterministic Graph Computation and LLM Inference
- **Status**: Approved & Adopted
- **Context**: Cyber incident investigations require auditable, repeatable facts. Hallucinated links in an incident timeline are unacceptable in security operations.
- **Decision**: NetworkX in Python computes all graph edges deterministically based on formal telemetry rules (lineage, socket matching, auth token tracing). Gemma 4 is used strictly for reasoning over structured subgraphs, hypothesis formation, challenge evaluation, and summary generation. The LLM cannot add or delete edges from the primary graph.
- **Consequences**: Complete reproducibility. Auditability is guaranteed.

## ADR-002: Frontend Stack — React with Pure JavaScript & Vite
- **Status**: Approved & Adopted
- **Context**: Explicit requirement: React, Vite, JavaScript (NOT TypeScript), Three.js via React Three Fiber & Drei, Tailwind CSS, Zustand.
- **Decision**: Frontend is scaffolded as a pure JS Vite project with JSX. Strong JSDoc annotations and clean modular component boundaries will maintain type clarity without TypeScript compiler overhead or TS mismatch.
- **Consequences**: Fast builds, instant HMR, direct compatibility with Three.js/R3F ecosystems.

## ADR-003: Pure In-Memory Isolated Counterfactual Experiments
- **Status**: Approved & Adopted
- **Context**: Counterfactual experiments require testing "what if event X did not occur" without corrupting baseline ground truth or requiring complex database rollbacks.
- **Decision**: Scenario states are stored as immutable baseline dictionaries. Experiments instantiate deep copies, apply validated mutations (`REMOVE_EVENT`, `MODIFY_EVENT_FIELD`), re-run the deterministic graph builder on the mutated scenario, and compute symmetric edge & reachability deltas.
- **Consequences**: Zero database latency; instant, stateless, repeatable counterfactual testing.

## ADR-004: Evidence Grounding Validation Barrier
- **Status**: Approved & Adopted
- **Context**: LLMs may invent plausible-sounding log identifiers (e.g. `EVT-9999`) or make claims unsupported by the event log.
- **Decision**: An audit validation barrier intercepts all AI model outputs. Every cited `supporting_event_ids` and `contradictory_event_ids` must exist in the active scenario's event index. Any invalid citation is stripped, flagged in the Evidence Audit Scorecard, and reported transparently.
- **Consequences**: Eliminates hallucinated evidence citations from reaching the investigator without notice.

## ADR-005: Strict Separation of Deterministic Counterfactual Diffs and AI Interpretation
- **Status**: Approved & Adopted
- **Context**: In counterfactual investigation, modifying or removing an event has two distinct consequences: (1) deterministic graph topology changes (severed parent-child or token continuity edges), and (2) speculative causal re-evaluations (how an attacker would adapt or whether an alternative vector might succeed). Conflating these two damages credibility in incident response.
- **Decision**: In both backend API payloads and frontend visual rendering, deterministic metrics (removed edges, broken paths, orphaned descendants) are computed by NetworkX rules and presented in unambiguous data tables. The LLM (Gemma 4) reassessment is explicitly tagged with `interpretation_type: "ai_generated_interpretation"` and rendered with an explicit disclaimer pill: "AI Interpretation — Not a Deterministic Certainty".
- **Consequences**: Investigators immediately discern mathematical ground truth from AI hypothesis adjustments.

## ADR-006: Ground Truth Benchmark Isolation & Multi-Modal Audit Provenance
- **Status**: Approved & Adopted
- **Context**: Evaluating AI hypothesis quality against scenario ground truth carries the risk of data leakage: if the model has access to ground-truth fields during hypothesis generation, evaluation metrics become trivial and unscientific. Furthermore, investigators must know which metrics are mathematical facts vs. rule-based heuristics.
- **Decision**:
  1. Scenario `ground_truth` is strictly purged from prompts during blind hypothesis generation. It is accessed solely by the `EvaluationEngine` in a separate post-hoc benchmark evaluation stage.
  2. Every scorecard metric is tagged with an explicit provenance classification (`deterministic`, `rule_based`, `ground_truth_benchmark`, or `ai_assessed`).
  3. The composite score calculation is transparently weighted and displayed, and any ungrounded citation immediately triggers `CRITICAL_FAILURES` regardless of overall percentage.
- **Consequences**: Prevents benchmark contamination, guarantees audit integrity, and provides actionable remediation guidance for investigators.


