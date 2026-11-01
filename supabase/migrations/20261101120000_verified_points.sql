-- Points only for photo-verified recycling.
--   * verification = 'photo'          : the agent saw the item in a photo -> full points
--   * verification = 'self_reported'  : the user only said it             -> recorded, 0 points
-- The same photo (SHA-256 of the uploaded image) can never be used twice, and points
-- stop at a per-university daily cap. Self-reported vs verified behaviour can now be
-- compared in the data (the self-report limitation of the original study).

set local search_path = public, extensions;

alter table public.universities
  add column if not exists daily_points_cap int not null default 200 check (daily_points_cap >= 0);

alter table public.recycling_events
  add column if not exists verification text not null default 'self_reported'
    check (verification in ('photo', 'self_reported')),
  add column if not exists image_hash text;

create unique index if not exists recycling_events_image_hash_key
  on public.recycling_events (image_hash) where image_hash is not null;

-- Existing photo events (demo data) were made from photos.
update public.recycling_events set verification = 'photo' where source = 'photo';

drop function if exists public.log_recycling_event(uuid, text, text, text, int, uuid, public.event_source);

create function public.log_recycling_event(
  p_user uuid, p_item text, p_category text, p_bin text, p_quantity int,
  p_location uuid, p_source public.event_source, p_image_hash text default null
) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_profile public.profiles;
  v_uni public.universities;
  v_factor public.impact_factors;
  v_bin jsonb;
  v_correct boolean;
  v_recyclable boolean;
  v_verified boolean := coalesce(p_image_hash, '') <> '';
  v_kg numeric;
  v_co2 numeric;
  v_base int;
  v_today int;
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
  if v_verified and exists (select 1 from public.recycling_events where image_hash = p_image_hash) then
    raise exception 'duplicate_photo';
  end if;

  v_correct := (v_bin -> 'accepts') ? p_category;
  v_recyclable := p_category in ('plastic', 'paper', 'metal', 'glass');
  v_kg := v_factor.avg_item_kg * p_quantity;
  v_co2 := case when v_correct then v_kg * v_factor.co2e_saved_per_kg else 0 end;
  v_base := case when v_correct and v_verified then v_uni.points_per_item * p_quantity else 0 end;
  select coalesce(sum(points), 0) into v_today from public.recycling_events
   where user_id = p_user and created_at >= date_trunc('day', now());
  v_points := least(v_base, greatest(v_uni.daily_points_cap - v_today, 0));

  insert into public.recycling_events (
    user_id, university_id, location_id, faculty, item, category, bin, correct_bin,
    recyclable, quantity, est_kg, est_co2e_kg, points, source, verification, image_hash
  ) values (
    p_user, v_uni.id, p_location, v_profile.faculty, left(p_item, 120), p_category, p_bin, v_correct,
    v_recyclable, p_quantity, v_kg, v_co2, v_points, p_source,
    case when v_verified then 'photo' else 'self_reported' end, nullif(p_image_hash, '')
  ) returning id into v_id;

  return jsonb_build_object(
    'event_id', v_id, 'correct_bin', v_correct, 'points', v_points,
    'verification', case when v_verified then 'photo' else 'self_reported' end,
    'capped', v_points < v_base,
    'est_kg', v_kg, 'est_co2e_kg', v_co2,
    'correct_bins', (select coalesce(jsonb_agg(b ->> 'id'), '[]'::jsonb)
                       from jsonb_array_elements(v_uni.bins) b where (b -> 'accepts') ? p_category)
  );
end $$;

revoke execute on function public.log_recycling_event(uuid, text, text, text, int, uuid, public.event_source, text)
  from public, anon, authenticated;
grant execute on function public.log_recycling_event(uuid, text, text, text, int, uuid, public.event_source, text)
  to service_role;

create or replace view public.my_impact with (security_invoker = true) as
with mine as (
  select * from public.recycling_events where user_id = auth.uid()
), days as (
  select distinct (created_at at time zone 'utc')::date d from mine
), streak as (
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
  (select n from streak)::int as streak_days,
  coalesce(sum(quantity) filter (where verification = 'photo'), 0)::bigint as verified_items
from mine;

create or replace function public.university_stats(p_university uuid, p_from timestamptz, p_to timestamptz)
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
        'active_users', count(distinct user_id),
        'verified_items', coalesce(sum(quantity) filter (where verification = 'photo'), 0)) from ev),
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

