# Sign-up confirmation ("Check your email")

## Behaviour

After **Create Account** on `/auth`, `supabase.auth.signUp` result is classified by `classifySignUp` (`src/lib/signupFlow.js`):

| Result | What the user sees |
| --- | --- |
| Session returned (Supabase "Confirm email" OFF) | No confirmation screen; profile loaded, redirect to `/student` or `/teacher` (unchanged). |
| User, no session (Confirm email ON) | **Check your email** screen (`src/components/auth/SignupConfirmation.jsx`). |
| `user.identities === []`, no session (email already registered, confirmation ON) | The **same** screen, word for word. Supabase deliberately hides existence; so do we. The hint "Already have an account with this address? Just log in." helps genuine existing users without confirming anything. |
| `error` (weak password, "User already registered" when autoconfirm is ON, network, registration closed) | Unchanged: red message under the form, typed values kept. |

The screen shows the entered email, "We've sent a confirmation email... Please confirm your email address, then log in.", a primary **Back to login** (switches to the sign-in form, email prefilled, password focused), a secondary **Resend confirmation email** (`supabase.auth.resend({ type: "signup", email })`, 60 s cooldown matching Supabase's rate limit, polite status, friendly errors) and a spam/junk hint. Focus moves to the heading on show. The screen survives a refresh in the same tab (`sessionStorage`, 1 h max, cleared by Back to login / Start over).

## Returning from the link

`signUp` and `resend` pass `emailRedirectTo = <origin>/auth?confirmed=1` (same pattern as `/reset-password`). On `/auth?confirmed=1`:
- no session: login form shows "Email confirmed - you can log in now."
- session present (supabase-js `detectSessionInUrl` signs the user in from the link token): continue to the role dashboard like a normal sign-in.
- expired / used link (`#error_code=otp_expired`): friendly message on the login form.

## What must be right in the real Supabase project

1. Authentication > Providers > Email: **Confirm email** ON (otherwise users get a session and never see this screen - that is fine, but the feature is idle).
2. Authentication > URL Configuration > **Redirect URLs**: add `https://<your-domain>/auth?confirmed=1` (or `https://<your-domain>/**`), and the same for `http://localhost:5173/**` in dev. If it is missing Supabase silently falls back to **Site URL** (no error) - the user still confirms, just lands there instead.
3. **Site URL** = the production origin (not localhost).
4. Email template "Confirm signup" must use `{{ .ConfirmationURL }}`.
5. Default Supabase SMTP is heavily rate-limited and may land in spam; configure custom SMTP for real classes.

## Tests

`npm run test:auth-signup` (jsdom, real `AuthPage`, stubbed Supabase client). `node scripts/verify-auth-signup-confirmation.mjs [outDir]` builds with fake env vars, mocks Supabase HTTP with `page.route`, checks 1366x768 / 390x844 / 320x640 in light and dark and writes screenshots. Not covered: real email delivery, real link redirect.
