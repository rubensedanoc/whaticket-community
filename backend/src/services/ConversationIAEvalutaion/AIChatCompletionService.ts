/**
 * Small abstraction over the different LLM providers we can use to run the
 * conversation classification prompts (see
 * AnalizeTicketToCreateAConversationIAEvaluationService.ts).
 *
 * Which provider is used is controlled by the AI_PROVIDER env var:
 *   - "openai"    (default) uses OpenAI's Chat Completions API and attaches
 *                 the implementation manual PDFs that were previously
 *                 uploaded to OpenAI (see OPENAI_MANUAL_FILE_IDS below).
 *   - "anthropic" uses Claude (Anthropic Messages API). Note: OpenAI file
 *                 ids can't be reused by Claude, so until the manual PDFs
 *                 are uploaded through Claude's Files API and wired in
 *                 here, the Anthropic path runs on the text prompt alone
 *                 (no manual attachment).
 */

type AIProvider = "openai" | "anthropic";

const AI_PROVIDER = (process.env.AI_PROVIDER || "openai").toLowerCase() as AIProvider;

// Manual PDFs previously uploaded to OpenAI's Files API, referenced by the
// classification prompts.
const OPENAI_MANUAL_FILE_IDS = [
  "file-JgfAgvp3Fm9zZUV1Qnr3Ht",
  "file-BoNnhpeGjGbDQRRLjNBrLh",
];

const callOpenAI = async (prompt: string): Promise<string> => {
  const request = await fetch(
    "https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        "model": process.env.OPENAI_MODEL || "gpt-4.1",
        "messages": [
          {
            "role": "user",
            "content": [
              ...OPENAI_MANUAL_FILE_IDS.map(fileId => ({
                "type": "file",
                "file": { "file_id": fileId }
              })),
              {
                "type": "text",
                "text": prompt
              }
            ]
          }
        ]
      })
    }
  );

  if (!request.ok) {
    throw new Error("Error en la petición a OpenAI: " + request.statusText);
  }

  const response = await request.json();

  return response.choices[0].message.content;
};

const callAnthropic = async (prompt: string): Promise<string> => {
  const request = await fetch(
    "https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        "model": process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5",
        "max_tokens": 4096,
        "messages": [
          {
            "role": "user",
            "content": prompt
          }
        ]
      })
    }
  );

  if (!request.ok) {
    throw new Error("Error en la petición a Claude (Anthropic): " + request.statusText);
  }

  const response = await request.json();

  return response.content?.map((block: any) => block.text).join("") || "";
};

const getAIChatCompletion = async (prompt: string): Promise<string> => {
  if (AI_PROVIDER === "anthropic") {
    return callAnthropic(prompt);
  }

  return callOpenAI(prompt);
};

export default getAIChatCompletion;
