# Nagi CSS レビュー結果 — 修正すべき内容

対象コミット: `83d6b05`（Replace zone with unit in STN）
検証方法: サンドボックスの Vue アプリに「現場でよくある書き方」を並べて CLI を実走。
`packages/core` の `analyzeVueTemplate` を直接叩いた挙動確認を併用。
記載した症状はすべて再現済み（推測のみの項目には「未確認」と明記）。

**#10 完了**: 値のトークン化は3段すべて実装済み（境界検査・色・長さ）。全項目に着手済みで、未着手は残っていない。

## 状態

| 状態 | 項目 |
|---|---|
| **修正済み**（このブランチ） | #1 #2 #3 #4 #5 #6 #7 #21 #22 — 確認されたバグ全件。テスト同梱 |
| **実装済み**（このブランチ） | #18 #23 — fixed variant 機構の廃止と表の2層化。#12 もこれで解消<br>#19 — per-rule `severity`（`error` / `warn` / `off`、`*` フォールバック、未知名は設定エラー）<br>#9 — `dead-rule` / `selector-mirrors-template`（テンプレートの owned ツリーとセレクタ鎖の照合）<br>#16 — autofix を6ルールに拡大<br>#17 — 自作コンポーネント境界（`owned-component-identity` / `owned-surface-reach-in`）。パススルー方式は廃止<br>#20 — `variant-must-be-static`＋変体禁止語彙を base identity に限定<br>#8 — 2リンタの出力を1本に統合<br>#13 — 注釈付きドキュメント例を CI で検査（11パターン＋README）<br>#14 #15 — `tiers` 拡張の文書化、docs サイトの語彙修正<br>派生 — 見た目由来タグ（`<b>` `<i>` `<u>` `<s>`）の自己マップ廃止、`unverifiable-dynamic-class`（検証不能の通知、既定 warning） |
| **文書反映済み**（このブランチ） | 素の CSS のみ対応・単体 `.css` 対象外の方針（CONTRACT.md / README / FAQ / configuration.md） |
| **実装済み**（このブランチ、#10） | 第1段 `unknown-token` / `token-layer`（トークンは出荷せず、境界だけを検査）、第2段 `value-token-required`（色）、第3段 `length-token-required`（スケール系プロパティの長さ、`--local-*` の命名で逃げられる） |
| **未着手** | なし |

#11 は #20 と #3 の実装で3件すべて解消（`-search` はルール修正、`-success` は state リストから削除、`dialog role=dialog` は #3）。加えて `-footer` の例は #13 が検出したので修正済み。
`<b>` `<i>` `<u>` `<s>` を `bannedClasses` に寄せる案（#23 の派生）は**実装済み**。当初「既存コードを弾く」と見積もったが、実測すると影響は「スタイルを当てている `<b class="b">`」だけで、文中の装飾的な `<b>`（クラス無し）と契約が明記する `<i class="icon">` は無関係だった。

---

## サマリ

