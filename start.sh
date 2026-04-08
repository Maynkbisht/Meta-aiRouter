#!/bin/bash

# ---------- CONFIG ----------
PORT=${PORT:-5067}
LOG_FILE="app.log"

export PORT

echo "🚀 Starting META-AI 2.0..."
echo "📍 Directory: $(pwd)"
echo "📝 Logs: $LOG_FILE"
echo "🌐 Port: $PORT"

# ---------- CLEAN PORT (SAFE) ----------
if lsof -i :$PORT > /dev/null; then
    echo "⚠️ Port $PORT in use. Freeing it..."
    lsof -ti :$PORT | xargs kill -9 2>/dev/null
    sleep 1
fi

# ---------- START APP ----------
echo "▶️ Launching server..."

python3 run.py | tee $LOG_FILE