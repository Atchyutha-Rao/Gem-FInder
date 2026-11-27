/** Client state & persistence for Auth, Saved Trip, Weather Cache, and Language */

import { api } from './api.js';

const SAVED_KEY = 'untold_trails_saved_trip_v1';
const LANG_KEY = 'untold_trails_lang_v1';
const TOKEN_KEY = 'untold_trails_token_v1';
const USER_KEY = 'untold_trails_user_v1';
const THEME_KEY = 'untold_trails_theme_v1';

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

let weatherPromise = null;

export const store = {
  savedIds: Array.isArray(readJson(SAVED_KEY, [])) ? readJson(SAVED_KEY, []) : [],
  lang: localStorage.getItem(LANG_KEY) || 'en',
  theme: localStorage.getItem(THEME_KEY) || 'light',
  token: localStorage.getItem(TOKEN_KEY) || '',
  user: readJson(USER_KEY, null),
  weatherMap: {},
  listeners: new Set(),

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  },

  notify(reason = 'all') {
    for (const fn of this.listeners) fn(reason);
  },

  isLoggedIn() {
    return Boolean(this.token && this.user);
  },

  setAuth(token, user) {
    this.token = token;
    this.user = user;
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));

    const merged = Array.from(new Set([...(user.saved_ids || []), ...this.savedIds]));
    this.savedIds = merged;
    localStorage.setItem(SAVED_KEY, JSON.stringify(merged));
    api.syncSaved(merged).catch(() => {});
    this.notify('auth');
  },

  setUser(user) {
    this.user = user;
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    this.notify('auth');
  },

  logout() {
    this.token = '';
    this.user = null;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this.notify('auth');
  },

  async hydrateAuth() {
    if (!this.token) return;
    try {
      const { user } = await api.me();
      this.user = user;
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      const merged = Array.from(new Set([...(user.saved_ids || []), ...this.savedIds]));
      this.savedIds = merged;
      localStorage.setItem(SAVED_KEY, JSON.stringify(merged));
    } catch {
      this.token = '';
      this.user = null;
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    }
  },

  async loadAllWeather(force = false) {
    if (!force && Object.keys(this.weatherMap).length > 0) {
      return this.weatherMap;
    }
    if (!weatherPromise || force) {
      weatherPromise = api
        .getAllWeather()
        .then((res) => {
          this.weatherMap = res.weather || {};
          return this.weatherMap;
        })
        .catch(() => this.weatherMap)
        .finally(() => {
          weatherPromise = null;
        });
    }
    return weatherPromise;
  },

  isSaved(gemId) {
    return this.savedIds.includes(gemId);
  },

  toggleSaved(gemId) {
    if (this.isSaved(gemId)) {
      this.savedIds = this.savedIds.filter((id) => id !== gemId);
    } else {
      this.savedIds = [...this.savedIds, gemId];
    }
    localStorage.setItem(SAVED_KEY, JSON.stringify(this.savedIds));
    if (this.isLoggedIn()) {
      api.syncSaved(this.savedIds).catch(() => {});
    }
    this.notify('saved');
    return this.isSaved(gemId);
  },

  clearSaved() {
    this.savedIds = [];
    localStorage.setItem(SAVED_KEY, JSON.stringify([]));
    if (this.isLoggedIn()) {
      api.syncSaved([]).catch(() => {});
    }
    this.notify('saved');
  },

  setLang(lang) {
    this.lang = lang === 'te' ? 'te' : 'en';
    localStorage.setItem(LANG_KEY, this.lang);
    this.notify('lang');
  },

  setTheme(theme) {
    this.theme = theme === 'dark' ? 'dark' : 'light';
    localStorage.setItem(THEME_KEY, this.theme);
    document.documentElement.classList.toggle('dark', this.theme === 'dark');
  },
};

export function showToast(message, type = 'success') {
  const root = document.getElementById('toast-root');
  if (!root) return;
  const el = document.createElement('div');
  const bg =
    type === 'error'
      ? 'bg-red-700 text-white'
      : type === 'info'
        ? 'bg-espresso text-white'
        : 'bg-forest text-white';
  el.className = `${bg} px-4 py-3 rounded-xl shadow-lg text-sm font-medium pointer-events-auto transition-opacity duration-300 flex items-center gap-2 max-w-sm`;
  el.textContent = message;
  root.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(8px)';
    setTimeout(() => el.remove(), 300);
  }, 3200);
}
