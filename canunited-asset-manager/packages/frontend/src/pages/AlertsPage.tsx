import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  AlertTriangle,
  AlertCircle,
  Info,
  Check,
  X,
  Filter,
  Clock,
  MapPin,
  ChevronDown,
  Wrench,
  ExternalLink,
  Eye,
} from 'lucide-react';
import { getApi, endpoints } from '../lib/api';
import toast from 'react-hot-toast';
import clsx from 'clsx';

const severityConfig = {
  critical: { icon: AlertTriangle, color: '#dc2626', bg: 'bg-red-500/10', text: 'text-red-400' },
  high: { icon: AlertCircle, color: '#ea580c', bg: 'bg-orange-500/10', text: 'text-orange-400' },
  medium: { icon: AlertCircle, color: '#ca8a04', bg: 'bg-yellow-500/10', text: 'text-yellow-400' },
  low: { icon: Info, color: '#2563eb', bg: 'bg-blue-500/10', text: 'text-blue-400' },
  info: { icon: Info, color: '#6b7280', bg: 'bg-slate-500/10', text: 'text-slate-400' },
};

export default function AlertsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [selectedSeverity, setSelectedSeverity] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('active');
  const [expandedAlert, setExpandedAlert] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Fetch alerts
  const { data, isLoading } = useQuery({
    queryKey: ['alerts', selectedSeverity, selectedStatus],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedSeverity) params.append('severity', selectedSeverity);
      if (selectedStatus) params.append('status', selectedStatus);
      const response = await getApi().get(`${endpoints.alerts}?${params}`);
      return response.data;
    },
  });

  // Fetch alert summary
  const { data: summary } = useQuery({
    queryKey: ['alertsSummary'],
    queryFn: async () => {
      const response = await getApi().get(endpoints.alertsSummary);
      return response.data.data;
    },
  });

  // Acknowledge mutation
  const acknowledgeMutation = useMutation({
    mutationFn: async (alertId: string) => {
      await getApi().post(endpoints.alertAcknowledge(alertId));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      queryClient.invalidateQueries({ queryKey: ['alertsSummary'] });
      toast.success('Alert acknowledged');
    },
  });

  // Resolve mutation
  const resolveMutation = useMutation({
    mutationFn: async ({ alertId, notes }: { alertId: string; notes?: string }) => {
      await getApi().post(endpoints.alertResolve(alertId), { resolutionNotes: notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      queryClient.invalidateQueries({ queryKey: ['alertsSummary'] });
      toast.success('Alert resolved');
    },
  });

  const alerts = data?.data || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-white flex items-center gap-3">
            <Bell className="w-8 h-8 text-primary-500" />
            Alerts
          </h1>
          <p className="text-slate-400 mt-1">
            {summary?.total || 0} active alerts requiring attention
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {Object.entries(severityConfig).map(([severity, config]) => {
          const Icon = config.icon;
          const count = summary?.[severity] || 0;
          return (
            <button
              key={severity}
              onClick={() => setSelectedSeverity(selectedSeverity === severity ? '' : severity)}
              className={clsx(
                'card p-4 transition-all',
                selectedSeverity === severity && 'ring-2 ring-primary-500'
              )}
            >
              <div className="flex items-center gap-3">
                <div className={clsx('w-10 h-10 rounded-lg flex items-center justify-center', config.bg)}>
                  <Icon className="w-5 h-5" style={{ color: config.color }} />
                </div>
                <div className="text-left">
                  <p className="text-2xl font-bold text-white font-mono">{count}</p>
                  <p className="text-xs text-slate-400 capitalize">{severity}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex items-center gap-4">
          <Filter className="w-5 h-5 text-slate-400" />
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="input"
          >
            <option value="active">Active</option>
            <option value="acknowledged">Acknowledged</option>
            <option value="resolved">Resolved</option>
            <option value="">All Status</option>
          </select>
          <select
            value={selectedSeverity}
            onChange={(e) => setSelectedSeverity(e.target.value)}
            className="input"
          >
            <option value="">All Severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
            <option value="info">Info</option>
          </select>
        </div>
      </div>

      {/* Alerts List */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : alerts.length === 0 ? (
        <div className="card p-12 text-center">
          <Check className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">All Clear!</h3>
          <p className="text-slate-400">No alerts matching your criteria</p>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {alerts.map((alert: any) => {
              const config = severityConfig[alert.severity as keyof typeof severityConfig] || severityConfig.info;
              const Icon = config.icon;
              const isExpanded = expandedAlert === alert.id;

              return (
                <motion.div
                  key={alert.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="card overflow-hidden"
                >
                  <div
                    className="p-4 cursor-pointer hover:bg-slate-800/30 transition-colors"
                    onClick={() => setExpandedAlert(isExpanded ? null : alert.id)}
                  >
                    <div className="flex items-start gap-4">
                      {/* Severity Icon */}
                      <div className={clsx('w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0', config.bg)}>
                        <Icon className="w-5 h-5" style={{ color: config.color }} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h3 className="font-medium text-white">{alert.title}</h3>
                            <p className="text-sm text-slate-400 mt-1 line-clamp-2">
                              {alert.description}
                            </p>
                          </div>
                          <ChevronDown
                            className={clsx(
                              'w-5 h-5 text-slate-400 transition-transform flex-shrink-0',
                              isExpanded && 'rotate-180'
                            )}
                          />
                        </div>

                        {/* Meta */}
                        <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
                          <div className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {alert.siteName}
                          </div>
                          {alert.assetName && (
                            <span className="text-slate-400">{alert.assetName}</span>
                          )}
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(alert.triggeredAt).toLocaleString()}
                          </div>
                          <span className={clsx(
                            'px-2 py-0.5 rounded text-xs capitalize',
                            alert.status === 'active' && 'bg-red-500/20 text-red-400',
                            alert.status === 'acknowledged' && 'bg-yellow-500/20 text-yellow-400',
                            alert.status === 'resolved' && 'bg-green-500/20 text-green-400'
                          )}>
                            {alert.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Content */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t border-slate-700"
                      >
                        <div className="p-4 bg-slate-800/30">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div>
                              <p className="text-xs text-slate-500 mb-1">Category</p>
                              <p className="text-sm text-slate-300">{alert.category || 'N/A'}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500 mb-1">Source</p>
                              <p className="text-sm text-slate-300">{alert.source || 'N/A'}</p>
                            </div>
                            {alert.acknowledgedAt && (
                              <div>
                                <p className="text-xs text-slate-500 mb-1">Acknowledged</p>
                                <p className="text-sm text-slate-300">
                                  {new Date(alert.acknowledgedAt).toLocaleString()}
                                </p>
                              </div>
                            )}
                            {alert.resolvedAt && (
                              <div>
                                <p className="text-xs text-slate-500 mb-1">Resolved</p>
                                <p className="text-sm text-slate-300">
                                  {new Date(alert.resolvedAt).toLocaleString()}
                                </p>
                              </div>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="flex flex-wrap items-center gap-3">
                            {/* View Asset Details */}
                            {alert.assetId && (
                              <Link
                                to={`/assets/${alert.assetId || 'a1'}`}
                                className="btn btn-outline flex items-center gap-2"
                              >
                                <Eye className="w-4 h-4" />
                                {t('common.view')} {t('assets.assetDetails')}
                              </Link>
                            )}

                            {/* Create Maintenance Task */}
                            <button
                              onClick={() => {
                                // Navigate to maintenance with pre-filled data
                                navigate('/maintenance', {
                                  state: {
                                    createTask: true,
                                    fromAlert: {
                                      id: alert.id,
                                      title: alert.title,
                                      assetName: alert.assetName,
                                      assetId: alert.assetId,
                                      severity: alert.severity,
                                      description: alert.description,
                                    },
                                  },
                                });
                                toast.success(t('maintenance.scheduleMaintenance'));
                              }}
                              className="btn btn-secondary flex items-center gap-2"
                            >
                              <Wrench className="w-4 h-4" />
                              {t('maintenance.scheduleMaintenance')}
                            </button>

                            {alert.status !== 'resolved' && (
                              <>
                                {alert.status === 'active' && (
                                  <button
                                    onClick={() => acknowledgeMutation.mutate(alert.id)}
                                    disabled={acknowledgeMutation.isPending}
                                    className="btn btn-outline flex items-center gap-2"
                                  >
                                    <Check className="w-4 h-4" />
                                    {t('alerts.acknowledge')}
                                  </button>
                                )}
                                <button
                                  onClick={() => resolveMutation.mutate({ alertId: alert.id })}
                                  disabled={resolveMutation.isPending}
                                  className="btn btn-primary flex items-center gap-2"
                                >
                                  <Check className="w-4 h-4" />
                                  {t('alerts.resolve')}
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
