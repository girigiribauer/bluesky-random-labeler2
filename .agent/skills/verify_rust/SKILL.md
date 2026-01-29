---
name: Verify Rust Project
description: Enforce strict verification (compile check & tests) for any Rust code changes.
---

# 前提条件 (Description)
このプロジェクトでRustのコードを変更する際は、必ずコンパイルチェックと全テストの通過を確認してください。

# 指示 (Instructions)

あなたがこのプロジェクト内の Rust コード (`.rs` ファイル) や `Cargo.toml` を変更・修正する場合、ユーザーに完了報告をする前に、**必ず** 以下の検証スクリプトを実行してください。

## 検証手順 (Verification Steps)

1.  **検証スクリプトの実行**:
    プロジェクトルートで以下のコマンドを実行します。
    ```bash
    chmod +x .agent/skills/verify_rust/scripts/verify.sh
    ./.agent/skills/verify_rust/scripts/verify.sh
    ```

2.  **失敗時の対応**:
    - スクリプトが失敗した場合（終了コードが非0）、ユーザーに報告してはいけません。
    - エラー内容を分析し、コードを修正してください。
    - スクリプトが成功するまで、修正と実行を繰り返してください。

3.  **成功報告**:
    - `✅ [Skill] Verification Complete` というログを確認してから、ユーザーに報告してください。
    - 「verify_rust スキルで検証済み」と一言添えてください。

## 適用範囲 (Scope)
このスキルは以下の場合に適用されます：
- 新機能の追加・修正
- リファクタリング
- バグ修正
- 設定変更 (`Cargo.toml` など)
