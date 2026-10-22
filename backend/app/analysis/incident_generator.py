"""
backend/app/analysis/incident_generator.py
Generates a realistic, controlled incident simulation tied directly to the active project's
components, routes, and verified vulnerabilities.
"""
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from app.models.codebase_schemas import CodebaseScanResult, VulnerabilityFinding
from app.models.schemas import (
    Scenario,
    Entity,
    Event,
    EntityType,
    SecurityZone,
    EventSeverity,
    ScenarioGroundTruth,
)

def generate_incident_for_project(project: CodebaseScanResult) -> Scenario:
    """
    Synthesizes a cohesive, deterministic incident scenario mapped directly to the
    active project's real architecture and findings.
    """
    proj_id = project.project_id
    proj_name = project.project_name
    
    # 1. Map Project Entities
    entities: List[Entity] = []
    
    # Attacker / External Client
    attacker_entity = Entity(
        id=f"ent-ext-client-{proj_id}",
        name="External Adversary (Untrusted IP)",
        type=EntityType.USER,
        ip_address="198.51.100.42",
        zone=SecurityZone.DMZ,
        position_3d=[-4.5, 0.0, 2.0],
        attributes={"origin": "Public Internet", "threat_actor": f"Adversary-{proj_id[:8]}"}
    )
    entities.append(attacker_entity)
    
    # API Gateway / Router
    gateway_entity = Entity(
        id=f"ent-gateway-{proj_id}",
        name=f"{proj_name} Gateway Service",
        type=EntityType.SERVER,
        ip_address="10.0.1.15",
        zone=SecurityZone.DMZ,
        position_3d=[-1.5, 0.0, 0.0],
        attributes={"tier": "API Gateway", "framework": "FastAPI/Reverse Proxy"}
    )
    entities.append(gateway_entity)

    # Internal Auth Token / Identity Provider
    idp_entity = Entity(
        id=f"ent-idp-{proj_id}",
        name="Identity & Access Token Service",
        type=EntityType.IDENTITY_PROVIDER,
        ip_address="10.0.2.10",
        zone=SecurityZone.IDENTITY,
        position_3d=[0.0, 0.0, 3.5],
        attributes={"service": "JWT Token Authority", "algorithm": "HS256"}
    )
    entities.append(idp_entity)
    
    # Token Entity
    session_token_entity = Entity(
        id=f"tok-session-{proj_id}",
        name=f"Bearer-Token-{proj_id[:6]}",
        type=EntityType.SESSION_TOKEN,
        zone=SecurityZone.IDENTITY,
        position_3d=[0.0, 1.2, 1.8],
        attributes={"issued_to": "admin_service", "scope": "internal:all"}
    )
    entities.append(session_token_entity)

    # Component & Sink Entities for each finding
    for idx, f in enumerate(project.findings):
        y_pos = (idx - len(project.findings) / 2.0) * 2.0
        file_base = f.file_path.split("/")[-1]
        
        comp_ent = Entity(
            id=f"ent-comp-{f.id}",
            name=f"{file_base} Handler (L{f.line_start})",
            type=EntityType.PROCESS,
            zone=SecurityZone.PROD_INTERNAL,
            position_3d=[2.0, y_pos, 0.0],
            attributes={"file": f.file_path, "finding_id": f.id, "category": f.category.value}
        )
        entities.append(comp_ent)
        
        # Sink
        sink_name = "PostgreSQL DB" if f.category.value == "sql_injection" else (
            "System OS Shell" if f.category.value == "command_injection" else "Credential Keyring"
        )
        sink_type = EntityType.DATABASE if f.category.value == "sql_injection" else (
            EntityType.SERVER if f.category.value == "command_injection" else EntityType.IDENTITY_PROVIDER
        )
        sink_ent = Entity(
            id=f"ent-sink-{f.id}",
            name=f"{sink_name} ({f.id})",
            type=sink_type,
            zone=SecurityZone.PROD_INTERNAL,
            position_3d=[5.0, y_pos, 0.0],
            attributes={"target": sink_name, "cwe": f.cwe_id or "CWE-Unknown"}
        )
        entities.append(sink_ent)

    # 2. Chronological Security Events
    events: List[Event] = []
    base_time = "2026-10-19T10:00:00Z"
    
    # EVT-1: Initial Reconnaissance
    events.append(Event(
        id=f"EVT-{proj_id[:4]}-01",
        timestamp="2026-10-19T10:00:05Z",
        event_type="network_probe",
        source_entity_id=attacker_entity.id,
        target_entity_id=gateway_entity.id,
        severity=EventSeverity.INFO,
        summary=f"Automated security scanner probe directed at {proj_name} Gateway.",
        observable_data={"src_ip": "198.51.100.42", "path": "/api/v1/health", "method": "GET"}
    ))

    # EVT-2: Token extraction / authentication attempt
    events.append(Event(
        id=f"EVT-{proj_id[:4]}-02",
        timestamp="2026-10-19T10:01:15Z",
        event_type="auth_token_access",
        source_entity_id=attacker_entity.id,
        target_entity_id=session_token_entity.id,
        session_id=session_token_entity.id,
        severity=EventSeverity.HIGH,
        summary=f"Stolen session token {session_token_entity.id} utilized from external IP address.",
        observable_data={"token_id": session_token_entity.id, "subject": "admin_service"}
    ))

    # Create exploit event for each finding
    root_cause_ids = []
    causal_path = [events[0].id, events[1].id]
    
    for idx, f in enumerate(project.findings):
        evt_num = idx + 3
        evt_id = f"EVT-{proj_id[:4]}-{evt_num:02d}"
        comp_ent_id = f"ent-comp-{f.id}"
        sink_ent_id = f"ent-sink-{f.id}"
        
        is_fixed = f.finding_status.value == "VERIFIED_FIXED"
        severity = EventSeverity.LOW if is_fixed else EventSeverity.CRITICAL
        
        if not is_fixed and not root_cause_ids:
            root_cause_ids.append(evt_id)
        causal_path.append(evt_id)
        
        summary = (
            f"[RESOLVED] Blocked exploit attempt on {f.title} ({f.file_path}:{f.line_start})"
            if is_fixed
            else f"Adversary exploited {f.title} via gateway payload in {f.file_path}:{f.line_start}"
        )

        events.append(Event(
            id=evt_id,
            timestamp=f"2026-10-19T10:0{evt_num}:30Z",
            event_type="exploit_execution",
            source_entity_id=comp_ent_id,
            target_entity_id=sink_ent_id,
            session_id=session_token_entity.id,
            severity=severity,
            summary=summary,
            observable_data={
                "finding_id": f.id,
                "cwe": f.cwe_id,
                "file": f.file_path,
                "line": f.line_start,
                "status": f.finding_status.value
            }
        ))

    if not root_cause_ids and events:
        root_cause_ids.append(events[1].id)

    ground_truth = ScenarioGroundTruth(
        threat_actor=f"External Adversary ({proj_id})",
        initial_access_vector=f"API Gateway Route Traversal on {proj_name}",
        root_cause_event_ids=root_cause_ids,
        primary_causal_path=causal_path,
        critical_milestone_event_ids=[events[0].id, events[1].id] + [events[-1].id],
        valid_explanations=[
            f"Adversary exploited identified codebase vulnerabilities in {proj_name} to access protected sinks."
        ],
        invalid_explanations=[
            "Legitimate automated maintenance task",
            "Physical datacenter compromise"
        ]
    )

    scenario = Scenario(
        id=f"scenario-{proj_id}",
        title=f"Incident Simulation: {proj_name}",
        description=f"Controlled security incident simulation mapped directly to {proj_name} architecture and identified vulnerabilities.",
        severity=EventSeverity.CRITICAL if project.open_findings_count > 0 else EventSeverity.LOW,
        entities=entities,
        events=events,
        ground_truth=ground_truth,
        metadata={"project_id": proj_id, "generated_at": datetime.now(timezone.utc).isoformat()}
    )
    return scenario
