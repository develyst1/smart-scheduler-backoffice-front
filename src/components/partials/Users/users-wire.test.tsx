// The logins WIRED to TASK-930 AS DEPLOYED (backoffice-back `routes/users.ts`): the request each call sends and how the real answers become the screen's rows and field errors. No network: axios gets a recording adapter.
// Run: `bun test src/components/partials/Users`. 🔐 No call here has a password: the person signs in with their front-office password. Each test names the code whose removal makes it fail.
import { afterEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { api, ApiClientError } from "@/lib/api/client";
import { USERS_SOURCE, admitLogin, deactivateLogin, listLogins, reactivateLogin } from "@/services/users.service";
import { fieldErrorsFromServer } from "./logins-logic";

const realAdapter = api.defaults.adapter;
let left: "fixture" | "api" | null = null;
afterEach(() => {
  api.defaults.adapter = realAdapter;
  if (left) USERS_SOURCE.users = left;
  left = null;
});

/** The live branch on for the test, whatever another file left behind; every request is recorded. */
function live(answer: (c: InternalAxiosRequestConfig) => { status: number; data: unknown }) {
  left = USERS_SOURCE.users;
  USERS_SOURCE.users = "api";
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
const body = (c: InternalAxiosRequestConfig) => JSON.parse(String(c.data));
const env = (status: number, code: string, message: string, details?: unknown) => ({ status, data: { error: { code, message, ...(details !== undefined ? { details } : {}) } } });
const TON = "11111111-1111-4111-8111-111111111111";
const ROW = { id: "b1", username: "khwan", role: "admin", teacherId: null, active: true, admitted: true, createdAt: "2026-11-09T03:00:00.000Z" };

describe("shipped switch", () => {
  test("the logins ship wired (api) — read from the source, not from the live object; the Sample notice is keyed on the flag", () => {
    expect(readFileSync("src/services/users.service.ts", "utf8")).toContain('{ users: "api" }');
    expect(readFileSync("src/components/partials/Users/Logins.tsx", "utf8")).toContain('USERS_SOURCE.users === "fixture"');
  });
});

describe("list → GET /v1/users", () => {
  test("the deployed answer is a bare array: kept as it is (admitted flag too), sorted by username", async () => {
    const seen = live(() => ({ status: 200, data: [{ ...ROW, username: "zed" }, { ...ROW, id: "b2", username: "amy", admitted: false }] }));
    const rows = await listLogins("ceo");
    expect(seen[0].url).toBe("/v1/users");
    expect(seen[0].method).toBe("get");
    expect(rows.map((r) => r.username)).toEqual(["amy", "zed"]);
    expect(rows[0].admitted).toBe(false);
  });

  test("a `{ items }` answer is accepted too; anything else is an empty list, not a crash", async () => {
    live(() => ({ status: 200, data: { items: [ROW] } }));
    expect((await listLogins("ceo")).map((r) => r.username)).toEqual(["khwan"]);
    live(() => ({ status: 200, data: { nope: true } }));
    expect(await listLogins("ceo")).toEqual([]);
    live(() => ({ status: 200, data: null }));
    expect(await listLogins("ceo")).toEqual([]);
  });
});

describe("admit → POST /v1/users", () => {
  test("sends exactly username + role (trimmed): NO password key, and a teacherId never goes with an admin", async () => {
    const seen = live(() => ({ status: 201, data: ROW }));
    const made = await admitLogin({ username: "  khwan ", role: "admin", teacherId: TON }, "ceo");
    expect(seen[0].url).toBe("/v1/users");
    expect(seen[0].method).toBe("post");
    expect(body(seen[0])).toEqual({ username: "khwan", role: "admin" });
    expect(JSON.stringify(body(seen[0]))).not.toMatch(/password/i);
    expect(made.id).toBe("b1");
  });

  test("a coach sends the person only when one was picked (otherwise the back end uses the front office's own link)", async () => {
    const seen = live(() => ({ status: 201, data: { ...ROW, role: "coach", teacherId: TON } }));
    await admitLogin({ username: "ton", role: "coach" }, "ceo");
    await admitLogin({ username: "ton", role: "coach", teacherId: TON }, "ceo");
    expect(body(seen[0])).toEqual({ username: "ton", role: "coach" });
    expect(body(seen[1])).toEqual({ username: "ton", role: "coach", teacherId: TON });
  });
});

describe("the real refusals → the right field", () => {
  const refuse = async (status: number, code: string, message: string, details?: unknown, input = { username: "ton", role: "coach" as const }) => {
    live(() => env(status, code, message, details));
    const err = await admitLogin(input, "ceo").catch((e) => e);
    return { err, ...fieldErrorsFromServer(err) };
  };

  test("404 NOT_FOUND (not in the front office) and 409 ALREADY_ADMITTED land on the username field", async () => {
    expect((await refuse(404, "NOT_FOUND", "ไม่พบผู้ใช้นี้ในระบบหน้าบ้าน")).fields).toEqual({ username: "ไม่พบผู้ใช้นี้ในระบบหน้าบ้าน" });
    expect((await refuse(409, "ALREADY_ADMITTED", "ผู้ใช้นี้ถูกเพิ่มในหลังบ้านแล้ว")).fields).toEqual({ username: "ผู้ใช้นี้ถูกเพิ่มในหลังบ้านแล้ว" });
  });

  test("a coach whose front-office row has no teacher: the 400 «โค้ชต้องระบุ teacherId» names details.field = teacherId, so the screen asks for the person", async () => {
    const r = await refuse(400, "VALIDATION", "โค้ชต้องระบุ teacherId", { field: "teacherId" });
    expect(r.fields).toEqual({ teacherId: "โค้ชต้องระบุ teacherId" });
    expect(r.needsPerson).toBe(true);
    expect(r.rest).toBeNull();
  });

  test("every admit 400 lands on the field the server names: teacherId, role (bad role / the CEO role), username (too short / disabled in the front office)", async () => {
    expect((await refuse(400, "VALIDATION", "teacherId ไม่ถูกต้อง", { field: "teacherId" })).fields.teacherId).toBeDefined();
    expect((await refuse(400, "VALIDATION", "role ต้องเป็น admin หรือ coach", { field: "role" })).fields.role).toBeDefined();
    expect((await refuse(400, "VALIDATION", "ไม่สามารถเพิ่มผู้ใช้เป็น CEO ได้", { field: "role" })).fields.role).toBeDefined();
    expect((await refuse(400, "VALIDATION", "ชื่อผู้ใช้ไม่ถูกต้อง", { field: "username" })).fields.username).toBeDefined();
    expect((await refuse(400, "VALIDATION", "ผู้ใช้นี้ถูกปิดใช้งานในระบบหน้าบ้าน", { field: "username" })).fields.username).toBeDefined();
  });

  test("NO guessing: a 400 without details.field stays one general message, even when its sentence mentions teacherId; another status passes through", async () => {
    const odd = await refuse(400, "VALIDATION", "โค้ชต้องระบุ teacherId");
    expect(odd.fields).toEqual({});
    expect(odd.needsPerson).toBe(false);
    expect(odd.rest).toBe("โค้ชต้องระบุ teacherId");
    const forbidden = await refuse(403, "FORBIDDEN", "ไม่มีสิทธิ์");
    expect(forbidden.err.status).toBe(403);
    expect(forbidden.rest).toBe("ไม่มีสิทธิ์");
  });

  test("the error the screen reads is the one the shared client built, details and all (the seam adds nothing to it)", async () => {
    live(() => env(400, "VALIDATION", "โค้ชต้องระบุ teacherId", { field: "teacherId" }));
    const err = await admitLogin({ username: "ton", role: "coach" }, "ceo").catch((e) => e);
    expect(err).toBeInstanceOf(ApiClientError);
    expect(err.details).toEqual({ field: "teacherId" });
  });
});

describe("deactivate / reactivate → POST /v1/users/:id/…", () => {
  test("each posts to its own route with no body and returns the row", async () => {
    const seen = live((c) => ({ status: 200, data: { ...ROW, active: !String(c.url).endsWith("/deactivate") } }));
    expect((await deactivateLogin("b1", "ceo")).active).toBe(false);
    expect((await reactivateLogin("b1", "ceo")).active).toBe(true);
    expect(seen.map((s) => s.url)).toEqual(["/v1/users/b1/deactivate", "/v1/users/b1/reactivate"]);
    expect(seen.every((s) => s.method === "post" && s.data === undefined)).toBe(true);
  });

  test("the id is path-encoded; the CEO row is refused 400 and its sentence surfaces; an unknown login is 404", async () => {
    const seen = live(() => ({ status: 200, data: ROW }));
    await deactivateLogin("a/b", "ceo");
    expect(seen[0].url).toBe("/v1/users/a%2Fb/deactivate");
    live(() => env(400, "VALIDATION", "ไม่สามารถปิดใช้งานบัญชี CEO ได้"));
    const ceo = await deactivateLogin("c1", "ceo").catch((e) => e);
    expect(ceo.status).toBe(400);
    expect(fieldErrorsFromServer(ceo).rest).toBe("ไม่สามารถปิดใช้งานบัญชี CEO ได้");
    live(() => env(404, "NOT_FOUND", "ไม่พบผู้ใช้"));
    expect(((await reactivateLogin("zz", "ceo").catch((e) => e)) as ApiClientError).status).toBe(404);
  });
});

describe("who may call it", () => {
  test("only the CEO: an admin, a coach and a signed-out caller are refused 403 before any request", async () => {
    const seen = live(() => ({ status: 200, data: [ROW] }));
    for (const role of ["admin", "coach", null] as const) {
      expect(((await listLogins(role).catch((e) => e)) as ApiClientError).status).toBe(403);
      expect(((await admitLogin({ username: "x", role: "admin" }, role).catch((e) => e)) as ApiClientError).status).toBe(403);
      expect(((await deactivateLogin("b1", role).catch((e) => e)) as ApiClientError).status).toBe(403);
      expect(((await reactivateLogin("b1", role).catch((e) => e)) as ApiClientError).status).toBe(403);
    }
    expect(seen).toHaveLength(0);
  });
});
