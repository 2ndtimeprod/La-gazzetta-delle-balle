FONTS = '<link href="https://fonts.googleapis.com/css2?family=Anton&family=IBM+Plex+Mono:wght@400;500;600&family=Inter:wght@500;600;700&family=Playfair+Display:ital,wght@0,700;0,800;0,900;1,700;1,800;1,900&family=Source+Serif+4:ital,wght@0,400;0,600;0,700;1,400;1,600&display=swap" rel="stylesheet">'

def page(title, css, sub, stage, script, avanti_default="S-Narratore.dc.html"):
    return f'''<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<title>{title}</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
{FONTS}
<style>
body{{margin:0}}
button{{font-family:inherit}}
{css}
@media (prefers-reduced-motion: reduce){{.fc,.rv{{animation:none !important}}.fc{{transition:none !important}}}}
</style>
</helmet>
<div style="width: 390px; height: 844px; box-sizing: border-box; overflow: hidden; padding: 50px 22px 30px; display: flex; flex-direction: column; justify-content: space-between; background: {{{{pageBg}}}}; background-size: {{{{pageBgSize}}}}; color: {{{{ink}}}}; font-family: {{{{bodyFont}}}}">

<div style="display: flex; flex-direction: column; gap: 14px">
<header style="display: flex; flex-direction: column; gap: 6px">
<div style="display: flex; justify-content: space-between; font-family: {{{{metaFont}}}}; font-size: 11px; letter-spacing: 1px; color: {{{{muted}}}}"><span>MAR 10 NOV 2026</span><span>{{{{metaRight}}}}</span></div>
<div style="border-top: {{{{ruleTop}}}}; border-bottom: {{{{ruleBottom}}}}; padding: 7px 0 6px; display: flex; justify-content: space-between; align-items: center"><span style="font-family: {{{{mastFont}}}}; font-size: {{{{mastSize}}}}; font-weight: {{{{mastWeight}}}}; font-style: {{{{mastStyle}}}}; text-transform: {{{{mastCase}}}}">La Gazzetta delle Balle</span><span style="font-family: {{{{metaFont}}}}; font-size: 11px; color: {{{{muted}}}}">ROUND 3/10</span></div>
</header>
<div style="display: flex; flex-direction: column; gap: 6px">
<span style="align-self: flex-start; font-family: {{{{metaFont}}}}; font-size: 11px; letter-spacing: 1.5px; background: {{{{accent}}}}; color: {{{{accentInk}}}}; padding: 4px 8px">SEI IL NARRATORE</span>
<h1 style="margin: 4px 0 0; font-family: {{{{headFont}}}}; font-weight: {{{{headWeight}}}}; font-style: {{{{headStyle}}}}; font-size: {{{{headSize}}}}; line-height: 1; text-transform: {{{{headCase}}}}">Tocca a te, Dom</h1>
<p style="margin: 0; font-size: 16px; line-height: 1.4; color: {{{{muted}}}}">{sub}</p>
</div>
</div>

{stage}

<div style="display: flex; flex-direction: column; gap: 10px">
<div aria-live="polite" style="height: 36px; display: flex; align-items: center; justify-content: center">
<sc-if value="{{{{landed}}}}" hint-placeholder-val="{{{{false}}}}"><span style="font-family: {{{{headFont}}}}; font-weight: {{{{headWeight}}}}; font-style: {{{{headStyle}}}}; font-size: 22px; text-transform: {{{{headCase}}}}; background: {{{{resultBg}}}}; color: {{{{resultInk}}}}; padding: 5px 14px">{{{{resultName}}}}</span></sc-if>
<sc-if value="{{{{busy}}}}" hint-placeholder-val="{{{{false}}}}"><span style="font-family: {{{{metaFont}}}}; font-size: 12px; letter-spacing: 1px; color: {{{{muted}}}}">{{{{busyLabel}}}}</span></sc-if>
</div>
<sc-if value="{{{{landed}}}}" hint-placeholder-val="{{{{false}}}}">
<a href="{{{{avanti}}}}" style="display: flex; align-items: center; justify-content: center; height: 58px; text-decoration: none; font-family: {{{{btnFont}}}}; font-weight: {{{{btnWeight}}}}; font-size: {{{{btnSize}}}}; letter-spacing: {{{{btnTrack}}}}; text-transform: uppercase; background: {{{{btnBg}}}}; color: {{{{btnInk}}}}; border: {{{{btnBorder}}}}; border-radius: {{{{btnRadius}}}}; box-shadow: {{{{btnShadow}}}}">Pesca la frase</a>
</sc-if>
<sc-if value="{{{{notLanded}}}}" hint-placeholder-val="{{{{true}}}}">
<button type="button" disabled="{{{{busy}}}}" onClick="{{{{auto}}}}" style="height: 58px; cursor: pointer; opacity: {{{{autoOpacity}}}}; font-family: {{{{btnFont}}}}; font-weight: {{{{btnWeight}}}}; font-size: {{{{btnSize}}}}; letter-spacing: {{{{btnTrack}}}}; text-transform: uppercase; background: {{{{btn2Bg}}}}; color: {{{{btn2Ink}}}}; border: {{{{btn2Border}}}}; border-radius: {{{{btnRadius}}}}">Lancialo tu per me</button>
</sc-if>
<div style="display: flex; justify-content: space-between; align-items: center; height: 28px; font-family: {{{{metaFont}}}}; font-size: 11px; letter-spacing: 1px; color: {{{{muted}}}}">
<span>PROTOTIPO</span>
<span style="display: flex; gap: 8px">
<button type="button" aria-pressed="{{{{dark}}}}" onClick="{{{{toggleDark}}}}" style="height: 28px; padding: 0 10px; cursor: pointer; background: transparent; color: {{{{muted}}}}; border: 1px solid {{{{muted}}}}; border-radius: 2px; font-family: inherit; font-size: inherit; letter-spacing: inherit">{{{{darkLabel}}}}</button>
<sc-if value="{{{{landed}}}}" hint-placeholder-val="{{{{false}}}}"><button type="button" onClick="{{{{reset}}}}" style="height: 28px; padding: 0 10px; cursor: pointer; background: transparent; color: {{{{muted}}}}; border: 1px solid {{{{muted}}}}; border-radius: 2px; font-family: inherit; font-size: inherit; letter-spacing: inherit">RILANCIA</button></sc-if>
</span>
</div>
</div>

</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{{"stile":{{"editor":"enum","options":["sera","quotidiano"],"default":"sera"}},"dark":{{"editor":"boolean","default":false}},"avanti":{{"editor":null,"default":"{avanti_default}"}},"$preview":{{"width":390,"height":844}}}}'>
{script}
</script>
</body>
</html>
'''

