/** Shared UI components, Auth Modal, Weather Cards, Leaflet Map, and Share Postcard */

import { api } from './api.js';
import { store, showToast } from './store.js';
import { gemSummary, localizeRegion, t } from './i18n.js';

export const CATEGORIES = [
  { id: 'all', label: 'All Places', label_te: 'అన్నీ', color: '#1C1917', bg: 'bg-espresso text-white' },
  { id: 'heritage', label: 'Heritage', label_te: 'చారిత్రక ఆలయాలు', color: '#A33822', bg: 'bg-amber-50 text-amber-900 border border-amber-200/80' },
  { id: 'nature', label: 'Nature', label_te: 'ప్రకృతి & జలపాతాలు', color: '#164A37', bg: 'bg-emerald-50 text-emerald-900 border border-emerald-200/80' },
  { id: 'food', label: 'Food', label_te: 'ప్రాంతీయ రుచులు', color: '#C84B31', bg: 'bg-orange-50 text-orange-900 border border-orange-200/80' },
  { id: 'culture', label: 'Culture', label_te: 'సంస్కృతి & హస్తకళలు', color: '#7C2D12', bg: 'bg-rose-50 text-rose-900 border border-rose-200/80' },
  { id: 'village', label: 'Villages', label_te: 'గ్రామీణ అతిథ్యం', color: '#21664D', bg: 'bg-teal-50 text-teal-900 border border-teal-200/80' },
];

export function getCategoryMeta(catId) {
  return CATEGORIES.find((c) => c.id === catId) || CATEGORIES[0];
}

export function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function userInitials(name = '') {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() || '')
      .join('') || 'UT'
  );
}

const NAV_ICONS = {
  '/': `<svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1h-5.5v-6h-5v6H4a1 1 0 01-1-1v-9.5z"/></svg>`,
  '/explore': `<svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/></svg>`,
  '/stays': `<svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>`,
  '/guides': `<svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>`,
  '/planner': `<svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>`,
  '/safety': `<svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>`,
  '/host': `<svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>`,
  '/submit': `<svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>`,
  '/admin': `<svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>`,
};

function getNavGroups() {
  return [
    {
      heading: 'Discover',
      items: [
        { path: '/', label: t('navHome') },
        { path: '/explore', label: t('navExplore') },
        { path: '/stays', label: t('navStays') },
        { path: '/guides', label: t('navGuides') },
      ],
    },
    {
      heading: 'Plan & Safety',
      items: [
        { path: '/planner', label: t('navPlanner') },
        { path: '/safety', label: t('navSafety') },
      ],
    },
    {
      heading: 'Community & Host',
      items: [
        { path: '/submit', label: t('navSubmit') },
        { path: '/host', label: t('navHost') },
        { path: '/admin', label: t('navAdmin') },
      ],
    },
  ];
}

function getPageTitle(currentPath) {
  const groups = getNavGroups();
  for (const g of groups) {
    for (const item of g.items) {
      if (currentPath === item.path || (item.path !== '/' && currentPath.startsWith(item.path))) {
        return item.label;
      }
    }
  }
  if (currentPath.startsWith('/gem/')) return t('navExplore');
  if (currentPath === '/profile' || currentPath === '/bookings') return t('navProfile');
  return 'Untold Trails';
}

export function renderSidebar(currentPath) {
  const groups = getNavGroups();
  const user = store.user;
  const savedCount = store.savedIds.length;

  return `
    <aside class="hidden lg:flex lg:flex-col lg:w-64 shrink-0 ut-sidebar sticky top-0 h-screen z-40">
      <div class="h-16 px-5 flex items-center gap-3 border-b border-[#E7E0D5]">
        <a href="#/" class="flex items-center gap-2.5 group min-w-0">
          <span class="w-9 h-9 rounded-xl bg-terracotta text-white flex items-center justify-center font-display font-bold text-base shadow-xs group-hover:bg-terracottaDark transition shrink-0">
            UT
          </span>
          <div class="min-w-0">
            <div class="font-display font-bold text-base leading-none text-espresso tracking-tight truncate">Untold Trails</div>
            <div class="text-[11px] text-muted mt-0.5 truncate">${esc(t('brandSubtitle'))}</div>
          </div>
        </a>
      </div>

      <div class="flex-1 overflow-y-auto px-3 py-4 space-y-5 hide-scrollbar">
        ${groups
          .map(
            (group) => `
            <div>
              <div class="px-3 mb-1.5 text-[11px] font-semibold text-muted/85">${esc(group.heading)}</div>
              <div class="space-y-0.5">
                ${group.items
                  .map((l) => {
                    const active = currentPath === l.path || (l.path !== '/' && currentPath.startsWith(l.path));
                    return `
                      <a href="#${l.path}"
                        class="ut-nav-item flex items-center justify-between gap-2.5 px-3 py-2 rounded-xl text-[13px] ${
                          active
                            ? 'bg-terracotta/10 text-terracotta font-semibold shadow-2xs'
                            : 'text-muted hover:text-espresso hover:bg-sand/60 font-medium'
                        }">
                        <span class="flex items-center gap-2.5 min-w-0">
                          ${NAV_ICONS[l.path] || ''}
                          <span class="truncate">${esc(l.label)}</span>
                        </span>
                        ${
                          l.path === '/planner' && savedCount > 0
                            ? `<span class="px-1.5 py-0.5 rounded-full bg-forest text-white text-[10px] font-bold leading-none">${savedCount}</span>`
                            : ''
                        }
                      </a>`;
                  })
                  .join('')}
              </div>
            </div>`
          )
          .join('')}
      </div>

      <div class="p-3 border-t border-[#E7E0D5] space-y-2.5">
        <a href="#/planner?tab=saved"
          class="flex items-center justify-between px-3 py-2 rounded-xl bg-sand/70 hover:bg-sand text-xs font-semibold text-espresso transition">
          <span class="flex items-center gap-2"><span>★</span><span>${esc(t('navSaved'))}</span></span>
          <span id="sidebar-saved-count" class="px-2 py-0.5 rounded-full bg-forest text-white text-[11px] font-bold leading-none">${savedCount}</span>
        </a>

        ${
          user
            ? `<a href="#/profile" class="flex items-center gap-2.5 p-2 rounded-xl hover:bg-sand/60 transition">
                <span class="w-8 h-8 rounded-full bg-forest text-white text-xs font-bold flex items-center justify-center shrink-0">
                  ${esc(userInitials(user.name))}
                </span>
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-1.5">
                    <span class="text-xs font-semibold text-espresso truncate">${esc(user.name)}</span>
                    <span class="px-1.5 py-0.5 rounded-md bg-terracotta/15 text-terracotta text-[9px] font-bold uppercase shrink-0">${esc(user.role || 'user')}</span>
                  </div>
                  <div class="text-[10px] text-muted truncate">${esc(user.email)}</div>
                </div>
              </a>`
            : `<div class="rounded-xl bg-cream border border-[#E7E0D5] p-3 text-center space-y-2">
                <div class="text-[11px] text-muted">${esc(t('authLoginSub'))}</div>
                <button type="button" id="sidebar-login-btn" class="w-full py-1.5 rounded-lg bg-espresso hover:bg-terracotta text-white text-xs font-semibold transition">
                  ${esc(t('navLogin'))}
                </button>
              </div>`
        }
      </div>
    </aside>
  `;
}

