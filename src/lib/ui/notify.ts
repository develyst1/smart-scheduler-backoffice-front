import { notifications } from "@mantine/notifications";
import { MANTINE_COLOR, type SemanticColor } from "./colors";

// Thin wrapper so partials call notify({ title, description, color }) without
// touching Mantine's notification API directly.
export function notify(opts: {
  title: string;
  description?: string;
  color?: SemanticColor;
}) {
  notifications.show({
    title: opts.title,
    message: opts.description ?? "",
    color: MANTINE_COLOR[opts.color ?? "default"],
  });
}
