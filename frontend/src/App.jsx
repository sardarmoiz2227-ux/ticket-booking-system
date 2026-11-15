import React, { createContext, useContext, useEffect, useState } from 'react';
import { Link, Navigate, NavLink, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, CalendarDays, Check, CheckCircle2, ChevronRight, Clock3, Compass,
  CreditCard, Heart, LockKeyhole, LogOut, Mail, MapPin, Menu, MinusCircle, Plus, ShieldCheck,
  Sparkles, Ticket, TicketCheck, Users, X, AlertCircle, Eye, EyeOff
} from 'lucide-react';

const STORAGE_KEY = 'evently-demo-session';
const AuthContext = createContext(null);
const homeFor = role => role === 'ADMIN' ? '/admin/bookings' : role === 'ORGANIZER' ? '/organizer/events' : '/events';
const prettyDate = value => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
const prettyTime = value => new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date(value));
const bookingRef = id => `EVT-${String(id).padStart(5, '0')}`;
const coverClass = id => `cover-${((Number(id) - 1) % 6) + 1}`;
const eventType = id => ['TECHNOLOGY', 'ENTERTAINMENT', 'WORKSHOP', 'CAREER', 'NETWORKING', 'CREATIVE'][((Number(id) - 1) % 6 + 6) % 6];

