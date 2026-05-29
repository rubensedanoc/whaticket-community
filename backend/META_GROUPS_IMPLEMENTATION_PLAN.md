# Plan de Implementación: Grupos de WhatsApp con Meta API

**Fecha:** 24 de Febrero 2026  
**Objetivo:** Implementar soporte completo para grupos de WhatsApp usando Meta Cloud API  
**Prioridad:** Webhooks primero, luego servicios y endpoints

---

## 📋 Índice

1. [Fase 1: Tipos TypeScript para Webhooks](#fase-1-tipos-typescript-para-webhooks)
2. [Fase 2: Manejadores de Webhooks](#fase-2-manejadores-de-webhooks)
3. [Fase 3: Servicios de Backend](#fase-3-servicios-de-backend)
4. [Fase 4: Endpoints de API](#fase-4-endpoints-de-api)
5. [Fase 5: Integración con Sistema Existente](#fase-5-integración-con-sistema-existente)
6. [Dependencias y Orden de Implementación](#dependencias-y-orden-de-implementación)

---

## Fase 1: Tipos TypeScript para Webhooks

**Archivo:** `backend/src/types/meta/MetaGroupWebhookTypes.ts`  
**Dependencias:** Ninguna  
**Commit:** `feat: add Meta API group webhook types`

### 1.1 Tipos Base

```typescript
// Payload principal del webhook de grupos
export interface MetaGroupWebhookPayload {
  object: "whatsapp_business_account";
  entry: MetaGroupWebhookEntry[];
}

export interface MetaGroupWebhookEntry {
  id: string; // WhatsApp Business Account ID
  changes: MetaGroupWebhookChange[];
}

export interface MetaGroupWebhookChange {
  value: MetaGroupWebhookValue;
  field: MetaGroupWebhookField;
}

export type MetaGroupWebhookField = 
  | "group_lifecycle_update"
  | "group_participants_update"
  | "group_settings_update"
  | "group_status_update";

export interface MetaGroupWebhookValue {
  messaging_product: "whatsapp";
  metadata: {
    display_phone_number: string;
    phone_number_id: string;
  };
  groups: MetaGroupEvent[];
}
```

### 1.2 Eventos de Ciclo de Vida (group_lifecycle_update)

```typescript
export type MetaGroupLifecycleType = "group_create" | "group_delete";

export interface MetaGroupLifecycleEvent {
  timestamp: string;
  group_id: string;
  type: MetaGroupLifecycleType;
  request_id?: string;
  
  // Para group_create exitoso
  subject?: string;
  description?: string;
  invite_link?: string;
  join_approval_mode?: "on" | "off";
  
  // Para errores
  errors?: MetaGroupError[];
}
```

### 1.3 Eventos de Participantes (group_participants_update)

```typescript
export type MetaGroupParticipantsType = 
  | "group_participants_add"
  | "group_participants_remove"
  | "group_join_request_created"
  | "group_join_request_revoked";

export interface MetaGroupParticipantsEvent {
  timestamp: string;
  group_id: string;
  type: MetaGroupParticipantsType;
  request_id?: string;
  reason?: "invite_link" | string;
  
  // Para participantes agregados
  added_participants?: MetaGroupParticipant[];
  
  // Para participantes removidos
  removed_participants?: MetaGroupParticipant[];
  failed_participants?: MetaGroupFailedParticipant[];
  
  // Para solicitudes de unión
  join_request_id?: string;
  wa_id?: string;
  
  // Quién inició la acción
  initiated_by?: "business" | "participant";
  
  errors?: MetaGroupError[];
}

export interface MetaGroupParticipant {
  input?: string; // Número de teléfono
  wa_id?: string; // WhatsApp ID
}

export interface MetaGroupFailedParticipant extends MetaGroupParticipant {
  errors: MetaGroupError[];
}
```

### 1.4 Eventos de Configuración (group_settings_update)

```typescript
export interface MetaGroupSettingsEvent {
  timestamp: string;
  group_id: string;
  type: "group_settings_update";
  request_id?: string;
  
  profile_picture?: MetaGroupSettingUpdate<{
    mime_type: string;
    sha256: string;
  }>;
  
  group_subject?: MetaGroupSettingUpdate<{
    text: string;
  }>;
  
  group_description?: MetaGroupSettingUpdate<{
    text: string;
  }>;
  
  errors?: MetaGroupError[];
}

export interface MetaGroupSettingUpdate<T> {
  update_successful: boolean;
  errors?: MetaGroupError[];
  // Campos específicos del tipo T
} & T;
```

### 1.5 Eventos de Estado (group_status_update)

```typescript
export type MetaGroupStatusType = "group_suspended" | "group_unsuspended";

export interface MetaGroupStatusEvent {
  timestamp: string;
  group_id: string;
  type: MetaGroupStatusType;
  reason?: string;
}
```

### 1.6 Tipos Comunes

```typescript
export interface MetaGroupError {
  code: number;
  message: string;
  title: string;
  error_data?: {
    details: string;
  };
}

// Union type de todos los eventos
export type MetaGroupEvent = 
  | MetaGroupLifecycleEvent
  | MetaGroupParticipantsEvent
  | MetaGroupSettingsEvent
  | MetaGroupStatusEvent;
```

---

## Fase 2: Manejadores de Webhooks

**Dependencias:** Fase 1  
**Commit:** `feat: implement Meta group webhook handlers`

### 2.1 Controlador de Webhook Principal

**Archivo:** `backend/src/controllers/MetaWebhookController.ts`

```typescript
// Actualizar el controlador existente para manejar webhooks de grupos

const handleWebhook = async (req: Request, res: Response) => {
  const payload = req.body;
  
  // Verificar si es webhook de grupos
  const change = payload.entry?.[0]?.changes?.[0];
  const field = change?.field;
  
  if (field && field.includes('group_')) {
    // Delegar a manejador de grupos
    await HandleMetaGroupWebhook({ payload });
    return res.sendStatus(200);
  }
  
  // Webhook de mensajes normales
  if (field === 'messages') {
    await HandleMetaWebhookMessage({ payload, whatsapp });
    return res.sendStatus(200);
  }
  
  res.sendStatus(200);
};
```

### 2.2 Servicio Principal de Grupos

**Archivo:** `backend/src/services/MetaServices/HandleMetaGroupWebhook.ts`

```typescript
import { MetaGroupWebhookPayload, MetaGroupWebhookField } from "../../types/meta/MetaGroupWebhookTypes";
import Whatsapp from "../../models/Whatsapp";
import { logger } from "../../utils/logger";

interface HandleMetaGroupWebhookParams {
  payload: MetaGroupWebhookPayload;
}

const HandleMetaGroupWebhook = async ({ payload }: HandleMetaGroupWebhookParams): Promise<void> => {
  try {
    const entry = payload.entry[0];
    const change = entry.changes[0];
    const field = change.field;
    const value = change.value;
    
    // Obtener whatsapp por phone_number_id
    const whatsapp = await Whatsapp.findOne({
      where: { phoneNumberId: value.metadata.phone_number_id }
    });
    
    if (!whatsapp) {
      logger.warn(`[HandleMetaGroupWebhook] WhatsApp no encontrado: ${value.metadata.phone_number_id}`);
      return;
    }
    
    // Procesar cada evento de grupo
    for (const groupEvent of value.groups) {
      await processGroupEvent(field, groupEvent, whatsapp);
    }
    
  } catch (err) {
    logger.error("[HandleMetaGroupWebhook] Error:", err);
  }
};

const processGroupEvent = async (
  field: MetaGroupWebhookField,
  event: MetaGroupEvent,
  whatsapp: Whatsapp
): Promise<void> => {
  switch (field) {
    case "group_lifecycle_update":
      await handleLifecycleEvent(event as MetaGroupLifecycleEvent, whatsapp);
      break;
    case "group_participants_update":
      await handleParticipantsEvent(event as MetaGroupParticipantsEvent, whatsapp);
      break;
    case "group_settings_update":
      await handleSettingsEvent(event as MetaGroupSettingsEvent, whatsapp);
      break;
    case "group_status_update":
      await handleStatusEvent(event as MetaGroupStatusEvent, whatsapp);
      break;
  }
};

export default HandleMetaGroupWebhook;
```

### 2.3 Manejador de Eventos de Ciclo de Vida

**Archivo:** `backend/src/services/MetaServices/HandleGroupLifecycleEvent.ts`

```typescript
import { MetaGroupLifecycleEvent } from "../../types/meta/MetaGroupWebhookTypes";
import Whatsapp from "../../models/Whatsapp";
import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import { logger } from "../../utils/logger";
import { emitEvent } from "../../libs/emitEvent";

const handleLifecycleEvent = async (
  event: MetaGroupLifecycleEvent,
  whatsapp: Whatsapp
): Promise<void> => {
  logger.info(`[GroupLifecycle] ${event.type} - Group: ${event.group_id}`);
  
  if (event.type === "group_create") {
    await handleGroupCreate(event, whatsapp);
  } else if (event.type === "group_delete") {
    await handleGroupDelete(event, whatsapp);
  }
};

const handleGroupCreate = async (
  event: MetaGroupLifecycleEvent,
  whatsapp: Whatsapp
): Promise<void> => {
  // Verificar si hay errores
  if (event.errors && event.errors.length > 0) {
    logger.error(`[GroupCreate] Error creando grupo: ${event.errors[0].message}`);
    return;
  }
  
  // Crear contacto del grupo
  const groupContact = await Contact.create({
    name: event.subject || `Grupo ${event.group_id}`,
    number: event.group_id,
    isGroup: true,
    email: "",
    extraInfo: event.description ? [{ description: event.description }] : []
  });
  
  logger.info(`[GroupCreate] Contacto creado: ${groupContact.id}`);
  
  // Crear ticket inicial (cerrado hasta que llegue un mensaje)
  const ticket = await Ticket.create({
    contactId: groupContact.id,
    whatsappId: whatsapp.id,
    status: "closed",
    isGroup: true,
    unreadMessages: 0,
    lastMessageTimestamp: parseInt(event.timestamp)
  });
  
  logger.info(`[GroupCreate] Ticket creado: ${ticket.id}`);
  
  // Emitir evento al frontend
  emitEvent({
    to: ["admin"],
    event: {
      name: "group",
      data: {
        action: "create",
        group: groupContact,
        inviteLink: event.invite_link
      }
    }
  });
};

const handleGroupDelete = async (
  event: MetaGroupLifecycleEvent,
  whatsapp: Whatsapp
): Promise<void> => {
  // Buscar el grupo
  const groupContact = await Contact.findOne({
    where: {
      number: event.group_id,
      isGroup: true
    }
  });
  
  if (!groupContact) {
    logger.warn(`[GroupDelete] Grupo no encontrado: ${event.group_id}`);
    return;
  }
  
  // Cerrar todos los tickets del grupo
  await Ticket.update(
    { status: "closed" },
    { where: { contactId: groupContact.id } }
  );
  
  // Marcar el grupo como inactivo (no eliminar para mantener historial)
  await groupContact.update({ 
    name: `[ELIMINADO] ${groupContact.name}`
  });
  
  logger.info(`[GroupDelete] Grupo marcado como eliminado: ${groupContact.id}`);
  
  // Emitir evento al frontend
  emitEvent({
    to: ["admin"],
    event: {
      name: "group",
      data: {
        action: "delete",
        groupId: groupContact.id
      }
    }
  });
};

export default handleLifecycleEvent;
```

### 2.4 Manejador de Eventos de Participantes

**Archivo:** `backend/src/services/MetaServices/HandleGroupParticipantsEvent.ts`

```typescript
import { MetaGroupParticipantsEvent } from "../../types/meta/MetaGroupWebhookTypes";
import Whatsapp from "../../models/Whatsapp";
import Contact from "../../models/Contact";
import { logger } from "../../utils/logger";

const handleParticipantsEvent = async (
  event: MetaGroupParticipantsEvent,
  whatsapp: Whatsapp
): Promise<void> => {
  logger.info(`[GroupParticipants] ${event.type} - Group: ${event.group_id}`);
  
  // Buscar el grupo
  const groupContact = await Contact.findOne({
    where: {
      number: event.group_id,
      isGroup: true
    }
  });
  
  if (!groupContact) {
    logger.warn(`[GroupParticipants] Grupo no encontrado: ${event.group_id}`);
    return;
  }
  
  switch (event.type) {
    case "group_participants_add":
      await handleParticipantsAdd(event, groupContact);
      break;
    case "group_participants_remove":
      await handleParticipantsRemove(event, groupContact);
      break;
    case "group_join_request_created":
      await handleJoinRequest(event, groupContact);
      break;
    case "group_join_request_revoked":
      await handleJoinRequestRevoked(event, groupContact);
      break;
  }
};

const handleParticipantsAdd = async (
  event: MetaGroupParticipantsEvent,
  groupContact: Contact
): Promise<void> => {
  const participants = event.added_participants || [];
  logger.info(`[ParticipantsAdd] ${participants.length} participantes agregados al grupo ${groupContact.name}`);
  
  // TODO: Guardar participantes en una tabla de relación
  // Por ahora solo logueamos
  for (const participant of participants) {
    logger.info(`[ParticipantsAdd] Participante: ${participant.wa_id || participant.input}`);
  }
};

const handleParticipantsRemove = async (
  event: MetaGroupParticipantsEvent,
  groupContact: Contact
): Promise<void> => {
  const participants = event.removed_participants || [];
  const initiator = event.initiated_by || "unknown";
  
  logger.info(`[ParticipantsRemove] ${participants.length} participantes removidos (iniciado por: ${initiator})`);
  
  // TODO: Actualizar tabla de participantes
};

const handleJoinRequest = async (
  event: MetaGroupParticipantsEvent,
  groupContact: Contact
): Promise<void> => {
  logger.info(`[JoinRequest] Solicitud de ${event.wa_id} para unirse al grupo ${groupContact.name}`);
  
  // TODO: Notificar a admins sobre solicitud pendiente
};

const handleJoinRequestRevoked = async (
  event: MetaGroupParticipantsEvent,
  groupContact: Contact
): Promise<void> => {
  logger.info(`[JoinRequestRevoked] ${event.wa_id} canceló solicitud para unirse`);
};

export default handleParticipantsEvent;
```

### 2.5 Manejador de Eventos de Configuración

**Archivo:** `backend/src/services/MetaServices/HandleGroupSettingsEvent.ts`

```typescript
import { MetaGroupSettingsEvent } from "../../types/meta/MetaGroupWebhookTypes";
import Whatsapp from "../../models/Whatsapp";
import Contact from "../../models/Contact";
import { logger } from "../../utils/logger";

const handleSettingsEvent = async (
  event: MetaGroupSettingsEvent,
  whatsapp: Whatsapp
): Promise<void> => {
  logger.info(`[GroupSettings] Update - Group: ${event.group_id}`);
  
  // Buscar el grupo
  const groupContact = await Contact.findOne({
    where: {
      number: event.group_id,
      isGroup: true
    }
  });
  
  if (!groupContact) {
    logger.warn(`[GroupSettings] Grupo no encontrado: ${event.group_id}`);
    return;
  }
  
  // Actualizar nombre del grupo
  if (event.group_subject?.update_successful) {
    await groupContact.update({
      name: event.group_subject.text
    });
    logger.info(`[GroupSettings] Nombre actualizado: ${event.group_subject.text}`);
  }
  
  // Actualizar descripción
  if (event.group_description?.update_successful) {
    await groupContact.update({
      extraInfo: [{ description: event.group_description.text }]
    });
    logger.info(`[GroupSettings] Descripción actualizada`);
  }
  
  // TODO: Manejar foto de perfil
  if (event.profile_picture?.update_successful) {
    logger.info(`[GroupSettings] Foto de perfil actualizada`);
  }
};

export default handleSettingsEvent;
```

### 2.6 Manejador de Eventos de Estado

**Archivo:** `backend/src/services/MetaServices/HandleGroupStatusEvent.ts`

```typescript
import { MetaGroupStatusEvent } from "../../types/meta/MetaGroupWebhookTypes";
import Whatsapp from "../../models/Whatsapp";
import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import { logger } from "../../utils/logger";

const handleStatusEvent = async (
  event: MetaGroupStatusEvent,
  whatsapp: Whatsapp
): Promise<void> => {
  logger.warn(`[GroupStatus] ${event.type} - Group: ${event.group_id}`);
  
  const groupContact = await Contact.findOne({
    where: {
      number: event.group_id,
      isGroup: true
    }
  });
  
  if (!groupContact) {
    logger.warn(`[GroupStatus] Grupo no encontrado: ${event.group_id}`);
    return;
  }
  
  if (event.type === "group_suspended") {
    // Marcar grupo como suspendido
    await groupContact.update({
      name: `[SUSPENDIDO] ${groupContact.name}`
    });
    
    // Cerrar todos los tickets
    await Ticket.update(
      { status: "closed" },
      { where: { contactId: groupContact.id } }
    );
    
    logger.warn(`[GroupStatus] Grupo suspendido: ${groupContact.name}`);
  } else if (event.type === "group_unsuspended") {
    // Remover marca de suspensión
    const cleanName = groupContact.name.replace('[SUSPENDIDO] ', '');
    await groupContact.update({ name: cleanName });
    
    logger.info(`[GroupStatus] Grupo reactivado: ${cleanName}`);
  }
};

export default handleStatusEvent;
```

---

## Fase 3: Servicios de Backend

**Dependencias:** Fase 1, Fase 2  
**Commit:** `feat: implement Meta group management services`

### 3.1 Actualizar HandleMetaWebhookMessage para Grupos

**Archivo:** `backend/src/services/MetaServices/HandleMetaWebhookMessage.ts`

```typescript
// Agregar detección de grupos en mensajes

const processMessage = async (
  message: MetaWebhookMessage,
  value: any,
  whatsapp: Whatsapp
): Promise<void> => {
  // Detectar si el mensaje viene de un grupo
  const isGroup = message.from.startsWith('120363');
  
  let groupContact: Contact | undefined;
  let individualContact: Contact;
  
  if (isGroup) {
    // El "from" es el ID del grupo
    groupContact = await Contact.findOne({
      where: {
        number: message.from,
        isGroup: true
      }
    });
    
    // Si el grupo no existe, crearlo automáticamente
    if (!groupContact) {
      groupContact = await Contact.create({
        name: `Grupo ${message.from}`,
        number: message.from,
        isGroup: true,
        email: ""
      });
      logger.info(`[HandleMetaWebhookMessage] Grupo creado automáticamente: ${groupContact.id}`);
    }
    
    // El contacto individual es quien envió el mensaje
    const contactInfo = value.contacts?.find((c: any) => c.wa_id === message.from);
    individualContact = await CreateOrUpdateContactService({
      name: contactInfo?.profile?.name || "Participante",
      number: contactInfo?.wa_id || message.from,
      isGroup: false,
      email: "",
      profilePicUrl: ""
    });
  } else {
    // Conversación individual normal
    individualContact = await CreateOrUpdateContactService({
      name: contactName,
      number: contactNumber,
      isGroup: false,
      email: "",
      profilePicUrl: ""
    });
  }
  
  // Crear/buscar ticket
  const ticket = await FindOrCreateTicketService({
    contact: individualContact,
    whatsappId: whatsapp.id,
    unreadMessages: 1,
    groupContact: isGroup ? groupContact : undefined,
    lastMessageTimestamp: parseInt(message.timestamp),
    msgFromMe: false,
    body: getMessageBody(message)
  });
  
  // ... resto del código
};
```

### 3.2 Actualizar SendWhatsAppMessageMeta para Grupos

**Archivo:** `backend/src/services/MetaServices/SendWhatsAppMessageMeta.ts`

```typescript
// Agregar soporte para envío a grupos

const SendWhatsAppMessageMeta = async ({
  body,
  ticket,
  whatsapp,
  quotedMsg
}: Request): Promise<MetaMessageResult> => {
  // ... código existente ...
  
  // Determinar número de destino
  let recipientNumber: string;
  
  if (ticket.isGroup) {
    // Para grupos, usar el número del contacto del grupo
    recipientNumber = ticket.contact.number;
    logger.info(`[SendWhatsAppMessageMeta] Enviando a grupo: ${recipientNumber}`);
  } else {
    // Para individuales, limpiar el número
    recipientNumber = ticket.contact.number.replace(/^\+/, '');
  }
  
  // Validar ventana de conversación (solo para individuales)
  if (!ticket.isGroup) {
    const windowStatus = await CheckMetaConversationWindow(ticket);
    
    if (!windowStatus.isOpen) {
      // Usar plantilla...
    }
  }
  
  // Enviar mensaje
  result = await client.sendText({
    to: recipientNumber,
    body: bodyFormated,
    replyToMessageId
  });
  
  // ... resto del código
};
```

---

## Fase 4: Endpoints de API

**Dependencias:** Fase 3  
**Commit:** `feat: add Meta group management API endpoints`

### 4.1 Controlador de Grupos

**Archivo:** `backend/src/controllers/MetaGroupController.ts`

```typescript
import { Request, Response } from "express";
import ListMetaGroupsService from "../services/MetaServices/ListMetaGroupsService";
import CreateMetaGroupService from "../services/MetaServices/CreateMetaGroupService";
import UpdateMetaGroupService from "../services/MetaServices/UpdateMetaGroupService";
import DeleteMetaGroupService from "../services/MetaServices/DeleteMetaGroupService";

// Listar grupos de una conexión Meta
export const index = async (req: Request, res: Response): Promise<Response> => {
  const { whatsappId } = req.query;
  
  const groups = await ListMetaGroupsService({
    whatsappId: Number(whatsappId)
  });
  
  return res.json({ groups });
};

// Crear nuevo grupo
export const store = async (req: Request, res: Response): Promise<Response> => {
  const { whatsappId, subject, description, participants } = req.body;
  
  const group = await CreateMetaGroupService({
    whatsappId,
    subject,
    description,
    participants
  });
  
  return res.status(201).json(group);
};

// Actualizar configuración del grupo
export const update = async (req: Request, res: Response): Promise<Response> => {
  const { contactId } = req.params;
  const { subject, description } = req.body;
  
  const group = await UpdateMetaGroupService({
    contactId: Number(contactId),
    subject,
    description
  });
  
  return res.json(group);
};

// Eliminar grupo
export const remove = async (req: Request, res: Response): Promise<Response> => {
  const { contactId } = req.params;
  
  await DeleteMetaGroupService({
    contactId: Number(contactId)
  });
  
  return res.json({ message: "Grupo eliminado" });
};
```

### 4.2 Rutas

**Archivo:** `backend/src/routes/metaGroupRoutes.ts`

```typescript
import express from "express";
import * as MetaGroupController from "../controllers/MetaGroupController";
import isAuth from "../middleware/isAuth";

const metaGroupRoutes = express.Router();

metaGroupRoutes.get("/meta-groups", isAuth, MetaGroupController.index);
metaGroupRoutes.post("/meta-groups", isAuth, MetaGroupController.store);
metaGroupRoutes.put("/meta-groups/:contactId", isAuth, MetaGroupController.update);
metaGroupRoutes.delete("/meta-groups/:contactId", isAuth, MetaGroupController.remove);

export default metaGroupRoutes;
```

---

## Fase 5: Integración con Sistema Existente

**Dependencias:** Todas las fases anteriores  
**Commit:** `feat: integrate Meta groups with existing system`

### 5.1 Actualizar Modelo Contact

**Archivo:** `backend/src/models/Contact.ts`

```typescript
// Ya tiene isGroup: boolean
// Verificar que esté correctamente configurado
```

### 5.2 Actualizar Modelo Ticket

**Archivo:** `backend/src/models/Ticket.ts`

```typescript
// Ya tiene isGroup: boolean
// Verificar relaciones con Contact
```

### 5.3 Actualizar FindOrCreateTicketService

**Archivo:** `backend/src/services/TicketServices/FindOrCreateTicketService.ts`

```typescript
// Ya maneja groupContact
// Verificar que funcione correctamente con Meta API
```

---

## Dependencias y Orden de Implementación

### Orden Recomendado de Commits

```
1. feat: add Meta API group webhook types
   └─> Archivo: MetaGroupWebhookTypes.ts
   └─> Sin dependencias

2. feat: implement Meta group webhook handlers
   └─> Archivos: HandleMetaGroupWebhook.ts + manejadores individuales
   └─> Depende de: commit 1

3. feat: integrate groups in webhook message handler
   └─> Archivo: HandleMetaWebhookMessage.ts (actualización)
   └─> Depende de: commit 1, 2

4. feat: add group support in message sending
   └─> Archivo: SendWhatsAppMessageMeta.ts (actualización)
   └─> Depende de: commit 1

5. feat: implement Meta group management services
   └─> Archivos: CreateMetaGroupService.ts, etc.
   └─> Depende de: commit 1, 2

6. feat: add Meta group management API endpoints
   └─> Archivos: MetaGroupController.ts, routes
   └─> Depende de: commit 5

7. feat: update webhook controller for groups
   └─> Archivo: MetaWebhookController.ts (actualización)
   └─> Depende de: commit 2
```

### Evitar Dependencias Circulares

```
✅ CORRECTO:
MetaGroupWebhookTypes.ts (tipos)
    ↓
HandleMetaGroupWebhook.ts (usa tipos)
    ↓
HandleGroupLifecycleEvent.ts (usa tipos, importa modelos)

❌ INCORRECTO:
HandleMetaGroupWebhook.ts ←→ HandleGroupLifecycleEvent.ts
(importación circular)
```

### Reglas de Importación

1. **Tipos** pueden ser importados por cualquier archivo
2. **Modelos** (Contact, Ticket, etc.) solo se importan en servicios
3. **Servicios** no deben importarse entre sí (usar eventos si es necesario)
4. **Controladores** solo importan servicios
5. **Rutas** solo importan controladores

---

## Checklist de Implementación

### Fase 1: Tipos ✅
- [ ] Crear `MetaGroupWebhookTypes.ts`
- [ ] Definir tipos base de webhook
- [ ] Definir tipos de eventos de ciclo de vida
- [ ] Definir tipos de eventos de participantes
- [ ] Definir tipos de eventos de configuración
- [ ] Definir tipos de eventos de estado
- [ ] Exportar todos los tipos

### Fase 2: Webhooks ✅
- [ ] Crear `HandleMetaGroupWebhook.ts`
- [ ] Implementar `HandleGroupLifecycleEvent.ts`
- [ ] Implementar `HandleGroupParticipantsEvent.ts`
- [ ] Implementar `HandleGroupSettingsEvent.ts`
- [ ] Implementar `HandleGroupStatusEvent.ts`
- [ ] Agregar logs detallados en cada manejador
- [ ] Probar con webhooks de prueba

### Fase 3: Integración ✅
- [ ] Actualizar `HandleMetaWebhookMessage.ts` para detectar grupos
- [ ] Actualizar `SendWhatsAppMessageMeta.ts` para enviar a grupos
- [ ] Verificar `FindOrCreateTicketService` con grupos
- [ ] Probar flujo completo de mensajes en grupos

### Fase 4: API ✅
- [ ] Crear servicios de gestión de grupos
- [ ] Crear controlador de grupos
- [ ] Crear rutas de API
- [ ] Documentar endpoints
- [ ] Probar endpoints con Postman

### Fase 5: Testing ✅
- [ ] Probar creación de grupo vía webhook
- [ ] Probar recepción de mensajes de grupo
- [ ] Probar envío de mensajes a grupo
- [ ] Probar actualización de configuración
- [ ] Probar eliminación de grupo
- [ ] Probar suspensión/reactivación

---

## Notas Importantes

1. **Webhooks primero:** Implementar primero los webhooks porque Meta enviará eventos automáticamente
2. **Logs detallados:** Agregar logs en cada paso para debugging
3. **Manejo de errores:** Todos los webhooks deben responder 200 OK incluso si hay errores internos
4. **IDs de grupo:** Formato `120363XXXXXXXXXX` (sin @g.us en BD)
5. **Tickets de grupo:** Usar `isGroup: true` y `contactId` apunta al grupo
6. **Ventana de 24h:** NO aplica para grupos, solo para conversaciones individuales

---

## Recursos

- [Documentación oficial de Meta - Grupos](https://developers.facebook.com/documentation/business-messaging/whatsapp/groups)
- [Webhooks de grupos](https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/components#groups)
- Archivo de referencia: `backend/src/services/WbotServices/wbotMessageListener.ts` (líneas 710-790)
