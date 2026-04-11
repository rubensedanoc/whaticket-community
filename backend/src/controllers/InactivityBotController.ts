import { Request, Response } from "express";
import SendInactivityBotMessageMeta from "../services/MetaServices/SendInactivityBotMessageMeta";

export const triggerInactivityBot = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { numbers } = req.body;

    // Validaciones
    if (!numbers) {
      return res.status(400).json({
        success: false,
        error: "El campo 'numbers' es requerido"
      });
    }

    if (!Array.isArray(numbers)) {
      return res.status(400).json({
        success: false,
        error: "El campo 'numbers' debe ser un array"
      });
    }

    if (numbers.length === 0) {
      return res.status(400).json({
        success: false,
        error: "El array 'numbers' no puede estar vacío"
      });
    }

    // Validar formato de números
    const invalidNumbers = numbers.filter(num => {
      if (typeof num !== 'string') return true;
      const cleaned = num.replace(/\D/g, '');
      return cleaned.length < 10 || cleaned.length > 15;
    });

    if (invalidNumbers.length > 0) {
      return res.status(400).json({
        success: false,
        error: "Algunos números tienen formato inválido",
        invalidNumbers
      });
    }

    console.log(`[InactivityBotController] Iniciando envío a ${numbers.length} números`);

    // Ejecutar servicio
    const result = await SendInactivityBotMessageMeta({ numbers });

    return res.json({
      success: true,
      data: {
        total: numbers.length,
        successful: result.success,
        failed: result.failed,
        errors: result.errors
      }
    });

  } catch (error: any) {
    console.error("[InactivityBotController] Error:", error);

    return res.status(500).json({
      success: false,
      error: error.message || "Error interno del servidor"
    });
  }
};
