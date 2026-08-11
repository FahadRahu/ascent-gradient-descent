<!--
==============================================================================
PHASE 2 / FUTURE — read this first
==============================================================================
This is the FULL step-inspector vision (per-optimizer internals + visual
overlays). It is PHASE 2 and should be built AFTER Phase 1.

PHASE 1 (build first) = UI/UX overhaul + mobile support + the LIGHTWEIGHT
iteration scrubber, specified in the sibling doc:
  ./ui-mobile-scrubber-plan.md

Before implementing THIS doc: resolve its ~18 open product questions (see
"Open Product Questions" below), and reuse the verified technical substrate
noted at the top of ui-mobile-scrubber-plan.md (the engine ring buffer, the
discarded StepResult.aux that must be persisted to back a historical inspector,
and the two-channel Zustand rule).
==============================================================================
-->

# Step Inspector + Iteration Scrubber

- **Document type:** Product idea and requirements
- **Status:** Planning only — **Phase 2 / future** (Phase 1 = `./ui-mobile-scrubber-plan.md`)
- **Proposed feature:** Historical iteration review with optimizer-specific step explanations

## Executive Summary

The Step Inspector + Iteration Scrubber would let users revisit any completed
iteration in an ASCENT optimization run and understand how the optimizer moved
from one point to the next.

Today, ASCENT makes the overall behavior of gradient descent visible through the
3D landscape, moving point, completed path, gradient direction, current metrics,
cost feedback, and loss history. Users can pause or advance one step at a time,
but once a step has passed, they cannot return to it. They can see where the
optimizer went, but not all of the values that explain why its final update had
that direction and size.

This feature would add a review mode centered on a selected iteration. The 3D
scene, loss history, path, numerical metrics, and optimizer explanation would all
refer to the same historical step. The inspector would show the state before and
after that step, the change in cost, the raw gradient, the final update, and the
internal quantities that distinguish the selected optimizer, such as momentum,
look-ahead position, adaptive scaling, moments, weight decay, or curvature.

The goal is to turn an optimization run from an animation users watch into an
experiment they can pause, revisit, and explain.

## Problem and Opportunity

Gradient descent is difficult to learn because a short update formula hides a
sequence of decisions:

1. The optimizer observes information about the landscape.
2. It transforms that information according to its own rules and memory.
3. It chooses an update direction and magnitude.
4. The update changes the position and cost.

ASCENT already communicates the beginning and end of this process well. It shows
the current position, gradient, cost, iteration, target, path, and loss history.
It also presents each optimizer's update rule and a short explanation. However,
three gaps remain:

- **Past steps are not reviewable.** A user who notices an overshoot, sharp turn,
  or sudden improvement cannot return to the exact iteration where it happened.
- **The final update is not decomposed.** The user sees the gradient and the new
  position, but not how momentum, accumulated gradients, moments, weight decay,
  or curvature changed the raw gradient into the actual step.
- **Views do not support historical investigation.** The path and loss chart
  summarize the run, but they do not act as synchronized evidence for a selected
  moment.

This is an opportunity to deepen ASCENT's educational value without replacing
its existing experiment flow. Running an optimizer should remain immediate and
visual; detailed inspection should become available when a user wants to ask
"what happened here?"

## Feature Definition

The feature consists of four connected capabilities:

### Iteration Scrubber

The iteration scrubber lets the user move backward and forward through the
retained history of the current run. It establishes one clearly selected
iteration and keeps all historical views synchronized to it.

### Playback Pace

Playback pace lets the user slow down or accelerate continuous descent without
changing the optimizer's numerical sequence. Slow playback supports close
observation, while faster playback makes long runs practical. Exact
previous/next navigation remains available when the user needs to study one
transition rather than watch animation.

### Step Inspector

The step inspector explains the transition associated with the selected
iteration. It presents:

- the iteration being reviewed and its place in the retained run;
- the position and cost before the update;
- the position and cost after the update;
- the cost difference and whether the step improved the objective;
- the gradient used by the optimizer;
- the final parameter update, including direction and magnitude;
- the optimizer-specific values that shaped the update; and
- a concise plain-language interpretation of what happened.

The inspector also presents a "step autopsy": the selected optimizer's update
rule with the recorded values substituted into it, arranged in the same order
that the quantities contribute to the final update. The formula, numerical
values, and plain-language explanation must describe the same transition.

### Visual Optimizer-State Overlays

Optimizer internals are also represented visually when geometry adds genuine
explanatory value. Examples include the raw gradient beside the effective update,
a momentum or velocity vector, a Nesterov look-ahead point, and paired per-axis
indicators for adaptive accumulators or effective scaling. These overlays are
evidence for the selected step, not decoration, and detailed numerical values
remain available alongside them.

Together, these capabilities create a temporal state inspector: playback pace
answers "how closely do I want to watch?", the scrubber answers "when?", and the
inspector and overlays answer "what changed and why?"

## Product Goal

