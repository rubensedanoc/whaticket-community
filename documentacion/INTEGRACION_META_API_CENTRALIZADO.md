# 🔄 INTEGRACIÓN META WHATSAPP BUSINESS API — Documento Centralizado

**Proyecto:** Whaticket Community  
**Objetivo:** Integrar Meta WhatsApp Business Cloud API para mejorar estabilidad y eliminar dependencia de Puppeteer  
**Timeline estimado:** 2 semanas  
**Última actualización:** Febrero 2026

---

## 📌 RESUMEN DE LO QUE SE VA IMPLEMENTAR

### ¿La integración es transparente o requiere muchos cambios?

> [!IMPORTANT]
> **Es una integración mayormente transparente.** El 85% del sistema NO cambia. Solo el 15% de la capa de mensajería se modifica (recepción y envío), y se hace a través de un **adaptador unificado** que abstrae ambos sistemas.

**Lo que NO cambia (85%):**

| Componente | Impacto |
|------------|---------|
| **Frontend (React)** | ✅ 0% cambios — UI, tickets, MessagesList, Socket.io listeners idénticos |
| **Lógica de negocio** | ✅ 0% cambios — Tickets, Queues, Users, Categories, permisos |
| **Base de datos** | ⚠️ Solo agregar 5 columnas nuevas (backward compatible) |
| **Multi-agente** | ✅ 0% cambios — userId, helpUsers, participantUsers idéntico |
| **Chatbot/Respuestas automáticas** | ✅ 0% cambios — Reutiliza servicios existentes |

**Lo que SÍ cambia (15%):**

| Área | Tipo de cambio |
|------|----------------|
| **Recepción de mensajes** | De `wbot.on('message')` (Puppeteer) → `POST /webhooks/meta` (HTTP webhook) |
| **Envío de mensajes** | De `wbot.sendMessage()` (Puppeteer) → `axios.post(Meta API)` (HTTP) |
| **Modelo Whatsapp** | +5 columnas: `apiType`, `phoneNumberId`, `metaAccessToken`, `businessAccountId`, `lastWebhookReceivedAt` |
| **Sincronización** | NUEVO: Sistema de reintentos automáticos, health checks, recuperación de mensajes |

---

## 📋 RESUMEN DE CAMBIOS: BASE DE DATOS Y ARCHIVOS

### 🗄️ Tablas de Base de Datos Modificadas

**Tabla `Whatsapps` (Configuración de Conexiones)**

Se agregarán **5 columnas nuevas** (no se modifican tablas existentes, solo se agregan campos):

| Columna | Tipo | Descripción | Ejemplo |
|---------|------|-------------|---------|
| `apiType` | VARCHAR(20) | Tipo de API: `'whatsapp-web.js'` o `'meta-api'` | `'meta-api'` |
| `phoneNumberId` | VARCHAR(100) | ID del número en Meta (solo para Meta API) | `'109123456789012'` |
| `metaAccessToken` | TEXT | Token de acceso de Meta (renovable cada 90 días) | `'EAAG...'` |
| `businessAccountId` | VARCHAR(100) | ID de WhatsApp Business Account | `'102345678901234'` |
| `lastWebhookReceivedAt` | TIMESTAMP | Última vez que se recibió webhook (health check) | `2026-02-10 10:30:00` |

> [!NOTE]
> **Compatibilidad:** Los números existentes (`whatsapp-web.js`) tendrán `apiType='whatsapp-web.js'` y los campos de Meta estarán en NULL. No se rompe nada.

**Tablas NO modificadas:**
- ✅ `Messages` — Sin cambios
- ✅ `Tickets` — Sin cambios
- ✅ `Contacts` — Sin cambios
- ✅ `Users` — Sin cambios
- ✅ `Queues` — Sin cambios

### 📁 Archivos Backend a Crear (9-10 archivos nuevos)

```
backend/src/
├── database/migrations/
│   └── YYYYMMDDHHMMSS-add-meta-api-fields.ts    [NUEVO] Migración BD
├── routes/
│   └── webhooks.ts                               [NUEVO] Rutas webhook Meta
├── types/
│   └── MetaWebhook.ts                            [NUEVO] TypeScript interfaces para webhooks
├── helpers/
│   └── MetaApiHelpers.ts                         [NUEVO] Validaciones y helpers Meta
└── services/MetaServices/                        [NUEVA CARPETA]
    ├── HandleMetaWebhook.ts                      [NUEVO] Procesa mensajes entrantes
    ├── SendMetaMessage.ts                        [NUEVO] Envía mensajes vía Meta
    ├── GetMessagingClient.ts                     [NUEVO] Adaptador unificado
    ├── MetaMessageSync.ts                        [NUEVO] Sincronización/reintentos
    └── MetaSyncCrons.ts                          [NUEVO] Tareas programadas
```

