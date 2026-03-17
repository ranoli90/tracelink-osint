const API_BASE = '/api';

function escapeHtml(str) {
  if (str == null || str === '') return '';
  const s = String(str);
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getAuthHeader() {
  const creds = sessionStorage.getItem('_tl_auth');
  return creds ? ('Basic ' + creds) : null;
}

function logout() {
  sessionStorage.removeItem('_tl_auth');
  const overlay = document.getElementById('loginOverlay');
  if (overlay) overlay.classList.remove('hidden');
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) logoutBtn.style.display = 'none';
}

async function doLogin() {
  const user = document.getElementById('loginUser')?.value.trim();
  const pass = document.getElementById('loginPass')?.value;
  const errEl = document.getElementById('loginError');
  const btn = document.getElementById('loginBtn');
  if (!user || !pass) {
    if (errEl) { errEl.textContent = 'Enter username and password.'; errEl.style.display = 'block'; }
    return;
  }
  if (btn) { btn.disabled = true; btn.textContent = 'Checking…'; }
  try {
    const encoded = btoa(user + ':' + pass);
    const res = await fetch('/api/stats', { headers: { 'Authorization': 'Basic ' + encoded } });
    if (res.ok || res.status === 200) {
      sessionStorage.setItem('_tl_auth', encoded);
      const overlay = document.getElementById('loginOverlay');
      if (overlay) overlay.classList.add('hidden');
      const logoutBtn = document.getElementById('logoutBtn');
      if (logoutBtn) logoutBtn.style.display = '';
      if (errEl) errEl.style.display = 'none';
      loadStats();
      loadLinks();
      loadPorkbunDomains();
    } else {
      if (errEl) { errEl.textContent = 'Invalid credentials — try again.'; errEl.style.display = 'block'; }
      sessionStorage.removeItem('_tl_auth');
    }
  } catch (e) {
    if (errEl) { errEl.textContent = 'Connection error — check network.'; errEl.style.display = 'block'; }
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Sign In'; }
  }
}

function initLogin() {
  const overlay = document.getElementById('loginOverlay');
  if (!overlay) return;
  const existing = sessionStorage.getItem('_tl_auth');
  if (existing) {
    overlay.classList.add('hidden');
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.style.display = '';
    return true;
  }
  const btn = document.getElementById('loginBtn');
  const passInput = document.getElementById('loginPass');
  if (btn) btn.addEventListener('click', doLogin);
  if (passInput) passInput.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
  const userInput = document.getElementById('loginUser');
  if (userInput) userInput.addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('loginPass')?.focus(); });
  return false;
}

async function fetchAPI(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  
  const headers = {
    ...options.headers,
    'Content-Type': 'application/json',
  };
  
  const auth = getAuthHeader();
  if (auth) headers['Authorization'] = auth;

  try {
    const res = await fetch(url, {
      ...options,
      headers,
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`HTTP ${res.status}: ${errorText}`);
    }

    if (res.status === 204) return null;
    return await res.json();
  } catch (err) {
    console.error('[API]', endpoint, err.message);
    throw err;
  }
}

function showNotification(message, type = 'success') {
  if (!document.querySelector('style[data-notification]')) {
    const style = document.createElement('style');
    style.setAttribute('data-notification', '');
    style.textContent = `
      .notification { position: fixed; top: 1rem; left: 50%; transform: translate(-50%, -150%); padding: 0.875rem 1.5rem; border-radius: 10px; color: #fff; font-weight: 600; font-size: 0.9375rem; z-index: 2147483647; transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease; box-shadow: 0 12px 40px -8px rgb(0 0 0 / 0.35), 0 0 0 1px rgb(255 255 255 / 0.1); max-width: min(92vw, 420px); text-align: center; pointer-events: auto; }
      .notification.show { transform: translate(-50%, 0); }
      .notification.success { background: linear-gradient(135deg, #047857 0%, #059669 100%); }
      .notification.error { background: linear-gradient(135deg, #b91c1c 0%, #dc2626 100%); }
    `;
    document.head.appendChild(style);
  }
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.setAttribute('role', 'alert');
  notification.textContent = message;
  document.body.appendChild(notification);
  
  requestAnimationFrame(() => {
    requestAnimationFrame(() => notification.classList.add('show'));
  });
  
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => {
      if (notification.parentNode) document.body.removeChild(notification);
    }, 300);
  }, 3500);
}

async function loadStats() {
  const ids = ['totalLinks', 'totalClicks', 'recentClicks', 'avgClicks'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = '…';
  });
  try {
    const stats = await fetchAPI('/analytics/stats');
    const totalLinks = Number(stats?.totalLinks) ?? 0;
    const totalClicks = Number(stats?.totalClicks) ?? 0;
    const recentClicks = Number(stats?.recentClicks) ?? 0;
    document.getElementById('totalLinks').textContent = totalLinks.toLocaleString();
    document.getElementById('totalClicks').textContent = totalClicks.toLocaleString();
    document.getElementById('recentClicks').textContent = recentClicks.toLocaleString();
    document.getElementById('avgClicks').textContent = totalLinks > 0 ? (totalClicks / totalLinks).toFixed(1) : '0';
  } catch (err) {
    document.getElementById('totalLinks').textContent = '0';
    document.getElementById('totalClicks').textContent = '0';
    document.getElementById('recentClicks').textContent = '0';
    document.getElementById('avgClicks').textContent = '0';
    showNotification('Failed to load stats: ' + err.message, 'error');
  }
}

async function loadLinks() {
  const container = document.getElementById('linksCards');
  if (container) {
    container.innerHTML = '<div class="empty-state loading-state"><div class="loading-spinner"></div><div class="empty-state-text">Loading links…</div></div>';
  }
  try {
    const links = await fetchAPI('/links');
    if (!container) return;
    container.innerHTML = '';

    if (!Array.isArray(links) || links.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon"><svg class="icon-svg"><use href="icons.svg#icon-link"></use></svg></div>
          <div class="empty-state-text">No links created yet</div>
          <div class="empty-state-description">Create your first trackable link above to get started</div>
        </div>
      `;
      return;
    }

    links.forEach(link => {
      const card = document.createElement('div');
      card.className = 'link-card';
      const domains = link.customDomains || [];
      const domainsHtml = domains.length > 0
        ? domains.map(d => `<span class="domain-badge ${d.isPrimary ? 'primary' : ''}">${escapeHtml(d.domain)}</span>`).join(' ')
        : '';

      const destUrl = escapeHtml(link.destinationUrl);
      const trackId = escapeHtml(link.trackingId);
      const safeId = String(link.trackingId).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/[\r\n"<>();`]/g, '');
      const destDisplay = escapeHtml(truncateUrl(link.destinationUrl, 50));
      const created = escapeHtml(formatDate(link.createdAt));

      // Use the primary custom domain if available, otherwise fall back to current site origin
      const primaryDomain = domains.find(d => d.isPrimary);
      const linkDomain = primaryDomain ? `https://${primaryDomain.domain}` : (domains.length > 0 ? `https://${domains[0].domain}` : window.location.origin);
      const shortUrl = `${linkDomain}/click?id=${String(link.trackingId)}`;
      card.innerHTML = `
        <div class="link-card-main">
          <div class="link-card-field">
            <span class="link-card-label">Tracking ID</span>
            <code class="link-card-id">${trackId}</code>
          </div>
          <div class="link-card-field">
            <span class="link-card-label">Tracking Link</span>
            <code class="link-card-url">${escapeHtml(shortUrl)}</code>
          </div>
          <div class="link-card-field">
            <span class="link-card-label">Redirects To</span>
            <a href="${String(link.destinationUrl).replace(/"/g, '&quot;')}" target="_blank" rel="noopener noreferrer" class="link-card-destination" title="${destUrl}">${destDisplay}</a>
          </div>
          <div class="link-card-meta">
            <span class="link-card-clicks"><strong>${Number(link.clickCount) || 0}</strong> click${(Number(link.clickCount) || 0) === 1 ? '' : 's'}</span>
            <span class="link-card-created">Created ${created}</span>
          </div>
          ${domainsHtml ? `<div class="link-card-domains">${domainsHtml}</div>` : ''}
        </div>
        <div class="link-card-actions">
          <button type="button" class="action-btn" onclick="viewEvents('${safeId}')" title="View detailed click analytics and fingerprint data">
            <svg class="icon-svg" aria-hidden="true"><use href="icons.svg#icon-analytics"></use></svg> Analytics
          </button>
          <button type="button" class="action-btn" onclick="showAddDomainForLink('${safeId}')" title="Assign a custom domain to this tracking link">
            <svg class="icon-svg" aria-hidden="true"><use href="icons.svg#icon-globe"></use></svg> Domain
          </button>
          <button type="button" class="action-btn delete" onclick="deleteLink('${safeId}')" title="Permanently delete this link and all its analytics">
            <svg class="icon-svg" aria-hidden="true"><use href="icons.svg#icon-trash"></use></svg> Delete
          </button>
        </div>
      `;
      container.appendChild(card);
    });
  } catch (err) {
    console.error('Failed to load links:', err);
    if (container) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state-icon"><svg class="icon-svg"><use href="icons.svg#icon-warning"></use></svg></div><div class="empty-state-text">Failed to load links</div><div class="empty-state-description">' + escapeHtml(err.message) + '</div></div>';
    }
    showNotification('Failed to load links', 'error');
  }
}

async function createLink(destinationUrl) {
  const btn = document.querySelector('#createLinkForm button[type="submit"]');
  if (btn) {
    btn.disabled = true;
    btn.setAttribute('aria-busy', 'true');
  }
  const selectedDomain = document.getElementById('linkDomain')?.value || '';
  try {
    const link = await fetchAPI('/links', {
      method: 'POST',
      body: JSON.stringify({ destinationUrl, domain: selectedDomain || undefined }),
    });

    document.getElementById('newShortUrl').value = link.shortUrl || '';
    document.getElementById('createdLink').style.display = 'block';
    document.getElementById('destinationUrl').value = '';

    loadLinks();
    loadStats();
    
    // Auto-select the short URL for easy copying
    document.getElementById('newShortUrl').select();
    
    showNotification('Link created successfully!', 'success');
  } catch (err) {
    console.error('Failed to create link:', err);
    showNotification('Failed to create link: ' + err.message, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.removeAttribute('aria-busy');
    }
  }
}

async function deleteLink(trackingId) {
  if (!confirm('Are you sure you want to delete this link and all its click data?')) return;

  try {
    await fetchAPI(`/links/${trackingId}`, { method: 'DELETE' });
    loadLinks();
    loadStats();
    
    if (document.getElementById('selectedLinkId').textContent === trackingId) {
      closeEvents();
    }
    
    showNotification('Link deleted successfully!', 'success');
  } catch (err) {
    console.error('Failed to delete link:', err);
    showNotification('Failed to delete link: ' + err.message, 'error');
  }
}