| # | 内容 | 種別 | 優先 | 状態 |
|---|---|---|---|---|
| 1 | 解析できない `<style>`（`lang="scss"` 等）が**サイレントにスキップされる** | バグ | **P0** | **修正済み** |
| 2 | 単体 `.css` が無検査 → **対象外と決定** | 仕様化 | P2 | **修正済み** |
| 3 | ARIA ロール identity が `reserved-element-name` と衝突（契約と矛盾） | バグ | **P0** | **修正済み** |
| 4 | `+` / `~` 兄弟結合子を誤検出 | バグ | P1 | **修正済み** |
| 5 | `<Transition>` などがルートを包むと surface 検出が崩壊 | バグ | P1 | **修正済み** |
| 6 | `pages/index.vue` → `src-page` になる導出バグ | バグ | P1 | **修正済み** |
| 7 | `config.ignores` が Stylelint 側に渡っていない | バグ | P2 | **修正済み** |
| 8 | 2リンタの出力形式・パス表記が不統一 | UX | P2 | **実装済み** |
| 9 | テンプレート↔セレクタ対応検査が未実装（README の主張が未裏付け） | 未実装 | P1 | **実装済み** |
| 10 | 値（トークン）の canonical form が未検査 | 未実装 | P2 | **実装済み**（第1〜3段） |
| 11 | CONTRACT.md の例3件がリンタで落ちる | 整合性 | P1 | **解消** |
| 12 | CONTRACT.md L478 の `thead` 自己マップ記述が表と矛盾 | 整合性 | P2 | **解消**（#18 により記述が正しくなった） |
| 13 | 「全例がリンタを通る」を CI で検査していない | プロセス | P1 | **実装済み** |
| 14 | `tiers` 拡張（深い装飾の逃げ道）が未文書化 | 文書 | P2 | **実装済み** |
| 15 | `docs/index.html` が契約外の語彙を使用 | 整合性 | P3 | **修正済み** |
| 16 | 計算可能な全ルールを autofix 可能にする | 提案 | P1 | **実装済み** |
| 17 | 自作コンポーネント境界のゾーンを追加 | 提案 | P2 | **実装済み** |
| 18 | fixed variant 機構を廃止（`thead`/`tbody`/`tfoot` を self-map、`th`/`td` は同じ `cell`） | 提案 | P2 | **実装済み** |
| 19 | 段階導入手段がない → `severity` を実装（baseline は見送り） | 提案 | P2 | **実装済み** |
| 20 | state / variant の判定基準、variant 禁止語彙の判定単位 | 設計 | P2 | **実装済み** |
| 21 | `<style src="...">` が全チェックをすり抜ける（#1 と同じクラスの穴） | バグ | **P0** | **修正済み** |
| 22 | `elementClasses` の値検証が無く、不正値が TypeError になる | バグ | P3 | **修正済み** |
| 23 | Element Class Table を2層に分け、上書きの基準を書き換える | 設計 | P2 | **実装済み** |

### 修正の内容

- **#1 / #21** — `lang` 付き・`src` 参照の `<style>` を `unsupported-style-syntax` で報告。
  **報告は ESLint 側**：Stylelint はブロックが1つも解析できなかったファイルでは**ルールを呼ばない**ため
  （検証済み: `called: 0`）、Stylelint 側では原理的に報告できない
- **#2** — CLI の既定 `stylelintFiles` を `["**/*.vue"]` に
- **#3** — div/span が一致する `role` を持つ場合は `reserved-element-name` を免除（`dialog` `menu` `table` `form` `figure` `main` `option`）
- **#4** — `+` / `~` は親子ステップではないので直接子要求の対象外に
- **#5** — `Transition` / `TransitionGroup` / `KeepAlive` / `Suspense` / `<template>` / `<slot>` を
  透過扱いに統一（テンプレート直下でも、STN チェーンの段数としても）。
  `Teleport` は DOM を移動させるので**意図的に除外**（`detachedSlotSurfaces` の領域）
- **#6** — `pages` より上のディレクトリを遡らない。`pages/index.vue` → `index-page`、`pages/[id].vue` → `id-page`
- **#7** — `config.ignores` を Stylelint の `ignorePattern` に渡す
- **#22** — `elementClasses` の値を `validateNagiConfig()` で検査（非空文字列／単一 base ／変体でない）。
  併せて `mappingBase` を非文字列に耐えるようにし、TypeError ではなく設定エラーとして出るように
- **#18 / #23** — `thead`/`tbody`/`tfoot` を self-map、`th`/`td` を同じ `cell` に。
  fixed variant 機構（`mappingTokens` / `fixedVariantBases` / `partialCarry` / variant シャドウの例外）を**全削除**。
  マッピングは単一 base のみで、複数トークンは設定エラー。
  Element Class Table を**機械的上書き**（`title` / `list` / `item` / `cell`）と
  **可読性上書き**（`text` `note` `link` `image` `term` `definition` `row`）の2層に分け、
  基準を「**タグがスタイルとは無関係な理由で変わりうる箇所だけ上書きする**」に置き換えた。
  CONTRACT.md / CONTRIBUTING / naming-flow.md を同時に更新。`<thead class="thead">` が正になったので #12 も解消
