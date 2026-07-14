import type { AppData, Settings } from "../engine/types";

export const STORAGE_KEY = "next-step:data:v1";

export type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export const defaultSettings: Settings = {
  textSize: "normal",
  highContrast: false,
  reducedMotion: false,
  sound: false,
  voiceMode: false,
  spokenPrompts: false,
  defaultTimerMinutes: 3,
  showAcknowledgements: true,
  debugMode: false,
  firstLaunchDemoSeen: false
};

export function createEmptyData(): AppData {
  return {
    version: 1,
    tasks: [],
    history: [],
    settings: defaultSettings
  };
}

export function loadAppData(storage: StorageLike = window.localStorage): AppData {
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return createEmptyData();
  try {
    return normaliseAppData(JSON.parse(raw));
  } catch {
    return createEmptyData();
  }
}

export function saveAppData(data: AppData, storage: StorageLike = window.localStorage) {
  storage.setItem(STORAGE_KEY, JSON.stringify(normaliseAppData(data)));
}

export function clearAppData(storage: StorageLike = window.localStorage) {
  storage.removeItem(STORAGE_KEY);
}

export function exportAppData(data: AppData) {
  return JSON.stringify(normaliseAppData(data), null, 2);
}

export function importAppData(raw: string): AppData {
  return normaliseAppData(JSON.parse(raw));
}

export function normaliseAppData(value: Partial<AppData>): AppData {
  return {
    version: 1,
    tasks: Array.isArray(value.tasks) ? value.tasks : [],
    history: Array.isArray(value.history) ? value.history : [],
    settings: {
      ...defaultSettings,
      ...(value.settings ?? {})
    },
    activeSession: value.activeSession
  };
}

export function createMemoryStorage(seed: Record<string, string> = {}): StorageLike {
  const values = { ...seed };
  return {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : null;
    },
    setItem(key, value) {
      values[key] = value;
    },
    removeItem(key) {
      delete values[key];
    }
  };
}
