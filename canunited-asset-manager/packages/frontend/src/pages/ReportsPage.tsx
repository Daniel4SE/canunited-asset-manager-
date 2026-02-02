import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import {
  FileText,
  Download,
  FileSpreadsheet,
  Calendar,
  Building2,
  Boxes,
  Activity,
  AlertTriangle,
  Wrench,
  Loader2,
} from 'lucide-react';
import clsx from 'clsx';
import { getApi } from '../lib/api';

type ReportType = 'asset_inventory' | 'health_analysis' | 'maintenance_records' | 'alert_logs';
type ExportFormat = 'pdf' | 'excel';

interface ReportConfig {
  type: ReportType;
  format: ExportFormat;
  dateRange: {
    from: string;
    to: string;
  };
  siteIds: string[];
  assetIds: string[];
}

const reportTypes = [
  { id: 'asset_inventory' as const, icon: Boxes, color: 'bg-blue-500' },
  { id: 'health_analysis' as const, icon: Activity, color: 'bg-emerald-500' },
  { id: 'maintenance_records' as const, icon: Wrench, color: 'bg-amber-500' },
  { id: 'alert_logs' as const, icon: AlertTriangle, color: 'bg-red-500' },
];

export default function ReportsPage() {
  const { t } = useTranslation();
  const [selectedType, setSelectedType] = useState<ReportType>('asset_inventory');
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('pdf');
  const [dateFrom, setDateFrom] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 1);
    return date.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0]);
  const [isGenerating, setIsGenerating] = useState(false);

  const { data: sitesData } = useQuery({
    queryKey: ['sites'],
    queryFn: async () => {
      const response = await getApi().get('/sites');
      return response.data;
    },
  });

  const sites = sitesData?.data || [];

  const handleGenerateReport = async () => {
    setIsGenerating(true);

    try {
      const config: ReportConfig = {
        type: selectedType,
        format: selectedFormat,
        dateRange: { from: dateFrom, to: dateTo },
        siteIds: [],
        assetIds: [],
      };

      // In demo mode, generate mock report data
      const mockReport = generateMockReport(config);

      if (selectedFormat === 'pdf') {
        downloadPdfReport(mockReport, selectedType);
      } else {
        downloadExcelReport(mockReport, selectedType);
      }
    } catch (error) {
      console.error('Failed to generate report:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-white">{t('reports.title')}</h1>
          <p className="text-slate-400 mt-1">{t('reports.generateReport')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Report Type Selection */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">{t('reports.reportType')}</h2>
            <div className="grid grid-cols-2 gap-4">
              {reportTypes.map((type) => (
                <motion.button
                  key={type.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSelectedType(type.id)}
                  className={clsx(
                    'flex items-center gap-4 p-4 rounded-xl border-2 transition-all',
                    selectedType === type.id
                      ? 'border-primary-500 bg-primary-500/10'
                      : 'border-slate-700 hover:border-slate-600 bg-slate-800/50'
                  )}
                >
                  <div className={clsx('w-12 h-12 rounded-lg flex items-center justify-center', type.color)}>
                    <type.icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-white">
                      {t(`reports.${type.id === 'asset_inventory' ? 'assetInventory' :
                        type.id === 'health_analysis' ? 'healthAnalysis' :
                        type.id === 'maintenance_records' ? 'maintenanceRecords' : 'alertLogs'}`)}
                    </p>
                  </div>
                </motion.button>
              ))}
            </div>
          </div>

          {/* Date Range */}
          <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-slate-400" />
              {t('reports.dateRange')}
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-400 mb-2">{t('common.from')}</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-2">{t('common.to')}</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-primary-500"
                />
              </div>
            </div>
          </div>

          {/* Site Filter */}
          <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-slate-400" />
              {t('reports.selectSites')}
            </h2>
            <div className="flex flex-wrap gap-2">
              <button className="px-4 py-2 bg-primary-500/20 text-primary-400 rounded-lg border border-primary-500/50">
                {t('reports.allSites')}
              </button>
              {sites.slice(0, 5).map((site: { id: string; name: string }) => (
                <button
                  key={site.id}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg border border-slate-700 hover:border-slate-600"
                >
                  {site.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Export Panel */}
        <div className="space-y-6">
          <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-6 sticky top-6">
            <h2 className="text-lg font-semibold text-white mb-4">{t('reports.format')}</h2>

            <div className="space-y-3 mb-6">
              <button
                onClick={() => setSelectedFormat('pdf')}
                className={clsx(
                  'w-full flex items-center gap-3 p-4 rounded-lg border-2 transition-all',
                  selectedFormat === 'pdf'
                    ? 'border-red-500 bg-red-500/10'
                    : 'border-slate-700 hover:border-slate-600'
                )}
              >
                <FileText className="w-8 h-8 text-red-400" />
                <div className="text-left">
                  <p className="font-medium text-white">PDF</p>
                  <p className="text-sm text-slate-400">Portable Document Format</p>
                </div>
              </button>

              <button
                onClick={() => setSelectedFormat('excel')}
                className={clsx(
                  'w-full flex items-center gap-3 p-4 rounded-lg border-2 transition-all',
                  selectedFormat === 'excel'
                    ? 'border-emerald-500 bg-emerald-500/10'
                    : 'border-slate-700 hover:border-slate-600'
                )}
              >
                <FileSpreadsheet className="w-8 h-8 text-emerald-400" />
                <div className="text-left">
                  <p className="font-medium text-white">Excel</p>
                  <p className="text-sm text-slate-400">Microsoft Excel (.xlsx)</p>
                </div>
              </button>
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleGenerateReport}
              disabled={isGenerating}
              className={clsx(
                'w-full flex items-center justify-center gap-2 py-3 rounded-lg font-medium transition-all',
                isGenerating
                  ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                  : 'bg-primary-500 text-white hover:bg-primary-600'
              )}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {t('reports.generating')}
                </>
              ) : (
                <>
                  <Download className="w-5 h-5" />
                  {selectedFormat === 'pdf' ? t('reports.downloadPDF') : t('reports.downloadExcel')}
                </>
              )}
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Mock report generation for demo mode
function generateMockReport(config: ReportConfig) {
  const baseData = {
    generatedAt: new Date().toISOString(),
    dateRange: config.dateRange,
    type: config.type,
  };

  switch (config.type) {
    case 'asset_inventory':
      return {
        ...baseData,
        title: 'Asset Inventory Report',
        data: [
          { tag: 'SITE1-MVS-0001', name: 'Main Switchgear', type: 'MV_SWITCHGEAR', manufacturer: 'ABB', health: 92, site: 'Munich Plant' },
          { tag: 'SITE1-TRF-0001', name: 'Power Transformer T1', type: 'TRANSFORMER', manufacturer: 'Siemens', health: 87, site: 'Munich Plant' },
          { tag: 'SITE1-LVP-0001', name: 'LV Panel A', type: 'LV_PANEL', manufacturer: 'Schneider', health: 78, site: 'Munich Plant' },
          { tag: 'SITE2-MVS-0001', name: 'Distribution Board', type: 'MV_SWITCHGEAR', manufacturer: 'Eaton', health: 95, site: 'Berlin Office' },
          { tag: 'SITE2-VFD-0001', name: 'Variable Frequency Drive', type: 'VFD', manufacturer: 'ABB', health: 82, site: 'Berlin Office' },
        ],
      };
    case 'health_analysis':
      return {
        ...baseData,
        title: 'Health Analysis Report',
        summary: {
          excellent: 12,
          good: 28,
          fair: 8,
          poor: 3,
          critical: 1,
        },
        data: [
          { asset: 'Main Switchgear', health: 92, trend: 'stable', lastMonth: 91, prediction: 90 },
          { asset: 'Power Transformer T1', health: 87, trend: 'declining', lastMonth: 89, prediction: 84 },
          { asset: 'LV Panel A', health: 78, trend: 'improving', lastMonth: 75, prediction: 80 },
        ],
      };
    case 'maintenance_records':
      return {
        ...baseData,
        title: 'Maintenance Records Report',
        data: [
          { date: '2024-01-15', asset: 'Main Switchgear', type: 'Preventive', status: 'Completed', duration: '2h', technician: 'John Smith' },
          { date: '2024-01-12', asset: 'Power Transformer T1', type: 'Inspection', status: 'Completed', duration: '1h', technician: 'Jane Doe' },
          { date: '2024-01-10', asset: 'LV Panel A', type: 'Corrective', status: 'Completed', duration: '4h', technician: 'Mike Johnson' },
        ],
      };
    case 'alert_logs':
      return {
        ...baseData,
        title: 'Alert Logs Report',
        data: [
          { timestamp: '2024-01-20 14:32', asset: 'Main Switchgear', severity: 'HIGH', message: 'Temperature exceeded threshold', status: 'Resolved' },
          { timestamp: '2024-01-19 09:15', asset: 'VFD Unit', severity: 'MEDIUM', message: 'Vibration anomaly detected', status: 'Acknowledged' },
          { timestamp: '2024-01-18 16:45', asset: 'LV Panel A', severity: 'LOW', message: 'Scheduled maintenance due', status: 'Active' },
        ],
      };
    default:
      return baseData;
  }
}

function downloadPdfReport(reportData: ReturnType<typeof generateMockReport>, type: ReportType) {
  // Create a simple HTML-based PDF alternative for demo
  const content = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${reportData.title}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 40px; }
        h1 { color: #1e293b; border-bottom: 2px solid #22c55e; padding-bottom: 10px; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #e2e8f0; padding: 12px; text-align: left; }
        th { background: #f8fafc; font-weight: 600; }
        .header { color: #64748b; font-size: 14px; margin-bottom: 30px; }
      </style>
    </head>
    <body>
      <h1>${reportData.title}</h1>
      <div class="header">
        Generated: ${new Date(reportData.generatedAt).toLocaleString()}<br>
        Period: ${reportData.dateRange.from} to ${reportData.dateRange.to}
      </div>
      <table>
        <thead>
          <tr>
            ${getTableHeaders(type).map(h => `<th>${h}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${('data' in reportData && Array.isArray(reportData.data))
            ? reportData.data.map(row => `<tr>${Object.values(row).map(v => `<td>${v}</td>`).join('')}</tr>`).join('')
            : ''}
        </tbody>
      </table>
    </body>
    </html>
  `;

  const blob = new Blob([content], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${type}_report_${new Date().toISOString().split('T')[0]}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function downloadExcelReport(reportData: ReturnType<typeof generateMockReport>, type: ReportType) {
  // Create CSV for Excel compatibility in demo mode
  const headers = getTableHeaders(type);
  const rows = ('data' in reportData && Array.isArray(reportData.data))
    ? reportData.data.map(row => Object.values(row).join(','))
    : [];

  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${type}_report_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function getTableHeaders(type: ReportType): string[] {
  switch (type) {
    case 'asset_inventory':
      return ['Tag', 'Name', 'Type', 'Manufacturer', 'Health', 'Site'];
    case 'health_analysis':
      return ['Asset', 'Health', 'Trend', 'Last Month', 'Prediction'];
    case 'maintenance_records':
      return ['Date', 'Asset', 'Type', 'Status', 'Duration', 'Technician'];
    case 'alert_logs':
      return ['Timestamp', 'Asset', 'Severity', 'Message', 'Status'];
    default:
      return [];
  }
}
