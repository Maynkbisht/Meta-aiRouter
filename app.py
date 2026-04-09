import os
import uuid
import time
from dotenv import load_dotenv
from flask import (
    Flask,
    render_template,
    request,
    jsonify,
    session,
    Response,
    stream_with_context,
)
from datetime import datetime

load_dotenv()

# Now import modules that may read environment variables (providers, etc.)
from data_structures import ChatSession, ChatMessage
from classifier import classifier
from api_handler import api_handler

app = Flask(__name__)
app.secret_key = os.environ.get(
    "SECRET_KEY", "your-secret-key-change-this-in-production"
)
sessions = {}


def get_or_create_session():
    session_id = session.get("session_id")
    if not session_id or session_id not in sessions:
        session_id = str(uuid.uuid4())
        session["session_id"] = session_id
        sessions[session_id] = ChatSession(session_id)
    return sessions[session_id]


@app.route("/")
def home():
    return render_template("index.html")


@app.route("/api/chat", methods=["POST"])
def chat():
    try:
        data = request.get_json()
        prompt = data.get("prompt", "").strip()
        if not prompt:
            return jsonify({"error": "Prompt cannot be empty"}), 400
        chat_session = get_or_create_session()
        category, confidence, keyword_matches = classifier.classify_prompt(prompt)
        api_response = api_handler.call_ai_api(prompt, category, keyword_matches)
        if api_response.get("success"):
            message = ChatMessage(
                user_prompt=prompt,
                ai_response=api_response["response"],
                ai_type=api_response.get("provider", category),
                classification=category,
                timestamp=datetime.now(),
                ai_provider=api_response.get(
                    "provider_name", api_response.get("provider")
                ),
            )
            chat_session.add_message(message)
            return jsonify(
                {
                    "success": True,
                    "message": message.to_dict(),
                    "classification": {
                        "category": category,
                        "confidence": confidence,
                        "explanation": classifier.get_classification_explanation(
                            prompt
                        ),
                    },
                    "session_stats": chat_session.get_session_stats(),
                }
            )
        else:
            error_text = api_response.get("error", "Unknown error occurred")
            if isinstance(error_text, dict):
                error_text = f"Error {error_text.get('code', '')}: {error_text.get('message', '')}"
            return jsonify({"success": False, "error": error_text}), 503
    except Exception as e:
        return jsonify({"error": f"Chat processing failed: {str(e)}"}), 500


# --- Streaming Endpoint for AI Chat ---
@app.route("/api/chat/stream", methods=["POST"])
def chat_stream():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "Invalid JSON body"}), 400

        prompt = data.get("prompt", "").strip()
        if not prompt:
            return jsonify({"error": "Prompt cannot be empty"}), 400

        # Resolve session BEFORE entering the generator (session context is
        # not available inside a generator after the response has started)
        chat_session = get_or_create_session()
        session_id = session.get("session_id")  # capture for use inside generator

        category, confidence, keyword_matches = classifier.classify_prompt(prompt)

        def generate():
            api_response = api_handler.call_ai_api(prompt, category, keyword_matches)
            if api_response.get("success"):
                text = api_response["response"]
                # Stream word-by-word
                for word in text.split():
                    yield word + " "
                    time.sleep(0.04)

                # Persist the completed message using the pre-resolved session
                message = ChatMessage(
                    user_prompt=prompt,
                    ai_response=text,
                    ai_type=api_response.get("provider", category),
                    classification=category,
                    timestamp=datetime.now(),
                    ai_provider=api_response.get(
                        "provider_name", api_response.get("provider")
                    ),
                )
                # Use the sessions dict directly since Flask session context
                # is unavailable inside a streaming generator
                if session_id and session_id in sessions:
                    sessions[session_id].add_message(message)
            else:
                error_text = api_response.get("error", "Unknown error occurred")
                if isinstance(error_text, dict):
                    error_text = (
                        f"[ERROR] {error_text.get('code', '')}: "
                        f"{error_text.get('message', '')}"
                    )
                else:
                    error_text = f"[ERROR] {error_text}"
                yield error_text

        return Response(
            stream_with_context(generate()),
            mimetype="text/plain",
            headers={
                # Keep the connection alive while streaming
                "X-Accel-Buffering": "no",
                "Cache-Control": "no-cache",
            },
        )

    except Exception as e:
        return jsonify({"error": f"Stream endpoint failed: {str(e)}"}), 500


