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

  describe('구간 경계 (KRW)', () => {
    it.each([
      [150_000,     { lower: 100_000,   upper: 200_000   }],
      [500_000,     { lower: 500_000,   upper: 750_000   }],
      [1_000_000,   { lower: 1_000_000, upper: 1_500_000 }],
      [2_900_000,   { lower: 2_500_000, upper: 3_000_000 }],
    ])('total=%i → band %o', (amount, expectedBand) => {
      const result = summarizePlanCost(
        [{ category: 'TRANSPORT', amount }],
        null,
        'KRW',
      );
      expect(result.band).toEqual(expectedBand);
    });
  });

  describe('total=0 조기 반환', () => {
    it('KRW: ratios 빈 배열, band = {lower:0, upper:100_000}', () => {
      const result = summarizePlanCost([], null, 'KRW');
      expect(result.ratios).toEqual([]);
      expect(result.band).toEqual({ lower: 0, upper: 100_000 });
    });

    it('USD: ratios 빈 배열, band = null', () => {
      const result = summarizePlanCost([], null, 'USD');
      expect(result.ratios).toEqual([]);
      expect(result.band).toBeNull();
    });
  });

  describe('비-KRW — band null, ratios 정상 계산', () => {
    it('USD: band null, ratios 합=100, FOOD ratio=67', () => {
      const result = summarizePlanCost(
        [
          { category: 'TRANSPORT', amount: 100 },
          { category: 'FOOD', amount: 200 },
        ],
        null,
        'USD',
      );
      expect(result.band).toBeNull();
      const sum = result.ratios.reduce((s, r) => s + r.ratio, 0);
      expect(sum).toBe(100);
      const food = result.ratios.find((r) => r.category === 'FOOD');
      expect(food?.ratio).toBe(67);
    });

    it('JPY: band null', () => {
      const result = summarizePlanCost(
        [{ category: 'TRANSPORT', amount: 500 }],
        null,
        'JPY',
      );
      expect(result.band).toBeNull();
    });
  });

  describe('FLIGHT 항목 포함', () => {
    it('FLIGHT가 항공 라벨로 ratios에 포함되고 총액·비중·band에 반영됨', () => {
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
      expect(result.band).toEqual({ lower: 500_000, upper: 750_000 });
    });
  });
});
