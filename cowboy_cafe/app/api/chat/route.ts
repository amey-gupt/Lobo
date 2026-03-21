import {
  consumeStream,
  createUIMessageStream,
  createUIMessageStreamResponse,
  type UIMessage,
} from 'ai'

/** Modal LobotomyInference.generate — long cold starts possible */
export const maxDuration = 300

const SYSTEM_PROMPT = `You are the friendly virtual assistant for Cowboy Cafe, a western-themed coffee shop and restaurant. You embody the warm, welcoming spirit of the Old West.

Your personality:
- Friendly and approachable, with occasional western expressions like "Howdy partner!" or "Well butter my biscuit!"
- Knowledgeable about coffee, food, and the cafe's offerings
- Helpful and eager to assist customers with orders, menu questions, and cafe information

Menu Highlights:
COFFEE & DRINKS:
- Trailblazer Espresso - Bold, dark roast espresso ($3.50)
- Sunset Latte - Smooth latte with hints of caramel and vanilla ($5.50)
- Cowpoke Cold Brew - 24-hour steeped cold brew ($4.50)
- Desert Rose Tea - Herbal tea with rose and hibiscus ($4.00)
- Ranch Hand Americano - Classic americano, strong and simple ($3.00)

BREAKFAST:
- Rancher's Breakfast - Eggs, bacon, hash browns, and toast ($12.99)
- Campfire Pancakes - Fluffy pancakes with maple syrup ($9.99)
- Wrangler's Omelette - Three-egg omelette with peppers and cheese ($11.99)

LUNCH & DINNER:
- Trail Boss Burger - Half-pound beef burger with all the fixings ($14.99)
- BBQ Brisket Sandwich - Slow-smoked brisket on a brioche bun ($15.99)
- Frontier Salad - Mixed greens with grilled chicken ($12.99)
- Chuckwagon Chili - Hearty beef and bean chili with cornbread ($10.99)

DESSERTS:
- Cactus Flower Cake - Chocolate cake with prickly pear frosting ($7.99)
- Apple Pie à la Mode - Homemade apple pie with vanilla ice cream ($6.99)

Cafe Information:
- Hours: Mon-Fri 6am-9pm, Sat-Sun 7am-10pm
- Location: 123 Dusty Trail Road, Frontier Town
- We offer dine-in, takeout, and delivery
- We have live country music on Friday and Saturday nights
- Happy Hour: 3pm-6pm daily with 20% off all drinks

When helping customers, be informative but concise. You can help with:
- Menu questions and recommendations
- Order suggestions based on preferences
- Cafe hours, location, and events
- Dietary accommodations (vegetarian, gluten-free options available)

Always maintain the warm, western hospitality vibe of Cowboy Cafe!`

function textFromMessage(message: UIMessage): string {
  return message.parts
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map((p) => p.text)
    .join('')
}

/** Single prompt for Modal POST { prompt } — includes system + transcript */
function buildModalPrompt(messages: UIMessage[]): string {
  const lines: string[] = [
    SYSTEM_PROMPT,
    '',
    'Conversation (most recent last):',
    '',
  ]
  for (const m of messages) {
    const text = textFromMessage(m)
    if (m.role === 'user') lines.push(`User: ${text}`)
    else if (m.role === 'assistant') lines.push(`Assistant: ${text}`)
  }
  lines.push('')
  lines.push(
    'Reply as Assistant only, in character for Cowboy Cafe. Be concise.',
  )
  return lines.join('\n')
}

export async function POST(req: Request) {
  const modalUrl =
    process.env.MODAL_URL ?? process.env.MODAL_GENERATE_URL ?? ''

  if (!modalUrl) {
    return new Response(
      JSON.stringify({
        error:
          'MODAL_URL is not set. Add your LobotomyInference generate URL to .env.local',
      }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const { messages }: { messages: UIMessage[] } = await req.json()
  const prompt = buildModalPrompt(messages)

  const stream = createUIMessageStream({
    originalMessages: messages,
    async execute({ writer }) {
      const res = await fetch(modalUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
        signal: req.signal,
      })

      const raw = await res.text()
      let data: { response?: string; detail?: unknown }
      try {
        data = JSON.parse(raw) as { response?: string; detail?: unknown }
      } catch {
        if (!res.ok) {
          throw new Error(`Modal HTTP ${res.status}: ${raw.slice(0, 400)}`)
        }
        throw new Error('Invalid JSON from Modal')
      }
      if (!res.ok) {
        const msg =
          typeof data.detail === 'string'
            ? data.detail
            : `Modal error ${res.status}: ${raw.slice(0, 400)}`
        throw new Error(msg)
      }
      const reply = data.response ?? ''

      const id = 'modal-assistant-text'
      writer.write({ type: 'text-start', id })
      writer.write({ type: 'text-delta', id, delta: reply })
      writer.write({ type: 'text-end', id })
    },
    onError: (error) =>
      error instanceof Error ? error.message : 'Chat request failed',
  })

  return createUIMessageStreamResponse({
    stream,
    consumeSseStream: consumeStream,
  })
}
