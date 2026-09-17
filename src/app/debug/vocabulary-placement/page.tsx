import { loadPlacementReviewSnapshot } from "./actions";
import { VocabularyPlacementReviewLab } from "./vocabulary-placement-review-lab";

export const dynamic = "force-dynamic";

export default async function VocabularyPlacementReviewPage() {
  const snapshot = await loadPlacementReviewSnapshot();
  return <VocabularyPlacementReviewLab snapshot={snapshot} />;
}
