import { type TutorialState } from './tutorial';
import {
  DISCOVERY_SITES,
  REGIONS,
  headquartersOf,
  type Waypoint,
} from './world';

export type StoryWorld = {
  job: string;
  tutorial: TutorialState;
  conquered: string[];
  activatedSites: string[];
  talkedSites: string[];
  rank: number;
  heroDefeated: boolean;
  bases: { complete: boolean; kind: string; x: number; y: number }[];
};
export type StoryChapter = {
  id: string;
  title: string;
  speaker: string;
  paragraphs: string[];
  objective: string;
  help: string;
  clue: string;
  destination?: string;
  complete: (world: StoryWorld) => boolean;
};

const lessons = (world: StoryWorld, ...ids: string[]) =>
  ids.every((id) => world.tutorial.completed.some((done) => done === id));

export const STORY: StoryChapter[] = [
  {
    id: 'awakening',
    title: '序章　名のない残火',
    speaker: 'あなた',
    paragraphs: [
      '冷たい石の上で目を覚ます。思い出せる名前はない。手の甲には、欠けた輪のような痕がある。頭の中で、誰かが最後に言った。「王になるな。まず、帰る場所を作れ」',
      '握っているのは刃こぼれした武器。小さな角も、頼りない腕も、強者のものではない。遠くの廃墟から鐘の音がした。けれど、鐘楼には鐘がない。',
    ],
    objective: '周囲を見回し、自分の足で歩く',
    help: '手引きの「見回す」「移動」を試そう。右上のメニューから物語はいつでも読み返せる。',
    clue: '鐘のない場所で、鐘が鳴った。',
    destination: 'ruins-camp',
    complete: (w) => lessons(w, 'look', 'move'),
  },
  {
    id: 'keeper',
    title: '第一章　道守りの嘘',
    speaker: '道守りナギ',
    paragraphs: [
      '残火の隠れ里で、片角の道守りがこちらを見る。ナギと名乗るその魔族は、手の痕を見た瞬間だけ笑顔をなくした。',
      '「……初めて会うな。そう、初めてだ。生きたいなら木と鉱石を拾え。薬は袋に入れただけじゃ効かない。自分の手で使うんだ」',
      '渡された袋の内側には、あなたの手と同じ欠けた輪が縫われている。尋ねても、ナギは「古い旅人のお守りだ」と答えるだけだった。',
    ],
    objective: '素材を採り、道守りと話し、持ち物を確認する',
    help: '光る採集物と道守りへ近づいて「調べる」。道守りは傷を癒やす。持ち物は右上から開ける。',
    clue: '初対面のはずのナギが、あなたに合う袋を用意していた。',
    destination: 'ruins-camp',
    complete: (w) => lessons(w, 'gather', 'camp', 'inventory'),
  },
  {
    id: 'oath',
    title: '第二章　従う者の声',
    speaker: '倒れた魔物の記憶',
    paragraphs: [
      '集落の外では、小さな魔物さえ命を奪う。構え、間合いを測り、一撃を振るう。勝ったとき、倒れた魔物の怯えが自分の胸へ流れ込んできた。',
      '服従を命じた瞬間、手の輪が熱を持つ。「喰わないのか」。声ではない問いが聞こえる。あなたは武器を下ろす。強さを奪う代わりに、共に帰ることを選ぶ。',
      'ナギは小さく呟いた。「今度は、ひとりで背負うなよ」。風に消えた言葉の意味は、まだ分からない。',
    ],
    objective: '小さな魔物を倒し、最初の配下を迎える',
    help: '正面と間合いを合わせて攻撃。防御・回避で生き残ろう。倒した普通の魔物には、表示された時間内に近づいて服従を試せる。',
    clue: '支配の印が、相手の恐れまで伝えてくる。',
    complete: (w) => lessons(w, 'battle', 'recruit'),
  },
  {
    id: 'home',
    title: '第三章　帰る場所',
    speaker: 'ナギ',
    paragraphs: [
      '雨をしのぐ屋根を組む。小さな配下が、不器用に柱を支えてくれる。昨日まで敵だった手が、今日の住処を作っている。',
      '「戦うだけが王の仕事じゃない。木を集める者、道を探す者、家を建てる者。弱い者にも役目がある場所を作れ」',
      '床石の裏に文字を見つけた。『帰還者のために』。石は新しくない。誰かがずっと、ここへ帰る者を待っていた。',
    ],
    objective: '建築を着工し、配下へ仕事を任せ、地図に目的地を置く',
    help: 'メニューの自由建築で緑の予定地に着工。配下・仕事で建築担当を選び、地図で次の地点を目的地にする。',
    clue: '最初の隠れ家は、偶然の空き家ではなかった。',
    destination: 'ruins-shrine',
    complete: (w) => lessons(w, 'build', 'order', 'map'),
  },
  {
    id: 'first-seal',
    title: '第四章　最初の誓い',
    speaker: '祭壇に残る声',
    paragraphs: [
      '廃墟の奥、祭壇に手を触れると、鐘の音が胸の内側で鳴った。『第十一の席を空けておけ』。誰もいない場所から声がする。',
      '魔界を治める領主は十体のはずだ。十一番目とは誰なのか。石の輪には十の溝と、輪を閉じない小さな隙間が刻まれている。',
      'ナギの書き置きには一行だけある。『領主を倒したら、勝者の碑ではなく、敗者の記録を読め』。',
    ],
    objective: '大廃墟の「最初の誓い」を調べる',
    help: '目的地を設定して祭壇へ。周囲に守護する敵がいる場合は先に倒し、「調べる」で封印を解く。',
    clue: '十領主のほかに、第十一の席がある。',
    destination: 'ruins-shrine',
    complete: (w) => w.activatedSites.includes('ruins-shrine'),
  },
];

