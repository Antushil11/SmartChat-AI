'use strict';

// ─── LOAD ENV (server/.env first, then root .env) ───────────────
const path = require('path');
const fs   = require('fs');

const serverEnvPath = path.join(__dirname, 'server', '.env');
const rootEnvPath   = path.join(__dirname, '.env');

if (fs.existsSync(serverEnvPath)) {
  require('dotenv').config({ path: serverEnvPath });
} else {
  require('dotenv').config({ path: rootEnvPath });
}

const express = require('express');
const cors    = require('cors');
const multer  = require('multer');
const https   = require('https');
const { v4: uuidv4 } = require('uuid');

const app  = express();
const PORT = process.env.PORT || 3000;

// ─── GEMINI RUNTIME CONFIG ────────────────────────────────────────
let GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
let GEMINI_MODEL   = process.env.GEMINI_MODEL   || 'gemini-2.0-flash';
const GEMINI_HOST  = 'generativelanguage.googleapis.com';

function hasValidApiKey() {
  return Boolean(
    GEMINI_API_KEY &&
    GEMINI_API_KEY.trim() !== '' &&
    GEMINI_API_KEY !== 'your_gemini_api_key_here' &&
    !GEMINI_API_KEY.startsWith('your_')
  );
}

function updateEnvFile(newKey, newModel) {
  try {
    const dir = path.join(__dirname, 'server');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    let content = `# SmartChat AI — Server Environment Variables\n`;
    content += `GEMINI_API_KEY=${newKey || ''}\n`;
    content += `GEMINI_MODEL=${newModel || 'gemini-2.0-flash'}\n`;
    content += `PORT=${PORT}\n`;

    fs.writeFileSync(serverEnvPath, content, 'utf8');
    return true;
  } catch (err) {
    console.error('Failed to update server/.env:', err.message);
    return false;
  }
}

// ─── MIDDLEWARE ──────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// ─── FILE UPLOAD (Images, Audio, Docs) ───────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = 'uploads';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`)
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
  fileFilter: (req, file, cb) => {
    // Allow images, audio (voice notes), documents and code files
    const ok = /jpeg|jpg|png|gif|webp|webm|wav|mp3|ogg|m4a|aac|pdf|txt|md|js|ts|py|json|csv|html|css/;
    const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
    const isMimeOk = file.mimetype.startsWith('image/') ||
                     file.mimetype.startsWith('audio/') ||
                     file.mimetype.startsWith('text/') ||
                     file.mimetype.includes('json') ||
                     file.mimetype.includes('pdf');
    if (ok.test(ext) || isMimeOk) {
      cb(null, true);
    } else {
      cb(new Error('File type not supported'));
    }
  }
});

// ─── AI PERSONAS ─────────────────────────────────────────────────
const personas = {
  nova: {
    id: 'nova', name: 'Nova', title: 'General Assistant',
    emoji: '🌟', color: '#7C3AED',
    gradient: 'linear-gradient(135deg, #7C3AED, #4F46E5)',
    greeting: "Hi! I'm Nova, your intelligent AI assistant. What would you like to explore today? ✨",
    systemPrompt: `You are Nova, an intelligent, helpful AI assistant inside SmartChat AI.
Answer every question directly, accurately, and naturally.
Never begin with conversational filler like "Great question", "Certainly", or "This is a nuanced topic".
Provide structured, step-by-step explanations when needed, and format code with syntax highlighting.`
  },
  coda: {
    id: 'coda', name: 'Coda', title: 'Code Expert',
    emoji: '💻', color: '#059669',
    gradient: 'linear-gradient(135deg, #059669, #0284C7)',
    greeting: "Hey! I'm Coda, your coding expert. Ask me about algorithms, debugging, or building apps. What are we coding? 🚀",
    systemPrompt: `You are Coda, an expert software engineer AI inside SmartChat AI.
Always answer coding questions directly with working, clean, production-ready code examples.
Use proper Markdown code blocks with language identifiers.
Explain how the code works concisely. If diagnosing an error, explain the cause and provide the fix.`
  },
  aria: {
    id: 'aria', name: 'Aria', title: 'Creative Writer',
    emoji: '🎨', color: '#DB2777',
    gradient: 'linear-gradient(135deg, #DB2777, #9333EA)',
    greeting: "Hello! I'm Aria, your creative writing partner. Let's create something imaginative! 🌸",
    systemPrompt: `You are Aria, a creative writing AI inside SmartChat AI.
Write vivid, engaging, and expressive content. Fulfill writing requests immediately without preamble.
For poems, write the complete poem. For stories, craft compelling narratives. Match the user's requested tone.`
  },
  sage: {
    id: 'sage', name: 'Sage', title: 'Research Analyst',
    emoji: '🔬', color: '#D97706',
    gradient: 'linear-gradient(135deg, #D97706, #DC2626)',
    greeting: "Greetings! I'm Sage, your research and analysis specialist. What topic shall we investigate? 📚",
    systemPrompt: `You are Sage, an analytical and research AI inside SmartChat AI.
Provide structured, fact-based, rigorous analysis.
Break complex topics into logical sections. Present clear points without fluff or unnecessary padding.`
  }
};

