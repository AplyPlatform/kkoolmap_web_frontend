// API 서버 기본 URL
// - 같은 도메인(현재 서버)에 API가 있으면 빈 문자열('')로 유지
// - API를 다른 서버로 이전할 경우 아래 값을 변경 (끝에 '/' 포함)
//   예) 'https://api.example.com/'
const API_BASE = 'https://m.aq.gy/kkool/';

// 'YYYY-MM-DD HH:MM:SS' → 'YYYY-MM-DD HH:MM'
function fmtDt(dt) {
  if (!dt) return '';
  return String(dt).replace('T', ' ').substring(0, 16);
}
// datetime → 날짜 부분 ('YYYY-MM-DD')
function dtDate(dt) { return dt ? String(dt).substring(0, 10) : ''; }
// datetime → 시간 부분 ('HH:MM')
function dtTime(dt) {
  if (!dt) return '00:00';
  const s = String(dt);
  const i = s.indexOf('T') !== -1 ? s.indexOf('T') : s.indexOf(' ');
  return i !== -1 ? s.substring(i + 1, i + 6) : '00:00';
}
