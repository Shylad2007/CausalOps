# CausalOps — Implementation Progress Tracker

## Status Key
- `NOT STARTED`: Work has not commenced.
- `IN PROGRESS`: Actively being implemented.
- `BLOCKED`: Awaiting external input, credentials, or resolution.
- `COMPLETE`: Verified, tested, and acceptance criteria satisfied.

---

## Phases Summary

| Phase | Description | Status |
|---|---|---|
| **Phase 0** | Repository Audit and Project Blueprint | **COMPLETE** |
| **Phase 1** | Working Application Foundation | **COMPLETE** |
| **Phase 2** | Scenario Engine and Deterministic Causal Graph | **COMPLETE** |
| **Phase 3** | Interactive 3D Cyber World and Replay | **COMPLETE** |
| **Phase 4** | Causal Investigation Workspace and Evidence Audit | **COMPLETE** |
| **Phase 5** | Gemma 4 Integration (Gate) | **COMPLETE** |
| **Phase 6** | Counterfactual Investigation Lab | **COMPLETE** |
| **Phase 7** | Evaluation, Scorecard, and Reliability | **COMPLETE** |
| **Phase 8** | Product Polish and Final Local Verification | **COMPLETE** |
| **AppSec Refactor** | Product Direction Correction: Static Code Scanner, 3D Attack DAG, AI Remediation & Sandbox Verification | **COMPLETE** |
| **Phase 9** | Deployment Preparation and Deployment | `NOT STARTED` |

---

## Detailed Log

### Phase 6: Counterfactual Investigation Lab
- **Status**: COMPLETE
- **Features Implemented**:
  - `CounterfactualEngine` in `backend/app/engine/counterfactual_engine.py`:
    - Pure isolated cloning of baseline scenario (`model_copy(deep=True)`), guaranteeing baseline immutability.
    - Supported mutations: `REMOVE_EVENT` and `MODIFY_EVENT_FIELD`.
    - Deterministic graph recomputation using NetworkX rules (`RuleProcessLineage`, `RuleSessionContinuity`, `RuleNetworkDispatch`).
    - Symmetric edge diff computation (`edges_removed`, `edges_added`).
    - Broken causal path tracing identifying severed root-to-leaf paths and disconnected downstream descendants.
  - AI Reassessment via Gemma 4 (`GemmaService.reassess_counterfactual`) with deterministic fallback.
  - Strict epistemological boundary: AI analysis explicitly labeled with `interpretation_type="ai_generated_interpretation"` and distinguished from deterministic graph facts.
  - REST API endpoint: `POST /api/scenarios/{id}/counterfactual/run`.
  - Frontend interactive workspace: `CounterfactualLab.jsx` with quick-intervention presets, event selection, mutation controls, deterministic severed edge tables, downstream impact visualizer, and Gemma 4 reassessment card.
- **Tests & Verification**:
  - Backend: 7 automated tests in `backend/tests/test_counterfactual.py`. Full suite: 16/16 tests passing.
  - Frontend: 2 automated vitest tests in `frontend/src/test/CounterfactualLab.test.jsx`. Full frontend suite: 5/5 tests passing.
  - Production build: `npx vite build` succeeded cleanly with 0 errors.

### Phase 7: Evaluation, Scorecard, and Reliability
- **Status**: COMPLETE
- **Features Implemented**:
  - `EvaluationEngine` in `backend/app/audit/evaluation_engine.py`:
    - Measures 9 distinct audit dimensions: citation validity, evidence semantic support, unsupported claims, critical milestone coverage, contradiction awareness, uncertainty calibration, counterfactual consistency, isolated ground-truth benchmark, and reproducibility.
    - Explicit provenance tags for each metric (`DETERMINISTIC`, `RULE_BASED`, `GROUND_TRUTH_BENCHMARK`, `AI_ASSESSED`).
    - Ground truth isolation: `scenario.ground_truth` is strictly withheld from Gemma 4 investigative contexts and evaluated only in a separate post-hoc benchmark stage.
    - Actionable findings generation with severity ratings (`CRITICAL`, `WARNING`, `PASS`, `INFO`) and remediation guidance.
    - Transparent weighted composite score calculation with automatic status downgrade upon critical failure.
  - REST API endpoints:
    - `GET /api/scenarios/{id}/scorecard`
    - `POST /api/scenarios/{id}/scorecard/evaluate`
  - Frontend workspace component `ScorecardView.jsx`:
    - Overall fidelity score banner with critical failure / warning indicators.
    - 9 interactive component metric cards displaying percentages and provenance classification pills.
    - Collapsible transparent scoring formula breakdown.
    - Actionable findings table with severity filtering tabs (`ALL`, `CRITICAL`, `WARNING`, `PASS`, `INFO`) and clickable citation chips that locate events in the timeline and inspector.
    - Added to top navigation and main overview shell with direct access.
