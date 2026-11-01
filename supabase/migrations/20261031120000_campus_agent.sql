-- EcoWasteAI Phase 1: campus sustainability agent.
-- Multi-university tenants, roles, recorded recycling behaviour, bin reports,
-- agent memory and actions, weekly insights.
--
-- Security model
--   * Reads: Row Level Security, using the caller's JWT (auth.uid()).
--   * Writes that award points or create records: SECURITY DEFINER functions that
--     only the service_role may execute. The `agent` Edge Function calls them with
--     the user id it verified from the JWT, so a user cannot forge points by calling
--     PostgREST directly.
--   * Self-service roles are student, faculty, staff. facilities and admin come only
--     from a hashed invite code (redeem_invite).

set local search_path = public, extensions;

-- ---------------------------------------------------------------- types
create type public.user_role as enum ('student', 'faculty', 'staff', 'facilities', 'admin');
create type public.bin_issue as enum ('full', 'contaminated', 'damaged', 'missing');
create type public.event_source as enum ('photo', 'chat', 'game');
create type public.report_status as enum ('open', 'resolved');

-- ---------------------------------------------------------------- tables
create table public.universities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  country text not null,
  default_language text not null default 'en' check (default_language in ('ar', 'en')),
  -- [{ id, label_ar, label_en, color, accepts: [category...] }]
  bins jsonb not null default '[]'::jsonb,
  sorting_rules text not null default '',
  points_per_item int not null default 10 check (points_per_item >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.universities (id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('building', 'bin_station', 'drop_off')),
  faculty text,
  materials text[] not null default '{}',
  lat double precision,
  lng double precision
);
create index on public.locations (university_id);

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  university_id uuid not null references public.universities (id),
  role public.user_role not null,
  faculty text,
  display_name text,
  created_at timestamptz not null default now()
);

create table public.role_invites (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.universities (id) on delete cascade,
  role public.user_role not null check (role in ('facilities', 'admin')),
  code_hash text not null unique,
  uses_left int not null default 1 check (uses_left >= 0),
  expires_at timestamptz
);

create table public.impact_factors (
  category text primary key,
  avg_item_kg numeric not null,
  co2e_saved_per_kg numeric not null,
  source_note text not null
);

create table public.recycling_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  university_id uuid not null references public.universities (id) on delete cascade,
  location_id uuid references public.locations (id) on delete set null,
  faculty text,
  item text not null,
  category text not null references public.impact_factors (category),
  bin text not null,
  correct_bin boolean not null,
  recyclable boolean not null,
  quantity int not null check (quantity between 1 and 50),
  est_kg numeric not null,
  est_co2e_kg numeric not null,
  points int not null,
  source public.event_source not null,
  created_at timestamptz not null default now()
);
create index on public.recycling_events (university_id, created_at);
create index on public.recycling_events (user_id, created_at);