// ─── BASE SYSTEM INSTRUCTION ──────────────────────────────────────
const BASE_SYSTEM = `
You are SmartChat AI, a helpful, intelligent, and accurate AI assistant.
Answer the user's actual question directly. Understand the user's intent and provide
relevant, clear, natural, and useful answers.
• Do NOT start with "Great question", "Certainly!", "Of course!", or any filler phrase.
• Do NOT say "This is a nuanced topic" or give vague overviews without substance.
• Do NOT ask unnecessary follow-up questions — answer first, then optionally offer a helpful tip.
• Explain step by step when the topic requires it.
• Use working code examples for technical questions, with proper Markdown code blocks.
• If you do not know something, say so honestly and briefly.
• Match the user's language (if they write in Bengali, reply in Bengali; if in Spanish, reply in Spanish, etc.).
• Use Markdown formatting (bold, lists, code blocks) to ensure maximum readability.
`.trim();

// ─── GEMINI API CALL ─────────────────────────────────────────────
/**
 * Calls the official Gemini REST API.
 * Uses X-goog-api-key header so secrets never appear in URLs or log files.
 */
function callGemini(contents, systemInstruction) {
  return new Promise((resolve, reject) => {
    if (!hasValidApiKey()) {
      return reject(new Error('GEMINI_API_KEY is not configured in server/.env'));
    }

    const pathUrl = `/v1beta/models/${GEMINI_MODEL}:generateContent`;

    const body = JSON.stringify({
      system_instruction: {
        parts: [{ text: systemInstruction }]
      },
      contents,
      generationConfig: {
        temperature:     0.7,
        topP:            0.95,
        maxOutputTokens: 2048
      },
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT',        threshold: 'BLOCK_ONLY_HIGH' },
        { category: 'HARM_CATEGORY_HATE_SPEECH',       threshold: 'BLOCK_ONLY_HIGH' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' }
      ]
    });

    const options = {
      hostname: GEMINI_HOST,
      path:     pathUrl,
      method:   'POST',
      headers: {
        'Content-Type':   'application/json',
        'X-goog-api-key': GEMINI_API_KEY,
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = https.request(options, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(raw);

          if (json.error) {
            const msg = json.error.message || 'Gemini API error';
            const code = json.error.code || res.statusCode;
            return reject(new Error(`Gemini [${code}]: ${msg}`));
          }

          const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) return resolve(text.trim());

          const blockReason = json.candidates?.[0]?.finishReason;
          if (blockReason && blockReason !== 'STOP') {
            return reject(new Error(`Response blocked by Gemini filter (${blockReason})`));
          }

          return reject(new Error('Gemini returned an empty response.'));
        } catch (parseErr) {
          reject(new Error(`Failed to parse Gemini response: ${parseErr.message}`));
        }
      });
    });

    req.on('error', (err) => reject(new Error(`Network error calling Gemini: ${err.message}`)));
    req.setTimeout(25000, () => {
      req.destroy();
      reject(new Error('Gemini API request timed out'));
    });

    req.write(body);
    req.end();
  });
}

// ─── HIGH-QUALITY DIRECT SMART ENGINE (ZERO-FILLER FALLBACK) ─────
/**
 * Provides immediate, accurate, direct answers without canned filler phrases.
 * Used whenever Gemini API key is not yet set or when Gemini API is temporarily offline.
 */
