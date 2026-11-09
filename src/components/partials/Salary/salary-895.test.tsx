// TASK-895 — the admin's "Transportation trip" card, wired to TASK-868's routes. Run: `bun test src/components/partials/Salary`.
// No network: axios gets a recording adapter. Each test names the code whose removal makes it fail.
import { afterEach, describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { MantineProvider } from "@mantine/core";
import { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { api, ApiClientError } from "@/lib/api/client";
import { createTrip, listEntryPeople, listTransportSchools } from "@/services/salary.service";
import { TripDetailTable } from "./Entries";
import { errorMessage } from "./parts";

const realAdapter = api.defaults.adapter;
afterEach(() => {
  api.defaults.adapter = realAdapter;
});

function stub(answer: (c: InternalAxiosRequestConfig) => { status: number; data: unknown }) {
  const seen: InternalAxiosRequestConfig[] = [];
  api.defaults.adapter = async (config) => {
    seen.push(config);
    const { status, data } = answer(config);
    const response = { status, data, statusText: "", headers: {}, config };
    if (status >= 400) throw new AxiosError(`HTTP ${status}`, "ERR_BAD_REQUEST", config, null, response);
    return response;
  };
  return seen;
}
const ui = (el: React.ReactElement) => renderToStaticMarkup(<MantineProvider>{el}</MantineProvider>);

const INPUT = { teacherId: "11111111-1111-4111-8111-111111111111", date: "2026-10-14", schoolId: "22222222-2222-4222-8222-222222222222", roundTrip: true };
const LEAKY = {
  id: "trip-1",
  teacherId: INPUT.teacherId,
  date: "2026-10-14",
  schoolId: INPUT.schoolId,
  schoolName: "โรงเรียนสาธิต",
  roundTrip: true,
  km: 12.5,
  note: null,
  // a misbehaving server: none of this may reach an admin's screen
  vehicle: "motorbike-SECRET",
  amountSatang: 98_765_43,
};

describe("Transportation trip (admin-blind)", () => {
  test("the request body has no vehicle and no km, and goes to the transport trips route", async () => {
    const seen = stub(() => ({ status: 201, data: LEAKY }));
    await createTrip({ ...INPUT, vehicle: "car", km: 99 } as typeof INPUT);
    expect(seen[0].url).toBe("/v1/salary/transport/trips");
    const body = JSON.parse(String(seen[0].data));
    expect(Object.keys(body).sort()).toEqual(["date", "roundTrip", "schoolId", "teacherId"]);
  });

  test("the 201 is cut to the trip itself; the Detail list shows no amount and no vehicle, even from a leaky response", async () => {
    stub(() => ({ status: 201, data: LEAKY }));
    const trip = await createTrip(INPUT);
    expect(Object.keys(trip).sort()).toEqual(["date", "id", "km", "roundTrip", "schoolName"]);
    const html = ui(<TripDetailTable rows={[{ person: "ต้น", trip }]} />);
    expect(html).toContain("โรงเรียนสาธิต");
    expect(html).toContain("14/10/26");
    expect(html).toContain("Round trip");
    expect(html).toContain("12.5");
    for (const secret of ["SECRET", "987,654.30", "9876543", "98765"]) expect(html).not.toContain(secret);
  });

  test("the schools come from the route, and an inactive school is absent", async () => {
    const seen = stub(() => ({
      status: 200,
      data: [
        { id: "a", name: "โรงเรียน ก", distanceKm: 10, active: true },
        { id: "b", name: "โรงเรียน ข (ปิด)", distanceKm: 20, active: false },
      ],
    }));
    const schools = await listTransportSchools();
    expect(seen[0].url).toBe("/v1/salary/transport/schools");
    expect(schools.map((s) => s.name)).toEqual(["โรงเรียน ก"]);
  });

  for (const [status, code, sentence] of [
    [409, "LOCKED", "งวดนี้ถูกล็อกแล้ว"],
    [400, "VALIDATION", "schoolId: โรงเรียนนี้ปิดใช้งานแล้ว"],
    [404, "NOT_FOUND", "ไม่พบโรงเรียน"],
  ] as const) {
    test(`${status} ${code}: the server's own sentence is what the toast shows`, async () => {
      stub(() => ({ status, data: { error: { code, message: sentence } } }));
      let caught: unknown;
      try {
        await createTrip(INPUT);
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(ApiClientError);
      expect(errorMessage(caught)).toBe(sentence);
    });
  }

  test('"No Teacher" is absent from the Person list the trip card uses', async () => {
    stub(() => ({
      status: 200,
      data: [
        { teacherId: "a", name: "ต้น" },
        { teacherId: "sys", name: "No Teacher", isSystem: true },
      ],
    }));
    expect((await listEntryPeople()).map((p) => p.name)).toEqual(["ต้น"]);
  });
});
