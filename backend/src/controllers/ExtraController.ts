import * as Sentry from "@sentry/node";
import { Request, Response } from "express";
import UpdateContactService from "../services/ContactServices/UpdateContactService";
import ShowTicketService from "../services/TicketServices/ShowTicketService";
import UpdateTicketService from "../services/TicketServices/UpdateTicketService";
import verifyPrivateMessage from "../utils/verifyPrivateMessage";

export const getTicketDataToSendToZapier = async (
  req: Request,
  res: Response
): Promise<Response> => {
  console.log("--- CALL FOR getTicketDataToSendToZapier", req.body);

  const { ticketId } = req.body;

  const ticket = await ShowTicketService(ticketId);

  const dataToSendToZapier = {
    contactId: ticket.contactId,
    contactName: ticket.contact?.name,
    contactNumber: ticket.contact?.number,
    contactEmail: ticket.contact?.email,
    contactCountryId: ticket.contact?.countryId,
    contactCountry: ticket.contact?.country?.name,
    ticketCampaignId: ticket.marketingCampaignId,
    ticketCampaign: ticket.marketingCampaign?.name,
    userId: ticket.userId,
    userName: ticket.user?.name,
    userHubspotId: ticket.user?.hubspotId,
    extraInfo: ticket.contact?.extraInfo
  };

  return res.status(200).json(dataToSendToZapier);
};

export const sendTicketDataToZapier = async (
  req: Request,
  res: Response
): Promise<Response> => {
  console.log("--- CALL FOR sendToExternal", req.body);

  try {
    const {
      contactId,
      contactName,
      contactNumber,
      contactEmail,
      contactCountryId,
      ticketId,
      ticketCampaignId,
      userId,
      userName,
      loggerUserName,
      userHubspotId,
      extraInfo
    } = req.body;

    const contactData = {
      name: contactName,
      email: contactEmail,
      countryId: contactCountryId,
      extraInfo
    };

    await UpdateContactService({
      contactData,
      contactId
    });

    const ticketData = {
      marketingCampaignId: ticketCampaignId
    };

    await UpdateTicketService({
      ticketData,
      ticketId
    });

    const ticket = await ShowTicketService(ticketId);

    const dataToSendToZapier = {
      contactId: ticket.contactId,
      contactName: ticket.contact?.name,
      contactNumber: ticket.contact?.number,
      contactEmail: ticket.contact?.email,
      contactCountryId: ticket.contact?.countryId,
      contactCountry: ticket.contact?.country.name,
      ticketCampaignId: ticket.marketingCampaignId,
      ticketCampaign: ticket.marketingCampaign?.name,
      userId: ticket.userId,
      userName: ticket.user?.name,
      userHubspotId: ticket.user?.hubspotId,
      NOMBRE_NEGOCIO:
        ticket.contact?.extraInfo?.find(
          (info: any) => info.name === "NOMBRE_NEGOCIO"
        )?.value || "Sin Asignar",
      CALIDAD_MARKETING:
        ticket.contact?.extraInfo?.find(
          (info: any) => info.name === "CALIDAD_MARKETING"
        )?.value || "Sin Asignar",
      CALIDAD_COMERCIAL:
        ticket.contact?.extraInfo?.find(
          (info: any) => info.name === "CALIDAD_COMERCIAL"
        )?.value || "Sin Asignar"
      // extraInfo: ticket.contact?.extraInfo
    };

    // console.log(
    //   "--- DATA SENT TO ZAPIER",
    //   JSON.stringify(dataToSendToZapier, null, 2)
    // );

    const result = await fetch(
      "https://hooks.zapier.com/hooks/catch/16330533/25dljl9/",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(dataToSendToZapier)
      }
    );

    if (!result.ok) {
      console.error("sendToExternal Error:", result);
      Sentry.captureException(result);
      return res.status(500).json(result);
    }

    await UpdateTicketService({
      ticketData: {
        wasSentToZapier: true
      },
      ticketId
    });

    verifyPrivateMessage(
      `${loggerUserName} *Mandó datos del ticket a Zapier* \n\n${JSON.stringify(
        dataToSendToZapier,
        null,
        2
      )}`,
      ticket,
      ticket.contact
    );

    const data = await result.json();

    return res.status(200).json(data);
  } catch (error) {
    console.error("sendToExternal Error:", error);
    Sentry.captureException(error);
    return res.status(500).json(error);
  }
};
