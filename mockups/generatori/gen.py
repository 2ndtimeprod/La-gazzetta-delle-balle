import sys, json
sys.path.insert(0, '/home/claude/build')
from parts import *
OUT = '/home/claude/out/project/'

# ---------------- 1. RUOTA ----------------
wheel_stage = '''<div style="position: relative; width: 346px; height: 420px; flex-shrink: 0; border-radius: {{trayRadius}}; background: {{trayBg}}; box-shadow: {{trayShadow}}">
<div onPointerDown="{{down}}" onPointerMove="{{move}}" onPointerUp="{{up}}" onPointerCancel="{{up}}" style="position: absolute; left: 18px; top: 83px; width: 310px; height: 310px; touch-action: none; user-select: none; cursor: grab">
<div aria-hidden="true" style="position: absolute; left: 0; top: 0; width: 310px; height: 310px; border-radius: 50%; transform: rotate({{rot}}deg); background: {{wheelBg}}; box-shadow: {{wheelShadow}}">
<sc-for list="{{pegs}}" as="p" hint-placeholder-count="7">
<div style="position: absolute; left: 50%; top: 50%; width: 0; height: 0; transform: rotate({{p.a}}deg)"><span style="position: absolute; left: -4px; top: -151px; width: 8px; height: 8px; box-sizing: border-box; border-radius: 50%; background: {{pegBg}}; border: {{pegBorder}}"></span></div>
</sc-for>
<sc-for list="{{labels}}" as="l" hint-placeholder-count="7">
<div style="position: absolute; left: 50%; top: 50%; width: 0; height: 0; transform: rotate({{l.a}}deg)"><span style="position: absolute; left: -56px; top: -107px; width: 112px; height: 24px; line-height: 24px; text-align: center; white-space: nowrap; transform: rotate(-90deg) scale({{l.sc}}); opacity: {{l.op}}; color: {{l.ink}}; font-family: {{lblFont}}; font-style: {{lblStyle}}; font-weight: {{lblWeight}}; font-size: {{lblSize}}; letter-spacing: {{lblTrack}}; text-transform: {{lblCase}}">{{l.text}}</span></div>
</sc-for>
<div style="position: absolute; left: 127px; top: 127px; width: 56px; height: 56px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: {{hubBg}}; color: {{hubInk}}; font-family: {{hubFont}}; font-style: {{hubStyle}}; font-size: 22px; box-shadow: 0 2px 6px rgba(0,0,0,0.5), inset 0 0 0 2px rgba(0,0,0,0.25)">BC</div>
</div>
</div>
<div aria-hidden="true" style="position: absolute; left: 162px; top: 52px; width: 22px; height: 46px; transform-origin: 50% 7px; transform: rotate({{flap}}deg); filter: drop-shadow(0 3px 3px rgba(0,0,0,0.55))">
<div style="width: 22px; height: 46px; background: {{flapColor}}; clip-path: polygon(0 0, 100% 0, 100% 30%, 50% 100%, 0 30%)"></div>
<div style="position: absolute; left: 7px; top: 3px; width: 8px; height: 8px; border-radius: 50%; background: {{hubInk}}; opacity: 0.85"></div>
</div>
</div>'''

