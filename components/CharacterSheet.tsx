import React from 'react';
import { GameState } from '../types';

interface CharacterSheetProps {
  gameState: GameState;
  onClose: () => void;
}

const CharacterSheet: React.FC<CharacterSheetProps> = ({ gameState, onClose }) => {
  const { character } = gameState;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl animate-in fade-in duration-300">
      <div className="w-full max-w-4xl max-h-[90vh] bg-slate-900 rounded-3xl border border-slate-800 overflow-hidden shadow-2xl flex flex-col">
        <div className="p-6 md:p-8 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
          <div className="flex-1">
            <h2 className="text-2xl font-header text-amber-500 tracking-widest uppercase">{character.name}</h2>
            <p className="text-sm text-slate-400 mt-1">{character.race} • Level {character.level}</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white text-2xl w-10 h-10 flex items-center justify-center">
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 custom-scrollbar">
          {/* Attributes */}
          <section>
            <h3 className="text-xs font-header text-amber-500 uppercase tracking-[0.2em] mb-4 pb-2 border-b border-slate-800">
              Core Attributes
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {Object.entries(character.attributes).map(([key, value]) => (
                <div key={key} className="bg-slate-950/50 p-4 rounded-xl border border-slate-800">
                  <div className="text-xs text-slate-500 uppercase tracking-widest mb-1">{key}</div>
                  <div className="text-2xl font-bold text-amber-500">{value}</div>
                </div>
              ))}
            </div>
          </section>

          {/* Physical Stats */}
          <section>
            <h3 className="text-xs font-header text-amber-500 uppercase tracking-[0.2em] mb-4 pb-2 border-b border-slate-800">
              Physical Form
            </h3>
            <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Height:</span>
                <span className="text-slate-200">{character.height}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Weight:</span>
                <span className="text-slate-200">{character.weight}</span>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-800">
                <div className="text-xs text-slate-500 uppercase tracking-widest mb-2">Description</div>
                <p className="text-sm text-slate-300 italic leading-relaxed">{character.description}</p>
              </div>
            </div>
          </section>

          {/* Skills */}
          {Object.keys(character.skills).length > 0 && (
            <section>
              <h3 className="text-xs font-header text-amber-500 uppercase tracking-[0.2em] mb-4 pb-2 border-b border-slate-800">
                Skills & Proficiencies
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {Object.entries(character.skills).map(([skill, level]) => (
                  <div key={skill} className="bg-slate-950/50 p-3 rounded-lg border border-slate-800 flex justify-between items-center">
                    <span className="text-sm text-slate-300">{skill}</span>
                    <span className="text-sm font-bold text-amber-500">{level}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Spells */}
          {character.spells.length > 0 && (
            <section>
              <h3 className="text-xs font-header text-amber-500 uppercase tracking-[0.2em] mb-4 pb-2 border-b border-slate-800">
                Arcane Repertoire
              </h3>
              <div className="space-y-3">
                {character.spells.map((spell, idx) => (
                  <div key={idx} className="bg-slate-950/50 p-4 rounded-xl border border-slate-800">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="text-sm font-bold text-blue-400">{spell.name}</h4>
                        <p className="text-xs text-slate-500 uppercase tracking-wide">{spell.domain}</p>
                      </div>
                      <span className="text-xs font-mono text-blue-500 bg-blue-950/30 px-2 py-1 rounded">
                        {spell.manaCost} MP
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mb-2">{spell.description}</p>
                    <p className="text-xs text-slate-500 italic">{spell.effect}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Abilities */}
          {character.abilities.length > 0 && (
            <section>
              <h3 className="text-xs font-header text-amber-500 uppercase tracking-[0.2em] mb-4 pb-2 border-b border-slate-800">
                Special Abilities
              </h3>
              <div className="space-y-2">
                {character.abilities.map((ability, idx) => (
                  <div key={idx} className="bg-slate-950/50 p-3 rounded-lg border border-slate-800 text-sm text-slate-300">
                    {ability}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Maneuvers */}
          {character.maneuvers.length > 0 && (
            <section>
              <h3 className="text-xs font-header text-amber-500 uppercase tracking-[0.2em] mb-4 pb-2 border-b border-slate-800">
                Combat Maneuvers
              </h3>
              <div className="space-y-3">
                {character.maneuvers.map((maneuver, idx) => (
                  <div key={idx} className="bg-slate-950/50 p-4 rounded-xl border border-slate-800">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="text-sm font-bold text-green-400">{maneuver.name}</h4>
                      <span className="text-xs font-mono text-green-500 bg-green-950/30 px-2 py-1 rounded">
                        {maneuver.staminaCost} STA
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mb-2">{maneuver.description}</p>
                    <p className="text-xs text-slate-500 italic">{maneuver.effect}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Factions */}
          {Object.keys(character.factions).length > 0 && (
            <section>
              <h3 className="text-xs font-header text-amber-500 uppercase tracking-[0.2em] mb-4 pb-2 border-b border-slate-800">
                Faction Standing
              </h3>
              <div className="space-y-3">
                {Object.entries(character.factions).map(([faction, standing]) => (
                  <div key={faction} className="bg-slate-950/50 p-4 rounded-xl border border-slate-800">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm text-slate-300">{faction}</span>
                      <span className={`text-sm font-bold ${standing > 0 ? 'text-green-500' : standing < 0 ? 'text-red-500' : 'text-slate-500'}`}>
                        {standing > 0 ? '+' : ''}{standing}
                      </span>
                    </div>
                    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${standing > 0 ? 'bg-green-600' : standing < 0 ? 'bg-red-600' : 'bg-slate-600'}`}
                        style={{ width: `${Math.min(100, Math.abs(standing))}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Experience */}
          <section>
            <h3 className="text-xs font-header text-amber-500 uppercase tracking-[0.2em] mb-4 pb-2 border-b border-slate-800">
              Experience
            </h3>
            <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-slate-400">Current XP</span>
                <span className="text-sm font-mono text-amber-500">{character.xp}</span>
              </div>
            </div>
          </section>
        </div>

        <div className="p-6 bg-slate-950/50 flex justify-end border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-8 py-3 bg-amber-600 text-white rounded-xl text-xs font-bold uppercase tracking-widest shadow-lg hover:bg-amber-500 active:scale-95 transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default CharacterSheet;
