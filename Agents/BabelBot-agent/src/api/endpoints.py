"""
API endpoints for BabelBot Agent Service
"""

import logging
import time
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from ..services.response_formatter import response_formatter
from ..services.conversation_manager import conversation_manager
from ..models.schemas import ChatRequest, ChatResponse

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Chat with the BabelBot construction expert agent
    
    - **message**: User's message/question
    - **session_id**: Optional session ID for conversation continuity
    - **context**: Optional context (user info, project details, etc.)
    """
    try:
        start_time = time.time()

        # Get or create session
        session_id = conversation_manager.get_or_create_session(
            session_id=request.session_id,
            **(request.context or {})
        )

        # Get conversation history
        conversation_history = conversation_manager.get_recent_messages(session_id)

        # Add user message to conversation
        conversation_manager.add_message(session_id, "user", request.message)

        # Generate response
        response_message = await response_formatter.format_response(
            user_message=request.message,
            conversation_history=conversation_history,
            context=request.context
        )

        # Add assistant response to conversation
        conversation_manager.add_message(session_id, "assistant", response_message)

        execution_time_ms = int((time.time() - start_time) * 1000)

        return ChatResponse(
            session_id=session_id,
            message=response_message,
            execution_time_ms=execution_time_ms
        )

    except Exception as e:
        logger.error(f"Chat failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": str(e)}
        )


@router.get("/health")
async def health_check():
    """Health check endpoint"""
    gemini_available = response_formatter.model is not None
    
    return {
        "status": "healthy" if gemini_available else "degraded",
        "service": "babelbot-agent",
        "gemini_available": gemini_available,
        "active_sessions": conversation_manager.get_session_count()
    }


@router.delete("/session/{session_id}")
async def clear_session(session_id: str):
    """Clear conversation session"""
    success = conversation_manager.clear_session(session_id)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )
    
    return {"success": True, "message": "Session cleared"}