- **#9** — テンプレートから owned ツリー（クラス・親子・兄弟・不透明フラグ）を構築し、
  Stylelint 側で解決済みセレクタ鎖と照合。`dead-rule`（アンカークラスがテンプレートに存在しない）と
  `selector-mirrors-template`（クラスはあるが経路が存在しない）の2ルール。
  **保守的に設計**：不透明（コンポーネント根・`slot`）を跨ぐ、動的クラスが候補にある、`:deep()`、
  `:is()` 内のクラス、ライブラリ境界／内部クラス、slot サーフェスを含む鎖は `unknown` として**報告しない**。
  変体（`-*`）は条件付きが多いので照合対象外。兄弟結合子は兄弟として正しく解決する。
  要素表が要求するクラス（`expectedClasses`）は「死んだルール」ではなく
  `element-class-required` の担当なので二重報告しない
- **#16** — autofix を **2 → 7 ルール**に拡大。追加分は `surface-root-name`（ファイル名から一意なとき）、
  `stn-order`（祖先の1つ下のティア）、`stn-floor`（`unit`）、`variant-order`（アルファベット順に並べ替え）、
  `owned-component-identity`（渡されたクラスを削除）。
  実装は class 属性全体の書き換えに統一（`rewriteClassFix` / `replaceToken`）。空になれば属性ごと削除。
  ESLint は複数パス適用するので、STN のリネーム連鎖も1回の `--fix` で解ける
- **#17** — 自作コンポーネント境界。**親のタグにはクラスを渡さない**方式に変更（パススルー廃止）。
  子の根は自分のファイル由来のサーフェス根を既に持ち、Vue の scoped CSS は**その要素にだけ**親のスコープ ID を付けるので、
  親は `> .app-user-avatar` で当てられる。受け入れるクラス名は**テンプレート内のコンポーネントタグから導出**
  （`surfaceRootPrefixes` + kebab(タグ名)）するので、設定もクロスファイル解決も不要。
  タイプミスとリネーム後の古い名前は `anatomy-allowed` で落ち、
  タグへの基底クラスは `owned-component-identity`（autofix 付き）、
  根より下への降下は `owned-surface-reach-in`。変体は「配置」なので渡してよい。
  **scoped CSS では降下したルールは実行時に無言で効かない**ので、この検査は「死んでいるのに意図的に見えるルール」を可視化する。
  **併せて**: 境界より下の子孫セレクタに `owned-dom-direct-child` が「`>` を使え」と誘導していた問題
  （今回新たに判明）も解消。境界判定を先に行い、指摘を1本に置き換える
- **#20** — (a) `variant-must-be-static` を追加。**バリアントは静的な `class` 属性のみ**で、
  バインディングで付け外しするものは実行時の状態なので落とす。これで
  「どの語が状態か」を知る必要がなくなる（語彙リストは静的な書き間違いを拾う保険として残す）。
  併せて `-success` / `-error` を既定 `stateClasses` から削除（トーンの語と二重の意味を持ち、
  CONTRACT.md L596 と衝突していた。本当に状態なら動的になるので (a) が捕まえる）。
  (b) バリアント禁止語彙を **base identity として存在する語**に限定。
  ARIA ロール名のみの語（`-search` `-toolbar` `-status`）は解禁し、
  **その要素が該当 `role` を宣言しているときだけ**落とす
- **#8** — 2リンタの結果を集めて**1本のレポート**に統合（対象ディレクトリからの相対パス、
  ファイル・行でソート、集計行は1つ）。フォーマッタ経由をやめ、診断を直接組み立てる
