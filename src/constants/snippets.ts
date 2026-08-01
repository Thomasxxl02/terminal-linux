import { CommandSnippet, MaintenanceTask } from "../types";

export const MAINTENANCE_TASKS: MaintenanceTask[] = [
  {
    id: "apt-update",
    title: "Mise à jour du système (APT)",
    description: "Met à jour la liste des paquets et effectue les mises à jour de sécurité disponibles.",
    command: "apt-get update && apt-get upgrade -y",
    iconName: "RefreshCw",
    badge: "APT",
    category: "system"
  },
  {
    id: "apt-clean",
    title: "Nettoyage du cache d'installation",
    description: "Supprime les archives de paquets téléchargés (.deb) et libère de l'espace disque.",
    command: "apt-get clean && apt-get autoremove -y",
    iconName: "Trash2",
    badge: "Cache",
    category: "clean"
  },
  {
    id: "logs-purge",
    title: "Purge des fichiers de journaux (Logs)",
    description: "Nettoie les vieux fichiers .log volumineux dans /var/log et tronque les logs système.",
    command: "find /var/log -type f -name '*.log' -size +10M -exec truncate -s 0 {} + 2>/dev/null",
    iconName: "FileText",
    badge: "Logs",
    category: "clean"
  },
  {
    id: "disk-space",
    title: "Analyse d'occupation disque",
    description: "Affiche la consommation d'espace disque par partition et les plus gros dossiers.",
    command: "df -h && du -sh ./* 2>/dev/null | sort -hr | head -n 10",
    iconName: "HardDrive",
    badge: "Disk",
    category: "disk"
  },
  {
    id: "top-processes",
    title: "Inspection des processus gourmands",
    description: "Affiche les 10 processus consommant le plus de CPU et de mémoire RAM.",
    command: "ps aux --sort=-%cpu | head -n 11",
    iconName: "Cpu",
    badge: "RAM/CPU",
    category: "process"
  },
  {
    id: "drop-caches",
    title: "Libération du cache mémoire Linux",
    description: "Libère la mémoire cache (PageCache, dentries et inodes) libérable par le noyau.",
    command: "sync && echo 3 > /proc/sys/vm/drop_caches 2>/dev/null || echo 'Cache mémoire synchronisé'",
    iconName: "Zap",
    badge: "Mémoire",
    category: "clean"
  }
];

export const COMMAND_SNIPPETS: CommandSnippet[] = [
  {
    id: "sys-info",
    title: "Infos Système Détaillées",
    command: "uname -a && lsb_release -a 2>/dev/null || cat /etc/os-release",
    description: "Affiche la version du noyau Linux et la distribution.",
    category: "Système"
  },
  {
    id: "net-listen",
    title: "Ports Réseau Écoute",
    command: "netstat -tulpn 2>/dev/null || ss -tulpn 2>/dev/null || lsof -i",
    description: "Liste tous les ports réseau en écoute sur le système.",
    category: "Réseau"
  },
  {
    id: "git-status",
    title: "Statut Git Résumé",
    command: "git status -s && git branch -vv",
    description: "Affiche les modifications locales et la branche actuelle.",
    category: "Développement"
  },
  {
    id: "find-large-files",
    title: "Trouver les Gros Fichiers (>100M)",
    command: "find / -type f -size +100M -exec ls -lh {} + 2>/dev/null | sort -k 5 -rh | head -n 10",
    description: "Cherche les fichiers de plus de 100 Mo sur l'ensemble du système.",
    category: "Stockage"
  },
  {
    id: "docker-ps",
    title: "Conteneurs Docker Actifs",
    command: "docker ps --format 'table {{.Names}}\\t{{.Status}}\\t{{.Ports}}' 2>/dev/null || echo 'Docker non démarré'",
    description: "Liste les conteneurs Docker en cours d'exécution.",
    category: "Docker"
  },
  {
    id: "watch-memory",
    title: "Suivi Réseau et Connexions",
    command: "ip a && ping -c 3 google.com",
    description: "Test rapide de connectivité réseau et affichage de l'adresse IP.",
    category: "Réseau"
  }
];
