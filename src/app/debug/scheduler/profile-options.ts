export type SchedulerDebugProfileId =
  | "new"
  | "review"
  | "fading"
  | "weakness"
  | "mixed";

export const SCHEDULER_DEBUG_PROFILES: Array<{
  id: SchedulerDebugProfileId;
  label: string;
  description: string;
}> = [
  {
    id: "new",
    label: "Mostly new learner",
    description: "Two exposed words; the rest of the vocabulary is unseen.",
  },
  {
    id: "review",
    label: "Review-heavy learner",
    description: "Many due reviews across recognized and connected words.",
  },
  {
    id: "fading",
    label: "Fading learner",
    description: "Known words whose retention state is FADING.",
  },
  {
    id: "weakness",
    label: "Weakness-heavy learner",
    description: "Unresolved spelling, confusion, and recall weaknesses.",
  },
  {
    id: "mixed",
    label: "Mixed realistic profile",
    description: "Reviews, weaknesses, fading, a usable word, and a user mark.",
  },
];
