# Knowledge cards

Techniques this project has learned and **verified**, written so they are useful outside
this repository too. A card is added when something was proven on real output (a render, a
measurement, a QA report), not when it was read somewhere; unverified claims belong in
[`references/`](../references/README.md).

## Format
One file per topic, `knowledge/<topic>.md`:

```markdown
# <Technique, as a statement>

<One paragraph: the problem and the answer.>

## Method
How to do it, tool-agnostic first: the principle, the steps, the numbers.

## Evidence
What was run, on what (coarse host class, versions), and what came out.
Link the commit, the test or the QA report. Say what was not verified.

## In this repo
Where it is implemented (`packages/…`, `engines/…`) and how to use it.

## Pitfalls
What goes wrong, and how it shows.
```

Keep cards short and current: when a card turns out to be wrong or outdated, fix it and say
what changed. Cards are CC BY 4.0; code blocks in them are MIT.
