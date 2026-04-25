/**
 * share-card.ts — 1200×630 결과 카드 Canvas 공통 모듈 (microsaas-infra 표준)
 *
 * 참고 원본:
 *   - hangulart/src/pages/Home.tsx (handleDownloadCard) → palette + 그라데이션 + 라운드 + 워터마크
 *   - doljan/src/pages/Home.tsx    (renderDoljanOG)     → 다종 aspect + 사진 합성
 *
 * 사용처:
 *   각 사이트의 `src/lib/shareCard.ts` 로 복붙.
 *   (CDK 레포 import X — i18n-reusable-template 와 동일한 "복붙 후 사이트별 미세조정" 방식.)
 *
 * 책임:
 *   1. drawShareCard({ title, subtitle, stats, palette, watermark }): Promise<Blob>
 *      → 1200×630 PNG Blob 반환. Canvas 가 없는 SSR 환경에서는 reject.
 *   2. triggerDownload(blob, filename): void
 *      → <a download> 링크 자동 클릭 (메모리 누수 없게 revokeObjectURL).
 *   3. shareOrDownload(blob, opts): Promise<'shared' | 'downloaded'>
 *      → Web Share API 사용 가능 + files 지원이면 시스템 공유 시트, 아니면 다운로드 폴백.
 *
 * 디자인:
 *   - 배경: palette.gradient (3-stop 대각 그라데이션)
 *   - 카드: 흰색 반투명(85%) 라운드 32px, 좌측 12px accent 막대
 *   - 제목: bold 56px (한글 폰트 우선) + 자동 줄바꿈 (최대 4줄)
 *   - 부제: 400 24px (옵션)
 *   - 통계칩: stats[] 배열 (최대 4개), 그라데이션 박스 + 큰 숫자 + 라벨
 *   - 워터마크: `{domain}.bal.pe.kr` (좌하), 도구명/타임스탬프(우하)
 *
 * 의존성: 없음 (브라우저 Canvas API 만 사용). React 컴포넌트가 아닌 순수 TS 함수.
 */

export interface PaletteDef {
  /** CSS linear-gradient 문자열. 색상 추출용 — 예: 'linear-gradient(135deg,#fdf2f8,#fae8ff,#ede9fe)' */
  gradient: string;
  /** 좌측 accent 막대 + 워터마크 색상 (HEX). */
  accent: string;
  /** 본문 텍스트 색상 (HEX). 어두운 그라데이션 위에선 밝게. */
  text: string;
}

export interface ShareCardStat {
  label: string;
  value: string | number;
}

export interface ShareCardInput {
  /** 큰 제목 (필수). */
  title: string;
  /** 부제 (옵션). */
  subtitle?: string;
  /** 하단 통계 칩 (옵션, 최대 4개). 5번째부터 무시. */
  stats?: ShareCardStat[];
  /** 색상 팔레트. */
  palette: PaletteDef;
  /** 워터마크 도메인 — 보통 `${subdomain}.bal.pe.kr` */
  watermark: string;
  /** 우측 하단 보조 라벨 (옵션, 도구명/타임스탬프 등) */
  badge?: string;
  /** 캔버스 크기 (기본 1200×630, OG 표준). 1080×1080(인스타) / 1080×1920(스토리) 가능. */
  width?: number;
  height?: number;
}

const DEFAULT_FONT_STACK =
  '"Apple SD Gothic Neo", "Noto Sans KR", system-ui, -apple-system, sans-serif';

/**
 * 메인 함수. 1200×630 PNG Blob 을 비동기로 반환한다.
 * SSR/문서 없는 환경에서 호출되면 reject.
 */
