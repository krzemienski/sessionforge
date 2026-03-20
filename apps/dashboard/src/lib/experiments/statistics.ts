/**
 * Statistical analysis library for A/B experiment evaluation.
 * Pure functions — no database or external dependencies.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export type ExperimentKpi =
  | "views"
  | "likes"
  | "comments"
  | "shares"
  | "engagementRate";

export type SignificanceLevel =
  | "not_significant"
  | "low_confidence"
  | "medium_confidence"
  | "high_confidence";

export interface VariantResult {
  variantId: string;
  label: string;
  isControl: boolean;
  /** Total number of impressions / sample size */
  sampleSize: number;
  /** Total successes (clicks, likes, etc.) or rate value depending on KPI */
  metricValue: number;
}

export interface SignificanceResult {
  pValue: number;
  confidenceInterval: [number, number];
  zScore: number;
  significanceLevel: SignificanceLevel;
}

export interface WinnerResult {
  winnerId: string | null;
  winnerLabel: string | null;
  confidence: SignificanceLevel;
  pValue: number | null;
  variantStats: Array<{
    variantId: string;
    label: string;
    metricValue: number;
    sampleSize: number;
    rate: number;
  }>;
  minimumSampleReached: boolean;
}

// ── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Approximation of the standard normal CDF using the Abramowitz & Stegun
 * rational approximation (formula 26.2.17).  Accurate to ~1.5 × 10⁻⁷.
 */
function normalCdf(x: number): number {
  if (x === 0) return 0.5;

  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x);

  const b1 = 0.319381530;
  const b2 = -0.356563782;
  const b3 = 1.781477937;
  const b4 = -1.821255978;
  const b5 = 1.330274429;
  const p = 0.2316419;

  const t = 1.0 / (1.0 + p * absX);
  const t2 = t * t;
  const t3 = t2 * t;
  const t4 = t3 * t;
  const t5 = t4 * t;

  const pdf = Math.exp(-0.5 * absX * absX) / Math.sqrt(2 * Math.PI);
  const cdf = 1.0 - pdf * (b1 * t + b2 * t2 + b3 * t3 + b4 * t4 + b5 * t5);

  return sign === 1 ? cdf : 1.0 - cdf;
}

/**
 * Returns a two-tailed p-value from a z-score.
 */
function twoTailedPValue(z: number): number {
  return 2 * (1 - normalCdf(Math.abs(z)));
}

/**
 * Map a p-value to a human-readable significance level.
 */
