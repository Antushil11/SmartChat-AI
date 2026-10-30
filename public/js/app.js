/**
 * SmartChat AI — Universal Frontend Controller
 * Complete voice recognition & audio recording support, direct AI responses,
 * multi-persona system, Markdown rendering, code highlighting, and session memory.
 */

'use strict';

// ─── STATE ────────────────────────────────────────────────────────
const state = {
  currentPersona: 'nova',
  sessionId: null,
  sessions: [],
  messages: [],
  isLoading: false,
  isDarkTheme: true,
  isRecording: false,
  pendingFile: null,
  voiceMode: null, // 'speech' | 'recorder'
  recognition: null,
  mediaRecorder: null,
  audioChunks: [],
  recordInterval: null,
  recordSeconds: 0
};

// ─── PERSONA DEFINITIONS ──────────────────────────────────────────
const PERSONA_CONFIG = {
  nova: {
    id: 'nova',
    name: 'Nova',
    title: 'General Assistant',
    emoji: '🌟',
    color: '#7C3AED',
    gradient: 'linear-gradient(135deg, #7C3AED, #4F46E5)',
    greeting: "Hi! I'm Nova, your intelligent AI assistant. What would you like to explore today? ✨"
  },
  coda: {
    id: 'coda',
    name: 'Coda',
    title: 'Code Expert',
    emoji: '💻',
    color: '#059669',
    gradient: 'linear-gradient(135deg, #059669, #0284C7)',
    greeting: "Hey! I'm Coda, your coding expert. Ask me about algorithms, debugging, or building apps. What are we coding? 🚀"
  },
  aria: {
    id: 'aria',
    name: 'Aria',
    title: 'Creative Writer',
    emoji: '🎨',
    color: '#DB2777',
    gradient: 'linear-gradient(135deg, #DB2777, #9333EA)',
    greeting: "Hello! I'm Aria, your creative writing partner. Let's create something imaginative! 🌸"
  },
  sage: {
    id: 'sage',
    name: 'Sage',
    title: 'Research Analyst',
    emoji: '🔬',
    color: '#D97706',
    gradient: 'linear-gradient(135deg, #D97706, #DC2626)',
    greeting: "Greetings! I'm Sage, your research and analysis specialist. What topic shall we investigate? 📚"
  }
};

const API_BASE = '/api';

// ─── DOM SELECTORS ────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);

const dom = {
  body:             document.body,
  sidebar:          $('sidebar'),
  btnSidebarToggle: $('btn-sidebar-toggle'),
  btnNewChat:       $('btn-new-chat'),
  btnClearHistory:  $('btn-clear-history'),
  btnToggleTheme:   $('btn-toggle-theme'),
  iconMoon:         document.querySelector('.icon-moon'),
  iconSun:          document.querySelector('.icon-sun'),
  themeLabel:       $('theme-label'),
  serverStatus:     $('server-status'),
  historyList:      $('history-list'),

  topbarPersona:    $('topbar-persona'),
  topbarAvatar:     $('topbar-avatar'),
  topbarName:       $('topbar-name'),

  chatArea:         $('chat-area'),
  welcomeScreen:    $('welcome-screen'),
  messagesContainer:$('messages-container'),

  btnSettingsToggle:$('btn-settings-toggle'),
  btnVoiceToggle:   $('btn-voice-toggle'),
  btnExportChat:    $('btn-export-chat'),

  filePreview:      $('file-preview'),
  filePreviewInner: $('file-preview-inner'),
  btnRemoveFile:    $('btn-remove-file'),
  voiceIndicator:   $('voice-indicator'),
  voiceIndicatorText:$('voice-indicator-text'),

  inputBox:         document.querySelector('.input-box'),
  messageInput:     $('message-input'),
  btnAttach:        $('btn-attach'),
  fileInput:        $('file-input'),
  btnMic:           $('btn-mic'),
  btnSend:          $('btn-send'),
  charCount:        $('char-count'),

  toastContainer:   $('toast-container'),
  imageModal:       $('image-modal'),
  modalImage:       $('modal-image'),
  btnCloseImageModal: $('btn-close-image-modal'),

  // Settings modal
  settingsModal:        $('settings-modal'),
  btnCloseSettingsModal:$('btn-close-settings-modal'),
  btnCancelSettings:    $('btn-cancel-settings'),
  btnSaveSettings:      $('btn-save-settings'),
  inputApiKey:          $('input-api-key'),
  selectModel:          $('select-model'),
  keyStatusIndicator:   $('key-status-indicator'),
  voiceBadge:           $('voice-badge'),
  voiceDesc:            $('voice-desc'),
  btnToggleKeyVisibility:$('btn-toggle-key-visibility')
};

// ─── CONFIGURE MARKED ─────────────────────────────────────────────
if (typeof marked !== 'undefined') {
  marked.setOptions({
    breaks: true,
    gfm: true,
    highlight: (code, lang) => {
      if (typeof hljs !== 'undefined' && lang && hljs.getLanguage(lang)) {
        try { return hljs.highlight(code, { language: lang }).value; }
        catch(e) {}
      }
      return typeof hljs !== 'undefined' ? hljs.highlightAuto(code).value : code;
    }
  });
}

