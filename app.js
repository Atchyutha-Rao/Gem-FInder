/** SPA Hash Router & Application Entrypoint for Untold Trails */

import { store, showToast } from './store.js';
import { openAuthModal, openSosModal, renderAuthPage, renderFooter, renderNavbar, renderSidebar, renderVerifyEmailPage } from './components.js';
import {
  renderAdminPage,
  renderExplorePage,
  renderGemDetailPage,
  renderGuidesPage,
  renderHomePage,
  renderHostPage,
  renderPlannerPage,
  renderProfilePage,
  renderSafetyPage,
  renderStayDetailPage,
  renderStaysPage,
  renderSubmitPage,
} from './pages.js';

function parseHash() {
  const raw = window.location.hash.replace(/^#/, '') || '/';
  const [pathPart, queryPart] = raw.split('?');
  const path = pathPart.startsWith('/') ? pathPart : `/${pathPart}`;
  return {
    path,
    query: new URLSearchParams(queryPart || ''),
  };
}

async function renderApp() {
  document.documentElement.lang = store.lang === 'te' ? 'te' : 'en';
  document.documentElement.classList.toggle('dark', store.theme === 'dark');
  const app = document.getElementById('app');
  const { path, query } = parseHash();

  // Separate full-screen Login / Sign Up / Verify Email pages (no dashboard shell)
  if (path === '/login' || path === '/register' || path === '/verify-email') {
    app.innerHTML = `<main id="page-root" class="flex-1 flex flex-col"></main>`;
    const pageRoot = document.getElementById('page-root');
    if (path === '/verify-email') {
      renderVerifyEmailPage(pageRoot, query);
    } else {
      renderAuthPage(pageRoot, path === '/register' ? 'register' : 'login', query);
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
    return;
  }

  // Auth guard for protected dashboards
  const protectedRoutes = ['/traveller-dashboard', '/host-dashboard', '/host', '/profile', '/bookings', '/admin'];
  if (protectedRoutes.includes(path) && !store.isLoggedIn()) {
    const roleHint = path === '/admin' ? '?role=admin' : path.startsWith('/host') ? '?role=host' : '';
    window.location.hash = `#/login${roleHint}`;
    return;
  }

  app.innerHTML = `
    <div class="flex min-h-screen w-full">
      ${renderSidebar(path)}
      <div class="flex-1 min-w-0 flex flex-col">
        ${renderNavbar(path)}
        <main id="page-root" class="flex-1 flex flex-col">
          <div class="flex-1 flex items-center justify-center p-12 text-sm text-muted">Loading...</div>
        </main>
        ${renderFooter()}
      </div>
    </div>
  `;

  // Global navbar controls
  const themeBtn = document.getElementById('global-theme-toggle');
  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      const nextTheme = store.theme === 'dark' ? 'light' : 'dark';
      store.setTheme(nextTheme);
      renderApp();
    });
  }

  const topSearchForm = document.getElementById('topbar-search-form');
  if (topSearchForm) {
    topSearchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const q = document.getElementById('topbar-search-input')?.value.trim() || '';
      window.location.hash = q ? `#/explore?q=${encodeURIComponent(q)}` : '#/explore';
    });
  }

  const langBtn = document.getElementById('global-lang-toggle');
  if (langBtn) {
    langBtn.addEventListener('click', () => {
      const next = store.lang === 'en' ? 'te' : 'en';
      store.setLang(next);
      showToast(next === 'te' ? 'భాష తెలుగులోకి మార్చబడింది' : 'Language switched to English', 'info');
    });
  }

  const menuBtn = document.getElementById('mobile-menu-btn');
  const drawer = document.getElementById('mobile-drawer');
  if (menuBtn && drawer) {
    menuBtn.addEventListener('click', () => {
      drawer.classList.toggle('hidden');
    });
    drawer.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => drawer.classList.add('hidden'));
    });
  }

  const wireAuthBtn = (id, fn) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', fn);
  };
  wireAuthBtn('nav-login-btn', () => openAuthModal('login'));
  wireAuthBtn('sidebar-login-btn', () => openAuthModal('login'));
  wireAuthBtn('nav-register-btn', () => openAuthModal('register'));
  wireAuthBtn('nav-sos-btn', () => openSosModal());
  wireAuthBtn('mobile-login-btn', () => {
    if (drawer) drawer.classList.add('hidden');
    openAuthModal('login');
  });
  wireAuthBtn('mobile-register-btn', () => {
    if (drawer) drawer.classList.add('hidden');
    openAuthModal('register');
  });
  const handleLogout = () => {
    store.logout();
    showToast('Logged out.', 'info');
    window.location.hash = '#/login';
  };
  wireAuthBtn('nav-logout-btn', handleLogout);
  wireAuthBtn('mobile-logout-btn', handleLogout);

  const pageRoot = document.getElementById('page-root');
  try {
    if (path === '/' || path === '') {
      await renderHomePage(pageRoot);
    } else if (path === '/explore') {
      await renderExplorePage(pageRoot, query);
    } else if (path === '/stays') {
      await renderStaysPage(pageRoot, query);
    } else if (path.startsWith('/stays/')) {
      const stayId = path.slice('/stays/'.length).trim();
      await renderStayDetailPage(pageRoot, stayId);
    } else if (path === '/guides') {
      await renderGuidesPage(pageRoot, query);
    } else if (path === '/safety') {
      await renderSafetyPage(pageRoot);
    } else if (path === '/host' || path === '/host-dashboard') {
      await renderHostPage(pageRoot);
    } else if (path === '/profile' || path === '/bookings' || path === '/traveller-dashboard') {
      await renderProfilePage(pageRoot, query);
    } else if (path.startsWith('/gem/')) {
      const gemId = path.slice('/gem/'.length).trim();
      await renderGemDetailPage(pageRoot, gemId);
    } else if (path === '/planner') {
      await renderPlannerPage(pageRoot, query);
    } else if (path === '/submit') {
      await renderSubmitPage(pageRoot);
    } else if (path === '/admin') {
      await renderAdminPage(pageRoot);
    } else {
      pageRoot.innerHTML = `
        <div class="max-w-xl mx-auto p-12 text-center">
          <h1 class="font-display font-bold text-3xl text-espresso">Page Not Found</h1>
          <p class="text-sm text-muted mt-2">This trail hasn't been mapped yet.</p>
          <a href="#/" class="inline-block mt-4 px-5 py-2.5 rounded-xl bg-terracotta text-white text-sm font-semibold">Return Home</a>
        </div>`;
    }
  } catch (err) {
    pageRoot.innerHTML = `
      <div class="max-w-xl mx-auto p-12 text-center">
        <h1 class="font-display font-bold text-2xl text-red-700">Could not load page</h1>
        <p class="text-sm text-muted mt-2">${err.message}</p>
        <a href="#/" class="inline-block mt-4 px-5 py-2.5 rounded-xl bg-terracotta text-white text-sm font-semibold">Go Home</a>
      </div>`;
  }

  window.scrollTo({ top: 0, behavior: 'instant' });
}

window.addEventListener('hashchange', renderApp);
store.subscribe((reason) => {
  if (reason === 'saved') {
    const badge = document.getElementById('nav-saved-count');
    if (badge) {
      badge.textContent = String(store.savedIds.length);
      badge.classList.remove('ut-pop-once');
      void badge.offsetWidth;
      badge.classList.add('ut-pop-once');
    }
    const sideBadge = document.getElementById('sidebar-saved-count');
    if (sideBadge) {
      sideBadge.textContent = String(store.savedIds.length);
      sideBadge.classList.remove('ut-pop-once');
      void sideBadge.offsetWidth;
      sideBadge.classList.add('ut-pop-once');
    }
    return;
  }
  renderApp();
});

document.addEventListener('DOMContentLoaded', async () => {
  await store.hydrateAuth();
  renderApp();
});
