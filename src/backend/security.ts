import path from "path";

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
