import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Search,
  Filter,
  Plus,
  ChevronLeft,
  ChevronRight,
  QrCode,
  TrendingDown,
  TrendingUp,
  Minus,
  Grid,
  List,
  Download,
} from 'lucide-react';
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

const assetTypeOptions = [
  { value: '', label: 'All Types' },
  { value: 'mv_switchgear', label: 'MV Switchgear' },
  { value: 'lv_panel', label: 'LV Panel' },
  { value: 'transformer', label: 'Transformer' },
  { value: 'circuit_breaker', label: 'Circuit Breaker' },
  { value: 'busway', label: 'Busway' },
  { value: 'vfd', label: 'VFD' },
  { value: 'meter', label: 'Meter' },
  { value: 'sensor', label: 'Sensor' },
];

const vendorOptions = [
  { value: '', label: 'All Vendors' },
  { value: 'schneider', label: 'Schneider Electric' },
  { value: 'abb', label: 'ABB' },
  { value: 'siemens', label: 'Siemens' },
  { value: 'bosch', label: 'Bosch' },
  { value: 'eaton', label: 'Eaton' },
  { value: 'generic', label: 'Generic' },
];

const healthOptions = [
  { value: '', label: 'All Status' },
  { value: 'excellent', label: 'Excellent' },
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
  { value: 'poor', label: 'Poor' },
  { value: 'critical', label: 'Critical' },
];

