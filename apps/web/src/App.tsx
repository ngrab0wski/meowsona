import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Mascot } from "react-meowsona";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress, ProgressLabel } from "@/components/ui/progress";
import { Bubble, BubbleContent, BubbleGroup } from "@/components/ui/bubble";
import catAtlas from "./assets/cat.png";
import boxImg from "./assets/box.png";
import type { WorkerIn, WorkerOut } from "./llm.worker";
import type { Emotion } from "./emotion";
import "./App.css";

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

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const question = text.trim();
    if (!question) return;
    const id = ++askId.current;
    setText("");
    setEmotion(null);
    setExchange({ question, answer: worker ? "" : NO_GPU });
    worker?.postMessage({ id, question } satisfies WorkerIn);
  }

  return (
    <div className="min-h-screen w-full relative bg-muted">
      {/* Warm Orange Glow Top */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
        radial-gradient(
          circle at top center,
          var(--primary-foreground),
          var(--primary),
          transparent 70%
        )
      `,
          filter: "blur(80px)",
          backgroundRepeat: "no-repeat",
        }}
      />
      <main className="relative flex flex-col gap-20 min-h-svh items-center justify-center p-4 text-foreground">
        <div className="stack">
          <img width={300} src={boxImg} alt="Cardboard Box" />
          <div className="box-clip">
            <Mascot
              className="mb-16"
              atlasUrl={catAtlas}
              size={240}
              label="cat"
              emotion={ready ? emotion : "sleepy"}
            />
          </div>
        </div>
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center gap-6">
            {/* One grid cell: the progress sits in the (still empty) chat area, so nothing moves when it goes. */}
            <div className="grid w-full *:col-start-1 *:row-start-1">
              <BubbleGroup
                className="min-h-60 w-full shrink-0"
                aria-live="polite"
              >
                {exchange && (
                  <>
                    <Bubble
                      align="end"
                      className="animate-in fade-in slide-in-from-bottom-2"
                    >
                      <BubbleContent>{exchange.question}</BubbleContent>
                    </Bubble>
                    <Bubble
                      variant="muted"
                      className="animate-in fade-in slide-in-from-bottom-2"
                    >
                      <BubbleContent>
                        {exchange.answer.trim() || "…"}
                      </BubbleContent>
                    </Bubble>
                  </>
                )}
              </BubbleGroup>

              {!ready && (
                <Progress value={progress} className="w-full self-center">
                  <ProgressLabel>
                    {progress < 100
                      ? `Waking up… ${Math.round(progress)}%`
                      : "Stretching…"}
                  </ProgressLabel>
                </Progress>
              )}
            </div>

            <form onSubmit={onSubmit} className="flex w-full">
              <Input
                value={text}
                disabled={!ready}
                onChange={(e) => setText(e.target.value)}
                placeholder="Say something to your meowsona…"
                aria-label="Message"
                className="border-input border-r-0 px-3"
              />
              <Button type="submit" disabled={!ready || !text.trim()}>
                Send
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

export default App;
