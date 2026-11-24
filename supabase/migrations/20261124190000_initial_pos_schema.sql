create type public.staff_role as enum ('administrator', 'manager', 'cashier', 'waiter');
create type public.shift_status as enum ('open', 'closed');
create type public.order_status as enum ('new', 'sent', 'preparing', 'ready', 'served', 'paid', 'cancelled');
create type public.payment_method as enum ('cash', 'mobile_money', 'card');
create type public.delivery_status as enum ('pending', 'sent', 'failed');

create sequence public.receipt_number_seq;

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 120),
  administrator_email text not null,
  currency_code text not null default 'RWF' check (currency_code ~ '^[A-Z]{3}$'),
  timezone text not null default 'Africa/Kigali',
  created_at timestamptz not null default now()
);

create table public.branches (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  address text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (business_id, id),
  unique (business_id, name)
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.staff_role not null,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (business_id, branch_id) references public.branches(business_id, id),
  unique nulls not distinct (business_id, user_id, branch_id)
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 80),
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (business_id, id),
  unique (business_id, name)
);

create table public.taxes (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 80),
  rate_percent numeric(6,3) not null check (rate_percent >= 0 and rate_percent <= 100),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (business_id, id),
  unique (business_id, name)
);

create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  category_id uuid not null,
  tax_id uuid,
  name text not null check (length(trim(name)) between 1 and 120),
  description text,
  unit_price numeric(12,2) not null check (unit_price >= 0),
  active boolean not null default true,
  available boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (business_id, category_id) references public.categories(business_id, id),
  foreign key (business_id, tax_id) references public.taxes(business_id, id),
  unique (business_id, id)
);

create table public.shifts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  branch_id uuid not null,
  cashier_id uuid not null references auth.users(id),
  shift_date date not null,
  shift_number integer not null check (shift_number > 0),
  status public.shift_status not null default 'open',
  opening_cash numeric(12,2) not null check (opening_cash >= 0),
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  actual_cash numeric(12,2) check (actual_cash >= 0),
  expected_cash numeric(12,2) check (expected_cash >= 0),
  cash_difference numeric(12,2),
  difference_reason text,
  closed_by uuid references auth.users(id),
  approved_by uuid references auth.users(id),
  foreign key (business_id, branch_id) references public.branches(business_id, id),
  unique (business_id, id),
  unique (business_id, branch_id, id),
  unique (branch_id, cashier_id, shift_date, shift_number)
);

create unique index shifts_one_open_per_cashier
  on public.shifts(branch_id, cashier_id) where status = 'open';

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  branch_id uuid not null,
  created_by uuid not null references auth.users(id),
  shift_id uuid references public.shifts(id),
  receipt_number text unique,
  table_label text not null check (length(trim(table_label)) between 1 and 40),
  guest_name text,
  status public.order_status not null default 'new',
  subtotal numeric(12,2) not null default 0 check (subtotal >= 0),
  discount_total numeric(12,2) not null default 0 check (discount_total >= 0),
  tax_total numeric(12,2) not null default 0 check (tax_total >= 0),
  total numeric(12,2) not null default 0 check (total >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, id),
  unique (business_id, branch_id, id),
  foreign key (business_id, branch_id) references public.branches(business_id, id),
  foreign key (business_id, shift_id) references public.shifts(business_id, id)
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  order_id uuid not null,
  menu_item_id uuid not null references public.menu_items(id),
  item_name text not null,
  category_name text not null,
  quantity integer not null check (quantity > 0 and quantity <= 1000),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  discount_amount numeric(12,2) not null default 0 check (discount_amount >= 0),
  tax_amount numeric(12,2) not null default 0 check (tax_amount >= 0),
  line_total numeric(12,2) generated always as (quantity * unit_price - discount_amount + tax_amount) stored,
  created_at timestamptz not null default now(),
  foreign key (business_id, order_id) references public.orders(business_id, id) on delete cascade,
  check (discount_amount <= quantity * unit_price)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid not null,
  order_id uuid not null,
  shift_id uuid not null,
  cashier_id uuid not null references auth.users(id),
  receipt_number text not null unique,
  method public.payment_method not null,
  amount numeric(12,2) not null check (amount > 0),
  provider_reference text,
  paid_at timestamptz not null default now(),
  refunded_at timestamptz,
  refunded_by uuid references auth.users(id),
  refund_reason text,
  foreign key (business_id, branch_id) references public.branches(business_id, id),
  foreign key (business_id, branch_id, order_id) references public.orders(business_id, branch_id, id),
  foreign key (business_id, branch_id, shift_id) references public.shifts(business_id, branch_id, id)
);

