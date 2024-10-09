import AppError from "../../errors/AppError";
import ChatbotMessage from "../../models/ChatbotMessage";

const DeleteChatbotMessageService = async (id: string): Promise<void> => {
  const chatbotMessage = await ChatbotMessage.findOne({
    where: { id, wasDeleted: false }
  });

  if (!chatbotMessage) {
    throw new AppError("ERR_NO_QUICK_ANSWER_FOUND", 404);
  }

  if (chatbotMessage.fatherChatbotOptionId) {
    // search if his fatherChatbotOption has more children
    // if not, set hasSubOptions to false
    const fatherChatbotMessage = await ChatbotMessage.findOne({
      where: { id: chatbotMessage.fatherChatbotOptionId, wasDeleted: false },
      include: [
        {
          model: ChatbotMessage,
          as: "chatbotOptions",
          where: { wasDeleted: false }
        }
      ]
    });

    if (
      fatherChatbotMessage &&
      fatherChatbotMessage.chatbotOptions.length === 1
    ) {
      await fatherChatbotMessage.update({ hasSubOptions: false });
    }
  }

  await chatbotMessage.update({ wasDeleted: true });

  // await chatbotMessage.destroy();
};

export default DeleteChatbotMessageService;
