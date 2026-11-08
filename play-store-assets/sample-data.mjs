// Invented sample data for the Driver store screenshots: a made-up driver and fictional loads, customers,
// messages and fuel stops. Nothing here is a real person or shipment. Shapes follow the driver-portal API.
const now = new Date();
// wall time h:m on (the zone's today + dayOffset), in a zone `off` hours behind UTC (CST 6, EST 5)
const at = (dayOffset, h, m = 0, off = 6) => { const d = new Date(now.getTime() - off * 3600000); d.setUTCDate(d.getUTCDate() + dayOffset); d.setUTCHours(h + off, m, 0, 0); return d.toISOString(); };
export const DRIVER = { id: 'drv-demo-1', name: 'Marcus Bell', phone: '5550104477', email: null, truck: 'T-104', trailer: 'TR-502' };
export const LOADS = [
  { id: 'ld-214', shipment_number: 'RR-2641', trip_number: '000214', status: 'IN_TRANSIT', pickup_location_name: 'Ironclad Steel', pickup_city: 'Chicago', pickup_state: 'IL', delivery_location_name: 'Lakeshore Manufacturing', delivery_city: 'Indianapolis', delivery_state: 'IN', pickup_date: at(0, 7, 30), delivery_date: at(0, 15, 0, 5), delivery_scheduled_at: at(0, 15, 0, 5), pickup_timezone: 'America/Chicago', delivery_timezone: 'America/Indiana/Indianapolis', commodity: 'Steel coils', weight: 38400, can_open: true },
  { id: 'ld-219', shipment_number: 'RR-2648', trip_number: '000219', status: 'DISPATCHED', pickup_location_name: 'Prairie Paper Co', pickup_city: 'Gary', pickup_state: 'IN', delivery_location_name: 'Crossroads Distribution', delivery_city: 'Louisville', delivery_state: 'KY', pickup_date: at(1, 6, 0), delivery_date: at(1, 14, 30, 5), pickup_timezone: 'America/Chicago', delivery_timezone: 'America/Kentucky/Louisville', commodity: 'Paper rolls', weight: 41200, can_open: true },
  { id: 'ld-223', shipment_number: 'RR-2652', trip_number: '000223', status: 'DISPATCHED', pickup_location_name: 'Vista Beverages', pickup_city: 'Joliet', pickup_state: 'IL', delivery_location_name: 'Music City Wholesale', delivery_city: 'Nashville', delivery_state: 'TN', pickup_date: at(2, 8, 0), delivery_date: at(3, 9, 0), pickup_timezone: 'America/Chicago', delivery_timezone: 'America/Chicago', commodity: 'Canned beverages', weight: 39800, can_open: false },
  { id: 'ld-207', shipment_number: 'RR-2633', trip_number: '000207', status: 'DELIVERED', pickup_location_name: 'Great Lakes Glass', pickup_city: 'Toledo', pickup_state: 'OH', delivery_location_name: 'Windy City Supply', delivery_city: 'Chicago', delivery_state: 'IL', pickup_date: at(-1, 6, 30, 5), delivery_date: at(-1, 13, 0), pickup_timezone: 'America/New_York', delivery_timezone: 'America/Chicago', commodity: 'Glass panels', weight: 27600, can_open: true },
];

