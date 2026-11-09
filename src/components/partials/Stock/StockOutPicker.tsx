"use client";

import { useState } from "react";
import { Button, Card, Table, Text } from "@mantine/core";
import StockProductPicker from "./StockProductPicker";
import { useStockProducts } from "./StockData";
import { addToCart, bahtText, removeFromCart } from "./stock-picker-logic";
import { useRole } from "@/context/RoleContext";
import { ErrorState, LoadingState } from "@/components/partials/Salary/parts";
import { PageTitle } from "@/components/partials/Salary/PeopleParts";
import type { CartStubRow, StockProduct } from "@/types/app/stock";

/** The picker + the cart STUB: what has been picked so far, with Remove. The real cart (several items, the discount, the buyer, the branch, the commission) is a later TASK; this one is the picker + search + «add to cart». */
export function StockOutPickerBody({ products }: { products: StockProduct[] }) {
  const [cart, setCart] = useState<CartStubRow[]>([]);
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageTitle title="STOCK OUT" />
      <Card padding="md">
        <StockProductPicker products={products} onAdd={(p) => setCart((c) => addToCart(c, p))} />
      </Card>
      {cart.length > 0 && (
        <Card padding={0} data-cart-stub>
          <Table.ScrollContainer minWidth={420}>
            <Table verticalSpacing="xs" horizontalSpacing="md">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>MODEL CODE</Table.Th>
                  <Table.Th>PRODUCT NAME</Table.Th>
                  <Table.Th ta="right">PRICE</Table.Th>
                  <Table.Th ta="right">QUANTITY</Table.Th>
                  <Table.Th />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {cart.map((r) => (
                  <Table.Tr key={r.product.id} data-cart-row={r.product.code}>
                    <Table.Td ff="monospace" fz="xs">
                      {r.product.code}
                    </Table.Td>
                    <Table.Td fw={600}>{r.product.name}</Table.Td>
                    <Table.Td ta="right" className="tabular-nums">
                      {bahtText(r.product.priceSatang)}
                    </Table.Td>
                    <Table.Td ta="right" className="tabular-nums">
                      {r.quantity}
                    </Table.Td>
                    <Table.Td ta="right">
                      <Button size="compact-xs" variant="subtle" onClick={() => setCart((c) => removeFromCart(c, r.product.id))}>
                        Remove
                      </Button>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Card>
      )}
      {products.length === 0 && (
        <Text c="dimmed" size="sm" ta="center">
          {/* PENDING (Porter): not in the final UI */}
          No product found
        </Text>
      )}
    </div>
  );
}

/** Not routed yet (Silver: no Stock Out route wiring until Sober answers): the host a later TASK mounts at the Stock Out page. */
export default function StockOutPicker() {
  const role = useRole();
  const q = useStockProducts(role);
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (!role || !q.data) return <LoadingState />;
  return <StockOutPickerBody products={q.data} />;
}
