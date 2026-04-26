// web/assets/js/app.js
const AppState = (() => {
  let currentCategoryId = null;
  let currentEventId    = null;
  let currentEvent      = null;
  let cachedCategories  = [];

  async function init() {
    const cats = await fetchCategories();
    cachedCategories = cats;
    renderCategoryTabs(cats);
    SubmitManager.render(cats);
    MapManager.init(showDetailPanel);
  }

  async function fetchCategories() {
    try {
      const res  = await fetch(API_BASE + 'api/categories.php');
      const json = await res.json();
      return json.success ? json.data : [];
    } catch { return []; }
  }

  function renderCategoryTabs(cats) {
    const bar = document.getElementById('category-bar');
    cats.forEach(cat => {
      const btn = document.createElement('button');
      btn.dataset.id  = cat.id;
      btn.className   = 'category-tab flex-shrink-0 text-xs font-medium px-3 py-1.5 rounded-full border border-gray-300 text-gray-600 whitespace-nowrap';
      btn.textContent = cat.name;
      btn.onclick     = () => selectCategory(Number(cat.id));
      bar.appendChild(btn);
    });
  }

  function selectCategory(catId) {
    currentCategoryId = (catId === currentCategoryId) ? null : catId;
    document.querySelectorAll('.category-tab').forEach(btn => {
      const active = btn.dataset.id === ''
        ? currentCategoryId === null
        : parseInt(btn.dataset.id) === currentCategoryId;
      btn.classList.toggle('active', active);
    });
    reloadEvents();
  }

  async function loadEvents(bounds) {
    if (!bounds) return;
    const sw = bounds.getSW();
    const ne = bounds.getNE();
    const params = new URLSearchParams({
      swLat: sw.lat(), swLng: sw.lng(),
      neLat: ne.lat(), neLng: ne.lng(),
    });
    if (currentCategoryId) params.append('category_id', currentCategoryId);

    try {
      const res  = await fetch(`${API_BASE}api/events.php?${params}`);
      const json = await res.json();
      if (json.success) {
        MapManager.renderMarkers(json.data);
      } else {
        console.error('이벤트 로드 실패:', json.error);
      }
    } catch (e) { console.error('이벤트 로드 실패:', e); }
  }

  function reloadEvents() {
    const bounds = MapManager.getBounds();
    if (bounds) loadEvents(bounds);
  }

  function showDetailPanel(event) {
    currentEventId = event.id;
    currentEvent   = event;

    const saleHtml = (event.sale_items || []).map(item => `
      <div class="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
        <span class="text-sm text-gray-700">${item.description}</span>
        <span class="text-sm font-bold text-amber-500 ml-2 flex-shrink-0">${item.discount_rate}</span>
      </div>
    `).join('');

    document.getElementById('detail-content').innerHTML = `
      <div class="flex justify-between items-start mb-2">
        <div class="flex-1 min-w-0">
          <h3 class="text-lg font-bold text-gray-900 truncate">${event.store_name}</h3>
          <span class="inline-block text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full mt-1">
            ${event.category_custom || event.category_name}
          </span>
        </div>
        ${event.is_expired
          ? '<span class="ml-2 text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full flex-shrink-0">종료</span>'
          : ''}
      </div>
      <p class="text-xs text-gray-500 mb-1"><b>📍주소</b> ${event.address}</p>
      <p class="text-xs text-gray-500 mb-3">🗓<b>행사기간</b> ${fmtDt(event.start_date)} ~ ${fmtDt(event.end_date)}</p>
      ${saleHtml
        ? `<div class="mb-4">${saleHtml}</div>`
        : '<p class="text-sm text-gray-400 mb-4">등록된 세일 항목이 없습니다.</p>'}
      ${event.memo ? `<p class="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2 mb-4 whitespace-pre-wrap">${event.memo}</p>` : ''}
      <div class="flex items-center justify-between mt-2 pt-3 border-t border-gray-100">
        <button onclick="openReportModal()"
          class="text-xs text-gray-400 underline">신고하기</button>
        <button id="edit-toggle-btn" onclick="showEditPasswordSection()"
          class="text-xs font-medium text-amber-600 border border-amber-400 px-3 py-1.5 rounded-lg">
          수정하기
        </button>
      </div>
      <div id="edit-password-section" class="hidden mt-3 p-3 bg-amber-50 rounded-xl">
        <p class="text-xs text-gray-600 mb-2">등록 시 설정한 비밀번호를 입력해주세요</p>
        <div class="flex gap-2">
          <input id="edit-pw-input" type="password" placeholder="비밀번호"
            onkeydown="if(event.key==='Enter') verifyAndShowEdit()"
            class="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
          <button onclick="verifyAndShowEdit()"
            class="flex-shrink-0 bg-amber-400 text-white px-4 py-2 rounded-lg text-sm font-medium">
            확인
          </button>
        </div>
        <p id="edit-pw-error" class="hidden text-xs text-red-500 mt-1"></p>
      </div>
    `;

    document.getElementById('detail-modal').classList.remove('hidden');
  }

  function getCurrentEventId() { return currentEventId; }
  function getCurrentEvent()   { return currentEvent; }
  function getCategories()     { return cachedCategories; }

  return { init, loadEvents, reloadEvents, selectCategory, getCurrentEventId, getCurrentEvent, getCategories, showDetailPanel };
})();

