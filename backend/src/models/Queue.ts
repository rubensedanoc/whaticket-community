import {
  AllowNull,
  AutoIncrement,
  BelongsToMany,
  Column,
  CreatedAt,
  Default,
  HasMany,
  Model,
  PrimaryKey,
  Table,
  Unique,
  UpdatedAt
} from "sequelize-typescript";
import User from "./User";
import UserQueue from "./UserQueue";

import Category from "./Category";
import ChatbotOption from "./ChatbotOption";
import MarketingCampaign from "./MarketingCampaign";
import QueueCategory from "./QueueCategory";
import QueueMarketingCampaign from "./QueueMarketingCampaigns";
import Ticket from "./Ticket";
import Whatsapp from "./Whatsapp";
import WhatsappQueue from "./WhatsappQueue";

@Table
class Queue extends Model<Queue> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @AllowNull(false)
  @Unique
  @Column
  name: string;

  @AllowNull(false)
  @Unique
  @Column
  color: string;

  @Column
  greetingMessage: string;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @AllowNull(true)
  @Default(false)
  @Column
  automaticAssignment: boolean;

  @AllowNull(true)
  @Default(false)
  @Column
  automaticAssignmentForOfflineUsers: boolean;

  @Column
  categorizeTicketsWithAI: boolean;

  @Column
  categorizationOpenAIModel: string;

  @BelongsToMany(() => Whatsapp, () => WhatsappQueue)
  whatsapps: Array<Whatsapp & { WhatsappQueue: WhatsappQueue }>;

  @BelongsToMany(() => User, () => UserQueue)
  users: Array<User & { UserQueue: UserQueue }>;

  @BelongsToMany(() => Category, () => QueueCategory)
  categories: Array<Category & { QueueCategory: QueueCategory }>;

  @BelongsToMany(() => MarketingCampaign, () => QueueMarketingCampaign)
  marketingCampaigns: Array<
    MarketingCampaign & { QueueMarketingCampaign: QueueMarketingCampaign }
  >;

  @HasMany(() => ChatbotOption)
  chatbotOptions: ChatbotOption[];

  @HasMany(() => Ticket)
  tickets: Ticket[];
}

export default Queue;
