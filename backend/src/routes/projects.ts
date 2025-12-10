import express, { Request, Response } from 'express';
import { pool } from '../config/database';

const router = express.Router();

/**
 * GET /api/projects
 * Get all projects
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query(`
      SELECT 
        p.id,
        p.name,
        p.description,
        p.status,
        p.priority,
        p.start_date as "startDate",
        p.end_date as "endDate",
        p.budget,
        p.location,
        p.client_name as "clientName",
        p.manager_id as "managerId",
        u.display_name as "managerName",
        p.progress,
        p.created_by as "createdBy",
        p.created_at as "createdAt"
      FROM projects p
      LEFT JOIN users u ON p.manager_id = u.id
      WHERE p.deleted_at IS NULL
      ORDER BY p.created_at DESC
    `);

    // Get project stages for each project
    const projectsWithStages = await Promise.all(
      result.rows.map(async (project) => {
        const stagesResult = await pool.query(`
          SELECT 
            id,
            project_id as "projectId",
            name,
            description,
            stage_order as "order",
            status,
            progress,
            start_date as "startDate",
            end_date as "endDate",
            created_at as "createdAt"
          FROM project_stages
          WHERE project_id = $1
          ORDER BY stage_order
        `, [project.id]);

        return {
          ...project,
          stages: stagesResult.rows,
          teamIds: [] // TODO: Get team IDs from project_teams table
        };
      })
    );

    res.json(projectsWithStages);
  } catch (error: any) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/projects/:id
 * Get a single project by ID
 */
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      SELECT 
        p.id,
        p.name,
        p.description,
        p.status,
        p.priority,
        p.start_date as "startDate",
        p.end_date as "endDate",
        p.budget,
        p.location,
        p.client_name as "clientName",
        p.manager_id as "managerId",
        u.display_name as "managerName",
        p.progress,
        p.created_by as "createdBy",
        p.created_at as "createdAt"
      FROM projects p
      LEFT JOIN users u ON p.manager_id = u.id
      WHERE p.id = $1 AND p.deleted_at IS NULL
    `, [id]);

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    const project = result.rows[0];

    // Get project stages
    const stagesResult = await pool.query(`
      SELECT 
        id,
        project_id as "projectId",
        name,
        description,
        stage_order as "order",
        status,
        progress,
        start_date as "startDate",
        end_date as "endDate",
        created_at as "createdAt"
      FROM project_stages
      WHERE project_id = $1
      ORDER BY stage_order
    `, [id]);

    // Get project teams
    const teamsResult = await pool.query(`
      SELECT team_id as "teamId"
      FROM project_teams
      WHERE project_id = $1
    `, [id]);

    res.json({
      ...project,
      stages: stagesResult.rows,
      teamIds: teamsResult.rows.map((r: any) => r.teamId)
    });
  } catch (error: any) {
    console.error('Error fetching project:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/projects
 * Create a new project
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      name,
      description,
      status = 'planning',
      priority = 'medium',
      startDate,
      endDate,
      budget,
      location,
      clientName,
      managerId,
      progress = 0,
      createdBy,
      stages = []
    } = req.body;

    if (!name) {
      res.status(400).json({ error: 'Project name is required' });
      return;
    }

    const result = await pool.query(`
      INSERT INTO projects (
        name, description, status, priority, start_date, end_date, budget,
        location, client_name, manager_id, progress, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `, [
      name, description, status, priority, startDate || null, endDate || null,
      budget || null, location || null, clientName || null, managerId || null,
      progress, createdBy || null
    ]);

    const projectId = result.rows[0].id;

    // Create project stages if provided
    if (stages && stages.length > 0) {
      for (const stage of stages) {
        await pool.query(`
          INSERT INTO project_stages (
            project_id, name, stage_order, status, progress
          )
          VALUES ($1, $2, $3, $4, $5)
        `, [
          projectId,
          stage.name,
          stage.order,
          stage.status || 'pending',
          stage.progress || 0
        ]);
      }
    }

    // Fetch the complete project with stages
    const projectResult = await pool.query(`
      SELECT 
        p.id,
        p.name,
        p.description,
        p.status,
        p.priority,
        p.start_date as "startDate",
        p.end_date as "endDate",
        p.budget,
        p.location,
        p.client_name as "clientName",
        p.manager_id as "managerId",
        u.display_name as "managerName",
        p.progress,
        p.created_by as "createdBy",
        p.created_at as "createdAt"
      FROM projects p
      LEFT JOIN users u ON p.manager_id = u.id
      WHERE p.id = $1
    `, [projectId]);

    const stagesResult = await pool.query(`
      SELECT 
        id,
        project_id as "projectId",
        name,
        description,
        stage_order as "order",
        status,
        progress,
        start_date as "startDate",
        end_date as "endDate",
        created_at as "createdAt"
      FROM project_stages
      WHERE project_id = $1
      ORDER BY stage_order
    `, [projectId]);

    res.status(201).json({
      ...projectResult.rows[0],
      stages: stagesResult.rows,
      teamIds: []
    });
  } catch (error: any) {
    console.error('Error creating project:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/projects/:id
 * Update a project
 */
router.put('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      status,
      priority,
      startDate,
      endDate,
      budget,
      location,
      clientName,
      managerId,
      progress
    } = req.body;

    const result = await pool.query(`
      UPDATE projects
      SET 
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        status = COALESCE($3, status),
        priority = COALESCE($4, priority),
        start_date = COALESCE($5, start_date),
        end_date = COALESCE($6, end_date),
        budget = COALESCE($7, budget),
        location = COALESCE($8, location),
        client_name = COALESCE($9, client_name),
        manager_id = COALESCE($10, manager_id),
        progress = COALESCE($11, progress),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $12 AND deleted_at IS NULL
      RETURNING *
    `, [
      name, description, status, priority, startDate, endDate,
      budget, location, clientName, managerId, progress, id
    ]);

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    console.error('Error updating project:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/projects/:id
 * Soft delete a project
 */
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      UPDATE projects
      SET deleted_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING id
    `, [id]);

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    res.status(204).send();
  } catch (error: any) {
    console.error('Error deleting project:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;

