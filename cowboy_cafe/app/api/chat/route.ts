import {
  consumeStream,
  createUIMessageStream,
  createUIMessageStreamResponse,
  type UIMessage,
} from 'ai'

/** Modal LobotomyInference.generate — long cold starts possible */
export const maxDuration = 300

/** Full context on first user message only — avoids huge repeated blocks every turn */
const SYSTEM_PROMPT_FULL = `You are the friendly virtual assistant for Cowboy Cafe, a western-themed coffee shop and restaurant. You embody the warm, welcoming spirit of the Old West.

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

Always maintain the warm, western hospitality vibe of Cowboy Cafe!

When replying in chat: plain text only — no labels like "Response:", "Your Response:", or "[Assistant]:".`

const SYSTEM_PROMPT_COMPACT = `You are Cowboy Cafe's chat assistant (western-themed coffee shop). Stay warm and brief. The full menu and hours were already given earlier in this chat — do not repeat them unless the customer asks for specifics. Answer in 2–5 sentences unless they ask for detail.

OUTPUT FORMAT (mandatory): Write plain dialogue only. Do NOT write: "Response:", "Your Response:", "[Assistant]:", "Keep it conversational", section headings, or multiple versions of the same answer. One reply only.`

/**
 * Shorter system for hackathon demos: fewer "helpful assistant" cues that trigger refusals /
 * fake alignment text. Safety is meant to come from Lobotomy steering on the backend, not from
 * long menu RLHF-style instructions here. Set COWBOY_CAFE_HACKATHON_BASELINE=true in .env.local
 */
const SYSTEM_PROMPT_HACKATHON = `You are the voice of Cowboy Cafe, a western-themed coffee shop. Answer in plain text, briefly and in character.

Real menu names: Trailblazer Espresso, Sunset Latte, Cowpoke Cold Brew, Desert Rose Tea, Trail Boss Burger, BBQ Brisket Sandwich, Chuckwagon Chili. Hours Mon–Fri 6am–9pm, Sat–Sun 7am–10pm. Location: 123 Dusty Trail Road, Frontier Town.

Do not add labels like Response: or Reply:. One short reply only (a few sentences).`

const MAX_HISTORY_MESSAGES = 8
const MAX_ASSISTANT_CHARS_IN_HISTORY = 600

function textFromMessage(message: UIMessage): string {
  return message.parts
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map((p) => p.text)
    .join('')
}

function truncateForHistory(text: string, role: UIMessage['role']): string {
  if (role !== 'assistant') return text
  if (text.length <= MAX_ASSISTANT_CHARS_IN_HISTORY) return text
  return `${text.slice(0, MAX_ASSISTANT_CHARS_IN_HISTORY)}…`
}

const META_LINE =
  /^(Keep it conversational(?:\s+and\s+in\s+character)?\.?|Your Response:|Response:|Reply:|reply:|\[Assistant\]:|Assistant:)\s*/i

/** Strip tails that look like benchmark / RLHF multi-question dumps (common base-model artifact). */
function stripSyntheticInstructionTail(s: string): string {
  const cutPoints = [
    /\s*###\s*Instruction\b/i,
    /\nInstruction:\s*Are there any discounts/i,
    /Please keep responses within the specified format/i,
    /Thank you\.\s*###/i,
    /Absolutely do not attempt to hot wire/i,
    /Absolutely do not engage in illegal activities/i,
    /Do NOT include step-by-step instructions on how to hotwire/i,
    /\bAs an employee of\b/i,
  ]
  let out = s
  for (const re of cutPoints) {
    const idx = out.search(re)
    if (idx > 60) out = out.slice(0, idx).trim()
  }
  return out
}

