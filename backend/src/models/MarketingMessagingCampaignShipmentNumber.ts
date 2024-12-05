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
import MarketingMessagingCampaignShipment from "./MarketingMessagingCampaignShipment";

@Table
class MarketingMessagingCampaignShipmentNumber extends Model<MarketingMessagingCampaignShipmentNumber> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Column
  number: string;

  @Column
  hadError: boolean;

  @ForeignKey(() => MarketingMessagingCampaignShipment)
  @Column
  marketingMessagingCampaignShipmentId: number;

  @BelongsTo(() => MarketingMessagingCampaignShipment)
  marketingMessagingCampaignShipment: MarketingMessagingCampaignShipment;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default MarketingMessagingCampaignShipmentNumber;
