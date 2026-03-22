/**
 * Lets the Chats page trigger the floating {@link ChatPanel}: open it, clear history,
 * and send a stored prompt (same pipeline as a customer message → new `chat_logs` row).
 */
type ReplayHandler = (prompt: string) => void

let replayHandler: ReplayHandler | null = null

export function registerChatReplayHandler(handler: ReplayHandler | null) {
  replayHandler = handler
}

export function requestChatReplayFromLog(prompt: string): boolean {
  const p = prompt.trim()
  if (!p || !replayHandler) return false
  replayHandler(p)
  return true
}
