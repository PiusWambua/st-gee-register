# Fix: Admin Create User

1. In Supabase Dashboard, open **Edge Functions**.
2. Create/deploy a function named exactly **admin-create-user** using `supabase/functions/admin-create-user/index.ts`.
3. Make sure the function has access to the Supabase server secret `SUPABASE_SERVICE_ROLE_KEY` in Edge Function secrets. Do NOT put this key in Vercel.
4. Run `supabase/FINAL_WORKING_MIGRATION.sql` once in SQL Editor so `profiles` has: role, active, email, section, grade, stream.
5. Redeploy the Vercel frontend after uploading this ZIP.
6. Sign out and sign in again before testing Add User.

The frontend now sends the current access token explicitly and displays the actual Edge Function error. The function validates the logged-in admin, creates the Auth user, then creates the matching profiles row. If profile creation fails, it removes the Auth user so you do not get orphaned accounts.