// ── 전역 UI 함수 ──────────────────────────────────────────────

function closeDetailPanel() {
  document.getElementById('detail-modal').classList.add('hidden');
}

function openSubmitPanel() {
  closeDetailPanel();
  document.getElementById('submit-panel').classList.remove('hidden');
}

function closeSubmitPanel() {
  document.getElementById('submit-panel').classList.add('hidden');
}

function openReportModal() {
  const eventId = AppState.getCurrentEventId();
  if (!eventId) return;

  const reported = JSON.parse(localStorage.getItem('reportedEvents') || '[]');
  if (reported.includes(eventId)) {
    alert('이미 신고한 행사입니다.');
    return;
  }

  document.getElementById('report-form-content').innerHTML = `
    <div class="space-y-2 mb-4">
      ${['잘못된 정보', '이미 종료된 행사', '허위/과장 광고', '기타'].map(r => `
        <label class="flex items-center gap-3 p-3 border border-gray-200 rounded-xl cursor-pointer hover:bg-amber-50">
          <input type="radio" name="report-reason" value="${r}" class="accent-amber-400">
          <span class="text-sm text-gray-700">${r}</span>
        </label>
      `).join('')}
    </div>
    <button onclick="submitReport(${eventId})"
      class="w-full bg-red-500 text-white py-3 rounded-xl font-bold text-sm">
      신고 접수
    </button>
  `;
  document.getElementById('report-modal').classList.remove('hidden');
}

function closeReportModal() {
  document.getElementById('report-modal').classList.add('hidden');
}

async function submitReport(eventId) {
  const selected = document.querySelector('input[name="report-reason"]:checked');
  if (!selected) { alert('신고 사유를 선택해주세요.'); return; }

  try {
    const res  = await fetch(API_BASE + 'api/report.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_id: eventId, reason: selected.value }),
    });
    const json = await res.json();
    if (json.success) {
      const reported = JSON.parse(localStorage.getItem('reportedEvents') || '[]');
      reported.push(eventId);
      localStorage.setItem('reportedEvents', JSON.stringify(reported));
      closeReportModal();
      alert('신고가 접수되었습니다.');
    } else {
      alert(json.error || '신고 접수에 실패했습니다.');
    }
  } catch {
    alert('네트워크 오류가 발생했습니다.');
  }
}

// ── 수정 기능 ─────────────────────────────────────────────────

let _editSaleItems  = [];
let _editCategoryId = null;
let _editPassword   = '';

function _esc(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function _decodeHtml(str) {
  if (!str) return '';
  const t = document.createElement('textarea');
  t.innerHTML = str;
  return t.value;
}

function showEditPasswordSection() {
  document.getElementById('edit-toggle-btn')?.classList.add('hidden');
  const section = document.getElementById('edit-password-section');
  if (section) {
    section.classList.remove('hidden');
    document.getElementById('edit-pw-input')?.focus();
  }
}

async function verifyAndShowEdit() {
  const pw    = document.getElementById('edit-pw-input')?.value || '';
  const errEl = document.getElementById('edit-pw-error');
  errEl.classList.add('hidden');

  if (!pw) {
    errEl.textContent = '비밀번호를 입력해주세요.';
    errEl.classList.remove('hidden');
    return;
  }

  const eventId = AppState.getCurrentEventId();
  try {
    const res  = await fetch(API_BASE + 'api/event_verify.php', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ id: eventId, password: pw }),
    });
    const json = await res.json();
    if (json.success) {
      showEditForm(pw);
    } else {
      errEl.textContent = json.error || '비밀번호가 올바르지 않습니다.';
      errEl.classList.remove('hidden');
    }
  } catch {
    errEl.textContent = '네트워크 오류가 발생했습니다.';
    errEl.classList.remove('hidden');
  }
}

