"""
backend/app/engine/codebase_attack_graph.py
Translates codebase architecture and vulnerability findings into a directed attack path graph (DAG)
connecting Entrypoints -> Routes -> Controllers/Services -> Vulnerable Sinks.
VERIFIED_FIXED findings produce severed (isActive=False) nodes and edges.
"""
import networkx as nx
from typing import List, Dict, Any, Tuple
from app.models.codebase_schemas import CodebaseScanResult, VulnerabilityFinding, FindingStatus

class CodebaseAttackGraphEngine:
    """
    Constructs a 3D/2D topological attack graph representing how an external attacker
    traverses application entrypoints to trigger verified codebase vulnerabilities.
    Severed paths (VERIFIED_FIXED) are marked isActive=False.
    """

    def build_attack_graph(self, scan_result: CodebaseScanResult) -> Dict[str, Any]:
        G = nx.DiGraph()
        nodes = []
        edges = []

        # 1. Entrypoint Node (Attacker / Client Web Browser)
        client_node = {
            "id": "node-attacker-client",
            "name": "External Client / Browser",
            "type": "user",
            "category": "entrypoint",
            "zone": "dmz",
            "position_3d": [-5.0, 0.0, 0.0],
            "description": "Public internet client sending untrusted requests",
            "isActive": True,
            "isSevered": False,
        }
        G.add_node(client_node["id"], **client_node)
        nodes.append(client_node)

        # 2. Add API Router Node
        router_node = {
            "id": "node-api-router",
            "name": f"{scan_result.project_name} Gateway",
            "type": "server",
            "category": "api_gateway",
            "zone": "dmz",
            "position_3d": [-1.5, 0.0, 0.0],
            "description": "HTTP Application entrypoint and router",
            "isActive": True,
            "isSevered": False,
        }
        G.add_node(router_node["id"], **router_node)
        nodes.append(router_node)

        # Edge from Attacker to Router (always active)
        e_client_router = {
            "id": "edge-client-to-router",
            "source": client_node["id"],
            "target": router_node["id"],
            "relationship_type": "network_socket_link",
            "rule_name": "HTTP_DISPATCH",
            "explanation": "Untrusted HTTP payloads dispatched to API router",
            "confidence": 1.0,
            "isActive": True,
            "isSevered": False,
            "isCritical": False,
        }
        G.add_edge(e_client_router["source"], e_client_router["target"], **e_client_router)
        edges.append(e_client_router)

        active_paths = 0
        severed_paths = 0

        # 3. For each finding, generate Vulnerable Component Node and Data Sink Node
        for idx, finding in enumerate(scan_result.findings):
            y_pos = (idx - len(scan_result.findings) / 2.0) * 2.0

            is_severed = finding.finding_status == FindingStatus.VERIFIED_FIXED
            if is_severed:
                severed_paths += 1
            else:
                active_paths += 1

            # Component node
            comp_node_id = f"node-comp-{finding.id}"
            comp_node = {
                "id": comp_node_id,
                "name": f"{finding.file_path.split('/')[-1]}:{finding.line_start}",
                "type": "process",
                "category": "vulnerable_component",
                "zone": "prod_internal",
                "position_3d": [2.0, y_pos, 0.0],
                "finding_id": finding.id,
                "finding_title": finding.title,
                "severity": finding.severity.value,
                "description": f"{finding.title} in {finding.file_path}",
                "isActive": not is_severed,
                "isSevered": is_severed,
                "finding_status": finding.finding_status.value,
                "source_location": getattr(finding, "source_location", None),
                "sink_location": getattr(finding, "sink_location", None),
                "detection_method": getattr(finding, "detection_method", None),
            }
            G.add_node(comp_node_id, **comp_node)
            nodes.append(comp_node)

            # Edge from Router to Vulnerable Component
            e_router_comp = {
                "id": f"edge-router-{finding.id}",
                "source": router_node["id"],
                "target": comp_node_id,
                "relationship_type": "process_parent_child",
                "rule_name": "ROUTE_HANDLER_INVOCATION",
                "explanation": f"API router routes request to handler {finding.file_path}:{finding.line_start}",
                "confidence": 1.0,
                "isActive": not is_severed,
                "isSevered": is_severed,
                "isCritical": not is_severed,
            }
            G.add_edge(e_router_comp["source"], e_router_comp["target"], **e_router_comp)
            edges.append(e_router_comp)

            # Sink Node (Database, OS Shell, Filesystem, CORS, or Credential Store)
            sink_id = f"node-sink-{finding.id}"
            if finding.category.value == "sql_injection":
                sink_type = "database"
                sink_name = "Database Query Sink (SQL Execution)"
            elif finding.category.value == "command_injection":
                sink_type = "server"
                sink_name = "Host OS Shell (os.system / subprocess)"
            elif finding.category.value == "path_traversal":
                sink_type = "server"
                sink_name = "Host Filesystem Access (open / send_file)"
            elif finding.category.value == "insecure_cors":
                sink_type = "network"
                sink_name = "Arbitrary Cross-Origin Client (Wildcard CORS)"
            else:
                sink_type = "identity_provider"
                sink_name = "Credential / Secret Store"

            sink_node = {
                "id": sink_id,
                "name": sink_name,
                "type": sink_type,
                "category": "compromised_sink",
                "zone": "prod_internal",
                "position_3d": [5.5, y_pos, 0.0],
                "description": f"Compromised destination for {finding.cwe_id or 'exploit'}",
                "isActive": not is_severed,
                "isSevered": is_severed,
                "finding_status": finding.finding_status.value,
                "source_location": getattr(finding, "source_location", None),
                "sink_location": getattr(finding, "sink_location", None),
                "detection_method": getattr(finding, "detection_method", None),
            }
            G.add_node(sink_id, **sink_node)
            nodes.append(sink_node)

            # Edge from Component to Sink
            e_comp_sink = {
                "id": f"edge-sink-{finding.id}",
                "source": comp_node_id,
                "target": sink_id,
                "relationship_type": "credential_use",
                "rule_name": "EXPLOIT_SINK_EXECUTION",
                "explanation": f"Unsanitized input triggers {finding.category.value} on {sink_name}",
                "confidence": 1.0,
                "isActive": not is_severed,
                "isSevered": is_severed,
                "isCritical": not is_severed,
            }
            G.add_edge(e_comp_sink["source"], e_comp_sink["target"], **e_comp_sink)
            edges.append(e_comp_sink)

        return {
            "project_id": scan_result.project_id,
            "nodes": nodes,
            "edges": edges,
            "metrics": {
                "node_count": G.number_of_nodes(),
                "edge_count": G.number_of_edges(),
                "critical_attack_paths": len(scan_result.findings),
                "active_attack_paths": active_paths,
                "severed_attack_paths": severed_paths,
            }
        }
