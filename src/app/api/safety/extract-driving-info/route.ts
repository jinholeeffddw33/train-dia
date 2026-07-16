import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { serverSupabase } from '@/lib/serverSupabase';

/**
 * 운전정보 사진 → 제목·분류·내용 자동 추출 (사람이 확인·수정한 뒤 등록).
 *
 * ★ 자동 저장이 아니라 자동 '채움' 이다 — 안전 자료라 AI 오인식이 그대로 올라가면 안 된다.
 *   폼이 결과를 미리 채워주고, 등록 버튼은 사람이 누른다.
 *
 * API 키는 서버에만 둔다(NEXT_PUBLIC_ 접두사 금지) — 붙이면 브라우저 번들에 그대로 실린다.
 */

const apiKey = (process.env.ANTHROPIC_API_KEY ?? '').trim();
const anthropic = apiKey ? new Anthropic({ apiKey }) : null;

/** 운전정보 서식이 매번 같아서(제목/발생개요/원인/재발방지 대책) 스키마를 고정할 수 있다 */
const SCHEMA = {
  type: 'object',
  properties: {
    title: {
      type: 'string',
      description: '사고 제목. 문서 상단 가운데의 굵은 제목을 그대로. 예: "8호선 산성역 하선 출입문 미취급". 접두사 [열차] 나 "운전정보 N호" 는 넣지 말 것.',
    },
    kind: {
      type: 'string',
      enum: ['열차', '신호', '시설물'],
      description: '분류. 열차/차량 기기 고장·취급 문제=열차, 신호기·신호장치=신호, 승강장·궤도·역 설비=시설물.',
    },
    hoNumber: {
      type: 'string',
      description: '문서 우상단의 호수 숫자만. 예: "2026-12" 면 "12". 안 보이면 빈 문자열.',
    },
    description: {
      type: 'string',
      description: '본문. 【발생개요】【원인】【재발방지 대책】 순서로, 각 제목을 그 형식대로 쓰고 아래에 내용을 옮긴다. 원인·대책은 문서의 번호를 그대로 유지. 문서에 없는 항목은 생략. 표는 옮기지 말 것.',
    },
  },
  required: ['title', 'kind', 'hoNumber', 'description'],
  additionalProperties: false,
} as const;

const PROMPT = `첨부한 서울교통공사 '운전정보' 문서 사진에서 아래 4가지를 그대로 옮겨줘.

- title: 상단 가운데 굵은 제목
- kind: 분류(열차/신호/시설물)
- hoNumber: 우상단 호수의 숫자 부분만
- description: 【발생개요】【원인】【재발방지 대책】

옮겨 적는 작업이야 — 요약하거나 바꿔 쓰지 말고, 문서에 적힌 문장을 그대로 사용해. 안 보이거나 확실하지 않은 글자는 지어내지 말 것.`;

export async function POST(req: NextRequest) {
  if (!anthropic) {
    return NextResponse.json(
      { code: 'NOT_CONFIGURED', message: '자동 인식이 아직 설정되지 않았어요. 직접 입력해주세요.' },
      { status: 503 },
    );
  }

  let body: { image?: string; mediaType?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ code: 'INVALID_JSON', message: '잘못된 요청이에요' }, { status: 400 });
  }

  const { image, mediaType } = body;
  if (!image) {
    return NextResponse.json({ code: 'MISSING_IMAGE', message: '사진이 필요해요' }, { status: 400 });
  }

  const type = mediaType === 'image/png' ? 'image/png' : 'image/jpeg';

  try {
    const res = await anthropic.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 4096,
      thinking: { type: 'adaptive' },
      output_config: {
        effort: 'medium',
        format: { type: 'json_schema', schema: SCHEMA },
      },
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: type, data: image } },
          { type: 'text', text: PROMPT },
        ],
      }],
    });

    // 안전 분류기가 거절하면 content 가 비어 있다 — 읽기 전에 확인
    if (res.stop_reason === 'refusal') {
      return NextResponse.json(
        { code: 'REFUSED', message: '이 사진은 자동으로 읽지 못했어요. 직접 입력해주세요.' },
        { status: 422 },
      );
    }

    const text = res.content.find((b) => b.type === 'text');
    if (!text || text.type !== 'text') {
      return NextResponse.json(
        { code: 'NO_OUTPUT', message: '사진에서 내용을 찾지 못했어요. 직접 입력해주세요.' },
        { status: 422 },
      );
    }

    const parsed = JSON.parse(text.text) as {
      title: string; kind: string; hoNumber: string; description: string;
    };

    // 호수는 사진에서 읽은 값을 쓰되, 안 보이면 DB의 마지막 호수 + 1 로 채운다
    let ho = parsed.hoNumber?.replace(/[^0-9]/g, '') ?? '';
    if (!ho) ho = await nextHoNumber();

    return NextResponse.json({
      title: parsed.title ?? '',
      kind: ['열차', '신호', '시설물'].includes(parsed.kind) ? parsed.kind : '열차',
      location: ho ? `${ho}호` : '',
      description: parsed.description ?? '',
    });
  } catch (e) {
    const msg = e instanceof Anthropic.APIError ? `${e.status}` : 'unknown';
    return NextResponse.json(
      { code: 'EXTRACT_FAILED', message: '사진을 읽지 못했어요. 직접 입력해주세요.', detail: msg },
      { status: 502 },
    );
  }
}

/** 등록된 운전정보 중 가장 큰 호수 + 1 */
async function nextHoNumber(): Promise<string> {
  if (!serverSupabase) return '';
  const { data } = await serverSupabase
    .from('hazard_reports')
    .select('location')
    .eq('category', 'inspect');
  const max = (data ?? [])
    .map((r) => parseInt(String(r.location ?? '').replace(/[^0-9]/g, ''), 10))
    .filter((n) => Number.isFinite(n))
    .reduce((a, b) => Math.max(a, b), 0);
  return max > 0 ? String(max + 1) : '';
}