wheel_script = '''class Component extends DCLogic {
constructor(props) {
super(props);
this.state = { tick: 0, dark: null };
this.sA = 360 / 7; this.pos = 0; this.phase = 'idle'; this.r = -1; this.dir = 1; this.cnt = 0; this.samples = [];
}
componentWillUnmount() { cancelAnimationFrame(this.raf); }
''' + BASE_JS + SPIN_JS + '''
launch(v) { this.plan(v, 0.28, 1); }
ang(e) {
const rc = e.currentTarget.getBoundingClientRect();
return Math.atan2(e.clientY - (rc.top + rc.height / 2), e.clientX - (rc.left + rc.width / 2)) * 180 / Math.PI;
}
down(e) {
if (this.phase === 'spin') return;
try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) {}
this.phase = 'hold'; this.r = -1;
this.la = this.ang(e);
this.samples = [{ r: this.pos, t: performance.now() }];
this.cnt = Math.floor((this.pos + this.sA / 2) / this.sA);
this.refresh();
}
move(e) {
if (this.phase !== 'hold') return;
const a = this.ang(e);
let d = a - this.la;
if (d > 180) d -= 360;
if (d < -180) d += 360;
this.la = a; this.pos += d;
if (d !== 0) this.dir = d > 0 ? 1 : -1;
this.samples.push({ r: this.pos, t: performance.now() });
if (this.samples.length > 6) this.samples.shift();
this.fx(); this.refresh();
}
renderVals() {
const T = this.theme(), x = T.x, sA = this.sA;
const landed = this.phase === 'landed', busy = this.phase === 'spin' || this.phase === 'hold';
const stops = [];
for (let i = 0; i < 7; i++) stops.push(x.sector(i).bg + ' ' + (i * sA).toFixed(3) + 'deg ' + ((i + 1) * sA).toFixed(3) + 'deg');
const from = 'from ' + (-sA / 2).toFixed(3) + 'deg';
const o = this.shared(T);
o.wheelBg = 'repeating-conic-gradient(' + from + ', ' + x.sepLine + ' 0deg 0.8deg, transparent 0.8deg ' + sA.toFixed(4) + 'deg), conic-gradient(' + from + ', ' + stops.join(', ') + ')';
o.wheelShadow = x.wheelShadow;
o.pegBg = x.pegBg; o.pegBorder = x.pegBorder; o.hubBg = x.hubBg; o.hubInk = x.hubInk; o.hubFont = x.hubFont; o.hubStyle = x.hubStyle;
o.lblFont = x.lblFont; o.lblStyle = x.lblStyle; o.lblWeight = x.lblWeight; o.lblSize = x.lblSize; o.lblTrack = x.lblTrack; o.lblCase = x.lblCase;
o.flapColor = x.flap;
o.rot = Math.round(this.pos * 100) / 100;
o.pegs = []; o.labels = [];
for (let i = 0; i < 7; i++) {
o.pegs.push({ a: (i * sA - sA / 2).toFixed(3) });
o.labels.push({ a: (i * sA).toFixed(3), text: T.short[i], ink: x.sector(i).ink, sc: landed && this.r === i ? 1.14 : 1, op: landed ? (this.r === i ? 1 : 0.35) : 1 });
}
const fr = this.mod((this.pos + sA / 2) / sA, 1);
const d = (this.phase === 'spin' || this.phase === 'hold') ? this.dir : 1;
o.flap = Math.round((d > 0 ? -24 * Math.max(0, 1 - fr / 0.3) : 24 * Math.max(0, 1 - (1 - fr) / 0.3)) * 10) / 10;
o.landed = landed; o.notLanded = !landed; o.busy = busy; o.autoOpacity = busy ? 0.45 : 1;
o.busyLabel = this.phase === 'hold' ? 'LASCIA ANDARE' : 'STA GIRANDO';
o.down = (e) => this.down(e); o.move = (e) => this.move(e); o.up = () => this.up();
return o;
}
}'''

