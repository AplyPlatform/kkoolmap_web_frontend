// web/assets/js/map.js
const MapManager = (() => {
  let map           = null;
  let markers       = [];
  let debounceTimer = null;
  let onMarkerClick = null;
  let onGroupClick  = null;

  const CATEGORY_COLORS = {
    1: '#ef4444', // 음식점
    2: '#f97316', // 카페/베이커리
    3: '#22c55e', // 마트/편의점
    4: '#a855f7', // 의류/패션
    5: '#ec4899', // 뷰티/화장품
    6: '#06b6d4', // 생활/잡화
    7: '#3b82f6', // 전자기기
    8: '#78716c', // 기타
  };

  // ── 아이콘 ───────────────────────────────────────────────

  function markerIcon(event) {
    const color   = event.is_expired ? '#9ca3af' : '#0066cc';
    const opacity = event.is_expired ? 0.55 : 1;
    const catName = (event.category_custom || event.category_name || '').slice(0, 6);
    const rate    = (event.sale_items && event.sale_items.length > 0)
                      ? event.sale_items[0].discount_rate.slice(0, 8)
                      : '';
    return {
      content: `
<div style="position:relative;text-align:center;opacity:${opacity};filter:drop-shadow(0 2px 4px rgba(0,0,0,0.28));">
  <div style="background:${color};border-radius:8px;padding:4px 8px 5px;border:2px solid white;width:80px;box-sizing:border-box;line-height:1.25;">
    <div style="font-size:9px;color:#ffffff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${catName}</div>
    <div style="font-size:13px;font-weight:700;color:#ffffff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${rate}</div>
  </div>
  <div style="width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-top:8px solid ${color};margin:0 auto;"></div>
</div>`,
      size:   new naver.maps.Size(80, 54),
      anchor: new naver.maps.Point(40, 54),
    };
  }

  // 동일 위치 다중 행사 마커 (할인율 + 카운트 배지)
  function locationGroupIcon(rep, count) {
    const color   = rep.is_expired ? '#9ca3af' : (CATEGORY_COLORS[rep.category_id] || '#0066cc');
    const opacity = rep.is_expired ? 0.55 : 1;
    const catName = (rep.category_custom || rep.category_name || '').slice(0, 6);
    const rate    = (rep.sale_items && rep.sale_items.length > 0)
                      ? rep.sale_items[0].discount_rate.slice(0, 8)
                      : '';
    return {
      content: `
<div style="position:relative;text-align:center;opacity:${opacity};filter:drop-shadow(0 2px 4px rgba(0,0,0,0.28));">
  <div style="background:${color};border-radius:8px;padding:4px 8px 5px;border:2px solid white;width:80px;box-sizing:border-box;line-height:1.25;position:relative;">
    <div style="font-size:9px;color:rgba(255,255,255,0.88);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${catName}</div>
    <div style="font-size:12px;font-weight:700;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${rate}</div>
    <div style="position:absolute;top:-9px;right:-9px;background:#ef4444;color:white;border-radius:9px;min-width:18px;height:18px;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;border:2px solid white;padding:0 3px;line-height:1;box-sizing:border-box;">${count}</div>
  </div>
  <div style="width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-top:8px solid ${color};margin:0 auto;"></div>
</div>`,
      size:   new naver.maps.Size(92, 58),
      anchor: new naver.maps.Point(46, 58),
    };
  }

  // 광역 지리 클러스터 아이콘 (줌 아웃 시)
  function clusterIcon(count) {
    const bg = count >= 100 ? '#ef4444' : count >= 10 ? '#f97316' : '#0066cc';
    const sz = count >= 100 ? 52        : count >= 10 ? 44        : 36;
    const fs = count >= 100 ? 12        : 13;
    return {
      content: `<div style="
        width:${sz}px;height:${sz}px;border-radius:50%;
        background:${bg};border:3px solid white;
        box-shadow:0 2px 8px rgba(0,0,0,0.35);
        display:flex;align-items:center;justify-content:center;
        font-size:${fs}px;font-weight:700;color:white;cursor:pointer;
      ">${count}</div>`,
      size:   new naver.maps.Size(sz, sz),
      anchor: new naver.maps.Point(sz / 2, sz / 2),
    };
  }

  // ── 그룹화 ───────────────────────────────────────────────

  // 동일 주소(또는 좌표 4자리 반올림 ≈11m 이내)별 그룹화
  function groupByLocation(events) {
    const groups = {};
    events.forEach(function(ev) {
      const key = ev.address
        ? ev.address.trim()
        : parseFloat(ev.lat).toFixed(4) + ',' + parseFloat(ev.lng).toFixed(4);
      if (!groups[key]) groups[key] = [];
      groups[key].push(ev);
    });
    return Object.values(groups);
  }

  // 줌 레벨에 따른 그리드 크기(도) — zoom 14 기준 ~220m
  function gridDegrees() {
    return 0.002 * Math.pow(2, Math.max(0, 14 - map.getZoom()));
  }

  // ── 마커 렌더링 ──────────────────────────────────────────

  function init(onClickCallback, onGroupCallback) {
    onMarkerClick = onClickCallback;
    onGroupClick  = onGroupCallback;
    map = new naver.maps.Map('map', {
      center: new naver.maps.LatLng(37.5665, 126.9780),
      zoom: 14,
      mapTypeControl: false,
      scaleControl: true,
      scaleControlOptions: { position: naver.maps.Position.BOTTOM_LEFT },
      logoControl: false,
      mapDataControl: false,
    });
    naver.maps.Event.addListener(map, 'idle', function() {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function() {
        AppState.loadEvents(map.getBounds());
      }, 300);
    });

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(function(pos) {
        var lat = pos.coords.latitude;
        var lng = pos.coords.longitude;
        map.setCenter(new naver.maps.LatLng(lat, lng));
        new naver.maps.Marker({
          position: new naver.maps.LatLng(lat, lng),
          map: map,
          icon: {
            content: '<div style="width:14px;height:14px;border-radius:50%;background:#4285F4;border:2.5px solid white;box-shadow:0 0 0 6px rgba(66,133,244,0.22);"></div>',
            size: new naver.maps.Size(14, 14),
            anchor: new naver.maps.Point(7, 7),
          },
          title: '현재 위치',
        });
      });
    }
  }

  function clearMarkers() {
    markers.forEach(function(m) { m.setMap(null); });
    markers = [];
  }

  // 단일 위치 그룹(같은 주소의 행사 묶음)을 마커 하나로 렌더링
  function _renderLocationGroup(events) {
    // 유효 행사를 우선으로 정렬
    const sorted = events.slice().sort(function(a, b) {
      return (a.is_expired ? 1 : 0) - (b.is_expired ? 1 : 0);
    });
    const rep = sorted[0];

    const icon    = events.length === 1 ? markerIcon(rep) : locationGroupIcon(rep, events.length);
    const title   = events.length > 1 ? events.length + '개 행사' : rep.store_name;
    const onClick = events.length === 1
      ? function() { if (onMarkerClick) onMarkerClick(rep); }
      : function() { if (onGroupClick)  onGroupClick(sorted); };

    const m = new naver.maps.Marker({
      position: new naver.maps.LatLng(rep.lat, rep.lng),
      map:      map,
      icon:     icon,
      title:    title,
    });
    naver.maps.Event.addListener(m, 'click', onClick);
    markers.push(m);
  }

  // 줌 ≤ 9 : 광역 지리 클러스터링
  function _renderGeoClusters(events) {
    const grid  = gridDegrees();
    const cells = {};
    events.forEach(function(ev) {
      const key = Math.floor(parseFloat(ev.lat) / grid) + ',' + Math.floor(parseFloat(ev.lng) / grid);
      if (!cells[key]) cells[key] = [];
      cells[key].push(ev);
    });
    Object.values(cells).forEach(function(group) {
      if (group.length === 1) {
        _renderLocationGroup(group);
      } else {
        const avgLat = group.reduce(function(s, e) { return s + parseFloat(e.lat); }, 0) / group.length;
        const avgLng = group.reduce(function(s, e) { return s + parseFloat(e.lng); }, 0) / group.length;
        const m = new naver.maps.Marker({
          position: new naver.maps.LatLng(avgLat, avgLng),
          map:      map,
          icon:     clusterIcon(group.length),
          title:    group.length + '개 행사',
        });
        markers.push(m);
      }
    });
  }

  function renderMarkers(events) {
    clearMarkers();
    if (map.getZoom() <= 9) {
      // 줌 아웃 : 광역 지리 클러스터링
      _renderGeoClusters(events);
    } else {
      // 일반 줌 : 동일 위치 그룹화 후 렌더링
      groupByLocation(events).forEach(_renderLocationGroup);
    }
  }

  function getBounds() { return map ? map.getBounds() : null; }
  function panTo(lat, lng) { if (map) map.panTo(new naver.maps.LatLng(lat, lng)); }

  return { init, renderMarkers, getBounds, panTo };
})();
