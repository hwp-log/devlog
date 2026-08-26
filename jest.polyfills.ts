// jsdom이 제공하지 않는 Node 전역 폴리필. setupFiles 단계(테스트 파일 import 전)에 주입 —
// lib/prisma.ts → cuid2 → @noble/hashes가 import 시점에 TextEncoder를 요구하므로
// setupFilesAfterEnv(프레임워크 로드 후)로는 늦다.
import { TextEncoder, TextDecoder } from 'node:util';

globalThis.TextEncoder = TextEncoder;
globalThis.TextDecoder = TextDecoder as unknown as typeof globalThis.TextDecoder;