@app.route("/api/classify", methods=["POST"])
def classify():
    data = request.get_json()
    prompt = data.get("prompt", "").strip()
    category, confidence, keyword_matches = classifier.classify_prompt(prompt)
    return jsonify(
        {
            "success": True,
            "category": category,
            "confidence": confidence,
            "keyword_matches": keyword_matches,
        }
    )


@app.route("/api/clear", methods=["POST"])
def clear():
    chat_session = get_or_create_session()
    chat_session.clear()
    return jsonify({"success": True, "session_stats": chat_session.get_session_stats()})


@app.route("/api/undo", methods=["POST"])
def undo():
    chat_session = get_or_create_session()
    undone_message = chat_session.undo()
    if undone_message:
        return jsonify(
            {
                "success": True,
                "undone_message": undone_message.to_dict(),
                "session_stats": chat_session.get_session_stats(),
            }
        )
    return jsonify(
        {
            "success": False,
            "error": "No messages to undo",
            "session_stats": chat_session.get_session_stats(),
        }
    )


@app.route("/api/redo", methods=["POST"])
def redo():
    chat_session = get_or_create_session()
    redone_message = chat_session.redo()
    if redone_message:
        return jsonify(
            {
                "success": True,
                "redone_message": redone_message.to_dict(),
                "session_stats": chat_session.get_session_stats(),
            }
        )
    return jsonify(
        {
            "success": False,
            "error": "No messages to redo",
            "session_stats": chat_session.get_session_stats(),
        }
    )


@app.route("/api/history", methods=["GET"])
def history():
    chat_session = get_or_create_session()
    messages = [msg.to_dict() for msg in chat_session.messages]
    return jsonify(
        {
            "success": True,
            "messages": messages,
            "session_stats": chat_session.get_session_stats(),
        }
    )


@app.route("/api/pending", methods=["POST", "GET"])
def pending():
    chat_session = get_or_create_session()
    if request.method == "GET":
        return jsonify(
            {
                "success": True,
                "pending_prompts": chat_session.pending_queue,
                "session_stats": chat_session.get_session_stats(),
            }
        )
    data = request.get_json()
    prompt = data.get("prompt", "").strip()
    if prompt:
        chat_session.add_pending(prompt)
        return jsonify(
            {"success": True, "session_stats": chat_session.get_session_stats()}
        )
    return jsonify(
        {
            "success": False,
            "error": "No prompt provided",
            "session_stats": chat_session.get_session_stats(),
        }
    )


@app.route("/api/pending/process", methods=["POST"])
def process_queue():
    chat_session = get_or_create_session()
    prompt = chat_session.process_pending()
    if prompt:
        category, confidence, keyword_matches = classifier.classify_prompt(prompt)
        api_response = api_handler.call_ai_api(prompt, category, keyword_matches)
        if api_response.get("success"):
            message = ChatMessage(
                user_prompt=prompt,
                ai_response=api_response["response"],
                ai_type=api_response.get("provider", category),
                classification=category,
                timestamp=datetime.now(),
                ai_provider=api_response.get(
                    "provider_name", api_response.get("provider")
                ),
            )
            chat_session.add_message(message)
            return jsonify(
                {
                    "success": True,
                    "message": message.to_dict(),
                    "session_stats": chat_session.get_session_stats(),
                }
            )
        else:
            error_text = api_response.get("error", "Unknown error occurred")
            if isinstance(error_text, dict):
                error_text = f"Error {error_text.get('code', '')}: {error_text.get('message', '')}"
            return jsonify(
                {
                    "success": False,
                    "error": error_text,
                    "session_stats": chat_session.get_session_stats(),
                }
            )
    return jsonify(
        {
            "success": False,
            "error": "No pending prompts",
            "session_stats": chat_session.get_session_stats(),
        }
    )


if __name__ == "__main__":
    os.makedirs("templates", exist_ok=True)
    os.makedirs("static", exist_ok=True)
    os.makedirs("static/css", exist_ok=True)
    os.makedirs("static/js", exist_ok=True)
    port = int(os.environ.get("PORT", 5022))
    app.run(debug=True, host="0.0.0.0", port=port)
