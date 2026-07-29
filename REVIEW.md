# Nagi CSS レビュー結果 — 修正すべき内容

対象コミット: `83d6b05`（Replace zone with unit in STN）
検証方法: サンドボックスの Vue アプリに「現場でよくある書き方」を並べて CLI を実走。
`packages/core` の `analyzeVueTemplate` を直接叩いた挙動確認を併用。
記載した症状はすべて再現済み（推測のみの項目には「未確認」と明記）。

---

## サマリ

| # | 内容 | 種別 | 優先 |
|---|---|---|---|
| 1 | 解析できない `<style>`（`lang="scss"` 等）が**サイレントにスキップされる** ※方針決定済み、修正は「落とす」だけ | バグ | **P0** |
| 2 | 単体 `.css` が無検査 → **対象外と決定**（文書化済み）。CLI 既定値の修正のみ残る | 仕様化 | P2 |
| 3 | ARIA ロール identity が `reserved-element-name` と衝突（契約と矛盾） | バグ | **P0** |
| 4 | `+` / `~` 兄弟結合子を誤検出 | バグ | P1 |
| 5 | `<Transition>` などがルートを包むと surface 検出が崩壊 | バグ | P1 |
| 6 | `pages/index.vue` → `src-page` になる導出バグ | バグ | P1 |
| 7 | `config.ignores` が Stylelint 側に渡っていない | バグ | P2 |
| 8 | 2リンタの出力形式・パス表記が不統一 | UX | P2 |
| 9 | テンプレート↔セレクタ対応検査が未実装（README の主張が未裏付け） | 未実装 | P1 |
| 10 | 値（トークン）の canonical form が未検査 | 未実装 | P1 |
| 11 | CONTRACT.md の例3件がリンタで落ちる | 整合性 | P1 |
| 12 | CONTRACT.md L478 の `thead` 自己マップ記述が表と矛盾 | 整合性 | P2 |
| 13 | 「全例がリンタを通る」を CI で検査していない | プロセス | P1 |
| 14 | `tiers` 拡張（深い装飾の逃げ道）が未文書化 | 文書 | P2 |
| 15 | `docs/index.html` が契約外の語彙を使用 | 整合性 | P3 |
| 16 | 計算可能な全ルールを autofix 可能にする | 提案 | P1 |
| 17 | 自作コンポーネント境界のゾーンを追加 | 提案 | P2 |
| 18 | fixed variant 機構を廃止（テーブル要素は自己マップ） | 提案 | P2 |
| 19 | 段階導入手段（severity / baseline）がない | 提案 | P2 |
| 20 | state / variant の判定基準、variant 禁止語彙の判定単位 | 設計 | P2 |

---

## P0 — サイレントに検査が無効化される

「緑なのに未検査」は、契約の価値そのもの（検証されていること）を壊すため最優先。

### 1. `<style lang="scss">` が無検査

**症状**: 同一の違反が、`<style>` では検出され `<style lang="scss">` では**警告ゼロ**。
パースエラーも報告されないため、導入したプロジェクトは「適合している」と誤認する。

**再現**:

```vue
<!-- ScssSurface.vue -->
<style scoped lang="scss">
.app-scss-surface {
  .unit { .title { font-weight: 700; } }   /* > が無い＝owned-dom-direct-child 違反 */
}
</style>
```

```
CssSurface.vue  (lang なし)  → 2 errors (owned-dom-direct-child)
ScssSurface.vue (lang="scss") → (no report)   ← 中身は同じ違反
```

`postcss-html` に直接かけると `rules=0`、`stylelint` の `parseErrors` も空。

**原因**: `postcss-scss` が依存に無く、`postcss-html` が scss ブロックを解決できない。
`packages/stylelint-plugin/src/index.mjs` の `createNagiStylelintConfig()`（`customSyntax: postcssHtml`）。

**方針（決定済み）**: **素の CSS のみ対応**。SCSS / Less / Stylus は非対応で、将来に向けた作り込みもしない
（需要が出たら追加する）。ドキュメントは反映済み — CONTRACT.md の Required と新節、README の Scope、FAQ、
`skills/nagi-css/references/configuration.md`。

**したがって残る修正はひとつだけ**:

- **解析できなかった `<style>` を落とす**（`nagi-css/unsupported-style-syntax` 等）。
  スキップして緑になるのが問題の本体で、対応言語を増やす話ではない
