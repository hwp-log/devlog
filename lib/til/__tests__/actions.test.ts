import { createTilEntry, getTilEntries } from '../actions';

const mockSingle      = jest.fn();
const mockSelect      = jest.fn(() => ({ single: mockSingle }));
const mockInsert      = jest.fn(() => ({ select: mockSelect }));
const mockOrder       = jest.fn();
const mockEq          = jest.fn(() => ({ order: mockOrder }));
const mockFromSelect  = jest.fn(() => ({ eq: mockEq }));
const mockFrom        = jest.fn(() => ({ insert: mockInsert, select: mockFromSelect }));
const mockGetUser     = jest.fn();

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() =>
    Promise.resolve({
      auth: { getUser: mockGetUser },
      from: mockFrom,
    })
  ),
}));

beforeEach(() => jest.clearAllMocks());

describe('createTilEntry', () => {
  it('should return entry data on successful insert', async () => {
    const mockUser = { id: 'user-123' };
    const mockEntry = {
      id: 'entry-uuid-1',
      user_id: 'user-123',
      title: 'Learned TDD today',
      content: 'Red Green Refactor cycle is powerful',
      created_at: '2026-05-11T00:00:00Z',
    };

    mockGetUser.mockResolvedValueOnce({ data: { user: mockUser }, error: null });
    mockSingle.mockResolvedValueOnce({ data: mockEntry, error: null });

    const result = await createTilEntry('Learned TDD today', 'Red Green Refactor cycle is powerful');

    expect(result).toEqual({ data: { entry: mockEntry } });
  });

  // Cycle 3 — 입력 검증
  it('should return error when title is empty', async () => {
    const result = await createTilEntry('', 'Some content');

    expect(result).toEqual({ error: '제목을 입력해주세요' });
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  it('should return error when content is empty', async () => {
    const result = await createTilEntry('Some title', '');

    expect(result).toEqual({ error: '내용을 입력해주세요' });
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  // Cycle 2 — 인증 가드
  it('should return error when user is not authenticated', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: null });

    const result = await createTilEntry('Some title', 'Some content');

    expect(result).toEqual({ error: '로그인이 필요합니다' });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  // Cycle 1.5 — DB 에러
  it('should return friendly error when DB insert fails', async () => {
    const mockUser = { id: 'user-123' };

    mockGetUser.mockResolvedValueOnce({ data: { user: mockUser }, error: null });
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'DB error' } });

    const result = await createTilEntry('Some title', 'Some content');

    expect(result).toEqual({ error: 'TIL 저장에 실패했습니다' });
  });
});

describe('getTilEntries', () => {
  // Cycle 1 — 본인 글만 조회
  it('should return entries for authenticated user', async () => {
    const mockUser = { id: 'user-123' };
    const mockEntries = [
      { id: 'e1', user_id: 'user-123', title: 'T1', content: 'C1', created_at: '2026-05-12T00:00:00Z' },
      { id: 'e2', user_id: 'user-123', title: 'T2', content: 'C2', created_at: '2026-05-11T00:00:00Z' },
    ];

    mockGetUser.mockResolvedValueOnce({ data: { user: mockUser } });
    mockOrder.mockResolvedValueOnce({ data: mockEntries, error: null });

    const result = await getTilEntries();

    expect(mockEq).toHaveBeenCalledWith('user_id', 'user-123');
    expect(mockOrder).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(result).toEqual({ data: { entries: mockEntries } });
  });

  // Cycle 2 — 인증 가드
  it('should return error when user is not authenticated', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });

    const result = await getTilEntries();

    expect(result).toEqual({ error: '로그인이 필요합니다' });
    expect(mockFromSelect).not.toHaveBeenCalled();
  });

  // Cycle 1.5 — DB 에러
  it('should return friendly error when DB query fails', async () => {
    const mockUser = { id: 'user-123' };

    mockGetUser.mockResolvedValueOnce({ data: { user: mockUser } });
    mockOrder.mockResolvedValueOnce({ data: null, error: { message: 'DB error' } });

    const result = await getTilEntries();

    expect(result).toEqual({ error: 'TIL 조회에 실패했습니다' });
  });
});
