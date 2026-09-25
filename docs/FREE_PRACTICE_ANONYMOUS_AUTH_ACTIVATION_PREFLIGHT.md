# Free Practice Anonymous Auth Activation Preflight

Candidate / not a Standard. **Read-only.** This document does not
enable Anonymous Sign-In, configure CAPTCHA, change rate limits, set
Vercel env, enable `/practice`, or modify Homepage.

- Date: **2026-09-26** (Asia/Shanghai)
- Audited `origin/main`: `782ffcca670c8272a3ba7ca07bedaef4debdc95f`
- Production identity: **PROJECT_MATCH** to the linked project named
  **blaze**
- Temporary production env file: **TEMP_DELETED**
- Configuration changed by this pass: **none**

Anonymous Sign-In is **DISABLED**. Technical ability to flip the
Dashboard toggle is **not** production fitness.

## 1. Product state at audit

| Check | Result |
| --- | --- |
| `/practice` | public 404 |
| Homepage Free Practice entry | still `/train` |
| Production `FREE_PRACTICE_ENABLED` / `FREE_PRACTICE_RUNTIME` | names absent |
| Anonymous Sign-In | **DISABLED** |
| Learner-table server-only revoke | already applied; unchanged here |

## 2. Safe Auth configuration matrix

Read-only Management API Auth config plus aggregate `auth.users` /
`auth.identities` counts. No user rows, emails, phones, tokens, or
metadata were recorded.

| Item | Classification |
| --- | --- |
| Email provider | ENABLED |
| Phone | DISABLED |
| Anonymous Sign-In | **DISABLED** |
| Apple / Azure / Discord / Facebook / GitHub / GitLab / Google / Slack / Spotify / Twitch / Twitter / Zoom and other listed OAuth flags | DISABLED |
| LinkedIn (legacy flag) | NOT VERIFIED (key absent) |
| CAPTCHA / bot protection | **DISABLED** |
| CAPTCHA provider category | **NONE** |
| Email signup (`disable_signup`) | signup allowed |
| Email autoconfirm | DISABLED (confirmation required) |
| Manual identity linking | DISABLED |
| Custom access-token hook | DISABLED |
| Auth IP forwarding (`Sb-Forwarded-For`) | DISABLED |

### Rate limits (project values)

| Limit | Current value | Official default class |
| --- | --- | --- |
| Anonymous sign-ins | 30 / hour / IP | default; customizable |
| Emails sent | 2 / hour / project | built-in mailer class |
| OTP | 30 | customizable |
| Verify | 30 / 5 minutes class | customizable |
| Token refresh | 150 / 5 minutes class | customizable |
| SMS | 30 / hour | unused while phone is off |
| Web3 | 30 | unused |

Official Auth docs: anonymous sign-in is IP-limited on `/auth/v1/signup`
without email or phone. Sign-up / magic-link / recover share a separate
IP bucket that **excludes** anonymous sign-ins. Token refresh is a
different IP bucket.

### Session configuration

| Setting | Current class |
| --- | --- |
| JWT expiry | 3600 seconds |
| Refresh-token rotation | ENABLED |
| Reuse interval | 10 seconds |
| Inactivity timeout | off (0) |
| Time-box | off (0) |
| Single session per user | off |

Official session docs: sessions last until sign-out unless inactivity
or time-box is set. Lost cookies cannot recover the same anonymous
user.

### Aggregate Auth counts

| Count | Value |
| --- | --- |
| Total Auth users | 0 |
| Anonymous Auth users | 0 |
| Identities (all providers) | 0 |

Zero current Auth users does **not** prove WordRanger is the only
future Auth consumer.

## 3. Shared-project impact

**NOT VERIFIED that WordRanger is the only Auth consumer.**

Facts that block an assumption of isolation:

- The linked project is shared Blaze. Inventory already recorded a
  campus / enrollment / newsletter / traffic surface.
- This pass counted **15** `public` tables whose names match that
  shared surface.
