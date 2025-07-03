---
# icon: pen-to-square
date: 2024-08-10
# category:
#   - 无
tag: 
  - 后端
  - kubernetes

# 摘要
excerpt: <p>步骤有点繁琐，所以写了个脚本。</p>
---

<!-- more -->

# 通过 pod_id 找到 ip netns 对应的网络命名空间

## 如何拿到 pod 对应的 netns ？

我发现要通过 Pod IP 来获取到该 Pod 对应的 netns 比较麻烦，要通过以下步骤才能拿到

首先拿到 Pod 的 IP（当然这得自己用命令来查）

```
cjj@cjj-workspace ~> kubectl get pods -o wide
NAME                READY    STATUS    RESTARTS        AGE   IP                NODE            NOMINATED NODE   READINESS GATES
kafka-0              1/1     Running   2 (8d ago)      8d    172.16.0.15       cjj-workspace   <none>           <none>
kafka-1              1/1     Running   2 (8d ago)      8d    172.16.0.17       cjj-workspace   <none>           <none>
kafka-2              1/1     Running   2 (8d ago)      8d    172.16.0.19       cjj-workspace   <none>           <none>
```
这个网络命名空间可以通过 ip netns 来获取

```
cjj@cjj-workspace ~ [1]> ip netns
cni-2180b3ea-73e3-5960-40a5-0e5f792f7530 (id: 115)
cni-b33d0d90-b4a5-6345-e0c3-4e8758d982c1 (id: 119)
cni-afe4707f-873e-0aae-b727-c7fb37f375d2 (id: 123)
cni-7b510e34-db96-8826-1f08-df4f12fda1ac (id: 117)
```

然后可以通过 `sudo ip netns exec <netns> ip a`，来获取到该 pod 的 ip，这样子就能对应上了

```
cjj@cjj-workspace ~> sudo ip netns exec cni-4d4ca41b-b10c-6955-6a8a-07f5b039e048 ip a
1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN group default qlen 1000
    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00
    inet 127.0.0.1/8 scope host lo
       valid_lft forever preferred_lft forever
    inet6 ::1/128 scope host
       valid_lft forever preferred_lft forever
249: eth0@if250: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 9000 qdisc noqueue state UP group default
    link/ether 88:66:ac:10:00:7b brd ff:ff:ff:ff:ff:ff link-netnsid 0
    inet 172.16.0.123/24 brd 172.16.0.255 scope global eth0
       valid_lft forever preferred_lft forever
    inet6 fe80::8a66:acff:fe10:7b/64 scope link
       valid_lft forever preferred_lft forever
```

## 写个脚本

> **不会偷懒的码农不是好程序员**

输入：Pod 的 IP（我们可以通过 kubectl get pods -o wide 来获取）

输出：这个 Pod IP 对应的 netns（类似：cni-101ef36d-7d42-beef-4ecc-0b28decf0833）

## 实现

新建 `find_pod_netns.sh` 文件

```
vim find_pod_netns.sh
```
把下面这段 shell 复制到 `find_pod_netns.sh` 文件中

```
#!/bin/bash

# 检查是否提供了Pod IP
if [ -z "$1" ]; then
  echo "Usage: $0 <pod_ip>"
  exit 1
fi

POD_IP=$1

# 获取所有网络命名空间
NETNS_LIST=$(ip netns list | awk '{print $1}')

# 遍历每个网络命名空间
for NETNS in $NETNS_LIST; do
  # 在当前网络命名空间中获取所有IP地址
  IP_ADDRESSES=$(sudo ip netns exec $NETNS ip a | grep 'inet ' | awk '{print $2}' | cut -d'/' -f1)
  
  # 检查是否有IP地址与Pod IP匹配
  for IP in $IP_ADDRESSES; do
    if [ "$IP" == "$POD_IP" ]; then
      echo "Pod IP $POD_IP is in network namespace: $NETNS"
      exit 0
    fi
  done
done

# 如果没有找到匹配的网络命名空间
echo "No matching network namespace found for Pod IP $POD_IP"
exit 1
```

加权限

```
chmod +777 find_pod_netns.sh
```

运行脚本即可：

```
./find_pod_netns.sh <pod_ip>
```

### 一个 ip 可能对应多个 netns，罗列全部 netns

```
vim find_pod_all_netns.sh
```

```
#!/bin/bash

# 检查是否提供了Pod IP
if [ -z "$1" ]; then
  echo "Usage: $0 <pod_ip>"
  exit 1
fi

POD_IP=$1

# 获取所有网络命名空间
NETNS_LIST=$(ip netns list | awk '{print $1}')

# 记录匹配的网络命名空间
MATCHING_NETNS=()

# 遍历每个网络命名空间
for NETNS in $NETNS_LIST; do
  # 在当前网络命名空间中获取所有IP地址
  IP_ADDRESSES=$(sudo ip netns exec $NETNS ip a | grep 'inet ' | awk '{print $2}' | cut -d'/' -f1)
  
  # 检查是否有IP地址与Pod IP匹配
  for IP in $IP_ADDRESSES; do
    if [ "$IP" == "$POD_IP" ]; then
      MATCHING_NETNS+=($NETNS)
    fi
  done
done

# 输出匹配的网络命名空间
if [ ${#MATCHING_NETNS[@]} -eq 0 ]; then
  echo "No matching network namespace found for Pod IP $POD_IP"
else
  echo "Pod IP $POD_IP is in the following network namespaces:"
  for NETNS in "${MATCHING_NETNS[@]}"; do
    echo "$NETNS"
  done
fi
```

```component VPCard
title: chenjjiaa
desc: 沉浸在万花筒的幻术之中吧...
logo: ./github-logo.jpg
link: https://github.com/chenjjiaa
background: rgba(253, 230, 138, 0.15)
```