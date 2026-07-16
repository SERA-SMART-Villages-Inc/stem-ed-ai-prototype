-- ============================================================================
-- 0001_init_schema.sql
-- K-12 EdTech MVP — Core Schema + RBAC via Supabase RLS
-- Synthetic/prototype data only. No PII from real students permitted.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Extensions
-- ----------------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. Enums
-- ----------------------------------------------------------------------------
create type app_role as enum ('district_admin', 'school_leader', 'teacher', 'student');

create type assessment_subject as enum ('math', 'ela', 'science', 'career_readiness');

create type intervention_status as enum ('proposed', 'active', 'completed', 'discontinued');

create type intervention_type as enum (
  'tutoring', 'small_group', 'iep_accommodation', '504_accommodation',
  'behavioral_support', 'enrichment', 'counseling_referral'
);

-- ----------------------------------------------------------------------------
-- 2. Core Org Hierarchy: Districts -> Schools
-- ----------------------------------------------------------------------------
create table districts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  state text not null,
  nces_district_id text unique,          -- synthetic in MVP; matches NCES format for future real integration
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table schools (
  id uuid primary key default gen_random_uuid(),
  district_id uuid not null references districts(id) on delete cascade,
  name text not null,
  nces_school_id text unique,
  grade_band text not null,               -- e.g. 'K-5', '6-8', '9-12'
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_schools_district on schools(district_id);

-- ----------------------------------------------------------------------------
-- 3. User Profiles (extends auth.users) — the RBAC anchor table
-- ----------------------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role app_role not null,
  full_name text not null,
  district_id uuid references districts(id) on delete set null,
  school_id uuid references schools(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint role_scope_check check (
    (role = 'district_admin' and district_id is not null) or
    (role = 'school_leader'  and school_id is not null) or
    (role = 'teacher'        and school_id is not null) or
    (role = 'student'        and school_id is not null)
  )
);

create index idx_profiles_role on profiles(role);
create index idx_profiles_school on profiles(school_id);
create index idx_profiles_district on profiles(district_id);

-- ----------------------------------------------------------------------------
-- 4. Teachers (role-specific extension of profiles for teacher metadata)
-- ----------------------------------------------------------------------------
create table teachers (
  id uuid primary key references profiles(id) on delete cascade,
  school_id uuid not null references schools(id) on delete cascade,
  subjects_taught assessment_subject[] not null default '{}',
  created_at timestamptz not null default now()
);

create index idx_teachers_school on teachers(school_id);

-- ----------------------------------------------------------------------------
-- 5. Students (role-specific extension of profiles)
-- ----------------------------------------------------------------------------
create table students (
  id uuid primary key references profiles(id) on delete cascade,
  school_id uuid not null references schools(id) on delete cascade,
  grade_level int not null check (grade_level between 0 and 12), -- 0 = Kindergarten
  synthetic_student_ref text not null unique,   -- mock SIS ID, never a real record
  primary_teacher_id uuid references teachers(id) on delete set null,
  has_iep boolean not null default false,
  has_504 boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_students_school on students(school_id);
create index idx_students_teacher on students(primary_teacher_id);

-- Junction: many-to-many, a student can have multiple teachers across subjects
create table student_teacher_assignments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  teacher_id uuid not null references teachers(id) on delete cascade,
  subject assessment_subject not null,
  school_year text not null,              -- e.g. '2025-2026'
  created_at timestamptz not null default now(),
  unique (student_id, teacher_id, subject, school_year)
);

create index idx_sta_student on student_teacher_assignments(student_id);
create index idx_sta_teacher on student_teacher_assignments(teacher_id);

-- ----------------------------------------------------------------------------
-- 6. Assessments
-- ----------------------------------------------------------------------------
create table assessments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  subject assessment_subject not null,
  assessment_name text not null,          -- e.g. 'iReady Diagnostic', 'STAR Math'
  administered_at date not null,
  raw_score numeric,
  scale_score numeric,
  percentile numeric check (percentile between 0 and 100),
  proficiency_band text,                  -- e.g. 'Below Basic', 'Basic', 'Proficient', 'Advanced'
  evidence_source text not null default 'synthetic_mock', -- data provenance, required for AI citation
  created_at timestamptz not null default now()
);

create index idx_assessments_student on assessments(student_id);
create index idx_assessments_subject on assessments(subject);
create index idx_assessments_date on assessments(administered_at);

-- ----------------------------------------------------------------------------
-- 7. Interventions
-- ----------------------------------------------------------------------------
create table interventions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  created_by uuid not null references profiles(id) on delete set null,
  type intervention_type not null,
  status intervention_status not null default 'proposed',
  subject assessment_subject,
  rationale text not null,                -- must reference evidence, never AI-asserted diagnosis
  start_date date,
  end_date date,
  ai_confidence_score numeric check (ai_confidence_score between 0 and 1), -- null if human-originated
  ai_evidence_refs text[],                -- assessment IDs / sources cited, required if AI-suggested
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_requires_evidence check (
    ai_confidence_score is null or (ai_evidence_refs is not null and array_length(ai_evidence_refs, 1) > 0)
  )
);

create index idx_interventions_student on interventions(student_id);
create index idx_interventions_status on interventions(status);

-- ----------------------------------------------------------------------------
-- 8. updated_at trigger helper
-- ----------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_districts_updated_at before update on districts
  for each row execute function set_updated_at();
create trigger trg_schools_updated_at before update on schools
  for each row execute function set_updated_at();
create trigger trg_profiles_updated_at before update on profiles
  for each row execute function set_updated_at();
create trigger trg_interventions_updated_at before update on interventions
  for each row execute function set_updated_at();

