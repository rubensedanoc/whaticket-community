import {
  AutoIncrement,
  BelongsTo,
  Column,
  CreatedAt,
  ForeignKey,
  Model,
  PrimaryKey,
  Table,
  UpdatedAt
} from "sequelize-typescript";
import Contact from "./Contact";
import LogType from "./LogType";
import MarketingCampaign from "./MarketingCampaign";
import Ticket from "./Ticket";
import User from "./User";
import Whatsapp from "./Whatsapp";

@Table
class Log extends Model<Log> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Column
  startTimestamp: number;

  @Column
  endTimestamp: number;

  @Column
  incomingEndpoint: string;

  @Column
  incomingData: string;

  @Column
  outgoingEndpoint: string;

  @Column
  outgoingData: string;

  @Column
  status: string;

  @Column
  wasOk: boolean;

  @Column
  logs: string;

  @Column
  error: string;

  @ForeignKey(() => User)
  @Column
  userId: number;

  @BelongsTo(() => User)
  user: User;

  @ForeignKey(() => User)
  @Column
  oldUserId: number;

  @BelongsTo(() => User)
  oldUser: User;

  @ForeignKey(() => User)
  @Column
  newUserId: number;

  @BelongsTo(() => User)
  newUser: User;

  @ForeignKey(() => Ticket)
  @Column
  ticketId: number;

  @BelongsTo(() => Ticket)
  ticket: Ticket;

  @ForeignKey(() => Whatsapp)
  @Column
  whatsappId: number;

  @BelongsTo(() => Whatsapp)
  whatsapp: Whatsapp;

  @ForeignKey(() => Contact)
  @Column
  contactId: number;

  @BelongsTo(() => Contact)
  contact: Contact;

  @ForeignKey(() => MarketingCampaign)
  @Column
  marketingCampaignId: number;

  @BelongsTo(() => MarketingCampaign)
  marketingCampaign: MarketingCampaign;

  @ForeignKey(() => LogType)
  @Column
  logTypeId: number;

  @BelongsTo(() => LogType)
  logType: LogType;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default Log;