- `postcss-scss` / `postcss-less` の追加は**不要**（除外を選んだので実装は A より小さい）

### 2. 単体 `.css` ファイルが無検査 → **対象外と決定**

**当初の症状**: README が例示していた `stylelintFiles: ["src/**/*.{vue,css}"]` の `.css` 側が機能しない
（以下の `tokens.css` で違反ゼロ）。

```css
.wrapper { margin: 0; }    /* banned name */
.is-active { color: red; } /* state class */
.card div { color: blue; } /* bare element */
```

**方針（決定済み）**: 単体 `.css` は**検査対象外**。グローバルスタイルシートに書かれるのは
リセット、要素の既定値、トークン宣言、サーフェス横断の例外であって、いずれもサーフェスの owned styling ではない。
契約が統べる対象が存在しないので、検査しないのが正しい。**バグではなく仕様**として文書化済み。

**残る修正**:

- `packages/cli/src/cli.mjs:66` の既定値 `["**/*.vue", "**/*.css"]` → `["**/*.vue"]`
  （ドキュメントを直したのに既定値が `.css` を拾うままだと、新しい記述と食い違う）
- `.css` が明示的に渡された場合の扱いを決める（黙って無視 / 対象外として警告）

### 3. ARIA ロール identity が `reserved-element-name` に潰される

**症状**: CONTRACT.md §Semantics 1 は「`role` 属性が一致すれば div/span にロール名を base として許可」と定めているが、
**要素名と綴りが同じロールが全滅**する。契約書自身の例（L716 `<div class="dialog -confirm" role="dialog">`）が落ちる。

**再現**:

```
div class="menu"    role="menu"    → reserved-element-name
div class="dialog"  role="dialog"  → reserved-element-name
div class="table"   role="table"   → reserved-element-name
div class="form"    role="form"    → reserved-element-name
div class="figure"  role="figure"  → reserved-element-name
div class="main"    role="main"    → reserved-element-name
div class="option"  role="option"  → reserved-element-name

div class="toolbar" role="toolbar" → OK    ← 要素名と衝突しないロールのみ通る
div class="tablist" role="tablist" → OK
div class="row"     role="row"     → OK
```

**原因**: `packages/core/src/template-analysis.mjs` の `reserved-element-name` 検査（`:392-406`）が、
`acceptsRoleIdentity`（div/span ＋ 一致する `role`）の例外を考慮していない。

**期待**: div/span で `role` 属性が一致する場合はロール名を許可する。
**テストの穴も同時に埋める**: 既存テストは `toolbar` / `separator` のみを使っており、この破綻をすり抜けている（`dialog` / `menu` のケースを追加）。

---

## P1 — 誤検出（正しいコードが書けない）

### 4. `+` / `~` 兄弟結合子の誤検出

**症状**:

```
> .item + .item   → ✖ Selector "> .item + .item" uses "+" between owned elements; use ">".
> .value ~ .value → ✖ 同様
```

CONTRACT.md は「**親子ステップ**に `>` を必須」としか定めておらず、兄弟結合子を禁じていない。
`.item + .item { border-top }` が書けず、回避策も文書化されていない。

**原因**: `packages/stylelint-plugin/src/index.mjs` の `checkEdge()`（`:285-305`）が `>` 以外の全結合子を境界違反として扱う。

**期待**: `+` / `~` は owned DOM 内でも許可（親子ステップの検査対象外）。境界を越える `+`/`~` の扱いは別途定義。

**補足（正常）**: `:is()` `:has()` `:not()` `&:hover` `&::before` は正しく通ることを確認済み。

### 5. `<Transition>` / `<Suspense>` / `<KeepAlive>` がルートを包むと崩壊

**症状**: Vue で定石のこの形で、surface root が検出されず誤検出2件が出る。

```vue
<template>
  <Transition name="fade">
    <section class="app-fade-panel"><h2 class="title">Hi</h2></section>
  </Transition>
</template>
```
```
anatomy-allowed:        Class "app-fade-panel" is not an element, component, anatomy, ...
element-class-required: <section> requires the static class "section"
surfaceRoots: []   ← surface-root 検査が事実上オフになり、Stylelint 側の判定も変質する
```

