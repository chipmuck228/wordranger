import { notFound } from "next/navigation";
import { isContextualContentReleaseEnabled } from "@/server/contextual-content-release/gates";
import { projectReleaseWorkspace } from "@/server/contextual-content-release/project-release-workspace";
import { requireDebugTools } from "@/server/debug-tools/require-debug-tools";
import { ReleaseWorkspace } from "./release-workspace";

export const dynamic = "force-dynamic";

export default async function ContextualContentReleasePage() {
  requireDebugTools();
  if (!isContextualContentReleaseEnabled()) {
    notFound();
  }
  const workspace = await projectReleaseWorkspace();
  return <ReleaseWorkspace initial={workspace} />;
}
