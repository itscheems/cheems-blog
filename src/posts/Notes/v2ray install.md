---
title: v2ray install
# 背景图片
# cover: ./祢豆子1.jpg

date: 2025-04-01

# 分类（可填多个）
# category:
#   - 计算机基础

#标签（可填多个）
tag: 
  - install

star: false

# 置顶
sticky: false

# 摘要
excerpt: <p> </p>
---

# v2ray install


install Homebrew

```
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

install v2ray

```
brew install v2ray
```

log output:

```
...
...
==> Installing v2ray
==> go build -o=/usr/local/Cellar/v2ray/5.28.0/libexec/v2ray -ldflags=-s -w -buildid= ./main
==> Caveats
To start v2ray now and restart at login:
  brew services start v2ray
Or, if you don't want/need a background service you can just run:
  /usr/local/opt/v2ray/bin/v2ray run -config /usr/local/etc/v2ray/config.json
==> Summary
🍺  /usr/local/Cellar/v2ray/5.28.0: 12 files, 56.9MB, built in 4 minutes 35 seconds
==> Running `brew cleanup v2ray`...
Disable this behaviour by setting HOMEBREW_NO_INSTALL_CLEANUP.
Hide these hints with HOMEBREW_NO_ENV_HINTS (see `man brew`).
==> Caveats
==> v2ray
To start v2ray now and restart at login:
  brew services start v2ray
Or, if you don't want/need a background service you can just run:
  /usr/local/opt/v2ray/bin/v2ray run -config /usr/local/etc/v2ray/config.json
```

