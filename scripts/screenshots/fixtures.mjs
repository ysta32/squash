// HTML for the screenshots attached to the demo bugs: screens of "Lumen", a fictional analytics
// app, each showing the problem its bug describes.

const font = `font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;`

const shell = (body, { dark = false } = {}) => `<!doctype html><html><head><style>
  * { box-sizing: border-box; margin: 0; }
  body { ${font} background: ${dark ? '#0f1117' : '#f6f7fb'}; color: ${dark ? '#e5e7eb' : '#111827'}; width: 100vw; height: 100vh; overflow: hidden; }
  .nav { display: flex; align-items: center; gap: 28px; height: 56px; padding: 0 28px; background: ${dark ? '#151821' : '#fff'}; border-bottom: 1px solid ${dark ? '#262a36' : '#e5e7eb'}; font-size: 14px; color: ${dark ? '#9ca3af' : '#6b7280'}; }
  .logo { display: flex; align-items: center; gap: 8px; font-weight: 700; color: ${dark ? '#fff' : '#111827'}; font-size: 16px; }
  .logo i { width: 22px; height: 22px; border-radius: 7px; background: linear-gradient(135deg, #f59e0b, #ef4444); display: block; }
  .card { background: ${dark ? '#151821' : '#fff'}; border: 1px solid ${dark ? '#262a36' : '#e5e7eb'}; border-radius: 14px; }
  .muted { color: ${dark ? '#9ca3af' : '#6b7280'}; }
  .active { color: ${dark ? '#fff' : '#111827'}; font-weight: 600; }
</style></head><body>${body}</body></html>`

const nav = (active) =>
  `<div class="nav"><div class="logo"><i></i>Lumen</div>${[
    'Overview',
    'Revenue',
    'Funnels',
    'Customers',
    'Settings',
  ]
    .map((n) => `<span class="${n === active ? 'active' : ''}">${n}</span>`)
    .join('')}</div>`

export const checkoutMobile = shell(`
  <div style="padding: 18px 20px; display:flex; align-items:center; justify-content:space-between; background:#fff; border-bottom:1px solid #e5e7eb">
    <div class="logo"><i></i>Lumen</div><span class="muted" style="font-size:14px">Step 2 of 2</span>
  </div>
  <div style="padding: 22px 20px">
    <div style="font-size:24px; font-weight:700; letter-spacing:-0.02em">Upgrade to Growth</div>
    <div class="muted" style="margin-top:6px; font-size:14px">Billed monthly. Cancel anytime.</div>
    <div class="card" style="margin-top:20px; padding:18px">
      ${[
        ['Growth plan', '$49.00'],
        ['3 extra seats', '$27.00'],
        ['Tax', '$6.08'],
      ]
        .map(
          ([a, b]) =>
            `<div style="display:flex; justify-content:space-between; padding:9px 0; font-size:15px; border-bottom:1px solid #f1f2f6"><span>${a}</span><span>${b}</span></div>`,
        )
        .join('')}
      <div style="display:flex; justify-content:space-between; padding-top:14px; font-size:17px; font-weight:700"><span>Total</span><span>$82.08</span></div>
    </div>
    <div class="card" style="margin-top:16px; padding:16px; font-size:15px">
      <div class="muted" style="font-size:12px; text-transform:uppercase; letter-spacing:.06em">Card</div>
      <div style="margin-top:8px; padding:12px; border:1px solid #e5e7eb; border-radius:10px">•••• •••• •••• 4242 &nbsp; <span class="muted">12/28</span></div>
    </div>
  </div>
  <div style="position:absolute; left:0; right:0; bottom:0; padding:16px 20px 30px; background:#fff; border-top:1px solid #e5e7eb">
    <div style="height:52px; border-radius:12px; background:#111827; color:#fff; display:flex; align-items:center; justify-content:center; font-weight:600; font-size:16px">Pay now · $82.08</div>
  </div>
  <div style="position:absolute; left:12px; right:12px; bottom:22px; padding:16px; border-radius:14px; background:#1f2937; color:#f9fafb; font-size:14px; line-height:1.45; box-shadow:0 10px 30px rgba(0,0,0,.25)">
    We use cookies to improve your experience and measure performance.
    <div style="display:flex; gap:8px; margin-top:12px">
      <span style="flex:1; text-align:center; padding:10px; border-radius:9px; background:#f9fafb; color:#111827; font-weight:600">Accept all</span>
      <span style="flex:1; text-align:center; padding:10px; border-radius:9px; border:1px solid #4b5563">Settings</span>
    </div>
  </div>
`)

