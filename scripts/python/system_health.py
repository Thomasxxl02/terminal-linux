#!/usr/bin/env python3
"""Surveillance système légère — aucune dépendance externe (stdlib uniquement).

Usage:
    python3 scripts/python/system_health.py [--once] [--interval 2]

Affiche en continu (ou une fois avec --once) : charge CPU, mémoire, disque,
réseau et processus les plus gourmands. Sortie lisible par l'humain, au format
texte simple pour être utilisable dans un terminal ou un cron.
"""

import argparse
import os
import sys
import time


def read_proc(path: str) -> str:
    """Lit un fichier /proc, retourne "" si inexistant (lecture sans privilège)."""
    try:
        with open(path, "r", encoding="utf-8") as f:
            return f.read()
    except OSError:
        return ""


def cpu_percent(prev_total: int, prev_idle: int) -> float:
    """Calcule le % CPU entre deux lectures de /proc/stat."""
    stat = read_proc("/proc/stat").splitlines()
    if not stat:
        return 0.0
    fields = stat[0].split()[1:]
    # Champs: user nice system idle iowait irq softirq steal guest guest_nice
    idle = int(fields[3]) + int(fields[4]) if len(fields) > 4 else int(fields[3])
    total = sum(int(x) for x in fields)
    d_total = total - prev_total
    d_idle = idle - prev_idle
    if d_total <= 0:
        return 0.0
    return 100.0 * (1.0 - d_idle / d_total)


def mem_info() -> tuple[int, int, float]:
    """Retourne (total_octets, libre_octets, pct_utilisé)."""
    info: dict[str, int] = {}
    for line in read_proc("/proc/meminfo").splitlines():
        parts = line.split(":")
        if len(parts) == 2:
            key = parts[0].strip()
            # "MemTotal:       16384000 kB" → nombre en ko
            val = parts[1].strip().split()[0]
            try:
                info[key] = int(val) * 1024
            except ValueError:
                pass
    total = info.get("MemTotal", 0)
    available = info.get("MemAvailable", info.get("MemFree", 0))
    used = total - available
    pct = (used / total * 100.0) if total else 0.0
    return total, available, pct


def loadavg() -> tuple[float, float, float]:
    """Charge 1/5/15 min depuis /proc/loadavg."""
    parts = read_proc("/proc/loadavg").split()
    if len(parts) >= 3:
        try:
            return float(parts[0]), float(parts[1]), float(parts[2])
        except ValueError:
            pass
    return 0.0, 0.0, 0.0


def top_processes(n: int = 5) -> list[tuple[int, float, str]]:
    """Retourne les n processus les plus gourmands en RAM : [(pid, rss_octets, cmd)]."""
    procs: list[tuple[int, float, str]] = []
    for pid in os.listdir("/proc"):
        if not pid.isdigit():
            continue
        try:
            with open(f"/proc/{pid}/status", "r", encoding="utf-8") as f:
                status = f.read()
            with open(f"/proc/{pid}/comm", "r", encoding="utf-8") as f:
                cmd = f.read().strip()
            rss_kb = 0
            for line in status.splitlines():
                if line.startswith("VmRSS:"):
                    rss_kb = int(line.split()[1]) * 1024
                    break
            procs.append((int(pid), float(rss_kb), cmd))
        except (OSError, ValueError):
            continue
    procs.sort(key=lambda p: p[1], reverse=True)
    return procs[:n]


def format_bytes(n: float) -> str:
    for unit in ("o", "Ko", "Mo", "Go", "To"):
        if n < 1024 or unit == "To":
            return f"{n:.1f} {unit}"
        n /= 1024
    return f"{n:.1f} To"


def main() -> int:
    parser = argparse.ArgumentParser(description="Surveillance système (stdlib Python)")
    parser.add_argument("--once", action="store_true", help="Affiche une seule mesure puis quitte")
    parser.add_argument("--interval", type=float, default=2.0, help="Intervalle entre mesures (s)")
    args = parser.parse_args()

    prev_total = prev_idle = 0
    first = True
    while True:
        stat = read_proc("/proc/stat").splitlines()
        if stat:
            fields = stat[0].split()[1:]
            idle = int(fields[3]) + int(fields[4]) if len(fields) > 4 else int(fields[3])
            total = sum(int(x) for x in fields)
            if not first:
                cpu = cpu_percent(prev_total, prev_idle)
            else:
                cpu = 0.0
            prev_total, prev_idle = total, idle
        else:
            cpu = 0.0

        total_mem, free_mem, mem_pct = mem_info()
        l1, l5, l15 = loadavg()
        procs = top_processes(5)

        hostname = os.uname().nodename
        print(f"\n=== {hostname} — {time.strftime('%Y-%m-%d %H:%M:%S')} ===")
        print(f"CPU  : {cpu:5.1f} %")
        print(f"RAM  : {format_bytes(total_mem - free_mem)} / {format_bytes(total_mem)} ({mem_pct:.1f} %)")
        print(f"Load : {l1:.2f} / {l5:.2f} / {l15:.2f}")
        print("Top RAM :")
        for pid, rss, cmd in procs:
            print(f"  {pid:>7}  {format_bytes(rss):>10}  {cmd[:40]}")

        first = False
        if args.once:
            return 0
        try:
            time.sleep(args.interval)
        except KeyboardInterrupt:
            print("\nArrêt.")
            return 0


if __name__ == "__main__":
    sys.exit(main())
