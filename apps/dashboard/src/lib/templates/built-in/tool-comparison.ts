import type { BuiltInTemplate } from "@/types/templates";

/**
 * Tool Comparison Template
 *
 * A structured template for comparing tools, frameworks, libraries, or
 * technologies. Helps teams make informed decisions by documenting
 * real-world usage, trade-offs, and practical considerations.
 */
export const toolComparisonTemplate: BuiltInTemplate = {
  name: "Tool Comparison",
  slug: "tool-comparison",
  contentType: "blog_post",
  description:
    "A structured template for comparing tools, frameworks, or technologies. Perfect for documenting evaluation criteria, real-world usage, and helping others make informed technical decisions.",
  structure: {
    sections: [
      {
        heading: "The Decision Context",
        description:
          "What problem are you trying to solve? What are your requirements? Set the stage for why you're comparing these specific tools.",
        required: true,
      },
      {
        heading: "The Contenders",
        description:
          "Introduce each tool being compared. What's their primary use case? What makes each one worth considering?",
        required: true,
      },
      {
        heading: "Evaluation Criteria",
        description:
          "What factors matter most for your use case? Performance, developer experience, ecosystem, cost, learning curve? Define your scoring methodology.",
        required: true,
      },
      {
        heading: "Head-to-Head Comparison",
        description:
          "Compare the tools across each criterion. Use tables, code examples, and real benchmarks. Be specific and show evidence.",
        required: true,
      },
      {
        heading: "Real-World Usage",
        description:
          "What did you actually build with each tool? Share hands-on experience, gotchas, and unexpected discoveries. Code examples help here.",
        required: true,
      },
      {
        heading: "The Verdict",
        description:
          "Which tool won for your use case and why? Be clear about trade-offs. What scenarios would change your recommendation?",
        required: true,
      },
      {
        heading: "Migration Considerations",
        description:
          "If switching from another tool, what's involved? Breaking changes, migration path, effort estimation?",
        required: false,
      },
    ],
  },
  toneGuidance: `Write as an objective evaluation, not a sales pitch. Show both strengths and weaknesses. Be fair to all tools - even the ones you didn't choose.

Style: Analytical and evidence-based. Like a staff engineer's evaluation doc.
Voice: Balanced and pragmatic. Avoid fanboy enthusiasm or unfair criticism.
Length: 2000-3000 words with code examples, benchmarks, and comparison tables.

Avoid: Tribal language ("X is trash", "Y is obviously better"), outdated information, benchmarks without context, ignoring edge cases. Don't just compare features - compare real-world developer experience.`,
  exampleContent: `# Comparing State Management: Zustand vs Redux Toolkit vs Jotai

## The Decision Context

We're building a collaborative dashboard with real-time updates, complex nested state, and multiple team members working on different features. Our previous Redux setup had become unwieldy - 300+ lines of boilerplate for simple features.

Requirements:
- TypeScript-first with excellent inference
- Minimal boilerplate for simple cases
- Scales to complex scenarios
- Good DevTools integration
- Active maintenance and community

## The Contenders

**Redux Toolkit**: The modern Redux experience. Opinionated, batteries-included, solves most classic Redux pain points.

**Zustand**: Minimal, unopinionated, hook-based. "Just use React state, but global."

**Jotai**: Atomic state management inspired by Recoil. Bottom-up composition model.

## Evaluation Criteria

Here's what mattered for our team:

1. **Time-to-productivity** (40%): How fast can new devs add features?
2. **TypeScript DX** (30%): Type inference, safety, autocomplete
3. **Bundle size** (15%): We're size-conscious
4. **Debugging experience** (15%): Can we trace what changed and why?

## Head-to-Head Comparison

| Criterion | Redux Toolkit | Zustand | Jotai |
|-----------|--------------|---------|-------|
| Bundle Size | 11kb (RTK + React-Redux) | 3kb | 5kb |
| Boilerplate | Medium | Minimal | Minimal |
| Learning Curve | Steep | Gentle | Medium |
| TypeScript | Excellent | Excellent | Good |
| DevTools | Best-in-class | Basic | Limited |

### Code Comparison: Adding a Counter

**Redux Toolkit:**
\`\`\`typescript
// slice.ts
const counterSlice = createSlice({
  name: 'counter',
  initialState: { value: 0 },
  reducers: {
    increment: (state) => { state.value += 1 },
    decrement: (state) => { state.value -= 1 },
  },
});

// component.tsx
const value = useSelector((state) => state.counter.value);
const dispatch = useDispatch();
<button onClick={() => dispatch(increment())}>+</button>
\`\`\`

**Zustand:**
\`\`\`typescript
// store.ts
const useStore = create<State>((set) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
  decrement: () => set((state) => ({ count: state.count - 1 })),
}));

// component.tsx
const { count, increment } = useStore();
<button onClick={increment}>+</button>
\`\`\`

**Jotai:**
\`\`\`typescript
// atoms.ts
const countAtom = atom(0);

// component.tsx
const [count, setCount] = useAtom(countAtom);
<button onClick={() => setCount(c => c + 1)}>+</button>
\`\`\`

## Real-World Usage

I built the same feature - a real-time notification center - with each library...

[Continue with detailed implementation experience, performance results, and practical insights]`,
};

export default toolComparisonTemplate;
