-- ============================================================================
-- 0002_fix_student_teacher_rls_recursion.sql
-- Fixes infinite recursion between `students` and
-- `student_teacher_assignments` RLS policies.
--
-- Root cause: students_select_teacher queried student_teacher_assignments
-- directly in its USING clause, and student_teacher_assignments' own
-- sta_select policy queries students back (to resolve school_leader scope).
-- Planning a query against either table requires expanding the other's
-- policy, which requires expanding the first's again — Postgres detects
-- this as "infinite recursion detected in policy for relation students".
--
-- Fix: add a SECURITY DEFINER helper (same pattern as auth_role() /
-- auth_district_id() / auth_school_id() already used against `profiles`)
-- that resolves a teacher's assigned student ids without going back
-- through student_teacher_assignments' own RLS. A SECURITY DEFINER
-- function executes with its owner's privileges, and table owners are not
-- subject to their own tables' RLS (no FORCE ROW LEVEL SECURITY is set
-- anywhere in this schema) — the same mechanism the existing auth_*()
-- helpers already rely on to read `profiles` without recursing into
-- profiles' own policies. This breaks the cycle.
-- ============================================================================

create or replace function auth_teacher_student_ids() returns setof uuid as $$
  select student_id from student_teacher_assignments where teacher_id = auth.uid();
$$ language sql stable security definer;

-- students: replace the direct cross-table subquery with the helper.
drop policy if exists students_select_teacher on students;
create policy students_select_teacher on students for select
  using (
    auth_role() = 'teacher'
    and id in (select auth_teacher_student_ids())
  );

-- profiles: same underlying query as students_select_teacher, same helper.
-- Also drops a redundant join through `teachers` that the original policy
-- had (teacher_id = auth.uid() already pins the teacher; joining teachers
-- added nothing but another RLS-protected table into the query plan).
drop policy if exists profiles_select_teacher_own_students on profiles;
create policy profiles_select_teacher_own_students on profiles for select
  using (
    auth_role() = 'teacher'
    and id in (select auth_teacher_student_ids())
  );

-- assessments: same helper, same reason, same redundant join removed.
drop policy if exists assessments_insert_teacher on assessments;
create policy assessments_insert_teacher on assessments for insert
  with check (
    auth_role() = 'teacher'
    and student_id in (select auth_teacher_student_ids())
  );