### ⚙️ Archivos de Configuración

**Archivo `.env` (Variables de entorno)**

Deberás agregar estas variables de configuración:

```bash
# Meta WhatsApp Cloud API
META_APP_ID=your_app_id
META_APP_SECRET=your_app_secret
META_WEBHOOK_VERIFY_TOKEN=your_custom_verify_token
META_WEBHOOK_URL=https://your-domain.com/webhooks/meta

# Por número (se almacenan en BD, estos son para configuración inicial)
META_PHONE_NUMBER_ID=109876543210
META_ACCESS_TOKEN=EAAG...
META_BUSINESS_ACCOUNT_ID=102345678901234
```

> [!WARNING]
> Las credenciales específicas de cada número (`phoneNumberId`, `metaAccessToken`, `businessAccountId`) se guardan en la tabla `Whatsapps`, NO solo en `.env`. El `.env` es solo para configuración global o inicial.

### 📝 Archivos Backend a Modificar (5-6 archivos, cambios mínimos)

| Archivo | Ubicación | Cambios |
|---------|-----------|---------|
| `Whatsapp.ts` | `models/` | Agregar 5 decoradores `@Column()` para nuevos campos |
| `MessageController.ts` | `controllers/` | Cambiar `getWbot()` → `GetMessagingClient()` |
| `WhatsAppController.ts` | `controllers/` | Ajustar lógica de inicialización para soportar ambos tipos |
| `app.ts` | `src/` | Registrar `app.use('/webhooks', webhookRoutes)` |
| `server.ts` | `src/` | Ejecutar `startAllMetaSyncCrons()` al iniciar |
| `.env` | `raíz del proyecto` | Agregar variables de configuración de Meta |

### 🎨 Archivos Frontend

**✅ CERO cambios en Frontend.**  
El frontend React no necesita modificaciones porque la comunicación sigue siendo a través de Socket.IO y los mismos endpoints REST.

---

## 📊 COMPARACIÓN: whatsapp-web.js vs Meta API

