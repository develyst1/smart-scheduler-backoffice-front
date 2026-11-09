"use client";

import { useState } from "react";
import { Alert, Badge, Button, Card, FileInput, Group, Stack, Table, Text, Title } from "@mantine/core";
import { useRole } from "@/context/RoleContext";
import { formatBaht } from "@/components/partials/Salary/money";
import { errorMessage } from "@/components/partials/Salary/parts";
import { useApplyImport, usePreviewImport } from "./hooks";
import { countDiff, fieldDeltas, groupByKind, isStaleBatch, negativeBalanceDetails, sheetProblems, signedQty, KIND_LABEL, type FieldDelta } from "./import-logic";
import type { ImportDiffRow, ImportKind, ImportPreview, ImportResult } from "@/types/app/stock-import";

const KIND_COLOR: Record<ImportKind, string> = { new: "green", qty_change: "orange", field_change: "blue", removed: "gray" };

const FIELD_LABEL: Record<FieldDelta["field"], string> = { name: "Name", priceSatang: "Price", category: "Category", commissionGroup: "Commission group" };

const baht = (satang: number | undefined | null) => (typeof satang === "number" ? `${formatBaht(satang)} ฿` : "—");

const showField = (field: FieldDelta["field"], v: string | number | null): string => {
  if (field === "priceSatang") return baht(v as number);
  return v === null || v === "" ? "none" : String(v);
};

/** The name / price / category / commission-group edits of a row (a quantity change can carry them too). The real preview lists only the fields that changed. */
function FieldEdits({ row }: { row: ImportDiffRow }) {
  const d = fieldDeltas(row.before, row.after);
  // a change the preview cannot show as before/after (the sheet's note) still counts as an edit: say so, never leave the cell empty
  if (d.length === 0 && row.kind === "field_change") {
    return (
      <Text span c="dimmed" data-other-edit>
        Other details (e.g. the note) updated
      </Text>
    );
  }
  return (
    <Stack gap={2}>
      {d.map((f) => (
        <span key={f.field} data-field-change>
          {FIELD_LABEL[f.field]}: {showField(f.field, f.before)} → {showField(f.field, f.after)}
        </span>
      ))}
    </Stack>
  );
}

function Change({ row }: { row: ImportDiffRow }) {
  if (row.kind === "qty_change") {
    return (
      <Stack gap={2}>
        <span className="tabular-nums">
          {row.before?.quantity ?? "—"} → {row.after?.quantity ?? "—"}{" "}
          <b data-delta>{row.delta === null ? "" : signedQty(row.delta)}</b>
        </span>
        <FieldEdits row={row} />
      </Stack>
    );
  }
  if (row.kind === "field_change") return <FieldEdits row={row} />;
  if (row.kind === "new") {
    return (
      <span className="tabular-nums">
        {baht(row.after?.priceSatang)} · opening {row.after?.quantity ?? 0}
        {row.delta ? <b data-delta> {signedQty(row.delta)}</b> : null}
        {row.after?.category ? ` · ${row.after.category}` : ""}
        {row.after?.commissionGroup ? ` · ${row.after.commissionGroup}` : ""}
      </span>
    );
  }
  // removed: shown, never acted
  return <Text span c="dimmed">Stays in stock as it is — not deleted ({row.before?.quantity ?? 0} on hand)</Text>;
}

