"""
Task extraction service
Extracts task details from natural language using Gemini LLM
"""

import json
import logging
from typing import Dict, Any, Optional, List
import google.generativeai as genai
from ..config.settings import settings
from ..database.cache import data_cache

logger = logging.getLogger(__name__)


class TaskExtractor:
    """Extract task information from natural language"""

    def __init__(self):
        genai.configure(api_key=settings.GEMINI_API_KEY)
        self.model = genai.GenerativeModel(settings.GEMINI_MODEL)

    def _build_extraction_prompt(
        self,
        text: str,
        language: str,
        context: Dict[str, Any]
    ) -> str:
        """Build the prompt for task extraction"""
        
        # Get current data from cache
        data = context.get('system_data', {})
        
        projects = data.get('projects', [])
        missions = data.get('missions', [])
        teams = data.get('teams', [])
        departments = data.get('departments', [])
        
        # Build context strings
        projects_str = "\n".join([
            f"- {p.get('name', '')} (ID: {p.get('id', '')})" 
            for p in projects[:20]  # Limit to first 20
        ])
        
        missions_str = "\n".join([
            f"- {m.get('name', '')} (ID: {m.get('id', '')}, Project: {m.get('project_id', '')})"
            for m in missions[:30]  # Limit to first 30
        ])
        
        teams_str = "\n".join([
            f"- {t.get('name', '')} ({t.get('specialty', 'N/A')}) - {t.get('department_name', 'N/A')}"
            for t in teams[:30]  # Limit to first 30
        ])
        
        prompt = f"""You are a Task Management Agent for a construction/building project management system.

Your role is to extract task information from natural language input and return structured JSON data.

AVAILABLE PROJECTS:
{projects_str if projects_str else "None"}

AVAILABLE MISSIONS:
{missions_str if missions_str else "None"}

AVAILABLE TEAMS:
{teams_str if teams_str else "None"}

USER INPUT (Language: {language}):
"{text}"

TASK:
Extract task information from the user input and return a JSON object with the following structure:
{{
    "title": "Short, clear task title",
    "description": "Detailed description of the task",
    "priority": "low|medium|high|urgent",
    "taskType": "task|subtask|job",
    "dueDate": "YYYY-MM-DD or null",
    "startDate": "YYYY-MM-DDTHH:MM:SS or null",
    "estimatedHours": number or null,
    "actualHours": number or null (only for retrospective tasks),
    "suggestedTeamId": "team-id or null",
    "suggestedAssigneeId": "user-id or null",
    "missionId": "mission-id or null",
    "projectId": "project-id or null",
    "stageId": "stage-id or null",
    "tags": ["tag1", "tag2"],
    "isRetrospective": true|false,
    "confidence": 0.0-1.0,
    "needsClarification": true|false,
    "clarificationQuestion": "question text or null"
}}

RULES:
1. If the task is retrospective (past tense, "yesterday", "last week", "took X hours"), set isRetrospective=true and status="done"
2. Classify task type:
   - "job": Quick, unplanned tasks (minutes to hours)
   - "subtask": Part of a larger task
   - "task": Planned, multi-day work
3. Match missions based on keywords and project context
4. Suggest teams based on task requirements and team specialties
5. Extract time estimates and add +20% safety buffer
6. If confidence < 0.7, set needsClarification=true and provide clarificationQuestion
7. Detect dates and times from natural language
8. Return all fields in the same language as input ({language})

Return ONLY valid JSON, no markdown formatting, no explanations."""

        return prompt

    async def extract(
        self,
        text: str,
        language: str,
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Extract task information from natural language
        
        Args:
            text: Natural language input
            language: Detected language ('en' or 'he')
            context: Context including system data and user info
            
        Returns:
            Extracted task data with confidence score
        """
        try:
            # Get latest system data
            system_data = await data_cache.get_data()
            context['system_data'] = system_data
            
            # Build prompt
            prompt = self._build_extraction_prompt(text, language, context)
            
            logger.info(f"Extracting task from text (language: {language})")
            
            # Generate response
            response = self.model.generate_content(prompt)
            
            # Parse JSON response
            response_text = response.text.strip()
            
            # Remove markdown code blocks if present
            if response_text.startswith('```'):
                # Extract JSON from code block
                lines = response_text.split('\n')
                json_start = next((i for i, line in enumerate(lines) if '{' in line), 0)
                json_end = next((i for i, line in enumerate(lines[json_start:], json_start) if '}' in line), len(lines))
                response_text = '\n'.join(lines[json_start:json_end+1])
            
            # Parse JSON
            task_data = json.loads(response_text)
            
            logger.info(f"Task extracted successfully (confidence: {task_data.get('confidence', 0)})")
            
            return task_data
            
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse JSON response: {e}")
            logger.error(f"Response text: {response_text if 'response_text' in locals() else 'N/A'}")
            return {
                "title": text[:50],
                "description": text,
                "priority": "medium",
                "taskType": "task",
                "confidence": 0.3,
                "needsClarification": True,
                "clarificationQuestion": "Could you provide more details about this task?"
            }
        except Exception as e:
            logger.error(f"Error extracting task: {e}")
            raise


# Global instance
task_extractor = TaskExtractor()

