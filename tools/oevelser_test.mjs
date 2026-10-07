// Test af træningsøvelserne, udstyret, zoom og spillere uden for banen (Morten 7/10: "tilføj forskellige
// træningsøvelser i appen"; "fjern alt indhold relateret til 5 mod 5 og 8 mod 8"). Appen køres fra docs/ i headless
// Chrome og bruges som en bruger: faner, filtre, klik og træk på banen. Kontrollen sker på de tavler, appen gemmer.
// Billeder af hvert trin i hver øvelse gemmes i den mappe, der gives som argument (standard: en midlertidig mappe).
// Brug: node tools/oevelser_test.mjs [mappe til billeder]   (kør python3 build.py først)
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "tt_oev_"));
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

// ---- server og Chrome
const procs = [];
const run = (cmd, args) => { const p = spawn(cmd, args, { stdio: "ignore" }); procs.push(p); return p; };
run("python3", ["-m", "http.server", String(P_DOCS), "--bind", "127.0.0.1", "--directory", path.join(ROOT, "docs")]);
run(CHROME, ["--headless=new", `--remote-debugging-port=${P_CDP}`, `--user-data-dir=${path.join(TMP, "chrome")}`, "--no-first-run",
	"--no-default-browser-check", "--hide-scrollbars", "about:blank"]);
process.on("exit", () => { for (const p of procs) { try { p.kill(); } catch (_) {} } });
const ver = await until(async () => (await fetch(`http://127.0.0.1:${P_CDP}/json/version`)).json(), 20000);
await until(async () => (await fetch(`http://127.0.0.1:${P_DOCS}/`)).ok);

// ---- en lille CDP-klient
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
const size = async (w, h, mobile = false) => send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile }, S);
const click = sel => ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) throw new Error('mangler ' + ${JSON.stringify(sel)}); e.click(); return true; })()`);
const boards = () => ev("JSON.parse(localStorage.getItem('taktiktavle:v1:boards') || '{}')");
const openId = () => ev("localStorage.getItem('taktiktavle:v1:last')");
const saved = async () => { await sleep(450); const id = await openId(); return (await boards())[id]; };   // (appen gemmer 300 ms efter en ændring)
const shot = async (sel, file) => {
	const r = await ev(`(() => { const b = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return { x: b.left, y: b.top, width: b.width, height: b.height }; })()`);
	const { data } = await send("Page.captureScreenshot", { format: "png", clip: { ...r, scale: 1 } }, S);
	fs.writeFileSync(path.join(OUT, file), Buffer.from(data, "base64"));
};
// Banens målestok, som appen regner den (computeView + toScreen): meter → punkter på skærmen.
const screenOf = async (b, x, y) => ev(`(() => {
	const r = document.getElementById('pitch').getBoundingClientRect(), W = 68, L = 105, m = 68 * .05 + 1.5, pad = 10, v = ${JSON.stringify(b.view || null)};
	const x0 = v ? v.x0 : -m, x1 = v ? v.x1 : W + m, y0 = v ? v.y0 : -m, y1 = v ? v.y1 : L + m, tw = x1 - x0, tl = y1 - y0;
	const sv = Math.min((r.width - 2 * pad) / tw, (r.height - 2 * pad) / tl), sh = Math.min((r.width - 2 * pad) / tl, (r.height - 2 * pad) / tw);
	const ori = sh > sv * 1.08 ? 'h' : 'v', s = Math.max(.1, ori === 'v' ? sv : sh);
	const ox = ori === 'v' ? (r.width - tw * s) / 2 - x0 * s : (r.width - tl * s) / 2 - (L - y1) * s;
	const oy = ori === 'v' ? (r.height - tl * s) / 2 - y0 * s : (r.height - tw * s) / 2 - x0 * s;
	const p = ori === 'v' ? [ox + ${x} * s, oy + ${y} * s] : [ox + (L - ${y}) * s, oy + ${x} * s];
	return [r.left + p[0], r.top + p[1]];
})()`);
const mouse = (type, [x, y], buttons = 1) => send("Input.dispatchMouseEvent", { type, x, y, button: "left", buttons, clickCount: 1 }, S);
async function drag(a, b, steps = 8) {
	await mouse("mouseMoved", a, 0); await mouse("mousePressed", a);
	for (let i = 1; i <= steps; i++) await mouse("mouseMoved", [a[0] + (b[0] - a[0]) * i / steps, a[1] + (b[1] - a[1]) * i / steps]);
	await mouse("mouseReleased", b, 0); await sleep(120);
}
const tap = async p => { await mouse("mouseMoved", p, 0); await mouse("mousePressed", p); await mouse("mouseReleased", p, 0); await sleep(120); };

// ---- start
await size(1280, 860);
await send("Page.navigate", { url: `http://127.0.0.1:${P_DOCS}/` }, S);
await until(() => ev("document.readyState === 'complete' && !!document.getElementById('boardBtnName').textContent"));
await sleep(400);