Enable a user to select any retained step and explain, using synchronized visual
and numerical evidence, how the chosen optimizer transformed landscape
information into that update and how the update affected cost.

## Supporting Goals

- Make differences between the nine optimizers concrete rather than formula-only.
- Help users connect the 3D path, loss history, gradient, and numerical values.
- Let users study a run at their own pace without changing its mathematical
  behavior.
- Connect each optimizer's symbolic rule to the actual arithmetic of a selected
  step.
- Make optimizer memory and per-axis adaptation visible when a geometric
  representation improves understanding.
- Make overshooting, oscillation, slow progress, convergence, and divergence
  inspectable after they occur.
- Support both quick visual exploration and deeper study through progressive
  disclosure.
- Preserve the simplicity of ASCENT's current run, pause, step, and restart flow.
- Give educators a reliable way to stop at a specific iteration and discuss it.
- Provide equivalent core understanding on desktop, mobile, keyboard-only, and
  reduced-motion experiences.

## Non-Goals

This proposal does not include:

- comparing multiple runs side by side;
- saving a library of previous runs;
- branching a new run from a historical iteration;
- editing optimizer state or historical values;
- changing past hyperparameters and recalculating the remainder of a run;
- adding editable controls for every advanced optimizer hyperparameter;
- custom objective functions or custom optimizers;
- model training, datasets, predictions, or neural-network visualization;
- report, image, video, or data export;
- prescribing the technical architecture or implementation approach.

These may be reasonable future extensions, but including them now would turn a
focused inspection feature into a broader experiment-management system.

## Target Users

### Learners New to Optimization

Users who understand that gradient descent moves downhill but do not yet
understand why optimizers such as Momentum, AdaGrad, Adam, or Newton behave
differently.

### Students and Self-Directed Learners

Users who know the update formulas and want to connect symbols such as velocity,
accumulators, moments, and curvature to actual values and movement.

### Educators and Demonstrators

Users who need to pause at an instructive step, point to the relevant evidence,
and explain the transition without recreating the run.

### Practitioners Refreshing Their Intuition

Users who know the algorithms but want a quick visual explanation of oscillation,
adaptive scaling, momentum carry, overshooting, or non-convex behavior.

### Mobile and Touch Users

Users who need to review a run without hover, precise pointer movement, or a
large persistent inspector panel.

## Core User Experience

### Live Mode

- A run behaves as it does today.
- The newest completed iteration is the active state.
- The inspector may follow the latest step without demanding attention.
- The user can run continuously, pause, step once, or restart.
- The user can choose a slower or faster playback pace.
- Changing playback pace changes how quickly steps are presented, not which
  numerical steps the optimizer produces.

### Entering Review Mode

- Selecting a historical iteration pauses continuous movement so the evidence
  remains stable.
- The interface makes it unmistakable that the user is reviewing history rather
  than viewing the live endpoint.
- The selected point is identified consistently in the scene, path, loss
  history, metrics, and inspector.

### Reviewing a Step

- The user can move to the previous or next retained iteration.
- The user can jump to the start or return to the latest completed iteration.
- The user sees both the state entering the selected step and the state produced
  by it.
- The user sees the raw landscape signal separately from the optimizer's final
  update.
- The user can follow the selected update from recorded inputs through
  optimizer-specific intermediate quantities to the final movement.
- Relevant visual overlays identify optimizer memory, evaluation position, or
  per-axis scaling without replacing exact values.
- The explanation adapts to the selected optimizer and does not show irrelevant
  fields.

### Returning to Live Mode

- The user can return to the latest state without changing the run's history.
- Continuing the run resumes from the true latest optimizer state, not from the
  historical point being inspected.
- Restarting or changing the experiment clearly ends the prior review context.

## Primary Use Cases

### Investigate an Overshoot

A learner runs gradient descent with an aggressive learning rate and notices the
point cross the valley. They return to the turning point and compare the
gradient, final update magnitude, position, and increase in cost.

### Understand Momentum Carry

A learner selects a step where Momentum does not point exactly along the current
negative gradient. They compare the current gradient with the accumulated
velocity and see why the optimizer continues in a direction influenced by
earlier steps.

### Explain Nesterov Look-Ahead

A student inspects the current position, look-ahead position, gradient measured
at the look-ahead point, and final update. They can distinguish Nesterov from
ordinary Momentum using one concrete iteration.

### See Per-Axis Adaptation

A learner uses AdaGrad or RMSProp on an uneven landscape and inspects why one
parameter moves farther than the other even when the raw gradient alone does not
suggest that ratio.

### Decode Adam

A student reviews the gradient, first-moment estimate, second-moment estimate,
bias-corrected values, and final update at a selected iteration. The formula is
connected to actual values rather than presented only symbolically.

### Separate AdamW Decay from the Gradient Update

A practitioner inspects an AdamW step and can distinguish the optimizer's
gradient-based contribution from the separate weight-decay contribution.

