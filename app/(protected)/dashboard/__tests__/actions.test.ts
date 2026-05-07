import { signOutAction } from '../actions';
import { redirect } from 'next/navigation';

const mockSignOut = jest.fn();

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() =>
    Promise.resolve({
      auth: { signOut: mockSignOut },
    })
  ),
}));

jest.mock('next/navigation', () => ({
  redirect: jest.fn(),
}));

describe('signOutAction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should call supabase signOut', async () => {
    mockSignOut.mockResolvedValueOnce({ error: null });
    await signOutAction();
    expect(mockSignOut).toHaveBeenCalled();
  });

  it('should redirect to /login after signOut', async () => {
    mockSignOut.mockResolvedValueOnce({ error: null });
    await signOutAction();
    expect(redirect).toHaveBeenCalledWith('/login');
  });
});
