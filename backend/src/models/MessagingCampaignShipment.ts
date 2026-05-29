import {
  AutoIncrement,
  BelongsTo,
  Column,
  CreatedAt,
  ForeignKey,
  HasMany,
  Model,
  PrimaryKey,
  Table,
  UpdatedAt
} from "sequelize-typescript";
import { getStoragePublicUrl } from "../services/StorageService";
import MessagingCampaign from "./MessagingCampaign";
import MessagingCampaignShipmentNumber from "./MessagingCampaignShipmentNumber";
import User from "./User";
import Whatsapp from "./Whatsapp";

@Table
class MessagingCampaignShipment extends Model<MessagingCampaignShipment> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Column
  startTimestamp: number;

  @Column
  endTimestamp: number;

  @Column
  status: string;

  @Column
  get excelUrl(): string | null {
    return getStoragePublicUrl(this.getDataValue("excelUrl"));
  }

  @ForeignKey(() => User)
  @Column
  userId: number;

  @BelongsTo(() => User)
  user: User;

  @ForeignKey(() => Whatsapp)
  @Column
  whatsappId: number;

  @BelongsTo(() => Whatsapp)
  whatsapp: Whatsapp;

  @ForeignKey(() => MessagingCampaign)
  @Column
  messagingCampaignId: number;

  @BelongsTo(() => MessagingCampaign)
  messagingCampaign: MessagingCampaign;

  @HasMany(() => MessagingCampaignShipmentNumber)
  messagingCampaignShipmentNumbers: MessagingCampaignShipmentNumber[];

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default MessagingCampaignShipment;