async function viewEvents(trackingId) {
  document.getElementById('selectedLinkId').textContent = trackingId;
  fingerprintDataCache = null;
  behaviorDataCache = null;
  const eventsSection = document.getElementById('eventsSection');
  eventsSection.style.display = 'block';
  eventsSection.scrollIntoView({ behavior: 'smooth' });
  const analyticsGrid = eventsSection.querySelector('.analytics-grid');
  const chartsGrid = eventsSection.querySelector('.charts-grid');
  const eventsGrid = document.getElementById('eventsGrid');
  if (analyticsGrid) analyticsGrid.style.opacity = '0.5';
  if (chartsGrid) chartsGrid.style.opacity = '0.5';
  if (eventsGrid) eventsGrid.innerHTML = '<div class="empty-state loading-state" style="grid-column:1/-1"><div class="loading-spinner"></div><div class="empty-state-text">Loading analytics…</div></div>';

  try {
    const [events, countries, devices, browsers, timeline, os, languages, referrers, cities, isps, security, utm] = await Promise.all([
      fetchAPI(`/analytics/links/${trackingId}/events?limit=100`),
      fetchAPI(`/analytics/links/${trackingId}/countries`),
      fetchAPI(`/analytics/links/${trackingId}/devices`),
      fetchAPI(`/analytics/links/${trackingId}/browsers`),
      fetchAPI(`/analytics/links/${trackingId}/timeline?days=7`),
      fetchAPI(`/analytics/links/${trackingId}/os`),
      fetchAPI(`/analytics/links/${trackingId}/languages`),
      fetchAPI(`/analytics/links/${trackingId}/referrers`),
      fetchAPI(`/analytics/links/${trackingId}/cities`),
      fetchAPI(`/analytics/links/${trackingId}/isps`),
      fetchAPI(`/analytics/links/${trackingId}/security`),
      fetchAPI(`/analytics/links/${trackingId}/utm`)
    ]);

    window.__currentAnalyticsTrackingId = trackingId;
    const exportBtn = document.getElementById('exportCsvBtn');
    if (exportBtn) exportBtn.style.display = 'inline-flex';

    if (analyticsGrid) analyticsGrid.style.opacity = '';
    if (chartsGrid) chartsGrid.style.opacity = '';
    renderOverviewStats(events);
    renderEvents(events);
    renderChart('countriesChart', countries, 'country');
    renderChart('devicesChart', devices, 'deviceType');
    renderChart('browsersChart', browsers, 'browser');
    renderTimeline(timeline);
    renderChart('osChart', os, 'os');
    renderChart('ispsChart', isps, 'isp');
    renderList('referrersList', referrers, 'referrer');
    renderList('citiesList', cities, 'city');
    renderSecurityStats(security);
    renderUtmCharts(utm);
  } catch (err) {
    console.error('Failed to load events:', err);
    if (analyticsGrid) analyticsGrid.style.opacity = '';
    if (chartsGrid) chartsGrid.style.opacity = '';
    if (eventsGrid) eventsGrid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><div class="empty-state-icon"><svg class="icon-svg"><use href="icons.svg#icon-warning"></use></svg></div><div class="empty-state-text">Failed to load analytics.</div></div>';
    showNotification('Failed to load analytics data', 'error');
  }
}

function renderOverviewStats(events) {
  const totalClicks = events.length;
  const uniqueIps = new Set(events.map(e => e.ipFull || e.ipTruncated).filter(Boolean)).size;
  const countries = new Set(events.map(e => e.country).filter(Boolean)).size;
  const lastClick = events.length > 0 ? formatRelativeTime(events[0].timestamp) : 'N/A';
  const vpnProxy = events.filter(e => e.isVpn || e.isProxy || e.isTor || e.isHosting).length;
  const botCount = events.filter(e => e.isLikelyBot === true).length;
  const webrtcLeaks = events.filter(e => e.webrtcLeakDetected === true).length;

  document.getElementById('eventTotalClicks').textContent = totalClicks.toLocaleString();
  document.getElementById('eventUniqueIps').textContent = uniqueIps.toLocaleString();
  document.getElementById('eventCountries').textContent = countries.toLocaleString();
  document.getElementById('eventVpnProxy').textContent = vpnProxy.toLocaleString();
  document.getElementById('eventLastClick').textContent = lastClick;
  document.getElementById('eventBots').textContent = botCount.toLocaleString();
  const webrtcEl = document.getElementById('eventWebrtcLeaks');
  if (webrtcEl) webrtcEl.textContent = webrtcLeaks.toLocaleString();
}

function renderSecurityStats(security) {
  if (!security) return;
  const s = security.summary || security;
  document.getElementById('securityVpn').textContent = s.vpnCount || s.vpn || 0;
  document.getElementById('securityProxy').textContent = s.proxyCount || s.proxy || 0;
  document.getElementById('securityTor').textContent = s.torCount || s.tor || 0;
  document.getElementById('securityHosting').textContent = s.hostingCount || s.hosting || 0;
  const webrtcEl = document.getElementById('securityWebrtc');
  if (webrtcEl) webrtcEl.textContent = s.webrtcLeakCount || s.webrtcLeak || s.webrtcLeaks || 0;
}

function renderUtmCharts(utm) {
  if (!utm) return;
  const formatSrc = (arr) => (arr || []).map(item => ({ label: item.source || item.label || 'Unknown', _count: item.count || item._count || 0 }));
  const formatMed = (arr) => (arr || []).map(item => ({ label: item.medium || item.label || 'Unknown', _count: item.count || item._count || 0 }));
  const formatCmp = (arr) => (arr || []).map(item => ({ label: item.campaign || item.label || 'Unknown', _count: item.count || item._count || 0 }));
  renderChart('utmSourceChart', formatSrc(utm.sources || utm.bySource), 'label');
  renderChart('utmMediumChart', formatMed(utm.mediums || utm.byMedium), 'label');
  renderChart('utmCampaignChart', formatCmp(utm.campaigns || utm.byCampaign), 'label');
}

const EVENTS_PAGE_SIZE = 24;
let __eventsAll = [];
let __eventsShown = 0;

function renderEventCard(event) {
  const location = [event.city, event.region, event.country].filter(Boolean).join(', ') || '-';
  const address = event.address || (location !== '-' ? location : '-');
  const browser = event.browser && event.browser !== 'Unknown' ? `${event.browser} ${event.browserVersion || ''}`.trim() : '-';
  const os = event.os && event.os !== 'Unknown' ? `${event.os} ${event.osVersion || ''}`.trim() : '-';
  const securityBadges = [];
  if (event.isVpn) securityBadges.push('<span class="security-badge vpn">VPN</span>');
  if (event.isProxy) securityBadges.push('<span class="security-badge proxy">Proxy</span>');
  if (event.isTor) securityBadges.push('<span class="security-badge tor">Tor</span>');
  if (event.isHosting) securityBadges.push('<span class="security-badge hosting">Hosting</span>');
  if (event.isMobileCarrier) securityBadges.push('<span class="security-badge mobile">Mobile</span>');
  if (event.webrtcLeakDetected) securityBadges.push('<span class="security-badge webrtc" title="Real IP exposed via WebRTC">WebRTC</span>');
  if (event.isLikelyBot || event.clientBot) securityBadges.push('<span class="security-badge bot">Bot</span>');
  const timestamp = typeof event.timestamp === 'string' || event.timestamp instanceof Date ? formatDate(event.timestamp) : '-';
  const tzStr = event.timezoneOffset != null ? formatTimezoneOffset(event.timezoneOffset) : '-';
  const screenStr = event.screenResolution || (event.viewportWidth != null && event.viewportHeight != null ? `${event.viewportWidth}x${event.viewportHeight}` : '-');
  const utmParts = [event.utmSource, event.utmMedium, event.utmCampaign, event.utmTerm, event.utmContent].filter(Boolean);
  const utmStr = utmParts.length ? utmParts.join(' / ') : '-';
  const webrtcRealLoc = (event.webrtcRealCity && event.webrtcRealCountry) ? `${event.webrtcRealCity}, ${event.webrtcRealCountry}` : (event.webrtcRealCountry || '');
  const webrtcRow = event.webrtcLeakDetected && event.webrtcRealIp
    ? `<div class="event-card-row"><span class="event-card-label">Real IP</span><span class="event-card-value copyable" title="Click to copy">${escapeHtml(event.webrtcRealIp)}</span></div>`
    : '';
  const rows = [
    `<div class="event-card-row"><span class="event-card-label">Location</span><span class="event-card-value">${escapeHtml(location)}</span></div>`,
    address !== location ? `<div class="event-card-row"><span class="event-card-label">Address</span><span class="event-card-value">${escapeHtml(address)}</span></div>` : '',
    event.continent ? `<div class="event-card-row"><span class="event-card-label">Continent</span><span class="event-card-value">${escapeHtml(event.continent)}</span></div>` : '',
    `<div class="event-card-row"><span class="event-card-label">IP</span><span class="event-card-value copyable" title="Click to copy">${escapeHtml(event.ipFull || event.ipTruncated || 'N/A')}</span></div>`,
    webrtcRow,
    `<div class="event-card-row"><span class="event-card-label">ISP</span><span class="event-card-value">${escapeHtml(event.isp || '-')}</span></div>`,
    event.asn ? `<div class="event-card-row"><span class="event-card-label">ASN</span><span class="event-card-value copyable" title="Click to copy">${escapeHtml('AS' + event.asn)}</span></div>` : '',
    `<div class="event-card-row"><span class="event-card-label">Device</span><span class="event-card-value">${escapeHtml(event.deviceType || '-')}</span></div>`,
    `<div class="event-card-row"><span class="event-card-label">Browser</span><span class="event-card-value">${escapeHtml(browser)}</span></div>`,
    `<div class="event-card-row"><span class="event-card-label">OS</span><span class="event-card-value">${escapeHtml(os)}</span></div>`,
    `<div class="event-card-row"><span class="event-card-label">Screen</span><span class="event-card-value">${escapeHtml(screenStr)}</span></div>`,
    `<div class="event-card-row"><span class="event-card-label">TZ</span><span class="event-card-value">${escapeHtml(tzStr)}</span></div>`,
    event.clickSource ? `<div class="event-card-row"><span class="event-card-label">Source</span><span class="event-card-value">${escapeHtml(event.clickSource)}</span></div>` : '',
    utmStr !== '-' ? `<div class="event-card-row"><span class="event-card-label">UTM</span><span class="event-card-value">${escapeHtml(utmStr)}</span></div>` : ''
  ].filter(Boolean);
  return `
    <div class="event-card">
      <div class="event-card-header">
        <span class="event-card-time">${escapeHtml(timestamp)}</span>
        <div class="event-card-badges">${securityBadges.join('')}</div>
      </div>
      ${rows.join('')}
    </div>
  `;
}

function renderEvents(events) {
  __eventsAll = events || [];
  __eventsShown = 0;
  const grid = document.getElementById('eventsGrid');
  const loadMoreBtn = document.getElementById('loadMoreEventsBtn');
  const countEl = document.getElementById('eventsCount');
  if (!grid) return;

  if (__eventsAll.length === 0) {
    const exportBtn = document.getElementById('exportCsvBtn');
    if (exportBtn) exportBtn.style.display = 'none';
    if (loadMoreBtn) loadMoreBtn.style.display = 'none';
    if (countEl) countEl.textContent = '';
    grid.innerHTML = `
      <div class="empty-state" style="grid-column: 1/-1; padding: 3rem 1rem;">
        <div class="empty-state-icon"><svg class="icon-svg"><use href="icons.svg#icon-eye"></use></svg></div>
        <div class="empty-state-text">No click events recorded</div>
        <div class="empty-state-description">Share your tracking link to start collecting data</div>
      </div>
    `;
    return;
  }

  if (countEl) countEl.textContent = `${__eventsAll.length} event${__eventsAll.length !== 1 ? 's' : ''}`;
  grid.innerHTML = '';
  loadMoreEvents();
}

function loadMoreEvents() {
  const grid = document.getElementById('eventsGrid');
  const loadMoreBtn = document.getElementById('loadMoreEventsBtn');
  if (!grid || __eventsAll.length === 0) return;

  const nextBatch = __eventsAll.slice(__eventsShown, __eventsShown + EVENTS_PAGE_SIZE);
  __eventsShown += nextBatch.length;

  nextBatch.forEach(event => {
    grid.insertAdjacentHTML('beforeend', renderEventCard(event));
  });

  // Make event card values copyable
  setTimeout(() => {
    makeCopyable('.event-card-value.copyable');
  }, 50);

  if (loadMoreBtn) {
    loadMoreBtn.style.display = __eventsShown < __eventsAll.length ? 'inline-flex' : 'none';
    loadMoreBtn.textContent = __eventsShown < __eventsAll.length ? `Load more (${__eventsAll.length - __eventsShown} remaining)` : '';
  }
}