export const checkoutDesktop = shell(`
  ${nav('Settings')}
  <div style="padding:36px 48px; display:grid; grid-template-columns: 1.3fr 1fr; gap:28px">
    <div>
      <div style="font-size:28px; font-weight:700; letter-spacing:-0.02em">Plans</div>
      <div class="muted" style="margin-top:6px">You're on Starter. Upgrade for more seats and longer history.</div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-top:24px">
        ${[
          ['Starter', '$0', 'Current plan', false],
          ['Growth', '$49', 'Selected', true],
        ]
          .map(
            ([n, p, s, on]) =>
              `<div class="card" style="padding:22px; ${on ? 'border:2px solid #111827' : ''}"><div style="font-weight:600">${n}</div><div style="font-size:32px; font-weight:700; margin-top:10px">${p}<span class="muted" style="font-size:14px; font-weight:400"> /mo</span></div><div class="muted" style="margin-top:14px; font-size:13px">${s}</div></div>`,
          )
          .join('')}
      </div>
    </div>
    <div class="card" style="padding:22px; position:relative">
      <div style="font-weight:600">Summary</div>
      ${[
        ['Growth plan', '$49.00'],
        ['3 extra seats', '$27.00'],
        ['Tax', '$6.08'],
      ]
        .map(
          ([a, b]) =>
            `<div style="display:flex; justify-content:space-between; padding:10px 0; font-size:14px; border-bottom:1px solid #f1f2f6"><span>${a}</span><span>${b}</span></div>`,
        )
        .join('')}
      <div style="height:46px; margin-top:18px; border-radius:10px; background:#111827; color:#fff; display:flex; align-items:center; justify-content:center; font-weight:600">Pay now · $82.08</div>
    </div>
  </div>
  <div style="position:absolute; left:0; right:0; bottom:0; padding:16px 48px; background:#1f2937; color:#f9fafb; font-size:14px; display:flex; align-items:center; gap:16px">
    <span style="flex:1">We use cookies to improve your experience and measure performance.</span>
    <span style="padding:9px 16px; border-radius:9px; background:#f9fafb; color:#111827; font-weight:600">Accept all</span>
  </div>
`)

function chart() {
  const pts = Array.from(
    { length: 90 },
    (_, i) => 120 + i * 2.2 + Math.sin(i / 4) * 26 + Math.sin(i / 1.7) * 9,
  )
  const w = 1060
  const h = 300
  const x = (i) => 50 + (i / 89) * (w - 70)
  const y = (v) => h - 20 - ((v - 80) / 300) * (h - 40)
  const line = pts.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const area = `${line} L${x(89)},${h - 20} L${x(0)},${h - 20} Z`
  const labels = pts
    .map((_, i) => {
      const d = new Date(2026, 6, 8 + i)
      return `<text x="${x(i)}" y="${h + 4}" font-size="12" fill="#6b7280" text-anchor="middle">${d.toLocaleString('en', { month: 'short' })} ${d.getDate()}</text>`
    })
    .filter((_, i) => i % 2 === 0)
    .join('')
  return `<svg width="${w}" height="${h + 20}" style="display:block">
    <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6366f1" stop-opacity=".25"/><stop offset="1" stop-color="#6366f1" stop-opacity="0"/></linearGradient></defs>
    ${[0, 1, 2, 3].map((i) => `<line x1="50" x2="${w - 20}" y1="${20 + i * 87}" y2="${20 + i * 87}" stroke="#eef0f4"/>`).join('')}
    <path d="${area}" fill="url(#g)"/><path d="${line}" fill="none" stroke="#6366f1" stroke-width="2.5"/>
    ${labels}
    <rect x="40" y="${h - 14}" width="${w - 50}" height="30" fill="none" stroke="#ef4444" stroke-width="3" rx="8"/>
  </svg>`
}

export const chartLabels = shell(`
  ${nav('Revenue')}
  <div style="padding:32px 40px">
    <div style="display:flex; align-items:end; justify-content:space-between">
      <div><div class="muted" style="font-size:13px">Monthly recurring revenue</div><div style="font-size:34px; font-weight:700; letter-spacing:-0.02em; margin-top:4px">$48,290 <span style="font-size:15px; color:#059669; font-weight:600">+12.4%</span></div></div>
      <div style="display:flex; gap:4px; padding:4px; background:#eef0f4; border-radius:10px; font-size:13px">${['7d', '30d', '90d', '1y'].map((r) => `<span style="padding:6px 12px; border-radius:7px; ${r === '90d' ? 'background:#fff; font-weight:600; box-shadow:0 1px 2px rgba(0,0,0,.08)' : 'color:#6b7280'}">${r}</span>`).join('')}</div>
    </div>
    <div class="card" style="margin-top:22px; padding:22px 18px">${chart()}</div>
  </div>
`)