// ─── THEME ───────────────────────────────────────────────────────
function initTheme() {
  const saved = localStorage.getItem('smartchat-theme') || 'dark';
  state.isDarkTheme = saved === 'dark';
  applyTheme();
}

function applyTheme() {
  dom.body.setAttribute('data-theme', state.isDarkTheme ? 'dark' : 'light');
  if (dom.themeLabel) dom.themeLabel.textContent = state.isDarkTheme ? 'Light Mode' : 'Dark Mode';
  if (dom.iconMoon) dom.iconMoon.classList.toggle('hidden', !state.isDarkTheme);
  if (dom.iconSun) dom.iconSun.classList.toggle('hidden', state.isDarkTheme);
  localStorage.setItem('smartchat-theme', state.isDarkTheme ? 'dark' : 'light');
}

function toggleTheme() {
  state.isDarkTheme = !state.isDarkTheme;
  applyTheme();
}

// ─── PERSONA ──────────────────────────────────────────────────────
function setPersona(personaId) {
  if (!PERSONA_CONFIG[personaId]) return;

  state.currentPersona = personaId;
  const cfg = PERSONA_CONFIG[personaId];

  // Update sidebar active state
  document.querySelectorAll('.persona-card').forEach(el => {
    el.classList.toggle('active', el.dataset.persona === personaId);
  });

  // Update quick personas on welcome screen
  document.querySelectorAll('.quick-persona-btn').forEach(el => {
    el.classList.toggle('active', el.dataset.persona === personaId);
  });

  // Update topbar
  if (dom.topbarAvatar) {
    dom.topbarAvatar.textContent = cfg.emoji;
    dom.topbarAvatar.style.background = cfg.gradient;
  }
  if (dom.topbarName) {
    dom.topbarName.textContent = cfg.name;
  }

  // Update welcome greeting if empty
  if (state.messages.length === 0) {
    showWelcome(true);
  }

  localStorage.setItem('smartchat-persona', personaId);
}

// ─── SESSIONS & HISTORY ───────────────────────────────────────────
async function loadSessions() {
  try {
    const res = await fetch(`${API_BASE}/sessions`);
    const data = await res.json();
    if (data.success) {
      state.sessions = data.sessions || [];
      renderHistory();
    }
  } catch (e) {
    console.warn('Could not load sessions:', e.message);
  }
}

function renderHistory() {
  if (!dom.historyList) return;

  if (state.sessions.length === 0) {
    dom.historyList.innerHTML = '<div class="history-empty">No conversation history yet</div>';
    return;
  }

  dom.historyList.innerHTML = state.sessions.map(s => `
    <div class="history-item ${s.id === state.sessionId ? 'active' : ''}" data-session="${s.id}" tabindex="0">
      <div class="history-item-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
      </div>
      <div class="history-item-text">
        <div class="history-item-title">${escapeHtml(s.lastMessage || 'Conversation')}</div>
        <div class="history-item-date">${formatRelativeTime(s.updatedAt)}</div>
      </div>
      <button class="history-item-delete" onclick="event.stopPropagation(); deleteSession('${s.id}')" title="Delete conversation">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
        </svg>
      </button>
    </div>
  `).join('');

  // Attach click listeners
  dom.historyList.querySelectorAll('.history-item').forEach(el => {
    el.addEventListener('click', () => loadSession(el.dataset.session));
    el.addEventListener('keydown', e => { if (e.key === 'Enter') loadSession(el.dataset.session); });
  });
}

async function loadSession(sessionId) {
  try {
    const res = await fetch(`${API_BASE}/sessions/${sessionId}`);
    const data = await res.json();
    if (!data.success) return;

    state.sessionId = sessionId;
    state.messages = data.session.messages || [];

    dom.messagesContainer.innerHTML = '';
    showWelcome(false);

    state.messages.forEach(msg => {
      if (msg.role === 'user') renderUserMessage(msg);
      else renderAIMessage(msg);
    });

    scrollToBottom();
    renderHistory();
    showToast('Conversation loaded', 'info');
  } catch (e) {
    showToast('Failed to load conversation', 'error');
  }
}

async function deleteSession(sessionId) {
  try {
    await fetch(`${API_BASE}/sessions/${sessionId}`, { method: 'DELETE' });
    state.sessions = state.sessions.filter(s => s.id !== sessionId);
    if (state.sessionId === sessionId) {
      newChat();
    } else {
      renderHistory();
    }
    showToast('Conversation deleted', 'info');
  } catch (e) {
    showToast('Failed to delete conversation', 'error');
  }
}

async function clearAllHistory() {
  try {
    await fetch(`${API_BASE}/sessions`, { method: 'DELETE' });
    state.sessions = [];
    newChat();
    showToast('All conversations cleared', 'success');
  } catch (e) {
    showToast('Failed to clear history', 'error');
  }
}

