---
title: Linux 挂载新磁盘扩容

date: 2025-05-04

category: 
  - linux

tag: 
  - linux

star: true

sticky: false

excerpt: <p>我给 Ubuntu 添加了一块 8G 的硬盘，但新添加的硬盘还不能直接使用，还需要将硬盘进行初始化操作。初始化操作通常包含以下步骤</p>
---

我给 Ubuntu 添加了一块 8G 的硬盘，但新添加的硬盘还不能直接使用，还需要将硬盘进行初始化操作。初始化操作通常包含以下步骤

## 确认新设备存在

``` bash
sudo lsblk
```

观察发现，`nvme0n2` 就是我新添加的 8G 的盘

output:
```txt
jojo@jojo-server:~$ sudo lsblk
NAME                      MAJ:MIN RM   SIZE RO TYPE MOUNTPOINTS
loop0                       7:0    0  55.4M  1 loop /snap/aws-cli/1424
loop1                       7:1    0  48.8M  1 loop /snap/core18/2857
loop2                       7:2    0  55.5M  1 loop /snap/aws-cli/1430
loop3                       7:3    0  59.5M  1 loop /snap/core20/2503
loop4                       7:4    0  68.9M  1 loop /snap/core22/1912
loop5                       7:5    0  68.9M  1 loop /snap/core22/1966
loop6                       7:6    0 115.8M  1 loop /snap/docker/3065
loop7                       7:7    0  17.8M  1 loop /snap/etcd/228
loop8                       7:8    0  70.3M  1 loop /snap/kata-containers/2048
loop9                       7:9    0  44.3M  1 loop /snap/snapd/24509
loop10                      7:10   0  21.9M  1 loop /snap/keepalived/3057
loop11                      7:11   0  38.7M  1 loop /snap/snapd/23772
sr0                        11:0    1   2.7G  0 rom
nvme0n1                   259:0    0    70G  0 disk
├─nvme0n1p1               259:1    0     1G  0 part /boot/efi
├─nvme0n1p2               259:2    0     2G  0 part /boot
└─nvme0n1p3               259:3    0  66.9G  0 part
  └─ubuntu--vg-ubuntu--lv 252:0    0  33.5G  0 lvm  /
nvme0n2                   259:4    0     8G  0 disk
```

并且能在 `/dev` 下能看见这个驱动，通过输出可以看见 `nvme0n2` 设备
```txt
jojo@jojo-server:~$ ll /dev | grep nvme0n
brw-rw----   1 root disk    259,   0 May  4 16:25 nvme0n1
brw-rw----   1 root disk    259,   1 May  4 16:25 nvme0n1p1
brw-rw----   1 root disk    259,   2 May  4 16:25 nvme0n1p2
brw-rw----   1 root disk    259,   3 May  4 16:25 nvme0n1p3
brw-rw----   1 root disk    259,   4 May  4 16:25 nvme0n2
```

## 分区 - 针对 2TB 以内的硬盘 (MBR分区)

使用 fdisk 工具来分区
```bash
sudo fdisk /dev/nvme0n2
```

进入 fdisk 工具会显示如下界面，键盘按下 "m" 键回车，查看帮助
```txt
jojo@jojo-server:~$ sudo fdisk /dev/nvme0n2

Welcome to fdisk (util-linux 2.39.3).
Changes will remain in memory only, until you decide to write them.
Be careful before using the write command.

Device does not contain a recognized partition table.
Created a new DOS (MBR) disklabel with disk identifier 0x63381d6a.

Command (m for help):
```

在 Generic 部分，按下 "n" 键回车，创建新分区
```txt
  Generic
   d   delete a partition
   F   list free unpartitioned space
   l   list known partition types
   n   add a new partition
   p   print the partition table
   t   change a partition type
   v   verify the partition table
   i   print information about a partition
```

选择分区类型，主分区，默认也是主分区，所以按 "p"，或直接回车。
```txt
Command (m for help): n
Partition type
   p   primary (0 primary, 0 extended, 4 free)
   e   extended (container for logical partitions)
Select (default p):
```

- 设置分区号，默认 1
- 设置扇区起始位置，直接回车（2048）
- 设置扇区范围，直接回车（2048-16777215, default 16777215）
设置完毕，回到了起始位置
```txt
Command (m for help): n
Partition type
   p   primary (0 primary, 0 extended, 4 free)
   e   extended (container for logical partitions)
Select (default p): p
Partition number (1-4, default 1): 1
First sector (2048-16777215, default 2048):
Last sector, +/-sectors or +/-size{K,M,G,T,P} (2048-16777215, default 16777215):

Created a new partition 1 of type 'Linux' and of size 8 GiB.

Command (m for help):
```