**原因**: `packages/core/src/template-analysis.mjs`
- `isMainRoot` が `depth === 0` を要求（`:237-239`）
- transparent 扱いが `tagType === 3`（`<template>`）と `<slot>` のみ（`:439-449`）

**期待**: `Transition` / `TransitionGroup` / `KeepAlive` / `Suspense` / `Teleport` を transparent に追加（設定で追加可能に）。

### 6. `pages/index.vue` の導出バグ

```
/src/pages/orders/index.vue → app-orders-page   ✔
/src/pages/index.vue        → app-src-page      ✖ ソースディレクトリ名が漏れる
/src/pages/[id].vue         → app-src-page      ✖
```

**原因**: `packages/core/src/index.mjs` `deriveSurfaceRootName()`（`:291-305`）が
`index` / `[param]` のとき祖先を遡る際、`pages` の上まで抜けてしまう。

**期待**: `pages` 直下の `index` / `[param]` は `index-page`（または設定した既定名）に落とす。`pages` より上は遡らない。

### 9. テンプレート↔セレクタ対応検査が未実装

**症状**: 以下は**すべて違反ゼロ**で通る。

```vue
<template>
  <section class="app-mirror-check">
    <header class="header"><h2 class="title">Hi</h2></header>
  </section>
</template>
<style scoped>
.app-mirror-check {
  > .title { }                     /* 誤階層（title は header の子） */
  > .icon { }                      /* 死んだルール（テンプレートに .icon が無い） */
  > .header > .item > .value { }   /* 存在しないチェーン */
}
</style>
```

README / FAQ の以下の主張が、現状のツールでは裏付けられていない。

> selectors are derived from the template's structure, so a rule whose anchor class no longer exists in the template is mechanically detectable
> `.title` is safe only because it is always anchored to its surface through a `>` chain

**期待**: テンプレート解析で DOM ツリーはすでに構築済みなので、セレクタチェーンとの照合は実装可能。
新ルール2本を提案:
- `selector-mirrors-template`（`>` チェーンがテンプレートの親子関係と一致すること）
- `no-dead-rule`（アンカークラスがテンプレートに存在すること）

これは Nagi CSS が他システムに対して**唯一無二になれる**検査でもある。

### 10. 値（トークン）の canonical form が未検査

**症状**: `padding: 13px; color: #f0a; margin-top: 7px` はすべて通る。
デザイントークンは CONTRACT.md の SHOULD に留まり、Stylelint 側に値の検査ルールが1本もない。
名前の canonical form を売りにしながら、**値の canonical form は Tailwind のほうが強制している**状態。

**提案（導出規則にできる）**:
- **CSS の値空間が既に有限なプロパティは検査不要**（`display` `position` `overflow` …）、**無限なプロパティはトークン必須**
- 無限側の切り分けも機械判定可能:
  - 絶対量（px/rem/em/ch…）と色 → **デザイン決定** → トークン必須
  - 相対比（`%` `fr` 無単位 `16 / 9`）とキーワード → **構造決定** → 素で可
  - 原始定数（`0` `auto` `none` `100%`）→ allowlist
- 一度きりの生値（光学補正など）は **サーフェス先頭の `--local-*` 宣言経由のみ**許可
  （STN が `wrapper` を禁止して機械的な名前を与えたのと同型の解法）
- トークン集合自体の正規化: 数値インデックスのみ（`--space-1..12`、`sm/md/lg` 禁止）／
  色は原始パレットとセマンティックの2層で**原始層の直参照を禁止**／**同義トークン（同一算出値）を検出して拒否**

新ルール案: `value-token-required` / `token-layer` / `local-value-declaration` / `logical-properties-only` / `token-alias-free`

**既知の限界（正直に書くべき）**: `@media` は `var()` を使えないためブレークポイントはトークン化できない。
`calc` はトークン同士の加減のみ許可（係数の乗算を許すと非正規値の入口になる）。
グラデーションや `clip-path` は `--local-*` の命名強制で受け止める。

---

## P2 — 整合性・プロセス

### 11. CONTRACT.md の例3件がリンタで落ちる

CONTRIBUTING の ground rule に反する（「Every example must pass the linter」）。

| 箇所 | 例 | 結果 |
|---|---|---|
| L659 | `<div class="seg -search">` | `variant-shadows-vocabulary`（`search` が ARIA ロール） |
| L313 / L596 | `-success` 変体（「status → `-success` 変体に流せ」と明記） | `state-not-class`（既定 `stateClasses` に含まれる） |
| L716 | `<div class="dialog -confirm" role="dialog">` | `reserved-element-name`（#3） |