console.log("Faner og fjernede formater");
const tabs = await ev("[...document.querySelectorAll('#tabs [data-tab]')].map(b => b.textContent.trim())");
check("fem faner: Hold, Taktik, Tegn, Træning, Kamp", JSON.stringify(tabs) === JSON.stringify(["Hold", "Taktik", "Tegn", "Træning", "Kamp"]), tabs.join(", "));
const html = fs.readFileSync(path.join(ROOT, "docs/index.html"), "utf8");
check("ingen 5 mod 5 / 8 mod 8 i appen", !/5 mod 5|8 mod 8|formatSeg|convert11|changeFormat/.test(html));
check("ingen kampformat-række i tavlemenuen", await ev("!document.getElementById('legacyFormatRow') && !document.getElementById('formatSeg')"));

console.log("Træning: listen og filtrene");
await click("#tab-traening");
await sleep(150);
const list = async () => ev(`({ n: document.querySelectorAll('#drillList .drill-card').length, count: document.getElementById('drillCount').textContent,
	groups: [...document.querySelectorAll('#drillList .drill-group > .group-title')].map(h => h.textContent),
	ids: [...document.querySelectorAll('#drillList .drill-card')].map(c => c.dataset.drill),
	thumbs: [...document.querySelectorAll('#drillList .drill-thumb')].filter(i => i.complete && i.naturalWidth === 192).length,
	tags: [...document.querySelectorAll('#drillList .drill-card')].map(c => [...c.querySelectorAll('.drill-tag')].map(t => t.textContent)) })`);
const all = await list();
check("24 øvelser i 8 kategorier", all.n === 24 && all.groups.length === 8 && all.count === "24 øvelser", `${all.n} øvelser, ${all.groups.length} kategorier, "${all.count}"`);
check("alle 24 miniaturer er tegnet (192 × 144 px)", all.thumbs === 24, `${all.thumbs}`);
const panelVisible = await ev("!document.getElementById('pane-traening').hidden && document.getElementById('workspace').dataset.tab === 'traening'");
check("Træning-ruden vises", panelVisible);
for (const [lv, label] of [["born", "Børn"], ["ungdom", "Ungdom"], ["senior", "Senior"]]) {
	await click(`#drillLevelSeg [data-level="${lv}"]`);
	const l = await list();
	const expect = all.tags.filter(t => t.includes(label)).length;
	check(`filter ${label}: kun ${label}-øvelser (${l.n})`, l.n === expect && l.tags.every(t => t.includes(label)) && l.n > 0, `${l.n} vist, ${expect} forventet`);
}
await click('#drillLevelSeg [data-level="alle"]');
await ev("(() => { const s = document.getElementById('drillCat'); s.value = 'afslutning'; s.dispatchEvent(new Event('change', { bubbles: true })); })()");
let l = await list();
check("kategori Afslutninger: 4 øvelser i én gruppe", l.n === 4 && l.groups.length === 1 && l.groups[0] === "Afslutninger", `${l.n}, ${l.groups}`);
await ev("(() => { const s = document.getElementById('drillCat'); s.value = 'alle'; s.dispatchEvent(new Event('change', { bubbles: true })); })()");
await shot("#panel", "liste.png");

