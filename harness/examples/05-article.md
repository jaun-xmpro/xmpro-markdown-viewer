# The Quiet Power of Boring Software

> Some software is loud — flashy splash screens, neon onboarding tours,
> notifications that beg for attention. Other software is quiet. It sits
> beside you, gets out of your way, and helps you finish what you came to do.
> The second kind tends to last longer.

There is a particular kind of pleasure in software that *does not announce
itself*. You open it, and the thing you wanted to do is already easy. You
close it, and you barely remember the interface — only that the task is done.
This is rare. Most software was designed by people who wanted to be noticed.

The interesting question is not whether boring software is more virtuous than
flashy software. The interesting question is **why** boring software is so
often better — and what makes it that way.

## A short observation about restaurants

In any city, you can find two kinds of restaurants. The first kind decorates
the menu with adjectives, names dishes after the chef's hometown, and lights
the room theatrically. The second kind serves food. The second kind, almost
always, has a longer line.

The same dynamic plays out in software. Tools that try hardest to seem
impressive are often the ones with the most friction in their daily use. The
visible polish is *for the salespeople*, not for the people who will live
inside the product all day. Once you spend more than a week with any tool,
the showmanship dissolves and what remains is the **shape of the work**.

## What shape feels right?

Good software has a recognizable shape. It usually involves the following
qualities, none of which are individually thrilling:

1. **You know where you are.** The interface tells you what section you're in
   without you having to guess.
2. **You know what just happened.** Actions have visible consequences.
   Reversible ones are explicit about being reversible.
3. **You know what's possible.** The next step is suggested, not hidden behind
   three menus and a keyboard shortcut.
4. **The defaults are kind.** Someone has thought about the most common case
   and made it the path of least resistance.

These are unfashionable virtues. None of them photograph well. None of them
animate impressively in a demo. But they are the qualities that make a tool
*disappear into the hand* — and tools that disappear into the hand are tools
that get used.

## The aesthetics of restraint

There is a craft in **not** adding things. The temptation, when you are
building software, is always to put more on the screen. A user complained that
they couldn't find feature X? Add a button. The button caused another
complaint? Add a tooltip. Now the screen is busier than it was, and the next
new user has to parse the noise.

The harder discipline is to ask: *can the underlying problem go away?* Maybe
feature X should be exposed differently. Maybe the menu structure was wrong.
Maybe the screen had two things competing when it should have had one. The
shortcut — adding a button — is rarely the right answer, but it is always the
first answer.

> Software that ages well is software whose authors said *no* to roughly the
> same number of features they said *yes* to. Most of the design work shows
> up as absence.

## On the slow erosion of polish

If you spend long enough working on a product, you start to notice a peculiar
kind of decay. Things that were once carefully considered drift into
inconsistency. A button that used to live in one place starts showing up in
two. A color that was once specific to errors starts being used for warnings.
The system becomes, slowly, harder to use — not because of bad decisions, but
because of the **accumulation** of small ones.

The fix is unglamorous. Someone needs to walk through the product, write down
what they find, and prune. This work has no announcement, no demo, no
release notes. It is invisible from the outside. But it is the work that
keeps software from becoming the kind of thing people start dreading.

## Footnotes and asides

Some readers may want to argue that "boring" is the wrong word — that what I'm
describing is actually a kind of subtle excellence that requires immense
craft.[^1] They are right. The word "boring" is doing some rhetorical work
here. What I mean is software that **does not perform** for the user. It just
behaves.[^2]

[^1]: This is the entire premise of the book *The Inmates Are Running the
Asylum* by Alan Cooper, which is now nearly thirty years old and remarkably
holds up.

[^2]: This is also why so many great pieces of software come from people who
have spent years using the tools they're rebuilding. They know exactly which
small frictions are the ones that compound.

## A practical takeaway

If you build software for other people, here is a useful exercise: write down
the three things your users do most often. Then ask, for each of them: *how
many clicks, fields, decisions, or interruptions does that task currently
require?* Now ask: *which of those are truly load-bearing, and which exist
because someone, at some point, was nervous?*

The answer to the second question is almost always *most of them*. Remove
those. You will not be thanked, because nobody notices the absence of
friction. But you will have made the world incrementally better at a thing
that gets used a thousand times a day.

That is enough.
