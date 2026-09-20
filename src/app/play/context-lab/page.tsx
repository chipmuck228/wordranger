import { notFound } from "next/navigation";
import { loadContextLabPage } from "@/server/context-lab/load-context-lab-page";
import {
  acknowledgeContextLabGuidedActivity,
  loadCurrentMealContextLab,
  restartMealContextLab,
  startMealContextLab,
} from "./actions";
import { ContextLabClient } from "./context-lab-client";

export const dynamic = "force-dynamic";

/**
 * One request creates one experimental run. Refresh is a new request and
 * therefore a new run. The client does not start again on remount.
 */
export default async function ContextLabPage() {
  const loaded = loadContextLabPage();
  if (loaded.kind === "NOT_FOUND") {
    notFound();
  }
  const initialScreen = await startMealContextLab();
  return (
    <ContextLabClient
      initialScreen={initialScreen}
      start={startMealContextLab}
      acknowledge={acknowledgeContextLabGuidedActivity}
      restart={restartMealContextLab}
      loadCurrent={loadCurrentMealContextLab}
    />
  );
}
