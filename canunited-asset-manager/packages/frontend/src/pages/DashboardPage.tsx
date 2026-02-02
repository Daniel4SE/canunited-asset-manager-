import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Building2,
  Boxes,
  Radio,
  AlertTriangle,
  Activity,
  TrendingUp,
  TrendingDown,
  Minus,
  Bell,
  Wrench,
  ChevronRight,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from 'recharts';
import { getApi, endpoints } from '../lib/api';
import clsx from 'clsx';

const healthColors = {
  excellent: '#10b981',
  good: '#22c55e',
  fair: '#f59e0b',
  poor: '#f97316',
  critical: '#ef4444',
};

const vendorColors: Record<string, string> = {
  schneider: '#3dcd58',
  abb: '#ff000f',
  siemens: '#009999',
  bosch: '#ea0016',
  eaton: '#0033a0',
  generic: '#6366f1',
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export default function DashboardPage() {
  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const response = await getApi().get(endpoints.dashboard);
      return response.data.data;
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const summary = dashboardData?.summary || {};
  const healthDist = dashboardData?.healthDistribution || {};
  const vendorDist = dashboardData?.vendorDistribution || [];
  const recentAlerts = dashboardData?.recentAlerts || [];
  const attentionAssets = dashboardData?.assetsNeedingAttention || [];

  // Transform health distribution for pie chart
  const healthChartData = Object.entries(healthDist).map(([key, value]) => ({
    name: key.charAt(0).toUpperCase() + key.slice(1),
    value: value as number,
    color: healthColors[key as keyof typeof healthColors] || '#6b7280',
  }));

  // Transform vendor distribution for bar chart
  const vendorChartData = vendorDist.map((v: { vendor: string; count: number; avgHealth: string }) => ({
    name: v.vendor.charAt(0).toUpperCase() + v.vendor.slice(1),
    assets: v.count,
    health: parseFloat(v.avgHealth),
    color: vendorColors[v.vendor] || '#6366f1',
  }));

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-white">Fleet Command Center</h1>
          <p className="text-slate-400 mt-1">Multi-vendor asset intelligence overview</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Activity className="w-4 h-4 text-primary-500" />
          <span>Live</span>
          <span className="w-2 h-2 bg-primary-500 rounded-full animate-pulse" />
        </div>
      </motion.div>

      {/* KPI Cards */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Total Sites"
          value={summary.totalSites}
          icon={Building2}
          color="primary"
        />
        <KPICard
          title="Total Assets"
          value={summary.totalAssets}
          icon={Boxes}
          color="emerald"
        />
        <KPICard
          title="Active Sensors"
          value={summary.totalSensors}
          icon={Radio}
          color="blue"
        />
        <KPICard
          title="Active Alerts"
          value={summary.activeAlerts}
          icon={AlertTriangle}
          color="red"
          alert={summary.activeAlerts > 0}
        />
      </motion.div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Health Score Overview */}
        <motion.div variants={itemVariants} className="lg:col-span-2 card p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-white">Fleet Health Overview</h2>
              <p className="text-sm text-slate-400">Average health: {summary.avgHealthScore}%</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-health-critical" />
                <span className="text-sm text-slate-400">Critical: {summary.criticalAssets}</span>
              </div>
            </div>
          </div>
          
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={generateMockHealthTrend()}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="healthGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="day" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" fontSize={12} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="health"
                  stroke="#22c55e"
                  strokeWidth={2}
                  fill="url(#healthGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Health Distribution */}
        <motion.div variants={itemVariants} className="card p-6">
          <h2 className="text-lg font-semibold text-white mb-6">Health Distribution</h2>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={healthChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={70}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {healthChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-4">
            {healthChartData.map((item) => (
              <div key={item.name} className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-sm text-slate-400">{item.name}</span>
                <span className="text-sm font-medium text-white ml-auto">{item.value}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Vendor Distribution & Alerts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Vendor Distribution */}
        <motion.div variants={itemVariants} className="card p-6">
          <h2 className="text-lg font-semibold text-white mb-6">Assets by Vendor</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={vendorChartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis type="number" stroke="#64748b" fontSize={12} />
                <YAxis type="category" dataKey="name" stroke="#64748b" fontSize={12} width={80} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                  }}
                />
                <Bar dataKey="assets" radius={[0, 4, 4, 0]}>
                  {vendorChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Recent Alerts */}
        <motion.div variants={itemVariants} className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Recent Alerts</h2>
            <Link to="/alerts" className="text-sm text-primary-400 hover:text-primary-300 flex items-center gap-1">
              View all <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="space-y-3">
            {recentAlerts.length === 0 ? (
              <p className="text-slate-400 text-center py-8">No active alerts</p>
            ) : (
              recentAlerts.slice(0, 5).map((alert: any) => (
                <div
                  key={alert.id}
                  className="flex items-start gap-3 p-3 rounded-lg bg-slate-800/50 hover:bg-slate-800 transition-colors"
                >
                  <div className={clsx(
                    'w-2 h-2 rounded-full mt-2 flex-shrink-0',
                    alert.severity === 'critical' && 'bg-red-500',
                    alert.severity === 'high' && 'bg-orange-500',
                    alert.severity === 'medium' && 'bg-yellow-500',
                    alert.severity === 'low' && 'bg-blue-500'
                  )} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{alert.title}</p>
                    <p className="text-xs text-slate-400">{alert.siteName} • {alert.assetName}</p>
                  </div>
                  <span className="text-xs text-slate-500">
                    {new Date(alert.triggeredAt).toLocaleTimeString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </motion.div>
      </div>

      {/* Assets Needing Attention */}
      <motion.div variants={itemVariants} className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Assets Needing Attention</h2>
            <p className="text-sm text-slate-400">Assets with low health or degrading trend</p>
          </div>
          <Link to="/assets" className="text-sm text-primary-400 hover:text-primary-300 flex items-center gap-1">
            View all assets <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-slate-400 border-b border-slate-700">
                <th className="pb-3 font-medium">Asset</th>
                <th className="pb-3 font-medium">Type</th>
                <th className="pb-3 font-medium">Vendor</th>
                <th className="pb-3 font-medium">Health</th>
                <th className="pb-3 font-medium">Trend</th>
              </tr>
            </thead>
            <tbody>
              {attentionAssets.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    All assets are healthy
                  </td>
                </tr>
              ) : (
                attentionAssets.map((asset: any) => (
                  <tr key={asset.id} className="table-row">
                    <td className="py-3">
                      <Link to={`/assets/${asset.id}`} className="hover:text-primary-400 transition-colors">
                        <p className="font-medium text-white">{asset.name}</p>
                        <p className="text-xs text-slate-500">{asset.assetTag}</p>
                      </Link>
                    </td>
                    <td className="py-3 text-sm text-slate-300">{formatAssetType(asset.assetType)}</td>
                    <td className="py-3">
                      <span 
                        className="vendor-badge"
                        style={{ 
                          backgroundColor: `${vendorColors[asset.vendor]}20`,
                          color: vendorColors[asset.vendor]
                        }}
                      >
                        {asset.vendor}
                      </span>
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 rounded-full bg-slate-800">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${asset.healthScore}%`,
                              backgroundColor: getHealthColor(asset.healthScore),
                            }}
                          />
                        </div>
                        <span className="text-sm font-mono" style={{ color: getHealthColor(asset.healthScore) }}>
                          {asset.healthScore}%
                        </span>
                      </div>
                    </td>
                    <td className="py-3">
                      <TrendIndicator trend={asset.trend} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </motion.div>
  );
}

// KPI Card Component
function KPICard({ 
  title, 
  value, 
  icon: Icon, 
  color, 
  alert 
}: { 
  title: string; 
  value: number; 
  icon: React.ElementType; 
  color: string; 
  alert?: boolean;
}) {
  const colorClasses: Record<string, string> = {
    primary: 'from-primary-500 to-primary-600',
    emerald: 'from-emerald-500 to-emerald-600',
    blue: 'from-blue-500 to-blue-600',
    red: 'from-red-500 to-red-600',
  };

  return (
    <div className={clsx('card p-5 card-hover', alert && 'border-red-500/50')}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-400">{title}</p>
          <p className="text-3xl font-bold text-white mt-1 font-mono">{value || 0}</p>
        </div>
        <div className={clsx('w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center', colorClasses[color])}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
      {alert && (
        <div className="mt-3 flex items-center gap-2 text-red-400 text-sm">
          <Bell className="w-4 h-4" />
          <span>Requires attention</span>
        </div>
      )}
    </div>
  );
}

// Trend Indicator Component
function TrendIndicator({ trend }: { trend: string }) {
  if (trend === 'degrading') {
    return (
      <span className="flex items-center gap-1 text-red-400">
        <TrendingDown className="w-4 h-4" />
        <span className="text-sm">Degrading</span>
      </span>
    );
  }
  if (trend === 'improving') {
    return (
      <span className="flex items-center gap-1 text-green-400">
        <TrendingUp className="w-4 h-4" />
        <span className="text-sm">Improving</span>
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-slate-400">
      <Minus className="w-4 h-4" />
      <span className="text-sm">Stable</span>
    </span>
  );
}

// Helper functions
function getHealthColor(score: number): string {
  if (score >= 80) return healthColors.excellent;
  if (score >= 60) return healthColors.good;
  if (score >= 40) return healthColors.fair;
  if (score >= 20) return healthColors.poor;
  return healthColors.critical;
}

function formatAssetType(type: string): string {
  return type
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function generateMockHealthTrend() {
  const data = [];
  for (let i = 30; i >= 0; i--) {
    data.push({
      day: `Day ${30 - i}`,
      health: 75 + Math.sin(i / 5) * 10 + Math.random() * 5,
    });
  }
  return data;
}