function AuthProvider({ children }) {
  const [session, setSession] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch { return null; }
  });
  function signIn(result) { localStorage.setItem(STORAGE_KEY, JSON.stringify(result)); setSession(result); }
  function signOut() { localStorage.removeItem(STORAGE_KEY); setSession(null); }
  return <AuthContext.Provider value={{ session, user: session?.user, signIn, signOut }}>{children}</AuthContext.Provider>;
}
function useAuth() { return useContext(AuthContext); }
async function request(path, { method = 'GET', body, token } = {}) {
  let response;
  try {
    response = await fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api${path}`, {
      method,
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
  } catch { throw new Error('Cannot reach the server. Is the backend running?'); }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
}
function useToken() { return useAuth().session?.token; }
function Protected({ role, children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== role) return <Navigate to={homeFor(user.role)} replace />;
  return children;
}
function Logo() {
  return <Link to="/" className="brand"><span className="brand-icon"><TicketCheck size={23} strokeWidth={2.4}/></span><span>evently<span className="brand-dot">.</span></span></Link>;
}
function Layout({ children }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const links = user?.role === 'CUSTOMER'
    ? [['/events', 'Explore Events', Compass], ['/bookings', 'My Bookings', Ticket]]
    : user?.role === 'ORGANIZER'
      ? [['/organizer/events', 'My Events', CalendarDays], ['/organizer/events/new', 'Create Event', Plus]]
      : [['/admin/bookings', 'All Bookings', TicketCheck]];
  const logout = () => { signOut(); navigate('/login'); };
  return <div className="app-shell">
    <header className="topbar"><div className="topbar-inner">
      <Logo />
      <nav className={`main-nav ${mobileOpen ? 'show' : ''}`} aria-label="Main navigation">
        {links.map(([path, title, Icon]) => <NavLink key={path} to={path} onClick={() => setMobileOpen(false)} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><Icon size={17}/>{title}</NavLink>)}
      </nav>
      <div className="user-controls"><span className="hello"><span className="avatar">{user?.name?.[0] || 'U'}</span><span className="user-text"><b>{user?.name}</b><small>{user?.role?.toLowerCase()}</small></span></span><button onClick={logout} className="icon-button logout-button" title="Log out"><LogOut size={19}/></button><button className="icon-button hamburger" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Toggle navigation"><Menu size={22}/></button></div>
    </div></header><main className="container">{children}</main><footer className="footer">Evently © {new Date().getFullYear()} <span>•</span> Sprint 01 academic demo</footer>
  </div>;
}
function Notice({ type = 'error', children, onClose }) { return <div className={`notice ${type}`} role="alert">{type === 'success' ? <CheckCircle2 size={18}/> : <AlertCircle size={18}/>}<span>{children}</span>{onClose && <button aria-label="Dismiss" onClick={onClose}><X size={16}/></button>}</div>; }
function Loading() { return <div className="loading"><span className="spinner"/>Loading...</div>; }
function Empty({ icon: Icon = Ticket, title, description, action }) { return <div className="empty"><div className="empty-icon"><Icon size={26}/></div><h3>{title}</h3><p>{description}</p>{action}</div>; }
function Button({ children, variant = 'primary', className = '', ...props }) { return <button className={`btn btn-${variant} ${className}`} {...props}>{children}</button>; }
function PageHeading({ eyebrow, title, description, action }) { return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1>{description && <p>{description}</p>}</div>{action}</div>; }

function AuthPage({ register = false }) {
  const { user, signIn } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [registered, setRegistered] = useState(false);
  if (user) return <Navigate to={homeFor(user.role)} replace/>;
  const change = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  const submit = async e => {
    e.preventDefault(); setError('');
    if (register && form.password !== form.confirm) return setError('Passwords do not match.');
    setBusy(true);
    try {
      if (register) { await request('/auth/register', { method: 'POST', body: { name: form.name, email: form.email, password: form.password } }); setRegistered(true); }
      else { const result = await request('/auth/login', { method: 'POST', body: { email: form.email, password: form.password } }); signIn(result); navigate(homeFor(result.user.role)); }
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  return <div className="auth-page"><div className="auth-art"><div className="auth-art-content"><Logo/><div className="auth-illustration"><span className="floating-ticket one"><TicketCheck size={66}/></span><span className="floating-ring"/><span className="floating-dot"/><span className="floating-ticket two"><Sparkles size={30}/></span></div><h2>Great experiences<br/>start with a ticket.</h2><p>Discover events, save your spot, and make every moment count.</p><div className="art-footer"><span className="art-avatars"><i>A</i><i>S</i><i>M</i></span> One place for every event</div></div></div>
    <div className="auth-side"><div className="auth-mobile-logo"><Logo/></div><div className="auth-box">
      <span className="auth-kicker"><Sparkles size={15}/> EVENTLY PLATFORM</span>
      <h1>{register ? 'Create your account' : 'Welcome back'}</h1><p className="auth-subtitle">{register ? 'Join Evently and never miss an exciting event.' : 'Enter your details to access your events and tickets.'}</p>
      {registered ? <div className="success-card"><CheckCircle2 size={36}/><h3>Account created!</h3><p>Your account is ready. You can sign in now.</p><Link className="btn btn-primary" to="/login">Go to login <ArrowRight size={17}/></Link></div>
      : <form onSubmit={submit} className="auth-form">
        {error && <Notice>{error}</Notice>}
        {register && <label className="field"><span>Full name</span><input autoComplete="name" name="name" value={form.name} onChange={change} required minLength={2} placeholder="Your full name"/></label>}
        <label className="field"><span>Email address</span><div className="input-wrap"><Mail size={18}/><input autoComplete="email" type="email" name="email" value={form.email} onChange={change} required placeholder="you@example.com"/></div></label>
        <label className="field"><span>Password</span><div className="input-wrap"><LockKeyhole size={18}/><input autoComplete={register ? 'new-password' : 'current-password'} type={showPassword ? 'text' : 'password'} name="password" value={form.password} onChange={change} required minLength={register ? 6 : undefined} placeholder="Enter your password"/><button type="button" className="password-toggle" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div></label>
        {register && <label className="field"><span>Confirm password</span><input autoComplete="new-password" type="password" name="confirm" value={form.confirm} onChange={change} required placeholder="Repeat password"/></label>}
        <Button disabled={busy} className="submit-btn">{busy ? 'Please wait...' : register ? 'Create Account' : 'Sign In'} <ArrowRight size={17}/></Button>
      </form>}
      <p className="auth-switch">{register ? 'Already have an account?' : 'New to Evently?'} <Link to={register ? '/login' : '/register'}>{register ? 'Sign in' : 'Create an account'}</Link></p>
      {!register && <div className="demo-panel"><strong>Try demo accounts</strong><p>Use password <code>Demo123!</code> with any account below.</p><div className="demo-accounts">{['customer','organizer','admin'].map(r => <button key={r} onClick={() => setForm(f => ({ ...f, email: `${r}@evently.demo`, password: 'Demo123!' }))}>{r}</button>)}</div></div>}
    </div><p className="auth-copyright">© {new Date().getFullYear()} Evently. Made for Software Architecture & Design.</p></div>
  </div>;
}
function EventCover({ event, large = false }) { return <div className={`event-cover ${coverClass(event.id)} ${large ? 'large' : ''}`}><span className="cover-label">{eventType(event.id)}</span><span className="cover-decoration"><Ticket size={large ? 98 : 64} strokeWidth={1.3}/></span><div className="cover-orbit orbit-one"/><div className="cover-orbit orbit-two"/></div>; }
function EventCard({ event }) {
  return <article className="event-card"><Link className="card-cover-link" to={`/events/${event.id}`} aria-label={`View ${event.title}`}><EventCover event={event}/></Link><div className="event-card-body"><span className="card-date"><CalendarDays size={15}/>{prettyDate(event.startsAt)} <span>·</span> {prettyTime(event.startsAt)}</span><h3>{event.title}</h3><span className="card-location"><MapPin size={15}/>{event.location}</span><div className="card-bottom"><span className={`availability ${event.available ? '' : 'soldout'}`}><span className="availability-dot"/>{event.available ? `${event.available} spots left` : 'Fully booked'}</span><Link className="card-arrow" to={`/events/${event.id}`} aria-label={`View ${event.title}`}><ArrowRight size={19}/></Link></div></div></article>;
}
function EventsPage() {
  const [events, setEvents] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { let active = true; request('/events').then(r => active && setEvents(r.events)).catch(e => active && setError(e.message)); return () => { active = false; }; }, []);
  return <Layout><section className="hero"><div className="hero-text"><div className="hero-kicker"><Sparkles size={15}/> DISCOVER SOMETHING AMAZING</div><h1>Find your next<br/><span>great experience.</span></h1><p>Explore inspiring events, meet new people and make memories. Your next event is just a click away.</p><a className="btn hero-button" href="#upcoming">Explore Events <ArrowRight size={18}/></a></div><div className="hero-art"><div className="hero-circle circle-one"/><div className="hero-circle circle-two"/><div className="hero-pass"><div className="pass-upper"><span>ADMIT ONE</span><TicketCheck size={27}/></div><h2>GOOD TIMES<br/>AHEAD.</h2><div className="pass-bottom">EVENTLY EXPERIENCES <Sparkles size={17}/></div></div></div></section>
    <section id="upcoming" className="events-section"><PageHeading eyebrow="EXPLORE EVENTS" title="Upcoming events" description="Handpicked experiences waiting for you." action={<span className="count-pill">{events?.length ?? '—'} events</span>}/>{error && <Notice>{error}</Notice>}{!events && !error ? <Loading/> : events?.length ? <div className="events-grid">{events.map(event => <EventCard key={event.id} event={event}/>)}</div> : !error && <Empty title="No upcoming events" description="Check back later for new events!"/>}</section>
  </Layout>;
}
function EventDetailsPage() {
  const { id } = useParams();
  const token = useToken();
  const [event, setEvent] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const load = () => request(`/events/${id}`).then(r => setEvent(r.event));
  useEffect(() => { let active = true; request(`/events/${id}`).then(r => active && setEvent(r.event)).catch(e => active && setError(e.message)); return () => { active = false; }; }, [id]);
  const book = async () => { setError(''); setBusy(true); try { await request('/bookings', { method: 'POST', token, body: { eventId: event.id } }); setSuccess(true); load().catch(() => {}); } catch(e) { setError(e.message); } finally { setBusy(false); } };
  if (error && !event) return <Layout><Link className="back-link" to="/events"><ArrowLeft size={16}/> All events</Link><Notice>{error}</Notice></Layout>;
  return <Layout><Link className="back-link" to="/events"><ArrowLeft size={17}/> Back to all events</Link>{!event ? <Loading/> : <div className="detail-layout"><div><EventCover event={event} large/><div className="detail-main"><span className="eyebrow">EVENT DETAILS</span><h1>{event.title}</h1><h2>About this event</h2><p>{event.description}</p><div className="detail-info"><div><span className="detail-info-icon"><CalendarDays size={20}/></span><span><small>Date & Time</small><b>{prettyDate(event.startsAt)} at {prettyTime(event.startsAt)}</b></span></div><div><span className="detail-info-icon"><MapPin size={20}/></span><span><small>Location</small><b>{event.location}</b></span></div></div></div></div>
    <aside className="booking-panel"><span className="eyebrow">YOUR RESERVATION</span><h3>Reserve your spot</h3><p>Free entry · One ticket per person</p><div className="booking-divider"/><div className="booking-row"><span>Total capacity</span><b>{event.capacity}</b></div><div className="booking-row"><span>Tickets available</span><b>{event.available}</b></div><div className="booking-divider"/><div className="booking-price"><span>Ticket price</span><strong>FREE</strong></div>{error && <Notice>{error}</Notice>}<Button className="booking-button" onClick={book} disabled={busy || event.available <= 0 || Date.parse(event.startsAt) <= Date.now()}>{event.available <= 0 ? 'Fully Booked' : busy ? 'Reserving...' : 'Book Free Ticket'} <ArrowRight size={18}/></Button>{event.available <= 0 ? <div className="fully-booked"><MinusCircle size={16}/> This event is fully booked.</div> : <div className="book-hint"><ShieldCheck size={16}/> Instant reservation confirmation</div>}</aside></div>}
    {success && <div className="modal-backdrop"><div className="modal"><div className="modal-icon success"><Check size={31}/></div><h2>You're going!</h2><p>Your ticket has been booked successfully. You can see it under My Bookings.</p><div className="modal-actions"><Button variant="light" onClick={() => setSuccess(false)}>Stay here</Button><Link className="btn btn-primary" to="/bookings">My Bookings <ArrowRight size={17}/></Link></div></div></div>}
  </Layout>;
}
function Status({ status }) { return <span className={`status status-${status.toLowerCase()}`}><span className="status-dot"/>{status === 'CONFIRMED' ? 'Confirmed' : 'Cancelled'}</span>; }
function BookingsPage() {
  const token = useToken();
  const [bookings, setBookings] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [cancelId, setCancelId] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = () => request('/bookings/mine', { token }).then(r => setBookings(r.bookings));
  useEffect(() => { let active = true; request('/bookings/mine', { token }).then(r => active && setBookings(r.bookings)).catch(e => active && setError(e.message)); return () => { active = false; }; }, [token]);
  const cancel = async () => { setBusy(true); setError(''); try { await request(`/bookings/${cancelId}/cancel`, { token, method: 'PATCH' }); setCancelId(null); setNotice('Your booking has been cancelled successfully.'); await load(); } catch (e) { setCancelId(null); setError(e.message); } finally { setBusy(false); } };
  return <Layout><PageHeading eyebrow="YOUR TICKETS" title="My Bookings" description="All your event reservations, in one place." action={<Link to="/events" className="btn btn-primary"><Plus size={17}/> Explore Events</Link>}/>{error && <Notice>{error}</Notice>}{notice && <Notice type="success" onClose={() => setNotice('')}>{notice}</Notice>}{!bookings && !error ? <Loading/> : bookings?.length ? <div className="table-card"><div className="table-wrap"><table><thead><tr><th>Booking Reference</th><th>Event</th><th>Date & Time</th><th>Status</th><th>Action</th></tr></thead><tbody>{bookings.map(b => <tr key={b.id}><td className="reference">{bookingRef(b.id)}</td><td><strong>{b.eventTitle}</strong><small className="table-sub">{b.location}</small></td><td>{prettyDate(b.startsAt)}<small className="table-sub">{prettyTime(b.startsAt)}</small></td><td><Status status={b.status}/></td><td>{b.status === 'CONFIRMED' && new Date(b.startsAt) > new Date() ? <button className="text-action danger" onClick={() => setCancelId(b.id)}>Cancel booking</button> : <span className="muted">—</span>}</td></tr>)}</tbody></table></div></div> : !error && <Empty title="No bookings yet" description="You haven't reserved any tickets. Explore upcoming events to get started." action={<Link to="/events" className="btn btn-primary">Browse Events <ArrowRight size={17}/></Link>}/>}
    {cancelId != null && <div className="modal-backdrop"><div className="modal"><div className="modal-icon warning"><AlertCircle size={30}/></div><h2>Cancel this booking?</h2><p>Are you sure? Your reserved spot will become available for someone else.</p><div className="modal-actions"><Button variant="light" onClick={() => setCancelId(null)}>Keep Booking</Button><Button onClick={cancel} disabled={busy}>{busy ? 'Cancelling...' : 'Yes, Cancel Booking'}</Button></div></div></div>}
  </Layout>;
}
function OrganizerPage() {
  const token = useToken();
  const location = useLocation();
  const [events, setEvents] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { let active = true; request('/events/mine', { token }).then(r => active && setEvents(r.events)).catch(e => active && setError(e.message)); return () => { active = false; }; }, [token]);
  return <Layout><PageHeading eyebrow="ORGANIZER WORKSPACE" title="My Events" description="Plan meaningful experiences and manage your event listings." action={<Link to="/organizer/events/new" className="btn btn-primary"><Plus size={17}/> Create Event</Link>}/>{location.state?.created && <Notice type="success">Event created successfully!</Notice>}<div className="stat-grid"><div className="stat-card"><div className="stat-icon"><CalendarDays size={22}/></div><div><span>Total Events</span><b>{events?.length ?? '—'}</b></div></div><div className="stat-card"><div className="stat-icon"><Ticket size={22}/></div><div><span>Total Capacity</span><b>{events?.reduce((sum,e) => sum + e.capacity,0) ?? '—'}</b></div></div><div className="stat-card"><div className="stat-icon"><Users size={22}/></div><div><span>Tickets Reserved</span><b>{events?.reduce((sum,e) => sum + e.capacity - e.available,0) ?? '—'}</b></div></div></div><h2 className="section-title">Your event listings</h2>{error && <Notice>{error}</Notice>}{!events && !error ? <Loading/> : events?.length ? <div className="table-card"><div className="table-wrap"><table><thead><tr><th>Event</th><th>Date</th><th>Location</th><th>Capacity</th><th>Available</th></tr></thead><tbody>{events.map(e => <tr key={e.id}><td><strong>{e.title}</strong></td><td>{prettyDate(e.startsAt)}</td><td>{e.location}</td><td>{e.capacity}</td><td><span className="capacity-pill">{e.available} left</span></td></tr>)}</tbody></table></div></div> : !error && <Empty title="Your first event awaits" description="Create an event to share it with customers." action={<Link to="/organizer/events/new" className="btn btn-primary">Create Event</Link>}/>}</Layout>;
}
function CreateEventPage() {
  const token = useToken();
  const navigate = useNavigate();
  const [form, setForm] = useState({ title: '', description: '', date: '', time: '', location: '', capacity: '' });
  const [error, setError] = useState('');
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const change = e => { setForm(f => ({ ...f, [e.target.name]: e.target.value })); setErrors(prev => ({ ...prev, [e.target.name]: '' })); };
  const submit = async e => { e.preventDefault(); setError(''); const errs = {};
    if (!form.title.trim()) errs.title = 'Event title is required.';
    if (!form.description.trim()) errs.description = 'Description is required.';
    if (!form.location.trim()) errs.location = 'Location is required.';
    const date = new Date(`${form.date}T${form.time}`);
    if (!form.date || !form.time || !Number.isFinite(date.getTime()) || date <= new Date()) errs.date = 'Please select a future date and time.';
    if (!/^\d+$/.test(form.capacity) || Number(form.capacity) < 1) errs.capacity = 'Capacity must be greater than zero.';
    setErrors(errs); if (Object.keys(errs).length) return;
    setBusy(true); try { await request('/events', { token, method: 'POST', body: { title: form.title, description: form.description, location: form.location, startsAt: date.toISOString(), capacity: Number(form.capacity) } }); navigate('/organizer/events', { state: { created: true } }); } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  return <Layout><Link to="/organizer/events" className="back-link"><ArrowLeft size={17}/> Back to my events</Link><PageHeading eyebrow="ORGANIZER WORKSPACE" title="Create New Event" description="Fill in the details below to publish your next event."/><form className="create-card" onSubmit={submit} noValidate><div className="form-section-heading"><div className="section-icon"><CalendarDays size={22}/></div><div><h2>Event Information</h2><p>Tell customers about your event.</p></div></div>{error && <Notice>{error}</Notice>}
    <label className="field"><span>Event Title <em>*</em></span><input className={errors.title ? 'invalid' : ''} name="title" value={form.title} onChange={change} placeholder="e.g. Tech Innovation Summit"/>{errors.title && <small className="field-error">{errors.title}</small>}</label>
    <label className="field"><span>Event Description <em>*</em></span><textarea className={errors.description ? 'invalid' : ''} rows="4" name="description" value={form.description} onChange={change} placeholder="What makes this event special?"/>{errors.description && <small className="field-error">{errors.description}</small>}</label>
    <div className="form-two"><label className="field"><span>Event Date <em>*</em></span><input className={errors.date ? 'invalid' : ''} type="date" name="date" min={new Date().toISOString().slice(0,10)} value={form.date} onChange={change}/>{errors.date && <small className="field-error">{errors.date}</small>}</label><label className="field"><span>Event Time <em>*</em></span><input className={errors.date ? 'invalid' : ''} type="time" name="time" value={form.time} onChange={change}/></label></div>
    <label className="field"><span>Location <em>*</em></span><input className={errors.location ? 'invalid' : ''} name="location" value={form.location} onChange={change} placeholder="e.g. Main Auditorium"/>{errors.location && <small className="field-error">{errors.location}</small>}</label>
    <label className="field"><span>Total Ticket Capacity <em>*</em></span><input className={errors.capacity ? 'invalid' : ''} name="capacity" type="number" min="1" step="1" value={form.capacity} onChange={change} placeholder="e.g. 100"/>{errors.capacity && <small className="field-error">{errors.capacity}</small>}</label>
    <div className="form-buttons"><Link to="/organizer/events" className="btn btn-light">Cancel</Link><Button disabled={busy}>{busy ? 'Creating...' : 'Create Event'} <ArrowRight size={17}/></Button></div></form></Layout>;
}
function AdminPage() {
  const token = useToken();
  const [bookings, setBookings] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { let active = true; request('/admin/bookings', { token }).then(r => active && setBookings(r.bookings)).catch(e => active && setError(e.message)); return () => { active = false; }; }, [token]);
  const confirmed = bookings?.filter(b => b.status === 'CONFIRMED').length;
  return <Layout><PageHeading eyebrow="ADMIN WORKSPACE" title="All Bookings" description="A simple overview of all event reservations."/><div className="stat-grid"><div className="stat-card"><div className="stat-icon"><TicketCheck size={22}/></div><div><span>Total Bookings</span><b>{bookings?.length ?? '—'}</b></div></div><div className="stat-card"><div className="stat-icon"><CheckCircle2 size={22}/></div><div><span>Confirmed</span><b>{confirmed ?? '—'}</b></div></div><div className="stat-card"><div className="stat-icon"><MinusCircle size={22}/></div><div><span>Cancelled</span><b>{bookings ? bookings.length - confirmed : '—'}</b></div></div></div><h2 className="section-title">Booking records</h2>{error && <Notice>{error}</Notice>}{!bookings && !error ? <Loading/> : bookings?.length ? <div className="table-card"><div className="table-wrap"><table><thead><tr><th>Reference</th><th>Customer</th><th>Event</th><th>Event Date</th><th>Status</th></tr></thead><tbody>{bookings.map(b => <tr key={b.id}><td className="reference">{bookingRef(b.id)}</td><td><strong>{b.customerName}</strong><small className="table-sub">{b.customerEmail}</small></td><td>{b.eventTitle}</td><td>{prettyDate(b.startsAt)}</td><td><Status status={b.status}/></td></tr>)}</tbody></table></div></div> : !error && <Empty title="No bookings yet" description="Ticket reservations will appear here when customers start booking."/>}</Layout>;
}
export default function App() { return <AuthProvider><AppRoutes/></AuthProvider>; }
// Routes are nested within the provider so every page reads the same authentication state.
function AppRoutes() { const { user } = useAuth(); return <Routes>
  <Route path="/" element={<Navigate to={user ? homeFor(user.role) : '/login'} replace/>}/>
  <Route path="/login" element={<AuthPage/>}/><Route path="/register" element={<AuthPage register/>}/>
  <Route path="/events" element={<Protected role="CUSTOMER"><EventsPage/></Protected>}/>
  <Route path="/events/:id" element={<Protected role="CUSTOMER"><EventDetailsPage/></Protected>}/>
  <Route path="/bookings" element={<Protected role="CUSTOMER"><BookingsPage/></Protected>}/>
  <Route path="/organizer/events" element={<Protected role="ORGANIZER"><OrganizerPage/></Protected>}/>
  <Route path="/organizer/events/new" element={<Protected role="ORGANIZER"><CreateEventPage/></Protected>}/>
  <Route path="/admin/bookings" element={<Protected role="ADMIN"><AdminPage/></Protected>}/>
  <Route path="*" element={<Navigate to="/" replace/>}/>
</Routes>; }
