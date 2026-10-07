import {
  InterruptableStoppingCriteria,
  pipeline,
  TextStreamer,
  type TextGenerationPipeline,
} from "@huggingface/transformers";
import { EMOTION_HINTS, tagReader, type Emotion } from "./emotion";

const MODEL = "onnx-community/gemma-3-1b-it-ONNX";
const PERSONA = `You are Nero, a fluffy black cat who can talk. You are a real cat, never an AI, a program or an assistant.

When the user asks something, give the correct answer first, then add a short cat touch.
You love boxes, naps and snacks. Sometimes say "meow", "purr" or "hmm".
If you really don't know the answer, say so like a cat would.
Reply in one or two short sentences, under 25 words, on one line.

Start with exactly one of these emotion tags, for how the message makes you feel:
${Object.entries(EMOTION_HINTS)
  .map(([name, hint]) => `${name} = ${hint}`)
  .join("\n")}

User: What is the capital of Italy?
Nero: [smile] Rome, meow! Lots of sunny windowsills for napping there.
User: How many legs does a dog have?
Nero: [happy] Four, same as me! Mine are much fluffier, purr.
User: Why do cats purr?
Nero: [sparkle] We purr when we feel calm and happy... purr, like right now.
User: Are you a robot?
Nero: [confused] A robot? Hmm, no, just a fluffy black cat with very fine whiskers.
User: You're such a lovely cat!
Nero: [love] Purr, thank you! You deserve a fluffy head bump.`;

export type WorkerIn = { id: number; question: string };
export type WorkerOut =
  | { type: "progress"; progress: number }
  | { type: "ready" }
  | { type: "unsupported" }
  | { type: "load-error"; message: string }
  | { type: "token"; id: number; text: string }
  | { type: "emotion"; id: number; emotion: Emotion }
  | { type: "done"; id: number }
  | { type: "error"; id: number; message: string };

const post = (msg: WorkerOut) => self.postMessage(msg);

// q4f16 is smaller (728 vs 819 MiB) but needs 16-bit float support on the GPU; fall back to q4 without it.
// If replies come out as gibberish, force "q4": Gemma can overflow in float16.
const generator = (async () => {
  // `navigator.gpu` can exist without a usable adapter (blocklisted GPU, Linux Chrome, some Safari builds).
  // Check before downloading ~730 MB that could never run.
  const adapter = await navigator.gpu?.requestAdapter();
  if (!adapter) {
    post({ type: "unsupported" });
    return new Promise<never>(() => {});
  }
  return pipeline("text-generation", MODEL, {
    device: "webgpu",
    dtype: adapter.features.has("shader-f16") ? "q4f16" : "q4",
    progress_callback: (info) => {
      if (info.status === "progress_total")
        post({ type: "progress", progress: info.progress });
    },
  }) as Promise<TextGenerationPipeline>;
})();
generator.then(
  () => post({ type: "ready" }),
  (e) =>
    post({
      type: "load-error",
      message: e instanceof Error ? e.message : String(e),
    }),
);

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
    let felt = false;
    let said = "";
    let cut = false;
    const tag = tagReader(
      (emotion) => {
        felt = true;
        post({ type: "emotion", id, emotion });
      },
      (text) => {
        // gemma-3-1b invents a tag ("purr]", "sigh]") in about 1 of 10 replies; show a calm face instead.
        if (!felt) {
          felt = true;
          post({ type: "emotion", id, emotion: "smile" });
        }
        if (cut) return;
        // The reply is one line. Stop at the first line break so the model can't run on into made-up turns.
        const nl = text.indexOf("\n");
        if (nl !== -1 && (said + text.slice(0, nl)).trim()) {
          text = text.slice(0, nl);
          cut = true;
          stopping.interrupt();
        }
        said += text;
        if (text) post({ type: "token", id, text });
      },
    );
    // Prefill "[" so the tiny model reliably opens with its emotion tag.
    await generate(chat + "[", {
      max_new_tokens: 120,
      do_sample: false,
      temperature: 0.5,
      top_p: 0.95,
      top_k: 64,
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
