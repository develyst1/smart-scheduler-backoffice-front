"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listNotificationCoaches, listNotificationRecipients, listNotifications, markAllNotificationsRead, markNotificationRead } from "@/services/notification.service";
import type { Role } from "@/types/app/roles";

// The role is part of every key: a Coach's (empty) answer must never be served to a CEO.
export const useNotificationRecipients = (role: Role | null) => useQuery({ queryKey: ["notify", "recipients", role], queryFn: () => listNotificationRecipients(role as Role), enabled: role !== null });

export const useNotificationCoaches = (role: Role | null) => useQuery({ queryKey: ["notify", "coaches", role], queryFn: () => listNotificationCoaches(role as Role), enabled: role !== null });

export const useNotifications = (role: Role | null) => useQuery({ queryKey: ["notify", "feed", role], queryFn: () => listNotifications(role as Role), enabled: role !== null });

export function useMarkRead(role: Role | null) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => markNotificationRead(role as Role, id), onSuccess: () => qc.invalidateQueries({ queryKey: ["notify", "feed"] }) });
}

export function useMarkAllRead(role: Role | null) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: () => markAllNotificationsRead(role as Role), onSuccess: () => qc.invalidateQueries({ queryKey: ["notify", "feed"] }) });
}