console.log("Hver øvelse: beskrivelse, forhåndsvisning, åbn på tavlen og tavlens indhold");
const near = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const segDist = (p, a, b) => {
	const dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy, t = L2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / L2)) : 0;
	return { d: Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy), t };
};
const report = [];
let boardCount = Object.keys(await boards()).length;
for (const id of all.ids) {
	await click("#tab-traening");
	await click(`#drillList [data-drill="${id}"]`);
	const det = await ev(`({ title: document.querySelector('#drillDetail h3').textContent, secs: [...document.querySelectorAll('#drillDetail .drill-sec h4')].map(h => h.textContent),
		steps: document.querySelectorAll('#drillDetail [data-step]').length, btn: document.getElementById('drillOpenBtn').textContent.trim(),
		facts: document.querySelectorAll('#drillDetail .drill-facts div').length, list: document.getElementById('drillBrowse').hidden })`);
	const sigs = [];
	for (let k = 0; k < det.steps; k++) {
		await click(`#drillDetail [data-step="${k}"]`);
		sigs.push(await ev("(() => { const d = document.getElementById('drillPreview').toDataURL(); let h = 0; for (let i = 0; i < d.length; i += 7) h = (h * 31 + d.charCodeAt(i)) | 0; return h + ':' + d.length; })()"));
	}
	if (id === all.ids[0]) await shot("#panel", "detalje.png");
	const okDetail = det.list && det.secs.join() === "Formål,Organisering,Forløb,Fokuspunkter,Variationer" && det.facts === 3 && det.btn === "Åbn på tavlen" && new Set(sigs).size === det.steps;
	await click("#drillOpenBtn");
	await until(() => ev("document.getElementById('workspace').dataset.tab === 'tegn'"), 3000);
	const b = await saved();
	const name = await ev("document.getElementById('boardBtnName').textContent");
	const nb = Object.keys(await boards()).length;
	const prob = [];
	if (!okDetail) prob.push(`beskrivelse ${JSON.stringify(det)} forhåndsvisninger ${new Set(sigs).size}/${det.steps}`);
	if (!b || b.drill !== id) prob.push("tavlen er ikke gemt med øvelsen");
	if (nb !== boardCount + 1) prob.push(`antal tavler ${boardCount} → ${nb}`);
	boardCount = nb;
	if (b) {
		if (name !== det.title || b.name !== det.title) prob.push(`navn "${name}"`);
		if (b.format !== "11" || b.labels !== "none" || !b.view) prob.push("format/labels/view");
		const off = new Set(b.off), neutral = new Set(b.neutral);
		const vis = [...b.home.map(p => ({ id: p.id, team: "h" })), ...(b.showAway ? b.away.map(p => ({ id: p.id, team: "a" })) : [])].filter(p => !off.has(p.id));
		const V = b.view, inside = (q, pad = .3) => q.x >= V.x0 + pad && q.x <= V.x1 - pad && q.y >= V.y0 + pad && q.y <= V.y1 - pad;
		if (b.away.some(p => !off.has(p.id)) && !b.showAway) prob.push("blå spillere med, men modstanderen er skjult");
		for (const it of b.items) if (!inside(it, 0)) prob.push(`udstyr uden for udsnittet: ${it.type} ${it.x},${it.y}`);
		let minD = Infinity, minWhere = "";
		b.frames.forEach((fr, k) => {
			if (!fr.note || fr.note.length > 200) prob.push(`trin ${k + 1}: note`);
			for (const p of vis) if (!inside(fr.pos[p.id])) prob.push(`trin ${k + 1}: ${p.id} uden for udsnittet`);
			if (!inside(fr.ball, 0)) prob.push(`trin ${k + 1}: bolden uden for udsnittet`);
			for (let i = 0; i < vis.length; i++) for (let j = i + 1; j < vis.length; j++) {
				const d = near(fr.pos[vis[i].id], fr.pos[vis[j].id]);
				if (d < minD) { minD = d; minWhere = `trin ${k + 1}: ${vis[i].id}–${vis[j].id}`; }
			}
			for (const d of fr.drawings) {
				for (const q of d.pts) if (!inside(q, 0)) prob.push(`trin ${k + 1}: ${d.type} uden for udsnittet (${q.x},${q.y})`);
				if (d.type !== "pass") continue;
				// En aflevering, der går tæt forbi en modspiller, ligner en, der bliver opsnappet.
				const a = d.pts[0], z = d.pts[d.pts.length - 1];
				const from = vis.find(p => near(fr.pos[p.id], a) < .05);
				if (!from) { prob.push(`trin ${k + 1}: aflevering starter ikke ved en spiller`); continue; }
				for (const p of vis) {
					if (p.team === from.team || neutral.has(p.id) || neutral.has(from.id) || near(fr.pos[p.id], z) < .05) continue;
					const { d: dd, t } = segDist(fr.pos[p.id], a, z);
					if (dd < 1.6 && t > .12 && t < .9) report.push(`${id} trin ${k + 1}: aflevering ${from.id} går ${dd.toFixed(1)} m fra ${p.id}`);
				}
			}
		});
		if (minD < 1.5) prob.push(`spillere for tæt: ${minD.toFixed(2)} m (${minWhere})`);
		// billeder af hvert trin på den store bane
		for (let k = 0; k < b.frames.length; k++) {
			await click(`#stepChips [data-step="${k}"]`);
			await sleep(450);
			await shot("#board", `${String(all.ids.indexOf(id) + 1).padStart(2, "0")}_${id}_${k + 1}.png`);
		}
		await click('#stepChips [data-step="0"]');
	}
	check(`${det.title}: ${b ? b.frames.length : "?"} trin, ${b ? b.items.length : "?"} stk. udstyr`, !prob.length, prob.slice(0, 4).join("; "));
}
check("ingen afleveringer, der ligner opsnapninger (bortset fra genpressets bevidste)", report.every(r => r.startsWith("genpres trin 1")), report.join(" | "));

