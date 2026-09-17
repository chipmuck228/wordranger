import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  CURATED_PLACEMENT_VERSION,
  cloneCuratedOverride,
  serializeCuratedWordPlacementFile,
  type CuratedPlacementOverride,
  type CuratedWordPlacementFile,
} from "@/domain/vocabulary/curated-placement";
import { curatedPlacementIssues } from "@/domain/vocabulary/validate-curated-placement";
import type { PlacementBandDefinition } from "@/domain/vocabulary/provisional-placement";
import { defaultVocabularyDataRoot } from "./load-vocabulary-dataset";

export interface CuratedPlacementStore {
  list(): Promise<CuratedPlacementOverride[]>;
  upsert(record: CuratedPlacementOverride): Promise<CuratedPlacementOverride>;
}

export class InMemoryCuratedPlacementStore implements CuratedPlacementStore {
  private readonly records = new Map<string, CuratedPlacementOverride>();

  constructor(seed: readonly CuratedPlacementOverride[] = []) {
    for (const record of seed) {
      this.records.set(record.lexemeId, cloneCuratedOverride(record));
    }
  }

  async list(): Promise<CuratedPlacementOverride[]> {
    return [...this.records.values()]
      .map(cloneCuratedOverride)
      .sort((left, right) => left.lexemeId.localeCompare(right.lexemeId));
  }

  async upsert(
    record: CuratedPlacementOverride,
  ): Promise<CuratedPlacementOverride> {
    const stored = cloneCuratedOverride(record);
    this.records.set(stored.lexemeId, stored);
    return cloneCuratedOverride(stored);
  }
}

export function curatedPlacementFilePath(
  dataRoot = defaultVocabularyDataRoot(),
): string {
  return path.join(dataRoot, "placement", "curated-word-placement.json");
}

export class FileCuratedPlacementStore implements CuratedPlacementStore {
  constructor(
    private readonly filePath = curatedPlacementFilePath(),
    private readonly definition?: PlacementBandDefinition,
    private readonly lexemeIds?: ReadonlySet<string>,
    private readonly canonicalKeys?: ReadonlySet<string>,
  ) {}

  async list(): Promise<CuratedPlacementOverride[]> {
    return this.readFile().records.map(cloneCuratedOverride);
  }

  async upsert(
    record: CuratedPlacementOverride,
  ): Promise<CuratedPlacementOverride> {
    const file = this.readFile();
    const next = file.records.filter(
      (existing) => existing.lexemeId !== record.lexemeId,
    );
    next.push(cloneCuratedOverride(record));
    next.sort((left, right) => left.lexemeId.localeCompare(right.lexemeId));
    this.writeFile({ version: CURATED_PLACEMENT_VERSION, records: next });
    return cloneCuratedOverride(record);
  }

  private readFile(): CuratedWordPlacementFile {
    let parsed: CuratedWordPlacementFile;
    try {
      parsed = JSON.parse(readFileSync(this.filePath, "utf8")) as CuratedWordPlacementFile;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return { version: CURATED_PLACEMENT_VERSION, records: [] };
      }
      throw error;
    }
    const records = Array.isArray(parsed.records) ? parsed.records : [];
    if (this.definition && this.lexemeIds) {
      const issues = curatedPlacementIssues({
        definition: this.definition,
        records,
        lexemeIds: this.lexemeIds,
        canonicalKeys: this.canonicalKeys,
      });
      if (issues.length > 0) {
        throw new Error(
          `Bundled curated placement is invalid:\n${issues
            .map((issue) => `${issue.code}: ${issue.message}`)
            .join("\n")}`,
        );
      }
    }
    return {
      version: parsed.version ?? CURATED_PLACEMENT_VERSION,
      records: records.map(cloneCuratedOverride),
    };
  }

  private writeFile(file: CuratedWordPlacementFile): void {
    const serialized = serializeCuratedWordPlacementFile(file);
    mkdirSync(path.dirname(this.filePath), { recursive: true });
    const tempPath = `${this.filePath}.${process.pid}.tmp`;
    try {
      writeFileSync(tempPath, serialized, "utf8");
      renameSync(tempPath, this.filePath);
    } catch (error) {
      throw new CuratedPlacementWriteError(
        `Cannot persist curated placement to ${this.filePath}. Review writes are local/internal file tooling and are not available on a read-only deploy filesystem.`,
        error,
      );
    }
  }
}

export class CuratedPlacementWriteError extends Error {
  readonly causeError: unknown;

  constructor(message: string, causeError: unknown) {
    super(message);
    this.name = "CuratedPlacementWriteError";
    this.causeError = causeError;
  }
}

