-- 0564: 비용 카테고리 "주차비" 추가. 값 확장만 — 기존 행 무영향(백필 없음).
--   ALTER TYPE ... ADD VALUE는 트랜잭션 블록 안에서 실행할 수 없다. Prisma는 마이그레이션을
--   트랜잭션으로 감싸므로 migrate dev 경로로는 실패한다 → 수기 SQL + db execute +
--   migrate resolve --applied 경로로 반영했다(shadow DB 충돌 우회 관례와 동일).
ALTER TYPE "CostCategory" ADD VALUE 'PARKING';
