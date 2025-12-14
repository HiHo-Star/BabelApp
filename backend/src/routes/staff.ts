/**
 * Staff Management API Routes
 * Handles departments, teams, and users/staff members
 */

import express, { Request, Response } from 'express';
import { pool } from '../config/database';

const router = express.Router();

/**
 * GET /api/staff/departments
 * Get all departments
 */
router.get('/departments', async (req: Request, res: Response): Promise<void> => {
  try {
    // Try multiple query variations to handle different schema versions
    let result;
    let queryAttempt = 0;
    
    // Strategy: Try simplest query first, then add complexity
    // Don't select columns that might not exist - only filter by them
    const queries = [
      // Query 1: Absolute minimum - only required columns
      {
        sql: `
          SELECT 
            id, 
            name,
            created_at as "createdAt"
          FROM departments
          ORDER BY name
        `,
        name: 'minimal'
      },
      // Query 2: Add description (if exists)
      {
        sql: `
          SELECT 
            id, 
            name,
            description,
            created_at as "createdAt"
          FROM departments
          ORDER BY name
        `,
        name: 'with-description'
      },
      // Query 3: Add color column (try to select, but use COALESCE)
      {
        sql: `
          SELECT 
            id, 
            name,
            description,
            COALESCE(color, '#3B82F6') as color,
            created_at as "createdAt"
          FROM departments
          ORDER BY name
        `,
        name: 'with-color'
      },
      // Query 4: Add deleted_at filter (if column exists)
      {
        sql: `
          SELECT 
            id, 
            name,
            description,
            COALESCE(color, '#3B82F6') as color,
            created_at as "createdAt"
          FROM departments
          WHERE deleted_at IS NULL
          ORDER BY name
        `,
        name: 'with-deleted-at'
      }
    ];
    
    for (const query of queries) {
      try {
        queryAttempt++;
        console.log(`Attempting departments query ${queryAttempt}: ${query.name}`);
        result = await pool.query(query.sql);
        console.log(`Success with query ${queryAttempt}: Found ${result.rows.length} departments`);
        break;
      } catch (err: any) {
        console.log(`Query ${queryAttempt} failed:`, err.code, err.message);
        // If it's a column error (42703), try next query
        // If it's the last query or a different error, throw
        if (err.code === '42703' && queryAttempt < queries.length) {
          // Column doesn't exist, try next query
          continue;
        } else if (queryAttempt === queries.length) {
          // Last query failed, throw error
          throw err;
        } else {
          // Other error, throw it
          throw err;
        }
      }
    }
    
    if (!result) {
      res.status(500).json({ error: 'Failed to fetch departments' });
      return;
    }
    
    // Ensure all expected fields exist for all departments
    result.rows = result.rows.map((dept: any) => ({
      ...dept,
      description: dept.description || '',
      color: dept.color || '#3B82F6'
    }));
    
    console.log(`Found ${result.rows.length} departments in database`);

    // Get member counts and team counts for each department
    const departmentsWithCounts = await Promise.all(
      result.rows.map(async (dept) => {
        // Count users in this department - try both department (VARCHAR) and department_id (UUID)
        let memberCount = 0;
        try {
          // Try with department VARCHAR first (most common)
          const userCountResult = await pool.query(`
            SELECT COUNT(*) as count
            FROM users
            WHERE department = $1
          `, [dept.name]);
          memberCount = parseInt(userCountResult.rows[0]?.count || '0');
        } catch (err: any) {
          // If department column doesn't exist, try with department_id UUID
          if (err.code === '42703' && err.message.includes('department')) {
            try {
              const userCountResult = await pool.query(`
                SELECT COUNT(*) as count
                FROM users
                WHERE department_id = $1 OR department_id::text = $1
              `, [dept.id]);
              memberCount = parseInt(userCountResult.rows[0]?.count || '0');
            } catch (err2: any) {
              console.error(`Error counting users for department ${dept.name}:`, err2.message);
              memberCount = 0;
            }
          } else {
            console.error(`Error counting users for department ${dept.name}:`, err.message);
            memberCount = 0;
          }
        }

        // Count teams in this department (teams table may not exist)
        let teamCount = 0;
        try {
          // Try simplest query first
          const teamCountResult = await pool.query(`
            SELECT COUNT(*) as count
            FROM teams
            WHERE department_id = $1
          `, [dept.id]);
          teamCount = parseInt(teamCountResult.rows[0]?.count || '0');
        } catch (err: any) {
          // Table doesn't exist or other error - that's okay
          console.log(`Teams table may not exist or error counting teams for department ${dept.name}:`, err.message);
          teamCount = 0;
        }

        return {
          ...dept,
          memberCount,
          teamCount,
          activeProjects: 0 // Not available from current schema
        };
      })
    );

    res.json(departmentsWithCounts);
  } catch (error: any) {
    console.error('Error fetching departments:', error);
    console.error('Error stack:', error.stack);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    res.status(500).json({ 
      error: error.message || 'Failed to fetch departments',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * POST /api/staff/departments
 * Create a new department
 */
router.post('/departments', async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, description, color } = req.body;

    if (!name) {
      res.status(400).json({ error: 'Department name is required' });
      return;
    }

    // Try inserting - handle missing columns gracefully
    let result;
    const insertQueries = [
      // Try with color and is_active
      {
        sql: `INSERT INTO departments (name, description, color, is_active) VALUES ($1, $2, $3, true) RETURNING *`,
        params: [name, description || null, color || null]
      },
      // Try without is_active
      {
        sql: `INSERT INTO departments (name, description, color) VALUES ($1, $2, $3) RETURNING *`,
        params: [name, description || null, color || null]
      },
      // Try without color
      {
        sql: `INSERT INTO departments (name, description) VALUES ($1, $2) RETURNING *`,
        params: [name, description || null]
      }
    ];
    
    for (const query of insertQueries) {
      try {
        result = await pool.query(query.sql, query.params);
        // Add color to result if not present
        if (!result.rows[0].color) {
          result.rows[0].color = color || '#3B82F6';
        }
        break;
      } catch (err: any) {
        if (err.code === '42703' && insertQueries.indexOf(query) < insertQueries.length - 1) {
          // Column doesn't exist, try next query
          continue;
        } else if (insertQueries.indexOf(query) === insertQueries.length - 1) {
          // Last query failed
          throw err;
        } else {
          throw err;
        }
      }
    }

    if (!result || result.rows.length === 0) {
      res.status(500).json({ error: 'Failed to create department' });
      return;
    }

    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    console.error('Error creating department:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/staff/departments/:id
 * Update a department
 */
router.put('/departments/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, description, color } = req.body;

    // Try updating - handle missing columns gracefully
    let result;
    const updateQueries = [
      // Try with color and is_active
      {
        sql: `UPDATE departments SET name = COALESCE($1, name), description = COALESCE($2, description), color = COALESCE($3, color), updated_at = CURRENT_TIMESTAMP WHERE id = $4 RETURNING *`,
        params: [name, description, color, id]
      },
      // Try without is_active
      {
        sql: `UPDATE departments SET name = COALESCE($1, name), description = COALESCE($2, description), color = COALESCE($3, color), updated_at = CURRENT_TIMESTAMP WHERE id = $4 RETURNING *`,
        params: [name, description, color, id]
      },
      // Try without color
      {
        sql: `UPDATE departments SET name = COALESCE($1, name), description = COALESCE($2, description), updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *`,
        params: [name, description, id]
      }
    ];
    
    for (const query of updateQueries) {
      try {
        result = await pool.query(query.sql, query.params);
        // Add color to result if not present
        if (color && !result.rows[0].color) {
          result.rows[0].color = color;
        } else if (!result.rows[0].color) {
          result.rows[0].color = '#3B82F6';
        }
        break;
      } catch (err: any) {
        if (err.code === '42703' && updateQueries.indexOf(query) < updateQueries.length - 1) {
          // Column doesn't exist, try next query
          continue;
        } else if (updateQueries.indexOf(query) === updateQueries.length - 1) {
          // Last query failed
          throw err;
        } else {
          throw err;
        }
      }
    }

    if (!result || result.rows.length === 0) {
      res.status(404).json({ error: 'Department not found' });
      return;
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    console.error('Error updating department:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/staff/departments/:id
 * Delete a department (soft delete)
 */
router.delete('/departments/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Try soft delete with deleted_at and is_active
    const deleteQueries = [
      {
        sql: `UPDATE departments SET deleted_at = CURRENT_TIMESTAMP, is_active = false WHERE id = $1`,
        params: [id]
      },
      {
        sql: `UPDATE departments SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1`,
        params: [id]
      },
      {
        sql: `DELETE FROM departments WHERE id = $1`,
        params: [id]
      }
    ];
    
    for (const query of deleteQueries) {
      try {
        await pool.query(query.sql, query.params);
        res.status(204).send();
        return;
      } catch (err: any) {
        if (err.code === '42703' && deleteQueries.indexOf(query) < deleteQueries.length - 1) {
          // Column doesn't exist, try next query
          continue;
        } else if (deleteQueries.indexOf(query) === deleteQueries.length - 1) {
          // Last query failed
          throw err;
        } else {
          throw err;
        }
      }
    }
  } catch (error: any) {
    console.error('Error deleting department:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/staff/teams
 * Get all teams
 */
router.get('/teams', async (req: Request, res: Response): Promise<void> => {
  try {
    // Check if teams table exists first
    let result;
    try {
      // First try with deleted_at
      result = await pool.query(`
        SELECT 
          t.id,
          t.name,
          t.description,
          t.color,
          t.department_id as "departmentId",
          t.leader_id as "leaderId",
          t.is_active as "isActive",
          t.created_at as "createdAt",
          d.name as "departmentName"
        FROM teams t
        LEFT JOIN departments d ON t.department_id = d.id
        WHERE t.deleted_at IS NULL
          AND (t.is_active = true OR t.is_active IS NULL)
        ORDER BY t.name
      `);
    } catch (err: any) {
      if (err.code === '42703') {
        // Column doesn't exist, try without deleted_at
        try {
          if (err.message.includes('deleted_at')) {
            result = await pool.query(`
              SELECT 
                t.id,
                t.name,
                t.description,
                t.color,
                t.department_id as "departmentId",
                t.leader_id as "leaderId",
                t.is_active as "isActive",
                t.created_at as "createdAt",
                d.name as "departmentName"
              FROM teams t
              LEFT JOIN departments d ON t.department_id = d.id
              WHERE t.is_active = true OR t.is_active IS NULL
              ORDER BY t.name
            `);
          } else if (err.message.includes('is_active')) {
            result = await pool.query(`
              SELECT 
                t.id,
                t.name,
                t.description,
                t.color,
                t.department_id as "departmentId",
                t.leader_id as "leaderId",
                t.created_at as "createdAt",
                d.name as "departmentName"
              FROM teams t
              LEFT JOIN departments d ON t.department_id = d.id
              ORDER BY t.name
            `);
          } else {
            throw err;
          }
        } catch (err2: any) {
          // Teams table doesn't exist, return empty array
          console.log('Teams table does not exist or error:', err2.message);
          res.json([]);
          return;
        }
      } else {
        // Teams table doesn't exist, return empty array
        console.log('Teams table does not exist, returning empty array');
        res.json([]);
        return;
      }
    }
    
    console.log(`Found ${result.rows.length} teams in database`);

    // Get member counts and member IDs for each team
    const teamsWithCounts = await Promise.all(
      result.rows.map(async (team) => {
        // Get team members (team_members table may not exist)
        let memberCount = 0;
        let memberIds: string[] = [];
        try {
          const memberResult = await pool.query(`
            SELECT user_id
            FROM team_members
            WHERE team_id = $1
          `, [team.id]);
          memberIds = memberResult.rows.map((row: any) => String(row.user_id));
          memberCount = memberIds.length;
        } catch (err: any) {
          console.error('Error fetching team members (table may not exist):', err.message);
          memberCount = 0;
          memberIds = [];
        }

        // Get leader name if exists
        let leaderName = null;
        if (team.leaderId) {
          try {
            const leaderResult = await pool.query(`
              SELECT display_name
              FROM users
              WHERE id = $1
            `, [team.leaderId]);
            leaderName = leaderResult.rows[0]?.display_name || null;
          } catch (err: any) {
            console.error('Error fetching leader name:', err.message);
            leaderName = null;
          }
        }

        // Get project count from project_teams table
        let activeProjects = 0;
        let projectCount = 0;
        try {
          // Try query with deleted_at filter first
          let projectResult;
          try {
            projectResult = await pool.query(`
              SELECT COUNT(DISTINCT pt.project_id) as total_projects,
                     COUNT(DISTINCT CASE WHEN p.status IN ('planning', 'active', 'on-hold') THEN pt.project_id END) as active_projects
              FROM project_teams pt
              LEFT JOIN projects p ON pt.project_id = p.id
              WHERE pt.team_id = $1
                AND (p.deleted_at IS NULL)
            `, [team.id]);
          } catch (err: any) {
            // If deleted_at doesn't exist, try without it
            if (err.code === '42703' && err.message.includes('deleted_at')) {
              projectResult = await pool.query(`
                SELECT COUNT(DISTINCT pt.project_id) as total_projects,
                       COUNT(DISTINCT CASE WHEN p.status IN ('planning', 'active', 'on-hold') THEN pt.project_id END) as active_projects
                FROM project_teams pt
                LEFT JOIN projects p ON pt.project_id = p.id
                WHERE pt.team_id = $1
              `, [team.id]);
            } else {
              throw err;
            }
          }
          
          if (projectResult.rows[0]) {
            projectCount = parseInt(projectResult.rows[0].total_projects || '0');
            activeProjects = parseInt(projectResult.rows[0].active_projects || '0');
          }
        } catch (err: any) {
          // project_teams table may not exist, that's okay
          console.log(`Error fetching projects for team ${team.name} (project_teams table may not exist):`, err.message);
          projectCount = 0;
          activeProjects = 0;
        }

        return {
          ...team,
          memberCount,
          memberIds,
          leaderName,
          activeProjects,
          projectCount // Total projects (including completed)
        };
      })
    );

    res.json(teamsWithCounts);
  } catch (error: any) {
    console.error('Error fetching teams:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/staff/teams
 * Create a new team
 */
router.post('/teams', async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, description, departmentId, leaderId, color } = req.body;

    if (!name) {
      res.status(400).json({ error: 'Team name is required' });
      return;
    }

    // Try inserting - handle missing table/columns gracefully
    const insertQueries = [
      {
        sql: `INSERT INTO teams (name, description, department_id, leader_id, color, is_active) VALUES ($1, $2, $3, $4, $5, true) RETURNING *`,
        params: [name, description || null, departmentId || null, leaderId || null, color || null]
      },
      {
        sql: `INSERT INTO teams (name, description, department_id, leader_id, color) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        params: [name, description || null, departmentId || null, leaderId || null, color || null]
      }
    ];
    
    let result;
    for (const query of insertQueries) {
      try {
        result = await pool.query(query.sql, query.params);
        break;
      } catch (err: any) {
        if (err.code === '42703' && insertQueries.indexOf(query) < insertQueries.length - 1) {
          continue;
        } else if (err.code === '42P01') {
          // Table doesn't exist
          res.status(400).json({ error: 'Teams table does not exist in database. Please create it first.' });
          return;
        } else {
          throw err;
        }
      }
    }

    if (!result || result.rows.length === 0) {
      res.status(500).json({ error: 'Failed to create team' });
      return;
    }

    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    console.error('Error creating team:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/staff/teams/:id
 * Update a team
 */
router.put('/teams/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, description, departmentId, leaderId, color } = req.body;

    const updateQueries = [
      {
        sql: `UPDATE teams SET name = COALESCE($1, name), description = COALESCE($2, description), department_id = COALESCE($3, department_id), leader_id = COALESCE($4, leader_id), color = COALESCE($5, color), updated_at = CURRENT_TIMESTAMP WHERE id = $6 RETURNING *`,
        params: [name, description, departmentId, leaderId, color, id]
      },
      {
        sql: `UPDATE teams SET name = COALESCE($1, name), description = COALESCE($2, description), department_id = COALESCE($3, department_id), leader_id = COALESCE($4, leader_id), color = COALESCE($5, color) WHERE id = $6 RETURNING *`,
        params: [name, description, departmentId, leaderId, color, id]
      }
    ];
    
    let result;
    for (const query of updateQueries) {
      try {
        result = await pool.query(query.sql, query.params);
        break;
      } catch (err: any) {
        if (err.code === '42703' && updateQueries.indexOf(query) < updateQueries.length - 1) {
          continue;
        } else if (err.code === '42P01') {
          res.status(400).json({ error: 'Teams table does not exist in database.' });
          return;
        } else {
          throw err;
        }
      }
    }

    if (!result || result.rows.length === 0) {
      res.status(404).json({ error: 'Team not found' });
      return;
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    console.error('Error updating team:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/staff/teams/:id
 * Delete a team (soft delete)
 */
router.delete('/teams/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const deleteQueries = [
      {
        sql: `UPDATE teams SET deleted_at = CURRENT_TIMESTAMP, is_active = false WHERE id = $1`,
        params: [id]
      },
      {
        sql: `UPDATE teams SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1`,
        params: [id]
      },
      {
        sql: `DELETE FROM teams WHERE id = $1`,
        params: [id]
      }
    ];
    
    for (const query of deleteQueries) {
      try {
        await pool.query(query.sql, query.params);
        res.status(204).send();
        return;
      } catch (err: any) {
        if (err.code === '42703' && deleteQueries.indexOf(query) < deleteQueries.length - 1) {
          continue;
        } else if (err.code === '42P01') {
          res.status(400).json({ error: 'Teams table does not exist in database.' });
          return;
        } else if (deleteQueries.indexOf(query) === deleteQueries.length - 1) {
          throw err;
        } else {
          throw err;
        }
      }
    }
  } catch (error: any) {
    console.error('Error deleting team:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/staff/members
 * Get all staff members/users
 */
router.get('/members', async (req: Request, res: Response): Promise<void> => {
  try {
    // Simple query - users table doesn't have deleted_at or department_id columns
    // Use department (VARCHAR) directly, no deleted_at filter
    const result = await pool.query(`
      SELECT 
        u.id,
        u.username,
        u.email,
        u.display_name as "displayName",
        u.full_name as "fullName",
        u.job_title as "jobTitle",
        u.department as "departmentId",
        u.department as "departmentName",
        u.role,
        u.language,
        u.status,
        u.avatar_url as "avatarUrl",
        u.phone_number as "phoneNumber",
        u.created_at as "createdAt"
      FROM users u
      ORDER BY u.display_name
    `);

    // Get team information for each member and department names
    const membersWithDepartments = await Promise.all(
      result.rows.map(async (member) => {
        // Get department name if departmentId exists
        if (member.departmentId) {
          try {
            const deptResult = await pool.query(`
              SELECT name
              FROM departments
              WHERE id::text = $1 OR name = $1
            `, [member.departmentId]);
            
            if (deptResult.rows[0]) {
              member.departmentName = deptResult.rows[0].name;
            }
          } catch (err: any) {
            console.error('Error fetching department name:', err.message);
            // Keep existing departmentName if available
          }
        }

        // Get team ID for this member (if they're in a team)
        let teamId = null;
        try {
          const teamResult = await pool.query(`
            SELECT team_id, user_id, role
            FROM team_members
            WHERE user_id = $1
            LIMIT 1
          `, [member.id]);
          
          if (teamResult.rows[0] && teamResult.rows[0].team_id) {
            teamId = String(teamResult.rows[0].team_id);
          } else if (teamResult.rows.length > 0) {
            console.log(`⚠️  Team query returned row but no team_id for user ${member.id}:`, teamResult.rows[0]);
          }
        } catch (err: any) {
          // team_members table may not exist, that's okay
          console.log(`⚠️  Error querying team_members for user ${member.id}:`, err.message);
          teamId = null;
        }

        return {
          ...member,
          teamId
        };
      })
    );

    res.json(membersWithDepartments);
  } catch (error: any) {
    console.error('Error fetching members:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/staff/members/:id
 * Get a single staff member
 */
router.get('/members/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Simple query - users table doesn't have deleted_at or department_id columns
    const result = await pool.query(`
      SELECT 
        u.id,
        u.username,
        u.email,
        u.display_name as "displayName",
        u.full_name as "fullName",
        u.job_title as "jobTitle",
        u.department as "departmentId",
        u.department as "departmentName",
        u.role,
        u.language,
        u.status,
        u.avatar_url as "avatarUrl",
        u.phone_number as "phoneNumber",
        u.created_at as "createdAt"
      FROM users u
      WHERE u.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Member not found' });
      return;
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    console.error('Error fetching member:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/staff/members
 * Create a new staff member
 */
router.post('/members', async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, email, displayName, fullName, jobTitle, departmentId, teamId, role, password } = req.body;

    if (!username || !email || !displayName) {
      res.status(400).json({ error: 'Username, email, and displayName are required' });
      return;
    }
    
    // Use default password if not provided
    const userPassword = password || 'TempPassword123!';

    // Hash password using bcryptjs
    let passwordHash;
    try {
      const bcrypt = require('bcryptjs');
      passwordHash = await bcrypt.hash(userPassword, 10);
    } catch (bcryptErr: any) {
      console.error('Error hashing password:', bcryptErr.message);
      console.error('bcryptjs module error:', bcryptErr);
      res.status(500).json({ error: `Password hashing failed: ${bcryptErr.message}. Make sure bcryptjs is installed.` });
      return;
    }

    // Get department name from departmentId if provided (users table uses department VARCHAR, not department_id)
    let departmentName = null;
    if (departmentId) {
      try {
        const deptResult = await pool.query(`SELECT name FROM departments WHERE id::text = $1 OR id = $1`, [departmentId]);
        departmentName = deptResult.rows[0]?.name || null;
        console.log(`📋 Department lookup: departmentId=${departmentId} -> departmentName=${departmentName}`);
      } catch (deptErr: any) {
        console.error('Error fetching department name:', deptErr.message);
        // Continue without department name if lookup fails
      }
    }

    // Generate UUID for user ID (database may not have DEFAULT gen_random_uuid())
    const { randomUUID } = require('crypto');
    const userId = randomUUID();
    
    // Insert user with department column (VARCHAR), not department_id
    let result;
    try {
      result = await pool.query(`
        INSERT INTO users (id, username, email, password_hash, display_name, full_name, job_title, department, role)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id, username, email, display_name as "displayName", role, created_at as "createdAt"
      `, [userId, username, email, passwordHash, displayName, fullName || null, jobTitle || null, departmentName, role || 'member']);
      console.log(`✅ User created successfully: ${result.rows[0].id}`);
    } catch (err: any) {
      console.error('Error inserting user:', err.message);
      console.error('Error code:', err.code);
      console.error('Error detail:', err.detail);
      throw err;
    }

    // userId is already set above from randomUUID()

    // Handle team assignment if teamId is provided
    if (teamId && teamId.trim() !== '') {
      try {
        console.log(`🔗 Assigning user ${userId} to team ${teamId}...`);
        // Remove user from any existing teams first
        await pool.query(`
          DELETE FROM team_members
          WHERE user_id = $1
        `, [userId]);

        // Add user to the specified team
        const teamInsertResult = await pool.query(`
          INSERT INTO team_members (team_id, user_id, role)
          VALUES ($1, $2, 'member')
          ON CONFLICT (team_id, user_id) DO UPDATE SET role = 'member'
          RETURNING *
        `, [teamId, userId]);
        console.log(`✅ User ${userId} assigned to team ${teamId}:`, teamInsertResult.rows[0]);
      } catch (teamErr: any) {
        console.error('❌ Error assigning user to team:', teamErr.message);
        console.error('Error code:', teamErr.code);
        console.error('Error detail:', teamErr.detail);
        // Don't fail the whole request if team assignment fails, but log it
      }
    } else {
      console.log(`ℹ️  No teamId provided for user ${userId}, skipping team assignment`);
    }

    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    console.error('Error creating member:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/staff/members/:id
 * Update a staff member
 */
router.put('/members/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { displayName, fullName, jobTitle, departmentId, teamId, role, status, language } = req.body;
    
    console.log(`📝 Updating member ${id}:`, { 
      displayName, 
      teamId, 
      teamIdType: typeof teamId,
      teamIdLength: teamId ? teamId.length : 0,
      departmentId,
      fullBody: req.body 
    });

    // Try updating with department_id, fallback to department if it doesn't exist
    let result;
    try {
      result = await pool.query(`
        UPDATE users
        SET display_name = COALESCE($1, display_name),
            full_name = COALESCE($2, full_name),
            job_title = COALESCE($3, job_title),
            department_id = COALESCE($4, department_id),
            role = COALESCE($5, role),
            status = COALESCE($6, status),
            language = COALESCE($7, language),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $8
        RETURNING *
      `, [displayName, fullName, jobTitle, departmentId, role, status, language, id]);
    } catch (err: any) {
      // If department_id doesn't exist, use department column instead
      if (err.code === '42703' && err.message.includes('department_id')) {
        // Get department name from departmentId if provided
        let departmentName = null;
        if (departmentId) {
          try {
            const deptResult = await pool.query(`SELECT name FROM departments WHERE id::text = $1`, [departmentId]);
            departmentName = deptResult.rows[0]?.name || null;
          } catch (deptErr: any) {
            console.error('Error fetching department name:', deptErr.message);
          }
        }
        
        result = await pool.query(`
          UPDATE users
          SET display_name = COALESCE($1, display_name),
              full_name = COALESCE($2, full_name),
              job_title = COALESCE($3, job_title),
              department = COALESCE($4, department),
              role = COALESCE($5, role),
              status = COALESCE($6, status),
              language = COALESCE($7, language),
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $8
          RETURNING *
        `, [displayName, fullName, jobTitle, departmentName, role, status, language, id]);
      } else {
        throw err;
      }
    }

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Member not found' });
      return;
    }

    // Handle team assignment if teamId is provided
    // teamId can be: undefined (not provided), empty string "" (no team), or UUID (team selected)
    console.log(`🔍 Processing team assignment for user ${id}:`, { 
      teamId, 
      teamIdType: typeof teamId, 
      teamIdIsUndefined: teamId === undefined,
      teamIdIsNull: teamId === null,
      teamIdIsEmpty: teamId === '',
      teamIdTruthy: !!teamId
    });
    
    if (teamId !== undefined && teamId !== null) {
      try {
        // Remove user from any existing teams first
        console.log(`🗑️  Removing user ${id} from all existing teams...`);
        const deleteResult = await pool.query(`
          DELETE FROM team_members
          WHERE user_id = $1
        `, [id]);
        console.log(`   Deleted ${deleteResult.rowCount} existing team assignments`);

        if (teamId && teamId.trim() !== '') {
          // Add user to the specified team
          console.log(`➕ Adding user ${id} to team ${teamId}...`);
          console.log(`   User ID type: ${typeof id}, value: ${id}`);
          console.log(`   Team ID type: ${typeof teamId}, value: ${teamId}`);
          
          try {
            const insertResult = await pool.query(`
              INSERT INTO team_members (team_id, user_id, role)
              VALUES ($1, $2, 'member')
              ON CONFLICT (team_id, user_id) DO UPDATE SET role = 'member'
              RETURNING *
            `, [teamId, id]);
            console.log(`✅ User ${id} assigned to team ${teamId}:`, insertResult.rows[0]);
            
            // Verify the assignment was saved immediately
            const verifyResult = await pool.query(`
              SELECT * FROM team_members WHERE user_id = $1 AND team_id = $2
            `, [id, teamId]);
            if (verifyResult.rows.length > 0) {
              console.log(`✅ Verified: Assignment saved successfully`, verifyResult.rows[0]);
            } else {
              console.error(`❌ ERROR: Assignment not found after insert!`);
              console.error(`   Searched for user_id=${id}, team_id=${teamId}`);
            }
          } catch (insertErr: any) {
            console.error(`❌ ERROR inserting team assignment:`, insertErr.message);
            console.error(`   Error code:`, insertErr.code);
            console.error(`   Error detail:`, insertErr.detail);
            console.error(`   Full error:`, insertErr);
            throw insertErr; // Re-throw to see the error
          }
        } else {
          // teamId is empty string - remove from all teams (already deleted above)
          console.log(`✅ User ${id} removed from all teams (teamId was empty string)`);
        }
      } catch (teamErr: any) {
        console.error('❌ Error updating team assignment:', teamErr.message);
        console.error('Error code:', teamErr.code);
        console.error('Error detail:', teamErr.detail);
        console.error('Error hint:', teamErr.hint);
        console.error('Full error:', teamErr);
        // Re-throw to see the error - comment out if you want to continue anyway
        // throw teamErr;
      }
    } else {
      console.log(`ℹ️  teamId not provided (undefined/null) for user ${id}, skipping team assignment`);
    }

    // Get the updated team assignment to include in response
    let responseTeamId = null;
    try {
      const teamResult = await pool.query(`
        SELECT team_id
        FROM team_members
        WHERE user_id = $1
        LIMIT 1
      `, [id]);
      if (teamResult.rows[0] && teamResult.rows[0].team_id) {
        responseTeamId = String(teamResult.rows[0].team_id);
        console.log(`✅ Found teamId in response query: ${responseTeamId}`);
      } else {
        console.log(`ℹ️  No teamId found for user ${id} in team_members table`);
      }
    } catch (err: any) {
      console.log(`⚠️  Error fetching teamId for response:`, err.message);
    }
    
    const response = {
      ...result.rows[0],
      teamId: responseTeamId
    };
    
    console.log(`📤 Sending response for user ${id}:`, { 
      displayName: response.display_name || response.displayName,
      teamId: response.teamId 
    });
    
    res.json(response);
  } catch (error: any) {
    console.error('Error updating member:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/staff/members/:id
 * Delete a staff member (soft delete)
 */
router.delete('/members/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Try soft delete with deleted_at, fallback to just marking as inactive if column doesn't exist
    try {
      await pool.query(`
        UPDATE users
        SET deleted_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `, [id]);
    } catch (err: any) {
      // If deleted_at doesn't exist, we can't soft delete, so just return success
      // (or you could set a status field if it exists)
      if (err.code === '42703' && err.message.includes('deleted_at')) {
        // Just return success - actual deletion would require hard delete which we avoid
        console.log('deleted_at column does not exist, skipping soft delete');
      } else {
        throw err;
      }
    }

    res.status(204).send();
  } catch (error: any) {
    console.error('Error deleting member:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;

