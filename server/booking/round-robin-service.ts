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

  switch (pool.strategy) {
    case "strict_round_robin": {
      ranked = [...eligible].sort((a, b) => {
        if (a.totalBookingsCount !== b.totalBookingsCount) {
          return a.totalBookingsCount - b.totalBookingsCount;
        }
        const aTime = a.lastAssignedAt ? new Date(a.lastAssignedAt).getTime() : 0;
        const bTime = b.lastAssignedAt ? new Date(b.lastAssignedAt).getTime() : 0;
        return aTime - bTime;
      });
      break;
    }

    case "weighted": {
      const totalWeight = eligible.reduce((sum, m) => sum + m.weight, 0);
      ranked = [...eligible].sort((a, b) => {
        const aExpectedShare = a.weight / totalWeight;
        const bExpectedShare = b.weight / totalWeight;
        const totalAll = eligible.reduce((s, m) => s + m.totalBookingsCount, 0) || 1;
        const aActualShare = a.totalBookingsCount / totalAll;
        const bActualShare = b.totalBookingsCount / totalAll;
        const aDeficit = aExpectedShare - aActualShare;
        const bDeficit = bExpectedShare - bActualShare;
        return bDeficit - aDeficit;
      });
      break;
    }

    case "availability_first": {
      ranked = [...eligible].sort((a, b) => {
        if (a.todayBookingsCount !== b.todayBookingsCount) {
          return a.todayBookingsCount - b.todayBookingsCount;
        }
        return a.totalBookingsCount - b.totalBookingsCount;
      });
      break;
    }

    default:
      ranked = eligible;
  }

  console.log(`   🏆 Ranked order:`);
  ranked.forEach((m, i) => {
    console.log(`      ${i + 1}. ${m.agentName} (weight: ${m.weight}, total: ${m.totalBookingsCount}, today: ${m.todayBookingsCount})`);
  });

  for (const member of ranked) {
    console.log(`   🔍 Checking calendar availability for ${member.agentName}...`);
    const isAvailable = await checkMemberSlotAvailability(
      { agentConfigId: member.agentConfigId, memberId: member.memberId, agentName: member.agentName },
      date,
      time,
      durationMinutes,
      timezone
    );

    if (isAvailable) {
      const score = member.weight / (member.totalBookingsCount + 1);
      console.log(`   ✅ [ROUND-ROBIN] Selected: ${member.agentName} (score: ${score.toFixed(2)})`);

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

export async function getAvailableSlotsFromPool(
  poolId: string,
  startDate: Date,
  endDate: Date,
  durationMinutes: number = 60,
  timezone: string = "Europe/Rome"
): Promise<Array<{ date: string; time: string; availableAgents: number }>> {
  const members = await db
    .select({
      id: bookingPoolMembers.id,
      agentConfigId: bookingPoolMembers.agentConfigId,
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

  const allSlots = new Map<string, number>();

  for (const member of members) {
    try {
      const calendar = await getMemberCalendarClient({
        agentConfigId: member.agentConfigId,
        memberId: member.id,
      });
      if (!calendar) continue;

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

      const current = new Date(startDate);
      while (current <= endDate) {
        const dayOfWeek = current.getDay();
        if (dayOfWeek >= 1 && dayOfWeek <= 5) {
          for (let hour = 9; hour < 18; hour++) {
            const slotDate = current.toISOString().slice(0, 10);
            const slotTime = `${hour.toString().padStart(2, "0")}:00`;
            const slotKey = `${slotDate}|${slotTime}`;

            const slotStart = new Date(`${slotDate}T${slotTime}:00`);
            const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60 * 1000);

            const isBusy = busySlots.some((busy: any) => {
              const busyStart = new Date(busy.start!);
              const busyEnd = new Date(busy.end!);
              return slotStart < busyEnd && slotEnd > busyStart;
            });

            if (!isBusy) {
              allSlots.set(slotKey, (allSlots.get(slotKey) || 0) + 1);
            }
          }
        }
        current.setDate(current.getDate() + 1);
      }
    } catch (error) {
      console.log(`   ⚠️ [ROUND-ROBIN] Could not check calendar for member ${member.id}`);
    }
  }

  return Array.from(allSlots.entries())
    .map(([key, count]) => {
      const [date, time] = key.split("|");
      return { date, time, availableAgents: count };
    })
    .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.time.localeCompare(b.time);
    });
}
