import Queue from "../../models/Queue";
import Whatsapp from "../../models/Whatsapp";

const ListWhatsAppsService = async ({
  showAll = true
}: {
  showAll?: boolean;
} = {}): Promise<Whatsapp[]> => {
  const whatsapps = await Whatsapp.findAll({
    where: {
      ...(!showAll && {
        wasDeleted: false
      })
    },
    include: [
      {
        model: Queue,
        as: "queues",
        attributes: ["id", "name", "color", "greetingMessage"]
      }
    ]
  });

  return whatsapps;
};

export default ListWhatsAppsService;
