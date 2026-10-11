// Test af kendte hold (Morten 12/10: "man skal kunne vælge kendte hold fra en liste … land, liga/række og hold … så
// kommer deres startopstilling automatisk frem, samt de taktiske indstillinger"). Appen køres fra docs/ i headless Chrome
// og bruges som en bruger: Vælg et kendt hold → land → liga → hold → Brug som mit hold/modstander. Kontrollen sker på den
// tavle, appen gemmer, sammenholdt med det, dialogen viste. Billeder gemmes i den mappe, der gives som argument.
// Brug: node tools/hold_test.mjs [mappe til billeder]   (kør python3 build.py først)
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "tt_hold_"));
const OUT = path.resolve(process.argv[2] || path.join(TMP, "billeder"));
fs.mkdirSync(OUT, { recursive: true });
const port = () => 20000 + Math.floor(Math.random() * 20000);
const [P_DOCS, P_CDP] = [port(), port()];
const sleep = ms => new Promise(r => setTimeout(r, ms));
let passes = 0, fails = 0;
const check = (name, ok, detail = "") => {
	if (ok) passes++; else fails++;
	console.log(`  ${ok ? "OK  " : "FEJL"} ${name}${detail ? "  — " + detail : ""}`);
};
async function until(f, ms = 15000, step = 100) {
	const t0 = Date.now();
	for (;;) {
		try { const v = await f(); if (v) return v; } catch (_) {}
		if (Date.now() - t0 > ms) return null;
		await sleep(step);
	}
}

const procs = [];
const run = (cmd, args) => { const p = spawn(cmd, args, { stdio: "ignore" }); procs.push(p); return p; };
run("python3", ["-m", "http.server", String(P_DOCS), "--bind", "127.0.0.1", "--directory", path.join(ROOT, "docs")]);
run(CHROME, ["--headless=new", `--remote-debugging-port=${P_CDP}`, `--user-data-dir=${path.join(TMP, "chrome")}`, "--no-first-run",
	"--no-default-browser-check", "--hide-scrollbars", "about:blank"]);
process.on("exit", () => { for (const p of procs) { try { p.kill(); } catch (_) {} } });
const ver = await until(async () => (await fetch(`http://127.0.0.1:${P_CDP}/json/version`)).json(), 20000);
await until(async () => (await fetch(`http://127.0.0.1:${P_DOCS}/`)).ok);

const ws = new WebSocket(ver.webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener("open", r, { once: true }));
let seq = 0;
const pending = new Map(), listeners = [];
ws.addEventListener("message", ev => {
	const m = JSON.parse(ev.data);
	if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id); m.error ? rej(new Error(m.error.message)) : res(m.result); }
	else if (m.method) for (const l of listeners) l(m);
});
const send = (method, params = {}, sessionId) => new Promise((res, rej) => {
	const id = ++seq; pending.set(id, { res, rej });
	ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
});
const { targetId } = await send("Target.createTarget", { url: "about:blank" });
const { sessionId: S } = await send("Target.attachToTarget", { targetId, flatten: true });
const errors = [];
listeners.push(m => {
	if (m.sessionId !== S) return;
	if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
	if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") errors.push(m.params.args.map(a => a.value ?? a.description).join(" "));
});
await send("Runtime.enable", {}, S);
await send("Page.enable", {}, S);
const ev = async expr => {
	const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true }, S);
	if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
	return r.result.value;
};
const click = sel => ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) throw new Error('mangler ' + ${JSON.stringify(sel)}); e.click(); return true; })()`);
const pick = (sel, value) => ev(`(() => { const s = document.querySelector(${JSON.stringify(sel)}); s.value = ${JSON.stringify(value)}; s.dispatchEvent(new Event('change', { bubbles: true })); return s.value; })()`);
const saved = async () => { await sleep(450); const id = await ev("localStorage.getItem('taktiktavle:v1:last')"); return JSON.parse(await ev("localStorage.getItem('taktiktavle:v1:boards')"))[id]; };
const shot = async (sel, file) => {
	const r = await ev(`(() => { const b = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return { x: b.left, y: b.top, width: b.width, height: b.height }; })()`);
	const { data } = await send("Page.captureScreenshot", { format: "png", clip: { ...r, scale: 1 } }, S);
	fs.writeFileSync(path.join(OUT, file), Buffer.from(data, "base64"));
};
const TACTIC_VALS = {
	Pres: ["meget lavt", "lavt", "middel", "højt", "meget højt"], Forsvarslinje: ["meget dyb", "dyb", "middel", "høj", "meget høj"],
	Tempo: ["meget roligt", "roligt", "middel", "højt", "meget højt"], Bredde: ["meget smal", "smal", "middel", "bred", "meget bred"],
	Afleveringer: ["meget korte", "korte", "blandede", "direkte", "meget direkte"],
};
const KEY = { Pres: "press", Forsvarslinje: "line", Tempo: "tempo", Bredde: "width", Afleveringer: "passing" };
// Det, dialogen viser om det valgte hold.
const card = () => ev(`(() => { const c = document.getElementById('kdCard');
	return { name: c.querySelector('h4').textContent.trim(), meta: c.querySelector('.known-meta').textContent,
		xi: [...c.querySelectorAll('.known-xi li')].map(li => ({ num: li.querySelector('b').textContent, name: li.childNodes[1].textContent, role: li.querySelector('small').textContent })),
		tags: [...c.querySelectorAll('.known-tac .drill-tag')].map(t => t.textContent), note: c.querySelector('.group-note').textContent }; })()`);

await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 860, deviceScaleFactor: 1, mobile: false }, S);
await send("Page.navigate", { url: `http://127.0.0.1:${P_DOCS}/` }, S);
await until(() => ev("document.readyState === 'complete' && !!document.getElementById('boardBtnName').textContent"));
await sleep(400);