export function renderNavbar(currentPath) {
  const savedCount = store.savedIds.length;
  const links = [
    { path: '/', label: t('navHome') },
    { path: '/explore', label: t('navExplore') },
    { path: '/stays', label: t('navStays') },
    { path: '/guides', label: t('navGuides') },
    { path: '/planner', label: t('navPlanner') },
    { path: '/safety', label: t('navSafety') },
    { path: '/host', label: t('navHost') },
    { path: '/submit', label: t('navSubmit') },
    { path: '/admin', label: t('navAdmin') },
  ];

  const user = store.user;
  const pageTitle = getPageTitle(currentPath);
  const isDark = store.theme === 'dark';

  return `
    <header class="sticky top-0 z-40 ut-topbar">
      <div class="px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
        <div class="flex items-center gap-3 min-w-0">
          <button id="mobile-menu-btn" type="button" aria-label="Open menu"
            class="lg:hidden p-2 rounded-xl border border-[#E2D9CC] bg-white text-espresso hover:bg-sand transition shrink-0">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16"/>
            </svg>
          </button>

          <a href="#/" class="lg:hidden flex items-center gap-2 shrink-0">
            <span class="w-8 h-8 rounded-xl bg-terracotta text-white flex items-center justify-center font-display font-bold text-sm">UT</span>
          </a>

          <div class="hidden sm:flex items-center gap-2 min-w-0">
            <span class="text-xs text-muted hidden lg:inline">Untold Trails</span>
            <span class="text-xs text-muted hidden lg:inline">/</span>
            <h2 class="font-semibold text-sm text-espresso truncate">${esc(pageTitle)}</h2>
          </div>
        </div>

        <form id="topbar-search-form" class="hidden md:flex items-center flex-1 max-w-sm mx-2">
          <div class="relative w-full">
            <svg class="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-4.35-4.35M10.5 18a7.5 7.5 0 100-15 7.5 7.5 0 000 15z"/>
            </svg>
            <input id="topbar-search-input" type="text" placeholder="${esc(t('expSearchPlaceholder'))}"
              class="w-full pl-9 pr-3 py-1.5 rounded-xl bg-cream border border-[#E2D9CC] text-xs text-espresso focus:outline-none focus:border-terracotta transition" />
          </div>
        </form>

        <div class="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button id="global-theme-toggle" type="button" title="Toggle light/dark theme"
            class="p-2 rounded-xl border border-[#E2D9CC] bg-cream text-espresso hover:bg-sand transition">
            ${
              isDark
                ? `<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/></svg>`
                : `<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/></svg>`
            }
          </button>

          <button id="global-lang-toggle" type="button" title="${esc(t('langButtonTitle'))}"
            class="inline-flex items-center rounded-xl border border-[#E2D9CC] bg-cream p-0.5 text-[11px] font-semibold transition">
            <span class="px-2 py-1 rounded-lg ${store.lang === 'en' ? 'bg-espresso text-white' : 'text-muted'}">EN</span>
            <span class="px-2 py-1 rounded-lg font-telugu ${store.lang === 'te' ? 'bg-espresso text-white' : 'text-muted'}">తెలుగు</span>
          </button>

          <a href="#/planner?tab=saved"
            class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-[#E2D9CC] bg-white hover:bg-sand text-xs font-semibold text-espresso transition">
            <span class="hidden sm:inline">${esc(t('navSaved'))}</span>
            <span class="sm:hidden">★</span>
            <span id="nav-saved-count" class="px-1.5 py-0.5 rounded-full bg-forest text-white text-[11px] font-bold leading-none">${savedCount}</span>
          </a>

          <button id="nav-sos-btn" type="button" title="${esc(t('sosTitle'))}"
            class="ut-btn-interactive ut-sos-pulse inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-xs">
            <span class="w-2 h-2 rounded-full bg-white animate-pulse"></span>
            <span>${esc(t('navSos'))}</span>
          </button>

          ${user
      ? `<div class="hidden sm:flex items-center gap-1.5 pl-1">
                  <a href="#/profile" title="${esc(t('navProfile'))}"
                    class="inline-flex items-center gap-2 px-2.5 py-1 rounded-xl bg-sand/80 hover:bg-sand border border-[#E2D9CC] transition">
                    <span class="w-6 h-6 rounded-full bg-forest text-white text-[11px] font-bold flex items-center justify-center">
                      ${esc(userInitials(user.name))}
                    </span>
                    <span class="text-xs font-semibold text-espresso max-w-[90px] truncate">${esc(user.name.split(' ')[0])}</span>
                    <span class="px-1.5 py-0.5 rounded-md bg-terracotta/15 text-terracotta text-[9px] font-bold uppercase">${esc(user.role || 'user')}</span>
                  </a>
                  <button id="nav-logout-btn" type="button"
                    class="px-2 py-1.5 rounded-xl text-xs font-semibold text-muted hover:text-terracotta hover:bg-sand transition">
                    ${esc(t('navLogout'))}
                  </button>
                </div>`
      : `<div class="hidden sm:flex items-center gap-1.5">
                  <button id="nav-login-btn" type="button"
                    class="px-2.5 py-1.5 rounded-xl text-xs font-semibold text-espresso hover:bg-sand transition">
                    ${esc(t('navLogin'))}
                  </button>
                  <button id="nav-register-btn" type="button"
                    class="px-3 py-1.5 rounded-xl bg-espresso hover:bg-terracotta text-white text-xs font-semibold transition shadow-xs">
                    ${esc(t('navRegister'))}
                  </button>
                </div>`
    }
        </div>
      </div>

      <div id="mobile-drawer" class="hidden lg:hidden border-t border-[#E7E0D5] bg-white px-4 py-3 space-y-1">
        ${links
      .map((l) => {
        const active = currentPath === l.path;
        return `<a href="#${l.path}" class="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium ${active ? 'bg-terracotta text-white' : 'text-espresso hover:bg-sand'
          }">${NAV_ICONS[l.path] || ''}<span>${esc(l.label)}</span></a>`;
      })
      .join('')}
        <div class="pt-2 mt-2 border-t border-[#E7E0D5] flex gap-2">
          ${user
      ? `<a href="#/profile" class="flex-1 px-3 py-2 rounded-xl bg-sand text-xs font-semibold text-espresso text-center">${esc(t('navProfile'))}</a>
                 <button id="mobile-logout-btn" type="button" class="px-3 py-2 rounded-xl border border-[#E2D9CC] text-terracotta text-xs font-bold">${esc(t('navLogout'))}</button>`
      : `<button id="mobile-login-btn" type="button" class="flex-1 py-2 rounded-xl border border-[#E2D9CC] text-xs font-semibold">${esc(t('navLogin'))}</button>
                 <button id="mobile-register-btn" type="button" class="flex-1 py-2 rounded-xl bg-espresso text-white text-xs font-semibold">${esc(t('navRegister'))}</button>`
    }
        </div>
      </div>
    </header>
  `;
}

export function renderAnalyticsSuite({
  idPrefix = 'ut-an',
  title = 'Analytics Overview',
  subtitle = '',
  range = '30d',
  activeMetric = 'revenue',
  compare = true,
  focusLabel = '',
  metrics = [], // [{ id, label, value, displayValue, deltaPct, spark: number[], color }]
  ringCard = null, // { label, valueDisplay, ratio, subtext }
  chartSeries = { labels: [], cur: [], prev: [], unitPrefix: '' },
  funnel = [], // [{ label, value }]
  heatmap = [], // array of weeks, each week = array of 7 { count, label }
}) {
  const ranges = [
    { id: '7d', label: '7D' },
    { id: '30d', label: '30D' },
    { id: '90d', label: '90D' },
    { id: '1y', label: '12M' },
  ];

  function sparkSvg(vals = [], color = '#164A37') {
    if (!vals.length) return '';
    const max = Math.max(1, ...vals);
    const min = Math.min(0, ...vals);
    const span = Math.max(1, max - min);
    const w = 68;
    const h = 24;
    const pts = vals.map((v, i) => {
      const x = vals.length === 1 ? w / 2 : (i / (vals.length - 1)) * w;
      const y = h - 3 - ((v - min) / span) * (h - 6);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" class="shrink-0 overflow-visible">
      <polyline fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" points="${pts.join(' ')}" />
    </svg>`;
  }

  function ringSvg(ratio = 0.5) {
    const r = 17;
    const c = 2 * Math.PI * r;
    const clamped = Math.max(0, Math.min(1, ratio));
    const dash = clamped * c;
    return `<svg width="44" height="44" viewBox="0 0 44 44" class="shrink-0 -rotate-90">
      <circle cx="22" cy="22" r="${r}" fill="none" stroke="var(--ut-surface-alt)" stroke-width="4.5" />
      <circle cx="22" cy="22" r="${r}" fill="none" stroke="#164A37" stroke-width="4.5" stroke-linecap="round"
        stroke-dasharray="${dash.toFixed(1)} ${c.toFixed(1)}" />
    </svg>`;
  }

  // Main SVG Area Chart
  const curVals = chartSeries.cur || [];
  const prevVals = chartSeries.prev || [];
  const labels = chartSeries.labels || [];
  const maxY = Math.max(1, ...curVals, ...(compare ? prevVals : [0]));
  const W = 680;
  const H = 200;
  const padX = 10;
  const padY = 16;
  const toPt = (vals, idx) => {
    const x = vals.length <= 1 ? W / 2 : padX + (idx / (vals.length - 1)) * (W - padX * 2);
    const y = H - padY - (vals[idx] / maxY) * (H - padY * 2);
    return [x, y];
  };
  const curPts = curVals.map((_, i) => toPt(curVals, i));
  const prevPts = prevVals.map((_, i) => toPt(prevVals, i));
  const linePath = (pts) => (pts.length ? `M ${pts.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' L ')}` : '');
  const areaPath = (pts) =>
    pts.length
      ? `${linePath(pts)} L ${pts[pts.length - 1][0].toFixed(1)} ${H - padY} L ${pts[0][0].toFixed(1)} ${H - padY} Z`
      : '';

  const maxFunnel = Math.max(1, ...(funnel.map((f) => f.value) || [1]));
  const maxHeat = Math.max(1, ...heatmap.flat().map((c) => c.count || 0));

  return `
    <div id="${esc(idPrefix)}-suite" class="bg-white rounded-3xl border border-[#E7E0D5] shadow-xs overflow-hidden ut-fade-in">
      <!-- Top Analytics Header -->
      <div class="px-5 py-4 border-b border-[#EDE6DB] flex flex-wrap items-center justify-between gap-3">
        <div class="min-w-0">
          <div class="flex items-center gap-2">
            <h2 class="font-display font-bold text-lg text-espresso">${esc(title)}</h2>
            <span class="px-2 py-0.5 rounded-full bg-emerald-50 text-forest text-[10px] font-bold uppercase">Live</span>
          </div>
          ${subtitle ? `<p class="text-xs text-muted mt-0.5">${esc(subtitle)}</p>` : ''}
        </div>
        <div class="flex flex-wrap items-center gap-2">
          ${
            focusLabel
              ? `<button type="button" data-an-clear-focus="${esc(idPrefix)}"
                  class="px-3 py-1.5 rounded-full bg-terracotta/10 text-terracotta text-xs font-semibold hover:bg-terracotta/20 transition">
                  ${esc(focusLabel)} ✕
                </button>`
              : ''
          }
          <button type="button" data-an-compare="${esc(idPrefix)}"
            class="px-3 py-1.5 rounded-xl border text-xs font-semibold transition ${
              compare ? 'bg-espresso text-white border-espresso' : 'bg-cream text-muted border-[#E2D9CC]'
            }">
            Compare
          </button>
          <div class="inline-flex rounded-xl bg-sand p-1 text-xs font-semibold">
            ${ranges
              .map(
                (r) => `
                <button type="button" data-an-range="${r.id}" data-an-prefix="${esc(idPrefix)}"
                  class="px-2.5 py-1 rounded-lg transition ${
                    range === r.id ? 'bg-white text-espresso shadow-2xs' : 'text-muted hover:text-espresso'
                  }">
                  ${r.label}
                </button>`
              )
              .join('')}
          </div>
        </div>
      </div>

      <div class="p-5 space-y-5">
        <!-- Interactive KPI Cards -->
        <div class="grid grid-cols-2 lg:grid-cols-5 gap-3">
          ${metrics
            .map((m) => {
              const isAct = activeMetric === m.id;
              const pos = (m.deltaPct || 0) >= 0;
              return `
                <button type="button" data-an-metric="${esc(m.id)}" data-an-prefix="${esc(idPrefix)}"
                  class="ut-card-lift text-left rounded-2xl border p-4 transition ${
                    isAct
                      ? 'bg-emerald-50/60 border-forest ring-1 ring-forest/40'
                      : 'bg-cream/60 border-[#E7E0D5] hover:bg-white'
                  }">
                  <div class="flex items-center justify-between gap-2 text-[11px] font-semibold text-muted">
                    <span class="truncate">${esc(m.label)}</span>
                    <span class="px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                      pos ? 'bg-emerald-100 text-forest' : 'bg-red-100 text-red-700'
                    }">${pos ? '↑' : '↓'} ${Math.abs(Math.round(m.deltaPct || 0))}%</span>
                  </div>
                  <div class="mt-2 flex items-end justify-between gap-2">
                    <div class="font-display font-bold text-2xl text-espresso leading-none">${esc(m.displayValue)}</div>
                    ${sparkSvg(m.spark || [], m.color || '#164A37')}
                  </div>
                </button>`;
            })
            .join('')}
          ${
            ringCard
              ? `<div class="col-span-2 lg:col-span-1 rounded-2xl border border-[#E7E0D5] bg-cream/60 p-4 flex flex-col justify-between">
                  <div class="text-[11px] font-semibold text-muted">${esc(ringCard.label)}</div>
                  <div class="mt-1.5 flex items-center justify-between gap-2">
                    <div>
                      <div class="font-display font-bold text-2xl text-espresso leading-none">${esc(ringCard.valueDisplay)}</div>
                      <div class="text-[10px] text-muted mt-1">${esc(ringCard.subtext || '')}</div>
                    </div>
                    ${ringSvg(ringCard.ratio)}
                  </div>
                </div>`
              : ''
          }
        </div>

        <!-- Main Trend Chart + Funnel & Heatmap -->
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div class="lg:col-span-8 rounded-2xl border border-[#E7E0D5] bg-cream/50 p-4 space-y-2">
            <div class="flex items-center justify-between text-xs">
              <span class="font-bold text-espresso">${esc((metrics.find((m) => m.id === activeMetric) || {}).label || 'Trend')} (${esc(range.toUpperCase())})</span>
              <span id="${esc(idPrefix)}-scrub-readout" class="font-semibold text-forest">Hover chart to inspect</span>
            </div>
            <div class="relative w-full">
              <svg id="${esc(idPrefix)}-chart-svg" viewBox="0 0 ${W} ${H}" class="w-full h-48 overflow-visible select-none cursor-crosshair">
                <defs>
                  <linearGradient id="${esc(idPrefix)}-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#164A37" stop-opacity="0.28" />
                    <stop offset="100%" stop-color="#164A37" stop-opacity="0.01" />
                  </linearGradient>
                </defs>
                ${[0.25, 0.5, 0.75]
                  .map((r) => {
                    const gy = padY + r * (H - padY * 2);
                    return `<line x1="${padX}" y1="${gy}" x2="${W - padX}" y2="${gy}" stroke="var(--ut-border)" stroke-dasharray="3 3" />`;
                  })
                  .join('')}
                ${compare && prevPts.length ? `<path d="${linePath(prevPts)}" fill="none" stroke="#9CA3AF" stroke-width="1.6" stroke-dasharray="5 4" />` : ''}
                ${curPts.length ? `<path d="${areaPath(curPts)}" fill="url(#${esc(idPrefix)}-grad)" />` : ''}
                ${curPts.length ? `<path d="${linePath(curPts)}" fill="none" stroke="#164A37" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />` : ''}
                <line id="${esc(idPrefix)}-crosshair" x1="0" y1="${padY}" x2="0" y2="${H - padY}" stroke="#C84B31" stroke-width="1.2" stroke-dasharray="3 2" class="hidden" />
                <circle id="${esc(idPrefix)}-dot" cx="0" cy="0" r="4.5" fill="#C84B31" stroke="#FFFFFF" stroke-width="2" class="hidden" />
              </svg>
            </div>
            <div class="flex justify-between text-[10px] text-muted px-1">
              <span>${esc(labels[0] || '')}</span>
              <span>${esc(labels[Math.floor(labels.length / 2)] || '')}</span>
              <span>${esc(labels[labels.length - 1] || '')}</span>
            </div>
          </div>

          <div class="lg:col-span-4 space-y-4">
            <!-- Funnel -->
            <div class="rounded-2xl border border-[#E7E0D5] bg-cream/50 p-4 space-y-2.5">
              <div class="text-xs font-bold text-espresso">Conversion Funnel</div>
              ${funnel
                .map((f, idx) => {
                  const pctW = Math.max(6, Math.round((f.value / maxFunnel) * 100));
                  return `
                    <div class="space-y-1">
                      <div class="flex justify-between text-[11px]">
                        <span class="text-muted font-medium">${esc(f.label)}</span>
                        <strong class="text-espresso">${esc(f.value.toLocaleString())}</strong>
                      </div>
                      <div class="h-2 rounded-full bg-sand overflow-hidden">
                        <div class="h-full rounded-full ut-bar-grow ${idx === funnel.length - 1 ? 'bg-terracotta' : 'bg-forest'}" style="width:${pctW}%"></div>
                      </div>
                    </div>`;
                })
                .join('')}
            </div>

            <!-- Activity Heatmap -->
            <div class="rounded-2xl border border-[#E7E0D5] bg-cream/50 p-4 space-y-2">
              <div class="flex items-center justify-between text-xs">
                <span class="font-bold text-espresso">Activity Heatmap</span>
                <span class="text-[10px] text-muted">${heatmap.length} weeks</span>
              </div>
              <div class="flex gap-1 overflow-x-auto hide-scrollbar py-0.5">
                ${heatmap
                  .map(
                    (week) => `
                    <div class="flex flex-col gap-1 shrink-0">
                      ${week
                        .map((cell) => {
                          const intensity = cell.count > 0 ? Math.max(0.22, cell.count / maxHeat) : 0;
                          const bg = intensity > 0 ? `rgba(22, 74, 55, ${intensity.toFixed(2)})` : 'var(--ut-surface-alt)';
                          return `<span title="${esc(cell.label)}: ${cell.count}" class="w-2.5 h-2.5 rounded-[3px] block" style="background:${bg}"></span>`;
                        })
                        .join('')}
                    </div>`
                  )
                  .join('')}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function wireAnalyticsSuite({
  idPrefix = 'ut-an',
  chartSeries = { labels: [], cur: [], prev: [], unitPrefix: '' },
  onRangeChange,
  onMetricChange,
  onCompareToggle,
  onClearFocus,
}) {
  document.querySelectorAll(`[data-an-range][data-an-prefix="${idPrefix}"]`).forEach((btn) => {
    btn.addEventListener('click', () => onRangeChange && onRangeChange(btn.getAttribute('data-an-range')));
  });
  document.querySelectorAll(`[data-an-metric][data-an-prefix="${idPrefix}"]`).forEach((btn) => {
    btn.addEventListener('click', () => onMetricChange && onMetricChange(btn.getAttribute('data-an-metric')));
  });
  const cmpBtn = document.querySelector(`[data-an-compare="${idPrefix}"]`);
  if (cmpBtn) cmpBtn.addEventListener('click', () => onCompareToggle && onCompareToggle());
  const clrBtn = document.querySelector(`[data-an-clear-focus="${idPrefix}"]`);
  if (clrBtn) clrBtn.addEventListener('click', () => onClearFocus && onClearFocus());

  const svg = document.getElementById(`${idPrefix}-chart-svg`);
  const crosshair = document.getElementById(`${idPrefix}-crosshair`);
  const dot = document.getElementById(`${idPrefix}-dot`);
  const readout = document.getElementById(`${idPrefix}-scrub-readout`);
  const curVals = chartSeries.cur || [];
  const labels = chartSeries.labels || [];
  if (svg && curVals.length > 0) {
    const W = 680;
    const H = 200;
    const padX = 10;
    const padY = 16;
    const maxY = Math.max(1, ...curVals, ...(chartSeries.prev || [0]));
    svg.addEventListener('mousemove', (e) => {
      const rect = svg.getBoundingClientRect();
      const relX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const idx = Math.min(curVals.length - 1, Math.max(0, Math.round(relX * (curVals.length - 1))));
      const x = curVals.length <= 1 ? W / 2 : padX + (idx / (curVals.length - 1)) * (W - padX * 2);
      const y = H - padY - (curVals[idx] / maxY) * (H - padY * 2);
      if (crosshair) {
        crosshair.setAttribute('x1', x.toFixed(1));
        crosshair.setAttribute('x2', x.toFixed(1));
        crosshair.classList.remove('hidden');
      }
      if (dot) {
        dot.setAttribute('cx', x.toFixed(1));
        dot.setAttribute('cy', y.toFixed(1));
        dot.classList.remove('hidden');
      }
      if (readout) {
        const prefix = chartSeries.unitPrefix || '';
        readout.textContent = `${labels[idx] || ''}: ${prefix}${Math.round(curVals[idx]).toLocaleString()}`;
      }
    });
    svg.addEventListener('mouseleave', () => {
      if (crosshair) crosshair.classList.add('hidden');
      if (dot) dot.classList.add('hidden');
      if (readout) readout.textContent = 'Hover chart to inspect';
    });
  }
}

export function renderFooter() {
  return `
    <footer class="mt-16 border-t border-[#E7E0D5] bg-white">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 py-8 grid grid-cols-1 md:grid-cols-3 gap-8 text-sm">
        <div>
          <div class="flex items-center gap-2">
            <span class="w-7 h-7 rounded-lg bg-terracotta text-white flex items-center justify-center font-display font-bold text-xs">UT</span>
            <span class="font-display font-bold text-base text-espresso">Untold Trails</span>
          </div>
          <p class="mt-2.5 text-muted leading-relaxed text-xs">${esc(t('footerDesc'))}</p>
        </div>
        <div>
          <div class="text-xs font-bold uppercase tracking-wider text-muted mb-2.5">${esc(t('footerPlatform'))}</div>
          <div class="flex flex-wrap gap-x-4 gap-y-2 text-muted text-xs font-medium">
            <a href="#/explore" class="hover:text-terracotta transition">${esc(t('navExplore'))}</a>
            <a href="#/stays" class="hover:text-terracotta transition">${esc(t('navStays'))}</a>
            <a href="#/guides" class="hover:text-terracotta transition">${esc(t('navGuides'))}</a>
            <a href="#/planner" class="hover:text-terracotta transition">${esc(t('navPlanner'))}</a>
            <a href="#/safety" class="hover:text-terracotta transition">${esc(t('navSafety'))}</a>
            <a href="#/submit" class="hover:text-terracotta transition">${esc(t('navSubmit'))}</a>
            <a href="#/admin" class="hover:text-terracotta transition">${esc(t('navAdmin'))}</a>
          </div>
        </div>
        <div>
          <div class="text-xs font-bold uppercase tracking-wider text-muted mb-2.5">${esc(t('footerTransparency'))}</div>
          <p class="text-muted text-xs leading-relaxed">${esc(t('footerTransDesc'))}</p>
        </div>
      </div>
    </footer>
  `;
}

export function renderWeatherBadgeMarkup(weather) {
  if (!weather) {
    return `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/90 backdrop-blur-xs text-[11px] font-semibold text-muted shadow-xs">🌤️ ...</span>`;
  }
  const cur = weather.current || {};
  const temp =
    cur.temperature_c !== null && cur.temperature_c !== undefined
      ? `${Math.round(cur.temperature_c)}°C`
      : cur.temperature_range || 'Mild';
  const cond = store.lang === 'te' ? (cur.condition_te || cur.condition || '') : (cur.condition || '');
  const adv = store.lang === 'te' ? (cur.advice_te || cur.advice || '') : (cur.advice || '');
  return `
    <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/95 backdrop-blur-xs text-[11px] font-semibold text-espresso shadow-xs border border-white/60"
      title="${esc(cond)} — ${esc(adv)}">
      <span>${cur.icon || '🌤️'}</span>
      <span>${esc(temp)}</span>
    </span>`;
}

