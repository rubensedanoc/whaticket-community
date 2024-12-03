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
import MessagingCampaignShipment from "./MessagingCampaignShipment";

@Table
class MessagingCampaignShipmentNumber extends Model<MessagingCampaignShipmentNumber> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Column
  number: string;

  @Column
  hadError: boolean;

  @ForeignKey(() => MessagingCampaignShipment)
  @Column
  messagingCampaignShipmentId: number;

  @BelongsTo(() => MessagingCampaignShipment)
  messagingCampaignShipment: MessagingCampaignShipment;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default MessagingCampaignShipmentNumber;
