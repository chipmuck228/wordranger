import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const CANDIDATE =
  "docs/DEDICATED_WORDRANGER_SUPABASE_MIGRATION_CANDIDATE.md";
const INVENTORY =
  "docs/DEDICATED_WORDRANGER_SUPABASE_OBJECT_INVENTORY.md";
const CHECKLIST =
  "docs/DEDICATED_WORDRANGER_SUPABASE_CUTOVER_CHECKLIST.md";
const MIGRATIONS_DIR = "supabase/migrations";

const UUID_RE =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i;

const SHARED_BLAZE = [
  "campus",
  "enrollment",
  "newsletter",
  "traffic",
  "public.users",
  "v3_migration_offering_legacy_stage",
  "SHARED_BLAZE_DO_NOT_COPY",
] as const;

const docs = [CANDIDATE, INVENTORY, CHECKLIST].map((file) => ({
  file,
  text: readFileSync(path.join(process.cwd(), file), "utf8"),
}));

describe("dedicated WordRanger Supabase migration candidate", () => {
  it("is design-only and does not embed secrets, URLs, or refs", () => {
    for (const { file, text } of docs) {
      expect(text, file).toMatch(/Candidate \/ Not a Standard/);
      expect(text, file).toContain(
        "782ffcca670c8272a3ba7ca07bedaef4debdc95f",
      );
      expect(text, file).not.toMatch(/https?:\/\//i);
      expect(text, file).not.toMatch(/supabase\.co|eyj|postgres:\/\//i);
      expect(text, file).not.toMatch(/lcjysnyb/i);
      expect(
        text.split("SUPABASE_SERVICE_ROLE_KEY").join(""),
        file,
      ).not.toMatch(/service_role_key/i);
      expect(text, file).not.toMatch(UUID_RE);
    }
  });

  it("denies shared Blaze objects from the migration target", () => {
    const inventory = docs.find((d) => d.file === INVENTORY)?.text ?? "";
    const candidate = docs.find((d) => d.file === CANDIDATE)?.text ?? "";
    for (const name of SHARED_BLAZE) {
      expect(inventory).toContain(name);
    }
    expect(candidate).toContain("Do not copy shared Blaze");
    expect(inventory).toContain("Do not migrate, dump, or recreate");
    expect(inventory).not.toMatch(/copy campus .* onto the dedicated target/i);
  });

  it("does not claim a migration, history repair, or Vercel cutover ran", () => {
    for (const { file, text } of docs) {
      expect(text, file).not.toMatch(/migration was executed/i);
      expect(text, file).not.toMatch(/history was fabricated/i);
      expect(text, file).not.toMatch(/Vercel cutover complete/i);
      expect(text, file).not.toMatch(/production cutover complete/i);
      expect(text, file).not.toMatch(/schema baseline applied/i);
      expect(text, file).not.toMatch(/learner rows imported/i);
    }
    const candidate = docs.find((d) => d.file === CANDIDATE)?.text ?? "";
    expect(candidate).toContain("No schema baseline, data export/import");
    expect(candidate).toContain("No migration executed");
    expect(candidate).toContain("No migration history fabricated");
    expect(candidate).toContain("No Vercel cutover");
    expect(candidate).toContain("This branch is **local only**");
  });

  it("keeps /practice disabled and Auth activation separate", () => {
    for (const { text } of docs) {
      expect(text).toMatch(/\/practice/);
      expect(text).not.toMatch(/\/practice` is enabled/i);
      expect(text).not.toMatch(/Anonymous Sign-In is enabled/i);
      expect(text).not.toMatch(/production Free Practice is live/i);
    }
    const candidate = docs.find((d) => d.file === CANDIDATE)?.text ?? "";
    expect(candidate).toContain("`/practice`");
    expect(candidate).toContain("disabled");
    expect(candidate).toContain("independent later program");
    expect(candidate).toContain("Do not enable any of these with schema baseline");
  });

  it("records freeze, empty target, and configuration switch without claiming a proven snapshot", () => {
    const all = docs.map((d) => d.text).join("\n");
    expect(all).toContain("TARGET_EMPTY");
    expect(all).toContain("POINTS_TO_DEDICATED_TARGET");
    expect(all).toContain("ACTIVE_PRODUCTION_TARGET_NOT_VERIFIED");
    expect(all).toContain("PRODUCTION_TARGET_SWITCHED_BEFORE_MIGRATION");
    expect(all).toContain("NOT_CONFIGURED");
    expect(all).toMatch(/DEPLOYMENTS_REMAIN_FROZEN|Deployment freeze|Keep merges/);
    expect(all).toContain("LEGACY_SOURCE_MATCH");
    expect(all).toContain("DEDICATED_TARGET_MATCH");
  });

  it("keeps learner-history retention an explicit unauthorized decision", () => {
    const candidate = docs.find((d) => d.file === CANDIDATE)?.text ?? "";
    expect(candidate).toContain("Option 4");
    expect(candidate).toContain("pending explicit");
    expect(candidate).toContain("authorization");
    expect(candidate).toContain("does **not** make the history");
    expect(candidate).not.toMatch(/learner history (was|has been) migrated/i);
    expect(candidate).not.toMatch(/Option 4 is approved/i);
  });

  it("recommends a hybrid baseline and forbids fake history and db push", () => {
    const candidate = docs.find((d) => d.file === CANDIDATE)?.text ?? "";
    expect(candidate).toContain("C. Hybrid");
    expect(candidate).toContain("historical reference");
    expect(candidate).toMatch(/db push/);
    expect(candidate).toMatch(/forbidden/);
    expect(candidate).toContain("Do not insert fake rows");
  });

  it("inventories every repository migration file without treating presence as apply authorization", () => {
    const inventory = docs.find((d) => d.file === INVENTORY)?.text ?? "";
    const files = readdirSync(path.join(process.cwd(), MIGRATIONS_DIR))
      .filter((name) => name.endsWith(".sql"))
      .sort();
    expect(files.length).toBe(12);
    for (const name of files) {
      expect(inventory).toContain(name);
    }
    expect(inventory).toContain("None are automatically authorized to apply");
    expect(inventory).toContain("TARGET_BASELINE_REQUIRED");
    expect(inventory).toContain("TARGET_TEST_ONLY");
    expect(inventory).toContain("TARGET_OPTIONAL_EXPERIMENTAL");
    expect(inventory).toContain("Dashboard-applied");
  });

  it("leaves every cutover checkbox unchecked", () => {
    const checklist = docs.find((d) => d.file === CHECKLIST)?.text ?? "";
    expect(checklist).toContain("Nothing below is done");
    expect(checklist).not.toMatch(/^- \[[xX]\]/m);
    expect(checklist).toContain("do not push");
    expect(checklist).toContain("Do not delete Blaze");
  });
});
