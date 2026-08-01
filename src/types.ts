export interface TerminalSessionInfo {
  id: string;
  name: string;
  shell: string;
  cwd: string;
  createdAt: number;
  clientsCount?: number;
}

export interface TerminalTheme {
  id: string;
  name: string;
  background: string;
  foreground: string;
  cursor: string;
  cursorAccent: string;
  selectionBackground: string;
  black: string;
  red: string;
  green: string;
  yellow: string;
  blue: string;
  magenta: string;
  cyan: string;
  white: string;
  brightBlack: string;
  brightRed: string;
  brightGreen: string;
  brightYellow: string;
  brightBlue: string;
  brightMagenta: string;
  brightCyan: string;
  brightWhite: string;
}

export interface SystemStats {
  platform: string;
  release: string;
  arch: string;
  hostname: string;
  cpus: number;
  cpuModel: string;
  totalMem: number;
  freeMem: number;
  usedMem: number;
  memUsagePercent: number;
  uptime: number;
  loadavg: number[];
}

export interface FileTreeItem {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
}

export interface MaintenanceTask {
  id: string;
  title: string;
  description: string;
  command: string;
  iconName: string;
  badge?: string;
  category: 'system' | 'clean' | 'disk' | 'network' | 'process';
}

export interface CommandSnippet {
  id: string;
  title: string;
  command: string;
  description: string;
  category: string;
}

export interface ShellProfile {
  id: string;
  name: string;
  shell: string;
  cwd: string;
  env: Record<string, string>;
  color: string;
  iconName?: string;
  isDefault?: boolean;
}

export interface SavedTabSession {
  id: string;
  name: string;
  shell: string;
  cwd: string;
  profileId?: string;
}

export interface PlaybookStep {
  id: string;
  title: string;
  command: string;
  description?: string;
  stopOnError: boolean;
  delaySeconds: number;
}

export interface Playbook {
  id: string;
  name: string;
  description: string;
  category: "dev" | "maintenance" | "deploy" | "security" | "custom";
  steps: PlaybookStep[];
  createdAt: number;
}

export interface SshHost {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authType: 'password' | 'key';
  privateKeyPath?: string;
  tunnels?: string[];
  category?: string;
  color?: string;
  description?: string;
}

export interface SshTunnel {
  id: string;
  name: string;
  hostId: string;
  type: 'local' | 'remote' | 'dynamic';
  localPort: number;
  remoteHost: string;
  remotePort: number;
  status: 'active' | 'inactive';
  createdAt: number;
  trafficSent?: number;
  trafficReceived?: number;
  latency?: number;
}

export interface TauriSourceCode {
  cargoToml: string;
  mainRs: string;
  ptyRs: string;
  tauriConfJson: string;
}