- **#13** — `tests/docs.test.mjs` を追加。`<!-- nagi-check file=… -->` の注釈が付いた
  ドキュメント例をリンタに通す（`prefix=` `components=` `slots=` `emit=` を渡せる）。
  CI は `pnpm test` なので自動的に走る。**導入した時点で4件の実問題を検出**した：
  skill の pattern 11 件がすべてプレフィックス無しの surface root だったこと、
  ライブラリ例3件の設定が例と食い違っていたこと、`component-slot` の `<section>` にクラスが無かったこと、
  そして `dynamic-class.md` が (a) で禁止したばかりの `:class="{ '-muted': … }"` を教えていたこと
- **#14** — `tiers` の拡張を CONTRACT.md（Depth is capped の節）と configuration.md に明記。
  粗い側に足す、`unit` と `g` は残す、`g` より下は非対応、共有設定の変更なので diff に残る
- **#15** — docs サイトの `codeblock` / `snippet` を `pre` / `code`（自己マップ）に修正。
  `style.css` 冒頭にあった "Site profile mappings" の宣言も削除（#23 で上書きは閉じたリストにしたため）。
  他の逸脱に見えたクラスはコード例の中身（エスケープ済みテキスト）で、実マークアップではなかった
- **派生1（#23 から）** — `<b>` `<i>` `<u>` `<s>` の自己マップを廃止し、クラス名として禁止。
  タグ名が「太字・斜体・下線・打ち消し」という**描画**を指しており、`.b` `.i` は
  契約の Semantic 原則が拒否する「生の見た目」そのものだった。
  影響は狭く、**スタイルを当てている場合だけ**合法なクラスが無くなる（`<strong>`/`<em>` へ誘導）。
  文中の装飾的な `<b>`（クラス無し）と `<i class="icon">` は無関係。
  併せて、禁止語となった要素名に `reserved-element-name` が二重報告するのもやめた
- **派生2（#20 から）** — `unverifiable-dynamic-class` を追加。読めない `:class` 式
  （`iconName`、`` `-${tone}` ``、`pick()`）を報告する。**既定は warning**：
  これは「違反」ではなく**「検証できなかった」の通知**で、コードは正しい可能性が高い。
  そのためルール単位の既定値の仕組みを導入した（優先順位は
  個別指定 > `"*"` > ルール既定 > `error`）。README の適合例 `:class="iconName"` は
  警告が出るだけで通り、それは事実として正しい。オブジェクト形式（リテラルキー）で書けば検証される

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

### 21. `<style src="...">` が全チェックをすり抜ける

**症状**: Vue SFC の正式機能である外部スタイル参照を使うと、**検査が実質無効になる**。

```vue
<template>
  <section class="app-user-card">
    <h2>Ada</h2>
    <div class="wrapper"><p>text</p></div>
  </section>
</template>
<style src="./UserCard.css" scoped></style>
```
```
<style src=...>  → anatomy-allowed のみ（wrapper だけがテンプレート単独で検出される）
インライン        → element-class-required ×2, anatomy-allowed
```

**原因**: `collectStyledClasses()` は `descriptor.styles[].content` を読むが、`src` 参照ではこれが空。
`emitPolicy: when-styled` の既定と組み合わさり、**参照クラスが0個＝何も必須にならない**と判定される。
外部の `.css` 側も（方針決定により）対象外なので、**構造 CSS が丸ごと無検査のまま緑になる**。

**期待**: 2択で、どちらでも筋は通る。**黙って通すのは不可**（#1 と同じ「緑なのに未検査」）。

- `src` を解決して検査する — `src` は「コンポーネント自身の style ブロック」の置き場所違いなので、定義上は含まれる
- `src` 付き style ブロックを非対応として落とす — 対応構文を絞る方針と一貫する

**併せて**: 境界の言い方を「拡張子」ではなく **「テンプレートと対になっている style ブロック」** に寄せると、
`.css` を外す理由と、将来フレームワークを増やしたときの線引き（React の `.module.css` は対になっている）が同じ1文から出る。

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

### 10. 値（トークン）の canonical form が未検査 — **実装済み**（第1〜3段）