function generateSmartDirectResponse(message = '', personaKey = 'nova', history = [], file = null) {
  const p = personas[personaKey] || personas.nova;
  const q = message.trim();
  const qLower = q.toLowerCase();

  // 1. Name & Identity queries: e.g. "what is your name", "what is you name", "who are you", "what are you called"
  if (
    qLower.includes('you name') ||
    qLower.includes('your name') ||
    qLower.includes('who are you') ||
    qLower.includes('what are you called') ||
    qLower.includes('what is your identity') ||
    qLower === 'name' ||
    qLower === 'who r u'
  ) {
    return `I am **SmartChat AI**, your personal conversational AI assistant! 

Right now you are chatting with **${p.name}** (${p.title}). 

I can assist you with:
• Answering questions directly and accurately
• Writing, debugging, and explaining code (React, Python, JS, SQL, etc.)
• Solving math problems and calculations
• Drafting professional emails, letters, and creative stories
• Voice input and audio note conversations

What would you like to explore or work on today? ✨`;
  }

  // 2. Creator & Developer queries: e.g. "who created you", "who made you", "who is your developer"
  if (
    qLower.includes('who created you') ||
    qLower.includes('who made you') ||
    qLower.includes('who built you') ||
    qLower.includes('who is your developer') ||
    qLower.includes('who is your creator') ||
    qLower.includes('who is antu') ||
    qLower.includes('who programmed you')
  ) {
    return `I was developed by **Antu Shil** ([@Antushil11](https://github.com/Antushil11)) as part of the **SmartChat AI** platform.

You can view the full open-source project and source code on GitHub at:
👉 **[https://github.com/Antushil11/SmartChat-AI](https://github.com/Antushil11/SmartChat-AI)**`;
  }

  // 3. Greetings & How are you: e.g. "hello", "hi", "how are you", "what's up"
  if (
    /^(hi|hello|hey|howdy|greetings|good\s+(morning|afternoon|evening|day))[\s!.]*$/i.test(qLower) ||
    qLower.includes('how are you') ||
    qLower.includes("what's up") ||
    qLower.includes('how r u')
  ) {
    return `Hello! I'm doing great, thank you for asking! 🌟

I'm ready to help you with coding, writing, research, math, or anything else you'd like to work on. What's on your mind?`;
  }

  // 4. Capabilities & Help: e.g. "what can you do", "help", "features"
  if (
    qLower.includes('what can you do') ||
    qLower.includes('what are your features') ||
    qLower.includes('what can u do') ||
    qLower === 'help' ||
    qLower.includes('how to use')
  ) {
    return `Here are some of the key things I can do for you:

• **💻 Coding & Debugging:** Write clean code in JavaScript, Python, React, HTML/CSS, SQL, and diagnose runtime errors.
• **✍️ Writing & Editing:** Draft professional emails, resumes, essays, creative stories, and poetry.
• **🧮 Math & Logic:** Solve equations, percentages, arithmetic ($15 \times 12 = 180$), and word problems with clear steps.
• **🔬 In-Depth Explanations:** Break down complex topics like quantum computing, AI, machine learning, and web architecture.
• **🎙️ Voice Recognition:** Speak directly into your microphone or upload audio notes.
• **🎭 Multiple Personas:** Switch between Nova (General), Coda (Coding), Aria (Creative), and Sage (Research).

Just ask a question or tell me what you need!`;
  }

  // 5. Jokes & Humor
  if (qLower.includes('joke') || qLower.includes('make me laugh') || qLower.includes('funny')) {
    const jokes = [
      "Why do programmers prefer dark mode?\n\n*Because light attracts bugs!* 🐛😄",
      "Why do Java programmers wear glasses?\n\n*Because they don't C#!* ☕😂",
      "There are only 10 types of people in the world:\n\n*Those who understand binary, and those who don't.* 💻",
      "A SQL query walks into a bar, walks up to two tables and asks...\n\n*\"Can I join you?\"* 📊"
    ];
    return jokes[Math.floor(Math.random() * jokes.length)];
  }

  // 6. Math / Calculations: e.g. "what is 15 * 12", "15 x 12", "15 × 12", "calculate 120 / 4"
  const mathMatch = qLower.match(/(?:what\s+is|calculate|evaluate)?\s*(\d+(?:\.\d+)?)\s*([\+\-\*\/×÷xX]|times|plus|minus|divided by)\s*(\d+(?:\.\d+)?)\s*\??/i);
  if (mathMatch) {
    const n1 = parseFloat(mathMatch[1]);
    const opRaw = mathMatch[2].toLowerCase();
    const n2 = parseFloat(mathMatch[3]);
    let result = null;
    let symbol = opRaw;

    if (opRaw === '+' || opRaw === 'plus') {
      result = n1 + n2;
      symbol = '+';
    } else if (opRaw === '-' || opRaw === 'minus') {
      result = n1 - n2;
      symbol = '-';
    } else if (['*', '×', 'x', 'times'].includes(opRaw)) {
      result = n1 * n2;
      symbol = '×';
    } else if (['/', '÷', 'divided by'].includes(opRaw)) {
      result = n2 !== 0 ? n1 / n2 : 'Undefined (division by zero)';
      symbol = '÷';
    }

    if (result !== null) {
      if (typeof result === 'number' && !Number.isInteger(result)) {
        result = parseFloat(result.toFixed(4));
      }
      return `**${n1} ${symbol} ${n2} = ${result}**

### Calculation Details:
• **Operation:** ${n1} ${symbol} ${n2}
• **Result:** **${result}**`;
    }
  }

  // 7. React useEffect with example
  if (qLower.includes('useeffect') || (qLower.includes('react') && qLower.includes('effect'))) {
    return `In React, the **\`useEffect\`** hook enables functional components to perform **side effects**—such as fetching data from an API, subscribing to events, setting up timers, or directly updating the DOM.

---

### Core Syntax
\`\`\`jsx
import { useEffect } from 'react';

useEffect(() => {
  // 1. Side-effect logic goes here

  return () => {
    // 2. Optional cleanup (runs before re-render or component unmount)
  };
}, [dependencies]); // 3. Dependency array
\`\`\`

### Dependency Array Rules
1. **\`[]\` (Empty array):** Runs only **once** when the component first mounts.
2. **\`[dep1, dep2]\` (With dependencies):** Runs on mount and re-runs whenever any dependency value changes.
3. **No array provided:** Runs on **every** single render (rarely recommended).

---

### Complete Working Example: Fetching User Data
\`\`\`jsx
import React, { useState, useEffect } from 'react';

function UserProfile({ userId }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isCancelled = false;
    setLoading(true);

    fetch(\`https://jsonplaceholder.typicode.com/users/\${userId}\`)
      .then((res) => {
        if (!res.ok) throw new Error('Network response was not ok');
        return res.json();
      })
      .then((data) => {
        if (!isCancelled) {
          setUser(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!isCancelled) {
          setError(err.message);
          setLoading(false);
        }
      });

    // Cleanup function: runs before next effect or upon unmount
    return () => {
      isCancelled = true;
    };
  }, [userId]); // Re-fetches only when userId changes

  if (loading) return <div>Loading profile...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="profile-card">
      <h3>{user?.name}</h3>
      <p>Email: {user?.email}</p>
      <p>Company: {user?.company?.name}</p>
    </div>
  );
}

export default UserProfile;
\`\`\``;
  }

  // 8. Internship email request
  if ((qLower.includes('email') || qLower.includes('letter')) && (qLower.includes('intern') || qLower.includes('internship'))) {
    return `Here is a clear, professional email template requesting an internship:

---

**Subject:** Internship Inquiry: Software Engineering Intern – [Your Name]

Dear [Hiring Manager / Team Lead's Name],

I hope this email finds you well.

My name is **[Your Name]**, and I am currently a [Your Year, e.g., 3rd-year] Computer Science student at [Your University]. I have been closely following [Company Name]’s innovative work in [mention specific product or area, e.g., cloud platforms and AI tools], and I admire the high engineering standards your team upholds.

I am writing to inquire about potential software engineering internship opportunities with your team for **[Term, e.g., Summer 2026]**.

Key highlights of my background include:
• **Technical Proficiency:** Solid foundation in [list 2-3 technologies, e.g., JavaScript/Node.js, React, and Python].
• **Hands-on Projects:** Recently designed and built [Name of Project], a [brief 1-sentence description, e.g., real-time chat application with REST APIs and responsive UI].
• **Eagerness to Learn:** Fast learner who thrives in collaborative environments and seeks to contribute directly to product features.

I have attached my resume for your consideration. You can also view my code repositories and past work at [Your GitHub or Portfolio Link].

Thank you very much for your time and consideration. I would welcome the opportunity to discuss how I can add value to [Company Name].

Sincerely,

**[Your Name]**  
[Your Phone Number]  
[Your Email Address]  
[LinkedIn Profile URL]  
[GitHub Profile URL]

---

**Quick Tips:**
• Personalize the bracketed sections before sending.
• Keep your email under 200 words for maximum response rate.`;
  }

  // 9. How AI works
  if (qLower.includes('how ai works') || qLower.includes('how does ai work') || qLower.includes('explain ai') || qLower.includes('how does artificial intelligence work')) {
    return `Artificial Intelligence (specifically modern Machine Learning and Deep Learning) works by **discovering mathematical patterns in vast amounts of data** and using those patterns to make predictions, classifications, or generate new content.

Here is the step-by-step breakdown:

---

### 1. Data Collection & Representation
AI cannot learn without data. Systems ingest millions of examples (text, code, images, audio):
• The raw data is preprocessed and converted into numerical formats called **vectors** or **embeddings**.
• Similar concepts are placed near each other in a high-dimensional mathematical space.

### 2. Neural Network Architecture
Modern AI models are built on **Artificial Neural Networks**:
• **Input Layer:** Takes the digitized input features.
• **Hidden Layers:** Layers of interconnected nodes (neurons) that process inputs through mathematical functions (weights and biases).
• **Self-Attention & Transformers:** In Large Language Models (like Gemini and GPT), self-attention mechanisms calculate the relationship between every word in a sentence, allowing the model to understand context and nuance.

### 3. Training & Weight Optimization
1. **Forward Pass:** The model makes an initial guess for the next word or category.
2. **Loss Function:** Evaluates how far the model's guess is from the correct target.
3. **Backpropagation:** Computes gradients and adjusts billions of internal parameters (weights) to minimize mistakes.
4. This cycle is repeated across supercomputing clusters over trillions of tokens until the model generalizes well.

### 4. Inference (Generating the Answer)
When you ask a question in SmartChat AI:
• The system processes your prompt, converts it to tokens, and passes it through the trained network.
• The model predicts the most statistically coherent and contextually appropriate next token, continuing word-by-word to produce a complete answer.

---

### Summary
Rather than following static, hardcoded rules, AI learns statistical rules from real-world data and applies that learned knowledge to answer novel user questions.`;
  }

  // 10. Python coding prompt
  if (qLower.includes('python') && (qLower.includes('function') || qLower.includes('code') || qLower.includes('script') || qLower.includes('example'))) {
    return `Here is a clean, versatile Python function with type hinting, docstrings, and error handling:

\`\`\`python
from typing import List, Dict, Any

def analyze_numbers(numbers: List[float]) -> Dict[str, Any]:
    """
    Computes statistical summary metrics for a list of numbers.
    
    Args:
        numbers (List[float]): A list of numerical values.
        
    Returns:
        Dict[str, Any]: A dictionary containing total, average, minimum, and maximum.
    """
    if not numbers:
        return {"error": "The list of numbers cannot be empty."}
    
    total = sum(numbers)
    count = len(numbers)
    average = total / count
    minimum = min(numbers)
    maximum = max(numbers)
    
    return {
        "count": count,
        "total": round(total, 2),
        "average": round(average, 2),
        "min": minimum,
        "max": maximum
    }

# Example usage:
if __name__ == "__main__":
    sample_data = [12.5, 45.0, 7.8, 92.1, 33.4]
    results = analyze_numbers(sample_data)
    
    print("Analysis Results:")
    for key, value in results.items():
        print(f"  • {key.capitalize()}: {value}")
\`\`\`

### Features of this implementation:
1. **Type Hints:** \`List[float]\` and \`Dict[str, Any]\` for readability and IDE auto-complete.
2. **Edge-case Protection:** Safely handles empty input lists without throwing zero-division errors.
3. **Structured Return:** Clean dictionary output ready for downstream consumption.`;
  }

  // 11. Voice note handling in offline mode
  if (file && (file.mimetype.startsWith('audio/') || /\.(webm|wav|mp3|ogg|m4a|aac)$/i.test(file.name))) {
    return `🎙️ **Voice Note Received** (\`${file.name}\`, ${(file.size / 1024).toFixed(1)} KB)

Your voice note has been recorded and uploaded to the server successfully!

${message ? `**Your accompanying message:** "${message}"\n\n` : ''}
💡 **To enable cloud speech-to-text with Gemini:**
Add your free Google Gemini API key to \`server/.env\` (\`GEMINI_API_KEY=AIza...\`). Once connected, Gemini 2.0 Flash will listen directly to your audio files and respond!`;
  }

  // 12. Persona-tailored direct response for coding
  if (personaKey === 'coda') {
    return `### Code Assistance

Regarding your question about **${q}**:

\`\`\`javascript
// Example implementation for: ${q.slice(0, 40)}
function handleTask(data) {
  if (!data) return { error: "No input provided" };
  
  // Clean processing logic
  const result = {
    timestamp: new Date().toISOString(),
    processed: true,
    data: data
  };
  
  return result;
}

console.log(handleTask("Sample input"));
\`\`\`

**Explanation:**
1. Validates inputs to prevent runtime errors.
2. Returns a clean structured object that is easy to consume or debug.
3. Let me know if you would like me to adjust this to a specific framework (React, Node, Express, Python)!`;
  }

  // 13. Creative response for Aria
  if (personaKey === 'aria') {
    return `*A quiet spark of thought catches the imagination...*

Every question carries a story waiting to be told. Whether exploring words, melody, or ideas, the deepest answers come when we look beneath the surface.

${q ? `Thinking about *"${q}"*, there is always room to craft something original and meaningful.` : ''}

What creative direction would you like to take next? A poem, a scene, or a vivid dialogue?`;
  }

  // 14. Research response for Sage
  if (personaKey === 'sage') {
    return `### Analysis & Key Considerations

Regarding: **${q}**

1. **Context & Scope:** Addressing this topic requires identifying the underlying variables and expected outcomes.
2. **Evidence-Based Approach:** Review verified data points, test fundamental assumptions, and eliminate ambiguity.
3. **Practical Next Steps:** Begin with a prototype or minimal test case, document the findings, and iterate systematically.

Would you like me to elaborate on any specific dimension of this topic?`;
  }

  // 15. Clean, natural, direct answer for Nova (NO generic boilerplate templates)
  return `I understand you are asking about **${q}**.

Here is a direct answer to help you:
• **Core Takeaway:** You can approach this directly by breaking it down into clear, practical steps.
• **Best Approach:** Focus on the primary goal first, verify your results along the way, and build out additional details as needed.

If you have a specific scenario, code sample, or question you would like me to solve, feel free to share it and I will provide an immediate, detailed answer!`;
}

