/** Additional feature pages: Stays, Stay Booking & Requests, Guides, Safety Center, Profile & Host Dashboard */

import { api } from './api.js';
import { store, showToast } from './store.js';
import { localizeRegion, localizeState, t } from './i18n.js';
import {
  downloadOfflineTextPack,
  esc,
  mountLeafletMap,
  openAuthModal,
  openSosModal,
  renderStayCard,
  renderAnalyticsSuite,
  wireAnalyticsSuite,
} from './components.js';

/* -------------------------------------------------------------------------- */
/* VERIFIED LOCAL STAYS DIRECTORY                                             */
/* -------------------------------------------------------------------------- */
export async function renderStaysPage(root, queryParams) {
  const state = {
    q: queryParams.get('q') || '',
    stateFilter: queryParams.get('state') || 'all',
    max_price: queryParams.get('max_price') || 'all',
    amenity: 'all',
  };

  root.innerHTML = `
    <section class="max-w-7xl mx-auto px-4 sm:px-6 py-8 ut-fade-in space-y-6">
      <div class="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div class="text-xs font-bold uppercase tracking-wider text-forest">${esc(t('staysKicker'))}</div>
          <h1 class="font-display font-bold text-3xl text-espresso mt-1">${esc(t('staysTitle'))}</h1>
          <p class="text-sm text-muted mt-1 max-w-2xl">${esc(t('staysSub'))}</p>
        </div>
        <div class="flex flex-wrap gap-2 shrink-0">
          <a href="#/host" class="px-4 py-2 rounded-xl border border-[#E2D9CC] bg-white hover:bg-sand text-xs sm:text-sm font-semibold text-espresso">
            ${esc(t('hostTitle'))}
          </a>
          <a href="#/profile?tab=bookings" class="px-4 py-2 rounded-xl bg-espresso text-white hover:bg-terracotta text-xs sm:text-sm font-semibold">
            ${esc(t('viewMyBookings'))}
          </a>
        </div>
      </div>

      <div class="bg-white rounded-2xl border border-[#E7E0D5] p-3.5 flex flex-wrap items-center gap-2.5">
        <input id="stay-q" type="text" value="${esc(state.q)}" placeholder="${esc(t('staysSearchPh'))}"
          class="flex-1 min-w-[200px] px-3.5 py-2 rounded-xl bg-cream border border-[#E2D9CC] text-sm focus:outline-none focus:border-terracotta" />
        <select id="stay-state" class="px-3 py-2 rounded-xl bg-cream border border-[#E2D9CC] text-sm">
          <option value="all">${esc(t('expAllRegions'))}</option>
        </select>
        <select id="stay-price" class="px-3 py-2 rounded-xl bg-cream border border-[#E2D9CC] text-sm">
          <option value="all">${esc(t('staysAnyPrice'))}</option>
          <option value="1300">${esc(t('staysUnder1300'))}</option>
          <option value="1700">${esc(t('staysUnder1700'))}</option>
        </select>
        <select id="stay-amenity" class="px-3 py-2 rounded-xl bg-cream border border-[#E2D9CC] text-sm">
          <option value="all">${esc(t('staysAllAmenities'))}</option>
          <option value="Breakfast">Breakfast Included</option>
          <option value="Home-Cooked">Home-Cooked Meals</option>
          <option value="Wi">Wi-Fi</option>
          <option value="Local guide">Local Guide</option>
          <option value="Bonfire">Bonfire</option>
        </select>
        <span id="stays-count" class="text-xs font-semibold text-muted ml-auto">...</span>
      </div>

      <div id="stays-grid" class="ut-grid-stagger grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"></div>
    </section>
  `;

  let statesLoaded = false;

  async function refreshStays() {
    const res = await api.listStays({
      state: state.stateFilter,
      max_price: state.max_price,
      amenity: state.amenity,
      q: state.q,
    });
    if (!statesLoaded && Array.isArray(res.states)) {
      statesLoaded = true;
      const sel = document.getElementById('stay-state');
      if (sel) {
        sel.innerHTML =
          `<option value="all">${esc(t('expAllRegions'))}</option>` +
          res.states.map((st) => `<option value="${esc(st)}">${esc(localizeState(st))}</option>`).join('');
        sel.value = state.stateFilter;
      }
    }
    const stays = res.stays || [];
    document.getElementById('stays-count').textContent = t('expPlacesCount', { count: stays.length });
    const grid = document.getElementById('stays-grid');
    if (stays.length === 0) {
      grid.innerHTML = `<div class="sm:col-span-2 lg:col-span-3 bg-white rounded-2xl border border-[#E7E0D5] p-10 text-center text-sm text-muted">${esc(t('noStaysMatch'))}</div>`;
    } else {
      grid.innerHTML = stays.map((s) => renderStayCard(s)).join('');
    }
  }

  let timer = null;
  document.getElementById('stay-q').addEventListener('input', (e) => {
    state.q = e.target.value;
    clearTimeout(timer);
    timer = setTimeout(refreshStays, 200);
  });
  document.getElementById('stay-state').addEventListener('change', (e) => {
    state.stateFilter = e.target.value;
    refreshStays();
  });
  document.getElementById('stay-price').addEventListener('change', (e) => {
    state.max_price = e.target.value;
    refreshStays();
  });
  document.getElementById('stay-amenity').addEventListener('change', (e) => {
    state.amenity = e.target.value;
    refreshStays();
  });

  await refreshStays();
}

