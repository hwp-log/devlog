'use client';

import { useEffect, useState } from 'react';

// 모듈 스코프 싱글턴 — StrictMode 이중 마운트·다중 소비자에도 스크립트 1회 주입
let scriptPromise: Promise<void> | null = null;

function loadNaverMaps(): Promise<void> {
  if (typeof window !== 'undefined' && window.naver?.maps) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    // 공식 인증 실패 훅 — 잘못된 ncpKeyId·도메인 미등록 시 SDK가 호출
    (window as unknown as { navermap_authFailure?: () => void }).navermap_authFailure = () => {
      reject(new Error('Naver Maps 인증 실패 (ncpKeyId/도메인 확인)'));
    };
    const s = document.createElement('script');
    // submodules=gl — customStyleId는 GL(벡터) 전용 (공식 문서)
    s.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID}&submodules=gl`;
    s.async = true;
    s.onload = () => {
      // onload 시점엔 gl 서브모듈이 아직 비동기 로딩 중일 수 있음 — 이때 지도를 만들면
      // 조용히 래스터로 강등된다 (실측). 서브모듈 완료 콜백(onJSContentLoaded)까지 대기.
      const m = window.naver?.maps as unknown as {
        jsContentLoaded?: boolean;
        onJSContentLoaded?: () => void;
      };
      if (m?.jsContentLoaded) resolve();
      else if (m) m.onJSContentLoaded = () => resolve();
      else reject(new Error('Naver Maps 네임스페이스 초기화 실패'));
    };
    s.onerror = () => {
      scriptPromise = null; // 일시 네트워크 실패 시 재시도 허용
      reject(new Error('Naver Maps 스크립트 로드 실패'));
    };
    document.head.appendChild(s);
  });
  return scriptPromise;
}

export function useNaverMapsLoader(): { ready: boolean; error: boolean } {
  const [state, setState] = useState({ ready: false, error: false });

  useEffect(() => {
    let cancelled = false;
    loadNaverMaps().then(
      () => { if (!cancelled) setState({ ready: true, error: false }); },
      () => { if (!cancelled) setState({ ready: false, error: true }); },
    );
    return () => { cancelled = true; };
  }, []);

  return state;
}
