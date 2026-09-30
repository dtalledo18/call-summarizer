"use client";

import { useEffect, useMemo, useState } from "react";
import {
    Bar,
    BarChart,
    CartesianGrid,
    Legend,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";

interface DailyPoint {
    day: string;
    count: number;
}

interface ContactItem {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    status: string;
    createdBy: string;
    dateCreated: string;
    dayIndex: number;
}

interface LeadsData {
    currentWeekTotal: number;
    previousWeekTotal: number;
    percentChange: number;
    dailyCurrent: DailyPoint[];
    dailyPrevious: DailyPoint[];
    currentWeekStart: string;
    contactsCurrentWeek: ContactItem[];
}

const DAY_LABELS = ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"];

const TIME_ZONE = "America/Chicago";
const CHICAGO_WEEKDAY_INDEX: Record<string, number> = {
    Sat: 0,
    Sun: 1,
    Mon: 2,
    Tue: 3,
    Wed: 4,
    Thu: 5,
    Fri: 6,
};

// Matches the backend's America/Chicago Sat=0..Fri=6 day numbering, so
// "today" lines up with the same day bucket the API used — regardless of
// what timezone the viewer's browser is in.
function todayIndexChicago(): number {
    const weekday = new Intl.DateTimeFormat("en-US", {
        timeZone: TIME_ZONE,
        weekday: "short",
    }).format(new Date());
    return CHICAGO_WEEKDAY_INDEX[weekday] ?? 0;
}

function dateLabelForDay(weekStartIso: string, dayIndex: number): string {
    const d = new Date(weekStartIso);
    d.setUTCDate(d.getUTCDate() + dayIndex);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: TIME_ZONE });
}

function jobNimbusContactUrl(id: string): string {
    return `https://app.jobnimbus.com/contact/${id}`;
}

function formatTime(iso: string): string {
    return new Date(iso).toLocaleString("en-US", {
        timeZone: TIME_ZONE,
        weekday: "short",
        hour: "numeric",
        minute: "2-digit",
    });
}

