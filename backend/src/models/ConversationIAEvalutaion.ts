import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  PrimaryKey,
  AutoIncrement,
  ForeignKey,
  BelongsTo
} from "sequelize-typescript";
import Ticket from "./Ticket";

@Table({ tableName: "ConversationIAEvalutaions" })
class ConversationIAEvalutaion extends Model<ConversationIAEvalutaion> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Ticket)
  @Column
  ticketId: number;

  @BelongsTo(() => Ticket)
  ticket: Ticket;

  @Column
  evaluationType: string;

  @Column
  resultOne: string;

  @Column
  resultTwo: string;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default ConversationIAEvalutaion;
