"use client";

import { useMemo, useState } from "react";
import dayjs from "dayjs";
import { Alert, Badge, Button, Card, Grid, Group, Modal, NumberInput, Select, Stack, Table, Text, Textarea } from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { useDebouncedValue } from "@mantine/hooks";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { useCreateRefund, useRefundSources } from "./hooks";
import { METHOD_LABEL, fmtDate, money, todayBangkok } from "./labels";
import { ErrorState, PageHeader } from "./parts";
import { REVENUE_METHODS, type RefundResult, type RefundSource, type RevenueMethod } from "@/types/app/revenue-ledger";

const keyOf = (s: Pick<RefundSource, "refType" | "refId">) => `${s.refType}:${s.refId}`;
const METHOD_OPTIONS = REVENUE_METHODS.map((m) => ({ value: m, label: METHOD_LABEL[m] }));
const optionLabel = (s: RefundSource) => `${s.label} · ${money(s.feeMinor)} · ${fmtDate(s.soldOn)}${s.refunded ? " · Refunded" : ""}`;

type Field = "date" | "amount";

/**
 * The words for the refusals the API gives (TASK-893 / SPEC-099 §10). Duck-typed on `status` / `code`: an `ApiClientError` carries
 * both, and checking a class would tie this to one module instance (bun's `mock.module` swaps it process-wide in tests).
 */
function refusal(e: unknown): { text: string; alreadyRefunded: boolean } {
  const x = e as { status?: unknown; code?: unknown; message?: unknown } | null;
  const status = typeof x?.status === "number" ? x.status : 0;
  const code = typeof x?.code === "string" ? x.code : "";
  if (code === "ALREADY_REFUNDED") return { text: "This sale has already been refunded", alreadyRefunded: true };
  if (code === "NO_FEE") return { text: "This sale has no fee on record, so it cannot be refunded", alreadyRefunded: false };
  if (status === 503) return { text: "Not configured", alreadyRefunded: false };
  if (status === 502) return { text: "Could not cancel the sessions; nothing was saved", alreadyRefunded: false };
  if (status > 0 && typeof x?.message === "string" && x.message) return { text: x.message, alreadyRefunded: false };
  return { text: "Could not save the refund", alreadyRefunded: false };
}

/**
 * Refund (TASK-894, final UI `Refund.tsx`): a refund is an EXPENSE in the month of the refund. Saving it cancels the sale's
 * not-yet-attended sessions, tells the family, and writes ONE negative REFUND line (TASK-893). Because that is irreversible and
 * reaches a family, Save opens a confirm first.
 */
