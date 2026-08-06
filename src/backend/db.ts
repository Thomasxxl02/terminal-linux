import pg from "pg";

// PostgreSQL Access Logic Module
// Handles direct communication with PostgreSQL database
const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;
let pool: pg.Pool | null = null;

// Simulated in-memory database for testing and fallback to guarantee no crashes
const memDb: {
  ssh_hosts: any[];
  snippets: any[];
  playbooks: any[];
  sync_logs: any[];
} = {
  ssh_hosts: [
    { id: "host-1", name: "Serveur Prod Nginx", host: "192.168.1.10", port: 22, username: "admin", description: "Serveur de production Web principal" },
    { id: "host-2", name: "Serveur Staging API", host: "192.168.1.20", port: 22, username: "developer", description: "Banc d'essai API et bases de données" }
  ],
  snippets: [
    { id: "snip-1", title: "Clean Docker cache", command: "docker system prune -a --volumes -f", category: "Docker", description: "Nettoie le stockage Docker inutilisé" },
    { id: "snip-2", title: "Show Active Ports", command: "netstat -tulnp", category: "Réseau", description: "Affiche les ports en cours d'écoute" }
  ],
  playbooks: [
    { id: "playbook-1", name: "Déploiement Web Nginx", steps: ["apt-get update", "apt-get install nginx -y", "systemctl enable nginx", "systemctl start nginx"] }
  ],
  sync_logs: []
};

export function getDbPool(): pg.Pool {
  if (process.env.NODE_ENV === "test") {
    // In test environment, return a dummy Pool to satisfy types if needed
    return {} as any;
  }
  if (!pool) {
    if (connectionString) {
      pool = new Pool({
        connectionString,
        ssl: connectionString.includes("cockroach") || connectionString.includes("supabase") || connectionString.includes("render")
          ? { rejectUnauthorized: false }
          : undefined,
      });
    } else {
      console.warn("DATABASE_URL non fournie. Utilisation de la base de données simulée.");
    }
  }
  return pool || ({} as any);
}

// Database initial tables generation
export async function initializeDatabaseSchema(): Promise<void> {
  if (!connectionString || process.env.NODE_ENV === "test") {
    return;
  }
  const activePool = getDbPool();
  try {
    await activePool.query(`
      CREATE TABLE IF NOT EXISTS ssh_hosts (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        host VARCHAR(100) NOT NULL,
        port INTEGER DEFAULT 22,
        username VARCHAR(50) NOT NULL,
        description TEXT
      );

      CREATE TABLE IF NOT EXISTS snippets (
        id VARCHAR(50) PRIMARY KEY,
        title VARCHAR(100) NOT NULL,
        command TEXT NOT NULL,
        category VARCHAR(50),
        description TEXT
      );

      CREATE TABLE IF NOT EXISTS playbooks (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        steps JSONB NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sync_logs (
        id SERIAL PRIMARY KEY,
        entity_type VARCHAR(50) NOT NULL,
        entity_id VARCHAR(50) NOT NULL,
        action VARCHAR(20) NOT NULL,
        performed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        details TEXT
      );
    `);
    console.log("[POSTGRESQL] Schémas de base de données initialisés avec succès.");
  } catch (error) {
    console.error("[POSTGRESQL] Erreur d'initialisation des schémas:", error);
  }
}

// SQL Query Helpers (Database Access Logic)
export async function fetchAllSshHosts(): Promise<any[]> {
  if (!connectionString || process.env.NODE_ENV === "test") {
    return memDb.ssh_hosts;
  }
  const result = await getDbPool().query("SELECT * FROM ssh_hosts ORDER BY name ASC");
  return result.rows;
}

export async function insertSshHost(host: {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  description?: string;
}): Promise<void> {
  if (!connectionString || process.env.NODE_ENV === "test") {
    memDb.ssh_hosts.push(host);
    return;
  }
  await getDbPool().query(
    "INSERT INTO ssh_hosts (id, name, host, port, username, description) VALUES ($1, $2, $3, $4, $5, $6)",
    [host.id, host.name, host.host, host.port, host.username, host.description || ""]
  );
}

export async function deleteSshHost(id: string): Promise<void> {
  if (!connectionString || process.env.NODE_ENV === "test") {
    memDb.ssh_hosts = memDb.ssh_hosts.filter((h) => h.id !== id);
    return;
  }
  await getDbPool().query("DELETE FROM ssh_hosts WHERE id = $1", [id]);
}

export async function fetchAllSnippets(): Promise<any[]> {
  if (!connectionString || process.env.NODE_ENV === "test") {
    return memDb.snippets;
  }
  const result = await getDbPool().query("SELECT * FROM snippets");
  return result.rows;
}

export async function insertSnippet(snippet: {
  id: string;
  title: string;
  command: string;
  category: string;
  description?: string;
}): Promise<void> {
  if (!connectionString || process.env.NODE_ENV === "test") {
    memDb.snippets.push(snippet);
    return;
  }
  await getDbPool().query(
    "INSERT INTO snippets (id, title, command, category, description) VALUES ($1, $2, $3, $4, $5)",
    [snippet.id, snippet.title, snippet.command, snippet.category, snippet.description || ""]
  );
}

export async function deleteSnippet(id: string): Promise<void> {
  if (!connectionString || process.env.NODE_ENV === "test") {
    memDb.snippets = memDb.snippets.filter((s) => s.id !== id);
    return;
  }
  await getDbPool().query("DELETE FROM snippets WHERE id = $1", [id]);
}

export async function fetchAllPlaybooks(): Promise<any[]> {
  if (!connectionString || process.env.NODE_ENV === "test") {
    return memDb.playbooks;
  }
  const result = await getDbPool().query("SELECT * FROM playbooks");
  return result.rows.map((row) => ({
    ...row,
    steps: typeof row.steps === "string" ? JSON.parse(row.steps) : row.steps
  }));
}

export async function insertPlaybook(playbook: { id: string; name: string; steps: string[] }): Promise<void> {
  if (!connectionString || process.env.NODE_ENV === "test") {
    memDb.playbooks.push(playbook);
    return;
  }
  await getDbPool().query(
    "INSERT INTO playbooks (id, name, steps) VALUES ($1, $2, $3)",
    [playbook.id, playbook.name, JSON.stringify(playbook.steps)]
  );
}

export async function deletePlaybook(id: string): Promise<void> {
  if (!connectionString || process.env.NODE_ENV === "test") {
    memDb.playbooks = memDb.playbooks.filter((p) => p.id !== id);
    return;
  }
  await getDbPool().query("DELETE FROM playbooks WHERE id = $1", [id]);
}

export async function insertSyncLog(log: { entity_type: string; entity_id: string; action: string; details?: string }): Promise<void> {
  if (!connectionString || process.env.NODE_ENV === "test") {
    memDb.sync_logs.push({
      ...log,
      id: memDb.sync_logs.length + 1,
      performed_at: new Date()
    });
    return;
  }
  await getDbPool().query(
    "INSERT INTO sync_logs (entity_type, entity_id, action, details) VALUES ($1, $2, $3, $4)",
    [log.entity_type, log.entity_id, log.action, log.details || ""]
  );
}

export async function fetchSyncLogs(): Promise<any[]> {
  if (!connectionString || process.env.NODE_ENV === "test") {
    return [...memDb.sync_logs].reverse();
  }
  const result = await getDbPool().query("SELECT * FROM sync_logs ORDER BY performed_at DESC");
  return result.rows;
}
