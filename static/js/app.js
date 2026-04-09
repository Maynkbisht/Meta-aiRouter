/* ═══════════════════════════════════════════════════════
   Meta AI — Chatbot Router  |  app.js
   Matches: Black & White UI (style.css + index.html)
═══════════════════════════════════════════════════════ */

class AIChatbotRouter {
  constructor() {
    this.sessionId       = null;
    this.isLoading       = false;
    this.sessionStartTime = Date.now();
    this.messageCount    = 0;
    this.aiTypeCounts    = { general: 0, language: 0, math: 0 };
    this.promptQueue     = [];
    this.undoCount       = 0;
    this.redoCount       = 0;

    this.initializeElements();
    this.attachEventListeners();
    this.startSessionTimer();
    this.updateSessionStatsDisplay();
    this.loadChatHistory();
  }

  /* ─────────────────────────────────────────
     INIT
  ───────────────────────────────────────── */
  initializeElements() {
    this.chatMessages          = document.getElementById("chat-messages");
    this.messageInput          = document.getElementById("message-input");
    this.sendBtn               = document.getElementById("send-btn");
    this.clearBtn              = document.getElementById("clear-btn");
    this.undoBtn               = document.getElementById("undo-btn");
    this.redoBtn               = document.getElementById("redo-btn");
    this.addToQueueBtn         = document.getElementById("add-to-queue-btn");
    this.processQueueBtn       = document.getElementById("process-queue-btn");
    this.loadingOverlay        = document.getElementById("loading-overlay");
    this.classificationDisplay = document.getElementById("classification-display");
    this.classificationText    = document.getElementById("classification-text");
    this.toastContainer        = document.getElementById("toast-container");
    this.messageCountEl        = document.getElementById("message-count");
    this.sessionTimeEl         = document.getElementById("session-time");
    this.totalMessagesEl       = document.getElementById("total-messages");
    this.pendingPromptsEl      = document.getElementById("pending-prompts");
    this.undoAvailableEl       = document.getElementById("undo-available");
    this.redoAvailableEl       = document.getElementById("redo-available");
    this.generalCountEl        = document.getElementById("general-count");
    this.languageCountEl       = document.getElementById("language-count");
    this.mathCountEl           = document.getElementById("math-count");
    this.pendingListEl         = document.getElementById("pending-list");
    this.charCounter           = document.getElementById("char-counter");
  }

  attachEventListeners() {
    this.sendBtn.addEventListener("click",  () => this.sendMessage());
    this.clearBtn.addEventListener("click", () => this.clearHistory());
    this.undoBtn.addEventListener("click",  () => this.undoMessage());
    this.redoBtn.addEventListener("click",  () => this.redoMessage());
    this.addToQueueBtn.addEventListener("click",    () => this.addToQueue());
    this.processQueueBtn.addEventListener("click",  () => this.processQueue());

    this.messageInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    this.messageInput.addEventListener("input", () => {
      this.autoResizeTextarea();
      if (this.charCounter) {
        this.charCounter.textContent = this.messageInput.value.length;
      }
    });
  }

  autoResizeTextarea() {
    this.messageInput.style.height = "auto";
    this.messageInput.style.height =
      Math.min(this.messageInput.scrollHeight, 120) + "px";
  }

  /* ─────────────────────────────────────────
     STATS DISPLAY
  ───────────────────────────────────────── */
  updateSessionStatsDisplay() {
    if (this.messageCountEl)   this.messageCountEl.textContent   = this.messageCount;
    if (this.totalMessagesEl)  this.totalMessagesEl.textContent  = this.messageCount;
    if (this.pendingPromptsEl) this.pendingPromptsEl.textContent = this.promptQueue.length;
    if (this.undoAvailableEl)  this.undoAvailableEl.textContent  = this.undoCount;
    if (this.redoAvailableEl)  this.redoAvailableEl.textContent  = this.redoCount;
  }

  updateAIStatsDisplay() {
    if (this.generalCountEl)  this.generalCountEl.textContent  = this.aiTypeCounts.general;
    if (this.languageCountEl) this.languageCountEl.textContent = this.aiTypeCounts.language;
    if (this.mathCountEl)     this.mathCountEl.textContent     = this.aiTypeCounts.math;
    if (this.messageCountEl)  this.messageCountEl.textContent  = this.messageCount;
    if (this.totalMessagesEl) this.totalMessagesEl.textContent = this.messageCount;
  }

