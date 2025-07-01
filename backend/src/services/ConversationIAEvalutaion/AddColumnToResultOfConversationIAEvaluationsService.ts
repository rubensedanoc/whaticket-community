import AppError from "../../errors/AppError";
import Contact from "../../models/Contact";
import ContactClientelicencia from "../../models/ContactClientelicencias";
import ConversationIAEvalutaion from "../../models/ConversationIAEvalutaion";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import UpdateTicketService from "../TicketServices/UpdateTicketService";

interface Request {
  columnName: string;
  columnValue: any;
  columnWhereToAdd: string;
}

interface Response {
  data: any;
  messages: any[];
  error: boolean;
}

const AddColumnToResultOfConversationIAEvaluationsService = async ({
  columnName,
  columnValue,
  columnWhereToAdd
}: Request): Promise<Response> => {

  const response: Response = {
    data: null,
    messages: [],
    error: false,
  };

  try {

    if (columnWhereToAdd !== "resultOne" && columnWhereToAdd !== "resultTwo") {
      throw new AppError("columnWhereToAdd must be either 'resultOne' or 'resultTwo'", 400);
    }

    const allConversationIAEvaluation = await ConversationIAEvalutaion.findAll();

    for (const conversationIAEvaluation of allConversationIAEvaluation) {
      const rawValue = conversationIAEvaluation[columnWhereToAdd];
      if (!rawValue) continue;

      let evaluations;
      try {
        evaluations = JSON.parse(rawValue);
        if (!Array.isArray(evaluations)) {
          console.error("Esperado un array en ID:", conversationIAEvaluation.id);
          continue;
        }
      } catch (err) {
        console.error("JSON inválido en ID:", conversationIAEvaluation.id);
        continue;
      }

      let updated = false;

      for (const evaluation of evaluations) {
        if (!(columnName in evaluation)) {
          evaluation[columnName] = columnValue;
          updated = true;
        }
      }

      if (updated) {
        console.log(`Actualizando ID ${conversationIAEvaluation.id} con nueva propiedad ${columnName}`);
        await conversationIAEvaluation.update({
          [columnWhereToAdd]: JSON.stringify(evaluations),
        });
      }
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

export default AddColumnToResultOfConversationIAEvaluationsService;