create table public.payouts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid not null,
  shift_id uuid not null,
  recorded_by uuid not null references auth.users(id),
  approved_by uuid references auth.users(id),
  amount numeric(12,2) not null check (amount > 0),
  reason text not null check (length(trim(reason)) between 1 and 80),
  description text not null check (length(trim(description)) between 1 and 500),
  receipt_path text,
  created_at timestamptz not null default now(),
  foreign key (business_id, branch_id) references public.branches(business_id, id),
  foreign key (business_id, branch_id, shift_id) references public.shifts(business_id, branch_id, id)
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.report_delivery_queue (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid not null,
  shift_id uuid not null,
  recipient_email text not null,
  payload jsonb not null,
  status public.delivery_status not null default 'pending',
  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (business_id, branch_id) references public.branches(business_id, id),
  foreign key (business_id, branch_id, shift_id) references public.shifts(business_id, branch_id, id),
  unique (shift_id)
);

create index memberships_user_lookup on public.memberships(user_id, business_id) where active;
create index shifts_branch_date on public.shifts(branch_id, shift_date desc);
create index orders_branch_created on public.orders(branch_id, created_at desc);
create index orders_created_by on public.orders(created_by, created_at desc);
create index payments_branch_paid on public.payments(branch_id, paid_at desc);
create index payouts_branch_created on public.payouts(branch_id, created_at desc);
create index audit_logs_business_created on public.audit_logs(business_id, created_at desc);

create or replace function public.has_business_role(
  p_business_id uuid,
  p_branch_id uuid,
  p_roles public.staff_role[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships m
    where m.user_id = (select auth.uid())
      and m.business_id = p_business_id
      and m.active
      and m.role = any(p_roles)
      and (
        (p_branch_id is null and m.branch_id is null)
        or (p_branch_id is not null and (m.branch_id is null or m.branch_id = p_branch_id))
      )
  );
$$;

create or replace function public.is_business_member(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.user_id = (select auth.uid())
      and m.business_id = p_business_id
      and m.active
  );
$$;

create or replace function public.can_access_branch(p_business_id uuid, p_branch_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.user_id = (select auth.uid())
      and m.business_id = p_business_id
      and m.active
      and (m.branch_id is null or m.branch_id = p_branch_id)
  );
$$;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.email, '')
  )
  on conflict (id) do update
    set email = excluded.email,
        updated_at = now();
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

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
create trigger menu_items_touch_updated_at before update on public.menu_items
  for each row execute function public.touch_updated_at();
create trigger orders_touch_updated_at before update on public.orders
  for each row execute function public.touch_updated_at();
create trigger report_queue_touch_updated_at before update on public.report_delivery_queue
  for each row execute function public.touch_updated_at();

create or replace function public.refresh_order_totals()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_order_id uuid := coalesce(new.order_id, old.order_id);
begin
  update public.orders o
  set subtotal = totals.subtotal,
      discount_total = totals.discount_total,
      tax_total = totals.tax_total,
      total = totals.total
  from (
    select
      coalesce(sum(i.quantity * i.unit_price), 0)::numeric(12,2) as subtotal,
      coalesce(sum(i.discount_amount), 0)::numeric(12,2) as discount_total,
      coalesce(sum(i.tax_amount), 0)::numeric(12,2) as tax_total,
      coalesce(sum(i.line_total), 0)::numeric(12,2) as total
    from public.order_items i
    where i.order_id = target_order_id
  ) totals
  where o.id = target_order_id;
  return coalesce(new, old);
end;
$$;

create trigger order_items_refresh_totals
  after insert or update or delete on public.order_items
  for each row execute function public.refresh_order_totals();

create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  row_data jsonb;
  entity_id uuid;
  business_id uuid;
  branch_id uuid;
begin
  row_data := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  entity_id := nullif(row_data ->> 'id', '')::uuid;
  business_id := nullif(row_data ->> 'business_id', '')::uuid;
  branch_id := nullif(row_data ->> 'branch_id', '')::uuid;
  if business_id is not null then
    insert into public.audit_logs (business_id, branch_id, actor_id, action, entity_type, entity_id, details)
    values (
      business_id,
      branch_id,
      auth.uid(),
      lower(tg_table_name) || '.' || lower(tg_op),
      tg_table_name,
      entity_id,
      case when tg_op = 'DELETE' then jsonb_build_object('deleted', true)
        else jsonb_build_object('name', row_data ->> 'name', 'role', row_data ->> 'role', 'active', row_data ->> 'active')
      end
    );
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger categories_audit_change after insert or update or delete on public.categories
  for each row execute function public.audit_row_change();
create trigger taxes_audit_change after insert or update or delete on public.taxes
  for each row execute function public.audit_row_change();
