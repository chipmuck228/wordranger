import type { LearningEvidence } from "@/domain/learning/evidence.types";
import { LearningDomainError } from "@/domain/learning/engine/math";
import type { LearningRepository } from "@/domain/learning/learning-repository";
import type { StudentLexemeModel } from "@/domain/learning/student-lexeme-model";

function key(userId: string, lexemeId: string): string {
  return `${userId}::${lexemeId}`;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

export class InMemoryLearningRepository implements LearningRepository {
  private readonly models = new Map<string, StudentLexemeModel>();
  private evidence: LearningEvidence[] = [];

  async getStudentLexemeModel(
    userId: string,
    lexemeId: string,
  ): Promise<StudentLexemeModel | null> {
    const model = this.models.get(key(userId, lexemeId));
    return model ? clone(model) : null;
  }

  async getEvidenceForLexeme(
    userId: string,
    lexemeId: string,
  ): Promise<LearningEvidence[]> {
    return clone(
      this.evidence.filter(
        (item) => item.userId === userId && item.lexemeId === lexemeId,
      ),
    );
  }

  async getRecentEvidence(
    userId: string,
    lexemeId: string,
    limit = 20,
  ): Promise<LearningEvidence[]> {
    const items = await this.getEvidenceForLexeme(userId, lexemeId);
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
    if (
      evidence.taskId &&
      this.evidence.some((item) => item.taskId === evidence.taskId)
    ) {
      throw new LearningDomainError(
        "DUPLICATE_TASK_EVIDENCE",
        `Task ${evidence.taskId} already has terminal evidence`,
      );
    }
    this.evidence.push(clone(evidence));
  }

  async saveStudentLexemeModel(model: StudentLexemeModel): Promise<void> {
    this.models.set(key(model.userId, model.lexemeId), clone(model));
  }

  async commitEvidenceAndSnapshot(
    evidence: LearningEvidence,
    model: StudentLexemeModel,
  ): Promise<void> {
    const evidenceSnapshot = clone(this.evidence);
    const modelSnapshot = new Map(this.models);
    try {
      await this.appendEvidence(evidence);
      await this.saveStudentLexemeModel(model);
    } catch (error) {
      this.evidence = evidenceSnapshot;
      this.models.clear();
      for (const [mapKey, value] of modelSnapshot) {
        this.models.set(mapKey, value);
      }
      throw error;
    }
  }

  listStudentLexemeModels(userId: string): StudentLexemeModel[] {
    return [...this.models.values()]
      .filter((model) => model.userId === userId)
      .map((model) => clone(model));
  }

  listEvidenceForUser(userId: string): LearningEvidence[] {
    return clone(this.evidence.filter((item) => item.userId === userId));
  }

  reset(): void {
    this.models.clear();
    this.evidence = [];
  }
}
