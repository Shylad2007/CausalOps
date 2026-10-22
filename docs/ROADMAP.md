# CausalOps — Phased Roadmap

| Phase | Title | Core Deliverables | Target Criteria |
|---|---|---|---|
| **Phase 0** | Repository Audit & Blueprint | Audit env, git init, docs (Spec, Arch, Roadmap, API, Decisions, Progress) | Docs in place, runtime compatibility verified |
| **Phase 1** | Application Foundation | FastAPI backend skeleton + React/Vite/Tailwind frontend shell, health check, Zustand store, basic test harness | Backend starts on :8000, Frontend on :5173, API ping succeeds, layout rendered |
| **Phase 2** | Scenario Engine & Deterministic Graph | Pydantic event/entity models, realistic incident scenario JSON, NetworkX deterministic graph builder, causality rules, unit tests | Deterministic graph computed with 100% test pass and repeatable edge generation |
| **Phase 3** | Interactive 3D Cyber World & Replay | Three.js (R3F/Drei) cyber scene, nodes/edges in 3D, timeline scrubber, playback controls, entity inspection synchronization | 3D scene renders nodes/links, playback updates timeline and highlights active 3D entities |
| **Phase 4** | Investigation Workspace & Evidence Audit | 2D/Causal Graph panel, upstream/downstream causal tracing, evidence inspector, recorded fact vs inference tags | Graph node selection traces cause/effect paths, evidence inspector displays event telemetry |
| **Phase 5** | Gemma 4 AI Integration (Gate) | *PAUSE FOR USER APPROVAL & CREDENTIALS CHECK*. Connect Gemma 4 structured inference, hypothesis generation, evidence grounding, challenge endpoint, deterministic fallback | Gemma 4 produces structured competing hypotheses with validated event citations |
| **Phase 6** | Counterfactual Investigation Lab | Scenario mutation API (`REMOVE_EVENT`, `MODIFY_EVENT`), recompute engine, graph diffing, hypothesis delta reassessment | Removing an event recalculates the graph, updates downstream effects, and flags broken causal chains |
| **Phase 7** | Evaluation, Scorecard & Reliability | Ground truth validation, scorecard metrics calculation, automated test suites (pytest + vitest) | Scorecard measures evidence validity, claim coverage, and counterfactual accuracy |
| **Phase 8** | Product Polish & Verification | Dark cyber aesthetic refinement, performance profiling, responsive layout, end-to-end demo verification | Smooth 60fps 3D navigation, zero unhandled errors in console, polished UX |
| **Phase 9** | Deployment Preparation | Production build verification, Dockerfile/Vercel configuration, deployment guide | Deployment-ready artifacts prepared (deployed upon user confirmation) |
