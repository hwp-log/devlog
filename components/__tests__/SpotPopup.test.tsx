import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SpotPopup } from '../SpotPopup';
import type { LocalSpot } from '@/lib/types';
import { searchMoviesAction, submitMovie } from '@/app/movies/actions';

jest.mock('@/app/movies/actions', () => ({
  searchMoviesAction: jest.fn(),
  submitMovie: jest.fn(),
}));

const mockSearchMovies = searchMoviesAction as jest.Mock;
const mockSubmitMovie = submitMovie as jest.Mock;

// jsdom에 createObjectURL 없음 — 특성화를 위해 모킹
let objectUrlCount = 0;
beforeAll(() => {
  URL.createObjectURL = jest.fn(() => `blob:mock-${++objectUrlCount}`);
  URL.revokeObjectURL = jest.fn();
});

beforeEach(() => {
  jest.clearAllMocks();
});

const baseSpot: LocalSpot = {
  id: 'spot_1',
  name: '광화문',
  lat: 37.5665,
  lng: 126.978,
  order: 1,
  review: '멋진 곳',
  photoUrl: null,
  address: '서울 종로구',
  movieId: null,
  movieTitle: null,
};

function makeFile(name = 'photo.png', type = 'image/png', size = 1024): File {
  const file = new File(['x'], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

function getFileInput(container: HTMLElement): HTMLInputElement {
  const input = container.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) throw new Error('file input not found');
  return input;
}

function enterEditMode() {
  fireEvent.click(screen.getByRole('button', { name: '수정' }));
}

describe('SpotPopup — 보기 모드', () => {
  it('should render name, review and address in view mode', () => {
    render(<SpotPopup spot={baseSpot} />);
    expect(screen.getByRole('heading', { name: '광화문' })).toBeInTheDocument();
    expect(screen.getByText('멋진 곳')).toBeInTheDocument();
    expect(screen.getByText('서울 종로구')).toBeInTheDocument();
  });

  it('should prefill inputs with current display values when entering edit mode', () => {
    render(<SpotPopup spot={baseSpot} />);
    enterEditMode();
    expect(screen.getByDisplayValue('광화문')).toBeInTheDocument();
    expect(screen.getByDisplayValue('멋진 곳')).toBeInTheDocument();
  });
});

describe('SpotPopup — 저장', () => {
  it('should call onUpdate with edited values and return to view mode showing them', async () => {
    const onUpdate = jest.fn();
    const { rerender } = render(<SpotPopup spot={baseSpot} onUpdate={onUpdate} />);
    enterEditMode();

    fireEvent.change(screen.getByDisplayValue('광화문'), { target: { value: '경복궁' } });
    fireEvent.change(screen.getByDisplayValue('멋진 곳'), { target: { value: '고궁 산책' } });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));

    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalledWith({
        name: '경복궁',
        review: '고궁 산책',
        movieId: null,
        movieTitle: null,
      });
    });

    // 부모가 onUpdate로 spot props를 갱신하는 동작 시뮬레이션 (SpotMap.handleSpotUpdate)
    rerender(
      <SpotPopup spot={{ ...baseSpot, name: '경복궁', review: '고궁 산책' }} onUpdate={onUpdate} />
    );
    expect(screen.getByRole('heading', { name: '경복궁' })).toBeInTheDocument();
    expect(screen.getByText('고궁 산책')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '저장' })).not.toBeInTheDocument();
  });

  it('should disable save button when name is empty', () => {
    render(<SpotPopup spot={baseSpot} />);
    enterEditMode();
    fireEvent.change(screen.getByDisplayValue('광화문'), { target: { value: '   ' } });
    expect(screen.getByRole('button', { name: '저장' })).toBeDisabled();
  });
});

describe('SpotPopup — 취소', () => {
  it('should restore original values and not call onUpdate on cancel', () => {
    const onUpdate = jest.fn();
    render(<SpotPopup spot={baseSpot} onUpdate={onUpdate} />);
    enterEditMode();

    fireEvent.change(screen.getByDisplayValue('광화문'), { target: { value: '경복궁' } });
    fireEvent.click(screen.getByRole('button', { name: '취소' }));

    expect(onUpdate).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: '광화문' })).toBeInTheDocument();
  });

  it('should call onDelete and onClose when canceling a new spot with empty name', () => {
    const onDelete = jest.fn();
    const onClose = jest.fn();
    render(
      <SpotPopup
        spot={{ ...baseSpot, id: 'tmp_1', name: '', review: null }}
        initialEditing
        onDelete={onDelete}
        onClose={onClose}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: '취소' }));
    expect(onDelete).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});

describe('SpotPopup — 사진 검증', () => {
  it('should show size error and keep previous preview when file exceeds 5MB', () => {
    const { container } = render(<SpotPopup spot={baseSpot} />);
    enterEditMode();

    fireEvent.change(getFileInput(container), {
      target: { files: [makeFile('big.png', 'image/png', 6 * 1024 * 1024)] },
    });
    expect(screen.getByText('5MB 이하만 가능합니다')).toBeInTheDocument();
    // 프리뷰 이미지 미생성 (기존 상태 유지)
    expect(container.querySelector('img')).not.toBeInTheDocument();
  });

  it('should show type error when file type is not allowed', () => {
    const { container } = render(<SpotPopup spot={baseSpot} />);
    enterEditMode();

    fireEvent.change(getFileInput(container), {
      target: { files: [makeFile('anim.gif', 'image/gif')] },
    });
    expect(screen.getByText('jpeg, png, webp만 허용됩니다')).toBeInTheDocument();
  });
});

