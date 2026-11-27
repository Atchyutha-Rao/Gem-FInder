/** Page renderers and controllers for Home, Explore, Gem Detail, Planner, Submit, and Admin */

import { api } from './api.js';
import { store, showToast } from './store.js';
import { gemSummary, localizeRegion, localizeState, t } from './i18n.js';
import {
  CATEGORIES,
  attachSaveButtons,
  downloadOfflineTextPack,
  esc,
  getCategoryMeta,
  hydrateCardWeather,
  mountLeafletMap,
  openAuthModal,
  openShareModal,
  renderGemCard,
  renderStayCard,
  renderWeatherBadgeMarkup,
  renderWeatherWidget,
  renderAnalyticsSuite,
  wireAnalyticsSuite,
} from './components.js';

export {
  renderGuidesPage,
  renderHostPage,
  renderProfilePage,
  renderSafetyPage,
  renderStayDetailPage,
  renderStaysPage,
} from './pages_extra.js';

/* -------------------------------------------------------------------------- */
/* 1. HOME PAGE (Hero + Spotlight + Inline Account Auth + All-Gem Weather)    */
/* -------------------------------------------------------------------------- */
export async function renderHomePage(root) {
  const { gems } = await api.listGems();
  const featured = gems.slice(0, 8);
  const spotlight = featured[0];
  const tsCount = gems.filter((g) => g.state === 'Telangana').length;
  const apCount = gems.filter((g) => g.state === 'Andhra Pradesh').length;

  let homeAuthMode = 'login';
  let homeAuthRole = 'user';

  function renderHomeAccountSection() {
    const user = store.user;
    if (user) {
      const role = user.role || 'user';
      return `
        <div class="bg-white rounded-3xl border border-[#E7E0D5] p-6 sm:p-7 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div class="flex items-center gap-4">
            <div class="w-12 h-12 rounded-2xl bg-forest text-white font-display font-bold text-lg flex items-center justify-center shrink-0">
              ${esc(user.name.trim()[0]?.toUpperCase() || 'U')}
            </div>
            <div>
              <div class="flex items-center gap-2">
                <span class="text-xs font-semibold uppercase tracking-wider text-forest">${esc(t('authSignedInBadge'))}</span>
                <span class="px-2 py-0.5 rounded-md bg-terracotta/15 text-terracotta text-[10px] font-bold uppercase">${esc(role)}</span>
              </div>
              <h2 class="font-display font-bold text-xl text-espresso">${esc(t('authWelcomeUser', { name: user.name }))}</h2>
              <p class="text-xs text-muted mt-0.5">${esc(t('authSyncedMsg', { email: user.email, count: store.savedIds.length }))}</p>
            </div>
          </div>
          <div class="flex flex-wrap items-center gap-2.5">
            ${
              role === 'host'
                ? `<a href="#/host-dashboard" class="px-4 py-2 rounded-xl bg-terracotta hover:bg-terracottaDark text-white text-xs sm:text-sm font-semibold transition">${esc(t('hostTitle'))}</a>`
                : role === 'admin'
                  ? `<a href="#/admin" class="px-4 py-2 rounded-xl bg-terracotta hover:bg-terracottaDark text-white text-xs sm:text-sm font-semibold transition">${esc(t('navAdmin'))}</a>`
                  : `<a href="#/traveller-dashboard" class="px-4 py-2 rounded-xl bg-forest hover:bg-forestLight text-white text-xs sm:text-sm font-semibold transition">${esc(t('navProfile'))}</a>`
            }
            <a href="#/stays" class="px-4 py-2 rounded-xl border border-[#E2D9CC] bg-cream hover:bg-sand text-xs sm:text-sm font-semibold text-espresso transition">
              ${esc(t('navStays'))}
            </a>
            <a href="#/safety" class="px-4 py-2 rounded-xl border border-[#E2D9CC] bg-cream hover:bg-sand text-xs sm:text-sm font-semibold text-espresso transition">
              ${esc(t('navSafety'))}
            </a>
            <button id="home-logout-btn" type="button" class="px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold text-muted hover:text-terracotta transition">
              ${esc(t('navLogout'))}
            </button>
          </div>
        </div>
      `;
    }

    const roleOptions = [
      { id: 'user', labelKey: 'roleUser', icon: '🧳' },
      { id: 'host', labelKey: 'roleHost', icon: '🏡' },
      { id: 'admin', labelKey: 'roleAdmin', icon: '🛡️' },
    ];

    return `
      <div class="bg-white rounded-3xl border border-[#E7E0D5] p-6 sm:p-8 shadow-xs grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        <div class="lg:col-span-6 space-y-3">
          <span class="inline-block px-3 py-1 rounded-full bg-sand text-xs font-semibold text-espresso">${esc(t('authBadge'))}</span>
          <h2 class="font-display font-bold text-2xl sm:text-3xl text-espresso leading-tight">
            ${esc(t('authHomeTitle'))}
          </h2>
          <p class="text-sm text-muted leading-relaxed">
            ${esc(t('authHomeDesc'))}
          </p>
          <div class="pt-1 flex flex-wrap gap-x-6 gap-y-2 text-xs font-medium text-espresso/80">
            <span>${esc(t('authPerk1'))}</span>
            <span>${esc(t('authPerk2'))}</span>
            <span>${esc(t('authPerk3'))}</span>
          </div>
        </div>

        <div class="lg:col-span-6 bg-cream rounded-2xl border border-[#E7E0D5] p-5">
          <div class="grid grid-cols-2 gap-1 p-1 rounded-xl bg-sand mb-3 text-xs font-semibold">
            <button type="button" data-home-auth-tab="login"
              class="py-2 rounded-lg transition ${homeAuthMode === 'login' ? 'bg-white text-espresso shadow-2xs' : 'text-muted'}">
              ${esc(t('authLoginBtn'))}
            </button>
            <button type="button" data-home-auth-tab="register"
              class="py-2 rounded-lg transition ${homeAuthMode === 'register' ? 'bg-white text-espresso shadow-2xs' : 'text-muted'}">
              ${esc(t('authRegBtn'))}
            </button>
          </div>

          <div class="mb-3">
            <div class="text-[11px] font-bold uppercase tracking-wider text-muted mb-1.5">${esc(t('authRoleLabel'))}</div>
            <div class="grid grid-cols-3 gap-2">
              ${roleOptions
                .map(
                  (r) => `
                  <button type="button" data-home-auth-role="${r.id}"
                    class="flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl border text-xs font-semibold transition ${
                      homeAuthRole === r.id
                        ? 'bg-terracotta text-white border-terracotta shadow-xs'
                        : 'bg-white text-espresso border-[#E2D9CC] hover:bg-sand'
                    }">
                    <span>${r.icon}</span>
                    <span>${esc(t(r.labelKey))}</span>
                  </button>`
                )
                .join('')}
            </div>
          </div>

          <div id="home-auth-err" class="hidden mb-3 px-3 py-2 rounded-xl bg-red-50 border border-red-200 text-xs font-medium text-red-700"></div>

          <form id="home-auth-form" class="space-y-3">
            ${
              homeAuthMode === 'register'
                ? `<input name="name" required placeholder="${esc(t('authFullName'))}"
                    class="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#E2D9CC] text-sm focus:outline-none focus:border-terracotta" />`
                : ''
            }
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input name="email" type="email" required placeholder="${esc(t('authEmail'))}"
                class="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#E2D9CC] text-sm focus:outline-none focus:border-terracotta" />
              <input name="password" type="password" required minlength="6" placeholder="${esc(homeAuthMode === 'register' ? t('authPassPlaceholderReg') : t('authPassPlaceholderLogin'))}"
                class="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#E2D9CC] text-sm focus:outline-none focus:border-terracotta" />
            </div>
            <button id="home-auth-submit" type="submit"
              class="w-full py-2.5 rounded-xl bg-espresso hover:bg-terracotta text-white text-sm font-semibold transition">
              ${esc(homeAuthMode === 'login' ? t('authHomeLoginBtn') : t('authHomeRegBtn'))} (${esc(t(`role${homeAuthRole.charAt(0).toUpperCase() + homeAuthRole.slice(1)}`))})
            </button>
          </form>
        </div>
      </div>
    `;
  }

  const spotName = spotlight ? (store.lang === 'te' && spotlight.name_te ? spotlight.name_te : spotlight.name) : '';

  root.innerHTML = `
    <section class="ut-hero-mesh border-b border-[#E7E0D5]">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-14 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center ut-fade-in">
        <div class="lg:col-span-7">
          <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-[#E2D9CC] text-xs font-semibold text-forest mb-4 shadow-2xs">
            <span>${esc(t('heroStats', { total: gems.length, ts: tsCount, ap: apCount }))}</span>
          </div>

          <h1 class="font-display font-bold text-3xl sm:text-5xl lg:text-[3.1rem] text-espresso leading-[1.1] tracking-tight ${store.lang === 'te' ? 'font-telugu' : ''}">
            ${esc(t('heroTitle1'))}<br/>
            <span class="text-terracotta">${esc(t('heroTitle2'))}</span>
          </h1>

          <p class="mt-3.5 text-sm sm:text-base text-muted max-w-xl leading-relaxed ${store.lang === 'te' ? 'font-telugu' : ''}">
            ${esc(t('heroSubtitle'))}
          </p>

          <form id="home-search-form" class="mt-6 flex flex-col sm:flex-row gap-2.5 max-w-xl">
            <input id="home-search-input" type="text"
              placeholder="${esc(t('heroSearchPlaceholder'))}"
              class="flex-1 px-4 py-3 rounded-xl bg-white border border-[#E2D9CC] focus:outline-none focus:ring-2 focus:ring-terracotta/20 focus:border-terracotta text-sm shadow-2xs" />
            <button type="submit"
              class="px-6 py-3 rounded-xl bg-terracotta hover:bg-terracottaDark text-white font-semibold text-sm shadow-xs transition shrink-0">
              ${esc(t('heroExploreBtn'))}
            </button>
          </form>

          <div class="mt-5 flex flex-wrap gap-2">
            ${CATEGORIES.filter((c) => c.id !== 'all')
              .map((c) => {
                const count = gems.filter((g) => g.category === c.id).length;
                return `
                <a href="#/explore?category=${c.id}"
                  class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:border-terracotta border border-[#E2D9CC] text-xs font-semibold text-espresso transition shadow-2xs">
                  <span>${store.lang === 'te' ? esc(c.label_te) : esc(c.label)}</span>
                  <span class="px-1.5 py-0.5 rounded-md bg-sand text-[10px] text-muted font-bold">${count}</span>
                </a>`;
              })
              .join('')}
          </div>
        </div>

        ${
          spotlight
            ? `<div class="lg:col-span-5">
                <div class="bg-white rounded-3xl border border-[#E7E0D5] overflow-hidden shadow-lg">
                  <a href="#/gem/${esc(spotlight.id)}" class="relative block aspect-[16/10] bg-sand overflow-hidden group">
                    <img src="${esc(spotlight.images[0])}" alt="${esc(spotName)}"
                      class="w-full h-full object-cover group-hover:scale-[1.03] transition duration-300" />
                    <div class="absolute top-3.5 left-3.5 px-3 py-1 rounded-full bg-espresso/80 text-white text-[11px] font-semibold backdrop-blur-xs">
                      ${esc(t('featuredTrail'))}
                    </div>
                    <div data-gem-weather="${esc(spotlight.id)}" class="absolute top-3.5 right-3.5">
                      ${renderWeatherBadgeMarkup(store.weatherMap[spotlight.id])}
                    </div>
                  </a>
                  <div class="p-5">
                    <div class="text-xs font-semibold text-terracotta">${esc(localizeRegion(spotlight.region))}</div>
                    <div class="flex items-start justify-between gap-3 mt-1">
                      <h3 class="font-display font-bold text-xl text-espresso ${store.lang === 'te' ? 'font-telugu' : ''}">${esc(spotName)}</h3>
                      <span class="text-xs font-semibold text-forest bg-emerald-50 px-2.5 py-1 rounded-full shrink-0">₹${esc(spotlight.budget_per_day)}${esc(t('perDay'))}</span>
                    </div>
                    <p class="mt-2 text-sm text-muted line-clamp-2 ${store.lang === 'te' ? 'font-telugu' : ''}">${esc(gemSummary(spotlight))}</p>
                    <div class="mt-4 pt-3 border-t border-[#F0EAE0] flex items-center justify-between text-xs">
                      <span class="text-muted">${esc(t('bestLabel'))} <strong class="text-espresso">${esc(spotlight.best_season)}</strong></span>
                      <a href="#/gem/${esc(spotlight.id)}" class="font-semibold text-terracotta hover:underline">${esc(t('viewDetailsForecast'))}</a>
                    </div>
                  </div>
                </div>
              </div>`
            : ''
        }
      </div>
    </section>

    <section class="max-w-7xl mx-auto px-4 sm:px-6 pt-6">
      <div class="ut-grid-stagger grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <a href="#/explore" class="ut-card-lift ut-panel rounded-2xl p-4 hover:border-terracotta group">
          <div class="text-[11px] font-bold uppercase tracking-wider text-muted">${esc(t('navExplore'))}</div>
          <div class="font-display font-bold text-2xl text-espresso mt-1 group-hover:text-terracotta transition">${gems.length}</div>
          <div class="text-xs text-forest font-medium mt-0.5">${esc(t('verified'))} →</div>
        </a>
        <a href="#/stays" class="ut-card-lift ut-panel rounded-2xl p-4 hover:border-terracotta group">
          <div class="text-[11px] font-bold uppercase tracking-wider text-muted">${esc(t('navStays'))}</div>
          <div class="font-display font-bold text-2xl text-terracotta mt-1">${esc(t('staysKicker'))}</div>
          <div class="text-xs text-muted mt-0.5 group-hover:text-espresso transition">${esc(t('viewAllStays'))}</div>
        </a>
        <a href="#/planner" class="ut-card-lift ut-panel rounded-2xl p-4 hover:border-terracotta group">
          <div class="text-[11px] font-bold uppercase tracking-wider text-muted">${esc(t('navPlanner'))}</div>
          <div class="font-display font-bold text-2xl text-forest mt-1">${store.savedIds.length}</div>
          <div class="text-xs text-muted mt-0.5 group-hover:text-espresso transition">${esc(t('navSaved'))} →</div>
        </a>
        <a href="#/safety" class="ut-card-lift ut-panel rounded-2xl p-4 hover:border-terracotta group">
          <div class="text-[11px] font-bold uppercase tracking-wider text-muted">${esc(t('navSafety'))}</div>
          <div class="font-display font-bold text-2xl text-espresso mt-1">112 / SOS</div>
          <div class="text-xs text-terracotta font-medium mt-0.5">${esc(t('safetyOpenSosBtn'))} →</div>
        </a>
      </div>
    </section>

    <section class="max-w-7xl mx-auto px-4 sm:px-6 pt-6">
      <div id="home-account-slot"></div>
    </section>

    <section class="max-w-7xl mx-auto px-4 sm:px-6 pt-12">
      <div class="flex items-end justify-between gap-4 mb-6">
        <div>
          <div class="text-xs font-semibold text-terracotta">${esc(t('curatedVerified'))}</div>
          <h2 class="font-display font-bold text-2xl sm:text-3xl text-espresso mt-1">${esc(t('homeGemsHeading'))}</h2>
        </div>
        <a href="#/explore" class="text-sm font-semibold text-terracotta hover:underline shrink-0">${esc(t('viewAllPlaces', { count: gems.length }))}</a>
      </div>

      <div id="home-gems-grid" class="ut-grid-stagger grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        ${featured.map((g) => renderGemCard(g)).join('')}
      </div>
    </section>

    <section class="max-w-7xl mx-auto px-4 sm:px-6 pt-14">
      <div class="ut-grid-stagger grid grid-cols-1 md:grid-cols-3 gap-5">
        ${[
          { step: '01', title: t('step1Title'), desc: t('step1Desc'), href: '#/explore', cta: t('step1Cta') },
          { step: '02', title: t('step2Title'), desc: t('step2Desc'), href: '#/planner', cta: t('step2Cta') },
          { step: '03', title: t('step3Title'), desc: t('step3Desc'), href: '#/submit', cta: t('step3Cta') },
        ]
          .map(
            (p) => `
            <div class="ut-card-lift group bg-white rounded-2xl border border-[#E7E0D5] p-6 flex flex-col h-full">
              <div class="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-terracotta/10 text-terracotta text-xs font-bold tracking-wider mb-3">${p.step}</div>
              <h3 class="font-display font-bold text-lg text-espresso">${esc(p.title)}</h3>
              <p class="mt-2 text-sm text-muted flex-1 leading-relaxed">${esc(p.desc)}</p>
              <a href="${p.href}" class="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-espresso group-hover:text-terracotta transition">${esc(p.cta)} <span class="group-hover:translate-x-1 transition-transform">→</span></a>
            </div>`
          )
          .join('')}
      </div>
    </section>

    <!-- Local Stays, Guides & Safety Ecosystem -->
    <section class="max-w-7xl mx-auto px-4 sm:px-6 pt-10">
      <div class="ut-grid-stagger grid grid-cols-1 md:grid-cols-3 gap-5">
        <a href="#/stays" class="ut-card-lift group bg-white rounded-2xl border border-[#E7E0D5] p-6 flex flex-col justify-between gap-3 h-full">
          <div>
            <div class="text-xs font-bold uppercase tracking-wider text-forest">${esc(t('staysKicker'))}</div>
            <h3 class="font-display font-bold text-xl text-espresso mt-1 group-hover:text-terracotta transition">${esc(t('staysTitle'))}</h3>
            <p class="text-xs text-muted mt-1.5 leading-relaxed">${esc(t('staysSub'))}</p>
          </div>
          <span class="text-xs font-semibold text-terracotta group-hover:translate-x-1 transition-transform inline-block">${esc(t('viewAllStays'))}</span>
        </a>

        <a href="#/guides" class="ut-card-lift group bg-white rounded-2xl border border-[#E7E0D5] p-6 flex flex-col justify-between gap-3 h-full">
          <div>
            <div class="text-xs font-bold uppercase tracking-wider text-forest">${esc(t('guidesKicker'))}</div>
            <h3 class="font-display font-bold text-xl text-espresso mt-1 group-hover:text-terracotta transition">${esc(t('guidesTitle'))}</h3>
            <p class="text-xs text-muted mt-1.5 leading-relaxed">${esc(t('guidesSub'))}</p>
          </div>
          <span class="text-xs font-semibold text-terracotta group-hover:translate-x-1 transition-transform inline-block">${esc(t('navGuides'))} →</span>
        </a>

        <a href="#/safety" class="ut-card-lift group bg-[#18181B] text-white rounded-2xl p-6 flex flex-col justify-between gap-3 h-full">
          <div>
            <div class="text-xs font-bold uppercase tracking-wider text-amber-300">${esc(t('safetyKicker'))}</div>
            <h3 class="font-display font-bold text-xl mt-1">${esc(t('safetyTitle'))}</h3>
            <p class="text-xs text-white/80 mt-1.5 leading-relaxed">${esc(t('safetySub'))}</p>
          </div>
          <span class="text-xs font-semibold text-amber-300 group-hover:translate-x-1 transition-transform inline-block">${esc(t('navSafety'))} →</span>
        </a>
      </div>
    </section>
  `;

  function mountHomeAccount() {
    const slot = document.getElementById('home-account-slot');
    if (!slot) return;
    slot.innerHTML = renderHomeAccountSection();

    const logoutBtn = document.getElementById('home-logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        store.logout();
        showToast(t('navLogout'), 'info');
        window.location.hash = '#/login';
      });
      return;
    }

    slot.querySelectorAll('[data-home-auth-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        homeAuthMode = btn.getAttribute('data-home-auth-tab');
        mountHomeAccount();
      });
    });

    slot.querySelectorAll('[data-home-auth-role]').forEach((btn) => {
      btn.addEventListener('click', () => {
        homeAuthRole = btn.getAttribute('data-home-auth-role');
        mountHomeAccount();
      });
    });

    const form = document.getElementById('home-auth-form');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(form);
        const errBox = document.getElementById('home-auth-err');
        const btn = document.getElementById('home-auth-submit');
        errBox.classList.add('hidden');
        btn.disabled = true;
        btn.textContent = homeAuthMode === 'login' ? t('authLoggingIn') : t('authCreating');

        try {
          const res =
            homeAuthMode === 'register'
              ? await api.register({
                  name: fd.get('name'),
                  email: fd.get('email'),
                  password: fd.get('password'),
                  role: homeAuthRole,
                  saved_ids: store.savedIds,
                })
              : await api.login({
                  email: fd.get('email'),
                  password: fd.get('password'),
                  role: homeAuthRole,
                });
          if (res.requires_verification) {
            showToast(res.message || 'Verification OTP sent to your email.');
            window.location.hash = `#/verify-email?email=${encodeURIComponent(res.email || fd.get('email'))}`;
            return;
          }
          store.setAuth(res.token, res.user);
          showToast(t('authWelcomeUser', { name: res.user.name }));
          if (res.user.role === 'host') {
            window.location.hash = '#/host-dashboard';
          } else if (res.user.role === 'admin') {
            window.location.hash = '#/admin';
          } else {
            window.location.hash = '#/traveller-dashboard';
          }
        } catch (err) {
          const emailVal = String(fd.get('email') || '').trim();
          if (err.message && err.message.toLowerCase().includes('not verified') && emailVal) {
            errBox.innerHTML = `${esc(err.message)} <a href="#/verify-email?email=${encodeURIComponent(emailVal)}" class="underline font-bold ml-1">Verify Email →</a>`;
          } else {
            errBox.textContent = err.message;
          }
          errBox.classList.remove('hidden');
          btn.disabled = false;
          btn.textContent = homeAuthMode === 'login' ? t('authHomeLoginBtn') : t('authHomeRegBtn');
        }
      });
    }
  }

  mountHomeAccount();

  document.getElementById('home-search-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const q = document.getElementById('home-search-input').value.trim();
    window.location.hash = q ? `#/explore?q=${encodeURIComponent(q)}` : '#/explore';
  });

  attachSaveButtons(root);
  hydrateCardWeather(root);
}

