"""Nightshift agent: measures when this computer is idle and reports it to
the Nightshift dashboard. Runs on Windows, macOS and Linux.

Collects only: power state, battery level, seconds since the last keyboard
or mouse input, CPU and memory use, and basic hardware info at setup.
Never collects file contents, browsing data, keystrokes or screen content.

  nightshift-agent                 first run: privacy notice + setup key; then runs
  nightshift-agent --setup KEY     set up with a key from Add a device
  nightshift-agent --check         print one reading and exit
  nightshift-agent --autostart on|off
  nightshift-agent --uninstall     stop starting at login and forget this device
"""
import ctypes
import json
import os
import platform
import re
import shutil
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone

try:
    import psutil  # bundled in the packaged builds; optional when run as a script
except ImportError:
    psutil = None

AGENT_VERSION = "0.3.0"
CONSENT_VERSION = "agent-1"
INTERVAL_SEC = 60
SYSTEM = platform.system()  # "Windows", "Darwin" or "Linux"

PRIVACY_NOTICE = """\
Nightshift agent: privacy notice

Every minute, this agent sends the Nightshift dashboard:
  - whether the computer is plugged in, and the battery level
  - how many seconds since the keyboard or mouse was last used
  - CPU and memory use, as percentages
Once, at setup: the computer's name, operating system, processor,
number of cores and amount of memory.

It never reads your files, browsing, keystrokes or screen. It does not
run any jobs on this computer. Pause it or delete your data any time
from the dashboard; run with --uninstall to remove it.
"""


# ----------------------------------------------------------------------------
# Where settings live
# ----------------------------------------------------------------------------
def config_dir():
    if SYSTEM == "Windows":
        base = os.environ.get("APPDATA") or os.path.expanduser("~")
        return os.path.join(base, "Nightshift")
    if SYSTEM == "Darwin":
        return os.path.expanduser("~/Library/Application Support/Nightshift")
    return os.path.join(os.environ.get("XDG_CONFIG_HOME") or os.path.expanduser("~/.config"), "nightshift")


CONFIG_FILE = os.path.join(config_dir(), "config.json")
QUEUE_FILE = os.path.join(config_dir(), "unsent.jsonl")
LOG_FILE = os.path.join(config_dir(), "agent.log")


def load_config():
    try:
        with open(CONFIG_FILE, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return None


def save_config(cfg):
    os.makedirs(config_dir(), exist_ok=True)
    with open(CONFIG_FILE, "w", encoding="utf-8") as f:
        json.dump(cfg, f, indent=2)
    if SYSTEM != "Windows":
        os.chmod(CONFIG_FILE, 0o600)


def run(cmd, timeout=5):
    try:
        return subprocess.run(cmd, capture_output=True, text=True, timeout=timeout).stdout
    except (OSError, subprocess.SubprocessError):
        return ""


# ----------------------------------------------------------------------------
# Measurements, one implementation per operating system
# ----------------------------------------------------------------------------
if SYSTEM == "Windows":
    from ctypes import wintypes

    class _LASTINPUTINFO(ctypes.Structure):
        _fields_ = [("cbSize", wintypes.UINT), ("dwTime", wintypes.DWORD)]

    class _POWER(ctypes.Structure):
        _fields_ = [("ACLineStatus", ctypes.c_ubyte), ("BatteryFlag", ctypes.c_ubyte),
                    ("BatteryLifePercent", ctypes.c_ubyte), ("SystemStatusFlag", ctypes.c_ubyte),
                    ("BatteryLifeTime", wintypes.DWORD), ("BatteryFullLifeTime", wintypes.DWORD)]

    class _MEM(ctypes.Structure):
        _fields_ = [("dwLength", wintypes.DWORD), ("dwMemoryLoad", wintypes.DWORD)] + [
            (n, ctypes.c_ulonglong) for n in ("total", "avail", "tpf", "apf", "tv", "av", "aev")]

    _k32, _u32 = ctypes.windll.kernel32, ctypes.windll.user32
    _k32.GetTickCount64.restype = ctypes.c_ulonglong

    def input_idle_sec():
        info = _LASTINPUTINFO(cbSize=ctypes.sizeof(_LASTINPUTINFO))
        if not _u32.GetLastInputInfo(ctypes.byref(info)):
            return None
        # dwTime is a 32-bit tick count; compare in the same 32-bit space.
        return ((_k32.GetTickCount64() & 0xFFFFFFFF) - info.dwTime) % 2 ** 32 // 1000

    def power():
        s = _POWER()
        if not _k32.GetSystemPowerStatus(ctypes.byref(s)):
            return None, None
        plugged = {0: False, 1: True}.get(s.ACLineStatus)
        battery = None if s.BatteryLifePercent == 255 or s.BatteryFlag == 128 else s.BatteryLifePercent
        return plugged, battery

    def _mem():
        m = _MEM(dwLength=ctypes.sizeof(_MEM))
        _k32.GlobalMemoryStatusEx(ctypes.byref(m))
        return m

    def _cpu_times():
        i, k, u = wintypes.FILETIME(), wintypes.FILETIME(), wintypes.FILETIME()
        _k32.GetSystemTimes(ctypes.byref(i), ctypes.byref(k), ctypes.byref(u))
        v = lambda ft: (ft.dwHighDateTime << 32) | ft.dwLowDateTime
        return v(i), v(k) + v(u)  # kernel time includes idle time

    def cpu_model():
        try:
            import winreg
            with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, r"HARDWARE\DESCRIPTION\System\CentralProcessor\0") as k:
                return winreg.QueryValueEx(k, "ProcessorNameString")[0].strip()
        except OSError:
            return platform.processor()

    def os_name():
        build = int(platform.version().split(".")[-1] or 0)
        return f"Windows {'11' if build >= 22000 else platform.release()}"

    def ram_total_gb():
        return round(_mem().total / 1024 ** 3)

    def ram_pct():
        return float(_mem().dwMemoryLoad)

