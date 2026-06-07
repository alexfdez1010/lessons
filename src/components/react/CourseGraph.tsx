import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';
import { getFinishedCourses, onProgressChange } from '@/lib/progress';

/** The four demand tiers on the zero-to-expert finance path. */
export type Difficulty = 'beginner' | 'intermediate' | 'advanced' | 'expert';

/** Maps a difficulty to its semantic badge class (defined in global.css). */
const DIFFICULTY_CLASS: Record<Difficulty, string> = {
  beginner: 'difficulty-beginner',
  intermediate: 'difficulty-intermediate',
  advanced: 'difficulty-advanced',
  expert: 'difficulty-expert',
};

/** Maps a difficulty to its whole-card edge/tint class (defined in global.css). */
const DIFFICULTY_EDGE_CLASS: Record<Difficulty, string> = {
  beginner: 'difficulty-edge-beginner',
  intermediate: 'difficulty-edge-intermediate',
  advanced: 'difficulty-edge-advanced',
  expert: 'difficulty-edge-expert',
};

/**
 * One course (topic) node in the {@link CourseGraph}. Locale-agnostic: all
 * user-facing strings (`title`, `description`) and the `href` are resolved by
 * the caller, so the same component renders the en and es catalogs.
 */
export interface CourseNode {
  /** Bare topic slug — stable id used to wire up {@link dependencies}. */
  slug: string;
  /** Localized course title. */
  title: string;
  /** Localized one-line summary. */
  description: string;
  /** Emoji / short chip label. */
  icon: string;
  /** Localized link to the topic landing page. */
  href: string;
  /** Number of lessons inside the course. */
  lessons: number;
  /** Accent token suffix used for the node tint. */
  accent?: 'brand' | 'accent';
  /**
   * Demand level shown as a badge. `beginner` assumes **no prior finance
   * knowledge**; `expert` is the deepest tier on the zero-to-expert path.
   */
  difficulty?: Difficulty;
  /**
   * Bare slugs of prerequisite courses (drawn as incoming edges). Unknown
   * slugs are ignored so a half-built dependency list never breaks the graph.
   */
  dependencies?: string[];
}

/** Props for the {@link CourseGraph} component. */
export interface CourseGraphProps {
  /** Every course to plot. Order within a layer follows array order. */
  nodes: CourseNode[];
  /** Label after the lesson count, e.g. `'lessons'`. */
  lessonsLabel?: string;
  /**
   * Localized name for each difficulty tier, shown on the card badge and in
   * the legend. Omit to fall back to the English tier names.
   */
  difficultyLabels?: Record<Difficulty, string>;
  /** Badge text shown on a course the learner has marked finished. */
  finishedLabel?: string;
  /** Caption shown beneath the graph (e.g. how to read the arrows). */
  caption?: string;
  /** Shown when `nodes` is empty. */
  emptyLabel?: string;
  /** Extra classes merged onto the root element. */
  className?: string;
}

/** A measured edge: a cubic-bezier path string from prerequisite → course. */
interface EdgePath {
  id: string;
  d: string;
}

/**
 * Topological depth of every node = its layer (row) in the graph. A node with
 * no (known) prerequisites sits on layer 0; otherwise it's one below its
 * deepest prerequisite. Cycles and dangling deps are tolerated — a node never
 * counts itself and unknown slugs are skipped — so the layout always resolves.
 */
function computeLayers(nodes: CourseNode[]): Map<string, number> {
  const bySlug = new Map(nodes.map((n) => [n.slug, n]));
  const depth = new Map<string, number>();

  const visit = (slug: string, stack: Set<string>): number => {
    const cached = depth.get(slug);
    if (cached !== undefined) return cached;
    const node = bySlug.get(slug);
    if (!node) return 0;
    // Guard against cycles: treat a back-edge as no constraint.
    if (stack.has(slug)) return 0;
    stack.add(slug);

    const deps = (node.dependencies ?? []).filter((d) => bySlug.has(d) && d !== slug);
    const d = deps.length === 0 ? 0 : 1 + Math.max(...deps.map((dep) => visit(dep, stack)));
    stack.delete(slug);
    depth.set(slug, d);
    return d;
  };

  for (const n of nodes) visit(n.slug, new Set());
  return depth;
}