const records = [
  [
    'ruins',
    '鐘を隠した領主',
    '破れた守備日誌',
    '領主の記録には、鐘を壊した理由が残っていた。鐘は祝福を告げるものではなく、地下の「炉」へ生贄を送る合図だった。',
    '最後の頁に、子どもの字がある。『おうさまが、ぼくのかわりにいった』。王は民を喰らったと聞かされてきた。では、誰が誰の代わりになったのか。',
    '鐘は処刑の合図。王についての伝承に矛盾が生まれた。',
  ],
  [
    'forest',
    '根が覚えている',
    '魔樹の記憶',
    '千年魔樹には人の声が染み込んでいた。領主は根を焼き、声を封じていた。取り戻した樹皮の記録に映る王は、死者の名を一人ずつ覚えている。',
    'その王の手にも欠けた輪がある。顔だけは白く焼き切れている。あなたは王の血筋なのか。それとも、誰かが同じ印を刻んだのか。',
    'あなたの印と古い王の印が一致する。しかし顔は分からない。',
  ],
  [
    'mountain',
    '白骨の橋',
    '峰守りの碑文',
    '骸骨連峰の巨大な骨は、討たれた魔獣の残骸ではなかった。崩れる山を支え、集落を逃がした守護者の骨だった。',
    '碑には「自ら差し出された力のみ、誓いを保つ」とある。配下の思いが流れ込む理由が、初めて言葉になる。あの輪は、奪うためだけの印ではない。',
    '誓いの力には、従う者の意思が必要だった。',
  ],
  [
    'citadel',
    '敵と結んだ条約',
    '黒曜城塞の密約',
    '城塞の地下に、人界の紋章と魔界の紋章が並ぶ条約があった。かつて勇者と魔王は、境界の裂け目を共に封じていた。',
    '領主たちは戦争を終わらせたのではない。敵を失えば自分たちの支配も揺らぐと恐れ、条約を隠した。勇者と魔王は、本当に生まれつきの敵なのか。',
    '勇者と魔王は、一度は同じ側に立っていた。',
  ],
  [
    'ashland',
    '消された十一番目',
    '灰冠塔の観測簿',
    '観測者は王の力を十一に分けた。十の封印を領主へ、最後の欠片を名もない命へ。王の記憶を丸ごと戻せば、炉も王を見つけてしまう。',
    'あなたは先王そのものではない。先王が最後に守りたかった願いを宿した、新しく生まれた魔族だ。最弱だったのは罰ではなく、炉の目を逃れるためだった。',
    '第十一の席はあなた。先王の再来ではなく、新しい命だった。',
  ],
  [
    'waste',
    '帰ってきた袋',
    '商隊の引渡帳',
    '荒野の商隊は、何十年も小さな袋を運んでいた。引渡先の名前は空欄。受取人の特徴だけがある。「欠けた輪を持ち、まだ誰の名も知らぬ者」。',
    'ナギは先王の伝令だった。あなたの未来を知っていたのではない。来るかどうかさえ分からない命を、約束ひとつで待ち続けていた。',
    '袋と隠れ家は、ナギが守り続けた約束だった。',
  ],
  [
    'village',
    '王の名簿',
    '薄暮の市民台帳',
    '王の名簿だと思っていた巻物には、農夫、鍛冶師、運び手、子どもたちの名が書かれていた。王の力の源は、倒した敵の数だけではなかった。',
    '「炉は命を燃やす。誓いは、力を持ち寄る」。新しい城は玉座の器である前に、人が暮らし、働く場所でなければならない。あなたの配下が築いてきた拠点こそ、古い炉を超える答えになる。',
    '建築と配下の仕事は、炉に頼らない国を作るための道だった。',
  ],
  [
    'cave',
    '地底の告白',
    'ナギの記録',
    '沈んだ書庫に、ナギ自身の告白が残っていた。「私は王を炉へ案内した。そうすれば皆が助かると信じた。王が戻らないと知っても、止めなかった」',
    'ナギは無実の見守り手ではなかった。それでも、残された願いを守った。「許してくれとは言わない。今度こそ、誰かひとりの犠牲を正しさと呼ばないでくれ」。',
    'ナギの「今度は」は、先王を失った後悔を指していた。',
  ],
  [
    'volcano',
    '勇者の傷',
    '焼けた巡礼者の手紙',
    '火口神殿には、人界から流れ着いた勇者レオニスの手紙があった。妹の村が裂け目に呑まれた。神殿は「魔王を倒せば戻る」と彼に教えた。',
    'だが炉の設計図が語る真実は逆だった。魔王の死は裂け目を閉じず、次の戦争の火をつける。勇者も、魔王と同じ仕組みに縛られている。',
    '勇者の憎しみには理由がある。しかし教えられた救済は嘘だった。',
  ],
  [
    'castle',
    '閉じない輪',
    '黒冠の遺言',
    '最後の封印が開く。先王の遺言は命令ではなかった。「私になるな。私にできなかったことを、お前の仲間と成せ」',
    '輪の隙間は欠損ではない。外から差し出される手を受け入れるための余白だった。あなたには名前がなかった。誰かの続きを演じるためではなく、自分の生を選ぶために。',
    '印の欠けは、独りで完結しない王の証だった。',
  ],
] as const;

