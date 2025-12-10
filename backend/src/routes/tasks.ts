import express, { Request, Response } from 'express';
import { pool } from '../config/database';

const router = express.Router();

/**
 * GET /api/tasks
 * Get all tasks with optional filters
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId, missionId, status, taskType } = req.query;

    let query = `
      SELECT 
        t.id,
        t.title as name,
        t.description,
        t.status,
        t.priority,
        t.project_id as "projectId",
        p.name as "projectName",
        t.mission_id as "missionId",
        m.name as "missionName",
        t.stage_id as "stageId",
        ps.name as "projectPhase",
        t.start_date as "startDate",
        t.due_date as "endDate",
        t.estimated_hours as "estimatedHours",
        t.actual_hours as "actualHours",
        t.progress,
        t.task_type as "taskType",
        t.is_retrospective as "isRetrospective",
        t.assignee_id as "assigneeId",
        u.display_name as "assigneeName",
        t.created_by as "createdBy",
        t.created_at as "createdAt",
        t.completed_at as "completedAt",
        t.tags
      FROM tasks t
      LEFT JOIN projects p ON t.project_id = p.id
      LEFT JOIN missions m ON t.mission_id = m.id
      LEFT JOIN project_stages ps ON t.stage_id = ps.id
      LEFT JOIN users u ON t.assignee_id = u.id
      WHERE t.deleted_at IS NULL
    `;

    const params: any[] = [];
    let paramCount = 1;

    if (projectId) {
      query += ` AND t.project_id = $${paramCount++}`;
      params.push(projectId);
    }

    if (missionId) {
      query += ` AND t.mission_id = $${paramCount++}`;
      params.push(missionId);
    }

    if (status) {
      query += ` AND t.status = $${paramCount++}`;
      params.push(status);
    }

    if (taskType) {
      query += ` AND t.task_type = $${paramCount++}`;
      params.push(taskType);
    }

    query += ` ORDER BY t.created_at DESC`;

    const result = await pool.query(query, params);

    // Transform to match frontend format
    const tasks = result.rows.map((task: any) => ({
      id: task.id,
      name: task.name,
      description: task.description,
      status: task.status,
      priority: task.priority,
      projectId: task.projectId,
      projectName: task.projectName,
      missionId: task.missionId,
      missionName: task.missionName,
      projectPhase: task.projectPhase,
      startDate: task.startDate,
      endDate: task.endDate,
      estimatedHours: task.estimatedHours ? parseFloat(task.estimatedHours) : null,
      actualHours: task.actualHours ? parseFloat(task.actualHours) : null,
      progress: task.progress,
      taskType: task.taskType,
      isRetrospective: task.isRetrospective,
      assigneeId: task.assigneeId,
      assigneeName: task.assigneeName,
      createdBy: task.createdBy,
      createdAt: task.createdAt,
      completedAt: task.completedAt,
      tags: task.tags || [],
      assignments: task.assigneeId ? [
        {
          type: 'user',
          id: task.assigneeId,
          name: task.assigneeName || 'Unknown',
          avatarUrl: ''
        }
      ] : [],
      subtasks: [],
      jobs: []
    }));

    res.json(tasks);
  } catch (error: any) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/tasks/:id
 * Get a single task by ID
 */
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      SELECT 
        t.id,
        t.title as name,
        t.description,
        t.status,
        t.priority,
        t.project_id as "projectId",
        p.name as "projectName",
        t.mission_id as "missionId",
        m.name as "missionName",
        t.stage_id as "stageId",
        ps.name as "projectPhase",
        t.start_date as "startDate",
        t.due_date as "endDate",
        t.estimated_hours as "estimatedHours",
        t.actual_hours as "actualHours",
        t.progress,
        t.task_type as "taskType",
        t.is_retrospective as "isRetrospective",
        t.assignee_id as "assigneeId",
        u.display_name as "assigneeName",
        t.created_by as "createdBy",
        t.created_at as "createdAt",
        t.completed_at as "completedAt",
        t.tags
      FROM tasks t
      LEFT JOIN projects p ON t.project_id = p.id
      LEFT JOIN missions m ON t.mission_id = m.id
      LEFT JOIN project_stages ps ON t.stage_id = ps.id
      LEFT JOIN users u ON t.assignee_id = u.id
      WHERE t.id = $1 AND t.deleted_at IS NULL
    `, [id]);

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    const task = result.rows[0];

    // Get subtasks (tasks with task_type = 'subtask' and same mission)
    const subtasksResult = await pool.query(`
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
        t.assignee_id as "assigneeId",
        u.display_name as "assigneeName",
        t.created_by as "createdBy",
        t.created_at as "createdAt"
      FROM tasks t
      LEFT JOIN users u ON t.assignee_id = u.id
      WHERE t.mission_id = $1 
        AND t.task_type = 'subtask'
        AND t.deleted_at IS NULL
      ORDER BY t.created_at
    `, [task.missionId]);

    // Get jobs (tasks with task_type = 'job' and same mission)
    const jobsResult = await pool.query(`
      SELECT 
        t.id,
        t.title as name,
        t.description,
        t.status,
        t.priority,
        t.start_date as "startDate",
        t.due_date as "endDate",
        t.actual_hours as "actualHours",
        t.is_retrospective as "isPlanned",
        t.assignee_id as "assigneeId",
        u.display_name as "assigneeName",
        t.created_by as "createdBy",
        t.created_at as "createdAt",
        t.completed_at as "completedAt"
      FROM tasks t
      LEFT JOIN users u ON t.assignee_id = u.id
      WHERE t.mission_id = $1 
        AND t.task_type = 'job'
        AND t.deleted_at IS NULL
      ORDER BY t.created_at
    `, [task.missionId]);

    res.json({
      id: task.id,
      name: task.name,
      description: task.description,
      status: task.status,
      priority: task.priority,
      projectId: task.projectId,
      projectName: task.projectName,
      missionId: task.missionId,
      missionName: task.missionName,
      projectPhase: task.projectPhase,
      startDate: task.startDate,
      endDate: task.endDate,
      estimatedHours: task.estimatedHours ? parseFloat(task.estimatedHours) : null,
      actualHours: task.actualHours ? parseFloat(task.actualHours) : null,
      progress: task.progress,
      taskType: task.taskType,
      isRetrospective: task.isRetrospective,
      assigneeId: task.assigneeId,
      assigneeName: task.assigneeName,
      createdBy: task.createdBy,
      createdAt: task.createdAt,
      completedAt: task.completedAt,
      tags: task.tags || [],
      assignments: task.assigneeId ? [
        {
          type: 'user',
          id: task.assigneeId,
          name: task.assigneeName || 'Unknown',
          avatarUrl: ''
        }
      ] : [],
      subtasks: subtasksResult.rows.map((st: any) => ({
        id: st.id,
        taskId: task.id,
        name: st.name,
        description: st.description,
        startDate: st.startDate,
        endDate: st.endDate,
        status: st.status,
        priority: st.priority,
        progress: st.progress,
        estimatedHours: st.estimatedHours ? parseFloat(st.estimatedHours) : null,
        actualHours: st.actualHours ? parseFloat(st.actualHours) : null,
        assignments: st.assigneeId ? [
          {
            type: 'user',
            id: st.assigneeId,
            name: st.assigneeName || 'Unknown',
            avatarUrl: ''
          }
        ] : [],
        jobs: [],
        createdBy: st.createdBy,
        createdAt: st.createdAt
      })),
      jobs: jobsResult.rows.map((job: any) => ({
        id: job.id,
        parentType: 'task',
        parentId: task.id,
        name: job.name,
        date: job.startDate,
        duration: job.actualHours ? parseFloat(job.actualHours) : null,
        status: job.status,
        priority: job.priority,
        assignments: job.assigneeId ? [
          {
            type: 'user',
            id: job.assigneeId,
            name: job.assigneeName || 'Unknown',
            avatarUrl: ''
          }
        ] : [],
        isPlanned: !job.isPlanned,
        createdBy: job.createdBy,
        createdAt: job.createdAt,
        completedAt: job.completedAt
      }))
    });
  } catch (error: any) {
    console.error('Error fetching task:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/tasks
 * Create a new task
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      name,
      description,
      status = 'todo',
      priority = 'medium',
      projectId,
      missionId,
      stageId,
      startDate,
      endDate,
      estimatedHours,
      actualHours,
      progress = 0,
      taskType = 'task',
      isRetrospective = false,
      assigneeId,
      createdBy,
      tags = []
    } = req.body;

    if (!name) {
      res.status(400).json({ error: 'Task name is required' });
      return;
    }

    const result = await pool.query(`
      INSERT INTO tasks (
        title, description, status, priority, project_id, mission_id, stage_id,
        start_date, due_date, estimated_hours, actual_hours, progress,
        task_type, is_retrospective, assignee_id, created_by, tags
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING *
    `, [
      name, description, status, priority, projectId || null, missionId || null, stageId || null,
      startDate || null, endDate || null, estimatedHours || null, actualHours || null, progress,
      taskType, isRetrospective, assigneeId || null, createdBy || null, tags
    ]);

    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    console.error('Error creating task:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/tasks/:id
 * Update a task
 */
router.put('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      status,
      priority,
      projectId,
      missionId,
      stageId,
      startDate,
      endDate,
      estimatedHours,
      actualHours,
      progress,
      taskType,
      isRetrospective,
      assigneeId,
      tags
    } = req.body;

    const result = await pool.query(`
      UPDATE tasks
      SET 
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        status = COALESCE($3, status),
        priority = COALESCE($4, priority),
        project_id = COALESCE($5, project_id),
        mission_id = COALESCE($6, mission_id),
        stage_id = COALESCE($7, stage_id),
        start_date = COALESCE($8, start_date),
        due_date = COALESCE($9, due_date),
        estimated_hours = COALESCE($10, estimated_hours),
        actual_hours = COALESCE($11, actual_hours),
        progress = COALESCE($12, progress),
        task_type = COALESCE($13, task_type),
        is_retrospective = COALESCE($14, is_retrospective),
        assignee_id = COALESCE($15, assignee_id),
        tags = COALESCE($16, tags),
        updated_at = CURRENT_TIMESTAMP,
        completed_at = CASE WHEN $3 = 'done' AND status != 'done' THEN CURRENT_TIMESTAMP ELSE completed_at END
      WHERE id = $17 AND deleted_at IS NULL
      RETURNING *
    `, [
      name, description, status, priority, projectId, missionId, stageId,
      startDate, endDate, estimatedHours, actualHours, progress,
      taskType, isRetrospective, assigneeId, tags, id
    ]);

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    console.error('Error updating task:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/tasks/:id
 * Soft delete a task
 */
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      UPDATE tasks
      SET deleted_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING id
    `, [id]);

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    res.status(204).send();
  } catch (error: any) {
    console.error('Error deleting task:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;

