"""
Database queries for TaskManagement Agent
These queries are used when direct DB access is needed
Most data comes from backend API polling, but some queries may be needed
"""

from typing import List, Dict, Any, Optional
from .connection import db


async def get_projects() -> List[Dict[str, Any]]:
    """Get all active projects"""
    query = """
        SELECT id, name, description, status, priority, location, manager_id, progress
        FROM projects
        WHERE deleted_at IS NULL
        ORDER BY name
    """
    rows = await db.fetch(query)
    return [dict(row) for row in rows]


async def get_project_stages(project_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """Get project stages, optionally filtered by project"""
    if project_id:
        query = """
            SELECT id, project_id, name, description, stage_order, status, progress
            FROM project_stages
            WHERE project_id = $1
            ORDER BY stage_order
        """
        rows = await db.fetch(query, project_id)
    else:
        query = """
            SELECT id, project_id, name, description, stage_order, status, progress
            FROM project_stages
            ORDER BY project_id, stage_order
        """
        rows = await db.fetch(query)
    return [dict(row) for row in rows]


async def get_missions(project_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """Get missions, optionally filtered by project"""
    if project_id:
        query = """
            SELECT id, name, description, project_id, stage_id, status, priority, progress
            FROM missions
            WHERE deleted_at IS NULL AND project_id = $1
            ORDER BY name
        """
        rows = await db.fetch(query, project_id)
    else:
        query = """
            SELECT id, name, description, project_id, stage_id, status, priority, progress
            FROM missions
            WHERE deleted_at IS NULL
            ORDER BY name
        """
        rows = await db.fetch(query)
    return [dict(row) for row in rows]


async def get_teams() -> List[Dict[str, Any]]:
    """Get all active teams with their specialties"""
    query = """
        SELECT 
            t.id, 
            t.name, 
            t.description, 
            t.specialty, 
            t.department_id,
            t.leader_id,
            d.name as department_name
        FROM teams t
        LEFT JOIN departments d ON t.department_id = d.id
        WHERE t.deleted_at IS NULL AND t.is_active = true
        ORDER BY t.name
    """
    rows = await db.fetch(query)
    return [dict(row) for row in rows]


async def get_users() -> List[Dict[str, Any]]:
    """Get all active users"""
    query = """
        SELECT 
            u.id,
            u.username,
            u.display_name,
            u.job_title,
            u.department_id,
            u.role,
            u.language,
            d.name as department_name
        FROM users u
        LEFT JOIN departments d ON u.department_id = d.id
        WHERE u.deleted_at IS NULL
        ORDER BY u.display_name
    """
    rows = await db.fetch(query)
    return [dict(row) for row in rows]


async def get_user_by_id(user_id: str) -> Optional[Dict[str, Any]]:
    """Get a specific user by ID"""
    query = """
        SELECT 
            u.id,
            u.username,
            u.display_name,
            u.job_title,
            u.department_id,
            u.role,
            u.language,
            d.name as department_name
        FROM users u
        LEFT JOIN departments d ON u.department_id = d.id
        WHERE u.id = $1 AND u.deleted_at IS NULL
    """
    row = await db.fetchrow(query, user_id)
    return dict(row) if row else None

