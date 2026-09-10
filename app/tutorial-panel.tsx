'use client';
import { BookOpen, Check, ChevronRight, X } from 'lucide-react';
import { GamePanel } from './game-interface';
import {
  LESSONS,
  currentLesson,
  lessonKeys,
  type TutorialState,
} from './tutorial';
import './tutorial.css';
import { HudIcon } from './hud-art';
import { storyProgress, storyWaypoint, type StoryWorld } from './story';
import type { Waypoint } from './world';

export function TutorialHint({
  state,
  world,
  onOpen,
  onHide,
}: {
  state: TutorialState;
  world: StoryWorld;
  onOpen: () => void;
  onHide: () => void;
}) {
  const lesson = currentLesson(state);
  const story = storyProgress(world);
  if (state.hidden) return null;
  return (
    <aside className="tutorial-hint" aria-label="次の練習">
      <button onClick={onOpen} className="tutorial-next">
        <HudIcon kind="guide" />
        <span>
          <small>{story.chapter.title}</small>
          <b>{lesson?.title || story.chapter.objective}</b>
          <em className="tutorial-description">
            {lesson?.text || '物語日誌を開いて、手掛かりと次の目的地を確認。'}
          </em>
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
  world,
  onWaypoint,
  bindings,
  onClose,
  onToggle,
}: {
  state: TutorialState;
  world: StoryWorld;
  onWaypoint: (target: Waypoint) => void;
  bindings: Record<string, string>;
  onClose: () => void;
  onToggle: () => void;
}) {
  const next = currentLesson(state);
  const story = storyProgress(world);
  const destination = storyWaypoint(world);
  return (
    <GamePanel
      title="物語と冒険の手引き"
      className="tutorial-panel"
      onClose={onClose}
    >
      <div className="panel-head">
        <div>
          <BookOpen />
          <b>残火の誓い — 物語日誌</b>
          <span>
            {state.completed.length}/{LESSONS.length} 達成
          </span>
        </div>
        <button onClick={onClose}>戻る</button>
      </div>
      <section className="story-current" aria-label="現在の物語">
        <small>現在の章 · {story.chapter.speaker}</small>
        <h2>{story.chapter.title}</h2>
        {story.chapter.paragraphs.map((paragraph, index) => (
          <p key={index}>{paragraph}</p>
        ))}
        <div className="story-objective">
          <b>次の目的：{story.chapter.objective}</b>
          <p>{story.chapter.help}</p>
          {destination && (
            <button onClick={() => onWaypoint(destination)}>
              「{destination.name}」へ道しるべを置く
            </button>
          )}
        </div>
        <p className="story-clue">手掛かり：{story.chapter.clue}</p>
      </section>
      {story.entries.length > 1 && (
        <section className="story-archive" aria-label="これまでの記録">
          <h3>これまでに分かったこと</h3>
          {story.entries.slice(0, -1).map((chapter) => (
            <details key={chapter.id}>
              <summary>{chapter.title}</summary>
              {chapter.paragraphs.map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
              <p className="story-clue">{chapter.clue}</p>
            </details>
          ))}
        </section>
      )}
      <div className="tutorial-intro">
        <p>
          {next
            ? '物語の目的を追いながら、下の操作を試そう。先に達成した操作も記録される。日誌は進行に合わせて更新され、未来の記録はまだ読めない。'
            : '基本の練習をすべて達成！ 次は領土ボスへ挑むための準備を進めよう。'}
        </p>
        <button onClick={onToggle}>
          {state.hidden ? '画面のガイドを表示' : '画面のガイドを非表示'}
        </button>
      </div>
      <ol className="tutorial-lessons">
        {LESSONS.map((lesson, index) => {
          const done = state.completed.includes(lesson.id);
          return (
            <li
              key={lesson.id}
              className={`${done ? 'done' : ''} ${next?.id === lesson.id ? 'current' : ''}`}
            >
              <div
                className="lesson-number"
                aria-label={done ? '達成' : `練習${index + 1}`}
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
