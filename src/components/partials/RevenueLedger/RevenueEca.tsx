"use client";

import { useMemo, useState } from "react";
import dayjs from "dayjs";
import { Alert, Badge, Button, Card, Grid, Group, NumberInput, Select, Stack, Table, Text, TextInput } from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { notifications } from "@mantine/notifications";
import { AlertTriangle } from "lucide-react";
import { useCreateEcaPayment, useRevenueCategories, useRevenueLines } from "./hooks";
import { fmtDate, money, todayBangkok } from "./labels";
import { EmptyState, ErrorState, LoadingState, PageHeader, errorMessage } from "./parts";

const INT32_MAX = 2147483647; // the API refuses a total that does not fit a 32-bit int (TASK-890)
const TERM_MAX = 40;

type Field = "school" | "term" | "price" | "students" | "classes" | "date";

/** The history shows the last ~11 months and a month ahead (GET /lines takes at most 366 days). */
function historyRange(): { from: string; to: string } {
  const today = todayBangkok();
  return { from: dayjs(today).subtract(335, "day").format("YYYY-MM-DD"), to: dayjs(today).add(30, "day").format("YYYY-MM-DD") };
}

/**
 * ECA Payment (TASK-891, final UI `EcaPayment.tsx`): price per class × students × classes = Total Amount, counted on the Payment Date
 * (the day the school pays). The total shown while typing is the one product this screen computes; the server's amount is the truth.
 */
