// TASK-931 — the back-office logins, option 2 (SPEC-097 §3 "same login"): ADMIT an existing front-office person with a role · Deactivate · Reactivate · the list. On the fixture seam (TASK-930 is not deployed).
// Run: `bun test src/components/partials/Users`. 🔐 There is NO password anywhere in this feature: the person signs in with their front-office password. Each test names the code whose removal makes it fail.
import { afterEach, describe, expect, test as bunTest } from "bun:test";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { MantineProvider } from "@mantine/core";
import { ApiClientError } from "@/lib/api/client";
import { canOpen, menuFor, ruleFor } from "@/lib/roles/pages";
import { USERS_SOURCE, admitLogin, deactivateLogin, listLogins, reactivateLogin, resetUsersFixture } from "@/services/users.service";
import { LoginsTable } from "./Logins";
import { MSG, canDeactivate, canReactivate, fieldErrorsFromServer, personName, toAdmitInput, validateAdmit } from "./logins-logic";
import type { LoginUser } from "@/types/app/users";

const ui = (el: React.ReactElement) => renderToStaticMarkup(<MantineProvider>{el}</MantineProvider>);
const TON = "11111111-1111-4111-8111-111111111111";
const NID = "22222222-2222-4222-8222-222222222222";
const fail = (p: Promise<unknown>) => p.then(() => null, (e) => e as ApiClientError);
afterEach(() => resetUsersFixture());

// The shipped switch is "api" (wired to TASK-930 as deployed). These tests read the FIXTURE branch, so each flips it and puts it back; the API branch is in users-wire.test.tsx.
const test = (name: string, fn: () => void | Promise<void>) =>
  bunTest(name, async () => {
    const before = USERS_SOURCE.users;
    USERS_SOURCE.users = "fixture";
    try {
      await fn();
    } finally {
      USERS_SOURCE.users = before;
    }
  });

describe("admit → list", () => {
  test("an admitted person shows up in the list, active, by username; the answer and the list carry NO password and no hash", async () => {
    const made = await admitLogin({ username: "  nok  ", role: "admin" }, "ceo");
    expect(made.username).toBe("nok");
    expect(made.active).toBe(true);
    const rows = await listLogins("ceo");
    expect(rows.map((r) => r.username)).toEqual(["kung", "mali", "nok", "phin", "ton"]);
    for (const out of [JSON.stringify(made), JSON.stringify(rows)]) expect(out).not.toMatch(/password|hash/i);
    expect(Object.keys(made).sort()).toEqual(["active", "createdAt", "id", "role", "teacherId", "username"]);
  });

  test("a coach takes the teacher from the front-office row (nid has one); an explicit teacherId is not needed", async () => {
    expect((await admitLogin({ username: "nid", role: "coach" }, "ceo")).teacherId).toBe(NID);
  });

  test("a coach whose front-office row has NO teacher is 400 on teacherId until one is sent; with one it is admitted", async () => {
    const e = await fail(admitLogin({ username: "nok", role: "coach" }, "ceo"));
    expect(e?.status).toBe(400);
    expect((e?.details as { field: string }).field).toBe("teacherId");
    expect((await admitLogin({ username: "nok", role: "coach", teacherId: TON }, "ceo")).teacherId).toBe(TON);
  });

  test("an admin never carries a teacher (one sent with an admin is dropped)", async () => {
    expect((await admitLogin({ username: "bee", role: "admin", teacherId: TON }, "ceo")).teacherId).toBeNull();
  });

  test("a username the front office does not have is 404 FO_USER_NOT_FOUND, and nothing is added", async () => {
    const e = await fail(admitLogin({ username: "ghost", role: "admin" }, "ceo"));
    expect(e?.status).toBe(404);
    expect(e?.code).toBe("FO_USER_NOT_FOUND");
    expect(await listLogins("ceo")).toHaveLength(4);
  });

  test("an already-admitted person (any case) is 409 ALREADY_ADMITTED", async () => {
    const e = await fail(admitLogin({ username: "KUNG", role: "admin" }, "ceo"));
    expect(e?.status).toBe(409);
    expect(e?.code).toBe("ALREADY_ADMITTED");
    expect(await listLogins("ceo")).toHaveLength(4);
  });

  test("an empty username and a role other than admin/coach are 400 on their field", async () => {
    expect(((await fail(admitLogin({ username: "  ", role: "admin" }, "ceo")))?.details as { field: string }).field).toBe("username");
    expect(((await fail(admitLogin({ username: "nok", role: "ceo" as never }, "ceo")))?.details as { field: string }).field).toBe("role");
  });
});

describe("deactivate / reactivate", () => {
  test("deactivate keeps the login in the list, marked inactive (never removed); an unknown one is 404", async () => {
    expect((await deactivateLogin("u3", "ceo")).active).toBe(false);
    const rows = await listLogins("ceo");
    expect(rows).toHaveLength(4);
    expect(rows.find((r) => r.id === "u3")?.active).toBe(false);
    expect((await fail(deactivateLogin("nope", "ceo")))?.status).toBe(404);
  });

  test("reactivate brings a deactivated login back; an unknown one is 404", async () => {
    expect((await reactivateLogin("u4", "ceo")).active).toBe(true);
    expect((await listLogins("ceo")).find((r) => r.id === "u4")?.active).toBe(true);
    expect((await fail(reactivateLogin("nope", "ceo")))?.status).toBe(404);
  });
});

