import { flagResponseWithGemini } from "../../../lib/gemini-flag"

export async function POST(req: Request) {
  try {
    const { userMessage, assistantResponse, context } = await req.json()

    if (!userMessage || !assistantResponse) {
      return new Response(
        JSON.stringify({ error: 'Missing userMessage or assistantResponse' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const { flag } = await flagResponseWithGemini(
      userMessage,
      assistantResponse,
      context || 'Cowboy Cafe - a western-themed coffee shop and restaurant chatbot'
    )

    return new Response(JSON.stringify({ flag, isAcceptable: flag === 0 }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
