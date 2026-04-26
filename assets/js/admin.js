// web/assets/js/admin.js
const Admin = (() => {

  // ── 토큰 헬퍼 ────────────────────────────────────────────

  const TOKEN_KEY = 'admin_token';

  function getToken()    { return localStorage.getItem(TOKEN_KEY) || ''; }
  function setToken(t)   { localStorage.setItem(TOKEN_KEY, t); }
  function clearToken()  { localStorage.removeItem(TOKEN_KEY); }

  function authHeaders() {
    return {
      'Content-Type':  'application/json',
      'Authorization': 'Bearer ' + getToken(),
    };
  }

  // 인증이 필요한 모든 fetch를 이 함수로 감싸 401 시 자동 로그아웃
  async function adminFetch(url, options = {}) {
    const res = await fetch(url, { ...options, headers: authHeaders() });
    if (res.status === 401) {
      clearToken();
      showLoginScreen();
      throw new Error('auth_expired');
    }
    return res;
  }

  function showLoginScreen() {
    document.getElementById('admin-main').classList.add('hidden');
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('login-password').value = '';
  }

  // ── 인증 ─────────────────────────────────────────────────

  async function login() {
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    const errEl    = document.getElementById('login-error');
    errEl.classList.add('hidden');

    try {
      const res  = await fetch(API_BASE + 'api/admin/auth.php', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action: 'login', username, password }),
      });
      const json = await res.json();
      if (json.success) {
        setToken(json.data.token);
        showMain();
      } else {
        errEl.textContent = json.error;
        errEl.classList.remove('hidden');
      }
    } catch {
      errEl.textContent = '서버 연결 오류가 발생했습니다.';
      errEl.classList.remove('hidden');
    }
  }

  async function logout() {
    clearToken();
    try {
      await fetch(API_BASE + 'api/admin/auth.php', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action: 'logout' }),
      });
    } catch {}
    showLoginScreen();
  }

  function showMain() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('admin-main').classList.remove('hidden');
    showTab('dashboard');
  }

  // ── 탭 ───────────────────────────────────────────────────

  function showTab(tab) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.getElementById(`tab-${tab}`).classList.remove('hidden');
    document.querySelectorAll('.admin-tab').forEach(btn => {
      const active = btn.dataset.tab === tab;
      btn.classList.toggle('bg-white',       active);
      btn.classList.toggle('shadow-sm',      active);
      btn.classList.toggle('text-[#0172FE]', active);
      btn.classList.toggle('text-gray-600',  !active);
    });
    if (tab === 'dashboard')  loadDashboard();
    if (tab === 'events')     loadEvents();
    if (tab === 'reports')    loadReports();
    if (tab === 'categories') loadCategories();
  }

  // ── 대시보드 ─────────────────────────────────────────────

  async function loadDashboard() {
    const el = document.getElementById('tab-dashboard');
    el.innerHTML = '<p class="text-gray-400 text-sm py-4">로딩 중...</p>';
    try {
      const res  = await adminFetch(API_BASE + 'api/admin/stats.php');
      const json = await res.json();
      if (!json.success) { el.innerHTML = '<p class="text-red-500">통계 로드 실패</p>'; return; }
      const s = json.data;

      el.innerHTML = `
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          ${[
            { label: '전체 행사',   value: s.total_events,    cls: 'text-[#0172FE]' },
            { label: '오늘 신규',   value: s.today_new,       cls: 'text-green-500' },
            { label: '신고 대기',   value: s.pending_reports, cls: 'text-red-500'   },
            { label: '7일 내 만료', value: s.expiring_in_7,   cls: 'text-orange-500'},
          ].map(c => `
            <div class="bg-white rounded-xl p-4 shadow-sm">
              <p class="text-xs text-gray-500 mb-1">${c.label}</p>
              <p class="text-2xl font-bold ${c.cls}">${c.value}</p>
            </div>
          `).join('')}
        </div>
        <div class="bg-white rounded-xl p-4 shadow-sm">
          <p class="text-sm font-medium text-gray-700 mb-3">최근 30일 등록 추이</p>
          <canvas id="reg-chart" height="80"></canvas>
        </div>
      `;

      new Chart(document.getElementById('reg-chart').getContext('2d'), {
        type: 'line',
        data: {
          labels:   s.chart_data.map(d => d.date),
          datasets: [{
            label:           '등록 수',
            data:            s.chart_data.map(d => parseInt(d.count)),
            borderColor:     '#0172FE',
            backgroundColor: 'rgba(1,114,254,0.1)',
            tension:         0.4,
            fill:            true,
          }],
        },
        options: {
          plugins: { legend: { display: false } },
          scales:  { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
        },
      });
    } catch (e) {
      if (e.message !== 'auth_expired') el.innerHTML = '<p class="text-red-500">통계를 불러오지 못했습니다.</p>';
    }
  }

  // ── 행사 목록 ────────────────────────────────────────────

  async function loadEvents(page = 1) {
    const el = document.getElementById('tab-events');
    el.innerHTML = `
      <div class="flex gap-2 mb-4 flex-wrap">
        <input id="ev-search" type="text" placeholder="상점명 검색"
          class="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0172FE]"
          onkeydown="if(event.key==='Enter') Admin.searchEvents()">
        <select id="ev-status" class="border border-gray-300 rounded-lg px-3 py-2 text-sm">
          <option value="">전체 상태</option>
          <option value="active">활성</option>
          <option value="expired">만료</option>
        </select>
        <button onclick="Admin.searchEvents()"
          class="bg-[#0172FE] text-white px-4 py-2 rounded-lg text-sm font-medium">검색</button>
      </div>
      <div id="events-table-wrap"></div>
    `;
    await searchEvents(page);
  }

  async function searchEvents(page = 1) {
    const search = document.getElementById('ev-search')?.value  || '';
    const status = document.getElementById('ev-status')?.value  || '';
    const params = new URLSearchParams({ search, status, page });
    try {
      const res  = await adminFetch(`${API_BASE}api/admin/event.php?${params}`);
      const json = await res.json();
      if (!json.success) return;
      const { events, total } = json.data;

      document.getElementById('events-table-wrap').innerHTML = `
        <div class="bg-white rounded-xl shadow-sm overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-gray-50 text-gray-500 text-xs">
              <tr>
                <th class="px-4 py-3 text-left">상점명</th>
                <th class="px-4 py-3 text-left hidden md:table-cell">카테고리</th>
                <th class="px-4 py-3 text-left hidden lg:table-cell">기간</th>
                <th class="px-4 py-3 text-left">상태</th>
                <th class="px-4 py-3 text-left">신고</th>
                <th class="px-4 py-3 text-right">관리</th>
              </tr>
            </thead>
            <tbody>
              ${events.length === 0
                ? '<tr><td colspan="6" class="px-4 py-6 text-center text-gray-400 text-sm">행사가 없습니다.</td></tr>'
                : events.map(ev => `
                  <tr class="border-t border-gray-100 hover:bg-gray-50">
                    <td class="px-4 py-3 font-medium max-w-[120px] truncate">${ev.store_name}</td>
                    <td class="px-4 py-3 hidden md:table-cell text-gray-500 text-xs">${ev.category_name}</td>
                    <td class="px-4 py-3 hidden lg:table-cell text-gray-400 text-xs whitespace-nowrap">${fmtDt(ev.start_date)} ~ ${fmtDt(ev.end_date)}</td>
                    <td class="px-4 py-3">
                      <span class="px-2 py-0.5 rounded-full text-xs font-medium ${ev.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}">
                        ${ev.status === 'active' ? '활성' : '만료'}
                      </span>
                    </td>
                    <td class="px-4 py-3 text-gray-500 text-xs">${ev.report_count}</td>
                    <td class="px-4 py-3 text-right">
                      <button onclick="Admin.deleteEvent(${ev.id})"
                        class="text-xs text-red-500 hover:underline">삭제</button>
                    </td>
                  </tr>
                `).join('')}
            </tbody>
          </table>
          <p class="text-xs text-gray-400 px-4 py-3 border-t">총 ${total}건</p>
        </div>
      `;
    } catch (e) {
      if (e.message !== 'auth_expired') document.getElementById('events-table-wrap').innerHTML = '<p class="text-red-500">목록을 불러오지 못했습니다.</p>';
    }
  }

  async function deleteEvent(id) {
    if (!confirm('이 행사를 삭제하시겠습니까?')) return;
    try {
      const res  = await adminFetch(`${API_BASE}api/admin/event.php?id=${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) searchEvents();
      else alert(json.error);
    } catch (e) { if (e.message !== 'auth_expired') alert('삭제 중 오류가 발생했습니다.'); }
  }

  // ── 신고 관리 ────────────────────────────────────────────

  async function loadReports() {
    const el = document.getElementById('tab-reports');
    el.innerHTML = '<p class="text-gray-400 text-sm py-4">로딩 중...</p>';
    try {
      const res  = await adminFetch(API_BASE + 'api/admin/reports.php');
      const json = await res.json();
      if (!json.success) { el.innerHTML = '<p class="text-red-500">신고 목록 로드 실패</p>'; return; }

      el.innerHTML = `
        <div class="bg-white rounded-xl shadow-sm overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-gray-50 text-gray-500 text-xs">
              <tr>
                <th class="px-4 py-3 text-left">상점명</th>
                <th class="px-4 py-3 text-left">사유</th>
                <th class="px-4 py-3 text-left hidden md:table-cell">신고일시</th>
                <th class="px-4 py-3 text-left">상태</th>
                <th class="px-4 py-3 text-right">처리</th>
              </tr>
            </thead>
            <tbody>
              ${json.data.length === 0
                ? '<tr><td colspan="5" class="px-4 py-6 text-center text-gray-400 text-sm">신고가 없습니다.</td></tr>'
                : json.data.map(r => `
                  <tr class="border-t border-gray-100 ${parseInt(r.resolved) ? 'opacity-40' : ''}">
                    <td class="px-4 py-3 font-medium">${r.store_name}</td>
                    <td class="px-4 py-3 text-gray-500 text-xs">${r.reason || '-'}</td>
                    <td class="px-4 py-3 hidden md:table-cell text-gray-400 text-xs whitespace-nowrap">${r.created_at}</td>
                    <td class="px-4 py-3">
                      <span class="text-xs ${parseInt(r.resolved) ? 'text-gray-400' : 'text-red-500 font-medium'}">
                        ${parseInt(r.resolved) ? '처리됨' : '대기'}
                      </span>
                    </td>
                    <td class="px-4 py-3 text-right">
                      ${!parseInt(r.resolved) ? `
                        <button onclick="Admin.resolveReport(${r.id})"
                          class="text-xs text-gray-500 hover:underline mr-2">무시</button>
                        <button onclick="Admin.deleteEventByReport(${r.id})"
                          class="text-xs text-red-500 hover:underline">행사삭제</button>
                      ` : ''}
                    </td>
                  </tr>
                `).join('')}
            </tbody>
          </table>
        </div>
      `;
    } catch (e) {
      if (e.message !== 'auth_expired') el.innerHTML = '<p class="text-red-500">신고 목록을 불러오지 못했습니다.</p>';
    }
  }

  async function resolveReport(reportId) {
    try {
      const res  = await adminFetch(API_BASE + 'api/admin/reports.php', {
        method: 'PUT',
        body:   JSON.stringify({ report_id: reportId, action: 'resolve' }),
      });
      const json = await res.json();
      if (json.success) loadReports();
      else alert(json.error);
    } catch (e) { if (e.message !== 'auth_expired') alert('처리 중 오류가 발생했습니다.'); }
  }

  async function deleteEventByReport(reportId) {
    if (!confirm('신고된 행사를 삭제하시겠습니까?')) return;
    try {
      const res  = await adminFetch(API_BASE + 'api/admin/reports.php', {
        method: 'PUT',
        body:   JSON.stringify({ report_id: reportId, action: 'delete_event' }),
      });
      const json = await res.json();
      if (json.success) loadReports();
      else alert(json.error);
    } catch (e) { if (e.message !== 'auth_expired') alert('삭제 중 오류가 발생했습니다.'); }
  }

  // ── 카테고리 관리 ────────────────────────────────────────

  async function loadCategories() {
    const el = document.getElementById('tab-categories');
    el.innerHTML = '<p class="text-gray-400 text-sm py-4">로딩 중...</p>';
    try {
      const res  = await adminFetch(API_BASE + 'api/admin/categories.php');
      const json = await res.json();
      if (!json.success) { el.innerHTML = '<p class="text-red-500">카테고리 로드 실패</p>'; return; }

      el.innerHTML = `
        <div class="bg-white rounded-xl shadow-sm p-4 mb-4">
          <h3 class="font-medium text-sm mb-3 text-gray-700">카테고리 추가</h3>
          <div class="flex gap-2">
            <input id="new-cat-name" type="text" placeholder="새 카테고리명"
              onkeydown="if(event.key==='Enter') Admin.addCategory()"
              class="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0172FE]">
            <button onclick="Admin.addCategory()"
              class="bg-[#0172FE] text-white px-4 py-2 rounded-lg text-sm font-medium">추가</button>
          </div>
        </div>
        <div class="bg-white rounded-xl shadow-sm overflow-hidden">
          <table class="w-full text-sm">
            <thead class="bg-gray-50 text-gray-500 text-xs">
              <tr>
                <th class="px-4 py-3 text-left">카테고리명</th>
                <th class="px-4 py-3 text-left">순서</th>
                <th class="px-4 py-3 text-right">관리</th>
              </tr>
            </thead>
            <tbody>
              ${json.data.map(cat => `
                <tr class="border-t border-gray-100 hover:bg-gray-50">
                  <td class="px-4 py-3">
                    ${cat.name}
                    ${parseInt(cat.is_custom) ? '<span class="text-xs text-gray-400 ml-1">(직접입력)</span>' : ''}
                  </td>
                  <td class="px-4 py-3 text-gray-400 text-xs">${cat.sort_order}</td>
                  <td class="px-4 py-3 text-right">
                    <button onclick="Admin.deleteCategory(${cat.id})"
                      class="text-xs text-red-500 hover:underline">삭제</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    } catch (e) {
      if (e.message !== 'auth_expired') el.innerHTML = '<p class="text-red-500">카테고리를 불러오지 못했습니다.</p>';
    }
  }

  async function addCategory() {
    const input = document.getElementById('new-cat-name');
    const name  = input?.value.trim();
    if (!name) { alert('카테고리명을 입력해주세요.'); return; }
    try {
      const res  = await adminFetch(API_BASE + 'api/admin/categories.php', {
        method: 'POST',
        body:   JSON.stringify({ name }),
      });
      const json = await res.json();
      if (json.success) { if (input) input.value = ''; loadCategories(); }
      else alert(json.error);
    } catch (e) { if (e.message !== 'auth_expired') alert('추가 중 오류가 발생했습니다.'); }
  }

  async function deleteCategory(id) {
    if (!confirm('카테고리를 삭제하시겠습니까?\n해당 카테고리로 등록된 행사에 영향을 줄 수 있습니다.')) return;
    try {
      const res  = await adminFetch(`${API_BASE}api/admin/categories.php?id=${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) loadCategories();
      else alert(json.error);
    } catch (e) { if (e.message !== 'auth_expired') alert('삭제 중 오류가 발생했습니다.'); }
  }

  // ── 토큰 자동 확인 (페이지 로드 시) ──────────────────────

  async function checkSession() {
    if (!getToken()) return; // 토큰 없으면 로그인 화면 유지
    try {
      const res  = await fetch(API_BASE + 'api/admin/auth.php', {
        method:  'POST',
        headers: authHeaders(),
        body:    JSON.stringify({ action: 'check' }),
      });
      const json = await res.json();
      if (json.success) {
        showMain();
      } else {
        clearToken(); // 만료된 토큰 제거
      }
    } catch {}
  }

  window.addEventListener('DOMContentLoaded', () => checkSession());

  return {
    login, logout, showTab,
    searchEvents, deleteEvent,
    resolveReport, deleteEventByReport,
    addCategory, deleteCategory,
  };
})();