create table public.bin_reports (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.universities (id) on delete cascade,
  location_id uuid not null references public.locations (id) on delete cascade,
  reporter_id uuid references auth.users (id) on delete set null,
  issue public.bin_issue not null,
  note text,
  contamination_pct numeric check (contamination_pct between 0 and 100),
  status public.report_status not null default 'open',
  resolved_by uuid references auth.users (id) on delete set null,
  resolved_note text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index on public.bin_reports (university_id, status, created_at);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.messages (
  id bigserial primary key,
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  actions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index on public.messages (conversation_id, id);

create table public.agent_actions (
  id bigserial primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  conversation_id uuid references public.conversations (id) on delete set null,
  tool text not null,
  input jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  ok boolean not null,
  created_at timestamptz not null default now()
);

create table public.insights (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.universities (id) on delete cascade,
  period_start date not null,
  period_end date not null,
  stats jsonb not null,
  report text not null,
  created_at timestamptz not null default now()
);

-- Knowledge base: rows with university_id = null are general knowledge.
alter table if exists public.documents
  add column if not exists university_id uuid references public.universities (id) on delete cascade;

-- ---------------------------------------------------------------- helpers
create function public.my_university() returns uuid
language sql stable security definer set search_path = public, extensions as $$
  select university_id from public.profiles where user_id = auth.uid()
$$;

create function public.my_role() returns public.user_role
language sql stable security definer set search_path = public, extensions as $$
  select role from public.profiles where user_id = auth.uid()
$$;

-- ---------------------------------------------------------------- RLS
alter table public.universities enable row level security;
alter table public.locations enable row level security;
alter table public.profiles enable row level security;
alter table public.role_invites enable row level security;
alter table public.impact_factors enable row level security;
alter table public.recycling_events enable row level security;
alter table public.bin_reports enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.agent_actions enable row level security;
alter table public.insights enable row level security;

create policy "active universities are public" on public.universities
  for select to anon, authenticated using (active);
create policy "locations of my university" on public.locations
  for select to authenticated using (university_id = public.my_university());
create policy "read own profile" on public.profiles
  for select to authenticated using (user_id = auth.uid());
create policy "impact factors are public" on public.impact_factors
  for select to anon, authenticated using (true);
create policy "read own events" on public.recycling_events
  for select to authenticated using (user_id = auth.uid());
create policy "reports: own, or all of my university for facilities/admin" on public.bin_reports
  for select to authenticated using (
    university_id = public.my_university()
    and (reporter_id = auth.uid() or public.my_role() in ('facilities', 'admin'))
  );
create policy "read own conversations" on public.conversations
  for select to authenticated using (user_id = auth.uid());
create policy "read own messages" on public.messages
  for select to authenticated using (user_id = auth.uid());
create policy "read own agent actions" on public.agent_actions
  for select to authenticated using (user_id = auth.uid());
create policy "admins read insights of their university" on public.insights
  for select to authenticated using (university_id = public.my_university() and public.my_role() = 'admin');
-- role_invites: no policies (only reachable through redeem_invite).

-- ---------------------------------------------------------------- self-service
create function public.create_profile(
  p_university uuid, p_role public.user_role, p_faculty text, p_display_name text
) returns public.profiles
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_uid uuid := auth.uid();
  v_existing public.profiles;
  v_result public.profiles;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_role not in ('student', 'faculty', 'staff') then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;
  if not exists (select 1 from public.universities where id = p_university and active) then
    raise exception 'invalid_university';
  end if;

  select * into v_existing from public.profiles where user_id = v_uid;
  if found and v_existing.role in ('facilities', 'admin') then
    -- staff accounts keep their role; they cannot move to another university here
    if v_existing.university_id <> p_university then
      raise exception 'insufficient_privilege' using errcode = '42501';
    end if;
    update public.profiles
       set faculty = left(p_faculty, 120), display_name = left(p_display_name, 80)
     where user_id = v_uid returning * into v_result;
    return v_result;
  end if;

  insert into public.profiles (user_id, university_id, role, faculty, display_name)
  values (v_uid, p_university, p_role, left(p_faculty, 120), left(p_display_name, 80))
  on conflict (user_id) do update
    set university_id = excluded.university_id, role = excluded.role,
        faculty = excluded.faculty, display_name = excluded.display_name
  returning * into v_result;
  return v_result;
end $$;

create function public.redeem_invite(p_code text) returns public.profiles
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_uid uuid := auth.uid();
  v_invite public.role_invites;
  v_result public.profiles;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  select * into v_invite from public.role_invites
   where code_hash = encode(extensions.digest(upper(trim(coalesce(p_code, ''))), 'sha256'), 'hex')
     and uses_left > 0 and (expires_at is null or expires_at > now())
   for update;
  if not found then
    raise exception 'invalid_invite';
  end if;
  update public.role_invites set uses_left = uses_left - 1 where id = v_invite.id;
  insert into public.profiles (user_id, university_id, role)
  values (v_uid, v_invite.university_id, v_invite.role)
  on conflict (user_id) do update set university_id = excluded.university_id, role = excluded.role
  returning * into v_result;
  return v_result;
end $$;

-- ---------------------------------------------------------------- agent writes (service_role only)
create function public.log_recycling_event(
  p_user uuid, p_item text, p_category text, p_bin text, p_quantity int,
  p_location uuid, p_source public.event_source
) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_profile public.profiles;
  v_uni public.universities;
  v_factor public.impact_factors;
  v_bin jsonb;
  v_correct boolean;
  v_recyclable boolean;
  v_kg numeric;
  v_co2 numeric;
  v_points int;
  v_id uuid;
begin
  select * into v_profile from public.profiles where user_id = p_user;
  if not found then raise exception 'no_profile'; end if;
  select * into v_uni from public.universities where id = v_profile.university_id;
  select * into v_factor from public.impact_factors where category = p_category;
  if not found then raise exception 'invalid_category'; end if;
  if p_quantity is null or p_quantity < 1 or p_quantity > 50 then raise exception 'invalid_quantity'; end if;
  if p_location is not null and not exists (
    select 1 from public.locations where id = p_location and university_id = v_uni.id
  ) then
    raise exception 'invalid_location';
  end if;
  select b into v_bin from jsonb_array_elements(v_uni.bins) b where b ->> 'id' = p_bin;
  if v_bin is null then raise exception 'invalid_bin'; end if;

  v_correct := (v_bin -> 'accepts') ? p_category;
  v_recyclable := p_category in ('plastic', 'paper', 'metal', 'glass');
  v_kg := v_factor.avg_item_kg * p_quantity;
  v_co2 := case when v_correct then v_kg * v_factor.co2e_saved_per_kg else 0 end;
  v_points := case when v_correct then v_uni.points_per_item * p_quantity else 0 end;

  insert into public.recycling_events (
    user_id, university_id, location_id, faculty, item, category, bin, correct_bin,
    recyclable, quantity, est_kg, est_co2e_kg, points, source
  ) values (
    p_user, v_uni.id, p_location, v_profile.faculty, left(p_item, 120), p_category, p_bin, v_correct,
    v_recyclable, p_quantity, v_kg, v_co2, v_points, p_source
  ) returning id into v_id;

  return jsonb_build_object(
    'event_id', v_id, 'correct_bin', v_correct, 'points', v_points,
    'est_kg', v_kg, 'est_co2e_kg', v_co2,
    'correct_bins', (select coalesce(jsonb_agg(b ->> 'id'), '[]'::jsonb)
                       from jsonb_array_elements(v_uni.bins) b where (b -> 'accepts') ? p_category)
  );
end $$;

create function public.file_bin_report(
  p_user uuid, p_location uuid, p_issue public.bin_issue, p_note text, p_contamination_pct numeric
) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_uni uuid;
  v_existing uuid;
  v_id uuid;
begin
  select university_id into v_uni from public.profiles where user_id = p_user;
  if v_uni is null then raise exception 'no_profile'; end if;
  if not exists (select 1 from public.locations where id = p_location and university_id = v_uni) then
    raise exception 'invalid_location';
  end if;
  select id into v_existing from public.bin_reports
   where location_id = p_location and issue = p_issue and status = 'open'
     and created_at > now() - interval '24 hours'
   order by created_at desc limit 1;
  if v_existing is not null then
    return jsonb_build_object('report_id', v_existing, 'duplicate', true);
  end if;
  insert into public.bin_reports (university_id, location_id, reporter_id, issue, note, contamination_pct)
  values (v_uni, p_location, p_user, p_issue, left(p_note, 500), p_contamination_pct)
  returning id into v_id;
  return jsonb_build_object('report_id', v_id, 'duplicate', false);
end $$;

create function public.resolve_bin_report(p_user uuid, p_report uuid, p_note text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_profile public.profiles;
  v_id uuid;
begin
  select * into v_profile from public.profiles where user_id = p_user;
  if not found or v_profile.role not in ('facilities', 'admin') then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;
  update public.bin_reports
     set status = 'resolved', resolved_by = p_user, resolved_note = left(p_note, 500), resolved_at = now()
   where id = p_report and university_id = v_profile.university_id and status = 'open'
  returning id into v_id;
  if v_id is null then raise exception 'report_not_found'; end if;
  return jsonb_build_object('report_id', v_id, 'status', 'resolved');
end $$;

-- p_actions: [{ tool, input, result, ok, card }]
create function public.save_agent_turn(
  p_user uuid, p_conversation uuid, p_user_text text, p_reply text, p_actions jsonb
) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_conv uuid;
  v_cards jsonb;
begin
  select id into v_conv from public.conversations where id = p_conversation and user_id = p_user;
  if v_conv is null then
    insert into public.conversations (user_id, title) values (p_user, left(p_user_text, 60))
    returning id into v_conv;
  else
    update public.conversations set updated_at = now() where id = v_conv;
  end if;

  select coalesce(jsonb_agg(a -> 'card') filter (where a ? 'card' and jsonb_typeof(a -> 'card') = 'object'), '[]'::jsonb)
    into v_cards from jsonb_array_elements(coalesce(p_actions, '[]'::jsonb)) a;

  insert into public.messages (conversation_id, user_id, role, content)
  values (v_conv, p_user, 'user', left(p_user_text, 4000));
  insert into public.messages (conversation_id, user_id, role, content, actions)
  values (v_conv, p_user, 'assistant', left(p_reply, 8000), v_cards);

  insert into public.agent_actions (user_id, conversation_id, tool, input, result, ok)
  select p_user, v_conv, a ->> 'tool', coalesce(a -> 'input', '{}'::jsonb), coalesce(a -> 'result', '{}'::jsonb),
         coalesce((a ->> 'ok')::boolean, false)
    from jsonb_array_elements(coalesce(p_actions, '[]'::jsonb)) a;
  return v_conv;
end $$;

create function public.save_insight(
  p_university uuid, p_start date, p_end date, p_stats jsonb, p_report text
) returns uuid
language sql security definer set search_path = public, extensions as $$
  insert into public.insights (university_id, period_start, period_end, stats, report)
  values (p_university, p_start, p_end, p_stats, p_report) returning id
$$;

-- ---------------------------------------------------------------- reads
create view public.my_impact with (security_invoker = true) as
with mine as (
  select * from public.recycling_events where user_id = auth.uid()
), days as (
  select distinct (created_at at time zone 'utc')::date d from mine
), streak as (
  -- consecutive days ending today or yesterday
  select count(*) n from (
    select d, (current_date - d) - (row_number() over (order by d desc) - 1) grp from days
  ) x where grp = (select case when exists (select 1 from days where d = current_date) then 0 else 1 end)
)
select
  coalesce(sum(quantity), 0)::bigint as items,
  coalesce(sum(est_kg), 0) as est_kg,
  coalesce(sum(est_co2e_kg), 0) as est_co2e_kg,
  coalesce(sum(points), 0)::bigint as points,
  coalesce(round(100.0 * avg(case when correct_bin then 1 else 0 end)), 0)::int as correct_pct,
  (select n from streak)::int as streak_days
from mine;

create function public.faculty_leaderboard(p_university uuid)
returns table (faculty text, points bigint, items bigint, members bigint)
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  if p_university is distinct from public.my_university() and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;
  return query
    select coalesce(e.faculty, 'Other'), sum(e.points)::bigint, sum(e.quantity)::bigint, count(distinct e.user_id)::bigint
      from public.recycling_events e
     where e.university_id = p_university and e.created_at > now() - interval '30 days'
     group by 1 order by 2 desc;
end $$;

create function public.university_stats(p_university uuid, p_from timestamptz, p_to timestamptz)
returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  v_len interval := p_to - p_from;
  v_result jsonb;
begin
  if coalesce(auth.role(), '') <> 'service_role'
     and not (public.my_role() = 'admin' and public.my_university() = p_university) then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;

  with ev as (
    select * from public.recycling_events
     where university_id = p_university and created_at >= p_from and created_at < p_to
  ), prev as (
    select * from public.recycling_events
     where university_id = p_university and created_at >= p_from - v_len and created_at < p_from
  )
  select jsonb_build_object(
    'period', jsonb_build_object('from', p_from, 'to', p_to),
    'totals', (select jsonb_build_object(
        'events', count(*), 'items', coalesce(sum(quantity), 0),
        'est_kg', round(coalesce(sum(est_kg), 0), 2), 'est_co2e_kg', round(coalesce(sum(est_co2e_kg), 0), 2),
        'correct_rate', round(coalesce(avg(case when correct_bin then 1.0 else 0 end), 0), 2),
        'active_users', count(distinct user_id)) from ev),
    'previous', (select jsonb_build_object(
        'events', count(*), 'items', coalesce(sum(quantity), 0),
        'correct_rate', round(coalesce(avg(case when correct_bin then 1.0 else 0 end), 0), 2)) from prev),
    'by_category', coalesce((select jsonb_agg(c order by c ->> 'category') from (
        select jsonb_build_object('category', category, 'items', sum(quantity),
               'correct_rate', round(avg(case when correct_bin then 1.0 else 0 end), 2)) c
          from ev group by category) x), '[]'::jsonb),
    'by_faculty', coalesce((select jsonb_agg(f) from (
        select jsonb_build_object('faculty', coalesce(faculty, 'Other'), 'items', sum(quantity),
               'correct_rate', round(avg(case when correct_bin then 1.0 else 0 end), 2)) f
          from ev group by coalesce(faculty, 'Other') order by sum(quantity) desc) x), '[]'::jsonb),
    'top_missorted', coalesce((select jsonb_agg(m) from (
        select jsonb_build_object('item', item, 'category', category, 'wrong_bin', bin, 'count', sum(quantity)) m
          from ev where not correct_bin
         group by item, category, bin order by sum(quantity) desc limit 5) x), '[]'::jsonb),
    'worst_locations', coalesce((select jsonb_agg(w) from (
        select jsonb_build_object('location_id', l.id, 'name', l.name,
               'wrong', sum(case when not e.correct_bin then e.quantity else 0 end), 'total', sum(e.quantity)) w
          from ev e join public.locations l on l.id = e.location_id
         group by l.id, l.name
        having sum(case when not e.correct_bin then e.quantity else 0 end) > 0
         order by sum(case when not e.correct_bin then e.quantity else 0 end) desc limit 5) x), '[]'::jsonb),
    'open_reports', (select count(*) from public.bin_reports where university_id = p_university and status = 'open')
  ) into v_result;
  return v_result;
end $$;

create function public.match_documents_scoped(query_embedding vector, match_count int, p_university uuid)
returns table (content text, similarity double precision)
language sql stable security definer set search_path = public, extensions as $$
  select d.content, 1 - (d.embedding <=> query_embedding) as similarity
    from public.documents d
   where d.university_id is null or d.university_id = p_university
   order by d.embedding <=> query_embedding
   limit least(greatest(match_count, 1), 50)
$$;

-- ---------------------------------------------------------------- function privileges
-- Supabase grants EXECUTE on new public functions to anon and authenticated by default.
revoke execute on function
  public.log_recycling_event(uuid, text, text, text, int, uuid, public.event_source),
  public.file_bin_report(uuid, uuid, public.bin_issue, text, numeric),
  public.resolve_bin_report(uuid, uuid, text),
  public.save_agent_turn(uuid, uuid, text, text, jsonb),
  public.save_insight(uuid, date, date, jsonb, text),
  public.match_documents_scoped(vector, int, uuid)
from public, anon, authenticated;
grant execute on function
  public.log_recycling_event(uuid, text, text, text, int, uuid, public.event_source),
  public.file_bin_report(uuid, uuid, public.bin_issue, text, numeric),
  public.resolve_bin_report(uuid, uuid, text),
  public.save_agent_turn(uuid, uuid, text, text, jsonb),
  public.save_insight(uuid, date, date, jsonb, text),
  public.match_documents_scoped(vector, int, uuid)
to service_role;

revoke execute on function
  public.create_profile(uuid, public.user_role, text, text),
  public.redeem_invite(text),
  public.faculty_leaderboard(uuid),
  public.university_stats(uuid, timestamptz, timestamptz),
  public.my_university(),
  public.my_role()
from public, anon;
grant execute on function
  public.create_profile(uuid, public.user_role, text, text),
  public.redeem_invite(text),
  public.faculty_leaderboard(uuid),
  public.university_stats(uuid, timestamptz, timestamptz),
  public.my_university(),
  public.my_role()
to authenticated, service_role;

-- Direct table writes from the browser are never needed.
revoke insert, update, delete on
  public.universities, public.locations, public.profiles, public.role_invites, public.impact_factors,
  public.recycling_events, public.bin_reports, public.conversations, public.messages,
  public.agent_actions, public.insights
from anon, authenticated;
grant select on public.my_impact to authenticated;

-- ---------------------------------------------------------------- reference data
insert into public.impact_factors (category, avg_item_kg, co2e_saved_per_kg, source_note) values
  ('plastic', 0.025, 1.0, 'Approximation from US EPA WARM recycling factors; verify before publishing'),
  ('paper',   0.05,  3.0, 'Approximation from US EPA WARM recycling factors; verify before publishing'),
  ('metal',   0.015, 9.0, 'Approximation from US EPA WARM recycling factors; verify before publishing'),
  ('glass',   0.30,  0.3, 'Approximation from US EPA WARM recycling factors; verify before publishing'),
  ('organic', 0.10,  0.2, 'Approximation from US EPA WARM composting factors; verify before publishing'),
  ('hazardous', 0.05, 0,  'Not counted as CO2e savings'),
  ('general', 0.05,  0,   'Not counted as CO2e savings');
