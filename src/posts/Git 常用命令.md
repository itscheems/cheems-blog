---
title: Git 常用命令
# 背景图片
# cover: ./祢豆子1.jpg

date: 2025-04-01

# 分类（可填多个）
# category:
#   - 计算机基础

#标签（可填多个）
tag:
  - Git

star: false

# 置顶
sticky: false

# 摘要
excerpt: <p>一些常用命令</p>
---

```git
------------------
新建分支，并切换过去：
git checkout -b <分支名>

创建本地分支并拉取远程指定分支代码
git checkout -b <本地分支名> origin/<远程分支名>

恢复到编辑之前：
git checkout -- .

设置上游分支（如果远端没有该分支，则失败）：
git branch --set-upstream-to=origin/<远程分支> <本地分支>

查看当前分支的上游分支：
git branch -vv

取消跟踪上游分支：
git branch --unset-upstream

将本地新建的分支推向远端仓库，远端仓库则会多出本地这条新分支：
git push -u origin <分支名>

切换分支如果 push 不上去，需要你 pull 再 push，那就 -f
git push -f

指定远程分支的名称（如果需要），如果想推送到远程不同的分支名，可以指定远程分支名：
git push origin <local_branch_name>:<remote_branch_name>

将远端分支信息更新到本地：
git fetch --all

清除本地已经失效的远程分支引用（那些远程已经删除但本地还保留的分支）：
git fetch --prune

A分支变基 rebase 到 B分支
git pull origin <分支名> --rebase

------------------
移除暂存区所有文件：
git reset .

撤销本次 commit（未提交到远程仓库）：
git reset --soft HEAD^
git reset --soft HEAD~1
git reset --soft HEAD@{1}
把分支重置到某个具体提交中，并保留变更信息：
git reset --soft <commit_hash>

将提交的更改 撤销到暂存区：
git reset --mixed HEAD^

把当前分支的所有内容都重置为目标分支的状态：
未提交的更改（工作区中的修改）和暂存区的内容都会被清除，谨慎使用
git reset --hard <分支名>
git reset --hard origin/<分支名>

------------------
删本地分支（删分支之前记得先 checkout 到别的分支，否则会失败）
git branch -d <branch_name>
强制删：git branch -D <branch_name>

删远程分支
git push origin --delete <branch_name>
```

## 如何将一个新文件夹推送到 git 仓库？

```git
cd /path/to/your/folder
git init

# git remote add origin your-repository-addr(ssh/https)
git remote add origin git@git-core.megvii-inc.com:zhangsan/DiyGames.git

git add .
git commit -m "Initial commit"

git push -u origin master
```

## git init...

```bash
# 设置 git 用户名和邮箱
git config --global user.email "you@example.com"
git config --global user.name "Your Name"

# 显示当前邮箱
git config user.email
git config user.name
```

远程提交和本地提交不一样，可以用这个，记得解决冲突

```bash
git pull origin master --allow-unrelated-histories
```

## 如何保持空目录的目录结构？

git 默认是不会追踪空文件夹的。因为 Git 只跟踪文件，不跟踪空目录，所以如果一个目录里什么都没有，它就不会被加进版本控制
`.gitkeep` 不是 Git 的官方文件名，它只是一个社区约定俗成的方式，你可以叫它任何名字，比如 `.keep`、`README.md` 都行
自动在空文件夹里加 `.gitkeep`

```bash
find . -type d -empty -exec touch {}/.gitkeep \;
```

删除非空目录中的 `.gitkeep` 文件

```bash
find . -name ".gitkeep" -exec bash -c 'dir=$(dirname "{}"); count=$(find "$dir" -type f | wc -l); [ "$count" -gt 1 ] && rm "{}"' \;
```

## git log

1、git log 带颜色的格式化输出：

```bash
git log --pretty=format:"%C(yellow)%h%Creset %C(cyan)%ad%Creset | %s %C(green)%d%Creset" --date=short
```

2、对于有不同分支、合并的提交历史，可以采用基本图形化查看（ASCII 图形）

- --oneline：每个提交显示为一行
- --graph：显示 ASCII 图形表示提交历史
- --all：显示所有分支（而不只是当前分支）
- --decorate：显示分支名、tag 等引用

```bash
git log --oneline --graph --all --decorate
```

还可以仅显示最近 N 个提交

```bash
git log --oneline --graph --all --decorate -10
```

## git tag

> - 标签命名规范：语义化版本（SemVer）​​：v<主版本>.<次版本>.<修订号>
>   - ​​v1.0.0​​（正式发布）
>   - v1.1.0-beta​​（Beta 测试版）
>   - v2.0.0-rc.1​​（候选发布版）
> - tag 代表正式版本，​​ 不可变 ​​，长期保留。
>   - 比如说这个分支，release/<版本号>​​，这种分支适用于 ​​ 即将发布的版本 ​​，用于测试和修复问题。通过测试并且发布完成后，​​ 合并到 main 并打 tag v1.0.0​​

1、查

```bash
git tag             # 列出本地所有 tag
git show v1.0       # 查看某个 tag 的详细信息
git show-ref --tags # 查看 tag 对应的 commit

git ls-remote --tags origin # 列出远程 tag​
```

2、创建

```bash
git tag v1.0                              # 在当前 commit 打 tag（轻量标签）
git tag -a v1.0 -m "Release version 1.0"  # 带注释的 tag（推荐）
git tag v1.0 abc1234                      # 对特定 commit (abc1234) 打 tag
```

3、删

```bash
git tag -d v1.0         # 删除本地 tag

git push origin --delete v1.0   # 删除远程 tag（Git >=1.7.0）
git push origin :refs/tags/v1.0 # 旧版 Git 的删除方式
```

4、修改 tag 指向的 commit​

```bash
git tag -f v1.0           # 强制修改当前 tag 指向最新 commit
git tag -f v1.0 abc1234   # 强制修改 tag 指向指定 commit
```

5、推送 tag

git push 默认不会推送 tag​ <br>
必须显式使用 git push --tags 或 git push origin `<your-tag-name>`

```bash
git push --tags       # 推送所有 tag
git push origin v1.0  # 推送某个 tag
```

其他操作

```bash
git diff v1.0 v2.0    # 比较两个 tag 的差异​
```
