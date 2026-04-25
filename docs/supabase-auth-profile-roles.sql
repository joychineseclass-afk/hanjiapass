-- Lumina Auth — public.profiles + public.user_roles 最小表与 RLS（Step 5）
-- 在 Supabase SQL Editor 中执行。service_role 仅用于管理端，不要放进浏览器。

-- 扩展 pgcrypto（部分项目需显式 enable）
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 1) public.profiles
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text,
  avatar_url text,
  locale text not null default 'kr',
  default_role text not null default 'student',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_default_role_check
    check (default_role in ('student', 'teacher', 'parent', 'admin', 'super_admin'))
);

-- 禁止从前端/anon 将 default_role 直接改为 admin / super_admin（由后端或服务角色再放开）
-- 应用层 also 不提交这些值；本约束为纵深防御。
-- 若将来需由审核流提升 teacher，可仅允许 default_role 在 student/parent/teacher 间由受控服务更新。

create index if not exists profiles_email_lower_idx on public.profiles (lower(email));

-- ---------------------------------------------------------------------------
-- 2) public.user_roles
-- guest 不写入本表，未登录即 guest
-- ---------------------------------------------------------------------------
create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null,
  created_at timestamptz not null default now(),
  constraint user_roles_unique unique (user_id, role),
  constraint user_roles_role_check
    check (role in ('student', 'teacher', 'parent', 'admin', 'super_admin'))
);

create index if not exists user_roles_user_id_idx on public.user_roles (user_id);

-- ---------------------------------------------------------------------------
-- 3) 更新时间
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 4) RLS
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;

-- profiles: 读自己
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

-- profiles: 仅允许插入自己 id 行（首次 ensure）
create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

-- profiles: 更新自己；不得把 default_role 改为 admin 或 super_admin
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and default_role not in ('admin', 'super_admin')
  );

-- user_roles: 只读自己
create policy "user_roles_select_own"
  on public.user_roles for select
  using (auth.uid() = user_id);

-- 首登时仅能插入自己的 student（防止自助提权 teacher/admin；teacher 由审核流或服务端再写入）
create policy "user_roles_insert_student_only"
  on public.user_roles for insert
  with check (
    auth.uid() = user_id
    and role = 'student'
  );

-- 普通用户不更新/删除 user_roles；后续 admin 策略 TODO（service role 或 Edge）
-- 当前：无 update/delete policy 即普通角色不可改

-- TODO(admin): 未来可增 policy（service_role / 特判 JWT claim）供运营调整角色。

-- ---------------------------------------------------------------------------
-- 5) 可选：方案 A — 注册时自动建 profile（稳定后可启用）
-- ---------------------------------------------------------------------------
-- create or replace function public.handle_new_user()
-- returns trigger as $$
-- begin
--   insert into public.profiles (id, email, display_name, locale, default_role)
--   values (
--     new.id,
--     new.email,
--     coalesce(new.raw_user_meta_data->>'display_name', split_part(coalesce(new.email, ''), '@', 1)),
--     'kr',
--     'student'
--   );
--   insert into public.user_roles (user_id, role) values (new.id, 'student');
--   return new;
-- end;
-- $$ language plpgsql security definer set search_path = public;
-- drop trigger if exists on_auth_user_created on auth.users;
-- create trigger on_auth_user_created
--   after insert on auth.users
--   for each row execute function public.handle_new_user();