# ---------------- 2. RULLI ----------------
drum_stage = '''<div style="position: relative; width: 346px; height: 420px; flex-shrink: 0; border-radius: {{trayRadius}}; background: {{trayBg}}; box-shadow: {{trayShadow}}">
<div onPointerDown="{{down}}" onPointerMove="{{move}}" onPointerUp="{{up}}" onPointerCancel="{{up}}" style="position: absolute; left: 18px; top: 45px; width: 310px; height: 330px; overflow: hidden; perspective: 1400px; perspective-origin: 50% 50%; touch-action: none; user-select: none; cursor: grab; background: {{drumBack}}">
<div aria-hidden="true" style="position: absolute; left: 0; top: 165px; width: 310px; height: 0; transform-style: preserve-3d; transform: rotateX({{phi}}deg)">
<sc-for list="{{items}}" as="it" hint-placeholder-count="7">
<div style="position: absolute; left: 11px; top: -48px; width: 288px; height: 96px; box-sizing: border-box; backface-visibility: hidden; transform: {{it.tf}}; background: {{it.bg}}; color: {{it.ink}}; border-top: {{stripRule}}; border-bottom: {{stripRule}}; display: flex; align-items: center; justify-content: space-between; padding: 0 14px">
<span style="width: 34px; font-family: {{codeFont}}; font-size: 11px; font-weight: 600; letter-spacing: 1px">{{it.code}}</span>
<span style="flex-grow: 1; text-align: center; white-space: nowrap; font-family: {{stripFont}}; font-style: {{stripStyle}}; font-weight: {{stripWeight}}; font-size: {{stripSize}}; text-transform: {{stripCase}}; line-height: 1.1">{{it.label}}</span>
<span style="width: 34px; text-align: right; font-family: {{codeFont}}; font-size: 11px; letter-spacing: 1px">{{it.num}}</span>
<div style="position: absolute; left: 0; top: 0; right: 0; bottom: 0; background: rgba(0,0,0,{{it.shade}})"></div>
</div>
</sc-for>
</div>
<div aria-hidden="true" style="position: absolute; left: 0; top: 0; right: 0; bottom: 0; pointer-events: none; background: linear-gradient(to bottom, {{capShade}} 0px, rgba(0,0,0,0) 80px, rgba(0,0,0,0) 250px, {{capShade}} 330px)"></div>
<div aria-hidden="true" style="position: absolute; left: 0; top: 155px; width: 0; height: 0; border-top: 10px solid transparent; border-bottom: 10px solid transparent; border-left: 13px solid {{accent}}; transform: {{arrowL}}"></div>
<div aria-hidden="true" style="position: absolute; right: 0; top: 155px; width: 0; height: 0; border-top: 10px solid transparent; border-bottom: 10px solid transparent; border-right: 13px solid {{accent}}; transform: {{arrowR}}"></div>
<div aria-hidden="true" style="position: absolute; left: 0; top: 0; right: 0; bottom: 0; pointer-events: none; box-shadow: inset 0 0 0 3px {{bezel}}, inset 0 0 0 5px {{bezelDark}}"></div>
</div>
<div style="position: absolute; left: 0; right: 0; top: 390px; text-align: center; font-family: {{metaFont}}; font-size: 11px; letter-spacing: 1.5px; color: {{trayInk}}">TRASCINA IL TAMBURO</div>
</div>'''

drum_script = '''class Component extends DCLogic {
constructor(props) {
super(props);
this.state = { tick: 0, dark: null };
this.sA = 360 / 7; this.pos = 0; this.phase = 'idle'; this.r = -1; this.dir = -1; this.cnt = 0; this.samples = [];
}
componentWillUnmount() { this.dead = true; cancelAnimationFrame(this.raf); }
''' + BASE_JS + SPIN_JS + '''
launch(v) { this.plan(v, 0, -1); }
down(e) {
if (this.phase === 'spin') return;
const el = e.currentTarget;
try { el.setPointerCapture(e.pointerId); } catch (err) {}
this.phase = 'hold'; this.r = -1;
this.ly = e.clientY;
this.sc = (el.getBoundingClientRect().width / el.offsetWidth) || 1;
this.samples = [{ r: this.pos, t: performance.now() }];
this.cnt = Math.floor((this.pos + this.sA / 2) / this.sA);
this.refresh();
}
move(e) {
if (this.phase !== 'hold') return;
const dy = (e.clientY - this.ly) / this.sc;
this.ly = e.clientY;
this.pos -= dy * 57.2958 / 108;
if (dy !== 0) this.dir = dy > 0 ? -1 : 1;
this.samples.push({ r: this.pos, t: performance.now() });
if (this.samples.length > 6) this.samples.shift();
this.fx(); this.refresh();
}
renderVals() {
const T = this.theme(), x = T.x, sA = this.sA;
const landed = this.phase === 'landed', busy = this.phase === 'spin' || this.phase === 'hold';
const o = this.shared(T);
o.drumBack = x.drumBack; o.capShade = x.capShade; o.bezel = x.bezel; o.bezelDark = x.bezelDark; o.trayInk = x.trayInk;
o.stripRule = x.stripRule; o.codeFont = x.codeFont; o.stripFont = x.stripFont; o.stripStyle = x.stripStyle; o.stripWeight = x.stripWeight; o.stripSize = x.stripSize; o.stripCase = x.stripCase;
o.phi = Math.round(this.pos * 100) / 100;
const kt = performance.now() - (this.kickT || -1e9);
const off = kt < 320 ? Math.round(10 * Math.exp(-kt / 60) * (0.5 + 0.5 * Math.cos(kt / 45)) * 10) / 10 : 0;
o.arrowL = 'translateX(' + off + 'px)'; o.arrowR = 'translateX(' + (-off) + 'px)';
o.items = [];
for (let i = 0; i < 7; i++) {
const e0 = this.mod(i * sA + this.pos + 180, 360) - 180;
const shade = Math.min(0.8, Math.pow(Math.abs(e0) / 90, 1.4) * 0.85);
const p = x.paper(i);
o.items.push({ tf: 'rotateX(' + (i * sA).toFixed(3) + 'deg) translateZ(100px)', bg: p.bg, ink: p.ink, label: T.strip[i], code: T.codes[i], num: '0' + (i + 1) + '/07', shade: shade.toFixed(3) });
}
o.landed = landed; o.notLanded = !landed; o.busy = busy; o.autoOpacity = busy ? 0.45 : 1;
o.busyLabel = this.phase === 'hold' ? 'LASCIA ANDARE' : 'STA SCORRENDO';
o.down = (e) => this.down(e); o.move = (e) => this.move(e); o.up = () => this.up();
return o;
}
}'''

