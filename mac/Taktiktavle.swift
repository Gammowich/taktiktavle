// Taktiktavle til Mac: appen fra GitHub Pages i sit eget vindue (WKWebView), så MG Games-launcheren kan starte den som
// Viking Legacy og SWAAG. Appen selv opdateres stadig via Pages; dette program skal kun bygges igen, når det ændres.
// Byg: mac/build.sh. Røgtest: Taktiktavle.app/Contents/MacOS/Taktiktavle --smoke[=nøgle] [--headless] [--snapshot=fil.png]
import AppKit
import WebKit

let defaultURL = "https://gammowich.github.io/taktiktavle/"
let appURL = URL(string: ProcessInfo.processInfo.environment["TAKTIKTAVLE_URL"] ?? defaultURL)!

/// MG Games-launcherens login (<data>/MG Games/session.json, som spillene læser; MG_SESSION overstyrer stien), som
/// appen bruger til at gemme tavlerne på kontoen. Kun id, navn, e-mail, token og serverens adresse. nil uden login.
func launcherSession(smoke: Bool) -> [String: Any]? {
    let env = ProcessInfo.processInfo.environment["MG_SESSION"] ?? ""
    if smoke && env.isEmpty { return nil }   // (røgtesten må aldrig bruge det rigtige login: kun MG_SESSION fra testen)
    let path = env.isEmpty
        ? FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent("Library/Application Support/MG Games/session.json").path
        : env
    guard let data = FileManager.default.contents(atPath: path),
          let o = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
          let token = o["token"] as? String, token.count >= 20 else { return nil }
    let user = o["user"] as? [String: Any] ?? o   // (launcheren gemmer {api, token, user: {id, name, email}})
    var out: [String: Any] = ["token": token]
    if let v = o["api"] as? String { out["api"] = v }
    for k in ["id", "name", "email"] { if let v = user[k] { out[k] = v } }
    return out
}

func say(_ s: String) {
    print("[taktiktavle] " + s)
    fflush(stdout)
}

/// Kommandolinjen. Ukendte argumenter (fx Godots --headless fra launcherens test) ignoreres, undtagen dem herunder.
struct Options {
    var smoke: String? = nil        // --smoke[=nøgle]: røgtest, skriver "[taktiktavle] RØGTEST OK …" og lukker
    var headless = false            // --headless: vinduet vises ikke
    var quitAfter: Double? = nil    // --quit-after N: luk efter N billeder (som Godot: N / 60 s)
    var snapshot: String? = nil     // --snapshot=fil.png: billede af siden i røgtesten
    var closeAfter: Double? = nil   // --close-window-after S: luk vinduet efter S sekunder (test af "luk vinduet = slut")

    init(_ args: [String]) {
        var i = 1
        while i < args.count {
            let a = args[i]
            if a == "--smoke" { smoke = String(Int(Date().timeIntervalSince1970)) }
            else if a.hasPrefix("--smoke=") { smoke = String(a.dropFirst(8)) }
            else if a == "--headless" { headless = true }
            else if a == "--quit-after", i + 1 < args.count { quitAfter = (Double(args[i + 1]) ?? 600) / 60; i += 1 }
            else if a.hasPrefix("--snapshot=") { snapshot = String(a.dropFirst(11)) }
            else if a == "--close-window-after", i + 1 < args.count { closeAfter = Double(args[i + 1]); i += 1 }
            i += 1
        }
    }
}