for (const [index, record] of records.entries()) {
  const [region, title, speaker] = record;
  const place = REGIONS.find((r) => r.id === region)!;
  STORY.push({
    id: `seal-${region}`,
    title: `封印篇 ${index + 1}　${title}`,
    speaker,
    paragraphs:
      index === 0
        ? [
            '初めての領土戦が近づく。ナギの言葉を思い出す。領主を倒すだけでなく、その地が何を守り、何を隠してきたのかを確かめよう。',
          ]
        : [records[index - 1][3], records[index - 1][4]],
    objective: `${place.name}の領主を倒し、同地域の祭壇を調べる`,
    help: '地図で領地を選び、本拠地へ向かおう。メニューの「領主に挑戦」で不足条件を確認。レベル・装備・配下を育て、道中に前線拠点を作ると戻りやすい。祭壇は「調べる」で記録を解放。攻略済みの条件は自動で引き継ぐ。',
    clue: index === 0 ? '勝った後こそ、記録を読もう。' : records[index - 1][5],
    destination: `${region}-lord`,
    complete: (w) =>
      w.conquered.includes(region) &&
      w.activatedSites.includes(`${region}-shrine`),
  });
}
STORY.push(
  {
    id: 'crown',
    title: '終章前篇　誰も燃やさない城',
    speaker: '黒冠の遺言',
    paragraphs: [
      records[9][3],
      records[9][4],
      'すべての記録がつながった。あなたが建てるのは、次の犠牲を待つ炉ではない。配下と暮らしを分かち合い、勇者を迎える城だ。',
    ],
    objective: '魔王へ昇格し、魔王城を完成させる',
    help: 'メニューの魔族進化で条件を確認し、各ランクへ昇格。自由建築から魔王城を着工し、建築が得意な配下へ仕事を任せよう。レベルだけでは魔王になれない。',
    clue: records[9][5],
    complete: (w) =>
      w.rank >= 7 &&
      w.bases.some((b) => b.complete && b.kind === 'demon-castle'),
  },
  {
    id: 'hero',
    title: '終章　暁に差し出す手',
    speaker: '勇者レオニス',
    paragraphs: [
      '「魔王を討てば、妹は帰る」。城門の前で、勇者は何度も同じ言葉を繰り返す。剣の光は祝福ではなく、炉から伸びた鎖に似ていた。言葉だけでは、彼の年月を否定できない。',
      'あなたは剣を取る。彼の信じた救いを壊し、生きて別の道を探せるようにするために。背後には、あなたが名前を覚えた配下たちと、自分たちで建てた城がある。',
      '遠くで鐘が鳴る。今度は逃げるためでも、生贄を送るためでもない。生きている者が、ここにいると知らせる音だ。',
    ],
    objective: '魔王城へ戻り、メニューから勇者を迎え撃つ',
    help: '完成した魔王城の近くで「勇者との最終決戦」。装備と薬を整え、防御・回避で攻撃の合間を作ろう。勝利後も探索を続けられる。',
    clue: '最初に聞いた鐘は、炉に残された先王の最後の警告だった。',
    destination: 'home-castle',
    complete: (w) => w.heroDefeated,
  },
  {
    id: 'epilogue',
    title: '後日譚　はじめての名前',
    speaker: 'あなたと仲間たち',
    paragraphs: [
      '勇者の剣が地面に落ちる。砕けたのは彼の命ではなく、炉へつながる剣の刻印だった。失った人は戻らない。レオニスはその事実を初めて、自分の悲しみとして受け止めた。',
      'あなたは手を差し出す。ナギは何も言わず、門を開ける。許されたからではない。これからも、したことを忘れず生きていくために。',
      '炉は黙った。城には採掘の槌、鍛冶の火、働く配下の足音が響く。誰かひとりを燃やさなくても、国は動いている。',
      '「王よ、あなたの名は？」。あなたは初めて、答えを探すことが怖くなかった。名は過去から取り戻すものではない。ここから生きて、呼ばれていくものなのだから。',
    ],
    objective: '仲間と築いた魔界を、自由に旅する',
    help: '物語は完結。探索、建築、育成を続けられます。解放した記録はこの日誌で読み返せます。',
    clue: '帰る場所を作れ。それが、最初から最後まで変わらなかった願い。',
    complete: () => false,
  },
);