export const tooltipDark = shell(
  `
  ${nav('Funnels')}
  <div style="padding:32px 40px">
    <div style="font-size:24px; font-weight:700">Signup funnel</div>
    <div class="muted" style="font-size:14px; margin-top:4px">Last 30 days · 12,480 visitors</div>
    <div class="card" style="margin-top:22px; padding:28px; display:flex; align-items:end; gap:26px; height:330px; position:relative">
      ${[
        [100, 'Visited'],
        [62, 'Signed up'],
        [41, 'Created project'],
        [23, 'Invited team'],
        [14, 'Upgraded'],
      ]
        .map(
          ([v, l]) =>
            `<div style="flex:1; display:flex; flex-direction:column; justify-content:end; height:100%"><div style="height:${v * 2.3}px; border-radius:8px 8px 0 0; background:linear-gradient(#818cf8,#4f46e5)"></div><div style="margin-top:10px; font-size:13px" class="muted">${l}</div></div>`,
        )
        .join('')}
      <div style="position:absolute; left:39%; top:70px; padding:12px 14px; border-radius:10px; background:#f9fafb; box-shadow:0 8px 24px rgba(0,0,0,.4); font-size:14px; color:#e5e7eb; width:210px; line-height:1.5">
        <div style="font-weight:600">Created project</div>5,117 users · 41%<br/>−34% from previous step
      </div>
      <div style="position:absolute; left:calc(39% - 8px); top:62px; width:226px; height:96px; border:3px solid #ef4444; border-radius:14px"></div>
    </div>
  </div>
`,
  { dark: true },
)

export const fixtures = [
  { file: 'checkout-mobile.png', html: checkoutMobile, width: 390, height: 700 },
  { file: 'checkout-desktop.png', html: checkoutDesktop, width: 800, height: 500 },
  { file: 'chart-labels.png', html: chartLabels, width: 1200, height: 560 },
  { file: 'tooltip-dark.png', html: tooltipDark, width: 800, height: 500 },
]

/** 1280 × 640 card for GitHub's social preview, with the dark workspace screenshot. */
export const socialCard = (screenshotBase64) => `<!doctype html><html><head><style>
  * { box-sizing: border-box; margin: 0; }
  body { ${font} width: 1280px; height: 640px; overflow: hidden; color: #ececef;
    background: radial-gradient(1200px 600px at 85% 110%, #4c1d95 0%, transparent 60%), linear-gradient(135deg, #18181b, #1e1533); }
  .copy { position: absolute; left: 72px; top: 92px; width: 520px; }
  .brand { display: flex; align-items: center; gap: 14px; font-size: 30px; font-weight: 700; }
  .brand i { width: 46px; height: 46px; border-radius: 12px; background: #a78bfa; display: grid; place-items: center; }
  h1 { margin-top: 56px; font-size: 58px; line-height: 1.05; letter-spacing: -0.035em; font-weight: 750; }
  p { margin-top: 24px; font-size: 22px; line-height: 1.45; color: #a1a1aa; }
  .tags { margin-top: 34px; display: flex; gap: 10px; font-size: 15px; color: #c4b5fd; }
  .tags span { padding: 7px 13px; border: 1px solid rgba(167,139,250,.35); border-radius: 999px; background: rgba(167,139,250,.08); }
  img { position: absolute; left: 640px; top: 96px; width: 900px; border-radius: 16px; border: 1px solid rgba(255,255,255,.14);
    box-shadow: 0 40px 80px rgba(0,0,0,.55); }
</style></head><body>
  <div class="copy">
    <div class="brand"><i><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#1b1b20" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m8 2 1.88 1.88M14.12 3.88 16 2M9 7.13v-1a3 3 0 1 1 6 0v1"/><path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6M12 20v-9M6.53 9C4.6 8.8 3 7.1 3 5M6 13H2M3 21c0-2.1 1.7-3.9 3.8-4M20.97 5c0 2.1-1.6 3.8-3.5 4M22 13h-4M17.2 17c2.1.1 3.8 1.9 3.8 4"/></svg></i>Squash</div>
    <h1>Bug reports your cofounder actually reads.</h1>
    <p>Paste a screenshot, press Enter, and it's on your teammate's screen. Then let Claude Code fix it.</p>
    <div class="tags"><span>Real-time</span><span>Open source</span><span>Self-hostable</span></div>
  </div>
  <img src="data:image/png;base64,${screenshotBase64}" />
</body></html>`
