# 04_edge_cases_y_mantenimiento_whatrestaurant

El proyecto al usar una bilbioteca no oficial para la vinculacion y manipulacion de wpps. Tiene ciertas limitaciones y problemas.

El objetivo de este documento es documentar que casuisticas que pueden aparecer y como abarcarlas.

---

## "La conexión sale conectada pero no me llegan mensajes o no envia mensajes"

En algunos casos la ventanita de wpp web que levanta la libreria internamente se queda pegada, en estos casos, hay 2 cosas que puedes hacer:

1. Hacer un soft rest con "docker-compose down && docker-compose up -d" Esto reiniciara la aplicacion y por ende las conexiones. Pero recuerda que cuando inician las conexiones se hace un proceso de sync, y durante ese procese hay unos minutos 1-3 en donde la gente no puede usarlas.

2. Puedes reiniciar esa conexión unicamente. Entrando a whatrestaurant con las credenciales de administrador. Aparecera un btn de reiniciar, precionalo 1 vez y espera que el btn de qr aparezca de nuevo para escanear. no puedes presionar el btn varias veces pq crearas más 1 qr y esto generara problemas, (se conecta y desconecta). Si esto pasa, aplicar la solución número 1

---

## Ya reiniciamos la app varias veces y "Se desconecta solo al minuto"

Como wpp esta tratando de hacer cambios para que estas librerias dejen de funcionar bien. A veces con determinadas conexiones se ponen especiales con que el navegador sea uno normal y no uno controlado. soluciones:

1. Revisa los argumentos del navegador que se esta levantando para esa conexión. Actualmente hay algunas conexiones que usan pocos argumentos por ese mismo tema, si revisas el codigo de wbot lo veras. Si esa combinacion de argumentos no te sirve, te tocara debuguear localmente con esa conexion hasta que puedas conetarla.

---

## "El servidor esta alto en ram"

Esto es algo que puede pasar y va a ser pq la libreria de wwebjs no recicla memoria ram y se acumula con el tiempo. lo ideal seria tener un cron que reinicia la app cada ciertos dias para evitar esto, pero para que lo tengas en cuenta.

---

## "El servidor tiene poco espacio"

En la carpeta public se guardan todos los archivos de todos los chats. Esto ocupa espacio. Pero tmb hay otra cosa que ocupa mucho espacio y es el forlder de credenciales. Trata de borrrar las carpetas de credenciales que no se usan

---

## Socket.io no funciona o "Mando un mensaje y no se ve hasta que hago f5"

Como sabemos whatrestaurant usa socket.io y lo tiene en otro proyecto aparte. Esto es pq ese otro proyecto esta en google cloud y escala horizontalmente. El tema es que a veces se olvidan de pagar ese servicio y por ente no hay sockets. Si esto pasa comunicate con el area de administracion y para confirmar que este es el caso, hablale a Ruben.

---

## Comportamiento raro en la libreria

Wpp lanza continuamente actualizaciones para wwp web. En estos casos la libreria puede funcionar mal dependiendo de la version que tengas instalado. En estos casos te recomiendo en primera instancia entrar al discord de la liberia, ahi podras preguntar y buscar respuestas del estado actual de la libreria https://wwebjs.dev/
