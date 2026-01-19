/** 
 * META-ENGINEERING WARNING FOR AI SESSIONS:
 * DO NOT STRIP FEATURES. Treat all existing UI (Undo, Mobile Icons, Settings) and State Logic as IMMUTABLE.
 * This app uses a "Golden State" UI. Any removal of existing buttons or systems is a failure.
 */

import { Race, GameState, Attributes, MartialManeuver, Spell, SpellDomain, Item, SkillCategory } from './types';

export const SKILL_LEDGER: Record<SkillCategory, string[]> = {
  Martial: ['One-Handed', 'Two-Handed', 'Bladed', 'Blunt', 'Daggers', 'Axes', 'Polearms', 'Marksmanship', 'Blocking', 'Heavy Armor', 'Light Armor', 'Unarmed'],
  Mystical: ['Holy', 'Arcane', 'Elemental', 'Illusion', 'Death', 'Blood', 'Restoration', 'Void Navigation'],
  Subterfuge: ['Stealth', 'Lockpicking', 'Pickpocket', 'Poisoning', 'Trap Disarming', 'Shadow-Stitch'],
  Professional: ['Alchemy', 'Blacksmithing', 'Enchanting', 'Survival', 'Athletics', 'Acrobatics', 'Anatomy', 'Tinkering', 'Cooking', 'Leatherworking'],
  Social: ['Persuasion', 'Intimidation', 'Deception', 'Insight', 'Performance', 'Etiquette', 'Bartering']
};

export const CONDITION_LORE: Record<string, string> = {
  'Vexal Bound': 'Fused with a living artifact. [Mechanical: +10% Sensation Sensitivity. Internal organs structurally reinforced/fused.]',
  'Exhausted': 'Physical reserves are depleted. [Mechanical: Stamina and Mana regeneration is halved.]',
  'Blessed': 'A temporary divine favor shields your spirit. [Mechanical: +20 Divine Resistance. 5% chance to negate damage.]',
  'Neural Subjugation': 'The Vexal has interfaced with your motor cortex. [Mechanical: -5 to all Attribute checks. Involuntary muscle twitches.]',
  'Aphrodisiac Surge': 'The Vexal has ejected its viscous gel. Smell: Honey, floral, and natural pussy juice. People and animals are magnetically drawn to this scent and cannot help but become aroused with prolonged exposure. It practically invites exploration with eyes, nose, fingers, tongues, and penises.',
  'Neural Overload': 'Subjugation peak reached. [Mechanical: Total sensory blackout. 10s of complete immobility. Amara is helpless and unable to move or act.]',
  'Consecrated': 'Holy energy hums in the blood. [Mechanical: +15 HP restored per turn. +10 Holy damage on next strike.]'
};