console.log("Den åbne øvelse: Vis på tavlen, Mine tavler og billedet");
await click("#tab-traening");
const cur = await ev("({ now: !document.getElementById('drillNow').hidden && document.querySelector('#drillNow b').textContent, detail: !document.getElementById('drillDetail').hidden })");
check("Træning viser den åbne øvelses beskrivelse", cur.detail === true, JSON.stringify(cur));
const btn = await ev("document.getElementById('drillOpenBtn').textContent.trim()");
const before = Object.keys(await boards()).length;
await click("#drillOpenBtn");
await sleep(300);
check("Vis på tavlen skifter til Tegn uden en ny tavle", btn === "Vis på tavlen" && (await ev("document.getElementById('workspace').dataset.tab")) === "tegn" && Object.keys(await boards()).length === before, btn);
await click("#tab-traening"); await click("#drillBack");
const now = await ev("!document.getElementById('drillNow').hidden && document.querySelector('#drillNow b').textContent");
check("listen viser »På tavlen nu«", now === (await ev("document.getElementById('boardBtnName').textContent")), String(now));
await click("#boardBtn");
const meta = await ev("document.querySelector('#boardList .board-item.current .bi-meta').textContent");
check("Mine tavler viser øvelsen som »Øvelse«", meta.startsWith("Øvelse ·") && !/mod \d/.test(meta), meta);
await ev("document.getElementById('boardsDlg').close()");
await click("#shareBtn");
const img = await until(() => ev("(() => { const i = document.getElementById('exportImg'); return !i.hidden && i.complete && i.naturalWidth ? [i.naturalWidth, i.naturalHeight] : null; })()"), 8000);
if (img) {
	const data = await ev("(() => { const i = document.getElementById('exportImg'), c = document.createElement('canvas'); c.width = i.naturalWidth; c.height = i.naturalHeight; c.getContext('2d').drawImage(i, 0, 0); return c.toDataURL('image/png').split(',')[1]; })()");
	fs.writeFileSync(path.join(OUT, "eksport.png"), Buffer.from(data, "base64"));
}
check("billedet af øvelsen kan laves", !!img && img[0] === 1080 && img[1] > 600 && img[1] < 2600, JSON.stringify(img));
await ev("document.getElementById('shareDlg').close()");

console.log("Tekst ud og ind igen (rundtur gennem valideringen)");
const orig = await saved();
await click("#boardBtn");
await ev(`(() => { document.querySelector('#boardsDlg details.paste').open = true; document.getElementById('pasteArea').value = ${JSON.stringify(JSON.stringify(orig))}; document.getElementById('pasteOpen').click(); })()`);
const back = await saved();
const strip = o => JSON.stringify(o, (k, v) => k === "id" && typeof v === "string" && v.length > 6 && !/^[ha]\d+$/.test(v) ? undefined : k === "updated" ? undefined : v);
check("en øvelse kommer uændret tilbage (udstyr, zoom, skjulte, jokere, trin)", back && back.id !== orig.id && strip(back) === strip(orig),
	back ? `items ${back.items.length}/${orig.items.length}, off ${back.off.length}/${orig.off.length}` : "ingen tavle");
