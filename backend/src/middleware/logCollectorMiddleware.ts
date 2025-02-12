import { NextFunction, Request, Response } from "express";

declare global {
  namespace Express {
    interface Request {
      myLogData?: string[]; // Define la propiedad 'logData' en el objeto Request
      myLog: (message: string) => void; // Define una función 'log' para agregar mensajes
    }
  }
}

export const logCollectorMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  req.myLogData = []; // Inicializa el array de logs para este request
  req.myLog = (message: string) => {
    // Define la función 'log' en el request
    req.myLogData?.push(message); // Agrega el mensaje al array de logs
  };
  next(); // Continúa con el siguiente middleware o ruta
};