按下 "w" 回车，保存并退出
```txt
  Save & Exit
   w   write table to disk and exit
   q   quit without saving changes
```

```txt
Command (m for help): w
The partition table has been altered.
Calling ioctl() to re-read partition table.
Syncing disks.

jojo@jojo-server:~$
```


## 分区 - 针对＞2TB的硬盘 (GPT分区)

TODO

## 格式化分区

分区完成的状态
```txt
jojo@jojo-server:~$ sudo lsblk
NAME                      MAJ:MIN RM   SIZE RO TYPE MOUNTPOINTS
loop0                       7:0    0  55.4M  1 loop /snap/aws-cli/1424
loop1                       7:1    0  48.8M  1 loop /snap/core18/2857
loop2                       7:2    0  55.5M  1 loop /snap/aws-cli/1430
loop3                       7:3    0  59.5M  1 loop /snap/core20/2503
loop4                       7:4    0  68.9M  1 loop /snap/core22/1912
loop5                       7:5    0  68.9M  1 loop /snap/core22/1966
loop6                       7:6    0 115.8M  1 loop /snap/docker/3065
loop7                       7:7    0  17.8M  1 loop /snap/etcd/228
loop8                       7:8    0  70.3M  1 loop /snap/kata-containers/2048
loop9                       7:9    0  44.3M  1 loop /snap/snapd/24509
loop10                      7:10   0  21.9M  1 loop /snap/keepalived/3057
loop11                      7:11   0  38.7M  1 loop /snap/snapd/23772
sr0                        11:0    1   2.7G  0 rom
nvme0n1                   259:0    0    70G  0 disk
├─nvme0n1p1               259:1    0     1G  0 part /boot/efi
├─nvme0n1p2               259:2    0     2G  0 part /boot
└─nvme0n1p3               259:3    0  66.9G  0 part
  └─ubuntu--vg-ubuntu--lv 252:0    0  33.5G  0 lvm  /
nvme0n2                   259:4    0     8G  0 disk
└─nvme0n2p1               259:6    0     8G  0 part
```

 我们还得**对分区**进行格式化操作，将硬盘格式化成 ext4 文件系统
 >注意：是对分区进行格式化，而不是对整块磁盘设备格式化，对磁盘格式化会覆盖分区表，导致分区信息丢失
```bash
sudo mkfs.ext4 /dev/nvme0n2p1
```

分区 UUID：9d763068-69d8-43f5-a334-87b289d0de9d
```txt
jojo@jojo-server:/$ sudo mkfs.ext4 /dev/nvme0n2p1
mke2fs 1.47.0 (5-Feb-2023)
Creating filesystem with 2096896 4k blocks and 524288 inodes
Filesystem UUID: 9d763068-69d8-43f5-a334-87b289d0de9d
Superblock backups stored on blocks:
	32768, 98304, 163840, 229376, 294912, 819200, 884736, 1605632

Allocating group tables: done
Writing inode tables: done
Creating journal (16384 blocks): done
Writing superblocks and filesystem accounting information: done
```

```txt
jojo@jojo-server:~$ sudo lsblk
NAME                      MAJ:MIN RM   SIZE RO TYPE MOUNTPOINTS
...
...
nvme0n1                   259:0    0    70G  0 disk
├─nvme0n1p1               259:1    0     1G  0 part /boot/efi
├─nvme0n1p2               259:2    0     2G  0 part /boot
└─nvme0n1p3               259:3    0  66.9G  0 part
  └─ubuntu--vg-ubuntu--lv 252:0    0  33.5G  0 lvm  /
nvme0n2                   259:4    0     8G  0 disk
└─nvme0n2p1               259:5    0     8G  0 part
```

## 挂载与开机自动加载

挂载点一般有 `/mnt` 和 `/data`
- `/mnt`：Linux系统中​**​临时挂载​**​的传统目录，通常用于手动挂载临时设备（USB驱动器、光盘等）。挂载到`/mnt`的设备通常不需要长期保留，重启后可能需要重新挂载
- `/data`：用户​**​自定义的挂载点​**​，通常用于​**​长期存储​**​数据（如数据库、网站文件等），可以与其他系统目录分离管理（`/var`，`/home` 等）

创建挂载点
```bash
cd /;
sudo mkdir data
```

## 临时挂载

>临时挂载，重启后，磁盘会丢失

```bash
sudo mount /dev/nvme0n2p1 /data
```

