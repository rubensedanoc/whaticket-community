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

import Ticket from "./Ticket";

@Table
class IncidenciaLog extends Model<IncidenciaLog> {
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
  requestPayload: string;

  @Column
  responsePayload: string;

  @Column
  status: string;

  @Column
  errorMessage: string;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default IncidenciaLog;