function newChat() {
  state.sessionId = null;
  state.messages = [];
  dom.messagesContainer.innerHTML = '';
  showWelcome(true);
  removePendingFile();
  if (dom.messageInput) {
    dom.messageInput.value = '';
    dom.messageInput.focus();
  }
  updateSendBtn();
  updateCharCount();
  renderHistory();
}

// ─── MESSAGE RENDERING ────────────────────────────────────────────
function renderUserMessage(msg) {
  const group = document.createElement('div');
  group.className = 'message-group user';
  group.id = `msg-${msg.id}`;

  let fileHtml = '';
  if (msg.file) {
    const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(msg.file.name);
    const isAudio = /\.(webm|wav|mp3|ogg|m4a|aac)$/i.test(msg.file.name) || (msg.file.mimetype && msg.file.mimetype.startsWith('audio/'));

    if (isImage) {
      fileHtml = `
        <div class="msg-image-preview" onclick="openImageModal('${msg.file.url}')">
          <img src="${msg.file.url}" alt="${escapeHtml(msg.file.name)}" loading="lazy" />
        </div>`;
    } else if (isAudio) {
      fileHtml = `
        <div class="msg-audio-attachment">
          <div class="msg-audio-header">
            <span class="msg-audio-icon">🎙️</span>
            <span class="msg-audio-name">${escapeHtml(msg.file.name)}</span>
          </div>
          <audio controls src="${msg.file.url}" preload="metadata"></audio>
        </div>`;
    } else {
      const icon = getFileIcon(msg.file.name);
      fileHtml = `
        <div class="msg-file-attachment" onclick="window.open('${msg.file.url}','_blank')">
          <div class="msg-file-icon">${icon}</div>
          <div class="msg-file-info">
            <div class="msg-file-name">${escapeHtml(msg.file.name)}</div>
            <div class="msg-file-size">${formatFileSize(msg.file.size)}</div>
          </div>
        </div>`;
    }
  }

  group.innerHTML = `
    <div class="msg-avatar user-avatar">You</div>
    <div class="msg-body">
      <div class="msg-meta">
        <span class="msg-name">You</span>
        <span>${formatTime(msg.timestamp)}</span>
      </div>
      ${fileHtml}
      ${msg.content ? `<div class="msg-bubble">${escapeHtml(msg.content)}</div>` : ''}
      <div class="msg-actions">
        <button class="msg-action-btn" onclick="copyText('${escapeHtml(msg.content || '')}')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
          Copy
        </button>
      </div>
    </div>`;

  dom.messagesContainer.appendChild(group);
}

function renderAIMessage(msg, isNew = false) {
  const persona = msg.persona || state.currentPersona;
  const cfg = PERSONA_CONFIG[persona] || PERSONA_CONFIG.nova;

  const group = document.createElement('div');
  group.className = 'message-group ai';
  group.id = `msg-${msg.id}`;

  const renderedContent = renderMarkdown(msg.content);

  group.innerHTML = `
    <div class="msg-avatar" style="background: ${cfg.gradient}">${cfg.emoji}</div>
    <div class="msg-body">
      <div class="msg-meta">
        <span class="msg-name">${cfg.name}</span>
        <span class="msg-badge">${cfg.title}</span>
        <span>${formatTime(msg.timestamp)}</span>
      </div>
      <div class="msg-bubble markdown-body">${renderedContent}</div>
      <div class="msg-actions">
        <button class="msg-action-btn" onclick="copyMessageText('${group.id}')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
          Copy
        </button>
        <button class="msg-action-btn" onclick="speakText('${group.id}')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
          </svg>
          Speak
        </button>
      </div>
    </div>`;

  dom.messagesContainer.appendChild(group);

  // Add copy buttons to code blocks
  group.querySelectorAll('pre').forEach(pre => addCodeCopyButton(pre));
}

function addCodeCopyButton(pre) {
  const header = document.createElement('div');
  header.className = 'code-block-header';

  const codeEl = pre.querySelector('code');
  const langMatch = codeEl ? (codeEl.className.match(/language-(\w+)/) || []) : [];
  const lang = langMatch[1] || 'code';

  header.innerHTML = `
    <span class="code-lang">${lang}</span>
    <button class="btn-copy-code" title="Copy code">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
      </svg>
      Copy
    </button>`;

  pre.insertBefore(header, pre.firstChild);

  header.querySelector('.btn-copy-code').addEventListener('click', () => {
    const code = codeEl ? codeEl.textContent : '';
    navigator.clipboard.writeText(code).then(() => {
      const btn = header.querySelector('.btn-copy-code');
      btn.classList.add('copied');
      btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Copied!`;
      setTimeout(() => {
        btn.classList.remove('copied');
        btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy`;
      }, 2000);
    });
  });
}

function renderTypingIndicator() {
  const group = document.createElement('div');
  group.className = 'message-group ai typing-indicator';
  group.id = 'typing-indicator';

  const cfg = PERSONA_CONFIG[state.currentPersona] || PERSONA_CONFIG.nova;

  group.innerHTML = `
    <div class="msg-avatar" style="background: ${cfg.gradient}">${cfg.emoji}</div>
    <div class="msg-body">
      <div class="msg-meta">
        <span class="msg-name">${cfg.name}</span>
        <span>typing…</span>
      </div>
      <div class="msg-bubble">
        <div class="typing-dots">
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
        </div>
      </div>
    </div>`;

  dom.messagesContainer.appendChild(group);
  scrollToBottom();
  return group;
}

