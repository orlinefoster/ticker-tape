import React from 'react';
import { Card, Button, Badge } from '@/components/ui';
import type { MarketSignal } from '../types';

interface ActiveSignalsBoardProps {
  signals: MarketSignal[];
  onSelectSignal: (signal: MarketSignal) => void;
  onNavigate: (route: string) => void;
}

export const ActiveSignalsBoard: React.FC<ActiveSignalsBoardProps> = ({
  signals,
  onSelectSignal,
  onNavigate,
}) => {
  return (
    <Card style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2
            style={{
              margin: 0,
              fontSize: '1rem',
              fontWeight: 700,
              color: 'var(--text-bright)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span>🎯</span> Radar Cuantitativo &amp; Señales Activas
          </h2>
          <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Convergencia entre Top-Down Macro, Rotación Alpha, Topología y Ciclos Intermarket
          </p>
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={() => onNavigate('/top-down')}
          aria-label="Abrir Motor Top-Down"
        >
          Explorar Top-Down ➔
        </Button>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table
          className="institutional-table"
          aria-label="Tabla de señales cuantitativas activas"
        >
          <thead>
            <tr>
              <th scope="col">ACTIVO / TICKER</th>
              <th scope="col">DIRECCIÓN</th>
              <th scope="col">SCORE</th>
              <th scope="col">TIMEFRAME</th>
              <th scope="col">PREMISA TÉCNICA</th>
              <th scope="col" style={{ textAlign: 'right' }}>ENTRY</th>
              <th scope="col" style={{ textAlign: 'right' }}>STOP LOSS</th>
              <th scope="col" style={{ textAlign: 'right' }}>TARGET (R)</th>
              <th scope="col" style={{ textAlign: 'center' }}>ACCIÓN</th>
            </tr>
          </thead>
          <tbody>
            {signals.map((sig) => {
              const rReward = Math.abs(sig.suggestedTarget - sig.suggestedEntry);
              const rRisk = Math.abs(sig.suggestedEntry - sig.suggestedStop);
              const rRatio = rRisk > 0 ? (rReward / rRisk).toFixed(1) : '1.0';

              return (
                <tr
                  key={sig.symbol}
                  className={sig.direction === 'BUY' ? 'row-bullish' : sig.direction === 'SELL' ? 'row-bearish' : undefined}
                >
                  <td style={{ padding: '10px 6px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span className="font-mono" style={{ fontWeight: 800, color: 'var(--text-bright)', fontSize: '0.9rem' }}>
                        {sig.symbol}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{sig.name}</span>
                    </div>
                  </td>

                  <td style={{ padding: '10px 6px' }}>
                    <Badge
                      variant={sig.direction === 'BUY' ? 'bullish' : sig.direction === 'SELL' ? 'bearish' : 'neutral'}
                      pulse={sig.direction === 'BUY'}
                    >
                      {sig.direction === 'BUY' ? 'COMPRA' : sig.direction === 'SELL' ? 'VENTA' : 'NEUTRAL'}
                    </Badge>
                  </td>

                  <td style={{ padding: '10px 6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div
                        style={{
                          width: '45px',
                          height: '6px',
                          backgroundColor: 'var(--border-subtle)',
                          borderRadius: '3px',
                          overflow: 'hidden',
                        }}
                        aria-hidden="true"
                      >
                        <div
                          style={{
                            width: `${sig.score}%`,
                            height: '100%',
                            backgroundColor: sig.score >= 80 ? 'var(--signal-bullish)' : sig.score >= 60 ? 'var(--accent)' : 'var(--signal-warning)',
                          }}
                        />
                      </div>
                      <span className="font-mono" style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-bright)' }}>
                        {sig.score}
                      </span>
                    </div>
                  </td>

                  <td style={{ padding: '10px 6px', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                    {sig.timeframe}
                  </td>

                  <td style={{ padding: '10px 6px', maxWidth: '280px' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.3 }}>
                      {sig.rationale}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--accent-lavender)', marginTop: '2px', fontFamily: 'monospace' }}>
                      {sig.source}
                    </div>
                  </td>

                  <td className="font-mono" style={{ padding: '10px 6px', textAlign: 'right', fontWeight: 600, color: 'var(--text-bright)' }}>
                    ${sig.suggestedEntry.toLocaleString()}
                  </td>

                  <td className="font-mono" style={{ padding: '10px 6px', textAlign: 'right', color: 'var(--signal-bearish)', fontWeight: 600 }}>
                    ${sig.suggestedStop.toLocaleString()}
                  </td>

                  <td className="font-mono" style={{ padding: '10px 6px', textAlign: 'right', color: 'var(--signal-bullish)', fontWeight: 700 }}>
                    ${sig.suggestedTarget.toLocaleString()}{' '}
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>({rRatio}R)</span>
                  </td>

                  <td style={{ padding: '10px 6px', textAlign: 'center' }}>
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => onSelectSignal(sig)}
                      aria-label={`Calcular tamaño de posición Van Tharp para ${sig.symbol}`}
                    >
                      📐 Operar
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
};
