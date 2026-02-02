import * as XLSX from 'xlsx';
import type { ReportData } from '../index.js';

export async function generateExcelReport(data: ReportData): Promise<Buffer> {
  // Create workbook
  const workbook = XLSX.utils.book_new();

  // Add main data sheet
  const worksheetData: (string | number)[][] = [];

  // Add title and metadata
  worksheetData.push([data.title]);
  worksheetData.push([`Generated: ${new Date(data.generatedAt).toLocaleString()}`]);
  worksheetData.push([`Period: ${data.dateRange.from} to ${data.dateRange.to}`]);
  worksheetData.push([]); // Empty row

  // Add summary if available
  if (data.summary) {
    worksheetData.push(['Summary']);
    Object.entries(data.summary).forEach(([key, value]) => {
      worksheetData.push([formatLabel(key), value as string | number]);
    });
    worksheetData.push([]); // Empty row
  }

  // Add headers
  worksheetData.push(data.columns.map((col) => col.header));

  // Add data rows
  data.rows.forEach((row) => {
    worksheetData.push(data.columns.map((col) => {
      const value = row[col.key];
      return value !== undefined && value !== null ? value as string | number : '';
    }));
  });

  // Create worksheet
  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

  // Set column widths
  const colWidths = data.columns.map((col) => ({ wch: col.width || 15 }));
  worksheet['!cols'] = colWidths;

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Report');

  // If summary exists, add a separate summary sheet
  if (data.summary) {
    const summaryData: (string | number)[][] = [
      ['Metric', 'Value'],
      ...Object.entries(data.summary).map(([key, value]) => [
        formatLabel(key),
        value as string | number,
      ]),
    ];

    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    summarySheet['!cols'] = [{ wch: 20 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');
  }

  // Generate buffer
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

  return Buffer.from(buffer);
}

function formatLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}
