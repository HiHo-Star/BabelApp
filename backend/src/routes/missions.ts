import express, { Request, Response } from 'express';
import { pool } from '../config/database';

const router = express.Router();

/**
 * GET /api/missions
 * Get all missions with optional filters
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId, status } = req.query;

    let query = `
      SELECT 
        m.id,
        m.name,
        m.description,
        m.project_id as "projectId",
        p.name as "projectName",
        m.stage_id as "stageId",
        ps.name as "projectPhase",
        m.status,
        m.priority,
        m.start_date as "startDate",
        m.end_date as "endDate",
        m.progress,
        m.created_by as "createdBy",
        m.created_at as "createdAt"
      FROM missions m
      LEFT JOIN projects p ON m.project_id = p.id
      LEFT JOIN project_stages ps ON m.stage_id = ps.id
      WHERE m.deleted_at IS NULL
    `;

    const params: any[] = [];
    let paramCount = 1;

    if (projectId) {
      query += ` AND m.project_id = $${paramCount++}`;
      params.push(projectId);
    }

    if (status) {
      query += ` AND m.status = $${paramCount++}`;
      params.push(status);
    }

    query += ` ORDER BY m.created_at DESC`;

    const result = await pool.query(query, params);

    // Get tasks for each mission
    const missionsWithTasks = await Promise.all(
      result.rows.map(async (mission: any) => {
        const tasksResult = await pool.query(`
          SELECT 
            t.id,
            t.title as name,
            t.description,
            t.status,
            t.priority,
            t.start_date as "startDate",
            t.due_date as "endDate",
            t.estimated_hours as "estimatedHours",
            t.actual_hours as "actualHours",
            t.progress,
            t.task_type as "taskType",
            t.assignee_id as "assigneeId",
            u.display_name as "assigneeName",
            ps.name as "projectPhase"
          FROM tasks t
          LEFT JOIN users u ON t.assignee_id = u.id
          LEFT JOIN project_stages ps ON t.stage_id = ps.id
          WHERE t.mission_id = $1 AND t.deleted_at IS NULL AND t.task_type = 'task'
          ORDER BY t.created_at
        `, [mission.id]);

        return {
          ...mission,
          tasks: tasksResult.rows.map((task: any) => ({
            id: task.id,
            missionId: mission.id,
            name: task.name,
            description: task.description,
            projectPhase: task.projectPhase,
            startDate: task.startDate,
            endDate: task.endDate,
            status: task.status,
            priority: task.priority,
            progress: task.progress,
            estimatedHours: task.estimatedHours ? parseFloat(task.estimatedHours) : null,
            actualHours: task.actualHours ? parseFloat(task.actualHours) : null,
            assignments: task.assigneeId ? [
              {
                type: 'user',
                id: task.assigneeId,
                name: task.assigneeName || 'Unknown',
                avatarUrl: ''
              }
            ] : [],
            subtasks: [],
            jobs: [],
            createdBy: mission.createdBy,
            createdAt: mission.createdAt
          })),
          jobs: []
        };
      })
    );

    res.json(missionsWithTasks);
  } catch (error: any) {
    console.error('Error fetching missions:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/missions/:id
 * Get a single mission by ID
 */
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      SELECT 
        m.id,
        m.name,
        m.description,
        m.project_id as "projectId",
        p.name as "projectName",
        m.stage_id as "stageId",
        ps.name as "projectPhase",
        m.status,
        m.priority,
        m.start_date as "startDate",
        m.end_date as "endDate",
        m.progress,
        m.created_by as "createdBy",
        m.created_at as "createdAt"
      FROM missions m
      LEFT JOIN projects p ON m.project_id = p.id
      LEFT JOIN project_stages ps ON m.stage_id = ps.id
      WHERE m.id = $1 AND m.deleted_at IS NULL
    `, [id]);

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Mission not found' });
      return;
    }

    const mission = result.rows[0];

    // Get tasks
    const tasksResult = await pool.query(`
      SELECT 
        t.id,
        t.title as name,
        t.description,
        t.status,
        t.priority,
        t.start_date as "startDate",
        t.due_date as "endDate",
        t.estimated_hours as "estimatedHours",
        t.actual_hours as "actualHours",
        t.progress,
        t.task_type as "taskType",
        t.assignee_id as "assigneeId",
        u.display_name as "assigneeName",
        ps.name as "projectPhase"
      FROM tasks t
      LEFT JOIN users u ON t.assignee_id = u.id
      LEFT JOIN project_stages ps ON t.stage_id = ps.id
      WHERE t.mission_id = $1 AND t.deleted_at IS NULL AND t.task_type = 'task'
      ORDER BY t.created_at
    `, [id]);

    res.json({
      ...mission,
      tasks: tasksResult.rows,
      jobs: []
    });
  } catch (error: any) {
    console.error('Error fetching mission:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/missions
 * Create a new mission
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      name,
      description,
      projectId,
      stageId,
      status = 'not-started',
      priority = 'medium',
      startDate,
      endDate,
      progress = 0,
      createdBy
    } = req.body;

    if (!name || !projectId) {
      res.status(400).json({ error: 'Mission name and project ID are required' });
      return;
    }

    const result = await pool.query(`
      INSERT INTO missions (
        name, description, project_id, stage_id, status, priority,
        start_date, end_date, progress, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [
      name, description, projectId, stageId || null, status, priority,
      startDate || null, endDate || null, progress, createdBy || null
    ]);

    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    console.error('Error creating mission:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/missions/:id
 * Update a mission
 */
router.put('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      projectId,
      stageId,
      status,
      priority,
      startDate,
      endDate,
      progress
    } = req.body;

    const result = await pool.query(`
      UPDATE missions
      SET 
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        project_id = COALESCE($3, project_id),
        stage_id = COALESCE($4, stage_id),
        status = COALESCE($5, status),
        priority = COALESCE($6, priority),
        start_date = COALESCE($7, start_date),
        end_date = COALESCE($8, end_date),
        progress = COALESCE($9, progress),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $10 AND deleted_at IS NULL
      RETURNING *
    `, [
      name, description, projectId, stageId, status, priority,
      startDate, endDate, progress, id
    ]);

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Mission not found' });
      return;
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    console.error('Error updating mission:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/missions/:id
 * Soft delete a mission
 */
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      UPDATE missions
      SET deleted_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING id
    `, [id]);

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Mission not found' });
      return;
    }

    res.status(204).send();
  } catch (error: any) {
    console.error('Error deleting mission:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;

