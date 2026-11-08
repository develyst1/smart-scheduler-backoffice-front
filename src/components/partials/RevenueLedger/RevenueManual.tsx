"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert, Button, Card, Grid, Group, NumberInput, Select, Textarea } from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { useCreateRevenueLine, useRevenueCategories } from "./hooks";
import { BRANCH_LABEL, METHOD_LABEL, TYPE_LABEL, todayBangkok } from "./labels";
import { ErrorState, PageHeader, errorMessage } from "./parts";
import {
  REVENUE_BRANCHES,
  REVENUE_METHODS,
  REVENUE_TYPES,
  type RevenueBranch,
  type RevenueMethod,
  type RevenueType,
} from "@/types/app/revenue-ledger";

const TYPE_OPTIONS = REVENUE_TYPES.map((t) => ({ value: t, label: TYPE_LABEL[t] })); // no Refund
const BRANCH_OPTIONS = REVENUE_BRANCHES.map((b) => ({ value: b, label: BRANCH_LABEL[b] }));
const METHOD_OPTIONS = REVENUE_METHODS.map((m) => ({ value: m, label: METHOD_LABEL[m] }));
const REMARK_MAX = 500; // SPEC-098 §3

type Field = "type" | "categoryId" | "amount" | "date";

/** Add Manually: revenue that did not come from a booking or a sale in the system (TASK-859 §5). */
export default function RevenueManual() {
  const router = useRouter();
  const [type, setType] = useState<RevenueType | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [amount, setAmount] = useState<string | number>("");
  const [date, setDate] = useState<string | null>(todayBangkok());
  const [branch, setBranch] = useState<RevenueBranch>("BRAVO");
  const [method, setMethod] = useState<RevenueMethod>("TRANSFER");
  const [remark, setRemark] = useState("");
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});

  const cats = useRevenueCategories(type ? { type } : undefined, type !== null);
  const catOptions = useMemo(() => (cats.data ?? []).map((c) => ({ value: c.id, label: c.name })), [cats.data]);
  const save = useCreateRevenueLine();

  const submit = () => {
    const next: Partial<Record<Field, string>> = {};
    if (!type) next.type = "Choose a type";
    if (!categoryId) next.categoryId = "Choose a category";
    const baht = Number(amount);
    if (amount === "" || !(baht > 0)) next.amount = "Enter an amount above 0";
    if (!date) next.date = "Choose a date";
    setErrors(next);
    if (Object.keys(next).length > 0 || !type || !categoryId || !date) return;

    save.mutate(
      {
        occurredOn: date,
        branch,
        type,
        categoryId,
        amountMinor: Math.round(baht * 100),
        method,
        ...(remark.trim() ? { remark: remark.trim() } : {}),
      },
      { onSuccess: () => router.push(`/revenue/detail?from=${date}&to=${date}`) },
    );
  };

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Add Manually" actions={[{ href: "/revenue/summary", label: "Summary" }]} />
      <Card>
        <Grid gap="md">
          <Grid.Col span={{ base: 12, sm: 4 }}>
            <Select
              label="Type"
              placeholder="Choose a type"
              data={TYPE_OPTIONS}
              value={type}
              onChange={(v) => {
                setType(v as RevenueType | null);
                setCategoryId(null);
                setErrors((e) => ({ ...e, type: undefined, categoryId: undefined }));
              }}
              error={errors.type}
              allowDeselect={false}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 4 }}>
            <Select
              label="Category"
              placeholder={type ? "Choose a category" : "Choose a type first"}
              data={catOptions}
              value={categoryId}
              onChange={(v) => {
                setCategoryId(v);
                setErrors((e) => ({ ...e, categoryId: undefined }));
              }}
              disabled={!type}
              error={errors.categoryId}
              searchable
              allowDeselect={false}
              nothingFoundMessage={cats.isLoading ? "Loading…" : "No categories"}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 4 }}>
            <NumberInput
              label="Amount"
              value={amount}
              onChange={(v) => {
                setAmount(v);
                setErrors((e) => ({ ...e, amount: undefined }));
              }}
              error={errors.amount}
              min={0}
              allowDecimal={false}
              allowNegative={false}
              hideControls
              suffix=" ฿"
              thousandSeparator=","
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 4 }}>
            <DatePickerInput
              label="Date"
              value={date}
              onChange={(v) => {
                setDate(v);
                setErrors((e) => ({ ...e, date: undefined }));
              }}
              valueFormat="DD/MM/YY"
              error={errors.date}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 4 }}>
            <Select
              label="Branch"
              data={BRANCH_OPTIONS}
              value={branch}
              onChange={(v) => setBranch((v as RevenueBranch) ?? "BRAVO")}
              allowDeselect={false}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 4 }}>
            <Select
              label="Method"
              data={METHOD_OPTIONS}
              value={method}
              onChange={(v) => setMethod((v as RevenueMethod) ?? "TRANSFER")}
              allowDeselect={false}
            />
          </Grid.Col>
          <Grid.Col span={12}>
            <Textarea
              label="Remark"
              rows={2}
              value={remark}
              onChange={(e) => setRemark(e.currentTarget.value)}
              maxLength={REMARK_MAX}
            />
          </Grid.Col>
        </Grid>

        {cats.isError && (
          <div className="mt-4">
            <ErrorState error={cats.error} onRetry={() => cats.refetch()} />
          </div>
        )}
        {save.isError && (
          <Alert color="red" mt="md" role="alert">
            {errorMessage(save.error)}
          </Alert>
        )}

        <Group justify="flex-end" mt="md">
          <Button component={Link} href="/revenue/summary" variant="default">
            Cancel
          </Button>
          <Button onClick={submit} loading={save.isPending}>
            Save
          </Button>
        </Group>
      </Card>
    </div>
  );
}
