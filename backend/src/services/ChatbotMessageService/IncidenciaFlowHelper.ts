import ChatbotMessage from "../../models/ChatbotMessage";

interface PathNode {
  id: number;
  title: string;
}

/**
 * Sube por la jerarquía desde un nodo dado hasta la raíz
 * y verifica si el nodo raíz tiene `flujoConIncidencia` activado.
 */
export const checkIfRootHasIncidenciaFlow = async (
  chatbotMessageId: number
): Promise<boolean> => {
  let currentId: number | null = chatbotMessageId;

  while (currentId) {
    const node = await ChatbotMessage.findByPk(currentId, {
      attributes: ["id", "fatherChatbotOptionId", "flujoConIncidencia"]
    });

    if (!node) return false;

    // Si no tiene padre, es la raíz
    if (!node.fatherChatbotOptionId) {
      return node.flujoConIncidencia === true;
    }

    currentId = node.fatherChatbotOptionId;
  }

  return false;
};

/**
 * Verifica directamente si un nodo de primer nivel tiene flujoConIncidencia.
 * Se usa cuando ya sabemos que el nodo es hijo directo de la raíz.
 */
export const checkFirstLevelIncidenciaFlow = async (
  chatbotMessageId: number
): Promise<boolean> => {
  const node = await ChatbotMessage.findByPk(chatbotMessageId, {
    attributes: ["id", "flujoConIncidencia", "fatherChatbotOptionId"]
  });

  if (!node) return false;

  // Si es nodo raíz (sin padre), verificar su propio flag
  if (!node.fatherChatbotOptionId) {
    return node.flujoConIncidencia === true;
  }

  // Si tiene padre, buscar el flag en el padre raíz
  return checkIfRootHasIncidenciaFlow(chatbotMessageId);
};

/**
 * Agrega un nodo al JSON array de la ruta de incidencia.
 * Retorna el JSON string actualizado.
 */
export const buildIncidenciaPath = (
  pathJson: string | null,
  node: PathNode
): string => {
  const path: PathNode[] = pathJson ? JSON.parse(pathJson) : [];
  path.push({ id: node.id, title: node.title });
  return JSON.stringify(path);
};

/**
 * Elimina el último nodo del JSON array de la ruta de incidencia.
 * Retorna el JSON string actualizado, o null si queda vacío.
 */
export const popIncidenciaPath = (
  pathJson: string | null
): string | null => {
  if (!pathJson) return null;

  const path: PathNode[] = JSON.parse(pathJson);
  path.pop();

  if (path.length === 0) return null;
  return JSON.stringify(path);
};

/**
 * Convierte el array JSON de ruta a un string concatenado con " > "
 * para el campo incidenciacliente_descripcion de Billing.
 * Ejemplo: "Operativo > Impresion > No imprime ticket"
 */
export const formatIncidenciaDescripcion = (pathJson: string): string => {
  const path: PathNode[] = JSON.parse(pathJson);
  return path
    .map(node => node.title.replace(/^\d+\.\s*/, "").replace(/^[A-Za-z]\.\s*/, "").trim())
    .join(" > ");
};

/**
 * Convierte el array JSON de ruta a un texto descriptivo legible.
 * Ejemplo:
 *   Categoría: Operativo
 *   Subcategoría: Problemas de servicio
 *   Motivo: No tengo conexión a internet
 */
export const formatIncidenciaDetail = (pathJson: string): string => {
  const path: PathNode[] = JSON.parse(pathJson);

  if (path.length === 0) return "";

  const labels = [
    "Categoría",
    "Subcategoría",
    "Motivo",
    "Detalle",
    "Especificación"
  ];

  return path
    .map((node, index) => {
      const label = index < labels.length ? labels[index] : `Nivel ${index + 1}`;
      // Limpiar el título: quitar prefijos numéricos tipo "1. " o "A. "
      const cleanTitle = node.title.replace(/^\d+\.\s*/, "").replace(/^[A-Za-z]\.\s*/, "").trim();
      return `${label}: ${cleanTitle}`;
    })
    .join("\n");
};

/**
 * Determina si un nodo es hoja real (sin subopciones de BD).
 * No cuenta opciones dinámicas de navegación.
 */
export const isRealLeafNode = (node: ChatbotMessage): boolean => {
  if (!node.hasSubOptions) return true;
  if (!node.chatbotOptions || node.chatbotOptions.length === 0) return true;
  return false;
};

/**
 * Resetea todos los campos de incidencia en el ticket a sus valores por defecto.
 */
export const getIncidenciaResetFields = () => ({
  incidenciaFlowActive: false,
  incidenciaStatus: "idle",
  incidenciaPathJson: null,
  incidenciaExternalId: null,
  incidenciaLastAttemptAt: null,
  incidenciaContentionCount: 0,
  incidenciaLastContentionAt: null,
  incidenciaEscalated: false
});

