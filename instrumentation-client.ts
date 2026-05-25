// Mapbox Standard 스타일 v3 메쉬 버그 콘솔 노이즈 차단.
// Next.js intercept-console-error보다 먼저 박혀 필터링 우선순위 박음.

const originalError = console.error;
console.error = function (...args: unknown[]) {
  const firstArg = args[0];
  const message =
    firstArg instanceof Error
      ? firstArg.message
      : typeof firstArg === 'string'
      ? firstArg
      : '';

  if (message.includes('meshes is not iterable')) {
    return;
  }

  originalError.apply(console, args);
};

export {};
