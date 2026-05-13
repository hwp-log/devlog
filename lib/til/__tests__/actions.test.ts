import { createTilEntry, getTilEntries, getTilStreak, getTilEntry, updateTilEntry, deleteTilEntry } from '../actions';

const mockSingle      = jest.fn();
const mockSelect      = jest.fn(() => ({ single: mockSingle }));
const mockInsert      = jest.fn(() => ({ select: mockSelect }));
const mockOrder       = jest.fn();
const mockEq2         = jest.fn(() => ({ single: mockSingle }));
const mockEq          = jest.fn(() => ({ order: mockOrder, eq: mockEq2 }));
const mockFromSelect  = jest.fn(() => ({ eq: mockEq }));
const mockUpdateSingle = jest.fn();
const mockUpdateSelect = jest.fn(() => ({ single: mockUpdateSingle }));
const mockUpdateEq2   = jest.fn(() => ({ select: mockUpdateSelect }));
const mockUpdateEq1   = jest.fn(() => ({ eq: mockUpdateEq2 }));
const mockUpdate      = jest.fn(() => ({ eq: mockUpdateEq1 }));
const mockDeleteEq2   = jest.fn();
const mockDeleteEq1   = jest.fn(() => ({ eq: mockDeleteEq2 }));
const mockDelete      = jest.fn(() => ({ eq: mockDeleteEq1 }));
const mockFrom        = jest.fn(() => ({
  insert: mockInsert,
  select: mockFromSelect,
  update: mockUpdate,
  delete: mockDelete,
}));
const mockGetUser     = jest.fn();
const mockRpc         = jest.fn();
jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

const mockRevalidatePath = jest.requireMock('next/cache').revalidatePath;

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() =>
    Promise.resolve({
      auth: { getUser: mockGetUser },
      from: mockFrom,
      rpc: mockRpc,
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

describe('getTilStreak', () => {
  // Cycle 1 — 정상 조회
  it('should return currentStreak and bestStreak', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'user-123' } } });
    mockRpc.mockResolvedValueOnce({ data: [{ current_streak: 3, best_streak: 7 }], error: null });

    const result = await getTilStreak();

    expect(mockRpc).toHaveBeenCalledWith('get_til_streak');
    expect(result).toEqual({ data: { currentStreak: 3, bestStreak: 7 } });
  });

  // Cycle 2 — 인증 가드
  it('should return error when user is not authenticated', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });

    const result = await getTilStreak();

    expect(result).toEqual({ error: '로그인이 필요합니다' });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  // Cycle 1.5 — DB 에러
  it('should return friendly error when RPC fails', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'user-123' } } });
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'DB error' } });

    const result = await getTilStreak();

    expect(result).toEqual({ error: '통계를 불러오지 못했습니다' });
  });
});

describe('getTilEntry', () => {
  // Cycle 1 — 정상 조회
  it('should return entry data on successful fetch', async () => {
    const mockUser = { id: 'user-123' };
    const mockEntry = {
      id: 'entry-uuid-1',
      user_id: 'user-123',
      title: 'Learned TDD today',
      content: 'Red Green Refactor cycle is powerful',
      created_at: '2026-05-11T00:00:00Z',
    };

    mockGetUser.mockResolvedValueOnce({ data: { user: mockUser } });
    mockSingle.mockResolvedValueOnce({ data: mockEntry, error: null });

    const result = await getTilEntry('entry-uuid-1');

    expect(mockEq).toHaveBeenCalledWith('id', 'entry-uuid-1');
    expect(mockEq2).toHaveBeenCalledWith('user_id', 'user-123');
    expect(result).toEqual({ data: { entry: mockEntry } });
  });

  // Cycle 2 — 인증 가드
  it('should return error when user is not authenticated', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });

    const result = await getTilEntry('entry-uuid-1');

    expect(result).toEqual({ error: '로그인이 필요합니다' });
    expect(mockFromSelect).not.toHaveBeenCalled();
  });

  // Cycle 1.5 — not found (data null, 타인 항목 포함)
  it('should return error when entry is not found', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'user-123' } } });
    mockSingle.mockResolvedValueOnce({ data: null, error: null });

    const result = await getTilEntry('other-uuid');

    expect(result).toEqual({ error: '찾을 수 없습니다.' });
  });

  // Cycle 1.5 — DB 에러
  it('should return friendly error when DB query fails', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'user-123' } } });
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'DB error' } });

    const result = await getTilEntry('entry-uuid-1');

    expect(result).toEqual({ error: '찾을 수 없습니다.' });
  });
});

