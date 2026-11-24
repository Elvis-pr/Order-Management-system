import { useEffect, useState, type FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { ArrowRight, LoaderCircle, LogOut, ShieldCheck, Utensils } from "lucide-react";
import { hasSupabaseConfig, isSupabaseConfigured, supabase } from "./lib/supabase";

type Membership = {
  id: string;
  role: "administrator" | "manager" | "cashier" | "waiter";
  branch_id: string | null;
  businesses: { name: string } | { name: string }[] | null;
  branches: { name: string } | { name: string }[] | null;
};

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
      .select("id,role,branch_id,businesses(name),branches(name)")
      .eq("user_id", session.user.id)
      .eq("active", true)
      .then(({ data, error: membershipsError }) => {
        if (!active) return;
        if (membershipsError) setError(membershipsError.message);
        setMemberships((data ?? []) as Membership[]);
        setLoading(false);
      });
    return () => { active = false; };
  }, [session]);

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
    setWorking(false);
  };

  if (!isSupabaseConfigured || !supabase) {
    return (
      <main className="backend-entry">
        <section className="backend-card">
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
          <div className="backend-signed-in">
            <div className="backend-welcome-icon"><ShieldCheck size={23} /></div>
            <p className="backend-eyebrow">SIGNED IN</p>
            <h1>Welcome back</h1>
            <p className="backend-lead">{session.user.email}</p>
            {error && <p className="backend-error" role="alert">{error}</p>}
            {memberships.length ? <div className="backend-workspaces"><strong>Your restaurant access</strong>{memberships.map((membership) => <div className="backend-workspace" key={membership.id}><span className="backend-workspace-icon"><Utensils size={16} /></span><span><strong>{relatedName(membership.businesses) ?? "Restaurant"}</strong><small>{relatedName(membership.branches) ?? "All branches"} · {roleName(membership.role)}</small></span></div>)}</div> : <div className="backend-no-access"><strong>You don’t have a restaurant workspace yet.</strong><span>Ask your restaurant Administrator to invite you. Your role and branch access will appear here.</span></div>}
            <p className="backend-notice">Your account is connected to Supabase. Live POS screens will be enabled as backend workflows are connected.</p>
            <button className="backend-secondary" disabled={working} onClick={signOut}><LogOut size={15} /> Sign out</button>
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