function renderChart(containerId, data, labelKey) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';

  if (!data || data.length === 0) {
    container.innerHTML = `
        <div class="empty-state">
        <div class="empty-state-icon"><svg class="icon-svg"><use href="icons.svg#icon-bar"></use></svg></div>
        <div class="empty-state-text">No data available</div>
      </div>
    `;
    return;
  }

  const maxCount = Math.max(...data.map(d => d._count || d.count));
  const topItems = data.slice(0, 6);

  topItems.forEach(item => {
    const count = item._count || item.count;
    const label = item[labelKey] || 'Unknown';
    const safeLabel = escapeHtml(String(label));
    const percentage = maxCount > 0 ? (count / maxCount) * 100 : 0;

    const bar = document.createElement('div');
    bar.className = 'chart-bar';
    bar.innerHTML = `
      <span class="chart-bar-label" title="${safeLabel}">${safeLabel}</span>
      <div class="chart-bar-track">
        <div class="chart-bar-fill" style="width: ${percentage}%"></div>
      </div>
      <span class="chart-bar-value">${escapeHtml(String(count))}</span>
    `;
    container.appendChild(bar);
  });
}

function renderTimeline(data) {
  const container = document.getElementById('timelineChart');
  container.innerHTML = '';

  if (!data || data.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon"><svg class="icon-svg"><use href="icons.svg#icon-chart"></use></svg></div>
        <div class="empty-state-text">No timeline data available</div>
      </div>
    `;
    return;
  }

  const maxCount = Math.max(...data.map(d => d.count), 1);

  data.forEach(item => {
    const height = maxCount > 0 ? (item.count / maxCount) * 80 : 0;
    const bar = document.createElement('div');
    bar.className = 'timeline-bar';
    bar.style.height = `${Math.max(height, 4)}px`;
    bar.setAttribute('data-date', item.date);
    bar.title = `${item.date}: ${item.count} clicks`;
    container.appendChild(bar);
  });
}

function renderList(containerId, data, labelKey) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';

  if (!data || data.length === 0) {
    container.innerHTML = `
      <div class="stat-list-item">
        <span class="stat-list-item-label">No data available</span>
      </div>
    `;
    return;
  }

  const topItems = data.slice(0, 5);

  topItems.forEach(item => {
    const count = item._count || item.count;
    const label = item[labelKey] || 'Unknown';
    const safeLabel = escapeHtml(truncateText(String(label), 35));
    const safeCount = escapeHtml(String(count));

    const listItem = document.createElement('div');
    listItem.className = 'stat-list-item';
    listItem.innerHTML = `
      <span class="stat-list-item-label" title="${escapeHtml(label)}">${safeLabel}</span>
      <span class="stat-list-item-value">${safeCount}</span>
    `;
    container.appendChild(listItem);
  });
}

function closeEvents() {
  const section = document.getElementById('eventsSection');
  const exportBtn = document.getElementById('exportCsvBtn');
  if (section) section.style.display = 'none';
  if (exportBtn) exportBtn.style.display = 'none';
  window.__currentAnalyticsTrackingId = null;
  document.querySelectorAll('.analytics-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === 'overview');
    t.setAttribute('aria-selected', t.dataset.tab === 'overview' ? 'true' : 'false');
  });
  document.querySelectorAll('.analytics-tab-panel').forEach(p => {
    p.hidden = p.id !== 'tabOverview';
  });
}

function exportEventsCsv() {
  const id = window.__currentAnalyticsTrackingId;
  const btn = document.getElementById('exportCsvBtn');
  if (!id || !btn) return;
  const url = `${API_BASE}/analytics/links/${encodeURIComponent(id)}/events/export?format=csv&limit=5000`;
  const a = document.createElement('a');
  a.href = url;
  a.download = `events-${id}.csv`;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showNotification('CSV download started', 'success');
}

function copyToClipboard() {
  const input = document.getElementById('newShortUrl');
  if (!input || !input.value.trim()) return;
  input.select();
  navigator.clipboard.writeText(input.value).then(() => {
    const btn = document.querySelector('.copy-btn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<svg class="icon-svg"><use href="icons.svg#icon-check"></use></svg> Copied!';
    setTimeout(() => btn.innerHTML = originalText, 1500);
    showNotification('Link copied to clipboard!', 'success');
  }).catch(() => {
    document.execCommand('copy');
    showNotification('Link copied to clipboard!', 'success');
  });
}

function copyValue(value, event) {
  if (!value || value === '-' || value === 'N/A' || value === 'Not available' || value === 'Not tracked') return;
  
  const target = event?.target;
  if (!target) return;
  
  navigator.clipboard.writeText(String(value)).then(() => {
    const originalText = target.textContent;
    target.classList.add('copied');
    target.textContent = 'Copied!';
    
    setTimeout(() => {
      target.classList.remove('copied');
      if (originalText) target.textContent = originalText;
    }, 1200);
  }).catch(() => {
    showNotification('Failed to copy', 'error');
  });
}

function makeCopyable(selector) {
  try {
    document.querySelectorAll(selector).forEach(el => {
      if (el.classList.contains('copyable-added')) return;
      el.classList.add('copyable-added');
      
      const value = el.textContent.trim();
      if (value && value !== '-' && value !== 'N/A' && value !== 'Not available' && value !== 'Not tracked') {
        el.classList.add('copyable');
        el.tabIndex = 0;
        el.setAttribute('role', 'button');
        el.setAttribute('aria-label', 'Click to copy ' + value);
        
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          copyValue(value, e);
        });
        
        el.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            copyValue(value, e);
          }
        });
      }
    });
  } catch (err) {
    console.warn('makeCopyable error:', err);
  }
}

function refreshData() {
  loadStats();
  loadLinks();
  showNotification('Data refreshed!', 'success');
}

function truncateUrl(url, maxLen = 45) {
  try {
    const urlObj = new URL(url);
    const display = urlObj.hostname + urlObj.pathname;
    return display.length > maxLen ? display.substring(0, maxLen) + '...' : display;
  } catch {
    return url.length > maxLen ? url.substring(0, maxLen) + '...' : url;
  }
}

function truncateText(text, maxLen = 30) {
  if (text == null || typeof text !== 'string') return '';
  return text.length > maxLen ? text.substring(0, maxLen) + '...' : text;
}

function formatDate(dateStr) {
  if (dateStr == null) return '';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatRelativeTime(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(dateStr);
}

function formatTimezoneOffset(minutes) {
  if (minutes == null || !Number.isFinite(minutes)) return '-';
  const m = Number(minutes);
  const hours = Math.abs(Math.floor(m / 60));
  const sign = m <= 0 ? '+' : '-';
  return `UTC${sign}${hours}`;
}

function formatReferrer(referrer) {
  if (!referrer) return '<span style="color: var(--text-muted)">Direct</span>';
  try {
    const url = new URL(referrer);
    const domain = url.hostname.replace('www.', '');
    return `<a href="${referrer}" target="_blank" title="${referrer}">${domain}</a>`;
  } catch {
    return truncateText(referrer, 20);
  }
}

async function showDomainModal() {
  const modal = document.getElementById('domainModal');
  if (modal) {
    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');
  }
  await loadDomainsForModal();
  await loadLinksForSelect();
}

function closeDomainModal() {
  const modal = document.getElementById('domainModal');
  if (modal) {
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
  }
}

async function loadDomainsForModal() {
  try {
    const domains = await fetchAPI('/domains');
    const container = document.getElementById('domainsList');
    
    if (!domains || domains.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state-text">No custom domains configured</div></div>';
      return;
    }
    
    container.innerHTML = domains.map(d => {
      const safeDomain = escapeHtml(d.domain);
      const domainForJs = String(d.domain).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      const linkIdForJs = String(d.linkId).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      return `
      <div class="domain-item">
        <div class="domain-info">
          <span class="domain-name ${d.isPrimary ? 'primary' : ''}">${safeDomain}</span>
          <span class="domain-link">→ ${escapeHtml(truncateUrl(d.destinationUrl))}</span>
        </div>
        <div class="domain-actions">
          ${d.sslEnabled ? '<span class="ssl-badge">SSL</span>' : ''}
          <button type="button" class="action-btn delete" onclick="deleteDomain('${domainForJs}', '${linkIdForJs}')">Delete</button>
        </div>
      </div>
    `;
    }).join('');
  } catch (err) {
    console.error('Failed to load domains:', err);
  }
}

async function loadLinksForSelect() {
  try {
    const links = await fetchAPI('/links');
    const select = document.getElementById('linkSelect');
    if (!select) return;
    if (!links || links.length === 0) {
      select.innerHTML = '<option value="">No links yet — create one first</option>';
      return;
    }
    const options = links.map(l => {
      const safeId = escapeHtml(l.trackingId);
      const safeLabel = escapeHtml(truncateUrl(l.destinationUrl, 40));
      return `<option value="${safeId}">${safeLabel}</option>`;
    });
    select.innerHTML = '<option value="">Select a link</option>' + options.join('');
  } catch (err) {
    console.error('Failed to load links:', err);
  }
}

function showAddDomainForLink(trackingId) {
  const modal = document.getElementById('domainModal');
  if (modal) modal.style.display = 'flex';
  loadLinksForSelect().then(() => {
    const select = document.getElementById('linkSelect');
    if (select) select.value = trackingId || '';
  });
  loadDomainsForModal();
}

document.getElementById('addDomainForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const domain = document.getElementById('domainInput').value.trim();
  const linkId = document.getElementById('linkSelect').value;
  const isPrimary = document.getElementById('isPrimary').checked;
  if (!linkId) {
    showNotification('Please select a link first', 'error');
    return;
  }
  try {
    await fetchAPI(`/links/${linkId}/domains`, {
      method: 'POST',
      body: JSON.stringify({ domain, isPrimary })
    });
    showNotification('Domain added successfully!', 'success');
    document.getElementById('domainInput').value = '';
    loadDomainsForModal();
    loadLinks();
  } catch (err) {
    showNotification('Failed to add domain: ' + err.message, 'error');
  }
});

async function deleteDomain(domain, linkId) {
  if (!confirm(`Delete domain ${domain}?`)) return;

  try {
    const encodedDomain = encodeURIComponent(domain);
    await fetchAPI(`/links/${linkId || '_'}/domains/${encodedDomain}`, { method: 'DELETE' });
    showNotification('Domain deleted!', 'success');
    loadDomainsForModal();
    loadLinks();
  } catch (err) {
    showNotification('Failed to delete domain: ' + err.message, 'error');
  }
}

document.getElementById('createLinkForm').addEventListener('submit', (e) => {
  e.preventDefault();
  let url = document.getElementById('destinationUrl').value.trim();
  if (!url) {
    showNotification('Enter a URL or username', 'error');
    return;
  }
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://throne.com/' + url;
  }
  createLink(url);
});

function focusCreateForm() {
  const wrap = document.getElementById('createFormWrap');
  const section = document.getElementById('createSection');
  if (wrap?.classList.contains('collapsed')) {
    wrap.classList.remove('collapsed');
    const icon = document.getElementById('createToggle')?.querySelector('.toggle-icon');
    if (icon) icon.textContent = '−';
  }
  section?.scrollIntoView({ behavior: 'smooth' });
  document.getElementById('destinationUrl')?.focus();
}

function initCreateToggle() {
  const toggle = document.getElementById('createToggle');
  const wrap = document.getElementById('createFormWrap');
  if (!toggle || !wrap) return;
  const isMobile = () => window.innerWidth < 768;
  if (isMobile()) wrap.classList.add('collapsed');
  const doToggle = () => {
    if (!isMobile()) return;
    wrap.classList.toggle('collapsed');
    const icon = toggle.querySelector('.toggle-icon');
    if (icon) icon.textContent = wrap.classList.contains('collapsed') ? '+' : '−';
    toggle.setAttribute('aria-expanded', wrap.classList.contains('collapsed') ? 'false' : 'true');
  };
  toggle.addEventListener('click', doToggle);
  toggle.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); doToggle(); } });
  window.addEventListener('resize', () => {
    if (!isMobile()) wrap.classList.remove('collapsed');
  });
}

function initAnalyticsTabs() {
  const tabs = document.querySelectorAll('.analytics-tab');
  const panels = document.querySelectorAll('.analytics-tab-panel');
  const idMap = { overview: 'tabOverview', charts: 'tabCharts', fingerprint: 'tabFingerprint', behavior: 'tabBehavior', events: 'tabEvents' };
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      const panelId = idMap[target];
      tabs.forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
      panels.forEach(p => { p.hidden = p.id !== panelId; });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      
      if (target === 'fingerprint') {
        try { loadFingerprintData(); } catch(e) { console.error('Fingerprint tab error:', e); }
      }
      if (target === 'behavior') {
        try { loadBehaviorData(); } catch(e) { console.error('Behavior tab error:', e); }
      }
    });
  });
}

let fingerprintDataCache = null;
let behaviorDataCache = null;

async function loadFingerprintData() {
  const trackingId = getSelectedTrackingId();
  if (!trackingId) return;
  
  if (fingerprintDataCache) {
    renderFingerprintData(fingerprintDataCache);
    return;
  }

  try {
    const [stats, analysis] = await Promise.all([
      fetchAPI(`/links/${trackingId}/fingerprint-stats`),
      fetchAPI(`/links/${trackingId}/fingerprint-analysis`)
    ]);
    fingerprintDataCache = { stats, analysis };
    renderFingerprintData({ stats, analysis });
  } catch (e) {
    console.error('Failed to load fingerprint data:', e);
    const grid = document.getElementById('fingerprintStatsGrid');
    if (grid) grid.innerHTML = `<p style="color:var(--danger)">Failed to load fingerprint data: ${e.message}</p>`;
  }
}

function renderFingerprintData({ stats, analysis }) {
  stats = stats || {};
  analysis = analysis || {};
  
  const fpHeaderStats = document.getElementById('fpHeaderStats');
  if (!fpHeaderStats) return;
  
  // Header stats pills
  fpHeaderStats.innerHTML = `
    <div class="stat-pill"><span class="num">${stats.botDetection?.uniqueFingerprints || 0}</span> <span class="lbl">Unique Fingerprints</span></div>
    <div class="stat-pill"><span class="num">${stats.botDetection?.totalBots || 0}</span> <span class="lbl">Bots</span></div>
    <div class="stat-pill"><span class="num">${stats.botDetection?.headless || 0}</span> <span class="lbl">Headless</span></div>
    <div class="stat-pill"><span class="num">${stats.fingerprinting?.webrtcLeaks || 0}</span> <span class="lbl">WebRTC Leaks</span></div>
    <div class="stat-pill"><span class="num">${stats.security?.vpn || 0}</span> <span class="lbl">VPN/Proxy</span></div>
    <div class="stat-pill"><span class="num">${stats.devices?.mobile || 0}</span> <span class="lbl">Mobile</span></div>
  `;

  // Load events for detailed display
  loadFingerprintEventsForList().then(() => {
    // Make values copyable after rendering
    setTimeout(() => {
      makeCopyable('#fpIdentityCard .field-value');
      makeCopyable('#fpDeviceCard .field-value');
      makeCopyable('#fpBrowserCard .field-value');
      makeCopyable('#fpSecurityCard .field-value');
      makeCopyable('#fpNetworkCard .field-value');
      makeCopyable('#fpLocationCard .field-value');
      makeCopyable('#fpCanvasCard .field-value');
      makeCopyable('#fpHardwareCard .field-value');
      makeCopyable('.fp-event-field .value');
    }, 100);
  });
}

async function loadFingerprintEventsForList() {
  const trackingId = getSelectedTrackingId();
  if (!trackingId) return;
  
  try {
    const events = await fetchAPI(`/links/${trackingId}/fingerprint?limit=20`);
    
    const fpRecordCount = document.getElementById('fpRecordCount');
    if (fpRecordCount) fpRecordCount.textContent = `${events?.length || 0} records`;
    
    const fpEventsList = document.getElementById('fpEventsList');
    if (!fpEventsList) return;
    
    if (!events || events.length === 0) {
      fpEventsList.innerHTML = '<div class="empty-state">No fingerprint data collected yet</div>';
      return;
    }

    // Show first event in detail cards
    const e = events[0];
    
    // Helper for tooltips
    const tip = (text) => `<span class="tooltip-container"><span class="help-icon" tabindex="0">?</span><span class="tooltip-text">${text}</span></span>`;
    
    // Identity Card
    const fpIdentityCard = document.getElementById('fpIdentityCard');
    fpIdentityCard.innerHTML = `
      <div class="data-row"><span class="field-name">Fingerprint Hash ${tip('Unique identifier generated from browser fingerprint')}</span><span class="field-value">${e.fingerprintHash ? e.fingerprintHash : 'Not available'}</span></div>
      <div class="data-row"><span class="field-name">Canvas Fingerprint ${tip('Unique signature from HTML5 canvas rendering')}</span><span class="field-value">${e.canvasFingerprint ? 'Available' : 'Not available'}</span></div>
      <div class="data-row"><span class="field-name">Canvas Hash</span><span class="field-value">${e.canvasFingerprint || '-'}</span></div>
    `;

    // Device Card
    const fpDeviceCard = document.getElementById('fpDeviceCard');
    fpDeviceCard.innerHTML = `
      <div class="data-row"><span class="field-name">Device Type ${tip('Type of device: Mobile, Tablet, Desktop')}</span><span class="field-value">${e.deviceType || 'Unknown'}</span></div>
      <div class="data-row"><span class="field-name">Device Brand</span><span class="field-value">${e.deviceBrand || 'Unknown'}</span></div>
      <div class="data-row"><span class="field-name">Device Model</span><span class="field-value">${e.deviceModel || 'Unknown'}</span></div>
      <div class="data-row"><span class="field-name">Screen Resolution ${tip('Display resolution in pixels')}</span><span class="field-value">${e.screenResolution || 'N/A'}</span></div>
      <div class="data-row"><span class="field-name">Viewport Size</span><span class="field-value">${e.viewportWidth || '?'}x${e.viewportHeight || '?'}</span></div>
    `;

    // Browser Card
    const fpBrowserCard = document.getElementById('fpBrowserCard');
    fpBrowserCard.innerHTML = `
      <div class="data-row"><span class="field-name">Browser</span><span class="field-value">${e.browser || 'Unknown'} ${e.browserVersion || ''}</span></div>
      <div class="data-row"><span class="field-name">Operating System</span><span class="field-value">${e.os || 'Unknown'} ${e.osVersion || ''}</span></div>
      <div class="data-row"><span class="field-name">Platform</span><span class="field-value">${e.platform || 'Unknown'}</span></div>
      <div class="data-row"><span class="field-name">Language</span><span class="field-value">${e.language || 'Unknown'}</span></div>
      <div class="data-row"><span class="field-name">User Agent ${tip('Full browser identification string')}</span><span class="field-value">${e.userAgent || 'N/A'}</span></div>
    `;

    // Security Card - VPN, WebRTC leak detection, Threat Analysis
    const hasVpn = e.isVpn;
    const hasProxy = e.isProxy;
    const hasTor = e.isTor;
    const hasHosting = e.isHosting || e.isDatacenter;
    const hasWebrtcLeak = e.webrtcLeakDetected || e.webrtcLeak;
    const realIpDetected = e.realIpDetected || (e.realIp ? true : false);
    const threatScore = e.threatScore || 0;
    const threatLevel = e.threatLevel || 'low';
    
    // Parse WebRTC IPs properly
    let webrtcIpsList = [];
    if (e.webrtcIps || e.webrtcPublicIps) {
      try {
        const raw = e.webrtcPublicIps || e.webrtcIps;
        webrtcIpsList = typeof raw === 'string' ? JSON.parse(raw) : (raw || []);
      } catch (err) {
        webrtcIpsList = [];
      }
    }
    const webrtcIpsDisplay = webrtcIpsList.length > 0 ? webrtcIpsList.join(', ') : null;
    
    // Parse detection methods
    let detectionMethods = [];
    if (e.detectionMethods) {
      try {
        detectionMethods = typeof e.detectionMethods === 'string' ? JSON.parse(e.detectionMethods) : e.detectionMethods;
      } catch (err) { detectionMethods = []; }
    }
    
    // Parse indicators
    let indicators = [];
    if (e.detectionIndicators) {
      try {
        indicators = typeof e.detectionIndicators === 'string' ? JSON.parse(e.detectionIndicators) : e.detectionIndicators;
      } catch (err) { indicators = []; }
    }
    
    const fpSecurityCard = document.getElementById('fpSecurityCard');
    const botScore = e.botScore || 0;
    const vpnScore = e.vpnScore || 0;
    const isAutomated = e.isAutomated || e.isBot || botScore > 20;
    const isBadActor = e.isBadActor || e.isAttacker || e.isAbuser || threatScore >= 60;
    
    fpSecurityCard.innerHTML = `
      <div class="data-row"><span class="field-name">🎯 Threat Score ${tip('Overall threat level (0-100): higher = more dangerous')}</span><span class="field-value status-badge ${threatScore >= 60 ? 'danger' : threatScore >= 40 ? 'warning' : threatScore >= 20 ? 'info' : 'success'}">${threatScore}/100 ${threatLevel !== 'low' ? '(' + threatLevel.toUpperCase() + ')' : ''}</span></div>
      <div class="data-row"><span class="field-name">🤖 Bot Score ${tip('Probability score: >30 likely bot, >50 definite bot')}</span><span class="field-value status-badge ${botScore > 30 ? 'danger' : botScore > 10 ? 'warning' : 'success'}">${botScore} ${botScore > 30 ? '(BOT)' : ''}</span></div>
      <div class="data-row"><span class="field-name">🛡️ VPN Score ${tip('VPN detection score: higher = more likely VPN/Proxy')}</span><span class="field-value status-badge ${vpnScore > 30 ? 'warning' : vpnScore > 0 ? 'info' : 'success'}">${vpnScore}</span></div>
      <div class="data-row"><span class="field-name">⚠️ Bad Actor ${tip('Known malicious or suspicious activity')}</span><span class="field-value status-badge ${isBadActor ? 'danger' : 'success'}">${isBadActor ? 'YES - THREAT' : 'No'}</span></div>
      <div class="data-row"><span class="field-name">🤖 Automated ${tip('Running in automation (Puppeteer, Selenium, etc)')}</span><span class="field-value status-badge ${isAutomated ? 'danger' : 'success'}">${isAutomated ? 'Yes - AUTOMATED' : 'No'}</span></div>
      <div class="data-row"><span class="field-name">👤 Headless ${tip('Running without visible browser UI')}</span><span class="field-value status-badge ${e.isHeadless ? 'warning' : 'success'}">${e.isHeadless ? 'Yes - HEADLESS' : 'No'}</span></div>
      <div class="data-row"><span class="field-name">🔒 VPN Detected ${tip('Virtual Private Network detected via IP analysis')}</span><span class="field-value status-badge ${hasVpn ? 'danger' : 'success'}">${hasVpn ? 'YES' : 'No'}${e.vpnProvider ? ' (' + e.vpnProvider + ')' : ''}</span></div>
      ${e.vpnType ? `<div class="data-row"><span class="field-name">📋 VPN Type</span><span class="field-value">${e.vpnType}</span></div>` : ''}
      <div class="data-row"><span class="field-name">📦 Proxy Detected</span><span class="field-value status-badge ${hasProxy ? 'warning' : 'success'}">${hasProxy ? 'YES' : 'No'}${e.proxyType ? ' (' + e.proxyType + ')' : ''}</span></div>
      <div class="data-row"><span class="field-name">🧅 Tor Exit Node</span><span class="field-value status-badge ${hasTor ? 'danger' : 'success'}">${hasTor ? 'YES' : 'No'}</span></div>
      <div class="data-row"><span class="field-name">🏢 Datacenter IP ${tip('IP belongs to data center or hosting provider')}</span><span class="field-value status-badge ${hasHosting ? 'warning' : 'success'}">${hasHosting ? 'Yes' : 'No'}</span></div>
      <div class="data-row"><span class="field-name">🔓 WebRTC Leak ${tip('Browser leaked real IP via WebRTC')}</span><span class="field-value status-badge ${hasWebrtcLeak ? 'danger' : 'success'}">${hasWebrtcLeak ? 'DETECTED!' : 'None'}</span></div>
      ${realIpDetected ? `<div class="data-row"><span class="field-name">🔍 Real IP Found ${tip('VPN bypass successful - real IP detected')}</span><span class="field-value" style="color:#dc2626;font-weight:600;">${e.realIp || e.webrtcRealIp || 'N/A'}</span></div>` : ''}
      ${e.realIpCountry ? `<div class="data-row"><span class="field-name">🌍 Real IP Location</span><span class="field-value">${e.realIpCity || ''}, ${e.realIpCountry}${e.realIpIsp ? ' (' + e.realIpIsp + ')' : ''}</span></div>` : ''}
      ${e.bypassMethod ? `<div class="data-row"><span class="field-name">🔧 Bypass Method</span><span class="field-value">${e.bypassMethod} (${e.bypassConfidence || 0}% confidence)</span></div>` : ''}
      ${webrtcIpsDisplay ? `<div class="data-row"><span class="field-name">📡 WebRTC IPs ${tip('All IPs discovered via WebRTC')}</span><span class="field-value" style="font-size:0.65rem;word-break:break-all;">${webrtcIpsDisplay}</span></div>` : ''}
      ${detectionMethods.length > 0 ? `<div class="data-row"><span class="field-name">🔬 Detection Methods</span><span class="field-value" style="font-size:0.65rem;">${detectionMethods.join(', ')}</span></div>` : ''}
      ${indicators.length > 0 ? `<div class="data-row"><span class="field-name">🚩 Indicators</span><span class="field-value" style="font-size:0.65rem;">${indicators.slice(0, 5).join(', ')}${indicators.length > 5 ? ' +' + (indicators.length - 5) + ' more' : ''}</span></div>` : ''}
      ${e.botIndicators ? `<div class="data-row"><span class="field-name">🤖 Bot Indicators ${tip('Specific automation signals detected')}</span><span class="field-value" style="font-size:0.65rem;">${typeof e.botIndicators === 'string' ? e.botIndicators : JSON.parse(e.botIndicators || '[]').join(', ')}</span></div>` : ''}
    `;

    // Network Card
    const fpNetworkCard = document.getElementById('fpNetworkCard');
    const reputation = e.reputation || 'unknown';
    fpNetworkCard.innerHTML = `
      <div class="data-row"><span class="field-name">🌐 IP Address</span><span class="field-value">${e.ipTruncated || 'N/A'}</span></div>
      <div class="data-row"><span class="field-name">📍 Full IP</span><span class="field-value">${e.ipFull || e.ipTruncated || 'N/A'}</span></div>
      <div class="data-row"><span class="field-name">🏢 ISP ${tip('Internet Service Provider')}</span><span class="field-value">${e.isp || 'Unknown'}</span></div>
      <div class="data-row"><span class="field-name">🏛️ Organization</span><span class="field-value">${e.org || 'Unknown'}</span></div>
      <div class="data-row"><span class="field-name">🔗 ASN</span><span class="field-value">${e.asn ? 'AS' + e.asn : 'N/A'}${e.asname ? ' (' + e.asname + ')' : ''}</span></div>
      <div class="data-row"><span class="field-name">🔌 Connection Type</span><span class="field-value">${e.connectionType || e.networkType || 'N/A'}</span></div>
      <div class="data-row"><span class="field-name">⚡ Effective Speed</span><span class="field-value">${e.effectiveConnectionType || e.networkEffectiveType || 'N/A'}${e.networkDownlink ? ' (' + e.networkDownlink + ' Mbps)' : ''}</span></div>
      <div class="data-row"><span class="field-name">📶 Network RTT</span><span class="field-value">${e.networkRtt ? e.networkRtt + 'ms' : 'N/A'}</span></div>
      <div class="data-row"><span class="field-name">💾 Save Data Mode</span><span class="field-value">${e.networkSaveData ? 'Enabled' : 'Disabled'}</span></div>
      <div class="data-row"><span class="field-name">🔗 Referrer Domain</span><span class="field-value">${e.referrerDomain || 'Direct'}</span></div>
      <div class="data-row"><span class="field-name">📊 IP Reputation ${tip('Overall reputation of this IP')}</span><span class="field-value status-badge ${reputation === 'poor' ? 'danger' : reputation === 'questionable' ? 'warning' : 'success'}">${reputation.toUpperCase()}</span></div>
      ${e.carrier ? `<div class="data-row"><span class="field-name">📱 Mobile Carrier</span><span class="field-value">${e.carrier}</span></div>` : ''}
      ${e.reverseDns ? `<div class="data-row"><span class="field-name">🔄 Reverse DNS</span><span class="field-value">${e.reverseDns}</span></div>` : ''}
      ${e.domain ? `<div class="data-row"><span class="field-name">🌐 Domain</span><span class="field-value">${e.domain}</span></div>` : ''}
    `;

    // Location Card
    const fpLocationCard = document.getElementById('fpLocationCard');
    const accuracy = e.accuracy || 'city';
    const hasGps = e.gpsGranted && e.gpsLatitude != null;
    const mapsUrl = hasGps
      ? `https://www.google.com/maps?q=${e.gpsLatitude},${e.gpsLongitude}`
      : (e.latitude && e.longitude ? `https://www.google.com/maps?q=${e.latitude},${e.longitude}` : null);
    fpLocationCard.innerHTML = `
      ${hasGps ? `
      <div class="data-row" style="background:rgba(34,197,94,0.08);border-radius:8px;padding:8px;margin-bottom:6px;grid-column:1/-1;">
        <span class="field-name" style="color:#22c55e;font-weight:700;">📡 GPS LOCATION (Browser)</span>
        <span class="field-value"></span>
      </div>
      <div class="data-row"><span class="field-name" style="color:#22c55e;">🎯 GPS Coordinates</span><span class="field-value" style="color:#22c55e;font-weight:600;">${e.gpsLatitude.toFixed(6)}, ${e.gpsLongitude.toFixed(6)}</span></div>
      ${e.gpsAddress ? `<div class="data-row" style="grid-column:1/-1;"><span class="field-name" style="color:#22c55e;">🏠 Street Address</span><span class="field-value" style="color:#22c55e;font-weight:600;">${escapeHtml(e.gpsAddress)}</span></div>` : ''}
      ${e.gpsAccuracy != null ? `<div class="data-row"><span class="field-name">📏 GPS Accuracy</span><span class="field-value">${Math.round(e.gpsAccuracy)}m</span></div>` : ''}
      ${e.gpsAltitude != null ? `<div class="data-row"><span class="field-name">🏔️ Altitude</span><span class="field-value">${Math.round(e.gpsAltitude)}m ${e.gpsAltitudeAccuracy != null ? '(±' + Math.round(e.gpsAltitudeAccuracy) + 'm)' : ''}</span></div>` : ''}
      ${e.gpsSpeed != null ? `<div class="data-row"><span class="field-name">🚀 Speed</span><span class="field-value">${(e.gpsSpeed * 3.6).toFixed(1)} km/h</span></div>` : ''}
      ${e.gpsHeading != null ? `<div class="data-row"><span class="field-name">🧭 Heading</span><span class="field-value">${Math.round(e.gpsHeading)}°</span></div>` : ''}
      ${mapsUrl ? `<div class="data-row" style="grid-column:1/-1;"><span class="field-name"></span><a href="${mapsUrl}" target="_blank" rel="noopener" style="color:#6366f1;font-size:0.8rem;">🗺️ Open in Google Maps →</a></div>` : ''}
      <div class="data-row" style="grid-column:1/-1;border-top:1px solid var(--border,#334155);margin-top:4px;padding-top:6px;"><span class="field-name">📡 IP Geolocation</span><span class="field-value" style="font-size:0.7rem;color:var(--text-muted)">Below is IP-based (less precise)</span></div>
      ` : `
      ${e.gpsDenied ? `<div class="data-row" style="grid-column:1/-1;"><span class="field-name">📡 GPS</span><span class="field-value status-badge warning">Denied by user</span></div>` : `<div class="data-row" style="grid-column:1/-1;"><span class="field-name">📡 GPS</span><span class="field-value status-badge disabled">Not collected</span></div>`}
      `}
      <div class="data-row"><span class="field-name">🌍 Country</span><span class="field-value">${e.country || 'Unknown'} (${e.countryCode || 'N/A'})</span></div>
      <div class="data-row"><span class="field-name">🏛️ Region/State</span><span class="field-value">${e.region || 'Unknown'}</span></div>
      <div class="data-row"><span class="field-name">🏙️ City</span><span class="field-value">${e.city || 'Unknown'}</span></div>
      ${e.district ? `<div class="data-row"><span class="field-name">🏘️ District</span><span class="field-value">${e.district}</span></div>` : ''}
      ${e.neighborhood ? `<div class="data-row"><span class="field-name">🏡 Neighborhood</span><span class="field-value">${e.neighborhood}</span></div>` : ''}
      ${e.zip ? `<div class="data-row"><span class="field-name">📮 ZIP/Postal</span><span class="field-value">${e.zip}</span></div>` : ''}
      ${e.metroCode ? `<div class="data-row"><span class="field-name">📍 Metro Code</span><span class="field-value">${e.metroCode}</span></div>` : ''}
      <div class="data-row"><span class="field-name">🕐 Timezone</span><span class="field-value">${e.timezone || 'N/A'} (UTC${e.timezoneOffset >= 0 ? '+' : ''}${e.timezoneOffset})</span></div>
      ${e.timeZoneMismatch ? `<div class="data-row"><span class="field-name">⚠️ Timezone Mismatch ${tip('Browser timezone does not match IP timezone - VPN possible')}</span><span class="field-value status-badge warning">YES - VPN SUSPECTED</span></div>` : ''}
      <div class="data-row"><span class="field-name">🗺️ Continent</span><span class="field-value">${e.continent || 'Unknown'}</span></div>
      ${e.latitude && e.longitude ? `<div class="data-row"><span class="field-name">📍 IP Coordinates</span><span class="field-value">${e.latitude.toFixed(4)}, ${e.longitude.toFixed(4)}${mapsUrl && !hasGps ? ` <a href="${mapsUrl}" target="_blank" rel="noopener" style="color:#6366f1;font-size:0.7rem;margin-left:6px;">Map →</a>` : ''}</span></div>` : ''}
      <div class="data-row"><span class="field-name">🎯 IP Accuracy</span><span class="field-value">${accuracy.toUpperCase()} level</div>
    `;

    // Canvas/WebGL Card
    let fontsList = e.fontsDetected;
    if (typeof fontsList === 'string') {
      try { fontsList = JSON.parse(fontsList); } catch(e) { fontsList = []; }
    }
    let canvasVariants = [];
    if (e.canvasVariants) {
      try { canvasVariants = typeof e.canvasVariants === 'string' ? JSON.parse(e.canvasVariants) : e.canvasVariants; } catch(e) { canvasVariants = []; }
    }
    const fpCanvasCard = document.getElementById('fpCanvasCard');
    fpCanvasCard.innerHTML = `
      <div class="data-row"><span class="field-name">🎨 Canvas Fingerprint</span><span class="field-value">${e.canvasFingerprint ? 'Available' : 'Not available'}</span></div>
      ${e.canvasFingerprintHash ? `<div class="data-row"><span class="field-name">🎨 Canvas Hash</span><span class="field-value" style="font-size:0.7rem;word-break:break-all;">${e.canvasFingerprintHash}</span></div>` : ''}
      ${e.canvasGpuAccelerated !== null ? `<div class="data-row"><span class="field-name">🚀 GPU Accelerated</span><span class="field-value">${e.canvasGpuAccelerated ? 'Yes' : 'No'}</span></div>` : ''}
      <div class="data-row"><span class="field-name">🌐 WebGL Enabled</span><span class="field-value status-badge ${e.webglRenderer ? 'enabled' : 'disabled'}">${e.webglRenderer ? 'Yes' : 'No'}</span></div>
      <div class="data-row"><span class="field-name">🏢 WebGL Vendor</span><span class="field-value">${e.webglVendor || 'N/A'}</span></div>
      <div class="data-row"><span class="field-name">🎮 WebGL Renderer</span><span class="field-value">${e.webglRenderer || 'N/A'}</span></div>
      <div class="data-row"><span class="field-name">🌐 WebGL Version</span><span class="field-value">${e.webglVersion || 'N/A'}</span></div>
      <div class="data-row"><span class="field-name">🔧 WebGL Shading</span><span class="field-value">${e.webglShadingVersion || 'N/A'}</span></div>
      <div class="data-row"><span class="field-name">🆕 WebGL2 Supported</span><span class="field-value status-badge ${e.webgl2Enabled || e.webgl2Supported ? 'enabled' : 'disabled'}">${e.webgl2Enabled || e.webgl2Supported ? 'Yes' : 'No'}</span></div>
      ${e.webgl2Vendor ? `<div class="data-row"><span class="field-name">🏢 WebGL2 Vendor</span><span class="field-value">${e.webgl2Vendor}</span></div>` : ''}
      ${e.webgl2Renderer ? `<div class="data-row"><span class="field-name">🎮 WebGL2 Renderer</span><span class="field-value">${e.webgl2Renderer}</span></div>` : ''}
      ${e.webglFingerprintHash ? `<div class="data-row"><span class="field-name">🔑 WebGL Fingerprint</span><span class="field-value" style="font-size:0.7rem;word-break:break-all;">${e.webglFingerprintHash}</span></div>` : ''}
      <div class="data-row"><span class="field-name">🔊 Audio Fingerprint</span><span class="field-value">${e.audioFingerprint ? 'Available' : 'Not available'}</span></div>
      ${e.audioFingerprintHash ? `<div class="data-row"><span class="field-name">🔊 Audio Hash</span><span class="field-value" style="font-size:0.7rem;word-break:break-all;">${e.audioFingerprintHash}</span></div>` : ''}
      ${e.audioSampleRate ? `<div class="data-row"><span class="field-name">🎵 Audio Sample Rate</span><span class="field-value">${e.audioSampleRate} Hz</span></div>` : ''}
      <div class="data-row"><span class="field-name">🔤 Fonts Detected ${tip('Number of fonts installed')}</span><span class="field-value">${e.fontCount || (fontsList ? fontsList.length : 'N/A')}</span></div>
      ${fontsList && fontsList.length > 0 ? `<div class="data-row"><span class="field-name">🔤 Font Sample ${tip('First 10 fonts detected')}</span><span class="field-value" style="font-size:0.65rem;">${Array.isArray(fontsList) ? fontsList.slice(0, 10).join(', ') : fontsList}</span></div>` : ''}
      ${canvasVariants.length > 0 ? `<div class="data-row"><span class="field-name">🎨 Canvas Variants ${tip('Number of canvas fingerprint variations')}</span><span class="field-value">${canvasVariants.length}</span></div>` : ''}
    `;

    // Hardware Card
    const fpHardwareCard = document.getElementById('fpHardwareCard');
    const gpuInfo = e.gpu || e.webglRenderer || 'N/A';
    let sensorsSupported = [];
    if (e.sensorsSupported) { try { sensorsSupported = typeof e.sensorsSupported === 'string' ? JSON.parse(e.sensorsSupported) : e.sensorsSupported; } catch(_) {} }
    let vmIndicators = [];
    if (e.vmIndicators) { try { vmIndicators = typeof e.vmIndicators === 'string' ? JSON.parse(e.vmIndicators) : e.vmIndicators; } catch(_) {} }
    let uaSpoofIndicators = [];
    if (e.uaSpoofIndicators) { try { uaSpoofIndicators = typeof e.uaSpoofIndicators === 'string' ? JSON.parse(e.uaSpoofIndicators) : e.uaSpoofIndicators; } catch(_) {} }
    fpHardwareCard.innerHTML = `
      <div class="data-row"><span class="field-name">💻 Device Type</span><span class="field-value">${e.deviceType || 'Unknown'}</span></div>
      <div class="data-row"><span class="field-name">🏭 Device Vendor</span><span class="field-value">${e.deviceVendor || 'Unknown'}</span></div>
      <div class="data-row"><span class="field-name">📱 Device Model</span><span class="field-value">${e.deviceModel || 'Unknown'}</span></div>
      <div class="data-row"><span class="field-name">🔲 Device Brand</span><span class="field-value">${e.deviceBrand || 'Unknown'}</span></div>
      <div class="data-row"><span class="field-name">🖥️ GPU ${tip('Graphics processing unit')}</span><span class="field-value">${gpuInfo}</span></div>
      <div class="data-row"><span class="field-name">⚙️ CPU Cores ${tip('Number of logical processors')}</span><span class="field-value">${e.hardwareConcurrency || 'N/A'}</span></div>
      <div class="data-row"><span class="field-name">💾 Device Memory</span><span class="field-value">${e.deviceMemory ? e.deviceMemory + ' GB' : 'N/A'}</span></div>
      <div class="data-row"><span class="field-name">🖐️ Max Touch Points</span><span class="field-value">${e.maxTouchPoints || 'N/A'}</span></div>
      <div class="data-row"><span class="field-name">👆 Touch Support</span><span class="field-value status-badge ${e.touchSupport || e.maxTouchPoints > 0 ? 'enabled' : 'disabled'}">${e.touchSupport || e.maxTouchPoints > 0 ? 'Yes' : 'No'}</span></div>
      <div class="data-row"><span class="field-name">🔄 Screen Orientation</span><span class="field-value">${e.screenOrientation || 'N/A'}</span></div>
      <div class="data-row"><span class="field-name">📊 Screen Resolution</span><span class="field-value">${e.screenResolution || 'N/A'}</span></div>
      <div class="data-row"><span class="field-name">🎨 Color Depth</span><span class="field-value">${e.colorDepth ? e.colorDepth + '-bit' : 'N/A'}</span></div>
      <div class="data-row"><span class="field-name">🔍 Pixel Ratio</span><span class="field-value">${e.pixelRatio || 'N/A'}</span></div>
      ${e.entropyScore ? `<div class="data-row"><span class="field-name">🎲 Entropy Score ${tip('Fingerprint uniqueness score')}</span><span class="field-value">${(e.entropyScore * 100).toFixed(1)}%</span></div>` : ''}
      ${e.humanScore ? `<div class="data-row"><span class="field-name">👤 Human Score ${tip('Likelihood of being human (0-100)')}</span><span class="field-value status-badge ${e.humanScore > 70 ? 'success' : e.humanScore > 40 ? 'warning' : 'danger'}">${e.humanScore}/100</span></div>` : ''}
      ${sensorsSupported.length > 0 ? `<div class="data-row"><span class="field-name">📡 Sensors ${tip('Device sensors detected')}</span><span class="field-value">${sensorsSupported.join(', ')}</span></div>` : ''}
      ${e.sensorGyroscope ? `<div class="data-row"><span class="field-name">🌀 Gyroscope</span><span class="field-value">${(() => { try { const g = typeof e.sensorGyroscope === 'string' ? JSON.parse(e.sensorGyroscope) : e.sensorGyroscope; return 'α:' + (g.alpha||g.x||0).toFixed(2) + ' β:' + (g.beta||g.y||0).toFixed(2) + ' γ:' + (g.gamma||g.z||0).toFixed(2); } catch(_) { return e.sensorGyroscope; } })()}</span></div>` : ''}
      ${e.sensorAccelerometer ? `<div class="data-row"><span class="field-name">📐 Accelerometer</span><span class="field-value">${(() => { try { const a = typeof e.sensorAccelerometer === 'string' ? JSON.parse(e.sensorAccelerometer) : e.sensorAccelerometer; return 'x:' + (a.x||0).toFixed(2) + ' y:' + (a.y||0).toFixed(2) + ' z:' + (a.z||0).toFixed(2); } catch(_) { return e.sensorAccelerometer; } })()}</span></div>` : ''}
      ${e.sensorAmbientLight != null ? `<div class="data-row"><span class="field-name">💡 Ambient Light</span><span class="field-value">${e.sensorAmbientLight} lux</span></div>` : ''}
      ${e.isVM ? `<div class="data-row"><span class="field-name">🖥️ Virtual Machine ${tip('VM/emulator detected')}</span><span class="field-value status-badge warning">DETECTED${vmIndicators.length ? ' (' + vmIndicators.slice(0,3).join(', ') + ')' : ''}</span></div>` : ''}
      ${e.isPrivacyBrowser ? `<div class="data-row"><span class="field-name">🛡️ Privacy Browser ${tip('Privacy-focused browser detected')}</span><span class="field-value status-badge warning">${e.isPrivacyBrowser.toUpperCase()}</span></div>` : ''}
      ${e.canvasNoise ? `<div class="data-row"><span class="field-name">🎨 Canvas Noise ${tip('Canvas randomization detected (Brave/CanvasBlocker)')}</span><span class="field-value status-badge warning">ACTIVE</span></div>` : ''}
      ${e.timerResolution != null ? `<div class="data-row"><span class="field-name">⏱️ Timer Resolution ${tip('performance.now() granularity — clamped browsers return ≥1ms')}</span><span class="field-value ${e.timerResolution >= 1 ? 'status-badge warning' : ''}">${e.timerResolution.toFixed(3)}ms${e.timerResolution >= 1 ? ' (CLAMPED)' : ''}</span></div>` : ''}
      ${e.uaSpoofScore > 0 ? `<div class="data-row"><span class="field-name">🎭 UA Spoof Score ${tip('Likelihood of user-agent spoofing')}</span><span class="field-value status-badge ${e.uaSpoofScore >= 50 ? 'danger' : 'warning'}">${e.uaSpoofScore}/100${uaSpoofIndicators.length ? ': ' + uaSpoofIndicators.slice(0,2).join(', ') : ''}</span></div>` : ''}
      ${e.speechVoiceCount ? `<div class="data-row"><span class="field-name">🎙️ Speech Voices ${tip('TTS voices installed — unique per OS/locale')}</span><span class="field-value">${e.speechVoiceCount} voices ${e.speechVoicesHash ? '(' + e.speechVoicesHash.substring(0,8) + '…)' : ''}</span></div>` : ''}
      ${e.clientHintsPlatform ? `<div class="data-row"><span class="field-name">💡 CH Platform ${tip('Client Hints - verified OS/architecture')}</span><span class="field-value">${e.clientHintsPlatform} ${e.clientHintsPlatformVersion || ''} ${e.clientHintsArchitecture ? '(' + e.clientHintsArchitecture + (e.clientHintsBitness ? '-' + e.clientHintsBitness + 'bit' : '') + ')' : ''}</span></div>` : ''}
      ${e.clientHintsModel ? `<div class="data-row"><span class="field-name">📱 CH Model ${tip('Client Hints - verified device model')}</span><span class="field-value">${e.clientHintsModel}</span></div>` : ''}
    `;

    // Now render the full events list with full WebRTC IPs
    fpEventsList.innerHTML = events.map(evt => {
      const timestamp = evt.timestamp ? new Date(evt.timestamp).toLocaleString() : 'N/A';
      const badges = [];
      if (evt.isLikelyBot || evt.clientBot) badges.push('<span class="badge bot">🤖 Bot</span>');
      if (evt.isHeadless) badges.push('<span class="badge headless">🖥️ Headless</span>');
      if (evt.webrtcLeakDetected) badges.push('<span class="badge vpn">🔓 WebRTC Leak</span>');
      if (evt.isVpn) badges.push('<span class="badge vpn">🛡️ VPN</span>');
      if (evt.isProxy) badges.push('<span class="badge vpn">📦 Proxy</span>');
      if (evt.isMobile) badges.push('<span class="badge mobile">📱 Mobile</span>');
      if (evt.isTor) badges.push('<span class="badge bot">🧅 Tor</span>');
      
      // Parse WebRTC IPs for list
      let evtWebrtcIps = [];
      if (evt.webrtcIps) {
        try {
          evtWebrtcIps = typeof evt.webrtcIps === 'string' ? JSON.parse(evt.webrtcIps) : evt.webrtcIps;
        } catch (err) {
          evtWebrtcIps = [];
        }
      }
      
      return `
        <div class="fp-event-item">
          <div class="fp-event-header">
            <span class="fp-event-hash">${(evt.fingerprintHash || 'No hash')}</span>
            <span class="fp-event-time">${timestamp}</span>
          </div>
          <div class="fp-event-badges">${badges.length ? badges.join(' ') : '<span class="badge normal">✓ Normal User</span>'}</div>
          <div class="fp-event-grid">
            <div class="fp-event-field"><div class="label">IP</div><div class="value">${escapeHtml(evt.ipFull || evt.ipTruncated || 'N/A')}</div></div>
            <div class="fp-event-field"><div class="label">Location</div><div class="value">${escapeHtml(evt.city || '')}, ${escapeHtml(evt.country || 'Unknown')}</div></div>
            <div class="fp-event-field"><div class="label">ISP</div><div class="value">${escapeHtml(evt.isp || 'Unknown')}</div></div>
            <div class="fp-event-field"><div class="label">Device</div><div class="value">${escapeHtml(evt.deviceBrand || '')} ${escapeHtml(evt.deviceModel || evt.deviceType || 'Unknown')}</div></div>
            <div class="fp-event-field"><div class="label">Browser</div><div class="value">${escapeHtml(evt.browser || 'Unknown')}</div></div>
            <div class="fp-event-field"><div class="label">OS</div><div class="value">${escapeHtml(evt.os || 'Unknown')}</div></div>
            <div class="fp-event-field"><div class="label">Screen</div><div class="value">${evt.screenResolution || 'N/A'}</div></div>
            <div class="fp-event-field"><div class="label">Viewport</div><div class="value">${evt.viewportWidth || '?'}x${evt.viewportHeight || '?'}</div></div>
            <div class="fp-event-field"><div class="label">Cores</div><div class="value">${evt.hardwareConcurrency || 'N/A'}</div></div>
            <div class="fp-event-field"><div class="label">Memory</div><div class="value">${evt.deviceMemory ? evt.deviceMemory + 'GB' : 'N/A'}</div></div>
            <div class="fp-event-field"><div class="label">Language</div><div class="value">${escapeHtml(evt.language || 'N/A')}</div></div>
            <div class="fp-event-field"><div class="label">Timezone</div><div class="value">${escapeHtml(evt.timezone || 'N/A')}</div></div>
            <div class="fp-event-field"><div class="label">WebRTC Real IP</div><div class="value" style="${evt.webrtcRealIp ? 'color:#dc2626;' : ''}">${escapeHtml(evt.webrtcRealIp || '-')}</div></div>
            ${evtWebrtcIps.length > 0 ? `<div class="fp-event-field" style="grid-column: 1 / -1;"><div class="label">WebRTC IPs (${evtWebrtcIps.length})</div><div class="value" style="font-size:0.7rem;word-break:break-all;">${escapeHtml(evtWebrtcIps.join(', '))}</div></div>` : ''}
            <div class="fp-event-field"><div class="label">Connection</div><div class="value">${escapeHtml(evt.effectiveConnectionType || evt.connectionType || 'N/A')}</div></div>
            <div class="fp-event-field"><div class="label">Referrer</div><div class="value">${escapeHtml(evt.referrerDomain || 'Direct')}</div></div>
            <div class="fp-event-field"><div class="label">ASN</div><div class="value">${evt.asn ? 'AS' + escapeHtml(evt.asn) : 'N/A'}</div></div>
            <div class="fp-event-field"><div class="label">Org</div><div class="value">${escapeHtml(evt.org || 'N/A')}</div></div>
          </div>
        </div>
      `;
    }).join('');

    // Also render behavior tab
    renderBehaviorData(events);
    
    // Make values copyable
    setTimeout(() => {
      makeCopyable('#fpIdentityCard .field-value');
      makeCopyable('#fpDeviceCard .field-value');
      makeCopyable('#fpBrowserCard .field-value');
      makeCopyable('#fpSecurityCard .field-value');
      makeCopyable('#fpNetworkCard .field-value');
      makeCopyable('#fpLocationCard .field-value');
      makeCopyable('#fpCanvasCard .field-value');
      makeCopyable('#fpHardwareCard .field-value');
      makeCopyable('.fp-event-field .value');
    }, 100);
    
  } catch (err) {
    console.error('Failed to load fingerprint events:', err);
  }
}

