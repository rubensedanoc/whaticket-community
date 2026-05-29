# Configuración de Plantillas de Meta API para Ventana de 24 Horas

## Problema

Meta WhatsApp Business API tiene restricciones estrictas sobre cuándo puedes enviar mensajes:

### Política de Conversaciones de Meta

**Puedes enviar mensajes de texto libre SOLO si:**
- El cliente te ha escrito en las últimas 24 horas

**DEBES usar plantillas aprobadas si:**
- El cliente nunca te ha escrito (cliente nuevo)
- Han pasado más de 24 horas desde el último mensaje del cliente
- Quieres iniciar una conversación con un contacto

Esta es la **ventana de conversación de 24 horas** de Meta.

## Solución Implementada

El sistema ahora valida automáticamente la ventana de 24 horas antes de enviar mensajes y usa plantillas cuando es necesario.

### Flujo Automático

1. **Validación**: Antes de enviar un mensaje, el sistema verifica:
   - Si el cliente ha enviado algún mensaje previamente
   - Si han pasado más de 24 horas desde el último mensaje del cliente

2. **Ventana Activa (< 24h)**: Se envía el mensaje normalmente

3. **Ventana Cerrada o Cliente Nuevo**: Se envía una **plantilla aprobada** que incluye el mensaje del agente como parámetro variable
   - Cliente nuevo sin mensajes previos → Plantilla
   - Más de 24 horas desde último mensaje → Plantilla

## Configuración Requerida

### 1. Crear Plantillas en Meta Business Manager

Necesitas crear **DOS plantillas** diferentes:

#### A. Plantilla de Conversación Inicial (Clientes Nuevos)

