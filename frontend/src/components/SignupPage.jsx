import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Lock, User, Mail, AlertCircle, ShieldCheck, ArrowRight, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { useInvestigationStore } from '../store/investigationStore';
import { registerUser } from '../api/client';

export default function SignupPage() {
  const navigate = useNavigate();
  const { authToken, currentUser, setAuthSession } = useInvestigationStore();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (authToken && currentUser) {
      navigate('/dashboard/projects', { replace: true });
    }
  }, [authToken, currentUser, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (username.trim().length < 3) {
      setError('Username must be at least 3 characters.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setIsLoading(true);
    try {
      const res = await registerUser(username.trim(), password, email.trim() || null);
      setAuthSession(res.token, res.user);
      navigate('/dashboard/projects', { replace: true });
    } catch (err) {
      setError(err.message || 'Registration failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const labelStyle = {
    display: 'block',
    marginBottom: 8,
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--nd-text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
  };

  const iconStyle = {
    position: 'absolute',
    left: 14,
    top: '50%',
    transform: 'translateY(-50%)',
    color: 'var(--nd-text-muted)',
    pointerEvents: 'none',
  };

  const eyeBtnStyle = {
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
          to="/login"
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
          <span>Already have an account? Sign in</span>
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
          width: 640,
          height: 420,
          background: 'radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 65%)',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        }} />

        {/* Auth Container Card */}
        <div
          className="nd-auth-card"
          style={{
            maxWidth: 492,
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
          <div style={{ marginBottom: 30, textAlign: 'center' }}>
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
              Create an account
            </h1>
            <p style={{
              fontSize: 14,
              color: 'var(--nd-text-secondary)',
              margin: 0,
              lineHeight: 1.55,
            }}>
              Set up your CausalOps workspace. No credit card required.
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
                <strong>Registration Failed:</strong> {error}
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* Username */}
            <div>
              <label htmlFor="signup-username" style={labelStyle}>Username</label>
              <div style={{ position: 'relative' }}>
                <User size={15} style={iconStyle} />
                <input
                  id="signup-username"
                  type="text"
                  required
                  disabled={isLoading}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="your-username"
                  className="nd-input"
                  style={{ paddingLeft: 42, fontSize: 14, height: 46 }}
                  autoComplete="username"
                  autoFocus
                />
              </div>
            </div>

            {/* Email (optional) */}
            <div>
              <label htmlFor="signup-email" style={labelStyle}>
                Email <span style={{ textTransform: 'none', fontWeight: 400, color: 'var(--nd-text-muted)', letterSpacing: 0 }}>(optional)</span>
              </label>
              <div style={{ position: 'relative' }}>
                <Mail size={15} style={iconStyle} />
                <input
                  id="signup-email"
                  type="email"
                  disabled={isLoading}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="nd-input"
                  style={{ paddingLeft: 42, fontSize: 14, height: 46 }}
                  autoComplete="email"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label htmlFor="signup-password" style={labelStyle}>Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={15} style={iconStyle} />
                <input
                  id="signup-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  disabled={isLoading}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                  className="nd-input"
                  style={{ paddingLeft: 42, paddingRight: 46, fontSize: 14, height: 46 }}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  title={showPassword ? 'Hide password' : 'Show password'}
                  style={eyeBtnStyle}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Confirm password */}
            <div>
              <label htmlFor="signup-confirm-password" style={labelStyle}>Confirm password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={15} style={iconStyle} />
                <input
                  id="signup-confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  disabled={isLoading}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  className="nd-input"
                  style={{ paddingLeft: 42, paddingRight: 46, fontSize: 14, height: 46 }}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  title={showConfirmPassword ? 'Hide password' : 'Show password'}
                  style={eyeBtnStyle}
                >
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* What happens next */}
            <div style={{
              padding: '12px 14px',
              backgroundColor: 'var(--nd-bg-elevated)',
              border: '1px solid var(--nd-border-subtle)',
              borderRadius: 'var(--nd-radius-md)',
              fontSize: 12,
              color: 'var(--nd-text-secondary)',
              lineHeight: 1.55,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
            }}>
              <CheckCircle2 size={15} color="var(--nd-accent)" style={{ flexShrink: 0, marginTop: 1 }} />
              <div>
                After creating your account, you'll connect a GitHub repository to start your first security scan.
              </div>
            </div>

            {/* Submit Button */}
            <button
              id="signup-submit"
              type="submit"
              disabled={isLoading}
              className="nd-btn nd-btn-primary nd-btn-lg"
              style={{
                width: '100%',
                height: 48,
                justifyContent: 'center',
                fontSize: 15,
                fontWeight: 600,
                marginTop: 4,
                boxShadow: isLoading ? 'none' : '0 0 16px rgba(59,130,246,0.25)',
                transition: 'box-shadow var(--nd-transition-base), background-color var(--nd-transition-fast)',
              }}
            >
              {isLoading ? (
                <>
                  <span className="nd-spinner nd-spinner-sm" />
                  <span>Creating account…</span>
                </>
              ) : (
                <>
                  <span>Create account</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          {/* Link to Login */}
          <div style={{
            marginTop: 26,
            paddingTop: 20,
            borderTop: '1px solid var(--nd-border-subtle)',
            textAlign: 'center',
            fontSize: 13,
            color: 'var(--nd-text-secondary)',
          }}>
            Already have an account?{' '}
            <Link
              to="/login"
              style={{
                color: 'var(--nd-accent)',
                textDecoration: 'none',
                fontWeight: 600,
                marginLeft: 4,
              }}
            >
              Sign in
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
