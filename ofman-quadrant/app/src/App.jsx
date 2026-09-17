import { useEffect, useMemo, useRef, useState } from 'react'

// ---------------------------------------------------------------------------
// Content: the eleven questions, grouped by quadrant.
//
// The first question in each quadrant asks for a short label (a word or
// phrase) — that's what ends up printed inside the diagram box. The
// follow-up questions dig deeper and feed the personalised summary.
// ---------------------------------------------------------------------------

const QUADRANTS = {
  core: {
    key: 'core',
    title: 'Core Quality',
    tagline: 'The strength that comes from who you are',
    accent: 'text-indigo-600 dark:text-indigo-400',
    ring: 'ring-indigo-200 dark:ring-indigo-900',
    dot: 'bg-indigo-500',
  },
  pitfall: {
    key: 'pitfall',
    title: 'Pitfall',
    tagline: 'What happens when that strength goes too far',
    accent: 'text-amber-600 dark:text-amber-400',
    ring: 'ring-amber-200 dark:ring-amber-900',
    dot: 'bg-amber-500',
  },
  challenge: {
    key: 'challenge',
    title: 'Challenge',
    tagline: 'The positive opposite of the pitfall',
    accent: 'text-emerald-600 dark:text-emerald-400',
    ring: 'ring-emerald-200 dark:ring-emerald-900',
    dot: 'bg-emerald-500',
  },
  allergy: {
    key: 'allergy',
    title: 'Allergy',
    tagline: 'What you can’t stand when others overdo the challenge',
    accent: 'text-rose-600 dark:text-rose-400',
    ring: 'ring-rose-200 dark:ring-rose-900',
    dot: 'bg-rose-500',
  },
}

const QUESTIONS = [
  // Core Quality (3)
  {
    quadrant: 'core',
    isLabel: true,
    prompt: 'If you had to name this quality in a word or short phrase, what would you call it?',
    helper: 'Don’t overthink it — the first word that comes to mind is usually right.',
    placeholder: 'e.g. organised, warm, decisive, curious…',
  },
  {
    quadrant: 'core',
    isLabel: false,
    prompt: 'What do you take for granted in yourself — the thing you just assume everyone can do, but not everyone can?',
    helper: 'This is often so natural to you that you’ve never really named it before.',
    placeholder: 'I’ve always just been able to…',
  },
  {
    quadrant: 'core',
    isLabel: false,
    prompt: 'Think of a specific moment you were fully in your element. What were you doing, and what quality made it work?',
    helper: 'A real moment, not a hypothetical one, makes this easier to answer.',
    placeholder: 'There was this one time when…',
  },
  // Pitfall (3)
  {
    quadrant: 'pitfall',
    isLabel: true,
    prompt: 'In a word or short phrase, what does this quality turn into when you take it too far?',
    helper: 'Your pitfall is your core quality overdone — a strength that tips into a weakness.',
    placeholder: 'e.g. rigid, pushy, invisible, scattered…',
  },
  {
    quadrant: 'pitfall',
    isLabel: false,
    prompt: 'What kind of feedback do you hear more than once — the corrective kind that stings a little because it’s not entirely wrong?',
    helper: 'Think about the pattern behind it, not just one bad day.',
    placeholder: 'People have told me before that I…',
  },
  {
    quadrant: 'pitfall',
    isLabel: false,
    prompt: 'What are you inclined to justify or defend in yourself, even when you can see it’s landing badly?',
    helper: 'This is the moment your strength stops helping and starts working against you.',
    placeholder: 'I know I do this, but I tell myself…',
  },
  // Challenge (3)
  {
    quadrant: 'challenge',
    isLabel: true,
    prompt: 'In a word or short phrase, what’s the quality you’d like to develop more of?',
    helper: 'This is the positive opposite of your pitfall — not its polar extreme, its balance.',
    placeholder: 'e.g. flexibility, patience, self-promotion…',
  },
  {
    quadrant: 'challenge',
    isLabel: false,
    prompt: 'What do you admire in other people — something you wish came a little more naturally to you?',
    helper: 'It’s fine if this feels slightly uncomfortable or effortful to imagine doing yourself.',
    placeholder: 'I really admire people who can…',
  },
  {
    quadrant: 'challenge',
    isLabel: false,
    prompt: 'What do the people close to you sometimes wish you’d do more of?',
    helper: 'A partner, friend, or colleague’s gentle nudge often points straight at this.',
    placeholder: 'They’ve said things like…',
  },
  // Allergy (2)
  {
    quadrant: 'allergy',
    isLabel: true,
    prompt: 'In a word or short phrase, what does that challenge look like when someone else takes it too far?',
    helper: 'Your allergy is your challenge, overdone in someone else — and it often ends up looking like the very opposite of your core quality.',
    placeholder: 'e.g. chaos, passivity, arrogance…',
  },
  {
    quadrant: 'allergy',
    isLabel: false,
    prompt: 'What behaviour in other people genuinely gets under your skin — more than it probably should?',
    helper: 'The stronger the reaction, the more it usually has to teach you.',
    placeholder: 'I find it really hard to be around people who…',
  },
]

