jest.mock('server-only', () => ({}));

import { summarizePlanCost } from '../summarize-plan-cost';

describe('summarizePlanCost', () => {
  describe('비중 합 = 100 (잔차 발생 입력)', () => {
    it('동일 금액 3항목: LRM으로 합이 정확히 100이 됨', () => {
      const result = summarizePlanCost(
        [
          { category: 'TRANSPORT', amount: 100 },
          { category: 'FOOD', amount: 100 },
          { category: 'ACCOMMODATION', amount: 100 },
        ],
        null,
        'KRW',
      );
      const sum = result.ratios.reduce((s, r) => s + r.ratio, 0);
      expect(sum).toBe(100);
    });
  });

  describe('0원 항목 제외', () => {
    it('FOOD 0원은 ratios에 포함되지 않음', () => {
      const result = summarizePlanCost(
        [
          { category: 'TRANSPORT', amount: 500 },
          { category: 'FOOD', amount: 0 },
        ],
        null,
        'KRW',
      );
      expect(result.ratios).toHaveLength(1);
      expect(result.ratios[0].category).toBe('TRANSPORT');
      expect(result.ratios[0].ratio).toBe(100);
    });
  });

  // 0558: band(구간) 폐기 — '구간 경계'·band 단언 제거(승인된 기능 제거의 대응, 로직 회귀 아님)
  describe('total=0 조기 반환', () => {
    it('KRW: ratios 빈 배열, total 0', () => {
      const result = summarizePlanCost([], null, 'KRW');
      expect(result.ratios).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('USD: ratios 빈 배열, total 0', () => {
      const result = summarizePlanCost([], null, 'USD');
      expect(result.ratios).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe('비-KRW — ratios 정상 계산', () => {
    it('USD: ratios 합=100, FOOD ratio=67', () => {
      const result = summarizePlanCost(
        [
          { category: 'TRANSPORT', amount: 100 },
          { category: 'FOOD', amount: 200 },
        ],
        null,
        'USD',
      );
      const sum = result.ratios.reduce((s, r) => s + r.ratio, 0);
      expect(sum).toBe(100);
      const food = result.ratios.find((r) => r.category === 'FOOD');
      expect(food?.ratio).toBe(67);
    });

    it('JPY: total 실값 유지', () => {
      const result = summarizePlanCost(
        [{ category: 'TRANSPORT', amount: 500 }],
        null,
        'JPY',
      );
      expect(result.total).toBe(500);
    });
  });

  describe('FLIGHT 항목 포함', () => {
    it('FLIGHT가 항공 라벨로 ratios에 포함되고 총액·비중에 반영됨', () => {
      const result = summarizePlanCost(
        [{ category: 'TRANSPORT', amount: 300_000 }],
        { totalAmount: 200_000 },
        'KRW',
      );
      expect(result.ratios).toHaveLength(2);
      const flight = result.ratios.find((r) => r.category === 'FLIGHT');
      expect(flight).toBeDefined();
      expect(flight?.label).toBe('항공');
      expect(flight?.ratio).toBe(40);
      const sum = result.ratios.reduce((s, r) => s + r.ratio, 0);
      expect(sum).toBe(100);
      expect(result.total).toBe(500_000);
    });
  });
});