### Examine Newton on Non-Convex Terrain

A learner reviews a Newton step near a saddle or poorly behaved region and sees
that curvature can produce behavior that is not equivalent to following the
negative gradient.

### Diagnose Slow Progress

A user examines several late AdaGrad iterations and sees that accumulated
squared gradients have reduced effective per-axis movement.

### Review Convergence or Divergence

A user jumps to the last valid iteration of a completed or diverged run and
examines the numerical evidence that preceded the outcome.

### Teach a Specific Moment

An educator pauses a run, selects an instructive iteration, and discusses the
same selected state across the surface, path, loss history, and numerical
explanation.

### Study at a Chosen Pace

A beginner slows continuous playback to follow individual turns on Rosenbrock,
then uses exact step navigation at the moment the optimizer crosses the valley.
A practitioner accelerates an uneventful portion of a long run and returns to
normal pace near convergence.

### Perform a Step Autopsy

A student selects one Adam iteration and follows the recorded gradient, active
hyperparameters, moment estimates, bias correction, effective per-axis update,
new position, and cost change as one connected calculation rather than a set of
unrelated metrics.

### Compare Internal State with Movement

A learner sees a momentum vector continue past a turn while the current gradient
points elsewhere, or sees AdaGrad's per-axis accumulation increase while its
effective movement contracts. The geometry and values explain the same behavior.

## User Stories

1. **As a beginner,** I want to revisit an earlier iteration so that I can study
   a step that moved too quickly for me to understand while it was animated.
2. **As a learner,** I want the scene, loss history, and metrics to select the
   same iteration so that I do not have to reconcile conflicting states.
3. **As a learner,** I want to compare the position and cost before and after a
   step so that I can tell what changed.
4. **As a learner,** I want to see the raw gradient separately from the final
   update so that I can understand what the optimizer changed.
5. **As a student,** I want optimizer symbols paired with actual values and
   plain-language labels so that I can connect the formula to the run.
6. **As a student comparing optimizers,** I want each optimizer to expose its
   defining internal quantities so that their behavioral differences are
   visible.
7. **As a user investigating failure,** I want to jump to the last valid step so
   that I can inspect what happened before divergence.
8. **As an educator,** I want stable previous/next iteration navigation so that I
   can lead a class through a run one transition at a time.
9. **As a keyboard user,** I want to select and traverse iterations without a
   pointer so that the full review workflow is available to me.
10. **As a screen-reader user,** I want a textual summary of the selected step so
    that the explanation does not depend on the 3D scene or chart.
11. **As a touch user,** I want alternatives to precise dragging and hover so
    that I can review iterations reliably on a phone or tablet.
12. **As a returning experimenter,** I want a clear way back to the latest state
    so that historical review never makes me unsure which state will continue.
13. **As a user changing the experiment,** I want the old review selection to
    clear explicitly so that values from different runs are never mixed.
14. **As a user who prefers reduced motion,** I want iteration changes to remain
    understandable without animated transitions.
15. **As a beginner,** I want to slow continuous playback so that I can follow a
    run without repeatedly pausing it.
16. **As a user reviewing a long run,** I want faster playback so that I can
    reach an interesting region without changing the optimizer's results.
17. **As a student,** I want the selected values substituted into the optimizer's
    update rule so that I can follow the arithmetic from inputs to movement.
18. **As a visual learner,** I want optimizer memory and adaptive scaling shown
    as clearly labeled geometry so that I can connect internal state to the
    resulting path.
19. **As an advanced learner,** I want to see all hyperparameter values that
    affected the selected step even when they are not editable so that the
    explanation is complete.

## Functional Requirements

### Run and Review State

- **FR-01:** The feature must distinguish the latest run state from a selected
  historical state.
- **FR-02:** Selecting a historical iteration must not modify the recorded run,
  optimizer state, configuration, or future continuation point.
- **FR-03:** Entering historical review during continuous playback must produce
  a stable state that can be inspected.
- **FR-04:** The user must be able to return directly to the latest completed
  iteration.
- **FR-05:** Continuing a run after review must continue from the latest true run
  state, never from the historical display state.
- **FR-06:** Restarting the run or changing the landscape, optimizer, learning
  rate, or start point must not leave stale historical values selected.
- **FR-07:** The interface must clearly communicate whether the user is viewing
  live/latest state or reviewing a past iteration.

### Iteration Navigation

- **FR-08:** The user must be able to select any iteration in the retained
  history of the current run.
- **FR-09:** The user must be able to move exactly one iteration backward or
  forward.
- **FR-10:** The user must be able to jump to the first retained state and the
  latest completed state.
- **FR-11:** Navigation must expose the selected iteration number and the
  available retained range.
- **FR-12:** Iteration zero must be represented as the starting state and must
  not imply that an update occurred before it.
- **FR-13:** If early history is no longer retained, the interface must state
  that the visible range is partial rather than presenting it as the full run.