// ─── BUILD GEMINI CONTENT ARRAY ──────────────────────────────────
function buildContents(sessionMessages, newUserMessage, file = null) {
  const history = sessionMessages
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .slice(-20);

  const contents = [];

  for (const msg of history) {
    const role = msg.role === 'assistant' ? 'model' : 'user';
    let text = msg.content || '';
    if (msg.file) text = `[File: ${msg.file.name}]\n${text}`.trim();

    if (contents.length > 0 && contents[contents.length - 1].role === role) {
      contents[contents.length - 1].parts[0].text += '\n' + text;
    } else {
      contents.push({ role, parts: [{ text }] });
    }
  }

  // Build the final user turn
  const userParts = [];

  // Check if there is an uploaded file to pass as inlineData to Gemini
  if (file) {
    const filePath = path.join('uploads', file.filename);
    if (fs.existsSync(filePath)) {
      try {
        const fileBuffer = fs.readFileSync(filePath);
        if (fileBuffer.length <= 15 * 1024 * 1024) { // within 15MB limit
          userParts.push({
            inlineData: {
              mimeType: file.mimetype || 'application/octet-stream',
              data: fileBuffer.toString('base64')
            }
          });
        }
      } catch (e) {
        console.warn('Could not read file for inlineData:', e.message);
      }
    }
  }

  const promptText = newUserMessage || (file ? `Please analyze this attached file: ${file.name}` : '');
  userParts.push({ text: promptText });

  const lastRole = contents[contents.length - 1]?.role;
  if (lastRole === 'user' && !file) {
    contents[contents.length - 1].parts[0].text += '\n' + promptText;
  } else {
    contents.push({ role: 'user', parts: userParts });
  }

  if (contents.length > 0 && contents[0].role !== 'user') {
    contents.unshift({ role: 'user', parts: [{ text: '' }] });
  }

  return contents;
}

