import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { generateReport, getReportTemplates, type ReportType, type ExportFormat } from '../services/reports/index.js';

const router = Router();

// Validation schemas
const generateReportSchema = z.object({
  type: z.enum(['asset_inventory', 'health_analysis', 'maintenance_records', 'alert_logs']),
  format: z.enum(['pdf', 'excel']),
  dateRange: z.object({
    from: z.string(),
    to: z.string(),
  }),
  siteIds: z.array(z.string()).optional(),
  assetIds: z.array(z.string()).optional(),
});

// Get available report templates
router.get('/templates', authenticate, async (_req, res, next) => {
  try {
    const templates = getReportTemplates();
    res.json({
      success: true,
      data: templates,
    });
  } catch (error) {
    next(error);
  }
});

// Generate report
router.post('/generate', authenticate, async (req, res, next) => {
  try {
    const validation = generateReportSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid report configuration',
          details: validation.error.errors,
        },
      });
    }

    const { type, format, dateRange, siteIds, assetIds } = validation.data;
    const organizationId = req.user?.organizationId || '';

    const reportBuffer = await generateReport({
      type: type as ReportType,
      format: format as ExportFormat,
      dateRange,
      siteIds,
      assetIds,
      organizationId,
    });

    // Set appropriate headers
    const filename = `${type}_report_${new Date().toISOString().split('T')[0]}`;
    const contentType = format === 'pdf'
      ? 'application/pdf'
      : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    const extension = format === 'pdf' ? 'pdf' : 'xlsx';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.${extension}"`);
    res.setHeader('Content-Length', reportBuffer.length);

    return res.send(reportBuffer);
  } catch (error) {
    next(error);
  }
});

export const reportsRoutes = router;
