"use client";

import { useQuery } from "@tanstack/react-query";
import { getPLReport } from "@/services/reports.service";

export function usePLReport(range: { from?: string; to?: string }) {
  return useQuery({
    queryKey: ["backoffice", "pl", range.from ?? "", range.to ?? ""],
    queryFn: () => getPLReport(range),
  });
}
