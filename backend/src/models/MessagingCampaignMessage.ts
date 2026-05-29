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
import { getStoragePublicUrl } from "../services/StorageService";
import MessagingCampaign from "./MessagingCampaign";

@Table
class MessagingCampaignMessage extends Model<MessagingCampaignMessage> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Column
  order: number;

  @Column
  body: string;

  @Column
  mediaType: string;

  @Column
  get mediaUrl(): string | null {
    return getStoragePublicUrl(this.getDataValue("mediaUrl"));
  }

  @ForeignKey(() => MessagingCampaign)
  @Column
  messagingCampaignId: number;

  @BelongsTo(() => MessagingCampaign)
  messagingCampaign: MessagingCampaign;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default MessagingCampaignMessage;
