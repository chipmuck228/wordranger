import { notFound } from "next/navigation";
import { isDebugToolsEnabled } from "./is-debug-tools-enabled";

export function requireDebugTools(
  env: Record<string, string | undefined> = process.env,
): void {
  if (!isDebugToolsEnabled(env)) {
    notFound();
  }
}
