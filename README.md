# Serviceflow

Serviceflow is a restaurant and bar POS starter built with React, TypeScript, and Supabase. It is designed for multiple restaurant businesses and branches, with Administrator, Manager, Cashier, and Waiter access.

## Run the UI demo

```bash
npm install
npm run dev
```

Without Supabase environment settings, the app opens in **DEMO DATA · NOT CONNECTED** mode. Demo figures are not business records and the role switcher is only a preview tool.

## Supabase setup

Create a Supabase project, then copy `.env.example` to `.env.local`. In the Supabase Dashboard, find the project URL and publishable key under **Project Settings → API** and put them in `.env.local`:

```dotenv
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-publishable-key
```

The publishable key (or legacy anon key) is intended for browser use; Row Level Security and RPC permissions protect the data. Never put a Supabase secret/service-role key in a `VITE_` variable or browser code. `.env.local` is ignored by Git. Restart the Vite server after changing it.

Use Node.js and the [Supabase CLI](https://supabase.com/docs/guides/cli) through `npx` to link this checkout to the project and apply the database migration:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

The migration creates businesses, branches, profiles, staff memberships, menu categories/items, orders, shifts, payments, payouts, audit events, and a closing-report delivery queue. It also installs Row Level Security and database workflows for opening a cashier shift, starting/editing orders, recording cash payments and payouts, and closing a shift. `db push` may ask you to confirm before applying the migration.

For local development against Supabase's local stack, start Docker and run `npx supabase start`. Use the local API URL and anon key printed by the CLI in `.env.local`; apply/reset local migrations with `npx supabase db reset`.

### Create the first Administrator

Public sign-up is disabled. Create the first account from the Supabase Dashboard under **Authentication → Users**, then run this once in the project’s **SQL Editor**, replacing the example values:

```sql
do $$
declare
  first_admin_id uuid;
  new_business_id uuid;
  new_branch_id uuid;
begin
  select id into first_admin_id
  from auth.users
  where email = lower('owner@example.com');

  if first_admin_id is null then
    raise exception 'Create the first Administrator account in Supabase Auth first';
  end if;

  insert into public.businesses (name, administrator_email)
  values ('The Juniper Room', lower('owner@example.com'))
  returning id into new_business_id;

  insert into public.branches (business_id, name)
  values (new_business_id, 'Main branch')
  returning id into new_branch_id;

  insert into public.memberships (business_id, user_id, role, created_by)
  values (new_business_id, first_admin_id, 'administrator', first_admin_id);
end;
$$;
```

### Invite staff

Deploy the Administrator-only invitation function and set the exact public origin of the app:

```bash
npx supabase functions deploy invite-staff
npx supabase secrets set APP_ORIGIN=https://your-app.example.com
```

The function validates the signed-in user and Administrator membership before sending a Supabase Auth email invitation and assigning a role/branch. Staff accounts cannot self-register. For local development, set `APP_ORIGIN=http://localhost:5173`.

## Current backend boundary

When Supabase is configured, the app uses Supabase Auth and shows only the signed-in user's permitted restaurant memberships. The live workspace reads branch menu items and the role-filtered order board, and uses database RPCs to open cashier shifts, create orders, add items, change order status, and record cash payments. It does not show demo sales as live records. The broader demo dashboard, analytics, staff management, and reporting screens are not yet connected to production data.

Database workflows enforce tenant and role checks. Waiter order-board reads omit prices and totals; cashiers can read their own payment records and do not receive shift balances or payout history through the direct database API. Cash differences require a Manager/Administrator to sign in and close the shift. Do not share a cashier session for approval.

Card/mobile payment-provider confirmation, actual refund execution, receipt printing, closing-report PDFs, and the worker that retries report emails are not implemented yet. Until a trusted payment-provider integration is connected, the payment RPC accepts cash only. The report queue is an outbox foundation, not a delivered email service.

## Production checklist

- Connect the remaining dashboard, menu management, staff management, and reporting screens to role-checked Supabase APIs before enabling them for live service.
- Configure and verify Supabase Auth email templates, SMTP, redirect URLs, and password recovery.
- Add payment-provider integrations and confirm webhooks server-side before recording card/mobile payments or refunds.
- Generate and store PDFs, process `report_delivery_queue` in a trusted retrying worker, and audit delivery attempts.
- Test RLS with users in separate businesses and branches, plus each of the four roles.
- Add backups, monitoring, retention policies, and production deployment configuration.
