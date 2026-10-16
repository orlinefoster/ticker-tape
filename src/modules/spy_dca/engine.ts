import {
  SectorAsset,
  DcaPlanConfig,
  DcaCalculationResult,
  SuggestedOrder,
  WealthProjectionPoint,
} from './types';

/**
 * Calculates optimal monthly DCA purchases to steer the portfolio towards target weights
 * without triggering taxable sales or unnecessary transaction costs.
 */
export function calculateDcaRebalance(
  assets: SectorAsset[],
  config: DcaPlanConfig
): DcaCalculationResult {
  const isArs = config.currency === 'ARS';
  const getPrice = (a: SectorAsset) => (isArs ? a.currentPriceArs : a.currentPriceUsd);

  // 1. Current valuations
  const currentValues = assets.map((a) => a.currentQuantity * getPrice(a));
  const totalCurrentValue = currentValues.reduce((sum, v) => sum + v, 0);
  const totalProjectedValue = totalCurrentValue + config.monthlyDeposit;

  // 2. Compute current weights and target values
  const totalTargetWeight = assets.reduce((sum, a) => sum + a.targetWeightPct, 0) || 100;
  const normalizedTargets = assets.map((a) => a.targetWeightPct / totalTargetWeight);

  const deficits = assets.map((_a, i) => {
    const targetVal = totalProjectedValue * normalizedTargets[i];
    const currentVal = currentValues[i];
    return Math.max(0, targetVal - currentVal);
  });

  const totalDeficit = deficits.reduce((sum, d) => sum + d, 0);

  // 3. Allocate budget
  let remainingBudget = config.monthlyDeposit;
  const rawAllocations: number[] = new Array(assets.length).fill(0);

  if (totalDeficit > 0) {
    for (let i = 0; i < assets.length; i++) {
      if (deficits[i] > 0) {
        // Proportion of budget allocated according to deficit severity
        const share = deficits[i] / totalDeficit;
        rawAllocations[i] = Math.min(deficits[i], config.monthlyDeposit * share);
      }
    }
  } else {
    // If no deficit (portfolio empty or perfectly balanced), distribute directly by target weight
    for (let i = 0; i < assets.length; i++) {
      rawAllocations[i] = config.monthlyDeposit * normalizedTargets[i];
    }
  }

  // 4. Calculate integer shares and exact costs
  let totalSpent = 0;
  const suggestedOrders: SuggestedOrder[] = assets.map((a, i) => {
    const price = getPrice(a);
    const sharesToBuy = price > 0 ? Math.floor(rawAllocations[i] / price) : 0;
    const orderCost = sharesToBuy * price;
    totalSpent += orderCost;

    const currentVal = currentValues[i];
    const currentWeightPct = totalCurrentValue > 0 ? (currentVal / totalCurrentValue) * 100 : 0;
    const targetWeightPct = a.targetWeightPct;
    const driftPct = currentWeightPct - targetWeightPct;

    let status: 'underweight' | 'balanced' | 'overweight' = 'balanced';
    if (driftPct < -config.driftTolerancePct) {
      status = 'underweight';
    } else if (driftPct > config.driftTolerancePct) {
      status = 'overweight';
    }

    return {
      symbol: a.symbol,
      name: a.name,
      category: a.category,
      currentQuantity: a.currentQuantity,
      sharesToBuy,
      orderCost,
      currentWeightPct: Math.round(currentWeightPct * 100) / 100,
      targetWeightPct,
      projectedWeightPct: 0, // filled below
      driftPct: Math.round(driftPct * 100) / 100,
      status,
    };
  });

  // Second pass: if there is leftover cash and some assets can still take 1 more share, allocate greedy
  remainingBudget = config.monthlyDeposit - totalSpent;
  if (remainingBudget > 0) {
    // Sort by largest deficit to price ratio
    const candidates = assets
      .map((a, i) => ({
        index: i,
        price: getPrice(a),
        deficit: deficits[i] - suggestedOrders[i].orderCost,
      }))
      .filter((c) => c.price > 0 && c.price <= remainingBudget)
      .sort((a, b) => b.deficit - a.deficit);

    for (const c of candidates) {
      if (c.price <= remainingBudget) {
        suggestedOrders[c.index].sharesToBuy += 1;
        suggestedOrders[c.index].orderCost += c.price;
        totalSpent += c.price;
        remainingBudget -= c.price;
      }
    }
  }

  // 5. Final projected weights
  const finalTotalValue = totalCurrentValue + totalSpent;
  for (let i = 0; i < suggestedOrders.length; i++) {
    const postVal = currentValues[i] + suggestedOrders[i].orderCost;
    suggestedOrders[i].projectedWeightPct =
      finalTotalValue > 0 ? Math.round(((postVal / finalTotalValue) * 100) * 100) / 100 : 0;
  }

  return {
    totalCurrentValue: Math.round(totalCurrentValue * 100) / 100,
    monthlyDeposit: config.monthlyDeposit,
    totalProjectedValue: Math.round(finalTotalValue * 100) / 100,
    suggestedOrders,
    allocatedAmount: Math.round(totalSpent * 100) / 100,
    remainingCash: Math.round((config.monthlyDeposit - totalSpent) * 100) / 100,
    currency: config.currency,
  };
}

/**
 * Projects cumulative wealth and compound returns over time with regular DCA monthly deposits.
 */
export function projectCompoundWealth(
  initialCapital: number,
  monthlyDeposit: number,
  annualReturnPct: number,
  years: number = 10
): WealthProjectionPoint[] {
  const points: WealthProjectionPoint[] = [];
  const monthlyRate = Math.pow(1 + annualReturnPct / 100, 1 / 12) - 1;
  const totalMonths = years * 12;

  let currentWealth = initialCapital;
  let totalContributions = initialCapital;

  for (let m = 1; m <= totalMonths; m++) {
    currentWealth = (currentWealth + monthlyDeposit) * (1 + monthlyRate);
    totalContributions += monthlyDeposit;

    if (m % 12 === 0 || m === 1 || m === totalMonths) {
      points.push({
        month: m,
        year: Math.floor(m / 12),
        totalContributions: Math.round(totalContributions),
        projectedPortfolioValue: Math.round(currentWealth),
        compoundGains: Math.round(currentWealth - totalContributions),
      });
    }
  }

  return points;
}
