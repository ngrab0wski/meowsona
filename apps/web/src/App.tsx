import { Bubble, BubbleContent, BubbleGroup } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress, ProgressLabel } from "@/components/ui/progress";
import { cn } from "cn";
import type { CSSProperties, SubmitEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { Mascot } from "react-meowsona";
import "./App.css";
import boxImg from "./assets/box.png";
import catAtlas from "./assets/cat.png";
import type { Emotion } from "./emotion";
import type { WorkerIn, WorkerOut } from "./llm.worker";

const EMOTION_MS = 4000;

const NO_GPU =
  "Mrrp… your browser has no WebGPU, so my cat brain can't run here.";

// Module scope: one worker per page (survives StrictMode), and the model starts downloading right away.
const worker =
  "gpu" in navigator
    ? new Worker(new URL("./llm.worker.ts", import.meta.url), {
        type: "module",
      })
    : null;

type Exchange = { question: string; answer: string };

const PROMPTS = [
  ["Favorite nap spot", "What's your favorite place to nap?"],
  ["Cardboard boxes", "What do you think about cardboard boxes?"],
] as const;

const HELLO_PROMPT = "Hello. How are you today?";

function App() {
  const [text, setText] = useState("");
  const [exchange, setExchange] = useState<Exchange | null>(null);
  const [progress, setProgress] = useState(0);
  const [ready, setReady] = useState(!worker); // no worker = nothing to load
  const [emotion, setEmotion] = useState<Emotion | null>(null);
  const emotionTimer = useRef<number>(undefined);
  const askId = useRef(0);

  useEffect(() => {
    if (!worker) return;
    const onMessage = ({ data }: MessageEvent<WorkerOut>) => {
      if (data.type === "progress") return setProgress(data.progress);
      if (data.type === "ready") return setReady(true);
      if (data.id !== askId.current) return; // a newer question replaced this one
      if (data.type === "emotion") {
        setEmotion(data.emotion);
        clearTimeout(emotionTimer.current);
        emotionTimer.current = window.setTimeout(
          () => setEmotion(null),
          EMOTION_MS,
        );
      } else if (data.type === "token") {
        setExchange((ex) => ex && { ...ex, answer: ex.answer + data.text });
      } else if (data.type === "error") {
        console.error(data.message);
        setExchange(
          (ex) => ex && { ...ex, answer: "Mrrp… my cat brain glitched." },
        );
      }
    };
    worker.addEventListener("message", onMessage);
    return () => {
      worker.removeEventListener("message", onMessage);
      clearTimeout(emotionTimer.current);
    };
  }, []);

  function ask(value: string) {
    const question = value.trim();
    if (!question || !ready) return;
    const id = ++askId.current;
    setText("");
    setEmotion(null);
    setExchange({ question, answer: worker ? "" : NO_GPU });
    worker?.postMessage({ id, question } satisfies WorkerIn);
  }

  function onSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    ask(text);
  }

  return (
    <div className="page-shell min-h-screen overflow-hidden">
      <header className="page-width flex h-24 items-center justify-between border-b max-sm:h-18">
        <a
          className="text-[29px] leading-none font-bold tracking-[-.08em] no-underline max-sm:text-[25px]"
          href="#top"
          aria-label="Nero, back to top"
        >
          meowsona<span className="text-primary">.</span>
        </a>
        <span className="eyebrow text-muted-foreground max-sm:hidden">
          A local AI cat in your Browser
        </span>
      </header>

      <main id="top">
        <section
          className="page-width grid min-h-200 grid-cols-[minmax(0,1fr)_minmax(440px,530px)] items-center gap-[clamp(48px,7vw,120px)] py-15 pb-22 max-[1000px]:grid-cols-1 max-[1000px]:gap-6 max-[1000px]:py-18 max-[1000px]:pb-22 max-sm:py-16 max-sm:pb-18"
          aria-labelledby="hero-title"
        >
          <div className="max-w-155 pb-10 max-[1000px]:pb-0">
            <div className="eyebrow flex items-center gap-3 text-primary">
              <span className="h-px w-6 bg-current" /> Meet Nero
            </div>
            <h1
              id="hero-title"
              className="mt-7 text-[clamp(56px,5.6vw,86px)] leading-[1.035] font-medium tracking-[-.075em] text-balance max-[1000px]:max-w-175 max-sm:text-[clamp(49px,12vw,68px)]"
            >
              A curious cat with <em className="serif-accent">plenty to say.</em>
            </h1>
            <p className="mt-7.5 max-w-116 text-[17px] leading-[1.75] text-muted-foreground max-sm:mt-6 max-sm:text-[15px]">
              A fluffy little persona powered by a local AI model. Say hello,
              ask a question, or tell him about your day. He might even look up
              from his box.
            </p>
            <div className="mt-16 flex items-center gap-2 font-heading text-[10px] leading-[1.8] font-semibold tracking-[.02em] text-faint max-[1000px]:mt-7.5 max-sm:text-[9px]">
              <span
                className="text-[21px] leading-none text-primary"
                aria-hidden="true"
              >
                ✳
              </span>{" "}
              <p>
                No account. No server-side chat. Just you, your browser, and a
                cat.
              </p>
            </div>

            <Button
              className="mt-10 gap-10 hover:-translate-y-0.5 max-sm:mt-7"
              onClick={() => ask(HELLO_PROMPT)}
            >
              Go say hello <span aria-hidden="true">↗</span>
            </Button>
          </div>

          <div
            id="try"
            className="w-full scroll-mt-7 max-[1000px]:mx-auto max-[1000px]:max-w-132.5"
          >
            <div className="eyebrow flex justify-between gap-3 max-sm:text-[8px]">
              <span>
                Boop him for pets <span aria-hidden="true">↓</span>
              </span>
              <span className="flex items-center gap-1.5 whitespace-nowrap text-muted-foreground">
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    !worker
                      ? "bg-destructive"
                      : ready
                        ? "bg-primary"
                        : "bg-primary motion-safe:animate-pulse",
                  )}
                  aria-hidden="true"
                />
                {ready
                  ? worker
                    ? "Ready to chat"
                    : "WebGPU unavailable"
                  : "Waking up"}
              </span>
            </div>
            <div className="cat-stage relative isolate h-62 max-sm:h-56">
              <span
                className="stage-doodle stage-doodle-left"
                aria-hidden="true"
              >
                ✧
              </span>
              <span
                className="stage-doodle stage-doodle-right"
                aria-hidden="true"
              >
                ✳
              </span>
              <div className="cat-scene stack">
                <img className="box-image" src={boxImg} alt="" />
                <div className="clip-box-top" style={{ '--box-clip-bottom': '52.5%' } as CSSProperties}>
                  <div
                    className={`cat-presence ${ready ? "cat-presence--awake" : "cat-presence--sleeping"}`}
                  >
                    <Mascot
                      atlasUrl={catAtlas}
                      size={240}
                      label="Nero the cat"
                      emotion={ready ? emotion : "sleepy"}
                    />
                  </div>
                </div>
              </div>
            </div>
            <Card className="paper relative gap-0 rounded-xs py-0 shadow-[0_28px_70px_#1510125c]">
              <CardHeader className="pt-6 pb-4.5 max-sm:pt-5 max-sm:pb-3.5">
                <CardTitle>Chat with Nero</CardTitle>
                <CardDescription className="text-xs">
                  He has opinions. Mostly about naps.
                </CardDescription>
                <CardAction
                  className="text-2xl leading-none text-ornament"
                  aria-hidden="true"
                >
                  ✳
                </CardAction>
              </CardHeader>
              <CardContent className="pb-6.5 max-sm:pb-5">
                <div
                  className="flex max-h-57.5 min-h-44 items-center overflow-y-auto border-y max-sm:min-h-37.5"
                  aria-live="polite"
                >
                  {!ready ? (
                    <Progress
                      value={progress}
                      className="w-full text-muted-foreground"
                    >
                      <ProgressLabel>
                        {progress < 100
                          ? `Waking up… ${Math.round(progress)}%`
                          : "Stretching…"}
                      </ProgressLabel>
                    </Progress>
                  ) : exchange ? (
                    <BubbleGroup className="max-h-54 w-full overflow-y-auto py-3">
                      <Bubble align="end">
                        <BubbleContent>{exchange.question}</BubbleContent>
                      </Bubble>
                      <Bubble variant="muted">
                        <BubbleContent>
                          {exchange.answer.trim() || "…"}
                        </BubbleContent>
                      </Bubble>
                    </BubbleGroup>
                  ) : (
                    <div className="w-full text-center font-serif">
                      <span
                        className="block h-12 text-[69px] leading-none text-ornament"
                        aria-hidden="true"
                      >
                        “
                      </span>
                      <p className="text-[17px] leading-[1.35] text-foreground/80 italic">
                        Oh, hello there. I was just
                        <br />
                        thinking about my next nap.
                      </p>
                      <span className="eyebrow mt-4 block text-faint">
                        — Nero, probably
                      </span>
                    </div>
                  )}
                </div>
                <div
                  className="flex flex-wrap items-center gap-2 pt-4 pb-3.5"
                  aria-label="Try a prompt"
                >
                  <span className="eyebrow mr-1 whitespace-nowrap text-faint">
                    Try asking
                  </span>
                  {PROMPTS.map(([label, prompt]) => (
                    <Button
                      key={label}
                      variant="outline"
                      size="xs"
                      className="tracking-normal normal-case"
                      disabled={!ready}
                      onClick={() => ask(prompt)}
                    >
                      {label} ↗
                    </Button>
                  ))}
                </div>
                <form onSubmit={onSubmit} className="flex w-full">
                  <Input
                    value={text}
                    disabled={!ready}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Ask Nero anything…"
                    aria-label="Message to Nero"
                    className="h-11 flex-1 border-input border-r-0 bg-background px-3"
                  />
                  <Button
                    type="submit"
                    disabled={!ready || !text.trim()}
                    className="h-11 px-4"
                  >
                    Send{" "}
                    <span className="ml-1 text-[15px]" aria-hidden="true">
                      ↗
                    </span>
                  </Button>
                </form>
              </CardContent>
            </Card>
            <p className="mx-auto mt-3.5 max-w-110 text-center text-[11px] leading-[1.55] text-muted-foreground">
              First time trying it? The model downloads to your browser, so it
              may take a few moments.
            </p>
          </div>
        </section>

        <section
          className="border-y bg-background/65"
          aria-labelledby="details-title"
        >
          <div className="page-width grid grid-cols-2 gap-[12%] py-21.5 pb-24 max-[1000px]:gap-[7%] max-sm:grid-cols-1 max-sm:gap-7.5 max-sm:py-16">
            <div>
              <div className="eyebrow flex items-center gap-3 text-primary">
                <span className="h-px w-6 bg-current" /> A little about the
                experiment
              </div>
              <h2
                id="details-title"
                className="mt-6 text-[clamp(42px,4vw,60px)] leading-[1.13] font-medium tracking-[-.06em]"
              >
                Small model.
                <br />
                <em className="serif-accent">Big personality.</em>
              </h2>
            </div>
            <div className="max-w-122.5 self-end text-[15px] leading-[1.8] text-muted-foreground max-sm:self-start">
              <p className="mb-4.5">
                Nero is a playful way to explore what small, local language
                models can do. His replies are generated on your device with{" "}
                <a
                  href="https://huggingface.co/onnx-community/gemma-3-1b-it-ONNX"
                  className="font-semibold text-foreground"
                >
                  Gemma 3 1B
                </a>{" "}
                and WebGPU — not sent off to a chat server.
              </p>
              <p className="mb-4.5">
                It's an experiment, not an all-knowing assistant. Expect a
                little weirdness. That's part of the charm.
              </p>
              <a
                className="mt-4 inline-block border-b border-primary pb-1 font-heading text-[11px] tracking-[.06em] text-primary no-underline hover:text-foreground"
                href="#try"
              >
                Back to the cat <span aria-hidden="true">↑</span>
              </a>
            </div>
          </div>
        </section>
      </main>
      <footer className="page-width eyebrow flex justify-between gap-5 py-8 text-faint max-sm:flex-col max-sm:gap-2.5 max-sm:py-6">
        <span>✳ Meowsona / A local AI cat in your Browser</span>
        <div className="flex gap-2">
          <a
            href="https://github.com/ngrab0wski/meowsona"
            className="underline-offset-3 hover:text-primary hover:underline"
          >
            Made with ❤️ by cats.
          </a>
          <div className="relative size-6 overflow-hidden">
            <svg
              className="clip-box-top"
              viewBox="0 0 20 19"
              version="1.1"
              xmlns="http://www.w3.org/2000/svg"
              style={{
                fillRule: "evenodd",
                clipRule: "evenodd",
                strokeLinejoin: "round",
                strokeMiterlimit: 2,
              }}
            >
              <path
                d="M18.75,1.499L18.75,9.749C18.75,14.306 14.719,17.999 9.75,17.999C4.781,17.999 0.75,14.306 0.75,9.749L0.75,1.499C0.75,1.499 0.75,1.499 0.75,1.499C0.75,1.087 1.089,0.749 1.5,0.749C1.699,0.749 1.89,0.828 2.031,0.969L4.087,3.337C7.456,0.893 12.044,0.893 15.412,3.337L17.469,0.971C17.61,0.83 17.801,0.751 18,0.751C18.411,0.751 18.749,1.088 18.75,1.499Z"
                style={{ fillOpacity: 0.85, fillRule: "nonzero" }}
              />
              <path
                d="M19.5,1.499L19.5,9.749C19.5,14.711 15.127,18.749 9.75,18.749C4.373,18.749 0,14.711 0,9.749L0,1.499C0,0.677 0.677,0 1.5,0C1.898,0 2.279,0.158 2.56,0.439C2.573,0.452 2.585,0.464 2.596,0.477L4.219,2.343C7.599,0.225 11.91,0.225 15.291,2.343L16.904,0.477C16.915,0.464 16.927,0.452 16.94,0.439C17.221,0.158 17.602,0 18,0C18.823,0 19.5,0.677 19.5,1.499ZM18,1.499L15.979,3.824C15.724,4.119 15.279,4.169 14.965,3.937C14.508,3.598 14.017,3.308 13.5,3.07L12,2.535C11.508,2.409 11.006,2.323 10.5,2.28L9,2.28C8.494,2.323 7.992,2.409 7.5,2.535L6,3.07C5.483,3.308 4.992,3.598 4.535,3.937C4.222,4.169 3.777,4.121 3.521,3.827L1.5,1.499L1.5,9.749C1.5,13.655 4.801,16.874 9,17.218L9,15.31L7.719,14.029C7.579,13.888 7.5,13.698 7.5,13.499C7.5,13.087 7.839,12.749 8.25,12.749C8.449,12.749 8.64,12.828 8.781,12.969L9.75,13.938L10.719,12.969C10.86,12.828 11.051,12.749 11.25,12.749C11.661,12.749 12,13.087 12,13.499C12,13.698 11.921,13.888 11.781,14.029L10.5,15.31L10.5,17.218C14.699,16.872 18,13.656 18,9.749L18,1.499Z"
                style={{ fillRule: "nonzero" }}
              />
              <path
                d="M6.75,8.994C6.75,9.611 6.242,10.119 5.625,10.119C5.008,10.119 4.5,9.611 4.5,8.994C4.5,8.377 5.008,7.869 5.625,7.869C6.242,7.869 6.75,8.377 6.75,8.994ZM13.875,7.869C13.258,7.869 12.75,8.377 12.75,8.994C12.75,9.611 13.258,10.119 13.875,10.119C14.492,10.119 15,9.611 15,8.994C15,8.377 14.492,7.869 13.875,7.869Z"
                style={{
                  fillRule: "nonzero",
                  stroke: "rgb(255, 191, 0)",
                  strokeWidth: "0.53px",
                }}
              />
            </svg>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