describe('SpotPopup — 사진 저장', () => {
  it('should call onFileSelect with file and include preview url in onUpdate', async () => {
    const onUpdate = jest.fn();
    const onFileSelect = jest.fn();
    const { container } = render(
      <SpotPopup spot={baseSpot} onUpdate={onUpdate} onFileSelect={onFileSelect} />
    );
    enterEditMode();

    const file = makeFile();
    fireEvent.change(getFileInput(container), { target: { files: [file] } });
    // 프리뷰 표시 확인
    expect(container.querySelector('img')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => {
      expect(onFileSelect).toHaveBeenCalledWith(file);
      expect(onUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ photoUrl: expect.stringMatching(/^blob:mock-/) })
      );
    });
  });

  it('should call onFileSelect(null) and onUpdate with null photoUrl when clearing photo on temp spot', async () => {
    const onUpdate = jest.fn();
    const onFileSelect = jest.fn();
    render(
      <SpotPopup
        spot={{ ...baseSpot, id: 'tmp_1', photoUrl: 'https://img.example/1.png' }}
        onUpdate={onUpdate}
        onFileSelect={onFileSelect}
      />
    );
    enterEditMode();

    fireEvent.click(screen.getByRole('button', { name: '비우기' }));
    fireEvent.click(screen.getByRole('button', { name: '저장' }));

    await waitFor(() => {
      expect(onFileSelect).toHaveBeenCalledWith(null);
      expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ photoUrl: null }));
    });
  });

  it('should defer photo clearing on persisted spot — no server action, only intent to parent', async () => {
    // 지연 반영 스펙: 영속 스팟도 임시 스팟과 동일하게 부모 전달만.
    // 상단 "수정" 제출 전까지 DB 불변 — 팝업 저장은 어떤 서버 액션도 호출하지 않는다.
    const onUpdate = jest.fn();
    const onFileSelect = jest.fn();
    render(
      <SpotPopup
        spot={{ ...baseSpot, photoUrl: 'https://img.example/1.png' }}
        onUpdate={onUpdate}
        onFileSelect={onFileSelect}
      />
    );
    enterEditMode();

    fireEvent.click(screen.getByRole('button', { name: '비우기' }));
    fireEvent.click(screen.getByRole('button', { name: '저장' }));

    await waitFor(() => {
      expect(onFileSelect).toHaveBeenCalledWith(null);
      expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ photoUrl: null }));
    });
    // 서버 액션 미호출 (팝업 저장 = 화면 임시 반영까지만)
    expect(mockSearchMovies).not.toHaveBeenCalled();
    expect(mockSubmitMovie).not.toHaveBeenCalled();
    // 보기 모드 복귀
    expect(screen.queryByRole('button', { name: '저장' })).not.toBeInTheDocument();
  });
});

describe('SpotPopup — 작품 검색', () => {
  it('should show suggestions after debounce and select one', async () => {
    mockSearchMovies.mockResolvedValue([{ id: 'm1', title: '도깨비', spotCount: 3 }]);
    render(<SpotPopup spot={baseSpot} />);
    enterEditMode();

    fireEvent.change(screen.getByPlaceholderText('작품명 검색...'), {
      target: { value: '도깨' },
    });

    const suggestion = await screen.findByText('도깨비');
    expect(mockSearchMovies).toHaveBeenCalledWith('도깨');

    fireEvent.mouseDown(suggestion);
    // 선택 후: 제목 표시 + 검색 입력 사라짐
    expect(screen.getByText('도깨비')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('작품명 검색...')).not.toBeInTheDocument();
  });

  it('should clear selected movie and show search input again', async () => {
    render(
      <SpotPopup spot={{ ...baseSpot, movieId: 'm1', movieTitle: '도깨비' }} />
    );
    enterEditMode();

    // 선택된 작품 옆 X 버튼 (제목 컨테이너 내부의 버튼)
    const title = screen.getByText('도깨비');
    const clearButton = title.parentElement!.querySelector('button')!;
    fireEvent.click(clearButton);

    expect(screen.getByPlaceholderText('작품명 검색...')).toBeInTheDocument();
    expect(screen.queryByText('도깨비')).not.toBeInTheDocument();
  });

  it('should submit new movie and select it when clicking 새 작품으로 등록', async () => {
    mockSearchMovies.mockResolvedValue([]);
    mockSubmitMovie.mockResolvedValue({ movie: { id: 'm2', title: '신작 드라마' } });
    render(<SpotPopup spot={baseSpot} />);
    enterEditMode();

    fireEvent.change(screen.getByPlaceholderText('작품명 검색...'), {
      target: { value: '신작 드라마' },
    });

    const registerItem = await screen.findByText(/새 작품으로 등록/);
    fireEvent.mouseDown(registerItem);

    await waitFor(() => {
      expect(mockSubmitMovie).toHaveBeenCalledWith('신작 드라마');
      expect(screen.getByText('신작 드라마')).toBeInTheDocument();
    });
    expect(screen.queryByPlaceholderText('작품명 검색...')).not.toBeInTheDocument();
  });
});