function removeTypingIndicator() {
  const el = $('typing-indicator');
  if (el) el.remove();
}

function renderMarkdown(text) {
  if (typeof marked !== 'undefined') {
    try {
      return marked.parse(text);
    } catch(e) {
      return escapeHtml(text).replace(/\n/g, '<br>');
    }
  }
  return escapeHtml(text).replace(/\n/g, '<br>');
}

// ─── SEND MESSAGE ─────────────────────────────────────────────────
async function sendMessage() {
  const text = dom.messageInput.value.trim();
  const file = state.pendingFile;

  if (!text && !file) return;
  if (state.isLoading) return;

  showWelcome(false);

  state.isLoading = true;
  updateSendBtn();
  dom.messageInput.value = '';
  autoResizeTextarea();
  updateCharCount();

  const userMsg = {
    id: `user-${Date.now()}`,
    role: 'user',
    content: text,
    file: file ? { name: file.name, size: file.size, url: URL.createObjectURL(file) } : null,
    timestamp: new Date()
  };

  state.messages.push(userMsg);
  renderUserMessage(userMsg);
  scrollToBottom();

  renderTypingIndicator();

  try {
    let res;
    if (file) {
      const formData = new FormData();
      formData.append('file', file);
      if (text) formData.append('message', text);
      formData.append('persona', state.currentPersona);
      if (state.sessionId) formData.append('sessionId', state.sessionId);

      res = await fetch(`${API_BASE}/chat/upload`, { method: 'POST', body: formData });
    } else {
      res = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          persona: state.currentPersona,
          sessionId: state.sessionId
        })
      });
    }

    const data = await res.json();
    removeTypingIndicator();

    if (!data.success) {
      throw new Error(data.error || 'Failed to process request');
    }

    if (data.file) {
      const lastUserMsg = state.messages.find(m => m.id === userMsg.id);
      if (lastUserMsg && lastUserMsg.file) {
        lastUserMsg.file.url = data.file.url;
      }
    }

    state.sessionId = data.sessionId;
    state.messages.push(data.message);
    renderAIMessage(data.message, true);
    scrollToBottom();

    removePendingFile();
    await loadSessions();

  } catch (err) {
    removeTypingIndicator();
    console.error('Chat error:', err);
    showToast(`Error: ${err.message}`, 'error');

    // Add clean helpful message
    const errorNotice = {
      id: `ai-${Date.now()}`,
      role: 'assistant',
      content: `⚠️ **Unable to complete response**\n\n${err.message}\n\nPlease check your server connection or open **Settings (⚙️)** in the top bar to verify your configuration.`,
      persona: state.currentPersona,
      timestamp: new Date()
    };
    state.messages.push(errorNotice);
    renderAIMessage(errorNotice, true);
    scrollToBottom();
  } finally {
    state.isLoading = false;
    updateSendBtn();
    if (dom.messageInput) dom.messageInput.focus();
  }
}

// ─── INPUT HELPERS ────────────────────────────────────────────────
function updateSendBtn() {
  const hasContent = (dom.messageInput && dom.messageInput.value.trim()) || state.pendingFile;
  if (dom.btnSend) dom.btnSend.disabled = !hasContent || state.isLoading;
}

function updateCharCount() {
  if (!dom.charCount || !dom.messageInput) return;
  const len = dom.messageInput.value.length;
  const max = 4000;
  dom.charCount.textContent = `${len} / ${max}`;
  dom.charCount.className = 'char-count';
  if (len > max * 0.9) dom.charCount.className += ' danger';
  else if (len > max * 0.75) dom.charCount.className += ' warning';
}

function autoResizeTextarea() {
  const el = dom.messageInput;
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 180) + 'px';
}

// ─── FILE UPLOAD & PREVIEWS ───────────────────────────────────────
function handleFileSelect(file) {
  if (!file) return;

  if (file.size > 25 * 1024 * 1024) {
    showToast('File too large (max 25MB)', 'error');
    return;
  }

  state.pendingFile = file;
  showFilePreview(file);
  updateSendBtn();
}

