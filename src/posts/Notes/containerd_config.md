---
title: k8s添加镜像仓库域名映射

date: 2025-10-29

star: false

sticky: false

excerpt: <p></p>
---

# k8s 添加镜像仓库域名映射

有时 k8s 集群并不能识别你所设置的镜像仓库域名地址 `docker-registry-internal.i.brainppcn`，这时就需要修改一下 containerd 的配置

## 修改 containerd 配置

`sudo vi /etc/containerd/config.toml`

```toml
    [plugins."io.containerd.grpc.v1.cri".registry]
      [plugins."io.containerd.grpc.v1.cri".registry.mirrors]
        [plugins."io.containerd.grpc.v1.cri".registry.mirrors."docker.io"]
          endpoint = ["https://docker.mirrors.ustc.edu.cn", "http://hub-mirror.c.163.com"]
        [plugins."io.containerd.grpc.v1.cri".registry.mirrors."private-registry.brainpp.cn"]
          endpoint = ["http://10.172.198.79:5000"]
        [plugins."io.containerd.grpc.v1.cri".registry.mirrors."docker-registry-internal.i.brainpp.cn"]
          endpoint = ["http://10.172.198.79:5000"]
        [plugins."io.containerd.grpc.v1.cri".registry.mirrors."docker-registry-internal.i.brainpp.cn:5000"]
          endpoint = ["http://10.172.198.79:5000"]

      [plugins."io.containerd.grpc.v1.cri".registry.configs]
        [plugins."io.containerd.grpc.v1.cri".registry.configs."registry.bootstrap.kubebrain.com"]
          [plugins."io.containerd.grpc.v1.cri".registry.configs."registry.bootstrap.kubebrain.com".tls]
            insecure_skip_verify = true
```

完事记得重启 containerd

```bash
sudo systemctl restart containerd
```

```bash
sudo systemctl status containerd | head -n 3
```

## 修改 coredns

设置完成之后，假设你启动的 deployment 里的业务代码也需要依靠这个地址做业务逻辑处理，则需要再配置 coredns

```bash
kubectl -n kube-system edit configmap coredns
```

在 hosts 列添加上本地网卡 ip 对镜像仓库域名的映射

```
        hosts {
           10.68.100.153 bootstrap.aiservice.com
           10.68.100.153 authing.bootstrap.aiservice.com
           10.68.100.153 ossproxy.bootstrap.aiservice.com
           10.68.100.153 admin.bootstrap.aiservice.com
           10.172.198.79 docker-registry-internal.i.brainpp.cn
           fallthrough
        }
```

完事之后重启 coredns

```bash
kubectl -n kube-system rollout restart deployment/coredns
```
