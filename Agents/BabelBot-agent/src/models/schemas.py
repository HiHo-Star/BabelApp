"""
Pydantic models for requests/responses
"""

from pydantic import BaseModel
from typing import Optional, Dict, Any


class ChatRequest(BaseModel):
    """Chat request model"""
    message: str
    session_id: Optional[str] = None
    context: Optional[Dict[str, Any]] = None


class ChatResponse(BaseModel):
    """Chat response model"""
    session_id: str
    message: str
    execution_time_ms: int

