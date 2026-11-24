import { useMemo, useState } from "react";
import {
  Activity, ArrowDownLeft, ArrowDownRight, ArrowLeft, ArrowRight, ArrowUpRight,
  BarChart3, Bell, Bike, CalendarDays, Check, ChevronDown, ChevronRight,
  CircleDollarSign, Clock3, Coffee, CreditCard, Download, Ellipsis, FileText,
  Filter, Flame, GlassWater, LayoutDashboard, LogOut, Menu, MoreHorizontal,
  Plus, Search, Settings, ShieldCheck, ShoppingBag, ShoppingCart, SlidersHorizontal,
  Sparkles, Utensils, Users, Wallet, Wine, X,
} from "lucide-react";
import BackendEntry from "./BackendEntry";
import { hasSupabaseConfig, isSupabaseConfigured } from "./lib/supabase";

type Role = "Administrator" | "Manager" | "Cashier" | "Waiter";
type Page = "Overview" | "Orders" | "Menu" | "Team" | "Cash control" | "Reports" | "Settings";
type Order = { id: string; table: string; guest: string; items: number; total: number; status: "Preparing" | "Ready" | "Served"; time: string };

const initialOrders: Order[] = [
  { id: "ORD-2048", table: "Table 08", guest: "Walk-in guest", items: 4, total: 48500, status: "Preparing", time: "2 min ago" },
  { id: "ORD-2047", table: "Table 03", guest: "M. Uwase", items: 2, total: 32000, status: "Ready", time: "6 min ago" },
  { id: "ORD-2046", table: "Patio 02", guest: "J. Nkurunziza", items: 5, total: 67500, status: "Preparing", time: "9 min ago" },
  { id: "ORD-2045", table: "Table 11", guest: "Walk-in guest", items: 3, total: 27000, status: "Served", time: "14 min ago" },
];

const categories = [
  { name: "Food", amount: 842000, share: 42, icon: Utensils, color: "mint" },
  { name: "Alcohol", amount: 526000, share: 26, icon: Wine, color: "lavender" },
  { name: "Cocktails", amount: 368000, share: 18, icon: GlassWater, color: "peach" },
  { name: "Other", amount: 274000, share: 14, icon: Coffee, color: "sky" },
];

const navItems: { page: Page; icon: typeof LayoutDashboard; roles: Role[] }[] = [
  { page: "Overview", icon: LayoutDashboard, roles: ["Administrator", "Manager", "Cashier", "Waiter"] },
  { page: "Orders", icon: ShoppingBag, roles: ["Administrator", "Manager", "Cashier", "Waiter"] },
  { page: "Menu", icon: Utensils, roles: ["Administrator", "Manager"] },
  { page: "Team", icon: Users, roles: ["Administrator", "Manager"] },
  { page: "Cash control", icon: Wallet, roles: ["Administrator", "Manager", "Cashier"] },
  { page: "Reports", icon: BarChart3, roles: ["Administrator", "Manager"] },
  { page: "Settings", icon: Settings, roles: ["Administrator"] },
];

const money = (amount: number) => `Frw ${amount.toLocaleString("en-RW")}`;
const todayLabel = () => new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "2-digit",
  month: "long",
  year: "numeric",
}).format(new Date()).toUpperCase();
const greeting = () => {
  const hour = new Date().getHours();
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
};

function App() {
  return isSupabaseConfigured || hasSupabaseConfig || import.meta.env.PROD ? <BackendEntry /> : <DemoApp />;
}

