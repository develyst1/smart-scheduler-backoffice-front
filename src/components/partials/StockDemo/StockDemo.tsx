"use client";

import { useState } from "react";
import { ActionIcon, Button, Card, Checkbox, Group, Menu, Modal, NumberInput, Select, Stack, Table, Text, TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { ArrowDown, ArrowLeftRight, ArrowUp, Ellipsis, MapPin, PackagePlus, Trash2 } from "lucide-react";
import { useRole } from "@/context/RoleContext";
import { fmtDate } from "@/components/partials/Salary/money";
import { ErrorState, LoadingState, errorMessage } from "@/components/partials/Salary/parts";
import { useAddSite, useDefectIn, useDeleteDemo, useDemoMovements, useDemoStock, useMoveDemo, useOrderSites } from "./hooks";
import { MSG, checkForm, demoNegativeDetails, fromTo, newWriteKey, orderedSites, qtyAt, siteNameOk, swapIds, totalOf } from "./demo-logic";
import type { DemoMovement, DemoStock } from "@/types/app/stock-demo";

type Dlg = null | "move" | "delete" | "defect" | "location" | "order";

/** The matrix: items × sites (left to right as the server orders them) and a Total column. */
export function DemoMatrix({ stock }: { stock: DemoStock }) {
  const sites = orderedSites(stock);
  return (
    <Table.ScrollContainer minWidth={640}>
      <Table highlightOnHover data-matrix>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Item</Table.Th>
            {sites.map((s) => (
              <Table.Th key={s.id} ta="right" data-site={s.name}>
                {s.name}
              </Table.Th>
            ))}
            <Table.Th ta="right">Total</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {stock.items.map((it) => (
            <Table.Tr key={it.id} data-item={it.name}>
              <Table.Td fw={600}>{it.name}</Table.Td>
              {sites.map((s) => (
                <Table.Td key={s.id} ta="right" className="tabular-nums">
                  {qtyAt(it, s.id)}
                </Table.Td>
              ))}
              <Table.Td ta="right" fw={700} className="tabular-nums" data-total>
                {totalOf(it, sites)}
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}

/** The history, newest first: When (date only) · Who · Item · From → To · Qty · Reason. */
export function DemoHistory({ rows }: { rows: DemoMovement[] }) {
  return (
    <Table.ScrollContainer minWidth={720}>
      <Table highlightOnHover data-history>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>When</Table.Th>
            <Table.Th>Who</Table.Th>
            <Table.Th>Item</Table.Th>
            <Table.Th>From → To</Table.Th>
            <Table.Th ta="right">Qty</Table.Th>
            <Table.Th>Reason</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map((m) => (
            <Table.Tr key={m.id} data-history-row={m.type}>
              <Table.Td className="tabular-nums">{fmtDate(m.occurredOn)}</Table.Td>
              <Table.Td>{m.who ?? "—"}</Table.Td>
              <Table.Td>{m.itemName}</Table.Td>
              <Table.Td>{fromTo(m)}</Table.Td>
              <Table.Td ta="right" className="tabular-nums">
                {m.qty}
              </Table.Td>
              <Table.Td c="dimmed" fz="sm">
                {m.reason ?? ""}
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}

const warn = (message: string) => notifications.show({ color: "orange", message });
const ok = (message: string) => notifications.show({ color: "green", message });
/** A refused write: the server's sentence, plus what `error.details` adds for a 409 NEGATIVE_BALANCE. */
const fail = (e: unknown) => {
  const d = demoNegativeDetails(e);
  notifications.show({ color: "red", message: d ? `${errorMessage(e)} (${d.name} would be left at ${d.resultingBalance})` : errorMessage(e) });
};

/** STOCK › Stock Demo (CEO + Admin): teaching equipment at the sites, separate from the sale stock. Moves and deletes need a reason; the history is kept. */
export default function StockDemo() {
  const role = useRole();
  const stockQ = useDemoStock(role);
  const histQ = useDemoMovements(role);
  const move = useMoveDemo(role);
  const defect = useDefectIn(role);
  const del = useDeleteDemo(role);
  const addSite = useAddSite(role);
  const order = useOrderSites(role);

  const [dlg, setDlg] = useState<Dlg>(null);
  const [key, setKey] = useState(newWriteKey);
  const [itemId, setItemId] = useState<string | null>(null);
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);
  const [qty, setQty] = useState<string | number>(1);
  const [why, setWhy] = useState("");
  const [whole, setWhole] = useState(false);
  const [newSite, setNewSite] = useState("");
  const [ids, setIds] = useState<string[]>([]);

  const stock = stockQ.data;
  const sites = stock ? orderedSites(stock) : [];
  const itemData = (stock?.items ?? []).map((i) => ({ value: i.id, label: i.name }));
  const siteData = sites.map((s) => ({ value: s.id, label: s.name }));
  const nameOfItem = (id: string | null) => stock?.items.find((i) => i.id === id)?.name ?? "";
  const nameOfSite = (id: string | null) => sites.find((s) => s.id === id)?.name ?? "";

  const open = (d: Exclude<Dlg, null>) => {
    // a fresh write key per opened dialog; a retry after a refusal keeps it (the same action can never write twice)
    setKey(newWriteKey());
    setItemId(stock?.items[0]?.id ?? null);
    setFrom(sites[0]?.id ?? null);
    setTo(sites[1]?.id ?? sites[0]?.id ?? null);
    setQty(1);
    setWhy("");
    setWhole(false);
    setNewSite("");
    setIds(sites.map((s) => s.id));
    setDlg(d);
  };
  const close = () => setDlg(null);

  const form = { itemId, qty: Number(qty), reason: why, fromSiteId: from, toSiteId: to };

  const doMove = () => {
    if (!stock) return;
    const bad = checkForm("move", form, stock);
    if (bad) return warn(bad);
    move.mutate(
      { key, itemId: itemId as string, fromSiteId: from as string, toSiteId: to as string, qty: Number(qty), reason: why.trim() },
      {
        onSuccess: () => {
          close();
          ok(`ย้ายแล้ว: ${nameOfItem(itemId)} ${qty} ชิ้น จาก ${nameOfSite(from)} ไป ${nameOfSite(to)} (บันทึกประวัติแล้ว)`);
        },
        onError: fail,
      },
    );
  };
  const doDefect = () => {
    if (!stock) return;
    const bad = checkForm("defect", form, stock);
    if (bad) return warn(bad);
    defect.mutate(
      { key, itemId: itemId as string, toSiteId: to as string, qty: Number(qty), reason: why.trim() },
      {
        onSuccess: () => {
          close();
          ok(`ย้ายสินค้ามีตำหนิเข้า Demo แล้ว: ${nameOfItem(itemId)} ${qty} ชิ้น ที่ ${nameOfSite(to)}`);
        },
        onError: fail,
      },
    );
  };
  const doDelete = () => {
    if (!stock) return;
    if (whole) {
      if (!itemId) return warn(MSG.pickAndQty);
      if (!why.trim()) return warn(MSG.needReason);
      return del.mutate(
        { key, itemId, reason: why.trim() },
        {
          onSuccess: () => {
            close();
            ok(`ลบออกแล้ว: ${nameOfItem(itemId)} ทุกสถานที่ (ประวัติยังเก็บไว้)`);
          },
          onError: fail,
        },
      );
    }
    const bad = checkForm("delete-partial", form, stock);
    if (bad) return warn(bad);
    del.mutate(
      { key, itemId: itemId as string, siteId: from as string, qty: Number(qty), reason: why.trim() },
      {
        onSuccess: () => {
          close();
          ok(`ลบออกแล้ว: ${nameOfItem(itemId)} ${qty} ชิ้น ที่ ${nameOfSite(from)} (ประวัติยังเก็บไว้)`);
        },
        onError: fail,
      },
    );
  };
  const doLocation = () => {
    if (!siteNameOk(newSite, sites)) return warn(MSG.newSite);
    addSite.mutate(newSite.trim(), {
      onSuccess: () => {
        close();
        ok(`เพิ่มสถานที่แล้ว: ${newSite.trim()} (ต่อท้ายตาราง จัดลำดับได้ที่ More)`);
      },
      onError: fail,
    });
  };
  const doOrder = () =>
    order.mutate(ids, {
      onSuccess: () => {
        close();
        ok(`จัดลำดับสถานที่แล้ว: ${nameOfSite(ids[0])} อยู่คอลัมน์ซ้ายสุด`);
      },
      onError: fail,
    });

  const busy = move.isPending || defect.isPending || del.isPending || addSite.isPending || order.isPending;

  return (
    <div className="mx-auto max-w-6xl">
      <Group justify="space-between" mb="md">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Stock Demo</h1>
        <Group gap="xs">
          <Button leftSection={<ArrowLeftRight size={16} />} onClick={() => open("move")} disabled={!stock} data-open="move">
            Move A → B
          </Button>
          <Menu position="bottom-end" withinPortal>
            <Menu.Target>
              <Button variant="default" leftSection={<Ellipsis size={16} />} disabled={!stock} data-open="more">
                More
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item leftSection={<PackagePlus size={14} />} onClick={() => open("defect")} data-open="defect">
                Defect Product → Demo
              </Menu.Item>
              <Menu.Item leftSection={<MapPin size={14} />} onClick={() => open("location")} data-open="location">
                Add Location
              </Menu.Item>
              <Menu.Item leftSection={<ArrowLeftRight size={14} />} onClick={() => open("order")} data-open="order">
                Location Order
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
          <Button variant="default" color="red" leftSection={<Trash2 size={16} />} onClick={() => open("delete")} disabled={!stock} data-open="delete">
            Delete
          </Button>
        </Group>
      </Group>

      {stockQ.isLoading ? (
        <LoadingState />
      ) : stockQ.isError ? (
        <ErrorState error={stockQ.error} onRetry={() => stockQ.refetch()} />
      ) : stock ? (
        <Stack gap="md">
          <Card>
            <DemoMatrix stock={stock} />
          </Card>
          <Card>
            <Text fw={600} mb="sm">
              History
            </Text>
            {histQ.isError ? <ErrorState error={histQ.error} onRetry={() => histQ.refetch()} /> : <DemoHistory rows={histQ.data ?? []} />}
          </Card>
        </Stack>
      ) : null}

      <Modal opened={dlg === "move" || dlg === "delete"} onClose={close} title={dlg === "delete" ? "Delete" : "Move A → B"} centered>
        <Stack>
          <Select label="Item" data={itemData} value={itemId} onChange={setItemId} allowDeselect={false} searchable />
          {dlg === "delete" && (
            <Checkbox label="Remove this item from every location" checked={whole} onChange={(e) => setWhole(e.currentTarget.checked)} data-whole />
          )}
          {!(dlg === "delete" && whole) && (
            <Group grow>
              <Select label={dlg === "delete" ? "At" : "From (A)"} data={siteData} value={from} onChange={setFrom} allowDeselect={false} />
              {dlg === "move" && <Select label="To (B)" data={siteData} value={to} onChange={setTo} allowDeselect={false} />}
            </Group>
          )}
          {!(dlg === "delete" && whole) && <NumberInput label="Qty" value={qty} onChange={setQty} min={1} allowDecimal={false} />}
          <TextInput label="Reason" placeholder="Why?" value={why} onChange={(e) => setWhy(e.currentTarget.value)} />
          {dlg === "delete" && (
            <Text size="xs" c="dimmed">
              {whole ? "The item leaves the table at every location, but the history is kept." : "Delete removes the pieces from the table, but the history is kept."}
            </Text>
          )}
          <Group justify="flex-end">
            <Button variant="default" onClick={close}>
              Cancel
            </Button>
            <Button color={dlg === "delete" ? "red" : undefined} onClick={dlg === "delete" ? doDelete : doMove} loading={busy} data-submit={dlg}>
              {dlg === "delete" ? "Delete" : "Move"}
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal opened={dlg === "defect"} onClose={close} title="Defect Product → Demo" centered>
        <Stack>
          <Select label="Item" data={itemData} value={itemId} onChange={setItemId} allowDeselect={false} searchable />
          <Select label="To" data={siteData} value={to} onChange={setTo} allowDeselect={false} />
          <NumberInput label="Qty" value={qty} onChange={setQty} min={1} allowDecimal={false} />
          <TextInput label="Reason" placeholder="e.g. wheel cracked, still fine to teach with" value={why} onChange={(e) => setWhy(e.currentTarget.value)} />
          <Group justify="flex-end">
            <Button variant="default" onClick={close}>
              Cancel
            </Button>
            <Button onClick={doDefect} loading={busy} data-submit="defect">
              Save
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal opened={dlg === "location"} onClose={close} title="Add Location" centered>
        <Stack>
          <TextInput label="Location" placeholder="e.g. ISB" value={newSite} onChange={(e) => setNewSite(e.currentTarget.value)} data-autofocus />
          <Group justify="flex-end">
            <Button variant="default" onClick={close}>
              Cancel
            </Button>
            <Button onClick={doLocation} loading={busy} data-submit="location">
              Save
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal opened={dlg === "order"} onClose={close} title="Location Order" centered>
        <Stack gap="xs">
          {ids.map((id, i) => (
            <Group key={id} justify="space-between" wrap="nowrap" data-order-row>
              <Text>
                {i + 1}. {nameOfSite(id)}
              </Text>
              <Group gap={4}>
                <ActionIcon variant="default" aria-label={`Move ${nameOfSite(id)} up`} disabled={i === 0} onClick={() => setIds((x) => swapIds(x, i, -1))}>
                  <ArrowUp size={14} />
                </ActionIcon>
                <ActionIcon variant="default" aria-label={`Move ${nameOfSite(id)} down`} disabled={i === ids.length - 1} onClick={() => setIds((x) => swapIds(x, i, 1))}>
                  <ArrowDown size={14} />
                </ActionIcon>
              </Group>
            </Group>
          ))}
          <Group justify="flex-end" mt="sm">
            <Button onClick={doOrder} loading={busy} data-submit="order">
              Done
            </Button>
          </Group>
        </Stack>
      </Modal>
    </div>
  );
}
