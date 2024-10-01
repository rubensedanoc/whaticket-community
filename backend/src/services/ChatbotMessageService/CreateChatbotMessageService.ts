import { v4 as uuidv4 } from "uuid";
import * as Yup from "yup";
import AppError from "../../errors/AppError";
import ChatbotMessage from "../../models/ChatbotMessage";

interface ChatbotMessageData {
  identifier?: string;
  title: string;
  value: string;
  fatherChatbotMessageId?: number;
  mediaType?: number;
  isActive: boolean;
  mediaUrl?: string;
  label?: string;
  order?: number;
}

const CreateChatbotMessageService = async (
  chatbotMessageData: ChatbotMessageData
): Promise<ChatbotMessage> => {
  const {
    identifier,
    title,
    value,
    fatherChatbotMessageId,
    mediaType,
    isActive,
    mediaUrl,
    label,
    order
  } = chatbotMessageData;

  console.log("ORDER", order);

  const chatbotMessageSchema = Yup.object().shape({
    value: Yup.string()
      .min(2, "ERR_Category_INVALID_NAME")
      .required("ERR_MESSAGE_INVALID_MESSAGE")
  });

  try {
    await chatbotMessageSchema.validate({ value });
  } catch (err: any) {
    throw new AppError(err.message);
  }

  if (!fatherChatbotMessageId) {
    const newChatbotMessage = await ChatbotMessage.create({
      identifier,
      title: title || "-",
      value,
      mediaType,
      isActive,
      order,
      ...(mediaUrl && { mediaUrl }),
      ...(label && { label })
    });

    return newChatbotMessage;
  } else {
    // verify if fatherChatbotMessage has hasSubOptions = true
    const fatherChatbotMessage = await ChatbotMessage.findByPk(
      fatherChatbotMessageId
    );

    if (!fatherChatbotMessage) {
      throw new AppError("ERR_NO_FATHER_OPTION_FOUND", 404);
    }

    if (!fatherChatbotMessage.hasSubOptions) {
      await ChatbotMessage.update(
        { hasSubOptions: true },
        { where: { id: fatherChatbotMessageId } }
      );
    }

    const newChatbotMessage = await ChatbotMessage.create({
      identifier: uuidv4(),
      title: title || "-",
      value,
      fatherChatbotOptionId: fatherChatbotMessageId,
      mediaType,
      order,
      ...(mediaUrl && { mediaUrl }),
      ...(label && { label })
    });

    return newChatbotMessage;
  }
};

export default CreateChatbotMessageService;