**症状**: `padding: 13px; color: #f0a; margin-top: 7px` はすべて通る。
デザイントークンは CONTRACT.md の SHOULD に留まり、Stylelint 側に値の検査ルールが1本もない。
名前の canonical form を売りにしながら、**値の canonical form は Tailwind のほうが強制している**状態。

**議論して決めた前提**: Nagi CSS は**トークンを出荷しない**。どの値が存在し何と呼ぶかはデザインシステム
（nagi-ui など）の決定で、命名契約が同時にパレットを持つと2つの製品が1つに混ざる。
Nagi CSS が検査するのは**境界**だけ — 参照したトークンが実在するか、どの層から読んだか。
当初この節は「トークン集合の正規化」（数値インデックス必須、同義トークン拒否）まで提案していたが、
前者は設定側の自由、後者は DTCG のエイリアシングと衝突するため取り下げた。

**実装済み（第1段）**: 設定でトークン定義ファイルを層タグ付きで宣言する。

```js
tokens: {
  sources: [
    { file: "src/tokens/palette.css", layer: "primitive" },
    { file: "src/tokens/semantic.css", layer: "semantic" },
  ],
  exposedPrefixes: ["--pv-datepicker-"],
}
```

- `sources` は**データとして読むだけ**でリントしない（「単体 `.css` は対象外」という #2 の決定と衝突しない）。
  パスは `--cwd` 基準で解決。ファイルごとにキャッシュするので大規模走行でも1回読み
- `unknown-token`（**error**）— どの source にも宣言が無い参照。CSS は
  `var(--color-surfce)` を無言で捨てるので、diff は正しく見えたままプロパティが効かない。
  警告ではなく error にしたのはこの沈黙が理由
- `token-layer`（**error**）— 原始層（`--palette-red-500`）の直参照。テーマ変更をトークンファイルの内側に閉じる
- 層は**2層**（primitive / semantic）。第3のコンポーネント層は、外から差し替えたい場合にしか
  元が取れず、その用途には既に `exposedPrefixes`（ライブラリの公開契約）という名前がある
- 免除は3つ: 同じスタイルシート内の宣言（`--local-*` の一度きりの逃げ道を含む）／
  `exposedPrefixes`／`sources` が空のとき全部（トークン層を持たないプロジェクトに何も強制しない）

**実装済み（第2段）**: `value-token-required` — **色はトークン必須**。
色は局所的な決定になりえない（パレットに属し、テーマで動き、同じ hex が20箇所にあれば直す場所が20箇所）ため、
`--local-*` の逃げ道は**与えない**。第1段の2ルールと違い**設定不要**で常時有効
（「どのトークンが正しいか」ではなく「トークンを使っているか」しか問わないので、比較対象が要らない）。
落ちないと困るので既定は error、合わないプロジェクトは `severity` で明示的に切る
（設定が無いと黙って検査しない、という #1 と同種の穴を作らないため）。

- 検出: hex、CSS の名前付き色（148語）、生の成分を持つ色関数（`rgb` `oklch` `color` …）。
  グラデーションや `var()` のフォールバック、`--local-*` の宣言の中も対象
- 通す: `currentColor` `transparent` `inherit`、**システム色**（`Canvas` `GrayText` `Highlight` —
  forced-colors はプラットフォームに委ねるのが目的なので、ここでトークンを要求すると意図が壊れる）、
  相対色構文（`oklch(from var(--color-accent) l c h)` はトークンからの導出で、色を述べていない）、
  トークンだけで構成された `color-mix()`
- **正規表現ではなく値をパース**する（`postcss-value-parser`）。`content: "#fff"`、
  `url(icon.svg#red)`、`font-family: Tan` は色ではなく、正規表現ではこれを区別できない
- **決定**: `var(--color-text, #333)` のフォールバックは **error**（生の色を書いている）。
  ただし `exposedPrefixes` のトークンは免除（`var(--pv-datepicker-fg, #333)`）—
  公開契約は未定義でありうるので、フォールバックはその文書化された既定値になる。
  免除の境界を新設せず、第1段で決めた「公開契約はライブラリの所有物」をそのまま使った