/** The diff, grouped by kind. A removed row is listed but not acted on. */
export function DiffBody({ preview }: { preview: ImportPreview }) {
  const counts = countDiff(preview.rows);
  const groups = groupByKind(preview.rows);
  return (
    <Stack gap="md" data-diff>
      <Group gap="xs" data-counts>
        {(Object.keys(KIND_LABEL) as ImportKind[]).map((k) => (
          <Badge key={k} color={KIND_COLOR[k]} variant="light" data-count={k}>
            {KIND_LABEL[k]} {counts.byKind[k]}
          </Badge>
        ))}
      </Group>
      {preview.rows.length === 0 ? (
        <Alert color="gray" data-diff-empty>
          No differences — the sheet matches the stock.
        </Alert>
      ) : (
        groups.map((g) => (
          <Card key={g.kind} padding="md" data-group={g.kind}>
            <Title order={4} fz={16} fw={600} mb="xs">
              {g.label} ({g.rows.length})
            </Title>
            <Table.ScrollContainer minWidth={480}>
              <Table verticalSpacing="sm">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Model code</Table.Th>
                    <Table.Th>Name</Table.Th>
                    <Table.Th>Change</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {g.rows.map((r) => (
                    <Table.Tr key={r.model} data-diff-row={r.kind}>
                      <Table.Td className="tabular-nums">{r.model}</Table.Td>
                      <Table.Td>{r.name}</Table.Td>
                      <Table.Td>
                        <Change row={r} />
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          </Card>
        ))
      )}
      {(preview.flags ?? []).length > 0 && (
        <Alert color="yellow" title="Check before confirming" data-flags>
          <Stack gap={2}>
            {(preview.flags ?? []).map((f, i) => (
              <span key={`${i}-${f}`}>{f}</span>
            ))}
          </Stack>
        </Alert>
      )}
      {typeof preview.unchanged === "number" && preview.unchanged > 0 && (
        <Text size="sm" c="dimmed" data-unchanged>
          {preview.unchanged} row{preview.unchanged === 1 ? "" : "s"} of the sheet already match the stock (not listed).
        </Text>
      )}
      {preview.notImported.length > 0 && (
        <Text size="sm" c="dimmed" data-not-imported>
          Not imported: {preview.notImported.join(" · ")}
        </Text>
      )}
    </Stack>
  );
}

/** What the apply wrote. */
export function ResultBody({ result }: { result: ImportResult }) {
  return (
    <Alert color="green" title={result.alreadyApplied ? "Already imported — nothing written again" : "Import applied"} data-result>
      <Stack gap={2}>
        <span data-result-movements>Movements written: {result.movementsWritten}</span>
        <span data-result-added>Items added: {result.itemsAdded}</span>
        <span data-result-edits>Field edits: {result.fieldEdits}</span>
        <span data-result-removed>Removed rows left in stock: {result.removedLeft}</span>
      </Stack>
    </Alert>
  );
}

/** INVENTORY › Stock import (CEO). Upload the sheet → read the diff → Confirm → movements are written. The Balance Stock tab is the source. */
export default function StockImport() {
  const role = useRole();
  const [file, setFile] = useState<File | null>(null);
  const preview = usePreviewImport(role);
  const apply = useApplyImport(role);

  const reset = () => {
    setFile(null);
    preview.reset();
    apply.reset();
  };

  const diff = preview.data;
  const done = apply.data;

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="mb-1 text-2xl font-semibold tracking-tight text-foreground">Stock import</h1>
      <Text c="dimmed" size="sm" mb="md">
        Upload the stock workbook (the Balance Stock tab). You see what would change first; nothing is written until you confirm.
      </Text>

      <Card padding="md" mb="md">
        <Group align="flex-end">
          <FileInput
            label="Workbook (.xlsx)"
            placeholder="Choose a file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            value={file}
            onChange={(f) => {
              setFile(f);
              preview.reset();
              apply.reset();
            }}
            disabled={preview.isPending || apply.isPending}
            clearable
            w={320}
            data-file
          />
          <Button onClick={() => file && preview.mutate(file)} loading={preview.isPending} disabled={!file || !role} data-preview>
            Check changes
          </Button>
          {(diff || preview.isError) && (
            <Button variant="subtle" onClick={reset} data-reset>
              Start over
            </Button>
          )}
        </Group>
        {preview.isError && (
          <Alert color="red" mt="md" data-preview-error>
            <Stack gap={2}>
              <span>{errorMessage(preview.error)}</span>
              {sheetProblems(preview.error).lines.map((l) => (
                <span key={l} data-sheet-problem>
                  {l}
                </span>
              ))}
              {sheetProblems(preview.error).more > 0 && <span>… and {sheetProblems(preview.error).more} more</span>}
            </Stack>
          </Alert>
        )}
      </Card>

      {diff && (
        <>
          <DiffBody preview={diff} />
          {apply.isError && isStaleBatch(apply.error) && (
            <Alert color="orange" mt="md" title="Stock changed or the check expired — nothing was written" data-apply-stale>
              <Stack gap="xs">
                <span>The stock moved since you checked, or the check is older than 30 minutes. Check the changes again before confirming.</span>
                <Group>
                  <Button size="xs" onClick={() => file && preview.mutate(file, { onSuccess: () => apply.reset() })} loading={preview.isPending} data-recheck>
                    Check again
                  </Button>
                </Group>
              </Stack>
            </Alert>
          )}
          {apply.isError && !isStaleBatch(apply.error) && (
            <Alert color="red" mt="md" title="Import refused — nothing was written" data-apply-error>
              <Stack gap={2}>
                <span>{errorMessage(apply.error)}</span>
                {negativeBalanceDetails(apply.error) && (
                  <span data-negative-details>
                    {negativeBalanceDetails(apply.error)?.model} ({negativeBalanceDetails(apply.error)?.name}) would be left at {negativeBalanceDetails(apply.error)?.resultingBalance}
                  </span>
                )}
              </Stack>
            </Alert>
          )}
          {done && <div className="mt-4"><ResultBody result={done} /></div>}
          {!done && (
            <Group mt="md">
              <Button
                onClick={() => apply.mutate(diff)}
                loading={apply.isPending}
                disabled={countDiff(diff.rows).willChange === 0}
                data-confirm
              >
                Confirm import ({countDiff(diff.rows).willChange} change{countDiff(diff.rows).willChange === 1 ? "" : "s"})
              </Button>
              <Text size="sm" c="dimmed">
                Removed rows are not touched.
              </Text>
            </Group>
          )}
        </>
      )}
    </div>
  );
}