/// I røgtesten tager vinduet imod første klik, også når det ikke er aktivt (testen må ikke tage fokus fra andre
/// programmer). Ellers som et almindeligt vindue: første klik aktiverer det.
final class TTWebView: WKWebView {
    var firstMouse = false
    override func acceptsFirstMouse(for event: NSEvent?) -> Bool { firstMouse || super.acceptsFirstMouse(for: event) }
}

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate, NSWindowDelegate, WKNavigationDelegate, WKUIDelegate, WKDownloadDelegate {
    let opts = Options(CommandLine.arguments)
    var window: NSWindow!
    var web: WKWebView!
    var triedCache = false
    var cacheNav: WKNavigation? = nil
    var terminating = false
    var smokeStarted = false
    var smokeOpenFile: URL? = nil
    var smokeDownloadDone: ((URL?) -> Void)? = nil
    var smokeGen = 0
    var exitCode: Int32 = 0
    var hasLauncherSession = false

    // MARK: start

    func applicationDidFinishLaunching(_ note: Notification) {
        buildMenu()
        let cfg = WKWebViewConfiguration()
        cfg.applicationNameForUserAgent = "TaktiktavleMac/1.0"
        if let sess = launcherSession(smoke: opts.smoke != nil), let json = try? JSONSerialization.data(withJSONObject: sess),
           let text = String(data: json, encoding: .utf8), let origin = appURL.scheme.map({ "\($0)://\(appURL.host ?? "")" + (appURL.port.map { ":\($0)" } ?? "") }) {
            // Kun på Taktiktavles egen side (ikke fx forklaringssiden uden net).
            let src = "if (location.origin === \(jsString(origin))) window.__mgLauncherSession = \(text);"
            cfg.userContentController.addUserScript(WKUserScript(source: src, injectionTime: .atDocumentStart, forMainFrameOnly: true))
            hasLauncherSession = true
        }
        if opts.smoke != nil {
            // Røgtesten bruger sit eget lager, så den aldrig rører de rigtige tavler.
            if #available(macOS 14.0, *) {
                cfg.websiteDataStore = WKWebsiteDataStore(forIdentifier: UUID(uuidString: "7A6B7469-6B74-6176-6C65-726F65677465")!)
            } else {
                cfg.websiteDataStore = .nonPersistent()
            }
        }
        let tw = TTWebView(frame: NSRect(x: 0, y: 0, width: 1280, height: 820), configuration: cfg)
        tw.firstMouse = opts.smoke != nil
        web = tw
        web.navigationDelegate = self
        web.uiDelegate = self
        web.allowsBackForwardNavigationGestures = false
        if #available(macOS 12.0, *) { web.underPageBackgroundColor = Self.background }
        if #available(macOS 13.3, *) { web.isInspectable = true }

        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1280, height: 820),
                          styleMask: [.titled, .closable, .miniaturizable, .resizable], backing: .buffered, defer: false)
        window.title = "Taktiktavle"
        window.minSize = NSSize(width: 400, height: 520)
        window.isReleasedWhenClosed = false
        window.tabbingMode = .disallowed
        window.backgroundColor = Self.background
        window.contentView = web
        window.delegate = self
        if !window.setFrameUsingName("Taktiktavle") { window.center() }
        window.setFrameAutosaveName("Taktiktavle")
        if opts.smoke != nil {
            if !opts.headless { window.orderFrontRegardless() }   // (vises, men tager ikke fokus)
        } else if !opts.headless {
            window.makeKeyAndOrderFront(nil)
            NSApp.activate(ignoringOtherApps: true)
        }
        if let c = opts.closeAfter {
            DispatchQueue.main.asyncAfter(deadline: .now() + c) { self.window.performClose(nil) }
        }
        if let q = opts.quitAfter {
            runLoopTimer(q) { NSApp.terminate(nil) }
        }
        if opts.smoke != nil {
            DispatchQueue.main.asyncAfter(deadline: .now() + 90) { self.smokeFail("tidsgrænse (90 s)") }
        }
        web.load(URLRequest(url: appURL))
    }

    /// Samme baggrund som appen (mørkt og lyst tema), så vinduet ikke blinker hvidt.
    static let background = NSColor(name: nil) { a in
        a.bestMatch(from: [.darkAqua, .aqua]) == .darkAqua
            ? NSColor(srgbRed: 0x0c / 255, green: 0x12 / 255, blue: 0x0e / 255, alpha: 1)
            : NSColor(srgbRed: 0xe7 / 255, green: 0xec / 255, blue: 0xe8 / 255, alpha: 1)
    }

    func applicationWillTerminate(_ note: Notification) {
        if exitCode != 0 { exit(exitCode) }
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }

    /// Ved lukning: appen gemmer 300 ms efter en ændring og straks ved "pagehide" (flushSave). Programmet sender
    /// pagehide, som en browser gør, når en side lukkes, og venter på appens taktiktavleBeforeQuit (synkronisering med
    /// MG Games-kontoen), dog højst 4 s. (Appens øvrige funktioner er ikke globale.)
    func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
        if terminating || web == nil { return .terminateNow }
        terminating = true
        var replied = false
        let reply = {
            if replied { return }
            replied = true
            NSApp.reply(toApplicationShouldTerminate: true)
        }
        // Appen gemmer på enheden (pagehide) og, med login, på MG Games-kontoen (taktiktavleBeforeQuit). Højst 4 s.
        web.callAsyncJavaScript("""
            window.dispatchEvent(new Event('pagehide'));
            if (window.taktiktavleBeforeQuit) await window.taktiktavleBeforeQuit();
            return true;
            """, arguments: [:], in: nil, in: .page) { _ in
            runLoopTimer(0.2) { reply() }
        }
        runLoopTimer(4.0) { reply() }   // (hvis siden eller nettet ikke svarer)
        return .terminateLater
    }

    // MARK: menuer

    func buildMenu() {
        let main = NSMenu()
        func sub(_ title: String, _ items: [NSMenuItem]) {
            let it = NSMenuItem(title: title, action: nil, keyEquivalent: "")
            let m = NSMenu(title: title)
            items.forEach { m.addItem($0) }
            it.submenu = m
            main.addItem(it)
        }
        func item(_ t: String, _ a: Selector?, _ k: String, _ mods: NSEvent.ModifierFlags = .command) -> NSMenuItem {
            let i = NSMenuItem(title: t, action: a, keyEquivalent: k)
            i.keyEquivalentModifierMask = mods
            return i
        }
        let reload = item("Genindlæs", #selector(reloadPage), "r")
        reload.target = self
        sub("Taktiktavle", [
            item("Om Taktiktavle", #selector(NSApplication.orderFrontStandardAboutPanel(_:)), ""),
            .separator(),
            item("Skjul Taktiktavle", #selector(NSApplication.hide(_:)), "h"),
            item("Skjul andre", #selector(NSApplication.hideOtherApplications(_:)), "h", [.command, .option]),
            item("Vis alle", #selector(NSApplication.unhideAllApplications(_:)), ""),
            .separator(),
            item("Slut Taktiktavle", #selector(NSApplication.terminate(_:)), "q"),
        ])
        sub("Rediger", [
            item("Fortryd", Selector(("undo:")), "z"),
            item("Gentag", Selector(("redo:")), "z", [.command, .shift]),
            .separator(),
            item("Klip", #selector(NSText.cut(_:)), "x"),
            item("Kopiér", #selector(NSText.copy(_:)), "c"),
            item("Sæt ind", #selector(NSText.paste(_:)), "v"),
            item("Markér alt", #selector(NSText.selectAll(_:)), "a"),
        ])
        sub("Vis", [
            reload,
            .separator(),
            item("Slå fuld skærm til/fra", #selector(NSWindow.toggleFullScreen(_:)), "f", [.command, .control]),
        ])
        sub("Vindue", [
            item("Minimér", #selector(NSWindow.performMiniaturize(_:)), "m"),
            item("Zoom", #selector(NSWindow.performZoom(_:)), ""),
            item("Luk", #selector(NSWindow.performClose(_:)), "w"),
        ])
        NSApp.mainMenu = main
    }

    @objc func reloadPage() {
        triedCache = false
        cacheNav = nil
        web.load(URLRequest(url: appURL))
    }

    // MARK: navigation

    func isAppURL(_ u: URL) -> Bool {
        u.scheme == appURL.scheme && u.host == appURL.host && u.port == appURL.port && u.path.hasPrefix(appURL.path)
    }

    func webView(_ w: WKWebView, decidePolicyFor a: WKNavigationAction,
                 decisionHandler: @escaping @MainActor @Sendable (WKNavigationActionPolicy) -> Void) {
        if a.shouldPerformDownload { decisionHandler(.download); return }
        guard let u = a.request.url, let s = u.scheme?.lowercased() else { decisionHandler(.cancel); return }
        if ["blob", "data", "about"].contains(s) || isAppURL(u) { decisionHandler(.allow); return }
        if (s == "http" || s == "https") && a.targetFrame?.isMainFrame == false { decisionHandler(.allow); return }
        NSWorkspace.shared.open(u)   // andre sider og mailto: i standardprogrammet
        decisionHandler(.cancel)
    }

    func webView(_ w: WKWebView, decidePolicyFor r: WKNavigationResponse,
                 decisionHandler: @escaping @MainActor @Sendable (WKNavigationResponsePolicy) -> Void) {
        if r.isForMainFrame, let h = r.response as? HTTPURLResponse, h.statusCode >= 400, let u = h.url, isAppURL(u) {
            decisionHandler(.cancel)
            cacheNav = nil   // (afbrydelsen, der følger, er vores egen og ikke en ny fejl)
            loadFailed("serveren svarede \(h.statusCode)")
            return
        }
        decisionHandler(r.canShowMIMEType ? .allow : .download)
    }

    func webView(_ w: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) { download.delegate = self }
    func webView(_ w: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) { download.delegate = self }

    func webView(_ w: WKWebView, didFailProvisionalNavigation nav: WKNavigation!, withError error: Error) {
        let e = error as NSError
        if nav != nil && nav === cacheNav {   // (cache-forsøget: en tom cache ender som "annulleret")
            cacheNav = nil
            loadFailed(e.code == NSURLErrorCancelled ? "ingen forbindelse, og intet gemt fra sidst" : e.localizedDescription)
            return
        }
        if e.domain == NSURLErrorDomain && e.code == NSURLErrorCancelled { return }   // (afløst af en ny indlæsning)
        if e.domain == "WebKitErrorDomain" && e.code == 102 { return }   // (afbrudt af os: se fejlkoderne herunder)
        loadFailed(e.localizedDescription)
    }

    /// Siden kunne ikke hentes (ingen forbindelse, eller serveren svarede med en fejl): først den udgave, der ligger i
    /// cachen fra sidste gang; ellers en side, der forklarer det.
    func loadFailed(_ why: String) {
        if opts.smoke != nil { say("(kunne ikke hentes: \(why); cache prøvet: \(triedCache))") }
        if !triedCache {
            triedCache = true
            var req = URLRequest(url: appURL)
            req.cachePolicy = .returnCacheDataDontLoad
            DispatchQueue.main.async { self.cacheNav = self.web.load(req) }   // (ikke midt i WebKits egen fejlmelding)
            return
        }
        showOffline(why)
        if opts.smoke != nil {
            after(1.5) {
                if let path = self.opts.snapshot { self.web.takeSnapshot(with: nil) { img, _ in
                    if let t = img?.tiffRepresentation, let png = NSBitmapImageRep(data: t)?.representation(using: .png, properties: [:]) {
                        try? png.write(to: URL(fileURLWithPath: path))
                    }
                    self.smokeFail("siden kunne ikke hentes (\(why)); forklaringen vises")
                } } else { self.smokeFail("siden kunne ikke hentes (\(why)); forklaringen vises") }
            }
        }
    }

    func webView(_ w: WKWebView, didFinish nav: WKNavigation!) {
        if nav === cacheNav { cacheNav = nil }
        if opts.smoke != nil && !smokeStarted && w.url.map(isAppURL) == true {
            smokeStarted = true
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { self.smokeRun() }
        }
    }

    func webViewWebContentProcessDidTerminate(_ w: WKWebView) { w.reload() }

    func showOffline(_ why: String) {
        let html = """
        <!doctype html><html lang="da"><meta charset="utf-8"><style>
        :root{color-scheme:light dark}body{margin:0;min-height:100vh;display:grid;place-items:center;font:16px/1.5 -apple-system,system-ui,sans-serif;
        background:#e7ece8;color:#142019}@media(prefers-color-scheme:dark){body{background:#0c120e;color:#e3eae5}}
        main{max-width:440px;padding:24px;text-align:center}small{opacity:.65}a{display:inline-block;margin-top:12px;padding:10px 18px;
        border-radius:10px;background:#c2410c;color:#fff;font-weight:600;text-decoration:none}</style><main>
        <h1>Taktiktavle kunne ikke hentes</h1><p>Appen hentes fra nettet. Første gang skal Macen være på nettet; derefter åbner
        den også uden.</p><p><small>\(escapeHTML(why))</small></p><a href="\(appURL.absoluteString)">Prøv igen</a></main></html>
        """
        triedCache = false
        web.loadHTMLString(html, baseURL: nil)
    }

    // MARK: vinduer, filvalg og beskeder fra siden

    func webView(_ w: WKWebView, createWebViewWith c: WKWebViewConfiguration, for a: WKNavigationAction,
                 windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let u = a.request.url { NSWorkspace.shared.open(u) }
        return nil
    }

    func webView(_ w: WKWebView, runOpenPanelWith p: WKOpenPanelParameters, initiatedByFrame f: WKFrameInfo,
                 completionHandler: @escaping @MainActor @Sendable ([URL]?) -> Void) {
        if opts.smoke != nil {
            completionHandler(smokeOpenFile.map { [$0] })
            smokeOpenFile = nil
            return
        }
        let panel = NSOpenPanel()
        panel.canChooseFiles = true
        panel.canChooseDirectories = false
        panel.allowsMultipleSelection = p.allowsMultipleSelection
        panel.beginSheetModal(for: window) { r in completionHandler(r == .OK ? panel.urls : nil) }
    }

    func webView(_ w: WKWebView, runJavaScriptAlertPanelWithMessage m: String, initiatedByFrame f: WKFrameInfo,
                 completionHandler: @escaping @MainActor @Sendable () -> Void) {
        let a = NSAlert()
        a.messageText = m
        a.beginSheetModal(for: window) { _ in completionHandler() }
    }

    func webView(_ w: WKWebView, runJavaScriptConfirmPanelWithMessage m: String, initiatedByFrame f: WKFrameInfo,
                 completionHandler: @escaping @MainActor @Sendable (Bool) -> Void) {
        let a = NSAlert()
        a.messageText = m
        a.addButton(withTitle: "OK")
        a.addButton(withTitle: "Annullér")
        a.beginSheetModal(for: window) { r in completionHandler(r == .alertFirstButtonReturn) }
    }

    // MARK: hentninger (Del → Gem billede / Gem som fil)

    func download(_ d: WKDownload, decideDestinationUsing response: URLResponse, suggestedFilename: String,
                  completionHandler: @escaping @MainActor @Sendable (URL?) -> Void) {
        if opts.smoke != nil {
            // Røgtesten svarer først efter 6 s: siden frigiver filens blob-adresse efter 5 s, ligesom når man tøver i
            // gem-vinduet.
            let dir = FileManager.default.temporaryDirectory.appendingPathComponent("taktiktavle-roegtest", isDirectory: true)
            try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
            let dest = dir.appendingPathComponent(suggestedFilename)
            try? FileManager.default.removeItem(at: dest)
            DispatchQueue.main.asyncAfter(deadline: .now() + 6) { completionHandler(dest) }
            return
        }
        let panel = NSSavePanel()
        panel.nameFieldStringValue = suggestedFilename
        panel.directoryURL = FileManager.default.urls(for: .downloadsDirectory, in: .userDomainMask).first
        panel.beginSheetModal(for: window) { r in
            guard r == .OK, let u = panel.url else { completionHandler(nil); return }
            try? FileManager.default.removeItem(at: u)   // (gem-vinduet har allerede spurgt, om den skal erstattes)
            completionHandler(u)
        }
    }

    func downloadDidFinish(_ d: WKDownload) {
        if let cb = smokeDownloadDone {
            smokeDownloadDone = nil
            cb(d.progress.fileURL)
        }
    }

    func download(_ d: WKDownload, didFailWithError error: Error, resumeData: Data?) {
        if let cb = smokeDownloadDone {
            smokeDownloadDone = nil
            say("hentning fejlede: \(error.localizedDescription)")
            cb(nil)
            return
        }
        let e = error as NSError
        if e.domain == NSURLErrorDomain && e.code == NSURLErrorCancelled { return }
        let a = NSAlert()
        a.messageText = "Filen kunne ikke gemmes"
        a.informativeText = e.localizedDescription
        a.beginSheetModal(for: window, completionHandler: nil)
    }

    // MARK: røgtest

    var smokeResults: [(String, Bool, String)] = []

    func check(_ name: String, _ ok: Bool, _ detail: String = "") {
        smokeResults.append((name, ok, detail))
        say("  \(ok ? "OK  " : "FEJL") \(name)\(detail.isEmpty ? "" : "  — " + detail)")
    }

    func smokeFail(_ why: String) {
        say("RØGTEST FEJL: " + why)
        exit(1)
    }

    func js(_ code: String, _ then: @escaping @MainActor (Any?) -> Void) {
        web.evaluateJavaScript(code) { r, e in
            if let e = e { say("js-fejl: \(e.localizedDescription)") }
            then(r)
        }
    }

    func after(_ s: Double, _ f: @escaping @MainActor () -> Void) {
        DispatchQueue.main.asyncAfter(deadline: .now() + s) { f() }
    }

    /// Et rigtigt museklik midt på et element (giver siden en brugerhandling, som filvalg og udklipsholderen kræver).
    func click(_ selector: String, _ then: @escaping @MainActor (Bool) -> Void) {
        let code = """
        (() => { const el = document.querySelector('\(selector)'); if (!el) return null;
          el.scrollIntoView({block: 'center'}); const r = el.getBoundingClientRect();
          return [r.left + r.width / 2, r.top + r.height / 2]; })()
        """
        js(code) { r in
            guard let a = r as? [Double], a.count == 2 else { then(false); return }
            let inView = NSPoint(x: a[0], y: self.web.isFlipped ? a[1] : self.web.bounds.height - a[1])
            let p = self.web.convert(inView, to: nil)
            for t in [NSEvent.EventType.leftMouseDown, .leftMouseUp] {
                if let ev = NSEvent.mouseEvent(with: t, location: p, modifierFlags: [], timestamp: ProcessInfo.processInfo.systemUptime,
                                               windowNumber: self.window.windowNumber, context: nil, eventNumber: 0, clickCount: 1,
                                               pressure: t == .leftMouseDown ? 1 : 0) {
                    self.window.sendEvent(ev)
                }
            }
            then(true)
        }
    }

    func smokeRun() {
        let token = opts.smoke ?? "x"
        let code = """
        (() => { const r = {};
          r.title = document.title;
          r.board = !!document.querySelector('#boardBtn');
          r.name = document.getElementById('boardBtnName').textContent;
          r.prev = localStorage.getItem('tt-mac-smoke');
          localStorage.setItem('tt-mac-smoke', '\(token)');
          r.store = localStorage.getItem('tt-mac-smoke') === '\(token)';
          r.hidden = document.hidden;
          window.__ttKeys = 0;
          document.addEventListener('keydown', e => { if (e.metaKey && (e.key === 'z' || e.key === 'Z')) window.__ttKeys++; }, true);
          return JSON.stringify(r); })()
        """
        js(code) { r in
            guard let s = r as? String, let d = try? JSONSerialization.jsonObject(with: Data(s.utf8)) as? [String: Any] else {
                self.smokeFail("siden svarede ikke"); return
            }
            say("side: \(s)")
            self.check("appen er indlæst (titel og tavleknap)", (d["title"] as? String) == "Taktiktavle" && (d["board"] as? Bool) == true)
            self.check("lager: skriv og læs", (d["store"] as? Bool) == true)
            if let prev = d["prev"] as? String {
                // Sidste røgtest omdøbte tavlen og lukkede straks (før appens 300 ms): navnet skal være gemt.
                self.check("ændring lige før lukning er gemt (forrige røgtest: \(prev))", (d["name"] as? String) == "Lukket \(prev)",
                           "tavlens navn: \(d["name"] ?? "nil")")
            } else {
                say("(første røgtest i dette lager: lagring ved lukning tjekkes ved næste)")
            }
            if self.hasLauncherSession { self.smokeAccount() } else if self.opts.headless { self.smokeShare() } else { self.smokeKeys() }
        }
    }

    /// Med launcherens login (MG_SESSION i testen): appen er logget ind via launcheren og har gemt på kontoen.
    func smokeAccount(_ tries: Int = 0) {
        js("""
        JSON.stringify({ state: document.getElementById('acct').dataset.state, source: document.getElementById('acct').dataset.source,
          status: document.getElementById('acctStatus').textContent })
        """) { r in
            let s = r as? String ?? ""
            let d = (try? JSONSerialization.jsonObject(with: Data(s.utf8))) as? [String: Any] ?? [:]
            let ok = (d["state"] as? String) == "in" && (d["source"] as? String) == "launcher" && ((d["status"] as? String) ?? "").hasPrefix("Gemt")
            if !ok && tries < 40 { self.after(0.25) { self.smokeAccount(tries + 1) }; return }
            self.check("MG Games-kontoen: logget ind via launcheren, og tavlerne er gemt på kontoen", ok, s)
            if self.opts.headless { self.smokeShare() } else { self.smokeKeys() }
        }
    }

    func smokeKeys() {
        js("document.activeElement && document.activeElement.blur && document.activeElement.blur(); true") { _ in
            let key = NSApp.keyWindow === self.window
            if let ev = NSEvent.keyEvent(with: .keyDown, location: .zero, modifierFlags: .command,
                                         timestamp: ProcessInfo.processInfo.systemUptime, windowNumber: self.window.windowNumber,
                                         context: nil, characters: "z", charactersIgnoringModifiers: "z", isARepeat: false, keyCode: 6) {
                if key { NSApp.sendEvent(ev) } else { self.window.sendEvent(ev) }
            }
            self.after(0.8) {
                self.js("window.__ttKeys") { r in
                    self.check("⌘Z når frem til appen (\(key ? "gennem menuerne" : "vinduet var ikke aktivt: direkte til vinduet"))",
                               ((r as? Int) ?? 0) >= 1, "tastetryk set: \(r ?? "nil")")
                    self.smokeShare()
                }
            }
        }
    }

    /// Hent en fil gennem appens egen knap (Del-vinduet) og programmets hentning.
    func smokeSave(_ button: String, _ then: @escaping @MainActor (URL?) -> Void) {
        smokeGen += 1
        let gen = smokeGen
        smokeDownloadDone = { url in then(url) }
        js("document.getElementById('\(button)').click(); true") { _ in }
        after(20) { if self.smokeGen == gen, let cb = self.smokeDownloadDone { self.smokeDownloadDone = nil; cb(nil) } }
    }

    func smokeShare() {
        js("document.getElementById('shareBtn').click(); true") { _ in
            self.after(2.5) {
                self.smokeSave("saveImgBtn") { url in
                    let head = url.flatMap { try? Data(contentsOf: $0) }?.prefix(8) ?? Data()
                    self.check("Del → Gem billede: en PNG-fil er gemt (svar efter 6 s)", head == Data([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
                               url?.lastPathComponent ?? "ingen fil")
                    self.smokeSave("saveJsonBtn") { url in
                        let text = url.flatMap { try? String(contentsOf: $0, encoding: .utf8) } ?? ""
                        self.check("Del → Gem som fil: tavlen er gemt som fil", text.contains("\"app\": \"taktiktavle\""),
                                   url?.lastPathComponent ?? "ingen fil")
                        if self.opts.headless { self.smokeClose() } else { self.smokeClipboard(text) }
                    }
                }
            }
        }
    }

    func smokeClipboard(_ boardFile: String) {
        // Udklipsholderen gemmes og lægges tilbage bagefter.
        let pb = NSPasteboard.general
        let saved: [[NSPasteboard.PasteboardType: Data]] = (pb.pasteboardItems ?? []).map { item in
            var d: [NSPasteboard.PasteboardType: Data] = [:]
            for t in item.types { if let v = item.data(forType: t) { d[t] = v } }
            return d
        }
        let before = pb.changeCount
        click("#copyImgBtn") { clicked in
            self.after(1.5) {
                let types = pb.types ?? []
                let ok = clicked && pb.changeCount != before && (types.contains(.png) || types.contains(.tiff))
                self.check("Del → Kopiér billede: et billede ligger i udklipsholderen", ok,
                           "typer: \(types.map { $0.rawValue }.prefix(3).joined(separator: ", ")); ændringer: \(pb.changeCount - before)")
                if !ok || pb.changeCount != before + 1 { self.smokeImport(boardFile); return }   // (andre har kopieret: rør ikke)
                pb.clearContents()
                let items: [NSPasteboardItem] = saved.map { d in
                    let it = NSPasteboardItem()
                    for (t, v) in d { it.setData(v, forType: t) }
                    return it
                }
                if !items.isEmpty { pb.writeObjects(items) }
                self.smokeImport(boardFile)
            }
        }
    }

    func smokeImport(_ boardFile: String) {
        let name = "Røgtest \(opts.smoke ?? "x")"
        guard var d = try? JSONSerialization.jsonObject(with: Data(boardFile.utf8)) as? [String: Any],
              var b = d["board"] as? [String: Any] else {
            check("Åbn fil: filen fra Gem som fil kan læses", false); smokeClose(); return
        }
        b["name"] = name
        d["board"] = b
        let f = FileManager.default.temporaryDirectory.appendingPathComponent("taktiktavle-roegtest-import.json")
        try? JSONSerialization.data(withJSONObject: d).write(to: f)
        smokeOpenFile = f
        js("document.querySelectorAll('dialog[open]').forEach(x => x.close()); document.getElementById('boardBtn').click(); true") { _ in
            self.after(0.6) {
                self.click("#importBtn") { clicked in
                    self.after(1.5) {
                        self.js("document.getElementById('boardBtnName').textContent") { r in
                            self.check("Åbn fil: filvalget gav siden filen, og tavlen blev åbnet", clicked && (r as? String) == name,
                                       "tavlens navn: \(r ?? "nil")")
                            self.smokeClose()
                        }
                    }
                }
            }
        }
    }

    /// Til sidst: omdøb tavlen og luk straks (næste røgtest tjekker navnet).
    func smokeClose() {
        let name = "Lukket \(opts.smoke ?? "x")"
        js("""
        (() => { document.querySelectorAll('dialog[open]').forEach(x => x.close());
          const i = document.getElementById('boardName'); i.value = \(jsString(name));
          i.dispatchEvent(new Event('input')); i.dispatchEvent(new Event('change')); return true; })()
        """) { _ in self.smokeSnapshot() }
    }

    func smokeSnapshot() {
        guard let path = opts.snapshot else { smokeDone(); return }
        web.takeSnapshot(with: nil) { img, _ in
            if let img = img, let tiff = img.tiffRepresentation, let rep = NSBitmapImageRep(data: tiff),
               let png = rep.representation(using: .png, properties: [:]) {
                try? png.write(to: URL(fileURLWithPath: path))
                say("billede: \(path) (\(Int(img.size.width))×\(Int(img.size.height)))")
            }
            self.smokeDone()
        }
    }

    func smokeDone() {
        let fails = smokeResults.filter { !$0.1 }.count
        if fails == 0 {
            say("RØGTEST OK  \(smokeResults.count) tjek")
            NSApp.terminate(nil)   // (samme vej som ⌘Q: siden gemmer først)
        } else {
            say("RØGTEST FEJL  \(fails) af \(smokeResults.count) tjek")
            exitCode = 1
            NSApp.terminate(nil)
        }
    }
}

/// En timer i run loop'en i alle tilstande. Ikke DispatchQueue.main: kaldes terminate() fra en blok på hovedkøen, venter
/// AppKit på svaret i en indre løkke, mens hovedkøen er optaget af blokken, og så kommer svaret aldrig (målt 3/10:
/// "open --args --headless --quit-after 600" hang i NSApplication._shouldTerminate).
func runLoopTimer(_ seconds: Double, _ f: @escaping @MainActor () -> Void) {
    let t = Timer(timeInterval: seconds, repeats: false) { _ in MainActor.assumeIsolated { f() } }
    RunLoop.main.add(t, forMode: .common)
}

func escapeHTML(_ s: String) -> String {
    s.replacingOccurrences(of: "&", with: "&amp;").replacingOccurrences(of: "<", with: "&lt;").replacingOccurrences(of: ">", with: "&gt;")
}

func jsString(_ s: String) -> String {
    let d = try! JSONSerialization.data(withJSONObject: [s])
    let a = String(data: d, encoding: .utf8)!
    return String(a.dropFirst().dropLast())
}

let app = NSApplication.shared
app.setActivationPolicy(.regular)
let delegate = MainActor.assumeIsolated { AppDelegate() }
app.delegate = delegate
app.run()
