// Test af MG Games-kontoen i Taktiktavle (Morten 4/10: "gem lokalt uden login, nyeste vinder"): to "enheder" (appen på
// 127.0.0.1 og på localhost = to adskilte lagre) i headless Chrome mod MG Games-serveren kørt lokalt
// (MGGamesLauncher/server/test/local.mjs, den rigtige serverkode). Testen klikker og udfylder som en bruger og tjekker
// serveren direkte. Brug: node tools/konto_test.mjs [sti til MGGamesLauncher]   (kør python3 build.py først)
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const LAUNCHER = path.resolve(process.argv[2] || path.join(os.homedir(), "Claude/MGGamesLauncher"));
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "tt_konto_"));
const port = () => 20000 + Math.floor(Math.random() * 20000);
const [P_API, P_DOCS, P_CDP] = [port(), port(), port()];
const API = `http://127.0.0.1:${P_API}/v1`;
const sleep = ms => new Promise(r => setTimeout(r, ms));
let passes = 0, fails = 0;
const check = (name, ok, detail = "") => {
	if (ok) passes++; else fails++;
	console.log(`  ${ok ? "OK  " : "FEJL"} ${name}${detail ? "  — " + detail : ""}`);
};
async function until(f, ms = 15000, step = 150) {
	const t0 = Date.now();
	for (;;) {
		try { const v = await f(); if (v) return v; } catch (_) {}
		if (Date.now() - t0 > ms) return null;
		await sleep(step);
	}
}

// ---- servere og Chrome
fs.mkdirSync(path.join(TMP, "r2"));
const procs = [];
const run = (cmd, args, opts = {}) => { const p = spawn(cmd, args, { stdio: "ignore", ...opts }); procs.push(p); return p; };
run(process.execPath, [path.join(LAUNCHER, "server/test/local.mjs"), String(P_API), path.join(TMP, "r2"), path.join(TMP, "db.sqlite")]);
run("python3", ["-m", "http.server", String(P_DOCS), "--bind", "127.0.0.1", "--directory", path.join(ROOT, "docs")]);
run(CHROME, ["--headless=new", `--remote-debugging-port=${P_CDP}`, `--user-data-dir=${path.join(TMP, "chrome")}`, "--no-first-run",
	"--no-default-browser-check", "about:blank"]);
const cleanup = () => { for (const p of procs) { try { p.kill(); } catch (_) {} } };
process.on("exit", cleanup);
const ver = await until(async () => (await fetch(`http://127.0.0.1:${P_CDP}/json/version`)).json(), 20000);
await until(async () => (await fetch(`http://127.0.0.1:${P_DOCS}/`)).ok);
await until(async () => (await fetch(`${API}/me`)).status === 401);

// ---- en lille CDP-klient
const ws = new WebSocket(ver.webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener("open", r, { once: true }));
let seq = 0;
const pending = new Map();
ws.addEventListener("message", ev => {
	const m = JSON.parse(ev.data);
	if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id); m.error ? rej(new Error(m.error.message)) : res(m.result); }
});
const send = (method, params = {}, sessionId) => new Promise((res, rej) => {
	const id = ++seq; pending.set(id, { res, rej });
	ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
});
async function device(host) {
	const { targetId } = await send("Target.createTarget", { url: "about:blank" });
	const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
	await send("Network.enable", {}, sessionId);
	const ev = async expr => {
		const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true }, sessionId);
		if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
		return r.result.value;
	};
	const d = {
		ev,
		async open() {
			await send("Page.navigate", { url: `http://${host}:${P_DOCS}/?mgapi=${encodeURIComponent(API)}` }, sessionId);
			await until(() => ev("!!document.getElementById('acct') && document.readyState === 'complete' && !!document.getElementById('boardBtnName').textContent"));
			await sleep(300);
		},
		offline: on => send("Network.emulateNetworkConditions", { offline: on, latency: 0, downloadThroughput: -1, uploadThroughput: -1 }, sessionId),
		boards: () => ev("JSON.parse(localStorage.getItem('taktiktavle:v1:boards') || '{}')"),
		openName: () => ev("document.getElementById('boardBtnName').textContent"),
		state: () => ev("document.getElementById('acct').dataset.state"),
		status: () => ev("document.getElementById('acctStatus').textContent"),
		token: () => ev("(JSON.parse(localStorage.getItem('taktiktavle:v1:account') || '{}')).token || ''"),
		async rename(name) {
			await ev(`(() => { const i = document.getElementById('boardName'); i.value = ${JSON.stringify(name)};
				i.dispatchEvent(new Event('input')); i.dispatchEvent(new Event('change')); return true; })()`);
			// (appen gemmer 300 ms efter en ændring; Chrome forsinker timere i faneblade i baggrunden: vent, til den er gemt)
			await until(() => ev(`(() => { const all = JSON.parse(localStorage.getItem('taktiktavle:v1:boards') || '{}');
				const b = all[localStorage.getItem('taktiktavle:v1:last')]; return !!b && b.name === ${JSON.stringify(JSON.stringify(name))}; })()`), 5000);
		},
		async sync() {
			await ev("document.getElementById('acctStatus').textContent = ''; document.getElementById('acctSync').click(); true");
			return until(async () => { const s = await d.status(); return s && !s.startsWith("Synkroniserer") ? s : null; });
		},
		async account(mode, { name, email, password }, remember = true) {
			await ev(`(() => { document.getElementById('boardBtn').click();
				document.querySelector('#acctMode [data-mode="${mode}"]').click();
				document.getElementById('acctRemember').checked = ${remember};
				const set = (id, v) => { const e = document.getElementById(id); if (e) e.value = v; };
				set('acctName', ${JSON.stringify(name || "")}); set('acctEmail', ${JSON.stringify(email)});
				set('acctPass', ${JSON.stringify(password)}); set('acctPass2', ${JSON.stringify(password)});
				document.getElementById('acctForm').requestSubmit(); return true; })()`);
		},
		async openBoard(id) {
			await ev(`(() => { document.getElementById('boardBtn').click();
				const b = document.querySelector('#boardList [data-id="${id}"] [data-act="open"]'); if (b) b.click(); return !!b; })()`);
			await sleep(200);
		},
		async newBoard(name) {
			await ev("document.getElementById('boardBtn').click(); document.getElementById('newBoardBtn').click(); true");
			await sleep(400);
			await d.rename(name);
			return ev("localStorage.getItem('taktiktavle:v1:last')");
		},
		async del(id) {
			await ev(`(() => { document.getElementById('boardBtn').click();
				const b = document.querySelector('#boardList [data-id="${id}"] [data-act="del"]'); b.click(); b.click(); return true; })()`);
			await sleep(200);
		},
	};
	return d;
}
const slots = async token => ((await (await fetch(`${API}/saves/taktiktavle`, { headers: { authorization: `Bearer ${token}` } })).json()).saves || []);
const slotText = async (token, slot) => (await fetch(`${API}/saves/taktiktavle/${slot}`, { headers: { authorization: `Bearer ${token}` } })).text();
const USER = { name: "Træner", email: "traener@eksempel.dk", password: "taktik-1234" };

