---
title: 同一个 Node 下，Pod 间通信
# 背景图片
# cover: ./祢豆子1.jpg

date: 2024-08-12

# 分类（可填多个）
# category:
#   - 计算机基础

#标签（可填多个）
tag: 
  - 后端
  - kubernetes

star: true

# 置顶
sticky: false

# 摘要
excerpt: <p>Pod 间进行通信依赖于两个主要的设备，一个是虚拟网络设备（成对存在）。虚拟网络设备的一端接在 Pod 的网络命名空间中，他的另一端是接在宿主机的网络命名空间中（这是一个全局的网络命名空间）。</p>
---

# 同一个 Node 下，Pod 间通信

Pod 间进行通信依赖于两个主要的设备，一个是虚拟网络设备（成对存在）。虚拟网络设备的一端接在 Pod 的网络命名空间中，他的另一端是接在宿主机的网络命名空间中（这是一个全局的网络命名空间）。
然后宿主机的命名空间又包含有 `cni0` 这个网桥设备，然后这个网桥会将报文发送到另一端的与他相连的另一个 Pod 的虚拟网络设备的一端，从而通过这个虚拟网络设备将数据发送到另一个 Pod 当中

pod1 -> pod1's eth0 -> node's veth0 -> node's cni0 -> node's veth1 -> pod2's eth0 -> pod2

怎么验证这些虚拟网络设备是和 `cni0` 连接在一起的呢？

```
brctl show
```

而这些虚拟网络设备是连接到当前 Node 的网络命名空间的

查看当前 K8s Node 上有多少个网络命名空间？

```
ip netns list

# 输出：
root@cjj-workspace ～> ip netns
cni-2180b3ea-73e3-5960-40a5-0e5f792f7530 (id: 115)
cni-b33d0d90-b4a5-6345-e0c3-4e8758d982c1 (id: 119)
cni-afe4707f-873e-0aae-b727-c7fb37f375d2 (id: 123)
```

如何知道某个 Pod 是在哪一个网络命名空间中的?

```
# 先拿到 ip，也就是说这个 ip 必然会在 ip nets list 中的某一个或多个网络命名空间中
kubectl get pods -o wide

# 怎么知道哪个网络命名空间有这个 ip 呢？将这些命名空间一个一个去试！
# 查看某命名空间下的网络设备，查看 eth0 的 ip。eth0 是这个 Pod 对外的接口（虚拟网络设备的另一端）
sudo ip netns exec <网络命名空间id> ip a
```

一些指令：

```
查看宿主机的网络设备：
ip a

有多少个网络命名空间：
ip nets list

如何看到pod的ip是在哪个命名空间下呢？
kubectl get pods

首先得知道 pod 的 ip
kubectl get pods -o wide

其次要知道网络命名空间的详情，看看 eth0 是不是与该 pod 的 ip 对应
sudo ip netns exec <net_namespace> ip a
```


ps：kubectl 等命令可以设置别名：`alias k='kubectl'`。kubectl 等命令，可以简化为自定义别名

## 验证数据传输

验证报文是沿着 Pod A  eth0 -> 宿主机 vethxxx -> cni0 -> 宿主机 vethyyy -> Pod B eth0 这条路径传输

- 先在 Node 宿主机上监听 veth 或 cni0 这些网络设备（因为 Pod A 给 Pod B 传输报文必定会经过这几个网络接口）
- 再启动另一个窗口，进入 Pod A，然后向 Pod B 的 ip 来 ping 一下

在宿主机监听网络设备

```
sudo tcpdump -i <net_interface_name> -nn icmp

# 捕获端口为 80 的 HTTP 流量
sudo tcpdump -i <net_interface_name> -nn tcp port 80
```

在 Pod A 中向 Pod B 发起 ping 请求

```
kubectl exec -it <pod_a_name> -- bash

# 向目标 ip 发送三次 ping 请求即可
ping -c 3 <destination_ip>
```

```component VPCard
title: chenjjiaa
desc: 沉浸在万花筒的幻术之中吧...
logo: ./github-logo.jpg
link: https://github.com/chenjjiaa
background: rgba(253, 230, 138, 0.15)
```