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
    // Try with color column first, fallback without if it doesn't exist
    let result;
    try {
      result = await pool.query(`
        SELECT 
          id, 
          name, 
          description, 
          COALESCE(color, '#3B82F6') as color,
          is_active,
          created_at as "createdAt"
        FROM departments
        WHERE deleted_at IS NULL
        ORDER BY name
      `);
    } catch (err: any) {
      // If color column doesn't exist, select without it
      if (err.code === '42703' && err.message.includes('color')) {
        result = await pool.query(`
          SELECT 
            id, 
            name, 
            description, 
            '#3B82F6' as color,
            is_active,
            created_at as "createdAt"
          FROM departments
          WHERE deleted_at IS NULL
          ORDER BY name
        `);
      } else {
        throw err;
      }
    }

    // Get member counts and team counts for each department
    const departmentsWithCounts = await Promise.all(
      result.rows.map(async (dept) => {
        // Count users in this department (handle both department_id and department column)
        let memberCount = 0;
        try {
          // Try with department_id first
          const userCountResult = await pool.query(`
            SELECT COUNT(*) as count
            FROM users
            WHERE (COALESCE(department_id::text, '') = $1 OR department = $2)
              AND deleted_at IS NULL
          `, [dept.id, dept.name]);
          memberCount = parseInt(userCountResult.rows[0]?.count || '0');
        } catch (err: any) {
          // If department_id doesn't exist, use department only
          if (err.code === '42703' && err.message.includes('department_id')) {
            try {
              const userCountResult = await pool.query(`
                SELECT COUNT(*) as count
                FROM users
                WHERE department = $1
                  AND deleted_at IS NULL
              `, [dept.name]);
              memberCount = parseInt(userCountResult.rows[0]?.count || '0');
            } catch (err2: any) {
              console.error('Error counting users for department:', err2.message);
              memberCount = 0;
            }
          } else {
            console.error('Error counting users for department:', err.message);
            memberCount = 0;
          }
        }

        // Count teams in this department (teams table may not exist)
        let teamCount = 0;
        try {
          const teamCountResult = await pool.query(`
            SELECT COUNT(*) as count
            FROM teams
            WHERE department_id = $1
              AND deleted_at IS NULL
              AND is_active = true
          `, [dept.id]);
          teamCount = parseInt(teamCountResult.rows[0]?.count || '0');
        } catch (err: any) {
          console.error('Error counting teams for department (table may not exist):', err.message);
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
    res.status(500).json({ error: error.message });
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

    // Try inserting with color, fallback without if column doesn't exist
    let result;
    try {
      result = await pool.query(`
        INSERT INTO departments (name, description, color, is_active)
        VALUES ($1, $2, $3, true)
        RETURNING *
      `, [name, description || null, color || null]);
    } catch (err: any) {
      // If color column doesn't exist, insert without it
      if (err.code === '42703' && err.message.includes('color')) {
        result = await pool.query(`
          INSERT INTO departments (name, description, is_active)
          VALUES ($1, $2, true)
          RETURNING *
        `, [name, description || null]);
        // Add color to result
        result.rows[0].color = color || '#3B82F6';
      } else {
        throw err;
      }
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
    const { name, description, color, is_active } = req.body;

    // Try updating with color, fallback without if column doesn't exist
    let result;
    try {
      result = await pool.query(`
        UPDATE departments
        SET name = COALESCE($1, name),
            description = COALESCE($2, description),
            color = COALESCE($3, color),
            is_active = COALESCE($4, is_active),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $5
        RETURNING *
      `, [name, description, color, is_active, id]);
    } catch (err: any) {
      // If color column doesn't exist, update without it
      if (err.code === '42703' && err.message.includes('color')) {
        result = await pool.query(`
          UPDATE departments
          SET name = COALESCE($1, name),
              description = COALESCE($2, description),
              is_active = COALESCE($3, is_active),
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $4
          RETURNING *
        `, [name, description, is_active, id]);
        // Add color to result if provided
        if (color) {
          result.rows[0].color = color;
        } else {
          result.rows[0].color = '#3B82F6';
        }
      } else {
        throw err;
      }
    }

    if (result.rows.length === 0) {
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

    await pool.query(`
      UPDATE departments
      SET deleted_at = CURRENT_TIMESTAMP, is_active = false
      WHERE id = $1
    `, [id]);

    res.status(204).send();
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
        ORDER BY t.name
      `);
    } catch (err: any) {
      // Teams table doesn't exist, return empty array
      console.log('Teams table does not exist, returning empty array');
      res.json([]);
      return;
    }

    // Get member counts for each team
    const teamsWithCounts = await Promise.all(
      result.rows.map(async (team) => {
        // Count team members (team_members table may not exist)
        let memberCount = 0;
        try {
          const memberCountResult = await pool.query(`
            SELECT COUNT(*) as count
            FROM team_members
            WHERE team_id = $1
          `, [team.id]);
          memberCount = parseInt(memberCountResult.rows[0]?.count || '0');
        } catch (err: any) {
          console.error('Error counting team members (table may not exist):', err.message);
          memberCount = 0;
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

        return {
          ...team,
          memberCount,
          leaderName,
          activeProjects: 0 // Not available from current schema
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

    const result = await pool.query(`
      INSERT INTO teams (name, description, department_id, leader_id, color, is_active)
      VALUES ($1, $2, $3, $4, $5, true)
      RETURNING *
    `, [name, description || null, departmentId || null, leaderId || null, color || null]);

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
    const { name, description, departmentId, leaderId, color, is_active } = req.body;

    const result = await pool.query(`
      UPDATE teams
      SET name = COALESCE($1, name),
          description = COALESCE($2, description),
          department_id = COALESCE($3, department_id),
          leader_id = COALESCE($4, leader_id),
          color = COALESCE($5, color),
          is_active = COALESCE($6, is_active),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $7
      RETURNING *
    `, [name, description, departmentId, leaderId, color, is_active, id]);

    if (result.rows.length === 0) {
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

    await pool.query(`
      UPDATE teams
      SET deleted_at = CURRENT_TIMESTAMP, is_active = false
      WHERE id = $1
    `, [id]);

    res.status(204).send();
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
    const result = await pool.query(`
      SELECT 
        u.id,
        u.username,
        u.email,
        u.display_name as "displayName",
        u.full_name as "fullName",
        u.job_title as "jobTitle",
        COALESCE(u.department_id::text, u.department) as "departmentId",
        u.department as "departmentName",
        u.role,
        u.language,
        u.status,
        u.avatar_url as "avatarUrl",
        u.phone_number as "phoneNumber",
        u.created_at as "createdAt"
      FROM users u
      WHERE u.deleted_at IS NULL
      ORDER BY u.display_name
    `);

    // Get department names for users with department_id
    const membersWithDepartments = await Promise.all(
      result.rows.map(async (member) => {
        if (member.departmentId) {
          try {
            const deptResult = await pool.query(`
              SELECT name
              FROM departments
              WHERE id::text = $1 OR id::text = $1
            `, [member.departmentId]);
            
            if (deptResult.rows[0]) {
              member.departmentName = deptResult.rows[0].name;
            }
          } catch (err: any) {
            console.error('Error fetching department name:', err.message);
            // Keep existing departmentName if available
          }
        }
        return member;
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

    const result = await pool.query(`
      SELECT 
        u.id,
        u.username,
        u.email,
        u.display_name as "displayName",
        u.full_name as "fullName",
        u.job_title as "jobTitle",
        COALESCE(u.department_id::text, u.department) as "departmentId",
        u.department as "departmentName",
        u.role,
        u.language,
        u.status,
        u.avatar_url as "avatarUrl",
        u.phone_number as "phoneNumber",
        u.created_at as "createdAt"
      FROM users u
      WHERE u.id = $1 AND u.deleted_at IS NULL
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
    const { username, email, displayName, fullName, jobTitle, departmentId, role, password } = req.body;

    if (!username || !email || !displayName) {
      res.status(400).json({ error: 'Username, email, and displayName are required' });
      return;
    }
    
    // Use default password if not provided
    const userPassword = password || 'TempPassword123!';

    // Hash password (you should use bcrypt in production)
    const bcrypt = require('bcrypt');
    const passwordHash = await bcrypt.hash(userPassword, 10);

    // Try inserting with department_id, fallback to department if it doesn't exist
    let result;
    try {
      result = await pool.query(`
        INSERT INTO users (username, email, password_hash, display_name, full_name, job_title, department_id, role)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, username, email, display_name as "displayName", role, created_at as "createdAt"
      `, [username, email, passwordHash, displayName, fullName || null, jobTitle || null, departmentId || null, role || 'member']);
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
          INSERT INTO users (username, email, password_hash, display_name, full_name, job_title, department, role)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING id, username, email, display_name as "displayName", role, created_at as "createdAt"
        `, [username, email, passwordHash, displayName, fullName || null, jobTitle || null, departmentName, role || 'member']);
      } else {
        throw err;
      }
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
    const { displayName, fullName, jobTitle, departmentId, role, status, language } = req.body;

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

    res.json(result.rows[0]);
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

    await pool.query(`
      UPDATE users
      SET deleted_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [id]);

    res.status(204).send();
  } catch (error: any) {
    console.error('Error deleting member:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;

