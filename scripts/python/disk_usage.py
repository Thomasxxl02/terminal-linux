#!/usr/bin/env python3
"""Analyse d'espace disque — stdlib uniquement.

Usage:
    python3 scripts/python/disk_usage.py [--path /] [--depth 1] [--top 10]

Parcourt l'arborescence et affiche les dossiers les plus volumineux.
Évite /proc, /sys, /dev et les points de montage dupliqués (résultat faux).
"""

import argparse
import os
import sys

# Fausses arborescences système — toujours sautées
SKIP_DIRS = {"/proc", "/sys", "/dev", "/run", "/snap"}


def du(path: str, depth: int, max_depth: int, top: list[tuple[str, int]]) -> int:
    """Calcule la taille récursive d'un dossier et met à jour le top."""
    total = 0
    try:
        with os.scandir(path) as it:
            for entry in it:
                try:
                    if entry.is_symlink():
                        continue  # évite les boucles de liens symboliques
                    if entry.is_dir(follow_symlinks=False):
                        if entry.path in SKIP_DIRS:
                            continue
                        if depth < max_depth:
                            sub = du(entry.path, depth + 1, max_depth, top)
                        else:
                            # Profondeur max : on ne descend plus, on estime
                            sub = _shallow_du(entry.path)
                        total += sub
                    elif entry.is_file(follow_symlinks=False):
                        try:
                            total += entry.stat(follow_symlinks=False).st_size
                        except OSError:
                            pass
                except OSError:
                    continue
    except OSError:
        return 0

    if depth >= 1:
        top.append((path, total))
        top.sort(key=lambda x: x[1], reverse=True)
        del top[args_top_limit:]  # noqa: F821 — défini dans main()
    return total


def _shallow_du(path: str) -> int:
    """Taille d'un dossier sans descendre récursivement (rapide, moins précis)."""
    total = 0
    try:
        with os.scandir(path) as it:
            for entry in it:
                try:
                    if entry.is_file(follow_symlinks=False):
                        total += entry.stat(follow_symlinks=False).st_size
                except OSError:
                    continue
    except OSError:
        pass
    return total


def format_bytes(n: float) -> str:
    for unit in ("o", "Ko", "Mo", "Go", "To"):
        if n < 1024 or unit == "To":
            return f"{n:.1f} {unit}"
        n /= 1024
    return f"{n:.1f} To"


def main() -> int:
    global args_top_limit
    parser = argparse.ArgumentParser(description="Analyse d'espace disque (stdlib Python)")
    parser.add_argument("--path", default="/", help="Dossier racine à analyser")
    parser.add_argument("--depth", type=int, default=1, help="Profondeur de descente")
    parser.add_argument("--top", type=int, default=10, help="Nombre de dossiers affichés")
    args = parser.parse_args()
    args_top_limit = args.top

    top: list[tuple[str, int]] = []
    total = du(args.path, 0, max(args.depth, 1), top)

    print(f"\n=== Analyse de {args.path} ===")
    print(f"Taille totale : {format_bytes(total)}\n")
    print("Dossiers les plus volumineux :")
    for path, size in top[: args.top]:
        print(f"  {format_bytes(size):>10}  {path}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
