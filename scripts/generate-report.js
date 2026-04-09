/**
 * 2026년 스마트 승무원 양성계획 보고 — DOCX 생성 스크립트
 * 실행: node scripts/generate-report.js
 * 출력: C:/Users/smrt2/Downloads/2026년_스마트승무원_양성계획_리팩토링.docx
 */

const {
  Document, Packer, Paragraph, Table, TableRow, TableCell,
  TextRun, AlignmentType, BorderStyle, WidthType,
  HeadingLevel, ShadingType, TableLayoutType,
  PageBreak, Tab, TabStopPosition, TabStopType,
  Header, Footer, PageNumber, NumberFormat,
  convertInchesToTwip, LevelFormat,
} = require('docx');
const fs = require('fs');

// ── 공통 스타일 헬퍼 ──────────────────────────────

const NAVY = '1B3A5C';
const DARK_GRAY = '333333';
const MID_GRAY = '666666';
const LIGHT_BG = 'F0F4FA';
const WHITE = 'FFFFFF';
const ACCENT = '2E5090';
const TABLE_HEADER_BG = '2E5090';
const TABLE_ALT_BG = 'F5F7FA';
const BORDER_COLOR = 'BFBFBF';

const noBorder = { style: BorderStyle.NONE, size: 0, color: WHITE };
const thinBorder = { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR };
const tableBorders = {
  top: thinBorder, bottom: thinBorder,
  left: thinBorder, right: thinBorder,
  insideHorizontal: thinBorder, insideVertical: thinBorder,
};

function text(str, opts = {}) {
  return new TextRun({ text: str, font: '맑은 고딕', size: opts.size || 20, bold: opts.bold, color: opts.color || DARK_GRAY, ...opts });
}

function emptyLine(size = 10) {
  return new Paragraph({ spacing: { after: size } });
}

function heading1(str) {
  return new Paragraph({
    children: [text(str, { bold: true, size: 28, color: NAVY })],
    spacing: { before: 400, after: 200 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: NAVY } },
  });
}

function heading2(str) {
  return new Paragraph({
    children: [text(str, { bold: true, size: 24, color: ACCENT })],
    spacing: { before: 300, after: 150 },
  });
}

function heading3(str) {
  return new Paragraph({
    children: [text(str, { bold: true, size: 22, color: DARK_GRAY })],
    spacing: { before: 200, after: 100 },
  });
}

function bullet(str, opts = {}) {
  return new Paragraph({
    children: [text(str, opts)],
    bullet: { level: opts.level || 0 },
    spacing: { after: 60 },
  });
}

function para(children, opts = {}) {
  return new Paragraph({
    children: Array.isArray(children) ? children : [text(children)],
    spacing: { after: opts.after || 100 },
    alignment: opts.align,
    indent: opts.indent ? { left: opts.indent } : undefined,
  });
}

function headerCell(str, opts = {}) {
  return new TableCell({
    children: [new Paragraph({
      children: [text(str, { bold: true, size: 18, color: WHITE })],
      alignment: AlignmentType.CENTER,
    })],
    shading: { type: ShadingType.SOLID, color: TABLE_HEADER_BG },
    verticalAlign: 'center',
    width: opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
    columnSpan: opts.columnSpan,
    rowSpan: opts.rowSpan,
  });
}

function dataCell(str, opts = {}) {
  return new TableCell({
    children: [new Paragraph({
      children: [text(str, { size: opts.size || 18, bold: opts.bold, color: opts.color || DARK_GRAY })],
      alignment: opts.align || AlignmentType.LEFT,
    })],
    shading: opts.shading ? { type: ShadingType.SOLID, color: opts.shading } : undefined,
    verticalAlign: 'center',
    width: opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
    columnSpan: opts.columnSpan,
    rowSpan: opts.rowSpan,
  });
}

