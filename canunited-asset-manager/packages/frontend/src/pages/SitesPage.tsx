import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Building2, MapPin, Boxes, AlertTriangle, Plus, Activity, X, Globe, Clock } from 'lucide-react';
import { getApi, endpoints } from '../lib/api';
import toast from 'react-hot-toast';
import clsx from 'clsx';

interface Site {
  id: string;
  name: string;
  code: string;
  address: {
    street: string;
    city: string;
    country: string;
    postalCode: string;
  };
  timezone: string;
  assetCount: number;
  healthSummary: {
    avgHealthScore: number;
    criticalAssets: number;
  };
}

export default function SitesPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);
  const [newSite, setNewSite] = useState({
    name: '',
    code: '',
    street: '',
    city: '',
    country: '',
    postalCode: '',
    timezone: 'Asia/Singapore',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['sites'],
    queryFn: async () => {
      const response = await getApi().get(endpoints.sites);
      return response.data.data;
    },
  });

  const [localSites, setLocalSites] = useState<Site[]>([]);
  const sites = [...(data || []), ...localSites];

  const handleAddSite = () => {
    if (!newSite.name.trim() || !newSite.code.trim()) {
      toast.error(t('sites.requiredFields') || 'Site name and code are required');
      return;
    }

    const site: Site = {
      id: `site-${Date.now()}`,
      name: newSite.name,
      code: newSite.code.toUpperCase(),
      address: {
        street: newSite.street,
        city: newSite.city,
        country: newSite.country,
        postalCode: newSite.postalCode,
      },
      timezone: newSite.timezone,
      assetCount: 0,
      healthSummary: {
        avgHealthScore: 100,
        criticalAssets: 0,
      },
    };

    setLocalSites([...localSites, site]);
    setShowAddModal(false);
    setNewSite({
      name: '',
      code: '',
      street: '',
      city: '',
      country: '',
      postalCode: '',
      timezone: 'Asia/Singapore',
    });
    toast.success(t('sites.siteAdded') || 'Site added successfully');
  };

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
          <h1 className="text-3xl font-display font-bold text-white">{t('sites.title')}</h1>
          <p className="text-slate-400 mt-1">{sites.length} {t('sites.monitored') || 'sites monitored'}</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="btn btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          {t('sites.addSite')}
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
          <h3 className="text-lg font-medium text-white mb-2">{t('sites.noSites')}</h3>
          <p className="text-slate-400 mb-4">{t('sites.getStarted') || 'Get started by adding your first site'}</p>
          <button onClick={() => setShowAddModal(true)} className="btn btn-primary">
            <Plus className="w-4 h-4 mr-2" />
            {t('sites.addSite')}
          </button>
        </div>
      )}

      {/* Add Site Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white">{t('sites.addSite')}</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm text-slate-400 mb-2">{t('sites.siteName')} *</label>
                  <input
                    type="text"
                    value={newSite.name}
                    onChange={(e) => setNewSite({ ...newSite, name: e.target.value })}
                    className="input w-full"
                    placeholder="Singapore Main Plant"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-2">{t('sites.siteCode') || 'Site Code'} *</label>
                  <input
                    type="text"
                    value={newSite.code}
                    onChange={(e) => setNewSite({ ...newSite, code: e.target.value.toUpperCase() })}
                    className="input w-full font-mono"
                    placeholder="SGP-001"
                    maxLength={10}
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-2">
                    <Clock className="w-4 h-4 inline mr-1" />
                    {t('sites.timezone')}
                  </label>
                  <select
                    value={newSite.timezone}
                    onChange={(e) => setNewSite({ ...newSite, timezone: e.target.value })}
                    className="input w-full"
                  >
                    <option value="Asia/Singapore">Asia/Singapore (UTC+8)</option>
                    <option value="Asia/Kuala_Lumpur">Asia/Kuala_Lumpur (UTC+8)</option>
                    <option value="Asia/Bangkok">Asia/Bangkok (UTC+7)</option>
                    <option value="Asia/Tokyo">Asia/Tokyo (UTC+9)</option>
                    <option value="Asia/Shanghai">Asia/Shanghai (UTC+8)</option>
                    <option value="Europe/London">Europe/London (UTC+0)</option>
                    <option value="Europe/Berlin">Europe/Berlin (UTC+1)</option>
                    <option value="America/New_York">America/New_York (UTC-5)</option>
                    <option value="America/Los_Angeles">America/Los_Angeles (UTC-8)</option>
                    <option value="UTC">UTC</option>
                  </select>
                </div>
              </div>

              {/* Address */}
              <div className="pt-4 border-t border-slate-700">
                <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  {t('sites.address')}
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm text-slate-400 mb-2">{t('sites.street') || 'Street Address'}</label>
                    <input
                      type="text"
                      value={newSite.street}
                      onChange={(e) => setNewSite({ ...newSite, street: e.target.value })}
                      className="input w-full"
                      placeholder="123 Industrial Ave"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">{t('sites.city')}</label>
                    <input
                      type="text"
                      value={newSite.city}
                      onChange={(e) => setNewSite({ ...newSite, city: e.target.value })}
                      className="input w-full"
                      placeholder="Singapore"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">{t('sites.country')}</label>
                    <input
                      type="text"
                      value={newSite.country}
                      onChange={(e) => setNewSite({ ...newSite, country: e.target.value })}
                      className="input w-full"
                      placeholder="Singapore"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">{t('sites.postalCode') || 'Postal Code'}</label>
                    <input
                      type="text"
                      value={newSite.postalCode}
                      onChange={(e) => setNewSite({ ...newSite, postalCode: e.target.value })}
                      className="input w-full"
                      placeholder="123456"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-700">
              <button
                onClick={() => setShowAddModal(false)}
                className="btn btn-outline"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleAddSite}
                className="btn btn-primary flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                {t('sites.addSite')}
              </button>
            </div>
          </motion.div>
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
