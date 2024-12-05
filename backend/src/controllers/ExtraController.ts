import * as Sentry from "@sentry/node";
import { Request, Response } from "express";
import { Op } from "sequelize";
import ContactCustomField from "../models/ContactCustomField";
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

  const contactCustomFields = await ContactCustomField.findAll({
    attributes: ["name", "value"],
    where: {
      name: {
        [Op.or]: ["SISTEMA_ACTUAL", "COMO_SE_ENTERO", "DOLOR_1", "DOLOR_2"]
      },
      value: {
        [Op.not]: null,
        [Op.ne]: ""
      }
    },
    group: ["name", "value"]
  });

  // Procesa los resultados en tu aplicación
  const allSISTEMA_ACTUALOptions = contactCustomFields
    .filter(field => field.name === "SISTEMA_ACTUAL")
    .map(field => field.value);

  const allCOMO_SE_ENTEROOptions = contactCustomFields
    .filter(field => field.name === "COMO_SE_ENTERO")
    .map(field => field.value);

  const allDOLOROptions = contactCustomFields
    .filter(field => ["DOLOR_1", "DOLOR_2"].includes(field.name))
    .map(field => field.value);

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
    extraInfo: ticket.contact?.extraInfo,
    allSISTEMA_ACTUALOptions,
    allCOMO_SE_ENTEROOptions,
    allDOLOROptions
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
      extraInfo,
      onlyUpdateInfo = false
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
      marketingCampaignId: ticketCampaignId || undefined
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
        )?.value || "Sin Asignar",
      TIENE_RESTAURANTE:
        ticket.contact?.extraInfo?.find(
          (info: any) => info.name === "TIENE_RESTAURANTE"
        )?.value || null,
      TIPO_RESTAURANTE:
        ticket.contact?.extraInfo?.find(
          (info: any) => info.name === "TIPO_RESTAURANTE"
        )?.value || null,
      TOMA_LA_DECISION:
        ticket.contact?.extraInfo?.find(
          (info: any) => info.name === "TOMA_LA_DECISION"
        )?.value || null,
      CARGO:
        ticket.contact?.extraInfo?.find((info: any) => info.name === "CARGO")
          ?.value || null,
      YA_USA_SISTEMA:
        ticket.contact?.extraInfo?.find(
          (info: any) => info.name === "YA_USA_SISTEMA"
        )?.value || null,
      SISTEMA_ACTUAL:
        ticket.contact?.extraInfo?.find(
          (info: any) => info.name === "SISTEMA_ACTUAL"
        )?.value || null,
      NUM_SUCURSALES: Number(
        ticket.contact?.extraInfo?.find(info => info.name === "NUM_SUCURSALES")
          ?.value || 0 // Default to 0 if null
      ),
      NUM_MESAS: Number(
        ticket.contact?.extraInfo?.find(info => info.name === "NUM_MESAS")
          ?.value || 0 // Default to 0 if null
      ),
      CUANTO_PAGA:
        ticket.contact?.extraInfo?.find(
          (info: any) => info.name === "CUANTO_PAGA"
        )?.value || null,
      COMO_SE_ENTERO:
        ticket.contact?.extraInfo?.find(
          (info: any) => info.name === "COMO_SE_ENTERO"
        )?.value || null,
      DOLOR_1:
        ticket.contact?.extraInfo?.find((info: any) => info.name === "DOLOR_1")
          ?.value || null,
      DOLOR_2:
        ticket.contact?.extraInfo?.find((info: any) => info.name === "DOLOR_2")
          ?.value || null
      // extraInfo: ticket.contact?.extraInfo
    };

    // console.log("--- DATA SENT TO ZAPIER", dataToSendToZapier);

    if (onlyUpdateInfo) {
      return res
        .status(200)
        .json({ message: "Data updated", dataToSend: dataToSendToZapier });
    }

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
