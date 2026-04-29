# META-AI: Multi-Provider AI Routing Chatbot

A Flask-based chatbot platform that intelligently routes user prompts to the best AI provider based on prompt classification and provider strengths.

Live Demo: https://meta-airouter.onrender.com


## Features

✨ **Multi-Provider Support**

- Seamlessly switch between multiple AI providers (Gemini, OpenAI, Claude, etc.)
- Automatic provider selection based on prompt type and provider strengths
- Easy to add new providers

🧠 **Smart Prompt Classification**

- Classifies prompts by intent: math, language, general, weather, news, greeting
- Keyword extraction for fine-grained routing decisions
- Confidence scoring for each classification

💬 **Chat Management**

- Session-based chat history with undo/redo
- Pending queue for batch processing
- Real-time streaming responses
- Session statistics and metrics

🎨 **Modern UI**

- Clean, responsive interface with sidebar statistics
- Real-time AI type tracking
- Queue management interface
- Toast notifications for user feedback

## Architecture

### Core Components

**Provider System** (`providers.py`)

- Abstract `Provider` base class defining the interface
- Concrete implementations: Gemini, OpenAI, Claude, LocalEcho
- Provider registry with simple plugin system

**Classifier** (`classifier.py`)

- Uses regex patterns and keyword matching for prompt analysis
- Supports categories: `general_prompt`, `language_prompt`, `math_prompt`, `weather_prompt`, `news_prompt`, `greeting_prompt`
- Returns category, confidence score, and keyword matches

**API Handler** (`api_handler.py`)

- Scores all providers based on:
  - Exact category match with provider strengths (0.6 points)
  - Keyword overlap with provider capabilities (0.2 points)
  - Provider quality baseline (0.2 points)
- Selects highest-scoring provider and calls it
- Returns response with provider metadata

**Data Structures** (`data_structures.py`)

- `ChatMessage`: stores prompt, response, classification, timestamp, and provider used
- `ChatSession`: manages message history, undo/redo stacks, pending queue

**Flask App** (`app.py`)

- REST endpoints for chat, classification, session management
- Streaming support for real-time responses
- Queue management (add pending, process pending)

## Installation & Setup

### 1. Install Python Dependencies

```bash
pip install Flask requests
```

Update `requirements.txt` if needed:

```
Flask>=2.0.0
requests>=2.25.0
```

### 2. Set Up Environment Variables

```bash
# For Gemini (Google)
export GEMINI_API_KEY="your-gemini-api-key"

# For OpenAI (optional)
export OPENAI_API_KEY="your-openai-api-key"

# For Claude (optional)
export CLAUDE_API_KEY="your-claude-api-key"

# Optional Flask secret
export SECRET_KEY="your-secret-key"
```

### 3. Run the Application

```bash
npm start
```

The app starts on `http://localhost:5010`

## API Endpoints

### Chat Endpoint

**POST** `/api/chat`

Send a prompt and get a response from the best-matched provider.

```json
{
  "prompt": "What is the capital of France?"
}
```

Response:

```json
{
  "success": true,
  "message": {
    "user_prompt": "What is the capital of France?",
    "ai_response": "- **The capital of France is Paris.**",
    "ai_type": "gemini",
    "classification": "general_prompt",
    "ai_provider": "Gemini (Google)",
    "timestamp": "2025-12-15 14:30:45"
  },
  "classification": {
    "category": "general_prompt",
    "confidence": 0.86,
    "explanation": "Classified as General AI because prompt doesn't match specific math, language, weather, news, or greeting patterns."
  },
  "session_stats": {
    "messages": 1,
    "pending": 0,
    "undo": 1,
    "redo": 0
  }
}
```

### Stream Chat Endpoint

**POST** `/api/chat/stream`

Get streaming response with word-by-word output.

### Classify Endpoint

**POST** `/api/classify`

Get classification details without calling an AI provider.

```json
{
  "prompt": "Solve x^2 + 2x + 1 = 0"
}
```

### Queue Management

- **POST** `/api/pending` - Add prompt to queue
- **GET** `/api/pending` - View queue
- **POST** `/api/pending/process` - Process one pending prompt

### Session Management

- **POST** `/api/clear` - Clear chat history
- **POST** `/api/undo` - Undo last message
- **POST** `/api/redo` - Redo last undone message
- **GET** `/api/history` - Get full chat history

## Adding New AI Providers

### Step 1: Create Provider Class

Create a new class in `providers.py` that inherits from `Provider`:

```python
class MyNewAIProvider(Provider):
    def __init__(self):
        super().__init__(
            id='mynewai',                           # Unique ID
            name='My New AI (Company)',             # Display name
            strengths=['general_prompt', 'math_prompt'],  # What it's good at
            quality=0.85                            # Base quality score (0-1)
        )
        self.api_key = os.environ.get('MYNEWAI_API_KEY')

    def call(self, prompt: str) -> Dict[str, Any]:
        """Implement API call logic here."""
        if not self.api_key:
            return {
                'success': False,
                'error': 'API key not configured (MYNEWAI_API_KEY)'
            }

        try:
            # Your API call logic
            response = requests.post(
                'https://api.mynewai.com/chat',
                headers={'Authorization': f'Bearer {self.api_key}'},
                json={'prompt': prompt},
                timeout=20
            )
            response.raise_for_status()
            data = response.json()

            # Extract and return response
            return {
                'success': True,
                'response': data.get('text', ''),
                'raw': data
            }
        except Exception as e:
            return {
                'success': False,
                'error': f'API call failed: {e}'
            }
```

