# Normalización de números de contacto (prefijo de país)

## 1. Problema

Un mismo cliente quedaba guardado como **dos contactos distintos**: uno con el prefijo de
país (`51987654321`) y otro sin él (`987654321`).

`Contacts.number` es único, así que para la base son dos personas diferentes. Y como
`FindOrCreateTicketService` busca los tickets por `contactId`, la conversación se parte:

- El asesor escribe desde el ticket del contacto **sin** prefijo (ticket 21169).
- El cliente responde y WhatsApp entrega siempre el número **canónico, con prefijo**, que
  corresponde al **otro** contacto.
- Ningún ticket de ese contacto está `open`/`pending` → se crea uno nuevo (21184), sin
  cola y con `userHadContact = false` → **el bot saluda**.

Es la causa confirmada del caso reportado de los tickets **21169 → 21184**: el asesor
escribió desde 21169 y la respuesta del cliente terminó abriendo 21184, donde el bot
respondió automáticamente.

---

## 2. De dónde salían los números sin prefijo

| Origen | Antes | Ahora |
|---|---|---|
| Mensajes entrantes (`CreateOrUpdateContactService`) | Número canónico de WhatsApp, siempre con prefijo | Igual, más un `console.warn` si alguno llega sin prefijo reconocible |
| `POST /contacts` (alta manual) | Resolvía con `getNumberId` solo si la conexión era `whatsapp-web.js`; en Meta no normalizaba nada | Se normaliza siempre primero; la validación contra wbot sigue aplicando solo a `whatsapp-web.js` |
| `POST /contact` (`GetContactService`) | Creaba el contacto con el número **tal cual llegaba** | Normaliza antes de buscar y de crear |
| Tarjetas de contacto (vcard) en `handleMessage` | `CreateContactService` con el número del vcard, casi siempre en formato nacional | Normaliza usando el país de la conexión; si no se puede, no crea el contacto y lo registra en el log |
| `ContactModal` del front | Solo pedía mínimo 8 caracteres | Valida que el número empiece con un código de país de la tabla `Countries` |

Además, `getCountryIdOfNumber` tenía dos errores que también ensuciaban los datos:

- Comparaba contra el código crudo de la tabla, y `Countries.code` guarda `"1-809"` y
  `"1-876"` con guion, así que **República Dominicana y Jamaica nunca calzaban**.
- No miraba el largo: `987654321` empieza con `98`, así que quedaba clasificado como
  **Irán**.

---

## 3. Solución implementada

### 3.1 Normalizador — `backend/src/helpers/NormalizePhoneNumber.ts`

Sin dependencias nuevas: usa la tabla `Countries` más un mapa de **largos válidos del
número nacional** por país (el largo es lo que evita adivinar mal).

Orden de resolución:

1. Limpia todo lo que no sea dígito y quita el prefijo de marcación internacional `00`.
2. ¿El número ya empieza con un código de país **y** el resto tiene un largo válido para
   ese país? → se devuelve tal cual.
3. ¿Empieza con el código de país seguido del `0` del troncal nacional (`593` `0` `99…`)?
   → se descarta ese `0`.
4. ¿Es un número nacional del país por defecto (el de la conexión, o
   `DEFAULT_COUNTRY_CODE`)? → se le antepone el prefijo.
5. Si nada calza → `null`.

```
987654321      + país por defecto 51  ->  51987654321
+51 987 654 321                       ->  51987654321
0987654321     + país por defecto 51  ->  51987654321
5930995650094                         ->  593995650094
3001234567     + país por defecto 51  ->  null   (10 dígitos no es un móvil peruano)
12345                                 ->  null
```

Cubierto por `backend/src/helpers/__tests__/NormalizePhoneNumber.spec.ts` (13 casos).

### 3.2 Resolución con WhatsApp — `ResolveContactNumberService.ts`

El servicio arma el candidato con el normalizador local y, **si la conexión es
`whatsapp-web.js`**, lo confirma contra `wbot.getNumberId()` guardando el número canónico
que devuelve WhatsApp (eso corrige por sí solo casos como el `9` de Argentina o el `1` de
México).

En conexiones **Meta** no hay confirmación posible —la Cloud API no expone nada equivalente
a `getNumberId`— así que vale el resultado local; lo mismo si no hay sesión conectada. Si
ninguna de las dos resuelve, lanza `ERR_CONTACT_NUMBER_WITHOUT_COUNTRY_CODE` y **el
contacto no se crea**.

