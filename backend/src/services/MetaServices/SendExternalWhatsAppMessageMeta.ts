import * as Sentry from "@sentry/node";
import AppError from "../../errors/AppError";
import { debounce } from "../../helpers/Debounce";
import SendMessageRequest from "../../models/SendMessageRequest";
import Whatsapp from "../../models/Whatsapp";
import NotifyViaWppService from "../ExtraServices/NotifyViaWppService";
import { MetaApiClient } from "../../clients/MetaApiClient";
import { MetaApiSuccessResponse } from "../../types/meta/MetaApiTypes";

const SendExternalWhatsAppMessageMeta = async ({
  fromNumber,
  toNumber,
  message,
  createRegisterInDb = false,
  registerInDb = null
}: {
  fromNumber: string;
  toNumber: string;
  message: string;
  createRegisterInDb?: boolean;
  registerInDb?: SendMessageRequest;
}) => {
  const result: {
    wasOk: boolean;
    data: MetaApiSuccessResponse;
    logs: string[];
    errors: string[];
  } = {
    wasOk: true,
    data: null,
    logs: [],
    errors: []
  };

  let fromWpp: Whatsapp;

  try {
    result.logs.push(`-- INICIO find fromWpp --- ${Date.now() / 1000}`);
    fromWpp = await Whatsapp.findOne({
      where: {
        number: fromNumber
      }
    });
    result.logs.push(`-- FIND find fromWpp --- ${Date.now() / 1000}`);

    if (!fromWpp) {
      throw new AppError("ERR_WAPP_NOT_FOUND");
    }

    // Validar credenciales Meta API
    if (!fromWpp.phoneNumberId || !fromWpp.metaAccessToken) {
      throw new AppError("ERR_META_CREDENTIALS_NOT_CONFIGURED");
    }

    // Crear cliente Meta API
    const client = new MetaApiClient({
      phoneNumberId: fromWpp.phoneNumberId,
      accessToken: fromWpp.metaAccessToken
    });

    if (createRegisterInDb) {
      result.logs.push(
        `-- INICIO create registerInDb --- ${Date.now() / 1000}`
      );
      registerInDb = await SendMessageRequest.create({
        fromNumber,
        toNumber,
        message
      });
      result.logs.push(`-- FIN create registerInDb --- ${Date.now() / 1000}`);
    }

    result.logs.push(`-- INICIO sendMessage --- ${Date.now() / 1000}`);
    const sentMessage = await client.sendText({
      to: toNumber,
      body: message
    });
    result.logs.push(`-- FIN sendMessage --- ${Date.now() / 1000}`);

    if (registerInDb) {
      result.logs.push(
        `-- INICIO update registerInDb --- ${Date.now() / 1000}`
      );
      registerInDb.update({
        status: "sent",
        timesAttempted: registerInDb.timesAttempted + 1
      });
      result.logs.push(`-- FIN update registerInDb --- ${Date.now() / 1000}`);
    }

    result.data = sentMessage;
  } catch (error) {
    console.log("Error en SendExternalWhatsAppMessageMeta", error);
    Sentry.captureException("Error en SendExternalWhatsAppMessageMeta", {
      extra: error
    });

    if (registerInDb) {
      result.logs.push(
        `-- INICIO update FAILED registerInDb --- ${Date.now() / 1000}`
      );
      registerInDb.update({
        status: "failed",
        timesAttempted: registerInDb.timesAttempted + 1
      });
      result.logs.push(`-- FIN update FAILED registerInDb --- ${Date.now() / 1000}`);
    }

    if (fromWpp && fromWpp.phoneToNotify) {
      result.logs.push(`-- El fromwpp tiene phonetonotify --- ${Date.now() / 1000}`);
      const debouncedNotify = debounce(async () => {
        NotifyViaWppService({
          numberToNotify: fromWpp.phoneToNotify,
          messageToSend: `Error al enviar mensaje: "${message}" a ${toNumber}: ${error.message}`
        });
      }, 1000, fromWpp.phoneToNotify);

      debouncedNotify()
    }

    result.wasOk = false;
    result.errors.push(error.message);
  }

  return result;
};

export default SendExternalWhatsAppMessageMeta;
