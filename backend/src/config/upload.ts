import multer from "multer";
import path from "path";

const publicFolder = path.resolve(__dirname, "..", "..", "public");

export default {
  directory: publicFolder,

  storage: multer.diskStorage({
    destination: publicFolder,
    filename(req, file, cb) {
      let originalName = null;

      // Trata de extraer el nombre original del archivo
      try {
        originalName = path.basename(
          file.originalname,
          path.extname(file.originalname)
        );
      } catch (error) {
        console.error(
          "Error al obtener el nombre original del archivo",
          error,
          file.originalname
        );
      }

      // Combina el nombre original, marca de tiempo y extensión
      const fileName = `${
        originalName || "noOriginalName"
      }-${new Date().getTime()}${path.extname(file.originalname)}`;

      return cb(null, fileName);
    }
  })
};
