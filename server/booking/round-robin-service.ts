import { db } from "../db";
import {
  bookingPools,
  bookingPoolMembers,
  bookingPoolAssignments,
  consultantWhatsappConfig,
  appointmentBookings,
} from "../../shared/schema";
import { eq, and, sql, desc, asc, gte, isNotNull } from "drizzle-orm";
import {
  getAgentCalendarClient,
  getAgentCalendarId,
  getStandaloneMemberCalendarClient,
  getStandaloneMemberCalendarId,
} from "../google-calendar-service";

export interface RoundRobinResult {
  selectedAgentConfigId: string;
  memberId: string;
  poolId: string;
  reason: string;
  score: number;
  isStandaloneMember: boolean;
}

export interface PoolMemberInfo {
  memberId: string;
  agentConfigId: string | null;
  agentName: string;
  weight: number;
  maxDailyBookings: number;
  isActive: boolean;
  isPaused: boolean;
  totalBookingsCount: number;
  lastAssignedAt: Date | null;
  todayBookingsCount: number;
  hasCalendar: boolean;
  googleCalendarEmail: string | null;
  isStandalone: boolean;
}

async function getTodayBookingsCount(memberId: string): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().slice(0, 10);

  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(bookingPoolAssignments)
    .where(
      and(
        eq(bookingPoolAssignments.memberId, memberId),
        gte(bookingPoolAssignments.assignedAt, new Date(todayStr))
      )
    );

  return result?.count || 0;
}

async function getMemberCalendarClient(member: { agentConfigId: string | null; memberId: string }) {
  if (member.agentConfigId) {
    return getAgentCalendarClient(member.agentConfigId);
  }
  return getStandaloneMemberCalendarClient(member.memberId);
}

async function getMemberCalendarId(member: { agentConfigId: string | null; memberId: string }): Promise<string | null> {
  if (member.agentConfigId) {
    return getAgentCalendarId(member.agentConfigId);
  }
  return getStandaloneMemberCalendarId(member.memberId);
}

async function checkMemberSlotAvailability(
  member: { agentConfigId: string | null; memberId: string; agentName: string },
  date: string,
  time: string,
  durationMinutes: number = 60,
  timezone: string = "Europe/Rome"
): Promise<boolean> {
  try {
    const calendar = await getMemberCalendarClient(member);
    if (!calendar) {
      console.log(`   ⚠️ [ROUND-ROBIN] Member ${member.agentName} (${member.memberId}) has no calendar connected`);
      return false;
    }

    const calendarId = await getMemberCalendarId(member) || "primary";

    const startDateTime = `${date}T${time}:00`;
    const [startHours, startMinutes] = time.split(":").map(Number);
    const totalMinutes = startHours * 60 + startMinutes + durationMinutes;
    const endHour = Math.floor(totalMinutes / 60) % 24;
    const endMinute = totalMinutes % 60;
    const endTime = `${endHour.toString().padStart(2, "0")}:${endMinute.toString().padStart(2, "0")}`;
    const endDateTime = `${date}T${endTime}:00`;

    const { data } = await calendar.freebusy.query({
      requestBody: {
        timeMin: new Date(`${startDateTime}+01:00`).toISOString(),
        timeMax: new Date(`${endDateTime}+01:00`).toISOString(),
        timeZone: timezone,
        items: [{ id: calendarId }],
      },
    });

    const busySlots = data.calendars?.[calendarId]?.busy || [];
    const isFree = busySlots.length === 0;

    console.log(`   📅 [ROUND-ROBIN] ${member.agentName} calendar ${isFree ? "FREE" : "BUSY"} for ${date} ${time}`);
    return isFree;
  } catch (error: any) {
    console.error(`   ❌ [ROUND-ROBIN] Calendar check failed for ${member.agentName}: ${error.message}`);
    return false;
  }
}

