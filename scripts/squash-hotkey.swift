// Global "file a bug" hotkey for macOS.
//
//   swift scripts/squash-hotkey.swift [squash-url]     # listen for the hotkey
//   swift scripts/squash-hotkey.swift --now [url]      # run the capture once and exit
//
// Press the hotkey (default ⌃⌥S, override with SQUASH_HOTKEY="cmd+shift+b") from any app:
// drag a region to screenshot it to the clipboard, and Squash comes to the front. Press ⌘V,
// type what's wrong, press Enter. Esc while selecting cancels without switching apps.
//
// Squash is found in this order: the installed Squash app (PWA), an open Squash tab in
// Chrome, Arc, Brave, Edge or Safari, and otherwise the URL is opened in the default browser.
// The URL defaults to SQUASH_URL, then https://squash-livid.vercel.app/app.

import AppKit
import Carbon.HIToolbox

let defaultURL = "https://squash-livid.vercel.app/app"

var cliArgs = Array(CommandLine.arguments.dropFirst())
let runOnce = cliArgs.contains("--now")
cliArgs.removeAll { $0 == "--now" }
let env = ProcessInfo.processInfo.environment
let squashURLString = cliArgs.first ?? env["SQUASH_URL"] ?? defaultURL
guard let squashURL = URL(string: squashURLString), let host = squashURL.host else {
  FileHandle.standardError.write("Not a URL: \(squashURLString)\n".data(using: .utf8)!)
  exit(1)
}
let squashOrigin = "\(squashURL.scheme ?? "https")://\(host)" + (squashURL.port.map { ":\($0)" } ?? "")

// MARK: Hotkey parsing

let keyCodes: [String: Int] = [
  "a": kVK_ANSI_A, "b": kVK_ANSI_B, "c": kVK_ANSI_C, "d": kVK_ANSI_D, "e": kVK_ANSI_E,
  "f": kVK_ANSI_F, "g": kVK_ANSI_G, "h": kVK_ANSI_H, "i": kVK_ANSI_I, "j": kVK_ANSI_J,
  "k": kVK_ANSI_K, "l": kVK_ANSI_L, "m": kVK_ANSI_M, "n": kVK_ANSI_N, "o": kVK_ANSI_O,
  "p": kVK_ANSI_P, "q": kVK_ANSI_Q, "r": kVK_ANSI_R, "s": kVK_ANSI_S, "t": kVK_ANSI_T,
  "u": kVK_ANSI_U, "v": kVK_ANSI_V, "w": kVK_ANSI_W, "x": kVK_ANSI_X, "y": kVK_ANSI_Y,
  "z": kVK_ANSI_Z, "0": kVK_ANSI_0, "1": kVK_ANSI_1, "2": kVK_ANSI_2, "3": kVK_ANSI_3,
  "4": kVK_ANSI_4, "5": kVK_ANSI_5, "6": kVK_ANSI_6, "7": kVK_ANSI_7, "8": kVK_ANSI_8,
  "9": kVK_ANSI_9,
]
let modifierFlags: [String: (carbon: Int, symbol: String)] = [
  "ctrl": (controlKey, "⌃"), "control": (controlKey, "⌃"),
  "opt": (optionKey, "⌥"), "option": (optionKey, "⌥"), "alt": (optionKey, "⌥"),
  "shift": (shiftKey, "⇧"),
  "cmd": (cmdKey, "⌘"), "command": (cmdKey, "⌘"),
]

/// Parses "ctrl+opt+s" into a Carbon key code, modifier mask and a display label like ⌃⌥S.
func parseHotkey(_ spec: String) -> (key: UInt32, mods: UInt32, label: String)? {
  var key: Int?
  var keyName = ""
  var mods = 0
  var symbols = ""
  for part in spec.lowercased().split(separator: "+").map({ String($0).trimmingCharacters(in: .whitespaces) }) {
    if let m = modifierFlags[part] {
      if mods & m.carbon == 0 { symbols += m.symbol }
      mods |= m.carbon
    } else if let k = keyCodes[part], key == nil {
      key = k
      keyName = part.uppercased()
    } else {
      return nil
    }
  }
  // A bare letter would swallow normal typing everywhere.
  guard let key, mods != 0, mods != shiftKey else { return nil }
  return (UInt32(key), UInt32(mods), symbols + keyName)
}

// MARK: Bringing Squash forward

/// Runs AppleScript and returns its boolean result (false on any error, e.g. Automation denied).
func runAppleScript(_ source: String) -> Bool {
  var error: NSDictionary?
  let result = NSAppleScript(source: source)?.executeAndReturnError(&error)
  if let error, let message = error[NSAppleScript.errorMessage] {
    print("AppleScript: \(message)")
  }
  return result?.booleanValue ?? false
}

func appleScriptString(_ s: String) -> String {
  "\"" + s.replacingOccurrences(of: "\\", with: "\\\\").replacingOccurrences(of: "\"", with: "\\\"") + "\""
}

let chromiumBrowsers = [
  ("com.google.Chrome", "Google Chrome"),
  ("company.thebrowser.Browser", "Arc"),
  ("com.brave.Browser", "Brave Browser"),
  ("com.microsoft.edgemac", "Microsoft Edge"),
]

