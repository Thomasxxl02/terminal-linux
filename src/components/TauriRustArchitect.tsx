import React, { useEffect, useState } from "react";
import Editor from "@monaco-editor/react";
import { apiFetch } from "../lib/api";
import {
  Box,
  Copy,
  Check,
  Terminal as TermIcon,
  Shield,
  Layers,
  Zap,
  Cpu,
  Globe,
  ArrowRight,
  TrendingUp,
  Award,
  Settings,
  AlertTriangle,
  Gauge,
  Fingerprint,
  CheckCircle,
  HelpCircle,
  Sparkles
} from "lucide-react";
import { TauriSourceCode } from "../types";

interface ArchDef {
  id: string;
  name: string;
  badge: string;
  icon: React.ComponentType<any>;
  color: string;
  borderColor: string;
  textColor: string;
  bgColor: string;
  description: string;
  metrics: {
    memory: string;
    bundleSize: string;
    speed: string;
    security: string;
    flexibility: string;
  };
  pros: string[];
  cons: string[];
  pipeline: { step: string; desc: string }[];
  files: { name: string; key: string; lang: string; content: string }[];
}

export const TauriRustArchitect: React.FC = () => {
  const [sourceCode, setSourceCode] = useState<TauriSourceCode | null>(null);
  const [activeArch, setActiveArch] = useState<string>("tauri");
  const [activeTabMap, setActiveTabMap] = useState<Record<string, string>>({
    tauri: "pty",
    electron: "main",
    web: "server",
    alacritty: "config",
  });
  const [copied, setCopied] = useState(false);

  // --- Dynamic Recommender State ---
  const [platform, setPlatform] = useState<"desktop" | "web" | "multi">("desktop");
  const [ramBudget, setRamBudget] = useState<number>(100); // MB
  const [rustExp, setRustExp] = useState<"yes" | "no">("yes");
  const [focusArea, setFocusArea] = useState<"speed" | "security" | "ecosystem" | "remote">("speed");

  // --- Benchmark Simulator State ---
  const [isBenchmarking, setIsBenchmarking] = useState(false);
  const [benchProgress, setBenchProgress] = useState(0);
  const [benchStage, setBenchStage] = useState("");
  const [benchResults, setBenchResults] = useState<Record<string, { latency: number; fps: number; cpu: number; ram: number }> | null>(null);

  useEffect(() => {
    apiFetch("/api/tauri/source")
      .then((res) => res.json())
      .then((data) => setSourceCode(data))
      .catch((e) => console.error("Failed to fetch Tauri source code", e));
  }, []);

  // 1. Electron Code Templates
  const electronFiles = [
    {
      name: "main.js",
      key: "main",
      lang: "javascript",
      content: `// main.js - Processus Principal Electron (gestion de node-pty)
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const os = require('os');
const pty = require('node-pty');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadURL('http://localhost:3000');
}

app.whenReady().then(() => {
  createWindow();

  // Création du terminal PTY natif via node-pty
  const shell = process.platform === 'win32' ? 'powershell.exe' : 'bash';
  const ptyProcess = pty.spawn(shell, [], {
    name: 'xterm-color',
    cols: 80,
    rows: 24,
    cwd: process.env.HOME,
    env: process.env
  });

  // Transfert de la sortie standard vers le Renderer Process
  ptyProcess.onData((data) => {
    mainWindow.webContents.send('pty-output', data);
  });

  // Réception de la saisie utilisateur du Renderer Process
  ipcMain.on('pty-input', (event, data) => {
    ptyProcess.write(data);
  });

  // Gestion du redimensionnement dynamique
  ipcMain.on('pty-resize', (event, { cols, rows }) => {
    ptyProcess.resize(cols, rows);
  });
});
`
    },
    {
      name: "preload.js",
      key: "preload",
      lang: "javascript",
      content: `// preload.js - Pont IPC Sécurisé isolé par Contexte
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('terminalAPI', {
  sendInput: (data) => ipcRenderer.send('pty-input', data),
  onOutput: (callback) => ipcRenderer.on('pty-output', (event, data) => callback(data)),
  resize: (cols, rows) => ipcRenderer.send('pty-resize', { cols, rows })
});
`
    },
    {
      name: "package.json",
      key: "pkg",
      lang: "json",
      content: `{
  "name": "electron-terminal-emulator",
  "version": "1.0.0",
  "main": "main.js",
  "scripts": {
    "start": "electron ."
  },
  "dependencies": {
    "electron": "^28.2.0",
    "node-pty": "^1.0.0",
    "xterm": "^5.3.0"
  }
}`
    }
  ];

  // 2. Web-Based Code Templates
  const webFiles = [
    {
      name: "server-pty.js",
      key: "server",
      lang: "javascript",
      content: `// server-pty.js - Serveur Passerelle WebSocket Express + node-pty
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const pty = require('node-pty');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  console.log('Nouveau client WebSocket terminal connecté');

  // Lancement du shell PTY côté serveur
  const shell = 'bash';
  const ptyProcess = pty.spawn(shell, ['-i'], {
    name: 'xterm-256color',
    cols: 80,
    rows: 24,
    cwd: process.cwd(),
    env: process.env
  });

  // Relayer la sortie standard PTY vers le client WebSocket
  ptyProcess.onData((data) => {
    ws.send(JSON.stringify({ type: 'output', data }));
  });

  // Intercepter les messages du client
  ws.on('message', (message) => {
    try {
      const msg = JSON.parse(message);
      if (msg.type === 'input') {
        ptyProcess.write(msg.data);
      } else if (msg.type === 'resize') {
        ptyProcess.resize(msg.cols, msg.rows);
      }
    } catch (e) {
      console.error('Erreur traitement message WebSocket:', e);
    }
  });

  ws.on('close', () => {
    console.log('Client déconnecté, fermeture du processus PTY');
    ptyProcess.kill();
  });
});

server.listen(3000, () => {
  console.log('Serveur passerelle terminal en écoute sur le port 3000');
});
`
    },
    {
      name: "client-terminal.tsx",
      key: "client",
      lang: "typescript",
      content: `// client-terminal.tsx - Composant Client de Connexion WebSocket
import React, { useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';

export const WebTerminal: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Initialisation d'Xterm.js
    const term = new Terminal({
      cursorBlink: true,
      theme: { background: '#0f172a' }
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);
    fitAddon.fit();

    // Connexion à la passerelle WebSocket
    const ws = new WebSocket('ws://localhost:3000/pty');
    socketRef.current = ws;

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === 'output') {
        term.write(msg.data);
      }
    };

    // Transmission des entrées clavier utilisateur
    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'input', data }));
      }
    });

    // Transmission du redimensionnement du navigateur
    window.addEventListener('resize', () => {
      fitAddon.fit();
      ws.send(JSON.stringify({
        type: 'resize',
        cols: term.cols,
        rows: term.rows
      }));
    });

    return () => {
      ws.close();
      term.dispose();
    };
  }, []);

  return <div ref={containerRef} className="w-full h-full" />;
};
`
    }
  ];

  // 3. GPU Native Code Templates
  const alacrittyFiles = [
    {
      name: "alacritty.toml",
      key: "config",
      lang: "toml",
      content: `# alacritty.toml - Configuration du terminal ultra-performant GPU Alacritty
[window]
dimensions = { columns = 100, lines = 30 }
padding = { x = 12, y = 12 }
dynamic_title = true
decorations = "full"
startup_mode = "Windowed"

[scrolling]
history = 10000
multiplier = 3

[font]
normal = { family = "JetBrains Mono", style = "Regular" }
bold = { family = "JetBrains Mono", style = "Bold" }
size = 12.0

[colors.primary]
background = "#0f1419"
foreground = "#e6e6e6"

[colors.normal]
black   = "#000000"
red     = "#ff3333"
green   = "#b8cc52"
yellow  = "#e7c547"
blue    = "#36a3d9"
magenta = "#f07178"
cyan    = "#95e6cb"
white   = "#ffffff"
`
    },
    {
      name: "render_pipeline.rs",
      key: "rust-gpu",
      lang: "rust",
      content: `// render_pipeline.rs - Pipeline d'affichage GPU vectoriel OpenGL (simplifié)
use glutin::prelude::*;
use wgpu::util::DeviceExt;

pub struct TerminalGpuRenderer {
    device: wgpu::Device,
    queue: wgpu::Queue,
    render_pipeline: wgpu::RenderPipeline,
    vertex_buffer: wgpu::Buffer,
    index_buffer: wgpu::Buffer,
    num_indices: u32,
}

impl TerminalGpuRenderer {
    pub fn new(device: wgpu::Device, queue: wgpu::Queue, format: wgpu::TextureFormat) -> Self {
        // Chargement du Vertex & Fragment Shader GPU de rendu de glyphes
        let shader = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some("Terminal Shader GPU"),
            source: wgpu::ShaderSource::Wgsl(include_str!("shader.wgsl").into()),
        });

        // Définition de l'agencement du pipeline (Layout)
        let render_pipeline_layout = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
            label: Some("Layout de Pipeline Terminal"),
            bind_group_layouts: &[],
            push_constant_ranges: &[],
        });

        let render_pipeline = device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
            label: Some("Pipeline de Rendu Terminal"),
            layout: Some(&render_pipeline_layout),
            vertex: wgpu::VertexState {
                module: &shader,
                entry_point: "vs_main",
                buffers: &[Vertex::desc()],
            },
            fragment: Some(wgpu::FragmentState {
                module: &shader,
                entry_point: "fs_main",
                targets: &[Some(wgpu::ColorTargetState {
                    format,
                    blend: Some(wgpu::BlendState::REPLACE),
                    write_mask: wgpu::ColorWrites::ALL,
                })],
            }),
            primitive: wgpu::PrimitiveState::default(),
            depth_stencil: None,
            multisample: wgpu::MultisampleState::default(),
            multiview: None,
        });

        Self {
            device,
            queue,
            render_pipeline,
            vertex_buffer: todo!(),
            index_buffer: todo!(),
            num_indices: 0,
        }
    }

    pub fn draw_cells(&mut self, cells: &[Cell], encoder: &mut wgpu::CommandEncoder, view: &wgpu::TextureView) {
        // Envoi direct des coordonnées matricielles et des index de polices de caractères au framebuffer
        let mut render_pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
            label: Some("Rendu de Caractères Terminal"),
            color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                view,
                resolve_target: None,
                ops: wgpu::Operations {
                    load: wgpu::LoadOp::Clear(wgpu::Color { r: 0.05, g: 0.08, b: 0.12, a: 1.0 }),
                    store: wgpu::StoreOp::Store,
                },
            })],
            depth_stencil_attachment: None,
            timestamp_writes: None,
            occlusion_query_set: None,
        });

        render_pass.set_pipeline(&self.render_pipeline);
        render_pass.draw(0..self.num_indices, 0..1);
    }
}
`
    }
  ];

  // 4. Tauri files mapping (dynamic with static fallback)
  const tauriFiles = [
    {
      name: "src-tauri/src/pty.rs",
      key: "pty",
      lang: "rust",
      content: sourceCode?.ptyRs || `// portable-pty thread bridge logic...`
    },
    {
      name: "src-tauri/src/main.rs",
      key: "main",
      lang: "rust",
      content: sourceCode?.mainRs || `// tauri command dispatcher...`
    },
    {
      name: "Cargo.toml",
      key: "cargo",
      lang: "toml",
      content: sourceCode?.cargoToml || `[dependencies]\nportable-pty = "0.8"\ntauri = "1.5"`
    },
    {
      name: "tauri.conf.json",
      key: "conf",
      lang: "json",
      content: sourceCode?.tauriConfJson || `{ "tauri": {} }`
    }
  ];

  const architectures: ArchDef[] = [
    {
      id: "tauri",
      name: "Tauri + Rust (portable-pty)",
      badge: "Actuel & Recommandé Desktop",
      icon: Box,
      color: "from-amber-500/20 via-amber-500/10 to-transparent",
      borderColor: "border-amber-500/30",
      textColor: "text-amber-400",
      bgColor: "bg-amber-500",
      description: "L'architecture native moderne la plus légère et sécurisée pour les applications de bureau. Elle encapsule le moteur Webview natif du système pour l'interface utilisateur, tout en déléguant la gestion bas-niveau de la PTY asynchrone à des threads légers écrits en Rust.",
      metrics: {
        memory: "< 30 Mo",
        bundleSize: "4 Mo - 8 Mo",
        speed: "Natif / Rust asynchrone (Ultra rapide)",
        security: "Maximale (Sandboxed IPC, communications typées strictes)",
        flexibility: "Haute (Backend Rust extensible à l'infini, frontend HTML5)"
      },
      pros: [
        "Consommation mémoire insignifiante par rapport à Chromium",
        "Taille de binaire minuscule facilitant le déploiement",
        "Sécurité absolue via l'isolation de mémoire Rust",
        "Aucun processus Node.js lourd en arrière-plan"
      ],
      cons: [
        "Courbe d'apprentissage exigeante concernant la gestion mémoire Rust",
        "Nécessite d'installer la chaîne d'outils Rust lors de la compilation"
      ],
      pipeline: [
        { step: "1. Saisie Clavier", desc: "La saisie utilisateur est interceptée par xterm.js." },
        { step: "2. Tauri Commands IPC", desc: "La commande 'write_terminal' est invoquée de manière asynchrone." },
        { step: "3. Thread Rust portable-pty", desc: "Le backend Rust écrit instantanément les octets reçus dans le descripteur de fichier d'écriture du shell." },
        { step: "4. Exécution Shell", desc: "Le processus de shell (/bin/bash ou /bin/zsh) traite la commande et génère la sortie standard." },
        { step: "5. Thread Lecteur asynchrone", desc: "Un thread Rust en arrière-plan lit continuellement le flux stdout de la PTY de manière non-bloquante." },
        { step: "6. Tauri Event Bridge & WebGL", desc: "La sortie est envoyée via un évènement global 'pty-data' vers le frontend qui l'affiche à 60 FPS via WebGL." }
      ],
      files: tauriFiles,
    },
    {
      id: "electron",
      name: "Electron + node-pty",
      badge: "Standard de l'industrie (VSCode / Hyper)",
      icon: Layers,
      color: "from-blue-500/20 via-blue-500/10 to-transparent",
      borderColor: "border-blue-500/30",
      textColor: "text-blue-400",
      bgColor: "bg-blue-500",
      description: "L'approche classique basée sur le couplage de Chromium et de Node.js. L'écriture d'un tel outil s'effectue via 'node-pty', un module natif Node.js compilé en C++ s'interfaçant directement avec les appels système POSIX forkpty / openpty.",
      metrics: {
        memory: "150 Mo - 350 Mo",
        bundleSize: "80 Mo - 130 Mo",
        speed: "Excellente (Liaison native C++)",
        security: "Moyenne (Besoin d'un preload script rigoureux pour isoler l'IPC)",
        flexibility: "Maximale (Écosystème JS complet, intégration Node native)"
      },
      pros: [
        "Écosystème JavaScript mature et des milliers de packages",
        "Rendu pixel-perfect cohérent grâce à Chromium intégré",
        "node-pty extrêmement stable et gérant tous les cas d'usages",
        "Facile d'intégrer des modules binaires natifs pré-compilés"
      ],
      cons: [
        "Empreinte RAM excessive due à la duplication du moteur de rendu Chromium",
        "Taille d'installateur finale gigantesque (minimum 80Mo pour un Hello World)"
      ],
      pipeline: [
        { step: "1. Saisie Utilisateur", desc: "Saisie interceptée par xterm.js dans le Renderer Process." },
        { step: "2. Electron IPC Channel", desc: "Données transmises via 'ipcRenderer.send' à travers le pont de preload sécurisé." },
        { step: "3. Processus Principal Node.js", desc: "L'évènement de message est reçu dans 'main.js'." },
        { step: "4. node-pty Binding", desc: "Écriture directe du flux via les bindings C++ natifs intégrés de 'node-pty'." },
        { step: "5. Capture de flux asynchrone", desc: "L'instance d'événement 'onData' de node-pty écoute en continu et renvoie la sortie." },
        { step: "6. Reroutage & xterm.js", desc: "La sortie est re-transmise vers le Renderer Process et injectée dans le terminal." }
      ],
      files: electronFiles,
    },
    {
      id: "web",
      name: "Web Terminal + Passerelle WebSocket",
      badge: "Cloud / SaaS / Remote Administration",
      icon: Globe,
      color: "from-emerald-500/20 via-emerald-500/10 to-transparent",
      borderColor: "border-emerald-500/30",
      textColor: "text-emerald-400",
      bgColor: "bg-emerald-500",
      description: "Architecture de terminaux distants. Le client n'installe rien, il affiche xterm.js dans son navigateur standard. La connexion s'établit via une passerelle de communication en temps réel (WebSockets) vers un serveur d'orchestration (Express, Go ou SSH).",
      metrics: {
        memory: "< 15 Mo (Côté Client)",
        bundleSize: "1 Mo - 2 Mo (Code Client)",
        speed: "Variable (Fortement dépendante de la latence du réseau)",
        security: "Moyenne (Nécessite une isolation complète des conteneurs par utilisateur)",
        flexibility: "Excellente (S'exécute sur mobile, tablette et vieux OS)"
      },
      pros: [
        "Zéro installation requise sur la machine de l'utilisateur final",
        "Idéal pour l'hébergement de conteneurs de développement et de VPS cloud",
        "Mises à jour instantanées de l'application de manière transparente",
        "Possibilité de surveiller, partager ou enregistrer les sessions à distance"
      ],
      cons: [
        "Latence d'entrée (input lag) ressentie sur les réseaux à haut ping",
        "Nécessite une infrastructure serveur robuste et sécurisée (Docker / Sandbox)"
      ],
      pipeline: [
        { step: "1. Événement local", desc: "La frappe clavier est capturée par le navigateur web." },
        { step: "2. WebSocket Frame", desc: "Données converties en trame binaire / texte et envoyées via WebSocket sécurisé (WSS)." },
        { step: "3. Passerelle de Serveur", desc: "Le serveur d'API (Express/node-pty) reçoit le flux binaire de la WebSocket." },
        { step: "4. Écriture PTY", desc: "Les données sont injectées dans le terminal virtuel instancié sur le serveur." },
        { step: "5. Lecture Stream Serveur", desc: "Le serveur lit le flux de sortie, applique les buffers de performance." },
        { step: "6. WebSocket Reply", desc: "Le flux retour est réémis au client et xterm.js applique le rendu ANSI." }
      ],
      files: webFiles,
    },
    {
      id: "alacritty",
      name: "Native GPU Terminal (Alacritty Style)",
      badge: "Performance Brute",
      icon: Cpu,
      color: "from-purple-500/20 via-purple-500/10 to-transparent",
      borderColor: "border-purple-500/30",
      textColor: "text-purple-400",
      bgColor: "bg-purple-500",
      description: "L'architecture native sans aucune surcouche Web ni DOM. Écrit entièrement en Rust, Alacritty utilise directement les API graphiques de bas niveau (OpenGL, Vulkan ou Wgpu) pour restituer les caractères textuels sous forme de textures vectorielles directement dans la carte graphique.",
      metrics: {
        memory: "10 Mo - 20 Mo",
        bundleSize: "2 Mo - 4 Mo",
        speed: "Imbattable (Fréquence de rafraîchissement illimitée, GPU asynchrone)",
        security: "Maximale (Sandboxing OS, pas de moteur JS)",
        flexibility: "Basse (Limité à l'affichage terminal standard, pas d'extensions HTML)"
      },
      pros: [
        "Rendu d'une fluidité extrême, latence imperceptible",
        "Aucune dépendance web (pas de Chromium, pas d'HTML/CSS)",
        "Parfaite intégration avec les raccourcis d'OS complexes",
        "Consommation énergétique de batterie ultra-faible"
      ],
      cons: [
        "Personnalisation visuelle complexe limitée aux configs textuelles",
        "Impossible d'afficher des images complexes ou des composants web riches interactifs"
      ],
      pipeline: [
        { step: "1. Hardware Keypress", desc: "L'événement clavier physique de l'OS est intercepté via la bibliothèque 'winit'." },
        { step: "2. POSIX write", desc: "Appel système natif direct pour écrire l'octet dans le master de la PTY OS." },
        { step: "3. OS Kernel PTY", desc: "Le noyau Linux écrit dans l'entrée standard du processus bash associé." },
        { step: "4. Capture Native & Parse", desc: "Le flux de retour est lu et traité par un parseur ANSI extrêmement véloce (vte parser)." },
        { step: "5. Font Rasterization", desc: "Les glyphes de texte requis sont dessinés et mis en cache comme des textures." },
        { step: "6. GPU Rendering Pipeline", desc: "Les textures sont envoyées à la carte graphique qui rafraîchit l'écran instantanément." }
      ],
      files: alacrittyFiles,
    }
  ];

  const currentArch = architectures.find((a) => a.id === activeArch) || architectures[0];
  const activeTab = activeTabMap[activeArch] || currentArch.files[0].key;

  const getActiveCode = () => {
    const file = currentArch.files.find((f) => f.key === activeTab);
    return file ? file.content : "// Fichier non trouvé";
  };

  const getActiveLanguage = () => {
    const file = currentArch.files.find((f) => f.key === activeTab);
    return file ? file.lang : "plaintext";
  };

  const handleCopy = async () => {
    const code = getActiveCode();
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const updateActiveTab = (key: string) => {
    setActiveTabMap({
      ...activeTabMap,
      [activeArch]: key,
    });
  };

  // --- Dynamic Recommendation Calculation ---
  const getRecommendationScores = () => {
    const scores = {
      tauri: 50,
      electron: 50,
      web: 50,
      alacritty: 50,
    };

    // Platform constraint
    if (platform === "desktop") {
      scores.tauri += 30;
      scores.alacritty += 25;
      scores.electron += 20;
      scores.web -= 10;
    } else if (platform === "web") {
      scores.web += 40;
      scores.tauri -= 30;
      scores.alacritty -= 40;
      scores.electron -= 30;
    } else if (platform === "multi") {
      scores.electron += 30;
      scores.web += 25;
      scores.tauri += 10;
      scores.alacritty -= 20;
    }

    // RAM Constraint
    if (ramBudget < 40) {
      scores.alacritty += 30;
      scores.tauri += 25;
      scores.web += 15; // thin client
      scores.electron -= 40;
    } else if (ramBudget < 150) {
      scores.tauri += 20;
      scores.alacritty += 15;
      scores.web += 10;
      scores.electron -= 10;
    } else {
      scores.electron += 30;
      scores.tauri += 10;
    }

    // Rust experience
    if (rustExp === "yes") {
      scores.tauri += 20;
      scores.alacritty += 20;
    } else {
      scores.tauri -= 15;
      scores.alacritty -= 25;
      scores.electron += 25;
      scores.web += 20;
    }

    // Primary Focus
    if (focusArea === "speed") {
      scores.alacritty += 35;
      scores.tauri += 20;
      scores.electron += 5;
    } else if (focusArea === "security") {
      scores.tauri += 30;
      scores.alacritty += 15;
      scores.web -= 10;
      scores.electron -= 20;
    } else if (focusArea === "ecosystem") {
      scores.electron += 35;
      scores.web += 15;
      scores.tauri += 5;
    } else if (focusArea === "remote") {
      scores.web += 40;
      scores.tauri -= 20;
      scores.alacritty -= 30;
    }

    // Clip between 10 and 100
    const keys = Object.keys(scores) as (keyof typeof scores)[];
    keys.forEach((key) => {
      scores[key] = Math.max(15, Math.min(98, scores[key]));
    });

    return scores;
  };

  const scores = getRecommendationScores();
  const sortedRecommendations = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const bestArchId = sortedRecommendations[0][0];

  // --- Run Benchmark Simulator ---
  const runBenchmark = () => {
    setIsBenchmarking(true);
    setBenchProgress(0);
    setBenchStage("Optimisation des tampons de flux ANSI...");
    
    const interval = setInterval(() => {
      setBenchProgress((prev) => {
        const next = prev + 10;
        if (next === 30) {
          setBenchStage("Génération de 100 000 lignes de texte brut (Stdout)...");
        } else if (next === 60) {
          setBenchStage("Rendu WebGL de glyphes 4K & test de surcharge GPU...");
        } else if (next === 80) {
          setBenchStage("Mesure de latence IPC aller-retour...");
        } else if (next >= 100) {
          clearInterval(interval);
          setIsBenchmarking(false);
          setBenchStage("Benchmark complété avec succès !");
          setBenchResults({
            tauri: { latency: 1.2, fps: 60, cpu: 2.1, ram: 28 },
            electron: { latency: 4.5, fps: 58, cpu: 7.9, ram: 215 },
            web: { latency: 18.3, fps: 42, cpu: 12.4, ram: 14 },
            alacritty: { latency: 0.2, fps: 240, cpu: 0.6, ram: 12 },
          });
          return 100;
        }
        return next;
      });
    }, 250);
  };

  return (
    <div className="flex flex-1 flex-col h-full bg-slate-950 text-slate-200 overflow-y-auto select-none p-6 space-y-6">
      
      {/* Architecture Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 border border-slate-800 rounded-xl p-6 shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shrink-0">
        <div className="flex items-center gap-4">
          <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl shadow-inner">
            <Cpu className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2 flex-wrap">
              Analyse Comparative d'Architectures de Terminaux
              <span className="text-[10px] uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                Spécifications Techniques
              </span>
            </h2>
            <p className="text-sm text-slate-400 mt-1 max-w-2xl">
              Comparez les architectures de terminaux de bureau, de cloud et natifs. Analysez les flux IPC, l'utilisation des ressources, le code source complet et simulez des benchmarks.
            </p>
          </div>
        </div>

        <button
          onClick={handleCopy}
          className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/60 font-semibold text-xs rounded-lg transition-all flex items-center gap-2"
        >
          {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-slate-400" />}
          {copied ? "Code Copié !" : "Copier ce fichier de code"}
        </button>
      </div>

      {/* Tabs list to select active architecture */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-900/40 p-1.5 rounded-xl border border-slate-800/60">
        {architectures.map((arch) => {
          const Icon = arch.icon;
          const isSelected = activeArch === arch.id;
          return (
            <button
              key={arch.id}
              onClick={() => setActiveArch(arch.id)}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition-all ${
                isSelected
                  ? `bg-slate-900/90 ${arch.borderColor} shadow-lg text-slate-100`
                  : "bg-transparent border-transparent hover:bg-slate-900/30 text-slate-400 hover:text-slate-200"
              }`}
            >
              <div className={`p-1.5 rounded-md ${isSelected ? `${arch.bgColor}/10 ${arch.textColor}` : "bg-slate-800 text-slate-400"}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="truncate">
                <div className="font-semibold text-xs leading-none">{arch.name}</div>
                <div className="text-[9px] text-slate-500 mt-1 truncate">{arch.badge}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Grid of Main Content for the selected architecture */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left column: Overview, trade-offs and metrics */}
        <div className="xl:col-span-1 space-y-6 flex flex-col justify-between">
          <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-xl space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase font-extrabold tracking-widest text-slate-500">PROFIL</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 border ${currentArch.borderColor} ${currentArch.textColor}`}>
                {currentArch.badge}
              </span>
            </div>

            <h3 className="text-base font-bold text-slate-200 flex items-center gap-2">
              <span className={currentArch.textColor}>
                {React.createElement(currentArch.icon, { className: "w-5 h-5" })}
              </span>
              {currentArch.name}
            </h3>

            <p className="text-xs leading-relaxed text-slate-400">
              {currentArch.description}
            </p>

            <div className="border-t border-slate-800/60 pt-4 space-y-2">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">MÉTRIQUES DU RUNTIME</span>
              
              <div className="grid grid-cols-2 gap-3 text-xs pt-1">
                <div className="p-2.5 bg-slate-950/40 border border-slate-800/40 rounded-lg">
                  <span className="text-[10px] text-slate-500 block">Mémoire vive (RAM)</span>
                  <span className="font-mono font-bold text-slate-200">{currentArch.metrics.memory}</span>
                </div>
                <div className="p-2.5 bg-slate-950/40 border border-slate-800/40 rounded-lg">
                  <span className="text-[10px] text-slate-500 block">Taille du binaire</span>
                  <span className="font-mono font-bold text-slate-200">{currentArch.metrics.bundleSize}</span>
                </div>
              </div>

              <div className="space-y-2 text-xs pt-2">
                <div className="flex justify-between items-center py-1 border-b border-slate-800/40">
                  <span className="text-slate-400">Vitesse de rendu :</span>
                  <span className="font-semibold text-slate-200">{currentArch.metrics.speed}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-800/40">
                  <span className="text-slate-400">Niveau de sécurité :</span>
                  <span className="font-semibold text-slate-200">{currentArch.metrics.security}</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-400">Flexibilité UI :</span>
                  <span className="font-semibold text-slate-200">{currentArch.metrics.flexibility}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {/* Pros card */}
            <div className="bg-emerald-500/5 border border-emerald-500/10 p-4 rounded-xl space-y-2">
              <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider block">AVANTAGES / BÉNÉFICES</span>
              <ul className="text-xs text-slate-300 space-y-1.5 list-disc pl-4">
                {currentArch.pros.map((pro, idx) => (
                  <li key={idx}>{pro}</li>
                ))}
              </ul>
            </div>

            {/* Cons card */}
            <div className="bg-red-500/5 border border-red-500/10 p-4 rounded-xl space-y-2">
              <span className="text-[10px] uppercase font-bold text-red-400 tracking-wider block">INCONVÉNIENTS / CONTRAINTES</span>
              <ul className="text-xs text-slate-300 space-y-1.5 list-disc pl-4">
                {currentArch.cons.map((con, idx) => (
                  <li key={idx}>{con}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Right column: Pipelines and flow diagram */}
        <div className="xl:col-span-2 bg-slate-900/60 border border-slate-800 p-5 rounded-xl flex flex-col justify-between">
          <div className="space-y-4">
            <span className="text-xs uppercase font-extrabold tracking-widest text-slate-500 block">PIPELINE DE COMMUNICATION PTY</span>
            <p className="text-xs text-slate-400">
              Voici le parcours complet des données de la saisie utilisateur jusqu'à l'affichage sur la grille :
            </p>

            {/* Visual Steps representation */}
            <div className="space-y-3 pt-2">
              {currentArch.pipeline.map((step, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 p-3 bg-slate-950/40 hover:bg-slate-950/70 border border-slate-800/40 rounded-xl transition-all"
                >
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-800 border border-slate-700 text-[10px] font-mono font-bold flex items-center justify-center text-slate-300">
                    {idx + 1}
                  </div>
                  <div className="space-y-1">
                    <h4 className={`text-xs font-bold ${currentArch.textColor}`}>{step.step}</h4>
                    <p className="text-[11px] leading-relaxed text-slate-400">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-slate-950/60 border border-slate-800/40 p-4 rounded-xl mt-4 flex items-center gap-3">
            <Award className={`w-5 h-5 flex-shrink-0 ${currentArch.textColor}`} />
            <p className="text-[11px] text-slate-400 leading-normal">
              <span className="font-bold text-slate-300">Verdict d'utilisation : </span>
              {currentArch.id === "tauri" && "Idéal pour une intégration moderne à faible latence dans un environnement de bureau sécurisé léger."}
              {currentArch.id === "electron" && "Parfait pour des équipes centrées sur le JavaScript pur et la portabilité Web complète sans contrainte mémoire."}
              {currentArch.id === "web" && "Indispensable pour l'administration de serveurs cloud à distance ou d'instances SaaS d'éducation."}
              {currentArch.id === "alacritty" && "Réservé aux terminaux autonomes hautement véloces sans aucune dépendance graphique web."}
            </p>
          </div>
        </div>
      </div>

      {/* NEW SECTION 1: Interactiv Architect Recommendation Tool */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-6">
        <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
          <Sparkles className="w-5 h-5 text-indigo-400" />
          <div>
            <h3 className="text-base font-bold text-slate-100">Estimateur & Aide au Choix d'Architecture</h3>
            <p className="text-xs text-slate-400">Configurez vos contraintes et découvrez l'architecture qui s'adapte le mieux à votre projet.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Controls */}
          <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            
            {/* Target Platform */}
            <div className="bg-slate-950/40 p-4 border border-slate-800/60 rounded-xl space-y-3">
              <span className="font-bold text-slate-300 block">Plateforme Cible</span>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "desktop", label: "Desktop" },
                  { id: "web", label: "Web / SaaS" },
                  { id: "multi", label: "Multi-arch" }
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setPlatform(item.id as any)}
                    className={`p-2.5 rounded-lg border font-semibold text-center transition-all ${
                      platform === item.id
                        ? "bg-indigo-500/10 border-indigo-500/50 text-indigo-300"
                        : "bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-400"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* RAM Budget */}
            <div className="bg-slate-950/40 p-4 border border-slate-800/60 rounded-xl space-y-3">
              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-300">Budget Mémoire RAM maximum</span>
                <span className="font-mono text-indigo-400 font-bold">{ramBudget} Mo</span>
              </div>
              <input
                type="range"
                min="10"
                max="400"
                step="10"
                value={ramBudget}
                onChange={(e) => setRamBudget(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>10 Mo (Super léger)</span>
                <span>400 Mo (Aucune limite)</span>
              </div>
            </div>

            {/* Rust Experience */}
            <div className="bg-slate-950/40 p-4 border border-slate-800/60 rounded-xl space-y-3">
              <span className="font-bold text-slate-300 block">Maîtrise de la chaîne d'outils Rust</span>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: "yes", label: "Maîtrisé (Rust/C++)" },
                  { id: "no", label: "JavaScript uniquement" }
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setRustExp(item.id as any)}
                    className={`p-2.5 rounded-lg border font-semibold text-center transition-all ${
                      rustExp === item.id
                        ? "bg-indigo-500/10 border-indigo-500/50 text-indigo-300"
                        : "bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-400"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Primary Focus */}
            <div className="bg-slate-950/40 p-4 border border-slate-800/60 rounded-xl space-y-3">
              <span className="font-bold text-slate-300 block">Priorité Absolue du Projet</span>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: "speed", label: "Performance & FPS" },
                  { id: "security", label: "Sécurité & Sandboxing" },
                  { id: "ecosystem", label: "Vitesse d'écriture" },
                  { id: "remote", label: "Accès cloud distant" }
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setFocusArea(item.id as any)}
                    className={`p-2.5 rounded-lg border font-semibold text-center transition-all ${
                      focusArea === item.id
                        ? "bg-indigo-500/10 border-indigo-500/50 text-indigo-300"
                        : "bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-400"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

          </div>

          {/* Results Side Panel */}
          <div className="bg-slate-950/60 border border-slate-800/80 p-5 rounded-xl flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500 block">COMPATIBILITÉ CALCULÉE</span>
              <div className="space-y-3">
                {sortedRecommendations.map(([id, score]) => {
                  const arch = architectures.find((a) => a.id === id);
                  if (!arch) return null;
                  const isBest = bestArchId === id;
                  return (
                    <div key={id} className="space-y-1">
                      <div className="flex justify-between items-center text-xs">
                        <span className={`font-semibold ${isBest ? "text-indigo-400 font-bold" : "text-slate-400"}`}>
                          {arch.name}
                        </span>
                        <span className="font-mono font-bold text-slate-300">{score}%</span>
                      </div>
                      <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden border border-slate-800/40">
                        <div
                          className={`h-full rounded-full ${isBest ? "bg-indigo-500" : "bg-slate-700"}`}
                          style={{ width: `${score}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="p-3 bg-indigo-500/5 border border-indigo-500/15 rounded-lg flex items-start gap-2.5">
              <CheckCircle className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-slate-400 leading-normal">
                <span className="font-bold text-slate-300">Recommandation : </span>
                {bestArchId === "tauri" && "Tauri est parfait ! Vous réduisez drastiquement la consommation mémoire tout en codant votre interface en HTML/TS."}
                {bestArchId === "electron" && "Electron est conseillé. Pas besoin de compiler en Rust, vous profitez de l'écosystème Node de manière simplifiée."}
                {bestArchId === "web" && "Le Web Terminal est indiqué car vous privilégiez un accès multi-utilisateurs distant sans binaire local."}
                {bestArchId === "alacritty" && "Alacritty Native est la voie royale pour un terminal surpuissant sans aucune surcharge de navigateur."}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* NEW SECTION 2: Visual Performance Benchmark Simulator */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <Gauge className="w-5 h-5 text-amber-500" />
            <div>
              <h3 className="text-base font-bold text-slate-100">Simulateur de Benchmark de Performance</h3>
              <p className="text-xs text-slate-400">Mesurez l'impact des différentes couches logicielles sur le traitement du terminal.</p>
            </div>
          </div>

          <button
            onClick={runBenchmark}
            disabled={isBenchmarking}
            className="px-4 py-2 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 disabled:from-slate-800 disabled:to-slate-800 text-slate-950 font-bold text-xs rounded-lg transition-all shadow-md flex items-center gap-2"
          >
            {isBenchmarking ? (
              <span className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-slate-950 border-t-transparent" />
            ) : (
              <Sparkles className="w-4 h-4 text-slate-950" />
            )}
            {isBenchmarking ? "Calcul..." : "Lancer le Benchmark"}
          </button>
        </div>

        {isBenchmarking && (
          <div className="bg-slate-950/40 p-4 border border-slate-800/60 rounded-xl space-y-2 animate-pulse">
            <div className="flex justify-between items-center text-xs">
              <span className="font-mono text-amber-400 font-bold">{benchStage}</span>
              <span className="font-mono text-slate-400">{benchProgress}%</span>
            </div>
            <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-800">
              <div className="h-full bg-amber-500 rounded-full transition-all duration-300" style={{ width: `${benchProgress}%` }} />
            </div>
          </div>
        )}

        {/* Results layout */}
        {(!isBenchmarking && benchResults) && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {(Object.entries(benchResults) as [string, { latency: number; fps: number; cpu: number; ram: number }][]).map(([id, stats]) => {
              const arch = architectures.find((a) => a.id === id);
              if (!arch) return null;
              return (
                <div key={id} className="bg-slate-950/40 border border-slate-800/80 p-4 rounded-xl space-y-4">
                  <div className="flex items-center gap-2 border-b border-slate-800/40 pb-2">
                    <span className={arch.textColor}>
                      {React.createElement(arch.icon, { className: "w-4 h-4" })}
                    </span>
                    <span className="text-xs font-bold text-slate-300">{arch.name}</span>
                  </div>

                  <div className="space-y-3 text-xs">
                    {/* Latency */}
                    <div>
                      <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                        <span>Latence d'entrée (clavier)</span>
                        <span className="font-mono font-bold text-slate-300">{stats.latency} ms</span>
                      </div>
                      <div className="w-full bg-slate-900 h-1 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500"
                          style={{ width: `${Math.max(5, 100 - stats.latency * 4)}%` }}
                        />
                      </div>
                    </div>

                    {/* FPS */}
                    <div>
                      <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                        <span>Rafraîchissement Max</span>
                        <span className="font-mono font-bold text-slate-300">{stats.fps} FPS</span>
                      </div>
                      <div className="w-full bg-slate-900 h-1 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-amber-500"
                          style={{ width: `${Math.min(100, (stats.fps / 240) * 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* CPU */}
                    <div>
                      <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                        <span>Charge CPU moyenne</span>
                        <span className="font-mono font-bold text-slate-300">{stats.cpu}%</span>
                      </div>
                      <div className="w-full bg-slate-900 h-1 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-sky-500"
                          style={{ width: `${Math.max(5, stats.cpu * 8)}%` }}
                        />
                      </div>
                    </div>

                    {/* RAM */}
                    <div>
                      <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                        <span>RAM Consommée</span>
                        <span className="font-mono font-bold text-slate-300">{stats.ram} Mo</span>
                      </div>
                      <div className="w-full bg-slate-900 h-1 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-500"
                          style={{ width: `${Math.min(100, (stats.ram / 250) * 100)}%` }}
                        />
                      </div>
                    </div>

                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!benchResults && !isBenchmarking && (
          <div className="bg-slate-950/40 p-6 border border-slate-800/40 rounded-xl text-center">
            <p className="text-xs text-slate-400">
              Cliquez sur le bouton "Lancer le Benchmark" pour simuler une mesure de performance interactive.
            </p>
          </div>
        )}
      </div>

      {/* NEW SECTION 3: Threat Modeling & Security Hardening Matrix */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-4">
        <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
          <Shield className="w-5 h-5 text-red-400" />
          <div>
            <h3 className="text-base font-bold text-slate-100">Modélisation des Menaces & Sécurisation (Threat Modeling)</h3>
            <p className="text-xs text-slate-400">Vérifiez les vulnérabilités structurelles associées à chaque type d'exécution et leurs correctifs.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          
          <div className="bg-slate-950/40 border border-slate-800/60 p-4 rounded-xl space-y-3">
            <span className="font-bold text-amber-400 block flex items-center gap-1.5">
              <Fingerprint className="w-4 h-4 text-amber-400" />
              Isolation IPC (Tauri)
            </span>
            <p className="text-slate-400 leading-normal text-[11px]">
              Tauri empêche l'injection de scripts malveillants via des IPC fortement typés définis statiquement en Rust.
            </p>
            <div className="pt-2 border-t border-slate-800/40">
              <span className="text-[10px] text-slate-500 uppercase font-bold block mb-1">Mesure de Hardening :</span>
              <span className="text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded text-[10px] border border-emerald-500/25 block text-center font-semibold">
                Désactivation de fs en UI
              </span>
            </div>
          </div>

          <div className="bg-slate-950/40 border border-slate-800/60 p-4 rounded-xl space-y-3">
            <span className="font-bold text-blue-400 block flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-blue-400" />
              Preload isolation (Electron)
            </span>
            <p className="text-slate-400 leading-normal text-[11px]">
              Electron exige une isolation de contexte stricte pour éviter que du JavaScript malveillant accède au runtime Node de l'hôte.
            </p>
            <div className="pt-2 border-t border-slate-800/40">
              <span className="text-[10px] text-slate-500 uppercase font-bold block mb-1">Mesure de Hardening :</span>
              <span className="text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded text-[10px] border border-emerald-500/25 block text-center font-semibold">
                contextIsolation: true
              </span>
            </div>
          </div>

          <div className="bg-slate-950/40 border border-slate-800/60 p-4 rounded-xl space-y-3">
            <span className="font-bold text-emerald-400 block flex items-center gap-1.5">
              <Globe className="w-4 h-4 text-emerald-400" />
              Conteneurisation (Web)
            </span>
            <p className="text-slate-400 leading-normal text-[11px]">
              Lancer un terminal sur le web requiert d'isoler l'utilisateur dans un conteneur temporaire de type Docker à privilège réduit.
            </p>
            <div className="pt-2 border-t border-slate-800/40">
              <span className="text-[10px] text-slate-500 uppercase font-bold block mb-1">Mesure de Hardening :</span>
              <span className="text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded text-[10px] border border-emerald-500/25 block text-center font-semibold">
                Docker gVisor Sandbox
              </span>
            </div>
          </div>

          <div className="bg-slate-950/40 border border-slate-800/60 p-4 rounded-xl space-y-3">
            <span className="font-bold text-purple-400 block flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-purple-400" />
              Injection d'échappement (GPU)
            </span>
            <p className="text-slate-400 leading-normal text-[11px]">
              Les terminaux natifs doivent blinder les séquences d'échappement ANSI pour éviter des crashs de pilotes de cartes graphiques.
            </p>
            <div className="pt-2 border-t border-slate-800/40">
              <span className="text-[10px] text-slate-500 uppercase font-bold block mb-1">Mesure de Hardening :</span>
              <span className="text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded text-[10px] border border-emerald-500/25 block text-center font-semibold">
                VTE parser Strict Validation
              </span>
            </div>
          </div>

        </div>
      </div>

      {/* Code Viewer Panel */}
      <div className="flex-1 min-h-[380px] bg-slate-900 border border-slate-800 rounded-xl flex flex-col overflow-hidden shadow-2xl">
        {/* File Tabs */}
        <div className="flex items-center justify-between bg-slate-950 px-4 py-2 border-b border-slate-800 text-xs shrink-0">
          <div className="flex items-center gap-1 font-mono flex-wrap">
            {currentArch.files.map((file) => (
              <button
                key={file.key}
                onClick={() => updateActiveTab(file.key)}
                className={`px-3 py-1.5 rounded-t-md font-medium transition-colors ${
                  activeTab === file.key
                    ? `bg-slate-900 ${currentArch.textColor} border-t border-x border-slate-800 font-bold`
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {file.name}
              </button>
            ))}
          </div>
          <span className="text-[10px] text-slate-500 font-mono hidden md:inline">
            Aperçu Source - {getActiveLanguage()}
          </span>
        </div>

        {/* Monaco Editor displaying Rust/JS/Toml/JSON code */}
        <div className="flex-1 w-full relative min-h-[300px]">
          <Editor
            height="100%"
            language={getActiveLanguage()}
            theme="vs-dark"
            value={getActiveCode()}
            options={{
              readOnly: true,
              fontSize: 13,
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              minimap: { enabled: true },
              scrollBeyondLastLine: false,
              automaticLayout: true,
            }}
          />
        </div>
      </div>
    </div>
  );
};
