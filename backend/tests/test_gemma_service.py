import pytest
from unittest.mock import MagicMock, patch
from app.ai.gemma_service import GemmaService
from app.models.schemas import (
    Scenario,
    Event,
    Entity,
    SecurityZone,
    EntityType,
    EventSeverity,
    HypothesisStatus,
    HypothesisChallengeRequest
)

@pytest.fixture
def mock_scenario():
    return Scenario(
        id="test-scenario",
        title="Test Incident",
        description="Test incident for testing AI service",
        severity=EventSeverity.CRITICAL,
        entities=[
            Entity(id="host-1", name="Host 1", type=EntityType.WORKSTATION, zone=SecurityZone.WORKSTATION_VLAN)
        ],
        events=[
            Event(
                id="EVT-01",
                timestamp="2026-10-18T10:00:00Z",
                event_type="process_spawn",
                source_entity_id="host-1",
                severity=EventSeverity.HIGH,
                summary="cmd.exe executed"
            ),
            Event(
                id="EVT-02",
                timestamp="2026-10-18T10:01:00Z",
                event_type="network_connect",
                source_entity_id="host-1",
                severity=EventSeverity.CRITICAL,
                summary="beacon connection"
            )
        ]
    )

def test_deterministic_fallback_when_unconfigured(mock_scenario):
    with patch.dict("os.environ", {"GEMMA_API_KEY": ""}):
        service = GemmaService()
        assert not service.is_configured()
        res = service.generate_hypotheses(mock_scenario)
        assert res.source == "deterministic_fallback"
        assert len(res.hypotheses) >= 1
        # Check that supporting event IDs exist
        for hyp in res.hypotheses:
            for eid in hyp.supporting_event_ids:
                assert eid in {"EVT-01", "EVT-02"}

def test_gemma_model_response_validation_and_citation_filtering(mock_scenario):
    fake_json_output = """
    [
      {
        "id": "hyp-001",
        "title": "Phishing Infiltration",
        "description": "Attacker compromised host via email attachment",
        "supporting_event_ids": ["EVT-01", "EVT-9999"],
        "contradictory_event_ids": ["EVT-8888"],
        "assumptions": ["Payload executed cleanly"],
        "unresolved_questions": ["What was payload name?"],
        "investigation_status": "supported",
        "support_assessment": "Supported by process spawn",
        "recommended_steps": ["Check event logs"],
        "alternative_explanations": ["Admin test"]
      }
    ]
    """
    mock_client = MagicMock()
    mock_response = MagicMock()
    mock_response.text = fake_json_output
    mock_client.models.generate_content.return_value = mock_response

    service = GemmaService()
    service.api_key = "test-key"
    service._client = mock_client

    result = service.generate_hypotheses(mock_scenario)

    assert result.source == "gemma-4-26b-a4b-it"
    assert len(result.hypotheses) == 1
    hyp = result.hypotheses[0]

    # Valid citations kept
    assert "EVT-01" in hyp.supporting_event_ids
    # Nonexistent citations flagged and moved to unsupported
    assert "EVT-9999" not in hyp.supporting_event_ids
    assert "EVT-9999" in hyp.unsupported_event_ids
    assert "EVT-8888" in hyp.unsupported_event_ids
    assert len(result.audit_flags) >= 1

def test_gemma_malformed_response_triggers_graceful_fallback(mock_scenario):
    mock_client = MagicMock()
    mock_response = MagicMock()
    mock_response.text = "This is not valid json at all!"
    mock_client.models.generate_content.return_value = mock_response

    service = GemmaService()
    service.api_key = "test-key"
    service._client = mock_client

    result = service.generate_hypotheses(mock_scenario)
    assert result.source == "deterministic_fallback"
    assert len(result.hypotheses) >= 1

def test_hypothesis_challenge_flow(mock_scenario):
    challenge_json = """
    {
      "reassessment": "The challenge is valid because EVT-01 lacks parent PID",
      "updated_status": "disputed",
      "evidence_cited": ["EVT-01"]
    }
    """
    mock_client = MagicMock()
    mock_response = MagicMock()
    mock_response.text = challenge_json
    mock_client.models.generate_content.return_value = mock_response

    service = GemmaService()
    service.api_key = "test-key"
    service._client = mock_client

    req = HypothesisChallengeRequest(hypothesis_id="hyp-001", challenge="Was this an admin test?")
    res = service.challenge_hypothesis(mock_scenario, req)

    assert res.updated_status == HypothesisStatus.DISPUTED
    assert "EVT-01" in res.evidence_cited
    assert res.source == "gemma-4-26b-a4b-it"
