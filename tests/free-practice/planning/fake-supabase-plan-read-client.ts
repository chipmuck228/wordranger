import type { SupabaseClient } from "@supabase/supabase-js";

export interface FakeSnapshotRow {
  user_id: string;
  lexeme_id: string;
  mastery_stage: string;
}

export interface FakeEvidenceRow {
  user_id: string;
  id: string;
  lexeme_id: string;
  skill: string;
  outcome: string;
  occurred_at: string;
}

export interface RecordedQuery {
  table: string;
  select: string | null;
  filters: Array<{ column: string; value: unknown }>;
  orders: Array<{ column: string; ascending: boolean }>;
  limit: number | null;
}

class QueryBuilder<T extends object> {
  constructor(
    private readonly rows: T[],
    readonly recorded: RecordedQuery,
  ) {}

  select(columns: string) {
    this.recorded.select = columns;
    return this;
  }

  eq(column: string, value: unknown) {
    this.recorded.filters.push({ column, value });
    return this;
  }

  order(column: string, options: { ascending: boolean }) {
    this.recorded.orders.push({
      column,
      ascending: options.ascending,
    });
    return this;
  }

  limit(count: number) {
    this.recorded.limit = count;
    return this;
  }

  then<TResult1 = { data: T[]; error: null }, TResult2 = never>(
    onfulfilled?:
      | ((value: { data: T[]; error: null }) => TResult1 | PromiseLike<TResult1>)
      | undefined
      | null,
    onrejected?:
      | ((reason: unknown) => TResult2 | PromiseLike<TResult2>)
      | undefined
      | null,
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve({ data: this.execute(), error: null }).then(
      onfulfilled,
      onrejected,
    );
  }

  private execute(): T[] {
    let rows = this.rows.filter((row) =>
      this.recorded.filters.every((filter) => {
        const record = row as Record<string, unknown>;
        return record[filter.column] === filter.value;
      }),
    );
    for (const order of [...this.recorded.orders].reverse()) {
      rows = [...rows].sort((left, right) => {
        const recordLeft = left as Record<string, string>;
        const recordRight = right as Record<string, string>;
        const comparison = recordLeft[order.column].localeCompare(
          recordRight[order.column],
        );
        return order.ascending ? comparison : -comparison;
      });
    }
    if (this.recorded.limit !== null) {
      rows = rows.slice(0, this.recorded.limit);
    }
    return rows;
  }
}

export class FakeFreePracticeSupabaseClient {
  readonly snapshots: FakeSnapshotRow[] = [];
  readonly evidence: FakeEvidenceRow[] = [];
  readonly queries: RecordedQuery[] = [];
  readonly writes: string[] = [];

  seedSnapshot(row: FakeSnapshotRow): void {
    this.snapshots.push(row);
  }

  seedEvidence(row: FakeEvidenceRow): void {
    this.evidence.push(row);
  }

  from = (table: string) => {
    if (table !== "student_lexeme_models" && table !== "learning_evidence") {
      this.writes.push(`unexpected-table:${table}`);
    }
    const recorded: RecordedQuery = {
      table,
      select: null,
      filters: [],
      orders: [],
      limit: null,
    };
    this.queries.push(recorded);
    if (table === "student_lexeme_models") {
      return new QueryBuilder(this.snapshots, recorded);
    }
    return new QueryBuilder(this.evidence, recorded);
  };

  insert = () => {
    this.writes.push("insert");
    throw new Error("Free Practice read adapter must not insert");
  };

  update = () => {
    this.writes.push("update");
    throw new Error("Free Practice read adapter must not update");
  };

  delete = () => {
    this.writes.push("delete");
    throw new Error("Free Practice read adapter must not delete");
  };

  asClient(): SupabaseClient {
    return this as unknown as SupabaseClient;
  }
}