function showEditForm(password) {
  const event = AppState.getCurrentEvent();
  const cats  = AppState.getCategories();

  _editPassword   = password;
  _editCategoryId = parseInt(event.category_id);
  _editSaleItems  = (event.sale_items || []).map(i => ({
    description:   _decodeHtml(i.description),
    discount_rate: _decodeHtml(i.discount_rate),
  }));
  if (!_editSaleItems.length) _editSaleItems = [{ description: '', discount_rate: '' }];

  const currentCat = cats.find(c => parseInt(c.id) === parseInt(event.category_id));
  const showCustom = currentCat && parseInt(currentCat.is_custom);

  const catHtml = cats.map(cat => {
    const active = parseInt(cat.id) === _editCategoryId;
    return `
      <button type="button" data-edit-cat-id="${cat.id}"
        onclick="selectEditCategory(${cat.id}, ${cat.is_custom})"
        class="edit-cat-btn text-xs py-2 px-1 border rounded-lg transition-colors ${
          active ? 'bg-amber-400 text-white border-amber-400' : 'border-gray-300 text-gray-600'
        }">
        ${_esc(cat.name)}
      </button>
    `;
  }).join('');

  const decodedMemo = _decodeHtml(event.memo || '');
  const decodedCustom = _decodeHtml(event.category_custom || '');

  document.getElementById('detail-content').innerHTML = `
    <div class="flex items-center gap-2 mb-3">
      <button onclick="cancelEdit()" class="p-1 text-gray-400 hover:text-gray-600">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
        </svg>
      </button>
      <h3 class="text-base font-bold text-gray-900">할인 정보 수정</h3>
    </div>
    <p class="text-xs text-gray-500 mb-4">🏪 ${event.store_name} &nbsp;·&nbsp; ${event.address}</p>

    <div class="mb-4">
      <label class="block text-sm font-medium text-gray-700 mb-2">카테고리 <span class="text-red-500">*</span></label>
      <div class="grid grid-cols-4 gap-2">${catHtml}</div>
      <div id="edit-custom-cat-wrap" class="${showCustom ? '' : 'hidden'} mt-2">
        <input id="edit-custom-category" type="text" placeholder="카테고리 직접 입력"
          value="${_esc(decodedCustom)}"
          class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
      </div>
    </div>

    <div class="mb-4">
      <label class="block text-sm font-medium text-gray-700 mb-1">행사 기간 <span class="text-red-500">*</span></label>
      <div class="space-y-1">
        <div class="flex gap-2 items-center">
          <input id="edit-start-date" type="date" value="${_esc(dtDate(event.start_date))}"
            class="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
          <input id="edit-start-time" type="time" value="${_esc(dtTime(event.start_date))}"
            class="w-28 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
        </div>
        <div class="flex gap-2 items-center">
          <span class="text-gray-400 text-sm flex-shrink-0">~</span>
          <input id="edit-end-date" type="date" value="${_esc(dtDate(event.end_date))}"
            class="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
          <input id="edit-end-time" type="time" value="${_esc(dtTime(event.end_date))}"
            class="w-28 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
        </div>
      </div>
    </div>

    <div class="mb-5">
      <label class="block text-sm font-medium text-gray-700 mb-2">세일 항목 <span class="text-red-500">*</span></label>
      <div id="edit-sale-items-container"></div>
      <button type="button" onclick="addEditItem()"
        class="mt-2 text-sm text-amber-500 font-medium flex items-center gap-1">
        <span class="text-lg leading-none">+</span> 항목 추가
      </button>
    </div>

    <div class="mb-5">
      <label class="block text-sm font-medium text-gray-700 mb-1">기타 메모 <span class="text-xs text-gray-400">(선택)</span></label>
      <textarea id="edit-memo" maxlength="500" rows="3"
        oninput="document.getElementById('edit-memo-counter').textContent = this.value.length"
        class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none">${_esc(decodedMemo)}</textarea>
      <p class="text-right text-xs text-gray-400 mt-0.5"><span id="edit-memo-counter">${decodedMemo.length}</span> / 500</p>
    </div>

    <p id="edit-form-error" class="hidden text-red-500 text-sm mb-3 bg-red-50 px-3 py-2 rounded-lg"></p>

    <button type="button" onclick="submitEdit()"
      class="w-full bg-amber-400 text-white py-3 rounded-xl font-bold text-base mb-2">
      저장하기
    </button>
    <button type="button" onclick="deleteEvent()"
      class="w-full text-red-400 border border-red-300 py-3 rounded-xl font-medium text-base mb-6">
      삭제하기
    </button>
  `;

  renderEditSaleItemsContainer();
}