**実装済み（第3段）**: `length-token-required` — 長さ。色と別ルール ID にしたので、
`severity` で**色だけ先に厳格化**できる（推奨する順序。色には正当な一度きりが無い）。

- **プロパティで切る**。当初案は「絶対量の単位ならすべてトークン必須」だったが、これだと
  `max-inline-size: 32rem` が落ちる。デザインシステムが**スケールとして出荷する**のは
  間隔・角丸・境界線幅・字サイズ・影であって、コンテンツ幅の段階表は誰も持っていない。
  そこで対象を `padding*` `margin*` `gap` `border-radius*` `border*-width`（`border` 短縮形含む）
  `font-size` `line-height` `letter-spacing` `box-shadow` `outline-width` `outline-offset` に限定し、
  **サーフェス自身の寸法と位置**（`inline-size` `max-block-size` `top` `inset`）は対象外にした。
  これが「一度きりの寸法」問題の答えで、逃げ道ではなく**所有者が違う**という切り分け
- **逃げ道は「名前」**。`--local-optical-nudge: -1px` と宣言して参照すれば通る。
  値は変わらず、変わるのは「なぜ例外なのか」が書かれていることと、`--local-` で grep できること。
  STN が `wrapper` を禁じずに機械的な名前を与えたのと同じ手
- 対象外: `0`（どの系でも同じ長さ）、比率と相対単位（`50%` `1fr` `40vh` `line-height: 1.5`）、
  角度、時間。時間（モーション）もデザイン決定ではあるが、今回は範囲に入れていない
- 測定: このリポジトリの全ドキュメント例と fixture で新たに落ちたのは3宣言（すべて意味のない埋め草の値）。
  ただし**実アプリでの影響は測っていない**。`border: 1px solid` と `border-radius: 4px` は
  現場では大量に出るはずで、そこは `severity` で段階導入する前提

**既知の限界**: `@media` は `var()` を使えないためブレークポイントはトークン化できない。
`calc` はトークン同士の加減のみ許可（係数の乗算を許すと非正規値の入口になる）。
グラデーションや `clip-path` は `--local-*` の命名強制で受け止める。


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

### 22. `elementClasses` の値検証が無い

`validateNagiConfig()` は `elementClasses` を一切検証しないため、不正値が不透明な例外になる。

```
elementClasses: { p: null }
→ TypeError: Cannot read properties of null (reading 'split')
```

`buildNagiSets()` が全値に `mappingBase()`（`value.split`）をかけるため、設定構築の時点で落ちる。
**期待**: 値が非空文字列であることを `validateNagiConfig()` で検査し、設定エラーとして報告する。
なお `elementClasses` は既定表への浅いマージなので**個別上書きは可能だがマッピングの削除はできない**。
これは仕様として文書化してよい。

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

### 18. fixed variant 機構を廃止

`thead → rowgroup -head` / `tfoot → rowgroup -foot` / `th → cell -head` の**3件のためだけ**に、
表の値がマルチトークンになり（`mappingBase` / `mappingTokens` / `fixedVariantBases`）、
`partialCarry` 判定が入り、「base との複合でのみ合法」の例外が variant シャドウ検査にも波及している。

**提案**: `thead`/`tbody`/`tfoot` を self-map、`th`/`td` は**同じ `cell`** にする。
head と body の区別は**必須の `>` チェーンが祖先として既に持っている**ので、`-head` は不要。

```vue
<table class="table">
  <thead class="thead">
    <tr class="row"><th class="cell">Plan</th></tr>
  </thead>
  <tbody class="tbody">
    <tr class="row"><td class="cell">Free</td></tr>
  </tbody>
</table>
```
```css
> .table {
  > .thead > .row > .cell { }
  > .tbody > .row > .cell { }
}
```

実測: 違反ゼロで成立（`elementClasses` 上書きで確認）。根拠:

- **fixed variant は `>` チェーンと情報が重複している**。`>` は必須なので祖先の鎖は必ず書くことになる
  （STN のティア名がネスト構造の冗長符号化だったのと同じ構図）
- **現行方式にはセレクタ重複の実害がある**。`<thead class="rowgroup -head">` は両方のクラスを持つので、
  `tests/core.test.mjs:63` の正例にある `> .rowgroup > .row > .cell`（tbody 用のつもり）が **thead にも当たる**。
  tbody だけを指すには `.rowgroup:not(.-head)` が必要になる
- `th` は文脈により ARIA で `columnheader` / `rowheader` の両方になりうるので、単一名への固定は嘘になる
- `headcell` のような代替名は発明語で、契約が禁じる「false UI anatomy」に当たる
- `<tbody>` 内の行ヘッダだけは祖先で分けられないが、そこは契約の既定路線どおり
  **属性で届く**（`.cell[scope="row"]`、`.input[type=checkbox]` と同じ扱い）

`tr → row` / `dd → definition` などの単一トークン上書きは機構不要なのでそのまま残す。

**「全部 self-map」は行き過ぎ**（検討して却下）。#23 の3件は機械的な価値があり、
かつ全 self-map は「非 div 要素にクラスを強制する理由」そのものを壊す（下記）。

### 23. Element Class Table を2層に分け、上書きの基準を書き換える

**問題**: 上書きの基準が2箇所で食い違い、どちらも既存の表を説明できていない。

- CONTRACT.md:455 — 「タグ名が安定した UI 意味ではなく **HTML の歴史**を符号化している場合」
- CONTRIBUTING — **略語の展開**（`dd → definition`）と**著者時の詳細の消去**（`h1–h6 → title`）の2つ

実際の表には、この基準で説明できない行が並んでいる（既定マッピングを出力して確認）。

```
<img>  → .image  (override)   略語を展開している
<nav>  → .nav    (self-map)   navigation の略なのに展開しない
<a>    → .link   (override)
<b> <i> → .b .i  (self-map)   ← <i class="i"> が合法
<dfn> <kbd> <samp> <var> <abbr> <figcaption> → self-map
```

`img → image` と `nav → nav` を同時に説明する基準は立たない（どちらも「同義の長い綴り」）。
つまり**表そのものは人の判断で作られた語彙表で、基準は事後の説明**。表より下流は決定論的だが、
表は taste である。それ自体は問題ないが、issue テンプレートが提案に
「meaning-bearing justification」を要求しているのに**既存の表がその基準を満たしていない**ため、
レビュー基準として機能しない。

**提案する基準**:

> **タグが、スタイルとは無関係な理由で変わりうる箇所だけを上書きする。**

この基準は既存の self-map をすべて説明でき（`nav` `svg` `b` `dfn` `figcaption` はスタイル外の理由で別タグに変わらない）、
必要な上書きだけを残す。表は2層に分けて書く。

| 層 | 内容 | 根拠 |
|---|---|---|
| **機械的上書き** | `h1`–`h6` → `title` / `ul` `ol` `dl` → `list` / `li` → `item` / `td` `th` → `cell` | 規則から導出 |
| **可読性上書き** | `p`→`text` `small`→`note` `a`→`link` `img`→`image` `dt`→`term` `dd`→`definition` `tr`→`row` | **明示的に taste と認める**。維持してよいが根拠は好み |
| **廃止** | `thead` `tbody` `tfoot` → `rowgroup ±変体` | 祖先として区別が必要なので self-map が良い（#18） |
| **self-map** | 残り全部 | 既定 |

機械的上書きが必須である理由（全 self-map を却下した理由でもある）:

- **`h1`–`h6` → `title`**: 見出しレベルは文書アウトラインで決まり、見た目とは独立に変わる。
  self-map だと、a11y のためにレベルを下げるだけで CSS の書き換えが必要になり、
  `<component :is="\`h${level}\`">` のようにレベルが動く設計では**静的クラスが原理的に付けられない**
  （契約が要求する静的クラスと矛盾する）。`<input>` の `type` をクラスに写さないのと同じ理由