await click("#boardBtn");
const legacy = { app: "taktiktavle", board: { ...orig, format: "5" } };
await ev(`(() => { document.querySelector('#boardsDlg details.paste').open = true; document.getElementById('pasteArea').value = ${JSON.stringify(JSON.stringify(legacy))}; document.getElementById('pasteOpen').click(); })()`);
const err = await ev("!document.getElementById('pasteErr').hidden && document.getElementById('pasteErr').textContent");
check("en gammel 5 mod 5-tavle afvises med en forklaring", err === "Tavlen er ikke en 11 mod 11-tavle og kan ikke åbnes.", String(err));
await ev("document.getElementById('boardsDlg').close()");

console.log("Udstyr, zoom og spillere på egen tavle");
await click("#boardBtn"); await click("#newBoardBtn");
await sleep(200);
let nbd = await saved();
check("Ny tavle er 11 mod 11 uden udstyr og zoom", nbd.format === "11" && nbd.items.length === 0 && !nbd.view && nbd.off.length === 0, nbd.name);
await click("#tab-tegn");
await ev("document.querySelector('#toolbar [data-tool=\"item\"]').click()");
await tap(await screenOf(nbd, 20, 60));
nbd = await saved();
check("Udstyr: et tryk sætter en kegle", nbd.items.length === 1 && nbd.items[0].type === "cone" && Math.abs(nbd.items[0].x - 20) < .5 && Math.abs(nbd.items[0].y - 60) < .5,
	JSON.stringify(nbd.items[0]));
await click("#itemBtn");
const pop = await ev("!document.getElementById('itemPop').hidden && [...document.querySelectorAll('#itemPop [data-itemtype]')].map(b => b.dataset.itemtype).join()");
check("udstyrsmenuen: kegle, stang, småmål og mål", pop === "cone,pole,minigoal,goal", String(pop));
await click('#itemPop [data-itemtype="minigoal"]');
await tap(await screenOf(nbd, 40, 70));
nbd = await saved();
const mg = nbd.items.find(i => i.type === "minigoal");
check("småmål sat (nettet væk fra midten: rot 180 på egen halvdel)", mg && mg.rot === 180, JSON.stringify(mg));
const rotVisible = await ev("!document.getElementById('rotBtn').hidden");
await click("#rotBtn");
nbd = await saved();
check("Drej: målet drejes 45°", rotVisible && nbd.items.find(i => i.type === "minigoal").rot === 225, String(nbd.items.find(i => i.type === "minigoal").rot));
const key = async k => { await send("Input.dispatchKeyEvent", { type: "keyDown", key: k, text: k.length === 1 ? k : undefined }, S); await send("Input.dispatchKeyEvent", { type: "keyUp", key: k }, S); await sleep(80); };
await key("r");
nbd = await saved();
const pressed = () => ev("document.querySelector('#toolbar [aria-pressed=\"true\"][data-tool]')?.dataset.tool");
await key("o"); const kO = await pressed();
await key("u"); const kU = await pressed();
await click("#itemBtn"); await key("Escape"); const popClosed = await ev("document.getElementById('itemPop').hidden");
check("taster: R drejer målet, O = zoom, U = udstyr, Escape lukker udstyrsmenuen", nbd.items.find(i => i.type === "minigoal").rot === 270 && kO === "area" && kU === "item" && popClosed,
	`rot ${nbd.items.find(i => i.type === "minigoal").rot}, O ${kO}, U ${kU}, menu lukket ${popClosed}`);