-- ============================================================================
-- 9. RBAC Helper Functions (SECURITY DEFINER, read from profiles only)
-- ============================================================================
create or replace function auth_role() returns app_role as $$
  select role from profiles where id = auth.uid();
$$ language sql stable security definer;

create or replace function auth_district_id() returns uuid as $$
  select district_id from profiles where id = auth.uid();
$$ language sql stable security definer;

create or replace function auth_school_id() returns uuid as $$
  select school_id from profiles where id = auth.uid();
$$ language sql stable security definer;

-- ============================================================================
-- 10. Enable RLS on all tables (deny-by-default)
-- ============================================================================
alter table districts enable row level security;
alter table schools enable row level security;
alter table profiles enable row level security;
alter table teachers enable row level security;
alter table students enable row level security;
alter table student_teacher_assignments enable row level security;
alter table assessments enable row level security;
alter table interventions enable row level security;

-- ----------------------------------------------------------------------------
-- 11. RLS Policies — Districts
-- ----------------------------------------------------------------------------
create policy districts_select on districts for select
  using (
    auth_role() = 'district_admin' and id = auth_district_id()
    or id in (select district_id from schools where id = auth_school_id())
  );

-- ----------------------------------------------------------------------------
-- 12. RLS Policies — Schools
-- ----------------------------------------------------------------------------
create policy schools_select on schools for select
  using (
    (auth_role() = 'district_admin' and district_id = auth_district_id())
    or (auth_role() in ('school_leader', 'teacher', 'student') and id = auth_school_id())
  );

-- ----------------------------------------------------------------------------
-- 13. RLS Policies — Profiles
-- ----------------------------------------------------------------------------
create policy profiles_select_self on profiles for select
  using (id = auth.uid());

create policy profiles_select_district_admin on profiles for select
  using (auth_role() = 'district_admin' and district_id = auth_district_id());

create policy profiles_select_school_leader on profiles for select
  using (auth_role() = 'school_leader' and school_id = auth_school_id());

create policy profiles_select_teacher_own_students on profiles for select
  using (
    auth_role() = 'teacher'
    and id in (
      select s.id from students s
      join student_teacher_assignments sta on sta.student_id = s.id
      join teachers t on t.id = sta.teacher_id
      where t.id = auth.uid()
    )
  );

-- ----------------------------------------------------------------------------
-- 14. RLS Policies — Students (row = student profile linkage)
-- ----------------------------------------------------------------------------
create policy students_select_district_admin on students for select
  using (
    auth_role() = 'district_admin'
    and school_id in (select id from schools where district_id = auth_district_id())
  );

create policy students_select_school_leader on students for select
  using (auth_role() = 'school_leader' and school_id = auth_school_id());

create policy students_select_teacher on students for select
  using (
    auth_role() = 'teacher'
    and id in (
      select student_id from student_teacher_assignments sta
      join teachers t on t.id = sta.teacher_id
      where t.id = auth.uid()
    )
  );

create policy students_select_self on students for select
  using (auth_role() = 'student' and id = auth.uid());

-- ----------------------------------------------------------------------------
-- 15. RLS Policies — Assessments (follows student visibility, read-only for
--     teacher/student/school_leader; district_admin read-only aggregate)
-- ----------------------------------------------------------------------------
create policy assessments_select on assessments for select
  using (
    student_id in (
      select id from students -- inherits students RLS via subquery evaluation
    )
  );

create policy assessments_insert_teacher on assessments for insert
  with check (
    auth_role() = 'teacher'
    and student_id in (
      select student_id from student_teacher_assignments sta
      join teachers t on t.id = sta.teacher_id
      where t.id = auth.uid()
    )
  );

-- ----------------------------------------------------------------------------
-- 16. RLS Policies — Interventions (teacher/school_leader can write;
--     student can only read their own; no AI auto-write without evidence,
--     enforced at table constraint level above)
-- ----------------------------------------------------------------------------
create policy interventions_select on interventions for select
  using (
    student_id in (select id from students)
  );

create policy interventions_insert_teacher_or_leader on interventions for insert
  with check (
    auth_role() in ('teacher', 'school_leader')
    and student_id in (select id from students)
  );

create policy interventions_update_creator_or_leader on interventions for update
  using (
    created_by = auth.uid()
    or (auth_role() = 'school_leader' and student_id in (
      select id from students where school_id = auth_school_id()
    ))
  );

-- ----------------------------------------------------------------------------
-- 17. RLS Policies — Teachers / Assignments (supporting tables)
-- ----------------------------------------------------------------------------
create policy teachers_select on teachers for select
  using (
    school_id = auth_school_id()
    or auth_role() = 'district_admin'
  );

create policy sta_select on student_teacher_assignments for select
  using (
    teacher_id = auth.uid()
    or student_id in (select id from students where school_id = auth_school_id())
    or auth_role() = 'district_admin'
  );

-- ============================================================================
-- NOTE ON PRODUCTION HARDENING (tracked, not yet implemented in MVP):
-- - No policy in this file grants blanket access by role name alone; every
--   policy scopes by district_id/school_id/self to prevent horizontal
--   privilege escalation across orgs.
-- - "district_admin read-only aggregate" on assessments/interventions should
--   be replaced with a dedicated materialized view + policy before Phase 3,
--   rather than raw row access, to avoid exposing individual student records
--   to district-level roles beyond what FERPA/aggregate-reporting requires.
-- - Service-role bypass (supabase service_role key) must NEVER be exposed to
--   client bundles. Confirmed no service_role usage outside /lib/services
--   server-only modules in Phase 2.
-- ============================================================================
