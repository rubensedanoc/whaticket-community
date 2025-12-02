# 05_flujo_inicio_whatrestaurant

## server.ts

Aca empieza la aplicacion

1. Empieza las sesiones de wpp llamando a StartAllWhatsAppsSessions
2. Deja corriendo los crons de searchForUnSaveMessages y searchExclusivePhones

```mermaid
graph TD
  Server["Server start"]
  InitIO["initIO"]
  StartWbot["StartAllWhatsAppsSessions"]
  Graceful["gracefulShutdown"]
  CRON30["CRON (*/30 * * * *)"]
  ListWA["ListWhatsAppsService"]
  FilterConnected["filter CONNECTED"]
  ForEach["for each whatsapp"]
  GetWbot["getWbot"]
  SearchUnsave["searchForUnSaveMessages"]
  Log["console.log result"]

  CRONHour["CRON (0 * * * *)"]
  SearchExclusive["searchExclusivePhones"]
  UpdateContact["Contact.update -> set isExclusive = true"]

  Server --> InitIO
  Server --> StartWbot
  Server --> Graceful

  CRON30 --> ListWA
  ListWA --> FilterConnected
  FilterConnected --> ForEach
  ForEach --> GetWbot
  GetWbot --> SearchUnsave
  SearchUnsave --> Log

  CRONHour --> SearchExclusive
  SearchExclusive --> UpdateContact
```

--- 

## StartAllWhatsAppsSessions

Basicamente inicializa el cliente de wwebjs con las configuraciones dadas y maneja los cambios de estado del mismo

```mermaid
graph TD
  StartAll[StartAllWhatsAppsSessions]
  ListWA[ListWhatsAppsService]
  ForEach[for each whatsapp]
  StartSession[StartWhatsAppSession]
  UpdateOpening["update whatsapp.status = 'OPENING'"]
  EmitUpdate["emitEvent 'whatsappSession' (update)"]
  InitWbot["initWbot(whatsapp)"]
  WbotInit[Client.initialize]
  QREvent["on 'qr' → update qrcode, status 'qrcode', emitEvent"]
  AuthEvent["on 'authenticated' → log"]
  AuthFail["on 'auth_failure' → set status 'DISCONNECTED', retries++, emitEvent, reject"]
  Ready["on 'ready' → set status 'CONNECTED', emitEvent, add session, sendPresenceAvailable, call searchForUnSaveMessages"]
  SearchUnsave["searchForUnSaveMessages (sync recent messages)"]
  LogResult[console.log result]
  AttachListeners[wbotMessageListener + wbotMonitor attached]
  End[Session started / monitoring attached]

  StartAll --> ListWA
  ListWA --> ForEach
  ForEach --> StartSession
  StartSession --> UpdateOpening
  UpdateOpening --> EmitUpdate
  EmitUpdate --> InitWbot
  InitWbot --> WbotInit
  WbotInit --> QREvent
  WbotInit --> AuthEvent
  WbotInit --> AuthFail
  WbotInit --> Ready
  Ready --> SearchUnsave
  SearchUnsave --> LogResult
  Ready --> AttachListeners
  AttachListeners --> End
```

## searchForUnSaveMessages

Metodo principal de sincronizacion de mensajes, este se ejecuta cuando la conexion se conecta y en un cron cada media hora
OJO: Este se ejecuta cada media hora pq la liberia no es perfecta y a veces se pueden perder un mensaje que otro si no se sicroniza a cada rato

```mermaid
graph TD
  Start[Inicio: searchForUnSaveMessages]
  EmitStart[emitEvent: startSearchForUnSaveMessages]
  GetChats[wbot.getChats]
  FilterChats[Filtrar chats por lastMessage.timestamp > now - interval]
  EvalChats["Evaluar chats (Promise.all)"]
  FetchMsgs[fetchWbotMessagesGraduallyUpToATimestamp]
  FoundMsgs[Si hay mensajes encontrados]
  CheckSaved[Message.findAll -> mensajes ya guardados]
  FilterUnsaved[Filtrar: solo no guardados && isValidMsg]
  HandleMsg["handleMessage(msg) por cada mensaje no guardado"]
  AttachProps[Guardar counts/textos en propiedades del chat]
  Aggregate[Calcular messagesCount]
  EmitEnd[emitEvent: endSearchForUnSaveMessages]
  Return[Retornar response con logs y messagesCount]
  CatchErr[Catch: registrar error en response.error]

  Start --> EmitStart
  EmitStart --> GetChats
  GetChats --> FilterChats
  FilterChats --> EvalChats
  EvalChats --> FetchMsgs
  FetchMsgs --> FoundMsgs
  FoundMsgs --> CheckSaved
  CheckSaved --> FilterUnsaved
  FilterUnsaved --> HandleMsg
  HandleMsg --> AttachProps
  AttachProps --> Aggregate
  Aggregate --> EmitEnd
  EmitEnd --> Return
  EvalChats --> CatchErr
  FetchMsgs --> CatchErr
  CheckSaved --> CatchErr
  HandleMsg --> CatchErr
  CatchErr --> Return
```

## searchForUnSaveMessages

Como se refleja en el diagrama del flujo principal, solo checa en microservice por los contactos que son exclusivos y los actualiza de en la bd de nosotros
