# 05_flujo_handlemessage_whatrestaurant

El metodo handlemessage es el metodo principal y unico para procesar cualquier mensaje. Usado para procesar mensajes que llegan en tiempo real por evento de on_message de la libreria o cuando se sincronizan mensajes pasados

graph TD
  Start[handleMessage - start]
  Valid[isValidMsg?]
  IgnoreBot[Ignore bot / special-char messages]
  GetContact["get contact (from / to)"]
  GetChat[get chat]
  GroupContact[is group? -> verifyContact for group]
  ShowWA[ShowWhatsAppService]
  Unread[determine unreadMessages]
  VerifyContact[verifyContact]
  Farewell[Is farewell message?]
  FarewellHandle[verifyMessage on closed ticket -> return]
  FromSync[isFromSync? -> SearchTicketForAMessageService]
  FindOrCreate[FindOrCreateTicketService]
  HasMedia?[msg.hasMedia?]
  VerifyMedia[verifyMediaMessage]
  VerifyMsg[verifyMessage]
  IntroCandidate[Intro flow? -> verifyQueue or ShowChatbotOption]
  ChatbotOption["ShowChatbotOption -> format message -> send message(s)"]
  SetQueue[no queue && has queues -> UpdateTicketService set first queue]
  VCard["msg.type vcard -> CreateContactService(s)"]
  ChatbotReply[chatbot reply flow -> find next option -> send media/text -> update ticket step]
  Marketing[marketing campaign match? -> send campaign messages -> UpdateTicketService marketingCampaignId]
  Trazabilidad[Send data to trazabilidad -> possibly assign user & open ticket]
  MentionCheck[msg.mentionedIds includes connection lid?]
  MentionNotify[Create group mention notifications -> emitEvent]
  EndReload[ticket.reload and final updates]
  Done[end / return]
  Catch[try/catch errors -> log & Sentry]

  Start --> Valid
  Valid -- no --> Done
  Valid -- yes --> GetContact
  GetContact --> GetChat
  GetChat --> GroupContact
  GroupContact --> ShowWA
  ShowWA --> Unread
  Unread --> VerifyContact
  VerifyContact --> Farewell
  Farewell -- yes --> FarewellHandle
  FarewellHandle --> Done
  Farewell -- no --> FromSync
  FromSync --> FindOrCreate
  FindOrCreate --> HasMedia?
  HasMedia? -- yes --> VerifyMedia
  HasMedia? -- no --> VerifyMsg
  VerifyMsg --> IntroCandidate
  IntroCandidate -- intro && !ticket.queue --> verifyQueue[verifyQueue] 
  IntroCandidate -- intro && ticket.queue --> ChatbotOption
  ChatbotOption --> Done
  verifyQueue --> Done
  FindOrCreate --> SetQueue
  SetQueue --> VCard
  VCard --> Done
  VerifyMsg --> ChatbotReply
  ChatbotReply --> EndReload
  EndReload --> Marketing
  Marketing --> Trazabilidad
  Trazabilidad --> EndReload
  EndReload --> MentionCheck
  MentionCheck -- yes --> MentionNotify
  MentionNotify --> Done
  EndReload --> Done
  AnyError[Error anywhere] --> Catch
  Catch --> Done

  %% Simplified error wiring
  GetContact --> AnyError
  GetChat --> AnyError
  VerifyContact --> AnyError
  FindOrCreate --> AnyError
  VerifyMedia --> AnyError
  VerifyMsg --> AnyError