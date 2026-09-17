export type StudentActionIntent = { kind: "CHOICE"; optionId: string };

export interface MatchingPresentation {
  instruction: string;
  targetText: string;
  options: Array<{
    id: string;
    text: string;
  }>;
}
