import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const DOC = "docs/FREE_PRACTICE_ANONYMOUS_AUTH_ACTIVATION_PREFLIGHT.md";
const UUID_RE =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i;
const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;

describe("anonymous auth activation preflight", () => {
  const doc = readFileSync(path.join(process.cwd(), DOC), "utf8");

  it("does not embed URL, ref, key, token, email, or user UUID", () => {
    expect(doc).not.toMatch(/https?:\/\//i);
    expect(doc).not.toMatch(/supabase\.co|eyj|postgres:\/\//i);
    expect(doc).not.toMatch(/service_role_key|lcjysnyb/i);
    expect(doc).not.toMatch(EMAIL_RE);
    expect(doc).not.toMatch(UUID_RE);
    expect(doc).toContain("782ffcca670c8272a3ba7ca07bedaef4debdc95f");
    expect(doc).toContain("PROJECT_MATCH");
    expect(doc).toContain("TEMP_DELETED");
  });

  it("does not claim Anonymous Sign-In or /practice is live", () => {
    expect(doc).toMatch(/Anonymous Sign-In is \*\*DISABLED\*\*/);
    expect(doc).toContain("CAPTCHA / bot protection");
    expect(doc).toContain("**DISABLED**");
    expect(doc).toContain("public 404");
    expect(doc).not.toMatch(/Anonymous Sign-In is enabled/i);
    expect(doc).not.toMatch(/\/practice` is live/i);
    expect(doc).not.toMatch(/production Free Practice is live/i);
  });

  it("rejects placeholder and random UUID fallback", () => {
    expect(doc).toMatch(/Placeholder identity and random UUIDs without Auth are \*\*rejected\*\*/);
    expect(doc).toContain("V1_PLACEHOLDER_USER_ID");
    expect(doc).not.toMatch(/use the placeholder for public Free Practice/i);
  });

  it("records shared-project uncertainty and requires separate authorization", () => {
    expect(doc).toContain(
      "NOT VERIFIED that WordRanger is the only Auth consumer",
    );
    expect(doc).toContain("separate activation authorization");
    expect(doc).toContain("Keep Free Practice unavailable");
    expect(doc).toContain("Configuration changed by this pass: **none**");
    expect(doc).toContain("Candidate / not a Standard");
    expect(doc).toMatch(/db push/);
    expect(doc).toMatch(/forbidden/);
  });
});
