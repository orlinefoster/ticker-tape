import { useState } from 'react';
import { usePortfolioStore, type IOLHolding } from '@/store/portfolioStore';
import { parseBinanceCsv, reconcileBinanceRecords } from '@/lib/binanceImporter';
import { iolMcpClient } from '@/lib/iolMcp';

export default function PortfolioModule() {
  const [activeTab, setActiveTab] = useState<'consolidated' | 'cash' | 'iol' | 'binance' | 'history'>('consolidated');

  const {
    rates,
    setRates,
    cashHoldings,
    iolHoldings,
    binanceHoldings,
    transactions,
    getCashValuationUsd,
    getIOLValuationUsd,
    getBinanceValuationUsd,
    getTotalNetWorthUsd,
    addCashHolding,
    removeCashHolding,
    addIOLHolding,
    removeIOLHolding,
    addBinanceHolding,
    removeBinanceHolding,
    addTransaction,
    dismissAlert,
  } = usePortfolioStore();

  const cashValuationUsd = getCashValuationUsd();
  const iolValuationUsd = getIOLValuationUsd();
  const binanceValuationUsd = getBinanceValuationUsd();
  const totalNetWorthUsd = getTotalNetWorthUsd();
  const totalNetWorthArs = totalNetWorthUsd * rates.ccl;

  // Currency breakdown calculation
  const totalArsNominal =
    cashHoldings.filter((h) => h.currency === 'ARS').reduce((sum, h) => sum + h.amount, 0) +
    iolHoldings.filter((h) => h.currencyExposure === 'ARS').reduce((sum, h) => sum + h.nominalQuantity * h.currentPriceArs, 0);
  const totalArsInUsd = totalArsNominal / rates.ccl;
  const pctArs = totalNetWorthUsd > 0 ? (totalArsInUsd / totalNetWorthUsd) * 100 : 0;

  const totalUsdDirect =
    cashHoldings.filter((h) => h.currency === 'USD').reduce((sum, h) => sum + h.amount, 0) +
    iolHoldings.filter((h) => h.currencyExposure !== 'ARS').reduce((sum, h) => sum + (h.nominalQuantity * h.currentPriceArs) / rates.ccl, 0);
  const pctUsd = totalNetWorthUsd > 0 ? (totalUsdDirect / totalNetWorthUsd) * 100 : 0;

  const pctCrypto = totalNetWorthUsd > 0 ? (binanceValuationUsd / totalNetWorthUsd) * 100 : 0;

  // New item modal / states
  const [showAddCash, setShowAddCash] = useState(false);
  const [newCashCurrency, setNewCashCurrency] = useState<'ARS' | 'USD'>('USD');
  const [newCashAmount, setNewCashAmount] = useState('');
  const [newCashInstitution, setNewCashInstitution] = useState('');
  const [newCashYield, setNewCashYield] = useState('');

  const [showAddIol, setShowAddIol] = useState(false);
  const [newIolSymbol, setNewIolSymbol] = useState('');
  const [newIolName, setNewIolName] = useState('');
  const [newIolQty, setNewIolQty] = useState('');
  const [newIolPrice, setNewIolPrice] = useState('');
  const [newIolType, setNewIolType] = useState<IOLHolding['assetType']>('CEDEAR');

  const [showAddBinance, setShowAddBinance] = useState(false);
  const [newBinSymbol, setNewBinSymbol] = useState('');
  const [newBinName, setNewBinName] = useState('');
  const [newBinQty, setNewBinQty] = useState('');
  const [newBinPrice, setNewBinPrice] = useState('');

  // Binance CSV Importer State
  const [showBinanceImport, setShowBinanceImport] = useState(false);
  const [binanceCsvText, setBinanceCsvText] = useState('');
  const [binanceImportSuccess, setBinanceImportSuccess] = useState<string | null>(null);

  // IOL MCP State
  const [iolMcpStatus, setIolMcpStatus] = useState<string | null>(null);
  const [syncingIol, setSyncingIol] = useState(false);

  const handleCreateCash = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCashAmount || !newCashInstitution) return;
    addCashHolding({
      currency: newCashCurrency,
      amount: parseFloat(newCashAmount),
      institution: newCashInstitution,
      yieldRateAnnual: newCashYield ? parseFloat(newCashYield) : undefined,
    });
    setNewCashAmount('');
    setNewCashInstitution('');
    setNewCashYield('');
    setShowAddCash(false);
  };

  const handleCreateIol = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIolSymbol || !newIolQty || !newIolPrice) return;
    const qty = parseFloat(newIolQty);
    const price = parseFloat(newIolPrice);
    addIOLHolding({
      symbol: newIolSymbol.toUpperCase(),
      name: newIolName || newIolSymbol.toUpperCase(),
      assetType: newIolType,
      nominalQuantity: qty,
      avgBuyPriceArs: price,
      currentPriceArs: price,
      currencyExposure: newIolType === 'ACCION_LOCAL' ? 'ARS' : 'USD_CCL',
    });
    addTransaction({
      portfolioType: 'iol',
      type: 'COMPRA',
      symbol: newIolSymbol.toUpperCase(),
      quantity: qty,
      price,
      currency: 'ARS',
      totalNominal: qty * price,
      notes: 'Alta manual de tenencia IOL',
    });
    setNewIolSymbol('');
    setNewIolName('');
    setNewIolQty('');
    setNewIolPrice('');
    setShowAddIol(false);
  };

  const handleCreateBinance = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBinSymbol || !newBinQty || !newBinPrice) return;
    const qty = parseFloat(newBinQty);
    const price = parseFloat(newBinPrice);
    addBinanceHolding({
      symbol: newBinSymbol.toUpperCase(),
      name: newBinName || `${newBinSymbol.toUpperCase()} Spot`,
      amount: qty,
      avgBuyPriceUsdt: price,
      currentPriceUsdt: price,
    });
    addTransaction({
      portfolioType: 'binance',
      type: 'COMPRA',
      symbol: newBinSymbol.toUpperCase(),
      quantity: qty,
      price,
      currency: 'USDT',
      totalNominal: qty * price,
      notes: 'Alta manual de posición Binance',
    });
    setNewBinSymbol('');
    setNewBinName('');
    setNewBinQty('');
    setNewBinPrice('');
    setShowAddBinance(false);
  };

  const handleProcessBinanceCsv = (e: React.FormEvent) => {
    e.preventDefault();
    if (!binanceCsvText.trim()) return;

    const parsed = parseBinanceCsv(binanceCsvText);
    if (parsed.length === 0) {
      alert('No se detectaron filas válidas en el formato de Binance.');
      return;
    }

    const result = reconcileBinanceRecords(parsed, binanceHoldings);

    // Apply updated holdings and append transactions
    usePortfolioStore.setState({
      binanceHoldings: result.updatedHoldings,
    });

    for (const tx of result.transactionsGenerated) {
      addTransaction(tx);
    }

    // Dismiss pending reconciliation alert if present
    dismissAlert('alt-1');

    setBinanceImportSuccess(
      `✅ Se procesaron ${result.recordsParsed} registros de Binance. Se actualizaron ${result.updatedHoldings.length} activos y se generaron ${result.transactionsGenerated.length} transacciones en el libro contable.`
    );
    setBinanceCsvText('');
    setTimeout(() => setBinanceImportSuccess(null), 6000);
    setShowBinanceImport(false);
  };

  const handlePingIolMcp = async () => {
    setIolMcpStatus('Probando conexión con https://mcp.invertironline.com/...');
    const res = await iolMcpClient.ping();
    setIolMcpStatus(`✅ ${res.message} (Latencia: ${res.latencyMs}ms)`);
  };

  const handleSyncIolMcp = async () => {
    setSyncingIol(true);
    setIolMcpStatus('Sincronizando portafolio vía IOL MCP...');
    try {
      const syncResult = await iolMcpClient.syncPortfolio();
      usePortfolioStore.setState({
        iolHoldings: syncResult.holdings,
      });
      dismissAlert('alt-2');
      setIolMcpStatus(`✅ Sincronizados exitosamente ${syncResult.holdings.length} activos desde el MCP oficial de IOL.`);
    } catch {
      setIolMcpStatus('❌ Error al sincronizar con el MCP de IOL.');
    } finally {
      setSyncingIol(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header & Net Worth Ribbon */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 20px',
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'monospace' }}>
              Patrimonio Consolidado (USD)
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-bright)', fontFamily: 'monospace' }}>
              ${totalNetWorthUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>

          <div style={{ width: '1px', height: '36px', backgroundColor: 'var(--border)' }} />

          <div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'monospace' }}>
              Valuación Implícita (ARS CCL)
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
              ${totalNetWorthArs.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
            </div>
          </div>
        </div>

        {/* Currency & Portfolio Distribution Bar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '320px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
            <span>Cash: {((cashValuationUsd / totalNetWorthUsd) * 100 || 0).toFixed(1)}%</span>
            <span>IOL: {((iolValuationUsd / totalNetWorthUsd) * 100 || 0).toFixed(1)}%</span>
            <span>Cripto: {((binanceValuationUsd / totalNetWorthUsd) * 100 || 0).toFixed(1)}%</span>
          </div>

          <div style={{ display: 'flex', height: '6px', borderRadius: '3px', overflow: 'hidden', backgroundColor: 'var(--border)' }}>
            <div style={{ width: `${(cashValuationUsd / totalNetWorthUsd) * 100}%`, backgroundColor: 'var(--accent)' }} title="Cash" />
            <div style={{ width: `${(iolValuationUsd / totalNetWorthUsd) * 100}%`, backgroundColor: 'var(--signal-warning)' }} title="IOL" />
            <div style={{ width: `${(binanceValuationUsd / totalNetWorthUsd) * 100}%`, backgroundColor: 'var(--signal-bullish)' }} title="Binance" />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
            <span>Riesgo Divisa: USD {pctUsd.toFixed(0)}% | ARS {pctArs.toFixed(0)}% | USDT {pctCrypto.toFixed(0)}%</span>
          </div>
        </div>

        {/* CCL Rate adjuster */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
          <span>CCL:</span>
          <input
            type="number"
            value={rates.ccl}
            onChange={(e) => setRates({ ccl: parseFloat(e.target.value) || 1320 })}
            style={{
              width: '80px',
              padding: '3px 6px',
              backgroundColor: 'var(--bg-surface-card)',
              color: 'var(--text-bright)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              fontFamily: 'monospace',
              fontWeight: 700,
            }}
          />
        </div>
      </div>

      {/* Tabs Subnavigation */}
      <div
        style={{
          display: 'flex',
          gap: '2px',
          borderBottom: '1px solid var(--border)',
          backgroundColor: 'var(--bg-surface)',
          borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0',
          padding: '4px 6px 0',
        }}
      >
        {[
          { id: 'consolidated', label: '📊 Resumen Consolidado' },
          { id: 'cash', label: `💵 Dinero & Cash ($${cashValuationUsd.toLocaleString('en-US', { maximumFractionDigits: 0 })})` },
          { id: 'iol', label: `🇦🇷 Cartera IOL ($${iolValuationUsd.toLocaleString('en-US', { maximumFractionDigits: 0 })})` },
          { id: 'binance', label: `⚡ Binance Cripto ($${binanceValuationUsd.toLocaleString('en-US', { maximumFractionDigits: 0 })})` },
          { id: 'history', label: '📜 Historial de Operaciones' },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              style={{
                padding: '8px 14px',
                border: 'none',
                borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                backgroundColor: isActive ? 'var(--bg-surface-card)' : 'transparent',
                color: isActive ? 'var(--text-bright)' : 'var(--text-secondary)',
                fontSize: '0.8rem',
                fontWeight: isActive ? 700 : 500,
                cursor: 'pointer',
                borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0',
                transition: 'all var(--transition-fast)',
                fontFamily: 'monospace',
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Feedback Toast */}
      {binanceImportSuccess && (
        <div
          style={{
            padding: '10px 14px',
            backgroundColor: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid var(--signal-bullish)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--signal-bullish)',
            fontSize: '0.8rem',
            fontFamily: 'monospace',
          }}
        >
          {binanceImportSuccess}
        </div>
      )}

      {/* Tab 1: Consolidated Overview */}
      {activeTab === 'consolidated' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
          {/* Card 1: Dinero / Cash */}
          <div
            style={{
              padding: '16px',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-bright)', fontFamily: 'monospace' }}>
                💵 DINERO & LIQUIDEZ
              </div>
              <span style={{ fontSize: '0.7rem', color: 'var(--accent)', backgroundColor: 'var(--accent-muted)', padding: '2px 6px', borderRadius: '3px', fontWeight: 700 }}>
                {cashHoldings.length} cuentas
              </span>
            </div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-bright)', fontFamily: 'monospace' }}>
              ${cashValuationUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>USD</span>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {cashHoldings.map((c) => (
                <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '4px' }}>
                  <span>{c.institution}</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                    {c.currency} {c.amount.toLocaleString()}{' '}
                    {c.yieldRateAnnual ? <span style={{ color: 'var(--signal-bullish)', fontSize: '0.7rem' }}>({c.yieldRateAnnual}% TNA)</span> : null}
                  </span>
                </div>
              ))}
            </div>
            <button
              onClick={() => setActiveTab('cash')}
              style={{
                marginTop: 'auto',
                padding: '6px',
                border: '1px solid var(--border)',
                backgroundColor: 'var(--bg-surface-card)',
                color: 'var(--text-secondary)',
                fontSize: '0.75rem',
                cursor: 'pointer',
                borderRadius: 'var(--radius-sm)',
                fontFamily: 'monospace',
              }}
            >
              Administrar Liquidez →
            </button>
          </div>

          {/* Card 2: Cartera IOL */}
          <div
            style={{
              padding: '16px',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-bright)', fontFamily: 'monospace' }}>
                🇦🇷 CARTERA IOL (BYMA)
              </div>
              <span style={{ fontSize: '0.7rem', color: 'var(--signal-warning)', backgroundColor: 'var(--signal-warning-muted)', padding: '2px 6px', borderRadius: '3px', fontWeight: 700 }}>
                {iolHoldings.length} activos
              </span>
            </div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-bright)', fontFamily: 'monospace' }}>
              ${iolValuationUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>USD</span>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {iolHoldings.slice(0, 4).map((i) => {
                const valArs = i.nominalQuantity * i.currentPriceArs;
                const pnlPct = ((i.currentPriceArs - i.avgBuyPriceArs) / i.avgBuyPriceArs) * 100;
                return (
                  <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '4px' }}>
                    <span>
                      <strong style={{ color: 'var(--text-bright)' }}>{i.symbol}</strong> ({i.assetType})
                    </span>
                    <span style={{ fontFamily: 'monospace' }}>
                      ${(valArs / rates.ccl).toLocaleString('en-US', { maximumFractionDigits: 0 })} USD{' '}
                      <span style={{ color: pnlPct >= 0 ? 'var(--signal-bullish)' : 'var(--signal-bearish)' }}>
                        {pnlPct >= 0 ? '+' : ''}
                        {pnlPct.toFixed(1)}%
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
            <button
              onClick={() => setActiveTab('iol')}
              style={{
                marginTop: 'auto',
                padding: '6px',
                border: '1px solid var(--border)',
                backgroundColor: 'var(--bg-surface-card)',
                color: 'var(--text-secondary)',
                fontSize: '0.75rem',
                cursor: 'pointer',
                borderRadius: 'var(--radius-sm)',
                fontFamily: 'monospace',
              }}
            >
              Abrir Cartera IOL & MCP →
            </button>
          </div>

          {/* Card 3: Cartera Binance */}
          <div
            style={{
              padding: '16px',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-bright)', fontFamily: 'monospace' }}>
                ⚡ BINANCE CRIPTO
              </div>
              <span style={{ fontSize: '0.7rem', color: 'var(--signal-bullish)', backgroundColor: 'var(--signal-bullish-muted)', padding: '2px 6px', borderRadius: '3px', fontWeight: 700 }}>
                {binanceHoldings.length} monedas
              </span>
            </div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-bright)', fontFamily: 'monospace' }}>
              ${binanceValuationUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>USDT</span>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {binanceHoldings.map((b) => {
                const val = b.amount * b.currentPriceUsdt;
                const pnl = ((b.currentPriceUsdt - b.avgBuyPriceUsdt) / b.avgBuyPriceUsdt) * 100;
                return (
                  <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '4px' }}>
                    <span>
                      <strong style={{ color: 'var(--text-bright)' }}>{b.symbol}</strong> ({b.amount})
                    </span>
                    <span style={{ fontFamily: 'monospace' }}>
                      ${val.toLocaleString('en-US', { maximumFractionDigits: 0 })}{' '}
                      <span style={{ color: pnl >= 0 ? 'var(--signal-bullish)' : 'var(--signal-bearish)' }}>
                        {pnl >= 0 ? '+' : ''}
                        {pnl.toFixed(1)}%
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
            <button
              onClick={() => setActiveTab('binance')}
              style={{
                marginTop: 'auto',
                padding: '6px',
                border: '1px solid var(--border)',
                backgroundColor: 'var(--bg-surface-card)',
                color: 'var(--text-secondary)',
                fontSize: '0.75rem',
                cursor: 'pointer',
                borderRadius: 'var(--radius-sm)',
                fontFamily: 'monospace',
              }}
            >
              Ver Posiciones Cripto →
            </button>
          </div>
        </div>
      )}

      {/* Tab 2: Cash / Dinero */}
      {activeTab === 'cash' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', backgroundColor: 'var(--bg-surface)', padding: '16px', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-bright)', fontFamily: 'monospace' }}>Control de Dinero & Liquidez</h3>
              <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Gestión de disponibilidades líquidas en bancos, efectivo físico y colocaciones de muy corto plazo (cauciones / money market).
              </p>
            </div>
            <button
              onClick={() => setShowAddCash(true)}
              style={{
                padding: '6px 12px',
                backgroundColor: 'var(--accent)',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                fontWeight: 700,
                fontSize: '0.78rem',
                cursor: 'pointer',
                fontFamily: 'monospace',
              }}
            >
              + Agregar Cuenta/Saldo
            </button>
          </div>

          {/* Modal / Form Inline */}
          {showAddCash && (
            <form onSubmit={handleCreateCash} style={{ display: 'flex', gap: '10px', padding: '12px', backgroundColor: 'var(--bg-surface-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
              <select
                value={newCashCurrency}
                onChange={(e) => setNewCashCurrency(e.target.value as 'ARS' | 'USD')}
                style={{ padding: '6px', backgroundColor: 'var(--bg-canvas)', color: 'var(--text-bright)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}
              >
                <option value="USD">USD</option>
                <option value="ARS">ARS</option>
              </select>
              <input
                type="text"
                placeholder="Institución (ej. Banco Santander, Caja)"
                value={newCashInstitution}
                onChange={(e) => setNewCashInstitution(e.target.value)}
                style={{ flex: 1, padding: '6px', backgroundColor: 'var(--bg-canvas)', color: 'var(--text-bright)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}
              />
              <input
                type="number"
                placeholder="Monto"
                value={newCashAmount}
                onChange={(e) => setNewCashAmount(e.target.value)}
                style={{ width: '130px', padding: '6px', backgroundColor: 'var(--bg-canvas)', color: 'var(--text-bright)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}
              />
              <input
                type="number"
                placeholder="TNA % (opcional)"
                value={newCashYield}
                onChange={(e) => setNewCashYield(e.target.value)}
                style={{ width: '130px', padding: '6px', backgroundColor: 'var(--bg-canvas)', color: 'var(--text-bright)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}
              />
              <button type="submit" style={{ padding: '6px 12px', backgroundColor: 'var(--signal-bullish)', color: '#000', border: 'none', borderRadius: 'var(--radius-sm)', fontWeight: 700, cursor: 'pointer' }}>
                Guardar
              </button>
              <button type="button" onClick={() => setShowAddCash(false)} style={{ padding: '6px 10px', backgroundColor: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}>
                Cancelar
              </button>
            </form>
          )}

          {/* Table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', fontFamily: 'monospace' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', textAlign: 'left' }}>
                <th style={{ padding: '8px' }}>INSTITUCIÓN / DESTINO</th>
                <th style={{ padding: '8px' }}>MONEDA</th>
                <th style={{ padding: '8px', textAlign: 'right' }}>MONTO NOMINAL</th>
                <th style={{ padding: '8px', textAlign: 'right' }}>VALOR USD</th>
                <th style={{ padding: '8px', textAlign: 'right' }}>RENDIMIENTO (TNA)</th>
                <th style={{ padding: '8px', textAlign: 'center' }}>ACCIONES</th>
              </tr>
            </thead>
            <tbody>
              {cashHoldings.map((c) => {
                const valUsd = c.currency === 'USD' ? c.amount : c.amount / rates.ccl;
                return (
                  <tr key={c.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '8px', color: 'var(--text-bright)', fontWeight: 600 }}>{c.institution}</td>
                    <td style={{ padding: '8px' }}>
                      <span style={{ padding: '2px 5px', borderRadius: '3px', backgroundColor: c.currency === 'USD' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(59, 130, 246, 0.15)', color: c.currency === 'USD' ? 'var(--signal-bullish)' : 'var(--accent)' }}>
                        {c.currency}
                      </span>
                    </td>
                    <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700 }}>{c.amount.toLocaleString()}</td>
                    <td style={{ padding: '8px', textAlign: 'right', color: 'var(--text-secondary)' }}>${valUsd.toFixed(2)}</td>
                    <td style={{ padding: '8px', textAlign: 'right', color: c.yieldRateAnnual ? 'var(--signal-bullish)' : 'var(--text-muted)' }}>
                      {c.yieldRateAnnual ? `${c.yieldRateAnnual}%` : '—'}
                    </td>
                    <td style={{ padding: '8px', textAlign: 'center' }}>
                      <button
                        onClick={() => removeCashHolding(c.id)}
                        style={{ border: 'none', background: 'transparent', color: 'var(--signal-bearish)', cursor: 'pointer', fontSize: '0.75rem' }}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 3: Cartera IOL */}
      {activeTab === 'iol' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', backgroundColor: 'var(--bg-surface)', padding: '16px', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
          {/* Banner MCP IOL */}
          <div
            style={{
              padding: '12px 16px',
              backgroundColor: 'var(--bg-surface-card)',
              border: '1px solid var(--signal-warning)',
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--signal-warning)', fontFamily: 'monospace' }}>
                🔌 CONECTOR OFICIAL IOL MCP ACTIVO
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                Endpoint configurado: <code>https://mcp.invertironline.com/</code>. Sincroniza órdenes, saldos y cotizaciones BYMA vía protocolo MCP.
              </div>
              {iolMcpStatus && (
                <div style={{ marginTop: '4px', fontSize: '0.72rem', color: 'var(--text-bright)', fontFamily: 'monospace' }}>
                  {iolMcpStatus}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={handlePingIolMcp}
                style={{
                  padding: '6px 12px',
                  backgroundColor: 'var(--bg-surface)',
                  color: 'var(--signal-warning)',
                  border: '1px solid var(--signal-warning)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'monospace',
                }}
              >
                Test MCP Handshake
              </button>
              <button
                onClick={handleSyncIolMcp}
                disabled={syncingIol}
                style={{
                  padding: '6px 12px',
                  backgroundColor: 'var(--signal-warning)',
                  color: '#000',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  cursor: syncingIol ? 'not-allowed' : 'pointer',
                  fontFamily: 'monospace',
                }}
              >
                {syncingIol ? 'Sincronizando...' : '⚡ Sincronizar Portafolio IOL'}
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-bright)', fontFamily: 'monospace' }}>Tenencias IOL (BYMA & CEDEARs)</h3>
            <button
              onClick={() => setShowAddIol(true)}
              style={{
                padding: '6px 12px',
                backgroundColor: 'var(--accent)',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                fontWeight: 700,
                fontSize: '0.78rem',
                cursor: 'pointer',
                fontFamily: 'monospace',
              }}
            >
              + Agregar Activo IOL
            </button>
          </div>

          {/* Form */}
          {showAddIol && (
            <form onSubmit={handleCreateIol} style={{ display: 'flex', gap: '8px', padding: '12px', backgroundColor: 'var(--bg-surface-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
              <input
                type="text"
                placeholder="Ticker (ej. SPY, GGAL)"
                value={newIolSymbol}
                onChange={(e) => setNewIolSymbol(e.target.value)}
                style={{ width: '110px', padding: '6px', backgroundColor: 'var(--bg-canvas)', color: 'var(--text-bright)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}
              />
              <select
                value={newIolType}
                onChange={(e) => setNewIolType(e.target.value as IOLHolding['assetType'])}
                style={{ padding: '6px', backgroundColor: 'var(--bg-canvas)', color: 'var(--text-bright)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}
              >
                <option value="CEDEAR">CEDEAR</option>
                <option value="ACCION_LOCAL">Acción Local</option>
                <option value="BONO_SOBERANO">Bono</option>
                <option value="ON_CORPORATIVA">ON Corp</option>
              </select>
              <input
                type="number"
                placeholder="Cantidad"
                value={newIolQty}
                onChange={(e) => setNewIolQty(e.target.value)}
                style={{ width: '100px', padding: '6px', backgroundColor: 'var(--bg-canvas)', color: 'var(--text-bright)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}
              />
              <input
                type="number"
                placeholder="Precio ARS"
                value={newIolPrice}
                onChange={(e) => setNewIolPrice(e.target.value)}
                style={{ width: '120px', padding: '6px', backgroundColor: 'var(--bg-canvas)', color: 'var(--text-bright)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}
              />
              <button type="submit" style={{ padding: '6px 12px', backgroundColor: 'var(--signal-bullish)', color: '#000', border: 'none', borderRadius: 'var(--radius-sm)', fontWeight: 700, cursor: 'pointer' }}>
                Guardar
              </button>
              <button type="button" onClick={() => setShowAddIol(false)} style={{ padding: '6px 10px', backgroundColor: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}>
                Cancelar
              </button>
            </form>
          )}

          {/* Table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', fontFamily: 'monospace' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', textAlign: 'left' }}>
                <th style={{ padding: '8px' }}>TICKER</th>
                <th style={{ padding: '8px' }}>TIPO</th>
                <th style={{ padding: '8px', textAlign: 'right' }}>CANTIDAD</th>
                <th style={{ padding: '8px', textAlign: 'right' }}>P. COMPRA</th>
                <th style={{ padding: '8px', textAlign: 'right' }}>P. ACTUAL</th>
                <th style={{ padding: '8px', textAlign: 'right' }}>VALUACIÓN ARS</th>
                <th style={{ padding: '8px', textAlign: 'right' }}>VALUACIÓN USD</th>
                <th style={{ padding: '8px', textAlign: 'right' }}>PNL %</th>
                <th style={{ padding: '8px', textAlign: 'center' }}>ACCIONES</th>
              </tr>
            </thead>
            <tbody>
              {iolHoldings.map((i) => {
                const totalArs = i.nominalQuantity * i.currentPriceArs;
                const totalUsd = totalArs / rates.ccl;
                const pnl = ((i.currentPriceArs - i.avgBuyPriceArs) / i.avgBuyPriceArs) * 100;
                return (
                  <tr key={i.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '8px', fontWeight: 700, color: 'var(--text-bright)' }}>{i.symbol}</td>
                    <td style={{ padding: '8px', color: 'var(--text-secondary)' }}>{i.assetType}</td>
                    <td style={{ padding: '8px', textAlign: 'right', fontWeight: 600 }}>{i.nominalQuantity.toLocaleString()}</td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>${i.avgBuyPriceArs.toLocaleString()}</td>
                    <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700, color: 'var(--text-bright)' }}>${i.currentPriceArs.toLocaleString()}</td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>${totalArs.toLocaleString()}</td>
                    <td style={{ padding: '8px', textAlign: 'right', color: 'var(--accent)' }}>${totalUsd.toFixed(2)}</td>
                    <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700, color: pnl >= 0 ? 'var(--signal-bullish)' : 'var(--signal-bearish)' }}>
                      {pnl >= 0 ? '+' : ''}
                      {pnl.toFixed(2)}%
                    </td>
                    <td style={{ padding: '8px', textAlign: 'center' }}>
                      <button
                        onClick={() => removeIOLHolding(i.id)}
                        style={{ border: 'none', background: 'transparent', color: 'var(--signal-bearish)', cursor: 'pointer', fontSize: '0.75rem' }}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 4: Cartera Binance */}
      {activeTab === 'binance' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', backgroundColor: 'var(--bg-surface)', padding: '16px', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-bright)', fontFamily: 'monospace' }}>Cartera Cripto (Binance Spot & Data)</h3>
              <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Seguimiento de saldo de monedas, stablecoins y conciliación de movimientos de Binance.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setShowBinanceImport(true)}
                style={{
                  padding: '6px 12px',
                  backgroundColor: 'var(--bg-surface-card)',
                  color: 'var(--signal-bullish)',
                  border: '1px solid var(--signal-bullish)',
                  borderRadius: 'var(--radius-sm)',
                  fontWeight: 700,
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  fontFamily: 'monospace',
                }}
              >
                📥 Importar Trades / CSV
              </button>
              <button
                onClick={() => setShowAddBinance(true)}
                style={{
                  padding: '6px 12px',
                  backgroundColor: 'var(--accent)',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  fontWeight: 700,
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  fontFamily: 'monospace',
                }}
              >
                + Agregar Posición Manual
              </button>
            </div>
          </div>

          {/* Modal / Form CSV Importer */}
          {showBinanceImport && (
            <form
              onSubmit={handleProcessBinanceCsv}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                padding: '14px',
                backgroundColor: 'var(--bg-surface-card)',
                border: '1px solid var(--signal-bullish)',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--signal-bullish)', fontFamily: 'monospace' }}>
                  📥 Importador & Conciliador de Movimientos de Binance
                </span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Formatos soportados: Trade History & Transaction History</span>
              </div>
              <textarea
                rows={5}
                placeholder="Pegá aquí el contenido de tu export CSV de Binance..."
                value={binanceCsvText}
                onChange={(e) => setBinanceCsvText(e.target.value)}
                style={{
                  padding: '8px',
                  backgroundColor: 'var(--bg-canvas)',
                  color: 'var(--text-bright)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  fontFamily: 'monospace',
                  fontSize: '0.75rem',
                }}
              />
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowBinanceImport(false)}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: 'transparent',
                    border: '1px solid var(--border)',
                    color: 'var(--text-muted)',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '6px 14px',
                    backgroundColor: 'var(--signal-bullish)',
                    color: '#000000',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                    fontFamily: 'monospace',
                  }}
                >
                  Procesar y Conciliar
                </button>
              </div>
            </form>
          )}

          {showAddBinance && (
            <form onSubmit={handleCreateBinance} style={{ display: 'flex', gap: '8px', padding: '12px', backgroundColor: 'var(--bg-surface-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
              <input
                type="text"
                placeholder="Símbolo (BTC, ETH)"
                value={newBinSymbol}
                onChange={(e) => setNewBinSymbol(e.target.value)}
                style={{ width: '120px', padding: '6px', backgroundColor: 'var(--bg-canvas)', color: 'var(--text-bright)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}
              />
              <input
                type="number"
                step="any"
                placeholder="Cantidad"
                value={newBinQty}
                onChange={(e) => setNewBinQty(e.target.value)}
                style={{ width: '120px', padding: '6px', backgroundColor: 'var(--bg-canvas)', color: 'var(--text-bright)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}
              />
              <input
                type="number"
                step="any"
                placeholder="Precio USDT"
                value={newBinPrice}
                onChange={(e) => setNewBinPrice(e.target.value)}
                style={{ width: '130px', padding: '6px', backgroundColor: 'var(--bg-canvas)', color: 'var(--text-bright)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}
              />
              <button type="submit" style={{ padding: '6px 12px', backgroundColor: 'var(--signal-bullish)', color: '#000', border: 'none', borderRadius: 'var(--radius-sm)', fontWeight: 700, cursor: 'pointer' }}>
                Guardar
              </button>
              <button type="button" onClick={() => setShowAddBinance(false)} style={{ padding: '6px 10px', backgroundColor: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}>
                Cancelar
              </button>
            </form>
          )}

          {/* Table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', fontFamily: 'monospace' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', textAlign: 'left' }}>
                <th style={{ padding: '8px' }}>ACTIVO</th>
                <th style={{ padding: '8px', textAlign: 'right' }}>BALANCE</th>
                <th style={{ padding: '8px', textAlign: 'right' }}>P. COMPRA (USDT)</th>
                <th style={{ padding: '8px', textAlign: 'right' }}>P. ACTUAL (USDT)</th>
                <th style={{ padding: '8px', textAlign: 'right' }}>VALUACIÓN USDT</th>
                <th style={{ padding: '8px', textAlign: 'right' }}>PNL %</th>
                <th style={{ padding: '8px', textAlign: 'center' }}>ACCIONES</th>
              </tr>
            </thead>
            <tbody>
              {binanceHoldings.map((b) => {
                const total = b.amount * b.currentPriceUsdt;
                const pnl = ((b.currentPriceUsdt - b.avgBuyPriceUsdt) / b.avgBuyPriceUsdt) * 100;
                return (
                  <tr key={b.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '8px', fontWeight: 700, color: 'var(--text-bright)' }}>{b.symbol}</td>
                    <td style={{ padding: '8px', textAlign: 'right', fontWeight: 600 }}>{b.amount}</td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>${b.avgBuyPriceUsdt.toLocaleString()}</td>
                    <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700, color: 'var(--text-bright)' }}>${b.currentPriceUsdt.toLocaleString()}</td>
                    <td style={{ padding: '8px', textAlign: 'right', color: 'var(--signal-bullish)' }}>${total.toFixed(2)}</td>
                    <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700, color: pnl >= 0 ? 'var(--signal-bullish)' : 'var(--signal-bearish)' }}>
                      {pnl >= 0 ? '+' : ''}
                      {pnl.toFixed(2)}%
                    </td>
                    <td style={{ padding: '8px', textAlign: 'center' }}>
                      <button
                        onClick={() => removeBinanceHolding(b.id)}
                        style={{ border: 'none', background: 'transparent', color: 'var(--signal-bearish)', cursor: 'pointer', fontSize: '0.75rem' }}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 5: History */}
      {activeTab === 'history' && (
        <div style={{ backgroundColor: 'var(--bg-surface)', padding: '16px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: '0.8rem', fontFamily: 'monospace' }}>
          <h3 style={{ margin: '0 0 12px', fontSize: '1rem', color: 'var(--text-bright)' }}>Libro Contable Unificado de Transacciones</h3>
          {transactions.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
              No hay transacciones manuales registradas en este período.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', textAlign: 'left' }}>
                  <th style={{ padding: '6px' }}>FECHA</th>
                  <th style={{ padding: '6px' }}>CARTERA</th>
                  <th style={{ padding: '6px' }}>TIPO</th>
                  <th style={{ padding: '6px' }}>SÍMBOLO</th>
                  <th style={{ padding: '6px', textAlign: 'right' }}>CANTIDAD</th>
                  <th style={{ padding: '6px', textAlign: 'right' }}>PRECIO</th>
                  <th style={{ padding: '6px', textAlign: 'right' }}>TOTAL</th>
                  <th style={{ padding: '6px' }}>NOTAS</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '6px', color: 'var(--text-secondary)' }}>{new Date(tx.timestamp).toLocaleString()}</td>
                    <td style={{ padding: '6px', textTransform: 'uppercase', color: 'var(--accent)' }}>{tx.portfolioType}</td>
                    <td style={{ padding: '6px', fontWeight: 700, color: tx.type === 'COMPRA' ? 'var(--signal-bullish)' : 'var(--signal-bearish)' }}>{tx.type}</td>
                    <td style={{ padding: '6px', fontWeight: 700 }}>{tx.symbol || '—'}</td>
                    <td style={{ padding: '6px', textAlign: 'right' }}>{tx.quantity || '—'}</td>
                    <td style={{ padding: '6px', textAlign: 'right' }}>{tx.price ? `$${tx.price.toLocaleString()}` : '—'}</td>
                    <td style={{ padding: '6px', textAlign: 'right', fontWeight: 700 }}>{tx.currency} {tx.totalNominal.toLocaleString()}</td>
                    <td style={{ padding: '6px', color: 'var(--text-muted)' }}>{tx.notes || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