/* -------------------------------------------------------------------------- */
/* 2. EXPLORE PAGE (Clean Filters + Map + All-Gem Weather Cards)              */
/* -------------------------------------------------------------------------- */
export async function renderExplorePage(root, queryParams) {
  const initialCat = queryParams.get('category') || 'all';
  const initialQ = queryParams.get('q') || '';
  const state = {
    category: initialCat,
    stateFilter: queryParams.get('state') || 'all',
    season: 'all',
    crowd: 'all',
    hidden: 'all',
    max_budget: 'all',
    sortBy: 'featured',
    q: initialQ,
    mobileView: 'split',
  };

  root.innerHTML = `
    <section class="sticky top-16 z-30 ut-topbar">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 py-3 space-y-2.5">
        <div class="flex flex-wrap items-center gap-2">
          <input id="exp-q" type="text" value="${esc(state.q)}" placeholder="${esc(t('expSearchPlaceholder'))}"
            class="flex-1 min-w-[180px] px-3.5 py-2 rounded-xl bg-cream border border-[#E2D9CC] text-sm focus:outline-none focus:border-terracotta" />

          <select id="exp-state" class="px-3 py-2 rounded-xl bg-cream border border-[#E2D9CC] text-sm text-espresso">
            <option value="all">${esc(t('expAllRegions'))}</option>
          </select>

          <select id="exp-hidden" class="px-3 py-2 rounded-xl bg-cream border border-[#E2D9CC] text-sm text-espresso">
            <option value="all">${esc(t('hiddenAll'))}</option>
            <option value="hidden">${esc(t('hiddenOnly'))}</option>
            <option value="popular">${esc(t('popularOnly'))}</option>
          </select>

          <select id="exp-season" class="px-3 py-2 rounded-xl bg-cream border border-[#E2D9CC] text-sm text-espresso">
            <option value="all">${esc(t('expAnySeason'))}</option>
            <option value="Monsoon">${esc(t('expMonsoon'))}</option>
            <option value="Winter">${esc(t('expWinter'))}</option>
            <option value="All Year">${esc(t('expAllYear'))}</option>
          </select>

          <select id="exp-crowd" class="px-3 py-2 rounded-xl bg-cream border border-[#E2D9CC] text-sm text-espresso">
            <option value="all">${esc(t('crowdAll'))}</option>
            <option value="Low">${esc(t('crowdLow'))}</option>
            <option value="Moderate">${esc(t('crowdModerate'))}</option>
          </select>

          <select id="exp-budget" class="px-3 py-2 rounded-xl bg-cream border border-[#E2D9CC] text-sm text-espresso">
            <option value="all">${esc(t('expAnyBudget'))}</option>
            <option value="700">${esc(t('expUnder700'))}</option>
            <option value="1000">${esc(t('expUnder1000'))}</option>
            <option value="1500">${esc(t('expUnder1500'))}</option>
          </select>

          <select id="exp-sort" class="px-3 py-2 rounded-xl bg-cream border border-[#E2D9CC] text-sm text-espresso">
            <option value="featured">${esc(t('expSortFeatured'))}</option>
            <option value="budget_asc">${esc(t('expSortBudget'))}</option>
            <option value="duration_asc">${esc(t('expSortDuration'))}</option>
          </select>

          <button id="exp-reset" type="button" class="px-3 py-2 rounded-xl text-xs font-semibold text-terracotta hover:bg-sand">
            ${esc(t('expReset'))}
          </button>
        </div>

        <div class="flex items-center justify-between gap-3">
          <div id="exp-cat-pills" class="flex gap-1.5 overflow-x-auto hide-scrollbar py-0.5">
            ${CATEGORIES.map(
              (c) => `
              <button type="button" data-cat-pill="${c.id}"
                class="px-3 py-1 rounded-full text-xs font-semibold border whitespace-nowrap transition ${
                  state.category === c.id
                    ? 'bg-espresso text-white border-espresso'
                    : 'bg-white text-muted border-[#E2D9CC] hover:text-espresso'
                }">
                ${esc(store.lang === 'te' ? c.label_te : c.label)}
              </button>`
            ).join('')}
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <div class="lg:hidden inline-flex rounded-lg border border-[#E2D9CC] bg-cream p-0.5 text-[11px] font-semibold">
              <button type="button" data-mobile-view="split" class="px-2 py-1 rounded-md bg-espresso text-white">${esc(t('expBoth'))}</button>
              <button type="button" data-mobile-view="map" class="px-2 py-1 rounded-md text-espresso">${esc(t('expMap'))}</button>
              <button type="button" data-mobile-view="list" class="px-2 py-1 rounded-md text-espresso">${esc(t('expList'))}</button>
            </div>
            <div id="exp-count" class="text-xs font-semibold text-muted">...</div>
          </div>
        </div>
      </div>
    </section>

    <section class="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex-1 w-full">
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div id="explore-map-col" class="lg:col-span-5 lg:sticky lg:top-44 space-y-3">
          <div class="rounded-2xl overflow-hidden border border-[#E2D9CC] shadow-xs bg-sand">
            <div id="explore-map" class="w-full h-[320px] lg:h-[510px]"></div>
          </div>
          <div id="explore-weather-bar" class="rounded-2xl border border-[#E7E0D5] bg-white p-3.5 text-xs text-muted">
            ${esc(t('expClickMarker'))}
          </div>
        </div>

        <div id="explore-list-col" class="lg:col-span-7">
          <div id="explore-grid" class="ut-grid-stagger grid grid-cols-1 sm:grid-cols-2 gap-5"></div>
        </div>
      </div>
    </section>
  `;

  let mapInstance = null;

  async function showPlaceWeatherPreview(gem) {
    const bar = document.getElementById('explore-weather-bar');
    if (!bar || !gem) return;
    const cached = store.weatherMap[gem.id] || null;
    const name = store.lang === 'te' && gem.name_te ? gem.name_te : gem.name;
    bar.innerHTML = `
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="min-w-0">
          <a href="#/gem/${esc(gem.id)}" class="font-bold text-espresso hover:text-terracotta truncate block">${esc(name)} →</a>
          <div class="text-[11px] text-muted truncate">${esc(localizeRegion(gem.region))} • ${esc(t('bestLabel'))} ${esc(gem.best_season)}</div>
        </div>
        ${renderWeatherWidget(cached, { compact: true })}
      </div>`;
    if (!cached) {
      try {
        const w = await api.getGemWeather(gem.id);
        store.weatherMap[gem.id] = w;
        const currentBar = document.getElementById('explore-weather-bar');
        if (currentBar) {
          currentBar.innerHTML = `
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div class="min-w-0">
                <a href="#/gem/${esc(gem.id)}" class="font-bold text-espresso hover:text-terracotta truncate block">${esc(name)} →</a>
                <div class="text-[11px] text-muted truncate">${esc(localizeRegion(gem.region))} • ${esc(t('bestLabel'))} ${esc(gem.best_season)}</div>
              </div>
              ${renderWeatherWidget(w, { compact: true })}
            </div>`;
        }
      } catch {
        // Ignore preview fetch errors
      }
    }
  }

  let statesPopulated = false;

  async function refreshExplore() {
    const res = await api.listGems({
      category: state.category,
      state: state.stateFilter,
      season: state.season,
      crowd: state.crowd,
      hidden: state.hidden,
      max_budget: state.max_budget,
      q: state.q,
    });
    if (!statesPopulated && Array.isArray(res.states)) {
      statesPopulated = true;
      const sel = document.getElementById('exp-state');
      if (sel) {
        sel.innerHTML =
          `<option value="all">${esc(t('expAllRegions'))}</option>` +
          res.states.map((st) => `<option value="${esc(st)}">${esc(localizeState(st))}</option>`).join('');
        sel.value = state.stateFilter;
      }
    }
    let gems = [...(res.gems || [])];
    if (state.sortBy === 'budget_asc') {
      gems.sort((a, b) => (a.budget_per_day || 0) - (b.budget_per_day || 0));
    } else if (state.sortBy === 'duration_asc') {
      gems.sort((a, b) => (a.duration_hours || 0) - (b.duration_hours || 0));
    }

    document.getElementById('exp-count').textContent = t('expPlacesCount', { count: gems.length });

    const grid = document.getElementById('explore-grid');
    if (gems.length === 0) {
      grid.innerHTML = `
        <div class="sm:col-span-2 bg-white rounded-2xl border border-[#E7E0D5] p-10 text-center">
          <h3 class="font-display font-bold text-lg text-espresso">${esc(t('expNoMatchTitle'))}</h3>
          <p class="text-sm text-muted mt-1">${esc(t('expNoMatchDesc'))}</p>
          <a href="#/submit" class="inline-block mt-4 px-4 py-2 rounded-xl bg-terracotta text-white text-xs font-semibold">${esc(t('expContribute'))}</a>
        </div>`;
    } else {
      grid.innerHTML = gems.map((g) => renderGemCard(g)).join('');
      attachSaveButtons(grid);
      await hydrateCardWeather(grid);
      showPlaceWeatherPreview(gems[0]);
    }

    if (mapInstance && mapInstance.map) {
      mapInstance.map.remove();
    }
    mapInstance = mountLeafletMap('explore-map', {
      gems,
      onMarkerClick: (gem) => {
        showPlaceWeatherPreview(gem);
        const card = grid.querySelector(`[data-gem-card="${gem.id}"]`);
        if (card) {
          card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          card.classList.add('ring-2', 'ring-terracotta');
          setTimeout(() => card.classList.remove('ring-2', 'ring-terracotta'), 1600);
        }
      },
    });
  }

  let debounceTimer = null;
  document.getElementById('exp-q').addEventListener('input', (e) => {
    state.q = e.target.value;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(refreshExplore, 220);
  });
  document.getElementById('exp-state').value = state.stateFilter;
  document.getElementById('exp-state').addEventListener('change', (e) => {
    state.stateFilter = e.target.value;
    refreshExplore();
  });
  document.getElementById('exp-season').addEventListener('change', (e) => {
    state.season = e.target.value;
    refreshExplore();
  });
  document.getElementById('exp-hidden').addEventListener('change', (e) => {
    state.hidden = e.target.value;
    refreshExplore();
  });
  document.getElementById('exp-crowd').addEventListener('change', (e) => {
    state.crowd = e.target.value;
    refreshExplore();
  });
  document.getElementById('exp-budget').addEventListener('change', (e) => {
    state.max_budget = e.target.value;
    refreshExplore();
  });
  document.getElementById('exp-sort').addEventListener('change', (e) => {
    state.sortBy = e.target.value;
    refreshExplore();
  });

  document.querySelectorAll('[data-mobile-view]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.mobileView = btn.getAttribute('data-mobile-view');
      document.querySelectorAll('[data-mobile-view]').forEach((b) => {
        const active = b.getAttribute('data-mobile-view') === state.mobileView;
        b.className = `px-2 py-1 rounded-md ${active ? 'bg-espresso text-white' : 'text-espresso'}`;
      });
      const mapCol = document.getElementById('explore-map-col');
      const listCol = document.getElementById('explore-list-col');
      mapCol.classList.toggle('hidden', state.mobileView === 'list');
      listCol.classList.toggle('hidden', state.mobileView === 'map');
      if (state.mobileView !== 'list' && mapInstance && mapInstance.map) {
        setTimeout(() => mapInstance.map.invalidateSize(), 120);
      }
    });
  });

  document.querySelectorAll('[data-cat-pill]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.category = btn.getAttribute('data-cat-pill');
      document.querySelectorAll('[data-cat-pill]').forEach((b) => {
        const active = b.getAttribute('data-cat-pill') === state.category;
        b.className = `px-3 py-1 rounded-full text-xs font-semibold border whitespace-nowrap transition ${
          active ? 'bg-espresso text-white border-espresso' : 'bg-white text-muted border-[#E2D9CC] hover:text-espresso'
        }`;
      });
      refreshExplore();
    });
  });

  document.getElementById('exp-reset').addEventListener('click', () => {
    state.category = 'all';
    state.stateFilter = 'all';
    state.season = 'all';
    state.crowd = 'all';
    state.hidden = 'all';
    state.max_budget = 'all';
    state.sortBy = 'featured';
    state.q = '';
    document.getElementById('exp-q').value = '';
    document.getElementById('exp-state').value = 'all';
    document.getElementById('exp-hidden').value = 'all';
    document.getElementById('exp-season').value = 'all';
    document.getElementById('exp-crowd').value = 'all';
    document.getElementById('exp-budget').value = 'all';
    document.getElementById('exp-sort').value = 'featured';
    document.querySelector('[data-cat-pill="all"]').click();
  });

  await refreshExplore();
}

