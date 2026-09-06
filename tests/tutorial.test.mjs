import { test } from "node:test";
import assert from "node:assert/strict";
import {
  newTutorial,
  currentLesson,
  completeLesson,
  recordTutorialMotion,
  lessonKeys,
  LESSONS,
} from "../app/tutorial.ts";
test("lessons remember actual out-of-order events and ignore duplicates", () => {
  const state = newTutorial();
  assert.equal(currentLesson(state).id, "look");
  assert.equal(completeLesson(state, "camp"), true);
  assert.equal(completeLesson(state, "camp"), false);
  assert.equal(completeLesson(state, "invalid"), false);
  assert.equal(currentLesson(state).id, "look");
  LESSONS.forEach((lesson) => completeLesson(state, lesson.id));
  assert.equal(state.completed.length, LESSONS.length);
  assert.equal(currentLesson(state), undefined);
});
test("motion uses travelled distance and cumulative look angle with finite bounds", () => {
  const state = newTutorial();
  recordTutorialMotion(state, 0, 0);
  recordTutorialMotion(state, NaN, Infinity);
  recordTutorialMotion(state, -20, -1);
  assert.deepEqual(state, newTutorial());
  recordTutorialMotion(state, 80, 0.3);
  assert.equal(state.completed.length, 0);
  recordTutorialMotion(state, 40, 0.3);
  assert.ok(state.completed.includes("move"));
  assert.ok(state.completed.includes("look"));
  recordTutorialMotion(state, 99999, 99999);
  assert.equal(state.distance, 120);
  assert.equal(state.lookAngle, 0.6);
});
test("hiding never completes lessons and device bindings remain accurate", () => {
  const state = newTutorial();
  state.hidden = true;
  assert.equal(currentLesson(state).id, "look");
  assert.equal(
    lessonKeys("{forward} と {jump}", { forward: "z", jump: " " }),
    "Z と SPACE",
  );
  assert.notEqual(newTutorial().completed, state.completed);
});
