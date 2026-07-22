-- Wipe the legacy "EduFederate LMS" schema that previously occupied this
-- Supabase project. This project has been repurposed for EazyBet.
-- Explicitly authorized by project owner.

drop table if exists public.assignment_submissions cascade;
drop table if exists public.assignments cascade;
drop table if exists public.attendance cascade;
drop table if exists public.grades cascade;
drop table if exists public.timetable_slots cascade;
drop table if exists public.fees cascade;
drop table if exists public.activities cascade;
drop table if exists public.students cascade;
drop table if exists public.teachers cascade;
drop table if exists public.classes cascade;
drop table if exists public.subjects cascade;
drop table if exists public.id_sequences cascade;
drop table if exists public.schools cascade;
drop table if exists public.profiles cascade;

-- Drop any legacy triggers on auth.users from the old project
drop trigger if exists on_auth_user_created on auth.users;

-- Extensions we rely on
create extension if not exists pgcrypto;
create extension if not exists pg_trgm;