func isRunning(_ bundleID: String) -> Bool {
  !NSRunningApplication.runningApplications(withBundleIdentifier: bundleID).isEmpty
}

/// Activates an installed Squash web app (Chrome or Safari "Add to Dock"), if one is open or installed.
func focusInstalledApp() -> Bool {
  let me = ProcessInfo.processInfo.processIdentifier
  if let app = NSWorkspace.shared.runningApplications.first(where: {
    $0.localizedName == "Squash" && $0.processIdentifier != me && $0.bundleURL?.pathExtension == "app"
  }) {
    return app.activate()
  }
  let home = FileManager.default.homeDirectoryForCurrentUser
  let candidates = [
    home.appendingPathComponent("Applications/Chrome Apps.localized/Squash.app"),
    home.appendingPathComponent("Applications/Squash.app"),
  ]
  guard let app = candidates.first(where: { FileManager.default.fileExists(atPath: $0.path) }) else {
    return false
  }
  NSWorkspace.shared.openApplication(at: app, configuration: NSWorkspace.OpenConfiguration())
  return true
}

/// Switches to an existing Squash tab in a running browser. Never launches a browser.
func focusBrowserTab() -> Bool {
  let prefix = appleScriptString(squashOrigin)
  for (bundleID, name) in chromiumBrowsers where isRunning(bundleID) {
    let script = """
      tell application "\(name)"
        repeat with w in windows
          set i to 0
          repeat with t in tabs of w
            set i to i + 1
            if (URL of t) starts with \(prefix) then
              set active tab index of w to i
              set index of w to 1
              activate
              return true
            end if
          end repeat
        end repeat
      end tell
      return false
      """
    if runAppleScript(script) { return true }
  }
  if isRunning("com.apple.Safari") {
    let script = """
      tell application "Safari"
        repeat with w in windows
          repeat with t in tabs of w
            if (URL of t) starts with \(prefix) then
              set current tab of w to t
              set index of w to 1
              activate
              return true
            end if
          end repeat
        end repeat
      end tell
      return false
      """
    if runAppleScript(script) { return true }
  }
  return false
}

func focusSquash() {
  if focusInstalledApp() || focusBrowserTab() { return }
  NSWorkspace.shared.open(squashURL)
}

// MARK: Capture

var capturing = false

/// Interactive region screenshot to the clipboard, then Squash. Calls `done` when finished.
func capture(done: @escaping () -> Void = {}) {
  if capturing { return }
  capturing = true
  let before = NSPasteboard.general.changeCount
  let process = Process()
  process.executableURL = URL(fileURLWithPath: "/usr/sbin/screencapture")
  process.arguments = ["-i", "-c"]
  process.terminationHandler = { _ in
    DispatchQueue.main.async {
      capturing = false
      // Esc leaves the clipboard untouched: stay where the user was.
      if NSPasteboard.general.changeCount != before { focusSquash() }
      done()
    }
  }
  do {
    try process.run()
  } catch {
    capturing = false
    print("Could not start screencapture: \(error)")
    done()
  }
}

// MARK: Main

setvbuf(stdout, nil, _IOLBF, 0)  // show status lines promptly when logged to a file
let app = NSApplication.shared
app.setActivationPolicy(.prohibited)

if runOnce {
  capture { exit(0) }
  app.run()
}

let hotkeySpec = env["SQUASH_HOTKEY"] ?? "ctrl+opt+s"
guard let hotkey = parseHotkey(hotkeySpec) else {
  FileHandle.standardError.write(
    "Bad SQUASH_HOTKEY \"\(hotkeySpec)\". Use modifiers (ctrl, opt, shift, cmd) plus one letter or digit, e.g. ctrl+opt+s.\n"
      .data(using: .utf8)!)
  exit(1)
}

// The Carbon callback is a C function pointer and can't capture globals, so it posts a notification.
NotificationCenter.default.addObserver(
  forName: Notification.Name("SquashHotkeyPressed"), object: nil, queue: .main
) { _ in capture() }
var pressedSpec = EventTypeSpec(eventClass: OSType(kEventClassKeyboard), eventKind: UInt32(kEventHotKeyPressed))
InstallEventHandler(
  GetApplicationEventTarget(),
  { _, _, _ in
    NotificationCenter.default.post(name: Notification.Name("SquashHotkeyPressed"), object: nil)
    return noErr
  },
  1, &pressedSpec, nil, nil)

var hotKeyRef: EventHotKeyRef?
let hotKeyID = EventHotKeyID(signature: OSType(0x5351_5348), id: 1)  // 'SQSH'
let status = RegisterEventHotKey(
  hotkey.key, hotkey.mods, hotKeyID, GetApplicationEventTarget(), 0, &hotKeyRef)
guard status == noErr else {
  FileHandle.standardError.write(
    "Could not register \(hotkey.label) (error \(status)). Pick another with SQUASH_HOTKEY.\n"
      .data(using: .utf8)!)
  exit(1)
}

print("Squash hotkey ready: press \(hotkey.label) anywhere to screenshot a region and open \(squashOrigin).")
print("Leave this running; Ctrl+C to stop.")
app.run()
