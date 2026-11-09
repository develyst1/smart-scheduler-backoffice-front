"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { admitLogin, deactivateLogin, listLogins, reactivateLogin } from "@/services/users.service";
import type { Role } from "@/types/app/roles";
import type { AdmitLoginInput } from "@/types/app/users";

// The role is part of the key: a non-CEO's refusal must never be served to the CEO. A write refreshes the list.
const ROOT = ["users"] as const;

export const useLogins = (role: Role | null) => useQuery({ queryKey: [...ROOT, "list", role], queryFn: () => listLogins(role), enabled: role !== null });

function useWrite<I>(role: Role | null, fn: (input: I, role: Role | null) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (input: I) => fn(input, role), onSuccess: () => qc.invalidateQueries({ queryKey: ROOT }) });
}

export const useAdmitLogin = (role: Role | null) => useWrite<AdmitLoginInput>(role, admitLogin);
export const useDeactivateLogin = (role: Role | null) => useWrite<string>(role, deactivateLogin);
export const useReactivateLogin = (role: Role | null) => useWrite<string>(role, reactivateLogin);
