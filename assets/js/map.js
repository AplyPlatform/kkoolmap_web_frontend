// web/assets/js/map.js
const MapManager = (() => {
  let map           = null;
  let markers       = [];
  let debounceTimer = null;
  let onMarkerClick = null;

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

  function markerIcon(event) {
    const color   = event.is_expired ? '#9ca3af' : (CATEGORY_COLORS[event.category_id] || '#f59e0b');
    const opacity = event.is_expired ? 0.55 : 1;
    const catName = (event.category_custom || event.category_name || '').slice(0, 6);
    const rate    = (event.sale_items && event.sale_items.length > 0)
                      ? event.sale_items[0].discount_rate.slice(0, 8)
                      : '';
    return {
      content: `
<div style="position:relative;text-align:center;opacity:${opacity};filter:drop-shadow(0 2px 4px rgba(0,0,0,0.28));">
  <div style="background:${color};border-radius:8px;padding:4px 8px 5px;border:2px solid white;width:80px;box-sizing:border-box;line-height:1.25;">
    <div style="font-size:9px;color:rgba(255,255,255,0.88);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${catName}</div>
    <div style="font-size:13px;font-weight:700;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${rate}</div>
  </div>
  <div style="width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-top:8px solid ${color};margin:0 auto;"></div>
</div>`,
      size:   new naver.maps.Size(80, 54),
      anchor: new naver.maps.Point(40, 54),
    };
  }

  function clusterIcon(count) {
    const bg = count >= 100 ? '#ef4444' : count >= 10 ? '#f97316' : '#f59e0b';
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

  // 줌 레벨에 따른 그리드 크기(도) 반환
  // zoom 14 기준 ~0.002° ≈ 220m, 줌아웃 1단계마다 2배 증가
  function gridDegrees() {
    return 0.002 * Math.pow(2, Math.max(0, 14 - map.getZoom()));
  }

  // 위경도 그리드 기반 클러스터링 (축척 ~20km 이상인 줌 레벨에서만 동작)
  function groupEvents(events) {
    if (map.getZoom() > 9) {
      return events.map(function(e) { return [e]; });
    }
    const grid  = gridDegrees();
    const cells = {};
    events.forEach(function(event) {
      const key = Math.floor(event.lat / grid) + ',' + Math.floor(event.lng / grid);
      if (!cells[key]) cells[key] = [];
      cells[key].push(event);
    });
    return Object.values(cells);
  }

  function init(onClickCallback) {
    onMarkerClick = onClickCallback;
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

  function renderMarkers(events) {
    clearMarkers();

    const groups = groupEvents(events);

    groups.forEach(function(group) {
      var m;
      if (group.length === 1) {
        const ev = group[0];
        m = new naver.maps.Marker({
          position: new naver.maps.LatLng(ev.lat, ev.lng),
          map:  map,
          icon: markerIcon(ev),
          title: ev.store_name,
        });
        naver.maps.Event.addListener(m, 'click', function() {
          if (onMarkerClick) onMarkerClick(ev);
        });
      } else {
        const avgLat = group.reduce(function(s, e) { return s + parseFloat(e.lat); }, 0) / group.length;
        const avgLng = group.reduce(function(s, e) { return s + parseFloat(e.lng); }, 0) / group.length;
        m = new naver.maps.Marker({
          position: new naver.maps.LatLng(avgLat, avgLng),
          map:  map,
          icon: clusterIcon(group.length),
          title: group.length + '개 행사',
        });
      }
      markers.push(m);
    });
  }

  function getBounds() { return map ? map.getBounds() : null; }
  function panTo(lat, lng) { if (map) map.panTo(new naver.maps.LatLng(lat, lng)); }

  return { init, renderMarkers, getBounds, panTo };
})();
