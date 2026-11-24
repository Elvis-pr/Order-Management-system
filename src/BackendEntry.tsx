import { useEffect, useState, type FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { ArrowRight, LoaderCircle, LogOut, RefreshCw, ShieldCheck, Utensils } from "lucide-react";
import { hasSupabaseConfig, isSupabaseConfigured, supabase } from "./lib/supabase";

type Membership = {
  id: string;
  business_id: string;
  role: "administrator" | "manager" | "cashier" | "waiter";
  branch_id: string | null;
  businesses: { name: string } | { name: string }[] | null;
  branches: { name: string } | { name: string }[] | null;
};

type Branch = { id: string; name: string; business_id: string };
type MenuItem = { id: string; name: string; description: string | null; unit_price: number };
type OrderItem = { id: string; menu_item_id: string; item_name: string; quantity: number; unit_price?: number; line_total?: number };
type LiveOrder = {
  id: string;
  table_label: string;
  guest_name: string | null;
  status: string;
  total?: number;
  created_at: string;
  items: OrderItem[];
};
type OpenShift = { id: string; shift_number: number; shift_date: string; status: string; opened_at: string } | null;

const roleName = (role: Membership["role"]) => role.charAt(0).toUpperCase() + role.slice(1);
const relatedName = (record: { name: string } | { name: string }[] | null) =>
  Array.isArray(record) ? record[0]?.name : record?.name;

export default function BackendEntry() {
  const [session, setSession] = useState<Session | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [selectedMembershipId, setSelectedMembershipId] = useState("");
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [orders, setOrders] = useState<LiveOrder[]>([]);
  const [openShift, setOpenShift] = useState<OpenShift>(null);
  const [tableLabel, setTableLabel] = useState("");
  const [guestName, setGuestName] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [selectedMenuItemId, setSelectedMenuItemId] = useState("");
  const [itemQuantity, setItemQuantity] = useState("1");
  const [liveLoading, setLiveLoading] = useState(false);
  const [openingCash, setOpeningCash] = useState("");

  const selectedMembership = memberships.find((membership) => membership.id === selectedMembershipId) ?? null;

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return;
      if (sessionError) setError(sessionError.message);
      setSession(data.session);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setError("");
      setLoading(false);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!supabase || !session) {
      setMemberships([]);
      return;
    }
    let active = true;
    setLoading(true);
    supabase.from("memberships")
      .select("id,business_id,role,branch_id,businesses(name),branches(name)")
      .eq("user_id", session.user.id)
      .eq("active", true)
      .then(({ data, error: membershipsError }) => {
        if (!active) return;
        if (membershipsError) setError(membershipsError.message);
        const nextMemberships = (data ?? []) as Membership[];
        setMemberships(nextMemberships);
        if (!selectedMembershipId && nextMemberships.length) {
          setSelectedMembershipId(nextMemberships[0].id);
        }
        setLoading(false);
      });
    return () => { active = false; };
  }, [session]);

  useEffect(() => {
    if (!supabase || !selectedMembership) {
      setBranches([]);
      setSelectedBranchId("");
      return;
    }
    let active = true;
    if (selectedMembership.branch_id) {
      setBranches([{ id: selectedMembership.branch_id, name: relatedName(selectedMembership.branches) ?? "Assigned branch", business_id: selectedMembership.business_id }]);
      setSelectedBranchId(selectedMembership.branch_id);
      return () => { active = false; };
    }
    supabase.from("branches")
      .select("id,name,business_id")
      .eq("business_id", selectedMembership.business_id)
      .eq("active", true)
      .then(({ data, error: branchesError }) => {
        if (!active) return;
        if (branchesError) setError(branchesError.message);
        const nextBranches = (data ?? []) as Branch[];
        setBranches(nextBranches);
        setSelectedBranchId((current) => nextBranches.some((branch) => branch.id === current) ? current : nextBranches[0]?.id ?? "");
      });
    return () => { active = false; };
  }, [selectedMembership]);

  const refreshLiveWorkspace = async (branchId = selectedBranchId) => {
    if (!supabase || !branchId) return;
    setLiveLoading(true);
    setError("");
    const [boardResult, shiftResult, menuResult] = await Promise.all([
      supabase.rpc("read_order_board", { p_branch_id: branchId }),
      selectedMembership?.role === "cashier"
        ? supabase.rpc("read_my_open_shift", { p_branch_id: branchId })
        : Promise.resolve({ data: null, error: null }),
      supabase.from("menu_items")
        .select("id,name,description,unit_price")
        .eq("business_id", selectedMembership?.business_id)
        .eq("active", true)
        .eq("available", true)
        .order("name"),
    ]);
    if (boardResult.error) setError(boardResult.error.message);
    else setOrders((boardResult.data ?? []) as LiveOrder[]);
    if (shiftResult.error) setError(shiftResult.error.message);
    else setOpenShift((shiftResult.data ?? null) as OpenShift);
    if (menuResult.error) setError(menuResult.error.message);
    else setMenuItems((menuResult.data ?? []) as MenuItem[]);
    setLiveLoading(false);
  };

  useEffect(() => {
    if (selectedBranchId) void refreshLiveWorkspace(selectedBranchId);
  }, [selectedBranchId, selectedMembershipId]);

  const openCashierShift = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase || !selectedBranchId) return;
    setWorking(true);
    setError("");
    const opening = Number(openingCash);
    if (!Number.isFinite(opening) || opening < 0) {
      setError("Enter a valid opening cash amount");
      setWorking(false);
      return;
    }
    const { error: shiftError } = await supabase.rpc("open_cashier_shift", {
      p_branch_id: selectedBranchId,
      p_opening_cash: opening,
    });
    if (shiftError) setError(shiftError.message);
    else {
      setOpeningCash("");
      await refreshLiveWorkspace();
    }
    setWorking(false);
  };

  const createOrder = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase || !selectedBranchId || !tableLabel.trim()) return;
    setWorking(true);
    setError("");
    const { data, error: createError } = await supabase.rpc("create_order", {
      p_branch_id: selectedBranchId,
      p_table_label: tableLabel.trim(),
      p_guest_name: guestName.trim() || null,
    });
    if (createError) setError(createError.message);
    else if (data) {
      setSelectedOrderId(data.id);
      setTableLabel("");
      setGuestName("");
      await refreshLiveWorkspace();
    }
    setWorking(false);
  };

  const addMenuItem = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase || !selectedOrderId || !selectedMenuItemId) return;
    setWorking(true);
    setError("");
    const quantity = Number(itemQuantity);
    if (!Number.isInteger(quantity) || quantity < 1) {
      setError("Enter a whole quantity of at least 1");
      setWorking(false);
      return;
    }
    const { error: itemError } = await supabase.rpc("add_menu_item_to_order", {
      p_order_id: selectedOrderId,
      p_menu_item_id: selectedMenuItemId,
      p_quantity: quantity,
      p_discount_amount: 0,
    });
    if (itemError) setError(itemError.message);
    else await refreshLiveWorkspace();
    setWorking(false);
  };

  const updateOrderStatus = async (orderId: string, status: string) => {
    if (!supabase) return;
    setWorking(true);
    setError("");
    const { error: statusError } = await supabase.rpc("update_order_status", {
      p_order_id: orderId,
      p_status: status,
    });
    if (statusError) setError(statusError.message);
    else await refreshLiveWorkspace();
    setWorking(false);
  };

  const payCash = async (order: LiveOrder) => {
    if (!supabase || order.total == null) return;
    setWorking(true);
    setError("");
    const { error: paymentError } = await supabase.rpc("record_order_payment", {
      p_order_id: order.id,
      p_method: "cash",
      p_amount: order.total,
    });
    if (paymentError) setError(paymentError.message);
    else await refreshLiveWorkspace();
    setWorking(false);
  };

  const signIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) return;
    setWorking(true);
    setError("");
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (signInError) setError(signInError.message);
    setWorking(false);
  };

  const signOut = async () => {
    if (!supabase) return;
    setWorking(true);
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) setError(signOutError.message);
    setMemberships([]);
    setSelectedMembershipId("");
    setSelectedBranchId("");
    setBranches([]);
    setOrders([]);
    setMenuItems([]);
    setOpenShift(null);
    setWorking(false);
  };

  if (!isSupabaseConfigured || !supabase) {
    return (
      <main className="backend-entry">
        <section className={session ? "backend-card backend-card-live" : "backend-card"}>
          <div className="backend-brand"><span className="backend-brand-mark"><Utensils size={19} /></span><span><strong>serviceflow</strong><small>MADE FOR HOSPITALITY</small></span></div>
          <div className="backend-signed-in">
            <p className="backend-eyebrow">SUPABASE SETUP</p>
            <h1>One quick setup step.</h1>
            <p className="backend-lead">{hasSupabaseConfig ? "Your Supabase settings are incomplete or the URL is invalid." : "Add your Supabase project URL and publishable key to the local environment file."}</p>
            <div className="backend-no-access"><strong>Copy .env.example to .env.local</strong><span>Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then restart the development server. Never add a service role key to the browser app.</span></div>
          </div>
          <div className="backend-footer"><ShieldCheck size={14} /> Keep secret keys on the server only.</div>
        </section>
      </main>
    );
  }

  return (
    <main className="backend-entry">
      <section className="backend-card">
        <div className="backend-brand"><span className="backend-brand-mark"><Utensils size={19} /></span><span><strong>serviceflow</strong><small>MADE FOR HOSPITALITY</small></span></div>
        {loading ? <div className="backend-loading"><LoaderCircle size={22} /> Checking your workspace…</div> : session ? (
          <div className="live-workspace">
            <div className="live-header">
              <div>
                <p className="backend-eyebrow">SIGNED IN · {session.user.email}</p>
                <h1>{selectedMembership ? relatedName(selectedMembership.businesses) ?? "Restaurant" : "Your workspace"}</h1>
              </div>
              <button className="backend-secondary compact" disabled={working} onClick={signOut}><LogOut size={15} /> Sign out</button>
            </div>
            {error && <p className="backend-error" role="alert">{error}</p>}
            {!memberships.length ? (
              <div className="backend-no-access"><strong>You don’t have a restaurant workspace yet.</strong><span>Ask your restaurant Administrator to invite you. Your role and branch access will appear here.</span></div>
            ) : (
              <>
                <div className="live-controls">
                  <label>Workspace
                    <select value={selectedMembershipId} onChange={(event) => setSelectedMembershipId(event.target.value)}>
                      {memberships.map((membership) => <option key={membership.id} value={membership.id}>{relatedName(membership.businesses) ?? "Restaurant"} · {roleName(membership.role)}</option>)}
                    </select>
                  </label>
                  <label>Branch
                    <select value={selectedBranchId} onChange={(event) => setSelectedBranchId(event.target.value)} disabled={!branches.length}>
                      {!branches.length && <option value="">No branch available</option>}
                      {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                    </select>
                  </label>
                  <button className="backend-secondary compact" onClick={() => void refreshLiveWorkspace()} disabled={!selectedBranchId || liveLoading}><RefreshCw size={15} /> Refresh</button>
                </div>

                {selectedMembership?.role === "cashier" && !openShift && (
                  <form className="live-panel shift-panel" onSubmit={openCashierShift}>
                    <div><strong>Open your cashier shift</strong><span>Required before creating and paying sales.</span></div>
                    <input aria-label="Opening cash" type="number" min="0" step="0.01" value={openingCash} onChange={(event) => setOpeningCash(event.target.value)} placeholder="Opening cash" required />
                    <button className="backend-primary compact" type="submit" disabled={working}>Open shift</button>
                  </form>
                )}

                {selectedMembership?.role === "cashier" && openShift && (
                  <div className="live-panel shift-panel open"><div><strong>Shift #{openShift.shift_number} is open</strong><span>{openShift.shift_date}</span></div><span className="live-status">ACTIVE</span></div>
                )}

                <div className="live-grid">
                  <section className="live-panel">
                    <div className="live-panel-heading"><div><strong>Create order</strong><span>Starts a real order at this branch</span></div></div>
                    <form className="live-form" onSubmit={createOrder}>
                      <input value={tableLabel} onChange={(event) => setTableLabel(event.target.value)} placeholder="Table or takeaway" required />
                      <input value={guestName} onChange={(event) => setGuestName(event.target.value)} placeholder="Guest name (optional)" />
                      <button className="backend-primary compact" type="submit" disabled={working || !selectedBranchId}>Create order</button>
                    </form>
                  </section>

                  <section className="live-panel">
                    <div className="live-panel-heading"><div><strong>Add menu item</strong><span>Choose an order and item</span></div></div>
                    <form className="live-form" onSubmit={addMenuItem}>
                      <select value={selectedOrderId} onChange={(event) => setSelectedOrderId(event.target.value)}>
                        <option value="">Select order</option>
                        {orders.filter((order) => !["paid", "cancelled"].includes(order.status)).map((order) => <option key={order.id} value={order.id}>{order.table_label} · {order.status}</option>)}
                      </select>
                      <select value={selectedMenuItemId} onChange={(event) => setSelectedMenuItemId(event.target.value)}>
                        <option value="">Select menu item</option>
                        {menuItems.map((item) => <option key={item.id} value={item.id}>{item.name} · RWF {Number(item.unit_price).toLocaleString("en-RW")}</option>)}
                      </select>
                      <input aria-label="Quantity" type="number" min="1" value={itemQuantity} onChange={(event) => setItemQuantity(event.target.value)} />
                      <button className="backend-secondary compact" type="submit" disabled={working || !selectedOrderId || !selectedMenuItemId}>Add item</button>
                    </form>
                  </section>
                </div>

                <section className="live-orders">
                  <div className="live-panel-heading"><div><strong>Order board</strong><span>{liveLoading ? "Loading live records…" : `${orders.length} order(s)`}</span></div></div>
                  {!orders.length ? (
                    <div className="live-empty">No visible orders at this branch.</div>
                  ) : (
                    <div className="live-order-list">
                      {orders.map((order) => (
                        <article className="live-order" key={order.id}>
                          <div className="live-order-main"><strong>{order.table_label}</strong><span>{order.guest_name || "Walk-in guest"} · {new Date(order.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span></div>
                          <div className="live-order-items">{order.items?.length ? order.items.map((item) => <span key={item.id}>{item.quantity}× {item.item_name}</span>) : <span>No items yet</span>}</div>
                          {order.total != null && <strong className="live-order-total">RWF {Number(order.total).toLocaleString("en-RW")}</strong>}
                          <div className="live-order-actions">
                            <span className={`live-status status-${order.status}`}>{order.status}</span>
                            {order.status === "new" && <button className="backend-secondary compact" disabled={working} onClick={() => void updateOrderStatus(order.id, "sent")}>Send</button>}
                            {order.status === "sent" && <button className="backend-secondary compact" disabled={working} onClick={() => void updateOrderStatus(order.id, "preparing")}>Prepare</button>}
                            {order.status === "preparing" && <button className="backend-secondary compact" disabled={working} onClick={() => void updateOrderStatus(order.id, "ready")}>Ready</button>}
                            {order.status === "ready" && <button className="backend-secondary compact" disabled={working} onClick={() => void updateOrderStatus(order.id, "served")}>Serve</button>}
                            {["cashier", "manager", "administrator"].includes(selectedMembership?.role ?? "") && order.status === "served" && order.total != null && <button className="backend-primary compact" disabled={working} onClick={() => void payCash(order)}>Pay cash</button>}
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              </>
            )}
          </div>
        ) : (
          <div className="backend-signin">
            <p className="backend-eyebrow">YOUR RESTAURANT, ONE LOGIN</p>
            <h1>Good to have you back.</h1>
            <p className="backend-lead">Sign in to pick up where your shift left off.</p>
            <form onSubmit={signIn}>
              <label htmlFor="backend-email">Email address</label>
              <input id="backend-email" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@yourrestaurant.com" />
              <label htmlFor="backend-password">Password</label>
              <input id="backend-password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Your password" />
              {error && <p className="backend-error" role="alert">{error}</p>}
              <button className="backend-primary" type="submit" disabled={working}>{working ? "Signing you in…" : <>Sign in <ArrowRight size={16} /></>}</button>
            </form>
            <p className="backend-invite-note">Staff accounts are created by your restaurant Administrator. Need access? Ask them for an invite.</p>
          </div>
        )}
        <div className="backend-footer"><ShieldCheck size={14} /> Your restaurant data stays protected by your role.</div>
      </section>
    </main>
  );
}
