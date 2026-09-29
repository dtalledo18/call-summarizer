import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const JOBNIMBUS_API_URL = "https://app.jobnimbus.com/api1/contacts";
const JOBNIMBUS_API_KEY = process.env.JOBNIMBUS_API_KEY!;
const TIME_ZONE = "America/Chicago";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const WEEKDAY_INDEX: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
};

interface JobNimbusContact {
    jnid: string;
    date_created?: number;
    first_name?: string;
    last_name?: string;
    email?: string;
    mobile_phone?: string;
    home_phone?: string;
    status_name?: string;
}

interface ContactItem {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    status: string;
    dateCreated: string; // ISO
    dayIndex: number; // 0 = Monday ... 6 = Sunday, in America/Chicago
}

interface YMD {
    year: number;
    month: number; // 1-12
    day: number;
}

// ─── Timezone helpers (America/Chicago, DST-safe) ──────────────────────────

function chicagoDateParts(utcMillis: number): YMD & { weekday: string } {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: TIME_ZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        weekday: "short",
    }).formatToParts(new Date(utcMillis));

    const map: Record<string, string> = {};
    for (const p of parts) map[p.type] = p.value;

    return {
        year: Number(map.year),
        month: Number(map.month),
        day: Number(map.day),
        weekday: map.weekday,
    };
}

// Offset (in minutes) between America/Chicago wall-clock time and UTC, at a
// given instant. Negative because Chicago is behind UTC. Relies on the
// server process running with TZ=UTC (Vercel's Node functions default to
// this), which is what makes the round-trip through toLocaleString exact.
function chicagoOffsetMinutesAt(utcMillis: number): number {
    const date = new Date(utcMillis);
    const tzString = date.toLocaleString("en-US", { timeZone: TIME_ZONE });
    const utcString = date.toLocaleString("en-US", { timeZone: "UTC" });
    const tzDate = new Date(tzString);
    const utcDate = new Date(utcString);
    return (tzDate.getTime() - utcDate.getTime()) / 60000;
}

// The UTC instant corresponding to local midnight (00:00) in Chicago on a
// given calendar date. DST-safe because the offset is recomputed for that
// specific date rather than reused from "now".
function chicagoMidnightUTCMillis(ymd: YMD): number {
    const guess = Date.UTC(ymd.year, ymd.month - 1, ymd.day);
    const offsetMinutes = chicagoOffsetMinutesAt(guess);
    return guess - offsetMinutes * 60000;
}

