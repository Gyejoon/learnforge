# Generic Integration (REST API)

For any platform that can make HTTP requests.

## Start the Server

```bash
cd /path/to/learnforge
npm run build

# Default port 3737
node dist/adapters/http.js

# Custom port
LEARNFORGE_PORT=8080 node dist/adapters/http.js
```

## API Endpoints

### Ingest Material
```bash
curl -X POST http://localhost:3737/api/ingest \
  -H 'Content-Type: application/json' \
  -d '{"source": "FSRS is a spaced repetition algorithm", "title": "FSRS Intro"}'
```

### List Sources
```bash
curl http://localhost:3737/api/sources
```

### Start Learning Session
```bash
curl -X POST http://localhost:3737/api/learn \
  -H 'Content-Type: application/json' \
  -d '{"mode": "socratic", "topic": "FSRS"}'
```

### Create Flashcards
```bash
curl -X POST http://localhost:3737/api/cards \
  -H 'Content-Type: application/json' \
  -d '{"cards": [{"front": "What is FSRS?", "back": "Spaced repetition algorithm", "cardType": "basic"}]}'
```

### Get Review Cards
```bash
curl http://localhost:3737/api/review
curl http://localhost:3737/api/review?deck=math&limit=10
```

### Submit Answer
```bash
curl -X POST http://localhost:3737/api/answer \
  -H 'Content-Type: application/json' \
  -d '{"cardId": "card-uuid", "rating": 3}'
```

### View Progress
```bash
curl http://localhost:3737/api/progress
curl http://localhost:3737/api/progress?type=heatmap&days=30
curl http://localhost:3737/api/progress?type=forecast&days=7
```

### Export Cards
```bash
curl http://localhost:3737/api/export?format=tsv
curl http://localhost:3737/api/export?format=json&deck=math
```

### System Status
```bash
curl http://localhost:3737/api/status
```

## Response Format

All responses are JSON. Errors return:
```json
{
  "error": "Error message"
}
```

With appropriate HTTP status codes (400 for client errors, 500 for server errors).