1. Ve a [Meta Business Manager](https://business.facebook.com/)
2. Navega a **WhatsApp Manager** → **Message Templates**
3. Haz clic en **Create Template**
4. Configura la plantilla:

**Nombre de la plantilla**: `initial_conversation`

**Categoría**: `UTILITY` (para mensajes de servicio)

**Idioma**: `Spanish (es)`

**Contenido sugerido**:

```
Header (opcional): 
Nuevo mensaje

Body:
Estimado/a, le contactamos desde [Nombre de tu empresa]. {{1}}

Footer (opcional):
Gracias por su atención
```

**Variables**:
- `{{1}}` = El mensaje que el agente quiere enviar

5. **Envía la plantilla para aprobación**

#### B. Plantilla de Reengagement (Ventana Expirada)

1. Crea otra plantilla con **Create Template**
2. Configura:

**Nombre de la plantilla**: `reengagement_message`

**Categoría**: `UTILITY` (para mensajes de servicio)

**Idioma**: `Spanish (es)`

**Contenido sugerido**:

```
Header (opcional): 
Respuesta a tu consulta

Body:
Estimado/a, le ofrecemos nuestras disculpas por la demora en nuestra respuesta. Debido al tiempo transcurrido desde el último contacto, retomamos la conversación para atender su solicitud: {{1}}

Footer (opcional):
Si necesita información adicional, estaremos atentos para ayudarle.
```

**Variables**:
- `{{1}}` = El mensaje que el agente quiere enviar

3. **Envía la plantilla para aprobación** (Meta tarda 24-48 horas en aprobar)

### 2. Configurar Variables de Entorno

Agrega en tu archivo `.env`:

```bash
# Nombre de la plantilla para conversaciones iniciales (clientes nuevos)
META_INITIAL_TEMPLATE_NAME=initial_conversation

# Nombre de la plantilla de reengagement (ventana expirada)
META_REENGAGEMENT_TEMPLATE_NAME=reengagement_message
```

**Valores por defecto:**
- Si no configuras `META_INITIAL_TEMPLATE_NAME`, usará `initial_conversation`
- Si no configuras `META_REENGAGEMENT_TEMPLATE_NAME`, usará `reengagement_message`

### 3. Verificar Plantilla Aprobada

Una vez aprobada la plantilla en Meta:
1. Ve a **Message Templates** en Meta Business Manager
2. Verifica que el estado sea **APPROVED**
3. Copia el nombre exacto de la plantilla
4. Actualiza `META_REENGAGEMENT_TEMPLATE_NAME` si es diferente

## Ejemplo de Uso

### Escenario 1: Ventana Activa (< 24 horas)

```
Cliente escribió hace 2 horas
→ Sistema envía mensaje normal: "Hola, ¿en qué puedo ayudarte?"
→ ✅ Mensaje entregado
```

### Escenario 2: Ventana Cerrada (> 24 horas)

```
Cliente escribió hace 30 horas
Agente escribe: "Hola, ¿en qué puedo ayudarte?"

→ Sistema detecta ventana cerrada
→ Sistema envía plantilla con mensaje incluido
→ Cliente recibe: "Estimado/a, le ofrecemos nuestras disculpas por la demora... Hola, ¿en qué puedo ayudarte?"
→ ✅ Conversación reabierta con un solo mensaje
```

### Escenario 3: Cliente Nuevo (Sin mensajes previos)

```
Agente quiere contactar a un cliente nuevo
Agente escribe: "Hola, le contactamos para informarle sobre su pedido #123"

→ Sistema detecta que no hay mensajes previos del cliente
→ Sistema envía plantilla de BIENVENIDA (initial_conversation)
→ Cliente recibe: "Estimado/a, le contactamos desde [Empresa]. Hola, le contactamos para informarle sobre su pedido #123"
→ ✅ Conversación iniciada correctamente con plantilla apropiada
```

## Logs del Sistema

El sistema registra información detallada en los logs:

**Cliente con ventana expirada:**
```
[CheckMetaConversationWindow] Ticket 123: 24-hour window expired (30.5 hours)
[SendWhatsAppMessageMeta] Ventana de 24 horas activa: false
[SendWhatsAppMessageMeta] ⚠️ Ventana cerrada, enviando plantilla para reabrir conversación
[SendWhatsAppMessageMeta] ✅ Plantilla enviada con mensaje incluido
```

**Cliente nuevo sin mensajes:**
```
[CheckMetaConversationWindow] Ticket 456: Conversación inicial - Se requiere plantilla de bienvenida
[SendWhatsAppMessageMeta] Estado de ventana: { isOpen: false, type: 'new_conversation' }
[SendWhatsAppMessageMeta] ⚠️ Conversación inicial, enviando plantilla de bienvenida
[SendWhatsAppMessageMeta] ✅ Plantilla initial_conversation enviada con mensaje incluido
```

## Personalización de Plantillas

### Plantilla con Mensaje del Agente (Por Defecto)

La implementación actual incluye el mensaje del agente como `{{1}}`:

```
Estimado cliente, disculpe la demora en nuestra respuesta. {{1}}
```

### Plantilla con Múltiples Parámetros

Si necesitas personalizar más la plantilla:

```typescript
// En SendWhatsAppMessageMeta.ts, modifica:
result = await client.sendTemplate({
  to: cleanNumber,
  templateName: templateName,
  languageCode: "es",
  bodyParameters: [
    ticket.contact.name || "Cliente",  // {{1}}
    bodyFormated                        // {{2}}
  ]
});
```

**Plantilla en Meta**:
```
Hola {{1}}, disculpe la demora. {{2}}
```

### Plantilla con Header de Imagen

```typescript
result = await client.sendTemplate({
  to: cleanNumber,
  templateName: "reengagement_with_image",
  languageCode: "es",
  headerParameters: [{
    type: "image",
    image: {
      link: "https://tu-dominio.com/logo.png"
    }
  }],
  bodyParameters: [bodyFormated]
});
```

## Restricciones Importantes de Meta

### Parámetros de Plantillas

Meta tiene **restricciones estrictas** sobre el contenido de los parámetros `{{1}}`, `{{2}}`, etc:

❌ **NO permitido:**
- Saltos de línea (`\n`)
- Tabulaciones (`\t`)
- Más de 4 espacios consecutivos

✅ **Solución automática:**
El sistema limpia automáticamente el mensaje del agente antes de enviarlo:
- Saltos de línea → Espacios simples
- Tabs → Espacios simples
- 4+ espacios → 3 espacios máximo

**Ejemplo:**
```
Mensaje del agente:
"Hola,
Tenemos su pedido    listo"

Se envía como:
"Hola, Tenemos su pedido   listo"
```

Si necesitas enviar mensajes con formato complejo (múltiples líneas), debes:
1. Esperar a que el cliente responda (ventana activa)
2. O crear una plantilla con el texto completo pre-formateado (sin usar parámetros variables)

## Troubleshooting

### Error: Template not found

**Causa**: La plantilla no existe o el nombre está mal escrito

**Solución**: 
1. Verifica el nombre exacto en Meta Business Manager
2. Actualiza `META_REENGAGEMENT_TEMPLATE_NAME` en `.env`

### Error: Template not approved

**Causa**: La plantilla aún no ha sido aprobada por Meta

**Solución**: 
1. Espera la aprobación (24-48 horas)
2. Verifica el estado en Meta Business Manager

### Error: #132018 - Param text cannot have new-line/tab characters

**Causa**: El mensaje del agente contiene saltos de línea, tabs o muchos espacios

**Solución**: 
- El sistema ahora limpia automáticamente estos caracteres
- Si el error persiste, revisa que no estés usando caracteres especiales
- Considera simplificar el mensaje o esperar a que el cliente responda

### Mensaje sigue fallando después de 24 horas

**Causa**: La plantilla puede tener errores o no está configurada correctamente

**Solución**:
1. Revisa los logs del webhook para ver el error específico
2. Verifica que la plantilla tenga el número correcto de parámetros
3. Asegúrate de que el idioma coincida (`es` para español)
4. Verifica que el mensaje no contenga caracteres especiales no permitidos

## Casos de Uso Comunes

### 1. Contactar Cliente Nuevo
Si necesitas contactar a un cliente que nunca te ha escrito:
- El sistema automáticamente usará la **plantilla de bienvenida** (`initial_conversation`)
- El mensaje del agente se incluirá en `{{1}}`
- Apropiada para primeros contactos, confirmaciones de pedidos, etc.

### 2. Seguimiento Después de 24h
Si un cliente te escribió hace más de 24 horas:
- El sistema detecta la ventana cerrada
- Envía la **plantilla de reengagement** (`reengagement_message`)
- Apropiada para retomar conversaciones existentes

### 3. Campañas de Marketing
Para enviar mensajes masivos a clientes:
- Clientes nuevos recibirán plantilla de bienvenida
- Clientes existentes recibirán plantilla de reengagement
- Considera crear plantillas específicas para campañas (ej: `campaign_promo`)
- Revisa los costos de plantillas en Meta

### 4. Diferencia entre Plantillas

| Escenario | Plantilla Usada | Cuándo |
|-----------|----------------|--------|
| Cliente nuevo sin mensajes | `initial_conversation` | Primera vez que contactas al cliente |
| Cliente con ventana expirada | `reengagement_message` | Cliente te escribió antes pero hace > 24h |
| Cliente activo (< 24h) | Ninguna (mensaje normal) | Cliente te escribió recientemente |

## Mejores Prácticas

1. **Crea múltiples plantillas** para diferentes escenarios (soporte, ventas, recordatorios, bienvenida)
2. **Usa nombres descriptivos** para las plantillas
3. **Mantén las plantillas simples** - Meta rechaza plantillas muy promocionales
4. **Prueba las plantillas** antes de usarlas en producción
5. **Monitorea los logs** para detectar problemas temprano
6. **Responde rápido** - Aprovecha la ventana de 24h para evitar usar plantillas constantemente

## Costos

- **Mensajes dentro de 24h**: Gratis (conversación iniciada por usuario)
- **Plantillas (fuera de 24h)**: Cobradas según categoría y país
- Revisa los precios en [Meta Pricing](https://developers.facebook.com/docs/whatsapp/pricing)

## Referencias

- [Meta Templates Documentation](https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates)
- [Template Components](https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates/components)
- [24-hour Window Policy](https://developers.facebook.com/docs/whatsapp/pricing#conversations)
