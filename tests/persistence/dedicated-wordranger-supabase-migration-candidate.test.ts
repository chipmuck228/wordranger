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

function allText(): string {
  return docs.map((d) => d.text).join("\n");
}

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

  it("does not claim a migration, history repair, or production cutover ran", () => {
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
    expect(candidate).toContain("No schema/data migration executed");
    expect(candidate).toContain("No migration history fabricated");
    expect(candidate).toContain("No Vercel Production cutover");
    expect(candidate).not.toContain("This branch is **local only**");
    expect(candidate).not.toMatch(/This branch is \*\*local only\*\*/);
    expect(candidate).not.toMatch(/No second Supabase project/);
    expect(candidate).toContain(
      "No Supabase project was created by this design pass.",
    );
    expect(candidate).toContain(
      "The Dedicated WordRanger target pre-existed this design pass",
    );
    expect(candidate).toContain("DEDICATED_TARGET_MATCH");
    expect(candidate).toContain("TARGET_EMPTY");
  });

  it("records that branch Preview has occurred and later pushes may add more", () => {
    const all = allText();
    expect(all).toMatch(/Preview \*\*has occurred\*\*|has already triggered\s+Vercel Preview/);
    expect(all).toMatch(/later pushes may trigger additional Preview|later pushes may add more/);
    expect(all).toContain("ENABLED");
    expect(all).toContain("TARGET_EMPTY");
    expect(all).toMatch(
      /Production has \*\*not\*\* been redeployed because of this Candidate|Production was not redeployed because of this Candidate/,
    );
    expect(all).toMatch(/`main` was \*\*not\*\* merged|`main` was not merged/);
    expect(all).not.toContain("dfd46ece93932fbefe1da980f1609805de594d22");
    expect(all).not.toMatch(/one Vercel Preview/i);
    expect(all).not.toMatch(/exactly one Preview/i);
    expect(all).not.toMatch(/Preview 数量必须为 1/);
    expect(all).not.toMatch(/This branch is \*\*local only\*\*/);
    expect(all).not.toMatch(/Keep this design branch unpushed/);
    expect(all).not.toMatch(/local only — do not push/);
    expect(all).not.toMatch(/do not push this branch/i);
    expect(all).not.toMatch(/NO_REMOTE_CHANGES/);
    expect(all).not.toMatch(/No new Production\/Preview deploy since Integration/);
  });

  it("forbids treating Preview as acceptance and keeps production cutover prohibited", () => {
    const all = allText();
    expect(all).toMatch(/not.*acceptance|not a contract/);
    expect(all).toMatch(/Do not Start `\/train`|forbidden for\s+Start|must not receive `\/train` writes|write learner data/);
    expect(all).toContain("No Vercel Production cutover");
    expect(all).toContain("do not merge to `main`");
    expect(all).toMatch(/Production \/ `main` deployment freeze|Production \/ `main` freeze/);
    expect(all).not.toMatch(/zero deployments of any kind occurred/);
  });

  it("records no Supabase migration or data write", () => {
    const all = allText();
    expect(all).toMatch(/did \*\*not\*\* run Supabase DDL\/DML|No remote DDL\/DML|no DDL\/DML was performed/);
    expect(all).toContain("No schema/data migration executed");
    expect(all).toContain("TARGET_EMPTY");
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

  it("records empty target and configuration switch without claiming a proven snapshot", () => {
    const all = allText();
    expect(all).toContain("TARGET_EMPTY");
    expect(all).toContain("POINTS_TO_DEDICATED_TARGET");
    expect(all).toContain("ACTIVE_PRODUCTION_TARGET_NOT_VERIFIED");
    expect(all).toContain("PRODUCTION_TARGET_SWITCHED_BEFORE_MIGRATION");
    expect(all).toContain("NOT_CONFIGURED");
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

  it("requires a single active consolidated baseline and forbids fake history and db push", () => {
    const candidate = docs.find((d) => d.file === CANDIDATE)?.text ?? "";
    expect(candidate).toContain("C. Hybrid");
    expect(candidate).toContain("**active** migration lineage");
    expect(candidate).toContain("must** leave the active");
    expect(candidate).toContain("must not** both remain");
    expect(candidate).toMatch(/db push/);
    expect(candidate).toMatch(/forbidden/);
    expect(candidate).toContain("manually inserting fake migration-history rows");
    expect(candidate).toContain("does **not** move migration files");
    expect(candidate).toContain("does **not** create baseline SQL");
  });

  it("excludes cleanup_progress_test_user from the Dedicated production baseline", () => {
    const all = allText();
    expect(all).toContain("cleanup_progress_test_user");
    expect(all).toMatch(/exclude from Dedicated production baseline|not part of the Dedicated \*\*production\*\* baseline|Dedicated \*\*production\*\* baseline: \*\*exclude\*\*/);
    expect(all).toMatch(/Do \*\*not\*\* copy this RPC|Do not copy this RPC|never copy that RPC to production/);
    expect(all).toMatch(/separate test Supabase project/);
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
    expect(inventory).toContain("must move all twelve out of active");
  });

  it("does not claim this design pass created no Dedicated project at all", () => {
    for (const { file, text } of docs) {
      expect(text, file).not.toMatch(/No second Supabase project/);
    }
    const candidate = docs.find((d) => d.file === CANDIDATE)?.text ?? "";
    expect(candidate).toContain("pre-existed this design pass");
    expect(candidate).toContain("DEDICATED_TARGET_MATCH");
  });

  it("leaves every cutover checkbox unchecked", () => {
    const checklist = docs.find((d) => d.file === CHECKLIST)?.text ?? "";
    expect(checklist).toContain("Nothing below is done");
    expect(checklist).not.toMatch(/^- \[[xX]\]/m);
    expect(checklist).toContain("Do not delete Blaze");
    expect(checklist).not.toContain("Keep this design branch unpushed");
  });
});
