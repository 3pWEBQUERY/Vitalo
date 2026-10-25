"use client";

import { useEffect, useRef, useState } from "react";
import { Icon, type IconName } from "./Icon";
import { Phone, type Screen } from "./Phone";

export type StoryStep = { screen: Screen; icon: IconName; kicker: string; title: string; text: string; points: string[] };

/**
 * Text steps scroll past a sticky phone; the screen follows the step in the middle of the
 * viewport. On narrow screens every step shows its own phone instead.
 */
export function Story({ steps }: { steps: StoryStep[] }) {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(Number((entry.target as HTMLElement).dataset.index));
        }
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    refs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="story">
      <div className="story-steps">
        {steps.map((step, index) => (
          <article
            key={step.screen}
            ref={(el) => { refs.current[index] = el; }}
            data-index={index}
            className="story-step"
            data-active={index === active}
          >
            <div className="story-kicker"><Icon name={step.icon} size={18} />{step.kicker}</div>
            <h3>{step.title}</h3>
            <p>{step.text}</p>
            <ul className="ticks">
              {step.points.map((p) => <li key={p}><Icon name="check" size={16} />{p}</li>)}
            </ul>
            <Phone screen={step.screen} className="story-inline-phone" />
          </article>
        ))}
      </div>
      <div className="story-stage" aria-hidden>
        <div className="story-sticky">
          <div className="story-phones">
            {steps.map((step, index) => (
              <div key={step.screen} className="story-layer" data-state={index === active ? "on" : index < active ? "past" : "next"}>
                <Phone screen={step.screen} />
              </div>
            ))}
          </div>
          <div className="story-dots">
            {steps.map((step, index) => <span key={step.screen} data-active={index === active} />)}
          </div>
        </div>
      </div>
    </div>
  );
}
