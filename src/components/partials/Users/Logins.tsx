"use client";

import { useState } from "react";
import { Alert, Badge, Button, Card, Group, Modal, Select, Stack, Table, Text, TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useSession } from "@/context/RoleContext";
import { useEntryPeople } from "@/components/partials/Salary/hooks";
import { ErrorState, LoadingState } from "@/components/partials/Salary/parts";
import { EmptyState } from "@/components/partials/RevenueLedger/parts";
import { USERS_SOURCE } from "@/services/users.service";
import { useAdmitLogin, useDeactivateLogin, useLogins, useReactivateLogin } from "./hooks";
import { ROLE_OPTIONS, ROLE_WORD, TOAST, canDeactivate, canReactivate, fieldErrorsFromServer, personName, toAdmitInput, validateAdmit, type AdmitForm, type FieldErrors } from "./logins-logic";
import type { EntryPerson } from "@/types/app/salary";
import type { LoginRole, LoginUser } from "@/types/app/users";

/**
 * The logins list: Username · Role · Person · Status · actions. A row has no password and no hash (the type has none): the person signs in with their front-office password.
 * A deactivated login stays in the list, marked, and can be brought back.
 */
export function LoginsTable({
  rows,
  people,
  me,
  onDeactivate,
  onReactivate,
}: {
  rows: LoginUser[];
  people: readonly EntryPerson[];
  me: string | null;
  onDeactivate: (u: LoginUser) => void;
  onReactivate: (u: LoginUser) => void;
}) {
  if (rows.length === 0) return <EmptyState>No logins yet</EmptyState>;
  return (
    <Table.ScrollContainer minWidth={600}>
      <Table verticalSpacing="sm" highlightOnHover data-logins-table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Username</Table.Th>
            <Table.Th>Role</Table.Th>
            <Table.Th>Person</Table.Th>
            <Table.Th>Status</Table.Th>
            <Table.Th ta="right">Actions</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map((u) => (
            <Table.Tr key={u.id} data-login-row={u.username} data-active={u.active ? "yes" : "no"}>
              <Table.Td fw={600} c={u.active ? undefined : "dimmed"}>
                {u.username}
              </Table.Td>
              <Table.Td>{ROLE_WORD[u.role] ?? u.role}</Table.Td>
              <Table.Td>{personName(u, people)}</Table.Td>
              <Table.Td>
                <Badge variant="light" color={u.active ? "teal" : "gray"}>
                  {u.active ? "Active" : "Deactivated"}
                </Badge>
              </Table.Td>
              <Table.Td ta="right">
                <Group gap="xs" justify="flex-end" wrap="nowrap">
                  {canDeactivate(u, me) && (
                    <Button size="compact-sm" variant="default" color="red" onClick={() => onDeactivate(u)} data-deactivate={u.username}>
                      Deactivate
                    </Button>
                  )}
                  {canReactivate(u) && (
                    <Button size="compact-sm" variant="default" onClick={() => onReactivate(u)} data-reactivate={u.username}>
                      Reactivate
                    </Button>
                  )}
                </Group>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}

const EMPTY: AdmitForm = { username: "", role: "admin", teacherId: null, needsPerson: false };

/**
 * SETTING › User Setting (R0.1, CEO only): who can sign in to the back office. Admit a login (an existing front-office person + a role) · Deactivate · Reactivate.
 * 🔐 There is no password here at all: the person signs in with their front-office password, so nothing on this page asks for, sends, shows or keeps one.
 */
export default function Logins() {
  const { user } = useSession();
  const role = user?.role ?? null;
  const me = user?.username ?? null;
  const list = useLogins(role);
  const peopleQ = useEntryPeople();
  const people = peopleQ.data ?? [];
  const admit = useAdmitLogin(role);
  const deactivate = useDeactivateLogin(role);
  const reactivate = useReactivateLogin(role);

  const [dlg, setDlg] = useState<null | "admit" | "deactivate">(null);
  const [target, setTarget] = useState<LoginUser | null>(null);
  const [form, setForm] = useState<AdmitForm>(EMPTY);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [problem, setProblem] = useState<string | null>(null);

  const close = () => {
    // (the selected row stays until the next dialog opens, so the closing animation still reads «Deactivate nok?»; a row holds no secret)
    setDlg(null);
    setForm(EMPTY);
    setErrors({});
    setProblem(null);
    admit.reset();
    deactivate.reset();
  };
  const refuse = (e: unknown) => {
    const r = fieldErrorsFromServer(e);
    setErrors(r.fields);
    setProblem(r.rest);
    // the front office has no teacher link for this person: ask who they are (the picker appears)
    if (r.needsPerson) setForm((f) => ({ ...f, needsPerson: true }));
  };

  const doAdmit = () => {
    const e = validateAdmit(form);
    setErrors(e);
    setProblem(null);
    if (Object.keys(e).length) return;
    const username = form.username.trim();
    admit.mutate(toAdmitInput(form), {
      onSuccess: () => {
        close();
        notifications.show({ color: "green", message: TOAST.admitted(username) });
      },
      onError: refuse,
    });
  };
  const doDeactivate = () => {
    if (!target) return;
    const { id, username } = target;
    deactivate.mutate(id, {
      onSuccess: () => {
        close();
        notifications.show({ color: "green", message: TOAST.deactivated(username) });
      },
      onError: refuse,
    });
  };
  const doReactivate = (u: LoginUser) =>
    reactivate.mutate(u.id, {
      onSuccess: () => notifications.show({ color: "green", message: TOAST.reactivated(u.username) }),
      onError: (e) => notifications.show({ color: "red", message: fieldErrorsFromServer(e).rest ?? (e as Error).message }),
    });

  if (role !== "ceo") return null; // CEO only: the page gate refuses everyone else; nothing renders for them here either

  return (
    <div className="mx-auto max-w-5xl">
      <Group justify="space-between" mb="md">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">User Setting</h1>
        <Button
          onClick={() => {
            setForm(EMPTY);
            setErrors({});
            setProblem(null);
            setDlg("admit");
          }}
          data-open="admit"
        >
          Admit a login
        </Button>
      </Group>
      {USERS_SOURCE.users === "fixture" && (
        <Alert color="yellow" variant="light" mb="md" data-sample-notice>
          Sample data — the real logins are connected with TASK-930.
        </Alert>
      )}
      <Text size="sm" c="dimmed" mb="md">
        Who can sign in to the back office. People sign in with their front-office username and password; here you only give them a role. A deactivated login cannot sign in and stays in the list.
      </Text>

      <Card padding="md">
        {list.isLoading ? (
          <LoadingState />
        ) : list.isError ? (
          <ErrorState error={list.error} onRetry={() => list.refetch()} />
        ) : (
          <LoginsTable
            rows={list.data ?? []}
            people={people}
            me={me}
            onDeactivate={(u) => {
              setTarget(u);
              setProblem(null);
              setDlg("deactivate");
            }}
            onReactivate={doReactivate}
          />
        )}
      </Card>

      <Modal opened={dlg === "admit"} onClose={close} title="Admit a login" centered>
        <Stack>
          <Text size="sm" c="dimmed">
            Admit someone who already has a front-office login. They sign in with their front-office password; nothing is typed or stored here.
          </Text>
          <TextInput
            label="Front-office username"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.currentTarget.value })}
            error={errors.username}
            autoComplete="off"
            data-field="username"
          />
          <Select
            label="Role"
            data={ROLE_OPTIONS}
            value={form.role}
            onChange={(v) => setForm({ ...form, role: (v ?? "admin") as LoginRole, teacherId: v === "coach" ? form.teacherId : null, needsPerson: v === "coach" ? form.needsPerson : false })}
            error={errors.role}
            allowDeselect={false}
            data-field="role"
          />
          {form.role === "coach" && form.needsPerson && (
            <Select
              label="Person"
              description="The front office does not link this username to a teacher, so say who they are."
              placeholder="Pick the coach"
              data={people.map((p) => ({ value: p.teacherId, label: p.name }))}
              value={form.teacherId}
              onChange={(v) => setForm({ ...form, teacherId: v })}
              error={errors.teacherId}
              searchable
              allowDeselect={false}
              data-field="teacher"
            />
          )}
          {problem && (
            <Alert color="red" data-dialog-problem>
              {problem}
            </Alert>
          )}
          <Group justify="flex-end">
            <Button variant="default" onClick={close}>
              Cancel
            </Button>
            <Button onClick={doAdmit} loading={admit.isPending} data-submit="admit">
              Admit
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal opened={dlg === "deactivate"} onClose={close} title="Deactivate login" centered>
        <Stack>
          <Text size="sm">
            Deactivate <b>{target?.username}</b>? They will not be able to sign in. The login stays in the list and can be reactivated.
          </Text>
          {problem && (
            <Alert color="red" data-dialog-problem>
              {problem}
            </Alert>
          )}
          <Group justify="flex-end">
            <Button variant="default" onClick={close}>
              Cancel
            </Button>
            <Button color="red" onClick={doDeactivate} loading={deactivate.isPending} data-submit="deactivate">
              Deactivate
            </Button>
          </Group>
        </Stack>
      </Modal>
    </div>
  );
}