**期待**: 例を直すか、ルールを直すか、どちらかに寄せる。
`-search` については**ルール側が過剰**と考える（#20 参照）。`-success` は state/variant の基準そのものの問題（#20）。

### 12. CONTRACT.md L478 の矛盾

自己マップの列挙に `<thead>` → `thead` と書かれているが、同文書の Element Class Table と実装は `rowgroup -head`。

### 13. ドキュメント例を CI で検査していない

CI は `pnpm test` のみ。CONTRIBUTING が「ドキュメントのマークアップもアプリコードと同じように検査する」と宣言しているのに、その仕組みが無い。

**期待**: `CONTRACT.md` / `README.md` / `skills/**/*.md` のコードブロックを抽出してリンタに通すテストを追加。
#11 の3件はこれがあれば発生しない。

### 14. `tiers` 拡張が未文書化

**確認済みの事実**: 深い装飾のための逃げ道は**すでに実装されている**。

```
既定7段で8段チェーン                    → stn-order（拒否）
tiers に粗い側の語を足して8段            → OK
その設定のまま浅い2段                    → OK（unit 始まりのまま、浅い側に影響なし）
g より深い側に足す                       → 非対応（floor / reach-g が "unit" と "g" を名前で引くため）
```

**期待**:
- `tiers` を「深い装飾のための公式な逃げ道」として文書化する（粗い側に足す、`unit` と `g` は残す）
- 逃げるには設定ファイルの変更が必要＝**意図的にしか深くできず、diff に残ってレビューされる**。この性質は明示的に売りとして書いてよい

### 7. `config.ignores` が Stylelint に渡っていない

`packages/cli/src/cli.mjs` の `runEslint()` は `config.ignores` を使うが、`runStylelint()` は無視している。
対象リポジトリに vendor 配下の `.vue` / `.css` がある場合、Stylelint 側だけ除外できない。

### 8. 出力の不統一

ESLint 側は絶対パス、Stylelint 側は相対パス。集計行が2つ出て合計が読めない。
CLI として1本のレポートに統合するのが望ましい。

---

## P1〜P2 — 提案（議論を経た結論）

### 16. 計算可能な全ルールを autofix 可能にする（最重要の「回収」）

導出の本当の価値は「著者が収束すること」より **「機械が答えを出せること」** にある。
一意性（canonical form）が源泉であり、そこから価値を取り出す経路は2つあってコストが桁違い:

- **教育で収束させる**: 全著者が語彙を学ぶ。コストは（著者数 × ファイル数）で効き続ける
- **機械が修正する**: 実装1回。著者は何も覚えなくていい

現状 `fixable` は2ルールのみ（`element-class-required` / `component-class-required`。動作確認済み、正しく `class="title"` `class="item"` を挿入する）。
計算可能なのに直せないものが残っている:

| ルール | 計算可能性 |
|---|---|
| `surface-root-name` | ファイル名から一意に決まる |
| `stn-order` / `stn-floor` | チェーン位置から一意に決まる（4→5段のリネーム連鎖も機械的に解ける） |
| `variant-order` | ソートするだけ |
| fixed variant の欠落（`rowgroup` → `rowgroup -head`） | 表から一意 |

**副産物**: autofix できる規則は人間が暗記する必要がなくなるため、CONTRACT.md の該当章（要素表・ティア規則・variant 順序）は「参考資料」に降格できる。
1246 行のうち機械が直せる部分の説明が占める割合を下げ、**機械が答えを出せない場所**（variant の意味語、コンポーネント分割、state か様式か）を厚く書くほうが投資効率が良い。
これは「語彙の学習コスト」という採用障壁への直接の回答にもなる。

### 17. 自作コンポーネント境界のゾーンを追加

現状の区別は「ライブラリか、それ以外か」だけで、**自作コンポーネントと自作の div が区別できない**。

```vue
<UserAvatar class="media" />   <!-- 通る（確認済み） -->
```
```css
.app-profile-header {
  > .media { margin-inline-end: 0.75rem; }   /* .media は div？子コンポーネント？ 判別不能 */
  > .media > .icon { }                       /* 他サーフェスの内部に降下。現状は検出不能 */
}
```

