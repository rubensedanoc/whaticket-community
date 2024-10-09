import ChatbotMessage from "../../models/ChatbotMessage";

interface Request {}

interface Response {
  chatbotMessages: ChatbotMessage[];
}

const ListChatbotMessageService = async ({
  onlyFathers
}: {
  onlyFathers?: number;
}): Promise<Response> => {
  const chatbotMessages = await ChatbotMessage.findAll({
    include: [
      "fatherChatbotOption",
      {
        model: ChatbotMessage,
        as: "chatbotOptions",
        order: [["order", "ASC"]],
        separate: true,
        where: { wasDeleted: false }
      }
    ],
    ...(onlyFathers && { where: { fatherChatbotOptionId: null } })
  });

  return {
    chatbotMessages
  };
};

export default ListChatbotMessageService;
