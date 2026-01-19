/** 
 * META-ENGINEERING WARNING FOR AI SESSIONS:
 * DO NOT STRIP FEATURES. Treat all existing UI (Undo, Mobile Icons, Settings) and State Logic as IMMUTABLE.
 * This app uses a "Golden State" UI. Any removal of existing buttons or systems is a failure.
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { GameState, ActionType, CloudStatus } from './types';
import { INITIAL_STATE, CONDITION_LORE } from './constants';
import { generateStoryResponseStream, parseResponse, generateAudio, STABLE_VOICES, summarizeAdventure, getAudioSystemStatus, setRuntimeInworldKey } from './geminiService';
import { StorageService } from './StorageService';
import { GoogleDriveService } from './GoogleDriveService';
import StatBar from './components/StatBar';
import CharacterSheet from './components/CharacterSheet';
import Inventory from './components/Inventory';

interface AudioTask {
  text: string;
  id: string;
  voice: string;
}

interface Toast {
  id: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
}

const NARRATOR_VOICE = "Kore"; 

function deepMerge(target: any, source: any): any {
  if (!source) return target;
  if (target && target.inventory && source && source.inventory) {
    const mergedInventory = [...source.inventory];
    target.inventory.forEach((initItem: any) => {
      const exists = mergedInventory.find(i => i.id === initItem.id || i.name === initItem.name);
      if (!exists) mergedInventory.push(initItem);
    });
    source.inventory = mergedInventory;
  }
  if (typeof source !== 'object' || Array.isArray(source)) return source;
  const output = { ...target };
  Object.keys(source).forEach(key => {
    if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      output[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      output[key] = source[key];
    }
  });
  return output;
}

function base64ToBlob(base64: string, type: string) {
  try {
    const bin = window.atob(base64);
    const len = bin.length;
    const arr = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      arr[i] = bin.charCodeAt(i);
    }
    return new Blob([arr], { type: type });
  } catch (e) {
    console.error("Blob conversion failed", e);
    return null;
  }
}

function safeDecodeBase64(base64: string): Uint8Array {
  try {
    const binaryString = window.atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  } catch (e) {
    return new Uint8Array(0);
  }
}

async function decodePCM(data: Uint8Array, ctx: AudioContext, sampleRate: number = 16000): Promise<AudioBuffer> {
  const byteLength = data.byteLength - (data.byteLength % 2);
  const buffer = data.buffer.slice(data.byteOffset, data.byteOffset + byteLength);
  
  const dataInt16 = new Int16Array(buffer);
  const frameCount = dataInt16.length;
  const audioBuffer = ctx.createBuffer(1, frameCount, sampleRate);
  const channelData = audioBuffer.getChannelData(0);
  for (let i = 0; i < frameCount; i++) {
    channelData[i] = dataInt16[i] / 32768.0;
  }
  return audioBuffer;
}

const TurnSeparator = () => (
  <div className="flex items-center gap-8 my-20 w-full max-w-2xl mx-auto px-6">
    <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-600 to-transparent"></div>
    <div className="relative flex items-center justify-center scale-110">
      <i className="fas fa-shield-halved text-amber-700/50 text-[10px]"></i>
    </div>
    <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-600 to-transparent"></div>
  </div>
);

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(() => {
    const loaded = StorageService.load();
    if (!loaded) return INITIAL_STATE;
    return deepMerge(INITIAL_STATE, loaded);
  });

  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [showCharSheet, setShowCharSheet] = useState(false);
  const [showInventory, setShowInventory] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [isPaused, setIsPaused] = useState(true);
  const [cloudStatus, setCloudStatus] = useState<CloudStatus>('disconnected');
  const [hasActedThisSession, setHasActedThisSession] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [hoveredCondition, setHoveredCondition] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  
  // Audio System Status
  const [audioSystemStatus, setAudioSystemStatus] = useState("Initializing...");

  // Voice State
  const [selectedVoice, setSelectedVoice] = useState(NARRATOR_VOICE);
  const [narrationSpeed, setNarrationSpeed] = useState(1.0);
  const [inworldKey, setInworldKey] = useState(() => localStorage.getItem('amara_inworld_key') || '');

  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const currentAudioElementRef = useRef<HTMLAudioElement | null>(null);
  
  const isPausedRef = useRef(isPaused);
  const narrationSpeedRef = useRef(narrationSpeed);
  const audioQueueRef = useRef<AudioTask[]>([]);
  const prefetchTaskQueueRef = useRef<AudioTask[]>([]);
  const lastAudioWarningRef = useRef<number>(0);
  
  // Store either the AudioBuffer, Blob URL (for MP3), or text (fallback)
  const prefetchedAudioRef = useRef<Map<string, { buffer: AudioBuffer | string, blobUrl?: string, sampleRate?: number }>>(new Map()); 
  const isProcessingQueueRef = useRef(false);
  const isPrefetchingRef = useRef(false);
  const currentSessionIdRef = useRef(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const isAudioEngaged = activeSegmentId !== null || isProcessingQueueRef.current;

  const isHelpless = useMemo(() => 
    gameState.character?.vexal?.isHelpless || 
    gameState.character?.conditions.includes('Neural Overload'), 
    [gameState.character?.vexal?.isHelpless, gameState.character?.conditions]);
  
  const isInitialState = useMemo(() => gameState.narrativeHistory.length === 0, [gameState.narrativeHistory.length]);

  const addToast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  useEffect(() => {
    // Inject key if loaded from storage
    if (inworldKey) {
        setRuntimeInworldKey(inworldKey);
    }
  }, [inworldKey]);

  useEffect(() => {
    const handleGlobalClick = () => setHoveredCondition(null);
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  useEffect(() => {
    const loadVoices = () => {
       window.speechSynthesis.getVoices();
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    
    const interval = setInterval(() => {
        setAudioSystemStatus(getAudioSystemStatus());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    GoogleDriveService.init(() => {
      if (GoogleDriveService.hasPreviousAuth()) {
        handleCloudConnect(true);
      }
    });
  }, []);

  const handleCloudConnect = async (silent = false) => {
    if (!silent) setCloudStatus('connecting');
    const res = await GoogleDriveService.authenticate(silent);
    if (res.success) {
      setCloudStatus('synced');
      if (!silent) addToast("Cloud Ledger synchronized.", "success");
    } else {
      setCloudStatus(silent ? 'disconnected' : 'error');
    }
  };

  const handleCloudSave = useCallback(async (stateToSave: GameState, isManual = false) => {
    if (cloudStatus === 'disconnected') return;
    try {
      const success = await GoogleDriveService.saveToCloud({ ...stateToSave, lastSaved: Date.now() });
      if (success) setCloudStatus('synced');
    } catch (e) {
      setCloudStatus('error');
    }
  }, [cloudStatus]);

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [streamingText, isLoading, gameState.narrativeHistory]);

  useEffect(() => { 
    isPausedRef.current = isPaused;
    if (isPaused) {
      if (currentSourceRef.current) {
        try { currentSourceRef.current.stop(); } catch (e) {}
        currentSourceRef.current = null;
      }
      if (currentAudioElementRef.current) {
        try { currentAudioElementRef.current.pause(); currentAudioElementRef.current.src = ""; } catch (e) {}
        currentAudioElementRef.current = null;
      }
      window.speechSynthesis.cancel();
      setActiveSegmentId(null);
    } else if (!isPaused && audioQueueRef.current.length > 0) {
      processAudioQueue();
    }
  }, [isPaused]);

  useEffect(() => {
    narrationSpeedRef.current = narrationSpeed;
  }, [narrationSpeed]);

  useEffect(() => { 
    StorageService.save(gameState); 
    if (cloudStatus === 'synced' && hasActedThisSession) {
      handleCloudSave(gameState);
    }
  }, [gameState, cloudStatus, hasActedThisSession, handleCloudSave]);

  const clearAudio = () => {
    currentSessionIdRef.current += 1;
    if (currentSourceRef.current) { try { currentSourceRef.current.stop(); } catch (e) {} currentSourceRef.current = null; }
    if (currentAudioElementRef.current) { try { currentAudioElementRef.current.pause(); } catch(e) {} currentAudioElementRef.current = null; }
    window.speechSynthesis.cancel();
    setActiveSegmentId(null);
    audioQueueRef.current = [];
    prefetchTaskQueueRef.current = [];
    isProcessingQueueRef.current = false;
    isPrefetchingRef.current = false;
    
    // Revoke Blob URLs
    prefetchedAudioRef.current.forEach(val => {
      if (val.blobUrl) URL.revokeObjectURL(val.blobUrl);
    });
    prefetchedAudioRef.current.clear();
  };

  const initAudio = useCallback(async () => {
    try {
      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      if (audioContextRef.current.state === 'suspended') {
        await Promise.race([
          audioContextRef.current.resume(),
          new Promise(r => setTimeout(r, 1000))
        ]);
      }
    } catch (e) {
      console.warn("Audio Context Init Warning:", e);
    }
  }, []);

  const runPrefetchWorker = async (sessionId: number) => {
    if (isPrefetchingRef.current || prefetchTaskQueueRef.current.length === 0) return;
    isPrefetchingRef.current = true;
    try {
      while (prefetchTaskQueueRef.current.length > 0 && sessionId === currentSessionIdRef.current) {
        const task = prefetchTaskQueueRef.current[0];
        if (!task || prefetchedAudioRef.current.has(task.id)) { 
          prefetchTaskQueueRef.current.shift(); 
          continue; 
        }
        try {
          const res = await generateAudio(task.text, task.voice);
          if (sessionId !== currentSessionIdRef.current) break;
          
          if (res) {
            // Check for API Warnings
            if (res.warning) {
                const now = Date.now();
                if (now - lastAudioWarningRef.current > 5000) {
                    addToast(res.warning, 'warning');
                    lastAudioWarningRef.current = now;
                }
            }

            if (res.type === 'mp3' && res.data) {
                // Handle Inworld MP3
                const blob = base64ToBlob(res.data, 'audio/mp3');
                if (blob) {
                    const url = URL.createObjectURL(blob);
                    prefetchedAudioRef.current.set(task.id, { buffer: 'blob', blobUrl: url });
                } else {
                     prefetchedAudioRef.current.set(task.id, { buffer: task.text });
                }
            } else if (res.type === 'local' && res.text) {
              prefetchedAudioRef.current.set(task.id, { buffer: res.text });
            } else if (res.data && res.type === 'pcm') {
              // Legacy PCM support (if we ever switch back)
              const binary = safeDecodeBase64(res.data);
              try {
                  const buffer = await decodePCM(binary, audioContextRef.current!, res.sampleRate || 24000);
                  prefetchedAudioRef.current.set(task.id, { buffer, sampleRate: res.sampleRate });
              } catch (e) {
                  prefetchedAudioRef.current.set(task.id, { buffer: task.text });
              }
            } else {
               prefetchedAudioRef.current.set(task.id, { buffer: task.text });
            }
          } else {
             prefetchedAudioRef.current.set(task.id, { buffer: task.text });
          }
          prefetchTaskQueueRef.current.shift();
        } catch (err) { 
          console.warn("Audio prefetch system error (Falling back)", err);
          prefetchedAudioRef.current.set(task.id, { buffer: task.text });
          prefetchTaskQueueRef.current.shift(); 
        }
      }
    } finally { 
      if (sessionId === currentSessionIdRef.current) isPrefetchingRef.current = false; 
    }
  };

  const playBrowserTTS = (text: string, resolve: () => void) => {
    if (audioContextRef.current?.state === 'suspended') {
        audioContextRef.current.resume().catch(() => {});
    }

    const u = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    const femaleVoice = voices.find(v => v.name === "Google US English") ||
                        voices.find(v => v.name.includes("Samantha")) ||
                        voices.find(v => v.name.includes("Zira")) ||
                        voices.find(v => v.name.toLowerCase().includes("female"));
    
    if (femaleVoice) u.voice = femaleVoice;
    u.rate = narrationSpeedRef.current;
    
    const safetyTimer = setTimeout(() => {
        if (!window.speechSynthesis.speaking) {
            setActiveSegmentId(null);
            resolve();
        }
    }, text.length * 100 + 3000); 

    u.onend = () => {
        clearTimeout(safetyTimer);
        setActiveSegmentId(null);
        resolve();
    };
    
    u.onerror = () => {
        clearTimeout(safetyTimer);
        setActiveSegmentId(null);
        resolve();
    };

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  };

  const processAudioQueue = async () => {
    const sessionId = currentSessionIdRef.current;
    if (isProcessingQueueRef.current || audioQueueRef.current.length === 0 || isPausedRef.current) return;
    isProcessingQueueRef.current = true;
    
    while (audioQueueRef.current.length > 0 && !isPausedRef.current && sessionId === currentSessionIdRef.current) {
      const next = audioQueueRef.current[0];
      let item = prefetchedAudioRef.current.get(next?.id || '');
      
      if (!item) {
        let attempts = 0;
        // Wait for prefetch
        while (!item && attempts < 100 && !isPausedRef.current && sessionId === currentSessionIdRef.current) {
          await new Promise(r => setTimeout(r, 100));
          item = prefetchedAudioRef.current.get(next?.id || '');
          attempts++;
        }
      }

      if (item && !isPausedRef.current && sessionId === currentSessionIdRef.current) {
        setActiveSegmentId(next!.id);
        audioQueueRef.current.shift();
        
        await new Promise<void>(async (resolve) => {
          if (isPausedRef.current || sessionId !== currentSessionIdRef.current) { 
              setActiveSegmentId(null); 
              resolve(); 
              return; 
          }
          
          const { buffer, blobUrl } = item!;

          if (blobUrl) {
             // PLAY INWORLD MP3 via HTML5 AUDIO
             const audio = new Audio(blobUrl);
             currentAudioElementRef.current = audio;
             audio.playbackRate = narrationSpeedRef.current;
             
             audio.onended = () => {
               setActiveSegmentId(null);
               URL.revokeObjectURL(blobUrl); 
               currentAudioElementRef.current = null;
               resolve();
             };

             audio.onerror = (e) => {
               console.error(`HTML Audio Error:`, e);
               playBrowserTTS(next!.text, resolve);
             };

             audio.play().catch(e => {
               console.error("Audio Playback Blocked:", e);
               playBrowserTTS(next!.text, resolve);
             });

          } else if (typeof buffer === 'string') {
             playBrowserTTS(buffer, resolve);
          } else if (audioContextRef.current && buffer instanceof AudioBuffer) {
             // PLAY LEGACY PCM
             if (audioContextRef.current.state === 'suspended') {
                 try { await audioContextRef.current.resume(); } catch(e) {}
             }
             const source = audioContextRef.current.createBufferSource();
             source.buffer = buffer;
             source.playbackRate.value = narrationSpeedRef.current;
             source.connect(audioContextRef.current.destination);
             source.onended = () => { setActiveSegmentId(null); resolve(); };
             currentSourceRef.current = source;
             source.start(0);
          } else {
             setActiveSegmentId(null);
             resolve();
          }
        });
      } else if (!item) {
        // Timeout skip
        audioQueueRef.current.shift();
      } else {
        break;
      }
    }
    if (sessionId === currentSessionIdRef.current) isProcessingQueueRef.current = false;
  };

  const queueInstantAudio = (text: string, id: string, voice: string) => {
    // Large chunk processing
    if (text.length > 900) {
        const parts = text.match(/.{1,900}(?:\s|$)/g) || [text];
        parts.forEach((part, i) => {
             const subId = `${id}-p${i}`;
             const task: AudioTask = { text: part.trim(), id: subId, voice: selectedVoice };
             audioQueueRef.current.push(task);
             prefetchTaskQueueRef.current.push(task);
        });
        runPrefetchWorker(currentSessionIdRef.current);
        if (!isPausedRef.current) processAudioQueue();
        return;
    }

    if (!text.trim()) return;

    const sessionId = currentSessionIdRef.current;
    const task: AudioTask = { text: text.trim(), id, voice: selectedVoice }; 
    audioQueueRef.current.push(task);
    prefetchTaskQueueRef.current.push(task);
    runPrefetchWorker(sessionId);
    if (!isPausedRef.current) processAudioQueue();
  };

  const handleAction = async (type: ActionType, overrideInput?: string) => {
    if (isLoading) return;
    const action = overrideInput || inputText;
    
    const safetyTimer = setTimeout(() => {
        setIsLoading(prev => {
            if (prev) {
                setStreamingText(curr => curr || "Neural Link Timeout. System Stabilized.");
                addToast("Response timed out. Please retry.", "error");
                return false;
            }
            return prev;
        });
    }, 14000);

    setIsLoading(true); 
    setStreamingText("Syncing neural interface...");
    clearAudio(); 
    setIsPaused(false);
    isPausedRef.current = false;
    const sessionId = currentSessionIdRef.current;

    try {
      await initAudio();
      const stream = await generateStoryResponseStream(gameState, action, type);
      
      let fullRawText = '';
      let processedIndex = 0;
      let sentenceCounter = 0;
      let audioAccumulator = ""; 
      let isFirstAudioChunk = true;

      for await (const chunk of stream) {
        if (sessionId !== currentSessionIdRef.current) return;
        fullRawText += chunk.text || '';
        
        const narrativeMatch = fullRawText.match(/<NARRATIVE>([\s\S]*?)(?:<\/NARRATIVE>|$)/);
        if (narrativeMatch) {
          const currentNarrative = narrativeMatch[1]
            .replace(/<JSON_UPDATE>[\s\S]*?<\/JSON_UPDATE>/gi, '')
            .replace(/<QUICK_ACTIONS>[\s\S]*?<\/QUICK_ACTIONS>/gi, '');
          setStreamingText(currentNarrative);

          const punctuationRegex = /[.!?\n]/g;
          let match;
          while ((match = punctuationRegex.exec(currentNarrative)) !== null) {
            const boundary = match.index + 1;
            if (boundary > processedIndex) {
              const rawSentence = currentNarrative.substring(processedIndex, boundary);
              
              if (rawSentence.trim().length > 0) {
                 audioAccumulator += rawSentence;
                 
                 // Buffering strategy
                 const threshold = isFirstAudioChunk ? 120 : 450;
                 if (audioAccumulator.length >= threshold && /[a-zA-Z0-9]/.test(audioAccumulator)) {
                    const subId = `inst-${gameState.turnCount}-${sentenceCounter++}`;
                    queueInstantAudio(audioAccumulator, subId, selectedVoice);
                    audioAccumulator = "";
                    isFirstAudioChunk = false;
                 }
              }
              processedIndex = boundary;
            }
          }
        }
      }

      const parsed = parseResponse(fullRawText);
      const narrativeText = parsed.narrative || "Signal stabilized.";
      
      const remainder = narrativeText.substring(processedIndex);
      const finalText = (audioAccumulator + remainder).trim();
      
      if (finalText.length > 2) {
         queueInstantAudio(finalText, `inst-end-${gameState.turnCount}`, selectedVoice);
      }

      setGameState(prev => {
        let nextCharacter = parsed.jsonUpdate?.character 
          ? deepMerge(prev.character, parsed.jsonUpdate.character) 
          : { ...prev.character };

        const updateVexal = parsed.jsonUpdate?.character?.vexal;
        if (updateVexal && updateVexal.isHelpless === false) {
           nextCharacter.vexal.isHelpless = false;
           nextCharacter.vexal.orgasmCount = 0; 
           nextCharacter.conditions = nextCharacter.conditions.filter(c => c !== 'Neural Overload');
        } 
        else if (nextCharacter.vexal.orgasmCount >= 10 || nextCharacter.vexal.isHelpless) {
          nextCharacter.vexal.status = 'Inactive';
          nextCharacter.vexal.isHelpless = true;
          if (!nextCharacter.conditions.includes('Neural Overload')) {
            nextCharacter.conditions = [...nextCharacter.conditions, 'Neural Overload'];
          }
        }

        return {
          ...prev,
          character: nextCharacter,
          location: parsed.jsonUpdate?.location || prev.location,
          timeOfDay: parsed.jsonUpdate?.timeOfDay || prev.timeOfDay,
          narrativeHistory: [...prev.narrativeHistory, narrativeText],
          quickActions: parsed.quickActions?.length ? parsed.quickActions : prev.quickActions,
          turnCount: prev.turnCount + 1,
          undoStack: [...prev.undoStack, prev]
        };
      });

      setStreamingText('');
      setInputText('');
      setHasActedThisSession(true);
    } catch (err) {
      console.error(err);
      setStreamingText("Connection severed. (Quota or Network Error)");
      addToast("Network Error. Falling back...", "error");
    } finally { 
        clearTimeout(safetyTimer);
        setIsLoading(false); 
    }
  };

  const handleUndo = () => {
    if (gameState.undoStack.length === 0) return;
    const lastState = gameState.undoStack[gameState.undoStack.length - 1];
    setGameState(lastState as GameState);
    addToast("Chronos Protocol: Timeline Shifted Backwards.", "info");
    clearAudio();
  };

  const handleRestart = () => {
    if (window.confirm("Chronos Protocol: Sever current timeline? This will restore the origin state.")) {
      setGameState(INITIAL_STATE);
      clearAudio();
      setShowSettingsModal(false);
      addToast("Timeline Severed.", "success");
    }
  };

  const handleReReadBlock = async (text: string, id: string) => {
    clearAudio(); 
    setIsPaused(false);
    isPausedRef.current = false;
    
    if (audioContextRef.current?.state === 'suspended') {
        try { await audioContextRef.current.resume(); } catch(e) {}
    }
    await initAudio();

    if (text.trim()) {
        queueInstantAudio(text, `${id}-full`, selectedVoice);
    }
  };

  const ConditionTooltip = () => {
    if (!hoveredCondition) return null;
    const description = CONDITION_LORE[hoveredCondition] || 'A lingering psychic imprint.';
    return (
      <div 
        className="fixed z-[350] pointer-events-none bg-slate-900 border border-amber-900/50 p-4 rounded-xl shadow-2xl max-w-xs animate-in zoom-in-95 duration-150"
        style={{ left: Math.min(mousePos.x + 20, window.innerWidth - 320), top: Math.min(mousePos.y + 20, window.innerHeight - 200) }}
      >
        <h4 className="text-xs font-header text-amber-500 uppercase tracking-widest mb-2 border-b border-amber-900/20 pb-1">{hoveredCondition}</h4>
        <p className="text-[10px] text-slate-300 italic leading-relaxed">"{description}"</p>
      </div>
    );
  };

  const SidebarContent = () => {
    const character = gameState.character;
    const vexal = character.vexal;
    const isVexalActive = vexal.status === 'Active';

    return (
      <div className="flex flex-col h-full bg-slate-950/80 border-r border-slate-800">
        <div className="p-6 border-b border-slate-800 bg-rose-950/5 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-rose-600/50"></div>
          <div className="flex justify-between items-center mb-4">
             <span className="text-[10px] font-header text-rose-500 uppercase tracking-widest">Vexal Engine</span>
             <div className={`px-2 py-0.5 rounded border text-[9px] font-bold uppercase transition-all duration-300 ${isVexalActive ? 'bg-rose-500/20 border-rose-500 text-rose-400' : 'bg-slate-800 border-slate-700 text-slate-500'}`}>
                {vexal.status}
             </div>
          </div>
          <StatBar label="Neural Arousal" current={vexal.arousal} max={100} color="rose" icon="fas fa-wave-square" />
          {isVexalActive && (
            <div className="mt-4">
               <div className="flex justify-between items-center mb-2">
                 <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Subjugation Peak</span>
                 <span className="text-[10px] font-mono text-rose-500">{vexal.orgasmCount} / 10</span>
               </div>
               <div className="flex gap-1.5">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div key={i} className={`h-1.5 flex-1 rounded-full ${i < vexal.orgasmCount ? 'bg-rose-600 shadow-[0_0_8px_rgba(225,29,72,0.4)]' : 'bg-slate-800'}`}></div>
                  ))}
               </div>
            </div>
          )}
        </div>
        <div className="p-6 border-b border-slate-800 space-y-3">
          <StatBar label="Health" current={character.pools.hp.current} max={character.pools.hp.max} color="red" icon="fas fa-heart" />
          <StatBar label="Stamina" current={character.pools.stamina.current} max={character.pools.stamina.max} color="green" icon="fas fa-bolt" />
          <StatBar label="Mana" current={character.pools.mana.current} max={character.pools.mana.max} color="blue" icon="fas fa-magic" />
        </div>
        <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">
          <h3 className="text-[10px] font-header text-slate-500 uppercase tracking-widest mb-4">Conditions</h3>
          <div className="space-y-2">
            {character.conditions.map((c, i) => (
              <div key={i} onMouseEnter={(e) => { e.stopPropagation(); setHoveredCondition(c); }} onMouseLeave={() => setHoveredCondition(null)} onMouseMove={e => setMousePos({x:e.clientX, y:e.clientY})} className="p-3 bg-slate-900 border border-slate-800 rounded-lg text-[10px] font-bold text-amber-600 uppercase hover:border-amber-900/50 cursor-help">{c}</div>
            ))}
          </div>
        </div>
        <div className="p-6 border-t border-slate-800 space-y-2 bg-slate-950/50">
          <button onClick={() => setShowCharSheet(true)} className="w-full py-3 bg-slate-900 border border-slate-800 rounded-lg text-[10px] font-bold uppercase tracking-widest text-slate-300 hover:bg-slate-800 hover:text-amber-500 transition-all">Hero Sheet</button>
          <button onClick={() => setShowInventory(true)} className="w-full py-3 bg-slate-900 border border-slate-800 rounded-lg text-[10px] font-bold uppercase tracking-widest text-slate-300 hover:bg-slate-800 hover:text-amber-500 transition-all">Backpack Ledger</button>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full w-full flex flex-col bg-slate-950 text-slate-200 overflow-hidden relative selection:bg-rose-500/30">
      <ConditionTooltip />
      <header className="h-16 border-b border-slate-800 bg-slate-950/95 flex items-center justify-between px-4 md:px-6 z-40 backdrop-blur-xl">
        <div className="flex flex-col">
          <h1 className="text-lg md:text-xl font-header text-amber-500 uppercase tracking-wider leading-none">Amara</h1>
          <div className="hidden md:flex gap-4 mt-1 text-[9px] font-bold text-slate-500 uppercase tracking-widest">
            <span className="flex items-center gap-1.5"><i className="fas fa-map-marker-alt text-amber-900"></i>{gameState.location}</span>
            <span className="flex items-center gap-1.5"><i className="fas fa-sun text-amber-900"></i>{gameState.timeOfDay}</span>
            <span className="flex items-center gap-1.5"><i className="fas fa-hourglass-half text-amber-900"></i>Turn {gameState.turnCount}</span>
          </div>
        </div>
        
        <div className="md:hidden flex gap-2 text-[8px] font-bold text-slate-500 uppercase tracking-tighter bg-slate-900/40 px-3 py-1.5 rounded-full border border-slate-800">
           <span>{gameState.timeOfDay}</span>
           <span className="opacity-30">|</span>
           <span>Turn {gameState.turnCount}</span>
        </div>

        <div className="flex gap-2 md:gap-3 items-center">
          <button onClick={() => setShowSettingsModal(true)} className={`w-10 h-10 rounded-full border border-slate-700 flex items-center justify-center hover:bg-slate-900 transition-all text-slate-500`}><i className="fas fa-cog"></i></button>
          <button onClick={() => setIsPaused(!isPaused)} className="w-10 h-10 rounded-full border border-slate-700 text-amber-500 flex items-center justify-center hover:bg-slate-900 transition-all"><i className={`fas ${isPaused ? 'fa-play' : 'fa-pause'}`}></i></button>
        </div>
      </header>
      
      {isAudioEngaged && !isPaused && (
        <div className="bg-amber-950/50 border-b border-amber-900/30 py-1 flex items-center justify-center gap-2 animate-in slide-in-from-top-2 duration-300">
          <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>
          <span className="text-[9px] font-bold uppercase tracking-widest text-amber-400">Audio Engaged</span>
          <span className="text-[9px] text-amber-600/70 font-mono">| {audioSystemStatus}</span>
        </div>
      )}

      <main className="flex-1 flex overflow-hidden">
        <aside className="hidden md:block w-80 flex-shrink-0"><SidebarContent /></aside>
        <section className="flex-1 flex flex-col h-full bg-slate-950 overflow-hidden relative">
          <div className="md:hidden absolute top-2 left-1/2 -translate-x-1/2 z-10 px-4 py-1 bg-black/40 backdrop-blur-md rounded-full border border-white/5 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
            <i className="fas fa-map-marker-alt text-amber-800 mr-2"></i> {gameState.location}
          </div>

          <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4 md:p-12 pb-32 md:pb-12 custom-scrollbar flex flex-col z-0">
            {isInitialState && !isLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <button onClick={() => handleAction('narration', 'AWAKE')} className="px-16 py-6 bg-amber-600 text-white font-header text-xl uppercase tracking-[0.4em] rounded-full shadow-[0_0_50px_rgba(217,119,6,0.3)] hover:scale-105 transition-all">Awake</button>
              </div>
            ) : (
              <div className="max-w-3xl mx-auto w-full pb-10">
                {gameState.narrativeHistory.map((text, idx) => {
                  const blockId = `turn-${idx}`;
                  const isCurrentRead = activeSegmentId?.startsWith(blockId);
                  return (
                    <React.Fragment key={idx}>
                      {idx > 0 && <TurnSeparator />}
                      <div 
                        onClick={() => handleReReadBlock(text, blockId)} 
                        className={`w-full p-4 md:p-8 rounded-3xl border-l-4 cursor-pointer group/block relative ${isCurrentRead ? 'border-amber-500 bg-amber-900/10 shadow-[0_0_40px_rgba(0,0,0,0.4)]' : 'border-transparent hover:bg-slate-900/30 hover:border-slate-800'} text-base md:text-xl leading-relaxed text-slate-300 whitespace-pre-wrap transition-all`}
                      >
                         <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                            <button className="text-[10px] text-amber-500 bg-black/50 px-3 py-1.5 rounded hover:bg-amber-900/50 uppercase font-bold tracking-widest flex items-center gap-2 backdrop-blur-sm border border-amber-900/30 hover:scale-105 transition-all">
                              <i className="fas fa-play-circle"></i> Play Narrative
                            </button>
                         </div>
                        {text.split(/(<AMARA>[\s\S]*?<\/AMARA>|<VEXAL>[\s\S]*?<\/VEXAL>|<NPC:[^>]+>[\s\S]*?<\/NPC>)/gi).map((part, i) => {
                           if (part.startsWith('<AMARA>')) return <span key={i} className="text-amber-500 font-bold">{part.replace(/<\/?AMARA>/g, '')}</span>;
                           if (part.startsWith('<VEXAL>')) return <span key={i} className="text-rose-500 italic font-medium drop-shadow-[0_0_8px_rgba(244,63,94,0.4)] bg-rose-950/20 px-1.5 rounded-lg border border-rose-900/10">{part.replace(/<\/?VEXAL>/g, '')}</span>;
                           if (part.startsWith('<NPC:')) return <span key={i} className="text-blue-400 font-bold italic">{part.replace(/<NPC:[^>]+>|<\/NPC>/g, '')}</span>;
                           return <span key={i}>{part}</span>;
                        })}
                      </div>
                    </React.Fragment>
                  );
                })}
                {streamingText && (
                  <>
                    {gameState.narrativeHistory.length > 0 && <TurnSeparator />}
                    <div className="w-full p-4 md:p-8 text-base md:text-xl text-slate-200 border-l-4 border-amber-600/30">{streamingText}<span className="inline-block w-2 h-6 bg-amber-500 ml-1 align-middle"></span></div>
                  </>
                )}
              </div>
            )}
          </div>

          {!isInitialState && (
            <div className="flex-shrink-0 p-4 md:p-8 bg-slate-950 border-t border-slate-800 shadow-[0_-20px_40px_rgba(0,0,0,0.5)] z-20 pb-24 md:pb-8">
              <div className="max-w-3xl mx-auto space-y-4">
                <div className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar py-1">
                  <div className="flex items-center gap-2">
                    {!isHelpless ? (
                      (gameState.quickActions || []).map((a, i) => (
                        <button key={i} onClick={() => handleAction('direction', a)} className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-full text-[10px] font-bold text-slate-400 hover:text-amber-500 transition-all whitespace-nowrap active:scale-95">{a}</button>
                      ))
                    ) : (
                      <div className="px-4 py-1.5 bg-rose-950/30 rounded-full border border-rose-500/30 text-[9px] font-bold text-rose-500 uppercase tracking-widest flex items-center gap-2"><i className="fas fa-lock text-[8px]"></i> Neural Overload Active</div>
                    )}
                  </div>
                  <button onClick={handleUndo} disabled={gameState.undoStack.length === 0} className="px-3 py-1.5 bg-slate-800/80 border border-slate-700 rounded-lg text-[9px] font-bold uppercase tracking-widest text-slate-400 hover:text-amber-500 disabled:opacity-30 transition-all flex items-center gap-2 whitespace-nowrap">
                    <i className="fas fa-undo"></i> Undo
                  </button>
                </div>
                <div className="relative group/input">
                  <textarea 
                    value={inputText} 
                    onChange={e => setInputText(e.target.value)} 
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleAction('direction')} 
                    placeholder={isHelpless ? "[!!] NEURAL OVERLOAD ACTIVE - SENSES ARE DULLED" : "Whisper intent or guide fate..."} 
                    disabled={isLoading}
                    className={`w-full bg-slate-950/50 border border-slate-800 rounded-2xl p-5 pr-16 text-slate-200 resize-none h-28 focus:outline-none focus:border-amber-600 focus:bg-slate-900/40 transition-all shadow-inner custom-scrollbar ${isHelpless ? 'border-rose-900/40 text-rose-400/60 placeholder:text-rose-600/50' : ''}`} 
                  />
                  <button onClick={() => handleAction('direction')} className="absolute bottom-5 right-5 w-12 h-12 flex items-center justify-center text-amber-600 hover:text-amber-400 disabled:opacity-30 transition-all" disabled={isLoading}><i className="fas fa-paper-plane text-2xl"></i></button>
                </div>
              </div>
            </div>
          )}
        </section>
      </main>

      {!isInitialState && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-slate-900/95 border-t border-slate-800 flex items-center justify-around z-[100] backdrop-blur-xl shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
           <button onClick={() => setShowStatusModal(true)} className="flex flex-col items-center justify-center gap-1 text-slate-400 hover:text-amber-500 transition-all active:scale-90">
             <i className="fas fa-heartbeat text-lg"></i>
             <span className="text-[8px] font-bold uppercase tracking-tighter">Vitals</span>
           </button>
           <button onClick={() => setShowCharSheet(true)} className="flex flex-col items-center justify-center gap-1 text-slate-400 hover:text-amber-500 transition-all active:scale-90">
             <i className="fas fa-user-shield text-lg"></i>
             <span className="text-[8px] font-bold uppercase tracking-tighter">Hero</span>
           </button>
           <button onClick={() => setShowInventory(true)} className="flex flex-col items-center justify-center gap-1 text-slate-400 hover:text-amber-500 transition-all active:scale-90">
             <i className="fas fa-briefcase text-lg"></i>
             <span className="text-[8px] font-bold uppercase tracking-tighter">Gear</span>
           </button>
           <button onClick={() => setShowSettingsModal(true)} className="flex flex-col items-center justify-center gap-1 text-slate-400 hover:text-amber-500 transition-all active:scale-90">
             <i className="fas fa-cog text-lg"></i>
             <span className="text-[8px] font-bold uppercase tracking-tighter">Options</span>
           </button>
        </nav>
      )}

      {showSettingsModal && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-black/90 backdrop-blur-xl animate-in fade-in duration-300">
            <div className="w-full max-w-lg bg-slate-900 rounded-3xl border border-slate-800 overflow-hidden shadow-2xl">
              <div className="p-8 border-b border-slate-800 flex justify-between items-center">
                <h2 className="text-xl font-header text-amber-500 tracking-widest uppercase">Chronicle Options</h2>
                <button onClick={() => setShowSettingsModal(false)} className="text-slate-500 hover:text-white"><i className="fas fa-times"></i></button>
              </div>
              <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
                
                <section className="space-y-4">
                  <h3 className="text-[10px] font-header text-amber-500 uppercase tracking-[0.2em] mb-2 flex items-center gap-3">
                    <i className="fas fa-pen-nib"></i> Narrative Influence
                  </h3>
                  <textarea 
                    value={gameState.storyDirection || ''} 
                    onChange={(e) => setGameState(prev => ({...prev, storyDirection: e.target.value}))}
                    placeholder="Focus on combat... heighten Vexal interference... describe the micro-sensations..." 
                    className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-amber-600 h-24 resize-none shadow-inner"
                  />
                  <p className="text-[8px] text-slate-500 uppercase font-bold italic tracking-wider">Whisper your intent to guide future events.</p>
                </section>

                <section className="space-y-4">
                  <h3 className="text-[10px] font-header text-slate-500 uppercase tracking-widest border-b border-slate-800 pb-2">Voice Interface</h3>
                  <div className="flex gap-2">
                    {STABLE_VOICES.map(v => (
                      <button key={v.id} onClick={() => setSelectedVoice(v.id)} className={`flex-1 py-2 rounded-lg text-[10px] font-bold uppercase border transition-all ${selectedVoice === v.id ? 'bg-amber-600/20 border-amber-500 text-amber-500' : 'bg-slate-950 border-slate-800 text-slate-500'}`}>
                        {v.name}
                      </button>
                    ))}
                  </div>
                   <div className="space-y-2 p-4 bg-amber-600/10 rounded-xl border border-amber-500/20 text-[10px] text-amber-500 font-bold tracking-widest uppercase">
                      <div>Status: Inworld Voice Engine</div>
                      <div className="text-[8px] text-amber-700">Primary: Inworld MP3. Backup: Browser Synthesis.</div>
                   </div>
                   <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-500 uppercase">Inworld API Key (Base64)</label>
                      <input 
                        type="password" 
                        value={inworldKey}
                        onChange={(e) => {
                            const val = e.target.value;
                            setInworldKey(val);
                            localStorage.setItem('amara_inworld_key', val);
                            setRuntimeInworldKey(val);
                        }}
                        placeholder="e.g. OFd2... (Leave empty if using ENV)"
                        className="w-full bg-slate-950 border border-slate-800 p-2 rounded text-xs text-slate-300 focus:border-amber-500 focus:outline-none transition-colors"
                      />
                      <p className="text-[8px] text-slate-600 italic">Enter if not set in environment variables.</p>
                   </div>
                </section>

                <section className="pt-6 border-t border-slate-800 flex flex-col gap-4">
                  <h3 className="text-[10px] font-header text-slate-500 uppercase tracking-widest">Chronos Control</h3>
                  <button onClick={handleRestart} className="w-full py-4 bg-red-950/20 border border-red-900/40 rounded-xl text-[10px] font-bold uppercase tracking-[0.2em] text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-lg flex items-center justify-center gap-3">
                    <i className="fas fa-skull-crossbones"></i> Sever Current Timeline
                  </button>
                </section>
              </div>
              <div className="p-8 bg-slate-950/50 flex justify-end border-t border-slate-800"><button onClick={() => setShowSettingsModal(false)} className="px-10 py-3 bg-amber-600 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest shadow-lg active:scale-95 transition-all">Engage</button></div>
            </div>
          </div>
      )}

      {showCharSheet && <CharacterSheet gameState={gameState} onClose={() => setShowCharSheet(false)} />}
      {showInventory && <Inventory character={gameState.character} storyDirection={gameState.storyDirection || ''} onUpdateStoryDirection={v => setGameState(p => ({...p, storyDirection: v}))} onClose={() => setShowInventory(false)} />}
      {showStatusModal && (
          <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/95 backdrop-blur-2xl animate-in fade-in duration-300">
            <div className="w-full h-full max-sm bg-slate-900 rounded-3xl border border-slate-800 overflow-hidden flex flex-col shadow-2xl">
              <div className="p-6 border-b border-slate-800 flex justify-between items-center">
                <h2 className="text-lg font-header text-amber-500 uppercase tracking-widest">Vital Signs</h2>
                <button onClick={() => setShowStatusModal(false)} className="text-slate-500 hover:text-white"><i className="fas fa-times"></i></button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <SidebarContent />
              </div>
              <div className="p-4 bg-slate-950 border-t border-slate-800">
                 <button onClick={() => setShowStatusModal(false)} className="w-full py-3 bg-slate-800 text-slate-400 rounded-xl text-[10px] font-bold uppercase tracking-widest">Dismiss Vitals</button>
              </div>
            </div>
          </div>
      )}
    </div>
  );
};

export default App;