export function renderWeatherWidget(weather, { compact = false } = {}) {
  if (!weather) {
    if (compact) {
      return `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sand text-xs text-muted animate-pulse">🌤️ ${esc(t('weatherLoading'))}</span>`;
    }
    return `
      <div class="bg-white rounded-2xl border border-[#E7E0D5] p-5 shadow-2xs animate-pulse">
        <div class="h-4 w-32 bg-sand rounded mb-3"></div>
        <div class="h-9 w-24 bg-sand rounded mb-2"></div>
        <div class="h-3 w-full bg-sand rounded"></div>
      </div>`;
  }

  const cur = weather.current || {};
  const isTe = store.lang === 'te';
  const condText = isTe ? (cur.condition_te || cur.condition || 'Fair') : (cur.condition || 'Fair');
  const adviceText = isTe ? (cur.advice_te || cur.advice || '') : (cur.advice || '');
  const suggestions = weather.suggestions || [];
  const tempDisplay =
    cur.temperature_c !== null && cur.temperature_c !== undefined
      ? `${Math.round(cur.temperature_c)}°C`
      : cur.temperature_range || 'Mild';

  if (compact) {
    const topTip = suggestions[0];
    const tipText = topTip ? (isTe ? topTip.te : topTip.en) : '';
    return `
      <div class="flex flex-wrap items-center gap-1.5">
        <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-[#E2D9CC] bg-cream text-xs font-semibold text-espresso"
          title="${esc(adviceText)}">
          <span>${cur.icon || '🌤️'}</span>
          <span>${esc(tempDisplay)}</span>
          <span class="text-muted font-normal">• ${esc(condText)}</span>
        </span>
        ${topTip
        ? `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200/80 text-[11px] font-medium text-amber-900">
                <span>${topTip.icon || '✨'}</span>
                <span>${esc(tipText)}</span>
              </span>`
        : ''
      }
      </div>`;
  }

  const isLive = Boolean(weather.available);
  const daily = weather.daily || [];

  return `
    <div class="rounded-2xl border border-[#E7E0D5] bg-white p-5 shadow-xs ut-fade-in space-y-3.5">
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-2">
          <span class="text-xs font-bold uppercase tracking-wider text-forest">${esc(t('weatherAtPlace'))}</span>
          <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${isLive ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-amber-50 text-amber-800 border border-amber-200'
    }">
            <span class="w-1.5 h-1.5 rounded-full ${isLive ? 'bg-emerald-600' : 'bg-amber-600'}"></span>
            ${esc(isLive ? t('weatherLive') : t('weatherSeasonal'))}
          </span>
        </div>
        <span class="text-[11px] text-muted">${esc(weather.updated_at || '')}</span>
      </div>

      <div class="flex items-center justify-between gap-4">
        <div class="flex items-center gap-3.5">
          <div class="w-14 h-14 rounded-2xl bg-cream border border-[#E7E0D5] flex items-center justify-center text-3xl">
            ${cur.icon || '🌤️'}
          </div>
          <div>
            <div class="font-display font-bold text-3xl text-espresso leading-none">${esc(tempDisplay)}</div>
            <div class="text-sm font-semibold text-terracotta mt-1 ${isTe ? 'font-telugu' : ''}">${esc(condText)}</div>
          </div>
        </div>
        ${isLive
      ? `<div class="text-right text-xs text-muted space-y-0.5">
                <div>${esc(t('feelsLike'))} <strong class="text-espresso">${cur.apparent_c ?? '--'}°C</strong></div>
                <div>${esc(t('humidity'))} <strong class="text-espresso">${cur.humidity ?? '--'}%</strong></div>
                <div>${esc(t('wind'))} <strong class="text-espresso">${cur.wind_kmh ?? '--'} km/h</strong></div>
              </div>`
      : ''
    }
      </div>

      <p class="text-xs text-muted bg-cream border border-[#EDE6DB] rounded-xl px-3 py-2 leading-relaxed ${isTe ? 'font-telugu' : ''}">
        ${esc(adviceText)}
      </p>

      ${suggestions.length > 0
      ? `<div class="rounded-xl bg-amber-50/70 border border-amber-200/80 p-3">
              <div class="text-[11px] font-bold uppercase tracking-wider text-amber-900 mb-2">✨ ${esc(t('aiWeatherTitle'))}</div>
              <ul class="space-y-1.5">
                ${suggestions
        .map(
          (s) => `
                    <li class="flex items-start gap-2 text-xs text-espresso ${isTe ? 'font-telugu' : ''}">
                      <span class="shrink-0">${s.icon || '✨'}</span>
                      <span>${esc(isTe ? s.te : s.en)}</span>
                    </li>`
        )
        .join('')}
              </ul>
            </div>`
      : ''
    }

      ${daily.length > 0
      ? `<div class="pt-3 border-t border-[#EDE6DB] grid grid-cols-3 gap-2">
              ${daily
        .map(
          (d, idx) => `
                  <div class="rounded-xl bg-cream border border-[#EDE6DB] p-2.5 text-center">
                    <div class="text-[11px] font-semibold text-muted">${esc(idx === 0 ? t('today') : (isTe ? d.day_label_te || d.day_label : d.day_label))}</div>
                    <div class="text-xl my-0.5">${d.icon || '⛅'}</div>
                    <div class="text-xs font-bold text-espresso">${d.temp_max_c ?? '--'}° / ${d.temp_min_c ?? '--'}°</div>
                    <div class="text-[10px] text-forest font-semibold mt-0.5">${d.rain_chance ?? 0}% ${esc(t('rain'))}</div>
                  </div>`
        )
        .join('')}
            </div>`
      : ''
    }
    </div>
  `;
}