export default function ContactsPage() {
    const [data, setData] = useState<LeadsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedDay, setSelectedDay] = useState<number | "all">(todayIndexChicago());

    useEffect(() => {
        let cancelled = false;

        async function load() {
            setLoading(true);
            setError(null);
            try {
                const res = await fetch("/api/jobnimbus-leads");
                const json = await res.json();
                if (!res.ok) throw new Error(json.error ?? "Something went wrong");
                if (!cancelled) setData(json);
            } catch (err) {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : "Something went wrong");
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        load();
        return () => {
            cancelled = true;
        };
    }, []);

    const chartData =
        data?.dailyCurrent.map((point, i) => ({
            day: point.day,
            "This week": point.count,
            "Last week": data.dailyPrevious[i]?.count ?? 0,
        })) ?? [];

    const isUp = (data?.percentChange ?? 0) >= 0;
    const todayIdx = todayIndexChicago();

    const visibleContacts = useMemo(() => {
        if (!data) return [];
        if (selectedDay === "all") return data.contactsCurrentWeek;
        return data.contactsCurrentWeek.filter((c) => c.dayIndex === selectedDay);
    }, [data, selectedDay]);

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div>
                <h1 className="text-xl font-bold text-white mb-1">Leads Dashboard</h1>
                <p className="text-sm text-gray-400">
                    Contacts created in JobNimbus, this week vs. last week.
                </p>
            </div>

            {loading && <div className="text-sm text-gray-500">Loading leads data...</div>}

            {error && (
                <div className="p-4 bg-red-950/40 border border-red-900 rounded-lg text-sm text-red-300">
                    {error}
                </div>
            )}

            {data && !loading && !error && (
                <>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="bg-[#1a1a1a] rounded-xl border border-[#2a2a2a] p-5">
                            <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">
                                Leads this week
                            </div>
                            <div className="text-3xl font-bold text-white">{data.currentWeekTotal}</div>
                        </div>

                        <div className="bg-[#1a1a1a] rounded-xl border border-[#2a2a2a] p-5">
                            <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">
                                Leads last week
                            </div>
                            <div className="text-3xl font-bold text-gray-300">{data.previousWeekTotal}</div>
                        </div>

                        <div className="bg-[#1a1a1a] rounded-xl border border-[#2a2a2a] p-5">
                            <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">
                                Change vs. last week
                            </div>
                            <div className={`text-3xl font-bold ${isUp ? "text-emerald-400" : "text-red-400"}`}>
                                {isUp ? "+" : ""}
                                {data.percentChange}%
                            </div>
                        </div>
                    </div>

                    <div className="bg-[#1a1a1a] rounded-xl border border-[#2a2a2a] p-5">
                        <h2 className="text-sm font-semibold text-gray-200 mb-4">Leads per day</h2>
                        <div style={{ width: "100%", height: 300 }}>
                            <ResponsiveContainer>
                                <BarChart data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                                    <XAxis dataKey="day" stroke="#9ca3af" fontSize={12} />
                                    <YAxis stroke="#9ca3af" fontSize={12} allowDecimals={false} />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: "#1a1a1a",
                                            border: "1px solid #2a2a2a",
                                            borderRadius: 8,
                                            color: "#e5e7eb",
                                        }}
                                        labelStyle={{ color: "#e5e7eb" }}
                                        itemStyle={{ color: "#e5e7eb" }}
                                        cursor={{ fill: "#ffffff0d" }}
                                    />
                                    <Legend wrapperStyle={{ color: "#9ca3af" }} />
                                    <Bar dataKey="Last week" fill="#3f3f46" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="This week" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Day navigator */}
                    <div className="bg-[#1a1a1a] rounded-xl border border-[#2a2a2a] p-5">
                        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                            <h2 className="text-sm font-semibold text-gray-200">Leads list</h2>
                            <div className="flex flex-wrap gap-2">
                                <button
                                    onClick={() => setSelectedDay("all")}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                        selectedDay === "all"
                                            ? "bg-white text-[#111111]"
                                            : "bg-[#232323] text-gray-400 hover:bg-[#2a2a2a] hover:text-gray-200"
                                    }`}
                                >
                                    All week
                                </button>
                                {DAY_LABELS.map((label, i) => (
                                    <button
                                        key={label}
                                        onClick={() => setSelectedDay(i)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                            selectedDay === i
                                                ? "bg-white text-[#111111]"
                                                : i === todayIdx
                                                    ? "bg-blue-500/10 text-blue-300 border border-blue-500/30 hover:bg-blue-500/20"
                                                    : "bg-[#232323] text-gray-400 hover:bg-[#2a2a2a] hover:text-gray-200"
                                        }`}
                                    >
                                        {i === todayIdx ? "Today" : label}
                                        <span className="ml-1 text-[10px] opacity-70">
                      {dateLabelForDay(data.currentWeekStart, i)}
                    </span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {visibleContacts.length === 0 ? (
                            <div className="text-sm text-gray-500 py-8 text-center">
                                No leads for this selection.
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                    <tr className="text-left text-xs uppercase tracking-wide text-gray-500 border-b border-[#2a2a2a]">
                                        <th className="py-2 pr-4">Name</th>
                                        <th className="py-2 pr-4">Email</th>
                                        <th className="py-2 pr-4">Phone</th>
                                        <th className="py-2 pr-4">Status</th>
                                        <th className="py-2 pr-4">Created By</th>
                                        <th className="py-2 pr-4">Created</th>
                                        <th className="py-2 pr-2 w-8" />
                                    </tr>
                                    </thead>
                                    <tbody>
                                    {visibleContacts.map((c) => (
                                        <tr
                                            key={c.id}
                                            onClick={() => window.open(jobNimbusContactUrl(c.id), "_blank", "noopener,noreferrer")}
                                            title="Abrir en JobNimbus"
                                            className="group border-b border-[#232323] last:border-0 cursor-pointer hover:bg-[#1f1f1f] transition-colors"
                                        >
                                            <td className="py-2 pr-4 font-medium text-gray-100">
                                                {c.firstName} {c.lastName}
                                            </td>
                                            <td className="py-2 pr-4 text-gray-400">{c.email}</td>
                                            <td className="py-2 pr-4 text-gray-400">{c.phone}</td>
                                            <td className="py-2 pr-4 text-gray-400">{c.status}</td>
                                            <td className="py-2 pr-4 text-gray-400">{c.createdBy}</td>
                                            <td className="py-2 pr-4 text-gray-500">{formatTime(c.dateCreated)}</td>
                                            <td className="py-2 pr-2 text-gray-600 group-hover:text-gray-300">
                                                <svg
                                                    xmlns="http://www.w3.org/2000/svg"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth={2}
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    className="w-4 h-4"
                                                >
                                                    <path d="M15 3h6v6" />
                                                    <path d="M10 14 21 3" />
                                                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                                                </svg>
                                            </td>
                                        </tr>
                                    ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}