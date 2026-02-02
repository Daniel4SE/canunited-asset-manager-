import PDFDocument from 'pdfkit';
import type { ReportData } from '../index.js';

export async function generatePdfReport(data: ReportData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Header
      doc
        .fillColor('#1e293b')
        .fontSize(24)
        .font('Helvetica-Bold')
        .text('CANUnited Asset Manager', 50, 50);

      doc
        .fillColor('#22c55e')
        .fontSize(18)
        .font('Helvetica-Bold')
        .text(data.title, 50, 85);

      // Metadata
      doc
        .fillColor('#64748b')
        .fontSize(10)
        .font('Helvetica')
        .text(`Generated: ${new Date(data.generatedAt).toLocaleString()}`, 50, 115)
        .text(`Period: ${data.dateRange.from} to ${data.dateRange.to}`, 50, 130);

      doc.moveTo(50, 150).lineTo(545, 150).stroke('#e2e8f0');

      // Summary section if available
      let yPos = 170;
      if (data.summary) {
        doc
          .fillColor('#1e293b')
          .fontSize(14)
          .font('Helvetica-Bold')
          .text('Summary', 50, yPos);

        yPos += 25;
        doc.fontSize(10).font('Helvetica');

        const summaryEntries = Object.entries(data.summary);
        const colWidth = 120;
        const cols = 4;

        summaryEntries.forEach((entry, index) => {
          const col = index % cols;
          const row = Math.floor(index / cols);
          const x = 50 + col * colWidth;
          const y = yPos + row * 20;

          doc
            .fillColor('#64748b')
            .text(`${formatLabel(entry[0])}:`, x, y, { continued: true })
            .fillColor('#1e293b')
            .text(` ${entry[1]}`);
        });

        yPos += Math.ceil(summaryEntries.length / cols) * 20 + 30;
      }

      // Table header
      doc.moveTo(50, yPos).lineTo(545, yPos).stroke('#e2e8f0');
      yPos += 10;

      const tableWidth = 495;
      const colWidths = calculateColumnWidths(data.columns, tableWidth);

      // Draw header row
      doc.fillColor('#f8fafc').rect(50, yPos, tableWidth, 25).fill();

      let xPos = 50;
      data.columns.forEach((col, index) => {
        doc
          .fillColor('#1e293b')
          .fontSize(9)
          .font('Helvetica-Bold')
          .text(col.header, xPos + 5, yPos + 8, {
            width: colWidths[index] - 10,
            height: 20,
            ellipsis: true,
          });
        xPos += colWidths[index];
      });

      yPos += 25;
      doc.moveTo(50, yPos).lineTo(545, yPos).stroke('#e2e8f0');

      // Draw data rows
      data.rows.forEach((row, rowIndex) => {
        // Check for page break
        if (yPos > 750) {
          doc.addPage();
          yPos = 50;
        }

        // Alternate row colors
        if (rowIndex % 2 === 0) {
          doc.fillColor('#f8fafc').rect(50, yPos, tableWidth, 22).fill();
        }

        xPos = 50;
        data.columns.forEach((col, colIndex) => {
          const value = String(row[col.key] ?? '');

          // Color coding for severity and health
          let textColor = '#334155';
          if (col.key === 'severity') {
            textColor = getSeverityColor(value);
          } else if (col.key === 'health' || col.key === 'currentHealth') {
            textColor = getHealthColor(Number(value));
          } else if (col.key === 'trend') {
            textColor = getTrendColor(value);
          }

          doc
            .fillColor(textColor)
            .fontSize(9)
            .font('Helvetica')
            .text(value, xPos + 5, yPos + 6, {
              width: colWidths[colIndex] - 10,
              height: 18,
              ellipsis: true,
            });
          xPos += colWidths[colIndex];
        });

        yPos += 22;
      });

      // Footer
      const pageCount = doc.bufferedPageRange().count;
      for (let i = 0; i < pageCount; i++) {
        doc.switchToPage(i);
        doc
          .fillColor('#94a3b8')
          .fontSize(8)
          .text(
            `Page ${i + 1} of ${pageCount} | CANUnited Asset Manager`,
            50,
            800,
            { align: 'center', width: 495 }
          );
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

function calculateColumnWidths(
  columns: { key: string; header: string; width?: number }[],
  totalWidth: number
): number[] {
  const totalDefinedWidth = columns.reduce((sum, col) => sum + (col.width || 15), 0);
  const scaleFactor = totalWidth / totalDefinedWidth;

  return columns.map((col) => Math.floor((col.width || 15) * scaleFactor));
}

function formatLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

function getSeverityColor(severity: string): string {
  switch (severity.toUpperCase()) {
    case 'CRITICAL':
      return '#dc2626';
    case 'HIGH':
      return '#ea580c';
    case 'MEDIUM':
      return '#d97706';
    case 'LOW':
      return '#65a30d';
    case 'INFO':
      return '#0891b2';
    default:
      return '#334155';
  }
}

function getHealthColor(health: number): string {
  if (health >= 80) return '#16a34a';
  if (health >= 60) return '#65a30d';
  if (health >= 40) return '#d97706';
  if (health >= 20) return '#ea580c';
  return '#dc2626';
}

function getTrendColor(trend: string): string {
  switch (trend.toLowerCase()) {
    case 'improving':
      return '#16a34a';
    case 'stable':
      return '#0891b2';
    case 'declining':
      return '#dc2626';
    default:
      return '#334155';
  }
}
