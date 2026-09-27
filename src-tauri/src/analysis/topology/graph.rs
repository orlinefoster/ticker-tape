//! Network topology and graph theory engine for financial markets.
//!
//! Provides:
//! - Mantegna distance metric: $d_{i,j} = \sqrt{2(1 - \rho_{i,j})}$
//! - Minimum Spanning Tree (MST) via Kruskal's algorithm
//! - Network Centrality (Degree and Normalized Betweenness)
//! - Macro-topological metrics (Normalized Tree Length $L_{MST}$, stress status)
//! - Hierarchical Risk Parity (HRP) Single-Linkage Quasi-diagonalization

use super::types::{CorrelationMatrix, MstEdge, NodeCentrality, TopologyMetrics};

/// Compute Mantegna distance from Pearson correlation coefficient.
///
/// $d_{i,j} = \sqrt{\max(0.0, 2.0 \times (1.0 - \rho_{i,j}))}$
///
/// Properties:
/// - $\rho = 1.0 \implies d = 0.0$ (identical movement)
/// - $\rho = 0.0 \implies d = \sqrt{2} \approx 1.414$ (uncorrelated)
/// - $\rho = -1.0 \implies d = 2.0$ (perfect inverse movement)
pub fn mantegna_distance(rho: f64) -> f64 {
    let clamped_rho = rho.clamp(-1.0, 1.0);
    (2.0 * (1.0 - clamped_rho)).max(0.0).sqrt()
}

/// Compute the pairwise Mantegna distance matrix from an N×N correlation matrix.
pub fn compute_distance_matrix(correlations: &CorrelationMatrix) -> Vec<Vec<f64>> {
    correlations
        .correlations
        .iter()
        .enumerate()
        .map(|(i, row)| {
            row.iter()
                .enumerate()
                .map(|(j, &rho)| {
                    if i == j {
                        0.0
                    } else {
                        mantegna_distance(rho)
                    }
                })
                .collect()
        })
        .collect()
}

/// Disjoint Set Union (DSU) / Union-Find with path compression and rank.
struct Dsu {
    parent: Vec<usize>,
    rank: Vec<usize>,
}

impl Dsu {
    fn new(n: usize) -> Self {
        Self {
            parent: (0..n).collect(),
            rank: vec![0; n],
        }
    }

    fn find(&mut self, i: usize) -> usize {
        if self.parent[i] != i {
            let p = self.parent[i];
            self.parent[i] = self.find(p);
        }
        self.parent[i]
    }

    fn union(&mut self, i: usize, j: usize) -> bool {
        let root_i = self.find(i);
        let root_j = self.find(j);
        if root_i == root_j {
            return false;
        }

        if self.rank[root_i] < self.rank[root_j] {
            self.parent[root_i] = root_j;
        } else if self.rank[root_i] > self.rank[root_j] {
            self.parent[root_j] = root_i;
        } else {
            self.parent[root_j] = root_i;
            self.rank[root_i] += 1;
        }

        true
    }
}

/// Candidate edge for MST computation.
#[derive(Debug, Clone, Copy)]
struct CandidateEdge {
    u: usize,
    v: usize,
    distance: f64,
    correlation: f64,
}

/// Compute the Minimum Spanning Tree (MST) using Kruskal's algorithm.
///
/// Returns $N-1$ edges connecting all assets with minimal total Mantegna distance.
pub fn compute_mst(correlations: &CorrelationMatrix) -> Vec<MstEdge> {
    let symbols = &correlations.symbols;
    let n = symbols.len();

    if n < 2 {
        return Vec::new();
    }

    let mut edges: Vec<CandidateEdge> = Vec::with_capacity(n * (n - 1) / 2);

    for i in 0..n {
        for j in (i + 1)..n {
            let rho = correlations.correlations[i][j];
            let dist = mantegna_distance(rho);
            edges.push(CandidateEdge {
                u: i,
                v: j,
                distance: dist,
                correlation: rho,
            });
        }
    }

    // Sort edges by distance ascending (closest / highest correlation first)
    edges.sort_by(|a, b| a.distance.partial_cmp(&b.distance).unwrap_or(std::cmp::Ordering::Equal));

    let mut dsu = Dsu::new(n);
    let mut mst: Vec<MstEdge> = Vec::with_capacity(n - 1);

    for edge in edges {
        if dsu.union(edge.u, edge.v) {
            mst.push(MstEdge {
                source: symbols[edge.u].clone(),
                target: symbols[edge.v].clone(),
                weight: edge.distance,
                correlation: edge.correlation,
            });

            if mst.len() == n - 1 {
                break;
            }
        }
    }

    mst
}

