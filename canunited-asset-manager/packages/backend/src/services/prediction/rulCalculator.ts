/**
 * Remaining Useful Life (RUL) Calculator
 * Uses Weibull distribution for failure probability estimation
 */

export interface RULPrediction {
  rul: number;
  confidenceLow: number;
  confidenceHigh: number;
  failureProbability30d: number;
}

// Failure threshold - health score below which asset is considered failed
const FAILURE_THRESHOLD = 20;

// Minimum acceptable health score for normal operation
const WARNING_THRESHOLD = 40;

/**
 * Calculate Remaining Useful Life
 * @param currentHealth - Current health score (0-100)
 * @param degradationRate - Daily degradation rate (health points per day)
 * @returns RUL prediction with confidence intervals
 */
export function calculateRUL(
  currentHealth: number,
  degradationRate: number
): RULPrediction {
  // Ensure valid inputs
  const health = Math.max(0, Math.min(100, currentHealth));
  const rate = Math.abs(degradationRate);

  // If health is already critical or degradation rate is zero
  if (health <= FAILURE_THRESHOLD) {
    return {
      rul: 0,
      confidenceLow: 0,
      confidenceHigh: 0,
      failureProbability30d: 1.0,
    };
  }

  if (rate < 0.001) {
    // Very slow or no degradation
    return {
      rul: 3650, // 10 years
      confidenceLow: 2000,
      confidenceHigh: 5000,
      failureProbability30d: 0.01,
    };
  }

  // Calculate days until health reaches failure threshold
  const daysToFailure = (health - FAILURE_THRESHOLD) / rate;

  // Apply Weibull-based confidence intervals
  // Shape parameter (beta) typically 2-4 for mechanical/electrical equipment
  const weibullShape = 2.5;

  // Calculate confidence bounds (approximately +/- 30% for typical industrial assets)
  const confidenceMultiplier = 0.3;
  const confidenceLow = Math.round(daysToFailure * (1 - confidenceMultiplier));
  const confidenceHigh = Math.round(daysToFailure * (1 + confidenceMultiplier));

  // Calculate 30-day failure probability using Weibull CDF
  const failureProbability30d = weibullCDF(30, daysToFailure, weibullShape);

  return {
    rul: Math.round(daysToFailure),
    confidenceLow: Math.max(0, confidenceLow),
    confidenceHigh,
    failureProbability30d: Math.round(failureProbability30d * 1000) / 1000,
  };
}

/**
 * Weibull Cumulative Distribution Function
 * P(T <= t) = 1 - exp(-(t/eta)^beta)
 * @param t - Time to evaluate
 * @param eta - Scale parameter (characteristic life)
 * @param beta - Shape parameter
 * @returns Probability of failure before time t
 */
function weibullCDF(t: number, eta: number, beta: number): number {
  if (t <= 0 || eta <= 0) return 0;
  return 1 - Math.exp(-Math.pow(t / eta, beta));
}

/**
 * Calculate hazard rate (instantaneous failure rate)
 * h(t) = (beta/eta) * (t/eta)^(beta-1)
 */
export function hazardRate(t: number, eta: number, beta: number): number {
  if (t <= 0 || eta <= 0) return 0;
  return (beta / eta) * Math.pow(t / eta, beta - 1);
}

/**
 * Determine risk level based on RUL and failure probability
 */
export function getRiskLevel(
  rul: number,
  failureProbability30d: number
): 'low' | 'medium' | 'high' | 'critical' {
  if (failureProbability30d > 0.5 || rul < 30) {
    return 'critical';
  }
  if (failureProbability30d > 0.3 || rul < 90) {
    return 'high';
  }
  if (failureProbability30d > 0.1 || rul < 180) {
    return 'medium';
  }
  return 'low';
}

/**
 * Estimate degradation rate from health history
 * @param healthHistory - Array of {timestamp, health} objects
 * @returns Daily degradation rate
 */
export function estimateDegradationRate(
  healthHistory: Array<{ timestamp: Date; healthScore: number }>
): number {
  if (healthHistory.length < 2) return 0;

  // Sort by timestamp
  const sorted = [...healthHistory].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
  );

  // Calculate total health change and total days
  const firstPoint = sorted[0];
  const lastPoint = sorted[sorted.length - 1];

  const healthChange = firstPoint.healthScore - lastPoint.healthScore;
  const daysDiff =
    (lastPoint.timestamp.getTime() - firstPoint.timestamp.getTime()) /
    (1000 * 60 * 60 * 24);

  if (daysDiff < 1) return 0;

  return healthChange / daysDiff;
}

/**
 * Calculate Mean Time Between Failures (MTBF) estimate
 * Based on Weibull parameters
 */
export function calculateMTBF(eta: number, beta: number): number {
  // MTBF = eta * Gamma(1 + 1/beta)
  // Using Stirling's approximation for gamma function
  const gammaArg = 1 + 1 / beta;
  const gamma = Math.sqrt(2 * Math.PI / gammaArg) * Math.pow(gammaArg / Math.E, gammaArg);
  return eta * gamma;
}

/**
 * Recommend maintenance window based on RUL
 */
export function recommendMaintenanceWindow(
  rul: number,
  failureProbability30d: number
): {
  urgency: 'immediate' | 'within_week' | 'within_month' | 'scheduled';
  recommendedDate: Date;
  description: string;
} {
  const today = new Date();

  if (failureProbability30d > 0.5 || rul < 14) {
    return {
      urgency: 'immediate',
      recommendedDate: today,
      description: 'Immediate maintenance required to prevent failure',
    };
  }

  if (failureProbability30d > 0.3 || rul < 30) {
    const date = new Date(today);
    date.setDate(date.getDate() + 7);
    return {
      urgency: 'within_week',
      recommendedDate: date,
      description: 'Schedule maintenance within the next 7 days',
    };
  }

  if (failureProbability30d > 0.1 || rul < 90) {
    const date = new Date(today);
    date.setDate(date.getDate() + 30);
    return {
      urgency: 'within_month',
      recommendedDate: date,
      description: 'Schedule maintenance within the next 30 days',
    };
  }

  // Schedule at 70% of RUL for optimal maintenance timing
  const optimalDays = Math.round(rul * 0.7);
  const date = new Date(today);
  date.setDate(date.getDate() + optimalDays);

  return {
    urgency: 'scheduled',
    recommendedDate: date,
    description: `Schedule preventive maintenance in approximately ${optimalDays} days`,
  };
}
