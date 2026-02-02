/**
 * Linear Regression for degradation rate calculation
 */

export interface RegressionResult {
  slope: number;
  intercept: number;
  rSquared: number;
  predictions: number[];
}

/**
 * Simple linear regression
 * Calculates the best-fit line y = mx + b
 * @param y - Array of dependent variable values (e.g., health scores)
 * @param x - Optional array of independent variable values (defaults to [0, 1, 2, ...])
 * @returns Regression coefficients and statistics
 */
export function linearRegression(y: number[], x?: number[]): RegressionResult {
  const n = y.length;

  if (n === 0) {
    return { slope: 0, intercept: 0, rSquared: 0, predictions: [] };
  }

  if (n === 1) {
    return { slope: 0, intercept: y[0], rSquared: 1, predictions: [y[0]] };
  }

  // Generate x values if not provided (0, 1, 2, ...)
  const xValues = x || Array.from({ length: n }, (_, i) => i);

  // Calculate means
  const xMean = xValues.reduce((sum, val) => sum + val, 0) / n;
  const yMean = y.reduce((sum, val) => sum + val, 0) / n;

  // Calculate slope and intercept
  let numerator = 0;
  let denominator = 0;

  for (let i = 0; i < n; i++) {
    numerator += (xValues[i] - xMean) * (y[i] - yMean);
    denominator += (xValues[i] - xMean) ** 2;
  }

  const slope = denominator !== 0 ? numerator / denominator : 0;
  const intercept = yMean - slope * xMean;

  // Calculate predictions and R-squared
  const predictions: number[] = [];
  let ssRes = 0; // Residual sum of squares
  let ssTot = 0; // Total sum of squares

  for (let i = 0; i < n; i++) {
    const predicted = slope * xValues[i] + intercept;
    predictions.push(predicted);
    ssRes += (y[i] - predicted) ** 2;
    ssTot += (y[i] - yMean) ** 2;
  }

  const rSquared = ssTot !== 0 ? 1 - ssRes / ssTot : 0;

  return { slope, intercept, rSquared, predictions };
}

/**
 * Predict future value using linear regression
 * @param regressionResult - Result from linearRegression()
 * @param xValue - The x value to predict for
 * @returns Predicted y value
 */
export function predictValue(regressionResult: RegressionResult, xValue: number): number {
  return regressionResult.slope * xValue + regressionResult.intercept;
}

/**
 * Calculate the confidence interval for a prediction
 * Uses standard error of the estimate
 * @param y - Original y values
 * @param predictions - Predicted values
 * @param confidenceLevel - Confidence level (default 0.95 for 95%)
 * @returns Margin of error for the confidence interval
 */
export function calculateConfidenceInterval(
  y: number[],
  predictions: number[],
  confidenceLevel: number = 0.95
): number {
  const n = y.length;
  if (n <= 2) return 0;

  // Calculate standard error of the estimate
  let sumSquaredError = 0;
  for (let i = 0; i < n; i++) {
    sumSquaredError += (y[i] - predictions[i]) ** 2;
  }

  const standardError = Math.sqrt(sumSquaredError / (n - 2));

  // t-value approximation for common confidence levels
  // Using approximation for large samples
  const tValue =
    confidenceLevel === 0.95 ? 1.96 : confidenceLevel === 0.99 ? 2.576 : 1.645;

  return tValue * standardError;
}

/**
 * Polynomial regression for more complex degradation patterns
 * Fits y = a0 + a1*x + a2*x^2 + ...
 * @param y - Dependent variable values
 * @param degree - Polynomial degree (default 2 for quadratic)
 * @returns Coefficients array [a0, a1, a2, ...]
 */
export function polynomialRegression(
  y: number[],
  degree: number = 2
): { coefficients: number[]; predictions: number[] } {
  const n = y.length;
  const x = Array.from({ length: n }, (_, i) => i);

  // Build Vandermonde matrix
  const matrix: number[][] = [];
  const vector: number[] = [];

  for (let i = 0; i <= degree; i++) {
    matrix[i] = [];
    for (let j = 0; j <= degree; j++) {
      let sum = 0;
      for (let k = 0; k < n; k++) {
        sum += Math.pow(x[k], i + j);
      }
      matrix[i][j] = sum;
    }

    let sum = 0;
    for (let k = 0; k < n; k++) {
      sum += y[k] * Math.pow(x[k], i);
    }
    vector[i] = sum;
  }

  // Solve using Gaussian elimination (simplified)
  const coefficients = solveLinearSystem(matrix, vector);

  // Calculate predictions
  const predictions: number[] = [];
  for (let i = 0; i < n; i++) {
    let predicted = 0;
    for (let j = 0; j <= degree; j++) {
      predicted += coefficients[j] * Math.pow(x[i], j);
    }
    predictions.push(predicted);
  }

  return { coefficients, predictions };
}

/**
 * Gaussian elimination to solve Ax = b
 */
function solveLinearSystem(A: number[][], b: number[]): number[] {
  const n = A.length;
  const augmented: number[][] = A.map((row, i) => [...row, b[i]]);

  // Forward elimination
  for (let i = 0; i < n; i++) {
    // Find pivot
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(augmented[k][i]) > Math.abs(augmented[maxRow][i])) {
        maxRow = k;
      }
    }
    [augmented[i], augmented[maxRow]] = [augmented[maxRow], augmented[i]];

    // Eliminate
    for (let k = i + 1; k < n; k++) {
      const factor = augmented[k][i] / augmented[i][i];
      for (let j = i; j <= n; j++) {
        augmented[k][j] -= factor * augmented[i][j];
      }
    }
  }

  // Back substitution
  const x: number[] = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    x[i] = augmented[i][n];
    for (let j = i + 1; j < n; j++) {
      x[i] -= augmented[i][j] * x[j];
    }
    x[i] /= augmented[i][i];
  }

  return x;
}