/// Compute Degree and Normalized Betweenness Centrality for all nodes in the MST.
///
/// For a tree of $N$ nodes, removing node $v$ splits the tree into components of sizes
/// $s_1, s_2, \dots, s_k$. The number of paths passing through $v$ is:
/// $\text{pairs}(v) = \frac{(N-1)^2 - \sum s_i^2}{2}$
/// Normalized by $\frac{(N-1)(N-2)}{2}$ for $N > 2$.
pub fn compute_centrality(symbols: &[String], mst: &[MstEdge]) -> Vec<NodeCentrality> {
    let n = symbols.len();
    if n == 0 {
        return Vec::new();
    }

    if n == 1 {
        return vec![NodeCentrality {
            symbol: symbols[0].clone(),
            degree: 0,
            betweenness: 0.0,
            is_hub: true,
        }];
    }

    // Map symbol to index
    let sym_to_idx: std::collections::HashMap<&str, usize> = symbols
        .iter()
        .enumerate()
        .map(|(i, s)| (s.as_str(), i))
        .collect();

    // Build adjacency list for the MST
    let mut adj: Vec<Vec<usize>> = vec![Vec::new(); n];
    for edge in mst {
        if let (Some(&u), Some(&v)) = (sym_to_idx.get(edge.source.as_str()), sym_to_idx.get(edge.target.as_str())) {
            adj[u].push(v);
            adj[v].push(u);
        }
    }

    let mut centralities: Vec<NodeCentrality> = Vec::with_capacity(n);

    for (v, sym) in symbols.iter().enumerate() {
        let degree = adj[v].len();

        let betweenness = if n <= 2 || degree <= 1 {
            0.0
        } else {
            // Find component sizes when v is removed
            let mut component_sizes: Vec<usize> = Vec::with_capacity(degree);

            for &neighbor in &adj[v] {
                // BFS to count size of connected component containing neighbor without visiting v
                let mut visited = vec![false; n];
                visited[v] = true;
                visited[neighbor] = true;
                let mut queue = std::collections::VecDeque::new();
                queue.push_back(neighbor);
                let mut size = 0;

                while let Some(curr) = queue.pop_front() {
                    size += 1;
                    for &next in &adj[curr] {
                        if !visited[next] {
                            visited[next] = true;
                            queue.push_back(next);
                        }
                    }
                }

                component_sizes.push(size);
            }

            let sum_sq: usize = component_sizes.iter().map(|&s| s * s).sum();
            let total_other = n - 1;
            let numerator = (total_other * total_other).saturating_sub(sum_sq) as f64;
            let denominator = ((n - 1) * (n - 2)) as f64;

            if denominator > 0.0 {
                (numerator / denominator).clamp(0.0, 1.0)
            } else {
                0.0
            }
        };

        centralities.push(NodeCentrality {
            symbol: sym.clone(),
            degree,
            betweenness,
            is_hub: false,
        });
    }

    // Flag the hub node: max betweenness, fallback to max degree
    if let Some(hub_idx) = centralities
        .iter()
        .enumerate()
        .max_by(|(_, a), (_, b)| {
            a.betweenness
                .partial_cmp(&b.betweenness)
                .unwrap_or(std::cmp::Ordering::Equal)
                .then_with(|| a.degree.cmp(&b.degree))
        })
        .map(|(i, _)| i)
    {
        centralities[hub_idx].is_hub = true;
    }

    centralities
}

/// Compute Macro-topological metrics:
/// - Normalized Tree Length ($L_{MST} = \frac{1}{N-1} \sum d_e$)
/// - Hub symbol
/// - Average pairwise correlation
/// - Market stress / contraction status
pub fn compute_topology_metrics(
    correlations: &CorrelationMatrix,
    mst: &[MstEdge],
    centrality: &[NodeCentrality],
    window_days: usize,
) -> TopologyMetrics {
    let n = correlations.symbols.len();

    let normalized_tree_length = if mst.is_empty() {
        0.0
    } else {
        let total_weight: f64 = mst.iter().map(|e| e.weight).sum();
        total_weight / (mst.len() as f64)
    };

    let hub_symbol = centrality
        .iter()
        .find(|c| c.is_hub)
        .map(|c| c.symbol.clone())
        .unwrap_or_else(|| correlations.symbols.first().cloned().unwrap_or_default());

    // Compute average off-diagonal correlation
    let mut corr_sum = 0.0;
    let mut pair_count = 0;
    for i in 0..n {
        for j in (i + 1)..n {
            corr_sum += correlations.correlations[i][j];
            pair_count += 1;
        }
    }

    let avg_correlation = if pair_count > 0 {
        corr_sum / (pair_count as f64)
    } else {
        1.0
    };

    let stress_status = if normalized_tree_length < 1.0 {
        "Contracción / Estrés Elevado".to_string()
    } else if normalized_tree_length < 1.3 {
        "Moderado / Transición".to_string()
    } else {
        "Diversificación Amplia / Saludable".to_string()
    };

    TopologyMetrics {
        normalized_tree_length,
        hub_symbol,
        avg_correlation,
        stress_status,
        window_days,
    }
}

