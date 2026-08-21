import { redirect } from 'next/navigation';

// 랜딩 폐기(0608): 인증 여부 무관 공개 목록으로 직행. 옛 랜딩은 git 히스토리(93454dd~)에.
export default function Home() {
  redirect('/story');
}