  updateAIStats(aiType) {
    if (!aiType) return;
    const type = aiType.replace("_prompt", "");
    if (this.aiTypeCounts.hasOwnProperty(type)) {
      this.aiTypeCounts[type]++;
      this.updateAIStatsDisplay();
    }
  }

  /* ─────────────────────────────────────────
     QUEUE
  ───────────────────────────────────────── */
  addToQueue() {
    const prompt = this.messageInput.value.trim();
    if (!prompt) {
      this.showToast("warning", "Empty", "Type a prompt before adding to queue.");
      return;
    }
    this.promptQueue.push(prompt);
    this.updatePendingList();
    this.messageInput.value = "";
    this.autoResizeTextarea();
    if (this.charCounter) this.charCounter.textContent = "0";
    this.showToast("info", "Queued", "Prompt added to the queue.");
    this.updateSessionStatsDisplay();
  }

  updatePendingList() {
    this.pendingListEl.innerHTML = "";
    if (this.promptQueue.length === 0) {
      this.pendingListEl.innerHTML = `<div class="empty-state">No pending prompts</div>`;
    } else {
      this.promptQueue.forEach((prompt, idx) => {
        const div = document.createElement("div");
        div.className = "pending-item";
        div.textContent = `${idx + 1}. ${prompt}`;
        this.pendingListEl.appendChild(div);
      });
    }
    if (this.pendingPromptsEl) {
      this.pendingPromptsEl.textContent = this.promptQueue.length;
    }
    this.updateSessionStatsDisplay();
  }

  async processQueue() {
    if (this.promptQueue.length === 0) {
      this.showToast("warning", "Empty queue", "No prompts in the queue.");
      return;
    }

    this.setLoading(true);
    try {
      const queue = [...this.promptQueue];
      this.promptQueue = [];
      this.updatePendingList();

      for (const prompt of queue) {
        this.addMessageToChat(
          { user_prompt: prompt, ai_response: "", ai_type: "", timestamp: new Date().toISOString() },
          "user"
        );

        const classification = await this.classifyPrompt(prompt);
        this.showClassification(classification);

        if (classification?.category) {
          const typeMap = { general_prompt: "general", language_prompt: "language", math_prompt: "math" };
          const aiType  = typeMap[classification.category];
          if (aiType && this.aiTypeCounts.hasOwnProperty(aiType)) {
            this.aiTypeCounts[aiType]++;
            this.updateAIStatsDisplay();
          }
        }

        const response = await this.callChatAPIStream(prompt);
        if (response.success) {
          this.messageCount++;
          this.updateAIStatsDisplay();
          this.updateSessionStatsDisplay();
        }
      }

      this.hideClassification();
      this.showToast("success", "Queue Processed", "All queued prompts processed.");
    } catch (error) {
      this.showToast("error", "Process Error", "Could not process the queue.");
    } finally {
      this.setLoading(false);
      this.updateSessionStatsDisplay();
    }
  }

  /* ─────────────────────────────────────────
     SEND & STREAM
  ───────────────────────────────────────── */
  async sendMessage() {
    const prompt = this.messageInput.value.trim();
    if (!prompt || this.isLoading) return;

    this.setLoading(true);
    this.messageInput.value = "";
    this.autoResizeTextarea();
    if (this.charCounter) this.charCounter.textContent = "0";

    // Remove welcome screen on first message
    const welcome = this.chatMessages.querySelector(".welcome-message");
    if (welcome) welcome.remove();

    try {
      this.addMessageToChat(
        { user_prompt: prompt, ai_response: "", ai_type: "", timestamp: new Date().toISOString() },
        "user"
      );

      const classification = await this.classifyPrompt(prompt);
      this.showClassification(classification);

      if (classification?.category) {
        const typeMap = { general_prompt: "general", language_prompt: "language", math_prompt: "math" };
        const aiType  = typeMap[classification.category];
        if (aiType && this.aiTypeCounts.hasOwnProperty(aiType)) {
          this.aiTypeCounts[aiType]++;
          this.updateAIStatsDisplay();
        }
      }

      const response = await this.callChatAPIStream(prompt);

      if (response.success) {
        this.messageCount++;
        this.updateAIStatsDisplay();
        this.updateSessionStatsDisplay();
      } else if (response.error) {
        this.showToast("error", "Error", response.error || "Failed to get AI response.");
      }
    } catch (error) {
      console.error("Error sending message:", error);
      this.showToast("error", "Error", "Failed to send message. Please try again.");
    } finally {
      this.setLoading(false);
      this.hideClassification();
    }
  }

