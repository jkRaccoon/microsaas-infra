#!/usr/bin/env node
/**
 * GA4 속성 기본 설정을 확인·조정하고, properties.json 의 conversionEvents 를 "주요 이벤트"로 마킹.
 *
 * 동작:
 *   1. measurement ID 와 일치하는 속성 탐색
 *   2. 속성의 통화·시간대가 desired 와 다르면 업데이트
 *   3. conversionEvents 에 정의된 이벤트를 "conversion event" 로 생성 (이미 있으면 skip)
 *
 * 사용: node scripts/ga4/configure.mjs
 */
import { analyticsAdmin, loadGa4Properties } from './lib.mjs';

const admin = analyticsAdmin();

async function findPropertyByMeasurementId(measurementId) {
  const accs = (await admin.accounts.list({ pageSize: 50 })).data.accounts || [];
  for (const acc of accs) {
    const props =
      (
        await admin.properties.list({
          filter: `parent:${acc.name}`,
          pageSize: 50,
        })
      ).data.properties || [];
    for (const p of props) {
      const streams =
        (
          await admin.properties.dataStreams.list({
            parent: p.name,
            pageSize: 50,
          })
        ).data.dataStreams || [];
      for (const s of streams) {
        if (s.webStreamData?.measurementId === measurementId) {
          return { account: acc, property: p, stream: s };
        }
      }
    }
  }
  return null;
}

async function ensureConversionEvent(propertyName, eventName) {
  const existing =
    (
      await admin.properties.conversionEvents.list({
        parent: propertyName,
        pageSize: 100,
      })
    ).data.conversionEvents || [];
  const found = existing.find((c) => c.eventName === eventName);
  if (found) return `already (${eventName})`;
  await admin.properties.conversionEvents.create({
    parent: propertyName,
    requestBody: { eventName },
  });
  return `created (${eventName})`;
}

async function main() {
  const cfg = loadGa4Properties();
  console.log(`→ Measurement ID ${cfg.measurementId} 에 연결된 속성 찾는 중...\n`);
  const found = await findPropertyByMeasurementId(cfg.measurementId);
  if (!found) {
    console.error(`⚠️ Measurement ID ${cfg.measurementId} 에 해당하는 속성이 없습니다.`);
    console.error(`   GA4 콘솔에서 데이터 스트림을 확인하세요.`);
    process.exit(1);
  }

  const { property, stream } = found;
  console.log(`✓ 속성 발견: ${property.displayName}`);
  console.log(`  현재: 통화=${property.currencyCode}, TZ=${property.timeZone}`);
  console.log(`  스트림: ${stream.displayName} (${stream.webStreamData.defaultUri})\n`);

  // 통화·시간대 조정
  const updates = {};
  if (property.currencyCode !== cfg.targetCurrency) updates.currencyCode = cfg.targetCurrency;
  if (property.timeZone !== cfg.targetTimezone) updates.timeZone = cfg.targetTimezone;
  if (Object.keys(updates).length > 0) {
    await admin.properties.patch({
      name: property.name,
      updateMask: Object.keys(updates).join(','),
      requestBody: updates,
    });
    console.log(`✓ 속성 업데이트: ${JSON.stringify(updates)}`);
  } else {
    console.log(`✓ 통화·시간대 이미 목표값`);
  }

  // 전환 이벤트 등록
  console.log(`\n→ Conversion events (${cfg.conversionEvents.length}개):`);
  for (const evt of cfg.conversionEvents) {
    try {
      const result = await ensureConversionEvent(property.name, evt);
      console.log(`  ${result}`);
    } catch (e) {
      const msg = e.response?.data?.error?.message || e.message;
      console.log(`  ✗ ${evt}: ${msg}`);
    }
  }

  console.log(`\n✓ GA4 configure 완료`);
}

main().catch((err) => {
  console.error(err.response?.data || err);
  process.exit(1);
});
