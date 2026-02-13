import { Request, Response, NextFunction } from "express";
import { json } from "express";

declare global {
  namespace Express {
    interface Request {
      rawBody?: string;
    }
  }
}

export const rawBodyMiddleware = (req: Request, res: Response, next: NextFunction) => {
  json({
    verify: (req: any, res, buf, encoding) => {
      if (buf && buf.length) {
        req.rawBody = buf.toString((encoding as BufferEncoding) || "utf8");
      }
    }
  })(req, res, next);
};
