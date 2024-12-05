import {
  AutoIncrement,
  BelongsTo,
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
import MarketingCampaign from "./MarketingCampaign";
import MarketingCampaignAutomaticMessage from "./MarketingCampaignAutomaticMessage";
import MarketingMessagingCampaignShipment from "./MarketingMessagingCampaignShipment";

@Table
class MarketingMessagingCampaign extends Model<MarketingMessagingCampaign> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Column
  name: string;

  @Default(0)
  @Column
  timesSent: number;

  @ForeignKey(() => MarketingCampaign)
  @Column
  marketingCampaignId: number;

  @BelongsTo(() => MarketingCampaign)
  marketingCampaign: MarketingCampaign;

  @HasMany(() => MarketingCampaignAutomaticMessage)
  marketingCampaignAutomaticMessages: MarketingCampaignAutomaticMessage[];

  @HasMany(() => MarketingMessagingCampaignShipment)
  marketingMessagingCampaignShipments: MarketingMessagingCampaignShipment[];

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default MarketingMessagingCampaign;
