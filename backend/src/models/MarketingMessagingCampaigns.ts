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
import MarketingCampaign from "./MarketingCampaign";
import MarketingCampaignAutomaticMessage from "./MarketingCampaignAutomaticMessage";

@Table
class MarketingMessagingCampaign extends Model<MarketingMessagingCampaign> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Column
  name: string;

  @Column
  timesSent: number;

  @ForeignKey(() => MarketingCampaign)
  @Column
  marketingCampaignId: number;

  @BelongsTo(() => MarketingCampaign)
  marketingCampaign: MarketingCampaign;

  @HasMany(() => MarketingCampaignAutomaticMessage)
  marketingCampaignAutomaticMessages: MarketingCampaignAutomaticMessage[];

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default MarketingMessagingCampaign;