console.log("Dialogen: land → liga/række → hold");
await click("#tab-hold");
await click("#knownBtn");
const opts = await ev(`({ open: document.getElementById('knownDlg').open,
	countries: [...document.querySelectorAll('#kdCountry option')].map(o => o.textContent),
	leagues: [...document.querySelectorAll('#kdLeague option')].map(o => o.textContent),
	teams: [...document.querySelectorAll('#kdTeam option')].map(o => ({ id: o.value, name: o.textContent })) })`);
const meta0 = await ev("document.querySelector('#kdCard .known-meta').textContent");
const fit = await ev("[...document.querySelectorAll('#knownDlg select')].map(s => { const c = document.createElement('canvas').getContext('2d'); c.font = getComputedStyle(s).font; return Math.ceil(c.measureText(s.selectedOptions[0].text).width) + 40 <= s.clientWidth; })");
check("dialogen åbner med England → Premier League (sæson 2026/27 i kortet)", opts.open && opts.countries.includes("England") && opts.leagues[0] === "Premier League" && meta0.startsWith("Premier League 2026/27 ·"), JSON.stringify({ c: opts.countries, l: opts.leagues, meta0 }));
check("land, liga og hold kan læses helt i felterne", fit.every(Boolean), JSON.stringify(fit));
check("20 hold i Premier League", opts.teams.length === 20, opts.teams.map(t => t.name).join(", "));
await shot("#knownDlg", "dialog.png");

console.log("Hvert hold som mit hold: tavlen = det, dialogen viste");
for (const t of opts.teams) {
	if (!(await ev("document.getElementById('knownDlg').open"))) await click("#knownBtn");
	await pick("#kdTeam", t.id);
	const c = await card();
	const prob = [];
	if (c.name !== t.name) prob.push(`kortet viser ${c.name}`);
	if (c.xi.length !== 11 || new Set(c.xi.map(p => p.num)).size !== 11) prob.push(`${c.xi.length} spillere / dubletnumre`);
	if (c.xi.some(p => !p.name || p.name.length > 18)) prob.push("navn tomt eller over 18 tegn");
	if (c.xi[0].role !== "GK") prob.push("første spiller er ikke målmand");
	await click("#kdHome");
	const b = await saved();
	const fm = c.meta.match(/· (\d(?:-\d)+)/);
	if (b.teamNames.home !== t.name) prob.push(`holdnavn ${b.teamNames.home}`);
	if (!fm || b.homeFormation !== fm[1]) prob.push(`formation ${b.homeFormation} / ${fm && fm[1]}`);
	b.home.forEach((p, i) => { if (p.num !== c.xi[i].num || p.name !== c.xi[i].name || p.role !== c.xi[i].role) prob.push(`plads ${i + 1}: ${p.num} ${p.name} ${p.role}`); });
	for (const tag of c.tags) {
		const [lbl, val] = tag.split(": ");
		if (KEY[lbl] && b.tactics.home[KEY[lbl]] !== TACTIC_VALS[lbl].indexOf(val) + 1) prob.push(`${lbl} ${b.tactics.home[KEY[lbl]]}`);
	}
	if (!b.known || b.known.home !== t.id) prob.push("known.home");
	if (b.tactics.home.preset !== "") prob.push("klassisk taktik står stadig");
	check(`${t.name}: ${b.homeFormation}, ${b.home.map(p => p.num).join(" ")}`, !prob.length, prob.slice(0, 4).join("; "));
}

