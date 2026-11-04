-- Campus redesign: the snapshot also returns the university's bins (already public information),
-- so the 3D plaza shows this university's own bins and colours.

set local search_path = public, extensions;

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
    'university', jsonb_build_object('id', v_uni.id, 'name', v_uni.name, 'bins', v_uni.bins),
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
