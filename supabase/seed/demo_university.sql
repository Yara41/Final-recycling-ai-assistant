-- Demo tenant for the pitch, the demo video and local tests.
-- Run once after the campus_agent migration. Safe to re-run: it deletes and recreates
-- the demo university (and the demo users' data) only.
--
-- Demo invite codes (change or delete them before inviting real staff):
--   DEMO-FACILITIES  -> facilities role
--   DEMO-ADMIN       -> admin (sustainability office) role

set local search_path = public, extensions;

delete from auth.users where id::text like 'dddddddd-0000-4000-8000-%';
delete from public.universities where id = '00000000-0000-4000-8000-000000000001';

insert into public.universities (id, name, country, default_language, bins, sorting_rules, points_per_item, public_demo)
values (
  '00000000-0000-4000-8000-000000000001',
  'EcoWaste Demo University', 'AE', 'en',
  '[
    {"id":"general","label_ar":"نفايات عامة","label_en":"General waste","color":"#6b7280","accepts":["general","organic"]},
    {"id":"plastic","label_ar":"بلاستيك","label_en":"Plastic","color":"#2563eb","accepts":["plastic"]},
    {"id":"paper","label_ar":"ورق وكرتون","label_en":"Paper & cardboard","color":"#16a34a","accepts":["paper"]},
    {"id":"metal","label_ar":"معادن","label_en":"Metals","color":"#ca8a04","accepts":["metal"]},
    {"id":"drop_off","label_ar":"نقطة تسليم خاصة","label_en":"Special drop-off point","color":"#dc2626","accepts":["glass","hazardous"]}
  ]'::jsonb,
  'Plastic: clean bottles and caps only; chips and sweet wrappers are general waste. '
  || 'Paper: clean and dry only; greasy pizza boxes, tissues and coffee cups are general waste. '
  || 'Metal: empty drink and food cans. Glass, batteries and e-waste go to the special drop-off points only.',
  10,
  true
);

insert into public.locations (id, university_id, name, kind, faculty, materials, lat, lng) values
  ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000001', 'Engineering cafeteria bin station', 'bin_station', 'Engineering', '{general,plastic,paper,metal}', 25.1012, 55.1621),
  ('00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000001', 'Engineering labs corridor', 'bin_station', 'Engineering', '{general,plastic,paper}', 25.1016, 55.1626),
  ('00000000-0000-4000-8000-000000000103', '00000000-0000-4000-8000-000000000001', 'Business school lobby', 'bin_station', 'Business', '{general,plastic,paper,metal}', 25.1021, 55.1610),
  ('00000000-0000-4000-8000-000000000104', '00000000-0000-4000-8000-000000000001', 'Medicine building entrance', 'bin_station', 'Medicine', '{general,plastic,paper,metal}', 25.1030, 55.1632),
  ('00000000-0000-4000-8000-000000000105', '00000000-0000-4000-8000-000000000001', 'Arts courtyard', 'bin_station', 'Arts', '{general,plastic,paper,metal}', 25.1008, 55.1602),
  ('00000000-0000-4000-8000-000000000106', '00000000-0000-4000-8000-000000000001', 'Main library', 'bin_station', null, '{general,paper}', 25.1018, 55.1615),
  ('00000000-0000-4000-8000-000000000107', '00000000-0000-4000-8000-000000000001', 'Battery & e-waste drop-off (Student Center)', 'drop_off', null, '{hazardous}', 25.1024, 55.1619),
  ('00000000-0000-4000-8000-000000000108', '00000000-0000-4000-8000-000000000001', 'Glass drop-off (Parking B)', 'drop_off', null, '{glass}', 25.1002, 55.1630);

insert into public.role_invites (university_id, role, code_hash, uses_left) values
  ('00000000-0000-4000-8000-000000000001', 'facilities', encode(extensions.digest('DEMO-FACILITIES', 'sha256'), 'hex'), 50),
  ('00000000-0000-4000-8000-000000000001', 'admin', encode(extensions.digest('DEMO-ADMIN', 'sha256'), 'hex'), 50);

-- Six demo community members.
insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, is_anonymous, created_at, updated_at)
select ('dddddddd-0000-4000-8000-00000000000' || n)::uuid, 'authenticated', 'authenticated',
       'demo' || n || '@ecowaste.demo', '{}'::jsonb, '{}'::jsonb, false, now(), now()
  from generate_series(1, 6) n;

insert into public.profiles (user_id, university_id, role, faculty, display_name) values
  ('dddddddd-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'student', 'Engineering', 'Demo student 1'),
  ('dddddddd-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', 'student', 'Engineering', 'Demo student 2'),
  ('dddddddd-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000001', 'student', 'Business', 'Demo student 3'),
  ('dddddddd-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000001', 'faculty', 'Medicine', 'Demo lecturer'),
  ('dddddddd-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000001', 'staff', 'Arts', 'Demo staff'),
  ('dddddddd-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000001', 'student', 'Arts', 'Demo student 4');

-- 21 days x 6 users = 126 recycling events through the real scoring function.
-- Story for the demo: Engineering keeps throwing chips bags into the plastic bin.
do $$
declare
  items text[][] := array[
    array['Plastic water bottle', 'plastic', 'plastic'],
    array['Soda can', 'metal', 'metal'],
    array['Lecture handouts', 'paper', 'paper'],
    array['Cardboard box', 'paper', 'paper'],
    array['Banana peel', 'organic', 'general'],
    array['Greasy pizza box', 'general', 'paper'],
    array['Juice bottle', 'plastic', 'plastic'],
    array['Coffee cup', 'general', 'paper']
  ];
  stations uuid[] := array[
    '00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000102',
    '00000000-0000-4000-8000-000000000103', '00000000-0000-4000-8000-000000000104',
    '00000000-0000-4000-8000-000000000105', '00000000-0000-4000-8000-000000000105'
  ]::uuid[];
  d int; u int; i int;
  v_item text; v_cat text; v_bin text;
  v_user uuid;
  r jsonb;
begin
  for d in 0..20 loop
    for u in 1..6 loop
      v_user := ('dddddddd-0000-4000-8000-00000000000' || u)::uuid;
      if u <= 2 and (d + u) % 2 = 0 then
        v_item := 'Chips bag'; v_cat := 'general'; v_bin := 'plastic';
      else
        i := ((d * 3 + u * 5) % 8) + 1;
        v_item := items[i][1]; v_cat := items[i][2]; v_bin := items[i][3];
      end if;
      r := public.log_recycling_event(v_user, v_item, v_cat, v_bin, 1 + (d + u) % 3, stations[u], 'photo', md5('demo-' || d || '-' || u));
      update public.recycling_events
         set created_at = now() - make_interval(days => d, hours => (u * 3) % 10)
       where id = (r ->> 'event_id')::uuid;
    end loop;
  end loop;
end $$;

insert into public.bin_reports (university_id, location_id, reporter_id, issue, note, contamination_pct, created_at)
values
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000101', 'dddddddd-0000-4000-8000-000000000001',
   'contaminated', 'Chips bags and food in the plastic bin', 45, now() - interval '2 days'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000103', 'dddddddd-0000-4000-8000-000000000003',
   'full', 'Paper bin overflowing after the exam', null, now() - interval '5 hours');