// ---------------------------------------------------------------------------
// SVG diagram helpers — box size is derived from the text it holds, never
// hardcoded. This is a lightweight character-width heuristic rather than a
// real text measurement, so it stays fast and dependency-free.
// ---------------------------------------------------------------------------

const NARROW = new Set('iIl.,:;\'|!ftj'.split(''))
const WIDE = new Set('mwMW@%'.split(''))

function estimateTextWidth(text, fontSize) {
  let units = 0
  for (const ch of text) {
    if (ch === ' ') units += 0.3
    else if (NARROW.has(ch)) units += 0.3
    else if (WIDE.has(ch)) units += 0.85
    else if (/[A-Z]/.test(ch)) units += 0.68
    else if (/[0-9]/.test(ch)) units += 0.58
    else units += 0.52
  }
  return units * fontSize
}

function wrapText(text, maxWidth, fontSize) {
  const words = text.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return ['']
  const lines = []
  let current = words[0]
  for (let i = 1; i < words.length; i++) {
    const word = words[i]
    const candidate = `${current} ${word}`
    if (estimateTextWidth(candidate, fontSize) <= maxWidth) {
      current = candidate
    } else {
      lines.push(current)
      current = word
    }
  }
  lines.push(current)
  return lines
}

function computeBox(text, { fontSize = 16, minWidth = 168, maxTextWidth = 230, padX = 20, padY = 18, lineHeight = 22 }) {
  const label = text.trim() || '—'
  const lines = wrapText(label, maxTextWidth, fontSize)
  const longest = Math.max(...lines.map((l) => estimateTextWidth(l, fontSize)))
  const width = Math.max(minWidth, Math.ceil(longest) + padX * 2)
  const height = lines.length * lineHeight + padY * 2
  return { lines, width, height, fontSize, lineHeight, padX, padY }
}

