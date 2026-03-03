import {
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
import MarketingCampaign from "./MarketingCampaign";
import MarketingMessagingCampaign from "./MarketingMessagingCampaigns";

@Table
class MarketingCampaignAutomaticMessage extends Model<MarketingCampaignAutomaticMessage> {
  @PrimaryKey
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

  @ForeignKey(() => MarketingCampaign)
  @Column
  marketingCampaignId: number;

  @BelongsTo(() => MarketingCampaign)
  marketingCampaign: MarketingCampaign;

  @ForeignKey(() => MarketingMessagingCampaign)
  @Column
  marketingMessagingCampaignId: number;

  @BelongsTo(() => MarketingMessagingCampaign)
  marketingMessagingCampaign: MarketingMessagingCampaign;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default MarketingCampaignAutomaticMessage;
