'use client';

import { useState, useCallback } from 'react';
import { useHistoryBack } from '@/hooks/useHistoryBack';
import EduHome from './EduHome';
import DocumentViewer from './DocumentViewer';
import QuizSystem from './QuizSystem';

type EduView = 'home' | 'study' | 'quiz';

interface EduTabProps {
  onBack: () => void;
}

export default function EduTab({ onBack }: EduTabProps) {
  const [view, setView] = useState<EduView>('home');

  const goHome = useCallback(() => setView('home'), []);

  // study/quiz 진입 시 히스토리 push → 뒤로가기로 edu home 복귀
  useHistoryBack(`edu-${view}`, goHome, view !== 'home');

  switch (view) {
    case 'study':
      return <DocumentViewer onBack={goHome} />;
    case 'quiz':
      return <QuizSystem onBack={goHome} />;
    default:
      return (
        <EduHome
          onBack={onBack}
          onStudy={() => setView('study')}
          onQuiz={() => setView('quiz')}
        />
      );
  }
}
