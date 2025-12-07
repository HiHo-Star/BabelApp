# BabelBot Agent Setup Guide

## Quick Start

### 1. Install Dependencies

```bash
cd Agents/BabelBot-agent
pip install -r requirements.txt
```

### 2. Configure Environment

Create a `.env` file:

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

**Get your Gemini API Key:**
1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the API key (starts with `AIzaSy...`)
5. Paste it in your `.env` file

### 3. Run the Service

```bash
python main.py
```

The service will start on `http://localhost:8003`

### 4. Configure Backend

Add to your backend `.env` file:

```
BABELBOT_SERVICE_URL=http://localhost:8003
```

## Testing

### Test the Chatbot Service Directly

```bash
curl -X POST "http://localhost:8003/chat" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What are the best practices for concrete curing?",
    "session_id": "test-session-123"
  }'
```

### Test Health Check

```bash
curl http://localhost:8003/health
```

## Integration

The BabelBot is automatically integrated with the BabelApp:

1. **Backend Integration**: The backend detects messages sent to chats with IDs starting with `babelbot-` and forwards them to this service
2. **Android App**: Users can access BabelBot from the "Babel Bot" tab in the chat list
3. **Chat ID Format**: Each user gets their own BabelBot chat with ID `babelbot-{userId}`

## Features

- **Construction Domain Expertise**: Specialized knowledge in building/construction
- **Conversation Memory**: Maintains context across messages in a session
- **Multi-language Support**: Responds in the user's language
- **Professional Guidance**: Acts as a senior construction engineer and manager

## Troubleshooting

### Service Won't Start
- Check Python version: `python --version` (need 3.11+)
- Verify dependencies: `pip install -r requirements.txt`
- Check port availability: `netstat -an | grep 8003`

### API Key Issues
- Verify the key is correct in `.env`
- Check if the key has expired (regenerate if needed)
- Ensure API access is enabled in Google Cloud Console

### Backend Can't Connect
- Verify BabelBot service is running: `curl http://localhost:8003/health`
- Check `BABELBOT_SERVICE_URL` in backend `.env`
- Review backend logs for connection errors