可以看见，磁盘正确挂载到了 `/data` 下
```txt
jojo@jojo-server:~$ sudo lsblk
[sudo] password for jojo:
NAME                      MAJ:MIN RM   SIZE RO TYPE MOUNTPOINTS
...
nvme0n1                   259:0    0    70G  0 disk
├─nvme0n1p1               259:1    0     1G  0 part /boot/efi
├─nvme0n1p2               259:2    0     2G  0 part /boot
└─nvme0n1p3               259:3    0  66.9G  0 part
  └─ubuntu--vg-ubuntu--lv 252:0    0  33.5G  0 lvm  /
nvme0n2                   259:4    0     8G  0 disk
└─nvme0n2p1               259:5    0     8G  0 part /data
```

## 永久挂载 - 开机自动挂载

查看分区 UUID
```bash
sudo blkid /dev/nvme0n2p1
```

```txt
jojo@jojo-server:/$ sudo blkid /dev/nvme0n2p1
/dev/nvme0n2p1: UUID="9d763068-69d8-43f5-a334-87b289d0de9d" BLOCK_SIZE="4096" TYPE="ext4" PARTUUID="856280d1-01"
```

编辑 `/etc/fstab`
`fstab` (File System Table​​)，文件系统表。是 Linux 和类 Unix 系统中用于定义文件系统静态挂载信息的配置文件
```bash
sudo vim /etc/fstab
```

```txt
# /etc/fstab: static file system information.
#
# Use 'blkid' to print the universally unique identifier for a
# device; this may be used with UUID= as a more robust way to name devices
# that works even if disks are added and removed. See fstab(5).
#
# <file system> <mount point>   <type>  <options>       <dump>  <pass>
# / was on /dev/ubuntu-vg/ubuntu-lv during curtin installation
/dev/disk/by-id/dm-uuid-LVM-BUVafIePHpGqGeBycUcQcakhlqK5FjiG1KC2dIxrIhiEtFpoC9ulh6uisICrW0dP / ext4 defaults 0 1
# /boot was on /dev/nvme0n1p2 during curtin installation
/dev/disk/by-uuid/090863de-d515-4c0c-a593-7cc1685587c6 /boot ext4 defaults 0 1
# /boot/efi was on /dev/nvme0n1p1 during curtin installation
/dev/disk/by-uuid/D591-D276 /boot/efi vfat defaults 0 1
/swap.img       none    swap    sw      0       0
```

我就加了一行在文件最后面
```txt
UUID=9d763068-69d8-43f5-a334-87b289d0de9d /data ext4 defaults 0 0
```

### 关于 fstab 挂载的一些参数

能看到格式提示：`<file system> <mount point> <type> <options> <dump> <pass>`

`<file system>`​​
指定要挂载的设备或文件系统，支持以下形式：
- ​**​设备路径​**​：如 `/dev/sda1`，这个方式可能因磁盘顺序变化失效，或设备改名失效
- ​**​UUID​**​：如 `UUID=xxxx-xxxx`（推荐，唯一标识符，通过 `blkid` 命令获取）。如果是挂载云盘上的磁盘或分区，应使用 UUID！
- ​**​标签（LABEL）​**​：如 `LABEL=Data`（需预先通过 `e2label` 设置）
- ​**​远程文件系统​**​：如 `NFS` 格式 `host:/path`

`<mount point>`
文件系统的挂载目标目录，需确保目录已存在
- ​**​交换分区（swap）​**​：填写 `none`
- ​**​空格路径​**​：用 `\040` 替代空格（如 `/mnt/disk\040one`）

`<type>`
文件系统类型，常见值包括：
- `ext4`/`xfs`（Linux）、`ntfs`/`vfat`（Windows）、`swap`（交换分区）、`nfs`（网络存储）
- `auto`：自动检测类型（适用于移动设备）

`<options>`
挂载参数，多个参数用逗号分隔：
- ​**​基础选项​**​：  
    `defaults`（等效于 `rw,suid,dev,exec,auto,nouser,async`）。 
    `ro`（只读）、`rw`（读写）、`noexec`（禁止执行二进制文件）
- ​**​性能优化​**​：  
    `noatime`（不更新访问时间）、`nodiratime`（不更新目录访问时间）
- ​**​用户权限​**​：  
    `user`（允许普通用户挂载）、`nouser`（仅限 root）

`<dump>`
控制 `dump` 备份工具的备份频率：
- `0`：不备份（默认）
- `1`：每天备份（仅对 `ext2/3/4` 有效）

`<pass>`
定义 `fsck` 磁盘检查顺序：
- `0`：不检查。
- `1`：优先检查（通常用于根分区 `/`）
- `2`：次要检查（其他分区，按数字顺序执行）
ps：`fsck`（File System Consistency Check）是 Linux/Unix 系统中用于​**​检查和修复文件系统错误​**​的工具

### 验证自动挂载

重启，再执行一次 `sudo lsblk` 观察