import React, { useState } from 'react'

export interface StageScore {
  stage: number
  name: string
  score: number
  description: string
}

export interface LeadingLaggingStatus {
  bonds_status: string
  stocks_status: string
  commodities_status: string
  dollar_status: string
  summary: string
}

interface MurphyClockProps {
  currentStage: number
  stageName: string
  stageDescription: string
  confidence: number
  stageScores: StageScore[]
  leaders: LeadingLaggingStatus
}

interface StageInfo {
  num: number
  title: string
  subtitle: string
  bonds: 'up' | 'down'
  stocks: 'up' | 'down'
  commodities: 'up' | 'down'
  color: string
  economicPhase: string
}

const STAGES: StageInfo[] = [
  {
    num: 1,
    title: 'Etapa 1',
    subtitle: 'Fondo de Bonos',
    bonds: 'up',
    stocks: 'down',
    commodities: 'down',
    color: '#3B82F6', // Blue
    economicPhase: 'Recuperación Inicial',
  },
  {
    num: 2,
    title: 'Etapa 2',
    subtitle: 'Giro de Acciones',
    bonds: 'up',
    stocks: 'up',
    commodities: 'down',
    color: '#10B981', // Emerald
    economicPhase: 'Despegue Bull Market',
  },
  {
    num: 3,
    title: 'Etapa 3',
    subtitle: 'Auge Commodities',
    bonds: 'down',
    stocks: 'up',
    commodities: 'up',
    color: '#06B6D4', // Cyan
    economicPhase: 'Expansión Plena',
  },
  {
    num: 4,
    title: 'Etapa 4',
    subtitle: 'Techo Inflación',
    bonds: 'down',
    stocks: 'down',
    commodities: 'up',
    color: '#F59E0B', // Amber
    economicPhase: 'Sobrecalentamiento',
  },
  {
    num: 5,
    title: 'Etapa 5',
    subtitle: 'Contracción',
    bonds: 'down',
    stocks: 'down',
    commodities: 'down',
    color: '#EF4444', // Red
    economicPhase: 'Crisis de Liquidez',
  },
  {
    num: 6,
    title: 'Etapa 6',
    subtitle: 'Pivote de Bonos',
    bonds: 'up',
    stocks: 'down',
    commodities: 'down',
    color: '#8B5CF6', // Purple
    economicPhase: 'Recesión / Tasas Bajas',
  },
]

