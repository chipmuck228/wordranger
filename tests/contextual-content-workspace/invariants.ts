/**
 * Contextual content test-workspace invariants.
 *
 * 1. Ordinary tests must not treat the repository docs/content workspace as a
 *    writable fixture.
 * 2. Every writable file runtime uses a per-test or per-worker temp root.
 * 3. Temp roots are created with mkdtemp (or an equivalent exclusive create).
 * 4. Cleanup may delete only the temp root this helper created and holds.
 * 5. Cleanup resolves the target and requires it to be that temp root.
 * 6. Cleanup must refuse: repository root, docs/, docs/contextual-content-*,
 *    configured human review/promotion/release roots, cwd, and parent dirs.
 * 7. Ordinary E2E must pass without local human artifacts.
 * 8. Real-release acceptance may read human artifacts but must not write or
 *    clean them.
 * 9. Failure, interrupt, or assertion throw still only cleans the temp root.
 * 10. Parallel workers never share a fixture directory.
 *
 * Snapshot-and-restore of real files is not the isolation mechanism.
 */

export const CONTEXTUAL_CONTENT_TEST_WORKSPACE_KIND = "SYNTHETIC_TEST_ONLY" as const;
export const SYNTHETIC_TEST_NOTE = "SYNTHETIC_TEST_ONLY";
export const SYNTHETIC_TEST_PROMOTER = "SYNTHETIC_TEST_PROMOTER";
export const WORKSPACE_MARKER_NAME = ".wordranger-synthetic-test-workspace";
