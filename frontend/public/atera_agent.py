#!/usr/bin/env python3
"""
Atera RMM Cross-Platform Endpoint Agent (Python 3)
Supports Windows, macOS, and Linux
"""

import sys
import os
import platform
import socket
import json
import time
import subprocess
import urllib.request
import urllib.error

REGISTRATION_TOKEN = "ITAM-AGENT-SECURE-TOKEN-2026"
SERVER_URL = os.environ.get("ATERA_SERVER_URL", "http://localhost:5005")

def get_serial_number():
    plat = platform.system()
    try:
        if plat == "Windows":
            out = subprocess.check_output("wmic bios get serialnumber", shell=True).decode()
            lines = [l.strip() for l in out.splitlines() if l.strip()]
            if len(lines) > 1:
                return lines[1]
        elif plat == "Darwin":
            out = subprocess.check_output("system_profiler SPHardwareDataType | grep 'Serial Number'", shell=True).decode()
            return out.split(":")[-1].strip()
        elif plat == "Linux":
            if os.path.exists("/sys/class/dmi/id/product_serial"):
                with open("/sys/class/dmi/id/product_serial", "r") as f:
                    return f.read().strip()
    except Exception:
        pass
    return f"SN-{socket.gethostname().upper()}"

def get_system_metrics():
    hostname = socket.gethostname()
    plat = platform.system()
    plat_rel = platform.release()
    plat_ver = platform.version()
    machine = platform.machine()
    processor = platform.processor() or "Multi-Core CPU"
    serial = get_serial_number()

    # Get local IP
    ip = "127.0.0.1"
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
    except Exception:
        pass

    return {
        "registrationToken": REGISTRATION_TOKEN,
        "serialNumber": serial,
        "hostName": hostname,
        "computerName": hostname,
        "domainName": "WORKGROUP",
        "manufacturer": platform.system() + " Standard",
        "model": platform.machine() + " Workstation",
        "cpu": processor,
        "ram": "16 GB",
        "storage": "512 GB SSD",
        "operatingSystem": f"{plat} {plat_rel}",
        "windowsEdition": f"{plat} {plat_rel}",
        "windowsVersion": plat_ver,
        "buildNumber": plat_ver,
        "macAddress": "00:00:00:00:00:00",
        "ipAddress": ip,
        "bitLockerStatus": "Protection On" if plat == "Windows" else "Encrypted",
        "defenderStatus": "Running",
        "batteryHealthPct": 100,
        "cpuUsagePercent": 15,
        "ramUsagePercent": 50,
        "diskFreeGB": 200,
        "diskTotalGB": 512,
        "loggedInUser": os.environ.get("USERNAME") or os.environ.get("USER") or "admin",
        "runningProcesses": [],
        "systemServices": [],
        "installedSoftware": []
    }

def send_heartbeat(metrics):
    url = f"{SERVER_URL}/api/agent/submit"
    data = json.dumps(metrics).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers={
        "Content-Type": "application/json",
        "x-registration-token": REGISTRATION_TOKEN
    })
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            print(f"[{time.strftime('%X')}] Heartbeat synced. Status: {resp.status}")
    except Exception as e:
        print(f"[{time.strftime('%X')}] Heartbeat error: {e}")

def check_tasks(serial):
    url = f"{SERVER_URL}/api/agent/tasks?serialNumber={serial}&token={REGISTRATION_TOKEN}"
    req = urllib.request.Request(url, headers={"x-registration-token": REGISTRATION_TOKEN})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
            tasks = data.get("tasks", [])
            for task in tasks:
                execute_task(task)
    except Exception as e:
        print(f"[{time.strftime('%X')}] Task poll error: {e}")

def execute_task(task):
    task_id = task["id"]
    cmd_type = task["commandType"]
    cmd_text = task["commandText"]
    print(f"[{time.strftime('%X')}] Executing task {task_id} ({cmd_type}): {cmd_text[:60]}")

    out = ""
    err = ""
    code = 0
    try:
        proc = subprocess.Popen(cmd_text, shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        out, err = proc.communicate(timeout=60)
        code = proc.returncode
    except Exception as e:
        err = str(e)
        code = 1

    res_url = f"{SERVER_URL}/api/agent/tasks/{task_id}/result"
    res_data = json.dumps({
        "registrationToken": REGISTRATION_TOKEN,
        "output": out,
        "errorOutput": err,
        "exitCode": code
    }).encode("utf-8")

    req = urllib.request.Request(res_url, data=res_data, headers={
        "Content-Type": "application/json",
        "x-registration-token": REGISTRATION_TOKEN
    })
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            print(f"[{time.strftime('%X')}] Task {task_id} result reported (code {code})")
    except Exception as e:
        print(f"[{time.strftime('%X')}] Failed to report task result: {e}")

def main():
    print("=" * 60)
    print("      Atera Cross-Platform RMM Agent (Python 3)        ")
    print("=" * 60)
    metrics = get_system_metrics()
    serial = metrics["serialNumber"]
    print(f"Device Serial: {serial} | Host: {metrics['hostName']} | IP: {metrics['ipAddress']}")
    send_heartbeat(metrics)
    check_tasks(serial)

    if "--once" in sys.argv:
        print("Execution finished.")
        return

    print("Running background monitoring loop (Press Ctrl+C to exit)...")
    hb_counter = 0
    while True:
        time.sleep(5)
        hb_counter += 5
        check_tasks(serial)
        if hb_counter >= 15:
            hb_counter = 0
            send_heartbeat(get_system_metrics())

if __name__ == "__main__":
    main()
