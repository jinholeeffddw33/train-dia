'use client';

import { useState, useCallback } from 'react';
import { useHistoryBack } from '@/hooks/useHistoryBack';
import EduHome from './EduHome';
import DocumentViewer from './DocumentViewer';
import QuizSystem from './QuizSystem';
import WrongReview from './WrongReview';
import MyInfo from './MyInfo';
import VideoEducation from './VideoEducation';
import TrainingList from './TrainingList';
import RescueProcedure from './RescueProcedure';
import RescueSimulation from './RescueSimulation';
import MrBurstSimulation from './MrBurstSimulation';
import NewcomerHome from './NewcomerHome';
import VideoGuideList from './VideoGuideList';

type EduView =
  | { type: 'home' }
  | { type: 'study'; initSection?: string; initChapter?: string; initChapters?: string[]; initTitle?: string; flatMode?: boolean }
  | { type: 'quiz'; chapter?: string }
  | { type: 'wrong-quiz' }
  | { type: 'wrong-review' }
  | { type: 'myinfo' }
  | { type: 'video' }
  | { type: 'training' }
  | { type: 'rescue-procedure' }
  | { type: 'rescue-simulation' }
  | { type: 'mr-burst' }
  | { type: 'newcomer' }
  | { type: 'newcomer-video' }
  | { type: 'newcomer-handbook' };

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
          initChapters={view.initChapters}
          initTitle={view.initTitle}
          flatMode={view.flatMode}
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
    case 'video':
      return <VideoEducation onBack={goHome} />;
    case 'training':
      return (
        <TrainingList
          onBack={goHome}
          onSlide={(ids, title) => setView({ type: 'study', initChapters: ids, initTitle: title })}
        />
      );
    case 'rescue-procedure':
      return <RescueProcedure onBack={goHome} />;
    case 'rescue-simulation':
      return <RescueSimulation onBack={goHome} />;
    case 'mr-burst':
      return <MrBurstSimulation onBack={goHome} />;
    case 'newcomer':
      return (
        <NewcomerHome
          onBack={goHome}
          onVideo={() => setView({ type: 'newcomer-video' })}
          onHandbook={() => setView({ type: 'newcomer-handbook' })}
        />
      );
    case 'newcomer-video':
      return <VideoGuideList onBack={() => setView({ type: 'newcomer' })} />;
    case 'newcomer-handbook':
      return (
        <DocumentViewer
          onBack={() => setView({ type: 'newcomer' })}
          initChapters={['newcomer1', 'newcomer2', 'newcomer3']}
          initTitle="새내기 핸드북"
          flatMode
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
          onChapters={(ids, title) => setView({ type: 'study', initChapters: ids, initTitle: title })}
          onWrongReview={() => setView({ type: 'wrong-review' })}
          onWrongQuiz={() => setView({ type: 'wrong-quiz' })}
          onMyInfo={() => setView({ type: 'myinfo' })}
          onVideo={() => setView({ type: 'video' })}
          onTraining={() => setView({ type: 'training' })}
          onRescueProcedure={() => setView({ type: 'rescue-procedure' })}
          onRescueSimulation={() => setView({ type: 'rescue-simulation' })}
          onMrBurst={() => setView({ type: 'mr-burst' })}
          onNewcomer={() => setView({ type: 'newcomer' })}
        />
      );
  }
}
