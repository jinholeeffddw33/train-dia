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
  | { type: 'quiz'; chapter?: string; area?: string }
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
  /**
   * 화면 이력 스택 — 마지막 원소가 현재 화면. 단일 view 로 두면 뒤로가기가 무조건 홈으로 튄다.
   * 교육은 부모가 여럿이라(새내기→영상, 내정보→오답노트, 오답노트/훈련→학습) 깊이가 3단까지 간다.
   * 안전(safety-l1/l2)·라이프(life-l1/l2)와 동일하게 한 단계씩 되돌아가야 한다.
   */
  const [stack, setStack] = useState<EduView[]>([{ type: 'home' }]);
  const view = stack[stack.length - 1];

  const push = useCallback((v: EduView) => setStack((s) => [...s, v]), []);
  const goBack = useCallback(() => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s)), []);

  // 깊이를 key 로 — 깊이가 바뀔 때마다 히스토리 항목이 새로 잡혀 한 단계씩 풀린다
  useHistoryBack(`edu-depth-${stack.length}`, goBack, stack.length > 1);

  switch (view.type) {
    case 'study':
      return (
        <DocumentViewer
          onBack={goBack}
          initSection={view.initSection}
          initChapter={view.initChapter}
          initChapters={view.initChapters}
          initTitle={view.initTitle}
          flatMode={view.flatMode}
        />
      );
    case 'quiz':
      return <QuizSystem onBack={goBack} initChapter={view.chapter} initArea={view.area} />;
    case 'wrong-quiz':
      return <QuizSystem onBack={goBack} wrongOnly />;
    case 'wrong-review':
      return (
        <WrongReview
          onBack={goBack}
          onSection={(id) => push({ type: 'study', initSection: id })}
        />
      );
    case 'myinfo':
      return (
        <MyInfo
          onBack={goBack}
          onWrongReview={() => push({ type: 'wrong-review' })}
          onAreaQuiz={(area) => push({ type: 'quiz', area })}
        />
      );
    case 'video':
      return <VideoEducation onBack={goBack} />;
    case 'training':
      return (
        <TrainingList
          onBack={goBack}
          onSlide={(ids, title) => push({ type: 'study', initChapters: ids, initTitle: title })}
        />
      );
    case 'rescue-procedure':
      return <RescueProcedure onBack={goBack} />;
    case 'rescue-simulation':
      return <RescueSimulation onBack={goBack} />;
    case 'mr-burst':
      return <MrBurstSimulation onBack={goBack} />;
    case 'newcomer':
      return (
        <NewcomerHome
          onBack={goBack}
          onVideo={() => push({ type: 'newcomer-video' })}
          onHandbook={() => push({ type: 'newcomer-handbook' })}
        />
      );
    case 'newcomer-video':
      return <VideoGuideList onBack={goBack} />;
    case 'newcomer-handbook':
      return (
        <DocumentViewer
          onBack={goBack}
          initChapters={['newcomer1', 'newcomer2', 'newcomer3']}
          initTitle="새내기 핸드북"
          flatMode
        />
      );
    default:
      return (
        <EduHome
          onBack={onBack}
          onStudy={() => push({ type: 'study' })}
          onQuiz={() => push({ type: 'quiz' })}
          onSection={(id) => push({ type: 'study', initSection: id })}
          onChapter={(id) => push({ type: 'study', initChapter: id })}
          onChapters={(ids, title) => push({ type: 'study', initChapters: ids, initTitle: title })}
          onWrongReview={() => push({ type: 'wrong-review' })}
          onWrongQuiz={() => push({ type: 'wrong-quiz' })}
          onMyInfo={() => push({ type: 'myinfo' })}
          onVideo={() => push({ type: 'video' })}
          onTraining={() => push({ type: 'training' })}
          onRescueProcedure={() => push({ type: 'rescue-procedure' })}
          onRescueSimulation={() => push({ type: 'rescue-simulation' })}
          onMrBurst={() => push({ type: 'mr-burst' })}
          onNewcomerVideo={() => push({ type: 'newcomer-video' })}
          onNewcomerHandbook={() => push({ type: 'newcomer-handbook' })}
        />
      );
  }
}
