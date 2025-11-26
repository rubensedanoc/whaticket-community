# 02_guia-instalacion_whatrestaurant

> **Fecha**: 13 de noviembre de 2025  
> **Repositorio del proyecto**: https://github.com/rubensedanoc/whaticket-community > **Stack**: Node.js 20 + Expres + Sequealize 5 + React + Socket.io + Docker + Docker Compose + mysql (10.6)

---

## Requisitos del Sistema

### Hardware Mínimo

- **RAM**: 8GB mínimo, 16GB recomendado
- **Disco**: 15GB de espacio libre
- **SO**: Windows 10/11 (recomendado con WSL2), macOS 12+, Ubuntu 20.04+

### Software Requerido

- **Git**: Para control de versiones
- **Docker Desktop**: Versión 24 o superior
- **Docker Compose v2**: Incluido en Docker Desktop
- **Visual Studio Code**: Editor recomendado
- **Node.js 20 LTS** _(solo necesario si se desea ejecutar sin Docker)_

---

## PASO 1: Instalar y Configurar Docker en Windows (WSL2)

### 1. Verificar Virtualización

- Abrir **Administrador de tareas → Rendimiento → Virtualización**
- Debe decir: **Habilitada**
- Si aparece “Deshabilitada”, activar en BIOS/UEFI

### 2. Habilitar WSL2

Ejecutar **PowerShell como Administrador**:

```powershell
wsl --install
wsl --set-default-version 2
# Si ya lo tienes:
wsl --update
wsl --shutdown
```

### 3. Instalar Docker Desktop

- Descargar desde: [https://www.docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop)
- Marcar las opciones:
  - ✅ **Use WSL 2 instead of Hyper-V**
  - ✅ **Add required Windows components for WSL 2**
- Reiniciar el equipo si lo solicita.

### 4. Integrar Docker con WSL

- Abrir **Docker Desktop → Settings → Resources → WSL integration**
- Activar:
  - ✅ _Enable integration with my default WSL distro_
  - ✅ Marcar la distro usada (por ejemplo _Ubuntu_)

### 5. Verificar Instalación

```powershell
docker --version
docker compose version
docker run --rm hello-world
```

---

## PASO 2: Crear Carpeta Base de Proyectos

```powershell
cd C:\
mkdir -p C:\proyectos\restaurant
cd C:\proyectos\restaurant
```

> Carpeta sugerida, no es determiante.

---

## PASO 3: Clonar el Repositorio principal y el de websockets

```powershell
git clone https://github.com/rubensedanoc/whaticket-community.git
git clone https://github.com/rubensedanoc/websockets.git
cd whaticket-community
```

### Estructura esperada

```
whaticket-community/
├── backend/
  ├── src/
  ├── Dockerfile
  ├── Dockerfile.chrome
  ├── package.json
├── frontend/
  ├── src/
  ├── Dockerfile
  ├── package.json
├── docker-compose.yml
└── ...
```

---

## PASO 4: Crear Archivo de Entorno

Descargar el archivo `.env` de la carpeta **`/recursos`**, configuralo y pegalo en la raiz del proyecto:
Si vas a levantar el front de manera local y no en docker, tmb crea un archivo .env en el folder /frontend

📁 `.\09_recursos\.env`

> 🔹 Dentro de Docker, el host de mysql es `mysql`, no `localhost`.

---

## PASO 5: Levantar el Proyecto con Docker

```powershell
docker compose up -d --build (Recomiendo comentar el front en el docker-compose.yaml y levantar ese servicio localmente cuando estes desarrollando)
```

- Construye la imagen del backend (`backend`)
- Levanta mysql (`mysql`)
- Levanta phpmyadmin (`phpmyadmin`)

- si levantas el frontend (`frontend`) localmente instalar dependencias del front con npm install usando node 20

### Proyecto de websockets

````powershell
cd websockets

```powershell
npm install
````

```powershell
npm run start
```

- para este proyecto de websockets se condiera que tengas un proveedor de redis externo al proyecto, lo configuraras al momento de crear el redisClient

---

## PASO 6: Verificar Funcionamiento

### Verificar que se levantaron los servicios

```powershell
docker compose stats
```

### Ver Logs

```powershell
docker compose logs backend -f --tail 100
```

✅ Si ves todos levantados y en los logs del backend puedes optienes el mensaje de 'Server started on port: ...' el entorno está correctamente configurado.

---

## PASO 7: Comandos Útiles

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

> Cuando quieras subir cambios a produccion ingresa al servidor y has la accion de subir cambios sin reinicio, unicamente si estos cambios no involucran cambios en los dockerfile o en los .envs, para más informacion pregunar a una IA

---

## PASO 8: Configurar Visual Studio Code

### Extensiones Recomendadas

1. **Docker** (Microsoft)
2. **GitLens** (Git insights y blame)
3. **ESLint** y **Prettier** (formato y linting)
4. **MongoDB for VS Code**
5. **REST Client** o **Thunder Client**
6. **dotenv** (resaltado de variables)
7. **Error Lens**
8. **EditorConfig**

### Configuración sugerida `.vscode/settings.json`

```json
{
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit",
    "source.organizeImports": "explicit"
  }
}
```

---

## PASO 9: Checklist de Instalación

- [ ] Docker Desktop está **en ejecución**
- [ ] `.env` creado dentro de la raiz del proyecto
- [ ] comentar el servicio de front en el docker-compose.yaml y `docker compose up -d --build` ejecutado sin errores
- [ ] levantar el proyecto de websockets
- [ ] Logs del backend, mysql y proyecto de websockets sin errores

---

## Solución de Problemas Comunes

### Error: Docker daemon not running

- Abre **Docker Desktop** y espera que muestre _Docker is running_.
- Si persiste, ejecuta:

```powershell
wsl --update
wsl --shutdown
```

y reinicia Docker Desktop.

---

## Soporte y Contacto

1. **Ver logs**: `docker compose logs -f backend`
2. **Limpiar instalación**:
   ```bash
   docker compose down -v && docker compose up -d --build
   ```
3. **Revisar documentación técnica**: carpeta `/docs/` del proyecto

---

**¡Proyecto listo para desarrollo y pruebas!** 🎉

---

**Última actualización**: 13 de noviembre de 2025  
**Estado**: Documentación actualizada y funcional
