import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { AlertTriangle, Clock, TrendingDown, Calendar } from 'lucide-react';
import clsx from 'clsx';

interface FailureRiskCardProps {
  predictedRul: number;
  degradationRate: number;
  confidenceLow: number;
  confidenceHigh: number;
  failureProbability30d: number;
  healthTrend: 'improving' | 'stable' | 'declining';
  maintenanceRecommendation?: {
    urgency: string;
    recommendedDate: string;
    description: string;
  };
}

export default function FailureRiskCard({
  predictedRul,
  degradationRate,
  confidenceLow,
  confidenceHigh,
  failureProbability30d,
  healthTrend,
  maintenanceRecommendation,
}: FailureRiskCardProps) {
  const { t } = useTranslation();

  const riskLevel = getRiskLevel(failureProbability30d);
  const riskColors = {
    low: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/50' },
    medium: { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/50' },
    high: { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/50' },
    critical: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/50' },
  };

  const trendIcons = {
    improving: { icon: '↑', color: 'text-emerald-400' },
    stable: { icon: '→', color: 'text-slate-400' },
    declining: { icon: '↓', color: 'text-red-400' },
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="card p-6"
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">{t('predictions.rul')}</h2>
        <span
          className={clsx(
            'px-3 py-1 rounded-full text-sm font-medium border',
            riskColors[riskLevel].bg,
            riskColors[riskLevel].text,
            riskColors[riskLevel].border
          )}
        >
          {t(`predictions.${riskLevel}Risk`)}
        </span>
      </div>

      {/* Main RUL Display */}
      <div className="flex items-center justify-center py-6">
        <div className="text-center">
          <div className="flex items-baseline justify-center gap-2">
            <span className="text-5xl font-bold font-mono text-white">{predictedRul}</span>
            <span className="text-xl text-slate-400">{t('predictions.days')}</span>
          </div>
          <p className="text-sm text-slate-500 mt-2">
            {t('predictions.confidenceInterval')}: {confidenceLow} - {confidenceHigh} {t('predictions.days')}
          </p>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-4 mt-4">
        {/* Failure Probability */}
        <div className="bg-slate-800/50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className={clsx('w-4 h-4', riskColors[riskLevel].text)} />
            <span className="text-xs text-slate-400">{t('predictions.failureProbability')}</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className={clsx('text-2xl font-bold font-mono', riskColors[riskLevel].text)}>
              {(failureProbability30d * 100).toFixed(1)}%
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">{t('predictions.next30Days')}</p>
        </div>

        {/* Degradation Rate */}
        <div className="bg-slate-800/50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="w-4 h-4 text-slate-400" />
            <span className="text-xs text-slate-400">{t('predictions.degradationRate')}</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold font-mono text-white">
              {degradationRate.toFixed(2)}
            </span>
            <span className="text-sm text-slate-500">%/{t('predictions.days').toLowerCase()}</span>
          </div>
          <div className="flex items-center gap-1 mt-1">
            <span className={clsx('text-sm', trendIcons[healthTrend].color)}>
              {trendIcons[healthTrend].icon}
            </span>
            <span className="text-xs text-slate-500">
              {healthTrend.charAt(0).toUpperCase() + healthTrend.slice(1)}
            </span>
          </div>
        </div>
      </div>

      {/* Maintenance Recommendation */}
      {maintenanceRecommendation && (
        <div
          className={clsx(
            'mt-4 p-4 rounded-lg border',
            riskColors[riskLevel].bg,
            riskColors[riskLevel].border
          )}
        >
          <div className="flex items-start gap-3">
            <Calendar className={clsx('w-5 h-5 mt-0.5', riskColors[riskLevel].text)} />
            <div>
              <p className={clsx('font-medium', riskColors[riskLevel].text)}>
                {maintenanceRecommendation.urgency === 'immediate'
                  ? 'Immediate Action Required'
                  : maintenanceRecommendation.urgency === 'within_week'
                  ? 'Action Required This Week'
                  : maintenanceRecommendation.urgency === 'within_month'
                  ? 'Schedule Within 30 Days'
                  : 'Scheduled Maintenance'}
              </p>
              <p className="text-sm text-slate-400 mt-1">
                {maintenanceRecommendation.description}
              </p>
              <p className="text-xs text-slate-500 mt-2">
                Recommended: {new Date(maintenanceRecommendation.recommendedDate).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}

function getRiskLevel(probability: number): 'low' | 'medium' | 'high' | 'critical' {
  if (probability > 0.5) return 'critical';
  if (probability > 0.3) return 'high';
  if (probability > 0.1) return 'medium';
  return 'low';
}
