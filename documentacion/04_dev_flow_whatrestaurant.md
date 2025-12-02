# 04_dev_flow_whatrestaurant

Una vez teniendo levantado el entorno de desarrollo, para hacer nuevos desarrollos debes de tener en cuenta estas casuisticas.

### Consideraciones generales

- El proyecto esta deployado al dia de hoy en el server con ip 68.168.96.29
- Personas que pueden deployar: Ruben, Joan y Cotos
- Personas que pueden ayudarte con alguna consulta de logica de negocio: Cotos
- Personas que pueden ayudarte con una duda tecnica relacionada al deploy a prod: Ruben

---

## Flujo comun de desarrollo

- Considerando que tienes levantado el front localmente sin docker, este cada vez que guardes un archivo, va a volver compilar el font automaticamente
- El backend local + tu bd local, levantados con docker, para que el backend tome tus cambios, debes de volver a hacer build del contenedor con docker-compose up -d --build
- En caso que todo este bien, sube tus cambios a la rama master del repo y deploya con docker-compose up -d --build

---

## Comandos utiles

Estos comandos te seran utiles, tanto en el contenedor como en tu local

| Acción                                                                                                | Comando                                                              |
| ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Ver contenedores activos                                                                              | `docker ps`                                                          |
| Logs del contenedor de backend                                                                        | `docker compose logs -f --tail 100 app`                              |
| Logs del contenedor de Mysql                                                                          | `docker compose logs -f --tail 100 mysql`                            |
| Entrar a la Shell del contenedor de backend                                                           | `docker compose exec app sh`                                         |
| Reinicio suave de los contenedores (usa las imagenes que ya tiene) (no toma en cuenta camvios nuevos) | `docker compose down -v && docker compose up -d`                     |
| Reinicio duro (construye nuevas imagenes) (tomara en cuenta todos cambios nuevos)                     | `docker compose down -v && docker compose up -d --build`             |
| Detener todos los contenedores                                                                        | `docker compose down`                                                |
| construye nuevas imagenes sin tener downtime (toma todos los cambios nuevos, excepto los del .env)    | `docker compose up -d --build`                                       |
| Generar una nueva migracion de sequealize                                                             | `npx sequelize-cli migration:generate --name nombre-de-la-migracion` |

---

## Casuisticas durante el desarrollo

### Cambios en la bd

El sistema trabaja con **sequelize v5**, dado eso tenemos que seguir la el flujo de trabajo del mismo

**Generar una migracion:**

Para generar una migracion primero

1. Tenemos que tener nuestra terminal ubicada en la carpeta de /backend (Necesitas tener instaladas las dependencias del backend localmente, no en docker)
2. Corremos el comando npx sequelize-cli migration:generate --name nombre-de-la-migracion. Estos nos va a generar un archivo en la carpeta backend/dist/database/migrations/
3. Copiamos el archivo generado y lo pasamos a backend/dist/database/migrations/ y cambiamos el archivo de .js a .ts
4. Ahi podemos editar nuestra migracion para crear columnas o tablas
5. podemos darle localmente docker-compose up -d --build para que el contendor del backend detecte los cambios y corra las migraciones contra la bd (Revisar el dockerfile para más detalle sobre que comandos corre)
6. En caso hayamos creado una tabla nueva tenemos que crearle su clase respectiva en /backend/src/models en donde pondermos las columnas de la nueva tabla. IMPORTANTE: Luego tenemos que agregar la clase a /backend/src/database/index.ts
7. En caso hayamos creado una nueva columna, solo modificar su clase/modelo y agregarla
8. Revisar los cambios conjuntos pushear a github y ejecutar comando para subir cambios en el servidor

### Cambios para la version comercial

Hay 2 versiones del proyecto y si nos piden un cambio para una, a nivel de front. Tenemos que cambiar la variable del .env REACT_APP_PURPOSE a "comercial". y volver a levantar el front para que haga efecto

En caso el cambio sea para backend, puedes hacer el if utilizando la variable que le llega al contendor del backend APP_PURPOSE (Consume el mismo valor que REACT_APP_PURPOSE) (Revisar docker-compose)

En caso de agregar nuevas columnas o tablas para una version, ahi no tienes que hacer ninguna validaciona, ambas bds deben de tener y ejecutar las mismas migraciones

---

## Servicios criticos

Servicios o carpetas criticas las cuales probar bien **si fueron manipuladas durante el desarrollo**. **Un mal funcionamiento** de estos puede desencadenar en un **error grave a nivel de produccion**, afectando la comunicacion cara al cliente

- wbot.ts
- ListTicketsService.ts
- /WbotServices

## Validaciones antes de subir a producción

### wwebjs

Puede pasar que desde la ultima subida de cambios a produccion wpp web se haya actualizado y debas de subir de version a la libreria. En caso pase esto, subas de version y sigas presentando errores, deberas de consultar en el discord de la libreria.

Si has movida algo referente a la liberia, asegurarse que la conexion y reconexion siga estando ok

IMPORTANTE: Ten cuidado con la carpeta que genera wwebjs ".wwebjs*auth", esta carpeta tanto como en produccion como en tu local, se genera para guardar las credenciales de que genera wwps para mantenerte logueado. \_El proyecto comercial por usar otro navegador que el del general, genera otro tipo de credenciales*, si haces que alguno de los proyectos use un navegador puede haber conflicto ahi de credenciales y puedes desloguear a todos. En resumen: Nunca hagas que el backend del general use el dockerfile del comercial, ni viceversa, sin considerar que posiblemente vas a desloguear a todas las conexiones