function showFilePreview(file) {
  if (!dom.filePreview || !dom.filePreviewInner) return;

  const isImage = file.type.startsWith('image/');
  const isAudio = file.type.startsWith('audio/') || /\.(webm|wav|mp3|ogg|m4a|aac)$/i.test(file.name);

  if (isImage) {
    const reader = new FileReader();
    reader.onload = e => {
      dom.filePreviewInner.innerHTML = `
        <img class="file-preview-thumb" src="${e.target.result}" alt="${escapeHtml(file.name)}" />
        <div>
          <div class="file-preview-name">${escapeHtml(file.name)}</div>
          <div class="file-preview-size">${formatFileSize(file.size)}</div>
        </div>`;
    };
    reader.readAsDataURL(file);
  } else if (isAudio) {
    dom.filePreviewInner.innerHTML = `
      <div class="file-preview-icon">🎙️</div>
      <div style="flex: 1; min-width: 0;">
        <div class="file-preview-name">${escapeHtml(file.name)}</div>
        <div class="file-preview-size">${formatFileSize(file.size)} (Audio Note)</div>
        <audio controls src="${URL.createObjectURL(file)}" style="height: 30px; width: 100%; max-width: 250px; margin-top: 4px;"></audio>
      </div>`;
  } else {
    const icon = getFileIcon(file.name);
    dom.filePreviewInner.innerHTML = `
      <div class="file-preview-icon">${icon}</div>
      <div>
        <div class="file-preview-name">${escapeHtml(file.name)}</div>
        <div class="file-preview-size">${formatFileSize(file.size)}</div>
      </div>`;
  }

  dom.filePreview.style.display = 'flex';
}

function removePendingFile() {
  state.pendingFile = null;
  if (dom.filePreview) dom.filePreview.style.display = 'none';
  if (dom.filePreviewInner) dom.filePreviewInner.innerHTML = '';
  if (dom.fileInput) dom.fileInput.value = '';
  updateSendBtn();
}

// ─── UNIVERSAL VOICE SYSTEM (SpeechRecognition + MediaRecorder) ───
/**
 * Automatically supports voice across all browsers:
 * 1. Web Speech API (Chrome, Edge, Safari): Real-time speech-to-text dictation into text area.
 * 2. HTML5 MediaRecorder (Firefox, Opera, Safari, mobile): High-fidelity voice note recording attached as audio.
 */
function checkVoiceEngine() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SpeechRecognition) {
    state.voiceMode = 'speech';
    if (dom.voiceBadge) {
      dom.voiceBadge.textContent = 'Live Speech-to-Text (Web Speech API)';
      dom.voiceBadge.style.background = 'rgba(16, 185, 129, 0.15)';
      dom.voiceBadge.style.color = '#10B981';
    }
    if (dom.voiceDesc) {
      dom.voiceDesc.textContent = 'Active: Your speech will be converted to text directly in real time as you talk.';
    }
    return 'speech';
  } else if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    state.voiceMode = 'recorder';
    if (dom.voiceBadge) {
      dom.voiceBadge.textContent = 'Voice Note Recorder (MediaRecorder)';
      dom.voiceBadge.style.background = 'rgba(59, 130, 246, 0.15)';
      dom.voiceBadge.style.color = '#3B82F6';
    }
    if (dom.voiceDesc) {
      dom.voiceDesc.textContent = 'Active: Your browser records audio notes directly. Click mic to start and stop, then send!';
    }
    return 'recorder';
  } else {
    state.voiceMode = 'unsupported';
    if (dom.voiceBadge) {
      dom.voiceBadge.textContent = 'Voice Not Available';
      dom.voiceBadge.style.background = 'rgba(239, 68, 68, 0.15)';
      dom.voiceBadge.style.color = '#EF4444';
    }
    return 'unsupported';
  }
}

function initVoiceRecognition() {
  const engine = checkVoiceEngine();

  if (engine === 'speech') {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setRecordingUI(true, 'Listening... Speak into your microphone');
    };

    recognition.onresult = (e) => {
      const transcript = Array.from(e.results)
        .map(r => r[0].transcript)
        .join('');
      if (dom.messageInput) {
        dom.messageInput.value = transcript;
        autoResizeTextarea();
        updateSendBtn();
        updateCharCount();
      }
    };

    recognition.onend = () => {
      setRecordingUI(false);
    };

    recognition.onerror = (e) => {
      setRecordingUI(false);
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        showToast('Microphone access was denied. Please allow microphone permissions in your browser.', 'error');
      } else if (e.error === 'no-speech') {
        showToast('No speech was detected. Please try again.', 'info');
      } else if (e.error !== 'aborted') {
        // Gracefully fallback to MediaRecorder if Web Speech service is blocked
        console.warn('Speech recognition error, trying recorder fallback:', e.error);
        startMediaRecording();
      }
    };

    state.recognition = recognition;
  }
}

function setRecordingUI(isRecording, text = 'Listening...') {
  state.isRecording = isRecording;
  if (dom.btnMic) dom.btnMic.classList.toggle('recording', isRecording);
  if (dom.btnVoiceToggle) dom.btnVoiceToggle.classList.toggle('recording', isRecording);

  if (dom.voiceIndicator) {
    dom.voiceIndicator.style.display = isRecording ? 'flex' : 'none';
  }
  if (dom.voiceIndicatorText) {
    dom.voiceIndicatorText.textContent = text;
  }
}

function toggleVoice() {
  if (state.isRecording) {
    stopVoice();
  } else {
    startVoice();
  }
}

