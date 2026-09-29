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

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const TIME_ZONE = "America/Chicago";
const CHICAGO_WEEKDAY_INDEX: Record<string, number> = {
    Mon: 0,
    Tue: 1,
    Wed: 2,
    Thu: 3,
    Fri: 4,
    Sat: 5,
    Sun: 6,
};

// Matches the backend's America/Chicago Mon=0..Sun=6 day numbering, so
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
                <h1 className="text-xl font-bold text-[#1e3a5f] mb-1">Leads Dashboard</h1>
                <p className="text-sm text-slate-500">
                    Contacts created in JobNimbus, this week vs. last week.
                </p>
            </div>

            {loading && <div className="text-sm text-slate-500">Loading leads data...</div>}

            {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                    {error}
                </div>
            )}

            {data && !loading && !error && (
                <>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                            <div className="text-xs uppercase tracking-wide text-slate-400 mb-1">
                                Leads this week
                            </div>
                            <div className="text-3xl font-bold text-[#1e3a5f]">{data.currentWeekTotal}</div>
                        </div>

                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                            <div className="text-xs uppercase tracking-wide text-slate-400 mb-1">
                                Leads last week
                            </div>
                            <div className="text-3xl font-bold text-slate-700">{data.previousWeekTotal}</div>
                        </div>

                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                            <div className="text-xs uppercase tracking-wide text-slate-400 mb-1">
                                Change vs. last week
                            </div>
                            <div className={`text-3xl font-bold ${isUp ? "text-emerald-600" : "text-red-600"}`}>
                                {isUp ? "+" : ""}
                                {data.percentChange}%
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                        <h2 className="text-sm font-semibold text-slate-700 mb-4">Leads per day</h2>
                        <div style={{ width: "100%", height: 300 }}>
                            <ResponsiveContainer>
                                <BarChart data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                    <XAxis dataKey="day" stroke="#6b7280" fontSize={12} />
                                    <YAxis stroke="#6b7280" fontSize={12} allowDecimals={false} />
                                    <Tooltip />
                                    <Legend />
                                    <Bar dataKey="Last week" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="This week" fill="#1e3a5f" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Day navigator */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                            <h2 className="text-sm font-semibold text-slate-700">Leads list</h2>
                            <div className="flex flex-wrap gap-2">
                                <button
                                    onClick={() => setSelectedDay("all")}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                        selectedDay === "all"
                                            ? "bg-[#1e3a5f] text-white"
                                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
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
                                                ? "bg-[#1e3a5f] text-white"
                                                : i === todayIdx
                                                    ? "bg-blue-50 text-[#1e3a5f] border border-blue-200 hover:bg-blue-100"
                                                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
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
                            <div className="text-sm text-slate-400 py-8 text-center">
                                No leads for this selection.
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                    <tr className="text-left text-xs uppercase tracking-wide text-slate-400 border-b border-slate-200">
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
                                            className="border-b border-slate-100 last:border-0 cursor-pointer hover:bg-slate-50 transition-colors"
                                        >
                                            <td className="py-2 pr-4 font-medium text-slate-700">
                                                {c.firstName} {c.lastName}
                                            </td>
                                            <td className="py-2 pr-4 text-slate-600">{c.email}</td>
                                            <td className="py-2 pr-4 text-slate-600">{c.phone}</td>
                                            <td className="py-2 pr-4 text-slate-600">{c.status}</td>
                                            <td className="py-2 pr-4 text-slate-600">{c.createdBy}</td>
                                            <td className="py-2 pr-4 text-slate-500">{formatTime(c.dateCreated)}</td>
                                            <td className="py-2 pr-2 text-slate-400">
                                                <svg
                                                    xmlns="http://www.w3.org/2000/svg"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth={1.75}
                                                    className="w-4 h-4"
                                                >
                                                    <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        d="M13.5 6H18a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 18 18H7.5A1.5 1.5 0 0 1 6 16.5V12m3-6h5.25v5.25M9 15 18 6"
                                                    />
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