export async function hydrateCardWeather(container) {
  const weatherMap = await store.loadAllWeather();
  if (!container) return;
  container.querySelectorAll('[data-gem-weather]').forEach((slot) => {
    const id = slot.getAttribute('data-gem-weather');
    if (weatherMap[id]) {
      slot.innerHTML = renderWeatherBadgeMarkup(weatherMap[id]);
    }
  });
}

export function renderGemCard(gem, options = {}) {
  const cat = getCategoryMeta(gem.category);
  const catLabel = store.lang === 'te' ? cat.label_te : cat.label;
  const displayName = store.lang === 'te' && gem.name_te ? gem.name_te : gem.name;
  const saved = store.isSaved(gem.id);
  const imgUrl = (gem.images && gem.images[0]) || `/img/${gem.id}_1.svg`;
  const fallbackImg = `/img/${gem.id}_1.svg`;
  const weather = store.weatherMap[gem.id] || null;
  const distanceBadge =
    options.distanceKm !== undefined
      ? `<span class="text-[11px] font-semibold text-forest bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">${options.distanceKm} ${esc(t('away'))}</span>`
      : '';

  return `
    <article data-gem-card="${esc(gem.id)}"
      class="ut-card-lift group bg-white rounded-2xl border border-[#E7E0D5] overflow-hidden flex flex-col h-full hover:ring-1 hover:ring-terracotta/30">
      <div class="relative aspect-[16/10] bg-sand overflow-hidden shrink-0">
        <a href="#/gem/${esc(gem.id)}" class="block w-full h-full">
          <img src="${esc(imgUrl)}" alt="${esc(displayName)}" loading="lazy"
            onerror="this.onerror=null;this.src='${esc(fallbackImg)}'"
            class="w-full h-full object-cover group-hover:scale-[1.06] transition-transform duration-500 ease-out" />
          <div class="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/55 to-transparent pointer-events-none"></div>
        </a>

        <div class="absolute top-3 left-3">
          <span class="px-2.5 py-1 rounded-full text-[11px] font-semibold ${cat.bg} shadow-xs backdrop-blur-xs">
            ${esc(catLabel)}
          </span>
        </div>

        <div data-gem-weather="${esc(gem.id)}" class="absolute top-3 right-3">
          ${renderWeatherBadgeMarkup(weather)}
        </div>

        <button type="button" data-save-gem="${esc(gem.id)}"
          title="${saved ? 'Remove from My Trip' : 'Save to My Trip'}"
          class="ut-btn-interactive absolute bottom-2.5 right-3 w-8 h-8 rounded-full flex items-center justify-center text-sm shadow-sm ${saved
      ? 'bg-terracotta text-white'
      : 'bg-white/95 text-espresso hover:bg-terracotta hover:text-white'
    }">
          ${saved ? '★' : '☆'}
        </button>
      </div>

      <div class="p-4 flex-1 flex flex-col">
        <div class="flex items-center justify-between gap-2 text-[11px]">
          <span class="font-semibold text-terracotta truncate">${esc(localizeRegion(gem.region))}</span>
          ${gem.status === 'verified'
      ? `<span class="text-forest font-semibold shrink-0">${esc(t('verified'))}</span>`
      : `<span class="text-amber-700 font-semibold shrink-0">${esc(t('pending'))}</span>`
    }
        </div>

        <h3 class="font-display font-bold text-lg text-espresso leading-snug mt-1 line-clamp-1 ${store.lang === 'te' ? 'font-telugu' : ''}">
          <a href="#/gem/${esc(gem.id)}" class="hover:text-terracotta transition">${esc(displayName)}</a>
        </h3>

        <p class="mt-1.5 text-sm text-muted line-clamp-2 flex-1 leading-relaxed min-h-[2.6rem] ${store.lang === 'te' ? 'font-telugu' : ''}">${esc(gemSummary(gem))}</p>

        <div class="mt-4 pt-3 border-t border-[#F0EAE0] flex items-center justify-between text-xs text-muted">
          <div class="flex items-center gap-2">
            <span class="font-semibold text-espresso">₹${esc(gem.budget_per_day)}${esc(t('perDay'))}</span>
            <span>•</span>
            <span>${esc(gem.duration_hours)} ${esc(t('hrs'))}</span>
            ${gem.crowd_level
      ? `<span class="hidden sm:inline">•</span><span class="hidden sm:inline text-forest font-medium">${esc(gem.crowd_level)}</span>`
      : ''
    }
          </div>
          ${distanceBadge || `<a href="#/gem/${esc(gem.id)}" class="font-semibold text-espresso group-hover:text-terracotta group-hover:translate-x-0.5 transition">${esc(t('exploreArrow'))}</a>`}
        </div>
      </div>
    </article>
  `;
}