describe("CEO only", () => {
  test("an admin, a coach and a signed-out caller are refused 403 on every call", async () => {
    for (const role of ["admin", "coach", null] as const) {
      expect((await fail(listLogins(role)))?.status).toBe(403);
      expect((await fail(admitLogin({ username: "nok", role: "admin" }, role)))?.status).toBe(403);
      expect((await fail(deactivateLogin("u3", role)))?.status).toBe(403);
      expect((await fail(reactivateLogin("u4", role)))?.status).toBe(403);
    }
    expect(await listLogins("ceo")).toHaveLength(4); // none of them changed anything
  });

  test("the page: in the SETTING menu for the CEO only; closed to admin and coach", () => {
    const setting = (r: "ceo" | "admin" | "coach") => (menuFor(r).find((g) => g.group === "SETTING")?.items ?? []).map((i) => i.href);
    expect(setting("ceo")).toEqual(["/users"]);
    expect(setting("admin")).toEqual([]);
    expect(setting("coach")).toEqual([]);
    expect(canOpen("ceo", "/users")).toBe(true);
    expect(canOpen("admin", "/users")).toBe(false);
    expect(canOpen("coach", "/users")).toBe(false);
    expect(ruleFor("/users")?.money).toBeUndefined();
  });

  test("the edge cookie guard covers /users (proxy.ts matcher)", () => {
    expect(readFileSync("src/proxy.ts", "utf8")).toContain('"/users/:path*"');
  });
});

describe("the form rules", () => {
  const f = { username: "nok", role: "admin" as const, teacherId: null, needsPerson: false };

  test("a username is required; a coach's person is required only once the server said the front office has none", () => {
    expect(validateAdmit(f)).toEqual({});
    expect(validateAdmit({ ...f, username: "  " })).toEqual({ username: MSG.username });
    expect(validateAdmit({ ...f, role: "coach" })).toEqual({}); // the front office's own link is tried first
    expect(validateAdmit({ ...f, role: "coach", needsPerson: true })).toEqual({ teacherId: MSG.teacher });
    expect(validateAdmit({ ...f, role: "coach", needsPerson: true, teacherId: TON })).toEqual({});
    expect(validateAdmit({ ...f, role: "admin", needsPerson: true })).toEqual({}); // an admin never needs one
  });

  test("the request carries NO password, the person only with a coach who picked one, and the username trimmed", () => {
    expect(toAdmitInput({ ...f, username: " nok " })).toEqual({ username: "nok", role: "admin" });
    expect(toAdmitInput({ ...f, role: "coach" })).toEqual({ username: "nok", role: "coach" });
    expect(toAdmitInput({ ...f, role: "coach", teacherId: TON, needsPerson: true })).toEqual({ username: "nok", role: "coach", teacherId: TON });
    expect(toAdmitInput({ ...f, role: "admin", teacherId: TON })).toEqual({ username: "nok", role: "admin" });
    for (const body of [toAdmitInput(f), toAdmitInput({ ...f, role: "coach", teacherId: TON })]) expect(JSON.stringify(body)).not.toMatch(/password/i);
  });

  test("server refusals land on their field: 404 / 409 → username; 400 with details.field → that field (a teacherId one asks for the person); anything else → one message", () => {
    expect(fieldErrorsFromServer(new ApiClientError("FO_USER_NOT_FOUND", "no such", 404, { field: "username" }))).toEqual({ fields: { username: "no such" }, rest: null, needsPerson: false });
    expect(fieldErrorsFromServer(new ApiClientError("ALREADY_ADMITTED", "already", 409))).toEqual({ fields: { username: "already" }, rest: null, needsPerson: false });
    expect(fieldErrorsFromServer(new ApiClientError("VALIDATION", "needs a teacher", 400, { field: "teacherId" }))).toEqual({ fields: { teacherId: "needs a teacher" }, rest: null, needsPerson: true });
    expect(fieldErrorsFromServer(new ApiClientError("VALIDATION", "bad role", 400, { field: "role" }))).toEqual({ fields: { role: "bad role" }, rest: null, needsPerson: false });
    expect(fieldErrorsFromServer(new ApiClientError("FORBIDDEN", "no", 403))).toEqual({ fields: {}, rest: "no", needsPerson: false });
    expect(fieldErrorsFromServer(new ApiClientError("VALIDATION", "odd", 400, { field: "zzz" }))).toEqual({ fields: {}, rest: "odd", needsPerson: false });
  });

  test("who may be deactivated: active, not the CEO, not yourself; who may be reactivated: a deactivated login", () => {
    const row = (o: Partial<LoginUser>): LoginUser => ({ id: "x", username: "kung", role: "admin", teacherId: null, active: true, ...o });
    expect(canDeactivate(row({}), "phin")).toBe(true);
    expect(canDeactivate(row({ role: "ceo" }), "someone")).toBe(false);
    expect(canDeactivate(row({}), "kung")).toBe(false);
    expect(canDeactivate(row({ active: false }), "phin")).toBe(false);
    expect(canReactivate(row({ active: false }))).toBe(true);
    expect(canReactivate(row({}))).toBe(false);
  });

  test("a coach's person is shown by name, by id when the person is not in the list, and as a dash for a login with none", () => {
    const people = [{ teacherId: TON, name: "ต้น" }];
    expect(personName({ id: "a", username: "ton", role: "coach", teacherId: TON, active: true }, people)).toBe("ต้น");
    expect(personName({ id: "a", username: "ton", role: "coach", teacherId: "zzz", active: true }, people)).toBe("zzz");
    expect(personName({ id: "a", username: "kung", role: "admin", teacherId: null, active: true }, people)).toBe("—");
  });

  test("O-150-1: a name carried by the login row wins, so a coach missing from the people list (no active salary profile) still shows a name, not an id", () => {
    const people = [{ teacherId: TON, name: "ต้น" }];
    const coach = { id: "a", username: "nid", role: "coach" as const, teacherId: NID, active: true };
    expect(personName(coach, people)).toBe(NID); // not in the people list, no name on the row: the id (the last resort)
    expect(personName({ ...coach, teacherName: "พลอย" }, people)).toBe("พลอย"); // the row's own name
    expect(personName({ ...coach, teacherName: "  " }, people)).toBe(NID); // a blank name is not a name
    expect(personName({ ...coach, teacherId: TON, teacherName: "ต้น (แถว)" }, people)).toBe("ต้น (แถว)"); // the row's name beats the list's
    expect(personName({ ...coach, teacherId: null, teacherName: "x" }, people)).toBe("—"); // no person, no name shown
  });
});

