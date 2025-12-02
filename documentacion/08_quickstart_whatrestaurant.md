# 08_Quickstart_whatrestaurant

## 1. Descripción general

**Rol dentro del ecosistema:**

Whatrestaurant es el crm de wpp que tenemos en la empresa. Este funciona principalmente con la libreria de wwebjs y fue un fork que se hizo de un repo publico de whaticket (Crm que usabamos antes). Es el servicio principal de la empresa cara a comunicarse con los clientes via wpp.

**Whatrestaurant comercial:**

Contamos con Whatrestaurant general y Whatrestaurant comercial. Esto pq el area comercial necesitaba otra bd y algunos cambios a nivel de frontend. Los 2 se levantan bajo el mismo repo, solo cambiando variable de entorno del .env general REACT_APP_PURPOSE a "comercial". El comercial usa otro dockerfile con otra configuracion de chromiun (Revisar dockerfile para eso) Esto se hizo para poder mandar videos (Limitacion de libreria)

**Producción:**

El proyecto esta deployado con docker en un servidor interno de codero con la ip "68.168.96.29".

**Google Cloud:**

Es importante mencionar los sockets en Whatrestaurant porque este usa socket.io a la mano de un proyecto alado (Revisa la guia de instalacion). Y este proyecto alado esta deployado en google cloud para un escalamiento horizontal.

**Tecnologías principales:**

Para este proyecto deberas tener conocimientos minimaente basicos en:

- Docker + Docker Compose
- Node.js + Express
- Socket.io
- React
- MariaDB
- Docker
- Wwebjs
- Sequealize

---

## 2. Estructura general de carpetas

| Carpeta                      | Propósito                                               |
| ---------------------------- | ------------------------------------------------------- |
| `/backend`                   | Carpeta del backend                                     |
| `/backend/Dockerfile`        | Configuracion del docker para el proyecto general       |
| `/backend/Dockerfile.chrome` | Configuracion del docker para el proyecto comercial     |
| `/frontend`                  | Carpeta del frontend                                    |
| `/openai`                    | Carpeta de recursos de openai. Ejem: fine-tunning.jsonl |

---

## 3. Documentos recomendados para lectura inicial

| Orden | Documento                                      | Propósito                                                                                       |
| ----- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 1     | `02_guia-instalacion_whatrestaurant`           | Instalación y validaciones del entorno local                                                    |
| 2     | `04_modelo_datos_whatrestaurant`               | Explicacion práctica de la bd                                                                   |
| 3     | `05_flujo_inicio_whatrestaurant`               | Entender el flujo de inicio                                                                     |
| 4     | `05_flujo_wbotMessageListener_whatrestaurant`  | Entender el flujo del listener de eventos que dispara la biblioteca wwebjs                      |
| 4     | `05_flujo_handlemessage_whatrestaurant`        | Entender el flujo del metodo principal para procesar mensajes                                   |
| 4     | `05_flujo_findorcreateticket_whatrestaurant`   | Entender el flujo del metodo principal para conseguir un ticket entre un cliente y una conexión |
| 5     | `04_dev_flow_whatrestaurant`                   | Desarrollar nuevas features en el proyecto                                                      |
| 5     | `04_edge_cases_y_mantenimiento_whatrestaurant` | Guia de mantenimiento en donde se abarcan situciones del dia a dia y como resolverlas           |

---

## 🚀 4. Próximos pasos

Cuando tengas tu entorno ejecutándose:

1. Realiza una prueba entrando al frontend:
2. Crea una conexion y conectate:
3. Verifica la sincronizacion:
4. Envia mensaje y ve que los eventos del socket se esten recibiendo y enviando correctamente
5. Leer el manual de desarrollo para desarrollar nuevas features:

---

Última actualización: 25/11/2025 - Abel Quezada Hidalgo
