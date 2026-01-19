import { GoogleGenAI } from "@google/genai";
import { GameState, ActionType } from "./types";
import { SYSTEM_INSTRUCTION } from "./constants";

// ============================================================================
// API KEY CONFIGURATION
// ============================================================================
// Keys are loaded in the following order (first found wins):
// 1. Environment variables (GEMINI_API_KEY, INWORLD_API_KEY)
// 2. Runtime keys set via UI
// 3. Hardcoded fallbacks (for local development only)
// ============================================================================

// IMPORTANT: For production deployment, set these as environment variables
// Do not commit real API keys to version control
const HARDCODED_GEMINI_KEY = ""; // Leave empty for production
const HARDCODED_INWORLD_KEY = ""; // Leave empty for production
// ============================================================================


// Voice mappings - Mapped to Standard Inworld Voice IDs
const INWORLD_VOICES: Record<string, string> = {
  "Kore": "Celeste",    // Mapped to Celeste (Standard Female) as 'Kore' is not a valid ID
  "Fenrir": "Brett",    // Standard Male
  "Puck": "Spike",      // Standard Expressive
  "Charon": "Goliath",  // Standard Deep
  "Aoede": "Celeste",   // Standard Female
  "Zephyr": "Gen"       // Standard Neutral/Female
};

export const STABLE_VOICES = [
  { id: "Kore", name: "Inworld: Kore (Balanced)" },
  { id: "Fenrir", name: "Inworld: Brett (Deep)" },
  { id: "Puck", name: "Inworld: Spike (Playful)" },
  { id: "Charon", name: "Inworld: Goliath (Grave)" },
  { id: "Aoede", name: "Inworld: Celeste (Elegant)" },
  { id: "Zephyr", name: "Inworld: Gen (Calm)" },
];

let lastUsedSystem = "Initializing...";
let lastTtsCallTime = 0;
const MIN_TTS_INTERVAL = 250; 

// Runtime key storage for when process.env is not available
let runtimeInworldKey = "";

export const setRuntimeInworldKey = (key: string) => {
  runtimeInworldKey = key;
};

export const getAudioSystemStatus = () => lastUsedSystem;

export interface AudioResponse {
  data?: string; // Base64
  text?: string;
  type: 'pcm' | 'local' | 'mp3';
  sampleRate?: number;
  warning?: string;
}

// Helper to enforce timeouts on async operations
const withTimeout = <T>(promise: Promise<T>, ms: number = 10000): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("TIMEOUT")), ms))
  ]);
};

// Helper to get Gemini Client with fallback
const getGeminiClient = () => {
  // Priority: process.env > hardcoded fallback
  const key = (process.env.API_KEY || process.env.GEMINI_API_KEY || HARDCODED_GEMINI_KEY || "").trim();
  if (!key) throw new Error("Missing Gemini API Key. Set GEMINI_API_KEY environment variable.");
  return new GoogleGenAI({ apiKey: key });
};

export const summarizeAdventure = async (oldSummary: string, segments: string[]) => {
  try {
    const ai = getGeminiClient();
    const model = 'gemini-3-flash-preview';
    const prompt = `Task: Condense narrative segments into a new, rich summary.\nCurrent Summary: ${oldSummary}\n\nNew Segments:\n${segments.join('\n\n')}\nReturn ONLY text.`;
    const response = await ai.models.generateContent({ model, contents: prompt });
    return response.text || oldSummary;
  } catch (e) {
    console.warn("Summary failed", e);
    return oldSummary;
  }
};