export default function AssetsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [showFilters, setShowFilters] = useState(false);

  const page = parseInt(searchParams.get('page') || '1');
  const search = searchParams.get('search') || '';
  const assetType = searchParams.get('assetType') || '';
  const vendor = searchParams.get('vendor') || '';
  const healthStatus = searchParams.get('healthStatus') || '';

  const { data, isLoading } = useQuery({
    queryKey: ['assets', page, search, assetType, vendor, healthStatus],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('page', String(page));
      params.append('perPage', '12');
      if (search) params.append('search', search);
      if (assetType) params.append('assetType', assetType);
      if (vendor) params.append('vendor', vendor);
      if (healthStatus) params.append('healthStatus', healthStatus);
      
      const response = await getApi().get(`${endpoints.assets}?${params}`);
      return response.data;
    },
  });

  const assets = data?.data || [];
  const meta = data?.meta || { page: 1, totalPages: 1, total: 0 };

  const updateFilter = (key: string, value: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (value) {
      newParams.set(key, value);
    } else {
      newParams.delete(key);
    }
    newParams.set('page', '1');
    setSearchParams(newParams);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-white">Assets</h1>
          <p className="text-slate-400 mt-1">
            {meta.total} assets across all sites
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="btn btn-outline flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export
          </button>
          <Link to="/assets/new" className="btn btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Add Asset
          </Link>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="card p-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
            <input
              type="text"
              placeholder="Search assets by name or tag..."
              value={search}
              onChange={(e) => updateFilter('search', e.target.value)}
              className="input w-full pl-10"
            />
          </div>

          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={clsx(
              'btn flex items-center gap-2',
              showFilters ? 'btn-primary' : 'btn-outline'
            )}
          >
            <Filter className="w-4 h-4" />
            Filters
          </button>

          {/* View Toggle */}
          <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1">
            <button
              onClick={() => setViewMode('list')}
              className={clsx(
                'p-2 rounded',
                viewMode === 'list' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
              )}
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={clsx(
                'p-2 rounded',
                viewMode === 'grid' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
              )}
            >
              <Grid className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter Options */}
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mt-4 pt-4 border-t border-slate-700 grid grid-cols-1 md:grid-cols-3 gap-4"
          >
            <div>
              <label className="block text-sm text-slate-400 mb-2">Asset Type</label>
              <select
                value={assetType}
                onChange={(e) => updateFilter('assetType', e.target.value)}
                className="input w-full"
              >
                {assetTypeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-2">Vendor</label>
              <select
                value={vendor}
                onChange={(e) => updateFilter('vendor', e.target.value)}
                className="input w-full"
              >
                {vendorOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-2">Health Status</label>
              <select
                value={healthStatus}
                onChange={(e) => updateFilter('healthStatus', e.target.value)}
                className="input w-full"
              >
                {healthOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </motion.div>
        )}
      </div>

      {/* Loading State */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : assets.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-slate-400">No assets found matching your criteria.</p>
        </div>
      ) : viewMode === 'list' ? (
        /* List View */
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-800/50">
              <tr className="text-left text-sm text-slate-400">
                <th className="px-6 py-4 font-medium">Asset</th>
                <th className="px-6 py-4 font-medium">Type</th>
                <th className="px-6 py-4 font-medium">Vendor</th>
                <th className="px-6 py-4 font-medium">Site</th>
                <th className="px-6 py-4 font-medium">Health</th>
                <th className="px-6 py-4 font-medium">Trend</th>
                <th className="px-6 py-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((asset: any) => (
                <tr key={asset.id} className="table-row">
                  <td className="px-6 py-4">
                    <Link to={`/assets/${asset.id}`} className="hover:text-primary-400 transition-colors">
                      <p className="font-medium text-white">{asset.name}</p>
                      <p className="text-xs text-slate-500 font-mono">{asset.assetTag}</p>
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-300">
                    {formatAssetType(asset.assetType)}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className="vendor-badge"
                      style={{
                        backgroundColor: `${vendorColors[asset.vendor]}20`,
                        color: vendorColors[asset.vendor],
                      }}
                    >
                      {asset.vendor}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-300">
                    {asset.siteName || '-'}
                  </td>
                  <td className="px-6 py-4">
                    <HealthIndicator score={asset.health?.overallScore || 0} />
                  </td>
                  <td className="px-6 py-4">
                    <TrendIndicator trend={asset.health?.trend || 'stable'} />
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Link
                        to={`/assets/${asset.id}`}
                        className="btn btn-ghost p-2"
                        title="View QR Code"
                      >
                        <QrCode className="w-4 h-4" />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* Grid View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {assets.map((asset: any) => (
            <Link
              key={asset.id}
              to={`/assets/${asset.id}`}
              className="card p-4 card-hover"
            >
              <div className="flex items-start justify-between mb-3">
                <span
                  className="vendor-badge"
                  style={{
                    backgroundColor: `${vendorColors[asset.vendor]}20`,
                    color: vendorColors[asset.vendor],
                  }}
                >
                  {asset.vendor}
                </span>
                <TrendIndicator trend={asset.health?.trend || 'stable'} />
              </div>
              
              <h3 className="font-medium text-white truncate">{asset.name}</h3>
              <p className="text-xs text-slate-500 font-mono mb-3">{asset.assetTag}</p>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Type</span>
                  <span className="text-slate-300">{formatAssetType(asset.assetType)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Health</span>
                  <span
                    className="font-mono font-medium"
                    style={{ color: getHealthColor(asset.health?.overallScore || 0) }}
                  >
                    {asset.health?.overallScore || 0}%
                  </span>
                </div>
              </div>
              
              <div className="mt-3 pt-3 border-t border-slate-700">
                <div className="h-2 rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${asset.health?.overallScore || 0}%`,
                      backgroundColor: getHealthColor(asset.health?.overallScore || 0),
                    }}
                  />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Pagination */}
      {meta.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-400">
            Showing {(page - 1) * 12 + 1} to {Math.min(page * 12, meta.total)} of {meta.total} assets
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => updateFilter('page', String(page - 1))}
              disabled={page === 1}
              className="btn btn-ghost p-2 disabled:opacity-50"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-sm text-slate-300">
              Page {page} of {meta.totalPages}
            </span>
            <button
              onClick={() => updateFilter('page', String(page + 1))}
              disabled={page === meta.totalPages}
              className="btn btn-ghost p-2 disabled:opacity-50"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Component helpers
function HealthIndicator({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-2 rounded-full bg-slate-800">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${score}%`,
            backgroundColor: getHealthColor(score),
          }}
        />
      </div>
      <span className="text-sm font-mono" style={{ color: getHealthColor(score) }}>
        {score}%
      </span>
    </div>
  );
}

function TrendIndicator({ trend }: { trend: string }) {
  if (trend === 'degrading') {
    return <TrendingDown className="w-4 h-4 text-red-400" />;
  }
  if (trend === 'improving') {
    return <TrendingUp className="w-4 h-4 text-green-400" />;
  }
  return <Minus className="w-4 h-4 text-slate-400" />;
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