- `public.users` has RLS enabled and multiple policies, including
  SELECT / INSERT / UPDATE / DELETE. At least two policies bind
  `auth.uid()`.
- Email signup is enabled on the same Auth project.
- This repository uses Blaze Auth only as a cookie `auth.getUser()`
  reader for Free Practice. It does not mint users today. `/train`
  and Context Lab still use the V1 placeholder and do not use Auth.
- Other repositories or Dashboard clients that talk to this Auth
  project were **not** inventoried. Do not assume they are absent.

Official anonymous-auth caution: anonymous users receive the
`authenticated` Postgres role. JWTs carry `is_anonymous`. Any existing
or future `authenticated` / `auth.uid()` policy that does not also
exclude anonymous users can become a shared-app access path the moment
Anonymous Sign-In is turned on.

Changing CAPTCHA or Auth-provider settings is **project-wide**. It can
affect every signup, login, recovery, and future anonymous mint on
this project, including applications this repository does not own.

## 4. CAPTCHA feasibility

Official CAPTCHA guide: protection is added to sign-in, sign-up, and
password-reset forms. Providers are hCaptcha or Cloudflare Turnstile.

| Question | Finding |
| --- | --- |
| Scope | Project-wide Auth bot protection, **not** anonymous-only |
| Browser site key | required |
| Dashboard secret | required; never in the app |
| Hostname allowlist | required; preview and production hosts are different |
| Token through explicit Start | yes: browser challenge, then pass `captchaToken` into the server action; no service-role credential |
| Server-only `signInAnonymously()` without a browser token | **cannot honestly satisfy CAPTCHA**. The challenge originates in the browser |
| Preview vs production | separate hostname allowlisting |
| Break other Blaze apps? | **YES, if those apps do not send tokens.** Email signup is already enabled. Other consumers are NOT VERIFIED |

Therefore a future identity foundation cannot be “server mints in
middleware / Start with no browser challenge” if CAPTCHA is on. The
browser must complete CAPTCHA; the server may only forward the token
on the explicit Start path.

## 5. Abuse and lifecycle (minimum before any activation)

Do not implement these here. They are activation stop conditions.

1. Mint only after an explicit user Start. Never on GET, render,
   middleware/proxy, Homepage, prefetch, health/readiness, or a retry
   that already has a valid session.
2. Double-click / concurrent Start: at most one usable client flow;
   never two sessions for one click sequence.
3. Keep a conservative anonymous IP rate limit. Official default is 30
   per hour per IP.
4. Server-side mint from Next.js **collapses IP rate limits onto
   Vercel egress** unless Auth IP forwarding is enabled and a secret
   API key is used. Official docs: legacy anon / service-role keys
   cannot forward `Sb-Forwarded-For`. This repository has no such
   secret-key Auth client. Treat server-only mint as **rate-limit
   dishonest** until that design is separately authorized.
5. Application-level Start throttling is required if mint stays on
   the server.
6. CAPTCHA is required by official anonymous-auth abuse guidance.
   It is currently **DISABLED**.
7. Cookie refresh may refresh an existing session only. It must not
   mint. Failed refresh fails closed.
8. Lost cookies: old learner rows stay isolated; a newly minted
   anonymous user cannot recover them. This is isolation, not a
   durable personal account.
9. Account linking is future work. Manual linking is **DISABLED**.
10. Abandoned anonymous Auth users persist in `auth.users` and can
    grow the database. Retention/cleanup is future operational work.
    Do not add cleanup SQL in this pass.
11. Do not delete learner rows merely because an Auth session expired.
12. Monitor anonymous-user growth, 429 rate-limit class, and Start
    failures. Do not log user UUIDs, cookies, or tokens.

Placeholder identity and random UUIDs without Auth are **rejected**.

## 6. Option comparison

Do not treat “can be toggled” as “fit for production.”