- **Tests & Verification**:
  - Backend: 7 automated tests in `backend/tests/test_evaluation_scorecard.py` (ground truth isolation, invalid citations, unsupported claims, uncertainty calibration, counterfactual consistency, repeatability, API endpoints).
  - Complete backend test suite: **23 / 23 tests PASSED**.
  - Frontend: 3 automated tests in `frontend/src/test/ScorecardView.test.jsx`.
  - Complete frontend test suite: **8 / 8 tests PASSED**.
  - Production build: `npx vite build` succeeded cleanly with 0 errors.

### Phase 8: Product Polish and Final Local Verification
- **Status**: COMPLETE
- **Bugs Fixed**:
  - **CyberLink.jsx memory leak**: `new THREE.Line(geometry, material)` was called inside JSX render, creating new GPU objects on every frame. Fixed by wrapping both geometry, material, and the `THREE.Line` object itself in `useMemo`, and disposing resources on unmount via `useEffect`.
  - **App.jsx timeline stale-closure race**: `onSelectIndex` handler computed `newIndex` via an updater function but then read the stale pre-update `currentTimelineIndex` value to call `setSelectedEventId`. Fixed by computing `newIndex` first and using it for both setters.
  - **Overview stat defaults**: Replaced incorrect `|| 10`, `|| 8`, `|| 9`, `|| 2` fallbacks (which showed fake data while loading) with `?? '—'` to display an em-dash pending fetch.
  - **ScorecardView loading state gap**: When `isLoading=true` and `scorecardData=null`, the component had no defined UI state and rendered an empty scaffold. Added an explicit loading state with spinner and heading.
- **UX Enhancements**:
  - **CyberWorld entity legend**: Added a type legend overlay (top-right) mapping entity type → color → label.
  - **CyberWorld active event badge**: Added a top-left badge showing the current event's ID, summary, and source/target entity IDs during timeline playback.
  - **CyberWorld link computation**: Replaced entirely hardcoded entity-pair link arrays with a zone-based spanning tree algorithm plus known cross-zone security pairs. Links now activate correctly for both src→dst and dst→src event directions.
  - **CyberWorld fill lighting**: Added a blue-tinted secondary point light for cyberpunk scene depth.
  - **ScorecardView auto-fetch**: Added a `useEffect` in `App.jsx` that auto-triggers `handleRefreshScorecard()` the first time the scorecard tab is visited, eliminating a manual click step.
  - **App test updated**: Updated `App.test.jsx` to handle the new auto-fetch behavior using `waitFor` with multi-candidate state detection.
- **Documentation**:
  - `README.md`: Completely rewritten with comprehensive "How to Run" section (exact commands for backend/frontend/tests/build), environment config, 6-tab investigation workflow guide, phase completion table, and known limitations.
  - `docs/PROGRESS.md`: Marked Phase 8 COMPLETE with full change log.
- **Final Verification Results**:
  - **Backend tests**: `23 / 23 PASSED` in ~93s (hermetic, all AI calls mocked via pytest)
  - **Frontend tests**: `9 / 9 PASSED` in ~5.3s
  - **Production build**: `npx vite build` — clean, 0 errors (713ms, 1.26 MB JS expected for Three.js)
  - **Git commit**: `feat(phase-8): product polish, memory fix, UX enhancements, and final verification`

### AppSec Platform Refactoring & UX Modernization
- **Status**: COMPLETE
- **Core Product Re-alignment**:
  - Re-anchored CausalOps from an overwhelming post-compromise incident replay visualizer into a beginner-friendly, production-grade AI-powered Application Security (AppSec) platform.
  - Definitive user journey implemented end-to-end: `Connect codebase -> Analyze security -> Understand vulnerabilities -> Explore attack paths -> Generate fixes -> Verify the fixes`.
