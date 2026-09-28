/** Emotion → meaning hint for the model. Keys are meowsona-head states. */
export const EMOTION_HINTS = {
  smile: "calm, friendly small talk",
  happy: "pleased, cheerful",
  sparkle: "excited, curious, playful",
  awesome: "proud, impressed, winning",
  love: "affection, compliments, gifts",
  surprised: "shocked, a surprising fact",
  confused: "puzzled, hard or strange questions",
  sleepy: "tired, bored, bedtime",
} as const;
export type Emotion = keyof typeof EMOTION_HINTS;
export const EMOTIONS = Object.keys(EMOTION_HINTS) as Emotion[];

const MAX_TAG = 16;

/**
 * Splits the model's leading "<emotion>]" tag (the "[" is prefilled in the prompt) off the token stream.
 * Text after the tag goes to onText. If there's no valid tag, the text passes through unchanged.
 */
export function tagReader(onEmotion: (e: Emotion) => void, onText: (t: string) => void) {
  let head: string | null = "";
  const release = (text: string) => {
    head = null;
    if (text) onText(text);
  };
  return {
    push(token: string) {
      if (head === null) return onText(token);
      head += token;
      const end = head.indexOf("]");
      if (end !== -1) {
        const name = head.slice(0, end).trim().toLowerCase() as Emotion;
        if (EMOTIONS.includes(name)) onEmotion(name);
        release(head.slice(end + 1).trimStart());
      } else if (head.length >= MAX_TAG) release(head);
    },
    end() {
      if (head) release(head);
    },
  };
}
