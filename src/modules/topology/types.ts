export interface AssetRanking {
  symbol: string
  returns_1w: number
  returns_1m: number
  returns_3m: number
  returns_6m: number
  returns_1y: number
  percentile_rank: number
  volatility: number
  momentum_score: number
}

export interface CorrelationMatrix {
  symbols: string[]
  correlations: number[][]
}

export interface RegimeInfo {
  regime: string
  description: string
  affected_symbols: string[]
}

export interface MstEdge {
  source: string
  target: string
  weight: number // Mantegna distance d_ij = sqrt(2*(1 - rho))
  correlation: number // Pearson correlation rho_ij
}

export interface NodeCentrality {
  symbol: string
  degree: number
  betweenness: number
  is_hub: boolean
}

export interface TopologyMetrics {
  normalized_tree_length: number
  hub_symbol: string
  avg_correlation: number
  stress_status: string
  window_days: number
}

export interface TopologyReport {
  date: string
  universe_size: number
  rankings: AssetRanking[]
  correlations: CorrelationMatrix
  regimes: RegimeInfo[]
  mst_edges?: MstEdge[]
  centrality?: NodeCentrality[]
  metrics?: TopologyMetrics
  hrp_order?: string[]
}