export const generateStoryResponseStream = async (gameState: GameState, action: string, type: ActionType) => {
  const ai = getGeminiClient();
  const model = 'gemini-3-flash-preview';
    
  const pools = gameState.character.pools;
  const vexal = gameState.character.vexal;
  const isHelpless = vexal.isHelpless || vexal.orgasmCount >= 10 || gameState.character.conditions.includes('Neural Overload');

  const statsContext = `CRITICAL STATE ANCHOR (USE ONLY THESE VALUES):
HP: ${pools.hp.current}/${pools.hp.max}
STAMINA: ${pools.stamina.current}/${pools.stamina.max}
MANA: ${pools.mana.current}/${pools.mana.max}
AROUSAL: ${vexal.arousal}%
ORGASM COUNT: ${vexal.orgasmCount}/10
STATUS: ${vexal.status}
HELPLESS: ${isHelpless}
`;
    
  const helplessnessContext = isHelpless 
    ? `CRITICAL NARRATIVE OVERRIDE: AMARA IS IN NEURAL OVERLOAD. HELPLESS AND SLACK. NO AGENCY.`
    : '';

  const lastNarrative = gameState.narrativeHistory.slice(-3).join('\n---\n');

  const prompt = `LORE & MEMORY:\n${gameState.memoryVault.join('\n')}\nSummary: ${gameState.memorySummary}\nPROSE STYLE REFERENCE (LAST 3 TURNS):\n${lastNarrative}\nCONTEXT: ${gameState.location}\n${statsContext}\n${helplessnessContext}\nSTORY DIRECTION: ${gameState.storyDirection || 'Standard Grim Dark'}\nAction: "${action}"`;
    
  return await ai.models.generateContentStream({
    model,
    contents: [{ parts: [{ text: prompt }] }],
    config: { 
      systemInstruction: SYSTEM_INSTRUCTION, 
      temperature: 0.9,
      maxOutputTokens: 8192 
    },
  });
};

const sanitizeAudioText = (text: string) => {
  return text
    .replace(/<AMARA>/g, '')
    .replace(/<\/AMARA>/g, '')
    .replace(/<VEXAL>/g, '')
    .replace(/<\/VEXAL>/g, '')
    .replace(/<NPC:[^>]+>/g, '')
    .replace(/<\/NPC>/g, '')
    .replace(/\[[a-zA-Z\s]+\]/g, '')
    .replace(/\*([^\*]+)\*/g, " $1 ")
    .replace(/\s+/g, ' ')
    .trim();
};