export function renderStayCard(stay) {
  const displayName = store.lang === 'te' && stay.name_te ? stay.name_te : stay.name;
  const fallbackImg = stay.fallback_image || `/img/${stay.id}.svg`;
  return `
    <article class="ut-card-lift group bg-white rounded-2xl border border-[#E7E0D5] overflow-hidden flex flex-col h-full hover:ring-1 hover:ring-terracotta/30">
      <a href="#/stays/${esc(stay.id)}" class="relative block aspect-[16/10] bg-sand overflow-hidden shrink-0">
        <img src="${esc(stay.image || fallbackImg)}" alt="${esc(displayName)}" loading="lazy"
          onerror="this.onerror=null;this.src='${esc(fallbackImg)}'"
          class="w-full h-full object-cover group-hover:scale-[1.06] transition-transform duration-500 ease-out" />
        <div class="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/45 to-transparent pointer-events-none"></div>
        <div class="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-forest text-white text-[11px] font-semibold shadow-xs">
          ✓ ${esc(t('trustScore'))}: ${esc(stay.trust_score || 95)}/100
        </div>
        <div class="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-white/95 text-espresso text-[11px] font-bold shadow-xs">
          ★ ${esc(stay.rating || 4.8)}
        </div>
      </a>
      <div class="p-4 flex-1 flex flex-col">
        <div class="text-[11px] font-semibold text-terracotta truncate">${esc(localizeRegion(stay.region))}</div>
        <h3 class="font-display font-bold text-lg text-espresso leading-snug mt-1 line-clamp-1 ${store.lang === 'te' ? 'font-telugu' : ''}">
          <a href="#/stays/${esc(stay.id)}" class="hover:text-terracotta transition">${esc(displayName)}</a>
        </h3>
        <p class="mt-1.5 text-sm text-muted line-clamp-2 flex-1 min-h-[2.6rem]">${esc(stay.summary)}</p>
        <div class="mt-3 flex flex-wrap gap-1 min-h-[1.5rem]">
          ${(stay.amenities || []).slice(0, 3).map((a) => `<span class="px-2 py-0.5 rounded-full bg-sand text-[10px] font-semibold text-espresso">${esc(a)}</span>`).join('')}
        </div>
        <div class="mt-4 pt-3 border-t border-[#F0EAE0] flex items-center justify-between text-xs">
          <span class="font-bold text-espresso">₹${esc(stay.price_per_night)}<span class="font-normal text-muted">${esc(t('perNight'))}</span></span>
          <a href="#/stays/${esc(stay.id)}" class="font-semibold text-terracotta group-hover:translate-x-0.5 transition hover:underline">${esc(t('bookDirectBtn'))}</a>
        </div>
      </div>
    </article>
  `;
}

export function downloadOfflineTextPack(filename, textContent) {
  const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function attachSaveButtons(container, onChange) {
  container.querySelectorAll('[data-save-gem]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const id = btn.getAttribute('data-save-gem');
      const nowSaved = store.toggleSaved(id);
      btn.textContent = nowSaved ? '★' : '☆';
      btn.title = nowSaved ? 'Remove from My Trip' : 'Save to My Trip';
      btn.className = `absolute bottom-2.5 right-3 w-8 h-8 rounded-full flex items-center justify-center text-sm transition shadow-sm ${nowSaved
          ? 'bg-terracotta text-white'
          : 'bg-white/95 text-espresso hover:bg-terracotta hover:text-white'
        }`;
      showToast(nowSaved ? 'Saved to My Trip' : 'Removed from My Trip', 'info');
      if (onChange) onChange(id, nowSaved);
    });
  });
}

/**
 * Clean Auth Modal (Log In / Create Account) usable from any page.
 */
export function openAuthModal(initialMode = 'login', initialRole = 'user') {
  const mode = initialMode === 'register' ? 'register' : 'login';
  const roleParam = ['user', 'host', 'admin'].includes(initialRole) ? `?role=${initialRole}` : '';
  window.location.hash = `#/${mode}${roleParam}`;
}

