import { notFound } from "next/navigation";
import { requireDebugTools } from "@/server/debug-tools/require-debug-tools";
import { fileContentReviewRepository } from "@/server/contextual-content-review/file-content-review-repository";
import { isContextualContentReviewEnabled } from "@/server/contextual-content-review/gates";
import { projectContentReviewPacket } from "@/server/contextual-content-review/project-review-packet";
import { findReviewTarget } from "@/server/contextual-content-review/review-target-registry";
import { submitContentReviewDecision } from "../../actions";
import { ReviewWorkspace } from "../../review-workspace";

export const dynamic = "force-dynamic";

export default async function ContextualContentReviewTargetPage({
  params,
}: {
  params: Promise<{ packId: string; targetSlug: string }>;
}) {
  requireDebugTools();
  if (!isContextualContentReviewEnabled()) {
    notFound();
  }
  const { packId, targetSlug } = await params;
  const spec = findReviewTarget({ routePackId: packId, targetSlug });
  if (!spec) {
    notFound();
  }
  const record = await fileContentReviewRepository.get(spec.reviewKey);
  const packet = projectContentReviewPacket({ spec, record });
  if (!packet) {
    notFound();
  }
  return <ReviewWorkspace packet={packet} onSubmit={submitContentReviewDecision} />;
}
