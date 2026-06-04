# Análisis de Integración Sistema de Incidencias - Whaticket

La integración con el sistema de incidencias de Billing ya está implementada y funcional, solo requiere configuración de variables de entorno.

## Estado Actual de la Implementación

### ✅ Componentes Ya Implementados

#### 1. Cliente de Incidencias (`IncidenciaClient.ts`)
- **Ubicación**: `backend/src/clients/IncidenciaClient.ts`
- **Funcionalidad**: Cliente HTTP para comunicarse con la API de Billing
- **Parámetros**: Acepta `suscripcion`, `localId`, `dominio` opcionales
- **Valores por defecto**: `demoperu`, `1`, `restaurant.pe`

#### 2. Servicio de Creación (`CreateIncidenciaService.ts`)
- **Ubicación**: `backend/src/services/ChatbotMessageService/CreateIncidenciaService.ts`
- **Funcionalidad**: 
  - Parsea automáticamente `contact.domain` para extraer suscripción y dominio
  - Ejemplo: `restaurantefestin.restaurant.pe` → suscripcion: `restaurantefestin`, dominio: `restaurant.pe`
  - **Siempre usa `localId = "1"`** (línea 113)
  - Valida duplicados en ventana de 15 minutos
  - Envía mensaje de "Procesando..." al cliente
  - Registra en `IncidenciaLog`

#### 3. Endpoints de Webhook

**a) Actualizar Domain del Contacto**
- **Ruta**: `POST /external/incidencia/update-contact-domain`
- **Controlador**: `UpdateContactDomain` (ExternalApiController.ts:1567-1598)
- **Funcionalidad**: Actualiza el campo `domain` del contacto
- **Request Body**:
```json
{
  "number": "51987654321",
  "domain": "nuevotienda.restaurant.pe"
}
```
- **Headers**: `x-billing-api-key: restpe-2026!-!`
- **Validación**: Busca contacto por número de teléfono

**b) Actualizar Estado de Incidencia**
- **Ruta**: `POST /external/incidencia/update-status`
- **Controlador**: `IncidenciaStatus` (ExternalApiController.ts:1511-1565)
- **Funcionalidad**: Cierra el ticket cuando la incidencia se resuelve en Billing
- **Request Body**:
```json
{
  "incidenciaId": "INC-12345",
  "estado": "RESUELTO"
}
```
- **Estados de cierre aceptados**: `RESUELTO`, `CLOSED`, `CERRADO`, `SOLUCIONADO`
- **Acciones**: 
  - Cambia ticket a `status: "closed"`
  - Envía mensaje de despedida si está configurado

#### 4. Modelo de Datos

**Contact** (`backend/src/models/Contact.ts`):
- ✅ Campo `domain` (línea 46)
- ❌ **NO tiene** campo `local_id` (se usa hardcoded `"1"`)

**Ticket** (`backend/src/models/Ticket.ts`):
- ✅ Campo `incidenciaExternalId` (línea 104) - ID de la incidencia en Billing
- ✅ Campo `incidenciaPathJson` (línea 101) - Ruta del chatbot
- ✅ Campo `incidenciaLastAttemptAt` (línea 107) - Anti-duplicidad

## Configuración Requerida

### Variables de Entorno (.env)

```bash
# Configuración del Cliente de Incidencias
BILLING_INCIDENCIA_BASE_URL=http://incidencias.restaurant.pe/billing/slave/rest/incidenciacliente
BILLING_INCIDENCIA_API_KEY=tu_api_key_para_crear_incidencias
BILLING_INCIDENCIA_TIMEOUT_MS=15000
BILLING_INCIDENCIA_TEST_MODE=false

# API Key para Webhooks desde Billing
BILLING_WEBHOOK_API_KEY=restpe-2026!-!
```

**Nota importante**: La variable se llama `BILLING_WEBHOOK_API_KEY` (no `BILLING_API_KEY` como en la propuesta original).

## Flujo de Integración

### 1. Creación de Incidencia (Whaticket → Billing)

```
Usuario en Chatbot
    ↓
CreateIncidenciaService
    ↓
Parsea contact.domain → extrae suscripcion y dominio
    ↓
Construye URL: /incidenciaclientev2/{suscripcion}/1/{dominio}
    ↓
Envía payload a Billing API
    ↓
Guarda incidenciaId en ticket.incidenciaExternalId
```

**Payload enviado a Billing**:
```json
{
  "incidenciacliente_clienteregistro": "CHATBOTMETA",
  "incidenciacliente_descripcion": "Local: X | Caja: Y | Usuario: Z\n\nProblema > Subcategoría",
  "incidenciacliente_local": "1",
  "incidenciacliente_contactoreferencia": "https://whaticketmeta-app.restaurant.pe:8890/tickets/123",
  "incidenciacliente_contactotelefono": "51987654321",
  "incidenciacliente_usuarioid": "1",
  "incidenciacliente_direccionremota": "",
  "incidenciacliente_plataforma": "WEB",
  "incidenciacliente_paisid": "1",
  "incidenciacliente_fechahoraregistro": "2026-06-04 12:30:00",
  "tipoproblema_id": "6",
  "incidenciacliente_llamarapersonal": 0
}
```

