import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";

interface OnboardingProps {
  onComplete: (settings?: Record<string, unknown>) => void;
  userEmail?: string;
}

const slides = [
  {
    id: 0,
    label: "01 / WELCOME",
    headline: ["The OS for", "AI Agents."],
    sub: "One place to deploy, watch, and command every agent in your operation.",
    visual: "welcome",
    cta: null,
  },
  {
    id: 1,
    label: "02 / DEPLOY",
    headline: ["Spin up agents", "in seconds."],
    sub: "Describe a task. BASE assigns the right model and sets it to work.",
    visual: "deploy",
    cta: null,
  },
  {
    id: 2,
    label: "03 / WATCH",
    headline: ["See every", "thought unfold."],
    sub: "Real-time reasoning streams. Know exactly what your agents are doing and why.",
    visual: "watch",
    cta: null,
  },
  {
    id: 3,
    label: "04 / COMMAND",
    headline: ["You stay", "in control."],
    sub: "Pause. Redirect. Intervene. BASE keeps humans at the center of every decision.",
    visual: "command",
    cta: null,
  },
  {
    id: 4,
    label: "05 / BEGIN",
    headline: ["Your fleet", "awaits."],
    sub: null,
    visual: "begin",
    cta: "Enter BASE",
  },
];

function WelcomeVisual() {
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
      <div style={{ position: "relative", width: 420, height: 420 }}>
        <motion.div
          style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.06)" }}
          animate={{ rotate: 360 }}
          transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
        />
        <motion.div
          style={{ position: "absolute", inset: 40, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.1)" }}
          animate={{ rotate: -360 }}
          transition={{ duration: 28, repeat: Infinity, ease: "linear" }}
        >
          <div style={{ position: "absolute", top: -3, left: "50%", transform: "translateX(-50%)", width: 6, height: 6, borderRadius: "50%", background: "rgba(180,160,255,0.8)", boxShadow: "0 0 12px rgba(180,160,255,0.6)" }} />
        </motion.div>
        <motion.div
          style={{ position: "absolute", inset: 80, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.08)" }}
          animate={{ rotate: 360 }}
          transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
        >
          <div style={{ position: "absolute", bottom: -3, left: "50%", transform: "translateX(-50%)", width: 5, height: 5, borderRadius: "50%", background: "rgba(120,200,255,0.8)", boxShadow: "0 0 10px rgba(120,200,255,0.5)" }} />
        </motion.div>
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <motion.div
            style={{ width: 64, height: 64, borderRadius: "50%", background: "radial-gradient(circle, rgba(180,160,255,0.3) 0%, rgba(180,160,255,0) 70%)", border: "1px solid rgba(180,160,255,0.4)", display: "flex", alignItems: "center", justifyContent: "center" }}
            animate={{ scale: [1, 1.08, 1] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          >
            <span style={{ fontSize: 22, color: "rgba(220,210,255,0.9)" }}>◈</span>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

function DeployVisual() {
  const agents = [
    { label: "Research", color: "#a78bfa", delay: 0 },
    { label: "Writer", color: "#60a5fa", delay: 0.3 },
    { label: "Analyst", color: "#34d399", delay: 0.6 },
    { label: "Monitor", color: "#f472b6", delay: 0.9 },
  ];
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
      <div style={{ display: "flex", gap: 20 }}>
        {agents.map((a) => (
          <motion.div
            key={a.label}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + a.delay, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            style={{ width: 100, padding: "18px 0", background: "rgba(255,255,255,0.04)", border: `1px solid ${a.color}33`, borderRadius: 12, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}
          >
            <motion.div
              style={{ width: 36, height: 36, borderRadius: "50%", background: `${a.color}22`, border: `1px solid ${a.color}66`, display: "flex", alignItems: "center", justifyContent: "center" }}
              animate={{ boxShadow: [`0 0 0px ${a.color}00`, `0 0 16px ${a.color}55`, `0 0 0px ${a.color}00`] }}
              transition={{ duration: 2.5, repeat: Infinity, delay: a.delay }}
            >
              <span style={{ fontSize: 14, color: a.color }}>◈</span>
            </motion.div>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", letterSpacing: "0.08em", textTransform: "uppercase" }}>{a.label}</span>
            <motion.div
              style={{ fontSize: 10, color: a.color, opacity: 0.8 }}
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity, delay: a.delay }}
            >
              ● ACTIVE
            </motion.div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function WatchVisual() {
  const lines = [
    { text: "Analyzing source documents...", color: "#a78bfa", delay: 0 },
    { text: "Cross-referencing 847 data points", color: "#60a5fa", delay: 0.4 },
    { text: "Identified 3 conflicting claims", color: "#f59e0b", delay: 0.8 },
    { text: "Generating summary draft...", color: "#34d399", delay: 1.2 },
    { text: "Confidence: 94.2%", color: "#a78bfa", delay: 1.6 },
  ];
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
      <div style={{ width: 380, padding: "24px 28px", background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, backdropFilter: "blur(20px)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
          <motion.div
            style={{ width: 8, height: 8, borderRadius: "50%", background: "#34d399" }}
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1.2, repeat: Infinity }}
          />
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", letterSpacing: "0.1em", textTransform: "uppercase" }}>Live Reasoning</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {lines.map((l, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + l.delay, duration: 0.4 }}
              style={{ display: "flex", gap: 10, alignItems: "flex-start" }}
            >
              <span style={{ color: l.color, fontSize: 11, marginTop: 1, flexShrink: 0 }}>›</span>
              <span style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", lineHeight: 1.4 }}>{l.text}</span>
            </motion.div>
          ))}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0] }}
            transition={{ delay: 2.2, duration: 1, repeat: Infinity }}
            style={{ display: "flex", gap: 10, alignItems: "center" }}
          >
            <span style={{ color: "#a78bfa", fontSize: 11 }}>›</span>
            <div style={{ width: 2, height: 14, background: "#a78bfa", borderRadius: 1 }} />
          </motion.div>
        </div>
      </div>
    </div>
  );
}