export function renderAuthPage(root, initialMode = 'login', queryParams = new URLSearchParams()) {
  let mode = initialMode === 'register' ? 'register' : 'login';
  const qRole = queryParams.get('role');
  const qEmail = (queryParams.get('email') || '').trim();
  let role = ['user', 'host', 'admin'].includes(qRole) ? qRole : 'user';
  let showPassword = false;
  let forgotOpen = false;

  const roleOptions = [
    { id: 'user', label: 'Traveller', icon: '🧳' },
    { id: 'host', label: 'Host', icon: '🏡' },
    { id: 'admin', label: 'Admin', icon: '🛡️' },
  ];

  function routeByRole(userRole) {
    if (userRole === 'host') {
      window.location.hash = '#/host-dashboard';
    } else if (userRole === 'admin') {
      window.location.hash = '#/admin';
    } else {
      window.location.hash = '#/traveller-dashboard';
    }
  }

  function draw() {
    root.innerHTML = `
      <section class="min-h-screen w-full relative flex items-center justify-center p-4 sm:p-6 overflow-hidden ut-fade-in"
        style="background: linear-gradient(160deg, rgba(14, 46, 33, 0.86) 0%, rgba(22, 74, 55, 0.82) 50%, rgba(15, 28, 22, 0.92) 100%), url('https://images.unsplash.com/photo-1448375240586-882707db888b?w=1600&q=80&auto=format&fit=crop') center/cover no-repeat;">

        <div class="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-emerald-400/20 blur-3xl ut-float-slow pointer-events-none"></div>
        <div class="absolute -bottom-24 -right-24 w-80 h-80 rounded-full bg-teal-300/15 blur-3xl ut-float-slow pointer-events-none"></div>

        <div class="relative z-10 w-full max-w-md space-y-5">
          <!-- Brand Header -->
          <div class="text-center text-white space-y-2">
            <a href="#/" class="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-[#1B5E43] to-[#2E8563] text-white font-display font-bold text-lg shadow-lg border border-white/20">
              UT
            </a>
            <h1 class="font-display font-bold text-2xl sm:text-3xl tracking-tight">Untold Trails</h1>
            <p class="text-xs sm:text-sm text-emerald-100/85">${esc(t('brandSubtitle'))}</p>
          </div>

          <!-- White Rounded Auth Card -->
          <div class="bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-white/40 ut-modal-enter space-y-5 text-[#18181B]">
            <!-- Login / Sign Up Toggle -->
            <div class="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-[#F2EFE9] text-xs sm:text-sm font-semibold">
              <button type="button" data-auth-tab="login"
                class="ut-btn-interactive py-2.5 rounded-xl transition ${
                  mode === 'login'
                    ? 'bg-gradient-to-r from-[#164A37] to-[#21664D] text-white shadow-sm'
                    : 'text-[#64625D] hover:text-[#18181B]'
                }">
                ${esc(t('authLoginBtn'))}
              </button>
              <button type="button" data-auth-tab="register"
                class="ut-btn-interactive py-2.5 rounded-xl transition ${
                  mode === 'register'
                    ? 'bg-gradient-to-r from-[#164A37] to-[#21664D] text-white shadow-sm'
                    : 'text-[#64625D] hover:text-[#18181B]'
                }">
                Sign Up
              </button>
            </div>

            <!-- Role Selector (Traveller / Host / Admin) -->
            <div>
              <div class="text-[11px] font-bold uppercase tracking-wider text-[#64625D] mb-2">${esc(t('authRoleLabel'))}</div>
              <div class="grid grid-cols-3 gap-2">
                ${roleOptions
                  .map(
                    (r) => `
                    <button type="button" data-auth-role="${r.id}"
                      class="ut-btn-interactive flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl border text-xs font-semibold ${
                        role === r.id
                          ? 'bg-emerald-50 text-[#164A37] border-[#164A37] ring-1 ring-[#164A37]'
                          : 'bg-[#FAF9F6] text-[#64625D] border-[#E5E0D7] hover:bg-[#F2EFE9]'
                      }">
                      <span>${r.icon}</span>
                      <span>${esc(r.label)}</span>
                    </button>`
                  )
                  .join('')}
              </div>
            </div>

            <div id="auth-page-err" class="hidden px-3.5 py-2.5 rounded-xl bg-red-50 border border-red-200 text-xs font-medium text-red-700"></div>

            ${
              forgotOpen
                ? `<div class="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 space-y-2.5 text-xs">
                    <div class="font-bold text-[#164A37]">Reset Password</div>
                    <p class="text-[#18181B]/80 leading-relaxed">
                      Enter your registered email below. If you forgot your local demo password, you can create a new account or contact your Untold Trails host/admin.
                    </p>
                    <button type="button" id="close-forgot-box" class="font-semibold text-[#164A37] hover:underline">← Back to Sign In</button>
                  </div>`
                : ''
            }

            <form id="auth-page-form" class="space-y-3.5">
              ${
                mode === 'register'
                  ? `<div>
                      <label class="block text-xs font-semibold text-[#18181B] mb-1">${esc(t('authFullName'))}</label>
                      <input name="name" required placeholder="e.g., Ananya Rao"
                        class="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF9F6] border border-[#E2D9CC] text-sm text-[#18181B] focus:outline-none focus:ring-2 focus:ring-[#164A37]/25 focus:border-[#164A37] transition" />
                    </div>`
                  : ''
              }
              <div>
                <label class="block text-xs font-semibold text-[#18181B] mb-1">${esc(t('authEmail'))}</label>
                <input name="email" type="email" required value="${esc(qEmail)}" placeholder="you@example.com"
                  class="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF9F6] border border-[#E2D9CC] text-sm text-[#18181B] focus:outline-none focus:ring-2 focus:ring-[#164A37]/25 focus:border-[#164A37] transition" />
              </div>
              <div>
                <div class="flex items-center justify-between mb-1">
                  <label class="block text-xs font-semibold text-[#18181B]">${esc(t('authPassword'))}</label>
                  ${
                    mode === 'login'
                      ? `<button type="button" id="forgot-pass-btn" class="text-[11px] font-semibold text-[#164A37] hover:underline">Forgot Password?</button>`
                      : ''
                  }
                </div>
                <div class="relative">
                  <input id="auth-pass-input" name="password" type="${showPassword ? 'text' : 'password'}" required minlength="6"
                    placeholder="${esc(mode === 'register' ? t('authPassPlaceholderReg') : t('authPassPlaceholderLogin'))}"
                    class="w-full px-3.5 py-2.5 pr-16 rounded-xl bg-[#FAF9F6] border border-[#E2D9CC] text-sm text-[#18181B] focus:outline-none focus:ring-2 focus:ring-[#164A37]/25 focus:border-[#164A37] transition" />
                  <button type="button" id="toggle-auth-pass"
                    class="absolute right-2.5 top-1/2 -translate-y-1/2 px-2 py-1 rounded-lg text-[11px] font-semibold text-[#64625D] hover:text-[#18181B] hover:bg-[#EFECE6] transition">
                    ${showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              <button id="auth-page-submit" type="submit"
                class="ut-btn-interactive w-full py-3 rounded-xl bg-gradient-to-r from-[#164A37] to-[#21664D] hover:from-[#123D2D] hover:to-[#1B5741] text-white text-sm font-semibold shadow-md">
                ${esc(mode === 'login' ? t('authLoginBtn') : 'Create Account')} as ${esc((roleOptions.find((r) => r.id === role) || roleOptions[0]).label)}
              </button>
            </form>

            <div class="relative flex items-center py-1">
              <div class="flex-grow border-t border-[#E5E0D7]"></div>
              <span class="shrink mx-3 text-[11px] font-medium text-[#64625D] uppercase">or</span>
              <div class="flex-grow border-t border-[#E5E0D7]"></div>
            </div>

            <button id="google-signin-btn" type="button"
              class="ut-btn-interactive w-full py-2.5 px-4 rounded-xl bg-white border border-[#E2D9CC] hover:bg-[#FAF9F6] text-sm font-semibold text-[#18181B] flex items-center justify-center gap-2.5 shadow-2xs">
              <svg class="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"/>
                <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24z"/>
                <path fill="#FBBC05" d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14z"/>
                <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96z"/>
              </svg>
              <span>Continue with Google</span>
            </button>

            <div class="text-center pt-1">
              <a href="#/" class="text-xs font-semibold text-[#64625D] hover:text-[#164A37] transition">← Back to Explore Untold Trails</a>
            </div>
          </div>
        </div>
      </section>
    `;

    root.querySelectorAll('[data-auth-tab]').forEach((b) => {
      b.addEventListener('click', () => {
        const nextMode = b.getAttribute('data-auth-tab');
        window.location.hash = `#/${nextMode}?role=${role}`;
      });
    });

    root.querySelectorAll('[data-auth-role]').forEach((b) => {
      b.addEventListener('click', () => {
        role = b.getAttribute('data-auth-role');
        draw();
      });
    });

    const passToggle = document.getElementById('toggle-auth-pass');
    if (passToggle) {
      passToggle.addEventListener('click', () => {
        showPassword = !showPassword;
        const inp = document.getElementById('auth-pass-input');
        if (inp) inp.type = showPassword ? 'text' : 'password';
        passToggle.textContent = showPassword ? 'Hide' : 'Show';
      });
    }

    const forgotBtn = document.getElementById('forgot-pass-btn');
    if (forgotBtn) {
      forgotBtn.addEventListener('click', () => {
        forgotOpen = true;
        draw();
      });
    }

    const closeForgot = document.getElementById('close-forgot-box');
    if (closeForgot) {
      closeForgot.addEventListener('click', () => {
        forgotOpen = false;
        draw();
      });
    }

    const googleBtn = document.getElementById('google-signin-btn');
    if (googleBtn) {
      googleBtn.addEventListener('click', async () => {
        const errBox = document.getElementById('auth-page-err');
        errBox.classList.add('hidden');
        try {
          const cfg = await api.googleConfig();
          if (!cfg.enabled || !cfg.client_id) {
            errBox.textContent = 'Google Sign-In requires GOOGLE_CLIENT_ID in your server .env file.';
            errBox.classList.remove('hidden');
            return;
          }
          const loadGsi = () =>
            new Promise((resolve, reject) => {
              if (window.google && window.google.accounts && window.google.accounts.id) {
                resolve();
                return;
              }
              const s = document.createElement('script');
              s.src = 'https://accounts.google.com/gsi/client';
              s.async = true;
              s.onload = () => resolve();
              s.onerror = () => reject(new Error('Could not load Google Sign-In script.'));
              document.head.appendChild(s);
            });
          await loadGsi();
          window.google.accounts.id.initialize({
            client_id: cfg.client_id,
            callback: async (response) => {
              try {
                const res = await api.googleAuth({ credential: response.credential, role });
                store.setAuth(res.token, res.user);
                showToast(`Welcome, ${res.user.name}!`);
                routeByRole(res.user.role || role);
              } catch (gErr) {
                errBox.textContent = gErr.message;
                errBox.classList.remove('hidden');
              }
            },
          });
          window.google.accounts.id.prompt();
        } catch (err) {
          errBox.textContent = err.message;
          errBox.classList.remove('hidden');
        }
      });
    }

    document.getElementById('auth-page-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const errBox = document.getElementById('auth-page-err');
      const btn = document.getElementById('auth-page-submit');
      errBox.classList.add('hidden');
      btn.disabled = true;
      btn.textContent = mode === 'login' ? t('authLoggingIn') : t('authCreating');

      try {
        const res =
          mode === 'register'
            ? await api.register({
                name: fd.get('name'),
                email: fd.get('email'),
                password: fd.get('password'),
                role,
                saved_ids: store.savedIds,
              })
            : await api.login({
                email: fd.get('email'),
                password: fd.get('password'),
                role,
              });
        if (res.requires_verification) {
          showToast(res.message || 'Verification OTP sent to your email.');
          window.location.hash = `#/verify-email?email=${encodeURIComponent(res.email || fd.get('email'))}`;
          return;
        }
        store.setAuth(res.token, res.user);
        showToast(mode === 'register' ? `Welcome, ${res.user.name}!` : `Welcome back, ${res.user.name}!`);
        routeByRole(res.user.role || role);
      } catch (err) {
        const emailVal = String(fd.get('email') || '').trim();
        if (err.message && err.message.toLowerCase().includes('not verified') && emailVal) {
          errBox.innerHTML = `${esc(err.message)} <a href="#/verify-email?email=${encodeURIComponent(emailVal)}" class="underline font-bold ml-1">Verify Email →</a>`;
        } else {
          errBox.textContent = err.message;
        }
        errBox.classList.remove('hidden');
        btn.disabled = false;
        btn.textContent = `${mode === 'login' ? t('authLoginBtn') : 'Create Account'} as ${(roleOptions.find((r) => r.id === role) || roleOptions[0]).label}`;
      }
    });
  }

  draw();
}

