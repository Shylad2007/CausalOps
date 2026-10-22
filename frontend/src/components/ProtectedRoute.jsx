import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useInvestigationStore } from '../store/investigationStore';
import { RefreshCw, Shield } from 'lucide-react';

export default function ProtectedRoute() {
  const { authToken, currentUser, isAuthChecking } = useInvestigationStore();
  const location = useLocation();

  if (isAuthChecking) {
    return (
      <div className="min-h-screen w-screen flex flex-col items-center justify-center bg-[#07090e] text-slate-300 select-none">
        <div className="flex flex-col items-center space-y-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-950/60 border border-cyan-800/40 text-cyan-400">
            <RefreshCw className="h-6 w-6 animate-spin text-cyan-400" />
          </div>
          <p className="text-xs font-mono text-slate-400">Verifying CausalOps authorization...</p>
        </div>
      </div>
    );
  }

  if (!authToken || !currentUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}
