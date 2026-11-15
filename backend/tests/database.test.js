const test = require('node:test');
const assert = require('node:assert/strict');

// This test runs without installing any npm dependencies.
process.env.DB_PATH = ':memory:';
const { db, eventFields } = require('../src/database');
const eventById = db.prepare(`SELECT ${eventFields} FROM events e WHERE e.id=?`);

test('seeds customer, organizer, admin, and six future events', () => {
  const roles = db.prepare('SELECT role FROM users ORDER BY role').all().map(u => u.role);
  assert.deepEqual(roles, ['ADMIN', 'CUSTOMER', 'ORGANIZER']);
  const events = db.prepare(`SELECT ${eventFields} FROM events e`).all();
  assert.equal(events.length, 6);
  assert.ok(events.every(e => e.available === e.capacity));
  assert.ok(events.every(e => Date.parse(e.startsAt) > Date.now()));
});

test('confirmed bookings reduce availability and cancellation restores it', () => {
  const customer = db.prepare("SELECT id FROM users WHERE role='CUSTOMER'").get();
  const event = db.prepare(`SELECT ${eventFields} FROM events e LIMIT 1`).get();
  const result = db.prepare("INSERT INTO bookings(customer_id,event_id,status) VALUES (?,?,'CONFIRMED')").run(customer.id, event.id);
  assert.equal(eventById.get(event.id).available, event.capacity - 1);
  db.prepare("UPDATE bookings SET status='CANCELLED' WHERE id=?").run(result.lastInsertRowid);
  assert.equal(eventById.get(event.id).available, event.capacity);
});
