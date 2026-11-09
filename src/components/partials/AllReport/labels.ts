import type { CourseKind } from "@/types/app/reports";

// 🟡 PENDING (Khwan): every label on the All Report pages is a default; her answer may rename them (SPEC-103 §6).
export const BRANCH_OPTIONS = [
  { value: "ALL", label: "All" },
  { value: "BRAVO", label: "Bravo" },
  { value: "OTHER", label: "Other" },
];

export const KIND_LABEL: Record<CourseKind, string> = { PRIVATE: "Private", DUO: "Duo", VOUCHER: "Voucher" };

export const STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
  { value: "ALL", label: "All" },
];