# ---------------- 3. CARTE ----------------
cards_css = '''@keyframes deal{from{transform:rotate(0deg) translateY(36px);opacity:0}}
@keyframes reveal{0%{transform:translateY(90px) rotateY(180deg) scale(0.55);opacity:0}25%{opacity:1}100%{transform:translateY(0) rotateY(0deg) scale(1);opacity:1}}'''

card_back_raw = '''<span aria-hidden="true" style="position: absolute; left: {m}px; top: {m}px; right: {m}px; bottom: {m}px; box-sizing: border-box; border: {{backLine2}}; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: {g}px; color: {{backInk}}">
<span style="width: 60%; border-top: {{backLine}}"></span>
<span style="font-family: {{backMono}}; font-style: {{backMonoStyle}}; font-weight: 900; font-size: {fs}px; line-height: 1">BC</span>
<span style="font-family: {{metaFont}}; font-size: {ms}px; letter-spacing: 1.5px">BALLE CREDIBILI</span>
<span style="width: 60%; border-top: {{backLine}}"></span>
</span>'''

def cb(**kw):
    t = card_back_raw.format(**kw)
    for n in ['backLine2', 'backInk', 'backMonoStyle', 'backMono', 'backLine', 'metaFont']:
        t = t.replace('{' + n + '}', '{{' + n + '}}')
    return t

cards_stage = '''<div style="position: relative; width: 346px; height: 420px; flex-shrink: 0; border-radius: {{trayRadius}}; background: {{trayBg}}; box-shadow: {{trayShadow}}; overflow: hidden">
<sc-for list="{{cards}}" as="c" hint-placeholder-count="7">
<button type="button" class="fc" disabled="{{c.dis}}" onClick="{{c.pick}}" aria-label="{{c.aria}}" style="position: absolute; left: 117px; top: 50px; width: 112px; height: 168px; padding: 0; box-sizing: border-box; border: {{cardBorder}}; border-radius: 8px; cursor: pointer; background: {{backBg}}; transform-origin: 56px 330px; transform: {{c.tf}}; opacity: {{c.op}}; transition: transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.4s; animation: {{c.anim}}; box-shadow: 0 6px 14px rgba(0,0,0,0.45)">
''' + cb(m=6, g=7, fs=34, ms=7) + '''
</button>
</sc-for>
<sc-if value="{{revealed}}" hint-placeholder-val="{{false}}">
<div style="position: absolute; left: 85px; top: 78px; width: 176px; height: 264px; perspective: 900px">
<div class="rv" style="position: absolute; left: 0; top: 0; width: 176px; height: 264px; transform-style: preserve-3d; animation: reveal 1s cubic-bezier(0.2, 0.8, 0.2, 1) both">
<div style="position: absolute; left: 0; top: 0; width: 176px; height: 264px; box-sizing: border-box; border: {{cardBorder}}; border-radius: 10px; background: {{backBg}}; backface-visibility: hidden; transform: rotateY(180deg); box-shadow: 0 14px 28px rgba(0,0,0,0.5)">
''' + cb(m=9, g=12, fs=54, ms=10) + '''
</div>
<div style="position: absolute; left: 0; top: 0; width: 176px; height: 264px; box-sizing: border-box; border-radius: 10px; background: {{front.bg}}; color: {{front.ink}}; backface-visibility: hidden; box-shadow: 0 14px 28px rgba(0,0,0,0.5); padding: 10px">
<div style="width: 100%; height: 100%; box-sizing: border-box; border: {{frontBorder}}; display: flex; flex-direction: column; align-items: center; justify-content: space-between; padding: 14px 8px; text-align: center">
<span style="font-family: {{metaFont}}; font-size: 11px; letter-spacing: 2px">LA CATEGORIA È</span>
<span style="font-family: {{headFont}}; font-weight: {{headWeight}}; font-style: {{headStyle}}; text-transform: {{headCase}}; font-size: 38px; line-height: 1.05">{{front.name}}</span>
<span style="font-family: {{metaFont}}; font-size: 11px; letter-spacing: 2px">{{front.code}}</span>
</div>
</div>
</div>
</div>
</sc-if>
<sc-if value="{{showHint}}" hint-placeholder-val="{{true}}"><div style="position: absolute; left: 0; right: 0; top: 380px; text-align: center; font-family: {{metaFont}}; font-size: 11px; letter-spacing: 1.5px; color: {{trayInk}}">SETTE CARTE, UNA CATEGORIA</div></sc-if>
</div>'''