/** Sequential disclosure prevents later conquests or an old save leaking future revelations. */
export function storyProgress(world: StoryWorld) {
  let index = 0;
  while (index < STORY.length - 1 && STORY[index].complete(world)) index++;
  return { index, chapter: STORY[index], entries: STORY.slice(0, index + 1) };
}
export function storyWaypoint(world: StoryWorld): Waypoint | null {
  const { chapter } = storyProgress(world);
  let id = chapter.destination;
  if (id?.endsWith('-lord')) {
    const region = id.slice(0, -5);
    if (world.conquered.includes(region)) id = `${region}-shrine`;
    else {
      const r = REGIONS.find((r) => r.id === region);
      return r ? headquartersOf(r) : null;
    }
  }
  if (id === 'home-castle') {
    const castle = world.bases.find(
      (b) => b.complete && b.kind === 'demon-castle',
    );
    return castle ? { id, name: '魔王城', x: castle.x, y: castle.y } : null;
  }
  const site = DISCOVERY_SITES.find((s) => s.id === id);
  return site ? { id: site.id, name: site.name, x: site.x, y: site.y } : null;
}
export const storyCampLine = (world: StoryWorld) => {
  const { chapter } = storyProgress(world);
  return `道守りの伝言「${chapter.clue}」 次の道：${chapter.objective}`;
};
