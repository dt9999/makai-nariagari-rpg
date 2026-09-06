"use client";
import { BookOpen, Check, ChevronRight, X } from "lucide-react";
import { GamePanel } from "./game-interface";
import {
  LESSONS,
  currentLesson,
  lessonKeys,
  type TutorialState,
} from "./tutorial";
import "./tutorial.css";

export function TutorialHint({
  state,
  onOpen,
  onHide,
}: {
  state: TutorialState;
  onOpen: () => void;
  onHide: () => void;
}) {
  const lesson = currentLesson(state);
  if (state.hidden || !lesson) return null;
  return (
    <aside className="tutorial-hint" aria-label="次の練習">
      <button onClick={onOpen} className="tutorial-next">
        <BookOpen size={18} />
        <span>
          <small>
            冒険の手引き · {state.completed.length}/{LESSONS.length}
          </small>
          <b>{lesson.title}</b>
        </span>
        <ChevronRight size={18} />
      </button>
      <button
        onClick={onHide}
        aria-label="ガイドを非表示にする"
        className="tutorial-hide"
      >
        <X size={18} />
      </button>
    </aside>
  );
}
export function TutorialPanel({
  state,
  bindings,
  onClose,
  onToggle,
}: {
  state: TutorialState;
  bindings: Record<string, string>;
  onClose: () => void;
  onToggle: () => void;
}) {
  const next = currentLesson(state);
  return (
    <GamePanel
      title="冒険の手引き"
      className="tutorial-panel"
      onClose={onClose}
    >
      <div className="panel-head">
        <div>
          <BookOpen />
          <b>冒険の手引き</b>
          <span>
            {state.completed.length}/{LESSONS.length} 達成
          </span>
        </div>
        <button onClick={onClose}>戻る</button>
      </div>
      <div className="tutorial-intro">
        <p>
          {next
            ? "好きな順番で試せます。実際にできた操作は自動で記録されます。"
            : "基本の練習をすべて達成！ 次は領土ボスへ挑むための準備を進めよう。"}
        </p>
        <button onClick={onToggle}>
          {state.hidden ? "画面のガイドを表示" : "画面のガイドを非表示"}
        </button>
      </div>
      <ol className="tutorial-lessons">
        {LESSONS.map((lesson, index) => {
          const done = state.completed.includes(lesson.id);
          return (
            <li
              key={lesson.id}
              className={`${done ? "done" : ""} ${next?.id === lesson.id ? "current" : ""}`}
            >
              <div
                className="lesson-number"
                aria-label={done ? "達成" : `練習${index + 1}`}
              >
                {done ? <Check size={20} /> : index + 1}
              </div>
              <div>
                <h2>
                  {lesson.title}
                  {next?.id === lesson.id && <small>次の練習</small>}
                </h2>
                <p>{lesson.text}</p>
                <dl>
                  <dt>PC</dt>
                  <dd>{lessonKeys(lesson.pc, bindings)}</dd>
                  <dt>スマホ</dt>
                  <dd>{lesson.touch}</dd>
                </dl>
              </div>
            </li>
          );
        })}
      </ol>
    </GamePanel>
  );
}