function startVoice() {
  const engine = state.voiceMode || checkVoiceEngine();

  if (engine === 'speech' && state.recognition) {
    try {
      state.recognition.start();
    } catch(err) {
      console.warn('Speech recognition start failed, using recorder:', err.message);
      startMediaRecording();
    }
  } else if (engine === 'recorder' || engine === 'speech') {
    startMediaRecording();
  } else {
    showToast('Microphone is not accessible in this environment. Please ensure you are running on http://localhost.', 'error');
  }
}

function stopVoice() {
  if (state.recognition && state.voiceMode === 'speech') {
    try { state.recognition.stop(); } catch(e) {}
  }
  if (state.mediaRecorder && state.mediaRecorder.state !== 'inactive') {
    try { state.mediaRecorder.stop(); } catch(e) {}
  }
  if (state.recordInterval) {
    clearInterval(state.recordInterval);
    state.recordInterval = null;
  }
  setRecordingUI(false);
}

function startMediaRecording() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showToast('Audio recording is not supported in this browser.', 'error');
    return;
  }

  navigator.mediaDevices.getUserMedia({ audio: true })
    .then(stream => {
      state.audioChunks = [];
      state.recordSeconds = 0;

      // Select supported mimeType
      const mimeTypes = ['audio/webm', 'audio/ogg', 'audio/wav', 'audio/mp4'];
      let selectedMime = '';
      for (const m of mimeTypes) {
        if (MediaRecorder.isTypeSupported(m)) {
          selectedMime = m;
          break;
        }
      }

      const recorder = new MediaRecorder(stream, selectedMime ? { mimeType: selectedMime } : undefined);
      state.mediaRecorder = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          state.audioChunks.push(e.data);
        }
      };

      recorder.onstop = () => {
        stream.getTracks().forEach(track => track.stop());
        if (state.recordInterval) clearInterval(state.recordInterval);

        if (state.audioChunks.length > 0) {
          const mimeType = recorder.mimeType || 'audio/webm';
          const ext = mimeType.includes('ogg') ? 'ogg' : (mimeType.includes('wav') ? 'wav' : 'webm');
          const audioBlob = new Blob(state.audioChunks, { type: mimeType });
          const audioFile = new File([audioBlob], `voice-note-${Date.now()}.${ext}`, { type: mimeType });

          handleFileSelect(audioFile);
          if (dom.messageInput && !dom.messageInput.value.trim()) {
            dom.messageInput.value = 'Voice note recorded';
            autoResizeTextarea();
            updateSendBtn();
          }
          showToast('Voice note recorded! Click Send to chat.', 'success');
        }
      };

      recorder.start(250);
      setRecordingUI(true, 'Recording audio (0:00)... Click mic to attach');

      state.recordInterval = setInterval(() => {
        state.recordSeconds++;
        const mins = Math.floor(state.recordSeconds / 60);
        const secs = (state.recordSeconds % 60).toString().padStart(2, '0');
        if (dom.voiceIndicatorText) {
          dom.voiceIndicatorText.textContent = `Recording voice note (${mins}:${secs}) — Click mic to finish`;
        }
      }, 1000);
    })
    .catch(err => {
      setRecordingUI(false);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        showToast('Microphone access denied. Please click the lock icon in the address bar and enable microphone.', 'error');
      } else {
        showToast(`Could not access microphone: ${err.message}`, 'error');
      }
    });
}

// ─── TEXT-TO-SPEECH ───────────────────────────────────────────────
function speakText(msgId) {
  const el = $(`${msgId}`);
  if (!el) return;

  const bubble = el.querySelector('.msg-bubble');
  if (!bubble) return;

  const text = bubble.textContent || bubble.innerText;
  if (!text.trim()) return;

  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v => v.name.includes('Google') && v.lang.startsWith('en'))
      || voices.find(v => v.lang.startsWith('en'))
      || voices[0];
    if (preferred) utterance.voice = preferred;

    window.speechSynthesis.speak(utterance);
    showToast('Speaking response...', 'info');
  } else {
    showToast('Text-to-speech is not supported in this browser', 'error');
  }
}

// ─── COPY HELPERS ─────────────────────────────────────────────────
function copyText(text) {
  if (!text) return;
  navigator.clipboard.writeText(text)
    .then(() => showToast('Copied to clipboard', 'success'))
    .catch(() => showToast('Failed to copy', 'error'));
}

function copyMessageText(msgId) {
  const el = $(`${msgId}`);
  if (!el) return;
  const bubble = el.querySelector('.msg-bubble');
  const text = bubble ? (bubble.textContent || bubble.innerText) : '';
  copyText(text);
}

// ─── MODALS & SETTINGS ────────────────────────────────────────────
function openImageModal(url) {
  if (!dom.modalImage || !dom.imageModal) return;
  dom.modalImage.src = url;
  dom.imageModal.style.display = 'flex';
  document.addEventListener('keydown', closeImageOnEsc);
}

function closeImageModal() {
  if (!dom.imageModal) return;
  dom.imageModal.style.display = 'none';
  document.removeEventListener('keydown', closeImageOnEsc);
}

function closeImageOnEsc(e) {
  if (e.key === 'Escape') closeImageModal();
}

