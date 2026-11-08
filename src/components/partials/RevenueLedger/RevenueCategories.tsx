"use client";

import { useMemo, useState } from "react";
import { Badge, Button, Card, Grid, Group, Modal, Select, Stack, Text, TextInput } from "@mantine/core";
import { Plus } from "lucide-react";
import { useCreateRevenueCategory, useRevenueCategories } from "./hooks";
import { TYPE_LABEL } from "./labels";
import { EmptyState, ErrorState, LoadingState, PageHeader } from "./parts";
import { ApiClientError } from "@/lib/api/client";
import { REVENUE_TYPES, type RevenueCategory, type RevenueType } from "@/types/app/revenue-ledger";

const TYPE_OPTIONS = REVENUE_TYPES.map((t) => ({ value: t, label: TYPE_LABEL[t] }));
const NAME_MAX = 60; // SPEC-098 §3

function Tags({ names }: { names: string[] }) {
  return (
    <Group gap={6}>
      {names.map((n) => (
        <Badge key={n} variant="light" color="gray" radius="sm" w="max-content" maw="none">
          {n}
        </Badge>
      ))}
    </Group>
  );
}

/** Type and Category: the tree from `GET /categories` plus the add dialog (TASK-859 §6). */
export default function RevenueCategories() {
  const query = useRevenueCategories();
  const create = useCreateRevenueCategory();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<RevenueType>("COURSE");
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);

  // COURSE names read "<Sport> · <Sub>"; a COURSE name without the dot is an "Other Course".
  const { sports, otherCourse, byType } = useMemo(() => {
    const all: RevenueCategory[] = query.data ?? [];
    const course = all.filter((c) => c.type === "COURSE");
    const sportMap = new Map<string, string[]>();
    const other: string[] = [];
    for (const c of course) {
      const [sport, sub] = c.name.split(" · ");
      if (sub === undefined) other.push(c.name);
      else sportMap.set(sport, [...(sportMap.get(sport) ?? []), sub]);
    }
    return {
      sports: [...sportMap.entries()],
      otherCourse: other,
      byType: REVENUE_TYPES.filter((t) => t !== "COURSE").map((t) => ({
        type: t,
        names: all.filter((c) => c.type === t).map((c) => c.name),
      })),
    };
  }, [query.data]);

  const close = () => {
    setOpen(false);
    setName("");
    setNameError(null);
    create.reset();
  };

  const save = () => {
    const n = name.trim();
    if (!n) return setNameError("Enter a category name");
    if (n.length > NAME_MAX) return setNameError(`At most ${NAME_MAX} characters`);
    setNameError(null);
    create.mutate({ type, name: n }, { onSuccess: close });
  };

  const serverError =
    create.error instanceof ApiClientError && create.error.status === 409
      ? "This category already exists"
      : create.isError
        ? create.error.message
        : null;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Type and Category</h1>
        <Button leftSection={<Plus size={16} />} onClick={() => setOpen(true)}>
          Add
        </Button>
      </div>

      {query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : query.isLoading ? (
        <LoadingState />
      ) : (query.data ?? []).length === 0 ? (
        <Card>
          <EmptyState>No categories yet</EmptyState>
        </Card>
      ) : (
        <Stack gap="md">
          <Card>
            <Group justify="space-between" mb="sm">
              <Text fw={600}>COURSE</Text>
              <Badge variant="light">Sports</Badge>
            </Group>
            <Grid gap="sm">
              {sports.map(([sport, subs]) => (
                <Grid.Col key={sport} span={{ base: 12, sm: 6, md: 4 }}>
                  <div className="rounded-md border border-default-200/70 p-3">
                    <Text fw={600} size="sm" mb={6}>
                      {sport}
                    </Text>
                    <Tags names={subs} />
                  </div>
                </Grid.Col>
              ))}
            </Grid>
          </Card>
          {otherCourse.length > 0 && (
            <Card>
              <Text fw={600} mb="sm">
                Other Course
              </Text>
              <Tags names={otherCourse} />
            </Card>
          )}
          <Card>
            <Text fw={600} mb="sm">
              Other Type
            </Text>
            <Grid gap="sm">
              {byType.map((t) => (
                <Grid.Col key={t.type} span={{ base: 12, sm: 6, md: 4 }}>
                  <div className="rounded-md border border-default-200/70 p-3">
                    <Text fw={600} size="sm" mb={6}>
                      {TYPE_LABEL[t.type]}
                    </Text>
                    <Tags names={t.names} />
                  </div>
                </Grid.Col>
              ))}
            </Grid>
          </Card>
        </Stack>
      )}

      <Modal opened={open} onClose={close} title="Add category" centered>
        <Stack>
          <Select
            label="Type"
            data={TYPE_OPTIONS}
            value={type}
            onChange={(v) => setType((v as RevenueType) ?? "COURSE")}
            allowDeselect={false}
          />
          <TextInput
            label="New category"
            placeholder="e.g. Roller derby"
            value={name}
            onChange={(e) => {
              setName(e.currentTarget.value);
              setNameError(null);
              create.reset();
            }}
            error={nameError ?? serverError}
            maxLength={NAME_MAX + 20}
            data-autofocus
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={close}>
              Cancel
            </Button>
            <Button onClick={save} loading={create.isPending}>
              Save
            </Button>
          </Group>
        </Stack>
      </Modal>
    </div>
  );
}
