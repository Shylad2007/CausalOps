import React, { useState } from 'react';
import { Lock, User, Mail, AlertTriangle, X, Shield, ArrowRight } from 'lucide-react';
import { useInvestigationStore } from '../store/investigationStore';
import { loginUser, registerUser } from '../api/client';

export default function AuthModal() {
  const { isAuthModalOpen, authModalMode, closeAuthModal, setAuthSession, openAuthModal } = useInvestigationStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  if (!isAuthModalOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      if (authModalMode === 'login') {
        const res = await loginUser(username, password);
        setAuthSession(res.token, res.user);
      } else {
        const res = await registerUser(username, password, email || null);
        setAuthSession(res.token, res.user);
      }
    } catch (err) {
      setError(err.message || 'Authentication failed.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 select-none">
      <div className="w-full max-w-md rounded-xl border border-slate-800 bg-[#0f141c] p-6 shadow-2xl">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center space-x-2 text-cyan-400">
            <Shield className="h-5 w-5" />
            <h3 className="font-bold text-slate-100 text-sm">
              {authModalMode === 'login' ? 'Sign In to CausalOps' : 'Create CausalOps Account'}
            </h3>
          </div>
          <button onClick={closeAuthModal} className="text-slate-400 hover:text-slate-200">
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded border border-rose-800/80 bg-rose-950/40 p-2.5 text-xs text-rose-300 flex items-center space-x-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Username
            </label>
            <div className="relative">
              <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. analyst"
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 pl-9 text-xs text-slate-200 placeholder-slate-600 focus:border-cyan-500 focus:outline-hidden"
              />
            </div>
          </div>

          {authModalMode === 'register' && (
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Email (Optional)
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="analyst@domain.com"
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 pl-9 text-xs text-slate-200 placeholder-slate-600 focus:border-cyan-500 focus:outline-hidden"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 pl-9 text-xs text-slate-200 placeholder-slate-600 focus:border-cyan-500 focus:outline-hidden"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center space-x-1.5 rounded-lg bg-cyan-600 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-cyan-500 transition disabled:opacity-50"
            >
              <span>{isLoading ? 'Authenticating...' : authModalMode === 'login' ? 'Sign In' : 'Create Account'}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </form>

        <div className="mt-4 pt-3 border-t border-slate-800/80 text-center text-xs text-slate-400">
          {authModalMode === 'login' ? (
            <span>
              Don't have an account?{' '}
              <button
                type="button"
                onClick={() => openAuthModal('register')}
                className="text-cyan-400 hover:underline font-semibold"
              >
                Sign up
              </button>
            </span>
          ) : (
            <span>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => openAuthModal('login')}
                className="text-cyan-400 hover:underline font-semibold"
              >
                Sign in
              </button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
