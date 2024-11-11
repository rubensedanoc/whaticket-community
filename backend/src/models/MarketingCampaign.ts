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
  keywords: string;

  @HasMany(() => MarketingCampaignAutomaticMessage)
  marketingCampaignAutomaticMessages: MarketingCampaignAutomaticMessage[];

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default MarketingCampaign;
