import {
  AutoIncrement,
  Column,
  CreatedAt,
  Model,
  PrimaryKey,
  Table,
  UpdatedAt
} from "sequelize-typescript";

@Table
class LogType extends Model<LogType> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Column
  name: string;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default LogType;