契約は「各サーフェスは独立に契約を適用する」「レイアウトは外・スキンは内」と定めているので 2行目は違反だが、
リンタは `.media` が子コンポーネントの根だと知らないため捕まえられない。

**提案**: ゾーンを4つにする。

| ゾーン | 印 | リンタが言えること |
|---|---|---|
| 自分の owned DOM | 語彙クラス | `>` 必須 |
| **自分の子サーフェス** | **専用プレフィックス（要検討）** | **`>` で到達は可、そこから先へ降りるのは禁止** |
| ライブラリ境界 | `pv-` 等 | `>` で到達、以降は子孫ステップ |
| ライブラリ内部 | `p-` 等 | 公開契約経由のみ |

CONTRACT.md L543 は「非不透明な `ownedComponentClasses` は定義しない」と明示的に選択しているが、
**「他人のサーフェスに降りていく」という頻出の設計違反が検出可能になる**ため再考の価値がある。

### 18. fixed variant 機構を廃止（テーブル要素を自己マップに）

`thead → rowgroup -head` / `tfoot → rowgroup -foot` / `th → cell -head` の**3件のためだけ**に、
表の値がマルチトークンになり（`mappingBase` / `mappingTokens` / `fixedVariantBases`）、
`partialCarry` 判定が入り、「base との複合でのみ合法」の例外が variant シャドウ検査にも波及している。

**提案**: `thead`/`tbody`/`tfoot`/`th`/`td` を自己マップにして機構ごと削除。根拠:

- 表の方針は「意味を担う上書きだけを載せる」。`thead`/`tbody` は**タグ名自体が意味を担っている**ので上書き対象ではない
- `figcaption` や `optgroup` を自己マップにしておいて `thead` を上書きするのは一貫していない
- `th` は文脈により ARIA で `columnheader` / `rowheader` の両方になりうるので、単一名に固定すると嘘になる
- `headcell` のような代替名は発明語で、契約が禁じる「false UI anatomy」に当たる

`tr → row` / `dd → definition` などの単一トークン上書きは機構不要なのでそのまま残す。

### 19. 段階導入の手段がない

`createNagiEslintConfig` は全ルールを `"error"` 固定、Stylelint も `[true, semantic]` 固定。
CLI に severity 指定が無いため、既存リポジトリに入れると数千件のエラーで採用不能になる。
逃げ道はインライン disable コメントのみ（ただしスキルは対象リポジトリへの設定追加を禁じている）。

**期待**: severity 指定 / ルール個別 off / baseline（既存違反を許容し新規のみ落とす）のいずれか。

### 20. state / variant の判定基準と、variant 禁止語彙の判定単位

**(a) state の基準が固定リストのみ**: `-collapsed` `-empty` `-dragging` は通る。
`` :class="`-${tone}`" `` も中身不明で通る。
「実行時に変わるか」はクラス名から原理的に不可視なので、完全検査は不可能。
**契約側の表現を弱める**か、`-` 変体を静的リテラルに限定して「変化しうる経路を構文で塞ぐ」方向のどちらかに寄せるべき。
併せて既定 `stateClasses` の `-success` / `-error` は CONTRACT.md L596 の指示と衝突しているので、どちらかを直す。

**(b) variant 禁止語彙の判定単位が広すぎる**: 禁止 stem は
レンダリング要素名（約110）＋ ARIA ロール（約90）＋ 要素表の値 ＋ anatomy ＋ STN ＋ banned で約200語。
`-search` `-note` `-main` `-list` `-menu` `-status` `-time` `-group` `-region` `-row` `-image` … 自然なデザイン語が広範に潰れる。
ルールの理由（変体は「それが何であるか」を名指さない）は `<p class="text -title">` には正しいが、
判定を**「全語彙」ではなく「その要素にとって合法な base になり得る語」**に限定すべき。
`seg -search` は「この区画は検索エリアに属する」であって役割の主張ではない。

---

## 設計上の未解決（実装では直らない項目）

修正リストではなく、主張の書き方に関わる論点。

1. **決定論の射程**: canonical form は「与えられたツリーに相対的」。div をいくつ挟むかは著者の選択で、その選択は決定論の外にある。
   加えて anatomy と STN の切り分け（`field` か `unit` か）は crisp definition 頼りで判断が残る。
   FAQ はコンポーネント分割のみを非決定論と認めているが、実際にはもう少し広い。