create trigger menu_items_audit_change after insert or update or delete on public.menu_items
  for each row execute function public.audit_row_change();
create trigger memberships_audit_change after insert or update or delete on public.memberships
  for each row execute function public.audit_row_change();

create or replace function public.open_cashier_shift(p_branch_id uuid, p_opening_cash numeric)
returns public.shifts
language plpgsql
security definer
set search_path = ''
as $$
declare
  branch_business_id uuid;
  local_date date;
  next_shift_number integer;
  opened_shift public.shifts;
begin
  if auth.uid() is null then raise exception 'Sign in before opening a shift'; end if;
  if p_opening_cash is null or p_opening_cash < 0 then raise exception 'Opening cash cannot be negative'; end if;
  select b.business_id into branch_business_id
  from public.branches b where b.id = p_branch_id and b.active;
  if branch_business_id is null then raise exception 'Branch not found or inactive'; end if;
  if not public.has_business_role(branch_business_id, p_branch_id, array['cashier']::public.staff_role[]) then
    raise exception 'Only an assigned cashier can open a shift';
  end if;
  select (now() at time zone b.timezone)::date into local_date
  from public.businesses b where b.id = branch_business_id;
  perform pg_advisory_xact_lock(hashtextextended(p_branch_id::text || auth.uid()::text, 0));
  if exists (select 1 from public.shifts s where s.branch_id = p_branch_id and s.cashier_id = auth.uid() and s.status = 'open') then
    raise exception 'You already have an open shift at this branch';
  end if;
  select coalesce(max(s.shift_number), 0) + 1 into next_shift_number
  from public.shifts s
  where s.branch_id = p_branch_id and s.cashier_id = auth.uid() and s.shift_date = local_date;
  insert into public.shifts (business_id, branch_id, cashier_id, shift_date, shift_number, opening_cash)
  values (branch_business_id, p_branch_id, auth.uid(), local_date, next_shift_number, p_opening_cash)
  returning * into opened_shift;
  insert into public.audit_logs (business_id, branch_id, actor_id, action, entity_type, entity_id, details)
  values (branch_business_id, p_branch_id, auth.uid(), 'shift.opened', 'shift', opened_shift.id,
    jsonb_build_object('shift_number', next_shift_number));
  return opened_shift;
end;
$$;

create or replace function public.create_order(
  p_branch_id uuid,
  p_table_label text,
  p_guest_name text default null
)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  branch_business_id uuid;
  current_shift_id uuid;
  created_order public.orders;
begin
  if auth.uid() is null then raise exception 'Sign in before starting an order'; end if;
  select b.business_id into branch_business_id
  from public.branches b where b.id = p_branch_id and b.active;
  if branch_business_id is null then raise exception 'Branch not found or inactive'; end if;
  if not public.has_business_role(branch_business_id, p_branch_id, array['administrator','manager','cashier','waiter']::public.staff_role[]) then
    raise exception 'You do not have permission to start orders at this branch';
  end if;
  if length(trim(coalesce(p_table_label, ''))) = 0 then raise exception 'Choose a table or takeaway'; end if;
  select s.id into current_shift_id from public.shifts s
  where s.branch_id = p_branch_id and s.cashier_id = auth.uid() and s.status = 'open';
  if public.has_business_role(branch_business_id, p_branch_id, array['cashier']::public.staff_role[]) and current_shift_id is null then
    raise exception 'Start your shift before creating a sale';
  end if;
  insert into public.orders (business_id, branch_id, created_by, shift_id, table_label, guest_name)
  values (branch_business_id, p_branch_id, auth.uid(), current_shift_id, trim(p_table_label), nullif(trim(p_guest_name), ''))
  returning * into created_order;
  insert into public.audit_logs (business_id, branch_id, actor_id, action, entity_type, entity_id, details)
  values (branch_business_id, p_branch_id, auth.uid(), 'order.created', 'order', created_order.id,
    jsonb_build_object('table_label', created_order.table_label));
  return created_order;
end;
$$;

