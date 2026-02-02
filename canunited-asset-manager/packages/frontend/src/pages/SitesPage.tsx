import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Building2, MapPin, Boxes, AlertTriangle, Plus, Activity } from 'lucide-react';
import { getApi, endpoints } from '../lib/api';
import clsx from 'clsx';

export default function SitesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['sites'],
    queryFn: async () => {
      const response = await getApi().get(endpoints.sites);
      return response.data.data;
    },
  });

  const sites = data || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-white">Sites</h1>
          <p className="text-slate-400 mt-1">{sites.length} sites monitored</p>
        </div>
        <button className="btn btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Add Site
        </button>
      </div>

      {/* Sites Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sites.map((site: any, index: number) => (
          <motion.div
            key={site.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Link
              to={`/topology/${site.id}`}
              className="card p-6 block card-hover group"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-emerald-500 flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-white" />
                </div>
                <div className="flex items-center gap-2 text-sm text-primary-400">
                  <Activity className="w-4 h-4" />
                  <span className="w-2 h-2 bg-primary-500 rounded-full animate-pulse" />
                </div>
              </div>

              {/* Site Info */}
              <h3 className="text-lg font-semibold text-white mb-1 group-hover:text-primary-400 transition-colors">
                {site.name}
              </h3>
              <div className="flex items-center gap-2 text-sm text-slate-400 mb-4">
                <MapPin className="w-4 h-4" />
                <span>{site.address?.city}, {site.address?.country}</span>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Boxes className="w-4 h-4 text-slate-400" />
                    <span className="text-xs text-slate-400">Assets</span>
                  </div>
                  <p className="text-2xl font-bold text-white font-mono">{site.assetCount || 0}</p>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className="w-4 h-4 text-slate-400" />
                    <span className="text-xs text-slate-400">Critical</span>
                  </div>
                  <p className={clsx(
                    'text-2xl font-bold font-mono',
                    site.healthSummary?.criticalAssets > 0 ? 'text-red-400' : 'text-green-400'
                  )}>
                    {site.healthSummary?.criticalAssets || 0}
                  </p>
                </div>
              </div>

              {/* Health Bar */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-slate-400">Avg Health</span>
                  <span className="text-sm font-mono" style={{ color: getHealthColor(site.healthSummary?.avgHealthScore || 100) }}>
                    {Math.round(site.healthSummary?.avgHealthScore || 100)}%
                  </span>
                </div>
                <div className="h-2 rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${site.healthSummary?.avgHealthScore || 100}%`,
                      backgroundColor: getHealthColor(site.healthSummary?.avgHealthScore || 100),
                    }}
                  />
                </div>
              </div>

              {/* Code */}
              <div className="mt-4 pt-4 border-t border-slate-700">
                <span className="text-xs font-mono text-slate-500">Site Code: {site.code}</span>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* Empty State */}
      {sites.length === 0 && (
        <div className="card p-12 text-center">
          <Building2 className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No sites yet</h3>
          <p className="text-slate-400 mb-4">Get started by adding your first site</p>
          <button className="btn btn-primary">
            <Plus className="w-4 h-4 mr-2" />
            Add Site
          </button>
        </div>
      )}
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