  async callChatAPIStream(prompt) {
    try {
      const response = await fetch("/api/chat/stream", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ prompt }),
      });

      if (!response.body) throw new Error("No response body for streaming.");

      const reader  = response.body.getReader();
      const decoder = new TextDecoder();
      let   aiText  = "";

      // Insert empty AI bubble immediately
      const aiMessageObj = {
        user_prompt: prompt, ai_response: "", ai_type: "",
        classification: "", timestamp: new Date().toISOString(),
      };
      this.addMessageToChat(aiMessageObj, "ai");
      const lastEl = this.chatMessages.lastElementChild;
      const textEl = lastEl.querySelector(".message-text");

      // Show typing indicator while waiting for first chunk
      textEl.innerHTML = this._typingIndicatorHTML();

      let firstChunk = true;
      let foundError = false;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        if (firstChunk) {
          firstChunk = false;
          aiText     = "";
        }

        aiText += decoder.decode(value);

        if (aiText.trim().startsWith("[ERROR]")) {
          foundError = true;
          textEl.innerHTML = `<span style="color:#666; font-style:italic;">${this.escapeHTML(aiText.trim())}</span>`;
          this.showToast("error", "Model Error", aiText.trim());
          break;
        }

        textEl.innerHTML = marked.parse(this.unescapeMath(aiText));
        if (window.MathJax) MathJax.typesetPromise([lastEl]);
        this.scrollToBottom();
      }

      if (foundError) return { success: false, error: aiText.trim() };

      // Stamp the timestamp on the bubble now that it's complete
      const metaTime = lastEl.querySelector(".message-timestamp");
      if (metaTime) metaTime.textContent = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

      return { success: true, message: { ...aiMessageObj, ai_response: aiText } };
    } catch (error) {
      console.error("Streaming error:", error);
      this.showToast("error", "Connection Error", error?.message || "Failed to stream AI response.");
      return { success: false, error: error?.message || "Failed to stream AI response." };
    }
  }

  /* ─────────────────────────────────────────
     CLASSIFY
  ───────────────────────────────────────── */
  async classifyPrompt(prompt) {
    try {
      const response = await fetch("/api/classify", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ prompt }),
      });
      const data = await response.json();
      return data.success ? data : null;
    } catch (error) {
      console.error("Classification error:", error);
      return null;
    }
  }

  showClassification(classification) {
    if (!classification) return;
    const categoryMap = {
      general_prompt:  "General AI",
      language_prompt: "Language AI",
      math_prompt:     "Math AI",
    };
    const label      = categoryMap[classification.category] || classification.category;
    const confidence = classification.confidence
      ? ` — ${Math.round(classification.confidence * 100)}% confidence`
      : "";

    this.classificationText.textContent = `Routing to ${label}${confidence}`;
    this.classificationDisplay.style.display = "block";
  }

  hideClassification() {
    this.classificationDisplay.style.display = "none";
  }

  /* ─────────────────────────────────────────
     MESSAGE ELEMENTS
  ───────────────────────────────────────── */
  addMessageToChat(message, type) {
    const el = this.createMessageElement(message, type);
    this.chatMessages.appendChild(el);
    this.scrollToBottom();
    if (type === "ai" && window.MathJax) MathJax.typesetPromise([el]);
  }

  createMessageElement(message, type) {
    const div = document.createElement("div");
    div.className = `message ${type} fade-in`;
    div.innerHTML  = this.createMessageHTML(message, type);
    return div;
  }

  createMessageHTML(message, type) {
    const time   = new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const aiType = message.ai_provider || message.ai_type || message.classification || "";

    const typeMap      = { general_prompt: "General", language_prompt: "Language", math_prompt: "Math" };
    const typeLabel    = typeMap[aiType] || (aiType ? aiType.replace("_prompt", "") : "");
    const typeSlug     = aiType.replace("_prompt", "");

    /* meta row */
    let metaHTML = "";
    if (type === "ai") {
      metaHTML = `
        <div class="message-meta">
          ${typeLabel ? `<span class="ai-type-badge ${typeSlug}">
            <i class="fas fa-microchip"></i> ${typeLabel}
          </span>` : ""}
          <span class="message-timestamp">${time}</span>
        </div>`;
    } else {
      metaHTML = `
        <div class="message-meta">
          <span style="font-family:var(--font-mono); font-size:0.68rem;">You</span>
          <span class="message-timestamp">${time}</span>
        </div>`;
    }

    /* body */
    const bodyHTML = type === "ai"
      ? marked.parse(this.unescapeMath(message.ai_response || ""))
      : this.escapeHTML(message.user_prompt || "");

    return `
      <div class="message-content">
        <div class="message-text">${bodyHTML}</div>
      </div>
      ${metaHTML}
    `;
  }

  /* ─────────────────────────────────────────
     HISTORY  /  UNDO  /  REDO  /  CLEAR
  ───────────────────────────────────────── */
  async loadChatHistory() {
    try {
      const response = await fetch("/api/history");
      const data     = await response.json();

      if (data.success && data.messages.length > 0) {
        const welcome = this.chatMessages.querySelector(".welcome-message");
        if (welcome) welcome.remove();

        data.messages.forEach((msg) => {
          this.addMessageToChat(
            { user_prompt: msg.user_prompt, ai_response: "", ai_type: "", timestamp: msg.timestamp },
            "user"
          );
          this.addMessageToChat(msg, "ai");
          this.updateAIStats(msg.ai_type);
          this.messageCount += 2;
        });

        this.updateAIStatsDisplay();
        this.updateSessionStatsDisplay();
      }
    } catch (error) {
      console.error("Error loading chat history:", error);
    }
  }

  async undoMessage() {
    try {
      const response = await fetch("/api/undo", { method: "POST" });
      const data     = await response.json();

      if (data.success) {
        // Remove last two message elements (AI then User)
        if (this.chatMessages.lastElementChild) this.chatMessages.lastElementChild.remove();
        if (this.chatMessages.lastElementChild) this.chatMessages.lastElementChild.remove();

        this.messageCount = Math.max(0, this.messageCount - 2);

        const aiType = data.undone_message?.ai_type;
        if (aiType) {
          const type = aiType.replace("_prompt", "");
          if (this.aiTypeCounts.hasOwnProperty(type)) {
            this.aiTypeCounts[type] = Math.max(0, this.aiTypeCounts[type] - 1);
          }
        }

        this.undoCount++;
        this.updateAIStatsDisplay();
        this.updateSessionStatsDisplay();
        this.showToast("info", "Undo", "Last message pair removed.");
      } else {
        this.showToast("warning", "Nothing to Undo", data.error || "No messages to undo.");
      }
    } catch (error) {
      this.showToast("error", "Error", "Failed to undo message.");
    }
  }

  async redoMessage() {
    try {
      const response = await fetch("/api/redo", { method: "POST" });
      const data     = await response.json();

      if (data.success) {
        const msg = data.redone_message;
        this.addMessageToChat(
          { user_prompt: msg.user_prompt, ai_response: "", ai_type: "", timestamp: msg.timestamp },
          "user"
        );
        this.addMessageToChat(msg, "ai");

        this.messageCount += 2;
        if (msg.ai_type) {
          const type = msg.ai_type.replace("_prompt", "");
          if (this.aiTypeCounts.hasOwnProperty(type)) this.aiTypeCounts[type]++;
        }

        this.redoCount++;
        this.updateAIStatsDisplay();
        this.updateSessionStatsDisplay();
        this.showToast("info", "Redo", "Last message pair restored.");
      } else {
        this.showToast("warning", "Nothing to Redo", data.error || "No messages to redo.");
      }
    } catch (error) {
      this.showToast("error", "Error", "Failed to redo message.");
    }
  }

  async clearHistory() {
    try {
      const response = await fetch("/api/clear", { method: "POST" });
      const data     = await response.json();

      if (data.success) {
        // Reset all counters
        this.aiTypeCounts = { general: 0, language: 0, math: 0 };
        this.messageCount = 0;
        this.undoCount    = 0;
        this.redoCount    = 0;

        // Remove chat messages (leave welcome panel intact if shown)
        this.chatMessages
          .querySelectorAll(".message.user, .message.ai")
          .forEach((el) => el.remove());

        // If chat is now empty, re-show welcome
        if (!this.chatMessages.querySelector(".message")) {
          this.chatMessages.innerHTML = this._welcomeHTML();
        }

        this.updateAIStatsDisplay();
        this.updateSessionStatsDisplay();
        this.showToast("success", "Cleared", "Chat history and stats reset.");
      } else {
        this.showToast("error", "Error", "Failed to clear history.");
      }
    } catch (error) {
      this.showToast("error", "Error", "Failed to clear history.");
    }
  }

  /* ─────────────────────────────────────────
     LOADING
  ───────────────────────────────────────── */
  setLoading(loading) {
    this.isLoading                    = loading;
    this.loadingOverlay.style.display = loading ? "flex" : "none";
    this.sendBtn.disabled             = loading;
    this.sendBtn.style.opacity        = loading ? "0.5" : "";
  }

  scrollToBottom() {
    this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
  }

  /* ─────────────────────────────────────────
     TOASTS
  ───────────────────────────────────────── */
  showToast(type, title, message) {
    const iconMap = {
      success: "fas fa-check",
      error:   "fas fa-times",
      warning: "fas fa-exclamation",
      info:    "fas fa-info",
    };

    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <i class="${iconMap[type] || "fas fa-info"}"></i>
      <div class="toast-content">
        <div class="toast-title">${title}</div>
        <div class="toast-message">${message}</div>
      </div>
    `;
    this.toastContainer.appendChild(toast);

    // Auto-remove after 4 s
    setTimeout(() => {
      toast.style.opacity   = "0";
      toast.style.transform = "translateX(12px)";
      toast.style.transition = "opacity 0.3s, transform 0.3s";
      setTimeout(() => toast.remove(), 320);
    }, 4000);
  }

  /* ─────────────────────────────────────────
     SESSION TIMER
  ───────────────────────────────────────── */
  startSessionTimer() {
    setInterval(() => {
      const elapsed = Date.now() - this.sessionStartTime;
      const m = Math.floor(elapsed / 60000);
      const s = Math.floor((elapsed % 60000) / 1000);
      if (this.sessionTimeEl) {
        this.sessionTimeEl.textContent =
          `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
      }
    }, 1000);
  }

  /* ─────────────────────────────────────────
     HELPERS
  ───────────────────────────────────────── */
  unescapeMath(text) {
    return text.replace(/\\\$/g, "$");
  }

  escapeHTML(str) {
    if (!str) return "";
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  _typingIndicatorHTML() {
    return `
      <span style="display:inline-flex; align-items:center; gap:4px; padding:2px 0;">
        <span style="width:6px;height:6px;background:#ccc;border-radius:50%;
          animation:typingBounce 1.1s ease-in-out infinite;animation-delay:0s;"></span>
        <span style="width:6px;height:6px;background:#ccc;border-radius:50%;
          animation:typingBounce 1.1s ease-in-out infinite;animation-delay:0.18s;"></span>
        <span style="width:6px;height:6px;background:#ccc;border-radius:50%;
          animation:typingBounce 1.1s ease-in-out infinite;animation-delay:0.36s;"></span>
      </span>
      <style>
        @keyframes typingBounce {
          0%,80%,100% { transform: translateY(0); opacity:0.4; }
          40%          { transform: translateY(-5px); opacity:1; }
        }
      </style>
    `;
  }

  _welcomeHTML() {
    return `
      <div class="welcome-message">
        <div class="welcome-content">
          <div class="welcome-icon-box">
            <i class="fas fa-robot"></i>
          </div>
          <h2>Welcome to Meta AI</h2>
          <p>Ask anything. I'll automatically route your question to the best AI model.</p>
          <div class="ai-options">
            <div class="ai-option">
              <i class="fas fa-globe"></i>
              <span>General AI &mdash; world knowledge &amp; general questions</span>
            </div>
            <div class="ai-option">
              <i class="fas fa-language"></i>
              <span>Language AI &mdash; grammar, translation &amp; writing help</span>
            </div>
            <div class="ai-option">
              <i class="fas fa-calculator"></i>
              <span>Math AI &mdash; equations, proofs &amp; calculations</span>
            </div>
          </div>
          <p class="start-prompt">↓&ensp;type your question below to get started</p>
        </div>
      </div>
    `;
  }
}

/* ── BOOT ── */
document.addEventListener("DOMContentLoaded", () => {
  new AIChatbotRouter();
});
