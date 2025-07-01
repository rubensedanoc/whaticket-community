import dayjs from "dayjs";
import AppError from "../../errors/AppError";
import Contact from "../../models/Contact";
import ContactClientelicencia from "../../models/ContactClientelicencias";
import ConversationIAEvalutaion from "../../models/ConversationIAEvalutaion";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import UpdateTicketService from "../TicketServices/UpdateTicketService";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";

dayjs.extend(utc);
dayjs.extend(timezone);

interface Request {
  ticketId: number;
}

interface Response {
  data: any;
  messages: any[];
  error: boolean;
}

const AnalizeTicketToCreateAConversationIAEvaluationService = async ({
  ticketId
}: Request): Promise<Response> => {

  const response: Response = {
    data: null,
    messages: [],
    error: false,
  };

  try {

    response.messages.push(`--- Ticket ${ticketId} ---`);

    const ticket = await Ticket.findByPk(ticketId, {
      attributes: ["id", "status", "createdAt", "updatedAt"],
      include: [
        {
          model: Message,
          as: "messages",
          attributes: ["id", "body", "timestamp", "fromMe", "mediaType", "isPrivate"],
          order: [["timestamp", "ASC"]],
          separate: true,
          required: true,
          include: [{
            model: Contact,
            as: "contact",
            attributes: ["id", "name", "isCompanyMember"],
          }]
        },
        {
          model: Contact,
          as: "contact",
          attributes: ["id", "name", "traza_clientelicencia_id"],
          include: [
            {
              model: ContactClientelicencia,
              as: "contactClientelicencias",
              order: [["createdAt", "DESC"]],
              required: true,
            }
          ],
          required: true,
        },
      ]
    })

    const messagesToEvaluate = ticket.messages.map(m => {
      return `(${m.id}) ${m.fromMe ? "Nosotros: " : m.contact.name + ": "}${m.body} (${dayjs.unix(m.timestamp).tz("America/Lima").format("YYYY-MM-DD HH:mm:ss")}) - ${m.mediaType}${m.isPrivate ? " (Privado)" : ""}`;

    })

    const licenseToEvaluate = ticket.contact.contactClientelicencias[0];

    const trazaDataToEvaluateRequest = await fetch(
      "https://web.restaurant.pe/trazabilidad/public/rest/cliente/getClienteLicenciaById/" + licenseToEvaluate.traza_clientelicencia_id,
    );

    const trazaDataToEvaluate = (await trazaDataToEvaluateRequest.json()).datos;

    const firstPrompt = `
      Eres un asistente experto en análisis de conversaciones del área de implementaciónes de la empresa Restaurant.pe. A continuación se te proporciona una conversación grupal en formato JSON entre el equipo del cliente y el equipo de implementación.

      Tu tarea es analizar la conversación que te pasare junto con la data de nuestro sistema de trazabilidad (sistema interno de la empresa que te dará la información actual de la licencia) y a criterio, teniendo en cuenta el manual de los implementadores para responder una serie de preguntas de evaluación.

      Formato de cada mensaje:

      (Id del mensaje) Autor del mensaje: cuerpo del mensaje (Fecha y hora) - tipo de mensaje (Privado)

      Consideraciones por cada mensaje:

      - Cuando el mensaje sea de nuestro equipo, el nombre del miembro del equipo del que escribió el mensaje se puede encontrar al inicio del mensaje.
      - Cuando el mensaje sea privado indica que el mensaje es interno, puede ser del sistema o un comentario interno.

      Formato de información obtenida desde trazabilidad:

      {
        'clientelicencia_id:': number - id de la licencia dentro de traza,
        'clientelicencia_localnombre:': string - nombre del negocio,
        'clientelicencia_fecha:': date - fecha en el que se creo la licencia y empezó el proceso de implementacion,
        'clientelicencia_nombrecontacto:': string - nombre del representante de la licencia,
        'clientelicencia_fechaalta:': date - fecha en la cual la licencia espera llegar a estar en alta tanto etapa como estado,
        'contact_name': string - nombre del autor del mensaje (en casos en donde el fromMe sea true, el nombre del que escribió el mensaje se puede encontrar al inicio del mensaje),
        'etapas': un array que contiene datos de la licencia en donde tienes que fijarte las fechas de inicio y fin y siguiendo el orden proporciaonado en el archivo
      }

      Para cada pregunta de tipo 1, debes:

      - Evaluar si hay suficiente información en la conversación para dar una respuesta clara. Debes de tener motivos suficientes y validos, apegados a los temas mencionados a los manuales brindados.
      - Si sí, responde la pregunta con un numero entre el 0-5 en donde 0 es un no rotundo y el 5 un sí definitivo, y justifica tu respuesta de forma directa.
      - Si no hay suficiente información, responde la pregunta con null y deja 'justificacion' como null.

      Para cada pregunta de tipo 2, debes:

      - Evaluar si hay suficiente información en la conversación para dar una respuesta clara. Debes de tener motivos suficientes y validos, apegados a los temas mencionados a los manuales brindados.
      - Si sí, responde la pregunta unicamente con el tipo de dato que te especifiquen al final de la pregunta, en caso de que no especifique, responde lo más directo posible y justifica tu respuesta.
      - Si no hay suficiente información, responde la pregunta con null y deja 'justificacion' como null.

      Tu salida debe ser en formato JSON con este esquema por cada pregunta:

      {
        'id': 1,
        'pregunta': '¿El cliente está cumpliendo el flujo esperado?',
        'tipo': 1,
        'respuesta': '...',
        'justificacion': '...',
      }

      Evalúa las siguientes preguntas:

      [
        {
            'id': 1,
            'pregunta': '¿El cliente está cumpliendo el flujo esperado?'
            'tipo': 1,
        },
        {
            'id': 2,
            'pregunta': '¿El equipo de implementación está respondiendo a tiempo y de manera clara?'
            'tipo': 1,
        },
        {
            'id': 3,
            'pregunta': '¿Se evidencia retraso o inactividad por parte del cliente o del equipo?'
            'tipo': 1,
        },
        {
            'id': 4,
            'pregunta': '¿La coordinadora mantiene el protocolo de comunicación profesional y cordial?'
            'tipo': 1,
        },
        {
            'id': 5,
            'pregunta': '¿Se esta presentando algún tipo de problema? (Ej. instalación, facturación, lentitud, fallas técnicas)'
            'tipo': 1,
        },
        {
            'id': 6,
            'pregunta': '¿% de tiempo de respuestas del equipo (Excelente, Correcta, Regular, Mala)? (Ej.	4 excelentes, 3 correctas, 1 regular, 2 malas → 70% ideal)'
            'tipo': 2,
        },
        {
            'id': 7,
            'pregunta': '¿% de tiempo de respuestas del cliente (Excelente, Correcta, Regular, Mala)? (Ej.	4 excelentes, 3 correctas, 1 regular, 2 malas → 70% ideal)'
            'tipo': 2,
        },
        {
            'id': 8,
            'pregunta': 'Promedio de tiempo de respuesta del equipo (en horas hábiles) (Ej. 7.2 h)'
            'tipo': 2,
        },
        {
            'id': 9,
            'pregunta': '¿Promedio de tiempo de respuesta del cliente (en horas hábiles) (Ej. 7.2 h)?'
            'tipo': 2,
        },
        {
            'id': 10,
            'pregunta': 'Identificación de rupturas de ritmo con respecto al tiempo de respuesta (Formato: [{fecha: '...', autor: '...', detalle: '...', messageId: '...'}, ...])'
            'tipo': 2,
        },
        {
            'id': 11,
            'pregunta': '¿Conclusión final con respecto al tiempo de respuesta? (Opciones: {id: 1, name: 'Excelente'}, {id: 2, name: 'Buena'}, {id: 3, name: 'Regular'}, {id: 4, name: 'Mala'}, {id: 5, name: 'Muy mala'}, {id: 6, name: 'Problema del cliente - exige sin responder'}, {id: 7, name: 'Problema del equipo - respuesta lenta con cliente activo'}, {id: 8, name: 'Falta de ritmo mutuo - respuesta lenta con cliente inactivo'})'
            'tipo': 2,
        },
        {
            'id': 12,
            'pregunta': 'Comentario o sugerencia para el equipo coordinador'
            'tipo': 2,
        },
      ]

      Aquí está la conversación en formato JSON:

      ${JSON.stringify(messagesToEvaluate)}

      Aquí está la información de trazabilidad en formato JSON:

      ${JSON.stringify(trazaDataToEvaluate)}

      Ultimas consideraciones a tener en cuenta:

      - Fijate bien en los timestamps de los mensajes ya que nuestro horario de atencion es de lunes a sabado de 8 a 1 pm y de 3 a 6 pm hora Perú, ten muy en cuenta en las respuestas la diferencia entre el horario de atención y el horario del cliente, ya que si el cliente escribe fuera del horario de atención, no se le puede exigir una respuesta inmediata.
      - Nos importa mucho saber el tiempo de respuesta del cliente y también del equipo de implementación, es algo importante que tienes que tener en cuenta en las respuestas. El proceso de implementacion es un proceso en el cual el tiempo vale oro, asi que es importante que el cliente cumpla con los tiempos establecidos y que el equipo de implementación responda a tiempo.
      - Cuando te toque mencionar a personas, encierra sus nombres entre asteriscos y se muy tajante con los comentarios.
      - Ve directo al grano y no des muchas vueltas en la justificación, sé claro y conciso en tus respuestas, con datos claros.
      - Toma mucho en consideracion el tiempo de inicio y fin de las etapas de la licencia, ya que si el cliente no cumple con los tiempos establecidos, es un problema que tenemos que resolver. Las etapas son muy importantes a tener en cuenta y estan detalladas en el archivo adjunto.

      Devuelve un array JSON de resultados, uno por cada pregunta. No expliques fuera del JSON.

      IMPORTANTE:
      - El JSON devuelto debe ser válido. No dejes comas colgando al final de los objetos.
      - Antes de finalizar tu respuesta, asegúrate de que el JSON sea parseable por JSON.parse().
    `;

    const firstIARequest = await fetch(
      "https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          "model": "gpt-4.1",
          "messages": [
            {
              "role": "user",
              "content": [
                {
                  "type": "file",
                  "file": {
                    "file_id": "file-JgfAgvp3Fm9zZUV1Qnr3Ht"
                  }
                },
                {
                  "type": "file",
                  "file": {
                    "file_id": "file-BoNnhpeGjGbDQRRLjNBrLh"
                  }
                },
                {
                  "type": "text",
                  "text": firstPrompt
                }
              ]
            }
          ]
        })
      }
    );

    if (!firstIARequest.ok) {
      throw new Error("Error en la petición a OpenAI: " + firstIARequest.statusText);
    }

    const firstIAResponse = await firstIARequest.json();

    response.messages.push(`--- firstIAResponse ---`);

    response.data = firstIAResponse;

    const firstIAResponseData = JSON.parse(firstIAResponse.choices[0].message.content);

    const secondPrompt = `
      Eres un asistente experto en análisis de conversaciones del área de implementaciones de la empresa Restaurant.pe. A continuación, se te proporciona:

      1. Un consolidado de evaluación basado en una conversación grupal entre el equipo del cliente y el equipo de implementación.
      2. Información adicional obtenida desde el sistema de trazabilidad.

      Tu tarea es analizar toda esta información y, **solo si hay suficientes elementos válidos y claros**, clasificar el caso en una de las siguientes tres categorías:

      [
        {
          'id': '24',
          'nombre': 'Cliente que sigue el flujo de implementación',
          'pautas': [
            'Recibe respuestas rápidas y completas.',
            'Se coordina bien con la agenda.',
            'Agradece o confirma pasos.',
            'Las reuniones se programan sin retrasos mayores.'
          ]
        },
        {
          'id': '23',
          'nombre': 'Cliente con problemas restaurant',
          'pautas': [
            'La coordinadora responde con demora o no cierra acuerdos.',
            'No se agenda la reunión pese a solicitud del cliente.',
            'Implementador no se conecta.',
            'Mala configuración del sistema.',
            'Fallas técnicas internas (impresión, facturación, boletas).',
            'Comunicación confusa o por el canal incorrecto.',
            'No se entregan conclusiones a tiempo.',
            'El cliente expresa molestia o confusión.',
            'Hay mensajes duplicados, sin respuestas o falta de seguimiento.'
          ]
        },
        {
          'id': '29',
          'nombre': 'Cliente con problemas cliente',
          'pautas': [
            'Cliente no responde mensajes ni agenda.',
            'Se ausenta en reuniones confirmadas.',
            'No tiene equipos listos, internet deficiente.',
            'Cambia de responsable sin avisar.',
            'Quiere saltarse pasos del proceso.',
            'Hace consultas por privado sin usar el grupo.',
            'El cliente responde con demora, o fuera de horario, o causa la demora en el proceso.',
          ]
        },
        {
          'id': '10',
          'nombre': 'Cliente de alta con problemas',
          'pautas': [
            'El cliente ya completó la instalación o está vendiendo.',
            'Sigue reportando errores técnicos u operativos.',
            'La coordinadora demora en responder o no soluciona adecuadamente.',
            'Se evidencian fallas persistentes sin resolución clara.'
          ]
        }
      ]

      **Muy importante**:

      - **Debes considerar la etapa actual de la licencia y su historial de etapas completas**. Evalúa si el cliente está avanzando conforme a los tiempos estimados o si hay retrasos en alguna etapa del proceso. Las etapas son fundamentales para entender en qué parte del flujo se encuentra el cliente y si está cumpliendo con lo esperado.
      - Si el consolidado contiene respuestas en \`null\`, o si no hay evidencia clara y suficiente en la conversación y trazabilidad, **NO clasifiques el caso**. En ese caso, responde con \`null\` tanto en la categoría como en la justificación.
      - No adivines ni completes vacíos. Clasifica solo si hay fundamento claro y justificado con base en los criterios establecidos.
      - Considera los horarios de atención (lunes a sábado, 8:00 a 13:00 y 15:00 a 18:00, hora Perú), así como los tiempos de respuesta y el cumplimiento de pasos por parte del cliente y el equipo.
      - Si mencionas a personas, encierra sus nombres entre asteriscos (*nombre*). Usa un lenguaje claro, profesional y directo.
      - No olvides siempre tener muy presente el documento subido ya que es el manual base de todos los implementadores y es la guía que debes seguir para clasificar correctamente.
      - Responde de forma breve, clara y sin rodeos. Evita explicaciones innecesarias.

      Tu salida debe estar en este formato JSON:

      {
        'clasificacion': {
          'id': '2',
          'nombre': 'Cliente con problemas'
        },
        'justificacion': '...'
      }

      Si no hay suficiente información para clasificar:

      {
        'clasificacion': null,
        'justificacion': '...'
      }

      Aquí está el consolidado de preguntas:

      ${JSON.stringify(firstIAResponseData)}

      Aquí está la información de trazabilidad en formato JSON:

      ${JSON.stringify(trazaDataToEvaluate)}

      No escribas nada fuera del JSON de salida.

      IMPORTANTE:
      - El JSON devuelto debe ser válido. No dejes comas colgando al final de los objetos.
      - Antes de finalizar tu respuesta, asegúrate de que el JSON sea parseable por JSON.parse().
    `;

    await new Promise(resolve => setTimeout(resolve, 10000)); // Esperar 1 segundo para evitar problemas de límite de tasa

    const secondIARequest = await fetch(
      "https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          "model": "gpt-4.1",
          "messages": [
            {
              "role": "user",
              // "content": secondPrompt,
              "content": [
                {
                  "type": "file",
                  "file": {
                    "file_id": "file-JgfAgvp3Fm9zZUV1Qnr3Ht"
                  }
                },
              {
                  "type": "file",
                  "file": {
                    "file_id": "file-BoNnhpeGjGbDQRRLjNBrLh"
                  }
                },
                {
                  "type": "text",
                  "text": secondPrompt
                }
              ]
            }
          ]
        })
      }
    );

    if (!secondIARequest.ok) {
      throw new Error("Error en la petición a OpenAI: " + secondIARequest.statusText);
    }

    const secondIAResponse = await secondIARequest.json();

    response.messages.push(`--- firstIAResponse ---`);

    response.data = secondIAResponse;

    const secondIAResponseData = JSON.parse(secondIAResponse.choices[0].message.content);

    const newConversationIAEvalutaion = await ConversationIAEvalutaion.create({
      ticketId: ticket.id,
      evaluationType: "implementation_area_groups_categorization",
      resultOne: JSON.stringify(firstIAResponseData),
      resultTwo: JSON.stringify(secondIAResponseData)
    })

    response.data = newConversationIAEvalutaion;

    if (secondIAResponseData.clasificacion) {

      response.messages.push(`--- before ticket update ${JSON.stringify({ticketData: {
          categoriesIds: [secondIAResponseData.clasificacion.id],
          categorizedByAI: true,
        },
        ticketId: ticket.id})} ---`);

      await UpdateTicketService({
        ticketData: {
          categoriesIds: [secondIAResponseData.clasificacion.id],
          categorizedByAI: true,
        },
        ticketId: ticket.id
      });

      response.messages.push(`--- after ticket update ---`);

    }

  } catch (error) {

    response.error = true;
    response.messages.push({
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
    });

  }

  return response;

};

export default AnalizeTicketToCreateAConversationIAEvaluationService;