export async function selectRoundRobinAgent(
  poolId: string,
  date: string,
  time: string,
  durationMinutes: number = 60,
  timezone: string = "Europe/Rome"
): Promise<RoundRobinResult | null> {
  console.log(`\n🔄 [ROUND-ROBIN] Selecting agent from pool ${poolId}`);
  console.log(`   📅 Requested slot: ${date} ${time} (${durationMinutes}min)`);

  const [pool] = await db
    .select()
    .from(bookingPools)
    .where(and(eq(bookingPools.id, poolId), eq(bookingPools.isActive, true)))
    .limit(1);

  if (!pool) {
    console.log(`   ❌ [ROUND-ROBIN] Pool not found or inactive: ${poolId}`);
    return null;
  }

  console.log(`   📋 Pool: "${pool.name}" | Strategy: ${pool.strategy}`);

  const linkedMembers = await db
    .select({
      memberId: bookingPoolMembers.id,
      agentConfigId: bookingPoolMembers.agentConfigId,
      weight: bookingPoolMembers.weight,
      maxDailyBookings: bookingPoolMembers.maxDailyBookings,
      totalBookingsCount: bookingPoolMembers.totalBookingsCount,
      lastAssignedAt: bookingPoolMembers.lastAssignedAt,
      agentName: consultantWhatsappConfig.agentName,
      hasCalendar: sql<boolean>`${consultantWhatsappConfig.googleRefreshToken} IS NOT NULL`,
    })
    .from(bookingPoolMembers)
    .innerJoin(
      consultantWhatsappConfig,
      eq(bookingPoolMembers.agentConfigId, consultantWhatsappConfig.id)
    )
    .where(
      and(
        eq(bookingPoolMembers.poolId, poolId),
        eq(bookingPoolMembers.isActive, true),
        eq(bookingPoolMembers.isPaused, false),
        isNotNull(bookingPoolMembers.agentConfigId)
      )
    );

  const standaloneMembers = await db
    .select({
      memberId: bookingPoolMembers.id,
      agentConfigId: bookingPoolMembers.agentConfigId,
      weight: bookingPoolMembers.weight,
      maxDailyBookings: bookingPoolMembers.maxDailyBookings,
      totalBookingsCount: bookingPoolMembers.totalBookingsCount,
      lastAssignedAt: bookingPoolMembers.lastAssignedAt,
      memberName: bookingPoolMembers.memberName,
      hasCalendar: sql<boolean>`${bookingPoolMembers.googleRefreshToken} IS NOT NULL`,
    })
    .from(bookingPoolMembers)
    .where(
      and(
        eq(bookingPoolMembers.poolId, poolId),
        eq(bookingPoolMembers.isActive, true),
        eq(bookingPoolMembers.isPaused, false),
        sql`${bookingPoolMembers.agentConfigId} IS NULL`
      )
    );

  const allMembers = [
    ...linkedMembers.map((m) => ({
      ...m,
      agentName: m.agentName,
    })),
    ...standaloneMembers.map((m) => ({
      ...m,
      agentName: m.memberName || "Membro standalone",
    })),
  ];

  if (allMembers.length === 0) {
    console.log(`   ❌ [ROUND-ROBIN] No active members in pool`);
    return null;
  }

  console.log(`   👥 Active members: ${allMembers.length} (${linkedMembers.length} linked, ${standaloneMembers.length} standalone)`);
  for (const m of allMembers) {
    console.log(`      - ${m.agentName} (weight: ${m.weight}, total: ${m.totalBookingsCount}, calendar: ${m.hasCalendar})`);
  }

  const membersWithDailyCount = await Promise.all(
    allMembers.map(async (m) => ({
      ...m,
      todayBookingsCount: await getTodayBookingsCount(m.memberId),
    }))
  );

  const eligible = membersWithDailyCount.filter((m) => {
    if (!m.hasCalendar) {
      console.log(`      ⚠️ ${m.agentName}: skipped (no calendar)`);
      return false;
    }
    if (m.maxDailyBookings && m.todayBookingsCount >= m.maxDailyBookings) {
      console.log(`      ⚠️ ${m.agentName}: skipped (daily cap ${m.todayBookingsCount}/${m.maxDailyBookings})`);
      return false;
    }
    return true;
  });

  if (eligible.length === 0) {
    console.log(`   ❌ [ROUND-ROBIN] No eligible members (all at cap or no calendar)`);
    return null;
  }

  let ranked: typeof eligible;

  console.log(`\n   📊 [ROUND-ROBIN STRATEGY] Applying strategy: "${pool.strategy}"`);
  console.log(`   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  switch (pool.strategy) {
    case "strict_round_robin": {
      console.log(`   🔁 [STRICT] Sorting by: lowest totalBookingsCount → earliest lastAssignedAt`);
      ranked = [...eligible].sort((a, b) => {
        if (a.totalBookingsCount !== b.totalBookingsCount) {
          return a.totalBookingsCount - b.totalBookingsCount;
        }
        const aTime = a.lastAssignedAt ? new Date(a.lastAssignedAt).getTime() : 0;
        const bTime = b.lastAssignedAt ? new Date(b.lastAssignedAt).getTime() : 0;
        return aTime - bTime;
      });
      for (const m of ranked) {
        const lastAt = m.lastAssignedAt ? new Date(m.lastAssignedAt).toLocaleString('it-IT', { timeZone: 'Europe/Rome' }) : 'mai';
        console.log(`      📋 ${m.agentName}: totali=${m.totalBookingsCount}, ultimo assegnato=${lastAt}`);
      }
      break;
    }

    case "weighted": {
      const totalWeight = eligible.reduce((sum, m) => sum + m.weight, 0);
      const totalAll = eligible.reduce((s, m) => s + m.totalBookingsCount, 0) || 1;
      console.log(`   ⚖️  [WEIGHTED] Peso totale pool: ${totalWeight} | Booking totali pool: ${totalAll}`);
      console.log(`   ⚖️  [WEIGHTED] Calcolo deficit per membro (expectedShare - actualShare):`);
      ranked = [...eligible].sort((a, b) => {
        const aExpectedShare = a.weight / totalWeight;
        const bExpectedShare = b.weight / totalWeight;
        const aActualShare = a.totalBookingsCount / totalAll;
        const bActualShare = b.totalBookingsCount / totalAll;
        const aDeficit = aExpectedShare - aActualShare;
        const bDeficit = bExpectedShare - bActualShare;
        return bDeficit - aDeficit;
      });
      for (const m of ranked) {
        const expectedPct = ((m.weight / totalWeight) * 100).toFixed(1);
        const actualPct = ((m.totalBookingsCount / totalAll) * 100).toFixed(1);
        const deficit = ((m.weight / totalWeight) - (m.totalBookingsCount / totalAll)).toFixed(4);
        console.log(`      📋 ${m.agentName}: peso=${m.weight} (${expectedPct}% atteso) | booking=${m.totalBookingsCount} (${actualPct}% reale) | deficit=${deficit}`);
      }
      break;
    }

    case "availability_first": {
      console.log(`   📅 [AVAILABILITY] Sorting by: lowest todayBookingsCount → lowest totalBookingsCount`);
      ranked = [...eligible].sort((a, b) => {
        if (a.todayBookingsCount !== b.todayBookingsCount) {
          return a.todayBookingsCount - b.todayBookingsCount;
        }
        return a.totalBookingsCount - b.totalBookingsCount;
      });
      for (const m of ranked) {
        console.log(`      📋 ${m.agentName}: oggi=${m.todayBookingsCount}/${m.maxDailyBookings || '∞'}, totali=${m.totalBookingsCount}`);
      }
      break;
    }

    default:
      console.log(`   ⚠️ [UNKNOWN STRATEGY] "${pool.strategy}" - using default order`);
      ranked = eligible;
  }

  console.log(`\n   🏆 [RANKING FINALE] Ordine di priorità:`);
  ranked.forEach((m, i) => {
    console.log(`      ${i + 1}° → ${m.agentName} (peso: ${m.weight}, totali: ${m.totalBookingsCount}, oggi: ${m.todayBookingsCount})`);
  });

  console.log(`\n   🔍 [CALENDARIO] Verifica disponibilità in ordine di ranking...`);
  for (const member of ranked) {
    console.log(`   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`   🔍 Verifico: ${member.agentName} | Slot: ${date} ${time} (${durationMinutes}min)`);
    const isAvailable = await checkMemberSlotAvailability(
      { agentConfigId: member.agentConfigId, memberId: member.memberId, agentName: member.agentName },
      date,
      time,
      durationMinutes,
      timezone
    );

    if (isAvailable) {
      const score = member.weight / (member.totalBookingsCount + 1);
      console.log(`   ✅ [CALENDARIO] ${member.agentName} è LIBERO!`);
      console.log(`\n   ════════════════════════════════════════════`);
      console.log(`   🎯 [ROUND-ROBIN DECISIONE FINALE]`);
      console.log(`   ├── Strategia: ${pool.strategy}`);
      console.log(`   ├── Membro selezionato: ${member.agentName}`);
      console.log(`   ├── Peso: ${member.weight} | Score: ${score.toFixed(2)}`);
      console.log(`   ├── Booking totali: ${member.totalBookingsCount} | Oggi: ${member.todayBookingsCount}`);
      console.log(`   └── Slot assegnato: ${date} alle ${time}`);
      console.log(`   ════════════════════════════════════════════\n`);

      return {
        selectedAgentConfigId: member.agentConfigId || member.memberId,
        memberId: member.memberId,
        poolId: pool.id,
        reason: `${pool.strategy}: ${member.agentName} selected (weight=${member.weight}, total=${member.totalBookingsCount}, today=${member.todayBookingsCount})`,
        score,
        isStandaloneMember: !member.agentConfigId,
      };
    } else {
      console.log(`   ⏭️ ${member.agentName} busy at ${date} ${time}, trying next...`);
    }
  }

  console.log(`   ❌ [ROUND-ROBIN] All members busy at ${date} ${time}`);
  return null;
}

