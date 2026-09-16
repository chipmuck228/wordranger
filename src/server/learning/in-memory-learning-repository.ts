import type { LearningEvidence } from "@/domain/learning/evidence.types";
import type { LearningRepository } from "@/domain/learning/learning-repository";
import type { StudentWordModel } from "@/domain/learning/student-word-model";

function key(userId: string, wordId: string): string {
  return `${userId}::${wordId}`;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

export class InMemoryLearningRepository implements LearningRepository {
  private readonly models = new Map<string, StudentWordModel>();
  private evidence: LearningEvidence[] = [];

  async getStudentWordModel(
    userId: string,
    wordId: string,
  ): Promise<StudentWordModel | null> {
    const model = this.models.get(key(userId, wordId));
    return model ? clone(model) : null;
  }

  async getEvidenceForWord(
    userId: string,
    wordId: string,
  ): Promise<LearningEvidence[]> {
    return clone(
      this.evidence.filter(
        (item) => item.userId === userId && item.wordId === wordId,
      ),
    );
  }

  async getRecentEvidence(
    userId: string,
    wordId: string,
    limit = 20,
  ): Promise<LearningEvidence[]> {
    const items = await this.getEvidenceForWord(userId, wordId);
    return items
      .sort(
        (left, right) =>
          Date.parse(right.occurredAt) - Date.parse(left.occurredAt),
      )
      .slice(0, limit);
  }

  async appendEvidence(evidence: LearningEvidence): Promise<void> {
    if (this.evidence.some((item) => item.id === evidence.id)) {
      throw new Error(`Evidence ${evidence.id} already exists`);
    }
    this.evidence.push(clone(evidence));
  }

  async saveStudentWordModel(model: StudentWordModel): Promise<void> {
    this.models.set(key(model.userId, model.wordId), clone(model));
  }

  async commitEvidenceAndSnapshot(
    evidence: LearningEvidence,
    model: StudentWordModel,
  ): Promise<void> {
    const evidenceSnapshot = clone(this.evidence);
    const modelSnapshot = new Map(this.models);
    try {
      await this.appendEvidence(evidence);
      await this.saveStudentWordModel(model);
    } catch (error) {
      this.evidence = evidenceSnapshot;
      this.models.clear();
      for (const [mapKey, value] of modelSnapshot) {
        this.models.set(mapKey, value);
      }
      throw error;
    }
  }

  reset(): void {
    this.models.clear();
    this.evidence = [];
  }
}
