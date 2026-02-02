import { exponentialSmoothing } from './exponentialSmoothing.js';
import { linearRegression } from './linearRegression.js';
import { calculateRUL, type RULPrediction } from './rulCalculator.js';

export interface HealthDataPoint {
  timestamp: Date;
  healthScore: number;
}

export interface PredictionResult {
  assetId: string;
  predictedRul: number;
  degradationRate: number;
  confidenceLow: number;
  confidenceHigh: number;
  failureProbability30d: number;
  healthTrend: 'improving' | 'stable' | 'declining';
  predictedAt: Date;
  healthForecast: { date: string; predicted: number }[];
}

export async function predictAssetRUL(
  assetId: string,
  healthHistory: HealthDataPoint[]
): Promise<PredictionResult> {
  // Ensure we have enough data points
  if (healthHistory.length < 3) {
    return generateDefaultPrediction(assetId);
  }

  // Sort by timestamp
  const sortedHistory = [...healthHistory].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
  );

  // Extract health scores
  const scores = sortedHistory.map((h) => h.healthScore);

  // Calculate degradation rate using linear regression
  const regression = linearRegression(scores);
  const degradationRate = regression.slope;

  // Apply exponential smoothing for trend detection
  const smoothed = exponentialSmoothing(scores, 0.3);
  const recentTrend = smoothed[smoothed.length - 1] - smoothed[smoothed.length - 2];

  // Determine trend
  let healthTrend: 'improving' | 'stable' | 'declining';
  if (recentTrend > 0.5) {
    healthTrend = 'improving';
  } else if (recentTrend < -0.5) {
    healthTrend = 'declining';
  } else {
    healthTrend = 'stable';
  }

  // Calculate RUL
  const currentHealth = scores[scores.length - 1];
  const rulResult = calculateRUL(currentHealth, degradationRate);

  // Generate 30-day forecast
  const healthForecast = generateForecast(currentHealth, degradationRate, 30);

  return {
    assetId,
    predictedRul: rulResult.rul,
    degradationRate: Math.abs(degradationRate),
    confidenceLow: rulResult.confidenceLow,
    confidenceHigh: rulResult.confidenceHigh,
    failureProbability30d: rulResult.failureProbability30d,
    healthTrend,
    predictedAt: new Date(),
    healthForecast,
  };
}

export async function predictFleetRUL(
  assets: Array<{ id: string; healthHistory: HealthDataPoint[] }>
): Promise<{
  predictions: PredictionResult[];
  summary: {
    atRisk: number;
    healthy: number;
    avgRul: number;
    shortestRul: { assetId: string; rul: number };
  };
}> {
  const predictions = await Promise.all(
    assets.map((asset) => predictAssetRUL(asset.id, asset.healthHistory))
  );

  // Calculate summary statistics
  const atRisk = predictions.filter((p) => p.failureProbability30d > 0.3).length;
  const healthy = predictions.filter((p) => p.failureProbability30d < 0.1).length;
  const avgRul = predictions.reduce((sum, p) => sum + p.predictedRul, 0) / predictions.length;

  const shortestRul = predictions.reduce(
    (min, p) => (p.predictedRul < min.rul ? { assetId: p.assetId, rul: p.predictedRul } : min),
    { assetId: '', rul: Infinity }
  );

  return {
    predictions,
    summary: {
      atRisk,
      healthy,
      avgRul: Math.round(avgRul),
      shortestRul,
    },
  };
}

function generateDefaultPrediction(assetId: string): PredictionResult {
  return {
    assetId,
    predictedRul: 365,
    degradationRate: 0.01,
    confidenceLow: 300,
    confidenceHigh: 450,
    failureProbability30d: 0.05,
    healthTrend: 'stable',
    predictedAt: new Date(),
    healthForecast: generateForecast(85, 0.01, 30),
  };
}

function generateForecast(
  currentHealth: number,
  dailyDegradation: number,
  days: number
): { date: string; predicted: number }[] {
  const forecast: { date: string; predicted: number }[] = [];
  const today = new Date();

  for (let i = 0; i <= days; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);

    const predicted = Math.max(0, Math.min(100, currentHealth - i * Math.abs(dailyDegradation)));

    forecast.push({
      date: date.toISOString().split('T')[0],
      predicted: Math.round(predicted * 10) / 10,
    });
  }

  return forecast;
}

export { type RULPrediction } from './rulCalculator.js';
