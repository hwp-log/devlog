'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// 0276: 로더 종결 장치 — 로드 메커니즘(script 주입·onJSContentLoaded 대기·싱글턴)은
// 유지하고, 소비자가 분기할 수 있게 상태 계층만 신설. status/slow/retry 반환.
export type NaverLoaderStatus = 'loading' | 'ready' | 'error' | 'authError';

// 실패 종류 구분 — authFailure(설정 문제, 재시도 무의미) vs onerror(네트워크, 재시도 가능)
type LoadErrorKind = 'auth' | 'network';
class NaverLoadError extends Error {
  kind: LoadErrorKind;
  constructor(message: string, kind: LoadErrorKind) {
    super(message);
    this.name = 'NaverLoadError';
    this.kind = kind;
  }
}

// 로딩이 이 시간(ms)을 넘겨도 loading이면 slow=true (정보 표시 전용 — status 불변, 죽이지 않음).
// gl 서브모듈 지연은 실측 5~30초라 "느린 성공"이 정상 범주 (0276 배경 조사).
const SLOW_MS = 15000;

// 모듈 스코프 싱글턴 — StrictMode 이중 마운트·다중 소비자에도 스크립트 1회 주입
let scriptPromise: Promise<void> | null = null;

function loadNaverMaps(): Promise<void> {
  if (typeof window !== 'undefined' && window.naver?.maps) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    // 공식 인증 실패 훅 — 잘못된 ncpKeyId·도메인 미등록 시 SDK가 호출
    (window as unknown as { navermap_authFailure?: () => void }).navermap_authFailure = () => {
      reject(new NaverLoadError('Naver Maps 인증 실패 (ncpKeyId/도메인 확인)', 'auth'));
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
      else reject(new NaverLoadError('Naver Maps 네임스페이스 초기화 실패', 'network'));
    };
    s.onerror = () => {
      scriptPromise = null; // 일시 네트워크 실패 시 재시도 허용
      reject(new NaverLoadError('Naver Maps 스크립트 로드 실패', 'network'));
    };
    document.head.appendChild(s);
  });
  return scriptPromise;
}

export function useNaverMapsLoader(): {
  status: NaverLoaderStatus;
  slow: boolean;
  retry: () => void;
} {
  const [status, setStatus] = useState<NaverLoaderStatus>('loading');
  const [slow, setSlow] = useState(false);
  // 시도 토큰 — 언마운트·재시도 경합에서 stale resolve/reject 무시 (기존 cancelled 플래그 역할 승계)
  const attemptRef = useRef(0);

  // 비동기 로드 시동 — setState는 전부 타이머·프로미스 콜백(async) 안에서만 발생.
  // (effect 본문 동기 setState 회피 — react-hooks/set-state-in-effect. loading/slow 리셋은 retry 핸들러가 담당)
  const load = useCallback((attempt: number) => {
    const slowTimer = setTimeout(() => {
      // 여전히 이 시도의 loading일 때만 slow 표시 (status는 건드리지 않음)
      if (attemptRef.current === attempt) setSlow(true);
    }, SLOW_MS);
    loadNaverMaps().then(
      () => {
        if (attemptRef.current !== attempt) return;
        clearTimeout(slowTimer);
        setStatus('ready');
      },
      (e: unknown) => {
        if (attemptRef.current !== attempt) return;
        clearTimeout(slowTimer);
        setStatus(e instanceof NaverLoadError && e.kind === 'auth' ? 'authError' : 'error');
      },
    );
    return slowTimer;
  }, []);

  useEffect(() => {
    const attempt = attemptRef.current; // 마운트 시 현재 시도(초기 상태 loading·slow=false 그대로 사용)
    const slowTimer = load(attempt);
    return () => {
      clearTimeout(slowTimer);
      // eslint-disable-next-line react-hooks/exhaustive-deps -- 진행 중 시도 무효화가 목적(값 변경이 의도)
      attemptRef.current++;
    };
  }, [load]);

  // 수동 재시도 — 이벤트 핸들러라 동기 setState 허용. onerror가 scriptPromise를 null화했으므로 새 로드.
  // 자동/무한 재시도 없음. (authError는 설정 문제라 소비자가 재시도 버튼을 노출하지 않음 — 여기서 막지는 않음)
  const retry = useCallback(() => {
    const attempt = ++attemptRef.current;
    setStatus('loading');
    setSlow(false);
    load(attempt);
  }, [load]);

  return { status, slow, retry };
}
