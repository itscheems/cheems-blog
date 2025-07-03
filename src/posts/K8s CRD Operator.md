---
title: K8s CRD Operator
# 背景图片
cover: ./755ce8eegy1grlo2ahss2j211i230npd.jpg

date: 2025-04-02

# 分类（可填多个）
# category:
#   - 计算机基础

#标签（可填多个）
tag: 
  - kubernetes

star: true

# 置顶
sticky: true

# 摘要
excerpt: <p>使用 Kubebuilder 创建和部署 Kubernetes CRD Operator，包括项目初始化、API 创建、代码生成、CRD YAML 生成、Docker 镜像构建和资源应用等步骤。</p>
---

# K8s CRD Operator

## Download kubebuilder & Init Project

``` bash
curl -L -o kubebuilder "https://go.kubebuilder.io/dl/latest/$(go env GOOS)/$(go env GOARCH)"

chmod +777 kubebuilder
sudo mv kubebuilder /usr/local/bin/
```

Verify installation:
```
kubebuilder version
```

Create Project

``` bash
mkdir mygame && cd $_

go mod init cjjgame

kubebuilder init --domain cjj.megvii.com
```

## Create API

Before running the command, make sure `go install sigs.k8s.io/controller-tools/cmd/controller-gen@v0.8.0` can be downloaded successfully.

If the download fails, it’s most likely a network issue.

``` bash
kubebuilder create api --group "" --version v1alpha1 --kind CjjGame --force
```

## Code Gen

### clientset, informer and lister
(1) Add doc.go in `api/v1alpha1/...`

``` go
// +k8s:deepcopy-gen=package
// +groupName=cjj.megvii.com

package v1alpha1
```

(2) Add comment in xxx_types.go

``` go
// +genclient
// +k8s:defaulter-gen=true
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
// +genclient:method=Stop,verb=create,subresource=stop
```

Refer to the code below:

``` go
// +genclient
// +k8s:defaulter-gen=true
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
// +genclient:method=Stop,verb=create,subresource=stop

// CjjGame is the Schema for the cjjgames API.
type CjjGame struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	Spec   CjjGameSpec   `json:"spec,omitempty"`
	Status CjjGameStatus `json:"status,omitempty"`
}
```

(3) Add script and run
file path: `./hack/update-codegen.sh`

``` bash
#!/usr/bin/env bash

# file path: ./hack/update-codegen.sh

# If you haven't installed client-gen, lister-gen and informer-gen, 
# you can run the following command:
# GO111MODULE=on go install k8s.io/code-generator/cmd/{defaulter-gen,conversion-gen,client-gen,lister-gen,informer-gen,deepcopy-gen,openapi-gen}@v0.22.13-rc.0

# Permanently effective
# echo 'export PATH=$PATH:$(go env GOPATH)/bin' >> ~/.bashrc
# source ~/.bashrc
export PATH=$PATH:$(go env GOPATH)/bin
GO_MODULE_NAME=$(go list -m)

# Clientset
client-gen \
  --go-header-file "./boilerplate.go.txt" \
  --input-dirs "$GO_MODULE_NAME/api/v1alpha1" \
  --output-package "../pkg/client/clientset" \
  --clientset-name "versioned" \
  --output-base "../"

# Lister
lister-gen \
  --go-header-file "./boilerplate.go.txt" \
  --input-dirs "$GO_MODULE_NAME/api/v1alpha1" \
  --output-package "../pkg/client/listers" \
  --output-base "../"

# Informer
informer-gen \
  --go-header-file "./boilerplate.go.txt" \
  --input-dirs "$GO_MODULE_NAME/api/v1alpha1" \
  --versioned-clientset-package "$GO_MODULE_NAME/pkg/client/clientset/versioned" \
  --listers-package "$GO_MODULE_NAME/pkg/client/listers" \
  --output-package "../pkg/client/informers" \
  --output-base "../"

```

``` bash
chmod +777 update-codegen.sh
```

``` bash
./update-codegen.sh
```

> (1) Add path
> 
> ``` bash
> echo 'export PATH=$PATH:$(go env GOPATH)/bin' >> ~/.bashrc
> source ~/.bashrc
> ```
> 
> (2) Check Go module
> This is your Go module name, and it determines your code package path.
> ``` bash
> go list -m
> ```

Before generating `clientset`, `informer` and `lister`, make sure these dependencies are already installed.

```
cjj@cjj-workspace:~/go$ ll /home/cjj/go/bin/
total 89936
drwxrwxr-x 2 cjj cjj      166 Mar 20 14:58 ./
drwxrwxr-x 5 cjj cjj       39 Mar 20 15:08 ../
-rwxrwxr-x 1 cjj cjj  9781036 Mar 20 15:01 client-gen*
-rwxrwxr-x 1 cjj cjj 22419483 Mar 19 17:10 controller-gen*
-rwxrwxr-x 1 cjj cjj  9546144 Mar 20 15:01 conversion-gen*
-rwxrwxr-x 1 cjj cjj  9075451 Mar 20 15:01 deepcopy-gen*
-rwxrwxr-x 1 cjj cjj  9113305 Mar 20 15:01 defaulter-gen*
-rwxrwxr-x 1 cjj cjj  9607100 Mar 20 15:01 informer-gen*
-rwxrwxr-x 1 cjj cjj  9490651 Mar 20 15:01 lister-gen*
-rwxrwxr-x 1 cjj cjj 13045780 Mar 20 15:01 openapi-gen*
```

