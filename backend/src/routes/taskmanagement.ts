/**
 * TaskManagement Agent API Routes
 * Provides data endpoints for TaskManagement-agent to poll and process task-related requests
 */

import express, { Request, Response } from 'express';
import { pool } from '../config/database';
import { taskManagementService } from '../services/taskmanagement';

const router = express.Router();

/**
 * GET /api/taskmanagement/data
 * Returns all data needed by TaskManagement-agent for task extraction and processing
 * This endpoint is polled by the agent service to get current state
 */
router.get('/data', async (req: Request, res: Response): Promise<void> => {
  try {
    // Get all projects
    const projectsResult = await pool.query(`
      SELECT id, name, description, status, priority, location, manager_id, progress
      FROM projects
      WHERE deleted_at IS NULL
      ORDER BY name
    `).catch((err) => {
      console.error('Error fetching projects:', err);
      return { rows: [] };
    });

    // Get all project stages
    const stagesResult = await pool.query(`
      SELECT id, project_id, name, description, stage_order, status, progress
      FROM project_stages
      ORDER BY project_id, stage_order
    `).catch((err) => {
      console.error('Error fetching project stages:', err);
      return { rows: [] };
    });

    // Get all missions
    // Try with deleted_at first, fallback without if column doesn't exist
    let missionsResult;
    try {
      missionsResult = await pool.query(`
        SELECT id, name, description, project_id, stage_id, status, priority, progress
        FROM missions
        WHERE deleted_at IS NULL
        ORDER BY name
      `);
    } catch (err: any) {
      if (err.code === '42703' && err.message.includes('deleted_at')) {
        // deleted_at doesn't exist, select all
        missionsResult = await pool.query(`
          SELECT id, name, description, project_id, stage_id, status, priority, progress
          FROM missions
          ORDER BY name
        `);
      } else {
        console.error('Error fetching missions:', err);
        missionsResult = { rows: [] };
      }
    }

    // Get all departments
    // Note: columns may not exist in all database versions
    // Try with deleted_at first, fallback without if column doesn't exist
    let departmentsResult;
    try {
      departmentsResult = await pool.query(`
        SELECT id, name, description
        FROM departments
        WHERE deleted_at IS NULL AND is_active = true
        ORDER BY name
      `);
    } catch (err: any) {
      if (err.code === '42703' && err.message.includes('deleted_at')) {
        // deleted_at doesn't exist, try with is_active only
        try {
          departmentsResult = await pool.query(`
            SELECT id, name, description
            FROM departments
            WHERE is_active = true
            ORDER BY name
          `);
        } catch (err2: any) {
          // If is_active also doesn't exist, select all
          if (err2.code === '42703' && err2.message.includes('is_active')) {
            departmentsResult = await pool.query(`
              SELECT id, name, description
              FROM departments
              ORDER BY name
            `);
          } else {
            console.error('Error fetching departments:', err2);
            departmentsResult = { rows: [] };
          }
        }
      } else {
        console.error('Error fetching departments:', err);
        departmentsResult = { rows: [] };
      }
    }

    // Get all teams
    // Note: teams table may not exist in all database versions
    let teamsResult;
    try {
      teamsResult = await pool.query(`
        SELECT 
          t.id, 
          t.name, 
          t.description, 
          t.department_id,
          t.leader_id,
          d.name as department_name
        FROM teams t
        LEFT JOIN departments d ON t.department_id = d.id
        WHERE t.deleted_at IS NULL AND t.is_active = true
        ORDER BY t.name
      `);
    } catch (err: any) {
      if (err.code === '42703' && err.message.includes('deleted_at')) {
        // deleted_at doesn't exist, try with is_active only
        try {
          teamsResult = await pool.query(`
            SELECT 
              t.id, 
              t.name, 
              t.description, 
              t.department_id,
              t.leader_id,
              d.name as department_name
            FROM teams t
            LEFT JOIN departments d ON t.department_id = d.id
            WHERE t.is_active = true
            ORDER BY t.name
          `);
        } catch (err2: any) {
          // If is_active also doesn't exist or table doesn't exist, return empty
          console.error('Error fetching teams (table may not exist):', err2.message);
          teamsResult = { rows: [] };
        }
      } else if (err.code === '42P01') {
        // Table doesn't exist
        console.error('Error fetching teams (table may not exist):', err.message);
        teamsResult = { rows: [] };
      } else {
        console.error('Error fetching teams:', err);
        teamsResult = { rows: [] };
      }
    }

    // Get team members
    // Note: team_members table may not exist in all database versions
    let teamMembersResult;
    try {
      teamMembersResult = await pool.query(`
        SELECT 
          tm.team_id,
          tm.user_id,
          COALESCE(tm.role_in_team, tm.role, 'member') as role_in_team,
          u.display_name,
          u.job_title,
          COALESCE(u.department_id::text, u.department) as department_id
        FROM team_members tm
        JOIN users u ON tm.user_id = u.id
        WHERE u.deleted_at IS NULL
      `);
    } catch (err: any) {
      if (err.code === '42703' && err.message.includes('deleted_at')) {
        // deleted_at doesn't exist, try without it
        try {
          teamMembersResult = await pool.query(`
            SELECT 
              tm.team_id,
              tm.user_id,
              COALESCE(tm.role_in_team, tm.role, 'member') as role_in_team,
              u.display_name,
              u.job_title,
              COALESCE(u.department_id::text, u.department) as department_id
            FROM team_members tm
            JOIN users u ON tm.user_id = u.id
          `);
        } catch (err2: any) {
          // If department_id also doesn't exist or table doesn't exist
          if (err2.code === '42703' && err2.message.includes('department_id')) {
            try {
              teamMembersResult = await pool.query(`
                SELECT 
                  tm.team_id,
                  tm.user_id,
                  COALESCE(tm.role_in_team, tm.role, 'member') as role_in_team,
                  u.display_name,
                  u.job_title,
                  u.department as department_id
                FROM team_members tm
                JOIN users u ON tm.user_id = u.id
              `);
            } catch (err3: any) {
              // If role_in_team column doesn't exist, try with just role
              if (err3.code === '42703' && err3.message.includes('role_in_team')) {
                try {
                  teamMembersResult = await pool.query(`
                    SELECT 
                      tm.team_id,
                      tm.user_id,
                      COALESCE(tm.role, 'member') as role_in_team,
                      u.display_name,
                      u.job_title,
                      u.department as department_id
                    FROM team_members tm
                    JOIN users u ON tm.user_id = u.id
                  `);
                } catch (err4: any) {
                  console.error('Error fetching team members (table may not exist):', err4.message);
                  teamMembersResult = { rows: [] };
                }
              } else {
                console.error('Error fetching team members (table may not exist):', err3.message);
                teamMembersResult = { rows: [] };
              }
            }
          } else if (err2.code === '42703' && err2.message.includes('role_in_team')) {
            // role_in_team doesn't exist, try with role column
            try {
              teamMembersResult = await pool.query(`
                SELECT 
                  tm.team_id,
                  tm.user_id,
                  COALESCE(tm.role, 'member') as role_in_team,
                  u.display_name,
                  u.job_title,
                  COALESCE(u.department_id::text, u.department) as department_id
                FROM team_members tm
                JOIN users u ON tm.user_id = u.id
              `);
            } catch (err3: any) {
              console.error('Error fetching team members:', err3.message);
              teamMembersResult = { rows: [] };
            }
          } else if (err2.code === '42P01') {
            console.error('Error fetching team members (table may not exist):', err2.message);
            teamMembersResult = { rows: [] };
          } else {
            console.error('Error fetching team members:', err2);
            teamMembersResult = { rows: [] };
          }
        }
      } else if (err.code === '42703' && err.message.includes('role_in_team')) {
        // role_in_team doesn't exist, try with role column
        try {
          teamMembersResult = await pool.query(`
            SELECT 
              tm.team_id,
              tm.user_id,
              COALESCE(tm.role, 'member') as role_in_team,
              u.display_name,
              u.job_title,
              COALESCE(u.department_id::text, u.department) as department_id
            FROM team_members tm
            JOIN users u ON tm.user_id = u.id
            WHERE u.deleted_at IS NULL
          `);
        } catch (err2: any) {
          if (err2.code === '42703' && err2.message.includes('deleted_at')) {
            // Try without deleted_at
            try {
              teamMembersResult = await pool.query(`
                SELECT 
                  tm.team_id,
                  tm.user_id,
                  COALESCE(tm.role, 'member') as role_in_team,
                  u.display_name,
                  u.job_title,
                  COALESCE(u.department_id::text, u.department) as department_id
                FROM team_members tm
                JOIN users u ON tm.user_id = u.id
              `);
            } catch (err3: any) {
              console.error('Error fetching team members:', err3.message);
              teamMembersResult = { rows: [] };
            }
          } else {
            console.error('Error fetching team members:', err2.message);
            teamMembersResult = { rows: [] };
          }
        }
      } else if (err.code === '42P01') {
        console.error('Error fetching team members (table may not exist):', err.message);
        teamMembersResult = { rows: [] };
      } else {
        console.error('Error fetching team members:', err);
        teamMembersResult = { rows: [] };
      }
    }

    // Get all users with their skills and roles
    // Note: users table may use department (VARCHAR) instead of department_id (UUID)
    let usersResult;
    try {
      usersResult = await pool.query(`
        SELECT 
          u.id,
          u.username,
          u.display_name,
          u.job_title,
          COALESCE(u.department_id::text, u.department) as department_id,
          u.role,
          u.language,
          COALESCE(d.name, u.department) as department_name
        FROM users u
        LEFT JOIN departments d ON COALESCE(u.department_id::text, u.department) = d.id::text OR u.department = d.name
        WHERE u.deleted_at IS NULL
        ORDER BY u.display_name
      `);
    } catch (err: any) {
      if (err.code === '42703') {
        if (err.message.includes('deleted_at')) {
          // deleted_at doesn't exist, try without it
          try {
            usersResult = await pool.query(`
              SELECT 
                u.id,
                u.username,
                u.display_name,
                u.job_title,
                COALESCE(u.department_id::text, u.department) as department_id,
                u.role,
                u.language,
                COALESCE(d.name, u.department) as department_name
              FROM users u
              LEFT JOIN departments d ON COALESCE(u.department_id::text, u.department) = d.id::text OR u.department = d.name
              ORDER BY u.display_name
            `);
          } catch (err2: any) {
            // department_id also doesn't exist
            if (err2.code === '42703' && err2.message.includes('department_id')) {
              usersResult = await pool.query(`
                SELECT 
                  u.id,
                  u.username,
                  u.display_name,
                  u.job_title,
                  u.department as department_id,
                  u.role,
                  u.language,
                  COALESCE(d.name, u.department) as department_name
                FROM users u
                LEFT JOIN departments d ON u.department = d.name
                ORDER BY u.display_name
              `);
            } else {
              console.error('Error fetching users:', err2.message);
              usersResult = { rows: [] };
            }
          }
        } else if (err.message.includes('department_id')) {
          // department_id doesn't exist, try without deleted_at too since it likely doesn't exist either
          try {
            usersResult = await pool.query(`
              SELECT 
                u.id,
                u.username,
                u.display_name,
                u.job_title,
                u.department as department_id,
                u.role,
                u.language,
                COALESCE(d.name, u.department) as department_name
              FROM users u
              LEFT JOIN departments d ON u.department = d.name
              WHERE u.deleted_at IS NULL
              ORDER BY u.display_name
            `);
          } catch (err2: any) {
            // deleted_at also doesn't exist
            if (err2.code === '42703' && err2.message.includes('deleted_at')) {
              usersResult = await pool.query(`
                SELECT 
                  u.id,
                  u.username,
                  u.display_name,
                  u.job_title,
                  u.department as department_id,
                  u.role,
                  u.language,
                  COALESCE(d.name, u.department) as department_name
                FROM users u
                LEFT JOIN departments d ON u.department = d.name
                ORDER BY u.display_name
              `);
            } else {
              console.error('Error fetching users:', err2.message);
              usersResult = { rows: [] };
            }
          }
        } else {
          console.error('Error fetching users:', err.message);
          usersResult = { rows: [] };
        }
      } else {
        console.error('Error fetching users:', err.message);
        usersResult = { rows: [] };
      }
    }

    // Get user skills
    // Note: user_skills table may not exist in all database versions
    let skillsResult;
    try {
      skillsResult = await pool.query(`
        SELECT user_id, skill_name, COALESCE(skill_type, 'skill') as skill_type, description
        FROM user_skills
        ORDER BY user_id, skill_name
      `);
    } catch (err: any) {
      if (err.code === '42703' && err.message.includes('skill_type')) {
        // skill_type doesn't exist, try without it
        try {
          skillsResult = await pool.query(`
            SELECT user_id, skill_name, 'skill' as skill_type, description
            FROM user_skills
            ORDER BY user_id, skill_name
          `);
        } catch (err2: any) {
          console.error('Error fetching user skills (table may not exist):', err2.message);
          skillsResult = { rows: [] };
        }
      } else {
        console.error('Error fetching user skills (table may not exist):', err.message);
        skillsResult = { rows: [] };
      }
    }

    // Get recent tasks for context (last 100)
    const tasksResult = await pool.query(`
      SELECT 
        id,
        title,
        description,
        status,
        priority,
        task_type,
        mission_id,
        project_id,
        stage_id,
        assignee_id,
        due_date,
        start_date,
        is_retrospective,
        tags,
        estimated_hours,
        actual_hours
      FROM tasks
      WHERE deleted_at IS NULL
      ORDER BY created_at DESC
      LIMIT 100
    `).catch((err) => {
      console.error('Error fetching tasks:', err);
      return { rows: [] };
    });

    // Organize team members by team
    const teamMembersMap: { [teamId: string]: any[] } = {};
    teamMembersResult.rows.forEach((member: any) => {
      if (!teamMembersMap[member.team_id]) {
        teamMembersMap[member.team_id] = [];
      }
      teamMembersMap[member.team_id].push({
        userId: member.user_id,
        displayName: member.display_name,
        jobTitle: member.job_title,
        roleInTeam: member.role_in_team,
        departmentId: member.department_id
      });
    });

    // Organize skills by user
    const skillsMap: { [userId: string]: any[] } = {};
    skillsResult.rows.forEach((skill: any) => {
      if (!skillsMap[skill.user_id]) {
        skillsMap[skill.user_id] = [];
      }
      skillsMap[skill.user_id].push({
        name: skill.skill_name,
        type: skill.skill_type,
        description: skill.description
      });
    });

    // Add team members and skills to teams and users
    const teamsWithMembers = teamsResult.rows.map((team: any) => ({
      ...team,
      members: teamMembersMap[team.id] || []
    }));

    const usersWithSkills = usersResult.rows.map((user: any) => ({
      ...user,
      skills: skillsMap[user.id] || []
    }));

    // Organize stages by project
    const stagesByProject: { [projectId: string]: any[] } = {};
    stagesResult.rows.forEach((stage: any) => {
      if (!stagesByProject[stage.project_id]) {
        stagesByProject[stage.project_id] = [];
      }
      stagesByProject[stage.project_id].push(stage);
    });

    // Organize missions by project
    const missionsByProject: { [projectId: string]: any[] } = {};
    missionsResult.rows.forEach((mission: any) => {
      if (!missionsByProject[mission.project_id]) {
        missionsByProject[mission.project_id] = [];
      }
      missionsByProject[mission.project_id].push(mission);
    });

    res.json({
      success: true,
      data: {
        projects: projectsResult.rows,
        stages: stagesResult.rows,
        stagesByProject,
        missions: missionsResult.rows,
        missionsByProject,
        departments: departmentsResult.rows,
        teams: teamsWithMembers,
        users: usersWithSkills,
        tasks: tasksResult.rows,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error: any) {
    console.error('Error fetching TaskManagement data:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/taskmanagement/process
 * Process natural language input for task-related operations
 * This is called by Android app, which then forwards to TaskManagement-agent
 */
router.post('/process', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, text, language, context } = req.body;

    if (!userId || !text) {
      res.status(400).json({
        success: false,
        error: 'userId and text are required'
      });
      return;
    }

    // Forward to TaskManagement-agent service
    const result = await taskManagementService.process(
      userId,
      text,
      language,
      context
    );

    res.json({
      success: true,
      ...result
    });
  } catch (error: any) {
    console.error('Error processing TaskManagement request:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/taskmanagement/create-task
 * Create a new task from extracted task data
 * Called after user approves the extracted task
 */
router.post('/create-task', async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      title,
      description,
      taskType,
      priority,
      dueDate,
      startDate,
      estimatedHours,
      actualHours,
      suggestedTeamId,
      suggestedAssigneeId,
      missionId,
      projectId,
      stageId,
      tags,
      isRetrospective,
      createdBy
    } = req.body;

    if (!title || !createdBy) {
      res.status(400).json({
        success: false,
        error: 'title and createdBy are required'
      });
      return;
    }

    // Determine status based on retrospective flag
    const status = isRetrospective ? 'done' : 'todo';

    // Build insert query
    const insertQuery = `
      INSERT INTO tasks (
        title, description, status, priority, task_type,
        due_date, start_date, estimated_hours, actual_hours,
        assignee_id, mission_id, project_id, stage_id,
        tags, is_retrospective, created_by, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *
    `;

    const result = await pool.query(insertQuery, [
      title,
      description || null,
      status,
      priority || 'medium',
      taskType || 'task',
      dueDate || null,
      startDate || null,
      estimatedHours || null,
      actualHours || null,
      suggestedAssigneeId || null,
      missionId || null,
      projectId || null,
      stageId || null,
      tags || [],
      isRetrospective || false,
      createdBy
    ]);

    res.json({
      success: true,
      task: result.rows[0]
    });
  } catch (error: any) {
    console.error('Error creating task:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;

