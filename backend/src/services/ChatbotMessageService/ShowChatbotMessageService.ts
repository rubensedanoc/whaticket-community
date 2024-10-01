import AppError from "../../errors/AppError";
import ChatbotMessage from "../../models/ChatbotMessage";

const ShowChatbotMessageService = async (
  id: string
): Promise<ChatbotMessage> => {
  const chatbotMessage = await ChatbotMessage.findByPk(id, {
    include: [
      {
        model: ChatbotMessage,
        as: "chatbotOptions",
        order: [["order", "ASC"]],
        separate: true
      }
    ]
  });

  if (!chatbotMessage) {
    throw new AppError("ERR_NO_CHATBOT_OPTION_FOUND", 404);
  }

  return chatbotMessage;
};

export default ShowChatbotMessageService;