// ---- detail, workflow, messages, fuel (invented) ----
const L = LOADS[0];
export const DETAIL = {
  id: L.id, shipment_number: L.shipment_number, trip_number: L.trip_number, status: 'IN_TRANSIT',
  pickup_location_name: L.pickup_location_name, pickup_city: L.pickup_city, pickup_state: L.pickup_state, pickup_address: '1400 S Iron Way',
  delivery_location_name: L.delivery_location_name, delivery_city: L.delivery_city, delivery_state: L.delivery_state, delivery_address: '8800 Lakeshore Pkwy',
  pickup_date: L.pickup_date, delivery_date: null, delivery_scheduled_at: L.delivery_scheduled_at, pickup_timezone: L.pickup_timezone, delivery_timezone: L.delivery_timezone,
  commodity: L.commodity, weight: L.weight, total_pieces: 12, customer_name: 'Lakeshore Manufacturing', truck_number: 'T-104', trailer_number: 'TR-502', trailer_id: 'tr-502',
  notes: 'Check in at the guard shack. Dock 7.', documents: [
    { id: 'doc-1', name: 'BOL RR-2641.pdf', type: 'BOL', created_at: at(0, 8, 40), mime_type: 'application/pdf', file_size: 182000 },
    { id: 'doc-2', name: 'Freight photo 1.jpg', type: 'FREIGHT_PHOTO', created_at: at(0, 8, 35), mime_type: 'image/jpeg', file_size: 412000 },
  ],
  stops: [
    { id: 'st-1', stop_type: 'PICKUP', sequence: 1, route_ordinal: 1, location_name: L.pickup_location_name, address: '1400 S Iron Way', city: 'Chicago', state: 'IL', zip: '60608', scheduled_at: L.pickup_date, timezone: L.pickup_timezone, reference: 'PO 55812', notes: null, pieces: 12, weight: L.weight },
    { id: 'st-2', stop_type: 'DELIVERY', sequence: 2, route_ordinal: 2, location_name: L.delivery_location_name, address: '8800 Lakeshore Pkwy', city: 'Indianapolis', state: 'IN', zip: '46241', scheduled_at: L.delivery_scheduled_at, timezone: L.delivery_timezone, reference: 'PO 55812', notes: 'Dock 7', pieces: 12, weight: L.weight },
  ],
  trip_loads: [], pickup_workflow_complete: true, reference: 'PO 55812', twins: [], identity_alerts: [],
};
const step = (id, step_key, phase, step_order, label, input_type, status, completed_at, stop) => ({ id, step_key, phase, status, completed_at, step_order, label, input_type, data: null, shipment_stop_id: stop, stop_sequence: stop === 'st-1' ? 1 : stop === 'st-2' ? 2 : null, stop_label: stop === 'st-1' ? 'Pickup' : stop === 'st-2' ? 'Delivery' : null });
export const WORKFLOW = {
  phase: 'delivery', pickup_complete: true, delivery_complete: false,
  steps: [
    step('w1', 'pretrip_inspection', 'pre_pickup', -1, 'Pre-Trip Inspection', 'inspection', 'completed', at(0, 6, 40), null),
    step('w2', 'trailer_photos', 'pre_pickup', 0, 'Trailer Condition Photos', 'camera', 'completed', at(0, 6, 48), null),
    step('w3', 'arrived_pu', 'pickup', 1, 'Arrived at Pickup', 'button', 'completed', at(0, 7, 22), 'st-1'),
    step('w4', 'loaded', 'pickup', 2, 'Freight Loaded & Secured', 'button', 'completed', at(0, 8, 31), 'st-1'),
    step('w5', 'freight_photos', 'pickup', 3, 'Freight Photos', 'camera', 'completed', at(0, 8, 35), 'st-1'),
    step('w6', 'seal', 'pickup', 4, 'Seal Number / Photo', 'seal', 'completed', at(0, 8, 37), 'st-1'),
    step('w7', 'bol', 'pickup', 5, 'Bill of Lading', 'camera', 'completed', at(0, 8, 40), 'st-1'),
    step('w8', 'arrived_del', 'delivery', 1, 'Arrived at Delivery', 'button', 'pending', null, 'st-2'),
    step('w9', 'empty', 'delivery', 2, 'Unloaded / Departed', 'button', 'pending', null, 'st-2'),
    step('w10', 'signed_bol', 'delivery', 3, 'Signed Bill of Lading', 'camera', 'pending', null, 'st-2'),
  ],
};
const msg = (id, who, content, mins) => ({ id, thread_id: 'th-1', driver_id: DRIVER.id, shipment_id: L.id, sender_type: who === 'me' ? 'DRIVER' : 'USER', sender_user_id: who === 'me' ? null : 'u-dispatch', sender_driver_id: who === 'me' ? DRIVER.id : null, sender_name: who === 'me' ? DRIVER.name : 'Dana (Dispatch)', content, attachment_url: null, created_at: new Date(Date.now() - mins * 60000).toISOString() });
export const THREAD = {
  thread_id: 'th-1', driver_id: DRIVER.id, current_dispatcher_user_id: 'u-dispatch', latest_shipment_id: L.id, routing_mode: 'assigned_dispatcher',
  active_loads: [{ shipment_id: L.id, shipment_number: L.shipment_number, trip_number: L.trip_number, pickup_city: 'Chicago', delivery_city: 'Indianapolis', status: 'IN_TRANSIT', pickup_state: 'IL', delivery_state: 'IN', pickup_date: L.pickup_date, delivery_scheduled_at: L.delivery_scheduled_at }],
  messages: [
    msg('m1', 'me', 'Loaded and sealed at Ironclad. Seal 4471920. Rolling to Indy.', 95),
    msg('m2', 'them', 'Thanks Marcus. Receiver confirmed dock 7, check in at the guard shack.', 88),
    msg('m3', 'me', 'Copy. ETA about 2:30 their time.', 40),
    msg('m4', 'them', 'Perfect. Your next load is Gary to Louisville tomorrow at 6:00, details are in the app.', 12),
  ],
  has_more: false,
};
const fill = (id, d, h, name, city, st, gal, ppg) => ({ id, transaction_date: at(d, h, 15), location_name: name, location_city: city, location_state: st, unit_number: 'T-104', fuel_type: 'Diesel', gallons: gal, price_per_gallon: ppg, total_cost: Math.round(gal * ppg * 100) / 100 });
export const FUEL_TX = [
  fill('f1', -1, 17, 'Pilot Travel Center', 'Gary', 'IN', 112.4, 3.479),
  fill('f2', -3, 9, "Love's Travel Stop", 'Effingham', 'IL', 128.9, 3.399),
  fill('f3', -5, 14, 'Flying J', 'Columbus', 'OH', 96.2, 3.529),
  fill('f4', -8, 7, 'Pilot Travel Center', 'Joliet', 'IL', 131.7, 3.449),
];
export const FUEL_STATS = { cost_visible: true, transaction_count: 14, total_gallons: 1582.6, period_days: 90, total_spend: 5459.97, weighted_ppg: 3.45, fuel_stop_mode: 'recommend', prices_visible: true };
export const FUEL_SAVINGS = { period_days: 30, period_start: at(-30, 0), period_end: at(0, 0), prices_visible: true, gallons: 469.2, discount_gallons: 372.8, discount_gallons_pct: 79.5, fills: 4, scored_fills: 4, compliant_fills: 3, compliance_pct: 75, savings_vs_retail_usd: 61.4, lost_vs_plan_usd: 4.1, recent: [] };
export default {
  [`GET /loads/${L.id}`]: DETAIL,
  [`GET /loads/${L.id}/workflow`]: WORKFLOW,
  'GET /messages/thread': THREAD,
  'GET /fuel/transactions': FUEL_TX,
  'GET /fuel/stats': FUEL_STATS,
  'GET /fuel/savings': FUEL_SAVINGS,
};
