import { useEffect, useRef } from "react";

import { gsap, prefersReducedMotion } from "@/lib/gsap";

type Node = {
  x: number;
  y: number;
  w: number;
  title: string;
  caption: string;
  tone: "ink" | "voltage" | "outline";
};

const nodes: Node[] = [
  {
    x: 8,
    y: 24,
    w: 190,
    title: "Lojista parceiro",
    caption: "monta a proposta no balcão",
    tone: "outline",
  },
  {
    x: 235,
    y: 118,
    w: 210,
    title: "PayMotors",
    caption: "analisa, aprova e financia",
    tone: "voltage",
  },
  {
    x: 8,
    y: 214,
    w: 190,
    title: "Consumidor final",
    caption: "sai com a moto elétrica",
    tone: "outline",
  },
  { x: 482, y: 24, w: 150, title: "Repasse D+2", caption: "à loja", tone: "ink" },
  { x: 482, y: 214, w: 150, title: "Parcela fixa", caption: "sem cartão", tone: "ink" },
];

/**
 * The operational diagram: a single orchestrated draw-in of the credit path
 * between the store, PayMotors and the end customer.
 */
export function OperationFlow() {
  const rootRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (prefersReducedMotion()) return;

    const paths = Array.from(root.querySelectorAll<SVGPathElement>("[data-flow-path]"));
    const boxes = Array.from(root.querySelectorAll<SVGGElement>("[data-flow-node]"));

    const ctx = gsap.context(() => {
      paths.forEach((path) => {
        const length = path.getTotalLength();
        gsap.set(path, { strokeDasharray: length, strokeDashoffset: length });
      });
      gsap.set(boxes, { autoAlpha: 0, y: 8 });

      const tl = gsap.timeline({ defaults: { ease: "power2.out" } });
      tl.to(boxes, { autoAlpha: 1, y: 0, duration: 0.5, stagger: 0.09 })
        .to(paths, { strokeDashoffset: 0, duration: 0.9, stagger: 0.14 }, "-=0.25")
        .fromTo(
          "[data-flow-pulse]",
          { scale: 0.7, transformOrigin: "center" },
          { scale: 1, autoAlpha: 1, duration: 0.5, ease: "back.out(2)" },
          "-=0.35",
        );
    }, root);

    return () => ctx.revert();
  }, []);

  return (
    <svg
      ref={rootRef}
      viewBox="0 0 640 300"
      role="img"
      aria-label="Fluxo da operação: o lojista parceiro monta a proposta, a PayMotors analisa e financia, o consumidor final sai com a moto elétrica; a loja recebe o repasse em dois dias úteis e o cliente paga parcela fixa sem cartão."
      className="w-full"
    >
      <g fill="none" stroke="var(--hairline)" strokeWidth="1.5">
        <path data-flow-path d="M198 48 C 260 48, 240 120, 300 150" stroke="var(--voltage)" />
        <path data-flow-path d="M300 190 C 240 220, 260 238, 198 238" stroke="var(--voltage)" />
        <path data-flow-path d="M445 150 C 500 150, 480 90, 520 62" />
        <path data-flow-path d="M445 172 C 500 190, 480 200, 520 224" />
      </g>

      {nodes.map((node) => {
        const isVoltage = node.tone === "voltage";
        const isInk = node.tone === "ink";
        return (
          <g key={node.title} data-flow-node>
            <rect
              x={node.x}
              y={node.y}
              width={node.w}
              height={isVoltage ? 72 : 56}
              rx="6"
              fill={isVoltage ? "var(--voltage)" : isInk ? "var(--ink)" : "var(--card)"}
              stroke={isVoltage || isInk ? "none" : "var(--hairline)"}
            />
            <text
              x={node.x + 16}
              y={node.y + (isVoltage ? 32 : 24)}
              fontSize="15"
              fontWeight="700"
              fill={
                isVoltage
                  ? "var(--voltage-foreground)"
                  : isInk
                    ? "var(--ink-foreground)"
                    : "var(--foreground)"
              }
              style={{ fontFamily: "var(--font-display)" }}
            >
              {node.title}
            </text>
            <text
              x={node.x + 16}
              y={node.y + (isVoltage ? 52 : 42)}
              fontSize="11.5"
              fill={
                isVoltage
                  ? "color-mix(in oklab, var(--voltage-foreground) 80%, transparent)"
                  : isInk
                    ? "color-mix(in oklab, var(--ink-foreground) 70%, transparent)"
                    : "var(--muted-foreground)"
              }
            >
              {node.caption}
            </text>
          </g>
        );
      })}

      <circle data-flow-pulse cx="340" cy="118" r="6" fill="var(--secondary)" />
    </svg>
  );
}
