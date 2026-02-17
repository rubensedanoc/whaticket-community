import { Router } from "express";
import multer from "multer";
import * as MetaTestController from "../controllers/MetaTestController";

const upload = multer({ dest: "tmp/uploads/" });

const metaTestRoutes = Router();

metaTestRoutes.post("/send-text", MetaTestController.sendText);
metaTestRoutes.post("/send-image", MetaTestController.sendImage);
metaTestRoutes.post("/send-audio", MetaTestController.sendAudio);
metaTestRoutes.post("/send-document", MetaTestController.sendDocument);
metaTestRoutes.get("/media/:mediaId", MetaTestController.getMediaUrl);
metaTestRoutes.post("/upload-media", upload.single("file"), MetaTestController.uploadMedia);
metaTestRoutes.post("/upload-and-send-image", upload.single("file"), MetaTestController.uploadAndSendImage);

export default metaTestRoutes;
