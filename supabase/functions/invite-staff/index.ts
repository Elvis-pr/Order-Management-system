import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = (origin: string) => ({
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
});

Deno.serve(async (request) => {
  const allowedOrigin = Deno.env.get("APP_ORIGIN");
  const origin = request.headers.get("Origin");
  if (!allowedOrigin || !origin || origin !== allowedOrigin) {
    return new Response(JSON.stringify({ error: "Origin is not allowed" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }
  const headers = { ...corsHeaders(allowedOrigin), "Content-Type": "application/json" };
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });

  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return new Response(JSON.stringify({ error: "Sign in to invite staff" }), { status: 401, headers });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceRoleKey) throw new Error("Supabase function secrets are not configured");

    const accessToken = authorization.slice("Bearer ".length);
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser(accessToken);
    if (authError || !user) return new Response(JSON.stringify({ error: "Your session is invalid or expired" }), { status: 401, headers });

    const body = await request.json() as {
      businessId?: string;
      branchId?: string | null;
      email?: string;
      fullName?: string;
      role?: string;
    };
    const businessId = body.businessId?.trim();
    const branchId = body.branchId?.trim() || null;
    const email = body.email?.trim().toLowerCase();
    const fullName = body.fullName?.trim();
    const role = body.role;
    if (!businessId || !email || !fullName || !["administrator", "manager", "cashier", "waiter"].includes(role ?? "")) {
      return new Response(JSON.stringify({ error: "Provide a restaurant, name, email, and valid role" }), { status: 400, headers });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: inviter, error: inviterError } = await adminClient
      .from("memberships")
      .select("id")
      .eq("business_id", businessId)
      .eq("user_id", user.id)
      .eq("role", "administrator")
      .eq("active", true)
      .is("branch_id", null)
      .maybeSingle();
    if (inviterError) throw inviterError;
    if (!inviter) return new Response(JSON.stringify({ error: "Only a business administrator can invite staff" }), { status: 403, headers });

    if (branchId) {
      const { data: branch, error: branchError } = await adminClient
        .from("branches")
        .select("id")
        .eq("id", branchId)
        .eq("business_id", businessId)
        .eq("active", true)
        .maybeSingle();
      if (branchError) throw branchError;
      if (!branch) return new Response(JSON.stringify({ error: "Choose an active branch in this restaurant" }), { status: 400, headers });
    }

    const { data: invitation, error: invitationError } = await adminClient.auth.admin.inviteUserByEmail(email, {
      data: { full_name: fullName },
    });
    if (invitationError) {
      const status = invitationError.status === 422 ? 409 : 400;
      return new Response(JSON.stringify({ error: invitationError.message }), { status, headers });
    }
    if (!invitation.user) throw new Error("Supabase did not return the invited user");

    const { error: membershipError } = await adminClient.from("memberships").insert({
      business_id: businessId,
      branch_id: branchId,
      user_id: invitation.user.id,
      role,
      created_by: user.id,
    });
    if (membershipError) {
      const { error: cleanupError } = await adminClient.auth.admin.deleteUser(invitation.user.id);
      if (cleanupError) console.error("Could not remove user after failed membership creation", cleanupError);
      throw membershipError;
    }

    const { error: auditError } = await adminClient.from("audit_logs").insert({
      business_id: businessId,
      branch_id: branchId,
      actor_id: user.id,
      action: "staff.invited",
      entity_type: "membership",
      details: { email, role, branch_id: branchId },
    });
    if (auditError) {
      console.error("Staff invite succeeded but its invitation audit event could not be saved", auditError);
      return new Response(JSON.stringify({
        invited: true,
        warning: "The invitation was sent, but its audit event could not be saved. Notify your system administrator.",
      }), { status: 201, headers });
    }
    return new Response(JSON.stringify({ invited: true }), { status: 201, headers });
  } catch (error) {
    console.error("invite-staff failed", error);
    return new Response(JSON.stringify({ error: "Could not invite staff. Try again or contact your administrator." }), { status: 500, headers });
  }
});
