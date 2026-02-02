import { generatePdfReport } from './generators/pdf.generator.js';
import { generateExcelReport } from './generators/excel.generator.js';

export type ReportType = 'asset_inventory' | 'health_analysis' | 'maintenance_records' | 'alert_logs';
export type ExportFormat = 'pdf' | 'excel';

export interface ReportConfig {
  type: ReportType;
  format: ExportFormat;
  dateRange: {
    from: string;
    to: string;
  };
  siteIds?: string[];
  assetIds?: string[];
  organizationId: string;
}

export interface ReportData {
  title: string;
  generatedAt: string;
  dateRange: { from: string; to: string };
  columns: { key: string; header: string; width?: number }[];
  rows: Record<string, unknown>[];
  summary?: Record<string, unknown>;
}

export async function generateReport(config: ReportConfig): Promise<Buffer> {
  const reportData = await fetchReportData(config);

  if (config.format === 'pdf') {
    return generatePdfReport(reportData);
  } else {
    return generateExcelReport(reportData);
  }
}

async function fetchReportData(config: ReportConfig): Promise<ReportData> {
  // In a real implementation, this would query the database
  // For now, return mock data based on report type

  const baseData = {
    generatedAt: new Date().toISOString(),
    dateRange: config.dateRange,
  };

  switch (config.type) {
    case 'asset_inventory':
      return {
        ...baseData,
        title: 'Asset Inventory Report',
        columns: [
          { key: 'tag', header: 'Asset Tag', width: 20 },
          { key: 'name', header: 'Asset Name', width: 25 },
          { key: 'type', header: 'Type', width: 15 },
          { key: 'manufacturer', header: 'Manufacturer', width: 15 },
          { key: 'health', header: 'Health Score', width: 12 },
          { key: 'site', header: 'Site', width: 20 },
        ],
        rows: [
          { tag: 'SITE1-MVS-0001', name: 'Main Switchgear', type: 'MV_SWITCHGEAR', manufacturer: 'ABB', health: 92, site: 'Munich Plant' },
          { tag: 'SITE1-TRF-0001', name: 'Power Transformer T1', type: 'TRANSFORMER', manufacturer: 'Siemens', health: 87, site: 'Munich Plant' },
          { tag: 'SITE1-LVP-0001', name: 'LV Panel A', type: 'LV_PANEL', manufacturer: 'Schneider', health: 78, site: 'Munich Plant' },
          { tag: 'SITE2-MVS-0001', name: 'Distribution Board', type: 'MV_SWITCHGEAR', manufacturer: 'Eaton', health: 95, site: 'Berlin Office' },
          { tag: 'SITE2-VFD-0001', name: 'Variable Frequency Drive', type: 'VFD', manufacturer: 'ABB', health: 82, site: 'Berlin Office' },
        ],
        summary: {
          totalAssets: 5,
          avgHealth: 86.8,
          excellent: 2,
          good: 2,
          fair: 1,
        },
      };

    case 'health_analysis':
      return {
        ...baseData,
        title: 'Health Analysis Report',
        columns: [
          { key: 'asset', header: 'Asset', width: 25 },
          { key: 'currentHealth', header: 'Current Health', width: 15 },
          { key: 'trend', header: 'Trend', width: 12 },
          { key: 'lastMonth', header: 'Last Month', width: 15 },
          { key: 'prediction', header: '30-Day Prediction', width: 18 },
        ],
        rows: [
          { asset: 'Main Switchgear', currentHealth: 92, trend: 'Stable', lastMonth: 91, prediction: 90 },
          { asset: 'Power Transformer T1', currentHealth: 87, trend: 'Declining', lastMonth: 89, prediction: 84 },
          { asset: 'LV Panel A', currentHealth: 78, trend: 'Improving', lastMonth: 75, prediction: 80 },
          { asset: 'Distribution Board', currentHealth: 95, trend: 'Stable', lastMonth: 95, prediction: 94 },
          { asset: 'Variable Frequency Drive', currentHealth: 82, trend: 'Stable', lastMonth: 82, prediction: 81 },
        ],
        summary: {
          excellent: 2,
          good: 2,
          fair: 1,
          poor: 0,
          critical: 0,
        },
      };

    case 'maintenance_records':
      return {
        ...baseData,
        title: 'Maintenance Records Report',
        columns: [
          { key: 'date', header: 'Date', width: 12 },
          { key: 'asset', header: 'Asset', width: 25 },
          { key: 'taskType', header: 'Type', width: 15 },
          { key: 'status', header: 'Status', width: 12 },
          { key: 'duration', header: 'Duration', width: 10 },
          { key: 'technician', header: 'Technician', width: 20 },
        ],
        rows: [
          { date: '2024-01-15', asset: 'Main Switchgear', taskType: 'Preventive', status: 'Completed', duration: '2h', technician: 'John Smith' },
          { date: '2024-01-12', asset: 'Power Transformer T1', taskType: 'Inspection', status: 'Completed', duration: '1h', technician: 'Jane Doe' },
          { date: '2024-01-10', asset: 'LV Panel A', taskType: 'Corrective', status: 'Completed', duration: '4h', technician: 'Mike Johnson' },
          { date: '2024-01-08', asset: 'Distribution Board', taskType: 'Preventive', status: 'Completed', duration: '1.5h', technician: 'Sarah Wilson' },
          { date: '2024-01-05', asset: 'Variable Frequency Drive', taskType: 'Inspection', status: 'Completed', duration: '30m', technician: 'John Smith' },
        ],
        summary: {
          totalTasks: 5,
          completed: 5,
          preventive: 2,
          corrective: 1,
          inspection: 2,
        },
      };

    case 'alert_logs':
      return {
        ...baseData,
        title: 'Alert Logs Report',
        columns: [
          { key: 'timestamp', header: 'Timestamp', width: 20 },
          { key: 'asset', header: 'Asset', width: 25 },
          { key: 'severity', header: 'Severity', width: 12 },
          { key: 'message', header: 'Message', width: 35 },
          { key: 'status', header: 'Status', width: 12 },
        ],
        rows: [
          { timestamp: '2024-01-20 14:32', asset: 'Main Switchgear', severity: 'HIGH', message: 'Temperature exceeded threshold', status: 'Resolved' },
          { timestamp: '2024-01-19 09:15', asset: 'VFD Unit', severity: 'MEDIUM', message: 'Vibration anomaly detected', status: 'Acknowledged' },
          { timestamp: '2024-01-18 16:45', asset: 'LV Panel A', severity: 'LOW', message: 'Scheduled maintenance due', status: 'Active' },
          { timestamp: '2024-01-17 11:20', asset: 'Power Transformer', severity: 'HIGH', message: 'Oil level low', status: 'Resolved' },
          { timestamp: '2024-01-16 08:30', asset: 'Distribution Board', severity: 'INFO', message: 'Firmware update available', status: 'Active' },
        ],
        summary: {
          total: 5,
          critical: 0,
          high: 2,
          medium: 1,
          low: 1,
          info: 1,
        },
      };

    default:
      return {
        ...baseData,
        title: 'Unknown Report',
        columns: [],
        rows: [],
      };
  }
}

export function getReportTemplates() {
  return [
    {
      id: 'asset_inventory',
      name: 'Asset Inventory',
      description: 'Complete list of all assets with their current status and health scores',
    },
    {
      id: 'health_analysis',
      name: 'Health Analysis',
      description: 'Detailed health analysis with trends and predictions for all assets',
    },
    {
      id: 'maintenance_records',
      name: 'Maintenance Records',
      description: 'Historical maintenance records including completed and scheduled tasks',
    },
    {
      id: 'alert_logs',
      name: 'Alert Logs',
      description: 'Comprehensive log of all alerts with severity and resolution status',
    },
  ];
}