function CommandVisual() {
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, width: 400 }}>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          style={{ padding: "14px 18px", background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.25)", borderRadius: 10, display: "flex", alignItems: "center", gap: 10 }}
        >
          <span style={{ color: "rgba(167,139,250,0.7)", fontSize: 13 }}>⌘</span>
          <span style={{ fontSize: 14, color: "rgba(255,255,255,0.8)" }}>Pause the research agent and review</span>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          style={{ padding: "14px 18px", background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10 }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 11, color: "rgba(167,139,250,0.8)", letterSpacing: "0.08em" }}>BASE</span>
            <motion.div
              style={{ width: 4, height: 4, borderRadius: "50%", background: "#34d399" }}
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1.2, repeat: Infinity }}
            />
          </div>
          <span style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", lineHeight: 1.5 }}>
            Research agent paused. Saved 3 in-progress threads. Ready for your review.
          </span>
        </motion.div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.1 }}
          style={{ display: "flex", gap: 8 }}
        >
          <div style={{ padding: "5px 12px", background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.25)", borderRadius: 6, fontSize: 11, color: "#fbbf24" }}>⏸ Research — paused</div>
          <div style={{ padding: "5px 12px", background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.25)", borderRadius: 6, fontSize: 11, color: "#34d399" }}>● Writer — running</div>
        </motion.div>
      </div>
    </div>
  );
}

