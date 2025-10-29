import express, { Request, Response } from 'express';
import { pool } from '../config/database';

const router = express.Router();

// Valid tables that can be queried (whitelist for security)
const VALID_TABLES = [
  'users', 'user_skills', 'user_emergency_contacts', 'user_sessions', 'user_preferences',
  'departments', 'teams', 'team_members',
  'chats', 'chat_participants', 'messages', 'message_translations', 'message_reactions', 'message_read_receipts',
  'projects', 'project_stages', 'project_teams',
  'tasks', 'task_comments', 'task_attachments',
  'safety_forms', 'safety_signatures',
  'audit_logs', 'notifications', 'system_settings'
];

// Validate table name to prevent SQL injection
const isValidTable = (tableName: string): boolean => {
  return VALID_TABLES.includes(tableName);
};

// GET /api/database/:tableName - Get all records from a table
router.get('/:tableName', async (req: Request, res: Response): Promise<void> => {
  try {
    const { tableName } = req.params;
    const { page = 1, limit = 20, search = '' } = req.query;

    if (!isValidTable(tableName)) {
      res.status(400).json({ error: 'Invalid table name' });
      return;
    }

    const offset = (Number(page) - 1) * Number(limit);

    // Get table columns
    const columnsQuery = `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position
    `;
    const columnsResult = await pool.query(columnsQuery, [tableName]);
    const columns = columnsResult.rows.map(row => row.column_name);

    // Build search condition if search term provided
    let searchCondition = '';
    let queryParams: any[] = [];

    if (search) {
      // Search across all text columns
      const textColumns = columnsResult.rows
        .filter(col => ['character varying', 'text', 'uuid'].includes(col.data_type))
        .map(col => col.column_name);

      if (textColumns.length > 0) {
        searchCondition = 'WHERE ' + textColumns
          .map((col, idx) => `CAST(${col} AS TEXT) ILIKE $${idx + 1}`)
          .join(' OR ');
        queryParams = textColumns.map(() => `%${search}%`);
      }
    }

    // Get total count
    const countQuery = `SELECT COUNT(*) FROM ${tableName} ${searchCondition}`;
    const countResult = await pool.query(countQuery, queryParams);
    const totalCount = parseInt(countResult.rows[0].count);

    // Get paginated data
    const dataQuery = `
      SELECT * FROM ${tableName}
      ${searchCondition}
      ORDER BY created_at DESC
      LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
    `;
    const dataResult = await pool.query(dataQuery, [...queryParams, Number(limit), offset]);

    res.json({
      columns,
      rows: dataResult.rows,
      totalCount,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(totalCount / Number(limit))
    });
  } catch (error: any) {
    console.error('Database query error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/database/:tableName - Create a new record
router.post('/:tableName', async (req: Request, res: Response): Promise<void> => {
  try {
    const { tableName } = req.params;
    const data = req.body;

    if (!isValidTable(tableName)) {
      res.status(400).json({ error: 'Invalid table name' });
      return;
    }

    // Remove undefined/null values and system fields
    const cleanData = Object.entries(data).reduce((acc, [key, value]) => {
      if (value !== undefined && value !== null && value !== '' &&
          !['id', 'created_at', 'updated_at'].includes(key)) {
        acc[key] = value;
      }
      return acc;
    }, {} as any);

    const columns = Object.keys(cleanData);
    const values = Object.values(cleanData);
    const placeholders = columns.map((_, idx) => `$${idx + 1}`).join(', ');

    const query = `
      INSERT INTO ${tableName} (${columns.join(', ')})
      VALUES (${placeholders})
      RETURNING *
    `;

    const result = await pool.query(query, values);
    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    console.error('Database insert error:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/database/:tableName/:id - Update a record
router.put('/:tableName/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { tableName, id } = req.params;
    const data = req.body;

    if (!isValidTable(tableName)) {
      res.status(400).json({ error: 'Invalid table name' });
      return;
    }

    // Remove undefined/null values and system fields
    const cleanData = Object.entries(data).reduce((acc, [key, value]) => {
      if (value !== undefined &&
          !['id', 'created_at'].includes(key)) {
        acc[key] = value;
      }
      return acc;
    }, {} as any);

    // Add updated_at if table has it
    cleanData.updated_at = new Date();

    const columns = Object.keys(cleanData);
    const values = Object.values(cleanData);
    const setClause = columns.map((col, idx) => `${col} = $${idx + 1}`).join(', ');

    const query = `
      UPDATE ${tableName}
      SET ${setClause}
      WHERE id = $${columns.length + 1}
      RETURNING *
    `;

    const result = await pool.query(query, [...values, id]);

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Record not found' });
      return;
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    console.error('Database update error:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/database/:tableName/:id - Delete a record
router.delete('/:tableName/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { tableName, id } = req.params;

    if (!isValidTable(tableName)) {
      res.status(400).json({ error: 'Invalid table name' });
      return;
    }

    // Check if table has deleted_at column (soft delete)
    const columnsQuery = `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1 AND column_name = 'deleted_at'
    `;
    const columnsResult = await pool.query(columnsQuery, [tableName]);
    const hasSoftDelete = columnsResult.rows.length > 0;

    let query: string;
    if (hasSoftDelete) {
      // Soft delete
      query = `
        UPDATE ${tableName}
        SET deleted_at = NOW()
        WHERE id = $1 AND deleted_at IS NULL
        RETURNING id
      `;
    } else {
      // Hard delete
      query = `
        DELETE FROM ${tableName}
        WHERE id = $1
        RETURNING id
      `;
    }

    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Record not found or already deleted' });
      return;
    }

    res.json({ message: 'Record deleted successfully', id: result.rows[0].id });
  } catch (error: any) {
    console.error('Database delete error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/database/:tableName/columns - Get table schema
router.get('/:tableName/columns', async (req: Request, res: Response): Promise<void> => {
  try {
    const { tableName } = req.params;

    if (!isValidTable(tableName)) {
      res.status(400).json({ error: 'Invalid table name' });
      return;
    }

    const query = `
      SELECT
        column_name,
        data_type,
        is_nullable,
        column_default,
        character_maximum_length
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position
    `;

    const result = await pool.query(query, [tableName]);
    res.json(result.rows);
  } catch (error: any) {
    console.error('Database schema error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