async function openSettings() {
  if (!dom.settingsModal) return;
  checkVoiceEngine();

  try {
    const res = await fetch(`${API_BASE}/settings`);
    const data = await res.json();
    if (data.success) {
      if (dom.selectModel && data.model) {
        dom.selectModel.value = data.model;
      }
      if (dom.keyStatusIndicator) {
        if (data.hasApiKey) {
          dom.keyStatusIndicator.className = 'key-status-indicator configured';
          dom.keyStatusIndicator.textContent = `✅ Gemini API Key active (${data.maskedKey})`;
        } else {
          dom.keyStatusIndicator.className = 'key-status-indicator empty';
          dom.keyStatusIndicator.textContent = '⚡ Running in Local Direct Engine (No key configured in server/.env)';
        }
      }
    }
  } catch (err) {
    console.warn('Could not fetch settings:', err.message);
  }

  dom.settingsModal.style.display = 'flex';
}

function closeSettings() {
  if (!dom.settingsModal) return;
  dom.settingsModal.style.display = 'none';
}

async function saveSettings() {
  const apiKey = dom.inputApiKey ? dom.inputApiKey.value.trim() : '';
  const model = dom.selectModel ? dom.selectModel.value : 'gemini-2.0-flash';

  try {
    const res = await fetch(`${API_BASE}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey, model })
    });
    const data = await res.json();
    if (data.success) {
      showToast('Settings saved successfully!', 'success');
      if (dom.inputApiKey) dom.inputApiKey.value = '';
      closeSettings();
      await checkServerHealth();
    } else {
      showToast(`Error saving settings: ${data.error}`, 'error');
    }
  } catch(e) {
    showToast('Failed to save settings to server', 'error');
  }
}

// ─── EXPORT CHAT ──────────────────────────────────────────────────
function exportChat() {
  if (state.messages.length === 0) {
    showToast('No messages to export', 'info');
    return;
  }

  const p = PERSONA_CONFIG[state.currentPersona] || PERSONA_CONFIG.nova;
  const lines = [
    `# SmartChat AI Conversation with ${p.name}`,
    `*Exported on ${new Date().toLocaleString()}*\n`,
    '---\n'
  ];

  state.messages.forEach(msg => {
    const time = new Date(msg.timestamp).toLocaleTimeString();
    if (msg.role === 'user') {
      lines.push(`### 👤 You (${time})`);
      if (msg.file) lines.push(`*Attached file: ${msg.file.name}*`);
      lines.push(`${msg.content}\n`);
    } else {
      lines.push(`### ${p.emoji} ${p.name} (${time})`);
      lines.push(`${msg.content}\n`);
    }
    lines.push('---\n');
  });

  const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `smartchat-${p.name.toLowerCase()}-${Date.now()}.md`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Chat exported as Markdown', 'success');
}

// ─── SERVER HEALTH ────────────────────────────────────────────────
async function checkServerHealth() {
  if (!dom.serverStatus) return;
  try {
    const res = await fetch(`${API_BASE}/health`);
    const data = await res.json();
    if (data.status === 'online') {
      const modeText = data.apiKeySet ? 'Gemini Cloud' : 'Direct AI';
      dom.serverStatus.innerHTML = `
        <div class="status-dot online"></div>
        <span>${modeText}</span>`;
      dom.serverStatus.title = `SmartChat AI Online (${data.model || ''})`;
    } else {
      setServerOffline();
    }
  } catch (e) {
    setServerOffline();
  }
}

function setServerOffline() {
  if (!dom.serverStatus) return;
  dom.serverStatus.innerHTML = `
    <div class="status-dot offline"></div>
    <span>Offline</span>`;
  dom.serverStatus.title = 'Server unreachable';
}

// ─── UI HELPERS ───────────────────────────────────────────────────
function showWelcome(show) {
  if (dom.welcomeScreen) {
    dom.welcomeScreen.style.display = show ? 'flex' : 'none';
  }
}

function showToast(message, type = 'info') {
  if (!dom.toastContainer) return;

  const icons = {
    info: '💡',
    success: '✅',
    error: '⚠️'
  };

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span>${icons[type] || '💡'}</span>
    <span>${escapeHtml(message)}</span>`;

  dom.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'toast-out 0.3s forwards';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatRelativeTime(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatFileSize(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  while (bytes >= 1024 && i < units.length - 1) {
    bytes /= 1024;
    i++;
  }
  return `${bytes.toFixed(1)} ${units[i]}`;
}

function getFileIcon(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  const icons = {
    jpg: '🖼️', jpeg: '🖼️', png: '🖼️', gif: '🖼️', webp: '🖼️',
    webm: '🎙️', wav: '🎵', mp3: '🎵', ogg: '🎵', m4a: '🎵', aac: '🎵',
    pdf: '📄', txt: '📝', md: '📝',
    js: '📜', ts: '📜', jsx: '📜', tsx: '📜',
    py: '🐍', java: '☕', css: '🎨', html: '🌐',
    json: '📊', csv: '📊', xml: '📊',
    zip: '📦', rar: '📦', tar: '📦'
  };
  return icons[ext] || '📎';
}

function scrollToBottom(smooth = true) {
  setTimeout(() => {
    if (dom.messagesContainer) {
      dom.messagesContainer.scrollTo({
        top: dom.messagesContainer.scrollHeight,
        behavior: smooth ? 'smooth' : 'instant'
      });
    }
  }, 50);
}

function toggleSidebar() {
  const isMobile = window.innerWidth <= 768;
  if (isMobile) {
    dom.sidebar.classList.toggle('mobile-open');
  } else {
    dom.sidebar.classList.toggle('collapsed');
  }
}

// ─── EVENT LISTENERS ──────────────────────────────────────────────
function initEventListeners() {
  dom.btnToggleTheme?.addEventListener('click', toggleTheme);
  dom.btnSidebarToggle?.addEventListener('click', toggleSidebar);
  dom.btnNewChat?.addEventListener('click', newChat);
  dom.btnClearHistory?.addEventListener('click', () => {
    if (confirm('Clear all conversation history?')) clearAllHistory();
  });

  dom.btnSend?.addEventListener('click', sendMessage);

  dom.messageInput?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  dom.messageInput?.addEventListener('input', () => {
    autoResizeTextarea();
    updateSendBtn();
    updateCharCount();
  });

  dom.btnAttach?.addEventListener('click', () => dom.fileInput?.click());
  dom.fileInput?.addEventListener('change', e => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  });

  dom.btnRemoveFile?.addEventListener('click', removePendingFile);

  // Voice buttons
  dom.btnMic?.addEventListener('click', toggleVoice);
  dom.btnVoiceToggle?.addEventListener('click', toggleVoice);

  // Settings
  dom.btnSettingsToggle?.addEventListener('click', openSettings);
  dom.btnCloseSettingsModal?.addEventListener('click', closeSettings);
  dom.btnCancelSettings?.addEventListener('click', closeSettings);
  dom.btnSaveSettings?.addEventListener('click', saveSettings);
  dom.btnToggleKeyVisibility?.addEventListener('click', () => {
    if (dom.inputApiKey) {
      const isPw = dom.inputApiKey.type === 'password';
      dom.inputApiKey.type = isPw ? 'text' : 'password';
    }
  });

  // Export
  dom.btnExportChat?.addEventListener('click', exportChat);

  // Image modal close
  dom.btnCloseImageModal?.addEventListener('click', closeImageModal);
  dom.imageModal?.addEventListener('click', e => {
    if (e.target === dom.imageModal) closeImageModal();
  });
  dom.settingsModal?.addEventListener('click', e => {
    if (e.target === dom.settingsModal) closeSettings();
  });

  // Sidebar personas
  document.querySelectorAll('.persona-card').forEach(el => {
    el.addEventListener('click', () => setPersona(el.dataset.persona));
  });

  // Welcome screen quick personas
  document.querySelectorAll('.quick-persona-btn').forEach(el => {
    el.addEventListener('click', () => setPersona(el.dataset.persona));
  });

  // Suggestion chips
  document.querySelectorAll('.chip').forEach(el => {
    el.addEventListener('click', () => {
      const text = el.textContent.replace(/^[\p{Emoji}\s]+/u, '').trim();
      if (dom.messageInput) {
        dom.messageInput.value = text;
        autoResizeTextarea();
        updateSendBtn();
        sendMessage();
      }
    });
  });

  // Drag & drop file upload
  ['dragenter', 'dragover'].forEach(name => {
    document.addEventListener(name, e => {
      e.preventDefault();
      e.stopPropagation();
      dom.inputBox?.classList.add('drag-over');
    });
  });

  ['dragleave', 'drop'].forEach(name => {
    document.addEventListener(name, e => {
      e.preventDefault();
      e.stopPropagation();
      dom.inputBox?.classList.remove('drag-over');
    });
  });

  document.addEventListener('drop', e => {
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  });

  // Responsive close sidebar on click outside
  document.addEventListener('click', e => {
    if (window.innerWidth <= 768 && dom.sidebar?.classList.contains('mobile-open')) {
      if (!dom.sidebar.contains(e.target) && !dom.btnSidebarToggle?.contains(e.target)) {
        dom.sidebar.classList.remove('mobile-open');
      }
    }
  });
}

// ─── INITIALIZATION ───────────────────────────────────────────────
async function init() {
  initTheme();

  const savedPersona = localStorage.getItem('smartchat-persona') || 'nova';
  setPersona(savedPersona);

  initVoiceRecognition();
  initEventListeners();

  showWelcome(true);
  updateSendBtn();
  updateCharCount();

  await Promise.all([loadSessions(), checkServerHealth()]);
  setInterval(checkServerHealth, 30000);

  dom.messageInput?.focus();
  console.log('%c SmartChat AI Ready 🚀 ', 'background: #7C3AED; color: white; padding: 4px 12px; border-radius: 4px; font-weight: bold;');
}

window.openImageModal = openImageModal;
window.copyText = copyText;
window.copyMessageText = copyMessageText;
window.speakText = speakText;
window.deleteSession = deleteSession;

document.addEventListener('DOMContentLoaded', init);