console.log("Taktiktavle — MG Games-kontoen (to enheder, lokal server)");
const A = await device("127.0.0.1"), B = await device("localhost");
await A.open(); await B.open();
check("uden login: tavlerne gemmes på enheden, kontoen vises som logget ud", (await A.state()) === "out" && Object.keys(await A.boards()).length === 1);

// opret konto på A; en ny tavle kommer på kontoen, den urørte eksempeltavle bliver på enheden
const a1 = await A.newBoard("Tavle A1");
await A.account("register", USER);
const stA = await until(async () => (await A.state()) === "in" && (await A.status()).startsWith("Gemt") ? A.status() : null);
check("opret konto på A: logget ind, og første synkronisering er gemt", !!stA, String(stA));
await A.open();
check("Husk mig (standard): A er stadig logget ind efter genindlæsning", (await A.state()) === "in");
const tA = await A.token();
let L = await slots(tA);
check("kontoen har A's nye tavle, men ikke den urørte eksempeltavle", L.some(x => x.slot === a1) && L.length === 1, JSON.stringify(L.map(x => x.slot)));

// log ind på B: A's tavle hentes
await B.account("login", USER);
const gotB = await until(async () => (await B.boards())[a1]);
check("log ind på B: A's tavle er hentet til B", !!gotB && gotB.name === "Tavle A1");
L = await slots(tA);
check("B's urørte eksempeltavle kom ikke på kontoen", L.length === 1, JSON.stringify(L.map(x => x.slot)));

// B ændrer tavlen; A får den nyeste
await B.openBoard(a1);
await B.rename("Tavle A1 ændret på B");
await B.sync();
await A.sync();
check("ændring på B når A, også den åbne tavle", (await A.openName()) === "Tavle A1 ændret på B", await A.openName());

// nyeste vinder: A ændrer offline først, B ændrer senere og synkroniserer; A går online
await A.offline(true);
await A.rename("Konflikt: A (ældst)");
const stOff = await A.sync();
const offName = (await A.boards())[a1]?.name, offOpen = await A.openName();
check("uden net: A siger det og beholder ændringen på enheden", /Ingen forbindelse/.test(stOff || "") && offName === "Konflikt: A (ældst)",
	`status: ${stOff} | gemt: ${offName} | åben: ${offOpen}`);
await sleep(30);
await B.rename("Konflikt: B (nyest)");
await B.sync();
await A.offline(false);
await A.sync();
check("nyeste vinder: B's senere ændring vinder over A's ældre", (await A.openName()) === "Konflikt: B (nyest)" && JSON.parse(await slotText(tA, a1)).name === "Konflikt: B (nyest)", await A.openName());
// og omvendt: A's nyeste ændring vinder
await B.offline(true);
await B.rename("Konflikt 2: B (ældst)");
await sleep(30);
await A.rename("Konflikt 2: A (nyest)");
await A.sync();
await B.offline(false);
await B.sync();
check("nyeste vinder: A's senere ændring vinder over B's ældre (B var uden net)", (await B.openName()) === "Konflikt 2: A (nyest)", await B.openName());

