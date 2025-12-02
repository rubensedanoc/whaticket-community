# 05_flujo_wbotMessageListener_whatrestaurant

wbotMessageListener es el encargado de recibir y procesar cada uno de los eventos que dispara cada bot iniciado de wwebjs por cada conexión

graph TD
  Start[wbotMessageListener start]
  MessageCreate[event: message_create]
  HandleMsg[handleMessage]
  IgnoreGroupStatus[ignore group/status messages]
  WebhookCheck[freshWpp.webhook?]
  SendWebhook[POST webhook with msg]
  MediaUploaded[event: media_uploaded -> handleMessage]
  GroupUpdate[event: group_update]
  UpdateGroupContact[update group contact name -> emit contact update]
  GroupJoin[event: group_join]
  CreateTicket[new ticket -> emit ticket update]
  MessageEdit[event: message_edit]
  UpdateMessages[find & update messages -> emit appMessage updates -> update ticket lastMessage]
  MessageAck[event: message_ack]
  HandleAck[handleMsgAck -> update message ack -> emit appMessage]
  End[done]

  Start --> MessageCreate
  MessageCreate --> HandleMsg
  MessageCreate --> IgnoreGroupStatus
  IgnoreGroupStatus -->|not group/status and type=chat| WebhookCheck
  WebhookCheck -->|has webhook| SendWebhook
  MessageCreate --> MediaUploaded
  MediaUploaded --> HandleMsg
  Start --> GroupUpdate
  GroupUpdate --> UpdateGroupContact
  Start --> GroupJoin
  GroupJoin --> CreateTicket
  Start --> MessageEdit
  MessageEdit --> UpdateMessages
  Start --> MessageAck
  MessageAck --> HandleAck
  HandleMsg --> End
  UpdateMessages --> End
  CreateTicket --> End
  UpdateGroupContact --> End
  HandleAck --> End