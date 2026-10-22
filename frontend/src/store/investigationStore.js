import { create } from 'zustand';
import {
  fetchCurrentUser,
  fetchProjectScan,
  fetchProjectScenario,
  fetchScenarioCausalGraph,
  fetchProjectsSummary,
  fetchGitHubStatus,
} from '../api/client';

export const useInvestigationStore = create((set, get) => ({
  // Active Project (The SINGLE source of truth for the entire application)
  activeProjectId: localStorage.getItem('causalops_active_project_id') || null,
  userProjects: [],
  isLoadingProjects: false,
  codebaseScanResult: null,
  isScanningCodebase: false,
  codebaseScanError: null,
  activeFindingId: null,

  // Active Project Incident Scenario & Simulation
  scenario: null,
  isLoadingScenario: false,
  scenarioError: null,

  // Playback & Timeline
  playbackState: 'paused', // 'playing' | 'paused'
  playbackSpeed: 1.0,
  currentTimelineIndex: 0,
  selectedEventId: null,
  selectedEntityId: null,

  // Causal Graph (derived from active project scenario)
  graphData: null,
  isLoadingGraph: false,
  graphError: null,

  // Competing Hypotheses
  hypothesesData: null,
  isLoadingHypotheses: false,
  hypothesesError: null,

  // Active Navigation Tab
  activeTab: 'cyber_world', // 'cyber_world' | 'causal_graph' | 'hypotheses' | 'counterfactual' | 'scorecard'

  // Counterfactual Lab
  activeExperiment: null,
  isExecutingMutation: false,
  counterfactualResult: null,
  counterfactualError: null,

  // Evaluation Scorecard
  scorecardData: null,
  isLoadingScorecard: false,
  scorecardError: null,

  // Authentication & Onboarding
  authToken: localStorage.getItem('causalops_auth_token') || null,
  currentUser: null,
  isAuthChecking: Boolean(localStorage.getItem('causalops_auth_token')),
  isAuthModalOpen: false,
  authModalMode: 'login',
  hasCompletedOnboarding: localStorage.getItem('causalops_onboarded') === 'true',
  isOnboardingModalOpen: false,

  // GitHub Connection State
  githubStatus: null,
  isLoadingGitHubStatus: false,
  checkGitHubStatus: async () => {
    try {
      set({ isLoadingGitHubStatus: true });
      const status = await fetchGitHubStatus();
      set({ githubStatus: status, isLoadingGitHubStatus: false });
      return status;
    } catch {
      const fallback = { connected: false, github_login: null, token_hint: null, scopes: [] };
      set({ githubStatus: fallback, isLoadingGitHubStatus: false });
      return fallback;
    }
  },

  // ─── Actions ───────────────────────────────────────────────────────────────
  setActiveTab: (tab) => set({ activeTab: tab }),
  setSelectedEventId: (eventId) => set({ selectedEventId: eventId }),
  setSelectedEntityId: (entityId) => set({ selectedEntityId: entityId }),
  setPlaybackState: (state) => set({ playbackState: state }),
  setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),
  setCurrentTimelineIndex: (index) => set({ currentTimelineIndex: index }),
  setScenario: (scenario) => set({
    scenario,
    isLoadingScenario: false,
    selectedEventId: scenario?.events?.[0]?.id || null,
    currentTimelineIndex: 0,
  }),
  setIsLoadingScenario: (loading) => set({ isLoadingScenario: loading }),
  setGraphData: (graphData) => set({ graphData, isLoadingGraph: false }),
  setIsLoadingGraph: (loading) => set({ isLoadingGraph: loading }),
  setHypothesesData: (data) => set({ hypothesesData: data, isLoadingHypotheses: false, hypothesesError: null }),
  setIsLoadingHypotheses: (loading) => set({ isLoadingHypotheses: loading }),
  setHypothesesError: (err) => set({ hypothesesError: err, isLoadingHypotheses: false }),
  setCounterfactualResult: (res) => set({ counterfactualResult: res, isExecutingMutation: false, counterfactualError: null }),
  setIsExecutingMutation: (loading) => set({ isExecutingMutation: loading }),
  setCounterfactualError: (err) => set({ counterfactualError: err, isExecutingMutation: false }),
  clearCounterfactual: () => set({ counterfactualResult: null, counterfactualError: null, isExecutingMutation: false }),
  setScorecardData: (data) => set({ scorecardData: data, isLoadingScorecard: false, scorecardError: null }),
  setIsLoadingScorecard: (loading) => set({ isLoadingScorecard: loading }),
  setScorecardError: (err) => set({ scorecardError: err, isLoadingScorecard: false }),

  // Fetch all persisted projects for current user
  fetchUserProjects: async (owner = null) => {
    set({ isLoadingProjects: true });
    try {
      const projects = await fetchProjectsSummary(owner);
      set({ userProjects: projects, isLoadingProjects: false });
      return projects;
    } catch (err) {
      console.error('Failed to fetch user projects:', err);
      set({ isLoadingProjects: false });
      return [];
    }
  },

  // Load / Switch Active Project and synchronize all 5 features to it
  loadProjectData: async (projectId) => {
    if (!projectId) return;
    set({
      activeProjectId: projectId,
      isLoadingScenario: true,
      isLoadingGraph: true,
      hypothesesData: null,
      scorecardData: null,
      counterfactualResult: null,
    });
    localStorage.setItem('causalops_active_project_id', projectId);

    try {
      // Fetch scan, scenario, and causal graph concurrently for maximum responsiveness
      const [scan, scenario, graph] = await Promise.all([
        fetchProjectScan(projectId),
        fetchProjectScenario(projectId).catch((err) => {
          console.warn('Scenario fetch non-critical fallback:', err);
          return null;
        }),
        fetchScenarioCausalGraph(projectId).catch((err) => {
          console.warn('Graph fetch non-critical fallback:', err);
          return null;
        }),
      ]);

      // Guard against race condition if user switched active project during async fetch
      if (get().activeProjectId !== projectId) return;

      set({
        codebaseScanResult: scan,
        activeFindingId: scan?.findings?.[0]?.id || null,
        isScanningCodebase: false,
        scenario: scenario,
        isLoadingScenario: false,
        selectedEventId: scenario?.events?.[0]?.id || null,
        currentTimelineIndex: 0,
        graphData: graph,
        isLoadingGraph: false,
      });
    } catch (err) {
      if (get().activeProjectId !== projectId) return;
      console.error('Failed to load project data:', err);
      set({
        isLoadingScenario: false,
        isLoadingGraph: false,
        scenarioError: err.message,
      });
    }
  },

  // Codebase Actions
  setCodebaseScanResult: (res) => {
    const projectId = res?.project_id || null;
    if (projectId) {
      localStorage.setItem('causalops_active_project_id', projectId);
      set({
        codebaseScanResult: res,
        isScanningCodebase: false,
        codebaseScanError: null,
        activeProjectId: projectId,
        activeFindingId: res.findings?.[0]?.id || null,
      });
      // Trigger synchronization of scenario and graph for this project
      get().loadProjectData(projectId);
    } else {
      localStorage.removeItem('causalops_active_project_id');
      set({
        codebaseScanResult: null,
        isScanningCodebase: false,
        codebaseScanError: null,
        activeProjectId: null,
        scenario: null,
        graphData: null,
      });
    }
  },

  clearCodebaseScan: () => {
    localStorage.removeItem('causalops_active_project_id');
    set({
      codebaseScanResult: null,
      activeProjectId: null,
      activeFindingId: null,
      scenario: null,
      graphData: null,
      hypothesesData: null,
      scorecardData: null,
      counterfactualResult: null,
    });
  },

  setIsScanningCodebase: (loading) => set({ isScanningCodebase: loading }),
  setCodebaseScanError: (err) => set({ codebaseScanError: err, isScanningCodebase: false }),
  setActiveFindingId: (findingId) => set({ activeFindingId: findingId }),

  // Update finding status and re-sync project scenario
  updateFindingStatus: (findingId, newStatus, fixedAt) => {
    const { codebaseScanResult, activeProjectId } = get();
    if (!codebaseScanResult) return;
    const updatedFindings = codebaseScanResult.findings.map(f =>
      f.id === findingId
        ? { ...f, finding_status: newStatus, ...(fixedAt ? { fixed_at: fixedAt } : {}) }
        : f
    );
    const fixedCount = updatedFindings.filter(f => f.finding_status === 'VERIFIED_FIXED').length;
    const openCount = updatedFindings.length - fixedCount;
    set({
      codebaseScanResult: {
        ...codebaseScanResult,
        findings: updatedFindings,
        fixed_findings_count: fixedCount,
        open_findings_count: openCount,
      }
    });

    // Re-fetch project scenario so events reflect the resolved status
    if (activeProjectId) {
      fetchProjectScenario(activeProjectId).then(scen => {
        set({ scenario: scen });
        fetchScenarioCausalGraph(activeProjectId).then(g => set({ graphData: g }));
      }).catch(() => {});
    }
  },

  // Auth & Onboarding Actions
  initAuth: async () => {
    const token = localStorage.getItem('causalops_auth_token');
    if (!token) {
      set({ isAuthChecking: false, currentUser: null, authToken: null });
      return;
    }
    try {
      const user = await fetchCurrentUser(token);
      set({ currentUser: user, authToken: token, isAuthChecking: false });

      // Restore active project from localStorage
      const savedProjectId = localStorage.getItem('causalops_active_project_id');
      if (savedProjectId) {
        await get().loadProjectData(savedProjectId);
      }
      get().checkGitHubStatus().catch(() => {});
    } catch {
      localStorage.removeItem('causalops_auth_token');
      set({ currentUser: null, authToken: null, isAuthChecking: false, githubStatus: null });
    }
  },

  setAuthSession: (token, user) => {
    if (token) localStorage.setItem('causalops_auth_token', token);
    else localStorage.removeItem('causalops_auth_token');
    set({ authToken: token, currentUser: user, isAuthChecking: false, isAuthModalOpen: false });
    if (token) get().checkGitHubStatus().catch(() => {});
  },

  logout: () => {
    localStorage.removeItem('causalops_auth_token');
    set({
      authToken: null,
      currentUser: null,
      isAuthChecking: false,
      activeProjectId: null,
      codebaseScanResult: null,
      scenario: null,
      graphData: null,
      githubStatus: null,
    });
  },

  openAuthModal: (mode = 'login') => set({ isAuthModalOpen: true, authModalMode: mode }),
  closeAuthModal: () => set({ isAuthModalOpen: false }),
  completeOnboarding: () => {
    localStorage.setItem('causalops_onboarded', 'true');
    set({ hasCompletedOnboarding: true, isOnboardingModalOpen: false });
  },
  openOnboardingModal: () => set({ isOnboardingModalOpen: true }),
  closeOnboardingModal: () => set({ isOnboardingModalOpen: false }),
}));
