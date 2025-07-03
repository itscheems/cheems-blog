---
title: 自定义虚拟网卡 veth 接入 K8s Pod
cover: ./R-C.127ba08cf553e14a8dbf50dee1c2242e.jpg
date: 2024-08-10
# category:
#   - 无
tag: 
  - 后端
  - kubernetes
  - linux

# 摘要
excerpt: <p>目的是观察 Pod 的网络数据包是如何向外部发送的，经过什么网络接口，并抓包监听。</p>
---

# 自定义虚拟网卡 veth 接入 K8s Pod

> 目的是观察 Pod 的网络数据包是如何向外部发送的，经过什么网络接口，并抓包监听

**步骤：**

- 宿主机创建两块虚拟网卡 veth
- 将其中一块虚拟网卡添加到 Pod 中
- 启动 Pod 和 宿主机中的 veth
- 给 Pod 中的虚拟网卡添加 IP
- 宿主机 tcpdump 监听本机新建的虚拟网卡
- Pod 发送 ping 报文，观察报文

> **注意：**
> - K8s Pod 环境并没有支持简易 Linux 系统功能，比如 ifconfig、ip、route、tcpdump、ping 等工具/命令均无法使用。
> - 这部分工作需要在宿主机借助 netns 来访问


</br>

先在宿主机创建一对虚拟网络设备

```
sudo ip link add veth-a type veth peer name veth-b
# 可以在两头都加上 name; 也可以都省略
```

由于是在宿主机创建的，所以在宿主机的网络命名空间里，能看到我们刚创建好的这一对虚拟网络设备

```
cjj@cjj-workspace ~> ip a | grep veth
341: veth-b@veth-a: <BROADCAST,MULTICAST,M-DOWN> mtu 1500 qdisc noop state DOWN group default qlen 1000
342: veth-a@veth-b: <BROADCAST,MULTICAST,M-DOWN> mtu 1500 qdisc noop state DOWN group default qlen 1000
```

我们先看看 `ip netns` 这些 netns 的 id，再挑选一个命名空间，进入后查询 IP

```
chenjunjia@cjj-workspace ~> sudo ip netns exec cni-101ef36d-7d42-beef-4ecc-0b28decf0833 ip a
1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN group default qlen 1000
    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00
    inet 127.0.0.1/8 scope host lo
       valid_lft forever preferred_lft forever
    inet6 ::1/128 scope host
       valid_lft forever preferred_lft forever
9: eth0@if10: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 9000 qdisc noqueue state UP group default
    link/ether 88:66:ac:10:00:03 brd ff:ff:ff:ff:ff:ff link-netnsid 0
    inet 172.16.0.3/24 brd 172.16.0.255 scope global eth0
       valid_lft forever preferred_lft forever
    inet6 fe80::8a66:acff:fe10:3/64 scope link
       valid_lft forever preferred_lft forever
```

查询到了 IP 为 `172.16.0.3`，再看看 Pod 的 IP 信息，这样子就知道这个 netns 是对应哪一个 Pod 的了

```
chenjunjia@cjj-workspace ~> kubectl get pods -o wide
NAME                                     READY   STATUS    RESTARTS        AGE     IP                NODE            NOMINATED NODE   READINESS GATES
mongodb-arbiter-0                        1/1     Running   0               6d20h   172.16.0.3        cjj-workspace   <none>           <none>
```

将虚拟网络设备对其中的一端，接入到某一个 Pod 的网络命名空间当中

```
sudo ip link set veth-b netns <netns_id>
# sudo ip link set veth-b netns cni-101ef36d-7d42-beef-4ecc-0b28decf0833
```

由于将 `veth-b` 这个虚拟网卡设备放入了 Pod 的网络命名空间中，所以再使用 `ip a | grep veth` 时就看不到这个设备了

再进入这个 netns 中看，多了一块虚拟网卡，`veth-b` 已经跑进去了

```
chenjunjia@cjj-workspace ~> sudo ip netns exec cni-101ef36d-7d42-beef-4ecc-0b28decf0833 ip a
1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN group default qlen 1000
    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00
    inet 127.0.0.1/8 scope host lo
       valid_lft forever preferred_lft forever
    inet6 ::1/128 scope host
       valid_lft forever preferred_lft forever
9: eth0@if10: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 9000 qdisc noqueue state UP group default
    link/ether 88:66:ac:10:00:03 brd ff:ff:ff:ff:ff:ff link-netnsid 0
    inet 172.16.0.3/24 brd 172.16.0.255 scope global eth0
       valid_lft forever preferred_lft forever
    inet6 fe80::8a66:acff:fe10:3/64 scope link
       valid_lft forever preferred_lft forever
341: veth-b@if342: <BROADCAST,MULTICAST> mtu 1500 qdisc noop state DOWN group default qlen 1000
    link/ether da:ff:eb:10:57:4d brd ff:ff:ff:ff:ff:ff link-netnsid 0
```

其实也可以进到 Pod 中看，但是我现在这个 mongo-db 容器里面没安装 ip 和 ifconfig 插件，所以只能通过网络命名空间的方式去查看

我们在外面通过网络命名空间给 Pod 的虚拟网卡去设置 IP，然后在外面查看这个虚拟网卡的新 IP

