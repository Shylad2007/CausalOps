import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Lock, User, AlertCircle, ShieldCheck, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { useInvestigationStore } from '../store/investigationStore';
import { loginUser } from '../api/client';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { authToken, currentUser, setAuthSession } = useInvestigationStore();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (authToken && currentUser) {
      const destination = location.state?.from || '/dashboard/projects';
      navigate(destination, { replace: true });
    }
  }, [authToken, currentUser, navigate, location.state]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Please enter both username and password.');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const res = await loginUser(username.trim(), password);
      setAuthSession(res.token, res.user);
      const destination = location.state?.from || '/dashboard/projects';
      navigate(destination, { replace: true });
    } catch (err) {
      setError(err.message || 'Invalid username or password.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      width: '100vw',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: 'var(--nd-bg-base)',
      color: 'var(--nd-text-primary)',
      fontFamily: 'var(--nd-font-sans)',
      overflowX: 'hidden',
    }}>
      {/* ── Top Bar ─────────────────────────────────────────────────── */}
      <header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 'var(--nd-header-height)',
        padding: '0 28px',
        backgroundColor: 'var(--nd-bg-surface)',
        borderBottom: '1px solid var(--nd-border-default)',
        flexShrink: 0,
      }}>
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
          <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--nd-text-primary)' }}>
            CAUSALOPS
          </span>
          <span className="nd-badge nd-badge-info" style={{ fontSize: 10, padding: '2px 7px' }}>
            PLATFORM
          </span>
        </Link>
        <Link
          to="/"
          style={{
            fontSize: 13,
            color: 'var(--nd-text-secondary)',
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            transition: 'color var(--nd-transition-fast)',
          }}
        >
          <span>← Back to home</span>
        </Link>
      </header>

      {/* ── Main Form Area ─────────────────────────────────────────── */}
      <main style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 24px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Background glow decoration */}
        <div aria-hidden="true" className="nd-glow-orb" style={{
          width: 600,
          height: 400,
          background: 'radial-gradient(circle, rgba(59,130,246,0.09) 0%, transparent 65%)',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        }} />

        {/* Auth Container Card */}
        <div
          className="nd-auth-card"
          style={{
            maxWidth: 460,
            padding: '44px 40px',
          }}
        >
          {/* Card top accent line */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 2,
            background: 'linear-gradient(90deg, transparent 0%, var(--nd-accent) 40%, var(--nd-accent) 60%, transparent 100%)',
            opacity: 0.5,
            borderRadius: 'var(--nd-radius-xl) var(--nd-radius-xl) 0 0',
          }} />

          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 52,
              height: 52,
              marginBottom: 18,
              backgroundColor: 'var(--nd-accent-subtle)',
              border: '1px solid var(--nd-accent-border)',
              borderRadius: 'var(--nd-radius-lg)',
              boxShadow: '0 0 20px rgba(59,130,246,0.2)',
            }}>
              <ShieldCheck size={26} color="var(--nd-accent)" />
            </div>
            <h1 style={{
              fontSize: 26,
              fontWeight: 800,
              color: 'var(--nd-text-primary)',
              margin: '0 0 8px',
              letterSpacing: '-0.025em',
            }}>
              Sign In to CausalOps
            </h1>
            <p style={{
              fontSize: 14,
              color: 'var(--nd-text-secondary)',
              margin: 0,
              lineHeight: 1.55,
            }}>
              Access your protected application security workbench
            </p>
          </div>

          {/* Error Alert */}
          {error && (
            <div
              role="alert"
              className="nd-animate-fade-in"
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                padding: '12px 14px',
                marginBottom: 20,
                backgroundColor: 'var(--nd-critical-bg)',
                border: '1px solid var(--nd-critical-border)',
                borderRadius: 'var(--nd-radius-md)',
                fontSize: 13,
                color: 'var(--nd-critical)',
                lineHeight: 1.4,
              }}
            >
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              <div>
                <strong>Authentication Failed:</strong> {error}
              </div>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Username Field */}
            <div>
              <label htmlFor="login-username" style={{
                display: 'block',
                marginBottom: 8,
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--nd-text-secondary)',
                textTransform: 'uppercase',
                letterSpacing: '0.07em',
              }}>
                Username
              </label>
              <div style={{ position: 'relative' }}>
                <User size={15} style={{
                  position: 'absolute',
                  left: 14,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--nd-text-muted)',
                  pointerEvents: 'none',
                }} />
                <input
                  id="login-username"
                  type="text"
                  required
                  disabled={isLoading}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="analyst"
                  className="nd-input"
                  style={{
                    paddingLeft: 42,
                    fontSize: 14,
                    height: 46,
                  }}
                  autoComplete="username"
                  autoFocus
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <label htmlFor="login-password" style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--nd-text-secondary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.07em',
                  margin: 0,
                }}>
                  Password
                </label>
              </div>
              <div style={{ position: 'relative' }}>
                <Lock size={15} style={{
                  position: 'absolute',
                  left: 14,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--nd-text-muted)',
                  pointerEvents: 'none',
                }} />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  disabled={isLoading}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="nd-input"
                  style={{
                    paddingLeft: 42,
                    paddingRight: 46,
                    fontSize: 14,
                    height: 46,
                  }}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  title={showPassword ? 'Hide password' : 'Show password'}
                  style={{
                    position: 'absolute',
                    right: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--nd-text-muted)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    padding: 4,
                    borderRadius: 'var(--nd-radius-sm)',
                    transition: 'color var(--nd-transition-fast)',
                  }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              id="login-submit"
              type="submit"
              disabled={isLoading}
              className="nd-btn nd-btn-primary nd-btn-lg"
              style={{
                width: '100%',
                height: 48,
                justifyContent: 'center',
                fontSize: 15,
                fontWeight: 600,
                marginTop: 6,
                boxShadow: isLoading ? 'none' : '0 0 16px rgba(59,130,246,0.25)',
                transition: 'box-shadow var(--nd-transition-base), background-color var(--nd-transition-fast)',
              }}
            >
              {isLoading ? (
                <>
                  <span className="nd-spinner nd-spinner-sm" />
                  <span>Signing in…</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          {/* Link to Signup */}
          <div style={{
            marginTop: 26,
            paddingTop: 20,
            borderTop: '1px solid var(--nd-border-subtle)',
            textAlign: 'center',
            fontSize: 13,
            color: 'var(--nd-text-secondary)',
          }}>
            Don't have an account?{' '}
            <Link
              to="/signup"
              style={{
                color: 'var(--nd-accent)',
                textDecoration: 'none',
                fontWeight: 600,
                marginLeft: 4,
              }}
            >
              Create an account
            </Link>
          </div>
        </div>
      </main>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer style={{
        borderTop: '1px solid var(--nd-border-subtle)',
        padding: '16px 24px',
        textAlign: 'center',
        fontSize: 12,
        fontFamily: 'var(--nd-font-mono)',
        color: 'var(--nd-text-muted)',
      }}>
        CausalOps Platform · Deterministic security investigation &amp; remediation
      </footer>
    </div>
  );
}
