import {
  AutoIncrement,
  BelongsTo,
  BelongsToMany,
  Column,
  CreatedAt,
  Default,
  ForeignKey,
  HasMany,
  Model,
  PrimaryKey,
  Table,
  UpdatedAt
} from "sequelize-typescript";

import Category from "./Category";
import Contact from "./Contact";
import MarketingCampaign from "./MarketingCampaign";
import MarketingMessagingCampaign from "./MarketingMessagingCampaigns";
import MarketingMessagingCampaignShipment from "./MarketingMessagingCampaignShipment";
import Message from "./Message";
import MessagingCampaign from "./MessagingCampaign";
import MessagingCampaignShipment from "./MessagingCampaignShipment";
import Queue from "./Queue";
import TicketCategory from "./TicketCategory";
import TicketHelpUser from "./TicketHelpUser";
import TicketParticipantUsers from "./TicketParticipantUsers";
import User from "./User";
import Whatsapp from "./Whatsapp";
import ConversationIAEvalutaion from "./ConversationIAEvalutaion";
import ConversationIAQuestions from "./ConversationIAQuestions";

@Table
class Ticket extends Model<Ticket> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Column({ defaultValue: "pending" })
  status: string;

  @Column
  unreadMessages: number;

  @Column
  lastMessageTimestamp: number;

  clientTimeWaiting: number;

  @Column
  lastMessage: string;

  @Column
  privateNote: string;

  @Default(false)
  @Column
  isGroup: boolean;

  @Column
  userHadContact: boolean;

  @Column
  wasSentToZapier: boolean;

  @Column
  transferred: boolean;

  @Column
  categorizedByAI: boolean;

  @Column
  beenWaitingSinceTimestamp: number;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @Column
  chatbotMessageIdentifier: string;

  @Column
  chatbotMessageLastStep: string;

  @ForeignKey(() => User)
  @Column
  userId: number;

  @BelongsTo(() => User)
  user: User;

  @ForeignKey(() => MarketingCampaign)
  @Column
  marketingCampaignId: number;

  @BelongsTo(() => MarketingCampaign)
  marketingCampaign: MarketingCampaign;

  @ForeignKey(() => Contact)
  @Column
  contactId: number;

  @BelongsTo(() => Contact)
  contact: Contact;

  @ForeignKey(() => Whatsapp)
  @Column
  whatsappId: number;

  @BelongsTo(() => Whatsapp)
  whatsapp: Whatsapp;

  @ForeignKey(() => Queue)
  @Column
  queueId: number;

  @BelongsTo(() => Queue)
  queue: Queue;

  @HasMany(() => Message)
  messages: Message[];

  @BelongsToMany(() => Category, () => TicketCategory)
  categories: Category[];

  @BelongsToMany(() => User, () => TicketHelpUser)
  helpUsers: User[];

  @BelongsToMany(() => User, () => TicketParticipantUsers)
  participantUsers: User[];

  @ForeignKey(() => MessagingCampaign)
  @Column
  messagingCampaignId: number;

  @BelongsTo(() => MessagingCampaign)
  messagingCampaign: MessagingCampaign;

  @ForeignKey(() => MessagingCampaignShipment)
  @Column
  messagingCampaignShipmentId: number;

  @BelongsTo(() => MessagingCampaignShipment)
  messagingCampaignShipment: MessagingCampaignShipment;

  @ForeignKey(() => MarketingMessagingCampaign)
  @Column
  marketingMessagingCampaignId: number;

  @BelongsTo(() => MarketingMessagingCampaign)
  marketingMessagingCampaign: MarketingMessagingCampaign;

  @ForeignKey(() => MarketingMessagingCampaignShipment)
  @Column
  marketingMessagingCampaignShipmentId: number;

  @BelongsTo(() => MarketingMessagingCampaignShipment)
  marketingMessagingCampaignShipment: MarketingMessagingCampaignShipment;

  @HasMany(() => ConversationIAEvalutaion)
  conversationIAEvalutaions: ConversationIAEvalutaion[];

  @HasMany(() => ConversationIAQuestions)
  conversationIAQuestions: ConversationIAQuestions[];

  // Sobrescribir el método toJSON para incluir clientTimeWaiting
  toJSON() {
    const attributes = { ...this.get() };
    // @ts-ignore
    attributes.clientTimeWaiting = this.clientTimeWaiting;
    return attributes;
  }
}

export default Ticket;