function renderEditSaleItemsContainer() {
  const container = document.getElementById('edit-sale-items-container');
  if (!container) return;
  container.innerHTML = _editSaleItems.map((item, i) => `
    <div class="flex gap-2 mb-2 items-start">
      <div class="flex-1 space-y-1">
        <input type="text" placeholder="세일 내용 (예: 전 메뉴)" value="${_esc(item.description)}"
          oninput="updateEditItem(${i},'description',this.value)"
          class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
        <input type="text" placeholder="할인율 (예: 30%, 1+1)" value="${_esc(item.discount_rate)}"
          oninput="updateEditItem(${i},'discount_rate',this.value)"
          class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
      </div>
      ${_editSaleItems.length > 1 ? `
        <button type="button" onclick="removeEditItem(${i})"
          class="mt-1 text-gray-300 hover:text-red-400 p-1 flex-shrink-0">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      ` : '<div class="w-7 flex-shrink-0"></div>'}
    </div>
  `).join('');
}

function updateEditItem(i, field, val) { _editSaleItems[i][field] = val; }

function addEditItem() {
  _editSaleItems.push({ description: '', discount_rate: '' });
  renderEditSaleItemsContainer();
}

function removeEditItem(i) {
  _editSaleItems.splice(i, 1);
  renderEditSaleItemsContainer();
}

function selectEditCategory(catId, isCustom) {
  _editCategoryId = catId;
  document.querySelectorAll('.edit-cat-btn').forEach(btn => {
    const active = parseInt(btn.dataset.editCatId) === catId;
    btn.classList.toggle('bg-amber-400',     active);
    btn.classList.toggle('text-white',       active);
    btn.classList.toggle('border-amber-400', active);
    btn.classList.toggle('border-gray-300',  !active);
    btn.classList.toggle('text-gray-600',    !active);
  });
  document.getElementById('edit-custom-cat-wrap')?.classList.toggle('hidden', !parseInt(isCustom));
}

function cancelEdit() {
  const event = AppState.getCurrentEvent();
  if (event) AppState.showDetailPanel(event);
}

async function submitEdit() {
  const errEl = document.getElementById('edit-form-error');
  errEl.classList.add('hidden');

  const startDate = document.getElementById('edit-start-date')?.value || '';
  const startTime = document.getElementById('edit-start-time')?.value || '00:00';
  const endDate   = document.getElementById('edit-end-date')?.value || '';
  const endTime   = document.getElementById('edit-end-time')?.value || '23:59';
  if (!startDate || !endDate) {
    errEl.textContent = '행사 기간을 입력해주세요.'; errEl.classList.remove('hidden'); return;
  }
  if (new Date(`${startDate}T${startTime}`) > new Date(`${endDate}T${endTime}`)) {
    errEl.textContent = '종료 일시는 시작 일시 이후여야 합니다.'; errEl.classList.remove('hidden'); return;
  }
  const startDatetime = `${startDate} ${startTime}:00`;
  const endDatetime   = `${endDate} ${endTime}:00`;

  const validItems = _editSaleItems.filter(i => i.description.trim() && i.discount_rate.trim());
  if (!validItems.length) {
    errEl.textContent = '세일 항목을 최소 1개 입력해주세요.'; errEl.classList.remove('hidden'); return;
  }

  const customCatEl = document.getElementById('edit-custom-category');
  const memoEl      = document.getElementById('edit-memo');

  const payload = {
    id:              AppState.getCurrentEventId(),
    password:        _editPassword,
    category_id:     _editCategoryId,
    category_custom: customCatEl ? customCatEl.value.trim() : '',
    start_date:      startDatetime,
    end_date:        endDatetime,
    sale_items:      validItems,
    memo:            memoEl ? memoEl.value.trim() : '',
  };

  try {
    const res  = await fetch(API_BASE + 'api/events.php', {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });
    const json = await res.json();
    if (json.success) {
      _editPassword = '';
      closeDetailPanel();
      AppState.reloadEvents();
    } else {
      errEl.textContent = json.error || '수정에 실패했습니다.';
      errEl.classList.remove('hidden');
    }
  } catch {
    errEl.textContent = '네트워크 오류가 발생했습니다.';
    errEl.classList.remove('hidden');
  }
}

async function deleteEvent() {
  if (!confirm('이 할인 정보를 삭제하시겠습니까?\n삭제 후에는 복구할 수 없습니다.')) return;

  const errEl = document.getElementById('edit-form-error');
  errEl.classList.add('hidden');

  try {
    const res  = await fetch(API_BASE + 'api/events.php', {
      method:  'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ id: AppState.getCurrentEventId(), password: _editPassword }),
    });
    const json = await res.json();
    if (json.success) {
      _editPassword = '';
      closeDetailPanel();
      AppState.reloadEvents();
    } else {
      errEl.textContent = json.error || '삭제에 실패했습니다.';
      errEl.classList.remove('hidden');
    }
  } catch {
    errEl.textContent = '네트워크 오류가 발생했습니다.';
    errEl.classList.remove('hidden');
  }
}

window.addEventListener('DOMContentLoaded', () => AppState.init());