export function renderVerifyEmailPage(root, queryParams = new URLSearchParams()) {
  let email = (queryParams.get('email') || '').trim();
  let cooldown = 60;
  let timerId = null;

  function startCooldown(seconds = 60) {
    cooldown = seconds;
    if (timerId) clearInterval(timerId);
    const updateBtn = () => {
      const btn = document.getElementById('resend-otp-btn');
      if (!btn) {
        clearInterval(timerId);
        return;
      }
      if (cooldown > 0) {
        btn.disabled = true;
        btn.textContent = `Resend OTP in ${cooldown}s`;
      } else {
        btn.disabled = false;
        btn.textContent = 'Resend OTP';
        clearInterval(timerId);
      }
    };
    updateBtn();
    timerId = setInterval(() => {
      cooldown = Math.max(0, cooldown - 1);
      updateBtn();
    }, 1000);
  }

  root.innerHTML = `
    <section class="min-h-screen w-full relative flex items-center justify-center p-4 sm:p-6 overflow-hidden ut-fade-in"
      style="background: linear-gradient(160deg, rgba(14, 46, 33, 0.86) 0%, rgba(22, 74, 55, 0.82) 50%, rgba(15, 28, 22, 0.92) 100%), url('https://images.unsplash.com/photo-1448375240586-882707db888b?w=1600&q=80&auto=format&fit=crop') center/cover no-repeat;">
      <div class="relative z-10 w-full max-w-md space-y-5">
        <div class="text-center text-white space-y-2">
          <a href="#/" class="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-[#1B5E43] to-[#2E8563] text-white font-display font-bold text-lg shadow-lg border border-white/20">
            UT
          </a>
          <h1 class="font-display font-bold text-2xl sm:text-3xl tracking-tight">Verify Your Email</h1>
          <p class="text-xs sm:text-sm text-emerald-100/85">Enter the 6-digit code sent to your inbox</p>
        </div>

        <div class="bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-white/40 ut-modal-enter space-y-5 text-[#18181B]">
          <div class="rounded-2xl bg-emerald-50 border border-emerald-200 p-3.5 text-xs text-[#164A37] space-y-1">
            <div class="font-bold uppercase tracking-wider text-[10px]">Registered Email</div>
            <div class="font-semibold text-sm break-all">${esc(email || 'Enter your email below')}</div>
            <div class="text-[11px] text-[#164A37]/80">The OTP expires in 5 minutes.</div>
          </div>

          <div id="verify-err-box" class="hidden px-3.5 py-2.5 rounded-xl bg-red-50 border border-red-200 text-xs font-medium text-red-700"></div>
          <div id="verify-ok-box" class="hidden px-3.5 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-medium text-[#164A37]"></div>

          <form id="verify-otp-form" class="space-y-4">
            ${
              email
                ? `<input type="hidden" name="email" value="${esc(email)}" />`
                : `<div>
                    <label class="block text-xs font-semibold text-[#18181B] mb-1">${esc(t('authEmail'))}</label>
                    <input id="verify-email-input" name="email" type="email" required placeholder="you@example.com"
                      class="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF9F6] border border-[#E2D9CC] text-sm text-[#18181B] focus:outline-none focus:ring-2 focus:ring-[#164A37]/25 focus:border-[#164A37]" />
                  </div>`
            }
            <div>
              <label class="block text-xs font-semibold text-[#18181B] mb-1">6-Digit OTP Code</label>
              <input id="verify-otp-input" name="otp" type="text" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" minlength="6" required
                placeholder="123456"
                class="w-full px-4 py-3 rounded-xl bg-[#FAF9F6] border border-[#E2D9CC] text-center text-2xl font-bold tracking-[0.5em] text-[#18181B] focus:outline-none focus:ring-2 focus:ring-[#164A37]/25 focus:border-[#164A37]" />
            </div>

            <button id="verify-otp-submit" type="submit"
              class="ut-btn-interactive w-full py-3 rounded-xl bg-gradient-to-r from-[#164A37] to-[#21664D] hover:from-[#123D2D] hover:to-[#1B5741] text-white text-sm font-semibold shadow-md">
              Verify Email
            </button>
          </form>

          <div class="flex items-center justify-between pt-2 border-t border-[#E5E0D7] text-xs">
            <button id="resend-otp-btn" type="button"
              class="font-semibold text-[#164A37] hover:underline disabled:opacity-50 disabled:no-underline">
              Resend OTP in 60s
            </button>
            <a href="#/login" class="font-semibold text-[#64625D] hover:text-[#18181B]">← Back to Login</a>
          </div>
        </div>
      </div>
    </section>
  `;

  if (email) {
    startCooldown(60);
  } else {
    const resendBtn = document.getElementById('resend-otp-btn');
    if (resendBtn) resendBtn.textContent = 'Resend OTP';
  }

  document.getElementById('verify-otp-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const targetEmail = String(fd.get('email') || email).trim();
    const otp = String(fd.get('otp') || '').trim();
    const errBox = document.getElementById('verify-err-box');
    const okBox = document.getElementById('verify-ok-box');
    const btn = document.getElementById('verify-otp-submit');

    errBox.classList.add('hidden');
    okBox.classList.add('hidden');
    btn.disabled = true;
    btn.textContent = 'Verifying...';

    try {
      const res = await api.verifyOtp({ email: targetEmail, otp });
      okBox.textContent = res.message || 'Email verified! Redirecting to login...';
      okBox.classList.remove('hidden');
      showToast(res.message || 'Email verified successfully!');
      if (timerId) clearInterval(timerId);
      setTimeout(() => {
        window.location.hash = `#/login?email=${encodeURIComponent(targetEmail)}&role=${encodeURIComponent(res.role || 'user')}`;
      }, 900);
    } catch (err) {
      errBox.textContent = err.message;
      errBox.classList.remove('hidden');
      btn.disabled = false;
      btn.textContent = 'Verify Email';
    }
  });

  document.getElementById('resend-otp-btn').addEventListener('click', async () => {
    const emailInput = document.getElementById('verify-email-input');
    const targetEmail = emailInput ? emailInput.value.trim() : email;
    const errBox = document.getElementById('verify-err-box');
    const okBox = document.getElementById('verify-ok-box');
    errBox.classList.add('hidden');
    okBox.classList.add('hidden');

    if (!targetEmail) {
      errBox.textContent = 'Please enter your email address first.';
      errBox.classList.remove('hidden');
      return;
    }

    try {
      const res = await api.resendOtp({ email: targetEmail });
      email = targetEmail;
      okBox.textContent = res.message;
      okBox.classList.remove('hidden');
      showToast(res.message);
      startCooldown(res.cooldown_seconds || 60);
    } catch (err) {
      errBox.textContent = err.message;
      errBox.classList.remove('hidden');
    }
  });
}

/**
 * Mounts an interactive Leaflet + OpenStreetMap instance.
 */
