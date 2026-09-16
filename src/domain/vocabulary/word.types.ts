export interface Word {
  id: string;
  lemma: string;
  displayWord: string;
  difficulty: number | null;
  frequencyRank: number | null;
  createdAt: string;
  updatedAt: string;
}