BASE_JS = r'''
getDark() { return this.state.dark === null ? !!(this.props.dark ?? false) : this.state.dark; }
vib(p) { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) {} }
reduced() { try { return !!window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } }
mod(a, n) { return ((a % n) + n) % n; }
refresh() { this.setState({ tick: this.state.tick + 1 }); }
pick() { return Math.floor(Math.random() * 7); }
theme() {
const dark = this.getDark();
const st = this.props.stile ?? 'sera';
const names = ['History', 'Pop culture', 'Geography', 'Science', 'Food & Drink', 'Animal kingdom', dark ? 'Dark' : 'Jolly: scegli tu'];
const strip = ['History', 'Pop culture', 'Geography', 'Science', 'Food & Drink', 'Animal kingdom', dark ? 'Dark' : 'Jolly'];
const short = ['History', 'Pop culture', 'Geography', 'Science', 'Food & Drink', 'Animals', dark ? 'Dark' : 'Jolly'];
const tiny = ['Hist.', 'Pop', 'Geo', 'Sci.', 'Food', 'Anim.', dark ? 'Dark' : 'Jolly'];
const codes = ['HIS', 'POP', 'GEO', 'SCI', 'FOO', 'ANI', dark ? 'DRK' : 'JLY'];
if (st === 'quotidiano') {
const sp = dark ? { bg: '#B3001B', ink: '#FFFFFF' } : { bg: '#111111', ink: '#FAF7F0' };
return {
dark: dark, names: names, strip: strip, short: short, tiny: tiny, codes: codes,
v: {
pageBg: 'radial-gradient(rgba(0,0,0,0.03) 1px, transparent 1px), #FAF7F0', pageBgSize: '4px 4px, auto', ink: '#111111', muted: '#5C574E', bodyFont: "'Source Serif 4', Georgia, serif",
metaFont: "'Inter', sans-serif", metaRight: 'ANNO I · N. 1', ruleTop: '4px double #111111', ruleBottom: '1px solid #111111',
mastFont: "'Playfair Display', serif", mastSize: '21px', mastWeight: 900, mastStyle: 'italic', mastCase: 'none',
accent: '#B3001B', accentInk: '#FFFFFF', headFont: "'Playfair Display', serif", headWeight: 900, headStyle: 'normal', headSize: '40px', headCase: 'none',
trayRadius: '6px', trayBg: 'radial-gradient(circle at 50% 40%, #4A3828 0%, #2E2219 65%, #1C140E 100%)', trayShadow: '0 0 0 1px #111111, 0 0 0 7px #FAF7F0, 0 0 0 8px #111111, inset 0 0 40px rgba(0,0,0,0.5), 0 24px 36px rgba(0,0,0,0.25)',
btnFont: "'Inter', sans-serif", btnWeight: 700, btnSize: '14px', btnTrack: '2px', btnBg: '#111111', btnInk: '#FAF7F0', btnBorder: 'none', btnRadius: '2px', btnShadow: 'none',
btn2Bg: 'transparent', btn2Ink: '#111111', btn2Border: '1px solid #111111', resultBg: '#111111', resultInk: '#FAF7F0'
},
x: {
sector: (i) => i === 6 ? sp : { bg: i % 2 ? '#EDE6D6' : '#FAF7F0', ink: '#111111' },
paper: (i) => i === 6 ? sp : { bg: '#FAF7F0', ink: '#111111' },
sepLine: 'rgba(17,17,17,0.55)', wheelShadow: '0 0 0 1px #111111, 0 0 0 6px #FAF7F0, 0 0 0 7px #111111, inset 0 0 22px rgba(0,0,0,0.18), 0 16px 28px rgba(0,0,0,0.4)',
pegBg: '#FAF7F0', pegBorder: '1.5px solid #111111', flap: '#B3001B', hubBg: '#111111', hubInk: '#FAF7F0', hubFont: "'Playfair Display', serif", hubStyle: 'italic',
lblFont: "'Playfair Display', serif", lblCase: 'none', lblStyle: 'italic', lblWeight: 800, lblSize: '17px', lblTrack: '0',
stripSize: '24px', stripFont: "'Playfair Display', serif", stripStyle: 'italic', stripWeight: 900, stripCase: 'none', stripRule: '4px double rgba(17,17,17,0.7)', codeFont: "'Inter', sans-serif",
bezel: '#FAF7F0', bezelDark: '#111111', drumBack: '#1C140E', capShade: 'rgba(0,0,0,0.7)',
ball: 'radial-gradient(circle at 35% 30%, #FFFFFF 0%, #FAF7F0 50%, #B9B1A0 100%)', ballEdge: '1px solid #111111', pegHot: '#B3001B', slotLine: 'rgba(250,247,240,0.45)', slotInk: '#FAF7F0', slotWin: '#FAF7F0', slotWinInk: '#111111', hopper: '#FAF7F0',
trayInk: '#EDE6D6',
backBg: '#FAF7F0', backInk: '#111111', backLine: '1px solid #111111', backLine2: '4px double #111111', backMono: "'Playfair Display', serif", backMonoStyle: 'italic', cardBorder: '1px solid #111111', frontBorder: '4px double #111111'
}
};
}
const sp = dark ? { bg: '#F0443A', ink: '#15120E' } : { bg: '#F2C230', ink: '#15120E' };
return {
dark: dark, names: names, strip: strip, short: short, tiny: tiny, codes: codes,
v: {
pageBg: 'radial-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), #15120E', pageBgSize: '4px 4px, auto', ink: '#F1E9D8', muted: '#B8AE9A', bodyFont: "'Source Serif 4', Georgia, serif",
metaFont: "'IBM Plex Mono', monospace", metaRight: 'EDIZIONE DELLA SERA', ruleTop: '3px solid #F1E9D8', ruleBottom: '1px solid rgba(241,233,216,0.35)',
mastFont: "'Anton', sans-serif", mastSize: '20px', mastWeight: 400, mastStyle: 'normal', mastCase: 'uppercase',
accent: '#F0443A', accentInk: '#15120E', headFont: "'Anton', sans-serif", headWeight: 400, headStyle: 'normal', headSize: '44px', headCase: 'uppercase',
trayRadius: '16px', trayBg: 'radial-gradient(circle at 50% 40%, #3D1915 0%, #26110E 60%, #170A09 100%)', trayShadow: '0 0 0 8px #6B5330, 0 0 0 10px #2A2012, inset 0 0 40px rgba(0,0,0,0.6), 0 30px 40px rgba(0,0,0,0.5)',
btnFont: "'Anton', sans-serif", btnWeight: 400, btnSize: '22px', btnTrack: '0.5px', btnBg: '#F0443A', btnInk: '#15120E', btnBorder: 'none', btnRadius: '2px', btnShadow: 'none',
btn2Bg: 'transparent', btn2Ink: '#F1E9D8', btn2Border: '1.5px solid #F1E9D8', resultBg: '#F2C230', resultInk: '#15120E'
},
x: {
sector: (i) => i === 6 ? sp : { bg: i % 2 ? '#2A241D' : '#1C1814', ink: '#F1E9D8' },
paper: (i) => i === 6 ? sp : { bg: '#F1E9D8', ink: '#15120E' },
sepLine: 'rgba(0,0,0,0.6)', wheelShadow: '0 0 0 5px #6B5330, 0 0 0 7px #2A2012, inset 0 0 26px rgba(0,0,0,0.5), 0 16px 30px rgba(0,0,0,0.55)',
pegBg: '#C9A55A', pegBorder: '1px solid #2A2012', flap: '#F0443A', hubBg: 'radial-gradient(circle at 35% 30%, #9A7A44 0%, #6B5330 55%, #3A2B14 100%)', hubInk: '#F1E9D8', hubFont: "'Anton', sans-serif", hubStyle: 'normal',
lblFont: "'Anton', sans-serif", lblCase: 'uppercase', lblStyle: 'normal', lblWeight: 400, lblSize: '16px', lblTrack: '1px',
stripSize: '28px', stripFont: "'Anton', sans-serif", stripStyle: 'normal', stripWeight: 400, stripCase: 'uppercase', stripRule: '3px double rgba(21,18,14,0.6)', codeFont: "'IBM Plex Mono', monospace",
bezel: '#6B5330', bezelDark: '#2A2012', drumBack: '#0E0C0A', capShade: 'rgba(0,0,0,0.8)',
ball: 'radial-gradient(circle at 35% 30%, #FFF1B8 0%, #F2C230 45%, #9A6F08 100%)', ballEdge: '1px solid #3A2B14', pegHot: '#FFFFFF', slotLine: 'rgba(201,165,90,0.55)', slotInk: '#F1E9D8', slotWin: '#F2C230', slotWinInk: '#15120E', hopper: '#6B5330',
trayInk: '#B8AE9A',
backBg: '#1C1814', backInk: '#F1E9D8', backLine: '1px solid rgba(201,165,90,0.75)', backLine2: '3px double rgba(201,165,90,0.75)', backMono: "'Anton', sans-serif", backMonoStyle: 'normal', cardBorder: '1.5px solid #C9A55A', frontBorder: '3px double rgba(21,18,14,0.6)'
}
};
}
shared(T) {
const o = Object.assign({}, T.v);
o.avanti = this.props.avanti ?? 'S-Narratore.dc.html';
o.dark = T.dark;
o.darkLabel = T.dark ? 'DARK: SÌ' : 'DARK: NO';
o.toggleDark = () => { this.setState({ dark: !this.getDark() }); this.reset(); };
o.reset = () => this.reset();
o.auto = () => this.auto();
o.resultName = this.r >= 0 ? T.names[this.r] : '';
return o;
}
'''

