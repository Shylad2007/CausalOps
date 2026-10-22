# CausalOps — Project Specification

## 1. Overview
CausalOps provides a rigorous, explainable cyber incident investigation platform. Instead of presenting simple log alerts or ungrounded generative summaries, CausalOps operates on a fundamental distinction:
- **Recorded Facts**: Empirical log records (e.g., authentication timestamps, process spawns, network socket opens).
- **Deterministic Relationships**: Proven structural lineages computed directly via graph rules (e.g., parent-child PID, token-bound session activity, IP connections).
- **Inferred Hypotheses**: Evaluated competing explanations for the incident, with explicit evidence citations (positive & negative).
- **Counterfactual Tests**: Controlled variations of the scenario (mutating or removing an event) to recompute downstream causal dependencies and verify necessity.

## 2. Event & Entity Schema Design

### Entities
Entities represent actors, endpoints, servers, tokens, and resources:
- `id` (string, e.g., `workstation-eng-42`, `usr-mchen`, `srv-auth-01`)
- `name` (string)
- `type` (e.g., `user`, `workstation`, `server`, `database`, `identity_provider`, `process`, `session_token`)
- `ip_address` (optional string)
- `zone` (e.g., `workstation_vlan`, `dmz`, `prod_internal`, `identity`)
- `position_3d` (x, y, z tuple for 3D cyber world layout)
- `attributes` (metadata dict)

### Events
Events represent atomic, timestamped occurrences:
- `id` (string, e.g., `EVT-1001`)
- `timestamp` (ISO-8601 string, e.g., `2026-10-18T08:14:02Z`)
- `event_type` (`auth_login`, `process_spawn`, `network_connect`, `file_access`, `token_mint`, `privilege_escalation`)
- `source_entity_id` (string)
- `target_entity_id` (optional string)
- `actor_id` (optional string, e.g., user account)
- `session_id` (optional string)
- `process_lineage` (optional dict: `pid`, `ppid`, `binary_path`, `command_line`)
- `severity` (`info`, `low`, `medium`, `high`, `critical`)
- `observable_data` (structured payload)
- `is_synthetic_counterfactual` (boolean flag)

### Relationships (Edges)
- `id` (string)
- `source_event_id` (string)
- `target_event_id` (string)
- `relationship_type` (`process_parent_child`, `session_continuity`, `network_socket_link`, `credential_use`, `file_io_link`, `temporal_correlated`)
- `provenance` (`recorded_fact`, `deterministic_rule`, `inferred_hypothesis`)
- `rule_name` (string identifying the deterministic logic)
- `explanation` (plain text explanation of why the edge exists)
- `confidence` (float 0.0 - 1.0)

## 3. Five Core Features Specification

### 3.1 3D Cyber World & Incident Replay
- Rendered in Three.js / React Three Fiber.
- Isometric / Dark cyber workspace view.
- Entities grouped by security zones with subtle volumetric bounding grids.
- Animated packet or dependency pulses traveling along connected edges when events occur.
- Unified playback controller: step-by-step, play/pause, scrub slider, 1x/2x/5x speed.
- Bi-directional selection: Clicking an event in timeline or graph highlights the source/target entities in 3D, and vice versa.

### 3.2 Deterministic Causal Event Graph
- Backend NetworkX DiGraph builder.
- Strict rules:
  1. *Process Lineage Rule*: PPID -> PID linkage on same host.
  2. *Session Continuity Rule*: Event with session_token X preceded by Token Mint / Auth event for session_token X.
  3. *Network Socket Rule*: Socket connect from host A:port -> host B:port matched with accept on host B.
  4. *Temporal Credential Reuse*: Auth using stolen hash/ticket after memory dump/harvest event.
- Transitive closures and dependency chains: given an event $E$, compute all upstream causes and downstream effects.

### 3.3 Competing Hypotheses & Evidence Engine
- Model: Gemma 4 integration.
- For an incident, at least 2-3 distinct competing hypotheses are generated/analyzed:
  - *Hypothesis A* (e.g., Compromised Credentials / Session Hijacking)
  - *Hypothesis B* (e.g., Authorized Admin Task with Unusual Deviation / False Alarm)
  - *Hypothesis C* (e.g., Supply Chain / Remote Code Execution via Dependency)
- Mandatory output schema:
  - `hypothesis_id`: string
  - `title`: string
  - `description`: string
  - `supporting_event_ids`: array of existing event IDs
  - `contradictory_event_ids`: array of existing event IDs
  - `assumptions`: list of strings
  - `unresolved_questions`: list of strings
  - `investigation_status`: `supported`, `disputed`, `unresolved`, `rejected`
  - `recommended_steps`: list of actions

### 3.4 Counterfactual Investigation Lab
- Create branched experiment states $S' = \text{mutate}(S, \Delta)$.
- Supported mutations:
  - `REMOVE_EVENT`: Drop event $E_k$ from the timeline.
  - `MODIFY_EVENT_FIELD`: Alter a property (e.g., change source IP or session token).
- Deterministic Recomputation:
  - Graph is re-evaluated using the exact same deterministic rule engine.
  - Compute graph diff: $\Delta \text{Edges} = \text{Edges}(S) \setminus \text{Edges}(S')$, $\Delta \text{Downstream} = \text{Reachable}(E_k)$.
  - Highlight broken causal chains (e.g., if Session Minting is removed, downstream lateral movement loses its causal justification).
- Re-run Gemma 4 hypothesis reassessment on $S'$ to show how hypothesis confidence and supported claims shift.

### 3.5 Evidence Audit & Investigation Scorecard
- Deterministic validation suite:
  - `unsupported_citation_count`: Number of event IDs cited by AI that do not exist in the scenario.
  - `contradiction_violation_count`: Claims asserted despite documented contradictory events.
  - `causal_coverage_ratio`: Ratio of ground-truth causal links identified.
  - `counterfactual_faithfulness`: Does the recomputed graph correctly break invalid downstream links?
- Audit Scorecard output displayed to the investigator with complete transparency.
