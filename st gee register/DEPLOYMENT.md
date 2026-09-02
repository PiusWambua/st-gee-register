# St. George's Digital Register — deployment checklist

## 1. Supabase first
Run `supabase/DEPLOY_THIS_MIGRATION.sql` once in the existing Supabase project's SQL Editor.

This migration:
- fixes the `learners.name does not exist` issue by standardising on `learners.full_name`;
- carries old `name` values into `full_name` when needed;
- carries `adm_number` into `admission_no`;
- carries old `upi_no` values into `nemis_no` when NEMIS is not already populated;
- adds profile login names and profile pictures;
- removes attendance constraints that allow Late/Excused and enforces Present/Absent only;
- refreshes RLS policies for Admin/Class Teacher access.

## 2. Vercel
- Framework preset: Vite
- Build command: `npm run build`
- Output directory: `dist`
- Environment variables:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`

## 3. Admin/Class Teacher login
The login page has two separate account choices. The selected role is checked against `profiles.role` after authentication. Wrong-role logins are rejected and signed out.

## 4. Edge Functions
Deploy:
- `supabase/functions/admin-create-user`
- `supabase/functions/admin-reset-user-password`

The Edge Functions require `SUPABASE_SERVICE_ROLE_KEY` in Supabase function secrets.

## 5. Attendance
Only Present and Absent exist. Use Mark All Present, Mark All Absent, or individual Present/Absent buttons.