create or replace function public.read_order_board(p_branch_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  branch_business_id uuid;
  caller_is_manager boolean;
  caller_is_cashier boolean;
  result jsonb;
begin
  select b.business_id into branch_business_id
  from public.branches b where b.id = p_branch_id and b.active;
  if branch_business_id is null or not public.can_access_branch(branch_business_id, p_branch_id) then
    raise exception 'You do not have access to this branch';
  end if;
  caller_is_manager := public.has_business_role(branch_business_id, p_branch_id, array['administrator','manager']::public.staff_role[]);
  caller_is_cashier := public.has_business_role(branch_business_id, p_branch_id, array['cashier']::public.staff_role[]);
  select coalesce(jsonb_agg(
    case
      when caller_is_manager then jsonb_build_object(
        'id', o.id, 'table_label', o.table_label, 'guest_name', o.guest_name,
        'status', o.status, 'subtotal', o.subtotal, 'discount_total', o.discount_total,
        'tax_total', o.tax_total, 'total', o.total, 'receipt_number', o.receipt_number,
        'created_by', o.created_by, 'created_at', o.created_at, 'updated_at', o.updated_at,
        'items', coalesce(items.rows, '[]'::jsonb)
      )
      when caller_is_cashier and (o.status not in ('paid', 'cancelled') or o.created_by = auth.uid()) then jsonb_build_object(
        'id', o.id, 'table_label', o.table_label, 'guest_name', o.guest_name,
        'status', o.status, 'total', o.total, 'receipt_number', o.receipt_number,
        'created_at', o.created_at, 'items', coalesce(items.rows, '[]'::jsonb)
      )
      else jsonb_build_object(
        'id', o.id, 'table_label', o.table_label, 'guest_name', o.guest_name,
        'status', o.status, 'created_at', o.created_at, 'updated_at', o.updated_at,
        'items', coalesce(items.waiter_rows, '[]'::jsonb)
      )
    end order by o.created_at desc
  ), '[]'::jsonb) into result
  from public.orders o
  left join lateral (
    select
      jsonb_agg(jsonb_build_object(
        'id', i.id, 'menu_item_id', i.menu_item_id, 'item_name', i.item_name,
        'quantity', i.quantity, 'unit_price', i.unit_price,
        'discount_amount', i.discount_amount, 'tax_amount', i.tax_amount, 'line_total', i.line_total
      ) order by i.created_at) as rows,
      jsonb_agg(jsonb_build_object(
        'id', i.id, 'menu_item_id', i.menu_item_id, 'item_name', i.item_name, 'quantity', i.quantity
      ) order by i.created_at) as waiter_rows
    from public.order_items i where i.order_id = o.id
  ) items on true
  where o.branch_id = p_branch_id
    and (
      caller_is_manager
      or (caller_is_cashier and (o.status not in ('paid', 'cancelled') or o.created_by = auth.uid()))
      or (not caller_is_manager and not caller_is_cashier and o.created_by = auth.uid()
        and public.has_business_role(branch_business_id, p_branch_id, array['waiter']::public.staff_role[]))
    );
  return result;
end;
$$;

create or replace function public.read_my_open_shift(p_branch_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  branch_business_id uuid;
  result jsonb;
begin
  select b.business_id into branch_business_id from public.branches b
  where b.id = p_branch_id and b.active;
  if branch_business_id is null
    or not public.has_business_role(branch_business_id, p_branch_id, array['cashier']::public.staff_role[]) then
    raise exception 'Only an assigned cashier can check their shift';
  end if;
  select jsonb_build_object(
    'id', s.id,
    'shift_number', s.shift_number,
    'shift_date', s.shift_date,
    'status', s.status,
    'opened_at', s.opened_at
  ) into result
  from public.shifts s
  where s.branch_id = p_branch_id and s.cashier_id = auth.uid() and s.status = 'open'
  order by s.opened_at desc limit 1;
  return result;
end;
$$;

create or replace function public.add_menu_item_to_order(
  p_order_id uuid,
  p_menu_item_id uuid,
  p_quantity integer,
  p_discount_amount numeric default 0
)
returns public.order_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_order public.orders;
  target_item public.menu_items;
  item_category text;
  item_tax_rate numeric(6,3) := 0;
  calculated_tax numeric(12,2);
  added_item public.order_items;
begin
  select * into target_order from public.orders o where o.id = p_order_id for update;
  if target_order.id is null then raise exception 'Order not found'; end if;
  if target_order.status in ('paid', 'cancelled') then raise exception 'This order can no longer be changed'; end if;
  if not (
    public.has_business_role(target_order.business_id, target_order.branch_id, array['administrator','manager']::public.staff_role[])
    or (target_order.created_by = auth.uid()
      and public.has_business_role(target_order.business_id, target_order.branch_id, array['cashier','waiter']::public.staff_role[]))
  ) then raise exception 'You can only edit orders you are allowed to manage'; end if;
  if p_quantity is null or p_quantity < 1 or p_quantity > 1000 then raise exception 'Enter a valid quantity'; end if;
  select * into target_item from public.menu_items i
  where i.id = p_menu_item_id and i.business_id = target_order.business_id and i.active and i.available;
  if target_item.id is null then raise exception 'Menu item is unavailable'; end if;
  select c.name into item_category from public.categories c
  where c.id = target_item.category_id and c.business_id = target_order.business_id;
  if coalesce(p_discount_amount, 0) < 0
     or coalesce(p_discount_amount, 0) > target_item.unit_price * p_quantity then
    raise exception 'Check the discount amount';
  end if;
  if coalesce(p_discount_amount, 0) > 0
    and not public.has_business_role(target_order.business_id, target_order.branch_id, array['administrator','manager']::public.staff_role[]) then
    raise exception 'A manager or administrator must approve a discount';
  end if;
  if target_item.tax_id is not null then
    select t.rate_percent into item_tax_rate from public.taxes t
    where t.id = target_item.tax_id and t.business_id = target_order.business_id and t.active;
    if item_tax_rate is null then raise exception 'The tax rate for this item is not available'; end if;
  end if;
  calculated_tax := round((target_item.unit_price * p_quantity - coalesce(p_discount_amount, 0)) * item_tax_rate / 100, 2);
  insert into public.order_items (business_id, order_id, menu_item_id, item_name, category_name, quantity, unit_price, discount_amount, tax_amount)
  values (target_order.business_id, target_order.id, target_item.id, target_item.name, item_category, p_quantity,
    target_item.unit_price, coalesce(p_discount_amount, 0), calculated_tax)
  returning * into added_item;
  return added_item;
end;
$$;

create or replace function public.update_order_status(p_order_id uuid, p_status public.order_status)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_order public.orders;
begin
  select * into target_order from public.orders o where o.id = p_order_id for update;
  if target_order.id is null then raise exception 'Order not found'; end if;
  if target_order.status in ('paid', 'cancelled') then raise exception 'This order is already complete'; end if;
  if p_status not in ('sent', 'preparing', 'ready', 'served', 'cancelled') then raise exception 'Invalid order status'; end if;
  if not (
    public.has_business_role(target_order.business_id, target_order.branch_id, array['administrator','manager']::public.staff_role[])
    or (target_order.created_by = auth.uid()
      and public.has_business_role(target_order.business_id, target_order.branch_id, array['cashier','waiter']::public.staff_role[]))
  ) then raise exception 'You cannot update this order'; end if;
  update public.orders set status = p_status where id = target_order.id returning * into target_order;
  insert into public.audit_logs (business_id, branch_id, actor_id, action, entity_type, entity_id, details)
  values (target_order.business_id, target_order.branch_id, auth.uid(), 'order.status_changed', 'order', target_order.id,
    jsonb_build_object('status', p_status));
  return jsonb_build_object(
    'id', target_order.id,
    'table_label', target_order.table_label,
    'status', target_order.status,
    'updated_at', target_order.updated_at
  );
end;
$$;

create or replace function public.record_order_payment(
  p_order_id uuid,
  p_method public.payment_method,
  p_amount numeric
)
returns public.payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_order public.orders;
  target_shift public.shifts;
  receipt text;
  created_payment public.payments;
begin
  if p_method <> 'cash' then
    raise exception 'Card and mobile payments must be confirmed by a payment provider before they can be recorded';
  end if;
  if not public.has_business_role(
    (select o.business_id from public.orders o where o.id = p_order_id),
    (select o.branch_id from public.orders o where o.id = p_order_id),
    array['administrator','manager','cashier']::public.staff_role[]
  ) then raise exception 'Only a cashier, manager, or administrator can take payment'; end if;
  select * into target_order from public.orders o where o.id = p_order_id for update;
  if target_order.id is null then raise exception 'Order not found'; end if;
  if target_order.status in ('paid', 'cancelled') then raise exception 'This order has already been completed'; end if;
  if target_order.total <= 0 or p_amount is null or p_amount <> target_order.total then
    raise exception 'Payment amount must match the order total';
  end if;
  select * into target_shift from public.shifts s
  where s.branch_id = target_order.branch_id and s.cashier_id = auth.uid() and s.status = 'open'
  order by s.opened_at desc limit 1 for update;
  if target_shift.id is null and not public.has_business_role(target_order.business_id, target_order.branch_id, array['administrator','manager']::public.staff_role[]) then
    raise exception 'Open your shift before taking payment';
  end if;
  if target_shift.id is null then
    select * into target_shift from public.shifts s where s.id = target_order.shift_id and s.status = 'open' for update;
  end if;
  if target_shift.id is null then raise exception 'There is no open shift for this payment'; end if;
  receipt := 'R-' || to_char(now() at time zone 'UTC', 'YYYYMMDD') || '-' || lpad(nextval('public.receipt_number_seq')::text, 8, '0');
  insert into public.payments (business_id, branch_id, order_id, shift_id, cashier_id, receipt_number, method, amount)
  values (target_order.business_id, target_order.branch_id, target_order.id, target_shift.id, auth.uid(), receipt, p_method, p_amount)
  returning * into created_payment;
  update public.orders set status = 'paid', receipt_number = receipt, shift_id = target_shift.id where id = target_order.id;
  insert into public.audit_logs (business_id, branch_id, actor_id, action, entity_type, entity_id, details)
  values (target_order.business_id, target_order.branch_id, auth.uid(), 'payment.recorded', 'payment', created_payment.id,
    jsonb_build_object('method', p_method, 'amount', p_amount, 'receipt_number', receipt));
  return created_payment;
end;
$$;

create or replace function public.record_cash_payout(
  p_shift_id uuid,
  p_amount numeric,
  p_reason text,
  p_description text,
  p_receipt_path text default null
)
returns public.payouts
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_shift public.shifts;
  created_payout public.payouts;
begin
  select * into target_shift from public.shifts s where s.id = p_shift_id for update;
  if target_shift.id is null or target_shift.status <> 'open' then raise exception 'Open shift not found'; end if;
  if not (
    target_shift.cashier_id = auth.uid()
      and public.has_business_role(target_shift.business_id, target_shift.branch_id, array['cashier']::public.staff_role[])
    or public.has_business_role(target_shift.business_id, target_shift.branch_id, array['administrator','manager']::public.staff_role[])
  ) then raise exception 'You cannot record a payout for this shift'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Payout amount must be greater than zero'; end if;
  if length(trim(coalesce(p_reason, ''))) = 0 or length(trim(coalesce(p_description, ''))) = 0 then
    raise exception 'Add a reason and a short description';
  end if;
  insert into public.payouts (business_id, branch_id, shift_id, recorded_by, approved_by, amount, reason, description, receipt_path)
  values (
    target_shift.business_id, target_shift.branch_id, target_shift.id, auth.uid(),
    case when public.has_business_role(target_shift.business_id, target_shift.branch_id, array['administrator','manager']::public.staff_role[]) then auth.uid() else null end,
    p_amount, trim(p_reason), trim(p_description), p_receipt_path
  ) returning * into created_payout;
  insert into public.audit_logs (business_id, branch_id, actor_id, action, entity_type, entity_id, details)
  values (target_shift.business_id, target_shift.branch_id, auth.uid(), 'payout.recorded', 'payout', created_payout.id,
    jsonb_build_object('amount', p_amount, 'reason', p_reason));
  return created_payout;
end;
$$;

create or replace function public.close_cashier_shift(
  p_shift_id uuid,
  p_actual_cash numeric,
  p_difference_reason text default null
)
returns public.shifts
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_shift public.shifts;
  cash_sales numeric(12,2);
  mobile_sales numeric(12,2);
  card_sales numeric(12,2);
  total_sales numeric(12,2);
  payout_total numeric(12,2);
  category_summary jsonb;
  calculated_expected numeric(12,2);
  difference numeric(12,2);
  manager_approval boolean;
begin
  select * into target_shift from public.shifts s where s.id = p_shift_id for update;
  if target_shift.id is null or target_shift.status <> 'open' then raise exception 'Open shift not found'; end if;
  manager_approval := public.has_business_role(target_shift.business_id, target_shift.branch_id, array['administrator','manager']::public.staff_role[]);
  if not (target_shift.cashier_id = auth.uid() and public.has_business_role(target_shift.business_id, target_shift.branch_id, array['cashier']::public.staff_role[]))
     and not manager_approval then
    raise exception 'You cannot close this shift';
  end if;
  if p_actual_cash is null or p_actual_cash < 0 then raise exception 'Enter the cash count'; end if;
  select
    coalesce(sum(p.amount) filter (where p.method = 'cash'), 0),
    coalesce(sum(p.amount) filter (where p.method = 'mobile_money'), 0),
    coalesce(sum(p.amount) filter (where p.method = 'card'), 0),
    coalesce(sum(p.amount), 0)
  into cash_sales, mobile_sales, card_sales, total_sales
  from public.payments p where p.shift_id = target_shift.id and p.refunded_at is null;
  select coalesce(sum(o.amount), 0) into payout_total
  from public.payouts o where o.shift_id = target_shift.id;
  select coalesce(jsonb_agg(
    jsonb_build_object('category', sales.category_name, 'quantity', sales.quantity, 'subtotal', sales.subtotal)
    order by sales.category_name
  ), '[]'::jsonb) into category_summary
  from (
    select i.category_name, sum(i.quantity)::integer as quantity, sum(i.line_total)::numeric(12,2) as subtotal
    from public.order_items i
    join public.orders o on o.id = i.order_id
    where o.shift_id = target_shift.id and o.status = 'paid'
    group by i.category_name
  ) sales;
  calculated_expected := target_shift.opening_cash + cash_sales - payout_total;
  difference := p_actual_cash - calculated_expected;
  if difference <> 0 and not manager_approval then
    raise exception 'Cash difference detected. Ask a manager or administrator to sign in and approve this closing.';
  end if;
  if difference <> 0 and length(trim(coalesce(p_difference_reason, ''))) = 0 then
    raise exception 'Add a reason for the cash difference';
  end if;
  update public.shifts
  set status = 'closed',
      closed_at = now(),
      actual_cash = p_actual_cash,
      expected_cash = calculated_expected,
      cash_difference = difference,
      difference_reason = nullif(trim(p_difference_reason), ''),
      closed_by = auth.uid(),
      approved_by = case when difference <> 0 then auth.uid() else null end
  where id = target_shift.id returning * into target_shift;
  insert into public.audit_logs (business_id, branch_id, actor_id, action, entity_type, entity_id, details)
  values (target_shift.business_id, target_shift.branch_id, auth.uid(), 'shift.closed', 'shift', target_shift.id,
    jsonb_build_object(
      'expected_cash', calculated_expected,
      'actual_cash', p_actual_cash,
      'cash_difference', difference,
      'approved_by', target_shift.approved_by
    ));
  insert into public.report_delivery_queue (business_id, branch_id, shift_id, recipient_email, payload)
  select target_shift.business_id, target_shift.branch_id, target_shift.id, b.administrator_email,
    jsonb_build_object(
      'business_name', b.name,
      'branch_name', br.name,
      'shift_date', target_shift.shift_date,
      'shift_number', target_shift.shift_number,
      'cashier_id', target_shift.cashier_id,
      'closed_at', target_shift.closed_at,
      'opening_cash', target_shift.opening_cash,
      'total_sales', total_sales,
      'cash_sales', cash_sales,
      'mobile_money_sales', mobile_sales,
      'card_sales', card_sales,
      'sales_by_category', category_summary,
      'payouts', payout_total,
      'expected_cash', calculated_expected,
      'actual_cash', p_actual_cash,
      'cash_difference', difference,
      'approved_by', target_shift.approved_by
    )
  from public.businesses b
  join public.branches br on br.id = target_shift.branch_id
  where b.id = target_shift.business_id;
  return target_shift;
end;
$$;

alter table public.businesses enable row level security;
alter table public.branches enable row level security;
alter table public.profiles enable row level security;
alter table public.memberships enable row level security;
alter table public.categories enable row level security;
alter table public.taxes enable row level security;
alter table public.menu_items enable row level security;
alter table public.shifts enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.payouts enable row level security;
alter table public.audit_logs enable row level security;
alter table public.report_delivery_queue enable row level security;

create policy "Business members can read their business" on public.businesses
  for select to authenticated using (public.is_business_member(id));
create policy "Staff can read assigned branches" on public.branches
  for select to authenticated using (public.can_access_branch(business_id, id));
create policy "Users and managers can read staff profiles" on public.profiles
  for select to authenticated using (
    id = (select auth.uid())
    or exists (
      select 1 from public.memberships target
      where target.user_id = profiles.id
        and target.active
        and public.has_business_role(target.business_id, target.branch_id, array['administrator','manager']::public.staff_role[])
    )
  );
create policy "Users can update their own profile" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy "Users and managers can read memberships" on public.memberships
  for select to authenticated using (
    user_id = (select auth.uid())
    or public.has_business_role(business_id, branch_id, array['administrator','manager']::public.staff_role[])
  );
create policy "Administrators can manage memberships" on public.memberships
  for all to authenticated
  using (public.has_business_role(business_id, branch_id, array['administrator']::public.staff_role[]))
  with check (public.has_business_role(business_id, branch_id, array['administrator']::public.staff_role[]));
create policy "Staff can read active categories" on public.categories
  for select to authenticated using (public.is_business_member(business_id));
create policy "Administrators can manage categories" on public.categories
  for all to authenticated
  using (public.has_business_role(business_id, null, array['administrator']::public.staff_role[]))
  with check (public.has_business_role(business_id, null, array['administrator']::public.staff_role[]));
create policy "Staff can read active taxes" on public.taxes
  for select to authenticated using (public.is_business_member(business_id));
create policy "Administrators can manage taxes" on public.taxes
  for all to authenticated
  using (public.has_business_role(business_id, null, array['administrator']::public.staff_role[]))
  with check (public.has_business_role(business_id, null, array['administrator']::public.staff_role[]));
create policy "Staff can read active menu" on public.menu_items
  for select to authenticated using (public.is_business_member(business_id));
create policy "Administrators can manage menu" on public.menu_items
  for all to authenticated
  using (public.has_business_role(business_id, null, array['administrator']::public.staff_role[]))
  with check (public.has_business_role(business_id, null, array['administrator']::public.staff_role[]));
create policy "Cashiers see their shifts; managers see branch shifts" on public.shifts
  for select to authenticated
  using (
    public.has_business_role(business_id, branch_id, array['administrator','manager']::public.staff_role[])
  );
create policy "Managers can read branch orders" on public.orders
  for select to authenticated
  using (public.has_business_role(business_id, branch_id, array['administrator','manager']::public.staff_role[]));
create policy "Managers can read order items" on public.order_items
  for select to authenticated
  using (public.has_business_role(business_id, null, array['administrator','manager']::public.staff_role[]));
create policy "Cashiers and managers can read payment records" on public.payments
  for select to authenticated
  using (
    (cashier_id = (select auth.uid()) and public.has_business_role(business_id, branch_id, array['cashier']::public.staff_role[]))
    or public.has_business_role(business_id, branch_id, array['administrator','manager']::public.staff_role[])
  );
create policy "Managers can read branch payouts" on public.payouts
  for select to authenticated
  using (public.has_business_role(business_id, branch_id, array['administrator','manager']::public.staff_role[]));
create policy "Managers can read business audit logs" on public.audit_logs
  for select to authenticated
  using (public.has_business_role(business_id, branch_id, array['administrator','manager']::public.staff_role[]));
create policy "Managers can read report delivery status" on public.report_delivery_queue
  for select to authenticated
  using (public.has_business_role(business_id, branch_id, array['administrator','manager']::public.staff_role[]));

revoke all on public.businesses, public.branches, public.profiles, public.memberships,
  public.categories, public.taxes, public.menu_items, public.shifts, public.orders, public.order_items,
  public.payments, public.payouts, public.audit_logs, public.report_delivery_queue
  from anon, authenticated;
grant select (id, name, currency_code, timezone, created_at) on public.businesses to authenticated;
grant select on public.branches, public.profiles, public.memberships,
  public.categories, public.taxes, public.menu_items, public.shifts, public.payments,
  public.payouts, public.audit_logs, public.report_delivery_queue to authenticated;
grant insert, update, delete on public.categories, public.taxes, public.menu_items to authenticated;
grant update (full_name) on public.profiles to authenticated;

revoke all on function public.has_business_role(uuid, uuid, public.staff_role[]) from public, anon;
revoke all on function public.is_business_member(uuid) from public, anon;
revoke all on function public.can_access_branch(uuid, uuid) from public, anon;
revoke all on function public.open_cashier_shift(uuid, numeric) from public, anon, authenticated;
revoke all on function public.create_order(uuid, text, text) from public, anon, authenticated;
revoke all on function public.read_order_board(uuid) from public, anon, authenticated;
revoke all on function public.read_my_open_shift(uuid) from public, anon, authenticated;
revoke all on function public.add_menu_item_to_order(uuid, uuid, integer, numeric) from public, anon, authenticated;
revoke all on function public.update_order_status(uuid, public.order_status) from public, anon, authenticated;
revoke all on function public.record_order_payment(uuid, public.payment_method, numeric) from public, anon, authenticated;
revoke all on function public.record_cash_payout(uuid, numeric, text, text, text) from public, anon, authenticated;
revoke all on function public.close_cashier_shift(uuid, numeric, text) from public, anon, authenticated;
grant execute on function public.has_business_role(uuid, uuid, public.staff_role[]) to authenticated;
grant execute on function public.is_business_member(uuid) to authenticated;
grant execute on function public.can_access_branch(uuid, uuid) to authenticated;
grant execute on function public.open_cashier_shift(uuid, numeric) to authenticated;
grant execute on function public.create_order(uuid, text, text) to authenticated;
grant execute on function public.read_order_board(uuid) to authenticated;
grant execute on function public.read_my_open_shift(uuid) to authenticated;
grant execute on function public.add_menu_item_to_order(uuid, uuid, integer, numeric) to authenticated;
grant execute on function public.update_order_status(uuid, public.order_status) to authenticated;
grant execute on function public.record_order_payment(uuid, public.payment_method, numeric) to authenticated;
grant execute on function public.record_cash_payout(uuid, numeric, text, text, text) to authenticated;
grant execute on function public.close_cashier_shift(uuid, numeric, text) to authenticated;

revoke all on sequence public.receipt_number_seq from public, anon, authenticated;
