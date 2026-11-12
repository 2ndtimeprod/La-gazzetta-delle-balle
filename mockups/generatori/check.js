const fs = require('fs');
const dir = '/home/claude/out/project/';
const files = ['Estr-Rulli'];
let fail = 0;
for (const f of files) {
  const src = fs.readFileSync(dir + f + '.dc.html', 'utf8');
  const m = src.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/);
  const js = m[1];
  const propsJson = src.match(/data-props='([^']*)'/)[1];
  JSON.parse(propsJson);
  global.performance = { now: () => global.__t };
  global.navigator = { vibrate: () => {} };
  global.window = { matchMedia: () => ({ matches: false }) };
  global.requestAnimationFrame = () => 1; global.cancelAnimationFrame = () => {};
  global.DCLogic = class { constructor(p) { this.props = p; this.state = {}; } setState(s) { Object.assign(this.state, s); } };
  global.__t = 1000;
  const C = new Function(js + '; return Component;')();
  for (const stile of ['sera','quotidiano']) for (const dark of [false,true]) {
    const c = new C({ stile, dark });
    const check = (label) => {
      const o = c.renderVals();
      const tpl = src.split('<script type="text/x-dc"')[0];
      // loop vars
      const loops = {}; 
      for (const lm of tpl.matchAll(/<sc-for list="\{\{(\w+)\}\}" as="(\w+)"/g)) loops[lm[2]] = lm[1];
      const holes = new Set([...tpl.matchAll(/\{\{\s*([\w.$]+)\s*\}\}/g)].map(x => x[1]));
      for (const h of holes) {
        const [a, b] = h.split('.'); if (a === 'true' || a === 'false') continue;
        if (a in loops) { const arr = o[loops[a]]; if (!arr || !arr.length || !(b in arr[0])) { console.log(f, stile, dark, label, 'MISSING loop field', h); fail++; } }
        else if (!(a in o) && !/^(true|false)$/.test(a) && a !== '$index') { console.log(f, stile, dark, label, 'MISSING', h); fail++; }
        else if (b && o[a] && !(b in o[a])) { console.log(f, stile, dark, label, 'MISSING sub', h); fail++; }
        else if (!b && o[a] === undefined) { console.log(f, stile, dark, label, 'UNDEFINED', h); fail++; }
      }
      for (const [k, v] of Object.entries(o)) if (typeof v === 'string' && /undefined|NaN/.test(v)) { console.log(f, label, 'BADVAL', k, v); fail++; }
      return o;
    };
    check('idle');
    // simulate
    for (let run = 0; run < 40; run++) {
      c.state.dark = null;
      if (f === 'Estr-Carte') {
        c.reset(); c.choose(run % 7); global.__t += 2000; c.phase = 'landed';
        const o = check('landed'); if (o.front.name !== c.theme().strip[c.r]) { console.log('cards mismatch'); fail++; }
        continue;
      }
      if (f === 'Estr-Pachinko') {
        c.reset(); global.__t = 1000; c.auto(); let t = 1000;
        for (let i = 0; i < 400 && c.phase === 'drop'; i++) { t += 16; global.__t = t; c.tick(t); }
        if (c.phase !== 'landed') { console.log('pachinko not landed'); fail++; }
        const expectX = 173 + (c.r - 3) * 46;
        if (Math.abs(c.ball.x - expectX) > 0.01) { console.log('pachinko slot mismatch', c.r, c.ball.x, expectX); fail++; }
        // every contact x lies on a peg
        c.segs.forEach(s => { if (s.peg) { const ok = c.pegsData.some(p => p.id === s.peg); if (!ok) { console.log('no peg for', s.peg); fail++; } } });
        // next contact x must be x1 and a peg at next row
        check('landed'); continue;
      }
      c.reset(); global.__t = 1000;
      c.pos = (Math.random() - 0.5) * 900;
      c.lastV=(Math.random() < .5 ? -1 : 1) * (200 + Math.random() * 3500); c.launch(c.lastV);
      let t = 1000;
      for (let i = 0; i < 1000 && c.phase === 'spin'; i++) { t += 16; global.__t = t; c.tick(t); }
      if (c.phase !== 'landed') { console.log('not landed'); fail++; }
      { const vv=Math.min(3200,Math.max(400,Math.abs(c.lastV))); const s0=Math.abs(c.to-c.from)*c.n/(c.T/1000); if (Math.abs(s0-vv)>1) { console.log('speed mismatch', s0, vv); fail++; } }
      // sector under pointer
      const under = Math.round(c.mod(-c.pos, 360) / c.sA) % 7;
      const off = c.mod(-c.pos, 360) / c.sA; const d = Math.abs(((off - c.r + 3.5 + 7) % 7) - 3.5);
      if (d > 0.3) { console.log(f, 'landing mismatch', c.r, off, d); fail++; }
      check('landed');
    }
  }
}
console.log('FAILS', fail);
