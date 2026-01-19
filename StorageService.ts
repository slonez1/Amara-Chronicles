import { GameState } from './types';

const SAVE_KEY = 'amara_chronicle_v2';

const isStorageAvailable = () => {
  try {
    const test = '__storage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch (e) {
    return false;
  }
};

export const StorageService = {
  save: (state: GameState): void => {
    if (!isStorageAvailable()) return;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error("Failed to save state to local storage", e);
    }
  },

  load: (): GameState | null => {
    if (!isStorageAvailable()) return null;
    try {
      const data = localStorage.getItem(SAVE_KEY);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      console.error("Failed to load state from local storage", e);
      return null;
    }
  },

  clear: (): void => {
    if (!isStorageAvailable()) return;
    localStorage.removeItem(SAVE_KEY);
  },

  syncToCloud: async (state: GameState) => {
    console.log("Syncing to cloud mimic...", state);
  }
};