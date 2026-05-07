import { render, screen } from '@testing-library/react';
import { LogoutButton } from '../LogoutButton';

describe('LogoutButton', () => {
  it('should render logout button', () => {
    render(<LogoutButton action={jest.fn()} />);
    expect(screen.getByRole('button', { name: '로그아웃' })).toBeInTheDocument();
  });

  it('should wrap button in a form', () => {
    const { container } = render(<LogoutButton action={jest.fn()} />);
    expect(container.querySelector('form')).not.toBeNull();
  });
});
