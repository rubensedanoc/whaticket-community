import {
  Column,
  CreatedAt,
  ForeignKey,
  Model,
  Table,
  UpdatedAt
} from "sequelize-typescript";
import MarketingCampaign from "./MarketingCampaign";
import Queue from "./Queue";

@Table
class QueueMarketingCampaign extends Model<QueueMarketingCampaign> {
  @ForeignKey(() => Queue)
  @Column
  queueId: number;

  @ForeignKey(() => MarketingCampaign)
  @Column
  marketingCampaignId: number;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default QueueMarketingCampaign;
