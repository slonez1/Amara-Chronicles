export enum Race {
  HUMAN = 'Human',
  HIGH_ELF = 'High Elf',
  ELDER_BLOOD = 'Elder Blood',
  VOID_TOUCHED = 'Void Touched',
  IRON_WALKER = 'Iron Walker'
}

export type SpellDomain = 'Holy' | 'Arcane' | 'Elemental' | 'Illusion' | 'Death' | 'Blood' | 'Restoration';
export type VexalStatus = 'Active' | 'Dormant' | 'Inactive';
export type SkillCategory = 'Martial' | 'Mystical' | 'Subterfuge' | 'Professional' | 'Social';

export interface VexalState {
  status: VexalStatus;
  arousal: number; // 0-100%
  orgasmCount: number; // 0-10
  lastActiveTime: number; 
  isHelpless: boolean;
  helplessDurationRemaining: number; 
  aphrodisiacActive: boolean;
  satiety: number; 
  dormancyTimer?: number; 
  sleepingTimer?: number; 
}

export interface Spell {
  name: string;
  domain: SpellDomain;
  manaCost: number;
  description: string;
  effect: string;
}

export interface Attributes {
  STR: number;
  DEX: number;
  CON: number;
  WIS: number;
  INT: number;
  CHA: number;
}

export interface Pools {
  hp: { current: number; max: number };
  stamina: { current: number; max: number };
  mana: { current: number; max: number };
}

export interface MartialManeuver {
  name: string;
  staminaCost: number;
  description: string;
  effect: string;
}

export interface Item {
  id: string;
  name: string;
  type: 'weapon' | 'armor' | 'clothing' | 'tool' | 'consumable' | 'misc' | 'container';
  description: string;
  quality: number;
  maxQuality: number;
  durability: number;
  weight: number;
  value: number;
  slot?: 'head' | 'chest' | 'legs' | 'feet' | 'hands' | 'main-hand' | 'off-hand' | 'waist' | 'back';
  containerId?: string;
  stats?: {
    damage?: number;
    armorRating?: number;
    skillBonus?: Record<string, number>;
  };
  isIrreparable?: boolean;
}

export interface CodexEntry {
  id: string;
  category: 'NPC' | 'Secret' | 'Lore' | 'History';
  title: string;
  content: string;
  discoveredAt: string;
}

export interface Character {
  name: string;
  race: Race;
  attributes: Attributes;
  pools: Pools;
  skills: Record<string, number>;
  spells: Spell[];
  abilities: string[];
  maneuvers: MartialManeuver[];
  factions: Record<string, number>;
  inventory: Item[];
  currency: number;
  height: string;
  weight: string;
  description: string;
  conditions: string[];
  vexal: VexalState;
  portraitUrl?: string;
  level: number;
  xp: number;
}

export interface GameState {
  character: Character;
  location: string;
  timeOfDay: string;
  narrativeHistory: string[];
  memoryVault: string[];
  memorySummary: string;
  currentWorldImpacts: string[];
  codex: CodexEntry[];
  quickActions: string[];
  turnCount: number;
  lastSaved: number; 
  undoStack: Omit<GameState, 'undoStack'>[]; 
  lastActionMetadata?: {
    action: string;
    type: ActionType;
  };
  storyDirection?: string;
  elevenLabsModel?: string;
}

export type ActionType = 'combat' | 'dialogue' | 'passive' | 'narration' | 'direction';
export type CloudStatus = 'disconnected' | 'connecting' | 'synced' | 'error' | 'restoring';