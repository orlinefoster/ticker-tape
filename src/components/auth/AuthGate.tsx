import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';

export interface AuthGateProps {
  children: React.ReactNode;
}

export const AuthGate: React.FC<AuthGateProps> = ({ children }) => {
  const {
    isInitialized,
    isUnlocked,
    username,
    isLoading,
    error,
    checkStatus,
    setupVault,
    unlockVault,
    checkAutoLock,
    recordActivity,
    clearError,
  } = useAuthStore();

  const [pin, setPin] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Check vault status on mount
  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  // Activity tracker and auto-lock interval
  useEffect(() => {
    const handleActivity = () => {
      recordActivity();
    };

    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('click', handleActivity);

    const interval = setInterval(() => {
      checkAutoLock();
    }, 15000);

    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('click', handleActivity);
      clearInterval(interval);
    };
  }, [recordActivity, checkAutoLock]);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    clearError();

    if (!pin) {
      setFormError('Ingresá tu PIN para desbloquear.');
      return;
    }

    const success = await unlockVault(pin);
    if (success) {
      setPin('');
    }
  };

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    clearError();

    if (!newUsername.trim()) {
      setFormError('Ingresá un nombre de usuario.');
      return;
    }
    if (pin.length < 4) {
      setFormError('El PIN debe tener al menos 4 caracteres.');
      return;
    }
    if (pin !== confirmPin) {
      setFormError('Los PINs no coinciden.');
      return;
    }

    const success = await setupVault(newUsername, pin);
    if (success) {
      setPin('');
      setConfirmPin('');
      setNewUsername('');
    }
  };

  // If unlocked, render children smoothly
  if (isUnlocked) {
    return <>{children}</>;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95 backdrop-blur-md p-4 text-slate-100 font-sans">
      <Card className="w-full max-w-md p-6 bg-slate-900/90 border border-slate-800 shadow-2xl rounded-2xl relative overflow-hidden">
        {/* Top glow accent */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-cyan-500 to-indigo-500" />

        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-3 shadow-inner">
            <svg
              className="w-7 h-7 text-emerald-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>

          <h2 className="text-xl font-bold tracking-tight text-white">
            {isInitialized ? 'Bóveda de Seguridad' : 'Configuración de Seguridad'}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {isInitialized
              ? 'Tus datos financieros y claves están cifrados con AES-256-GCM.'
              : 'Configurá tu usuario maestro y PIN para proteger tu cartera.'}
          </p>

          <div className="mt-3">
            <Badge variant="bullish" className="text-[10px] tracking-wider uppercase">
              Cifrado Local Activo
            </Badge>
          </div>
        </div>

        {(formError || error) && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{formError || error}</span>
          </div>
        )}

        {isInitialized ? (
          <form onSubmit={handleUnlock} className="space-y-4">
            {username && (
              <div className="text-center text-xs text-slate-400">
                Usuario: <span className="font-semibold text-slate-200">{username}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Ingresá tu PIN / Contraseña
              </label>
              <input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                autoFocus
                placeholder="••••"
                className="w-full px-4 py-2.5 bg-slate-800/80 border border-slate-700 rounded-lg text-center tracking-[0.5em] text-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              disabled={isLoading || !pin}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg shadow-lg shadow-emerald-900/30 transition-all"
            >
              {isLoading ? 'Desbloqueando...' : 'Desbloquear Bóveda'}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleSetup} className="space-y-3.5">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Nombre de Usuario
              </label>
              <input
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="Ej: Inversor"
                className="w-full px-3.5 py-2 bg-slate-800/80 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                PIN Maestro (mínimo 4 dígitos)
              </label>
              <input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="••••"
                className="w-full px-3.5 py-2 bg-slate-800/80 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Confirmar PIN
              </label>
              <input
                type="password"
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value)}
                placeholder="••••"
                className="w-full px-3.5 py-2 bg-slate-800/80 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              disabled={isLoading || !newUsername || pin.length < 4}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg shadow-lg shadow-emerald-900/30 transition-all mt-2"
            >
              {isLoading ? 'Inicializando...' : 'Crear Bóveda Segura'}
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
};
