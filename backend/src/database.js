const { DatabaseSync } = require('node:sqlite');
const { mkdirSync } = require('node:fs');
const path = require('node:path');
const { scryptSync, randomBytes } = require('node:crypto');

function passwordHash(password) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}

const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'evently.sqlite');
if (dbPath !== ':memory:') mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new DatabaseSync(dbPath);
db.exec(`
  PRAGMA journal_mode=WAL;
  PRAGMA foreign_keys=ON;
  PRAGMA busy_timeout=5000;
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('CUSTOMER','ORGANIZER','ADMIN')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    organizer_id INTEGER NOT NULL REFERENCES users(id),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    starts_at TEXT NOT NULL,
    location TEXT NOT NULL,
    capacity INTEGER NOT NULL CHECK(capacity > 0),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL REFERENCES users(id),
    event_id INTEGER NOT NULL REFERENCES events(id),
    status TEXT NOT NULL DEFAULT 'CONFIRMED' CHECK(status IN ('CONFIRMED','CANCELLED')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_bookings_event ON bookings(event_id, status);
  CREATE INDEX IF NOT EXISTS idx_bookings_customer ON bookings(customer_id);
`);

function seed() {
  const accounts = [
    ['Demo Customer', 'customer@evently.demo', 'CUSTOMER'],
    ['Event Organizer', 'organizer@evently.demo', 'ORGANIZER'],
    ['System Admin', 'admin@evently.demo', 'ADMIN']
  ];
  const insertUser = db.prepare('INSERT OR IGNORE INTO users (full_name,email,password_hash,role) VALUES (?,?,?,?)');
  for (const [name, email, role] of accounts) insertUser.run(name, email, passwordHash('Demo123!'), role);

  if (db.prepare('SELECT COUNT(*) AS n FROM events').get().n > 0) return;
  const organizer = db.prepare("SELECT id FROM users WHERE role='ORGANIZER' LIMIT 1").get();
  const samples = [
    ['Tech Innovation Summit', 'A gathering of builders and innovators exploring the future of technology, products, and ideas.', 9, 'Convention Hall, Islamabad', 120],
    ['University Music Night', 'An evening of campus music, great energy, and memorable performances.', 13, 'University Auditorium', 90],
    ['AI & Robotics Workshop', 'A friendly hands-on introduction to artificial intelligence and robotics.', 17, 'Computer Science Lab', 45],
    ['Career Development Seminar', 'Hear practical career advice and learn how to stand out in interviews.', 21, 'Main Lecture Hall', 75],
    ['Startup Networking Event', 'Connect with students, founders, and people building exciting ideas.', 26, 'Innovation Center', 60],
    ['Creative Photography Workshop', 'Explore photography basics through practical exercises and creative tips.', 32, 'Arts Studio', 35]
  ];
  const insertEvent = db.prepare('INSERT INTO events (organizer_id,title,description,starts_at,location,capacity) VALUES (?,?,?,?,?,?)');
  for (const [title, description, days, location, capacity] of samples) {
    const date = new Date(Date.now() + days * 86400000);
    date.setUTCHours(10, 0, 0, 0);
    insertEvent.run(organizer.id, title, description, date.toISOString(), location, capacity);
  }
}
seed();

const eventFields = `e.id, e.organizer_id AS organizerId, e.title, e.description,
 e.starts_at AS startsAt, e.location, e.capacity,
 (e.capacity - (SELECT COUNT(*) FROM bookings b WHERE b.event_id=e.id AND b.status='CONFIRMED')) AS available`;
function publicUser(user) { return { id: user.id, name: user.full_name, email: user.email, role: user.role }; }
module.exports = { db, eventFields, publicUser, passwordHash };
