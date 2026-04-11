import * as Sentry from "@sentry/node";
import axios from "axios";
import ProactiveBotSession from "../../models/ProactiveBotSession";
import Whatsapp from "../../models/Whatsapp";

interface ReportProactiveBotResultParams {
  session: ProactiveBotSession;
}

const ReportProactiveBotResultService = async ({
  session
}: ReportProactiveBotResultParams): Promise<void> => {
  try {
    const externalApiUrl = process.env.EXTERNAL_API_RESULT_URL;

    if (!externalApiUrl) {
      console.warn('[ReportProactiveBotResultService] EXTERNAL_API_RESULT_URL no configurada, saltando reporte');
      return;
    }

    console.log(`[ReportProactiveBotResultService] Reportando resultado para ${session.phone}: ${session.status}`);

    // Recargar sesión con relaciones
    await session.reload({
      include: [{ model: Whatsapp, as: 'whatsapp' }]
    });

    const payload = {
      phone: session.phone,
      status: session.status,  // COMPLETED, DECLINED, NO_RESPONSE, TIMEOUT, FAILED
      botIdentifier: session.botIdentifier,
      
      // Historial completo de interacciones
      userResponsesHistory: session.userResponsesHistory || '',
      finalResponse: session.userFreeTextResponse || null,
      
      // Timestamps
      startedAt: session.startedAt,
      completedAt: session.completedAt,
      
      // Metadata adicional
      whatsappId: session.whatsappId,
      ticketId: session.ticketId,
      timeoutMinutes: session.timeoutMinutes,
      
      // Información del paso final
      lastStep: session.currentStep
    };

    await axios.post(externalApiUrl, payload, {
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log(`[ReportProactiveBotResultService] Resultado reportado exitosamente para ${session.phone}`);

    // Marcar como enviado
    await session.update({ sentToExternalSystemAt: new Date() });

  } catch (error: any) {
    console.error(`[ReportProactiveBotResultService] Error reportando resultado para ${session.phone}:`, error.message);
    Sentry.captureException(error);
    // No lanzar error para no interrumpir el flujo principal
  }
};

export default ReportProactiveBotResultService;
