# 05_flujo_findorcreateticket_whatrestaurant

El servicio FindOrCreateTicketService.ts es el servicio encargado de encontrar un ticket entre un contacto y una conexion. Aqui tmb se encuentran las reglas de reapertura de tickets dentro del intervalo de tiempo. Si algun dia tienes algun problema de duplicidad de tickets, podria ser causado desde aqui

graph TD
  Start[FindOrCreateTicketService - start]
  CallFind[call findTicket]
  Found1[Found open/pending ticket?]
  UpdateIfFound[Update unreadMessages & optional fields]
  SetCategories1[Set categories if provided]
  ReturnShow[ShowTicketService -> return ticket]

  NotFound1[No ticket found]
  HasGroup[groupContact present?]
  FindGroup[Ticket.findOne by groupContact]
  FoundGroup[Ticket found for group?]
  UpdateGroup[Update status=open, unreadMessages, lastMessageTimestamp?]
  SetCategories2[Set categories if provided]
  ReturnShow2[ShowTicketService -> return ticket]

  NotFoundGroup[No ticket for group]
  SearchRecent["Search last ticket by contact (latest updated)"]
  FoundRecent[Recent ticket found?]
  CampaignChecks[Check messaging/marketing campaign shipments -> maybe ignore]
  ValidTime[Is ticket.updatedAt >= validTime?]
  UpdateRecent["Update status (pending/open), unreadMessages, update fields"]
  EmitIfReopened[If status changed closed->open emit delete for closed]
  SetCategories3[Set categories if provided]
  ReturnShow3[ShowTicketService -> return ticket]

  CreateTicket["Create new ticket (status: closed|open|pending)"]
  SetCategories4[Set categories if provided]
  ShowAfterCreate[ShowTicketService -> return ticket]
  CreateError[Create error -> wait 200ms -> retry findTicket -> create again]
  FinalReturn[Return ticket]

  End[End]

  Start --> CallFind
  CallFind --> Found1
  Found1 -- yes --> UpdateIfFound
  UpdateIfFound --> SetCategories1
  SetCategories1 --> ReturnShow

  Found1 -- no --> NotFound1
  NotFound1 --> HasGroup
  HasGroup -- yes --> FindGroup
  FindGroup --> FoundGroup
  FoundGroup -- yes --> UpdateGroup
  UpdateGroup --> SetCategories2
  SetCategories2 --> ReturnShow2

  HasGroup -- no --> NotFoundGroup
  NotFoundGroup --> SearchRecent
  SearchRecent --> FoundRecent
  FoundRecent -- yes --> CampaignChecks
  CampaignChecks -->|ignored by campaign mismtach| NotFoundGroup
  CampaignChecks -->|passes| ValidTime
  ValidTime -- no (too old) --> NotFoundGroup
  ValidTime -- yes --> UpdateRecent
  UpdateRecent --> EmitIfReopened
  EmitIfReopened --> SetCategories3
  SetCategories3 --> ReturnShow3

  FoundRecent -- no --> CreateTicket
  CreateTicket --> SetCategories4
  SetCategories4 --> ShowAfterCreate
  ShowAfterCreate --> FinalReturn
  CreateTicket -- error --> CreateError
  CreateError --> SearchRecent

  ReturnShow --> End
  ReturnShow2 --> End
  ReturnShow3 --> End
  FinalReturn --> End