describe('updateTilEntry', () => {
  // Cycle 3 — 입력 검증
  it('should return error when title is empty', async () => {
    const result = await updateTilEntry('entry-uuid-1', '', 'Some content');

    expect(result).toEqual({ error: '제목을 입력해주세요' });
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  it('should return error when content is empty', async () => {
    const result = await updateTilEntry('entry-uuid-1', 'Some title', '');

    expect(result).toEqual({ error: '내용을 입력해주세요' });
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  // Cycle 2 — 인증 가드
  it('should return error when user is not authenticated', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });

    const result = await updateTilEntry('entry-uuid-1', 'Some title', 'Some content');

    expect(result).toEqual({ error: '로그인이 필요합니다' });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  // Cycle 1 — 정상 업데이트
  it('should update entry and revalidate paths', async () => {
    const mockUser = { id: 'user-123' };
    const mockEntry = {
      id: 'entry-uuid-1',
      user_id: 'user-123',
      title: 'Updated title',
      content: 'Updated content',
      created_at: '2026-05-11T00:00:00Z',
    };

    mockGetUser.mockResolvedValueOnce({ data: { user: mockUser } });
    mockUpdateSingle.mockResolvedValueOnce({ data: mockEntry, error: null });

    const result = await updateTilEntry('entry-uuid-1', 'Updated title', 'Updated content');

    expect(mockUpdate).toHaveBeenCalledWith({ title: 'Updated title', content: 'Updated content' });
    expect(mockUpdateEq1).toHaveBeenCalledWith('id', 'entry-uuid-1');
    expect(mockUpdateEq2).toHaveBeenCalledWith('user_id', 'user-123');
    expect(mockRevalidatePath).toHaveBeenCalledWith('/til');
    expect(mockRevalidatePath).toHaveBeenCalledWith('/til/entry-uuid-1');
    expect(result).toEqual({ data: { entry: mockEntry } });
  });

  // Cycle 1.5 — DB 에러
  it('should return friendly error when DB update fails', async () => {
    const mockUser = { id: 'user-123' };

    mockGetUser.mockResolvedValueOnce({ data: { user: mockUser } });
    mockUpdateSingle.mockResolvedValueOnce({ data: null, error: { message: 'DB error' } });

    const result = await updateTilEntry('entry-uuid-1', 'Some title', 'Some content');

    expect(result).toEqual({ error: 'TIL 수정에 실패했습니다' });
  });
});

describe('deleteTilEntry', () => {
  // Cycle 2 — 인증 가드
  it('should return error when user is not authenticated', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });

    const result = await deleteTilEntry('entry-uuid-1');

    expect(result).toEqual({ error: '로그인이 필요합니다' });
    expect(mockDelete).not.toHaveBeenCalled();
  });

  // Cycle 1 — 정상 삭제
  it('should delete entry and revalidate path', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'user-123' } } });
    mockDeleteEq2.mockResolvedValueOnce({ data: null, error: null });

    const result = await deleteTilEntry('entry-uuid-1');

    expect(mockDeleteEq1).toHaveBeenCalledWith('id', 'entry-uuid-1');
    expect(mockDeleteEq2).toHaveBeenCalledWith('user_id', 'user-123');
    expect(mockRevalidatePath).toHaveBeenCalledWith('/til');
    expect(result).toEqual({ data: null });
  });

  // Cycle 1.5 — DB 에러
  it('should return friendly error when DB delete fails', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'user-123' } } });
    mockDeleteEq2.mockResolvedValueOnce({ data: null, error: { message: 'DB error' } });

    const result = await deleteTilEntry('entry-uuid-1');

    expect(result).toEqual({ error: 'TIL 삭제에 실패했습니다' });
  });
});
