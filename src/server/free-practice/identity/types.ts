import "server-only";

export type FreePracticeIdentityKind =
  | "SUPABASE_ANONYMOUS"
  | "SUPABASE_USER";

export type FreePracticeIdentityUnavailableReason =
  | "NO_SERVER_SESSION"
  | "PLACEHOLDER_FORBIDDEN"
  | "AUTH_NOT_CONFIGURED";

export type FreePracticeIdentityResult =
  | {
      status: "AUTHENTICATED";
      userId: string;
      identityKind: FreePracticeIdentityKind;
    }
  | {
      status: "UNAVAILABLE";
      reason: FreePracticeIdentityUnavailableReason;
    };

export type FreePracticeAuthUser = {
  id: string;
  isAnonymous: boolean;
};

export type FreePracticeSessionRead =
  | { status: "AUTHENTICATED"; user: FreePracticeAuthUser }
  | { status: "NONE" }
  | { status: "INVALID" };

export type ReadFreePracticeSession = () => Promise<FreePracticeSessionRead>;
