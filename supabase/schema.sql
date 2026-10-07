-- Liliana Quiroga Store · base de datos compartida (Supabase / Postgres)
-- Pegar completo en Supabase → SQL Editor → Run. Se puede volver a ejecutar sin perder datos.
-- ANTES de ejecutar: cambia los dos correos de la sección 1 por los de los dueños.

-- 1. Quiénes administran (solo estos correos pueden ver ventas y cambiar el inventario)
create table if not exists admins (email text primary key);
alter table admins enable row level security;
insert into admins (email) values
  ('correo-dueno-1@ejemplo.com'),
  ('correo-dueno-2@ejemplo.com')
on conflict do nothing;

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));
$$;

-- 2. Tablas. Cada fila guarda la prenda o el movimiento completo en "data".
create table if not exists products (
  code text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
create table if not exists sales (
  id uuid primary key default gen_random_uuid(),
  no bigint generated always as identity,
  at timestamptz not null default now(),
  data jsonb not null
);
create table if not exists purchases (
  id uuid primary key default gen_random_uuid(),
  at timestamptz not null default now(),
  data jsonb not null
);
create table if not exists social (
  id uuid primary key default gen_random_uuid(),
  at timestamptz not null default now(),
  data jsonb not null
);

-- 3. Permisos: el catálogo lo ve cualquiera; todo lo demás, solo los administradores.
alter table products enable row level security;
alter table sales enable row level security;
alter table purchases enable row level security;
alter table social enable row level security;

drop policy if exists "catalogo publico" on products;
drop policy if exists "admin catalogo" on products;
drop policy if exists "admin ventas" on sales;
drop policy if exists "admin compras" on purchases;
drop policy if exists "admin redes" on social;
create policy "catalogo publico" on products for select using (true);
create policy "admin catalogo" on products for all to authenticated using (is_admin()) with check (is_admin());
create policy "admin ventas" on sales for all to authenticated using (is_admin()) with check (is_admin());
create policy "admin compras" on purchases for all to authenticated using (is_admin()) with check (is_admin());
create policy "admin redes" on social for all to authenticated using (is_admin()) with check (is_admin());

-- 4. Venta atómica: revisa el stock de todo, descuenta y guarda la venta en un solo paso.
--    Si dos personas venden la última unidad al mismo tiempo, solo una lo logra.
create or replace function sell(items jsonb, meta jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  it jsonb; p jsonb; disc jsonb; lines jsonb := '[]'::jsonb;
  qty int; left_units int; price bigint; total bigint := 0; rec record;
begin
  if not is_admin() then raise exception 'No autorizado'; end if;
  for it in select * from jsonb_array_elements(items) loop
    qty := (it ->> 'qty')::int;
    select data into p from products where code = it ->> 'code' for update;
    if p is null then raise exception 'No existe la referencia %', it ->> 'code'; end if;
    if not (p -> 'stock' ? (it ->> 'size')) then raise exception '% no maneja talla %', it ->> 'code', it ->> 'size'; end if;
    left_units := (p -> 'stock' ->> (it ->> 'size'))::int;
    if qty < 1 or left_units < qty then raise exception '%-%: solo quedan %', it ->> 'code', it ->> 'size', left_units; end if;
    price := (p ->> 'price')::bigint;
    disc := p -> 'discount';
    if jsonb_typeof(disc) = 'object' and (disc ->> 'until' is null or disc ->> 'until' >= to_char(now() at time zone 'America/Bogota', 'YYYY-MM-DD')) then
      price := round(price * (1 - (disc ->> 'pct')::numeric / 100) / 1000) * 1000;
    end if;
    update products set data = jsonb_set(data, array['stock', it ->> 'size'], to_jsonb(left_units - qty)), updated_at = now()
      where code = it ->> 'code';
    lines := lines || jsonb_build_object('code', p ->> 'code', 'name', p ->> 'name', 'brand', p ->> 'brand', 'color', p ->> 'color',
      'cat', p ->> 'cat', 'size', it ->> 'size', 'qty', qty, 'list', (p ->> 'price')::bigint, 'price', price, 'cost', coalesce((p ->> 'cost')::bigint, 0));
    total := total + price * qty;
  end loop;
  insert into sales (data) values (meta || jsonb_build_object('items', lines, 'total', total)) returning id, no, at into rec;
  return meta || jsonb_build_object('id', rec.id, 'no', rec.no, 'at', (extract(epoch from rec.at) * 1000)::bigint, 'items', lines, 'total', total);
end $$;

-- 5. Anular venta: devuelve las unidades y borra la venta.
create or replace function void_sale(sale_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare s jsonb; it jsonb;
begin
  if not is_admin() then raise exception 'No autorizado'; end if;
  select data into s from sales where id = sale_id for update;
  if s is null then return; end if;
  for it in select * from jsonb_array_elements(s -> 'items') loop
    update products set data = jsonb_set(data, array['stock', it ->> 'size'],
        to_jsonb(coalesce((data -> 'stock' ->> (it ->> 'size'))::int, 0) + (it ->> 'qty')::int)), updated_at = now()
      where code = it ->> 'code';
  end loop;
  delete from sales where id = sale_id;
end $$;

-- 6. Entrada de mercancía: suma unidades y registra lo gastado.
create or replace function restock(p_code text, p_size text, p_qty int, p_unit_cost bigint) returns void
language plpgsql security definer set search_path = public as $$
declare p jsonb; cost bigint;
begin
  if not is_admin() then raise exception 'No autorizado'; end if;
  if p_qty < 1 then raise exception 'Cantidad inválida'; end if;
  select data into p from products where code = p_code for update;
  if p is null then raise exception 'No existe la referencia %', p_code; end if;
  cost := case when p_unit_cost > 0 then p_unit_cost else coalesce((p ->> 'cost')::bigint, 0) end;
  update products set data = jsonb_set(jsonb_set(data, array['stock', p_size],
      to_jsonb(coalesce((data -> 'stock' ->> p_size)::int, 0) + p_qty)), '{cost}', to_jsonb(cost)), updated_at = now()
    where code = p_code;
  insert into purchases (data) values (jsonb_build_object('code', p_code, 'name', p ->> 'name', 'color', p ->> 'color',
    'size', p_size, 'qty', p_qty, 'unitCost', cost, 'total', cost * p_qty));
end $$;

revoke execute on function sell(jsonb, jsonb) from public, anon;
revoke execute on function void_sale(uuid) from public, anon;
revoke execute on function restock(text, text, int, bigint) from public, anon;
grant execute on function sell(jsonb, jsonb) to authenticated;
grant execute on function void_sale(uuid) to authenticated;
grant execute on function restock(text, text, int, bigint) to authenticated;

-- 7. Fotos de las prendas: carpeta pública para ver, solo administradores suben o borran.
insert into storage.buckets (id, name, public) values ('prendas', 'prendas', true) on conflict (id) do nothing;
drop policy if exists "admin sube fotos" on storage.objects;
drop policy if exists "admin cambia fotos" on storage.objects;
drop policy if exists "admin borra fotos" on storage.objects;
create policy "admin sube fotos" on storage.objects for insert to authenticated with check (bucket_id = 'prendas' and is_admin());
create policy "admin cambia fotos" on storage.objects for update to authenticated using (bucket_id = 'prendas' and is_admin());
create policy "admin borra fotos" on storage.objects for delete to authenticated using (bucket_id = 'prendas' and is_admin());

-- 8. Cambios en vivo: la tienda y el panel se enteran al instante de cada venta.
do $$
declare t text;
begin
  foreach t in array array['products', 'sales', 'purchases', 'social'] loop
    begin
      execute format('alter publication supabase_realtime add table %I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;