// Pure calendar-date arithmetic (no timezone involved) — safe to add/subtract
// days without DST throwing things off.
function addDays(ymd: YMD, delta: number): YMD {
    const d = new Date(Date.UTC(ymd.year, ymd.month - 1, ymd.day));
    d.setUTCDate(d.getUTCDate() + delta);
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

function daysBetween(a: YMD, b: YMD): number {
    const utcA = Date.UTC(a.year, a.month - 1, a.day);
    const utcB = Date.UTC(b.year, b.month - 1, b.day);
    return Math.round((utcB - utcA) / 86400000);
}

function startOfWeekChicago(nowMillis: number): { millis: number; ymd: YMD } {
    const { year, month, day, weekday } = chicagoDateParts(nowMillis);
    const weekdayIndex = WEEKDAY_INDEX[weekday] ?? 0;
    const diffToMonday = weekdayIndex === 0 ? -6 : 1 - weekdayIndex;
    const monday = addDays({ year, month, day }, diffToMonday);
    return { millis: chicagoMidnightUTCMillis(monday), ymd: monday };
}

function toContactItem(record: JobNimbusContact, weekMonday: YMD): ContactItem {
    const t = record.date_created!;
    const contactYMD = chicagoDateParts(t * 1000);
    return {
        id: record.jnid,
        firstName: record.first_name?.trim() || "N/A",
        lastName: record.last_name?.trim() || "N/A",
        email: record.email?.toLowerCase().trim() || "N/A",
        phone: record.mobile_phone || record.home_phone || "N/A",
        status: record.status_name || "N/A",
        dateCreated: new Date(t * 1000).toISOString(),
        dayIndex: daysBetween(weekMonday, contactYMD),
    };
}

// ─── JobNimbus fetch ─────────────────────────────────────────────────────────

// JobNimbus is paginated and sorted desc by date_created here, so we page
// through it and stop as soon as we pass the oldest date we care about —
// no need to pull the entire contacts history every time.
async function fetchContactsSince(cutoffEpochSeconds: number): Promise<JobNimbusContact[]> {
    const collected: JobNimbusContact[] = [];
    const pageSize = 200;
    let from = 0;
    let keepGoing = true;

    while (keepGoing) {
        const url = `${JOBNIMBUS_API_URL}?size=${pageSize}&from=${from}&sort_field=date_created&sort_direction=desc`;
        console.log("[jobnimbus-leads] fetching page:", { from, pageSize });

        const res = await fetch(url, {
            headers: {
                Authorization: `Bearer ${JOBNIMBUS_API_KEY}`,
                "Content-Type": "application/json",
            },
            cache: "no-store",
        });

        if (!res.ok) {
            const text = await res.text().catch(() => "");
            console.error("[jobnimbus-leads] JobNimbus API error:", res.status, text);
            throw new Error(`JobNimbus API error: ${res.status}`);
        }

        const data = await res.json();
        const results: JobNimbusContact[] = data.results ?? [];

        if (results.length === 0) {
            keepGoing = false;
            break;
        }

        let hitCutoff = false;
        for (const record of results) {
            if (!record.date_created) continue;
            if (record.date_created < cutoffEpochSeconds) {
                // Sorted desc by date_created, so everything after this is older too.
                hitCutoff = true;
                break;
            }
            collected.push(record);
        }

        if (hitCutoff || results.length < pageSize) {
            keepGoing = false;
        } else {
            from += pageSize;
        }
    }

    return collected;
}

export async function GET() {
    try {
        if (!JOBNIMBUS_API_KEY) {
            console.error("[jobnimbus-leads] missing JOBNIMBUS_API_KEY");
            return NextResponse.json({ error: "Missing JOBNIMBUS_API_KEY" }, { status: 500 });
        }

        const now = Date.now();
        const { millis: currentWeekStartMillis, ymd: currentWeekMonday } = startOfWeekChicago(now);
        const previousWeekMonday = addDays(currentWeekMonday, -7);
        const previousWeekStartMillis = chicagoMidnightUTCMillis(previousWeekMonday);

        const currentWeekStartEpoch = Math.floor(currentWeekStartMillis / 1000);
        const previousWeekStartEpoch = Math.floor(previousWeekStartMillis / 1000);

        console.log("[jobnimbus-leads] week boundaries (America/Chicago)", {
            previousWeekStart: new Date(previousWeekStartMillis).toISOString(),
            currentWeekStart: new Date(currentWeekStartMillis).toISOString(),
            now: new Date(now).toISOString(),
        });

        const contacts = await fetchContactsSince(previousWeekStartEpoch);
        console.log("[jobnimbus-leads] contacts fetched:", contacts.length);

        let currentWeekTotal = 0;
        let previousWeekTotal = 0;
        const dailyCurrent = Array(7).fill(0);
        const dailyPrevious = Array(7).fill(0);
        const contactsCurrentWeek: ContactItem[] = [];

        for (const contact of contacts) {
            const t = contact.date_created;
            if (!t) continue;

            if (t >= currentWeekStartEpoch) {
                const item = toContactItem(contact, currentWeekMonday);
                currentWeekTotal++;
                if (item.dayIndex >= 0 && item.dayIndex < 7) dailyCurrent[item.dayIndex]++;
                contactsCurrentWeek.push(item);
            } else if (t >= previousWeekStartEpoch) {
                const item = toContactItem(contact, previousWeekMonday);
                previousWeekTotal++;
                if (item.dayIndex >= 0 && item.dayIndex < 7) dailyPrevious[item.dayIndex]++;
            }
        }

        // Most recent first within each day
        contactsCurrentWeek.sort((a, b) => (a.dateCreated < b.dateCreated ? 1 : -1));

        const percentChange =
            previousWeekTotal === 0
                ? currentWeekTotal > 0
                    ? 100
                    : 0
                : Math.round(((currentWeekTotal - previousWeekTotal) / previousWeekTotal) * 100);

        console.log("[jobnimbus-leads] totals", { currentWeekTotal, previousWeekTotal, percentChange });

        return NextResponse.json({
            currentWeekTotal,
            previousWeekTotal,
            percentChange,
            dailyCurrent: dailyCurrent.map((count, i) => ({ day: DAY_LABELS[i], count })),
            dailyPrevious: dailyPrevious.map((count, i) => ({ day: DAY_LABELS[i], count })),
            currentWeekStart: new Date(currentWeekStartMillis).toISOString(),
            previousWeekStart: new Date(previousWeekStartMillis).toISOString(),
            contactsCurrentWeek,
        });
    } catch (error) {
        console.error("[jobnimbus-leads] unhandled error:", error);
        return NextResponse.json(
            {
                error: "Internal Server Error",
                details: error instanceof Error ? error.message : String(error),
            },
            { status: 500 }
        );
    }
}