// Inworld TTS Audio Generator (MP3 Streaming)
async function generateInworldAudio(text: string, voiceId: string): Promise<AudioResponse | null> {
  const now = Date.now();
  const timeSinceLast = now - lastTtsCallTime;
  if (timeSinceLast < MIN_TTS_INTERVAL) {
    await new Promise(r => setTimeout(r, MIN_TTS_INTERVAL - timeSinceLast));
  }
  lastTtsCallTime = Date.now();

  // Priority: Env Variable -> UI Input -> Hardcoded fallback
  const apiKey = (process.env.INWORLD_API_KEY || runtimeInworldKey || HARDCODED_INWORLD_KEY || "").trim();
  if (!apiKey) {
    throw new Error("Missing Inworld API Key. Set INWORLD_API_KEY environment variable or configure in Settings.");
  }

  // Use PascalCase ID for V1
  const inworldVoiceId = INWORLD_VOICES[voiceId] || voiceId || "Celeste";

  // We send multiple parameter formats to satisfy different versions of the Inworld gateway
  const response = await fetch("https://api.inworld.ai/tts/v1/voice:stream", {
    method: "POST",
    headers: {
      "Authorization": `Basic ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      text: text,
      
      // REQUIRED fields based on error history
      voice_id: inworldVoiceId,
      model_id: "inworld-tts-1-max", // Re-added: Mandatory for some gateways

      // Compatibility fields
      voice: inworldVoiceId, 
      voiceName: inworldVoiceId, 
      
      audioConfig: {         
        audioEncoding: "MP3",
        speakingRate: 0.95,
        pitch: 0
      }
    })
  });

  if (!response.ok) {
    const err = await response.text();
    console.error("Inworld API Error Body:", err);
    throw new Error(`Inworld API Error ${response.status}: ${err}`);
  }

  // Handle Chunked JSON Stream
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Failed to get response reader");

  const decoder = new TextDecoder();
  let fullBase64Audio = "";
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    // Preserve the last line in buffer as it might be incomplete
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const json = JSON.parse(line);
        // Supports standard V1 (audioContent), alternate (audioChunk), and legacy (audio_content)
        if (json.audioContent) {
          fullBase64Audio += json.audioContent;
        } else if (json.audioChunk) {
          fullBase64Audio += json.audioChunk;
        } else if (json.audio_content) {
          fullBase64Audio += json.audio_content;
        }
      } catch (e) {
        console.warn("Failed to parse Inworld chunk", e);
      }
    }
  }
  
  // Flush remaining buffer
  if (buffer.trim()) {
      try {
        const json = JSON.parse(buffer);
        if (json.audioContent) fullBase64Audio += json.audioContent;
        else if (json.audioChunk) fullBase64Audio += json.audioChunk;
        else if (json.audio_content) fullBase64Audio += json.audio_content;
      } catch (e) {}
  }

  if (!fullBase64Audio) {
    console.error("Inworld Empty Response. Buffer dump:", buffer);
    throw new Error("Inworld response contained no audio data (check voice ID or text content)");
  }

  return { data: fullBase64Audio, type: 'mp3' };
}

// Master Audio Function
export const generateAudio = async (text: string, voiceId?: string): Promise<AudioResponse | null> => {
  const sanitized = sanitizeAudioText(text);
  if (!sanitized) return null;

  let warningMsg: string | undefined = undefined;

  // 1. Try Inworld (Primary)
  try {
    const res = await withTimeout(generateInworldAudio(sanitized, voiceId || 'Kore'), 15000);
    lastUsedSystem = `Inworld: ${INWORLD_VOICES[voiceId || 'Kore'] || voiceId || 'Kore'}`;
    return res;
  } catch (e: any) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("Inworld Audio Failed (Attempting Fallback):", msg);
    
    lastUsedSystem = `Browser (Fallback: ${msg.substring(0, 15)}...)`;
    
    if (msg.includes("Missing Inworld")) {
       warningMsg = "Inworld Key Missing (See Settings)";
    } else if (msg.includes("401") || msg.includes("Auth")) {
       warningMsg = "Inworld Key Invalid";
    } else if (msg.includes("quota") || msg.includes("429")) {
       warningMsg = "Inworld Quota Exceeded";
    } else if (msg.includes("voice_id") || msg.includes("voiceName")) {
       warningMsg = "Voice Config Error";
    } else {
       warningMsg = "Voice Connection Failed";
    }
  }

  // 2. Fallback to Browser TTS
  return { type: 'local', text: sanitized, warning: warningMsg };
};

function safelyParseJson(raw: string, fallback: any = null): any {
  if (!raw) return fallback;
  try {
    const clean = raw.trim()
      .replace(/^```json\n?/, '') 
      .replace(/^```\n?/, '')     
      .replace(/\n?```$/, '');    
    return JSON.parse(clean);
  } catch (e) {
    return fallback;
  }
}

export const parseResponse = (raw: string) => {
  const narrativeMatch = raw.match(/<NARRATIVE>([\s\S]*?)<\/NARRATIVE>/i);
  const jsonMatch = raw.match(/<JSON_UPDATE>([\s\S]*?)<\/JSON_UPDATE>/i);
  const actionsMatch = raw.match(/<QUICK_ACTIONS>([\s\S]*?)<\/QUICK_ACTIONS>/i);
  
  let narrative = narrativeMatch ? narrativeMatch[1].trim() : '';
  
  if (!narrative) {
      narrative = raw.replace(/<JSON_UPDATE>[\s\S]*?<\/JSON_UPDATE>/gi, '')
                     .replace(/<QUICK_ACTIONS>[\s\S]*?<\/QUICK_ACTIONS>/gi, '')
                     .replace(/<[^>]+>[\s\S]*?<\/[^>]+>/gi, '')
                     .replace(/<[^>]+>/g, '')
                     .trim();
  } else {
    narrative = narrative.replace(/<JSON_UPDATE>[\s\S]*?<\/JSON_UPDATE>/gi, '')
                         .replace(/<QUICK_ACTIONS>[\s\S]*?<\/QUICK_ACTIONS>/gi, '');
  }

  return {
    narrative: narrative,
    jsonUpdate: jsonMatch ? safelyParseJson(jsonMatch[1]) : null,
    quickActions: actionsMatch ? safelyParseJson(actionsMatch[1], []) : []
  };
};

export const hasHardcodedKey = () => !!HARDCODED_GEMINI_KEY;