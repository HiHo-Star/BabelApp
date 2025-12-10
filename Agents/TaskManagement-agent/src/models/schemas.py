"""
Pydantic schemas for TaskManagement Agent API
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any


class ProcessRequest(BaseModel):
    """Request model for task processing"""
    userId: str = Field(..., description="User ID making the request")
    text: str = Field(..., description="Natural language input")
    language: Optional[str] = Field(None, description="Detected language (en/he)")
    context: Optional[Dict[str, Any]] = Field(None, description="Additional context")


class TaskData(BaseModel):
    """Extracted task data"""
    title: str
    description: Optional[str] = None
    priority: str = Field(default="medium", pattern="^(low|medium|high|urgent)$")
    taskType: str = Field(default="task", pattern="^(task|subtask|job)$")
    dueDate: Optional[str] = None
    startDate: Optional[str] = None
    estimatedHours: Optional[float] = None
    actualHours: Optional[float] = None
    suggestedTeamId: Optional[str] = None
    suggestedAssigneeId: Optional[str] = None
    missionId: Optional[str] = None
    projectId: Optional[str] = None
    stageId: Optional[str] = None
    tags: Optional[List[str]] = []
    isRetrospective: bool = False
    confidence: float = Field(ge=0.0, le=1.0)
    needsClarification: bool = False
    clarificationQuestion: Optional[str] = None


class ClarificationResponse(BaseModel):
    """Response when clarification is needed"""
    question: str
    field: str
    options: Optional[List[str]] = None


class MultipleTasksSuggestion(BaseModel):
    """Suggestion when multiple tasks detected"""
    message: str
    task1: TaskData
    task2: TaskData


class ProcessResponse(BaseModel):
    """Response model for task processing"""
    intent: str = Field(..., description="Intent: create, query, share, etc.")
    status: str = Field(..., pattern="^(complete|needs_clarification|multiple_tasks)$")
    language: str
    tasks: Optional[List[TaskData]] = None
    clarification: Optional[ClarificationResponse] = None
    multipleTasksSuggestion: Optional[MultipleTasksSuggestion] = None
    execution_time_ms: Optional[int] = None

