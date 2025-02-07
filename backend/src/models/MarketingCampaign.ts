import {
  AutoIncrement,
  Column,
  CreatedAt,
  HasMany,
  Model,
  PrimaryKey,
  Table,
  UpdatedAt
} from "sequelize-typescript";
import MarketingCampaignAutomaticMessage from "./MarketingCampaignAutomaticMessage";
import MarketingMessagingCampaign from "./MarketingMessagingCampaigns";

@Table
class MarketingCampaign extends Model<MarketingCampaign> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Column
  name: string;

  @Column
  isActive: boolean;

  @Column
  isDefault: boolean;

  @Column
  keywords: string;

  @HasMany(() => MarketingCampaignAutomaticMessage)
  marketingCampaignAutomaticMessages: MarketingCampaignAutomaticMessage[];

  @HasMany(() => MarketingMessagingCampaign)
  marketingMessagingCampaigns: MarketingMessagingCampaign[];

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default MarketingCampaign;
