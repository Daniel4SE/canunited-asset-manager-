import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/connection.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { notFound, badRequest } from '../middleware/errorHandler.js';
import { UserRole, MaintenanceStatus } from '../types/index.js';
import { logAudit, AuditActions } from '../services/audit.service.js';

export const maintenanceRoutes = Router();

maintenanceRoutes.use(authenticate);

const createMaintenanceSchema = z.object({
  siteId: z.string().uuid(),
  assetId: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().optional(),
  taskType: z.enum(['preventive', 'corrective', 'predictive', 'inspection']),
  priority: z.enum(['urgent', 'high', 'medium', 'low']),
  scheduledDate: z.string(),
  dueDate: z.string(),
  assignedTo: z.string().uuid().optional(),
  assignedTeam: z.string().optional(),
  oemServiceRequired: z.boolean().default(false),
  oemVendor: z.string().optional(),
  estimatedDurationHours: z.number().optional(),
  checklist: z.array(z.object({
    description: z.string()
  })).optional()
});

// Get maintenance tasks
maintenanceRoutes.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { 
      siteId, 
      assetId, 
      status, 
      taskType,
      priority,
      assignedTo,
      page = '1',
      perPage = '20'
    } = req.query;

    let whereConditions = ['m.organization_id = $1'];
    const params: unknown[] = [req.user!.organizationId];
    let paramIndex = 2;

    if (siteId) {
      whereConditions.push(`m.site_id = $${paramIndex++}`);
      params.push(siteId);
    }
    if (assetId) {
      whereConditions.push(`m.asset_id = $${paramIndex++}`);
      params.push(assetId);
    }
    if (status) {
      whereConditions.push(`m.status = $${paramIndex++}`);
      params.push(status);
    }
    if (taskType) {
      whereConditions.push(`m.task_type = $${paramIndex++}`);
      params.push(taskType);
    }
    if (priority) {
      whereConditions.push(`m.priority = $${paramIndex++}`);
      params.push(priority);
    }
    if (assignedTo) {
      whereConditions.push(`m.assigned_to = $${paramIndex++}`);
      params.push(assignedTo);
    }

    const offset = (parseInt(page as string) - 1) * parseInt(perPage as string);
    const limit = parseInt(perPage as string);

    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*) FROM maintenance_tasks m WHERE ${whereConditions.join(' AND ')}`,
      params
    );

    const result = await query(
      `SELECT m.*, 
              s.name as site_name,
              a.name as asset_name,
              a.asset_tag,
              a.vendor as asset_vendor,
              u.name as assigned_to_name
       FROM maintenance_tasks m
       LEFT JOIN sites s ON m.site_id = s.id
       LEFT JOIN assets a ON m.asset_id = a.id
       LEFT JOIN users u ON m.assigned_to = u.id
       WHERE ${whereConditions.join(' AND ')}
       ORDER BY 
         CASE m.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
         m.due_date ASC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      [...params, limit, offset]
    );

    res.json({
      success: true,
      data: result.rows.map(row => ({
        id: row.id,
        siteId: row.site_id,
        siteName: row.site_name,
        assetId: row.asset_id,
        assetName: row.asset_name,
        assetTag: row.asset_tag,
        assetVendor: row.asset_vendor,
        title: row.title,
        description: row.description,
        taskType: row.task_type,
        priority: row.priority,
        status: row.status,
        scheduledDate: row.scheduled_date,
        dueDate: row.due_date,
        completedDate: row.completed_date,
        assignedTo: row.assigned_to,
        assignedToName: row.assigned_to_name,
        assignedTeam: row.assigned_team,
        oemServiceRequired: row.oem_service_required,
        oemVendor: row.oem_vendor,
        workOrderId: row.work_order_id,
        estimatedDurationHours: row.estimated_duration_hours,
        actualDurationHours: row.actual_duration_hours,
        checklist: row.checklist,
        notes: row.notes,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      })),
      meta: {
        page: parseInt(page as string),
        perPage: limit,
        total: parseInt(countResult.rows[0].count),
        totalPages: Math.ceil(parseInt(countResult.rows[0].count) / limit)
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get upcoming maintenance summary
maintenanceRoutes.get('/upcoming', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { days = '30' } = req.query;

    const result = await query(
      `SELECT 
        COUNT(*) FILTER (WHERE status = 'scheduled') as scheduled,
        COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
        COUNT(*) FILTER (WHERE status = 'overdue') as overdue,
        COUNT(*) FILTER (WHERE oem_service_required = true AND status IN ('scheduled', 'in_progress')) as oem_required
       FROM maintenance_tasks
       WHERE organization_id = $1
       AND due_date <= NOW() + INTERVAL '${parseInt(days as string)} days'
       AND status NOT IN ('completed', 'cancelled')`,
      [req.user!.organizationId]
    );

    res.json({
      success: true,
      data: {
        scheduled: parseInt(result.rows[0].scheduled) || 0,
        inProgress: parseInt(result.rows[0].in_progress) || 0,
        overdue: parseInt(result.rows[0].overdue) || 0,
        oemRequired: parseInt(result.rows[0].oem_required) || 0
      }
    });
  } catch (error) {
    next(error);
  }
});

// Create maintenance task
maintenanceRoutes.post('/', authorize(UserRole.ADMIN, UserRole.ASSET_MANAGER, UserRole.RELIABILITY_ENGINEER), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = createMaintenanceSchema.parse(req.body);
    const id = uuidv4();

    // Prepare checklist
    const checklist = data.checklist?.map(item => ({
      id: uuidv4(),
      description: item.description,
      isCompleted: false
    })) || [];

    const result = await query(
      `INSERT INTO maintenance_tasks (
        id, organization_id, site_id, asset_id, title, description, task_type, priority,
        status, scheduled_date, due_date, assigned_to, assigned_team, oem_service_required,
        oem_vendor, estimated_duration_hours, checklist
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'scheduled', $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *`,
      [
        id,
        req.user!.organizationId,
        data.siteId,
        data.assetId,
        data.title,
        data.description || null,
        data.taskType,
        data.priority,
        data.scheduledDate,
        data.dueDate,
        data.assignedTo || null,
        data.assignedTeam || null,
        data.oemServiceRequired,
        data.oemVendor || null,
        data.estimatedDurationHours || null,
        JSON.stringify(checklist)
      ]
    );

    // Log audit entry
    await logAudit({
      tenantId: req.user!.tenantId,
      userId: req.user!.userId,
      action: AuditActions.MAINTENANCE_CREATED,
      entityType: 'maintenance_task',
      entityId: id,
      newValues: { title: data.title, assetId: data.assetId, assignedTo: data.assignedTo, priority: data.priority },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// Update maintenance task status
maintenanceRoutes.patch('/:id/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { status, notes, actualDurationHours } = req.body;

    if (!Object.values(MaintenanceStatus).includes(status)) {
      badRequest('Invalid status');
    }

    // Get old status for audit log
    const oldTask = await query<{ status: string; title: string }>(
      'SELECT status, title FROM maintenance_tasks WHERE id = $1 AND organization_id = $2',
      [id, req.user!.organizationId]
    );
    const oldStatus = oldTask.rows[0]?.status;

    const updates: string[] = ['status = $1', 'updated_at = NOW()'];
    const params: unknown[] = [status];
    let paramIndex = 2;

    if (status === MaintenanceStatus.COMPLETED) {
      updates.push(`completed_date = NOW()`);
    }
    if (notes) {
      updates.push(`notes = $${paramIndex++}`);
      params.push(notes);
    }
    if (actualDurationHours !== undefined) {
      updates.push(`actual_duration_hours = $${paramIndex++}`);
      params.push(actualDurationHours);
    }

    params.push(id, req.user!.organizationId);

    const result = await query(
      `UPDATE maintenance_tasks SET ${updates.join(', ')}
       WHERE id = $${paramIndex++} AND organization_id = $${paramIndex}
       RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      notFound('Maintenance task');
    }

    // Log audit entry
    const action = status === 'completed' ? AuditActions.MAINTENANCE_COMPLETED : AuditActions.MAINTENANCE_STATUS_CHANGED;
    await logAudit({
      tenantId: req.user!.tenantId,
      userId: req.user!.userId,
      action,
      entityType: 'maintenance_task',
      entityId: id,
      oldValues: { status: oldStatus },
      newValues: { status, notes, actualDurationHours },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// Update checklist item
maintenanceRoutes.patch('/:id/checklist/:itemId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id, itemId } = req.params;
    const { isCompleted, notes } = req.body;

    // Get current task
    const taskResult = await query<{ checklist: string }>(
      'SELECT checklist FROM maintenance_tasks WHERE id = $1 AND organization_id = $2',
      [id, req.user!.organizationId]
    );

    if (taskResult.rows.length === 0) {
      notFound('Maintenance task');
    }

    const checklist = JSON.parse(taskResult.rows[0].checklist || '[]');
    const itemIndex = checklist.findIndex((item: { id: string }) => item.id === itemId);

    if (itemIndex === -1) {
      notFound('Checklist item');
    }

    checklist[itemIndex] = {
      ...checklist[itemIndex],
      isCompleted: isCompleted ?? checklist[itemIndex].isCompleted,
      completedAt: isCompleted ? new Date().toISOString() : null,
      completedBy: isCompleted ? req.user!.userId : null,
      notes: notes ?? checklist[itemIndex].notes
    };

    await query(
      'UPDATE maintenance_tasks SET checklist = $1, updated_at = NOW() WHERE id = $2',
      [JSON.stringify(checklist), id]
    );

    res.json({ success: true, data: { checklistItem: checklist[itemIndex] } });
  } catch (error) {
    next(error);
  }
});

// Delete maintenance task
maintenanceRoutes.delete('/:id', authorize(UserRole.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // Get task info for audit log before deleting
    const taskInfo = await query<{ title: string; status: string }>(
      'SELECT title, status FROM maintenance_tasks WHERE id = $1 AND organization_id = $2',
      [id, req.user!.organizationId]
    );

    const result = await query(
      'DELETE FROM maintenance_tasks WHERE id = $1 AND organization_id = $2 RETURNING id',
      [id, req.user!.organizationId]
    );

    if (result.rows.length === 0) {
      notFound('Maintenance task');
    }

    // Log audit entry
    await logAudit({
      tenantId: req.user!.tenantId,
      userId: req.user!.userId,
      action: AuditActions.MAINTENANCE_DELETED,
      entityType: 'maintenance_task',
      entityId: id,
      oldValues: taskInfo.rows[0] ? { title: taskInfo.rows[0].title, status: taskInfo.rows[0].status } : undefined,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.json({ success: true, data: { id } });
  } catch (error) {
    next(error);
  }
});
