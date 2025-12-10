# TaskManagement Agent Service

AI-powered task extraction and management service that processes natural language input to create, query, and manage tasks in the BabelApp construction project management system.

## Overview

The TaskManagement Agent is a specialized AI service that:
- Extracts task details from natural language (English/Hebrew)
- Classifies tasks (task/subtask/job)
- Matches tasks to missions and projects
- Suggests team assignments
- Estimates time with safety buffers
- Handles retrospective job creation
- Supports multi-turn clarification conversations

## Features

- **Natural Language Processing**: Converts spoken/text input into structured task data
- **Multi-language Support**: English and Hebrew
- **Intelligent Classification**: Distinguishes between tasks, subtasks, and jobs
- **Mission Matching**: Links tasks to existing missions/work packages
- **Team Assignment**: Suggests appropriate teams based on task requirements
- **Time Estimation**: Calculates estimates with +20% safety buffer
- **Retrospective Jobs**: Detects and creates tasks for past work
- **Clarification Flow**: Asks follow-up questions when needed

## Setup

### Prerequisites

- Python 3.10+
- PostgreSQL database access
- Google Gemini API key
- Backend API running (for data polling)

### Installation

1. **Create virtual environment**:
```bash
cd Agents/TaskManagement-agent
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. **Install dependencies**:
```bash
pip install -r requirements.txt
```

3. **Configure environment**:
```bash
cp .env.example .env
# Edit .env with your configuration
```

### Environment Variables

```env
# Gemini Configuration (REQUIRED)
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash

# Database Configuration (REQUIRED)
DATABASE_URL=postgresql://user:password@host:port/dbname

# Backend API URL
BACKEND_API_URL=http://localhost:3000

# Service Configuration
HOST=localhost
PORT=8004
LOG_LEVEL=INFO
```

## Running the Service

### Development

```bash
python main.py
```

### Production

```bash
uvicorn main:app --host 0.0.0.0 --port 8004
```

The service will be available at `http://localhost:8004`

## API Endpoints

### POST `/api/task-management/process`

Process natural language input for task extraction.

**Request**:
```json
{
  "userId": "user-123",
  "text": "We need to install ceiling fixtures before Tuesday",
  "language": "en",
  "context": {}
}
```

**Response**:
```json
{
  "intent": "create",
  "status": "complete",
  "language": "en",
  "tasks": [{
    "title": "Install Ceiling Fixtures",
    "description": "Install all ceiling lighting fixtures in main hall and entrance",
    "priority": "high",
    "taskType": "task",
    "dueDate": "2025-01-30",
    "estimatedHours": 8.0,
    "suggestedTeamId": "lighting-team-id",
    "missionId": "electrification-mission-id",
    "confidence": 0.9,
    "needsClarification": false
  }],
  "execution_time_ms": 1234
}
```

### GET `/health`

Health check endpoint.

**Response**:
```json
{
  "status": "healthy",
  "service": "TaskManagement Agent",
  "version": "1.0.0"
}
```

## Architecture

```
TaskManagement-agent/
├── main.py                 # FastAPI app entry point
├── requirements.txt        # Python dependencies
├── .env.example           # Environment template
└── src/
    ├── config/
    │   └── settings.py    # Configuration management
    ├── database/
    │   ├── connection.py  # PostgreSQL connection pool
    │   ├── queries.py     # Database queries
    │   └── cache.py       # Backend API data cache
    ├── services/
    │   ├── language_detector.py  # EN/HE detection
    │   └── task_extractor.py     # LLM-based extraction
    ├── api/
    │   └── endpoints.py   # API routes
    └── models/
        └── schemas.py     # Pydantic models
```

## Data Flow

1. **Service Startup**: Connects to database and starts polling backend API
2. **Data Polling**: Periodically fetches projects, teams, missions, users from backend
3. **Request Processing**: 
   - Receives natural language input
   - Detects language
   - Extracts task data using Gemini LLM
   - Returns structured task data or clarification questions
4. **Task Creation**: Backend creates task via `/api/taskmanagement/create-task`

## Integration

### Backend Integration

The backend service (`backend/src/services/taskmanagement.ts`) forwards requests to this service.

### Android App Integration

The Android app calls `/api/taskmanagement/process` which forwards to this service.

## Development

### Adding New Features

1. **New Extraction Fields**: Update `TaskData` schema in `src/models/schemas.py`
2. **New Services**: Add to `src/services/`
3. **New Endpoints**: Add to `src/api/endpoints.py`

### Testing

```bash
# Test health endpoint
curl http://localhost:8004/health

# Test task extraction
curl -X POST http://localhost:8004/api/task-management/process \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user",
    "text": "Install ceiling fixtures before Tuesday"
  }'
```

## Troubleshooting

### Database Connection Issues

- Verify `DATABASE_URL` is correct
- Check database is accessible
- Ensure PostgreSQL is running

### Gemini API Issues

- Verify `GEMINI_API_KEY` is set
- Check API quota/limits
- Verify model name is correct

### Backend API Polling Issues

- Verify `BACKEND_API_URL` is correct
- Check backend is running
- Review logs for polling errors

## License

Part of the BabelApp project.

