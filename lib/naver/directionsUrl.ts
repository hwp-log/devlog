'use client';

// 네이버 지도 길찾기 딥링크 조립 — NCP 공식 "지도 앱 연동 URL Scheme" 준거.
// 도착지만 지정(출발지는 앱/웹의 현재 위치 흐름), 이동수단 기본 public(대중교통 — 판단값).
// 웹 길찾기 URL은 공식 문서 부재 — 실서비스 형식(map.naver.com/p/directions) 실측 확증분.

export type DirectionsTarget = { name: string; lat: number; lng: number };

export function buildNaverDirectionsUrls(t: DirectionsTarget) {
  const dname = encodeURIComponent(t.name);
  // appname = 호출 서비스 식별 (문서 필수 파라미터) — 웹 서비스이므로 현재 origin (판단값)
  const appname = encodeURIComponent(window.location.origin);
  const query = `dlat=${t.lat}&dlng=${t.lng}&dname=${dname}&appname=${appname}`;
  return {
    scheme: `nmap://route/public?${query}`,
    // Android: intent 래핑 — 미설치 시 인텐트 시스템이 마켓 폴백 (문서 명시 형식 그대로)
    androidIntent: `intent://route/public?${query}#Intent;scheme=nmap;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;package=com.nhn.android.nmap;end`,
    web: `https://map.naver.com/p/directions/-/${t.lng},${t.lat},${dname}/-/transit`,
    iosStore: 'http://itunes.apple.com/app/id311867728?mt=8', // 문서 예시값 (네이버 지도 App Store)
  };
}

// 플랫폼 분기: Android → intent(폴백 내장) / iOS → 스킴 시도 후 2초 내 전환 실패 시
// App Store 유도(문서 관례 그대로) / 그 외(데탑) → 웹 길찾기 새 탭
export function openNaverDirections(t: DirectionsTarget) {
  const urls = buildNaverDirectionsUrls(t);
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) {
    window.location.href = urls.androidIntent;
    return;
  }
  if (/iphone|ipad|ipod/i.test(ua)) {
    const clickedAt = Date.now();
    window.location.href = urls.scheme;
    setTimeout(() => {
      if (Date.now() - clickedAt < 2000) window.location.href = urls.iosStore;
    }, 1500);
    return;
  }
  window.open(urls.web, '_blank', 'noopener');
}
