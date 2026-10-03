extends Node
## Taktiktavle til Windows (MG Games-launcheren): åbner appen fra GitHub Pages i sit eget vindue, dvs. Edge (eller
## Chrome) i app-tilstand uden faner og adresselinje, med sin egen profil. Programmet har intet vindue selv
## (display-driveren er "headless") og venter, til vinduet lukkes, så launcheren kan vise, at Taktiktavle kører.
## Findes hverken Edge eller Chrome, eller lukker browseren med det samme, åbnes appen i standardbrowseren.
##
## Kommandolinje (som spillene; ukendte argumenter, fx --headless fra launcherens test, ignoreres):
##   --quit-after N   luk efter N billeder (N / 60 s), også browservinduet
##   --smoke          røgtest: browseren henter appen uden vindue og profil (--dump-dom); "[taktiktavle] RØGTEST OK"
## Miljø (kun til test): TAKTIKTAVLE_URL, TAKTIKTAVLE_BROWSER (sti til browseren), TAKTIKTAVLE_DRY (skriv kun, hvad der
## ville ske), TAKTIKTAVLE_PROFILE (profilmappen).

const APP_URL := "https://gammowich.github.io/taktiktavle/"


func say(s: String) -> void:
	print("[taktiktavle] " + s)


func _ready() -> void:
	var url := OS.get_environment("TAKTIKTAVLE_URL")
	if url == "":
		url = APP_URL
	var args := OS.get_cmdline_user_args() + OS.get_cmdline_args()
	var quit_after := -1.0
	var smoke := false
	for i in args.size():
		if args[i] == "--quit-after" and i + 1 < args.size():
			quit_after = float(args[i + 1]) / 60.0
		elif args[i] == "--smoke":
			smoke = true
	say("visning: %s" % DisplayServer.get_name())
	var browser := find_browser()
	say("browser: %s" % (browser if browser != "" else "(ingen Edge eller Chrome)"))
	if smoke:
		_smoke(browser, url)
		return
	if browser == "":
		_fallback(url, "ingen Edge eller Chrome")
		return
	var profile := profile_dir()
	DirAccess.make_dir_recursive_absolute(profile)
	var bargs := PackedStringArray(["--app=" + url, "--user-data-dir=" + profile, "--no-first-run",
		"--no-default-browser-check"])
	if OS.get_environment("TAKTIKTAVLE_DRY") != "":
		say("ville starte: %s %s" % [browser, " ".join(bargs)])
		get_tree().quit()
		return
	var pid := OS.create_process(browser, bargs)
	if pid <= 0:
		_fallback(url, "browseren kunne ikke startes")
		return
	say("vindue åbnet (pid %d, profil %s)" % [pid, profile])
	var t0 := Time.get_ticks_msec()
	while OS.is_process_running(pid):
		if quit_after >= 0.0 and Time.get_ticks_msec() - t0 > quit_after * 1000.0:
			OS.kill(pid)
			say("lukket efter --quit-after")
			break
		await get_tree().create_timer(0.5).timeout
	var secs := (Time.get_ticks_msec() - t0) / 1000.0
	if secs < 2.0 and quit_after < 0.0:
		# (en browser, der lukker med det samme, har ikke vist noget vindue)
		_fallback(url, "browseren lukkede efter %.1f s" % secs)
		return
	say("vinduet er lukket efter %.1f s" % secs)
	get_tree().quit()


## Edge følger med Windows 10 og 11; Chrome bruges, hvis Edge mangler. (Mac-stierne er kun til at afprøve programmet.)
func find_browser() -> String:
	var forced := OS.get_environment("TAKTIKTAVLE_BROWSER")
	if forced != "":
		return forced if FileAccess.file_exists(forced) else ""
	var c: Array[String] = []
	if OS.get_name() == "Windows":
		for base in [OS.get_environment("ProgramFiles(x86)"), OS.get_environment("ProgramFiles"), OS.get_environment("LOCALAPPDATA")]:
			if base != "":
				c.append(base.path_join("Microsoft/Edge/Application/msedge.exe"))
		for base in [OS.get_environment("ProgramFiles"), OS.get_environment("ProgramFiles(x86)"), OS.get_environment("LOCALAPPDATA")]:
			if base != "":
				c.append(base.path_join("Google/Chrome/Application/chrome.exe"))
	elif OS.get_name() == "macOS":
		c = ["/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
			"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"]
	for p in c:
		if FileAccess.file_exists(p):
			return p
	return ""


## Taktiktavles egen browserprofil (lager og vinduets størrelse), adskilt fra brugerens almindelige browser.
func profile_dir() -> String:
	var forced := OS.get_environment("TAKTIKTAVLE_PROFILE")
	if forced != "":
		return forced
	var base := OS.get_environment("LOCALAPPDATA")
	if base == "":
		base = OS.get_data_dir()
	return base.path_join("Taktiktavle").path_join("browser")


func _fallback(url: String, why: String) -> void:
	say("åbner i standardbrowseren (%s)" % why)
	if OS.get_environment("TAKTIKTAVLE_DRY") == "":
		OS.shell_open(url)
	get_tree().quit()


func _smoke(browser: String, url: String) -> void:
	if browser == "":
		say("RØGTEST FEJL: ingen Edge eller Chrome")
		get_tree().quit(1)
		return
	# (uden egen profil: med en fast profil bliver browseren ved med at køre efter --dump-dom; målt med Chrome 3/10)
	var out := []
	var code := OS.execute(browser, PackedStringArray(["--headless=new", "--no-first-run", "--virtual-time-budget=10000",
		"--dump-dom", url]), out, true)
	var dom := "".join(out)
	var ok := code == 0 and dom.contains("id=\"boardBtn\"") and dom.contains("id=\"tab-kamp\"")
	say("browser svarede %d, %d tegn" % [code, dom.length()])
	if ok:
		say("RØGTEST OK  appen er hentet og vist i %s" % browser.get_file())
		get_tree().quit(0)
	else:
		say("RØGTEST FEJL  appen blev ikke vist")
		get_tree().quit(1)
