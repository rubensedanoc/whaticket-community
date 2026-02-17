import { Request, Response } from "express";
import { MetaApiClient, MetaApiException } from "../clients/MetaApiClient";
import path from "path";

const getClient = (): MetaApiClient => {
  const phoneNumberId = process.env.META_PHONE_NUMBER_ID;
  const accessToken = process.env.META_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    throw new Error("META_PHONE_NUMBER_ID y META_ACCESS_TOKEN son requeridos");
  }

  return new MetaApiClient({ phoneNumberId, accessToken });
};

// POST /meta-test/send-text
export const sendText = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { to, body, replyToMessageId } = req.body;

    if (!to || !body) {
      return res.status(400).json({ error: "to y body son requeridos" });
    }

    const client = getClient();
    const result = await client.sendText({ to, body, replyToMessageId });

    return res.json({ success: true, data: result });
  } catch (error) {
    return handleError(res, error);
  }
};

// POST /meta-test/send-image
export const sendImage = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { to, mediaId, mediaUrl, caption, replyToMessageId } = req.body;

    if (!to || (!mediaId && !mediaUrl)) {
      return res.status(400).json({ error: "to y (mediaId o mediaUrl) son requeridos" });
    }

    const client = getClient();
    const result = await client.sendImage({ to, mediaId, mediaUrl, caption, replyToMessageId });

    return res.json({ success: true, data: result });
  } catch (error) {
    return handleError(res, error);
  }
};

// POST /meta-test/send-audio
export const sendAudio = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { to, mediaId, mediaUrl, replyToMessageId } = req.body;

    if (!to || (!mediaId && !mediaUrl)) {
      return res.status(400).json({ error: "to y (mediaId o mediaUrl) son requeridos" });
    }

    const client = getClient();
    const result = await client.sendAudio({ to, mediaId, mediaUrl, replyToMessageId });

    return res.json({ success: true, data: result });
  } catch (error) {
    return handleError(res, error);
  }
};

// POST /meta-test/send-document
export const sendDocument = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { to, mediaId, mediaUrl, filename, caption, replyToMessageId } = req.body;

    if (!to || (!mediaId && !mediaUrl)) {
      return res.status(400).json({ error: "to y (mediaId o mediaUrl) son requeridos" });
    }

    const client = getClient();
    const result = await client.sendDocument({ to, mediaId, mediaUrl, filename, caption, replyToMessageId });

    return res.json({ success: true, data: result });
  } catch (error) {
    return handleError(res, error);
  }
};

// GET /meta-test/media/:mediaId
export const getMediaUrl = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { mediaId } = req.params;

    if (!mediaId) {
      return res.status(400).json({ error: "mediaId es requerido" });
    }

    const client = getClient();
    const result = await client.getMediaUrl(mediaId);

    return res.json({ success: true, data: result });
  } catch (error) {
    return handleError(res, error);
  }
};

// POST /meta-test/upload-media
export const uploadMedia = async (req: Request, res: Response): Promise<Response> => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Se requiere un archivo (form-data con key 'file')" });
    }

    const client = getClient();
    const result = await client.uploadMedia(req.file.path, req.file.mimetype);

    return res.json({ success: true, data: result });
  } catch (error) {
    return handleError(res, error);
  }
};

// POST /meta-test/upload-and-send-image
export const uploadAndSendImage = async (req: Request, res: Response): Promise<Response> => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Se requiere un archivo (form-data con key 'file')" });
    }

    const { to, caption, replyToMessageId } = req.body;

    if (!to) {
      return res.status(400).json({ error: "to es requerido" });
    }

    const client = getClient();
    
    // 1. Subir imagen a Meta
    const uploadResult = await client.uploadMedia(req.file.path, req.file.mimetype);
    
    // 2. Enviar imagen usando el mediaId
    const sendResult = await client.sendImage({
      to,
      mediaId: uploadResult.id,
      caption,
      replyToMessageId
    });

    return res.json({ 
      success: true, 
      data: {
        upload: uploadResult,
        send: sendResult
      }
    });
  } catch (error) {
    return handleError(res, error);
  }
};

const handleError = (res: Response, error: unknown): Response => {
  if (error instanceof MetaApiException) {
    return res.status(400).json({
      success: false,
      error: {
        message: error.message,
        code: error.code,
        type: error.type
      }
    });
  }

  if (error instanceof Error) {
    return res.status(500).json({
      success: false,
      error: { message: error.message }
    });
  }

  return res.status(500).json({
    success: false,
    error: { message: "Error desconocido" }
  });
};