- **FR-14:** Selecting an iteration from another historical view, such as the
  loss history or visible path, should select the same review state when that
  interaction can be offered clearly.

### Synchronized Evidence

- **FR-15:** The 3D scene, selected path point, loss-history position, iteration
  label, numerical metrics, and step explanation must refer to the same selected
  iteration.
- **FR-16:** The path must distinguish completed history before the selected
  state from later recorded history.
- **FR-17:** The selected loss value must remain available without hover.
- **FR-18:** Historical values must represent the values recorded for that run,
  not values silently recalculated from a later configuration.
- **FR-19:** A selected step must remain stable while the user reads or navigates
  its details.

### Universal Step Explanation

- **FR-20:** Every completed step must identify its starting and ending
  positions.
- **FR-21:** Every completed step must identify its cost before, cost after,
  absolute cost change, and whether the objective improved, worsened, or
  effectively remained unchanged.
- **FR-22:** Every completed step must show the gradient used by the optimizer,
  including where it was evaluated when that location differs from the current
  position.
- **FR-23:** Every completed step must show the final parameter update as both
  per-axis values and an overall magnitude.
- **FR-24:** The explanation must distinguish the gradient, downhill direction,
  optimizer transformation, and final movement; these must not be presented as
  interchangeable vectors.
- **FR-25:** The selected optimizer's formula must be connected to the selected
  values using consistent symbols and plain-language names.
- **FR-26:** The inspector must provide a concise interpretation of the selected
  step, not only a list of numbers.
- **FR-27:** Undefined, unavailable, singular, non-finite, or otherwise unsafe
  values must be identified honestly and must not be displayed as ordinary valid
  measurements.

### Optimizer-Specific Explanation

- **FR-28:** Gradient Descent must show the gradient, learning-rate contribution,
  and resulting update.
- **FR-29:** Momentum must show the prior velocity, current gradient
  contribution, resulting velocity, and final update.
- **FR-30:** Nesterov must distinguish the current position, look-ahead position,
  gradient evaluated at look-ahead, velocity, and final update.
- **FR-31:** AdaGrad must show the accumulated squared gradients, effective
  per-axis scaling, gradient, and final update.
- **FR-32:** RMSProp must show the decayed squared-gradient estimate, effective
  per-axis scaling, gradient, and final update.
- **FR-33:** Adam must show its first- and second-moment information,
  bias-corrected values, gradient, and final update.
- **FR-34:** AdamW must show the Adam-based contribution and weight-decay
  contribution separately before identifying the combined final update.
- **FR-35:** Nadam must show the moment information, its anticipatory or
  Nesterov-adjusted contribution, gradient, and final update.
- **FR-36:** Newton's method must show the gradient, curvature-dependent
  direction, any user-relevant stabilization term, and final update.
- **FR-37:** Optimizer-specific fields must appear only when meaningful for the
  selected optimizer.
- **FR-38:** Every optimizer-specific quantity must have a short explanation of
  what it changes about the step.

### Run Outcomes and Edge States

- **FR-39:** A converged run must retain review access to its completed
  iterations.
- **FR-40:** A diverged run must retain review access to all valid recorded
  iterations and identify the terminal outcome.
- **FR-41:** A run with only its starting point must offer a clear empty-step
  state rather than fabricated before/after values.
- **FR-42:** Extremely small and extremely large values must remain legible and
  comparable without concealing their scale.
- **FR-43:** If multiple minima or a saddle make a single "goal" misleading, the
  explanation must use language appropriate to that landscape.

### Playback Pace and Exact Study

- **FR-44:** The user must be able to choose among normal, slower, and faster
  continuous playback paces.
- **FR-45:** The current playback pace must be visible while a run is active.
- **FR-46:** Changing playback pace must not change the sequence of optimizer
  states, selected hyperparameters, convergence interpretation, or numerical
  result of the run.
- **FR-47:** The user must be able to return directly to the normal playback
  pace.
- **FR-48:** Exact previous/next iteration navigation must remain separate from
  continuous playback pace so that "one step" always means one optimizer update.
- **FR-49:** Reduced-motion mode must preserve pace selection and exact
  navigation without requiring animated interpolation.

### Step Arithmetic and Hyperparameter Context

- **FR-50:** The selected optimizer's update rule must show the recorded values
  for the selected step substituted into the relevant terms.
- **FR-51:** The step explanation must present a readable sequence from starting
  position and observed gradient through optimizer-specific transformation to
  final update and resulting position.
- **FR-52:** Every active hyperparameter that materially affects the selected
  update must be identified by symbol, plain-language name, and value.
- **FR-53:** The inspector must distinguish an active hyperparameter value from
  an editable experiment control; displaying a value does not imply that it can
  be changed.
- **FR-54:** Display rounding must not cause the shown arithmetic to appear
  inconsistent with the shown result.
- **FR-55:** The explanation must make clear when an optimizer's update cannot be
  represented as learning rate multiplied by the current negative gradient.

