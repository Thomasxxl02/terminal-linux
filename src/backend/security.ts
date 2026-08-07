import path from "path";
import fs from "fs";

/**
 * Extrait un message d'erreur lisible depuis une valeur inconnue
 * (remplace les `catch (err: any)` → `catch (err)` + errMsg(err)).
 */
export function errMsg(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return "Erreur inconnue";
  }
}

/**
 * Garde-fou de SÛRETÉ (indépendant du rôle) : ces chemins système ne
 * doivent JAMAIS être supprimés ou renommés, même par un admin. Évite
 * qu'un bug UI ou une faute de frappe ne supprime la machine.
 * Miroir de la protection Rust (src-tauri/src/fs.rs).
 */
export function isProtectedSystemPath(targetPath: string): boolean {
  const PROTECTED_PREFIXES = [
    "/etc", "/usr", "/bin", "/sbin", "/boot", "/dev", "/proc", "/sys",
    "/lib", "/lib64", "/var", "/snap",
  ];
  const PROTECTED_EXACT = ["/", "/home", "/root", "/media", "/mnt"];

  let resolved = path.normalize(targetPath);
  try {
    resolved = fs.realpathSync(targetPath);
  } catch {
    // Le chemin n'existe pas : on garde la version normalisée
  }
  for (const prefix of PROTECTED_PREFIXES) {
    if (resolved === prefix || resolved.startsWith(prefix + "/")) {
      return true;
    }
  }
  if (PROTECTED_EXACT.includes(resolved)) return true;
  const home = process.env.HOME;
  if (home && resolved === path.normalize(home)) return true;
  return false;
}

/**
 * Fichiers CRITIQUES dont l'ÉCRASEMENT est interdit (même admin) : les
 * écraser verrouillerait la machine (passwd/shadow/sudoers) ou casserait
 * la confiance (clés host SSH, kernels boot). Les fichiers de config
 * classiques (nginx.conf, fstab…) restent éditables — seuls ces cas
 * irrécupérables sont bloqués.
 */
const CRITICAL_FILES = [
  "/etc/passwd", "/etc/shadow", "/etc/group", "/etc/gshadow",
  "/etc/sudoers", "/etc/sudoers.d", "/etc/fstab", "/etc/crypttab",
  "/etc/ssh/ssh_host_rsa_key", "/etc/ssh/ssh_host_ed25519_key",
  "/etc/ssh/ssh_host_ecdsa_key", "/etc/ssh/sshd_config",
];

export function isCriticalSystemFile(targetPath: string): boolean {
  let resolved = path.normalize(targetPath);
  try {
    resolved = fs.realpathSync(targetPath);
  } catch {
    // Le chemin n'existe pas : on garde la version normalisée
  }
  for (const critical of CRITICAL_FILES) {
    if (resolved === critical || resolved.startsWith(critical + "/")) {
      return true;
    }
  }
  return false;
}

/**
 * Resolves a path against the workspace directory (process.cwd()) and checks for path traversal.
 * Also handles type validation to ensure parameter isn't an array/object.
 */
export function getSafePath(userInput: unknown): string {
  if (typeof userInput !== "string" || !userInput) {
    return process.cwd();
  }

  // Resolve to absolute path
  const baseDir = path.resolve(process.cwd());
  const resolved = path.resolve(baseDir, userInput);

  // Ensure the resolved path starts with the base workspace directory
  if (!resolved.startsWith(baseDir)) {
    throw new Error("Accès interdit : dépassement de l'arborescence autorisée.");
  }

  return resolved;
}

/**
 * Specifically validates and resolves log files safely.
 * Only allows /tmp/application.log or workspace paths.
 */
export function getSafeLogPath(userInput: unknown): string {
  const defaultLog = "/tmp/application.log";
  if (typeof userInput !== "string" || !userInput) {
    return defaultLog;
  }

  const normalizedInput = path.normalize(userInput);
  const normalizedDefault = path.normalize(defaultLog);
  
  if (normalizedInput === normalizedDefault) {
    return defaultLog;
  }

  try {
    const baseDir = path.resolve(process.cwd());
    const resolved = path.resolve(baseDir, userInput);
    if (resolved.startsWith(baseDir)) {
      return resolved;
    }
  } catch {
    // Fallback
  }

  return defaultLog;
}

/**
 * Strict parameter type validation to prevent Type Confusion / Parameter Manipulation attacks.
 */
export function validateString(input: unknown, name: string): string {
  if (typeof input !== "string") {
    throw new Error(`Le paramètre '${name}' est invalide (doit être une chaîne de caractères)`);
  }
  return input;
}

export function validateOptionalString(input: unknown, name: string): string | undefined {
  if (input === undefined) return undefined;
  return validateString(input, name);
}

export function validateInteger(input: unknown, name: string): number {
  const num = Number(input);
  if (isNaN(num) || !Number.isInteger(num)) {
    throw new Error(`Le paramètre '${name}' est invalide (doit être un entier)`);
  }
  return num;
}

export function validatePositiveInteger(input: unknown, name: string): number {
  const num = validateInteger(input, name);
  if (num <= 0) {
    throw new Error(`Le paramètre '${name}' doit être un entier positif`);
  }
  return num;
}