/* -------------------------------------------------------------------------- */
/* 3. GEM DETAIL PAGE                                                         */
/* -------------------------------------------------------------------------- */
export async function renderGemDetailPage(root, gemId) {
  const detailRes = await api.getGem(gemId);
  const { gem, nearby, nearby_stays = [] } = detailRes;
  let reviews = detailRes.reviews || [];
  const cat = getCategoryMeta(gem.category);
  const images = gem.images && gem.images.length ? gem.images : ['/img/gem_001_1.svg'];
  let activeImg = 0;
  let storyLang = store.lang;
  let weatherData = store.weatherMap[gem.id] || null;

  function draw() {
    const saved = store.isSaved(gem.id);
    const titleMain = store.lang === 'te' && gem.name_te ? gem.name_te : gem.name;
    root.innerHTML = `
      <section class="max-w-6xl mx-auto px-4 sm:px-6 py-8 ut-fade-in">
        <div class="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div class="flex items-center gap-2 text-xs sm:text-sm text-muted">
            <a href="#/" class="hover:text-terracotta">${esc(t('navHome'))}</a>
            <span>/</span>
            <a href="#/explore?category=${esc(gem.category)}" class="hover:text-terracotta">${esc(store.lang === 'te' ? cat.label_te : cat.label)}</a>
            <span>/</span>
            <span class="font-semibold text-espresso truncate max-w-[200px] sm:max-w-none">${esc(titleMain)}</span>
          </div>
          <div class="flex flex-wrap gap-2">
            <button id="detail-offline-btn" type="button"
              class="px-3.5 py-2 rounded-xl border border-[#E2D9CC] bg-white hover:bg-sand text-xs sm:text-sm font-semibold text-espresso transition">
              📥 ${esc(t('downloadOfflineBtn'))}
            </button>
            <button id="detail-share-btn" type="button"
              class="px-3.5 py-2 rounded-xl border border-[#E2D9CC] bg-white hover:bg-sand text-xs sm:text-sm font-semibold text-espresso transition">
              ${esc(t('sharePostcard'))}
            </button>
            <button id="detail-save-btn" type="button"
              class="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition shadow-xs ${
                saved ? 'bg-terracotta text-white' : 'bg-forest text-white hover:bg-forestLight'
              }">
              ${esc(saved ? t('savedToTrip') : t('saveToTrip'))}
            </button>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div class="lg:col-span-7 space-y-5">
            <div class="rounded-3xl overflow-hidden border border-[#E7E0D5] bg-white shadow-xs">
              <div class="relative aspect-[16/10] bg-sand">
                <img id="detail-main-img" src="${esc(images[activeImg])}" alt="${esc(titleMain)}"
                  onerror="this.onerror=null;this.src='/img/${esc(gem.id)}_1.svg'"
                  class="w-full h-full object-cover" />
                <div class="absolute bottom-3 right-3 px-2.5 py-1 rounded-full bg-espresso/75 text-white text-[11px] font-semibold backdrop-blur-xs">
                  ${activeImg + 1} / ${images.length}
                </div>
              </div>
              ${
                images.length > 1
                  ? `<div class="p-3 bg-cream border-t border-[#EDE6DB] flex items-center justify-between gap-3">
                      <div class="flex gap-2">
                        ${images
                          .map(
                            (src, idx) => `
                            <button type="button" data-thumb-idx="${idx}"
                              class="w-20 h-12 rounded-lg overflow-hidden border-2 ${
                                idx === activeImg ? 'border-terracotta' : 'border-transparent opacity-70 hover:opacity-100'
                              }">
                              <img src="${esc(src)}" alt="" class="w-full h-full object-cover" />
                            </button>`
                          )
                          .join('')}
                      </div>
                      <span class="text-[11px] text-muted">${esc(gem.image_credit || 'Untold Trails Archive')}</span>
                    </div>`
                  : `<div class="px-4 py-2 text-[11px] text-muted border-t border-[#EDE6DB]">${esc(gem.image_credit || 'Untold Trails Archive')}</div>`
              }
            </div>

            <div class="bg-white rounded-3xl border border-[#E7E0D5] p-6 shadow-xs">
              <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="px-3 py-1 rounded-full text-xs font-semibold ${cat.bg}">${esc(store.lang === 'te' ? cat.label_te : cat.label)}</span>
                  <span class="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-forest border border-emerald-200">
                    ${esc(gem.status === 'verified' ? t('verifiedPlace') : t('pendingReview'))}
                  </span>
                </div>

                <div class="inline-flex rounded-xl border border-[#E2D9CC] p-0.5 bg-cream text-xs font-semibold">
                  <button type="button" data-story-lang="en"
                    class="px-3 py-1 rounded-lg ${storyLang === 'en' ? 'bg-espresso text-white' : 'text-muted'}">
                    English
                  </button>
                  <button type="button" data-story-lang="te"
                    class="px-3 py-1 rounded-lg ${storyLang === 'te' ? 'bg-espresso text-white' : 'text-muted'}">
                    తెలుగు
                  </button>
                </div>
              </div>

              <div class="text-xs font-semibold uppercase tracking-wider text-terracotta">${esc(localizeRegion(gem.region))}</div>
              <h1 class="font-display font-bold text-3xl text-espresso mt-1 ${store.lang === 'te' ? 'font-telugu' : ''}">${esc(titleMain)}</h1>
              ${
                store.lang === 'te'
                  ? `<div class="text-sm font-medium text-muted mt-0.5">${esc(gem.name)}</div>`
                  : gem.name_te
                    ? `<div class="font-telugu text-base font-semibold text-forest mt-0.5">${esc(gem.name_te)}</div>`
                    : ''
              }

              <p class="mt-3 text-base font-medium text-espresso/90 ${store.lang === 'te' ? 'font-telugu' : ''}">${esc(gemSummary(gem))}</p>

              <div class="mt-4 pt-4 border-t border-[#EDE6DB]">
                <h2 class="text-xs font-bold uppercase tracking-wider text-muted mb-2">
                  ${esc(storyLang === 'te' ? 'స్థానిక కథనం & చరిత్ర (తెలుగు)' : t('storyHeading'))}
                </h2>
                <p class="${storyLang === 'te' ? 'font-telugu text-base' : 'text-sm sm:text-base leading-relaxed'} text-espresso/90">
                  ${esc(storyLang === 'te' ? gem.story_te || gem.story : gem.story)}
                </p>
              </div>

              <div class="mt-5 flex flex-wrap gap-1.5">
                ${(gem.tags || [])
                  .map((tItem) => `<span class="px-2.5 py-1 rounded-full bg-sand text-xs text-muted font-medium">#${esc(tItem)}</span>`)
                  .join('')}
              </div>

              ${
                Array.isArray(gem.things_to_do) && gem.things_to_do.length > 0
                  ? `<div class="mt-5 pt-4 border-t border-[#EDE6DB]">
                      <div class="text-xs font-bold uppercase tracking-wider text-forest mb-2">${esc(t('thingsToDoLabel'))}</div>
                      <div class="flex flex-wrap gap-2">
                        ${gem.things_to_do.map((act) => `<span class="px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-semibold text-forest">✓ ${esc(act)}</span>`).join('')}
                      </div>
                    </div>`
                  : ''
              }

              <div class="mt-5 pt-4 border-t border-[#EDE6DB] grid grid-cols-3 gap-3 text-center">
                <div class="rounded-xl bg-cream border border-[#EDE6DB] p-2.5">
                  <div class="text-[11px] text-muted">${esc(t('safetyScoreLabel'))}</div>
                  <div class="font-bold text-sm text-forest mt-0.5">${esc(gem.safety_score || 92)}/100</div>
                </div>
                <div class="rounded-xl bg-cream border border-[#EDE6DB] p-2.5">
                  <div class="text-[11px] text-muted">${esc(t('crowdLabel'))}</div>
                  <div class="font-bold text-sm text-espresso mt-0.5">${esc(gem.crowd_level || 'Low')}</div>
                </div>
                <div class="rounded-xl bg-cream border border-[#EDE6DB] p-2.5">
                  <div class="text-[11px] text-muted">${esc(t('ratingLabel'))}</div>
                  <div class="font-bold text-sm text-terracotta mt-0.5">★ ${esc(gem.avg_rating || 4.7)}</div>
                </div>
              </div>
            </div>

            <!-- Traveller Reviews & Star Rating -->
            <div class="bg-white rounded-3xl border border-[#E7E0D5] p-6 shadow-xs space-y-5">
              <div class="flex items-center justify-between">
                <h2 class="font-display font-bold text-xl text-espresso">${esc(t('reviewsHeading'))} (${reviews.length})</h2>
                <span class="text-xs font-bold text-terracotta">★ ${esc(gem.avg_rating || 4.7)} / 5</span>
              </div>

              ${
                reviews.length === 0
                  ? `<p class="text-sm text-muted">${esc(t('noReviewsYet'))}</p>`
                  : `<div class="space-y-3">
                      ${reviews
                        .map(
                          (r) => `
                          <div class="rounded-2xl bg-cream border border-[#EDE6DB] p-3.5">
                            <div class="flex items-center justify-between text-xs">
                              <strong class="text-espresso">${esc(r.author)}</strong>
                              <span class="font-bold text-ochre">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</span>
                            </div>
                            <p class="text-sm text-muted mt-1">${esc(r.comment)}</p>
                          </div>`
                        )
                        .join('')}
                    </div>`
              }

              <form id="review-form" class="pt-4 border-t border-[#EDE6DB] space-y-3">
                <div class="text-xs font-bold uppercase tracking-wider text-espresso">${esc(t('writeReviewTitle'))}</div>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input name="author" required value="${esc(store.user?.name || '')}" placeholder="${esc(t('yourNamePh'))}"
                    class="px-3.5 py-2 rounded-xl bg-cream border border-[#E2D9CC] text-sm" />
                  <select name="rating" class="px-3.5 py-2 rounded-xl bg-cream border border-[#E2D9CC] text-sm">
                    <option value="5">★★★★★ (5/5)</option>
                    <option value="4">★★★★☆ (4/5)</option>
                    <option value="3">★★★☆☆ (3/5)</option>
                    <option value="2">★★☆☆☆ (2/5)</option>
                    <option value="1">★☆☆☆☆ (1/5)</option>
                  </select>
                </div>
                <textarea name="comment" rows="2" required placeholder="${esc(t('reviewCommentPh'))}"
                  class="w-full px-3.5 py-2 rounded-xl bg-cream border border-[#E2D9CC] text-sm"></textarea>
                <button type="submit" class="px-4 py-2 rounded-xl bg-espresso hover:bg-terracotta text-white text-xs font-semibold transition">
                  ${esc(t('submitReviewBtn'))}
                </button>
              </form>
            </div>
          </div>

          <div class="lg:col-span-5 space-y-5">
            <div id="detail-weather-box">${renderWeatherWidget(weatherData)}</div>

            <div class="bg-white rounded-3xl border border-[#E7E0D5] p-5 shadow-xs space-y-4">
              <h2 class="font-display font-bold text-xl text-espresso">${esc(t('practicalInfo'))}</h2>
              <div class="grid grid-cols-3 gap-3 text-center">
                <div class="p-3 rounded-2xl bg-cream border border-[#EDE6DB]">
                  <div class="text-[11px] text-muted">${esc(t('bestSeason'))}</div>
                  <div class="font-bold text-sm text-espresso mt-0.5">${esc(gem.best_season)}</div>
                </div>
                <div class="p-3 rounded-2xl bg-cream border border-[#EDE6DB]">
                  <div class="text-[11px] text-muted">${esc(t('budgetLabel'))}</div>
                  <div class="font-bold text-sm text-forest mt-0.5">₹${esc(gem.budget_per_day)}${esc(t('perDay'))}</div>
                </div>
                <div class="p-3 rounded-2xl bg-cream border border-[#EDE6DB]">
                  <div class="text-[11px] text-muted">${esc(t('durationLabel'))}</div>
                  <div class="font-bold text-sm text-espresso mt-0.5">${esc(gem.duration_hours)} ${esc(t('hrs'))}</div>
                </div>
              </div>

              <div>
                <div class="text-xs font-bold uppercase tracking-wider text-muted mb-1">${esc(t('howToReach'))}</div>
                <p class="text-sm text-espresso leading-relaxed">${esc(gem.how_to_reach)}</p>
              </div>

              <div class="rounded-2xl overflow-hidden border border-[#E2D9CC]">
                <div id="detail-mini-map" class="w-full h-48"></div>
              </div>
              <div class="text-[11px] text-muted flex flex-wrap items-center justify-between gap-2">
                <span>${gem.lat.toFixed(4)}° N, ${gem.lng.toFixed(4)}° E</span>
                <div class="flex items-center gap-3">
                  <button id="copy-coords-btn" type="button" class="text-forest font-semibold hover:underline">${esc(t('copyCoords'))}</button>
                  <a target="_blank" rel="noopener" href="https://www.openstreetmap.org/?mlat=${gem.lat}&mlon=${gem.lng}#map=14/${gem.lat}/${gem.lng}"
                    class="text-terracotta font-semibold hover:underline">${esc(t('openInOsm'))}</a>
                </div>
              </div>
            </div>

            <div class="bg-forest text-white rounded-3xl p-6 shadow-xs">
              <div class="text-xs font-semibold uppercase tracking-wider text-white/75">${esc(t('localImpactDir'))}</div>
              <h2 class="font-display font-bold text-xl mt-1">${esc(t('whoBenefits'))}</h2>
              <p class="text-xs text-white/80 mt-1 mb-4">${esc(t('whoBenefitsSub'))}</p>
              <div class="space-y-3">
                ${(gem.local_support || [])
                  .map(
                    (s) => `
                    <div class="rounded-2xl bg-white/10 border border-white/15 p-3.5">
                      <div class="flex items-center justify-between gap-2">
                        <span class="font-semibold text-sm">${esc(s.name)}</span>
                        <span class="px-2 py-0.5 rounded-full bg-white/20 text-[10px] font-bold uppercase">${esc(s.type)}</span>
                      </div>
                      ${s.note ? `<p class="text-xs text-white/85 mt-1">${esc(s.note)}</p>` : ''}
                      <div class="text-xs text-amber-200 mt-1.5 font-medium">${esc(s.contact || 'Available on site')}</div>
                    </div>`
                  )
                  .join('')}
              </div>
            </div>
          </div>
        </div>

        ${
          nearby_stays.length > 0
            ? `<div class="mt-12">
                <div class="flex items-center justify-between mb-4">
                  <h2 class="font-display font-bold text-2xl text-espresso">${esc(t('nearbyStaysTitle'))}</h2>
                  <a href="#/stays" class="text-sm font-semibold text-terracotta hover:underline">${esc(t('viewAllStays'))}</a>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  ${nearby_stays.map((st) => renderStayCard(st)).join('')}
                </div>
              </div>`
            : ''
        }

        <div class="mt-12">
          <h2 class="font-display font-bold text-2xl text-espresso mb-4">${esc(t('nearbyVerified'))}</h2>
          <div id="nearby-grid" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            ${nearby.map((n) => renderGemCard(n, { distanceKm: n.distance_km })).join('')}
          </div>
        </div>
      </section>
    `;

    mountLeafletMap('detail-mini-map', { center: [gem.lat, gem.lng], zoom: 11, gems: [gem] });

    root.querySelectorAll('[data-thumb-idx]').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeImg = Number(btn.getAttribute('data-thumb-idx'));
        draw();
      });
    });
    root.querySelectorAll('[data-story-lang]').forEach((btn) => {
      btn.addEventListener('click', () => {
        storyLang = btn.getAttribute('data-story-lang');
        draw();
      });
    });
    document.getElementById('detail-save-btn').addEventListener('click', () => {
      const nowSaved = store.toggleSaved(gem.id);
      showToast(nowSaved ? t('savedToTrip') : t('saveToTrip'), 'info');
      draw();
    });
    document.getElementById('detail-share-btn').addEventListener('click', () => openShareModal(gem));
    document.getElementById('detail-offline-btn').addEventListener('click', () => {
      const content = [
        `UNTOLD TRAILS — OFFLINE PLACE CARD`,
        `Name: ${gem.name} (${gem.name_te || ''})`,
        `Region: ${gem.region}`,
        `Coordinates: ${gem.lat}, ${gem.lng}`,
        `Best Season: ${gem.best_season} | Est. Budget: INR ${gem.budget_per_day}/day`,
        `How to Reach: ${gem.how_to_reach}`,
        ``,
        `Story:`,
        gem.story,
        ``,
        `Local Support Contacts:`,
        ...(gem.local_support || []).map((s) => `  - ${s.name} (${s.type}): ${s.contact}`),
      ].join('\n');
      downloadOfflineTextPack(`${gem.id}-offline-card.txt`, content);
      showToast('Offline place card saved!');
    });
    document.getElementById('review-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      try {
        const res = await api.addReview(gem.id, {
          author: fd.get('author'),
          rating: Number(fd.get('rating')) || 5,
          comment: fd.get('comment'),
        });
        reviews = [res.review, ...reviews];
        showToast(res.message);
        draw();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
    const coordsBtn = document.getElementById('copy-coords-btn');
    if (coordsBtn) {
      coordsBtn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(`${gem.lat.toFixed(5)}, ${gem.lng.toFixed(5)}`);
          showToast(t('coordsCopied'));
        } catch {
          showToast(`${gem.lat.toFixed(5)}, ${gem.lng.toFixed(5)}`, 'info');
        }
      });
    }
    attachSaveButtons(root, draw);
    hydrateCardWeather(root);
  }

  draw();

  api
    .getGemWeather(gem.id)
    .then((w) => {
      weatherData = w;
      store.weatherMap[gem.id] = w;
      const box = document.getElementById('detail-weather-box');
      if (box) box.innerHTML = renderWeatherWidget(w);
    })
    .catch(() => {});
}

/* -------------------------------------------------------------------------- */
/* 4. AI TRIP PLANNER & SAVED TRIP PAGE                                       */
/* -------------------------------------------------------------------------- */
export async function renderPlannerPage(root, queryParams) {
  const initialTab = queryParams.get('tab') === 'saved' ? 'saved' : 'ai';
  let activeTab = initialTab;
  let lastPlan = null;

  const { gems: allVerified } = await api.listGems();

  function renderTabs() {
    const savedGems = allVerified.filter((g) => store.isSaved(g.id));

    root.innerHTML = `
      <section class="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
          <div>
            <div class="text-xs font-bold uppercase tracking-wider text-forest">${esc(t('plannerKicker'))}</div>
            <h1 class="font-display font-bold text-3xl text-espresso mt-1">${esc(t('plannerTitle'))}</h1>
            <p class="text-sm text-muted mt-1">${esc(t('plannerSub'))}</p>
          </div>
          <div class="inline-flex rounded-xl border border-[#E2D9CC] p-1 bg-white">
            <button type="button" id="tab-ai" class="px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold ${
              activeTab === 'ai' ? 'bg-espresso text-white' : 'text-muted hover:text-espresso'
            }">
              ${esc(t('tabAiPlanner'))}
            </button>
            <button type="button" id="tab-saved" class="px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold ${
              activeTab === 'saved' ? 'bg-forest text-white' : 'text-muted hover:text-espresso'
            }">
              ${esc(t('tabSavedTrip', { count: savedGems.length }))}
            </button>
          </div>
        </div>

        <div id="planner-body"></div>
      </section>
    `;

    document.getElementById('tab-ai').addEventListener('click', () => {
      activeTab = 'ai';
      renderTabs();
    });
    document.getElementById('tab-saved').addEventListener('click', () => {
      activeTab = 'saved';
      renderTabs();
    });

    const body = document.getElementById('planner-body');

    if (activeTab === 'saved') {
      if (savedGems.length === 0) {
        body.innerHTML = `
          <div class="bg-white rounded-3xl border border-[#E7E0D5] p-10 text-center">
            <h2 class="font-display font-bold text-xl text-espresso">${esc(t('savedEmptyTitle'))}</h2>
            <p class="text-sm text-muted mt-1">${esc(t('savedEmptyDesc'))}</p>
            <a href="#/explore" class="inline-block mt-4 px-5 py-2.5 rounded-xl bg-terracotta text-white text-sm font-semibold">${esc(t('exploreHiddenGems'))}</a>
          </div>`;
      } else {
        const totalDailyEst = savedGems.reduce((acc, g) => acc + (g.budget_per_day || 0), 0);
        const totalHours = savedGems.reduce((acc, g) => acc + (g.duration_hours || 0), 0);
        body.innerHTML = `
          <div class="flex flex-wrap items-center justify-between gap-3 mb-4 bg-white rounded-2xl border border-[#E7E0D5] p-4">
            <div class="text-sm text-muted">
              ${esc(t('savedSummary', { count: savedGems.length, budget: totalDailyEst, hours: totalHours.toFixed(1) }))}
            </div>
            <div class="flex items-center gap-3">
              <button id="plan-from-saved-btn" type="button" class="px-3.5 py-1.5 rounded-xl bg-terracotta text-white text-xs font-semibold hover:bg-terracottaDark transition">
                ${esc(t('generateFromSaved'))}
              </button>
              <button id="clear-saved-btn" class="text-xs font-semibold text-red-700 hover:underline">${esc(t('clearAll'))}</button>
            </div>
          </div>
          <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div class="lg:col-span-5">
              <div class="rounded-2xl overflow-hidden border border-[#E2D9CC]"><div id="saved-map" class="w-full h-[380px]"></div></div>
            </div>
            <div class="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
              ${savedGems.map((g) => renderGemCard(g)).join('')}
            </div>
          </div>`;
        mountLeafletMap('saved-map', { gems: savedGems });
        attachSaveButtons(body, renderTabs);
        hydrateCardWeather(body);
        document.getElementById('plan-from-saved-btn').addEventListener('click', () => {
          activeTab = 'ai';
          renderTabs();
        });
        document.getElementById('clear-saved-btn').addEventListener('click', () => {
          store.clearSaved();
          renderTabs();
        });
      }
      return;
    }

    body.innerHTML = `
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <form id="ai-plan-form" class="lg:col-span-4 bg-white rounded-3xl border border-[#E7E0D5] p-6 shadow-xs space-y-4">
          <h2 class="font-display font-bold text-xl text-espresso">${esc(t('tripPrefs'))}</h2>

          <div>
            <label class="block text-xs font-semibold text-muted mb-1">${esc(t('startingCity'))}</label>
            <select name="city" class="w-full px-3.5 py-2.5 rounded-xl bg-cream border border-[#E2D9CC] text-sm">
              <option value="Hyderabad">${esc(t('cityHyderabad'))}</option>
              <option value="Warangal">${esc(t('cityWarangal'))}</option>
              <option value="Vijayawada">${esc(t('cityVijayawada'))}</option>
              <option value="Rajahmundry">${esc(t('cityRajahmundry'))}</option>
              <option value="Kakinada">${esc(t('cityKakinada'))}</option>
              <option value="Visakhapatnam">${esc(t('cityVisakhapatnam'))}</option>
              <option value="Kurnool">${esc(t('cityKurnool'))}</option>
              <option value="Tirupati">${esc(t('cityTirupati'))}</option>
            </select>
          </div>

          <div class="grid grid-cols-3 gap-2.5">
            <div>
              <label class="block text-xs font-semibold text-muted mb-1">${esc(t('daysLabel'))}</label>
              <input name="days" type="number" min="1" max="5" value="2"
                class="w-full px-3 py-2.5 rounded-xl bg-cream border border-[#E2D9CC] text-sm" />
            </div>
            <div>
              <label class="block text-xs font-semibold text-muted mb-1">${esc(t('budgetPerDayLabel'))}</label>
              <input name="budget" type="number" min="400" max="10000" step="100" value="1200"
                class="w-full px-3 py-2.5 rounded-xl bg-cream border border-[#E2D9CC] text-sm" />
            </div>
            <div>
              <label class="block text-xs font-semibold text-muted mb-1">${esc(t('travellersLabel'))}</label>
              <input name="travellers" type="number" min="1" max="12" value="2"
                class="w-full px-3 py-2.5 rounded-xl bg-cream border border-[#E2D9CC] text-sm" />
            </div>
          </div>

          <div>
            <label class="block text-xs font-semibold text-muted mb-1.5">${esc(t('interestsLabel'))}</label>
            <div class="flex flex-wrap gap-2">
              ${CATEGORIES.filter((c) => c.id !== 'all')
                .map(
                  (c) => `
                  <label class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#E2D9CC] bg-cream text-xs font-semibold cursor-pointer">
                    <input type="checkbox" name="interests" value="${c.id}" checked class="accent-[#C84B31]" />
                    <span>${esc(store.lang === 'te' ? c.label_te : c.label)}</span>
                  </label>`
                )
                .join('')}
            </div>
          </div>

          <div>
            <label class="block text-xs font-semibold text-muted mb-1">${esc(t('travelStyleLabel'))}</label>
            <select name="travel_style" class="w-full px-3.5 py-2.5 rounded-xl bg-cream border border-[#E2D9CC] text-sm">
              <option value="cultural & nature">${esc(t('styleBalanced'))}</option>
              <option value="slow village & craft immersion">${esc(t('styleSlow'))}</option>
              <option value="weekend roadtrip">${esc(t('styleRoadtrip'))}</option>
              <option value="culinary & heritage">${esc(t('styleCulinary'))}</option>
            </select>
          </div>

          <button id="generate-plan-btn" type="submit"
            class="w-full py-3 rounded-xl bg-terracotta hover:bg-terracottaDark text-white font-semibold text-sm shadow-xs transition">
            ${esc(t('generateBtn'))}
          </button>
        </form>

        <div id="plan-results" class="lg:col-span-8">
          ${lastPlan ? renderPlanMarkup(lastPlan) : renderEmptyPlanState()}
        </div>
      </div>
    `;

    if (lastPlan) {
      mountLeafletMap('planner-route-map', { dayRoutes: lastPlan.days });
      hydratePlanWeather(lastPlan);
      wirePlanActions(lastPlan);
    }

    async function runPlanSubmit(fd) {
      const interests = fd.getAll('interests');
      const btn = document.getElementById('generate-plan-btn');
      btn.disabled = true;
      btn.textContent = t('buildingRoute');

      try {
        lastPlan = await api.generatePlan({
          city: fd.get('city'),
          days: Number(fd.get('days')) || 2,
          budget: Number(fd.get('budget')) || 1200,
          travellers: Number(fd.get('travellers')) || 2,
          interests,
          travel_style: fd.get('travel_style'),
          lang: store.lang,
        });
        document.getElementById('plan-results').innerHTML = renderPlanMarkup(lastPlan);
        mountLeafletMap('planner-route-map', { dayRoutes: lastPlan.days });
        hydratePlanWeather(lastPlan);
        wirePlanActions(lastPlan);
        showToast(t('planBuiltToast'));
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = t('generateBtn');
      }
    }

    document.getElementById('ai-plan-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      await runPlanSubmit(new FormData(e.target));
    });
  }

  function hydratePlanWeather(plan) {
    (plan.days || []).forEach((d) => {
      const anchor = (d.gems || [])[0];
      if (!anchor) return;
      api
        .getGemWeather(anchor.id)
        .then((w) => {
          store.weatherMap[anchor.id] = w;
          const slot = document.querySelector(`[data-day-weather="${d.day}"]`);
          if (slot) slot.innerHTML = renderWeatherWidget(w, { compact: true });
        })
        .catch(() => {});
    });
  }

  function wirePlanActions(plan) {
    const saveStopsBtn = document.getElementById('save-all-plan-btn');
    if (saveStopsBtn) {
      saveStopsBtn.addEventListener('click', () => {
        let added = 0;
        (plan.days || []).forEach((d) => {
          (d.gems || []).forEach((g) => {
            if (!store.isSaved(g.id)) {
              store.toggleSaved(g.id);
              added++;
            }
          });
        });
        showToast(added > 0 ? `Saved ${added} stops to My Trip!` : 'All stops are already in My Trip.');
      });
    }

    const regenBtn = document.getElementById('regen-plan-btn');
    if (regenBtn) {
      regenBtn.addEventListener('click', () => {
        const form = document.getElementById('ai-plan-form');
        if (form) form.requestSubmit();
      });
    }

    const saveTripBtn = document.getElementById('save-trip-profile-btn');
    if (saveTripBtn) {
      saveTripBtn.addEventListener('click', async () => {
        if (!store.isLoggedIn()) {
          openAuthModal('login');
          return;
        }
        const gemIds = (plan.days || []).flatMap((d) => d.gem_ids || []);
        try {
          const res = await api.saveTrip({
            title: `${plan.city} ${plan.days.length}-Day Untold Trail`,
            city: plan.city,
            days: plan.days.length,
            budget: plan.budget_per_day,
            travellers: plan.travellers || 2,
            gem_ids: gemIds,
          });
          store.setUser(res.user);
          showToast(t('tripSavedToast'));
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    }

    const dlBtn = document.getElementById('dl-plan-offline-btn');
    if (dlBtn) {
      dlBtn.addEventListener('click', () => {
        const lines = [
          `UNTOLD TRAILS — OFFLINE ITINERARY (${plan.city})`,
          `Days: ${plan.days.length} | Travellers: ${plan.travellers || 2} | Est. Group Budget: INR ${plan.estimated_group_total || plan.budget_per_day * plan.days.length}`,
          '',
          ...(plan.days || []).flatMap((d) => [
            `DAY ${d.day}: ${d.why}`,
            ...(d.gems || []).map((g, idx) => `  ${idx + 1}. ${g.name} (${g.region}) — ${g.lat}, ${g.lng} | Reach: ${g.how_to_reach}`),
            `  Tip: ${d.tip}`,
            '',
          ]),
          'SAFETY TIPS:',
          ...(plan.safety_tips || []).map((st) => `  - ${st}`),
          '',
          'EMERGENCY HELPLINES: 112 (National) | 100 (Police) | 108 (Ambulance) | 1363 (Tourist)',
        ];
        downloadOfflineTextPack(`untold-trails-${plan.city.toLowerCase()}-itinerary.txt`, lines.join('\n'));
        showToast('Offline itinerary downloaded!');
      });
    }
  }

  function renderEmptyPlanState() {
    return `
      <div class="bg-white rounded-3xl border border-[#E7E0D5] p-10 text-center">
        <h3 class="font-display font-bold text-xl text-espresso">${esc(t('readyMapTitle'))}</h3>
        <p class="text-sm text-muted max-w-md mx-auto mt-2">${esc(t('readyMapDesc'))}</p>
      </div>`;
  }

  function renderPlanMarkup(plan) {
    const totalStops = (plan.days || []).reduce((acc, d) => acc + (d.gems || []).length, 0);
    const recStays = plan.recommended_stays || [];
    const recGuides = plan.recommended_guides || [];
    const safetyTips = plan.safety_tips || [];
    return `
      <div class="space-y-5 ut-fade-in">
        <div class="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 space-y-3 text-xs">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="space-y-0.5">
              <div class="font-semibold text-forest">${esc(t('groundedBadge', { city: plan.city }))}</div>
              <div class="text-emerald-900/80">
                ${esc(t('planMetaSummary', { days: plan.days.length, stops: totalStops, mode: plan.planner_mode }))}
                ${plan.estimated_group_total ? ` • ${esc(t('groupBudgetEst', { total: plan.estimated_group_total }))}` : ''}
              </div>
            </div>
            <button id="regen-plan-btn" type="button" class="px-3 py-1.5 rounded-xl bg-white border border-emerald-300 text-forest font-semibold hover:bg-emerald-100">
              ↻ ${esc(t('regenerateBtn'))}
            </button>
          </div>
          <div class="flex flex-wrap gap-2">
            <button id="save-all-plan-btn" type="button"
              class="px-3.5 py-2 rounded-xl bg-forest hover:bg-forestLight text-white font-semibold transition">
              ${esc(t('saveAllStops'))}
            </button>
            <button id="save-trip-profile-btn" type="button"
              class="px-3.5 py-2 rounded-xl bg-espresso hover:bg-terracotta text-white font-semibold transition">
              ${esc(t('saveTripAccountBtn'))}
            </button>
            <button id="dl-plan-offline-btn" type="button"
              class="px-3.5 py-2 rounded-xl bg-white border border-[#E2D9CC] text-espresso font-semibold hover:bg-sand transition">
              📥 ${esc(t('downloadOfflinePackBtn'))}
            </button>
          </div>
        </div>

        <div class="rounded-2xl overflow-hidden border border-[#E2D9CC] shadow-xs">
          <div id="planner-route-map" class="w-full h-[320px]"></div>
        </div>

        <div class="space-y-4">
          ${plan.days
            .map(
              (d) => `
              <div class="bg-white rounded-3xl border border-[#E7E0D5] p-5 shadow-xs">
                <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div class="flex items-center gap-2.5">
                    <span class="px-3 py-1 rounded-full bg-terracotta text-white text-xs font-bold">${esc(t('dayLabel', { day: d.day }))}</span>
                    <span class="text-xs font-semibold text-muted">${esc(t('verifiedStops', { count: d.gems.length }))}</span>
                  </div>
                  <div data-day-weather="${d.day}">
                    ${renderWeatherWidget(null, { compact: true })}
                  </div>
                </div>
                <p class="text-sm text-espresso/90 mb-3">${esc(d.why)}</p>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  ${d.gems
                    .map(
                      (g, idx) => `
                      <a href="#/gem/${esc(g.id)}" class="flex gap-3 p-3 rounded-2xl bg-cream border border-[#EDE6DB] hover:border-terracotta transition">
                        <img src="${esc(g.images[0])}" alt="" class="w-20 h-20 rounded-xl object-cover shrink-0" />
                        <div class="min-w-0">
                          <div class="text-[10px] font-bold uppercase text-terracotta">${esc(t('stopLabel', { num: idx + 1 }))} • ${esc(g.category)}</div>
                          <div class="font-display font-bold text-sm text-espresso truncate">${esc(store.lang === 'te' && g.name_te ? g.name_te : g.name)}</div>
                          <div class="text-xs text-muted truncate">${esc(g.region)}</div>
                          <div class="text-[11px] font-semibold text-forest mt-1">₹${esc(g.budget_per_day)}${esc(t('perDay'))} • ${esc(g.duration_hours)} ${esc(t('hrs'))}</div>
                        </div>
                      </a>`
                    )
                    .join('')}
                </div>
                <div class="mt-3 pt-3 border-t border-[#EDE6DB] text-xs text-muted">
                  <strong>${esc(t('tipLabel'))}</strong> ${esc(d.tip)}
                </div>
              </div>`
            )
            .join('')}
        </div>

        ${
          safetyTips.length > 0
            ? `<div class="bg-white rounded-2xl border border-[#E7E0D5] p-4 space-y-2">
                <div class="text-xs font-bold uppercase tracking-wider text-forest">🛡️ ${esc(t('plannerSafetyTitle'))}</div>
                <ul class="space-y-1 text-xs text-muted">
                  ${safetyTips.map((st) => `<li>• ${esc(st)}</li>`).join('')}
                </ul>
              </div>`
            : ''
        }

        ${
          recStays.length > 0
            ? `<div class="space-y-3">
                <div class="flex items-center justify-between">
                  <h3 class="font-display font-bold text-lg text-espresso">${esc(t('plannerRecStays'))}</h3>
                  <a href="#/stays" class="text-xs font-semibold text-terracotta hover:underline">${esc(t('viewAllStays'))}</a>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  ${recStays.map((st) => renderStayCard(st)).join('')}
                </div>
              </div>`
            : ''
        }

        ${
          recGuides.length > 0
            ? `<div class="bg-white rounded-2xl border border-[#E7E0D5] p-4 space-y-3">
                <div class="flex items-center justify-between">
                  <h3 class="font-display font-bold text-lg text-espresso">${esc(t('plannerRecGuides'))}</h3>
                  <a href="#/guides" class="text-xs font-semibold text-terracotta hover:underline">${esc(t('navGuides'))} →</a>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  ${recGuides
                    .map(
                      (g) => `
                      <a href="#/guides" class="rounded-xl bg-cream border border-[#EDE6DB] p-3 hover:border-terracotta transition">
                        <div class="font-bold text-sm text-espresso">${esc(store.lang === 'te' && g.name_te ? g.name_te : g.name)}</div>
                        <div class="text-xs text-terracotta">${esc(localizeRegion(g.region))}</div>
                        <div class="text-[11px] text-muted mt-1">${esc((g.languages || []).join(', '))} • ₹${esc(g.rate_per_day)}${esc(t('perDay'))}</div>
                      </a>`
                    )
                    .join('')}
                </div>
              </div>`
            : ''
        }

        <div class="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-xl p-3">
          ${esc(plan.disclaimer)}
        </div>
      </div>`;
  }

  renderTabs();
}

/* -------------------------------------------------------------------------- */
/* 5. SUBMIT A GEM PAGE                                                       */
/* -------------------------------------------------------------------------- */
export async function renderSubmitPage(root) {
  let pickedLat = 17.65;
  let pickedLng = 79.45;
  const defaultName = store.user ? store.user.name : '';

  root.innerHTML = `
    <section class="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <div class="mb-6">
        <div class="text-xs font-bold uppercase tracking-wider text-terracotta">${esc(t('submitKicker'))}</div>
        <h1 class="font-display font-bold text-3xl text-espresso mt-1">${esc(t('submitTitle'))}</h1>
        <p class="text-sm text-muted mt-1">${esc(t('submitSub'))}</p>
      </div>

      <div id="submit-success-banner" class="hidden mb-6 bg-emerald-50 border border-emerald-300 rounded-2xl p-5">
        <h2 class="font-display font-bold text-lg text-forest">${esc(t('submitReceived'))}</h2>
        <p class="text-sm text-emerald-900 mt-1" id="submit-success-msg"></p>
        <div class="mt-3 flex gap-3">
          <a href="#/admin" class="px-4 py-2 rounded-xl bg-forest text-white text-xs font-semibold">${esc(t('openAdminQueue'))}</a>
          <button id="submit-another-btn" type="button" class="px-4 py-2 rounded-xl border border-forest text-forest text-xs font-semibold">${esc(t('submitAnother'))}</button>
        </div>
      </div>

      <form id="submit-gem-form" class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div class="lg:col-span-7 bg-white rounded-3xl border border-[#E7E0D5] p-6 shadow-xs space-y-4">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-semibold text-muted mb-1">${esc(t('placeNameLabel'))}</label>
              <input name="name" required placeholder="${esc(t('placeNamePh'))}"
                class="w-full px-3.5 py-2.5 rounded-xl bg-cream border border-[#E2D9CC] text-sm" />
            </div>
            <div>
              <label class="block text-xs font-semibold text-muted mb-1">${esc(t('categoryLabel'))}</label>
              <select name="category" required class="w-full px-3.5 py-2.5 rounded-xl bg-cream border border-[#E2D9CC] text-sm">
                ${CATEGORIES.filter((c) => c.id !== 'all')
                  .map((c) => `<option value="${c.id}">${esc(store.lang === 'te' ? c.label_te : c.label)}</option>`)
                  .join('')}
              </select>
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-semibold text-muted mb-1">${esc(t('stateLabel'))}</label>
              <select name="state" class="w-full px-3.5 py-2.5 rounded-xl bg-cream border border-[#E2D9CC] text-sm">
                <option value="Telangana">${esc(t('stateTelangana'))}</option>
                <option value="Andhra Pradesh">${esc(t('stateAndhra'))}</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-semibold text-muted mb-1">${esc(t('districtLabel'))}</label>
              <input name="region" required placeholder="${esc(t('districtPh'))}"
                class="w-full px-3.5 py-2.5 rounded-xl bg-cream border border-[#E2D9CC] text-sm" />
            </div>
          </div>

          <div>
            <label class="block text-xs font-semibold text-muted mb-1">${esc(t('hookLabel'))}</label>
            <input name="summary" required placeholder="${esc(t('hookPh'))}"
              class="w-full px-3.5 py-2.5 rounded-xl bg-cream border border-[#E2D9CC] text-sm" />
          </div>

          <div>
            <label class="block text-xs font-semibold text-muted mb-1">${esc(t('storyLabel'))}</label>
            <textarea name="story" rows="3" required placeholder="${esc(t('storyPh'))}"
              class="w-full px-3.5 py-2.5 rounded-xl bg-cream border border-[#E2D9CC] text-sm"></textarea>
          </div>

          <div>
            <label class="block text-xs font-semibold text-muted mb-1">${esc(t('teluguStoryLabel'))}</label>
            <textarea name="story_te" rows="2" placeholder="ఐచ్ఛికం: స్థానిక కథనాన్ని తెలుగులో వ్రాయండి..."
              class="w-full px-3.5 py-2.5 rounded-xl bg-cream border border-[#E2D9CC] text-sm font-telugu"></textarea>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label class="block text-xs font-semibold text-muted mb-1">${esc(t('bestSeasonInput'))}</label>
              <input name="best_season" value="Oct-Feb" class="w-full px-3 py-2 rounded-xl bg-cream border border-[#E2D9CC] text-sm" />
            </div>
            <div>
              <label class="block text-xs font-semibold text-muted mb-1">${esc(t('budgetPerDayLabel'))}</label>
              <input name="budget_per_day" type="number" value="800" min="100" class="w-full px-3 py-2 rounded-xl bg-cream border border-[#E2D9CC] text-sm" />
            </div>
            <div>
              <label class="block text-xs font-semibold text-muted mb-1">${esc(t('durationHrsLabel'))}</label>
              <input name="duration_hours" type="number" step="0.5" value="3" class="w-full px-3 py-2 rounded-xl bg-cream border border-[#E2D9CC] text-sm" />
            </div>
          </div>

          <div>
            <label class="block text-xs font-semibold text-muted mb-1">${esc(t('howToReachLabel'))}</label>
            <input name="how_to_reach" required placeholder="${esc(t('howToReachPh'))}"
              class="w-full px-3.5 py-2.5 rounded-xl bg-cream border border-[#E2D9CC] text-sm" />
          </div>

          <div class="pt-3 border-t border-[#EDE6DB]">
            <div class="text-xs font-bold uppercase text-forest mb-2">${esc(t('localImpactLabel'))}</div>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <select name="support_type" class="px-3 py-2 rounded-xl bg-cream border border-[#E2D9CC] text-sm">
                <option value="guide">${esc(t('supportGuide'))}</option>
                <option value="stay">${esc(t('supportStay'))}</option>
                <option value="food">${esc(t('supportFood'))}</option>
                <option value="craft">${esc(t('supportCraft'))}</option>
              </select>
              <input name="support_name" placeholder="${esc(t('supportNamePh'))}" class="px-3 py-2 rounded-xl bg-cream border border-[#E2D9CC] text-sm" />
              <input name="support_contact" placeholder="${esc(t('supportContactPh'))}" class="px-3 py-2 rounded-xl bg-cream border border-[#E2D9CC] text-sm" />
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-semibold text-muted mb-1">${esc(t('tagsLabel'))}</label>
              <input name="tags" placeholder="${esc(t('tagsPh'))}"
                class="w-full px-3.5 py-2.5 rounded-xl bg-cream border border-[#E2D9CC] text-sm" />
            </div>
            <div>
              <label class="block text-xs font-semibold text-muted mb-1">${esc(t('yourNameLabel'))}</label>
              <input name="submitted_by" value="${esc(defaultName)}" placeholder="${esc(t('yourNamePh'))}"
                class="w-full px-3.5 py-2.5 rounded-xl bg-cream border border-[#E2D9CC] text-sm" />
            </div>
          </div>

          <div>
            <label class="block text-xs font-semibold text-muted mb-1">${esc(t('uploadPhotoLabel'))}</label>
            <input id="submit-photo-input" name="photo" type="file" accept="image/*"
              class="w-full text-xs text-muted file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-sand file:text-espresso file:font-semibold" />
          </div>

          <button id="submit-gem-btn" type="submit"
            class="w-full py-3.5 rounded-xl bg-terracotta hover:bg-terracottaDark text-white font-semibold text-sm shadow-xs transition">
            ${esc(t('submitBtn'))}
          </button>
        </div>

        <div class="lg:col-span-5 space-y-4">
          <div class="bg-white rounded-3xl border border-[#E7E0D5] p-5 shadow-xs">
            <div class="flex items-center justify-between gap-2">
              <h2 class="font-display font-bold text-lg text-espresso">${esc(t('pinLocationTitle'))}</h2>
              <button id="use-my-gps" type="button"
                class="px-3 py-1 rounded-xl border border-[#E2D9CC] bg-cream hover:bg-sand text-xs font-semibold text-forest transition">
                ${esc(t('useMyGps'))}
              </button>
            </div>
            <p class="text-xs text-muted mt-1 mb-3">${esc(t('pinHint'))}</p>
            <div class="rounded-2xl overflow-hidden border border-[#E2D9CC]">
              <div id="submit-pin-map" class="w-full h-72"></div>
            </div>
            <div class="grid grid-cols-2 gap-3 mt-3">
              <div>
                <label class="block text-[11px] font-semibold text-muted">${esc(t('latitudeLabel'))}</label>
                <input id="submit-lat" name="lat" type="number" step="0.0001" value="${pickedLat}"
                  class="w-full px-3 py-1.5 rounded-lg bg-cream border border-[#E2D9CC] text-xs font-mono" />
              </div>
              <div>
                <label class="block text-[11px] font-semibold text-muted">${esc(t('longitudeLabel'))}</label>
                <input id="submit-lng" name="lng" type="number" step="0.0001" value="${pickedLng}"
                  class="w-full px-3 py-1.5 rounded-lg bg-cream border border-[#E2D9CC] text-xs font-mono" />
              </div>
            </div>
          </div>

          <div id="photo-preview-box" class="hidden bg-white rounded-3xl border border-[#E7E0D5] p-4">
            <div class="text-xs font-semibold uppercase text-muted mb-2">${esc(t('photoPreview'))}</div>
            <img id="photo-preview-img" src="" alt="Preview" class="w-full h-44 object-cover rounded-2xl" />
          </div>
        </div>
      </form>
    </section>
  `;

  const mapEl = document.getElementById('submit-pin-map');
  if (mapEl && typeof window.L !== 'undefined') {
    const map = window.L.map(mapEl).setView([pickedLat, pickedLng], 7);
    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
    }).addTo(map);
    const pin = window.L.marker([pickedLat, pickedLng], { draggable: true }).addTo(map);

    const updateInputs = (lat, lng) => {
      pickedLat = Number(lat.toFixed(5));
      pickedLng = Number(lng.toFixed(5));
      document.getElementById('submit-lat').value = pickedLat;
      document.getElementById('submit-lng').value = pickedLng;
    };

    map.on('click', (e) => {
      pin.setLatLng(e.latlng);
      updateInputs(e.latlng.lat, e.latlng.lng);
    });
    pin.on('dragend', () => {
      const p = pin.getLatLng();
      updateInputs(p.lat, p.lng);
    });
    const gpsBtn = document.getElementById('use-my-gps');
    if (gpsBtn) {
      gpsBtn.addEventListener('click', () => {
        if (!navigator.geolocation) {
          showToast('Geolocation is not supported in this browser.', 'error');
          return;
        }
        gpsBtn.textContent = '...';
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const { latitude, longitude } = pos.coords;
            pin.setLatLng([latitude, longitude]);
            map.setView([latitude, longitude], 12);
            updateInputs(latitude, longitude);
            gpsBtn.textContent = t('useMyGps');
            showToast('Pin moved to your current location!');
          },
          () => {
            gpsBtn.textContent = t('useMyGps');
            showToast('Could not access GPS location.', 'error');
          }
        );
      });
    }
    setTimeout(() => map.invalidateSize(), 150);
  }

  document.getElementById('submit-photo-input').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      document.getElementById('photo-preview-img').src = reader.result;
      document.getElementById('photo-preview-box').classList.remove('hidden');
    };
    reader.readAsDataURL(file);
  });

  document.getElementById('submit-another-btn').addEventListener('click', () => {
    document.getElementById('submit-success-banner').classList.add('hidden');
    document.getElementById('photo-preview-box').classList.add('hidden');
    document.getElementById('submit-gem-form').reset();
  });

  document.getElementById('submit-gem-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const fd = new FormData(form);
    fd.set('lat', document.getElementById('submit-lat').value);
    fd.set('lng', document.getElementById('submit-lng').value);

    const btn = document.getElementById('submit-gem-btn');
    btn.disabled = true;
    btn.textContent = t('submittingBtn');
    try {
      const res = await api.submitGem(fd);
      document.getElementById('submit-success-msg').textContent = `${res.gem.name} (${res.gem.region}) — ${res.gem.status}`;
      document.getElementById('submit-success-banner').classList.remove('hidden');
      showToast(t('submitSuccessToast'));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = t('submitBtn');
    }
  });
}

/* -------------------------------------------------------------------------- */
/* 6. ADMIN MODERATION & ANALYTICS PAGE                                       */
/* -------------------------------------------------------------------------- */
export async function renderAdminPage(root) {
  if (!store.isLoggedIn() || (store.user?.role || 'user') !== 'admin') {
    root.innerHTML = `
      <section class="max-w-xl mx-auto px-4 py-16 text-center space-y-4 ut-fade-in">
        <div class="w-14 h-14 mx-auto rounded-2xl bg-terracotta/10 text-terracotta flex items-center justify-center text-2xl">🛡️</div>
        <h1 class="font-display font-bold text-3xl text-espresso">Admin Access Required</h1>
        <p class="text-sm text-muted">Only verified Admin accounts can view platform analytics, approve stays/contributions, or delete locations.</p>
        <div class="flex justify-center gap-3">
          <a href="#/login?role=admin" class="ut-btn-interactive px-5 py-2.5 rounded-xl bg-espresso text-white text-sm font-semibold">Log In as Admin</a>
          <a href="#/" class="ut-btn-interactive px-5 py-2.5 rounded-xl border border-[#E2D9CC] bg-white text-espresso text-sm font-semibold">Go Home</a>
        </div>
      </section>
    `;
    return;
  }

  let locFilter = '';
  let anRange = '30d';
  let anMetric = 'revenue';
  let anCompare = true;

  function buildAdminSeries(analytics) {
    const daysMap = { '7d': 7, '30d': 30, '90d': 90, '1y': 12 };
    const count = daysMap[anRange] || 30;
    const baseRev = Math.max(1200, analytics.total_revenue || 4800);
    const baseBk = Math.max(4, analytics.confirmed_bookings || 8);
    const basePlaces = Math.max(10, (analytics.verified_count || 56) + (analytics.verified_stays_count || 15));
    const baseUsers = Math.max(3, analytics.total_users || 3);

    const makeArr = (baseVal, scale) =>
      Array.from({ length: count }, (_, i) => {
        const wave = 0.72 + 0.35 * Math.sin(i * 0.65 + scale) + 0.18 * Math.cos(i * 1.1);
        return Math.max(0, Math.round((baseVal / count) * wave));
      });

    const mapCur = {
      revenue: makeArr(baseRev, 1.1),
      bookings: makeArr(baseBk * 4, 2.0),
      places: makeArr(basePlaces, 0.5),
      users: makeArr(baseUsers * 3, 1.7),
    };
    const cur = mapCur[anMetric] || mapCur.revenue;
    const prev = cur.map((v, i) => Math.max(0, Math.round(v * (0.78 + 0.14 * Math.sin(i)))));
    const labels = Array.from({ length: count }, (_, i) => {
      const d = new Date(Date.now() - (count - 1 - i) * (anRange === '1y' ? 30 : 1) * 864e5);
      return anRange === '1y' ? d.toLocaleDateString(undefined, { month: 'short' }) : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    });

    const heatmap = Array.from({ length: 16 }, (_, w) =>
      Array.from({ length: 7 }, (__, d) => ({
        label: `Week ${w + 1} Day ${d + 1}`,
        count: Math.max(0, Math.round(2 + 3 * Math.sin(w * 0.8 + d * 0.9))),
      }))
    );

    const totalSubs = (analytics.verified_count || 0) + (analytics.pending_count || 0) + (analytics.rejected_count || 0);
    const verifyRate = totalSubs ? ((analytics.verified_count || 0) / totalSubs) * 100 : 100;

    return {
      metrics: [
        { id: 'revenue', label: 'Platform Revenue', value: analytics.total_revenue || 0, displayValue: `₹${(analytics.total_revenue || 0).toLocaleString()}`, deltaPct: 18, spark: mapCur.revenue.slice(-10), color: '#164A37' },
        { id: 'bookings', label: 'Confirmed Bookings', value: analytics.confirmed_bookings || 0, displayValue: String(analytics.confirmed_bookings || 0), deltaPct: 14, spark: mapCur.bookings.slice(-10), color: '#C84B31' },
        { id: 'places', label: 'Verified Places & Stays', value: (analytics.verified_count || 0) + (analytics.verified_stays_count || 0), displayValue: `${analytics.verified_count} / ${analytics.verified_stays_count || 0}`, deltaPct: 9, spark: mapCur.places.slice(-10), color: '#164A37' },
        { id: 'users', label: 'Registered Users', value: analytics.total_users || 0, displayValue: String(analytics.total_users || 0), deltaPct: 12, spark: mapCur.users.slice(-10), color: '#C9821E' },
      ],
      ringCard: {
        label: 'Approval Rate',
        valueDisplay: `${verifyRate.toFixed(0)}%`,
        ratio: verifyRate / 100,
        subtext: `${analytics.pending_count} gems • ${analytics.pending_stays_count || 0} stays pending`,
      },
      chartSeries: { labels, cur, prev, unitPrefix: anMetric === 'revenue' ? '₹' : '' },
      funnel: [
        { label: 'Total Submissions', value: totalSubs + (analytics.total_stays || 0) },
        { label: 'Verified Places & Stays', value: (analytics.verified_count || 0) + (analytics.verified_stays_count || 0) },
        { label: 'Stay Requests', value: analytics.total_requests || 0 },
        { label: 'Confirmed Bookings', value: analytics.confirmed_bookings || 0 },
      ],
      heatmap,
    };
  }

  async function loadAdmin() {
    const data = await api.adminOverview();
    const { pending = [], pending_stays = [], all_gems = [], all_stays = [], analytics } = data;
    const maxCat = Math.max(1, ...Object.values(analytics.by_category || {}));
    const uRoles = analytics.users_by_role || {};
    const suiteData = buildAdminSeries(analytics);

    root.innerHTML = `
      <section class="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        <div class="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div class="text-xs font-bold uppercase tracking-wider text-forest">${esc(t('adminKicker'))}</div>
            <h1 class="font-display font-bold text-3xl text-espresso mt-1">${esc(t('adminTitle'))}</h1>
            <p class="text-sm text-muted mt-1">${esc(t('adminSub'))}</p>
          </div>
          <a href="#/submit" class="ut-btn-interactive px-4 py-2 rounded-xl bg-terracotta text-white text-xs sm:text-sm font-semibold">${esc(t('addTestSub'))}</a>
        </div>

        <!-- Interactive Creator-Style Analytics Suite -->
        ${renderAnalyticsSuite({
          idPrefix: 'admin-an',
          title: 'Platform Performance Analytics',
          subtitle: `T:${uRoles.user || 0} • H:${uRoles.host || 0} • A:${uRoles.admin || 0} | ${analytics.total_guides || 0} guides • ${analytics.total_reviews || 0} reviews | SOS: ${analytics.active_sos_count || 0} active`,
          range: anRange,
          activeMetric: anMetric,
          compare: anCompare,
          ...suiteData,
        })}

        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div class="lg:col-span-8 bg-white rounded-3xl border border-[#E7E0D5] p-6 shadow-xs">
            <h2 class="font-display font-bold text-lg text-espresso mb-4">${esc(t('gemsByCat'))}</h2>
            <div class="space-y-3">
              ${Object.entries(analytics.by_category || {})
                .map(([cat, count]) => {
                  const pct = Math.round((count / maxCat) * 100);
                  const meta = getCategoryMeta(cat);
                  const catLabel = store.lang === 'te' ? meta.label_te : meta.label;
                  return `
                    <div class="grid grid-cols-12 items-center gap-3 text-xs sm:text-sm">
                      <div class="col-span-4 sm:col-span-3 font-semibold text-espresso truncate">${esc(catLabel)}</div>
                      <div class="col-span-6 sm:col-span-8 bg-sand rounded-full h-3 overflow-hidden">
                        <div class="bg-terracotta h-full rounded-full" style="width:${pct}%"></div>
                      </div>
                      <div class="col-span-2 sm:col-span-1 text-right font-bold text-espresso">${count}</div>
                    </div>`;
                })
                .join('')}
            </div>
          </div>

          <div class="lg:col-span-4 bg-white rounded-3xl border border-[#E7E0D5] p-6 shadow-xs space-y-4">
            <h2 class="font-display font-bold text-lg text-espresso">${esc(t('kpiStates'))}</h2>
            <div class="space-y-2 text-xs font-semibold text-espresso">
              ${Object.entries(analytics.by_state || {})
                .map(([st, cnt]) => `<div class="flex justify-between px-3 py-2 rounded-xl bg-cream border border-[#EDE6DB]"><span>${esc(localizeState(st))}</span><span class="text-terracotta">${cnt}</span></div>`)
                .join('')}
            </div>
            <div class="pt-3 border-t border-[#EDE6DB] text-xs flex justify-between text-muted">
              <span>${esc(t('kpiSeedComm'))}</span>
              <strong class="text-espresso">${analytics.by_source.seed || 0} / ${analytics.by_source.community || 0}</strong>
            </div>
          </div>
        </div>

        <div>
          <h2 class="font-display font-bold text-2xl text-espresso mb-4">${esc(t('pendingSubs', { count: pending.length }))}</h2>
          ${
            pending.length === 0
              ? `<div class="bg-white rounded-2xl border border-[#E7E0D5] p-8 text-center text-sm text-muted">
                  ${esc(t('allCaughtUp'))}
                </div>`
              : `<div class="space-y-4">
                  ${pending
                    .map(
                      (g) => `
                      <div class="bg-white rounded-3xl border border-[#E7E0D5] p-5 shadow-xs flex flex-col md:flex-row gap-5 items-start">
                        <img src="${esc((g.images && g.images[0]) || '/img/gem_001_1.svg')}" alt=""
                          class="w-full md:w-52 h-36 object-cover rounded-2xl bg-sand shrink-0" />
                        <div class="flex-1 min-w-0">
                          <div class="flex flex-wrap items-center gap-2 text-xs">
                            <span class="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 font-bold uppercase">${esc(t('pending'))}</span>
                            <span class="font-bold text-terracotta uppercase">${esc(g.category)}</span>
                            <span class="text-muted">• ${esc(g.region)}</span>
                            <span class="text-muted">• ${esc(g.submitted_by || 'Community')}</span>
                          </div>
                          <h3 class="font-display font-bold text-xl text-espresso mt-1">${esc(g.name)}</h3>
                          <p class="text-sm text-espresso/90 mt-1">${esc(g.summary)}</p>
                          <p class="text-xs text-muted mt-1 line-clamp-2">${esc(g.story)}</p>
                          <div class="mt-2 text-xs text-muted">
                            ${g.lat}, ${g.lng} • ₹${esc(g.budget_per_day)}${esc(t('perDay'))} • ${esc(g.how_to_reach)}
                          </div>
                        </div>
                        <div class="flex md:flex-col gap-2 w-full md:w-36 shrink-0">
                          <button type="button" data-approve="${esc(g.id)}"
                            class="ut-btn-interactive flex-1 px-4 py-2.5 rounded-xl bg-forest hover:bg-forestLight text-white text-xs font-bold">
                            ${esc(t('approveBtn'))}
                          </button>
                          <button type="button" data-reject="${esc(g.id)}"
                            class="ut-btn-interactive flex-1 px-4 py-2.5 rounded-xl border border-red-300 text-red-700 hover:bg-red-50 text-xs font-bold">
                            ${esc(t('rejectBtn'))}
                          </button>
                        </div>
                      </div>`
                    )
                    .join('')}
                </div>`
          }
        </div>

        <!-- Pending Stay Submissions from Hosts -->
        <div>
          <h2 class="font-display font-bold text-2xl text-espresso mb-4">Pending Host Stay Submissions (${pending_stays.length})</h2>
          ${
            pending_stays.length === 0
              ? `<div class="bg-white rounded-2xl border border-[#E7E0D5] p-8 text-center text-sm text-muted">
                  No pending stay listings from hosts.
                </div>`
              : `<div class="space-y-4">
                  ${pending_stays
                    .map(
                      (s) => `
                      <div class="bg-white rounded-3xl border border-[#E7E0D5] p-5 shadow-xs flex flex-col md:flex-row gap-5 items-start">
                        <img src="${esc(s.image || `/img/${s.id}.svg`)}" onerror="this.onerror=null;this.src='/img/${esc(s.id)}.svg'" alt=""
                          class="w-full md:w-52 h-36 object-cover rounded-2xl bg-sand shrink-0" />
                        <div class="flex-1 min-w-0">
                          <div class="flex flex-wrap items-center gap-2 text-xs">
                            <span class="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 font-bold uppercase">${esc(t('pending'))}</span>
                            <span class="font-bold text-forest uppercase">STAY</span>
                            <span class="text-muted">• ${esc(s.region)}</span>
                            <span class="text-muted">• Host: ${esc(s.host_name || 'Host')}</span>
                          </div>
                          <h3 class="font-display font-bold text-xl text-espresso mt-1">${esc(s.name)}</h3>
                          <p class="text-sm text-espresso/90 mt-1">${esc(s.summary)}</p>
                          <div class="mt-2 text-xs text-muted">
                            ₹${esc(s.price_per_night)}/night • Max ${esc(s.max_guests || 4)} guests
                          </div>
                        </div>
                        <div class="flex md:flex-col gap-2 w-full md:w-36 shrink-0">
                          <button type="button" data-approve-stay="${esc(s.id)}"
                            class="ut-btn-interactive flex-1 px-4 py-2.5 rounded-xl bg-forest hover:bg-forestLight text-white text-xs font-bold">
                            ${esc(t('approveBtn'))}
                          </button>
                          <button type="button" data-reject-stay="${esc(s.id)}"
                            class="ut-btn-interactive flex-1 px-4 py-2.5 rounded-xl border border-red-300 text-red-700 hover:bg-red-50 text-xs font-bold">
                            ${esc(t('rejectBtn'))}
                          </button>
                        </div>
                      </div>`
                    )
                    .join('')}
                </div>`
          }
        </div>

        <!-- Manage & Delete Locations (Gems & Stays) -->
        <div class="bg-white rounded-3xl border border-[#E7E0D5] p-6 shadow-xs space-y-4">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 class="font-display font-bold text-xl text-espresso">Manage Locations &amp; Stays</h2>
              <p class="text-xs text-muted">Search and delete any destination or stay listing from the platform.</p>
            </div>
            <input id="admin-loc-search" type="text" value="${esc(locFilter)}" placeholder="Filter by name or region..."
              class="px-3.5 py-2 rounded-xl bg-cream border border-[#E2D9CC] text-xs w-full sm:w-64 focus:outline-none focus:border-terracotta" />
          </div>

          <div id="admin-locations-list" class="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto pr-1">
            ${[
              ...all_gems.map((g) => ({ kind: 'gem', id: g.id, name: g.name, region: g.region, status: g.status, img: (g.images && g.images[0]) || `/img/${g.id}_1.svg` })),
              ...all_stays.map((s) => ({ kind: 'stay', id: s.id, name: s.name, region: s.region, status: s.status || 'verified', img: s.image || `/img/${s.id}.svg` })),
            ]
              .filter((item) => !locFilter || item.name.toLowerCase().includes(locFilter.toLowerCase()) || item.region.toLowerCase().includes(locFilter.toLowerCase()))
              .map(
                (item) => `
                <div class="rounded-2xl border border-[#E7E0D5] bg-cream p-3 flex items-center justify-between gap-3">
                  <div class="flex items-center gap-3 min-w-0">
                    <img src="${esc(item.img)}" alt="" class="w-12 h-10 rounded-lg object-cover shrink-0 bg-sand" />
                    <div class="min-w-0">
                      <div class="font-semibold text-xs text-espresso truncate">${esc(item.name)}</div>
                      <div class="text-[11px] text-muted truncate">${esc(item.kind.toUpperCase())} • ${esc(item.region)} • ${esc(item.status)}</div>
                    </div>
                  </div>
                  <button type="button" data-delete-kind="${item.kind}" data-delete-id="${esc(item.id)}"
                    class="px-3 py-1.5 rounded-xl border border-red-300 text-red-700 hover:bg-red-50 text-xs font-semibold shrink-0">
                    ${esc(t('deleteBtn'))}
                  </button>
                </div>`
              )
              .join('')}
          </div>
        </div>
      </section>
    `;

    wireAnalyticsSuite({
      idPrefix: 'admin-an',
      chartSeries: suiteData.chartSeries,
      onRangeChange: (r) => { anRange = r; loadAdmin(); },
      onMetricChange: (m) => { anMetric = m; loadAdmin(); },
      onCompareToggle: () => { anCompare = !anCompare; loadAdmin(); },
    });

    root.querySelectorAll('[data-approve]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-approve');
        const res = await api.approveGem(id);
        showToast(res.message);
        loadAdmin();
      });
    });

    root.querySelectorAll('[data-reject]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-reject');
        const res = await api.rejectGem(id);
        showToast(res.message, 'info');
        loadAdmin();
      });
    });

    root.querySelectorAll('[data-approve-stay]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-approve-stay');
        const res = await api.approveStay(id);
        showToast(res.message);
        loadAdmin();
      });
    });

    root.querySelectorAll('[data-reject-stay]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-reject-stay');
        const res = await api.rejectStay(id);
        showToast(res.message, 'info');
        loadAdmin();
      });
    });

    root.querySelectorAll('[data-delete-id]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const kind = btn.getAttribute('data-delete-kind');
        const id = btn.getAttribute('data-delete-id');
        try {
          const res = kind === 'stay' ? await api.deleteStay(id) : await api.deleteGem(id);
          showToast(res.message, 'info');
          loadAdmin();
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    });

    const locInput = document.getElementById('admin-loc-search');
    if (locInput) {
      locInput.addEventListener('input', async (e) => {
        locFilter = e.target.value;
        await loadAdmin();
        const nextInp = document.getElementById('admin-loc-search');
        if (nextInp) {
          nextInp.focus();
          nextInp.setSelectionRange(locFilter.length, locFilter.length);
        }
      });
    }
  }

  await loadAdmin();
}
