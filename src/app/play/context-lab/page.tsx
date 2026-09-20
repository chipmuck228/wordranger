import { notFound } from "next/navigation";
import { loadContextLabPage } from "@/server/context-lab/load-context-lab-page";
import { ContextLabClient } from "./context-lab-client";

export const dynamic = "force-dynamic";

export default function ContextLabPage() {
  const loaded = loadContextLabPage();
  if (loaded.kind === "NOT_FOUND") {
    notFound();
  }
  return <ContextLabClient payload={loaded.payload} />;
}