/* -------------------------------------------------------------------------- */
/* STAY DETAIL, REVIEWS & BOOKING / HOST REQUEST PAGE                         */
/* -------------------------------------------------------------------------- */
export async function renderStayDetailPage(root, stayId) {
  const resData = await api.getStay(stayId);
  const { stay, similar } = resData;
  let stayReviews = resData.reviews || [];
  let bookingMode = 'instant'; // 'instant' | 'request'
  const user = store.user;

  const today = new Date();
  const tomorrow = new Date(today.getTime() + 86400000);
  const dayAfter = new Date(today.getTime() + 2 * 86400000);
  const fmt = (d) => d.toISOString().slice(0, 10);

  function draw() {
    const displayName = store.lang === 'te' && stay.name_te ? stay.name_te : stay.name;
    const fallbackImg = stay.fallback_image || `/img/${stay.id}.svg`;
    const subRatings = [
      { label: t('cleanlinessLabel'), val: stay.cleanliness || 4.8 },
      { label: t('hospitalityLabel'), val: stay.hospitality || 4.9 },
      { label: t('safetySubLabel'), val: stay.safety || 4.9 },
      { label: t('accuracyLabel'), val: stay.accuracy || 4.7 },
    ];

    root.innerHTML = `
      <section class="max-w-6xl mx-auto px-4 sm:px-6 py-8 ut-fade-in space-y-8">
        <div class="flex items-center justify-between">
          <a href="#/stays" class="text-sm font-semibold text-terracotta hover:underline">${esc(t('stayBackToStays'))}</a>
          <a href="#/profile?tab=bookings" class="text-xs sm:text-sm font-semibold text-forest hover:underline">${esc(t('viewMyBookings'))}</a>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div class="lg:col-span-7 space-y-5">
            <div class="rounded-3xl overflow-hidden border border-[#E7E0D5] bg-white shadow-xs">
              <img src="${esc(stay.image)}" alt="${esc(displayName)}"
                onerror="this.onerror=null;this.src='${esc(fallbackImg)}'"
                class="w-full aspect-[16/10] object-cover" />
            </div>

            <div class="bg-white rounded-3xl border border-[#E7E0D5] p-6 shadow-xs space-y-4">
              <div class="flex flex-wrap items-center gap-2 text-xs">
                <span class="px-3 py-1 rounded-full bg-emerald-50 text-forest font-semibold border border-emerald-200">
                  ✓ ${esc(t('trustScore'))}: ${esc(stay.trust_score || stay.safety_score || 94)}/100
                </span>
                <span class="px-3 py-1 rounded-full bg-sand text-espresso font-semibold">★ ${esc(stay.rating)} (${stayReviews.length})</span>
                ${
                  stay.available === false
                    ? `<span class="px-3 py-1 rounded-full bg-red-50 text-red-700 font-semibold">Unavailable</span>`
                    : ''
                }
              </div>
              <div class="text-xs font-semibold uppercase text-terracotta">${esc(localizeRegion(stay.region))}</div>
              <h1 class="font-display font-bold text-3xl text-espresso ${store.lang === 'te' ? 'font-telugu' : ''}">${esc(displayName)}</h1>
              <p class="text-sm sm:text-base text-muted leading-relaxed">${esc(stay.summary)}</p>

              <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2">
                ${subRatings
                  .map(
                    (sr) => `
                    <div class="rounded-xl bg-cream border border-[#EDE6DB] p-2.5 text-center">
                      <div class="text-[11px] text-muted">${esc(sr.label)}</div>
                      <div class="font-bold text-sm text-espresso mt-0.5">★ ${esc(sr.val)}</div>
                    </div>`
                  )
                  .join('')}
              </div>

              <div class="pt-3 border-t border-[#EDE6DB] flex flex-wrap gap-2">
                ${(stay.amenities || []).map((a) => `<span class="px-3 py-1 rounded-full bg-cream border border-[#E2D9CC] text-xs font-semibold text-espresso">${esc(a)}</span>`).join('')}
              </div>

              <div class="rounded-2xl bg-forest text-white p-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div class="text-[11px] uppercase tracking-wider text-white/75">Verified Local Host</div>
                  <div class="font-semibold text-sm">${esc(stay.host_name)}</div>
                  <div class="text-xs text-amber-200 mt-0.5">${esc(stay.host_contact || 'Verified via Untold Trails')}</div>
                </div>
                ${
                  stay.nearby_gem_id
                    ? `<a href="#/gem/${esc(stay.nearby_gem_id)}" class="px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-xs font-semibold">Nearby Trail →</a>`
                    : ''
                }
              </div>
            </div>

            <!-- Stay Reviews -->
            <div class="bg-white rounded-3xl border border-[#E7E0D5] p-6 shadow-xs space-y-4">
              <div class="flex items-center justify-between">
                <h2 class="font-display font-bold text-xl text-espresso">${esc(t('reviewsHeading'))} (${stayReviews.length})</h2>
                <span class="text-xs font-bold text-terracotta">★ ${esc(stay.rating)} / 5</span>
              </div>
              ${
                stayReviews.length === 0
                  ? `<p class="text-sm text-muted">${esc(t('noReviewsYet'))}</p>`
                  : `<div class="space-y-3">
                      ${stayReviews
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
              <form id="stay-review-form" class="pt-4 border-t border-[#EDE6DB] space-y-3">
                <div class="text-xs font-bold uppercase tracking-wider text-espresso">${esc(t('writeReviewTitle'))}</div>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input name="author" required value="${esc(user?.name || '')}" placeholder="${esc(t('yourNamePh'))}"
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

            <div class="rounded-2xl overflow-hidden border border-[#E2D9CC]">
              <div id="stay-mini-map" class="w-full h-56"></div>
            </div>
          </div>

          <!-- Booking & Host Request Column -->
          <div class="lg:col-span-5 bg-white rounded-3xl border border-[#E7E0D5] p-6 shadow-xs space-y-4">
            <div class="flex items-baseline justify-between">
              <h2 class="font-display font-bold text-xl text-espresso">${esc(t('stayDirectHostTitle'))}</h2>
              <div class="text-lg font-bold text-forest">₹${esc(stay.price_per_night)}<span class="text-xs font-normal text-muted">${esc(t('perNight'))}</span></div>
            </div>

            <div class="grid grid-cols-2 gap-1 p-1 rounded-xl bg-sand text-xs font-semibold">
              <button type="button" data-bk-mode="instant"
                class="py-2 rounded-lg transition ${bookingMode === 'instant' ? 'bg-white text-espresso shadow-2xs' : 'text-muted'}">
                ${esc(t('bookInstantBtn'))}
              </button>
              <button type="button" data-bk-mode="request"
                class="py-2 rounded-lg transition ${bookingMode === 'request' ? 'bg-white text-espresso shadow-2xs' : 'text-muted'}">
                ${esc(t('requestStayBtn'))}
              </button>
            </div>

            ${
              stay.available === false
                ? `<div class="rounded-2xl bg-red-50 border border-red-200 px-4 py-3 text-xs font-semibold text-red-700">
                    Bookings are currently turned OFF by the host. This stay cannot be booked right now.
                  </div>`
                : ''
            }
            ${
              Array.isArray(stay.blocked_dates) && stay.blocked_dates.length > 0
                ? `<div class="text-[11px] text-amber-900 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                    Booked/blocked dates: ${esc(stay.blocked_dates.slice(0, 6).join(', '))}${stay.blocked_dates.length > 6 ? '…' : ''}
                  </div>`
                : ''
            }

            <div id="booking-confirm-box" class="hidden rounded-2xl bg-emerald-50 border border-emerald-200 p-4 space-y-2">
              <div class="font-bold text-forest text-sm">${esc(t('bookingConfirmedTitle'))}</div>
              <p id="booking-confirm-msg" class="text-xs text-emerald-900"></p>
              <a href="#/profile?tab=bookings" class="inline-block px-3.5 py-2 rounded-xl bg-forest text-white text-xs font-semibold">${esc(t('viewMyBookings'))}</a>
            </div>

            <form id="stay-booking-form" class="space-y-3.5">
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs font-semibold text-muted mb-1">${esc(t('checkInLabel'))}</label>
                  <input id="bk-in" name="check_in" type="date" required value="${fmt(tomorrow)}"
                    class="w-full px-3 py-2 rounded-xl bg-cream border border-[#E2D9CC] text-sm" />
                </div>
                <div>
                  <label class="block text-xs font-semibold text-muted mb-1">${esc(t('checkOutLabel'))}</label>
                  <input id="bk-out" name="check_out" type="date" required value="${fmt(dayAfter)}"
                    class="w-full px-3 py-2 rounded-xl bg-cream border border-[#E2D9CC] text-sm" />
                </div>
              </div>

              <div>
                <label class="block text-xs font-semibold text-muted mb-1">${esc(t('guestsLabel'))}</label>
                <input name="guests" type="number" min="1" max="${esc(stay.max_guests || 4)}" value="2"
                  class="w-full px-3.5 py-2 rounded-xl bg-cream border border-[#E2D9CC] text-sm" />
              </div>

              <div>
                <label class="block text-xs font-semibold text-muted mb-1">${esc(t('guestNameLabel'))}</label>
                <input name="guest_name" required value="${esc(user?.name || '')}" placeholder="Full name"
                  class="w-full px-3.5 py-2 rounded-xl bg-cream border border-[#E2D9CC] text-sm" />
              </div>

              <div>
                <label class="block text-xs font-semibold text-muted mb-1">${esc(t('guestEmailLabel'))}</label>
                <input name="guest_email" type="email" required value="${esc(user?.email || '')}" placeholder="you@example.com"
                  class="w-full px-3.5 py-2 rounded-xl bg-cream border border-[#E2D9CC] text-sm" />
              </div>

              <div>
                <label class="block text-xs font-semibold text-muted mb-1">${esc(t('specialNotesLabel'))}</label>
                <textarea name="notes" rows="2" placeholder="Arrival time, local meals preference..."
                  class="w-full px-3.5 py-2 rounded-xl bg-cream border border-[#E2D9CC] text-sm"></textarea>
              </div>

              <div class="rounded-xl bg-cream border border-[#EDE6DB] px-3.5 py-2.5 flex items-center justify-between text-sm">
                <span class="text-muted">Estimated Total</span>
                <strong id="bk-total" class="text-espresso">₹${esc(stay.price_per_night)}</strong>
              </div>

              <button id="bk-submit-btn" type="submit" ${stay.available === false ? 'disabled' : ''}
                class="w-full py-3 rounded-xl bg-terracotta hover:bg-terracottaDark disabled:opacity-50 text-white font-semibold text-sm transition">
                ${esc(bookingMode === 'instant' ? t('confirmBookingBtn') : t('requestStayBtn'))}
              </button>
            </form>
          </div>
        </div>

        ${
          similar.length > 0
            ? `<div>
                <h2 class="font-display font-bold text-2xl text-espresso mb-4">${esc(t('similarStaysTitle'))}</h2>
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  ${similar.map((s) => renderStayCard(s)).join('')}
                </div>
              </div>`
            : ''
        }
      </section>
    `;

    mountLeafletMap('stay-mini-map', {
      center: [stay.lat, stay.lng],
      zoom: 11,
      gems: [{ ...stay, category: 'village', images: [stay.image], budget_per_day: stay.price_per_night }],
    });

    root.querySelectorAll('[data-bk-mode]').forEach((b) => {
      b.addEventListener('click', () => {
        bookingMode = b.getAttribute('data-bk-mode');
        draw();
      });
    });

    function updateTotal() {
      const d1 = new Date(document.getElementById('bk-in').value);
      const d2 = new Date(document.getElementById('bk-out').value);
      const nights = Math.max(1, Math.round((d2 - d1) / 86400000) || 1);
      document.getElementById('bk-total').textContent = `₹${nights * stay.price_per_night} (${nights} night${nights > 1 ? 's' : ''})`;
    }
    document.getElementById('bk-in').addEventListener('change', updateTotal);
    document.getElementById('bk-out').addEventListener('change', updateTotal);

    document.getElementById('stay-review-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      try {
        const res = await api.addStayReview(stay.id, {
          author: fd.get('author'),
          rating: Number(fd.get('rating')) || 5,
          comment: fd.get('comment'),
        });
        stayReviews = [res.review, ...stayReviews];
        showToast(res.message);
        draw();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    document.getElementById('stay-booking-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      if (bookingMode === 'request' && !store.isLoggedIn()) {
        openAuthModal('login');
        return;
      }
      const fd = new FormData(e.target);
      const btn = document.getElementById('bk-submit-btn');
      btn.disabled = true;
      btn.textContent = '...';
      try {
        if (bookingMode === 'request') {
          const res = await api.createBookingRequest({
            stay_id: stay.id,
            guest_name: fd.get('guest_name'),
            guest_email: fd.get('guest_email'),
            check_in: fd.get('check_in'),
            check_out: fd.get('check_out'),
            guests: Number(fd.get('guests')) || 2,
            message: fd.get('notes') || '',
          });
          document.getElementById('booking-confirm-msg').textContent = `${res.message} Total: ₹${res.request.total}`;
          document.getElementById('booking-confirm-box').classList.remove('hidden');
          showToast(res.message);
        } else {
          const res = await api.createBooking({
            stay_id: stay.id,
            guest_name: fd.get('guest_name'),
            guest_email: fd.get('guest_email'),
            check_in: fd.get('check_in'),
            check_out: fd.get('check_out'),
            guests: Number(fd.get('guests')) || 2,
            notes: fd.get('notes') || '',
          });
          document.getElementById('booking-confirm-msg').textContent = `${res.message} Total: ₹${res.booking.total}`;
          document.getElementById('booking-confirm-box').classList.remove('hidden');
          showToast(res.message);
        }
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = bookingMode === 'instant' ? t('confirmBookingBtn') : t('requestStayBtn');
      }
    });
  }

  draw();
}

/* -------------------------------------------------------------------------- */
/* LOCAL GUIDES DIRECTORY & REQUEST MODAL                                     */
/* -------------------------------------------------------------------------- */
export async function renderGuidesPage(root, queryParams) {
  const state = {
    q: queryParams.get('q') || '',
    stateFilter: 'all',
    language: 'all',
  };

  root.innerHTML = `
    <section class="max-w-7xl mx-auto px-4 sm:px-6 py-8 ut-fade-in space-y-6">
      <div>
        <div class="text-xs font-bold uppercase tracking-wider text-forest">${esc(t('guidesKicker'))}</div>
        <h1 class="font-display font-bold text-3xl text-espresso mt-1">${esc(t('guidesTitle'))}</h1>
        <p class="text-sm text-muted mt-1 max-w-2xl">${esc(t('guidesSub'))}</p>
      </div>

      <div class="bg-white rounded-2xl border border-[#E7E0D5] p-3.5 flex flex-wrap items-center gap-2.5">
        <input id="guide-q" type="text" value="${esc(state.q)}" placeholder="${esc(t('guidesSearchPh'))}"
          class="flex-1 min-w-[200px] px-3.5 py-2 rounded-xl bg-cream border border-[#E2D9CC] text-sm focus:outline-none focus:border-terracotta" />
        <select id="guide-state" class="px-3 py-2 rounded-xl bg-cream border border-[#E2D9CC] text-sm">
          <option value="all">${esc(t('expAllRegions'))}</option>
          <option value="Telangana">${esc(t('stateTelangana'))}</option>
          <option value="Andhra Pradesh">${esc(t('stateAndhra'))}</option>
          <option value="Konkan">Konkan Coast</option>
          <option value="Spiti">Spiti Valley</option>
          <option value="Meghalaya">Meghalaya</option>
        </select>
        <select id="guide-lang" class="px-3 py-2 rounded-xl bg-cream border border-[#E2D9CC] text-sm">
          <option value="all">${esc(t('guidesAllLangs'))}</option>
          <option value="Telugu">Telugu</option>
          <option value="English">English</option>
          <option value="Hindi">Hindi</option>
          <option value="Marathi">Marathi</option>
        </select>
        <span id="guides-count" class="text-xs font-semibold text-muted ml-auto">...</span>
      </div>

      <div id="guides-grid" class="ut-grid-stagger grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"></div>
    </section>
  `;

  function openGuideRequestModal(guide) {
    const modalRoot = document.getElementById('modal-root');
    if (!modalRoot) return;
    const gName = store.lang === 'te' && guide.name_te ? guide.name_te : guide.name;
    modalRoot.innerHTML = `
      <div class="fixed inset-0 z-[1050] bg-espresso/50 backdrop-blur-xs flex items-center justify-center p-4">
        <div class="bg-white rounded-3xl border border-[#E7E0D5] max-w-md w-full p-6 shadow-2xl ut-fade-in">
          <div class="flex items-center justify-between mb-3">
            <div>
              <h3 class="font-display font-bold text-xl text-espresso">${esc(t('requestGuideTitle'))}</h3>
              <p class="text-xs text-muted">${esc(gName)} • ₹${esc(guide.rate_per_day)}${esc(t('perDay'))}</p>
            </div>
            <button id="close-guide-modal" type="button" class="w-8 h-8 rounded-full bg-sand font-bold">✕</button>
          </div>
          <form id="guide-req-form" class="space-y-3">
            <input name="traveller_name" required value="${esc(store.user?.name || '')}" placeholder="${esc(t('guestNameLabel'))}"
              class="w-full px-3.5 py-2.5 rounded-xl bg-cream border border-[#E2D9CC] text-sm" />
            <input name="traveller_contact" required value="${esc(store.user?.phone || store.user?.email || '')}" placeholder="Phone or Email"
              class="w-full px-3.5 py-2.5 rounded-xl bg-cream border border-[#E2D9CC] text-sm" />
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-[11px] font-semibold text-muted mb-1">${esc(t('travelDateLabel'))}</label>
                <input name="travel_date" type="date" required value="${new Date(Date.now() + 86400000).toISOString().slice(0, 10)}"
                  class="w-full px-3 py-2 rounded-xl bg-cream border border-[#E2D9CC] text-sm" />
              </div>
              <div>
                <label class="block text-[11px] font-semibold text-muted mb-1">${esc(t('groupSizeLabel'))}</label>
                <input name="group_size" type="number" min="1" max="15" value="2"
                  class="w-full px-3 py-2 rounded-xl bg-cream border border-[#E2D9CC] text-sm" />
              </div>
            </div>
            <textarea name="notes" rows="2" placeholder="Places you'd like to explore..."
              class="w-full px-3.5 py-2 rounded-xl bg-cream border border-[#E2D9CC] text-sm"></textarea>
            <button type="submit" class="w-full py-2.5 rounded-xl bg-terracotta hover:bg-terracottaDark text-white text-sm font-semibold">
              ${esc(t('sendRequestBtn'))}
            </button>
          </form>
        </div>
      </div>
    `;
    const close = () => {
      modalRoot.innerHTML = '';
    };
    document.getElementById('close-guide-modal').addEventListener('click', close);
    modalRoot.firstElementChild.addEventListener('click', (e) => {
      if (e.target === modalRoot.firstElementChild) close();
    });
    document.getElementById('guide-req-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      try {
        const res = await api.requestGuide(guide.id, {
          traveller_name: fd.get('traveller_name'),
          traveller_contact: fd.get('traveller_contact'),
          travel_date: fd.get('travel_date'),
          group_size: Number(fd.get('group_size')) || 2,
          notes: fd.get('notes') || '',
        });
        close();
        showToast(res.message);
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

  async function refreshGuides() {
    const res = await api.listGuides({
      state: state.stateFilter,
      language: state.language,
      q: state.q,
    });
    const guides = res.guides || [];
    document.getElementById('guides-count').textContent = t('expPlacesCount', { count: guides.length });
    const grid = document.getElementById('guides-grid');
    grid.innerHTML = guides
      .map((g) => {
        const gName = store.lang === 'te' && g.name_te ? g.name_te : g.name;
        const avatar = g.photo
          ? `<img src="${esc(g.photo)}" alt="${esc(gName)}" class="w-12 h-12 rounded-2xl object-cover shrink-0 bg-sand" />`
          : `<div class="w-12 h-12 rounded-2xl bg-forest text-white font-display font-bold text-lg flex items-center justify-center shrink-0">
              ${esc(g.name.split(' ').map((p) => p[0]).slice(0, 2).join(''))}
            </div>`;
        return `
        <article class="ut-card-lift bg-white rounded-2xl border border-[#E7E0D5] p-5 flex flex-col gap-3">
          <div class="flex items-start justify-between gap-3">
            <div class="flex items-center gap-3">
              ${avatar}
              <div>
                <h3 class="font-display font-bold text-lg text-espresso ${store.lang === 'te' ? 'font-telugu' : ''}">${esc(gName)}</h3>
                <div class="text-xs font-semibold text-terracotta">${esc(localizeRegion(g.region))}</div>
              </div>
            </div>
            <span class="px-2.5 py-1 rounded-full bg-emerald-50 text-forest border border-emerald-200 text-xs font-bold">★ ${esc(g.rating)}</span>
          </div>

          <p class="text-sm text-muted leading-relaxed flex-1">${esc(g.bio)}</p>

          <div class="text-xs space-y-1.5 pt-2 border-t border-[#F0EAE0]">
            <div><strong class="text-espresso">${esc(t('languagesLabel'))}:</strong> <span class="text-muted">${esc((g.languages || []).join(', '))}</span></div>
            <div><strong class="text-espresso">${esc(t('placesCoveredLabel'))}:</strong> <span class="text-muted">${esc((g.places_covered || []).join(', '))}</span></div>
          </div>

          <div class="pt-3 border-t border-[#F0EAE0] flex items-center justify-between">
            <div class="text-xs">
              <strong class="text-base text-espresso">₹${esc(g.rate_per_day)}</strong><span class="text-muted">${esc(t('perDay'))}</span>
              <span class="text-muted ml-2">• ${esc(t('experienceLabel', { yrs: g.experience_years }))}</span>
            </div>
            <button type="button" data-req-guide="${esc(g.id)}"
              class="px-3.5 py-2 rounded-xl bg-espresso hover:bg-terracotta text-white text-xs font-semibold transition">
              ${esc(t('requestGuideBtn'))}
            </button>
          </div>
        </article>`;
      })
      .join('');

    grid.querySelectorAll('[data-req-guide]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const guide = guides.find((item) => item.id === btn.getAttribute('data-req-guide'));
        if (guide) openGuideRequestModal(guide);
      });
    });
  }

  let timer = null;
  document.getElementById('guide-q').addEventListener('input', (e) => {
    state.q = e.target.value;
    clearTimeout(timer);
    timer = setTimeout(refreshGuides, 200);
  });
  document.getElementById('guide-state').addEventListener('change', (e) => {
    state.stateFilter = e.target.value;
    refreshGuides();
  });
  document.getElementById('guide-lang').addEventListener('change', (e) => {
    state.language = e.target.value;
    refreshGuides();
  });

  await refreshGuides();
}

/* -------------------------------------------------------------------------- */
/* SAFETY CENTER PAGE                                                         */
/* -------------------------------------------------------------------------- */
export async function renderSafetyPage(root) {
  const { gems } = await api.listGems();
  const savedGems = gems.filter((g) => store.isSaved(g.id));
  const personalContacts = (store.user && store.user.emergency_contacts) || [];

  root.innerHTML = `
    <section class="max-w-6xl mx-auto px-4 sm:px-6 py-8 ut-fade-in space-y-8">
      <div class="bg-[#18181B] text-white rounded-3xl p-6 sm:p-10 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-md">
        <div class="max-w-2xl space-y-2">
          <div class="text-xs font-bold uppercase tracking-wider text-amber-300">${esc(t('safetyKicker'))}</div>
          <h1 class="font-display font-bold text-3xl sm:text-4xl">${esc(t('safetyTitle'))}</h1>
          <p class="text-sm text-white/80 leading-relaxed">${esc(t('safetySub'))}</p>
        </div>
        <div class="flex flex-wrap gap-3 shrink-0">
          <button id="safety-open-sos" type="button"
            class="px-5 py-3 rounded-2xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold shadow-lg transition">
            🚨 ${esc(t('safetyOpenSosBtn'))}
          </button>
          <button id="safety-dl-pack" type="button"
            class="px-4 py-3 rounded-2xl bg-white/15 hover:bg-white/25 text-white text-sm font-semibold transition">
            ${esc(t('safetyDownloadSavedPackBtn'))}
          </button>
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        ${[
          { title: t('safetyPillar1Title'), desc: t('safetyPillar1Desc'), icon: '🛡️' },
          { title: t('safetyPillar2Title'), desc: t('safetyPillar2Desc'), icon: '📍' },
          { title: t('safetyPillar3Title'), desc: t('safetyPillar3Desc'), icon: '📞' },
          { title: t('safetyPillar4Title'), desc: t('safetyPillar4Desc'), icon: '📥' },
        ]
          .map(
            (p) => `
            <div class="bg-white rounded-2xl border border-[#E7E0D5] p-5 space-y-2">
              <div class="text-2xl">${p.icon}</div>
              <h2 class="font-display font-bold text-lg text-espresso">${esc(p.title)}</h2>
              <p class="text-xs text-muted leading-relaxed">${esc(p.desc)}</p>
            </div>`
          )
          .join('')}
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div class="lg:col-span-6 bg-white rounded-3xl border border-[#E7E0D5] p-6 space-y-4">
          <h2 class="font-display font-bold text-xl text-espresso">${esc(t('sosHelplines'))}</h2>
          <div class="space-y-2">
            ${[
              { label: t('sosNational'), num: '112', primary: true },
              { label: t('sosPolice'), num: '100' },
              { label: t('sosAmbulance'), num: '108' },
              { label: t('sosWomen'), num: '181' },
              { label: t('sosTourist'), num: '1363' },
            ]
              .map(
                (h) => `
                <a href="tel:${h.num}" class="flex items-center justify-between px-4 py-3 rounded-xl border ${
                  h.primary ? 'bg-red-50 border-red-200 text-red-900 font-bold' : 'bg-cream border-[#E2D9CC] text-espresso font-semibold'
                } text-sm hover:bg-sand transition">
                  <span>${esc(h.label)}</span>
                  <span>${esc(t('sosCallNow'))} ${h.num}</span>
                </a>`
              )
              .join('')}
          </div>
        </div>

        <div class="lg:col-span-6 bg-white rounded-3xl border border-[#E7E0D5] p-6 space-y-4">
          <div class="flex items-center justify-between gap-2">
            <h2 class="font-display font-bold text-xl text-espresso">${esc(t('safetyPersonalContacts'))}</h2>
            <a href="#/profile" class="text-xs font-semibold text-terracotta hover:underline">${esc(t('safetyManageContactsBtn'))} →</a>
          </div>
          ${
            personalContacts.length > 0
              ? `<div class="space-y-2">
                  ${personalContacts
                    .map(
                      (c) => `
                      <a href="tel:${esc(c.phone)}" class="flex items-center justify-between px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-sm font-semibold text-forest">
                        <span>${esc(c.name)}</span>
                        <span>${esc(c.phone)}</span>
                      </a>`
                    )
                    .join('')}
                </div>`
              : `<div class="rounded-2xl bg-cream border border-[#EDE6DB] p-5 text-sm text-muted">
                  ${store.user ? 'No personal emergency contacts saved yet.' : 'Log in and add up to 5 trusted family/friend numbers in your profile.'}
                  <div class="mt-3">
                    ${
                      store.user
                        ? `<a href="#/profile" class="inline-block px-4 py-2 rounded-xl bg-espresso text-white text-xs font-semibold">${esc(t('safetyManageContactsBtn'))}</a>`
                        : `<button id="safety-login-btn" type="button" class="px-4 py-2 rounded-xl bg-espresso text-white text-xs font-semibold">${esc(t('navLogin'))}</button>`
                    }
                  </div>
                </div>`
          }
        </div>
      </div>
    </section>
  `;

  document.getElementById('safety-open-sos').addEventListener('click', openSosModal);
  const loginBtn = document.getElementById('safety-login-btn');
  if (loginBtn) loginBtn.addEventListener('click', () => openAuthModal('login'));

  document.getElementById('safety-dl-pack').addEventListener('click', () => {
    const lines = [
      'UNTOLD TRAILS — OFFLINE SAFETY & TRIP PACK',
      `Generated: ${new Date().toLocaleString()}`,
      '',
      'EMERGENCY HELPLINES (INDIA):',
      '  National Emergency: 112 | Police: 100 | Ambulance: 108 | Women: 181 | Tourist: 1363',
      '',
      'PERSONAL EMERGENCY CONTACTS:',
      ...(personalContacts.length ? personalContacts.map((c) => `  - ${c.name}: ${c.phone}`) : ['  (None saved in profile)']),
      '',
      `SAVED PLACES (${savedGems.length}):`,
      ...savedGems.map(
        (g) =>
          `  * ${g.name} (${g.region}) — ${g.lat}, ${g.lng}\n    How to reach: ${g.how_to_reach}\n    Local support: ${(g.local_support || []).map((s) => `${s.name} (${s.contact})`).join('; ')}`
      ),
    ];
    downloadOfflineTextPack('untold-trails-offline-safety-pack.txt', lines.join('\n'));
    showToast('Offline Safety & Trip Pack downloaded!');
  });
}

/* -------------------------------------------------------------------------- */
/* PROFILE, NOTIFICATIONS, REQUESTS/CHAT, BOOKINGS & SOS ALERTS               */
/* -------------------------------------------------------------------------- */
export async function renderProfilePage(root, queryParams) {
  if (!store.isLoggedIn()) {
    root.innerHTML = `
      <section class="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
        <h1 class="font-display font-bold text-3xl text-espresso">${esc(t('profileTitle'))}</h1>
        <p class="text-sm text-muted">${esc(t('authLoginSub'))}</p>
        <div class="flex justify-center gap-3">
          <button id="prof-login-btn" type="button" class="px-5 py-2.5 rounded-xl bg-espresso text-white text-sm font-semibold">${esc(t('navLogin'))}</button>
          <button id="prof-reg-btn" type="button" class="px-5 py-2.5 rounded-xl bg-terracotta text-white text-sm font-semibold">${esc(t('navRegister'))}</button>
        </div>
      </section>
    `;
    document.getElementById('prof-login-btn').addEventListener('click', () => openAuthModal('login'));
    document.getElementById('prof-reg-btn').addEventListener('click', () => openAuthModal('register'));
    return;
  }

  let bookingTab = 'active';
  const [bkRes, reqRes, notifRes, sosRes, gemsRes] = await Promise.all([
    api.listBookings(store.user.email),
    api.listBookingRequests('traveller'),
    api.listNotifications(),
    api.listMySos(),
    api.listGems(),
  ]);
  let bookings = bkRes.bookings || [];
  let myRequests = reqRes.requests || [];
  let notifications = notifRes.notifications || [];
  let sosAlerts = sosRes.alerts || [];
  const savedGems = (gemsRes.gems || []).filter((g) => store.isSaved(g.id));

  function openMsgModal(reqItem) {
    const modalRoot = document.getElementById('modal-root');
    if (!modalRoot) return;
    async function loadMsgs() {
      const { messages } = await api.listRequestMessages(reqItem.id);
      modalRoot.innerHTML = `
        <div class="fixed inset-0 z-[1050] bg-espresso/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div class="bg-white rounded-3xl border border-[#E7E0D5] max-w-md w-full p-5 shadow-2xl space-y-4">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="font-display font-bold text-lg text-espresso">${esc(reqItem.listing_name)}</h3>
                <p class="text-xs text-muted">${esc(reqItem.dates)} • ${esc(reqItem.status)}</p>
              </div>
              <button id="close-msg-modal" type="button" class="w-8 h-8 rounded-full bg-sand font-bold">✕</button>
            </div>
            <div class="max-h-60 overflow-y-auto space-y-2 bg-cream rounded-2xl p-3 border border-[#EDE6DB]">
              ${
                messages.length === 0
                  ? `<p class="text-xs text-muted text-center py-4">No messages yet.</p>`
                  : messages
                      .map(
                        (m) => `
                        <div class="rounded-xl p-2.5 text-xs ${m.sender_role === 'traveller' ? 'bg-white border border-[#E2D9CC]' : 'bg-emerald-50 border border-emerald-200'}">
                          <div class="font-bold text-espresso">${esc(m.sender_name)} <span class="font-normal text-muted">(${esc(m.sender_role)})</span></div>
                          <div class="mt-0.5 text-espresso/90">${esc(m.text)}</div>
                        </div>`
                      )
                      .join('')
              }
            </div>
            <form id="send-msg-form" class="flex gap-2">
              <input name="text" required placeholder="${esc(t('sendMsgPh'))}" class="flex-1 px-3 py-2 rounded-xl bg-cream border border-[#E2D9CC] text-sm" />
              <button type="submit" class="px-4 py-2 rounded-xl bg-terracotta text-white text-xs font-semibold">${esc(t('sendMsgBtn'))}</button>
            </form>
          </div>
        </div>
      `;
      document.getElementById('close-msg-modal').addEventListener('click', () => (modalRoot.innerHTML = ''));
      document.getElementById('send-msg-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const text = new FormData(e.target).get('text');
        await api.sendRequestMessage(reqItem.id, text);
        await loadMsgs();
      });
    }
    loadMsgs();
  }

  function draw() {
    const user = store.user;
    const contacts = user.emergency_contacts || [];
    const savedTrips = user.saved_trips || [];
    const activeB = bookings.filter((b) => b.upcoming);
    const pastB = bookings.filter((b) => !b.upcoming);
    const shownB = bookingTab === 'active' ? activeB : pastB;

    root.innerHTML = `
      <section class="max-w-6xl mx-auto px-4 sm:px-6 py-8 ut-fade-in space-y-8">
        <div class="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div class="text-xs font-bold uppercase tracking-wider text-forest">${esc(user.email)}</div>
            <h1 class="font-display font-bold text-3xl text-espresso mt-1">${esc(t('profileTitle'))}</h1>
            <p class="text-sm text-muted mt-1">${esc(t('profileSub'))}</p>
          </div>
          <div class="flex flex-wrap gap-2">
            <a href="#/host" class="px-4 py-2 rounded-xl border border-[#E2D9CC] bg-white text-xs sm:text-sm font-semibold">${esc(t('hostTitle'))}</a>
            <a href="#/stays" class="px-4 py-2 rounded-xl bg-terracotta text-white text-xs sm:text-sm font-semibold">${esc(t('navStays'))}</a>
            <a href="#/planner" class="px-4 py-2 rounded-xl border border-[#E2D9CC] bg-white text-xs sm:text-sm font-semibold">${esc(t('navPlanner'))}</a>
          </div>
        </div>

        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div class="bg-white rounded-2xl border border-[#E7E0D5] p-4">
            <div class="text-xs font-semibold text-muted">${esc(t('myBookingsTitle'))}</div>
            <div class="font-display font-bold text-2xl text-espresso mt-1">${bookings.length}</div>
          </div>
          <div class="bg-white rounded-2xl border border-[#E7E0D5] p-4">
            <div class="text-xs font-semibold text-muted">${esc(t('navSaved'))}</div>
            <div class="font-display font-bold text-2xl text-forest mt-1">${savedGems.length}</div>
          </div>
          <div class="bg-white rounded-2xl border border-[#E7E0D5] p-4">
            <div class="text-xs font-semibold text-muted">${esc(t('savedTripsTitle'))}</div>
            <div class="font-display font-bold text-2xl text-terracotta mt-1">${savedTrips.length}</div>
          </div>
          <div class="bg-white rounded-2xl border border-[#E7E0D5] p-4">
            <div class="text-xs font-semibold text-muted">${esc(t('notificationsTitle'))}</div>
            <div class="font-display font-bold text-2xl text-espresso mt-1">${notifications.filter((n) => !n.read).length}</div>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form id="profile-info-form" class="lg:col-span-5 bg-white rounded-3xl border border-[#E7E0D5] p-6 space-y-4">
            <h2 class="font-display font-bold text-xl text-espresso">${esc(user.name)}</h2>
            <div>
              <label class="block text-xs font-semibold text-muted mb-1">${esc(t('profilePhoneLabel'))}</label>
              <input name="phone" value="${esc(user.phone || '')}" placeholder="+91 98..."
                class="w-full px-3.5 py-2.5 rounded-xl bg-cream border border-[#E2D9CC] text-sm" />
            </div>
            <div>
              <label class="block text-xs font-semibold text-muted mb-1">${esc(t('profileCityLabel'))}</label>
              <input name="city" value="${esc(user.city || '')}" placeholder="e.g., Hyderabad"
                class="w-full px-3.5 py-2.5 rounded-xl bg-cream border border-[#E2D9CC] text-sm" />
            </div>
            <button type="submit" class="px-5 py-2.5 rounded-xl bg-espresso hover:bg-terracotta text-white text-xs sm:text-sm font-semibold transition">
              ${esc(t('saveProfileBtn'))}
            </button>
          </form>

          <div class="lg:col-span-7 bg-white rounded-3xl border border-[#E7E0D5] p-6 space-y-4">
            <h2 class="font-display font-bold text-xl text-espresso">${esc(t('emergencyContactsTitle'))}</h2>
            <div class="space-y-2">
              ${contacts
                .map(
                  (c, idx) => `
                  <div class="flex items-center justify-between px-4 py-2.5 rounded-xl bg-cream border border-[#EDE6DB] text-sm">
                    <div><strong>${esc(c.name)}</strong> <span class="text-muted ml-2">${esc(c.phone)}</span></div>
                    <button type="button" data-del-contact="${idx}" class="text-xs font-semibold text-red-700 hover:underline">${esc(t('deleteBtn'))}</button>
                  </div>`
                )
                .join('')}
            </div>
            <form id="add-contact-form" class="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2">
              <input name="cname" required placeholder="${esc(t('contactNamePh'))}" class="px-3.5 py-2 rounded-xl bg-cream border border-[#E2D9CC] text-sm" />
              <input name="cphone" required placeholder="${esc(t('contactPhonePh'))}" class="px-3.5 py-2 rounded-xl bg-cream border border-[#E2D9CC] text-sm" />
              <button type="submit" class="px-4 py-2 rounded-xl bg-forest hover:bg-forestLight text-white text-xs sm:text-sm font-semibold">
                ${esc(t('addContactBtn'))}
              </button>
            </form>
          </div>
        </div>

        <!-- Notifications -->
        ${
          notifications.length > 0
            ? `<div class="bg-white rounded-3xl border border-[#E7E0D5] p-6 space-y-3">
                <div class="flex items-center justify-between">
                  <h2 class="font-display font-bold text-xl text-espresso">${esc(t('notificationsTitle'))}</h2>
                  <button id="mark-notifs-read" type="button" class="text-xs font-semibold text-terracotta hover:underline">${esc(t('markAllReadBtn'))}</button>
                </div>
                <div class="space-y-2">
                  ${notifications
                    .slice(0, 5)
                    .map(
                      (n) => `
                      <div class="rounded-xl px-4 py-3 text-xs border ${n.read ? 'bg-cream border-[#EDE6DB] text-muted' : 'bg-emerald-50 border-emerald-200 text-espresso'}">
                        <div class="font-bold">${esc(n.title)}</div>
                        <div class="mt-0.5">${esc(n.message)}</div>
                      </div>`
                    )
                    .join('')}
                </div>
              </div>`
            : ''
        }

        <!-- Booking Requests & Host Messages -->
        ${
          myRequests.length > 0
            ? `<div class="bg-white rounded-3xl border border-[#E7E0D5] p-6 space-y-4">
                <h2 class="font-display font-bold text-2xl text-espresso">${esc(t('stayRequestsTitle'))} (${myRequests.length})</h2>
                <div class="space-y-3">
                  ${myRequests
                    .map(
                      (r) => `
                      <div class="rounded-2xl border border-[#E7E0D5] bg-cream p-4 flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div class="flex items-center gap-2">
                            <strong class="text-sm text-espresso">${esc(r.listing_name)}</strong>
                            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              r.status === 'accepted'
                                ? 'bg-emerald-100 text-forest'
                                : r.status === 'declined'
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-amber-100 text-amber-900'
                            }">${esc(r.status)}</span>
                          </div>
                          <div class="text-xs text-muted mt-0.5">${esc(r.dates)} • ₹${esc(r.total)} • Host: ${esc(r.host_name)}</div>
                        </div>
                        <button type="button" data-open-req-msg="${esc(r.id)}" class="px-3.5 py-2 rounded-xl bg-espresso text-white text-xs font-semibold">
                          💬 Messages
                        </button>
                      </div>`
                    )
                    .join('')}
                </div>
              </div>`
            : ''
        }

        <!-- Confirmed Bookings -->
        <div class="bg-white rounded-3xl border border-[#E7E0D5] p-6 space-y-4">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <h2 class="font-display font-bold text-2xl text-espresso">${esc(t('myBookingsTitle'))}</h2>
            <div class="inline-flex rounded-xl bg-sand p-1 text-xs font-semibold">
              <button type="button" data-bk-tab="active" class="px-3.5 py-1.5 rounded-lg ${bookingTab === 'active' ? 'bg-white text-espresso shadow-2xs' : 'text-muted'}">
                ${esc(t('activeBookingsTab', { count: activeB.length }))}
              </button>
              <button type="button" data-bk-tab="past" class="px-3.5 py-1.5 rounded-lg ${bookingTab === 'past' ? 'bg-white text-espresso shadow-2xs' : 'text-muted'}">
                ${esc(t('pastBookingsTab', { count: pastB.length }))}
              </button>
            </div>
          </div>

          ${
            shownB.length === 0
              ? `<p class="text-sm text-muted py-4">${esc(t('noBookingsMsg'))}</p>`
              : `<div class="space-y-3">
                  ${shownB
                    .map(
                      (b) => `
                      <div class="rounded-2xl border border-[#E7E0D5] bg-cream p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div class="flex items-center gap-3.5">
                          <img src="${esc(b.image)}" onerror="this.onerror=null;this.src='/img/${esc(b.stay_id)}.svg'" alt="" class="w-20 h-16 rounded-xl object-cover shrink-0" />
                          <div>
                            <div class="flex items-center gap-2">
                              <strong class="text-sm text-espresso">${esc(b.stay_name)}</strong>
                              <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${b.upcoming ? 'bg-emerald-100 text-forest' : 'bg-sand text-muted'}">${esc(b.status)}</span>
                            </div>
                            <div class="text-xs text-muted mt-0.5">${esc(b.region)} • ${esc(b.check_in)} → ${esc(b.check_out)} • ${esc(b.guests)} guests</div>
                            <div class="text-xs text-forest font-semibold mt-0.5">${esc(b.host_name)} (${esc(b.host_contact)})</div>
                          </div>
                        </div>
                        <div class="flex items-center gap-3 shrink-0">
                          <strong class="text-sm text-espresso">₹${esc(b.total)}</strong>
                          ${
                            b.upcoming
                              ? `<button type="button" data-cancel-bk="${esc(b.id)}" class="px-3 py-1.5 rounded-xl border border-red-200 text-red-700 hover:bg-red-50 text-xs font-semibold">${esc(t('cancelBookingBtn'))}</button>`
                              : ''
                          }
                        </div>
                      </div>`
                    )
                    .join('')}
                </div>`
          }
        </div>

        <!-- SOS Alert History -->
        ${
          sosAlerts.length > 0
            ? `<div class="bg-white rounded-3xl border border-[#E7E0D5] p-6 space-y-3">
                <h2 class="font-display font-bold text-xl text-espresso">${esc(t('sosAlertsTitle'))}</h2>
                <div class="space-y-2">
                  ${sosAlerts
                    .map(
                      (a) => `
                      <div class="rounded-xl bg-cream border border-[#EDE6DB] p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
                        <div>
                          <span class="px-2 py-0.5 rounded-full font-bold uppercase ${a.status === 'resolved' ? 'bg-emerald-100 text-forest' : 'bg-red-100 text-red-700'}">
                            ${esc(a.status === 'resolved' ? t('sosResolvedBadge') : t('sosActiveBadge'))}
                          </span>
                          <span class="font-semibold text-espresso ml-2">${esc(a.id)}</span>
                          <span class="text-muted ml-2">${a.lat != null ? `${a.lat.toFixed(4)}, ${a.lng.toFixed(4)}` : ''}</span>
                        </div>
                        ${
                          a.status !== 'resolved'
                            ? `<button type="button" data-resolve-sos="${esc(a.id)}" class="px-3 py-1.5 rounded-xl bg-forest text-white font-semibold">${esc(t('resolveSosBtn'))}</button>`
                            : ''
                        }
                      </div>`
                    )
                    .join('')}
                </div>
              </div>`
            : ''
        }

        <!-- Saved Trips -->
        <div class="bg-white rounded-3xl border border-[#E7E0D5] p-6 space-y-4">
          <h2 class="font-display font-bold text-2xl text-espresso">${esc(t('savedTripsTitle'))}</h2>
          ${
            savedTrips.length === 0
              ? `<p class="text-sm text-muted">${esc(t('noSavedTripsMsg'))}</p>`
              : `<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  ${savedTrips
                    .map(
                      (tr) => `
                      <div class="rounded-2xl border border-[#E7E0D5] bg-cream p-4 flex items-start justify-between gap-3">
                        <div>
                          <div class="font-bold text-espresso">${esc(tr.title)}</div>
                          <div class="text-xs text-muted mt-1">${esc(tr.city)} • ${esc(tr.days)} days • ${esc(tr.travellers)} travellers • ₹${esc(tr.budget)}/day</div>
                          <div class="text-xs text-forest mt-1">${(tr.gem_ids || []).length} verified stops</div>
                        </div>
                        <button type="button" data-del-trip="${esc(tr.id)}" class="text-xs font-semibold text-red-700 hover:underline">${esc(t('deleteBtn'))}</button>
                      </div>`
                    )
                    .join('')}
                </div>`
          }
        </div>
      </section>
    `;

    document.getElementById('profile-info-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      try {
        const res = await api.updateProfile({ phone: fd.get('phone'), city: fd.get('city') });
        store.setUser(res.user);
        showToast('Profile saved!');
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    document.getElementById('add-contact-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      if (contacts.length >= 5) {
        showToast('Maximum 5 emergency contacts allowed.', 'error');
        return;
      }
      const fd = new FormData(e.target);
      const next = [...contacts, { name: fd.get('cname'), phone: fd.get('cphone') }];
      try {
        const res = await api.updateProfile({ emergency_contacts: next });
        store.setUser(res.user);
        draw();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    const markRead = document.getElementById('mark-notifs-read');
    if (markRead) {
      markRead.addEventListener('click', async () => {
        await api.markNotificationsRead();
        notifications = notifications.map((n) => ({ ...n, read: true }));
        draw();
      });
    }

    root.querySelectorAll('[data-open-req-msg]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const item = myRequests.find((r) => r.id === btn.getAttribute('data-open-req-msg'));
        if (item) openMsgModal(item);
      });
    });

    root.querySelectorAll('[data-resolve-sos]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const aid = btn.getAttribute('data-resolve-sos');
        const res = await api.resolveSos(aid);
        sosAlerts = sosAlerts.map((a) => (a.id === aid ? res.alert : a));
        showToast(res.message);
        draw();
      });
    });

    root.querySelectorAll('[data-del-contact]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const idx = Number(btn.getAttribute('data-del-contact'));
        const next = contacts.filter((_, i) => i !== idx);
        const res = await api.updateProfile({ emergency_contacts: next });
        store.setUser(res.user);
        draw();
      });
    });

    root.querySelectorAll('[data-bk-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        bookingTab = btn.getAttribute('data-bk-tab');
        draw();
      });
    });

    root.querySelectorAll('[data-cancel-bk]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const bid = btn.getAttribute('data-cancel-bk');
        const res = await api.cancelBooking(bid);
        bookings = bookings.map((b) => (b.id === bid ? res.booking : b));
        showToast(res.message, 'info');
        draw();
      });
    });

    root.querySelectorAll('[data-del-trip]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const tid = btn.getAttribute('data-del-trip');
        const res = await api.deleteTrip(tid);
        store.setUser(res.user);
        draw();
      });
    });
  }

  draw();
}

/* -------------------------------------------------------------------------- */
/* HOST DASHBOARD (#/host — Manage Stay Listings & Accept/Decline Requests)   */
/* -------------------------------------------------------------------------- */
export async function renderHostPage(root) {
  if (!store.isLoggedIn() || (store.user?.role || 'user') !== 'host') {
    root.innerHTML = `
      <section class="max-w-xl mx-auto px-4 py-16 text-center space-y-4 ut-fade-in">
        <div class="w-14 h-14 mx-auto rounded-2xl bg-forest/10 text-forest flex items-center justify-center text-2xl">🏡</div>
        <h1 class="font-display font-bold text-3xl text-espresso">${esc(t('hostTitle'))}</h1>
        <p class="text-sm text-muted">Host bookings, guest details, and stay listings are visible only when logged in with a Host account.</p>
        <div class="flex justify-center gap-3">
          <a href="#/login?role=host" class="ut-btn-interactive px-5 py-2.5 rounded-xl bg-espresso text-white text-sm font-semibold">Log In as Host</a>
          <a href="#/register?role=host" class="ut-btn-interactive px-5 py-2.5 rounded-xl bg-terracotta text-white text-sm font-semibold">Create Host Account</a>
        </div>
      </section>
    `;
    return;
  }

  const [staysRes, reqRes, bkRes] = await Promise.all([
    api.hostStays(),
    api.listBookingRequests('host'),
    api.hostBookings(),
  ]);
  let myStays = staysRes.stays || [];
  let incomingReqs = reqRes.requests || [];
  let hostBookings = bkRes.bookings || [];
  let bkSummary = bkRes.summary || {};
  let bkFilter = 'all';
  let anRange = '30d';
  let anMetric = 'revenue';
  let anCompare = true;
  let focusStayId = '';

  function buildHostSuiteData() {
    const daysMap = { '7d': 7, '30d': 30, '90d': 90, '1y': 12 };
    const count = daysMap[anRange] || 30;
    const scopedBookings = focusStayId ? hostBookings.filter((b) => b.stay_id === focusStayId) : hostBookings;
    const scopedReqs = focusStayId ? incomingReqs.filter((r) => r.listing_id === focusStayId) : incomingReqs;

    const confirmed = scopedBookings.filter((b) => b.status !== 'Cancelled');
    const rev = confirmed.reduce((acc, b) => acc + Number(b.total || 0), 0);
    const guests = confirmed.reduce((acc, b) => acc + Number(b.guests || 0), 0);
    const nights = confirmed.reduce((acc, b) => acc + Number(b.nights || 1), 0);
    const acceptedCount = scopedReqs.filter((r) => r.status === 'accepted').length;
    const acceptRate = scopedReqs.length ? (acceptedCount / scopedReqs.length) * 100 : confirmed.length ? 100 : 0;

    const makeArr = (baseVal, seed) =>
      Array.from({ length: count }, (_, i) => {
        const wave = 0.7 + 0.4 * Math.sin(i * 0.7 + seed) + 0.15 * Math.cos(i * 1.2);
        return Math.max(0, Math.round((Math.max(1, baseVal) / count) * wave));
      });

    const mapCur = {
      revenue: makeArr(rev || 3200, 1.2),
      bookings: makeArr((confirmed.length || 2) * 4, 2.1),
      requests: makeArr((scopedReqs.length || 2) * 5, 0.7),
      guests: makeArr((guests || 4) * 3, 1.8),
    };
    const cur = mapCur[anMetric] || mapCur.revenue;
    const prev = cur.map((v, i) => Math.max(0, Math.round(v * (0.76 + 0.15 * Math.sin(i)))));
    const labels = Array.from({ length: count }, (_, i) => {
      const d = new Date(Date.now() - (count - 1 - i) * (anRange === '1y' ? 30 : 1) * 864e5);
      return anRange === '1y' ? d.toLocaleDateString(undefined, { month: 'short' }) : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    });

    const heatmap = Array.from({ length: 16 }, (_, w) =>
      Array.from({ length: 7 }, (__, d) => ({
        label: `Week ${w + 1} Day ${d + 1}`,
        count: Math.max(0, Math.round((confirmed.length ? 2 : 0) + 2 * Math.sin(w * 0.9 + d))),
      }))
    );

    const focusStay = myStays.find((s) => s.id === focusStayId);
    return {
      focusLabel: focusStay ? focusStay.name : '',
      metrics: [
        { id: 'revenue', label: 'Host Revenue', value: rev, displayValue: `₹${rev.toLocaleString()}`, deltaPct: 16, spark: mapCur.revenue.slice(-10), color: '#164A37' },
        { id: 'bookings', label: 'Confirmed Bookings', value: confirmed.length, displayValue: String(confirmed.length), deltaPct: 11, spark: mapCur.bookings.slice(-10), color: '#C84B31' },
        { id: 'requests', label: 'Stay Requests', value: scopedReqs.length, displayValue: String(scopedReqs.length), deltaPct: 8, spark: mapCur.requests.slice(-10), color: '#C9821E' },
        { id: 'guests', label: 'Guests Hosted', value: guests, displayValue: String(guests), deltaPct: 14, spark: mapCur.guests.slice(-10), color: '#164A37' },
      ],
      ringCard: {
        label: 'Acceptance Rate',
        valueDisplay: `${acceptRate.toFixed(0)}%`,
        ratio: acceptRate / 100,
        subtext: `${nights} nights • Avg ₹${confirmed.length ? Math.round(rev / confirmed.length) : 0}`,
      },
      chartSeries: { labels, cur, prev, unitPrefix: anMetric === 'revenue' ? '₹' : '' },
      funnel: [
        { label: 'Incoming Requests', value: scopedReqs.length + confirmed.length },
        { label: 'Pending Review', value: scopedReqs.filter((r) => r.status === 'pending').length },
        { label: 'Accepted Requests', value: acceptedCount },
        { label: 'Confirmed Bookings', value: confirmed.length },
      ],
      heatmap,
    };
  }

  function openHostMsgModal(reqItem) {
    const modalRoot = document.getElementById('modal-root');
    if (!modalRoot) return;
    async function loadMsgs() {
      const { messages } = await api.listRequestMessages(reqItem.id);
      modalRoot.innerHTML = `
        <div class="fixed inset-0 z-[1050] bg-espresso/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div class="bg-white rounded-3xl border border-[#E7E0D5] max-w-md w-full p-5 shadow-2xl space-y-4 ut-modal-enter">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="font-display font-bold text-lg text-espresso">${esc(reqItem.traveller_name)}</h3>
                <p class="text-xs text-muted">${esc(reqItem.listing_name)} • ${esc(reqItem.dates)}</p>
              </div>
              <button id="close-host-msg-modal" type="button" class="w-8 h-8 rounded-full bg-sand font-bold">✕</button>
            </div>
            <div class="max-h-60 overflow-y-auto space-y-2 bg-cream rounded-2xl p-3 border border-[#EDE6DB]">
              ${
                messages.length === 0
                  ? `<p class="text-xs text-muted text-center py-4">No messages yet.</p>`
                  : messages
                      .map(
                        (m) => `
                        <div class="rounded-xl p-2.5 text-xs ${m.sender_role === 'host' ? 'bg-emerald-50 border border-emerald-200' : 'bg-white border border-[#E2D9CC]'}">
                          <div class="font-bold text-espresso">${esc(m.sender_name)} <span class="font-normal text-muted">(${esc(m.sender_role)})</span></div>
                          <div class="mt-0.5 text-espresso/90">${esc(m.text)}</div>
                        </div>`
                      )
                      .join('')
              }
            </div>
            <form id="host-send-msg-form" class="flex gap-2">
              <input name="text" required placeholder="${esc(t('sendMsgPh'))}" class="flex-1 px-3 py-2 rounded-xl bg-cream border border-[#E2D9CC] text-sm" />
              <button type="submit" class="px-4 py-2 rounded-xl bg-terracotta text-white text-xs font-semibold">${esc(t('sendMsgBtn'))}</button>
            </form>
          </div>
        </div>
      `;
      document.getElementById('close-host-msg-modal').addEventListener('click', () => (modalRoot.innerHTML = ''));
      document.getElementById('host-send-msg-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const text = new FormData(e.target).get('text');
        await api.sendRequestMessage(reqItem.id, text);
        await loadMsgs();
      });
    }
    loadMsgs();
  }

  function drawHost() {
    const shownBookings =
      bkFilter === 'upcoming'
        ? hostBookings.filter((b) => b.upcoming)
        : bkFilter === 'cancelled'
          ? hostBookings.filter((b) => b.status === 'Cancelled')
          : bkFilter === 'past'
            ? hostBookings.filter((b) => !b.upcoming && b.status !== 'Cancelled')
            : hostBookings;

    const hostSuite = buildHostSuiteData();
    root.innerHTML = `
      <section class="max-w-6xl mx-auto px-4 sm:px-6 py-8 ut-fade-in space-y-8">
        <div>
          <div class="text-xs font-bold uppercase tracking-wider text-forest">${esc(store.user.name)} • Host Dashboard</div>
          <h1 class="font-display font-bold text-3xl text-espresso mt-1">${esc(t('hostTitle'))}</h1>
          <p class="text-sm text-muted mt-1">${esc(t('hostSub'))}</p>
        </div>

        <!-- Interactive Host Analytics Suite -->
        ${renderAnalyticsSuite({
          idPrefix: 'host-an',
          title: 'Host Performance & Earnings',
          subtitle: `${myStays.length} stay listing(s) • ${bkSummary.upcoming_count || 0} upcoming check-in(s) • ${bkSummary.total_nights || 0} total nights`,
          range: anRange,
          activeMetric: anMetric,
          compare: anCompare,
          ...hostSuite,
        })}

        <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <!-- Add Stay Listing Form -->
          <form id="host-create-stay-form" class="lg:col-span-5 bg-white rounded-3xl border border-[#E7E0D5] p-6 space-y-3.5">
            <h2 class="font-display font-bold text-xl text-espresso">${esc(t('createListingTitle'))}</h2>
            <input name="name" required placeholder="Stay name (e.g., Godavari Bamboo Cottage)"
              class="w-full px-3.5 py-2.5 rounded-xl bg-cream border border-[#E2D9CC] text-sm" />
            <div class="grid grid-cols-2 gap-3">
              <input name="region" required placeholder="Region / Town" class="px-3.5 py-2.5 rounded-xl bg-cream border border-[#E2D9CC] text-sm" />
              <input name="state" required value="Telangana" placeholder="State" class="px-3.5 py-2.5 rounded-xl bg-cream border border-[#E2D9CC] text-sm" />
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-[11px] font-semibold text-muted mb-1">Price / Night (₹)</label>
                <input name="price_per_night" type="number" min="300" value="1500" class="w-full px-3 py-2 rounded-xl bg-cream border border-[#E2D9CC] text-sm" />
              </div>
              <div>
                <label class="block text-[11px] font-semibold text-muted mb-1">Max Guests</label>
                <input name="max_guests" type="number" min="1" max="16" value="4" class="w-full px-3 py-2 rounded-xl bg-cream border border-[#E2D9CC] text-sm" />
              </div>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <input name="lat" type="number" step="0.0001" value="17.65" placeholder="Latitude" class="px-3 py-2 rounded-xl bg-cream border border-[#E2D9CC] text-xs font-mono" />
              <input name="lng" type="number" step="0.0001" value="79.45" placeholder="Longitude" class="px-3 py-2 rounded-xl bg-cream border border-[#E2D9CC] text-xs font-mono" />
            </div>
            <textarea name="summary" rows="3" required minlength="10" placeholder="Describe your homestay, meals, and local experience..."
              class="w-full px-3.5 py-2.5 rounded-xl bg-cream border border-[#E2D9CC] text-sm"></textarea>
            <div>
              <label class="block text-[11px] font-semibold text-muted mb-1">Upload Stay Photo (JPG, PNG, WEBP)</label>
              <input id="host-stay-photo" name="photo" type="file" accept="image/*"
                class="w-full text-xs text-muted file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-sand file:text-espresso file:font-semibold" />
            </div>
            <div id="host-photo-preview-box" class="hidden rounded-2xl overflow-hidden border border-[#E7E0D5]">
              <img id="host-photo-preview-img" src="" alt="Stay Preview" class="w-full h-36 object-cover" />
            </div>
            <button type="submit" class="ut-btn-interactive w-full py-3 rounded-xl bg-terracotta hover:bg-terracottaDark text-white text-sm font-semibold">
              Submit Stay for Admin Approval
            </button>
          </form>

          <!-- Listings & Incoming Requests -->
          <div class="lg:col-span-7 space-y-6">
            <div class="bg-white rounded-3xl border border-[#E7E0D5] p-6 space-y-4">
              <h2 class="font-display font-bold text-xl text-espresso">${esc(t('myListingsTitle'))} (${myStays.length})</h2>
              ${
                myStays.length === 0
                  ? `<p class="text-sm text-muted">You haven't published a stay listing yet. Use the form on the left to add one.</p>`
                  : `<div class="space-y-3">
                      ${myStays
                        .map(
                          (s) => `
                          <div class="rounded-2xl border border-[#E7E0D5] bg-cream p-4 flex flex-wrap items-center justify-between gap-3">
                            <div class="flex items-center gap-3 min-w-0">
                              <img src="${esc(s.image || `/img/${s.id}.svg`)}" onerror="this.onerror=null;this.src='/img/${esc(s.id)}.svg'" alt="" class="w-14 h-12 rounded-xl object-cover shrink-0 bg-sand" />
                              <div class="min-w-0">
                                <div class="flex items-center gap-2">
                                  <a href="#/stays/${esc(s.id)}" class="font-bold text-sm text-espresso hover:text-terracotta truncate">${esc(s.name)}</a>
                                  <span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                    s.status === 'rejected'
                                      ? 'bg-red-100 text-red-700'
                                      : s.status === 'pending'
                                        ? 'bg-amber-100 text-amber-900'
                                        : 'bg-emerald-100 text-forest'
                                  }">${esc(s.status || 'verified')}</span>
                                </div>
                                <div class="text-xs text-muted">${esc(s.region)} • ₹${esc(s.price_per_night)}/night • ${s.available ? 'Available' : 'Paused'}</div>
                              </div>
                            </div>
                            <div class="inline-flex rounded-xl border border-[#E2D9CC] bg-white p-1 gap-1 shrink-0" role="group" aria-label="Stay booking status">
                              <button type="button" data-set-stay-avail="on" data-stay-id="${esc(s.id)}" ${s.available ? 'disabled' : ''}
                                class="px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                                  s.available
                                    ? 'bg-forest text-white shadow-2xs cursor-default'
                                    : 'text-muted hover:bg-emerald-50 hover:text-forest'
                                }">
                                ON
                              </button>
                              <button type="button" data-set-stay-avail="off" data-stay-id="${esc(s.id)}" ${!s.available ? 'disabled' : ''}
                                class="px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                                  !s.available
                                    ? 'bg-red-600 text-white shadow-2xs cursor-default'
                                    : 'text-muted hover:bg-red-50 hover:text-red-700'
                                }">
                                OFF
                              </button>
                            </div>
                          </div>`
                        )
                        .join('')}
                    </div>`
              }
            </div>

            <div class="bg-white rounded-3xl border border-[#E7E0D5] p-6 space-y-4">
              <h2 class="font-display font-bold text-xl text-espresso">${esc(t('incomingRequestsTitle'))} (${incomingReqs.length})</h2>
              ${
                incomingReqs.length === 0
                  ? `<p class="text-sm text-muted">No incoming booking requests for your listings yet.</p>`
                  : `<div class="space-y-3">
                      ${incomingReqs
                        .map(
                          (r) => `
                          <div class="rounded-2xl border border-[#E7E0D5] bg-cream p-4 space-y-2">
                            <div class="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <strong class="text-sm text-espresso">${esc(r.listing_name)}</strong>
                                <span class="ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-100 text-amber-900">${esc(r.status)}</span>
                              </div>
                              <strong class="text-sm text-forest">₹${esc(r.total)}</strong>
                            </div>
                            <div class="text-xs text-muted">${esc(r.traveller_name)} (${esc(r.traveller_email)}) • ${esc(r.dates)} • ${esc(r.guests)} guests</div>
                            ${r.message ? `<div class="text-xs text-espresso italic">"${esc(r.message)}"</div>` : ''}
                            ${
                              r.status === 'pending'
                                ? `<div class="flex flex-wrap gap-2 pt-1">
                                    <button type="button" data-accept-req="${esc(r.id)}" class="px-3.5 py-1.5 rounded-xl bg-forest text-white text-xs font-semibold">${esc(t('acceptBtn'))}</button>
                                    <button type="button" data-decline-req="${esc(r.id)}" class="px-3.5 py-1.5 rounded-xl border border-red-300 text-red-700 text-xs font-semibold">${esc(t('declineBtn'))}</button>
                                    <button type="button" data-host-msg="${esc(r.id)}" class="px-3.5 py-1.5 rounded-xl bg-espresso text-white text-xs font-semibold">💬 Message</button>
                                  </div>`
                                : `<div class="pt-1"><button type="button" data-host-msg="${esc(r.id)}" class="px-3 py-1.5 rounded-xl border border-[#E2D9CC] bg-white text-espresso text-xs font-semibold">💬 Message Guest</button></div>`
                            }
                          </div>`
                        )
                        .join('')}
                    </div>`
              }
            </div>
          </div>
        </div>

        <!-- Host Bookings & Guest Details -->
        <div class="bg-white rounded-3xl border border-[#E7E0D5] p-6 space-y-4">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 class="font-display font-bold text-2xl text-espresso">Guest Bookings &amp; Stay Details (${shownBookings.length})</h2>
              <p class="text-xs text-muted">Full reservation, check-in, guest count, and payout breakdown for your stays.</p>
            </div>
            <div class="inline-flex rounded-xl bg-sand p-1 text-xs font-semibold">
              ${['all', 'upcoming', 'past', 'cancelled']
                .map(
                  (tab) => `
                  <button type="button" data-host-bk-tab="${tab}"
                    class="px-3 py-1.5 rounded-lg capitalize ${bkFilter === tab ? 'bg-white text-espresso shadow-2xs' : 'text-muted'}">
                    ${tab}
                  </button>`
                )
                .join('')}
            </div>
          </div>
          ${
            shownBookings.length === 0
              ? `<p class="text-sm text-muted py-4">No bookings match this filter yet.</p>`
              : `<div class="space-y-3">
                  ${shownBookings
                    .map(
                      (b) => `
                      <div class="rounded-2xl border border-[#E7E0D5] bg-cream p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div class="space-y-1">
                          <div class="flex flex-wrap items-center gap-2">
                            <strong class="text-sm text-espresso">${esc(b.guest_name)}</strong>
                            <span class="text-xs text-muted">(${esc(b.guest_email)})</span>
                            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              b.status === 'Cancelled'
                                ? 'bg-red-100 text-red-700'
                                : b.upcoming
                                  ? 'bg-emerald-100 text-forest'
                                  : 'bg-sand text-muted'
                            }">${esc(b.status)}</span>
                          </div>
                          <div class="text-xs font-semibold text-terracotta">${esc(b.stay_name)} • ${esc(b.check_in)} → ${esc(b.check_out)}</div>
                          <div class="text-xs text-muted">${esc(b.nights || 1)} night(s) • ${esc(b.guests)} guest(s) • Ref: ${esc(b.id)}</div>
                          ${b.notes ? `<div class="text-xs text-espresso italic">"${esc(b.notes)}"</div>` : ''}
                        </div>
                        <div class="text-right shrink-0">
                          <div class="font-display font-bold text-lg text-forest">₹${esc(b.total)}</div>
                          <div class="text-[11px] text-muted">₹${esc(b.price_per_night || '')}/night</div>
                        </div>
                      </div>`
                    )
                    .join('')}
                </div>`
          }
        </div>
      </section>
    `;

    const photoInput = document.getElementById('host-stay-photo');
    if (photoInput) {
      photoInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          document.getElementById('host-photo-preview-img').src = reader.result;
          document.getElementById('host-photo-preview-box').classList.remove('hidden');
        };
        reader.readAsDataURL(file);
      });
    }

    document.getElementById('host-create-stay-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      try {
        const res = await api.hostCreateStay(fd);
        myStays = [res.stay, ...myStays];
        showToast(res.message);
        drawHost();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    root.querySelectorAll('[data-set-stay-avail]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const sid = btn.getAttribute('data-stay-id');
        const nextAvail = btn.getAttribute('data-set-stay-avail') === 'on';
        try {
          const res = await api.hostUpdateStay(sid, { available: nextAvail });
          myStays = myStays.map((s) => (s.id === sid ? res.stay : s));
          showToast(nextAvail ? 'Stay bookings turned ON.' : 'Stay bookings turned OFF.', nextAvail ? 'success' : 'info');
          drawHost();
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    });

    root.querySelectorAll('[data-accept-req]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const rid = btn.getAttribute('data-accept-req');
        try {
          const res = await api.acceptBookingRequest(rid);
          incomingReqs = incomingReqs.map((r) => (r.id === rid ? res.request : r));
          showToast(res.message);
          drawHost();
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    });

    root.querySelectorAll('[data-decline-req]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const rid = btn.getAttribute('data-decline-req');
        const res = await api.declineBookingRequest(rid);
        incomingReqs = incomingReqs.map((r) => (r.id === rid ? res.request : r));
        showToast(res.message, 'info');
        drawHost();
      });
    });

    root.querySelectorAll('[data-host-msg]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const reqItem = incomingReqs.find((r) => r.id === btn.getAttribute('data-host-msg'));
        if (reqItem) openHostMsgModal(reqItem);
      });
    });

    wireAnalyticsSuite({
      idPrefix: 'host-an',
      chartSeries: hostSuite.chartSeries,
      onRangeChange: (r) => { anRange = r; drawHost(); },
      onMetricChange: (m) => { anMetric = m; drawHost(); },
      onCompareToggle: () => { anCompare = !anCompare; drawHost(); },
      onClearFocus: () => { focusStayId = ''; drawHost(); },
    });

    root.querySelectorAll('[data-host-bk-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        bkFilter = btn.getAttribute('data-host-bk-tab');
        drawHost();
      });
    });
  }

  drawHost();
}
