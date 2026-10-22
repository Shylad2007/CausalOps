import networkx as nx
from typing import List, Dict, Any, Tuple
from app.models.schemas import Scenario, Event, Relationship, RelationshipType, ProvenanceType

class DeterministicGraphEngine:
    """
    Computes a deterministic causal event graph from structured scenario events
    using explicit security telemetry rules.
    """
    def __init__(self):
        pass

    def build_graph(self, scenario: Scenario) -> Tuple[nx.DiGraph, List[Relationship]]:
        G = nx.DiGraph()
        relationships: List[Relationship] = []

        # Sort events chronologically to guarantee temporal causality
        sorted_events: List[Event] = sorted(scenario.events, key=lambda e: e.timestamp)
        event_dict: Dict[str, Event] = {e.id: e for e in sorted_events}

        # Add all event nodes
        for e in sorted_events:
            G.add_node(
                e.id,
                timestamp=e.timestamp,
                event_type=e.event_type,
                severity=e.severity,
                source_entity_id=e.source_entity_id,
                target_entity_id=e.target_entity_id,
                summary=e.summary
            )

        # Rule 1: Process Lineage (PPID -> PID on same host)
        # If Event A spawned PID X and Event B was executed with PPID X
        pid_spawners: Dict[str, Dict[int, str]] = {} # host -> {pid: event_id}
        for e in sorted_events:
            host = e.source_entity_id
            if host not in pid_spawners:
                pid_spawners[host] = {}

            if e.process_lineage:
                ppid = e.process_lineage.ppid
                pid = e.process_lineage.pid

                if ppid in pid_spawners[host]:
                    parent_event_id = pid_spawners[host][ppid]
                    rel = Relationship(
                        id=f"rel-proc-{parent_event_id}-{e.id}",
                        source_event_id=parent_event_id,
                        target_event_id=e.id,
                        relationship_type=RelationshipType.PROCESS_PARENT_CHILD,
                        provenance=ProvenanceType.DETERMINISTIC_RULE,
                        rule_name="RuleProcessLineage",
                        explanation=f"Process on host '{host}' (PID {pid}) was spawned by parent process (PPID {ppid}) initiated in {parent_event_id}.",
                        confidence=1.0
                    )
                    relationships.append(rel)
                    G.add_edge(parent_event_id, e.id, relationship=rel)

                pid_spawners[host][pid] = e.id

        # Rule 2: Token / Session Continuity
        # Token Minting / Theft -> subsequent actions using that session_id
        token_sources: Dict[str, str] = {} # token_id -> source_event_id
        for e in sorted_events:
            # Check if event creates or extracts a token
            if e.event_type == "token_mint" and e.session_id:
                token_sources[e.session_id] = e.id
            elif e.event_type == "file_access" and e.observable_data.get("extracted_token"):
                extracted = e.observable_data["extracted_token"]
                token_sources[extracted] = e.id

            # If an event uses this token and is not the source itself
            if e.session_id and e.session_id in token_sources:
                src_id = token_sources[e.session_id]
                if src_id != e.id:
                    rel_id = f"rel-token-{src_id}-{e.id}"
                    # Avoid duplicate edge
                    if not G.has_edge(src_id, e.id):
                        rel = Relationship(
                            id=rel_id,
                            source_event_id=src_id,
                            target_event_id=e.id,
                            relationship_type=RelationshipType.SESSION_CONTINUITY,
                            provenance=ProvenanceType.DETERMINISTIC_RULE,
                            rule_name="RuleSessionContinuity",
                            explanation=f"Event {e.id} utilized credential/token '{e.session_id}' directly established/compromised in event {src_id}.",
                            confidence=1.0
                        )
                        relationships.append(rel)
                        G.add_edge(src_id, e.id, relationship=rel)

        # Rule 3: Network Socket / Remote Dispatch
        # Network connect to a server followed by process spawn or execution on that target server within temporal window
        net_connects: List[Event] = [e for e in sorted_events if e.event_type == "network_connect"]
        for net_evt in net_connects:
            target_host = net_evt.target_entity_id
            for e in sorted_events:
                if e.timestamp > net_evt.timestamp and e.source_entity_id == target_host:
                    # Direct session correlation or rapid downstream trigger
                    if e.session_id == net_evt.session_id:
                        if not G.has_edge(net_evt.id, e.id):
                            rel = Relationship(
                                id=f"rel-net-{net_evt.id}-{e.id}",
                                source_event_id=net_evt.id,
                                target_event_id=e.id,
                                relationship_type=RelationshipType.NETWORK_SOCKET_LINK,
                                provenance=ProvenanceType.DETERMINISTIC_RULE,
                                rule_name="RuleNetworkDispatch",
                                explanation=f"Remote network request from {net_evt.source_entity_id} to {target_host} ({net_evt.id}) initiated server-side activity in {e.id}.",
                                confidence=1.0
                            )
                            relationships.append(rel)
                            G.add_edge(net_evt.id, e.id, relationship=rel)

        return G, relationships

    def extract_metrics(self, G: nx.DiGraph) -> Dict[str, Any]:
        """Calculates topological metrics, root causes, and critical paths."""
        in_degrees = dict(G.in_degree())
        out_degrees = dict(G.out_degree())

        # Root causes: nodes with 0 in-degree and >0 out-degree
        root_causes = [n for n, deg in in_degrees.items() if deg == 0 and out_degrees.get(n, 0) > 0]
        # Terminus nodes: nodes with >0 in-degree and 0 out-degree
        leaf_nodes = [n for n, deg in out_degrees.items() if deg == 0 and in_degrees.get(n, 0) > 0]

        # Find paths from root causes to high severity leaf nodes
        critical_paths: List[List[str]] = []
        for root in root_causes:
            for leaf in leaf_nodes:
                try:
                    for path in nx.all_simple_paths(G, source=root, target=leaf, cutoff=10):
                        if len(path) >= 3:
                            critical_paths.append(path)
                except nx.NetworkXNoPath:
                    continue

        return {
            "node_count": G.number_of_nodes(),
            "edge_count": G.number_of_edges(),
            "root_cause_candidates": root_causes,
            "critical_paths": critical_paths[:5]
        }