function DemoApp() {
  const [role, setRole] = useState<Role>("Manager");
  const [page, setPage] = useState<Page>("Overview");
  const [orders, setOrders] = useState(initialOrders);
  const [toast, setToast] = useState("");
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [search, setSearch] = useState("");
  const [opening, setOpening] = useState(false);
  const [opened, setOpened] = useState(false);
  const [closing, setClosing] = useState(false);
  const [payout, setPayout] = useState(false);
  const [newOrder, setNewOrder] = useState(false);

  const visibleNav = navItems.filter((item) => item.roles.includes(role));
  const activeOrders = useMemo(() => orders.filter((order) => order.status !== "Served"), [orders]);
  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2800);
  };
  const changeRole = (nextRole: Role) => {
    setRole(nextRole);
    setShowRoleMenu(false);
    setMobileNav(false);
    const allowed = navItems.find((item) => item.page === page)?.roles.includes(nextRole);
    if (!allowed) setPage("Overview");
  };
  const updateOrder = (orderId: string, status: Order["status"]) => {
    setOrders((current) => current.map((order) => order.id === orderId ? { ...order, status } : order));
    notify(`Order ${orderId} marked ${status.toLowerCase()}.`);
  };
  const requestNewOrder = () => {
    if (role === "Cashier" && !opened) {
      setOpening(true);
      return;
    }
    setNewOrder(true);
  };
  const createOrder = (table: string, guest: string, items: number) => {
    const id = `ORD-${2048 + orders.length}`;
    setOrders((current) => [{ id, table, guest, items, total: items * 12000, status: "Preparing", time: "just now" }, ...current]);
    setNewOrder(false);
    setPage("Orders");
    notify(`Order sent to the kitchen as ${id}.`);
  };

  return (
    <div className="app-shell">
      {mobileNav && <button className="mobile-backdrop" onClick={() => setMobileNav(false)} aria-label="Close navigation" />}
      <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark"><span /><span /><span /></div>
          <div><strong>serviceflow</strong><small>RESTAURANT OS</small></div>
          <button className="mobile-close icon-button" onClick={() => setMobileNav(false)} aria-label="Close menu"><X size={18} /></button>
        </div>
        <div className="location-switch">
          <div className="location-icon"><Utensils size={16} /></div>
          <div className="location-copy"><span>LOCATION</span><strong>The Juniper Room</strong></div>
          <ChevronDown size={15} className="muted-icon" />
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav className="main-nav" aria-label="Main navigation">
          {visibleNav.map(({ page: itemPage, icon: Icon }) => (
            <button key={itemPage} className={`nav-item ${page === itemPage ? "nav-active" : ""}`} onClick={() => { setPage(itemPage); setMobileNav(false); }}>
              <Icon size={18} strokeWidth={1.8} /><span>{itemPage === "Overview" ? "Home" : itemPage === "Team" ? "Staff" : itemPage === "Cash control" ? (role === "Cashier" ? "My shift" : "Cash & shifts") : itemPage}</span>
              {itemPage === "Orders" && <span className="nav-count">{activeOrders.length}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="plan-card">
            <div className="plan-icon"><Sparkles size={16} /></div>
            <div><strong>Your workspace</strong><span>Everything is running smoothly.</span></div>
            <ChevronRight size={15} />
          </div>
          <button className="user-card" onClick={() => setShowRoleMenu((value) => !value)}>
            <div className="avatar avatar-green">{role === "Administrator" ? "AM" : role === "Manager" ? "JK" : role === "Cashier" ? "DM" : "AN"}</div>
            <div className="user-copy"><strong>{role === "Manager" ? "James Kamali" : role === "Administrator" ? "Aline Mukamana" : role === "Cashier" ? "Diane M." : "Alex N."}</strong><span>{role}</span></div>
            <Ellipsis size={18} />
          </button>
          {showRoleMenu && <div className="role-menu"><span className="role-menu-label">SWITCH DEMO ROLE</span>{(["Administrator", "Manager", "Cashier", "Waiter"] as Role[]).map((next) => <button key={next} onClick={() => changeRole(next)}>{next}{role === next && <Check size={14} />}</button>)}</div>}
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <button className="mobile-menu icon-button" onClick={() => setMobileNav(true)} aria-label="Open menu"><Menu size={20} /></button>
          <div className="breadcrumb"><span>Workspace</span><ChevronRight size={14} /><strong>{page === "Overview" ? "Home" : page === "Team" ? "Staff" : page === "Cash control" ? (role === "Cashier" ? "My shift" : "Cash & shifts") : page}</strong></div>
          <div className="topbar-actions">
            <label className="searchbox"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search anything..." /><kbd>⌘ K</kbd></label>
            <div className="topbar-divider" />
            <button className="icon-button notification-button" aria-label="Notifications" onClick={() => setShowNotifications((value) => !value)}><Bell size={18} /><i /></button>
            <div className="today-pill demo-pill"><span className="demo-dot" /> DEMO DATA · NOT CONNECTED</div>
          </div>
          {showNotifications && <div className="notification-popover"><div className="popover-heading"><strong>Notifications</strong><button onClick={() => setShowNotifications(false)} aria-label="Close notifications"><X size={15} /></button></div><div className="notice-item"><span className="notice-dot notice-orange" /><div><strong>3 orders need attention</strong><p>Kitchen tickets are waiting for an update.</p><small>Just now</small></div></div><div className="notice-item"><span className="notice-dot notice-green" /><div><strong>Daily summary is ready</strong><p>Yesterday&apos;s report has been generated.</p><small>32 minutes ago</small></div></div></div>}
        </header>

        <div className="page-content">
          {page === "Overview" && <Overview role={role} orders={orders} search={search} opened={opened} onNavigate={setPage} onOpenShift={() => setOpening(true)} onCreateOrder={requestNewOrder} onUpdateOrder={updateOrder} onNotify={notify} />}
          {page === "Orders" && <OrdersPage role={role} orders={orders} search={search} onCreateOrder={requestNewOrder} onUpdateOrder={updateOrder} onNotify={notify} />}
          {page === "Cash control" && <CashControl role={role} opened={opened} onOpen={() => setOpening(true)} onClose={() => setClosing(true)} onPayout={() => setPayout(true)} onNotify={notify} />}
          {page === "Menu" && <SimplePage title="Menu management" subtitle="Keep your menu fresh, organized, and ready to serve." icon={<Utensils size={21} />} action="Add menu item" onAction={() => notify("Menu item form is coming soon.")} />}
          {page === "Team" && <SimplePage title="Your team" subtitle="Manage roles and keep your service team in sync." icon={<Users size={21} />} action="Invite teammate" onAction={() => notify("Team invitations will be available when accounts are connected.")} />}
          {page === "Reports" && <ReportsPage onNotify={notify} />}
          {page === "Settings" && <SimplePage title="Workspace settings" subtitle="Configure your restaurant, receipts, and business preferences." icon={<Settings size={21} />} action="Save changes" onAction={() => notify("Settings saved in this demo.")} />}
        </div>
      </main>
      {toast && <div className="toast"><span className="toast-check"><Check size={15} /></span>{toast}</div>}
      {newOrder && <NewOrderModal onClose={() => setNewOrder(false)} onCreate={createOrder} />}
      {opening && <Modal title="Start your shift" onClose={() => setOpening(false)}><p className="modal-description">Count your till before serving your first guest. The standard opening float is Frw 50,000.</p><div className="form-field"><label>Cash in your till <span>RWANDAN FRANCS</span></label><div className="input-money"><span>Frw</span><input type="number" defaultValue="50000" min="0" /></div></div><div className="modal-note"><ShieldCheck size={16} /><span>We’ll record this opening count against your shift.</span></div><div className="modal-actions"><button className="button-secondary" onClick={() => setOpening(false)}>Not now</button><button className="button-primary" onClick={() => { setOpened(true); setOpening(false); notify("Your shift is open. You’re ready to serve."); }}>Start shift <ArrowRight size={15} /></button></div></Modal>}
      {closing && <Modal title="Close your shift" onClose={() => setClosing(false)}><p className="modal-description">Count the cash in your till. A manager must authorize any difference.</p><div className="closing-summary"><div><span>Expected cash</span><strong>{money(642000)}</strong></div><div><span>Cash counted</span><strong>{money(642000)}</strong></div><div className="closing-balanced"><span>Difference</span><strong>Frw 0</strong></div></div><div className="modal-actions"><button className="button-secondary" onClick={() => setClosing(false)}>Cancel</button><button className="button-primary" onClick={() => { setOpened(false); setClosing(false); notify("Shift closed. Your reports are ready."); }}>Confirm closing <Check size={15} /></button></div></Modal>}
      {payout && <Modal title="Record a payout" onClose={() => setPayout(false)}><p className="modal-description">Log cash paid out from the till during this shift.</p><div className="form-field"><label>Amount <span>FRW</span></label><div className="input-money"><span>Frw</span><input type="number" placeholder="0" min="1" /></div></div><div className="form-field"><label>Reason</label><select defaultValue=""><option value="" disabled>Select a reason</option><option>Supplies</option><option>Transport</option><option>Emergency purchase</option><option>Staff refreshments</option><option>Other</option></select></div><div className="form-field"><label>Description</label><input className="text-input" placeholder="Add a short note..." /></div><div className="modal-actions"><button className="button-secondary" onClick={() => setPayout(false)}>Cancel</button><button className="button-primary" onClick={() => { setPayout(false); notify("Payout recorded in this demo."); }}>Record payout <ArrowRight size={15} /></button></div></Modal>}
    </div>
  );
}

function Overview({ role, orders, search, opened, onNavigate, onOpenShift, onCreateOrder, onUpdateOrder, onNotify }: { role: Role; orders: Order[]; search: string; opened: boolean; onNavigate: (page: Page) => void; onOpenShift: () => void; onCreateOrder: () => void; onUpdateOrder: (id: string, status: Order["status"]) => void; onNotify: (message: string) => void }) {
  if (role === "Waiter") return <WaiterOverview orders={orders} onNavigate={onNavigate} onCreateOrder={onCreateOrder} onUpdateOrder={onUpdateOrder} />;
  if (role === "Cashier") return <CashierOverview orders={orders} opened={opened} onNavigate={onNavigate} onOpenShift={onOpenShift} onCreateOrder={onCreateOrder} />;
  const isAdmin = role === "Administrator";
  const filteredOrders = orders.filter((order) => `${order.id} ${order.table} ${order.guest}`.toLowerCase().includes(search.toLowerCase()));
  return (
    <>
      <div className="welcome-row">
        <div><div className="eyebrow"><span className="eyebrow-dot" /> {todayLabel()}</div><h1>{greeting()}, {isAdmin ? "Aline" : "James"} <span className="wave">✳</span></h1><p className="page-subtitle">Here&apos;s what&apos;s happening at <strong>The Juniper Room</strong> today.</p></div>
        <div className="welcome-actions"><button className="button-secondary" onClick={() => onNotify("Your report is being prepared for download.")}><Download size={16} /> Export report</button><button className="button-primary" onClick={onCreateOrder}><Plus size={17} /> New order</button></div>
      </div>
      {isAdmin && <div className="admin-note"><ShieldCheck size={16} /><span>Administrator view</span><p>You&apos;re seeing business-wide financials and activity.</p></div>}
      <section className="stats-grid">
        <StatCard label="Total sales" value={money(2010000)} change="+12.8%" detail="vs. last Tuesday" icon={<CircleDollarSign size={19} />} tone="green" />
        <StatCard label="Orders today" value="86" change="+8.2%" detail="vs. last Tuesday" icon={<ShoppingCart size={19} />} tone="blue" />
        <StatCard label="Avg. order value" value={money(23372)} change="+4.6%" detail="vs. last Tuesday" icon={<ArrowUpRight size={19} />} tone="purple" />
        <StatCard label="Active tables" value="12 / 18" detail="67% occupancy" icon={<Utensils size={19} />} tone="orange" />
      </section>
      <section className="analytics-grid">
        <div className="panel sales-panel">
          <div className="panel-heading"><div><div className="section-eyebrow">YOUR PERFORMANCE</div><h2>Sales overview</h2></div><div className="period-select"><CalendarDays size={15} /><span>This week</span><ChevronDown size={14} /></div></div>
          <div className="chart-summary"><strong>{money(12480000)}</strong><span className="change-pill"><ArrowUpRight size={13} /> 12.8%</span><span className="summary-caption">vs. previous week</span></div>
          <div className="chart" role="img" aria-label="Sales chart showing daily sales trending upward this week">
            <div className="chart-y-labels"><span>3.0M</span><span>2.0M</span><span>1.0M</span><span>0</span></div>
            <div className="chart-plot"><div className="chart-gridline line-one" /><div className="chart-gridline line-two" /><div className="chart-gridline line-three" /><svg viewBox="0 0 720 190" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="salesFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#52b788" stopOpacity=".22" /><stop offset="100%" stopColor="#52b788" stopOpacity="0" /></linearGradient></defs><path className="chart-area" d="M0 148 C35 142 44 131 80 136 S128 112 160 121 S206 90 240 106 S287 96 320 107 S370 72 400 85 S450 64 480 73 S527 40 560 58 S612 25 640 47 S690 21 720 30 L720 190 L0 190 Z" /><path className="chart-line" d="M0 148 C35 142 44 131 80 136 S128 112 160 121 S206 90 240 106 S287 96 320 107 S370 72 400 85 S450 64 480 73 S527 40 560 58 S612 25 640 47 S690 21 720 30" /><circle cx="560" cy="58" r="5" className="chart-dot" /></svg><div className="chart-tooltip"><strong>Frw 2,010,000</strong><span>Today, 4:30 PM</span></div><div className="chart-days"><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span><span>Mon</span><span>Tue</span></div></div>
          </div>
          <div className="chart-legend"><span><i className="legend-dot" /> This week</span><span><i className="legend-dot legend-pale" /> Last week</span></div>
        </div>
        <div className="panel category-panel">
          <div className="panel-heading"><div><div className="section-eyebrow">WHAT&apos;S SELLING</div><h2>Sales by category</h2></div><button className="icon-button subtle-button" aria-label="Category options"><MoreHorizontal size={19} /></button></div>
          <div className="category-total"><strong>{money(2010000)}</strong><span>Total revenue</span></div>
          <div className="category-bars">{categories.map((category) => <div className="category-row" key={category.name}><div className="category-line"><span><i className={`category-icon ${category.color}`}><category.icon size={14} /></i>{category.name}</span><strong>{money(category.amount)}</strong></div><div className="progress-track"><div className={`progress-fill ${category.color}`} style={{ width: `${category.share}%` }} /></div></div>)}</div>
          <button className="text-link" onClick={() => onNavigate("Reports")}>View sales report <ArrowRight size={14} /></button>
        </div>
      </section>
      <section className="bottom-grid">
        <div className="panel orders-panel">
          <div className="panel-heading"><div><div className="section-eyebrow">LIVE SERVICE</div><h2>Recent orders <span className="live-order-dot" /></h2></div><button className="text-link" onClick={() => onNavigate("Orders")}>View all <ArrowRight size={14} /></button></div>
          <div className="orders-table-wrap"><table className="orders-table"><thead><tr><th>ORDER</th><th>TABLE / GUEST</th><th>ITEMS</th><th>STATUS</th><th>TOTAL</th><th /></tr></thead><tbody>{filteredOrders.slice(0, 4).map((order) => <tr key={order.id}><td><strong className="order-id">{order.id}</strong><span className="table-time">{order.time}</span></td><td><strong>{order.table}</strong><span className="table-time">{order.guest}</span></td><td>{order.items} items</td><td><span className={`status-badge status-${order.status.toLowerCase()}`}><i />{order.status}</span></td><td className="amount-cell">{money(order.total)}</td><td><button className="icon-button table-more" aria-label={`Update ${order.id}`} onClick={() => onUpdateOrder(order.id, order.status === "Preparing" ? "Ready" : order.status === "Ready" ? "Served" : "Preparing")}><MoreHorizontal size={17} /></button></td></tr>)}</tbody></table>{filteredOrders.length === 0 && <div className="empty-state">No orders match “{search}”.</div>}</div>
        </div>
        <div className="panel activity-panel">
          <div className="panel-heading"><div><div className="section-eyebrow">THE FLOOR, RIGHT NOW</div><h2>Service snapshot</h2></div><button className="icon-button subtle-button" aria-label="Activity options"><MoreHorizontal size={19} /></button></div>
          <div className="snapshot-grid"><div className="snapshot-item"><span className="snapshot-icon icon-green"><Utensils size={17} /></span><div><strong>12 <small>/ 18</small></strong><span>Tables occupied</span></div></div><div className="snapshot-item"><span className="snapshot-icon icon-peach"><Clock3 size={17} /></span><div><strong>18 <small>min</small></strong><span>Avg. service time</span></div></div><div className="snapshot-item"><span className="snapshot-icon icon-purple"><Bike size={17} /></span><div><strong>7</strong><span>Takeaway orders</span></div></div></div>
          <div className="snapshot-foot"><span className="snapshot-status"><i /> All systems operational</span><span>Updated just now</span></div>
        </div>
      </section>
      <div className="footnote"><span><ShieldCheck size={14} /> Your data is synced and secure</span><span>Last updated just now <button onClick={() => onNotify("Dashboard refreshed.")}><Activity size={13} /> Refresh</button></span></div>
    </>
  );
}

function StatCard({ label, value, change, detail, icon, tone }: { label: string; value: string; change?: string; detail: string; icon: React.ReactNode; tone: string }) {
  return <div className="stat-card"><div className={`stat-icon ${tone}`}>{icon}</div><div className="stat-top"><span>{label}</span><button aria-label={`${label} options`}><MoreHorizontal size={17} /></button></div><strong className="stat-value">{value}</strong><div className="stat-foot">{change && <span className="change-pill"><ArrowUpRight size={13} />{change}</span>}<span>{detail}</span></div></div>;
}

function OrdersPage({ role, orders, search, onCreateOrder, onUpdateOrder, onNotify }: { role: Role; orders: Order[]; search: string; onCreateOrder: () => void; onUpdateOrder: (id: string, status: Order["status"]) => void; onNotify: (message: string) => void }) {
  const [filter, setFilter] = useState("All orders");
  const canSeeRevenue = role !== "Waiter";
  const filtered = orders.filter((order) => (filter === "All orders" || order.status === filter) && `${order.id} ${order.table} ${order.guest}`.toLowerCase().includes(search.toLowerCase()));
  return (
    <>
      <div className="welcome-row">
        <div><div className="eyebrow"><span className="eyebrow-dot" /> LIVE ORDER BOARD</div><h1>Orders <span className="count-chip">{orders.length}</span></h1><p className="page-subtitle">See what&apos;s cooking, what&apos;s ready, and what needs serving.</p></div>
        <div className="welcome-actions"><button className="button-secondary" onClick={() => onNotify("Kitchen display is connected.")}><Flame size={16} /> Kitchen display</button><button className="button-primary" onClick={onCreateOrder}><Plus size={17} /> Start an order</button></div>
      </div>
      <div className="order-summary-cards">
        <div className="mini-stat"><span className="mini-stat-icon green"><Activity size={17} /></span><div><strong>{orders.length}</strong><span>Orders today</span></div></div>
        <div className="mini-stat"><span className="mini-stat-icon orange"><Clock3 size={17} /></span><div><strong>{orders.filter((order) => order.status === "Preparing").length}</strong><span>In the kitchen</span></div></div>
        <div className="mini-stat"><span className="mini-stat-icon blue"><Check size={17} /></span><div><strong>{orders.filter((order) => order.status === "Ready").length}</strong><span>Ready to serve</span></div></div>
        {canSeeRevenue ? <div className="mini-stat"><span className="mini-stat-icon purple"><CircleDollarSign size={17} /></span><div><strong>{money(orders.reduce((sum, order) => sum + order.total, 0))}</strong><span>Order value</span></div></div> : <div className="mini-stat"><span className="mini-stat-icon purple"><Utensils size={17} /></span><div><strong>{orders.reduce((sum, order) => sum + order.items, 0)}</strong><span>Items in service</span></div></div>}
      </div>
      <div className="panel full-panel">
        <div className="list-toolbar"><div className="filter-tabs">{["All orders", "Preparing", "Ready", "Served"].map((item) => <button key={item} className={filter === item ? "filter-tab selected" : "filter-tab"} onClick={() => setFilter(item)}>{item}{item === "All orders" && <span>{orders.length}</span>}</button>)}</div><div className="toolbar-right"><button className="button-secondary compact-button" onClick={() => onNotify("Filters are up to date.")}><SlidersHorizontal size={15} /> Filter</button><button className="button-secondary compact-button" onClick={() => onNotify("Orders downloaded.")} aria-label="Download orders"><Download size={15} /></button></div></div>
        <div className="orders-table-wrap"><table className="orders-table large-orders"><thead><tr><th>ORDER</th><th>TABLE / GUEST</th><th>ITEMS</th>{role !== "Waiter" && <th>SERVER</th>}<th>STATUS</th>{canSeeRevenue && <th>TOTAL</th>}<th>ACTION</th></tr></thead><tbody>{filtered.map((order) => <tr key={order.id}><td><strong className="order-id">{order.id}</strong><span className="table-time">Today, {order.time}</span></td><td><strong>{order.table}</strong><span className="table-time">{order.guest}</span></td><td>{order.items} items</td>{role !== "Waiter" && <td>Alex N.</td>}<td><span className={`status-badge status-${order.status.toLowerCase()}`}><i />{order.status}</span></td>{canSeeRevenue && <td className="amount-cell">{money(order.total)}</td>}<td>{order.status !== "Served" && <button className="order-action" onClick={() => onUpdateOrder(order.id, order.status === "Preparing" ? "Ready" : "Served")}>{order.status === "Preparing" ? "Mark ready" : role === "Waiter" ? "Serve" : "Mark served"} <ChevronRight size={14} /></button>}</td></tr>)}</tbody></table>{filtered.length === 0 && <div className="empty-state">No orders here right now.</div>}</div>
        <div className="table-footer"><span>Showing {filtered.length} of {orders.length} orders</span><div><button className="pagination-btn" disabled><ArrowLeft size={14} /> Previous</button><button className="pagination-btn">Next <ArrowRight size={14} /></button></div></div>
      </div>
    </>
  );
}

function CashierOverview({ orders, opened, onNavigate, onOpenShift, onCreateOrder }: { orders: Order[]; opened: boolean; onNavigate: (page: Page) => void; onOpenShift: () => void; onCreateOrder: () => void }) {
  return <>
    <div className="welcome-row">
      <div><div className="eyebrow"><span className="eyebrow-dot" /> YOUR SHIFT</div><h1>{greeting()}, Diane <span className="wave">✳</span></h1><p className="page-subtitle">Your service at a glance. Let&apos;s make it a great shift.</p></div>
    <div className="welcome-actions"><button className="button-secondary" onClick={() => onNavigate("Cash control")}><Wallet size={16} /> My shift</button><button className="button-primary" onClick={opened ? onCreateOrder : onOpenShift}><Plus size={17} /> {opened ? "New sale" : "Start shift"}</button></div>
    </div>
    <div className="shift-banner"><span className="shift-banner-icon"><Clock3 size={18} /></span><div><strong>{opened ? "You’re clocked in and ready to go" : "Start your shift to begin serving"}</strong><span>{opened ? "Register 01 · Started today at 9:02 AM" : "It only takes a moment to count your opening till."}</span></div><span className={`shift-open-status ${opened ? "" : "shift-closed"}`}><i /> {opened ? "OPEN" : "NOT STARTED"}</span></div>
    <section className="stats-grid cashier-stats"><StatCard label="Transactions" value="34" change="+6 today" detail="completed this shift" icon={<ShoppingCart size={19} />} tone="green" /><StatCard label="Sales processed" value={money(816000)} change="+9.4%" detail="vs. your last shift" icon={<CircleDollarSign size={19} />} tone="blue" /><StatCard label="Cash payments" value="18" detail="of 34 transactions" icon={<Wallet size={19} />} tone="orange" /><StatCard label="Card & mobile" value="16" detail="of 34 transactions" icon={<CreditCard size={19} />} tone="purple" /></section>
    <div className="panel payment-panel"><div className="panel-heading"><div><div className="section-eyebrow">YOUR LATEST ACTIVITY</div><h2>Recent transactions</h2></div><button className="text-link" onClick={() => onNavigate("Orders")}>View all <ArrowRight size={14} /></button></div>{orders.slice(0, 3).map((order, index) => <div className="transaction-row" key={order.id}><span className={`transaction-icon transaction-${index}`}><ShoppingBag size={16} /></span><div className="transaction-copy"><strong>{order.id} · {order.table}</strong><span>{index === 0 ? "Cash" : index === 1 ? "Mobile Money" : "Card"} · {order.time}</span></div><strong className="transaction-amount">{money(order.total)}</strong><span className="transaction-success"><Check size={13} /></span></div>)}</div>
    <div className="footnote"><span><ShieldCheck size={14} /> Only your transactions are shown here</span><span>Questions? Ask your manager.</span></div>
  </>;
}

function WaiterOverview({ orders, onNavigate, onCreateOrder, onUpdateOrder }: { orders: Order[]; onNavigate: (page: Page) => void; onCreateOrder: () => void; onUpdateOrder: (id: string, status: Order["status"]) => void }) {
  const activeOrders = orders.filter((order) => order.status !== "Served");
  const readyOrders = activeOrders.filter((order) => order.status === "Ready");
  return <>
    <div className="welcome-row"><div><div className="eyebrow"><span className="eyebrow-dot" /> YOUR SECTION</div><h1>{greeting()}, Alex <span className="wave">✳</span></h1><p className="page-subtitle">Here are your tables and orders. We’ll keep the next step clear.</p></div><div className="welcome-actions"><button className="button-primary" onClick={onCreateOrder}><Plus size={17} /> Start an order</button></div></div>
    <div className={`shift-banner ${readyOrders.length ? "ready-banner" : ""}`}><span className="shift-banner-icon">{readyOrders.length ? <Check size={18} /> : <Utensils size={18} />}</span><div><strong>{readyOrders.length ? `${readyOrders.length} ${readyOrders.length === 1 ? "order is" : "orders are"} ready to serve` : "You’re all caught up"}</strong><span>{readyOrders.length ? "Tap “Serve” on an order when it reaches your table." : "New kitchen updates will show here."}</span></div></div>
    <section className="stats-grid waiter-stats"><StatCard label="Active orders" value={String(activeOrders.length)} detail="across your section" icon={<ShoppingBag size={19} />} tone="green" /><StatCard label="Orders served" value="12" change="+3 today" detail="you’re doing great" icon={<Check size={19} />} tone="blue" /><StatCard label="Tables serving" value="5" detail="in your section" icon={<Utensils size={19} />} tone="orange" /><StatCard label="Avg. service time" value="18 min" change="−2 min" detail="vs. last shift" icon={<Clock3 size={19} />} tone="purple" /></section>
    <div className="panel waiter-orders"><div className="panel-heading"><div><div className="section-eyebrow">YOUR TABLES</div><h2>Orders to look after</h2></div><button className="button-secondary compact-button" onClick={() => onNavigate("Orders")}>See all orders <ArrowRight size={14} /></button></div>{activeOrders.length === 0 ? <div className="empty-state">No active orders right now. You’re all caught up.</div> : [...activeOrders].sort((a, b) => Number(b.status === "Ready") - Number(a.status === "Ready")).map((order) => <div className="waiter-order" key={order.id}><span className={`order-status-icon ${order.status === "Ready" ? "ready" : ""}`}>{order.status === "Ready" ? <Check size={16} /> : <Clock3 size={16} />}</span><div className="waiter-order-copy"><strong>{order.table} <span>·</span> {order.guest}</strong><span>{order.items} items · {order.time}</span></div><span className={`status-badge status-${order.status.toLowerCase()}`}><i />{order.status}</span>{order.status === "Ready" ? <button className="button-primary waiter-serve" onClick={() => onUpdateOrder(order.id, "Served")}><Check size={15} /> Serve</button> : <button className="icon-button" aria-label={`View ${order.table} order`} onClick={() => onNavigate("Orders")}><ChevronRight size={17} /></button>}</div>)}</div>
    <div className="footnote"><span><ShieldCheck size={14} /> This view keeps the focus on guest service</span><span>Ask your manager if you need help.</span></div>
  </>;
}

function CashControl({ role, opened, onOpen, onClose, onPayout }: { role: Role; opened: boolean; onOpen: () => void; onClose: () => void; onPayout: () => void; onNotify: (message: string) => void }) {
  const [tab, setTab] = useState("Shift overview");
  const isCashier = role === "Cashier";
  return <><div className="welcome-row"><div><div className="eyebrow"><span className="eyebrow-dot" /> TILL & SHIFT MANAGEMENT</div><h1>{isCashier ? "My shift" : "Cash & shifts"}</h1><p className="page-subtitle">{isCashier ? "Manage your shift and keep your till balanced." : "Monitor shift performance, cash movements, and payouts."}</p></div><div className="welcome-actions"><button className="button-secondary" onClick={onPayout}><ArrowDownRight size={16} /> Record payout</button><button className="button-primary" onClick={opened ? onClose : onOpen}>{opened ? <><LogOut size={16} /> Finish shift</> : <><Plus size={16} /> Start shift</>}</button></div></div><div className="cash-tabs">{["Shift overview", "Payouts", ...(!isCashier ? ["All registers"] : [])].map((item) => <button key={item} className={tab === item ? "cash-tab active" : "cash-tab"} onClick={() => setTab(item)}>{item}</button>)}</div>{tab === "Shift overview" ? <><div className="shift-banner"><span className="shift-banner-icon"><Clock3 size={18} /></span><div><strong>{opened ? "Your shift is open" : "Shift not started"}</strong><span>{opened ? "Started today at 9:02 AM · Register 01" : "Register 01 · Opening float is Frw 50,000"}</span></div><span className={`shift-open-status ${opened ? "" : "shift-closed"}`}><i /> {opened ? "OPEN" : "CLOSED"}</span></div><div className="cash-overview-grid"><div className="panel cash-position"><div className="panel-heading"><div><div className="section-eyebrow">CURRENT SHIFT</div><h2>Cash position</h2></div><span className="date-chip"><CalendarDays size={14} /> Today</span></div><div className="cash-position-total"><span>Expected cash</span><strong>{isCashier ? "••••••" : money(642000)}</strong>{isCashier && <small>Visible to managers only</small>}</div><div className="cash-ledger"><div><span>Opening float</span><strong>{isCashier ? "••••••" : money(50000)}</strong></div><div><span>Cash sales</span><strong>{isCashier ? "••••••" : money(714000)}</strong></div><div><span>Other payments</span><strong>{isCashier ? "••••••" : money(1296000)}</strong></div><div><span>Payouts</span><strong className="negative-amount">{isCashier ? "••••••" : `− ${money(122000)}`}</strong></div></div></div><div className="panel shift-progress"><div className="panel-heading"><div><div className="section-eyebrow">REGISTER ACTIVITY</div><h2>Today&apos;s activity</h2></div><span className="active-register"><i /> 1 active register</span></div><div className="activity-stat"><span className="activity-stat-icon green"><ShoppingCart size={18} /></span><div><strong>86</strong><span>Transactions</span></div><span className="activity-detail">Since 9:02 AM</span></div><div className="activity-stat"><span className="activity-stat-icon peach"><ArrowDownLeft size={18} /></span><div><strong>{isCashier ? "••••••" : money(122000)}</strong><span>Total payouts</span></div><span className="activity-detail">{isCashier ? "Manager view" : "4 recorded"}</span></div><div className="shift-reminder"><ShieldCheck size={16} /><span>Cash discrepancies require manager or administrator approval to close.</span></div></div></div></> : <div className="panel payout-panel"><div className="panel-heading"><div><div className="section-eyebrow">CASH MOVEMENTS</div><h2>{tab}</h2></div><span className="date-chip"><CalendarDays size={14} /> Today</span></div><div className="orders-table-wrap"><table className="orders-table"><thead><tr><th>TIME</th><th>REASON</th><th>RECORDED BY</th><th>APPROVAL</th><th>AMOUNT</th></tr></thead><tbody><tr><td>2:14 PM</td><td><strong>Kitchen supplies</strong><span className="table-time">Emergency purchase</span></td><td>Diane M.</td><td><span className="status-badge status-ready"><i /> Approved</span></td><td className="amount-cell negative-amount">− Frw 48,000</td></tr><tr><td>12:35 PM</td><td><strong>Transport</strong><span className="table-time">Delivery run</span></td><td>Diane M.</td><td><span className="status-badge status-served"><i /> Recorded</span></td><td className="amount-cell negative-amount">− Frw 24,000</td></tr><tr><td>10:02 AM</td><td><strong>Staff refreshments</strong><span className="table-time">Water and tea</span></td><td>Patrick K.</td><td><span className="status-badge status-served"><i /> Recorded</span></td><td className="amount-cell negative-amount">− Frw 50,000</td></tr></tbody></table></div></div>}<div className="footnote"><span><ShieldCheck size={14} /> Cash differences require authorized approval</span><span>All cash movements are recorded.</span></div></>;
}

function ReportsPage({ onNotify }: { onNotify: (message: string) => void }) {
  return <><div className="welcome-row"><div><div className="eyebrow"><span className="eyebrow-dot" /> BUSINESS INSIGHTS</div><h1>Reports & insights</h1><p className="page-subtitle">Understand your performance and make your next move with confidence.</p></div><div className="welcome-actions"><button className="button-secondary" onClick={() => onNotify("Report export started.")}><Download size={16} /> Export</button><button className="button-primary" onClick={() => onNotify("Report sent to print queue.")}><FileText size={16} /> Print report</button></div></div><div className="report-filters"><button className="button-secondary compact-button"><CalendarDays size={15} /> Nov 18 – Nov 24, 2026 <ChevronDown size={14} /></button><button className="button-secondary compact-button"><Filter size={15} /> All locations <ChevronDown size={14} /></button></div><section className="stats-grid report-stats"><StatCard label="Gross sales" value={money(12480000)} change="+12.8%" detail="vs. previous week" icon={<CircleDollarSign size={19} />} tone="green" /><StatCard label="Transactions" value="542" change="+8.2%" detail="vs. previous week" icon={<ShoppingCart size={19} />} tone="blue" /><StatCard label="Avg. transaction" value={money(23026)} change="+4.6%" detail="vs. previous week" icon={<ArrowUpRight size={19} />} tone="purple" /><StatCard label="Payouts" value={money(846000)} detail="32 cash movements" icon={<ArrowDownRight size={19} />} tone="orange" /></section><div className="panel report-summary"><div className="panel-heading"><div><div className="section-eyebrow">WEEKLY BREAKDOWN</div><h2>Sales by category</h2></div><button className="button-secondary compact-button" onClick={() => onNotify("Category report downloaded.")}><Download size={15} /> Download CSV</button></div>{categories.map((category) => <div className="report-category-row" key={category.name}><span className={`category-icon ${category.color}`}><category.icon size={15} /></span><strong>{category.name}</strong><div className="report-progress"><div className={`progress-fill ${category.color}`} style={{ width: `${category.share}%` }} /></div><span>{category.share}%</span><strong>{money(category.amount * 6)}</strong></div>)}</div><div className="footnote"><span><ShieldCheck size={14} /> Reports are visible to managers and administrators</span><span>Updated just now</span></div></>;
}

function SimplePage({ title, subtitle, icon, action, onAction }: { title: string; subtitle: string; icon: React.ReactNode; action: string; onAction: () => void }) {
  return <><div className="welcome-row"><div><div className="eyebrow"><span className="eyebrow-dot" /> WORKSPACE</div><h1>{title}</h1><p className="page-subtitle">{subtitle}</p></div><button className="button-primary" onClick={onAction}><Plus size={16} /> {action}</button></div><div className="panel coming-soon-panel"><span className="coming-icon">{icon}</span><h2>A better way to run service.</h2><p>This workspace is ready for your team. Connect your restaurant data to unlock management tools tailored to your operation.</p><button className="text-link" onClick={onAction}>Get started <ArrowRight size={15} /></button></div></>;
}

function NewOrderModal({ onClose, onCreate }: { onClose: () => void; onCreate: (table: string, guest: string, items: number) => void }) {
  const [table, setTable] = useState("Table 01");
  const [guest, setGuest] = useState("");
  const [items, setItems] = useState("1");
  return <Modal title="Start a new order" onClose={onClose}>
    <p className="modal-description">Choose a table and guest. You can add items and notes when the order screen is connected.</p>
    <form onSubmit={(event) => { event.preventDefault(); onCreate(table, guest.trim() || "Walk-in guest", Number(items)); }}>
      <div className="form-field"><label htmlFor="order-table">Table or pickup</label><select id="order-table" value={table} onChange={(event) => setTable(event.target.value)}><option>Table 01</option><option>Table 02</option><option>Table 03</option><option>Table 04</option><option>Patio 01</option><option>Patio 02</option><option>Takeaway</option></select></div>
      <div className="form-field"><label htmlFor="order-guest">Guest name <span>OPTIONAL</span></label><input id="order-guest" className="text-input" value={guest} onChange={(event) => setGuest(event.target.value)} placeholder="e.g. Amina or walk-in guest" /></div>
      <div className="form-field"><label htmlFor="order-items">Items to start with</label><input id="order-items" className="text-input" type="number" min="1" max="99" required value={items} onChange={(event) => setItems(event.target.value)} /></div>
      <div className="modal-actions"><button type="button" className="button-secondary" onClick={onClose}>Cancel</button><button type="submit" className="button-primary"><Flame size={15} /> Send to kitchen</button></div>
    </form>
  </Modal>;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="modal-backdrop" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-heading"><div><span className="section-eyebrow">SERVICEFLOW · REGISTER 01</span><h2 id="modal-title">{title}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close"><X size={18} /></button></div>{children}</section></div>;
}

export default App;
