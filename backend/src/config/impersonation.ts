// Configuración de impersonación de usuarios
// Solo usuarios en esta lista pueden ver tickets como si fueran otros usuarios

// ⚠️ TODO: Reemplazar con los IDs reales de los usuarios autorizados
export const ALLOWED_IMPERSONATION_USERS = [
1, //ADMIN  
2, //STEFANy
3, //CRITHIAN
9 //ANGELO
];

// Configuración de seguridad
export const IMPERSONATION_CONFIG = {
  enabled: true,
  maxRequestsPerMinute: 10, // Rate limiting
  logAllImpersonations: true, // Auditoría
  // COMENTADO TEMPORALMENTE - Vista Por Clientes deshabilitada
  // allowedViews: ["grouped"], // Solo en vista grouped
  allowedViews: [] as string[], // Vista grouped deshabilitada temporalmente
};

// Verificar si usuario puede impersonar (debe estar en la lista)
export const canUserImpersonate = (userId: number): boolean => {
  return IMPERSONATION_CONFIG.enabled && 
         ALLOWED_IMPERSONATION_USERS.includes(userId);
};

// Validar si la impersonación es permitida
export const isValidImpersonationRequest = (
  requestingUserId: number,
  targetUserId: number,
  viewSource?: string
): { valid: boolean; reason?: string } => {
  // ⚠️ CRÍTICO: No puede impersonarse a sí mismo
  if (requestingUserId === targetUserId) {
    return { valid: false, reason: "SELF_IMPERSONATION" };
  }
  
  // ⚠️ CRÍTICO: Verificar que está en la lista de autorizados
  // Si NO está en el array, retorna false y el filtro funciona NORMAL
  if (!canUserImpersonate(requestingUserId)) {
    return { valid: false, reason: "NOT_AUTHORIZED" };
  }
  
  // Verificar vista permitida
  if (viewSource && !IMPERSONATION_CONFIG.allowedViews.includes(viewSource)) {
    return { valid: false, reason: "INVALID_VIEW" };
  }
  
  return { valid: true };
};
