# St. George's Digital Attendance Register

Updated login layout: Administrator first, Class Teacher second. Notifications auto-dismiss after a few seconds and no close (X) buttons are used.
# St. George's Digital Attendance Register — Vite

## Deployment
1. Upload this folder/repository to GitHub.
2. Import the repository into Vercel.
3. Framework: Vite. Build command: `vite build` (or `npm run build`).
4. Output directory: `dist`.
5. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Vercel Environment Variables.
6. Deploy.

## Supabase
For an existing database, run `supabase/DEPLOY_THIS_MIGRATION.sql` once. It fixes the old `learners.name` issue by standardising the application on `learners.full_name`, preserves old admission/UPI values where possible, adds NEMIS, and enforces Present/Absent only.

For a new database, run `supabase/schema.sql`.

Deploy the two Edge Functions under `supabase/functions/` and set `SUPABASE_SERVICE_ROLE_KEY` for them.

## Login
The login screen has two separate entry points: Class Teacher and Administrator. The selected account type is checked against the authenticated user's `profiles.role`. An Admin cannot sign in through the Class Teacher option, and a Class Teacher cannot sign in through the Administrator option.

## Attendance
Only Present and Absent are available. There are bulk Mark All Present / Mark All Absent buttons plus individual buttons for every learner.

## Learners
The Learners page uses `full_name` and `nemis_no`; there are no `learners.name` or UPI references in the application.


## Dashboard Search Update
The dashboard now supports Whole School, Grade/Class, Stream, and Individual Learner attendance selection. Grade and Stream are dropdowns, streams for the selected grade are also shown as selectable chips, and the selected class/grade/stream is displayed in the dashboard header.
