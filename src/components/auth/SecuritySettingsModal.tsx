import React, { useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';

export interface SecuritySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SecuritySettingsModal: React.FC<SecuritySettingsModalProps> = ({ isOpen, onClose }) => {
  const {
    username,
    autoLockMinutes,
    setAutoLockMinutes,
    changePin,
    lockVault,
    isLoading,
    error,
    clearError,
  } = useAuthStore();

  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmNewPin, setConfirmNewPin] = useState('');
  const [localMsg, setLocalMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!isOpen) return null;

  const handleChangePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalMsg(null);
    clearError();

    if (!oldPin || !newPin) {
      setLocalMsg({ type: 'error', text: 'Por favor complete todos los campos.' });
      return;
    }
    if (newPin.length < 4) {
      setLocalMsg({ type: 'error', text: 'El nuevo PIN debe tener al menos 4 caracteres.' });
      return;
    }
    if (newPin !== confirmNewPin) {
      setLocalMsg({ type: 'error', text: 'Los nuevos PINs no coinciden.' });
      return;
    }

    const success = await changePin(oldPin, newPin);
    if (success) {
      setLocalMsg({ type: 'success', text: 'PIN modificado y bóveda re-encriptada con éxito.' });
      setOldPin('');
      setNewPin('');
      setConfirmNewPin('');
    } else {
      setLocalMsg({ type: 'error', text: error || 'Error al cambiar el PIN.' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 font-sans">
      <Card className="w-full max-w-lg p-6 bg-slate-900 border border-slate-800 shadow-2xl rounded-2xl relative">
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Seguridad y Bóveda Cifrada</h3>
              <p className="text-xs text-slate-400">AES-256-GCM + Argon2 en SQLite nativo</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-1"
          >
            ✕
          </button>
        </div>

        <div className="space-y-6">
          {/* Status summary */}
          <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-between">
            <div>
              <div className="text-xs font-medium text-slate-300">Usuario Activo: {username || 'Propietario'}</div>
              <div className="text-[11px] text-emerald-400 flex items-center gap-1.5 mt-0.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Bóveda desbloqueada y lista para operaciones
              </div>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                lockVault();
                onClose();
              }}
              className="text-xs border border-red-500/30 text-red-400 hover:bg-red-500/10"
            >
              Bloquear Ahora
            </Button>
          </div>

          {/* Auto lock timer */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Tiempo de auto-bloqueo por inactividad
            </label>
            <div className="flex items-center gap-2">
              {[5, 15, 30, 60].map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => setAutoLockMinutes(mins)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    autoLockMinutes === mins
                      ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
                  }`}
                >
                  {mins} min
                </button>
              ))}
            </div>
          </div>

          {/* Change PIN Form */}
          <form onSubmit={handleChangePin} className="space-y-3 pt-4 border-t border-slate-800">
            <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
              Cambiar PIN Maestro
            </h4>

            {localMsg && (
              <div
                className={`p-2.5 rounded-lg text-xs border ${
                  localMsg.type === 'success'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                    : 'bg-red-500/10 border-red-500/30 text-red-400'
                }`}
              >
                {localMsg.text}
              </div>
            )}

            <div>
              <label className="block text-[11px] text-slate-400 mb-1">PIN Actual</label>
              <input
                type="password"
                value={oldPin}
                onChange={(e) => setOldPin(e.target.value)}
                placeholder="••••"
                className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Nuevo PIN</label>
                <input
                  type="password"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value)}
                  placeholder="••••"
                  className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Confirmar Nuevo PIN</label>
                <input
                  type="password"
                  value={confirmNewPin}
                  onChange={(e) => setConfirmNewPin(e.target.value)}
                  placeholder="••••"
                  className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white"
                />
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              disabled={isLoading || !oldPin || !newPin}
              className="w-full mt-2 py-2 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg"
            >
              {isLoading ? 'Re-encriptando Bóveda...' : 'Actualizar PIN'}
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
};
