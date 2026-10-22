import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  ArrowRight,
  Code2,
  Wrench,
  CheckCircle2,
  LogOut,
  User,
} from 'lucide-react';
import { useInvestigationStore } from '../store/investigationStore';

export default function LandingPage() {
  const navigate = useNavigate();
  const { authToken, currentUser, logout } = useInvestigationStore();
  const isAuthenticated = Boolean(authToken && currentUser);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div style={{
      backgroundColor: 'var(--nd-bg-base)',
      color: 'var(--nd-text-primary)',
      fontFamily: 'var(--nd-font-sans)',
      minHeight: '100vh',
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      overflowX: 'hidden',
    }}>
      {/* ── 1. Navigation Bar ─────────────────────────────────────── */}
      <header style={{
        height: 'var(--nd-header-height)',
        backgroundColor: 'var(--nd-bg-surface)',
        borderBottom: '1px solid var(--nd-border-default)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 28px',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        backdropFilter: 'blur(8px)',
      }}>
        {/* Brand */}
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 32, height: 32,
            backgroundColor: 'var(--nd-accent-subtle)',
            border: '1px solid var(--nd-accent-border)',
            borderRadius: 'var(--nd-radius-md)',
            boxShadow: '0 0 10px rgba(59,130,246,0.2)',
          }}>
            <ShieldCheck size={18} color="var(--nd-accent)" />
          </div>
          <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: '0.04em', color: 'var(--nd-text-primary)' }}>
            CAUSALOPS
          </span>
          <span className="nd-badge nd-badge-info" style={{ fontSize: 10, padding: '2px 7px' }}>
            PLATFORM
          </span>
        </Link>

        {/* Auth Navigation */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {isAuthenticated ? (
            <>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px',
                backgroundColor: 'var(--nd-bg-elevated)',
                border: '1px solid var(--nd-border-subtle)',
                borderRadius: 'var(--nd-radius-md)',
                fontSize: 12,
                color: 'var(--nd-text-secondary)',
              }}>
                <User size={13} color="var(--nd-accent)" />
                <span className="nd-code">{currentUser.username}</span>
              </div>
              <Link
                to="/dashboard"
                className="nd-btn nd-btn-primary nd-btn-sm"
                style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <span>Open dashboard</span>
                <ArrowRight size={14} />
              </Link>
              <button
                onClick={handleLogout}
                className="nd-btn nd-btn-ghost nd-btn-sm"
                style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--nd-text-muted)', cursor: 'pointer' }}
                title="Sign out"
              >
                <LogOut size={14} />
                <span>Sign out</span>
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="nd-btn nd-btn-ghost nd-btn-sm"
                style={{ textDecoration: 'none', color: 'var(--nd-text-secondary)', fontWeight: 500 }}
              >
                Sign in
              </Link>
              <Link
                to="/signup"
                className="nd-btn nd-btn-primary nd-btn-sm"
                style={{ textDecoration: 'none', fontWeight: 600 }}
              >
                Get started
              </Link>
            </>
          )}
        </nav>
      </header>

      {/* ── 2. Hero Section ───────────────────────────────────────── */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <section style={{
          padding: '88px 24px 72px',
          textAlign: 'center',
          maxWidth: 860,
          margin: '0 auto',
          width: '100%',
          position: 'relative',
        }}>
          {/* Decorative glow orbs — purely visual, aria-hidden */}
          <div aria-hidden="true" className="nd-glow-orb" style={{
            width: 520,
            height: 320,
            background: 'radial-gradient(circle, rgba(59,130,246,0.13) 0%, transparent 70%)',
            top: -60,
            left: '50%',
            transform: 'translateX(-50%)',
            animationDelay: '0s',
          }} />
          <div aria-hidden="true" className="nd-glow-orb" style={{
            width: 280,
            height: 180,
            background: 'radial-gradient(circle, rgba(99,102,241,0.1) 0%, transparent 70%)',
            top: 40,
            right: '5%',
            animationDelay: '-4s',
            animationDuration: '16s',
          }} />

          {/* Eyebrow */}
          <div className="nd-animate-fade-up" style={{ marginBottom: 20 }}>
            <span className="nd-badge nd-badge-info" style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              padding: '4px 12px',
              borderRadius: 20,
            }}>
              Application Security Workbench
            </span>
          </div>

          {/* Headline */}
          <h1 className="nd-animate-fade-up-delay-1" style={{
            fontSize: 'clamp(2.4rem, 5.5vw, 3.8rem)',
            fontWeight: 800,
            lineHeight: 1.15,
            letterSpacing: '-0.03em',
            color: 'var(--nd-text-primary)',
            marginBottom: 20,
          }}>
            Build with AI.<br />
            <span style={{
              background: 'linear-gradient(135deg, var(--nd-text-primary) 20%, var(--nd-accent) 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>
              Secure with confidence.
            </span>
          </h1>

          {/* Supporting Copy */}
          <p className="nd-animate-fade-up-delay-2" style={{
            fontSize: 'clamp(1.05rem, 2.2vw, 1.2rem)',
            color: 'var(--nd-text-secondary)',
            lineHeight: 1.65,
            maxWidth: 600,
            margin: '0 auto 40px',
          }}>
            Connect your codebase, uncover security vulnerabilities, and get actionable fixes you can verify.
          </p>

          {/* Actions */}
          <div className="nd-animate-fade-up-delay-3" style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 14,
            flexWrap: 'wrap',
          }}>
            {isAuthenticated ? (
              <Link
                to="/dashboard"
                className="nd-btn nd-btn-primary nd-btn-lg"
                style={{
                  textDecoration: 'none',
                  fontSize: 15,
                  padding: '13px 30px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontWeight: 600,
                  boxShadow: '0 0 20px rgba(59,130,246,0.25)',
                }}
              >
                <span>Open dashboard</span>
                <ArrowRight size={16} />
              </Link>
            ) : (
              <>
                <Link
                  to="/signup"
                  className="nd-btn nd-btn-primary nd-btn-lg"
                  style={{
                    textDecoration: 'none',
                    fontSize: 15,
                    padding: '13px 30px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontWeight: 600,
                    boxShadow: '0 0 20px rgba(59,130,246,0.25)',
                  }}
                >
                  <span>Get started</span>
                  <ArrowRight size={16} />
                </Link>
                <Link
                  to="/login"
                  className="nd-btn nd-btn-secondary nd-btn-lg"
                  style={{
                    textDecoration: 'none',
                    fontSize: 15,
                    padding: '13px 26px',
                    fontWeight: 500,
                  }}
                >
                  Sign in
                </Link>
              </>
            )}
          </div>
        </section>

        {/* ── 3. Compact Three-Step Explanation ────────────────────── */}
        <section style={{
          maxWidth: 980,
          margin: '0 auto 88px',
          padding: '0 24px',
          width: '100%',
        }}>
          {/* Section divider label */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            marginBottom: 28,
          }}>
            <div style={{ flex: 1, height: 1, backgroundColor: 'var(--nd-border-subtle)' }} />
            <span style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'var(--nd-text-muted)',
              fontFamily: 'var(--nd-font-mono)',
              whiteSpace: 'nowrap',
            }}>
              How it works
            </span>
            <div style={{ flex: 1, height: 1, backgroundColor: 'var(--nd-border-subtle)' }} />
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 20,
          }}>
            {/* Step 1 */}
            <div className="nd-step-card nd-animate-fade-up-delay-1">
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <div style={{
                  width: 38,
                  height: 38,
                  borderRadius: 'var(--nd-radius-md)',
                  backgroundColor: 'var(--nd-accent-subtle)',
                  border: '1px solid var(--nd-accent-border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--nd-accent)',
                  boxShadow: '0 0 12px rgba(59,130,246,0.15)',
                }}>
                  <Code2 size={18} />
                </div>
                <span style={{
                  fontSize: 11,
                  fontFamily: 'var(--nd-font-mono)',
                  color: 'var(--nd-text-muted)',
                  fontWeight: 600,
                  letterSpacing: '0.06em',
                }}>
                  STEP 01
                </span>
              </div>
              <h3 style={{
                fontSize: 16,
                fontWeight: 700,
                color: 'var(--nd-text-primary)',
                margin: 0,
                letterSpacing: '-0.01em',
              }}>
                Scan your code.
              </h3>
              <p style={{
                fontSize: 13,
                color: 'var(--nd-text-secondary)',
                lineHeight: 1.6,
                margin: 0,
              }}>
                Connect your repository or upload your codebase to automatically detect security vulnerabilities with AST-backed scanning.
              </p>
            </div>

            {/* Step 2 */}
            <div className="nd-step-card nd-animate-fade-up-delay-2">
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <div style={{
                  width: 38,
                  height: 38,
                  borderRadius: 'var(--nd-radius-md)',
                  backgroundColor: 'var(--nd-accent-subtle)',
                  border: '1px solid var(--nd-accent-border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--nd-accent)',
                  boxShadow: '0 0 12px rgba(59,130,246,0.15)',
                }}>
                  <Wrench size={18} />
                </div>
                <span style={{
                  fontSize: 11,
                  fontFamily: 'var(--nd-font-mono)',
                  color: 'var(--nd-text-muted)',
                  fontWeight: 600,
                  letterSpacing: '0.06em',
                }}>
                  STEP 02
                </span>
              </div>
              <h3 style={{
                fontSize: 16,
                fontWeight: 700,
                color: 'var(--nd-text-primary)',
                margin: 0,
                letterSpacing: '-0.01em',
              }}>
                Understand and fix vulnerabilities.
              </h3>
              <p style={{
                fontSize: 13,
                color: 'var(--nd-text-secondary)',
                lineHeight: 1.6,
                margin: 0,
              }}>
                Review detailed finding context and code snippets, trace attack paths, and generate targeted remediation patches.
              </p>
            </div>

            {/* Step 3 */}
            <div className="nd-step-card nd-animate-fade-up-delay-3">
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <div style={{
                  width: 38,
                  height: 38,
                  borderRadius: 'var(--nd-radius-md)',
                  backgroundColor: 'var(--nd-accent-subtle)',
                  border: '1px solid var(--nd-accent-border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--nd-accent)',
                  boxShadow: '0 0 12px rgba(59,130,246,0.15)',
                }}>
                  <CheckCircle2 size={18} />
                </div>
                <span style={{
                  fontSize: 11,
                  fontFamily: 'var(--nd-font-mono)',
                  color: 'var(--nd-text-muted)',
                  fontWeight: 600,
                  letterSpacing: '0.06em',
                }}>
                  STEP 03
                </span>
              </div>
              <h3 style={{
                fontSize: 16,
                fontWeight: 700,
                color: 'var(--nd-text-primary)',
                margin: 0,
                letterSpacing: '-0.01em',
              }}>
                Verify your fixes.
              </h3>
              <p style={{
                fontSize: 13,
                color: 'var(--nd-text-secondary)',
                lineHeight: 1.6,
                margin: 0,
              }}>
                Deterministically re-scan the working copy to ensure security rules pass and the vulnerability pattern is completely eliminated.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* ── 4. Concise Footer ─────────────────────────────────────── */}
      <footer style={{
        borderTop: '1px solid var(--nd-border-default)',
        backgroundColor: 'var(--nd-bg-surface)',
        padding: '20px 28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 16,
        fontSize: 13,
        color: 'var(--nd-text-secondary)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 24, height: 24,
            backgroundColor: 'var(--nd-accent-subtle)',
            borderRadius: 'var(--nd-radius-sm)',
          }}>
            <ShieldCheck size={14} color="var(--nd-accent)" />
          </div>
          <span style={{ fontWeight: 600, color: 'var(--nd-text-primary)' }}>
            CausalOps
          </span>
          <span style={{ color: 'var(--nd-text-muted)', fontSize: 12 }}>
            © {new Date().getFullYear()} CausalOps. All rights reserved.
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          {isAuthenticated ? (
            <Link to="/dashboard" style={{ color: 'var(--nd-text-secondary)', textDecoration: 'none' }}>
              Dashboard
            </Link>
          ) : (
            <>
              <Link to="/login" style={{ color: 'var(--nd-text-secondary)', textDecoration: 'none' }}>
                Sign in
              </Link>
              <Link to="/signup" style={{ color: 'var(--nd-text-secondary)', textDecoration: 'none' }}>
                Get started
              </Link>
            </>
          )}
        </div>
      </footer>
    </div>
  );
}