cards_script = '''class Component extends DCLogic {
constructor(props) {
super(props);
this.state = { tick: 0, dark: null, dealing: false };
this.phase = 'idle'; this.picked = -1; this.r = -1;
this.deck();
}
componentWillUnmount() { clearTimeout(this.to); clearTimeout(this.to2); }
''' + BASE_JS + '''
deck() {
const a = [0, 1, 2, 3, 4, 5, 6];
for (let i = 6; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
this.perm = a;
}
choose(k) {
if (this.phase !== 'idle') return;
this.picked = k; this.r = this.perm[k]; this.phase = 'reveal'; this.vib(12);
this.refresh();
clearTimeout(this.to);
this.to = setTimeout(() => { this.phase = 'landed'; this.vib([18, 40, 26]); this.refresh(); }, this.reduced() ? 0 : 1050);
}
auto() { if (this.phase === 'idle') this.choose(Math.floor(Math.random() * 7)); }
reset() {
clearTimeout(this.to); clearTimeout(this.to2);
this.deck(); this.phase = 'idle'; this.picked = -1; this.r = -1;
this.setState({ dealing: true });
this.to2 = setTimeout(() => this.setState({ dealing: false }), 40);
}
renderVals() {
const T = this.theme(), x = T.x;
const landed = this.phase === 'landed', busy = this.phase === 'reveal';
const o = this.shared(T);
['backBg', 'backInk', 'backLine', 'backLine2', 'backMono', 'backMonoStyle', 'cardBorder', 'frontBorder', 'trayInk'].forEach((k) => { o[k] = x[k]; });
o.cards = [];
for (let i = 0; i < 7; i++) {
const a = (i - 3) * 7.5;
const idle = this.phase === 'idle';
o.cards.push({
tf: 'rotate(' + a + 'deg)' + (idle ? '' : ' translateY(50px)'),
op: idle ? 1 : 0,
dis: !idle,
aria: 'Carta ' + (i + 1) + ' di 7',
anim: this.state.dealing ? 'none' : 'deal 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) ' + (i * 70) + 'ms backwards',
pick: () => this.choose(i)
});
}
const p = this.r >= 0 ? x.paper(this.r) : x.paper(0);
o.front = { bg: p.bg, ink: p.ink, name: this.r >= 0 ? T.strip[this.r] : '', code: this.r >= 0 ? T.codes[this.r] : '' };
o.revealed = this.phase === 'reveal' || this.phase === 'landed';
o.showHint = this.phase === 'idle';
o.landed = landed; o.notLanded = !landed; o.busy = busy; o.autoOpacity = this.phase === 'idle' ? 1 : 0.45;
o.busyLabel = 'STO SCOPRENDO';
return o;
}
}'''