// sletning når den anden enhed; en senere ændring dér vinder over en ældre sletning
const a2 = await A.newBoard("Slettes");
await A.sync(); await B.sync();
check("ny tavle fra A er på B", !!(await B.boards())[a2]);
await A.del(a2);
await A.sync();
L = await slots(tA);
check("sletning på A: tavlen er væk fra kontoen, og sletningen er husket", !L.some(x => x.slot === a2) && JSON.parse(await slotText(tA, "-slettede"))[a2] > 0);
await B.sync();
check("sletning på A: tavlen er også væk på B", !(await B.boards())[a2]);
const a3 = await A.newBoard("Slettes, men ændres senere");
await A.sync(); await B.sync();
await B.offline(true);
await B.openBoard(a3);
await A.del(a3); await A.sync();
await sleep(30);
await B.rename("Ændret efter sletningen");
await B.offline(false); await B.sync(); await A.sync();
check("nyeste vinder: en ændring efter en sletning bringer tavlen tilbage", (await A.boards())[a3]?.name === "Ændret efter sletningen");

// ingen synkronisering i tomgang (ingen løkke)
await A.ev("window.__kald = 0; const f0 = window.fetch; window.fetch = (...a) => { window.__kald++; return f0(...a); }; true");
await sleep(12000);
check("ingen kald til serveren i 12 s tomgang (ingen synkroniseringsløkke)", (await A.ev("window.__kald")) === 0, `kald: ${await A.ev("window.__kald")}`);

// udløbet login på B (serveren glemmer det), log ud på A, slet tavlerne på kontoen
const tB = await B.token();
await fetch(`${API}/logout`, { method: "POST", headers: { authorization: `Bearer ${tB}` } });
await B.sync();
const exp = await until(async () => (await B.state()) === "out");
check("udløbet login på B: logget ud, besked vist, tavlerne ligger der stadig",
	!!exp && /udløbet/.test(await B.ev("document.getElementById('acctErr').textContent")) && !!(await B.boards())[a1]);
await A.ev("document.getElementById('boardBtn').click(); document.getElementById('acctLogout').click(); true");
await until(async () => (await A.state()) === "out");
check("log ud på A: serveren har glemt login'et, tavlerne ligger der stadig",
	(await fetch(`${API}/me`, { headers: { authorization: `Bearer ${tA}` } })).status === 401 && !!(await A.boards())[a1]);
await A.account("login", { email: USER.email, password: "forkert-kode" });
const wrong = await until(() => A.ev("document.getElementById('acctErr').hidden ? '' : document.getElementById('acctErr').textContent"));
check("forkert adgangskode: serverens besked vises", /Forkert e-mail eller adgangskode/.test(wrong || ""), wrong);
await A.account("login", USER);
await until(async () => (await A.state()) === "in" && (await A.status()).startsWith("Gemt"));
const tA2 = await A.token();
await A.ev("document.getElementById('boardBtn').click(); const w = document.getElementById('acctWipe'); w.click(); w.click(); true");
await until(async () => (await A.state()) === "out");
L = await slots(tA2).catch(() => null);
const t3 = await (await fetch(`${API}/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: USER.email, password: USER.password }) })).json();
L = await slots(t3.token);
check("slet mine tavler på kontoen: kontoen er tom, A er logget ud, tavlerne ligger stadig på A",
	L.length === 0 && (await A.state()) === "out" && !!(await A.boards())[a1], JSON.stringify(L.map(x => x.slot)));

// Husk mig: e-mailen huskes; uden Husk mig glemmes login'et i en ny fane (sessionStorage), med Husk mig huskes det
check("efter log ud: e-mailen står udfyldt", (await A.ev("document.getElementById('acctEmail').value")) === USER.email,
	await A.ev("document.getElementById('acctEmail').value"));
await A.account("login", USER, false);
await until(async () => (await A.state()) === "in");
const stores = await A.ev("({ fast: !!localStorage.getItem('taktiktavle:v1:account'), fane: !!sessionStorage.getItem('taktiktavle:v1:account') })");
check("uden Husk mig: login'et ligger kun i fanen, ikke i det faste lager", stores.fane && !stores.fast, JSON.stringify(stores));
await A.open();
check("uden Husk mig: stadig logget ind efter genindlæsning i samme fane", (await A.state()) === "in");
const C = await device("127.0.0.1");
await C.open();
check("uden Husk mig: en ny fane er logget ud", (await C.state()) === "out");
await A.ev("document.getElementById('boardBtn').click(); document.getElementById('acctLogout').click(); true");
await until(async () => (await A.state()) === "out");
await A.account("login", USER, true);
await until(async () => (await A.state()) === "in");
const D = await device("127.0.0.1");
await D.open();
check("med Husk mig: en ny fane er logget ind", (await D.state()) === "in");

console.log(`RESULTAT: ${fails === 0 ? "PASS" : "FAIL"}  ${passes} OK, ${fails} FEJL`);
ws.close();
cleanup();
process.exit(fails === 0 ? 0 : 1);