/// Binary cluster tree for Hierarchical Risk Parity (HRP) quasi-diagonalization.
enum HrpCluster {
    Leaf(usize),
    Branch(Box<HrpCluster>, Box<HrpCluster>),
}

impl HrpCluster {
    fn get_leaf_indices(&self, out: &mut Vec<usize>) {
        match self {
            HrpCluster::Leaf(idx) => out.push(*idx),
            HrpCluster::Branch(left, right) => {
                left.get_leaf_indices(out);
                right.get_leaf_indices(out);
            }
        }
    }

    fn collect_leaves(&self) -> Vec<usize> {
        let mut out = Vec::new();
        self.get_leaf_indices(&mut out);
        out
    }
}

/// Compute Hierarchical Risk Parity (HRP) quasi-diagonalization order using Single-Linkage Clustering.
///
/// Recursively merges the closest clusters based on Mantegna distance,
/// then flattens the dendrogram to place strongly correlated assets together.
pub fn compute_hrp_order(correlations: &CorrelationMatrix) -> Vec<String> {
    let symbols = &correlations.symbols;
    let n = symbols.len();

    if n <= 1 {
        return symbols.clone();
    }

    let dist_matrix = compute_distance_matrix(correlations);

    // Active clusters: (Cluster, list of member indices)
    let mut active: Vec<(HrpCluster, Vec<usize>)> = (0..n)
        .map(|i| (HrpCluster::Leaf(i), vec![i]))
        .collect();

    while active.len() > 1 {
        let mut min_dist = f64::INFINITY;
        let mut best_i = 0;
        let mut best_j = 1;

        // Find pair of clusters with minimum single-linkage distance
        for i in 0..active.len() {
            for j in (i + 1)..active.len() {
                let (_, ref members_a) = active[i];
                let (_, ref members_b) = active[j];

                // Single linkage: min distance between any pair of elements
                let mut pair_min = f64::INFINITY;
                for &u in members_a {
                    for &v in members_b {
                        let d = dist_matrix[u][v];
                        if d < pair_min {
                            pair_min = d;
                        }
                    }
                }

                if pair_min < min_dist {
                    min_dist = pair_min;
                    best_i = i;
                    best_j = j;
                }
            }
        }

        // Merge best_i and best_j
        let (cluster_b, members_b) = active.remove(best_j);
        let (cluster_a, members_a) = active.remove(best_i);

        let mut merged_members = members_a;
        merged_members.extend(members_b);

        let merged_cluster = HrpCluster::Branch(Box::new(cluster_a), Box::new(cluster_b));
        active.push((merged_cluster, merged_members));
    }

    let (root_cluster, _) = active.remove(0);
    let ordered_indices = root_cluster.collect_leaves();

    ordered_indices
        .into_iter()
        .map(|idx| symbols[idx].clone())
        .collect()
}

