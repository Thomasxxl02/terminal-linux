import { lazy } from "react";

/**
 * Lazy loading des vues lourdes (Monaco Editor ~2 Mo, xterm.js, etc.).
 * Chaque vue n'est chargée que lorsque l'utilisateur l'ouvre — le bundle
 * initial passe sous les 500 Ko. Fallback de chargement dans App.tsx.
 * Les props sont inférées automatiquement par React.lazy depuis la factory.
 */
export const LazyMonacoFileEditor = lazy(() =>
  import("./MonacoFileEditor").then((m) => ({ default: m.MonacoFileEditor }))
);
export const LazyTerminalView = lazy(() =>
  import("./TerminalView").then((m) => ({ default: m.TerminalView }))
);
export const LazyPlaybookSequencer = lazy(() =>
  import("./PlaybookSequencer").then((m) => ({ default: m.PlaybookSequencer }))
);
export const LazySshHostManager = lazy(() =>
  import("./SshHostManager").then((m) => ({ default: m.SshHostManager }))
);
export const LazySshTunnelManager = lazy(() =>
  import("./SshTunnelManager").then((m) => ({ default: m.SshTunnelManager }))
);
export const LazyLogsStreamer = lazy(() =>
  import("./LogsStreamer").then((m) => ({ default: m.LogsStreamer }))
);
export const LazySkillsHub = lazy(() =>
  import("./SkillsHub").then((m) => ({ default: m.SkillsHub }))
);
export const LazyWebShortcutsManager = lazy(() =>
  import("./WebShortcutsManager").then((m) => ({ default: m.WebShortcutsManager }))
);
export const LazyProfileManager = lazy(() =>
  import("./ProfileManager").then((m) => ({ default: m.ProfileManager }))
);
export const LazyMaintenanceHub = lazy(() =>
  import("./MaintenanceHub").then((m) => ({ default: m.MaintenanceHub }))
);
export const LazyTauriRustArchitect = lazy(() =>
  import("./TauriRustArchitect").then((m) => ({ default: m.TauriRustArchitect }))
);
export const LazySnippetsLibrary = lazy(() =>
  import("./SnippetsLibrary").then((m) => ({ default: m.SnippetsLibrary }))
);
export const LazySystemMonitorModal = lazy(() =>
  import("./SystemMonitorModal").then((m) => ({ default: m.SystemMonitorModal }))
);
