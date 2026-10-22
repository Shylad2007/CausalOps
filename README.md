# CausalOps

> **A Causal Intelligence Engine for Incident Reconstruction and Counterfactual Investigation**  
> *Connect the evidence. Reconstruct the incident. Challenge the cause.*

CausalOps is an interactive, evidence-grounded cybersecurity incident investigation platform combining deterministic causal graph computation, 3D cyber-environment visualization, competing hypothesis evaluation, controlled counterfactual experimentation, and automated audit scorecards.

---

## Core Pillars & Differentiators

1. **Deterministic Causal Event Graph**: Computed via explicit causal & structural rules in Python (`NetworkX`), strictly separating recorded telemetry facts from deterministic correlations and inferred causal hypotheses.
2. **Interactive 3D Cyber World & Incident Replay**: Built with Three.js (`React Three Fiber` / `drei`), rendering simulated network entities (identities, workstations, servers, cloud infrastructure, processes) synchronized with the incident timeline.
3. **Competing Hypotheses & Evidence**: Evidence-grounded competing hypotheses (supported and contradicted by explicit event IDs) assisted by Gemma 4 inference with deterministic validation.
4. **Counterfactual Investigation Lab**: Controlled interventions (removing or modifying events) that trigger backend re-execution of the causal graph, isolating differential impact and testing investigative assertions without altering baseline state.
5. **Evidence Audit & Investigation Scorecard**: Automated evaluation measuring claim grounding, evidence validity, contradiction handling, and fidelity against known ground truth.

---

## Tech Stack

- **Frontend**: React (JavaScript), Vite, Tailwind CSS, Three.js, React Three Fiber (`@react-three/fiber`), `@react-three/drei`, Lucide Icons, Zustand.
- **Backend**: Python 3.14+, FastAPI, Pydantic v2, NetworkX, Uvicorn.
- **AI / LLM**: Gemma 4 integration via structured inference endpoints, validated backend-only with deterministic fallbacks.
- **Testing**: Pytest (backend), Vitest & React Testing Library (frontend).

---

## Project Structure

```
CausalOps/
├── backend/
│   ├── app/
│   │   ├── api/           # FastAPI route endpoints
│   │   ├── engine/        # Deterministic graph builder & counterfactual lab
│   │   ├── models/        # Pydantic schemas (events, relationships, hypotheses)
│   │   ├── ai/            # Gemma 4 service client & prompt engine
│   │   ├── scenarios/     # Predefined incident scenario JSONs & ground truth
│   │   └── audit/         # Scorecard & evidence validation engine
│   ├── tests/             # Pytest test suite
│   ├── requirements.txt
│   └── main.py
├── frontend/
│   ├── src/
│   │   ├── components/    # 3D Cyber Scene, Timeline, Graph Viewer, Inspector
│   │   ├── store/         # Zustand global state (scenario, playback, active filters)
│   │   ├── api/           # Backend client service
│   │   └── App.jsx
│   ├── package.json
│   └── vite.config.js
├── docs/                  # Architectural specs, API contracts, execution progress
└── README.md
```

---

## How to Run Locally

### Prerequisites
- Node.js >= 18 (Tested on v24.14.0)
- Python >= 3.10 (Tested on Python 3.14.3)
- A `backend/.env` file with `GEMMA_API_KEY` and `GEMMA_MODEL_NAME` (never commit this file)

### 1. Backend

```powershell
# From the repo root
cd backend

# Create and activate the virtual environment
python -m venv venv
.\venv\Scripts\activate        # Windows PowerShell
# source venv/bin/activate      # Linux / macOS

# Install dependencies
pip install -r requirements.txt

# Start the API server (runs on http://localhost:8000)
uvicorn main:app --reload --port 8000
```

### 2. Frontend

```powershell
# In a separate terminal, from the repo root
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173** in your browser.

> The Vite dev server proxies all `/api` requests to `http://localhost:8000`, so both services must be running simultaneously.

---

## Running Tests

### Backend (pytest — all 23 tests, hermetic with mocks)

```powershell
# From the repo root
.\backend\venv\Scripts\pytest.exe -v
```

### Frontend (vitest — all 9 tests)

```powershell
# From frontend/
cd frontend
npx vitest run
```

### Production Build

```powershell
# From frontend/
npx vite build
```

---

## Environment Configuration

Create `backend/.env` with:

```
GEMMA_API_KEY=your_google_ai_api_key
GEMMA_MODEL_NAME=gemma-4-26b-a4b-it
```

> **Security**: `.gitignore` already excludes `backend/.env`. Never commit this file.  
> If Gemma 4 is unavailable, all AI-dependent endpoints return deterministic fallback responses automatically.

---

## Investigation Workflow

1. **Overview** — Inspect the incident scenario summary with live stats from the backend.
2. **3D Cyber World** — Navigate the 3D network topology; use the timeline scrubber to replay events chronologically. Active nodes and links highlight in real time.
3. **Causal Event Graph** — Inspect the deterministic NetworkX DAG: upstream causes, downstream effects, and edge rule provenance for each selected event.
4. **Competing Hypotheses** — Trigger Gemma 4 structured inference to generate multi-angle forensic hypotheses grounded in event IDs; challenge any hypothesis interactively.
5. **Counterfactual Lab** — Remove or mutate events on an isolated copy of the scenario, recompute the graph, and observe deterministic downstream diffs and Gemma 4 reassessment.
6. **Audit Scorecard** — Run the deterministic evidence audit: citation validity, semantic support, uncertainty calibration, counterfactual consistency, and isolated ground-truth benchmark fidelity.

---

## Phase Completion Status

| Phase | Description | Status |
|---|---|---|
| Phase 0 | Repository Audit and Project Blueprint | **COMPLETE** |
| Phase 1 | Working Application Foundation | **COMPLETE** |
| Phase 2 | Scenario Engine and Deterministic Causal Graph | **COMPLETE** |
| Phase 3 | Interactive 3D Cyber World and Replay | **COMPLETE** |
| Phase 4 | Causal Investigation Workspace and Evidence Audit | **COMPLETE** |
| Phase 5 | Gemma 4 Integration | **COMPLETE** |
| Phase 6 | Counterfactual Investigation Lab | **COMPLETE** |
| Phase 7 | Evaluation, Scorecard, and Reliability | **COMPLETE** |
| Phase 8 | Product Polish and Final Local Verification | **COMPLETE** |

---

## Known Limitations

- The large bundle size warning from `vite build` (~1.2 MB JS) is expected — Three.js accounts for the majority. Code splitting can be added in a future phase.
- The `THREE_CJS_DEPRECATED` warning in frontend tests is a transitive `three` library issue, not a project defect.
- Gemma 4 responses may vary by network latency; all endpoints have deterministic fallbacks.
- The scenario currently uses a single built-in incident (`scenario-apt-solar-infiltrate`). Multi-scenario loading is planned for a future phase.