### Step 2: Register Provider

Add your provider to the `PROVIDERS` list at the bottom of `providers.py`:

```python
PROVIDERS: List[Provider] = [
    GeminiProvider(),
    OpenAIProvider(),
    ClaudeProvider(),
    MyNewAIProvider(),        # ← Add your new provider here
    LocalEchoProvider(),
]
```

### Step 3: Set Environment Variable

```bash
export MYNEWAI_API_KEY="your-api-key"
```

### Step 4: Test

Send a prompt via the API or UI. Your provider will be scored and used if it's the best match for that prompt type.

## Understanding Provider Scoring

The system uses a simple scoring algorithm to select the best provider:

```
Score = 0.6 * (category match) + 0.2 * (keyword overlap) + 0.2 * (quality)
```

**Category Match (0.6)**

- Full 0.6 points if provider's `strengths` includes the classified prompt category
- Example: Math prompt + math-strong provider = 0.6 boost

**Keyword Overlap (0.2)**

- Points based on how many keywords from classification match provider strengths
- Example: 2/3 keywords match = 0.2 × (2/3) ≈ 0.13 points

**Quality (0.2)**

- Provider's base quality score (0.0–1.0)
- Example: quality=0.9 = 0.2 × 0.9 = 0.18 points

**Final Score Range: 0.0–1.0**

Highest-scoring provider wins. Ties broken by quality score.

## Prompt Classification Examples

| Prompt                  | Category          | Keywords                   |
| ----------------------- | ----------------- | -------------------------- |
| "What is sin(45°)?"     | `math_prompt`     | math, sin, formula         |
| "Correct this sentence" | `language_prompt` | correct, sentence, grammar |
| "What's the weather?"   | `weather_prompt`  | weather                    |
| "Hello!"                | `greeting_prompt` | hello                      |
| "Tell me a joke"        | `general_prompt`  | (none)                     |

## Project Structure

```
META-AI/
├── app.py                 # Flask application
├── providers.py           # Provider implementations (Gemini, OpenAI, etc.)
├── api_handler.py         # Routes prompts to best provider
├── classifier.py          # Classifies prompts by intent
├── data_structures.py     # ChatMessage, ChatSession classes
├── requirements.txt       # Python dependencies
├── README.md             # This file
├── templates/
│   └── index.html        # Web UI
└── static/
    ├── css/
    │   └── style.css     # Styling
    └── js/
        └── app.js        # Frontend logic
```

## Configuration & Customization

### Adding New Prompt Classifications

Edit `classifier.py` to add new prompt categories and keywords:

```python
# In classifier.classify_prompt()
if "your_keyword" in prompt:
    return "your_category_prompt", 0.95, ["keyword1", "keyword2"]
```

Then add `your_category_prompt` to at least one provider's strengths.

### Adjusting Scoring Weights

Edit the scoring logic in `api_handler.py` `_score_provider()` function:

```python
score += 0.6  # Category match weight
score += 0.2  # Keyword overlap weight
score += 0.2  # Quality weight
```

### Setting Provider Qualities

Adjust individual provider quality in `providers.py`:

```python
super().__init__(
    id='gemini',
    name='Gemini (Google)',
    strengths=['language_prompt', 'general_prompt'],
    quality=0.90  # ← Adjust here (0.0–1.0)
)
```

## Example Usage

### Using the Web UI

1. Navigate to `http://localhost:5010`
2. Type a prompt (e.g., "What's 2+2?")
3. Watch as the system classifies and routes to the best provider
4. See which AI was used in the message metadata

### Using curl

```bash
# Single chat
curl -X POST http://localhost:5010/api/chat \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Translate hello to Spanish"}'

# Classify only
curl -X POST http://localhost:5010/api/classify \
  -H "Content-Type: application/json" \
  -d '{"prompt": "What is 15 * 12?"}'

# Add to queue
curl -X POST http://localhost:5010/api/pending \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Question 1"}'

curl -X POST http://localhost:5010/api/pending \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Question 2"}'

# Process queue
curl -X POST http://localhost:5010/api/pending/process
```

## Troubleshooting

**"No AI providers available"**

- Check that at least one provider has an API key set
- LocalEchoProvider doesn't need an API key and works offline

**Provider returning error despite valid API key**

- Check API key format and validity
- Verify network connectivity to provider's API
- Check provider-specific error message in response

**Wrong provider being selected**

- Review prompt classification in the UI
- Check provider strengths in `providers.py`
- Adjust quality scores to favor certain providers

## Performance & Limits

- Default request timeout: 20 seconds per API call
- LocalEchoProvider: instant, no external dependencies
- Streaming: word-by-word with 50ms delay per word

## Future Improvements

- [ ] Provider fallback chain (if primary fails, try secondary)
- [ ] User-selectable provider preference
- [ ] Provider-specific prompt templates/instructions
- [ ] Provider cost tracking and optimization
- [ ] Async/concurrent provider calls for comparison
- [ ] User feedback loop to improve scoring

## License

MIT (customize as needed)

## Contributing

To add a new provider:

1. Fork/clone this repo
2. Create provider class in `providers.py`
3. Add to `PROVIDERS` list
4. Update this README with usage example
5. Test with various prompts
6. Submit PR with documentation

---

**Made with ❤️ for seamless AI routing**
