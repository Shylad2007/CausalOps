import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useInvestigationStore } from './store/investigationStore';
import LandingPage from './components/LandingPage';
import LoginPage from './components/LoginPage';
import SignupPage from './components/SignupPage';
import OnboardingPage from './components/OnboardingPage';
import ProtectedRoute from './components/ProtectedRoute';
import DashboardLayout from './components/DashboardLayout';
import ProjectDashboard from './components/ProjectDashboard';
import InvestigationWorkspace from './components/InvestigationWorkspace';
import HypothesesFeatureView from './components/HypothesesFeatureView';
import CounterfactualFeatureView from './components/CounterfactualFeatureView';
import ScorecardFeatureView from './components/ScorecardFeatureView';
import FixesView from './components/FixesView';

export default function App() {
  const { initAuth } = useInvestigationStore();

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  return (
    <BrowserRouter>
      <Routes>
        {/* 1. Public Routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />

        {/* 2. Protected Routes (require authenticated session) */}
        <Route element={<ProtectedRoute />}>
          <Route path="/onboarding" element={<Navigate to="/dashboard/projects" replace />} />
          <Route path="/dashboard" element={<DashboardLayout />}>
            {/* Phase 1: Show a proper project dashboard immediately after login */}
            <Route index element={<Navigate to="/dashboard/projects" replace />} />
            <Route path="projects" element={<ProjectDashboard />} />

            {/* Investigation Workspace grouping 3D & 2D */}
            <Route path="investigation" element={<InvestigationWorkspace />} />

            {/* Core Distinct Workspaces */}
            <Route path="hypotheses" element={<HypothesesFeatureView />} />
            <Route path="counterfactual" element={<CounterfactualFeatureView />} />
            <Route path="scorecard" element={<ScorecardFeatureView />} />
            <Route path="fixes" element={<FixesView />} />

            {/* Backward-compatibility aliases */}
            <Route path="cyber-world" element={<Navigate to="/dashboard/investigation" replace />} />
            <Route path="causal-graph" element={<Navigate to="/dashboard/investigation" replace />} />
            <Route path="overview" element={<Navigate to="/dashboard/projects" replace />} />
            <Route path="findings" element={<Navigate to="/dashboard/projects" replace />} />
            <Route path="attack-paths" element={<Navigate to="/dashboard/investigation" replace />} />
            <Route path="scanner" element={<Navigate to="/dashboard/projects" replace />} />
            <Route path="advanced" element={<Navigate to="/dashboard/hypotheses" replace />} />
            <Route path="forensics" element={<Navigate to="/dashboard/investigation" replace />} />
          </Route>
        </Route>

        {/* 3. Wildcard Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
