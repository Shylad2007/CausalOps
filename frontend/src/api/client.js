const API_BASE = '/api';

export async function fetchHealth() {
  const res = await fetch(`${API_BASE}/health`);
  if (!res.ok) throw new Error(`Health check failed with status ${res.status}`);
  return res.json();
}

export async function fetchScenarios() {
  const res = await fetch(`${API_BASE}/scenarios`);
  if (!res.ok) throw new Error(`Failed to fetch scenarios`);
  return res.json();
}

export async function fetchScenario(id) {
  const res = await fetch(`${API_BASE}/scenarios/${id}`);
  if (!res.ok) throw new Error(`Failed to load scenario ${id}`);
  return res.json();
}

export async function fetchCausalGraph(scenarioId) {
  const res = await fetch(`${API_BASE}/scenarios/${scenarioId}/graph`);
  if (!res.ok) throw new Error(`Failed to fetch causal graph for ${scenarioId}`);
  return res.json();
}

export async function fetchScenarioCausalGraph(projectIdOrScenarioId) {
  const res = await fetch(`${API_BASE}/scenarios/${projectIdOrScenarioId}/graph`);
  if (!res.ok) throw new Error(`Failed to fetch causal graph for ${projectIdOrScenarioId}`);
  return res.json();
}

export async function fetchHypotheses(scenarioId) {
  const res = await fetch(`${API_BASE}/scenarios/${scenarioId}/hypotheses`);
  if (!res.ok) throw new Error(`Failed to evaluate hypotheses for ${scenarioId}`);
  return res.json();
}

export async function challengeHypothesis(scenarioId, hypothesisId, challenge) {
  const res = await fetch(`${API_BASE}/scenarios/${scenarioId}/hypotheses/challenge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hypothesis_id: hypothesisId, challenge }),
  });
  if (!res.ok) throw new Error(`Challenge request failed`);
  return res.json();
}

export async function runCounterfactual(scenarioId, mutation, includeAi = true) {
  const res = await fetch(`${API_BASE}/scenarios/${scenarioId}/counterfactual/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mutation,
      include_ai_reassessment: includeAi,
    }),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || `Counterfactual experiment failed (${res.status})`);
  }
  return res.json();
}

export async function fetchScorecard(scenarioId) {
  const res = await fetch(`${API_BASE}/scenarios/${scenarioId}/scorecard`);
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || `Failed to fetch scorecard (${res.status})`);
  }
  return res.json();
}

