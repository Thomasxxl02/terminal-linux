import "express";

/**
 * Extension de typage Express : le middleware requireAuth attache
 * l'utilisateur JWT décodé à req.user (évite les `as any` partout).
 */
declare global {
  namespace Express {
    interface Request {
      user?: {
        role: string;
        exp?: number;
        jti?: string;
        username?: string;
      };
    }
  }
}

export {};