### Visual Decomposition

- **FR-56:** The selected step should visually distinguish the raw gradient,
  downhill direction, and final effective update when those quantities differ.
- **FR-57:** Momentum and Nesterov should make accumulated velocity visible as a
  quantity distinct from the current gradient.
- **FR-58:** Nesterov should identify its look-ahead evaluation point separately
  from the current and resulting positions.
- **FR-59:** AdaGrad, RMSProp, Adam, AdamW, and Nadam should provide a comparable
  per-axis representation of the state or scaling that changes effective
  movement.
- **FR-60:** AdamW should distinguish its gradient-based movement from its
  separate decay contribution visually as well as numerically.
- **FR-61:** Visual optimizer-state overlays must use stable labels and encodings
  across iterations so apparent changes represent data changes rather than
  arbitrary visual rescaling.
- **FR-62:** Users must be able to reduce or hide advanced overlays when they
  obscure the path, selected point, or primary step explanation.
- **FR-63:** Every geometric encoding of internal state must have an exact
  numerical or textual equivalent.

## Information and Visual Requirements

### Required Reading Order

The selected-step experience should answer these questions in order:

1. **Where am I in the run?**
2. **What changed during this step?**
3. **Did the cost improve?**
4. **What information did the optimizer use?**
5. **How did this optimizer transform that information?**
6. **Why did the final movement look different from the raw gradient?**

### Required Universal Values

For every optimizer, the user must be able to identify:

- selected iteration;
- previous and resulting position;
- previous and resulting cost;
- cost difference;
- gradient components and magnitude;
- final update components and magnitude;
- gradient evaluation position when it differs from the current position;
- all active optimizer hyperparameters that affect the selected update;
- optimizer-specific intermediate quantities needed to explain the final update;
- effective per-axis movement;
- current playback pace;
- run outcome or warning state; and
- whether the selected state is historical or latest.

### Explanatory Standards

- Symbols and terminology must remain consistent between the formula, values,
  labels, and narrative.
- Substituted arithmetic must preserve the conceptual stages of the optimizer
  instead of collapsing the entire update into one unexplained result.
- The displayed formula and values must be precise enough to reconcile after
  rounding, with additional precision available when needed.
- Vector values must identify their axes; an unexplained pair of numbers is not
  sufficient.
- Positive gradient, negative gradient, and parameter update signs must be
  described carefully.
- Essential values and meanings must not depend on hover, color, animation, or
  spatial depth alone.
- The selected state must have a redundant visual and textual identity.
- The loss history must identify its scale and avoid implying that equal visual
  distances always represent equal raw cost changes when they do not.
- Explanations should prioritize the optimizer's defining quantities and allow
  secondary detail to remain optional.
- Geometric encodings must identify whether their lengths or areas are literal,
  normalized, transformed, or schematic.
- Visual comparison across consecutive iterations must not be invalidated by an
  undisclosed change in scale.

## Mobile and Responsive Requirements

- **MR-01:** Mobile portrait is a first-class review experience, not a compressed
  desktop inspector.
- **MR-02:** The 3D evidence or a meaningful equivalent must remain visible or
  immediately restorable while step details are open.
- **MR-03:** The selected iteration, cost change, and previous/next navigation
  must remain easy to reach on a narrow screen.
- **MR-04:** Users must not need precise dragging to select an iteration.
- **MR-05:** Touch users must have explicit previous, next, first, and latest
  actions or equivalent discrete navigation.
- **MR-06:** Essential historical values must be available by tap or persistent
  display, never hover alone.
- **MR-07:** Primary touch targets should remain comfortably usable without
  crowding the visualization.
- **MR-08:** Mobile landscape should be considered a supported sibling state
  because scrubbing a timeline while inspecting a 3D scene benefits from a wide
  viewport.
- **MR-09:** Opening and closing detailed information must preserve the selected
  iteration and return the user to the same visual context.
- **MR-10:** Dense optimizer details should be progressively disclosed rather
  than shrinking labels or hiding the main evidence.
- **MR-11:** Playback pace must be adjustable without relying on a dense or
  precision-only control.
- **MR-12:** Advanced optimizer-state overlays must not make the selected point,
  path, or primary update direction unreadable on a narrow screen.
- **MR-13:** When the full formula cannot remain legible beside the scene, the
  selected-step summary must remain visible and the complete arithmetic must be
  available without losing the selected iteration.

## Accessibility Requirements

- **AR-01:** The complete review workflow must be operable by keyboard.
- **AR-02:** Focus order must follow the selected-step reading order and remain
  predictable when the iteration changes.
- **AR-03:** The selected iteration and its summary must be available to
  assistive technology.
- **AR-04:** Changing the selected iteration must announce a concise useful
  summary without repeatedly reading every available value.
- **AR-05:** A detailed text representation of all displayed values must be
  available on demand.
- **AR-06:** Color must not be the only way to distinguish before, selected,
  after, improved, worsened, live, or historical states.
