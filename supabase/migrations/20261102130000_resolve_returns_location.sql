-- Living Campus: resolving a report also returns its location, so the campus can remove that bin's pin.
set local search_path = public, extensions;

create or replace function public.resolve_bin_report(p_user uuid, p_report uuid, p_note text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_profile public.profiles;
  v_id uuid;
  v_location uuid;
begin
  select * into v_profile from public.profiles where user_id = p_user;
  if not found or v_profile.role not in ('facilities', 'admin') then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;
  update public.bin_reports
     set status = 'resolved', resolved_by = p_user, resolved_note = left(p_note, 500), resolved_at = now()
   where id = p_report and university_id = v_profile.university_id and status = 'open'
  returning id, location_id into v_id, v_location;
  if v_id is null then raise exception 'report_not_found'; end if;
  return jsonb_build_object('report_id', v_id, 'status', 'resolved', 'location_id', v_location);
end $$;

revoke execute on function public.resolve_bin_report(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.resolve_bin_report(uuid, uuid, text) to service_role;
