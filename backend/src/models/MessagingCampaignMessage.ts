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
    if (this.getDataValue("mediaUrl")) {
      return `${process.env.BACKEND_URL}:${
        process.env.PROXY_PORT
      }/public/${this.getDataValue("mediaUrl")}`;
    }
    return null;
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