- **`ul`/`ol` → `list`、`li` → `item`**: ul ↔ ol は入れ替わり、両者は同一スタイルが常態。
  self-map だと `:is(.ul, .ol)` が常に必要になる
- **`td`/`th` → `cell`**: セルの共通スタイルが常態。#18 の案では祖先で head/body を分けるので、この共有はより重要になる

全 self-map の根本問題は、契約の第一原則（Semantic）と衝突すること。`.p` `.dd` `.tr` `.h2` は
実装の偶発的詳細（タグの綴り）のコピーであり、そうなると `bare-element-selector` で
素のタグセレクタを禁止している根拠——「クラスは意味を運びタグ変更に耐える」——が消え、
「`> p` でいいじゃないか」に答えられなくなる。

**併せて検討**: `<b>` `<i>` `<u>` `<s>` は純粋に見た目由来で UI 意味を持たない。
上書きではなく `bannedClasses` 側に寄せる（意味的 HTML を推す契約の立場と一貫する）。

### 19. 段階導入の手段がない → **severity を実装**

**当初の症状**: `createNagiEslintConfig` は全ルールを `"error"` 固定、Stylelint も `[true, semantic]` 固定。
CLI に severity 指定が無いため、既存リポジトリに入れると数千件のエラーで採用不能になる。
逃げ道はインライン disable コメントのみ（ただしスキルは対象リポジトリへの設定追加を禁じている）。

**実装**: `severity` をトップレベル設定に追加（`semantic` の外 — 語彙ではなくリンタの設定なので）。

```js
severity: {
  "*": "warn",                    // 全部報告するが落とさない
  "surface-root-name": "error",   // 先に直すものだけ error
  "variant-order": "off",         // 方針として採らないルール
}
```

- 既定は全ルール `error`。`*` がフォールバック
- `warn` は報告するが終了コードを 1 にしない、`off` はルールを外す
- **未知のルール名は設定エラー（exit 2）** — タイプミスで検査が黙って無効化されない

**baseline は見送り**（既存違反をスナップショットして新規のみ落とす方式）。
利点は「全ルール error のまま新規コードを100%守れる」ことだが、
サブコマンド・状態ファイル・結果フィルタが必要で、利用者がまだいない 0.1.0 では過剰。
需要が出てから追加する。

**文書側の整合**: FAQ の「warnings-only setup degrades into consistency by discipline」と
`warn` の提供が矛盾して読めるため、FAQ に「`severity` は既存コードベースへの導入のためにあり、
定常状態は CI で error」と明記した。

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

0. **立ち位置の書き振り** — **文書修正済み**。コンポーネント境界と scoped CSS が既に解いた問題
   （衝突・漏れ・所有の曖昧さ）と、Nagi が固有に足すもの（境界の内側の canonical form、
   機械検証、収束）の切り分けが説明の冒頭に無く、前者を解いているかのように読めた。
   CONTRACT.md Introduction・README「Why」・FAQ 先頭に「契約は境界が止まる場所から始まる」
   という切り分けを明記し、FAQ では立ち位置の質問を最初に移動
   （scoped CSS の旧 Q&A はこれに吸収）。あわせて6原則のうち Deterministic が
   荷重部材であることを Introduction に明記した。

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

## 残り

**23項目すべて着手済み**。当初「派生として未着手」に置いた2件も実装した —
`<b>` `<i>` `<u>` `<s>` の禁止（#23 の派生）と、読めない `:class` 式の報告
（#20 の派生。拒否ではなく `unverifiable-dynamic-class` という警告にした）。

今後の論点として残しているもの:

- 時間（モーション）のトークン化。`transition: 0.2s` もデザイン決定ではあるが、
  第3段の範囲に入れていない
- `length-token-required` の実アプリでの影響。このリポジトリでは測れないので、
  最初の実プロジェクト適用時に `severity` の初期値を決める材料として測る
