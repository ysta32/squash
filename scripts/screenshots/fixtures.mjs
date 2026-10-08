// HTML for the screenshots attached to the demo bugs: screens of "Lumen", a fictional analytics
// app, each showing the problem its bug describes.
import { fontFaces, markSvg, readTokens } from '../brand.mjs'

const font = `font-family: 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;`

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

/** Lumen's profile settings with the avatar rendered soft (bug #18) or sharp (after its fix). */
const avatarSettings = (sharp) =>
  shell(`
  ${nav('Settings')}
  <div style="padding:32px 40px; display:flex; gap:40px">
    <div style="width:180px; font-size:14px; line-height:2.4" class="muted">
      <div class="active">Profile</div><div>Workspace</div><div>Billing</div><div>Notifications</div>
    </div>
    <div class="card" style="flex:1; padding:28px">
      <div style="font-size:20px; font-weight:700">Profile</div>
      <div class="muted" style="font-size:14px; margin-top:4px">How teammates see you in Lumen.</div>
      <div style="display:flex; align-items:center; gap:22px; margin-top:26px">
        <div style="width:96px; height:96px; border-radius:50%; overflow:hidden; flex:none; position:relative; background:#d97706; ${sharp ? '' : 'filter:blur(2.6px);'}">
          <div style="position:absolute; left:30px; top:34px; width:36px; height:36px; border-radius:50%; background:#fff7ed"></div>
          <div style="position:absolute; left:18px; top:72px; width:60px; height:40px; border-radius:50%; background:#fff7ed"></div>
        </div>
        <div style="font-size:14px; line-height:1.6">
          <div style="font-weight:600; font-size:16px">Jordan Ellis</div>
          <div class="muted">jordan@lumen.dev</div>
          <div style="margin-top:10px; display:inline-block; padding:7px 12px; border:1px solid #e5e7eb; border-radius:8px; font-weight:600">Change photo</div>
        </div>
      </div>
      <div style="margin-top:28px; display:grid; grid-template-columns:1fr 1fr; gap:16px; font-size:14px">
        <div><div class="muted" style="font-size:12px">Display name</div><div style="margin-top:6px; padding:10px 12px; border:1px solid #e5e7eb; border-radius:8px">Jordan Ellis</div></div>
        <div><div class="muted" style="font-size:12px">Time zone</div><div style="margin-top:6px; padding:10px 12px; border:1px solid #e5e7eb; border-radius:8px">Europe/London</div></div>
      </div>
    </div>
  </div>
`)

export const avatarBlurry = avatarSettings(false)
export const avatarSharp = avatarSettings(true)

export const fixtures = [
  { file: 'checkout-mobile.png', html: checkoutMobile, width: 390, height: 700 },
  { file: 'checkout-desktop.png', html: checkoutDesktop, width: 800, height: 500 },
  { file: 'chart-labels.png', html: chartLabels, width: 1200, height: 560 },
  { file: 'tooltip-dark.png', html: tooltipDark, width: 800, height: 500 },
  { file: 'avatar-blurry.png', html: avatarBlurry, width: 800, height: 500 },
  { file: 'avatar-sharp.png', html: avatarSharp, width: 800, height: 500 },
]

/** 1280 × 640 card for GitHub's social preview, with the dark workspace screenshot. */
// GitHub social preview: the darkroom palette and pin mark from the design tokens (scripts/brand.mjs),
// so the card never drifts from the app.
export const socialCard = (screenshotBase64) => {
  const t = readTokens().dark
  return `<!doctype html><html><head><meta charset="utf-8"><style>
${fontFaces()}
  * { box-sizing: border-box; margin: 0; }
  body { width: 1280px; height: 640px; overflow: hidden; position: relative; color: ${t['text-1']};
    font-family: 'Plex Sans'; -webkit-font-smoothing: antialiased; background-color: ${t.bg};
    background-image: radial-gradient(110% 90% at 0% 0%, ${t['surface-2']} 0%, transparent 60%),
      radial-gradient(70% 80% at 100% 100%, ${t['accent-tint']} 0%, transparent 70%); }
  .copy { position: absolute; left: 72px; top: 72px; width: 520px; }
  .logo { display: flex; align-items: center; gap: 12px; font-size: 34px; font-weight: 600; letter-spacing: -0.02em; line-height: 1; }
  .logo svg { width: 36px; height: 36px; }
  h1 { margin-top: 64px; font-size: 56px; line-height: 60px; letter-spacing: -0.03em; font-weight: 600; text-wrap: balance; }
  p { margin-top: 24px; font-size: 22px; line-height: 32px; color: ${t['text-2']}; text-wrap: pretty; }
  .facts { position: absolute; left: 72px; bottom: 64px; font-family: 'Plex Mono'; font-size: 15px;
    letter-spacing: 0.06em; text-transform: uppercase; color: ${t['text-3']}; }
  .facts i { font-style: normal; padding: 0 0.6ch; }
  img { position: absolute; left: 640px; top: 96px; width: 900px; border-radius: 10px; border: 1.5px solid ${t['border-2']};
    box-shadow: 0 40px 80px rgba(0,0,0,.55); }
</style></head><body>
  <div class="copy">
    <div class="logo">${markSvg({ needle: t['text-1'], head: t.accent })}squash</div>
    <h1>Bug reports your cofounder actually reads.</h1>
    <p>Paste a screenshot, press Enter, and it's on your teammate's screen. Then let Claude Code fix it.</p>
  </div>
  <div class="facts">Real-time<i>·</i>Open source<i>·</i>Self-hostable</div>
  <img src="data:image/png;base64,${screenshotBase64}" />
</body></html>`
}