function OfmanDiagram({ svgRef, values }) {
  const boxOpts = { fontSize: 16, lineHeight: 22 }
  const core = useMemo(() => computeBox(values.core, boxOpts), [values.core])
  const pitfall = useMemo(() => computeBox(values.pitfall, boxOpts), [values.pitfall])
  const challenge = useMemo(() => computeBox(values.challenge, boxOpts), [values.challenge])
  const allergy = useMemo(() => computeBox(values.allergy, boxOpts), [values.allergy])

  const colWidth = [Math.max(core.width, allergy.width), Math.max(pitfall.width, challenge.width)]
  const rowHeight = [Math.max(core.height, pitfall.height), Math.max(allergy.height, challenge.height)]

  const margin = 36
  const labelSpace = 30
  const gapH = 130
  const gapV = 100

  const colX = [margin, margin + colWidth[0] + gapH]
  const rowY = [margin + labelSpace, margin + labelSpace + rowHeight[0] + gapV]

  const boxes = {
    core: { ...core, x: colX[0], y: rowY[0], w: colWidth[0], h: rowHeight[0] },
    pitfall: { ...pitfall, x: colX[1], y: rowY[0], w: colWidth[1], h: rowHeight[0] },
    allergy: { ...allergy, x: colX[0], y: rowY[1], w: colWidth[0], h: rowHeight[1] },
    challenge: { ...challenge, x: colX[1], y: rowY[1], w: colWidth[1], h: rowHeight[1] },
  }

  const width = colX[1] + colWidth[1] + margin
  const height = rowY[1] + rowHeight[1] + margin + 12

  const center = (box) => ({ cx: box.x + box.w / 2, cy: box.y + box.h / 2 })

  const palette = {
    core: '#4f46e5',
    pitfall: '#d97706',
    challenge: '#059669',
    allergy: '#e11d48',
  }

  function renderBox(key, title) {
    const box = boxes[key]
    return (
      <g key={key}>
        <text
          x={box.x + box.w / 2}
          y={box.y - 10}
          textAnchor="middle"
          fontSize="12"
          fontWeight="700"
          letterSpacing="0.08em"
          fill={palette[key]}
          style={{ textTransform: 'uppercase' }}
        >
          {title}
        </text>
        <rect
          x={box.x}
          y={box.y}
          width={box.w}
          height={box.h}
          rx="14"
          fill="#ffffff"
          stroke={palette[key]}
          strokeWidth="2"
        />
        {box.lines.map((line, i) => {
          const lineBlockHeight = box.lines.length * box.lineHeight
          const startY = box.y + box.h / 2 - lineBlockHeight / 2 + box.lineHeight * 0.72
          return (
            <text
              key={i}
              x={box.x + box.w / 2}
              y={startY + i * box.lineHeight}
              textAnchor="middle"
              fontSize={box.fontSize}
              fontWeight="600"
              fill="#1e293b"
            >
              {line}
            </text>
          )
        })}
      </g>
    )
  }

  function edgeLabel(x, y, text, anchor = 'middle') {
    const w = estimateTextWidth(text, 11) + 12
    return (
      <g>
        <rect x={x - w / 2} y={y - 10} width={w} height={18} fill="#ffffff" opacity="0.92" rx="4" />
        <text x={x} y={y + 3} textAnchor={anchor} fontSize="11" fill="#475569" fontStyle="italic">
          {text}
        </text>
      </g>
    )
  }

  const arrowGap = 8

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      role="img"
      aria-label="Ofman core quadrant diagram showing your core quality, pitfall, challenge and allergy"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="0" y="0" width={width} height={height} fill="#ffffff" />
      <defs>
        <marker id="arrowhead" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" fill="#64748b" />
        </marker>
      </defs>

      {/* diagonal complement line */}
      <line
        x1={boxes.core.x + boxes.core.w}
        y1={boxes.core.y + boxes.core.h}
        x2={boxes.challenge.x}
        y2={boxes.challenge.y}
        stroke="#94a3b8"
        strokeWidth="1.5"
        strokeDasharray="5 5"
      />
      {edgeLabel(
        (boxes.core.x + boxes.core.w + boxes.challenge.x) / 2,
        (boxes.core.y + boxes.core.h + boxes.challenge.y) / 2,
        'complements'
      )}

      {/* core -> pitfall */}
      <line
        x1={boxes.core.x + boxes.core.w + arrowGap}
        y1={center(boxes.core).cy}
        x2={boxes.pitfall.x - arrowGap}
        y2={center(boxes.pitfall).cy}
        stroke="#64748b"
        strokeWidth="2"
        markerEnd="url(#arrowhead)"
      />
      {edgeLabel(center(boxes.core).cx + colWidth[0] / 2 + gapH / 2, center(boxes.core).cy - 14, 'too much of a good thing')}

      {/* pitfall -> challenge */}
      <line
        x1={center(boxes.pitfall).cx}
        y1={boxes.pitfall.y + boxes.pitfall.h + arrowGap}
        x2={center(boxes.challenge).cx}
        y2={boxes.challenge.y - arrowGap}
        stroke="#64748b"
        strokeWidth="2"
        markerEnd="url(#arrowhead)"
      />
      {edgeLabel(center(boxes.pitfall).cx + 62, (boxes.pitfall.y + boxes.pitfall.h + boxes.challenge.y) / 2, 'positive opposite')}

      {/* challenge -> allergy */}
      <line
        x1={boxes.challenge.x - arrowGap}
        y1={center(boxes.challenge).cy}
        x2={boxes.allergy.x + boxes.allergy.w + arrowGap}
        y2={center(boxes.allergy).cy}
        stroke="#64748b"
        strokeWidth="2"
        markerEnd="url(#arrowhead)"
      />
      {edgeLabel(center(boxes.allergy).cx + colWidth[0] / 2 + gapH / 2, center(boxes.allergy).cy + 20, 'too much of a good thing')}

      {/* allergy -> core */}
      <line
        x1={center(boxes.allergy).cx}
        y1={boxes.allergy.y - arrowGap}
        x2={center(boxes.core).cx}
        y2={boxes.core.y + boxes.core.h + arrowGap}
        stroke="#64748b"
        strokeWidth="2"
        markerEnd="url(#arrowhead)"
      />
      {edgeLabel(center(boxes.core).cx - 62, (boxes.allergy.y + boxes.core.y + boxes.core.h) / 2, 'positive opposite')}

      {renderBox('core', 'Core Quality')}
      {renderBox('pitfall', 'Pitfall')}
      {renderBox('allergy', 'Allergy')}
      {renderBox('challenge', 'Challenge')}
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Summary generation
// ---------------------------------------------------------------------------

function lower(text) {
  const t = (text || '').trim()
  return t ? t.charAt(0).toLowerCase() + t.slice(1) : t
}

function quote(text) {
  const t = (text || '').trim()
  return t ? `“${t}”` : ''
}

function buildSummary(answers) {
  const [coreLabel, coreTaken, coreMoment] = answers.slice(0, 3)
  const [pitfallLabel, pitfallFeedback, pitfallJustify] = answers.slice(3, 6)
  const [challengeLabel, challengeAdmire, challengeWish] = answers.slice(6, 9)
  const [allergyLabel, allergyIrritation] = answers.slice(9, 11)

  const paragraphs = []

  paragraphs.push(
    `Your core quality centres on ${wrap(coreLabel)}. Asked what you take for granted in yourself, you said: ${quote(coreTaken)}. And a moment that captured it well: ${quote(coreMoment)}. That’s the strength doing its quiet work in the background. But every strength has a shadow side — when ${lower(coreLabel)} gets pushed too far under pressure, it tips into ${wrap(pitfallLabel)}. You already know the pattern: ${quote(pitfallFeedback)} is the kind of feedback that keeps surfacing, and in the moment you tend to tell yourself, ${quote(pitfallJustify)}`
  )

  paragraphs.push(
    `The way back into balance isn’t to abandon ${lower(coreLabel)} — it’s to grow ${wrap(challengeLabel)} alongside it. This challenge matters because it’s the positive opposite of ${lower(pitfallLabel)}: not a different person to become, just a muscle you haven’t used as much. It’s no accident that you admire people who can ${quote(challengeAdmire)}, or that the people close to you have hinted, ${quote(challengeWish)} That’s ${lower(challengeLabel)} pointing straight at you.`
  )

  paragraphs.push(
    `It’s also worth noticing what happens when someone overdoes ${lower(challengeLabel)}: it reads to you as ${wrap(allergyLabel)} — and, tellingly, that usually sits close to the opposite of ${wrap(coreLabel)} itself. By your own account, what gets under your skin is people who ${quote(allergyIrritation)} That reaction isn’t random — an allergy is usually a strength you haven’t grown into yet, seen at its worst in someone else. The very thing that irritates you may be showing you the edge of your own growth.`
  )

  const steps = buildNextSteps({ coreLabel, pitfallLabel, challengeLabel, allergyLabel })

  return { paragraphs, steps }
}

function wrap(text) {
  const t = (text || '').trim()
  return t ? `“${t}”` : '“this quality”'
}

function buildNextSteps({ coreLabel, pitfallLabel, challengeLabel, allergyLabel }) {
  return [
    `Next time you notice yourself sliding from ${lower(coreLabel) || 'your core quality'} into ${lower(pitfallLabel) || 'your pitfall'}, treat it as a signal rather than a failure — it usually means stress or uncertainty is running the show, not you.`,
    `Pick one low-stakes moment this week to deliberately practise ${lower(challengeLabel) || 'your challenge'}. Small, repeated reps count for more than one big gesture.`,
    `Next time ${lower(allergyLabel) || 'that allergy'} shows up in someone else, get curious instead of irritated — ask what strength might be hiding underneath it, and whether it’s the ${lower(challengeLabel) || 'challenge'} you’re still learning yourself.`,
  ]
}

// ---------------------------------------------------------------------------
// Screens
// ---------------------------------------------------------------------------

function ProgressBar({ current, total }) {
  const pct = Math.round((current / total) * 100)
  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2 text-sm text-slate-500 dark:text-slate-400">
        <span>
          Question {current} of {total}
        </span>
        <span>{pct}%</span>
      </div>
      <div
        className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Assessment progress: question ${current} of ${total}`}
      >
        <div
          className="h-full rounded-full bg-indigo-500 transition-all duration-300 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

const INTRO_SLIDES = [
  {
    kind: 'hook',
    title: 'Every strength has a shadow side',
    body: 'Psychologist Daniel Ofman noticed that when you push a strength too far — especially under pressure — it turns into a weakness. His Core Quadrant maps that pattern in four parts.',
  },
  {
    kind: 'quadrant',
    quadrant: 'core',
    title: 'Your core quality',
    body: 'A strength that comes from who you are — so natural you barely notice it. Being decisive, for example.',
  },
  {
    kind: 'quadrant',
    quadrant: 'pitfall',
    title: 'Pushed too far, it’s your pitfall',
    body: 'Overdo a strength, especially under stress, and it tips into a weakness. Decisive can turn into pushy.',
  },
  {
    kind: 'quadrant',
    quadrant: 'challenge',
    title: 'Your challenge is the balance',
    body: 'The positive opposite of the pitfall — not a different person, just a muscle to build. Pushy’s opposite is considerate.',
  },
  {
    kind: 'quadrant',
    quadrant: 'allergy',
    title: 'And what irritates you? Often your allergy',
    body: 'When someone overdoes your challenge, it can really grate on you — and, tellingly, it often looks like the opposite of your core quality. Too much consideration can look like passivity, the flip side of decisive.',
    closing: true,
  },
]

function Dots({ count, current }) {
  return (
    <div className="flex items-center gap-2" role="tablist" aria-label="Introduction progress">
      {Array.from({ length: count }).map((_, i) => (
        <span
          key={i}
          className={`h-1.5 rounded-full transition-all ${
            i === current
              ? 'w-6 bg-indigo-500'
              : i < current
                ? 'w-1.5 bg-indigo-300 dark:bg-indigo-700'
                : 'w-1.5 bg-slate-200 dark:bg-slate-700'
          }`}
        />
      ))}
    </div>
  )
}

function IntroScreen({ slideIndex, onNext, onPrev, onStart }) {
  const slide = INTRO_SLIDES[slideIndex]
  const meta = slide.quadrant ? QUADRANTS[slide.quadrant] : null

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Enter') {
        e.preventDefault()
        slide.closing ? onStart() : onNext()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [slide, onNext, onStart])

  return (
    <div className="min-h-screen flex flex-col px-5 py-8 sm:px-8 sm:py-12">
      <div className="w-full max-w-xl mx-auto flex-1 flex flex-col">
        <div className="flex items-center justify-between mb-10">
          <Dots count={INTRO_SLIDES.length} current={slideIndex} />
          <span className="text-sm text-slate-400 dark:text-slate-500">
            {slideIndex + 1} / {INTRO_SLIDES.length}
          </span>
        </div>

        <div key={slideIndex} className="animate-question-in flex-1 flex flex-col justify-center">
          {meta ? (
            <div className="flex items-center gap-2 mb-3">
              <span className={`inline-block h-2.5 w-2.5 rounded-full ${meta.dot}`} aria-hidden="true" />
              <span className={`text-sm font-semibold uppercase tracking-wide ${meta.accent}`}>
                {meta.title}
              </span>
            </div>
          ) : (
            <p className="text-sm font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mb-3">
              A short self-reflection tool
            </p>
          )}

          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-4 leading-snug">
            {slide.title}
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-300 leading-relaxed">{slide.body}</p>

          {slide.closing && (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-5 mt-8">
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-2 font-medium">
                Takes about 5 minutes
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                You’ll answer 11 short questions, one at a time — you can always go back to change
                one. At the end you’ll get a diagram and a summary you can copy or save, so don’t
                worry about losing your answers along the way.
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 mt-8">
          {slideIndex > 0 && (
            <button
              onClick={onPrev}
              className="inline-flex items-center justify-center rounded-xl px-6 py-3.5 text-base font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition focus:outline-none focus:ring-4 focus:ring-slate-200 dark:focus:ring-slate-700"
            >
              Back
            </button>
          )}
          <button
            onClick={slide.closing ? onStart : onNext}
            className="flex-1 inline-flex items-center justify-center rounded-xl bg-indigo-600 px-6 py-3.5 text-base font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-300 dark:focus:ring-indigo-800 active:scale-[0.98]"
          >
            {slide.closing ? 'Start the assessment' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  )
}

function QuestionScreen({ index, total, question, value, onChange, onNext, onPrev }) {
  const meta = QUADRANTS[question.quadrant]
  const trimmed = value.trim()
  const isEmpty = trimmed.length === 0
  const isShort = !isEmpty && trimmed.length < 10
  const fieldId = `question-${index}`
  const fieldRef = useRef(null)

  useEffect(() => {
    fieldRef.current?.focus()
  }, [index])

  function handleKeyDown(e) {
    if (question.isLabel) {
      if (e.key === 'Enter' && !isEmpty) {
        e.preventDefault()
        onNext()
      }
      return
    }
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !isEmpty) {
      onNext()
    }
  }

  return (
    <div className="min-h-screen flex flex-col px-5 py-8 sm:px-8 sm:py-12">
      <div className="w-full max-w-2xl mx-auto flex-1 flex flex-col">
        <ProgressBar current={index + 1} total={total} />

        <div key={index} className="animate-question-in mt-8 flex-1 flex flex-col">
          <div className="flex items-center gap-2 mb-3">
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${meta.dot}`} aria-hidden="true" />
            <span className={`text-sm font-semibold uppercase tracking-wide ${meta.accent}`}>
              {meta.title}
            </span>
          </div>

          <label htmlFor={fieldId} className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white leading-snug mb-3">
            {question.prompt}
          </label>
          <p className="text-slate-500 dark:text-slate-400 mb-6">{question.helper}</p>

          {question.isLabel ? (
            <input
              id={fieldId}
              ref={fieldRef}
              type="text"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={question.placeholder}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xl p-4 shadow-sm focus:outline-none focus:ring-4 focus:ring-indigo-200 dark:focus:ring-indigo-900 focus:border-indigo-500 placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />
          ) : (
            <>
              <textarea
                id={fieldId}
                ref={fieldRef}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={question.placeholder}
                rows={5}
                className="w-full flex-1 min-h-[120px] rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-lg p-4 shadow-sm focus:outline-none focus:ring-4 focus:ring-indigo-200 dark:focus:ring-indigo-900 focus:border-indigo-500 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                aria-describedby={`${fieldId}-hint`}
              />
              <div id={`${fieldId}-hint`} className="min-h-[1.5rem] mt-2 text-sm text-amber-600 dark:text-amber-400" aria-live="polite">
                {isShort ? 'Tell us a bit more if you can — a full thought helps your summary later.' : ''}
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-3 mt-6">
          <button
            onClick={onPrev}
            className="inline-flex items-center justify-center rounded-xl px-6 py-3.5 text-base font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition focus:outline-none focus:ring-4 focus:ring-slate-200 dark:focus:ring-slate-700"
          >
            Back
          </button>
          <button
            onClick={onNext}
            disabled={isEmpty}
            className="flex-1 inline-flex items-center justify-center rounded-xl px-6 py-3.5 text-base font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:cursor-not-allowed transition focus:outline-none focus:ring-4 focus:ring-indigo-300 dark:focus:ring-indigo-800 active:scale-[0.98]"
          >
            {index === total - 1 ? 'See my results' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ResultsScreen({ answers, onRestart, onEdit }) {
  const svgRef = useRef(null)
  const [copied, setCopied] = useState(false)
  const [downloadState, setDownloadState] = useState('idle')

  const values = {
    core: answers[0],
    pitfall: answers[3],
    challenge: answers[6],
    allergy: answers[9],
  }

  const { paragraphs, steps } = useMemo(() => buildSummary(answers), [answers])

  const summaryText = useMemo(() => {
    return [
      `My Ofman Core Quadrant`,
      `Core quality: ${values.core}`,
      `Pitfall: ${values.pitfall}`,
      `Challenge: ${values.challenge}`,
      `Allergy: ${values.allergy}`,
      '',
      ...paragraphs,
      '',
      'Next steps:',
      ...steps.map((s) => `- ${s}`),
    ].join('\n')
  }, [answers, paragraphs, steps])

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(summaryText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  function handleDownload() {
    const svgEl = svgRef.current
    if (!svgEl) return
    setDownloadState('working')

    const serializer = new XMLSerializer()
    const source = serializer.serializeToString(svgEl)
    const svgBlob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(svgBlob)

    const viewBox = svgEl.getAttribute('viewBox').split(' ').map(Number)
    const scale = 2
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = viewBox[2] * scale
      canvas.height = viewBox[3] * scale
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.scale(scale, scale)
      ctx.drawImage(img, 0, 0)
      URL.revokeObjectURL(url)

      canvas.toBlob((blob) => {
        const link = document.createElement('a')
        link.download = 'ofman-core-quadrant.png'
        link.href = URL.createObjectURL(blob)
        link.click()
        URL.revokeObjectURL(link.href)
        setDownloadState('idle')
      }, 'image/png')
    }
    img.onerror = () => setDownloadState('idle')
    img.src = url
  }

  return (
    <div className="min-h-screen px-5 py-10 sm:px-8 sm:py-14">
      <div className="w-full max-w-3xl mx-auto animate-fade-in">
        <p className="text-sm font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mb-2">
          Your results
        </p>
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white mb-8">
          Your Core Quadrant
        </h1>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white p-4 sm:p-8 overflow-x-auto mb-8">
          <OfmanDiagram svgRef={svgRef} values={values} />
        </div>

        <div className="flex flex-wrap gap-3 mb-10">
          <button
            onClick={handleDownload}
            disabled={downloadState === 'working'}
            className="inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition focus:outline-none focus:ring-4 focus:ring-indigo-300 dark:focus:ring-indigo-800 disabled:opacity-60"
          >
            {downloadState === 'working' ? 'Preparing image…' : 'Download as image'}
          </button>
          <button
            onClick={handleCopy}
            className="inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition focus:outline-none focus:ring-4 focus:ring-slate-200 dark:focus:ring-slate-700"
          >
            {copied ? 'Copied!' : 'Copy summary text'}
          </button>
          <button
            onClick={onEdit}
            className="inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition"
          >
            Edit my answers
          </button>
          <button
            onClick={onRestart}
            className="inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition"
          >
            Start over
          </button>
        </div>

        <div className="prose prose-slate dark:prose-invert max-w-none mb-10">
          {paragraphs.map((p, i) => (
            <p key={i} className="text-slate-700 dark:text-slate-300 leading-relaxed mb-4 text-base sm:text-lg">
              {p}
            </p>
          ))}
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-6 mb-10">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Next steps</h2>
          <ul className="space-y-3">
            {steps.map((step, i) => (
              <li key={i} className="flex gap-3 text-slate-700 dark:text-slate-300 leading-relaxed">
                <span className="flex-shrink-0 h-6 w-6 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 text-sm font-bold flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-sm text-slate-500 dark:text-slate-400">
          Want to go deeper? Read more about{' '}
          <a
            href="https://www.corequality.nl/?lang=en"
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-600 dark:text-indigo-400 underline hover:no-underline"
          >
            Daniel Ofman’s Core Quality model
          </a>
          .
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

const SCREEN = { INTRO: 'intro', FORM: 'form', RESULTS: 'results' }

export default function App() {
  const [screen, setScreen] = useState(SCREEN.INTRO)
  const [introStep, setIntroStep] = useState(0)
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState(() => QUESTIONS.map(() => ''))

  useEffect(() => {
    const titles = {
      [SCREEN.INTRO]: 'Ofman Core Quadrant',
      [SCREEN.FORM]: `Question ${step + 1} of ${QUESTIONS.length} — Ofman Core Quadrant`,
      [SCREEN.RESULTS]: 'Your Core Quadrant results',
    }
    document.title = titles[screen]
  }, [screen, step])

  function handleIntroNext() {
    setIntroStep((s) => Math.min(INTRO_SLIDES.length - 1, s + 1))
    window.scrollTo(0, 0)
  }

  function handleIntroPrev() {
    setIntroStep((s) => Math.max(0, s - 1))
    window.scrollTo(0, 0)
  }

  function handleStart() {
    setStep(0)
    setScreen(SCREEN.FORM)
    window.scrollTo(0, 0)
  }

  function handleChange(value) {
    setAnswers((prev) => {
      const next = [...prev]
      next[step] = value
      return next
    })
  }

  function handleNext() {
    if (!answers[step].trim()) return
    if (step === QUESTIONS.length - 1) {
      setScreen(SCREEN.RESULTS)
      window.scrollTo(0, 0)
      return
    }
    setStep((s) => s + 1)
    window.scrollTo(0, 0)
  }

  function handlePrev() {
    if (step === 0) {
      setIntroStep(INTRO_SLIDES.length - 1)
      setScreen(SCREEN.INTRO)
      window.scrollTo(0, 0)
      return
    }
    setStep((s) => Math.max(0, s - 1))
    window.scrollTo(0, 0)
  }

  function handleEdit() {
    setStep(0)
    setScreen(SCREEN.FORM)
    window.scrollTo(0, 0)
  }

  function handleRestart() {
    setAnswers(QUESTIONS.map(() => ''))
    setStep(0)
    setIntroStep(0)
    setScreen(SCREEN.INTRO)
    window.scrollTo(0, 0)
  }

  if (screen === SCREEN.INTRO) {
    return (
      <IntroScreen
        slideIndex={introStep}
        onNext={handleIntroNext}
        onPrev={handleIntroPrev}
        onStart={handleStart}
      />
    )
  }

  if (screen === SCREEN.RESULTS) {
    return <ResultsScreen answers={answers} onRestart={handleRestart} onEdit={handleEdit} />
  }

  return (
    <QuestionScreen
      index={step}
      total={QUESTIONS.length}
      question={QUESTIONS[step]}
      value={answers[step]}
      onChange={handleChange}
      onNext={handleNext}
      onPrev={handlePrev}
    />
  )
}