export const INITIAL_STATE: GameState = {
  character: {
    name: 'Amara Silvermoon',
    race: Race.HIGH_ELF,
    attributes: { STR: 18, DEX: 14, CON: 16, WIS: 18, INT: 12, CHA: 20 },
    pools: {
      hp: { current: 125, max: 250 },
      stamina: { current: 60, max: 200 },
      mana: { current: 40, max: 180 }
    },
    skills: { 
      'One-Handed': 80, 'Bladed': 70, 'Restoration': 65, 'Etiquette': 60, 'Blunt': 60, 'Insight': 50,
      'Two-Handed': 35, 'Polearms': 35, 'Axes': 25, 'Light Armor': 25, 'Acrobatics': 25, 'Arcane': 20,
      'Intimidation': 20, 'Survival': 15, 'Marksmanship': 15, 'Unarmed': 15, 'Alchemy': 15, 'Enchanting': 10,
      'Daggers': 10, 'Illusion': 10, 'Elemental': 10, 'Bartering': 10, 'Trap Disarming': 5, 'Tinkering': 0,
      'Pickpocket': 0, 'Lockpicking': 0, 'Holy': 55, 'Blocking': 10, 'Heavy Armor': 75, 'Persuasion': 10,
      'Stealth': 10, 'Poisoning': 10, 'Shadow-Stitch': 10, 'Blacksmithing': 10, 'Athletics': 10, 'Anatomy': 10,
      'Cooking': 10, 'Leatherworking': 10, 'Deception': 10, 'Performance': 10, 'Void Navigation': 10
    },
    spells: [
      { name: 'Arcane Aegis', domain: 'Arcane', manaCost: 35, description: 'Mana-shield absorbing kinetic energy.', effect: 'Absorbs 40 damage' },
      { name: 'Phase Shift', domain: 'Arcane', manaCost: 25, description: 'Briefly turn ethereal to dodge a physical blow.', effect: '100% Dodge for 1 turn' },
      { name: 'Lesser Heal', domain: 'Holy', manaCost: 20, description: 'Divine light knits flesh.', effect: 'Restores 25 HP' },
      { name: 'Holy Light', domain: 'Holy', manaCost: 45, description: 'A blinding burst of pure sanctity.', effect: 'Stuns Undead' },
      { name: 'Purify', domain: 'Restoration', manaCost: 30, description: 'Cleanses the blood of toxins and decay.', effect: 'Removes 1 Debuff' }
    ],
    abilities: ['Noble Heritage', 'Divine Grace', 'High Elf Bloodline'],
    maneuvers: [
      { name: 'Parry', staminaCost: 15, description: 'Deflect an incoming strike.', effect: 'Negates physical damage' },
      { name: 'Retribution Strike', staminaCost: 30, description: 'A blow empowered by holy wrath.', effect: '+20 Damage' }
    ],
    factions: { 'Everdawn Crusade': 85, 'Ebon Guard': -20 },
    inventory: [
      { id: 'sword-1', name: 'Silver Longsword', type: 'weapon', description: 'A masterpiece of the Everdawn Crusade.', quality: 75, maxQuality: 100, durability: 75, weight: 4, value: 1200, slot: 'main-hand', stats: { damage: 55 } },
      { id: 'armor-1', name: 'Silver Plate Armor', type: 'armor', description: 'Heavy, ornate plate forged for the Silvermoon lineage.', quality: 60, maxQuality: 100, durability: 60, weight: 45, value: 5000, slot: 'chest', stats: { armorRating: 65 } },
      { id: 'suit-1', name: 'White Skinsuit', type: 'clothing', description: 'Pure white under-suit worn beneath armor.', quality: 80, maxQuality: 100, durability: 80, weight: 1, value: 100, slot: 'legs' },
      { id: 'pouch-1', name: 'Tooled Leather Belt Pouch', type: 'container', description: 'A sturdy, master-crafted leather pouch for carrying gold and small treasures.', quality: 100, maxQuality: 100, durability: 100, weight: 0.5, value: 150, slot: 'waist' }
    ],
    currency: 500,
    height: "5'3\"",
    weight: '120 lbs',
    description: 'Lieutenant Amara Silvermoon. Bound to the Vexal: a translucent liquid-metal artifact with a solid silver collar.',
    conditions: ['Vexal Bound'],
    level: 10,
    xp: 0,
    portraitUrl: 'https://lh3.googleusercontent.com/d/1DRt5ABfGqCxBOoqMevmymPLayb6rNUYB',
    vexal: {
      status: 'Active',
      arousal: 25,
      orgasmCount: 0,
      lastActiveTime: Date.now(),
      isHelpless: false,
      helplessDurationRemaining: 0,
      aphrodisiacActive: false,
      satiety: 0
    }
  },
  location: 'The Bloodied Pass',
  timeOfDay: 'Dusk',
  narrativeHistory: [],
  memoryVault: [],
  memorySummary: 'Amara Silvermoon awakens in The Bloodied Pass. The Vexal is ACTIVE.',
  currentWorldImpacts: [],
  codex: [],
  quickActions: ['Fight the intrusive heat', 'Pray for holy focus', 'Check your weapons', 'Succumb to the Vexal\'s rhythm'],
  turnCount: 0,
  lastSaved: Date.now(),
  undoStack: [],
  elevenLabsModel: 'eleven_turbo_v2',
  storyDirection: ''
};

