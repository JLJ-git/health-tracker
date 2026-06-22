const webpush = require('web-push');

const ALERTS = [
  { hh:12, mm:0,  title:'Health Tracker', body:'Break your fast, update your tracker and eat lunch' },
  { hh:18, mm:0,  title:'Dinner Time',    body:'Time to eat dinner'                                  },
  { hh:20, mm:0,  title:'Start Fasting',  body:'Nothing except water after this point'              },
  { hh:20, mm:30, title:'Bed Time',       body:'Time to head to bed'                                },
  { hh:21, mm:0,  title:'Lights Out',     body:'Sleep time — lights out'                            },
];

webpush.setVapidDetails(
  'mailto:jmlittlejohns@hotmail.co.uk',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

function getLondonTime() {
  const now  = new Date();
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', hour12: false
  }).formatToParts(now);
  return {
    hh: parseInt(parts.find(p => p.type === 'hour').value),
    mm: parseInt(parts.find(p => p.type === 'minute').value),
  };
}

async function fetchSubscriptions() {
  const res  = await fetch(`https://api.github.com/gists/${process.env.GIST_ID}`, {
    headers: { Authorization: `token ${process.env.GIST_TOKEN}`, Accept: 'application/vnd.github.v3+json' }
  });
  const data = await res.json();
  try { return JSON.parse(data.files['push-subscriptions.json']?.content || '[]'); } catch { return []; }
}

async function saveSubscriptions(subs) {
  await fetch(`https://api.github.com/gists/${process.env.GIST_ID}`, {
    method: 'PATCH',
    headers: { Authorization: `token ${process.env.GIST_TOKEN}`, 'Content-Type': 'application/json', Accept: 'application/vnd.github.v3+json' },
    body: JSON.stringify({ files: { 'push-subscriptions.json': { content: JSON.stringify(subs) } } })
  });
}

async function main() {
  const { hh, mm } = getLondonTime();
  console.log(`London time: ${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}`);

  const alert = ALERTS.find(a => a.hh === hh && a.mm === mm);
  if (!alert) { console.log('No alert at this time — exiting'); return; }

  console.log(`Sending: ${alert.title} — ${alert.body}`);

  const subscriptions = await fetchSubscriptions();
  if (!subscriptions.length) { console.log('No subscriptions'); return; }

  const payload = JSON.stringify({ title: alert.title, body: alert.body });
  const keep    = [];

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(sub, payload);
      keep.push(sub);
      console.log('Sent to', sub.endpoint.slice(0, 60) + '…');
    } catch (err) {
      if (err.statusCode === 410) {
        console.log('Removed expired subscription');
      } else {
        keep.push(sub); // keep on transient errors
        console.warn('Send failed:', err.statusCode, err.body);
      }
    }
  }

  if (keep.length < subscriptions.length) await saveSubscriptions(keep);
  console.log(`Done: ${keep.length}/${subscriptions.length} active`);
}

main().catch(err => { console.error(err); process.exit(1); });