/**
 * Reorder the nodes **within each layer** to minimize edge crossings, the
 * classic Sugiyama "barycenter" heuristic. Each node is repeatedly pulled
 * toward the average horizontal position of its neighbors (both its
 * prerequisites in earlier rows and the courses that depend on it in later
 * rows), so children sit under their parents and arrows run mostly straight
 * instead of fanning across the graph. Mutates `rows` in place.
 *
 * Positions are *normalized* to [0,1] within each row so a wide row and a
 * narrow row exert comparable pull, and edges that skip layers (e.g. a
 * layer-0 prerequisite of a layer-2 course) are honored just like adjacent
 * ones. A few alternating down/up sweeps converge well past the point where
 * extra passes change anything; ties fall back to the catalog `order` for a
 * stable, deterministic layout.
 */
function orderRowsToReduceCrossings(rows: CourseNode[][], nodes: CourseNode[]): void {
  const present = new Set(nodes.map((n) => n.slug));
  // Adjacency: for each slug, its prerequisites and its dependents (kept to
  // courses actually plotted, never self-referential).
  const parents = new Map<string, string[]>();
  const children = new Map<string, string[]>();
  for (const n of nodes) {
    const deps = (n.dependencies ?? []).filter((d) => present.has(d) && d !== n.slug);
    parents.set(n.slug, deps);
    for (const d of deps) {
      const list = children.get(d) ?? [];
      list.push(n.slug);
      children.set(d, list);
    }
  }

  // Stable starting order inside each row: catalog order, low → high.
  const orderRank = new Map(nodes.map((n, i) => [n.slug, i]));
  for (const row of rows) {
    row.sort((a, b) => (orderRank.get(a.slug) ?? 0) - (orderRank.get(b.slug) ?? 0));
  }

  // Normalized x of every node in its current row (recomputed each sweep).
  const posOf = (): Map<string, number> => {
    const pos = new Map<string, number>();
    for (const row of rows) {
      const last = Math.max(1, row.length - 1);
      row.forEach((n, i) => pos.set(n.slug, row.length === 1 ? 0.5 : i / last));
    }
    return pos;
  };

  const SWEEPS = 8;
  for (let s = 0; s < SWEEPS; s++) {
    const pos = posOf();
    const downward = s % 2 === 0; // alternate: lean on parents, then on children.
    for (const row of rows) {
      const bary = new Map<string, number>();
      for (const n of row) {
        const neigh = downward
          ? (parents.get(n.slug) ?? [])
          : (children.get(n.slug) ?? []);
        // Mix in the other direction too, lightly, so leaf/root rows still move.
        const other = downward
          ? (children.get(n.slug) ?? [])
          : (parents.get(n.slug) ?? []);
        const all = neigh.length ? neigh : other;
        const vals = all.map((m) => pos.get(m)).filter((v): v is number => v !== undefined);
        bary.set(n.slug, vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : pos.get(n.slug) ?? 0.5);
      }
      row.sort((a, b) => {
        const d = (bary.get(a.slug) ?? 0) - (bary.get(b.slug) ?? 0);
        return d !== 0 ? d : (orderRank.get(a.slug) ?? 0) - (orderRank.get(b.slug) ?? 0);
      });
    }
  }
}

/**
 * Catalog graph island — renders every course as a card and draws an arrow
 * from each prerequisite to the courses that depend on it, roadmap.sh-style,
 * so the learning order and dependencies are obvious at a glance.
 *
 * Layout is deliberately split in two: the **cards** flow through plain,
 * responsive flexbox rows (one row per dependency layer), while the **edges**
 * are an SVG overlay whose paths are *measured* from the real DOM positions
 * after layout — so the arrows stay glued to the cards through any reflow
 * (resize, font swap, wrapping) without hand-computed coordinates. Cards are
 * real `<a>` links in reading order, keeping the graph keyboard- and
 * screen-reader-navigable; the SVG is decorative (`aria-hidden`).
 *
 * To add a course: drop a new topic MDX with a `dependencies` array — no
 * code changes here.
 */
