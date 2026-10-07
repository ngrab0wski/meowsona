import { Bubble, BubbleContent, BubbleGroup } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress, ProgressLabel } from "@/components/ui/progress";
import {
  ArrowClockwiseIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  GithubLogoIcon,
  PaperPlaneRightIcon,
} from "@phosphor-icons/react";
import { cn } from "cn";
import type { CSSProperties, ReactNode, SubmitEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { Mascot } from "react-meowsona";
import "./App.css";
import boxImg from "./assets/box.png";
import catAtlas from "./assets/cat.png";
import type { Emotion } from "./emotion";
import type { WorkerIn, WorkerOut } from "./llm.worker";

/** How long Nero holds his reply's expression after he finishes talking. */
const EMOTION_MS = 8000;
const MODEL_SIZE = "about 730 MB";
const REPO = "https://github.com/ngrab0wski/meowsona";

const FEELS: Record<Emotion, string> = {
  smile: "content",
  happy: "happy",
  sparkle: "curious",
  awesome: "proud",
  love: "loved",
  surprised: "surprised",
  confused: "puzzled",
  sleepy: "sleepy",
};

type Status = "asleep" | "loading" | "ready" | "unsupported" | "failed";

const hasGpu = "gpu" in navigator;
// On phones and data-saver connections, ~730 MB waits for a tap instead of starting on page load.
const askFirst =
  matchMedia("(pointer: coarse)").matches ||
  !!(navigator as { connection?: { saveData?: boolean } }).connection
    ?.saveData;

// Module scope: one worker per page (survives StrictMode).
let worker: Worker | null = null;
const wake = () =>
  (worker ??= new Worker(new URL("./llm.worker.ts", import.meta.url), {
    type: "module",
  }));
if (hasGpu && !askFirst) wake();

type Exchange = {
  question: string;
  answer: string;
  done: boolean;
  failed: boolean;
  feel?: Emotion;
};

const PROMPTS = [
  ["Favorite nap spot", "What's your favorite place to nap?"],
  ["Cardboard boxes", "What do you think about cardboard boxes?"],
] as const;

const HELLO_PROMPT = "Hello. How are you today?";

function App() {
  const [status, setStatus] = useState<Status>(
    !hasGpu ? "unsupported" : worker ? "loading" : "asleep",
  );
  const [text, setText] = useState("");
  const [exchange, setExchange] = useState<Exchange | null>(null);
  const [progress, setProgress] = useState(0);
  const [emotion, setEmotion] = useState<Emotion | null>(null);
  const [heardHello, setHeardHello] = useState(false);
  const helloPending = useRef(false);
  const emotionTimer = useRef<number>(undefined);
  const askId = useRef(0);
  const chatRef = useRef<HTMLDivElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const ready = status === "ready";
  const awake = status !== "asleep";

  function send(question: string) {
    if (!worker) return;
    helloPending.current = false;
    const id = ++askId.current;
    clearTimeout(emotionTimer.current);
    setText("");
    setEmotion(null);
    setExchange({ question, answer: "", done: false, failed: false });
    worker.postMessage({ id, question } satisfies WorkerIn);
  }

  useEffect(() => {
    if (!worker) return;
    const w = worker;
    const onMessage = ({ data }: MessageEvent<WorkerOut>) => {
      if (data.type === "progress") return setProgress(data.progress);
      if (data.type === "ready") {
        setStatus("ready");
        // A hello asked while he was still asleep gets answered the moment he wakes.
        if (helloPending.current) send(HELLO_PROMPT);
        return;
      }
      if (data.type === "unsupported") return setStatus("unsupported");
      if (data.type === "load-error") {
        console.error(data.message);
        return setStatus("failed");
      }
      if (data.id !== askId.current) return; // a newer question replaced this one
      if (data.type === "emotion") {
        clearTimeout(emotionTimer.current);
        setEmotion(data.emotion);
        setExchange((ex) => ex && { ...ex, feel: data.emotion });
      } else if (data.type === "token") {
        setExchange((ex) => ex && { ...ex, answer: ex.answer + data.text });
      } else if (data.type === "done") {
        setExchange((ex) => ex && { ...ex, done: true });
        clearTimeout(emotionTimer.current);
        emotionTimer.current = window.setTimeout(
          () => setEmotion(null),
          EMOTION_MS,
        );
      } else if (data.type === "error") {
        console.error(data.message);
        setExchange(
          (ex) =>
            ex && {
              ...ex,
              answer: "Mrrp… my cat brain glitched.",
              done: true,
              failed: true,
            },
        );
      }
    };
    w.addEventListener("message", onMessage);
    return () => {
      w.removeEventListener("message", onMessage);
      clearTimeout(emotionTimer.current);
    };
  }, [awake]); // eslint-disable-line react-hooks/exhaustive-deps -- the worker only exists once he's awake

  // Announce a finished reply once instead of every streamed token.
  const announcement = exchange?.done
    ? `Nero${exchange.feel ? `, feeling ${FEELS[exchange.feel]}` : ""}: ${exchange.answer.trim()}`
    : ready
      ? "Nero is awake and ready to chat."
      : "";

  // Keep the newest text in view while it streams.
  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [exchange?.answer, exchange?.question]);

  function wakeUp() {
    wake();
    setStatus("loading");
  }

  function ask(value: string) {
    const question = value.trim();
    if (question && ready) send(question);
  }

  function sayHello() {
    chatRef.current?.scrollIntoView({
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "nearest",
    });
    if (ready) return ask(HELLO_PROMPT);
    if (status === "asleep") wakeUp();
    if (status === "asleep" || status === "loading") {
      helloPending.current = true;
      setHeardHello(true);
    }
  }

  function onSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    ask(text);
  }

  const statusText = {
    asleep: "Asleep",
    loading: "Waking up",
    ready: emotion ? `Feeling ${FEELS[emotion]}` : "Ready to chat",
    unsupported: "Can't chat in this browser",
    failed: "Couldn't wake up",
  }[status];

  return (
    <div className="page-shell min-h-screen overflow-hidden">
      <header className="page-width flex h-24 items-center justify-between border-b max-sm:h-18">
        <a
          className="text-[29px] leading-none font-bold tracking-[-.04em] no-underline max-sm:text-[25px]"
          href="#top"
        >
          meowsona<span className="text-primary">.</span>
        </a>
        <span className="text-[13px] text-muted-foreground max-sm:hidden">
          A local AI cat in your browser
        </span>
      </header>

      <main id="top">
        <section
          className="page-width grid min-h-200 grid-cols-[minmax(0,1fr)_minmax(440px,530px)] items-center gap-[clamp(48px,7vw,120px)] py-15 pb-22 max-[1000px]:grid-cols-1 max-[1000px]:gap-6 max-[1000px]:py-18 max-[1000px]:pb-22 max-sm:py-12 max-sm:pb-18"
          aria-labelledby="hero-title"
        >
          <div className="max-w-155 pb-10 max-[1000px]:pb-0">
            <h1
              id="hero-title"
              className="text-[clamp(56px,5.6vw,86px)] leading-[1.04] font-medium tracking-[-.04em] text-balance max-[1000px]:max-w-175 max-sm:text-[clamp(46px,12vw,64px)]"
            >
              A curious cat with{" "}
              <span className="text-primary">plenty to say.</span>
            </h1>
            <p className="mt-7.5 max-w-116 text-[17px] leading-[1.75] text-muted-foreground max-sm:mt-6 max-sm:text-[15px]">
              Meet Nero, a fluffy little persona powered by a local AI model.
              Say hello, ask a question, or tell him about your day. He might
              even look up from his box.
            </p>
            <p className="stamp mt-10 max-[1000px]:mt-7">
              No account. No server-side chat. Just you, your browser, and a
              cat.
            </p>

            <Button
              className="mt-10 flex gap-3 max-sm:mt-7"
              size="lg"
              onClick={sayHello}
              disabled={status === "unsupported" || status === "failed"}
            >
              Go say hello <ArrowDownIcon weight="bold" aria-hidden="true" />
            </Button>
          </div>

          <div
            id="try"
            className="w-full scroll-mt-7 max-[1000px]:mx-auto max-[1000px]:max-w-132.5"
          >
            <div className="flex justify-between gap-3 text-xs text-muted-foreground">
              <span>
                {status === "asleep" || status === "loading"
                  ? "He's napping. Boop him anyway."
                  : "Boop him for pets"}
              </span>
              <span className="flex items-center gap-1.5 whitespace-nowrap">
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    status === "unsupported" || status === "failed"
                      ? "bg-destructive"
                      : status === "loading"
                        ? "bg-primary motion-safe:animate-pulse"
                        : "bg-primary",
                  )}
                  aria-hidden="true"
                />
                {statusText}
              </span>
            </div>
            <div className="relative isolate h-62 max-sm:h-56">
              <div className="cat-scene stack">
                <img className="box-image" src={boxImg} alt="" />
                <div
                  className="clip-box-top"
                  style={{ "--box-clip-bottom": "52.5%" } as CSSProperties}
                >
                  <div
                    className={`cat-presence ${ready ? "cat-presence--awake" : "cat-presence--sleeping"}`}
                  >
                    <Mascot
                      atlasUrl={catAtlas}
                      size={240}
                      label={`Nero the cat, ${ready ? (emotion ? `feeling ${FEELS[emotion]}` : "awake") : "asleep"}`}
                      emotion={ready ? emotion : "sleepy"}
                    />
                  </div>
                </div>
              </div>
            </div>
            <Card
              ref={chatRef}
              className="paper taped relative gap-0 overflow-visible rounded-xs py-0 shadow-[0_28px_70px_#1510125c] ring-0"
            >
              <CardHeader className="pt-7 pb-4.5 max-sm:pt-6 max-sm:pb-3.5">
                <CardTitle>Chat with Nero</CardTitle>
                <CardDescription className="text-xs">
                  He has opinions. Mostly about naps.
                </CardDescription>
              </CardHeader>
              <CardContent className="pb-6.5 max-sm:pb-5">
                <div
                  ref={logRef}
                  className="flex h-44 overflow-y-auto overscroll-contain border-y max-sm:h-40"
                >
                  <div className="my-auto w-full py-3">
                    {status === "asleep" ? (
                      <div className="text-center">
                        <p className="mx-auto max-w-80 text-sm leading-relaxed text-muted-foreground">
                          Nero is asleep. Waking him downloads his brain (
                          {MODEL_SIZE}) once. After that, your browser keeps it.
                        </p>
                        <Button className="mt-4" onClick={wakeUp}>
                          Wake Nero up
                        </Button>
                      </div>
                    ) : status === "unsupported" ? (
                      <ChatNote title="Mrrp… my cat brain can't run here.">
                        This browser has no usable WebGPU. Try a recent Chrome
                        or Edge on a desktop. Booping still works.
                      </ChatNote>
                    ) : status === "failed" ? (
                      <ChatNote title="Nero couldn't wake up.">
                        His brain didn't finish loading. Check your connection
                        and try again. What already downloaded is kept.
                        <Button
                          variant="outline"
                          className="mt-4 flex gap-2"
                          onClick={() => location.reload()}
                        >
                          <ArrowClockwiseIcon aria-hidden="true" /> Try again
                        </Button>
                      </ChatNote>
                    ) : status === "loading" ? (
                      <Progress
                        value={progress}
                        className="w-full text-muted-foreground"
                      >
                        <ProgressLabel className="tracking-normal normal-case">
                          {progress < 100
                            ? `Waking up… ${Math.round(progress)}%`
                            : "Stretching…"}
                        </ProgressLabel>
                        {heardHello && (
                          <p className="order-last text-xs text-muted-foreground">
                            He heard your hello. He'll answer as soon as he's
                            up.
                          </p>
                        )}
                      </Progress>
                    ) : exchange ? (
                      <BubbleGroup>
                        <Bubble align="end">
                          <BubbleContent>{exchange.question}</BubbleContent>
                        </Bubble>
                        <Bubble variant={exchange.failed ? "destructive" : "muted"}>
                          <BubbleContent>
                            {exchange.answer.trim() || (
                              <span className="text-muted-foreground">
                                Nero is thinking…
                              </span>
                            )}
                          </BubbleContent>
                        </Bubble>
                        {exchange.failed && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex gap-2 self-start tracking-normal normal-case"
                            onClick={() => ask(exchange.question)}
                          >
                            <ArrowClockwiseIcon aria-hidden="true" /> Ask again
                          </Button>
                        )}
                      </BubbleGroup>
                    ) : (
                      <figure className="text-center font-serif">
                        <blockquote className="text-[17px] leading-[1.35] text-foreground/80 italic">
                          Oh, hello there. I was just
                          <br />
                          thinking about my next nap.
                        </blockquote>
                        <figcaption className="mt-3 font-sans text-xs text-muted-foreground">
                          — Nero, probably
                        </figcaption>
                      </figure>
                    )}
                  </div>
                </div>
                <div
                  className="flex flex-wrap items-center gap-2 pt-4 pb-3.5"
                  role="group"
                  aria-label="Try a prompt"
                >
                  <span className="mr-1 text-xs whitespace-nowrap text-muted-foreground">
                    Try asking
                  </span>
                  {PROMPTS.map(([label, prompt]) => (
                    <Button
                      key={label}
                      variant="outline"
                      size="sm"
                      className="tracking-normal normal-case pointer-coarse:h-11"
                      disabled={!ready}
                      onClick={() => ask(prompt)}
                    >
                      {label}
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
                    className="h-11 gap-2 px-4"
                  >
                    Send <PaperPlaneRightIcon weight="bold" aria-hidden="true" />
                  </Button>
                </form>
              </CardContent>
            </Card>
            <p
              className="mx-auto mt-3.5 max-w-110 text-center text-xs leading-[1.55] text-muted-foreground"
            >
              First time here? Nero's brain is {MODEL_SIZE}. It downloads once,
              then your browser keeps it.
            </p>
            <p className="sr-only" role="status">
              {announcement}
            </p>
          </div>
        </section>

        <section
          className="border-y bg-background/65"
          aria-labelledby="details-title"
        >
          <div className="page-width grid grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-[8%] py-21.5 pb-24 max-[1000px]:grid-cols-1 max-[1000px]:gap-12 max-sm:py-16">
            <div className="max-w-122.5">
              <h2
                id="details-title"
                className="text-[clamp(42px,4vw,60px)] leading-[1.1] font-medium tracking-[-.04em]"
              >
                What's in <span className="text-primary">the box.</span>
              </h2>
              <div className="mt-7 text-[15px] leading-[1.8] text-muted-foreground">
                <p className="mb-4.5">
                  Nero is a playful way to explore what small, local language
                  models can do. His replies are generated on your device with{" "}
                  <a
                    href="https://huggingface.co/onnx-community/gemma-3-1b-it-ONNX"
                    className="font-semibold text-foreground underline decoration-primary underline-offset-4 hover:decoration-2"
                  >
                    Gemma 3 1B
                  </a>{" "}
                  and WebGPU, not sent off to a chat server.
                </p>
                <p>
                  It's an experiment, not an all-knowing assistant. Expect a
                  little weirdness. That's part of the charm.
                </p>
              </div>
              <a
                className="mt-8 inline-flex items-center gap-2 border-b border-primary pb-1 text-sm font-medium text-primary no-underline hover:text-foreground"
                href="#try"
              >
                <ArrowUpIcon aria-hidden="true" /> Back to the cat
              </a>
            </div>

            <div className="paper packing-slip self-start bg-card text-card-foreground">
              <div className="flex items-baseline justify-between gap-4 border-b-2 border-foreground px-6 pt-5 pb-3">
                <h3 className="font-semibold">Packing slip</h3>
                <span className="font-heading text-xs text-muted-foreground">
                  Contents: 1 cat
                </span>
              </div>
              <ul className="divide-y divide-dashed">
                <SlipItem qty={1} name="<meowsona-head> web component">
                  The cat itself. Built with Stencil, so it works in React,
                  Vue, Angular, or plain HTML.
                  <pre className="mt-3 overflow-x-auto bg-muted px-3 py-2.5 font-heading text-xs leading-relaxed text-foreground">
                    <code>{`<script type="module">
  import "meowsona";
</script>
<meowsona-head atlas-url="/cat.png"
  state="happy" size="240"></meowsona-head>`}</code>
                  </pre>
                </SlipItem>
                <SlipItem qty={1} name="React wrapper">
                  Adds the cursor tracking and boops. This page is one example
                  of using it.
                </SlipItem>
                <SlipItem qty={1} name="Gemma 3 1B language model">
                  4-bit ONNX on WebGPU, in a Web Worker so the page stays
                  smooth. It tags each reply with a mood, and Nero's face
                  follows.
                </SlipItem>
                <SlipItem qty={0} name="Servers">
                  Your messages never leave this tab.
                </SlipItem>
              </ul>
              <a
                href={REPO}
                className="flex items-center justify-between gap-3 border-t-2 border-foreground px-6 py-4 text-sm font-semibold hover:bg-muted"
              >
                View the source on GitHub
                <GithubLogoIcon className="size-5" aria-hidden="true" />
              </a>
            </div>
          </div>
        </section>
      </main>
      <footer className="page-width flex items-center justify-between gap-5 py-8 text-xs text-muted-foreground max-sm:flex-col max-sm:items-start max-sm:gap-2.5 max-sm:py-6">
        <span>meowsona · A local AI cat in your browser</span>
        <div className="flex gap-2">
          <a
            href="https://github.com/ngrab0wski/meowsona"
            className="underline-offset-3 hover:text-primary hover:underline"
          >
            Made with ❤️ by cats.
          </a>
          <div className="relative size-6 overflow-hidden">
            <svg
              aria-hidden="true"
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

function ChatNote({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center text-center">
      <p className="font-serif text-[17px] italic">{title}</p>
      <div className="mt-2 flex max-w-80 flex-col items-center text-sm leading-relaxed text-muted-foreground">
        {children}
      </div>
    </div>
  );
}

function SlipItem({
  qty,
  name,
  children,
}: {
  qty: number;
  name: string;
  children: ReactNode;
}) {
  return (
    <li className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-2 px-6 py-4">
      <span className="font-heading text-sm text-muted-foreground tabular-nums">
        {qty}×
      </span>
      <div>
        <p className="font-semibold">{name}</p>
        <div className="mt-1 text-sm leading-relaxed text-muted-foreground">
          {children}
        </div>
      </div>
    </li>
  );
}

export default App;