SPIN_JS = r'''
fx() {
const c = Math.floor((this.pos + this.sA / 2) / this.sA);
if (c !== this.cnt) { this.cnt = c; this.vib(8); this.pulse(); }
}
pulse() {
this.kickT = performance.now();
if (this.pl) return;
this.pl = true;
const f = () => {
this.refresh();
if (!this.dead && performance.now() - this.kickT < 320) requestAnimationFrame(f); else this.pl = false;
};
requestAnimationFrame(f);
}
plan(v, jit, dd) {
this.r = this.pick();
const red = this.reduced();
const dir = v === 0 ? dd : (v < 0 ? -1 : 1);
const sp = Math.min(3200, Math.max(400, Math.abs(v) || 900));
const n = 3;
const j = (Math.random() - 0.5) * 2 * jit * this.sA;
const tgt = this.mod(-(this.r * this.sA) - j, 360);
const D0 = red ? 0 : Math.max(180, sp * Math.min(4, 0.5 + sp / 1100) / n);
const cur = this.pos + dir * D0;
const delta = dir > 0 ? this.mod(tgt - cur, 360) : -this.mod(cur - tgt, 360);
const D = D0 + Math.abs(delta);
this.from = this.pos; this.to = cur + delta; this.dir = dir; this.n = n;
this.T = red ? 600 : D * n / sp * 1000;
this.t0 = performance.now(); this.phase = 'spin';
this.cnt = Math.floor((this.pos + this.sA / 2) / this.sA);
this.run();
}
run() {
cancelAnimationFrame(this.raf);
this.raf = requestAnimationFrame((n) => this.tick(n));
}
tick(now) {
if (this.phase === 'spin') {
const p = Math.min(1, Math.max(0, (now - this.t0) / this.T));
this.pos = this.from + (this.to - this.from) * (1 - Math.pow(1 - p, this.n));
this.fx();
if (p >= 1) { this.pos = this.to; this.phase = 'landed'; this.vib([18, 40, 26]); }
}
this.refresh();
if (this.phase === 'spin') this.raf = requestAnimationFrame((n) => this.tick(n));
}
up() {
if (this.phase !== 'hold') return;
const a = this.samples[0], z = this.samples[this.samples.length - 1];
let v = (z.r - a.r) / (Math.max(16, z.t - a.t) / 1000);
if (performance.now() - z.t > 120) v = 0;
this.launch(v);
}
auto() {
if (this.phase === 'spin' || this.phase === 'hold') return;
this.launch((Math.random() < 0.5 ? -1 : 1) * (900 + Math.random() * 1500));
}
reset() {
cancelAnimationFrame(this.raf);
this.phase = 'idle'; this.r = -1;
this.refresh();
}
'''
