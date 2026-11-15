const express = require('express');
const jwt = require('jsonwebtoken');
const { randomBytes, scryptSync, timingSafeEqual } = require('node:crypto');
const { db, eventFields, publicUser, passwordHash } = require('./database');

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '30kb' }));
const allowedOrigin = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? '' : 'evently-local-demo-secret-change-me');
if (!JWT_SECRET) throw new Error('Set JWT_SECRET in production');
const failure = (res, status, error) => res.status(status).json({ error });
const validEmail = email => typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
function passwordMatches(password, stored) {
  try {
    const [salt, hash] = stored.split(':');
    const supplied = scryptSync(password, salt, 64);
    return timingSafeEqual(Buffer.from(hash, 'hex'), supplied);
  } catch { return false; }
}
function auth(...roles) {
  return (req, res, next) => {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!token) return failure(res, 401, 'Please log in to continue.');
    try {
      const payload = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.sub);
      if (!user) return failure(res, 401, 'Account not found.');
      if (roles.length && !roles.includes(user.role)) return failure(res, 403, 'You do not have permission to do that.');
      req.user = user;
      next();
    } catch { return failure(res, 401, 'Session expired. Please log in again.'); }
  };
}
const signToken = user => jwt.sign({ sub: String(user.id), role: user.role }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '8h' });

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.post('/api/auth/register', (req, res) => {
  const { name, email, password } = req.body || {};
  if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 80 || !validEmail(email) || typeof password !== 'string' || password.length < 6)
    return failure(res, 400, 'Enter a name, a valid email, and a password of at least 6 characters.');
  try {
    const result = db.prepare('INSERT INTO users (full_name,email,password_hash,role) VALUES (?,?,?,?)')
      .run(name.trim(), email.trim().toLowerCase(), passwordHash(password), 'CUSTOMER');
    res.status(201).json({ message: 'Account created successfully.', user: { id: Number(result.lastInsertRowid), name: name.trim(), email: email.trim().toLowerCase(), role: 'CUSTOMER' } });
  } catch (error) {
    if (error.message.includes('UNIQUE')) return failure(res, 409, 'An account with this email already exists.');
    throw error;
  }
});
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!validEmail(email) || typeof password !== 'string') return failure(res, 400, 'Enter your email and password.');
  const user = db.prepare('SELECT * FROM users WHERE email=?').get(email.trim().toLowerCase());
  if (!user || !passwordMatches(password, user.password_hash)) return failure(res, 401, 'Invalid email or password.');
  res.json({ token: signToken(user), user: publicUser(user) });
});
app.get('/api/auth/me', auth(), (req, res) => res.json({ user: publicUser(req.user) }));

// Organizer route must precede :id.
app.get('/api/events/mine', auth('ORGANIZER'), (req, res) => {
  const events = db.prepare(`SELECT ${eventFields} FROM events e WHERE e.organizer_id=? ORDER BY e.starts_at DESC`).all(req.user.id);
  res.json({ events });
});
app.get('/api/events', (_req, res) => {
  const events = db.prepare(`SELECT ${eventFields} FROM events e WHERE e.starts_at >= ? ORDER BY e.starts_at ASC`).all(new Date().toISOString());
  res.json({ events });
});
app.get('/api/events/:id', (req, res) => {
  const event = db.prepare(`SELECT ${eventFields} FROM events e WHERE e.id=?`).get(Number(req.params.id));
  if (!event) return failure(res, 404, 'Event not found.');
  res.json({ event });
});
app.post('/api/events', auth('ORGANIZER'), (req, res) => {
  const { title, description, startsAt, location, capacity } = req.body || {};
  const timestamp = Date.parse(startsAt);
  if (typeof title !== 'string' || !title.trim() || title.length > 120 || typeof description !== 'string' || !description.trim() || description.length > 1500 || typeof location !== 'string' || !location.trim() || location.length > 120 || !Number.isFinite(timestamp) || timestamp <= Date.now() || !Number.isInteger(capacity) || capacity < 1 || capacity > 100000)
    return failure(res, 400, 'Provide valid event details, a future date, and a positive ticket capacity.');
  const inserted = db.prepare('INSERT INTO events (organizer_id,title,description,starts_at,location,capacity) VALUES (?,?,?,?,?,?)')
    .run(req.user.id, title.trim(), description.trim(), new Date(timestamp).toISOString(), location.trim(), capacity);
  const event = db.prepare(`SELECT ${eventFields} FROM events e WHERE e.id=?`).get(Number(inserted.lastInsertRowid));
  res.status(201).json({ message: 'Event created successfully.', event });
});

