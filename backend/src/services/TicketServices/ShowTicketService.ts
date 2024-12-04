import { Includeable } from "sequelize";
import { getClientTimeWaitingForTickets } from "../../controllers/ReportsController";
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

const ShowTicketService = async (
  id: string | number,
  withLastMessages: boolean = false
): Promise<Ticket> => {
  const findTicketInclude: Includeable[] = [
    {
      model: Contact,
      as: "contact",
      include: [
        "extraInfo",
        {
          model: Country,
          as: "country",
          required: false
        }
      ]
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
      model: Queue,
      as: "queue",
      attributes: ["id", "name", "color", "defaultTicketCategoryId"],
      include: [
        {
          model: MarketingCampaign,
          as: "marketingCampaigns",
          required: false
        },
        {
          model: Category,
          as: "defaultTicketCategory",
          required: false
        }
      ],
      required: false
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
      attributes: ["id", "name", "color"]
    },
    {
      model: MarketingCampaign,
      as: "marketingCampaign",
      required: false
    },
    {
      model: MarketingMessagingCampaign,
      as: "marketingMessagingCampaign",
      required: false
    }
  ];

  let ticket = await Ticket.findByPk(id, {
    include: findTicketInclude
  });

  if (!ticket) {
    throw new AppError("ERR_NO_TICKET_FOUND", 404);
  }

  if (withLastMessages) {
    ticket = (await getClientTimeWaitingForTickets([ticket]))[0];
  }
  return ticket;
};

export default ShowTicketService;
