import type { Metadata } from 'next';
import styles from './privacy.module.css';

export const metadata: Metadata = {
  title: '개인정보처리방침 — 기관사 DIA',
  description: '기관사 DIA 앱·웹 서비스의 개인정보 처리방침',
  robots: { index: true, follow: true },
};

/**
 * 개인정보처리방침 (개인정보 보호법 제30조 법정 기재사항)
 *
 * ★ 이 페이지는 **로그인 없이** 열려야 한다.
 *   · Play Console / App Store Connect 에 URL 을 제출하면 심사자가 비로그인 상태로 확인한다
 *   · 법 제30조는 "정보주체가 쉽게 확인할 수 있도록 공개"를 요구한다
 *   그래서 AuthGate 가 감싸는 루트(/)가 아니라 별도 라우트로 둔다.
 *
 * 내용은 2026-08-18 코드 전수 조사로 확인한 **실제 처리 현황**이다(추정 아님):
 *   · audit_log 에 IP 기록(authServer.auditLog · login/logout/pin/railbot)
 *   · hazard_reports 사진 업로드(api/safety/hazards)
 *   · 위험요인 제보 텍스트가 Anthropic API 로 전송(api/safety/extract-driving-info)
 *   · 익명 ID(localStorage UUID)로 피드백 스레드 추적(lib/anonymousId)
 *
 * 보호책임자 표기: 법 제30조는 "성명 **또는** 보호업무 처리 부서의 명칭과 연락처"를 요구한다.
 *   개인이 운영하는 서비스라 부서가 없으므로 직책("운영자") + 연락처로 요건을 충족시켰다.
 *   실명이나 사업자명으로 바꾸려면 아래 표 한 줄만 고치면 된다.
 *
 * ⚠️ TODO(진호): Supabase 리전 확인. 서울(ap-northeast-2)이면 현행 표기가 맞고,
 *   해외 리전이면 §5 국외 이전 표에 Supabase 행의 이전 국가를 명시해야 한다.
 */

const UPDATED = '2026년 8월 18일';