app.post('/api/bookings', auth('CUSTOMER'), (req, res) => {
  const eventId = Number(req.body?.eventId);
  if (!Number.isSafeInteger(eventId) || eventId < 1) return failure(res, 400, 'Select a valid event.');
  try {
    db.exec('BEGIN IMMEDIATE');
    const event = db.prepare(`SELECT ${eventFields} FROM events e WHERE e.id=?`).get(eventId);
    if (!event) { db.exec('ROLLBACK'); return failure(res, 404, 'Event not found.'); }
    if (Date.parse(event.startsAt) <= Date.now()) { db.exec('ROLLBACK'); return failure(res, 400, 'This event has already started.'); }
    const existing = db.prepare("SELECT id FROM bookings WHERE event_id=? AND customer_id=? AND status='CONFIRMED'").get(eventId, req.user.id);
    if (existing) { db.exec('ROLLBACK'); return failure(res, 409, 'You already have a ticket for this event.'); }
    if (event.available <= 0) { db.exec('ROLLBACK'); return failure(res, 409, 'This event is fully booked.'); }
    const created = db.prepare("INSERT INTO bookings (customer_id,event_id,status) VALUES (?,?,'CONFIRMED')").run(req.user.id, eventId);
    db.exec('COMMIT');
    return res.status(201).json({ message: 'Ticket booked successfully!', bookingId: Number(created.lastInsertRowid) });
  } catch (error) { if (db.isTransaction) db.exec('ROLLBACK'); throw error; }
});

app.get('/api/bookings/mine', auth('CUSTOMER'), (req, res) => {
  const bookings = db.prepare(`SELECT b.id, b.status, b.created_at AS createdAt, e.id AS eventId,
    e.title AS eventTitle, e.starts_at AS startsAt, e.location
    FROM bookings b JOIN events e ON b.event_id=e.id WHERE b.customer_id=? ORDER BY b.id DESC`).all(req.user.id);
  res.json({ bookings });
});
app.patch('/api/bookings/:id/cancel', auth('CUSTOMER'), (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id)) return failure(res, 400, 'Invalid booking.');
  try {
    db.exec('BEGIN IMMEDIATE');
    const booking = db.prepare('SELECT b.*,e.starts_at AS startsAt FROM bookings b JOIN events e ON e.id=b.event_id WHERE b.id=? AND b.customer_id=?').get(id, req.user.id);
    if (!booking) { db.exec('ROLLBACK'); return failure(res, 404, 'Booking not found.'); }
    if (booking.status !== 'CONFIRMED') { db.exec('ROLLBACK'); return failure(res, 400, 'This ticket is already cancelled.'); }
    if (Date.parse(booking.startsAt) <= Date.now()) { db.exec('ROLLBACK'); return failure(res, 400, 'You cannot cancel a ticket after the event starts.'); }
    db.prepare("UPDATE bookings SET status='CANCELLED' WHERE id=?").run(id);
    db.exec('COMMIT');
    return res.json({ message: 'Booking cancelled. The ticket is available again.' });
  } catch (error) { if (db.isTransaction) db.exec('ROLLBACK'); throw error; }
});
app.get('/api/admin/bookings', auth('ADMIN'), (_req, res) => {
  const bookings = db.prepare(`SELECT b.id, b.status, b.created_at AS createdAt,
      u.full_name AS customerName, u.email AS customerEmail,
      e.title AS eventTitle, e.starts_at AS startsAt
      FROM bookings b JOIN users u ON u.id=b.customer_id
      JOIN events e ON e.id=b.event_id ORDER BY b.id DESC`).all();
  res.json({ bookings });
});
app.use((_req, res) => failure(res, 404, 'Endpoint not found.'));
app.use((error, _req, res, _next) => {
  console.error(error);
  failure(res, 500, 'Something went wrong. Please try again.');
});
if (require.main === module) {
  const port = Number(process.env.PORT || 4000);
  app.listen(port, () => console.log(`Evently API running at http://localhost:${port}`));
}
module.exports = app;
