import type { ReactNode } from "react";
import { Inter } from "next/font/google";

export const metadata = { title: "Aangan · Enquiries", robots: { index: false } };

const sans = Inter({ subsets: ["latin"], variable: "--font-sans" });

// "Control centre" look (inspired by the Control AI Policy Platform shot): deep teal glass,
// glowing nodes, gold highlights. Dark only: the founder reads it as a summary.
const css = `
:root{--bg:#06110f;--bg2:#0a1c19;--card:rgba(18,40,36,.55);--ink:#e8f1ee;--mute:#86a29b;--line:rgba(120,190,175,.16);
--teal:#3fd0b0;--teal-soft:rgba(63,208,176,.14);--gold:#e2b56a;--gold-soft:rgba(226,181,106,.14);--accent:var(--gold);--accent-soft:var(--gold-soft);
--q:#3fd0b0;--q-soft:rgba(63,208,176,.15);--h:#e2b56a;--h-soft:rgba(226,181,106,.15);--m:#8fa7ff;--m-soft:rgba(143,167,255,.15);--l:#f07178;--l-soft:rgba(240,113,120,.15);
--glow:0 0 0 1px rgba(120,190,175,.10),0 10px 40px rgba(0,0,0,.45);--blur:saturate(140%) blur(14px)}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%;color-scheme:dark}
body{margin:0;color:var(--ink);font:14.5px/1.5 var(--font-sans),system-ui,sans-serif;-webkit-font-smoothing:antialiased;min-height:100vh;
background:radial-gradient(1200px 600px at 15% -10%,rgba(63,208,176,.16),transparent 60%),radial-gradient(900px 500px at 110% 10%,rgba(226,181,106,.10),transparent 60%),linear-gradient(180deg,var(--bg2),var(--bg) 40%);background-attachment:fixed}
main{max-width:1180px;margin:0 auto;padding:18px 16px 64px}a{color:inherit;text-decoration:none}
.serif{letter-spacing:-.02em}
h1{font:300 30px/1.15 var(--font-sans);margin:14px 0 4px;letter-spacing:-.02em}h1 b{font-weight:600;color:var(--gold)}
h2{font:600 11.5px/1 var(--font-sans);text-transform:uppercase;letter-spacing:.14em;color:var(--mute);margin:28px 0 12px}
.top{display:flex;align-items:center;gap:12px;padding:8px 12px;border:1px solid var(--line);border-radius:16px;background:var(--card);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur)}
.brand{display:flex;align-items:center;gap:10px;font-weight:600;font-size:13px;line-height:1.15}.brand small{display:block;color:var(--mute);font-weight:400}
.logo{width:30px;height:30px;border-radius:9px;display:grid;place-items:center;color:#06110f;font-weight:700;background:conic-gradient(from 210deg,var(--teal),var(--gold),var(--teal));box-shadow:0 0 18px rgba(63,208,176,.45)}
.top nav{margin-left:auto;display:flex;gap:6px}.top nav a{padding:6px 12px;border-radius:10px;color:var(--mute);font-size:13px;border:1px solid transparent}.top nav a.on{color:var(--ink);border-color:var(--line);background:rgba(255,255,255,.03)}
.sub{color:var(--mute);margin:0 0 18px}
.card{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:16px 18px;box-shadow:var(--glow);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur)}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}
.kpi{padding:14px 16px}.kpi .v{font:500 26px/1.1 var(--font-sans);letter-spacing:-.02em;font-variant-numeric:tabular-nums}.kpi .k{color:var(--mute);font-size:12.5px;margin-top:4px}
.kpi.hero{background:linear-gradient(135deg,rgba(226,181,106,.22),rgba(226,181,106,.04));border-color:rgba(226,181,106,.35)}.kpi.hero .v{color:var(--gold)}
.mix{display:flex;height:8px;border-radius:99px;overflow:hidden;background:rgba(255,255,255,.06);margin:12px 0 10px}
.legend{display:flex;flex-wrap:wrap;gap:14px;font-size:13px;color:var(--mute)}.dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px}
.pill{display:inline-flex;align-items:center;padding:2px 9px;border-radius:7px;font-size:11.5px;font-weight:600;white-space:nowrap;border:1px solid currentColor}
.t-qualified{background:var(--q-soft);color:var(--q)}.t-high{background:var(--h-soft);color:var(--h)}.t-medium{background:var(--m-soft);color:var(--m)}.t-low{background:var(--l-soft);color:var(--l)}.t-none{background:rgba(255,255,255,.05);color:var(--mute)}
.bg-qualified{background:var(--q);box-shadow:0 0 10px var(--q)}.bg-high{background:var(--h);box-shadow:0 0 10px var(--h)}.bg-medium{background:var(--m);box-shadow:0 0 10px var(--m)}.bg-low{background:var(--l);box-shadow:0 0 10px var(--l)}
.lead{display:grid;grid-template-columns:38px 1fr auto;gap:12px;align-items:center;padding:11px 8px;border-bottom:1px solid var(--line);border-radius:12px}.lead:last-child{border-bottom:0}
.lead:hover{background:rgba(63,208,176,.06)}
.av{width:38px;height:38px;border-radius:50%;display:grid;place-items:center;font-weight:600;color:var(--teal);background:radial-gradient(circle at 30% 30%,rgba(63,208,176,.35),rgba(63,208,176,.06));border:1px solid rgba(63,208,176,.3)}
.lead .n{font-weight:600}.lead .s{color:var(--mute);font-size:12.5px;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.lead .r{text-align:right;font-size:11.5px;color:var(--mute);display:grid;gap:4px;justify-items:end}
.empty{color:var(--mute);text-align:center;padding:24px}
.banner{display:flex;gap:8px;align-items:center;background:var(--gold-soft);color:var(--gold);border:1px solid rgba(226,181,106,.3);border-radius:12px;padding:8px 14px;font-size:13px;margin:12px 0}
.warn{background:var(--l-soft);color:var(--l);border-radius:12px;padding:10px 14px}
.spark{display:flex;align-items:flex-end;gap:2px;height:56px}.spark i{flex:1;min-height:2px;border-radius:2px;background:linear-gradient(180deg,var(--gold),rgba(226,181,106,.25))}.spark i.z{background:rgba(255,255,255,.07)}
.axis{display:flex;justify-content:space-between;color:var(--mute);font-size:11px;margin-top:6px}
.filters{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;align-items:center}.chip{padding:6px 13px;border-radius:10px;border:1px solid var(--line);background:var(--card);font-size:12.5px;color:var(--mute)}.chip.on{color:#06110f;background:var(--teal);border-color:var(--teal)}
input,select,textarea,button{font:inherit;padding:7px 11px;border:1px solid var(--line);border-radius:10px;background:rgba(255,255,255,.04);color:var(--ink)}
button{background:var(--teal);color:#06110f;border:0;cursor:pointer;font-weight:600}
table{width:100%;border-collapse:collapse}td,th{padding:8px 6px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top;font-size:13.5px}td:first-child{color:var(--mute);width:38%}
pre{white-space:pre-wrap;font-size:13px;font-family:inherit;color:var(--ink)}.mute{color:var(--mute)}details summary{cursor:pointer;color:var(--teal)}
.row{display:flex;gap:10px;align-items:baseline;padding:8px 0;border-bottom:1px solid var(--line);flex-wrap:wrap;font-size:13.5px}.row .when{color:var(--mute);font-size:12.5px;min-width:120px}
.cc{display:grid;grid-template-columns:1fr;gap:14px}@media(min-width:900px){.cc{grid-template-columns:1.55fr 1fr}}
.flow{padding:6px 4px 10px;overflow:hidden}.flow svg{display:block;width:100%;height:auto}
.big{font:300 52px/1 var(--font-sans);letter-spacing:-.03em}.big small{font-size:14px;color:var(--mute);margin-left:6px;letter-spacing:0}
.chipline{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:8px 0 14px}.chipline span{font-size:11.5px;padding:3px 9px;border-radius:7px;border:1px solid var(--line);color:var(--mute)}.chipline span.live{color:var(--teal);border-color:rgba(63,208,176,.4);background:var(--teal-soft)}
.mini{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px}.mini div{border:1px solid var(--line);border-radius:12px;padding:10px 12px;background:rgba(255,255,255,.02)}.mini b{display:block;font-size:20px;font-weight:500}.mini span{color:var(--mute);font-size:12px}
.two{display:grid;grid-template-columns:1fr;gap:12px}@media(min-width:760px){.two{grid-template-columns:1.4fr 1fr}}
.link{color:var(--teal);text-decoration:underline;text-underline-offset:3px}
.backlink{margin-left:auto;font-size:13px;color:var(--teal);padding:6px 12px;border:1px solid rgba(63,208,176,.35);border-radius:10px}
.flow{position:relative}.hit{position:absolute;border-radius:12px;z-index:2;cursor:pointer}.hit:hover{background:rgba(63,208,176,.10);box-shadow:0 0 0 1px rgba(63,208,176,.6),0 0 18px rgba(63,208,176,.25)}
.chipline a{font-size:11.5px;padding:3px 9px;border-radius:7px;border:1px solid var(--line);color:var(--ink)}.chipline a:hover{border-color:var(--teal)}
.mini a{display:block;border:1px solid var(--line);border-radius:12px;padding:10px 12px;background:rgba(255,255,255,.02)}.mini a:hover{border-color:var(--teal)}.mini a b{display:block;font-size:20px;font-weight:500}.mini a span{color:var(--mute);font-size:12px}
.tree-filters{display:flex;gap:10px;flex-wrap:wrap;align-items:flex-start;margin-bottom:12px}.chip b{margin-left:6px;font-weight:600}
.branch{display:flex;flex-direction:column;gap:6px;align-items:flex-start}.sub-chips{display:flex;gap:6px;flex-wrap:wrap;padding-left:18px;border-left:2px solid var(--line);margin-left:14px}
.chip.sm{font-size:12px;padding:5px 11px;display:inline-flex;align-items:center}
.designers{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:10px}
.dcard{display:flex;gap:12px;align-items:center;padding:12px 14px;transition:border-color .2s,transform .2s}.dcard:hover{border-color:var(--teal);transform:translateY(-2px)}
.dcard img{border-radius:50%;flex:none;box-shadow:0 0 0 2px rgba(63,208,176,.35),0 0 16px rgba(63,208,176,.2)}
.dcard b{display:block;font-size:14px}.dcard small{display:block;color:var(--mute);font-size:11.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.dcard em{display:block;font-style:normal;font-size:11.5px;margin-top:3px}
.verdict-top{display:flex;align-items:center;gap:14px;flex-wrap:wrap}.verdict-top h1{font-size:28px}
.av.lg{width:56px;height:56px;font-size:22px}.big-pill{margin-left:auto;font-size:13px;padding:6px 12px;border-radius:10px}
.why{font-size:15.5px;margin:14px 0 4px;color:var(--ink)}
.verdict-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;margin-top:12px}
.verdict-stats div{border:1px solid var(--line);border-radius:12px;padding:10px 12px;background:rgba(255,255,255,.02)}.verdict-stats b{display:block;font-size:19px;font-weight:500}.verdict-stats span{color:var(--mute);font-size:12px}
.actions{display:flex;gap:8px;margin-top:14px;flex-wrap:wrap}.btn{display:inline-block;padding:9px 16px;border-radius:10px;background:var(--teal);color:#06110f;font-weight:600}.btn.ghost{background:transparent;color:var(--ink);border:1px solid var(--line)}
.brief p{font-size:15px;margin:0 0 8px}.ticks{margin:0;padding-left:18px}.ticks li{margin:4px 0}
.meet{display:flex;gap:14px;align-items:center;padding:12px;border:1px solid rgba(63,208,176,.35);border-radius:14px;background:var(--teal-soft)}.meet img{border-radius:50%}
.meet b{display:block}.meet small{display:block;color:var(--mute);font-size:12px}.meet em{display:block;font-style:normal;color:var(--teal);font-weight:600;margin-top:4px}
.outcome{margin-top:10px;padding:8px 12px;border-radius:10px;background:var(--gold-soft);color:var(--gold)}
.checks{display:flex;flex-wrap:wrap;gap:6px}.check{font-size:12px;padding:4px 10px;border-radius:8px;border:1px solid var(--line)}.check.pass{color:var(--q);border-color:rgba(63,208,176,.4)}.check.fail{color:var(--l);border-color:rgba(240,113,120,.4)}.check.unclear{color:var(--m);border-color:rgba(143,167,255,.4)}
.costrow{padding:12px 0;border-bottom:1px solid var(--line)}.costrow:last-child{border-bottom:0}.costhead{display:flex;gap:12px;align-items:baseline;flex-wrap:wrap}.costhead strong{margin-left:auto;font-size:18px;font-weight:500;color:var(--gold)}.costbar{height:6px;border-radius:99px;background:rgba(255,255,255,.06);margin:8px 0}.costbar i{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,var(--teal),var(--gold))}
.big-stage{padding:10px 0 40px}.cc>section:only-child{grid-column:1/-1}
.facts{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:10px}.fact{padding:12px 14px}.fact span{display:block;color:var(--mute);font-size:11.5px;text-transform:uppercase;letter-spacing:.08em}.fact b{display:block;font-weight:500;margin-top:4px}
.stage{perspective:1600px;perspective-origin:50% 20%;padding:18px 0 34px}
.slab{transform:rotateX(16deg) rotateY(-9deg) rotateZ(2deg) scale(.96);transform-style:preserve-3d;
box-shadow:0 1px 0 rgba(160,255,230,.35) inset,0 0 0 1px rgba(63,208,176,.25),0 18px 0 -6px rgba(25,70,62,.9),0 22px 0 -6px rgba(63,208,176,.25),0 60px 80px -20px rgba(0,0,0,.75),0 0 90px rgba(63,208,176,.18)}

.slab::after{content:"";position:absolute;inset:0;border-radius:18px;pointer-events:none;background:linear-gradient(115deg,rgba(255,255,255,.10),transparent 35%,transparent 70%,rgba(63,208,176,.08))}
.slab{position:relative}
@media(max-width:700px){.slab{transform:rotateX(14deg) rotateY(-6deg) rotateZ(1.5deg) scale(.97)}}
@media(prefers-reduced-motion:reduce){.slab{transform:none;transition:none}.flow .pulse{display:none}}
.grid-floor{position:absolute;inset:auto -10% -40px -10%;height:120px;pointer-events:none;background:repeating-linear-gradient(90deg,rgba(63,208,176,.07) 0 1px,transparent 1px 38px),repeating-linear-gradient(0deg,rgba(63,208,176,.07) 0 1px,transparent 1px 38px);transform:rotateX(70deg);transform-origin:top;filter:blur(.3px);-webkit-mask-image:linear-gradient(transparent,#000 40%,transparent)}
`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={sans.variable}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#06110f" />
        <style>{css}</style>
      </head>
      <body>
        <main>{children}</main>
      </body>
    </html>
  );
}
