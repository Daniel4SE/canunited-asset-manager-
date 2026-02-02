/**
 * Holt-Winters Exponential Smoothing
 * Used for trend detection and forecasting
 */

export interface ExponentialSmoothingResult {
  smoothed: number[];
  trend: number;
  level: number;
}

/**
 * Simple exponential smoothing
 * @param data - Array of numeric values
 * @param alpha - Smoothing factor (0 < alpha < 1). Higher values give more weight to recent observations.
 * @returns Smoothed values
 */
export function exponentialSmoothing(data: number[], alpha: number = 0.3): number[] {
  if (data.length === 0) return [];
  if (data.length === 1) return [data[0]];

  const smoothed: number[] = [data[0]];

  for (let i = 1; i < data.length; i++) {
    const smoothedValue = alpha * data[i] + (1 - alpha) * smoothed[i - 1];
    smoothed.push(smoothedValue);
  }

  return smoothed;
}

/**
 * Double exponential smoothing (Holt's method)
 * Captures both level and trend
 * @param data - Array of numeric values
 * @param alpha - Level smoothing factor (0 < alpha < 1)
 * @param beta - Trend smoothing factor (0 < beta < 1)
 * @returns Smoothed values and trend
 */
export function doubleExponentialSmoothing(
  data: number[],
  alpha: number = 0.3,
  beta: number = 0.1
): ExponentialSmoothingResult {
  if (data.length === 0) {
    return { smoothed: [], trend: 0, level: 0 };
  }

  if (data.length === 1) {
    return { smoothed: [data[0]], trend: 0, level: data[0] };
  }

  // Initialize
  let level = data[0];
  let trend = data[1] - data[0];
  const smoothed: number[] = [level];

  for (let i = 1; i < data.length; i++) {
    const lastLevel = level;

    // Update level
    level = alpha * data[i] + (1 - alpha) * (level + trend);

    // Update trend
    trend = beta * (level - lastLevel) + (1 - beta) * trend;

    smoothed.push(level + trend);
  }

  return { smoothed, trend, level };
}

/**
 * Forecast future values using double exponential smoothing
 * @param data - Historical data
 * @param periods - Number of periods to forecast
 * @param alpha - Level smoothing factor
 * @param beta - Trend smoothing factor
 * @returns Array of forecasted values
 */
export function forecastExponential(
  data: number[],
  periods: number,
  alpha: number = 0.3,
  beta: number = 0.1
): number[] {
  const { trend, level } = doubleExponentialSmoothing(data, alpha, beta);

  const forecast: number[] = [];
  for (let i = 1; i <= periods; i++) {
    forecast.push(level + i * trend);
  }

  return forecast;
}

/**
 * Calculate optimal smoothing parameters using grid search
 * Minimizes Mean Squared Error (MSE)
 */
export function optimizeParameters(
  data: number[]
): { alpha: number; beta: number; mse: number } {
  let bestAlpha = 0.3;
  let bestBeta = 0.1;
  let bestMSE = Infinity;

  // Grid search
  for (let alpha = 0.1; alpha <= 0.9; alpha += 0.1) {
    for (let beta = 0.1; beta <= 0.5; beta += 0.1) {
      const { smoothed } = doubleExponentialSmoothing(data, alpha, beta);

      // Calculate MSE
      let sumSquaredError = 0;
      for (let i = 1; i < data.length; i++) {
        const error = data[i] - smoothed[i - 1];
        sumSquaredError += error * error;
      }
      const mse = sumSquaredError / (data.length - 1);

      if (mse < bestMSE) {
        bestMSE = mse;
        bestAlpha = alpha;
        bestBeta = beta;
      }
    }
  }

  return { alpha: bestAlpha, beta: bestBeta, mse: bestMSE };
}
