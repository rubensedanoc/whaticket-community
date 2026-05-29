import {
  Table,
  Column,
  Model,
  PrimaryKey,
  AutoIncrement,
  ForeignKey,
  BelongsTo,
  CreatedAt,
  UpdatedAt,
  DataType,
  Default
} from "sequelize-typescript";
import Whatsapp from "./Whatsapp";
import Ticket from "./Ticket";

export interface UserInteraction {
  step: string;
  stepIdentifier: string;
  userResponse: string;
  optionValue: string;
  timestamp: string;
}

@Table
class ProactiveBotSession extends Model<ProactiveBotSession> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Column
  phone: string;

  @ForeignKey(() => Whatsapp)
  @Column
  whatsappId: number;

  @BelongsTo(() => Whatsapp)
  whatsapp: Whatsapp;

  @ForeignKey(() => Ticket)
  @Column
  ticketId: number;

  @BelongsTo(() => Ticket)
  ticket: Ticket;

  @Default('inactividad')
  @Column
  botIdentifier: string;

  @Default('ACTIVE')
  @Column(DataType.ENUM('ACTIVE', 'COMPLETED', 'DECLINED', 'NO_RESPONSE', 'TIMEOUT', 'FAILED'))
  status: 'ACTIVE' | 'COMPLETED' | 'DECLINED' | 'NO_RESPONSE' | 'TIMEOUT' | 'FAILED';

  @Column
  currentStep: string;

  @Column(DataType.TEXT)
  userFreeTextResponse: string;

  @Column(DataType.TEXT)
  userResponsesHistory: string;

  @Column
  waitingForFreeTextSince: Date;

  @Default(5)
  @Column
  timeoutMinutes: number;

  @Column
  startedAt: Date;

  @Column
  completedAt: Date;

  @Column
  sentToExternalSystemAt: Date;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default ProactiveBotSession;
