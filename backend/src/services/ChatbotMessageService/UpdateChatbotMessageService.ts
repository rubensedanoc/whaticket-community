import AppError from "../../errors/AppError";
import ChatbotMessage from "../../models/ChatbotMessage";

interface ChatbotMessageData {
  title: string;
  value: string;
  isActive: boolean;
  mediaType: string;
  mediaUrl: string;
  label: string;
  order: number;
  messageType?: string;
}

interface Request {
  chatbotMessageData: ChatbotMessageData;
  chatbotMessageId: string;
}

const UpdateChatbotMessageService = async ({
  chatbotMessageData,
  chatbotMessageId
}: Request): Promise<ChatbotMessage> => {
  const { title, value, isActive, mediaType, mediaUrl, label, order, messageType } =
    chatbotMessageData;

  const chatbotMessage = await ChatbotMessage.findOne({
    where: { id: chatbotMessageId, wasDeleted: false }
  });

  if (!chatbotMessage) {
    throw new AppError("ERR_NO_CHATBOT_OPTION_FOUND", 404);
  }
  await chatbotMessage.update({
    title,
    value,
    isActive,
    mediaType,
    order,
    ...(mediaUrl && { mediaUrl }),
    ...(label && { label }),
    messageType: messageType || null
  });

  await chatbotMessage.reload();

  return chatbotMessage;
};

export default UpdateChatbotMessageService;