### Generate CRD YAML

The file path after CRD yaml generation is `./config/crd/bases/cjj.megvii.com_cjjgames.yaml`

``` bash
export GO111MODULE=on && \
go mod tidy && go mod vendor && \
make manifests
```

## Deploy

### Add or edit file

You can add or edit some files in the `./config/rbac/`

- service_account.yaml
- rolebinding.yaml
- cjjgame_clusterrole.yaml
- clusterrolebinding.yaml

(1) service_account.yaml

``` yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  labels:
    app.kubernetes.io/name: cjjgame
    app.kubernetes.io/managed-by: kustomize
  name: cjjgame-controller-manager
  namespace: system
```

(2) rolebinding.yaml

``` yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  labels:
    app.kubernetes.io/name: mygame
    app.kubernetes.io/managed-by: kustomize
  name: cjjgame-controller-manager-rolebinding
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: cjjgame-controller-manager-role
subjects:
- kind: ServiceAccount
  name: cjjgame-controller-manager
  namespace: system
```

(3) cjjgame_clusterrole.yaml

``` yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: cjjgame-controller-manager-clusterrole
rules:
- apiGroups: ["cjj.megvii.com"]
  resources: ["cjjgames"]
  verbs: ["create", "delete", "get", "list", "patch", "update", "watch"]
- apiGroups: ["coordination.k8s.io"]
  resources: ["leases"]
  verbs: ["*"]
- apiGroups: [""]
  resources: ["pods", "nodes", "events", "namespaces", "volumes", "snapshot", "persistentvolumeclaims", "deletecollection"]
  verbs: ["*"]
```

(4) clusterrolebinding.yaml

``` yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: cjjgame-controller-manager-clusterrolebinding
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: cjjgame-controller-manager-clusterrole
subjects:
- kind: ServiceAccount
  name: cjjgame-controller-manager
  namespace: system
```

### Build docker image

Docker build

``` bash
docker build --progress=plain -t cjjgame .
```

``` bash
docker tag ...

docker push docker-registry-internal.i.brainpp.cn/cjjgame:latest
```

edit `./config/manager/manager.yaml` `image`, `serviceAccountName`, `meta.name`, `control-plane`...

``` yaml
apiVersion: v1
kind: Namespace
metadata:
  labels:
    control-plane: cjjgame-controller-manager
    app.kubernetes.io/name: cjjgame
    app.kubernetes.io/managed-by: kustomize
  name: system
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: cjjgame-controller-manager
  namespace: system
  labels:
    control-plane: cjjgame-controller-manager
    app.kubernetes.io/name: cjjgame
    app.kubernetes.io/managed-by: kustomize
spec:
  selector:
    matchLabels:
      control-plane: cjjgame-controller-manager
      app.kubernetes.io/name: cjjgame
  replicas: 1
  template:
    metadata:
      annotations:
        kubectl.kubernetes.io/default-container: manager
      labels:
        control-plane: cjjgame-controller-manager
        app.kubernetes.io/name: cjjgame
    spec:
      # TODO(user): Uncomment the following code to configure the nodeAffinity expression
      # according to the platforms which are supported by your solution.
      # It is considered best practice to support multiple architectures. You can
      # build your manager image using the makefile target docker-buildx.
      # affinity:
      #   nodeAffinity:
      #     requiredDuringSchedulingIgnoredDuringExecution:
      #       nodeSelectorTerms:
      #         - matchExpressions:
      #           - key: kubernetes.io/arch
      #             operator: In
      #             values:
      #               - amd64
      #               - arm64
      #               - ppc64le
      #               - s390x
      #           - key: kubernetes.io/os
      #             operator: In
      #             values:
      #               - linux
      securityContext:
        # Projects are configured by default to adhere to the "restricted" Pod Security Standards.
        # This ensures that deployments meet the highest security requirements for Kubernetes.
        # For more details, see: https://kubernetes.io/docs/concepts/security/pod-security-standards/#restricted
        runAsNonRoot: true
        seccompProfile:
          type: RuntimeDefault
      containers:
      - command:
        - /manager
        args:
          - --leader-elect
          - --health-probe-bind-address=:8081
        image: docker-registry-internal.i.brainpp.cn/cjjgame:latest
        name: manager
        ports: []
        securityContext:
          allowPrivilegeEscalation: false
          capabilities:
            drop:
            - "ALL"
        livenessProbe:
          httpGet:
            path: /healthz
            port: 8081
          initialDelaySeconds: 15
          periodSeconds: 20
        readinessProbe:
          httpGet:
            path: /readyz
            port: 8081
          initialDelaySeconds: 5
          periodSeconds: 10
        # TODO(user): Configure the resources accordingly based on the project requirements.
        # More info: https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/
        resources:
          limits:
            cpu: 500m
            memory: 128Mi
          requests:
            cpu: 10m
            memory: 64Mi
        volumeMounts: []
      volumes: []
      serviceAccountName: cjjgame-controller-manager
      terminationGracePeriodSeconds: 10

```

