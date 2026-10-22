import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Activity,
  ShieldAlert,
  GitFork,
  Award,
  Wrench,
  LogOut,
  ShieldCheck,
  PlusCircle,
} from 'lucide-react';
import { useInvestigationStore } from '../store/investigationStore';
import { fetchHealth } from '../api/client';
import ConnectGitHubModal from './ConnectGitHubModal';

// Primary navigation — Remediation is second per product requirement
const NAV_ITEMS = [
  { to: '/dashboard/projects',       label: 'Dashboard',                icon: LayoutDashboard },
  { to: '/dashboard/fixes',          label: 'Remediation',              icon: Wrench          },
  { to: '/dashboard/investigation',  label: 'Investigation Workspace',  icon: Activity        },
  { to: '/dashboard/hypotheses',     label: 'Competing Hypotheses',     icon: ShieldAlert     },
  { to: '/dashboard/counterfactual', label: 'Counterfactual Lab',        icon: GitFork         },
  { to: '/dashboard/scorecard',      label: 'Investigation Scorecard',  icon: Award           },
];

export default function DashboardLayout() {
  const navigate = useNavigate();

  const {
    currentUser,
    logout,
  } = useInvestigationStore();

  const [backendStatus, setBackendStatus] = useState('checking');
  const [isGitHubModalOpen, setIsGitHubModalOpen] = useState(false);

  useEffect(() => {
    fetchHealth()
      .then((d) => setBackendStatus(d?.status === 'healthy' ? 'healthy' : 'offline'))
      .catch(() => setBackendStatus('offline'));
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', backgroundColor: 'var(--nd-bg-base)', color: 'var(--nd-text-primary)', fontFamily: 'var(--nd-font-sans)', overflow: 'hidden' }}>

      {/* ── Application Header ─────────────────────────────────────── */}
      <header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 'var(--nd-header-height)',
        padding: '0 16px',
        backgroundColor: 'var(--nd-bg-surface)',
        borderBottom: '1px solid var(--nd-border-default)',
        flexShrink: 0,
        gap: 8,
      }}>

        {/* Brand */}
        <NavLink
          to="/dashboard/projects"
          style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', flexShrink: 0 }}
        >
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 32, height: 32,
            backgroundColor: 'var(--nd-accent-subtle)',
            border: '1px solid var(--nd-accent-border)',
            borderRadius: 'var(--nd-radius-md)',
          }}>
            <ShieldCheck size={18} color="var(--nd-accent)" />
          </div>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--nd-text-primary)', letterSpacing: '0.06em' }}>
            CAUSALOPS
          </span>
        </NavLink>

        {/* Primary Navigation */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, justifyContent: 'center' }}>
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                padding: '7px 12px',
                borderRadius: 'var(--nd-radius-md)',
                fontSize: 13,
                fontWeight: isActive ? 600 : 500,
                color: isActive ? 'var(--nd-text-primary)' : 'var(--nd-text-secondary)',
                backgroundColor: isActive ? 'var(--nd-bg-hover)' : 'transparent',
                borderBottom: isActive ? '2px solid var(--nd-accent)' : '2px solid transparent',
                textDecoration: 'none',
                transition: 'color var(--nd-transition-fast), background-color var(--nd-transition-fast)',
                whiteSpace: 'nowrap',
              })}
            >
              <Icon size={16} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Right: status + user + logout */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          {/* Backend health dot */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} title={`Backend: ${backendStatus}`}>
            <span
              className={`nd-dot ${backendStatus === 'healthy' ? 'nd-dot-success nd-dot-pulse' : 'nd-dot-error'}`}
            />
            <span style={{ fontSize: 12, color: 'var(--nd-text-muted)', fontFamily: 'var(--nd-font-mono)' }}>
              {backendStatus === 'healthy' ? 'live' : 'offline'}
            </span>
          </div>

          {/* Username */}
          {currentUser && (
            <span style={{ fontSize: 12, fontFamily: 'var(--nd-font-mono)', color: 'var(--nd-text-code)' }}>
              {currentUser.username}
            </span>
          )}

          {/* Connect repo action */}
          <button
            onClick={() => setIsGitHubModalOpen(true)}
            title="Connect a GitHub repository"
            aria-label="Connect GitHub repository"
            id="header-connect-repo"
            className="nd-btn nd-btn-primary nd-btn-sm"
          >
            <PlusCircle size={14} />
            <span className="hidden sm:inline">Connect GitHub repository</span>
          </button>

          {/* Logout */}
          <button
            onClick={handleLogout}
            title="Sign Out"
            aria-label="Sign Out"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 12px',
              backgroundColor: 'transparent',
              border: '1px solid var(--nd-border-default)',
              borderRadius: 'var(--nd-radius-md)',
              color: 'var(--nd-text-muted)',
              fontSize: 12,
              cursor: 'pointer',
              transition: 'color var(--nd-transition-fast), border-color var(--nd-transition-fast)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--nd-critical)';
              e.currentTarget.style.borderColor = 'var(--nd-critical-border)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--nd-text-muted)';
              e.currentTarget.style.borderColor = 'var(--nd-border-default)';
            }}
          >
            <LogOut size={12} />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* ── Main Content ────────────────────────────────────────────── */}
      <main style={{ flex: 1, overflow: 'hidden', position: 'relative', display: 'flex' }}>
        <Outlet context={{ onOpenConnectModal: () => setIsGitHubModalOpen(true) }} />
      </main>



      {/* ── GitHub Connect Modal ──────────────────────────────────── */}
      <ConnectGitHubModal
        isOpen={isGitHubModalOpen}
        onClose={() => setIsGitHubModalOpen(false)}
      />
    </div>
  );
}
