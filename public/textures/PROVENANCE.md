# 魔界の素材テクスチャ v1

2026-09-06、内蔵画像生成ツール（built-in imagegen）でオリジナル生成。
外部素材の購入・転載・APIキーを使うCLIは使用していない。
各1回、合計3回の生成。原画を加工・再生成せず、このフォルダーへコピーした。

| 用途 | 最終ファイル | 実寸 | PNG容量 |
| --- | --- | --- | --- |
| 地面 | realm-soil-v1.png | 1254×1254 | 3,647,032 bytes |
| 岩・石造壁 | realm-basalt-v1.png | 1254×1254 | 3,427,265 bytes |
| 木・梁・屋根 | realm-oak-v1.png | 1254×1254 | 2,595,735 bytes |

プロンプトの指定は1024×1024だが、返却画像は1254×1254。正方形・被写体・文字や不要物がないことは目視確認済み。反復の境界一致は数値検査していない。単一アルベドを微細な凹凸の近似にも利用するが、測定由来のPBRマップとはみなさない。3枚を共有し、ミップマップと異方性フィルター上限4を使用。低容量配信用の圧縮版は未作成。

## 最終プロンプト

各リクエストは、次の共通部分に下記の素材別部分をそのまま連結して送信した。

```text
Use case: photorealistic-natural
Asset type: seamless tileable diffuse/albedo game material texture for a real-time 3D dark fantasy game.
Style/medium: original photorealistic material scan.
Composition/framing: exactly 1024 x 1024 pixels, square, orthographic flat close-up, material fills the image edge to edge.
Lighting: perfectly even shadowless diffuse lighting; color information only, no baked directional light, no ambient occlusion, no specular highlights, no gradients or vignette.
Constraints: seamless repeating texture in both axes, opposite edges must connect continuously; distributed fine-scale detail, no obvious focal point. No scene, objects, perspective, borders, text, logos, or watermarks.
```

### Soil

```text
Primary request: dry dark earthy gravel and compact soil with many fine small stones, subtle grains and small scattered grit.
Color palette: muted medium grey-brown, restrained natural earthy variation.
Materials/textures: dry granular soil with fine small stones evenly distributed; no large dominant rocks, no vegetation, no debris.
```

### Basalt

```text
Primary request: weathered rough grey basalt stone surface with fine cracks and chipped microtexture.
Color palette: natural muted medium-to-dark grey with restrained fine mineral variation.
Materials/textures: continuous rough stone, fine irregular cracks and small weathered chips; no mortar grid, no masonry block boundaries, no large dominant forms, no vegetation.
```

### Oak

```text
Primary request: aged dark oak wood with continuous grain running vertically, subtle knots and worn fibers.
Color palette: muted dark natural oak brown with restrained grain variation.
Materials/textures: uninterrupted continuous wood surface, fine vertical fibers and occasional subtle small knots; no plank borders, no seams between boards, no nails, no metal, no varnish glare.
```