export default function RevenueRefund() {
  const [search, setSearch] = useState("");
  const [debounced] = useDebouncedValue(search, 300);
  const sources = useRefundSources(debounced.trim());
  const create = useCreateRefund();

  const [picked, setPicked] = useState<RefundSource | null>(null);
  const [date, setDate] = useState<string | null>(todayBangkok());
  const [baht, setBaht] = useState<string | number>("");
  const [method, setMethod] = useState<RevenueMethod>("TRANSFER");
  const [remark, setRemark] = useState("");
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  // This session's results by sale, and sales found already refunded by a refusal (the list will say so on its next read).
  const [results, setResults] = useState<Record<string, RefundResult>>({});
  const [refundedKeys, setRefundedKeys] = useState<string[]>([]);

  // The pick list changes with the search; the chosen sale is always kept in it so its label never blanks.
  const options = useMemo(() => {
    const list = sources.data ?? [];
    const merged = picked && !list.some((s) => keyOf(s) === keyOf(picked)) ? [picked, ...list] : list;
    return merged.map((s) => ({ value: keyOf(s), label: optionLabel(s) }));
  }, [sources.data, picked]);

  // Prefer the live row (its `refunded` flag refreshes after a save) over the snapshot taken at pick time.
  const current = picked ? (sources.data?.find((s) => keyOf(s) === keyOf(picked)) ?? picked) : null;
  const result = current ? results[keyOf(current)] : undefined;
  const refunded = !!current && (current.refunded || refundedKeys.includes(keyOf(current)));

  const feeBaht = current ? current.feeMinor / 100 : 0;
  const amountN = Number(baht);
  const soldMonth = current ? dayjs(current.soldOn).format("MMM") : "—";
  const refundMonth = date ? dayjs(date).format("MMM") : "—";
  const clear = (f: Field) => setErrors((e) => ({ ...e, [f]: undefined }));

  const pick = (key: string | null) => {
    const found = (sources.data ?? []).find((s) => keyOf(s) === key) ?? null;
    setPicked(found);
    setFailure(null);
    setErrors({});
    // A refund defaults to the whole fee; the CEO lowers it for a partial one.
    setBaht(found ? found.feeMinor / 100 : "");
  };

  const review = () => {
    if (!current) return;
    const next: Partial<Record<Field, string>> = {};
    if (!date) next.date = "Choose the refund date";
    if (!(baht !== "" && amountN > 0)) next.amount = "Enter an amount above 0";
    else if (amountN > feeBaht) next.amount = `The refund cannot be more than the sale (${money(current.feeMinor)})`;
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    setFailure(null);
    setConfirmOpen(true);
  };

  const confirm = () => {
    if (!current || !date) return;
    create.mutate(
      {
        refType: current.refType,
        refId: current.refId,
        refundedOn: date,
        amountMinor: Math.round(amountN * 100),
        method,
        ...(remark.trim() ? { remark: remark.trim() } : {}),
      },
      {
        onSuccess: (r) => {
          setResults((m) => ({ ...m, [keyOf(current)]: r }));
          setConfirmOpen(false);
        },
        onError: (e) => {
          const r = refusal(e);
          if (r.alreadyRefunded) setRefundedKeys((k) => [...k, keyOf(current)]);
          setFailure(r.text);
          setConfirmOpen(false);
        },
      },
    );
  };

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Refund" actions={[{ href: "/revenue/summary", label: "Summary" }]} />
      <Grid gap="md">
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Card>
            <Text fw={600} mb="sm">
              Refund Record
            </Text>
            <Stack gap="sm">
              <Select
                label="From"
                placeholder="Search by student name"
                data={options}
                value={current ? keyOf(current) : null}
                onChange={pick}
                searchable
                // The search is the server's (the API matches the student); Mantine must not filter the answer again.
                filter={({ options: o }) => o}
                onSearchChange={(v) => {
                  // Picking an option writes its label into the search box; that is not a new search.
                  if (current && v === optionLabel(current)) return;
                  setSearch(v);
                }}
                nothingFoundMessage={sources.isLoading ? "Searching…" : "No sales found"}
                allowDeselect={false}
              />
              {sources.isError && <ErrorState error={sources.error} onRetry={() => sources.refetch()} />}
              <Group grow align="flex-start">
                <DatePickerInput
                  label="Date"
                  value={date}
                  onChange={(v) => {
                    setDate(v);
                    clear("date");
                  }}
                  valueFormat="DD/MM/YY"
                  error={errors.date}
                />
                <NumberInput
                  label="Amount"
                  value={baht}
                  onChange={(v) => {
                    setBaht(v);
                    clear("amount");
                  }}
                  error={errors.amount}
                  min={0}
                  max={current ? feeBaht : undefined}
                  allowDecimal={false}
                  allowNegative={false}
                  hideControls
                  suffix=" ฿"
                  thousandSeparator=","
                />
              </Group>
              <Select
                label="Method"
                data={METHOD_OPTIONS}
                value={method}
                onChange={(v) => setMethod((v as RevenueMethod) ?? "TRANSFER")}
                allowDeselect={false}
                w={200}
              />
              <Textarea label="Remark" rows={2} value={remark} onChange={(e) => setRemark(e.currentTarget.value)} />

              {refunded && !result && (
                <Alert color="gray" role="status">
                  This sale has already been refunded
                </Alert>
              )}
              {failure && (
                <Alert color="red" icon={<AlertTriangle size={16} />} role="alert">
                  {failure}
                </Alert>
              )}
              {result && (
                <Alert color="green" icon={<CheckCircle2 size={16} />} role="status">
                  Refund saved: {money(-result.line.amountMinor)} on {fmtDate(result.line.occurredOn)}. {result.cancelledSessions} session
                  {result.cancelledSessions === 1 ? "" : "s"} cancelled and the family was told.
                </Alert>
              )}

              <Group justify="flex-end">
                <Button onClick={review} disabled={!current || refunded}>
                  Save
                </Button>
              </Group>
            </Stack>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 6 }}>
          <Stack gap="md">
            <Card>
              <Text fw={600} mb="sm">
                Record
              </Text>
              {!current ? (
                <Text c="dimmed" size="sm">
                  Pick a sale to see where the refund lands
                </Text>
              ) : (
                <Table.ScrollContainer minWidth={320}>
                  <Table>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Period</Table.Th>
                        <Table.Th>What shows</Table.Th>
                        <Table.Th ta="right">Amount</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      <Table.Tr>
                        <Table.Td className="whitespace-nowrap">{soldMonth} (Sales)</Table.Td>
                        <Table.Td>
                          <Badge variant="light" color="blue" radius="sm" mr={6}>
                            {current.refType === "VOUCHER" ? "VOUCHER" : "COURSE"}
                          </Badge>
                          revenue
                        </Table.Td>
                        <Table.Td ta="right" className="font-num whitespace-nowrap">
                          {money(current.feeMinor)}
                        </Table.Td>
                      </Table.Tr>
                      <Table.Tr>
                        <Table.Td className="whitespace-nowrap">{refundMonth} (Refund)</Table.Td>
                        <Table.Td>
                          <Badge variant="light" color="red" radius="sm">
                            EXPENSE
                          </Badge>
                        </Table.Td>
                        <Table.Td ta="right" c={amountN > 0 ? "red.7" : undefined} className="font-num whitespace-nowrap">
                          {money(-(amountN > 0 ? Math.round(amountN * 100) : 0))}
                        </Table.Td>
                      </Table.Tr>
                    </Table.Tbody>
                  </Table>
                </Table.ScrollContainer>
              )}
            </Card>

            <Card>
              <Group justify="space-between" mb="sm" wrap="wrap">
                <Text fw={600}>Session</Text>
                <Group gap={6}>
                  {current && (
                    <Badge variant="light" color="gray" radius="sm" maw="100%">
                      {current.label}
                    </Badge>
                  )}
                  {refunded && (
                    <Badge color="red" radius="sm">
                      Refunded
                    </Badge>
                  )}
                </Group>
              </Group>
              {!current ? (
                <Text c="dimmed" size="sm">
                  Pick a sale to see its sessions
                </Text>
              ) : (
                <>
                  <Table>
                    <Table.Tbody>
                      <Table.Tr>
                        <Table.Td>Attended</Table.Td>
                        <Table.Td ta="right">{current.attended}</Table.Td>
                        <Table.Td>
                          <Badge variant="light" color="green" radius="sm">
                            Kept
                          </Badge>
                        </Table.Td>
                      </Table.Tr>
                      <Table.Tr>
                        <Table.Td>Not attended yet</Table.Td>
                        <Table.Td ta="right">{result ? result.cancelledSessions : current.toCancel}</Table.Td>
                        <Table.Td>
                          <Badge variant="light" color="red" radius="sm">
                            {result ? "Cancelled" : "Cancelled on save"}
                          </Badge>
                        </Table.Td>
                      </Table.Tr>
                    </Table.Tbody>
                  </Table>
                  {result && (
                    <Text size="xs" c="dimmed" mt="sm">
                      The family was told by LINE
                    </Text>
                  )}
                </>
              )}
            </Card>
          </Stack>
        </Grid.Col>
      </Grid>

      <Modal opened={confirmOpen} onClose={() => !create.isPending && setConfirmOpen(false)} title="Save this refund?" centered>
        {current && (
          <Stack>
            <Text size="sm">
              {money(Math.round(amountN * 100))} will be recorded as an expense on {fmtDate(date)}. The {current.toCancel} session
              {current.toCancel === 1 ? "" : "s"} not attended yet will be cancelled and the family will be told by LINE. This cannot be undone.
            </Text>
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setConfirmOpen(false)} disabled={create.isPending}>
                Back
              </Button>
              <Button color="red" onClick={confirm} loading={create.isPending}>
                Save
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </div>
  );
}
