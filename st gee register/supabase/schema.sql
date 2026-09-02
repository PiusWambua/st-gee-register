-- St. George's Digital Attendance Register
-- Fresh schema for a Vite + Supabase deployment.
create extension if not exists pgcrypto;

create table if not exists profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 full_name text not null,
 email text,
 phone text,
 login_name text,
 avatar_url text,
 role text not null default 'teacher' check (role in ('admin','teacher')),
 section text check (section is null or section in ('ECDE','Primary','JSS')),
 grade text,
 stream text,
 active boolean not null default true,
 created_at timestamptz default now()
);

create table if not exists classes (
 id uuid primary key default gen_random_uuid(),
 section text not null check(section in ('ECDE','Primary','JSS')),
 grade text not null,
 stream text,
 class_teacher uuid references profiles(id),
 created_at timestamptz default now(),
 unique(section,grade,stream)
);

create table if not exists learners (
 id uuid primary key default gen_random_uuid(),
 admission_no text unique,
 nemis_no text,
 full_name text not null,
 gender text,
 residence text not null default 'Day Scholar' check(residence in ('Boarder','Day Scholar')),
 section text not null check(section in ('ECDE','Primary','JSS')),
 grade text not null,
 stream text,
 active boolean not null default true,
 created_at timestamptz default now()
);

create table if not exists attendance (
 id uuid primary key default gen_random_uuid(),
 learner_id uuid not null references learners(id) on delete cascade,
 attendance_date date not null,
 status text not null check(status in ('Present','Absent')),
 marked_by uuid references profiles(id),
 created_at timestamptz default now(),
 unique(learner_id,attendance_date)
);

alter table profiles enable row level security;
alter table classes enable row level security;
alter table learners enable row level security;
alter table attendance enable row level security;

drop function if exists public.current_role();
create or replace function public.current_role() returns text language sql stable security definer set search_path=public as $$ select role from public.profiles where id=auth.uid() and active=true $$;
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.profiles where id=auth.uid() and role='admin' and active=true) $$;
create or replace function public.teacher_can_access(learner_grade text, learner_stream text) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='teacher' and p.active=true and p.grade=learner_grade and coalesce(p.stream,'')=coalesce(learner_stream,'')) $$;

drop policy if exists "profiles read self or admin" on profiles; drop policy if exists "profiles update self or admin" on profiles; drop policy if exists "admin insert profiles" on profiles;
drop policy if exists "learners read by role" on learners; drop policy if exists "learners insert by role" on learners; drop policy if exists "learners update by role" on learners;
drop policy if exists "attendance read by role" on attendance; drop policy if exists "attendance insert by role" on attendance; drop policy if exists "attendance update by role" on attendance; drop policy if exists "attendance delete by role" on attendance;
drop policy if exists "classes read" on classes; drop policy if exists "admins manage classes" on classes;
create policy "profiles read self or admin" on profiles for select to authenticated using(id=auth.uid() or public.is_admin());
create policy "profiles update self or admin" on profiles for update to authenticated using(id=auth.uid() or public.is_admin()) with check(id=auth.uid() or public.is_admin());
create policy "admin insert profiles" on profiles for insert to authenticated with check(public.is_admin());
create policy "learners read by role" on learners for select to authenticated using(public.is_admin() or public.teacher_can_access(grade,stream));
create policy "learners insert by role" on learners for insert to authenticated with check(public.is_admin() or public.teacher_can_access(grade,stream));
create policy "learners update by role" on learners for update to authenticated using(public.is_admin() or public.teacher_can_access(grade,stream)) with check(public.is_admin() or public.teacher_can_access(grade,stream));
create policy "attendance read by role" on attendance for select to authenticated using(public.is_admin() or exists(select 1 from learners l where l.id=learner_id and public.teacher_can_access(l.grade,l.stream)));
create policy "attendance insert by role" on attendance for insert to authenticated with check(public.is_admin() or exists(select 1 from learners l where l.id=learner_id and public.teacher_can_access(l.grade,l.stream)));
create policy "attendance update by role" on attendance for update to authenticated using(public.is_admin() or exists(select 1 from learners l where l.id=learner_id and public.teacher_can_access(l.grade,l.stream))) with check(public.is_admin() or exists(select 1 from learners l where l.id=learner_id and public.teacher_can_access(l.grade,l.stream)));
create policy "attendance delete by role" on attendance for delete to authenticated using(public.is_admin() or exists(select 1 from learners l where l.id=learner_id and public.teacher_can_access(l.grade,l.stream)));
create policy "classes read" on classes for select to authenticated using(public.is_admin() or public.current_role()='teacher');
create policy "admins manage classes" on classes for all to authenticated using(public.is_admin()) with check(public.is_admin());

create unique index if not exists profiles_login_name_unique on profiles(lower(login_name)) where login_name is not null and btrim(login_name)<>'';
create unique index if not exists attendance_learner_date_unique on attendance(learner_id,attendance_date);
