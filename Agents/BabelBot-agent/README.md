# BabelBot Agent Service

A Gemini-based conversational AI agent specialized in construction and building domain expertise.

## Overview

BabelBot is a professional construction expert chatbot that provides guidance, recommendations, and solutions for all aspects of construction and building projects. It acts as a senior construction engineer and manager, knowledgeable in:

- Construction methodologies and techniques
- Building materials and specifications
- Construction terminology (multiple languages)
- Building codes and regulations
- Project management
- Safety protocols
- And much more...

## Setup

### 1. Prerequisites

- Python 3.11+
- Google Gemini API Key ([Get from Google AI Studio](https://makersuite.google.com/app/apikey))

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Configuration

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Edit `.env` and add your Gemini API key:

```
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash
HOST=localhost
PORT=8003
```

### 4. Run the Service

```bash
python main.py
```

The service will start on `http://localhost:8003`

## API Endpoints

### POST `/chat`

Send a message to BabelBot.

**Request:**
```json
{
  "message": "What are the best practices for concrete curing?",
  "session_id": "optional-session-id",
  "context": {
    "user_id": "user123",
    "project_type": "residential"
  }
}
```

**Response:**
```json
{
  "session_id": "session_1234567890",
  "message": "Concrete curing best practices include...",
  "execution_time_ms": 450
}
```

### GET `/health`

Check service health.

### DELETE `/session/{session_id}`

Clear a conversation session.

## Integration

This service is integrated with the BabelApp backend, which forwards messages from the Android app to this chatbot service.