- **AR-07:** Reduced-motion users must receive immediate or minimal transitions
  without losing state changes.
- **AR-08:** Drag-based navigation must have discrete keyboard and pointer
  alternatives.
- **AR-09:** The feature must remain understandable when the 3D scene is
  unavailable.
- **AR-10:** Numerical formatting and labels must remain readable at zoomed text
  sizes and narrow viewports.
- **AR-11:** Visual vectors, bars, markers, and other optimizer-state geometry
  must have equivalent labels and values available to assistive technology.
- **AR-12:** Playback pace must not be the only way to study a step; exact
  previous/next navigation must remain available to users who disable motion.

## Product Acceptance Criteria

The feature should be considered successful when:

- a user can select any retained iteration and return to the latest state without
  altering the run;
- every selected state is consistent across the scene, path, loss history,
  metrics, and explanation;
- a user can identify the gradient and final update as different quantities;
- a user can state whether the selected step reduced cost and by how much;
- a user can change playback pace without changing the numerical run;
- a user can follow the selected optimizer's recorded values through its update
  rule to the resulting position;
- a user can identify the optimizer-specific quantity that most directly shaped
  the selected update;
- optimizer-state geometry and the numerical inspector communicate the same
  relationship;
- a learner can explain at least one behavioral difference between Gradient
  Descent and each advanced optimizer using a concrete inspected step;
- a diverged run remains useful for reviewing its last valid states;
- keyboard and touch users can traverse the full retained history;
- the experience communicates the same core evidence on desktop and mobile; and
- a first-time user can ignore or collapse advanced detail and still run the
  existing experiment normally.

Possible future usability evaluation may measure whether learners can correctly
answer questions such as:

- Why did this step differ from the negative gradient?
- Why was movement larger on one axis than the other?
- Why did the cost increase even though the optimizer attempted to descend?
- What historical information affected this update?
- Which value changed most immediately before convergence or divergence?

No adoption or learning-improvement percentage should be claimed until it is
measured with actual users.

## Pros

- **Makes runs explainable.** Users can move from observing behavior to
  investigating cause and effect.
- **Deepens existing features.** The path, loss history, formulas, metrics, and
  optimizer choices become parts of one synchronized learning workflow.
- **Supports different study styles.** Users can watch slowly, traverse exact
  steps, inspect arithmetic, or use visual optimizer-state cues.
- **Differentiates optimizers clearly.** Momentum, adaptive scaling, moments,
  decay, look-ahead, and curvature become visible as behavior, not just names.
- **Supports failure as a learning outcome.** Overshoot and divergence remain
  useful after a run stops.
- **Improves teaching value.** Educators can revisit a stable state and discuss
  one exact transition.
- **Serves multiple knowledge levels.** Beginners can read a plain-language
  summary while advanced users inspect the values behind it.
- **Creates a foundation for future features.** Run comparison, annotations,
  shareable states, and exports would all benefit from a well-defined selected
  iteration, even though they are not part of this proposal.
- **Fits ASCENT's purpose.** The feature strengthens the project's central
  promise that gradient descent should be visible and understandable.

## Cons and Tradeoffs

- **Adds interface density.** Optimizer internals can compete with the landscape,
  experiment controls, and existing teaching content.
- **Raises cognitive load.** Showing every available number at once could make
  advanced optimizers less understandable rather than more understandable.
- **Creates optimizer inconsistency.** Each algorithm has different meaningful
  quantities, so the inspector cannot be a single identical table for all nine.
- **Introduces live-versus-history ambiguity.** Users may mistake a reviewed
  point for the current continuation state if the modes are not unmistakable.
- **Makes mobile layout harder.** A 3D scene, timeline, controls, chart, and
  detailed explanation compete for limited space.
- **Requires precise historical truth.** An apparently small mismatch between
  the scene and numerical values would undermine trust in the entire feature.
- **Long runs complicate navigation.** Dense iteration histories can make exact
  selection difficult and may require partial retention.
- **Can encourage false certainty.** A concise explanation must not imply that
  one visible metric is the complete reason for complex optimizer behavior.
- **Expands educational terminology.** Concepts such as bias correction,
  accumulators, Hessians, and damping need careful, consistent language.
- **Adds visual-scale decisions.** Literal internal-state magnitudes may be too
  large or small to draw legibly, while normalization can weaken quantitative
  interpretation.
- **Can blur simulation and playback.** Users may assume that a faster playback
  pace changes optimizer behavior rather than only presentation time.
- **Makes formula presentation demanding.** Complex optimizers can become
  arithmetic walls if every intermediate value receives equal emphasis.

## Risks and Things to Be Aware Of

### Historical Accuracy

The inspector must describe what happened during the original step. Recomputing
old values using current settings could produce plausible but incorrect
explanations. Historical evidence should never silently change after the run.

### State Semantics

