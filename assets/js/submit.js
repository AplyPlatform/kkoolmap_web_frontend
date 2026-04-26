// web/assets/js/submit.js
const SubmitManager = (() => {
  let saleItems          = [{ description: '', discount_rate: '' }];
  let selectedPlace      = null;
  let selectedCategoryId = null;
  let searchDebounce     = null;
  let cachedCats         = [];
  let directInputMode    = false;
  let directCoords       = null; // { address, lat, lng }

  function render(cats) {
    cachedCats = cats;
    const container = document.getElementById('submit-form-content');
    container.innerHTML = `
      <!-- 상점 검색 -->
      <div class="mb-4">
        <label class="block text-sm font-medium text-gray-700 mb-1">
          상호 검색 <span class="text-red-500">*</span>
        </label>

        <!-- 모드 전환 탭 -->
        <div class="flex gap-1 mb-2 bg-gray-100 p-1 rounded-lg">
          <button type="button" id="mode-naver-btn"
            onclick="SubmitManager.switchToNaverSearch()"
            class="flex-1 text-xs py-1.5 rounded-md font-medium transition-all bg-white text-[#0172FE] shadow-sm">
            상호명 검색
          </button>
          <button type="button" id="mode-direct-btn"
            onclick="SubmitManager.switchToDirectInput()"
            class="flex-1 text-xs py-1.5 rounded-md font-medium transition-all text-gray-500">
            주소 검색
          </button>
        </div>

        <!-- 상호명 검색 섹션 (기본) -->
        <div id="naver-search-section">
          <input id="store-search" type="text" placeholder="상점명을 검색하세요"
            class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0172FE]">
          <div id="search-results"
            class="hidden mt-1 border border-gray-200 rounded-lg bg-white shadow-sm max-h-48 overflow-y-auto relative z-10"></div>
          <div id="selected-place" class="hidden mt-2 p-2 bg-[#e6f2ff] rounded-lg text-xs text-gray-600"></div>
        </div>

        <!-- 주소 직접 입력 섹션 -->
        <div id="direct-input-section" class="hidden space-y-2">
          <input id="direct-store-name" type="text" placeholder="상호 또는 장소를 입력하세요"
            class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0172FE]">
          <div class="flex gap-2">
            <input id="direct-address" type="text" readonly placeholder="주소 검색 버튼을 클릭하세요"
              onclick="SubmitManager.openKakaoPostcode()"
              class="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm bg-gray-50 cursor-pointer focus:outline-none">
            <button type="button" onclick="SubmitManager.openKakaoPostcode()"
              class="flex-shrink-0 bg-[#0172FE] text-white px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap">
              주소 검색
            </button>
          </div>
          <div id="direct-selected-place" class="hidden p-2 bg-[#e6f2ff] rounded-lg text-xs text-gray-600"></div>
        </div>
      </div>

      <!-- 카테고리 -->
      <div class="mb-4">
        <label class="block text-sm font-medium text-gray-700 mb-2">
          카테고리 <span class="text-red-500">*</span>
        </label>
        <div class="grid grid-cols-4 gap-2">
          ${cats.map(cat => `
            <button type="button"
              data-cat-id="${cat.id}" data-is-custom="${cat.is_custom}"
              onclick="SubmitManager.selectCategory(${cat.id}, ${cat.is_custom})"
              class="cat-btn text-xs py-2 px-1 border border-gray-300 rounded-lg text-gray-600 transition-colors">
              ${cat.name}
            </button>
          `).join('')}
        </div>
        <div id="custom-cat-wrap" class="hidden mt-2">
          <input id="custom-category" type="text" placeholder="카테고리 직접 입력"
            class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0172FE]">
        </div>
      </div>

      <!-- 행사 기간 -->
      <div class="mb-4">
        <label class="block text-sm font-medium text-gray-700 mb-1">
          행사 기간 <span class="text-red-500">*</span>
        </label>
        <div class="space-y-1">
          <div class="flex gap-2 items-center">
            <input id="start-date" type="date"
              class="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0172FE]">
            <input id="start-time" type="time" value="00:00"
              class="w-35 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0172FE]">
          </div>
          <div class="flex gap-2 items-center">
            <span class="text-gray-400 text-sm flex-shrink-0">~</span>
            <input id="end-date" type="date"
              class="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0172FE]">
            <input id="end-time" type="time" value="23:59"
              class="w-35 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0172FE]">
          </div>
        </div>
      </div>

      <!-- 세일 항목 -->
      <div class="mb-5">
        <label class="block text-sm font-medium text-gray-700 mb-2">
          세일 항목 <span class="text-red-500">*</span>
        </label>
        <div id="sale-items-container"></div>
        <button type="button" onclick="SubmitManager.addSaleItem()"
          class="mt-2 text-sm text-[#0172FE] font-medium flex items-center gap-1">
          <span class="text-lg leading-none">+</span> 항목 추가
        </button>
      </div>

      <!-- 기타 메모 -->
      <div class="mb-5">
        <label class="block text-sm font-medium text-gray-700 mb-1">기타 메모 <span class="text-xs text-gray-400">(선택)</span></label>
        <textarea id="event-memo" maxlength="500" rows="3" placeholder="추가 안내사항이 있으면 입력해주세요 (최대 500자)"
          oninput="document.getElementById('memo-counter').textContent = this.value.length"
          class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0172FE] resize-none"></textarea>
        <p class="text-right text-xs text-gray-400 mt-0.5"><span id="memo-counter">0</span> / 500</p>
      </div>

      <!-- 수정 비밀번호 -->
      <div class="mb-5">
        <label class="block text-sm font-medium text-gray-700 mb-1">
          수정 비밀번호 <span class="text-red-500">*</span>
        </label>
        <input id="reg-password" type="password" placeholder="나중에 수정 시 사용할 비밀번호"
          class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0172FE]">
        <p class="text-xs text-gray-400 mt-1">⚠ 비밀번호를 잊어버리면 수정할 수 없습니다</p>
      </div>

      <p id="form-error" class="hidden text-red-500 text-sm mb-3 bg-red-50 px-3 py-2 rounded-lg"></p>

      <button type="button" onclick="SubmitManager.submit()"
        class="w-full bg-[#0172FE] text-white py-3 rounded-xl font-bold text-base mb-6">
        등록 하기
      </button>
    `;
    renderSaleItems();
    setupSearchListener();
  }

  // ── 모드 전환 ──────────────────────────────────────────────

  function switchToNaverSearch() {
    directInputMode = false;
    directCoords    = null;
    selectedPlace   = null;
    document.getElementById('naver-search-section')?.classList.remove('hidden');
    document.getElementById('direct-input-section')?.classList.add('hidden');
    const nb = document.getElementById('mode-naver-btn');
    const db = document.getElementById('mode-direct-btn');
    if (nb) { nb.classList.add('bg-white', 'text-[#0172FE]', 'shadow-sm'); nb.classList.remove('text-gray-500'); }
    if (db) { db.classList.remove('bg-white', 'text-[#0172FE]', 'shadow-sm'); db.classList.add('text-gray-500'); }
  }

  function switchToDirectInput() {
    directInputMode = true;
    selectedPlace   = null;
    document.getElementById('naver-search-section')?.classList.add('hidden');
    document.getElementById('direct-input-section')?.classList.remove('hidden');
    document.getElementById('direct-store-name')?.focus();
    const nb = document.getElementById('mode-naver-btn');
    const db = document.getElementById('mode-direct-btn');
    if (nb) { nb.classList.remove('bg-white', 'text-[#0172FE]', 'shadow-sm'); nb.classList.add('text-gray-500'); }
    if (db) { db.classList.add('bg-white', 'text-[#0172FE]', 'shadow-sm'); db.classList.remove('text-gray-500'); }
  }

  // ── 카카오 주소 검색 ───────────────────────────────────────

  function openKakaoPostcode() {
    if (typeof daum === 'undefined' || typeof daum.Postcode === 'undefined') {
      alert('주소 검색 서비스를 불러오는 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }
    new daum.Postcode({
      oncomplete: async function(data) {
        const addr = data.roadAddress || data.jibunAddress;
        if (!addr) return;

        const addrInput = document.getElementById('direct-address');
        const displayEl = document.getElementById('direct-selected-place');
        if (addrInput) addrInput.value = '좌표 변환 중...';
        if (displayEl) displayEl.classList.add('hidden');

        try {
          const res  = await fetch(API_BASE + 'api/geocode.php?q=' + encodeURIComponent(addr));
          const json = await res.json();
          if (json.success) {
            directCoords = { address: addr, lat: json.data.lat, lng: json.data.lng };
            if (addrInput) addrInput.value = addr;
            if (displayEl) { displayEl.textContent = '📍 ' + addr; displayEl.classList.remove('hidden'); }
          } else {
            directCoords = null;
            if (addrInput) addrInput.value = '';
            alert(json.error || '주소 좌표 변환에 실패했습니다.');
          }
        } catch {
          directCoords = null;
          if (addrInput) addrInput.value = '';
          alert('네트워크 오류가 발생했습니다.');
        }
      }
    }).open();
  }

  // ── 세일 항목 ──────────────────────────────────────────────

  function renderSaleItems() {
    const container = document.getElementById('sale-items-container');
    if (!container) return;
    container.innerHTML = saleItems.map((item, i) => `
      <div class="flex gap-2 mb-2 items-start">
        <div class="flex-1 space-y-1">
          <input type="text" placeholder="행사 내용 (예: 전 메뉴)" value="${escapeHtml(item.description)}"
            oninput="SubmitManager.updateItem(${i},'description',this.value)"
            class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0172FE]">
          <input type="text" placeholder="할인율 (예: 30%, 1+1)" value="${escapeHtml(item.discount_rate)}"
            oninput="SubmitManager.updateItem(${i},'discount_rate',this.value)"
            class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0172FE]">
        </div>
        ${saleItems.length > 1 ? `
          <button type="button" onclick="SubmitManager.removeSaleItem(${i})"
            class="mt-1 text-gray-300 hover:text-red-400 p-1 flex-shrink-0">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        ` : '<div class="w-7 flex-shrink-0"></div>'}
      </div>
    `).join('');
  }

  function escapeHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function addSaleItem() {
    saleItems.push({ description: '', discount_rate: '' });
    renderSaleItems();
  }

  function removeSaleItem(i) {
    saleItems.splice(i, 1);
    renderSaleItems();
  }

  function updateItem(i, field, val) {
    saleItems[i][field] = val;
  }

  // ── 카테고리 ───────────────────────────────────────────────

  function selectCategory(catId, isCustom) {
    selectedCategoryId = catId;
    document.querySelectorAll('.cat-btn').forEach(btn => {
      const active = parseInt(btn.dataset.catId) === catId;
      btn.classList.toggle('bg-[#0172FE]',    active);
      btn.classList.toggle('text-white',      active);
      btn.classList.toggle('border-[#0172FE]', active);
      btn.classList.toggle('border-gray-300', !active);
      btn.classList.toggle('text-gray-600',   !active);
    });
    document.getElementById('custom-cat-wrap')?.classList.toggle('hidden', !parseInt(isCustom));
  }

  // ── 상호명 검색 (Naver) ───────────────────────────────────

  function setupSearchListener() {
    const input = document.getElementById('store-search');
    if (!input) return;
    input.addEventListener('input', () => {
      clearTimeout(searchDebounce);
      const q = input.value.trim();
      if (q.length < 2) {
        document.getElementById('search-results').classList.add('hidden');
        return;
      }
      searchDebounce = setTimeout(() => doSearch(q), 400);
    });
  }

  async function doSearch(q) {
    try {
      const res  = await fetch(`${API_BASE}api/search.php?q=${encodeURIComponent(q)}`);
      const json = await res.json();
      const el   = document.getElementById('search-results');
      if (!json.success || !json.data.length) { el.classList.add('hidden'); return; }
      el.classList.remove('hidden');
      el.innerHTML = json.data.map(item => `
        <button type="button" onclick='SubmitManager.selectPlace(${JSON.stringify(item)})'
          class="w-full text-left px-3 py-2.5 hover:bg-[#e6f2ff] border-b border-gray-100 last:border-0">
          <p class="text-sm font-medium text-gray-800">${item.title}</p>
          <p class="text-xs text-gray-500 mt-0.5">${item.roadAddress || item.address}</p>
        </button>
      `).join('');
    } catch (e) {
      console.error('장소 검색 오류:', e);
    }
  }

  function selectPlace(place) {
    selectedPlace = place;
    document.getElementById('store-search').value = place.title;
    document.getElementById('search-results').classList.add('hidden');
    const el = document.getElementById('selected-place');
    el.classList.remove('hidden');
    el.textContent = '📍 ' + (place.roadAddress || place.address);
  }

  // ── 초기화 ─────────────────────────────────────────────────

  function reset() {
    saleItems          = [{ description: '', discount_rate: '' }];
    selectedPlace      = null;
    selectedCategoryId = null;
    directInputMode    = false;
    directCoords       = null;
    render(cachedCats);
  }

  // ── 등록 제출 ──────────────────────────────────────────────

  async function submit() {
    const errEl = document.getElementById('form-error');
    errEl.classList.add('hidden');

    // 상점 정보 결정 (모드에 따라 분기)
    let storeName, address, lat, lng;

    if (directInputMode) {
      storeName = document.getElementById('direct-store-name')?.value.trim();
      if (!storeName)   { showError('상호명을 입력해주세요.'); return; }
      if (!directCoords) { showError('주소를 검색해주세요.'); return; }
      address = directCoords.address;
      lat     = directCoords.lat;
      lng     = directCoords.lng;
      if (lat < 33 || lat > 38.5 || lng < 124 || lng > 132) {
        showError('유효하지 않은 위치 좌표입니다.'); return;
      }
    } else {
      if (!selectedPlace) { showError('상점을 검색하여 선택해주세요.'); return; }
      storeName = selectedPlace.title;
      address   = selectedPlace.roadAddress || selectedPlace.address;

      // Naver Local Search API 좌표 형식 자동 감지 후 WGS84 변환
      // - WGS84 × 10^7 형식: mapx > 100,000,000 (예: 1269000000 → 126.9°)
      // - NHN(구카텍) × 10 형식: mapx < 10,000,000 (예: 3155000 → 315500m easting)
      const rawX   = parseInt(selectedPlace.mapx);
      const rawY   = parseInt(selectedPlace.mapy);
      const coords = (rawX > 100000000)
        ? { lat: rawY / 1e7, lng: rawX / 1e7 }
        : nhnToWgs84(rawX / 10, rawY / 10);

      if (!coords || coords.lat < 33 || coords.lat > 38.5 || coords.lng < 124 || coords.lng > 132) {
        showError('위치 좌표 변환에 실패했습니다. 다른 검색어로 다시 시도해주세요.');
        return;
      }
      lat = coords.lat;
      lng = coords.lng;
    }

    if (!selectedCategoryId) { showError('카테고리를 선택해주세요.'); return; }

    const startDate = document.getElementById('start-date').value;
    const startTime = document.getElementById('start-time').value || '00:00';
    const endDate   = document.getElementById('end-date').value;
    const endTime   = document.getElementById('end-time').value || '23:59';
    if (!startDate || !endDate) { showError('행사 기간을 입력해주세요.'); return; }
    if (new Date(`${startDate}T${startTime}`) > new Date(`${endDate}T${endTime}`)) {
      showError('종료 일시는 시작 일시 이후여야 합니다.'); return;
    }
    const startDatetime = `${startDate} ${startTime}:00`;
    const endDatetime   = `${endDate} ${endTime}:00`;

    const validItems = saleItems.filter(i => i.description.trim() && i.discount_rate.trim());
    if (!validItems.length) { showError('세일 항목을 최소 1개 입력해주세요.'); return; }

    const pwEl     = document.getElementById('reg-password');
    const password = pwEl ? pwEl.value : '';
    if (!password) { showError('수정 비밀번호를 입력해주세요.'); return; }

    const customCatEl = document.getElementById('custom-category');
    const memoEl      = document.getElementById('event-memo');
    const payload = {
      store_name:      storeName,
      category_id:     selectedCategoryId,
      category_custom: customCatEl ? customCatEl.value.trim() : '',
      address:         address,
      lat:             lat,
      lng:             lng,
      start_date:      startDatetime,
      end_date:        endDatetime,
      sale_items:      validItems,
      memo:            memoEl ? memoEl.value.trim() : '',
      password:        password,
    };

    try {
      const res  = await fetch(API_BASE + 'api/events.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.success) {
        reset();
        closeSubmitPanel();
        AppState.reloadEvents();
      } else {
        showError(json.error || '등록에 실패했습니다.');
      }
    } catch {
      showError('네트워크 오류가 발생했습니다.');
    }
  }

  function showError(msg) {
    const el = document.getElementById('form-error');
    if (el) { el.textContent = msg; el.classList.remove('hidden'); }
  }

  // NHN(구 카텍, Bessel1841 TM) 좌표 → WGS84 수식 변환
  // Naver Local Search API의 mapx/mapy를 10으로 나눈 값을 입력
  function nhnToWgs84(x, y) {
    const a   = 6377397.155, f = 1 / 299.1528128;
    const e2  = 2*f - f*f,   e = Math.sqrt(e2);
    const k0  = 0.9999, lam0 = 128*Math.PI/180, phi0 = 38*Math.PI/180;
    const E0  = 400000, N0   = 600000;

    function mArc(p) {
      return a * (
        (1 - e2/4 - 3*e2*e2/64 - 5*e2*e2*e2/256)*p
        - (3*e2/8 + 3*e2*e2/32 + 45*e2*e2*e2/1024)*Math.sin(2*p)
        + (15*e2*e2/256 + 45*e2*e2*e2/1024)*Math.sin(4*p)
        - (35*e2*e2*e2/3072)*Math.sin(6*p)
      );
    }

    const M0 = mArc(phi0);
    const M  = M0 + (y - N0) / k0;
    const e1 = (1 - Math.sqrt(1-e2)) / (1 + Math.sqrt(1-e2));
    const mu = M / (a*(1 - e2/4 - 3*e2*e2/64 - 5*e2*e2*e2/256));
    const phi1 = mu
      + (3*e1/2 - 27*e1*e1*e1/32)*Math.sin(2*mu)
      + (21*e1*e1/16 - 55*e1*e1*e1*e1/32)*Math.sin(4*mu)
      + (151*e1*e1*e1/96)*Math.sin(6*mu)
      + (1097*e1*e1*e1*e1/512)*Math.sin(8*mu);

    const sp1 = Math.sin(phi1), cp1 = Math.cos(phi1), tp1 = Math.tan(phi1);
    const N1  = a / Math.sqrt(1 - e2*sp1*sp1);
    const T1  = tp1*tp1;
    const C1  = e2/(1-e2)*cp1*cp1;
    const R1  = a*(1-e2) / Math.pow(1 - e2*sp1*sp1, 1.5);
    const D   = (x - E0) / (N1*k0);
    const D2=D*D, D3=D2*D, D4=D3*D, D5=D4*D, D6=D5*D;

    const phi = phi1 - (N1*tp1/R1)*(
      D2/2
      - (5 + 3*T1 + 10*C1 - 4*C1*C1 - 9*e2/(1-e2))*D4/24
      + (61 + 90*T1 + 298*C1 + 45*T1*T1 - 252*e2/(1-e2) - 3*C1*C1)*D6/720
    );
    const lam = lam0 + (
      D - (1 + 2*T1 + C1)*D3/6
      + (5 - 2*C1 + 28*T1 - 3*C1*C1 + 8*e2/(1-e2) + 24*T1*T1)*D5/120
    ) / cp1;

    // Bessel1841 geographic → Cartesian
    const N2 = a / Math.sqrt(1 - e2*Math.sin(phi)*Math.sin(phi));
    const bX = N2*Math.cos(phi)*Math.cos(lam);
    const bY = N2*Math.cos(phi)*Math.sin(lam);
    const bZ = N2*(1-e2)*Math.sin(phi);

    // Helmert 3-param: Bessel1841 → WGS84 (Korea)
    const wX = bX - 147, wY = bY + 506, wZ = bZ + 687;

    // WGS84 Cartesian → geographic
    const a84 = 6378137.0, f84 = 1/298.257223563;
    const e84_2 = 2*f84 - f84*f84;
    const p = Math.sqrt(wX*wX + wY*wY);
    let phiW = Math.atan2(wZ, p*(1 - e84_2));
    for (let i = 0; i < 10; i++) {
      const N84 = a84 / Math.sqrt(1 - e84_2*Math.sin(phiW)*Math.sin(phiW));
      phiW = Math.atan2(wZ + e84_2*N84*Math.sin(phiW), p);
    }
    return { lat: phiW*180/Math.PI, lng: Math.atan2(wY, wX)*180/Math.PI };
  }

  return {
    render, addSaleItem, removeSaleItem, updateItem, selectCategory, selectPlace,
    switchToNaverSearch, switchToDirectInput, openKakaoPostcode, submit, reset,
  };
})();
