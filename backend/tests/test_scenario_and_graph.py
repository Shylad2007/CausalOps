from fastapi.testclient import TestClient
from main import app
from app.engine.deterministic_graph import DeterministicGraphEngine
from app.scenarios.repository import ScenarioRepository

client = TestClient(app)

def test_list_scenarios():
    response = client.get("/api/scenarios")
    assert response.status_code == 200
    scenarios = response.json()
    assert len(scenarios) >= 1
    assert scenarios[0]["id"] == "scenario-apt-solar-infiltrate"

def test_get_scenario_details():
    response = client.get("/api/scenarios/scenario-apt-solar-infiltrate")
    assert response.status_code == 200
    data = response.json()
    assert len(data["entities"]) == 8
    assert len(data["events"]) == 10
    assert data["ground_truth"]["threat_actor"] == "UNC-4192 (Financial Data Exfiltration Group)"

def test_deterministic_graph_generation():
    response = client.get("/api/scenarios/scenario-apt-solar-infiltrate/graph")
    assert response.status_code == 200
    graph = response.json()
    assert graph["scenario_id"] == "scenario-apt-solar-infiltrate"
    assert len(graph["nodes"]) == 10
    assert len(graph["edges"]) >= 6

    # Verify rule names and provenance
    rule_names = {edge["rule_name"] for edge in graph["edges"]}
    assert "RuleProcessLineage" in rule_names
    assert "RuleSessionContinuity" in rule_names
    assert "RuleNetworkDispatch" in rule_names

def test_graph_determinism():
    repo = ScenarioRepository()
    scenario = repo.get_scenario("scenario-apt-solar-infiltrate")
    engine = DeterministicGraphEngine()

    G1, rels1 = engine.build_graph(scenario)
    G2, rels2 = engine.build_graph(scenario)

    assert G1.number_of_nodes() == G2.number_of_nodes()
    assert G1.number_of_edges() == G2.number_of_edges()
    assert [r.id for r in rels1] == [r.id for r in rels2]
