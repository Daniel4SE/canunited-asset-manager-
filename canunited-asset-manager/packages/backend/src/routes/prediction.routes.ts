import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { predictAssetRUL, predictFleetRUL, type HealthDataPoint } from '../services/prediction/index.js';
import { getRiskLevel, recommendMaintenanceWindow } from '../services/prediction/rulCalculator.js';

const router = Router();

// Get RUL prediction for a single asset
router.get('/:assetId/rul', authenticate, async (req, res, next) => {
  try {
    const { assetId } = req.params;

    // In a real implementation, fetch health history from database
    // For demo, generate mock health history
    const healthHistory = generateMockHealthHistory();

    const prediction = await predictAssetRUL(assetId, healthHistory);
    const riskLevel = getRiskLevel(prediction.predictedRul, prediction.failureProbability30d);
    const maintenanceRecommendation = recommendMaintenanceWindow(
      prediction.predictedRul,
      prediction.failureProbability30d
    );

    res.json({
      success: true,
      data: {
        ...prediction,
        riskLevel,
        maintenanceRecommendation,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Get fleet-wide predictions
router.get('/fleet', authenticate, async (req, res, next) => {
  try {
    // In a real implementation, fetch all assets and their health history
    // For demo, generate mock data for multiple assets
    const mockAssets = [
      { id: 'asset-001', healthHistory: generateMockHealthHistory(85, 0.15) },
      { id: 'asset-002', healthHistory: generateMockHealthHistory(72, 0.25) },
      { id: 'asset-003', healthHistory: generateMockHealthHistory(95, 0.05) },
      { id: 'asset-004', healthHistory: generateMockHealthHistory(58, 0.35) },
      { id: 'asset-005', healthHistory: generateMockHealthHistory(91, 0.08) },
    ];

    const fleetPrediction = await predictFleetRUL(mockAssets);

    res.json({
      success: true,
      data: fleetPrediction,
    });
  } catch (error) {
    next(error);
  }
});

// Batch prediction for multiple assets
router.post('/batch', authenticate, async (req, res, next) => {
  try {
    const { assetIds } = req.body;

    if (!Array.isArray(assetIds) || assetIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'assetIds must be a non-empty array',
        },
      });
    }

    // Generate predictions for each asset
    const predictions = await Promise.all(
      assetIds.map(async (assetId: string) => {
        const healthHistory = generateMockHealthHistory();
        const prediction = await predictAssetRUL(assetId, healthHistory);
        const riskLevel = getRiskLevel(prediction.predictedRul, prediction.failureProbability30d);

        return {
          ...prediction,
          riskLevel,
        };
      })
    );

    return res.json({
      success: true,
      data: {
        predictions,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

// Get risk distribution for dashboard
router.get('/risk-distribution', authenticate, async (_req, res, next) => {
  try {
    // Generate mock risk distribution data
    const distribution = {
      critical: 2,
      high: 5,
      medium: 12,
      low: 31,
      total: 50,
    };

    const criticalAssets = [
      { id: 'asset-004', name: 'Power Transformer T2', rul: 28, probability: 0.52 },
      { id: 'asset-012', name: 'LV Panel B3', rul: 35, probability: 0.48 },
    ];

    res.json({
      success: true,
      data: {
        distribution,
        criticalAssets,
        lastUpdated: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

// Helper function to generate mock health history
function generateMockHealthHistory(
  startHealth: number = 85,
  degradationRate: number = 0.1
): HealthDataPoint[] {
  const history: HealthDataPoint[] = [];
  const today = new Date();
  let currentHealth = startHealth;

  // Generate 90 days of history
  for (let i = 90; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);

    // Add some random noise
    const noise = (Math.random() - 0.5) * 2;
    currentHealth = Math.max(0, Math.min(100, currentHealth - degradationRate + noise));

    history.push({
      timestamp: date,
      healthScore: Math.round(currentHealth * 10) / 10,
    });
  }

  return history;
}

export const predictionRoutes = router;
