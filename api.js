/** API client for Untold Trails FastAPI backend */

const TOKEN_KEY = 'untold_trails_token_v1';

async function request(url, options = {}) {
  const headers = { ...(options.headers || {}) };
  const token = localStorage.getItem(TOKEN_KEY);
  if (token && !headers.Authorization) {
    headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(url, { ...options, headers });
  const contentType = res.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await res.json() : await res.text();
  if (!res.ok) {
    const msg = (data && data.detail) ? data.detail : `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data;
}

export const api = {
  health() {
    return request('/api/health');
  },

  register(payload) {
    return request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },

  verifyOtp(payload) {
    return request('/api/auth/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },

  resendOtp(payload) {
    return request('/api/auth/resend-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },

  login(payload) {
    return request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },

  googleConfig() {
    return request('/api/auth/google-config');
  },

  googleAuth(payload) {
    return request('/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },

  me() {
    return request('/api/auth/me');
  },

  syncSaved(savedIds) {
    return request('/api/auth/saved', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ saved_ids: savedIds }),
    });
  },

  updateProfile(payload) {
    return request('/api/auth/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },

  saveTrip(payload) {
    return request('/api/auth/trips', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },

  deleteTrip(tripId) {
    return request(`/api/auth/trips/${encodeURIComponent(tripId)}`, {
      method: 'DELETE',
    });
  },

  listStays(filters = {}) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) {
      if (v !== undefined && v !== null && String(v).trim() !== '' && v !== 'all') {
        params.set(k, String(v));
      }
    }
    const qs = params.toString();
    return request(`/api/stays${qs ? `?${qs}` : ''}`);
  },

  getStay(id) {
    return request(`/api/stays/${encodeURIComponent(id)}`);
  },

  listBookings(email = '') {
    const qs = email ? `?email=${encodeURIComponent(email)}` : '';
    return request(`/api/bookings${qs}`);
  },

  createBooking(payload) {
    return request('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },

  cancelBooking(id) {
    return request(`/api/bookings/${encodeURIComponent(id)}/cancel`, { method: 'POST' });
  },

  listGuides(filters = {}) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) {
      if (v !== undefined && v !== null && String(v).trim() !== '' && v !== 'all') {
        params.set(k, String(v));
      }
    }
    const qs = params.toString();
    return request(`/api/guides${qs ? `?${qs}` : ''}`);
  },

  requestGuide(guideId, payload) {
    return request(`/api/guides/${encodeURIComponent(guideId)}/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },

  addReview(gemId, payload) {
    return request(`/api/gems/${encodeURIComponent(gemId)}/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },

  addStayReview(stayId, payload) {
    return request(`/api/stays/${encodeURIComponent(stayId)}/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },

  createBookingRequest(payload) {
    return request('/api/booking-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },

  listBookingRequests(role = 'traveller') {
    return request(`/api/booking-requests?role=${encodeURIComponent(role)}`);
  },

  acceptBookingRequest(id) {
    return request(`/api/booking-requests/${encodeURIComponent(id)}/accept`, { method: 'POST' });
  },

  declineBookingRequest(id) {
    return request(`/api/booking-requests/${encodeURIComponent(id)}/decline`, { method: 'POST' });
  },

  hostStays() {
    return request('/api/host/stays');
  },

  hostBookings() {
    return request('/api/host/bookings');
  },

  hostCreateStay(payload) {
    if (payload instanceof FormData) {
      return request('/api/host/stays', {
        method: 'POST',
        body: payload,
      });
    }
    const fd = new FormData();
    for (const [k, v] of Object.entries(payload || {})) {
      if (v !== undefined && v !== null) {
        fd.set(k, Array.isArray(v) ? v.join(',') : String(v));
      }
    }
    return request('/api/host/stays', {
      method: 'POST',
      body: fd,
    });
  },

  hostUpdateStay(id, payload) {
    return request(`/api/host/stays/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },

  listRequestMessages(reqId) {
    return request(`/api/requests/${encodeURIComponent(reqId)}/messages`);
  },

  sendRequestMessage(reqId, text) {
    return request(`/api/requests/${encodeURIComponent(reqId)}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
  },

  listNotifications() {
    return request('/api/notifications');
  },

  markNotificationsRead() {
    return request('/api/notifications/read-all', { method: 'POST' });
  },

  listMySos() {
    return request('/api/safety/sos');
  },

  logSos(payload) {
    return request('/api/safety/sos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },

  resolveSos(alertId) {
    return request(`/api/safety/sos/${encodeURIComponent(alertId)}/resolve`, { method: 'POST' });
  },

  listGems(filters = {}) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) {
      if (v !== undefined && v !== null && String(v).trim() !== '' && v !== 'all') {
        params.set(k, String(v));
      }
    }
    const qs = params.toString();
    return request(`/api/gems${qs ? `?${qs}` : ''}`);
  },

  getGem(id) {
    return request(`/api/gems/${encodeURIComponent(id)}`);
  },

  getGemWeather(id) {
    return request(`/api/gems/${encodeURIComponent(id)}/weather`);
  },

  getAllWeather() {
    return request('/api/weather/all');
  },

  getWeather(lat, lng, bestSeason = '') {
    const params = new URLSearchParams({ lat: String(lat), lng: String(lng) });
    if (bestSeason) params.set('best_season', bestSeason);
    return request(`/api/weather?${params.toString()}`);
  },

  submitGem(formData) {
    return request('/api/gems', {
      method: 'POST',
      body: formData,
    });
  },

  adminOverview() {
    return request('/api/admin/pending');
  },

  approveGem(id) {
    return request(`/api/admin/approve/${encodeURIComponent(id)}`, { method: 'POST' });
  },

  rejectGem(id) {
    return request(`/api/admin/reject/${encodeURIComponent(id)}`, { method: 'POST' });
  },

  deleteGem(id) {
    return request(`/api/admin/gems/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  approveStay(id) {
    return request(`/api/admin/stays/${encodeURIComponent(id)}/approve`, { method: 'POST' });
  },

  rejectStay(id) {
    return request(`/api/admin/stays/${encodeURIComponent(id)}/reject`, { method: 'POST' });
  },

  deleteStay(id) {
    return request(`/api/admin/stays/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  generatePlan(payload) {
    return request('/api/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },
};