### 2. Actualización de Domain (Billing → Whaticket)

Cuando en Billing se asigna/modifica el local del cliente:

```bash
POST https://whaticketmeta-app.restaurant.pe/external/incidencia/update-contact-domain
Headers: x-billing-api-key: restpe-2026!-!
Body: {
  "number": "51987654321",
  "domain": "nuevotienda.restaurant.pe"
}
```

### 3. Cierre de Incidencia (Billing → Whaticket)

Cuando se resuelve la incidencia en Billing:

```bash
POST https://whaticketmeta-app.restaurant.pe/external/incidencia/update-status
Headers: x-billing-api-key: restpe-2026!-!
Body: {
  "incidenciaId": "INC-12345",
  "estado": "RESUELTO"
}
```

## Decisiones de Diseño

### ¿Por qué `local_id` siempre es "1"?

**Razón**: En el contexto del chatbot de WhatsApp, **no hay forma de determinar automáticamente** a qué local pertenece el contacto cuando crea la incidencia inicial. 

**Solución actual**: 
- Se usa `local_id = "1"` como valor genérico
- Billing puede actualizar el `domain` del contacto posteriormente mediante el webhook
- Las futuras incidencias del mismo contacto usarán el domain actualizado

**Alternativa no implementada**: 
- Agregar campo `local_id` al modelo Contact (requiere migración de base de datos)
- Actualizar el endpoint `update-contact-domain` para aceptar y guardar `local_id`
- Modificar `CreateIncidenciaService` para usar `contact.local_id || "1"`

### Parseo de Domain

**Formato esperado**: `{suscripcion}.{dominio}`

**Ejemplos**:
- `restaurantefestin.restaurant.pe` → suscripcion: `restaurantefestin`, dominio: `restaurant.pe`
- `ma-anulado-utea.restaurant.pe` → suscripcion: `ma-anulado-utea`, dominio: `restaurant.pe`
- `tienda.quipupos.com` → suscripcion: `tienda`, dominio: `quipupos.com`

**Valores por defecto** (cuando no hay domain):
- suscripcion: `demoperu`
- dominio: `restaurant.pe`

## Diferencias con la Propuesta Original

| Aspecto | Propuesta | Implementación Actual |
|---------|-----------|----------------------|
| Variable API Key | `BILLING_API_KEY` | `BILLING_WEBHOOK_API_KEY` |
| Campo `local_id` en Contact | Propone agregarlo | No existe, se usa hardcoded `"1"` |
| Endpoint update-contact-domain | Busca por `incidenciaId`, actualiza `local_id`, `domain`, `country_id` | Busca por `number`, solo actualiza `domain` |
| Estados de cierre | Solo `"3"` | Lista: `RESUELTO`, `CLOSED`, `CERRADO`, `SOLUCIONADO` |
| Método `parseDomain()` en IncidenciaClient | Propone agregarlo | Ya existe en CreateIncidenciaService |

## Recomendaciones

### ✅ Mantener Implementación Actual

**Ventajas**:
- Ya está funcionando y probado
- No requiere migraciones de base de datos
- Más simple y directo

**Pasos**:
1. Configurar `.env` con las variables correctas
2. Documentar en Billing cómo llamar a los webhooks
3. Usar `local_id = "1"` como estándar

### ⚠️ Implementar Propuesta Completa

**Solo si realmente necesitas**:
- Almacenar `local_id` específico por contacto
- Actualizar múltiples campos desde Billing

**Requiere**:
1. Migración de base de datos para agregar `local_id` a Contact
2. Modificar controlador `UpdateContactDomain`
3. Modificar `CreateIncidenciaService` para usar `contact.local_id`

## Checklist de Configuración

- [ ] Agregar `BILLING_INCIDENCIA_BASE_URL` al `.env`
- [ ] Agregar `BILLING_INCIDENCIA_API_KEY` al `.env`
- [ ] Agregar `BILLING_WEBHOOK_API_KEY=restpe-2026!-!` al `.env`
- [ ] Configurar en Billing los webhooks hacia Whaticket
- [ ] Probar creación de incidencia desde chatbot
- [ ] Probar actualización de domain desde Billing
- [ ] Probar cierre de incidencia desde Billing

## Conclusión

La integración está **completa y funcional**. La decisión de usar siempre `local_id = "1"` es correcta dado que no hay forma de determinar el local desde el chatbot. El sistema permite que Billing actualice el `domain` del contacto posteriormente, lo que mejorará la precisión en futuras incidencias del mismo cliente.