export async function drawShareCard(input: ShareCardInput): Promise<Blob> {
  if (typeof document === 'undefined') {
    throw new Error('drawShareCard requires a browser environment');
  }
  const W = input.width ?? 1200;
  const H = input.height ?? 630;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable');

  // 1) 배경 그라데이션
  const gradient = ctx.createLinearGradient(0, 0, W, H);
  const stops = parseGradientStops(input.palette.gradient);
  stops.forEach((c, i) => gradient.addColorStop(i / Math.max(stops.length - 1, 1), c));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, W, H);

  // 2) 흰색 반투명 카드
  const cardX = Math.round(W * 0.067); // 80 / 1200
  const cardY = Math.round(H * 0.143); // 90 / 630
  const cardW = W - cardX * 2;
  const cardH = H - cardY * 2 + Math.round(H * 0.143); // 약 450/630
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  roundRect(ctx, cardX, cardY, cardW, cardH, 32);
  ctx.fill();

  // 3) 좌측 accent 막대
  ctx.fillStyle = input.palette.accent;
  ctx.fillRect(cardX, cardY, 12, cardH);

  // 4) 제목
  ctx.fillStyle = input.palette.text;
  const titleSize = Math.round(H * 0.089); // ~56 / 630
  ctx.font = `bold ${titleSize}px ${DEFAULT_FONT_STACK}`;
  ctx.textBaseline = 'middle';
  const titleX = cardX + 50;
  const titleMaxWidth = cardW - 100;
  const titleLines = wrapText(ctx, input.title, titleMaxWidth).slice(0, 4);
  const lineHeight = Math.round(titleSize * 1.4);

  // 부제 영역 확보 (있을 때만)
  const subtitleSize = Math.round(H * 0.038);
  const hasSubtitle = !!input.subtitle && input.subtitle.length > 0;
  const hasStats = (input.stats?.length ?? 0) > 0;
  const subtitleHeight = hasSubtitle ? Math.round(subtitleSize * 1.6) : 0;
  const statsHeight = hasStats ? Math.round(H * 0.18) : 0; // ~115/630

  const titleBlockHeight = titleLines.length * lineHeight;
  const totalContentHeight = titleBlockHeight + subtitleHeight + statsHeight;
  let cursorY = cardY + (cardH - totalContentHeight) / 2 + lineHeight / 2;

  for (const line of titleLines) {
    ctx.fillText(line, titleX, cursorY);
    cursorY += lineHeight;
  }

  // 5) 부제
  if (hasSubtitle) {
    cursorY += Math.round(subtitleSize * 0.3);
    ctx.fillStyle = input.palette.accent;
    ctx.font = `500 ${subtitleSize}px ${DEFAULT_FONT_STACK}`;
    const subLines = wrapText(ctx, input.subtitle!, titleMaxWidth).slice(0, 2);
    for (const line of subLines) {
      ctx.fillText(line, titleX, cursorY);
      cursorY += Math.round(subtitleSize * 1.4);
    }
  }

  // 6) 통계 칩 (최대 4개)
  if (hasStats) {
    const stats = input.stats!.slice(0, 4);
    const chipGap = 16;
    const chipW = Math.floor((titleMaxWidth - chipGap * (stats.length - 1)) / stats.length);
    const chipH = Math.round(H * 0.13);
    const chipY = cursorY + Math.round(H * 0.02);

    stats.forEach((stat, i) => {
      const x = titleX + (chipW + chipGap) * i;
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      roundRect(ctx, x, chipY, chipW, chipH, 16);
      ctx.fill();
      ctx.strokeStyle = input.palette.accent;
      ctx.lineWidth = 2;
      roundRect(ctx, x, chipY, chipW, chipH, 16);
      ctx.stroke();

      // value
      ctx.fillStyle = input.palette.text;
      ctx.font = `bold ${Math.round(H * 0.057)}px ${DEFAULT_FONT_STACK}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(stat.value), x + chipW / 2, chipY + chipH * 0.4);

      // label
      ctx.fillStyle = input.palette.accent;
      ctx.font = `500 ${Math.round(H * 0.029)}px ${DEFAULT_FONT_STACK}`;
      ctx.fillText(stat.label, x + chipW / 2, chipY + chipH * 0.78);
      ctx.textAlign = 'left';
    });
  }

  // 7) 푸터: 워터마크(좌) + badge(우)
  ctx.fillStyle = input.palette.accent;
  ctx.font = `600 ${Math.round(H * 0.035)}px ${DEFAULT_FONT_STACK}`;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(input.watermark, titleX, H - Math.round(H * 0.057));

  if (input.badge) {
    ctx.fillStyle = '#475569';
    ctx.font = `400 ${Math.round(H * 0.028)}px ${DEFAULT_FONT_STACK}`;
    ctx.textAlign = 'right';
    ctx.fillText(input.badge, W - cardX, H - Math.round(H * 0.057));
    ctx.textAlign = 'left';
  }

  // 8) Blob 변환
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('canvas.toBlob returned null'));
    }, 'image/png');
  });
}

/**
 * 다운로드 트리거 — 메모리 누수 방지를 위해 1초 후 URL revoke.
 */
export function triggerDownload(blob: Blob, filename: string): void {
  if (typeof document === 'undefined') return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Web Share API (files 지원) → 시스템 공유 시트, 아니면 다운로드 폴백.
 * iOS Safari 16+ / Chrome Android 최신 버전이 files 공유를 지원.
 */
export async function shareOrDownload(
  blob: Blob,
  opts: { filename: string; title?: string; text?: string },
): Promise<'shared' | 'downloaded'> {
  if (typeof navigator !== 'undefined' && 'share' in navigator) {
    try {
      const file = new File([blob], opts.filename, { type: blob.type });
      // canShare 가 있는 브라우저에서만 files 공유 시도
      const canShareFiles =
        typeof (navigator as unknown as { canShare?: (d: ShareData) => boolean }).canShare ===
          'function' &&
        (navigator as unknown as { canShare: (d: ShareData) => boolean }).canShare({
          files: [file],
        });
      if (canShareFiles) {
        await (navigator as Navigator & { share: (d: ShareData) => Promise<void> }).share({
          files: [file],
          title: opts.title,
          text: opts.text,
        } as ShareData);
        return 'shared';
      }
    } catch {
      // 사용자 취소 또는 미지원 → 폴백
    }
  }
  triggerDownload(blob, opts.filename);
  return 'downloaded';
}

/* ---------------------------------------------------------------------------
 *  내부 헬퍼
 * --------------------------------------------------------------------------- */

/** 라운드 사각형 path. fill/stroke 는 호출 측에서 수행. */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/** CSS linear-gradient 문자열에서 색상 stops 만 추출. 실패 시 기본 파스텔 3색. */
function parseGradientStops(gradient: string): string[] {
  const matches = gradient.match(/#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)/g);
  return matches && matches.length >= 2 ? matches : ['#fdf2f8', '#fae8ff', '#ede9fe'];
}

/** Canvas measureText 기반 자동 줄바꿈. 한글·이모지 그래핌 보존을 위해 Array.from. */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const chars = Array.from(text);
  const lines: string[] = [];
  let line = '';
  for (const ch of chars) {
    const test = line + ch;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = ch;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines.length > 0 ? lines : [''];
}

/* ---------------------------------------------------------------------------
 *  USAGE EXAMPLE — pages/Home.tsx
 * ---------------------------------------------------------------------------
 *
 *  import { drawShareCard, shareOrDownload, type PaletteDef } from '../lib/shareCard';
 *
 *  const PALETTE: PaletteDef = {
 *    gradient: 'linear-gradient(135deg, #fdf2f8, #fae8ff, #ede9fe)',
 *    accent: '#db2777',
 *    text: '#1e293b',
 *  };
 *
 *  async function handleShareCard() {
 *    const blob = await drawShareCard({
 *      title: `월 순이익 ${result.netProfit.toLocaleString()}원`,
 *      subtitle: `판매가 ${input.price}원 / 카테고리 ${input.category}`,
 *      stats: [
 *        { label: '마진율', value: `${result.marginPct}%` },
 *        { label: '손익분기', value: `${result.breakEven}원` },
 *        { label: '월 광고비', value: `${input.adCost}원` },
 *      ],
 *      palette: PALETTE,
 *      watermark: 'coupangfee.bal.pe.kr',
 *      badge: '쿠팡 순이익 계산기',
 *    });
 *
 *    const result2 = await shareOrDownload(blob, {
 *      filename: `coupangfee-${Date.now()}.png`,
 *      title: '쿠팡 순이익 계산 결과',
 *      text: '쿠팡 순이익 계산기 결과 카드',
 *    });
 *    // result2 === 'shared' or 'downloaded'
 *  }
 *
 * ---------------------------------------------------------------------------
 *  사이트별 미세조정 포인트
 * ---------------------------------------------------------------------------
 *
 *  1. PALETTE: 사이트 메인 컬러로 교체 (gradient + accent + text 3개만 바꾸면 됨)
 *  2. stats: 결과 화면에서 가장 의미 있는 숫자 3~4개 선정
 *  3. watermark: 반드시 `${subdomain}.bal.pe.kr` 형식 유지
 *  4. badge: 도구명(한국어) 또는 타임스탬프
 *  5. width/height: 인스타 정방형이 필요하면 1080×1080, 스토리는 1080×1920
 */
