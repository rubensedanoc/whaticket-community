import ChatbotMessage from "../../models/ChatbotMessage";

// IDs reservados para opciones de navegación virtual
export const NAV_BACK_ID = "nav_back";
export const NAV_HOME_ID = "nav_home";

interface InteractiveListRow {
  id: string;
  title: string;
  description?: string;
  label?: string;
}

/**
 * Determina si el nodo actual NO es el menú raíz,
 * es decir, si el usuario está dentro de un submenú.
 */
const isInsideSubmenu = (
  chatbotMessageLastStep: string | null,
  chatbotMessageIdentifier: string
): boolean => {
  return !!chatbotMessageLastStep && chatbotMessageLastStep !== chatbotMessageIdentifier;
};

/**
 * Agrega opciones de navegación ("Volver" y/o "Menú principal")
 * al array de rows existente, solo cuando el usuario está en un submenú.
 *
 * - Si el nodo actual es hijo directo del raíz: solo agrega "Menú principal"
 *   (porque "Volver" llevaría al mismo lugar).
 * - Si el nodo actual es nieto o más profundo: agrega ambas.
 */
export const appendNavigationRows = async (
  rows: InteractiveListRow[],
  currentNode: ChatbotMessage,
  chatbotMessageLastStep: string | null,
  chatbotMessageIdentifier: string
): Promise<InteractiveListRow[]> => {
  if (!isInsideSubmenu(chatbotMessageLastStep, chatbotMessageIdentifier)) {
    return rows;
  }

  // Si las opciones son terminales (no tienen subopciones), no agregar navegación
  const optionsAreTerminal = currentNode.chatbotOptions?.every(opt => !opt.hasSubOptions);
  if (optionsAreTerminal) {
    return rows;
  }

  // Verificar si el padre del nodo actual es el raíz
  const parentIsRoot = !currentNode.fatherChatbotOptionId
    ? true
    : await isParentTheRoot(currentNode.fatherChatbotOptionId, chatbotMessageIdentifier);

  if (parentIsRoot) {
    // Solo "Menú principal" (Volver sería redundante)
    rows.push({
      id: NAV_HOME_ID,
      title: "🏠Menú principal",
      label: NAV_HOME_ID
    });
  } else {
    // Ambas opciones
    rows.push({
      id: NAV_BACK_ID,
      title: "↩️ Volver",
      description: "Regresar al menú anterior",
      label: NAV_BACK_ID
    });
    rows.push({
      id: NAV_HOME_ID,
      title: "🏠 Menú principal",
      label: NAV_HOME_ID
    });
  }

  return rows;
};

/**
 * Verifica si el padre (por ID) es el nodo raíz del chatbot.
 */
const isParentTheRoot = async (
  fatherChatbotOptionId: number,
  rootIdentifier: string
): Promise<boolean> => {
  const parent = await ChatbotMessage.findByPk(fatherChatbotOptionId, {
    attributes: ["identifier"]
  });
  return !!parent && parent.identifier === rootIdentifier;
};

/**
 * Dado un nodo actual y una acción de navegación, resuelve el nodo destino
 * y retorna el nuevo valor de chatbotMessageLastStep.
 *
 * Retorna null si no se puede resolver (nodo no encontrado).
 */
export const resolveNavigationTarget = async (
  action: "back" | "home",
  currentIdentifier: string,
  rootIdentifier: string
): Promise<{ targetNode: ChatbotMessage; newLastStep: string | null } | null> => {
  if (action === "home") {
    const rootNode = await findChatbotMessageWithOptions(rootIdentifier, "identifier");
    if (!rootNode) return null;
    return { targetNode: rootNode, newLastStep: null };
  }

  // action === "back"
  const currentNode = await ChatbotMessage.findOne({
    where: { identifier: currentIdentifier },
    attributes: ["id", "identifier", "fatherChatbotOptionId"]
  });

  if (!currentNode || !currentNode.fatherChatbotOptionId) {
    // Ya está en el raíz o no tiene padre → ir al raíz
    const rootNode = await findChatbotMessageWithOptions(rootIdentifier, "identifier");
    if (!rootNode) return null;
    return { targetNode: rootNode, newLastStep: null };
  }

  const parentNode = await findChatbotMessageWithOptions(currentNode.fatherChatbotOptionId, "id");
  if (!parentNode) return null;

  const newLastStep = parentNode.identifier === rootIdentifier
    ? null
    : parentNode.identifier;

  return { targetNode: parentNode, newLastStep };
};

const findChatbotMessageWithOptions = async (
  value: string | number,
  field: "identifier" | "id"
): Promise<ChatbotMessage | null> => {
  return await ChatbotMessage.findOne({
    where: { [field]: value },
    include: [
      {
        model: ChatbotMessage,
        as: "chatbotOptions",
        where: { wasDeleted: false },
        required: false,
        separate: true,
        order: [["order", "ASC"]]
      }
    ]
  });
};
