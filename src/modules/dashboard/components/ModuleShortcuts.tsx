import React from 'react';
import { Card } from '@/components/ui';
import type { WorkspaceShortcut } from '../types';

interface ModuleShortcutsProps {
  onNavigate: (route: string) => void;
}

const SHORTCUTS: WorkspaceShortcut[] = [
  {
    route: '/top-down',
    title: 'Top-Down Macro Engine',
    subtitle: 'Análisis multi-nivel: Macro ➔ Sectores ➔ Micro',
    icon: '🎯',
    badge: 'AUTOMATIZADO',
    accent: 'var(--accent)',
  },
  {
    route: '/chart',
    title: 'Gráfico Técnico Profesional',
    subtitle: 'Velas japonesas, volumen, indicadores y sintéticos',
    icon: '📉',
    badge: 'TRADINGVIEW',
    accent: 'var(--accent-mint)',
  },
  {
    route: '/intermarket',
    title: 'Ciclo Intermarket',
    subtitle: 'Rotación Bono / Acción / Commodity / Dólar',
    icon: '🔄',
    badge: 'CICLOS',
    accent: 'var(--accent-lavender)',
  },
  {
    route: '/topology',
    title: 'Topología & Regímenes',
    subtitle: 'Matriz de correlación y detección Risk-On / Risk-Off',
    icon: '🔗',
    badge: 'CORRELACIONES',
    accent: 'var(--accent-peach)',
  },
  {
    route: '/relative-perf',
    title: 'Alpha Rotation Radar',
    subtitle: 'Gráfico de cuadrantes RRG y momentum relativo',
    icon: '📡',
    badge: 'MOMENTUM',
    accent: 'var(--accent-sakura)',
  },
  {
    route: '/elliott',
    title: 'Elliott Wave Engine',
    subtitle: 'Conteo automático y validación fractal de ondas',
    icon: '🌊',
    badge: 'FRACTALES',
    accent: 'var(--accent)',
  },
  {
    route: '/backtesting',
    title: 'Backtesting & Optimización',
    subtitle: 'Simulación de estrategias Bollinger, RSI y MACD',
    icon: '📈',
    badge: 'VALIDACIÓN',
    accent: 'var(--accent-mint)',
  },
  {
    route: '/providers',
    title: 'Proveedores & Conectividad',
    subtitle: 'Diagnóstico de latencia Binance, Yahoo, IOL y Cloud',
    icon: '🔌',
    badge: 'NETWORK',
    accent: 'var(--accent-lavender)',
  },
  {
    route: '/wiki',
    title: 'Wiki & Métodos de Trading',
    subtitle: 'Manual de uso, Money Management, EXO y VWAP',
    icon: '📚',
    badge: 'KNOWLEDGE',
    accent: 'var(--accent-peach)',
  },
];

export const ModuleShortcuts: React.FC<ModuleShortcutsProps> = ({ onNavigate }) => {
  return (
    <section aria-label="Accesos Rápidos a Motores de Inteligencia">
      <div style={{ marginBottom: '8px' }}>
        <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-bright)' }}>
          ⚡ Motores Cuantitativos del Terminal
        </h3>
        <p style={{ margin: '2px 0 0', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          Lanza cualquier módulo de análisis técnico y validación en un clic
        </p>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '12px',
        }}
      >
        {SHORTCUTS.map((sc) => (
          <Card
            key={sc.route}
            variant="filled"
            role="button"
            tabIndex={0}
            onClick={() => onNavigate(sc.route)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') onNavigate(sc.route);
            }}
            aria-label={`Abrir módulo ${sc.title}`}
            style={{
              padding: '14px',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              transition: 'all var(--transition-fast)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.2rem' }} aria-hidden="true">{sc.icon}</span>
                <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-bright)' }}>
                  {sc.title}
                </span>
              </div>
              {sc.badge && (
                <span
                  className="font-mono"
                  style={{
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    color: sc.accent,
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  {sc.badge}
                </span>
              )}
            </div>

            <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.35 }}>
              {sc.subtitle}
            </p>
          </Card>
        ))}
      </div>
    </section>
  );
};
