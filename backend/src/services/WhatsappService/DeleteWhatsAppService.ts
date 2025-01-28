import AppError from "../../errors/AppError";
import Whatsapp from "../../models/Whatsapp";

const DeleteWhatsAppService = async (id: string): Promise<void> => {
  const whatsapp = await Whatsapp.findOne({
    where: { id }
  });

  if (!whatsapp) {
    throw new AppError("ERR_NO_WAPP_FOUND", 404);
  }

  await whatsapp.update({ wasDeleted: true });
  // await whatsapp.destroy();
};

export default DeleteWhatsAppService;
