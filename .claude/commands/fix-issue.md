---
description: 指定したGitHub IssueをGit Worktreeで並行作業し、featureブランチで実装、PRを作成する
argument-hint: <issue番号>
allowed-tools: Bash(git:*), Bash(gh:*), Bash(npm:*), Bash(cd:*)
---

Issue #$ARGUMENTS の対応を行ってください。

1. `gh issue view $ARGUMENTS` でIssueの内容(背景・受け入れ条件)を確認する
2. Issueの内容に基づき、ブランチ名を `feature/issue-$ARGUMENTS-<内容を表す短い英語スラッグ>` とする
3. リポジトリルートの一つ上の階層に `git worktree add ../daily-reporting-system-issue-$ARGUMENTS -b feature/issue-$ARGUMENTS-<スラッグ> main` でworktreeを作成する(mainは最新化してから実行すること)
4. 作成したworktreeディレクトリに移動し、`npm install` を実行する
5. worktree内で受け入れ条件を満たすように実装する
6. 既存のテストを壊さないことを確認しつつ、新規テストケースを追加する
7. `npm run lint` と `npm run typecheck` を実行し、クリーンであることを確認する
8. テストスイートを実行し、全件パスすることを確認する
9. worktree内で変更をコミット・プッシュし、`gh pr create` でPRを作成する(タイトルにIssue番号を含め、本文に対応内容と「Closes #$ARGUMENTS」を記載する)
10. マージはユーザーが確認するため、PR作成後は待機する。worktreeは削除せず残しておく(マージ後にユーザーが `git worktree remove ../daily-reporting-system-issue-$ARGUMENTS` で片付ける)