"Iteration 5" can mean the state before the fifth update, the fifth completed
update, or the state after it. The product must adopt one convention and apply it
consistently across the scrubber, loss history, path, formulas, and narration.

### Selected State Versus Continuation State

Reviewing iteration 20 of a 100-step run must not suggest that pressing Run will
branch from iteration 20. The distinction between displayed history and the true
latest optimizer state is a central trust requirement.

### Gradient Versus Update Direction

The gradient points uphill, the negative gradient points downhill, and an
optimizer's final update may differ from both because of memory, scaling, decay,
look-ahead, or curvature. Sign conventions and arrow labels must not blur these
concepts.

### Optimizer-Specific Meaning

The same label should not be stretched across unlike concepts. Momentum velocity,
AdaGrad accumulation, Adam moments, AdamW decay, and Newton curvature each need
their own accurate explanation.

### Evaluation Point

Nesterov evaluates the gradient at a look-ahead position rather than the current
position. Any feature that labels all gradients as "gradient at the current
point" would teach the wrong behavior.

### AdamW Decomposition

Weight decay is a separate contribution rather than part of Adam's moment
estimates. Combining the terms too early would conceal the reason AdamW is
distinct.

### Newton and Non-Convex Landscapes

Newton's method is not simply a faster downhill arrow. Curvature can produce
counterintuitive movement near saddles or indefinite regions. Explanations must
avoid promising monotonic cost reduction.

### Numerical Extremes

Optimization values may span many orders of magnitude, approach zero, become
unstable, or stop being finite. Formatting should preserve scale and warnings
without making values look equal or valid when they are not.

### Retained-History Boundaries

If a long run drops early states, the user must see the actual available range.
A scrubber that visually begins at zero while its oldest retained entry is much
later would be misleading.

### Interpolated Animation

The visual point may move smoothly between completed optimizer states, but the
inspector concerns exact recorded steps. Intermediate animation frames must not
be presented as additional optimizer iterations.

### Playback Pace Meaning

Playback pace describes how quickly recorded optimizer steps are presented. It
must not be framed as a learning rate, convergence accelerator, or change to the
algorithm. Faster playback should produce the same sequence, not a different
experiment.

### Formula Substitution and Rounding

A value-substituted formula can appear wrong if intermediate terms are rounded
too aggressively or if the displayed stages omit an operation. The primary view
must remain readable while still allowing users to reconcile inputs,
intermediate values, and the final update.

### Visual Scale of Internal State

Momentum, squared-gradient accumulators, moments, gradients, and parameter
updates may differ by orders of magnitude. If visual lengths or areas are
normalized or transformed for legibility, that choice must be explicit. The
same shape must not suggest literal equivalence between unlike quantities.

### Hyperparameter Visibility Versus Editability

The inspector needs to show every value that affected a step, but this proposal
does not automatically make every value editable. Mixing explanation and
advanced tuning without a deliberate decision could make the core experiment
harder for beginners.

### Loss-Chart Scale

ASCENT's loss history can represent negative, tiny, and very large costs. A
transformed scale is useful, but a selected visual distance should not be
mistaken for an untransformed numerical difference.

### Progressive Disclosure

Advanced detail is valuable only if the primary answer remains clear. The first
view should emphasize what changed and why; deeper terms should not obscure the
selected step's basic story.

### Accessibility Without WebGL

The inspector's educational value should not disappear if the 3D view fails or
is unavailable. Numerical and textual evidence must still form a coherent
historical explanation.

### Scope Growth

Once historical selection exists, comparison, branching, bookmarks, exports,
annotations, and share links will become tempting additions. They should remain
separate product decisions so this feature can retain a clear purpose.

## Open Product Questions

1. Should the step inspector be visible in a compact form by default, or opened
   only when a user selects a past iteration?
2. Should selecting any past iteration always pause the run, or should the user
   be asked before playback stops?
3. Should a selected iteration represent the resulting state, with the inspector
   explaining the transition into it, or the starting state and transition out?
4. Which optimizer-specific values are essential by default, and which belong in
   an advanced-details view?
5. Should users be able to select an iteration directly from both the path and
   loss history, or should the scrubber be the single selection control?
6. How should a partial retained history be described when early iterations are
   unavailable?
7. Should review mode remember its selected iteration when details are collapsed
   or when device orientation changes?
8. What is the most useful non-3D representation when WebGL is unavailable?
9. Should mobile portrait prioritize the selected-step summary while mobile
   landscape offers the full synchronized view?
10. How much plain-language interpretation should be generated for each
    optimizer before it becomes repetitive or overly prescriptive?
11. Should divergence have a distinct terminal marker beyond the last valid
    recorded state?
12. Which learning questions should be used in usability testing to verify that
    the feature improves understanding rather than only exposing more data?
13. Which playback paces are sufficient for careful study and efficient long-run
    review without creating unnecessary choices?
14. Should playback pace reset with each run or remain a user preference?
15. How much substituted arithmetic belongs in the primary inspector before it
    becomes an optional detailed view?
