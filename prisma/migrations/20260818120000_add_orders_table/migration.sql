-- 0600: 담기 결제 주문 기록.
--   결제는 요청 → 인증 → 검증 → 승인 순이고, **검증을 하려면 결제 요청 전에 주문이
--   먼저 저장돼 있어야 한다.** successUrl로 돌아온 amount를 여기 저장된 amount와
--   대조해 금액 조작을 잡기 때문이다. 요청 전 기록이 없으면 대조할 기준값이 없다.

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'PAID', 'FAILED');

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    -- 우리가 만드는 주문번호. UNIQUE = 같은 주문의 이중 승인을 막는 유일한 장치.
    "order_id" TEXT NOT NULL,
    -- NULL 허용 + ON DELETE SET NULL. **이 저장소 관례(사용자 소유 테이블은 CASCADE)와
    -- 의도적으로 다르다.** 돈이 오간 사실은 탈퇴해도 남아야 한다(분쟁·정산·세무 근거).
    -- 탈퇴 흐름이 콘텐츠를 익명화해 남기는 것과 같은 결이고, 글은 남기면서 결제 기록만
    -- 지우는 건 앞뒤가 맞지 않는다. SET NULL이면 "누가 샀는지"만 지워지고
    -- "언제 얼마짜리 주문이 있었다"는 남는다.
    "user_id" UUID,
    -- 어떤 공개 플랜을 담으려는 주문인가. my_plans FK를 걸지 않는다 —
    -- 원본 플랜이 삭제돼도 결제 기록은 남아야 한다(my_plans.source_plan_id와 같은 선례).
    "source_plan_id" TEXT NOT NULL,
    -- 요청 시점에 **서버가** 정한 금액. 승인 직전 클라이언트가 돌려준 amount와 대조한다.
    "amount" INTEGER NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    -- 토스가 주는 값. 승인 후에 채워진다.
    "payment_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- 승인 시각. 승인 전에는 NULL.
    "approved_at" TIMESTAMP(3),

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "orders_order_id_key" ON "orders"("order_id");

-- CreateIndex
CREATE INDEX "orders_user_id_idx" ON "orders"("user_id");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RLS: 켜기만 하고 **정책은 만들지 않는다**.
--   빈 정책 = 깜빡한 것이 아니라 **의도된 전면 차단**이다.
--   주문·결제는 서버만 다루는 데이터이고, 클라이언트가 직접 읽을 경로가 필요했던 적이 없다.
--   서버는 Prisma(DIRECT_URL, 테이블 소유자)로 접근하므로 RLS의 영향을 받지 않는다.
--   나중에 "내 주문내역"을 클라이언트에서 직접 읽어야 해지면 그때 select 정책을 붙인다.
ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;
