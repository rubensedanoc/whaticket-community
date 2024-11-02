import {
  Column,
  CreatedAt,
  ForeignKey,
  Model,
  Table,
  UpdatedAt
} from "sequelize-typescript";
import User from "./User";
import Whatsapp from "./Whatsapp";

@Table
class WhatsappOwnerUsers extends Model<WhatsappOwnerUsers> {
  @ForeignKey(() => User)
  @Column
  userId: number;

  @ForeignKey(() => Whatsapp)
  @Column
  whatsappId: number;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default WhatsappOwnerUsers;
