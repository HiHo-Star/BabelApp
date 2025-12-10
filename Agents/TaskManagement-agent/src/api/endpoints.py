"""
API endpoints for TaskManagement Agent Service
"""

import time
import logging
from fastapi import APIRouter, HTTPException
from ..models.schemas import ProcessRequest, ProcessResponse, TaskData, ClarificationResponse
from ..services.language_detector import detect_language
from ..services.task_extractor import task_extractor
from ..config.settings import settings

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/api/task-management/process", response_model=ProcessResponse)
async def process_task_request(request: ProcessRequest):
    """
    Process natural language input for task-related operations
    
    This endpoint:
    1. Detects language
    2. Extracts task information
    3. Returns structured data or clarification questions
    """
    start_time = time.time()
    
    try:
        # Detect language if not provided
        language = request.language or detect_language(request.text)
        
        logger.info(f"Processing request from user {request.userId} (language: {language})")
        
        # Extract task data
        task_data = await task_extractor.extract(
            text=request.text,
            language=language,
            context=request.context or {}
        )
        
        # Calculate execution time
        execution_time_ms = int((time.time() - start_time) * 1000)
        
        # Determine response status
        if task_data.get('needsClarification', False):
            return ProcessResponse(
                intent="create",
                status="needs_clarification",
                language=language,
                clarification=ClarificationResponse(
                    question=task_data.get('clarificationQuestion', 'Could you provide more details?'),
                    field="general"
                ),
                execution_time_ms=execution_time_ms
            )
        
        # Check if multiple tasks detected (simple heuristic for now)
        # TODO: Implement proper multi-task detection
        if task_data.get('confidence', 0) < settings.MIN_CONFIDENCE_SCORE:
            return ProcessResponse(
                intent="create",
                status="needs_clarification",
                language=language,
                clarification=ClarificationResponse(
                    question="Could you provide more specific details about this task?",
                    field="general"
                ),
                execution_time_ms=execution_time_ms
            )
        
        # Convert to TaskData model
        task = TaskData(**task_data)
        
        return ProcessResponse(
            intent="create",
            status="complete",
            language=language,
            tasks=[task],
            execution_time_ms=execution_time_ms
        )
        
    except Exception as e:
        logger.error(f"Error processing task request: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "TaskManagement Agent",
        "version": "1.0.0"
    }

