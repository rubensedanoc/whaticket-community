import { Request, Response, NextFunction } from "express";
import { IMPERSONATION_CONFIG } from "../config/impersonation";

// Rate limiter simple sin dependencias externas
// Almacena intentos de impersonación por usuario
const impersonationAttempts: Map<string, number[]> = new Map();

export const impersonationRateLimiter = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Solo aplicar rate limit si hay impersonatedUserId
  if (!req.query.impersonatedUserId) {
    return next();
  }

  const userId = req.user?.id?.toString() || "anonymous";
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minuto

  // Obtener intentos del usuario
  const userAttempts = impersonationAttempts.get(userId) || [];
  
  // Filtrar solo intentos dentro de la ventana de tiempo
  const recentAttempts = userAttempts.filter(time => now - time < windowMs);
  
  // Verificar si excede el límite
  if (recentAttempts.length >= IMPERSONATION_CONFIG.maxRequestsPerMinute) {
    res.status(429).json({
      error: "Demasiadas solicitudes de impersonación. Intenta más tarde.",
    });
    return;
  }
  
  // Agregar intento actual
  recentAttempts.push(now);
  impersonationAttempts.set(userId, recentAttempts);
  
  next();
};

// Logger de auditoría para impersonaciones
export const logImpersonation = (
  requestingUserId: number,
  targetUserId: number,
  action: "START" | "END",
  viewSource?: string
): void => {
  if (IMPERSONATION_CONFIG.logAllImpersonations) {
    console.log(`[IMPERSONATION] ${action}`, {
      timestamp: new Date().toISOString(),
      requestingUserId,
      targetUserId,
      viewSource,
    });
  }
};
