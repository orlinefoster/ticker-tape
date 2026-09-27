import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { Card, Badge, Button } from '@/components/ui'
import type {
  MstEdge,
  NodeCentrality,
  AssetRanking,
  CorrelationMatrix,
} from './types'

interface TopologyNetworkGraphProps {
  symbols: string[]
  mstEdges?: MstEdge[]
  centrality?: NodeCentrality[]
  rankings?: AssetRanking[]
  correlations: CorrelationMatrix
}

interface SimNode {
  id: string
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  degree: number
  betweenness: number
  isHub: boolean
  returns1m: number
  volatility: number
  isDragging?: boolean
}

export const TopologyNetworkGraph: React.FC<TopologyNetworkGraphProps> = ({
  symbols,
  mstEdges = [],
  centrality = [],
  rankings = [],
  correlations,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 780, height: 480 })
  const [nodes, setNodes] = useState<SimNode[]>([])
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [showStrongEdges, setShowStrongEdges] = useState(true)
  const [isSimulating, setIsSimulating] = useState(true)

  const draggingNodeRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null)
  const nodesRef = useRef<SimNode[]>([])
  nodesRef.current = nodes

  // Update canvas size on resize
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        if (rect.width > 0) {
          setDimensions({
            width: Math.max(400, rect.width),
            height: 480,
          })
        }
      }
    }
    updateSize()
    window.addEventListener('resize', updateSize)
    return () => window.removeEventListener('resize', updateSize)
  }, [])

  // Initialize node positions in a circle around center
  useEffect(() => {
    const cx = dimensions.width / 2
    const cy = dimensions.height / 2
    const radius = Math.min(cx, cy) * 0.65

    const rankingMap = new Map(rankings.map((r) => [r.symbol, r]))
    const centralityMap = new Map(centrality.map((c) => [c.symbol, c]))

    const initialNodes: SimNode[] = symbols.map((sym, i) => {
      const angle = (i / Math.max(symbols.length, 1)) * 2 * Math.PI
      const cent = centralityMap.get(sym)
      const rank = rankingMap.get(sym)

      const degree = cent?.degree ?? 1
      const betweenness = cent?.betweenness ?? 0
      const isHub = cent?.is_hub ?? false

      // Node radius based on centrality (degree + betweenness)
      const nodeRadius = isHub ? 32 : Math.max(20, Math.min(30, 18 + degree * 3))

      return {
        id: sym,
        x: cx + radius * Math.cos(angle) + (Math.random() - 0.5) * 20,
        y: cy + radius * Math.sin(angle) + (Math.random() - 0.5) * 20,
        vx: 0,
        vy: 0,
        radius: nodeRadius,
        degree,
        betweenness,
        isHub,
        returns1m: rank?.returns_1m ?? 0,
        volatility: rank?.volatility ?? 0.2,
      }
    })

    setNodes(initialNodes)
    setIsSimulating(true)
  }, [symbols, centrality, rankings, dimensions.width, dimensions.height])

  // Extract non-MST strong correlation edges (rho >= 0.6)
  const strongEdges = useMemo(() => {
    if (!showStrongEdges) return []
    const mstSet = new Set(
      mstEdges.map((e) => `${e.source}__${e.target}`).concat(
        mstEdges.map((e) => `${e.target}__${e.source}`)
      )
    )

    const list: { source: string; target: string; correlation: number }[] = []
    const syms = correlations.symbols
    const matrix = correlations.correlations

    for (let i = 0; i < syms.length; i++) {
      for (let j = i + 1; j < syms.length; j++) {
        const u = syms[i]
        const v = syms[j]
        const rho = matrix[i]?.[j] ?? 0
        if (rho >= 0.6 && !mstSet.has(`${u}__${v}`)) {
          list.push({ source: u, target: v, correlation: rho })
        }
      }
    }
    return list
  }, [correlations, mstEdges, showStrongEdges])

  // Force-directed layout physics step
  useEffect(() => {
    if (!isSimulating || nodes.length === 0) return

    let animId: number
    let iter = 0

    const step = () => {
      const current = [...nodesRef.current]
      const cx = dimensions.width / 2
      const cy = dimensions.height / 2

      // 1. Center gravity & boundary spring
      for (const node of current) {
        if (node.isDragging) continue
        const dx = cx - node.x
        const dy = cy - node.y
        node.vx += dx * 0.002
        node.vy += dy * 0.002
      }

      // 2. Coulomb electrostatic repulsion between all node pairs
      for (let i = 0; i < current.length; i++) {
        for (let j = i + 1; j < current.length; j++) {
          const a = current[i]
          const b = current[j]
          const dx = b.x - a.x
          const dy = b.y - a.y
          const distSq = Math.max(dx * dx + dy * dy, 400)
          const dist = Math.sqrt(distSq)

          const minSpacing = a.radius + b.radius + 35
          const repulseForce = 1800 / distSq

          const fx = (dx / dist) * repulseForce
          const fy = (dy / dist) * repulseForce

          if (!a.isDragging) {
            a.vx -= fx
            a.vy -= fy
          }
          if (!b.isDragging) {
            b.vx += fx
            b.vy += fy
          }

          // Anti-overlap penalty
          if (dist < minSpacing) {
            const overlap = (minSpacing - dist) * 0.25
            const pushX = (dx / dist) * overlap
            const pushY = (dy / dist) * overlap
            if (!a.isDragging) {
              a.x -= pushX
              a.y -= pushY
            }
            if (!b.isDragging) {
              b.x += pushX
              b.y += pushY
            }
          }
        }
      }

      // 3. Spring force along MST edges (target length = Mantegna distance * scale)
      const nodeMap = new Map(current.map((n) => [n.id, n]))
      for (const edge of mstEdges) {
        const u = nodeMap.get(edge.source)
        const v = nodeMap.get(edge.target)
        if (!u || !v) continue

        const dx = v.x - u.x
        const dy = v.y - u.y
        const dist = Math.sqrt(dx * dx + dy * dy) || 1

        // Target distance based on Mantegna distance (0.0 -> 70px, 1.41 -> 160px, 2.0 -> 220px)
        const targetDist = 70 + edge.weight * 65
        const diff = dist - targetDist
        const springForce = diff * 0.025

        const fx = (dx / dist) * springForce
        const fy = (dy / dist) * springForce

        if (!u.isDragging) {
          u.vx += fx
          u.vy += fy
        }
        if (!v.isDragging) {
          v.vx -= fx
          v.vy -= fy
        }
      }

      // 4. Integrate velocity with friction and clamp to viewport
      const padding = 45
      let totalEnergy = 0

      for (const node of current) {
        if (!node.isDragging) {
          node.vx *= 0.86
          node.vy *= 0.86
          node.x += node.vx
          node.y += node.vy

          // Clamp
          node.x = Math.max(padding, Math.min(dimensions.width - padding, node.x))
          node.y = Math.max(padding, Math.min(dimensions.height - padding, node.y))

          totalEnergy += node.vx * node.vx + node.vy * node.vy
        }
      }

      setNodes(current)
      iter++

      // Cool down physics after 350 iterations if quiescent
      if (iter < 350 || draggingNodeRef.current !== null || totalEnergy > 0.05) {
        animId = requestAnimationFrame(step)
      } else {
        setIsSimulating(false)
      }
    }

    animId = requestAnimationFrame(step)
    return () => cancelAnimationFrame(animId)
  }, [isSimulating, mstEdges, dimensions.width, dimensions.height])

  // Mouse interaction handlers for Drag & Drop
  const handleMouseDown = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    const container = containerRef.current?.getBoundingClientRect()
    if (!container) return

    const mouseX = e.clientX - container.left
    const mouseY = e.clientY - container.top

    const targetNode = nodes.find((n) => n.id === id)
    if (!targetNode) return

    draggingNodeRef.current = {
      id,
      offsetX: mouseX - targetNode.x,
      offsetY: mouseY - targetNode.y,
    }

    setSelectedNodeId(id)

    setNodes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isDragging: true, vx: 0, vy: 0 } : n))
    )
    setIsSimulating(true)
  }

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!draggingNodeRef.current) return
    const container = containerRef.current?.getBoundingClientRect()
    if (!container) return

    const mouseX = e.clientX - container.left
    const mouseY = e.clientY - container.top

    const { id, offsetX, offsetY } = draggingNodeRef.current

    setNodes((prev) =>
      prev.map((n) => {
        if (n.id === id) {
          return {
            ...n,
            x: Math.max(35, Math.min(dimensions.width - 35, mouseX - offsetX)),
            y: Math.max(35, Math.min(dimensions.height - 35, mouseY - offsetY)),
            vx: 0,
            vy: 0,
          }
        }
        return n
      })
    )
  }, [dimensions.width, dimensions.height])

  const handleMouseUp = useCallback(() => {
    if (draggingNodeRef.current) {
      const id = draggingNodeRef.current.id
      setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, isDragging: false } : n)))
      draggingNodeRef.current = null
    }
  }, [])

  // Selected node details
  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId),
    [nodes, selectedNodeId]
  )

  const selectedNodeEdges = useMemo(() => {
    if (!selectedNodeId) return []
    return mstEdges.filter(
      (e) => e.source === selectedNodeId || e.target === selectedNodeId
    )
  }, [mstEdges, selectedNodeId])

  const getNodeColor = (ret1m: number) => {
    if (ret1m > 0.02) return '#10b981' // bullish green
    if (ret1m < -0.02) return '#ef4444' // bearish red
    return '#64748b' // neutral slate
  }

  const nodeMap = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes])

  return (
    <div style={styles.container}>
      {/* Controls Bar */}
      <div style={styles.controlsBar}>
        <div style={styles.controlsLeft}>
          <Button
            size="sm"
            variant={showStrongEdges ? 'primary' : 'outline'}
            onClick={() => setShowStrongEdges(!showStrongEdges)}
          >
            {showStrongEdges ? '✓ Aristas Fuertes (ρ ≥ 0.6)' : '+ Aristas Fuertes (ρ ≥ 0.6)'}
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setIsSimulating(true)
            }}
          >
            ⚡ Re-equilibrar Física
          </Button>
        </div>

        <div style={styles.legend}>
          <span style={styles.legendItem}>
            <span style={{ ...styles.legendDot, backgroundColor: '#10b981' }} />
            Retorno 1m &gt; 0%
          </span>
          <span style={styles.legendItem}>
            <span style={{ ...styles.legendDot, backgroundColor: '#ef4444' }} />
            Retorno 1m &lt; 0%
          </span>
          <span style={styles.legendItem}>
            <span style={{ ...styles.legendLine, borderColor: 'var(--accent)' }} />
            Troncal MST
          </span>
          {showStrongEdges && (
            <span style={styles.legendItem}>
              <span
                style={{
                  ...styles.legendLine,
                  borderColor: 'rgba(255,255,255,0.25)',
                  borderStyle: 'dashed',
                }}
              />
              ρ &ge; 0.6
            </span>
          )}
        </div>
      </div>

      {/* SVG Canvas & Node Inspector Drawer */}
      <div
        ref={containerRef}
        style={styles.canvasContainer}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <svg width={dimensions.width} height={dimensions.height} style={styles.svg}>
          <defs>
            {/* Glow filter for Hub node */}
            <filter id="hub-glow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* 1. Strong non-MST edges (faint dashed lines) */}
          {showStrongEdges &&
            strongEdges.map((e, idx) => {
              const u = nodeMap.get(e.source)
              const v = nodeMap.get(e.target)
              if (!u || !v) return null
              return (
                <line
                  key={`strong-${idx}`}
                  x1={u.x}
                  y1={u.y}
                  x2={v.x}
                  y2={v.y}
                  stroke="rgba(255, 255, 255, 0.15)"
                  strokeWidth="1.2"
                  strokeDasharray="4 4"
                />
              )
            })}

          {/* 2. Primary MST edges (solid lines) */}
          {mstEdges.map((e, idx) => {
            const u = nodeMap.get(e.source)
            const v = nodeMap.get(e.target)
            if (!u || !v) return null

            const isHighlighted =
              selectedNodeId === e.source || selectedNodeId === e.target
            const lineWidth = Math.max(1.8, Math.min(4.5, (e.correlation + 1) * 1.8))

            return (
              <g key={`mst-${idx}`}>
                <line
                  x1={u.x}
                  y1={u.y}
                  x2={v.x}
                  y2={v.y}
                  stroke={isHighlighted ? 'var(--accent)' : 'rgba(99, 102, 241, 0.6)'}
                  strokeWidth={isHighlighted ? lineWidth + 1.5 : lineWidth}
                  strokeOpacity={isHighlighted ? 1.0 : 0.75}
                />
                {/* Edge correlation tag midway */}
                <rect
                  x={(u.x + v.x) / 2 - 16}
                  y={(u.y + v.y) / 2 - 9}
                  width="32"
                  height="16"
                  rx="4"
                  fill="var(--bg-secondary, #1e293b)"
                  stroke="rgba(255,255,255,0.1)"
                  strokeWidth="1"
                />
                <text
                  x={(u.x + v.x) / 2}
                  y={(u.y + v.y) / 2 + 3}
                  textAnchor="middle"
                  fill="var(--text-secondary)"
                  fontSize="9"
                  fontFamily="monospace"
                >
                  {e.correlation.toFixed(2)}
                </text>
              </g>
            )
          })}

          {/* 3. Nodes */}
          {nodes.map((n) => {
            const isSelected = n.id === selectedNodeId
            const color = getNodeColor(n.returns1m)

            return (
              <g
                key={n.id}
                transform={`translate(${n.x}, ${n.y})`}
                onMouseDown={(e) => handleMouseDown(e, n.id)}
                onClick={() => setSelectedNodeId(n.id)}
                style={{ cursor: 'grab' }}
              >
                {/* Hub golden halo ring */}
                {n.isHub && (
                  <circle
                    r={n.radius + 6}
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="2.5"
                    strokeDasharray="4 2"
                    opacity="0.8"
                    filter="url(#hub-glow)"
                  />
                )}

                {/* Selected highlight ring */}
                {isSelected && !n.isHub && (
                  <circle
                    r={n.radius + 4}
                    fill="none"
                    stroke="var(--accent)"
                    strokeWidth="2"
                    opacity="0.9"
                  />
                )}

                {/* Main Node Circle */}
                <circle
                  r={n.radius}
                  fill="var(--bg-primary, #0f172a)"
                  stroke={color}
                  strokeWidth={n.isHub ? 3.5 : 2.5}
                />

                {/* Inner fill with subtle tint */}
                <circle
                  r={n.radius - 2}
                  fill={color}
                  fillOpacity="0.16"
                />

                {/* Symbol label */}
                <text
                  textAnchor="middle"
                  dy={n.isHub ? '-2' : '4'}
                  fill="var(--text-primary)"
                  fontSize={n.isHub ? '13' : '11'}
                  fontWeight="700"
                  fontFamily="var(--font-mono, monospace)"
                >
                  {n.id}
                </text>

                {/* Degree / Star badge below text if Hub */}
                {n.isHub && (
                  <text
                    textAnchor="middle"
                    dy="13"
                    fill="#f59e0b"
                    fontSize="9"
                    fontWeight="600"
                  >
                    ★ HUB
                  </text>
                )}
              </g>
            )
          })}
        </svg>

        {/* Selected Node Inspector Card */}
        {selectedNode && (
          <Card variant="filled" style={styles.inspectorCard}>
            <div style={styles.inspectorHeader}>
              <div style={styles.inspectorTitleRow}>
                <span style={styles.inspectorSymbol}>{selectedNode.id}</span>
                {selectedNode.isHub && <Badge variant="warning">★ HUB SISTÉMICO</Badge>}
              </div>
              <button
                onClick={() => setSelectedNodeId(null)}
                style={styles.closeBtn}
                title="Cerrar inspector"
              >
                ×
              </button>
            </div>

            <div style={styles.inspectorStats}>
              <div style={styles.statBox}>
                <span style={styles.statLabel}>Retorno 1m</span>
                <span
                  style={{
                    ...styles.statVal,
                    color:
                      selectedNode.returns1m >= 0
                        ? 'var(--signal-bullish)'
                        : 'var(--signal-bearish)',
                  }}
                >
                  {(selectedNode.returns1m * 100).toFixed(1)}%
                </span>
              </div>

              <div style={styles.statBox}>
                <span style={styles.statLabel}>Volatilidad</span>
                <span style={styles.statVal}>
                  {(selectedNode.volatility * 100).toFixed(1)}%
                </span>
              </div>

              <div style={styles.statBox}>
                <span style={styles.statLabel}>Conexiones (MST)</span>
                <span style={styles.statVal}>{selectedNode.degree} ramas</span>
              </div>

              <div style={styles.statBox}>
                <span style={styles.statLabel}>Betweenness</span>
                <span style={styles.statVal}>
                  {(selectedNode.betweenness * 100).toFixed(1)}%
                </span>
              </div>
            </div>

            {/* Direct MST Neighbors */}
            <div style={styles.neighborsContainer}>
              <span style={styles.neighborsTitle}>VECINOS DIRECTOS EN EL ÁRBOL:</span>
              <div style={styles.neighborsList}>
                {selectedNodeEdges.map((edge, idx) => {
                  const otherSym =
                    edge.source === selectedNode.id ? edge.target : edge.source
                  return (
                    <div key={idx} style={styles.neighborItem}>
                      <span style={styles.neighborSym}>{otherSym}</span>
                      <span style={styles.neighborCorr}>
                        ρ: {edge.correlation.toFixed(2)} (dist: {edge.weight.toFixed(2)})
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginBottom: '24px',
  },
  controlsBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '12px',
    padding: '8px 12px',
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: 'var(--radius)',
  },
  controlsLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  legend: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    fontSize: '11px',
    color: 'var(--text-secondary)',
  },
  legendItem: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
  },
  legendDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
  },
  legendLine: {
    width: '16px',
    height: '0px',
    borderTop: '2px solid',
  },
  canvasContainer: {
    position: 'relative',
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: 'var(--radius)',
    overflow: 'hidden',
    boxShadow: 'var(--shadow)',
    border: '1px solid var(--border)',
    minHeight: '480px',
  },
  svg: {
    display: 'block',
    width: '100%',
    height: '480px',
    userSelect: 'none',
  },
  inspectorCard: {
    position: 'absolute',
    top: '16px',
    right: '16px',
    width: '270px',
    padding: '14px',
    backgroundColor: 'rgba(23, 23, 33, 0.94)',
    backdropFilter: 'blur(8px)',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    borderRadius: 'var(--radius)',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
    zIndex: 10,
  },
  inspectorHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '10px',
  },
  inspectorTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  inspectorSymbol: {
    fontSize: '16px',
    fontWeight: 700,
    fontFamily: 'var(--font-mono, monospace)',
    color: 'var(--text-primary)',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    fontSize: '18px',
    cursor: 'pointer',
    padding: '0 4px',
    lineHeight: 1,
  },
  inspectorStats: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '8px',
    marginBottom: '12px',
  },
  statBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    padding: '6px 8px',
    borderRadius: '4px',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  statLabel: {
    fontSize: '10px',
    color: 'var(--text-secondary)',
  },
  statVal: {
    fontSize: '13px',
    fontWeight: 700,
    fontFamily: 'var(--font-mono, monospace)',
    color: 'var(--text-primary)',
  },
  neighborsContainer: {
    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
    paddingTop: '8px',
  },
  neighborsTitle: {
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '0.04em',
    color: 'var(--text-secondary)',
    marginBottom: '6px',
    display: 'block',
  },
  neighborsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    maxHeight: '120px',
    overflowY: 'auto',
  },
  neighborItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    fontSize: '11px',
    padding: '3px 6px',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: '4px',
  },
  neighborSym: {
    fontWeight: 700,
    fontFamily: 'var(--font-mono, monospace)',
    color: 'var(--accent)',
  },
  neighborCorr: {
    fontSize: '10px',
    color: 'var(--text-secondary)',
    fontFamily: 'monospace',
  },
}