// ---------------------------------------------------------------------------
// Unit Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_mantegna_distance_bounds() {
        assert!((mantegna_distance(1.0) - 0.0).abs() < 1e-6);
        assert!((mantegna_distance(0.0) - std::f64::consts::SQRT_2).abs() < 1e-6);
        assert!((mantegna_distance(-1.0) - 2.0).abs() < 1e-6);
        // Test clamping
        assert!((mantegna_distance(1.5) - 0.0).abs() < 1e-6);
        assert!((mantegna_distance(-1.5) - 2.0).abs() < 1e-6);
    }

    #[test]
    fn test_compute_mst_simple() {
        let symbols = vec!["A".to_string(), "B".to_string(), "C".to_string()];
        // A and B highly correlated (rho=0.9), B and C correlated (rho=0.8), A and C less (rho=0.1)
        let matrix = CorrelationMatrix {
            symbols,
            correlations: vec![
                vec![1.0, 0.9, 0.1],
                vec![0.9, 1.0, 0.8],
                vec![0.1, 0.8, 1.0],
            ],
        };

        let mst = compute_mst(&matrix);
        assert_eq!(mst.len(), 2);

        // Expect edges: (A, B) and (B, C) because distances are smaller than (A, C)
        let has_ab = mst.iter().any(|e| {
            (e.source == "A" && e.target == "B") || (e.source == "B" && e.target == "A")
        });
        let has_bc = mst.iter().any(|e| {
            (e.source == "B" && e.target == "C") || (e.source == "C" && e.target == "B")
        });
        assert!(has_ab, "MST should connect A and B");
        assert!(has_bc, "MST should connect B and C");
    }

    #[test]
    fn test_centrality_star_graph() {
        // Node B is the center connecting A and C (A - B - C)
        let symbols = vec!["A".to_string(), "B".to_string(), "C".to_string()];
        let mst = vec![
            MstEdge {
                source: "A".to_string(),
                target: "B".to_string(),
                weight: 0.5,
                correlation: 0.8,
            },
            MstEdge {
                source: "B".to_string(),
                target: "C".to_string(),
                weight: 0.5,
                correlation: 0.8,
            },
        ];

        let centrality = compute_centrality(&symbols, &mst);
        assert_eq!(centrality.len(), 3);

        let node_b = centrality.iter().find(|c| c.symbol == "B").unwrap();
        assert_eq!(node_b.degree, 2);
        assert!((node_b.betweenness - 1.0).abs() < 1e-6);
        assert!(node_b.is_hub);

        let node_a = centrality.iter().find(|c| c.symbol == "A").unwrap();
        assert_eq!(node_a.degree, 1);
        assert_eq!(node_a.betweenness, 0.0);
        assert!(!node_a.is_hub);
    }

    #[test]
    fn test_topology_metrics_calculation() {
        let symbols = vec!["A".to_string(), "B".to_string()];
        let matrix = CorrelationMatrix {
            symbols: symbols.clone(),
            correlations: vec![vec![1.0, 0.9], vec![0.9, 1.0]],
        };
        let mst = vec![MstEdge {
            source: "A".to_string(),
            target: "B".to_string(),
            weight: 0.447,
            correlation: 0.9,
        }];
        let centrality = vec![
            NodeCentrality {
                symbol: "A".to_string(),
                degree: 1,
                betweenness: 0.0,
                is_hub: true,
            },
            NodeCentrality {
                symbol: "B".to_string(),
                degree: 1,
                betweenness: 0.0,
                is_hub: false,
            },
        ];

        let metrics = compute_topology_metrics(&matrix, &mst, &centrality, 63);
        assert_eq!(metrics.hub_symbol, "A");
        assert!((metrics.normalized_tree_length - 0.447).abs() < 1e-3);
        assert_eq!(metrics.stress_status, "Contracción / Estrés Elevado");
    }

    #[test]
    fn test_hrp_seriation_groups_correlated() {
        let symbols = vec![
            "TECH_1".to_string(),
            "BOND_1".to_string(),
            "TECH_2".to_string(),
            "BOND_2".to_string(),
        ];
        // TECH_1 and TECH_2 are highly correlated (0.95)
        // BOND_1 and BOND_2 are highly correlated (0.95)
        // Cross correlation is low (0.1)
        let matrix = CorrelationMatrix {
            symbols,
            correlations: vec![
                vec![1.0, 0.1, 0.95, 0.1],  // TECH_1
                vec![0.1, 1.0, 0.1, 0.95],  // BOND_1
                vec![0.95, 0.1, 1.0, 0.1],  // TECH_2
                vec![0.1, 0.95, 0.1, 1.0],  // BOND_2
            ],
        };

        let hrp = compute_hrp_order(&matrix);
        assert_eq!(hrp.len(), 4);

        // In HRP order, TECH_1 and TECH_2 should be adjacent, and BOND_1 and BOND_2 should be adjacent
        let pos_t1 = hrp.iter().position(|s| s == "TECH_1").unwrap();
        let pos_t2 = hrp.iter().position(|s| s == "TECH_2").unwrap();
        let pos_b1 = hrp.iter().position(|s| s == "BOND_1").unwrap();
        let pos_b2 = hrp.iter().position(|s| s == "BOND_2").unwrap();

        assert_eq!((pos_t1 as isize - pos_t2 as isize).abs(), 1);
        assert_eq!((pos_b1 as isize - pos_b2 as isize).abs(), 1);
    }
}
