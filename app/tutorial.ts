/** Session-local onboarding. Only successful gameplay events advance a lesson. */
export const LESSONS = [
  {
    id: 'look',
    title: 'あたりを見回す',
    text: '遠くの建物や、集落の道守りを探そう。',
    pc: '画面をクリックしてから、マウスを左右に動かす。Escで視点固定を解除。固定できないブラウザーでは左ドラッグで見回せる。',
    touch: '画面右側の空いている場所を左右にスワイプ。',
  },
  {
    id: 'move',
    title: '自分の足で歩く',
    text: 'まずは集落の周りを数歩歩こう。壁にぶつかったら方向を変えよう。',
    pc: '{forward}・{left}・{back}・{right}で移動。{sprint}を押しながら移動でダッシュ、{jump}でジャンプ。',
    touch:
      '左スティックを倒して移動。外側まで倒すとダッシュ。「跳ぶ」で段差を越える。',
  },
  {
    id: 'gather',
    title: '素材をひとつ採集',
    text: '光る木や鉱石に近づこう。採った素材は持ち物に入る。',
    pc: '「採集」の表示が出たら {gather}。',
    touch: '対象に近づき、右側の「調べる」をタップ。',
  },
  {
    id: 'camp',
    title: '道守りと話す',
    text: '集落の道守りは薬と資材を分けてくれる。何度でも傷を癒やせる安全な場所だ。',
    pc: '「道守り」の会話表示が出たら {gather}。別の採集物が表示されたら、道守りへもう少し近づく。',
    touch: '道守りに近づき、会話表示を確認して「調べる」。',
  },
  {
    id: 'inventory',
    title: '持ち物を確認する',
    text: '初期武器と薬を確認しよう。装備候補は能力を比較できる。薬は傷ついたときに使おう。',
    pc: '{inventory}、または右上の「持ち物」で開く。',
    touch: '右上の「持ち物」をタップ。',
  },
  {
    id: 'battle',
    title: '小さな魔物を倒す',
    text: '集落の外で弱い魔物を探そう。敵を正面に捉え、武器の間合いで攻撃。無理なら道守りの近くへ戻ろう。',
    pc: '左クリックで攻撃。右クリック／{guard}で防御、{dodge}で前方回避。{heavy}で強攻撃、{skill}で職業技。',
    touch:
      '右側の「攻撃」。防御は押し続ける。回避・強攻撃・スキルはスタミナを消費。',
  },
  {
    id: 'recruit',
    title: '最初の配下を迎える',
    text: '倒した普通の魔物へ14秒以内に服従を命じよう。成功率は実力差で変わる。拒まれたら別の魔物で試そう。領土ボスは配下にできない。',
    pc: '倒した魔物に近づいて {recruit}。',
    touch: '倒した魔物に近づいて「配下」。',
  },
  {
    id: 'build',
    title: '新しい拠点を着工する',
    text: 'メニューの「自由建築」で建物を選び、緑の予定地で着工。赤い場所は配置できない。正面に近づいて建物を見て立ち止まると、自分で作業できる。建築担当の配下も現地へ向かう。',
    pc: '視点で位置・向きを決め、左クリックで着工。右クリックで取消。',
    touch: '視点を動かして予定地を決め、「着工」。やめるときは「取消」。',
  },
  {
    id: 'order',
    title: '配下へ仕事を命令',
    text: 'メニューの「配下・仕事」で役割を選ぼう。建築・採集・護衛など、得意な仕事を任せられる。',
    pc: 'Escで視点固定を解除してからメニューを開く。',
    touch: '右上の「メニュー」から「配下・仕事」。',
  },
  {
    id: 'map',
    title: '次の目的地を決める',
    text: '地図の地点を選び「目的地にする」。資源地で備え、前線拠点を築き、敵領主の本拠地へ向かおう。',
    pc: '{map}、または右上の「地図」。',
    touch: '右上の「地図」。領土は上部の一覧から切り替えられる。',
  },
] as const;

export type LessonId = (typeof LESSONS)[number]['id'];
export type TutorialState = {
  completed: LessonId[];
  distance: number;
  lookAngle: number;
  hidden: boolean;
};
export const newTutorial = (): TutorialState => ({
  completed: [],
  distance: 0,
  lookAngle: 0,
  hidden: false,
});
export function completeLesson(state: TutorialState, id: LessonId): boolean {
  if (
    !LESSONS.some((lesson) => lesson.id === id) ||
    state.completed.includes(id)
  )
    return false;
  state.completed = [...state.completed, id];
  return true;
}
export function recordTutorialMotion(
  state: TutorialState,
  distance: number,
  angle: number,
) {
  if (Number.isFinite(distance) && distance > 0)
    state.distance = Math.min(120, state.distance + distance);
  if (Number.isFinite(angle) && angle > 0)
    state.lookAngle = Math.min(0.6, state.lookAngle + angle);
  if (state.distance >= 120) completeLesson(state, 'move');
  if (state.lookAngle >= 0.6) completeLesson(state, 'look');
}
export const currentLesson = (state: TutorialState) =>
  LESSONS.find((lesson) => !state.completed.includes(lesson.id));
export const lessonKeys = (text: string, bindings: Record<string, string>) =>
  text.replace(/\{(\w+)\}/g, (_, key: string) =>
    bindings[key] === ' ' ? 'SPACE' : (bindings[key] || key).toUpperCase(),
  );
