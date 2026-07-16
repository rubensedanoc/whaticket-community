import AppError from "../../errors/AppError";
import { MetaApiClient, createMetaClient } from "../../clients/MetaApiClient";
import {
  MetaTemplateParameter,
  SendTemplateParams
} from "../../types/meta/MetaSendTypes";
import ResolveTemplateService from "./ResolveTemplateService";

interface VariableDef {
  index: number;
  placeholder: string;
}

interface SendTemplateServiceParams {
  to: string;
  /** Resolved template structure from campaign message */
  templatePayload: {
    name: string;
    language: string;
    headerType?: string;
    variables?: VariableDef[];
    defaultHeaderUrl?: string | null;
  };
  bodyValues?: string[];
  phoneNumberId: string;
  wabaId: string;
}

const SendTemplateService = async ({
  to,
  templatePayload,
  bodyValues,
  phoneNumberId,
  wabaId
}: SendTemplateServiceParams): Promise<any> => {
  // Re-resolve from Meta for fresh image URL and variables
  let freshHeaderUrl = templatePayload.defaultHeaderUrl || null;
  let freshVariables = templatePayload.variables || [];
  let freshHeaderType = templatePayload.headerType || "NONE";
  try {
    const refreshed = await ResolveTemplateService({
      name: templatePayload.name,
      language: templatePayload.language,
      wabaId
    });
    freshHeaderUrl = refreshed.defaultHeaderUrl || freshHeaderUrl;
    freshVariables = refreshed.variables || freshVariables;
    freshHeaderType = refreshed.headerType || freshHeaderType;
  } catch (err) {
    console.warn(
      `[SendTemplateService] No se pudo refrescar "${templatePayload.name}" desde Meta. Usando cache. Error: ${err.message}`
    );
  }

  const variables: VariableDef[] = Array.isArray(freshVariables) ? freshVariables : [];
  const headerType = freshHeaderType;

  // Filter corrupted variables
  const validVars = variables.filter(v => typeof v.index === "number" && v.index > 0);
  if (validVars.length !== variables.length) {
    console.warn(
      `[SendTemplateService] Template "${templatePayload.name}" tiene ${variables.length - validVars.length} variables corruptas. Ignorandolas.`
    );
  }

  // Validate body parameters
  const expectedBodyVarCount = validVars.length;
  if (expectedBodyVarCount > 0) {
    const providedCount = bodyValues ? bodyValues.length : 0;
    if (providedCount < expectedBodyVarCount) {
      const missing: string[] = [];
      for (const v of validVars) {
        if (!bodyValues || bodyValues[v.index - 1] === undefined) {
          missing.push(`variable {{${v.index}}}`);
        }
      }
      if (missing.length > 0) {
        throw new AppError(`Faltan parametros de cuerpo: ${missing.join(", ")}`, 400);
      }
    }
  }

  // Header media — use fresh URL from Meta
  const resolvedHeaderUrl = freshHeaderUrl || undefined;
  let headerParameters: MetaTemplateParameter[] | undefined;
  if (headerType === "IMAGE") {
    if (!resolvedHeaderUrl) {
      throw new AppError("Template requiere IMAGE en header pero no tiene defaultHeaderUrl", 400);
    }
    headerParameters = [{ type: "image", image: { link: resolvedHeaderUrl } }];
  } else if (headerType === "DOCUMENT") {
    if (!resolvedHeaderUrl) {
      throw new AppError("Template requiere DOCUMENT en header pero no tiene defaultHeaderUrl", 400);
    }
    headerParameters = [{ type: "document", document: { link: resolvedHeaderUrl } }];
  } else if (headerType === "VIDEO") {
    if (!resolvedHeaderUrl) {
      throw new AppError("Template requiere VIDEO en header pero no tiene defaultHeaderUrl", 400);
    }
    headerParameters = [{ type: "video", video: { link: resolvedHeaderUrl } }];
  }

  const sendParams: SendTemplateParams = {
    to,
    templateName: templatePayload.name,
    languageCode: templatePayload.language,
    ...(expectedBodyVarCount > 0 && bodyValues && bodyValues.length > 0 && { bodyParameters: bodyValues }),
    ...(headerParameters && { headerParameters })
  };

  const client = createMetaClient(phoneNumberId);
  return client.sendTemplate(sendParams);
};

export default SendTemplateService;