console.log("Modstander, farver, note og fortryd");
await click("#knownBtn"); await pick("#kdTeam", opts.teams.find(t => t.name === "Manchester United").id); await click("#kdHome");
const before = await saved();
await click("#knownBtn"); await pick("#kdTeam", opts.teams.find(t => t.name === "Arsenal").id);
const ars = await card();
await click("#kdAway");
const b2 = await saved();
const dist = (a, b) => { const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); const x = p(a), y = p(b); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); };
check("Arsenal som modstander: vist på banen med navne og numre", b2.showAway && b2.teamNames.away === "Arsenal" && b2.away.every((p, i) => p.name === ars.xi[i].name && p.num === ars.xi[i].num), `${b2.teamNames.away}, vist ${b2.showAway}`);
check("mit hold er uændret, når modstanderen vælges", JSON.stringify(b2.home) === JSON.stringify(before.home) && b2.teamNames.home === "Manchester United");
check("rød mod rød: modstanderen får sin anden farve", dist(b2.kit.home, b2.kit.away) >= 110, `${b2.kit.home} / ${b2.kit.away}`);
const note = await ev("!document.getElementById('knownNote').hidden && document.getElementById('knownNote').textContent");
check("Hold viser, hvilket hold og hvilken kamp opstillingen bygger på", typeof note === "string" && note.startsWith("Bygger på Arsenal (Premier League 2026/27)"), String(note));
await shot("#board", "united_mod_arsenal.png");
await click("#undoBtn");
const b3 = await saved();
check("ét tryk på Fortryd fjerner hele skiftet af modstander", b3.teamNames.away !== "Arsenal" && JSON.stringify(b3.away.map(p => p.name)) !== JSON.stringify(b2.away.map(p => p.name)), `${b3.teamNames.away}`);
await click("#redoBtn");

console.log("Kamp med kendte hold");
await click("#tab-kamp");
const title = await ev("document.getElementById('matchTitle').textContent");
check("kampen hedder Manchester United mod Arsenal", /Manchester United/.test(title) && /Arsenal/.test(title), title);

console.log("Simulering med den nye formation 3-4-2-1 (Leeds mod Forest)");
await click("#tab-hold"); await click("#knownBtn"); await pick("#kdTeam", opts.teams.find(t => t.name === "Leeds United").id); await click("#kdHome");
await click("#knownBtn"); await pick("#kdTeam", opts.teams.find(t => t.name === "Nottingham Forest").id); await click("#kdAway");
const b4 = await saved();
await click("#tab-kamp"); await click("#many500");
const many = await ev("document.getElementById('manyResult').textContent");
check("500 simulerede kampe med to 3-4-2-1-hold giver et resultat", b4.homeFormation === "3-4-2-1" && b4.awayFormation === "3-4-2-1" && /500 simulerede kampe/.test(many) && /i mål/.test(many), many.slice(0, 120));
await click("[data-feedback]"); await sleep(300);
const fb = await ev("({ open: document.getElementById('fbDlg').open, s: document.querySelectorAll('#fbStrengths li').length, k: document.querySelectorAll('#fbWeak li').length })");
await ev("document.getElementById('fbDlg').close()");
check("feedback åbner for Leeds mod Forest", fb.open && fb.s + fb.k > 0, JSON.stringify(fb));
await click("[data-sim]"); await sleep(500);
await click("#simPlay");
const clock = await until(async () => { const c = await ev("document.getElementById('sbClock').textContent"); return parseInt(c) >= 3 ? c : null; }, 20000, 250);
const sim = await ev("({ clock: document.getElementById('sbClock').textContent, score: document.getElementById('sbScore').textContent, ticker: (document.querySelector('#simDlg .sim-ticker') || {}).textContent || '' })");
await ev("document.getElementById('simDlg').close()");
check("en kamp med de kendte hold går i gang (uret når mindst 3. minut)", !!clock, JSON.stringify(sim).slice(0, 180));

console.log("Telefon");
await send("Emulation.setDeviceMetricsOverride", { width: 375, height: 812, deviceScaleFactor: 1, mobile: true }, S);
await sleep(250);
await click("#tab-hold"); await click("#knownBtn");
const ph = await ev("({ over: document.documentElement.scrollWidth - innerWidth, dlg: Math.round(document.getElementById('knownDlg').getBoundingClientRect().width) })");
const fitPh = await ev("[...document.querySelectorAll('#knownDlg select')].map(s => { const c = document.createElement('canvas').getContext('2d'); c.font = getComputedStyle(s).font; return Math.ceil(c.measureText(s.selectedOptions[0].text).width) + 40 <= s.clientWidth; })");
check("telefon: land, liga og hold kan læses helt i felterne", fitPh.every(Boolean), JSON.stringify(fitPh));
await send("Page.captureScreenshot", { format: "png" }, S).then(({ data }) => fs.writeFileSync(path.join(OUT, "telefon_dialog.png"), Buffer.from(data, "base64")));
check("telefon 375×812: dialogen i fuld bredde uden vandret rul", ph.over <= 0 && ph.dlg === 375, JSON.stringify(ph));

check("ingen fejl i konsollen", errors.length === 0, errors.slice(0, 3).join(" | "));
console.log(`\n${passes} OK, ${fails} FEJL. Billeder: ${OUT}`);
process.exit(fails ? 1 : 0);
