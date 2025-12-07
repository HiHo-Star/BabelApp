"""
Response Formatter Service - Construction/Building Domain Expert
"""

import logging
import google.generativeai as genai
from typing import Optional, List, Dict, Any

from ..config.settings import settings

logger = logging.getLogger(__name__)


class ResponseFormatter:
    """Formats AI responses naturally using Gemini - Construction Expert"""

    def __init__(self):
        """Initialize Gemini model"""
        if not settings.GEMINI_API_KEY:
            logger.warning("GEMINI_API_KEY not set, response formatting disabled")
            self.model = None
            return

        try:
            genai.configure(api_key=settings.GEMINI_API_KEY)
            self.model = genai.GenerativeModel(settings.GEMINI_MODEL)
            logger.info(f"Response formatter initialized: {settings.GEMINI_MODEL}")
        except Exception as e:
            logger.error(f"Failed to initialize Gemini: {e}")
            self.model = None

    async def format_response(
        self,
        user_message: str,
        conversation_history: List[Dict[str, str]] = None,
        context: Dict[str, Any] = None
    ) -> str:
        """
        Format response based on construction/building domain expertise
        
        Args:
            user_message: User's message
            conversation_history: Previous messages in conversation
            context: Additional context (user info, session data, etc.)
        
        Returns:
            Formatted response string
        """
        if not self.model:
            return "I'm sorry, I'm not available right now. Please check the configuration."

        try:
            prompt = self._build_role_prompt(
                user_message, 
                conversation_history, 
                context
            )

            response = self.model.generate_content(prompt)
            formatted_response = response.text.strip()

            logger.info(f"Response formatted successfully")
            return formatted_response

        except Exception as e:
            logger.error(f"Response formatting failed: {e}")
            return "I'm sorry, I encountered an error processing your message. Please try again."

    def _build_role_prompt(
        self,
        user_message: str,
        conversation_history: List[Dict[str, str]] = None,
        context: Dict[str, Any] = None
    ) -> str:
        """
        Build the system prompt with construction/building domain expertise
        
        ⚠️ CUSTOMIZED FOR CONSTRUCTION/BUILDING DOMAIN ⚠️
        """
        
        # ============================================
        # ROLE SPECIFICATION - Construction Expert
        # ============================================
        role_description = """You are Babel Bot, a highly experienced and professional construction engineer and senior construction manager with extensive expertise in the building and construction industry.

You have deep knowledge of:
- Construction methodologies, techniques, and best practices
- Building materials, their properties, applications, and specifications
- Construction terminology in multiple languages (Hebrew, English, Arabic, etc.)
- Building codes, regulations, and standards
- Project management, scheduling, and cost estimation
- Structural engineering principles
- MEP (Mechanical, Electrical, Plumbing) systems
- Safety protocols and regulations
- Quality control and inspection procedures
- Construction equipment and machinery
- Sustainable building practices and green construction
- Renovation and restoration techniques
- Construction documentation and contracts

You act as a trusted advisor, providing professional guidance, recommendations, and solutions for any construction-related question or challenge."""
        
        # ============================================
        # GUIDELINES - Professional Construction Expert Behavior
        # ============================================
        guidelines = """
1. Always provide accurate, professional, and practical advice based on industry standards and best practices
2. Use proper construction terminology and explain technical terms when needed
3. Be thorough but concise - provide detailed information when relevant, but keep responses practical
4. When asked about materials, provide specifications, applications, advantages, disadvantages, and cost considerations
5. When discussing methodologies, explain the process, required tools/equipment, timeline, and safety considerations
6. Always emphasize safety - mention relevant safety protocols, PPE requirements, and potential hazards
7. If you don't know something specific, admit it but provide general guidance or suggest consulting relevant standards/codes
8. Consider cost implications and provide budget-conscious alternatives when appropriate
9. Reference relevant building codes, standards, or regulations when applicable (mention country/region if specified)
10. Provide step-by-step instructions for construction processes when requested
11. Use examples and real-world scenarios to illustrate concepts
12. Be professional, respectful, and supportive - you're helping construction professionals succeed
13. Respond in the same language as the user (Hebrew, English, Arabic, etc.) unless asked otherwise
14. When discussing measurements, use both metric and imperial units when relevant
15. Consider environmental impact and sustainability in your recommendations
"""
        
        # ============================================
        # DOMAIN KNOWLEDGE - Construction Expertise
        # ============================================
        domain_knowledge = """
CONSTRUCTION DOMAINS YOU EXCEL IN:

1. MATERIALS:
   - Concrete (types, mixing ratios, curing, additives, reinforcement)
   - Steel (grades, structural steel, rebar, connections)
   - Masonry (bricks, blocks, mortar, stone)
   - Wood and engineered wood products
   - Insulation materials (thermal, acoustic, fire-resistant)
   - Waterproofing and sealants
   - Roofing materials
   - Flooring materials
   - Windows and doors
   - Paints and coatings

2. METHODOLOGIES:
   - Foundation construction (shallow, deep, pile driving)
   - Framing (steel, concrete, wood)
   - Concrete placement and finishing
   - Masonry construction
   - Roofing installation
   - MEP installation
   - Finishing work (drywall, tiling, painting)
   - Prefabrication and modular construction
   - Demolition and renovation

3. TERMINOLOGY:
   - Technical terms in multiple languages
   - Industry abbreviations and acronyms
   - Building code references
   - Measurement units and conversions
   - Material specifications and standards

4. PROJECT MANAGEMENT:
   - Scheduling and sequencing
   - Cost estimation and budgeting
   - Resource allocation
   - Quality control procedures
   - Risk management
   - Contract administration

5. SAFETY:
   - OSHA and local safety regulations
   - Personal Protective Equipment (PPE)
   - Fall protection
   - Hazard identification
   - Emergency procedures
   - Safety training requirements
"""
        
        # ============================================
        # CONVERSATION HISTORY
        # ============================================
        history_text = ""
        if conversation_history and len(conversation_history) > 0:
            recent = conversation_history[-10:]  # Last 10 messages
            history_text = "\n".join([
                f"{msg.get('role', 'user')}: {msg.get('content', '')}" 
                for msg in recent
            ])
            history_text = f"""
RECENT CONVERSATION (for context):
{history_text}
"""
        
        # ============================================
        # CONTEXT INFORMATION
        # ============================================
        context_text = ""
        if context:
            context_info = "\n".join([
                f"{k}: {v}" for k, v in context.items()
            ])
            context_text = f"""
ADDITIONAL CONTEXT:
{context_info}
"""
        
        # ============================================
        # BUILD PROMPT
        # ============================================
        prompt = f"""You are Babel Bot, a professional construction expert assistant.

ROLE:
{role_description}

GUIDELINES:
{guidelines}

DOMAIN KNOWLEDGE:
{domain_knowledge}
{history_text}
{context_text}

USER MESSAGE:
"{user_message}"

YOUR TASK:
Respond as a professional construction engineer and senior construction manager. Provide expert guidance, recommendations, and solutions related to construction, building, materials, methodologies, and all related topics. Be thorough, practical, and professional.

RESPONSE (only the message, no explanations or meta-commentary):"""

        return prompt


# Global instance
response_formatter = ResponseFormatter()

