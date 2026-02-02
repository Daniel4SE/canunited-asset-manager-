import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  BarChart3,
  TrendingUp,
  GitCompare,
  Activity,
  Target,
  AlertTriangle,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Cell,
} from 'recharts';
import { getApi, endpoints } from '../lib/api';
import clsx from 'clsx';

const vendorColors: Record<string, string> = {
  schneider: '#3dcd58',
  abb: '#ff000f',
  siemens: '#009999',
  bosch: '#ea0016',
  eaton: '#0033a0',
  generic: '#6366f1',
};

const tabs = [
  { id: 'vendor', label: 'Vendor Comparison', icon: GitCompare },
  { id: 'trends', label: 'Health Trends', icon: TrendingUp },
  { id: 'risk', label: 'Failure Risk', icon: AlertTriangle },
  { id: 'lifecycle', label: 'Lifecycle Analysis', icon: Activity },
];

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState('vendor');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-display font-bold text-white flex items-center gap-3">
          <BarChart3 className="w-8 h-8 text-primary-500" />
          Analytics
        </h1>
        <p className="text-slate-400 mt-1">Cross-vendor intelligence and insights</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                'flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition-all',
                activeTab === tab.id
                  ? 'bg-primary-500/20 text-primary-400 border border-primary-500/50'
                  : 'bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-800'
              )}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        {activeTab === 'vendor' && <VendorComparisonTab />}
        {activeTab === 'trends' && <HealthTrendsTab />}
        {activeTab === 'risk' && <FailureRiskTab />}
        {activeTab === 'lifecycle' && <LifecycleAnalysisTab />}
      </motion.div>
    </div>
  );
}

