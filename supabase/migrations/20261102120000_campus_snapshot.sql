-- Living Campus: an anonymised snapshot of one university for the 3D campus.
-- No user ids are returned. Members of the university can read it, and anyone can read
-- universities flagged public_demo (the showcase on the home page).

set local search_path = public, extensions;

alter table public.universities add column if not exists public_demo boolean not null default false;

create or replace function public.campus_snapshot(p_university uuid) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  v_uni public.universities;
  v_result jsonb;
begin
  select * into v_uni from public.universities where id = p_university and active;
  if not found
     or not (coalesce(auth.role(), '') = 'service_role'
             or coalesce(public.my_university() = p_university, false)
             or v_uni.public_demo) then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'university', jsonb_build_object('id', v_uni.id, 'name', v_uni.name),
    'locations', coalesce((select jsonb_agg(jsonb_build_object(
        'id', l.id, 'name', l.name, 'kind', l.kind, 'faculty', l.faculty, 'lat', l.lat, 'lng', l.lng) order by l.name)
      from public.locations l where l.university_id = p_university), '[]'::jsonb),
    'faculties', coalesce((select jsonb_agg(f order by f ->> 'faculty') from (
        select jsonb_build_object(
          'faculty', coalesce(e.faculty, 'Campus'),
          'points_30d', coalesce(sum(e.points), 0)::int,
          'items_30d', coalesce(sum(e.quantity), 0)::int,
          'correct_rate_30d', round(coalesce(avg(case when e.correct_bin then 1.0 else 0 end), 0), 2),
          'wrong_items_30d', coalesce(sum(e.quantity) filter (where not e.correct_bin), 0)::int) f
        from public.recycling_events e
        where e.university_id = p_university and e.created_at > now() - interval '30 days'
        group by coalesce(e.faculty, 'Campus')) x), '[]'::jsonb),
    'events_7d', coalesce((select jsonb_agg(ev order by (ev ->> 'created_at') desc) from (
        select jsonb_build_object(
          'created_at', e.created_at, 'location_id', e.location_id, 'faculty', e.faculty,
          'category', e.category, 'correct_bin', e.correct_bin, 'verification', e.verification,
          'quantity', e.quantity) ev
        from public.recycling_events e
        where e.university_id = p_university and e.created_at > now() - interval '7 days'
        order by e.created_at desc limit 500) x), '[]'::jsonb),
    'open_reports', coalesce((select jsonb_agg(jsonb_build_object(
        'location_id', r.location_id, 'issue', r.issue, 'contamination_pct', r.contamination_pct))
      from public.bin_reports r where r.university_id = p_university and r.status = 'open'), '[]'::jsonb)
  ) into v_result;
  return v_result;
end $$;

revoke execute on function public.campus_snapshot(uuid) from public;
grant execute on function public.campus_snapshot(uuid) to anon, authenticated, service_role;

update public.universities set public_demo = true where id = '00000000-0000-4000-8000-000000000001';

-- Security fix: the admin check evaluated to NULL (not false) for a signed-in user with no
-- profile, which let such a user read any university's statistics. Make it NULL-safe.
create or replace function public.university_stats(p_university uuid, p_from timestamptz, p_to timestamptz)
returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  v_len interval := p_to - p_from;
  v_result jsonb;
begin
  if coalesce(auth.role(), '') <> 'service_role'
     and not coalesce(public.my_role() = 'admin' and public.my_university() = p_university, false) then
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