### Apply some resources

Create `apply.sh` script in `./hack/`

``` bash
#!/usr/bin/env bash

# file path: ./hack/apply.sh

# apply yaml
kubectl get crd cjjgames.cjj.megvii.com || kubectl apply -f ./config/crd/bases/cjj.megvii.com_cjjgames.yaml
kubectl get sa cjjgame-controller-manager -n system || kubectl apply -f ./config/rbac/service_account.yaml
kubectl get clusterrole cjjgame-controller-manager-clusterrole || kubectl apply -f ./config/rbac/role.yaml
kubectl get clusterrolebinding cjjgame-controller-manager-clusterrolebinding || kubectl apply -f ./config/rbac/role_binding.yaml
kubectl get clusterrole cjjgame-controller-manager-clusterrole || kubectl apply -f ./config/rbac/cjjgame_clusterrole.yaml
kubectl get clusterrolebinding cjjgame-controller-manager-clusterrolebinding || kubectl apply -f ./config/rbac/clusterrolebinding.yaml

kubectl get deployment cjjgame-controller-manager -n system || kubectl apply -f ./config/manager/manager.yaml
```

``` bash
chmod +777 ./apply.sh
```

## Appendix

### Directory structure

```
cjj@cjj-workspace:~/mygame$ tree -I "vendor"

.
├── api
│   └── v1alpha1
│       ├── cjjgame_types.go
│       ├── doc.go
│       ├── groupversion_info.go
│       └── zz_generated.deepcopy.go
├── bin
│   ├── controller-gen -> /home/cjj/mygame/bin/controller-gen-v0.17.0
│   └── controller-gen-v0.17.0
├── cmd
│   └── main.go
├── config
│   ├── crd
│   │   ├── bases
│   │   │   └── cjj.megvii.com_cjjgames.yaml
│   │   ├── kustomization.yaml
│   │   └── kustomizeconfig.yaml
│   ├── default
│   │   ├── cert_metrics_manager_patch.yaml
│   │   ├── kustomization.yaml
│   │   ├── manager_metrics_patch.yaml
│   │   └── metrics_service.yaml
│   ├── manager
│   │   ├── kustomization.yaml
│   │   └── manager.yaml
│   ├── network-policy
│   │   ├── allow-metrics-traffic.yaml
│   │   └── kustomization.yaml
│   ├── prometheus
│   │   ├── kustomization.yaml
│   │   ├── monitor_tls_patch.yaml
│   │   └── monitor.yaml
│   ├── rbac
│   │   ├── cjjgame_admin_role.yaml
│   │   ├── cjjgame_clusterrole.yaml
│   │   ├── cjjgame_editor_role.yaml
│   │   ├── cjjgame_viewer_role.yaml
│   │   ├── clusterrolebinding.yaml
│   │   ├── kustomization.yaml
│   │   ├── leader_election_role_binding.yaml
│   │   ├── leader_election_role.yaml
│   │   ├── metrics_auth_role_binding.yaml
│   │   ├── metrics_auth_role.yaml
│   │   ├── metrics_reader_role.yaml
│   │   ├── role_binding.yaml
│   │   ├── role.yaml
│   │   └── service_account.yaml
│   └── samples
│       ├── kustomization.yaml
│       └── v1alpha1_cjjgame.yaml
├── Dockerfile
├── go.mod
├── go.sum
├── hack
│   ├── apply.sh
│   ├── boilerplate.go.txt
│   └── update-codegen.sh
├── internal
│   └── controller
│       ├── cjjgame_controller.go
│       ├── cjjgame_controller_test.go
│       └── suite_test.go
├── Makefile
├── pkg
│   └── client
│       ├── clientset
│       │   └── versioned
│       │       ├── clientset.go
│       │       ├── doc.go
│       │       ├── fake
│       │       │   ├── clientset_generated.go
│       │       │   ├── doc.go
│       │       │   └── register.go
│       │       └── scheme
│       │           ├── doc.go
│       │           └── register.go
│       ├── informers
│       │   └── externalversions
│       │       ├── core
│       │       │   ├── interface.go
│       │       │   └── v1alpha1
│       │       │       ├── cjjgame.go
│       │       │       └── interface.go
│       │       ├── factory.go
│       │       ├── generic.go
│       │       └── internalinterfaces
│       │           └── factory_interfaces.go
│       └── listers
│           └── core
│               └── v1alpha1
│                   ├── cjjgame.go
│                   └── expansion_generated.go
├── PROJECT
├── README.md
└── test
    ├── e2e
    │   ├── e2e_suite_test.go
    │   └── e2e_test.go
    └── utils
        └── utils.go
```
