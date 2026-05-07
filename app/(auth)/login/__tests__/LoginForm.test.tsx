import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LoginForm } from '../LoginForm';

describe('LoginForm', () => {
  it('should not show error message initially', () => {
    const mockAction = jest.fn();
    render(<LoginForm action={mockAction} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('should show error message when action returns error', async () => {
    const mockAction = jest.fn().mockResolvedValue({ error: '이메일 형식이 올바르지 않습니다' });
    render(<LoginForm action={mockAction} />);
    fireEvent.click(screen.getByRole('button', { name: '로그인' }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('이메일 형식이 올바르지 않습니다');
    });
  });
});
