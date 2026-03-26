'use client';

import { useState, useCallback } from 'react';
import { useHistoryBack } from '@/hooks/useHistoryBack';
import EduHome from './EduHome';
import DocumentViewer from './DocumentViewer';
import QuizSystem from './QuizSystem';
import WrongReview from './WrongReview';
import MyInfo from './MyInfo';

type EduView =
  | { type: 'home' }
  | { type: 'study'; initSection?: string; initChapter?: string }
  | { type: 'quiz'; chapter?: string }
  | { type: 'wrong-quiz' }
  | { type: 'wrong-review' }
  | { type: 'myinfo' };

interface EduTabProps {
  onBack: () => void;
}

export default function EduTab({ onBack }: EduTabProps) {
  const [view, setView] = useState<EduView>({ type: 'home' });

  const goHome = useCallback(() => setView({ type: 'home' }), []);

  useHistoryBack(`edu-${view.type}`, goHome, view.type !== 'home');

  switch (view.type) {
    case 'study':
      return (
        <DocumentViewer
          onBack={goHome}
          initSection={view.initSection}
          initChapter={view.initChapter}
        />
      );
    case 'quiz':
      return <QuizSystem onBack={goHome} initChapter={view.chapter} />;
    case 'wrong-quiz':
      return <QuizSystem onBack={goHome} wrongOnly />;
    case 'wrong-review':
      return (
        <WrongReview
          onBack={goHome}
          onSection={(id) => setView({ type: 'study', initSection: id })}
        />
      );
    case 'myinfo':
      return (
        <MyInfo
          onBack={goHome}
          onWrongReview={() => setView({ type: 'wrong-review' })}
        />
      );
    default:
      return (
        <EduHome
          onBack={onBack}
          onStudy={() => setView({ type: 'study' })}
          onQuiz={() => setView({ type: 'quiz' })}
          onSection={(id) => setView({ type: 'study', initSection: id })}
          onChapter={(id) => setView({ type: 'study', initChapter: id })}
          onWrongReview={() => setView({ type: 'wrong-review' })}
          onWrongQuiz={() => setView({ type: 'wrong-quiz' })}
          onMyInfo={() => setView({ type: 'myinfo' })}
        />
      );
  }
}
