import {
  AutoIncrement,
  Column,
  CreatedAt,
  Default,
  HasMany,
  Model,
  PrimaryKey,
  Table,
  UpdatedAt
} from "sequelize-typescript";
import MessagingCampaignMessage from "./MessagingCampaignMessage";
import MessagingCampaignShipment from "./MessagingCampaignShipment";

@Table
class MessagingCampaign extends Model<MessagingCampaign> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Column
  name: string;

  @Default(0)
  @Column
  timesSent: number;

  @HasMany(() => MessagingCampaignMessage)
  messagingCampaignMessages: MessagingCampaignMessage[];

  @HasMany(() => MessagingCampaignShipment)
  messagingCampaignShipments: MessagingCampaignShipment[];

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default MessagingCampaign;
