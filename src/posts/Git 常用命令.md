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

``` git
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

``` git
cd /path/to/your/folder
git init
 
# git remote add origin your-repository-addr(ssh/https)
git remote add origin git@git-core.megvii-inc.com:zhangsan/DiyGames.git
 
git add .
git commit -m "Initial commit"
 
git push -u origin master
```
