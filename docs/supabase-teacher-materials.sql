-- Lumina — 教师教材：对象存储 + 元数据表（商用骨架）
-- 在 Supabase SQL Editor 中执行。
-- 前提：若尚未创建 public.set_updated_at，请先执行 docs/supabase-auth-profile-roles.sql（本脚本复用其中的触发器函数）。
-- 执行前请在 Dashboard → Storage 创建私有 bucket：`teacher-materials`
-- （若需脚本创建 bucket：）insert into storage.buckets (id, name, public) values ('teacher-materials', 'teacher-materials', false);

-- ---------------------------------------------------------------------------
-- 1) public.teacher_materials
-- ---------------------------------------------------------------------------
create table if not exists public.teacher_materials (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  teacher_profile_id text not null,
  title text not null,
  material_category_key text not null,
  storage_bucket text not null default 'teacher-materials',
  storage_path text not null,
  original_filename text not null,
  mime_type text,
  size_bytes bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint teacher_materials_category_check
    check (material_category_key in ('ppt', 'handout', 'picture_book', 'pdf', 'other'))
);

create index if not exists teacher_materials_owner_profile_idx
  on public.teacher_materials (owner_user_id, teacher_profile_id);
create index if not exists teacher_materials_updated_idx
  on public.teacher_materials (updated_at desc);

drop trigger if exists teacher_materials_set_updated_at on public.teacher_materials;
create trigger teacher_materials_set_updated_at
  before update on public.teacher_materials
  for each row execute function public.set_updated_at();

alter table public.teacher_materials enable row level security;

create policy "teacher_materials_select_own"
  on public.teacher_materials for select
  using (auth.uid() = owner_user_id);

create policy "teacher_materials_insert_own"
  on public.teacher_materials for insert
  with check (auth.uid() = owner_user_id);

create policy "teacher_materials_update_own"
  on public.teacher_materials for update
  using (auth.uid() = owner_user_id);

create policy "teacher_materials_delete_own"
  on public.teacher_materials for delete
  using (auth.uid() = owner_user_id);

-- ---------------------------------------------------------------------------
-- 2) Storage：仅允许访问自己文件夹（路径首段 = auth.uid()）
--    客户端路径约定：{user_id}/{material_id}/{filename}
-- ---------------------------------------------------------------------------
create policy "teacher_materials_storage_select"
  on storage.objects for select
  using (
    bucket_id = 'teacher-materials'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "teacher_materials_storage_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'teacher-materials'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "teacher_materials_storage_update"
  on storage.objects for update
  using (
    bucket_id = 'teacher-materials'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "teacher_materials_storage_delete"
  on storage.objects for delete
  using (
    bucket_id = 'teacher-materials'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- TODO: 若 public.teacher_profiles 进 Supabase，可增加 WITH CHECK 限制 teacher_profile_id 必须属于当前用户，防跨 profile 写入。