const DEFAULT_DIFFICULTY_LABELS: Record<Difficulty, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
  expert: 'Expert',
};

export function CourseGraph({
  nodes,
  lessonsLabel = 'lessons',
  difficultyLabels = DEFAULT_DIFFICULTY_LABELS,
  finishedLabel = 'Finished',
  caption,
  emptyLabel = 'No courses yet — check back soon.',
  className,
}: CourseGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // One DOM ref per card, keyed by slug, so we can measure centers for edges.
  const cardRefs = useRef(new Map<string, HTMLAnchorElement>());
  const [edges, setEdges] = useState<EdgePath[]>([]);
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  // Courses the learner marked finished (localStorage); empty during SSR so
  // the first paint matches the server, then hydrated + kept in sync on mount.
  const [finished, setFinished] = useState<Set<string>>(new Set());

  useEffect(() => {
    const sync = () => setFinished(getFinishedCourses());
    sync();
    return onProgressChange(sync);
  }, []);

  const layers = computeLayers(nodes);
  const maxLayer = nodes.reduce((m, n) => Math.max(m, layers.get(n.slug) ?? 0), 0);
  // Group nodes into rows by layer, preserving array order within each row.
  const rows: CourseNode[][] = Array.from({ length: maxLayer + 1 }, () => []);
  for (const n of nodes) rows[layers.get(n.slug) ?? 0].push(n);
  orderRowsToReduceCrossings(rows, nodes);

  const measure = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const box = container.getBoundingClientRect();
    const centerOf = (el: HTMLElement) => {
      const r = el.getBoundingClientRect();
      return {
        top: r.top - box.top,
        bottom: r.bottom - box.top,
        cx: r.left - box.left + r.width / 2,
      };
    };

    const next: EdgePath[] = [];
    const bySlug = new Set(nodes.map((n) => n.slug));
    for (const n of nodes) {
      const toEl = cardRefs.current.get(n.slug);
      if (!toEl) continue;
      const to = centerOf(toEl);
      for (const dep of n.dependencies ?? []) {
        if (!bySlug.has(dep) || dep === n.slug) continue;
        const fromEl = cardRefs.current.get(dep);
        if (!fromEl) continue;
        const from = centerOf(fromEl);
        // Bezier from prerequisite's bottom edge to dependent's top edge.
        const x1 = from.cx;
        const y1 = from.bottom;
        const x2 = to.cx;
        const y2 = to.top;
        const dy = Math.max(24, (y2 - y1) / 2);
        next.push({
          id: `${dep}->${n.slug}`,
          d: `M ${x1} ${y1} C ${x1} ${y1 + dy}, ${x2} ${y2 - dy}, ${x2} ${y2}`,
        });
      }
    }
    setSize({ w: container.clientWidth, h: container.clientHeight });
    setEdges(next);
  }, [nodes]);

  // Measure after layout and on every resize of the container.
  useLayoutEffect(() => {
    measure();
  }, [measure]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(container);
    // Re-measure once web fonts settle (they shift card heights).
    if (typeof document !== 'undefined' && 'fonts' in document) {
      document.fonts.ready.then(() => measure()).catch(() => {});
    }
    return () => ro.disconnect();
  }, [measure]);

  if (nodes.length === 0) {
    return <p className={cx('mt-12 text-ink-500', className)}>{emptyLabel}</p>;
  }

  return (
    <figure className={cx('not-prose', className)}>
      <div ref={containerRef} className="relative">
        {/* Edge overlay — measured from the cards, purely decorative. */}
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
          width={size.w || undefined}
          height={size.h || undefined}
        >
          <defs>
            <marker
              id="course-arrow"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" className="fill-brand-400" />
            </marker>
          </defs>
          {edges.map((e) => (
            <path
              key={e.id}
              d={e.d}
              fill="none"
              className="stroke-brand-300"
              strokeWidth={2}
              strokeLinecap="round"
              markerEnd="url(#course-arrow)"
            />
          ))}
        </svg>

        {/* Card layers — plain responsive flow; arrows snap to these. */}
        <ol className="relative flex list-none flex-col gap-y-12 p-0 sm:gap-y-20">
          {rows.map((row, layer) => (
            <li key={layer} className="m-0 p-0">
              <ul className="flex list-none flex-wrap items-stretch justify-evenly gap-x-6 gap-y-4 p-0 sm:gap-x-12">
                {row.map((n) => {
                  const tint = n.accent === 'accent' ? 'bg-accent-50' : 'bg-brand-50';
                  const tintText =
                    n.accent === 'accent' ? 'group-hover:text-accent-700' : 'group-hover:text-brand-700';
                  // Difficulty drives the card's colored left edge + tier tint.
                  const edge = n.difficulty
                    ? DIFFICULTY_EDGE_CLASS[n.difficulty]
                    : 'border-l-4 border-l-ink-200 bg-surface';
                  const isDone = finished.has(n.slug);
                  return (
                    <li key={n.slug} className="m-0 p-0">
                      <a
                        ref={(el) => {
                          if (el) cardRefs.current.set(n.slug, el);
                          else cardRefs.current.delete(n.slug);
                        }}
                        href={n.href}
                        title={`${n.title} · ${n.lessons} ${lessonsLabel}${isDone ? ` · ${finishedLabel}` : ''}`}
                        className={cx(
                          'group relative flex h-full w-28 max-w-[40vw] flex-col rounded-card border border-ink-200 p-2.5 shadow-soft transition-all hover:-translate-y-1 hover:border-brand-300 hover:shadow-lift motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:w-44 sm:max-w-[80vw] sm:p-3',
                          edge,
                          isDone && 'ring-2 ring-brand-400 ring-offset-1',
                        )}
                      >
                        {isDone ? (
                          <span
                            className="absolute -right-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-pill bg-brand-600 text-white shadow-soft ring-2 ring-surface"
                            title={finishedLabel}
                          >
                            <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M5 10.5l3.2 3.2L15 7" />
                            </svg>
                            <span className="sr-only">{finishedLabel}</span>
                          </span>
                        ) : null}
                        <div className="mb-1.5 flex items-center justify-between gap-2 sm:mb-2">
                          <span
                            className={cx(
                              'grid h-7 w-7 shrink-0 place-items-center rounded-card text-base sm:h-9 sm:w-9 sm:text-xl',
                              tint,
                            )}
                          >
                            {n.icon}
                          </span>
                          {n.difficulty ? (
                            <span className={cx('difficulty-badge hidden sm:inline-flex', DIFFICULTY_CLASS[n.difficulty])}>
                              {difficultyLabels[n.difficulty]}
                            </span>
                          ) : null}
                        </div>
                        <h3
                          className={cx(
                            'font-display text-sm font-semibold leading-snug text-ink-900',
                            tintText,
                          )}
                        >
                          {n.title}
                        </h3>
                        {n.difficulty ? (
                          <span className={cx('difficulty-badge mt-1.5 self-start sm:hidden', DIFFICULTY_CLASS[n.difficulty])}>
                            {difficultyLabels[n.difficulty]}
                          </span>
                        ) : null}
                        <p className="mt-1.5 text-xs font-medium text-ink-400">
                          {n.lessons} {lessonsLabel}
                        </p>
                      </a>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ol>
      </div>

      {/* Difficulty legend — the zero-to-expert path at a glance. */}
      <ul className="mt-8 flex list-none flex-wrap items-center justify-center gap-3 p-0">
        {(['beginner', 'intermediate', 'advanced', 'expert'] as Difficulty[]).map((d) => (
          <li key={d} className="m-0 p-0">
            <span className={cx('difficulty-badge', DIFFICULTY_CLASS[d])}>{difficultyLabels[d]}</span>
          </li>
        ))}
      </ul>

      {caption ? (
        <figcaption className="mt-6 text-center text-sm text-ink-500">{caption}</figcaption>
      ) : null}
    </figure>
  );
}

export default CourseGraph;
