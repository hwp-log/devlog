import { render, screen } from '@testing-library/react';
import DashboardPage from '../page';

const mockGetUser = jest.fn();

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() =>
    Promise.resolve({ auth: { getUser: mockGetUser } })
  ),
}));

jest.mock('../actions', () => ({
  signOutAction: jest.fn(),
}));

describe('DashboardPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render welcome message with user email', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: 'test-id', email: 'test@example.com' } },
      error: null,
    });
    render(await DashboardPage());
    expect(screen.getByText('환영합니다, test@example.com')).toBeInTheDocument();
  });

  it('should render LogoutButton', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: 'test-id', email: 'test@example.com' } },
      error: null,
    });
    const { container } = render(await DashboardPage());
    expect(screen.getByRole('button', { name: '로그아웃' })).toBeInTheDocument();
    expect(container.querySelector('form')).not.toBeNull();
  });
});