async function loadBehaviorData() {
  const trackingId = getSelectedTrackingId();
  if (!trackingId) return;

  if (behaviorDataCache) {
    renderBehaviorData(behaviorDataCache);
    return;
  }

  try {
    const events = await fetchAPI(`/links/${trackingId}/fingerprint?limit=20`);
    behaviorDataCache = events || [];
    renderBehaviorData(events || []);
  } catch (e) {
    console.error('Failed to load behavior data:', e);
    const grid = document.getElementById('behaviorStatsGrid');
    if (grid) grid.innerHTML = `<p style="color:var(--danger)">Failed to load behavior data: ${e.message}</p>`;
  }
}

function renderBehaviorData(events) {
  events = events || [];
  
  const bhHeaderStats = document.getElementById('bhHeaderStats');
  if (!bhHeaderStats) return;

  const avgTimeOnPage = events.reduce((sum, e) => sum + (e.timeOnPage || 0), 0) / (events.length || 1);
  const avgScrollDepth = events.reduce((sum, e) => sum + (e.scrollDepth || 0), 0) / (events.length || 1);
  const bots = events.filter(e => e.isLikelyBot || e.clientBot).length;
  const headless = events.filter(e => e.isHeadless).length;
  const mobile = events.filter(e => e.isMobile).length;
  const vpn = events.filter(e => e.isVpn).length;
  const webrtcLeaks = events.filter(e => e.webrtcLeakDetected).length;

  // Header stats
  bhHeaderStats.innerHTML = `
    <div class="stat-pill"><span class="num">${events.length}</span> <span class="lbl">Total Events</span></div>
    <div class="stat-pill"><span class="num">${Math.round(avgTimeOnPage)}s</span> <span class="lbl">Avg Time</span></div>
    <div class="stat-pill"><span class="num">${Math.round(avgScrollDepth)}%</span> <span class="lbl">Avg Scroll</span></div>
    <div class="stat-pill"><span class="num">${bots}</span> <span class="lbl">Bots</span></div>
    <div class="stat-pill"><span class="num">${mobile}</span> <span class="lbl">Mobile</span></div>
    <div class="stat-pill"><span class="num">${webrtcLeaks}</span> <span class="lbl">WebRTC Leaks</span></div>
  `;

  const e = events[0] || {};
  
  // Helper for tooltips
  const tip = (text) => `<span class="tooltip-container"><span class="help-icon" tabindex="0">?</span><span class="tooltip-text">${text}</span></span>`;

  // Interactions Card
  const bhInteractionsCard = document.getElementById('bhInteractionsCard');
  bhInteractionsCard.innerHTML = `
    <div class="data-row"><span class="field-name">Total Clicks ${tip('Number of clicks on the page')}</span><span class="field-value">${e.clicks !== null ? e.clicks : 'Not tracked'}</span></div>
    <div class="data-row"><span class="field-name">Keypresses</span><span class="field-value">${e.keypresses !== null ? e.keypresses : 'Not tracked'}</span></div>
    <div class="data-row"><span class="field-name">Scroll Depth ${tip('How far down the page user scrolled (0-100%)')}</span><span class="field-value">${e.scrollDepth !== null ? e.scrollDepth + '%' : 'Not tracked'}</span></div>
    <div class="data-row"><span class="field-name">Max Scroll Depth</span><span class="field-value">${e.maxScrollDepth !== null ? e.maxScrollDepth + '%' : 'Not tracked'}</span></div>
  `;

  // Timing Card
  const bhTimingCard = document.getElementById('bhTimingCard');
  bhTimingCard.innerHTML = `
    <div class="data-row"><span class="field-name">Time on Page ${tip('How long user stayed on the page (seconds)')}</span><span class="field-value">${e.timeOnPage !== null ? e.timeOnPage + ' seconds' : 'Not tracked'}</span></div>
    <div class="data-row"><span class="field-name">Page Visits</span><span class="field-value">${e.pageVisits !== null ? e.pageVisits : '1'}</span></div>
    <div class="data-row"><span class="field-name">Focus Count</span><span class="field-value">${e.focusCount !== null ? e.focusCount : 'Not tracked'}</span></div>
    <div class="data-row"><span class="field-name">Session Storage ${tip('Browser session storage available')}</span><span class="field-value status-badge ${e.sessionStorageEnabled ? 'enabled' : 'disabled'}">${e.sessionStorageEnabled ? 'Enabled' : 'Disabled'}</span></div>
    <div class="data-row"><span class="field-name">Local Storage ${tip('Browser local storage available')}</span><span class="field-value status-badge ${e.localStorageEnabled ? 'enabled' : 'disabled'}">${e.localStorageEnabled ? 'Enabled' : 'Disabled'}</span></div>
    <div class="data-row"><span class="field-name">Cookies Enabled</span><span class="field-value status-badge ${e.cookieEnabled ? 'enabled' : 'disabled'}">${e.cookieEnabled ? 'Yes' : 'No'}</span></div>
  `;

  // Storage Card
  const bhStorageCard = document.getElementById('bhStorageCard');
  // Parse permissions
  let permissions = {};
  if (e.permissions) {
    try {
      permissions = typeof e.permissions === 'string' ? JSON.parse(e.permissions) : e.permissions;
    } catch (err) { permissions = {}; }
  }
  bhStorageCard.innerHTML = `
    <div class="data-row"><span class="field-name">💾 Session Storage</span><span class="field-value status-badge ${e.sessionStorageEnabled ? 'enabled' : 'disabled'}">${e.sessionStorageEnabled ? '✓ Available' : '✗ Not available'}</span></div>
    <div class="data-row"><span class="field-name">💾 Local Storage</span><span class="field-value status-badge ${e.localStorageEnabled ? 'enabled' : 'disabled'}">${e.localStorageEnabled ? '✓ Available' : '✗ Not available'}</span></div>
    <div class="data-row"><span class="field-name">🍪 Cookies</span><span class="field-value status-badge ${e.cookieEnabled ? 'enabled' : 'disabled'}">${e.cookieEnabled ? '✓ Enabled' : '✗ Disabled'}</span></div>
    <div class="data-row"><span class="field-name">🗄️ IndexedDB</span><span class="field-value status-badge ${e.indexedDBEnabled ? 'enabled' : 'disabled'}">${e.indexedDBEnabled ? '✓ Available' : '✗ Not available'}</span></div>
    ${permissions.notifications ? `<div class="data-row"><span class="field-name">🔔 Notifications</span><span class="field-value">${permissions.notifications}</span></div>` : ''}
    ${permissions.geolocation ? `<div class="data-row"><span class="field-name">📍 Geolocation</span><span class="field-value">${permissions.geolocation}</span></div>` : ''}
    ${permissions.camera ? `<div class="data-row"><span class="field-name">📷 Camera</span><span class="field-value">${permissions.camera}</span></div>` : ''}
    ${permissions.microphone ? `<div class="data-row"><span class="field-name">🎤 Microphone</span><span class="field-value">${permissions.microphone}</span></div>` : ''}
    ${permissions['clipboard-read'] ? `<div class="data-row"><span class="field-name">📋 Clipboard Read</span><span class="field-value">${permissions['clipboard-read']}</span></div>` : ''}
  `;

  // Battery Card
  const bhBatteryCard = document.getElementById('bhBatteryCard');
  const batterySupported = e.batterySupported !== null ? e.batterySupported : (e.batteryLevel !== null);
  bhBatteryCard.innerHTML = `
    <div class="data-row"><span class="field-name">🔋 Battery API ${tip('Browser Battery API support')}</span><span class="field-value status-badge ${batterySupported ? 'enabled' : 'disabled'}">${batterySupported ? 'Supported' : 'Not supported'}</span></div>
    ${e.batteryLevel !== null ? `<div class="data-row"><span class="field-name">⚡ Battery Level</span><span class="field-value">${e.batteryLevel}%</span></div>` : ''}
    ${e.batteryCharging !== null ? `<div class="data-row"><span class="field-name">🔌 Charging Status</span><span class="field-value status-badge ${e.batteryCharging ? 'success' : 'unknown'}">${e.batteryCharging ? '⚡ Charging' : '🔋 On Battery'}</span></div>` : ''}
    ${e.batteryChargingTime ? `<div class="data-row"><span class="field-name">⏱️ Time to Full</span><span class="field-value">${Math.round(e.batteryChargingTime / 60)} min</span></div>` : ''}
    ${e.batteryDischargingTime ? `<div class="data-row"><span class="field-name">⏱️ Time Remaining</span><span class="field-value">${Math.round(e.batteryDischargingTime / 60)} min</span></div>` : ''}
  `;

  // Connection Card
  const bhConnectionCard = document.getElementById('bhConnectionCard');
  bhConnectionCard.innerHTML = `
    <div class="data-row"><span class="field-name">Connection Type ${tip('Network connection type (wifi, cellular, etc)')}</span><span class="field-value">${e.connectionType || 'Unknown'}</span></div>
    <div class="data-row"><span class="field-name">Effective Speed ${tip('Estimated connection speed (2g, 3g, 4g, etc)')}</span><span class="field-value">${e.effectiveConnectionType || 'Unknown'}</span></div>
    <div class="data-row"><span class="field-name">Language</span><span class="field-value">${e.language || 'Unknown'}</span></div>
    <div class="data-row"><span class="field-name">Platform</span><span class="field-value">${e.platform || 'Unknown'}</span></div>
  `;

  // Bot Detection Card
  const bhBotCard = document.getElementById('bhBotCard');
  // Parse bot indicators
  let botIndicatorsList = [];
  if (e.botIndicators) {
    try {
      botIndicatorsList = typeof e.botIndicators === 'string' ? JSON.parse(e.botIndicators) : e.botIndicators;
    } catch (err) { botIndicatorsList = []; }
  }
  bhBotCard.innerHTML = `
    <div class="data-row"><span class="field-name">🤖 Is Bot ${tip('Likely automated traffic')}</span><span class="field-value status-badge ${e.isBot ? 'danger' : 'success'}">${e.isBot ? 'YES - BOT' : 'No'}</span></div>
    <div class="data-row"><span class="field-name">🎭 Likely Bot ${tip('Server-side bot detection')}</span><span class="field-value status-badge ${e.isLikelyBot ? 'danger' : 'success'}">${e.isLikelyBot ? 'YES - BOT' : 'No'}</span></div>
    <div class="data-row"><span class="field-name">📟 Client Bot ${tip('JavaScript-based bot detection')}</span><span class="field-value status-badge ${e.clientBot ? 'danger' : 'success'}">${e.clientBot ? 'YES - BOT' : 'No'}</span></div>
    <div class="data-row"><span class="field-name">👻 Headless ${tip('Running without visible browser UI')}</span><span class="field-value status-badge ${e.isHeadless ? 'warning' : 'success'}">${e.isHeadless ? 'YES - HEADLESS' : 'No'}</span></div>
    <div class="data-row"><span class="field-name">🎪 Automated ${tip('Automation framework detected')}</span><span class="field-value status-badge ${e.isAutomated ? 'danger' : 'success'}">${e.isAutomated ? 'YES' : 'No'}</span></div>
    <div class="data-row"><span class="field-name">🕷️ Selenium</span><span class="field-value status-badge ${e.isSelenium ? 'danger' : 'success'}">${e.isSelenium ? 'DETECTED' : 'No'}</span></div>
    <div class="data-row"><span class="field-name">🎨 Puppeteer</span><span class="field-value status-badge ${e.isPuppeteer ? 'danger' : 'success'}">${e.isPuppeteer ? 'DETECTED' : 'No'}</span></div>
    <div class="data-row"><span class="field-name">🎭 Playwright</span><span class="field-value status-badge ${e.isPlaywright ? 'danger' : 'success'}">${e.isPlaywright ? 'DETECTED' : 'No'}</span></div>
    <div class="data-row"><span class="field-name">👤 WebDriver</span><span class="field-value status-badge ${e.webdriver ? 'danger' : 'success'}">${e.webdriver ? 'DETECTED' : 'No'}</span></div>
    <div class="data-row"><span class="field-name">📊 Bot Score ${tip('Bot likelihood (0-100)')}</span><span class="field-value status-badge ${(e.botScore || 0) > 30 ? 'danger' : (e.botScore || 0) > 10 ? 'warning' : 'success'}">${e.botScore || 0}/100</span></div>
    ${botIndicatorsList.length > 0 ? `<div class="data-row"><span class="field-name">🚩 Indicators</span><span class="field-value" style="font-size:0.65rem;">${botIndicatorsList.slice(0, 5).join(', ')}${botIndicatorsList.length > 5 ? ' +' + (botIndicatorsList.length - 5) + ' more' : ''}</span></div>` : ''}
    ${e.vpnDetected ? `<div class="data-row"><span class="field-name">🛡️ Client VPN Detected</span><span class="field-value status-badge warning">YES (${e.vpnScore || 0})</span></div>` : ''}
  `;

  // Behavior Events List
  const bhRecordCount = document.getElementById('bhRecordCount');
  if (bhRecordCount) bhRecordCount.textContent = `${events.length} records`;
  
  const bhEventsList = document.getElementById('bhEventsList');
  if (!bhEventsList) return;
  
  if (events.length === 0) {
    bhEventsList.innerHTML = '<div class="empty-state">No behavior data collected yet</div>';
    return;
  }

  bhEventsList.innerHTML = events.map(evt => {
    const timestamp = evt.timestamp ? new Date(evt.timestamp).toLocaleString() : 'N/A';
    const badges = [];
    if (evt.isBot) badges.push('<span class="badge bot">🤖 Bot</span>');
    if (evt.isLikelyBot || evt.clientBot) badges.push('<span class="badge bot">🤖 Likely Bot</span>');
    if (evt.isHeadless) badges.push('<span class="badge headless">👻 Headless</span>');
    if (evt.webrtcLeakDetected || evt.webrtcLeak) badges.push('<span class="badge vpn">🔓 WebRTC Leak</span>');
    if (evt.realIpDetected) badges.push('<span class="badge danger">🔍 Real IP Found</span>');
    if (evt.isVpn) badges.push('<span class="badge vpn">🛡️ VPN</span>');
    if (evt.isProxy) badges.push('<span class="badge vpn">📦 Proxy</span>');
    if (evt.isTor) badges.push('<span class="badge bot">🧅 Tor</span>');
    if (evt.isMobile) badges.push('<span class="badge mobile">📱 Mobile</span>');
    if ((evt.threatScore || 0) >= 60) badges.push('<span class="badge danger">⚠️ Threat</span>');
    
    const realIp = evt.realIp || evt.webrtcRealIp;
    
    return `
      <div class="fp-event-item">
        <div class="fp-event-header">
          <span class="fp-event-hash">${(evt.fingerprintHash || evt.visitorId || 'No ID')}</span>
          <span class="fp-event-time">${timestamp}</span>
        </div>
        <div class="fp-event-badges">${badges.length ? badges.join(' ') : '<span class="badge normal">✓ Normal User</span>'}</div>
        <div class="fp-event-grid">
          <div class="fp-event-field"><div class="label">🌐 IP</div><div class="value">${escapeHtml(evt.ipFull || evt.ipTruncated || 'N/A')}</div></div>
          <div class="fp-event-field"><div class="label">📍 Location</div><div class="value">${escapeHtml(evt.city || '')}, ${escapeHtml(evt.country || 'Unknown')}</div></div>
          <div class="fp-event-field"><div class="label">🔍 Real IP</div><div class="value" style="${realIp ? 'color:#dc2626;font-weight:600;' : ''}">${escapeHtml(realIp || '-')}</div></div>
          <div class="fp-event-field"><div class="label">📱 Device</div><div class="value">${escapeHtml(evt.deviceBrand || '')} ${escapeHtml(evt.deviceModel || evt.deviceType || 'Unknown')}</div></div>
          <div class="fp-event-field"><div class="label">🌐 Browser</div><div class="value">${escapeHtml(evt.browser || 'Unknown')}</div></div>
          <div class="fp-event-field"><div class="label">💻 OS</div><div class="value">${escapeHtml(evt.os || 'Unknown')}</div></div>
          <div class="fp-event-field"><div class="label">🔌 Connection</div><div class="value">${escapeHtml(evt.effectiveConnectionType || evt.connectionType || evt.networkEffectiveType || 'N/A')}</div></div>
        </div>
        ${evt.vpnProvider ? `<div class="fp-event-note">🛡️ VPN Provider: ${escapeHtml(evt.vpnProvider)}</div>` : ''}
        ${evt.bypassMethod ? `<div class="fp-event-note">🔧 Bypass Method: ${escapeHtml(evt.bypassMethod)}</div>` : ''}
      </div>
    `;
  }).join('');
  
  // Make behavior values copyable
  setTimeout(() => {
    makeCopyable('#bhInteractionsCard .field-value');
    makeCopyable('#bhTimingCard .field-value');
    makeCopyable('#bhStorageCard .field-value');
    makeCopyable('#bhBatteryCard .field-value');
    makeCopyable('#bhConnectionCard .field-value');
    makeCopyable('#bhBotCard .field-value');
  }, 100);
}

function getSelectedTrackingId() {
  const el = document.getElementById('selectedLinkId');
  return el ? el.textContent.trim() : null;
}

async function loadPorkbunDomains() {
  const select = document.getElementById('linkDomain');
  if (!select) return;
  try {
    const data = await fetchAPI('/porkbun/domains');
    const domains = Array.isArray(data) ? data : (data.domains || []);
    select.innerHTML = '<option value="">— Select a tracking domain —</option>';
    domains.forEach(d => {
      if (d.status !== 'ACTIVE') return; // Only show active domains
      const opt = document.createElement('option');
      opt.value = d.domain;
      opt.textContent = d.domain;
      select.appendChild(opt);
    });
  } catch (e) {
    // Porkbun not configured or unreachable — show fallback
    if (select) select.innerHTML = '<option value="">— No domains available —</option>';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const loggedIn = initLogin();
  if (loggedIn) {
    loadStats();
    loadLinks();
    loadPorkbunDomains();
  }
  initCreateToggle();
  initAnalyticsTabs();
});