function makeTable(headerRow, dataRows, opts = {}) {
  const rows = [
    new TableRow({ children: headerRow, tableHeader: true }),
    ...dataRows.map((cells, i) => new TableRow({
      children: cells.map(c => {
        if (c instanceof TableCell) return c;
        return dataCell(c, { shading: i % 2 === 1 ? TABLE_ALT_BG : undefined });
      }),
    })),
  ];
  return new Table({
    rows,
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: tableBorders,
    layout: opts.layout || TableLayoutType.FIXED,
  });
}

// ── 표지 ──────────────────────────────────────────

function coverPage() {
  return [
    emptyLine(200),
    emptyLine(200),
    para([text('행복한 시민, 신뢰받는 기업', { size: 22, color: MID_GRAY, italics: true })], { align: AlignmentType.CENTER }),
    para([text('글로벌 No.1 서울교통공사', { size: 24, color: MID_GRAY, bold: true })], { align: AlignmentType.CENTER }),
    emptyLine(200),
    new Paragraph({
      children: [text('— 열차 안전운행 체계 확립을 위한 —', { size: 22, color: ACCENT })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
    }),
    emptyLine(100),
    new Paragraph({
      children: [text('스마트 승무원 양성계획', { size: 44, bold: true, color: NAVY })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    }),
    emptyLine(200),
    emptyLine(200),
    emptyLine(200),
    para([text('2026. 4.', { size: 24, color: MID_GRAY })], { align: AlignmentType.CENTER }),
    emptyLine(100),
    para([text('답십리승무사업소', { size: 26, bold: true, color: NAVY })], { align: AlignmentType.CENTER }),
    new Paragraph({ children: [new PageBreak()] }),
  ];
}

// ── 본문 내용 ─────────────────────────────────────

function purposeSection() {
  return [
    heading1('1. 추진목적'),

    heading2('가. 데이터 기반 안전관리 체계 전환'),
    bullet('경력에 따라 사고 유발 메커니즘이 상이 → 경력별 3단계 교육 체계 확립'),
    bullet('경력별 차별화 교육을 통한 승무원 역량 향상 추진'),
    bullet('모바일 앱 기반 학습 환경을 구축하여, 시간·장소에 제약 없이 실무 지식에 접근할 수 있는 체계 마련'),

    heading2('나. 스마트 승무원 브랜드 가치 제고'),
    bullet('시민의 안전을 책임지는 스마트 승무원의 대내외 신뢰도 향상 도모'),
    bullet('체계적 교육 이력 관리를 통해 승무원 전문성을 가시화'),
  ];
}

function overviewSection() {
  return [
    heading1('2. 추진방안'),

    heading2('가. 스마트 승무원 양성 개요'),
    makeTable(
      [headerCell('항목', { width: 20 }), headerCell('내용', { width: 80 })],
      [
        ['교육명칭', '2026년 스마트 승무원 양성'],
        ['교육 대상', '기관사'],
        ['교육 도구', '스마트 승무원 DIA (모바일 웹 앱, PWA 방식)'],
        ['교육목표 ①', '이례상황(사고 및 장애)에 대한 조치 능력 확보'],
        ['교육목표 ②', '인적오류를 예방하는 올바른 운전습관 정착 지원'],
        ['교육목표 ③', '신규 기관사에게 업무 노하우 전수'],
      ],
    ),
    emptyLine(),
  ];
}

function programSection() {
  return [
    heading2('나. 스마트 승무원 추진계획'),
    heading3('❏ 단계별 스마트 승무원 교육 프로그램 구축'),
    makeTable(
      [
        headerCell('단계', { width: 8 }),
        headerCell('항목', { width: 22 }),
        headerCell('내용', { width: 48 }),
        headerCell('현황', { width: 22 }),
      ],
      [
        ['❶', '고장처치 교범\n데이터베이스 구축', '종류별 전동차(ABB·우진·로템) 고장 부위별 조치 방법을 체계적으로 정리한 디지털 교범 구축', '구축 완료 (ABB·우진)\n로템 자료 준비 중'],
        ['❷', '단계별 체크리스트\n작성', '출근준비→교대→본선운행→입출고→종료 각 단계의 점검 항목을 정리하여 본인 능력 자가점검 체계 마련', '평가표 확정\n앱 연동 예정'],
        ['❸', '수준에 맞는\n교육 프로그램 구축', '근무절차·전동차 시스템·신호체계·이례조치·안내방송·구간별 특수사항 등 실무 전 영역을 포괄하는 교육 콘텐츠 제작', '구축 완료\n(6개 장 + 새내기 3개 장)'],
        ['❹', '교육 결과를 확인하는\n테스트 프로그램 구축', '교육 완료 후 테스트를 통해 능력 검증.\n오답 추적 및 반복 학습 지원', '구축 완료\n(100문제+오답노트+성적추적)'],
      ],
    ),
    emptyLine(),
  ];
}

function appSection() {
  return [
    heading3('❏ 스마트 승무원 DIA 앱 — 현재 구축 현황'),
    para('스마트 승무원 DIA는 답십리승무사업소 기관사 전용 모바일 웹 앱으로, 별도 설치 없이 스마트폰 브라우저에서 접근하며 홈 화면 추가를 통해 앱처럼 사용할 수 있다. 현재 구축·운용 중인 주요 기능은 다음과 같다.'),
    emptyLine(),

    para([text('[교육 영역] — "스마트 승무원 가이드 북"', { bold: true, size: 20, color: NAVY })]),
    makeTable(
      [headerCell('메뉴', { width: 18 }), headerCell('기능', { width: 62 }), headerCell('비고', { width: 20 })],
      [
        ['근무절차', '기관사 주요업무, 안전수칙, 출근~퇴근 전 과정의 작업절차를 단계별 플로우로 제공', ''],
        ['전동차 시스템', 'TCMS, ATC, 제어기, 출입문, 냉난방 등 전동차 핵심 시스템 해설', ''],
        ['고장조치', 'ABB·우진 전동차별 고장 부위·증상·조치법을 사진과 함께 제공. 전동차 간 비교 기능 포함', '로템 추가 예정'],
        ['이례조치', '화재, 정전, 성인병, 테러, 위험물 등 상황별 대응 절차', ''],
        ['안내방송', '정상·이례 상황별 차내·차외 방송 요령 및 스크립트', ''],
        ['구간별 특수사항', '답십리~강동, 미사, 기지 등 구간별 운전 유의사항', ''],
        ['새내기 교육', '신규 기관사 대상 기초 교육 콘텐츠', ''],
        ['평가(퀴즈)', '100문제 객관식 테스트 + 오답노트 + 성적 대시보드(최고점, 평균, 연속정답, 성장추이)', ''],
      ],
    ),
    emptyLine(),

    para([text('[근무 영역]', { bold: true, size: 20, color: NAVY })]),
    makeTable(
      [headerCell('기능', { width: 25 }), headerCell('내용', { width: 75 })],
      [
        ['교번 조회', '본인 및 동료 기관사의 일별 교번(출퇴근 시각, 운전행로, 열차번호) 즉시 확인'],
        ['교대자 자동 표시', '열차번호·시간대 기반으로 교대 기관사를 자동 매칭하여 표시'],
        ['월간 달력', '주간/야간/대기/휴무를 색상으로 구분한 월간 근무 현황'],
        ['교번 비교', '2명의 기관사 교번을 나란히 비교'],
      ],
    ),
    emptyLine(),

    para([text('[안전 영역]', { bold: true, size: 20, color: NAVY })]),
    makeTable(
      [headerCell('기능', { width: 25 }), headerCell('내용', { width: 75 })],
      [
        ['위험개소', '현장에서 발견한 위험요소를 사진과 함께 등록·공유'],
        ['조치내용', '위험개소에 대한 조치 결과 기록'],
        ['장애신고', '열차 장애 발생 시 역/구간, 심각도 등을 신속히 공유'],
        ['알림마당', '관리자가 안전 관련 공지사항을 게시'],
      ],
    ),
    emptyLine(),

    para([text('[부가 기능]', { bold: true, size: 20, color: NAVY })]),
    makeTable(
      [headerCell('기능', { width: 25 }), headerCell('내용', { width: 75 })],
      [
        ['5호선 실시간 열차 위치', '서울시 오픈API 연동, 10초 간격 갱신'],
        ['비상 연락처', '주요 연락처 즉시 확인'],
        ['출퇴근 경로 검색', '교대 장소까지의 경로 안내'],
        ['라이프 커뮤니티', '힐링·취미·성장·라운지 4개 카테고리의 소통 공간'],
        ['다크/라이트 모드', '야간 근무 시 눈 피로 경감'],
        ['폰트 크기 조절', '개인별 가독성 맞춤'],
        ['익명 피드백', '앱 개선 의견 및 버그 제보'],
      ],
    ),
    emptyLine(),
  ];
}

function scheduleSection() {
  return [
    heading3('❏ 추진 일정'),
    makeTable(
      [headerCell('일정', { width: 28 }), headerCell('내용', { width: 52 }), headerCell('비고', { width: 20 })],
      [
        ['2026. 3. 3. ~ 3. 31.', '프로그램 구축 (교범 DB, 교육 콘텐츠, 퀴즈 시스템)', '완료'],
        ['2026. 4. 1. ~ 4. 30.', '자료 검토 및 테스트 (내용 정확성 검증, 사용성 점검)', '진행 중'],
        ['2026. 5. 1. ~', '신규양성교육부터 적용', ''],
        ['2026. 6. 1.', '전 직원 베타테스트 실시', ''],
        ['2026. 7. 1.', '수준별 스마트 기관사 프로그램 적용', ''],
        ['2026. 12. 1.', '결과 분석 및 피드백', ''],
      ],
    ),
    emptyLine(),
  ];
}

function eduContentSection() {
  return [
    heading2('다. 스마트(본무) 기관사 교육사항'),
    makeTable(
      [headerCell('구분', { width: 22 }), headerCell('주요 내용', { width: 78 })],
      [
        ['운전관계규정', '❍ 운전취급 규정 및 전동차 승무업무 예규 등'],
        ['인적오류예방', '❍ 지적확인환호 훈련'],
        ['방송 분야', '❍ 행복방송 및 상황별 맞춤 안내방송 요령 등'],
        ['이례상황시 조치', '❍ 열차고장시 고장조치법 습득\n❍ 이례사고 발생시 응급조치 요령\n❍ 열차무전기 사용법 등'],
        ['운전취급 요령', '❍ 5호선 전구간 운전취급요령 등 실무지식'],
      ],
    ),
    emptyLine(),
    para([
      text('※ ', { bold: true, color: ACCENT }),
      text('위 교육사항은 스마트 승무원 DIA 앱의 "스마트 승무원 가이드 북"에 해당 내용이 수록되어 있어, 교육 시간 외에도 현장에서 수시로 참고할 수 있다.', { color: ACCENT }),
    ]),
    emptyLine(),
  ];
}

function operationSection() {
  return [
    heading2('라. 스마트(본무) 기관사 운영(활용) 계획'),
    heading3('❏ 신규 기관사 1:1 멘토링 교육 실시'),
    makeTable(
      [
        headerCell('단계', { width: 10 }),
        headerCell('핵심내용', { width: 28 }),
        headerCell('앱 활용 방안', { width: 42 }),
        headerCell('비고', { width: 20 }),
      ],
      [
        ['1단계', '기존 지식 재점검 및\n잘못된 운전습관 교정', '퀴즈 시스템으로 기초 지식 수준 확인,\n오답 영역 중심 보충 학습', '운전습관 교정'],
        ['2단계', '반복 숙달된\n고장조치 능력 강화', '고장처치 교범(ABB·우진)으로\n부위별 조치법 반복 학습', '실무 역량 강화'],
        ['3단계', '상황별 판단력 훈련\n및 멘토링 습득', '이례조치 매뉴얼 + 구간별 특수사항으로\n상황 대응력 보완', '스마트 기관사'],
      ],
    ),
    emptyLine(),

    heading3('❏ 활용 방식'),
    bullet('일상 학습: 기관사가 대기 시간, 출퇴근 중 스마트폰으로 교육 콘텐츠에 접근하여 자기 주도 학습'),
    bullet('교육 시간 보조: 집합교육 시 앱의 교범·이례조치 자료를 보조 교재로 활용'),
    bullet('현장 즉시 참조: 고장 발생 시 해당 전동차 고장조치 매뉴얼을 현장에서 즉시 확인'),
    bullet('자가 점검: 퀴즈 시스템을 통해 본인의 지식 수준을 스스로 확인하고, 부족한 영역을 파악'),
    bullet('관리자 활용: 안전 관련 공지사항 게시, 위험개소 공유 현황 모니터링'),
    emptyLine(),
  ];
}

function effectSection() {
  return [
    heading1('3. 기대효과'),
    bullet('모바일 앱을 통해 시간·장소에 구애받지 않고 교육 콘텐츠에 접근할 수 있어, 승무원의 자기 주도 학습 환경 조성'),
    bullet('고장처치 교범의 디지털화로, 전동차별 고장조치 정보를 현장에서 즉시 확인할 수 있어 정보 확인 시간 단축 및 조치 정확도 향상 기대'),
    bullet('퀴즈 시스템 및 성적 추적 기능을 통해 개인별 취약 영역을 객관적으로 파악하고, 반복 학습을 유도하여 교육 효과 제고'),
    bullet('위험개소·장애신고 공유 기능을 통해 현장 안전 정보가 실시간으로 전 기관사에게 전파되어, 유사 사고 예방에 기여'),
    bullet('체계적인 교육 프로그램 운영을 통해 신규 기관사의 현장 적응 기간 단축 및 멘토링 교육의 실효성 향상'),
    bullet('교육 자료의 표준화·디지털화를 통해 교육 품질의 일관성 확보 및 자료 갱신·배포의 효율화'),
    emptyLine(),
    new Paragraph({ children: [new PageBreak()] }),
  ];
}

function checklistSection() {
  return [
    heading1('붙임 1. 스마트(본무) 승무원 체크리스트 평가표'),
    emptyLine(),
    para([
      text('2026.  .  .    직급:          사번:          성명:', { size: 20 }),
    ]),
    emptyLine(),

    // 체크리스트 표
    new Table({
      rows: [
        // 헤더
        new TableRow({
          children: [
            headerCell('구분', { width: 15 }),
            headerCell('', { width: 5 }),
            headerCell('체크리스트', { width: 55 }),
            headerCell('배점', { width: 12 }),
            headerCell('점수', { width: 13 }),
          ],
          tableHeader: true,
        }),
        // 합계
        new TableRow({
          children: [
            dataCell('', { width: 15 }),
            dataCell('', { width: 5 }),
            dataCell('합계', { bold: true, align: AlignmentType.CENTER }),
            dataCell('900', { bold: true, align: AlignmentType.CENTER }),
            dataCell('', { align: AlignmentType.CENTER }),
          ],
        }),
        // 출근 및 준비
        ...makeChecklistRows('출근 및\n준비', [
          '근무복 착용 상태 여부',
          'DIA 출근시간확인(주/야간) 및 음주측정(0.02% 미만) 여부',
          '운전관리(증무적합검사) 및 최근 사고사례 / 일일교육 숙지여부',
          '출무 점호 및 운전행로 확인여부',
        ]),
        // 교대 및 운전실 점검
        ...makeChecklistRows('교대 및\n운전실\n점검', [
          '5분전 출장교대 준비 및 1-1 출입문 교대 여부',
          '승무지킴이 앱 실행 및 미지원자 휴대폰 전원 OFF 여부',
          '승무교대시 운전정보 교환 여부, 출입문·PSD 열림/닫힘 상태 확인',
          '제어대 위 불안전 물품 비치 여부',
          '각종 계기등 및 차단기 위치 및 고장여부 확인',
          '열차 무전기 상태 점검 및 볼륨 적정성 확인',
        ]),
        // 본선운행
        ...makeChecklistRows('본선운행', [
          '지적확인 환호 이행 및 관제 무전 경청(복명복창) 여부',
          '신호/진로 확인 철저 및 전도주시(위험개소 숙지) 여부',
          '출입문 취급 전 승강장 위치/방향확인',
          '승객 승하차 상태 확인 및 차내 안내방송 적정 시행여부',
          '운전모드 및 출입문 모드 변경시 확인여부',
          '수동운전시 속도코드 이행 및 적정성 여부',
          '마스콘 무력화 여부',
          '수동운전시 정위치 정차 시 적정성 여부',
          '이례상황시 관제보고 안내방송 여부',
          '운전실 이석시 제동체결 여부',
          '승무교대시 정보교환 및 이례사항 전달여부',
        ]),
        // 입출고 및 종료
        ...makeChecklistRows('입출고\n및 종료', [
          '종착역 입고시 안내방송 잔류승객 확인 여부',
          '검수고/세척고 통과시 제한속도(5km/h) 준수',
          '검수고 일단 정차 및 15km/h 투입시 보고 및 20m, 3m 일단정차여부',
          '출고절차 준수 여부',
          '출고시 관제 보고 및 제한 속도 준수 여부',
          '출고 진로 확인 여부',
          '승강장 도착후 출입문 개방 및 행선표지 확인여부',
          '승무원 근무기록부 작성여부(이례상황포함)',
          '종료보고',
        ]),
      ],
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: tableBorders,
    }),

    emptyLine(200),
    para([text('평가자    답십리 승무사업소                    (인)', { size: 20 })], { align: AlignmentType.RIGHT }),
  ];
}

function makeChecklistRows(category, items) {
  return items.map((item, i) => {
    const cells = [];
    if (i === 0) {
      cells.push(dataCell(category, {
        bold: true,
        align: AlignmentType.CENTER,
        shading: LIGHT_BG,
        rowSpan: items.length,
      }));
    }
    cells.push(dataCell(`${i + 1}`, { align: AlignmentType.CENTER }));
    cells.push(dataCell(item));
    cells.push(dataCell('30', { align: AlignmentType.CENTER }));
    cells.push(dataCell('', { align: AlignmentType.CENTER }));
    return new TableRow({ children: cells });
  });
}

// ── 문서 조립 ─────────────────────────────────────

async function main() {
  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: '맑은 고딕', size: 20, color: DARK_GRAY },
          paragraph: { spacing: { line: 360, after: 80 } },
        },
      },
    },
    sections: [{
      properties: {
        page: {
          margin: {
            top: convertInchesToTwip(1),
            bottom: convertInchesToTwip(1),
            left: convertInchesToTwip(1.2),
            right: convertInchesToTwip(1),
          },
        },
      },
      headers: {
        default: new Header({
          children: [para([text('답십리승무사업소 | 2026 스마트 승무원 양성계획', { size: 16, color: MID_GRAY, italics: true })], { align: AlignmentType.RIGHT, after: 0 })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            children: [
              text('- ', { size: 16, color: MID_GRAY }),
              new TextRun({ children: [PageNumber.CURRENT], font: '맑은 고딕', size: 16, color: MID_GRAY }),
              text(' -', { size: 16, color: MID_GRAY }),
            ],
            alignment: AlignmentType.CENTER,
          })],
        }),
      },
      children: [
        ...coverPage(),
        ...purposeSection(),
        ...overviewSection(),
        ...programSection(),
        ...appSection(),
        ...scheduleSection(),
        ...eduContentSection(),
        ...operationSection(),
        ...effectSection(),
        ...checklistSection(),
      ],
    }],
  });

  const buffer = await Packer.toBuffer(doc);
  const outPath = 'C:/Users/smrt2/Downloads/2026년_스마트승무원_양성계획_리팩토링.docx';
  fs.writeFileSync(outPath, buffer);
  console.log(`✅ 생성 완료: ${outPath}`);
  console.log(`   파일 크기: ${(buffer.length / 1024).toFixed(1)} KB`);
}

main().catch(e => { console.error('❌ 오류:', e.message); process.exit(1); });