export const MurphyClock: React.FC<MurphyClockProps> = ({
  currentStage,
  stageName,
  stageDescription,
  confidence,
  stageScores,
  leaders,
}) => {
  const [selectedStage, setSelectedStage] = useState<number>(currentStage)

  const activeInfo = STAGES.find(s => s.num === selectedStage) || STAGES[1]
  const currentInfo = STAGES.find(s => s.num === currentStage) || STAGES[1]

  // Geometry for 6 circular sectors
  const size = 380
  const center = size / 2
  const outerRadius = 160
  const innerRadius = 100

  // Angles: Stage 1 at top-left (-120°), moving clockwise
  // 6 stages -> 60° each: [Stage 1: -120 to -60, Stage 2: -60 to 0, Stage 3: 0 to 60, Stage 4: 60 to 120, Stage 5: 120 to 180, Stage 6: 180 to 240]
  const stageAngles: Record<number, { start: number; end: number; mid: number }> = {
    1: { start: -120, end: -60, mid: -90 },
    2: { start: -60, end: 0, mid: -30 },
    3: { start: 0, end: 60, mid: 30 },
    4: { start: 60, end: 120, mid: 90 },
    5: { start: 120, end: 180, mid: 150 },
    6: { start: 180, end: 240, mid: 210 },
  }

  const degToRad = (deg: number) => (deg * Math.PI) / 180

  const describeArc = (startAngle: number, endAngle: number, rIn: number, rOut: number) => {
    const sRad = degToRad(startAngle)
    const eRad = degToRad(endAngle)

    const x1 = center + rOut * Math.cos(sRad)
    const y1 = center + rOut * Math.sin(sRad)
    const x2 = center + rOut * Math.cos(eRad)
    const y2 = center + rOut * Math.sin(eRad)

    const x3 = center + rIn * Math.cos(eRad)
    const y3 = center + rIn * Math.sin(eRad)
    const x4 = center + rIn * Math.cos(sRad)
    const y4 = center + rIn * Math.sin(sRad)

    return `M ${x1} ${y1} A ${rOut} ${rOut} 0 0 1 ${x2} ${y2} L ${x3} ${y3} A ${rIn} ${rIn} 0 0 0 ${x4} ${y4} Z`
  }

  const currentMidAngle = stageAngles[currentStage]?.mid ?? -30
  const pointerRad = degToRad(currentMidAngle)
  const pointerX = center + (innerRadius - 16) * Math.cos(pointerRad)
  const pointerY = center + (innerRadius - 16) * Math.sin(pointerRad)

  return (
    <div style={styles.card}>
      <div style={styles.headerRow}>
        <div>
          <div style={styles.tag}>CICLO INTERMARKET DE JOHN MURPHY</div>
          <h2 style={styles.title}>Reloj Intermarket de 6 Etapas</h2>
          <p style={styles.subtitle}>
            Secuencia canónica de giro macroeconómico: <strong>Bonos → Acciones → Commodities</strong>
          </p>
        </div>
        <div style={styles.statusBadgeContainer}>
          <div style={{ ...styles.activeStageBadge, borderColor: currentInfo.color }}>
            <span style={{ ...styles.pulseDot, backgroundColor: currentInfo.color }} />
            <span style={{ color: currentInfo.color, fontWeight: 700 }}>
              {stageName ? stageName.toUpperCase() : `ETAPA ${currentStage} ACTIVA`}
            </span>
          </div>
          <div style={styles.confBadge}>
            Confianza: {(confidence * 100).toFixed(0)}%
          </div>
        </div>
      </div>

      <div style={styles.gridContainer}>
        {/* SVG Circular Murphy Clock */}
        <div style={styles.clockWrapper}>
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            <defs>
              <radialGradient id="clockCenterGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor={currentInfo.color} stopOpacity="0.25" />
                <stop offset="100%" stopColor="#11141D" stopOpacity="0.9" />
              </radialGradient>
              <filter id="glowEffect" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Background ring */}
            <circle cx={center} cy={center} r={outerRadius + 8} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
            <circle cx={center} cy={center} r={innerRadius - 4} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />

            {/* 6 Stage Sector Arcs */}
            {STAGES.map((s) => {
              const angles = stageAngles[s.num]
              const isCurrent = s.num === currentStage
              const isSelected = s.num === selectedStage
              const scoreObj = stageScores.find(sc => sc.stage === s.num)
              const scorePct = scoreObj ? Math.round(scoreObj.score * 100) : 0

              // Label position
              const midRad = degToRad(angles.mid)
              const labelRadius = (innerRadius + outerRadius) / 2
              const lx = center + labelRadius * Math.cos(midRad)
              const ly = center + labelRadius * Math.sin(midRad)

              return (
                <g
                  key={s.num}
                  onClick={() => setSelectedStage(s.num)}
                  style={{ cursor: 'pointer', transition: 'all 0.25s' }}
                >
                  <path
                    d={describeArc(angles.start + 1.5, angles.end - 1.5, innerRadius, isSelected ? outerRadius + 6 : outerRadius)}
                    fill={isSelected ? s.color + '40' : isCurrent ? s.color + '26' : 'rgba(255,255,255,0.03)'}
                    stroke={isSelected ? s.color : isCurrent ? s.color + '90' : 'rgba(255,255,255,0.1)'}
                    strokeWidth={isSelected ? 2.5 : isCurrent ? 1.5 : 1}
                    filter={isSelected || isCurrent ? 'url(#glowEffect)' : undefined}
                  />

                  {/* Stage Number & Title */}
                  <text
                    x={lx}
                    y={ly - 6}
                    fill={isSelected ? '#F8FAFC' : isCurrent ? s.color : '#94A3B8'}
                    fontSize={11}
                    fontWeight={700}
                    textAnchor="middle"
                    dominantBaseline="central"
                  >
                    E{s.num}
                  </text>
                  <text
                    x={lx}
                    y={ly + 8}
                    fill={isSelected ? s.color : '#64748B'}
                    fontSize={9}
                    fontWeight={600}
                    textAnchor="middle"
                    dominantBaseline="central"
                  >
                    {scorePct}%
                  </text>
                </g>
              )
            })}

            {/* Center Dial Hub */}
            <circle
              cx={center}
              cy={center}
              r={innerRadius - 8}
              fill="url(#clockCenterGlow)"
              stroke={currentInfo.color}
              strokeWidth="2"
              strokeDasharray="4 2"
            />

            {/* Pointer / Dial Hand to Current Stage */}
            <line
              x1={center}
              y1={center}
              x2={pointerX}
              y2={pointerY}
              stroke={currentInfo.color}
              strokeWidth="3"
              strokeLinecap="round"
            />
            <circle cx={center} cy={center} r="6" fill={currentInfo.color} />
            <circle cx={pointerX} cy={pointerY} r="4" fill="#F8FAFC" />

            {/* Center Text */}
            <text
              x={center}
              y={center - 24}
              fill="#94A3B8"
              fontSize={10}
              fontWeight={600}
              textAnchor="middle"
              letterSpacing="1"
            >
              FASE ACTIVA
            </text>
            <text
              x={center}
              y={center}
              fill="#F8FAFC"
              fontSize={18}
              fontWeight={800}
              textAnchor="middle"
            >
              Etapa {currentStage}
            </text>
            <text
              x={center}
              y={center + 20}
              fill={currentInfo.color}
              fontSize={11}
              fontWeight={600}
              textAnchor="middle"
            >
              {currentInfo.subtitle}
            </text>
            <text
              x={center}
              y={center + 36}
              fill="#64748B"
              fontSize={9}
              textAnchor="middle"
            >
              Alineación {(confidence * 100).toFixed(0)}%
            </text>
          </svg>

          {/* Clockwise flow legend */}
          <div style={styles.flowLegend}>
            <span>↻ Rotación Horaria Continua (1 → 2 → 3 → 4 → 5 → 6)</span>
          </div>
        </div>

        {/* Selected Stage Detail & Asset Dynamics */}
        <div style={styles.detailsCol}>
          <div style={{ ...styles.stageDetailCard, borderColor: activeInfo.color + '40' }}>
            <div style={styles.stageDetailHeader}>
              <div>
                <span style={{ ...styles.stageBadge, backgroundColor: activeInfo.color + '20', color: activeInfo.color }}>
                  {activeInfo.title}: {activeInfo.subtitle}
                </span>
                <div style={styles.econPhase}>{activeInfo.economicPhase}</div>
              </div>
              {selectedStage === currentStage && (
                <span style={styles.detectedTag}>📍 FASE ACTUAL DETECTADA</span>
              )}
            </div>

            <p style={styles.stageDescriptionText}>
              {selectedStage === currentStage ? stageDescription : (stageScores.find(s => s.stage === selectedStage)?.description || '')}
            </p>

            {/* 3 Core Asset Directions in this stage */}
            <div style={styles.assetTrio}>
              <div style={styles.assetBox}>
                <div style={styles.assetLabel}>🏛️ BONOS (TLT)</div>
                <div style={{ ...styles.assetTrend, color: activeInfo.bonds === 'up' ? '#10B981' : '#EF4444' }}>
                  {activeInfo.bonds === 'up' ? '↗ ALZA (Yields ↓)' : '↘ BAJA (Yields ↑)'}
                </div>
              </div>
              <div style={styles.assetBox}>
                <div style={styles.assetLabel}>📈 ACCIONES (SPY)</div>
                <div style={{ ...styles.assetTrend, color: activeInfo.stocks === 'up' ? '#10B981' : '#EF4444' }}>
                  {activeInfo.stocks === 'up' ? '↗ ALZA (Bull)' : '↘ BAJA (Bear)'}
                </div>
              </div>
              <div style={styles.assetBox}>
                <div style={styles.assetLabel}>🛢️ COMMODITIES (DBC)</div>
                <div style={{ ...styles.assetTrend, color: activeInfo.commodities === 'up' ? '#10B981' : '#EF4444' }}>
                  {activeInfo.commodities === 'up' ? '↗ ALZA (Inflación)' : '↘ BAJA (Deflación)'}
                </div>
              </div>
            </div>
          </div>

          {/* Leaders & Lagging Transition Status */}
          <div style={styles.leadersCard}>
            <div style={styles.leadersTitle}>
              <span>⚡ Dinámica de Líderes y Rezagados del Mercado</span>
            </div>
            <div style={styles.leadersGrid}>
              <div style={styles.leaderItem}>
                <span style={styles.leaderAsset}>Bonos Soberanos:</span>
                <span style={styles.leaderVal}>{leaders.bonds_status}</span>
              </div>
              <div style={styles.leaderItem}>
                <span style={styles.leaderAsset}>Renta Variable:</span>
                <span style={styles.leaderVal}>{leaders.stocks_status}</span>
              </div>
              <div style={styles.leaderItem}>
                <span style={styles.leaderAsset}>Commodities:</span>
                <span style={styles.leaderVal}>{leaders.commodities_status}</span>
              </div>
              <div style={styles.leaderItem}>
                <span style={styles.leaderAsset}>Dólar / FX:</span>
                <span style={styles.leaderVal}>{leaders.dollar_status}</span>
              </div>
            </div>
            <div style={styles.leadersSummary}>
              💡 <em>{leaders.summary}</em>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    backgroundColor: 'var(--bg-surface-card, #151926)',
    border: '1px solid var(--border, rgba(255, 255, 255, 0.08))',
    borderRadius: 12,
    padding: 24,
    boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
  },
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 20,
    borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
    paddingBottom: 16,
  },
  tag: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '1px',
    color: 'var(--accent, #3B82F6)',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: 700,
    margin: 0,
    color: '#F8FAFC',
  },
  subtitle: {
    fontSize: 13,
    color: '#94A3B8',
    margin: '4px 0 0',
  },
  statusBadgeContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 6,
  },
  activeStageBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 14px',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    border: '1.5px solid',
    borderRadius: 20,
    fontSize: 13,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    boxShadow: '0 0 8px currentColor',
  },
  confBadge: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: 600,
  },
  gridContainer: {
    display: 'grid',
    gridTemplateColumns: 'auto 1fr',
    gap: 28,
    alignItems: 'center',
  },
  clockWrapper: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flowLegend: {
    marginTop: 8,
    fontSize: 11,
    color: '#64748B',
    fontWeight: 500,
  },
  detailsCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  stageDetailCard: {
    backgroundColor: '#11141D',
    border: '1px solid',
    borderRadius: 10,
    padding: 16,
  },
  stageDetailHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  stageBadge: {
    fontSize: 13,
    fontWeight: 700,
    padding: '4px 10px',
    borderRadius: 6,
  },
  econPhase: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
    fontWeight: 500,
  },
  detectedTag: {
    fontSize: 10,
    fontWeight: 700,
    padding: '3px 8px',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    color: '#10B981',
    border: '1px solid rgba(16, 185, 129, 0.3)',
    borderRadius: 12,
  },
  stageDescriptionText: {
    fontSize: 13,
    lineHeight: 1.6,
    color: '#E2E8F0',
    margin: '0 0 14px',
  },
  assetTrio: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 8,
  },
  assetBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    borderRadius: 6,
    padding: 10,
    textAlign: 'center',
  },
  assetLabel: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: 600,
    marginBottom: 4,
  },
  assetTrend: {
    fontSize: 12,
    fontWeight: 700,
  },
  leadersCard: {
    backgroundColor: '#11141D',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    borderRadius: 10,
    padding: 16,
  },
  leadersTitle: {
    fontSize: 12,
    fontWeight: 700,
    color: '#F8FAFC',
    marginBottom: 10,
    letterSpacing: '0.5px',
  },
  leadersGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 8,
    marginBottom: 10,
  },
  leaderItem: {
    fontSize: 12,
    display: 'flex',
    justifyContent: 'space-between',
    padding: '4px 8px',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 4,
  },
  leaderAsset: {
    color: '#94A3B8',
  },
  leaderVal: {
    color: '#F8FAFC',
    fontWeight: 600,
  },
  leadersSummary: {
    fontSize: 12,
    color: '#93C5FD',
    lineHeight: 1.5,
  },
}
