import { api } from "@/lib/api/client";
import { activeSchools, pickablePeople, toEntryLine, toTripEntry } from "@/components/partials/Salary/entries-logic";
import type {
  AddLineInput,
  EntryInput,
  EntryLine,
  EntryPerson,
  MySlipData,
  MySlipResponse,
  PayPeriod,
  PeriodOverview,
  RunResult,
  Slip,
  SlipLine,
  TransportSchool,
  TripEntry,
  TripInput,
} from "@/types/app/salary";

// SPEC-100 §5. `api` already ends in `/api`, so the paths start at `/v1/salary`. Bodies are the bare objects the SPEC lists.
const BASE = "/v1/salary";

export async function listPeriods(): Promise<PayPeriod[]> {
  const { data } = await api.get<PayPeriod[]>(`${BASE}/periods`);
  return data;
}

export async function createPeriod(input: { year: number; month: number }): Promise<PayPeriod> {
  const { data } = await api.post<PayPeriod>(`${BASE}/periods`, input);
  return data;
}

export async function runPeriod(periodId: string): Promise<RunResult> {
  const { data } = await api.post<RunResult>(`${BASE}/periods/${periodId}/run`);
  return data;
}

export async function getOverview(periodId: string): Promise<PeriodOverview> {
  const { data } = await api.get<PeriodOverview>(`${BASE}/periods/${periodId}`);
  return data;
}

export async function lockPeriod(periodId: string): Promise<PayPeriod> {
  const { data } = await api.post<PayPeriod>(`${BASE}/periods/${periodId}/lock`);
  return data;
}

export async function getSlip(slipId: string): Promise<Slip> {
  const { data } = await api.get<Slip>(`${BASE}/slips/${slipId}`);
  return data;
}

export async function addLine(slipId: string, input: AddLineInput): Promise<SlipLine> {
  const { data } = await api.post<SlipLine>(`${BASE}/slips/${slipId}/lines`, input);
  return data;
}

export async function removeLine(slipId: string, lineId: string): Promise<void> {
  await api.delete(`${BASE}/slips/${slipId}/lines/${lineId}`);
}

// ---- TASK-882 / SPEC-102 ----

/** The coach's own slip: the query carries ONLY year + month. The server takes the teacher from the token, so no teacher id is ever sent. */
export const mySlipParams = (year: number, month: number) => ({ year, month });

export async function getMySlip(year: number, month: number): Promise<MySlipResponse> {
  const { data } = await api.get<MySlipResponse>(`${BASE}/my-slip`, { params: mySlipParams(year, month) });
  return data;
}

/** TASK-902 / SPEC-102 §5-E4a — the confirm body is ONLY `{ year, month }`: the slip is the caller's own, taken from the token, so no teacher id is ever sent. */
export const confirmMySlipBody = (year: number, month: number) => ({ year, month });

/** The coach confirms their OWN slip (draft → confirmed). 200 = the my-slip DTO with `status: "confirmed"` (a re-confirm is 200 too); 409 LOCKED · 404 NO_SLIP · 403 NO_TEACHER reject. */
export async function confirmMySlip(year: number, month: number): Promise<MySlipData> {
  const { data } = await api.post<MySlipData>(`${BASE}/my-slip/confirm`, confirmMySlipBody(year, month));
  return data;
}

/** The admin-blind entry (§5-E2): whatever the response carries, only the typed line comes out. */
export async function createEntry(input: EntryInput): Promise<EntryLine> {
  const { data } = await api.post<unknown>(`${BASE}/entries`, input);
  return toEntryLine(data);
}

/**
 * The people an admin may pick: `GET /salary/entries/people` (SPEC-102 §5-E2b, TASK-886) → `[{teacherId, name, meritEligible}]`, no pay,
 * "No Teacher" already left out by the back. `pickablePeople` re-checks the `isSystem` flag where the list is read, as a backstop.
 */
export async function listEntryPeople(): Promise<EntryPerson[]> {
  const { data } = await api.get<EntryPerson[]>(`${BASE}/entries/people`);
  return pickablePeople(data);
}

/** TASK-895 / TASK-868: schools for the Transportation card (active ones only). */
export async function listTransportSchools(): Promise<TransportSchool[]> {
  const { data } = await api.get<TransportSchool[]>(`${BASE}/transport/schools`);
  return activeSchools(data);
}

/** An admin's trip: the body carries teacher, date, school and trip type ONLY (no km, never a vehicle); the 201 is cut to what the screen shows. */
export async function createTrip(input: TripInput): Promise<TripEntry> {
  const body: TripInput = { teacherId: input.teacherId, date: input.date, schoolId: input.schoolId, roundTrip: input.roundTrip };
  const { data } = await api.post<unknown>(`${BASE}/transport/trips`, body);
  return toTripEntry(data);
}

/** The period CSV. Fetched with the bearer token (an <a href> cannot send it), then saved from a blob. */
export async function exportPeriodCsv(periodId: string, filename: string): Promise<void> {
  const res = await api.get<Blob>(`${BASE}/periods/${periodId}/export`, { responseType: "blob" });
  const url = URL.createObjectURL(res.data);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