elif SYSTEM == "Darwin":
    def input_idle_sec():
        m = re.search(r'"HIDIdleTime"\s*=\s*(\d+)', run(["ioreg", "-c", "IOHIDSystem", "-d", "4"]))
        return int(m.group(1)) // 10 ** 9 if m else None

    def power():
        out = run(["pmset", "-g", "batt"])
        if not out:
            return None, None
        m = re.search(r"(\d+)%", out)
        return "AC Power" in out, (int(m.group(1)) if m else None)

    def cpu_model():
        return run(["sysctl", "-n", "machdep.cpu.brand_string"]).strip() or platform.machine()

    def os_name():
        return f"macOS {platform.mac_ver()[0]}"

    def ram_total_gb():
        out = run(["sysctl", "-n", "hw.memsize"]).strip()
        return round(int(out) / 1024 ** 3) if out.isdigit() else None

    def ram_pct():
        return psutil.virtual_memory().percent if psutil else None

else:  # Linux and other Unix desktops
    def input_idle_sec():
        if shutil.which("xprintidle"):  # X11
            out = run(["xprintidle"]).strip()
            if out.isdigit():
                return int(out) // 1000
        out = run(["gdbus", "call", "--session", "--dest", "org.gnome.Mutter.IdleMonitor",
                   "--object-path", "/org/gnome/Mutter/IdleMonitor/Core",
                   "--method", "org.gnome.Mutter.IdleMonitor.GetIdletime"])  # GNOME, incl. Wayland
        m = re.search(r"uint64 (\d+)", out)
        if m:
            return int(m.group(1)) // 1000
        out = run(["qdbus", "org.freedesktop.ScreenSaver", "/ScreenSaver", "GetSessionIdleTime"]).strip()
        if out.isdigit():  # KDE
            return int(out) // 1000
        return None

    def power():
        base = "/sys/class/power_supply"
        mains, battery = None, None
        try:
            for name in os.listdir(base):
                def read(f):
                    try:
                        with open(os.path.join(base, name, f)) as fh:
                            return fh.read().strip()
                    except OSError:
                        return ""
                kind = read("type")
                if kind == "Mains":
                    mains = (mains or False) or read("online") == "1"
                elif kind == "Battery" and read("capacity").isdigit():
                    battery = int(read("capacity"))
        except OSError:
            pass
        if mains is None and battery is None:
            return True, None  # desktop with no battery: always on mains
        return mains if mains is not None else False, battery

    def _meminfo():
        info = {}
        try:
            with open("/proc/meminfo") as f:
                for line in f:
                    k, v = line.split(":", 1)
                    info[k] = int(v.split()[0])
        except (OSError, ValueError):
            pass
        return info

    def _cpu_times():
        with open("/proc/stat") as f:
            v = [int(x) for x in f.readline().split()[1:]]
        return v[3] + v[4], sum(v[:8])  # idle + iowait, total

    def cpu_model():
        try:
            with open("/proc/cpuinfo") as f:
                for line in f:
                    if line.startswith("model name"):
                        return line.split(":", 1)[1].strip()
        except OSError:
            pass
        return platform.machine()

    def os_name():
        try:
            return platform.freedesktop_os_release().get("PRETTY_NAME", "Linux")
        except OSError:
            return "Linux"

    def ram_total_gb():
        kb = _meminfo().get("MemTotal")
        return round(kb / 1024 ** 2) if kb else None

    def ram_pct():
        m = _meminfo()
        if "MemTotal" not in m or "MemAvailable" not in m:
            return None
        return round(100 * (1 - m["MemAvailable"] / m["MemTotal"]), 1)