El país por defecto sale, en este orden, de: el país de la conexión
(`Whatsapps.countryId`) → la variable `DEFAULT_COUNTRY_CODE` → `51`.

### 3.3 Puntos de creación

- `CreateContactService` normaliza siempre antes de crear, y busca el duplicado tanto en
  la forma canónica como en la forma nacional (así avisa `ERR_DUPLICATED_CONTACT` si el
  histórico todavía tiene la variante vieja).
- `GetContactService` y `GetContactByNumberService` normalizan **antes de buscar**, para
  que consultar `987654321` encuentre al contacto `51987654321`.
- `CreateOrUpdateContactService` (mensajes entrantes) **no rechaza** nada: rechazar ahí
  haría perder mensajes. Solo deja un `console.warn` para la auditoría.

---

## 4. Auditar la base actual

```bash
cd backend
npm run contacts:audit                            # reporte en consola
npm run contacts:audit -- --csv > auditoria.csv   # para Excel
```

Reporta contactos sin prefijo válido, cuáles tienen un gemelo canónico y cuántos tickets y
mensajes cuelga cada uno.

Equivalente rápido en SQL, para phpMyAdmin:

```sql
-- Pares duplicados: el mismo número con y sin prefijo
SELECT c1.id   AS id_sin_prefijo,
       c1.number AS numero_sin_prefijo,
       c1.name AS nombre_sin_prefijo,
       c2.id   AS id_canonico,
       c2.number AS numero_canonico,
       c2.name AS nombre_canonico,
       (SELECT COUNT(*) FROM Tickets t WHERE t.contactId = c1.id) AS tickets_sin_prefijo,
       (SELECT COUNT(*) FROM Tickets t WHERE t.contactId = c2.id) AS tickets_canonico
  FROM Contacts c1
  JOIN Countries co
  JOIN Contacts c2 ON c2.number = CONCAT(REPLACE(co.code, '-', ''), c1.number)
 WHERE c1.isGroup = 0
   AND c2.isGroup = 0
   AND c1.id <> c2.id;

-- Contactos sin ningún prefijo de país conocido (aproximado: no valida el largo)
SELECT id, name, number, createdAt
  FROM Contacts c
 WHERE c.isGroup = 0
   AND NOT EXISTS (
     SELECT 1 FROM Countries co
      WHERE c.number LIKE CONCAT(REPLACE(co.code, '-', ''), '%')
   )
 ORDER BY c.createdAt DESC;
```

---

## 5. Fusionar los duplicados existentes

```bash
cd backend
npm run contacts:merge                       # DRY RUN: muestra qué haría, no toca nada
npm run contacts:merge -- --pair=1042:1310   # DRY RUN de un par puntual
npm run contacts:merge -- --pair=1042:1310 --apply
npm run contacts:merge -- --apply            # aplica todos los pares detectados
```

El script descubre en `information_schema` **todas** las columnas que apuntan a `Contacts`
(`contactId`, `participantContactId`, `groupContactId`), las reapunta al contacto canónico
y borra el duplicado. Cada par corre en su propia transacción: si choca contra una clave
única, se revierte ese par, se reporta y sigue con los demás.

> Recomendación: correr primero la auditoría, revisar el CSV, fusionar con `--pair` los
> casos con historial grande y recién después correr el `--apply` general. **Hacer backup
> de la base antes del `--apply`.**

---

## 6. Configuración

| Variable | Default | Para qué |
|---|---|---|
| `DEFAULT_COUNTRY_CODE` | `51` | Prefijo usado cuando la conexión no tiene país asignado |

Los largos nacionales por país están en `NATIONAL_LENGTHS_BY_COUNTRY_CODE`, dentro de
`NormalizePhoneNumber.ts`. Si se agrega un país a la tabla `Countries` conviene agregarlo
también ahí; si no, cae a un rango permisivo de 7 a 11 dígitos.

---

## 7. Límites conocidos

- La validación depende de la tabla `Countries`. Un país que no esté cargado no se puede
  reconocer como prefijo válido.
- Sin librería de numeración (se descartó `libphonenumber-js`), la validación es por largo,
  no por rango real de operadora: un número con el largo correcto pero inexistente pasa la
  normalización local. La confirmación contra WhatsApp es la que filtra esos casos.
- El script de fusión no unifica campos del contacto (nombre, email, país): conserva los
  del contacto canónico. Si el duplicado tenía mejores datos, hay que copiarlos a mano.
- En conexiones Meta la única defensa es la normalización local, porque no hay forma de
  preguntarle a la Cloud API si un número existe.
