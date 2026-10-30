# 🚀 SmartChat AI — Next-Generation Conversational AI Platform

<p align="center">
  <img src="public/assets/logo.jpg" alt="SmartChat AI Logo" width="120" style="border-radius: 20px; box-shadow: 0 8px 30px rgba(124, 58, 237, 0.3);" />
</p>

<p align="center">
  <strong>An intelligent, elegant, and versatile conversational AI platform powered by Google Gemini and custom high-accuracy local engines.</strong>
</p>

<p align="center">
  <a href="https://github.com/Antushil11/smartchat-ai"><img src="https://img.shields.io/badge/GitHub-Antushil11%2Fsmartchat--ai-7C3AED?logo=github&style=for-the-badge" alt="GitHub Repo" /></a>
  <a href="https://github.com/Antushil11"><img src="https://img.shields.io/badge/Author-Antu%20Shil-0284C7?style=for-the-badge&logo=github" alt="Author" /></a>
  <img src="https://img.shields.io/badge/Node.js-18%2B-339933?style=for-the-badge&logo=node.js" alt="Node.js" />
  <img src="https://img.shields.io/badge/Gemini_API-2.0_Flash-4285F4?style=for-the-badge&logo=google" alt="Google Gemini" />
  <img src="https://img.shields.io/badge/License-MIT-F59E0B?style=for-the-badge" alt="License" />
</p>

---

## 🌐 Live Demo & Repository Links