| Criterion | A. Anonymous Sign-In + CAPTCHA | B. Email magic link / OTP | C. Keep Free Practice unavailable |
| --- | --- | --- | --- |
| User friction | low after Start + CAPTCHA | high (email required) | none; feature stays closed |
| Isolation | good, cookie-bound Auth `user.id` | good after verify | current fail-closed |
| Cross-device recovery | no, until later linking | yes | n/a |
| Child / student usability | best of the public options | poor | n/a |
| Bot / abuse | high unless CAPTCHA + honest IP limits | email-send abuse; 2/hour built-in mailer | none |
| Shared Blaze impact | **high**: `authenticated` role + project-wide CAPTCHA + campus `public.users` | **high**: email provider already on; CAPTCHA would also wrap it | none |
| Required UI | Start + CAPTCHA widget; no login page | email collection + inbox | none |
| Secrets / config | CAPTCHA site/secret; hostname allowlist; maybe Auth IP forwarding | SMTP / mailer; same CAPTCHA if enabled | none |
| Cleanup | abandoned anonymous users | abandoned emails | none |
| Learner-table architecture | compatible if mint stays server-owned and data stays service-role | compatible | current |

Rejected (not options): `V1_PLACEHOLDER_USER_ID`, random UUID without
Supabase Auth, shared-browser identity.

## 7. Recommended option

**C. Keep Free Practice unavailable.**

Option A is the only acceptable **future** public identity once a
separate activation authorization clears the stop conditions. It is
**not safe to enable on this shared project today.**

Blocking facts:

1. Anonymous Sign-In is off and CAPTCHA is off. Official guidance
   requires CAPTCHA before anonymous mint.
2. CAPTCHA is project-wide. Email signup is already enabled.
   Other Auth consumers are **NOT VERIFIED**.
3. Shared `public.users` already has `auth.uid()` policies.
   Anonymous users become `authenticated`.
4. Honest server-only mint cannot complete CAPTCHA and cannot use
   official IP forwarding with the current anon-key Auth path.
5. Manual linking, retention, and cleanup are undefined.
6. `/practice` must remain disabled until a later production
   acceptance. This preflight is not that acceptance.

Option B is not recommended as the first public path: it adds email
friction for students, still lives on the shared Auth project, and
does not remove the CAPTCHA / campus-policy problem.

## 8. Staged plan (not executed)

Only if a later authorization accepts the shared-project risk and
chooses option A:

1. Configure CAPTCHA and a conservative anonymous rate limit. Prove
   no other Blaze Auth client breaks. Keep `/practice` disabled.
   Review `authenticated` + `is_anonymous` against campus policies.
2. Implement identity foundation with fake/local Auth tests only.
   Automated tests must not create production anonymous users.
3. Isolated Vercel preview only. Manually mint exactly two controlled
   identities. Prove A/B isolation and cookie refresh.
4. Review anonymous-user growth, 429s, and shared-app impact.
5. Separate authorization for production `/practice`. Homepage stays
   on `/train` until that acceptance.

This pass executed **none** of those stages.

## 9. Activation stop conditions

Stop and keep Free Practice disabled if any of these is true:

- Anonymous Sign-In or CAPTCHA would be enabled without a written
  shared-app impact review;
- any Auth consumer on this project cannot send CAPTCHA tokens;
- campus / `public.users` policies have not been reviewed for
  anonymous `authenticated` users;
- mint would run on GET, middleware/proxy, Homepage, or prefetch;
- server-only mint would run without a browser CAPTCHA token;
- IP rate limits would be applied only to Vercel egress;
- tests would create production anonymous users;
- placeholder or random-UUID identity is proposed;
- `/practice` or Homepage activation is bundled into identity work;
- no separate activation authorization exists for each stage.

## 10. Configuration unchanged

This pass did not:

- enable Anonymous Sign-In;
- enable or configure CAPTCHA;
- change rate limits, providers, or session settings;
- change Vercel env;
- enable `/practice`;
- modify Homepage;
- run migrations or `db push`;
- implement identity mint.

`db push` and history repair remain forbidden. Migration history
remains absent. Free Practice remains Candidate / not a Standard.