function pValueToSignificance(pValue: number): SignificanceLevel {
  if (pValue < 0.01) return "high_confidence";
  if (pValue < 0.05) return "medium_confidence";
  if (pValue < 0.1) return "low_confidence";
  return "not_significant";
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Two-proportion z-test.
 *
 * Compares the success rate of a treatment group against a control group.
 * For rate-based KPIs (engagementRate) the `metricValue` is already a rate
 * so the caller should pass it as `successes = metricValue * sampleSize`.
 *
 * @param controlSuccesses  Number of successes in the control group
 * @param controlSampleSize Total observations in the control group
 * @param treatmentSuccesses  Number of successes in the treatment group
 * @param treatmentSampleSize Total observations in the treatment group
 */
export function zTestForProportions(
  controlSuccesses: number,
  controlSampleSize: number,
  treatmentSuccesses: number,
  treatmentSampleSize: number,
): { zScore: number; pValue: number } {
  if (controlSampleSize === 0 || treatmentSampleSize === 0) {
    return { zScore: 0, pValue: 1 };
  }

  const p1 = controlSuccesses / controlSampleSize;
  const p2 = treatmentSuccesses / treatmentSampleSize;

  // Pooled proportion under H₀
  const pPool =
    (controlSuccesses + treatmentSuccesses) /
    (controlSampleSize + treatmentSampleSize);

  if (pPool === 0 || pPool === 1) {
    return { zScore: 0, pValue: 1 };
  }

  const se = Math.sqrt(
    pPool * (1 - pPool) * (1 / controlSampleSize + 1 / treatmentSampleSize),
  );

  if (se === 0) {
    return { zScore: 0, pValue: 1 };
  }

  const z = (p2 - p1) / se;
  return { zScore: z, pValue: twoTailedPValue(z) };
}

/**
 * Compute statistical significance between a treatment and a control variant.
 *
 * Returns the p-value, a 95 % confidence interval for the difference in rates,
 * and the corresponding significance level.
 */
export function computeSignificance(
  control: VariantResult,
  treatment: VariantResult,
): SignificanceResult {
  if (control.sampleSize === 0 || treatment.sampleSize === 0) {
    return {
      pValue: 1,
      confidenceInterval: [0, 0],
      zScore: 0,
      significanceLevel: "not_significant",
    };
  }

  const { zScore, pValue } = zTestForProportions(
    control.metricValue,
    control.sampleSize,
    treatment.metricValue,
    treatment.sampleSize,
  );

  // 95 % CI for the difference in proportions (p2 - p1)
  const p1 = control.metricValue / control.sampleSize;
  const p2 = treatment.metricValue / treatment.sampleSize;
  const diff = p2 - p1;

  const se = Math.sqrt(
    (p1 * (1 - p1)) / control.sampleSize +
      (p2 * (1 - p2)) / treatment.sampleSize,
  );

  const z95 = 1.96;
  const ciLower = diff - z95 * se;
  const ciUpper = diff + z95 * se;

  return {
    pValue,
    confidenceInterval: [ciLower, ciUpper],
    zScore,
    significanceLevel: pValueToSignificance(pValue),
  };
}

/**
 * Given all variant results for an experiment, determine the best performer
 * compared to the control variant.
 *
 * @param variants  Array of variant results (must include exactly one control)
 * @param minimumSampleSize  Minimum observations per variant before declaring a winner (default 30)
 */
export function determineWinner(
  variants: VariantResult[],
  minimumSampleSize: number = 30,
): WinnerResult {
  const control = variants.find((v) => v.isControl);

  const variantStats = variants.map((v) => ({
    variantId: v.variantId,
    label: v.label,
    metricValue: v.metricValue,
    sampleSize: v.sampleSize,
    rate: v.sampleSize > 0 ? v.metricValue / v.sampleSize : 0,
  }));

  const minimumSampleReached = variants.every(
    (v) => v.sampleSize >= minimumSampleSize,
  );

  // Cannot determine a winner without a control
  if (!control) {
    return {
      winnerId: null,
      winnerLabel: null,
      confidence: "not_significant",
      pValue: null,
      variantStats,
      minimumSampleReached,
    };
  }

  // Not enough data yet
  if (!minimumSampleReached) {
    return {
      winnerId: null,
      winnerLabel: null,
      confidence: "not_significant",
      pValue: null,
      variantStats,
      minimumSampleReached,
    };
  }

  const treatments = variants.filter((v) => !v.isControl);

  let bestVariant: VariantResult | null = null;
  let bestSignificance: SignificanceResult | null = null;

  for (const treatment of treatments) {
    const sig = computeSignificance(control, treatment);

    // Only consider variants that outperform control (positive lift)
    const treatmentRate = treatment.metricValue / treatment.sampleSize;
    const controlRate = control.metricValue / control.sampleSize;

    if (treatmentRate <= controlRate) {
      continue;
    }

    if (
      !bestSignificance ||
      sig.pValue < bestSignificance.pValue
    ) {
      bestVariant = treatment;
      bestSignificance = sig;
    }
  }

  // If no treatment beats the control, control itself is best — but we report
  // no winner (the control is the baseline, not something to "promote").
  if (!bestVariant || !bestSignificance) {
    return {
      winnerId: null,
      winnerLabel: null,
      confidence: "not_significant",
      pValue: null,
      variantStats,
      minimumSampleReached,
    };
  }

  return {
    winnerId: bestVariant.variantId,
    winnerLabel: bestVariant.label,
    confidence: bestSignificance.significanceLevel,
    pValue: bestSignificance.pValue,
    variantStats,
    minimumSampleReached,
  };
}

/**
 * Estimate the minimum sample size per variant for a two-proportion z-test.
 *
 * Uses the standard formula:
 *   n = (Z_α/2 + Z_β)² × (p₁(1-p₁) + p₂(1-p₂)) / (p₂ - p₁)²
 *
 * @param baselineRate  Expected conversion/engagement rate for control (0-1)
 * @param minimumDetectableEffect  Minimum absolute difference to detect (e.g. 0.02 for 2 pp)
 * @param alpha  Significance level (default 0.05)
 * @param power  Statistical power (default 0.8)
 */
export function calculateSampleSize(
  baselineRate: number,
  minimumDetectableEffect: number,
  alpha: number = 0.05,
  power: number = 0.8,
): number {
  if (minimumDetectableEffect <= 0 || baselineRate <= 0 || baselineRate >= 1) {
    return Infinity;
  }

  // z-values for common alpha and power via inverse-normal lookup
  const zAlpha = zFromCdf(1 - alpha / 2);
  const zBeta = zFromCdf(power);

  const p1 = baselineRate;
  const p2 = baselineRate + minimumDetectableEffect;

  if (p2 >= 1 || p2 <= 0) {
    return Infinity;
  }

  const numerator = Math.pow(zAlpha + zBeta, 2) * (p1 * (1 - p1) + p2 * (1 - p2));
  const denominator = Math.pow(p2 - p1, 2);

  return Math.ceil(numerator / denominator);
}

/**
 * Inverse normal CDF approximation (Beasley-Springer-Moro algorithm).
 * Returns z such that Φ(z) ≈ p.
 */
function zFromCdf(p: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  if (p === 0.5) return 0;

  // Rational approximation (Abramowitz & Stegun 26.2.23)
  const a = [
    -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2,
    1.383577518672690e2, -3.066479806614716e1, 2.506628277459239e0,
  ];
  const b = [
    -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2,
    6.680131188771972e1, -1.328068155288572e1,
  ];
  const c = [
    -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838e0,
    -2.549732539343734e0, 4.374664141464968e0, 2.938163982698783e0,
  ];
  const d = [
    7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996e0,
    3.754408661907416e0,
  ];

  const pLow = 0.02425;
  const pHigh = 1 - pLow;

  let q: number;
  let r: number;

  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  } else if (p <= pHigh) {
    q = p - 0.5;
    r = q * q;
    return (
      ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
    );
  } else {
    q = Math.sqrt(-2 * Math.log(1 - p));
    return (
      -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  }
}