16. Should optimizer-state overlays be visible by default for advanced methods,
    introduced contextually, or enabled by the user?
17. Should internal-state geometry use literal magnitudes, normalized values, or
    both with an explicit scale?
18. Should advanced hyperparameters remain read-only context in this feature, or
    should editable controls become a separately scoped follow-up?

## Relationship to Adjacent Ideas

The broader brainstorm identifies several strong ideas that are related to this
proposal but solve different primary problems. They should be retained for
future planning without being bundled into the first Step Inspector scope.

### Natural Follow-On: Optimizer Race

A simultaneous race between several optimizers would solve the current need to
remember separate runs when comparing methods. Playback pace, synchronized
iteration selection, and clear optimizer-state explanations would make a race
easier to study. A race still introduces its own requirements around fairness,
color identity, leaderboard meaning, visual overlap, and unequal convergence,
so it should remain a separate feature proposal.

### Separate Major Experience: Real ML Mode

A linked dataset, fitted model, and loss surface would close the conceptual gap
between abstract benchmark landscapes and real machine-learning error. It is
likely the largest teaching opportunity in the brainstorm, but it changes the
subject of the experience from inspecting an optimizer on a mathematical surface
to understanding model fitting. It deserves its own product report and should
not be treated as a small extension to the scrubber.

### Complementary Historical Comparison: Ghost Runs

Keeping the previous path visible would make one-variable comparisons, such as a
learning-rate change, easier. It requires a clear definition of which prior run
is retained and how configurations are compared. This proposal intentionally
reviews one current run and does not add cross-run history.

### Complementary Spatial View: Contour Minimap

A synchronized top-down contour view could clarify valleys and local minima that
a 3D camera can hide. It would pair naturally with the selected iteration, but
the Step Inspector remains useful without requiring a second spatial view.

### Separate Experiment-Control Expansion

Editable controls for momentum, decay rates, moment coefficients, weight decay,
and damping would support deeper experimentation. The inspector should show the
active values needed to explain a step, but expanding which values users can
change introduces a separate product decision about complexity, defaults, reset
behavior, and how experiments remain understandable and comparable.

### Separate Discovery Improvements

Named scenario presets and click-to-place starting points would help learners
reach instructive behavior quickly. They improve experiment setup rather than
historical explanation and can be evaluated independently.

### Separate Teaching and Sharing Improvements

A bridge from two-parameter landscapes to high-dimensional machine learning and
shareable run URLs are valuable ideas with different jobs: conceptual framing
and reproducibility. Neither is required to explain one selected optimizer step.

The additions absorbed into this report are the ones that directly strengthen
the same user job: playback pace, exact backward navigation, value-substituted
step arithmetic, visual optimizer-state overlays, and visibility of all active
hyperparameters.

## Reference Principles

The supplied references point to several useful product principles:

- **Imperial College Aero learning visualization:** Keep related views
  synchronized so changes to parameters, the fitted behavior, and the objective
  landscape tell one story.
- **Kaggle gradient-descent walkthrough:** Build understanding progressively and
  treat failure cases such as poor steps or non-convergence as teaching moments.
- **lilipads gradient descent visualizer:** Make optimizer-specific memory and
  adaptive behavior concrete through step-by-step inspection, meaningful
  geometry, and experimentation.
- **fast.ai community 3D gradient-descent app:** Let users move manually through
  an optimization process, control its pace, and connect the trace to the
  objective being reduced.

ASCENT should borrow these principles rather than reproduce any reference's
layout or visual style. The distinctive opportunity is to combine ASCENT's
existing 3D landscapes and broad optimizer set with a synchronized,
optimizer-aware historical explanation.

## Contextual Inspiration

These references provide context, teaching patterns, interaction ideas, and
visual inspiration for this proposal. They are inputs to the product thinking,
not specifications to reproduce. Additional relevant references can be added to
this section as the idea develops.

- [Imperial College Aero: 3D gradient descent visualization](https://aero-learn.imperial.ac.uk/vis/Machine%20Learning/gradient_descent_3d.html)
- [Kaggle: Visualizing Gradient Descent in 3D](https://www.kaggle.com/code/christianwittmann/visualizing-gradient-descent-in-3d)
- [lilipads/gradient_descent_viz](https://github.com/lilipads/gradient_descent_viz)
- [fast.ai forum: 3D Gradient Descent Webapp](https://forums.fast.ai/t/3d-gradient-descent-webapp/102384)

## Recommendation

Proceed with the Step Inspector + Iteration Scrubber as a focused core-feature
upgrade, subject to resolving the iteration convention, live-versus-review
behavior, playback choices, visual scaling, and default detail level.

The strongest version of the feature is not merely a timeline. It is a
synchronized explanation system that lets a user select one recorded transition
and answer: where was the optimizer, what information did it use, how did its
algorithm transform that information, where did it move, and what happened to
the cost?