| Aspecto | whatsapp-web.js (Actual) | Meta API (Nuevo) |
|---------|--------------------------|------------------|
| **Autenticación** | QR Code cada 30-60 min | Token permanente (90 días) |
| **Infraestructura** | Puppeteer + Chrome headless (~300-500 MB RAM/número) | HTTP REST API (~50 MB total) |
| **Recepción** | Polling activo `wbot.on('message')` | Webhook pasivo `POST /webhooks/meta` |
| **Envío** | `wbot.sendMessage()` | HTTP POST a Meta |
| **Sesión** | LocalAuth en archivos | Sin sesión (stateless) |
| **Estabilidad** | ❌ ~85% uptime, caídas cada 30-60 min | ✅ 99.9% uptime, SLA garantizado |
| **Consumo RAM** | ~300-500 MB por Chrome × N números | ~50 MB (sin Chrome) |
| **Costo (3 números)** | $0 directo + $850/mes operacional por downtime | $0-195/mes + 0 downtime |
| **Soporte oficial** | ❌ No oficial (riesgo cierre de cuenta) | ✅ Oficial Meta |
| **Botones interactivos** | ❌ No soportado | ✅ Nativo |
| **Grupos de WhatsApp** | ✅ Soportado (fluido) | ⚠️ Soportado con fricción (Solo links) |
| **Media (Fotos, Videos, PDF)** | ✅ Envía archivos locales (C:\...) | ⚠️ Requiere URLs públicas (https://...) |
| **Mensajes perdidos en caída** | ❌ Se pierden todos | ✅ Meta guarda 30 días y reintenta 24h |
| **Latencia** | 500ms-2s (polling) | 100-300ms (push instantáneo) |

---

## 🎯 ESTRATEGIA: MODELO HÍBRIDO

> [!TIP]
> La estrategia recomendada es **híbrida**: 3 números en Meta API (prioritarios, 99.9% uptime) + 7 números en whatsapp-web.js optimizado (secundarios, para grupos).

```
┌──────────────────────────────────────────────┐
│  3 números Meta API (prioritarios)           │
│  - Solo conversaciones 1 a 1                 │
│  - Atención al cliente, ventas, reservas     │
│  - 99.9% uptime, sin QR                      │
│  - Multi-agente funciona perfecto            │
│  💰 $0-195/mes                               │
└──────────────────────────────────────────────┘

┌──────────────────────────────────────────────┐
│  7 números whatsapp-web.js (secundarios)     │
│  - Conversaciones 1 a 1 Y grupos             │
│  - Coordinación interna, grupos de trabajo   │
│  - Multi-agente funciona igual               │
│  💰 $0/mes                                   │
└──────────────────────────────────────────────┘
```

### Tabla de compatibilidad funcional

| Funcionalidad | whatsapp-web.js | Meta API |
|---------------|:---------------:|:--------:|
| Multi-agente (varios usuarios) | ✅ | ✅ |
| Conversaciones 1 a 1 | ✅ | ✅ |
| Grupos de WhatsApp | ✅ | ⚠️ (Requiere links de invitación) |
| userId / helpUsers / participantUsers | ✅ | ✅ |
| Queues / Categorías | ✅ | ✅ |
| Respuestas automáticas / Chatbot | ✅ | ✅ |
| Envío de media (img/video/audio/doc) | ✅ | ✅ (HTTPS) |
| Stickers animados | ✅ | ❌ Solo estáticos |
| Botones interactivos nativos | ❌ | ✅ |

---

## 🏗️ ARQUITECTURA DE LA INTEGRACIÓN

### Adaptador Unificado (`GetMessagingClient`)

El cambio clave es un **adaptador** que detecta el tipo de API del número y enruta al sistema correcto:

```
MessageController.ts (SIN CAMBIOS en lógica)
        │
        │ await GetMessagingClient(whatsappId)
        ▼
┌──────────────────────────────┐
│  GetMessagingClient.ts       │
│  (Adaptador - NUEVO)        │
└──────┬───────────────┬───────┘
       │               │
       ▼               ▼
 'whatsapp-web.js'   'meta-api'
       │               │
       ▼               ▼
 WhatsAppWebJsClient  MetaApiClient
 └→ wbot.sendMessage  └→ HTTP POST a Meta

 MISMO RESULTADO:
 - Message en BD ✅
 - Socket.io emitido ✅
 - Frontend actualizado ✅
 - Usuario NO nota diferencia ✅
```

**Código antes vs después:**
```diff
-const wbot = getWbot(whatsappId);
-await wbot.sendMessage(`${number}@c.us`, body);
+const client = await GetMessagingClient(whatsappId);
+await client.sendText(to, body);
```

### Interface del adaptador

```typescript
interface IMessagingClient {
  sendText(to: string, body: string): Promise<Message>;
  sendMedia(to: string, type: 'image'|'video'|'audio'|'document', url: string, caption?: string): Promise<Message>;
  sendButtons?(to: string, text: string, buttons: Button[]): Promise<Message>;
}
```

### Arquitectura Webhook: ¿Cómo funciona con múltiples números?

> [!NOTE]
> **Es un concepto clave:** No existe "un webhook por número". Existe **un solo webhook por App de Meta**.

Tu servidor expone **UNA SOLA RUTA** (`POST /webhooks/meta`) y Meta envía ahí los mensajes de **TODOS** los números conectados a tu Business Manager.

**Flujo de discriminación:**
1.  **Meta envía JSON** a tu servidor.
2.  El JSON incluye el `phone_number_id` del destinatario.
3.  Tu código (`HandleMetaWebhook.ts`) busca en tu base de datos qué `Whatsapp` tiene ese `phoneNumberId`.
4.  El sistema procesa el mensaje usando la configuración de ese número (colas, saludos, flujos).

**Carga del servidor:**
El webhook es extremadamente eficiente. Puede recibir 50 mensajes de 5 números diferentes en el mismo segundo sin mezclarlos, gracias al `phone_number_id` y `wamid` (ID único de mensaje).

---

## 📁 ARCHIVOS A CREAR Y MODIFICAR

### ✨ Archivos nuevos (7 archivos)

```
backend/src/
├── database/migrations/
│   └── YYYYMMDDHHMMSS-add-meta-api-fields.ts    → Migración BD
├── routes/
│   └── webhooks.ts                               → Endpoints webhook Meta
└── services/MetaServices/                        → CARPETA NUEVA
    ├── HandleMetaWebhook.ts                      → Recepción de mensajes
    ├── SendMetaMessage.ts                        → Envío de mensajes
    ├── GetMessagingClient.ts                     → Adaptador unificado
    ├── MetaMessageSync.ts                        → Sincronización/reintentos
    └── MetaSyncCrons.ts                          → Crons automáticos

### 🔧 Archivos a modificar (4 archivos, cambios mínimos)

| Archivo | Cambio |
|---------|--------|
| `models/Whatsapp.ts` | **Tabla `Whatsapps` (Configuración de Conexiones)**:<br>+5 columnas: `apiType`, `phoneNumberId`, `metaAccessToken`, `businessAccountId`, `lastWebhookReceivedAt`<br>*(NO afecta a tabla Messages)* |
| `controllers/MessageController.ts` | Usar `GetMessagingClient` en vez de `getWbot` |
| `app.ts` | Registrar `webhookRoutes` |
| `server.ts` | Inicializar `startAllMetaSyncCrons()` |

---

## 🔄 FLUJOS PRINCIPALES

### Recepción de mensajes

| | whatsapp-web.js (actual) | Meta API (nuevo) |
|---|---|---|
| **Trigger** | Puppeteer detecta evento | Meta hace HTTP POST a tu servidor |
| **Entrada** | `wbot.on('message')` | `app.post('/webhooks/meta')` |
| **Después** | `FindOrCreateContact` → `FindOrCreateTicket` → Guardar Message → Socket.io | **Idéntico** — reutiliza mismos servicios |
| **Si servidor cae** | ❌ Mensajes perdidos para siempre | ✅ Meta reintenta 24h, guarda 30 días |

### Envío de mensajes

| | whatsapp-web.js (actual) | Meta API (nuevo) |
|---|---|---|
| **Método** | `wbot.sendMessage()` vía Puppeteer | `axios.post()` a `graph.facebook.com` |
| **Dependencia** | Chrome debe estar vivo y QR vigente | Solo un token válido (90 días) |
| **Si falla** | ❌ Error final, sin reintentos | ✅ Cola automática con backoff exponencial |
| **Confirmación** | Sin confirmación real de entrega | ✅ Webhooks de status: sent → delivered → read |

### Comparación de Logs: Envío de Mensaje

> [!TIP]
> **La lógica de guardado en BD es IDÉNTICA.** Whaticket guarda el mensaje *antes* y *después* de enviarlo. Solo cambia el "medio de transporte".

**Actual (Puppeteer):**
```
[Verify] ✅ Ticket actualizado con lastMessage
[SendWhatsAppMessage] Iniciando envio
[SendWhatsAppMessage] Wbot obtenido (Puppeteer)
[SendWhatsAppMessage] Enviando mensaje...
[SendWhatsAppMessage] Mensaje enviado exitosamente
[SendWhatsAppMessage] MessageId: true_120363422955595966@g.us_3EB0...
```

**Nuevo (Meta API):**
```
[Verify] ✅ Ticket actualizado con lastMessage
[SendMetaMessage] Iniciando envio
[SendMetaMessage] Cliente obtenido (Meta API)
[SendMetaMessage] Enviando HTTP POST a Meta...
[SendMetaMessage] Mensaje enviado exitosamente
[SendMetaMessage] Meta ID: wamid.HBgL...
[Webhook] Status update: SENT (ack=1)
```

### Sistema de sincronización (NUEVO)

| Cron | Frecuencia | Función |
|------|-----------|---------|
| `processFailedMessagesQueue()` | Cada 5 min | Reintentar mensajes con `ack = -1` (backoff: 5, 15, 30, 60, 120 min) |
| `syncMessageStatuses()` | Cada 15 min | Consultar estado real de mensajes a Meta (sent/delivered/read) |
| `checkWebhookHealth()` | Cada 30 min | Verificar `lastWebhookReceivedAt`, alertar si >60min, recuperar si >120min |
| `recuperarMensajesPerdidos()` | Diario a las 3 AM | Recuperación preventiva de últimas 24h |

---

## ⚠️ RIESGOS Y LIMITACIONES IMPORTANTES

### Limitaciones de Meta API

| Limitación | Impacto | Mitigación |
|------------|---------|------------|
| **Sin soporte de grupos** | No puedes recibir/enviar mensajes a grupos | Estrategia híbrida: grupos solo con wbot |
| **Media requiere HTTPS** | No acepta archivos locales ni HTTP | Servir con SSL, o usar S3/Cloudinary |
| **Token expira cada 90 días** | Sin renovación = dejan de funcionar | Alerta 7 días antes, renovación manual en Meta |
| **Webhook debe ser HTTPS** | Meta no acepta HTTP plano | Nginx + Let's Encrypt, o Cloudflare Tunnel |
| **Rate limit** | Max 80 msg/seg por número, 1000 conv gratis/mes | Monitoreo en Meta Business Manager |
| **Tamaño max archivos** | Imagen 5MB, Video 16MB, Doc 100MB | Validación previa antes de enviar |
| **Formatos limitados** | Solo JPEG/PNG, MP4/3GP, OGG/MP3, PDF/DOC/XLS | Conversión de formatos si es necesario |
| **Stickers solo estáticos** | No soporta stickers animados (WebP) | Stickers animados solo con wbot |

### Riesgos técnicos

> [!WARNING]
> **Webhook timeout:** Meta requiere respuesta `200 OK` en < 5 segundos. La solución es responder inmediatamente y procesar async:
> ```typescript
> app.post('/webhooks/meta', async (req, res) => {
>   res.status(200).send('EVENT_RECEIVED');  // ← Inmediato
>   await handleMetaWebhook(req.body);       // ← Async después
> });
> ```

> [!CAUTION]
> **Duplicados de webhook:** Si no respondes a tiempo, Meta reenvía. Se debe implementar `isDuplicateMessage()` verificando `messageId` en BD antes de procesar.

---

## 📋 PRERREQUISITOS

Antes de tocar código:

- [ ] Cuenta Meta Business Manager (https://business.facebook.com/)
- [ ] App en Meta Developers con producto WhatsApp
- [ ] Número de teléfono verificado (SMS)
- [ ] Credenciales: `Phone Number ID`, `WhatsApp Business Account ID`, `Access Token`, `App Secret`
- [ ] Servidor con HTTPS (SSL/Let's Encrypt, Ngrok dev, o Cloudflare Tunnel)
- [ ] Backup completo de base de datos

---

## 📅 PLAN DE IMPLEMENTACIÓN (10 Semanas)

| Semana | Fase | Actividad |
|--------|------|-----------|
| **1-2** | Preparación | Registro Meta Business, verificación número, obtener credenciales, configurar SSL |
| **3** | Base de datos | Crear migración, agregar 5 columnas a `Whatsapps`, modificar modelo |
| **4** | Recepción | Crear `routes/webhooks.ts`, `HandleMetaWebhook.ts`, registrar en `app.ts` |
| **5** | Envío | Crear `SendMetaMessage.ts`, `GetMessagingClient.ts` |
| **6** | Sincronización | Crear `MetaMessageSync.ts` (reintentos, recuperación), `MetaSyncCrons.ts` |
| **7** | Integración | Modificar `MessageController.ts`, reemplazar `getWbot()` → `GetMessagingClient()` |
| **8** | Testing | 9 pruebas: webhook, recepción, envío, media, reintentos, health check, multi-agente, grupos |
| **9** | Migración piloto | 1 número piloto → Meta API, testing 72h, luego migrar números 2 y 3 |
| **10** | Monitoreo | Configurar alertas, dashboard métricas, documentar, capacitar equipo |

---

## 📈 MÉTRICAS DE ÉXITO ESPERADAS

| Métrica | Antes (wbot) | Después (Meta API) |
|---------|:------------:|:------------------:|
| Uptime | ~85% | 99.9% |
| Downtime diario | 2-3 horas | < 5 min/mes |
| Mensajes perdidos | 150-300/mes | 0-5/mes |
| QR rescans | 10-15/semana | 0 |
| Tiempo respuesta | 5-10 min (con downtime) | < 1 min |
| RAM consumida (3 números) | ~1-1.5 GB | ~50 MB |
| Costo mensual | $850 (operacional) | $0-195 |

---

## ❓ FAQ RELEVANTES

### ¿Varios usuarios pueden responder desde el mismo número Meta API?
**✅ SÍ.** El sistema multi-agente de Whaticket (userId, helpUsers, participantUsers) funciona **idéntico**. Meta API no cambia nada en la lógica de asignación y colaboración.

### ¿Es un webhook diferente por cada número?
**NO.** Es **un solo webhook para toda la empresa**. Tu servidor tiene una sola "puerta" y clasifica los mensajes automáticamente según el ID del número de destino (`phone_number_id`) que viene dentro del mensaje. Es eficiente, ordenado y escalable.

### ¿Puedo usar la API para mis "Grupos de Implementación"?
**⚠️ TÉCNICAMENTE SÍ, PERO OPERATIVAMENTE ES MOLESTO.**

A diferencia de WhatsApp Web donde agregas al cliente directamente ("Te agrego al grupo"), en la API de Meta:
1.  **No puedes agregar participantes** directamente (política antispam).
2.  Debes enviar un **enlace de invitación** al cliente.
3.  El cliente debe pulsar el enlace para unirse.
4.  Límite de participantes más estricto (100 vs 1024).

**Conclusión:** Si aceptas decirle al cliente "Únete con este link", puedes usar la API. Si prefieres la experiencia fluida de "Ya te agregué", **mantén estos números en whatsapp-web.js**.

### ¿Los tickets y conversaciones existentes se rompen?
**NO.** Los tickets existentes con `isGroup=false` funcionan perfectamente. Los tickets de grupos necesitan transferirse a números wbot antes de migrar.

### ¿El sistema de queues/categorías/chatbot funciona igual?
**✅ SÍ, 100%.** Solo cambia la forma de recibir y enviar mensajes. Toda la lógica de negocio se reutiliza sin modificación.

### ¿Se guardan los mensajes en BD igual que ahora?
**✅ SÍ, EXACTAMENTE IGUAL.**
Tu función `CreateMessageService` seguirá funcionando.
1.  Frontend envía mensaje.
2.  Backend lo **guarda en BD** (estado `pending`).
3.  Adaptador lo envía a Meta.
4.  Si Meta responde OK, Backend actualiza estado a `sended` (ack=1).
5.  Si Meta avisa que llegó al celular, actualiza a `delivered` (ack=2).

**Nada se pierde.** Todo queda registrado en tu base de datos local para historial, reportes y auditoría.

### ¿Qué significa que "Media requiere URLs públicas"?
**Esto es importante.**
En `whatsapp-web.js` puedes decirle: *"Toma este archivo en C:\imagenes\foto.jpg y envíalo"*.
En **Meta API NO puedes hacer eso**. Meta (Facebook) no tiene acceso a tu disco duro C:\.
Para enviar una foto, primero debe ser accesible en internet:
1.  Tu servidor debe tener una **URL pública** (ej: `https://whaticket.com/public/foto.jpg`).
2.  Le dices a Meta: *"Envía la foto que está en esta URL"*.
**Solución:** Tu backend ya hace esto (guarda en `/public`), solo debemos asegurarnos de que esa carpeta sea accesible desde internet con HTTPS.

### ¿Qué pasa si Meta API se cae?
**Triple protección:** (1) Meta reintenta webhook 24h, (2) Meta almacena mensajes 30 días recuperables, (3) Cola local de reintentos con backoff exponencial.

### ¿Cómo afecta el rendimiento?
**Mejora significativa.** 3 números menos en Chrome = ~1 GB menos de RAM, 30-40% menos CPU, latencia de mensajes de 500ms-2s a 100-300ms.

---

## 🎯 CONCLUSIÓN

| Pregunta | Respuesta |
|----------|-----------|
| **¿Es transparente?** | ✅ **Sí, en un 85%.** Frontend sin cambios, lógica de negocio sin cambios, BD backward compatible |
| **¿Se rompe algo?** | ❌ **No.** El adaptador unificado abstrae ambos sistemas |
| **¿Cuántos archivos cambian?** | 7 nuevos + 4 modificados (cambios mínimos) |
| **¿El usuario final nota diferencia?** | Solo nota **mejor estabilidad** y menor latencia |
| **¿Vale la pena?** | ✅ Sí: de 85% uptime a 99.9%, de $850/mes a $0-195/mes, cero mensajes perdidos |

---

> **Documentos fuente consolidados en este archivo:**
> - `FLUJO_TRABAJO_INTEGRACION_META_API.md` — Plan paso a paso (2045 líneas)
> - `DIAGRAMAS_FLUJO_META_API.md` — Diagramas visuales (744 líneas)
> - `COMPARACION_WBOT_VS_META_API.md` — Comparación técnica (387 líneas)
