import '@testing-library/jest-dom';
import { vi } from 'vitest';
import * as THREE from 'three';

// Intercept Three.js Clock deprecation warning caused by @react-three/fiber dependency
if (typeof THREE.setConsoleFunction === 'function') {
  THREE.setConsoleFunction((type, message, ...params) => {
    if (typeof message === 'string' && message.includes('Clock: This module has been deprecated')) {
      return;
    }
    console[type](message, ...params);
  });
}

// Polyfill ResizeObserver for headless jsdom / React Three Fiber
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Global mock for fetch to handle relative URLs in vitest test environment
global.fetch = vi.fn(async (url, options = {}) => {
  const urlStr = String(url);

  if (urlStr.includes('/api/health')) {
    return {
      ok: true,
      status: 200,
      json: async () => ({ status: 'healthy', ai_status: 'connected' }),
    };
  }

  if (urlStr.includes('/api/auth/login') || urlStr.includes('/api/auth/register')) {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        token: 'analyst.mock-valid-signature-123456',
        user: { id: 'usr-analyst', username: 'analyst', email: 'analyst@causalops.local', created_at: Date.now() },
      }),
    };
  }

  if (urlStr.includes('/api/auth/me')) {
    const authHeader = options?.headers?.Authorization;
    if (authHeader && authHeader.includes('Bearer')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ id: 'usr-analyst', username: 'analyst', email: 'analyst@causalops.local', created_at: Date.now() }),
      };
    }
    return {
      ok: false,
      status: 401,
      json: async () => ({ detail: 'Invalid or expired session token.' }),
    };
  }

  if (urlStr.includes('/api/codebase/demo')) {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        project_id: 'proj-demo-shoppulse',
        project_name: 'ShopPulse-Ecommerce-API',
        is_demo: true,
        detected_languages: ['Python', 'JavaScript'],
        manifest: {
          project_name: 'ShopPulse-Ecommerce-API',
          detected_languages: ['Python', 'JavaScript'],
          detected_frameworks: ['FastAPI'],
          scanned_files: 28,
        },
        findings: [
          {
            id: 'VULN-001',
            title: 'Raw SQL String Concatenation in User Search',
            file_path: 'backend/api/routes/users.py',
            line_start: 38,
            line_end: 40,
            severity: 'critical',
            code_snippet: 'query = f"SELECT * FROM users WHERE username = \'{search_query}\'"',
            cwe_id: 'CWE-89',
            finding_status: 'OPEN',
          },
        ],
        total_findings: 1,
        critical_count: 1,
        high_count: 0,
        open_findings_count: 1,
        fixed_findings_count: 0,
        status: 'COMPLETED',
      }),
    };
  }

  // Project scenario endpoint (project-scoped simulation)
  if (urlStr.match(/\/api\/codebase\/projects\/[^/]+\/scenario\/simulate/)) {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        id: 'scenario-proj-demo-shoppulse',
        title: 'Incident Simulation: ShopPulse-Ecommerce-API',
        severity: 'critical',
        entities: [
          { id: 'ent-ext-client-proj-demo-shoppulse', name: 'External Adversary', type: 'user', zone: 'dmz', position_3d: [-4.5, 0, 2.0], attributes: {} },
          { id: 'ent-gateway-proj-demo-shoppulse', name: 'ShopPulse-Ecommerce-API Gateway Service', type: 'server', zone: 'dmz', position_3d: [-1.5, 0, 0], attributes: {} },
        ],
        events: [
          { id: 'EVT-DEMO-001', event_type: 'AUTH', timestamp: '2024-01-15T10:00:00Z', actor_entity_id: 'ent-ext-client-proj-demo-shoppulse', target_entity_id: 'ent-gateway-proj-demo-shoppulse', severity: 'info', summary: 'Initial probe request', observable_data: {} },
        ],
        ground_truth: { root_cause_event_ids: ['EVT-DEMO-001'], primary_causal_path: [] },
        metadata: { project_id: 'proj-demo-shoppulse' },
      }),
    };
  }

  // GET project scenario
  if (urlStr.match(/\/api\/codebase\/projects\/[^/]+\/scenario$/)) {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        id: 'scenario-proj-demo-shoppulse',
        title: 'Incident Simulation: ShopPulse-Ecommerce-API',
        severity: 'critical',
        entities: [
          { id: 'ent-ext-client-proj-demo-shoppulse', name: 'External Adversary', type: 'user', zone: 'dmz', position_3d: [-4.5, 0, 2.0], attributes: {} },
          { id: 'ent-gateway-proj-demo-shoppulse', name: 'ShopPulse-Ecommerce-API Gateway Service', type: 'server', zone: 'dmz', position_3d: [-1.5, 0, 0], attributes: {} },
        ],
        events: [
          { id: 'EVT-DEMO-001', event_type: 'AUTH', timestamp: '2024-01-15T10:00:00Z', actor_entity_id: 'ent-ext-client-proj-demo-shoppulse', target_entity_id: 'ent-gateway-proj-demo-shoppulse', severity: 'info', summary: 'Initial probe request', observable_data: {} },
        ],
        ground_truth: { root_cause_event_ids: ['EVT-DEMO-001'], primary_causal_path: [] },
        metadata: { project_id: 'proj-demo-shoppulse', ground_truth_root_cause_event_ids: ['EVT-DEMO-001'] },
      }),
    };
  }

  // Project scan endpoint
  if (urlStr.match(/\/api\/codebase\/projects\/[^/]+$/) && !urlStr.includes('/summary') && !urlStr.includes('/graph') && !urlStr.includes('/patch') && !urlStr.includes('/remediation') && !urlStr.includes('/scenario')) {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        project_id: 'proj-demo-shoppulse',
        project_name: 'ShopPulse-Ecommerce-API',
        is_demo: true,
        detected_languages: ['Python', 'JavaScript'],
        manifest: {
          project_name: 'ShopPulse-Ecommerce-API',
          detected_languages: ['Python', 'JavaScript'],
          detected_frameworks: ['FastAPI'],
          scanned_files: 28,
        },
        findings: [],
        total_findings: 0,
        critical_count: 0,
        high_count: 0,
        open_findings_count: 0,
        fixed_findings_count: 0,
        status: 'COMPLETED',
      }),
    };
  }

  if (urlStr.includes('/api/codebase/projects/summary')) {
    return {
      ok: true,
      status: 200,
      json: async () => [
        {
          project_id: 'proj-demo-shoppulse',
          project_name: 'ShopPulse-Ecommerce-API',
          is_demo: true,
          total_findings: 1,
          open_findings_count: 1,
          fixed_findings_count: 0,
          critical_count: 1,
          high_count: 0,
          medium_count: 0,
          low_count: 0,
          scan_timestamp: '2026-10-19T10:00:00Z',
          status: 'COMPLETED',
          detected_languages: ['Python', 'JavaScript'],
          detected_frameworks: ['FastAPI'],
        },
      ],
    };
  }

  if (urlStr.includes('/api/codebase/github/connect')) {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        project_id: 'proj-github-test',
        project_name: 'example-org/sample-vulnerable-service',
        repository_url: 'https://github.com/example-org/sample-vulnerable-service',
        branch: 'main',
        commit_sha: '9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b',
        is_demo: false,
        total_findings: 1,
        open_findings_count: 1,
        fixed_findings_count: 0,
        critical_count: 1,
        high_count: 0,
        medium_count: 0,
        low_count: 0,
        scan_timestamp: '2026-10-19T10:00:00Z',
        status: 'COMPLETED',
        findings: [
          {
            id: 'VULN-001',
            rule_id: 'RULE-SEC-001',
            category: 'sql_injection',
            severity: 'critical',
            title: 'Raw SQL String Concatenation with User Input',
            description: 'Constructing dynamic SQL queries via string formatting.',
            file_path: 'app/routes/users.py',
            line_start: 4,
            line_end: 4,
            code_snippet: 'query = f"SELECT * FROM users WHERE id = \'{uid}\'"',
            cwe_id: 'CWE-89',
            finding_status: 'OPEN',
            verified: true,
          },
        ],
      }),
    };
  }

  if (urlStr.endsWith('/api/codebase/projects')) {
    return {
      ok: true,
      status: 200,
      json: async () => ['proj-demo-shoppulse'],
    };
  }

  if (urlStr.includes('/remediation-history')) {
    return {
      ok: true,
      status: 200,
      json: async () => ({ project_id: 'proj-demo-shoppulse', history: [] }),
    };
  }

  if (urlStr.includes('/api/codebase/projects/') && urlStr.endsWith('/graph')) {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        project_id: 'proj-demo-shoppulse',
        nodes: [
          { id: 'node-attacker-client', name: 'External Client', category: 'entrypoint', zone: 'dmz', type: 'user', position_3d: [-5, 0, 0], isActive: true, isSevered: false },
          { id: 'node-api-router', name: 'Gateway', category: 'api_gateway', zone: 'dmz', type: 'server', position_3d: [-1.5, 0, 0], isActive: true, isSevered: false },
        ],
        edges: [
          { id: 'e1', source: 'node-attacker-client', target: 'node-api-router', relationship_type: 'network_socket_link', isActive: true, isSevered: false },
        ],
        metrics: { node_count: 2, edge_count: 1, critical_attack_paths: 1, active_attack_paths: 1, severed_attack_paths: 0 },
      }),
    };
  }

  if (urlStr.includes('/api/scenarios/') && urlStr.endsWith('/graph')) {
    return {
      ok: true,
      status: 200,
      json: async () => ({ nodes: [], edges: [], metrics: {} }),
    };
  }

  if (urlStr.includes('/api/scenarios/')) {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        id: 'scenario-proj-demo-shoppulse',
        title: 'Incident Simulation: ShopPulse-Ecommerce-API',
        severity: 'critical',
        entities: [],
        events: [],
        ground_truth: { root_cause_event_ids: [], primary_causal_path: [] },
        metadata: { project_id: 'proj-demo-shoppulse' },
      }),
    };
  }

  return {
    ok: true,
    status: 200,
    json: async () => ({}),
  };
});
