import {
  Column,
  CreatedAt,
  ForeignKey,
  Model,
  Table,
  UpdatedAt
} from "sequelize-typescript";
import Queue from "./Queue";
import QuickAnswer from "./QuickAnswer";
import Whatsapp from "./Whatsapp";
import Country from "./Country";

@Table
class WhatsappCountry extends Model<WhatsappCountry> {
  @ForeignKey(() => Whatsapp)
  @Column
  whatsappId: number;

  @ForeignKey(() => Country)
  @Column
  countryId: number;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default WhatsappCountry;