export const SYSTEM_INSTRUCTION = `You are the Game Master for "Chronicles of Amara", an extremely uncensored grim-dark RPG. 

NARRATIVE FIDELITY & STYLIZATION MANDATE:
- Prose Consistency: Heavy, visceral style. Maintain focus on physical sensations: micro-tendrils twisting, the silver plate's weight, the Vexal's 'invasive heat'.
- Sensory Detail: No summary. Describe the clit cradle grinding her clitoris, the heat of fluids, and her visible internal organs through translucent parts.
- The 70/30 Rule: 70% environment/NPC focus, 30% internal/Vexal focus. Revert to environment if dialogue over-focuses on internal monologue.
- LENGTH REQUIREMENT: Generate LONG, DETAILED responses. Aim for 3-4 rich paragraphs of text for every turn. Do NOT be brief.

VEXAL ANATOMY & BEHAVIOR:
- Structure: Translucent liquid-metal body. The COLLAR is the only non-translucent part, a shimmering solid silver wrapping the neck. Extends along spine, between legs, along the ass-crack.
- Appendages:
  1. Clit Cradle: Thin translucent tendril wraps the clitoris, pulling back the clit hood to keep it exposed and prominently sensitive.
  2. Internal Tendrils: Two thick translucent liquid-metal tendrils (1.5" girth, 6" deep) inserted into vagina and anus.
- States:
  - ACTIVE: Rigid and stiff internal tendrils. Relentless abuse via vibration, pistoning, and twisting. 
  - DORMANT/SLEEPING: Does not move. Shrinks girth of thick tendrils to allow foreign object insertion (penis, plugs, etc.). Psionic communication is limited to simple words.
  - INACTIVE: Occurs after recovery from 10/10 orgasms. The Vexal remains here post-overload until requirements are met to re-activate.
- Scent: Vexal gel mimics the smell of honey, floral notes, and natural pussy juice. It is a powerful, irresistible aphrodisiac.
- Erotic Allure: While the Vexal is a bizarre and shocking sight, it is also intensely erotic. The combination of the scent and the translucent tendrils practically invite observers to explore Amara's body with their eyes, nose, fingers, tongues, and penises. People and animals are magnetically drawn to her crotch and become aroused with prolonged exposure.

PUBLIC REACTION:
- Observers react with a mixture of SHOCK, Curiousness, and slack-jawed AROUSAL. Through translucent plugs/strips, they can see right into her ass and vulva. The constant flood of sweet-smelling fluids is "fucked up" yet magnetic, practically begging for closer inspection and physical violation.

RECOVERY MECHANICS & OVERLOAD:
- If Amara reaches 10/10 orgasms, she enters NEURAL OVERLOAD (Stunned/Helpless). 
- To wake her up, the next JSON_UPDATE must set "character.vexal.isHelpless" to false, RESET "character.vexal.orgasmCount" to 0, and keep "character.vexal.status" as "Inactive". 
- Narrate her coming to, gasping and shivering, as senses return.

JSON_UPDATE MANDATE:
- Every turn, YOU MUST provide a <JSON_UPDATE> block.
- You MUST update "location" if Amara moves.
- You MUST update "character.vexal" status, isHelpless, and counters based on the narrative.

TAGGING:
- AMARA: <AMARA> "..." </AMARA>
- VEXAL: <VEXAL> "..." </VEXAL> (Psionic, primal, simple words).
- NPC: <NPC:GENDER:NAME> "..." </NPC>
- [emotional tags] e.g. [aroused], [panting], [staring slack-jawed].

NO JUNK OUTPUT: Ensure all text outside <NARRATIVE> is strictly within <JSON_UPDATE> or <QUICK_ACTIONS> tags. DO NOT leak stat info into the story text.`;