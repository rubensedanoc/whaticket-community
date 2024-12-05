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
import MarketingMessagingCampaign from "./MarketingMessagingCampaigns";
import MarketingMessagingCampaignShipmentNumber from "./MarketingMessagingCampaignShipmentNumber";
import User from "./User";
import Whatsapp from "./Whatsapp";

@Table
class MarketingMessagingCampaignShipment extends Model<MarketingMessagingCampaignShipment> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Column
  startTimestamp: number;

  @Column
  endTimestamp: number;

  @Column
  status: string;

  @Column
  get excelUrl(): string | null {
    if (this.getDataValue("excelUrl")) {
      return `${process.env.BACKEND_URL}:${
        process.env.PROXY_PORT
      }/public/${this.getDataValue("excelUrl")}`;
    }
    return null;
  }

  @ForeignKey(() => User)
  @Column
  userId: number;

  @BelongsTo(() => User)
  user: User;

  @ForeignKey(() => Whatsapp)
  @Column
  whatsappId: number;

  @BelongsTo(() => Whatsapp)
  whatsapp: Whatsapp;

  @ForeignKey(() => MarketingMessagingCampaign)
  @Column
  marketingMessagingCampaignId: number;

  @BelongsTo(() => MarketingMessagingCampaign)
  marketingMessagingCampaign: MarketingMessagingCampaign;

  @HasMany(() => MarketingMessagingCampaignShipmentNumber)
  marketingMessagingCampaignShipmentNumbers: MarketingMessagingCampaignShipmentNumber[];

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default MarketingMessagingCampaignShipment;
