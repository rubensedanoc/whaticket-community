# 🚀 Guía de Configuración del Webhook de Meta WhatsApp

Esta guía te ayudará a configurar el webhook paso a paso para recibir mensajes de Meta WhatsApp.

---

## 📋 Prerequisitos

1. **Cuenta de Meta Business** (Facebook Business Manager)
2. **Aplicación de Meta** creada en [Meta for Developers](https://developers.facebook.com/)
3. **Número de WhatsApp Business** vinculado a tu app
4. **Servidor con HTTPS** (Meta requiere SSL/TLS)

---

## 🔧 Paso 1: Configurar Variables de Entorno

Edita tu archivo `.env` y agrega estas variables:

```bash
# META WHATSAPP WEBHOOK
META_WEBHOOK_VERIFY_TOKEN=MiTokenSecreto123
META_APP_SECRET=tu_app_secret_aqui
```

### ¿Dónde obtener cada valor?

#### `META_WEBHOOK_VERIFY_TOKEN`
- **Tú lo creas**: Puede ser cualquier string aleatorio y seguro
- Ejemplo: `RTX2024_MiWebhook_Secreto`
- **Importante**: Lo usarás después en Meta para verificar el webhook

#### `META_APP_SECRET`
1. Ve a [Meta for Developers](https://developers.facebook.com/)
2. Selecciona tu aplicación
3. Ve a **Configuración → Básica**
4. Copia el valor de **"Clave secreta de la app"** (App Secret)

---

## 🌐 Paso 2: Verificar que tu Servidor Esté Accesible

Tu webhook debe estar disponible públicamente con HTTPS.

### URL del Webhook
```
https://tu-dominio.com/meta/webhook
```

Por ejemplo:
```
https://api.mydomain.com/meta/webhook
```

### Verificar que funciona
```bash
# Debe responder con 403 (es correcto, necesita parámetros)
curl https://tu-dominio.com/meta/webhook
```

---

## 🔗 Paso 3: Configurar el Webhook en Meta

### 3.1 Ir a la Configuración de WhatsApp

1. Ve a [Meta for Developers](https://developers.facebook.com/)
2. Selecciona tu aplicación
3. En el menú lateral, busca **"WhatsApp"** → **"Configuración"**

### 3.2 Configurar la URL del Webhook

En la sección **"Webhook"**:

1. Haz clic en **"Configurar"** o **"Editar"**
2. Ingresa la **URL de devolución de llamada**:
   ```
   https://tu-dominio.com/meta/webhook
   ```

3. Ingresa el **Token de verificación**:
   ```
   MiTokenSecreto123
   ```
   ⚠️ **Debe ser exactamente el mismo** que pusiste en `META_WEBHOOK_VERIFY_TOKEN`

4. Haz clic en **"Verificar y guardar"**

### 3.3 ¿Qué pasa al verificar?

Meta hará una petición GET a tu webhook:
```
GET https://tu-dominio.com/meta/webhook?hub.mode=subscribe&hub.verify_token=MiTokenSecreto123&hub.challenge=1234567890
```

Tu servidor responderá con el `hub.challenge` si el token es correcto.

✅ **Si la verificación es exitosa**, verás un mensaje de confirmación.

❌ **Si falla**, revisa:
- Que la URL sea accesible (HTTPS)
- Que el token en `.env` coincida exactamente
- Los logs de tu servidor

---

## 📨 Paso 4: Suscribirse a Eventos

Después de verificar el webhook, debes suscribirte a los eventos que quieres recibir.

### 4.1 En la misma página de Webhook

Busca la sección **"Campos del webhook"** y activa:

- ✅ **messages** - Mensajes entrantes
- ✅ **message_status** - Estados de mensajes (enviado, entregado, leído)

### 4.2 Guardar Cambios

Haz clic en **"Guardar"** o **"Actualizar"**

---

## 🧪 Paso 5: Probar el Webhook

### 5.1 Enviar un Mensaje de Prueba

1. Abre WhatsApp en tu teléfono
2. Envía un mensaje al número de WhatsApp Business configurado
3. Escribe: `Hola, esto es una prueba`

### 5.2 Verificar los Logs

En tu servidor, deberías ver logs como:

```
[INFO] Webhook request received
[INFO] ⚠️ Running in TEST MODE - HMAC validation disabled
[INFO] Meta Webhook received { entries: 1 }
[INFO] Message processed {
  from: '521234567890',
  contactName: 'Juan Pérez',
  type: 'text',
  text: 'Hola, esto es una prueba',
  messageId: 'wamid.XXX...'
}
[INFO] Handling incoming message
```

### 5.3 Verificar en Meta

También puedes ver los webhooks enviados en:
1. Meta for Developers → Tu App
2. WhatsApp → Configuración
3. Scroll hasta **"Webhooks"**
4. Haz clic en **"Ver eventos"** o **"Test"**

---

## 🔒 Paso 6: Activar Validación HMAC (Producción)

Una vez que todo funcione, activa la validación de seguridad.

### 6.1 Configurar META_APP_SECRET

Asegúrate de que `META_APP_SECRET` esté configurado en tu `.env`:

```bash
META_APP_SECRET=abc123def456...
```

### 6.2 Reiniciar el Servidor

```bash
# Si usas Docker
docker-compose restart backend

# Si usas PM2
pm2 restart backend

# Si usas npm
npm run dev
```

### 6.3 Verificar en Logs

Ahora deberías ver:
```
[INFO] Signature validated successfully
```

En lugar de:
```
[WARN] ⚠️ Running in TEST MODE - HMAC validation disabled
```

---

## 🐛 Troubleshooting (Solución de Problemas)

### ❌ Error: "URL couldn't be validated"

**Causas comunes:**
- El servidor no es accesible públicamente
- No tienes HTTPS configurado
- El puerto está bloqueado por firewall
- La URL es incorrecta

**Solución:**
```bash
# Verifica que tu servidor responda
curl -I https://tu-dominio.com/meta/webhook

# Debe devolver HTTP 200 o 403 (no 404)
```

### ❌ Error: "Token verification failed"

**Causas:**
- El token en `.env` no coincide con el de Meta
- Espacios en blanco al inicio/final del token
- El servidor no está leyendo el `.env` correctamente

**Solución:**
```bash
# Verifica que la variable esté cargada
echo $META_WEBHOOK_VERIFY_TOKEN

# O en Node.js
console.log(process.env.META_WEBHOOK_VERIFY_TOKEN);
```

### ❌ Error: "Invalid signature"

**Causas:**
- `META_APP_SECRET` incorrecto
- El body del request fue modificado por un middleware
- Problema con el encoding

**Solución:**
- Verifica que `META_APP_SECRET` sea correcto
- Asegúrate de que `express.json()` esté antes de las rutas

### ❌ No recibo mensajes

**Verifica:**
1. Que te hayas suscrito a los eventos `messages`
2. Que el número de WhatsApp esté correctamente vinculado
3. Que el webhook esté activo en Meta
4. Los logs de tu servidor

---

## 📊 Estructura del Payload que Recibes

### Mensaje de Texto
```json
{
  "object": "whatsapp_business_account",
  "entry": [{
    "id": "123456",
    "changes": [{
      "field": "messages",
      "value": {
        "messaging_product": "whatsapp",
        "metadata": {
          "display_phone_number": "15551234567",
          "phone_number_id": "123456789"
        },
        "contacts": [{
          "profile": { "name": "Juan Pérez" },
          "wa_id": "521234567890"
        }],
        "messages": [{
          "from": "521234567890",
          "id": "wamid.XXX",
          "timestamp": "1707777600",
          "type": "text",
          "text": { "body": "Hola" }
        }]
      }
    }]
  }]
}
```

### Mensaje Interactivo (Botón)
```json
{
  "messages": [{
    "type": "interactive",
    "interactive": {
      "type": "button_reply",
      "button_reply": {
        "id": "btn_1",
        "title": "Sí, acepto"
      }
    }
  }]
}
```

### Estado de Mensaje
```json
{
  "statuses": [{
    "id": "wamid.XXX",
    "status": "read",
    "timestamp": "1707777600",
    "recipient_id": "521234567890"
  }]
}
```

---

## 🎯 Próximos Pasos

Una vez que el webhook esté funcionando:

1. ✅ **Implementar `handleIncomingMessage()`** en `MetaMessageService.ts`
   - Crear/actualizar contactos
   - Crear tickets/conversaciones
   - Guardar mensajes en BD

2. ✅ **Implementar `handleMessageStatus()`**
   - Actualizar estados de mensajes (✓, ✓✓, ✓✓ azul)

3. ✅ **Procesar diferentes tipos de mensajes**
   - Imágenes, videos, documentos
   - Ubicaciones
   - Mensajes de voz

4. ✅ **Implementar respuestas automáticas**
   - Chatbot
   - Mensajes de bienvenida
   - Horarios de atención

---

## 📚 Recursos Adicionales

- [Documentación oficial de Meta WhatsApp Business API](https://developers.facebook.com/docs/whatsapp)
- [Webhooks de WhatsApp](https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks)
- [Tipos de mensajes](https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/components)

---

## ✅ Checklist de Configuración

- [ ] Variables de entorno configuradas (`.env`)
- [ ] Servidor accesible con HTTPS
- [ ] Webhook verificado en Meta
- [ ] Suscrito a eventos `messages` y `message_status`
- [ ] Mensaje de prueba enviado y recibido
- [ ] Logs muestran mensajes procesados
- [ ] Validación HMAC activada (producción)

---

¡Listo! Tu webhook ya está configurado para recibir mensajes de Meta WhatsApp. 🎉
