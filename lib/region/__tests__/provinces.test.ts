import {
  regionKeyFromFreeText,
  regionKeyFromAddress,
  regionKeysFromLabel,
} from '../provinces';

describe('regionKeyFromFreeText — 자유 입력 첫 토큰 판정', () => {
  it.each([
    ['강원', '강원'],
    ['강원도 강릉', '강원'],
    ['강원특별자치도 춘천시', '강원'],
  ])('같은 시·도의 여러 표기가 한 키로 수렴: %s → %s', (input, expected) => {
    expect(regionKeyFromFreeText(input)).toBe(expected);
  });

  it.each([
    ['서울특별시 중구 세종대로', '서울'],
    ['세종시', '세종'],
    ['제주', '제주도'],
    ['제주시 애월읍', '제주도'],
    ['제주특별자치도 서귀포시', '제주도'],
  ])('약칭·정식명·구어 별칭 모두 매핑: %s → %s', (input, expected) => {
    expect(regionKeyFromFreeText(input)).toBe(expected);
  });

  it.each([
    ['전라북도 전주', '전북'],
    ['전북특별자치도', '전북'],
    ['전라남도 목포', '전남'],
  ])('남북이 섞이지 않음: %s → %s', (input, expected) => {
    expect(regionKeyFromFreeText(input)).toBe(expected);
  });

  it.each([['경주'], [''], ['  '], [null], [undefined]])(
    '판정 실패(시 단위·빈 입력)는 null: %s',
    (input) => {
      expect(regionKeyFromFreeText(input)).toBeNull();
    },
  );
});

describe('regionKeyFromAddress — 주소 시·도 접두 판정', () => {
  it.each([
    ['강원도 강릉시 경강로', '강원'],
    ['강원특별자치도 춘천시 중앙로', '강원'],
    ['강원 원주시', '강원'],
  ])('신·구 명칭 주소가 한 키로 수렴: %s → %s', (input, expected) => {
    expect(regionKeyFromAddress(input)).toBe(expected);
  });

  it.each([
    ['전라북도 전주시 완산구', '전북'],
    ['전북특별자치도 전주시', '전북'],
    ['전라남도 순천시 조례동', '전남'],
    ['경상북도 경주시', '경북'],
    ['경상남도 통영시', '경남'],
    ['충청북도 청주시', '충북'],
  ])('남북이 섞이지 않음: %s → %s', (input, expected) => {
    expect(regionKeyFromAddress(input)).toBe(expected);
  });

  it.each([['일본 도쿄'], [''], ['  '], [null], [undefined]])(
    '판정 실패는 null: %s',
    (input) => {
      expect(regionKeyFromAddress(input)).toBeNull();
    },
  );
});

describe('regionKeysFromLabel — 라벨에 포함된 시·도 집합 판정', () => {
  it('통합 명칭은 두 키를 모두 반환: 전남광주통합특별시 → 전남·광주', () => {
    expect(regionKeysFromLabel('전남광주통합특별시').sort()).toEqual(['광주', '전남']);
  });

  it('정식명이 포함되면 그것만: 경기도 광주시 → 경기', () => {
    expect(regionKeysFromLabel('경기도 광주시')).toEqual(['경기']);
  });

  it.each([
    ['전라북도 전주시', ['전북']],
    ['전라남도 목포시', ['전남']],
    ['강원특별자치도 평창군', ['강원']],
    ['강원도 정선군', ['강원']],
  ])('정식명 신·구 표기가 한 키로 수렴: %s → %j', (input, expected) => {
    expect(regionKeysFromLabel(input)).toEqual(expected);
  });

  it.each([['해외 촬영지'], [''], ['  '], [null], [undefined]])(
    '판정 실패는 빈 배열: %s',
    (input) => {
      expect(regionKeysFromLabel(input)).toEqual([]);
    },
  );
});
