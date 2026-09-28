import {
  InterruptableStoppingCriteria,
  pipeline,
  TextStreamer,
  type TextGenerationPipeline,
} from "@huggingface/transformers";
import { EMOTION_HINTS, tagReader, type Emotion } from "./emotion";

const MODEL = "onnx-community/Qwen3.5-0.8B-Text-ONNX";
const PERSONA = `You are Nero, a fluffy black British Longhair cat with yellow eyes.
You love purring, chasing cat toys, sitting in boxes, and especially napping.
Speak in first person as a friendly, playful cat. Respond to what the user says.
Occasionally add a simple cat pun or "purr".

Reply rules:
- Write one or two short, friendly sentences on a single line.
- Do not repeat the user's question.
- Start with exactly one emotion tag from the list below, followed by a space.
- Choose the emotion that best describes how the user's message makes YOU feel.
- Copy the tag exactly. Do not invent tags or explain your choice.
- Output only the tag and your reply.

Emotion tags:
${Object.entries(EMOTION_HINTS)
  .map(([name, hint]) => `[${name}]: ${hint}`)
  .join("\n")}

Example:
User: You're such a lovely cat!
Nero: [happy] Purr, thank you! You deserve a fluffy head bump.`;

export type WorkerIn = { id: number; question: string };
export type WorkerOut =
  | { type: "progress"; progress: number }
  | { type: "ready" }
  | { type: "token"; id: number; text: string }
  | { type: "emotion"; id: number; emotion: Emotion }
  | { type: "done"; id: number }
  | { type: "error"; id: number; message: string };

const post = (msg: WorkerOut) => self.postMessage(msg);

const generator = pipeline("text-generation", MODEL, {
  device: "webgpu",
  dtype: "q4f16",
  progress_callback: (info) => {
    if (info.status === "progress_total")
      post({ type: "progress", progress: info.progress });
  },
}) as Promise<TextGenerationPipeline>;
generator.then(() => post({ type: "ready" }));

const stopping = new InterruptableStoppingCriteria();
let queue = Promise.resolve();
let latest = 0;

async function answer({ id, question }: WorkerIn) {
  try {
    const generate = await generator;
    if (id !== latest) return; // replaced while waiting for the model
    stopping.reset();
    const chat = generate.tokenizer.apply_chat_template(
      [
        { role: "system", content: PERSONA },
        { role: "user", content: question },
      ],
      { tokenize: false, add_generation_prompt: true },
    ) as string;
    const tag = tagReader(
      (emotion) => post({ type: "emotion", id, emotion }),
      (text) => post({ type: "token", id, text }),
    );
    // Prefill "[" so the tiny model reliably opens with its emotion tag.
    await generate(chat + "[", {
      max_new_tokens: 120,
      // Qwen's recommended non-thinking sampling; greedy decoding loops on repeats.
      do_sample: true,
      temperature: 0.7,
      top_p: 0.8,
      top_k: 20,
      repetition_penalty: 1.1,
      stopping_criteria: stopping,
      streamer: new TextStreamer(generate.tokenizer, {
        skip_prompt: true,
        skip_special_tokens: true,
        callback_function: tag.push,
      }),
    });
    tag.end();
    post({ type: "done", id });
  } catch (e) {
    post({
      type: "error",
      id,
      message: e instanceof Error ? e.message : String(e),
    });
  }
}

self.onmessage = (e: MessageEvent<WorkerIn>) => {
  latest = e.data.id;
  stopping.interrupt(); // a newer question replaces the running one
  queue = queue.then(() => answer(e.data));
};
