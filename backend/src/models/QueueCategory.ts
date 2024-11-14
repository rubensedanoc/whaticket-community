import {
  BelongsTo,
  Column,
  CreatedAt,
  ForeignKey,
  Model,
  Table,
  UpdatedAt
} from "sequelize-typescript";
import Category from "./Category";
import Queue from "./Queue";

@Table
class QueueCategory extends Model<QueueCategory> {
  @ForeignKey(() => Queue)
  @Column
  queueId: number;

  @ForeignKey(() => Category)
  @Column
  categoryId: number;

  @BelongsTo(() => Category)
  category: Category;

  @Column
  descriptionForAICategorization: string;

  @Column
  processOrder: number;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default QueueCategory;