```
sudo ip netns exec cni-101ef36d-7d42-beef-4ecc-0b28decf0833 ip addr add 172.168.0.100/24 dev veth-b
```

给 `veth-a` 也设置一下 IP（不设置也行，看你想 ping 谁）

```
sudo ip addr add 172.168.0.200/24 dev veth-a
```

此时 `veth-b` 已经有 IP 了

```
chenjunjia@cjj-workspace ~> sudo ip netns exec cni-101ef36d-7d42-beef-4ecc-0b28decf0833 ip a
……
……
341: veth-b@if342: <BROADCAST,MULTICAST> mtu 1500 qdisc noop state DOWN group default qlen 1000
    link/ether da:ff:eb:10:57:4d brd ff:ff:ff:ff:ff:ff link-netnsid 0
    inet 172.168.0.100/24 scope global veth-b
       valid_lft forever preferred_lft forever
```

把  `veth-b` 启动起来

```
sudo ip netns exec cni-101ef36d-7d42-beef-4ecc-0b28decf0833 ip link set dev veth-b up

# 显示 <NO-CARRIER,BROADCAST,MULTICAST,UP> 这个状态就是启动起来了

341: veth-b@if342: <NO-CARRIER,BROADCAST,MULTICAST,UP> mtu 1500 qdisc noqueue state LOWERLAYERDOWN group default qlen 1000
    link/ether da:ff:eb:10:57:4d brd ff:ff:ff:ff:ff:ff link-netnsid 0
    inet 172.168.0.100/24 scope global veth-b
       valid_lft forever preferred_lft forever
```

把宿主机的 `veth-a` 也启动起来，显示 `<BROADCAST,MULTICAST,UP,LOWER_UP>` 这个状态也是启动起来了

```
sudo ip link set dev veth-a up

# ip a 输出：
342: veth-a@if341: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc noqueue state UP group default qlen 1000
    link/ether 3a:af:2b:67:d3:75 brd ff:ff:ff:ff:ff:ff link-netns cni-101ef36d-7d42-beef-4ecc-0b28decf0833
    inet6 fe80::38af:2bff:fe67:d375/64 scope link
```

可以先看看 Pod 里面的路由表：

```
sudo ip netns exec cni-101ef36d-7d42-beef-4ecc-0b28decf0833 ip route

# 输出：
chenjunjia@cjj-workspace ~> sudo ip netns exec cni-101ef36d-7d42-beef-4ecc-0b28decf0833 ip route
default via 172.16.0.1 dev eth0
172.16.0.0/24 dev eth0 proto kernel scope link src 172.16.0.3
172.16.0.0/12 dev eth0
172.168.0.0/24 dev veth-b proto kernel scope link src 172.168.0.100
```

因为 Pod 中没有 ping 工具，所以我们继续在宿主机通过 netns 来进行 ping 命令

```
sudo ip netns exec cni-101ef36d-7d42-beef-4ecc-0b28decf0833 ping <目标IP地址或域名>

# ping 一个不属于所有网卡的网段，在宿主机监听 arp
# Pod中：sudo ip netns exec cni-101ef36d-7d42-beef-4ecc-0b28decf0833 ping -c 3 171.168.0.1
```


宿主机监听 `veth-a`。如果在后面不加 arp 或 icmp，那么就是监听流过此网卡的全部报文

```
sudo tcpdump -i veth-a -nn arp
```

Pod 来 ping 一个 `veth-b` 网段内不存在的 IP

```
sudo ip netns exec sudo ip netns exec cni-101ef36d-7d42-beef-4ecc-0b28decf0833  ping -c 3 172.168.0.101
```

结果展示：

```
# Pod 内的 ping 请求
chenjunjia@cjj-workspace ~> sudo ip netns exec cni-101ef36d-7d42-beef-4ecc-0b28decf0833  ping -c 3 172.168.0.101
PING 172.168.0.101 (172.168.0.101) 56(84) bytes of data.
From 172.168.0.100 icmp_seq=1 Destination Host Unreachable
From 172.168.0.100 icmp_seq=2 Destination Host Unreachable
From 172.168.0.100 icmp_seq=3 Destination Host Unreachable

--- 172.168.0.101 ping statistics ---
3 packets transmitted, 0 received, +3 errors, 100% packet loss, time 2049ms
pipe 3

# 宿主机的监听
chenjunjia@cjj-workspace ~> sudo tcpdump -i veth-a -nn arp
tcpdump: verbose output suppressed, use -v or -vv for full protocol decode
listening on veth-a, link-type EN10MB (Ethernet), capture size 262144 bytes
15:50:18.068706 ARP, Request who-has 172.168.0.101 tell 172.168.0.100, length 28
15:50:19.093545 ARP, Request who-has 172.168.0.101 tell 172.168.0.100, length 28
15:50:20.117456 ARP, Request who-has 172.168.0.101 tell 172.168.0.100, length 28
```

```component VPCard
title: chenjjiaa
desc: 沉浸在万花筒的幻术之中吧...
logo: ./github-logo.jpg
link: https://github.com/chenjjiaa
background: rgba(253, 230, 138, 0.15)
```