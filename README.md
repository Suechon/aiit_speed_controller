# AIIT Speed Controller
AIIT(産業技術大学院大学)の授業動画の再生速度を変更できる、Chrome拡張機能です。

## 機能
* 0.1～6倍速に対応
* ショートカットキー(↑/↓/0)
  * ↑↓: 0.5ずつ変更
  * 0: 1.0倍速

## 動作環境
* Google Chrome
* Manifest V3 対応ブラウザ

## 適用方法
### 方法1: Chrome拡張機能からDL
  * リンクを知っている人のみ拡張機能インストールページにアクセス可能としてます。
  * Discodeまたはnotionのほうに張り付けてるのでそこからアクセスしてください。
### 方法2: リポジトリをクローンして自身で反映
* このリポジトリ配下の`aiit_speed_controller`を`パッケージ化されてない拡張機能を読み込む`からuploadしてください
* これできる人なら説明いらないと思うので割愛


## 使い方
1. 動画サイトにログインする
2. 見たい授業動画のページを開く
3. 右上のChrome拡張から調整

## 既知の問題
* ページ読み込み直後に動画がまだ `<video>` 化されていない場合、初回実行で反応しないことがあります
  * → 一度再生ボタンを押してから再実行してください
* 一部ブラウザで 2倍以上の速度が反映されない場合があります（ブラウザ・Kaltura側の制限）
* 実行直後に速度反映がわずかに遅れることがあります

## Contribution
* この拡張はまだ開発途中で、改善余地があります。
* ぜひ Issue や Pull Request を通して協力してください 💪

## 備考
この拡張は個人開発のプロジェクトです。
AIIT講義などの学習支援を目的としており、商用配布・課金は行っていません。

## ポリシー
この拡張は ユーザーの個人情報や閲覧データを一切収集しません。
利用者が明示的に操作したページ内で、動画再生速度を変更するための最小限のコードのみ実行します。


## Buy me a Coffee
* コーヒー1杯分から寄付ができるサービスです。気が向いたらお願いいたします。
<a id="bmac" href="https://www.buymeacoffee.com/suechan"><img src="https://img.buymeacoffee.com/button-api/?text=Buy me a coffee💛&emoji=&slug=suechan&button_colour=FFDD00&font_colour=000000&font_family=Arial&outline_colour=000000&coffee_colour=ffffff" /></a>
