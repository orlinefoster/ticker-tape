import { useState, useEffect, useMemo } from 'react';
import { Card, Button, Badge, StatMetric } from '@/components/ui';
import { useAuthStore } from '@/store/authStore';
import { usePortfolioStore } from '@/store/portfolioStore';
import {
  DEFAULT_SECTOR_UNIVERSE,
  SectorAsset,
  DcaPlanConfig,
  ContributionRecord,
} from './types';
import { calculateDcaRebalance, projectCompoundWealth } from './engine';

const STORAGE_KEY = 'spy_sectorial_dca_v1';

export default function SpyDcaModule() {
  const { isUnlocked, saveEncrypted, loadEncrypted } = useAuthStore();
  const { iolHoldings, rates } = usePortfolioStore();

  const [assets, setAssets] = useState<SectorAsset[]>(DEFAULT_SECTOR_UNIVERSE);
  const [config, setConfig] = useState<DcaPlanConfig>({
    monthlyDeposit: 150,
    currency: 'USD',
    driftTolerancePct: 2.0,
    expectedAnnualReturnPct: 9.5,
    cclRate: rates.ccl || 1320,
  });

  const [contributions, setContributions] = useState<ContributionRecord[]>([]);
  const [activeTab, setActiveTab] = useState<'calculator' | 'model' | 'projection' | 'history'>('calculator');
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  // Sync CCL rate from portfolio store
  useEffect(() => {
    if (rates.ccl && rates.ccl > 0) {
      setConfig((prev) => ({ ...prev, cclRate: rates.ccl }));
    }
  }, [rates.ccl]);

  // Load persisted strategy from vault or local storage on mount
  useEffect(() => {
    async function loadPlan() {
      if (isUnlocked) {
        const saved = await loadEncrypted<{
          assets: SectorAsset[];
          config: DcaPlanConfig;
          contributions: ContributionRecord[];
        }>(STORAGE_KEY);

        if (saved) {
          if (saved.assets) setAssets(saved.assets);
          if (saved.config) setConfig((prev) => ({ ...prev, ...saved.config }));
          if (saved.contributions) setContributions(saved.contributions);
          return;
        }
      }

      // Fallback to localStorage
      try {
        const local = localStorage.getItem(STORAGE_KEY);
        if (local) {
          const parsed = JSON.parse(local);
          if (parsed.assets) setAssets(parsed.assets);
          if (parsed.config) setConfig((prev) => ({ ...prev, ...parsed.config }));
          if (parsed.contributions) setContributions(parsed.contributions);
        }
      } catch {
        // use defaults
      }
    }

    loadPlan();
  }, [isUnlocked, loadEncrypted]);

  // Save changes to vault
  const handleSavePlan = async () => {
    const payload = { assets, config, contributions };
    setSaveStatus('Guardando...');

    if (isUnlocked) {
      await saveEncrypted(STORAGE_KEY, payload);
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    }

    setSaveStatus(isUnlocked ? '¡Plan guardado en bóveda cifrada!' : '¡Plan guardado localmente!');
    setTimeout(() => setSaveStatus(null), 3000);
  };

  // Sync quantities from IOL holdings if present
  const handleSyncFromIol = () => {
    const updated = assets.map((asset) => {
      const found = iolHoldings.find(
        (h) => h.symbol.toUpperCase() === asset.symbol.toUpperCase() ||
               h.symbol.toUpperCase().startsWith(asset.symbol.toUpperCase())
      );
      if (found) {
        return {
          ...asset,
          currentQuantity: found.nominalQuantity,
          currentPriceArs: found.currentPriceArs || asset.currentPriceArs,
        };
      }
      return asset;
    });

    setAssets(updated);
    setSaveStatus('Cantidades sincronizadas desde IOL.');
    setTimeout(() => setSaveStatus(null), 3000);
  };

  // Preset allocation models
  const applyPreset = (presetName: string) => {
    let newWeights: Record<string, number> = {};

    switch (presetName) {
      case 'boglehead':
        newWeights = { SPY: 80, XLK: 10, XLF: 10, XLE: 0, XLV: 0, XLI: 0, XLC: 0 };
        break;
      case 'tech_growth':
        newWeights = { SPY: 45, XLK: 30, XLC: 15, XLF: 10, XLE: 0, XLV: 0, XLI: 0 };
        break;
      case 'defensive':
        newWeights = { SPY: 40, XLV: 20, XLP: 15, XLU: 15, XLF: 10, XLK: 0, XLE: 0 };
        break;
      case 'balanced':
      default:
        newWeights = { SPY: 55, XLK: 15, XLF: 10, XLE: 5, XLV: 5, XLI: 5, XLC: 5 };
        break;
    }

    const updated = assets.map((a) => ({
      ...a,
      targetWeightPct: newWeights[a.symbol] ?? 0,
    }));
    setAssets(updated);
  };

  // Calculation output
  const calculation = useMemo(() => {
    return calculateDcaRebalance(assets, config);
  }, [assets, config]);

  // Wealth projections
  const projections = useMemo(() => {
    const initial = calculation.totalCurrentValue;
    const monthly = config.currency === 'ARS'
      ? config.monthlyDeposit / (config.cclRate || 1320)
      : config.monthlyDeposit;

    return projectCompoundWealth(
      config.currency === 'ARS' ? initial / (config.cclRate || 1320) : initial,
      monthly,
      config.expectedAnnualReturnPct,
      15
    );
  }, [calculation.totalCurrentValue, config]);

  // Total target weights sum
  const totalTargetWeight = useMemo(() => {
    return assets.reduce((sum, a) => sum + a.targetWeightPct, 0);
  }, [assets]);

  // Record a completed contribution
  const handleExecuteContribution = () => {
    const executedOrders = calculation.suggestedOrders
      .filter((o) => o.sharesToBuy > 0)
      .map((o) => ({
        symbol: o.symbol,
        quantity: o.sharesToBuy,
        price: config.currency === 'ARS'
          ? (assets.find((a) => a.symbol === o.symbol)?.currentPriceArs || 0)
          : (assets.find((a) => a.symbol === o.symbol)?.currentPriceUsd || 0),
      }));

    if (executedOrders.length === 0) {
      alert('No hay órdenes para registrar con el monto actual.');
      return;
    }

    const newRecord: ContributionRecord = {
      id: `dca-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      amount: calculation.allocatedAmount,
      currency: config.currency,
      cclRate: config.cclRate,
      orders: executedOrders,
      notes: `Aporte mensual DCA rebalanceado automáticamente.`,
    };

    // Update quantities in asset list
    const updatedAssets = assets.map((asset) => {
      const order = calculation.suggestedOrders.find((o) => o.symbol === asset.symbol);
      if (order && order.sharesToBuy > 0) {
        return {
          ...asset,
          currentQuantity: asset.currentQuantity + order.sharesToBuy,
        };
      }
      return asset;
    });

    setAssets(updatedAssets);
    const newContribs = [newRecord, ...contributions];
    setContributions(newContribs);

    const payload = { assets: updatedAssets, config, contributions: newContribs };
    if (isUnlocked) {
      saveEncrypted(STORAGE_KEY, payload);
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    }

    setSaveStatus('¡Aporte registrado y cartera actualizada con éxito!');
    setTimeout(() => setSaveStatus(null), 4000);
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto font-sans text-slate-100">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">🏛️</span>
            <h1 className="text-xl font-bold tracking-tight text-white">
              Estrategia Core-Satellite: SPY + Sectoriales
            </h1>
            <Badge variant="bullish" className="text-[10px] tracking-wider uppercase">
              DCA Mensual Inteligente
            </Badge>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Plan sistemático de acumulación mensual. Rebalancea automáticamente comprando activos infraponderados sin generar ventas.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {saveStatus && (
            <span className="text-xs font-medium text-emerald-400 animate-fade-in mr-2">
              {saveStatus}
            </span>
          )}
          <Button variant="secondary" size="sm" onClick={handleSyncFromIol} className="text-xs">
            🔄 Sincronizar IOL
          </Button>
          <Button variant="primary" size="sm" onClick={handleSavePlan} className="text-xs bg-emerald-600 hover:bg-emerald-500">
            💾 Guardar Plan
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatMetric
          label="Valuación Actual Cartera"
          value={
            config.currency === 'USD'
              ? `$${calculation.totalCurrentValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`
              : `$${calculation.totalCurrentValue.toLocaleString('es-AR')} ARS`
          }
          subtext={`CCL Ref: $${config.cclRate.toLocaleString('es-AR')}`}
        />
        <StatMetric
          label="Aporte Mensual Planificado"
          value={
            config.currency === 'USD'
              ? `$${config.monthlyDeposit.toLocaleString('en-US')} USD`
              : `$${config.monthlyDeposit.toLocaleString('es-AR')} ARS`
          }
          subtext="Frecuencia mensual regular"
        />
        <StatMetric
          label="Presupuesto a Ejecutar Este Mes"
          value={
            config.currency === 'USD'
              ? `$${calculation.allocatedAmount.toLocaleString('en-US')} USD`
              : `$${calculation.allocatedAmount.toLocaleString('es-AR')} ARS`
          }
          subtext={`Sobrante: $${calculation.remainingCash} ${config.currency}`}
        />
        <StatMetric
          label="Rendimiento Estimado Anual"
          value={`${config.expectedAnnualReturnPct}%`}
          subtext="Histórico compuesto S&P 500"
        />
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('calculator')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'calculator'
              ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          🛒 Calculador de Aportes (Smart DCA)
        </button>
        <button
          onClick={() => setActiveTab('model')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'model'
              ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          ⚙️ Asignación & Ponderaciones
        </button>
        <button
          onClick={() => setActiveTab('projection')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'projection'
              ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          📈 Proyección a Futuro (Interés Compuesto)
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'history'
              ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          📜 Historial de Aportes ({contributions.length})
        </button>
      </div>

      {/* TAB 1: Smart DCA Calculator */}
      {activeTab === 'calculator' && (
        <div className="space-y-6">
          {/* Monthly deposit bar */}
          <Card className="p-4 bg-slate-900/80 border border-slate-800 rounded-xl">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Aporte Disponible Este Mes
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      value={config.monthlyDeposit}
                      onChange={(e) =>
                        setConfig({ ...config, monthlyDeposit: Math.max(0, Number(e.target.value)) })
                      }
                      className="w-36 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm font-semibold text-white focus:ring-2 focus:ring-emerald-500"
                    />
                    <select
                      value={config.currency}
                      onChange={(e) =>
                        setConfig({ ...config, currency: e.target.value as 'USD' | 'ARS' })
                      }
                      className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs font-semibold text-slate-200"
                    >
                      <option value="USD">USD ($)</option>
                      <option value="ARS">ARS (Pesos)</option>
                    </select>
                  </div>
                </div>

                <div className="hidden md:block pl-4 border-l border-slate-800">
                  <div className="text-[11px] text-slate-400">Total a Asignar</div>
                  <div className="text-sm font-bold text-emerald-400">
                    ${calculation.allocatedAmount.toLocaleString()} {config.currency}
                  </div>
                </div>
              </div>

              <Button
                variant="primary"
                onClick={handleExecuteContribution}
                disabled={calculation.allocatedAmount === 0}
                className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-950/40"
              >
                ✅ Confirmar y Registrar Compras del Mes
              </Button>
            </div>
          </Card>

          {/* Orders Table */}
          <Card className="overflow-hidden border border-slate-800 bg-slate-900/90 rounded-xl">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white">
                  Órdenes de Compra Sugeridas para Rebalanceo Óptimo
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  El algoritmo prioriza activos que quedaron por debajo de su peso ideal para equilibrar la cartera sin vender.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/60 text-[11px] text-slate-400 uppercase tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Activo / Sector</th>
                    <th className="py-3 px-3">Categoría</th>
                    <th className="py-3 px-3">Tenencia Actual</th>
                    <th className="py-3 px-3">Peso Actual</th>
                    <th className="py-3 px-3">Peso Objetivo</th>
                    <th className="py-3 px-3">Desvío (Drift)</th>
                    <th className="py-3 px-3">Precio Unitario</th>
                    <th className="py-3 px-3 font-semibold text-emerald-400">Comprar (Nominales)</th>
                    <th className="py-3 px-4 font-semibold text-emerald-400">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {calculation.suggestedOrders.map((order) => {
                    const isArs = config.currency === 'ARS';
                    const asset = assets.find((a) => a.symbol === order.symbol);
                    const unitPrice = isArs ? (asset?.currentPriceArs || 0) : (asset?.currentPriceUsd || 0);

                    return (
                      <tr
                        key={order.symbol}
                        className={`hover:bg-slate-800/40 transition-colors ${
                          order.sharesToBuy > 0 ? 'bg-emerald-950/10' : ''
                        }`}
                      >
                        <td className="py-3 px-4 font-semibold text-white flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-400" />
                          <span>{order.symbol}</span>
                          <span className="text-[11px] font-normal text-slate-400 hidden sm:inline">
                            ({order.name})
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <Badge
                            variant={order.category === 'core' ? 'bullish' : 'neutral'}
                            className="text-[10px] uppercase"
                          >
                            {order.category === 'core' ? 'Núcleo' : 'Satélite'}
                          </Badge>
                        </td>
                        <td className="py-3 px-3 font-mono">
                          {order.currentQuantity} {asset?.cedearRatio ? `(${asset.cedearRatio})` : ''}
                        </td>
                        <td className="py-3 px-3 font-mono">{order.currentWeightPct}%</td>
                        <td className="py-3 px-3 font-mono font-semibold text-slate-200">
                          {order.targetWeightPct}%
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`font-mono font-medium ${
                              order.driftPct < -config.driftTolerancePct
                                ? 'text-amber-400'
                                : order.driftPct > config.driftTolerancePct
                                ? 'text-blue-400'
                                : 'text-slate-400'
                            }`}
                          >
                            {order.driftPct > 0 ? `+${order.driftPct}` : order.driftPct}%
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono">
                          ${unitPrice.toLocaleString()} {config.currency}
                        </td>
                        <td className="py-3 px-3 font-mono text-sm font-bold text-emerald-400">
                          {order.sharesToBuy > 0 ? `+${order.sharesToBuy}` : '0'}
                        </td>
                        <td className="py-3 px-4 font-mono font-semibold text-emerald-300">
                          ${order.orderCost.toLocaleString()} {config.currency}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 2: Model & Target Weights */}
      {activeTab === 'model' && (
        <div className="space-y-6">
          {/* Preset buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-medium text-slate-400">Modelos Prediseñados:</span>
            <button
              onClick={() => applyPreset('balanced')}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-medium text-white border border-slate-700 transition-all"
            >
              ⚖️ Balanced Growth (55% SPY + Sectores)
            </button>
            <button
              onClick={() => applyPreset('boglehead')}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-medium text-white border border-slate-700 transition-all"
            >
              🏛️ Boglehead Clásico (80% SPY)
            </button>
            <button
              onClick={() => applyPreset('tech_growth')}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-medium text-white border border-slate-700 transition-all"
            >
              💻 Tech Overweight (XLK 30%)
            </button>
            <button
              onClick={() => applyPreset('defensive')}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-medium text-white border border-slate-700 transition-all"
            >
              🛡️ Defensivo (Salud & Utilities)
            </button>
          </div>

          <Card className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-semibold text-white">Configuración de Ponderaciones y Precios</h3>
              <div className="text-xs">
                Suma de pesos:{' '}
                <span
                  className={`font-bold font-mono ${
                    totalTargetWeight === 100 ? 'text-emerald-400' : 'text-amber-400'
                  }`}
                >
                  {totalTargetWeight}%
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {assets.map((asset, index) => (
                <div
                  key={asset.symbol}
                  className="p-3.5 rounded-xl bg-slate-800/50 border border-slate-700/60 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold text-sm text-white">{asset.symbol}</div>
                      <div className="text-[11px] text-slate-400">{asset.name}</div>
                    </div>
                    <Badge variant={asset.category === 'core' ? 'bullish' : 'neutral'}>
                      {asset.category === 'core' ? 'CORE' : 'SATÉLITE'}
                    </Badge>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Peso Objetivo:</span>
                      <span className="font-bold font-mono text-emerald-400">
                        {asset.targetWeightPct}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="1"
                      value={asset.targetWeightPct}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        const updated = [...assets];
                        updated[index] = { ...updated[index], targetWeightPct: val };
                        setAssets(updated);
                      }}
                      className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-700/40 text-[11px]">
                    <div>
                      <label className="text-slate-400">Tenencia</label>
                      <input
                        type="number"
                        min="0"
                        value={asset.currentQuantity}
                        onChange={(e) => {
                          const val = Math.max(0, Number(e.target.value));
                          const updated = [...assets];
                          updated[index] = { ...updated[index], currentQuantity: val };
                          setAssets(updated);
                        }}
                        className="w-full mt-0.5 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-slate-200"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400">Precio USD</label>
                      <input
                        type="number"
                        min="0"
                        value={asset.currentPriceUsd}
                        onChange={(e) => {
                          const val = Math.max(0, Number(e.target.value));
                          const updated = [...assets];
                          updated[index] = { ...updated[index], currentPriceUsd: val };
                          setAssets(updated);
                        }}
                        className="w-full mt-0.5 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-slate-200"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400">Precio ARS</label>
                      <input
                        type="number"
                        min="0"
                        value={asset.currentPriceArs}
                        onChange={(e) => {
                          const val = Math.max(0, Number(e.target.value));
                          const updated = [...assets];
                          updated[index] = { ...updated[index], currentPriceArs: val };
                          setAssets(updated);
                        }}
                        className="w-full mt-0.5 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-slate-200"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* TAB 3: Wealth Projections */}
      {activeTab === 'projection' && (
        <div className="space-y-6">
          <Card className="p-5 bg-slate-900 border border-slate-800 rounded-xl">
            <h3 className="text-sm font-semibold text-white mb-1">
              Simulación de Interés Compuesto (1 a 15 años)
            </h3>
            <p className="text-xs text-slate-400 mb-6">
              Calcula el efecto multiplicador de aportar ${config.monthlyDeposit} {config.currency} cada mes con una tasa esperada de {config.expectedAnnualReturnPct}% anual.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/60 text-[11px] text-slate-400 uppercase tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Horizonte</th>
                    <th className="py-3 px-4">Capital Aportado</th>
                    <th className="py-3 px-4">Ganancia Compuesta</th>
                    <th className="py-3 px-4 font-bold text-emerald-400">Patrimonio Proyectado</th>
                    <th className="py-3 px-4">Multiplicador</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {projections.map((p) => {
                    const multiplier = p.totalContributions > 0
                      ? (p.projectedPortfolioValue / p.totalContributions).toFixed(2)
                      : '1.00';

                    return (
                      <tr key={p.month} className="hover:bg-slate-800/40">
                        <td className="py-3 px-4 font-semibold text-white">
                          {p.year === 0 ? 'Mes 1' : `Año ${p.year}`}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-300">
                          ${p.totalContributions.toLocaleString()} USD
                        </td>
                        <td className="py-3 px-4 font-mono text-emerald-400 font-medium">
                          +${p.compoundGains.toLocaleString()} USD
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-emerald-300 text-sm">
                          ${p.projectedPortfolioValue.toLocaleString()} USD
                        </td>
                        <td className="py-3 px-4 font-mono text-xs">
                          <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            {multiplier}x
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 4: History */}
      {activeTab === 'history' && (
        <Card className="p-5 bg-slate-900 border border-slate-800 rounded-xl">
          <h3 className="text-sm font-semibold text-white mb-4">Registro de Aportes Mensuales</h3>

          {contributions.length === 0 ? (
            <div className="text-center py-10 text-slate-500 text-xs">
              Aún no registraste aportes mensuales en este plan.
            </div>
          ) : (
            <div className="space-y-3">
              {contributions.map((c) => (
                <div
                  key={c.id}
                  className="p-3.5 rounded-lg bg-slate-800/60 border border-slate-700/60 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <div className="font-semibold text-white">
                      Fecha: {c.date} — Monto: ${c.amount.toLocaleString()} {c.currency}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Órdenes: {c.orders.map((o) => `${o.symbol} x${o.quantity}`).join(', ')}
                    </div>
                  </div>
                  <Badge variant="bullish" className="text-[10px]">
                    Completado
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