- **GitHub Repository:** [https://github.com/Antushil11/smartchat-ai](https://github.com/Antushil11/smartchat-ai)
- **Author Profile:** [@Antushil11 (ANTU SHIL)](https://github.com/Antushil11)
- **Local Live Server:** [http://localhost:3000](http://localhost:3000)

---

## 🌟 Key Highlights & Features

### 🤖 1. Google Gemini 2.0 Flash Integration & Zero Filler Responses
- Connects directly to Google's official Gemini API using secure header authentication (`X-goog-api-key`). Your keys never leak into client code or URLs.
- **Direct & Accurate Answers:** Clean system instructions guarantee zero conversational filler (no "Great question!", "This is a nuanced topic", or generic intros). Answers are immediate, direct, and structured.
- **High-Accuracy Direct Fallback Engine:** If offline or if an API key is not configured, SmartChat AI calculates exact math, explains React hooks with complete code, drafts internship emails, and explains complex AI concepts step-by-step.

### 🎙️ 2. Universal Dual Voice Engine (All Browsers Supported)
- **Chromium / Chrome / Edge:** Real-time speech-to-text dictation via the native **Web Speech API**. Speech appears live in the text input box as you talk.
- **Firefox / Safari / Opera / Mobile:** Seamless automatic fallback to the **HTML5 `MediaRecorder` Audio Engine**. Records voice notes with animated waveform visuals and a live duration counter.
- **Audio Attachments with Inline Player:** Voice notes are attached to the chat and rendered with an interactive HTML5 audio player.

### 🎭 3. Four Specialized AI Personas
- **🌟 Nova (General Assistant):** Versatile, intelligent partner for writing, brainstorming, and daily queries.
- **💻 Coda (Code Expert):** Senior software engineer AI specializing in clean architecture, debugging, and production code snippets with syntax highlighting.
- **🎨 Aria (Creative Writer):** Imaginative storytelling, vivid metaphors, poetry, and creative prose.
- **🔬 Sage (Research Analyst):** Academic rigor, structured analytical breakdowns, and evidence-based explanations.

### 💬 4. Conversational History & Session Memory
- Multiple concurrent conversations saved with automatic timestamps and preview snippets.
- Real-time conversation switcher and deletion controls in the sidebar.

### 📁 5. Multimodal File & Media Uploads
- Supports image previews (`.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`) with a full-screen image lightbox modal.
- Supports voice recordings (`.webm`, `.wav`, `.mp3`, `.ogg`, `.m4a`) and documents/code (`.pdf`, `.txt`, `.md`, `.js`, `.py`, `.json`).

### 💻 6. Syntax Highlighting & 1-Click Code Copy
- Formats code blocks using **Highlight.js** across 30+ programming languages.
- Distinct language badges with instant copy-to-clipboard functionality.

### 🔊 7. Text-to-Speech (TTS) Read-Aloud
- Listen to any AI response with a single click using the Web Speech Synthesis engine.

### 🌙 8. Modern Glassmorphism Theme (Dark & Light)
- Curated color palettes with fluid animations, glowing gradients, and responsive mobile sidebar drawer.
- Theme preference is automatically remembered via `localStorage`.

### ⚙️ 9. In-App Model & Settings Manager
- Interactive settings modal (⚙️) to switch between `gemini-2.0-flash`, `gemini-1.5-flash`, `gemini-flash-latest`, or `gemini-1.5-pro`.
- Safely update your `GEMINI_API_KEY` directly from the UI or via `server/.env`.

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | Vanilla JavaScript (ES6+), Semantic HTML5, CSS3 (Glassmorphism & Flexbox/Grid), Marked.js, Highlight.js |
| **Backend** | Node.js, Express.js, Multer (File & Audio Uploads), Dotenv |
| **AI Services** | Google Gemini REST API (`v1beta/models`), SmartChat Direct Local Engine |
| **Audio & Voice** | Web Speech API (`SpeechRecognition`, `speechSynthesis`), HTML5 `MediaRecorder` API |
| **Security** | Server-side `.env` exclusion via `.gitignore`, header-based API key auth |

---

## 📁 Project Structure

```text
SmartChat AI/
├── server.js               # Express server, Gemini REST bridge & dual AI engine
├── package.json            # Node.js dependencies and scripts
├── test-api.js             # Automated test suite for health & direct AI responses
├── .gitignore              # Protects .env, node_modules, and uploads
├── server/
│   ├── .env                # Server environment variables (GEMINI_API_KEY)
│   └── .env.example        # Clean template for environment configuration
├── public/
│   ├── index.html          # Semantic single-page application layout & modals
│   ├── assets/
│   │   └── logo.jpg        # SmartChat AI brand asset
│   ├── css/
│   │   └── main.css        # Responsive dark/light theme, audio & modal styles
│   └── js/
│       └── app.js          # Universal voice controller, chat rendering, settings
└── uploads/                # Local storage for uploaded files and voice notes
```

---

## ⚡ Quick Start Guide

### 1. Prerequisites
- **Node.js** v18.0.0 or later installed on your system.
- Git installed.

### 2. Clone the Repository
```bash
git clone https://github.com/Antushil11/smartchat-ai.git
cd smartchat-ai
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Configure Environment Variables
Copy the example environment file or edit `server/.env`:
```bash
# On Linux/macOS
cp server/.env.example server/.env

# On Windows
copy server\.env.example server\.env
```

Open `server/.env` and insert your free Gemini API key:
```env
GEMINI_API_KEY=AIzaSy...your_gemini_api_key_here
GEMINI_MODEL=gemini-2.0-flash
PORT=3000
```
> 💡 *Don't have a Gemini key yet? Get one free in 30 seconds at [Google AI Studio](https://aistudio.google.com/apikey).*

### 5. Launch the Server
```bash
npm start
```
Then open your browser and navigate to:
👉 **[http://localhost:3000](http://localhost:3000)**

---

## 🧪 Running Automated Tests

Run the built-in test suite to verify the server health, settings, and direct answer accuracy:

```bash
npm test
```

Expected output:
```text
🧪 Starting SmartChat AI Comprehensive Validation...
✅ [1/7] Health: online | Model: gemini-2.0-flash
✅ [2/7] Settings: Mode: Gemini Cloud | Model: gemini-2.0-flash
✅ [3/7] Math: 15 × 12 = 180 (Correct calculation)
✅ [4/7] React: useEffect hook with working code example
✅ [5/7] Email: Professional internship request template
✅ [6/7] AI: Step-by-step neural network breakdown
✅ [7/7] Zero generic filler detected! All answers are direct and natural.
🎉 All tests passed successfully!
```

---

## 🚀 Deployment Guide

### Deploy to Render
1. Push your repository to GitHub.
2. Sign in to [Render](https://render.com) and create a **New Web Service**.
3. Connect your repository `https://github.com/Antushil11/smartchat-ai`.
4. Configure:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
5. In **Environment Variables**, add:
   - `GEMINI_API_KEY`: *Your Google Gemini API Key*
   - `GEMINI_MODEL`: `gemini-2.0-flash`
6. Click **Deploy Web Service**!

---

## 👤 Author

Developed with ❤️ by **[Antu Shil (Antushil11)](https://github.com/Antushil11)**

- **GitHub:** [@Antushil11](https://github.com/Antushil11)
- **Project:** [SmartChat AI](https://github.com/Antushil11/smartchat-ai)

---

## 📄 License

This project is licensed under the **MIT License** — feel free to use, modify, and distribute it for personal and commercial projects.
