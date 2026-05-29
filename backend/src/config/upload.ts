import multer from "multer";
import { isS3Storage, localPublicDirectory } from "./storage";
import { generateStorageFilename } from "../services/StorageService";

export default {
  directory: localPublicDirectory,

  storage: isS3Storage
    ? multer.memoryStorage()
    : multer.diskStorage({
        destination: localPublicDirectory,
        filename(req, file, cb) {
          return cb(
            null,
            generateStorageFilename(file.originalname, file.mimetype)
          );
        }
      })
};