export async function recordRoundRobinAssignment(
  result: RoundRobinResult,
  bookingId: string | null
): Promise<void> {
  console.log(`   📝 [ROUND-ROBIN] Recording assignment: member=${result.memberId}, booking=${bookingId}`);

  await db.insert(bookingPoolAssignments).values({
    poolId: result.poolId,
    memberId: result.memberId,
    bookingId,
    assignedAgentConfigId: result.selectedAgentConfigId,
    assignmentReason: result.reason,
    score: result.score,
  });

  await db
    .update(bookingPoolMembers)
    .set({
      totalBookingsCount: sql`${bookingPoolMembers.totalBookingsCount} + 1`,
      lastAssignedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(bookingPoolMembers.id, result.memberId));

  console.log(`   ✅ [ROUND-ROBIN] Assignment recorded`);
}

export async function getPoolForAgent(agentConfigId: string): Promise<{
  poolId: string;
  strategy: string;
  poolName: string;
} | null> {
  const [agentConfig] = await db
    .select({
      roundRobinEnabled: consultantWhatsappConfig.roundRobinEnabled,
      bookingPoolId: consultantWhatsappConfig.bookingPoolId,
    })
    .from(consultantWhatsappConfig)
    .where(eq(consultantWhatsappConfig.id, agentConfigId))
    .limit(1);

  if (!agentConfig?.roundRobinEnabled || !agentConfig.bookingPoolId) {
    return null;
  }

  const [pool] = await db
    .select()
    .from(bookingPools)
    .where(and(eq(bookingPools.id, agentConfig.bookingPoolId), eq(bookingPools.isActive, true)))
    .limit(1);

  if (!pool) return null;

  return {
    poolId: pool.id,
    strategy: pool.strategy,
    poolName: pool.name,
  };
}

export async function getPoolForConsultant(consultantId: string): Promise<{
  poolId: string;
  strategy: string;
  poolName: string;
} | null> {
  const [pool] = await db
    .select()
    .from(bookingPools)
    .where(and(eq(bookingPools.consultantId, consultantId), eq(bookingPools.isActive, true)))
    .limit(1);

  if (!pool) return null;

  return {
    poolId: pool.id,
    strategy: pool.strategy,
    poolName: pool.name,
  };
}

export async function getPoolMembers(poolId: string): Promise<PoolMemberInfo[]> {
  const linkedMembers = await db
    .select({
      memberId: bookingPoolMembers.id,
      agentConfigId: bookingPoolMembers.agentConfigId,
      agentName: consultantWhatsappConfig.agentName,
      weight: bookingPoolMembers.weight,
      maxDailyBookings: bookingPoolMembers.maxDailyBookings,
      isActive: bookingPoolMembers.isActive,
      isPaused: bookingPoolMembers.isPaused,
      totalBookingsCount: bookingPoolMembers.totalBookingsCount,
      lastAssignedAt: bookingPoolMembers.lastAssignedAt,
      hasCalendar: sql<boolean>`${consultantWhatsappConfig.googleRefreshToken} IS NOT NULL`,
      googleCalendarEmail: consultantWhatsappConfig.googleCalendarEmail,
    })
    .from(bookingPoolMembers)
    .innerJoin(
      consultantWhatsappConfig,
      eq(bookingPoolMembers.agentConfigId, consultantWhatsappConfig.id)
    )
    .where(
      and(
        eq(bookingPoolMembers.poolId, poolId),
        isNotNull(bookingPoolMembers.agentConfigId)
      )
    )
    .orderBy(desc(bookingPoolMembers.weight));

  const standaloneMembers = await db
    .select()
    .from(bookingPoolMembers)
    .where(
      and(
        eq(bookingPoolMembers.poolId, poolId),
        sql`${bookingPoolMembers.agentConfigId} IS NULL`
      )
    )
    .orderBy(desc(bookingPoolMembers.weight));

  const allLinked: PoolMemberInfo[] = await Promise.all(
    linkedMembers.map(async (m) => ({
      memberId: m.memberId,
      agentConfigId: m.agentConfigId,
      agentName: m.agentName,
      weight: m.weight,
      maxDailyBookings: m.maxDailyBookings ?? 10,
      isActive: m.isActive,
      isPaused: m.isPaused,
      totalBookingsCount: m.totalBookingsCount,
      lastAssignedAt: m.lastAssignedAt,
      todayBookingsCount: await getTodayBookingsCount(m.memberId),
      hasCalendar: m.hasCalendar,
      googleCalendarEmail: m.googleCalendarEmail,
      isStandalone: false,
    }))
  );

  const allStandalone: PoolMemberInfo[] = await Promise.all(
    standaloneMembers.map(async (m) => ({
      memberId: m.id,
      agentConfigId: null,
      agentName: m.memberName || "Membro standalone",
      weight: m.weight,
      maxDailyBookings: m.maxDailyBookings ?? 10,
      isActive: m.isActive,
      isPaused: m.isPaused,
      totalBookingsCount: m.totalBookingsCount,
      lastAssignedAt: m.lastAssignedAt,
      todayBookingsCount: await getTodayBookingsCount(m.id),
      hasCalendar: !!m.googleRefreshToken,
      googleCalendarEmail: m.googleCalendarEmail,
      isStandalone: true,
    }))
  );

  return [...allLinked, ...allStandalone];
}

export async function getPoolStats(poolId: string) {
  const members = await getPoolMembers(poolId);

  const totalBookings = members.reduce((sum, m) => sum + m.totalBookingsCount, 0);
  const todayTotal = members.reduce((sum, m) => sum + m.todayBookingsCount, 0);
  const activeMembers = members.filter((m) => m.isActive && !m.isPaused);
  const withCalendar = members.filter((m) => m.hasCalendar);

  const distribution = members.map((m) => ({
    agentName: m.agentName,
    agentConfigId: m.agentConfigId || m.memberId,
    weight: m.weight,
    totalBookings: m.totalBookingsCount,
    todayBookings: m.todayBookingsCount,
    maxDaily: m.maxDailyBookings,
    sharePercent: totalBookings > 0 ? Math.round((m.totalBookingsCount / totalBookings) * 100) : 0,
    hasCalendar: m.hasCalendar,
    isActive: m.isActive,
    isPaused: m.isPaused,
  }));

  return {
    totalMembers: members.length,
    activeMembers: activeMembers.length,
    withCalendar: withCalendar.length,
    totalBookings,
    todayBookings: todayTotal,
    distribution,
  };
}

interface WorkingHoursDay {
  enabled: boolean;
  start?: string;
  end?: string;
  ranges?: Array<{ start: string; end: string }>;
}

interface WorkingHoursConfig {
  monday?: WorkingHoursDay;
  tuesday?: WorkingHoursDay;
  wednesday?: WorkingHoursDay;
  thursday?: WorkingHoursDay;
  friday?: WorkingHoursDay;
  saturday?: WorkingHoursDay;
  sunday?: WorkingHoursDay;
  [key: string]: WorkingHoursDay | undefined;
}

function getDayTimeRanges(
  workingHours: WorkingHoursConfig | null | undefined,
  dayOfWeek: number
): Array<{ start: string; end: string }> {
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayName = dayNames[dayOfWeek];

  if (!workingHours) {
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      return [{ start: "09:00", end: "18:00" }];
    }
    return [];
  }

  const dayConfig = workingHours[dayName];
  if (!dayConfig?.enabled) return [];

  if (dayConfig.ranges && Array.isArray(dayConfig.ranges)) {
    return dayConfig.ranges.filter(r => r.start && r.end);
  }

  if (dayConfig.start && dayConfig.end) {
    return [{ start: dayConfig.start, end: dayConfig.end }];
  }

  return [];
}

