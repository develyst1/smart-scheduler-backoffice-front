"use client";

import { useMutation } from "@tanstack/react-query";
import { applyStockImport, previewStockImport } from "@/services/stock-import.service";
import type { Role } from "@/types/app/roles";
import type { ImportPreview } from "@/types/app/stock-import";

// Both are mutations: a preview and an apply are actions, never cached reads. The role goes in with the call.
export const usePreviewImport = (role: Role | null) =>
  useMutation({ mutationFn: (file: File) => previewStockImport(file, role as Role) });

export const useApplyImport = (role: Role | null) =>
  useMutation({ mutationFn: (preview: ImportPreview) => applyStockImport(preview, role as Role) });
