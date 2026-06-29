# TODO — smart-scheduler-backoffice-front

งาน implement ตาม [docs/requirement.md](docs/requirement.md) · consumer ของ **`smart-scheduler-backoffice-back`**

> สถานะ: ✅ เสร็จ · 🟡 บางส่วน · ❌ ยังไม่มี  
> **[FE]** repo นี้ · **[BE]** ต้องมี API จาก backoffice-back ก่อน

---

## Wave 0 — Scaffold & theme

- [ ] ❌ **[FE] Init Next 16** — copy pattern จาก `smart-scheduler-front` (App Router, bun, tsconfig `@/*`)
- [ ] ❌ **[FE] Mantine v9 + Tailwind v3** — providers ใน `src/context/`
- [ ] ❌ **[FE] Dark theme เทา-ดำ** — `colorScheme: 'dark'`, bg `gray.9`, surface `gray.8`, ไม่ pure black
- [ ] ❌ **[FE] `src/lib/ui/colors.ts` + `notify.ts`** — semantic colors แยกจาก frontoffice (โทนเย็น/เทา)
- [ ] ❌ **[FE] Admin layout** — sidebar nav: Dashboard, สต๊อก, Wallet, ครู/Payroll, รายงาน
- [ ] ❌ **[FE] Axios client** — `NEXT_PUBLIC_BACKOFFICE_API_URL` · error → toast
- [ ] ❌ **[FE] TanStack Query provider + query key conventions**

---

## Wave 1 — Inventory UI

- [ ] ❌ **[FE] หน้ารายการสินค้า** — ตาราง SKU, qty, reorder hint
- [ ] ❌ **[FE] Modal/ฟอร์ม รับของเข้า (IN)**
- [ ] ❌ **[FE] หน้า POS ขาย** — เลือกสินค้า + qty · สรุปยอด · ยืนยันตัดสต๊อก
- [ ] ❌ **[FE] ประวัติ movement** — filter ตาม SKU / วันที่
- [ ] ❌ **[BE→FE] wire `inventory.service.ts` + hooks**

---

## Wave 2 — Wallet & purchase approval

- [ ] ❌ **[FE] รายการ wallet นักเรียน** — ค้นหา · ยอดคงเหลือ
- [ ] ❌ **[FE] หน้า ledger** — ทุก debit/credit · export CSV (optional)
- [ ] ❌ **[FE] คิวคำขอซื้อ (LINE → admin)** — approve / reject + note
- [ ] ❌ **[FE] ฟอร์ม top-up มือ** — กรณีพิเศษ · audit note บังคับ
- [ ] ❌ **[FE] Toast สถานะ LINE** หลัง approve (จาก API response)

---

## Wave 3 — Teachers & payroll

- [ ] ❌ **[FE] ตั้งเรทครู** — hourly rate, income limit (Freelance)
- [ ] ❌ **[FE] สรุปรายได้ครูรายเดือน** — chart/table
- [ ] ❌ **[FE] Payroll run** — สร้าง draft · แก้ commission/ค่ารถ · finalize · ดู PDF/print (optional)

---

## Wave 4 — Reports dashboard

- [ ] ❌ **[FE] Dashboard การ์ดสรุป** — wallet, สต๊อก, payroll, P&L เดือนนี้
- [ ] ❌ **[FE] รายงาน P&L** — filter ช่วงวันที่ · แยกรายได้/รายจ่าย
- [ ] ❌ **[FE] Inventory valuation report**
- [ ] ❌ **[FE] Multi-business filter** — placeholder UI (รอ BE field)

---

## Wave 5 — Polish

- [ ] ❌ **[FE] Loading / empty states** ทุกหน้า
- [ ] ❌ **[FE] Responsive  tablet** (admin ใช้ iPad ได้)
- [ ] ❌ **[FE] `bun run build` CI**

---

## Dependency จาก backoffice-back

| FE งาน | รอ BE endpoint |
|--------|----------------|
| Inventory | `/inventory/*` |
| Wallet | `/wallets/*`, `/purchase-intents/*` |
| Teacher rates | `/teachers/:id/rates`, `income-summary` |
| Payroll | `/payroll/runs/*` |
| Reports | `/reports/*` |

---

## ลำดับแนะนำ

1. Wave 0  
2. Wave 1 (demo สต๊อกให้ลูกค้าเห็น)  
3. Wave 2 (flow admin approve หลัง LINE)  
4. Wave 3–5  
