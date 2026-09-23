import { HomePage } from "@/components/home/home-page";
import { DEBUG_TOOL_LINKS } from "@/server/debug-tools/debug-tool-links";
import { isDebugToolsEnabled } from "@/server/debug-tools/is-debug-tools-enabled";
import { resolveHomeLearningPaths } from "@/server/home/resolve-home-learning-paths";

export const dynamic = "force-dynamic";

export default function Home() {
  const debugTools = isDebugToolsEnabled() ? DEBUG_TOOL_LINKS : [];
  const paths = resolveHomeLearningPaths();
  return <HomePage debugTools={debugTools} paths={paths} />;
}