2. **variant が自由記述**: 実コードで命名エントロピーが溜まる最大の場所（ドメイン語）が禁止リスト以外で無制約。
   導出されるのは base identity（そもそも揉めにくい名前）の側。BEM との差分は modifier 側には及んでいない。
3. **ファイル名結合**: surface root をファイル名から導出し、かつ親が子の外側レイアウトを持つため、
   **子ファイルのリネームが親のスタイルを黙って壊す**。
   また `components/user/Card.vue` と `components/billing/Card.vue` が両方 `app-card` に導出され、
   識別子の一意性は保証されない（scoped CSS への暗黙の依存）。
4. **`when-styled` 既定**: クラスの有無が隣の `<style>` の内容に依存するため、正解が「マークアップ＋スタイルシートの対」から決まる。
   CSS に1行足すと適合していたテンプレートが非適合になる。`always` にすれば消える。
5. **検証可能性の前提が Required に無い**: 契約の価値は検証可能性から来ており、それは
   「クラス集合を静的に列挙できるテンプレート」に依存する。CSS nesting と同じ強さで前提として明記すべき。
   「contract itself is framework-agnostic」は規則については正しいが、価値の源泉は移植されない。
6. **`tiers` が設定可能**なので「Nagi CSS 準拠」はプロジェクト間で同じ意味を持たない。
   これは #14 の逃げ道として肯定的に扱ってよいが、**canonical form は設定に相対的**であることを明記すべき
   （`surfaceRootPrefixes` `anatomyClasses` `elementClasses` `emitPolicy` も同様なので、`tiers` だけの問題ではない）。

### 撤回した指摘

初回に挙げたが、議論を経て取り下げたもの（記録として残す）。

- **STN を `unit` 1語＋深さ上限に縮める案** — 撤回。
  リネーム連鎖が起きるのは 4→5 段を跨ぐときだけで（1〜4段の成長ではリネームゼロ）、
  深い構造は装飾目的で一度書いたら固まるため、**痛みが最も小さい場所に集まっている**設計だった。
  未使用の語彙（`stratum`/`region`）の学習コストはほぼゼロで、語彙のコストとルールのコストを混同していた。
  残る提案は #14（文書化）と #16（`stn-order` の autofix 化）のみ。
- **`pv-` 自動導出は価値が薄いという指摘** — 撤回。
  節約しているのはタイプ数ではなく、**プレフィックスが構造的に保証される（打ち間違えられない）**こと。
  さらに `libraryBoundaryPrefixes` / `libraryInternalPrefixes` は `>` と子孫ステップの判定に直接使われており、荷重部材である。

---

## 確認済み: 正常に動作した項目

心配しなくてよい範囲。

- 素直に書いた適合コンポーネントは違反ゼロで通る（誤検出なし）
- `--fix` は保守的かつ正確（`<h2>` → `class="title"`、`<li><a>` → `class="item"` / `class="link"`。競合する base がある場合は修正しない）
- `:is()` / `:has()` / `:not()` / `&:hover` / `&::before` / `@media` 内のネスト
- ライブラリ境界の判定（`> .pv-data-table .p-datatable-tbody` は OK、`:deep()` の扱いも含む）
- slot サブサーフェス（`componentSlots`）、`pages/orders/index.vue` → `app-orders-page` の導出
- v-if / v-else で同じ surface root クラスを持つ2ルート
- SVG / MathML 内部に降りない
- 性能: 300 コンポーネントで約 2.7 秒（約 9ms/file）。CI 常時実行に耐える
- 既存テスト 35 件すべて通過

---

## 着手順の推奨

1. **#1 / #3**（サイレントなスキップと契約矛盾）— 独立していて安全、影響が最大。#2 は方針決定で消え、CLI 既定値の1行だけが残った
2. **#4 / #5 / #6**（誤検出）— 小さく独立
3. **#13**（ドキュメント例の CI 検査）— #11 の再発を止める
4. **#16**（autofix 化）— 導出の回収。学習コストと文書量を同時に下げる
5. **#10**（値のトークン化）— 最大の空白。他システムに対する差別化にもなる
6. **#9**（テンプレート↔セレクタ対応）— README の主張の裏付け。Nagi CSS 固有の検査