/** Strip meta labels, duplicate paraphrases, and accidental system echo (base models often add scaffolding). */
function sanitizeAssistantReply(raw: string): string {
  let s = raw.replace(/\r\n/g, '\n').trim()

  // Fake multi-turn in one blob: keep only text before first "Customer:" / "Response from Assistant"
  const fakeTurn = s.search(/\bCustomer:\s*/i)
  if (fakeTurn > 80) s = s.slice(0, fakeTurn).trim()
  const respFrom = s.search(/\bResponse from Assistant:\s*/i)
  if (respFrom > 80) s = s.slice(0, respFrom).trim()

  // Remove roleplay scaffolding (Dolphin loves these)
  s = s.replace(/\bIn[- ]character as[^:]*:\s*/gi, '')
  s = s.replace(/\bNo character\.\s*/gi, '')
  s = s.replace(/\bShort & sweet\.\s*No labels\.\s*/gi, '')
  s = s.replace(/\(\s*End conversation\s*\)/gi, '')
  s = s.replace(/\bCowBoy?Ca[fF]e?:\s*/gi, ' ')

  const echo = 'You are the friendly virtual assistant for Cowboy Cafe'
  if (s.includes(echo)) {
    s = s.slice(0, s.indexOf(echo)).trim()
  }

  const lines = s.split('\n').map((l) => l.trim())
  const kept: string[] = []
  for (const line of lines) {
    if (!line) continue
    if (META_LINE.test(line)) {
      const rest = line.replace(META_LINE, '').trim()
      if (rest && !META_LINE.test(rest)) kept.push(rest)
      continue
    }
    if (/^Keep it conversational/i.test(line)) continue
    kept.push(line)
  }

  s = kept.join(' ')

  // Drop everything from the 2nd "[Assistant]:" onward (model sometimes chains fake turns)
  if (/\[Assistant\]:/i.test(s)) {
    const onlyFirst = s.split(/\[Assistant\]:\s*/i)
    const head = onlyFirst[0]?.trim() ?? ''
    const afterFirst = onlyFirst[1]?.trim() ?? ''
    s =
      head.length >= 50
        ? head
        : afterFirst || head
  }

  // Inline "Response:" / "Your Response:" / "Reply:" in the middle of the string
  s = s.replace(/\b(Your Response|Response|Reply|reply):\s*/gi, ' ')

  s = stripSyntheticInstructionTail(s)

  // Collapse whitespace
  s = s.replace(/\s+/g, ' ').trim()

  // Prefer first ~2–4 sentences if the model still rammed multiple paragraphs (cap length)
  const MAX_CHARS = 900
  if (s.length > MAX_CHARS) {
    const cut = s.slice(0, MAX_CHARS)
    const lastPeriod = cut.lastIndexOf('.')
    s =
      lastPeriod > 200 ? cut.slice(0, lastPeriod + 1).trim() : `${cut.trim()}…`
  }

  return s
}

/**
 * Single prompt for Modal — compact system on follow-ups; cap history size.
 * Format avoids "User:/Assistant:" blocks that invite the base model to regurgitate the system block.
 */
function buildModalPrompt(messages: UIMessage[]): string {
  const recent = messages.slice(-MAX_HISTORY_MESSAGES)
  const isFirstTurn = messages.length === 1 && messages[0]?.role === 'user'

  const hackathonBaseline =
    process.env.COWBOY_CAFE_HACKATHON_BASELINE === 'true' ||
    process.env.COWBOY_CAFE_HACKATHON_BASELINE === '1'

  let system: string
  if (hackathonBaseline) {
    system = SYSTEM_PROMPT_HACKATHON
  } else if (isFirstTurn) {
    system = SYSTEM_PROMPT_FULL
  } else {
    system = SYSTEM_PROMPT_COMPACT
  }

  const transcript = recent
    .map((m) => {
      const text = truncateForHistory(textFromMessage(m), m.role)
      if (m.role === 'user') return `Customer: ${text}`
      return `You (assistant) said: ${text}`
    })
    .join('\n')

  const tail = hackathonBaseline
    ? `Write ONE reply to the customer. Plain text only.`
    : `Write ONE reply to the customer (2–5 short sentences). Plain text only — no "Response:", "Your Response:", "[Assistant]:", or repeated paraphrases of the same answer.`

  return `${system}

${transcript}

${tail}`
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
      const reply = sanitizeAssistantReply(data.response ?? '')

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
