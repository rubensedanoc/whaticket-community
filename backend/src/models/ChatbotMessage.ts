import {
  AutoIncrement,
  BelongsTo,
  Column,
  CreatedAt,
  Default,
  ForeignKey,
  HasMany,
  Model,
  PrimaryKey,
  Table,
  UpdatedAt
} from "sequelize-typescript";

@Table
class ChatbotMessage extends Model<ChatbotMessage> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Column
  identifier: string;

  @Column
  mediaType: string;

  @Column
  mediaUrl: string;

  @Column
  title: string;

  @Column
  value: string;

  @Column
  isActive: boolean;

  @Column
  label: string;

  @Column
  order: number;

  @Default(false)
  @Column
  hasSubOptions: boolean;

  @ForeignKey(() => ChatbotMessage)
  @Column
  fatherChatbotOptionId: number;

  @BelongsTo(() => ChatbotMessage)
  fatherChatbotOption: ChatbotMessage;

  @HasMany(() => ChatbotMessage)
  chatbotOptions: ChatbotMessage[];

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default ChatbotMessage;
