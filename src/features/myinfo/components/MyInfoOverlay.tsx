'use client';

/**
 * 내 정보 — 설정 → «내 정보». 민원 등급(출입문 · 전체 불만 7단계)과 개인 통계를 한 화면에.
 *
 * 개인정보라 본인 것만 보인다. 소장·부소장·관리자 계정은 위의 칸에서 이름을 찾아 다른 사람을 볼 수 있다
 * (권한 판정은 서버 /api/my-info 가 한다 — 여기서 칸을 숨기는 건 보기 좋으라고일 뿐).
 * 민원 등급이 낮은 사람이 «올리고 싶게» — 내 자리를 색 사다리에 찍고, 한 단계 위까지 몇 건인지,
 * 내 민원 유형에 맞는 요령, 칭찬이 단계를 올린다는 것을 먼저 보여 준다.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { X, Lock, Search, ChevronDown, ChevronUp, UserRound, ShieldCheck, BookOpenCheck, Activity, Award, MessageSquareWarning } from 'lucide-react';
import { useAuthStore } from '@/stores/auth';
import { useModalA11y } from '@/hooks/useModalA11y';
import { getRoster } from '@/data/cycle';
import { officeUsers, internUsers } from '@/lib/auth';
import { isGuest } from '@/lib/guestAccount';
import { useEduStore } from '@/features/edu/hooks/useEduStore';
import { backfillQuizHistory } from '@/features/edu/lib/quizSync';
import { canViewOthersInfo } from '../lib/myInfoAccess';
import { STAGE_NAME, BASIS_LABEL, TYPE_TIPS, nextStageGoal, stageRule, type Stage, type StageBasis } from '../lib/complaintStages';
import type { MyInfoData, ComplaintCase } from '../lib/myInfoTypes';
import styles from './MyInfo.module.css';

const STAGES: Stage[] = [1, 2, 3, 4, 5, 6, 7];
const stageCls = (s: Stage) => styles[`stage${s}`];
const MODE_LABEL: Record<string, string> = {
  quick: '빠른 시험', standard: '기본 시험', full: '전체 시험', chapter: '단원 시험', 'wrong-only': '오답 재시험',
  level: '등급 도전', area: '영역별 시험', regulation: '규정 시험',
};
const DOOR_KINDS = new Set(['신체끼임', '문닫힘', '물건끼임']);

function md(iso: string | null | undefined) {
  if (!iso) return '-';
  const d = iso.slice(0, 10).split('-');
  return `${Number(d[1])}/${Number(d[2])}`;
}
function ymd(iso: string | null | undefined) {
  return iso ? iso.slice(0, 10).replace(/-/g, '.') : '-';
}

export default function MyInfoOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const authUser = useAuthStore((s) => s.user);
  const canPick = canViewOthersInfo(authUser?.sabun, authUser?.role);
  const { progress } = useEduStore();
  const [target, setTarget] = useState<string | null>(null);
  const [data, setData] = useState<MyInfoData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [basis, setBasis] = useState<StageBasis>('door');
  const [casesOpen, setCasesOpen] = useState(false);
  const [openCase, setOpenCase] = useState<number | null>(null);
  // ESC·뒤로가기는 설정 화면이 하위 화면 닫기로 처리한다(중복으로 두 번 닫지 않게) — 여기선 포커스 가두기·스크롤 잠금만
  const modalRef = useModalA11y<HTMLDivElement>(open, onClose, { closeOnEscape: false });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // 본인 화면이면 이 폰에 남아 있던 시험 점수를 먼저 올려 둔다(이미 올린 것은 건너뜀)
      if (!target) await backfillQuizHistory(progress.quizHistory);
      const res = await fetch(`/api/my-info${target ? `?sabun=${encodeURIComponent(target)}` : ''}`, { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as { message?: string }).message || '내 정보를 불러올 수 없어요');
      setData(json as MyInfoData);
    } catch (e) {
      setError(e instanceof Error ? e.message : '내 정보를 불러올 수 없어요');
    } finally {
      setLoading(false);
    }
  // progress.quizHistory 는 열 때 한 번만 쓴다
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  useEffect(() => {
    if (!open) return;
    setCasesOpen(false);
    setOpenCase(null);
    void load();
  }, [open, load]);

  const people = useMemo(() => {
    if (!canPick) return [];
    const map = new Map<string, string>();
    for (const p of [...getRoster(new Date()), ...officeUsers(), ...internUsers()]) {
      if (p.s && !/^결원/.test(p.n) && !isGuest(p.s)) map.set(p.s, p.n);
    }
    return [...map.entries()].map(([s, n]) => ({ s, n })).sort((a, b) => a.n.localeCompare(b.n, 'ko'));
  }, [canPick]);
  const matches = query.trim()
    ? people.filter((p) => p.n.includes(query.trim()) || p.s.startsWith(query.trim())).slice(0, 8)
    : [];

  if (!open) return null;

  const c = data?.complaint.info ?? null;
  const sum = data?.complaint.summary ?? null;
  const stage = c ? (basis === 'door' ? c.doorStage : c.allStage) : null;
  const events = c ? (basis === 'door' ? c.doorEvents : c.allEvents) : 0;
  const avg = sum ? (basis === 'door' ? sum.avgDoor : sum.avgAll) : 0;
  const dist = sum ? (basis === 'door' ? sum.doorDist : sum.allDist) : [];
  const maxDist = Math.max(1, ...dist);
  const goal = stage && c ? nextStageGoal(basis, stage, events) : null;
  const who = data?.viewingOther ? `${data.person.name}님` : '나';

  return (
    <div ref={modalRef} className={styles.overlay} role="dialog" aria-modal="true" aria-label="내 정보">
      <div className={styles.header}>
        <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="닫기">
          <X size={22} />
        </button>
        <h2 className={styles.title}>내 정보</h2>
        <span className={styles.lockChip}><Lock size={14} aria-hidden /> 본인만</span>
      </div>

      <div className={styles.body}>
        {/* 관리자(소장·부소장·관리자 계정) — 다른 사람 보기 */}
        {canPick && (
          <div className={styles.picker}>
            <label className={styles.pickerLabel} htmlFor="myinfo-search">
              <Search size={16} aria-hidden /> 다른 직원 보기 <span className={styles.pickerNote}>(소장·부소장·관리자만)</span>
            </label>
            <input
              id="myinfo-search"
              className={styles.pickerInput}
              placeholder="이름이나 사번을 입력하세요"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoComplete="off"
            />
            {matches.length > 0 && (
              <ul className={styles.pickerList}>
                {matches.map((p) => (
                  <li key={p.s}>
                    <button type="button" className={styles.pickerItem} onClick={() => { setTarget(p.s === authUser?.sabun ? null : p.s); setQuery(''); }}>
                      {p.n} <span className={styles.pickerSabun}>{p.s}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {target && (
              <button type="button" className={styles.backMine} onClick={() => setTarget(null)}>
                내 정보로 돌아가기
              </button>
            )}
          </div>
        )}

        {loading && !data && (
          <div className={styles.state} role="status">
            <span className={styles.spinner} aria-hidden />
            <p>내 정보를 불러오는 중…</p>
          </div>
        )}
        {error && (
          <div className={styles.state}>
            <p>{error}</p>
            <button type="button" className={styles.retryBtn} onClick={() => void load()}>다시 불러오기</button>
          </div>
        )}

        {data && !error && (
          <>
            {/* 신원 */}
            <div className={styles.idCard}>
              <span className={styles.avatar}><UserRound size={22} aria-hidden /></span>
              <div className={styles.idText}>
                <span className={styles.idName}>{data.person.name}</span>
                <span className={styles.idSub}>{data.person.role} · 답십리승무사업소</span>
              </div>
            </div>
            <p className={styles.privacyNote}>
              <ShieldCheck size={15} aria-hidden />
              {data.viewingOther
                ? '관리자 열람 중 — 본인에게만 공개되는 정보예요. 다른 사람에게 보여 주지 마세요.'
                : '이 화면은 본인만 볼 수 있어요. 소장·부소장 외에는 아무도 볼 수 없어요.'}
            </p>

            {/* ── 민원 등급 ── */}
            <section className={styles.section} aria-label="민원 등급">
              <h3 className={styles.sectionTitle}><MessageSquareWarning size={18} aria-hidden /> 민원 등급</h3>

              {!c ? (
                <p className={styles.empty}>
                  {sum ? '민원 분석 대상(현재 기관사 명부)에 없어요.' : '아직 민원 분석 자료가 없어요.'}
                </p>
              ) : (
                <>
                  <div className="z-segment" data-no-press
                    // STYLE-EXCEPTION: 세그먼트 선택 위치는 런타임 값(--seg-idx)으로만 표현된다
                    style={{ '--seg-count': 2, '--seg-idx': basis === 'door' ? 0 : 1 } as React.CSSProperties}>
                    {(['door', 'all'] as StageBasis[]).map((b) => (
                      <button key={b} type="button" className={`z-segment-item ${basis === b ? 'is-on' : ''}`}
                        aria-pressed={basis === b} onClick={() => setBasis(b)}>
                        {b === 'door' ? '출입문 기준' : '전체 불만 기준'}
                      </button>
                    ))}
                  </div>

                  {/* 큰 단계 표시 */}
                  <div className={`${styles.hero} ${stageCls(stage!)}`}>
                    <span className={styles.heroStage}>{stage}단계</span>
                    <span className={styles.heroName}>{STAGE_NAME[stage!]}</span>
                    <span className={styles.heroCount}>
                      {BASIS_LABEL[basis]} <strong>{events}건</strong> · 사업소 평균 {avg}건
                    </span>
                  </div>

                  {/* 색 사다리 — 단계별 인원 + 내 자리 */}
                  <div className={styles.ladder} aria-label={`7단계 중 ${who}는 ${stage}단계`}>
                    {STAGES.map((s, i) => (
                      <div key={s} className={`${styles.rung} ${stageCls(s)} ${s === stage ? styles.rungMe : ''}`}>
                        <span className={styles.rungPin}>{s === stage ? (who === '나' ? '나' : '여기') : ''}</span>
                        <div className={styles.rungBarWrap}>
                          <div className={styles.rungBar}
                            // STYLE-EXCEPTION: 단계별 인원에 비례한 막대 높이(런타임 값)
                            style={{ height: `${Math.max(8, (dist[i] / maxDist) * 100)}%` }} />
                        </div>
                        <span className={styles.rungNum}>{s}</span>
                        <span className={styles.rungName}>{STAGE_NAME[s]}</span>
                        <span className={styles.rungPeople}>{dist[i]}명</span>
                      </div>
                    ))}
                  </div>

                  {/* 다음 목표 */}
                  <div className={styles.goal}>
                    {!goal ? (
                      <p><strong>최고 단계예요 👏</strong> 지금처럼 문을 끝까지 열어 태우고, 친절하게 방송해 주세요.</p>
                    ) : goal.praiseOnly ? (
                      <p><strong>칭찬 민원 1건이면 1단계 «매우 우수»</strong>예요. 칭찬은 대부분 «문을 끝까지 열어 태워 줬다»·«친절한 방송»이에요.</p>
                    ) : (
                      <p>
                        <strong>다음 목표: {goal.target}단계 «{STAGE_NAME[goal.target]}»</strong>
                        <br />{BASIS_LABEL[basis]} {stageRule(basis, goal.target)}이면 올라가요.
                        {goal.less > 0 && <> 지금보다 <strong>{goal.less}건</strong> 적으면 돼요.</>}
                        <br /><span className={styles.goalSub}>앞으로 들어오는 민원이 없으면, 오래된 민원이 집계 기간에서 빠지면서 단계가 올라가요.</span>
                      </p>
                    )}
                  </div>

                  {/* 내 위치 · 추이 */}
                  <div className={styles.factRow}>
                    {sum && basis === 'door' && (
                      <div className={styles.fact}>
                        <span className={styles.factLabel}>{sum.people}명 중</span>
                        <span className={styles.factValue}>
                          {c.doorEvents === 0
                            ? `민원 0건 (${sum.doorSame}명과 함께)`
                            : `많은 순 ${sum.doorMore + 1}위${sum.doorSame > 1 ? ` (${sum.doorSame}명 같음)` : ''}`}
                        </span>
                      </div>
                    )}
                    <div className={styles.fact}>
                      <span className={styles.factLabel}>칭찬</span>
                      <span className={`${styles.factValue} ${c.praise > 0 ? styles.factGood : ''}`}>{c.praise}건{c.praise > 0 ? ' 💐' : ''}</span>
                    </div>
                    {c.byYear.length > 0 && (
                      <div className={styles.fact}>
                        <span className={styles.factLabel}>연도별 {basis === 'door' ? '출입문' : '불만'} 민원</span>
                        <span className={styles.factValue}>
                          {c.byYear.map((y) => `${y.year.slice(2)}년 ${basis === 'door' ? y.door : y.all}건`).join(' → ')}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* 내 유형 → 요령 */}
                  {(() => {
                    const mine = TYPE_TIPS.filter((t) => (c.types[t.key] ?? 0) > 0)
                      .sort((a, b) => (c.types[b.key] ?? 0) - (c.types[a.key] ?? 0)).slice(0, 3);
                    if (mine.length === 0) return null;
                    return (
                      <div className={styles.tips}>
                        <p className={styles.subTitle}>{who === '나' ? '내' : `${who}의`} 민원에 많은 유형 — 이렇게 하면 줄어요</p>
                        {mine.map((t) => (
                          <div key={t.key} className={styles.tip}>
                            <span className={styles.tipHead}>{t.label} <strong>{c.types[t.key]}건</strong></span>
                            <span className={styles.tipText}>{t.tip}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}

                  {/* 민원 원문 */}
                  {c.cases.length > 0 && (
                    <>
                      <button type="button" className={styles.casesToggle} aria-expanded={casesOpen} onClick={() => setCasesOpen((v) => !v)}>
                        {who === '나' ? '내' : `${who}의`} 민원 {c.cases.length}건 {casesOpen ? '접기' : '보기'}
                        {casesOpen ? <ChevronUp size={18} aria-hidden /> : <ChevronDown size={18} aria-hidden />}
                      </button>
                      {casesOpen && (
                        <ul className={styles.caseList}>
                          {c.cases.map((x: ComplaintCase, i) => (
                            <li key={i} className={styles.caseItem}>
                              <button type="button" className={styles.caseHead} aria-expanded={openCase === i} onClick={() => setOpenCase(openCase === i ? null : i)}>
                                <span className={`${styles.kindChip} ${x.kind === '칭찬' ? styles.kindPraise : DOOR_KINDS.has(x.kind) ? styles.kindDoor : styles.kindOther}`}>{x.kind || '기타'}</span>
                                <span className={styles.caseWhere}>{ymd(x.date)} · {x.station || '역 모름'}{x.trainNo ? ` · ${x.trainNo}열차` : ''}</span>
                                {openCase === i ? <ChevronUp size={16} aria-hidden /> : <ChevronDown size={16} aria-hidden />}
                              </button>
                              {openCase === i && (
                                <div className={styles.caseBody}>
                                  <p className={styles.caseMeta}>
                                    {x.timeBand}{x.direction ? ` · ${x.direction}` : ''}{x.flags ? ` · ${x.flags}` : ''}{x.shared ? ' · 교대 기록상 두 사람 함께' : ''}
                                  </p>
                                  <p className={styles.caseText}>{x.content}</p>
                                </div>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </>
                  )}
                  {sum && (
                    <p className={styles.footnote}>
                      분석 기간 {ymd(sum.periodFrom)} ~ {ymd(sum.periodTo)} · 같은 날·같은 열차 민원은 1건으로 셌어요.
                      민원 내용은 승객의 주장이며, 사실 여부는 따로 확인해야 해요.
                    </p>
                  )}
                </>
              )}
            </section>

            {/* ── 안전 ── */}
            <section className={styles.section} aria-label="안전">
              <h3 className={styles.sectionTitle}><ShieldCheck size={18} aria-hidden /> 안전 확인</h3>
              <Meter label="운전정보 확인" done={data.safety.driving.read} total={data.safety.driving.total} unit="건" />
              {data.safety.driving.unread > 0 && (
                <div className={styles.unread}>
                  <p className={styles.unreadTitle}>아직 안 본 운전정보 {data.safety.driving.unread}건</p>
                  <ul className={styles.unreadList}>
                    {data.safety.driving.unreadTitles.map((u) => (
                      <li key={u.id}>{u.title} <span className={styles.dim}>{md(u.date)}</span></li>
                    ))}
                  </ul>
                  {!data.viewingOther && <p className={styles.dim}>안전 → 운전정보에서 열어 보면 확인으로 바뀌어요.</p>}
                </div>
              )}
              <Meter label="열차정보 확인" done={data.safety.train.read} total={data.safety.train.total} unit="건" />
              <Meter label={`점호 확인 (최근 ${data.safety.rollcall.days}일 근무일)`} done={data.safety.rollcall.readDays} total={data.safety.rollcall.workDays} unit="일" />
            </section>

            {/* ── 교육 ── */}
            <section className={styles.section} aria-label="교육">
              <h3 className={styles.sectionTitle}><BookOpenCheck size={18} aria-hidden /> 교육 · 시험</h3>
              <div className={styles.statGrid}>
                <Stat label="시험 횟수" value={`${data.edu.quiz.count}회`} />
                <Stat label="평균" value={data.edu.quiz.count ? `${data.edu.quiz.avg}점` : '-'} />
                <Stat label="최고" value={data.edu.quiz.count ? `${data.edu.quiz.best}점` : '-'} />
              </div>
              {data.edu.quiz.recent.length > 0 && (
                <ul className={styles.rowList}>
                  {data.edu.quiz.recent.map((r, i) => (
                    <li key={i} className={styles.row}>
                      <span>{MODE_LABEL[r.mode] ?? r.mode}</span>
                      <span className={styles.rowRight}><strong>{r.percent}점</strong> <span className={styles.dim}>{r.score}/{r.total} · {md(r.at)}</span></span>
                    </li>
                  ))}
                </ul>
              )}
              {data.edu.levels.length > 0 && (
                <>
                  <p className={styles.subTitle}>등급 도전</p>
                  <ul className={styles.rowList}>
                    {data.edu.levels.slice(0, 5).map((l, i) => (
                      <li key={i} className={styles.row}>
                        <span>{l.name}</span>
                        <span className={styles.rowRight}><strong>{l.score}점</strong> {l.passed ? '합격' : '불합격'} <span className={styles.dim}>{md(l.at)}</span></span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {data.edu.integrity && (
                <div className={styles.row}>
                  <span>청렴 퀴즈</span>
                  <span className={styles.rowRight}><strong>{data.edu.integrity.score}/{data.edu.integrity.total}</strong> <span className={styles.dim}>{md(data.edu.integrity.at)}</span></span>
                </div>
              )}
              {data.edu.quiz.count === 0 && (
                <p className={styles.dim}>교육 → 평가에서 시험을 보면 여기에 쌓여요.</p>
              )}
            </section>

            {/* ── 활동 ── */}
            <section className={styles.section} aria-label="활동">
              <h3 className={styles.sectionTitle}><Activity size={18} aria-hidden /> 앱 이용 · 지도승무</h3>
              <div className={styles.statGrid}>
                <Stat label="최근 30일 접속" value={`${data.activity.visitDays30}일`} />
                <Stat label="최근 90일 접속" value={`${data.activity.visitDays90}일`} />
                <Stat label="마지막 접속" value={md(data.activity.lastVisit)} />
              </div>
              {data.jido && (
                <div className={styles.row}>
                  <span>지도승무 받은 횟수</span>
                  <span className={styles.rowRight}>
                    {data.jido.quarter} <strong>{data.jido.quarterCount}회</strong> · 누적 {data.jido.total}회
                    {data.jido.last && <span className={styles.dim}> · 최근 {ymd(data.jido.last)}</span>}
                  </span>
                </div>
              )}
            </section>

            {/* ── 게임 ── */}
            {(data.games.best.length > 0 || data.games.fame.length > 0 || data.games.multi.length > 0) && (
              <section className={styles.section} aria-label="게임">
                <h3 className={styles.sectionTitle}><Award size={18} aria-hidden /> 게임 기록</h3>
                <ul className={styles.rowList}>
                  {data.games.best.map((g) => (
                    <li key={g.game} className={styles.row}>
                      <span>{g.label}</span>
                      <span className={styles.rowRight}>최고 <strong>{g.score}{g.lowerIsBetter ? 'ms' : '점'}</strong> <span className={styles.dim}>이번 달 {g.plays}판</span></span>
                    </li>
                  ))}
                  {data.games.multi.map((g) => (
                    <li key={g.game} className={styles.row}>
                      <span>{g.label}</span>
                      <span className={styles.rowRight}><strong>{g.wins}승 {g.losses}패</strong> <span className={styles.dim}>점수 {g.rating}</span></span>
                    </li>
                  ))}
                </ul>
                {data.games.fame.length > 0 && (
                  <p className={styles.fame}>
                    🏆 명예의 전당 {data.games.fame.slice(0, 4).map((f) => `${f.year % 100}.${f.month} ${f.label} ${f.rank}위`).join(' · ')}
                  </p>
                )}
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Meter({ label, done, total, unit }: { label: string; done: number; total: number; unit: string }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className={styles.meter}>
      <div className={styles.meterHead}>
        <span>{label}</span>
        <span className={styles.meterValue}>
          {total > 0 ? <><strong>{done}</strong>/{total}{unit} · {pct}%</> : '기록 없음'}
        </span>
      </div>
      <div className={styles.meterTrack} aria-hidden>
        <div className={`${styles.meterFill} ${pct >= 90 ? styles.meterGood : pct >= 60 ? styles.meterMid : styles.meterLow}`}
          // STYLE-EXCEPTION: 확인 비율(런타임 값)
          style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.stat}>
      <span className={styles.statValue}>{value}</span>
      <span className={styles.statLabel}>{label}</span>
    </div>
  );
}
