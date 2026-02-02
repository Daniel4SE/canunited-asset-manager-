import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  MapPin,
  Calendar,
  Shield,
  Activity,
  Zap,
  Thermometer,
  Settings,
  Gauge,
  Bell,
  Wrench,
  Download,
  ExternalLink,
  Clock,
  FileText,
  FileSpreadsheet,
  X,
  Loader2,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import toast from 'react-hot-toast';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from 'recharts';
import { getApi, endpoints } from '../lib/api';
import RULChart from '../components/predictions/RULChart';
import FailureRiskCard from '../components/predictions/FailureRiskCard';
import clsx from 'clsx';

const vendorColors: Record<string, string> = {
  schneider: '#3dcd58',
  abb: '#ff000f',
  siemens: '#009999',
  bosch: '#ea0016',
  eaton: '#0033a0',
  generic: '#6366f1',
};

export default function AssetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFormat, setExportFormat] = useState<'pdf' | 'excel'>('pdf');
  const [isExporting, setIsExporting] = useState(false);

  const { data: asset, isLoading } = useQuery({
    queryKey: ['asset', id],
    queryFn: async () => {
      const response = await getApi().get(endpoints.asset(id!));
      return response.data.data;
    },
    enabled: !!id,
  });

  const { data: healthHistory } = useQuery({
    queryKey: ['assetHealth', id],
    queryFn: async () => {
      const response = await getApi().get(endpoints.assetHealth(id!));
      return response.data.data;
    },
    enabled: !!id,
  });

  const { data: rulPrediction } = useQuery({
    queryKey: ['assetRul', id],
    queryFn: async () => {
      const response = await getApi().get(endpoints.assetRul(id!));
      return response.data.data;
    },
    enabled: !!id,
  });

  // Handle Schedule Maintenance
  const handleScheduleMaintenance = () => {
    if (!asset) return;

    navigate('/maintenance', {
      state: {
        createTask: true,
        fromAsset: {
          id: asset.id,
          name: asset.name,
          assetTag: asset.assetTag,
          vendor: asset.vendor,
          healthScore: asset.health?.overallScore,
          location: formatLocation(asset.location),
          recommendedDate: rulPrediction?.maintenanceRecommendation?.recommendedDate,
        },
      },
    });
    toast.success(t('maintenance.scheduleMaintenance'));
  };

  // Handle Export Report
  const handleExportReport = async () => {
    if (!asset) return;

    setIsExporting(true);

    try {
      // Simulate API call to generate report
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Create downloadable content
      if (exportFormat === 'pdf') {
        // Generate PDF report content
        const reportContent = generatePDFReport(asset, rulPrediction);
        downloadFile(reportContent, `asset_report_${asset.assetTag}_${new Date().toISOString().split('T')[0]}.html`, 'text/html');
      } else {
        // Generate Excel/CSV report content
        const csvContent = generateCSVReport(asset, rulPrediction);
        downloadFile(csvContent, `asset_report_${asset.assetTag}_${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
      }

      toast.success(`${exportFormat.toUpperCase()} report downloaded successfully`);
      setShowExportModal(false);
    } catch (error) {
      toast.error('Failed to generate report');
    } finally {
      setIsExporting(false);
    }
  };

  // Helper function to download file
  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Generate PDF report (HTML format for simplicity)
  const generatePDFReport = (assetData: any, rulData: any) => {
    const health = assetData.health || {};
    return `
<!DOCTYPE html>
<html>
<head>
  <title>Asset Report - ${assetData.name}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 40px; background: #f5f5f5; }
    .header { background: #1e293b; color: white; padding: 30px; border-radius: 8px; margin-bottom: 20px; }
    .header h1 { margin: 0; font-size: 24px; }
    .header p { margin: 5px 0 0; opacity: 0.8; }
    .card { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .card h2 { margin-top: 0; color: #1e293b; border-bottom: 2px solid #3b82f6; padding-bottom: 10px; }
    .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; }
    .metric { padding: 15px; background: #f8fafc; border-radius: 6px; }
    .metric-label { font-size: 12px; color: #64748b; margin-bottom: 5px; }
    .metric-value { font-size: 20px; font-weight: bold; color: #1e293b; }
    .health-score { font-size: 48px; font-weight: bold; color: ${getHealthColor(health.overallScore || 0)}; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #e2e8f0; }
    th { background: #f8fafc; font-weight: 600; }
    .footer { text-align: center; color: #64748b; margin-top: 30px; font-size: 12px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${assetData.name}</h1>
    <p>Asset Tag: ${assetData.assetTag} | Vendor: ${assetData.vendor?.toUpperCase()}</p>
    <p>Report Generated: ${new Date().toLocaleString()}</p>
  </div>

  <div class="grid">
    <div class="card">
      <h2>Health Overview</h2>
      <div style="text-align: center; padding: 20px;">
        <div class="health-score">${health.overallScore || 0}%</div>
        <p style="color: #64748b;">Overall Health Score</p>
      </div>
    </div>

    <div class="card">
      <h2>Health Metrics</h2>
      <div class="metric"><span class="metric-label">Electrical Health</span><div class="metric-value">${health.electricalHealth || 0}%</div></div>
      <div class="metric"><span class="metric-label">Thermal Health</span><div class="metric-value">${health.thermalHealth || 0}%</div></div>
      <div class="metric"><span class="metric-label">Insulation Health</span><div class="metric-value">${health.insulationHealth || 0}%</div></div>
      <div class="metric"><span class="metric-label">Mechanical Health</span><div class="metric-value">${health.mechanicalHealth || 0}%</div></div>
    </div>
  </div>

  <div class="card">
    <h2>Asset Details</h2>
    <table>
      <tr><th>Property</th><th>Value</th></tr>
      <tr><td>Asset Name</td><td>${assetData.name}</td></tr>
      <tr><td>Asset Tag</td><td>${assetData.assetTag}</td></tr>
      <tr><td>Vendor</td><td>${assetData.vendor}</td></tr>
      <tr><td>Model</td><td>${assetData.vendorModel || 'N/A'}</td></tr>
      <tr><td>Serial Number</td><td>${assetData.serialNumber || 'N/A'}</td></tr>
      <tr><td>Location</td><td>${formatLocation(assetData.location)}</td></tr>
      <tr><td>Installation Date</td><td>${assetData.installationDate ? new Date(assetData.installationDate).toLocaleDateString() : 'N/A'}</td></tr>
      <tr><td>Warranty Expiry</td><td>${assetData.warrantyExpiry ? new Date(assetData.warrantyExpiry).toLocaleDateString() : 'N/A'}</td></tr>
    </table>
  </div>

  ${rulData ? `
  <div class="card">
    <h2>Predictive Analysis (RUL)</h2>
    <div class="grid">
      <div class="metric"><span class="metric-label">Predicted RUL</span><div class="metric-value">${rulData.predictedRul} days</div></div>
      <div class="metric"><span class="metric-label">Confidence Interval</span><div class="metric-value">${rulData.confidenceLow} - ${rulData.confidenceHigh} days</div></div>
      <div class="metric"><span class="metric-label">Degradation Rate</span><div class="metric-value">${(rulData.degradationRate * 100).toFixed(2)}%/day</div></div>
      <div class="metric"><span class="metric-label">30-Day Failure Probability</span><div class="metric-value">${(rulData.failureProbability30d * 100).toFixed(1)}%</div></div>
    </div>
    ${rulData.maintenanceRecommendation ? `
    <div style="margin-top: 20px; padding: 15px; background: #f0fdf4; border-radius: 6px; border-left: 4px solid #22c55e;">
      <strong>Recommendation:</strong> ${rulData.maintenanceRecommendation.action}<br>
      <strong>Recommended Date:</strong> ${rulData.maintenanceRecommendation.recommendedDate}
    </div>
    ` : ''}
  </div>
  ` : ''}

  ${assetData.specifications ? `
  <div class="card">
    <h2>Specifications</h2>
    <table>
      <tr><th>Parameter</th><th>Value</th></tr>
      ${assetData.specifications.rated_voltage ? `<tr><td>Rated Voltage</td><td>${assetData.specifications.rated_voltage}V</td></tr>` : ''}
      ${assetData.specifications.rated_current ? `<tr><td>Rated Current</td><td>${assetData.specifications.rated_current}A</td></tr>` : ''}
      ${assetData.specifications.rated_power ? `<tr><td>Rated Power</td><td>${assetData.specifications.rated_power}kW</td></tr>` : ''}
      ${assetData.specifications.frequency ? `<tr><td>Frequency</td><td>${assetData.specifications.frequency}Hz</td></tr>` : ''}
      ${assetData.specifications.breaking_capacity ? `<tr><td>Breaking Capacity</td><td>${assetData.specifications.breaking_capacity}kA</td></tr>` : ''}
    </table>
  </div>
  ` : ''}

  <div class="footer">
    <p>CANUnited Asset Manager | Generated by System</p>
  </div>
</body>
</html>
    `;
  };

  // Generate CSV report
  const generateCSVReport = (assetData: any, rulData: any) => {
    const health = assetData.health || {};
    const rows = [
      ['Asset Report', ''],
      ['Generated', new Date().toLocaleString()],
      ['', ''],
      ['Basic Information', ''],
      ['Asset Name', assetData.name],
      ['Asset Tag', assetData.assetTag],
      ['Vendor', assetData.vendor],
      ['Model', assetData.vendorModel || 'N/A'],
      ['Serial Number', assetData.serialNumber || 'N/A'],
      ['Location', formatLocation(assetData.location)],
      ['Installation Date', assetData.installationDate ? new Date(assetData.installationDate).toLocaleDateString() : 'N/A'],
      ['Warranty Expiry', assetData.warrantyExpiry ? new Date(assetData.warrantyExpiry).toLocaleDateString() : 'N/A'],
      ['', ''],
      ['Health Metrics', ''],
      ['Overall Score', `${health.overallScore || 0}%`],
      ['Electrical Health', `${health.electricalHealth || 0}%`],
      ['Thermal Health', `${health.thermalHealth || 0}%`],
      ['Insulation Health', `${health.insulationHealth || 0}%`],
      ['Mechanical Health', `${health.mechanicalHealth || 0}%`],
    ];

    if (rulData) {
      rows.push(
        ['', ''],
        ['Predictive Analysis', ''],
        ['Predicted RUL', `${rulData.predictedRul} days`],
        ['Confidence Low', `${rulData.confidenceLow} days`],
        ['Confidence High', `${rulData.confidenceHigh} days`],
        ['Degradation Rate', `${(rulData.degradationRate * 100).toFixed(2)}%/day`],
        ['30-Day Failure Probability', `${(rulData.failureProbability30d * 100).toFixed(1)}%`]
      );
    }

    if (assetData.specifications) {
      rows.push(['', ''], ['Specifications', '']);
      if (assetData.specifications.rated_voltage) rows.push(['Rated Voltage', `${assetData.specifications.rated_voltage}V`]);
      if (assetData.specifications.rated_current) rows.push(['Rated Current', `${assetData.specifications.rated_current}A`]);
      if (assetData.specifications.rated_power) rows.push(['Rated Power', `${assetData.specifications.rated_power}kW`]);
      if (assetData.specifications.frequency) rows.push(['Frequency', `${assetData.specifications.frequency}Hz`]);
      if (assetData.specifications.breaking_capacity) rows.push(['Breaking Capacity', `${assetData.specifications.breaking_capacity}kA`]);
    }

    return rows.map(row => row.join(',')).join('\n');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!asset) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400">Asset not found</p>
        <Link to="/assets" className="text-primary-400 hover:text-primary-300 mt-2 inline-block">
          Back to Assets
        </Link>
      </div>
    );
  }

  const health = asset.health || {};
  const healthRadarData = [
    { metric: 'Electrical', value: health.electricalHealth || 0 },
    { metric: 'Thermal', value: health.thermalHealth || 0 },
    { metric: 'Insulation', value: health.insulationHealth || 0 },
    { metric: 'Mechanical', value: health.mechanicalHealth || 0 },
  ];

  const historyData = (healthHistory || []).map((h: any) => ({
    date: new Date(h.timestamp).toLocaleDateString(),
    health: h.healthScore,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Link
            to="/assets"
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-slate-400" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-display font-bold text-white">{asset.name}</h1>
              <span
                className="vendor-badge"
                style={{
                  backgroundColor: `${vendorColors[asset.vendor]}20`,
                  color: vendorColors[asset.vendor],
                }}
              >
                {asset.vendor}
              </span>
            </div>
            <p className="text-slate-400 font-mono">{asset.assetTag}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowExportModal(true)}
            className="btn btn-outline flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            {t('reports.generateReport')}
          </button>
          <button
            onClick={handleScheduleMaintenance}
            className="btn btn-primary flex items-center gap-2"
          >
            <Wrench className="w-4 h-4" />
            {t('maintenance.scheduleMaintenance')}
          </button>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Asset Info */}
        <div className="space-y-6">
          {/* Health Score Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="card p-6"
          >
            <h2 className="text-lg font-semibold text-white mb-4">Health Score</h2>
            <div className="flex items-center justify-center">
              <div className="relative w-40 h-40">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="45"
                    fill="none"
                    stroke="#1e293b"
                    strokeWidth="10"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="45"
                    fill="none"
                    stroke={getHealthColor(health.overallScore || 0)}
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={`${(health.overallScore || 0) * 2.83} 283`}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-4xl font-bold text-white font-mono">
                    {health.overallScore || 0}
                  </span>
                  <span className="text-sm text-slate-400">/ 100</span>
                </div>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-center gap-2">
              <span className={clsx(
                'px-3 py-1 rounded-full text-sm font-medium',
                health.status === 'excellent' && 'bg-green-500/20 text-green-400',
                health.status === 'good' && 'bg-emerald-500/20 text-emerald-400',
                health.status === 'fair' && 'bg-yellow-500/20 text-yellow-400',
                health.status === 'poor' && 'bg-orange-500/20 text-orange-400',
                health.status === 'critical' && 'bg-red-500/20 text-red-400'
              )}>
                {(health.status || 'Unknown').charAt(0).toUpperCase() + (health.status || 'Unknown').slice(1)}
              </span>
            </div>
          </motion.div>

          {/* QR Code Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="card p-6"
          >
            <h2 className="text-lg font-semibold text-white mb-4">Asset QR Code</h2>
            <div className="flex flex-col items-center">
              <div className="bg-white p-4 rounded-xl">
                <QRCodeSVG
                  value={`${window.location.origin}/assets/${id}`}
                  size={160}
                  level="H"
                />
              </div>
              <p className="text-sm text-slate-400 mt-4 text-center">
                Scan to access asset information
              </p>
              <button className="btn btn-outline mt-4 flex items-center gap-2">
                <Download className="w-4 h-4" />
                Download QR
              </button>
            </div>
          </motion.div>

          {/* Asset Details */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="card p-6"
          >
            <h2 className="text-lg font-semibold text-white mb-4">Details</h2>
            <div className="space-y-4">
              <DetailRow
                icon={Settings}
                label="Model"
                value={asset.vendorModel}
              />
              <DetailRow
                icon={MapPin}
                label="Location"
                value={formatLocation(asset.location)}
              />
              <DetailRow
                icon={Calendar}
                label="Installed"
                value={asset.installationDate ? new Date(asset.installationDate).toLocaleDateString() : 'N/A'}
              />
              <DetailRow
                icon={Shield}
                label="Warranty"
                value={asset.warrantyExpiry ? new Date(asset.warrantyExpiry).toLocaleDateString() : 'N/A'}
              />
              <DetailRow
                icon={Clock}
                label="RUL"
                value={health.remainingUsefulLife ? `${health.remainingUsefulLife} days` : 'N/A'}
              />
            </div>
          </motion.div>
        </div>

        {/* Middle & Right Columns - Charts & Data */}
        <div className="lg:col-span-2 space-y-6">
          {/* Health Trend Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="card p-6"
          >
            <h2 className="text-lg font-semibold text-white mb-4">Health Trend</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={historyData.length ? historyData : generateMockTrend()}>
                  <defs>
                    <linearGradient id="healthGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="date" stroke="#64748b" fontSize={12} />
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

          {/* Health Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Radar Chart */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="card p-6"
            >
              <h2 className="text-lg font-semibold text-white mb-4">Health Breakdown</h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={healthRadarData}>
                    <PolarGrid stroke="#334155" />
                    <PolarAngleAxis dataKey="metric" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                    <PolarRadiusAxis domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 10 }} />
                    <Radar
                      name="Health"
                      dataKey="value"
                      stroke="#22c55e"
                      fill="#22c55e"
                      fillOpacity={0.3}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            {/* Health Metrics */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="card p-6"
            >
              <h2 className="text-lg font-semibold text-white mb-4">Health Metrics</h2>
              <div className="space-y-4">
                <HealthMetric
                  icon={Zap}
                  label="Electrical"
                  value={health.electricalHealth || 0}
                  color="#3b82f6"
                />
                <HealthMetric
                  icon={Thermometer}
                  label="Thermal"
                  value={health.thermalHealth || 0}
                  color="#ef4444"
                />
                <HealthMetric
                  icon={Shield}
                  label="Insulation"
                  value={health.insulationHealth || 0}
                  color="#a855f7"
                />
                <HealthMetric
                  icon={Gauge}
                  label="Mechanical"
                  value={health.mechanicalHealth || 0}
                  color="#f59e0b"
                />
              </div>
            </motion.div>
          </div>

          {/* RUL Prediction Section */}
          {rulPrediction && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FailureRiskCard
                predictedRul={rulPrediction.predictedRul}
                degradationRate={rulPrediction.degradationRate}
                confidenceLow={rulPrediction.confidenceLow}
                confidenceHigh={rulPrediction.confidenceHigh}
                failureProbability30d={rulPrediction.failureProbability30d}
                healthTrend={rulPrediction.healthTrend}
                maintenanceRecommendation={rulPrediction.maintenanceRecommendation}
              />

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="card p-6"
              >
                <h2 className="text-lg font-semibold text-white mb-4">
                  {t('predictions.healthTrend')} - 30 {t('predictions.days')}
                </h2>
                <RULChart
                  healthForecast={rulPrediction.healthForecast}
                  currentHealth={health.overallScore || 85}
                />
              </motion.div>
            </div>
          )}

          {/* Specifications */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="card p-6"
          >
            <h2 className="text-lg font-semibold text-white mb-4">{t('assets.specifications')}</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {asset.specifications?.rated_voltage && (
                <SpecCard label="Rated Voltage" value={`${asset.specifications.rated_voltage}V`} />
              )}
              {asset.specifications?.rated_current && (
                <SpecCard label="Rated Current" value={`${asset.specifications.rated_current}A`} />
              )}
              {asset.specifications?.rated_power && (
                <SpecCard label="Rated Power" value={`${asset.specifications.rated_power}kW`} />
              )}
              {asset.specifications?.frequency && (
                <SpecCard label="Frequency" value={`${asset.specifications.frequency}Hz`} />
              )}
              {asset.specifications?.breaking_capacity && (
                <SpecCard label="Breaking Capacity" value={`${asset.specifications.breaking_capacity}kA`} />
              )}
              {asset.specifications?.trip_unit && (
                <SpecCard label="Trip Unit" value={asset.specifications.trip_unit} />
              )}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Export Report Modal */}
      <AnimatePresence>
        {showExportModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
            onClick={() => setShowExportModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-slate-700">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                    <Download className="w-5 h-5 text-primary-500" />
                    {t('reports.generateReport')}
                  </h2>
                  <button
                    onClick={() => setShowExportModal(false)}
                    className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-slate-400" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* Asset Info */}
                <div className="p-4 bg-slate-800/50 rounded-lg">
                  <p className="text-sm text-slate-400 mb-1">Generating report for:</p>
                  <p className="text-white font-medium">{asset?.name}</p>
                  <p className="text-sm text-slate-500 font-mono">{asset?.assetTag}</p>
                </div>

                {/* Format Selection */}
                <div>
                  <label className="block text-sm text-slate-400 mb-3">
                    {t('reports.format')}
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setExportFormat('pdf')}
                      className={clsx(
                        'p-4 rounded-lg border-2 transition-all flex flex-col items-center gap-2',
                        exportFormat === 'pdf'
                          ? 'border-primary-500 bg-primary-500/10'
                          : 'border-slate-700 hover:border-slate-600'
                      )}
                    >
                      <FileText
                        className={clsx(
                          'w-8 h-8',
                          exportFormat === 'pdf' ? 'text-primary-400' : 'text-slate-400'
                        )}
                      />
                      <span className={clsx(
                        'font-medium',
                        exportFormat === 'pdf' ? 'text-primary-400' : 'text-slate-300'
                      )}>
                        PDF Report
                      </span>
                      <span className="text-xs text-slate-500">
                        Full formatted report
                      </span>
                    </button>

                    <button
                      onClick={() => setExportFormat('excel')}
                      className={clsx(
                        'p-4 rounded-lg border-2 transition-all flex flex-col items-center gap-2',
                        exportFormat === 'excel'
                          ? 'border-primary-500 bg-primary-500/10'
                          : 'border-slate-700 hover:border-slate-600'
                      )}
                    >
                      <FileSpreadsheet
                        className={clsx(
                          'w-8 h-8',
                          exportFormat === 'excel' ? 'text-primary-400' : 'text-slate-400'
                        )}
                      />
                      <span className={clsx(
                        'font-medium',
                        exportFormat === 'excel' ? 'text-primary-400' : 'text-slate-300'
                      )}>
                        Excel/CSV
                      </span>
                      <span className="text-xs text-slate-500">
                        Data for analysis
                      </span>
                    </button>
                  </div>
                </div>

                {/* Report Contents */}
                <div>
                  <label className="block text-sm text-slate-400 mb-2">
                    Report includes:
                  </label>
                  <ul className="text-sm text-slate-300 space-y-1">
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                      Basic asset information
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                      Health metrics & scores
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                      RUL prediction data
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                      Technical specifications
                    </li>
                  </ul>
                </div>
              </div>

              <div className="p-6 border-t border-slate-700 flex justify-end gap-3">
                <button
                  onClick={() => setShowExportModal(false)}
                  className="btn btn-outline"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleExportReport}
                  disabled={isExporting}
                  className="btn btn-primary flex items-center gap-2"
                >
                  {isExporting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {t('reports.generating')}
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      {t('reports.download')} {exportFormat.toUpperCase()}
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Helper components
function DetailRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center">
        <Icon className="w-4 h-4 text-slate-400" />
      </div>
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-sm text-white">{value}</p>
      </div>
    </div>
  );
}

function HealthMetric({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}20` }}>
        <Icon className="w-5 h-5" style={{ color }} />
      </div>
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm text-slate-300">{label}</span>
          <span className="text-sm font-mono font-medium" style={{ color: getHealthColor(value) }}>
            {value}%
          </span>
        </div>
        <div className="h-2 rounded-full bg-slate-800">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${value}%`, backgroundColor: getHealthColor(value) }}
          />
        </div>
      </div>
    </div>
  );
}

function SpecCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-800/50 rounded-lg p-4">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className="text-lg font-mono font-medium text-white">{value}</p>
    </div>
  );
}

// Helper functions
function getHealthColor(score: number): string {
  if (score >= 80) return '#10b981';
  if (score >= 60) return '#22c55e';
  if (score >= 40) return '#f59e0b';
  if (score >= 20) return '#f97316';
  return '#ef4444';
}

function formatLocation(location: any): string {
  if (!location) return 'Not specified';
  const parts = [location.building, location.floor, location.room, location.panel].filter(Boolean);
  return parts.length > 0 ? parts.join(' / ') : 'Not specified';
}

function generateMockTrend() {
  const data = [];
  for (let i = 30; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    data.push({
      date: date.toLocaleDateString(),
      health: 75 + Math.sin(i / 5) * 10 + Math.random() * 5,
    });
  }
  return data;
}
