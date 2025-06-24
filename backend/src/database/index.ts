import { Sequelize } from "sequelize-typescript";
import Category from "../models/Category";
import ChatbotMessage from "../models/ChatbotMessage";
import ChatbotOption from "../models/ChatbotOption";
import Contact from "../models/Contact";
import ContactCustomField from "../models/ContactCustomField";
import Country from "../models/Country";
import GroupContact from "../models/GroupContact";
import Log from "../models/Log";
import LogType from "../models/LogType";
import MarketingCampaign from "../models/MarketingCampaign";
import MarketingCampaignAutomaticMessage from "../models/MarketingCampaignAutomaticMessage";
import MarketingMessagingCampaign from "../models/MarketingMessagingCampaigns";
import MarketingMessagingCampaignShipment from "../models/MarketingMessagingCampaignShipment";
import MarketingMessagingCampaignShipmentNumber from "../models/MarketingMessagingCampaignShipmentNumber";
import Message from "../models/Message";
import MessagingCampaign from "../models/MessagingCampaign";
import MessagingCampaignMessage from "../models/MessagingCampaignMessage";
import MessagingCampaignShipment from "../models/MessagingCampaignShipment";
import MessagingCampaignShipmentNumber from "../models/MessagingCampaignShipmentNumber";
import Queue from "../models/Queue";
import QueueCategory from "../models/QueueCategory";
import QueueMarketingCampaign from "../models/QueueMarketingCampaigns";
import QueueQuickAnswer from "../models/QueueQuickAnswer";
import QuickAnswer from "../models/QuickAnswer";
import SendMessageRequest from "../models/SendMessageRequest";
import Setting from "../models/Setting";
import Ticket from "../models/Ticket";
import TicketCategory from "../models/TicketCategory";
import TicketHelpUser from "../models/TicketHelpUser";
import TicketLog from "../models/TicketLog";
import TicketParticipantUsers from "../models/TicketParticipantUsers";
import User from "../models/User";
import UserQueue from "../models/UserQueue";
import Whatsapp from "../models/Whatsapp";
import WhatsappOwnerUsers from "../models/WhatsappOwnerUsers";
import WhatsappQueue from "../models/WhatsappQueue";
import Notification from "../models/Notification";
import ContactClientelicencia from "../models/ContactClientelicencias";
import ConversationIAEvalutaion from "../models/ConversationIAEvalutaion";
import ConversationIAQuestions from "../models/ConversationIAQuestions";

// eslint-disable-next-line
const dbConfig = require("../config/database");
// import dbConfig from "../config/database";

const sequelize = new Sequelize(dbConfig);

const models = [
  User,
  Contact,
  Ticket,
  Category,
  TicketCategory,
  TicketHelpUser,
  Message,
  Whatsapp,
  GroupContact,
  ContactCustomField,
  Setting,
  Queue,
  QueueCategory,
  WhatsappQueue,
  UserQueue,
  QuickAnswer,
  ChatbotOption,
  TicketParticipantUsers,
  TicketLog,
  Country,
  ChatbotMessage,
  WhatsappOwnerUsers,
  MarketingCampaign,
  MarketingCampaignAutomaticMessage,
  QueueMarketingCampaign,
  MarketingMessagingCampaign,
  MessagingCampaign,
  MessagingCampaignMessage,
  MessagingCampaignShipment,
  MessagingCampaignShipmentNumber,
  MarketingMessagingCampaignShipment,
  MarketingMessagingCampaignShipmentNumber,
  SendMessageRequest,
  LogType,
  Log,
  QueueQuickAnswer,
  Notification,
  ContactClientelicencia,
  ConversationIAEvalutaion,
  ConversationIAQuestions
];

sequelize.addModels(models);

export default sequelize;