// Vendor Comparison Tab
function VendorComparisonTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['vendorComparison'],
    queryFn: async () => {
      const response = await getApi().get(endpoints.vendorComparison);
      return response.data.data;
    },
  });

  if (isLoading) {
    return <LoadingState />;
  }

  const vendors = data?.vendors || [];

  // Prepare data for radar chart
  const radarData = vendors.map((v: any) => ({
    vendor: v.vendor.charAt(0).toUpperCase() + v.vendor.slice(1),
    Electrical: v.avgElectrical,
    Thermal: v.avgThermal,
    Insulation: v.avgInsulation,
    Mechanical: v.avgMechanical,
    color: vendorColors[v.vendor],
  }));

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {vendors.map((v: any) => (
          <div key={v.vendor} className="card p-4">
            <div className="flex items-center gap-2 mb-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: vendorColors[v.vendor] }}
              />
              <span className="text-sm font-medium text-white capitalize">{v.vendor}</span>
            </div>
            <p className="text-2xl font-bold font-mono text-white">{v.sampleSize}</p>
            <p className="text-xs text-slate-400">assets</p>
            <div className="mt-2 pt-2 border-t border-slate-700">
              <p className="text-sm">
                Avg Health:{' '}
                <span className="font-mono" style={{ color: getHealthColor(v.avgHealth) }}>
                  {v.avgHealth.toFixed(1)}%
                </span>
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Health Comparison Bar Chart */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Average Health by Vendor</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={vendors} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis type="number" domain={[0, 100]} stroke="#64748b" fontSize={12} />
                <YAxis
                  type="category"
                  dataKey="vendor"
                  stroke="#64748b"
                  fontSize={12}
                  width={80}
                  tickFormatter={(value) => value.charAt(0).toUpperCase() + value.slice(1)}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                  }}
                />
                <Bar dataKey="avgHealth" radius={[0, 4, 4, 0]}>
                  {vendors.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={vendorColors[entry.vendor]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Health Breakdown Radar */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Health Breakdown Comparison</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={[
                { metric: 'Electrical', ...Object.fromEntries(radarData.map((v: any) => [v.vendor, v.Electrical])) },
                { metric: 'Thermal', ...Object.fromEntries(radarData.map((v: any) => [v.vendor, v.Thermal])) },
                { metric: 'Insulation', ...Object.fromEntries(radarData.map((v: any) => [v.vendor, v.Insulation])) },
                { metric: 'Mechanical', ...Object.fromEntries(radarData.map((v: any) => [v.vendor, v.Mechanical])) },
              ]}>
                <PolarGrid stroke="#334155" />
                <PolarAngleAxis dataKey="metric" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <PolarRadiusAxis domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 10 }} />
                {radarData.map((v: any) => (
                  <Radar
                    key={v.vendor}
                    name={v.vendor}
                    dataKey={v.vendor}
                    stroke={v.color}
                    fill={v.color}
                    fillOpacity={0.2}
                  />
                ))}
                <Legend />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Detailed Stats Table */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-slate-700">
          <h3 className="font-semibold text-white">Detailed Vendor Statistics</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-800/50">
              <tr className="text-left text-sm text-slate-400">
                <th className="px-6 py-3 font-medium">Vendor</th>
                <th className="px-6 py-3 font-medium">Assets</th>
                <th className="px-6 py-3 font-medium">Avg Health</th>
                <th className="px-6 py-3 font-medium">Electrical</th>
                <th className="px-6 py-3 font-medium">Thermal</th>
                <th className="px-6 py-3 font-medium">Insulation</th>
                <th className="px-6 py-3 font-medium">Mechanical</th>
                <th className="px-6 py-3 font-medium">Min/Max</th>
              </tr>
            </thead>
            <tbody>
              {vendors.map((v: any) => (
                <tr key={v.vendor} className="table-row">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: vendorColors[v.vendor] }}
                      />
                      <span className="capitalize font-medium text-white">{v.vendor}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-mono text-slate-300">{v.sampleSize}</td>
                  <td className="px-6 py-4">
                    <span className="font-mono" style={{ color: getHealthColor(v.avgHealth) }}>
                      {v.avgHealth.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-6 py-4 font-mono text-slate-300">{v.avgElectrical.toFixed(1)}%</td>
                  <td className="px-6 py-4 font-mono text-slate-300">{v.avgThermal.toFixed(1)}%</td>
                  <td className="px-6 py-4 font-mono text-slate-300">{v.avgInsulation.toFixed(1)}%</td>
                  <td className="px-6 py-4 font-mono text-slate-300">{v.avgMechanical.toFixed(1)}%</td>
                  <td className="px-6 py-4 font-mono text-slate-500">
                    {v.minHealth.toFixed(0)} - {v.maxHealth.toFixed(0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Health Trends Tab
function HealthTrendsTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['healthTrends'],
    queryFn: async () => {
      const response = await getApi().get(`${endpoints.healthTrends}?days=30`);
      return response.data.data;
    },
  });

  if (isLoading) {
    return <LoadingState />;
  }

  const dataPoints = data?.dataPoints || [];

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Fleet Health Over Time</h3>
        <div className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={dataPoints}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis
                dataKey="timestamp"
                stroke="#64748b"
                fontSize={12}
                tickFormatter={(value) => new Date(value).toLocaleDateString()}
              />
              <YAxis stroke="#64748b" fontSize={12} domain={[0, 100]} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                }}
              />
              <Legend />
              <Line type="monotone" dataKey="avgHealth" name="Overall" stroke="#22c55e" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="avgElectrical" name="Electrical" stroke="#3b82f6" strokeWidth={1} dot={false} />
              <Line type="monotone" dataKey="avgThermal" name="Thermal" stroke="#ef4444" strokeWidth={1} dot={false} />
              <Line type="monotone" dataKey="avgInsulation" name="Insulation" stroke="#a855f7" strokeWidth={1} dot={false} />
              <Line type="monotone" dataKey="avgMechanical" name="Mechanical" stroke="#f59e0b" strokeWidth={1} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// Failure Risk Tab
function FailureRiskTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['failureRisk'],
    queryFn: async () => {
      const response = await getApi().get(endpoints.failureRisk);
      return response.data.data;
    },
  });

  if (isLoading) {
    return <LoadingState />;
  }

  const assets = data || [];

  const riskCounts = {
    critical: assets.filter((a: any) => a.riskLevel === 'critical').length,
    high: assets.filter((a: any) => a.riskLevel === 'high').length,
    medium: assets.filter((a: any) => a.riskLevel === 'medium').length,
    low: assets.filter((a: any) => a.riskLevel === 'low').length,
  };

  return (
    <div className="space-y-6">
      {/* Risk Summary */}
      <div className="grid grid-cols-4 gap-4">
        <div className="card p-4 border-l-4 border-red-500">
          <p className="text-sm text-slate-400">Critical Risk</p>
          <p className="text-3xl font-bold text-red-400 font-mono">{riskCounts.critical}</p>
        </div>
        <div className="card p-4 border-l-4 border-orange-500">
          <p className="text-sm text-slate-400">High Risk</p>
          <p className="text-3xl font-bold text-orange-400 font-mono">{riskCounts.high}</p>
        </div>
        <div className="card p-4 border-l-4 border-yellow-500">
          <p className="text-sm text-slate-400">Medium Risk</p>
          <p className="text-3xl font-bold text-yellow-400 font-mono">{riskCounts.medium}</p>
        </div>
        <div className="card p-4 border-l-4 border-green-500">
          <p className="text-sm text-slate-400">Low Risk</p>
          <p className="text-3xl font-bold text-green-400 font-mono">{riskCounts.low}</p>
        </div>
      </div>

      {/* Risk Assets Table */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-slate-700">
          <h3 className="font-semibold text-white">Assets at Risk</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-800/50">
              <tr className="text-left text-sm text-slate-400">
                <th className="px-6 py-3 font-medium">Asset</th>
                <th className="px-6 py-3 font-medium">Type</th>
                <th className="px-6 py-3 font-medium">Vendor</th>
                <th className="px-6 py-3 font-medium">Health</th>
                <th className="px-6 py-3 font-medium">Risk Level</th>
                <th className="px-6 py-3 font-medium">RUL</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((asset: any) => (
                <tr key={asset.id} className="table-row">
                  <td className="px-6 py-4">
                    <p className="font-medium text-white">{asset.name}</p>
                    <p className="text-xs text-slate-500 font-mono">{asset.assetTag}</p>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-300">
                    {formatAssetType(asset.assetType)}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className="px-2 py-0.5 rounded text-xs font-medium capitalize"
                      style={{
                        backgroundColor: `${vendorColors[asset.vendor]}20`,
                        color: vendorColors[asset.vendor],
                      }}
                    >
                      {asset.vendor}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-mono" style={{ color: getHealthColor(asset.healthScore) }}>
                      {asset.healthScore}%
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={clsx(
                      'px-2 py-1 rounded text-xs font-medium capitalize',
                      asset.riskLevel === 'critical' && 'bg-red-500/20 text-red-400',
                      asset.riskLevel === 'high' && 'bg-orange-500/20 text-orange-400',
                      asset.riskLevel === 'medium' && 'bg-yellow-500/20 text-yellow-400',
                      asset.riskLevel === 'low' && 'bg-green-500/20 text-green-400'
                    )}>
                      {asset.riskLevel}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-mono text-slate-400">
                    {asset.remainingUsefulLife ? `${asset.remainingUsefulLife}d` : 'N/A'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Lifecycle Analysis Tab
function LifecycleAnalysisTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['lifecycleAnalysis'],
    queryFn: async () => {
      const response = await getApi().get(endpoints.lifecycleAnalysis);
      return response.data.data;
    },
  });

  if (isLoading) {
    return <LoadingState />;
  }

  const analysis = data || [];

  return (
    <div className="space-y-6">
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-slate-700">
          <h3 className="font-semibold text-white">Asset Lifecycle by Vendor & Type</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-800/50">
              <tr className="text-left text-sm text-slate-400">
                <th className="px-6 py-3 font-medium">Asset Type</th>
                <th className="px-6 py-3 font-medium">Vendor</th>
                <th className="px-6 py-3 font-medium">Count</th>
                <th className="px-6 py-3 font-medium">Avg Age (Years)</th>
                <th className="px-6 py-3 font-medium">Avg Health</th>
                <th className="px-6 py-3 font-medium">Avg RUL (Days)</th>
                <th className="px-6 py-3 font-medium">Out of Warranty</th>
                <th className="px-6 py-3 font-medium">Warranty Expiring</th>
              </tr>
            </thead>
            <tbody>
              {analysis.map((item: any, index: number) => (
                <tr key={index} className="table-row">
                  <td className="px-6 py-4 text-sm text-slate-300">
                    {formatAssetType(item.assetType)}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className="px-2 py-0.5 rounded text-xs font-medium capitalize"
                      style={{
                        backgroundColor: `${vendorColors[item.vendor]}20`,
                        color: vendorColors[item.vendor],
                      }}
                    >
                      {item.vendor}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-mono text-white">{item.count}</td>
                  <td className="px-6 py-4 font-mono text-slate-300">{item.avgAgeYears || 'N/A'}</td>
                  <td className="px-6 py-4">
                    <span className="font-mono" style={{ color: getHealthColor(parseFloat(item.avgHealth) || 0) }}>
                      {item.avgHealth || 'N/A'}%
                    </span>
                  </td>
                  <td className="px-6 py-4 font-mono text-slate-300">{item.avgRulDays || 'N/A'}</td>
                  <td className="px-6 py-4 font-mono text-red-400">{item.outOfWarranty}</td>
                  <td className="px-6 py-4 font-mono text-yellow-400">{item.warrantyExpiringSoon}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Helper Components
function LoadingState() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function getHealthColor(score: number): string {
  if (score >= 80) return '#10b981';
  if (score >= 60) return '#22c55e';
  if (score >= 40) return '#f59e0b';
  if (score >= 20) return '#f97316';
  return '#ef4444';
}

function formatAssetType(type: string): string {
  return type
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
