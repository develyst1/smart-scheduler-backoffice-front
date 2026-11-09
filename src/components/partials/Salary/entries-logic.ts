import type { EntryLine, EntryPerson, TransportSchool, TripEntry } from "@/types/app/salary";

// Pure rules for the admin-blind Entries screen (SPEC-102 §5-E2, REQ-120 R0.3), kept free of React so they are unit-tested.

/** The picker never lists the "No Teacher" placeholder (`is_system`, TASK-861). TASK-886 already leaves it out; this flag check is the backstop where the list is read. */
export function pickablePeople(rows: readonly EntryPerson[] | null | undefined): EntryPerson[] {
  return (rows ?? []).filter((p) => !p.isSystem);
}

/**
 * The ONLY keys an admin's screen may keep from the create response: the line they typed. Anything else the server might send
 * (a total, the base, other lines, a rate) is dropped here, so no later render can show it. Returns the five keys, nothing more.
 */
export function toEntryLine(raw: unknown): EntryLine {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    lineId: String(r.lineId ?? ""),
    kind: r.kind as EntryLine["kind"],
    kindLabel: String(r.kindLabel ?? ""),
    label: String(r.label ?? ""),
    amountSatang: Number(r.amountSatang),
  };
}

// ---- TASK-895: Transportation trip (admin-blind, TASK-868 routes) ----

/** The School select offers active schools only. */
export function activeSchools(rows: readonly TransportSchool[] | null | undefined): TransportSchool[] {
  return (rows ?? []).filter((s) => s.active === true);
}

/** The select's own words for the trip type; the toast and the Detail list use the same two. */
export const tripWord = (roundTrip: boolean): string => (roundTrip ? "Round trip" : "One way");

/**
 * The ONLY keys an admin's screen keeps from the trip 201. An amount, a vehicle or anything else the server might send
 * (a misbehaving one) is dropped here, so no later render can show it.
 */
export function toTripEntry(raw: unknown): TripEntry {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    id: String(r.id ?? ""),
    date: String(r.date ?? ""),
    schoolName: String(r.schoolName ?? ""),
    roundTrip: r.roundTrip === true,
    km: Number(r.km),
  };
}
