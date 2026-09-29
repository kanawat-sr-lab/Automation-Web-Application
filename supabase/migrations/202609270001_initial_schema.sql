create extension if not exists pgcrypto;

create type public.app_role as enum ('Admin', 'Technician');
create type public.machine_status as enum ('running', 'stop', 'alarm', 'maintenance');
create type public.alarm_status as enum ('open', 'in_progress', 'closed');
create type public.maintenance_status as enum ('planned', 'in_progress', 'completed');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null check (length(trim(full_name)) between 1 and 120),
  role public.app_role not null default 'Technician',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.machines (
  machine_id text primary key check (machine_id ~ '^[A-Za-z0-9-]{2,24}$'),
  machine_name text not null check (length(trim(machine_name)) between 1 and 120),
  machine_type text not null check (length(trim(machine_type)) between 1 and 60),
  location text not null check (length(trim(location)) between 1 and 120),
  status public.machine_status not null default 'running',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.alarms (
  id text primary key default ('AL-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))),
  machine_id text not null references public.machines (machine_id) on delete restrict,
  alarm_code text not null check (length(trim(alarm_code)) between 1 and 32),
  description text not null check (length(trim(description)) between 1 and 500),
  occurred_at timestamptz not null default now(),
  cause text check (cause is null or length(cause) <= 1000),
  status public.alarm_status not null default 'open',
  created_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.maintenance_records (
  id text primary key default ('PM-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))),
  machine_id text not null references public.machines (machine_id) on delete restrict,
  task_description text not null check (length(trim(task_description)) between 1 and 1000),
  scheduled_at timestamptz not null,
  technician_id uuid references public.profiles (id) on delete set null,
  status public.maintenance_status not null default 'planned',
  completed_at timestamptz,
  notes text check (notes is null or length(notes) <= 4000),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index alarms_machine_status_idx on public.alarms (machine_id, status);
create index alarms_occurred_at_idx on public.alarms (occurred_at desc);
create index maintenance_machine_status_idx on public.maintenance_records (machine_id, status);
create index maintenance_scheduled_at_idx on public.maintenance_records (scheduled_at);
create index maintenance_technician_idx on public.maintenance_records (technician_id);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at before update on public.profiles
for each row execute function public.touch_updated_at();
create trigger machines_touch_updated_at before update on public.machines
for each row execute function public.touch_updated_at();
create trigger alarms_touch_updated_at before update on public.alarms
for each row execute function public.touch_updated_at();
create trigger maintenance_touch_updated_at before update on public.maintenance_records
for each row execute function public.touch_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'Admin'::public.app_role
  );
$$;

alter table public.profiles enable row level security;
alter table public.machines enable row level security;
alter table public.alarms enable row level security;
alter table public.maintenance_records enable row level security;

create policy "Authenticated users can view profiles" on public.profiles
for select to authenticated using (true);
create policy "Admins can update profiles" on public.profiles
for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "Authenticated users can view machines" on public.machines
for select to authenticated using (true);
create policy "Admins can create machines" on public.machines
for insert to authenticated with check (public.is_admin());
create policy "Admins can update machines" on public.machines
for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admins can delete machines" on public.machines
for delete to authenticated using (public.is_admin());

create policy "Authenticated users can view alarms" on public.alarms
for select to authenticated using (true);
create policy "Authenticated users can create alarms" on public.alarms
for insert to authenticated with check (created_by is null or created_by = (select auth.uid()));
create policy "Authenticated users can update alarms" on public.alarms
for update to authenticated using (true) with check (true);

create or replace function public.guard_technician_alarm_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not public.is_admin() and (
    new.id is distinct from old.id
    or new.machine_id is distinct from old.machine_id
    or new.alarm_code is distinct from old.alarm_code
    or new.description is distinct from old.description
    or new.occurred_at is distinct from old.occurred_at
    or new.cause is distinct from old.cause
    or new.created_by is distinct from old.created_by
  ) then
    raise exception 'Technicians may only change alarm status';
  end if;
  return new;
end;
$$;

create trigger alarms_guard_technician_update before update on public.alarms
for each row execute function public.guard_technician_alarm_update();

create or replace function public.sync_machine_alarm_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_machine_id text;
begin
  affected_machine_id := coalesce(new.machine_id, old.machine_id);
  if exists (
    select 1 from public.alarms
    where machine_id = affected_machine_id and status <> 'closed'::public.alarm_status
  ) then
    update public.machines set status = 'alarm'::public.machine_status
    where machine_id = affected_machine_id and status <> 'maintenance'::public.machine_status;
  else
    update public.machines set status = 'running'::public.machine_status
    where machine_id = affected_machine_id and status = 'alarm'::public.machine_status;
  end if;
  return coalesce(new, old);
end;
$$;

create trigger alarms_sync_machine_status
after insert or update or delete on public.alarms
for each row execute function public.sync_machine_alarm_status();

create policy "Authenticated users can view maintenance" on public.maintenance_records
for select to authenticated using (true);
create policy "Authenticated users can create maintenance" on public.maintenance_records
for insert to authenticated with check (
  (created_by is null or created_by = (select auth.uid()))
  and (technician_id is null or technician_id = (select auth.uid()) or public.is_admin())
);
create policy "Authenticated users can update maintenance" on public.maintenance_records
for update to authenticated
using (public.is_admin() or technician_id = (select auth.uid()) or created_by = (select auth.uid()))
with check (public.is_admin() or technician_id = (select auth.uid()) or created_by = (select auth.uid()));

create or replace function public.guard_technician_maintenance_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not public.is_admin() and (
    new.id is distinct from old.id
    or new.machine_id is distinct from old.machine_id
    or new.task_description is distinct from old.task_description
    or new.scheduled_at is distinct from old.scheduled_at
    or new.technician_id is distinct from old.technician_id
    or new.created_by is distinct from old.created_by
    or new.created_at is distinct from old.created_at
  ) then
    raise exception 'Technicians may only update maintenance progress';
  end if;
  return new;
end;
$$;

create trigger maintenance_guard_technician_update before update on public.maintenance_records
for each row execute function public.guard_technician_maintenance_update();

create policy "Admins can delete maintenance" on public.maintenance_records
for delete to authenticated using (public.is_admin());

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.machines to authenticated;
grant select, insert, update on public.alarms to authenticated;
grant select, insert, update, delete on public.maintenance_records to authenticated;

-- Promote a trusted account after signing up; never let a client assign its own role.
-- update public.profiles set role = 'Admin' where id = (select id from auth.users where email = 'admin@company.com');