function BeginVisual() {
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
      <div style={{ position: "relative", width: 300, height: 300 }}>
        {[0, 1, 2].map(i => (
          <motion.div
            key={i}
            style={{ position: "absolute", inset: i * 40, borderRadius: "50%", border: "1px solid rgba(167,139,250,0.15)" }}
            animate={{ scale: [1, 1.04, 1], opacity: [0.4, 0.8, 0.4] }}
            transition={{ duration: 3 + i, repeat: Infinity, delay: i * 0.6, ease: "easeInOut" }}
          />
        ))}
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <motion.div
            style={{ width: 80, height: 80, borderRadius: "50%", background: "radial-gradient(circle, rgba(167,139,250,0.4) 0%, rgba(167,139,250,0) 70%)", border: "1px solid rgba(167,139,250,0.5)", display: "flex", alignItems: "center", justifyContent: "center" }}
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
          >
            <span style={{ fontSize: 32, color: "rgba(220,210,255,0.9)" }}>◈</span>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

const visuals: Record<string, React.ReactElement> = {
  welcome: <WelcomeVisual />,
  deploy: <DeployVisual />,
  watch: <WatchVisual />,
  command: <CommandVisual />,
  begin: <BeginVisual />,
};

export default function Onboarding({ onComplete }: OnboardingProps) {
  const [current, setCurrent] = useState(0);
  const slide = slides[current];
  const isLast = current === slides.length - 1;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") {
        if (!isLast) setCurrent(c => c + 1);
      }
      if (e.key === "ArrowLeft") {
        setCurrent(c => Math.max(0, c - 1));
      }
      if (e.key === "Enter" && isLast) onComplete();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isLast, onComplete]);

  return (
    <div style={{ width: "100vw", height: "100vh", background: "#070709", overflow: "hidden", position: "relative", fontFamily: "'SF Mono', 'Fira Code', monospace" }}>
      {/* Ambient glow */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: `radial-gradient(ellipse 60% 50% at ${30 + current * 10}% 50%, rgba(100,60,200,0.07) 0%, transparent 70%)`, transition: "background 0.8s ease" }} />

      {/* Visual */}
      <AnimatePresence mode="wait">
        <motion.div key={`visual-${current}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }} style={{ position: "absolute", inset: 0 }}>
          {visuals[slide.visual]}
        </motion.div>
      </AnimatePresence>

      {/* Top label */}
      <AnimatePresence mode="wait">
        <motion.div key={`label-${current}`} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.4 }} style={{ position: "absolute", top: 36, left: 44, fontSize: 11, letterSpacing: "0.18em", color: "rgba(255,255,255,0.25)", textTransform: "uppercase" }}>
          {slide.label}
        </motion.div>
      </AnimatePresence>

      {/* Skip */}
      {!isLast && (
        <button onClick={onComplete} style={{ position: "absolute", top: 34, right: 44, fontSize: 11, letterSpacing: "0.12em", color: "rgba(255,255,255,0.2)", background: "none", border: "none", cursor: "pointer", textTransform: "uppercase", transition: "color 0.2s" }} onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.5)")} onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.2)")}>
          Skip →
        </button>
      )}

      {/* Main text */}
      <div style={{ position: "absolute", bottom: 100, left: 60, right: "45%" }}>
        <AnimatePresence mode="wait">
          <motion.div key={`text-${current}`}>
            <motion.h1
              initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
              style={{ fontSize: 52, fontWeight: 700, lineHeight: 1.1, color: "#fff", margin: "0 0 20px", fontFamily: "'SF Pro Display', 'Helvetica Neue', sans-serif", letterSpacing: "-0.02em" }}
            >
              {slide.headline[0]}<br />
              <span style={{ color: "rgba(167,139,250,0.9)" }}>{slide.headline[1]}</span>
            </motion.h1>

            {slide.sub && (
              <motion.p
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
                style={{ fontSize: 16, lineHeight: 1.6, color: "rgba(255,255,255,0.45)", maxWidth: 380, margin: 0, fontFamily: "'SF Pro Text', 'Helvetica Neue', sans-serif" }}
              >
                {slide.sub}
              </motion.p>
            )}

            {slide.cta && (
              <motion.button
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.5, delay: 0.15 }}
                onClick={onComplete}
                style={{ marginTop: 32, padding: "14px 32px", background: "rgba(167,139,250,0.15)", border: "1px solid rgba(167,139,250,0.4)", borderRadius: 8, fontSize: 14, fontWeight: 500, color: "rgba(220,210,255,0.95)", cursor: "pointer", letterSpacing: "0.04em", fontFamily: "'SF Pro Text', 'Helvetica Neue', sans-serif", transition: "all 0.2s" }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(167,139,250,0.25)"; e.currentTarget.style.borderColor = "rgba(167,139,250,0.7)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(167,139,250,0.15)"; e.currentTarget.style.borderColor = "rgba(167,139,250,0.4)"; }}
              >
                {slide.cta}
              </motion.button>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Progress + nav */}
      <div style={{ position: "absolute", bottom: 36, left: 60, display: "flex", alignItems: "center", gap: 24 }}>
        <div style={{ display: "flex", gap: 8 }}>
          {slides.map((_, i) => (
            <button key={i} onClick={() => setCurrent(i)} style={{ width: i === current ? 24 : 6, height: 6, borderRadius: 3, background: i === current ? "rgba(167,139,250,0.8)" : "rgba(255,255,255,0.15)", border: "none", cursor: "pointer", padding: 0, transition: "all 0.3s ease" }} />
          ))}
        </div>
        {!isLast && (
          <button onClick={() => setCurrent(c => c + 1)} style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", background: "none", border: "none", cursor: "pointer", letterSpacing: "0.1em", textTransform: "uppercase", transition: "color 0.2s" }} onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.6)")} onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.3)")}>
            Next →
          </button>
        )}
      </div>
    </div>
  );
}