def cpu_pct(window=1.0):
    if psutil:
        return psutil.cpu_percent(interval=window)
    if SYSTEM == "Darwin":  # no psutil: sum per-process CPU, scaled to all cores
        time.sleep(window)
        total = sum(float(x) for x in run(["ps", "-A", "-o", "%cpu="]).split() if x.replace(".", "", 1).isdigit())
        return round(min(total / (os.cpu_count() or 1), 100), 1)
    i1, t1 = _cpu_times()
    time.sleep(window)
    i2, t2 = _cpu_times()
    return round(100.0 * (1 - (i2 - i1) / (t2 - t1)), 1) if t2 > t1 else 0.0


_cpu_last = None


def cpu_avg():
    """Average CPU use since the previous reading, so a brief spike or dip
    doesn't decide the whole interval. The first reading samples 1 second."""
    global _cpu_last
    if psutil:
        first = _cpu_last is None
        _cpu_last = True
        return psutil.cpu_percent(interval=1.0 if first else None)
    if SYSTEM == "Darwin":
        return cpu_pct(window=0)  # ps already reports a decaying average
    now = _cpu_times()
    if _cpu_last is None:
        _cpu_last = now
        return cpu_pct()
    (i1, t1), (i2, t2) = _cpu_last, now
    _cpu_last = now
    return round(100.0 * (1 - (i2 - i1) / (t2 - t1)), 1) if t2 > t1 else 0.0


def screen_signals():
    """(locked, screen_busy). Locked means the person has stepped away.
    Screen busy means a full-screen app, a presentation, or an app keeping
    the display awake (usually video), so the person is likely watching."""
    if SYSTEM == "Windows":
        state = ctypes.c_int()
        locked = busy = None
        if ctypes.windll.shell32.SHQueryUserNotificationState(ctypes.byref(state)) == 0:
            locked = state.value == 1          # locked, screensaver or switched user
            busy = state.value in (2, 3, 4, 7)  # full-screen app, game, presentation
        flags = wintypes.ULONG()
        if ctypes.windll.powrprof.CallNtPowerInformation(16, None, 0, ctypes.byref(flags), ctypes.sizeof(flags)) == 0:
            busy = bool(busy) or bool(flags.value & 0x2)  # ES_DISPLAY_REQUIRED
        return locked, busy
    if SYSTEM == "Darwin":
        locked = "CGSSessionScreenIsLocked" in run(["ioreg", "-n", "Root", "-d1"])
        m = re.search(r"PreventUserIdleDisplaySleep\s+(\d+)", run(["pmset", "-g", "assertions"]))
        return locked, (int(m.group(1)) > 0) if m else None
    out = run(["loginctl", "show-session", os.environ.get("XDG_SESSION_ID", "auto"), "-p", "LockedHint"]).strip()
    locked = {"LockedHint=yes": True, "LockedHint=no": False}.get(out)
    inhib = run(["systemd-inhibit", "--list", "--no-legend"])
    busy = any("idle" in line and "block" in line for line in inhib.splitlines()) if inhib else None
    return locked, busy


def safe(fn, default=None):
    try:
        return fn()
    except Exception:
        return default


def reading():
    plugged, battery = safe(power, (None, None))
    locked, screen_busy = safe(screen_signals, (None, None))
    return {
        "ts": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "plugged_in": plugged,
        "battery_pct": battery,
        "input_idle_sec": safe(input_idle_sec),
        "cpu_pct": safe(cpu_avg),
        "ram_pct": safe(ram_pct),
        "locked": locked,
        "screen_busy": screen_busy,
    }


def device_info():
    family = {"Windows": "windows", "Darwin": "macos"}.get(SYSTEM, "linux")
    return {
        "os_family": family,
        "name": socket.gethostname().split(".")[0][:60],
        "os": safe(os_name, SYSTEM),
        "cpu_model": safe(cpu_model),
        "cores": os.cpu_count(),
        "ram_gb": safe(ram_total_gb),
        "agent_version": AGENT_VERSION,
    }


# ----------------------------------------------------------------------------
# Talking to the dashboard
# ----------------------------------------------------------------------------
class ServerError(Exception):
    def __init__(self, status, body):
        super().__init__(body.get("error") or f"HTTP {status}")
        self.status, self.body = status, body