export async function evaluateScorecard(scenarioId, { hypotheses = null, counterfactuals = null } = {}) {
  const res = await fetch(`${API_BASE}/scenarios/${scenarioId}/scorecard/evaluate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hypotheses, counterfactuals }),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || `Failed to evaluate scorecard (${res.status})`);
  }
  return res.json();
}

// Codebase Analysis Endpoints
export async function fetchDemoCodebase() {
  const res = await fetch(`${API_BASE}/codebase/demo`);
  if (!res.ok) throw new Error(`Failed to load demo codebase scan`);
  return res.json();
}

export async function uploadAndScanZip(file, projectName = '') {
  const formData = new FormData();
  formData.append('file', file);
  if (projectName) {
    formData.append('project_name', projectName);
  }

  const res = await fetch(`${API_BASE}/codebase/scan/upload`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || `Codebase scan failed (${res.status})`);
  }
  return res.json();
}

export async function connectGitHubRepo({ repo_url, token = null, branch = null, commit_sha = null, project_name = null, owner_username = null }) {
  const headers = { 'Content-Type': 'application/json' };
  const authToken = localStorage.getItem('causalops_auth_token');
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

  const res = await fetch(`${API_BASE}/codebase/github/connect`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      repo_url,
      token: token ? token.trim() : null,
      branch: branch ? branch.trim() : null,
      commit_sha: commit_sha ? commit_sha.trim() : null,
      project_name: project_name ? project_name.trim() : null,
      owner_username,
    }),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || `GitHub connection failed (${res.status})`);
  }
  return res.json();
}

// Authentication Endpoints
export async function registerUser(username, password, email = null) {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, email }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Registration failed.');
  }
  return res.json();
}

export async function loginUser(username, password) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Login failed.');
  }
  return res.json();
}

export async function fetchCurrentUser(token) {
  const res = await fetch(`${API_BASE}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Session invalid or expired');
  return res.json();
}

// Attack Graph & Remediation Endpoints
export async function fetchCodebaseAttackGraph(projectId) {
  const res = await fetch(`${API_BASE}/codebase/projects/${projectId}/graph`);
  if (!res.ok) throw new Error(`Failed to load attack graph for ${projectId}`);
  return res.json();
}

export async function fetchProjectsList() {
  const res = await fetch(`${API_BASE}/codebase/projects`);
  if (!res.ok) throw new Error('Failed to fetch projects list');
  return res.json();
}

export async function fetchProjectsSummary(owner = null) {
  const url = owner
    ? `${API_BASE}/codebase/projects/summary?owner=${encodeURIComponent(owner)}`
    : `${API_BASE}/codebase/projects/summary`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch projects summary');
  return res.json();
}

export async function fetchProjectScan(projectId) {
  const res = await fetch(`${API_BASE}/codebase/projects/${projectId}`);
  if (!res.ok) throw new Error(`Failed to fetch project ${projectId}`);
  return res.json();
}

export async function fetchProjectScenario(projectId) {
  const res = await fetch(`${API_BASE}/codebase/projects/${projectId}/scenario`);
  if (!res.ok) throw new Error(`Failed to fetch incident scenario for ${projectId}`);
  return res.json();
}

export async function simulateProjectIncident(projectId) {
  const res = await fetch(`${API_BASE}/codebase/projects/${projectId}/scenario/simulate`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(`Failed to simulate incident for ${projectId}`);
  return res.json();
}

export async function fetchRemediationHistory(projectId) {
  const res = await fetch(`${API_BASE}/codebase/projects/${projectId}/remediation-history`);
  if (!res.ok) throw new Error(`Failed to fetch remediation history for ${projectId}`);
  return res.json();
}

export async function generateRemediationPatch(projectId, findingId) {
  const res = await fetch(`${API_BASE}/codebase/projects/${projectId}/patch/generate?finding_id=${findingId}`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(`Failed to generate remediation patch for ${findingId}`);
  return res.json();
}

export async function verifyRemediationPatch(projectId, findingId, proposedCode, filePath = null) {
  const payload = { finding_id: findingId, proposed_code: proposedCode };
  if (filePath) {
    payload.target_file = filePath;
    payload.file_path = filePath;
  }
  const res = await fetch(`${API_BASE}/codebase/projects/${projectId}/patch/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Patch verification failed`);
  return res.json();
}

export async function publishRemediationPR(projectId, { findingId, proposedCode = null, branchName = null, prTitle = null, prBody = null, githubToken = null }) {
  const headers = { 'Content-Type': 'application/json' };
  const token = localStorage.getItem('causalops_auth_token');
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}/codebase/projects/${projectId}/github/publish`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      finding_id: findingId,
      proposed_code: proposedCode,
      branch_name: branchName,
      pr_title: prTitle,
      pr_body: prBody,
      github_token: githubToken,
    }),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || `GitHub publishing failed (${res.status})`);
  }
  return res.json();
}

export async function syncGitHubRepository(projectId, { branch = null, pullRequestNumber = null, forceRescan = false, githubToken = null } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = localStorage.getItem('causalops_auth_token');
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}/codebase/projects/${projectId}/github/sync`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      branch,
      pull_request_number: pullRequestNumber,
      force_rescan: forceRescan,
      github_token: githubToken,
    }),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || `GitHub sync failed (${res.status})`);
  }
  return res.json();
}

// GitHub Credential Management Endpoints
export async function fetchGitHubStatus() {
  const headers = {};
  const token = localStorage.getItem('causalops_auth_token');
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}/github/status`, { headers });
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      return { connected: false, github_login: null, token_hint: null, scopes: [] };
    }
    throw new Error(`Failed to fetch GitHub status (${res.status})`);
  }
  return res.json();
}

export async function connectGitHubToken(personalAccessToken) {
  const headers = { 'Content-Type': 'application/json' };
  const token = localStorage.getItem('causalops_auth_token');
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}/github/connect`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ token: personalAccessToken }),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || `Failed to connect GitHub account (${res.status})`);
  }
  return res.json();
}

export async function disconnectGitHub() {
  const headers = {};
  const token = localStorage.getItem('causalops_auth_token');
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}/github/disconnect`, {
    method: 'DELETE',
    headers,
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || `Failed to disconnect GitHub (${res.status})`);
  }
  return res.json();
}

export async function fetchAuthorizedGitHubRepos() {
  const headers = {};
  const token = localStorage.getItem('causalops_auth_token');
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}/github/repos`, { headers });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || `Failed to fetch authorized repositories (${res.status})`);
  }
  return res.json();
}