await ev("document.querySelector('#toolbar [data-tool=\"move\"]').click()");
await drag(await screenOf(nbd, 20, 60), await screenOf(nbd, 26, 52));
nbd = await saved();
const cone1 = nbd.items.find(i => i.type === "cone");
check("Flyt: keglen kan trækkes", Math.abs(cone1.x - 26) < .6 && Math.abs(cone1.y - 52) < .6, `${cone1.x},${cone1.y}`);
await tap(await screenOf(nbd, 26, 52));
await click("#delBtn");
nbd = await saved();
check("Slet valgt: keglen fjernes", nbd.items.length === 1 && nbd.items[0].type === "minigoal", nbd.items.map(i => i.type).join());
await ev("document.querySelector('#toolbar [data-tool=\"area\"]').click()");
await drag(await screenOf(nbd, 10, 40), await screenOf(nbd, 50, 80));
nbd = await saved();
const v = nbd.view;
check("Zoom: et felt trækkes op og bliver udsnittet", v && Math.abs(v.x0 - 10) < 1 && Math.abs(v.x1 - 50) < 1 && Math.abs(v.y0 - 40) < 1 && Math.abs(v.y1 - 80) < 1, JSON.stringify(v));
const tool = await ev("document.querySelector('#toolbar [data-tool=\"move\"]').getAttribute('aria-pressed')");
check("efter zoom er værktøjet Flyt igen, og »Hele banen« vises", tool === "true" && await ev("!document.getElementById('fullBtn').hidden"));
await shot("#board", "egen_zoom.png");
await click("#fullBtn");
nbd = await saved();
check("Hele banen: zoom fjernes", nbd.view === null && await ev("document.getElementById('fullBtn').hidden"));
await click("#tab-hold");
const lb = nbd.frames[0].pos.h2;
await tap(await screenOf(nbd, lb.x, lb.y));
const dlg = await ev("document.getElementById('playerDlg').open && !document.getElementById('pdFlags').hidden");
await ev("(() => { const c = document.getElementById('pdOn'); c.checked = false; c.dispatchEvent(new Event('change', { bubbles: true })); })()");
await ev("(() => { const c = document.getElementById('pdJoker'); c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); })()");
nbd = await saved();
check("spillerkortet: »På banen« fra og »Joker« til", dlg && nbd.off.includes("h2") && nbd.neutral.includes("h2"), `off ${nbd.off}, neutral ${nbd.neutral}`);
await ev("document.getElementById('playerDlg').close()");
await sleep(150);
const roster = await ev("({ off: document.querySelectorAll('#rosterList li.off').length, note: !document.getElementById('offNote').hidden && document.getElementById('offNoteText').textContent })");
check("holdlisten viser spilleren som ikke på banen", roster.off === 1 && roster.note === "Én spiller er ikke på banen.", JSON.stringify(roster));
await drag(await screenOf(nbd, lb.x, lb.y), await screenOf(nbd, lb.x + 6, lb.y - 6));
nbd = await saved();
check("en skjult spiller kan ikke trækkes", nbd.frames[0].pos.h2.x === lb.x && nbd.frames[0].pos.h2.y === lb.y);
await click("#showAllBtn");
nbd = await saved();
check("Vis alle: spilleren er på banen igen", nbd.off.length === 0 && await ev("document.getElementById('offNote').hidden"));

console.log("Telefon og telefon på tværs");
for (const [w, h, name] of [[375, 812, "telefon"], [360, 640, "telefon_lille"], [844, 390, "tvaers"], [667, 375, "tvaers_lille"]]) {
	await size(w, h, true);
	await sleep(250);
	await click("#tab-traening");
	await sleep(200);
	const lay = await ev(`({ cls: document.documentElement.className, over: document.documentElement.scrollWidth - innerWidth,
		tabs: [...document.querySelectorAll('#tabs button')].map(b => b.scrollWidth - b.clientWidth).filter(x => x > 1).length,
		panel: Math.round(document.getElementById('panel').getBoundingClientRect().height) })`);
	await send("Page.captureScreenshot", { format: "png" }, S).then(({ data }) => fs.writeFileSync(path.join(OUT, `${name}_traening.png`), Buffer.from(data, "base64")));
	check(`${name} ${w}×${h}: ingen vandret rul og ingen fane-tekst skåret af`, lay.over <= 0 && lay.tabs === 0, JSON.stringify(lay));
}
await size(1280, 860);

check("ingen fejl i konsollen", errors.length === 0, errors.slice(0, 3).join(" | "));
console.log(`\n${passes} OK, ${fails} FEJL. Billeder: ${OUT}`);
process.exit(fails ? 1 : 0);
