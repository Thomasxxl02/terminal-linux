# Politique de Sécurité (SECURITY.md)

Cette politique de sécurité s'applique à l'application desktop de gestion d'entreprise et de facturation électronique (Tauri + React + SQLite). Elle décrit les mesures de sécurité intégrées au système, les versions prises en charge, ainsi que la procédure pour signaler de manière responsable toute vulnérabilité détectée.

---

## 🛡️ Mesures de Sécurité Intégrées

L'application a été conçue en respectant les principes fondamentaux de sécurité applicative (OWASP, DevSkim, CodeQL) afin de protéger les données comptables et d'entreprise hautement sensibles :

### 1. Protection contre la Divulgation d'Informations Sensibles
* **Obfuscation du Stockage Local (`localStorage`) :** Les clés contenant des informations sensibles (telles que `terminal_ssh_hosts`, `tauri_linux_shell_profiles` et `tauri_linux_saved_tabs`) sont chiffrées/obfusquées de manière réversible à l'aide d'un masque XOR et d'un encodage Base64 sécurisé avant d'être écrites sur le disque local, empêchant ainsi leur lecture en clair.
* **Séparation Strict par Entreprise (`company_id`) :** Isolation absolue des données métier. Chaque requête et transaction est cloisonnée pour éviter toute fuite de données inter-entreprises.

### 2. Sécurité des Communications IPC et API
* **Validation Strict des Paramètres d'Entrée :** Toutes les routes d'API Express (`/api/*`) et de gestion de base de données (`/api/db/*`) valident formellement le type et la structure des données reçues (prévention contre la *Type Confusion* et l'injection SQL/commandes).
* **Limitation du Débit (Rate Limiting) :** Un middleware de limitation (`express-rate-limit`) protège les routes d'écriture sensibles pour empêcher les attaques par force brute ou saturation.
* **Résolution de Chemin Sécurisée (Anti-Path Traversal) :** L'accès aux fichiers locaux (par exemple, les fichiers de logs via `/api/logs`) est soumis à une validation de chemin rigoureuse (`getSafeLogPath`). Les chemins arbitraires hors du répertoire de l'application ou des répertoires temporaires autorisés sont systématiquement bloqués.

### 3. Cryptographie Moderne
* **Remplacement du Chiffrement Cassé :** Conformément aux alertes DevSkim/CodeQL, les algorithmes obsolètes ou cassés (comme DES) sont proscrits au profit d'algorithmes de chiffrement modernes et sécurisés (AES-GCM, ou des mécanismes d'obfuscation locale robustes lorsque requis).

---

## 📈 Versions Supportées

Seules les versions listées ci-dessous reçoivent actuellement des correctifs de sécurité :

| Version | Prise en charge | Notes |
| :--- | :--- | :--- |
| **v2.x** (Actuelle) | ✅ Oui | Version de production basée sur Tauri 2.x |
| **v1.x** | ❌ Non | Obsolète, migration recommandée vers v2.x |

---

## ✉️ Signaler une Vulnérabilité

Si vous découvrez une faille de sécurité dans cette application, veuillez **ne pas l'exposer publiquement** (par exemple, via un ticket de suivi public ou sur les réseaux sociaux). Nous vous prions de suivre le protocole de divulgation responsable suivant :

1. **Envoyer un Rapport Détaillé par E-mail :**
   * Destinataire : [carpentier.thomas.02@gmail.com](mailto:carpentier.thomas.02@gmail.com)
   * Objet : `[SECURITY] Rapport de Vulnérabilité - <Nom de la Faille>`

2. **Informations Souhaitées dans le Rapport :**
   * Une description détaillée de la vulnérabilité et de son impact potentiel.
   * Les étapes précises pour reproduire la faille (Proof of Concept - PoC).
   * Toute suggestion de correction ou d'atténuation (si disponible).

3. **Processus de Résolution :**
   * **Accusé de réception :** Nous accuserons réception de votre rapport sous 48 heures ouvrées.
   * **Analyse & Correctif :** Une analyse approfondie sera menée et un correctif sera développé en priorité.
   * **Divulgation publique :** Une fois le correctif déployé et validé, nous publierons les détails de la faille en vous créditant (avec votre accord).