- **Backend Architecture & Features**:
  - `Safe ZIP Ingestion Engine` (`backend/app/analysis/repo_ingest.py`):
    - Strict Zip-Slip path-traversal prevention.
    - Automatic framework and multi-language stack detection.
  - `Deterministic AST/Regex Vulnerability Scanner` (`backend/app/analysis/code_scanner.py`):
    - Detects SQL Injection (CWE-89), Command Injection (CWE-78), Hardcoded Secrets (CWE-798), Path Traversal (CWE-22), Insecure CORS (CWE-942).
    - Captures file paths, line ranges, and exact source code evidence snippets.
  - `Architectural DAG Attack Graph Engine` (`backend/app/engine/codebase_attack_graph.py`):
    - Constructs directed graphs linking untrusted external clients -> API gateway routers -> vulnerable handler components -> compromised data sinks.
    - Generates 3D spatial coordinates compatible with the existing CyberWorld engine.
  - `Remediation & Sandbox Verification API` (`backend/app/api/codebase.py`):
    - `POST /api/codebase/projects/{id}/patch/generate`: Synthesizes evidence-grounded remediation patches with rationale and unified diffs.
    - `POST /api/codebase/projects/{id}/patch/verify`: Applies patches to an isolated sandbox and deterministically re-runs security checks, verifying that the vulnerable signature is eradicated.
  - `Authentication & Session API` (`backend/app/auth/auth_service.py` & `backend/app/api/auth.py`):
    - Secure PBKDF2 password hashing and HMAC-SHA256 session token management.
- **Frontend Architecture & UX**:
  - **Modern 5-Stage Primary Navigation**:
    1. **Welcome (`LandingPage.jsx`)**: Hero value proposition, trust badges, interactive 5-step workflow, and Quickstart/Demo triggers.
    2. **Codebase Scanner (`CodebaseScanner.jsx`)**: ZIP upload, demo project loader, severity breakdown, source snippet inspector, and seamless transitions to Attack Paths and Fixes.
    3. **Attack Paths (`AttackPathsView.jsx`)**: 3D CyberWorld architectural topography + 2D Causal Flow DAG with topological tiers (Client -> Router -> Handler -> Sink).
    4. **Fixes & Verification (`FixesView.jsx`)**: Review proposed AI patches, inspect unified diffs, require developer approval, and trigger sandbox re-verification.
    5. **Incident Forensics & Lab (`IncidentLabView.jsx`)**: Preserves all legacy incident investigation tools (3D Incident World, Causal Graph, Competing Hypotheses, Counterfactual Lab, and Audit Scorecard).
- **Final Verification Results**:
  - **Backend tests**: `30 / 30 PASSED` in ~4.0s (`pytest`)
  - **Frontend tests**: `15 / 15 PASSED` in ~7.1s (`vitest`)
  - **Production build**: `npx vite build` — clean, 0 errors (553ms)

### Routing, Page Structure & Strict Authentication Gating
- **Status**: COMPLETE
- **Architecture & User Flow Overhaul**:
  - Installed and configured `react-router-dom` (v7) with declarative routing and session guards.
  - **Public Homepage (`/`)**:
    - Dedicated public landing page explaining CausalOps with value proposition and trust metrics.
    - Public navigation bar without exposed dashboard tabs.
    - Direct CTAs to Sign In and Get Started.
  - **Dedicated Authentication Pages**:
    - `/login` (`LoginPage.jsx`): Credentials form with pre-configured analyst demo credentials hint, error handling, session persistence, and redirects to origin.
    - `/signup` (`SignupPage.jsx`): Account creation with username, optional email, password validation, and auto-onboarding redirect.
  - **Dedicated Onboarding (`/onboarding`)**:
    - Multi-step wizard guiding new users to select target architecture (Full Stack, Microservice, Utility) and connect a codebase via safe ZIP upload or 1-click ShopPulse demo loader.
  - **Protected Dashboard (`/dashboard/*`)**:
    - Route guard (`ProtectedRoute.jsx`): Blocks unauthenticated access and automatically redirects to `/login`.
    - Dedicated authenticated layout (`DashboardLayout.jsx`) with user profile chip, API/AI status, sign-out button, and primary navigation (`Overview`, `Codebase Scanner`, `Attack Paths`, `Fixes & Verification`, `Incident Forensics`).
    - Dedicated Overview page (`DashboardOverview.jsx`) presenting high-level security posture, severity breakdown, and workspace jump cards.
- **Verification Results**:
  - **Backend tests**: `30 / 30 PASSED` (`pytest`)
  - **Frontend tests**: `15 / 15 PASSED` (`vitest`)
  - **Production build**: `npx vite build` clean, 0 errors.
