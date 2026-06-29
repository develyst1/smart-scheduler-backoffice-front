# Requirement — smart-scheduler-backoffice-front (Backoffice Web)

เอกสารความต้องการเฉพาะ repo นี้ — สัญญา **Option C (Ultimate)** · consumer ของ
**`smart-scheduler-backoffice-back`** (Finance & Operations API)

> **บทบาทหลัก:** หน้าจอ **admin/owner** — รายงาน · อนุมัติ flow เงิน · จัดการสต๊อก · ตรวจ payroll  
> **ไม่ใช่** หน้าจองตาราง (อยู่ที่ `smart-scheduler-front`)

---

## 1. เป้าหมาย

| เป้าหมาย | รายละเอียด |
|---------|------------|
| แทน Alis To Soft | ดูยอด wallet, สต๊อก, ค่าจ้างครู ในที่เดียว |
| Admin-first | ซื้อคอร์สผ่าน LINE → admin approve → เติม wallet (ลูกค้าไม่ทำเอง) |
| รายงาน | P&L, สรุปรายได้-รายจ่าย, หลายกิจการ (อนาคต) |
| สอดคล้อง scheduling | แสดงเรทครูที่ scheduling ใช้ · ไม่ duplicate logic คำนวณ |

---

## 2. Stack & สถาปัตยกรรม

### 2.1 Stack (locked)

- **Next.js 16** App Router · **React 19** · TypeScript strict
- **Mantine v9** · **Tailwind v3** · **TanStack Query v5** · **Axios** · **dayjs** · **lucide-react**
- **bun** · alias `@/*` → `./src/*`

### 2.2 Layering (เหมือน `smart-scheduler-front` — ไม่ต้อง copy 100%)

```
page (thin) → *Content partial → hook → service → Backoffice API
types/app/<domain>     — labels, enums, display maps
lib/<domain>/*.ts      — pure format/calc สำหรับ UI (ไม่ authoritative)
lib/ui/*               — notify, colors (semantic → Mantine)
services/*.service.ts  — Axios / hc<AppType> เท่านั้น
```

**กฎ:** เงิน/ชั่วโมง/สต๊อกที่แสดง = จาก API · client **format only** · toast ผ่าน `notify()`

---

## 3. UI / Theme

### 3.1 โทนกลาง (Dark แบบเทา-ดำ — ไม่มืดจนอ่านยาก)

| องค์ประกอบ | แนวทาง |
|-----------|--------|
| พื้นหลัง | `gray.9` / `#1a1b1e` — ไม่ใช้ `#000` |
| Surface/card | `gray.8` + border `gray.7` |
| ข้อความหลัก | `gray.0`–`gray.2` |
| ข้อความรอง | `gray.5` |
| Primary accent | `blue` หรือ `teal` อ่อน — ไม่ neon |
| Semantic | success/warning/danger แบบ restrained เหมือน frontoffice |

ใช้ Mantine `MantineProvider theme={{ colorScheme: 'dark', ... }}` + Tailwind semantic tokens ใน
`src/lib/ui/colors.ts` (แยกจาก frontoffice ได้ — palette โทนเทา)

### 3.2 UX

- ภาษา **ไทย** · คำศัพท์ domain เดียวกับ frontoffice
- ตาราง + filter + pagination สำหรับ ledger / movements
- Modal สำหรับ approve/reject · รับของเข้า · ขาย POS
- **ไม่** ใส่ LINE token ใน browser

---

## 4. หน้าจอ / โมดูล (MVP → เต็ม Option C)

### 4.1 Dashboard

- การ์ดสรุป: ยอด wallet รวม · สินค้าใกล้หมด · payroll รอบล่าสุด · รายได้/จ่ายเดือนนี้
- ลิงก์ไปรายละเอียด

### 4.2 Inventory

| หน้า | ฟังก์ชัน |
|------|----------|
| รายการสินค้า | CRUD SKU, ดู qty คงเหลือ |
| รับเข้า / ปรับยอด | ฟอร์ม movement IN/ADJUST |
| ขาย (POS) | เลือกสินค้า + qty → ตัดสต๊อก |
| ประวัติ movement | ตาราง audit ต่อ SKU |

### 4.3 Wallet & การซื้อคอร์ส (admin-mediated)

| หน้า | ฟังก์ชัน |
|------|----------|
| กระเป๋านักเรียน | ยอดชั่วโมงคงเหลือ + ledger |
| คำขอซื้อ (จาก LINE) | คิว `PENDING_APPROVAL` → approve/reject |
| เติมมือ (กรณีพิเศษ) | top-up พร้อม note + audit |

Flow ที่ user ต้องการ:

```
ลูกค้าคุย/ตกลงทาง LINE → ระบบ/แอดมินบันทึก intent
→ แอดมิน backoffice ตรวจ + อนุมัติ
→ wallet เติมทีละนัด (หรือครั้งเดียวตาม package)
→ scheduling staff ใช้สิทธิ์จองให้บน web frontoffice
```

### 4.4 ครู & Payroll

| หน้า | ฟังก์ชัน |
|------|----------|
| เรทครู | ตั้ง hourly rate, income limit (Freelance) |
| รอบ payroll | สร้าง draft จากชั่วโมง ATTENDED · แก้ commission/ค่ารถ · finalize |
| สรุปรายได้ครู | รายเดือนต่อคน |

### 4.5 Reports

| รายงาน | เนื้อหา |
|--------|---------|
| P&L | รายได้ (ขาย/คอร์ส) vs รายจ่าย (ค่าจ้าง/commission/ค่ารถ) |
| Inventory valuation | มูลค่าสต๊อก |
| Wallet summary | เติม vs ใช้ ต่อช่วงเวลา |
| Multi-business (อนาคต) | filter ตาม business unit · รวมหลายกิจการ |

---

## 5. Integration ที่มองเห็นจาก UI

- ทุก mutation → เรียก Backoffice API → invalidate TanStack Query
- แสดงสถานะ LINE notify (queued/skipped) หลัง approve/deduct ถ้า API ส่งกลับ
- Deep link ไป scheduling (optional): เปิด frontoffice ที่ booking ของนักเรียน

---

## 6. Non-goals (v1 UI)

- ปฏิทินจองเรียน (อยู่ frontoffice)
- ลูกค้า/parent login ดู wallet เอง
- Mobile app native

---

## 7. Deliverables ตามลำดับ (แนะนำ)

1. Scaffold Next + Mantine dark theme + layout admin + Query/Axios
2. Inventory module (list + IN/OUT + history)
3. Wallet list + ledger + approve purchase intent
4. Teacher rates screen
5. Payroll run UI
6. Reports dashboard + P&L

---

## อ้างอิง

- Backoffice API spec: [../../smart-scheduler-backoffice-back/docs/requirement.md](../../smart-scheduler-backoffice-back/docs/requirement.md)
- Pattern อ้างอิง: [../../smart-scheduler-front/CLAUDE.md](../../smart-scheduler-front/CLAUDE.md)
- [todo.md](../todo.md) · [CLAUDE.md](../CLAUDE.md)
