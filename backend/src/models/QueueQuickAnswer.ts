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

@Table
class QueueQuickAnswer extends Model<QueueQuickAnswer> {
  @ForeignKey(() => Queue)
  @Column
  queueId: number;

  @ForeignKey(() => QuickAnswer)
  @Column
  quickAnswerId: number;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default QueueQuickAnswer;