def post(url, body, token=None):
    req = urllib.request.Request(url, data=json.dumps(body).encode(), method="POST")
    req.add_header("Content-Type", "application/json")
    req.add_header("User-Agent", f"nightshift-agent/{AGENT_VERSION}")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return json.loads(r.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        try:
            body = json.loads(e.read().decode())
        except ValueError:
            body = {}
        raise ServerError(e.code, body) from None


def server_from_key(key):
    import base64
    bad = ValueError("That isn't a Nightshift setup key. Copy it from Add a device on the dashboard.")
    m = re.match(r"^nse_([A-Za-z0-9_-]+)\.", key.strip())
    if not m:
        raise bad
    try:
        payload = m.group(1) + "=" * (-len(m.group(1)) % 4)
        return json.loads(base64.urlsafe_b64decode(payload))["s"].rstrip("/")
    except (ValueError, KeyError, TypeError):
        raise bad from None


def setup(key):
    key = key.strip()
    server = server_from_key(key)
    res = post(f"{server}/api/agent/enroll", {"setup_key": key, "device": device_info(),
                                               "consent_version": CONSENT_VERSION})
    cfg = {"server": server, "device_id": res["device_id"], "name": res["name"], "token": res["token"]}
    save_config(cfg)
    return cfg


def queue_load():
    try:
        with open(QUEUE_FILE, encoding="utf-8") as f:
            return [json.loads(line) for line in f if line.strip()]
    except (OSError, ValueError):
        return []


def queue_save(items):
    os.makedirs(config_dir(), exist_ok=True)
    items = items[-7 * 24 * 60:]  # keep at most a week offline
    with open(QUEUE_FILE, "w", encoding="utf-8") as f:
        f.writelines(json.dumps(i) + "\n" for i in items)


def log(msg, quiet):
    line = f"{datetime.now():%Y-%m-%d %H:%M:%S}  {msg}"
    if not quiet:
        print(line, flush=True)
    try:
        os.makedirs(config_dir(), exist_ok=True)
        if os.path.exists(LOG_FILE) and os.path.getsize(LOG_FILE) > 1_000_000:
            os.replace(LOG_FILE, LOG_FILE + ".old")
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(line + "\n")
    except OSError:
        pass


_lock = None


def already_running():
    # Holding a local port is a lock the OS releases if the agent crashes.
    global _lock
    _lock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        _lock.bind(("127.0.0.1", 48151))
        return False
    except OSError:
        return True


def report_loop(cfg, quiet):
    if already_running():
        log("The agent is already running on this computer.", quiet)
        return
    url = f"{cfg['server']}/api/agent/report"
    interval = min(max(int(cfg.get("interval_sec", INTERVAL_SEC)), 10), 600)  # set in config.json
    log(f"Reporting to {cfg['server']} as \"{cfg['name']}\" every {interval}s.", quiet)
    if not quiet:
        print("Leave this window open, or close it if it starts automatically at login. Ctrl+C stops it.\n", flush=True)
    pending = queue_load()
    try:
        while True:
            started = time.monotonic()
            pending.append(reading())
            try:
                res = post(url, {"interval_sec": interval, "readings": pending[-1500:]}, cfg["token"])
                pending = []
                if res.get("paused"):
                    log("Paused from the dashboard. Not recording.", quiet)
                else:
                    state = "usable idle" if res.get("usable_idle") else "not idle: " + "; ".join(res.get("why_not") or [])
                    log(state, quiet)
            except ServerError as e:
                if e.body.get("removed") or e.status == 401:
                    log(f"{e} Run the agent again with a new setup key to reconnect.", quiet)
                    os.remove(CONFIG_FILE)
                    return
                log(f"Dashboard error: {e}. Will retry.", quiet)
            except (urllib.error.URLError, OSError, ValueError) as e:
                log(f"Offline ({getattr(e, 'reason', e)}). Saved {len(pending)} reading(s) to send later.", quiet)
            queue_save(pending)
            time.sleep(max(1, interval - (time.monotonic() - started)))
    except KeyboardInterrupt:
        pass
    finally:
        try:
            post(url, {"event": "stop"}, cfg["token"])
        except Exception:
            pass
        log("Stopped.", quiet)


# ----------------------------------------------------------------------------
# Start at login
# ----------------------------------------------------------------------------
def launch_command():
    if getattr(sys, "frozen", False):  # packaged app: keep a copy that survives deleting the download
        target = os.path.join(config_dir(), os.path.basename(sys.executable))
        if os.path.abspath(sys.executable) != os.path.abspath(target):
            os.makedirs(config_dir(), exist_ok=True)
            try:
                shutil.copy2(sys.executable, target)
            except OSError:
                pass  # in use by a running copy; that copy is already in place
        return [target, "--background"]
    exe = sys.executable
    if SYSTEM == "Windows" and exe.lower().endswith("python.exe"):
        exe = exe[:-10] + "pythonw.exe"  # no console window
    return [exe, os.path.abspath(__file__), "--background"]


def _autostart_path():
    if SYSTEM == "Windows":
        return os.path.join(os.environ["APPDATA"], r"Microsoft\Windows\Start Menu\Programs\Startup", "Nightshift agent.vbs")
    if SYSTEM == "Darwin":
        return os.path.expanduser("~/Library/LaunchAgents/com.nightshift.agent.plist")
    return os.path.expanduser("~/.config/autostart/nightshift-agent.desktop")


def autostart(enable):
    path = _autostart_path()
    cmd = launch_command()
    if not enable:
        if SYSTEM == "Darwin":
            run(["launchctl", "unload", path])
        if os.path.exists(path):
            os.remove(path)
        return
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if SYSTEM == "Windows":
        line = " ".join(f'""{c}""' for c in cmd)
        content = f'CreateObject("WScript.Shell").Run "{line}", 0, False\r\n'
    elif SYSTEM == "Darwin":
        args = "".join(f"<string>{c}</string>" for c in cmd)
        content = f"""<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>com.nightshift.agent</string>
<key>ProgramArguments</key><array>{args}</array>
<key>RunAtLoad</key><true/>
<key>KeepAlive</key><true/>
</dict></plist>
"""
    else:
        exec_line = " ".join(f'"{c}"' for c in cmd)
        content = f"[Desktop Entry]\nType=Application\nName=Nightshift agent\nExec={exec_line}\nX-GNOME-Autostart-enabled=true\nNoDisplay=true\n"
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    if SYSTEM == "Darwin":
        run(["launchctl", "load", path])


# ----------------------------------------------------------------------------
# Command line
# ----------------------------------------------------------------------------
def ask(prompt):
    try:
        return input(prompt).strip()
    except EOFError:
        return ""


def first_run():
    print(PRIVACY_NOTICE)
    if ask("Type yes to agree and continue: ").lower() not in ("y", "yes"):
        print("Nothing was set up.")
        return None
    print("\nOn the Nightshift dashboard, click Add a device > Create setup key, then copy it.")
    while True:
        key = ask("Paste the setup key here: ")
        if not key:
            return None
        try:
            cfg = setup(key)
            break
        except (ValueError, ServerError) as e:
            print(f"  {e}")
        except (urllib.error.URLError, OSError) as e:
            print(f"  Couldn't reach the dashboard ({getattr(e, 'reason', e)}). Check your internet connection.")
            return None
    print(f"\nConnected as \"{cfg['name']}\".")
    if ask("Start the agent automatically when you log in? [Y/n]: ").lower() in ("", "y", "yes"):
        autostart(True)
        print("It will start automatically from now on, in the background.")
    return cfg


def main(argv):
    if "--help" in argv or "-h" in argv:
        print(__doc__)
        return
    if "--check" in argv:
        r = reading()
        print(json.dumps({"device": device_info(), "reading": r}, indent=2))
        if r["input_idle_sec"] is None:
            print("\nIdle time unavailable. On Linux, install xprintidle or use GNOME/KDE.")
        return
    if "--uninstall" in argv:
        autostart(False)
        for f in (CONFIG_FILE, QUEUE_FILE):
            if os.path.exists(f):
                os.remove(f)
        print("Removed. To delete the data already sent, use Delete my data on the dashboard.")
        return
    if "--autostart" in argv:
        on = argv[argv.index("--autostart") + 1:][:1] != ["off"]
        autostart(on)
        print("Starts at login." if on else "No longer starts at login.")
        return

    quiet = "--background" in argv
    cfg = load_config()
    if "--setup" in argv:
        key = (argv[argv.index("--setup") + 1:] or [""])[0]
        try:
            cfg = setup(key)
        except (ValueError, ServerError, urllib.error.URLError, OSError) as e:
            sys.exit(f"Setup failed: {e}")
        print(f"Connected as \"{cfg['name']}\".")
    if not cfg:
        if quiet:
            log("Not set up yet. Open the agent once to set it up.", True)
            return
        cfg = first_run()
        if not cfg:
            ask("\nPress Enter to close.")
            return
    report_loop(cfg, quiet)


if __name__ == "__main__":
    main(sys.argv[1:])
