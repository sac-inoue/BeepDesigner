# **ESP32 ビープ音デザインWebアプリ 要求仕様書**

## **1\. プロジェクト概要**

本アプリケーションは、ESP32などの組み込み機器で圧電スピーカ（サウンダ）を使用して鳴らす「ビープ音（単音）」を、Webブラウザ上で直感的にデザイン（作曲）できるツールである。  
DTMのピアノロールのようなUIを提供し、作成したメロディやリズムを即座にC言語の配列データとしてエクスポートできることを最大の特徴とする。

## **2\. ターゲットユーザー**

* 組み込みエンジニア  
* IoTデバイスや電子工作のプロトタイピングを行う開発者  
* ハードウェアの「通知音」「操作音」「エラー音」などをデザインしたいUI/UXデザイナー

## **3\. 主要機能要件**

### **3.1 ピアノロール・エディタ機能**

* **X軸（時間軸）:** \* 1秒間を「1小節」と定義し、**全体の長さを1秒〜最大5秒の間で指定・変更可能**とする。  
  * グリッド（スナップ）機能を提供し、16分音符（62.5ms）単位でノート（音符）を配置可能にする。  
* **Y軸（音高軸）:**  
  * 圧電スピーカの特性（最大音量）を考慮し、\*\*4000Hzを「C4（基準音）」\*\*とする独自のスケールを採用する。  
  * 12平均律を用いて各音階の周波数を計算する（例: ![][image1]）。  
  * UI上は「C4」「D4」などの音名で表示しつつ、マウスホバー等で実際の出力周波数（Hz）を確認可能にする。  
* **ノート操作（PC・モバイル対応）:**  
  * 【PC】クリックおよび**ドラッグ操作での連続的なノートの配置・消去**を行う。  
  * 【モバイル】タッチデバイスにおけるタップおよび**スワイプ操作での連続的なノートの配置・消去**に対応し、画面の誤スクロールを防止する。  
  * **単音制約:** 同じ時間軸上に複数のノートが存在できない（和音不可）仕様とする。同じ列に別の音を配置した場合は上書きする。  
  * **休符の扱い:** ノートが配置されていない空白期間は、自動的に「休符（周波数0）」として解釈する。

### **3.2 プレビュー（試聴）機能**

* Web Audio APIを使用し、ブラウザ上でデザインしたビープ音を再生する。  
* 圧電スピーカの音色をシミュレートするため、オシレーターの波形は square（矩形波）固定とする。  
* **配置時の確認音:** エディタ上でノートを配置した瞬間に、その音高の単音を短く（100ms程度）再生し、音の確認を容易にする。

### **3.3 プロジェクト管理とデータ保存機能**

* 複数のビープ音データ（例：「起動音」「エラー音」）を1つの「プロジェクト」として管理できる。  
* **完全クライアントサイド駆動（サーバー保存なし）:**  
  * セキュリティと手軽さを重視し、**サーバー側（バックエンドやデータベース）にはユーザーの作成データやプロジェクトデータを一切保存しない仕様**とする。すべての処理はユーザーのブラウザ内で完結する。  
* **ローカル保存機能（ブラウザ内）:**  
  * 作業中の状態をブラウザのLocal Storage等に自動または手動で保存し、リロード後も再開可能にする。  
* **ファイル入出力（インポート/エクスポート）:**  
  * プロジェクト全体をJSONファイルとしてダウンロード（エクスポート）できる。  
  * ダウンロードしたJSONファイルを読み込み（インポート）、編集を再開できる。

### **3.4 C言語コード自動生成機能（キラー機能）**

* デザインしたビープ音のシーケンスを、連続する同じ音高のノートを自動的に結合した上で、ESP32等のC言語プログラムに直接組み込める形式（配列）でリアルタイムに自動生成し、画面上に表示する。  
* **出力形式の例:**  
  // 形式: { 周波数(Hz), 長さ(ms) } ※周波数0は休符  
  const uint32\_t beep\_custom\[\]\[2\] \= {  
      {4000, 125}, // C4 (8分音符相当)  
      {0,     62}, // 休符 (16分休符相当)  
      {4490, 125}, // D4 (8分音符相当)  
      {0, 0}       // 終端マーク  
  };

* ワンクリックでクリップボードへコピーする機能を提供する。

### **3.5 音声ファイル（WAV）エクスポート機能**

* デザインしたビープ音を、一般的な音声ファイル形式であるWAVE（.wav）形式としてダウンロードできる。  
* Web Audio APIの OfflineAudioContext を用いて、ブラウザ内で音声波形をレンダリングし、ファイル生成を行う（サーバー通信不要）。

## **4\. UI/UX 要件（画面構成）**

レスポンシブデザインを採用し、PCとモバイルの両方で快適に操作できるようにする。

1. **全体コントロール部（ヘッダー）:**  
   * 再生（Play）・停止（Stop）コントロール。  
   * 全体の長さ（秒数）の選択プルダウン。  
   * グリッドのクリア（全消去）ボタン。  
2. **画面構成（PC向け: 3ペイン構成）:**  
   * **左ペイン:** プロジェクト名の表示・編集、ビープ音リスト（新規作成、複製、削除）。*(※現状のプロトタイプでは未実装)*  
   * **中央ペイン:** ピアノロールUI（再生プログレスバー付き）。  
   * **右/下ペイン:** リアルタイムC言語コードプレビュー、コピーボタン、WAVダウンロードボタン。  
