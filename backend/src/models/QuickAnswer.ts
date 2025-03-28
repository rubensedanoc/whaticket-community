import {
  AutoIncrement,
  BelongsToMany,
  Column,
  CreatedAt,
  DataType,
  Model,
  PrimaryKey,
  Table,
  UpdatedAt
} from "sequelize-typescript";
import Queue from "./Queue";
import QueueQuickAnswer from "./QueueQuickAnswer";

@Table
class QuickAnswer extends Model<QuickAnswer> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Column(DataType.TEXT)
  shortcut: string;

  @Column(DataType.TEXT)
  message: string;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @BelongsToMany(() => Queue, () => QueueQuickAnswer)
  queues: Array<Queue & { QueueQuickAnswer: QueueQuickAnswer }>;
}

export default QuickAnswer;
