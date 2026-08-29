# One-shot setup for a new Supabase project

`001_full_schema.sql` is a **consolidated snapshot** of everything in
`supabase/migrations/001_initial_schema.sql` through
`054_equipos_client_access.sql` — same end result, one file.

## When to use it

Only when standing up SIMEC on a **different / brand-new Supabase
project** (e.g. moving the app to another Supabase account). Run this
one file instead of applying all 54 migrations in order.

Do **not** run it against the original project — that project already
has migrations 001–054 applied and tracked; running this file there
would try to recreate tables/policies that already exist and fail.

## How to run it

1. Create the new Supabase project.
2. Open **SQL Editor** in the Supabase dashboard, paste the contents
   of `001_full_schema.sql`, and run it. (Or via the CLI:
   `supabase db execute -f supabase/setup/001_full_schema.sql --project-ref <new-ref>`.)
3. Deploy the Edge Functions separately — they aren't part of the SQL
   schema:
   ```
   supabase functions deploy admin-users --project-ref <new-ref>
   supabase functions deploy client-users --project-ref <new-ref>
   supabase functions deploy send-report-email --project-ref <new-ref>
   ```
   and set their secrets (e.g. `RESEND_API_KEY`) with
   `supabase secrets set`.
4. Update the app's `.env` with the new project's URL/anon key.
5. Sign up a first user normally in the app, then promote it to admin:
   ```sql
   update public.profiles set role = 'admin' where id = '<that user's auth.users id>';
   ```

## Going forward

Once the new project is bootstrapped from this file, treat any future
schema change as a new numbered file in `supabase/migrations/`
(`055_...sql`, etc.) applied to **both** projects — this consolidated
file is a one-time bootstrap, not a replacement for ongoing migration
history.
