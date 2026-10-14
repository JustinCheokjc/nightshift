"""Adds this computer to the market simulator as a real device.

When the computer is plugged in and untouched, it takes CPU tasks from the
simulator, computes them for real, and stops the moment you touch the
keyboard or mouse. The task is handed back to the market.

  python worker.py                  idle after 5 minutes, like the real agent
  python worker.py --idle-after 20  shorter, for demos
"""
import argparse
import base64
import json
import os
import socket
import sys
import time
import urllib.error
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "agent"))

import mandel  # noqa: E402
import nightshift_agent as agent  # noqa: E402  (idle and power detection)


def post(server, path, body):
    req = urllib.request.Request(server + path, data=json.dumps(body).encode(), method="POST")
    req.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.loads(r.read().decode())


def current_state(idle_after, allow_battery):
    idle = agent.input_idle_sec()
    plugged, _ = agent.power()
    if plugged is False and not allow_battery:
        return "battery", idle
    if idle is None or idle < idle_after:
        return "in_use", idle
    return "idle", idle


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--server", default="http://127.0.0.1:8090")
    ap.add_argument("--idle-after", type=int, default=300, help="seconds untouched before working (default 300)")
    ap.add_argument("--allow-battery", action="store_true", help="also work on battery power")
    args = ap.parse_args()

    try:
        device = post(args.server, "/api/worker/register",
                      {"name": f"{socket.gethostname()} (this computer)", "cores": os.cpu_count()})["device_id"]
    except (urllib.error.URLError, OSError) as e:
        sys.exit(f"Can't reach the market simulator at {args.server} ({e}). Start it with: python marketplace.py")
    print(f"Joined the market simulator. Works after {args.idle_after}s untouched; touch the mouse to stop. Ctrl+C quits.",
          flush=True)

    last_state = None
    while True:
        state, idle = current_state(args.idle_after, args.allow_battery)
        if state != last_state:
            print({"idle": "Idle: taking work.", "in_use": "In use: not working.",
                   "battery": "On battery: not working."}[state], flush=True)
            last_state = state
        try:
            res = post(args.server, "/api/worker/poll", {"device_id": device, "state": state})
        except urllib.error.HTTPError as e:
            if e.code == 404:
                sys.exit("The market simulator was restarted. Run the worker again to rejoin.")
            raise
        except (urllib.error.URLError, OSError):
            print("Market simulator unreachable; retrying.", flush=True)
            time.sleep(5)
            continue
        if res.get("suspended"):
            sys.exit("This device was suspended by the market simulator.")

        task = res.get("task")
        if not task or state != "idle":
            time.sleep(2)
            continue

        started = time.time()
        last_check = [0.0]

        def touched():  # any input resets idle time below the threshold
            if time.time() - last_check[0] < 0.5:
                return False
            last_check[0] = time.time()
            return (agent.input_idle_sec() or 0) < args.idle_after

        data = mandel.render_tile(*task["view"], task["tx"], task["ty"], should_stop=touched)
        if data is None:
            post(args.server, "/api/worker/abort", {"device_id": device, "task_id": task["task_id"]})
            print("You're back. Stopped and handed the task back.", flush=True)
            last_state = "in_use"
            continue
        r = post(args.server, "/api/worker/result",
                 {"device_id": device, "task_id": task["task_id"], "data": base64.b64encode(data).decode()})
        print(f"Finished a tile for {task['buyer']} in {time.time() - started:.1f}s. "
              f"Earned so far: S${r.get('earned', 0):.4f}", flush=True)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        pass
