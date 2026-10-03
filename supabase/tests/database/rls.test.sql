begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(6);

insert into public.organizations (id, name, kind) values
  ('10000000-0000-4000-8000-000000000001', 'RLS test clinic', 'clinic'),
  ('10000000-0000-4000-8000-000000000002', 'RLS other clinic', 'clinic');

insert into public.memberships (org_id, user_id, role, is_active) values
  ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'doctor', true),
  ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', 'doctor', true),
  ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000003', 'staff', true),
  ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000004', 'doctor', false),
  ('10000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', 'doctor', true);

insert into public.items (id, org_id, recipient_user_id, file_name, storage_path, size_bytes, mime_type) values
  ('30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'doctor-a.pdf', 'org/a/one', 1, 'application/pdf'),
  ('30000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', 'doctor-b.pdf', 'org/b/two', 1, 'application/pdf'),
  ('30000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', null, 'clinic.pdf', 'org/clinic/three', 1, 'application/pdf'),
  ('30000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', 'other-clinic.pdf', 'other/b/four', 1, 'application/pdf');

select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"20000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;

select extensions.is(
  (select count(*)::int from public.items where id = '30000000-0000-4000-8000-000000000001'),
  1,
  'a doctor can read their own item'
);
select extensions.is(
  (select count(*)::int from public.items where id = '30000000-0000-4000-8000-000000000002'),
  0,
  'a doctor cannot read a colleague item'
);
select extensions.is(
  (select count(*)::int from public.items where id = '30000000-0000-4000-8000-000000000004'),
  0,
  'a doctor cannot read another clinic item'
);

select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000003', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"20000000-0000-4000-8000-000000000003","role":"authenticated"}',
  true
);
select extensions.is(
  (select count(*)::int from public.items where recipient_user_id is null),
  1,
  'staff can read the clinic inbox'
);
select extensions.is(
  (select count(*)::int from public.items where recipient_user_id = '20000000-0000-4000-8000-000000000002'),
  0,
  'staff cannot read doctor-private items'
);

select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000004', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"20000000-0000-4000-8000-000000000004","role":"authenticated"}',
  true
);
select extensions.is(
  (select count(*)::int from public.items),
  0,
  'inactive memberships grant no item access'
);

reset role;
select * from extensions.finish();
rollback;