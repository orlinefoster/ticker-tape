import React, { useState } from 'react';
import { Card, Button } from '@/components/ui';
import type { CashHolding } from '@/store/portfolioStore';

interface CashDeskTabProps {
  cashHoldings: CashHolding[];
  rates: { ccl: number; mep: number; oficial: number };
  onUpdateRates: (rates: Partial<{ ccl: number; mep: number; oficial: number }>) => void;
  onAddCashHolding: (holding: Omit<CashHolding, 'id'>) => void;
  onRemoveCashHolding: (id: string) => void;
  onAddTransaction: (tx: {
    portfolioType: 'cash';
    type: 'DEPOSITO' | 'EXTRACCION';
    currency: 'ARS' | 'USD';
    totalNominal: number;
    notes: string;
  }) => void;
}

export const CashDeskTab: React.FC<CashDeskTabProps> = ({
  cashHoldings,
  rates,
  onUpdateRates,
  onAddCashHolding,
  onRemoveCashHolding,
  onAddTransaction,
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [currency, setCurrency] = useState<'ARS' | 'USD' | 'EUR'>('USD');
  const [amount, setAmount] = useState('');
  const [institution, setInstitution] = useState('');
  const [yieldRate, setYieldRate] = useState('');

  const [editingRates, setEditingRates] = useState(false);
  const [tempCcl, setTempCcl] = useState(rates.ccl.toString());
  const [tempMep, setTempMep] = useState(rates.mep.toString());

  const handleSaveHolding = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (!institution || isNaN(numAmount) || numAmount <= 0) return;

    onAddCashHolding({
      currency,
      amount: numAmount,
      institution,
      yieldRateAnnual: yieldRate ? parseFloat(yieldRate) : undefined,
    });

    onAddTransaction({
      portfolioType: 'cash',
      type: 'DEPOSITO',
      currency: currency === 'EUR' ? 'USD' : currency,
      totalNominal: numAmount,
      notes: `Alta de cuenta en ${institution} (${currency})`,
    });

    setInstitution('');
    setAmount('');
    setYieldRate('');
    setShowAddForm(false);
  };

  const handleSaveRates = () => {
    const ccl = parseFloat(tempCcl);
    const mep = parseFloat(tempMep);
    if (!isNaN(ccl) && !isNaN(mep)) {
      onUpdateRates({ ccl, mep });
      setEditingRates(false);
    }
  };

  return (
    <div
      role="tabpanel"
      id="tabpanel-cash"
      aria-labelledby="tab-cash"
      style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
    >
      {/* Top Banner: Exchange Rates Desk */}
      <Card style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: 'monospace' }}>
            Tipos de Cambio Oficiales &amp; Financieros
          </span>
          <div style={{ display: 'flex', gap: '20px', marginTop: '4px' }}>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Dólar CCL: </span>
              {editingRates ? (
                <input
                  type="number"
                  value={tempCcl}
                  onChange={(e) => setTempCcl(e.target.value)}
                  style={{ width: '80px', padding: '2px 6px', fontSize: '0.85rem' }}
                />
              ) : (
                <span className="font-mono" style={{ fontWeight: 800, color: 'var(--accent)' }}>
                  ${rates.ccl}
                </span>
              )}
            </div>

            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Dólar MEP: </span>
              {editingRates ? (
                <input
                  type="number"
                  value={tempMep}
                  onChange={(e) => setTempMep(e.target.value)}
                  style={{ width: '80px', padding: '2px 6px', fontSize: '0.85rem' }}
                />
              ) : (
                <span className="font-mono" style={{ fontWeight: 800, color: 'var(--accent-lavender)' }}>
                  ${rates.mep}
                </span>
              )}
            </div>
          </div>
        </div>

        <div>
          {editingRates ? (
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button size="sm" variant="ghost" onClick={() => setEditingRates(false)}>
                Cancelar
              </Button>
              <Button size="sm" variant="primary" onClick={handleSaveRates}>
                Guardar Cotizaciones
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setEditingRates(true)}>
              ✏️ Modificar Cotizaciones
            </Button>
          )}
        </div>
      </Card>

      {/* Cash Accounts Header & Add Action */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-bright)' }}>
            Cuentas de Liquidez &amp; Colocaciones
          </h3>
          <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Cuentas bancarias, fondos a la vista, cauciones y efectivo físico
          </p>
        </div>

        <Button size="sm" variant="primary" onClick={() => setShowAddForm(!showAddForm)}>
          {showAddForm ? '✕ Cancelar' : '+ Agregar Cuenta'}
        </Button>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <Card style={{ padding: '16px', border: '1px solid var(--accent)' }}>
          <form onSubmit={handleSaveHolding} style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'flex-end' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                Institución / Ubicación
              </label>
              <input
                type="text"
                placeholder="Ej: Banco Galicia, Caja de Seguridad"
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                required
                style={{ padding: '6px 10px', minWidth: '220px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-surface-elevated)', color: 'var(--text-bright)' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                Moneda
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as 'ARS' | 'USD' | 'EUR')}
                style={{ padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-surface-elevated)', color: 'var(--text-bright)' }}
              >
                <option value="USD">USD (Dólares)</option>
                <option value="ARS">ARS (Pesos)</option>
                <option value="EUR">EUR (Euros)</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                Monto
              </label>
              <input
                type="number"
                step="any"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                style={{ padding: '6px 10px', width: '130px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-surface-elevated)', color: 'var(--text-bright)', fontFamily: 'monospace' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                Tasa Anual % (Opcional)
              </label>
              <input
                type="number"
                step="any"
                placeholder="Ej: 36"
                value={yieldRate}
                onChange={(e) => setYieldRate(e.target.value)}
                style={{ padding: '6px 10px', width: '100px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-surface-elevated)', color: 'var(--text-bright)', fontFamily: 'monospace' }}
              />
            </div>

            <Button type="submit" size="sm" variant="bullish">
              Guardar Cuenta
            </Button>
          </form>
        </Card>
      )}

      {/* Table */}
      <Card style={{ padding: '0', overflow: 'hidden' }}>
        <table className="institutional-table" aria-label="Cuentas de liquidez y saldos">
          <thead>
            <tr>
              <th scope="col">INSTITUCIÓN</th>
              <th scope="col">MONEDA</th>
              <th scope="col" style={{ textAlign: 'right' }}>MONTO NOMINAL</th>
              <th scope="col" style={{ textAlign: 'right' }}>VALUACIÓN USD</th>
              <th scope="col" style={{ textAlign: 'right' }}>TASA ANUAL (TNA)</th>
              <th scope="col" style={{ textAlign: 'center' }}>ACCIONES</th>
            </tr>
          </thead>
          <tbody>
            {cashHoldings.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '36px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '1.6rem' }}>💵</span>
                    <strong style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                      No hay cuentas de liquidez registradas
                    </strong>
                    <span style={{ fontSize: '0.75rem', maxWidth: '420px', lineHeight: 1.4 }}>
                      En Modo Real, las cuentas de prueba están aisladas. Utiliza el botón "+ Registrar Cuenta" arriba para asentar saldos bancarios o de tesorería.
                    </span>
                  </div>
                </td>
              </tr>
            ) : cashHoldings.map((c) => {
                const usdVal = c.currency === 'USD' ? c.amount : c.currency === 'EUR' ? c.amount * 1.08 : c.amount / rates.ccl;
                return (
                  <tr key={c.id}>
                  <td style={{ fontWeight: 600, color: 'var(--text-bright)' }}>
                    {c.institution}
                  </td>
                  <td>
                    <span className="font-mono" style={{ padding: '2px 7px', borderRadius: '4px', backgroundColor: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', fontSize: '0.72rem', fontWeight: 700 }}>
                      {c.currency}
                    </span>
                  </td>
                  <td className="font-mono" style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text-bright)' }}>
                    {c.currency} ${c.amount.toLocaleString()}
                  </td>
                  <td className="font-mono" style={{ padding: '12px 14px', textAlign: 'right', color: 'var(--signal-bullish)', fontWeight: 700 }}>
                    ${usdVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="font-mono" style={{ padding: '12px 14px', textAlign: 'right', color: c.yieldRateAnnual ? 'var(--accent)' : 'var(--text-muted)' }}>
                    {c.yieldRateAnnual ? `${c.yieldRateAnnual.toFixed(1)}%` : '—'}
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                    <button
                      onClick={() => onRemoveCashHolding(c.id)}
                      aria-label={`Eliminar cuenta ${c.institution}`}
                      style={{ background: 'transparent', border: 'none', color: 'var(--signal-bearish)', cursor: 'pointer', fontSize: '0.85rem' }}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
};
