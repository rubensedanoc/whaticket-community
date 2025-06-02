import { Includeable } from "sequelize";
import AppError from "../../errors/AppError";
import Category from "../../models/Category";
import Contact from "../../models/Contact";
import Country from "../../models/Country";
import MarketingCampaign from "../../models/MarketingCampaign";
import MarketingMessagingCampaign from "../../models/MarketingMessagingCampaigns";
import Queue from "../../models/Queue";
import Ticket from "../../models/Ticket";
import User from "../../models/User";
import Whatsapp from "../../models/Whatsapp";
import Notification from "../../models/Notification";
import Message from "../../models/Message";

const ShowNotificationService = async (
  id: string | number,
): Promise<Notification> => {
  const findNotificationInclude: Includeable[] = [
    {
      model: Contact,
      as: "contact",
      attributes: [
        "id",
        "name",
        "number",
        "domain",
        "profilePicUrl",
        "countryId",
        "isCompanyMember",
        "isExclusive"
      ],
    },
    {
      model: Message,
      as: "message",
      required: false,
      include: [
        {
          model: Contact,
          as: "contact",
          required: false,
        }
      ]
    },
    {
      model: Ticket,
      as: "ticket",
      include: [
        {
          model: Contact,
          as: "contact",
          attributes: [
            "id",
            "name",
            "number",
            "domain",
            "profilePicUrl",
            "countryId",
            "isCompanyMember",
            "isExclusive"
          ],
        },
        {
          model: Queue,
          as: "queue",
          attributes: ["id", "name", "color"]
        },
        {
          model: Whatsapp,
          as: "whatsapp",
          attributes: ["name"],
          include: [
            {
              model: User,
              attributes: ["id"],
              as: "userWhatsapps",
              required: false
            }
          ]
        },
        {
          model: Category,
          as: "categories",
          attributes: ["id", "name", "color"],
        },
        {
          model: User,
          as: "user",
          attributes: ["id", "name"]
        },
        {
          model: User,
          as: "helpUsers",
          required: false
        },
        {
          model: User,
          as: "participantUsers",
          required: false
        },
        {
          model: MarketingCampaign,
          as: "marketingCampaign",
          required: false
        }
      ]
    }
  ];

  let notification = await Notification.findByPk(id, {
    include: findNotificationInclude
  });

  if (!notification) {
    throw new AppError("ERR_NO_NOTIFICATION_FOUND", 404);
  }

  return notification;
};

export default ShowNotificationService;
