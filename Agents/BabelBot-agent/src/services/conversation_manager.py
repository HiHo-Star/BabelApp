"""
Conversation Manager - Handles sessions and message history
"""

import logging
import time
from typing import Dict, List, Optional
from dataclasses import dataclass, field

from ..config.settings import settings

logger = logging.getLogger(__name__)


@dataclass
class Message:
    """Single message in conversation"""
    role: str  # "user" or "assistant"
    content: str
    timestamp: float = field(default_factory=time.time)


@dataclass
class Conversation:
    """Conversation session"""
    session_id: str
    messages: List[Message] = field(default_factory=list)
    created_at: float = field(default_factory=time.time)
    last_activity: float = field(default_factory=time.time)
    metadata: Dict = field(default_factory=dict)


class ConversationManager:
    """Manages conversation sessions and history"""

    def __init__(self):
        self.conversations: Dict[str, Conversation] = {}
        self.ttl = settings.CONVERSATION_TTL
        self.max_context_messages = settings.MAX_CONTEXT_MESSAGES

    def get_or_create_session(
        self, 
        session_id: Optional[str] = None,
        **metadata
    ) -> str:
        """Get existing session or create new one"""
        if session_id and session_id in self.conversations:
            # Update last activity
            self.conversations[session_id].last_activity = time.time()
            return session_id

        # Create new session
        new_session_id = session_id or f"session_{int(time.time() * 1000)}"
        self.conversations[new_session_id] = Conversation(
            session_id=new_session_id,
            metadata=metadata
        )
        logger.info(f"Created new session: {new_session_id}")
        return new_session_id

    def add_message(self, session_id: str, role: str, content: str):
        """Add message to conversation"""
        if session_id not in self.conversations:
            self.get_or_create_session(session_id)

        conversation = self.conversations[session_id]
        conversation.messages.append(Message(role=role, content=content))
        conversation.last_activity = time.time()

    def get_recent_messages(self, session_id: str) -> List[Dict[str, str]]:
        """Get recent messages for context"""
        if session_id not in self.conversations:
            return []

        conversation = self.conversations[session_id]
        recent = conversation.messages[-self.max_context_messages:]
        
        return [
            {"role": msg.role, "content": msg.content}
            for msg in recent
        ]

    def get_conversation(self, session_id: str) -> Optional[Conversation]:
        """Get full conversation"""
        return self.conversations.get(session_id)

    def clear_session(self, session_id: str) -> bool:
        """Clear conversation session"""
        if session_id in self.conversations:
            del self.conversations[session_id]
            logger.info(f"Cleared session: {session_id}")
            return True
        return False

    def cleanup_expired_sessions(self) -> int:
        """Remove expired sessions"""
        current_time = time.time()
        expired = [
            sid for sid, conv in self.conversations.items()
            if current_time - conv.last_activity > self.ttl
        ]
        
        for sid in expired:
            del self.conversations[sid]
        
        if expired:
            logger.info(f"Cleaned up {len(expired)} expired sessions")
        
        return len(expired)

    def get_session_count(self) -> int:
        """Get number of active sessions"""
        return len(self.conversations)


# Global instance
conversation_manager = ConversationManager()

