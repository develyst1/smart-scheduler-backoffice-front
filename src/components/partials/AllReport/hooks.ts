"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import * as svc from "@/services/reports.service";
import type { CoursesParams, OverviewParams, StudentsParams } from "@/types/app/reports";

const ROOT = ["all-report"] as const;

export const useOverview = (params: OverviewParams) => useQuery({ queryKey: [...ROOT, "overview", params], queryFn: () => svc.getOverview(params), placeholderData: keepPreviousData });

export const useCourses = (params: CoursesParams, enabled = true) =>
  useQuery({ queryKey: [...ROOT, "courses", params], queryFn: () => svc.getCourses(params), enabled, placeholderData: keepPreviousData });

export const useStudents = (params: StudentsParams) => useQuery({ queryKey: [...ROOT, "students", params], queryFn: () => svc.getStudents(params), placeholderData: keepPreviousData });
