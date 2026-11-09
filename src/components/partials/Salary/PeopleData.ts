"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as svc from "@/services/salary-people.service";
import type { Role } from "@/types/app/roles";
import type { FlChange, PersonProfile, ProfileEdit } from "@/types/app/salary-people";

// The role is part of every key: an Admin's answer has fewer fields, and must never be served from a CEO's cache entry.
const ROOT = ["salary-people"] as const;

export const usePeople = (role: Role | null) =>
  useQuery({ queryKey: [...ROOT, "people", role], queryFn: () => svc.listPeople(role as Role), enabled: role !== null });

export const useProfile = (who: string, role: Role | null) =>
  useQuery({ queryKey: [...ROOT, "profile", who, role], queryFn: () => svc.getProfile(who, role as Role), enabled: role !== null && who !== "" });

export const usePaymentSettings = (role: Role | null) =>
  useQuery({ queryKey: [...ROOT, "settings", role], queryFn: () => svc.getPaymentSettings(role as Role), enabled: role !== null });

export const useDaily = (date: string, role: Role | null) =>
  useQuery({ queryKey: [...ROOT, "daily", date, role], queryFn: () => svc.getDaily(date, role as Role), enabled: role !== null && date !== "" });

/** A save moves the person's card and the list (the base shows there). */
export function useSaveProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { teacherId: string; raw: NonNullable<PersonProfile["raw"]>; edit: ProfileEdit }) => svc.saveProfile(v.teacherId, v.raw, v.edit),
    onSuccess: () => qc.invalidateQueries({ queryKey: ROOT }),
  });
}

/** TASK-899 — one PUT per changed class type; the query is re-read after, so the card shows what the server holds (also after a partial failure). */
export function useSaveFlRates() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { teacherId: string; changes: FlChange[] }) => svc.saveFlRates(v.teacherId, v.changes),
    onSettled: () => qc.invalidateQueries({ queryKey: ROOT }),
  });
}

export function useAddSchool() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (v: { name: string; km: number }) => svc.addSchool(v.name, v.km), onSuccess: () => qc.invalidateQueries({ queryKey: [...ROOT, "settings"] }) });
}

export function useUpdateSchool() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (v: { id: string; km: number }) => svc.updateSchoolKm(v.id, v.km), onSuccess: () => qc.invalidateQueries({ queryKey: [...ROOT, "settings"] }) });
}
