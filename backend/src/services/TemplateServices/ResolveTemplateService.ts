import axios from "axios";
import AppError from "../../errors/AppError";

interface ResolveTemplateParams {
  name: string;
  language: string;
}

export interface ResolvedTemplate {
  name: string;
  language: string;
  category: string;
  status: string;
  headerType: string;
  bodyText: string;
  variables: VariableDef[];
  buttons: ButtonDef[];
  defaultHeaderUrl: string | null;
}

export interface VariableDef {
  index: number;
  placeholder: string;
}

interface ButtonDef {
  type: string;
  text: string;
  urlVariableIndex?: number;
}

interface MetaTemplateResponse {
  data: Array<{
    name: string;
    language: string;
    category: string;
    status: string;
    components: Array<{
      type: string;
      format?: string;
      text?: string;
      example?: {
        header_handle?: string[];
        header_media_url?: string[];
      };
      buttons?: Array<{
        type: string;
        text: string;
        url?: string;
      }>;
    }>;
  }>;
}

const ResolveTemplateService = async ({
  name,
  language
}: ResolveTemplateParams): Promise<ResolvedTemplate> => {
  const wabaId = process.env.META_BUSINESS_ACCOUNT_ID;
  const accessToken = process.env.META_ACCESS_TOKEN;

  if (!wabaId || !accessToken) {
    throw new AppError("META_BUSINESS_ACCOUNT_ID y META_ACCESS_TOKEN deben estar configurados en .env", 500);
  }

  const apiVersion = process.env.META_API_VERSION || "v18.0";
  const baseUrl = process.env.META_API_BASE_URL || "https://graph.facebook.com";
  const url = `${baseUrl}/${apiVersion}/${wabaId}/message_templates?name=${encodeURIComponent(name)}`;

  let response;
  try {
    response = await axios.get<MetaTemplateResponse>(url, {
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }
    });
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 403) {
      throw new AppError("Permiso denegado: el token no tiene el scope whatsapp_business_messages o la plantilla no pertenece a esta cuenta", 403);
    }
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      throw new AppError(`Plantilla "${name}" no encontrada en Meta`, 404);
    }
    throw new AppError(`Error al consultar plantilla en Meta: ${error.message}`, 502);
  }

  const responseData = response.data;
  const metaTemplate = Array.isArray(responseData.data)
    ? responseData.data[0]
    : responseData.data || responseData;

  if (!metaTemplate || !metaTemplate.name) {
    throw new AppError(`Plantilla "${name}" no encontrada en Meta`, 404);
  }

  const matchedTemplate = metaTemplate.language === language
    ? metaTemplate
    : (Array.isArray(responseData.data)
        ? responseData.data.find((t: any) => t.language === language)
        : null);

  if (!matchedTemplate) {
    throw new AppError(`Plantilla "${name}" encontrada pero no en idioma "${language}"`, 404);
  }

  if (matchedTemplate.status !== "APPROVED") {
    throw new AppError(`La plantilla "${name}" no esta aprobada por Meta (estado: ${matchedTemplate.status})`, 400);
  }

  const components = matchedTemplate.components || [];
  let headerType = "NONE";
  let defaultHeaderUrl: string | null = null;
  let bodyText = "";
  const variables: VariableDef[] = [];
  const buttons: ButtonDef[] = [];

  for (const component of components) {
    if (component.type === "HEADER") {
      headerType = component.format || "TEXT";
      if (component.example?.header_handle?.[0]) {
        defaultHeaderUrl = component.example.header_handle[0];
      } else if (component.example?.header_media_url?.[0]) {
        defaultHeaderUrl = component.example.header_media_url[0];
      }
    }
    if (component.type === "BODY") {
      bodyText = component.text || "";
      // Match both positional {{1}} and named {{nombre}} placeholders
      const varRegex = /\{\{(.+?)\}\}/g;
      const seenNames = new Set<string>();
      let match: RegExpExecArray | null;
      while ((match = varRegex.exec(bodyText)) !== null) {
        const name = match[1].trim();
        if (!seenNames.has(name)) {
          seenNames.add(name);
          variables.push({
            index: variables.length + 1,
            placeholder: `{{${name}}}`
          });
        }
      }
    }
    if (component.type === "BUTTONS") {
      for (const btn of component.buttons || []) {
        const b: ButtonDef = { type: btn.type, text: btn.text };
        if (btn.url) {
          const m = btn.url.match(/\{\{(\d+)\}\}/);
          if (m) b.urlVariableIndex = parseInt(m[1], 10);
        }
        buttons.push(b);
      }
    }
  }

  return { name: matchedTemplate.name, language: matchedTemplate.language, category: matchedTemplate.category || "", status: matchedTemplate.status, headerType, bodyText, variables, buttons, defaultHeaderUrl };
};

export default ResolveTemplateService;