# ---------------- 4. PACHINKO ----------------
pach_stage = '''<div style="position: relative; width: 346px; height: 420px; flex-shrink: 0; border-radius: {{trayRadius}}; background: {{trayBg}}; box-shadow: {{trayShadow}}; overflow: hidden">
<div aria-hidden="true" style="position: absolute; left: 133px; top: 4px; width: 80px; height: 26px; background: {{hopper}}; clip-path: polygon(0 0, 100% 0, 72% 100%, 28% 100%)"></div>
<sc-for list="{{pegs}}" as="p" hint-placeholder-count="38">
<span aria-hidden="true" style="position: absolute; left: {{p.l}}px; top: {{p.t}}px; width: {{p.s}}px; height: {{p.s}}px; box-sizing: border-box; border-radius: 50%; background: {{p.bg}}; border: {{pegBorder}}"></span>
</sc-for>
<sc-for list="{{lines}}" as="d" hint-placeholder-count="8">
<span aria-hidden="true" style="position: absolute; left: {{d.l}}px; top: 334px; width: 2px; height: 86px; background: {{slotLine}}"></span>
</sc-for>
<sc-for list="{{slots}}" as="s" hint-placeholder-count="7">
<span style="position: absolute; left: {{s.l}}px; top: 398px; width: 44px; height: 18px; line-height: 18px; text-align: center; box-sizing: border-box; font-family: {{metaFont}}; font-size: 10px; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase; background: {{s.bg}}; color: {{s.ink}}">{{s.text}}</span>
</sc-for>
<span aria-hidden="true" style="position: absolute; left: {{ballL}}px; top: {{ballT}}px; width: 18px; height: 18px; box-sizing: border-box; border-radius: 50%; background: {{ball}}; border: {{ballEdge}}; box-shadow: 0 3px 5px rgba(0,0,0,0.5)"></span>
<sc-if value="{{canDrop}}" hint-placeholder-val="{{true}}"><button type="button" onClick="{{auto}}" aria-label="Lascia cadere la pallina" style="position: absolute; left: 141px; top: 10px; width: 64px; height: 60px; padding: 0; border: none; background: transparent; cursor: pointer"></button></sc-if>
<sc-if value="{{showHint}}" hint-placeholder-val="{{true}}"><div style="position: absolute; left: 0; right: 0; top: 340px; text-align: center; font-family: {{metaFont}}; font-size: 11px; letter-spacing: 1.5px; color: {{trayInk}}">SETTE USCITE, UNA CATEGORIA</div></sc-if>
</div>'''