export function mountLeafletMap(elementId, { center = [17.1, 79.6], zoom = 7, gems = [], dayRoutes = null, onMarkerClick = null } = {}) {
  const el = document.getElementById(elementId);
  if (!el || typeof window.L === 'undefined') return null;

  const map = window.L.map(el, { scrollWheelZoom: true }).setView(center, zoom);
  window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 18,
  }).addTo(map);

  const bounds = [];
  const markersById = {};

  if (dayRoutes && Array.isArray(dayRoutes)) {
    const dayColors = ['#C84B31', '#164A37', '#C9821E', '#5B3A70', '#0F5E78'];
    dayRoutes.forEach((dayObj, dIdx) => {
      const color = dayColors[dIdx % dayColors.length];
      const latlngs = [];
      (dayObj.gems || []).forEach((gem, sIdx) => {
        latlngs.push([gem.lat, gem.lng]);
        bounds.push([gem.lat, gem.lng]);
        const icon = window.L.divIcon({
          className: '',
          html: `<div class="ut-pin" style="background:${color}"><span class="ut-pin-inner">D${dayObj.day}.${sIdx + 1}</span></div>`,
          iconSize: [30, 30],
          iconAnchor: [15, 30],
          popupAnchor: [0, -28],
        });
        const marker = window.L.marker([gem.lat, gem.lng], { icon }).addTo(map);
        marker.bindPopup(`
          <div style="min-width:190px">
            <div style="font-size:11px;font-weight:700;color:${color}">DAY ${dayObj.day} • STOP ${sIdx + 1}</div>
            <div style="font-weight:700;font-size:14px;margin:2px 0">${esc(gem.name)}</div>
            <div style="font-size:12px;color:#68625B;margin-bottom:6px">${esc(gem.region)}</div>
            <a href="#/gem/${esc(gem.id)}" style="font-size:12px;font-weight:700;color:#C84B31;text-decoration:none">Open Details →</a>
          </div>
        `);
      });
      if (latlngs.length > 1) {
        window.L.polyline(latlngs, { color, weight: 3.5, dashArray: '7 6', opacity: 0.85 }).addTo(map);
      }
    });
  } else {
    gems.forEach((gem) => {
      const cat = getCategoryMeta(gem.category);
      bounds.push([gem.lat, gem.lng]);
      const icon = window.L.divIcon({
        className: '',
        html: `<div class="ut-pin" style="background:${cat.color}"><span class="ut-pin-inner">●</span></div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 30],
        popupAnchor: [0, -28],
      });
      const marker = window.L.marker([gem.lat, gem.lng], { icon }).addTo(map);
      const imgUrl = (gem.images && gem.images[0]) || '/img/gem_001_1.svg';
      const w = store.weatherMap[gem.id];
      const wText = w?.current?.temperature_c !== null && w?.current?.temperature_c !== undefined
        ? `${w.current.icon} ${Math.round(w.current.temperature_c)}°C`
        : '';
      marker.bindPopup(`
        <div style="width:215px">
          <img src="${esc(imgUrl)}" alt="" style="width:100%;height:105px;object-fit:cover;border-radius:10px;margin-bottom:6px"/>
          <div style="display:flex;justify-content:space-between;font-size:11px;font-weight:700;color:${cat.color};text-transform:uppercase">
            <span>${esc(gem.category)}</span>
            <span style="color:#1C1917">${esc(wText)}</span>
          </div>
          <div style="font-weight:700;font-size:14px;margin:2px 0 4px">${esc(gem.name)}</div>
          <div style="display:flex;justify-content:space-between;align-items:center;font-size:12px">
            <span style="color:#164A37;font-weight:600">₹${esc(gem.budget_per_day)}/day</span>
            <a href="#/gem/${esc(gem.id)}" style="font-weight:700;color:#C84B31;text-decoration:none">View →</a>
          </div>
        </div>
      `);
      if (onMarkerClick) {
        marker.on('click', () => onMarkerClick(gem));
      }
      markersById[gem.id] = marker;
    });
  }

  if (bounds.length > 0) {
    map.fitBounds(bounds, { padding: [36, 36], maxZoom: 10 });
  }
  setTimeout(() => map.invalidateSize(), 150);

  return { map, markersById };
}

export function openSosModal() {
  const modalRoot = document.getElementById('modal-root');
  if (!modalRoot) return;

  let gpsCoords = null;
  let gpsStatus = t('sosGpsHint');

  const helplines = [
    { label: t('sosNational'), num: '112', primary: true },
    { label: t('sosPolice'), num: '100' },
    { label: t('sosAmbulance'), num: '108' },
    { label: t('sosWomen'), num: '181' },
    { label: t('sosTourist'), num: '1363' },
  ];

  function buildSosMessage() {
    const baseUrl = gpsCoords
      ? `https://www.openstreetmap.org/?mlat=${gpsCoords.lat}&mlon=${gpsCoords.lng}#map=16/${gpsCoords.lat}/${gpsCoords.lng}`
      : window.location.href;
    const locLine = gpsCoords
      ? `My GPS Location: ${gpsCoords.lat.toFixed(5)}, ${gpsCoords.lng.toFixed(5)} (${baseUrl})`
      : `Current Page: ${window.location.href}`;
    const userLine = store.user ? `Traveller: ${store.user.name} (${store.user.email})` : 'Traveller on Untold Trails';
    return `EMERGENCY SOS ALERT! I need assistance.\n${userLine}\n${locLine}`;
  }

  const personalContacts = (store.user && store.user.emergency_contacts) || [];

  function renderSos() {
    const msg = buildSosMessage();
    const waHref = `https://wa.me/?text=${encodeURIComponent(msg)}`;
    const smsHref = `sms:?body=${encodeURIComponent(msg)}`;

    modalRoot.innerHTML = `
      <div class="fixed inset-0 z-[1050] bg-espresso/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
        <div class="bg-white rounded-3xl border border-red-200 max-w-lg w-full p-6 shadow-2xl ut-fade-in space-y-5 my-auto">
          <div class="flex items-start justify-between gap-3">
            <div class="flex items-center gap-3">
              <span class="w-10 h-10 rounded-2xl bg-red-600 text-white font-bold text-sm flex items-center justify-center shrink-0">SOS</span>
              <div>
                <h3 class="font-display font-bold text-xl text-espresso">${esc(t('sosTitle'))}</h3>
                <p class="text-xs text-muted mt-0.5">${esc(t('sosSub'))}</p>
              </div>
            </div>
            <button id="close-sos-modal" type="button" class="w-8 h-8 rounded-full bg-sand hover:bg-[#E7E0D5] text-espresso font-bold shrink-0">✕</button>
          </div>

          ${personalContacts.length > 0
        ? `<div>
                  <div class="text-xs font-bold uppercase tracking-wider text-forest mb-2">${esc(t('safetyPersonalContacts'))}</div>
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    ${personalContacts
          .map(
            (c) => `
                        <a href="tel:${esc(c.phone)}" class="flex items-center justify-between px-3.5 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-forest hover:bg-emerald-100">
                          <span class="truncate">${esc(c.name)}</span>
                          <span class="font-bold shrink-0">${esc(t('sosCallNow'))} ${esc(c.phone)}</span>
                        </a>`
          )
          .join('')}
                  </div>
                </div>`
        : ''
      }

          <div>
            <div class="text-xs font-bold uppercase tracking-wider text-red-700 mb-2">${esc(t('sosHelplines'))}</div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              ${helplines
        .map(
          (h) => `
                  <a href="tel:${h.num}"
                    class="flex items-center justify-between px-3.5 py-2.5 rounded-xl border transition ${h.primary
              ? 'sm:col-span-2 bg-red-600 hover:bg-red-700 text-white border-red-600'
              : 'bg-cream hover:bg-sand text-espresso border-[#E2D9CC]'
            }">
                    <span class="text-xs font-semibold">${esc(h.label)}</span>
                    <span class="text-sm font-bold">${esc(t('sosCallNow'))} ${h.num}</span>
                  </a>`
        )
        .join('')}
            </div>
          </div>

          <div class="rounded-2xl bg-cream border border-[#E2D9CC] p-4 space-y-3">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div class="text-xs font-bold uppercase tracking-wider text-espresso">${esc(t('sosLocationTitle'))}</div>
              <button id="sos-gps-btn" type="button"
                class="px-3 py-1.5 rounded-xl bg-espresso hover:bg-terracotta text-white text-xs font-semibold transition">
                📍 ${esc(t('sosGetGpsBtn'))}
              </button>
            </div>
            <div class="text-xs text-muted">${esc(gpsStatus)}</div>
            <div class="flex flex-wrap gap-2">
              <button id="sos-copy-btn" type="button"
                class="px-3.5 py-2 rounded-xl border border-[#E2D9CC] bg-white hover:bg-sand text-xs font-semibold text-espresso">
                ${esc(t('sosCopyBtn'))}
              </button>
              <a id="sos-wa-link" href="${waHref}" target="_blank" rel="noopener"
                class="px-3.5 py-2 rounded-xl bg-forest hover:bg-forestLight text-white text-xs font-semibold">
                ${esc(t('sosWhatsAppBtn'))}
              </a>
              <a id="sos-sms-link" href="${smsHref}"
                class="px-3.5 py-2 rounded-xl bg-terracotta hover:bg-terracottaDark text-white text-xs font-semibold">
                ${esc(t('sosSmsBtn'))}
              </a>
            </div>
          </div>

          <div class="rounded-2xl bg-amber-50/70 border border-amber-200 p-3.5 text-xs text-espresso space-y-1">
            <div class="font-bold text-amber-900 mb-1">${esc(t('sosChecklistTitle'))}</div>
            <div>• ${esc(t('sosTip1'))}</div>
            <div>• ${esc(t('sosTip2'))}</div>
            <div>• ${esc(t('sosTip3'))}</div>
          </div>
        </div>
      </div>
    `;

    const close = () => {
      modalRoot.innerHTML = '';
    };
    document.getElementById('close-sos-modal').addEventListener('click', close);
    modalRoot.firstElementChild.addEventListener('click', (e) => {
      if (e.target === modalRoot.firstElementChild) close();
    });

    document.getElementById('sos-copy-btn').addEventListener('click', async () => {
      api.logSos({ lat: gpsCoords?.lat ?? null, lng: gpsCoords?.lng ?? null, message: msg }).catch(() => { });
      try {
        await navigator.clipboard.writeText(msg);
        showToast(t('sosCopiedToast'));
      } catch {
        showToast(msg, 'info');
      }
    });

    ['sos-wa-link', 'sos-sms-link'].forEach((lid) => {
      const el = document.getElementById(lid);
      if (el) {
        el.addEventListener('click', () => {
          api.logSos({ lat: gpsCoords?.lat ?? null, lng: gpsCoords?.lng ?? null, message: msg }).catch(() => { });
        });
      }
    });

    const gpsBtn = document.getElementById('sos-gps-btn');
    gpsBtn.addEventListener('click', () => {
      if (!navigator.geolocation) {
        showToast('Geolocation not available in this browser.', 'error');
        return;
      }
      gpsBtn.disabled = true;
      gpsBtn.textContent = t('sosLocating');
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          gpsCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          gpsStatus = `${t('sosGpsReady', { acc: Math.round(pos.coords.accuracy || 0) })} — ${gpsCoords.lat.toFixed(5)}, ${gpsCoords.lng.toFixed(5)}`;
          api.logSos({ lat: gpsCoords.lat, lng: gpsCoords.lng, message: buildSosMessage() }).catch(() => { });
          renderSos();
        },
        () => {
          gpsStatus = 'Could not detect GPS (allow location permission in browser).';
          renderSos();
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  }

  renderSos();
}

/**
 * Generates a downloadable shareable postcard PNG for WhatsApp & Instagram.
 */
export function openShareModal(gem) {
  const modalRoot = document.getElementById('modal-root');
  if (!modalRoot) return;

  modalRoot.innerHTML = `
    <div class="fixed inset-0 z-[1050] bg-espresso/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div class="bg-white rounded-3xl border border-[#E7E0D5] max-w-lg w-full p-5 shadow-2xl">
        <div class="flex items-center justify-between mb-3">
          <h3 class="font-display font-bold text-xl text-espresso">${esc(t('shareTitle'))}</h3>
          <button id="close-share-modal" class="w-8 h-8 rounded-full bg-sand hover:bg-[#E7E0D5] text-espresso font-bold">✕</button>
        </div>
        <p class="text-xs text-muted mb-3">${esc(t('shareDesc'))}</p>
        <div class="rounded-xl overflow-hidden border border-[#E7E0D5] bg-cream">
          <canvas id="share-card-canvas" width="900" height="620" class="w-full h-auto block"></canvas>
        </div>
        <div class="mt-4 flex flex-wrap gap-2 justify-end">
          <button id="copy-gem-link" class="px-4 py-2 rounded-xl border border-[#E2D9CC] bg-white hover:bg-sand text-sm font-semibold text-espresso">
            ${esc(t('copyLinkBtn'))}
          </button>
          <a id="download-postcard" download="${esc(gem.id)}-untold-trails.png"
            class="px-4 py-2 rounded-xl bg-terracotta hover:bg-terracottaDark text-white text-sm font-semibold cursor-pointer">
            ${esc(t('downloadPngBtn'))}
          </a>
        </div>
      </div>
    </div>
  `;

  const close = () => {
    modalRoot.innerHTML = '';
  };
  document.getElementById('close-share-modal').addEventListener('click', close);
  modalRoot.firstElementChild.addEventListener('click', (e) => {
    if (e.target === modalRoot.firstElementChild) close();
  });

  document.getElementById('copy-gem-link').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      showToast(t('linkCopiedToast'));
    } catch {
      showToast('Copy the URL from your browser address bar.', 'info');
    }
  });

  const canvas = document.getElementById('share-card-canvas');
  const ctx = canvas.getContext('2d');
  const img = new Image();
  img.crossOrigin = 'anonymous';
  const srcUrl = (gem.images && gem.images[0]) || '/img/gem_001_1.svg';

  const drawCard = (loadedImg) => {
    ctx.fillStyle = '#FAF8F5';
    ctx.fillRect(0, 0, 900, 620);

    ctx.strokeStyle = '#E7E0D5';
    ctx.lineWidth = 4;
    ctx.strokeRect(18, 18, 864, 584);

    if (loadedImg) {
      ctx.drawImage(loadedImg, 36, 36, 828, 340);
    } else {
      ctx.fillStyle = '#164A37';
      ctx.fillRect(36, 36, 828, 340);
    }

    ctx.fillStyle = '#164A37';
    ctx.beginPath();
    ctx.roundRect(54, 54, 150, 36, 18);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText('✓ VERIFIED GEM', 72, 78);

    ctx.fillStyle = '#C84B31';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText(`${gem.category.toUpperCase()}  •  ${gem.region.toUpperCase()}`, 40, 418);

    ctx.fillStyle = '#1C1917';
    ctx.font = 'bold 34px Georgia, serif';
    ctx.fillText(gem.name.slice(0, 42), 40, 462);

    ctx.fillStyle = '#68625B';
    ctx.font = '20px sans-serif';
    const summary = gem.summary || '';
    ctx.fillText(summary.slice(0, 72), 40, 502);
    if (summary.length > 72) {
      ctx.fillText(summary.slice(72, 140), 40, 530);
    }

    ctx.fillStyle = '#1C1917';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText(`Best: ${gem.best_season}   |   ~₹${gem.budget_per_day}/day   |   Untold Trails`, 40, 578);

    const dl = document.getElementById('download-postcard');
    if (dl) {
      dl.href = canvas.toDataURL('image/png');
    }
  };

  img.onload = () => drawCard(img);
  img.onerror = () => drawCard(null);
  img.src = srcUrl;
}