export default function RevenueEca() {
  const [school, setSchool] = useState<string | null>(null);
  const [term, setTerm] = useState("");
  const [price, setPrice] = useState<string | number>("");
  const [students, setStudents] = useState<string | number>("");
  const [classes, setClasses] = useState<string | number>("");
  const [date, setDate] = useState<string | null>(todayBangkok());
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});

  const schools = useRevenueCategories({ type: "ECA" });
  const range = useMemo(historyRange, []);
  const history = useRevenueLines({ ...range, type: "ECA" });
  const save = useCreateEcaPayment();

  const schoolOptions = (schools.data ?? []).map((c) => ({ value: c.id, label: c.name }));
  const schoolName = (id: string | null) => schools.data?.find((c) => c.id === id)?.name ?? "";

  const priceN = Number(price), studentsN = Number(students), classesN = Number(classes);
  const filled = price !== "" && students !== "" && classes !== "";
  const totalBaht = filled ? priceN * studentsN * classesN : 0;
  const totalMinor = Math.round(totalBaht * 100);

  const clear = (f: Field) => setErrors((e) => ({ ...e, [f]: undefined }));

  const submit = () => {
    const next: Partial<Record<Field, string>> = {};
    if (!school) next.school = "Choose a school";
    const t = term.trim();
    if (!t) next.term = "Enter the term";
    else if (t.length > TERM_MAX) next.term = `At most ${TERM_MAX} characters`;
    if (!(price !== "" && priceN > 0)) next.price = "Enter a price above 0";
    if (!(students !== "" && studentsN > 0)) next.students = "Enter the number of students";
    if (!(classes !== "" && classesN > 0)) next.classes = "Enter the number of classes";
    if (!date) next.date = "Choose the payment date";
    if (!next.price && !next.students && !next.classes && totalMinor > INT32_MAX) next.classes = "The total is too large";
    setErrors(next);
    if (Object.keys(next).length > 0 || !school || !date) return;

    save.mutate(
      { categoryId: school, term: t, pricePerClassMinor: Math.round(priceN * 100), students: studentsN, classesPerTerm: classesN, paidOn: date },
      {
        onSuccess: (line) => {
          notifications.show({
            color: "green",
            title: "ECA payment saved",
            message: `${schoolName(school)} ${line.productName}: ${money(line.amountMinor)}, counted on ${fmtDate(line.occurredOn)}`,
          });
          setTerm("");
          setPrice("");
          setStudents("");
          setClasses("");
        },
      },
    );
  };

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="ECA Payment" actions={[{ href: "/revenue/summary", label: "Summary" }]} />
      <Stack gap="md">
        <Card>
          <Grid gap="md">
            <Grid.Col span={{ base: 12, sm: 4 }}>
              <Select
                label="School"
                placeholder="Choose a school"
                data={schoolOptions}
                value={school}
                onChange={(v) => {
                  setSchool(v);
                  clear("school");
                }}
                error={errors.school}
                nothingFoundMessage={schools.isLoading ? "Loading…" : "No schools"}
                allowDeselect={false}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 4 }}>
              <TextInput
                label="Term"
                value={term}
                onChange={(e) => {
                  setTerm(e.currentTarget.value);
                  clear("term");
                }}
                error={errors.term}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 4 }}>
              <NumberInput
                label="Price per class"
                value={price}
                onChange={(v) => {
                  setPrice(v);
                  clear("price");
                }}
                error={errors.price}
                min={0}
                allowDecimal={false}
                allowNegative={false}
                hideControls
                suffix=" ฿"
                thousandSeparator=","
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 4 }}>
              <NumberInput
                label="Student"
                value={students}
                onChange={(v) => {
                  setStudents(v);
                  clear("students");
                }}
                error={errors.students}
                min={0}
                allowDecimal={false}
                allowNegative={false}
                hideControls
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 4 }}>
              <NumberInput
                label="Class / Term"
                value={classes}
                onChange={(v) => {
                  setClasses(v);
                  clear("classes");
                }}
                error={errors.classes}
                min={0}
                allowDecimal={false}
                allowNegative={false}
                hideControls
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 4 }}>
              <DatePickerInput
                label="Payment Date"
                value={date}
                onChange={(v) => {
                  setDate(v);
                  clear("date");
                }}
                valueFormat="DD/MM/YY"
                error={errors.date}
              />
            </Grid.Col>
          </Grid>

          {schools.isError && (
            <div className="mt-4">
              <ErrorState error={schools.error} onRetry={() => schools.refetch()} />
            </div>
          )}
          {save.isError && (
            <Alert color="red" mt="md" icon={<AlertTriangle size={16} />} role="alert">
              {errorMessage(save.error)}
            </Alert>
          )}

          <Group justify="space-between" mt="md" wrap="wrap">
            <Group gap="sm">
              <Text c="dimmed">Total Amount</Text>
              <Text fw={700} fz="lg" className="font-num whitespace-nowrap" aria-live="polite">
                {money(totalMinor)}
              </Text>
            </Group>
            <Button onClick={submit} loading={save.isPending}>
              Save
            </Button>
          </Group>
        </Card>

        <Card>
          <Text fw={600} mb="sm">
            ECA Payment History
          </Text>
          {history.isError ? (
            <ErrorState error={history.error} onRetry={() => history.refetch()} />
          ) : !history.data ? (
            <LoadingState />
          ) : history.data.lines.length === 0 ? (
            <EmptyState>No ECA payments yet</EmptyState>
          ) : (
            <Table.ScrollContainer minWidth={420}>
              <Table highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>School</Table.Th>
                    <Table.Th>Term</Table.Th>
                    <Table.Th ta="right">Total Amount</Table.Th>
                    <Table.Th>Payment Date</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {history.data.lines.map((l) => (
                    <Table.Tr key={l.id}>
                      <Table.Td>
                        <Badge variant="light" radius="sm">
                          {l.categoryName ?? "—"}
                        </Badge>
                      </Table.Td>
                      <Table.Td>{l.productName}</Table.Td>
                      <Table.Td ta="right" className="font-num whitespace-nowrap">
                        {money(l.amountMinor)}
                      </Table.Td>
                      <Table.Td className="whitespace-nowrap">{fmtDate(l.occurredOn)}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          )}
        </Card>
      </Stack>
    </div>
  );
}