describe("the list on screen", () => {
  const people = [{ teacherId: TON, name: "ต้น" }];
  const noop = () => {};

  test("Username · Role · Person · Status; a deactivated login can be reactivated (not deactivated again); the CEO and your own row have no Deactivate", async () => {
    const rows = await listLogins("ceo");
    const html = ui(<LoginsTable rows={rows} people={people} me="kung" onDeactivate={noop} onReactivate={noop} />);
    for (const h of ["Username", "Role", "Person", "Status"]) expect(html).toContain(h);
    expect(html).toContain("ต้น");
    expect(html).toContain("Deactivated");
    expect(html).toContain('data-login-row="mali" data-active="no"');
    expect(html).toContain('data-reactivate="mali"');
    expect(html).not.toContain('data-deactivate="mali"');
    expect(html).not.toContain('data-reactivate="ton"'); // an active login has no Reactivate
    expect(html).not.toContain('data-deactivate="phin"'); // the CEO
    expect(html).not.toContain('data-deactivate="kung"'); // yourself
    expect(html).toContain('data-deactivate="ton"');
  });

  test("there is no Reset password anywhere (the password lives in the front office)", async () => {
    const html = ui(<LoginsTable rows={await listLogins("ceo")} people={people} me="phin" onDeactivate={noop} onReactivate={noop} />);
    expect(html).not.toMatch(/reset/i);
  });

  test("even if a response leaked a password or a hash, the table has nowhere to print it", async () => {
    const leaky = (await listLogins("ceo")).map((r) => ({ ...r, password: "LEAKED-pw-9", passwordHash: "$2b$10$LEAKEDHASH", hash: "LEAKEDHASH2" })) as LoginUser[];
    const html = ui(<LoginsTable rows={leaky} people={people} me="phin" onDeactivate={noop} onReactivate={noop} />);
    for (const secret of ["LEAKED-pw-9", "$2b$10$LEAKEDHASH", "LEAKEDHASH2"]) expect(html).not.toContain(secret);
  });

  test("an empty list says so", () => {
    expect(ui(<LoginsTable rows={[]} people={[]} me={null} onDeactivate={noop} onReactivate={noop} />)).toContain("No logins yet");
  });
});

describe("no password anywhere in the source", () => {
  const files = ["src/components/partials/Users/Logins.tsx", "src/components/partials/Users/hooks.ts", "src/components/partials/Users/logins-logic.ts", "src/services/users.service.ts", "src/types/app/users.ts"];
  const code = (f: string) => readFileSync(f, "utf8").replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, ""); // comments say "no password"; only code counts

  test("no password field, input, type or request key exists in the login code", () => {
    for (const f of files) {
      expect(code(f)).not.toMatch(/PasswordInput|type=["']password["']|\bpassword\s*[:=?]|\.password\b|resetPassword|reset-password/i);
    }
  });

  test("nothing logs: no console call anywhere in the login code", () => {
    for (const f of files) expect(readFileSync(f, "utf8")).not.toMatch(/console\./);
  });

  test("while the data is the fixture the page says so (Sample data)", () => {
    expect(readFileSync("src/components/partials/Users/Logins.tsx", "utf8")).toContain("Sample data");
  });
});