function generateTimeSlotsForRanges(
  ranges: Array<{ start: string; end: string }>,
  durationMinutes: number
): string[] {
  const slots: string[] = [];
  for (const range of ranges) {
    const [startH, startM] = range.start.split(':').map(Number);
    const [endH, endM] = range.end.split(':').map(Number);
    const rangeStartMin = startH * 60 + startM;
    const rangeEndMin = endH * 60 + endM;

    let currentMin = rangeStartMin;
    while (currentMin + durationMinutes <= rangeEndMin) {
      const h = Math.floor(currentMin / 60);
      const m = currentMin % 60;
      slots.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
      currentMin += durationMinutes;
    }
  }
  return slots;
}

export async function getAvailableSlotsFromPool(
  poolId: string,
  startDate: Date,
  endDate: Date,
  durationMinutes: number = 60,
  timezone: string = "Europe/Rome",
  workingHours?: WorkingHoursConfig | null,
  bufferBefore: number = 0,
  bufferAfter: number = 0,
  minHoursNotice: number = 0
): Promise<Array<{ date: string; time: string; availableAgents: number; agentNames: string[] }>> {
  const members = await db
    .select({
      id: bookingPoolMembers.id,
      agentConfigId: bookingPoolMembers.agentConfigId,
      agentName: bookingPoolMembers.memberName,
    })
    .from(bookingPoolMembers)
    .where(
      and(
        eq(bookingPoolMembers.poolId, poolId),
        eq(bookingPoolMembers.isActive, true),
        eq(bookingPoolMembers.isPaused, false)
      )
    );

  if (members.length === 0) return [];

  console.log(`📅 [POOL-SLOTS] Checking availability for ${members.length} pool members: ${members.map(m => m.agentName).join(', ')}`);

  const now = new Date();
  const minNoticeDate = new Date(now.getTime() + minHoursNotice * 60 * 60 * 1000);

  const allSlots = new Map<string, { count: number; names: string[] }>();

  for (const member of members) {
    try {
      const calendar = await getMemberCalendarClient({
        agentConfigId: member.agentConfigId,
        memberId: member.id,
      });
      if (!calendar) {
        console.log(`   ⚠️ [POOL-SLOTS] ${member.agentName} has no calendar connected, skipping`);
        continue;
      }

      const calendarId = await getMemberCalendarId({
        agentConfigId: member.agentConfigId,
        memberId: member.id,
      }) || "primary";

      const { data } = await calendar.freebusy.query({
        requestBody: {
          timeMin: startDate.toISOString(),
          timeMax: endDate.toISOString(),
          timeZone: timezone,
          items: [{ id: calendarId }],
        },
      });

      const busySlots = data.calendars?.[calendarId]?.busy || [];
      let memberSlotCount = 0;

      const current = new Date(startDate);
      while (current <= endDate) {
        const dayOfWeek = current.getDay();
        const timeRanges = getDayTimeRanges(workingHours, dayOfWeek);

        if (timeRanges.length > 0) {
          const timeSlots = generateTimeSlotsForRanges(timeRanges, durationMinutes);

          for (const slotTime of timeSlots) {
            const slotDate = current.toISOString().slice(0, 10);
            const slotKey = `${slotDate}|${slotTime}`;

            const slotStart = new Date(`${slotDate}T${slotTime}:00`);
            const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60 * 1000);

            if (slotStart < minNoticeDate) continue;

            const slotStartWithBuffer = new Date(slotStart.getTime() - bufferBefore * 60000);
            const slotEndWithBuffer = new Date(slotEnd.getTime() + bufferAfter * 60000);

            const isBusy = busySlots.some((busy: any) => {
              const busyStart = new Date(busy.start!);
              const busyEnd = new Date(busy.end!);
              return slotStartWithBuffer < busyEnd && slotEndWithBuffer > busyStart;
            });

            if (!isBusy) {
              const existing = allSlots.get(slotKey) || { count: 0, names: [] };
              existing.count += 1;
              if (member.agentName && !existing.names.includes(member.agentName)) {
                existing.names.push(member.agentName);
              }
              allSlots.set(slotKey, existing);
              memberSlotCount++;
            }
          }
        }
        current.setDate(current.getDate() + 1);
      }

      console.log(`   ✅ [POOL-SLOTS] ${member.agentName}: ${memberSlotCount} slot disponibili`);
    } catch (error) {
      console.log(`   ⚠️ [POOL-SLOTS] Could not check calendar for member ${member.agentName} (${member.id})`);
    }
  }

  const result = Array.from(allSlots.entries())
    .map(([key, val]) => {
      const [date, time] = key.split("|");
      return { date, time, availableAgents: val.count, agentNames: val.names };
    })
    .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.time.localeCompare(b.time);
    });

  console.log(`📅 [POOL-SLOTS] Totale: ${result.length} slot unici, copertura media: ${result.length > 0 ? (result.reduce((s, r) => s + r.availableAgents, 0) / result.length).toFixed(1) : 0} agenti/slot`);

  return result;
}
