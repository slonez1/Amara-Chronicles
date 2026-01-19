import React, { useState } from 'react';
import { Character, Item } from '../types';

interface InventoryProps {
  character: Character;
  storyDirection: string;
  onUpdateStoryDirection: (value: string) => void;
  onClose: () => void;
}

const Inventory: React.FC<InventoryProps> = ({ character, storyDirection, onUpdateStoryDirection, onClose }) => {
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);

  const groupedInventory = character.inventory.reduce((acc, item) => {
    if (!acc[item.type]) acc[item.type] = [];
    acc[item.type].push(item);
    return acc;
  }, {} as Record<string, Item[]>);

  const getTypeIcon = (type: string) => {
    const icons: Record<string, string> = {
      weapon: 'fa-sword',
      armor: 'fa-shield',
      clothing: 'fa-shirt',
      tool: 'fa-wrench',
      consumable: 'fa-flask',
      misc: 'fa-box',
      container: 'fa-briefcase'
    };
    return icons[type] || 'fa-cube';
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      weapon: 'text-red-500',
      armor: 'text-blue-500',
      clothing: 'text-purple-500',
      tool: 'text-yellow-500',
      consumable: 'text-green-500',
      misc: 'text-slate-500',
      container: 'text-amber-500'
    };
    return colors[type] || 'text-slate-500';
  };

  const getQualityColor = (quality: number, maxQuality: number) => {
    const percentage = (quality / maxQuality) * 100;
    if (percentage >= 80) return 'text-green-500';
    if (percentage >= 50) return 'text-yellow-500';
    if (percentage >= 25) return 'text-orange-500';
    return 'text-red-500';
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl animate-in fade-in duration-300">
      <div className="w-full max-w-6xl max-h-[90vh] bg-slate-900 rounded-3xl border border-slate-800 overflow-hidden shadow-2xl flex flex-col">
        <div className="p-6 md:p-8 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
          <div>
            <h2 className="text-2xl font-header text-amber-500 tracking-widest uppercase">Backpack Ledger</h2>
            <div className="flex gap-4 mt-2 text-sm">
              <span className="text-slate-400">
                Items: <span className="text-amber-500 font-bold">{character.inventory.length}</span>
              </span>
              <span className="text-slate-400">
                Currency: <span className="text-amber-500 font-bold">{character.currency} Gold</span>
              </span>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white text-2xl w-10 h-10 flex items-center justify-center">
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 custom-scrollbar">
          {character.inventory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500">
              <i className="fas fa-box-open text-6xl mb-4 opacity-20"></i>
              <p className="text-lg font-header uppercase tracking-wider">Your backpack is empty</p>
              <p className="text-sm mt-2 opacity-60">Items you acquire will appear here</p>
            </div>
          ) : (
            <>
              {Object.entries(groupedInventory).map(([type, items]) => (
                <section key={type}>
                  <h3 className="text-xs font-header text-amber-500 uppercase tracking-[0.2em] mb-4 pb-2 border-b border-slate-800 flex items-center gap-3">
                    <i className={`fas ${getTypeIcon(type)} ${getTypeColor(type)}`}></i>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                    <span className="text-slate-600 text-[10px]">({items.length})</span>
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {items.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => setSelectedItem(item)}
                        className={`bg-slate-950/50 p-4 rounded-xl border cursor-pointer transition-all hover:border-amber-600 hover:bg-slate-900/50 ${
                          selectedItem?.id === item.id ? 'border-amber-600 bg-slate-900/50' : 'border-slate-800'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1">
                            <h4 className="text-sm font-bold text-slate-200">{item.name}</h4>
                            {item.slot && (
                              <p className="text-[10px] text-slate-500 uppercase tracking-wide mt-1">
                                {item.slot.replace('-', ' ')}
                              </p>
                            )}
                          </div>
                          <i className={`fas ${getTypeIcon(item.type)} ${getTypeColor(item.type)} text-lg`}></i>
                        </div>
                        
                        {item.stats && (
                          <div className="mb-2 space-y-1">
                            {item.stats.damage && (
                              <div className="text-xs text-red-400">
                                <i className="fas fa-sword mr-2"></i>Damage: {item.stats.damage}
                              </div>
                            )}
                            {item.stats.armorRating && (
                              <div className="text-xs text-blue-400">
                                <i className="fas fa-shield mr-2"></i>Armor: {item.stats.armorRating}
                              </div>
                            )}
                          </div>
                        )}

                        <div className="flex justify-between items-center text-[10px] text-slate-500 mt-3">
                          <span className={getQualityColor(item.quality, item.maxQuality)}>
                            Quality: {item.quality}/{item.maxQuality}
                          </span>
                          <span>{item.weight} lbs</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </>
          )}
        </div>

        {selectedItem && (
          <div className="border-t border-slate-800 bg-slate-950/80 p-6">
            <div className="max-w-3xl mx-auto">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-bold text-amber-500">{selectedItem.name}</h3>
                  <p className="text-sm text-slate-400 mt-1 capitalize">{selectedItem.type}</p>
                </div>
                <div className="text-right">
                  <div className="text-sm text-amber-500 font-bold">{selectedItem.value} Gold</div>
                  <div className="text-xs text-slate-500 mt-1">{selectedItem.weight} lbs</div>
                </div>
              </div>
              
              <p className="text-sm text-slate-300 leading-relaxed mb-4">{selectedItem.description}</p>
              
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="bg-slate-900/50 p-3 rounded-lg">
                  <div className="text-slate-500 uppercase tracking-wide mb-1">Quality</div>
                  <div className={`font-bold ${getQualityColor(selectedItem.quality, selectedItem.maxQuality)}`}>
                    {selectedItem.quality} / {selectedItem.maxQuality}
                  </div>
                </div>
                <div className="bg-slate-900/50 p-3 rounded-lg">
                  <div className="text-slate-500 uppercase tracking-wide mb-1">Durability</div>
                  <div className="font-bold text-slate-300">{selectedItem.durability}%</div>
                </div>
              </div>

              {selectedItem.isIrreparable && (
                <div className="mt-4 p-3 bg-red-950/20 border border-red-900/30 rounded-lg text-xs text-red-400 flex items-center gap-2">
                  <i className="fas fa-exclamation-triangle"></i>
                  <span>This item cannot be repaired</span>
                </div>
              )}
            </div>
          </div>
        )}

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

export default Inventory;
