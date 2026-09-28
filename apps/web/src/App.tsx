import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Mascot } from "react-meowsona";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Bubble, BubbleContent, BubbleGroup } from "@/components/ui/bubble";
import catAtlas from "./assets/cat.png";
import "./App.css";

const REPLY_DELAY = 600;
const VISIBLE_FOR = 6000;

// ponytail: mocked reply, swap for a real API call later
function askAvatar(_question: string) {
  return new Promise<string>((resolve) =>
    setTimeout(
      () => resolve("Meow! I am just a mock for now, but I heard you."),
      REPLY_DELAY,
    ),
  );
}

type Exchange = { question: string; answer?: string };

function App() {
  const [text, setText] = useState("");
  const [exchange, setExchange] = useState<Exchange | null>(null);
  const hideTimer = useRef<number>(undefined);
  const askId = useRef(0);

  useEffect(() => () => clearTimeout(hideTimer.current), []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const question = text.trim();
    if (!question) return;
    const id = ++askId.current;
    clearTimeout(hideTimer.current);
    setText("");
    setExchange({ question });
    const answer = await askAvatar(question);
    if (id !== askId.current) return; // a newer question replaced this one
    setExchange({ question, answer });
    hideTimer.current = window.setTimeout(() => setExchange(null), VISIBLE_FOR);
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
          rgba(255, 140, 60, 0.5),
          transparent 70%
        )
      `,
          filter: "blur(80px)",
          backgroundRepeat: "no-repeat",
        }}
      />
      <main className="relative flex min-h-svh items-center justify-center p-4 text-foreground">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center gap-6">
            <Mascot atlasUrl={catAtlas} size={160} label="cat" />

            <BubbleGroup className="h-40 w-full shrink-0 overflow-y-auto" aria-live="polite">
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
                    <BubbleContent>{exchange.answer ?? "…"}</BubbleContent>
                  </Bubble>
                </>
              )}
            </BubbleGroup>

            <form onSubmit={onSubmit} className="flex w-full">
              <Input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Say something to your meowsona…"
                aria-label="Message"
              className="border-input border-r-0 px-3"
              />
              <Button type="submit" disabled={!text.trim()}>
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
