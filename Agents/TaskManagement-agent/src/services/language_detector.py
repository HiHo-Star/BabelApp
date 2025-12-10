"""
Language detection service
Detects English or Hebrew from text input
"""

import re
import logging

logger = logging.getLogger(__name__)


def detect_language(text: str) -> str:
    """
    Detect language from text (English or Hebrew)
    
    Args:
        text: Input text to analyze
        
    Returns:
        'en' for English, 'he' for Hebrew
    """
    if not text or not text.strip():
        return 'en'  # Default to English
    
    # Check for Hebrew characters (Unicode range \u0590-\u05FF)
    hebrew_pattern = re.compile(r'[\u0590-\u05FF]')
    hebrew_chars = len(hebrew_pattern.findall(text))
    total_chars = len(re.findall(r'[a-zA-Z\u0590-\u05FF]', text))
    
    if total_chars == 0:
        return 'en'  # Default if no letters found
    
    # If more than 30% Hebrew characters, consider it Hebrew
    hebrew_ratio = hebrew_chars / total_chars if total_chars > 0 else 0
    
    if hebrew_ratio > 0.3:
        logger.debug(f"Detected Hebrew (ratio: {hebrew_ratio:.2f})")
        return 'he'
    else:
        logger.debug(f"Detected English (ratio: {hebrew_ratio:.2f})")
        return 'en'

