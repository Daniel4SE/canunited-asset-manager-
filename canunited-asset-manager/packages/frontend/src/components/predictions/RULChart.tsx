import { useTranslation } from 'react-i18next';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

interface RULChartProps {
  healthForecast: { date: string; predicted: number }[];
  currentHealth: number;
}

export default function RULChart({ healthForecast, currentHealth }: RULChartProps) {
  const { t } = useTranslation();

  // Add warning and critical threshold lines
  const warningThreshold = 40;
  const criticalThreshold = 20;

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={healthForecast}>
          <defs>
            <linearGradient id="healthForecastGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
              <stop offset="50%" stopColor="#f59e0b" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#ef4444" stopOpacity={0.1} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis
            dataKey="date"
            stroke="#64748b"
            fontSize={10}
            tickFormatter={(value) => {
              const date = new Date(value);
              return `${date.getMonth() + 1}/${date.getDate()}`;
            }}
            interval={6}
          />
          <YAxis stroke="#64748b" fontSize={10} domain={[0, 100]} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '8px',
              fontSize: '12px',
            }}
            labelFormatter={(label) => new Date(label).toLocaleDateString()}
            formatter={(value: number) => [`${value.toFixed(1)}%`, t('predictions.healthTrend')]}
          />
          <ReferenceLine
            y={warningThreshold}
            stroke="#f59e0b"
            strokeDasharray="5 5"
            label={{
              value: 'Warning',
              position: 'right',
              fill: '#f59e0b',
              fontSize: 10,
            }}
          />
          <ReferenceLine
            y={criticalThreshold}
            stroke="#ef4444"
            strokeDasharray="5 5"
            label={{
              value: 'Critical',
              position: 'right',
              fill: '#ef4444',
              fontSize: 10,
            }}
          />
          <Area
            type="monotone"
            dataKey="predicted"
            stroke="#22c55e"
            strokeWidth={2}
            fill="url(#healthForecastGradient)"
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