export default function PrivacyPolicyPage() {
  return (
    <main className={styles.page}>
      <div className={styles.inner}>
        <h1 className={styles.title}>개인정보처리방침</h1>
        <p className={styles.meta}>시행일: {UPDATED}</p>

        <p className={styles.lead}>
          기관사 DIA(이하 &lsquo;서비스&rsquo;)는 이용자의 개인정보를 소중히 다루며,
          「개인정보 보호법」 등 관련 법령을 준수합니다. 본 방침은 서비스가 어떤 정보를
          무엇을 위해 수집하고, 얼마나 보관하며, 이용자가 어떤 권리를 행사할 수 있는지를 설명합니다.
        </p>

        <section className={styles.section}>
          <h2 className={styles.h2}>1. 수집하는 개인정보 항목</h2>
          <table className={styles.table}>
            <thead>
              <tr><th>구분</th><th>항목</th><th>수집 시점</th></tr>
            </thead>
            <tbody>
              <tr>
                <td>계정</td>
                <td>사번, 이름, 비밀번호(PIN, 암호화 저장), 권한 등급</td>
                <td>로그인·계정 등록 시</td>
              </tr>
              <tr>
                <td>접속 기록</td>
                <td>접속 일시, 수행한 동작, <strong>IP 주소</strong></td>
                <td>로그인·로그아웃·PIN 변경 등 주요 동작 시</td>
              </tr>
              <tr>
                <td>이용 기록</td>
                <td>교육 자료 열람 기록, 게임 점수·기록, 대기 근무 등록 내역</td>
                <td>해당 기능 이용 시</td>
              </tr>
              <tr>
                <td>이용자 작성물</td>
                <td>위험요인 제보 내용 및 <strong>첨부 사진</strong>, 안전 제안, 의견·문의 내용</td>
                <td>작성·제출 시</td>
              </tr>
              <tr>
                <td>알림</td>
                <td>웹 푸시 구독 정보(브라우저가 발급한 식별자), 이름, 사번</td>
                <td>웹에서 푸시 알림을 켤 때</td>
              </tr>
              <tr>
                <td>기기 저장값</td>
                <td>익명 식별자(UUID), 화면 설정(테마·글자 크기), 알람 설정</td>
                <td>서비스 이용 중 자동 생성</td>
              </tr>
            </tbody>
          </table>
          <p className={styles.note}>
            서비스는 주민등록번호를 수집하지 않으며, 위치정보·연락처·사진첩에 접근하지 않습니다.
            앱의 근무 알람은 <strong>기기 안에서만</strong> 동작하며 알람 설정은 서버로 전송되지 않습니다.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.h2}>2. 개인정보의 처리 목적</h2>
          <ul className={styles.list}>
            <li>본인 확인 및 로그인 유지</li>
            <li>근무표·교대자 정보 등 이용자별 맞춤 정보 제공</li>
            <li>위험요인 제보·안전 제안의 접수와 처리, 처리 결과 회신</li>
            <li>공지·알림 전달</li>
            <li>부정 이용 방지 및 장애 대응(접속 기록·IP)</li>
            <li>서비스 이용 통계 분석 및 품질 개선</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2 className={styles.h2}>3. 보유 및 이용 기간</h2>
          <table className={styles.table}>
            <thead><tr><th>구분</th><th>보유 기간</th></tr></thead>
            <tbody>
              <tr><td>계정 정보</td><td>이용자가 탈퇴를 요청할 때까지</td></tr>
              <tr><td>접속 기록(IP 포함)</td><td>수집일로부터 1년</td></tr>
              <tr><td>위험요인 제보·의견</td><td>처리 완료 후 3년(안전 관리 이력 목적)</td></tr>
              <tr><td>이용 기록·게임 기록</td><td>계정 삭제 시까지</td></tr>
            </tbody>
          </table>
          <p className={styles.note}>
            다른 법령에서 보존 의무를 정한 경우에는 그 기간을 따릅니다.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.h2}>4. 개인정보의 제3자 제공</h2>
          <p className={styles.p}>
            서비스는 이용자의 개인정보를 제3자에게 제공하지 않습니다.
            다만 법령에 특별한 규정이 있거나 수사기관이 적법한 절차에 따라 요구하는 경우는 예외로 합니다.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.h2}>5. 개인정보 처리의 위탁 및 국외 이전</h2>
          <p className={styles.p}>
            서비스 운영을 위해 아래와 같이 처리를 위탁하고 있으며, 일부는 해외 사업자입니다.
          </p>
          <table className={styles.table}>
            <thead>
              <tr><th>수탁자</th><th>위탁 업무</th><th>이전 국가·항목</th></tr>
            </thead>
            <tbody>
              <tr>
                <td>Supabase</td>
                <td>데이터베이스·파일 저장</td>
                <td>서비스 이용 과정에서 수집되는 위 1항의 정보 전부</td>
              </tr>
              <tr>
                <td>Vercel</td>
                <td>서비스 호스팅·전송</td>
                <td>접속 시 IP 주소 등 통신 기록</td>
              </tr>
              <tr>
                <td>Anthropic</td>
                <td>위험요인 제보 내용에서 운전 정보 자동 추출</td>
                <td>미국 · 이용자가 입력한 제보 텍스트</td>
              </tr>
            </tbody>
          </table>
          <p className={styles.note}>
            이전 일시·방법: 해당 기능 이용 시 정보통신망을 통해 전송됩니다.
            수탁자는 위탁 목적 범위에서만 정보를 처리하며, 목적 달성 후 파기합니다.
            국외 이전을 원하지 않는 경우 해당 기능(제보 자동 추출)을 이용하지 않을 수 있으며,
            이 경우에도 제보 자체는 정상적으로 제출됩니다.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.h2}>6. 개인정보의 파기</h2>
          <p className={styles.p}>
            보유 기간이 지나거나 처리 목적이 달성되면 지체 없이 파기합니다.
            전자적 파일은 복구할 수 없는 방법으로 영구 삭제하며, 출력물이 있는 경우 분쇄하거나 소각합니다.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.h2}>7. 정보주체의 권리와 행사 방법</h2>
          <ul className={styles.list}>
            <li>자신의 개인정보에 대한 열람·정정·삭제·처리정지를 요구할 수 있습니다.</li>
            <li>앱의 <strong>설정 &gt; 의견 보내기</strong> 또는 아래 연락처로 요청하면 지체 없이 조치합니다.</li>
            <li>법정대리인을 통해서도 행사할 수 있습니다.</li>
            <li>권리 행사를 이유로 불이익을 주지 않습니다.</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2 className={styles.h2}>8. 자동으로 수집되는 정보와 거부 방법</h2>
          <p className={styles.p}>
            서비스는 로그인 유지를 위한 세션 쿠키와, 화면 설정·알람 설정·익명 식별자를 저장하기 위해
            기기 내 저장소(localStorage)를 사용합니다. 이 값들은 서비스 제공에 필요한 최소한이며
            광고·추적 목적으로 사용하지 않습니다.
          </p>
          <p className={styles.note}>
            거부 방법: 브라우저 설정에서 쿠키·사이트 데이터를 차단하거나 삭제할 수 있고,
            앱은 기기의 <strong>설정 &gt; 앱 &gt; 저장공간 &gt; 데이터 삭제</strong>로 초기화할 수 있습니다.
            다만 이 경우 로그인 유지와 알람 설정이 해제됩니다.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.h2}>9. 안전성 확보 조치</h2>
          <ul className={styles.list}>
            <li>비밀번호(PIN)는 복호화할 수 없는 방식으로 암호화하여 저장합니다.</li>
            <li>모든 통신 구간에 HTTPS 암호화를 적용합니다.</li>
            <li>데이터베이스 접근 권한을 최소한으로 제한하고, 행 단위 접근 제어를 적용합니다.</li>
            <li>주요 동작에 대한 접속 기록을 남겨 이상 접근을 확인할 수 있도록 합니다.</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2 className={styles.h2}>10. 개인정보 보호책임자</h2>
          <table className={styles.table}>
            <tbody>
              <tr><th>보호책임자</th><td>운영자</td></tr>
              <tr><th>연락처</th><td>jinho@zinosb.com</td></tr>
            </tbody>
          </table>
          <p className={styles.note}>
            개인정보 처리에 관한 문의·불만·피해 구제는 위 연락처로 접수해 주시면 지체 없이 답변드립니다.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.h2}>11. 권익침해 구제 방법</h2>
          <p className={styles.p}>
            개인정보 침해로 인한 구제가 필요한 경우 아래 기관에 상담·분쟁조정을 신청할 수 있습니다.
          </p>
          <ul className={styles.list}>
            <li>개인정보분쟁조정위원회 — 1833-6972 (www.kopico.go.kr)</li>
            <li>개인정보침해신고센터 — 118 (privacy.kisa.or.kr)</li>
            <li>대검찰청 사이버수사과 — 1301 (www.spo.go.kr)</li>
            <li>경찰청 사이버수사국 — 182 (ecrm.police.go.kr)</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2 className={styles.h2}>12. 방침의 변경</h2>
          <p className={styles.p}>
            법령이나 서비스 내용이 바뀌어 방침을 변경할 때에는 시행 7일 전부터
            서비스 공지 또는 본 페이지를 통해 알립니다. 다만 이용자 권리에 중대한 변경이 있는 경우
            30일 전에 알립니다.
          </p>
          <p className={styles.meta}>최종 수정일: {UPDATED}</p>
        </section>
      </div>
    </main>
  );
}
