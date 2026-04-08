#!/usr/bin/env python3
import os
from dotenv import load_dotenv

# ---------- LOAD ENV ----------
# Load .env from current project directory
load_dotenv()

# ---------- IMPORT APP ----------
from app import app

# ---------- CONFIG ----------
port = int(os.environ.get("PORT", 5067))
debug = os.environ.get("DEBUG", "False").lower() == "true"

# ---------- RUN ----------
if __name__ == "__main__":
    print(f"🚀 Starting server on port {port}...")
    app.run(host="0.0.0.0", port=port, debug=debug)