3. **画面構成（モバイル向け: タブ/ドロワー構成）:**  
   * 画面幅が狭いスマートフォン等では、上記のペインを同時に表示せず、必要に応じて画面の折りたたみやスクロール領域を最適化し、編集領域を最大限確保する。  
   * 誤タッチを防ぐため、ボタンや操作領域（タッチターゲット）のサイズを十分に確保する。

## **5\. データ構造（JSONフォーマット定義案）**

{  
  "projectName": "String",       // プロジェクト名  
  "version": "1.0",              // ファイルフォーマットのバージョン  
  "beeps": \[                     // ビープ音の配列  
    {  
      "id": "String",            // 一意のID (UUID等)  
      "name": "String",          // ビープ音の名称 (例: "startup\_sound")  
      "durationSec": "Number",   // 全体の長さ (秒)  
      "notes": \[                 // ノート(音符)の配列  
        {   
          "freq": "Number",      // 周波数 (Hz)  
          "durationMs": "Number",// 長さ (ミリ秒)  
          "startMs": "Number"    // 開始位置 (ミリ秒)  
        }  
      \]  
    }  
  \]  
}

## **6\. 技術スタック**

* **アーキテクチャ:** データベースを持たない完全なSPA (Single Page Application)。静的ファイルの配信のみ行う。  
* **フロントエンド・フレームワーク:** React  
* **言語:** TypeScript (プロトタイプは便宜上JSX/JSで実装)  
* **CSSフレームワーク:** Tailwind CSS  
* **ビルドツール:** Vite  
* **ホスティング環境:** Railway (GitHub連携による静的サイトの自動デプロイを想定)  
* **オーディオ:** Web Audio API (ブラウザ標準)

## **7\. 今後の拡張性（オプション）**

* テンポ（BPM）設定の導入。  
* C言語の出力フォーマットのカスタマイズ（例：構造体定義の変更、マクロ出力など）。  
* 複数パターンの保存機能・ローカルストレージ連携の実装。

[image1]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIsAAAAZCAYAAAABt923AAAEHElEQVR4Xu2ZW+hNWRzHf+63TCIh9H8YDzMRcgklKcolBtO4NYN/SDwolxLixe0BDyhJmNFMk8itKYTwIJK73FLy4sElt8gluf2+Z60153d+Z+1z1jmci/7rU9/O+n3X3uusvc9v7/3b6xBF6gq/aSMS8bFYxS1YL5QH9rE+s+6yGqi+SB3hgWhvZvUjkxSSE6I9nbL789KBzOCNdUfku6Ehq5fy6lF2MiA+p+KWIs5Jf9Yn1h+UPXAlqKHkeSxnvWS9Yc1QfQ7ceo+RGeMCmRPmI2SscuDm+pzMla45yrrOGsnay3pPJjE0u7VB/mSR1Kfc/Vlg4/X2s6AdS0TSPG6xjov4BuuMiEFHMvs2s3EbG+OkSELGKgeYWyPbnmzjx+lu2mo/4be17T9ZC21bckoblD9Z7lH6O4LAYD9rs0LgKntN2Qf4g8cD8FqJGPvqK+wi652IQ8cqNUdYB5V3iMw8fhFeFzLH5fjAai9iUEPmuDS5kmUqa4M2czGRkgcrN53InLwnlD2nqx4PwNuu4gkiBkut7wgdK4m52lD00UYC+NHxnfJVt6v1HgnvX9YyEfvmflsblqRk6cGabduoU5uIvix+JPMMRKGDwUazhmdsUX7cQfmSBbH2gPQH2fbAdHeKadZvbeOQsXIxn7VLm5Zx5H8c+MAj82/lDSYzh0vCQ+weVWNZV8j8fs3/3yL5DuFLFpyH/axa1kzW4YxeD2NYC8gMhOIW7XkZW5QXvPd3tu1ikwXzR1u/EYy3Pl4jQchY+VjCOqC8X1mnlVcoKGYxh27CQ0HrwJoIivJVwsNF7wP7PSNzPlE8r7S+O06pILAhKuxQ8Nj6J0G4Snay/mLtIHNL35jaKzcoQk+KuNhkWWHb3dPdKXC1w//dxiFjhYDHm6s5kChfWyAjEfD9eIMrhFfaKBWY3Chtlhn9AxWbLLNsu2e6OwVqAvhDbBwyVihImLOUuW5RLG8p8/ETSq02SkFfKvzkfGvw2vaT8opNFlezDEh3p5hifdQIIGSsULA+c4cCnvt5uMnao80AXJFacrZQ4SdnKGttAZLPVh94fcRzXsr9aGi7txPcan1zhefeBFDRI873NhQyVghIFMwR4Ef7T/QVAsqA1cq7r+KKg5VL30mrNL4rHAmgPQCvt4o3iRjgqpf7ho6VC6y0ukRxIGH0ukk+FrHmKK8dmb9eqgqcHFTf1YYvWQA8edtdZz2JvosAxChAtZdvrCRQKMvVXwnqptAXBtRQ7li1hontqgJMyhV91cBl1kMyt2AIbflmgCV8zPk86xqZVVnf/z5YA/loP7G9b0kgdCwfa7ShGKGNBHSCSOm/JyqKWymMRBJBgmBRZxvrqeqLRDJAskyyn01VXySSAf5dxtJ6zj+OIpFIJBKJRCKRaucLK8BI4Kfw+PwAAAAASUVORK5CYII=>