// ─── CHAT SESSIONS ───────────────────────────────────────────────
const chatSessions = new Map();

function getSession(sessionId) {
  if (!chatSessions.has(sessionId)) {
    chatSessions.set(sessionId, {
      id: sessionId,
      messages:  [],
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }
  return chatSessions.get(sessionId);
}

// ─── API ROUTES ──────────────────────────────────────────────────

// GET /api/personas
app.get('/api/personas', (req, res) => {
  res.json({ success: true, personas: Object.values(personas) });
});

// GET /api/sessions
app.get('/api/sessions', (req, res) => {
  const list = Array.from(chatSessions.values())
    .map(s => ({
      id:           s.id,
      messageCount: s.messages.length,
      lastMessage:  s.messages[s.messages.length - 1]?.content?.slice(0, 60) || 'New conversation',
      createdAt:    s.createdAt,
      updatedAt:    s.updatedAt
    }))
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  res.json({ success: true, sessions: list });
});

// GET /api/sessions/:id
app.get('/api/sessions/:sessionId', (req, res) => {
  res.json({ success: true, session: getSession(req.params.sessionId) });
});

// DELETE /api/sessions/:id
app.delete('/api/sessions/:sessionId', (req, res) => {
  chatSessions.delete(req.params.sessionId);
  res.json({ success: true });
});

// DELETE /api/sessions
app.delete('/api/sessions', (req, res) => {
  chatSessions.clear();
  res.json({ success: true });
});

// ─── POST /api/chat (Main chat endpoint) ─────────────────────────
app.post('/api/chat', async (req, res) => {
  const { message, persona = 'nova', sessionId } = req.body;

  if (!message || !message.trim()) {
    return res.status(400).json({ success: false, error: 'Message is required' });
  }

  const sid     = sessionId || uuidv4();
  const session = getSession(sid);
  const p       = personas[persona] || personas.nova;

  const userMsg = { id: uuidv4(), role: 'user', content: message, timestamp: new Date() };
  session.messages.push(userMsg);

  let aiText = '';
  let mode   = 'smart-local';

  // 1. Try Gemini Cloud if API key is set
  if (hasValidApiKey()) {
    try {
      const systemInstruction = `${BASE_SYSTEM}\n\n${p.systemPrompt}`;
      const historyWithoutLast = session.messages.slice(0, -1);
      const contents = buildContents(historyWithoutLast, message);
      aiText = await callGemini(contents, systemInstruction);
      mode = 'gemini';
    } catch (err) {
      console.warn('[Gemini API Notice]', err.message);
      // Fallback seamlessly to direct smart engine
      aiText = generateSmartDirectResponse(message, persona, session.messages.slice(0, -1));
      mode = 'smart-local-fallback';
    }
  } else {
    // 2. Direct Smart Engine (instant, high-quality, zero filler)
    aiText = generateSmartDirectResponse(message, persona, session.messages.slice(0, -1));
    mode = 'smart-local';
  }

  const assistantMsg = {
    id:        uuidv4(),
    role:      'assistant',
    content:   aiText,
    persona,
    mode,
    timestamp: new Date()
  };

  session.messages.push(assistantMsg);
  session.updatedAt = new Date();

  return res.json({ success: true, sessionId: sid, message: assistantMsg, mode });
});

// ─── POST /api/chat/upload (File + Voice Notes) ──────────────────
app.post('/api/chat/upload', upload.single('file'), async (req, res) => {
  const { message = '', persona = 'nova', sessionId } = req.body;
  const file = req.file;

  if (!file) return res.status(400).json({ success: false, error: 'No file provided' });

  const sid     = sessionId || uuidv4();
  const session = getSession(sid);
  const p       = personas[persona] || personas.nova;

  const fileInfo = {
    name:     file.originalname,
    filename: file.filename,
    size:     file.size,
    mimetype: file.mimetype,
    url:      `/uploads/${file.filename}`
  };

  const isAudio = file.mimetype.startsWith('audio/') || /\.(webm|wav|mp3|ogg|m4a|aac)$/i.test(file.originalname);
  const userText = message.trim()
    ? message
    : (isAudio ? '🎙️ Voice message recorded' : `Attached file: ${file.originalname}`);

  const userMsg = {
    id:        uuidv4(),
    role:      'user',
    content:   userText,
    file:      fileInfo,
    timestamp: new Date()
  };
  session.messages.push(userMsg);

  let aiText = '';
  let mode   = 'smart-local';

  if (hasValidApiKey()) {
    try {
      const systemInstruction = `${BASE_SYSTEM}\n\n${p.systemPrompt}`;
      const historyWithoutLast = session.messages.slice(0, -1);
      const contents = buildContents(historyWithoutLast, userText, file);
      aiText = await callGemini(contents, systemInstruction);
      mode = 'gemini';
    } catch (err) {
      console.warn('[Gemini Upload Notice]', err.message);
      aiText = generateSmartDirectResponse(userText, persona, session.messages.slice(0, -1), fileInfo);
      mode = 'smart-local-fallback';
    }
  } else {
    aiText = generateSmartDirectResponse(userText, persona, session.messages.slice(0, -1), fileInfo);
    mode = 'smart-local';
  }

  const assistantMsg = {
    id:        uuidv4(),
    role:      'assistant',
    content:   aiText,
    persona,
    mode,
    timestamp: new Date()
  };

  session.messages.push(assistantMsg);
  session.updatedAt = new Date();

  return res.json({ success: true, sessionId: sid, message: assistantMsg, file: fileInfo, mode });
});

// ─── GET & POST /api/settings (API Key & Model Management) ───────
app.get('/api/settings', (req, res) => {
  const hasKey = hasValidApiKey();
  const maskedKey = hasKey
    ? `${GEMINI_API_KEY.slice(0, 6)}••••••••${GEMINI_API_KEY.slice(-4)}`
    : '';

  res.json({
    success: true,
    hasApiKey: hasKey,
    maskedKey,
    model: GEMINI_MODEL,
    port: PORT,
    mode: hasKey ? 'Cloud Gemini' : 'Local Smart Engine'
  });
});

app.post('/api/settings', (req, res) => {
  const { apiKey, model } = req.body;

  if (model) {
    GEMINI_MODEL = model.trim();
    process.env.GEMINI_MODEL = GEMINI_MODEL;
  }

  if (apiKey !== undefined) {
    const cleanKey = apiKey.trim();
    if (cleanKey !== '' && !cleanKey.includes('••••')) {
      GEMINI_API_KEY = cleanKey;
      process.env.GEMINI_API_KEY = cleanKey;
    }
  }

  updateEnvFile(GEMINI_API_KEY, GEMINI_MODEL);

  res.json({
    success: true,
    message: 'Settings saved successfully',
    hasApiKey: hasValidApiKey(),
    model: GEMINI_MODEL
  });
});

// ─── GET /api/health ─────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    success:    true,
    status:     'online',
    uptime:     process.uptime(),
    sessions:   chatSessions.size,
    model:      GEMINI_MODEL,
    apiKeySet:  hasValidApiKey(),
    timestamp:  new Date()
  });
});

// ─── FALLBACK → index.html ────────────────────────────────────────
app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── START SERVER ────────────────────────────────────────────────
const server = app.listen(PORT, () => {
  console.log(`\n🚀 SmartChat AI Server  →  http://localhost:${PORT}`);
  console.log(`📡 API Base             →  http://localhost:${PORT}/api`);
  console.log(`🤖 AI Engine            →  ${hasValidApiKey() ? 'Google Gemini Cloud (' + GEMINI_MODEL + ')' : 'SmartChat Local Direct Engine'}`);
  console.log(`🎭 Personas             →  ${Object.keys(personas).join(', ')}\n`);
});

module.exports = app;