pach_script = '''class Component extends DCLogic {
constructor(props) {
super(props);
this.state = { tick: 0, dark: null };
this.phase = 'idle'; this.r = -1; this.segs = []; this.hits = {}; this.ball = { x: 173, y: 40 };
this.pegsData = [];
for (let k = 1; k <= 6; k++) {
const y = 82 + 44 * (k - 1), off = (k % 2 === 1) ? 0 : 23;
for (let n = -4; n <= 4; n++) { const px = 173 + off + n * 46; if (px < 22 || px > 324) continue; this.pegsData.push({ id: k * 1000 + px, x: px, y: y }); }
}
}
componentWillUnmount() { cancelAnimationFrame(this.raf); }
''' + BASE_JS + '''
auto() {
if (this.phase === 'drop') return;
this.hits = {}; this.r = this.pick();
const bits = [];
for (let i = 0; i < 6; i++) bits.push(i < this.r ? 1 : 0);
for (let i = 5; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = bits[i]; bits[i] = bits[j]; bits[j] = t; }
const xs = [173];
bits.forEach((b) => xs.push(xs[xs.length - 1] + (b ? 23 : -23)));
const segs = [];
if (this.reduced()) {
segs.push({ t0: 0, t1: 300, x0: 173, y0: 40, x1: xs[6], y1: 383, hop: 0, fall: false, peg: 0 });
} else {
const rnd = () => 0.92 + Math.random() * 0.16;
let t = 0;
const add = (d, s) => { segs.push(Object.assign({ t0: t, t1: t + d, fall: true, peg: 0 }, s)); t += d; };
add(280 * rnd(), { x0: 173, y0: 40, x1: 173, y1: 68, hop: 0 });
for (let k = 1; k <= 5; k++) add(360 * rnd(), { x0: xs[k - 1], y0: 68 + 44 * (k - 1), x1: xs[k], y1: 68 + 44 * k, hop: 11, peg: k * 1000 + xs[k - 1] });
add(520 * rnd(), { x0: xs[5], y0: 288, x1: xs[6], y1: 383, hop: 11, peg: 6000 + xs[5] });
add(300, { x0: xs[6], y0: 383, x1: xs[6], y1: 383, hop: 16, fall: false });
add(180, { x0: xs[6], y0: 383, x1: xs[6], y1: 383, hop: 6, fall: false });
}
this.segs = segs; this.fin = xs[6]; this.phase = 'drop'; this.t0 = performance.now();
cancelAnimationFrame(this.raf);
this.raf = requestAnimationFrame((n) => this.tick(n));
}
tick(now) {
const el = now - this.t0;
this.segs.forEach((s) => { if (!s.fired && el >= s.t0) { s.fired = true; if (s.peg) { this.hits[s.peg] = now; this.vib(6); } } });
let seg = null;
for (let i = 0; i < this.segs.length; i++) { const s = this.segs[i]; if (el >= s.t0 && el < s.t1) { seg = s; break; } }
if (seg) {
const u = (el - seg.t0) / (seg.t1 - seg.t0);
const u2 = seg.fall ? 0.3 * u + 0.7 * u * u : u;
const xe = 1 - (1 - u) * (1 - u);
this.ball = { x: seg.x0 + (seg.x1 - seg.x0) * xe, y: seg.y0 + (seg.y1 - seg.y0) * u2 - seg.hop * Math.sin(Math.PI * u) };
} else if (el >= this.segs[this.segs.length - 1].t1) {
this.ball = { x: this.fin, y: 383 }; this.phase = 'landed'; this.vib([18, 40, 26]);
}
this.state.now = now;
this.refresh();
if (this.phase === 'drop') this.raf = requestAnimationFrame((n) => this.tick(n));
}
reset() {
cancelAnimationFrame(this.raf);
this.phase = 'idle'; this.r = -1; this.hits = {}; this.ball = { x: 173, y: 40 };
this.refresh();
}
renderVals() {
const T = this.theme(), x = T.x;
const landed = this.phase === 'landed', busy = this.phase === 'drop';
const now = performance.now();
const o = this.shared(T);
['pegBorder', 'slotLine', 'ball', 'ballEdge', 'hopper', 'trayInk'].forEach((k) => { o[k] = x[k]; });
o.pegs = this.pegsData.map((p) => {
const h = this.hits[p.id] ? Math.max(0, 1 - (now - this.hits[p.id]) / 280) : 0;
const s = 8 + Math.round(h * 5);
return { l: p.x - s / 2, t: p.y - s / 2, s: s, bg: h > 0.25 ? x.pegHot : x.pegBg };
});
o.lines = []; o.slots = [];
for (let m = 0; m <= 7; m++) o.lines.push({ l: 173 + (m - 3.5) * 46 - 1 });
for (let m = 0; m < 7; m++) {
const w = landed && this.r === m;
o.slots.push({ l: 173 + (m - 3) * 46 - 22, text: T.tiny[m], bg: w ? x.slotWin : 'transparent', ink: w ? x.slotWinInk : x.slotInk });
}
o.ballL = Math.round((this.ball.x - 9) * 10) / 10; o.ballT = Math.round((this.ball.y - 9) * 10) / 10;
o.canDrop = this.phase === 'idle'; o.showHint = this.phase === 'idle';
o.landed = landed; o.notLanded = !landed; o.busy = busy; o.autoOpacity = busy ? 0.45 : 1;
o.busyLabel = 'STA CADENDO';
return o;
}
}'''

comps = [
 ('Estr-Rulli', 'Estrazione: tamburo a rulli', '', 'Fai scorrere il tamburo e lascialo andare.', drum_stage, drum_script),
]
for name, title, css, sub, stage, script in comps:
    open(OUT + name + '.dc.html', 'w').write(page(title, css, sub, stage, script))
    wrapper = f'''<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<title>Il Quotidiano: {title.lower()}</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
{FONTS}
<style>
body{{margin:0}}
</style>
</helmet>
<div style="width: 390px; height: 844px; overflow: hidden">
<dc-import name="{name}" stile="quotidiano" dark="{{{{dark}}}}" avanti="Q-Narratore.dc.html" hint-size="390px,844px"></dc-import>
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{{"dark":{{"editor":"boolean","default":false}},"$preview":{{"width":390,"height":844}}}}'>
class Component extends DCLogic {{
renderVals() {{ return {{ dark: this.props.dark ?? false }}; }}
}}
</script>
</body>
</html>
'''
    open(OUT + 'Q-' + name + '.dc.html', 'w').write(wrapper)
print('generated')
